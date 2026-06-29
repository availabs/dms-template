/**
 * map21 publish worker — per-year orchestrator.
 *
 * Mirrors references/avail-falcor/.../map21/publish.worker.mjs with these
 * structural changes:
 *   - `initial_event.payload.X` envelope → flat `ctx.task.descriptor.X`
 *   - `query`/`chQuery` → `db`/`chDb` adapters from `ctx` and `getChDb(pgEnv)`
 *   - `dispatchEvent({type, payload, meta}, etl_id, pgEnv)` →
 *     `ctx.dispatchEvent(type, message, payload)` (task_id + pgEnv implicit)
 *   - Adds `ctx.updateProgress(0..1)` for the UI progress bar
 *   - Emits an FHWA HPMS Travel Time Metric submittal CSV that conforms to
 *     the 2023 draft spec (replaces legacy createPm3Output.js 2018-spec
 *     output) and runs the in-process validator against it before completing
 *
 * Gated-off legacy paths (METRIC_WRITES_DB, COMPARE_AGAINST_HISTORIC,
 * ANALYSIS) were dropped — the new descriptor exposes only `writeCsv` and
 * `validateCsv` knobs; everything else follows the production behavior the
 * legacy code defaulted to.
 */

const { getChDb } = require('@availabs/dms-server/src/db');
const { createDamaView, ensureSchema } = require('@availabs/dms-server/src/dama/upload/metadata');
const storage = require('@availabs/dms-server/src/dama/storage');

const {
  BIN_NAMES,
  ALL_VEHICLES,
  FREIGHT_TRUCKS,
  NPMRDS_CH_SCHEMA_NAME,
} = require('./constants.js');
const {
  createDataTable,
  getListTmcId,
  getDataInsertSqlForMap21,
  getUpdateColumnsSqlForMap21,
  generateTmcIdMetaQuery,
} = require('./helpers.js');
const { calcTtrMeasure } = require('./calcTtrMeasure.js');
const { calcPhed } = require('./calcPhed.js');
const { writeHpmsCsv } = require('./createHpmsCsv.js');
const { validateFile } = require('./validate.js');

const METRIC_CONFIGS = {
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
    calculator: calcPhed,
    thresholdSpeedVersion: 'speed_limit',
    npmrdsDataKeys: ALL_VEHICLES,
    avoKey: 'avg_vehicle_occupancy',
    dirAadtKey: 'directionalaadt',
    timeBins: [BIN_NAMES.AMP, BIN_NAMES.ALT_PMP],
  },
};
const METRIC_NAMES = Object.keys(METRIC_CONFIGS);

// Production gate, lifted from legacy worker — stricter than the validator's
// `required` flags because the metric calculators rely on these fields and
// silently produce garbage if they're missing.
function checkMeta({ tmcMeta }) {
  if (!tmcMeta) return false;
  const { directionalaadt, nhs, f_system, faciltype, urban_code, nhs_pct, isprimary, congestion_level } = tmcMeta;
  if (!directionalaadt) return false;
  if (parseInt(f_system) < 1 || parseInt(f_system) > 7) return false;
  if (parseInt(faciltype) !== 1 && parseInt(faciltype) !== 2 && parseInt(faciltype) !== 6) return false;
  if (parseInt(nhs) < 1 || parseInt(nhs) > 9) return false;
  if (!urban_code || parseInt(urban_code) <= 0) return false;
  if (parseFloat(nhs_pct) <= 0) return false;
  if (!isprimary || parseInt(isprimary) === 0) return false;
  if (!congestion_level || congestion_level === '') return false;
  return true;
}

async function selectViewAndClearYears(db, source_id, view_id, years) {
  const { rows } = await db.query(
    `SELECT * FROM data_manager.views WHERE source_id = $1 AND view_id = $2`,
    [source_id, view_id]
  );
  if (!rows[0]) throw new Error(`No view found: source_id=${source_id} view_id=${view_id}`);
  const view = rows[0];
  // Year-prefix match against begindate (legacy uses regex anchor on begindate)
  const yearAlt = years.map(String).join('|');
  await db.query(
    `DELETE FROM ${view.table_schema}.${view.table_name} WHERE begindate ~ '^(${yearAlt})'`
  );
  return view;
}

