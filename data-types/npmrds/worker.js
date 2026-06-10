/**
 * npmrds staged workers (Phase 2 of the dama data-type migration).
 *
 * Ported from the legacy avail-falcor npmrds pipeline into FOUR workers:
 *
 *   npmrds/provision — the legacy inline /publish provisioning, moved into a
 *                      queued worker. Decision: the route only does the cheap
 *                      PG-side source creates (so it can return source_id
 *                      synchronously, mirroring npmrds_raw's two-source
 *                      pattern); everything that needs ClickHouse/PostGIS
 *                      (views, CH prod+meta tables, PG geometry table,
 *                      metadata.columns) runs here, where deps are injected.
 *   npmrds/add       — legacy add.worker + metadata.worker as ONE staged
 *                      worker (the new runner has no parent/child chaining).
 *   npmrds/replace   — legacy replace.worker (partition drops + re-insert).
 *                      Like legacy, it does NOT re-run the metadata phase.
 *   npmrds/remove    — legacy removeNpmrds() (ran inline in the HTTP handler;
 *                      moved to a worker because CH access lives behind deps).
 *
 * Dependency-injected via makeWorkers(deps) so ClickHouse and the physical
 * Postgres side (npmrds_geometry / temp schemas, PostGIS joins) are faked in
 * tests. data_manager sources/views reads+writes go through ctx.db (portable
 * postgres/sqlite). NEVER touches data_manager.etl_contexts.
 *
 * ctx: { task, pgEnv, db, dispatchEvent, updateProgress }
 */
const ch = require('./ch-sql');
const pg = require('./pg-sql');
const { BINS, computeTmcDirectionality } = require('./directionality');
const { enrichTmcIdRow } = require('./enrich');
const { makeTiles, removeByYear } = require('./tiles');

// ─── metadata.columns descriptors (Table-page contract; bare PG types) ───────

const PROD_TABLE_COLUMNS = [
  { name: 'tmc', display_name: 'TMC', type: 'TEXT', desc: null },
  { name: 'date', display_name: 'Date', type: 'DATE', desc: null },
  { name: 'epoch', display_name: 'Epoch (5-min bucket)', type: 'INTEGER', desc: null },
  { name: 'travel_time_all_vehicles', display_name: 'Travel Time (all)', type: 'DOUBLE PRECISION', desc: null },
  { name: 'travel_time_passenger_vehicles', display_name: 'Travel Time (passenger)', type: 'DOUBLE PRECISION', desc: null },
  { name: 'travel_time_freight_trucks', display_name: 'Travel Time (freight)', type: 'DOUBLE PRECISION', desc: null },
  { name: 'data_density_all_vehicles', display_name: 'Data Density (all)', type: 'TEXT', desc: null },
  { name: 'data_density_passenger_vehicles', display_name: 'Data Density (passenger)', type: 'TEXT', desc: null },
  { name: 'data_density_freight_trucks', display_name: 'Data Density (freight)', type: 'TEXT', desc: null },
  { name: 'state', display_name: 'State', type: 'TEXT', desc: null },
  { name: 'view_id', display_name: 'Raw View ID', type: 'INTEGER', desc: 'Provenance: the npmrds_raw view this row came from' },
];

// Curated meta columns (the geometry-table superset incl. mpo_name + is_interstate).
const META_TABLE_COLUMNS = [
  { name: 'tmc', type: 'TEXT' }, { name: 'road', type: 'TEXT' },
  { name: 'direction', type: 'TEXT' }, { name: 'state', type: 'TEXT' },
  { name: 'county', type: 'TEXT' }, { name: 'zip', type: 'TEXT' },
  { name: 'miles', type: 'DOUBLE PRECISION' }, { name: 'f_system', type: 'SMALLINT' },
  { name: 'urban_code', type: 'BIGINT' }, { name: 'faciltype', type: 'BIGINT' },
  { name: 'thrulanes', type: 'BIGINT' }, { name: 'aadt', type: 'BIGINT' },
  { name: 'aadt_singl', type: 'BIGINT' }, { name: 'aadt_combi', type: 'BIGINT' },
  { name: 'nhs', type: 'BIGINT' }, { name: 'truck', type: 'SMALLINT' },
  { name: 'congestion_level', type: 'TEXT' }, { name: 'year', type: 'BIGINT' },
  { name: 'avg_speedlimit', type: 'DOUBLE PRECISION' }, { name: 'directionality', type: 'TEXT' },
  { name: 'avg_vehicle_occupancy', type: 'DOUBLE PRECISION' },
  { name: 'state_code', type: 'TEXT' }, { name: 'county_code', type: 'TEXT' },
  { name: 'region_code', type: 'TEXT' }, { name: 'mpo_code', type: 'TEXT' },
  { name: 'mpo_name', type: 'TEXT' }, { name: 'ua_code', type: 'TEXT' },
  { name: 'state_name', type: 'TEXT' }, { name: 'county_name', type: 'TEXT' },
  { name: 'ua_name', type: 'TEXT' }, { name: 'is_interstate', type: 'BOOLEAN' },
  { name: 'wkb_geometry', type: 'GEOMETRY(MultiLineString)' },
].map((c) => ({
  desc: null,
  display_name: c.name.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '),
  ...c,
}));

