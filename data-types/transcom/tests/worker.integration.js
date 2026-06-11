/**
 * Integration test (Phase 3): the transcom staged workers.
 *
 * Workers are built via makeWorker(deps) so the TRANSCOM API client, the
 * Postgres data plane (dataDb) and the npmrds ClickHouse reads are injected.
 * This test injects FAKES — no test ever contacts the live TRANSCOM API, a
 * real Postgres data plane, or ClickHouse. It asserts each worker:
 *   - drives external systems only through the injected deps,
 *   - issues the load-bearing DDL/DML (events table, event_tmc expansion,
 *     congestion upsert + events-table congestion update),
 *   - writes views.metadata.{start_date,end_date} (+ congestion bookkeeping),
 *   - writes source metadata.columns,
 *   - reports progress and emits a terminal event.
 *
 * Node/sqlite harness. Run: node data-types/transcom/tests/worker.integration.js
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

// ── fakes ────────────────────────────────────────────────────────────────────

/** Fake Postgres data plane: records every statement, answers from matchers. */
function fakeDataDb(matchers = []) {
  const calls = [];
  return {
    calls,
    async query(sql, values) {
      const text = typeof sql === 'string' ? sql : sql.text;
      calls.push({ sql: text, values: values || (sql && sql.values) });
      for (const [re, rows] of matchers) {
        if (re.test(text)) return { rows: typeof rows === 'function' ? rows(text) : rows };
      }
      return { rows: [] };
    },
    joined() { return calls.map((c) => c.sql).join('\n;;\n'); },
  };
}

function fakeTranscomClient(events) {
  const calls = [];
  return {
    calls,
    closed: false,
    async collectEventIdsForTimeRange(startTs, endTs) {
      calls.push(['collectEventIdsForTimeRange', startTs, endTs]);
      return events.map((e) => e.ID);
    },
    async downloadEvents(ids) {
      calls.push(['downloadEvents', ids]);
      return events.filter((e) => ids.includes(e.ID));
    },
    async close() { this.closed = true; },
  };
}

function fakeChDb() {
  const execs = [];
  return {
    execs,
    async exec({ query }) { execs.push(query); return {}; }, // P1 baseline CTAS lands here
    async query() { return { json: async () => [] }; }, // no real TT rows: synthetic fill from free-flow
  };
}

function makeCtx({ db, descriptor }) {
  const events = [];
  const progress = [];
  return {
    ctx: {
      pgEnv: DAMA_TEST_DB,
      db,
      task: { task_id: 1, descriptor },
      dispatchEvent: async (type, message, payload) => { events.push({ type, message, payload }); },
      updateProgress: async (p) => { progress.push(p); },
    },
    events,
    progress,
  };
}

const FIXTURE_EVENTS = [
  {
    ID: 'ORI1', 'Event Class': 'accident', 'Reporting Organization': 'TRANSCOM',
    'Start DateTime': '03/05/2024 08:20:00 AM', 'Close Date': '03/05/2024 10:10:00 AM',
    Facility: 'I-90', 'Event Type': 'accident with injuries', Description: "O'Brien crash",
    Direction: 'eastbound', County: 'Albany', State: 'NY',
    PointLAT: 42.65, PointLONG: -73.75, Year: 2024, DayofWeek: 3,
  },
  {
    ID: 'ORI2', 'Event Class': 'construction', 'Reporting Organization': 'TRANSCOM',
    'Start DateTime': '03/06/2024 09:00:00 AM', 'Close Date': '03/06/2024 03:00:00 PM',
    Facility: 'NY-5', 'Event Type': 'construction', Description: 'lane closure',
    Direction: 'westbound', County: 'Albany', State: 'NY',
    PointLAT: 42.66, PointLONG: -73.76, Year: 2024, DayofWeek: 4,
  },
];

