#!/usr/bin/env node
/* Give `airing_id` a sequence default on the WCDB Schedule source (10).
 *
 *   node scripts/wcdb-admin/add-schedule-airing-id-default.mjs [--dry-run] [--all-views]
 *
 * WHY: `airing_id` is `INTEGER NOT NULL` and is the table's PRIMARY KEY, but it
 * has NO default. Nothing generates it, so "Add to the schedule" cannot insert:
 * the uda CRUD path builds its INSERT from the keys actually present in the
 * submitted row (`buildRowPayload`), the add modal doesn't collect an airing_id,
 * so the column is omitted and Postgres rejects the row on NOT NULL.
 *
 * WHY A SEQUENCE AND NOT `autoNumber`. The Card's create-time `autoNumber` knob
 * looks like the author-facing answer, but `applyCreateDefaults` implements it as
 *   max(nullif(regexp_replace((data->>'<col>'), …))::bigint)
 * — a DMS split-table JSON probe. `data` is not a column on an external Postgres
 * table, so on a DAMA source that query errors and the default silently never
 * lands. A DB-level default is also correct for every other writer (the CLI, a
 * migration, psql), not just this one modal.
 *
 * INTERACTION WITH SCHEDULE VERSIONS. `cloneViewTable` (uda.views.create) detects
 * sequence-backed defaults and rewires each one to a fresh `OWNED BY` sequence for
 * the clone, `setval`'d past any copied rows. So every version created from here
 * on inherits a correctly-independent airing_id sequence. Views that already exist
 * are only touched with --all-views.
 *
 * Idempotent; safe to re-run.
 */
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { Client } = require('pg');
const cfg = require(resolve('src/dms/packages/dms-server/src/db/configs/wcdb-dama.config.json'));

const DRY = process.argv.includes('--dry-run');
const ALL_VIEWS = process.argv.includes('--all-views');

const SOURCE_ID = 10;
const COLUMN = 'airing_id';
const SAFE = /^[A-Za-z_][A-Za-z0-9_]*$/;

const client = new Client(cfg);
await client.connect();
const q = async (sql, params = []) => (await client.query(sql, params)).rows;

const views = await q(
  `SELECT view_id, table_schema, table_name FROM data_manager.views
   WHERE source_id = $1 AND table_name IS NOT NULL ORDER BY view_id`, [SOURCE_ID]
);
const targets = ALL_VIEWS ? views : views.slice(-1); // newest only by default

console.log(`source ${SOURCE_ID} · ${views.length} view(s), touching ${targets.length}${DRY ? ' (dry run)' : ''}`);

for (const v of targets) {
  const { view_id, table_schema, table_name } = v;
  if (!SAFE.test(table_schema) || !SAFE.test(table_name)) {
    console.log(`  view ${view_id}: unsupported identifier, skipped`);
    continue;
  }
  const fq = `"${table_schema}"."${table_name}"`;
  const seqName = `${table_name}_${COLUMN}_seq`;
  const seqFq = `"${table_schema}"."${seqName}"`;

  const existing = (await q(
    `SELECT column_default FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
    [table_schema, table_name, COLUMN]
  ))[0];

  if (existing === undefined) {
    console.log(`  view ${view_id}: no ${COLUMN} column, skipped`);
    continue;
  }
  if (existing.column_default) {
    console.log(`  view ${view_id}: ${COLUMN} already defaults to ${existing.column_default}`);
    continue;
  }

  const max = (await q(`SELECT COALESCE(MAX("${COLUMN}"), 0)::bigint AS m FROM ${fq}`))[0].m;

  if (DRY) {
    console.log(`  view ${view_id}: would CREATE SEQUENCE ${seqName} START ${Number(max) + 1}, set as ${COLUMN} default, OWNED BY`);
    continue;
  }

  // START past the highest existing id, or the first insert collides on the PK.
  await client.query(`CREATE SEQUENCE IF NOT EXISTS ${seqFq} START WITH ${Number(max) + 1}`);
  await client.query(`SELECT setval('${table_schema}.${seqName}', ${Number(max) + 1}, false)`);
  await client.query(`ALTER TABLE ${fq} ALTER COLUMN "${COLUMN}" SET DEFAULT nextval('${table_schema}.${seqName}'::regclass)`);
  // OWNED BY ties the sequence's lifetime to the column, so dropping a version's
  // table takes its sequence with it instead of leaving an orphan behind.
  await client.query(`ALTER SEQUENCE ${seqFq} OWNED BY ${fq}."${COLUMN}"`);
  console.log(`  view ${view_id}: ${COLUMN} now defaults to nextval(${seqName}), next = ${Number(max) + 1}`);
}

await client.end();