async function readProdSource(db, npmrdsSourceId) {
  const { rows: viewRows } = await db.query(
    `SELECT * FROM data_manager.views WHERE source_id = $1`,
    [npmrdsSourceId]
  );
  if (!viewRows[0]) throw new Error(`No prod NPMRDS view found for source_id=${npmrdsSourceId}`);
  const dataTableName = viewRows[0].table_name;
  const npmrdsRawByYear = viewRows[0].metadata?.npmrds_raw_view_id_to_year || {};

  const { rows: srcRows } = await db.query(
    `SELECT metadata FROM data_manager.sources WHERE source_id = $1`,
    [npmrdsSourceId]
  );
  const srcMeta = srcRows[0]?.metadata || {};
  const npmrdsMetaLayerByYear = srcMeta.npmrds_meta_layer_view_id || {};
  return { dataTableName, npmrdsRawByYear, npmrdsMetaLayerByYear };
}

async function readMetaLayer(db, viewId) {
  const { rows } = await db.query(
    `SELECT table_schema, table_name FROM data_manager.views WHERE view_id = $1`,
    [viewId]
  );
  if (!rows[0]) throw new Error(`No meta-layer view found: view_id=${viewId}`);
  return rows[0];
}

async function fetchTmcMeta({ db, metaLayer, tmcId }) {
  const sql = generateTmcIdMetaQuery({
    metaTName: `${metaLayer.table_schema}.${metaLayer.table_name}`,
    dataKeys: [
      'tmc', 'urban_code', 'isprimary', 'direction', 'directionalAadt',
      'avg_speedlimit', 'miles', 'avg_vehicle_occupancy', 'functionalClass',
      'congestion_level', 'directionality', 'nhs', 'nhs_pct', 'f_system',
      'faciltype', 'state_code', 'active_start_date',
    ],
    tmc: tmcId,
  });
  const { rows } = await db.query(sql);
  return rows[0];
}

