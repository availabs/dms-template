/**
 * npmrds_raw datatype plugin.
 *
 * Mounts at /dama-admin/:pgEnv/npmrds_raw/ via mountDatatypeRoutes.
 *   POST /publish — create the npmrds_raw (+ companion npmrds_raw_tmc_identification)
 *                   source(s) if needed, queue the npmrds_raw/publish task,
 *                   return { etl_context_id, source_id }.
 *
 * The worker is a single staged worker (see worker.js). RITIS is only ever called
 * from a real, user-approved manual publish — never from tests (rate-limit rule).
 */
const worker = require('./worker.js');

module.exports = {
  workers: {
    'npmrds_raw/publish': worker,
  },
  routes: (router, helpers) => {
    router.post('/publish', async (req, res) => {
      try {
        const { pgEnv } = req.params;
        const {
          source_id,
          source_values,
          name,
          description,
          states,
          startDate,
          endDate,
          averagingWindowSize,
          include_full_tmc_network,
          user_id,
          email,
          parent_context_id,
          scheduledDataDownload,
          npmrds_prod_id,
        } = req.body || {};

        if (!name) return res.status(400).json({ error: 'name is required' });
        if (!Array.isArray(states) || states.length === 0)
          return res.status(400).json({ error: 'states (non-empty array) is required' });
        if (!startDate || !endDate)
          return res.status(400).json({ error: 'startDate and endDate are required' });

        // Resolve or create the two sources up-front (legacy contract: the raw
        // source carries a back-reference to its tmc_identification companion).
        let resolvedSourceId = source_id;
        let tmcIdentificationSourceId = null;

        if (!resolvedSourceId) {
          const baseSv = { ...(source_values || {}) };
          if (user_id) baseSv.user_id = user_id;

          // Companion FIRST so the raw source can cross-link it.
          const tmcIdSource = await helpers.createDamaSource({
            ...baseSv,
            name: `${name} Tmc Identification`,
            description,
            type: 'npmrds_raw_tmc_identification',
          }, pgEnv);
          tmcIdentificationSourceId = tmcIdSource.source_id;

          const rawSource = await helpers.createDamaSource({
            ...baseSv,
            name,
            description,
            type: 'npmrds_raw',
            metadata: { tmc_identification_source_id: tmcIdentificationSourceId },
          }, pgEnv);
          resolvedSourceId = rawSource.source_id;
        } else {
          // Re-hydrate the companion id from the existing raw source's metadata.
          const db = helpers.getDb(pgEnv);
          const table = db.type === 'postgres' ? 'data_manager.sources' : 'sources';
          const { rows } = await db.query(`SELECT metadata FROM ${table} WHERE source_id = $1`, [resolvedSourceId]);
          const meta = rows[0] && rows[0].metadata;
          const parsed = typeof meta === 'string' ? JSON.parse(meta || '{}') : (meta || {});
          tmcIdentificationSourceId = parsed.tmc_identification_source_id || null;
        }

        const taskId = await helpers.queueTask({
          workerPath: 'npmrds_raw/publish',
          sourceId: resolvedSourceId,
          source_id: resolvedSourceId,
          tmc_identification_source_id: tmcIdentificationSourceId,
          name,
          description,
          states,
          startDate,
          endDate,
          averagingWindowSize: averagingWindowSize ?? 0,
          include_full_tmc_network: include_full_tmc_network !== false,
          user_id,
          email,
          // carried for correlation only — no etl_contexts table in the new schema
          parent_context_id: parent_context_id ?? null,
          scheduledDataDownload: scheduledDataDownload ?? false,
          npmrds_prod_id: npmrds_prod_id ?? null,
        }, pgEnv);

        res.json({ etl_context_id: taskId, source_id: resolvedSourceId });
      } catch (err) {
        console.error('[npmrds_raw] route failed:', err);
        res.status(500).json({ error: err.message });
      }
    });
  },
};
