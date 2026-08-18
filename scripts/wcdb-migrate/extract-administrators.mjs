#!/usr/bin/env node
/* Build `administrators.csv` — the station's executive board.
 *
 *   node scripts/wcdb-migrate/extract-administrators.mjs
 *
 * ── WHY THIS READS THE DESIGN, NOT THE LEGACY DATASET ────────────────────
 * The board lives today in the legacy DMS source `eBoard` (1508197 / view
 * 1508198), and that source is **unreadable through every supported path**:
 *
 *   dms dataset query 1508197 → "Source row has no instance in its type: null"
 *   dms raw get 1508197       → row comes back empty (it is :data-backed)
 *   dms raw list wcdb 'eboard|1508198:data' → 0 items (type never matches)
 *   falcor uda[wcdb+eboard].viewsById[1508198].options[{}].length → 0
 *
 * Only FOUR rows survive anywhere reachable — cached inside station-info's
 * section (1703103) `element-data`. They confirm the legacy column shape
 * (`e_board_id · dj_id · department · position · office_hours ·
 * email_address`) and nothing more.
 *
 * The design page is the better source anyway, and is itself a transcription:
 * `station-info.html` was captured from the legacy site's ContactInfo.aspx on
 * 2026-08-11 and carries the whole board for the current term — six
 * departments, twenty-five roles — which the design README documents. So this
 * script parses the mockup, which means the dataset and the page it feeds can
 * never disagree at birth.
 *
 * Two transcription rules from that README are enforced here:
 *   • a role with nobody in it reads "Not listed", NEVER "Vacant" — News,
 *     Sports and Co-Engineer publish working addresses, so "vacant" would
 *     assert something the source does not say;
 *   • the email is a ROLE address, and the live page must keep an obfuscation
 *     strategy — this file stores it plainly, the RENDERER decides.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, 'out');
const PAGE = resolve(HERE, '../../src/themes/wcdb/WCDB Design System/dms_design_system/pages/station-info.html');

// The term the board is elected for. It is on the page as a single line above
// the board, which is exactly why it is stored PER ROW: a new term should be a
// new set of rows, not an edit that erases who held a role last year.
const TERM_START = '2026-05-01';
const TERM_END = '2027-05-01';

// Department order is meaningful — the design leads with Chief Administrators
// and nothing in the legacy data carries a sort.
const DEPT_ORDER = [
  'Chief Administrators',
  'Music Department',
  'Publicity Department',
  'News & Sports Department',
  'Engineering Department',
  'DJ Training Department',
];

const html = readFileSync(PAGE, 'utf8');
let seg = html.slice(html.indexOf('card:executive-board'));
seg = seg.slice(0, seg.indexOf('card:footer'));
seg = seg.replace(/<svg[\s\S]*?<\/svg>/g, '');

const rows = [];
const groups = seg.split(/<h3[^>]*>([^<]+)<\/h3>/);
for (let i = 1; i < groups.length; i += 2) {
  const department = groups[i].replace(/&amp;/g, '&').trim();
  const body = groups[i + 1];
  // Split on each role's opening position div, then read the text divs that
  // follow. Roles carry 3 OR 4 of them: `Co-Engineer` has no office-hours div
  // at all, which is why a fixed four-div pattern silently drops it.
  const blocks = body.split(/(?=<div[^>]*>\s*<div[^>]*>\s*[A-Z][^<>]{1,40}\s*<\/div>)/);
  for (const b of blocks) {
    if (!/<div[^>]*>\s*[A-Z][^<>]{1,40}?\s*<\/div>/.test(b)) continue;
    const texts = [...b.matchAll(/<div[^>]*>\s*([^<>]{2,80}?)\s*<\/div>/g)]
      .map((m) => m[1].replace(/&amp;/g, '&').replace(/&middot;/g, '·').trim())
      .filter(Boolean);
    if (texts.length < 3) continue;
    const [position, holder, email, hours] = texts;
    // Only the Music Department's roles carry a department glyph; a bare
    // `icon:` search would pick up the NEXT group's first icon.
    const iconMatch = department === 'Music Department' ? b.match(/<!--\s*icon:\s*([A-Za-z]+)\s*-->/) : null;
    rows.push({
      department,
      department_index: DEPT_ORDER.indexOf(department),
      position,
      holder_name: holder,
      email: /^no address/i.test(email) ? '' : email,
      office_hours: hours && !/^no address/i.test(hours) ? hours : '',
      icon: iconMatch ? iconMatch[1] : '',
    });
  }
}

// De-dupe on (department, position) — the split can emit a trailing partial.
const seen = new Set();
const board = rows.filter((r) => {
  const k = `${r.department}|${r.position}`;
  if (seen.has(k) || r.department_index < 0) return false;
  seen.add(k);
  return true;
});

board.sort((a, b) => a.department_index - b.department_index);
let sort = 0;
for (const r of board) {
  r.admin_id = ++sort;          // generated: the legacy `e_board_id` is unreachable
  r.sort = sort;
  r.term_start = TERM_START;
  r.term_end = TERM_END;
  r.dj_id = '';                 // resolved in a second pass — see below
  // "Not listed" is the design's wording for an unheld role and is stored as
  // written, so the page prints the source's own words rather than a guess.
}

/* ── resolve dj_id where the holder is unambiguously one DJ ────────────────
 * The board's holders are real DJs, and the join is what lets the public page
 * link a role to its profile. Matching is deliberately CONSERVATIVE: exact,
 * case-insensitive, against `on_air_name` first and then the real name, and
 * only when the roster returns exactly one row. A role held by two people
 * ("Eddie Smith, Kenny Kowalski") or by nobody keeps a null dj_id and its
 * holder_name is what renders.
 */
