/**
 * pm3 publish worker — per-year, per-TMC, PER-METRIC orchestrator.
 *
 * pm3 is a re-parametrization of map21 (see data-types/map21/worker.js, a
 * READ-ONLY dependency whose calculators/helpers are REUSED here, never
 * copied). Where it deliberately differs from map21:
 *
 *   - 11 metrics, not 3: speed_pctl (pm3-only, ./speedPercentilesCalculator),
 *     lottr, tttr, and the full phed/ted family (speed-limit + freeflow
 *     thresholds, all-vehicles + truck).
 *   - PERMISSIVE checkMeta: legacy pm3 commented out every map21 meta gate —
 *     a TMC is skipped only when it has no meta row at all.
 *   - Per-metric DB writes (legacy METRIC_WRITES_DB=true): each metric result
 *     is upserted on its own against the named UNIQUE(tmc, year) constraint,
 *     with LOWERCASE metric-prefixed columns (legacy LOWER_CASE_COLUMNS=true,
 *     no FHWA header renames, no HPMS CSV).
 *   - Output lives in the `pm3` schema; multi-year rows
 *     (UNIQUE(tmc, year), deletes by `year in (...)` — not map21's
 *     single-year begindate regex).
 *   - Writes tiles metadata + rawViewIdsUsed to the view.
 *
 * ## Two relations per view (geometry de-duplication, 2026-08-07)
 *
 * `views.table_name` is a **Postgres VIEW**, not a table:
 *
 *   pm3.s{src}_v{view}_pm_3_metrics   table — ogc_fid, tmc, year + metric columns
 *   pm3.s{src}_v{view}_pm_3           view  — metrics ⋈ the year's npmrds_meta
 *                                             geometry table, adding wkb_geometry
 *                                             and the other 23 TMC attributes
 *
 * pm3 used to materialize all 25 static columns per view, which made geometry
 * 44.5% of every pm3 table (28 MB of 62 MB for 2025) and pinned each view to
 * whatever network vintage was current when it ran. It also drifted: live views
 * for 2021-23 have no `miles`/`directionalaadt` columns at all and 2024 has them
 * all-NULL. Reading them live through the view fixes both.
 *
 * Nothing downstream changes — tiles, colorDomain, the UDA table/filters,
 * gis-dataset/create-download and the macroview plugin all resolve
 * `views.table_name` and see the same columns, in the same order, with the same
 * types and values (verified: 0 diffs across 25 columns × 52,127 rows).
 *
 * The one hard requirement is a GIST index on the npmrds_meta geometry table —
 * those tables ship without one, and without it a single z9 tile takes 255s
 * instead of 22ms. `ensureMetaGeometryIndex` creates it idempotently per year.
 *
 * Structural changes vs the legacy publish.worker.mjs follow the map21 port:
 * flat ctx.task.descriptor, db/chDb adapters, ctx.dispatchEvent/updateProgress.
 * Dependency-injected via makeWorker(deps) so tests stub ClickHouse and route
 * all PHYSICAL data-table SQL through a recording `dataDb`.
 */

const {
  BIN_NAMES,
  ALL_VEHICLES,
  FREIGHT_TRUCKS,
  NPMRDS_CH_SCHEMA_NAME,
  PERCENTILES_FOR_MEASURES,
} = require('../map21/constants.js');
const {
  createDataTable,
  getListTmcId,
  generateTmcIdMetaQuery,
} = require('../map21/helpers.js');
const { calcTtrMeasure } = require('../map21/calcTtrMeasure.js');
const { calcPhed } = require('../map21/calcPhed.js');
const { speedPercentilesCalculator, PERCENTILES } = require('./speedPercentilesCalculator.js');
const {
  toMetricDbRow,
  generateUpdateColumnsSql,
  getDataRowInsertSql,
  META_COLUMNS,
  NUMERIC_META_COLUMNS,
  metaColumnType,
  buildAddMetaColumnsSql,
  buildPm3ViewSql,
} = require('./helpers.js');

// ── Metric registry ──────────────────────────────────────────────────────────

const PHED_TRUCK_CONFIG = {
  npmrdsDataKeys: FREIGHT_TRUCKS,
  secondaryDataKey: ALL_VEHICLES,
  avoKey: 'avgvehicleoccupancytruck',
  dirAadtKey: 'directionalaadttruck',
};
const PHED_ALL_VEHICLES_CONFIG = {
  npmrdsDataKeys: ALL_VEHICLES,
  avoKey: 'avg_vehicle_occupancy',
  dirAadtKey: 'directionalaadt',
};

