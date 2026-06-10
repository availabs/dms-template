/**
 * Integration test (Phase 2): the npmrds staged workers
 * (provision → add[+metadata] → replace → remove).
 *
 * Workers are built via makeWorkers(deps): ClickHouse and the physical-PG
 * side are injected. This test injects FAKES — no live ClickHouse, no
 * PostGIS. It asserts each worker issues the load-bearing SQL (captured from
 * the stubs) and writes every metadata key downstream consumers read
 * (npmrds_raw_view_id_to_year, npmrds_meta_layer_view_id, tiles, columns…).
 *
 * Node/sqlite harness. Run: node data-types/npmrds/tests/worker.integration.js
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

// ClickHouse stub: records every exec/query, answers SELECTs from canned data.
function fakeChDb(canned) {
  const execSql = [];
  const querySql = [];
  return {
    execSql, querySql,
    async exec({ query }) { execSql.push(query); return {}; },
    async query({ query }) {
      querySql.push(query);
      const rows = canned(query) || [];
      return { json: async () => rows };
    },
    joined() { return execSql.concat(querySql).join('\n;\n'); },
  };
}

// Physical-Postgres stub (npmrds_geometry / temp schemas / spatial join).
function fakePgDb(canned) {
  const sql = [];
  return {
    type: 'postgres', sql,
    async query(text, params) {
      sql.push(typeof text === 'string' ? text : text.text);
      const rows = canned ? (canned(text, params) || []) : [];
      return { rows, rowCount: rows.length };
    },
    joined() { return sql.join('\n;\n'); },
  };
}

async function runTests() {
  console.log(`\n=== npmrds workers (${DAMA_TEST_DB}) ===\n`);
  await setup();

  const { getDb } = require('@availabs/dms-server/src/db');
  const metadata = require('@availabs/dms-server/src/dama/upload/metadata');
  const { makeWorkers } = require('../worker.js');
  const db = getDb(DAMA_TEST_DB);
  const stamp = Date.now();
  const name = `npmrds_wrk_${stamp}`;

  const mkCtx = (descriptor, deps = {}) => {
    const events = [];
    const progress = { last: 0 };
    return {
      events, progress,
      ctx: {
        pgEnv: DAMA_TEST_DB, db,
        task: { task_id: 1, descriptor },
        dispatchEvent: async (type, message, payload) => { events.push({ type, message, payload }); },
        updateProgress: async (p) => { progress.last = p; },
      },
    };
  };

  // ── Fixtures: cross-referenced sources/views ────────────────────────────────
  const tmcSpeedSrc = await metadata.createDamaSource({ name: `tmc_speed_${stamp}`, type: 'tmc_speed', user_id: 1 }, DAMA_TEST_DB);
  const tmcSpeedView = await metadata.createDamaView({ source_id: tmcSpeedSrc.source_id, user_id: 1 }, DAMA_TEST_DB);
  await db.query(`UPDATE views SET data_table = $1 WHERE view_id = $2`, ['tmc_speed.speed_tbl', tmcSpeedView.view_id]);
  const mpoSrc = await metadata.createDamaSource({ name: `mpo_${stamp}`, type: 'mpo_boundaries', user_id: 1 }, DAMA_TEST_DB);
  const mpoView = await metadata.createDamaView({ source_id: mpoSrc.source_id, user_id: 1 }, DAMA_TEST_DB);
  await db.query(`UPDATE views SET data_table = $1 WHERE view_id = $2`, ['mpo.bounds_tbl', mpoView.view_id]);

  const prodSrc = await metadata.createDamaSource({ name, type: 'npmrds', user_id: 1 }, DAMA_TEST_DB);
  const metaSrc = await metadata.createDamaSource({
    name: `${name}_tmc_meta`, type: 'npmrds_meta', user_id: 1,
    metadata: { npmrds_source_id: prodSrc.source_id },
  }, DAMA_TEST_DB);
  await db.query(`UPDATE sources SET metadata = $1 WHERE source_id = $2`,
    [JSON.stringify({ npmrds_tmc_meta_source_id: metaSrc.source_id }), prodSrc.source_id]);

  // ── 1. provision ────────────────────────────────────────────────────────────
  const workersCommon = () => makeWorkers({
    getChDb: () => provCh,
    getPgDb: () => provPg,
    createDamaView: metadata.createDamaView,
    chInsertRows: async () => {},
  });
  const provCh = fakeChDb(() => []);
  const provPg = fakePgDb();

  let prov;
  await test('provision creates the 3 views, CH tables, PG geometry table, and cross-link metadata', async () => {
    const { ctx, progress } = mkCtx({
      source_id: prodSrc.source_id,
      npmrds_meta_source_id: metaSrc.source_id,
      name, user_id: 1, email: 'x@y.z',
      tmcSpeedViewId: tmcSpeedView.view_id, tmcSpeedSourceId: tmcSpeedSrc.source_id,
      mpoBoundariesViewId: mpoView.view_id, mpoBoundariesSourceId: mpoSrc.source_id,
    });
    prov = await workersCommon().provision(ctx);
    assert(prov && prov.view_id != null, 'returns the prod view_id');
    assert(prov.npmrds_meta_view_id != null && prov.npmrds_geometry_view_id != null, 'returns the meta + geometry view ids');
    assert(progress.last === 1, 'progress reaches 1');

    // prod view row + cross-links
    const { rows: [pv] } = await db.query(`SELECT * FROM views WHERE view_id = $1`, [prov.view_id]);
    assert(pv.table_schema === 'clickhouse.npmrds', `prod view table_schema (got ${pv.table_schema})`);
    assert(pv.table_name === `s${prodSrc.source_id}_v${prov.view_id}_${name}`.toLowerCase(), `prod view table_name (got ${pv.table_name})`);
    const pvm = parseMeta(pv.metadata);
    assert(pvm.npmrds_meta_view_id === prov.npmrds_meta_view_id, 'prod view → npmrds_meta_view_id');
    assert(pvm.npmrds_geometry_view_id === prov.npmrds_geometry_view_id, 'prod view → npmrds_geometry_view_id');
    assert(pvm.npmrds_tmc_speed_view_id === tmcSpeedView.view_id, 'prod view → npmrds_tmc_speed_view_id');
    assert(pvm.npmrds_tmc_speed_source_id === tmcSpeedSrc.source_id, 'prod view → npmrds_tmc_speed_source_id');
    assert(pvm.npmrds_mpo_boundaries_view_id === mpoView.view_id, 'prod view → npmrds_mpo_boundaries_view_id');
    assert(pvm.npmrds_mpo_boundaries_source_id === mpoSrc.source_id, 'prod view → npmrds_mpo_boundaries_source_id');
    assert(JSON.stringify(pvm.npmrds_raw_view_id_to_year) === '{}', 'prod view starts with an empty raw→year map');
    assert(pvm.is_clickhouse_table === 1, 'prod view is_clickhouse_table');

    // meta view row
    const { rows: [mv] } = await db.query(`SELECT * FROM views WHERE view_id = $1`, [prov.npmrds_meta_view_id]);
    assert(mv.table_schema === 'clickhouse.npmrds_meta', `meta view table_schema (got ${mv.table_schema})`);
    assert(mv.version === 'clickhouse', `meta view version (got ${mv.version})`);
    const mvm = parseMeta(mv.metadata);
    assert(mvm.npmrds_view_id === prov.view_id && mvm.npmrds_geometry_view_id === prov.npmrds_geometry_view_id, 'meta view cross-links');

    // geometry view row
    const { rows: [gv] } = await db.query(`SELECT * FROM views WHERE view_id = $1`, [prov.npmrds_geometry_view_id]);
    assert(gv.table_schema === 'npmrds_geometry', `geometry view table_schema (got ${gv.table_schema})`);
    assert(gv.version === 'pg', `geometry view version (got ${gv.version})`);
    const gvm = parseMeta(gv.metadata);
    assert(gvm.npmrds_view_id === prov.view_id && gvm.npmrds_meta_view_id === prov.npmrds_meta_view_id, 'geometry view cross-links');
    assert(gvm.is_clickhouse_table === 0, 'geometry view is_clickhouse_table = 0');

    // CH DDL
    const chSql = provCh.joined();
    for (const dbName of ['npmrds', 'npmrds_meta', 'temp']) {
      assert(chSql.includes(`CREATE DATABASE IF NOT EXISTS ${dbName}`), `creates CH database ${dbName}`);
    }
    assert(/CREATE TABLE IF NOT EXISTS npmrds\.s\d+_v\d+_/.test(chSql), 'creates the CH prod table');
    assert(chSql.includes('view_id Int64'), 'prod table carries the view_id provenance column');
    assert(/CREATE TABLE IF NOT EXISTS npmrds_meta\.s\d+_v\d+_.*_tmc_meta/.test(chSql), 'creates the CH meta table');

    // PG DDL
    const pgSql = provPg.joined();
    assert(pgSql.includes('CREATE SCHEMA IF NOT EXISTS npmrds_geometry'), 'creates the npmrds_geometry schema');
    assert(/CREATE TABLE IF NOT EXISTS npmrds_geometry\.s\d+_v\d+_.*_geometry/.test(pgSql), 'creates the all-years geometry table');
    assert(pgSql.includes('USING GIST (wkb_geometry)'), 'creates the GIST index');
  });

  await test('provision writes metadata.columns on BOTH sources (Table-page contract)', async () => {
    const { rows: [p] } = await db.query(`SELECT metadata FROM sources WHERE source_id = $1`, [prodSrc.source_id]);
    const pCols = parseMeta(p.metadata).columns;
    assert(Array.isArray(pCols) && pCols.length > 0, 'prod source metadata.columns non-empty');
    const pNames = pCols.map((c) => c.name);
    for (const n of ['tmc', 'date', 'epoch', 'travel_time_all_vehicles', 'state', 'view_id']) {
      assert(pNames.includes(n), `prod columns include ${n}`);
    }
    assert(pCols.every((c) => c.name && c.display_name && c.type), 'prod columns have name/display_name/type');

    const { rows: [m] } = await db.query(`SELECT metadata FROM sources WHERE source_id = $1`, [metaSrc.source_id]);
    const mCols = parseMeta(m.metadata).columns;
    assert(Array.isArray(mCols) && mCols.length > 0, 'meta source metadata.columns non-empty');
    const mNames = mCols.map((c) => c.name);
    for (const n of ['tmc', 'f_system', 'aadt', 'directionality', 'congestion_level', 'mpo_code', 'mpo_name', 'is_interstate', 'year']) {
      assert(mNames.includes(n), `meta columns include ${n}`);
    }
    assert(parseMeta(m.metadata).npmrds_source_id === prodSrc.source_id, 'meta source keeps npmrds_source_id');
  });

  // ── 2. add (+ metadata phase) ───────────────────────────────────────────────
  // Raw companion fixtures (what npmrds_raw publishes).
  const rawSrc = await metadata.createDamaSource({ name: `raw_${stamp}`, type: 'npmrds_raw', user_id: 1 }, DAMA_TEST_DB);
  const tmcIdView = await metadata.createDamaView({ source_id: rawSrc.source_id, user_id: 1 }, DAMA_TEST_DB);
  await db.query(`UPDATE views SET data_table = $1 WHERE view_id = $2`,
    ['clickhouse.npmrds_raw_tmc_identification.tmcid_tbl', tmcIdView.view_id]);
  const rawView = await metadata.createDamaView({ source_id: rawSrc.source_id, user_id: 1 }, DAMA_TEST_DB);
  await db.query(`UPDATE views SET data_table = $1, metadata = $2 WHERE view_id = $3`, [
    'clickhouse.npmrds_raw.raw_tbl',
    JSON.stringify({ start_date: '2023-01-10', end_date: '2023-02-10', tmc_identification_view_id: tmcIdView.view_id }),
    rawView.view_id,
  ]);

  const TMC = '104+04099';
  const chMetaRow = {
    tmc: TMC, road: 'I-87', direction: 'NORTHBOUND', intersection: '', state: 'NY',
    county: 'ALBANY', zip: '12206', start_latitude: '42.68', start_longitude: '-73.82',
    end_latitude: '42.70', end_longitude: '-73.80', miles: '1.0', road_order: '1',
    timezone_name: 'EASTERN', type: 'P1', country: 'USA', tmclinear: '1', frc: '1',
    border_set: '', f_system: '1', urban_code: '63217', faciltype: '1', structype: '1',
    thrulanes: '2', route_numb: '87', route_sign: '2', route_qual: '1', altrtename: '',
    aadt: '120000', aadt_singl: '5000', aadt_combi: '7000', nhs: '1', nhs_pct: '100',
    strhnt_typ: '', strhnt_pct: '', truck: '1', isprimary: '1',
    active_start_date: '2023-01-01', active_end_date: '2024-01-01',
    thrulanes_unidir: '2', aadt_unidir: '60000', aadt_singl_unidir: '2500',
    aadt_combi_unidir: '3500', congestion_level: 'MODERATE_CONGESTION', year: '2023',
    avg_speedlimit: null, directionality: 'AM_PEAK', avg_vehicle_occupancy: '1.9',
    state_code: '36', county_code: '36001', region_code: '1', mpo_code: null,
    ua_code: '63217', state_name: 'NY', county_name: 'ALBANY',
    ua_name: 'New York--Jersey City--Newark, NY--NJ', is_interstate: true,
    wkb_geometry: 'MULTILINESTRING((0 0,1 1))',
  };
  const enrichedPgRow = { ...chMetaRow, ogc_fid: 1, year: 2023, avg_speedlimit: 65, mpo_code: 'NYMTC', mpo_name: 'NYMTC MPO' };

  const addCh = fakeChDb((q) => {
    if (q.includes('distinct(tmc)')) return [{ tmc: TMC }];
    if (q.includes('functionalClass')) return [{ miles: 1, functionalClass: 'FREEWAY' }];
    if (q.includes('timeBinNum')) return [{ tt: 60 }, { tt: 62 }];
    if (q.includes('substring(active_start_date, 1, 4)')) {
      return [{ tmc: TMC, year: '2023', state_name: 'NY', county_name: 'ALBANY', ua_code: '63217' }];
    }
    if (q.includes('SELECT * FROM') && q.includes('year = 2023')) return [chMetaRow];
    return [];
  });
  const addPg = fakePgDb((text) => {
    if (/SELECT \* FROM npmrds_geometry\./.test(text)) return [enrichedPgRow];
    return [];
  });
  const chInserts = [];
  const addWorkers = makeWorkers({
    getChDb: () => addCh,
    getPgDb: () => addPg,
    createDamaView: metadata.createDamaView,
    chInsertRows: async (chDb, table, rows) => { chInserts.push({ table, rows }); },
  });

  let addResult, addEvents, addProgress;
  await test('add runs end-to-end with injected fakes (raw→prod, enrichment, spatial round-trip, tiles)', async () => {
    const { ctx, events, progress } = mkCtx({
      source_id: prodSrc.source_id,
      view_id: prov.view_id,
      npmrds_raw_view_ids: [rawView.view_id],
      startDate: '2023-01-10', endDate: '2023-02-10',
      user_id: 1, email: 'x@y.z',
      prodURL: 'https://graph.example.org',
    });
    addResult = await addWorkers.add(ctx);
    addEvents = events; addProgress = progress;
    assert(addResult && addResult.view_id === prov.view_id, 'returns the prod view_id');
    assert(addResult.year === 2023, `derives year 2023 from the raw view start_date (got ${addResult.year})`);
  });

  await test('add issues the exact raw→prod INSERT (column mapping + view_id stamp) and OPTIMIZE', async () => {
    const sql = addCh.joined();
    assert(sql.includes('INSERT INTO npmrds.s'), 'inserts into the CH prod table');
    assert(sql.replace(/\s+/g, ' ').includes(
      'tmc, date, epoch, travel_time_all_vehicles, travel_time_passenger_vehicles, travel_time_freight_trucks, '
      + 'data_density_all_vehicles, data_density_passenger_vehicles, data_density_freight_trucks, state, '
      + `${rawView.view_id} AS view_id FROM npmrds_raw.raw_tbl`
    ), 'exact legacy column mapping with the raw view_id stamp');
    assert(sql.includes('SETTINGS max_memory_usage = 0'), 'unlimited-memory insert');
    assert(/OPTIMIZE TABLE npmrds\.s\d+_v\d+_.* FINAL DEDUPLICATE BY tmc, date, epoch/.test(sql), 'OPTIMIZE FINAL DEDUPLICATE');
  });

  await test('metadata phase: temp CH enrichment table + FULL OUTER JOIN insert + year delete cycles', async () => {
    const sql = addCh.joined();
    assert(sql.includes(`CREATE TABLE IF NOT EXISTS temp.meta_${tmcIdView.view_id}_2023`), 'creates temp.meta_{tmcIdViewId}_{year}');
    assert(sql.includes('FULL OUTER JOIN'), 'tmc_identification FULL OUTER JOIN temp enrichment');
    assert((sql.match(/DELETE WHERE year = 2023/g) || []).length >= 2, 'deletes the year from CH meta before insert AND before backfill');
    assert(sql.includes(`DROP TABLE IF EXISTS temp.meta_${tmcIdView.view_id}_2023`), 'drops the temp table');
  });

  await test('metadata phase: enrichment rows carry lookup-derived codes + directionality', async () => {
    const tempInsert = chInserts.find((i) => i.table === `temp.meta_${tmcIdView.view_id}_2023`);
    assert(tempInsert, 'inserts enrichment rows into the temp CH table');
    const row = tempInsert.rows[0];
    assert(row.state_code === '36', `state_code 36 (got ${row.state_code})`);
    assert(row.county_code === '36001', `county_code 36001 (got ${row.county_code})`);
    assert(row.region_code === 1, `region_code 1 (got ${row.region_code})`);
    assert(row.ua_name && /New York/.test(row.ua_name), 'ua_name from uaCodeToUaName');
    assert(['EVEN_DIST', 'AM_PEAK', 'PM_PEAK'].includes(row.directionality), 'directionality computed');
    assert(/CONGESTION/.test(row.congestion_level), 'congestion_level computed');
    assert(row.mpo_code === null, 'mpo_code deferred to the PG spatial join');
  });

  await test('metadata phase: PG round-trip — temp table, batch insert, spatial join, per-year copy', async () => {
    const sql = addPg.joined();
    assert(sql.includes('CREATE SCHEMA IF NOT EXISTS temp'), 'creates the temp schema');
    assert(/CREATE TABLE temp\.s\d+_v\d+_.*_tmc_meta/.test(sql), 'creates the PG temp meta table');
    assert(/INSERT INTO temp\.s\d+_v\d+_.*_tmc_meta/.test(sql), 'batch-inserts CH rows into the temp table');
    assert(/DELETE FROM npmrds_geometry\.s\d+_v\d+_.*_geometry WHERE year = 2023/.test(sql), 'deletes the year from the all-years geometry table');
    assert(sql.includes('JOIN LATERAL'), 'spatial join INSERT runs');
    assert(sql.includes('tmc_speed.speed_tbl'), 'joins the tmc_speed data_table resolved from prod view metadata');
    assert(sql.includes('mpo.bounds_tbl'), 'laterals the MPO boundaries data_table');
    assert(/CREATE TABLE IF NOT EXISTS npmrds_geometry\.s\d+_v\d+_.*_geometry/.test(sql), 'creates the per-year layer table');
    assert(sql.includes('ST_SETSRID(wkb_geometry, 4326)'), 'fixes the SRID on the per-year table');
  });

  await test('metadata phase: CH meta backfilled from the enriched PG rows', async () => {
    const backfill = chInserts.find((i) => /^npmrds_meta\./.test(i.table));
    assert(backfill, 'second CH meta insert (backfill) happens');
    assert(backfill.rows[0].mpo_code === 'NYMTC', 'backfill rows carry the spatial-join mpo_code');
    assert(backfill.rows[0].avg_speedlimit === 65, 'backfill rows carry the joined avg_speedlimit');
  });

  let layerViewId;
  await test('per-year layer view created with year, tiles, version "<year> pg"', async () => {
    const { rows } = await db.query(`SELECT * FROM views WHERE source_id = $1`, [metaSrc.source_id]);
    const layer = rows.map((r) => ({ ...r, metadata: parseMeta(r.metadata) }))
      .find((r) => r.metadata.year === 2023);
    assert(layer, 'a per-year layer view exists on the meta source');
    layerViewId = layer.view_id;
    assert(layer.version === '2023 pg', `layer view version (got ${layer.version})`);
    assert(layer.table_schema === 'npmrds_geometry', 'layer view schema');
    assert(layer.metadata.npmrds_view_id === prov.view_id, 'layer view → npmrds_view_id');
    assert(layer.metadata.npmrds_meta_view_id === prov.npmrds_meta_view_id, 'layer view → npmrds_meta_view_id');
    assert(layer.metadata.npmrds_geometry_view_id === prov.npmrds_geometry_view_id, 'layer view → npmrds_geometry_view_id');
    const tiles = layer.metadata.tiles;
    assert(tiles && tiles.sources.length === 1 && tiles.layers.length === 1, 'tiles spec written');
    assert(tiles.sources[0].source.tiles[0].includes(`/dama-admin/${DAMA_TEST_DB}/tiles/${layerViewId}/`), 'tile URL targets the layer view');
    assert(tiles.sources[0].source.tiles[0].includes('filter=year=2023'), 'tile URL filters the year');
  });

  await test('prod view + source metadata: raw→year map, dates, deps, npmrds_meta_layer_view_id', async () => {
    const { rows: [pv] } = await db.query(`SELECT * FROM views WHERE view_id = $1`, [prov.view_id]);
    const pvm = parseMeta(pv.metadata);
    assert(pvm.start_date === '2023-01-10' && pvm.end_date === '2023-02-10', 'start/end dates persisted (scheduling seam)');
    assert(JSON.stringify(pvm.npmrds_raw_view_ids) === JSON.stringify([rawView.view_id]), 'npmrds_raw_view_ids');
    assert(pvm.npmrds_raw_view_id_to_year[String(rawView.view_id)] === 2023, 'npmrds_raw_view_id_to_year');
    const deps = typeof pv.view_dependencies === 'string' ? JSON.parse(pv.view_dependencies) : pv.view_dependencies;
    assert(Array.isArray(deps) && deps[0] === rawView.view_id, 'view_dependencies set to the raw view ids');

    const { rows: [src] } = await db.query(`SELECT metadata FROM sources WHERE source_id = $1`, [prodSrc.source_id]);
    const sm = parseMeta(src.metadata);
    assert(sm.npmrds_meta_layer_view_id && sm.npmrds_meta_layer_view_id['2023'] === layerViewId,
      `source npmrds_meta_layer_view_id {2023: ${layerViewId}} (got ${JSON.stringify(sm.npmrds_meta_layer_view_id)})`);
    assert(Array.isArray(sm.columns), 'source metadata.columns survives the add');
  });

  await test('add reports progress to completion and emits a FINAL event', async () => {
    assert(addProgress.last === 1, `final progress 1 (got ${addProgress.last})`);
    assert(addEvents.some((e) => /FINAL/.test(e.type)), 'emits a FINAL event');
  });

  // ── 3. replace ──────────────────────────────────────────────────────────────
  const rawView2 = await metadata.createDamaView({ source_id: rawSrc.source_id, user_id: 1 }, DAMA_TEST_DB);
  await db.query(`UPDATE views SET data_table = $1, metadata = $2 WHERE view_id = $3`, [
    'clickhouse.npmrds_raw.raw_tbl_v2',
    JSON.stringify({ start_date: '2023-01-01', end_date: '2023-12-31', tmc_identification_view_id: tmcIdView.view_id }),
    rawView2.view_id,
  ]);

  await test('replace drops the 12 month partitions and swaps the raw views', async () => {
    const repCh = fakeChDb(() => []);
    const repWorkers = makeWorkers({
      getChDb: () => repCh, getPgDb: () => fakePgDb(),
      createDamaView: metadata.createDamaView, chInsertRows: async () => {},
    });
    const { ctx } = mkCtx({
      source_id: prodSrc.source_id, view_id: prov.view_id,
      npmrds_raw_add_view_ids: [rawView2.view_id],
      npmrds_raw_remove_view_ids: [rawView.view_id],
      replace_year: 2023,
      startDate: '2023-01-01', endDate: '2023-12-31',
      user_id: 1, email: 'x@y.z',
    });
    await repWorkers.replace(ctx);

    const sql = repCh.joined();
    for (let m = 1; m <= 12; m++) {
      const pid = `2023${String(m).padStart(2, '0')}`;
      assert(sql.includes(`DROP PARTITION '${pid}'`), `drops partition ${pid}`);
    }
    assert(sql.replace(/\s+/g, ' ').includes(`${rawView2.view_id} AS view_id FROM npmrds_raw.raw_tbl_v2`), 'inserts the replacement raw view');

    const { rows: [pv] } = await db.query(`SELECT * FROM views WHERE view_id = $1`, [prov.view_id]);
    const pvm = parseMeta(pv.metadata);
    assert(JSON.stringify(pvm.npmrds_raw_view_ids) === JSON.stringify([rawView2.view_id]),
      `npmrds_raw_view_ids swapped (got ${JSON.stringify(pvm.npmrds_raw_view_ids)})`);
    assert(pvm.npmrds_raw_view_id_to_year[String(rawView2.view_id)] === 2023, 'new view mapped to the replace year');
    assert(!(String(rawView.view_id) in pvm.npmrds_raw_view_id_to_year),
      'removed view dropped from the raw→year map (legacy .forEach bug fixed)');
  });

  // ── 4. remove ───────────────────────────────────────────────────────────────
  await test('remove deletes by view_id, optimizes, and cleans the orphaned year from meta/geometry/layer', async () => {
    const remCh = fakeChDb(() => []);
    const remPg = fakePgDb();
    const remWorkers = makeWorkers({
      getChDb: () => remCh, getPgDb: () => remPg,
      createDamaView: metadata.createDamaView, chInsertRows: async () => {},
    });
    const { ctx } = mkCtx({
      source_id: prodSrc.source_id, view_id: prov.view_id,
      npmrds_raw_removed_view_ids: [rawView2.view_id],
      user_id: 1,
    });
    await remWorkers.remove(ctx);

    const chSql = remCh.joined();
    assert(chSql.includes(`DELETE WHERE view_id = ${rawView2.view_id}`), 'CH prod delete by view_id');
    assert(chSql.includes('SETTINGS max_memory_usage = 0, max_execution_time = 0, mutations_sync = 2'), 'legacy mutation settings');
    assert(/OPTIMIZE TABLE .* FINAL DEDUPLICATE BY tmc, date, epoch/.test(chSql), 'optimize after delete');
    assert(chSql.includes('DELETE WHERE year = 2023'), 'CH meta year cleanup (year no longer referenced)');

    const pgSql = remPg.joined();
    assert(/DELETE FROM npmrds_geometry\..*_geometry WHERE year = 2023/.test(pgSql), 'PG geometry + layer year cleanup');

    const { rows: [pv] } = await db.query(`SELECT * FROM views WHERE view_id = $1`, [prov.view_id]);
    const pvm = parseMeta(pv.metadata);
    assert(pvm.npmrds_raw_view_ids.length === 0, 'npmrds_raw_view_ids emptied');
    assert(Object.keys(pvm.npmrds_raw_view_id_to_year).length === 0, 'raw→year map emptied');
  });

  console.log(`\n  ${passed} passing, ${failed} failing\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => { console.error('Test runner error:', err); process.exit(1); });
