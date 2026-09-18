/**
 * Integration test (phase 5): the work_zone/queue worker.
 *
 * Fakes BOTH the physical Postgres side and ClickHouse, so nothing touches
 * either. Asserts what a unit test cannot: that the corridor x day staging is
 * built from the active windows and the walked corridor (ties dropped, ranks
 * contiguous), that the walk runs once per calendar month with the speed
 * table on the left, that BOTH staging tables are dropped even when the walk
 * throws, that two tables and two views are provisioned and stamped, that an
 * unobserved zone is published as UNKNOWN rather than as no queue, and that
 * the wz_queue_hour source is created once and then reused.
 *
 * Run: node data-types/work_zone/tests/queue.integration.js
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
  { wz_event_id: 'Z1', member_event_ids: 'Z1', first_start: '2024-07-13 07:28:06',
    last_end: '2024-07-15 16:08:56', region_name: 'Region 11 - New York City', county_name: 'QUEENS',
    facility: 'I-495', work_activity_class: 'construction', is_interstate: true, in_tma: true,
    is_significant_candidate: false },
  // no active window, no observations: must be published as UNKNOWN
  { wz_event_id: 'Z2', member_event_ids: 'Z2', first_start: '2024-08-01 09:00:00',
    last_end: '2024-08-01 15:00:00', region_name: 'Region 1 - Capital District', county_name: 'ALBANY',
    facility: 'I-87', work_activity_class: 'maintenance', is_interstate: true, in_tma: true,
    is_significant_candidate: true },
];

const ACTIVE = [
  { wz_event_id: 'Z1', tmc: '120P04940', date: '2024-07-13', epoch_from: 41, epoch_to: 288, window_source: '2799' },
  { wz_event_id: 'Z1', tmc: '120P04940', date: '2024-07-14', epoch_from: 0, epoch_to: 146, window_source: '2799' },
];

// The real I-495 westbound corridor around the validation anchor (order 104),
// plus a short parallel ramp sharing order 103 that the walk must drop.
const CORRIDOR = [
  { anchor_tmc: '120P04940', tmc: '120P04940', road_order: 104, miles: 0.495147, avg_speedlimit: 50,
    start_latitude: 40.74568, start_longitude: -73.76843, end_latitude: 40.74320, end_longitude: -73.77717 },
  { anchor_tmc: '120P04940', tmc: '120+04940', road_order: 103, miles: 0.036485, avg_speedlimit: 50,
    start_latitude: 40.74585, start_longitude: -73.76777, end_latitude: 40.74568, end_longitude: -73.76843 },
  { anchor_tmc: '120P04940', tmc: '120R99999', road_order: 103, miles: 0.010, avg_speedlimit: 30,
    start_latitude: 40.74585, start_longitude: -73.76777, end_latitude: 40.74568, end_longitude: -73.76843 },
  { anchor_tmc: '120P04940', tmc: '120P04939', road_order: 102, miles: 0.185035, avg_speedlimit: 50,
    start_latitude: 40.74675, start_longitude: -73.76444, end_latitude: 40.74585, end_longitude: -73.76777 },
  { anchor_tmc: '120P04940', tmc: '120+04939', road_order: 101, miles: 0.290003, avg_speedlimit: 50,
    start_latitude: 40.74847, start_longitude: -73.75941, end_latitude: 40.74675, end_longitude: -73.76444 },
];

/** What the per-hour aggregate returns. One GHOST row for a zone outside the window. */
const HOURS = [
  { wz_event_id: 'Z1', date: '2024-07-14', hour: 11, window_source: '2799', epochs_observed: 12, epochs_anchor_below: 12,
    epochs_queued: 12, max_queue_len_mi: 0.5115, mean_queue_len_mi: 0.4, queue_mile_epochs: 4.8, epochs_lower_bound: 2,
    epochs_queued_phed: 10, max_queue_len_phed_mi: 0.2215, anchor_speed_mean: 21.4, anchor_speed_min: 12.0 },
  { wz_event_id: 'Z1', date: '2024-07-14', hour: 14, window_source: '2799', epochs_observed: 12, epochs_anchor_below: 12,
    epochs_queued: 12, max_queue_len_mi: 1.2, mean_queue_len_mi: 0.9, queue_mile_epochs: 10.8, epochs_lower_bound: 0,
    epochs_queued_phed: 12, max_queue_len_phed_mi: 0.8, anchor_speed_mean: 16.0, anchor_speed_min: 9.1 },
  { wz_event_id: 'Z1', date: '2024-07-13', hour: 3, window_source: '2799', epochs_observed: 12, epochs_anchor_below: 0,
    epochs_queued: 0, max_queue_len_mi: 0, mean_queue_len_mi: 0, queue_mile_epochs: 0, epochs_lower_bound: 0,
    epochs_queued_phed: 0, max_queue_len_phed_mi: 0, anchor_speed_mean: 61.0, anchor_speed_min: 55.2 },
  { wz_event_id: 'GHOST', date: '2024-07-14', hour: 1, window_source: '2799', epochs_observed: 12, epochs_anchor_below: 12,
    epochs_queued: 12, max_queue_len_mi: 3, mean_queue_len_mi: 3, queue_mile_epochs: 36, epochs_lower_bound: 0,
    epochs_queued_phed: 12, max_queue_len_phed_mi: 3, anchor_speed_mean: 5, anchor_speed_min: 5 },
];

