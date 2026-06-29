/**
 * ClickHouse load helpers (I/O glue) for npmrds_raw.
 *
 * NOT unit-tested: requires a live ClickHouse. The worker injects these via
 * deps, and tests inject fakes (no live CH). Exercised only in the approved
 * manual publish — the CSV format/skip-header behavior MUST be confirmed there
 * against a real RITIS export.
 *
 * Uses the underlying @clickhouse/client (chDb.client) since the adapter exposes
 * only query/exec; insert needs the raw client.
 */
const { createReadStream } = require('fs');

function client(chDb) {
  if (!chDb || !chDb.client) {
    throw new Error('ch-load: ClickHouse adapter has no .client (cannot insert)');
  }
  return chDb.client;
}

/**
 * Stream a CSV file into a ClickHouse table. `table` is 'db.table'.
 * NOTE: RITIS exports include a header row → CSVWithNames maps by header name,
 * so the temp table column names must match the export headers. Confirm during
 * the approved manual run; switch to { format: 'CSV', clickhouse_settings:
 * { input_format_csv_skip_first_lines: 1 } } if the export is header-positional.
 */
async function loadCsvToCh(chDb, table, csvPath, /* pgEnv */) {
  if (!csvPath) throw new Error(`ch-load: no csvPath for ${table}`);
  await client(chDb).insert({
    table,
    values: createReadStream(csvPath),
    format: 'CSVWithNames',
  });
}

/** Insert JS objects (e.g. tmc→geometry) as JSONEachRow. */
async function insertRows(chDb, table, rows /*, pgEnv */) {
  if (!rows || !rows.length) return;
  await client(chDb).insert({ table, values: rows, format: 'JSONEachRow' });
}

module.exports = { loadCsvToCh, insertRows };
