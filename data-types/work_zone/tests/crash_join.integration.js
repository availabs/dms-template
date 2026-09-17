/**
 * Integration test (phase 7): the work_zone/crashes_clear and
 * work_zone/crash_join workers.
 *
 * Fakes the physical Postgres side (the raw CLEAR table, the crash table, the
 * PostGIS match) against the real DAMA sqlite harness for sources and views.
 * Asserts what a unit test cannot: that typing streams the raw table by key
 * and replaces its window on crash_date; that the join stages its two TEMP
 * tables and drops them even when the match throws; that the match SQL is
 * built with the buffer given; that in-window matches are counted and
 * same-day-off-hours matches are kept but not counted; that a zone without
 * exposure gets a NULL rate, not 0; that the wz_crash_match source is created
 * once; and that both views and both sources are stamped.
 *
 * Run: node data-types/work_zone/tests/crash_join.integration.js
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

// ── raw CLEAR rows, as the loader leaves them (every column text) ──
const RAW = [
  { ogc_fid: 1, CaseNumber: '40185959', MaxInjurySeverity: 'C - POSSIBLE INJURY', CrashSeverity: 'INJURY', CaseYear: '2024',
    CrashDate: '2024-07-14T00:00:00', CrashTimeFormatted: '1:10 PM', TrafficControl: 'HIGHWAY WORK AREA', NumberOfFatalities: '0',
    NumberOfInjuries: '1', CountyName: 'Queens', OnStreet: 'INTERSTATE 495', FUNCTIONAL_CLASS: '7', lon: '-73.775', lat: '40.7435',
    DMVInsertDate: '2024-09-01T00:00:00' },
  { ogc_fid: 2, CaseNumber: '40185960', MaxInjurySeverity: '', CrashSeverity: 'PROPERTY DAMAGE', CaseYear: '2024',
    CrashDate: '2024-07-14T00:00:00', CrashTimeFormatted: '12:00 AM', TrafficControl: 'NONE', NumberOfFatalities: '0',
    NumberOfInjuries: '0', CountyName: 'Queens', OnStreet: 'INTERSTATE 495', FUNCTIONAL_CLASS: '7', lon: '-73.76', lat: '40.746',
    DMVInsertDate: '2024-10-01T00:00:00' },
  { ogc_fid: 3, CaseNumber: '40185961', MaxInjurySeverity: 'K - FATAL', CrashSeverity: 'FATAL', CaseYear: '2024',
    CrashDate: '2025-01-03T00:00:00', CrashTimeFormatted: '6:00 AM', TrafficControl: 'OFFICER/FLAGMAN/GUARD', NumberOfFatalities: '1',
    NumberOfInjuries: '0', CountyName: 'Albany', OnStreet: 'INTERSTATE 87', FUNCTIONAL_CLASS: '1', lon: '-73.8', lat: '42.7',
    DMVInsertDate: '2025-03-01T00:00:00' },   // outside a CY2024 window: skipped
  { ogc_fid: 4, CaseNumber: '', CrashSeverity: 'PROPERTY DAMAGE', CrashDate: '2024-05-01T00:00:00', CrashTimeFormatted: '9:00 AM',
    TrafficControl: 'NONE', lon: '', lat: '' },   // no case number: skipped
];

const ZONES = [
  { wz_event_id: 'Z1', member_event_ids: 'Z1', first_start: '2024-07-13 07:28:06', last_end: '2024-07-15 16:08:56',
    region_name: 'Region 11 - New York City', county_name: 'QUEENS', facility: 'I-495', work_activity_class: 'construction',
    is_interstate: true, in_tma: true, is_significant_candidate: false, anchor_tmc: '120P04940' },
  { wz_event_id: 'Z2', member_event_ids: 'Z2', first_start: '2024-08-01 09:00:00', last_end: '2024-08-01 15:00:00',
    region_name: 'Region 1 - Capital District', county_name: 'ALBANY', facility: 'I-87', work_activity_class: 'maintenance',
    is_interstate: true, in_tma: true, is_significant_candidate: true, anchor_tmc: '120-05865' },
];
/** What crashMatchSQL returns: crash × zone. */
const MATCHES = [
  { wz_event_id: 'Z1', crash_id: '40185959', crash_date: '2024-07-14', epoch: 158, time_known: true, time_uncertain: false,
    severity_class: 'injury', severity_kabco: 'C', wz_coded: true, wz_code: 'highway', flagger_coded: false, on_street: 'INTERSTATE 495',
    n_fatalities: 0, n_injuries: 1, role: 'work_extent', distance_m: 12.4, dist_anchor_m: 12.4, dist_queue_m: 12.4,
    in_window: true, epoch_gap: 0, window_source: '2799', active_that_day: true },
  { wz_event_id: 'Z1', crash_id: '40185960', crash_date: '2024-07-14', epoch: 0, time_known: true, time_uncertain: true,
    severity_class: 'pdo', severity_kabco: 'O', wz_coded: false, wz_code: null, flagger_coded: false, on_street: 'INTERSTATE 495',
    n_fatalities: 0, n_injuries: 0, role: 'queue', distance_m: 31.0, dist_anchor_m: 900.2, dist_queue_m: 31.0,
    in_window: true, epoch_gap: 0, window_source: '2799', active_that_day: true },
  { wz_event_id: 'Z1', crash_id: '40185970', crash_date: '2024-07-13', epoch: 30, time_known: true, time_uncertain: false,
    severity_class: 'pdo', severity_kabco: 'O', wz_coded: false, wz_code: null, flagger_coded: true, on_street: 'INTERSTATE 495',
    n_fatalities: 0, n_injuries: 0, role: 'work_extent', distance_m: 5.0, dist_anchor_m: 5.0, dist_queue_m: null,
    in_window: false, epoch_gap: 11, window_source: '2799', active_that_day: true },   // same day, before the shift
  { wz_event_id: 'GHOST', crash_id: '1', crash_date: '2024-07-14', epoch: 10, time_known: true, time_uncertain: false,
    severity_class: 'fatal', severity_kabco: 'K', wz_coded: true, wz_code: 'highway', flagger_coded: false, on_street: 'X',
    n_fatalities: 1, n_injuries: 0, role: 'work_extent', distance_m: 1, dist_anchor_m: 1, dist_queue_m: null,
    in_window: true, epoch_gap: 0, window_source: '2799', active_that_day: true },
];

