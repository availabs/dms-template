/**
 * Integration test (phase 4): the work_zone/delay worker.
 *
 * Fakes the physical Postgres side so nothing touches TRANSCOM. Asserts what a
 * unit test cannot: that the delay query includes IMPACT TMCs (the inverse of
 * exposure and speed, and an 11x error if got wrong), that it joins on
 * (event_id, tmc) and never on region_name, that the per-vehicle rate comes
 * from phase 2's exposure view, that the window is replaced before insert, and
 * that the share-of-all-delay reads the excessive-delay series.
 *
 * Run: node data-types/work_zone/tests/delay.integration.js
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

const ZONES = [
  { wz_event_id: 'Z1', member_event_ids: 'E1 E2', first_start: '2024-02-07 04:25:00',
    last_end: '2024-02-09 09:45:00', region_name: 'Region 11 - New York City', county_name: 'QUEENS',
    facility: 'I-495', work_activity_class: 'construction', is_interstate: true, in_tma: true,
    is_significant_candidate: true, veh_through_wz: 120000 },
  // No exposure row: the per-vehicle rate must come back null, not zero.
  { wz_event_id: 'Z2', member_event_ids: 'E3', first_start: '2024-09-10 13:00:00',
    last_end: '2024-09-10 19:00:00', region_name: 'Region 03 - Syracuse', county_name: 'ONONDAGA',
    facility: 'I-81', work_activity_class: 'construction', is_interstate: true, in_tma: true,
    is_significant_candidate: false, veh_through_wz: null },
];

/** 2799 rows: Z1 has 1 anchor + 2 impact, Z2 one anchor with a NULL delay. */
const DELAY_ROWS = [
  { wz_event_id: 'Z1', tmc: 'A1', tmc_role: 'anchor', delay: 100, raw_delay: 90 },
  { wz_event_id: 'Z1', tmc: 'I1', tmc_role: 'impact', delay: 700, raw_delay: 500 },
  { wz_event_id: 'Z1', tmc: 'I2', tmc_role: 'impact', delay: 200, raw_delay: 150 },
  { wz_event_id: 'Z2', tmc: 'A2', tmc_role: 'anchor', delay: null, raw_delay: 12 },
];

function fakePgDb() {
  const statements = [];
  return {
    type: 'postgres', statements,
    async query(text, params) {
      statements.push({ text: String(text), params });
      const t = String(text).trim();
      if (/^(SELECT|WITH)/i.test(t)) {
        if (/zone_members/.test(t)) return { rows: DELAY_ROWS };
        if (/sum\(total\)/.test(t)) {
          // excessive-delay aggregate for the year
          return { rows: [{ total: 277060000, construction: 40310000 }] };
        }
        if (/member_event_ids/.test(t)) {
          // The worker selects `NULL::double precision AS veh_through_wz` when no
          // exposure view resolved; mirror that so the no-exposure case is real.
          const noExposure = /NULL::double precision AS veh_through_wz/.test(t);
          return { rows: ZONES.map((z) => (noExposure ? { ...z, veh_through_wz: null } : z)) };
        }
      }
      return { rows: [] };
    },
  };
}

