#!/usr/bin/env node
/* Create a schedule version from a parsed season sheet.
 *
 *   python3 scripts/wcdb-admin/parse-schedule-xlsx.py "Fall 2026" > /tmp/slots.json
 *   node scripts/wcdb-admin/load-fall-2026-schedule.mjs /tmp/slots.json [--dry-run] [--version "Fall 2026"]
 *
 * Two jobs: resolve each sheet label to a `show_id`, then create a BLANK version of
 * source 10 (via the same `createSourceView` the ScheduleGrid's "New" button calls) and
 * insert the airings that resolved.
 *
 * WHY RESOLUTION IS HARD. The sheet gives DJ on-air names; the schedule stores show_ids.
 * Both reference datasets are full of legacy duplicates — three DJs named "Alex", three
 * "DJ Gabe", 102 shows literally named "Show Name" — so the order the rules fire in is
 * load-bearing:
 *
 *   1. exact show-name match
 *   2. DJ match, strict on_air_name FIRST (the "DJ " prefix is the only thing separating
 *      dj 508 "Alex"/Alex Muro → B3nson Radio from dj 1238 "DJ Alex"/Alex Collis → The
 *      Pity Party; both are current and both own a show), then a looser name match
 *   3. show-name PREFIX, last and only for labels of 8+ chars — "Spunk & Gunk" really is
 *      "Spunk and Gunk at the movies", but a short label prefix-matches far too much:
 *      running this rule before the DJ lookup silently resolved "Alex" to the show
 *      "Alex G's Show", which belongs to somebody else entirely.
 *
 * Among duplicate DJ records: current-with-a-show wins. Among a DJ's several shows: the
 * primary before any "Encore"/"Replay" variant, earliest slot first — which is exactly
 * how Bill McCann's Saturday original and Sunday encore land correctly.
 *
 * SLOTS THAT DO NOT RESOLVE ARE LEFT OUT ON PURPOSE. The grid draws every hour of the
 * week and renders an unfilled one as "open — click to add", so an unplaceable slot
 * becomes a gap a human fills with the Show picker. Inventing a show record to fill it
 * would push guesses into the shared shows dataset that every other version reads.
 *
 * Times are TEXT 'HH:00' and the end of day is '00:00' (not '24:00'), matching the
 * existing rows. `airing_id` is left to its sequence default.
 */
import { createRequire } from 'node:module';
import { resolve as rp } from 'node:path';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { Client } = require('pg');
const ctrl = require(rp('src/dms/packages/dms-server/src/routes/uda/uda.controller.js'));
const cfg = require(rp('src/dms/packages/dms-server/src/db/configs/wcdb-dama.config.json'));

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const vi = args.indexOf('--version');
const VERSION = vi >= 0 ? args[vi + 1] : 'Fall 2026';
const slotsFile = args.find((a) => !a.startsWith('--') && a !== VERSION);
if (!slotsFile) { console.error('usage: load-fall-2026-schedule.mjs <slots.json> [--dry-run] [--version NAME]'); process.exit(1); }

const SOURCE_ID = 10;
const hhmm = (h) => `${String(h % 24).padStart(2, '0')}:00`;

const c = new Client(cfg);
await c.connect();
const q = async (s, p = []) => (await c.query(s, p)).rows;

const slots = JSON.parse(readFileSync(slotsFile, 'utf8'));
const shows = await q(`select show_id, name, dj_id, department from gis_datasets.s9_v9_wcdb_shows`);
const djs = await q(`select dj_id, on_air_name, first_name, last_name, status from gis_datasets.s8_v8_wcdb_djs`);

// STRICT keeps the "DJ " prefix — it is the only thing separating dj 508 ("Alex",
// Alex Muro) from dj 1238 ("DJ Alex", Alex Collis), and both are current with a show.
// LOOSE drops it, for sheets that write the name either way.
const base = (s) => (s||'').toString().toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();
const strict = base;
const loose  = (s) => base(s).replace(/^dj\s+/,'');
const isEncore = (n) => /\b(encore|replay|re ?heat|rerun|repeat)\b/i.test(n||'');
const PLACEHOLDER = (n) => ['show name','alternative rock music'].includes(base(n));

const showsByDj = new Map();
for (const s of shows) if (s.dj_id != null) (showsByDj.get(s.dj_id) ?? showsByDj.set(s.dj_id,[]).get(s.dj_id)).push(s);
const realShows = (id) => (showsByDj.get(id) || []).filter(s => !PLACEHOLDER(s.name));

// Duplicate DJ records are endemic (3 "Alex", 3 "DJ Gabe", 3 "DJ Radio Rebel"). Rank:
// current-with-a-show beats current, beats has-a-show, beats the rest.
const rankDj = (d) => (d.status === 'current' ? 2 : 0) + (realShows(d.dj_id).length ? 1 : 0);
const findDjs = (label) => {
  const s = djs.filter(d => strict(d.on_air_name) === strict(label));
  const pool = s.length ? s : djs.filter(d =>
    loose(d.on_air_name) === loose(label) || loose(`${d.first_name||''} ${d.last_name||''}`) === loose(label));
  if (!pool.length) return [];
  const best = Math.max(...pool.map(rankDj));
  return pool.filter(d => rankDj(d) === best);
};

