/**
 * Integration test (phase 2): the work_zone/exposure worker.
 *
 * Runs the real worker against a faked physical Postgres side, with the
 * data_manager bookkeeping on the sqlite harness. Asserts the things a unit
 * test cannot: that it resolves the spine view for the RIGHT YEAR, reads only
 * anchor TMCs, replaces its window before inserting, takes geometry from the
 * spine, and writes metadata.columns.
 *
 * Run: node data-types/work_zone/tests/exposure.integration.js
 */
const DAMA_TEST_DB = process.env.DAMA_TEST_DB || 'dama-sqlite-test';

let passed = 0, failed = 0;
function assert(c, m) { if (!c) throw new Error(`Assertion failed: ${m}`); }
async function test(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.log(`  ✗ ${name}: ${err.message}`); failed++; }
}
const parseJson = (v) => (typeof v === 'string' ? JSON.parse(v || '{}') : (v || {}));

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

// ── fixture: three zones, one of each completeness shape ──
const ZONES = [
  { wz_event_id: 'Z1', first_start: '2024-06-03T21:00:00Z', last_end: '2024-06-06T05:00:00Z',
    region_name: 'Region 03 - Syracuse', county_name: 'ONONDAGA', facility: 'I-81',
    work_activity_class: 'construction', is_interstate: true, in_tma: true,
    is_significant_candidate: true, n_occurrences: 3, active_days: 3, active_hours: 18,
    lanes_affected: 2, lanes_affected_known: true },
  // no lane count → no E2, but E3 still computable
  { wz_event_id: 'Z2', first_start: '2024-06-10T21:00:00Z', last_end: '2024-06-11T05:00:00Z',
    region_name: 'Region 08 - Hudson Valley', county_name: 'DUTCHESS', facility: 'I-84',
    work_activity_class: 'construction', is_interstate: true, in_tma: false,
    is_significant_candidate: false, n_occurrences: 1, active_days: 1, active_hours: 8,
    lanes_affected: null, lanes_affected_known: false },
  // a never-closed record → the cap must bite
  { wz_event_id: 'Z3', first_start: '2024-07-01T09:00:00Z', last_end: null,
    region_name: 'Region 11 - New York City', county_name: 'QUEENS', facility: 'I-495',
    work_activity_class: 'maintenance', is_interstate: true, in_tma: true,
    is_significant_candidate: false, n_occurrences: 1, active_days: 1, active_hours: 17517.65,
    lanes_affected: 1, lanes_affected_known: true },
];

/** Anchor rows AND an impact row that must be ignored. */
const TMC_ROWS = [
  { wz_event_id: 'Z1', tmc: 'T1', tmc_role: 'anchor', length: 0.5, first_start: '2024-06-03T21:00:00Z' },
  { wz_event_id: 'Z1', tmc: 'T2', tmc_role: 'anchor', length: 0.5, first_start: '2024-06-03T21:00:00Z' },
  { wz_event_id: 'Z1', tmc: 'T9', tmc_role: 'impact', length: 9.9, first_start: '2024-06-03T21:00:00Z' },
  { wz_event_id: 'Z2', tmc: 'T3', tmc_role: 'anchor', length: 1.0, first_start: '2024-06-10T21:00:00Z' },
  { wz_event_id: 'Z3', tmc: 'T4', tmc_role: 'anchor', length: 0.25, first_start: '2024-07-01T09:00:00Z' },
];

const META = {
  T1: { aadt: 40000, aadt_unidir: 20000, f_system: 1, congestion_level: 'MODERATE_CONGESTION', directionality: 'EVEN_DIST', length: 0.5 },
  T2: { aadt: 40000, aadt_unidir: 20000, f_system: 1, congestion_level: 'MODERATE_CONGESTION', directionality: 'EVEN_DIST', length: 0.5 },
  T3: { aadt: 30000, aadt_unidir: 15000, f_system: 1, congestion_level: 'NO2LOW_CONGESTION', directionality: 'EVEN_DIST', length: 1.0 },
  // T4 has no AADT — the ~20% of zones with no volume input
  T4: { aadt: null, aadt_unidir: null, f_system: 1, congestion_level: 'SEVERE_CONGESTION', directionality: 'PM_PEAK', length: 0.25 },
  T9: { aadt: 99999, aadt_unidir: 99999, f_system: 1, congestion_level: 'SEVERE_CONGESTION', directionality: 'PM_PEAK', length: 9.9 },
};