function fakePgDb({ failMatch = false } = {}) {
  const statements = [];
  let rawPages = 0;
  return {
    type: 'postgres', statements,
    async query(text, params) {
      statements.push({ text: String(text), params });
      const t = String(text).trim();
      if (failMatch && /^WITH near AS/.test(t)) throw new Error('simulated PostGIS failure');
      if (/^(SELECT|WITH)/i.test(t)) {
        if (/ORDER BY ogc_fid LIMIT/.test(t)) { rawPages += 1; return { rows: rawPages === 1 ? RAW : [] }; }
        if (/min\("CrashDate"::timestamp\)/.test(t)) return { rows: [{ min_date: '2024-01-01', max_date: '2025-01-03' }] };
        if (/SELECT wz_event_id, member_event_ids/.test(t)) return { rows: ZONES };
        if (/sum\(epoch_to - epoch_from\)/.test(t)) return { rows: [{ wz_event_id: 'Z1', active_hours: '55.7', active_days: 3 }] };
        if (/queue_geog IS NOT NULL/.test(t)) return { rows: [{ n: '1' }] };
        if (/^WITH near AS/.test(t)) return { rows: MATCHES };
        if (/count\(\*\) FILTER \(WHERE wz_coded\)/.test(t)) {
          return { rows: [{ crashes: '1000', wz_coded: '10', wz_fatal: '1', wz_injury: '3', wz_pdo: '6', flagger_coded: '4' }] };
        }
        if (/veh_through_wz, vmt_through_wz, exposure_complete FROM/.test(t)) {
          return { rows: [{ wz_event_id: 'Z1', veh_through_wz: '120000', vmt_through_wz: '60000.5', exposure_complete: true }] };
        }
      }
      return { rows: [] };
    },
  };
}