const exactShowClaims = new Set();
for (const sl of slots) for (const s of shows)
  if (base(s.name) === base(sl.label) && !PLACEHOLDER(s.name)) exactShowClaims.add(s.show_id);

const used = new Set(); const out = [];
for (const sl of slots.slice().sort((a,b) => a.day - b.day || a.start - b.start)) {
  let show = null, how = null, note = null, conf = null;

  // 1 — the label IS a show name, exactly.
  let cand = shows.filter(s => base(s.name) === base(sl.label) && !PLACEHOLDER(s.name));
  if (cand.length) {
    show = cand.filter(s => !isEncore(s.name)).sort((a,b)=>a.show_id-b.show_id)[0] || cand[0];
    how = 'show name'; conf = cand.length === 1 ? 'exact' : 'guess';
    if (cand.length > 1) note = `${cand.length} shows match: ` + cand.map(s=>`${s.show_id} "${s.name}"`).join(' / ');
  }

  // 2 — the label is a DJ. Deliberately BEFORE the prefix fallback below: a short
  // label prefix-matches far too much ("Alex" matches the show "Alex G's Show", which
  // belongs to someone else entirely), and a DJ hit is real evidence where a prefix is
  // just a coincidence of spelling.
  if (!show) {
    const hits = findDjs(sl.label);
    if (!hits.length) how = 'no DJ and no show by that name';
    else if (hits.length > 1) how = `${hits.length} equally-ranked DJs named "${sl.label}" (${hits.map(d=>d.dj_id).join(', ')})`;
    else {
      const dj = hits[0];
      const owned = realShows(dj.dj_id);
      const free = owned.filter(s => !exactShowClaims.has(s.show_id));
      const pool = free.length ? free : owned;
      if (!pool.length) how = `dj ${dj.dj_id} (${dj.on_air_name}) has no show record`;
      else {
        const fresh = pool.filter(s => !used.has(s.show_id));
        const pick = (fresh.length ? fresh : pool)
          .sort((a,b) => (isEncore(a.name)?1:0)-(isEncore(b.name)?1:0) || a.show_id-b.show_id)[0];
        show = pick; how = `dj ${dj.dj_id} → show`; conf = pool.length === 1 ? 'exact' : 'guess';
        if (pool.length > 1) note = `${pool.length} shows for this DJ: ` + pool.map(s=>`${s.show_id} "${s.name}"`).join(' / ');
      }
    }
  }
  // 3 — last resort: the label is the START of a show name ("Spunk & Gunk" →
  // "Spunk and Gunk at the movies"). Only reached when no DJ carries the name, and
  // only for labels long enough that a prefix means something.
  if (!show && base(sl.label).length >= 8) {
    const pre = shows.filter(s => !PLACEHOLDER(s.name) && base(s.name).startsWith(base(sl.label) + ' '));
    if (pre.length) {
      show = pre.sort((a,b)=>a.show_id-b.show_id)[0];
      how = 'show name (prefix)'; conf = 'guess';
      if (pre.length > 1) note = `${pre.length} shows start with this: ` + pre.map(s=>`${s.show_id} "${s.name}"`).join(' / ');
    }
  }

  if (show) used.add(show.show_id);
  out.push({ ...sl, show_id: show?.show_id ?? null, show_name: show?.name ?? null,
             department: show?.department ?? null, how, note, confidence: conf });
}

const place = out.filter((o) => o.show_id != null);
const skip = out.filter((o) => o.show_id == null);
const judged = place.filter((o) => o.confidence === 'guess');

console.log(`${out.length} slots · ${place.length} placeable (${judged.length} judged) · ${skip.length} left open`);
console.log(`${place.reduce((a, s) => a + s.hours, 0)} of ${out.reduce((a, s) => a + s.hours, 0)} hours\n`);

if (DRY) {
  for (const s of place) console.log(`  ${s.dayname} ${hhmm(s.start)}-${hhmm(s.end)}  ${s.show_id}  ${s.show_name}${s.confidence === 'guess' ? '   [judged]' : ''}`);
  console.log(`\nwould create version "${VERSION}" with ${place.length} airings`);
  await c.end();
  process.exit(0);
}

const view = await ctrl.createSourceView('wcdb-dama', { source_id: SOURCE_ID, version: VERSION, user_id: null });
console.log(`created view ${view.view_id} · ${view.table_name} · version "${view.version}"`);
try {
  for (const s of place) {
    await c.query(`INSERT INTO ${view.table_schema}.${view.table_name} (show_id, day, start, "end") VALUES ($1,$2,$3,$4)`,
      [s.show_id, s.day, hhmm(s.start), hhmm(s.end)]);
  }
  const r = (await q(`SELECT count(*)::int n, count(distinct show_id)::int shows FROM ${view.table_schema}.${view.table_name}`))[0];
  console.log(`inserted ${place.length} airings → ${r.n} rows, ${r.shows} distinct shows`);
  console.log('\nleft open for a human to fill with the Show picker:');
  for (const s of skip) console.log(`  ${s.dayname} ${hhmm(s.start)}-${hhmm(s.end)}  "${s.label}" — ${s.how}`);
} finally {
  await c.end();
}