const API_HOST = process.env.API_HOST || 'http://localhost:3001';
const PG_ENV = process.env.PG_ENV || 'wcdb-dama';

async function loadRoster() {
  const paths = JSON.stringify([
    ['uda', PG_ENV, 'viewsById', ['8'], 'options', [JSON.stringify({ filter: {}, orderBy: {}, groupBy: [], exclude: {}, meta: {}, fn: {} })],
      'dataByIndex', { from: 0, to: 999 }, ['dj_id', 'on_air_name', 'first_name', 'last_name']],
  ]);
  const res = await fetch(`${API_HOST}/graph?${new URLSearchParams({ paths, method: 'get' })}`,
    { headers: process.env.DMS_AUTH_TOKEN ? { Authorization: process.env.DMS_AUTH_TOKEN } : {} });
  const json = await res.json();
  const opts = json?.jsonGraph?.uda?.[PG_ENV]?.viewsById?.['8']?.options || {};
  const byIndex = Object.values(opts)[0]?.dataByIndex || {};
  return Object.values(byIndex)
    .map((r) => ({
      dj_id: r?.dj_id?.value ?? r?.dj_id,
      on_air: (r?.on_air_name?.value ?? r?.on_air_name ?? '').toString().trim(),
      real: `${r?.first_name?.value ?? r?.first_name ?? ''} ${r?.last_name?.value ?? r?.last_name ?? ''}`.trim(),
    }))
    .filter((r) => r.dj_id != null);
}

let matched = 0;
try {
  const roster = await loadRoster();
  if (roster.length) {
    const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    for (const r of board) {
      if (!r.holder_name || /not listed/i.test(r.holder_name) || r.holder_name.includes(',')) continue;
      const want = norm(r.holder_name);
      const hits = roster.filter((d) => norm(d.on_air) === want || norm(d.real) === want);
      if (hits.length === 1) { r.dj_id = hits[0].dj_id; matched++; }
    }
    console.log(`roster: ${roster.length} DJs · dj_id resolved on ${matched}/${board.length} roles`);
  } else {
    console.log('roster: unreachable — every dj_id left null (the page renders holder_name)');
  }
} catch (e) {
  console.log(`roster lookup skipped (${e.message}) — every dj_id left null`);
}

/* ── write ─────────────────────────────────────────────────────────────── */
const COLUMNS = ['admin_id', 'department', 'department_index', 'position', 'holder_name',
  'dj_id', 'email', 'office_hours', 'icon', 'sort', 'term_start', 'term_end'];
const esc = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

mkdirSync(OUT, { recursive: true });
writeFileSync(resolve(OUT, 'administrators.csv'),
  [COLUMNS.join(','), ...board.map((r) => COLUMNS.map((c) => esc(r[c])).join(','))].join('\n') + '\n');

const byDept = board.reduce((a, r) => ({ ...a, [r.department]: (a[r.department] || 0) + 1 }), {});
console.log(`administrators.csv · ${board.length} roles`);
for (const [d, n] of Object.entries(byDept)) console.log(`  ${String(n).padStart(2)}  ${d}`);
const unheld = board.filter((r) => /not listed/i.test(r.holder_name)).map((r) => r.position);
console.log(`unheld roles (kept, "Not listed"): ${unheld.join(', ') || 'none'}`);
if (board.length !== 25) console.log(`\n  ⚠  the design states 25 roles — parsed ${board.length}. Check the mockup before publishing.`);