function fakePgDb() {
  const statements = [];
  return {
    type: 'postgres',
    statements,
    async query(text, params) {
      statements.push({ text: String(text), params });
      const t = String(text).trim();
      // the anchor read is a CTE, so match WITH as well as SELECT
      if (/^(SELECT|WITH)/i.test(t)) {
        if (/wz_event_2024/.test(t) && !/wz_event_tmc/.test(t)) return { rows: ZONES };
        if (/wz_event_tmc_2024/.test(t)) {
          // the worker filters tmc_role in SQL; the fake honours that so the
          // test proves the filter is actually in the query
          const anchorsOnly = /tmc_role = 'anchor'/.test(t);
          const rows = TMC_ROWS
            .filter((r) => (anchorsOnly ? r.tmc_role === 'anchor' : true))
            .map((r) => ({ ...r, ...META[r.tmc], length: r.length }));
          return { rows };
        }
      }
      return { rows: [] };
    },
  };
}

async function runTests() {
  console.log(`\n=== work_zone/exposure worker (${DAMA_TEST_DB}) ===\n`);
  await setup();

  const { getDb } = require('@availabs/dms-server/src/db');
  const metadata = require('@availabs/dms-server/src/dama/upload/metadata');
  const db = getDb(DAMA_TEST_DB);
  const { makeExposure } = require('../workers/exposure.js');
  const sql = require('../sql.js');

  const mkSource = (name, type, meta = {}) => metadata.createDamaSource({ name, type, user_id: 1, metadata: meta }, DAMA_TEST_DB);
  const mkView = async (source_id, schema, table, meta = {}) => {
    const v = await metadata.createDamaView({ source_id, user_id: 1 }, DAMA_TEST_DB);
    await db.query(
      `UPDATE views SET table_schema = $1, table_name = $2, data_table = $3, metadata = $4 WHERE view_id = $5`,
      [schema, table, `${schema}.${table}`, JSON.stringify(meta), v.view_id]);
    return v;
  };

  const metaSrc = await mkSource(`npmrds_meta_${Date.now()}`, 'npmrds_meta');
  await mkView(metaSrc.source_id, 'npmrds_geometry', 'npmrds_meta', { is_clickhouse_table: 0 });
  const tmcSrc = await mkSource(`wz_event_tmc_${Date.now()}`, 'wz_event_tmc');
  const spineSrc = await mkSource(`wz_event_${Date.now()}`, 'wz_event', { wz_event_tmc_source_id: tmcSrc.source_id });
  const expSrc = await mkSource(`wz_exposure_${Date.now()}`, 'wz_exposure');

  // TWO spine vintages, so the year-matching is actually exercised
  const spineMeta = (y) => ({ start_date: `${y}-01-01`, end_date: `${y}-12-31`, npmrds_meta_source_id: metaSrc.source_id });
  await mkView(spineSrc.source_id, 'work_zone', 'wz_event_2023', spineMeta(2023));
  const spine2024 = await mkView(spineSrc.source_id, 'work_zone', 'wz_event_2024', spineMeta(2024));
  await mkView(tmcSrc.source_id, 'work_zone', 'wz_event_tmc_2023', spineMeta(2023));
  await mkView(tmcSrc.source_id, 'work_zone', 'wz_event_tmc_2024', spineMeta(2024));

  const events = [];
  const pg = fakePgDb();
  const exposure = makeExposure({ getPgDb: () => pg, createDamaView: metadata.createDamaView });
  const descriptor = {
    source_id: expSrc.source_id,
    wz_event_source_id: spineSrc.source_id,
    npmrds_meta_source_id: metaSrc.source_id,
    map21_source_id: 1,
    start_date: '2024-01-01', end_date: '2024-12-31', user_id: 1,
  };
  const ctx = (d) => ({
    task: { task_id: 1, descriptor: d }, pgEnv: DAMA_TEST_DB, db,
    dispatchEvent: async (type, msg, payload) => { events.push({ type, msg, payload }); },
    updateProgress: async () => {},
  });

  let result;
  await test('runs end to end and reports completeness', async () => {
    result = await exposure(ctx(descriptor));
    assert(result.zones === 3, `3 zones (got ${result.zones})`);
    // Z1 has lanes + AADT; Z2 has no lane count; Z3 has no AADT
    assert(result.exposure_complete === 1, `only Z1 is complete (got ${result.exposure_complete})`);
  });

  await test('resolves the spine view for the descriptor YEAR, not the newest view', () => {
    const resolved = events.find((e) => e.type === 'work_zone/exposure:RESOLVED');
    assert(/wz_event_2024/.test(resolved.payload.wz_event), `picks the 2024 spine (got ${resolved.payload.wz_event})`);
    assert(/wz_event_tmc_2024/.test(resolved.payload.wz_event_tmc), 'picks the matching tmc view');
    assert(resolved.payload.meta_year === 2024, `uses the window's meta year (got ${resolved.payload.meta_year})`);
  });

  await test('refuses a window the spine has no vintage for, rather than using the wrong one', async () => {
    let msg = null;
    try { await exposure(ctx({ ...descriptor, start_date: '2019-01-01', end_date: '2019-12-31' })); }
    catch (e) { msg = e.message; }
    assert(/no view for 2019/.test(msg || ''), `explains the gap (got ${msg})`);
    assert(/run the spine for that window first/.test(msg || ''), 'says what to do about it');
  });

  await test('reads ANCHOR TMCs only — impact TMCs must not inflate exposure', () => {
    const read = pg.statements.find((s) => /wz_event_tmc_2024/.test(s.text) && /^(SELECT|WITH)/i.test(s.text.trim()));
    assert(read, 'queries the tmc table');
    assert(/tmc_role = 'anchor'/.test(read.text), 'filters to anchors in SQL');
    // Z1's extent is its two 0.5-mile anchors, NOT the 9.9-mile impact TMC
    const insert = pg.statements.find((s) => /INSERT INTO work_zone\./.test(s.text));
    assert(/'Z1'/.test(insert.text), 'writes Z1');
    assert(!/9\.9/.test(insert.text), 'the 9.9-mile impact TMC never reaches the exposure row');
  });

  await test('computes the hand-checkable case correctly through the whole worker', () => {
    const insert = pg.statements.find((s) => /INSERT INTO work_zone\./.test(s.text));
    // Z1: 2 lanes × (0.5 + 0.5) mi × 18 h = 36 lane-mile-hours
    assert(/, 36,/.test(insert.text) || /36/.test(insert.text), 'Z1 lane-mile-hours = 36');
  });

  await test('caps a never-closed record and records that it did', () => {
    const insert = pg.statements.find((s) => /INSERT INTO work_zone\./.test(s.text));
    assert(/'reported_capped'/.test(insert.text), 'records the duration basis on every row');
    // Z3 reported ~17,518 h for one occurrence; the 30-day cap is 720 h
    assert(/720/.test(insert.text), 'Z3 is capped to 720 hours');
    assert(!/17517/.test(insert.text), 'the uncapped duration is not written as active_hours_used');
  });

  await test('takes each zone geometry from the spine table rather than recomputing it', () => {
    const insert = pg.statements.find((s) => /INSERT INTO work_zone\./.test(s.text));
    assert(/LEFT JOIN work_zone\.wz_event_2024 e ON e\.wz_event_id = v\.wz_event_id/.test(insert.text),
      'joins the spine for wkb_geometry');
    assert(/e\.wkb_geometry/.test(insert.text), 'selects the spine geometry');
  });

  await test('replaces its window before inserting', () => {
    const del = pg.statements.findIndex((s) => /^DELETE FROM work_zone\./.test(s.text.trim()));
    const ins = pg.statements.findIndex((s) => /INSERT INTO work_zone\./.test(s.text));
    assert(del >= 0, 'deletes the window');
    assert(del < ins, 'the delete precedes the insert');
    assert(/first_start >= '2024-01-01'/.test(pg.statements[del].text), 'deletes the descriptor window');
  });

  await test('creates the table with ogc_fid and a 4326 geometry column', () => {
    const ddl = pg.statements.find((s) => /CREATE TABLE IF NOT EXISTS work_zone\./.test(s.text));
    assert(ddl, 'runs the DDL');
    assert(/ogc_fid SERIAL PRIMARY KEY/.test(ddl.text), 'ogc_fid PK');
    assert(/public\.geometry\(Geometry, 4326\)/.test(ddl.text), 'geometry is SRID 4326');
    assert(/exposure_complete BOOLEAN/.test(ddl.text), 'carries the completeness flag');
  });

  await test('writes metadata.columns and the run summary', async () => {
    const { rows } = await db.query(`SELECT metadata FROM sources WHERE source_id = $1`, [expSrc.source_id]);
    const m = parseJson(rows[0].metadata);
    assert(Array.isArray(m.columns) && m.columns.length === sql.WZ_EXPOSURE_TABLE_COLUMNS.length,
      `metadata.columns has all ${sql.WZ_EXPOSURE_TABLE_COLUMNS.length} columns (got ${m.columns && m.columns.length})`);
    assert(m.schema === 'wz_exposure_v1', 'records a schema tag');

    const { rows: vrows } = await db.query(`SELECT metadata FROM views WHERE view_id = $1`, [result.view_id]);
    const vm = parseJson(vrows[0].metadata);
    assert(vm.duration_basis === 'reported_capped', 'view metadata records the duration basis');
    assert(vm.wz_event_view_id === spine2024.view_id, 'records which spine view it read');
    assert(vm.zones === 3 && vm.exposure_complete === 1, 'records the counts');
    assert(vm.zones_without_aadt === 1 && vm.zones_without_lane_count === 1, 'records the completeness gaps');
    assert(vm.zones_with_capped_duration === 1, 'records how many durations were capped');
    assert(typeof vm.lane_mile_hours === 'number' && typeof vm.vmt_through_wz === 'number', 'records the totals');
  });

  await test('a different duration basis changes the totals and is recorded', async () => {
    const pg2 = fakePgDb();
    const exposure2 = makeExposure({ getPgDb: () => pg2, createDamaView: metadata.createDamaView });
    const r = await exposure2(ctx({ ...descriptor, duration_basis: 'nominal_shift' }));
    const { rows } = await db.query(`SELECT metadata FROM views WHERE view_id = $1`, [r.view_id]);
    const vm = parseJson(rows[0].metadata);
    assert(vm.duration_basis === 'nominal_shift', 'records the basis used');
    // Z1 nominal = 2 lanes × 1 mi × (3 days × 8h) = 48, vs 36 capped
    assert(r.lane_mile_hours !== result.lane_mile_hours, 'the basis changes lane-mile-hours');
  });

  await test('rejects an unknown duration basis', async () => {
    let msg = null;
    try { await exposure(ctx({ ...descriptor, duration_basis: 'vibes' })); } catch (e) { msg = e.message; }
    assert(/unknown duration_basis/.test(msg || ''), `refuses it (got ${msg})`);
  });

  console.log(`\n  ${passed} passing, ${failed} failing\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => { console.error('Test runner error:', err); process.exit(1); });
