#!/usr/bin/env node
/* Generate the live theme icon registry from the design-system catalogue.
 *
 *   node scripts/icons-sync.mjs            (from dms_design_system/)
 *   node scripts/icons-sync.mjs --check    (writes nothing; exits 1 if stale)
 *
 * REGISTRY OF RECORD for WCDB is the `#icons` catalogue grid on
 * design-system/theme.html — the same source `icons-audit.mjs` checks every
 * page svg against. Other brands keep a hand-written `theme/icons.js` and
 * generate from that (managing-design-system-icons.md); WCDB deliberately does
 * not, because a second source would be a second thing to drift. The catalogue
 * is already audited for completeness (every named page svg has a tile) and for
 * geometry (a use and its tile must draw the same glyph), which is exactly the
 * guarantee a generated registry needs.
 *
 * So: edit the catalogue tile, re-run this, and the live theme follows.
 * `src/themes/wcdb/icons.jsx` is GENERATED — never hand-edit it.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = join(ROOT, 'design-system/theme.html');
// dms_design_system/ → WCDB Design System/ → wcdb/
const LIVE = resolve(ROOT, '../../icons.jsx');
const CHECK = process.argv.includes('--check');

/* ── read the catalogue ───────────────────────────────────────────────── */
// Same tile shape icons-audit.mjs matches: the `icon:` comment, the svg (which
// must not span past its own closing tag), then the mono label div.
const tileRe =
  /<!--\s*icon:\s*([A-Za-z][A-Za-z0-9]*)\s*-->\s*(<svg(?:(?!<svg)[\s\S])*?<\/svg>)\s*<div class="font-\[family-name:var\(--font-mono\)\][^>]*>([A-Za-z][A-Za-z0-9]*)<\/div>/g;

const src = readFileSync(CATALOG, 'utf8');
const icons = [];
let t;
while ((t = tileRe.exec(src)) !== null) {
  if (t[1] !== t[3]) {
    console.error(`  FAIL  catalogue tile tagged ${t[1]} but labelled ${t[3]}`);
    process.exit(1);
  }
  icons.push({ name: t[1], svg: t[2] });
}
if (!icons.length) {
  console.error('  FAIL  no catalogue tiles found — has theme.html #icons changed shape?');
  process.exit(1);
}

/* ── svg → JSX ────────────────────────────────────────────────────────── */
// The wrapper below owns viewBox / fill / stroke / stroke-width / caps, so the
// inner elements should carry geometry only. Anything else on an inner element
// is a real difference the registry has to preserve, so it is carried through
// (camelCased for React) rather than dropped.
const CAMEL = {
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-dasharray': 'strokeDasharray',
  'stroke-opacity': 'strokeOpacity',
  'fill-opacity': 'fillOpacity',
  'fill-rule': 'fillRule',
  'clip-rule': 'clipRule',
};

const attrs = (raw) =>
  (raw.match(/([a-zA-Z-]+)="([^"]*)"/g) || [])
    .map((a) => {
      const [, k, v] = a.match(/([a-zA-Z-]+)="([^"]*)"/);
      if (k === 'class') return null; // catalogue tiles carry a colour class; the live icon inherits currentColor
      return ` ${CAMEL[k] || k}="${v}"`;
    })
    .filter(Boolean)
    .join('');

function toJsx(svg) {
  const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();
  const els = inner.match(/<(?:path|circle|rect|line|polyline|polygon|ellipse|g)\b[^>]*\/?>/g) || [];
  const unknown = inner.replace(/<(?:path|circle|rect|line|polyline|polygon|ellipse|g)\b[^>]*\/?>/g, '').trim();
  if (unknown) return { error: `unhandled markup: ${unknown.slice(0, 80)}` };
  const jsx = els.map((el) => {
    const tag = el.match(/^<([a-z]+)/)[1];
    return `<${tag}${attrs(el)}/>`;
  });
  if (!jsx.length) return { error: 'no drawable elements' };
  return { jsx: jsx.length === 1 ? jsx[0] : `<>${jsx.join('')}</>` };
}

const rendered = icons.map(({ name, svg }) => {
  const { jsx, error } = toJsx(svg);
  if (error) {
    console.error(`  FAIL  ${name}: ${error}`);
    process.exit(1);
  }
  return { name, jsx };
});

/* ── emit ─────────────────────────────────────────────────────────────── */
const pad = Math.max(...rendered.map((r) => r.name.length));
const decls = rendered
  .map((r) => `const ${r.name.padEnd(pad)} = svg(${r.jsx});`)
  .join('\n');
const exports_ = rendered.map((r) => r.name).join(', ');

const out = `// ⚠️ GENERATED FILE — do not edit by hand.
// Source of truth: the #icons catalogue on
//   src/themes/wcdb/WCDB Design System/dms_design_system/design-system/theme.html
// Regenerate: node scripts/icons-sync.mjs        (from dms_design_system/)
// CI guard:   node scripts/icons-sync.mjs --check
//
// WCDB · icon registry (${rendered.length} icons)
//
// Wired as \`theme.Icons\`, which is what the \`Icon\` component, the lexical
// \`icon\` node, SideNav glyphs and Card icon-chips all look names up in.
// A name that is not here renders NOTHING — no error, no fallback art in a
// themed context. \`icons-audit.mjs\` is what keeps the catalogue complete, and
// this file a faithful copy of it.
//
// Geometric, stroke-1.6, lucide-aligned, all on a 24×24 grid — the brand's
// icon brief (design-system/theme.html §03).

import React from "react";

const svg = (paths) => (props) =>
  React.createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.6,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      ...props,
    },
    paths
  );

${decls}

const icons = {
  ${exports_},
};

export default icons;
`;

if (CHECK) {
  let live = '';
  try {
    live = readFileSync(LIVE, 'utf8');
  } catch {
    console.log('  FAIL  src/themes/wcdb/icons.jsx does not exist — run icons-sync.mjs');
    process.exit(1);
  }
  if (live !== out) {
    console.log('  FAIL  src/themes/wcdb/icons.jsx is out of sync with the catalogue');
    process.exit(1);
  }
  console.log(`in sync · ${rendered.length} icons`);
  process.exit(0);
}

writeFileSync(LIVE, out);
console.log(`wrote src/themes/wcdb/icons.jsx · ${rendered.length} icons`);
console.log(rendered.map((r) => r.name).join(' '));
