/**
 * transcom datatype plugin — TRANSCOM incident events + derived products.
 *
 * One plugin, multiple workers (the legacy transcom + transcom_event_tmc +
 * transcom_congestion dama data-types):
 *
 *   POST /publish             create the `transcom` source (if needed) and
 *                             queue transcom/publish — full ingest of a date
 *                             range into a new view.
 *   POST /add                 queue transcom/add — incremental window into an
 *                             existing source/view.
 *   POST /event_tmc           create a `transcom_event_tmc` source (if needed)
 *                             and queue transcom/event_tmc — the event->TMC
 *                             expansion built from congestion_data.
 *   POST /congestion/publish  create a `transcom_congestion` source (if
 *                             needed) and queue transcom/congestion — the
 *                             per-event (event_id, congestion_data JSONB)
 *                             attribution table.
 *   POST /congestion/add      queue transcom/congestion for a new window
 *                             against an existing transcom_congestion source.
 *
 * All routes return { etl_context_id, source_id } (etl_context_id IS the new
 * task_id) and never touch etl_contexts — parent_context_id is carried in the
 * descriptor for correlation only.
 *
 * The legacy hardcoded conflation source ids (nodes=237, ways=236, v0=238)
 * are descriptor fields with those defaults (sql.DEFAULT_CONFLATION_SOURCE_IDS).
 *
 * The legacy /schedule route is NOT ported — scheduling now goes through the
 * dms-server schedules system (data_manager.schedules + the sweep). This
 * plugin opts in two workers:
 *   - 'transcom/add'        — DAILY ingest of yesterday's events into the
 *                             existing view (dates.computeNextWindow). Chosen
 *                             over /publish for the daily cadence: publish
 *                             creates a NEW view per run (the bulk/initial
 *                             path); the legacy schedule worker also ran the
 *                             incremental add path.
 *   - 'transcom/congestion' — MONTHLY previous-complete-month attribution
 *                             (dates.previousCompleteMonth).
 */
const dates = require('./dates.js');
const { DEFAULT_CONFLATION_SOURCE_IDS } = require('./sql.js');

const publishWorker = require('./workers/publish.js');
const addWorker = require('./workers/add.js');
const eventTmcWorker = require('./workers/event_tmc.js');
const congestionWorker = require('./workers/congestion.js');

const parseMeta = (m) => (typeof m === 'string' ? JSON.parse(m || '{}') : (m || {}));
const tableFor = (db, base) => (db.type === 'postgres' ? `data_manager.${base}` : base);

