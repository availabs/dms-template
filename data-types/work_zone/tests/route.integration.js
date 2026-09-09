/**
 * Integration test (phase 0): the work_zone plugin's route contract.
 *
 * Asserts the stage selector behaves — unknown and not-yet-built stages are
 * refused before anything is created, a runnable stage creates the right
 * output source type and queues its worker with a self-contained descriptor,
 * and thresholds are resolved (and validated) at queue time. Also asserts the
 * scaffolded spine worker validates its descriptor before failing, since a
 * scheduled fire never passes through the route.
 *
 * Node/sqlite harness — no Postgres data plane, no ClickHouse, and no
 * TRANSCOM / RITIS / Socrata contact (routes only enqueue).
 *
 * Run: node data-types/work_zone/tests/route.integration.js
 */
const DAMA_TEST_DB = process.env.DAMA_TEST_DB || 'dama-sqlite-test';

let passed = 0, failed = 0;
function assert(c, m) { if (!c) throw new Error(`Assertion failed: ${m}`); }
async function test(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.log(`  ✗ ${name}: ${err.message}`); failed++; }
}
const parseMeta = (m) => (typeof m === 'string' ? JSON.parse(m) : (m || {}));
const parseDesc = (d) => (typeof d === 'string' ? JSON.parse(d) : (d || {}));

async function setup() {
  const { join } = require('path');
  const { unlinkSync, existsSync } = require('fs');
  const serverRoot = require('path').dirname(require.resolve('@availabs/dms-server/package.json'));
  const config = require(join(serverRoot, 'src', 'db', 'configs', `${DAMA_TEST_DB}.config.json`));
  if (config.type === 'sqlite' && config.filename) {
    const p = join(serverRoot, 'src', 'db', 'configs', config.filename);
    if (existsSync(p)) unlinkSync(p);
  }
  const { getDb, awaitReady } = require('@availabs/dms-server/src/db');
  getDb(DAMA_TEST_DB);
  await awaitReady();
}

function collectHandlers(plugin, helpers) {
  const handlers = { post: {}, get: {} };
  plugin.routes({
    post(p, fn) { handlers.post[p] = fn; },
    get(p, fn) { handlers.get[p] = fn; },
  }, helpers);
  return handlers;
}
function mockRes() {
  return { statusCode: 200, body: undefined,
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; } };
}

// A valid spine request, minus whatever a given test wants to break.
const spineBody = (over = {}) => ({
  stage: 'spine',
  name: `wz_event_test_${Date.now()}`,
  start_date: '2024-01-01',
  end_date: '2024-01-31',
  transcom_source_id: 956,
  npmrds_meta_source_id: 582,
  user_id: 1,
  ...over,
});

