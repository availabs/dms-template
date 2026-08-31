// ─────────────────────────────────────────────────────────────────────────────
// Build the NPMRDS REPORTS page — pattern `npmrds_sub` (2100394), slug
// `converted_reports` (page 2188366), on npmrdsv5 / dev2 — from the converged mockup
//   src/themes/transportny/TransportNY Design System/dms_design_system_v2/pages/npmrds-reports.html
//   (REVISION 2, 2026-07-31 — templates first, one card per template in five typed
//    groups, a preview plate, search in a modal)
// Task: planning/transportny/tasks/current/npmrds-reports-page-build.md
//
// Run from the dms-template root with DMS_AUTH_TOKEN set:
//   export DMS_AUTH_TOKEN=$(node src/dms/packages/dms/cli/bin/mint-token.mjs \
//     --host https://dmsserver.availabs.org --project npmrdsv5 \
//     --email availabs@gmail.com --password test123)
//   node src/themes/transportny/qa_skills/tools/builds/build_npmrds_reports.mjs
//
// DRAFT-ONLY. It never publishes and never touches `sections`/`section_groups`.
//
// Discipline (qa_skills/tools/builds/README.md):
//  · find-or-create the page BY SLUG, then address everything BY PAGE ID;
//  · a RUNTIME PARITY GUARD refuses to wipe when the live draft section count
//    differs from SECTIONS.length — override with ALLOW_SECTION_COUNT_CHANGE=1;
//  · the wipe is `draft_sections -> []` via `page update --data` (a full replace,
//    never `--set`, which deep-merges arrays and accumulates stale refs), plus a
//    best-effort `section delete` per orphaned row;
//    ⚠ **EXPORT `DMS_AUTH_TOKEN` OR EVERY RE-RUN LEAVES ORPHANS BEHIND.** Reads are
//    anonymous, but `section delete` 500s with "Authentication required to delete
//    items" and the wipe is best-effort — the run still SUCCEEDS and the page is
//    still correct, it just prints `(0 deleted N orphaned)` and the old rows stay in
//    the pattern forever. Check the wipe line: `(N deleted, 0 orphaned)` is healthy.
//  · sections are created in order, so draft_sections order == render order.
//
// PAGE-LEVEL WRITES THAT ARE NOT DRAFT/PUBLISH SPLIT (they go live immediately —
// harmless here only because 2188366 has never been published):
//  · `sidebar` — set to "" (the design has no rail; the page shipped `left`).
//  · `filters` — the page-variable registry the search modal needs
//    (creating-interactive-pages.md step 0). Without it the Filter control's value
//    never reaches the URL and no section reacts.
//
// LAYOUT (the mockup's bands → DMS primitives)
//  · 7 bands: header / §01 templates / §02 your reports / §03 worked examples /
//    §04 the finder / footer / the find-a-report MODAL group.
//  · The mockup's three narrow template groups (before-after 3 · floating-car 6 ·
//    events 3) each draw their sub-head INSIDE the group box. A Card's static cells
//    repeat per record, so a shared group head is not a cell. They are built as
//    SIBLING sections instead: three heads on one row (3+6+3) over three Cards on
//    the next (3+6+3) — the columns line up, nothing nests, and contract item 10
//    still holds.
//  · The two wide groups (change-over-time 4 cards · behavioral 4 cards) are a
//    full-width lexical head over ONE Card at `cardsGridSize: 4`.
//  · So the shelf is FIVE Cards — the same five that 2208581 already binds — each
//    filtered on `tags`, re-housed in the designed layout. Twelve template cards.
//
// DATA (all figures are bound; see the task doc's data contract)
//  · templates + search — DMS-internal `reports_snap_2` 2177438 / view 2177440,
//    `env: npmrdsv5+reports_snap_2`, `srcEnv: npmrdsv5+datasets`, isDms. The five
//    category filters are lifted VERBATIM from 2208581's five Cards.
//  · saved routes — DMS-internal `Routes Data` 2107426 / 2107427. The catalogue is
//    ~2x duplicated on route_id, so the calc is `count(distinct data->>'route_id')`.
//    An isDms calc column must contain NO COMMAS (reference_dms_calc_column_no_commas).
//  · freshness — ClickHouse NPMRDS prod 583 / view 982; max(date) is a partition
//    metadata read, not a scan.
//
// NOT BUILT / DEVIATIONS — every one is logged in the task doc's Escalations table:
//  1. The preview plate. The stored `thumbnail`s are 50x50px; the layout-derived
//     shape needs a new column type. The cards keep the design's 1/4-width tile
//     column and render patterns.html §14's "no preview" tile, so a plate cell is a
//     one-column swap later.
//  2. § 03's four worked examples. Pages 2194949 / 2192364 / 2192451 / 2191095 no
//     longer exist in npmrds_sub (verified 2026-08-19). The band keeps its head and
//     states the gap rather than shipping four dead links.
//  3. The whole-card anchor. A Card's link affordance is per-cell; the card's link
//     is its `page_path` cell.
//  4. The § 01 routes CTA's "New route" button — the mockup draws it with no href
//     and no standalone route-builder page exists.
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
const SLUG = "converted_reports";
const TITLE = "Converted Reports";

const cli = (...a) => execFileSync("node", [CLI, ...a], { env: ENV, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const lastJson = s => JSON.parse(s.split("\n").filter(l => l.trim().startsWith("{") || l.trim().startsWith("[")).pop());
const jget = id => lastJson(cli("raw", "get", String(id)));
const tmp = (name, obj) => {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "npmrds-reports-")), name);
  fs.writeFileSync(p, JSON.stringify(obj));
  return p;
};