module.exports = {
  workers: {
    'transcom/publish': publishWorker,
    'transcom/add': addWorker,
    'transcom/event_tmc': eventTmcWorker,
    'transcom/congestion': congestionWorker,
  },

  schedulables: {
    'transcom/add': {
      label: 'TRANSCOM daily event ingest',
      defaultCron: '0 4 * * *', // daily 04:00 — yesterday is complete
      params: [
        { name: 'geom_source_id', type: 'source_id', optional: true },
        { name: 'view_id', type: 'view_id', optional: true,
          desc: 'target view; defaults to the latest view of the source' },
      ],
      async buildDescriptor({ schedule, db }) {
        const t = schedule.descriptor || {};
        const viewsTable = tableFor(db, 'views');

        let viewId = t.view_id;
        if (!viewId) {
          const { rows } = await db.query(
            `SELECT view_id FROM ${viewsTable} WHERE source_id = $1 ORDER BY view_id DESC LIMIT 1`,
            [schedule.source_id]);
          viewId = rows[0] && rows[0].view_id;
        }
        if (!viewId) {
          throw new Error(`No view to add into for transcom source ${schedule.source_id} — run an initial publish first`);
        }

        const { start_timestamp, end_timestamp } = dates.computeNextWindow();

        return {
          source_id: schedule.source_id,
          sourceId: schedule.source_id,
          view_id: viewId,
          start_timestamp,
          end_timestamp,
          geom_source_id: t.geom_source_id ?? null,
          user_id: t.user_id ?? null,
          email: t.email ?? null,
          parent_context_id: null,
        };
      },
    },

    'transcom/congestion': {
      label: 'TRANSCOM congestion attribution (monthly)',
      defaultCron: '0 5 3 * *', // 3rd of the month — events for the prior month have settled
      params: [
        { name: 'geom_source_id', type: 'source_id', optional: true },
        { name: 'npmrds_production_source_id', type: 'source_id', optional: true },
        { name: 'map21_source_id', type: 'source_id', optional: true },
        { name: 'methodology', type: 'string', optional: true, default: 'v1' },
      ],
      async buildDescriptor({ schedule, db }) {
        const t = schedule.descriptor || {};
        const sourcesTable = tableFor(db, 'sources');

        const { rows: [source] } = await db.query(
          `SELECT name, metadata FROM ${sourcesTable} WHERE source_id = $1`, [schedule.source_id]);
        if (!source) throw new Error(`Invalid transcom_congestion source ${schedule.source_id}`);

        const transcomSourceId = t.transcom_source_id ?? parseMeta(source.metadata).transcom_source_id;
        if (!transcomSourceId) {
          throw new Error('transcom_source_id is required (schedule params or source metadata)');
        }

        const { start_date, end_date } = dates.previousCompleteMonth();

        return {
          source_id: schedule.source_id,
          sourceId: schedule.source_id,
          methodology: t.methodology === 'v2' ? 'v2' : 'v1',
          reprocess: t.reprocess === true,
          transcom_source_id: transcomSourceId,
          transcom_view_id: t.transcom_view_id ?? null,
          geom_source_id: t.geom_source_id ?? null,
          npmrds_production_source_id: t.npmrds_production_source_id ?? null,
          map21_source_id: t.map21_source_id ?? null,
          conflation_nodes_source_id:
            t.conflation_nodes_source_id ?? DEFAULT_CONFLATION_SOURCE_IDS.conflation_nodes_source_id,
          conflation_ways_source_id:
            t.conflation_ways_source_id ?? DEFAULT_CONFLATION_SOURCE_IDS.conflation_ways_source_id,
          conflation_v0_source_id:
            t.conflation_v0_source_id ?? DEFAULT_CONFLATION_SOURCE_IDS.conflation_v0_source_id,
          start_date,
          end_date,
          user_id: t.user_id ?? null,
          email: t.email ?? null,
          parent_context_id: null,
        };
      },
    },

    'transcom/event_tmc': {
      label: 'TRANSCOM event→TMC expansion (daily)',
      defaultCron: '0 6 * * *', // daily 06:00 — after the 04:00 event ingest
      params: [
        { name: 'transcom_source_id', type: 'source_id', optional: true,
          desc: 'transcom events source; defaults to the event_tmc source metadata' },
        { name: 'transcom_view_id', type: 'view_id', optional: true },
        { name: 'geom_source_id', type: 'source_id', optional: true },
        { name: 'target_view_id', type: 'view_id', optional: true,
          desc: 'view to upsert into; defaults to source metadata, else the oldest built view' },
      ],
      async buildDescriptor({ schedule, db }) {
        const t = schedule.descriptor || {};
        const sourcesTable = tableFor(db, 'sources');
        const viewsTable = tableFor(db, 'views');

        const { rows: [source] } = await db.query(
          `SELECT metadata FROM ${sourcesTable} WHERE source_id = $1`, [schedule.source_id]);
        if (!source) throw new Error(`Invalid transcom_event_tmc source ${schedule.source_id}`);
        const meta = parseMeta(source.metadata);

        const transcomSourceId = t.transcom_source_id ?? meta.transcom_source_id;
        if (!transcomSourceId) {
          throw new Error('transcom_source_id is required (schedule params or source metadata)');
        }

        // The canonical accumulating view the page reads. Prefer an explicit param,
        // then the value the worker stamps (source.metadata.event_tmc_view_id), then
        // the source's OLDEST view with a table (the original full build — never a
        // stray partial view). Runs upsert into it instead of spawning new views.
        let targetViewId = t.target_view_id ?? meta.event_tmc_view_id ?? null;
        if (!targetViewId) {
          const { rows: [v] } = await db.query(
            `SELECT view_id FROM ${viewsTable}
             WHERE source_id = $1 AND table_name IS NOT NULL
             ORDER BY view_id ASC LIMIT 1`, [schedule.source_id]);
          targetViewId = v && v.view_id;
        }
        if (!targetViewId) {
          throw new Error(`No target view for event_tmc source ${schedule.source_id} — run an initial build first`);
        }

        // Resume from the day after the latest already-expanded event date in the
        // TARGET view's table, so each run only covers new events.
        const { rows: [tv] } = await db.query(
          `SELECT table_schema, table_name FROM ${viewsTable} WHERE view_id = $1`, [targetViewId]);
        const now = new Date();
        let start = null;
        if (tv && tv.table_name) {
          const { rows: [mx] } = await db.query(
            `SELECT max(bound_start_date)::date AS d FROM "${tv.table_schema}"."${tv.table_name}"`);
          if (mx && mx.d) start = new Date(mx.d.getTime() + 86400000);
        }
        // No prior expansion: start at the beginning of the current year.
        if (!start) start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

        // The expansion joins EVERY event in a window to ONE year of geometry
        // (sql.js: `g.year = EXTRACT(YEAR FROM start_date)`), so a single run must
        // not cross a calendar-year boundary — the later year's TMCs would miss the
        // geom join and land with NULL tmclinear. Cap the window at the end of the
        // start year; the next daily run continues into the new year. A large
        // multi-year catch-up should use the manual `/event_tmc` route, one run/year.
        const startYearEnd = new Date(Date.UTC(start.getUTCFullYear(), 11, 31));
        const end = now < startYearEnd ? now : startYearEnd;
        const fmt = (d) => d.toISOString().slice(0, 10);
        // Already current through today → re-expand today only (idempotent upsert).
        const startStr = start > end ? fmt(end) : fmt(start);

        return {
          source_id: schedule.source_id,
          sourceId: schedule.source_id,
          transcom_source_id: transcomSourceId,
          transcom_view_id: t.transcom_view_id ?? null,
          geom_source_id: t.geom_source_id ?? meta.geom_source_id ?? null,
          target_view_id: targetViewId,
          start_date: startStr,
          end_date: fmt(end),
          user_id: t.user_id ?? null,
          email: t.email ?? null,
          parent_context_id: null,
        };
      },
    },
  },

  routes: (router, helpers) => {
    // ── POST /publish ────────────────────────────────────────────────────
    router.post('/publish', async (req, res) => {
      try {
        const { pgEnv } = req.params;
        const {
          source_id, source_values, name, description, user_id, email,
          start_date, end_date,
          geom_source_id, npmrds_production_source_id, map21_source_id,
          parent_context_id,
        } = req.body || {};

        if (!start_date || !end_date) {
          return res.status(400).json({ error: 'start_date and end_date are required' });
        }
        if (!geom_source_id || !npmrds_production_source_id || !map21_source_id) {
          return res.status(400).json({
            error: 'geom_source_id, npmrds_production_source_id and map21_source_id are required',
          });
        }
        if (!source_id && !name) {
          return res.status(400).json({ error: 'name is required when creating a new source' });
        }

        let resolvedSourceId = source_id;
        if (!resolvedSourceId) {
          const source = await helpers.createDamaSource({
            ...(source_values || {}),
            name,
            description,
            type: 'transcom',
            user_id,
          }, pgEnv);
          resolvedSourceId = source.source_id;
        }

        const taskId = await helpers.queueTask({
          workerPath: 'transcom/publish',
          sourceId: resolvedSourceId,
          source_id: resolvedSourceId,
          name,
          user_id,
          email,
          start_timestamp: dates.toStartOfDayTimestamp(start_date),
          end_timestamp: dates.toEndOfDayTimestamp(end_date),
          geom_source_id,
          npmrds_production_source_id,
          map21_source_id,
          // carried for correlation only — no etl_contexts table in the new schema
          parent_context_id: parent_context_id ?? null,
        }, pgEnv);

        res.json({ etl_context_id: taskId, source_id: resolvedSourceId });
      } catch (err) {
        console.error('[transcom] /publish failed:', err);
        res.status(500).json({ error: err.message });
      }
    });

    // ── POST /add ────────────────────────────────────────────────────────
    router.post('/add', async (req, res) => {
      try {
        const { pgEnv } = req.params;
        const {
          source_id, view_id, user_id, email,
          start_date, end_date, geom_source_id, parent_context_id,
        } = req.body || {};

        if (!source_id) return res.status(400).json({ error: 'source_id is required' });
        if (!view_id) return res.status(400).json({ error: 'view_id is required' });
        if (!start_date || !end_date) {
          return res.status(400).json({ error: 'start_date and end_date are required' });
        }

        const taskId = await helpers.queueTask({
          workerPath: 'transcom/add',
          sourceId: source_id,
          source_id,
          view_id,
          user_id,
          email,
          start_timestamp: dates.toStartOfDayTimestamp(start_date),
          end_timestamp: dates.toEndOfDayTimestamp(end_date),
          geom_source_id: geom_source_id ?? null,
          parent_context_id: parent_context_id ?? null,
        }, pgEnv);

        res.json({ etl_context_id: taskId, source_id });
      } catch (err) {
        console.error('[transcom] /add failed:', err);
        res.status(500).json({ error: err.message });
      }
    });

    // ── POST /event_tmc ──────────────────────────────────────────────────
    router.post('/event_tmc', async (req, res) => {
      try {
        const { pgEnv } = req.params;
        const {
          source_id, name, user_id, email,
          transcom_source_id, transcom_view_id, geom_source_id,
          start_date, end_date, parent_context_id, target_view_id,
        } = req.body || {};

        if (!transcom_source_id) {
          return res.status(400).json({ error: 'transcom_source_id is required' });
        }
        if (!start_date || !end_date) {
          return res.status(400).json({ error: 'start_date and end_date are required' });
        }

        let resolvedSourceId = source_id;
        if (!resolvedSourceId) {
          const source = await helpers.createDamaSource({
            name: name || `transcom_event_tmc_${transcom_source_id}_${Date.now()}`,
            type: 'transcom_event_tmc',
            user_id,
            metadata: { transcom_source_id },
          }, pgEnv);
          resolvedSourceId = source.source_id;
        }

        const taskId = await helpers.queueTask({
          workerPath: 'transcom/event_tmc',
          sourceId: resolvedSourceId,
          source_id: resolvedSourceId,
          transcom_source_id,
          transcom_view_id: transcom_view_id ?? null,
          geom_source_id: geom_source_id ?? null,
          target_view_id: target_view_id ?? null,
          start_date,
          end_date,
          user_id,
          email,
          parent_context_id: parent_context_id ?? null,
        }, pgEnv);

        res.json({ etl_context_id: taskId, source_id: resolvedSourceId });
      } catch (err) {
        console.error('[transcom] /event_tmc failed:', err);
        res.status(500).json({ error: err.message });
      }
    });

    // ── POST /congestion/publish + /congestion/add ───────────────────────
    const congestionHandler = (requireExistingSource) => async (req, res) => {
      try {
        const { pgEnv } = req.params;
        const {
          source_id, name, user_id, email,
          transcom_source_id, transcom_view_id,
          geom_source_id, npmrds_production_source_id, map21_source_id,
          conflation_nodes_source_id, conflation_ways_source_id, conflation_v0_source_id,
          start_date, end_date, parent_context_id,
        } = req.body || {};

        if (!start_date || !end_date) {
          return res.status(400).json({ error: 'start_date and end_date are required' });
        }

        let resolvedSourceId = source_id;
        if (!resolvedSourceId) {
          if (requireExistingSource) {
            return res.status(400).json({ error: 'source_id is required' });
          }
          if (!transcom_source_id) {
            return res.status(400).json({ error: 'transcom_source_id is required' });
          }
          const source = await helpers.createDamaSource({
            name: name || `transcom_congestion_${transcom_source_id}_${Date.now()}`,
            type: 'transcom_congestion',
            user_id,
            metadata: { transcom_source_id },
          }, pgEnv);
          resolvedSourceId = source.source_id;
        }

        const taskId = await helpers.queueTask({
          workerPath: 'transcom/congestion',
          methodology: (req.body || {}).methodology === 'v2' ? 'v2' : 'v1',
          reprocess: (req.body || {}).reprocess === true,
          sourceId: resolvedSourceId,
          source_id: resolvedSourceId,
          transcom_source_id: transcom_source_id ?? null,
          transcom_view_id: transcom_view_id ?? null,
          geom_source_id: geom_source_id ?? null,
          npmrds_production_source_id: npmrds_production_source_id ?? null,
          map21_source_id: map21_source_id ?? null,
          // legacy hardcoded conflation source ids 237/236/238 — overridable config
          conflation_nodes_source_id:
            conflation_nodes_source_id ?? DEFAULT_CONFLATION_SOURCE_IDS.conflation_nodes_source_id,
          conflation_ways_source_id:
            conflation_ways_source_id ?? DEFAULT_CONFLATION_SOURCE_IDS.conflation_ways_source_id,
          conflation_v0_source_id:
            conflation_v0_source_id ?? DEFAULT_CONFLATION_SOURCE_IDS.conflation_v0_source_id,
          start_date,
          end_date,
          user_id,
          email,
          parent_context_id: parent_context_id ?? null,
        }, pgEnv);

        res.json({ etl_context_id: taskId, source_id: resolvedSourceId });
      } catch (err) {
        console.error('[transcom] /congestion failed:', err);
        res.status(500).json({ error: err.message });
      }
    };

    router.post('/congestion/publish', congestionHandler(false));
    router.post('/congestion/add', congestionHandler(true));
  },
};
