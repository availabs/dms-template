// ─────────────────────────────────────────────────────────────────────────────
// Build the NPMRDS REPORTS page — pattern `npmrds_sub` (2100394), slug
// `converted_reports` (page 2188366), on npmrdsv5 / dev2 — from the converged mockup
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
//  · Header: title (2) · view toggle Card (2) · ChooseReportButton search bar (4) ·
//    CreateReportButton (2) · New route Card (2) = 12. The HEADER block below carries
//    the measured width budget.
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
const SLUG = "converted_reports";
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
const para = (...children) => ({ type: "paragraph", version: 1, direction: "ltr", format: "", indent: 0, textFormat: 0, textStyle: "", children });
const styled = (styleKey, ...children) => ({ type: "styled-paragraph", version: 1, direction: "ltr", format: "", indent: 0, textFormat: 0, textStyle: "", styleKey, children });
const button = (linkText, path_, style = "plain") => ({ type: "button", version: 1, linkText, path: path_, style, keepSearchParams: false });
const litem = (...children) => ({ type: "layout-item", version: 1, children });
// ONE container, whose items hold only leaf styled()/para() nodes. Nesting a
// container inside an item makes Lexical mangle it at render time
// (creating-pages-from-a-design-pattern.md § 5.6.6b) — assertFlat() enforces it.
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

// ── live link targets (verified against `dms page list --pattern npmrds_sub` 2026-08-19;
//    routeCreation added and re-verified 2026-09-02 — page 2216258 "Route Creation", published) ──
const L = {
  home: "/home",
  macro: "/macro",
  reports: "/converted_reports",
  reportIndex: "/converted_reports/reports",
  routeCreation: "/route_creation",
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
  { name: B.footer,   index: 2, theme: "footer",       position: "content", displayName: "Footer" },
];

// ═════════════════════════════════════════════════════════════════════════════
// SECTIONS — draft_sections order IS render order// ═════════════════════════════════════════════════════════════════════════════
// SECTIONS — draft_sections order IS render order
// ═════════════════════════════════════════════════════════════════════════════
const SECTIONS = [

  // ══════════ HEADER ══════════
  // Revision 3's controls row is, in order: title · view toggle · search bar · New report ·
  // New route — one line at 1600 and 1440 in the mockup, wrapping below ~1300. Live it is FIVE
  // sections on the 12-col band grid (2 + 2 + 4 + 2 + 2), because each affordance is a different
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
  // The FRESHNESS card ("complete through <month>", ClickHouse NPMRDS 583/982) is GONE — a
  // deliberate break with cross-page contract item "freshness line", asked for on 2026-09-02
  // and declared in the mockup's own header note. npmrds-home.html and the MAP-21 pages keep
  // theirs. The header's search-bound match-count Card is gone too: its role (the closed
  // trigger reporting `?search=` and its match count) moved INTO the search bar component.
  // `top: "0"`: a lexical section pays the theme's 16px richtext padding on top of the 12px
  // section gutter, so with the default gutter the title's centre sat at y≈50 against the
  // 40px controls' y≈40 (measured 2026-09-02, /edit at 1440). Zeroing the gutter lands it at
  // ≈38 — the mockup's `items-center` row within 2px.
  { group: B.header, size: "2", padding: { left: "0", top: "0" }, data: lexical(
    styled("displayMDCaps", text("Reports"), text(".", 0, GOLD)),
  )},

  // The VIEW TOGGLE — `Templates | All reports`, the same control the list page draws in the
  // same column with the active side flipped, so the two report surfaces read as two views of
  // one library rather than two pages. A Card of two static cells in a gap-0 cells grid with
  // max-content tracks, so the cells abut and read as ONE segmented control; `viewTabOn` /
  // `viewTabOff` (additive themev2 tokens, textSettings + the dataCard mirror) carry the fill,
  // the shared hairline and the outer radii. Active = Templates (this page) — a plain cell,
  // like the mockup's `aria-current` span.
  //
  // DECISION D2 (task file): the list page (npmrds-reports-list.html) is not built live yet,
  // so "All reports" ships INERT — a static cell with no href — rather than a 404. Flipping it
  // to a link later is one cell: `isLink: true, location: "/converted_reports/all_reports",
  // searchParams: "none"`.
  { group: B.header, size: "2", padding: { left: "0", right: "0" }, elementType: "Card", data: card(REPORTS, [
    stat("view_templates", "Templates", "viewTabOn"),
    stat("view_all", "All reports", "viewTabOff"),
    SEED("view_seed"),
  ], {
    cellsGridSize: 2, cellsGridGap: 0, cellsPadding: 0, cardsPadding: 0,
    cellsTracksTemplate: "minmax(0,max-content) minmax(0,max-content)",
    cellsContentVAlign: "center", totalLength: 1, fetchMode: "force",
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
  { group: B.header, size: "4", elementType: "ChooseReportButton", data: "{}" },

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
  // measured 21px with the old `right: "2"` (8px), so the gutter is zeroed and the gap is 12px
  // against the mockup's 8. The live page's hand-set `height: "fill"` on this section
  // (2026-08-25) is NOT carried: it stretched the wrapper to the row's tallest section, which
  // in a row of 40px controls is a no-op.
  { group: B.header, size: "2", padding: { right: "0" }, elementType: "CreateReportButton", data: "{}" },

  // `New route` → the route-creation page (`npmrds_sub` "Route Creation", 2216258, slug
  // `/route_creation`, published — verified 2026-09-02). The live page had already been
  // re-pointed there by hand from the § 01 anchor this builder used to carry; that edit is
  // adopted. `btnOutlineLG` is the mockup's white/bordered h-10 button (btnOutline is h-9 and
  // shared by the control room's "All tickets"). The Road icon is not drawn — a link cell
  // cannot be a lexical cell (card-layout.md) — logged as deviation 4.
  //
  // `justify: "left"`, not right: the mockup's action cluster is `gap-2` (8px) between the
  // two buttons; with the create button right-aligned in ITS section and this cell
  // left-justified in its own, the pair reads as one cluster (12px gap, see above). Right-
  // justifying this cell would open a ~95px hole between the two (rev-2 P7 measured 137 with
  // the old layout). The trade: the pair ends ~86px short of the band's right edge at 1440,
  // where the mockup has it flush — a 2-column section cannot be narrower than its 184px.
  { group: B.header, size: "2", padding: { left: "0", right: "0" }, elementType: "Card", data: card(REPORTS, [
    stat("new_route", "New route", "btnOutlineLG", { justify: "left", isLink: true, location: L.routeCreation, searchParams: "none" }),
    SEED("route_seed"),
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

  // Revision 3 drops the "No route yet? Build one first." route CTA that closed § 01 — the
  // header's New route is the page's one route affordance now — so the band ends on the last
  // template card. (The Routes Data source 2107426/2107427 binding it carried is gone with it.)

  // ══════════ FOOTER ══════════
  // Unchanged from revision 2 — it now sits directly under § 01.
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
