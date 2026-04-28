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
 *   POST /streams/:sourceId/webhook?key=<secret>  — webhook ingest (no auth, validates ?key=)
 *   GET  /streams/:sourceId/health?key=<secret>   — webhook health (no auth, validates ?key=)
 *
 * No background workers — synchronous INSERT on the request thread is
 * appropriate at ACR's rate (~one POST per ~30s with send_noresult on).
 */

module.exports = {
  workers: {},
  routes: require('./routes'),
};
