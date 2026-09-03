// ─────────────────────────────────────────────────────────────────────────────
// Build the NPMRDS REPORTS page — pattern `npmrds_sub` (2100394), slug `reports`
// (page 2188366 — `converted_reports` until the owner renamed it in the admin UI on
// 2026-09-02, which re-slugged its 48 children to `reports/…` too), on npmrdsv5 / dev2 —
// from the converged mockup
//   src/themes/transportny/TransportNY Design System/dms_design_system_v2/pages/npmrds-reports.html
//   (REVISION 3, 2026-09-02 — the page is the templates band and nothing below it: a
//    header row of title · view toggle · search bar · New report · New route, § 01
//    templates, and the footer. § 02 "Your reports", § 03 "Worked examples", § 04 "The
//    finder", the § 01 route CTA, the header's freshness card AND the find-a-report
//    modal section group are gone — the last at the owner's request the same day, once
//    the header's search bar (ReportPickerModal) had made the section-group dialog
//    unreachable.)
// Task: planning/transportny/tasks/current/npmrds-reports-page-rev3.md
//   (revision 2's build, its P6/P7 measurements and its escalations:
//    planning/transportny/tasks/current/npmrds-reports-page-build.md)
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
//    ⚠ a matching COUNT is not parity — diff CONTENT first (re-export with
//    ../page_to_build.mjs and compare; see the task file's "drift capture" note for
//    the 2026-09-02 case, where live had 30 == 30 and 27 sections differed);
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
// PAGE-LEVEL WRITES THAT ARE NOT DRAFT/PUBLISH SPLIT (they go live immediately; both
// are re-written to the values the page already carries, so a re-run is a no-op):
//  · `sidebar` — set to "" (the design has no rail; the page shipped `left`).
//  · `filters` — the page-variable registry for `search` (creating-interactive-pages.md
//    step 0). Still load-bearing with no Filter section left on the page: the header's
//    ChooseReportButton reads `?search=` off pageState.filters, so a shared
//    `?search=bridge` link still arrives with the query reported on the closed trigger.
//
// LAYOUT (the mockup's bands → DMS primitives)
//  · 3 bands: header / §01 templates / footer.
//  · Header: title (2) · view toggle Card (2) · ChooseReportButton search bar (5) ·
//    CreateReportButton (2) · New route Card (1) = 12 — the owner widened the search bar
//    and narrowed New route by hand on 2026-09-03; adopted here. The HEADER block below
//    carries the measured width budget.
//  · § 01 is revision 2's, unchanged except for the dropped route CTA: the mockup's
//    three narrow template groups (before-after 3 · floating-car 6 · events 3) each
//    draw their sub-head INSIDE the group box. A Card's static cells repeat per record,
//    so a shared group head is not a cell. They are built as SIBLING sections instead:
//    three heads on one row (3+6+3) over three Cards on the next (3+6+3) — the columns
//    line up, nothing nests, and contract item 10 still holds.
//  · The two wide groups (change-over-time 4 cards · behavioral 4 cards) are a
//    full-width lexical head over ONE Card at `cardsGridSize: 4`.
//  · So the shelf is FIVE Cards — the same five that 2208581 already binds — each
//    filtered on `tags`, re-housed in the designed layout. Twelve template cards.
//
// DATA (all figures are bound; see the task doc's data contract)
//  · templates — DMS-internal `reports_snap_2` 2177438 / view
//    2177440, `env: npmrdsv5+reports_snap_2`, `srcEnv: npmrdsv5+datasets`, isDms. The
//    five category filters are lifted VERBATIM from 2208581's five Cards.
//  · the search bar's "search N" and "N matches" — bound by the ChooseReportButton
//    component itself (components/ChooseReportButton/useReportCatalogCount.js, a UDA
//    length request on the same source with the picker's own filter tree). The mockup's
//    literal 869 is the legacy admin2.reports library and is NOT typed anywhere here.
//  · No ClickHouse binding remains on this page — the freshness card went with rev 3.
//
// NOT BUILT / DEVIATIONS — every one is logged in the task doc's notes:
//  1. The preview plate (carried from revision 2). The stored `thumbnail`s are 50x50px;
//     the layout-derived shape needs a new column type. The cards keep the design's
//     1/4-width tile column and render patterns.html §14's "no preview" tile, so a
//     plate cell is a one-column swap later.
//  2. The whole-card anchor. A Card's link affordance is per-cell; the card's link
//     is its `page_path` cell.
//  3. The mockup's header row WRAPS below ~1300. A band grid cannot, so the search bar
//     (the row's flexible member) narrows and truncates its prompt instead
//     (ChooseReportButton.theme.js, `min-w-0`).
//  4. New route draws no Road icon — a link cell cannot be a lexical cell — and the
//     action pair ends short of the band's right edge (right-aligning would need the
//     GLOBAL createReportButton.wrapper key; rev-2 P7 note).
//  5. "All reports" is INERT until the list page is built (decision D2).
//  6. (RESOLVED 2026-09-02) The find-a-report MODAL GROUP that revision 2 built — a
//     Filter + result Card + foot Card behind `isModal`/`modalParamKey: 'find'` — is
//     removed at the owner's request: nothing on the page published its action param
//     once the header's search bar opened ReportPickerModal instead, and in /edit it
//     rendered inline as three dead sections under the footer.
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
const SLUG = "reports"; // renamed 2026-09-02 from "converted_reports" (owner, admin UI) — see rename-converted-reports-url-to-reports.md
const TITLE = "Converted Reports";
// The page this builder owns. Pinned (feedback_stale_builders_check_before_rerun: a find-or-create
// on a truncated `page list` minted a duplicate congestion page once) — the slug lookup below must
// resolve to THIS id or the run refuses; it never creates a second "converted_reports".
const PAGE_ID = "2188366";

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
const styled = (styleKey, ...children) => ({ type: "styled-paragraph", version: 1, direction: "ltr", format: "", indent: 0, textFormat: 0, textStyle: "", styleKey, children });
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

