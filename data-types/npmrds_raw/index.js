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
 *
 * Schedulable: 'npmrds_raw/publish' — the rolling-month RITIS download. The
 * window is computed at fire time from max(views.metadata.end_date) of the
 * schedule's source (dates.computeNextWindow: day after, +1 month, capped at
 * Dec 31). Preflight enforces the RITIS ≤1-download-per-day budget SERVER-SIDE:
 * refuse when ANY npmrds_raw/publish task is queued/running/done within the
 * last 24h across ALL sources:
 *   pg:     ... WHERE worker_path='npmrds_raw/publish'
 *               AND status IN ('queued','running','done')
 *               AND queued_at > NOW() - INTERVAL '24 hours'
 *   sqlite: ... AND queued_at > datetime('now','-24 hours')
 * (errored runs do NOT consume the budget — a crashed download didn't finish a
 * RITIS export; same-day retry stays possible).
 */
const worker = require('./worker.js');
const dates = require('./dates.js');

const parseMeta = (m) => (typeof m === 'string' ? JSON.parse(m || '{}') : (m || {}));
const tableFor = (db, base) => (db.type === 'postgres' ? `data_manager.${base}` : base);

module.exports = {
  workers: {
    'npmrds_raw/publish': worker,
  },

  schedulables: {
    'npmrds_raw/publish': {
      label: 'NPMRDS raw download (RITIS)',
      defaultCron: '0 2 1 * *', // monthly, 02:00 on the 1st
      params: [
        { name: 'states', type: 'string[]', default: ['NY'] },
        { name: 'npmrds_prod_id', type: 'source_id', optional: true,
          desc: 'npmrds production source to chain an add into after download' },
      ],

      // Rolling-month window from the last successfully ingested end_date.
      async buildDescriptor({ schedule, db }) {
        const t = schedule.descriptor || {};
        const sourcesTable = tableFor(db, 'sources');
        const viewsTable = tableFor(db, 'views');

        const { rows: [source] } = await db.query(
          `SELECT name, metadata FROM ${sourcesTable} WHERE source_id = $1`, [schedule.source_id]);
        if (!source) throw new Error(`Invalid npmrds_raw source ${schedule.source_id}`);

        const { rows: views } = await db.query(
          `SELECT metadata FROM ${viewsTable} WHERE source_id = $1`, [schedule.source_id]);
        const latestEnd = views
          .map((v) => parseMeta(v.metadata).end_date)
          .filter(Boolean)
          .sort()
          .pop();
        if (!latestEnd) {
          throw new Error(
            `No prior view with metadata.end_date for source ${schedule.source_id} — run an initial publish first`);
        }

        const { startDate, endDate } = dates.computeNextWindow({ latestEndDate: latestEnd });

        return {
          source_id: schedule.source_id,
          sourceId: schedule.source_id,
          tmc_identification_source_id: parseMeta(source.metadata).tmc_identification_source_id || null,
          name: source.name,
          states: Array.isArray(t.states) && t.states.length ? t.states : ['NY'],
          startDate,
          endDate,
          averagingWindowSize: t.averagingWindowSize ?? 0,
          include_full_tmc_network: t.include_full_tmc_network !== false,
          user_id: t.user_id ?? null,
          email: t.email ?? null,
          parent_context_id: null,
          scheduledDataDownload: true,
          npmrds_prod_id: t.npmrds_prod_id ?? null,
        };
      },

      // RITIS daily budget — global across sources, manual fires included.
      async preflight({ db }) {
        const tasksTable = tableFor(db, 'tasks');
        const cutoff = db.type === 'postgres'
          ? `NOW() - INTERVAL '24 hours'`
          : `datetime('now', '-24 hours')`;
        const { rows: [{ n }] } = await db.query(`
          SELECT COUNT(*) AS n FROM ${tasksTable}
          WHERE worker_path = 'npmrds_raw/publish'
            AND status IN ('queued', 'running', 'done')
            AND queued_at > ${cutoff}
        `);
        if (Number(n) > 0) {
          return {
            ok: false,
            reason: `RITIS daily budget: ${n} npmrds_raw/publish run(s) within the last 24h — at most 1 RITIS download per day`,
          };
        }
        return { ok: true };
      },
    },
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
