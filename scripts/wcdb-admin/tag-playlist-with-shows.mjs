#!/usr/bin/env node
/* Add `show_id` to the playlist stream and tag existing detections with the show that
 * was on air.
 *
 *   node scripts/wcdb-admin/tag-playlist-with-shows.mjs [--dry-run]
 *        [--schedule-view 10] [--source 7] [--tz America/New_York]
 *        [--since 2026-08-31] [--until 2026-08-31]
 *
 * Three steps, and the third is the one that is easy to forget:
 *
 *  1. `ALTER TABLE … ADD COLUMN show_id` — via the dataType's own
 *     `buildMigrateTableSQL`, so the column definition cannot drift from schema.js.
 *  2. `metadata.columns` on the SOURCE. That blob is what DataWrapper, the Table page
 *     and every column picker read; a column absent from it is invisible to the whole
 *     authoring surface even though it exists in Postgres.
 *  3. `metadata.schedule` on the source — which schedule VERSION the webhook tags
 *     against. Without it, ingest records detections untagged and says nothing.
 *
 * WHICH VERSION TO BACKFILL WITH. A schedule version is only true for the period it
 * actually aired, so a whole-table backfill is only correct while ONE version has ever
 * been live. That stopped being true when Fall 2026 (view 22) replaced view 10 — so the
 * window is now explicit:
 *
 *   --since DATE   only rows at or after station-local midnight on DATE
 *   --until DATE   only rows strictly before station-local midnight on DATE
 *
 * Both are compared in --tz, not UTC, because a semester boundary is a local date.
 * The two-pass form that tags the real history:
 *
 *   … --schedule-view 22 --since 2026-08-31     # Fall 2026 onward
 *   … --schedule-view 10 --until 2026-08-31     # everything before it
 *
 * Passing NEITHER still means the whole table, which is what the original single-version
 * backfill did. It is kept for that case and is wrong for any other.
 *
 * THE POINTER IS NOT TOUCHED BY A WINDOWED RUN. Step 3 writes `metadata.schedule`, which
 * is what LIVE ingest tags against — and a historical pass over old rows must not
 * retarget the future. Backfilling view 10 into last spring would otherwise silently
 * point today's webhook back at last year's schedule. With --since/--until, step 3 is
 * skipped; run with no window (or --set-pointer) to move it deliberately.
 *
 * Idempotent; re-running only rewrites rows whose tag actually changes.
 */
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { Client } = require('pg');
const cfg = require(resolve('src/dms/packages/dms-server/src/db/configs/wcdb-dama.config.json'));
const schema = require(resolve('data-types/now_playing/schema.js'));
const { buildBackfillSQL, DEFAULT_TZ } = require(resolve('data-types/now_playing/showResolver.js'));

const args = process.argv.slice(2);
const flag = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
const DRY = args.includes('--dry-run');
const SOURCE_ID = Number(flag('source', 7));
const SCHEDULE_VIEW = Number(flag('schedule-view', 10));
const TZ = flag('tz', DEFAULT_TZ);
const SINCE = flag('since', null);
const UNTIL = flag('until', null);
const WINDOWED = Boolean(SINCE || UNTIL);
// Explicit override so a windowed run CAN still move the pointer if that is the intent.
const SET_POINTER = args.includes('--set-pointer') || !WINDOWED;

for (const [name, v] of [['since', SINCE], ['until', UNTIL]]) {
  if (v != null && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    console.error(`--${name} must be YYYY-MM-DD, got ${JSON.stringify(v)}`);
    process.exit(1);
  }
}

/* The backfill's row filter, in STATION-LOCAL time.
 *
 * `p.timestamp_utc AT TIME ZONE '<tz>'` converts the stored timestamptz to the local
 * wall clock, so '2026-08-31' means local midnight — the same boundary a person reading
 * the schedule means — not 00:00 UTC, which is 8pm the previous evening here and would
 * hand four hours of August to the Fall schedule.
 *
 * `since` is inclusive and `until` exclusive, so --until X and --since X are exact
 * complements: every row lands in exactly one of the two passes, none in both.
 */
const localTs = `(p.timestamp_utc AT TIME ZONE '${TZ}')`;
const WHERE = [
  SINCE ? `${localTs} >= TIMESTAMP '${SINCE} 00:00'` : null,
  UNTIL ? `${localTs} <  TIMESTAMP '${UNTIL} 00:00'` : null,
].filter(Boolean).join(' AND ') || 'TRUE';

const c = new Client(cfg);
await c.connect();
const q = async (s, p = []) => (await c.query(s, p)).rows;

const src = (await q(`SELECT source_id, name, metadata FROM data_manager.sources WHERE source_id = $1`, [SOURCE_ID]))[0];
if (!src) { console.error(`source ${SOURCE_ID} not found`); await c.end(); process.exit(1); }
const view = (await q(`SELECT view_id, table_schema, table_name FROM data_manager.views
                       WHERE source_id = $1 AND table_name IS NOT NULL ORDER BY view_id DESC LIMIT 1`, [SOURCE_ID]))[0];
const sched = (await q(`SELECT view_id, source_id, table_schema, table_name, version FROM data_manager.views WHERE view_id = $1`, [SCHEDULE_VIEW]))[0];
if (!view?.table_name) { console.error(`source ${SOURCE_ID} has no view with a table`); await c.end(); process.exit(1); }
if (!sched?.table_name) { console.error(`schedule view ${SCHEDULE_VIEW} not found`); await c.end(); process.exit(1); }

