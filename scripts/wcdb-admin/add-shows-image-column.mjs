#!/usr/bin/env node
/* Add `image` to the WCDB Shows source (9).
 *
 *   node scripts/wcdb-admin/add-shows-image-column.mjs [--dry-run]
 *
 * WHY: the home page's on-air rail is, in the design, a full-bleed PHOTOGRAPH
 * of the show with the identity overlaid on it (`home.html`, `card:on-air`).
 * There was nowhere to put one — `shows` carried
 * `show_id, name, dj_id, department, icon, description, legacy_schedule_ids`
 * and no image. `icon` is a glyph NAME (a vocabulary value like `Mic`), not an
 * asset, so it cannot stand in.
 *
 * `image` is TEXT holding a URL, matching the house convention already set by
 * `now_playing_stream.album_cover` and `posts.image` — not a bytea, not a
 * foreign key to an asset table. A show with no photo is normal and stays
 * NULL; the panel falls back to the derived gradient.
 *
 * TWO STEPS, and the second is the one that gets forgotten:
 *
 *  1. `ALTER TABLE … ADD COLUMN`. On its own this changes nothing a user can
 *     see — DataWrapper does not introspect the table.
 *  2. **`metadata.columns` on the source row.** That blob is what DataWrapper,
 *     the Table page and every column picker read. A column absent from it is
 *     invisible to the whole authoring surface even though it exists in
 *     Postgres. (Same trap `finish-new-sources.mjs` documents for new sources.)
 *
 * Idempotent; safe to re-run.
 */
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { Client } = require('pg');
const cfg = require(resolve('src/dms/packages/dms-server/src/db/configs/wcdb-dama.config.json'));

const DRY = process.argv.includes('--dry-run');

const SOURCE_ID = 9;
const TABLE = 'gis_datasets.s9_v9_wcdb_shows';
const COLUMN = {
  name: 'image',
  display_name: 'Image',
  type: 'TEXT',
  desc: 'URL of a photo of the show, used full-bleed behind the on-air panel on the home page. Landscape crops read best; leave empty and the panel falls back to a generated gradient.',
};

const client = new Client(cfg);
await client.connect();

const has = async () => (await client.query(
  `SELECT 1 FROM information_schema.columns
   WHERE table_schema = split_part($1,'.',1) AND table_name = split_part($1,'.',2)
     AND column_name = $2`, [TABLE, COLUMN.name]
)).rowCount > 0;

console.log(`source ${SOURCE_ID} · ${TABLE}`);

/* 1 — the column itself. */
if (await has()) {
  console.log(`  column ${COLUMN.name} already exists`);
} else if (DRY) {
  console.log(`  would ALTER TABLE ${TABLE} ADD COLUMN ${COLUMN.name} TEXT`);
} else {
  await client.query(`ALTER TABLE ${TABLE} ADD COLUMN ${COLUMN.name} TEXT`);
  console.log(`  + ${COLUMN.name} TEXT`);
}

/* 2 — metadata.columns, appended in place.
 *
 * Read-modify-write rather than a jsonb_set on an index: the blob carries
 * per-column display names and descriptions an author may have edited, and the
 * column order is the order the pickers list them in. Appending keeps both. */
const row = (await client.query(
  `SELECT metadata FROM data_manager.sources WHERE source_id = $1`, [SOURCE_ID]
)).rows[0];
const columns = row?.metadata?.columns || [];
const already = columns.some((c) => c.name === COLUMN.name);

if (already) {
  console.log(`  metadata.columns already lists ${COLUMN.name}`);
} else if (DRY) {
  console.log(`  would append ${COLUMN.name} to metadata.columns (${columns.length} → ${columns.length + 1})`);
} else {
  await client.query(
    `UPDATE data_manager.sources
     SET metadata = jsonb_set(COALESCE(metadata,'{}'::jsonb), '{columns}', $1::jsonb)
     WHERE source_id = $2`,
    [JSON.stringify([...columns, COLUMN]), SOURCE_ID]
  );
  console.log(`  metadata.columns ${columns.length} → ${columns.length + 1}`);
}

const after = (await client.query(
  `SELECT jsonb_agg(x->>'name' ORDER BY ord) AS names, (metadata->>'isEditable')::bool AS editable
   FROM data_manager.sources, jsonb_array_elements(metadata->'columns') WITH ORDINALITY t(x, ord)
   WHERE source_id = $1 GROUP BY metadata`, [SOURCE_ID]
)).rows[0];
console.log(`  now: ${(after?.names || []).join(', ')}`);
console.log(`  isEditable: ${after?.editable}`);

await client.end();
console.log('done');