// The CH meta table for speed_pctl is only known at run time, so the full
// config map is built per run.
//
// `kind` drives column-name enumeration for metadata.columns (see
// buildPm3SourceColumns) — it must describe the shape of the keys the
// calculator returns, so it stays next to the calculator it belongs to.
function buildMetricConfigs({ chMetaTableName }) {
  return {
    speed_pctl: {
      kind: 'speed_pctl',
      npmrdsDataKeys: ALL_VEHICLES,
      calculator: speedPercentilesCalculator,
      timeBins: [BIN_NAMES.ALL],
      metadataTable: chMetaTableName,
    },
    lottr: {
      kind: 'ttr',
      timeBins: [BIN_NAMES.AMP, BIN_NAMES.MIDD, BIN_NAMES.PMP, BIN_NAMES.WE],
      npmrdsDataKeys: ALL_VEHICLES,
      calculator: calcTtrMeasure,
    },
    tttr: {
      kind: 'ttr',
      timeBins: [BIN_NAMES.AMP, BIN_NAMES.MIDD, BIN_NAMES.PMP, BIN_NAMES.WE, BIN_NAMES.OVN],
      npmrdsDataKeys: FREIGHT_TRUCKS,
      secondaryDataKey: ALL_VEHICLES,
      calculator: calcTtrMeasure,
    },
    phed: {
      kind: 'phed',
      ...PHED_ALL_VEHICLES_CONFIG,
      calculator: calcPhed,
      thresholdSpeedVersion: 'speed_limit',
      timeBins: [BIN_NAMES.AMP, BIN_NAMES.ALT_PMP],
    },
    phed_freeflow: {
      kind: 'phed',
      ...PHED_ALL_VEHICLES_CONFIG,
      calculator: calcPhed,
      thresholdSpeedVersion: 'freeflow',
      timeBins: [BIN_NAMES.AMP, BIN_NAMES.ALT_PMP],
    },
    phed_truck: {
      kind: 'phed',
      ...PHED_TRUCK_CONFIG,
      calculator: calcPhed,
      thresholdSpeedVersion: 'speed_limit',
      timeBins: [BIN_NAMES.AMP, BIN_NAMES.ALT_PMP],
    },
    phed_truck_freeflow: {
      kind: 'phed',
      ...PHED_TRUCK_CONFIG,
      calculator: calcPhed,
      thresholdSpeedVersion: 'freeflow',
      timeBins: [BIN_NAMES.AMP, BIN_NAMES.ALT_PMP],
    },
    ted: {
      kind: 'phed',
      ...PHED_ALL_VEHICLES_CONFIG,
      calculator: calcPhed,
      thresholdSpeedVersion: 'speed_limit',
      timeBins: [BIN_NAMES.ALL],
    },
    ted_freeflow: {
      kind: 'phed',
      ...PHED_ALL_VEHICLES_CONFIG,
      calculator: calcPhed,
      thresholdSpeedVersion: 'freeflow',
      timeBins: [BIN_NAMES.ALL],
    },
    ted_truck: {
      kind: 'phed',
      ...PHED_TRUCK_CONFIG,
      calculator: calcPhed,
      thresholdSpeedVersion: 'speed_limit',
      timeBins: [BIN_NAMES.ALL],
    },
    ted_truck_freeflow: {
      kind: 'phed',
      ...PHED_TRUCK_CONFIG,
      calculator: calcPhed,
      thresholdSpeedVersion: 'freeflow',
      timeBins: [BIN_NAMES.ALL],
    },
  };
}

const METRIC_NAMES = Object.keys(buildMetricConfigs({ chMetaTableName: '' }));

// ── Permissive meta gate ─────────────────────────────────────────────────────
// Legacy pm3 commented out every one of map21's rules — only the existence of
// a meta row is required. Deliberate: pm3 keeps non-NHS / non-primary / rural
// TMCs that the FHWA submittal excludes.
function checkMeta({ tmcMeta }) {
  if (!tmcMeta) return false;
  return true;
}

// TMC attributes pulled from the per-year meta layer (legacy pm3 list — wider
// than map21's: adds geography, geometry, truck AVO/AADT).
const TMC_META_DATA_KEYS = [
  'tmc', 'urban_code', 'isprimary', 'direction', 'directionalAadt',
  'avgVehicleOccupancyTruck', 'directionalAadtTruck', 'avg_speedlimit', 'miles',
  'avg_vehicle_occupancy', 'functionalClass', 'congestion_level', 'directionality',
  'nhs', 'nhs_pct', 'f_system', 'faciltype', 'state_code', 'active_start_date',
  'region_code', 'county', 'ua_name', 'mpo_code', 'mpo_name', 'wkb_geometry', 'year',
];

