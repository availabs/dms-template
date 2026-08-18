#!/usr/bin/env node
/* Propagate the live rail from home.html to every other main page.
 *
 *   node scripts/sync-rail.mjs            (from dms_design_system/)
 *   node scripts/sync-rail.mjs --check    (write nothing; exit 1 if stale)
 *
 * The `header` LayoutGroup — the on-air show + the player — is a standing rail
 * that all nine main pages carry. Static HTML has no include mechanism, so
 * `home.html` is the canonical copy and the rest hold a generated duplicate.
 * This is the transform the README tells you to re-run: edit the rail in
 * home.html, run this, done. Never hand-edit a copy.
 *
 * Excluded: `login.html` (an auth surface is a single attentional task),
 * `airwaves.html` (its rail intentionally swaps the on-air panel for the
 * featured post — see EXCLUDED below), and everything under `pages/admin/`
 * (the rail is public-site chrome; an editing surface is a working context,
 * not a listening one). Every exclusion is deliberate — if a page here has no
 * rail, or a different one, that is why.
 *
 * The only difference between the canonical copy and a generated one is the
 * opening comment: home's describes the panel, a copy's says where to edit it.
 * `--check` is the CI-shaped guard — run it alongside verify-nav and
 * icons-audit if these ever gate a commit.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const P = join(ROOT, 'pages');
const CHECK = process.argv.includes('--check');

const OPEN = '          <!-- ============================================================\n               LAYOUTGROUP · header';
const CLOSE = '          <!-- ============================================================\n               LAYOUTGROUP · content';

const CANONICAL_HEAD = `               LAYOUTGROUP · header
               Left column — sticky cutaway panel. Wraps the now-playing
               card. The topnav floats over its top edge in a SOLID
               page-bg strip so the hero panel visually cuts up under
               it. Below md the panel reverts to flow position.`;

const GENERATED_HEAD = `               LAYOUTGROUP · header — THE LIVE RAIL
               The same sticky panel every main page carries, so "what is
               on air / what is playing" follows the reader around the site
               instead of living only on the home page.
               GENERATED from home.html, which is the canonical copy — edit
               it there and re-run scripts/sync-rail.mjs, never here.
               Below md the grid collapses and this scrolls above the feed.`;

function slice(src, file) {
  const a = src.indexOf(OPEN);
  const b = src.indexOf(CLOSE);
  if (a === -1 || b === -1) return null;
  if (b < a) { console.error(`  ${file}: groups out of order`); process.exit(2); }
  return { a, b, rail: src.slice(a, b) };
}

const home = readFileSync(join(P, 'home.html'), 'utf8');
const src = slice(home, 'home.html');
if (!src) { console.error('home.html: no rail found — is it still the canonical copy?'); process.exit(2); }
if (!src.rail.includes(CANONICAL_HEAD)) {
  console.error("home.html's rail comment no longer matches CANONICAL_HEAD in this script — update one to match the other.");
  process.exit(2);
}
const generated = src.rail.replace(CANONICAL_HEAD, GENERATED_HEAD);

// Pages that do NOT hold a generated copy of the rail.
//
//   home.html      — the canonical copy this script propagates FROM.
//   login.html     — an auth surface is a single attentional task.
//   airwaves.html  — its rail is DELIBERATELY different: the featured post
//                    takes the `card:on-air` slot (README, "Airwaves"). It
//                    keeps the LISTEN LIVE block, so the page still carries the
//                    stream — but syncing would overwrite the design decision
//                    with the show panel. If the shared half of the rail
//                    changes, update this page by hand and say so here.
//   post.html      — same, more so: on an article page the rail IS the
//                    article's photograph, with no text and no scrim.
const EXCLUDED = new Set(['home.html', 'login.html', 'airwaves.html', 'post.html']);

// Only the top level of pages/ — admin lives in a subfolder and is excluded.
const targets = readdirSync(P, { withFileTypes: true })
  .filter((d) => d.isFile() && d.name.endsWith('.html') && !EXCLUDED.has(d.name))
  .map((d) => d.name)
  .sort();

let changed = 0, missing = 0;
for (const f of targets) {
  const p = join(P, f);
  const s = readFileSync(p, 'utf8');
  const cur = slice(s, f);
  if (!cur) { console.log(`  MISSING  ${f} has no rail`); missing++; continue; }
  if (cur.rail === generated) { console.log(`  ok       ${f}`); continue; }
  changed++;
  if (CHECK) { console.log(`  STALE    ${f}`); continue; }
  writeFileSync(p, s.slice(0, cur.a) + generated + s.slice(cur.b));
  console.log(`  synced   ${f}`);
}

console.log('');
if (missing) console.log(`${missing} page(s) without a rail`);
if (CHECK && (changed || missing)) { console.log(`${changed} stale — run without --check to fix`); process.exit(1); }
console.log(changed ? `${changed} page(s) updated from home.html` : 'all pages already in sync');
