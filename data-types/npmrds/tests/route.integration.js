/**
 * Integration test (Phase 2): the npmrds routes.
 *
 * Asserts the two-source create (npmrds + npmrds_meta with cross-link
 * metadata incl. the tmc_speed / mpo_boundaries references), the queued
 * provision/add/replace/remove tasks, validation, and the legacy response
 * contract { etl_context_id, source_id }. NEVER touches etl_contexts.
 *
 * Node/sqlite harness — NO ClickHouse, NO Postgres-spatial.
 * Run: node data-types/npmrds/tests/route.integration.js
 */
const DAMA_TEST_DB = process.env.DAMA_TEST_DB || 'dama-sqlite-test';

let passed = 0, failed = 0;
function assert(c, m) { if (!c) throw new Error(`Assertion failed: ${m}`); }
async function test(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.log(`  ✗ ${name}: ${err.message}`); failed++; }
}
const parseMeta = (m) => (typeof m === 'string' ? JSON.parse(m) : (m || {}));

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

function getHandler(plugin, helpers, path) {
  let h = null;
  plugin.routes({ post(p, fn) { if (p === path) h = fn; }, get() {} }, helpers);
  return h;
}
function mockRes() {
  return { statusCode: 200, body: undefined,
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; } };
}

async function runTests() {
  console.log(`\n=== npmrds routes (${DAMA_TEST_DB}) ===\n`);
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
  const stamp = Date.now();

  const getDescriptor = async (taskId) => {
    const status = await tasks.getTaskStatus(taskId, DAMA_TEST_DB);
    return {
      status,
      desc: typeof status.descriptor === 'string' ? JSON.parse(status.descriptor) : status.descriptor,
    };
  };

  // ── /publish ───────────────────────────────────────────────────────────────
  let prodSourceId = null;
  let metaSourceId = null;

  await test('publish creates npmrds + npmrds_meta sources with cross-links and queues npmrds/provision', async () => {
    const handler = getHandler(plugin, helpers, '/publish');
    assert(typeof handler === 'function', 'should register POST /publish');
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: {
      name: `npmrds_route_test_${stamp}`,
      user_id: 1, email: 'x@y.z',
      tmcSpeedViewId: 21, tmcSpeedSourceId: 20,
      mpoBoundariesViewId: 31, mpoBoundariesSourceId: 30,
    } }, res);

    assert(res.statusCode !== 500, `should not 500 (got ${res.statusCode}: ${JSON.stringify(res.body)})`);
    assert(res.body && res.body.etl_context_id != null, 'returns etl_context_id');
    assert(res.body && res.body.source_id != null, 'returns source_id (the prod source)');
    prodSourceId = res.body.source_id;

    const { rows: prod } = await db.query(`SELECT source_id, name, type, metadata FROM sources WHERE source_id = $1`, [prodSourceId]);
    assert(prod[0] && prod[0].type === 'npmrds', `prod source should be type npmrds (got ${prod[0] && prod[0].type})`);
    const prodMeta = parseMeta(prod[0].metadata);
    metaSourceId = prodMeta.npmrds_tmc_meta_source_id;
    assert(metaSourceId != null, 'prod source metadata carries npmrds_tmc_meta_source_id');

    const { rows: meta } = await db.query(`SELECT type, name, metadata FROM sources WHERE source_id = $1`, [metaSourceId]);
    assert(meta[0] && meta[0].type === 'npmrds_meta', `companion should be npmrds_meta (got ${meta[0] && meta[0].type})`);
    assert(meta[0].name === `npmrds_route_test_${stamp}_tmc_meta`.toLowerCase(), `meta source name (got ${meta[0].name})`);
    const metaMeta = parseMeta(meta[0].metadata);
    assert(metaMeta.npmrds_source_id === prodSourceId, 'meta source metadata back-links npmrds_source_id');

    const { status, desc } = await getDescriptor(res.body.etl_context_id);
    assert(status.worker_path === 'npmrds/provision', `queues npmrds/provision (got ${status.worker_path})`);
    assert(desc.npmrds_meta_source_id === metaSourceId, 'descriptor carries npmrds_meta_source_id');
    assert(desc.tmcSpeedViewId === 21 && desc.tmcSpeedSourceId === 20, 'descriptor carries tmc_speed refs');
    assert(desc.mpoBoundariesViewId === 31 && desc.mpoBoundariesSourceId === 30, 'descriptor carries mpo_boundaries refs');
  });

  await test('publish rejects missing tmcSpeed / mpoBoundaries references with 400', async () => {
    const handler = getHandler(plugin, helpers, '/publish');
    let res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: {
      name: 'x', user_id: 1, mpoBoundariesViewId: 31, mpoBoundariesSourceId: 30,
    } }, res);
    assert(res.statusCode === 400, `400 on missing tmcSpeed refs (got ${res.statusCode})`);
    res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: {
      name: 'x', user_id: 1, tmcSpeedViewId: 21, tmcSpeedSourceId: 20,
    } }, res);
    assert(res.statusCode === 400, `400 on missing mpoBoundaries refs (got ${res.statusCode})`);
    res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: {
      user_id: 1, tmcSpeedViewId: 21, tmcSpeedSourceId: 20, mpoBoundariesViewId: 31, mpoBoundariesSourceId: 30,
    } }, res);
    assert(res.statusCode === 400, `400 on missing name (got ${res.statusCode})`);
  });

  // ── /add ───────────────────────────────────────────────────────────────────
  await test('add queues npmrds/add with the descriptor verbatim', async () => {
    const handler = getHandler(plugin, helpers, '/add');
    assert(typeof handler === 'function', 'should register POST /add');
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: {
      source_id: prodSourceId, view_id: 999,
      npmrds_raw_view_ids: [55],
      startDate: '2023-01-01', endDate: '2023-12-31',
      user_id: 1, email: 'x@y.z',
    } }, res);
    assert(res.statusCode !== 500, `should not 500 (got ${res.statusCode}: ${JSON.stringify(res.body)})`);
    assert(res.body.etl_context_id != null && res.body.source_id === prodSourceId, 'legacy response contract');
    const { status, desc } = await getDescriptor(res.body.etl_context_id);
    assert(status.worker_path === 'npmrds/add', `queues npmrds/add (got ${status.worker_path})`);
    assert(Array.isArray(desc.npmrds_raw_view_ids) && desc.npmrds_raw_view_ids[0] === 55, 'descriptor carries npmrds_raw_view_ids');
    assert(desc.startDate === '2023-01-01' && desc.endDate === '2023-12-31', 'descriptor carries the date range');
  });

  await test('add rejects missing npmrds_raw_view_ids / view_id with 400', async () => {
    const handler = getHandler(plugin, helpers, '/add');
    let res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: { source_id: prodSourceId, view_id: 999, npmrds_raw_view_ids: [] } }, res);
    assert(res.statusCode === 400, `400 on empty npmrds_raw_view_ids (got ${res.statusCode})`);
    res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: { source_id: prodSourceId, npmrds_raw_view_ids: [55] } }, res);
    assert(res.statusCode === 400, `400 on missing view_id (got ${res.statusCode})`);
  });

  // ── /replace ───────────────────────────────────────────────────────────────
  await test('replace queues npmrds/replace with add/remove ids + replace_year', async () => {
    const handler = getHandler(plugin, helpers, '/replace');
    assert(typeof handler === 'function', 'should register POST /replace');
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: {
      source_id: prodSourceId, view_id: 999,
      npmrds_raw_add_view_ids: [66], npmrds_raw_remove_view_ids: [55],
      replace_year: 2023, startDate: '2023-01-01', endDate: '2023-12-31',
      user_id: 1, email: 'x@y.z',
    } }, res);
    assert(res.statusCode !== 500, `should not 500 (got ${res.statusCode}: ${JSON.stringify(res.body)})`);
    const { status, desc } = await getDescriptor(res.body.etl_context_id);
    assert(status.worker_path === 'npmrds/replace', `queues npmrds/replace (got ${status.worker_path})`);
    assert(desc.replace_year === 2023, 'descriptor carries replace_year');
    assert(desc.npmrds_raw_add_view_ids[0] === 66 && desc.npmrds_raw_remove_view_ids[0] === 55, 'descriptor carries both id arrays');
  });

  // ── /remove ────────────────────────────────────────────────────────────────
  await test('remove queues npmrds/remove', async () => {
    const handler = getHandler(plugin, helpers, '/remove');
    assert(typeof handler === 'function', 'should register POST /remove');
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: {
      source_id: prodSourceId, view_id: 999,
      npmrds_raw_removed_view_ids: [55],
      user_id: 1,
    } }, res);
    assert(res.statusCode !== 500, `should not 500 (got ${res.statusCode}: ${JSON.stringify(res.body)})`);
    const { status, desc } = await getDescriptor(res.body.etl_context_id);
    assert(status.worker_path === 'npmrds/remove', `queues npmrds/remove (got ${status.worker_path})`);
    assert(desc.npmrds_raw_removed_view_ids[0] === 55, 'descriptor carries removed view ids');
  });

  await test('no route ever touches a data_manager.etl_contexts table', async () => {
    // The sqlite harness has no etl_contexts table at all — any access would
    // have thrown above. Belt-and-braces: confirm it still doesn't exist.
    const { rows } = await db.query(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '%etl_contexts%'`, []);
    assert(rows.length === 0, 'no etl_contexts table should exist or have been created');
  });

  console.log(`\n  ${passed} passing, ${failed} failing\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => { console.error('Test runner error:', err); process.exit(1); });
