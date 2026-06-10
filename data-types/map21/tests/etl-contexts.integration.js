/**
 * Regression test (Phase 0): the map21 /publish route must NOT touch the
 * non-existent `data_manager.etl_contexts` table when `parent_context_id` is
 * supplied. Before the fix this throws (relation does not exist) and the route
 * returns 500; after the fix it returns { etl_context_id, source_id }.
 *
 * Node integration harness (mirrors dms-server/tests/test-datatypes.js).
 * Run: node data-types/map21/tests/etl-contexts.integration.js
 * Uses the dama-sqlite-test pgEnv — never touches a real DB or ClickHouse.
 */

const DAMA_TEST_DB = process.env.DAMA_TEST_DB || 'dama-sqlite-test';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}: ${err.message}`);
    failed++;
  }
}

async function setup() {
  const { join } = require('path');
  const { unlinkSync, existsSync } = require('fs');
  const serverRoot = require('path').dirname(
    require.resolve('@availabs/dms-server/package.json')
  );
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

// Capture the POST /publish handler the plugin registers.
function getPublishHandler(plugin, helpers) {
  let publishHandler = null;
  const fakeRouter = {
    post(path, handler) {
      if (path === '/publish') publishHandler = handler;
    },
    get() {},
  };
  plugin.routes(fakeRouter, helpers);
  return publishHandler;
}

function mockRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
  };
}

async function runTests() {
  console.log(`\n=== map21 etl_contexts regression (${DAMA_TEST_DB}) ===\n`);
  await setup();

  const tasks = require('@availabs/dms-server/src/dama/tasks');
  const metadata = require('@availabs/dms-server/src/dama/upload/metadata');
  const { getDb, loadConfig } = require('@availabs/dms-server/src/db');
  const helpers = {
    queueTask: tasks.queueTask,
    getTaskStatus: tasks.getTaskStatus,
    createDamaSource: metadata.createDamaSource,
    createDamaView: metadata.createDamaView,
    ensureSchema: metadata.ensureSchema,
    getDb,
    loadConfig,
  };

  const plugin = require('../index.js');

  await test('publish with parent_context_id does not touch etl_contexts (returns task + source)', async () => {
    const handler = getPublishHandler(plugin, helpers);
    assert(typeof handler === 'function', 'plugin should register a POST /publish handler');

    const req = {
      params: { pgEnv: DAMA_TEST_DB },
      body: {
        npmrdsSourceId: 1,
        years: [2022],
        parent_context_id: 999, // the trigger for the legacy etl_contexts UPDATE
        user_id: 1,
        source_values: { name: `map21_etlctx_test_${Date.now()}`, type: 'map21' },
      },
    };
    const res = mockRes();
    await handler(req, res);

    assert(res.statusCode !== 500, `route should not 500 (got ${res.statusCode}: ${JSON.stringify(res.body)})`);
    assert(res.body && res.body.etl_context_id != null, 'response should carry etl_context_id');
    assert(res.body && res.body.source_id != null, 'response should carry source_id');

    // And the task should really have been queued.
    const status = await tasks.getTaskStatus(res.body.etl_context_id, DAMA_TEST_DB);
    assert(status && status.worker_path === 'map21/publish', 'a map21/publish task should be queued');
  });

  console.log(`\n  ${passed} passing, ${failed} failing\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
