#!/usr/bin/env node
/* Give every Fall 2026 sheet label a show record, then fill the open hours in a
 * schedule version.
 *
 *   node scripts/wcdb-admin/create-missing-shows-and-djs.mjs [--dry-run] [--view 22]
 *
 * The Fall 2026 load left 11 hours open because the labels had no show to point at.
 * Three distinct causes, three different fixes — lumping them together would create
 * duplicate records in a dataset that already suffers from them:
 *
 *  1. RENAME. `DJ Twink Death` and `Marita` DO own a show; it is one of the 102 named
 *     with the legacy placeholder "Show Name". That record is the show — it was just
 *     never named. Renaming it is right; creating a second one would leave the DJ with
 *     two shows, one of them junk.
 *  2. CREATE A SHOW. Five DJs (plus one of the three duplicate `DJ Radio Rebel`
 *     records) exist but own nothing at all.
 *  3. CREATE A DJ *AND* A SHOW. Three sheet labels are in neither dataset.
 *
 * Shows are named "<on_air_name>'s Show" — the on-air name exactly as the DJs dataset
 * stores it, not as the sheet spells it, so the record matches the rest of the dataset.
 * `department` and its icon are inherited from the DJ (the department→icon mapping is
 * 1:1 across all 705 existing shows); a brand-new DJ has no department to inherit, so
 * both are left NULL rather than guessed.
 *
 * `show_id` / `dj_id` are `INTEGER NOT NULL` PRIMARY KEYs with NO default (the same gap
 * `airing_id` had), so they are assigned explicitly as max+1.
 *
 * Idempotent: re-running matches existing records by dj_id + show name and inserts no
 * duplicate airings.
 */
import { createRequire } from 'node:module';
import { resolve as rp } from 'node:path';

const require = createRequire(import.meta.url);
const { Client } = require('pg');
const cfg = require(rp('src/dms/packages/dms-server/src/db/configs/wcdb-dama.config.json'));

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const vi = args.indexOf('--view');
const VIEW_ID = vi >= 0 ? +args[vi + 1] : 22;

const SHOWS = 'gis_datasets.s9_v9_wcdb_shows';
const DJS = 'gis_datasets.s8_v8_wcdb_djs';
const ICON = { Electronic: 'Sliders', 'Hip-Hop/R&B': 'Microphone', Jazz: 'Note', Metal: 'Bolt',
               News: 'Newspaper', Rock: 'Pick', Specialty: 'Star', Sports: 'Trophy', World: 'Globe' };

/* The 11 open hours, with how each is to be closed. `day` is 0 = Monday. */
const WORK = [
  // 1 — rename the placeholder show the DJ already owns
  { label: 'DJ Twink Death',      day: 0, start: 20, end: 21, mode: 'rename', dj_id: 1250, show_id: 694 },
  { label: 'DJ Marita',           day: 2, start: 11, end: 12, mode: 'rename', dj_id: 1255, show_id: 700 },
  // 2 — DJ exists, owns nothing
  { label: 'DJ Shoebill',         day: 2, start: 12, end: 13, mode: 'show', dj_id: 1268 },
  { label: 'DJ Nikolo',           day: 2, start: 15, end: 16, mode: 'show', dj_id: 1266 },
  { label: 'DJ Blaze',            day: 4, start: 14, end: 15, mode: 'show', dj_id: 1264 },
  { label: 'DJ H-Bomb',           day: 4, start: 18, end: 20, mode: 'show', dj_id: 1270 },
  { label: 'dj goldeedust',       day: 5, start: 20, end: 22, mode: 'show', dj_id: 1269 },
  // Three duplicate `DJ Radio Rebel` records (1261/1262/1263), all current, none with a
  // show. 1263 is the only one whose first/last name is a real person's rather than a
  // repeat of the on-air name, so it is the one treated as the live record.
  { label: 'DJ Radio Rebel',      day: 5, start: 16, end: 17, mode: 'show', dj_id: 1263 },
  // 3 — in neither dataset
  { label: 'urfavoritestepuncle', day: 1, start: 19, end: 20, mode: 'dj+show' },
  { label: 'Skewpular',           day: 2, start: 17, end: 18, mode: 'dj+show' },
  { label: 'DJ Nora',             day: 6, start: 18, end: 19, mode: 'dj+show' },
];

