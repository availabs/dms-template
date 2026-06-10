/**
 * npmrds datatype plugin (Phase 2 of the dama data-type migration).
 *
 * Mounts at /dama-admin/:pgEnv/npmrds/ via mountDatatypeRoutes.
 *   POST /publish — create the npmrds + npmrds_meta sources (cross-linked,
 *                   incl. the tmc_speed/mpo_boundaries references), queue the
 *                   npmrds/provision worker (views + CH prod/meta tables + PG
 *                   npmrds_geometry all-years table + metadata.columns).
 *                   Decision: provisioning is a QUEUED worker, not inline like
 *                   legacy — routes have no ClickHouse/PostGIS deps; workers do
 *                   (and they're injectable for tests).
 *   POST /add     — queue npmrds/add (raw→prod insert + full metadata phase,
 *                   one staged worker — the new runner has no task chaining).
 *   POST /replace — queue npmrds/replace (partition drop + re-insert).
 *   POST /remove  — queue npmrds/remove (legacy ran inline; worker here).
 *
 * All routes return the legacy contract { etl_context_id, source_id }.
 * NEVER touches data_manager.etl_contexts.
 */
const { workers } = require('./worker.js');

module.exports = {
  workers: {
    'npmrds/provision': workers.provision,
    'npmrds/add': workers.add,
    'npmrds/replace': workers.replace,
    'npmrds/remove': workers.remove,
  },

  routes: (router, helpers) => {
    router.post('/publish', async (req, res) => {
      try {
        const { pgEnv } = req.params;
        const {
          source_id, name, email, user_id,
          schemaName,
          tmcSpeedViewId, tmcSpeedSourceId,
          mpoBoundariesViewId, mpoBoundariesSourceId,
        } = req.body || {};

        // Legacy hard requirements — these thread all the way to the spatial join.
        if (!tmcSpeedViewId || !tmcSpeedSourceId)
          return res.status(400).json({ error: 'tmcSpeedViewId and tmcSpeedSourceId are required' });
        if (!mpoBoundariesViewId || !mpoBoundariesSourceId)
          return res.status(400).json({ error: 'mpoBoundariesViewId and mpoBoundariesSourceId are required' });
        if (!name && !source_id)
          return res.status(400).json({ error: 'name is required' });

        // Resolve or create the two cross-linked sources up-front (legacy
        // contract: prod source ↔ meta source back-reference each other).
        let resolvedSourceId = source_id;
        let metaSourceId = null;

        if (!resolvedSourceId) {
          const prodSource = await helpers.createDamaSource({
            user_id,
            name: name.toLowerCase(),
            type: 'npmrds',
          }, pgEnv);
          resolvedSourceId = prodSource.source_id;

          const metaSource = await helpers.createDamaSource({
            user_id,
            name: `${name.toLowerCase()}_tmc_meta`,
            type: 'npmrds_meta',
            metadata: { npmrds_source_id: resolvedSourceId },
          }, pgEnv);
          metaSourceId = metaSource.source_id;

          // Forward-link prod → meta (read-modify-write; portable pg/sqlite).
          const db = helpers.getDb(pgEnv);
          const table = db.type === 'postgres' ? 'data_manager.sources' : 'sources';
          const { rows } = await db.query(`SELECT metadata FROM ${table} WHERE source_id = $1`, [resolvedSourceId]);
          const cur = rows[0] && rows[0].metadata;
          const meta = typeof cur === 'string' ? JSON.parse(cur || '{}') : (cur || {});
          await db.query(`UPDATE ${table} SET metadata = $1 WHERE source_id = $2`, [
            JSON.stringify({ ...meta, npmrds_tmc_meta_source_id: metaSourceId }),
            resolvedSourceId,
          ]);
        } else {
          // Re-hydrate the meta-source id from the existing prod source.
          const db = helpers.getDb(pgEnv);
          const table = db.type === 'postgres' ? 'data_manager.sources' : 'sources';
          const { rows } = await db.query(`SELECT name, metadata FROM ${table} WHERE source_id = $1`, [resolvedSourceId]);
          const cur = rows[0] && rows[0].metadata;
          const meta = typeof cur === 'string' ? JSON.parse(cur || '{}') : (cur || {});
          metaSourceId = meta.npmrds_tmc_meta_source_id || null;
        }

        const taskId = await helpers.queueTask({
          workerPath: 'npmrds/provision',
          sourceId: resolvedSourceId,
          source_id: resolvedSourceId,
          npmrds_meta_source_id: metaSourceId,
          name,
          user_id,
          email,
          schemaName: schemaName || 'npmrds',
          tmcSpeedViewId,
          tmcSpeedSourceId,
          mpoBoundariesViewId,
          mpoBoundariesSourceId,
        }, pgEnv);

        res.json({ etl_context_id: taskId, source_id: resolvedSourceId });
      } catch (err) {
        console.error('[npmrds] /publish failed:', err);
        res.status(500).json({ error: err.message });
      }
    });

    router.post('/add', async (req, res) => {
      try {
        const { pgEnv } = req.params;
        const {
          source_id, view_id, npmrds_raw_view_ids,
          startDate, endDate, user_id, email, prodURL,
        } = req.body || {};

        if (!source_id) return res.status(400).json({ error: 'source_id is required' });
        if (!view_id) return res.status(400).json({ error: 'view_id is required' });
        if (!Array.isArray(npmrds_raw_view_ids) || npmrds_raw_view_ids.length === 0)
          return res.status(400).json({ error: 'npmrds_raw_view_ids (non-empty array) is required' });

        const taskId = await helpers.queueTask({
          workerPath: 'npmrds/add',
          sourceId: source_id,
          source_id,
          view_id,
          npmrds_raw_view_ids,
          startDate,
          endDate,
          user_id,
          email,
          prodURL: prodURL || null,
        }, pgEnv);

        res.json({ etl_context_id: taskId, source_id });
      } catch (err) {
        console.error('[npmrds] /add failed:', err);
        res.status(500).json({ error: err.message });
      }
    });

    router.post('/replace', async (req, res) => {
      try {
        const { pgEnv } = req.params;
        const {
          source_id, view_id,
          npmrds_raw_add_view_ids, npmrds_raw_remove_view_ids,
          replace_year, startDate, endDate, user_id, email,
        } = req.body || {};

        if (!source_id) return res.status(400).json({ error: 'source_id is required' });
        if (!view_id) return res.status(400).json({ error: 'view_id is required' });
        if (!replace_year) return res.status(400).json({ error: 'replace_year is required' });

        const taskId = await helpers.queueTask({
          workerPath: 'npmrds/replace',
          sourceId: source_id,
          source_id,
          view_id,
          npmrds_raw_add_view_ids: npmrds_raw_add_view_ids || [],
          npmrds_raw_remove_view_ids: npmrds_raw_remove_view_ids || [],
          replace_year,
          startDate,
          endDate,
          user_id,
          email,
        }, pgEnv);

        res.json({ etl_context_id: taskId, source_id });
      } catch (err) {
        console.error('[npmrds] /replace failed:', err);
        res.status(500).json({ error: err.message });
      }
    });

    router.post('/remove', async (req, res) => {
      try {
        const { pgEnv } = req.params;
        const {
          source_id, view_id, npmrds_raw_removed_view_ids,
          startDate, endDate, user_id,
        } = req.body || {};

        if (!source_id) return res.status(400).json({ error: 'source_id is required' });
        if (!view_id) return res.status(400).json({ error: 'view_id is required' });
        if (!Array.isArray(npmrds_raw_removed_view_ids) || npmrds_raw_removed_view_ids.length === 0)
          return res.status(400).json({ error: 'npmrds_raw_removed_view_ids (non-empty array) is required' });

        const taskId = await helpers.queueTask({
          workerPath: 'npmrds/remove',
          sourceId: source_id,
          source_id,
          view_id,
          npmrds_raw_removed_view_ids,
          startDate: startDate || null,
          endDate: endDate || null,
          user_id,
        }, pgEnv);

        res.json({ etl_context_id: taskId, source_id });
      } catch (err) {
        console.error('[npmrds] /remove failed:', err);
        res.status(500).json({ error: err.message });
      }
    });
  },
};
