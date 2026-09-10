/**
 * work_zone ClickHouse access — the seam, not yet the queries.
 *
 * NPMRDS 5-minute speeds (phases 3, 5, 6) live in ClickHouse; everything else
 * this plugin reads and writes is Postgres. Workers therefore take a CH client
 * as an injected dependency (the npmrds/worker.js `makeWorkers(deps)` pattern)
 * so the integration tests can replay a recorded extract instead of standing
 * up ClickHouse.
 *
 * Query builders land here in phase 3 (in-window extract, baseline extract,
 * contamination exclusion). Phase 0 provides the client seam and the table
 * resolution that trips people up.
 */

/**
 * DAMA records a ClickHouse view's table as `clickhouse.<db>.<table>`, but the
 * CH client wants `<db>.<table>`. Forgetting this yields "database
 * `clickhouse` doesn't exist" from a query that looks correct.
 */
function stripChPrefix(table) {
  return String(table || '').replace(/^clickhouse\./, '');
}

/**
 * Real dependencies, resolved lazily so that requiring this module (and hence
 * booting the plugin) never needs dms-server's DB layer — a top-level require
 * that throws costs every plugin registered after this one its routes.
 */
function defaultChDeps() {
  return {
    getChDb: (pgEnv) => require('@availabs/dms-server/src/db').getChDb(pgEnv),
  };
}

module.exports = { stripChPrefix, defaultChDeps };
