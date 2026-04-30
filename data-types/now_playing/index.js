/**
 * now_playing dataType plugin.
 *
 * Receives ACRCloud Custom Stream Monitoring webhook callbacks per stream
 * and persists each detection (matched + no-match) into a per-stream DAMA
 * table. Each "stream" is a DAMA source (type: 'now_playing_stream') with
 * one view; the view's data table is auto-created at provision time.
 *
 * Mounted at /dama-admin/:pgEnv/now_playing/ via mountDatatypeRoutes.
 *
 *   POST /streams                                 — create a stream (auth)
 *   GET  /streams/:sourceId                        — admin info for the edit view (auth)
 *   POST /streams/:sourceId/regenerate-secret     — rotate webhook secret (auth)
 *   POST /streams/:sourceId/backfill              — kick off historical backfill (auth)
 *   POST /streams/:sourceId/webhook?key=<secret>  — webhook ingest (no auth, validates ?key=)
 *   GET  /streams/:sourceId/health?key=<secret>   — webhook health (no auth, validates ?key=)
 *
 * Webhook ingest is synchronous (no worker — ACR sends ~one POST per ~30s
 * with send_noresult on, so on-thread INSERT is fine). Historical backfill
 * IS a worker (`now_playing/backfill`) because it pages through the ACR
 * Console API and can take minutes; the existing task/event polling infra
 * drives the create-page progress UI.
 */

module.exports = {
  workers: {
    'now_playing/backfill': require('./backfillWorker'),
  },
  routes: require('./routes'),
};
