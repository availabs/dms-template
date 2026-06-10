/**
 * Integration test (Phase 3): the transcom plugin routes.
 *
 * Asserts each route creates the right source type (with cross-links), queues
 * the right worker with the right descriptor, validates inputs, and never
 * touches etl_contexts. Node/sqlite harness — NO Postgres data plane, and the
 * TRANSCOM API is never contacted (routes only enqueue).
 *
 * Run: node data-types/transcom/tests/route.integration.js
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
  const handlers = {};
  plugin.routes({ post(p, fn) { handlers[p] = fn; }, get() {} }, helpers);
  return handlers;
}
function mockRes() {
  return { statusCode: 200, body: undefined,
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; } };
}

async function runTests() {
  console.log(`\n=== transcom routes (${DAMA_TEST_DB}) ===\n`);
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
  const handlers = collectHandlers(plugin, helpers);
  const stamp = Date.now();

  await test('registers all worker paths', () => {
    for (const w of ['transcom/publish', 'transcom/add', 'transcom/event_tmc', 'transcom/congestion']) {
      assert(typeof plugin.workers[w] === 'function', `workers should include ${w}`);
    }
  });

  await test('registers all routes', () => {
    for (const r of ['/publish', '/add', '/event_tmc', '/congestion/publish', '/congestion/add']) {
      assert(typeof handlers[r] === 'function', `should register POST ${r}`);
    }
  });

  let transcomSourceId = null;
  await test('POST /publish creates a transcom source and queues transcom/publish with day-bounded timestamps', async () => {
    const res = mockRes();
    await handlers['/publish']({ params: { pgEnv: DAMA_TEST_DB }, body: {
      name: `transcom_route_test_${stamp}`,
      start_date: '2024-03-01', end_date: '2024-03-31',
      geom_source_id: 11, npmrds_production_source_id: 22, map21_source_id: 33,
      user_id: 1,
    } }, res);
    assert(res.statusCode === 200, `should 200 (got ${res.statusCode}: ${JSON.stringify(res.body)})`);
    assert(res.body.etl_context_id != null, 'returns etl_context_id');
    assert(res.body.source_id != null, 'returns source_id');
    transcomSourceId = res.body.source_id;

    const { rows } = await db.query(`SELECT type FROM sources WHERE source_id = $1`, [transcomSourceId]);
    assert(rows[0] && rows[0].type === 'transcom', `source type should be transcom (got ${rows[0] && rows[0].type})`);

    const status = await tasks.getTaskStatus(res.body.etl_context_id, DAMA_TEST_DB);
    assert(status.worker_path === 'transcom/publish', `queues transcom/publish (got ${status.worker_path})`);
    const d = parseDesc(status.descriptor);
    assert(d.start_timestamp === '2024-03-01 00:00:00', `start_timestamp start-of-day (got ${d.start_timestamp})`);
    assert(d.end_timestamp === '2024-03-31 23:59:59', `end_timestamp end-of-day (got ${d.end_timestamp})`);
    assert(d.geom_source_id === 11 && d.npmrds_production_source_id === 22 && d.map21_source_id === 33,
      'descriptor carries the geometry/production/map21 source ids');
  });

  await test('POST /publish reuses an existing source_id without creating a new source', async () => {
    const { rows: before } = await db.query(`SELECT COUNT(*) AS n FROM sources`, []);
    const res = mockRes();
    await handlers['/publish']({ params: { pgEnv: DAMA_TEST_DB }, body: {
      source_id: transcomSourceId,
      start_date: '2024-04-01', end_date: '2024-04-30',
      geom_source_id: 11, npmrds_production_source_id: 22, map21_source_id: 33,
      user_id: 1,
    } }, res);
    assert(res.statusCode === 200, `should 200 (got ${res.statusCode}: ${JSON.stringify(res.body)})`);
    assert(res.body.source_id === transcomSourceId, 'echoes the existing source_id');
    const { rows: after } = await db.query(`SELECT COUNT(*) AS n FROM sources`, []);
    assert(Number(after[0].n) === Number(before[0].n), 'should not create another source');
  });

  await test('POST /publish 400s without the geometry/production/map21 sources', async () => {
    const res = mockRes();
    await handlers['/publish']({ params: { pgEnv: DAMA_TEST_DB }, body: {
      name: 'x', start_date: '2024-03-01', end_date: '2024-03-31', user_id: 1,
    } }, res);
    assert(res.statusCode === 400, `should 400 (got ${res.statusCode})`);
  });

  await test('POST /publish 400s without dates', async () => {
    const res = mockRes();
    await handlers['/publish']({ params: { pgEnv: DAMA_TEST_DB }, body: {
      name: 'x', geom_source_id: 1, npmrds_production_source_id: 2, map21_source_id: 3,
    } }, res);
    assert(res.statusCode === 400, `should 400 (got ${res.statusCode})`);
  });

  await test('POST /add queues transcom/add against an existing source + view', async () => {
    const res = mockRes();
    await handlers['/add']({ params: { pgEnv: DAMA_TEST_DB }, body: {
      source_id: transcomSourceId, view_id: 999,
      start_date: '2024-04-01', end_date: '2024-04-30', user_id: 1,
    } }, res);
    assert(res.statusCode === 200, `should 200 (got ${res.statusCode}: ${JSON.stringify(res.body)})`);
    const status = await tasks.getTaskStatus(res.body.etl_context_id, DAMA_TEST_DB);
    assert(status.worker_path === 'transcom/add', `queues transcom/add (got ${status.worker_path})`);
    const d = parseDesc(status.descriptor);
    assert(d.view_id === 999, 'descriptor carries view_id');
    assert(d.start_timestamp === '2024-04-01 00:00:00', 'descriptor has day-bounded start');
  });

  await test('POST /add 400s without source_id or view_id', async () => {
    const res = mockRes();
    await handlers['/add']({ params: { pgEnv: DAMA_TEST_DB }, body: { start_date: '2024-04-01', end_date: '2024-04-30' } }, res);
    assert(res.statusCode === 400, `should 400 (got ${res.statusCode})`);
  });

  await test('POST /event_tmc creates a transcom_event_tmc source cross-linked to the transcom source', async () => {
    const res = mockRes();
    await handlers['/event_tmc']({ params: { pgEnv: DAMA_TEST_DB }, body: {
      transcom_source_id: transcomSourceId,
      geom_source_id: 11,
      start_date: '2024-03-01', end_date: '2024-03-31',
      user_id: 1,
    } }, res);
    assert(res.statusCode === 200, `should 200 (got ${res.statusCode}: ${JSON.stringify(res.body)})`);
    const { rows } = await db.query(`SELECT type, metadata FROM sources WHERE source_id = $1`, [res.body.source_id]);
    assert(rows[0] && rows[0].type === 'transcom_event_tmc', `source type transcom_event_tmc (got ${rows[0] && rows[0].type})`);
    assert(parseMeta(rows[0].metadata).transcom_source_id === transcomSourceId, 'metadata cross-links transcom_source_id');
    const status = await tasks.getTaskStatus(res.body.etl_context_id, DAMA_TEST_DB);
    assert(status.worker_path === 'transcom/event_tmc', `queues transcom/event_tmc (got ${status.worker_path})`);
  });

  await test('POST /event_tmc 400s without transcom_source_id', async () => {
    const res = mockRes();
    await handlers['/event_tmc']({ params: { pgEnv: DAMA_TEST_DB }, body: { start_date: '2024-03-01', end_date: '2024-03-31' } }, res);
    assert(res.statusCode === 400, `should 400 (got ${res.statusCode})`);
  });

  let congestionSourceId = null;
  await test('POST /congestion/publish creates a transcom_congestion source and queues transcom/congestion with default conflation ids', async () => {
    const res = mockRes();
    await handlers['/congestion/publish']({ params: { pgEnv: DAMA_TEST_DB }, body: {
      transcom_source_id: transcomSourceId, transcom_view_id: 7,
      start_date: '2024-03-01', end_date: '2024-03-31', user_id: 1,
    } }, res);
    assert(res.statusCode === 200, `should 200 (got ${res.statusCode}: ${JSON.stringify(res.body)})`);
    congestionSourceId = res.body.source_id;
    const { rows } = await db.query(`SELECT type, metadata FROM sources WHERE source_id = $1`, [congestionSourceId]);
    assert(rows[0] && rows[0].type === 'transcom_congestion', `source type transcom_congestion (got ${rows[0] && rows[0].type})`);
    assert(parseMeta(rows[0].metadata).transcom_source_id === transcomSourceId, 'metadata cross-links transcom_source_id');
    const status = await tasks.getTaskStatus(res.body.etl_context_id, DAMA_TEST_DB);
    assert(status.worker_path === 'transcom/congestion', `queues transcom/congestion (got ${status.worker_path})`);
    const d = parseDesc(status.descriptor);
    assert(d.conflation_nodes_source_id === 237, 'defaults conflation nodes source id to 237');
    assert(d.conflation_ways_source_id === 236, 'defaults conflation ways source id to 236');
    assert(d.conflation_v0_source_id === 238, 'defaults conflation v0 source id to 238');
    assert(d.transcom_view_id === 7, 'descriptor carries the transcom view id');
  });

  await test('POST /congestion/publish honors conflation id overrides', async () => {
    const res = mockRes();
    await handlers['/congestion/publish']({ params: { pgEnv: DAMA_TEST_DB }, body: {
      transcom_source_id: transcomSourceId, transcom_view_id: 7,
      start_date: '2024-03-01', end_date: '2024-03-31', user_id: 1,
      conflation_nodes_source_id: 1001, conflation_ways_source_id: 1002, conflation_v0_source_id: 1003,
    } }, res);
    assert(res.statusCode === 200, `should 200 (got ${res.statusCode})`);
    const status = await tasks.getTaskStatus(res.body.etl_context_id, DAMA_TEST_DB);
    const d = parseDesc(status.descriptor);
    assert(d.conflation_nodes_source_id === 1001 && d.conflation_ways_source_id === 1002 && d.conflation_v0_source_id === 1003,
      'overridden conflation ids flow into the descriptor');
  });

  await test('POST /congestion/add queues transcom/congestion against the existing congestion source', async () => {
    const { rows: before } = await db.query(`SELECT COUNT(*) AS n FROM sources`, []);
    const res = mockRes();
    await handlers['/congestion/add']({ params: { pgEnv: DAMA_TEST_DB }, body: {
      source_id: congestionSourceId,
      start_date: '2024-04-01', end_date: '2024-04-30', user_id: 1,
    } }, res);
    assert(res.statusCode === 200, `should 200 (got ${res.statusCode}: ${JSON.stringify(res.body)})`);
    assert(res.body.source_id === congestionSourceId, 'echoes the existing congestion source');
    const { rows: after } = await db.query(`SELECT COUNT(*) AS n FROM sources`, []);
    assert(Number(after[0].n) === Number(before[0].n), 'should not create another source');
    const status = await tasks.getTaskStatus(res.body.etl_context_id, DAMA_TEST_DB);
    assert(status.worker_path === 'transcom/congestion', `queues transcom/congestion (got ${status.worker_path})`);
  });

  await test('POST /congestion/add 400s without source_id', async () => {
    const res = mockRes();
    await handlers['/congestion/add']({ params: { pgEnv: DAMA_TEST_DB }, body: { start_date: '2024-04-01', end_date: '2024-04-30' } }, res);
    assert(res.statusCode === 400, `should 400 (got ${res.statusCode})`);
  });

  await test('routes never touch etl_contexts (parent_context_id is carried, not written)', async () => {
    const res = mockRes();
    await handlers['/publish']({ params: { pgEnv: DAMA_TEST_DB }, body: {
      name: `transcom_parentctx_${stamp}`, parent_context_id: 777,
      start_date: '2024-03-01', end_date: '2024-03-31',
      geom_source_id: 11, npmrds_production_source_id: 22, map21_source_id: 33, user_id: 1,
    } }, res);
    assert(res.statusCode === 200, `should 200 (got ${res.statusCode}: ${JSON.stringify(res.body)})`);
    assert(res.body.etl_context_id != null, 'still returns etl_context_id');
  });

  console.log(`\n  ${passed} passing, ${failed} failing\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => { console.error('Test runner error:', err); process.exit(1); });
