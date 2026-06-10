/**
 * transcom/event_tmc — build/refresh the event->TMC expansion table for a
 * transcom_event_tmc source.
 *
 * Combines the legacy eventTmc.js EventTmcPublish (table create + view
 * bookkeeping) and LoadEventTmcData (the congestion_data JSONB expansion
 * upsert) into ONE staged worker. Re-running it for a new window upserts on
 * (event_id, tmc) — refresh semantics.
 *
 * deps (makeWorker): getDataDb(ctx), createDamaView.
 */
const sql = require('../sql.js');
const {
  sanitizeName, tableFor, mergeJsonColumn, getSourceById,
  getViewsForSource, resolveGeomFullView, setViewTable,
} = require('./util.js');

function defaultDeps() {
  return {
    getDataDb: (ctx) => ctx.db,
    createDamaView: require('@availabs/dms-server/src/dama/upload/metadata').createDamaView,
  };
}

function makeWorker(depOverrides = {}) {
  const deps = { ...defaultDeps(), ...depOverrides };

  return async function transcomEventTmc(ctx) {
    const { task, pgEnv, db, dispatchEvent, updateProgress } = ctx;
    const d = task.descriptor || {};
    const { source_id, user_id, start_date, end_date } = d;

    await dispatchEvent('event_tmc:INITIAL', 'event_tmc build started', { source_id });
    if (!start_date || !end_date) throw new Error('start_date and end_date are required');

    const source = await getSourceById(db, source_id);
    if (!source) throw new Error('Invalid Source');
    const transcomSourceId = d.transcom_source_id || (source.metadata || {}).transcom_source_id;
    if (!transcomSourceId) throw new Error('transcom_source_id is required');

    // The transcom events view this expansion reads from (latest unless pinned).
    const transcomViews = await getViewsForSource(db, transcomSourceId);
    const transcomView = d.transcom_view_id
      ? transcomViews.find((v) => v.view_id === d.transcom_view_id)
      : transcomViews[transcomViews.length - 1];
    if (!transcomView || !transcomView.data_table) {
      throw new Error(`No transcom events view found for source ${transcomSourceId}`);
    }

    const geomSourceId = d.geom_source_id || (transcomView.metadata || {}).geom_source_id;
    const geomFullView = geomSourceId ? await resolveGeomFullView(db, geomSourceId) : null;
    if (!geomFullView || !geomFullView.data_table) {
      throw new Error(`No npmrds geometry full-version view for source ${geomSourceId}`);
    }

    await dispatchEvent('event_tmc:START_FETCHING_INFO', 'inputs resolved', { source_id });
    await updateProgress(0.1);

    // ── view + expansion table ───────────────────────────────────────────
    const view = await deps.createDamaView({ source_id, user_id }, pgEnv);
    const tableSchema = 'transcom';
    const tableName = sanitizeName(`s${source_id}_v${view.view_id}_${source.name}`).toLowerCase();
    await setViewTable(db, view.view_id, tableSchema, tableName);

    const dataDb = deps.getDataDb(ctx);
    await dataDb.query(sql.eventTmcTableDDL(tableSchema, tableName));
    await dispatchEvent('event_tmc:TABLE_CREATE_SUCCESS', 'expansion table ready', {
      source_id, view_id: view.view_id,
    });
    await updateProgress(0.4);

    // ── the JSONB expansion upsert ───────────────────────────────────────
    await dataDb.query(sql.eventTmcInsertSQL({
      eventTmcTable: `${tableSchema}.${tableName}`,
      transcomTable: transcomView.data_table,
      geomTable: geomFullView.data_table,
      startDate: start_date,
      endDate: end_date,
    }));
    await dispatchEvent('event_tmc:SUCCESS_DATA_INSERTING', 'expansion rows upserted', {
      source_id, view_id: view.view_id,
    });
    await updateProgress(0.8);

    // ── metadata ─────────────────────────────────────────────────────────
    const viewsTable = tableFor(db, 'views');
    const sourcesTable = tableFor(db, 'sources');
    await mergeJsonColumn(db, viewsTable, 'view_id', view.view_id, 'metadata', {
      is_clickhouse_table: 0,
      transcom_source_id: transcomSourceId,
      transcom_view_id: transcomView.view_id,
      geom_source_id: geomSourceId,
      geom_view_id: geomFullView.view_id,
      start_date,
      end_date,
    });
    await mergeJsonColumn(db, sourcesTable, 'source_id', source_id, 'metadata', {
      columns: sql.EVENT_TMC_TABLE_COLUMNS,
      schema: 'transcom_event_tmc_v1',
      transcom_source_id: transcomSourceId,
    });

    await updateProgress(1);
    await dispatchEvent('event_tmc:FINAL', 'event_tmc build complete', {
      source_id, view_id: view.view_id,
    });
    return { source_id, view_id: view.view_id };
  };
}

module.exports = makeWorker();
module.exports.makeWorker = makeWorker;
