/**
 * Routes for the now_playing dataType. Mounted at /dama-admin/:pgEnv/now_playing/
 * by mountDatatypeRoutes.
 *
 * Auth model — JWT middleware (`auth/jwt.js`) is decorative; it sets
 * `req.availAuthContext.user` to the authed user or null and always calls
 * `next()`. Each handler decides whether to enforce.
 *
 *   Admin routes      — require req.availAuthContext.user (401 if null)
 *   Webhook + health  — unauthenticated; validate ?key= against the source's
 *                       stored secret (constant-time compare)
 *
 * The webhook URL ends up at /dama-admin/:env/now_playing/streams/:sid/webhook.
 * The "/dama-admin/" prefix is misleading for an unauthenticated endpoint but
 * follows the existing dataType mount convention. See the task file for the
 * deferred prefix-rename discussion.
 */

const crypto = require('crypto');
const { normalize } = require('./normalize');
const {
  buildCreateTableSQL,
  buildIdempotencyIndexSQL,
  buildInsertSQL,
  eventToInsertParams,
  COLUMN_METADATA,
} = require('./schema');

const SOURCE_TYPE = 'now_playing_stream';
const VIEW_SCHEMA_TAG = 'now_playing_detection_v1';
const SECRET_BYTES = 16;
const PG_ONLY_MSG = 'now_playing currently requires a postgres-backed dama pgEnv';