async function runTests() {
  console.log(`\n=== work_zone/crashes_clear + crash_join workers (${DAMA_TEST_DB}) ===\n`);
  await setup();
  const { getDb } = require('@availabs/dms-server/src/db');
  const metadata = require('@availabs/dms-server/src/dama/upload/metadata');
  const db = getDb(DAMA_TEST_DB);
  const { makeCrashesClear } = require('../workers/crashes_clear.js');
  const { makeCrashJoin } = require('../workers/crash_join.js');
  const sql = require('../sql.js');

  const mkSource = (name, type, meta = {}) => metadata.createDamaSource({ name, type, user_id: 1, metadata: meta }, DAMA_TEST_DB);
  const mkView = async (source_id, schema, table, meta = {}, version = null) => {
    const v = await metadata.createDamaView({ source_id, user_id: 1 }, DAMA_TEST_DB);
    await db.query(`UPDATE views SET table_schema=$1, table_name=$2, data_table=$3, metadata=$4, version=$5 WHERE view_id=$6`,
      [schema, table, `${schema}.${table}`, JSON.stringify(meta), version, v.view_id]);
    return v;
  };
  const rawSrc = await mkSource(`clear_raw_${Date.now()}`, 'clear_crash_raw');
  const rawView = await mkView(rawSrc.source_id, 'work_zone', 'clear_raw_2024', { csv_path: '/x/crash_2024.csv', rows: 4, dmv_insert_max: '2025-02-05' }, 'CY2024');
  const crashSrc = await mkSource(`nys_crashes_clear_${Date.now()}`, 'nys_crashes_clear');

  let events = []; let pg = fakePgDb();
  const ctx = (d) => ({
    task: { task_id: 1, descriptor: d }, pgEnv: DAMA_TEST_DB, db,
    dispatchEvent: async (type, msg, payload) => { events.push({ type, msg, payload }); },
    updateProgress: async () => {},
  });

  // ── crashes_clear ──
  const runClear = (d, opts = {}) => {
    events = []; pg = fakePgDb(opts);
    return makeCrashesClear({ getPgDb: () => pg, createDamaView: metadata.createDamaView })(ctx(d));
  };
  const clearDesc = { source_id: crashSrc.source_id, file_upload_view_id: rawView.view_id, start_date: '2024-01-01', end_date: '2024-12-31', user_id: 1 };

  let clearResult;
  await test('crashes_clear types the raw rows in the window, skipping the rest', async () => {
    clearResult = await runClear(clearDesc);
    assert(clearResult.read === 4, `reads 4 raw rows (got ${clearResult.read})`);
    assert(clearResult.rows === 2, `writes the 2 CY2024 crashes with a case number (got ${clearResult.rows})`);
    const typed = events.find((e) => e.type === 'work_zone/crashes_clear:TYPED');
    assert(typed.payload.skipped_outside_window === 1 && typed.payload.skipped_no_case_number === 1, 'counts what it skipped');
  });
  await test('crashes_clear streams the raw table by key and replaces its window on crash_date', async () => {
    await runClear(clearDesc);
    const page = pg.statements.find((s) => /ORDER BY ogc_fid LIMIT/.test(s.text));
    assert(page && /ogc_fid > \$1/.test(page.text), 'pages by ogc_fid, not OFFSET');
    const del = pg.statements.findIndex((s) => /^DELETE FROM work_zone\./.test(s.text.trim()));
    const ins = pg.statements.findIndex((s) => /INSERT INTO work_zone\./.test(s.text));
    assert(del >= 0 && del < ins, 'delete precedes insert');
    assert(/crash_date >= '2024-01-01'/.test(pg.statements[del].text) && /INTERVAL '1 day'/.test(pg.statements[del].text), 'half-open on crash_date');
  });
  await test('crashes_clear derives KABCO, the work-zone code, the epoch and a 4326 point', async () => {
    await runClear(clearDesc);
    const ins = pg.statements.find((s) => /INSERT INTO work_zone\./.test(s.text));
    assert(/ST_SetSRID\(ST_MakePoint\(v\.lon::double precision, v\.lat::double precision\), 4326\)/.test(ins.text), 'the point carries SRID 4326 in the value');
    const l1 = ins.text.split('\n').find((l) => /'40185959'/.test(l));
    const cols = sql.NYS_CRASHES_CLEAR_COLUMNS; const vals = l1.slice(l1.indexOf("('40185959'") + 1).split(', ');
    const at = (c) => vals[cols.indexOf(c)];
    assert(at('severity_kabco') === "'C'" && at('severity_class') === "'injury'", `KABCO C / injury (got ${at('severity_kabco')} ${at('severity_class')})`);
    assert(at('wz_coded') === 'TRUE' && at('wz_code') === "'highway'", 'work-zone coded from TrafficControl');
    assert(at('epoch') === '158', `1:10 PM is epoch 158 (got ${at('epoch')})`);
    assert(at('functional_class_fhwa') === '11' && at('fc_interstate') === 'TRUE', 'CLEAR code 7 -> FHWA 11, Interstate');
    const l2 = ins.text.split('\n').find((l) => /'40185960'/.test(l));
    const v2 = l2.slice(l2.indexOf("('40185960'") + 1).split(', ');
    assert(v2[cols.indexOf('severity_kabco')] === "'O'", 'property damage -> O');
    assert(v2[cols.indexOf('time_uncertain')] === 'TRUE', 'midnight is flagged uncertain');
    assert(v2[cols.indexOf('n_injuries')] === '0', 'a reported zero stays 0');
  });
  await test('crashes_clear stamps the statewide coded series, the DMV clock and metadata.columns', async () => {
    const r = await runClear(clearDesc);
    const { rows: v } = await db.query(`SELECT version, metadata FROM views WHERE view_id = $1`, [r.view_id]);
    const vm = parseJson(v[0].metadata);
    assert(v[0].version === 'CY2024', `vintage (got ${v[0].version})`);
    assert(vm.m5_statewide.crashes === 2 && vm.m5_statewide.wz_coded === 1, 'counts crashes and coded crashes');
    assert(vm.m5_statewide.wz_by_code.highway === 1 && vm.m5_statewide.by_kabco.C === 1 && vm.m5_statewide.by_kabco.O === 1, 'breaks them down');
    assert(vm.m5_statewide.time_uncertain === 1, 'counts uncertain times');
    assert(vm.dmv_insert_max === '2024-10-01', `the completeness clock (got ${vm.dmv_insert_max})`);
    assert(vm.raw_view_id === rawView.view_id && vm.raw_metadata.csv_path === '/x/crash_2024.csv', 'records the raw view it read');
    assert(/no contributing-factor value/.test(vm.wz_attribution), 'states the attribution basis');
    const { rows } = await db.query(`SELECT metadata FROM sources WHERE source_id = $1`, [crashSrc.source_id]);
    assert(parseJson(rows[0].metadata).columns.length === sql.NYS_CRASHES_CLEAR_TABLE_COLUMNS.length, 'metadata.columns written');
  });
  await test('crashes_clear takes the window from the raw table when none is given', async () => {
    await runClear({ source_id: crashSrc.source_id, file_upload_view_id: rawView.view_id, user_id: 1 });
    const init = events.find((e) => e.type === 'work_zone/crashes_clear:INITIAL');
    assert(init.payload.start_date === '2024-01-01' && init.payload.end_date === '2025-01-03', `raw span (got ${init.payload.start_date}..${init.payload.end_date})`);
  });
  await test('crashes_clear refuses a descriptor without the raw view', async () => {
    let msg = null;
    try { await runClear({ source_id: crashSrc.source_id }); } catch (e) { msg = e.message; }
    assert(/file_upload_view_id/.test(msg || ''), `names the input (got ${msg})`);
  });

  // ── crash_join ──
  const metaSrc = await mkSource(`npmrds_meta_${Date.now()}`, 'npmrds_meta');
  const tmcSrc = await mkSource(`wz_event_tmc_${Date.now()}`, 'wz_event_tmc');
  const spineSrc = await mkSource(`wz_event_${Date.now()}`, 'wz_event', { wz_event_tmc_source_id: tmcSrc.source_id });
  const expSrc = await mkSource(`wz_exposure_${Date.now()}`, 'wz_exposure');
  const queueSrc = await mkSource(`wz_queue_${Date.now()}`, 'wz_queue');
  const outSrc = await mkSource(`wz_crash_${Date.now()}`, 'wz_crash');
  const winMeta = (y) => ({ start_date: `${y}-01-01`, end_date: `${y}-12-31`, npmrds_meta_source_id: metaSrc.source_id });
  const spine2024 = await mkView(spineSrc.source_id, 'work_zone', 'wz_event_2024', winMeta(2024));
  await mkView(tmcSrc.source_id, 'work_zone', 'wz_event_tmc_2024', winMeta(2024));
  await mkView(expSrc.source_id, 'work_zone', 'wz_exposure_2024', winMeta(2024));
  await mkView(queueSrc.source_id, 'work_zone', 'wz_queue_2024', winMeta(2024));

  const joinDesc = {
    source_id: outSrc.source_id, wz_event_source_id: spineSrc.source_id, crash_source_id: crashSrc.source_id,
    event_tmc_table: 'transcom.event_tmc', wz_exposure_source_id: expSrc.source_id, wz_queue_source_id: queueSrc.source_id,
    start_date: '2024-01-01', end_date: '2024-12-31', user_id: 1,
  };
  const runJoin = (d, opts = {}) => {
    events = []; pg = fakePgDb(opts);
    return makeCrashJoin({ getPgDb: () => pg, createDamaView: metadata.createDamaView, createDamaSource: metadata.createDamaSource })(ctx(d));
  };

  let joinResult;
  await test('crash_join runs end to end: two zones, three matches kept, the GHOST dropped', async () => {
    joinResult = await runJoin(joinDesc);
    assert(joinResult.zones === 2, `2 zones (got ${joinResult.zones})`);
    assert(joinResult.matches === 3, `3 match rows (got ${joinResult.matches})`);
    assert(joinResult.match_source_id && joinResult.match_view_id, 'reports the wz_crash_match outputs');
  });
  await test('crash_join resolves the crash view for the vintage and the optional exposure + queue views', async () => {
    await runJoin(joinDesc);
    const r = events.find((e) => e.type === 'work_zone/crash_join:RESOLVED');
    assert(/nys_crashes_clear/.test(r.payload.crashes), `the typed crash view (got ${r.payload.crashes})`);
    assert(/wz_exposure_2024/.test(r.payload.wz_exposure) && /wz_queue_2024/.test(r.payload.wz_queue), 'exposure and queue views');
  });
  await test('crash_join stages active windows and probe geometries as TEMP tables and drops them — even on failure', async () => {
    await runJoin(joinDesc);
    const creates = pg.statements.filter((s) => /^CREATE TEMP TABLE/.test(s.text.trim()));
    assert(creates.length === 2, `two temp tables (got ${creates.length})`);
    const fill = pg.statements.find((s) => /INSERT INTO _wz_crash_active_/.test(s.text));
    assert(fill && /zone_members/.test(fill.text) && /tmc_role = 'anchor'/.test(fill.text), 'the active table is filled from the shared window expansion');
    const geoms = pg.statements.find((s) => /INSERT INTO _wz_crash_zones_/.test(s.text));
    assert(/COALESCE\(q\.wkb_geometry, e\.wkb_geometry\)::geography/.test(geoms.text), 'the probe geometry is the queue extent where there is one, else the anchor');
    assert(/q\.max_queue_len_mi > 0/.test(geoms.text), 'a queue extent only counts when a queue was measured');
    const drops = pg.statements.filter((s) => /^DROP TABLE IF EXISTS _wz_crash_/.test(s.text.trim()));
    assert(drops.length === 2, `drops both (got ${drops.length})`);
    let threw = false;
    try { await runJoin(joinDesc, { failMatch: true }); } catch (e) { threw = true; }
    assert(threw, 'the failure propagates');
    assert(pg.statements.filter((s) => /^DROP TABLE IF EXISTS _wz_crash_/.test(s.text.trim())).length === 2, 'and still drops both');
  });
  await test('crash_join builds the match with the buffer given', async () => {
    await runJoin(joinDesc);
    const m = pg.statements.find((s) => /^WITH near AS/.test(s.text.trim()));
    assert(/ST_DWithin\(c\.geog, z\.probe_geog, 50\)/.test(m.text), 'default 50 m');
    await runJoin({ ...joinDesc, crash_buffer_m: 75 });
    const m2 = pg.statements.find((s) => /^WITH near AS/.test(s.text.trim()));
    assert(/ST_DWithin\(c\.geog, z\.probe_geog, 75\)/.test(m2.text), 'override honoured');
    let msg = null; try { await runJoin({ ...joinDesc, crash_buffer_m: 0 }); } catch (e) { msg = e.message; }
    assert(/positive/.test(msg || ''), 'a zero buffer is refused');
  });
  await test('crash_join counts in-window matches per zone by role and severity, keeps off-hours matches uncounted', async () => {
    await runJoin(joinDesc);
    const ins = pg.statements.find((s) => /INSERT INTO work_zone\..*wz_crash \(/s.test(s.text) && /'Z1'/.test(s.text));
    const line = ins.text.split('\n').find((l) => /\('Z1',/.test(l)); const vals = line.slice(line.indexOf("('Z1'") + 1).split(', ');
    const cols = sql.WZ_CRASH_COLUMNS; const at = (c) => vals[cols.indexOf(c)];
    assert(at('crashes_total') === '2', `2 in window (got ${at('crashes_total')})`);
    assert(at('crashes_work_extent') === '1' && at('crashes_queue') === '1', 'one on the work extent, one on the queue');
    assert(at('crashes_injury') === '1' && at('crashes_pdo') === '1' && at('kabco_c') === '1' && at('kabco_o') === '1', 'by severity');
    assert(at('crashes_wz_coded') === '1' && at('crashes_flagger') === '0', 'the coded one counted, the flagger one is off-hours');
    assert(at('crashes_off_window') === '1', 'the same-day off-hours crash is kept but not counted');
    assert(at('crashes_time_uncertain') === '1', 'midnight match counted as uncertain');
    assert(at('queue_extent_available') === 'TRUE' && at('active_hours') === '55.7', 'corridor and hours facts on the row');
    assert(at('rate_measured') === 'TRUE', 'exposure complete');
    // 2 crashes / 60000.5 VMT x 1e8
    assert(Math.abs(Number(at('crash_rate_per_100m_vmt')) - 2 / 60000.5 * 1e8) < 1, `rate (got ${at('crash_rate_per_100m_vmt')})`);
    // the last column carries the row's closing parenthesis
    assert(Math.abs(Number(at('crashes_per_1000_active_hours').replace(/[),]+$/, '')) - 2 / 55.7 * 1000) < 0.01, `time-based rate (got ${at('crashes_per_1000_active_hours')})`);
  });
  await test('crash_join publishes a zone without exposure with a NULL rate, never 0', async () => {
    await runJoin(joinDesc);
    const ins = pg.statements.find((s) => /INSERT INTO work_zone\..*wz_crash \(/s.test(s.text) && /'Z2'/.test(s.text));
    const line = ins.text.split('\n').find((l) => /\('Z2',/.test(l)); const vals = line.slice(line.indexOf("('Z2'") + 1).split(', ');
    const cols = sql.WZ_CRASH_COLUMNS; const at = (c) => vals[cols.indexOf(c)];
    assert(at('crashes_total') === '0', 'no crashes');
    assert(at('rate_measured') === 'FALSE' && at('crash_rate_per_100m_vmt') === 'NULL' && at('vmt_through_wz') === 'NULL', 'rate unknown, not zero');
    assert(at('active_hours') === 'NULL', 'no active windows known for Z2');
  });
  await test('crash_join writes the match rows with the crash point and replaces both windows', async () => {
    await runJoin(joinDesc);
    const ins = pg.statements.find((s) => /INSERT INTO work_zone\..*wz_crash_match \(/s.test(s.text));
    assert(ins && /LEFT JOIN .*nys_crashes_clear.* c ON c\.crash_id = v\.crash_id/s.test(ins.text), 'geometry comes from the crash table');
    assert(!/GHOST/.test(ins.text), 'the out-of-window zone is not written');
    assert(/'queue'/.test(ins.text) && /'work_extent'/.test(ins.text), 'roles written');
    const dels = pg.statements.filter((s) => /^DELETE FROM work_zone\./.test(s.text.trim()));
    assert(dels.length === 2 && dels.every((s) => /first_start < \('2024-12-31'::date \+ INTERVAL '1 day'\)/.test(s.text)), 'two half-open window deletes');
  });
  await test('crash_join creates the wz_crash_match source once and reuses it', async () => {
    const a = await runJoin(joinDesc); const b = await runJoin(joinDesc);
    const { rows } = await db.query(`SELECT count(*) AS n FROM sources WHERE type = 'wz_crash_match'`);
    assert(Number(rows[0].n) === 1, `one source (got ${rows[0].n})`);
    assert(a.match_source_id === b.match_source_id && a.match_view_id !== b.match_view_id, 'same source, new view');
  });
  await test('crash_join stamps M5, the tiers and the coded-versus-located cross-check on the view', async () => {
    const r = await runJoin(joinDesc);
    const { rows: v } = await db.query(`SELECT version, metadata FROM views WHERE view_id = $1`, [r.view_id]);
    const vm = parseJson(v[0].metadata);
    assert(v[0].version === 'CY2024', 'vintage');
    assert(vm.crash_buffer_m === 50 && vm.wz_event_view_id === spine2024.view_id, 'records the buffer and the spine view');
    assert(vm.m5.zones === 2 && vm.m5.crashes_total === 2 && vm.m5.crashes_queue === 1, `M5 totals (got ${JSON.stringify([vm.m5.zones, vm.m5.crashes_total])})`);
    assert(vm.m5.zones_rate_measured === 1 && Math.abs(vm.m5.rate_per_100m_vmt - 2 / 60000.5 * 1e8) < 1, 'the rate over exposure-complete zones');
    assert(vm.m5_by_tier.significant.zones === 1 && vm.m5_by_tier.significant.crashes_total === 0, 'per-tier rollup');
    assert(vm.coded_crashes_in_window_year === 10 && vm.coded_located_in_active_zone === 1 && vm.coded_located_share === 0.1,
      `coded crashes located in an active zone: 1 of 10 (got ${vm.coded_located_in_active_zone}/${vm.coded_crashes_in_window_year})`);
    assert(vm.located_crashes === 2 && vm.located_coded_share === 0.5, 'located crashes carrying the code: 1 of 2');
    assert(vm.zones_with_queue_extent === 1, 'counts zones with a queue extent');
    const { rows: mv } = await db.query(`SELECT metadata FROM views WHERE view_id = $1`, [r.match_view_id]);
    assert(parseJson(mv[0].metadata).wz_crash_view_id === r.view_id, 'the match view points back at the zone view');
  });
  await test('crash_join writes metadata.columns on both sources', async () => {
    const r = await runJoin(joinDesc);
    const { rows } = await db.query(`SELECT metadata FROM sources WHERE source_id = $1`, [outSrc.source_id]);
    assert(parseJson(rows[0].metadata).columns.length === sql.WZ_CRASH_TABLE_COLUMNS.length, 'wz_crash columns');
    const { rows: m } = await db.query(`SELECT metadata FROM sources WHERE source_id = $1`, [r.match_source_id]);
    assert(parseJson(m[0].metadata).columns.length === sql.WZ_CRASH_MATCH_TABLE_COLUMNS.length, 'wz_crash_match columns');
  });

  console.log(`\n  ${passed} passing, ${failed} failing\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => { console.error('Test runner error:', err); process.exit(1); });