async function runTests() {
  console.log(`\n=== work_zone/delay worker (${DAMA_TEST_DB}) ===\n`);
  await setup();

  const { getDb } = require('@availabs/dms-server/src/db');
  const metadata = require('@availabs/dms-server/src/dama/upload/metadata');
  const db = getDb(DAMA_TEST_DB);
  const { makeDelay } = require('../workers/delay.js');
  const sql = require('../sql.js');

  const mkSource = (name, type, meta = {}) =>
    metadata.createDamaSource({ name, type, user_id: 1, metadata: meta }, DAMA_TEST_DB);
  const mkView = async (source_id, schema, table, meta = {}) => {
    const v = await metadata.createDamaView({ source_id, user_id: 1 }, DAMA_TEST_DB);
    await db.query(
      `UPDATE views SET table_schema = $1, table_name = $2, data_table = $3, metadata = $4 WHERE view_id = $5`,
      [schema, table, `${schema}.${table}`, JSON.stringify(meta), v.view_id]);
    return v;
  };

  const tmcSrc = await mkSource(`wz_event_tmc_${Date.now()}`, 'wz_event_tmc');
  const spineSrc = await mkSource(`wz_event_${Date.now()}`, 'wz_event',
    { wz_event_tmc_source_id: tmcSrc.source_id });
  const expSrc = await mkSource(`wz_exposure_${Date.now()}`, 'wz_exposure');
  const edSrc = await mkSource(`excessive_delay_${Date.now()}`, 'excessive_delay');
  const outSrc = await mkSource(`wz_delay_${Date.now()}`, 'wz_delay');

  const meta = (y) => ({ start_date: `${y}-01-01`, end_date: `${y}-12-31` });
  await mkView(spineSrc.source_id, 'work_zone', 'wz_event_2023', meta(2023));
  const spine2024 = await mkView(spineSrc.source_id, 'work_zone', 'wz_event_2024', meta(2024));
  await mkView(tmcSrc.source_id, 'work_zone', 'wz_event_tmc_2023', meta(2023));
  await mkView(tmcSrc.source_id, 'work_zone', 'wz_event_tmc_2024', meta(2024));
  await mkView(expSrc.source_id, 'work_zone', 'wz_exposure_2024', meta(2024));
  await mkView(edSrc.source_id, 'excessive_delay', 'excessive_delay_v2_series', {});

  const events = [];
  let pg = fakePgDb();
  const descriptor = {
    source_id: outSrc.source_id,
    wz_event_source_id: spineSrc.source_id,
    wz_event_tmc_source_id: tmcSrc.source_id,
    wz_exposure_source_id: expSrc.source_id,
    excessive_delay_source_id: edSrc.source_id,
    event_tmc_table: 'transcom.event_tmc',
    start_date: '2024-01-01', end_date: '2024-12-31', user_id: 1,
  };
  const ctx = (d) => ({
    task: { task_id: 1, descriptor: d }, pgEnv: DAMA_TEST_DB, db,
    dispatchEvent: async (type, msg, payload) => { events.push({ type, msg, payload }); },
    updateProgress: async () => {},
  });
  const run = async (d = descriptor) => {
    pg = fakePgDb();
    events.length = 0;
    const delay = makeDelay({ getPgDb: () => pg, createDamaView: metadata.createDamaView });
    return delay(ctx(d));
  };

  let result;
  await test('runs end to end and totals delay across ALL TMC roles', async () => {
    result = await run();
    // 100 anchor + 900 impact. An anchors-only rollup would give 100.
    assert(result.statewide.delay_vehicle_hours === 1000,
      `1000 veh-hrs (got ${result.statewide.delay_vehicle_hours})`);
    assert(result.statewide.delay_anchor === 100, 'anchor delay 100');
    assert(result.statewide.delay_impact === 900, 'impact delay 900');
  });

  await test('the delay query does NOT filter to anchor TMCs', async () => {
    await run();
    const q = pg.statements.find((s) => /zone_members/.test(s.text));
    assert(q, 'queries the delay rows');
    // This is the phase-4 inversion. exposure.js and speed.js both carry
    // `tmc_role = 'anchor'`; this query must not.
    assert(!/tmc_role\s*=\s*'anchor'/.test(q.text),
      'must not restrict to anchors — 91% of delay is on impact TMCs');
    assert(/tmc_role/.test(q.text), 'still selects the role so the split can be reported');
  });

  await test('joins 2799 on (event_id, tmc), never on region_name', async () => {
    await run();
    const q = pg.statements.find((s) => /zone_members/.test(s.text));
    assert(/et\.event_id = zm\.event_id AND et\.tmc = zt\.tmc/.test(q.text),
      'joins on the event and TMC');
    // 2799 stores 'Region 11 - New York City ' with a trailing space; the spine
    // trims it, so a region join silently drops 83% of the state's delay.
    assert(!/region_name\s*=/.test(q.text), 'no join on region_name');
  });

  await test('reads the event_tmc table it was given', async () => {
    await run();
    const q = pg.statements.find((s) => /zone_members/.test(s.text));
    assert(/transcom\.event_tmc/.test(q.text), 'uses the descriptor table');
  });

  await test('delay per vehicle uses phase 2 exposure, and is NULL without it', async () => {
    const r = await run();
    const ins = pg.statements.find((s) => /^INSERT INTO work_zone\./.test(s.text.trim()));
    assert(/veh_through_wz/.test(ins.text), 'writes the vehicle count');
    // Z1: 1000 veh-hrs * 60 / 120,000 vehicles = 0.5 min.
    assert(/0\.5/.test(ins.text), 'writes Z1 rate of 0.5 min/veh');
    // Z2 has no exposure row -> null rate, and the statewide rate must be
    // exposure-weighted rather than a mean of rates.
    assert(r.statewide.zones_rate_unknown === 1, `one zone with an unknown rate (got ${r.statewide.zones_rate_unknown})`);
    assert(Math.abs(r.statewide.delay_per_vehicle_min - (1000 * 60 / 120000)) < 1e-6,
      `exposure-weighted rate (got ${r.statewide.delay_per_vehicle_min})`);
  });

  await test('a NULL delay is a gap, not a zero', async () => {
    const r = await run();
    assert(r.statewide.rows_delay_missing === 1, 'counts the missing row');
    // Z2's only row had delay NULL, so it has no delay at all.
    assert(r.statewide.zones_with_delay === 1, `one zone with delay (got ${r.statewide.zones_with_delay})`);
  });

  await test('reports work-zone delay as a share of all delay', async () => {
    const r = await run();
    assert(r.share, 'computes the share');
    // Shares are stored rounded to 8dp (see lib/delay.js: 4dp collapses a small
    // share to 0), so the tolerance matches the rounding rather than exact math.
    assert(Math.abs(r.share.share_of_all_delay - 1000 / 277060000) < 1e-8, 'share of total');
    assert(Math.abs(r.share.ratio_to_construction_bucket - 1000 / 40310000) < 1e-8,
      'ratio to the construction bucket');
    assert(r.share.all_delay_vehicle_hours === 277060000, 'records the denominator it used');
    const ev = events.find((e) => e.type === 'work_zone/delay:SHARE');
    assert(ev, 'dispatches a SHARE event');
  });

  await test('publishes without an exposure source, with null rates', async () => {
    const d = { ...descriptor };
    delete d.wz_exposure_source_id;
    const r = await run(d);
    assert(r.statewide.delay_vehicle_hours === 1000, 'delay still totals');
    assert(r.statewide.delay_per_vehicle_min === null, 'no rate without exposure');
  });

  await test('creates wz_delay with the anchor/impact split on the row', async () => {
    await run();
    const ddl = pg.statements.find((s) => /CREATE TABLE IF NOT EXISTS/.test(s.text));
    for (const col of ['delay_vehicle_hours', 'raw_delay_vehicle_hours', 'delay_anchor',
                       'delay_impact', 'delay_impact_share', 'delay_per_vehicle_min',
                       'exceeds_delay_per_vehicle']) {
      assert(ddl.text.includes(col), `DDL has ${col}`);
    }
  });

  await test('replaces its window before inserting', async () => {
    await run();
    const del = pg.statements.findIndex((s) => /^DELETE FROM work_zone\./.test(s.text.trim()));
    const ins = pg.statements.findIndex((s) => /^INSERT INTO work_zone\./.test(s.text.trim()));
    assert(del >= 0 && ins >= 0 && del < ins, 'deletes the window before inserting');
    const d = pg.statements[del].text;
    assert(/INTERVAL '1 day'/.test(d), 'the window is half-open to end + 1 day');
  });

  await test('writes metadata.columns and records the role rule on the view', async () => {
    const r = await run();
    const { rows } = await db.query(`SELECT metadata FROM sources WHERE source_id = $1`, [outSrc.source_id]);
    const m = parseJson(rows[0].metadata);
    assert(m.columns.length === sql.WZ_DELAY_TABLE_COLUMNS.length,
      `all ${sql.WZ_DELAY_TABLE_COLUMNS.length} columns (got ${m.columns.length})`);
    assert(m.schema === 'wz_delay_v1', 'records a schema tag');

    const { rows: v } = await db.query(`SELECT metadata FROM views WHERE view_id = $1`, [r.view_id]);
    const vm = parseJson(v[0].metadata);
    // The inversion is stamped, because it is the easiest thing to get wrong
    // when copying this pipeline forward.
    assert(vm.tmc_roles_included === 'anchor+impact', 'records that impacts are included');
    assert(vm.delay_column === 'delay', 'records which delay column is primary');
    assert(vm.statewide_m2 && vm.statewide_m2.delay_vehicle_hours === 1000, 'records the rollup');
    assert(vm.delay_share, 'records the share');
    assert(vm.wz_event_view_id === spine2024.view_id, 'records the spine view it read');
  });

  await test('refuses a window with no matching spine view', async () => {
    let msg = null;
    try { await run({ ...descriptor, start_date: '2019-01-01', end_date: '2019-12-31' }); }
    catch (e) { msg = e.message; }
    assert(/no view for 2019/.test(msg || ''), `explains the gap (got ${msg})`);
  });

  console.log(`\n  ${passed} passing, ${failed} failing\n`);
  if (failed) process.exit(1);
}

runTests().catch((e) => { console.error(e); process.exit(1); });
