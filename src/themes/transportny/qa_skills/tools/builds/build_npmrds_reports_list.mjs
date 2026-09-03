// ─────────────────────────────────────────────────────────────────────────────
// Build the NPMRDS "ALL REPORTS" list page — pattern `npmrds_sub` (2100394), a NEW page
// created as a child of 2188366 (the Templates/`reports` page), slug `list` →
// `/npmrds/reports/list` — from the mockup
//   src/themes/transportny/TransportNY Design System/dms_design_system_v2/pages/npmrds-reports-list.html
//   (2026-09-02).
// Task: planning/transportny/tasks/current/npmrds-all-reports-list-page.md
//   — read the FINAL Architecture decision there before touching this file. Short version: the
//   results grid is a native `elementType:'Spreadsheet'` section (real per-viewer column-header sort —
//   `spreadsheet/config.jsx`'s `Sort` control is NOT edit-gated, confirmed live 2026-09-03), the
//   header search box is a native `elementType:'Filter'` control
//   (`src/dms/skills/full-text-search-filter.md`), and the ONLY custom code is the
//   `ReportsListRail` component (tag-browse + Mine/Show-everyone's toggles — pure UI, writes URL
//   params, fetches nothing itself).
//
// Run from the dms-template root with DMS_AUTH_TOKEN set (see build_npmrds_reports.mjs's own
// header for the mint-token recipe):
//   node src/themes/transportny/qa_skills/tools/builds/build_npmrds_reports_list.mjs
//
// DRAFT-ONLY. It never publishes and never touches `sections`/`section_groups`.
//
// Discipline (qa_skills/tools/builds/README.md) — same as build_npmrds_reports.mjs:
//  · find-or-create the page BY SLUG under PARENT_ID, then address everything BY PAGE ID;
//  · a RUNTIME PARITY GUARD refuses to wipe when the live draft section count differs from
//    SECTIONS.length on a RE-RUN — override with ALLOW_SECTION_COUNT_CHANGE=1;
//  · the wipe is `draft_sections -> []` via `page update --data` (a full replace), plus a
//    best-effort `section delete` per orphaned row — export DMS_AUTH_TOKEN or re-runs orphan rows;
//  · sections are created in order, so draft_sections order == render order.
//
// PAGE-LEVEL WRITES THAT ARE NOT DRAFT/PUBLISH SPLIT (go live immediately; idempotent re-run):
//  · `sidebar` — "" (no rail — same as the Templates page).
//  · `filters` — the page-variable registry (creating-interactive-pages.md step 0): `search`,
//    `tag`, `tag_like`, `mine`, `restricted_owner`, `restricted_curated`. See the task file's
//    "Page-filter registry" table for what writes/reads each key.
//
// LAYOUT
//  · 3 bands: header / content (rail + table) / footer.
//  · Header: title (2) · view toggle Card (2, "All reports" active) · search Filter control (4)
//    · CreateReportButton (2) · New route Card (2) = 12 — SAME budget as build_npmrds_reports.mjs
//    so the toggle lands on the same pixel column on both pages.
//  · Content: ONE band, TWO sibling sections — ReportsListRail (3) + the results table (9).
//  · Footer: reused verbatim from build_npmrds_reports.mjs (same links, same styling).
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ENV = {
  ...process.env,
  DMS_HOST: process.env.DMS_HOST || "https://dmsserver.availabs.org",
  DMS_APP: process.env.DMS_APP || "npmrdsv5",
  DMS_TYPE: process.env.DMS_TYPE || "dev2",
};
const CLI = "src/dms/packages/dms/cli/bin/dms.js";
const PATTERN = "npmrds_sub";
const PARENT_ID = "2188366"; // the `reports` (Templates) page this list page nests under
// `url_slug` is a FLAT, fully-composed path string in this codebase's DMS — a page's `parent`
// field is hierarchy metadata only and does NOT get prepended at routing time (confirmed live,
// 2026-09-03: an existing child page's own `url_slug` reads "reports/year_over_year" verbatim,
// not "year_over_year" with the parent inferred). So this page's slug must be the full
// "reports/list", matching how every other `reports/<name>` child page is actually stored.
const SLUG = "reports/list";
const TITLE = "All Reports";

