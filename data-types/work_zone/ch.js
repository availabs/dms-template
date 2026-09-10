/**
 * work_zone ClickHouse access.
 *
 * NPMRDS 5-minute speeds live in ClickHouse; everything else this plugin reads
 * and writes is Postgres. Workers take a CH client as an injected dependency
 * (the npmrds/worker.js `makeWorkers(deps)` pattern) so tests replay a recorded
 * extract instead of standing up ClickHouse.
 *
 * ── Why the measure runs inside ClickHouse ────────────────────────────────
 * A year's work-zone active epochs are ~70 million observations. Bringing those
 * into node to count exceedances would be pointless: the counting is a GROUP BY.
 * So phase 3 stages three small tables in ClickHouse — the zones' active epoch
 * windows, the baseline's contaminated days, and per-TMC length and thresholds —
 * and one query returns ~300k (zone × tmc × hour) cells.
 *
 * The staging tables are run-scoped and dropped in a finally block. They exist
 * because ClickHouse cannot join to Postgres, and because inlining 1.7 million
 * epoch windows into a query text is not a query, it is an outage.
 */

const DEFAULT_CH_DATABASE = 'npmrds';

/**
 * DAMA records a ClickHouse view's table as `clickhouse.<db>.<table>`, but the
 * CH client wants `<db>.<table>`. Forgetting this yields "database `clickhouse`
 * doesn't exist" from a query that looks correct.
 */
function stripChPrefix(table) {
  return String(table || '').replace(/^clickhouse\./, '');
}

/**
 * Real dependencies, resolved lazily so requiring this module (and hence
 * booting the plugin) never needs dms-server's DB layer — a top-level require
 * that throws costs every plugin registered after this one its routes.
 */
function defaultChDeps() {
  return {
    getChDb: (pgEnv) => require('@availabs/dms-server/src/db').getChDb(pgEnv),
  };
}

/** A run-scoped staging table name. Suffixed so concurrent runs cannot collide. */
function stagingTableName(kind, runId) {
  const suffix = String(runId).replace(/[^A-Za-z0-9]/g, '').slice(0, 24) || `${Date.now()}`;
  return `_wz_${kind}_${suffix}`;
}

/**
 * The three staging tables, as DDL.
 *
 * `Memory` engine deliberately: these are small (thousands to low millions of
 * rows), read once, and dropped at the end of the run — paying for a MergeTree
 * on disk buys nothing.
 */
function stagingDDL({ database = DEFAULT_CH_DATABASE, tmcTable, activeTable, excludeTable }) {
  return [
    `CREATE TABLE IF NOT EXISTS ${database}.${tmcTable} (
       tmc String,
       miles Float64,
       reference_speed Float64,
       posted_speed_limit Float64,
       posted_threshold_speed Float64,
       phed_threshold_speed Float64,
       fhwa_threshold_speed Float64
     ) ENGINE = Memory`,
    `CREATE TABLE IF NOT EXISTS ${database}.${activeTable} (
       wz_event_id String,
       tmc String,
       date Date,
       epoch_from Int32,
       epoch_to Int32,
       window_source LowCardinality(String)
     ) ENGINE = Memory`,
    `CREATE TABLE IF NOT EXISTS ${database}.${excludeTable} (
       tmc String,
       date Date
     ) ENGINE = Memory`,
  ];
}

/** Drop statements for the same three, safe to run when creation failed. */
function stagingDropDDL({ database = DEFAULT_CH_DATABASE, tmcTable, activeTable, excludeTable }) {
  return [tmcTable, activeTable, excludeTable]
    .filter(Boolean)
    .map((t) => `DROP TABLE IF EXISTS ${database}.${t}`);
}

/**
 * Run a statement that returns nothing (DDL).
 *
 * The DAMA ClickHouse adapter is a thin passthrough to @clickhouse/client:
 * `query()` takes `{ query, format }` — NOT a SQL string — and `exec()` is the
 * call for statements with no result set. Passing a bare string fails deep
 * inside the client with "Cannot read properties of undefined (reading
 * 'trim')", which is why both shapes live here rather than at each call site.
 */
async function chExec(chDb, query) {
  if (typeof chDb.exec !== 'function') return chDb.query({ query });
  const res = await chDb.exec({ query });
  // `exec` hands back an unread stream; leaving it undrained logs "socket was
  // closed or ended before the response was fully read" on every DDL statement
  // and risks an uncaught ECONNRESET.
  const stream = res && res.stream;
  if (stream && typeof stream.destroy === 'function') stream.destroy();
  return res;
}

/** Run a SELECT and return its rows. */
async function chQueryRows(chDb, query) {
  const res = await chDb.query({ query, format: 'JSONEachRow' });
  if (res && typeof res.json === 'function') return res.json();
  // A fake or an adapter that already materialised the rows.
  return (res && res.rows) || res || [];
}

/**
 * Insert rows into a staging table in batches.
 *
 * The raw @clickhouse/client is needed for a values insert (the DAMA adapter
 * only exposes query), which is why this takes the adapter and reaches for
 * `.client` — the same seam npmrds/worker.js uses for JSONEachRow inserts.
 */
async function insertRows(chDb, table, rows, { batch = 50000 } = {}) {
  if (!rows || !rows.length) return 0;
  if (!chDb || !chDb.client) {
    throw new Error('work_zone/ch: the ClickHouse adapter has no .client — cannot insert staging rows');
  }
  let written = 0;
  for (let i = 0; i < rows.length; i += batch) {
    const slice = rows.slice(i, i + batch);
    await chDb.client.insert({ table, values: slice, format: 'JSONEachRow' });
    written += slice.length;
  }
  return written;
}

module.exports = {
  DEFAULT_CH_DATABASE,
  stripChPrefix,
  defaultChDeps,
  stagingTableName,
  stagingDDL,
  stagingDropDDL,
  chExec,
  chQueryRows,
  insertRows,
};
