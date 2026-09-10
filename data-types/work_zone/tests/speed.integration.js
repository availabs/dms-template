/**
 * Integration test (phase 3): the work_zone/speed worker.
 *
 * Fakes BOTH the physical Postgres side and ClickHouse, so nothing touches
 * either. Asserts what a unit test cannot: that the run stages and then DROPS
 * its ClickHouse tables (even when the measure query throws), that the active
 * window comes from view 2799's epoch bounds on anchor TMCs only, that the
 * reference speed is staged from PM3, that the table is created with phase 6's
 * columns, and that the window is replaced before insert.
 *
 * Run: node data-types/work_zone/tests/speed.integration.js
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
  { wz_event_id: 'Z1', member_event_ids: 'Z1 Z1b', first_start: '2024-02-07 04:25:00',
    last_end: '2024-02-07 09:45:00', region_name: 'Region 10 - Long Island', county_name: 'QUEENS',
    facility: 'I-495', work_activity_class: 'construction', is_interstate: true, in_tma: true,
    is_significant_candidate: true },
  { wz_event_id: 'Z2', member_event_ids: 'Z2', first_start: '2024-09-10 13:00:00',
    last_end: '2024-09-10 19:00:00', region_name: 'Region 03 - Syracuse', county_name: 'ONONDAGA',
    facility: 'I-81', work_activity_class: 'construction', is_interstate: true, in_tma: true,
    is_significant_candidate: true },
];

/** What the CH measure query would return: (zone × tmc × hour) cells. */
const CELLS = [
  { wz_event_id: 'Z1', tmc: '120+04939', hour: 5, epochs_observed: 12, epochs_below_absolute: 10,
    epochs_below_relative: 9, epochs_below_fhwa: 7, speed_mean: 30.2, speed_median: 29.8, speed_min: 11.2,
    baseline_speed: 52.1, baseline_p85: 56.4, reference_speed: 54.67, phed_threshold_speed: 30,
    fhwa_threshold_speed: 30, posted_threshold_speed: 40, epochs_below_posted: 11,
    density_a: 9, density_b: 2, density_c: 1, window_source: '2799' },
  { wz_event_id: 'Z1', tmc: '120+04939', hour: 6, epochs_observed: 12, epochs_below_absolute: 12,
    epochs_below_relative: 12, epochs_below_fhwa: 11, speed_mean: 22.4, speed_median: 21.9, speed_min: 12.0,
    baseline_speed: 48.9, baseline_p85: 55.0, reference_speed: 54.67, phed_threshold_speed: 30,
    fhwa_threshold_speed: 30, posted_threshold_speed: 40, epochs_below_posted: 12,
    density_a: 12, density_b: 0, density_c: 0, window_source: '2799' },
  { wz_event_id: 'Z2', tmc: '104N04116', hour: 14, epochs_observed: 12, epochs_below_absolute: 0,
    epochs_below_relative: 0, epochs_below_fhwa: 0, speed_mean: 66.8, speed_median: 67.0, speed_min: 59.0,
    baseline_speed: 65.2, baseline_p85: 69.9, reference_speed: 69.98, phed_threshold_speed: 34.02,
    fhwa_threshold_speed: 34.02, density_a: 4, density_b: 6, density_c: 2 },
  // a cell for a zone outside the window — must be dropped, not written
  { wz_event_id: 'GHOST', tmc: '999', hour: 1, epochs_observed: 12, epochs_below_absolute: 12,
    epochs_below_relative: 12, epochs_below_fhwa: 12, speed_mean: 5, density_a: 12, density_b: 0, density_c: 0 },
];