/** What the per-zone aggregate returns. */
const ZONE_AGG = [
  { wz_event_id: 'Z1', epochs_observed: 300, epochs_2799: 300, n_ranks: 4, max_ranks_observed: 4,
    epochs_anchor_below: 130, epochs_queued: 120, max_queue_len_mi: 1.2, p95_queue_len_mi: 0.9, mean_queue_len_mi: 0.6,
    queue_mile_epochs: 72, hours_with_queue: 11, epochs_lower_bound: 5, epochs_corridor_end: 2,
    max_queue_tmcs: '120+04940 120P04939 120+04939', max_queue_date: '2024-07-14', max_queue_epoch: 170,
    epochs_queued_phed: 100, max_queue_len_phed_mi: 0.8, p95_queue_len_phed_mi: 0.7,
    anchor_speed_mean: 33.2, anchor_speed_min: 9.1 },
  { wz_event_id: 'GHOST', epochs_observed: 12, epochs_2799: 12, n_ranks: 1, max_ranks_observed: 1, epochs_anchor_below: 12,
    epochs_queued: 12, max_queue_len_mi: 3, p95_queue_len_mi: 3, mean_queue_len_mi: 3, queue_mile_epochs: 36, hours_with_queue: 1,
    epochs_lower_bound: 0, epochs_corridor_end: 0, max_queue_tmcs: '', max_queue_date: '2024-07-14', max_queue_epoch: 12,
    epochs_queued_phed: 12, max_queue_len_phed_mi: 3, p95_queue_len_phed_mi: 3, anchor_speed_mean: 5, anchor_speed_min: 5 },
];
const RUNS = [{ wz_event_id: 'Z1', longest_run_epochs: 36, longest_run_phed_epochs: 24 }];