const cli = (...a) => execFileSync("node", [CLI, ...a], { env: ENV, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const lastJson = s => JSON.parse(s.split("\n").filter(l => l.trim().startsWith("{") || l.trim().startsWith("[")).pop());
const jget = id => lastJson(cli("raw", "get", String(id)));
const tmp = (name, obj) => {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "npmrds-reports-list-")), name);
  fs.writeFileSync(p, JSON.stringify(obj));
  return p;
};

// ── lexical builders — copied verbatim from build_npmrds_reports.mjs (no shared helper module
//    exists between these standalone builder scripts; see that file's own header) ──────────────
const GOLD = "color:#CA8A04";
const text = (t, format = 0, style = "") => ({ type: "text", version: 1, detail: 0, format, mode: "normal", style, text: t });
const styled = (styleKey, ...children) => ({ type: "styled-paragraph", version: 1, direction: "ltr", format: "", indent: 0, textFormat: 0, textStyle: "", styleKey, children });
const button = (linkText, path_, style = "plain") => ({ type: "button", version: 1, linkText, path: path_, style, keepSearchParams: false });
const para = (...children) => ({ type: "paragraph", version: 1, direction: "ltr", format: "", indent: 0, textFormat: 0, textStyle: "", children });
const litem = (...children) => ({ type: "layout-item", version: 1, children });
const layout = (templateColumns, items) => ({ type: "layout-container", version: 1, templateColumns, children: items });
const lexical = (...nodes) => JSON.stringify({
  bgColor: "rgba(0,0,0,0)", isCard: "", showToolbar: false,
  text: { root: { type: "root", version: 1, direction: "ltr", format: "", indent: 0, children: nodes } },
});

function assertFlat(elementData, where) {
  const SHADOW = new Set(["layout-container", "layout-item"]);
  (function walk(n, underShadow) {
    if (n.type === "layout-container" && underShadow)
      throw new Error(`${where}: nested layout-container inside a shadow root — Lexical will mangle it`);
    for (const c of (n.children || [])) walk(c, underShadow || SHADOW.has(n.type));
  })(JSON.parse(elementData).text.root, false);
  return elementData;
}

// ── live link targets — same as build_npmrds_reports.mjs's `L` ─────────────────────────────────
const L = {
  home: "/home",
  macro: "/macro",
  reports: "/reports",
  routeCreation: "/route_creation",
  comparison: "/route_comparison",
  map21: "/map_21",
  docOverview: "/docs/npmrds/overview",
};

// ── the `reports_snap_2` source — same binding build_npmrds_reports.mjs uses (source 2177438 /
//    view 2177440), verbatim so both pages read the exact same catalog. ────────────────────────
// `created_by` needs `systemCol: true` (found live, 2026-09-03, testing the Mine/restricted_owner
// filters on this exact page): without it, buildUdaConfig.js resolves the column to the JSON
// field `data->>'created_by'`, which nothing ever writes (converted reports stash the OLD tool's
// creator under an inert `_old_created_by` instead) — the filter then matches ZERO rows, always.
// `systemCol: true` (reportCatalogSource.js's own hard-won fix, same column, 2026-09-01) makes it
// resolve to DMS's real, always-populated audit column instead. build_npmrds_reports.mjs never
// filters on `created_by`, so it never needed this — a straight copy of its RS_COLS would have
// carried the same bug this page fixes.
const RS_COLS = [
  "report_id", "name", "description", "route_comps", "graph_comps", "station_comps",
  "color_range", "created_by", "created_at", "updated_at", "thumbnail", "pic",
  "routes", "tags", "graph_count", "page_path", "difficulty", "counts_label",
].map(name => ({
  name, display_name: name, options: null, required: false, source_id: 2177438,
  type: name === "tags" ? "multiselect" : name === "graph_count" ? "number" : "text",
  ...(name === "created_by" ? { systemCol: true } : {}),
}));
const REPORTS = {
  app: "npmrdsv5", name: "reports_snap_2", default_columns: null,
  source_id: 2177438, view_id: 2177440, view_name: "version 1",
  env: "npmrdsv5+reports_snap_2", srcEnv: "npmrdsv5+datasets",
  isDms: true, baseUrl: "/forms", type: "reports_snap_2", columns: RS_COLS,
};