function fakePgDb() {
  const statements = [];
  return {
    type: 'postgres', statements,
    async query(text, params) {
      statements.push({ text: String(text), params });
      const t = String(text).trim();
      if (/^(SELECT|WITH)/i.test(t)) {
        if (/zone_members/.test(t)) {
          return { rows: [
            { wz_event_id: 'Z1', tmc: '120+04939', date: '2024-02-07', epoch_from: 53, epoch_to: 117,
              window_source: '2799' },
            { wz_event_id: 'Z2', tmc: '104N04116', date: '2024-09-10', epoch_from: 156, epoch_to: 228,
              window_source: 'event' },
          ] };
        }
        if (/anchors AS/.test(t) && /speed_pctl_85/.test(t)) {
          return { rows: [
            { tmc: '120+04939', miles: 0.290003, avg_speedlimit: 50, reference_speed: 54.67, phed_threshold_speed: 30 },
            { tmc: '104N04116', miles: 0.321709, avg_speedlimit: 56.706, reference_speed: 69.98, phed_threshold_speed: 34.02 },
          ] };
        }
        if (/DISTINCT tmc, to_char\(g\.day/.test(t)) {
          return { rows: [{ tmc: '120+04939', date: '2023-05-05' }, { tmc: '104N04116', date: '2023-07-07' }] };
        }
        if (/wz_event_2024/.test(t)) return { rows: ZONES };
      }
      return { rows: [] };
    },
  };
}

/** What the zone-hour M1 query returns: one row per zone, in HOURS not epochs. */
const ZONE_HOURS = [
  { wz_event_id: 'Z1', active_hours_measured: 5, hours_too_sparse: 1, zone_miles: 0.29,
    zone_posted_limit: 50, zone_reference: 54.67, zone_posted_threshold: 40,
    zone_relative_threshold: 32.8, hours_below_posted: 3, hours_below_absolute: 2,
    hours_below_relative: 1, mean_zone_speed: 33.4, min_zone_speed: 12.1 },
  { wz_event_id: 'Z2', active_hours_measured: 6, hours_too_sparse: 0, zone_miles: 0.32,
    zone_posted_limit: 56.706, zone_reference: 69.98, zone_posted_threshold: 46.706,
    zone_relative_threshold: 41.99, hours_below_posted: 0, hours_below_absolute: 0,
    hours_below_relative: 0, mean_zone_speed: 66.8, min_zone_speed: 59.0 },
];

/** Records every statement and insert; can be told to fail the measure query. */
function fakeChDb({ failMeasure = false } = {}) {
  const statements = [];
  const inserts = [];
  const insertValues = [];
  return {
    statements, inserts, insertValues,
    client: { async insert({ table, values }) {
      inserts.push({ table, rows: values.length });
      insertValues.push({ table, values });
    } },
    // Mirrors the DAMA adapter: query/exec take { query }, and query's result
    // is materialised by calling .json().
    async exec({ query }) { statements.push(String(query).trim()); return {}; },
    async query({ query }) {
      const t = String(query).trim();
      statements.push(t);
      if (/^WITH baseline AS/.test(t)) {
        if (failMeasure) throw new Error('simulated ClickHouse failure');
        return { json: async () => CELLS };
      }
      if (/^WITH zone_threshold AS/.test(t)) {
        // M1 proper: one row per zone, counted in HOURS. Z1 slow for 3 of 5
        // measured hours, Z2 never slow.
        return { json: async () => ZONE_HOURS };
      }
      return { json: async () => [] };
    },
  };
}

async function runTests() {
  console.log(`\n=== work_zone/speed worker (${DAMA_TEST_DB}) ===\n`);
  await setup();

  const { getDb } = require('@availabs/dms-server/src/db');
  const metadata = require('@availabs/dms-server/src/dama/upload/metadata');
  const db = getDb(DAMA_TEST_DB);
  const { makeSpeed } = require('../workers/speed.js');
  const sql = require('../sql.js');

  const mkSource = (name, type, meta = {}) => metadata.createDamaSource({ name, type, user_id: 1, metadata: meta }, DAMA_TEST_DB);
  const mkView = async (source_id, schema, table, meta = {}, version = null) => {
    const v = await metadata.createDamaView({ source_id, user_id: 1 }, DAMA_TEST_DB);
    await db.query(
      `UPDATE views SET table_schema=$1, table_name=$2, data_table=$3, metadata=$4, version=$5 WHERE view_id=$6`,
      [schema, table, `${schema}.${table}`, JSON.stringify(meta), version, v.view_id]);
    return v;
  };

  const metaSrc = await mkSource(`npmrds_meta_${Date.now()}`, 'npmrds_meta');
  await mkView(metaSrc.source_id, 'npmrds_geometry', 'npmrds_meta', { is_clickhouse_table: 0 });
  const tmcSrc = await mkSource(`wz_event_tmc_${Date.now()}`, 'wz_event_tmc');
  const spineSrc = await mkSource(`wz_event_${Date.now()}`, 'wz_event', { wz_event_tmc_source_id: tmcSrc.source_id });
  const speedSrc = await mkSource(`npmrds_${Date.now()}`, 'npmrds');
  const pm3Src = await mkSource(`pm3_${Date.now()}`, 'pm3');
  const outSrc = await mkSource(`wz_speed_${Date.now()}`, 'wz_speed');

  const winMeta = (y) => ({ start_date: `${y}-01-01`, end_date: `${y}-12-31`, npmrds_meta_source_id: metaSrc.source_id });
  const spine2024 = await mkView(spineSrc.source_id, 'work_zone', 'wz_event_2024', winMeta(2024));
  await mkView(spineSrc.source_id, 'work_zone', 'wz_event_2023', winMeta(2023));
  await mkView(tmcSrc.source_id, 'work_zone', 'wz_event_tmc_2024', winMeta(2024));
  // the NPMRDS prod source must expose a ClickHouse view
  await mkView(speedSrc.source_id, 'npmrds_geometry', 'pg_only', { is_clickhouse_table: 0 });
  await mkView(speedSrc.source_id, 'clickhouse.npmrds', 's583_v982_NPMRDS_V6', { is_clickhouse_table: 1 });
  await mkView(pm3Src.source_id, 'pm3', 'pm3_2023', {}, '2023');
  const pm32024 = await mkView(pm3Src.source_id, 'pm3', 'pm3_2024', {}, '2024');

  const descriptor = {
    source_id: outSrc.source_id,
    wz_event_source_id: spineSrc.source_id,
    npmrds_source_id: speedSrc.source_id,
    pm3_source_id: pm3Src.source_id,
    event_tmc_table: 'transcom.event_tmc',
    start_date: '2024-01-01', end_date: '2024-12-31', user_id: 1,
  };
  const events = [];
  let pg = fakePgDb(); let ch = fakeChDb();
  const ctx = (d, pgDb, chDb) => ({
    task: { task_id: 1, descriptor: d }, pgEnv: DAMA_TEST_DB, db,
    dispatchEvent: async (type, msg, payload) => { events.push({ type, msg, payload }); },
    updateProgress: async () => {},
  });
  const run = (d, opts = {}) => {
    pg = fakePgDb(); ch = fakeChDb(opts);
    const speed = makeSpeed({ getPgDb: () => pg, getChDb: () => ch, createDamaView: metadata.createDamaView });
    return speed(ctx(d));
  };

  let result;
  await test('runs end to end and reports the cells it wrote', async () => {
    result = await run(descriptor);
    assert(result.zones === 2, `2 zones (got ${result.zones})`);
    assert(result.cells === 3, `3 cells written — the GHOST cell is dropped (got ${result.cells})`);
  });

  await test('resolves the spine, PM3 and the ClickHouse speed view for the right vintage', () => {
    const r = events.find((e) => e.type === 'work_zone/speed:RESOLVED');
    assert(/wz_event_2024/.test(r.payload.wz_event), `2024 spine (got ${r.payload.wz_event})`);
    assert(r.payload.pm3 === 'pm3.pm3_2024', `PM3's 2024 view (got ${r.payload.pm3})`);
    assert(r.payload.npmrds_speeds_ch === 'npmrds.s583_v982_NPMRDS_V6',
      `the CH view, prefix stripped (got ${r.payload.npmrds_speeds_ch})`);
  });

  await test('refuses a year PM3 has no vintage for', async () => {
    let msg = null;
    try { await run({ ...descriptor, start_date: '2023-01-01', end_date: '2023-12-31' }); }
    catch (e) { msg = e.message; }
    assert(/pm3: source \d+ has no view for version 2023/.test(msg || '') || /no view for 2023/.test(msg || ''),
      `explains the gap (got ${msg})`);
  });

  await test('takes the active window from view 2799 epoch bounds, anchors only', async () => {
    await run(descriptor);
    const q = pg.statements.find((s) => /zone_members/.test(s.text));
    assert(q, 'queries the active windows');
    assert(/tmc_role = 'anchor'/.test(q.text), 'restricts to anchor TMCs');
    assert(/bound_start_time/.test(q.text) && /bound_end_time/.test(q.text), 'uses the epoch bounds');
    assert(/transcom\.event_tmc/.test(q.text), 'reads the event_tmc table it was given');
  });

  // The next three assert the SHAPE of the expansion SQL rather than its output:
  // the physical side is faked here, and generate_series / date arithmetic are
  // Postgres-only so they cannot be executed against the sqlite test database.
  // Each one pins a bug that shipped once and cost real coverage, so a rewrite
  // that drops the behaviour fails here instead of silently in a vintage.
  await test('expands a 2799 span across every day it covers, not just its first', async () => {
    await run(descriptor);
    const q = pg.statements.find((s) => /zone_members/.test(s.text));
    assert(/generate_series\(/.test(q.text), 'expands to the day grid');
    // A whole intermediate day is [0, 288) — the first version applied the
    // START day's epoch range to a multi-day span and measured nothing.
    assert(/ELSE 0 END AS epoch_from/.test(q.text), 'intermediate days start at epoch 0');
    assert(/ELSE 288 END AS epoch_to/.test(q.text), 'intermediate days run to epoch 288');
  });

  await test('rolls a same-day window whose end precedes its start onto the next day', async () => {
    await run(descriptor);
    const q = pg.statements.find((s) => /zone_members/.test(s.text));
    assert(/bound_end_time <= et\.bound_start_time/.test(q.text), 'detects the inversion');
    assert(/bound_start_date \+ 1/.test(q.text), 'treats it as crossing midnight');
  });

  await test('falls back to the event clock times where 2799 has no row', async () => {
    await run(descriptor);
    const q = pg.statements.find((s) => /zone_members/.test(s.text));
    // 2799 has NO rows for 2019 or 2020 and misses ~10% of zones in a good year,
    // while the anchor TMC comes from the event's own tmclist and is always
    // there — so the window, not the segment, is what has to be recovered.
    assert(/derived AS/.test(q.text), 'has a fallback window source');
    assert(/NOT EXISTS \(SELECT 1 FROM spans/.test(q.text), 'only where 2799 has no span');
    assert(/'2799' AS window_source/.test(q.text) && /'event' AS window_source/.test(q.text),
      'labels which source each window came from');
  });

  await test('carries window_source onto the rows and counts the split on the view', async () => {
    const out = await run(descriptor);
    const inserted = pg.statements.filter((s) => /^INSERT INTO/.test(s.text.trim()));
    assert(inserted.some((s) => /window_source/.test(s.text)), 'the insert writes the column');
    const { rows: v } = await db.query(`SELECT metadata FROM views WHERE view_id = $1`, [out.view_id]);
    const meta = parseJson(v[0].metadata);
    // A reader restricting an aggregate to conflated windows needs the split
    // without recounting 228k rows.
    assert('windows_from_2799' in meta && 'windows_from_event' in meta,
      'stamps the window-source split on the view');
    assert(meta.windows_from_2799 === 1 && meta.windows_from_event === 1,
      `counts each source (got ${meta.windows_from_2799}/${meta.windows_from_event})`);
  });

  await test('expands the baseline exclusion across whole spans too', async () => {
    await run(descriptor);
    const q = pg.statements.find((s) => /DISTINCT tmc, to_char\(g\.day/.test(s.text));
    assert(q, 'the exclusion query expands to the day grid');
    // Keying the exclusion on bound_start_date alone left the later days of every
    // multi-day event inside the baseline it exists to clean.
    assert(/generate_series\(/.test(q.text), 'uses the day grid');
    assert(/bound_end_date >= \$1/.test(q.text), 'catches spans that START before the window');
  });

  await test('stages tmc, active and exclusion rows in ClickHouse', async () => {
    await run(descriptor);
    const creates = ch.statements.filter((s) => /^CREATE TABLE IF NOT EXISTS/.test(s));
    assert(creates.length === 3, `three staging tables (got ${creates.length})`);
    assert(ch.inserts.length === 3, `three inserts (got ${ch.inserts.length})`);
    const byKind = Object.fromEntries(ch.inserts.map((i) => [i.table.replace(/.*_wz_(\w+?)_.*/, '$1'), i.rows]));
    assert(byKind.tmc === 2, `2 tmc rows (got ${byKind.tmc})`);
    assert(byKind.active === 2, `2 active windows (got ${byKind.active})`);
    assert(byKind.exclude === 2, `2 excluded tmc-days (got ${byKind.exclude})`);
  });

  await test('DROPS its staging tables — including when the measure query fails', async () => {
    await run(descriptor);
    const drops = ch.statements.filter((s) => /^DROP TABLE IF EXISTS/.test(s));
    assert(drops.length === 3, `drops all three on success (got ${drops.length})`);

    let threw = false;
    try { await run(descriptor, { failMeasure: true }); } catch (e) { threw = true; }
    assert(threw, 'the failure propagates rather than being swallowed');
    const dropsAfterFail = ch.statements.filter((s) => /^DROP TABLE IF EXISTS/.test(s));
    assert(dropsAfterFail.length === 3, `and still drops all three (got ${dropsAfterFail.length})`);
  });

  await test('the FHWA threshold is computed from the metadata speed limit', async () => {
    await run(descriptor);
    const ins = ch.inserts.find((i) => /_wz_tmc_/.test(i.table));
    assert(ins, 'stages the tmc table');
    // 0.6 × 56.706 = 34.02; 0.6 × 50 = 30 — both above the 20 mph floor
    const q = pg.statements.find((s) => /avg_speedlimit/.test(s.text));
    assert(q, 'reads avg_speedlimit from the Postgres meta view, not ClickHouse');
  });

  await test('creates wz_speed WITH phase 6 columns, so phase 6 needs no new source', async () => {
    await run(descriptor);
    const ddl = pg.statements.find((s) => /CREATE TABLE IF NOT EXISTS work_zone\./.test(s.text));
    assert(ddl, 'runs the DDL');
    for (const c of ['approach_tmc', 'approach_speed', 'differential_approach', 'differential_baseline', 'exceeds_differential']) {
      assert(new RegExp(c).test(ddl.text), `DDL carries the phase-6 column ${c}`);
    }
    for (const c of ['m1_absolute', 'm1_relative', 'm1_fhwa']) {
      assert(new RegExp(c).test(ddl.text), `DDL carries ${c}`);
    }
  });

  await test('replaces its window before inserting', async () => {
    await run(descriptor);
    const del = pg.statements.findIndex((s) => /^DELETE FROM work_zone\./.test(s.text.trim()));
    const ins = pg.statements.findIndex((s) => /INSERT INTO work_zone\./.test(s.text));
    assert(del >= 0 && del < ins, 'delete precedes insert');
    assert(/first_start < \('2024-12-31'::date \+ INTERVAL '1 day'\)/.test(pg.statements[del].text),
      'the window is half-open to end + 1 day');
  });

  await test('stages the PRIMARY posted-minus-10 threshold per TMC', async () => {
    await run(descriptor);
    const ins = ch.inserts.find((i) => /_wz_tmc_/.test(i.table));
    assert(ins, 'stages the tmc table');
    const create = ch.statements.find((s) => /_wz_tmc_/.test(s) && /^CREATE TABLE/.test(s));
    assert(/posted_threshold_speed/.test(create), 'the staging table carries the primary threshold');
    assert(/posted_speed_limit/.test(create),
      'and the RAW posted limit, which the zone-level M1 needs to length-weight');
    // 50 mph posted -> 40; 56.706 -> 46.706. Derived in the worker from the
    // POSTGRES posted limit, because the ClickHouse copy of the field is empty.
    const vals = ch.insertValues.find((v) => /_wz_tmc_/.test(v.table));
    if (vals) {
      const byTmc = Object.fromEntries(vals.values.map((r) => [r.tmc, r.posted_threshold_speed]));
      assert(Math.abs(byTmc['120+04939'] - 40) < 1e-6, `50 mph posted -> 40 (got ${byTmc['120+04939']})`);
      assert(Math.abs(byTmc['104N04116'] - 46.706) < 1e-6, `56.706 posted -> 46.706 (got ${byTmc['104N04116']})`);
    }
  });

  await test('writes the four M1 shares per cell, primary included', async () => {
    await run(descriptor);
    const ins = pg.statements.find((s) => /INSERT INTO work_zone\./.test(s.text));
    // The column list is generated from WZ_SPEED_COLUMNS, so assert the primary
    // pair is actually in it rather than pattern-matching the values.
    for (const col of ['epochs_below_posted', 'm1_posted', 'posted_threshold_speed',
                       'posted_speed_drop_mph']) {
      assert(ins.text.includes(col), `the insert writes ${col}`);
    }
    // The primary share must precede the absolute one, matching WZ_SPEED_COLUMNS.
    assert(ins.text.indexOf('m1_posted') < ins.text.indexOf('m1_absolute'),
      'primary share comes first in the column list');
    // Z1 hour 6: 12 of 12 below absolute → 1
    assert(/, 1,/.test(ins.text), 'writes a share of 1 for the fully-exceeding cell');
    // Z2: zero exceedance must be written as 0, not NULL
    assert(/, 0,/.test(ins.text), 'writes zero exceedance as 0');
    assert(!/GHOST/.test(ins.text), 'the out-of-window cell is not written');
  });

  await test('computes M1 at the ZONE-HOUR grain, not the epoch grain', async () => {
    const r = await run(descriptor);
    const zoneQ = ch.statements.find((s) => /^WITH zone_threshold AS/.test(s));
    assert(zoneQ, 'runs the zone-hour M1 query');
    assert(/GROUP BY wz_event_id, date, hour/.test(zoneQ), 'groups by clock hour, not hour-of-day');
    assert(/sum\(m\.miles\) \* 3600 \/ sum\(n\.travel_time_all_vehicles\)/.test(zoneQ),
      'the zone speed is a space-mean over the whole extent');

    const { rows: v } = await db.query(`SELECT metadata FROM views WHERE view_id = $1`, [r.view_id]);
    const vm = parseJson(v[0].metadata);
    assert(vm.m1, 'stamps M1 on the view');
    // 3 of (5 + 6) measured hours below the posted threshold — NOT the epoch share.
    assert(Math.abs(vm.m1.m1_posted_hour_weighted - 3 / 11) < 1e-4,
      `hour-weighted M1 (got ${vm.m1.m1_posted_hour_weighted})`);
    assert(vm.m1.active_hours_measured === 11, `counts 11 measured hours (got ${vm.m1.active_hours_measured})`);
    assert(vm.m1.hours_too_sparse === 1, 'reports the hour it refused to classify');
    assert(vm.m1.zones_any_hour_below_posted === 1, 'counts zones with any exceedance hour');
    assert(vm.m1.min_epochs_per_hour === undefined, 'the floor is recorded on the run, not the rollup');
    assert(vm.min_epochs_per_hour === 6, 'records the per-hour observation floor');
  });

  await test('M1 and the epoch-level evidence are BOTH kept, and differ', async () => {
    const r = await run(descriptor);
    const { rows: v } = await db.query(`SELECT metadata FROM views WHERE view_id = $1`, [r.view_id]);
    const vm = parseJson(v[0].metadata);
    // The epoch share (23/36) and the hour share (3/11) answer different
    // questions. Publishing one as the other is the bug these tests exist for.
    assert(vm.statewide_m1, 'keeps the epoch-level evidence rollup');
    assert(vm.m1, 'keeps M1 proper');
    assert(Math.abs(vm.statewide_m1.m1_posted_epoch_weighted - 23 / 36) < 1e-4, 'epoch share unchanged');
    assert(vm.statewide_m1.m1_posted_epoch_weighted !== vm.m1.m1_posted_hour_weighted,
      'the two grains do not coincide');
  });

  await test('the statewide rollup leads with the primary measure', async () => {
    const r = await run(descriptor);
    const { rows: v } = await db.query(`SELECT metadata FROM views WHERE view_id = $1`, [r.view_id]);
    const vm = parseJson(v[0].metadata);
    assert(vm.statewide_m1, 'records a statewide rollup');
    // Z1 has 11 + 12 = 23 of 24 below the posted threshold; Z2 (the no-impact
    // I-81 case) has 0 of 12 → 23/36. A looser threshold must not manufacture
    // an exceedance on a zone that had none.
    assert(Math.abs(vm.statewide_m1.m1_posted_epoch_weighted - 23 / 36) < 1e-4,
      `epoch-weighted primary M1 (got ${vm.statewide_m1.m1_posted_epoch_weighted})`);
    assert(vm.statewide_m1.m1_posted_zone_mean !== null &&
           vm.statewide_m1.m1_posted_zone_mean !== undefined,
      'records the zone-mean primary M1 too');
    assert(vm.thresholds.posted_speed_drop_mph === 10, 'stamps the drop that produced it');
  });

  await test('writes metadata.columns and the run summary, including the statewide M1', async () => {
    const r = await run(descriptor);
    const { rows } = await db.query(`SELECT metadata FROM sources WHERE source_id = $1`, [outSrc.source_id]);
    const m = parseJson(rows[0].metadata);
    assert(m.columns.length === sql.WZ_SPEED_TABLE_COLUMNS.length,
      `all ${sql.WZ_SPEED_TABLE_COLUMNS.length} columns (got ${m.columns.length})`);
    assert(m.schema === 'wz_speed_v1', 'records a schema tag');

    const { rows: v } = await db.query(`SELECT metadata FROM views WHERE view_id = $1`, [r.view_id]);
    const vm = parseJson(v[0].metadata);
    assert(vm.vehicle_class === 'all_vehicles', 'records the vehicle class decision');
    assert(vm.density_c_included === true, 'records the density-C decision');
    assert(vm.baseline_months === 12, 'records the baseline length');
    assert(vm.baseline_start === '2023-01-01' && vm.baseline_end === '2023-12-31', 'records the baseline window');
    assert(vm.pm3_view_id === pm32024.view_id, 'records which PM3 vintage supplied the reference speed');
    assert(vm.wz_event_view_id === spine2024.view_id, 'records which spine view it read');
    assert(vm.statewide_m1 && vm.statewide_m1.zones === 2, 'records the statewide rollup');
    // Z1 has 22 of 24 epochs below absolute; Z2 has 0 of 12 → 22/36
    assert(Math.abs(vm.statewide_m1.m1_absolute_epoch_weighted - 22 / 36) < 1e-4,
      `epoch-weighted M1 (got ${vm.statewide_m1.m1_absolute_epoch_weighted})`);
  });

  await test('a different threshold set is recorded on the rows and the view', async () => {
    const r = await run({ ...descriptor, thresholds: { speed_threshold_mph: 45 } });
    const { rows: v } = await db.query(`SELECT metadata FROM views WHERE view_id = $1`, [r.view_id]);
    assert(parseJson(v[0].metadata).thresholds.speed_threshold_mph === 45, 'view records the threshold used');
    const ins = pg.statements.find((s) => /INSERT INTO work_zone\./.test(s.text));
    assert(/45/.test(ins.text), 'every row carries the threshold it was measured with');
  });

  console.log(`\n  ${passed} passing, ${failed} failing\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => { console.error('Test runner error:', err); process.exit(1); });