// ── lexical builders ─────────────────────────────────────────────────────────
// The brand's gold terminal period on a page title — a lexical TEXT-NODE style (the
// house pattern in every transportny builder: build_npmrds_home, build_tsmo_*,
// build_cr_*), not a className passthrough. Measured missing on this page in P7: the
// period rendered ink rgb(15,23,34) against the mockup's rgb(202,138,4).
const GOLD = "color:#CA8A04";
const text = (t, format = 0, style = "") => ({ type: "text", version: 1, detail: 0, format, mode: "normal", style, text: t });
const para = (...children) => ({ type: "paragraph", version: 1, direction: "ltr", format: "", indent: 0, textFormat: 0, textStyle: "", children });
const styled = (styleKey, ...children) => ({ type: "styled-paragraph", version: 1, direction: "ltr", format: "", indent: 0, textFormat: 0, textStyle: "", styleKey, children });
const button = (linkText, path_, style = "plain") => ({ type: "button", version: 1, linkText, path: path_, style, keepSearchParams: false });
const icon = (iconName, styleKey) => (styleKey ? { type: "icon", version: 1, iconName, styleKey } : { type: "icon", version: 1, iconName });
const litem = (...children) => ({ type: "layout-item", version: 1, children });
// ONE container, whose items hold only leaf styled()/para() nodes. Nesting a
// container inside an item makes Lexical mangle it at render time
// (creating-pages-from-a-design-pattern.md § 5.6.6b) — assertFlat() enforces it.
const layout = (templateColumns, items) => ({ type: "layout-container", version: 1, templateColumns, children: items });
const lexical = (...nodes) => JSON.stringify({
  bgColor: "rgba(0,0,0,0)", isCard: "", showToolbar: false,
  text: { root: { type: "root", version: 1, direction: "ltr", format: "", indent: 0, children: nodes } },
});
// A BARE lexical document — the shape a lexical CARD CELL's staticValue must have
// (LexicalView's parseValue tests `JSON.parse(value)?.root`).
const lexDoc = (...nodes) => JSON.stringify({
  root: { type: "root", version: 1, direction: "ltr", format: "", indent: 0, children: nodes },
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

// ── live link targets (every one verified against `dms page list` 2026-08-19) ──
const L = {
  home: "/home",
  macro: "/macro",
  reports: "/converted_reports",
  reportIndex: "/converted_reports/reports",
  comparison: "/route_comparison",
  map21: "/map_21",
  docOverview: "/docs/npmrds/overview",
};

// ── the two-line group head (numeral · name), one per template category ──────
// The mockup draws a hairline rule filling the rest of the head's line
// (`flex-1 h-px bg-zinc-950/10`). A lexical run cannot draw a rule that stops at
// its own line, so the rule is dropped — logged once for all five heads.
// `!mt-0 !mb-0` is load-bearing: a layout-container ships the Lexical paragraph's own
// vertical margin, and on a ONE-LINE head that margin is most of the section's height
// (measured 74.4px live against the mockup's 24px row before this).
const groupHead = (num, name) => lexical(
  layout("w-full !mt-0 !mb-0 items-center grid-cols-1 md:grid-cols-[max-content_minmax(0,1fr)] gap-x-3", [
    // `kickerSM`, not `kicker`: P7 measured the lexical `kicker` at 11px on a 22.4px line
    // box against the mockup's 10.5px/15.75px, because `kicker` declares no leading and the
    // richtext wrapper's ABSOLUTE `leading-[22.4px]` inherits into it. `kickerSM` carries
    // the mockup's own numeral class (10.5px / leading-[1.5] / 0.2em / #CA8A04).
    litem(styled("kickerSM", text(num))),
    litem(styled("labelMD", text(name))),
  ]),
);

// ── sources ──────────────────────────────────────────────────────────────────
// `reports_snap_2` — lifted verbatim from 2208581's five Cards (the shelf already
// works; this build re-houses it, it does not re-solve it).
const RS_COLS = [
  "report_id", "name", "description", "route_comps", "graph_comps", "station_comps",
  "color_range", "created_by", "created_at", "updated_at", "thumbnail", "pic",
  "routes", "tags", "graph_count", "page_path", "difficulty", "counts_label",
].map(name => ({
  name, display_name: name, options: null, required: false, source_id: 2177438,
  type: name === "tags" ? "multiselect" : name === "graph_count" ? "number" : "text",
}));
const REPORTS = {
  app: "npmrdsv5", name: "reports_snap_2", default_columns: null,
  source_id: 2177438, view_id: 2177440, view_name: "version 1",
  env: "npmrdsv5+reports_snap_2", srcEnv: "npmrdsv5+datasets",
  isDms: true, baseUrl: "/forms", type: "reports_snap_2", columns: RS_COLS,
};
// DMS-internal `Routes Data` — the saved-route catalogue (~2x duplicated on route_id).
const ROUTES = {
  name: "Routes Data", source_id: 2107426, view_id: 2107427, isDms: true,
  app: "npmrdsv5", type: "routes_data",
  env: "npmrdsv5+routes_data", srcEnv: "npmrdsv5+datasets_env",
  columns: [
    { name: "route_id", display_name: "route_id", type: "text" },
    { name: "name", display_name: "name", type: "text" },
    { name: "created_at", display_name: "created_at", type: "text" },
  ],
};
// ClickHouse NPMRDS production — the freshness signal (contract item 4).
const CH_NPMRDS = {
  name: "NPMRDS", source_id: 583, view_id: 982, view_name: "NPMRDS_V6",
  type: "npmrds", env: "npmrds2", srcEnv: "npmrds2", isDms: false, baseUrl: "/datasources",
  columns: [
    { desc: null, name: "tmc", type: "STRING", display_name: "tmc" },
    { desc: null, name: "date", type: "STRING", display_name: "date" },
    { desc: null, name: "epoch", type: "INTEGER", display_name: "epoch" },
    { desc: null, name: "travel_time_all_vehicles", type: "NUMBER", display_name: "travel_time_all_vehicles" },
    { desc: null, name: "state", type: "STRING", display_name: "state" },
  ],
};

// ── Card / cell helpers ──────────────────────────────────────────────────────
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
// A static chrome cell (an eyebrow / a label with no row data).
const stat = (name, staticValue, valueFontStyle, extra = {}) =>
  ({ name, origin: "static", staticValue, valueFontStyle, show: true, hideHeader: true, justify: "left", cellPadding: 0, ...extra });
const calc = (name, extra = {}) =>
  ({ name, origin: "calculated-column", type: "calculated", fn: "exempt", formatFn: " ", show: true, justify: "left", ...extra });
// A ROW-LEVEL calc — deliberately NO `fn`. getData's invalid-state guard counts ANY
// truthy `fn`, and "some visible columns have fn, some don't" kills the fetch
// (perma-loading). `fn` undefined generates the identical `expr as alias` SQL for a
// non-aggregate calc.
const rowCalc = (name, extra = {}) =>
  ({ name, origin: "calculated-column", type: "calculated", formatFn: " ", show: true, justify: "left", ...extra });
// `origin:'static'` + `type:'lexical'` — the read-only richtext cell, for chrome
// that needs mixed runs (an icon AND a text run on one line).
const lexCell = (name, nodes, extra = {}) =>
  ({ name, origin: "static", type: "lexical", staticValue: lexDoc(...nodes),
     show: true, hideHeader: true, justify: "left", ...extra });
// A bound column cell.
const col = (name, valueFontStyle, extra = {}) =>
  ({ name, display_name: name, key: name, type: "text", formatFn: " ",
     show: true, hideHeader: true, justify: "left", valueFontStyle, ...extra });

// ── the SEARCH page variable ─────────────────────────────────────────────────
// One OR group of `like` leaves, one per searchable column, all sharing
// `searchParamKey: 'search'` (full-text-search-filter.md). An empty box drops the
// leaves entirely, so the finder shows the most-recently-updated rows until a
// query is typed — which is the design's own default state.
const SEARCH_KEY = "search";
const searchOr = () => ({ op: "OR", groups: [
  { col: "name", op: "like", value: "", usePageFilters: true, searchParamKey: SEARCH_KEY },
  { col: "description", op: "like", value: "", usePageFilters: true, searchParamKey: SEARCH_KEY },
]});
// ⚠ THE `rebuilt` / `described` FACETS ARE NOT BUILT — measured 2026-08-19, twice.
// The design calls them "genuinely expressible" as unary `notempty` gap-filter leaves
// (reference_dms_gap_filters_url_toggles), and the predicate is; the CONTROL and its
// default-off state are not:
//   (a) `applyPageFilters` (buildUdaConfig.js:475) early-returns when the page-variable
//       map is EMPTY. A `usePageFilters` unary leaf is disabled by that pass and by
//       nothing else — so with no resolved page variables the leaf is emitted
//       ENABLED. Measured: the finder's count read **19** (rows carrying both a
//       page_path and a description) instead of the library's 1,645, i.e. a facet
//       nobody switched on had silently narrowed every finder section.
//   (b) A `notempty` column in a `Filter` section renders as a NUMBER INPUT
//       ("Please enter a number…"), not the needs-value toggle the chip wants.
// Both are logged in the task doc's Escalations with the smallest BC fix.
// A STATIC `notempty` leaf (no `usePageFilters`) is always emitted, so it is safe —
// it is only the page-variable-driven form that mis-defaults (see above). 71 of the
// snapshot's 1,645 rows have no `name` at all; a report with no name cannot be found
// by name, and 6 of them sorted to the top of the default list as blank cards.
const finderFilters = () => ({ op: "AND", groups: [{ col: "name", op: "notempty" }, searchOr()] });

// ── a template card ──────────────────────────────────────────────────────────
// The mockup's card is `flex gap-3 p-3.5`: a 1/4-width tile column on the left
// (plate over the difficulty chip) and a text column on the right (name /
// description / a bordered foot of counts + "use template →"). A cells grid at
// `cellsGridSize: 4` IS that shape — the tile is one track, the text spans three —
// and one grid shared by every card in the group is what makes the four foot rules
// line up, which four separate sections could never do.
//
//   ┌──────────┬──────────────────────────────┐
//   │ plate    │ difficulty          (span 3) │   rowsTemplate 'max-content'
//   │ (rowspan │ name                (span 3) │   rowsTemplate 'max-content'
//   │  4)      │ description         (span 3) │   rowsTemplate '1fr'  ← absorbs slack
//   │          ├──────────────────────────────┤
//   │          │ counts_label        (span 3) │   rowsTemplate 'max-content'
//   │          │        use template →(span 3)│   rowsTemplate 'max-content'
//   └──────────┴──────────────────────────────┘
//
// counts and the CTA take a row each rather than sharing one. The mockup's foot is
// `flex flex-wrap gap-y-0.5`, i.e. it ALREADY wraps to two lines at this column
// width; live they were two grid tracks of ~90px and ~45px, so both wrapped
// internally into 2- and 3-line stacks. One row each reproduces the mockup's own
// wrapped rendering and costs ~14px.
//
// The difficulty chip sits in the TEXT column, not under the plate as the mockup
// draws it. Measured 2026-08-19: the tile track is one of four `minmax(0,1fr)`
// tracks (~45px in a 3-col card), and `BEGINNER` at the design's 9.5px/0.18em is
// ~62px — the chip overflowed its track and collided with the counts beside it.
// patterns.html §14's own plate card puts the chip row at the top of the text
// column, so this is the design system's other drawn placement, not an invention.
//
// `cellsRowsTemplate` is the mockup's `flex-1` on the description: the row above the
// foot absorbs the card's leftover height, so the foot stays pinned to the bottom
// edge and every card in a row ends its rule at the same y.
const templateCells = () => ([
  // ESCALATION 1 — the preview plate. The stored thumbnails are 50x50px and the
  // layout-derived shape needs a new column type, so the tile renders patterns.html
  // §14's "no preview" state. The column is the plate's own track: swapping this
  // one cell for an image / shape cell is the whole change.
  stat("tpl_plate", "no preview", "plateEmpty", { cellSpan: 1, cellRowSpan: 5, justify: "center" }),
  // difficulty is beginner / intermediate / advanced on 9 of 12 rows and '' on the
  // other 3 — StatusPillView returns null for an empty value, which is exactly the
  // mockup's chip-less card (tpl 77 and tpl 278 draw no chip).
  { name: "difficulty", display_name: "difficulty", key: "difficulty", type: "status_pill",
    show: true, hideHeader: true, justify: "left", cellSpan: 3,
    pillColors: { beginner: "chip_meta", intermediate: "chip_meta", advanced: "chip_meta" } },
  col("name", "labelMD", { cellSpan: 3 }),
  col("description", "proseSMClamp2", { cellSpan: 3, wrapText: true }),
  col("counts_label", "metaXS", { cellSpan: 3, cellBorderTop: true }),
  // The card's link. A Card's link affordance is per cell, so the whole-card anchor
  // the mockup draws is not expressible (card-layout.md "A design row that is ONE
  // <a>") — logged. `page_path` is the working link column on 2208581.
  col("page_path", "metaXSLink", { cellSpan: 3, justify: "right",
    isLink: true, linkText: "use template →" }),
]);
// `cardStyle: 'tile'` is the design's own card shell, already in the theme:
// `rounded-[8px] border border-zinc-950/10 bg-white shadow-sm overflow-hidden
//  hover:border-[#37576B] transition-colors p-4 h-full` — byte-for-byte the mockup's
// template-card classes plus the hover accent. Two things it also fixes, both measured:
//  · `display.cardBorder` alone paints `border` with NO radius (the theme's
//    `subWrapperCompactView` is deliberately empty — "section chrome owns the card
//    shape"), so 12 square cards were rendering under a rounded design;
//  · the style zeroes `theme.value`, whose default `px-3 pb-3` was charging every one
//    of the card's 5 cell rows 12px of dead bottom padding (60px per card).
// Named styles inherit missing keys from styles[0] (useTheme.js getComponentTheme), so
// every token the cells name — plateEmpty, labelMD, proseSMClamp2, metaXSLink — still
// resolves. `cardsPadding: 0` because the tile's own `p-4` IS the card's inset.
const templateCard = (categoryTag, across) => card(REPORTS, templateCells(), {
  cardStyle: "tile",
  cardsGridSize: across, cardsGridGap: 16, cardBorder: false, cardsPadding: 0,
  cellsGridSize: 4, cellsGridGap: 4, cellsPadding: 0,
  cellsRowsTemplate: "max-content max-content 1fr max-content max-content",
  pageSize: 12, readyToLoad: true,
}, { op: "AND", groups: [{ col: "tags", op: "filter", value: [categoryTag] }] });

// The five category filters, VERBATIM from 2208581 (2208584/86/88/90/92).
const CAT = {
  before_after: "category:before_after",
  floating_car: "category:floating_car",
  events: "category:events",
  change_over_time: "category:change_over_time",
  behavioral: "category:behavioral",
};
const ALL_CATS = Object.values(CAT);

// ── § 02 · an illustrative "your reports" card ───────────────────────────────
// ILLUSTRATIVE, and built so it reads that way: the band head says so in the
// design's own words, and each card ends on the same mono annotation the mockup
// uses for its empty state. Nothing here is bound, because nothing can be — the
// three cards describe one signed-in user and no query can verify them
// (npmrds-reports.html header comment, "REAL CONTENT / ILLUSTRATIVE").
const mineCard = ({ state, when, title, prose, meta }) => lexical(
  layout("items-center grid-cols-1 md:grid-cols-[max-content_minmax(0,1fr)_max-content] gap-x-3", [
    litem(styled("chip", text(state))),
    litem(para(text(""))),
    litem(styled("metaXS", text(when))),
  ]),
  styled("displayXS", text(title)),
  styled("proseSM", text(prose)),
  styled("metaXS", text(meta)),
);

// ═════════════════════════════════════════════════════════════════════════════
// BANDS
// ═════════════════════════════════════════════════════════════════════════════
const B = {
  header: randomUUID(),
  tpl: randomUUID(),
  mine: randomUUID(),
  examples: randomUUID(),
  states: randomUUID(),
  footer: randomUUID(),
  modal: randomUUID(),
};
const GROUPS = [
  { name: B.header,   index: 0, theme: "header",       position: "content", displayName: "Header" },
  { name: B.tpl,      index: 1, theme: "content",      position: "content", displayName: "§01 Templates" },
  { name: B.mine,     index: 2, theme: "content_tint", position: "content", displayName: "§02 Your reports" },
  { name: B.examples, index: 3, theme: "content",      position: "content", displayName: "§03 Worked examples" },
  { name: B.states,   index: 4, theme: "content_tint", position: "content", displayName: "§04 The finder" },
  // A footer at position 'bottom' renders full-viewport-width OUTSIDE the layout and
  // would not line up with the sidenav-offset content column — so it is the last
  // CONTENT band wearing the `footer` layoutGroup style (§ 4.2).
  { name: B.footer,   index: 5, theme: "footer",       position: "content", displayName: "Footer" },
  // The find-a-report MODAL. `isModal` renders this band as a fixed overlay in VIEW
  // mode when the `find` ACTION param is published; in /edit it is ignored and the
  // band renders inline, which is how authors reach its sections
  // (modal-section-group.md). ⚠ The view-mode modal renders `item.sections` — the
  // PUBLISHED sections — so its overlay behaviour cannot be verified on a
  // draft-only page.
  { name: B.modal,    index: 6, theme: "content",      position: "content", displayName: "Find-a-report modal",
    isModal: true, modalParamKey: "find", modalSize: "4xl" },
];

// ═════════════════════════════════════════════════════════════════════════════
// SECTIONS — draft_sections order IS render order
// ═════════════════════════════════════════════════════════════════════════════
const SECTIONS = [

  // ══════════ HEADER ══════════
  // Revision 9 of the mockup fits the title, the search trigger, the freshness signal and
  // the two primary actions on ONE line (sizes 2 + 10). Live it is FIVE sections
  // (2 + 5 + 2 + 2 + 1), because each affordance binds something different — the trigger's
  // count binds `reports_snap_2`, the freshness signal binds ClickHouse NPMRDS, and the
  // create affordance is the `CreateReportButton` THEME COMPONENT, which is a section type,
  // not a Card cell. A 12-col grid also quantises to 95.3px steps and charges 24px of
  // gutter per internal boundary (96px across four), where the mockup's flex row charges
  // 12px; measured budget in P7, and it is why the freshness signal takes two lines live.
  { group: B.header, size: "2", padding: { left: "0" }, data: lexical(
    styled("displayMDCaps", text("Reports"), text(".", 0, GOLD)),
  )},

  // The modal TRIGGER. `find_label` carries the `click_publish` provider whose paramKey
  // equals the modal group's `modalParamKey`, so clicking it publishes the action param
  // that opens the dialog. The count beside it carries the finder's OWN filter tree, so a
  // cold load of `?search=bridge` shows the CLOSED trigger reporting the match count — the
  // design's stated consequence of action params never reaching the URL.
  //
  // P7, two measured changes. (1) The cells are STACKED (`cellsGridSize: 1`) rather than
  // side by side: at 1480 the prompt run is 426.7px and the match count 130px, and the
  // widest span the header can spare for the trigger is 4 columns = 357.3px of content, so
  // side-by-side wrapped the prompt onto a second line. (2) The prompt uses
  // `proseSMClamp1`, the additive one-line clamp that reproduces the mockup's own
  // `truncate` on this control — with it the trigger measures 38.8px against the mockup's
  // 40px. The five affordances do NOT fit one 12-col row at their content widths
  // (2 + 5 + 3 + 2 + 1 = 13 columns minimum); the freshness signal is the one that gives,
  // and takes two lines. Logged in the task doc's P7 as a deliberate non-fix.
  { group: B.header, size: "4", elementType: "Card", data: card(REPORTS, [
    stat("find_label", "Find a report — search by name, road, route or description", "proseSMClamp1"),
    // ESCALATION — the design's trigger also echoes the QUERY itself. No primitive
    // renders a page variable's value as text, so the trigger reports the count only.
    // `unitFontStyle` is load-bearing: `stat_value`'s built-in unit class is a RELATIVE
    // `text-[0.4em]`, which P7 measured rendering " reports" at 4.2px — illegible. Naming
    // the figure's own token makes figure and unit one uniform 11px mono run, which is how
    // the mockup draws this line. `stat_value` resolves BOTH against textSettings.
    calc("count(1) as find_matches", { type: "stat_value", unit: " reports", formatFn: "comma",
      valueFontStyle: "metaSM", unitFontStyle: "metaSM", hideHeader: true, justify: "left" }),
  ], {
    cellsGridSize: 1, cellsGridGap: 4, cellsPadding: 0, cardsPadding: 0,
    totalLength: 1, fetchMode: "smart",
    _functions: { providers: [{ functionId: "click_publish", enabled: true, paramKey: "find", args: { column: "find_label" } }] },
  }, finderFilters()) },

  // The freshness signal — `max(date)` on ClickHouse NPMRDS, a partition metadata read.
  // P7: `metaSM` (10.5px / slate-500), not `metaXS` (9.5px / slate-400) — the mockup draws
  // this line at 10px slate-500 with the month in ink. Its own section now, because the
  // create affordance below is a section and the mockup's reading order is
  // trigger → freshness → New report → New route.
  { group: B.header, size: "2", elementType: "Card", data: card(CH_NPMRDS, [
    calc("concat('complete through ', lower(formatDateTime(max(date), '%b %Y'))) as freshness",
      { valueFontStyle: "metaSM", hideHeader: true }),
  ], {
    cellsGridSize: 1, cellsPadding: 0, cardsPadding: 0,
    cellsContentVAlign: "center", totalLength: 1, fetchMode: "force",
  }) },

  // ══ THE CREATE AFFORDANCE — the real `CreateReportButton` theme component ══
  // Not a link and not a Card cell: the component skips PageTemplatePicker's generic
  // template modal and materialises the "Report Page" template (2187021) directly, then
  // redirects into the new report's own /edit route. It is a SECTION because a theme
  // pageComponent is an element type (`element-type: "CreateReportButton"`,
  // `element-data: "{}"`), the same way 2208581 carries it.
  //
  // It replaces the static "New report" link this build previously pointed at 2208581.
  // That indirection existed because core's `newPage()` derives the new page's parent from
  // `item.parent` and takes no override — and on THIS page `parent` is '', so a report
  // created here would have landed at the pattern root. The component now falls back to
  // the host page's own id when it has no parent ("if the page I'm on has no parent, I am
  // the folder"), which is byte-identical wherever `item.parent` is already set.
  //
  // `padding: { right: "2" }` makes the gutter to "New route" 8px — the mockup's own
  // `gap-2` on the action cluster (the default 12px + 0 would have been 12).
  { group: B.header, size: "2", padding: { right: "2" }, elementType: "CreateReportButton", data: "{}" },

  // `New route` is the mockup's own in-page anchor to the § 01 routes CTA (the CTA's own
  // button is drawn with no href and no standalone route-builder page exists — logged).
  // Its own section now that the create affordance sits beside it; both horizontal
  // paddings are zeroed so the pair reads as one cluster flush to the band's right edge.
  // TWO columns, not one: `btnOutline` is `px-3.5!` either side of a 69.3px label = 97.3px,
  // and a 1-column cell is 95.33px — measured, the button wrapped to "NEW / ROUTE".
  { group: B.header, size: "2", padding: { left: "0", right: "0" }, elementType: "Card", data: card(REPORTS, [
    // `justify: "left"`, not right: the mockup's action cluster is `gap-2` (8px) between the
    // two buttons, and with the cell right-justified the button sat at 1350.7 against the
    // create button's right edge at 1213.7 — a 137px hole inside a pair the mockup draws
    // 8px apart. Left-justified the gap IS 8px (create's `pr-2` + this cell's zeroed left).
    // The trade: the pair ends 93px short of the band's right edge, where the mockup has it
    // flush. Closing that would need `theme.createReportButton.wrapper` to right-align, and
    // that key is GLOBAL — it would also move 2208581's button. Logged in P7.
    stat("new_route", "New route", "btnOutline", { justify: "left", isLink: true, location: "#routes", searchParams: "none" }),
  ], {
    cellsGridSize: 1, cellsPadding: 0, cardsPadding: 0,
    cellsContentVAlign: "center", totalLength: 1, fetchMode: "force",
  }) },

  // ══════════ § 01 · TEMPLATES ══════════
  // The page's first and primary band (revision 2). The head carries the numeral,
  // the count, the title and — factored up out of 8 of the 12 stored descriptions —
  // the one closing instruction that is how templates work rather than what a
  // template does. It is a Card so the "12 templates" figure is bound, not typed.
  //
  // The plate LEGEND the mockup draws beside this head (map / bar / line / grid /
  // table swatches) is deliberately NOT built: it documents the preview plate, and
  // the plate is escalation 1. It comes back with the plate.
  { group: B.tpl, size: "12", anchorId: "templates", elementType: "Card", data: card(REPORTS, [
    stat("hd_kicker", "// 01", "kicker"),
    // `unitFontStyle` — see the header trigger: without it `stat_value`'s relative
    // `text-[0.4em]` unit class rendered " templates" at 4.2px (P7).
    calc("count(1) as tpl_count", { type: "stat_value", unit: " templates", formatFn: "comma",
      valueFontStyle: "metaSM", unitFontStyle: "metaSM", hideHeader: true }),
    stat("hd_types", "· 5 question types", "metaSM"),
    stat("hd_title", "Start from a question, not a blank page.", "displaySM", { cellSpan: 3 }),
    stat("hd_prose", "Every template arrives pre-wired with the graphs that answer one question — you supply the route and the dates. Date ranges stay editable afterwards: open a route in the report's Routes panel, set the period, then Update.", "proseSMInk", { cellSpan: 3 }),
  ], {
    cellsGridSize: 3, cellsGridGap: 4, cellsPadding: 0, cardsPadding: 0,
    cellsTracksTemplate: "minmax(0,max-content) minmax(0,max-content) minmax(0,1fr)",
    totalLength: 1, fetchMode: "force",
  }, { op: "AND", groups: [{ col: "tags", op: "filter", value: ALL_CATS }] }) },

  // Row 1 — three group HEADS at 3 + 6 + 3, then row 2 — their three Cards at the
  // same spans, so each head sits directly above its own group.
  { group: B.tpl, size: "3", padding: { top: "0", bottom: "0" }, data: groupHead("01", "Before & after") },
  { group: B.tpl, size: "6", padding: { top: "0", bottom: "0" }, data: groupHead("02", "Floating car") },
  { group: B.tpl, size: "3", padding: { top: "0", bottom: "0" }, data: groupHead("03", "Events") },

  { group: B.tpl, size: "3", height: "fill", padding: { top: "2" }, elementType: "Card", data: templateCard(CAT.before_after, 1) },
  { group: B.tpl, size: "6", height: "fill", padding: { top: "2" }, elementType: "Card", data: templateCard(CAT.floating_car, 2) },
  { group: B.tpl, size: "3", height: "fill", padding: { top: "2" }, elementType: "Card", data: templateCard(CAT.events, 1) },

  { group: B.tpl, size: "12", padding: { top: "0", bottom: "0" }, data: groupHead("04", "Change over time") },
  { group: B.tpl, size: "12", padding: { top: "2" }, elementType: "Card", data: templateCard(CAT.change_over_time, 4) },

  { group: B.tpl, size: "12", padding: { top: "0", bottom: "0" }, data: groupHead("05", "Behavioral") },
  { group: B.tpl, size: "12", padding: { top: "2" }, elementType: "Card", data: templateCard(CAT.behavioral, 4) },

  // The routes CTA. `32,569 saved` is bound — the catalogue is ~2x duplicated on its
  // own key, so the calc is `count(distinct …)`; an isDms calc column must contain
  // NO COMMAS. The mockup's `· 34 yours` half is NOT built: `mine` needs a
  // `$currentUser` value sentinel (task doc escalation 2). The mockup's "New route"
  // button has no href and no standalone route-builder page exists — also logged.
  { group: B.tpl, size: "12", anchorId: "routes", border: "full", elementType: "Card", data: card(ROUTES, [
    lexCell("rt_head", [styled("displayXS", icon("Road"), text(" No route yet? Build one first."))]),
    { name: "count(distinct data->>'route_id') as saved_routes", origin: "calculated-column",
      fn: "exempt", type: "stat_value", unit: " saved", formatFn: "comma", show: true,
      hideHeader: true, justify: "right", valueFontStyle: "metaSM", unitFontStyle: "metaSM",
      cellPadding: 0 },
    stat("rt_prose", "Every template above needs at least one route. Click the TMC segments on the map in road order, or search a TMC and add it directly. Give it a descriptive name — direction included — because that name is what search matches on later.", "proseSMInk", { cellSpan: 2 }),
  ], {
    cellsGridSize: 2, cellsGridGap: 6, cellsPadding: 0, cardsPadding: 8,
    cellsTracksTemplate: "minmax(0,1fr) minmax(0,max-content)",
    totalLength: 1, fetchMode: "force",
  }) },

  // ══════════ § 02 · YOUR REPORTS — ILLUSTRATIVE ══════════
  { group: B.mine, size: "12", anchorId: "your-reports", data: lexical(
    layout("items-center grid-cols-1 md:grid-cols-[max-content_max-content_minmax(0,1fr)] gap-x-3", [
      litem(styled("kickerSM", text("// 02"))),
      litem(styled("chip", text("illustrative"))),
      litem(styled("metaSM", text("owned by you · 7 reports · 34 routes"))),
    ]),
    styled("displaySM", text("Pick up where you left off.")),
    styled("metaXS", text("illustrative · describes one signed-in user · no query can verify it")),
  )},

  { group: B.mine, size: "4", border: "full", height: "fill", data: mineCard({
    state: "draft", when: "2 days ago",
    title: "US-44/NY-55 Westbound Road Diet Impact Assessment",
    prose: "Garden St, City of Poughkeepsie. Two-lane conversion; comparing spring 2025 to spring 2026 on the westbound arterial.",
    meta: "2 routes · 6 graphs · region 8",
  })},
  { group: B.mine, size: "4", border: "full", height: "fill", data: mineCard({
    state: "published", when: "5 days ago",
    title: "NY-9D Beacon Signal Study — Travel Time Comparison",
    prose: "Signal retiming on NY-9D through Beacon. Northbound and southbound, before against after, hourly bins.",
    meta: "4 routes · 3 graphs · region 8",
  })},
  { group: B.mine, size: "4", border: "full", height: "fill", data: mineCard({
    state: "published", when: "3 weeks ago",
    title: "Route 44 Incident Analysis · April 2026",
    prose: "Every reported closure on NY-44 in April, queue length and clearance time against the TRANSCOM log.",
    meta: "1 route · 5 graphs · region 8",
  })},

  // The empty-state variant — what a first-time user sees instead of the three cards
  // above. The mockup draws a DASHED border; the section border presets are solid,
  // so the state is carried by the annotation line the mockup already writes.
  { group: B.mine, size: "12", border: "full", data: lexical(
    styled("displayXS", text("You haven't built a report yet")),
    styled("proseSM", text("Start from a template above — it comes pre-wired with the graphs that answer a specific question — or build a route first and add graphs yourself.")),
    layout("items-center grid-cols-1 md:grid-cols-[max-content_max-content_minmax(0,1fr)] gap-x-3", [
      litem(styled("buttonRow", button("Start from a template", "#templates", "default"))),
      litem(styled("buttonRow", button("Build a route", "#routes", "secondary"))),
      litem(styled("metaXS", text("empty state · shown when the owner has no reports"))),
    ]),
  )},

  // ══════════ § 03 · WORKED EXAMPLES ══════════
  { group: B.examples, size: "12", anchorId: "examples", data: lexical(
    layout("items-center grid-cols-1 md:grid-cols-[max-content_minmax(0,1fr)] gap-x-3", [
      litem(styled("kickerSM", text("// 03"))),
      litem(styled("metaSM", text("maintained by avail · rebuilt on the new platform"))),
    ]),
    styled("displaySM", text("Worked examples worth reading first.")),
    styled("proseSM", text("Finished reports on real routes, not empty templates — what the graphs look like once a corridor and a date range are in them.")),
  )},

  // ESCALATION 2 — the band's four subjects are gone. Verified 2026-08-19: `dms page
  // list --pattern npmrds_sub` returns 43 pages and none of 2194949 / 2192364 /
  // 2192451 / 2191095; `raw get` on each returns an empty row. `reports_snap_2` now
  // records a `page_path` for 14 rows only — the 12 templates (§ 01 already links
  // them) plus two `Claude Scratch …` rows whose pages are also deleted. Shipping the
  // four drawn cards would ship four dead links, so the band states the gap instead.
  { group: B.examples, size: "12", border: "full", data: lexical(
    styled("displayXS", text("No worked example is rebuilt on the new platform yet")),
    styled("proseSM", text("This band lists finished reports on real routes — the four the design names (Tappan Zee Cashless Toll, Year Over Year, Rochester Inner Loop, Buffalo Skyway) were converted pages under this parent and no longer exist. The twelve templates in § 01 are the converted pages that do; a worked example is a template with a corridor and a date range already in it.")),
    styled("metaXS", text("blocked on content · re-convert three or four legacy reports as child pages and re-run the builder")),
  )},

  // ══════════ § 04 · THE FINDER ══════════
  { group: B.states, size: "12", data: lexical(
    layout("items-center grid-cols-1 md:grid-cols-[max-content_minmax(0,1fr)] gap-x-3", [
      litem(styled("kickerSM", text("// 04"))),
      litem(styled("metaSM", text("live component · documented as patterns.html §11 · modal variant"))),
    ]),
    styled("displaySM", text("The search dialog, working.")),
    styled("proseSM", text("The query lives in the URL — ?search=bridge — so a result set still travels in an email. Only the open flag is in-memory, which is why a shared link arrives with the query live and the dialog shut.")),
  )},

  // The mockup's five state-driver buttons exist because the mockup's dialog is drawn
  // JS; live there is one real affordance — open the finder — and the three columns
  // of copy that say what is wired, what is not, and what a build must know.
  { group: B.states, size: "12", border: "full", elementType: "Card", data: card(REPORTS, [
    stat("sd_label", "reach a state", "metaXS", { cellSpan: 2 }),
    stat("sd_open", "Open the finder", "btnPrimary", { justify: "right" }),
    stat("sd_wired_h", "what is wired", "metaXS"),
    stat("sd_inert_h", "what is drawn but inert", "metaXS"),
    stat("sd_know_h", "what a build must know", "metaXS"),
    stat("sd_wired", "The query — an OR group of like leaves over name + description, URL-bound as ?search= — and the closed trigger's match count, which is the same filter tree counted.", "proseSMInk"),
    stat("sd_inert", "mine — not expressible today; nothing injects the current user into a filter value. rebuilt · described — the predicate is a notempty leaf, but a default-off gap filter needs a fix in applyPageFilters and the control renders as a number input. region · measure · year · folder — the legacy table has no such columns.", "proseSMInk"),
    stat("sd_know", "Action params never reach the URL, so a shared link arrives with the query live and the dialog shut — the closed trigger reports it. And a modal only behaves as a modal on a published page; in edit mode the group renders inline, which is how authors reach it.", "proseSMInk"),
  ], {
    cellsGridSize: 3, cellsGridGap: 10, cellsPadding: 0, cardsPadding: 10,
    totalLength: 1, fetchMode: "force",
    _functions: { providers: [{ functionId: "click_publish", enabled: true, paramKey: "find", args: { column: "sd_open" } }] },
  }) },

  // ══════════ FOOTER ══════════
  // The `footer` layoutGroup already carries the band's py-4, so the section's own
  // gutter is zeroed — otherwise the one-line footer measured 98px against the
  // mockup's 51.
  // P7, two changes. (1) `linkMonoRow`, not `plain`: `plain` is a 13px Proxima chrome button on
  // a fixed `h-9`, where the mockup's footer links are `font-mono text-[10.5px] uppercase
  // tracking-[0.16em] text-slate-500` with no chrome and no fixed height — that fixed height is
  // what cost the footer band +23px (74 live vs 51). (2) The links stay INLINE SIBLINGS in ONE
  // paragraph, which is the only primitive that flows and wraps the way the mockup's
  // `flex flex-wrap gap-x-6` does — one link per layout-container ITEM was tried and cost
  // +65.9px at 390, because a grid cannot reflow. `linkMonoRow` is `linkMono` plus `mr-6
  // last:mr-0`, i.e. the mockup's own 24px gutter, carried by the button because a lexical
  // button node has no margin knob (six bare `linkMono`s rendered as one run of glued words).
  { group: B.footer, size: "12", padding: { top: "0", bottom: "0" }, data: lexical(
    layout("w-full !mt-0 !mb-0 items-center grid-cols-1 md:grid-cols-[minmax(0,max-content)_minmax(0,1fr)_minmax(0,max-content)]", [
      litem(para(
        button("home", L.home, "linkMonoRow"),
        button("macro-view", L.macro, "linkMonoRow"),
        button("report", L.reportIndex, "linkMonoRow"),
        button("route-comparison", L.comparison, "linkMonoRow"),
        button("map-21", L.map21, "linkMonoRow"),
        button("docs", L.docOverview, "linkMonoRow"),
      )),
      litem(para(text(""))),
      // P7: `metaMD` (12px mono, proper case, slate-600), not `metaXS` (10px UPPERCASE
      // 0.18em slate-400) — the mockup's copyright line is `font-mono text-[12px]
      // text-slate-500`, i.e. not a meta LABEL and not uppercased.
      litem(styled("metaMD", text("© NYSDOT · TransportNY DMS v0.2"))),
    ]),
  )},

  // ══════════ THE FIND-A-REPORT MODAL ══════════
  // Section 1 — the search control. `operation: 'like'` is what renders a TEXT BOX
  // instead of a value picker; `searchParamKey` is the page variable every consuming
  // leaf matches on. Registered on the page's `filters` array below or nothing moves.
  { group: B.modal, size: "12", elementType: "Filter", data: JSON.stringify({
    externalSource: REPORTS,
    columns: [{
      name: "name", customName: "Search by name, road, route or description", type: "select", show: true,
      filters: [{ type: "external", operation: "like", values: [], isMulti: false,
        usePageFilters: true, searchParamKey: SEARCH_KEY, display: "" }],
    }],
    filters: { op: "AND", groups: [] },
    display: { totalLength: 1, readyToLoad: true, hideExternalToggle: true, showAttribution: false, fetchMode: "smart" },
    data: [], join: { sources: {} },
  })},

  // Section 2 — the result list. NO PAGINATION, by design: the finder shows the top
  // matches and links out; a paginated walk of the whole library is a separate page.
  { group: B.modal, size: "12", elementType: "Card", data: card(REPORTS, [
    // Sorting on raw `updated_at` desc put NULLs FIRST (Postgres' default for DESC) —
    // 171 rows have none — and two rows store a serialised weekday object in the
    // field. This sort key keeps only values that start with a 4-digit year and
    // sends everything else to the bottom, so the finder's default really is the
    // most recently updated report. Comma-free, per the isDms calc rule.
    rowCalc("case when (data->>'updated_at') ~ '^[0-9]{4}-' then (data->>'updated_at') else '' end as upd_sort",
      { normalName: "upd_sort", selectOnly: true, sort: "desc" }),
    col("name", "labelMD", { cellSpan: 3 }),
    col("updated_at", "metaXS", { cellSpan: 1, justify: "right" }),
    // Row 2 is 2 + 1 + 1 = the full 4 tracks, so the three cells' shared
    // `cellBorderBottom` reads as ONE divider under the row — the design's `divide-y`.
    // A cell border only spans its own tracks, so a row that does not cover every
    // track draws a stub rule instead of a divider.
    col("description", "proseSMClamp2", { cellSpan: 2, wrapText: true, cellBorderBottom: true }),
    // Only 14 of the library's 1,645 rows are rebuilt as a DMS page. An isLink cell
    // ALWAYS renders its anchor and the href is `location || value`, so binding
    // `page_path` straight through emitted `…/undefined` on every legacy row — a dead
    // link per row. These two calcs are the fix: the anchor's value (and therefore
    // both its href AND its text — no `linkText`) is '' when there is no page, so the
    // cell renders nothing at all, and the state cell beside it says why.
    // ⚠ a calc's string literals must not contain " as " either — the alias parser
    //   splits on the LAST occurrence, so `else 'rebuilt as a page' end as
    //   rebuilt_state` came back keyed on the expression with the alias eaten and the
    //   cell rendered empty (measured 2026-08-19). Same class of bug as the comma
    //   rule; keep calc literals free of both.
    rowCalc("case when (data->>'page_path') is null or (data->>'page_path') = '' then 'legacy · not rebuilt' else 'rebuilt' end as rebuilt_state",
      { normalName: "rebuilt_state", valueFontStyle: "metaXS", hideHeader: true, cellSpan: 1, cellBorderBottom: true }),
    rowCalc("case when (data->>'page_path') is null or (data->>'page_path') = '' then '' else (data->>'page_path') end as open_path",
      { normalName: "open_path", valueFontStyle: "metaXSLink", hideHeader: true, cellSpan: 1, justify: "right", isLink: true, cellBorderBottom: true }),
  ], {
    // `rowaligned` zeroes the value cell's vertical padding (`value: 'px-3'`), which was
    // charging each result row 24px of dead space across its two cell rows.
    cardStyle: "rowaligned",
    cardsGridSize: 1, cardsGridGap: 0, cardBorder: false, cardsPadding: 8,
    cellsGridSize: 4, cellsGridGap: 8, cellsRowGap: 2, cellsPadding: 0, cellBorder: false,
    pageSize: 8, usePagination: false, readyToLoad: true, fetchMode: "smart",
  }, finderFilters()) },

  // Section 3 — the foot: how many matched, and the note the design insists on.
  { group: B.modal, size: "12", elementType: "Card", data: card(REPORTS, [
    calc("count(1) as find_total", { type: "stat_value", unit: " match", formatFn: "comma",
      valueFontStyle: "metaSM", hideHeader: true }),
    stat("foot_note", "showing the top 8 · narrow with the search box", "metaXS"),
    stat("foot_url", "the query stays in the url", "metaXS", { justify: "right" }),
  ], {
    cellsGridSize: 3, cellsGridGap: 8, cellsPadding: 0, cardsPadding: 8,
    cellsTracksTemplate: "minmax(0,max-content) minmax(0,1fr) minmax(0,max-content)",
    cellsContentVAlign: "center", totalLength: 1, fetchMode: "smart",
  }, finderFilters()) },
];

// The page-variable registry (creating-interactive-pages.md step 0). A key that is
// not here can never become a page variable — the control's value never reaches the
// URL and no section reacts.
const PAGE_FILTERS = [
  { id: "npmrds-reports-search", values: "", searchKey: SEARCH_KEY, useSearchParams: true },
];

// ── P7 · BAND-EDGE GUTTERS ───────────────────────────────────────────────────
// On a gap-0 band grid the section wrapper's padding IS the gutter (this theme's
// sectionArray: `container: "… grid-cols-12 gap-0"`, `defaultPaddingStep: "3"`), so the
// 12px-per-side default also insets the FIRST and LAST section of every row. Measured at
// 1480 (P7, 2026-08-20): every full-width section's content box was 1120px wide inside
// the band's own 1144px content column, and § 01's card row ran x 316..1436 against the
// mockup's 304..1448 — 24px of the design's column spent on padding the mockup does not
// have. (Between NEIGHBOURS the live 12px+12px pair already reproduces the mockup's 24px
// grid gap exactly, which is why only the outer side is wrong.) Zeroing the outer side of
// each row's first/last section restores the mockup's column and leaves every internal
// gutter at 24px.
//
// Applied as a PASS rather than 20 hand-written `padding` keys so a later size change
// cannot silently leave a row edge padded — the rows are derived from the sizes.
// The modal band is excluded: it renders as a fixed 896px overlay, not in the band grid.
{
  const GRID = 12;
  let i = 0;
  while (i < SECTIONS.length) {
    const gid = SECTIONS[i].group;
    const band = [];
    while (i < SECTIONS.length && SECTIONS[i].group === gid) band.push(SECTIONS[i++]);
    if (gid === B.modal) continue;
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
// offline guard — a lexical CELL's staticValue must be a BARE {root:…} document.
SECTIONS.forEach((s, i) => {
  if (s.elementType !== "Card") return;
  for (const c of (JSON.parse(s.data).columns || [])) {
    if (c.type !== "lexical") continue;
    let doc = null;
    try { doc = JSON.parse(c.staticValue); } catch { /* handled below */ }
    if (!doc?.root?.children?.length)
      throw new Error(`SECTIONS[${i}] column "${c.name}": lexical cell staticValue is not a {root:…} document`);
  }
});
// offline guard — an isDms calculated column must contain NO COMMAS: the SELECT list
// is comma-split, so one comma inside an expression silently truncates the query
// (reference_dms_calc_column_no_commas).
SECTIONS.forEach((s, i) => {
  if (s.elementType !== "Card") return;
  const ed = JSON.parse(s.data);
  if (!ed.externalSource?.isDms) return;
  for (const c of (ed.columns || [])) {
    if (c.origin !== "calculated-column") continue;
    if (c.name.includes(","))
      throw new Error(`SECTIONS[${i}] calc column contains a comma on an isDms source: ${c.name}`);
  }
});

// Offline inspection escape: `SECTIONS_DUMP=<index> node …` prints one section's
// element-data and exits WITHOUT touching the live page.
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
// 0 · find-or-create the page BY SLUG, then work by PAGE ID only
const pages = lastJson(cli("page", "list", "--pattern", PATTERN)).items || [];
let page = pages.find(p => (p.data || p).url_slug === SLUG);
if (!page) {
  const maxIndex = pages.reduce((m, p) => Math.max(m, Number((p.data || p).index) || 0), 0);
  const created = lastJson(cli("page", "create", "--pattern", PATTERN, "--title", TITLE, "--slug", SLUG));
  const id = created.id || created.data?.id;
  cli("page", "update", String(id), "--data", tmp("page.json", { index: maxIndex + 1 }));
  page = { id };
  console.log(`created page ${id} (slug ${SLUG}, index ${maxIndex + 1})`);
}
const PAGE = String(page.id);
console.log(`page: ${PAGE} (${PATTERN}/${SLUG}) on ${ENV.DMS_HOST} ${ENV.DMS_APP}/${ENV.DMS_TYPE}`);

// 0b · publish-state notice. This builder only ever writes the DRAFT pair, and a UI
//      publish COPIES draft rows into FRESH `sections` rows (editFunctions.jsx does
//      `delete draft.id` before saving), so a rebuild can neither corrupt the live
//      page nor orphan its rows. It does mean live and draft have diverged until
//      someone publishes again — worth saying out loud rather than refusing, because
//      2188366 was published from the admin UI on 2026-08-19 mid-build.
{
  const row = jget(PAGE).data;
  if (row.published !== "draft") {
    console.log(
      `NOTE: ${PATTERN}/${SLUG} is PUBLISHED (published=${JSON.stringify(row.published)}, ` +
      `${(row.sections || []).length} live sections). This run rewrites the DRAFT only — ` +
      `the live page keeps its current content until someone publishes again.`);
  }
}

// 1 · runtime parity guard — never wipe live authoring away silently
const existing = jget(PAGE).data.draft_sections || [];
if (existing.length && existing.length !== SECTIONS.length && process.env.ALLOW_SECTION_COUNT_CHANGE !== "1") {
  console.error(
    `\nREFUSING TO WIPE ${PATTERN}/${SLUG} (page ${PAGE}): the live draft has ${existing.length} ` +
    `sections but this builder carries ${SECTIONS.length}.\n` +
    `Someone has authored the live page since this script was last run, or the script has drifted.\n` +
    `Diff first:\n` +
    `  node src/themes/transportny/qa_skills/tools/page_to_build.mjs --pattern ${PATTERN} --slug ${SLUG} --out /tmp/live_reports.mjs\n` +
    `Then re-run with ALLOW_SECTION_COUNT_CHANGE=1 once the change is intentional.\n`);
  process.exit(1);
}

// 2 · wipe by PAGE ID (never by slug — a slug-addressed delete silently no-ops and
//     every rebuild doubles the sections). Clear the list first so a failed row
//     delete can never leave a phantom ref behind.
cli("page", "update", PAGE, "--data", tmp("wipe.json", { draft_sections: [] }));
let deleted = 0, failed = 0;
for (const e of existing) {
  try { cli("section", "delete", String(e.id), "--page", PAGE, "--pattern", PATTERN); deleted++; }
  catch (err) { failed++; console.log(`  orphaned (delete failed, no longer referenced): ${e.id} — ${String(err).split("\n")[0].slice(0, 110)}`); }
}
console.log(`wiped ${existing.length} draft sections (${deleted} deleted, ${failed} orphaned)`);

// 3 · bands — draft ONLY. Writing `section_groups` would orphan published sections.
cli("raw", "update", PAGE, "--data", tmp("groups.json", { draft_section_groups: GROUPS }));
console.log("bands:", GROUPS.map(g => `${g.index}:${g.displayName}`).join(" · "));

// 4 · page-level fields. ⚠ NOT draft/published split — these go live immediately.
//     `sidebar: ""` drops the left rail the page shipped with (the design has none).
//     `filters` is the page-variable registry the search modal depends on.
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
