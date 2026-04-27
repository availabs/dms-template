/**
 * map21 datatype plugin.
 *
 * Mounts at /dama-admin/:pgEnv/map21/ via mountDatatypeRoutes.
 *   POST /publish — create source if needed, queue map21/publish task,
 *                   return { etl_context_id, source_id }
 */

const worker = require('./worker.js');

module.exports = {
  workers: {
    'map21/publish': worker,
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
          parent_context_id,
          user_id,
          email,
          writeCsv,
          validateCsv,
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
          workerPath: 'map21/publish',
          sourceId: resolvedSourceId,
          source_id: resolvedSourceId,
          view_id: view_id ?? null,
          npmrdsSourceId,
          years,
          customViewAttributes, viewMetadata, viewDependency, newVersion,
          percentTmc,
          parent_context_id,
          user_id, email,
          isNewSourceCreate,
          writeCsv: writeCsv ?? true,
          validateCsv: validateCsv ?? true,
        }, pgEnv);

        // Link the queued task into a parent etl_context if supplied (legacy parity).
        if (parent_context_id) {
          const db = helpers.getDb(pgEnv);
          await db.query(
            `UPDATE data_manager.etl_contexts SET source_id = $1 WHERE etl_context_id = $2`,
            [resolvedSourceId, parent_context_id]
          );
        }

        res.json({ etl_context_id: taskId, source_id: resolvedSourceId });
      } catch (err) {
        console.error('[map21] route failed:', err);
        res.status(500).json({ error: err.message });
      }
    });
  },
};