async function runTests() {
  console.log(`\n=== work_zone routes (${DAMA_TEST_DB}) ===\n`);
  await setup();

  const tasks = require('@availabs/dms-server/src/dama/tasks');
  const metadata = require('@availabs/dms-server/src/dama/upload/metadata');
  const { getDb } = require('@availabs/dms-server/src/db');
  const helpers = {
    queueTask: tasks.queueTask,
    getTaskStatus: tasks.getTaskStatus,
    getTaskEvents: tasks.getTaskEvents,
    createDamaSource: metadata.createDamaSource,
    createDamaView: metadata.createDamaView,
    ensureSchema: metadata.ensureSchema,
    getDb,
  };
  const plugin = require('../index.js');
  const { STAGES, STAGE_NAMES } = require('../stages.js');
  const { DEFAULT_THRESHOLDS } = require('../lib/thresholds.js');
  const db = getDb(DAMA_TEST_DB);
  const handlers = collectHandlers(plugin, helpers);

  // ── registry + wiring ──────────────────────────────────────────────────

  await test('registers the landed workers, namespaced', () => {
    for (const w of ['work_zone/spine', 'work_zone/exposure']) {
      assert(typeof plugin.workers[w] === 'function', `workers should include ${w}`);
    }
    for (const [path] of Object.entries(plugin.workers)) {
      assert(path.startsWith('work_zone/'), `worker path ${path} should be namespaced`);
    }
  });

  await test('declares no schedulables before phase 10', () => {
    assert(plugin.schedulables === undefined, 'schedulables should not be wired yet');
  });

  await test('every declared stage names a worker, a source type and a phase', () => {
    for (const s of STAGE_NAMES) {
      const spec = STAGES[s];
      assert(spec.workerPath === `work_zone/${s}`, `${s}: workerPath should be work_zone/${s}`);
      assert(typeof spec.sourceType === 'string' && spec.sourceType.length, `${s}: needs a sourceType`);
      assert(spec.phase >= 1 && spec.phase <= 10, `${s}: phase should be 1-10 (got ${spec.phase})`);
      assert(Array.isArray(spec.inputs), `${s}: needs an inputs array`);
      assert(Array.isArray(spec.optionalInputs), `${s}: needs an optionalInputs array`);
    }
  });

  await test('registers POST /publish + GET /status + GET /stages', () => {
    assert(typeof handlers.post['/publish'] === 'function', 'should register POST /publish');
    assert(typeof handlers.get['/status'] === 'function', 'should register GET /status');
    assert(typeof handlers.get['/stages'] === 'function', 'should register GET /stages');
  });

  await test('GET /stages lists the pipeline in build order with runnable flags and thresholds', async () => {
    const res = mockRes();
    await handlers.get['/stages']({ params: { pgEnv: DAMA_TEST_DB }, query: {} }, res);
    assert(res.statusCode === 200, `should 200 (got ${res.statusCode})`);
    const { stages, thresholds } = res.body;
    assert(stages.length === STAGE_NAMES.length, `lists every stage (got ${stages.length})`);
    const phases = stages.map((s) => s.phase);
    assert(phases.every((p, i) => i === 0 || p >= phases[i - 1]), 'stages come back in phase order');
    assert(stages[0].stage === 'spine' && stages[0].runnable === true, 'spine is first and runnable');
    assert(stages.filter((s) => s.runnable).length === Object.keys(plugin.workers).length,
      'runnable count matches the registered workers');
    assert(thresholds.defaults.speed_threshold_mph === 35, 'serves the default thresholds');
    assert(thresholds.specs.length === 6, `serves 6 threshold specs (got ${thresholds.specs.length})`);
  });

  // ── refusals (nothing is created) ──────────────────────────────────────

  const countSources = async () => {
    const { rows } = await db.query(`SELECT COUNT(*) AS n FROM sources`, []);
    return Number(rows[0].n);
  };

  await test('POST /publish 400s without a stage', async () => {
    const res = mockRes();
    await handlers.post['/publish']({ params: { pgEnv: DAMA_TEST_DB }, body: { name: 'x' } }, res);
    assert(res.statusCode === 400, `should 400 (got ${res.statusCode})`);
    assert(/stage is required/.test(res.body.error), `names the problem (got ${res.body.error})`);
  });

  await test('POST /publish 400s on an unknown stage', async () => {
    const res = mockRes();
    await handlers.post['/publish']({ params: { pgEnv: DAMA_TEST_DB }, body: spineBody({ stage: 'spinal' }) }, res);
    assert(res.statusCode === 400, `should 400 (got ${res.statusCode})`);
    assert(/unknown stage 'spinal'/.test(res.body.error), `names the stage (got ${res.body.error})`);
  });

  await test('POST /publish 400s on a declared-but-unbuilt stage, naming the phase', async () => {
    // Uses whichever declared stage has no worker yet, so this test does not
    // have to be edited every time a phase lands.
    const unbuilt = STAGE_NAMES.find((s) => !plugin.workers[STAGES[s].workerPath]);
    assert(unbuilt, 'there is still an unbuilt stage to test with');
    const spec = STAGES[unbuilt];
    const before = await countSources();
    const body = { stage: unbuilt, name: 'x', start_date: '2024-01-01', end_date: '2024-01-31', user_id: 1 };
    for (const k of spec.inputs) body[k] = 1;
    const res = mockRes();
    await handlers.post['/publish']({ params: { pgEnv: DAMA_TEST_DB }, body }, res);
    assert(res.statusCode === 400, `should 400 for '${unbuilt}' (got ${res.statusCode})`);
    assert(new RegExp(`phase ${spec.phaseLabel || spec.phase}`).test(res.body.error),
      `names the delivering phase (got ${res.body.error})`);
    assert((await countSources()) === before, 'creates no source for a refused stage');
  });

  await test('POST /publish 400s without a window on a windowed stage', async () => {
    const res = mockRes();
    await handlers.post['/publish']({ params: { pgEnv: DAMA_TEST_DB },
      body: spineBody({ start_date: undefined, end_date: undefined }) }, res);
    assert(res.statusCode === 400, `should 400 (got ${res.statusCode})`);
    assert(/requires start_date and end_date/.test(res.body.error), `explains why (got ${res.body.error})`);
  });

  await test('POST /publish 400s on a malformed or inverted window', async () => {
    const bad = mockRes();
    await handlers.post['/publish']({ params: { pgEnv: DAMA_TEST_DB },
      body: spineBody({ start_date: '01/01/2024' }) }, bad);
    assert(bad.statusCode === 400, `malformed date should 400 (got ${bad.statusCode})`);
    const inverted = mockRes();
    await handlers.post['/publish']({ params: { pgEnv: DAMA_TEST_DB },
      body: spineBody({ start_date: '2024-02-01', end_date: '2024-01-01' }) }, inverted);
    assert(inverted.statusCode === 400, `inverted window should 400 (got ${inverted.statusCode})`);
    assert(/after end_date/.test(inverted.body.error), `explains why (got ${inverted.body.error})`);
  });

  await test('POST /publish 400s when a required upstream source id is missing', async () => {
    const res = mockRes();
    await handlers.post['/publish']({ params: { pgEnv: DAMA_TEST_DB },
      body: spineBody({ npmrds_meta_source_id: undefined }) }, res);
    assert(res.statusCode === 400, `should 400 (got ${res.statusCode})`);
    assert(/npmrds_meta_source_id/.test(res.body.error), `names the missing input (got ${res.body.error})`);
  });

  await test('POST /publish 400s on a bad threshold before creating anything', async () => {
    const before = await countSources();
    const res = mockRes();
    await handlers.post['/publish']({ params: { pgEnv: DAMA_TEST_DB },
      body: spineBody({ thresholds: { speed_threshhold_mph: 45 } }) }, res);
    assert(res.statusCode === 400, `should 400 (got ${res.statusCode})`);
    assert(/unknown threshold/.test(res.body.error), `names the problem (got ${res.body.error})`);
    assert((await countSources()) === before, 'creates no source when thresholds are invalid');
  });

  await test('POST /publish 400s without a name when creating a new source', async () => {
    const res = mockRes();
    await handlers.post['/publish']({ params: { pgEnv: DAMA_TEST_DB }, body: spineBody({ name: undefined }) }, res);
    assert(res.statusCode === 400, `should 400 (got ${res.statusCode})`);
  });

  // ── the happy path ─────────────────────────────────────────────────────

  let spineSourceId = null;
  let spineTaskId = null;
  await test('POST /publish stage=spine creates a wz_event source and queues work_zone/spine', async () => {
    const res = mockRes();
    await handlers.post['/publish']({ params: { pgEnv: DAMA_TEST_DB }, body: spineBody() }, res);
    assert(res.statusCode === 200, `should 200 (got ${res.statusCode}: ${JSON.stringify(res.body)})`);
    assert(res.body.etl_context_id != null, 'returns etl_context_id');
    assert(res.body.source_id != null, 'returns source_id');
    assert(res.body.stage === 'spine' && res.body.source_type === 'wz_event',
      'echoes the stage and the source type it produced');
    spineSourceId = res.body.source_id;
    spineTaskId = res.body.etl_context_id;

    const { rows } = await db.query(`SELECT type, metadata FROM sources WHERE source_id = $1`, [spineSourceId]);
    assert(rows[0] && rows[0].type === 'wz_event', `source type wz_event (got ${rows[0] && rows[0].type})`);
    const meta = parseMeta(rows[0].metadata);
    assert(meta.work_zone_stage === 'spine', 'source metadata records the stage that produced it');
    assert(meta.transcom_source_id === 956, 'source metadata cross-links the upstream source ids');
  });

  await test('the queued descriptor is self-contained: window, source ids, resolved thresholds', async () => {
    const status = await tasks.getTaskStatus(spineTaskId, DAMA_TEST_DB);
    assert(status.worker_path === 'work_zone/spine', `queues work_zone/spine (got ${status.worker_path})`);
    const d = parseDesc(status.descriptor);
    assert(d.stage === 'spine', 'descriptor carries the stage');
    assert(d.start_date === '2024-01-01' && d.end_date === '2024-01-31', 'descriptor carries the window');
    assert(d.transcom_source_id === 956 && d.npmrds_meta_source_id === 582,
      'descriptor carries the upstream source ids (never view ids)');
    assert(JSON.stringify(d.thresholds) === JSON.stringify(DEFAULT_THRESHOLDS),
      `descriptor carries the fully resolved threshold set (got ${JSON.stringify(d.thresholds)})`);
    assert(d.source_id === spineSourceId, 'descriptor carries its own output source id');
    assert('view_id' in d && 'target_view_id' in d, 'descriptor carries the re-run view slots');
  });

  await test('threshold overrides flow into the descriptor, coerced', async () => {
    const res = mockRes();
    await handlers.post['/publish']({ params: { pgEnv: DAMA_TEST_DB }, body: spineBody({
      source_id: spineSourceId,
      thresholds: { speed_threshold_mph: '45', queue_threshold_mi: 1.5 },
    }) }, res);
    assert(res.statusCode === 200, `should 200 (got ${res.statusCode}: ${JSON.stringify(res.body)})`);
    const status = await tasks.getTaskStatus(res.body.etl_context_id, DAMA_TEST_DB);
    const d = parseDesc(status.descriptor);
    assert(d.thresholds.speed_threshold_mph === 45, `coerces the string override (got ${d.thresholds.speed_threshold_mph})`);
    assert(d.thresholds.queue_threshold_mi === 1.5, 'carries the numeric override');
    assert(d.thresholds.differential_mph === 15, 'fills the untouched thresholds with defaults');
  });

  await test('POST /publish reuses an existing source_id without creating another source', async () => {
    const before = await countSources();
    const res = mockRes();
    await handlers.post['/publish']({ params: { pgEnv: DAMA_TEST_DB },
      body: spineBody({ source_id: spineSourceId, start_date: '2024-02-01', end_date: '2024-02-29' }) }, res);
    assert(res.statusCode === 200, `should 200 (got ${res.statusCode}: ${JSON.stringify(res.body)})`);
    assert(res.body.source_id === spineSourceId, 'echoes the existing source_id');
    assert((await countSources()) === before, 'should not create another source');
  });

  await test('POST /publish 400s when the given source_id is the wrong type for the stage', async () => {
    const other = await metadata.createDamaSource(
      { name: `wz_speed_wrong_type_${Date.now()}`, type: 'wz_speed', user_id: 1 }, DAMA_TEST_DB);
    const res = mockRes();
    await handlers.post['/publish']({ params: { pgEnv: DAMA_TEST_DB },
      body: spineBody({ source_id: other.source_id }) }, res);
    assert(res.statusCode === 400, `should 400 (got ${res.statusCode}: ${JSON.stringify(res.body)})`);
    assert(/is a 'wz_speed' source/.test(res.body.error), `explains the mismatch (got ${res.body.error})`);

    const missing = mockRes();
    await handlers.post['/publish']({ params: { pgEnv: DAMA_TEST_DB },
      body: spineBody({ source_id: 987654321 }) }, missing);
    assert(missing.statusCode === 400, `unknown source should 400 (got ${missing.statusCode})`);
  });

  await test('an optional input is carried when given and absent when not', async () => {
    const res = mockRes();
    await handlers.post['/publish']({ params: { pgEnv: DAMA_TEST_DB },
      body: spineBody({ source_id: spineSourceId, transcom_event_tmc_source_id: 1635 }) }, res);
    assert(res.statusCode === 200, `should 200 (got ${res.statusCode})`);
    const d = parseDesc((await tasks.getTaskStatus(res.body.etl_context_id, DAMA_TEST_DB)).descriptor);
    assert(d.transcom_event_tmc_source_id === 1635, 'carries the optional input');
    const first = parseDesc((await tasks.getTaskStatus(spineTaskId, DAMA_TEST_DB)).descriptor);
    assert(!('transcom_event_tmc_source_id' in first), 'omits an optional input that was not given');
  });

  // ── status ─────────────────────────────────────────────────────────────

  await test('GET /status returns the queued task', async () => {
    const res = mockRes();
    await handlers.get['/status']({ params: { pgEnv: DAMA_TEST_DB }, query: { etl_context_id: spineTaskId } }, res);
    assert(res.statusCode === 200, `should 200 (got ${res.statusCode}: ${JSON.stringify(res.body)})`);
    assert(res.body.etl_context_id === spineTaskId, 'echoes the task id as etl_context_id');
    assert(res.body.worker_path === 'work_zone/spine', `reports the worker (got ${res.body.worker_path})`);
  });

  await test('GET /status 400s without an id and 404s on an unknown one', async () => {
    const noId = mockRes();
    await handlers.get['/status']({ params: { pgEnv: DAMA_TEST_DB }, query: {} }, noId);
    assert(noId.statusCode === 400, `should 400 (got ${noId.statusCode})`);
    const missing = mockRes();
    await handlers.get['/status']({ params: { pgEnv: DAMA_TEST_DB }, query: { etl_context_id: 987654321 } }, missing);
    assert(missing.statusCode === 404, `should 404 (got ${missing.statusCode})`);
  });

  // ── the scaffolded worker ──────────────────────────────────────────────

  const workerCtx = (descriptor) => ({
    task: { descriptor },
    pgEnv: DAMA_TEST_DB,
    db,
    dispatchEvent: async () => {},
    updateProgress: async () => {},
  });
  const throws = async (fn) => {
    try { await fn(); return null; } catch (err) { return err.message; }
  };

  await test('work_zone/spine validates its own descriptor before touching a database', async () => {
    const missingInputs = await throws(() => plugin.workers['work_zone/spine'](
      workerCtx({ source_id: 1, start_date: '2024-01-01', end_date: '2024-01-31' })));
    assert(/missing transcom_source_id/.test(missingInputs || ''), `names missing inputs (got ${missingInputs})`);

    const missingWindow = await throws(() => plugin.workers['work_zone/spine'](
      workerCtx({ source_id: 1, transcom_source_id: 956, npmrds_meta_source_id: 582 })));
    assert(/start_date\/end_date/.test(missingWindow || ''), `names the missing window (got ${missingWindow})`);

    const badThreshold = await throws(() => plugin.workers['work_zone/spine'](
      workerCtx({ source_id: 1, transcom_source_id: 956, npmrds_meta_source_id: 582,
        start_date: '2024-01-01', end_date: '2024-01-31', thresholds: { speed_threshold_mph: 350 } })));
    assert(/between 1 and 85/.test(badThreshold || ''), `validates thresholds (got ${badThreshold})`);
  });

  // The worker's own behaviour is covered by tests/spine.integration.js, which
  // fakes the physical Postgres side. Here we only assert the descriptor gate.

  console.log(`\n  ${passed} passing, ${failed} failing\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => { console.error('Test runner error:', err); process.exit(1); });
