#!/usr/bin/env node
// build_npmrds_macro.mjs — the below-fold content of npmrds_sub / `macro` (page 2101931).
//
//   § 01 Measure reference  — the 8-measure table, rendered from measures.js
//   footer                  — the nav strip + copyright line
//
// ⛔ RETIRED 2026-08-17 — DO NOT RUN. Alex: *"this page should remove everything below the
// map. Its intended to be a full page map page, the stuff below it was just for design
// notes."* The three sections this builder owned (`npmrds-macro-01-head`, `-01-table`,
// `-footer`) were deleted from the draft that day; page 2101931's draft is now the Map
// section alone, in the single `Map workbench` band.
//
// This CORRECTS the classification in npmrds-category-design-set.md and the mockup's header
// comment, which called the below-fold § 01 measure reference "real page content". It is
// not — like § 02/§ 03 it is design documentation of the panels. The measure vocabulary it
// rendered is not lost: it lives in `measures.js` and renders in the right-hand context
// panel, which is where a viewer actually needs it.
//
// The file is kept, not deleted, because its § 01 table is content-as-code worth having if
// the reference is ever wanted on a sibling page — but it exits immediately so a stray
// re-run cannot resurrect the bands. Pass `--force` only if you mean it. Deleted rows are
// backed up at scratchpad/npmrdsv5-dev2/backups/macro_fullpage_2026-08-17/.
if (!process.argv.includes("--force")) {
  console.error("build_npmrds_macro.mjs is RETIRED — page `macro` is a full-page map (Alex, 2026-08-17).\n" +
    "Running it would re-add the measure-reference + footer bands below the map.\n" +
    "Pass --force if that is genuinely what you want.");
  process.exit(1);
}
//
// Design: TransportNY Design System/dms_design_system_v2/pages/npmrds-macro.html
// Task:   planning/transportny/tasks/current/npmrds-macro-view-alignment.md (P7)
//
// ⚠ THIS BUILDER IS ADDITIVE, NOT WHOLE-PAGE — a deliberate deviation from the folder's
// "wipe by page id" convention, logged in the task file. Page 2101931 is LIVE and its one
// existing draft section is the **Map section** whose `element-data` is a 23KB symbology
// snapshot (5 layers + the macroview pluginData). A whole-page wipe would delete and
// recreate that row from a literal this script would have to carry — the exact drift trap
// README.md warns about, with the map itself as the casualty. So:
//   · the builder OWNS only the sections it stamps with a `npmrds-macro-*` trackingId,
//   · it deletes exactly those and recreates them (idempotent re-run, loud failures),
//   · it REFUSES to run if the draft holds anything else it does not recognise,
//   · it never touches the Map section except for one targeted `height` patch, and
//   · it never touches `sections` / `section_groups` (published) — draft only.
// `const SECTIONS` is still named so `fidelity_static.mjs` can parse it; note that tool
// compares against ALL live sections, so it will report the Map section as an extra.
//
// SIDENAV: the design's compact 64px rail is a PAGE-LEVEL theme value
// (`data.theme.layout.options.sideNav.activeStyle: "1"`, exactly what sibling page 2101777
// already uses). Page `theme` is NOT draft/published-split, so writing it changes the
// PUBLISHED page immediately — this script therefore leaves it alone unless you pass
// --sidenav-compact, and the task file hands the one-line patch to the owner.
//
// USAGE (from the dms-template root):
//   export DMS_AUTH_TOKEN=$(node src/dms/packages/dms/cli/bin/mint-token.mjs \
//     --host https://dmsserver.availabs.org --project npmrdsv5 \
//     --email availabs@gmail.com --password test123)
//   DMS_HOST=https://dmsserver.availabs.org \
//     node src/themes/transportny/qa_skills/tools/builds/build_npmrds_macro.mjs
//   # add --sidenav-compact to also flip the page to the 64px rail (publishes immediately)
// Draft-only: this never calls `page publish`.

import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MEASURE_ORDER, MEASURES, NOT_COMPUTED_LABEL } from "../../../components/macroview/measures.js";

