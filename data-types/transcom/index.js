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
 * The legacy /schedule route is NOT ported (the new runner has no cron);
 * dates.computeNextWindow is the pure 'yesterday' seam for when it lands.
 */
const dates = require('./dates.js');
const { DEFAULT_CONFLATION_SOURCE_IDS } = require('./sql.js');

const publishWorker = require('./workers/publish.js');
const addWorker = require('./workers/add.js');
const eventTmcWorker = require('./workers/event_tmc.js');
const congestionWorker = require('./workers/congestion.js');

module.exports = {
  workers: {
    'transcom/publish': publishWorker,
    'transcom/add': addWorker,
    'transcom/event_tmc': eventTmcWorker,
    'transcom/congestion': congestionWorker,
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
          start_date, end_date, parent_context_id,
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
