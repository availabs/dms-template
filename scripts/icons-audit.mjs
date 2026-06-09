#!/usr/bin/env node
/**
 * icons-audit.mjs — ensure every <svg> in a brand's design PAGES is a NAMED icon
 * that exists in the design-system registry (so the icon set actually covers the
 * design, and named icons are usable when authoring live DMS pages).
 *
 * Convention (the keystone): every <svg> in a page is immediately preceded by a
 * classifying HTML comment —
 *     <!-- icon: Name -->   the svg is the registry icon `Name` (must exist)
 *     <!-- decorative -->   intentionally inline art (chart / thumbnail / logo) —
 *                           NOT an icon; ignored by the audit.
 *
 * The audit reports, per page:
 *   • UNTAGGED svgs        → need an `icon:`/`decorative` classification
 *   • UNKNOWN icon names   → `<!-- icon: X -->` where X isn't in the registry
 *                            (capture it: add to theme/icons.js + the catalog)
 * Exit non-zero if any gap → gates CI / the design→theme workflow.
 *
 * Usage: node scripts/icons-audit.mjs [--brand transportny] [--pages glob,glob]
 * Companion: scripts/icons-sync.mjs. Skill: managing-design-system-icons.md.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const BRANDS = {
  transportny: {
    registry: "src/themes/transportny/TransportNY Design System/dms_design_system_v2/theme/icons.js",
    pagesDir: "src/themes/transportny/TransportNY Design System/dms_design_system_v2/pages",
    catalog:  "src/themes/transportny/TransportNY Design System/dms_design_system_v2/design-system/theme.html",
  },
};

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1]; };
const brand = flag("brand", "transportny");
const onlyPages = (flag("pages", "") || "").split(",").map(s => s.trim()).filter(Boolean);

const cfg = BRANDS[brand];
if (!cfg) { console.error(`unknown brand "${brand}"`); process.exit(2); }

// registry names = `const Name =` declarations in the source registry
const registrySrc = readFileSync(cfg.registry, "utf8");
const registry = new Set([...registrySrc.matchAll(/const\s+([A-Z][A-Za-z0-9_]*)\s*=/g)].map(m => m[1]));

// every <svg> is preceded (within ~140 chars) by an `icon:`/`decorative` tag
const classifyBefore = (html, svgIndex) => {
  const win = html.slice(Math.max(0, svgIndex - 160), svgIndex);
  const m = win.match(/<!--\s*icon:\s*([A-Za-z0-9_]+)\s*-->\s*$|<!--\s*(decorative)\s*-->\s*$/);
  if (!m) return { kind: "untagged" };
  return m[2] ? { kind: "decorative" } : { kind: "icon", name: m[1] };
};

let pages = readdirSync(cfg.pagesDir).filter(f => f.endsWith(".html"));
if (onlyPages.length) pages = pages.filter(f => onlyPages.some(p => f.includes(p)));

let totalGaps = 0; const usedNames = new Set(); let totalIcons = 0, totalDecor = 0, totalUntagged = 0;
for (const file of pages) {
  const html = readFileSync(join(cfg.pagesDir, file), "utf8");
  const untagged = []; const unknown = [];
  for (const m of html.matchAll(/<svg[\s>]/g)) {
    const c = classifyBefore(html, m.index);
    if (c.kind === "untagged") { untagged.push(m.index); totalUntagged++; }
    else if (c.kind === "decorative") totalDecor++;
    else { totalIcons++; usedNames.add(c.name); if (!registry.has(c.name)) unknown.push(c.name); }
  }
  if (untagged.length || unknown.length) {
    totalGaps += untagged.length + unknown.length;
    console.log(`\n${file}`);
    if (untagged.length) console.log(`  ✗ ${untagged.length} untagged <svg> — add <!-- icon: Name --> or <!-- decorative -->`);
    if (unknown.length) console.log(`  ✗ unknown icon names (not in registry): ${[...new Set(unknown)].join(", ")}`);
  }
}

console.log(`\n— ${brand}: ${pages.length} page(s) · ${totalIcons} icon refs (${usedNames.size} distinct) · ${totalDecor} decorative · ${totalUntagged} untagged · registry has ${registry.size} icons —`);
if (totalGaps) { console.error(`✗ ${totalGaps} gap(s). Capture missing icons into ${cfg.registry} + the catalog, or tag decorative art, then re-run.`); process.exit(1); }
console.log("✓ all page icons are named and present in the registry.");