const PATTERN = "npmrds_sub", PAGE_ID = "2101931", SLUG = "macro";
const TRACK_PREFIX = "npmrds-macro-";
const SIDENAV_COMPACT = process.argv.includes("--sidenav-compact");
const ENV = {
  ...process.env,
  DMS_HOST: process.env.DMS_HOST || "https://dmsserver.availabs.org",
  DMS_APP: process.env.DMS_APP || "npmrdsv5",
  DMS_TYPE: process.env.DMS_TYPE || "dev2",
};
if (!process.env.DMS_AUTH_TOKEN) { console.error("set DMS_AUTH_TOKEN (mint via src/dms/packages/dms/cli/bin/mint-token.mjs)"); process.exit(1); }
const cli = (...a) => execFileSync("node", ["src/dms/packages/dms/cli/bin/dms.js", ...a], { env: ENV, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const clean = (s) => s.split("\n").filter((l) => l.trim().startsWith("{") || l.trim().startsWith("[")).pop();
const jget = (id) => JSON.parse(clean(cli("raw", "get", String(id))));

// ── lexical helpers (verbatim from build_fa_home.mjs / build_map21_lottr.mjs) ──
const text = (t, format = 0, style = "") => ({ type: "text", version: 1, detail: 0, format, mode: "normal", style, text: t });
const para = (...children) => ({ type: "paragraph", version: 1, direction: "ltr", format: "", indent: 0, textFormat: 0, textStyle: "", children });
const styled = (styleKey, ...children) => ({ type: "styled-paragraph", version: 1, direction: "ltr", format: "", indent: 0, textFormat: 0, textStyle: "", styleKey, children });
const button = (linkText, path, style = "plain") => ({ type: "button", version: 1, linkText, path, style, keepSearchParams: false });
const layoutItem = (...children) => ({ type: "layout-item", version: 1, direction: "ltr", format: "", indent: 0, children });
// ONE level of nesting only: layout-container → layout-item → leaf nodes. Both container and
// item are shadow roots, so a container nested inside an item is hoisted/mangled at render
// time (creating-pages-from-a-design-pattern.md § 5.6.6b).
const layout = (templateColumns, cells) => ({
  type: "layout-container", version: 1, direction: "ltr", format: "", indent: 0,
  templateColumns, children: cells.map((nodes) => layoutItem(...nodes)),
});
const lexical = (...nodes) => JSON.stringify({
  bgColor: "rgba(0,0,0,0)", isCard: "", showToolbar: false,
  text: { root: { type: "root", version: 1, direction: "ltr", format: "", indent: 0, children: nodes } },
});

// ── § 01 · the measure reference table ────────────────────────────────────────
// Rows come from components/macroview/measures.js — the SAME record the floating
// measure-context panel renders (design contract item 5: one vocabulary, two renderings).
// The three measures the current pm3 source cannot compute stay in the table, carrying an
// explicit "not yet computed" chip, rather than being trimmed away (Alex, open decision #2).
// `grid-cols-1` below md, the 5-column grid at md and up. The mockup's table is a real
// <table> inside an `overflow-x-auto` + `min-w-[880px]` scroller; a lexical
// layout-container cannot be an overflow container (its class string is appended to the
// theme's `layoutContainer`), so on a phone each measure STACKS into a block instead of
// scrolling sideways. Verified at 390px — without the `grid-cols-1` the five columns
// squeeze to ~55px each and wrap mid-word. Backported to the mockup as a note.
const ROW_COLS = "items-start grid-cols-1 md:grid-cols-[1.1fr_1.6fr_1.3fr_0.55fr_1fr] gap-x-3";
const headRow = layout(ROW_COLS, [
  [styled("metaSM", text("measure"))],
  [styled("metaSM", text("what it answers"))],
  [styled("metaSM", text("computation"))],
  [styled("metaSM", text("unit"))],
  [styled("metaSM", text("extra controls"))],
]);
const measureRows = MEASURE_ORDER.map((key) => {
  const m = MEASURES[key];
  const nameCell = [styled("cardTitleSM", text(m.abbr)), styled("metaXS", text(m.subtitle))];
  if (!m.available) nameCell.push(styled("chip", text(NOT_COMPUTED_LABEL)));
  const unitCell = [styled("proseSM", text(m.unitShort + (m.unitHint ? ` ${m.unitHint}` : "")))];
  const ctrlCell = m.referenceControls.length
    ? m.referenceControls.map((c) => styled("chip", text(c)))
    : [styled("proseSM", text("—"))];
  return layout(ROW_COLS, [
    nameCell,
    [styled("proseSM", text(m.answers))],
    [styled("prosePre", text(m.computation))],
    unitCell,
    ctrlCell,
  ]);
});

// Band names are STABLE STRINGS, not randomUUID(): a re-run must land on the same bands or
// every existing section's `group` is orphaned (and fidelity comparison needs a bijection).
const B = { map: "", ref: "npmrds-macro-reference", foot: "npmrds-macro-footer" };

const SECTIONS = [
  // ── § 01 band head ──
  {
    trackingId: `${TRACK_PREFIX}01-head`, group: B.ref, size: "12", et: "lexical",
    data: lexical(
      layout("items-center grid-cols-[auto_1fr] gap-x-2", [
        [styled("kicker", text("// 01"))],
        [styled("metaSM", text("eight measures · what each one means and what it's in"))],
      ]),
      styled("displaySM", text("Measure reference.")),
    ),
  },
  // ── § 01 table · card chrome comes from the SECTION, never from lexical content ──
  {
    trackingId: `${TRACK_PREFIX}01-table`, group: B.ref, size: "12", et: "lexical",
    bg: "white", border: "full",
    data: lexical(headRow, ...measureRows),
  },
  // ── footer ── only routes that EXIST in npmrds_sub are linked; the mockup's `report`
  // and `docs` entries have no live counterpart in this pattern yet.
  {
    trackingId: `${TRACK_PREFIX}footer`, group: B.foot, size: "12", et: "lexical",
    data: lexical(
      para(
        button("home", "/", "plain"),
        button("  reports", "/reports", "plain"),
        button("  route-comparison", "/route_comparison", "plain"),
        button("  map-21", "/map_21", "plain"),
      ),
      styled("metaXS", text("© NYSDOT · TransportNY DMS v0.2 · measures shown are the ones pm3 computes")),
    ),
  },
];

// ── apply ─────────────────────────────────────────────────────────────────────
const page = jget(PAGE_ID);
const pageData = page.data;
const draft = pageData.draft_sections || [];
console.log(`page ${PAGE_ID} (/${SLUG}) — ${draft.length} draft section(s)`);

const rows = draft.map((d) => ({ ref: d, row: jget(d.id) }));
const mine = rows.filter((r) => String(r.row.data?.trackingId || "").startsWith(TRACK_PREFIX));
const maps = rows.filter((r) => r.row.data?.element?.["element-type"] === "Map");
const other = rows.filter((r) => !mine.includes(r) && !maps.includes(r));

// PARITY GUARD — the additive analogue of the folder's count check. This builder can only
// recreate what it stamps; anything else in the draft is authored content it would destroy.
if (other.length) {
  throw new Error(
    `REFUSING TO TOUCH /${SLUG}: the draft holds ${other.length} section(s) this builder does not own and cannot recreate ` +
    `(${other.map((r) => `${r.ref.id}:${r.row.data?.element?.["element-type"]}`).join(", ")}). ` +
    `Back them into this script (or into a page_to_build.mjs export) before re-running.`
  );
}
if (maps.length !== 1) {
  throw new Error(`REFUSING: expected exactly 1 Map section in the draft, found ${maps.length}. The workbench band's contents changed — re-read the page before running this.`);
}
const mapRef = maps[0];
B.map = mapRef.row.data.group;
SECTIONS.forEach((s) => { if (!s.group) s.group = B.map; });
console.log(`  map section ${mapRef.ref.id} in band '${B.map}'  ·  builder-owned sections present: ${mine.length}`);

// back up every row we are about to touch
mkdirSync("scratchpad/npmrdsv5-dev2/backups", { recursive: true });
writeFileSync(`scratchpad/npmrdsv5-dev2/backups/${PAGE_ID}.build.before.json`, JSON.stringify({ page, rows: rows.map((r) => r.row) }, null, 1));
console.log(`  backed up page + ${rows.length} section row(s) → scratchpad/npmrdsv5-dev2/backups/${PAGE_ID}.build.before.json`);

// 1) drop the builder's previous output (by id, loudly — never by slug)
for (const m of mine) {
  try { cli("section", "delete", String(m.ref.id), "--pattern", PATTERN, "--page", String(PAGE_ID)); }
  catch (err) { console.log("  DELETE FAILED for", m.ref.id, String(err).slice(0, 160)); }
}
console.log(`wiped ${mine.length} builder-owned section(s)`);

// 2) the bands — DRAFT ONLY. `section_groups` (published) is owned by `page publish`;
// overwriting it would orphan every published section's group and blank the live page.
const GROUPS = [
  { name: B.map, index: 0, theme: "workbench", position: "content", full_width: "show", displayName: "Map workbench" },
  { name: B.ref, index: 1, theme: "content", position: "content", displayName: "Measure reference" },
  { name: B.foot, index: 2, theme: "footer", position: "content", displayName: "Footer" },
];
const tmp = mkdtempSync(join(tmpdir(), "build_npmrds_macro_"));
try {
  const gf = join(tmp, "groups.json");
  writeFileSync(gf, JSON.stringify({ draft_section_groups: GROUPS, has_changes: true }));
  cli("raw", "update", String(PAGE_ID), "--data", gf);
  console.log("bands:", GROUPS.map((g) => `${g.index}:${g.theme}`).join(" · "));

  // 3) the Map section's own height — `full` (95vh) → `screen` (100vh), which is what the
  // `workbench` band (h-screen, overflow-hidden) is paired with. Targeted patch on the
  // DRAFT row: the element object is re-emitted from the row we just read, so nothing else
  // in the 23KB symbology snapshot can move.
  const el = mapRef.row.data.element;
  if (el?.["element-data"]?.height !== "screen") {
    const patched = { ...el, "element-data": { ...el["element-data"], height: "screen" } };
    const mf = join(tmp, "map.json");
    writeFileSync(mf, JSON.stringify({ element: patched }));
    cli("raw", "update", String(mapRef.ref.id), "--data", mf);
    console.log(`map section height: ${el?.["element-data"]?.height} → screen`);
  } else {
    console.log("map section height: already screen");
  }

  // 4) create this builder's sections, in order (payloads via temp FILES — the table is big)
  SECTIONS.forEach((s, i) => {
    const payload = {
      size: s.size, group: s.group, title: "", trackingId: s.trackingId,
      element: { "element-data": s.data, "element-type": s.et }, "element-type": s.et,
    };
    for (const k of ["bg", "border", "height", "padding", "radius", "navLabel"]) if (s[k] != null) payload[k] = s[k];
    const f = join(tmp, `s${i}.json`);
    writeFileSync(f, JSON.stringify(payload));
    cli("section", "create", String(PAGE_ID), "--pattern", PATTERN, "--data", f);
  });
} finally { rmSync(tmp, { recursive: true, force: true }); }

// 5) OPTIONAL, opt-in: the compact 64px rail. Page `theme` is not draft/published-split, so
// this lands on the PUBLISHED page the moment it is written — hence the flag.
if (SIDENAV_COMPACT) {
  const theme = pageData.theme || {};
  const next = {
    ...theme,
    layout: { ...(theme.layout || {}), options: { ...(theme.layout?.options || {}), sideNav: { ...(theme.layout?.options?.sideNav || {}), activeStyle: "1" } } },
  };
  cli("raw", "update", String(PAGE_ID), "--data", JSON.stringify({ theme: next }));
  console.log("sideNav.activeStyle → '1' (compact 64px rail) — NOTE: page theme is not draft-scoped, this is live now");
}

const after = jget(PAGE_ID).data.draft_sections || [];
console.log(`built ${SECTIONS.length} section(s) on /${SLUG} (${PAGE_ID}); draft_sections now ${after.length}`);
console.log("draft only — nothing published. The owner publishes page 2101931.");
