// TransportNY docs lint — run from anywhere:  node _lint.mjs            (all pages)
//                                             node _lint.mjs a.html b.html
// Checks (per platform-documentation-build.md acceptance checklist):
//   tree ↔ files · header block (data-doc-type, .doc-title, .stamps with type/applies to/last reviewed) · every h2/h3 has an id
//   · internal links resolve (same folder, ../ mockups, ../../assets) · forbidden strings · [VERIFY] marks · word count
//   · figures are capture specs or real <img> with alt · no design-system kickers ("// 01") inside <main>
// Exit code 1 on any failure. Warnings (planned pages missing, [VERIFY] present) do not fail unless --strict.
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
await import(pathToFileURL(join(here, "_docs-nav.js")).href);
const TREE = globalThis.DOCS_TREE, FLAT = globalThis.docsFlat();
const args = process.argv.slice(2), strict = args.includes("--strict");
const files = args.filter(a => a.endsWith(".html")).map(a => a.replace(/^.*\//, ""));
const allHtml = readdirSync(here).filter(f => f.endsWith(".html") && !f.startsWith("_"));
const targets = files.length ? files : allHtml;
// pages still on a pre-shell layout (moved mockups awaiting re-shell in their phase) — listed one per line in _exempt.txt;
// their shell failures are reported as warnings so Phase 0 can pass while the content is still valid.
const exempt = new Set(existsSync(join(here, "_exempt.txt")) ? readFileSync(join(here, "_exempt.txt"), "utf8").split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith("#")) : []);
const FORBID = [
  [/\/docs\/edit\//, "editor-mode URL"], [/npmrds\.transportny\.org\/docs/, "legacy docs host link"],
  [/Coming Soon/i, '"Coming Soon"'], [/\(Draft\)/, '"(Draft)"'], [/\bv2 series\b/i, 'internal name "v2 series"'],
  [/methodology v2/i, 'internal name "methodology v2"'], [/ClickHouse/, 'internal name "ClickHouse"'],
  [/\bview \d{3,4}\b/, "internal view id"], [/\bthe Atlas\b/, 'say "the Freight Atlas"'],
  [/Learn more/i, 'link text "Learn more"'], [/click here/i, 'link text "click here"'],
];
let fail = 0, warn = 0;
const F = (f, m) => { console.log(`FAIL ${f}: ${m}`); fail++; };
const W = (f, m) => { console.log(`warn ${f}: ${m}`); if (strict) fail++; else warn++; };
// tree ↔ files
const treeFiles = new Set(FLAT.map(p => p.f));
for (const p of FLAT) if (!existsSync(join(here, p.f))) { if (p.status !== "planned") F(p.f, `in tree as '${p.status}' but file missing`); else W(p.f, "planned, not written yet"); }
for (const f of allHtml) if (!treeFiles.has(f)) F(f, "file not in DOCS_TREE (_docs-nav.js)");
// per page
for (const f of targets) {
  const path = join(here, f); if (!existsSync(path)) continue;
  const src = readFileSync(path, "utf8");
  const entry = FLAT.find(p => p.f === f);
  if (entry && entry.status === "planned") W(f, "file exists but tree status is 'planned' — set status:'written'");
  const main = (src.match(/<main[\s\S]*?<\/main>/) || [""])[0];
  if (!main) { (exempt.has(f) ? W : F)(f, "no <main> — not on the docs shell" + (exempt.has(f) ? " (exempt: re-shell pending)" : "")); if (!exempt.has(f)) continue; }
  if (exempt.has(f)) { W(f, "exempt from shell checks until re-shelled"); console.log(`ok   ${f}  (exempt)`); continue; }
  if (!/<main[^>]*data-doc-type="([a-z-]+)"/.test(main)) F(f, "main lacks data-doc-type");
  if (!/class="doc-title"/.test(main)) F(f, "no .doc-title");
  if (!/class="stamps"/.test(main)) F(f, "no .stamps block");
  else { for (const k of ["applies to", "last reviewed"]) if (!main.includes(k)) F(f, `stamps missing "${k}"`); if (!/<span class="type">/.test(main)) F(f, "stamps missing type"); }
  if (!/id="docsCrumbs"/.test(main)) F(f, "no breadcrumb slot");
  if (!/id="docsPrevNext"/.test(src)) F(f, "no prev/next slot");
  if (!/<script src="_docs-nav\.js">/.test(src)) F(f, "does not include _docs-nav.js");
  // headings need ids
  for (const m of main.matchAll(/<h([23])([^>]*)>/g)) if (!/\sid="/.test(m[2])) F(f, `<h${m[1]}> without id: ${m[0].slice(0, 60)}`);
  // links
  for (const m of src.matchAll(/(?:href|src)="([^"#]+)(#[^"]*)?"/g)) {
    const u = m[1];
    if (/^(https?:|mailto:|data:|javascript:)/.test(u)) continue;
    const abs = resolve(here, u);
    if (!existsSync(abs)) {
      const inTree = treeFiles.has(u);
      if (inTree) W(f, `link to planned page ${u}`); else F(f, `broken link ${u}`);
    }
  }
  // forbidden strings in main
  for (const [re, why] of FORBID) if (re.test(main)) F(f, `forbidden: ${why}`);
  if (/\/\/\s?0\d\b|<span class="kicker">/.test(main)) F(f, 'design-system "// 01" kicker inside docs content');
  // verify marks
  const v = (main.match(/\[VERIFY/g) || []).length; if (v) W(f, `${v} [VERIFY] mark(s)`);
  // figures
  for (const m of main.matchAll(/<figure[^>]*>([\s\S]*?)<\/figure>/g)) {
    const fig = m[0];
    if (/<img/.test(fig)) { if (!/alt="[^"]+"/.test(fig)) F(f, "figure <img> without alt"); }
    else if (!/data-capture="/.test(fig)) F(f, "figure is neither a real <img> nor a capture spec");
    if (!/<figcaption>/.test(fig)) F(f, "figure without figcaption");
  }
  // words
  const words = main.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  if (words < 120 && !/data-doc-type="(hub|log)"/.test(main)) W(f, `only ${words} words`);
  console.log(`ok   ${f}  ${words} words${v ? `  [VERIFY]×${v}` : ""}`);
}
console.log(`\n${targets.length} page(s) checked · ${fail} failure(s) · ${warn} warning(s)`);
process.exit(fail ? 1 : 0);
