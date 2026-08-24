/**
 * Integration test: the pm3 publish worker.
 *
 * Built via makeWorker(deps): ClickHouse is a stub, and all PHYSICAL data-table
 * SQL (the pm3 schema table) goes through an injected recording `dataDb` so the
 * sqlite harness never has to execute Postgres-only DDL. The real sqlite db
 * handles the data_manager side (sources/views/tasks).
 *
 * Asserts the pm3 semantics that differ from map21:
 *   - ONE VIEW PER YEAR: a publish of N years creates N views, each `version` = the
 *     4-digit year, each with its own metrics table, all column-identical. The
 *     append path (`descriptor.view_id`) is gone and is refused;
 *   - the `all_years` union view is opt-in, reuses its row across rebuilds, and
 *     refuses to union members whose columns disagree;
 *   - output table lives in the `pm3` schema with a named UNIQUE(tmc, year)
 *     constraint + GIST geometry index (map21: gis_datasets, UNIQUE(tmc));
 *   - per-metric upserts (METRIC_WRITES_DB=true): one ALTER + one
 *     INSERT ... ON CONFLICT ON CONSTRAINT per metric per TMC, 11 metrics;
 *   - lowercase, metric-prefixed columns (no FHWA renames);
 *   - permissive checkMeta: a TMC row map21 would reject is still processed;
 *   - views.metadata gets tiles + rawViewIdsUsed; source metadata.columns
 *     written (lowercase descriptors);
 *   - no etl_contexts anywhere.
 *
 * Run: node data-types/pm3/tests/worker.integration.js
 */
const DAMA_TEST_DB = process.env.DAMA_TEST_DB || 'dama-sqlite-test';

let passed = 0, failed = 0;
function assert(c, m) { if (!c) throw new Error(`Assertion failed: ${m}`); }
async function test(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.log(`  ✗ ${name}: ${err.message}`); failed++; }
}
const parseJson = (v) => (typeof v === 'string' ? JSON.parse(v) : (v || {}));

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

// ── Fixtures ─────────────────────────────────────────────────────────────────
const TMC = '104+04107';
// Extra TMCs so the concurrent phase runs for real: the first is the serial
// warm-up, the rest go through runPool.
const EXTRA_TMCS = ['104+04108', '104+04109', '104+04110', '104+04111'];
const ALL_TMCS = [TMC, ...EXTRA_TMCS];

// Deliberately a row map21's strict checkMeta REJECTS (urban_code null,
// isprimary '0') — pm3 must still process it end-to-end.
const TMC_META_ROW = {
  tmc: TMC,
  urban_code: null,
  isprimary: '0',
  direction: 'N',
  directionalaadt: 5000,
  directionalaadttruck: 300,
  avgvehicleoccupancytruck: 10.7,
  avg_speedlimit: 55,
  miles: 1.23,
  avg_vehicle_occupancy: 1.7,
  functionalclass: 'FREEWAY',
  congestion_level: 'NO2LOW_CONGESTION',
  directionality: 'AM_PEAK',
  nhs: '0',
  nhs_pct: 100,
  f_system: 1,
  faciltype: 1,
  state_code: 36,
  active_start_date: '2023-01-01',
  region_code: 'R1',
  county: 'Albany',
  ua_name: 'Albany',
  mpo_code: 'M1',
  mpo_name: 'CDTC',
  wkb_geometry: '0105000020E61000...',
  year: 2023,
};

const SPEEDS = [60, 55, 50, 45, 40, 35, 30, 25, 20, 65];

function stubChDb() {
  const queries = [];
  return {
    queries,
    async query({ query }) {
      queries.push(query);
      if (/distinct\(tmc\)/i.test(query)) {
        return { json: async () => ({ rows: ALL_TMCS.length, data: ALL_TMCS.map((tmc) => ({ tmc })) }) };
      }
      if (/avg_speed_all_vehicles/.test(query)) {
        return { json: async () => ({
          rows: SPEEDS.length,
          data: SPEEDS.map((s) => ({ avg_speed_all_vehicles: s })),
        }) };
      }
      // binned travel-time rows for lottr/tttr/phed
      return { json: async () => ({
        rows: 2,
        data: [
          { tmc: TMC, date: '2023-03-06', dow: 1, month: 3, timeBinNum: 30, tt: 200 },
          { tmc: TMC, date: '2023-03-06', dow: 1, month: 3, timeBinNum: 31, tt: 500 },
        ],
      }) };
    },
  };
}

