/**
 * Integration test: the pm3 /publish route.
 *
 * Asserts (per the migration contract + the fixed map21 pattern):
 *   - creates the source when no source_id is given, queues a pm3/publish task,
 *     returns { etl_context_id, source_id };
 *   - descriptor carries npmrdsSourceId, years, percentTmc (default 100);
 *   - validates npmrdsSourceId + years with 400s;
 *   - NEVER touches the legacy data_manager.etl_contexts table
 *     (parent_context_id must not 500).
 *
 * Node/sqlite harness — no ClickHouse, no live DB.
 * Run: node data-types/pm3/tests/route.integration.js
 */
const DAMA_TEST_DB = process.env.DAMA_TEST_DB || 'dama-sqlite-test';

let passed = 0, failed = 0;
function assert(c, m) { if (!c) throw new Error(`Assertion failed: ${m}`); }
async function test(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.log(`  ✗ ${name}: ${err.message}`); failed++; }
}

async function setup() {
  const { join } = require('path');
  const { unlinkSync, existsSync } = require('fs');
  const serverRoot = require('path').dirname(require.resolve('@availabs/dms-server/package.json'));
  const config = require(join(serverRoot, 'src', 'db', 'configs', `${DAMA_TEST_DB}.config.json`));
  if (config.type === 'sqlite' && config.filename) {
    const dbPath = join(serverRoot, 'src', 'db', 'configs', config.filename);
    if (existsSync(dbPath)) unlinkSync(dbPath);
  }
  const { getDb, awaitReady } = require('@availabs/dms-server/src/db');
  getDb(DAMA_TEST_DB);
  await awaitReady();
}

function getPublishHandler(plugin, helpers) {
  let h = null;
  plugin.routes({ post(p, fn) { if (p === '/publish') h = fn; }, get() {} }, helpers);
  return h;
}
function mockRes() {
  return { statusCode: 200, body: undefined,
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; } };
}
const parseJson = (v) => (typeof v === 'string' ? JSON.parse(v) : (v || {}));

async function runTests() {
  console.log(`\n=== pm3 /publish route (${DAMA_TEST_DB}) ===\n`);
  await setup();

  const tasks = require('@availabs/dms-server/src/dama/tasks');
  const metadata = require('@availabs/dms-server/src/dama/upload/metadata');
  const { getDb } = require('@availabs/dms-server/src/db');
  const helpers = {
    queueTask: tasks.queueTask,
    getTaskStatus: tasks.getTaskStatus,
    createDamaSource: metadata.createDamaSource,
    createDamaView: metadata.createDamaView,
    ensureSchema: metadata.ensureSchema,
    getDb,
  };
  const plugin = require('../index.js');
  const db = getDb(DAMA_TEST_DB);

  await test('plugin exposes the pm3/publish worker', async () => {
    assert(plugin.workers && typeof plugin.workers['pm3/publish'] === 'function',
      'workers map should carry pm3/publish');
  });

  await test('publish (no source_id) creates a pm3 source and queues pm3/publish with percentTmc default 100', async () => {
    const handler = getPublishHandler(plugin, helpers);
    assert(typeof handler === 'function', 'should register POST /publish');
    const stamp = Date.now();
    const req = { params: { pgEnv: DAMA_TEST_DB }, body: {
      npmrdsSourceId: 1,
      years: [2023],
      user_id: 1,
      email: 'x@y.z',
      source_values: { name: `pm3_route_test_${stamp}`, type: 'pm3' },
    } };
    const res = mockRes();
    await handler(req, res);

    assert(res.statusCode !== 500, `should not 500 (got ${res.statusCode}: ${JSON.stringify(res.body)})`);
    assert(res.body && res.body.etl_context_id != null, 'returns etl_context_id');
    assert(res.body && res.body.source_id != null, 'returns source_id');

    const { rows } = await db.query(`SELECT type FROM sources WHERE source_id = $1`, [res.body.source_id]);
    assert(rows[0] && rows[0].type === 'pm3', `created source should be type pm3 (got ${rows[0] && rows[0].type})`);

    const status = await tasks.getTaskStatus(res.body.etl_context_id, DAMA_TEST_DB);
    assert(status && status.worker_path === 'pm3/publish', 'queues a pm3/publish task');
    const desc = parseJson(status.descriptor);
    assert(desc.npmrdsSourceId === 1, 'descriptor carries npmrdsSourceId');
    assert(Array.isArray(desc.years) && desc.years[0] === 2023, 'descriptor carries years');
    assert(desc.percentTmc === 100, `descriptor percentTmc should default to 100 (got ${desc.percentTmc})`);
    assert(desc.isNewSourceCreate === true, 'descriptor flags the new source create');
  });

  await test('publish passes an explicit percentTmc through', async () => {
    const handler = getPublishHandler(plugin, helpers);
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: {
      npmrdsSourceId: 1, years: [2023], percentTmc: 25, user_id: 1,
      source_values: { name: `pm3_pct_${Date.now()}`, type: 'pm3' },
    } }, res);
    assert(res.statusCode !== 500, `should not 500 (got ${res.statusCode})`);
    const status = await tasks.getTaskStatus(res.body.etl_context_id, DAMA_TEST_DB);
    assert(parseJson(status.descriptor).percentTmc === 25, 'descriptor carries percentTmc=25');
  });

  await test('publish rejects missing npmrdsSourceId with 400', async () => {
    const handler = getPublishHandler(plugin, helpers);
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: { years: [2023] } }, res);
    assert(res.statusCode === 400, `should 400 (got ${res.statusCode})`);
  });

  await test('publish rejects missing/empty years with 400', async () => {
    const handler = getPublishHandler(plugin, helpers);
    for (const years of [undefined, [], 'nope']) {
      const res = mockRes();
      await handler({ params: { pgEnv: DAMA_TEST_DB }, body: { npmrdsSourceId: 1, years } }, res);
      assert(res.statusCode === 400, `should 400 for years=${JSON.stringify(years)} (got ${res.statusCode})`);
    }
  });

  await test('publish with parent_context_id does not touch etl_contexts (no legacy UPDATE)', async () => {
    const handler = getPublishHandler(plugin, helpers);
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: {
      npmrdsSourceId: 1, years: [2023], parent_context_id: 999, user_id: 1,
      source_values: { name: `pm3_parentctx_${Date.now()}`, type: 'pm3' },
    } }, res);
    assert(res.statusCode !== 500, `should not 500 (got ${res.statusCode}: ${JSON.stringify(res.body)})`);
    assert(res.body.etl_context_id != null, 'still returns etl_context_id');
  });

  console.log(`\n  ${passed} passing, ${failed} failing\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => { console.error('Test runner error:', err); process.exit(1); });