const hhmm = (h) => `${String(h % 24).padStart(2, '0')}:00`;
const possessive = (n) => `${n}${/s$/i.test(n) ? "'" : "'s"} Show`;

const c = new Client(cfg);
await c.connect();
const q = async (s, p = []) => (await c.query(s, p)).rows;

const view = (await q(`select view_id, table_schema, table_name, version from data_manager.views where view_id=$1`, [VIEW_ID]))[0];
if (!view?.table_name) { console.error(`view ${VIEW_ID} not found`); await c.end(); process.exit(1); }
const T = `${view.table_schema}.${view.table_name}`;
console.log(`target: view ${view.view_id} "${view.version}" · ${view.table_name}${DRY ? '   (dry run)' : ''}\n`);

let nextShow = (await q(`select coalesce(max(show_id),0)+1 n from ${SHOWS}`))[0].n;
let nextDj = (await q(`select coalesce(max(dj_id),0)+1 n from ${DJS}`))[0].n;
const done = [];

for (const w of WORK) {
  let dj_id = w.dj_id, show_id = null, onAir = w.label, dept = null, note = '';

  if (w.mode === 'dj+show') {
    const found = (await q(`select dj_id, department from ${DJS} where lower(on_air_name)=lower($1)`, [w.label]))[0];
    if (found) { dj_id = found.dj_id; dept = found.department; note = 'dj already existed'; }
    else if (DRY) { dj_id = nextDj++; note = `would create dj ${dj_id}`; }
    else {
      dj_id = nextDj++;
      await q(`insert into ${DJS} (dj_id, on_air_name, status) values ($1,$2,'current')`, [dj_id, w.label]);
      note = `created dj ${dj_id}`;
    }
  } else {
    const d = (await q(`select on_air_name, department from ${DJS} where dj_id=$1`, [dj_id]))[0];
    onAir = d?.on_air_name || w.label;
    dept = d?.department ?? null;
  }

  const name = possessive(onAir);

  if (w.mode === 'rename') {
    const cur = (await q(`select show_id, name, department from ${SHOWS} where show_id=$1`, [w.show_id]))[0];
    show_id = w.show_id;
    if (cur?.name === name) note = 'already renamed';
    else if (DRY) note = `would rename show ${show_id} "${cur?.name}" → "${name}"`;
    else { await q(`update ${SHOWS} set name=$1 where show_id=$2`, [name, show_id]); note = `renamed show ${show_id} (was "${cur?.name}")`; }
  } else {
    const ex = (await q(`select show_id from ${SHOWS} where dj_id=$1 and name=$2`, [dj_id, name]))[0];
    if (ex) { show_id = ex.show_id; note = `${note ? note + '; ' : ''}show already existed`; }
    else if (DRY) { show_id = nextShow++; note = `${note ? note + '; ' : ''}would create show ${show_id} "${name}"`; }
    else {
      show_id = nextShow++;
      await q(`insert into ${SHOWS} (show_id, name, dj_id, department, icon) values ($1,$2,$3,$4,$5)`,
        [show_id, name, dj_id, dept, dept ? (ICON[dept] ?? null) : null]);
      note = `${note ? note + '; ' : ''}created show ${show_id} "${name}"`;
    }
  }

  // The airing. Guard on (day, start) so a re-run does not double-book the hour.
  const clash = (await q(`select airing_id, show_id from ${T} where day=$1 and start=$2`, [w.day, hhmm(w.start)]))[0];
  let airing;
  if (clash) airing = `hour already filled by show ${clash.show_id}`;
  else if (DRY) airing = 'would add airing';
  else {
    const r = (await q(`insert into ${T} (show_id, day, start, "end") values ($1,$2,$3,$4) returning airing_id`,
      [show_id, w.day, hhmm(w.start), hhmm(w.end)]))[0];
    airing = `airing ${r.airing_id}`;
  }

  done.push({ label: w.label, dept, note, airing });
  console.log(`  ${w.label}`);
  console.log(`      ${note}`);
  console.log(`      day ${w.day} ${hhmm(w.start)}-${hhmm(w.end)} → ${airing}${dept ? '' : '   [no department — icon left null]'}`);
}

const r = (await q(`select count(*)::int n, count(distinct show_id)::int shows from ${T}`))[0];
console.log(`\n${T}: ${r.n} airings, ${r.shows} distinct shows`);
await c.end();
