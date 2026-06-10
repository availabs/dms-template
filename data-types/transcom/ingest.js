/**
 * Shared TRANSCOM event ingest pipeline (publish + add workers):
 *   collect event ids for the window -> dedupe against the events table ->
 *   fetch full events in batches -> normalize -> idempotent batched insert.
 *
 * Ported from the legacy transcom.worker.mjs / transcom_add.worker.mjs main
 * loops. The TRANSCOM API is only reachable through the injected `client`
 * (tests pass a fake; the real one lives in transcom_api.js).
 */
const { normalizeEvent } = require('./events.js');
const { insertEventsSQL } = require('./sql.js');
const { withRetries } = require('./workers/util.js');

const FETCH_BATCH_SIZE = 100; // event-id batch per getEventById request
const INSERT_FLUSH_SIZE = 2000; // legacy insert flush threshold

async function ingestEvents({
  dataDb,
  client,
  schema,
  table,
  startTimestamp,
  endTimestamp,
  onProgress = async () => {},
}) {
  let eventIds = await client.collectEventIdsForTimeRange(startTimestamp, endTimestamp) || [];

  // Dedupe against already-ingested event ids.
  const { rows } = await dataDb.query(`SELECT event_id FROM ${schema}.${table}`);
  const known = new Set((rows || []).map((r) => r.event_id));
  eventIds = eventIds.filter((id) => !known.has(id));

  let buffer = [];
  let inserted = 0;

  const flush = async () => {
    if (!buffer.length) return;
    await dataDb.query(insertEventsSQL(schema, table, buffer));
    inserted += buffer.length;
    buffer = [];
  };

  for (let i = 0; i < eventIds.length; i += FETCH_BATCH_SIZE) {
    const ids = eventIds.slice(i, i + FETCH_BATCH_SIZE);
    const batch = await withRetries(() => client.downloadEvents(ids));
    if (batch && batch.length) {
      buffer.push(...batch.map(normalizeEvent));
    }
    if (buffer.length >= INSERT_FLUSH_SIZE) await flush();
    await onProgress(Math.min(1, (i + FETCH_BATCH_SIZE) / Math.max(1, eventIds.length)));
  }
  await flush();

  return { requested: eventIds.length, inserted };
}

module.exports = { ingestEvents };
