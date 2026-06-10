/**
 * pm3 datatype plugin.
 *
 * Mounts at /dama-admin/:pgEnv/pm3/ via mountDatatypeRoutes.
 *   POST /publish — create source if needed, queue pm3/publish task,
 *                   return { etl_context_id, source_id }
 *
 * Modeled directly on the fixed map21/index.js: NO data_manager.etl_contexts
 * access (that table doesn't exist in the new DMS schema; parent_context_id is
 * carried in the task descriptor for correlation only).
 */

const worker = require('./worker.js');

module.exports = {
  workers: {
    'pm3/publish': worker,
  },
  routes: (router, helpers) => {
    router.post('/publish', async (req, res) => {
      try {
        const { pgEnv } = req.params;
        const {
          source_id,
          source_values,
          view_id,
          npmrdsSourceId,
          years,
          customViewAttributes,
          viewMetadata,
          viewDependency,
          newVersion,
          percentTmc,
          dates,
          parent_context_id,
          user_id,
          email,
        } = req.body || {};

        if (!npmrdsSourceId) return res.status(400).json({ error: 'npmrdsSourceId is required' });
        if (!Array.isArray(years) || years.length === 0)
          return res.status(400).json({ error: 'years (non-empty array) is required' });

        // Resolve or create the source up-front so the response carries a
        // stable source_id even before the worker starts (legacy contract).
        let resolvedSourceId = source_id;
        let isNewSourceCreate = false;
        if (!resolvedSourceId) {
          isNewSourceCreate = true;
          const sv = { ...(source_values || {}) };
          if (user_id) {
            sv.user_id = user_id;
            if (!sv.statistics) {
              sv.statistics = { auth: { users: { [user_id]: '10' }, groups: {} } };
            }
          }
          const created = await helpers.createDamaSource(sv, pgEnv);
          resolvedSourceId = created.source_id;
        }

        const taskId = await helpers.queueTask({
          workerPath: 'pm3/publish',
          sourceId: resolvedSourceId,
          source_id: resolvedSourceId,
          view_id: view_id ?? null,
          npmrdsSourceId,
          years,
          customViewAttributes, viewMetadata, viewDependency, newVersion,
          percentTmc: percentTmc ?? 100,
          dates: Array.isArray(dates) ? dates : [],
          parent_context_id,
          user_id, email,
          isNewSourceCreate,
        }, pgEnv);

        res.json({ etl_context_id: taskId, source_id: resolvedSourceId });
      } catch (err) {
        console.error('[pm3] route failed:', err);
        res.status(500).json({ error: err.message });
      }
    });
  },
};