module.exports = async function map21Publish(ctx) {
  const { task, pgEnv, db, dispatchEvent, updateProgress } = ctx;
  if (db.type !== 'postgres') throw new Error('map21 requires PostgreSQL for metadata');

  let chDb;
  try {
    chDb = getChDb(pgEnv);
  } catch (e) {
    throw new Error(`map21 needs ClickHouse on pgEnv ${pgEnv}: ${e.message}`);
  }

  const {
    source_id,
    view_id,                 // optional — append to existing view
    npmrdsSourceId,
    years,
    customViewAttributes,
    viewMetadata,
    viewDependency,
    newVersion,
    percentTmc = 100,
    user_id,
    email,
    isNewSourceCreate = false,
    writeCsv = true,
    validateCsv = true,
  } = task.descriptor;

  if (!source_id) throw new Error('source_id is required');
  if (!npmrdsSourceId) throw new Error('npmrdsSourceId is required');
  if (!Array.isArray(years) || years.length === 0) throw new Error('years (non-empty array) is required');

  await dispatchEvent('map21:INITIAL', `map21 publish started: years=${years.join(',')}`, {
    source_id, view_id: view_id || null, years,
  });
  await updateProgress(0.02);

  // 1. Resolve or create the view
  let damaView;
  if (view_id) {
    damaView = await selectViewAndClearYears(db, source_id, view_id, years);
    await dispatchEvent('map21:VIEW_READY', `appending to existing view ${view_id}`,
      { view_id, table: `${damaView.table_schema}.${damaView.table_name}` });
  } else {
    damaView = await createDamaView({
      source_id,
      user_id,
      etl_context_id: task.task_id,
      metadata: {
        ...(customViewAttributes || {}),
        ...(viewMetadata || {}),
        npmrds_prod_source_id: npmrdsSourceId,
        years,
        email,
      },
      view_dependencies: viewDependency,
    }, pgEnv);

    if (newVersion) {
      await db.query(`UPDATE data_manager.views SET version = $1 WHERE view_id = $2`,
        [String(newVersion), damaView.view_id]);
    }
    await dispatchEvent('map21:VIEW_READY', `created view ${damaView.view_id}`,
      { view_id: damaView.view_id, table: `${damaView.table_schema}.${damaView.table_name}` });
  }
  await ensureSchema(db, damaView.table_schema);
  await updateProgress(0.05);

  // 2. Look up prod NPMRDS source data table + per-year meta-layer mapping
  const { dataTableName, npmrdsRawByYear: prodRawByYear, npmrdsMetaLayerByYear } =
    await readProdSource(db, npmrdsSourceId);

  // Carry forward existing year-mapping when appending; fresh map on new view
  const yearToRawViewId = { ...(damaView.metadata?.npmrds_raw_view_id_to_year || {}) };
  const allResults = {};

  // 3. Per-year processing
  for (let yi = 0; yi < years.length; yi++) {
    const year = years[yi];
    const yearStr = String(year);

    const rawIds = Object.keys(prodRawByYear).filter(
      (rViewId) => String(prodRawByYear[rViewId]) === yearStr
    );
    yearToRawViewId[year] = rawIds;

    const metaLayerViewId = npmrdsMetaLayerByYear[year];
    if (!metaLayerViewId) {
      throw new Error(`No npmrds_meta_layer_view_id for year ${year} on prod source ${npmrdsSourceId}`);
    }
    const metaLayer = await readMetaLayer(db, metaLayerViewId);

    // ClickHouse: distinct TMCs for this year
    const tmcResp = await getListTmcId({
      chDb,
      dataTableName: `${NPMRDS_CH_SCHEMA_NAME}.${dataTableName}`,
      year,
    });
    const allTmcIds = (tmcResp?.data || []).map((r) => r.tmc);
    const numTmcToProcess = Math.floor((allTmcIds.length * percentTmc) / 100);
    const everyN = Math.max(1, Math.floor(numTmcToProcess / 25));

    await dispatchEvent('map21:start', `year=${year} tmcs=${numTmcToProcess}/${allTmcIds.length}`, {
      etl_context_id: task.task_id,
      damaSourceId: npmrdsSourceId,
      damaViewId: damaView.view_id,
      year,
    });

    // Ensure the per-view data table exists (no static columns — they're added on first valid TMC)
    await createDataTable({ db, table_schema: damaView.table_schema, table_name: damaView.table_name, columns: false });

    let columnsInitialized = false;
    let processed = 0;

    for (let i = 0; i < numTmcToProcess; i++) {
      const curTmcId = allTmcIds[i];
      const tmcMeta = await fetchTmcMeta({ db, metaLayer, tmcId: curTmcId });
      if (!checkMeta({ tmcMeta })) continue;

      const result = { meta: tmcMeta };
      const commonCfg = {
        db, chDb, pgEnv,
        curTmcId,
        damaSourceId: npmrdsSourceId,
        viewId: damaView.view_id,
        year,
        user_id, email,
        table_name: damaView.table_name,
        table_schema: damaView.table_schema,
        dataTableName,
        etl_context_id: task.task_id,
        tmcMeta,
        // pm3Config flags carried for legacy code-path branches that read them
        pm3Config: { METRIC_WRITES_DB: false, WRITE_TO_CSV: false, COMPARE_AGAINST_HISTORIC: false, ANALYSIS: false },
      };
      for (const name of METRIC_NAMES) {
        result[name] = await METRIC_CONFIGS[name].calculator({
          ...commonCfg,
          ...METRIC_CONFIGS[name],
          metricName: name,
        });
      }
      allResults[curTmcId] = result;

      if (!columnsInitialized) {
        await db.query(getUpdateColumnsSqlForMap21({
          result, table_schema: damaView.table_schema, table_name: damaView.table_name, METRIC_NAMES,
        }));
        columnsInitialized = true;
      }
      try {
        await db.query(getDataInsertSqlForMap21({
          result, table_schema: damaView.table_schema, table_name: damaView.table_name, METRIC_NAMES,
        }));
      } catch (e) {
        console.error(`[map21] insert failed tmc=${curTmcId}: ${e.message}`);
      }

      processed++;
      if (i % everyN === 0) {
        const pct = Math.floor((i / numTmcToProcess) * 100);
        await dispatchEvent('map21:progress', `year=${year} ${pct}%`, {
          etl_context_id: task.task_id,
          damaSourceId: npmrdsSourceId,
          damaViewId: damaView.view_id,
          year,
          data: { progress: pct },
        });
        // 0.05 (setup) → 0.85 (end of metric loop), apportioned across years
        const yearProgress = (yi + (i / numTmcToProcess)) / years.length;
        await updateProgress(0.05 + 0.80 * yearProgress);
      }
    }
    console.log(`[map21] year=${year} processed ${processed} TMCs (out of ${allTmcIds.length})`);
  }

  await updateProgress(0.88);

  // 4. View metadata: persist year → raw-view mapping
  await db.query(
    `UPDATE data_manager.views SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb WHERE view_id = $2`,
    [JSON.stringify({ npmrds_raw_view_id_to_year: yearToRawViewId }), damaView.view_id]
  );

  // 5. Optional HPMS TTM CSV emit
  let csvInfo = null;
  if (writeCsv && Object.keys(allResults).length > 0) {
    const datayear = years[years.length - 1]; // single-year submittals are the common case
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const relativePath = `map21/s${source_id}_v${damaView.view_id}_${stamp}.csv`;
    const written = await writeHpmsCsv({
      results: allResults,
      datayear,
      storage,
      relativePath,
    });
    const url = storage.getUrl ? storage.getUrl(relativePath) : null;
    csvInfo = { relativePath, rowCount: written.rowCount, url };
    await dispatchEvent('map21:CSV_WRITE', `wrote ${written.rowCount} rows to ${relativePath}`, csvInfo);

    if (validateCsv) {
      // Local backend has dataDir; for S3 the validator can't read remote paths directly,
      // so we validate from the in-memory CSV by writing a temp file.
      let pathToValidate;
      if (storage.type === 'local' && storage.dataDir) {
        pathToValidate = require('path').join(storage.dataDir, relativePath);
      } else {
        const os = require('os'); const path = require('path'); const fs = require('fs');
        pathToValidate = path.join(os.tmpdir(), `map21-${stamp}.csv`);
        fs.writeFileSync(pathToValidate, written.csv);
      }
      const report = validateFile(pathToValidate);
      const ok = report.summary.errorCount === 0
        && report.headerIssues.missing.length === 0
        && report.headerIssues.extra.length === 0;
      await dispatchEvent(
        'map21:CSV_VALIDATE',
        ok ? 'HPMS 2023 spec OK' : `${report.summary.errorCount} validation errors`,
        report.summary
      );
      if (!ok) {
        throw new Error(
          `HPMS validation failed: errors=${report.summary.errorCount} ` +
          `missing=${report.headerIssues.missing.join(',')} extra=${report.headerIssues.extra.join(',')}`
        );
      }
    }
  }

  // 6. Initialize source metadata via DAMA stored proc — only when this is a new source
  if (isNewSourceCreate) {
    try {
      await db.query(
        `CALL _data_manager_admin.initialize_dama_src_metadata_using_view($1)`,
        [damaView.view_id]
      );
      await dispatchEvent('map21:CREATE_META', 'Source metadata initialized', { view_id: damaView.view_id });
    } catch (e) {
      // Legacy code swallowed this — keep that behavior so non-DAMA databases or
      // missing proc deployments don't fail the whole publish.
      console.error(`[map21] initialize_dama_src_metadata_using_view failed: ${e.message}`);
    }
  }

  await updateProgress(1);

  const result = {
    source_id,
    view_id: damaView.view_id,
    table: `${damaView.table_schema}.${damaView.table_name}`,
    years,
    csv: csvInfo,
  };
  await dispatchEvent('map21:complete', 'map21 complete', result);
  await dispatchEvent('map21:FINAL', 'map21 done', result);
  return result;
};