// Legacy hardcoded value, still written for BC (legacy comment: likely unused).
const NPMRDS_PRODUCTION_META_VIEW_ID = 25;

const sanitize = (s) => String(s).replace(/[\s\W]+/g, '_').toLowerCase();
const stripCh = (t) => (t || '').replace(/^clickhouse\./, '');

function defaultDeps() {
  const dbMod = require('@availabs/dms-server/src/db');
  const metadata = require('@availabs/dms-server/src/dama/upload/metadata');
  return {
    getChDb: dbMod.getChDb,
    // Physical PG side (npmrds_geometry/temp schemas + PostGIS). In production
    // this is the same adapter as ctx.db; split out as a dep so tests can fake
    // PostGIS while keeping real data_manager reads/writes on ctx.db.
    getPgDb: dbMod.getDb,
    createDamaView: metadata.createDamaView,
    // JSONEachRow object insert (needs the raw @clickhouse/client).
    chInsertRows: async (chDb, table, rows) => {
      if (!rows || !rows.length) return;
      if (!chDb || !chDb.client) throw new Error('npmrds: ClickHouse adapter has no .client (cannot insert)');
      await chDb.client.insert({ table, values: rows, format: 'JSONEachRow' });
    },
  };
}

// ─── small portable PG/sqlite helpers (data_manager side) ────────────────────

function tableFor(db, base) {
  return db.type === 'postgres' ? `data_manager.${base}` : base;
}

const parseJson = (v) => (typeof v === 'string' ? (v ? JSON.parse(v) : {}) : (v || {}));

async function mergeJsonColumn(db, table, idCol, id, col, patch) {
  const { rows } = await db.query(`SELECT ${col} FROM ${table} WHERE ${idCol} = $1`, [id]);
  const next = { ...parseJson(rows[0] && rows[0][col]), ...patch };
  await db.query(`UPDATE ${table} SET ${col} = $1 WHERE ${idCol} = $2`, [JSON.stringify(next), id]);
  return next;
}

async function getRow(db, table, idCol, id) {
  const { rows } = await db.query(`SELECT * FROM ${table} WHERE ${idCol} = $1`, [id]);
  const row = rows[0];
  if (row && 'metadata' in row) row.metadata = parseJson(row.metadata);
  return row;
}

async function setViewDependencies(db, viewsTable, viewId, ids) {
  const arr = (ids || []).map(Number);
  if (db.type === 'postgres') {
    const lit = arr.length ? `ARRAY[${arr.join(',')}]::integer[]` : `'{}'::integer[]`;
    await db.query(`UPDATE ${viewsTable} SET view_dependencies = ${lit} WHERE view_id = $1`, [viewId]);
  } else {
    await db.query(`UPDATE ${viewsTable} SET view_dependencies = $1 WHERE view_id = $2`, [JSON.stringify(arr), viewId]);
  }
}

async function getViewsBySource(db, viewsTable, sourceId) {
  const { rows } = await db.query(`SELECT * FROM ${viewsTable} WHERE source_id = $1`, [sourceId]);
  return rows.map((r) => ({ ...r, metadata: parseJson(r.metadata) }));
}

// Resolve the meta-source view triplet exactly the way legacy did.
async function resolveMetaViews(db, viewsTable, prodView, metaSourceId) {
  const views = await getViewsBySource(db, viewsTable, metaSourceId);
  const npmrdsMetaView = views.find((v) => Number(v.view_id) === Number(prodView.metadata.npmrds_meta_view_id));
  const npmrdsGeometryView = views.find(
    (v) => Number(v.view_id) === Number(npmrdsMetaView && npmrdsMetaView.metadata.npmrds_geometry_view_id)
  );
  const subGeometryViews = views.filter(
    (v) => ![npmrdsMetaView && npmrdsMetaView.view_id, npmrdsGeometryView && npmrdsGeometryView.view_id].includes(v.view_id)
  );
  return { npmrdsMetaView, npmrdsGeometryView, subGeometryViews };
}

// ─── workers ─────────────────────────────────────────────────────────────────

