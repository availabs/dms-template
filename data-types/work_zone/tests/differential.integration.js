/**
 * Integration test (phase 6): the work_zone/differential worker.
 *
 * Fakes the physical Postgres side and ClickHouse against the real DAMA sqlite
 * harness for sources and views. Asserts what a unit test cannot: that the
 * worker writes INTO the existing wz_speed view for the vintage and creates
 * none; that it refuses a year wz_speed has no view for; that the corridor is
 * staged with rank 0 = anchor and 1..N = approach, N from the descriptor; that
 * the three staging tables are dropped even when the hour query throws; that
 * the baseline drop is filled and the approach side cleared BEFORE the
 * approach update; that the approach update carries the threshold; that M4
 * is stamped on the view per tier; and that the source's column descriptors
 * are re-stamped with the M4 descriptions.
 *
 * Run: node data-types/work_zone/tests/differential.integration.js
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
  { wz_event_id: 'Z1', first_start: '2024-07-13 07:28:06', last_end: '2024-07-15 16:08:56', is_interstate: true, in_tma: true, is_significant_candidate: false },
  { wz_event_id: 'Z2', first_start: '2024-08-01 09:00:00', last_end: '2024-08-01 15:00:00', is_interstate: true, in_tma: true, is_significant_candidate: true },
];
const ACTIVE = [
  { wz_event_id: 'Z1', tmc: '120P04940', date: '2024-07-13', epoch_from: 41, epoch_to: 288, window_source: '2799' },
  { wz_event_id: 'Z2', tmc: '120-05865', date: '2024-08-01', epoch_from: 108, epoch_to: 180, window_source: '2799' },
];
// the real I-495 corridor rows (three upstream), and a Northway anchor with nothing upstream
const CORRIDOR = [
  { anchor_tmc: '120P04940', tmc: '120P04940', road_order: 104, miles: 0.495147, avg_speedlimit: 50, start_latitude: 40.74568, start_longitude: -73.76843, end_latitude: 40.74320, end_longitude: -73.77717 },
  { anchor_tmc: '120P04940', tmc: '120+04940', road_order: 103, miles: 0.036485, avg_speedlimit: 50, start_latitude: 40.74585, start_longitude: -73.76777, end_latitude: 40.74568, end_longitude: -73.76843 },
  { anchor_tmc: '120P04940', tmc: '120P04939', road_order: 102, miles: 0.185035, avg_speedlimit: 50, start_latitude: 40.74675, start_longitude: -73.76444, end_latitude: 40.74585, end_longitude: -73.76777 },
  { anchor_tmc: '120P04940', tmc: '120+04939', road_order: 101, miles: 0.290003, avg_speedlimit: 50, start_latitude: 40.74847, start_longitude: -73.75941, end_latitude: 40.74675, end_longitude: -73.76444 },
  { anchor_tmc: '120-05865', tmc: '120-05865', road_order: 80, miles: 1.7367, avg_speedlimit: 55, start_latitude: 43.0, start_longitude: -73.8, end_latitude: 42.98, end_longitude: -73.8 },
];
/** the hour-grain result: Z1 three hours (one without approach), Z2 one hour, GHOST outside the window */
const HOURS = [
  { wz_event_id: 'Z1', date: '2024-07-13', hour: 8, epochs_in_hour: 12, zone_speed: 30, approach_epochs_in_hour: 12, approach_speed: 52, baseline_speed: 50 },
  { wz_event_id: 'Z1', date: '2024-07-13', hour: 9, epochs_in_hour: 12, zone_speed: 45, approach_epochs_in_hour: 12, approach_speed: 50, baseline_speed: 48 },
  { wz_event_id: 'Z1', date: '2024-07-13', hour: 10, epochs_in_hour: 11, zone_speed: 25, approach_epochs_in_hour: 0, approach_speed: null, baseline_speed: 49 },
  { wz_event_id: 'Z2', date: '2024-08-01', hour: 10, epochs_in_hour: 12, zone_speed: 60, approach_epochs_in_hour: 0, approach_speed: null, baseline_speed: 62 },
  { wz_event_id: 'GHOST', date: '2024-07-13', hour: 8, epochs_in_hour: 12, zone_speed: 10, approach_epochs_in_hour: 12, approach_speed: 60, baseline_speed: 60 },
];
const CELLS = [
  { wz_event_id: 'Z1', hour: 8, approach_tmcs: '120+04940 120P04939', approach_observations: 24, approach_speed: 51.4 },
  { wz_event_id: 'Z1', hour: 9, approach_tmcs: '120+04940 120P04939', approach_observations: 24, approach_speed: 49.9 },
  { wz_event_id: 'GHOST', hour: 8, approach_tmcs: 'X', approach_observations: 12, approach_speed: 60 },
];

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
        if (/DISTINCT tmc, to_char\(g\.day/.test(t)) return { rows: [{ tmc: '120P04940', date: '2023-05-05' }] };
        if (/is_interstate, in_tma, is_significant_candidate\s+FROM/.test(t)) return { rows: ZONES };
        if (/FILTER \(WHERE approach_speed IS NOT NULL\)/.test(t)) {
          return { rows: [{ cells: '40', cells_with_approach: '2', cells_with_baseline: '38', cells_exceeding: '1', zones: '2', zones_with_approach: '1' }] };
        }
      }
      return { rows: [] };
    },
  };
}
function fakeChDb({ failHour = false } = {}) {
  const statements = []; const inserts = []; const insertValues = [];
  return {
    statements, inserts, insertValues,
    client: { async insert({ table, values }) { inserts.push({ table, rows: values.length }); insertValues.push({ table, values }); } },
    async exec({ query }) { statements.push(String(query).trim()); return {}; },
    async query({ query }) {
      const t = String(query).trim(); statements.push(t);
      if (/approach_epochs_in_hour/.test(t)) { if (failHour) throw new Error('simulated ClickHouse failure'); return { json: async () => HOURS }; }
      if (/approach_observations/.test(t)) return { json: async () => CELLS };
      return { json: async () => [] };
    },
  };
}

