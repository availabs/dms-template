#!/usr/bin/env node
/* Make the two new sources usable: semantic PK, editable, granted, described.
 *
 *   node scripts/wcdb-admin/finish-new-sources.mjs [--dry-run]
 *
 * `publish.mjs` lands a source and its table, and stops. Three things stand
 * between that and an admin page that can actually write to it, and each has
 * bitten this project once already:
 *
 *  1. **The upload pipeline declares its own PK** — every table comes out with
 *     `PRIMARY KEY (ogc_fid)`, not the semantic key. Rows are then addressed by
 *     an ingest-generated surrogate with no meaning outside the table.
 *  2. **`metadata.columns` must exist**, or DataWrapper, the Table page and
 *     every column-aware picker render an empty grid against the source.
 *     `isEditable` lives in the same blob and is what the edit gate reads.
 *  3. **The per-source permission gate is STRICT.** A source with no
 *     `auth_permissions` denies EVERYONE — that is how the admin build found
 *     that no station admin could edit any wcdb-dama source. A brand-new source
 *     starts in exactly that state.
 *
 * Idempotent; safe to re-run.
 */
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { Client } = require('pg');
const cfg = require(resolve('src/dms/packages/dms-server/src/db/configs/wcdb-dama.config.json'));

const DRY = process.argv.includes('--dry-run');
const ADMIN_GROUP = 'wcdb Admin';

const TARGETS = [
  { source_id: 12, pk: 'admin_id', table: 'gis_datasets.s12_v12_wcdb_administrators' },
  { source_id: 13, pk: 'post_id', table: 'gis_datasets.s13_v13_wcdb_posts' },
];

const client = new Client(cfg);
await client.connect();

for (const t of TARGETS) {
  const [schema, table] = t.table.split('.');

  const cols = (await client.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`, [schema, table]
  )).rows.filter((c) => c.column_name !== 'ogc_fid');

  const pkNow = (await client.query(
    `SELECT a.attname FROM pg_index i
     JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
     WHERE i.indrelid = $1::regclass AND i.indisprimary`, [t.table]
  )).rows.map((r) => r.attname);

  console.log(`\n── source ${t.source_id} · ${t.table}`);
  console.log(`   columns: ${cols.length} · current PK: ${pkNow.join(', ') || 'none'}`);

  if (DRY) continue;

  // 1 — repoint the PK to the semantic key. Drop whatever real PK exists first
  // (the ingest's `ogc_fid`), by looking the constraint up rather than assuming
  // its name.
  if (!(pkNow.length === 1 && pkNow[0] === t.pk)) {
    const con = (await client.query(
      `SELECT conname FROM pg_constraint WHERE conrelid = $1::regclass AND contype = 'p'`, [t.table]
    )).rows[0];
    await client.query('BEGIN');
    if (con) await client.query(`ALTER TABLE ${t.table} DROP CONSTRAINT ${con.conname}`);
    // A primary key cannot be null; the transform guarantees it, so a failure
    // here is a data problem worth stopping on rather than working around.
    await client.query(`ALTER TABLE ${t.table} ALTER COLUMN ${t.pk} SET NOT NULL`);
    await client.query(`ALTER TABLE ${t.table} ADD PRIMARY KEY (${t.pk})`);
    await client.query('COMMIT');
    console.log(`   PK → ${t.pk}`);
  } else {
    console.log(`   PK already ${t.pk}`);
  }

  // 2 — metadata.columns + isEditable, merged so nothing else in the blob is lost.
  const metadata = {
    columns: cols.map((c) => ({
      name: c.column_name,
      display_name: c.column_name.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()),
      type: c.data_type.toUpperCase(),
      desc: null,
    })),
    isEditable: true,
  };
  await client.query(
    `UPDATE data_manager.sources SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb WHERE source_id = $2`,
    [JSON.stringify(metadata), t.source_id]
  );

  // 3 — the grant. Merge, never replace: other users/groups keep theirs.
  await client.query(
    `UPDATE data_manager.sources
     SET auth_permissions = jsonb_set(
       COALESCE(auth_permissions, '{"users":{},"groups":{}}'::jsonb),
       '{groups}',
       COALESCE(auth_permissions->'groups', '{}'::jsonb) || $1::jsonb
     )
     WHERE source_id = $2`,
    [JSON.stringify({ [ADMIN_GROUP]: ['*'], public: [] }), t.source_id]
  );

  const row = (await client.query(
    `SELECT metadata, auth_permissions FROM data_manager.sources WHERE source_id = $1`, [t.source_id]
  )).rows[0];
  console.log(`   metadata: ${row.metadata?.columns?.length} columns · isEditable=${row.metadata?.isEditable}`);
  console.log(`   grants: ${JSON.stringify(row.auth_permissions?.groups)}`);
}

await client.end();
console.log('\ndone');
