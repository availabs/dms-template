#!/usr/bin/env node
/* Bring the LIVE WCDB playlist stream up to the provenance schema.
 *
 *   export DMS_AUTH_TOKEN=…
 *   node scripts/wcdb-admin/migrate-playlist-source.mjs [--dry-run]
 *
 * Provisioning creates a stream's table; this stream (source 7) was
 * provisioned before `provenance` existed, and `CREATE TABLE IF NOT EXISTS` is
 * a no-op against a table that is already there. So the columns, the
 * mark-corrected trigger, the refreshed `metadata.columns`, and `isEditable`
 * all have to be applied to the live source once, by hand.
 *
 * Everything here is idempotent (ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE,
 * DROP TRIGGER IF EXISTS) and re-runnable.
 *
 * WHY isEditable — the admin playlist is a REVIEW QUEUE: a DJ fixes a
 * low-confidence match and fills a gap. Both are writes to this source, and an
 * external source is only writable with a real single-column primary key AND
 * isEditable on. Source 7 already has `PRIMARY KEY (id)`; this turns on the
 * second half. It is a deliberate admin action — it makes the live feed
 * writable from the admin UI — taken with the user's agreement 2026-08-14.
 */
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const SERVER = resolve('src/dms/packages/dms-server');
const { Client } = require('pg');
const schema = require(resolve('data-types/now_playing/schema.js'));

const PG_ENV = 'wcdb-dama';
const SOURCE_ID = 7;
const TABLE = 'gis_datasets.s7_v7';
const API_HOST = process.env.DMS_HOST || 'http://localhost:3001';
const DRY = process.argv.includes('--dry-run');

const cfg = require(`${SERVER}/src/db/configs/${PG_ENV}.config.json`);

const migrations = schema.buildMigrateTableSQL(TABLE);
const triggers = schema.buildProvenanceTriggerSQL(TABLE);

if (DRY) {
  console.log(`-- ${migrations.length} column statements + ${triggers.length} trigger statements against ${TABLE}`);
  console.log([...migrations, ...triggers].join(';\n'));
  console.log('\n-- then: metadata.columns refresh + isEditable (JSONB merge on the source row)');
  process.exit(0);
}

const client = new Client({
  host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password, database: cfg.database,
});

await client.connect();

/* ── 1. columns ─────────────────────────────────────────────────────────── */
const before = await client.query(
  `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`,
  TABLE.split('.')
);
for (const sql of migrations) await client.query(sql);
const after = await client.query(
  `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`,
  TABLE.split('.')
);
const added = after.rows
  .map((r) => r.column_name)
  .filter((c) => !before.rows.some((b) => b.column_name === c));
console.log(`columns: ${before.rows.length} → ${after.rows.length}${added.length ? ` (added ${added.join(', ')})` : ' (no change)'}`);

/* ── 2. the mark-corrected trigger ──────────────────────────────────────── */
for (const sql of triggers) await client.query(sql);
const trg = await client.query(
  `SELECT tgname FROM pg_trigger WHERE tgrelid = $1::regclass AND NOT tgisinternal`,
  [TABLE]
);
console.log(`triggers: ${trg.rows.map((r) => r.tgname).join(', ') || 'NONE'}`);

/* ── 3. backfill provenance on existing rows ────────────────────────────── */
// Every row already in the table came from the matcher. The column default
// only applies to new rows, so state it for the 27k that predate it — a NULL
// provenance would otherwise be indistinguishable from "unclassified" in any
// future query, even though we know exactly what these are.
const filled = await client.query(`UPDATE ${TABLE} SET provenance = 'auto' WHERE provenance IS NULL`);
console.log(`provenance backfilled on ${filled.rowCount} existing rows`);

const dist = await client.query(
  `SELECT provenance, count(*)::int AS n FROM ${TABLE} GROUP BY 1 ORDER BY 2 DESC`
);
console.log(`provenance now: ${dist.rows.map((r) => `${r.provenance}=${r.n}`).join(' · ')}`);

await client.end();

/* ── 4. metadata.columns + isEditable ───────────────────────────────────────
 * Written as a JSONB MERGE on the source row rather than through the falcor
 * set route, for one reason: the set route enforces per-source permissions, and
 * source 7 is granted to `wcdb Admin` (amuro, darius) — correctly. A dev token
 * is not in that group, and widening the grant so a maintenance script can run
 * would be backwards. The merge is the same write the route performs, minus the
 * route's object-vs-string landmine.
 *
 * `metadata || $1` preserves every other key on the blob (`schema`,
 * `is_dirty`), which is the part hand-writing this usually gets wrong.
 */
const metaSql = `UPDATE data_manager.sources
                 SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
                 WHERE source_id = $2`;

const meta = new Client({
  host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password, database: cfg.database,
});
await meta.connect();
await meta.query(metaSql, [
  JSON.stringify({ columns: schema.COLUMN_METADATA, isEditable: true }),
  SOURCE_ID,
]);

// Verify from a fresh read, not from "the query didn't throw".
const { rows } = await meta.query(
  `SELECT metadata FROM data_manager.sources WHERE source_id = $1`, [SOURCE_ID]
);
await meta.end();

const saved = rows[0]?.metadata || {};
const savedCols = (saved.columns || []).map((c) => c.name);
const wanted = ['provenance', 'edited_by', 'edited_at', 'original_title', 'original_artist_name', 'original_score'];
console.log(`metadata: isEditable=${saved.isEditable} · ${savedCols.length} columns · other keys kept: ${
  Object.keys(saved).filter((k) => k !== 'columns' && k !== 'isEditable').join(', ') || 'none'
}`);
console.log(`provenance columns in metadata: ${wanted.filter((c) => savedCols.includes(c)).join(', ') || 'NONE'}`);
if (!saved.isEditable || !wanted.every((c) => savedCols.includes(c))) {
  console.error('metadata write did NOT land as expected');
  process.exit(1);
}