async function runTests() {
  console.log(`\n=== work_zone/differential worker (${DAMA_TEST_DB}) ===\n`);
  await setup();
  const { getDb } = require('@availabs/dms-server/src/db');
  const metadata = require('@availabs/dms-server/src/dama/upload/metadata');
  const db = getDb(DAMA_TEST_DB);
  const { makeDifferential } = require('../workers/differential.js');
  const sql = require('../sql.js');

  const mkSource = (name, type, meta = {}) => metadata.createDamaSource({ name, type, user_id: 1, metadata: meta }, DAMA_TEST_DB);
  const mkView = async (source_id, schema, table, meta = {}, version = null) => {
    const v = await metadata.createDamaView({ source_id, user_id: 1 }, DAMA_TEST_DB);
    await db.query(`UPDATE views SET table_schema=$1, table_name=$2, data_table=$3, metadata=$4, version=$5 WHERE view_id=$6`,
      [schema, table, `${schema}.${table}`, JSON.stringify(meta), version, v.view_id]);
    return v;
  };
  const metaSrc = await mkSource(`npmrds_meta_${Date.now()}`, 'npmrds_meta');
  await mkView(metaSrc.source_id, 'npmrds_geometry', 'npmrds_meta', { is_clickhouse_table: 0 });
  const tmcSrc = await mkSource(`wz_event_tmc_${Date.now()}`, 'wz_event_tmc');
  const spineSrc = await mkSource(`wz_event_${Date.now()}`, 'wz_event', { wz_event_tmc_source_id: tmcSrc.source_id });
  const speedSrc = await mkSource(`npmrds_${Date.now()}`, 'npmrds');
  const wzSpeedSrc = await mkSource(`wz_speed_${Date.now()}`, 'wz_speed', { columns: [{ name: 'approach_tmc', desc: 'Phase 6 (M4)' }] });
  const winMeta = (y) => ({ start_date: `${y}-01-01`, end_date: `${y}-12-31`, npmrds_meta_source_id: metaSrc.source_id });
  await mkView(spineSrc.source_id, 'work_zone', 'wz_event_2024', winMeta(2024));
  await mkView(tmcSrc.source_id, 'work_zone', 'wz_event_tmc_2024', winMeta(2024));
  await mkView(speedSrc.source_id, 'clickhouse.npmrds', 's583_v982_NPMRDS_V6', { is_clickhouse_table: 1 });
  const wzSpeed2024 = await mkView(wzSpeedSrc.source_id, 'work_zone', 's2206_v3884_wz_speed', { ...winMeta(2024), m1: { zones: 1 } }, 'CY2024');

  const descriptor = {
    source_id: wzSpeedSrc.source_id, wz_event_source_id: spineSrc.source_id, npmrds_source_id: speedSrc.source_id,
    event_tmc_table: 'transcom.event_tmc', start_date: '2024-01-01', end_date: '2024-12-31', user_id: 1,
  };
  let events = []; let pg = fakePgDb(); let ch = fakeChDb(); let viewsCreated = 0;
  const ctx = (d) => ({ task: { task_id: 1, descriptor: d }, pgEnv: DAMA_TEST_DB, db,
    dispatchEvent: async (type, msg, payload) => { events.push({ type, msg, payload }); }, updateProgress: async () => {} });
  const run = (d, opts = {}) => {
    events = []; pg = fakePgDb(); ch = fakeChDb(opts);
    return makeDifferential({ getPgDb: () => pg, getChDb: () => ch, createDamaView: async () => { viewsCreated += 1; return { view_id: -1 }; } })(ctx(d));
  };
  const before = (await db.query(`SELECT count(*) AS n FROM views`)).rows[0].n;

  await test('fills the EXISTING wz_speed view for the vintage and creates no view', async () => {
    const r = await run(descriptor);
    assert(r.view_id === wzSpeed2024.view_id, `targets the CY2024 wz_speed view (got ${r.view_id})`);
    const after = (await db.query(`SELECT count(*) AS n FROM views`)).rows[0].n;
    assert(Number(after) === Number(before) && viewsCreated === 0, 'no view created');
    assert(r.zone_hours === 4, `4 zone-hours in the window, the GHOST dropped (got ${r.zone_hours})`);
    assert(r.cells_updated === 2, `2 approach cells updated (got ${r.cells_updated})`);
  });
  await test('refuses a year wz_speed has no view for', async () => {
    let msg = null;
    try { await run({ ...descriptor, start_date: '2023-01-01', end_date: '2023-12-31' }); } catch (e) { msg = e.message; }
    assert(/no view for 2023/.test(msg || ''), `names the gap (got ${msg})`);
  });
  await test('takes wz_speed_source_id over source_id when given, and needs one of them', async () => {
    const r = await run({ ...descriptor, source_id: undefined, wz_speed_source_id: wzSpeedSrc.source_id });
    assert(r.source_id === wzSpeedSrc.source_id, 'resolves the wz_speed source');
    let msg = null; try { await run({ ...descriptor, source_id: undefined }); } catch (e) { msg = e.message; }
    assert(/wz_speed_source_id/.test(msg || ''), `names the missing input (got ${msg})`);
  });
  await test('stages the corridor with rank 0 = anchor and 1..2 = approach by default, 1..1 when asked', async () => {
    await run(descriptor);
    const ins = ch.insertValues.find((v) => /_wz_dcorr_/.test(v.table));
    const z1 = ins.values.filter((r) => r.wz_event_id === 'Z1').sort((a, b) => a.rank - b.rank);
    assert(z1.map((r) => `${r.rank}:${r.tmc}`).join(' ') === '0:120P04940 1:120+04940 2:120P04939', `default two approach segments (got ${z1.map((r) => r.rank + ':' + r.tmc).join(' ')})`);
    const z2 = ins.values.filter((r) => r.wz_event_id === 'Z2');
    assert(z2.length === 1 && z2[0].rank === 0, 'an anchor with nothing upstream is staged alone');
    assert(z1[0].epoch_from === 41 && z1[0].epoch_to === 288, 'carries the active window');
    const staged = events.find((e) => e.type === 'work_zone/differential:STAGED');
    assert(staged.payload.anchors_with_approach === 1, 'counts anchors with an approach');
    await run({ ...descriptor, approach_tmcs: 1 });
    const ins1 = ch.insertValues.find((v) => /_wz_dcorr_/.test(v.table));
    assert(ins1.values.filter((r) => r.wz_event_id === 'Z1').length === 2, 'approach_tmcs = 1 stages anchor + one');
  });
  await test('stages the anchors and the baseline exclusions and builds the baseline CTE', async () => {
    await run(descriptor);
    assert(ch.insertValues.some((v) => /_wz_dtmc_/.test(v.table) && v.values.length === 2), 'two anchors with lengths');
    assert(ch.insertValues.some((v) => /_wz_dexcl_/.test(v.table) && v.values.length === 1), 'the excluded tmc-day');
    const hourQ = ch.statements.find((s) => /approach_epochs_in_hour/.test(s));
    assert(/^WITH baseline AS/.test(hourQ), 'the hour query carries the baseline CTE');
    assert(/LEFT ANTI JOIN .*_wz_dexcl_/.test(hourQ), 'the baseline excludes contaminated days');
    assert(/HAVING epochs_in_hour >= 6/.test(hourQ), 'half-hour floor');
    const excl = pg.statements.find((s) => /DISTINCT tmc, to_char\(g\.day/.test(s.text));
    assert(/tmc_role = 'anchor'/.test(excl.text), 'exclusions restricted to the anchors');
    assert(excl.params[0] === '2023-01-01' && excl.params[1] === '2023-12-31', `12-month baseline window (got ${excl.params})`);
  });
  await test('drops all three staging tables — including when the hour query fails', async () => {
    await run(descriptor);
    assert(ch.statements.filter((s) => /^DROP TABLE IF EXISTS/.test(s)).length === 3, 'three drops on success');
    let threw = false; try { await run(descriptor, { failHour: true }); } catch (e) { threw = true; }
    assert(threw, 'the failure propagates');
    assert(ch.statements.filter((s) => /^DROP TABLE IF EXISTS/.test(s)).length === 3, 'and still three drops');
  });
  await test('fills the baseline drop and clears the approach side BEFORE the approach update', async () => {
    await run(descriptor);
    const ups = pg.statements.map((s, i) => [s.text, i]).filter(([t]) => /^UPDATE work_zone\.s2206_v3884_wz_speed/.test(t.trim()));
    assert(ups.length === 2, `two updates (got ${ups.length})`);
    const [base, approach] = ups;
    assert(/differential_baseline = CASE WHEN baseline_speed IS NULL/.test(base[0]) && /approach_speed = NULL/.test(base[0]), 'baseline drop + clear first');
    assert(/FROM \(VALUES/.test(approach[0]) && base[1] < approach[1], 'approach VALUES update second');
    assert(/\('Z1', 8, '120\+04940 120P04939', 51\.4\)/.test(approach[0]), 'the cell rows, with the approach TMC list');
    assert(!/GHOST/.test(approach[0]), 'the out-of-window zone is not written');
    assert(/> 15 END/.test(approach[0]), 'default threshold 15 mph');
    await run({ ...descriptor, thresholds: { differential_mph: 20 } });
    const a2 = pg.statements.find((s) => /FROM \(VALUES/.test(s.text));
    assert(/> 20 END/.test(a2.text), 'threshold override');
  });
  await test('stamps M4 per tier on the wz_speed view without disturbing M1', async () => {
    const r = await run(descriptor);
    const { rows } = await db.query(`SELECT metadata FROM views WHERE view_id = $1`, [r.view_id]);
    const vm = parseJson(rows[0].metadata);
    assert(vm.m1 && vm.m1.zones === 1, 'phase-3 metadata kept');
    // Z1: hours 8 (drop 22), 9 (drop 5) have an approach → 1 of 2 over 15; Z1 hour 10 and Z2 have none
    assert(vm.m4.hours_measured === 4 && vm.m4.hours_with_approach === 2, `hours counted (got ${vm.m4.hours_measured}/${vm.m4.hours_with_approach})`);
    assert(Math.abs(vm.m4.m4_approach_hour_weighted - 0.5) < 1e-6, `approach share 1/2 (got ${vm.m4.m4_approach_hour_weighted})`);
    // baseline drops: 20, 3, 24, 2 → 2 of 4 over 15
    assert(Math.abs(vm.m4.m4_baseline_hour_weighted - 0.5) < 1e-6, `baseline share 2/4 (got ${vm.m4.m4_baseline_hour_weighted})`);
    assert(vm.m4_by_tier.significant.hours_measured === 1 && vm.m4_by_tier.significant.m4_approach_hour_weighted === null, 'the significant zone has no approach — null, not 0');
    assert(vm.m4_thresholds.differential_mph === 15 && vm.m4_approach_tmcs === 2, 'parameters recorded');
    assert(vm.m4_cells === 40 && vm.m4_cells_with_approach === 2, 'cell coverage recorded from the table');
    assert(vm.m4_baseline_start === '2023-01-01', 'baseline window recorded');
  });
  await test('re-stamps the wz_speed source descriptors with the M4 descriptions', async () => {
    await run(descriptor);
    const { rows } = await db.query(`SELECT metadata FROM sources WHERE source_id = $1`, [wzSpeedSrc.source_id]);
    const cols = parseJson(rows[0].metadata).columns;
    assert(cols.length === sql.WZ_SPEED_TABLE_COLUMNS.length, 'the full column list');
    const a = cols.find((c) => c.name === 'differential_approach');
    assert(a && /approach/.test(a.desc) && a.desc !== 'Phase 6 (M4)', 'placeholder replaced');
  });

  console.log(`\n  ${passed} passing, ${failed} failing\n`);
  if (failed > 0) process.exit(1);
}
runTests().catch((err) => { console.error('Test runner error:', err); process.exit(1); });