// ── Source metadata.columns ──────────────────────────────────────────────────
// Enumerated FROM THE METRIC REGISTRY rather than hand-listed, because the
// macroview map builds column names by string construction (see
// themes/transportny/components/macroview/updateFilters.jsx `getMeasure`) and
// the download-modal column picker + the UDA table page read this list. A
// hand-maintained list drifts, and the symptom is a map that renders a column
// the author cannot select for download. The `metadata.columns ≡ physical
// columns` test in tests/source-columns.unit.test.mjs is the regression guard.
//
// PERCENTILES_FOR_MEASURES supplies the TTR percentile labels; calcTtrMeasure
// writes `${bin}_${metric}_${pct*100}_PCT` (calcTtrMeasure.js:155-160), and
// calcPhed relabels the ALT_PMP bin as PMP on write (calcPhed.js:152).
const PHED_UNIT_SUFFIXES = [
  ['all_xdelay_phrs', 'Person-Hours of Delay'],
  ['all_xdelay_vhrs', 'Vehicle-Hours of Delay'],
  ['xdelay_hrs', 'Excessive Delay (hrs)'],
];

const titleize = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
const binLabel = (bin) => (bin === BIN_NAMES.ALT_PMP ? BIN_NAMES.PMP : bin).toLowerCase();

function metricColumnDescriptors(metricName, config) {
  const out = [];
  const push = (name, display_name) => out.push({ name, display_name, type: 'NUMERIC', desc: null });
  const M = metricName.toUpperCase();

  if (config.kind === 'speed_pctl') {
    for (const p of PERCENTILES) push(`${metricName}_${p}`, `Speed ${p}th Pctl`);
    return out;
  }

  if (config.kind === 'ttr') {
    const { upperPercentile, lowerPercentile } = PERCENTILES_FOR_MEASURES[metricName];
    const upper = `${upperPercentile * 100}_pct`;
    const lower = `${lowerPercentile * 100}_pct`;
    for (const bin of config.timeBins) {
      const b = binLabel(bin);
      push(`${metricName}_${b}_${metricName}`, `${M} ${b.toUpperCase()}`);
      push(`${metricName}_${b}_${metricName}_${upper}`,
        `${M} ${b.toUpperCase()} ${upperPercentile * 100}th Pctl Travel Time`);
      push(`${metricName}_${b}_${metricName}_${lower}`,
        `${M} ${b.toUpperCase()} ${lowerPercentile * 100}th Pctl Travel Time`);
    }
    return out;
  }

  if (config.kind === 'phed') {
    // Per-bin columns, then the annual accumulators calcPhed always returns.
    for (const bin of config.timeBins) {
      const b = binLabel(bin);
      for (const [suffix, label] of PHED_UNIT_SUFFIXES) {
        push(`${metricName}_${b}_${suffix}`, `${M} ${b.toUpperCase()} ${label}`);
      }
    }
    for (const [suffix, label] of PHED_UNIT_SUFFIXES) {
      push(`${metricName}_${suffix}`, `${M} ${label} (annual)`);
    }
    return out;
  }

  throw new Error(`metricColumnDescriptors: unknown metric kind "${config.kind}" for ${metricName}`);
}

function buildPm3SourceColumns(metricConfigs = buildMetricConfigs({ chMetaTableName: '' })) {
  const cols = [];
  const seen = new Set();
  const add = (c) => { if (!seen.has(c.name)) { seen.add(c.name); cols.push(c); } };

  for (const c of META_COLUMNS) {
    if (c === 'wkb_geometry') { add({ name: c, display_name: 'Geometry', type: 'GEOMETRY', desc: null }); continue; }
    add({
      name: c,
      display_name: titleize(c),
      type: NUMERIC_META_COLUMNS.includes(c) ? 'NUMERIC' : 'TEXT',
      desc: null,
    });
  }
  for (const [metricName, config] of Object.entries(metricConfigs)) {
    for (const c of metricColumnDescriptors(metricName, config)) add(c);
  }
  return cols;
}
const PM3_SOURCE_COLUMNS = buildPm3SourceColumns();

// ── Small utilities ──────────────────────────────────────────────────────────

