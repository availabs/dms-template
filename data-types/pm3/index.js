/**
 * pm3 datatype plugin.
 *
 * Mounts at /dama-admin/:pgEnv/pm3/ via mountDatatypeRoutes.
 *   POST /publish — create source if needed, queue pm3/publish task,
 *                   return { etl_context_id, source_id }
 *   POST /create-download — the macroview download builder's endpoint. Translates the panel's
 *                   selection (columns · geography · format) into a descriptor for the SHARED
 *                   ogr2ogr worker and delegates. See download.js — pm3 owns the adaptation,
 *                   not a second pipeline.
 *
 * A publish of N years produces N VIEWS on the source, one per year, each `version` = the 4-digit
 * year. `view_id` in the body used to mean "append to this view" and is now REJECTED — see worker.js
 * § 2 for why the append path was removed. `newVersion` is no longer forwarded either: `version` is
 * the year, so there is nothing for a free-text version to set.
 *
 * Modeled directly on the fixed map21/index.js: NO data_manager.etl_contexts
 * access (that table doesn't exist in the new DMS schema; parent_context_id is
 * carried in the task descriptor for correlation only).
 */

const worker = require('./worker.js');
const { createDownloadHandler } = require('./download.js');

module.exports = {
  workers: {
    'pm3/publish': worker,
  },
  routes: (router, helpers) => {
    // The download builder's endpoint. No worker of its own — it queues the SHARED
    // `gis/create-download` worker with a pm3-shaped descriptor (see download.js).
    router.post('/create-download', createDownloadHandler(helpers));

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
          percentTmc,
          dates,
          rebuildUnionView,
          parent_context_id,
          user_id,
          email,
        } = req.body || {};

        if (!npmrdsSourceId) return res.status(400).json({ error: 'npmrdsSourceId is required' });
        if (!Array.isArray(years) || years.length === 0)
          return res.status(400).json({ error: 'years (non-empty array) is required' });
        // Rejected at the route rather than silently dropped, so a caller still sending the old
        // append descriptor learns immediately instead of after a task has been queued and a
        // surprise view has appeared. The worker guards it too — scheduled and hand-written
        // descriptors never pass through here.
        if (view_id != null)
          return res.status(400).json({
            error: 'view_id is no longer accepted: a pm3 publish creates one view per year '
              + '(version = the 4-digit year). Re-submit without view_id.',
          });

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
          npmrdsSourceId,
          years,
          customViewAttributes, viewMetadata, viewDependency,
          percentTmc: percentTmc ?? 100,
          dates: Array.isArray(dates) ? dates : [],
          rebuildUnionView: rebuildUnionView === true,
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