function fakePgDb() {
  const statements = [];
  return {
    type: 'postgres', statements,
    async query(text, params) {
      statements.push({ text: String(text), params });
      const t = String(text).trim();
      if (/^(SELECT|WITH)/i.test(t)) {
        if (/zone_members/.test(t)) return { rows: ACTIVE };
        if (/anchors AS \(SELECT DISTINCT tmc/.test(t) && /road_order/.test(t)) return { rows: CORRIDOR };
        if (/SELECT wz_event_id, member_event_ids/.test(t)) return { rows: ZONES };
      }
      return { rows: [] };
    },
  };
}

/** Records every statement and insert; can be told to fail the walk. */
function fakeChDb({ failWalk = false } = {}) {
  const statements = [];
  const inserts = [];
  const insertValues = [];
  return {
    statements, inserts, insertValues,
    client: { async insert({ table, values }) {
      inserts.push({ table, rows: values.length });
      insertValues.push({ table, values });
    } },
    async exec({ query }) {
      const t = String(query).trim();
      statements.push(t);
      if (failWalk && /^INSERT INTO .*_wz_qepoch_/s.test(t)) throw new Error('simulated ClickHouse failure');
      return {};
    },
    async query({ query }) {
      const t = String(query).trim();
      statements.push(t);
      if (/GROUP BY wz_event_id, date, hour/.test(t)) return { json: async () => HOURS };
      if (/quantileExactIf/.test(t)) return { json: async () => ZONE_AGG };
      if (/arraySplit/.test(t)) return { json: async () => RUNS };
      return { json: async () => [] };
    },
  };
}

async function runTests() {
  console.log(`\n=== work_zone/queue worker (${DAMA_TEST_DB}) ===\n`);
  await setup();

  const { getDb } = require('@availabs/dms-server/src/db');
  const metadata = require('@availabs/dms-server/src/dama/upload/metadata');
  const db = getDb(DAMA_TEST_DB);
  const { makeQueue } = require('../workers/queue.js');
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
  const outSrc = await mkSource(`wz_queue_${Date.now()}`, 'wz_queue');

  const winMeta = (y) => ({ start_date: `${y}-01-01`, end_date: `${y}-12-31`, npmrds_meta_source_id: metaSrc.source_id });
  const spine2024 = await mkView(spineSrc.source_id, 'work_zone', 'wz_event_2024', winMeta(2024));
  await mkView(tmcSrc.source_id, 'work_zone', 'wz_event_tmc_2024', winMeta(2024));
  await mkView(speedSrc.source_id, 'npmrds_geometry', 'pg_only', { is_clickhouse_table: 0 });
  await mkView(speedSrc.source_id, 'clickhouse.npmrds', 's583_v982_NPMRDS_V6', { is_clickhouse_table: 1 });

  const descriptor = {
    source_id: outSrc.source_id,
    wz_event_source_id: spineSrc.source_id,
    npmrds_source_id: speedSrc.source_id,
    npmrds_meta_source_id: metaSrc.source_id,
    event_tmc_table: 'transcom.event_tmc',
    start_date: '2024-07-01', end_date: '2024-08-31', user_id: 1,
  };
  let events = [];
  let pg = fakePgDb(); let ch = fakeChDb();
  const ctx = (d) => ({
    task: { task_id: 1, descriptor: d }, pgEnv: DAMA_TEST_DB, db,
    dispatchEvent: async (type, msg, payload) => { events.push({ type, msg, payload }); },
    updateProgress: async () => {},
  });
  const run = (d, opts = {}) => {
    events = []; pg = fakePgDb(); ch = fakeChDb(opts);
    const queue = makeQueue({
      getPgDb: () => pg, getChDb: () => ch,
      createDamaView: metadata.createDamaView, createDamaSource: metadata.createDamaSource,
    });
    return queue(ctx(d));
  };

  let result;
  await test('runs end to end: two zones, one measured, the GHOST hours dropped', async () => {
    result = await run(descriptor);
    assert(result.zones === 2, `2 zones (got ${result.zones})`);
    assert(result.zones_measured === 1, `1 measured (got ${result.zones_measured})`);
    assert(result.zone_hours === 3, `3 zone-hours written — GHOST dropped (got ${result.zone_hours})`);
    assert(result.hour_view_id && result.hour_source_id, 'reports the wz_queue_hour outputs');
  });

  await test('refuses a descriptor missing a required input', async () => {
    let msg = null;
    try { await run({ ...descriptor, event_tmc_table: undefined }); } catch (e) { msg = e.message; }
    assert(/missing event_tmc_table/.test(msg || ''), `names the missing input (got ${msg})`);
  });

  await test('resolves the spine, the meta view and the ClickHouse speed view', async () => {
    await run(descriptor);
    const r = events.find((e) => e.type === 'work_zone/queue:RESOLVED');
    assert(/wz_event_2024/.test(r.payload.wz_event), `2024 spine (got ${r.payload.wz_event})`);
    assert(r.payload.npmrds_speeds_ch === 'npmrds.s583_v982_NPMRDS_V6', `CH view, prefix stripped (got ${r.payload.npmrds_speeds_ch})`);
    assert(/npmrds_meta/.test(r.payload.npmrds_meta), 'names the meta view');
  });

  await test('takes the active windows from the shared expansion, anchors only', async () => {
    await run(descriptor);
    const q = pg.statements.find((s) => /zone_members/.test(s.text));
    assert(q, 'queries the active windows');
    assert(/tmc_role = 'anchor'/.test(q.text), 'restricts to anchor TMCs');
    assert(/transcom\.event_tmc/.test(q.text), 'reads the event_tmc table it was given');
    assert(/ELSE 288 END AS epoch_to/.test(q.text), 'half-open day grid — the same SQL the speed stage uses');
  });

  await test('reads corridors from the meta view: same region, linear and direction, lower order', async () => {
    await run(descriptor);
    const q = pg.statements.find((s) => /anchors AS \(SELECT DISTINCT tmc/.test(s.text) && /road_order/.test(s.text));
    assert(q, 'queries the corridors');
    assert(/u\.reg = a\.reg AND u\.tmclinear = a\.tmclinear AND u\.direction = a\.direction/.test(q.text), 'keys on region, linear AND direction');
    assert(/u\.road_order <= a\.road_order/.test(q.text), 'only at or below the anchor order — upstream');
    assert(/DISTINCT ON \(tmc\)/.test(q.text) && /year <= \$1/.test(q.text), 'one meta row per TMC, newest vintage at or before the window');
  });

  await test('stages corridor x active-day rows with contiguous ranks and the ramp dropped', async () => {
    await run(descriptor);
    const ins = ch.insertValues.find((v) => /_wz_qcorr_/.test(v.table));
    assert(ins, 'stages the corridor table');
    assert(ins.values.length === 8, `2 active days x 4 corridor TMCs (got ${ins.values.length})`);
    const day1 = ins.values.filter((r) => r.date === '2024-07-13').sort((a, b) => a.rank - b.rank);
    assert(day1.map((r) => r.tmc).join(' ') === '120P04940 120+04940 120P04939 120+04939',
      `anchor first, then upstream by descending order (got ${day1.map((r) => r.tmc).join(' ')})`);
    assert(day1.map((r) => r.rank).join(',') === '0,1,2,3', 'ranks are contiguous from 0');
    assert(!ins.values.some((r) => r.tmc === '120R99999'), 'the parallel ramp sharing order 103 is not walked');
    assert(day1.every((r) => r.n_ranks === 4), 'every row carries the corridor length');
    assert(Math.abs(day1[0].phed_threshold_speed - 30) < 1e-6, `PHED threshold from the 50 mph limit (got ${day1[0].phed_threshold_speed})`);
    assert(day1[0].epoch_from === 41 && day1[0].epoch_to === 288, 'carries the day window');
    const staged = events.find((e) => e.type === 'work_zone/queue:STAGED');
    assert(staged.payload.corridor_end_reasons.end_of_linear === 1, 'reports why the corridor ended');
  });

  await test('walks one calendar month at a time, speed table on the LEFT', async () => {
    await run(descriptor);
    const walks = ch.statements.filter((s) => /^INSERT INTO .*_wz_qepoch_/s.test(s));
    assert(walks.length === 2, `July and August (got ${walks.length})`);
    assert(/toDate\('2024-07-01'\) AND n\.date <= toDate\('2024-07-31'\)/.test(walks[0]), 'July bounded to July');
    assert(/toDate\('2024-08-01'\) AND n\.date <= toDate\('2024-08-31'\)/.test(walks[1]), 'August bounded to August');
    assert(/FROM npmrds\.s583_v982_NPMRDS_V6 n\s*\n\s*INNER JOIN npmrds\._wz_qcorr_/.test(walks[0]), 'speed table left, corridor right');
    assert(/NOT \(s < 35\)/.test(walks[0]), 'default queue speed threshold');
    assert(/ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING/.test(walks[0]), 'the two-epoch rule frame');
  });

  await test('sweeps orphans first and DROPS both staging tables — including when the walk fails', async () => {
    await run(descriptor);
    const sweep = ch.statements.findIndex((s) => /FROM system\.tables/.test(s));
    const create = ch.statements.findIndex((s) => /^CREATE TABLE IF NOT EXISTS/.test(s));
    assert(sweep >= 0 && sweep < create, 'sweeps before creating');
    const drops = ch.statements.filter((s) => /^DROP TABLE IF EXISTS/.test(s));
    assert(drops.length === 2, `drops both on success (got ${drops.length})`);
    assert(drops.some((s) => /_wz_qcorr_/.test(s)) && drops.some((s) => /_wz_qepoch_/.test(s)), 'both tables');

    let threw = false;
    try { await run(descriptor, { failWalk: true }); } catch (e) { threw = true; }
    assert(threw, 'the failure propagates');
    const dropsAfterFail = ch.statements.filter((s) => /^DROP TABLE IF EXISTS/.test(s));
    assert(dropsAfterFail.length === 2, `and still drops both (got ${dropsAfterFail.length})`);
  });

  await test('creates wz_queue and wz_queue_hour, and replaces both windows before inserting', async () => {
    await run(descriptor);
    const ddls = pg.statements.filter((s) => /CREATE TABLE IF NOT EXISTS work_zone\./.test(s.text));
    assert(ddls.length === 2, `two DDLs (got ${ddls.length})`);
    assert(ddls.some((s) => /max_queue_len_mi/.test(s.text) && /max_queue_tmcs/.test(s.text)), 'wz_queue DDL');
    assert(ddls.some((s) => /UNIQUE \(wz_event_id, date, hour\)/.test(s.text)), 'wz_queue_hour DDL');
    const dels = pg.statements.map((s, i) => [s, i]).filter(([s]) => /^DELETE FROM work_zone\./.test(s.text.trim()));
    const firstIns = pg.statements.findIndex((s) => /INSERT INTO work_zone\./.test(s.text));
    assert(dels.length === 2 && dels.every(([, i]) => i < firstIns), 'both deletes precede the inserts');
    assert(dels.every(([s]) => /first_start < \('2024-08-31'::date \+ INTERVAL '1 day'\)/.test(s.text)), 'half-open windows');
  });

  await test('publishes the unobserved zone as UNKNOWN, not as no queue', async () => {
    await run(descriptor);
    const ins = pg.statements.find((s) => /INSERT INTO work_zone\..*wz_queue \(/s.test(s.text) && /Z2/.test(s.text));
    assert(ins, 'writes a row for Z2');
    const z2 = ins.text.split('\n').find((l) => /'Z2'/.test(l));
    assert(/FALSE/.test(z2), 'queue_measured = FALSE');
    // the M3 columns are NULL, never 0
    const cols = sql.WZ_QUEUE_COLUMNS;
    const vals = z2.slice(z2.indexOf('(') + 1).split(', ');
    const at = (c) => vals[cols.indexOf(c)];
    assert(at('queue_measured') === 'FALSE', `queue_measured FALSE (got ${at('queue_measured')})`);
    assert(at('epochs_observed') === '0', 'epochs_observed 0');
    for (const c of ['epochs_queued', 'pct_time_queued', 'max_queue_len_mi', 'exceeds_queue_threshold', 'longest_queue_run_min']) {
      assert(at(c) === 'NULL', `${c} is NULL (got ${at(c)})`);
    }
  });

  await test('writes the measured zone with M3 derived from the aggregates', async () => {
    await run(descriptor);
    const ins = pg.statements.find((s) => /INSERT INTO work_zone\..*wz_queue \(/s.test(s.text) && /'Z1'/.test(s.text));
    // the first VALUES row shares its line with the FROM clause
    const line = ins.text.split('\n').find((l) => /\('Z1',/.test(l));
    const z1 = line.slice(line.indexOf("('Z1'") + 1);
    const cols = sql.WZ_QUEUE_COLUMNS;
    const vals = z1.split(', ');
    const at = (c) => vals[cols.indexOf(c)];
    assert(at('queue_measured') === 'TRUE', 'measured');
    assert(at('pct_time_queued') === '0.4', `120 of 300 epochs (got ${at('pct_time_queued')})`);
    assert(at('queue_hours') === '10', `120 epochs = 10 hours (got ${at('queue_hours')})`);
    assert(at('max_queue_len_mi') === '1.2', 'max queue');
    assert(at('exceeds_queue_threshold') === 'TRUE', '1.2 mi > 0.75 mi');
    assert(at('longest_queue_run_min') === '180', `36 epochs = 180 min (got ${at('longest_queue_run_min')})`);
    assert(at('queue_mile_hours') === '6', `72 queue-mile-epochs = 6 (got ${at('queue_mile_hours')})`);
    assert(at('max_queue_time') === "'14:10'", `epoch 170 = 14:10 (got ${at('max_queue_time')})`);
    assert(at('max_queue_tmcs') === "'120+04940 120P04939 120+04939'", 'carries the max-queue extent');
    assert(at('anchor_miles') === '0.4951', 'anchor length on the row, not in the queue length');
    assert(at('n_upstream_tmcs') === '3' && at('corridor_end_reason') === "'end_of_linear'", 'corridor facts on the row');
    assert(at('exceeds_queue_threshold_phed') === 'TRUE', '0.8 mi > 0.75 on the comparator');
    assert(/ST_Union\(g\.wkb_geometry\)/.test(ins.text) && /ST_SetSRID/.test(ins.text), 'geometry is the union of anchor + max-queue TMCs, SRID set');
  });

  await test('creates the wz_queue_hour source once and reuses it', async () => {
    const before = (await db.query(`SELECT count(*) AS n FROM sources WHERE type = 'wz_queue_hour'`)).rows[0].n;
    const a = await run(descriptor);
    const b = await run(descriptor);
    const after = (await db.query(`SELECT count(*) AS n FROM sources WHERE type = 'wz_queue_hour'`)).rows[0].n;
    assert(Number(after) === Math.max(1, Number(before)), `one wz_queue_hour source (got ${after})`);
    assert(a.hour_source_id === b.hour_source_id, 'the second run reuses it');
    assert(a.hour_view_id !== b.hour_view_id, 'but gets its own view (no target given)');
  });

  await test('stamps both views with the vintage, the walk limits and the M3 rollups', async () => {
    const r = await run(descriptor);
    const { rows: v } = await db.query(`SELECT version, metadata FROM views WHERE view_id = $1`, [r.view_id]);
    const vm = parseJson(v[0].metadata);
    assert(v[0].version === 'CY2024 (partial to 2024-08-31)', `vintage label (got ${v[0].version})`);
    assert(vm.queue_length_basis === 'upstream_only', 'records the length basis');
    assert(vm.queue_max_reach_mi === 10 && vm.queue_max_upstream_tmcs === 20 && vm.queue_max_gap_mi === 0.5, 'records the walk limits');
    assert(vm.min_consecutive_epochs === 2, 'records the consecutive-epoch rule');
    assert(vm.thresholds.queue_speed_mph === 35 && vm.thresholds.queue_threshold_mi === 0.75, 'records the thresholds');
    assert(vm.wz_event_view_id === spine2024.view_id, 'records the spine view it read');
    assert(vm.m3 && vm.m3.zones === 1 && vm.m3.zones_unmeasured === 1, `M3 counts measured and unmeasured zones (got ${JSON.stringify(vm.m3 && [vm.m3.zones, vm.m3.zones_unmeasured])})`);
    assert(vm.m3.pct_zones_exceeding === 1, 'the one measured zone exceeds');
    assert(Math.abs(vm.m3.pct_time_queued - 0.4) < 1e-6, 'hour-weighted share of time queued');
    assert(vm.m3_by_tier && vm.m3_by_tier.interstate.zones === 1 && vm.m3_by_tier.significant.zones === 0,
      'per-tier rollups (the significant zone is unmeasured)');
    assert(vm.corridor_end_reasons && vm.corridor_end_reasons.end_of_linear === 1, 'records corridor end reasons');
    const { rows: hv } = await db.query(`SELECT version, metadata FROM views WHERE view_id = $1`, [r.hour_view_id]);
    assert(hv[0].version === v[0].version, 'the hour view carries the same vintage');
    assert(parseJson(hv[0].metadata).wz_queue_view_id === r.view_id, 'and points back at the zone view');
  });

  await test('writes metadata.columns on BOTH sources', async () => {
    const r = await run(descriptor);
    const { rows } = await db.query(`SELECT metadata FROM sources WHERE source_id = $1`, [outSrc.source_id]);
    const m = parseJson(rows[0].metadata);
    assert(m.columns.length === sql.WZ_QUEUE_TABLE_COLUMNS.length, `wz_queue: all ${sql.WZ_QUEUE_TABLE_COLUMNS.length} columns`);
    assert(m.schema === 'wz_queue_v1' && m.wz_queue_hour_source_id === r.hour_source_id, 'schema tag + cross-link');
    const { rows: h } = await db.query(`SELECT metadata FROM sources WHERE source_id = $1`, [r.hour_source_id]);
    const hm = parseJson(h[0].metadata);
    assert(hm.columns.length === sql.WZ_QUEUE_HOUR_TABLE_COLUMNS.length, `wz_queue_hour: all ${sql.WZ_QUEUE_HOUR_TABLE_COLUMNS.length} columns`);
    assert(hm.schema === 'wz_queue_hour_v1' && hm.wz_queue_source_id === outSrc.source_id, 'schema tag + back-link');
  });

  await test('writes the hour rows with the zone denormalised onto them', async () => {
    await run(descriptor);
    const ins = pg.statements.find((s) => /INSERT INTO work_zone\..*wz_queue_hour \(/s.test(s.text));
    assert(ins, 'writes wz_queue_hour');
    assert(!/GHOST/.test(ins.text), 'the out-of-window zone is not written');
    assert(/'2024-07-14', 14,/.test(ins.text), 'keeps the DATE and the clock hour');
    assert(/'Region 11 - New York City'/.test(ins.text), 'carries the Region for filtering');
    assert(/ON CONFLICT \(wz_event_id, date, hour\)/.test(ins.text), 'idempotent on (zone, date, hour)');
  });

  await test('a different threshold set drives the walk and is recorded', async () => {
    const r = await run({ ...descriptor, thresholds: { queue_speed_mph: 45, queue_threshold_mi: 1.5 }, queue_max_reach_mi: 3 });
    const walk = ch.statements.find((s) => /^INSERT INTO .*_wz_qepoch_/s.test(s));
    assert(/NOT \(s < 45\)/.test(walk), 'the walk uses 45 mph');
    const { rows: v } = await db.query(`SELECT metadata FROM views WHERE view_id = $1`, [r.view_id]);
    const vm = parseJson(v[0].metadata);
    assert(vm.thresholds.queue_speed_mph === 45 && vm.thresholds.queue_threshold_mi === 1.5, 'view records the thresholds');
    assert(vm.queue_max_reach_mi === 3, 'view records the reach override');
    assert(vm.m3.zones_exceeding === 0, '1.2 mi does not exceed 1.5 mi');
    const ins = pg.statements.find((s) => /INSERT INTO work_zone\..*wz_queue \(/s.test(s.text) && /'Z1'/.test(s.text));
    assert(/, 45, 1.5, 2\)/.test(ins.text), 'every row carries the parameters it was measured with');
  });

  console.log(`\n  ${passed} passing, ${failed} failing\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => { console.error('Test runner error:', err); process.exit(1); });
