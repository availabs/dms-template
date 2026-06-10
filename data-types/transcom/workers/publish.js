/**
 * transcom/publish — full ingest for a date range into a NEW view.
 *
 * Staged port of the legacy transcom.worker.mjs:
 *   1. create the view + transcom.<sNN_vNN_name> events table
 *   2. fetch event ids for the window, dedupe, download + insert events
 *   3. NYSDOT category enrichment
 *   4. per-year spatial/similarity TMC match (tmclist + roadway metadata)
 *   5. region-name enrichment
 *   6. view metadata (start/end window, source cross-refs, per-month
 *      congestion bookkeeping) + source metadata.columns
 *
 * NOT ported here (deliberate):
 *   - the legacy auto-spawn of excessive_delay (separate plugin, ported by
 *     another team) and of the event_tmc companion (now its own
 *     POST /transcom/event_tmc route),
 *   - the tiles metadata block (tile serving is environment-specific).
 *
 * deps (makeWorker): getDataDb(ctx) — Postgres data plane (defaults to ctx.db);
 *                    makeTranscomClient() — TRANSCOM API (tests pass a fake);
 *                    createDamaView — DAMA metadata helper.
 */
const dates = require('../dates.js');
const sql = require('../sql.js');
const { ingestEvents } = require('../ingest.js');
const {
  sanitizeName, tableFor, mergeJsonColumn, getSourceById,
  resolveGeomFullView, setViewTable,
} = require('./util.js');

const MIN_RANGE_MS = 10 * 60 * 1000;

function defaultDeps() {
  return {
    getDataDb: (ctx) => ctx.db,
    makeTranscomClient: () => require('../transcom_api.js').makeTranscomClient(),
    createDamaView: require('@availabs/dms-server/src/dama/upload/metadata').createDamaView,
  };
}

function makeWorker(depOverrides = {}) {
  const deps = { ...defaultDeps(), ...depOverrides };

  return async function transcomPublish(ctx) {
    const { task, pgEnv, db, dispatchEvent, updateProgress } = ctx;
    const d = task.descriptor || {};
    const {
      source_id, name, user_id, start_timestamp, end_timestamp,
      geom_source_id, npmrds_production_source_id, map21_source_id,
    } = d;

    await dispatchEvent('transcom:INITIAL', 'transcom publish started', { source_id });

    if (!start_timestamp || !end_timestamp) throw new Error('Missing Time stamp');
    if (!geom_source_id || !npmrds_production_source_id || !map21_source_id) {
      throw new Error('Missing Geometry source.');
    }
    if (new Date(end_timestamp) - new Date(start_timestamp) < MIN_RANGE_MS) {
      throw new Error('Skipping TRANSCOM Events ETL. Time range is too short.');
    }

    const source = await getSourceById(db, source_id);
    if (!source) throw new Error('Invalid Source');

    // ── view + events table ──────────────────────────────────────────────
    const view = await deps.createDamaView({ source_id, user_id }, pgEnv);
    const tableSchema = 'transcom';
    const tableName = sanitizeName(`s${source_id}_v${view.view_id}_${name || source.name}`);
    await setViewTable(db, view.view_id, tableSchema, tableName);

    const dataDb = deps.getDataDb(ctx);
    await dataDb.query(sql.eventsTableDDL(tableSchema, tableName));
    await dispatchEvent('transcom:RETRIVED_SOURCE_AND_VIEW', 'view + events table ready', {
      source_id, view_id: view.view_id,
    });
    await updateProgress(0.1);

    // ── ingest (TRANSCOM API via the injected client ONLY) ──────────────
    const client = deps.makeTranscomClient();
    try {
      await dispatchEvent('transcom:START_FETCH_EVENTIDS', 'fetching event ids', { view_id: view.view_id });
      const { requested, inserted } = await ingestEvents({
        dataDb,
        client,
        schema: tableSchema,
        table: tableName,
        startTimestamp: start_timestamp,
        endTimestamp: end_timestamp,
        onProgress: async (p) => updateProgress(0.1 + p * 0.5),
      });
      await dispatchEvent('transcom:END_FETCHING_EVENTS_BY_EVENTID',
        `${inserted}/${requested} events ingested`, { view_id: view.view_id });
      await updateProgress(0.6);

      // ── enrichment ────────────────────────────────────────────────────
      await dispatchEvent('transcom:START_GETTING_NYSDOT_COLUMNS', 'NYSDOT categories', { view_id: view.view_id });
      await dataDb.query(sql.nysdotCategoryUpdateSQL({
        schema: tableSchema, table: tableName,
        startTimestamp: start_timestamp, endTimestamp: end_timestamp,
      }));

      await dispatchEvent('transcom:START_GETTING_TMCS_METADATA_FOR_EVENTS', 'TMC match', { view_id: view.view_id });
      const geomFullView = await resolveGeomFullView(db, geom_source_id);
      if (!geomFullView || !geomFullView.data_table) {
        throw new Error(`No npmrds geometry full-version view for source ${geom_source_id}`);
      }
      const { rows: yearRows } = await dataDb.query(
        `SELECT DISTINCT year FROM ${tableSchema}.${tableName} ORDER BY year`
      );
      const currentYear = new Date().getFullYear();
      const eventYears = (yearRows || [])
        .map(({ year }) => +year)
        .filter((year) => year >= 2016 && year <= currentYear);
      for (const year of eventYears) {
        await dataDb.query(sql.tmcMatchUpdateSQL({
          schema: tableSchema, table: tableName,
          geomDataTable: geomFullView.data_table, year,
        }));
      }
      await dataDb.query(sql.regionNameUpdateSQL({ schema: tableSchema, table: tableName }));
      await dispatchEvent('transcom:END_GETTING_TMCS_METADATA_FOR_EVENTS', 'TMC match done', { view_id: view.view_id });
      await updateProgress(0.9);

      // ── metadata ──────────────────────────────────────────────────────
      const congestion = dates.getMonthlyIntervals(start_timestamp, end_timestamp);
      const viewsTable = tableFor(db, 'views');
      const sourcesTable = tableFor(db, 'sources');

      await mergeJsonColumn(db, viewsTable, 'view_id', view.view_id, 'metadata', {
        dama_source_name: source.name,
        start_date: start_timestamp,
        end_date: end_timestamp,
        geom_source_id,
        npmrds_production_source_id,
        map21_source_id,
        congestion,
      });

      await mergeJsonColumn(db, sourcesTable, 'source_id', source_id, 'metadata', {
        columns: sql.EVENTS_TABLE_COLUMNS,
        schema: 'transcom_v1',
      });

      await updateProgress(1);
      await dispatchEvent('transcom:FINAL', 'transcom publish complete', {
        source_id, view_id: view.view_id, inserted,
      });

      return { source_id, view_id: view.view_id };
    } catch (err) {
      await dispatchEvent('transcom:ERROR', err.message, { source_id, view_id: view.view_id });
      throw err;
    } finally {
      await client.close();
    }
  };
}

module.exports = makeWorker();
module.exports.makeWorker = makeWorker;
