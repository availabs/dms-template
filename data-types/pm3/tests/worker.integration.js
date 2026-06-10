/**
 * Integration test: the pm3 publish worker.
 *
 * Built via makeWorker(deps): ClickHouse is a stub, and all PHYSICAL data-table
 * SQL (the pm3 schema table) goes through an injected recording `dataDb` so the
 * sqlite harness never has to execute Postgres-only DDL. The real sqlite db
 * handles the data_manager side (sources/views/tasks).
 *
 * Asserts the pm3 semantics that differ from map21:
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
        return { json: async () => ({ rows: 1, data: [{ tmc: TMC }] }) };
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
// with the fixture row; records everything else.
function fakeDataDb() {
  const queries = [];
  return {
    queries,
    joined() { return queries.join('\n;\n'); },
    async query(sql) {
      queries.push(sql);
      if (/^\s*SELECT/i.test(sql) && sql.includes(`tmc = '${TMC}'`)) {
        return { rows: [{ ...TMC_META_ROW }] };
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
  const { makeWorker, METRIC_NAMES } = workerModule;
  const db = getDb(DAMA_TEST_DB);
  const stamp = Date.now();

  // ── data_manager fixtures (real sqlite rows) ───────────────────────────────
  // meta-layer source + view (per-year TMC attributes table)
  const metaSrc = await metadata.createDamaSource({ name: `pm3_meta_${stamp}`, type: 'npmrds_tmc_meta_layer', user_id: 1 }, DAMA_TEST_DB);
  const metaView = await metadata.createDamaView({ source_id: metaSrc.source_id, user_id: 1 }, DAMA_TEST_DB);

  // prod NPMRDS source: per-year meta-layer map on the SOURCE metadata,
  // raw-view→year map + CH meta table location on the VIEW metadata.
  const prodSrc = await metadata.createDamaSource({
    name: `pm3_npmrds_prod_${stamp}`, type: 'npmrds', user_id: 1,
    metadata: { npmrds_meta_layer_view_id: { 2023: metaView.view_id } },
  }, DAMA_TEST_DB);
  const prodView = await metadata.createDamaView({
    source_id: prodSrc.source_id, user_id: 1,
    metadata: {
      npmrds_raw_view_id_to_year: { 101: 2023, 99: 2022 },
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
    // the meta-row insert carries the meta columns incl. wkb_geometry + mpo fields
    assert(/INSERT INTO[\s\S]*tmc,urban_code,region_code,county,ua_name,mpo_code,mpo_name,wkb_geometry/.test(sql),
      'inserts the pm3 meta-column row');
  });

  await test('writes per-metric (METRIC_WRITES_DB=true): one upsert per metric, all 11 metrics', async () => {
    const inserts = dataDb.queries.filter((q) => /ON CONFLICT ON CONSTRAINT tmc_year_/.test(q));
    assert(inserts.length === METRIC_NAMES.length,
      `should issue ${METRIC_NAMES.length} per-metric upserts (got ${inserts.length})`);
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

  await test('creates the GIST geometry index', async () => {
    assert(/USING\s+GIST \(wkb_geometry\)/.test(dataDb.joined()), 'should create a GIST index on wkb_geometry');
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

  await test('appending to an existing view deletes that year by `year` column (not begindate regex)', async () => {
    const dataDb2 = fakeDataDb();
    const ch2 = stubChDb();
    const worker2 = makeWorker({
      getChDb: () => ch2,
      createDamaView: metadata.createDamaView,
      ensureSchema: metadata.ensureSchema,
      dataDb: dataDb2,
    });
    const events2 = [];
    const r2 = await worker2({
      pgEnv: DAMA_TEST_DB, db,
      task: { task_id: 8, descriptor: {
        source_id: pm3Src.source_id,
        npmrdsSourceId: prodSrc.source_id,
        years: [2023],
        view_id: result.view_id,
        percentTmc: 100,
        user_id: 1,
      } },
      dispatchEvent: async (type, message, payload) => { events2.push({ type }); },
      updateProgress: async () => {},
    });
    assert(r2.view_id === result.view_id, 'reuses the existing view');
    assert(dataDb2.queries.some((q) => /DELETE FROM[\s\S]*year in \(2023\)/i.test(q)),
      'clears existing rows by year IN (...)');
    assert(!dataDb2.joined().includes('begindate'), 'must not use map21 begindate regex delete');
  });

  console.log(`\n  ${passed} passing, ${failed} failing\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => { console.error('Test runner error:', err); process.exit(1); });