// ── live link targets (verified against `dms page list --pattern npmrds_sub` 2026-08-19;
//    routeCreation added and re-verified 2026-09-02 — page 2216258 "Route Creation", published) ──
const L = {
  home: "/home",
  macro: "/macro",
  // this page (slug renamed 2026-09-02, see rename-converted-reports-url-to-reports.md). The
  // old "report index" child 2208581 (`converted_reports/reports`, the AVAIL-curated grid / v0.1
  // landing page) was destroyed the same day, so the footer's "report" link points here; the
  // `reportIndex` key that used to name it is gone with the lexical footer that consumed it.
  reports: "/reports",
  routeCreation: "/route_creation",
  map21: "/map_21",
  docOverview: "/docs/npmrds/overview",
};

// ── the group head (numeral · name · rule), one per template category ───────
// The mockup draws a hairline rule filling the rest of the head's line
// (`flex-1 h-px bg-zinc-950/10`). A lexical RUN cannot draw a rule that stops at its own
// line, but a layout-container COLUMN can (Alex, 2026-09-03: "use columns in these lexical
// components"): the third item is an empty paragraph styled `hairline` (a 1px
// `bg-zinc-950/10` block, additive themev2 token) in a `minmax(0,1fr)` column, so it takes
// the rest of the line; `items-center` puts it on the head's midline like the mockup's.
// `!mt-0 !mb-0` is load-bearing: a layout-container ships the Lexical paragraph's own
// vertical margin, and on a ONE-LINE head that margin is most of the section's height
// (measured 74.4px live against the mockup's 24px row before this).
const groupHead = (num, name) => lexical(
  layout("w-full !mt-0 !mb-0 items-center grid-cols-1 md:grid-cols-[max-content_max-content_minmax(0,1fr)] gap-x-3", [
    // `kickerSM`, not `kicker`: P7 measured the lexical `kicker` at 11px on a 22.4px line
    // box against the mockup's 10.5px/15.75px, because `kicker` declares no leading and the
    // richtext wrapper's ABSOLUTE `leading-[22.4px]` inherits into it. `kickerSM` carries
    // the mockup's own numeral class (10.5px / leading-[1.5] / 0.2em / #CA8A04).
    litem(styled("kickerSM", text(num))),
    litem(styled("labelMD", text(name))),
    litem(styled("hairline", text(""))),
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
// A `selectOnly` aggregate that makes an ALL-STATIC card's request legitimate and renders
// no cell: a card whose columns are every one `origin:'static'` still fires a query, with
// an EMPTY attribute list, and the server errors (card-layout.md "An all-static card still
// fires a query — seed it"; build_npmrds_home.mjs uses the same idiom).
const SEED = name => calc(`count(1) as ${name}`, { selectOnly: true, hideHeader: true });
// `origin:'static'` + `type:'lexical'` — the read-only richtext cell, for chrome that needs
// mixed runs (the title's ink word + gold period). ⚠ A lexical cell cannot be a link.
const lexCell = (name, nodes, extra = {}) =>
  ({ name, origin: "static", type: "lexical", staticValue: lexDoc(...nodes),
     show: true, hideHeader: true, justify: "left", cellPadding: 0, ...extra });
// A bound column cell.
const col = (name, valueFontStyle, extra = {}) =>
  ({ name, display_name: name, key: name, type: "text", formatFn: " ",
     show: true, hideHeader: true, justify: "left", valueFontStyle, ...extra });

// ── the SEARCH page variable ─────────────────────────────────────────────────
// The key the page registers in PAGE_FILTERS below and the header's ChooseReportButton
// reads (full-text-search-filter.md). Revision 2's `like` OR-group builders and the
// `notempty` facet notes lived here; they went with the modal group (see the task file's
// predecessor for the measured gotchas — a `usePageFilters` unary leaf defaults ON, and a
// `notempty` Filter column renders as a number input).
const SEARCH_KEY = "search";

// ── a template card ──────────────────────────────────────────────────────────
// The mockup's card is `flex gap-3 p-3.5`: a 1/4-width tile column on the left
// (plate over the difficulty chip) and a text column on the right (name /
// description / a bordered foot holding "use template →" — the "N routes · N graphs" run
// that used to share that foot was dropped in REVISION 3.1, 2026-09-03, and its row given
// to a third line of description; Alex approved it in the mockup and asked for it live). A TWO-track cells grid
// `minmax(0,1fr) minmax(0,3fr)` with `cellsColumnGap: 12` IS that shape — the tile track
// is 56px and the text track 168px in a 236px card at 1440, against the mockup's 57.5 /
// 160.5 with its `gap-3` — and one grid shared by every card in the group is what makes
// the foot rules line up, which separate sections could never do. (Rev 2 used four equal
// tracks with the text spanning three and a 4px gap, which put the text column 9.5px
// closer to the plate than the mockup and widened the chip/counts overlap to 14.9px;
// measured 2026-09-03.)
//
//   ┌──────────┬──────────────────────────────┐
//   │ plate    │ name                         │   rowsTemplate 'max-content'
//   │ (rowspan │ description (3 lines)        │   rowsTemplate '1fr'  ← absorbs slack
//   │  2)      ├──────────────────────────────┤
//   │ chip     │                use template →│   rowsTemplate 'max-content'
//   └──────────┴──────────────────────────────┘
//     1fr           3fr   (cellsColumnGap 12 = the mockup's gap-3)
//
// The foot is the "use template →" cell alone, carrying the rule (`cellBorderTop`) the
// mockup draws over its foot line. (Rev 2 gave the counts and the CTA a row each because
// the two wrapped internally at track width; with the counts gone that note is history.)
//
// The difficulty chip sits UNDER THE PLATE, in the tile column, as the mockup draws it
// (Alex, 2026-09-03: "the tags … are below the preview in the design and I think that looks
// better"). Rev 2 had moved it into the text column because the chip overflows its ~56px
// track — and it still does: measured on the MOCKUP at 1440, the chip overlaps the counts
// line by 4.3px on beginner/advanced and 33.9px on INTERMEDIATE, so the design carries the
// same collision; the counts-line removal Alex asked to see in the mockup is what resolves
// it — and with the counts line gone (REVISION 3.1) the chip has the whole foot row to
// overflow into: it now meets only the right-aligned "use template →". The plate spans
// rows 1–2 so the chip (row 3) lands right under it.
//
// `cellsRowsTemplate` is the mockup's `flex-1` on the description: the row above the
// foot absorbs the card's leftover height, so the foot stays pinned to the bottom
// edge and every card in a row ends its rule at the same y.
const templateCells = () => ([
  // ESCALATION 1 — the preview plate. The stored thumbnails are 50x50px and the
  // layout-derived shape needs a new column type, so the tile renders patterns.html
  // §14's "no preview" state. The column is the plate's own track: swapping this
  // one cell for an image / shape cell is the whole change.
  stat("tpl_plate", "no preview", "plateEmpty", { cellRowSpan: 2, justify: "center" }),
  col("name", "labelMD"),
  // Three lines, not two: the description owns the row the counts line used to take.
  col("description", "proseSMClamp3", { wrapText: true }),
  // difficulty is beginner / intermediate / advanced on 9 of 12 rows and '' on the
  // other 3 — StatusPillView returns null for an empty value, which is exactly the
  // mockup's chip-less card (tpl 77 and tpl 278 draw no chip). Row 3, track 1.
  { name: "difficulty", display_name: "difficulty", key: "difficulty", type: "status_pill",
    show: true, hideHeader: true, justify: "left",
    pillColors: { beginner: "chip_meta", intermediate: "chip_meta", advanced: "chip_meta" } },
  // The card's link — and the foot rule. A Card's link affordance is per cell, so the
  // whole-card anchor the mockup draws is not expressible (card-layout.md "A design row
  // that is ONE <a>") — logged. `page_path` is the working link column.
  col("page_path", "metaXSLink", { justify: "right", cellBorderTop: true,
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
// resolves. `cardsPadding: 14` is the card's inset — the mockup's `p-3.5`. Revision 2 set
// it to 0 believing the tile's own `p-4` was the inset; measured 2026-09-02 (Alex: "the cards
// linking to each report need more padding around the content"): an explicit `cardsPadding`
// is emitted as an inline `padding` on the SAME element the tile's `p-4` class sits on, and
// an explicit value — including 0 — always wins (card-layout.md), so the cards had no inset
// at all (plate 7px from the border, computed padding 0px).
const templateCard = (categoryTag, across) => card(REPORTS, templateCells(), {
  cardStyle: "tile",
  cardsGridSize: across, cardsGridGap: 16, cardBorder: false, cardsPadding: 14,
  cellsGridSize: 2, cellsColumnGap: 12, cellsRowGap: 4, cellsPadding: 0,
  cellsTracksTemplate: "minmax(0,1fr) minmax(0,3fr)",
  cellsRowsTemplate: "max-content 1fr max-content",
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

// ═════════════════════════════════════════════════════════════════════════════
// BANDS
// ═════════════════════════════════════════════════════════════════════════════
const B = {
  header: randomUUID(),
  tpl: randomUUID(),
  footer: randomUUID(),
};
const GROUPS = [
  { name: B.header,   index: 0, theme: "header",       position: "content", displayName: "Header" },
  { name: B.tpl,      index: 1, theme: "content",      position: "content", displayName: "§01 Templates" },
  // A footer at position 'bottom' renders full-viewport-width OUTSIDE the layout and
  // would not line up with the sidenav-offset content column — so it is the last
  // CONTENT band wearing the `footer` layoutGroup style (§ 4.2).
  // `footer_full`, not `footer`: the shared `footer` band style's wrapper2 is a flex ROW that
  // shrink-wraps the section grid to its content (799.5px in a 1104px column, measured
  // 2026-09-03), so the © copy could never sit at the column's right edge. `footer_full`
  // (additive themev2 style) stacks like `content`.
  { name: B.footer,   index: 2, theme: "footer_full",  position: "content", displayName: "Footer" },
];

// ═════════════════════════════════════════════════════════════════════════════
// SECTIONS — draft_sections order IS render order// ═════════════════════════════════════════════════════════════════════════════
// SECTIONS — draft_sections order IS render order
// ═════════════════════════════════════════════════════════════════════════════
const SECTIONS = [

  // ══════════ HEADER ══════════
  // Revision 3's controls row is, in order: title · view toggle · search bar · New report ·
  // New route — one line at 1600 and 1440 in the mockup, wrapping below ~1300. Live it is FIVE
  // sections on the 12-col band grid (2 + 2 + 5 + 2 + 1), because each affordance is a different
  // primitive: the toggle is a Card of two static cells, the search bar is the
  // `ChooseReportButton` theme component (a section type), the create affordance is the
  // `CreateReportButton` theme component, and New route is a Card link cell.
  //
  // WIDTH BUDGET, measured on the mockup at real Oswald metrics (Playwright, 2026-09-02): the
  // toggle is 175px, New report 112px, New route 108.7px, at every viewport. On the live band
  // grid a column is 95.3px at 1480 and the section wrapper's 12px padding IS the gutter, so a
  // size-2 section's content box is 166.7px with both gutters and 190.7px with both zeroed —
  // which is why the toggle is size 2 with `padding: { left: "0", right: "0" }` and not size 3
  // (a 262px box would leave an 87px hole before the search bar). A band grid cannot wrap, so
  // at 1280 the toggle overflows its 157px box by ~18px into the search bar's own left gutter
  // and the search bar (the flexible member) truncates its prompt — the honest equivalent of
  // the mockup's wrap. Logged as deviation 3.
  //
  // 2026-09-03, owner's hand edits adopted: the search bar is size 5 and New route size 1
  // (both x-gutters zeroed, so its 84.7px button has 105px at 1600, 92px at 1440 and 79px at
  // 1280 — with `whitespace-nowrap` on `btnOutlineLG` it overflows the column by 5.7px at 1440
  // and 19px at 1280 into the band's 32px right margin, instead of wrapping to "NEW / ROUTE").
  //
  // The FRESHNESS card ("complete through <month>", ClickHouse NPMRDS 583/982) is GONE — a
  // deliberate break with cross-page contract item "freshness line", asked for on 2026-09-02
  // and declared in the mockup's own header note. npmrds-home.html and the MAP-21 pages keep
  // theirs. The header's search-bound match-count Card is gone too: its role (the closed
  // trigger reporting `?search=` and its match count) moved INTO the search bar component.
  // VERTICAL ALIGNMENT (Alex, 2026-09-03: the title and the two buttons "could be better
  // aligned" with the rest of the line). Before: the row was 83px tall because the lexical
  // title section paid the richtext `p-4` on top of its gutter, and the four controls hugged
  // the TOP of that row (y 20–60) while the title's centre sat at ≈38. The mockup's grid is
  // `items-center`. Live, every header section now takes `height: "fill"` (the section's
  // content box becomes a flex column filling the row) and centres its own content: the Cards
  // with `cellsVerticalAlign: "stretch"` + `cellsContentVAlign: "center"`, the two theme
  // components with `flex-1` + centring on their wrappers (ChooseReportButton /
  // CreateReportButton .theme.js). The title is a Card too — a static LEXICAL cell carrying the
  // ink word + gold period — because a lexical SECTION cannot centre and pays 32px of padding.
  { group: B.header, size: "2", padding: { left: "0" }, height: "fill", elementType: "Card", data: card(REPORTS, [
    lexCell("title", [styled("displayMDCaps", text("Reports"), text(".", 0, GOLD))]),
    SEED("title_seed"),
  ], {
    cardStyle: "rowaligned",
    cellsGridSize: 1, cellsPadding: 0, cardsPadding: 0,
    cellsVerticalAlign: "stretch", cellsContentVAlign: "center", totalLength: 1, fetchMode: "force",
  }) },

  // The VIEW TOGGLE — `Templates | All reports`, the same control the list page draws in the
  // same column with the active side flipped, so the two report surfaces read as two views of
  // one library rather than two pages. A Card of two static cells in a gap-0 cells grid with
  // max-content tracks, so the cells abut and read as ONE segmented control; `viewTabOn` /
  // `viewTabOff` (additive themev2 tokens, textSettings + the dataCard mirror) carry the fill,
  // the shared hairline and the outer radii. Active = Templates (this page) — a plain cell,
  // like the mockup's `aria-current` span.
  //
  // DECISION D2 (task file) RESOLVED 2026-09-03: the list page
  // (planning/transportny/tasks/current/npmrds-all-reports-list-page.md) is now built at
  // `reports/list` (page 2217965, a child of this page) — "All reports" is a real link, no
  // longer inert. `/reports/list` is site-relative (not `/npmrds/reports/list`): the `npmrds_sub`
  // pattern's own `base_url` ("/npmrds") is prepended automatically, same convention every other
  // `L.*` target in this file already relies on.
  //
  // KNOWN, DEFERRED (2026-09-03, Ryan's call): the two cells now render as two separate pills
  // with a visible gap/misaligned border rather than one seamless segmented control —
  // `viewTabOn`/`viewTabOff` bake "the active/dark cell is always the LEFT one" into the same
  // class as the color, which stops being true the moment the OTHER cell becomes a real link
  // (found live testing this change). A real fix needs shared theme work — deliberately not
  // done in this session; that's Alex's call, not this one's. Shipping the known cosmetic bug
  // today; fix it tomorrow with Alex.
  { group: B.header, size: "2", padding: { left: "0", right: "0" }, height: "fill", elementType: "Card", data: card(REPORTS, [
    stat("view_templates", "Templates", "viewTabOn"),
    stat("view_all", "All reports", "viewTabOff", { isLink: true, location: "/reports/list", searchParams: "none" }),
    SEED("view_seed"),
  ], {
    cellsGridSize: 2, cellsGridGap: 0, cellsPadding: 0, cardsPadding: 0,
    cellsTracksTemplate: "minmax(0,max-content) minmax(0,max-content)",
    cellsVerticalAlign: "stretch", cellsContentVAlign: "center", totalLength: 1, fetchMode: "force",
  }) },

  // The SEARCH BAR — the `ChooseReportButton` theme component, which opens the React
  // `ReportPickerModal` (npmrds-picker-modals.html, 2026-08-25). It was added to this page by
  // hand that week (section 2214759, size 2, beside the old count Card) and is adopted into the
  // builder here at the row's flexible width. Revision 3 renders it as the mockup's
  // `#findTrigger` (components/ChooseReportButton/ChooseReportButton.theme.js): it fills its
  // section, its resting prompt reads "search N" with N bound to the picker's own catalog
  // count, and when the page URL carries `?search=…` it shows the query and "N matches · show
  // results" — the role the removed count Card used to play. It reads the query off
  // `pageState.filters` (the `search` page variable registered in PAGE_FILTERS below), which
  // is why that registry still matters with the Filter section gone from the page body.
  { group: B.header, size: "5", height: "fill", elementType: "ChooseReportButton", data: "{}" },

  // ══ THE CREATE AFFORDANCE — the real `CreateReportButton` theme component ══
  // Not a link and not a Card cell: the component skips PageTemplatePicker's generic
  // template modal and materialises the "Report Page" template (2187021) directly, then
  // redirects into the new report's own /edit route. It is a SECTION because a theme
  // pageComponent is an element type (`element-type: "CreateReportButton"`,
  // `element-data: "{}"`), the same way 2208581 carries it.
  //
  // Core's `newPage()` derives the new page's parent from `item.parent` and takes no
  // override — and on THIS page `parent` is '', so a report created here would have landed at
  // the pattern root. The component falls back to the host page's own id when it has no parent
  // ("if the page I'm on has no parent, I am the folder"), which is byte-identical wherever
  // `item.parent` is already set.
  //
  // The button RIGHT-ALIGNS in its section (Alex, 2026-09-02 — `createReportButton.wrapper` is
  // `flex w-full flex-col items-end` now, site-wide). With that, the gutter to "New route" is
  // this section's right padding + the New route cell's own 12px value padding (`theme.value`
  // is `px-3` and a LINK cell keeps it on the value div while the token lands on the <a>) —
  // measured 21px with the old `right: "2"` (8px), so the gutter is zeroed and the gap is 13px
  // against the mockup's 8. The live page's hand-set `height: "fill"` on this section
  // (2026-08-25) is NOT carried: it stretched the wrapper to the row's tallest section, which
  // in a row of 40px controls is a no-op — but with the row centred on `height: "fill"` today
  // (see the HEADER note) the section carries `fill` again, for the alignment, not the height.
  { group: B.header, size: "2", padding: { right: "0" }, height: "fill", elementType: "CreateReportButton", data: "{}" },

  // `New route` → the route-creation page (`npmrds_sub` "Route Creation", 2216258, slug
  // `/route_creation`, published — verified 2026-09-02). The live page had already been
  // re-pointed there by hand from the § 01 anchor this builder used to carry; that edit is
  // adopted. `btnOutlineLG` is the mockup's white/bordered h-10 button (btnOutline is h-9 and
  // shared by the control room's "All tickets"). The Road icon is not drawn — a link cell
  // cannot be a lexical cell (card-layout.md) — logged as deviation 4.
  //
  // `justify: "left"`, not right: the mockup's action cluster is `gap-2` (8px) between the
  // two buttons; with the create button right-aligned in ITS section and this cell
  // left-justified in its own, the pair reads as one cluster (13px gap, see above). Right-
  // justifying this cell would open a ~95px hole between the two (rev-2 P7 measured 137 with
  // the old layout). The trade: the pair ends ~86px short of the band's right edge at 1440,
  // where the mockup has it flush — a 2-column section cannot be narrower than its 184px.
  { group: B.header, size: "1", padding: { left: "0", right: "0" }, height: "fill", elementType: "Card", data: card(REPORTS, [
    stat("new_route", "New route", "btnOutlineLG", { justify: "left", isLink: true, location: L.routeCreation, searchParams: "none" }),
    SEED("route_seed"),
  ], {
    // `rowaligned`: a LINK cell keeps `theme.value` (`px-3 pb-3`) on its value div while the token
    // lands on the <a>, so with the default style the 40px button sat in a 52px box and centred
    // 6px high (measured 2026-09-03: cy 41 vs the row's 47). `rowaligned` is `px-3` only.
    cardStyle: "rowaligned",
    cellsGridSize: 1, cellsPadding: 0, cardsPadding: 0,
    cellsVerticalAlign: "stretch", cellsContentVAlign: "center", totalLength: 1, fetchMode: "force",
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
  //
  // SPACING (Alex, 2026-09-02: "takes up too much vertical space and should not be full width
  // so the text is forced to wrap"). Measured live at 1440 before the fix: section 159px with
  // the title on a 1104px line and the prose wrapping 1078px + a short orphan line; each of the
  // three rows was paying the value div's `pb-3` (12px) and the kicker row measured 34px against
  // the mockup's 16. Two changes: (1) `cardStyle: "rowaligned"` — the dataCard style whose
  // `value` is `px-3` only, so the rows lose their 12px bottom padding and `cellsRowGap: 6`
  // carries the mockup's own rhythm (`mb-1` under the kicker row, `mt-2` over the prose);
  // (2) the three tracks are capped so the grid is 760px wide — the mockup's `max-w-[760px]`
  // text block — and the title/prose cells (`cellSpan: 3`) wrap at that width rather than at
  // the section's. ⚠ NO track may carry an INTRINSIC min OR max: a spanning item's own
  // max-content is distributed into every intrinsic track it spans (CSS Grid §12.5), so
  // `minmax(0,max-content) minmax(0,max-content) minmax(0,565px)` measured the kicker track at
  // 282px with the title still on a 1078px line, and `minmax(max-content,70px) …` (intrinsic
  // MIN) blew the tracks to 590 + 650px and the section 191px past its column. `minmax(0,Npx)`
  // on all three is the form a spanning cell cannot grow: each track sizes to its own label
  // (66 / 127 / 154px measured) and then to its cap, the caps sum to 760, and below 760px of
  // column the tracks shrink together instead of overflowing. The section stays size 12
  // because a narrower section would let the first group head onto its row.
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
    cardStyle: "rowaligned",
    cellsGridSize: 3, cellsGridGap: 4, cellsRowGap: 6, cellsPadding: 0, cardsPadding: 0,
    cellsTracksTemplate: "minmax(0,70px) minmax(0,130px) minmax(0,560px)",
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

  // Revision 3 drops the "No route yet? Build one first." route CTA that closed § 01 — the
  // header's New route is the page's one route affordance now — so the band ends on the last
  // template card. (The Routes Data source 2107426/2107427 binding it carried is gone with it.)

  // ══════════ FOOTER ══════════
  // A CARD, not a lexical section (2026-09-03, Alex: the footer "takes up too much vertical
  // space and the TransportNY should be on the right"). The lexical footer paid the theme's
  // richtext `p-4` (32px) on top of the band's `py-4`, measuring 92px against the mockup's 51 —
  // and sat in a shrink-wrapped 800px band (see the `footer_full` note on GROUPS). As a Card
  // the row is the link run's own 17px: five static LINK cells (`linkMonoFoot`, the mockup's
  // footer link class, additive dataCard token) in max-content tracks + the © copy
  // (`metaMD`) right-justified in the `1fr` remainder, so it lands at the column's right edge.
  // `cellsColumnGap: 0` because `rowaligned`'s value `px-3` already puts 12 + 12 = 24px
  // between neighbouring links — exactly the mockup's `gap-x-6` — and the same 12px inset the
  // header title and the § 01 head carry. Two copy changes the same day, in the mockup too:
  // the "route-comparison" link is gone, and the copy reads "TransportNY v0.2", not "TransportNY
  // DMS v0.2". (Rev 2's lexical footer and its P7 measurements — `linkMonoRow`, the one-paragraph
  // inline-siblings rule, `metaMD` — are history now; the tokens stay for other pages.)
  { group: B.footer, size: "12", padding: { top: "0", bottom: "0" }, elementType: "Card", data: card(REPORTS, [
    stat("f_home",  "home",       "linkMonoFoot", { isLink: true, location: L.home,        searchParams: "none" }),
    stat("f_macro", "macro-view", "linkMonoFoot", { isLink: true, location: L.macro,       searchParams: "none" }),
    stat("f_report","report",     "linkMonoFoot", { isLink: true, location: L.reports,     searchParams: "none" }),
    stat("f_map21", "map-21",     "linkMonoFoot", { isLink: true, location: L.map21,       searchParams: "none" }),
    stat("f_docs",  "docs",       "linkMonoFoot", { isLink: true, location: L.docOverview, searchParams: "none" }),
    stat("f_copy",  "© NYSDOT · TransportNY v0.2", "metaMD", { justify: "right" }),
    SEED("foot_seed"),
  ], {
    cardStyle: "rowaligned",
    cellsGridSize: 6, cellsColumnGap: 0, cellsPadding: 0, cardsPadding: 0,
    cellsTracksTemplate: "repeat(5, minmax(0,max-content)) minmax(0,1fr)",
    cellsContentVAlign: "center", totalLength: 1, fetchMode: "force",
  }) },
];

// The page-variable registry (creating-interactive-pages.md step 0). A key that is
// not here can never become a page variable — the control's value never reaches the
// URL and no section reacts. One consumer now: the header's ChooseReportButton reads
// `search` off pageState.filters (and seeds ReportPickerModal's search box with it).
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
// 0 · resolve the page BY SLUG and check it is the pinned one, then work by PAGE ID only.
//     `--limit 1000`: the CLI defaults to 50 rows and npmrds_sub crossed 50 live pages on
//     2026-09-02 (report conversions); on the truncated list the old find-or-create would not
//     have found 2188366 and would have CREATED a second converted_reports page.
const pages = lastJson(cli("page", "list", "--pattern", PATTERN, "--limit", "1000")).items || [];
const bySlug = pages.filter(p => (p.data || p).url_slug === SLUG);
if (bySlug.length !== 1 || String(bySlug[0].id) !== PAGE_ID) {
  console.error(
    `\nREFUSING: expected exactly one ${PATTERN}/${SLUG} page with id ${PAGE_ID}; ` +
    `\`page list\` returned ${pages.length} pages and [${bySlug.map(p => p.id).join(", ")}] for that slug.\n` +
    `This builder never creates the page — if it has really gone, recreate it by hand and update PAGE_ID.\n`);
  process.exit(1);
}
const PAGE = PAGE_ID;
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
