/**
 * Integration test (Phase 4): the excessive_delay staged worker.
 *
 * The legacy computation ran INLINE in an HTTP route (and could time the
 * server out); here it is a queued worker built via makeWorker(deps) so
 * ClickHouse and the transcom congestion query are injected. This test
 * injects FAKES — a stub chDb returning canned monthly delay rows and
 * fixture congestion blobs — and asserts the worker:
 *   - creates the output table + view (publish mode) and writes rows for an
 *     arbitrary, gappy years[] descriptor (2019 + 2021 — the backfill case),
 *   - applies the transcom construction/accident/other attribution,
 *   - resolves region names from the (injected) region-names table,
 *   - add mode upserts new months into the SAME table without dropping it,
 *   - writes view metadata (start/end dates, years) + source metadata.columns
 *     (the 23-col descriptor),
 *   - reports progress + a terminal event,
 *   - never touches etl_contexts (none exist in this harness).
 *
 * Node/sqlite harness. Run: node data-types/excessive_delay/tests/worker.integration.js
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

// Stub ClickHouse: parses the (year, month) out of the monthly query and
// returns canned delay rows — totals chosen so cent-rounding is observable.
function fakeChDb() {
  const queries = [];
  const execs = [];
  return {
    queries,
    execs,
    async exec({ query }) { execs.push(query); return {}; },
    async query({ query }) {
      queries.push(query);
      const m = query.match(/a\.date >= '(\d{4})-(\d{2})/);
      const year = Number(m[1]), month = Number(m[2]);
      const base = (tmc, region, extra) => ({
        tmc, year, month, region_code: region,
        f_system: 1, aadt: 1000, aadt_combi: 50, aadt_singl: 30,
        length: 0.5, roadname: 'I-90', tmclinear: 11, road_order: 2,
        county_code: '36001', direction: 'EASTBOUND',
        wkb_geometry: { type: 'MultiLineString', coordinates: [[[0, 0], [1, 1]]] },
        total_road_miles: 10.123,
        ...extra,
      });
      return { json: async () => ([
        base('120+1001', '1', { total: 12.3456, non_recurrent: 4.5678 }),
        base('120+1002', '1', { total: 6.111, non_recurrent: 2.999 }),
        base('120+9999', null, { total: 1.005, non_recurrent: 0.5 }),
      ]) };
    },
  };
}

// Fixture congestion blobs (what transcomDelayQuery would return from PG).
function fakeTranscomRows() {
  return [
    { event_category: 'construction', delay_data: { '120+1001': '10', '120+1002': '0.5' } },
    { event_category: 'construction', delay_data: { '120+1001': 5.255 } },
    { event_category: 'accident', delay_data: { '120+1001': '1.25' } },
    // string blob (text transport) + an unattributed category that must be skipped
    { event_category: 'other', delay_data: '{"120+1002": "3"}' },
    { event_category: null, delay_data: { '120+1001': '999' } },
  ];
}

async function runTests() {
  console.log(`\n=== excessive_delay worker (${DAMA_TEST_DB}) ===\n`);
  await setup();

  const { getDb } = require('@availabs/dms-server/src/db');
  const metadata = require('@availabs/dms-server/src/dama/upload/metadata');
  const { makeWorker } = require('../worker.js');
  const db = getDb(DAMA_TEST_DB);
  const stamp = Date.now();

  // Region-names fixture (stands in for ny.nysdot_region_names).
  const regionTbl = `nysdot_region_names_${stamp}`;
  await db.query(`CREATE TABLE ${regionTbl} (region TEXT, name TEXT)`);
  await db.query(`INSERT INTO ${regionTbl} (region, name) VALUES ('1', 'Region One')`);

  const edSrc = await metadata.createDamaSource({ name: `ed_worker_${stamp}`, type: 'excessive_delay', user_id: 1 }, DAMA_TEST_DB);

  const ch = fakeChDb();
  const transcomCalls = [];
  const worker = makeWorker({
    getChDb: () => ch,
    createDamaView: metadata.createDamaView,
    ensureSchema: metadata.ensureSchema,
    fetchTranscomRows: async ({ transcomTable, year, month }) => {
      transcomCalls.push({ transcomTable, year, month });
      return fakeTranscomRows();
    },
    regionNamesTable: regionTbl,
  });

  const events = [];
  let lastProgress = 0;
  const baseDescriptor = {
    mode: 'publish',
    source_id: edSrc.source_id,
    name: `ed_worker_${stamp}`,
    user_id: 1,
    npmrds_production_source_id: 10,
    npmrds_production_view_id: 20,
    npmrds_prod_table: 'npmrds.s10_v20_prod',
    npmrds_meta_view_id: 21,
    npmrds_meta_table: 'npmrds_meta.s11_v21_meta',
    transcom_source_id: 12,
    transcom_view_id: 22,
    transcom_table: 'transcom.s12_v22_events',
    years: [2019, 2021],          // the gap case — arbitrary years, no 2020
    months: [1],
  };
  const makeCtx = (descriptor) => ({
    pgEnv: DAMA_TEST_DB,
    db,
    task: { task_id: 1, descriptor },
    dispatchEvent: async (type, message, payload) => { events.push({ type, message, payload }); },
    updateProgress: async (p) => { lastProgress = p; },
  });

  let result, dataTable;
  await test('publish mode runs end-to-end with injected fakes (no live CH/PG externals)', async () => {
    result = await worker(makeCtx(baseDescriptor));
    assert(result && result.source_id === edSrc.source_id, 'returns the source_id');
    assert(result.view_id != null, 'returns the view_id');

    const { rows } = await db.query(`SELECT table_schema, table_name, data_table FROM views WHERE view_id = $1`, [result.view_id]);
    assert(rows[0].table_schema === 'excessive_delay', `view table_schema should be excessive_delay (got ${rows[0].table_schema})`);
    assert(/^s\d+_v\d+_ed_worker_/.test(rows[0].table_name), `legacy table naming (got ${rows[0].table_name})`);
    dataTable = rows[0].data_table;
  });

  await test('writes delay rows for BOTH gap years with cent rounding', async () => {
    const { rows } = await db.query(`SELECT tmc, year, month, total, non_recurrent FROM ${dataTable} ORDER BY year, tmc`);
    assert(rows.length === 6, `2 periods x 3 tmcs = 6 rows (got ${rows.length})`);
    const years = [...new Set(rows.map((r) => Number(r.year)))];
    assert(JSON.stringify(years) === JSON.stringify([2019, 2021]), `rows for 2019 and 2021 only (got ${years})`);
    const r = rows.find((x) => x.tmc === '120+1001' && Number(x.year) === 2019);
    assert(r.total === 12.35, `total rounded to cents (got ${r.total})`);
    assert(r.non_recurrent === 4.57, `non_recurrent rounded to cents (got ${r.non_recurrent})`);
  });

  await test('applies transcom attribution buckets (construction/accident/other)', async () => {
    const { rows } = await db.query(
      `SELECT tmc, construction, accident, other FROM ${dataTable} WHERE year = 2019 ORDER BY tmc`);
    const byTmc = Object.fromEntries(rows.map((r) => [r.tmc, r]));
    assert(byTmc['120+1001'].construction === 15.26, `summed construction 10+5.255 → 15.26 (got ${byTmc['120+1001'].construction})`);
    assert(byTmc['120+1001'].accident === 1.25, `accident 1.25 (got ${byTmc['120+1001'].accident})`);
    assert(byTmc['120+1001'].other === 0, `other defaults to 0 for attributed tmcs (got ${byTmc['120+1001'].other})`);
    assert(byTmc['120+1002'].other === 3, `string blob parsed: other 3 (got ${byTmc['120+1002'].other})`);
    assert(byTmc['120+9999'].construction == null, 'unmatched tmc keeps NULL attribution');
  });

  await test('resolves region names via the injected region-names table', async () => {
    const { rows } = await db.query(`SELECT tmc, region_code, region_name FROM ${dataTable} WHERE year = 2019 ORDER BY tmc`);
    const byTmc = Object.fromEntries(rows.map((r) => [r.tmc, r]));
    assert(byTmc['120+1001'].region_name === 'Region One', `region 1 → Region One (got ${byTmc['120+1001'].region_name})`);
    assert(byTmc['120+9999'].region_name == null, 'null region_code stays unnamed');
  });

  await test('queries transcom per (year, month) with the descriptor table ref', async () => {
    assert(transcomCalls.length === 2, `one transcom fetch per period (got ${transcomCalls.length})`);
    assert(transcomCalls.every((c) => c.transcomTable === 'transcom.s12_v22_events'), 'uses the descriptor transcom table');
    assert(JSON.stringify(transcomCalls.map((c) => c.year)) === JSON.stringify([2019, 2021]), 'periods in order');
  });

  await test('writes view metadata: start/end dates + computed years + refs', async () => {
    const { rows } = await db.query(`SELECT metadata FROM views WHERE view_id = $1`, [result.view_id]);
    const meta = parseMeta(rows[0].metadata);
    assert(meta.start_date === '2019-01-01', `start_date (got ${meta.start_date})`);
    assert(meta.end_date === '2021-01-31', `end_date (got ${meta.end_date})`);
    assert(JSON.stringify(meta.years) === JSON.stringify([2019, 2021]), `years computed from the table (got ${JSON.stringify(meta.years)})`);
    assert(meta.transcom_source_id === 12, 'carries transcom_source_id for /add re-resolution');
    assert(meta.npmrds_prod_table === 'npmrds.s10_v20_prod', 'carries the prod table ref');
    assert(meta.is_clickhouse_table === 0, 'output is a PG table');
  });

  await test('writes source metadata.columns — the 23-col descriptor (drives Table page + /congestion)', async () => {
    const { rows } = await db.query(`SELECT metadata FROM sources WHERE source_id = $1`, [edSrc.source_id]);
    const cols = parseMeta(rows[0].metadata).columns;
    assert(Array.isArray(cols) && cols.length === 23, `23 columns (got ${cols && cols.length})`);
    const names = cols.map((c) => c.name);
    for (const n of ['ogc_fid', 'tmc', 'year', 'month', 'total', 'non_recurrent', 'construction',
      'accident', 'other', 'region_code', 'region_name', 'wkb_geometry', 'f_system', 'aadt',
      'aadt_singl', 'aadt_combi', 'length', 'roadname', 'tmclinear', 'road_order',
      'county_code', 'direction', 'road_information']) {
      assert(names.includes(n), `metadata.columns should include ${n}`);
    }
    assert(cols.every((c) => c.display_name && c.type), 'every column carries display_name + type');
  });

  await test('reports progress to completion and emits FINAL', async () => {
    assert(lastProgress === 1, `final progress 1 (got ${lastProgress})`);
    assert(events.some((e) => e.type === 'excessive_delay:INITIAL'), 'emits INITIAL');
    assert(events.some((e) => /FINAL/.test(e.type)), 'emits FINAL');
  });

  await test('P2: materializes the yearly baseline once per year, joins it monthly, drops it after', async () => {
    const creates = ch.execs.filter((q) => /CREATE TABLE IF NOT EXISTS temp\.avl_avg_tt_/.test(q));
    const drops = ch.execs.filter((q) => /DROP TABLE IF EXISTS temp\.avl_avg_tt_/.test(q));
    assert(creates.length >= 1, 'baseline CTAS issued');
    // one create per distinct year in the run, regardless of month count
    const years = [...new Set(creates.map((q) => q.match(/toYear\(date\) = (\d{4})/)?.[1]))];
    assert(years.length === creates.length, `one baseline per year (got ${creates.length} for years ${years})`);
    // every monthly query joins the materialized table, none recompute inline
    const monthly = ch.queries.filter((q) => /AS non_recurrent/.test(q));
    assert(monthly.length > 0, 'monthly queries ran');
    for (const q of monthly) {
      assert(/INNER JOIN temp\.avl_avg_tt_/.test(q), 'monthly query joins the baseline table');
      assert(!/AVG\(travel_time_all_vehicles\)/.test(q), 'no inline baseline recompute in monthly query');
    }
    assert(drops.length >= creates.length, 'baselines dropped after the run (fresh-drop + cleanup)');
  });

  await test('add mode upserts new months into the SAME table (no drop) and extends metadata', async () => {
    const addResult = await worker(makeCtx({
      ...baseDescriptor, mode: 'add', view_id: result.view_id, years: [2021], months: [2],
    }));
    assert(addResult.view_id === result.view_id, 'add reuses the existing view');

    const { rows } = await db.query(`SELECT year, month, COUNT(*) AS n FROM ${dataTable} GROUP BY year, month ORDER BY year, month`);
    assert(rows.length === 3, `3 periods now (got ${JSON.stringify(rows)})`);
    assert(Number(rows[0].year) === 2019 && Number(rows[0].n) === 3, '2019 rows survived the add');
    assert(rows.some((r) => Number(r.year) === 2021 && Number(r.month) === 2), '2021-02 added');

    const { rows: vr } = await db.query(`SELECT metadata FROM views WHERE view_id = $1`, [result.view_id]);
    const meta = parseMeta(vr[0].metadata);
    assert(meta.end_date === '2021-02-28', `end_date extended (got ${meta.end_date})`);
  });

  await test('re-running a period replaces it (delete-first) — no duplicate rows', async () => {
    const { rows: before } = await db.query(`SELECT COUNT(*) AS n FROM ${dataTable}`);
    await worker(makeCtx({ ...baseDescriptor, mode: 'add', view_id: result.view_id, years: [2021], months: [2] }));
    const { rows: after } = await db.query(`SELECT COUNT(*) AS n FROM ${dataTable}`);
    assert(Number(after[0].n) === Number(before[0].n), `row count unchanged (${before[0].n} → ${after[0].n})`);
  });

  await test('methodology v2: median baseline, capped attribution, M5 metadata', async () => {
    const ch2 = fakeChDb();
    const worker2 = makeWorker({
      getChDb: () => ch2,
      createDamaView: metadata.createDamaView,
      ensureSchema: metadata.ensureSchema,
      fetchTranscomRows: async () => fakeTranscomRows(),
      regionNamesTable: regionTbl,
      distributionsTable: 'aadt_distributions',
    });
    const r2 = await worker2(makeCtx({
      ...baseDescriptor, mode: 'publish', methodology: 'v2',
      name: `ed_v2_${stamp}`, years: [2019], months: [1],
    }));

    // M2: the baseline CTAS uses the median, not AVG
    const ctas = ch2.execs.find((q) => /CREATE TABLE IF NOT EXISTS temp\.avl_avg_tt_/.test(q));
    assert(ctas && /quantile\(0\.5\)\(travel_time_all_vehicles\)/.test(ctas), 'v2 baseline uses quantile(0.5)');
    assert(!/AVG\(travel_time_all_vehicles\)/.test(ctas), 'v2 baseline does not use AVG');

    // M3: attribution capped at non_recurrent per tmc.
    // Fixture: 120+1001 buckets sum 10+5.255+1.25 = 16.505 > non_recurrent 4.5678 → scaled to sum ≈ 4.5678.
    const { rows: v2rows } = await db.query(
      `SELECT v.data_table FROM views v WHERE v.view_id = $1`, [r2.view_id]);
    const t2 = v2rows[0].data_table;
    const { rows: [b] } = await db.query(
      `SELECT non_recurrent, construction, accident, other FROM ${t2} WHERE tmc = '120+1001'`);
    const bucketSum = Number(b.construction) + Number(b.accident) + Number(b.other);
    assert(bucketSum <= Number(b.non_recurrent) + 0.02, `buckets capped at non_recurrent (${bucketSum} vs ${b.non_recurrent})`);
    assert(bucketSum > Number(b.non_recurrent) - 0.05, 'cap scales TO the limit, not below');
    assert(Number(b.construction) > Number(b.accident), 'proportions preserved');

    // M5: metadata carries methodology/units/monetization
    const { rows: [vm] } = await db.query(`SELECT metadata FROM views WHERE view_id = $1`, [r2.view_id]);
    const m2 = parseMeta(vm.metadata);
    assert(m2.methodology === 'v2', 'methodology recorded');
    assert(m2.baseline_statistic === 'median', 'baseline_statistic recorded');
    assert(m2.attribution_capped === true, 'attribution_capped recorded');
    assert(m2.units === 'vehicle_hours', 'units recorded');
    assert(m2.monetization && m2.monetization.usd_per_vehicle_hour === 20, 'monetization recorded');
  });

  await test('methodology v1 (default) is unchanged: AVG baseline, uncapped, no v2 keys', async () => {
    const { rows: [vm] } = await db.query(`SELECT metadata FROM views WHERE view_id = $1`, [result.view_id]);
    const m1 = parseMeta(vm.metadata);
    assert(m1.methodology === 'v1', `v1 recorded (got ${m1.methodology})`);
    assert(m1.baseline_statistic === 'mean', 'mean baseline recorded');
    const ctas = ch.execs.find((q) => /CREATE TABLE IF NOT EXISTS temp\.avl_avg_tt_/.test(q));
    assert(/AVG\(travel_time_all_vehicles\)/.test(ctas), 'v1 baseline uses AVG');
  });

  console.log(`\n  ${passed} passing, ${failed} failing\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => { console.error('Test runner error:', err); process.exit(1); });