// ── Card / cell helpers — same as build_npmrds_reports.mjs ──────────────────────────────────────
const card = (externalSource, columns, display, filters = { op: "AND", groups: [] }) => JSON.stringify({
  externalSource, columns, filters,
  display: {
    usePagination: false, pageSize: 50, striped: false, autoResize: false,
    readyToLoad: true, showAttribution: false, allowDownload: false, reverse: false,
    cardsGridSize: 1, cardsGridGap: 0, cardBorder: false, cellBorder: false,
    preventDuplicateFetch: true, ...display,
  },
  data: [], join: { sources: {} },
});
const stat = (name, staticValue, valueFontStyle, extra = {}) =>
  ({ name, origin: "static", staticValue, valueFontStyle, show: true, hideHeader: true, justify: "left", cellPadding: 0, ...extra });
const calc = (name, extra = {}) =>
  ({ name, origin: "calculated-column", type: "calculated", fn: "exempt", formatFn: " ", show: true, justify: "left", ...extra });
const SEED = name => calc(`count(1) as ${name}`, { selectOnly: true, hideHeader: true });

// ── the SEARCH control — `elementType:'Filter'`, `src/dms/skills/full-text-search-filter.md`
//    step 1 verbatim: a column carrying ONE `filters[]` entry with `operation:'like'` renders a
//    text box (not a value picker); `searchParamKey:'search'` is the page variable it publishes
//    to. `hideExternalToggle` hides the internal/external source toggle so it reads as a plain
//    search box. ──────────────────────────────────────────────────────────────────────────────
const SEARCH_KEY = "search";
const searchControl = () => JSON.stringify({
  externalSource: REPORTS,
  columns: [
    {
      name: "name", display_name: "name", customName: "Search by name or description…", type: "text", show: true,
      filters: [{
        type: "external", operation: "like", values: [], isMulti: false,
        usePageFilters: true, searchParamKey: SEARCH_KEY, display: "",
      }],
    },
  ],
  filters: { op: "AND", groups: [] },
  // No `filterStyle` override — the library default (a visible label above the box) is a known
  // cosmetic mismatch next to this row's other h-10 controls, deferred to Alex (see the toggle's
  // own comment above for the "no shared-theme edits this session" call).
  display: { totalLength: 1, readyToLoad: true, hideExternalToggle: true },
});

