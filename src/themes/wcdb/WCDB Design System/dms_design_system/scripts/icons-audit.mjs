#!/usr/bin/env node
/* Audit the icon set across the deliverable.
 *
 *   node scripts/icons-audit.mjs        (from dms_design_system/)
 *
 * The convention (managing-design-system-icons.md): every <svg> in a design
 * page carries a classifying comment immediately before it —
 *
 *   <!-- icon: Name -->   this svg IS the registry icon `Name`
 *   <!-- decorative -->   intentional inline art (chart, logo, cutaway curve)
 *
 * No raw, unclassified <svg>. That is what makes the set auditable, and it is
 * what lets these mockups become live DMS pages: a Card column or menu entry
 * references an icon by *name*, and an unregistered name renders nothing.
 *
 * REGISTRY OF RECORD for this brand is the `#icons` catalogue grid on
 * design-system/theme.html — each tile is itself tagged `<!-- icon: Name -->`
 * with a label beneath. There is no separate theme/icons.js here yet;
 * generating the live theme registry (icons.jsx) from this catalogue is the
 * theme-side follow-up task, and this audit is what keeps the catalogue honest
 * in the meantime.
 *
 * Checks
 *   1. every <svg> is tagged (icon: or decorative)
 *   2. every `icon: Name` used exists in the catalogue
 *   3. every catalogue name is a distinct glyph (no two tiles, same geometry)
 *   4. reports catalogue entries no page uses (informational, not a failure)
 *   5. every use of a name has the SAME geometry as its catalogue tile —
 *      a registry has one Play, not three near-duplicates
 *
 * Exits non-zero on 1, 2, 3 or 5.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = join(ROOT, 'design-system/theme.html');

const geom = (svg) =>
  (svg.match(/<(?:path|circle|rect|line|polyline|polygon)[^>]*>/g) || [])
    .map((t) => (t.match(/(?:\sd|points|cx|cy|r|x|y|rx|width|height|x1|y1|x2|y2)="[^"]*"/g) || []).join(' '))
    .join(' | ').replace(/\s+/g, ' ').trim();

function htmlFiles(dir, acc = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (n !== 'scripts' && !n.startsWith('.')) htmlFiles(p, acc); }
    else if (n.endsWith('.html')) acc.push(p);
  }
  return acc;
}

/* ── the registry: catalogue tiles on theme.html ─────────────────────── */
const catSrc = readFileSync(CATALOG, 'utf8');
const registry = new Map();       // name -> geometry
// The svg group must not span past its own closing tag, or a tag on one page
// element can pair up with a catalogue label hundreds of lines below it.
const tileRe = /<!--\s*icon:\s*([A-Za-z][A-Za-z0-9]*)\s*-->\s*(<svg(?:(?!<svg)[\s\S])*?<\/svg>)\s*<div class="font-\[family-name:var\(--font-mono\)\][^>]*>([A-Za-z][A-Za-z0-9]*)<\/div>/g;
let t;
while ((t = tileRe.exec(catSrc)) !== null) {
  if (t[1] !== t[3]) console.log(`  WARN  catalogue tile tagged ${t[1]} but labelled ${t[3]}`);
  registry.set(t[1], geom(t[2]));
}

let failures = 0;
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`); };

console.log(`registry: ${registry.size} icons (design-system/theme.html #icons)\n`);

/* 3 — no two names sharing one glyph */
const byGeom = new Map();
for (const [name, g] of registry) {
  if (byGeom.has(g)) fail(`catalogue has two names for one glyph: ${byGeom.get(g)} / ${name}`);
  else byGeom.set(g, name);
}

/* 1, 2, 5 — every svg on every page */
const used = new Map();
let svgs = 0, decorative = 0;
for (const file of htmlFiles(ROOT).sort()) {
  const src = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file);
  const re = /<svg[\s\S]*?<\/svg>/g;
  let m;
  const problems = [];
  while ((m = re.exec(src)) !== null) {
    svgs++;
    const pre = src.slice(Math.max(0, m.index - 260), m.index);
    const tag = pre.match(/<!--\s*(?:icon:\s*([A-Za-z][A-Za-z0-9]*)|(decorative))\s*-->\s*$/);
    const line = src.slice(0, m.index).split('\n').length;
    if (!tag) { problems.push(`untagged <svg> at ${rel}:${line}`); continue; }
    if (tag[2]) { decorative++; continue; }
    const name = tag[1];
    used.set(name, (used.get(name) || 0) + 1);
    if (!registry.has(name)) problems.push(`unknown icon "${name}" at ${rel}:${line} (not in the catalogue)`);
    else if (geom(m[0]) !== registry.get(name))
      problems.push(`"${name}" at ${rel}:${line} has different geometry from its catalogue tile`);
  }
  if (problems.length) { console.log(rel); problems.forEach(fail); }
}

/* 4 — catalogue entries nothing uses */
const unused = [...registry.keys()].filter((n) => !used.has(n));

console.log(`svgs: ${svgs} · named: ${svgs - decorative} · decorative: ${decorative} · distinct names used: ${used.size}`);
if (unused.length) console.log(`\nunused catalogue entries (informational): ${unused.join(', ')}`);
console.log(failures ? `\n${failures} failure(s)` : '\nall checks passed');
process.exit(failures ? 1 : 0);
