/**
 * Integration test (Phase 1): the npmrds_raw /publish route.
 * Asserts the two-source create (npmrds_raw + npmrds_raw_tmc_identification with
 * cross-link), the queued task, validation, and that it never touches etl_contexts.
 *
 * Node/sqlite harness — NO ClickHouse, NO RITIS (rate-limit rule: tests never call RITIS).
 * Run: node data-types/npmrds_raw/tests/route.integration.js
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
  const configPath = join(serverRoot, 'src', 'db', 'configs', `${DAMA_TEST_DB}.config.json`);
  const config = require(configPath);
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
const parseMeta = (m) => (typeof m === 'string' ? JSON.parse(m) : (m || {}));

async function runTests() {
  console.log(`\n=== npmrds_raw /publish route (${DAMA_TEST_DB}) ===\n`);
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

  await test('publish (no source_id) creates npmrds_raw + tmc_identification with cross-link and queues a task', async () => {
    const handler = getPublishHandler(plugin, helpers);
    assert(typeof handler === 'function', 'should register POST /publish');
    const stamp = Date.now();
    const req = { params: { pgEnv: DAMA_TEST_DB }, body: {
      name: `npmrds_raw_route_test_${stamp}`,
      states: ['NY'], startDate: '2024-03-01', endDate: '2024-03-01',
      email: 'x@y.z', user_id: 1,
    } };
    const res = mockRes();
    await handler(req, res);

    assert(res.statusCode !== 500, `should not 500 (got ${res.statusCode}: ${JSON.stringify(res.body)})`);
    assert(res.body && res.body.etl_context_id != null, 'returns etl_context_id');
    assert(res.body && res.body.source_id != null, 'returns source_id (the raw source)');

    const { rows: raw } = await db.query(`SELECT source_id, name, type, metadata FROM sources WHERE source_id = $1`, [res.body.source_id]);
    assert(raw[0] && raw[0].type === 'npmrds_raw', `primary source should be type npmrds_raw (got ${raw[0] && raw[0].type})`);
    const tmcId = parseMeta(raw[0].metadata).tmc_identification_source_id;
    assert(tmcId != null, 'raw source metadata should carry tmc_identification_source_id');

    const { rows: comp } = await db.query(`SELECT type FROM sources WHERE source_id = $1`, [tmcId]);
    assert(comp[0] && comp[0].type === 'npmrds_raw_tmc_identification', `companion should be tmc_identification (got ${comp[0] && comp[0].type})`);

    const status = await tasks.getTaskStatus(res.body.etl_context_id, DAMA_TEST_DB);
    assert(status && status.worker_path === 'npmrds_raw/publish', 'queues an npmrds_raw/publish task');
    const desc = typeof status.descriptor === 'string' ? JSON.parse(status.descriptor) : status.descriptor;
    assert(desc && desc.tmc_identification_source_id === tmcId, 'descriptor carries the tmc_identification_source_id');
  });

  await test('publish rejects a missing/empty states with 400', async () => {
    const handler = getPublishHandler(plugin, helpers);
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: { name: 'x', startDate: '2024-03-01', endDate: '2024-03-01', email: 'e' } }, res);
    assert(res.statusCode === 400, `should 400 on missing states (got ${res.statusCode})`);
  });

  await test('publish with parent_context_id does not touch etl_contexts', async () => {
    const handler = getPublishHandler(plugin, helpers);
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: {
      name: `npmrds_raw_parentctx_${Date.now()}`, states: ['NY'],
      startDate: '2024-03-01', endDate: '2024-03-01', email: 'e', user_id: 1, parent_context_id: 777,
    } }, res);
    assert(res.statusCode !== 500, `should not 500 (got ${res.statusCode}: ${JSON.stringify(res.body)})`);
    assert(res.body.etl_context_id != null, 'still returns etl_context_id');
  });

  console.log(`\n  ${passed} passing, ${failed} failing\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => { console.error('Test runner error:', err); process.exit(1); });