// ── the RESULTS TABLE — `elementType:'Spreadsheet'`, native pagination + native
//    per-column sort (spreadsheet/config.jsx's Sort header control, live for any viewer). Author
//    default order: `updated_at desc` — the composite "Best match" ranking has no single-column
//    equivalent and is deliberately dropped for this page (Ryan's call, AskUserQuestion
//    2026-09-03 — see the task file's Architecture decision item 1).
//
//    Filter tree, top-level AND:
//      · static, always-on: name/page_path notempty (excludes legacy rows never rebuilt — same
//        `page_path notempty` guard useReportSearch.js already applies).
//      · `search` OR-group (full-text-search-filter.md step 2) on name/description.
//      · `tag` — exact `tags` array_contains (category/value picks from the rail).
//      · `tag_like` — substring `tags` match ("Other tags" free text).
//      · `mine` — `created_by` filter, value = the viewer's own id (written by the rail).
//      · `restricted_owner`/`restricted_curated` OR-group — the visibility allow-list's native
//        equivalent (Architecture decision item 2): BOTH leaves are empty (dropped, confirmed
//        safe server-side — dms-server's `buildGroupSQL` returns '' for an all-empty group,
//        which itself then drops out of its own parent) unless "Show everyone's" is OFF, in
//        which case the rail writes both at once. The `agency:<group>` OR-branch the modal has is
//        NOT reproduced here — no native "current viewer's groups" page filter exists; flagged,
//        not asked.
const PAGE_SIZE = 25;
const RESULTS_COLUMNS = [
  { name: "name", display_name: "name", customName: "Report", type: "text", show: true, formatFn: " ", justify: "left" },
  { name: "tags", display_name: "tags", customName: "Tags", type: "multiselect", show: true, formatFn: " ", justify: "left", disableSort: true },
  { name: "counts_label", display_name: "counts_label", customName: "Routes · graphs", type: "text", show: true, formatFn: " ", justify: "left", disableSort: true },
  { name: "updated_at", display_name: "updated_at", customName: "Updated", type: "text", show: true, formatFn: "date", justify: "left", sort: "desc nulls last" },
  // `customName` must be non-empty (falsy strings fall through to `display_name` —
  // TableHeaderCell.jsx's `attribute.customName || attribute.display_name || colIdName`) —
  // a bare space renders as a blank header, matching the mockup's un-labeled action column.
  { name: "page_path", display_name: "page_path", customName: " ", type: "text", show: true, formatFn: " ", justify: "right",
    isLink: true, linkText: "open →", disableSort: true },
  // `selectOnly` — fetched (so filter leaves can reference them) but render no cell. Found live,
  // 2026-09-03: `buildColumnsWithSettings` (buildUdaConfig.js:839) enriches entries from the
  // SECTION's own `columns` array using `externalSource.columns` as a lookup table, but only for
  // names ALREADY present in `columns` — it never adds an entry outright. A filter leaf on a
  // column absent from the section's own `columns` (as `description`/`created_by` were, before
  // this fix — both are used only by filters here, never displayed) resolves via `getColumn()` to
  // `undefined`, and `mapFilterGroupCols` leaves such a leaf unmapped/inert: the constraint
  // silently vanishes rather than erroring. This is what made the `mine`/`restricted_owner`
  // (`created_by`) filters look like they were doing nothing, live-tested on this exact page.
  { name: "description", display_name: "description", type: "text", selectOnly: true, show: false },
  { name: "created_by", display_name: "created_by", type: "text", systemCol: true, selectOnly: true, show: false },
];
const resultsTable = () => JSON.stringify({
  externalSource: REPORTS,
  columns: RESULTS_COLUMNS,
  filters: {
    op: "AND",
    groups: [
      { col: "name", op: "notempty" },
      { col: "page_path", op: "notempty" },
      { op: "OR", groups: [
        { col: "name", op: "like", value: "", usePageFilters: true, searchParamKey: SEARCH_KEY },
        { col: "description", op: "like", value: "", usePageFilters: true, searchParamKey: SEARCH_KEY },
      ]},
      { col: "tags", op: "filter", value: [], usePageFilters: true, searchParamKey: "tag" },
      { col: "tags", op: "like", value: "", usePageFilters: true, searchParamKey: "tag_like" },
      { col: "created_by", op: "filter", value: [], usePageFilters: true, searchParamKey: "mine" },
      { op: "OR", groups: [
        { col: "created_by", op: "filter", value: [], usePageFilters: true, searchParamKey: "restricted_owner" },
        { col: "tags", op: "filter", value: [], usePageFilters: true, searchParamKey: "restricted_curated" },
      ]},
    ],
  },
  display: {
    usePagination: true, pageSize: PAGE_SIZE, hideExternalToggle: true,
    readyToLoad: true, totalLength: 0, showAttribution: false,
  },
  data: [], join: { sources: {} },
});