// Recording fake for all PHYSICAL pm3-table SQL. Answers the TMC meta SELECT
// with the fixture row and the metrics-table column introspection with a
// representative metric-column list; records everything else.
//
// `type: 'postgres'` so the Postgres-only paths (the metrics⋈geometry view and
// the npmrds_meta GIST index) actually run and can be asserted.
//
// The metrics table's columns come from the metric registry, exactly as the worker's bulk pre-create
// builds them — the fake has to model a table that pre-create has run against, or the worker's
// "declared column missing" guard fires. A short hand-written list would only ever test that guard.
// FAKE_METRIC_COLUMNS stays as a spot check: one column from each of the three column shapes.
const { pm3MetricColumnNames } = require('../worker.js');
const { pm3ViewColumnNames } = require('../helpers.js');
const REGISTRY_METRIC_COLUMNS = pm3MetricColumnNames();
const FAKE_METRIC_COLUMNS = ['lottr_amp_lottr', 'speed_pctl_50', 'ted_truck_freeflow_all_xdelay_phrs'];

// meta-layer table name → the year it holds, filled in once the fixtures exist. The per-TMC meta
// query names its table, so the fake can answer with the right year and a multi-year publish writes
// genuinely different years.
const META_TABLE_YEAR = new Map();

function fakeDataDb() {
  const queries = [];
  return {
    queries,
    type: 'postgres',
    joined() { return queries.join('\n;\n'); },
    async query(sql, params) {
      queries.push(sql);
      if (/information_schema\.columns/i.test(sql)) {
        const table = String((params || [])[1] || '');
        // A metrics TABLE: join key + every registry column. A published pm3 VIEW: the declared
        // relation — which is what the union view's member-identity check reads.
        const cols = table.endsWith('_metrics')
          ? ['ogc_fid', 'tmc', 'year', ...REGISTRY_METRIC_COLUMNS]
          : pm3ViewColumnNames({ metricColumns: REGISTRY_METRIC_COLUMNS });
        return { rows: cols.map((column_name) => ({ column_name })) };
      }
      const metaMatch = /tmc = '([^']+)'/.exec(sql);
      if (/^\s*SELECT/i.test(sql) && metaMatch && ALL_TMCS.includes(metaMatch[1])) {
        const from = /FROM\s+\S+\.(\S+)\s+t1/.exec(sql);
        const year = (from && META_TABLE_YEAR.get(from[1])) || TMC_META_ROW.year;
        return { rows: [{ ...TMC_META_ROW, tmc: metaMatch[1], year }] };
      }
      return { rows: [] };
    },
  };
}