function makeWorkers(depOverrides = {}) {
  const deps = { ...defaultDeps(), ...depOverrides };

  /**
   * npmrds/provision — legacy publish() provisioning.
   * descriptor: { source_id, npmrds_meta_source_id, name, user_id, email,
   *               schemaName?, tmcSpeedViewId, tmcSpeedSourceId,
   *               mpoBoundariesViewId, mpoBoundariesSourceId }
   */
  async function provision(ctx) {
    const { task, pgEnv, db, dispatchEvent, updateProgress } = ctx;
    const d = task.descriptor || {};
    const {
      source_id, npmrds_meta_source_id, name, user_id,
      schemaName = 'npmrds',
      tmcSpeedViewId, tmcSpeedSourceId, mpoBoundariesViewId, mpoBoundariesSourceId,
    } = d;
    const npmrdsMetaSchema = 'npmrds_meta';
    const viewsTable = tableFor(db, 'views');
    const sourcesTable = tableFor(db, 'sources');

    await dispatchEvent('npmrds-publish:INITIAL', 'npmrds provisioning started', { source_id });

    // 3 views: prod on the prod source; CH-meta + PG-geometry on the META source.
    const npmrdsView = await deps.createDamaView({ source_id, user_id }, pgEnv);
    const npmrdsMetaView = await deps.createDamaView({ source_id: npmrds_meta_source_id, user_id }, pgEnv);
    const npmrdsGeometryView = await deps.createDamaView({ source_id: npmrds_meta_source_id, user_id }, pgEnv);

    const table_name = sanitize(`s${source_id}_v${npmrdsView.view_id}_${name}`);
    const table_schema = `clickhouse.${schemaName}`.toLowerCase();
    const meta_table_name = sanitize(`s${npmrds_meta_source_id}_v${npmrdsMetaView.view_id}_${name}_tmc_meta`);
    const meta_table_schema = `clickhouse.${npmrdsMetaSchema}`;
    const geometry_table_name = sanitize(`s${npmrds_meta_source_id}_v${npmrdsGeometryView.view_id}_${name}_geometry`);
    const geometry_schema = 'npmrds_geometry';

    // prod view — note legacy stores the META table name/schema inside its
    // metadata (downstream consumers read it from there).
    await db.query(
      `UPDATE ${viewsTable} SET table_schema = $1, table_name = $2, data_table = $3 WHERE view_id = $4`,
      [table_schema, table_name, `${table_schema}.${table_name}`, npmrdsView.view_id]
    );
    await mergeJsonColumn(db, viewsTable, 'view_id', npmrdsView.view_id, 'metadata', {
      npmrds_meta_view_id: npmrdsMetaView.view_id,
      npmrds_geometry_view_id: npmrdsGeometryView.view_id,
      npmrds_tmc_speed_view_id: tmcSpeedViewId,
      npmrds_tmc_speed_source_id: tmcSpeedSourceId,
      npmrds_mpo_boundaries_view_id: mpoBoundariesViewId,
      npmrds_mpo_boundaries_source_id: mpoBoundariesSourceId,
      table_name: meta_table_name,
      table_schema: meta_table_schema,
      is_clickhouse_table: 1,
      npmrds_raw_view_id_to_year: {},
    });

    await db.query(
      `UPDATE ${viewsTable} SET table_schema = $1, table_name = $2, data_table = $3, version = $4 WHERE view_id = $5`,
      [meta_table_schema, meta_table_name, `${meta_table_schema}.${meta_table_name}`, 'clickhouse', npmrdsMetaView.view_id]
    );
    await mergeJsonColumn(db, viewsTable, 'view_id', npmrdsMetaView.view_id, 'metadata', {
      npmrds_view_id: npmrdsView.view_id,
      npmrds_geometry_view_id: npmrdsGeometryView.view_id,
      table_name: meta_table_name,
      table_schema: meta_table_schema,
      is_clickhouse_table: 1,
    });

    await db.query(
      `UPDATE ${viewsTable} SET table_schema = $1, table_name = $2, data_table = $3, version = $4 WHERE view_id = $5`,
      [geometry_schema, geometry_table_name, `${geometry_schema}.${geometry_table_name}`, 'pg', npmrdsGeometryView.view_id]
    );
    await mergeJsonColumn(db, viewsTable, 'view_id', npmrdsGeometryView.view_id, 'metadata', {
      npmrds_view_id: npmrdsView.view_id,
      npmrds_meta_view_id: npmrdsMetaView.view_id,
      table_name: geometry_table_name,
      table_schema: geometry_schema,
      is_clickhouse_table: 0,
    });
    await updateProgress(0.3);

    // ClickHouse: databases + prod & meta tables.
    const chDb = deps.getChDb(pgEnv);
    for (const dbName of [schemaName, npmrdsMetaSchema, 'temp']) {
      await chDb.exec({ query: `CREATE DATABASE IF NOT EXISTS ${dbName}` });
    }
    await chDb.exec({ query: ch.prodTableDDL(`${schemaName}.${table_name}`) });
    await chDb.exec({ query: ch.metaTableDDL(`${npmrdsMetaSchema}.${meta_table_name}`) });
    await updateProgress(0.6);

    // Postgres: the all-years geometry table.
    const pgDb = deps.getPgDb(pgEnv);
    await pgDb.query(`CREATE SCHEMA IF NOT EXISTS ${geometry_schema}`);
    await pgDb.query(pg.geometryTableDDL({ schema: geometry_schema, tableName: geometry_table_name, viewId: npmrdsGeometryView.view_id }));
    await pgDb.query(pg.geometryIndexDDL({ schema: geometry_schema, tableName: geometry_table_name, viewId: npmrdsGeometryView.view_id }));
    await updateProgress(0.8);

    // Source metadata: cross-links + the metadata.columns Table-page contract.
    await mergeJsonColumn(db, sourcesTable, 'source_id', source_id, 'metadata', {
      npmrds_tmc_meta_source_id: npmrds_meta_source_id,
      npmrds_production_meta_view_id: NPMRDS_PRODUCTION_META_VIEW_ID,
      columns: PROD_TABLE_COLUMNS,
      schema: 'npmrds_v1',
    });
    await mergeJsonColumn(db, sourcesTable, 'source_id', npmrds_meta_source_id, 'metadata', {
      npmrds_source_id: source_id,
      npmrds_production_meta_view_id: NPMRDS_PRODUCTION_META_VIEW_ID,
      columns: META_TABLE_COLUMNS,
      schema: 'npmrds_meta_v1',
    });

    await updateProgress(1);
    await dispatchEvent('npmrds-publish:FINAL', 'npmrds provisioning complete', {
      source_id, view_id: npmrdsView.view_id,
    });
    return {
      source_id,
      npmrds_meta_source_id,
      view_id: npmrdsView.view_id,
      npmrds_meta_view_id: npmrdsMetaView.view_id,
      npmrds_geometry_view_id: npmrdsGeometryView.view_id,
    };
  }

  // calcDirectionality, ported: per-TMC CH queries through the injected chDb.
  async function calcDirectionality({ chDb, year, metaTName, prodTable }) {
    const tmcListRs = await chDb.query({ query: ch.tmcListSQL({ dataTable: prodTable, year }), format: 'JSONEachRow' });
    const tmcRows = await tmcListRs.json();
    const directionalityByTmc = {};
    for (const { tmc } of tmcRows) {
      const metaRs = await chDb.query({ query: ch.tmcMetaQuerySQL({ metaTName, tmc }), format: 'JSONEachRow' });
      const metaRows = await metaRs.json();
      const { miles = 0, functionalClass = -1 } = metaRows[0] || {};

      const windows = {};
      for (const [key, bin] of Object.entries(BINS)) {
        const rs = await chDb.query({
          query: ch.binnedDataSQL({
            dataTable: prodTable, year, tmc,
            npmrdsDataKey: 'travel_time_all_vehicles',
            hours: bin.hours, dow: bin.dow, timeBinSize: 15,
          }),
          format: 'JSONEachRow',
        });
        windows[key] = await rs.json();
      }
      directionalityByTmc[tmc] = computeTmcDirectionality({
        miles: Number(miles), functionalClass,
        ampRows: windows.AMP, pmpRows: windows.PMP, freeflowRows: windows.FREEFLOW,
      });
    }
    return directionalityByTmc;
  }

  /**
   * npmrds/add — legacy add.worker + metadata.worker, one staged run.
   * descriptor: { source_id, view_id, npmrds_raw_view_ids, startDate, endDate,
   *               user_id, email, prodURL? }
   */
  async function add(ctx) {
    const { task, pgEnv, db, dispatchEvent, updateProgress } = ctx;
    const d = task.descriptor || {};
    const { source_id, view_id, npmrds_raw_view_ids = [], startDate, endDate, user_id } = d;
    const prodURL = d.prodURL || process.env.DAMA_PROD_URL || '';
    const viewsTable = tableFor(db, 'views');
    const sourcesTable = tableFor(db, 'sources');

    await dispatchEvent('npmrds-add:INITIAL', 'npmrds add started', { source_id, view_id, npmrds_raw_view_ids });

    // ── Phase A: raw → prod (legacy add.worker) ─────────────────────────────
    const view = await getRow(db, viewsTable, 'view_id', view_id);
    if (!view) throw new Error(`npmrds/add: prod view ${view_id} not found`);
    await dispatchEvent('npmrds-add:RETRIVED_VIEW_INFO', 'retrieved prod view', { view_id });

    const metadata = {
      ...view.metadata,
      end_date: endDate,
      start_date: startDate,
      npmrds_raw_view_ids: [...new Set([...(view.metadata.npmrds_raw_view_ids || []), ...npmrds_raw_view_ids])],
    };

    const prodTable = stripCh(view.data_table);
    const ids = npmrds_raw_view_ids.map(Number);
    const { rows: rawRows } = await db.query(
      `SELECT data_table, view_id, metadata FROM ${viewsTable} WHERE view_id IN (${ids.join(',')})`, []);
    const raw_views = rawRows.map((r) => ({ ...r, metadata: parseJson(r.metadata) }));

    // Legacy contract: exactly ONE raw view processed per add invocation.
    const rawView = raw_views[0];
    if (!rawView) throw new Error(`npmrds/add: no raw views found for ids ${ids.join(',')}`);
    const rawTable = stripCh(rawView.data_table);

    const npmrds_raw_view_id_to_year = view.metadata.npmrds_raw_view_id_to_year || {};
    if (rawView.metadata.start_date && rawView.metadata.end_date) {
      npmrds_raw_view_id_to_year[`${rawView.view_id}`] =
        new Date(rawView.metadata.start_date).getUTCFullYear();
    }
    const year = npmrds_raw_view_id_to_year[`${rawView.view_id}`];

    const chDb = deps.getChDb(pgEnv);
    await chDb.exec({ query: ch.insertRawIntoProdSQL({ prodTable, rawTable, rawViewId: rawView.view_id }) });
    await dispatchEvent('npmrds-add:START_OPTIMIZE', 'optimizing prod table', { view_id });
    await chDb.exec({ query: ch.optimizeProdSQL(prodTable) });

    metadata.npmrds_raw_view_id_to_year = npmrds_raw_view_id_to_year;
    await mergeJsonColumn(db, viewsTable, 'view_id', view_id, 'metadata', metadata);
    await updateProgress(0.25);
    await dispatchEvent('npmrds-add:FINAL', 'raw data moved to prod', { view_id, year });

    // ── Phase B: metadata (legacy metadata.worker, same staged run) ─────────
    await dispatchEvent('npmrds-add-metadata:START', 'starting metadata processing', { view_id, year });

    const source = await getRow(db, sourcesTable, 'source_id', source_id);
    const metaSourceId = source.metadata.npmrds_tmc_meta_source_id;
    const metaSource = await getRow(db, sourcesTable, 'source_id', metaSourceId);
    const prodViewNow = await getRow(db, viewsTable, 'view_id', view_id);
    const { npmrdsMetaView, npmrdsGeometryView, subGeometryViews } =
      await resolveMetaViews(db, viewsTable, prodViewNow, metaSourceId);
    if (!npmrdsMetaView || !npmrdsGeometryView) {
      throw new Error('npmrds/add: meta/geometry views not provisioned (run /publish first)');
    }
    const metaTableName = stripCh(npmrdsMetaView.data_table);

    // tmc_identification view referenced by the raw view.
    const tmcIdViewId = rawView.metadata.tmc_identification_view_id;
    const tmcIdView = await getRow(db, viewsTable, 'view_id', tmcIdViewId);
    if (!tmcIdView) throw new Error(`npmrds/add: tmc_identification view ${tmcIdViewId} not found`);
    const metaTName = stripCh(tmcIdView.data_table);

    // tmc_speed + MPO boundaries data tables (cross-source refs from publish).
    const tmcSpeedView = await getRow(db, viewsTable, 'view_id', prodViewNow.metadata.npmrds_tmc_speed_view_id);
    const mpoView = await getRow(db, viewsTable, 'view_id', prodViewNow.metadata.npmrds_mpo_boundaries_view_id);
    const tmcSpeedDataTable = tmcSpeedView && tmcSpeedView.data_table;
    const mpoBoundariesDataTable = mpoView && mpoView.data_table;

    const tempMetaViewTable = `meta_${tmcIdViewId}_${year}`;

    // Directionality + congestion per TMC (most expensive step).
    await dispatchEvent('npmrds-add-metadata:START_DIRECTIONALITY', 'computing directionality', { year });
    const directionalityByTmc = await calcDirectionality({ chDb, year, metaTName, prodTable });
    await dispatchEvent('npmrds-add-metadata:DIRECTIONALITY_COMPLETE', 'directionality computed', {
      tmcs: Object.keys(directionalityByTmc).length,
    });
    await updateProgress(0.5);

    // Temp CH enrichment table.
    await chDb.exec({ query: ch.dropTableSQL(`temp.${tempMetaViewTable}`) });
    await chDb.exec({ query: ch.tempChMetaTableDDL(tempMetaViewTable) });
    const tmcIdRs = await chDb.query({ query: ch.tmcIdEnrichmentSelectSQL(metaTName), format: 'JSONEachRow' });
    const tmcIdRows = await tmcIdRs.json();
    for (let i = 0; i < tmcIdRows.length; i += 5000) {
      const batch = tmcIdRows.slice(i, i + 5000).map((row) => enrichTmcIdRow(row, directionalityByTmc));
      await deps.chInsertRows(chDb, `temp.${tempMetaViewTable}`, batch);
    }

    // First CH meta delete+insert cycle.
    await chDb.exec({ query: ch.deleteMetaYearSQL(metaTableName, year) });
    await chDb.exec({ query: ch.insertIntoChMetaSQL({ metaTableName, metaTName, tempMetaViewTable }) });
    await chDb.exec({ query: ch.dropTableSQL(`temp.${tempMetaViewTable}`) });
    await updateProgress(0.6);

    // PG round-trip: CH meta rows → temp PG table → spatial join → geometry table.
    const chMetaRs = await chDb.query({ query: ch.selectMetaYearSQL(metaTableName, year), format: 'JSONEachRow' });
    const chMetaRows = await chMetaRs.json();
    if (!chMetaRows.length) throw new Error('npmrds/add: no rows returned from updated CH meta table');

    const pgDb = deps.getPgDb(pgEnv);
    const metaShortName = npmrdsMetaView.table_name;
    await pgDb.query('CREATE SCHEMA IF NOT EXISTS temp');
    await pgDb.query(`DROP TABLE IF EXISTS temp.${metaShortName}`);
    await pgDb.query(pg.tempPgMetaTableDDL({ table_name: metaShortName }));
    await dispatchEvent('npmrds-add-metadata:START_TEMP_PG_META', 'staging meta rows in PG', { rows: chMetaRows.length });
    for (let i = 0; i < chMetaRows.length; i += 500) {
      const rows = chMetaRows.slice(i, i + 500).map(pg.toPgRowValues);
      const { text, values } = pg.insertIntoTempPgMetaSQL({ table_name: metaShortName, rows });
      await pgDb.query(text, values);
    }
    await dispatchEvent('npmrds-add-metadata:TEMP_PG_CREATED', 'PG temp table populated', null);

    await pgDb.query(pg.deleteYearSQL(npmrdsGeometryView.data_table, year));
    await pgDb.query(pg.insertIntoPgMetaSQL({
      data_table: npmrdsGeometryView.data_table,
      table_name: metaShortName,
      tmcSpeedDataTable,
      mpoBoundariesDataTable,
    }));
    await pgDb.query(`DROP TABLE IF EXISTS temp.${metaShortName}`);
    await updateProgress(0.75);

    // Second CH meta re-insert — now with avg_speedlimit + mpo joined in.
    await chDb.exec({ query: ch.deleteMetaYearSQL(metaTableName, year) });
    const { rows: enrichedRows } = await pgDb.query(
      `SELECT * FROM ${npmrdsGeometryView.data_table} WHERE year = ${Number(year)}`);
    await dispatchEvent('npmrds-add-metadata:CH_META_BACKFILL_START', 'backfilling CH meta', { rows: enrichedRows.length });
    for (let i = 0; i < enrichedRows.length; i += 5000) {
      await deps.chInsertRows(chDb, metaTableName, enrichedRows.slice(i, i + 5000));
    }
    await dispatchEvent('npmrds-add-metadata:CH_META_BACKFILLED', 'CH meta backfilled', null);
    await updateProgress(0.85);

    // Per-year layer (tile) view + table.
    let layerView = subGeometryViews.find((v) => v.metadata.year && Number(v.metadata.year) === Number(year));
    if (!layerView) {
      layerView = await deps.createDamaView({ source_id: metaSourceId, user_id }, pgEnv);
      layerView = { ...layerView, metadata: parseJson(layerView.metadata) };
    }
    const layer_table_name = sanitize(`s${metaSourceId}_v${layerView.view_id}_${metaSource.name}_geometry`);
    const layer_schema = 'npmrds_geometry';
    const layerDataTable = `${layer_schema}.${layer_table_name}`;
    const tiles = makeTiles({
      pgEnv, prodURL, sourceId: metaSourceId, viewId: layerView.view_id, year,
    });

    await pgDb.query(`CREATE SCHEMA IF NOT EXISTS ${layer_schema}`);
    await pgDb.query(pg.perYearLayerTableDDL({ schema: layer_schema, tableName: layer_table_name, viewId: layerView.view_id }));
    await db.query(
      `UPDATE ${viewsTable} SET version = $1, table_schema = $2, table_name = $3, data_table = $4 WHERE view_id = $5`,
      [`${year} pg`, layer_schema, layer_table_name, layerDataTable, layerView.view_id]
    );
    await mergeJsonColumn(db, viewsTable, 'view_id', layerView.view_id, 'metadata', {
      npmrds_view_id: view_id,
      npmrds_meta_view_id: npmrdsMetaView.view_id,
      npmrds_geometry_view_id: npmrdsGeometryView.view_id,
      table_name: layer_table_name,
      table_schema: layer_schema,
      is_clickhouse_table: 0,
      year,
      tiles,
      num_tmc: chMetaRows.length,
    });

    await pgDb.query(pg.deleteYearSQL(layerDataTable, year));
    await pgDb.query(pg.perYearInsertSQL({ layerDataTable, geometryDataTable: npmrdsGeometryView.data_table, year }));
    await pgDb.query(pg.setSridSQL(layerDataTable));
    await updateProgress(0.95);

    // Final metadata writes downstream consumers read.
    const npmrds_meta_layer_view_id = {
      ...(source.metadata.npmrds_meta_layer_view_id || {}),
      [year]: layerView.view_id,
    };
    await mergeJsonColumn(db, sourcesTable, 'source_id', source_id, 'metadata', { npmrds_meta_layer_view_id });
    await mergeJsonColumn(db, viewsTable, 'view_id', view_id, 'metadata', metadata);
    await setViewDependencies(db, viewsTable, view_id, metadata.npmrds_raw_view_ids);

    await updateProgress(1);
    await dispatchEvent('npmrds-add-metadata:FINAL', 'npmrds add + metadata complete', {
      source_id, view_id, year, layer_view_id: layerView.view_id,
    });
    return { source_id, view_id, year, layer_view_id: layerView.view_id };
  }

  /**
   * npmrds/replace — legacy replace.worker. Partition-drops the replace_year,
   * re-inserts from the new raw views, swaps the metadata maps. Like legacy,
   * does NOT re-run the metadata phase (run /add for that).
   * Fixed vs legacy: removed view ids ARE dropped from npmrds_raw_view_id_to_year
   * (the legacy `.forEach` on a plain object silently did nothing).
   */
  async function replace(ctx) {
    const { task, pgEnv, db, dispatchEvent, updateProgress } = ctx;
    const d = task.descriptor || {};
    const {
      source_id, view_id,
      npmrds_raw_add_view_ids = [], npmrds_raw_remove_view_ids = [],
      replace_year, startDate, endDate,
    } = d;
    const viewsTable = tableFor(db, 'views');

    await dispatchEvent('npmrds-replace:INITIAL', 'npmrds replace started', { source_id, view_id, replace_year });

    const prodView = await getRow(db, viewsTable, 'view_id', view_id);
    if (!prodView) throw new Error(`npmrds/replace: prod view ${view_id} not found`);
    const prodTable = stripCh(prodView.data_table);
    const chDb = deps.getChDb(pgEnv);

    // Remove the year by dropping its 12 month partitions (atomic + fast).
    for (let month = 1; month <= 12; month++) {
      const partitionId = `${replace_year}${String(month).padStart(2, '0')}`;
      try {
        await chDb.exec({ query: ch.dropPartitionSQL(prodTable, partitionId) });
        await dispatchEvent('npmrds-replace:DATA_REMOVED', `dropped partition ${partitionId}`, { partitionId });
      } catch (err) {
        console.error(`[npmrds/replace] drop partition ${partitionId} failed:`, err.message);
      }
    }
    await updateProgress(0.4);

    // Double-check the removed views are gone (legacy best-effort check).
    if (npmrds_raw_remove_view_ids.length) {
      try {
        const rs = await chDb.query({
          query: ch.confirmRemovedSQL({ prodTable, viewIds: npmrds_raw_remove_view_ids }),
          format: 'JSONEachRow',
        });
        const lingering = await rs.json();
        if (lingering.length) {
          console.warn('[npmrds/replace] lingering view_ids after partition drop:', JSON.stringify(lingering));
        }
      } catch (err) {
        console.error('[npmrds/replace] confirm-delete check failed:', err.message);
      }
    }

    // Insert the replacement raw views.
    const npmrds_raw_view_id_to_year = prodView.metadata.npmrds_raw_view_id_to_year || {};
    const addIds = npmrds_raw_add_view_ids.map(Number);
    if (addIds.length) {
      const { rows } = await db.query(
        `SELECT data_table, view_id FROM ${viewsTable} WHERE view_id IN (${addIds.join(',')})`, []);
      for (const rawDataView of rows) {
        await chDb.exec({
          query: ch.insertRawIntoProdSQL({
            prodTable, rawTable: stripCh(rawDataView.data_table), rawViewId: rawDataView.view_id,
          }),
        });
        npmrds_raw_view_id_to_year[`${rawDataView.view_id}`] = parseInt(replace_year, 10);
      }
    }
    for (const removeId of npmrds_raw_remove_view_ids) {
      delete npmrds_raw_view_id_to_year[`${removeId}`];
    }
    await updateProgress(0.8);

    const removeSet = new Set(npmrds_raw_remove_view_ids.map(Number));
    const npmrds_raw_view_ids = [...new Set([
      ...(prodView.metadata.npmrds_raw_view_ids || []).filter((id) => !removeSet.has(Number(id))),
      ...addIds,
    ])];
    await mergeJsonColumn(db, viewsTable, 'view_id', view_id, 'metadata', {
      npmrds_raw_view_ids,
      npmrds_raw_view_id_to_year,
      ...(startDate ? { start_date: startDate } : {}),
      ...(endDate ? { end_date: endDate } : {}),
    });
    await setViewDependencies(db, viewsTable, view_id, npmrds_raw_view_ids);

    await updateProgress(1);
    await dispatchEvent('npmrds-replace:FINAL', 'npmrds replace complete', { source_id, view_id, replace_year });
    return { source_id, view_id, replace_year, npmrds_raw_view_ids };
  }

  /**
   * npmrds/remove — legacy removeNpmrds() (was inline in the HTTP handler).
   * descriptor: { source_id, view_id, npmrds_raw_removed_view_ids,
   *               startDate?, endDate?, user_id }
   */
  async function remove(ctx) {
    const { task, pgEnv, db, dispatchEvent, updateProgress } = ctx;
    const d = task.descriptor || {};
    const { source_id, view_id, npmrds_raw_removed_view_ids = [], startDate, endDate } = d;
    const viewsTable = tableFor(db, 'views');
    const sourcesTable = tableFor(db, 'sources');

    await dispatchEvent('npmrds-remove:INITIAL', 'npmrds remove started', { source_id, view_id });

    const view = await getRow(db, viewsTable, 'view_id', view_id);
    const source = await getRow(db, sourcesTable, 'source_id', source_id);
    const { npmrdsMetaView, npmrdsGeometryView, subGeometryViews } =
      await resolveMetaViews(db, viewsTable, view, source.metadata.npmrds_tmc_meta_source_id);
    await dispatchEvent('npmrds-remove:RETRIVED_VIEW_INFO', 'retrieved views', { view_id });

    const year = (view.metadata.npmrds_raw_view_id_to_year || {})[`${npmrds_raw_removed_view_ids[0]}`];
    const removedSet = new Set(npmrds_raw_removed_view_ids.map(Number));
    const metadata = {
      ...view.metadata,
      end_date: endDate,
      start_date: startDate,
      npmrds_raw_view_ids: (view.metadata.npmrds_raw_view_ids || []).filter((x) => !removedSet.has(Number(x))),
      npmrds_raw_view_id_to_year: Object.fromEntries(
        Object.entries(view.metadata.npmrds_raw_view_id_to_year || {})
          .filter(([key]) => !removedSet.has(Number(key)))
      ),
      is_clickhouse_table: 1,
    };

    const prodTable = stripCh(view.data_table);
    const chDb = deps.getChDb(pgEnv);
    await dispatchEvent('npmrds-remove:START_DELETING_FROM_TABLE', 'deleting from prod table', null);
    for (const removedViewId of npmrds_raw_removed_view_ids) {
      await chDb.exec({ query: ch.deleteProdViewIdSQL(prodTable, removedViewId) });
    }
    await chDb.exec({ query: ch.optimizeProdSQL(prodTable) });
    await dispatchEvent('npmrds-remove:END_DELETING_FROM_TABLE', 'prod table cleaned', null);
    await updateProgress(0.5);

    // If the year is now orphaned, clean meta + geometry + per-year layer.
    await dispatchEvent('npmrds-remove:START_DELETING_FROM_META_AND_GEOMETRY_TABLE', 'cleaning meta/geometry', null);
    const yearStillReferenced = Object.values(metadata.npmrds_raw_view_id_to_year).includes(year);
    if ((!startDate && !endDate) || (!yearStillReferenced && metadata.npmrds_meta_view_id)) {
      const pgDb = deps.getPgDb(pgEnv);
      await pgDb.query(pg.deleteYearSQL(npmrdsGeometryView.data_table, year));
      await chDb.exec({
        query: `${ch.deleteMetaYearSQL(stripCh(npmrdsMetaView.data_table), year)} SETTINGS max_memory_usage = 0, max_execution_time = 0, mutations_sync = 2`,
      });
      const layerView = subGeometryViews.find(
        (v) => v.metadata.year && Number(v.metadata.year) === Number(year));
      if (layerView) {
        await pgDb.query(pg.deleteYearSQL(layerView.data_table, year));
      }
    }
    await dispatchEvent('npmrds-remove:END_DELETING_FROM_META_AND_GEOMETRY_TABLE', 'meta/geometry cleaned', null);
    await updateProgress(0.8);

    await mergeJsonColumn(db, viewsTable, 'view_id', view_id, 'metadata', metadata);
    await setViewDependencies(db, viewsTable, view_id, metadata.npmrds_raw_view_ids);
    // Legacy pruned the tiles entries for the removed year off the geometry view.
    const geomTiles = npmrdsGeometryView.metadata.tiles || {};
    await mergeJsonColumn(db, viewsTable, 'view_id', npmrdsGeometryView.view_id, 'metadata', {
      tiles: removeByYear(geomTiles.sources, geomTiles.layers, year),
    });

    await updateProgress(1);
    await dispatchEvent('npmrds-remove:FINAL', 'npmrds remove complete', { source_id, view_id, year });
    return { source_id, view_id, year };
  }

  return { provision, add, replace, remove };
}

const workers = makeWorkers();

module.exports = {
  makeWorkers,
  workers,
  PROD_TABLE_COLUMNS,
  META_TABLE_COLUMNS,
};
