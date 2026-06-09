#!/usr/bin/env node
/**
 * icons-sync.mjs — sync a brand's icon registry from the DESIGN SYSTEM (source of
 * truth) to the LIVE THEME (generated).
 *
 *   design-system  theme/icons.js   (authored — add icons here)
 *        │  icons-sync
 *        ▼
 *   live theme      icons.jsx        (GENERATED — do not hand-edit)
 *
 * The two files are the same React module (name → SVG component map, default
 * export). Sync copies the source verbatim under a "generated" banner so the
 * runtime stays self-contained (the live theme never imports from the
 * design-system folder) while the design system remains the single source of
 * truth.
 *
 * Usage:
 *   node scripts/icons-sync.mjs [--brand transportny] [--check]
 *     --check   don't write; exit 1 if the live file is out of sync (for CI).
 *
 * Companion: scripts/icons-audit.mjs (ensures pages only use icons that exist
 * in the source registry). See skill: managing-design-system-icons.md.
 */
import { readFileSync, writeFileSync } from "node:fs";

// Brand registry: source (design system) → generated (live theme).
const BRANDS = {
  transportny: {
    source: "src/themes/transportny/TransportNY Design System/dms_design_system_v2/theme/icons.js",
    live:   "src/themes/transportny/icons.jsx",
  },
  // tessera / wcdb: add when those design systems formalize their icon sets.
};

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true); };
const brand = flag("brand", "transportny");
const check = Boolean(flag("check", false));

const cfg = BRANDS[brand];
if (!cfg) { console.error(`unknown brand "${brand}" — known: ${Object.keys(BRANDS).join(", ")}`); process.exit(2); }

const BANNER = `// ⚠️ GENERATED FILE — do not edit by hand.
// Source of truth: ${cfg.source}
// Regenerate: node scripts/icons-sync.mjs --brand ${brand}
// (CI: node scripts/icons-sync.mjs --brand ${brand} --check)
`;

const source = readFileSync(cfg.source, "utf8");
const generated = BANNER + "\n" + source;

if (check) {
  let current = "";
  try { current = readFileSync(cfg.live, "utf8"); } catch { /* missing → out of sync */ }
  if (current.trim() !== generated.trim()) {
    console.error(`✗ ${cfg.live} is OUT OF SYNC with ${cfg.source}. Run: node scripts/icons-sync.mjs --brand ${brand}`);
    process.exit(1);
  }
  console.log(`✓ ${brand}: live icon registry is in sync.`);
  process.exit(0);
}

writeFileSync(cfg.live, generated);
const count = (source.match(/const\s+[A-Z][A-Za-z0-9_]*\s*=/g) || []).length;
console.log(`✓ ${brand}: synced ${count} icons → ${cfg.live} (from ${cfg.source}).`);