const TRACKS = `${view.table_schema}.${view.table_name}`;
const SCHED = `${sched.table_schema}.${sched.table_name}`;
console.log(`playlist : ${TRACKS} (source ${SOURCE_ID} "${src.name}", view ${view.view_id})`);
console.log(`schedule : ${SCHED} (view ${sched.view_id} "${sched.version}")`);
console.log(`timezone : ${TZ}${DRY ? '   (dry run)' : ''}`);
console.log(`window   : ${WINDOWED ? `${SINCE || '-∞'} ≤ local < ${UNTIL || '+∞'}` : 'whole table'}\n`);

/* 1 — the column. */
const hasCol = async () => (await q(
  `SELECT 1 FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_name='show_id'`,
  [view.table_schema, view.table_name])).length > 0;

if (await hasCol()) {
  console.log('1. show_id column already exists');
} else if (DRY) {
  console.log('1. would ADD COLUMN show_id INTEGER');
} else {
  for (const sql of schema.buildMigrateTableSQL(TRACKS).filter((x) => x.includes('show_id'))) await q(sql);
  console.log('1. + show_id INTEGER');
}

/* 2 — metadata.columns, read-modify-write so nothing else in the blob is lost. */
const meta = typeof src.metadata === 'string' ? JSON.parse(src.metadata || '{}') : (src.metadata || {});
const cols = meta.columns || [];
if (cols.some((c) => c.name === 'show_id')) {
  console.log('2. metadata.columns already lists show_id');
} else if (DRY) {
  console.log('2. would append show_id to metadata.columns');
} else {
  const entry = schema.ALL_COLUMN_METADATA.find((c) => c.name === 'show_id');
  meta.columns = [...cols, entry];
  await q(`UPDATE data_manager.sources SET metadata = $1 WHERE source_id = $2`, [JSON.stringify(meta), SOURCE_ID]);
  console.log(`2. metadata.columns += ${JSON.stringify(entry)}`);
}

/* 3 — which schedule the webhook tags against, from now on. */
const wanted = { source_id: sched.source_id, view_id: sched.view_id, tz: TZ };
// Compare FIELDS, not stringified JSON: jsonb sorts object keys on storage, so the
// round-tripped blob never string-matches the literal built here and the check would
// report "set" on every run.
const sameSchedule = (a, b) => !!a && Number(a.source_id) === Number(b.source_id)
  && Number(a.view_id) === Number(b.view_id) && (a.tz || '') === (b.tz || '');
if (!SET_POINTER) {
  console.log(`3. metadata.schedule left at ${JSON.stringify(meta.schedule)} — windowed run, pointer untouched`);
} else if (sameSchedule(meta.schedule, wanted)) {
  console.log('3. metadata.schedule already set');
} else if (DRY) {
  console.log(`3. would set metadata.schedule = ${JSON.stringify(wanted)}`);
} else {
  meta.schedule = wanted;
  await q(`UPDATE data_manager.sources SET metadata = $1 WHERE source_id = $2`, [JSON.stringify(meta), SOURCE_ID]);
  console.log(`3. metadata.schedule = ${JSON.stringify(wanted)}`);
}

/* 4 — backfill. */
// In a dry run the column may not exist yet, so count it only when it does.
const colNow = await hasCol();
// Every count below is scoped to the window, so the percentages describe the pass that
// actually ran rather than the whole table it ran inside.
const scope = `FROM ${TRACKS} p WHERE ${WHERE}`;
const before = (await q(colNow
  ? `SELECT count(*)::int n, count(p.show_id)::int tagged ${scope}`
  : `SELECT count(*)::int n, 0::int tagged ${scope}`))[0];
console.log(`\n4. backfill — ${before.n} rows in window, ${before.tagged} already tagged`);
if (DRY) {
  const preview = (await q(`
    SELECT count(*)::int would_tag FROM ${TRACKS} p
    CROSS JOIN LATERAL (
      SELECT a.show_id FROM ${SCHED} a
      WHERE a.show_id IS NOT NULL
        AND a.day = (EXTRACT(ISODOW FROM p.timestamp_utc AT TIME ZONE '${TZ}')::int - 1)
        AND TO_CHAR(p.timestamp_utc AT TIME ZONE '${TZ}', 'HH24:MI') >= a.start
        AND TO_CHAR(p.timestamp_utc AT TIME ZONE '${TZ}', 'HH24:MI') < CASE WHEN a."end"='00:00' THEN '24:00' ELSE a."end" END
      LIMIT 1) a
    WHERE p.timestamp_utc IS NOT NULL AND (${WHERE})`))[0];
  console.log(`   would tag ${preview.would_tag} of ${before.n} rows`);
} else {
  const res = await c.query(buildBackfillSQL(TRACKS, SCHED, TZ, WHERE));
  const after = (await q(`SELECT count(p.show_id)::int tagged ${scope}`))[0];
  console.log(`   updated ${res.rowCount} rows → ${after.tagged}/${before.n} tagged (${Math.round(after.tagged / before.n * 100)}%)`);
  const top = await q(`SELECT p.show_id, sh.name, count(*)::int n FROM ${TRACKS} p
    LEFT JOIN gis_datasets.s9_v9_wcdb_shows sh ON sh.show_id = p.show_id
    WHERE p.show_id IS NOT NULL AND (${WHERE}) GROUP BY 1,2 ORDER BY 3 DESC LIMIT 5`);
  console.log('   most-tagged shows:');
  for (const r of top) console.log(`     ${String(r.n).padStart(5)}  ${r.show_id}  ${r.name}`);
}
await c.end();