function newSecret() {
  return crypto.randomBytes(SECRET_BYTES).toString('hex');
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function requireAuth(req, res) {
  const user = req.availAuthContext?.user;
  if (!user) {
    res.status(401).json({ error: 'authentication required' });
    return null;
  }
  return user;
}

/**
 * Resolve the public base URL for webhook callbacks. Priority:
 *   1. DMS_PUBLIC_URL env var (authoritative — set this in deploys).
 *   2. X-Forwarded-Host / X-Forwarded-Proto from a trusted reverse proxy.
 *   3. http://localhost:${PORT} (dev fallback; warns and flags the response).
 *
 * Returns { url, source } so callers can surface a UI warning when the
 * URL came from the localhost fallback (ACR cannot reach localhost).
 */
function resolveBaseUrl(req) {
  const explicit = process.env.DMS_PUBLIC_URL;
  if (explicit) return { url: explicit.replace(/\/$/, ''), source: 'env' };

  const fwdHost = req.get('x-forwarded-host');
  const fwdProto = req.get('x-forwarded-proto') || 'https';
  if (fwdHost) return { url: `${fwdProto}://${fwdHost}`, source: 'forwarded' };

  const port = process.env.PORT || 3001;
  console.warn(`[now_playing] DMS_PUBLIC_URL not set — webhook URL will use http://localhost:${port}`);
  return { url: `http://localhost:${port}`, source: 'localhost' };
}

function buildWebhookUrl(req, sourceId, secret) {
  const { url, source } = resolveBaseUrl(req);
  return {
    webhook_url: `${url}/dama-admin/${req.params.pgEnv}/now_playing/streams/${sourceId}/webhook?key=${secret}`,
    base_url_source: source,
  };
}

async function loadSource(db, sourceId) {
  const table = db.type === 'postgres' ? 'data_manager.sources' : 'sources';
  const { rows } = await db.query(
    `SELECT source_id, name, type, statistics, metadata FROM ${table} WHERE source_id = $1`,
    [sourceId]
  );
  return rows[0] || null;
}

async function loadLatestView(db, sourceId) {
  const table = db.type === 'postgres' ? 'data_manager.views' : 'views';
  const { rows } = await db.query(
    `SELECT view_id, source_id, table_schema, table_name, data_table, metadata
     FROM ${table} WHERE source_id = $1 ORDER BY view_id DESC LIMIT 1`,
    [sourceId]
  );
  return rows[0] || null;
}

function parseStatistics(raw) {
  if (raw == null) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

async function updateStatistics(db, sourceId, mutator) {
  const source = await loadSource(db, sourceId);
  if (!source) return null;
  const next = mutator(parseStatistics(source.statistics));
  const table = db.type === 'postgres' ? 'data_manager.sources' : 'sources';
  await db.query(
    `UPDATE ${table} SET statistics = $1 WHERE source_id = $2`,
    [JSON.stringify(next), sourceId]
  );
  return next;
}

module.exports = function routes(router, helpers) {
  // ─── Admin: provision a stream ──────────────────────────────────────────
  // POST /dama-admin/:pgEnv/now_playing/streams
  router.post('/streams', async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    try {
      const { pgEnv } = req.params;
      const db = helpers.getDb(pgEnv);
      if (db.type !== 'postgres') return res.status(501).json({ error: PG_ONLY_MSG });

      const { name, station_name, acr_project_id, acr_stream_id } = req.body || {};
      if (!name || typeof name !== 'string') return res.status(400).json({ error: '`name` (string) is required' });

      const webhookSecret = newSecret();
      const statistics = {
        auth: { users: { [user.id]: '10' }, groups: {} },
        webhook_secret: webhookSecret,
        station_name: station_name || null,
        acr_project_id: acr_project_id || null,
        acr_stream_id: acr_stream_id || null,
      };

      const source = await helpers.createDamaSource(
        { name, type: SOURCE_TYPE, user_id: user.id, statistics },
        pgEnv
      );

      const view = await helpers.createDamaView(
        {
          source_id: source.source_id,
          user_id: user.id,
          metadata: { schema: VIEW_SCHEMA_TAG },
        },
        pgEnv
      );

      await helpers.ensureSchema(db, view.table_schema);
      await db.query(buildCreateTableSQL(view.data_table));
      await db.query(buildIdempotencyIndexSQL(view.data_table));

      // Populate the source's metadata.columns so DataWrapper, the built-in
      // Table page, and other column-aware DAMA UI know the schema. JSONB
      // merge so any future fields the route also sets (e.g. statistics
      // patches done elsewhere) are preserved. Only writes if columns
      // aren't already set — re-running provisioning won't clobber a
      // hand-edited metadata blob.
      await db.query(
        `UPDATE data_manager.sources
         SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
         WHERE source_id = $2 AND (metadata IS NULL OR NOT (metadata ? 'columns'))`,
        [JSON.stringify({ columns: COLUMN_METADATA, schema: VIEW_SCHEMA_TAG }), source.source_id]
      );

      const { webhook_url, base_url_source } = buildWebhookUrl(req, source.source_id, webhookSecret);
      res.json({
        source_id: source.source_id,
        view_id: view.view_id,
        data_table: view.data_table,
        webhook_url,
        base_url_source,
      });
    } catch (err) {
      console.error('[now_playing] create stream failed:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Admin: stream details for the edit view ────────────────────────────
  // GET /dama-admin/:pgEnv/now_playing/streams/:sourceId
  router.get('/streams/:sourceId', async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    try {
      const { pgEnv } = req.params;
      const db = helpers.getDb(pgEnv);
      const sourceId = Number(req.params.sourceId);

      const source = await loadSource(db, sourceId);
      if (!source || source.type !== SOURCE_TYPE) return res.status(404).json({ error: 'stream not found' });

      const stats = parseStatistics(source.statistics);
      const view = await loadLatestView(db, sourceId);

      let lastEventAt = null;
      let lastMatch = null;
      if (view?.data_table) {
        const { rows: lastRows } = await db.query(
          `SELECT MAX(received_at) AS last FROM ${view.data_table}`
        );
        lastEventAt = lastRows[0]?.last || null;
        const { rows: matchRows } = await db.query(
          `SELECT * FROM ${view.data_table}
           WHERE kind = 'matched'
           ORDER BY received_at DESC LIMIT 1`
        );
        lastMatch = matchRows[0] || null;
      }

      const built = stats.webhook_secret
        ? buildWebhookUrl(req, source.source_id, stats.webhook_secret)
        : { webhook_url: null, base_url_source: null };
      res.json({
        source_id: source.source_id,
        name: source.name,
        station_name: stats.station_name || null,
        acr_project_id: stats.acr_project_id || null,
        acr_stream_id: stats.acr_stream_id || null,
        view_id: view?.view_id || null,
        data_table: view?.data_table || null,
        webhook_url: built.webhook_url,
        base_url_source: built.base_url_source,
        statistics: stats,
        last_event_at: lastEventAt,
        last_match: lastMatch,
      });
    } catch (err) {
      console.error('[now_playing] get stream failed:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Admin: rotate the webhook secret ───────────────────────────────────
  // POST /dama-admin/:pgEnv/now_playing/streams/:sourceId/regenerate-secret
  router.post('/streams/:sourceId/regenerate-secret', async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    try {
      const { pgEnv } = req.params;
      const db = helpers.getDb(pgEnv);
      const sourceId = Number(req.params.sourceId);

      const source = await loadSource(db, sourceId);
      if (!source || source.type !== SOURCE_TYPE) return res.status(404).json({ error: 'stream not found' });

      const fresh = newSecret();
      await updateStatistics(db, sourceId, (stats) => ({ ...stats, webhook_secret: fresh }));

      const { webhook_url, base_url_source } = buildWebhookUrl(req, sourceId, fresh);
      res.json({
        source_id: sourceId,
        webhook_url,
        base_url_source,
      });
    } catch (err) {
      console.error('[now_playing] rotate secret failed:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Admin: kick off historical backfill from ACR Console API ───────────
  // POST /dama-admin/:pgEnv/now_playing/streams/:sourceId/backfill
  // Body: { acr_bearer_token (required, single-use),
  //         date_from?: "YYYY-MM-DD", date_to?: "YYYY-MM-DD" }
  // The token is passed straight to the worker via task.descriptor and is
  // never persisted. Re-runs over an overlapping window are safe — the
  // partial unique index on (acrid, timestamp_utc) makes the backfill
  // INSERT use ON CONFLICT DO NOTHING.
  router.post('/streams/:sourceId/backfill', async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    try {
      const { pgEnv } = req.params;
      const db = helpers.getDb(pgEnv);
      if (db.type !== 'postgres') return res.status(501).json({ error: PG_ONLY_MSG });
      const sourceId = Number(req.params.sourceId);

      const source = await loadSource(db, sourceId);
      if (!source || source.type !== SOURCE_TYPE) return res.status(404).json({ error: 'stream not found' });

      const { acr_bearer_token, date_from, date_to } = req.body || {};
      if (!acr_bearer_token || typeof acr_bearer_token !== 'string') {
        return res.status(400).json({ error: '`acr_bearer_token` (string) is required' });
      }

      const stats = parseStatistics(source.statistics);
      const acr_project_id = stats.acr_project_id;
      const acr_stream_id = stats.acr_stream_id;
      if (!acr_project_id || !acr_stream_id) {
        return res.status(400).json({
          error: 'stream is missing acr_project_id / acr_stream_id — set them when provisioning the stream'
        });
      }

      // Defensive: make sure the idempotency index is in place. The create
      // route builds it, but old streams provisioned before the index
      // landed won't have it.
      const view = await loadLatestView(db, sourceId);
      if (!view?.data_table) return res.status(409).json({ error: 'stream has no view configured' });
      await db.query(buildIdempotencyIndexSQL(view.data_table));

      const taskId = await helpers.queueTask({
        workerPath: 'now_playing/backfill',
        sourceId,
        source_id: sourceId,
        acr_project_id,
        acr_stream_id,
        acr_bearer_token,    // NOT persisted; lives only on the in-memory task descriptor
        date_from: date_from || null,
        date_to: date_to || null,
        user_id: user.id,
      }, pgEnv);

      res.json({ etl_context_id: taskId, source_id: sourceId });
    } catch (err) {
      console.error('[now_playing] backfill enqueue failed:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Webhook: ingest one ACRCloud callback ──────────────────────────────
  // POST /dama-admin/:pgEnv/now_playing/streams/:sourceId/webhook?key=<secret>
  // UNAUTHENTICATED — validates ?key= against the stored per-stream secret.
  router.post('/streams/:sourceId/webhook', async (req, res) => {
    try {
      const { pgEnv } = req.params;
      const db = helpers.getDb(pgEnv);
      const sourceId = Number(req.params.sourceId);

      const source = await loadSource(db, sourceId);
      if (!source || source.type !== SOURCE_TYPE) return res.status(401).json({ error: 'unauthorized' });

      const stats = parseStatistics(source.statistics);
      const expected = stats.webhook_secret;
      const provided = req.query.key || req.get('x-api-key') || '';
      if (!expected || !constantTimeEqual(provided, expected)) {
        return res.status(401).json({ error: 'unauthorized' });
      }

      const view = await loadLatestView(db, sourceId);
      if (!view?.data_table) return res.status(409).json({ error: 'stream has no view configured' });

      const events = normalize(req.body || {});
      if (events.length === 0) return res.json({ ok: true, events: 0 });

      const insertSql = buildInsertSQL(view.data_table);
      let inserted = 0;
      for (const ev of events) {
        try {
          await db.query(insertSql, eventToInsertParams(ev));
          inserted++;
        } catch (insErr) {
          console.error(`[now_playing] insert failed for source=${sourceId}:`, insErr.message);
        }
      }

      res.json({ ok: true, events: inserted });
    } catch (err) {
      console.error('[now_playing] webhook failed:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Webhook health check ───────────────────────────────────────────────
  // GET /dama-admin/:pgEnv/now_playing/streams/:sourceId/health?key=<secret>
  router.get('/streams/:sourceId/health', async (req, res) => {
    try {
      const { pgEnv } = req.params;
      const db = helpers.getDb(pgEnv);
      const sourceId = Number(req.params.sourceId);

      const source = await loadSource(db, sourceId);
      if (!source || source.type !== SOURCE_TYPE) return res.status(401).json({ error: 'unauthorized' });

      const stats = parseStatistics(source.statistics);
      const expected = stats.webhook_secret;
      const provided = req.query.key || req.get('x-api-key') || '';
      if (!expected || !constantTimeEqual(provided, expected)) {
        return res.status(401).json({ error: 'unauthorized' });
      }

      const view = await loadLatestView(db, sourceId);
      let lastEventAt = null;
      if (view?.data_table) {
        const { rows } = await db.query(`SELECT MAX(received_at) AS last FROM ${view.data_table}`);
        lastEventAt = rows[0]?.last || null;
      }

      res.json({ ok: true, source_id: sourceId, last_event_at: lastEventAt });
    } catch (err) {
      console.error('[now_playing] health failed:', err);
      res.status(500).json({ error: err.message });
    }
  });
};