async function runTests() {
  console.log(`\n=== transcom workers (${DAMA_TEST_DB}) ===\n`);
  await setup();

  const { getDb } = require('@availabs/dms-server/src/db');
  const metadata = require('@availabs/dms-server/src/dama/upload/metadata');
  const db = getDb(DAMA_TEST_DB);
  const stamp = Date.now();

  const setViewMeta = async (viewId, meta, dataTable) => {
    await db.query(`UPDATE views SET metadata = $1${dataTable ? ', data_table = $3' : ''} WHERE view_id = $2`,
      dataTable ? [JSON.stringify(meta), viewId, dataTable] : [JSON.stringify(meta), viewId]);
  };

  // Supporting sources: npmrds geometry (full + 2024), npmrds production, map21.
  const geomSrc = await metadata.createDamaSource({ name: `geom_${stamp}`, type: 'npmrds_geom', user_id: 1 }, DAMA_TEST_DB);
  const geomFullView = await metadata.createDamaView({ source_id: geomSrc.source_id, user_id: 1 }, DAMA_TEST_DB);
  await setViewMeta(geomFullView.view_id, { is_clickhouse_table: 0 }, 'ny.npmrds_geom_full');
  const geomYearView = await metadata.createDamaView({ source_id: geomSrc.source_id, user_id: 1 }, DAMA_TEST_DB);
  await setViewMeta(geomYearView.view_id, { is_clickhouse_table: 0, year: 2024 }, 'ny.npmrds_geom_y2024');

  const prodSrc = await metadata.createDamaSource({ name: `npmrds_prod_${stamp}`, type: 'npmrds_production', user_id: 1 }, DAMA_TEST_DB);
  const prodView = await metadata.createDamaView({ source_id: prodSrc.source_id, user_id: 1 }, DAMA_TEST_DB);
  await setViewMeta(prodView.view_id, { start_date: '2024-01-01', end_date: '2024-12-31' }, 'clickhouse.npmrds_prod.s1_v1');

  const map21Src = await metadata.createDamaSource({ name: `map21_${stamp}`, type: 'map21', user_id: 1 }, DAMA_TEST_DB);
  const map21View = await metadata.createDamaView({ source_id: map21Src.source_id, user_id: 1 }, DAMA_TEST_DB);
  await db.query(`UPDATE views SET version = $1, data_table = $2 WHERE view_id = $3`,
    ['map21_2024', 'datasets.map21_2024', map21View.view_id]);

  // ════ transcom/publish ══════════════════════════════════════════════════
  console.log('-- transcom/publish --');
  const transcomSrc = await metadata.createDamaSource({ name: `transcom_${stamp}`, type: 'transcom', user_id: 1 }, DAMA_TEST_DB);

  const publishDataDb = fakeDataDb([
    [/SELECT event_id FROM/i, []],
    [/SELECT DISTINCT year/i, [{ year: 2024 }]],
  ]);
  const client = fakeTranscomClient(FIXTURE_EVENTS);
  const { makeWorker: makePublish } = require('../workers/publish.js');
  const publishWorker = makePublish({
    getDataDb: () => publishDataDb,
    makeTranscomClient: () => client,
    createDamaView: metadata.createDamaView,
  });

  const pub = makeCtx({ db, descriptor: {
    source_id: transcomSrc.source_id,
    name: `transcom_${stamp}`,
    user_id: 1,
    start_timestamp: '2024-03-01 00:00:00',
    end_timestamp: '2024-03-31 23:59:59',
    geom_source_id: geomSrc.source_id,
    npmrds_production_source_id: prodSrc.source_id,
    map21_source_id: map21Src.source_id,
  } });

  let pubResult;
  await test('publish runs end-to-end with injected fakes (no live TRANSCOM API)', async () => {
    pubResult = await publishWorker(pub.ctx);
    assert(pubResult && pubResult.source_id === transcomSrc.source_id, 'returns the source_id');
    assert(pubResult.view_id != null, 'returns the view_id');
  });

  await test('publish drives the TRANSCOM API only via the injected client (and closes it)', async () => {
    assert(client.calls.some(([m]) => m === 'collectEventIdsForTimeRange'), 'collects event ids');
    assert(client.calls.some(([m]) => m === 'downloadEvents'), 'downloads events');
    assert(client.closed, 'closes the client');
  });

  await test('publish issues the events-table DDL + idempotent insert on the data plane', async () => {
    const sql = publishDataDb.joined();
    assert(/CREATE TABLE IF NOT EXISTS transcom\./.test(sql), 'creates the transcom events table');
    assert(sql.includes('congestion_data JSONB'), 'events table carries congestion_data');
    assert(sql.includes('ON CONFLICT (event_id) DO NOTHING'), 'event insert is idempotent');
    assert(sql.includes('ORI1') && sql.includes("'O''Brien crash'"), 'inserts normalized, escaped fixture rows');
  });

  await test('publish runs the NYSDOT category, TMC match and region-name enrichment', async () => {
    const sql = publishDataDb.joined();
    assert(sql.includes('nysdot_transcom_event_classification'), 'NYSDOT category update');
    assert(sql.includes('ST_DWithin(e.point, g.geometry, 18)'), 'spatial TMC match');
    assert(sql.includes('ny.npmrds_geom_full'), 'TMC match reads the geometry full-version table');
    assert(sql.includes('ny.nysdot_region_names'), 'region-name update');
  });

  await test('publish writes views.metadata start/end dates + congestion bookkeeping', async () => {
    const { rows } = await db.query(`SELECT metadata, table_schema, data_table FROM views WHERE view_id = $1`, [pubResult.view_id]);
    const meta = parseMeta(rows[0].metadata);
    assert(rows[0].table_schema === 'transcom', `view table_schema should be transcom (got ${rows[0].table_schema})`);
    assert(meta.start_date === '2024-03-01 00:00:00', `start_date (got ${meta.start_date})`);
    assert(meta.end_date === '2024-03-31 23:59:59', `end_date (got ${meta.end_date})`);
    assert(Array.isArray(meta.congestion) && meta.congestion.length === 1, 'one congestion month chunk');
    assert(meta.congestion[0].is_congestion_data_available === false, 'congestion starts unavailable');
    assert(meta.geom_source_id === geomSrc.source_id, 'records geom_source_id');
    assert(meta.npmrds_production_source_id === prodSrc.source_id, 'records npmrds_production_source_id');
    assert(meta.map21_source_id === map21Src.source_id, 'records map21_source_id');
  });

  await test('publish writes source metadata.columns (drives the Table page)', async () => {
    const { rows } = await db.query(`SELECT metadata FROM sources WHERE source_id = $1`, [transcomSrc.source_id]);
    const cols = parseMeta(rows[0].metadata).columns;
    assert(Array.isArray(cols) && cols.length > 0, 'metadata.columns non-empty');
    const names = cols.map((c) => c.name);
    for (const n of ['event_id', 'event_type', 'start_date_time', 'tmclist', 'vehicle_delay']) {
      assert(names.includes(n), `metadata.columns includes ${n}`);
    }
  });

  await test('publish reports progress to completion and emits a FINAL event', async () => {
    assert(pub.progress[pub.progress.length - 1] === 1, 'final progress 1');
    assert(pub.events.some((e) => /transcom:FINAL/.test(e.type)), 'emits transcom:FINAL');
  });

  // ════ transcom/add ══════════════════════════════════════════════════════
  console.log('-- transcom/add --');
  const addDataDb = fakeDataDb([
    [/SELECT event_id FROM/i, [{ event_id: 'ORI1' }]], // ORI1 already ingested
  ]);
  const addClient = fakeTranscomClient(FIXTURE_EVENTS);
  const { makeWorker: makeAdd } = require('../workers/add.js');
  const addWorker = makeAdd({
    getDataDb: () => addDataDb,
    makeTranscomClient: () => addClient,
  });

  const add = makeCtx({ db, descriptor: {
    source_id: transcomSrc.source_id,
    view_id: pubResult ? pubResult.view_id : null,
    user_id: 1,
    start_timestamp: '2024-04-01 00:00:00',
    end_timestamp: '2024-04-30 23:59:59',
  } });

  await test('add runs end-to-end against the existing view, deduping known event ids', async () => {
    const r = await addWorker(add.ctx);
    assert(r && r.view_id != null, 'returns the view_id');
    const sql = addDataDb.joined();
    assert(sql.includes('ORI2'), 'inserts the new event');
    assert(!/VALUES[\s\S]*'ORI1'/.test(sql.split('ON CONFLICT')[0]), 'does not re-insert the known event id');
    assert(sql.includes('tmclist IS NULL'), 'add variant only fills missing tmclist');
    assert(addClient.closed, 'closes the client');
  });

  await test('add merges the view start/end window and rebuilds congestion bookkeeping', async () => {
    const { rows } = await db.query(`SELECT metadata FROM views WHERE view_id = $1`, [pubResult.view_id]);
    const meta = parseMeta(rows[0].metadata);
    assert(meta.start_date === '2024-03-01 00:00:00', `merged start (got ${meta.start_date})`);
    assert(meta.end_date === '2024-04-30 23:59:59', `merged end (got ${meta.end_date})`);
    assert(meta.congestion.length === 2, `two month chunks after merge (got ${meta.congestion.length})`);
    assert(add.events.some((e) => /transcom_add:FINAL/.test(e.type)), 'emits transcom_add:FINAL');
  });

  // ════ transcom/event_tmc ════════════════════════════════════════════════
  console.log('-- transcom/event_tmc --');
  const evtTmcSrc = await metadata.createDamaSource({
    name: `transcom_${stamp}_event_tmc`, type: 'transcom_event_tmc', user_id: 1,
    metadata: { transcom_source_id: transcomSrc.source_id },
  }, DAMA_TEST_DB);

  const evtTmcDataDb = fakeDataDb([]);
  const { makeWorker: makeEventTmc } = require('../workers/event_tmc.js');
  const eventTmcWorker = makeEventTmc({
    getDataDb: () => evtTmcDataDb,
    createDamaView: metadata.createDamaView,
  });

  const evt = makeCtx({ db, descriptor: {
    source_id: evtTmcSrc.source_id,
    transcom_source_id: transcomSrc.source_id,
    geom_source_id: geomSrc.source_id,
    start_date: '2024-03-01',
    end_date: '2024-03-31',
    user_id: 1,
  } });

  let evtResult;
  await test('event_tmc creates the expansion table and runs the JSONB-expansion upsert', async () => {
    evtResult = await eventTmcWorker(evt.ctx);
    assert(evtResult && evtResult.view_id != null, 'returns the view_id');
    const sql = evtTmcDataDb.joined();
    assert(sql.includes('UNIQUE (event_id, tmc)'), 'expansion table has the (event_id, tmc) constraint');
    assert(sql.includes("jsonb_each(t.congestion_data->'tmcBounds')"), 'expands tmcBounds');
    assert(sql.includes('ON CONFLICT (event_id, tmc) DO UPDATE'), 'expansion insert upserts');
    assert(sql.includes('ny.npmrds_geom_full'), 'joins the geometry table for shapes');
  });

  await test('event_tmc writes view metadata (cross-links + window) and source metadata.columns', async () => {
    const { rows } = await db.query(`SELECT metadata, table_schema FROM views WHERE view_id = $1`, [evtResult.view_id]);
    const meta = parseMeta(rows[0].metadata);
    assert(rows[0].table_schema === 'transcom', 'expansion view lives in the transcom schema');
    assert(meta.transcom_source_id === transcomSrc.source_id, 'view metadata cross-links transcom_source_id');
    assert(meta.geom_source_id === geomSrc.source_id, 'view metadata records geom_source_id');
    assert(meta.start_date === '2024-03-01' && meta.end_date === '2024-03-31', 'view metadata start/end window');

    const { rows: srcRows } = await db.query(`SELECT metadata FROM sources WHERE source_id = $1`, [evtTmcSrc.source_id]);
    const cols = parseMeta(srcRows[0].metadata).columns;
    const names = (cols || []).map((c) => c.name);
    for (const n of ['event_id', 'tmc', 'delay', 'raw_delay', 'bound_start_date']) {
      assert(names.includes(n), `metadata.columns includes ${n}`);
    }
    assert(evt.events.some((e) => /event_tmc:FINAL/.test(e.type)), 'emits event_tmc:FINAL');
    assert(evt.progress[evt.progress.length - 1] === 1, 'final progress 1');
  });

  // ════ transcom/congestion ═══════════════════════════════════════════════
  console.log('-- transcom/congestion --');

  // Conflation sources/views (the legacy hardcoded 237/236/238 — here real ids).
  const conflNodesSrc = await metadata.createDamaSource({ name: `confl_nodes_${stamp}`, type: 'conflation', user_id: 1 }, DAMA_TEST_DB);
  const conflWaysSrc = await metadata.createDamaSource({ name: `confl_ways_${stamp}`, type: 'conflation', user_id: 1 }, DAMA_TEST_DB);
  const conflV0Src = await metadata.createDamaSource({ name: `confl_v0_${stamp}`, type: 'conflation', user_id: 1 }, DAMA_TEST_DB);
  for (const [src, kind] of [[conflNodesSrc, 'nodes'], [conflWaysSrc, 'ways'], [conflV0Src, 'v0']]) {
    const v = await metadata.createDamaView({ source_id: src.source_id, user_id: 1 }, DAMA_TEST_DB);
    await db.query(`UPDATE views SET version = $1, data_table = $2 WHERE view_id = $3`,
      [`conflation_map_2024_${kind}_v0_6_0`, `conflation.${kind}_2024`, v.view_id]);
  }

  const congestionSrc = await metadata.createDamaSource({
    name: `transcom_${stamp}_congestion`, type: 'transcom_congestion', user_id: 1,
    metadata: { transcom_source_id: transcomSrc.source_id },
  }, DAMA_TEST_DB);

  const congestionDataDb = fakeDataDb([
    [/ST_AsGeoJSON/i, [
      { id: 1, geom: '{"type":"Point","coordinates":[-73.75,42.65]}' },
      { id: 2, geom: '{"type":"Point","coordinates":[-73.749,42.65]}' },
      { id: 3, geom: '{"type":"Point","coordinates":[-73.748,42.65]}' },
    ]],
    [/array_to_json/i, [
      { id: 'w1', osm_fwd: 1, tmc: 'A', node_ids: '[1,2]' },
      { id: 'w2', osm_fwd: 1, tmc: 'B', node_ids: '[2,3]' },
    ]],
    [/avg_speedlimit/i, [
      { tmc: 'A', avg_speedlimit: 55, miles: 1, avg_tt: 65.45, threshold: 30, congestion_level: 'NO2LOW_CONGESTION', directionality: 'AM_PEAK', aadt: 24000, f_system: 1, faciltype: 1, tmclinear: 101, direction: 'E' },
      { tmc: 'B', avg_speedlimit: 55, miles: 1, avg_tt: 65.45, threshold: 30, congestion_level: 'NO2LOW_CONGESTION', directionality: 'AM_PEAK', aadt: 24000, f_system: 1, faciltype: 1, tmclinear: 101, direction: 'E' },
    ]],
    [/speed_pctl_85/i, [{ tmc: 'A', freeflow_tt: 60 }, { tmc: 'B', freeflow_tt: 60 }]],
    [/DISTINCT ON \(trans\.event_id\)/i, [{
      event_id: 'ORI1', node_id: '1', conflation_way_id: 'w1', duration: null,
      is_construction: false, bad_dates: false,
      open_time: '2024-03-05 08:20:00', close_time: '2024-03-05 10:10:00',
    }]],
    [/SELECT DISTINCT county_code/i, [{ county_code: '36001' }]],
  ]);

  const { makeWorker: makeCongestion } = require('../workers/congestion.js');
  const congestionWorker = makeCongestion({
    getDataDb: () => congestionDataDb,
    getChDb: () => fakeChDb(),
    createDamaView: metadata.createDamaView,
  });

  const cong = makeCtx({ db, descriptor: {
    source_id: congestionSrc.source_id,
    transcom_source_id: transcomSrc.source_id,
    transcom_view_id: pubResult ? pubResult.view_id : null,
    start_date: '2024-03-01',
    end_date: '2024-03-31',
    user_id: 1,
    conflation_nodes_source_id: conflNodesSrc.source_id,
    conflation_ways_source_id: conflWaysSrc.source_id,
    conflation_v0_source_id: conflV0Src.source_id,
  } });

  let congResult;
  await test('congestion runs end-to-end with stub graph/CH deps', async () => {
    congResult = await congestionWorker(cong.ctx);
    assert(congResult && congResult.view_id != null, 'returns the view_id');
    const sql = congestionDataDb.joined();
    assert(/CREATE TABLE IF NOT EXISTS transcom_congestion\./.test(sql), 'creates the congestion table');
    assert(sql.includes('event_id TEXT PRIMARY KEY'), 'congestion table keyed by event_id');
  });

  await test('congestion view-reuse: passing view_id adds to the existing view (no new view created)', async () => {
    const { rows: [before] } = await db.query(
      `SELECT count(*) n FROM views WHERE source_id = $1`, [congResult.source_id]);
    const rerun = makeCtx({ db, descriptor: { ...cong.ctx.task.descriptor, view_id: congResult.view_id } });
    const rerunResult = await congestionWorker(rerun.ctx);
    assert(rerunResult.view_id === congResult.view_id, `reuses view ${congResult.view_id} (got ${rerunResult.view_id})`);
    const { rows: [after] } = await db.query(
      `SELECT count(*) n FROM views WHERE source_id = $1`, [congResult.source_id]);
    assert(Number(after.n) === Number(before.n), `view count unchanged (${before.n} → ${after.n})`);
  });

  await test('congestion upserts the EXACT legacy congestion_data shape per event', async () => {
    const upsert = congestionDataDb.calls.find((c) => /ON CONFLICT \(event_id\)/.test(c.sql) && c.values);
    assert(upsert, 'records a congestion upsert with values');
    assert(upsert.values[0] === 'ORI1', `upserts event ORI1 (got ${upsert.values[0]})`);
    const data = typeof upsert.values[1] === 'string' ? JSON.parse(upsert.values[1]) : upsert.values[1];
    // The EXACT wire shape: legacy incidents carry no way_id column, so the
    // (undefined) way_id property disappears in JSON — 13 keys on the wire.
    const keys = Object.keys(data).sort();
    // legacy keys + the M6 probe-coverage addition (methodology decision 2026-06-10)
    const expected = ['branches', 'dates', 'delay', 'endTime', 'eventTmcs', 'node_id',
      'probe', 'rawDelay', 'rawTmcDelayData', 'rawVehicleDelay', 'startTime',
      'tmcBounds', 'tmcDelayData', 'vehicleDelay'].sort();
    assert(JSON.stringify(keys) === JSON.stringify(expected), `congestion_data keys exact (got ${keys.join(',')})`);
    assert(data.dates.includes('2024-03-05'), 'dates carried');
    assert(data.delay > 0, 'fixture incident produces delay');
  });

  await test('congestion copies results back onto the events table (vehicle_delay, cost = 20x raw)', async () => {
    const sql = congestionDataDb.joined();
    assert(sql.includes("vehicle_delay = (m.congestion_data->>'vehicleDelay')::NUMERIC"), 'events vehicle_delay update');
    assert(sql.includes("cost = 20 * (m.congestion_data->>'rawVehicleDelay')::NUMERIC"), 'events cost update');
  });

  await test('congestion marks the transcom view month chunk available and writes its own view window', async () => {
    const { rows } = await db.query(`SELECT metadata FROM views WHERE view_id = $1`, [pubResult.view_id]);
    const meta = parseMeta(rows[0].metadata);
    const march = meta.congestion.find((c) => c.start_date === '2024-03-01');
    assert(march && march.is_congestion_data_available === true, 'march chunk flipped to available');

    const { rows: cgRows } = await db.query(`SELECT metadata, table_schema FROM views WHERE view_id = $1`, [congResult.view_id]);
    const cgMeta = parseMeta(cgRows[0].metadata);
    assert(cgRows[0].table_schema === 'transcom_congestion', 'congestion view schema');
    assert(cgMeta.start_date === '2024-03-01' && cgMeta.end_date === '2024-03-31', 'congestion view start/end');
  });

  await test('congestion writes source metadata.columns and finishes cleanly', async () => {
    const { rows } = await db.query(`SELECT metadata FROM sources WHERE source_id = $1`, [congestionSrc.source_id]);
    const cols = parseMeta(rows[0].metadata).columns;
    assert(Array.isArray(cols), 'metadata.columns written');
    assert(JSON.stringify(cols.map((c) => c.name)) === JSON.stringify(['event_id', 'congestion_data']), 'congestion columns');
    assert(cong.events.some((e) => /transcom_congestion:FINAL/.test(e.type)), 'emits transcom_congestion:FINAL');
    assert(cong.progress[cong.progress.length - 1] === 1, 'final progress 1');
  });

  console.log(`\n  ${passed} passing, ${failed} failing\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => { console.error('Test runner error:', err); process.exit(1); });
