/**
 * Shared worker-side helpers for the transcom plugin (sqlite/postgres
 * portability for the DAMA bookkeeping tables + JSON column merges).
 * Same patterns as data-types/npmrds_raw/worker.js.
 */

const sanitizeName = (s) => String(s).replace(/[\s\W]+/g, '_');

/** Resolve the unqualified vs data_manager-qualified table name for the active DB. */
function tableFor(db, base) {
  return db.type === 'postgres' ? `data_manager.${base}` : base;
}

const parseJson = (v) => (typeof v === 'string' ? (v ? JSON.parse(v) : {}) : (v || {}));

/** Read-modify-write a JSON column (portable across sqlite TEXT / pg JSONB). */
async function mergeJsonColumn(db, table, idCol, id, col, patch) {
  const { rows } = await db.query(`SELECT ${col} FROM ${table} WHERE ${idCol} = $1`, [id]);
  const cur = rows[0] && rows[0][col];
  const next = { ...parseJson(cur), ...patch };
  await db.query(`UPDATE ${table} SET ${col} = $1 WHERE ${idCol} = $2`, [JSON.stringify(next), id]);
  return next;
}

/** All views rows for a source, with parsed metadata (portable; JS-side filtering). */
async function getViewsForSource(db, sourceId) {
  const viewsTable = tableFor(db, 'views');
  const { rows } = await db.query(
    `SELECT view_id, source_id, table_schema, table_name, data_table, version, metadata
     FROM ${viewsTable} WHERE source_id = $1 ORDER BY view_id`,
    [sourceId]
  );
  return rows.map((r) => ({ ...r, metadata: parseJson(r.metadata) }));
}

async function getViewById(db, viewId) {
  const viewsTable = tableFor(db, 'views');
  const { rows } = await db.query(
    `SELECT view_id, source_id, table_schema, table_name, data_table, version, metadata
     FROM ${viewsTable} WHERE view_id = $1`,
    [viewId]
  );
  if (!rows[0]) return null;
  return { ...rows[0], metadata: parseJson(rows[0].metadata) };
}

async function getSourceById(db, sourceId) {
  const sourcesTable = tableFor(db, 'sources');
  const { rows } = await db.query(
    `SELECT source_id, name, type, metadata FROM ${sourcesTable} WHERE source_id = $1`,
    [sourceId]
  );
  if (!rows[0]) return null;
  return { ...rows[0], metadata: parseJson(rows[0].metadata) };
}

/**
 * The npmrds geometry "full version" view: a Postgres (non-ClickHouse) view
 * with no per-year split — legacy filtered with jsonb operators; we filter
 * in JS for sqlite portability.
 */
async function resolveGeomFullView(db, geomSourceId) {
  const views = await getViewsForSource(db, geomSourceId);
  return views.find((v) => {
    const m = v.metadata || {};
    const notCh = Number(m.is_clickhouse_table || 0) === 0;
    return notCh && (m.year === undefined || m.year === null);
  }) || null;
}

/** The npmrds geometry per-year view (metadata.year === year). */
async function resolveGeomYearView(db, geomSourceId, year) {
  const views = await getViewsForSource(db, geomSourceId);
  return views.find((v) => Number((v.metadata || {}).year) === Number(year)) || null;
}

/** Set the physical table pointers on a views row. */
async function setViewTable(db, viewId, schema, table) {
  const viewsTable = tableFor(db, 'views');
  await db.query(
    `UPDATE ${viewsTable} SET table_schema = $1, table_name = $2, data_table = $3 WHERE view_id = $4`,
    [schema, table, `${schema}.${table}`, viewId]
  );
}

/** Simple bounded retry with linear backoff (legacy MAX_RETRIES pattern). */
async function withRetries(fn, maxRetries = 3, baseDelayMs = 500) {
  let attempt = 0;
  for (;;) {
    try {
      return await fn(attempt);
    } catch (err) {
      attempt++;
      if (attempt >= maxRetries) return null; // legacy: "Max retries reached. Skipping batch."
      await new Promise((r) => setTimeout(r, baseDelayMs * attempt));
    }
  }
}

module.exports = {
  sanitizeName,
  tableFor,
  parseJson,
  mergeJsonColumn,
  getViewsForSource,
  getViewById,
  getSourceById,
  resolveGeomFullView,
  resolveGeomYearView,
  setViewTable,
  withRetries,
};
