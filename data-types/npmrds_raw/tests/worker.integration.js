/**
 * Integration test (Phase 1): the npmrds_raw staged worker.
 *
 * The worker is built via makeWorker(deps) so ClickHouse, RITIS, and CSV loading
 * are injected. This test injects FAKES — it never calls RITIS or a real
 * ClickHouse (iron-clad rule: no test touches RITIS). It asserts the worker:
 *   - drives RITIS only through the injected client,
 *   - issues the load-bearing CH DDL + per-vehicle merge INSERTs,
 *   - writes view metadata (adjusted start/end date + statistics),
 *   - writes source metadata.columns,
 *   - reports progress + a terminal event.
 *
 * Node/sqlite harness. Run: node data-types/npmrds_raw/tests/worker.integration.js
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

// ── Fakes ────────────────────────────────────────────────────────────────────
function fakeChDb() {
  const execSql = [];
  return {
    execSql,
    async exec({ query }) { execSql.push(query); return {}; },
    async query() {
      // canned coverage counts (one TMC, full 5-min day)
      return { json: async () => ([{ count: 288 }]) };
    },
    joined() { return execSql.join('\n;\n'); },
  };
}
function fakeRitis() {
  const calls = [];
  const rec = (n) => (...a) => { calls.push(n); return a; };
  return {
    calls,
    async getLatestAvailableDate() { calls.push('getLatestAvailableDate'); return '03/31/2024'; },
    async getRegionTmcs(opts) { calls.push('getRegionTmcs'); return { regionTmcs: ['104+04000'], tmcToGeo: [{ tmc: '104+04000', wkb_geometry: 'LINESTRING(0 0,1 1)' }] }; },
    async requestAndAwaitDownloads(opts) {
      calls.push('requestAndAwaitDownloads');
      return [
        { vehicle_class: 'npmrds2_combined', uuid: 'u-c' },
        { vehicle_class: 'npmrds2_passenger', uuid: 'u-p' },
        { vehicle_class: 'npmrds2_truck', uuid: 'u-t' },
      ];
    },
    async downloadAndExtract(opts) {
      calls.push('downloadAndExtract');
      return [
        { vehicle_class: 'npmrds2_combined', csvPath: '/tmp/c.csv', tmcIdentificationPath: '/tmp/TMC_Identification.csv' },
        { vehicle_class: 'npmrds2_passenger', csvPath: '/tmp/p.csv', tmcIdentificationPath: '/tmp/TMC_Identification.csv' },
        { vehicle_class: 'npmrds2_truck', csvPath: '/tmp/t.csv', tmcIdentificationPath: '/tmp/TMC_Identification.csv' },
      ];
    },
  };
}

async function runTests() {
  console.log(`\n=== npmrds_raw worker (${DAMA_TEST_DB}) ===\n`);
  await setup();

  const { getDb } = require('@availabs/dms-server/src/db');
  const metadata = require('@availabs/dms-server/src/dama/upload/metadata');
  const { makeWorker } = require('../worker.js');
  const db = getDb(DAMA_TEST_DB);

  // Real sources to attach views to.
  const stamp = Date.now();
  const tmcSrc = await metadata.createDamaSource({ name: `nr_tmcid_${stamp}`, type: 'npmrds_raw_tmc_identification', user_id: 1 }, DAMA_TEST_DB);
  const rawSrc = await metadata.createDamaSource({ name: `nr_raw_${stamp}`, type: 'npmrds_raw', user_id: 1, metadata: { tmc_identification_source_id: tmcSrc.source_id } }, DAMA_TEST_DB);

  const ch = fakeChDb();
  const ritis = fakeRitis();
  const loaded = [];
  const worker = makeWorker({
    getChDb: () => ch,
    makeRitisClient: () => ritis,
    createDamaView: metadata.createDamaView,
    ensureSchema: metadata.ensureSchema,
    loadCsvToCh: async (chDb, table, path) => { loaded.push({ table, path }); },
    insertRows: async () => {},
  });

  const events = [];
  let lastProgress = 0;
  const ctx = {
    pgEnv: DAMA_TEST_DB,
    db,
    task: { task_id: 1, descriptor: {
      source_id: rawSrc.source_id,
      tmc_identification_source_id: tmcSrc.source_id,
      name: `nr_raw_${stamp}`,
      states: ['NY'],
      startDate: '2024-03-01',
      endDate: '2024-12-31',      // will be clamped to latest available (03/31/2024)
      averagingWindowSize: 0,
      user_id: 1,
    } },
    dispatchEvent: async (type, message, payload) => { events.push({ type, message, payload }); },
    updateProgress: async (p) => { lastProgress = p; },
  };

  let result;
  await test('worker runs end-to-end with injected fakes (never calls live RITIS/CH)', async () => {
    result = await worker(ctx);
    assert(result && result.source_id === rawSrc.source_id, 'returns the raw source_id');
    assert(result.view_id != null, 'returns the raw view_id');
  });

  await test('drives RITIS only via the injected client', async () => {
    for (const m of ['getLatestAvailableDate', 'getRegionTmcs', 'requestAndAwaitDownloads', 'downloadAndExtract']) {
      assert(ritis.calls.includes(m), `should call ritis.${m}`);
    }
  });

  await test('issues the load-bearing ClickHouse DDL + per-vehicle merge INSERTs', async () => {
    const sql = ch.joined();
    assert(sql.includes('AggregatingMergeTree'), 'creates the AggregatingMergeTree raw table');
    assert(sql.includes('ReplacingMergeTree'), 'creates ReplacingMergeTree temp/tmc tables');
    for (const k of ['all_vehicles', 'passenger_vehicles', 'freight_trucks']) {
      assert(sql.includes(`travel_time_${k}, data_density_${k}`), `inserts the ${k} columns`);
    }
    assert(/OPTIMIZE TABLE .* FINAL/.test(sql), 'optimizes the table final');
  });

  await test('loads the 3 vehicle CSVs (CH-side, no DuckDB)', async () => {
    assert(loaded.length >= 3, `should load >=3 CSVs, got ${loaded.length}`);
  });

  await test('writes adjusted start/end date + statistics to the raw view metadata', async () => {
    const { rows } = await db.query(`SELECT metadata, statistics FROM views WHERE view_id = $1`, [result.view_id]);
    const meta = parseMeta(rows[0].metadata);
    assert(meta.start_date === '2024-03-01', `start_date should be 2024-03-01 (got ${meta.start_date})`);
    assert(meta.end_date === '2024-03-31', `end_date should be clamped to 2024-03-31 (got ${meta.end_date})`);
    const stats = parseMeta(rows[0].statistics);
    assert(typeof stats.total === 'number', 'statistics.total should be written');
  });

  await test('writes source metadata.columns (drives the Table page)', async () => {
    const { rows } = await db.query(`SELECT metadata FROM sources WHERE source_id = $1`, [rawSrc.source_id]);
    const cols = parseMeta(rows[0].metadata).columns;
    assert(Array.isArray(cols) && cols.length > 0, 'metadata.columns should be a non-empty array');
    const names = cols.map((c) => c.name);
    for (const n of ['tmc', 'date', 'epoch', 'travel_time_all_vehicles', 'state']) {
      assert(names.includes(n), `metadata.columns should include ${n}`);
    }
  });

  await test('reports progress to completion and emits a terminal event', async () => {
    assert(lastProgress === 1, `final progress should be 1 (got ${lastProgress})`);
    assert(events.some((e) => /FINAL/.test(e.type)), 'should emit a FINAL event');
  });

  console.log(`\n  ${passed} passing, ${failed} failing\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => { console.error('Test runner error:', err); process.exit(1); });