// ═════════════════════════════════════════════════════════════════════════════
// BANDS
// ═════════════════════════════════════════════════════════════════════════════
const B = { header: randomUUID(), content: randomUUID(), footer: randomUUID() };
const GROUPS = [
  { name: B.header,  index: 0, theme: "header",  position: "content", displayName: "Header" },
  { name: B.content, index: 1, theme: "content", position: "content", displayName: "§01 List" },
  { name: B.footer,  index: 2, theme: "footer",  position: "content", displayName: "Footer" },
];

// ═════════════════════════════════════════════════════════════════════════════
// SECTIONS — draft_sections order IS render order
// ═════════════════════════════════════════════════════════════════════════════
const SECTIONS = [

  // ══════════ HEADER — same 5-section, 12-col budget as build_npmrds_reports.mjs ══════════
  { group: B.header, size: "2", padding: { left: "0", top: "0" }, data: lexical(
    styled("displayMDCaps", text("All reports"), text(".", 0, GOLD)),
  )},

  // The VIEW TOGGLE — same control as the Templates page, active side flipped: "Templates" is
  // now the LINK cell (back to /reports), "All reports" is the active plain cell.
  //
  // KNOWN, DEFERRED (2026-09-03, Ryan's call): using `viewTabOff`/`viewTabOn` verbatim here is
  // cosmetically wrong — those two tokens bake "the active/dark cell is always the LEFT one"
  // into the same class as the color (true on the Templates page, false here — Templates stays
  // LEFT per the mockup's own toggle order, but All reports is the ACTIVE one and stays on the
  // RIGHT), so the rounded corners + shared seam land on the wrong sides and the two cells don't
  // read as one segmented control. A real fix needs new theme tokens (a `viewTabOffLeft`/
  // `viewTabOnRight` pair) or a component-level change — deliberately NOT done here: shared
  // theme edits are Alex's call, not this session's, per Ryan's explicit ask. Ship the known
  // cosmetic bug today; fix it tomorrow with Alex.
  { group: B.header, size: "2", padding: { left: "0", right: "0" }, elementType: "Card", data: card(REPORTS, [
    stat("view_templates", "Templates", "viewTabOff", { isLink: true, location: L.reports, searchParams: "none" }),
    stat("view_all", "All reports", "viewTabOn"),
    SEED("view_seed"),
  ], {
    cellsGridSize: 2, cellsGridGap: 0, cellsPadding: 0, cardsPadding: 0,
    cellsTracksTemplate: "minmax(0,max-content) minmax(0,max-content)",
    cellsContentVAlign: "center", totalLength: 1, fetchMode: "force",
  }) },

  // The SEARCH control — a REAL native filter (not ChooseReportButton/a modal trigger — there is
  // nothing to open on this page). full-text-search-filter.md step 1. Ships with the library
  // default Filter style (no `filterStyle` override) — same "defer shared-theme changes to
  // Alex" call as the toggle above; the stacked label-above-box look is a known cosmetic gap.
  { group: B.header, size: "4", elementType: "Filter", data: searchControl() },

  { group: B.header, size: "2", padding: { right: "0" }, elementType: "CreateReportButton", data: "{}" },

  { group: B.header, size: "2", padding: { left: "0", right: "0" }, elementType: "Card", data: card(REPORTS, [
    stat("new_route", "New route", "btnOutlineLG", { justify: "left", isLink: true, location: L.routeCreation, searchParams: "none" }),
    SEED("route_seed"),
  ], {
    cellsGridSize: 1, cellsPadding: 0, cardsPadding: 0,
    cellsContentVAlign: "center", totalLength: 1, fetchMode: "force",
  }) },

  // ══════════ § 01 · THE LIST — ONE band, TWO sibling sections (rail + table) ══════════
  { group: B.content, size: "3", anchorId: "filters", elementType: "ReportsListRail", data: "{}" },
  { group: B.content, size: "9", anchorId: "results", elementType: "Spreadsheet", data: resultsTable() },

  // ══════════ FOOTER — reused verbatim from build_npmrds_reports.mjs ══════════
  { group: B.footer, size: "12", padding: { top: "0", bottom: "0" }, data: lexical(
    layout("w-full !mt-0 !mb-0 items-center grid-cols-1 md:grid-cols-[minmax(0,max-content)_minmax(0,1fr)_minmax(0,max-content)]", [
      litem(para(
        button("home", L.home, "linkMonoRow"),
        button("macro-view", L.macro, "linkMonoRow"),
        button("templates", L.reports, "linkMonoRow"),
        button("route-comparison", L.comparison, "linkMonoRow"),
        button("map-21", L.map21, "linkMonoRow"),
        button("docs", L.docOverview, "linkMonoRow"),
      )),
      litem(para(text(""))),
      litem(styled("metaMD", text("© NYSDOT · TransportNY DMS v0.2"))),
    ]),
  )},

];