const parseJson = (v) => (typeof v === 'string' ? (v ? JSON.parse(v) : {}) : (v || {}));
const tableFor = (db, base) => (db.type === 'postgres' ? `data_manager.${base}` : base);

function formatYyyyMmDd(input) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// The metrics table's name. `views.table_name` stays the legacy `_pm_3` name
// and is the metrics⋈geometry VIEW; the metrics table sits beside it.
const metricsTableName = (table_name) => `${table_name}_metrics`;

// Metric columns actually present on the metrics table. Columns arrive via
// ADD COLUMN IF NOT EXISTS as each metric is computed, so the view can only be
// built after the year loop — and a run where a metric produced nothing still
// yields a valid view.
async function readMetricColumns(dataDb, table_schema, table_name) {
  const { rows } = await dataDb.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2
     ORDER BY ordinal_position`,
    [table_schema, table_name]
  );
  const excluded = new Set(['ogc_fid', ...META_COLUMNS]);
  return rows.map((r) => r.column_name).filter((c) => !excluded.has(c));
}

/**
 * The joined view needs a spatial index on the npmrds_meta geometry table or
 * every tile degenerates into a per-row ST_Intersects nested loop (measured
 * 2026-08-07: 255s vs 22ms for one z9 tile). These tables ship WITHOUT one, so
 * create it idempotently. It is additive, ~2MB per year, benefits every other
 * reader of that table (npmrds_meta's own tile views included), and is
 * deliberately NOT `CONCURRENTLY` — that cannot run inside the worker's
 * transaction and the tables are small enough (~50k rows, ~0.2s) not to need it.
 */
async function ensureMetaGeometryIndex(dataDb, { table_schema, table_name }) {
  const idxName = `${table_name}_wkb_geometry_gist`.slice(0, 63);
  await dataDb.query(
    `CREATE INDEX IF NOT EXISTS ${idxName}
     ON ${table_schema}.${table_name} USING GIST (wkb_geometry)`
  );
  return idxName;
}

// Read-modify-write a JSON column (portable across sqlite TEXT / pg JSONB).
async function mergeJsonColumn(db, table, idCol, id, col, patch) {
  const { rows } = await db.query(`SELECT ${col} FROM ${table} WHERE ${idCol} = $1`, [id]);
  const cur = rows[0] && rows[0][col];
  const obj = parseJson(cur);
  const next = { ...obj, ...patch };
  await db.query(`UPDATE ${table} SET ${col} = $1 WHERE ${idCol} = $2`, [JSON.stringify(next), id]);
  return next;
}

const PROD_URL = process.env.DAMA_PROD_URL || process.env.PROD_URL || '';

function defaultDeps() {
  return {
    getChDb: require('@availabs/dms-server/src/db').getChDb,
    createDamaView: require('@availabs/dms-server/src/dama/upload/metadata').createDamaView,
    ensureSchema: require('@availabs/dms-server/src/dama/upload/metadata').ensureSchema,
    dataDb: null, // physical-table SQL adapter; defaults to ctx.db at run time
  };
}

function makeWorker(depOverrides = {}) {
  const deps = { ...defaultDeps(), ...depOverrides };

  return async function pm3Publish(ctx) {
    const { task, pgEnv, db, dispatchEvent, updateProgress } = ctx;
    const dataDb = deps.dataDb || db;

    const {
      source_id,
      view_id,                 // optional — append to / reprocess an existing view
      npmrdsSourceId,
      years,
      customViewAttributes,
      viewMetadata,
      viewDependency,
      newVersion,
      percentTmc = 100,
      dates = [],
      user_id,
      email,
      isNewSourceCreate = false,
      skipSpeedPctl = false,
    } = task.descriptor || {};

    if (!source_id) throw new Error('source_id is required');
    if (!npmrdsSourceId) throw new Error('npmrdsSourceId is required');
    if (!Array.isArray(years) || years.length === 0) throw new Error('years (non-empty array) is required');

    const areDatesValid = dates.length === 2 && dates[0] !== '' && dates[1] !== '';
    const formattedDates = areDatesValid ? dates.map(formatYyyyMmDd) : [];

    let chDb;
    try {
      chDb = deps.getChDb(pgEnv);
    } catch (e) {
      throw new Error(`pm3 needs ClickHouse on pgEnv ${pgEnv}: ${e.message}`);
    }

    await dispatchEvent('pm3:INITIAL', `pm3 publish started: years=${years.join(',')}`, {
      source_id, view_id: view_id || null, years,
    });
    await updateProgress(0.02);

    const viewsTable = tableFor(db, 'views');
    const sourcesTable = tableFor(db, 'sources');

    // ── 1. Resolve or create the view (pm3 schema) ──────────────────────────
    let damaView;
    if (view_id) {
      const { rows } = await db.query(
        `SELECT * FROM ${viewsTable} WHERE source_id = $1 AND view_id = $2`,
        [source_id, view_id]
      );
      if (!rows[0]) throw new Error(`No view found: source_id=${source_id} view_id=${view_id}`);
      damaView = rows[0];
      // Clear the years being reprocessed — by `year` column (multi-year table),
      // NOT map21's begindate regex. Targets the METRICS TABLE; table_name is
      // the joined view, which is not writable.
      await dataDb.query(
        `DELETE FROM ${damaView.table_schema}.${metricsTableName(damaView.table_name)}
         WHERE year in (${years.join(',')})`
      );
      await dispatchEvent('pm3:VIEW_READY', `appending to existing view ${view_id}`,
        { view_id, table: `${damaView.table_schema}.${damaView.table_name}` });
    } else {
      damaView = await deps.createDamaView({
        source_id,
        user_id,
        // etl_context_id is deliberately NOT set: data_manager.views has
        // views_etl_ctx_id_fkey → the LEGACY data_manager.etl_contexts table, and
        // a new-runner task_id has no row there, so passing it fails the insert
        // outright on any pgEnv that still has the FK (npmrds2 does). The new-path
        // convention is to carry the task id in metadata instead — see
        // dms-server/src/dama/upload/workers/csv-publish.js:28.
        metadata: {
          ...(customViewAttributes || {}),
          ...(viewMetadata || {}),
          npmrds_prod_source_id: npmrdsSourceId,
          year: years,
          dates,
          email,
          task_id: task.task_id,
        },
        view_dependencies: viewDependency,
      }, pgEnv);

      if (newVersion) {
        await db.query(`UPDATE ${viewsTable} SET version = $1 WHERE view_id = $2`,
          [String(newVersion), damaView.view_id]);
      }

      // Re-point the per-view table at the pm3 schema (createDamaView defaults
      // to gis_datasets).
      await deps.ensureSchema(dataDb, 'pm3');
      await db.query(
        `UPDATE ${viewsTable} SET table_schema = $1, data_table = $2 WHERE view_id = $3`,
        ['pm3', `pm3.${damaView.table_name}`, damaView.view_id]
      );
      damaView.table_schema = 'pm3';
      damaView.data_table = `pm3.${damaView.table_name}`;

      await dispatchEvent('pm3:VIEW_READY', `created view ${damaView.view_id}`,
        { view_id: damaView.view_id, table: `pm3.${damaView.table_name}` });
    }
    const { table_schema, table_name } = damaView;
    await updateProgress(0.05);

    // ── 2. Prod NPMRDS source: data table, raw-view→year map, CH meta table ─
    const { rows: prodViewRows } = await db.query(
      `SELECT * FROM ${viewsTable} WHERE source_id = $1`,
      [npmrdsSourceId]
    );
    if (!prodViewRows[0]) throw new Error(`No prod NPMRDS view found for source_id=${npmrdsSourceId}`);
    const prodView = prodViewRows[0];
    const prodViewMeta = parseJson(prodView.metadata);
    const dataTableName = prodView.table_name;
    const npmrdsRawByYear = prodViewMeta.npmrds_raw_view_id_to_year || {};

    // ClickHouse TMC meta table for speed_pctl (legacy contract: carried on the
    // prod view metadata with a clickhouse. schema prefix).
    const chMetaTableName = (prodViewMeta.table_schema && prodViewMeta.table_name)
      ? `${prodViewMeta.table_schema}.${prodViewMeta.table_name}`.replace(/^clickhouse\./, '')
      : null;

    const { rows: prodSrcRows } = await db.query(
      `SELECT metadata FROM ${sourcesTable} WHERE source_id = $1`,
      [npmrdsSourceId]
    );
    const npmrdsMetaLayerByYear = parseJson(prodSrcRows[0] && prodSrcRows[0].metadata).npmrds_meta_layer_view_id || {};

    let metricConfigs = buildMetricConfigs({ chMetaTableName });
    if (!chMetaTableName) {
      // A pm3 year with no speed percentiles is a broken year — live view 3566
      // (2017) is exactly that and silently renders a blank map when the
      // macroview's "Percentile Speed" measure is selected. Fail loudly unless
      // the caller opted out on purpose.
      if (!skipSpeedPctl) {
        throw new Error(
          `pm3: cannot resolve the ClickHouse TMC meta table for speed_pctl — prod view ` +
          `${prodView.view_id} (source ${npmrdsSourceId}) has no metadata.table_schema/table_name. ` +
          `Pass skipSpeedPctl: true to publish the other 10 metrics without it.`
        );
      }
      await dispatchEvent('pm3:WARN',
        'skipSpeedPctl: prod view metadata has no table_schema/table_name — skipping speed_pctl', {});
      const { speed_pctl, ...rest } = metricConfigs;
      metricConfigs = rest;
    }
    const metricNames = Object.keys(metricConfigs);

    // ── 3. Metrics table: join key + UNIQUE(tmc, year) ──────────────────────
    // Metrics only. Geometry and the other 23 TMC attributes are NOT copied
    // here — they come from the year's npmrds_meta geometry table through the
    // view built in step 5, so there is exactly one copy of the network per
    // year in the database instead of one per pm3 view.
    const metricsTable = metricsTableName(table_name);
    await createDataTable({ db: dataDb, table_schema, table_name: metricsTable, columns: false });
    await dataDb.query(buildAddMetaColumnsSql({ table_schema, table_name: metricsTable }));

    const constraintName = `tmc_year_${damaView.view_id}_constraint`;
    try {
      await dataDb.query(`
        ALTER TABLE
          ${table_schema}.${metricsTable}
        ADD CONSTRAINT ${constraintName} UNIQUE(tmc, year)
      `);
    } catch (e) {
      // expected when appending to an existing view
      console.log(`[pm3] add constraint skipped: ${e.message}`);
    }

    // ── 4. Per-year / per-TMC / per-metric processing ────────────────────────
    const rawViewIdsUsed = [];
    // year → 'schema.table' of the npmrds_meta geometry table the year's
    // attributes came from. Load-bearing: the view in step 5 joins these, and
    // persisting them means the view can be rebuilt without re-deriving them.
    const metaTableByYear = {};
    const metaLayerViewIdByYear = {};
    for (let yi = 0; yi < years.length; yi++) {
      const year = years[yi];
      const yearStr = String(year);

      rawViewIdsUsed.push(...Object.keys(npmrdsRawByYear).filter(
        (rViewId) => String(npmrdsRawByYear[rViewId]) === yearStr
      ));

      const metaLayerViewId = npmrdsMetaLayerByYear[year];
      if (!metaLayerViewId) {
        throw new Error(`No npmrds_meta_layer_view_id for year ${year} on prod source ${npmrdsSourceId}`);
      }
      const { rows: metaLayerRows } = await db.query(
        `SELECT table_schema, table_name FROM ${viewsTable} WHERE view_id = $1`,
        [metaLayerViewId]
      );
      if (!metaLayerRows[0]) throw new Error(`No meta-layer view found: view_id=${metaLayerViewId}`);
      const metaLayer = metaLayerRows[0];
      metaTableByYear[year] = `${metaLayer.table_schema}.${metaLayer.table_name}`;
      metaLayerViewIdByYear[year] = metaLayerViewId;

      // The view's tiles are unusable without this (see ensureMetaGeometryIndex).
      if (dataDb.type === 'postgres') {
        const idxName = await ensureMetaGeometryIndex(dataDb, metaLayer);
        console.log(`[pm3] meta geometry index ensured: ${metaLayer.table_schema}.${idxName}`);
      }

      const tmcResp = await getListTmcId({
        chDb,
        dataTableName: `${NPMRDS_CH_SCHEMA_NAME}.${dataTableName}`,
        year,
      });
      const allTmcIds = (tmcResp?.data || []).map((r) => r.tmc);
      const numTmcToProcess = Math.floor((allTmcIds.length * percentTmc) / 100);
      const everyN = Math.max(1, Math.floor(numTmcToProcess / 25));

      await dispatchEvent('pm3:start', `year=${year} tmcs=${numTmcToProcess}/${allTmcIds.length}`, {
        etl_context_id: task.task_id,
        damaSourceId: source_id,
        damaViewId: damaView.view_id,
        npmrds_prod_source_id: npmrdsSourceId,
        year,
      });

      let processed = 0;
      for (let i = 0; i < numTmcToProcess; i++) {
        const curTmcId = allTmcIds[i];

        const tmcMetaQuery = generateTmcIdMetaQuery({
          metaTName: `${metaLayer.table_schema}.${metaLayer.table_name}`,
          dataKeys: TMC_META_DATA_KEYS,
          tmc: curTmcId,
        });
        const { rows: tmcMetaRows } = await dataDb.query(tmcMetaQuery);
        const tmcMeta = tmcMetaRows[0];

        if (!checkMeta({ tmcMeta })) {
          console.log(`[pm3] no meta row for tmc ${curTmcId}, skipping`);
          continue;
        }

        // Seed the join-key row so the per-metric upserts have something to
        // conflict against. The 23 attribute columns this used to copy (and the
        // geometry) now come from the view — `tmcMeta` is still read in full
        // because the CALCULATORS need avg_speedlimit / AADT / AVO /
        // functionalclass / congestion_level / directionality / nhs_pct.
        await dataDb.query(
          `INSERT INTO ${table_schema}.${metricsTable} (tmc, year) VALUES ($1, $2)
           ON CONFLICT ON CONSTRAINT ${constraintName} DO NOTHING`,
          [curTmcId, tmcMeta.year]
        );

        const commonMetricConfig = {
          db: dataDb, chDb, pgEnv,
          curTmcId,
          damaSourceId: source_id,
          viewId: damaView.view_id,
          year,
          dates: formattedDates,
          user_id, email,
          table_name: metricsTable, table_schema,
          dataTableName,
          etl_context_id: task.task_id,
          tmcMeta,
          // legacy flags carried for any code path that reads them
          pm3Config: { METRIC_WRITES_DB: true, WRITE_TO_CSV: false, COMPARE_AGAINST_HISTORIC: false, ANALYSIS: false, LOWER_CASE_COLUMNS: true },
          dataTableConstraint: `ON CONSTRAINT ${constraintName}`,
        };

        for (const metricName of metricNames) {
          const result = await metricConfigs[metricName].calculator({
            ...commonMetricConfig,
            ...metricConfigs[metricName],
            metricName,
          });
          if (!result) continue; // calcPhed returns undefined on missing meta fields

          // Per-metric write (METRIC_WRITES_DB=true): lowercase, prefix, upsert.
          const dbRow = toMetricDbRow(result);
          await dataDb.query(generateUpdateColumnsSql({
            tmcRow: { ...dbRow, year },
            metricName, table_schema, table_name: metricsTable,
          }));
          try {
            await dataDb.query(getDataRowInsertSql({
              result: { ...dbRow, year },
              table_schema, table_name: metricsTable,
              prefix: metricName,
              constraint: `ON CONSTRAINT ${constraintName}`,
            }));
          } catch (e) {
            console.error(`[pm3] ${metricName} insert failed tmc=${curTmcId}: ${e.message}`);
          }
        }

        processed++;
        if (i % everyN === 0) {
          const pct = Math.floor((i / numTmcToProcess) * 100);
          await dispatchEvent('pm3:progress', `year=${year} ${pct}%`, {
            etl_context_id: task.task_id,
            damaSourceId: source_id,
            damaViewId: damaView.view_id,
            data: { progress: pct, year },
          });
          const yearProgress = (yi + (i / numTmcToProcess)) / years.length;
          await updateProgress(0.05 + 0.85 * yearProgress);
        }
      }
      console.log(`[pm3] year=${year} processed ${processed} TMCs (out of ${allTmcIds.length})`);
    }
    await updateProgress(0.92);

    // ── 5. The metrics ⋈ geometry view registered as views.table_name ───────
    // Rebuilt on every publish (DROP then CREATE, not CREATE OR REPLACE, since
    // the output column list changes whenever a run adds a metric column or a
    // year). Anything that resolves the view through views.table_name — tiles,
    // colorDomain, the UDA table/filters, gis-dataset/create-download, the
    // macroview plugin — sees the same relation shape it always did.
    if (dataDb.type === 'postgres') {
      const metricColumns = await readMetricColumns(dataDb, table_schema, metricsTable);
      if (!metricColumns.length) {
        throw new Error(
          `pm3: metrics table ${table_schema}.${metricsTable} has no metric columns — ` +
          `every TMC was skipped or every calculator returned nothing; refusing to build an empty view`
        );
      }
      // Appending a year to an existing view: keep the branches already there.
      const existingMeta = parseJson(damaView.metadata);
      const mergedMetaByYear = {
        ...(existingMeta.npmrds_meta_layer_table || {}),
        ...metaTableByYear,
      };
      await dataDb.query(`DROP VIEW IF EXISTS ${table_schema}.${table_name}`);
      await dataDb.query(buildPm3ViewSql({
        viewName: `${table_schema}.${table_name}`,
        metricsTable: `${table_schema}.${metricsTable}`,
        metaTableByYear: mergedMetaByYear,
        metricColumns,
      }));
      await dispatchEvent('pm3:VIEW_BUILT',
        `built ${table_schema}.${table_name} over ${metricColumns.length} metric columns`,
        { years: Object.keys(mergedMetaByYear), metricColumns: metricColumns.length });
    }

    // ── 6. Tiles metadata + rawViewIdsUsed ──────────────────────────────────
    const layerName = `s${source_id}_v${damaView.view_id}`;
    const timestamp = new Date().getTime();
    const tilesetName = `${pgEnv}_${layerName}_${years.join('_')}_${timestamp}`;
    const tiles = {
      sources: [
        {
          id: tilesetName,
          source: {
            tiles: [
              `${PROD_URL}/dama-admin/${pgEnv}/tiles/${damaView.view_id}/{z}/{x}/{y}/t.pbf?cols=tmc&filter=year=${years.join(',')}`,
            ],
            format: 'pbf',
            type: 'vector',
          },
        },
      ],
      layers: [
        {
          id: `s${source_id}_v${damaView.view_id}_tMultiLineString`,
          type: 'line',
          paint: { 'line-color': 'black', 'line-width': 1 },
          source: tilesetName,
          'source-layer': `view_${damaView.view_id}`,
        },
      ],
    };

    // No GIST index here any more — the geometry lives on the npmrds_meta
    // table, and its index is ensured per year in the loop above.
    await mergeJsonColumn(db, viewsTable, 'view_id', damaView.view_id, 'metadata', {
      tiles,
      rawViewIdsUsed,
      // Provenance for the view's join, and what a rebuild reads.
      npmrds_meta_layer_view_id: metaLayerViewIdByYear,
      npmrds_meta_layer_table: metaTableByYear,
      pm3_metrics_table: `${table_schema}.${metricsTable}`,
    });

    // ── 7. Source metadata.columns (lowercase pm3 descriptors) ──────────────
    // Guarded: keeps a hand-edited column list (see data-types/CLAUDE.md).
    const { rows: srcMetaRows } = await db.query(
      `SELECT metadata FROM ${sourcesTable} WHERE source_id = $1`, [source_id]
    );
    const existingSrcMeta = parseJson(srcMetaRows[0] && srcMetaRows[0].metadata);
    if (!Array.isArray(existingSrcMeta.columns) || existingSrcMeta.columns.length === 0) {
      await mergeJsonColumn(db, sourcesTable, 'source_id', source_id, 'metadata', {
        columns: PM3_SOURCE_COLUMNS,
        schema: 'pm3_v1',
      });
    }

    // ── 8. Legacy source-metadata stored proc (new sources only) ────────────
    if (isNewSourceCreate) {
      try {
        await db.query(
          `CALL _data_manager_admin.initialize_dama_src_metadata_using_view($1)`,
          [damaView.view_id]
        );
        await dispatchEvent('pm3:CREATE_META', 'Source metadata initialized', { view_id: damaView.view_id });
      } catch (e) {
        // Legacy swallowed this — keep that so missing proc deployments don't
        // fail the publish.
        console.error(`[pm3] initialize_dama_src_metadata_using_view failed: ${e.message}`);
      }
    }

    await updateProgress(1);

    const result = {
      source_id,
      view_id: damaView.view_id,
      table: `${table_schema}.${table_name}`,
      metrics_table: `${table_schema}.${metricsTable}`,
      years,
    };
    await dispatchEvent('pm3:FINAL', 'pm3 done', {
      etl_context_id: task.task_id,
      damaSourceId: source_id,
      damaViewId: damaView.view_id,
      ...result,
    });
    return result;
  };
}

module.exports = makeWorker();
module.exports.makeWorker = makeWorker;
module.exports.checkMeta = checkMeta;
module.exports.buildMetricConfigs = buildMetricConfigs;
module.exports.METRIC_NAMES = METRIC_NAMES;
module.exports.PM3_SOURCE_COLUMNS = PM3_SOURCE_COLUMNS;
module.exports.buildPm3SourceColumns = buildPm3SourceColumns;
module.exports.metricColumnDescriptors = metricColumnDescriptors;
module.exports.metricsTableName = metricsTableName;
module.exports.TMC_META_DATA_KEYS = TMC_META_DATA_KEYS;
