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
 *   - Output table lives in the `pm3` schema; multi-year rows
 *     (UNIQUE(tmc, year), deletes by `year in (...)` — not map21's
 *     single-year begindate regex).
 *   - Writes tiles metadata + rawViewIdsUsed to the view and creates a GIST
 *     index on wkb_geometry (legacy behavior map21 doesn't have).
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
  formatSqlLiteral,
  META_COLUMNS,
  NUMERIC_META_COLUMNS,
  buildAddMetaColumnsSql,
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
function buildMetricConfigs({ chMetaTableName }) {
  return {
    speed_pctl: {
      npmrdsDataKeys: ALL_VEHICLES,
      calculator: speedPercentilesCalculator,
      timeBins: [BIN_NAMES.ALL],
      metadataTable: chMetaTableName,
    },
    lottr: {
      timeBins: [BIN_NAMES.AMP, BIN_NAMES.MIDD, BIN_NAMES.PMP, BIN_NAMES.WE],
      npmrdsDataKeys: ALL_VEHICLES,
      calculator: calcTtrMeasure,
    },
    tttr: {
      timeBins: [BIN_NAMES.AMP, BIN_NAMES.MIDD, BIN_NAMES.PMP, BIN_NAMES.WE, BIN_NAMES.OVN],
      npmrdsDataKeys: FREIGHT_TRUCKS,
      secondaryDataKey: ALL_VEHICLES,
      calculator: calcTtrMeasure,
    },
    phed: {
      ...PHED_ALL_VEHICLES_CONFIG,
      calculator: calcPhed,
      thresholdSpeedVersion: 'speed_limit',
      timeBins: [BIN_NAMES.AMP, BIN_NAMES.ALT_PMP],
    },
    phed_freeflow: {
      ...PHED_ALL_VEHICLES_CONFIG,
      calculator: calcPhed,
      thresholdSpeedVersion: 'freeflow',
      timeBins: [BIN_NAMES.AMP, BIN_NAMES.ALT_PMP],
    },
    phed_truck: {
      ...PHED_TRUCK_CONFIG,
      calculator: calcPhed,
      thresholdSpeedVersion: 'speed_limit',
      timeBins: [BIN_NAMES.AMP, BIN_NAMES.ALT_PMP],
    },
    phed_truck_freeflow: {
      ...PHED_TRUCK_CONFIG,
      calculator: calcPhed,
      thresholdSpeedVersion: 'freeflow',
      timeBins: [BIN_NAMES.AMP, BIN_NAMES.ALT_PMP],
    },
    ted: {
      ...PHED_ALL_VEHICLES_CONFIG,
      calculator: calcPhed,
      thresholdSpeedVersion: 'speed_limit',
      timeBins: [BIN_NAMES.ALL],
    },
    ted_freeflow: {
      ...PHED_ALL_VEHICLES_CONFIG,
      calculator: calcPhed,
      thresholdSpeedVersion: 'freeflow',
      timeBins: [BIN_NAMES.ALL],
    },
    ted_truck: {
      ...PHED_TRUCK_CONFIG,
      calculator: calcPhed,
      thresholdSpeedVersion: 'speed_limit',
      timeBins: [BIN_NAMES.ALL],
    },
    ted_truck_freeflow: {
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

// ── Curated source metadata.columns (lowercase pm3 descriptors) ──────────────
// The physical table carries more (each metric's *_50_pct/*_80_pct etc. appear
// via ADD COLUMN IF NOT EXISTS); this is the curated default per the
// metadata.columns contract in data-types/CLAUDE.md.
function buildPm3SourceColumns() {
  const cols = [];
  const push = (name, display_name, type) => cols.push({ name, display_name, type, desc: null });

  for (const c of META_COLUMNS) {
    if (c === 'wkb_geometry') { push(c, 'Geometry', 'GEOMETRY'); continue; }
    const type = NUMERIC_META_COLUMNS.includes(c) ? 'NUMERIC' : 'TEXT';
    push(c, c.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()), type);
  }
  for (const bin of ['amp', 'midd', 'pmp', 'we']) {
    push(`lottr_${bin}_lottr`, `LOTTR ${bin.toUpperCase()}`, 'NUMERIC');
  }
  for (const bin of ['amp', 'midd', 'pmp', 'we', 'ovn']) {
    push(`tttr_${bin}_tttr`, `TTTR ${bin.toUpperCase()}`, 'NUMERIC');
  }
  for (const p of PERCENTILES) {
    push(`speed_pctl_${p}`, `Speed ${p}th Pctl`, 'NUMERIC');
  }
  for (const m of METRIC_NAMES.filter((n) => n.startsWith('phed') || n.startsWith('ted'))) {
    push(`${m}_xdelay_hrs`, `${m.toUpperCase()} Excessive Delay (hrs)`, 'NUMERIC');
    push(`${m}_all_xdelay_phrs`, `${m.toUpperCase()} Person-Hours of Delay`, 'NUMERIC');
    push(`${m}_all_xdelay_vhrs`, `${m.toUpperCase()} Vehicle-Hours of Delay`, 'NUMERIC');
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
      // NOT map21's begindate regex.
      await dataDb.query(
        `DELETE FROM ${damaView.table_schema}.${damaView.table_name} WHERE year in (${years.join(',')})`
      );
      await dispatchEvent('pm3:VIEW_READY', `appending to existing view ${view_id}`,
        { view_id, table: `${damaView.table_schema}.${damaView.table_name}` });
    } else {
      damaView = await deps.createDamaView({
        source_id,
        user_id,
        etl_context_id: task.task_id,
        metadata: {
          ...(customViewAttributes || {}),
          ...(viewMetadata || {}),
          npmrds_prod_source_id: npmrdsSourceId,
          year: years,
          dates,
          email,
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
      // Without the CH meta table location the speed query cannot be built;
      // run the other 10 metrics rather than failing the publish.
      await dispatchEvent('pm3:WARN',
        'prod view metadata has no table_schema/table_name — skipping speed_pctl', {});
      const { speed_pctl, ...rest } = metricConfigs;
      metricConfigs = rest;
    }
    const metricNames = Object.keys(metricConfigs);

    // ── 3. Physical table: meta columns + UNIQUE(tmc, year) ─────────────────
    await createDataTable({ db: dataDb, table_schema, table_name, columns: false });
    await dataDb.query(buildAddMetaColumnsSql({ table_schema, table_name }));

    const constraintName = `tmc_year_${damaView.view_id}_constraint`;
    try {
      await dataDb.query(`
        ALTER TABLE
          ${table_schema}.${table_name}
        ADD CONSTRAINT ${constraintName} UNIQUE(tmc, year)
      `);
    } catch (e) {
      // expected when appending to an existing view
      console.log(`[pm3] add constraint skipped: ${e.message}`);
    }

    // ── 4. Per-year / per-TMC / per-metric processing ────────────────────────
    const rawViewIdsUsed = [];
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

        // Static meta row first (MetricSource always 1, comments always blank).
        const {
          urban_code, region_code, county, ua_name, mpo_code, mpo_name,
          wkb_geometry, year: tmcYear, miles, f_system, faciltype, nhs,
          avg_vehicle_occupancy, directionalaadt, directionalaadttruck,
          avgvehicleoccupancytruck, state_code, nhs_pct, isprimary,
          congestion_level, directionality, active_start_date,
        } = tmcMeta;
        const valuesToInsert = [
          curTmcId, urban_code, region_code, county, ua_name, mpo_code, mpo_name,
          wkb_geometry, tmcYear, miles, f_system, faciltype, nhs,
          avg_vehicle_occupancy, directionalaadt, directionalaadttruck,
          avgvehicleoccupancytruck, state_code, nhs_pct, isprimary,
          congestion_level, directionality, 1, '', active_start_date,
        ];
        await dataDb.query(`
          INSERT INTO
            ${table_schema}.${table_name} (${META_COLUMNS.join(',')})
          VALUES
            (${valuesToInsert.map(formatSqlLiteral).join(',')})
        `);

        const commonMetricConfig = {
          db: dataDb, chDb, pgEnv,
          curTmcId,
          damaSourceId: source_id,
          viewId: damaView.view_id,
          year,
          dates: formattedDates,
          user_id, email,
          table_name, table_schema,
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
            metricName, table_schema, table_name,
          }));
          try {
            await dataDb.query(getDataRowInsertSql({
              result: { ...dbRow, year },
              table_schema, table_name,
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

    // ── 5. Tiles metadata + rawViewIdsUsed + GIST geometry index ────────────
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

    await dataDb.query(`
      CREATE INDEX IF NOT EXISTS
        ${layerName}_${damaView.view_id}_wkb_geometry_idx
      ON
        ${table_schema}.${table_name}
      USING
        GIST (wkb_geometry);
    `);

    await mergeJsonColumn(db, viewsTable, 'view_id', damaView.view_id, 'metadata', {
      tiles,
      rawViewIdsUsed,
    });

    // ── 6. Source metadata.columns (lowercase pm3 descriptors) ──────────────
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

    // ── 7. Legacy source-metadata stored proc (new sources only) ────────────
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
module.exports.TMC_META_DATA_KEYS = TMC_META_DATA_KEYS;