// ── the page-variable registry (creating-interactive-pages.md step 0) — see the task file's
//    "Page-filter registry" table for who writes/reads each key. ──────────────────────────────
const PAGE_FILTERS = [
  { id: "npmrds-reports-list-search", values: "", searchKey: SEARCH_KEY, useSearchParams: true },
  { id: "npmrds-reports-list-tag", values: "", searchKey: "tag", useSearchParams: true },
  { id: "npmrds-reports-list-tag-like", values: "", searchKey: "tag_like", useSearchParams: true },
  { id: "npmrds-reports-list-mine", values: "", searchKey: "mine", useSearchParams: true },
  { id: "npmrds-reports-list-restricted-owner", values: "", searchKey: "restricted_owner", useSearchParams: true },
  { id: "npmrds-reports-list-restricted-curated", values: "", searchKey: "restricted_curated", useSearchParams: true },
];

// ── P7-style band-edge gutters — same pass build_npmrds_reports.mjs uses, so a later size
//    change can't silently leave a row edge padded. ──────────────────────────────────────────
{
  const GRID = 12;
  let i = 0;
  while (i < SECTIONS.length) {
    const gid = SECTIONS[i].group;
    const band = [];
    while (i < SECTIONS.length && SECTIONS[i].group === gid) band.push(SECTIONS[i++]);
    let col = 0;
    band.forEach((s, k) => {
      if (col === 0) s.padding = { ...(s.padding || {}), left: "0" };
      col += Number(s.size) || GRID;
      if (col >= GRID || k === band.length - 1) { s.padding = { ...(s.padding || {}), right: "0" }; col = 0; }
    });
  }
}

// offline guard — a nested layout-container renders empty/scrambled at runtime
SECTIONS.forEach((s, i) => { if ((s.elementType || "lexical") === "lexical") assertFlat(s.data, `SECTIONS[${i}]`); });

// Offline inspection escape: `SECTIONS_DUMP=<index> node …` prints one section's element-data
// and exits WITHOUT touching the live page.
if (process.env.SECTIONS_DUMP != null) {
  const i = Number(process.env.SECTIONS_DUMP);
  const s = SECTIONS[i];
  if (!s) { console.error(`SECTIONS_DUMP: no section ${i} (0..${SECTIONS.length - 1})`); process.exit(1); }
  console.log(JSON.stringify({ index: i, size: s.size, elementType: s.elementType || "lexical", ...JSON.parse(s.data) }, null, 1));
  process.exit(0);
}

