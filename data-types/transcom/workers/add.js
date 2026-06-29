/**
 * transcom/add — incremental ingest of a new window into an EXISTING view.
 *
 * Staged port of the legacy transcom_add.worker.mjs:
 *   1. resolve the existing view + events table
 *   2. fetch event ids for the window, dedupe, download + insert events
 *   3. NYSDOT category enrichment
 *   4. per-year TMC match — fill-missing variant (only rows with NULL
 *      tmclist) + roadway-metadata backfill from tmclist
 *   5. region-name enrichment (only rows still missing region_name)
 *   6. merge the view start/end window (contiguous-only, legacy semantics)
 *      and rebuild the per-month congestion bookkeeping
 *
 * deps (makeWorker): getDataDb(ctx), makeTranscomClient() — same contracts
 * as workers/publish.js.
 */
const dates = require('../dates.js');
const sql = require('../sql.js');
const { ingestEvents } = require('../ingest.js');
const {
  tableFor, mergeJsonColumn, getViewById, resolveGeomFullView,
} = require('./util.js');

const MIN_RANGE_MS = 10 * 60 * 1000;

function defaultDeps() {
  return {
    getDataDb: (ctx) => ctx.db,
    makeTranscomClient: () => require('../transcom_api.js').makeTranscomClient(),
  };
}

function makeWorker(depOverrides = {}) {
  const deps = { ...defaultDeps(), ...depOverrides };

  return async function transcomAdd(ctx) {
    const { task, db, dispatchEvent, updateProgress } = ctx;
    const d = task.descriptor || {};
    const { source_id, view_id, user_id, start_timestamp, end_timestamp } = d;

    await dispatchEvent('transcom_add:START_PROCESSING', 'transcom add started', { source_id, view_id });

    if (!start_timestamp || !end_timestamp) throw new Error('Missing Time stamp');
    if (new Date(end_timestamp) - new Date(start_timestamp) < MIN_RANGE_MS) {
      throw new Error('Skipping TRANSCOM Events ETL. Time range is too short.');
    }

    const view = await getViewById(db, view_id);
    if (!view || !view.table_schema || !view.table_name) {
      throw new Error(`Invalid view ${view_id} (no events table)`);
    }
    const meta = view.metadata || {};
    const geomSourceId = d.geom_source_id || meta.geom_source_id;
    const tableSchema = view.table_schema;
    const tableName = view.table_name;
    const dataDb = deps.getDataDb(ctx);

    await dispatchEvent('transcom_add:RETRIVED_SOURCE_AND_VIEW', 'view resolved', { source_id, view_id });
    await updateProgress(0.1);

    const client = deps.makeTranscomClient();
    try {
      await dispatchEvent('transcom_add:START_FETCH_EVENTIDS', 'fetching event ids', { view_id });
      const { requested, inserted } = await ingestEvents({
        dataDb,
        client,
        schema: tableSchema,
        table: tableName,
        startTimestamp: start_timestamp,
        endTimestamp: end_timestamp,
        onProgress: async (p) => updateProgress(0.1 + p * 0.5),
      });
      await dispatchEvent('transcom_add:END_FETCHING_EVENTS_BY_EVENTID',
        `${inserted}/${requested} events ingested`, { view_id });
      await updateProgress(0.6);

      await dataDb.query(sql.nysdotCategoryUpdateSQL({
        schema: tableSchema, table: tableName,
        startTimestamp: start_timestamp, endTimestamp: end_timestamp,
      }));

      const geomFullView = geomSourceId ? await resolveGeomFullView(db, geomSourceId) : null;
      if (geomFullView && geomFullView.data_table) {
        for (const year of dates.getYearsBetween(start_timestamp, end_timestamp)) {
          await dataDb.query(sql.tmcMatchFillMissingSQL({
            schema: tableSchema, table: tableName,
            geomDataTable: geomFullView.data_table, year,
          }));
          await dataDb.query(sql.tmcMetaFromTmclistSQL({
            schema: tableSchema, table: tableName,
            geomDataTable: geomFullView.data_table, year,
          }));
        }
      }
      await dataDb.query(sql.regionNameUpdateSQL({ schema: tableSchema, table: tableName, onlyNull: true }));
      await updateProgress(0.9);

      // ── merge the view window + rebuild congestion bookkeeping ─────────
      const merged = dates.getMergedDateRange(
        meta.start_date, meta.end_date, start_timestamp, end_timestamp
      );
      const congestion = dates.reconstructCongestionWithMergeRange(
        meta.congestion || [], merged.start_date, merged.end_date
      );

      const viewsTable = tableFor(db, 'views');
      await mergeJsonColumn(db, viewsTable, 'view_id', view_id, 'metadata', {
        start_date: merged.start_date,
        end_date: merged.end_date,
        congestion,
      });

      await updateProgress(1);
      await dispatchEvent('transcom_add:FINAL', 'transcom add complete', {
        source_id, view_id, inserted,
      });
      return { source_id, view_id };
    } catch (err) {
      await dispatchEvent('transcom_add:ERROR', err.message, { source_id, view_id });
      throw err;
    } finally {
      await client.close();
    }
  };
}

module.exports = makeWorker();
module.exports.makeWorker = makeWorker;