async function runTests() {
  console.log(`\n=== pm3 worker (${DAMA_TEST_DB}) ===\n`);
  await setup();

  const { getDb } = require('@availabs/dms-server/src/db');
  const metadata = require('@availabs/dms-server/src/dama/upload/metadata');
  const workerModule = require('../worker.js');
  const { makeWorker, METRIC_NAMES, metricColumnDescriptors, buildMetricConfigs } = workerModule;
  const metricConfigs = buildMetricConfigs({ chMetaTableName: 'x.y' });
  const db = getDb(DAMA_TEST_DB);
  const stamp = Date.now();

  // ── data_manager fixtures (real sqlite rows) ───────────────────────────────
  // meta-layer source + one view per year (per-year TMC attributes table). TWO years, so the
  // one-view-per-year behaviour can be exercised against genuinely different meta layers.
  const metaSrc = await metadata.createDamaSource({ name: `pm3_meta_${stamp}`, type: 'npmrds_tmc_meta_layer', user_id: 1 }, DAMA_TEST_DB);
  const metaView = await metadata.createDamaView({ source_id: metaSrc.source_id, user_id: 1 }, DAMA_TEST_DB);
  const metaView24 = await metadata.createDamaView({ source_id: metaSrc.source_id, user_id: 1 }, DAMA_TEST_DB);
  META_TABLE_YEAR.set(metaView.table_name, 2023);
  META_TABLE_YEAR.set(metaView24.table_name, 2024);

  // prod NPMRDS source: per-year meta-layer map on the SOURCE metadata,
  // raw-view→year map + CH meta table location on the VIEW metadata.
  const prodSrc = await metadata.createDamaSource({
    name: `pm3_npmrds_prod_${stamp}`, type: 'npmrds', user_id: 1,
    metadata: { npmrds_meta_layer_view_id: { 2023: metaView.view_id, 2024: metaView24.view_id } },
  }, DAMA_TEST_DB);
  const prodView = await metadata.createDamaView({
    source_id: prodSrc.source_id, user_id: 1,
    metadata: {
      npmrds_raw_view_id_to_year: { 101: 2023, 99: 2022, 103: 2024 },
      table_schema: 'clickhouse.npmrds_meta',
      table_name: `meta_tbl_${stamp}`,
    },
  }, DAMA_TEST_DB);

  // the pm3 source being published
  const pm3Src = await metadata.createDamaSource({ name: `pm3_src_${stamp}`, type: 'pm3', user_id: 1 }, DAMA_TEST_DB);

  const ch = stubChDb();
  const dataDb = fakeDataDb();
  const worker = makeWorker({
    getChDb: () => ch,
    createDamaView: metadata.createDamaView,
    ensureSchema: metadata.ensureSchema,
    dataDb,
  });

  const events = [];
  let lastProgress = 0;
  const ctx = {
    pgEnv: DAMA_TEST_DB,
    db,
    task: { task_id: 7, descriptor: {
      source_id: pm3Src.source_id,
      npmrdsSourceId: prodSrc.source_id,
      years: [2023],
      percentTmc: 100,
      user_id: 1,
      email: 'x@y.z',
      isNewSourceCreate: true,
    } },
    dispatchEvent: async (type, message, payload) => { events.push({ type, message, payload }); },
    updateProgress: async (p) => { lastProgress = p; },
  };

  let result;
  await test('worker runs end-to-end with stub chDb + fixture meta rows', async () => {
    result = await worker(ctx);
    assert(result && result.source_id === pm3Src.source_id, 'returns source_id');
    assert(result.view_id != null, 'returns view_id');
  });

  await test('output table lives in the pm3 schema (not gis_datasets)', async () => {
    const { rows } = await db.query(`SELECT table_schema, table_name, data_table FROM views WHERE view_id = $1`, [result.view_id]);
    assert(rows[0].table_schema === 'pm3', `view table_schema should be pm3 (got ${rows[0].table_schema})`);
    assert(String(rows[0].data_table).startsWith('pm3.'), `data_table should be pm3.* (got ${rows[0].data_table})`);
    assert(dataDb.joined().includes(`CREATE TABLE IF NOT EXISTS`), 'creates the data table');
    assert(dataDb.joined().includes(`pm3.${rows[0].table_name}`), 'physical SQL targets the pm3 schema table');
  });

  await test('adds the named UNIQUE(tmc, year) constraint (map21 uses UNIQUE(tmc))', async () => {
    const sql = dataDb.joined();
    assert(new RegExp(`tmc_year_${result.view_id}_constraint UNIQUE\\(tmc, year\\)`).test(sql),
      'should add tmc_year_<view_id>_constraint UNIQUE(tmc, year)');
  });

  await test('processes a TMC whose meta row map21 would reject (permissive checkMeta, end-to-end)', async () => {
    const sql = dataDb.joined();
    assert(sql.includes(`'${TMC}'`), 'fixture TMC reaches the data table');
    // Since geometry de-duplication the per-TMC insert seeds ONLY the join key;
    // the 23 attribute columns + geometry come from the view's join instead.
    assert(/INSERT INTO pm3\.\S+_metrics \(tmc, year\) VALUES/.test(sql),
      'seeds the (tmc, year) join-key row into the metrics table');
    // Per-query, not over the joined blob: the CREATE VIEW legitimately
    // mentions wkb_geometry.
    const inserts = dataDb.queries.filter((q) => /INSERT INTO/i.test(q));
    assert(inserts.length > 0, 'expected at least one INSERT');
    for (const q of inserts) {
      assert(!/wkb_geometry/.test(q), `INSERT must NOT carry wkb_geometry: ${q.trim().slice(0, 120)}`);
      assert(!/urban_code|congestion_level|directionalaadt(?!truck)/.test(q),
        `INSERT must NOT carry TMC attribute columns: ${q.trim().slice(0, 120)}`);
    }
  });

  await test('writes per-metric (METRIC_WRITES_DB=true): one upsert per metric, all 11 metrics', async () => {
    // +1 for the (tmc, year) seed row, which shares the same named constraint.
    const inserts = dataDb.queries.filter(
      (q) => /ON CONFLICT ON CONSTRAINT tmc_year_/.test(q) && !/\(tmc, year\) VALUES/.test(q)
    );
    const expected = METRIC_NAMES.length * ALL_TMCS.length;
    assert(inserts.length === expected,
      `should issue ${METRIC_NAMES.length} upserts x ${ALL_TMCS.length} TMCs = ${expected} (got ${inserts.length})`);
    const sql = dataDb.joined();
    for (const m of ['speed_pctl', 'lottr', 'tttr', 'phed', 'phed_freeflow', 'phed_truck',
                     'phed_truck_freeflow', 'ted', 'ted_freeflow', 'ted_truck', 'ted_truck_freeflow']) {
      assert(inserts.some((q) => q.includes(`"${m}_`)), `should upsert columns for metric ${m}`);
    }
    assert(sql.includes('"lottr_amp_lottr"'), 'lottr columns are metric-prefixed lowercase');
    assert(sql.includes('"speed_pctl_50"'), 'speed percentile columns written');
    assert(sql.includes('"ted_truck_freeflow_all_xdelay_phrs"'), 'ted_truck_freeflow delay columns written');
  });

  await test('columns are lowercase — no FHWA renames, no uppercase intermediate keys', async () => {
    const sql = dataDb.joined();
    assert(!sql.includes('"lottramp"'), 'must NOT use map21 FHWA header names');
    assert(!/"[A-Z]+_lottr"/.test(sql), 'must NOT write uppercase bin-prefixed columns');
  });

  await test('ensures the GIST index on the npmrds_meta geometry table, not on pm3', async () => {
    const sql = dataDb.joined();
    // Without this index a single z9 tile through the joined view measured 255s
    // vs 22ms materialized (2026-08-07). It must target the META table.
    const idx = dataDb.queries.find((q) => /USING GIST \(wkb_geometry\)/.test(q));
    assert(idx, 'should create a GIST index on wkb_geometry');
    assert(/CREATE INDEX IF NOT EXISTS/.test(idx), 'index creation must be idempotent');
    assert(!/ON pm3\./.test(idx), `index must NOT target the pm3 relation (got: ${idx.trim()})`);
    assert(sql.includes('_wkb_geometry_gist'), 'uses the meta-geometry index name');
  });

  await test('builds the metrics ⋈ geometry view as views.table_name', async () => {
    const { rows } = await db.query(`SELECT table_name FROM views WHERE view_id = $1`, [result.view_id]);
    const viewName = rows[0].table_name;
    const create = dataDb.queries.find((q) => /CREATE VIEW/.test(q));
    assert(create, 'should create the joined view');
    assert(create.includes(`CREATE VIEW pm3.${viewName} AS`), `view is named pm3.${viewName}`);
    assert(dataDb.queries.some((q) => q.includes(`DROP VIEW IF EXISTS pm3.${viewName}`)),
      'drops before create so a changed column set is not a CREATE OR REPLACE error');
    assert(create.includes(`FROM pm3.${viewName}_metrics m`), 'selects from the metrics table');
    assert(/JOIN \S+ t1\s+ON t1\.tmc = m\."tmc" AND t1\.year = m\."year"/.test(create),
      'joins the meta table on both tmc and year');
    assert(create.includes('t1."wkb_geometry"'), 'view supplies wkb_geometry from the join');
    for (const m of FAKE_METRIC_COLUMNS) {
      assert(create.includes(`m."${m}"`), `view exposes metric column ${m}`);
    }
    assert(result.metrics_table === `pm3.${viewName}_metrics`,
      `result reports the metrics table (got ${result.metrics_table})`);
  });

  await test('records the meta-layer provenance the view join depends on', async () => {
    const { rows } = await db.query(`SELECT metadata FROM views WHERE view_id = $1`, [result.view_id]);
    const meta = parseJson(rows[0].metadata);
    assert(meta.npmrds_meta_layer_view_id && meta.npmrds_meta_layer_view_id['2023'],
      'view metadata records the meta-layer view_id per year');
    assert(meta.npmrds_meta_layer_table && meta.npmrds_meta_layer_table['2023'],
      'view metadata records the meta-layer table per year');
    assert(String(meta.pm3_metrics_table).endsWith('_metrics'),
      'view metadata records the metrics table');
  });

  await test('writes tiles + rawViewIdsUsed to the view metadata', async () => {
    const { rows } = await db.query(`SELECT metadata FROM views WHERE view_id = $1`, [result.view_id]);
    const meta = parseJson(rows[0].metadata);
    assert(meta.npmrds_prod_source_id === prodSrc.source_id, 'view metadata keeps npmrds_prod_source_id');
    assert(Array.isArray(meta.rawViewIdsUsed) && meta.rawViewIdsUsed.includes('101'), 'rawViewIdsUsed carries the 2023 raw view');
    assert(!meta.rawViewIdsUsed.includes('99'), 'rawViewIdsUsed excludes other years');
    assert(meta.tiles && Array.isArray(meta.tiles.sources) && meta.tiles.sources.length === 1, 'tiles metadata written');
    assert(JSON.stringify(meta.tiles).includes(`/tiles/${result.view_id}/`), 'tiles URL points at this view');
  });

  await test('writes source metadata.columns (lowercase pm3 descriptors)', async () => {
    const { rows } = await db.query(`SELECT metadata FROM sources WHERE source_id = $1`, [pm3Src.source_id]);
    const cols = parseJson(rows[0].metadata).columns;
    assert(Array.isArray(cols) && cols.length > 0, 'metadata.columns should be a non-empty array');
    for (const c of cols) {
      assert(c.name === c.name.toLowerCase(), `column names must be lowercase (got ${c.name})`);
      assert(c.display_name && c.type, `descriptor needs display_name + type (${c.name})`);
    }
    const names = cols.map((c) => c.name);
    for (const n of ['tmc', 'year', 'miles', 'lottr_amp_lottr', 'tttr_ovn_tttr', 'speed_pctl_50', 'phed_all_xdelay_phrs']) {
      assert(names.includes(n), `metadata.columns should include ${n}`);
    }
  });

  await test('reports progress to 1 and emits pm3 terminal events; never touches etl_contexts', async () => {
    assert(lastProgress === 1, `final progress should be 1 (got ${lastProgress})`);
    assert(events.some((e) => e.type === 'pm3:FINAL'), 'should emit pm3:FINAL');
    assert(events.some((e) => e.type === 'pm3:start'), 'should emit pm3:start');
    assert(!dataDb.joined().includes('etl_contexts'), 'no etl_contexts in physical SQL');
  });

  await test('ClickHouse is only reached through the injected stub (distinct TMCs + per-metric reads)', async () => {
    assert(ch.queries.some((q) => /distinct\(tmc\)/i.test(q)), 'lists TMCs from CH');
    assert(ch.queries.some((q) => /avg_speed_all_vehicles/.test(q)), 'speed percentile query hits CH');
  });

  await test('`version` is the 4-digit year and the year is in the table name', async () => {
    // The macroview labels its year selector from `version` and rewrites the tile URL's
    // `&filter=year=` from that label, so anything else drops the view out of the selector and
    // leaves the tiles filtering on the wrong year (204 / 0 bytes, network vanishes).
    const { rows } = await db.query(`SELECT version, table_name FROM views WHERE view_id = $1`, [result.view_id]);
    assert(rows[0].version === '2023', `version should be '2023' (got ${JSON.stringify(rows[0].version)})`);
    assert(/_2023$/.test(rows[0].table_name), `table name should end in the year (got ${rows[0].table_name})`);
    assert(result.views.length === 1 && result.views[0].year === 2023, 'result reports one view for 2023');
    assert(result.view_ids.length === 1, 'result reports one view id');
  });

  await test('a per-year publish never DELETEs — the table is new, nothing is being replaced', async () => {
    // The append path opened every run with `DELETE FROM <shared metrics table> WHERE year in (...)`.
    // Per-year tables make that impossible, and its absence is the whole point: a failed publish can
    // no longer damage a year that already succeeded.
    const deletes = dataDb.queries.filter((q) => /DELETE\s+FROM/i.test(q));
    assert(deletes.length === 0, `expected no DELETEs, got ${deletes.length}: ${deletes[0] || ''}`);
    assert(!dataDb.joined().includes('begindate'), 'must not use map21 begindate regex delete');
  });

  await test('the tile URL filters on this view\'s single year', async () => {
    const { rows } = await db.query(`SELECT metadata FROM views WHERE view_id = $1`, [result.view_id]);
    const url = parseJson(rows[0].metadata).tiles.sources[0].source.tiles[0];
    assert(/filter=year=2023$/.test(url), `tile URL should filter year=2023 (got ${url})`);
  });

  await test('the append path is REFUSED: a descriptor carrying view_id fails loudly', async () => {
    // Removed 2026-08-24. Silently ignoring view_id would publish to a new view while the caller
    // believed it was appending, so the failure is explicit and names the replacement.
    const worker2 = makeWorker({
      getChDb: () => stubChDb(), createDamaView: metadata.createDamaView,
      ensureSchema: metadata.ensureSchema, dataDb: fakeDataDb(),
    });
    let err = null;
    try {
      await worker2({
        pgEnv: DAMA_TEST_DB, db,
        task: { task_id: 8, descriptor: {
          source_id: pm3Src.source_id, npmrdsSourceId: prodSrc.source_id,
          years: [2023], view_id: result.view_id, percentTmc: 100, user_id: 1,
        } },
        dispatchEvent: async () => {}, updateProgress: async () => {},
      });
    } catch (e) { err = e; }
    assert(err, 'should throw');
    assert(/append path .*was removed|one view per year/i.test(err.message),
      `error should explain the removal (got: ${err.message})`);
  });

  // ── one view per year ──────────────────────────────────────────────────────
  let multi;
  const multiDataDb = fakeDataDb();
  await test('a 2-year publish creates 2 views, one per year, each with its own metrics table', async () => {
    const eventsM = [];
    const workerM = makeWorker({
      getChDb: () => stubChDb(), createDamaView: metadata.createDamaView,
      ensureSchema: metadata.ensureSchema, dataDb: multiDataDb,
    });
    multi = await workerM({
      pgEnv: DAMA_TEST_DB, db,
      task: { task_id: 10, descriptor: {
        source_id: pm3Src.source_id, npmrdsSourceId: prodSrc.source_id,
        years: [2024, 2023], percentTmc: 100, user_id: 1,
      } },
      dispatchEvent: async (type, message, payload) => { eventsM.push({ type, message, payload }); },
      updateProgress: async () => {},
    });
    assert(multi.views.length === 2, `expected 2 views, got ${multi.views.length}`);
    // Ascending year order regardless of descriptor order, so view ids follow the years.
    assert(multi.views.map((v) => v.year).join(',') === '2023,2024',
      `views should be year-ascending (got ${multi.views.map((v) => v.year).join(',')})`);
    assert(multi.views[0].view_id !== multi.views[1].view_id, 'distinct view ids');
    assert(multi.views[0].metrics_table !== multi.views[1].metrics_table,
      'each year gets its OWN metrics table — that is what makes a year independently republishable');
    for (const v of multi.views) {
      const { rows } = await db.query(`SELECT version, table_schema FROM views WHERE view_id = $1`, [v.view_id]);
      assert(rows[0].version === String(v.year), `view ${v.view_id} version should be ${v.year}`);
      assert(rows[0].table_schema === 'pm3', 'lives in the pm3 schema');
      const meta = parseJson((await db.query(`SELECT metadata FROM views WHERE view_id = $1`, [v.view_id])).rows[0].metadata);
      assert(Array.isArray(meta.year) && meta.year.length === 1 && meta.year[0] === v.year,
        `metadata.year should be exactly [${v.year}] (got ${JSON.stringify(meta.year)})`);
      // The append bug class: these maps used to be REPLACED rather than merged and the view is
      // rebuilt from them. One year, one entry — there is nothing left to merge.
      assert(Object.keys(meta.npmrds_meta_layer_table).length === 1, 'one meta-layer table entry');
      assert(meta.npmrds_meta_layer_table[String(v.year)], `meta-layer table recorded for ${v.year}`);
    }
    // Republishing 2023 (run 1 already published it) is allowed and announced.
    assert(eventsM.some((e) => e.type === 'pm3:WARN' && /already has \d+ view\(s\) for 2023/.test(e.message)),
      'should warn that 2023 already has a view');
  });

  await test('every per-year view exposes the SAME columns, in the same order', async () => {
    // The hard DAMA invariant: metadata.columns lives on the SOURCE, so one list describes every
    // view. Two views with different column sets is a broken source, not a versioned one.
    const creates = multiDataDb.queries.filter((q) => /^\s*CREATE VIEW/m.test(q));
    assert(creates.length === 2, `expected 2 CREATE VIEWs, got ${creates.length}`);
    const outputCols = (sql) => {
      const list = sql.slice(sql.indexOf('SELECT') + 6, sql.indexOf('FROM pm3.'));
      // top-level commas only — the derived AADT/AVO expressions contain nested commas
      const parts = [];
      let depth = 0, cur = '';
      for (const ch of list) {
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
      }
      parts.push(cur);
      return parts.map((part) => {
        const as = /\sAS\s+"([^"]+)"\s*$/i.exec(part);
        if (as) return as[1];
        const bare = /"([^"]+)"\s*$/.exec(part);
        return bare ? bare[1] : part.trim();
      });
    };
    const a = outputCols(creates[0]);
    const b = outputCols(creates[1]);
    assert(a.length === b.length, `column counts differ: ${a.length} vs ${b.length}`);
    for (let i = 0; i < a.length; i++) {
      assert(a[i] === b[i], `column ${i} differs: "${a[i]}" vs "${b[i]}"`);
    }
    // …and they are exactly what the SOURCE declares, which is the only list any consumer reads.
    //
    // Position-for-position, INCLUDING ogc_fid. This used to assert `declared.length + 1` on the
    // grounds that metadata.columns did not list ogc_fid; that stopped being true on 2026-08-24,
    // when it was declared FIRST and flagged `isIndex: true` so uda's `resolvePrimaryKey` stops
    // falling back to `'id'` against a relation that is a VIEW (see buildPm3SourceColumns for the
    // broken-map-popup symptom). The two lists now describe the same relation exactly, which is a
    // stronger invariant than the offset-by-one one — so assert it as such.
    const { rows } = await db.query(`SELECT metadata FROM sources WHERE source_id = $1`, [pm3Src.source_id]);
    const declared = parseJson(rows[0].metadata).columns.map((c) => c.name);
    assert(declared[0] === 'ogc_fid', `metadata.columns should lead with ogc_fid (got "${declared[0]}")`);
    assert(a.length === declared.length,
      `view exposes ${a.length} columns against ${declared.length} declared`);
    for (let i = 0; i < declared.length; i++) {
      assert(a[i] === declared[i], `position ${i}: view has "${a[i]}", source declares "${declared[i]}"`);
    }
  });

  await test('each per-year view joins only its own year\'s meta table — one UNION branch', async () => {
    const creates = multiDataDb.queries.filter((q) => /^\s*CREATE VIEW/m.test(q));
    for (const [i, year] of [2023, 2024].entries()) {
      assert(!creates[i].includes('UNION ALL'), `view for ${year} should have a single branch`);
      assert(new RegExp(`WHERE m\\."year" = ${year}`).test(creates[i]), `branch filters year = ${year}`);
    }
  });

  // ── the all_years union view ───────────────────────────────────────────────
  await test('the union view is NOT built unless asked for', async () => {
    assert(multi.union_view_id === null, 'union_view_id should be null without rebuildUnionView');
    assert(!multiDataDb.joined().includes('all_years'), 'no union view SQL issued');
    const { rows } = await db.query(`SELECT count(*) n FROM views WHERE source_id = $1 AND version = 'all_years'`, [pm3Src.source_id]);
    assert(Number(rows[0].n) === 0, 'no all_years view row created');
  });

  let unionRun;
  const unionDataDb = fakeDataDb();
  await test('rebuildUnionView unions the newest view per year, in year order', async () => {
    const eventsU = [];
    const workerU = makeWorker({
      getChDb: () => stubChDb(), createDamaView: metadata.createDamaView,
      ensureSchema: metadata.ensureSchema, dataDb: unionDataDb,
    });
    unionRun = await workerU({
      pgEnv: DAMA_TEST_DB, db,
      task: { task_id: 11, descriptor: {
        source_id: pm3Src.source_id, npmrdsSourceId: prodSrc.source_id,
        years: [2024], percentTmc: 100, user_id: 1, rebuildUnionView: true,
      } },
      dispatchEvent: async (type, message, payload) => { eventsU.push({ type, message, payload }); },
      updateProgress: async () => {},
    });
    assert(unionRun.union_view_id != null, 'union_view_id returned');
    const { rows } = await db.query(`SELECT version, table_schema, table_name, metadata FROM views WHERE view_id = $1`,
      [unionRun.union_view_id]);
    assert(rows[0].version === 'all_years', `union version should be all_years (got ${rows[0].version})`);
    assert(rows[0].table_schema === 'pm3' && /_all_years$/.test(rows[0].table_name),
      `union table should be pm3.*_all_years (got ${rows[0].table_schema}.${rows[0].table_name})`);
    const meta = parseJson(rows[0].metadata);
    // 2023 and 2024 each have several views by now; the NEWEST of each wins, and 2024's newest is
    // the one this run just published.
    assert(JSON.stringify(meta.year) === '[2023,2024]', `union spans both years (got ${JSON.stringify(meta.year)})`);
    assert(meta.union_of_view_ids.length === 2, 'two members recorded');
    assert(meta.union_of_view_ids[1] === unionRun.views[0].view_id,
      'the 2024 member is the view this run published (newest wins)');
    const create = unionDataDb.queries.find((q) => /CREATE VIEW pm3\.\S+_all_years/.test(q));
    assert(create, 'issues the union CREATE VIEW');
    assert((create.match(/UNION ALL/g) || []).length === 1, 'one UNION ALL for two members');
    assert(unionDataDb.queries.some((q) => /DROP VIEW IF EXISTS pm3\.\S+_all_years/.test(q)),
      'drops before create — the column list changes whenever the registry grows');
    assert(eventsU.some((e) => e.type === 'pm3:UNION_VIEW_BUILT'), 'emits pm3:UNION_VIEW_BUILT');
  });

  await test('a second rebuild REUSES the union view row so its view_id is stable', async () => {
    // The union's view_id is what a page section or symbology binds to. Minting a new one on every
    // publish would silently strand every consumer.
    const workerU2 = makeWorker({
      getChDb: () => stubChDb(), createDamaView: metadata.createDamaView,
      ensureSchema: metadata.ensureSchema, dataDb: fakeDataDb(),
    });
    const r = await workerU2({
      pgEnv: DAMA_TEST_DB, db,
      task: { task_id: 12, descriptor: {
        source_id: pm3Src.source_id, npmrdsSourceId: prodSrc.source_id,
        years: [2023], percentTmc: 100, user_id: 1, rebuildUnionView: true,
      } },
      dispatchEvent: async () => {}, updateProgress: async () => {},
    });
    assert(r.union_view_id === unionRun.union_view_id,
      `union view_id should be reused (${unionRun.union_view_id} -> ${r.union_view_id})`);
    const { rows } = await db.query(`SELECT count(*) n FROM views WHERE source_id = $1 AND version = 'all_years'`, [pm3Src.source_id]);
    assert(Number(rows[0].n) === 1, `exactly one all_years view (got ${rows[0].n})`);
    // …and it now names the 2023 view this run published, because the newest per year wins.
    const meta = parseJson((await db.query(`SELECT metadata FROM views WHERE view_id = $1`, [r.union_view_id])).rows[0].metadata);
    assert(meta.union_of_view_ids[0] === r.views[0].view_id, 'the 2023 member is this run\'s view');
  });

  await test('the union rebuild REFUSES members whose columns disagree', async () => {
    // A positional UNION ALL over relations whose same-typed columns sit in a different order is
    // silently wrong and Postgres cannot catch it, so member identity is proven before the build.
    const drifted = fakeDataDb();
    const inner = drifted.query.bind(drifted);
    let seen = 0;
    drifted.query = async (sql, params) => {
      const res = await inner(sql, params);
      // Drop a column from the SECOND published view the identity check reads.
      if (/information_schema\.columns/i.test(sql) && !String((params || [])[1] || '').endsWith('_metrics')) {
        seen += 1;
        if (seen === 2) return { rows: res.rows.slice(0, -1) };
      }
      return res;
    };
    const workerD = makeWorker({
      getChDb: () => stubChDb(), createDamaView: metadata.createDamaView,
      ensureSchema: metadata.ensureSchema, dataDb: drifted,
    });
    let err = null;
    try {
      await workerD({
        pgEnv: DAMA_TEST_DB, db,
        task: { task_id: 13, descriptor: {
          source_id: pm3Src.source_id, npmrdsSourceId: prodSrc.source_id,
          years: [2024], percentTmc: 100, user_id: 1, rebuildUnionView: true,
        } },
        dispatchEvent: async () => {}, updateProgress: async () => {},
      });
    } catch (e) { err = e; }
    assert(err, 'should throw rather than build a mismatched union');
    assert(/refusing to build the union view/.test(err.message), `unexpected error: ${err.message}`);
    assert(/NEW SOURCE/.test(err.message), 'error should point at the actual remedy');
  });

  await test('pre-creates all metric columns once instead of ALTERing per TMC per metric', async () => {
    // ALTER TABLE takes ACCESS EXCLUSIVE, so under concurrency a per-TMC ALTER
    // would serialize the whole pool behind a lock convoy. All metric columns
    // are enumerable from the registry, so they are created up front; only the
    // serial warm-up TMC keeps the legacy per-metric ALTER as a safety net.
    // Everything below derives its expectations from the metric registry. An earlier version
    // classified an ALTER as "bulk" when it created > 20 columns, which broke the moment R4 pushed a
    // single metric's descriptor count past 20 (lottr now has 20) — per-metric ALTERs started being
    // counted as bulk. Column counts grow with every phase of this task, so no magic number here
    // survives; the bulk ALTER is instead identified as the one creating one column per descriptor.
    const countCols = (q) => (q.match(/ADD COLUMN IF NOT EXISTS/g) || []).length;
    const perMetricCols = Object.fromEntries(
      METRIC_NAMES.map((n) => [n, metricColumnDescriptors(n, metricConfigs[n]).length]),
    );
    const expectedMetricCols = Object.values(perMetricCols).reduce((a, b) => a + b, 0);
    const maxPerMetricCols = Math.max(...Object.values(perMetricCols));

    const alters = dataDb.queries.filter((q) => /ADD COLUMN IF NOT EXISTS/i.test(q));
    const bulk = alters.filter((q) => countCols(q) === expectedMetricCols);
    assert(bulk.length === 1,
      `expected exactly 1 bulk ALTER creating all ${expectedMetricCols} metric columns (got ${bulk.length}; ` +
      `alter sizes seen: ${alters.map(countCols).join(',')})`);

    // warm-up TMC only: one small ALTER per metric, NOT one per metric per TMC.
    // The +1 allowance is the one-off (tmc, year) join-key ALTER.
    const perMetric = alters.filter((q) => countCols(q) <= maxPerMetricCols);
    const maxSmall = METRIC_NAMES.length + 1;
    assert(perMetric.length <= maxSmall,
      `per-metric ALTERs must be warm-up only: expected <= ${maxSmall}, got ${perMetric.length}`);
    assert(perMetric.length < METRIC_NAMES.length * ALL_TMCS.length,
      'must not ALTER per metric per TMC');
  });

  await test('processes every TMC through the pool, one metric upsert set each', async () => {
    const seeds = dataDb.queries.filter((q) => /INSERT INTO pm3\.\S+_metrics \(tmc, year\) VALUES/.test(q));
    assert(seeds.length === ALL_TMCS.length,
      `expected one join-key seed per TMC (${ALL_TMCS.length}), got ${seeds.length}`);
    const upserts = dataDb.queries.filter(
      (q) => /ON CONFLICT ON CONSTRAINT tmc_year_/.test(q) && !/\(tmc, year\) VALUES/.test(q));
    assert(upserts.length === METRIC_NAMES.length * ALL_TMCS.length,
      `expected ${METRIC_NAMES.length} x ${ALL_TMCS.length} metric upserts, got ${upserts.length}`);
    for (const tmc of ALL_TMCS) {
      assert(dataDb.queries.some((q) => q.includes(`tmc = '${tmc}'`)), `TMC ${tmc} was read`);
    }
  });

  await test('concurrency is capped and configurable down to serial', async () => {
    const { MAX_CONCURRENCY } = workerModule;
    const dataDb3 = fakeDataDb();
    const worker3 = makeWorker({
      getChDb: () => stubChDb(), createDamaView: metadata.createDamaView,
      ensureSchema: metadata.ensureSchema, dataDb: dataDb3,
    });
    const r3 = await worker3({
      pgEnv: DAMA_TEST_DB, db,
      task: { task_id: 9, descriptor: {
        source_id: pm3Src.source_id, npmrdsSourceId: prodSrc.source_id,
        years: [2023], percentTmc: 100, user_id: 1,
        concurrency: 999,
      } },
      dispatchEvent: async () => {}, updateProgress: async () => {},
    });
    assert(r3.view_id != null, 'run completes with an out-of-range concurrency');
    assert(MAX_CONCURRENCY < 10, 'cap must stay under the pg pool default of 10');
  });

  console.log(`\n  ${passed} passing, ${failed} failing\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => { console.error('Test runner error:', err); process.exit(1); });