// ═════════════════════════════════════════════════════════════════════════════
// APPLY
// ═════════════════════════════════════════════════════════════════════════════
// 0 · resolve (or create) the page BY SLUG under PARENT_ID, then work by PAGE ID only.
const pages = lastJson(cli("page", "list", "--pattern", PATTERN, "--limit", "1000")).items || [];
const bySlug = pages.filter(p => (p.data || p).url_slug === SLUG && String((p.data || p).parent) === PARENT_ID);
let PAGE;
if (bySlug.length === 1) {
  PAGE = String(bySlug[0].id);
  console.log(`found existing page ${PAGE} (${PATTERN}/${SLUG} under ${PARENT_ID})`);
} else if (bySlug.length === 0) {
  const created = lastJson(cli("page", "create", "--pattern", PATTERN, "--title", TITLE, "--slug", SLUG, "--parent", PARENT_ID));
  PAGE = String(created.id ?? created.data?.id ?? created.item?.id);
  if (!PAGE || PAGE === "undefined") {
    console.error(`\nREFUSING: \`page create\` did not return a usable id — raw: ${JSON.stringify(created)}\n`);
    process.exit(1);
  }
  console.log(`created page ${PAGE} (${PATTERN}/${SLUG} under ${PARENT_ID})`);
} else {
  console.error(
    `\nREFUSING: expected at most one ${PATTERN}/${SLUG} page under parent ${PARENT_ID}; ` +
    `found ${bySlug.length}: [${bySlug.map(p => p.id).join(", ")}]. This builder never picks one — resolve the duplicate by hand.\n`);
  process.exit(1);
}
console.log(`page: ${PAGE} (${PATTERN}/${SLUG}) on ${ENV.DMS_HOST} ${ENV.DMS_APP}/${ENV.DMS_TYPE}`);

// 1 · runtime parity guard — never wipe live authoring away silently on a RE-RUN
const existing = jget(PAGE).data.draft_sections || [];
if (existing.length && existing.length !== SECTIONS.length && process.env.ALLOW_SECTION_COUNT_CHANGE !== "1") {
  console.error(
    `\nREFUSING TO WIPE ${PATTERN}/${SLUG} (page ${PAGE}): the live draft has ${existing.length} ` +
    `sections but this builder carries ${SECTIONS.length}.\n` +
    `Someone has authored the live page since this script was last run, or the script has drifted.\n` +
    `Re-run with ALLOW_SECTION_COUNT_CHANGE=1 once the change is intentional.\n`);
  process.exit(1);
}

// 2 · wipe by PAGE ID
cli("page", "update", PAGE, "--data", tmp("wipe.json", { draft_sections: [] }));
let deleted = 0, failed = 0;
for (const e of existing) {
  try { cli("section", "delete", String(e.id), "--page", PAGE, "--pattern", PATTERN); deleted++; }
  catch (err) { failed++; console.log(`  orphaned (delete failed, no longer referenced): ${e.id} — ${String(err).split("\n")[0].slice(0, 110)}`); }
}
console.log(`wiped ${existing.length} draft sections (${deleted} deleted, ${failed} orphaned)`);

// 3 · bands — draft ONLY.
cli("raw", "update", PAGE, "--data", tmp("groups.json", { draft_section_groups: GROUPS }));
console.log("bands:", GROUPS.map(g => `${g.index}:${g.displayName}`).join(" · "));

// 4 · page-level fields. NOT draft/published split — these go live immediately.
cli("page", "update", PAGE, "--data", tmp("pagefields.json", { sidebar: "", filters: PAGE_FILTERS }));
console.log(`page fields: sidebar="" · filters=[${PAGE_FILTERS.map(f => f.searchKey).join(" ")}]`);

// 5 · sections, in order
let n = 0;
for (const s of SECTIONS) {
  const elementType = s.elementType || "lexical";
  const payload = {
    title: "", size: s.size, group: s.group,
    element: { "element-type": elementType, "element-data": s.data },
    trackingId: randomUUID(),
  };
  for (const k of ["border", "radius", "padding", "height", "bg", "shadow", "rowspan", "navLabel", "anchorId"])
    if (s[k] != null) payload[k] = s[k];
  cli("section", "create", PAGE, "--pattern", PATTERN, "--data", tmp(`s${n}.json`, payload));
  n++;
}
const after = jget(PAGE).data.draft_sections || [];
console.log(`created ${n} sections; page now has ${after.length} draft sections`);
if (after.length !== SECTIONS.length) {
  console.error(`MISMATCH: expected ${SECTIONS.length}, got ${after.length}`);
  process.exit(1);
}
console.log(`done — DRAFT ONLY. \`dms page publish ${PAGE}\` is the owner's call.`);
