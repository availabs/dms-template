#!/usr/bin/env node
/* Verify the shared nav widget across the whole deliverable.
 *
 *   node scripts/verify-nav.mjs        (from dms_design_system/)
 *
 * The design-system skill (§7.0.2) says to verify the widget rather than
 * eyeball it, because two failure modes actually happen and neither is visible
 * on the page you're looking at:
 *
 *   1. a page missing from ds-nav.js's SECTIONS table, and
 *   2. a wrong relative depth, so links break from a nested folder.
 *
 * So: run every page's path through the real ds-nav.js under a stubbed
 * location/document, then assert
 *   (a) every emitted href resolves to a file that exists on disk,
 *   (b) exactly one link is marked active and it is the current page,
 *   (c) every .html page in the deliverable appears in SECTIONS, and
 *   (d) every page carries the <script src=".../ds-nav.js"> tag and no page
 *       carries inline widget markup.
 *
 * Exits non-zero on any failure so it can gate a commit.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NAV = join(ROOT, 'ds-nav.js');
const navSrc = readFileSync(NAV, 'utf8');

/* ── run ds-nav.js for one page path, return its rendered links ───────── */
function renderFor(pagePath) {
  const links = [];
  let panelHTML = '';

  const el = () => ({
    style: { cssText: '', opacity: '0' },
    set innerHTML(v) { panelHTML += v; },
    get innerHTML() { return panelHTML; },
    querySelector: () => ({ style: {}, setAttribute() {}, addEventListener() {} }),
    setAttribute() {}, addEventListener() {}, contains: () => false,
  });

  const sandbox = {
    location: { pathname: '/' + relative(ROOT, pagePath).split(/[\\/]/).join('/') },
    document: {
      body: { appendChild() {} },
      createElement: el,
      addEventListener() {},
    },
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(navSrc, sandbox, { filename: 'ds-nav.js' });

  const re = /<a href="([^"]+)"([^>]*)>/g;
  let m;
  while ((m = re.exec(panelHTML)) !== null) {
    links.push({ href: m[1], active: m[2].includes('aria-current="page"') });
  }
  return links;
}

/* ── the pages the deliverable actually has ──────────────────────────── */
function htmlFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'scripts' || name.startsWith('.')) continue;
      htmlFiles(p, acc);
    } else if (name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

const pages = htmlFiles(ROOT).sort();
let failures = 0;
const fail = (msg) => { failures++; console.log(`  FAIL  ${msg}`); };

console.log(`ds-nav.js · ${pages.length} pages\n`);

for (const page of pages) {
  const rel = relative(ROOT, page);
  const links = renderFor(page);
  const problems = [];

  // (a) every href resolves
  for (const { href } of links) {
    const target = resolve(dirname(page), href);
    if (!existsSync(target)) problems.push(`dead href ${href} -> ${relative(ROOT, target)}`);
  }

  // (b) exactly one active link, and it is this page
  const active = links.filter((l) => l.active);
  if (active.length !== 1) problems.push(`${active.length} active links (want 1)`);
  else {
    const target = resolve(dirname(page), active[0].href);
    if (target !== page) problems.push(`active link points at ${relative(ROOT, target)}`);
  }

  // (d) the page includes the shared widget, and carries no inline nav markup
  const src = readFileSync(page, 'utf8');
  const tags = src.match(/<script src="(\.\.\/)+ds-nav\.js"><\/script>/g) || [];
  if (tags.length !== 1) problems.push(`${tags.length} ds-nav.js script tags (want 1)`);
  else {
    const depth = rel.split(/[\\/]/).length - 1;
    const want = `<script src="${'../'.repeat(depth)}ds-nav.js"></script>`;
    if (tags[0] !== want) problems.push(`script tag depth is ${tags[0]}, want ${want}`);
  }
  if (src.includes('wcdb-meta-nav')) problems.push('inline .wcdb-meta-nav markup still present');
  if (/id="dsWidget"/.test(src)) problems.push('inline widget markup present (must live in ds-nav.js only)');

  if (problems.length) { console.log(`${rel}`); problems.forEach(fail); }
  else console.log(`  ok    ${rel.padEnd(30)} ${links.length} links`);
}

// (c) no page is missing from the SECTIONS table — an unlisted page renders the
//     design-system section with nothing active, which (b) already catches, but
//     say so explicitly since it is the most common drift.
console.log('');
for (const page of pages) {
  const links = renderFor(page);
  if (!links.some((l) => l.active)) fail(`${relative(ROOT, page)} is not listed in ds-nav.js SECTIONS`);
}

console.log(failures ? `\n${failures} failure(s)` : '\nall checks passed');
process.exit(failures ? 1 : 0);
