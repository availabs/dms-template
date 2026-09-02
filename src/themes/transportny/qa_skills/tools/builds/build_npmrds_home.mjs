// ─────────────────────────────────────────────────────────────────────────────
// Build the NPMRDS HOME page — pattern `npmrds_sub` (2100394), slug `home`, on
// npmrdsv5 / dev2 — from the converged mockup
//   src/themes/transportny/TransportNY Design System/dms_design_system_v2/pages/npmrds-home.html
// Task: planning/transportny/tasks/current/npmrds-home-page-build.md
//
// Run from the dms-template root with DMS_AUTH_TOKEN set:
//   export DMS_AUTH_TOKEN=$(node src/dms/packages/dms/cli/bin/mint-token.mjs \
//     --host https://dmsserver.availabs.org --project npmrdsv5 \
//     --email availabs@gmail.com --password test123)
//   node src/themes/transportny/qa_skills/tools/builds/build_npmrds_home.mjs
//
// DRAFT-ONLY. It never publishes and never touches `sections`/`section_groups`.
//
// Discipline (qa_skills/tools/builds/README.md):
//  · find-or-create the page BY SLUG, then address everything BY PAGE ID;
//  · a RUNTIME PARITY GUARD refuses to wipe when the live draft section count
//    differs from SECTIONS.length (someone authored live since the last run) —
//    override deliberately with ALLOW_SECTION_COUNT_CHANGE=1;
//  · the wipe is `draft_sections -> []` via `page update --data` (a full replace,
//    never `--set`, which deep-merges arrays and accumulates stale refs), plus a
//    best-effort `section delete` per orphaned row;
//    ⚠ **EXPORT `DMS_AUTH_TOKEN` OR EVERY RE-RUN LEAVES 28 ORPHANS BEHIND.** Reads are
//    anonymous, but `section delete` 500s with "Authentication required to delete items",
//    and the wipe is best-effort — so the run still SUCCEEDS and the page is still
//    correct, it just prints `(0 deleted, 28 orphaned)` and the old rows stay in the
//    pattern forever. The CLI reads the token from `DMS_AUTH_TOKEN` (cli/src/config.js):
//      DMS_AUTH_TOKEN=$(node src/dms/packages/dms/cli/bin/mint-token.mjs \
//        --host https://dmsserver.availabs.org --project npmrdsv5 \
//        --email availabs@gmail.com --password test123) \
//      DMS_HOST=… DMS_APP=npmrdsv5 DMS_TYPE=dev2 node …/build_npmrds_home.mjs
//    Check the wipe line: `(28 deleted, 0 orphaned)` is what a healthy run prints;
//  · sections are then created in order, so draft_sections order == render order.
//
// LAYOUT NOTES (the mockup's structure → DMS primitives)
//  · 4 bands: hero / content / sidebar / footer. The rail is the page pattern's
//    in-page nav: `sidebar: "right"` on the page + a `position:'sidebar'` group +
//    `navLabel`/`anchorId` on the five band-head sections (adding-an-in-page-nav-rail.md).
//    The mockup's `page-nav` card is that nav — it is NOT a section.
//  · The mockup nests a 12-col grid INSIDE each `*-body` section. `pages.sectionGroup`
//    renders ONE flat grid with no sub-grid concept, so each body is flattened into
//    sibling sections at 4/8 or 4/4/4 spans (logged Escalation in the task doc). § 04
//    keeps its 2x2-beside-a-tall-card shape via `rowspan:"2"` on the doorway.
//  · Band grid is gap-0 (`pages.sectionArray`): the per-section padding IS the gutter,
//    so the data spine's two bindings fuse into one white row by zeroing the shared edge.
//
// DATA (all figures are bound; see the task doc's data contract for what is not and why)
//  · spine extent + observations — ClickHouse NPMRDS prod source 583 / view 982
//    (`type:"npmrds"`). min/max(date) and count() are METADATA reads on that
//    14.4-billion-row table (date feeds the partition key `toYYYYMM(date)`), NOT scans.
//  · spine road segments — ClickHouse npmrds_meta source 582 / view 983, GROUP BY
//    `year` + `sort desc` + `pageSize 1` so the vintage TRACKS the newest map instead
//    of being pinned to a literal year.
//  · saved routes — DMS-internal `Routes Data` 2107426 / view 2107427. The catalogue is
//    ~2.26x duplicated on route_id (73,464 rows), so the calc is
//    `count(distinct data->>'route_id')`. DMS-internal columns live inside the `data`
//    JSONB, and an isDms calc column must contain NO COMMAS.
//  · PM3 KPI row — the four MAP-21 page cards (2173919/20/21/22) cloned VERBATIM
//    (source 2001 / view 3394 LEFT JOIN FHWA targets 2027 / 3460 on year_record) so the
//    home page and the MAP-21 report can never disagree. Only `display.cardBorder`
//    (the section paints the card) and `fetchMode` differ.
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
// The macro-view plugin's measure record. `measures.js` is deliberately import-free so the
// SAME file can be read by the plugin and by a node build script — which is what makes
// § 01's deep links honest: `available` is the one flag that decides whether the macro
// view's measure select can offer a measure, so it is also the flag that decides whether a
// row here may carry `?measure=`. Two hand-maintained lists would eventually disagree and
// the disagreement would ship as a dead link.
import { MEASURES as MACRO_MEASURES } from "../../../components/macroview/measures.js";

const ENV = {
  ...process.env,
  DMS_HOST: process.env.DMS_HOST || "https://dmsserver.availabs.org",
  DMS_APP: process.env.DMS_APP || "npmrdsv5",
  DMS_TYPE: process.env.DMS_TYPE || "dev2",
};
const CLI = "src/dms/packages/dms/cli/bin/dms.js";
const PATTERN = "npmrds_sub";
const SLUG = "home";
const TITLE = "Home";

const cli = (...a) => execFileSync("node", [CLI, ...a], { env: ENV, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const lastJson = s => JSON.parse(s.split("\n").filter(l => l.trim().startsWith("{") || l.trim().startsWith("[")).pop());
const jget = id => lastJson(cli("raw", "get", String(id)));
const tmp = (name, obj) => {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "npmrds-home-")), name);
  fs.writeFileSync(p, JSON.stringify(obj));
  return p;
};

// ── lexical builders ─────────────────────────────────────────────────────────
const text = (t, format = 0, style = "") => ({ type: "text", version: 1, detail: 0, format, mode: "normal", style, text: t });
const para = (...children) => ({ type: "paragraph", version: 1, direction: "ltr", format: "", indent: 0, textFormat: 0, textStyle: "", children });
const styled = (styleKey, ...children) => ({ type: "styled-paragraph", version: 1, direction: "ltr", format: "", indent: 0, textFormat: 0, textStyle: "", styleKey, children });
const hr = () => ({ type: "horizontalrule", version: 1 });
const button = (linkText, path_, style = "plain") => ({ type: "button", version: 1, linkText, path: path_, style, keepSearchParams: false });
const icon = (iconName, styleKey) => (styleKey ? { type: "icon", version: 1, iconName, styleKey } : { type: "icon", version: 1, iconName });
const litem = (...children) => ({ type: "layout-item", version: 1, children });
// ONE container, whose items hold only leaf styled()/para() nodes. Nesting a
// container inside an item makes Lexical mangle it at render time
// (creating-pages-from-a-design-pattern.md § 5.6.6b) — assertFlat() below enforces it.
const layout = (templateColumns, items) => ({ type: "layout-container", version: 1, templateColumns, children: items });
const lexical = (...nodes) => JSON.stringify({
  bgColor: "rgba(0,0,0,0)", isCard: "", showToolbar: false,
  text: { root: { type: "root", version: 1, direction: "ltr", format: "", indent: 0, children: nodes } },
});
// A BARE lexical document — `{root:{…}}`, NOT the section envelope `{text:{root:{…}}}`
// that `lexical()` above emits. A lexical CARD CELL is parsed by LexicalView's
// parseValue(), which tests `JSON.parse(value)?.root`; the section envelope fails that
// test, so passing lexical() as a cell's staticValue renders the JSON as literal text.
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

// ── inline style atoms (only where no theme token can reach; see § 5.6.10) ────
const GOLD = "color:#CA8A04";
// The doorway "tab" badge. The mockup floats it over the card's top edge
// (absolute -top-3); a lexical run cannot leave its flow, so it sits as the card's
// first line — presence kept, position logged as a deviation.
// `line-height` is explicit because the badge's paragraph carries the `buttonRow`
// token (`leading-[0]`) — an inline-flex atom with inherited zero leading collapses
// to its padding (measured 6px). 12.8px ≈ the 9.5px type's normal line.
const badge = bg => `display:inline-flex;align-items:center;background:${bg};color:#ffffff;padding:3px 9px;border-radius:4px;font-family:ui-monospace,monospace;font-size:9.5px;line-height:12.8px;letter-spacing:0.2em;text-transform:uppercase`;
// Bordered mono chip (a text chip has no lexical node — § 5.6.10).
const CHIP = "display:inline-flex;align-items:center;padding:2px 8px;margin-right:6px;border:1px solid rgba(9,9,11,0.12);border-radius:4px;background:#f8fafc;font-family:ui-monospace,monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#475569";
const CHIP_ON = "display:inline-flex;align-items:center;padding:2px 8px;margin-right:6px;border:1px solid rgba(55,87,107,0.30);border-radius:4px;background:rgba(55,87,107,0.08);font-family:ui-monospace,monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#1f3450";
// UNIT — retired 2026-08-13. The § 01 measure units were a run inside a mixed-style
// PARAGRAPH, where a styleKey (which applies to the whole paragraph) could not reach
// them; as Card CELLS they carry the `metaXS` token instead. Kept as the worked example
// of when an inline atom is and isn't needed (see CHIP/CHIP_ON, still in use).
// const UNIT = "font-family:ui-monospace,monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.18em;color:#94a3b8";
const STEPNUM = "font-family:ui-monospace,monospace;font-size:10px;color:#CA8A04";
const OK_MARK = "color:#059669;font-weight:700";
const WARN_MARK = "color:#A9701C;font-weight:700";

// ── live link targets (every one verified against `dms page list` in P0) ──────
const L = {
  macro: "/macro",
  reports: "/reports",
  // reportIndex previously pointed at the `converted_reports/reports` catalog page (2208581),
  // destroyed 2026-09-02 (v0.1 landing page, see rename-converted-reports-url-to-reports.md) —
  // repointed at the reports homepage itself, which now owns the "Create a report" entry point.
  reportIndex: "/reports",
  comparison: "/route_comparison",
  map21: "/map_21",
  lottr: "/map_21/level_of_travel_time_reliability",
  dataSources: "/datasources",
  // npmrds_docs pattern 1411813, base_url /docs
  docOverview: "/docs/npmrds/overview",
  docQuickStart: "/docs/npmrds/quick_start",
  docRoute: "/docs/npmrds/route_analysis",
  docRegional: "/docs/npmrds/regional_analysis",
  docPm3: "/docs/npmrds/p_m_3_measures",
  docBatch: "/docs/npmrds/batch_reports",
  docBatchApi: "/docs/ap_is/batch_reports_api",
  docVideos: "/docs/npmrds/training_videos",
  docAppendix: "/docs/npmrds/appendix",
  // ready-made reports — real reports/* children (renamed 2026-09-02 from converted_reports/*)
  rSnapshot: "/reports/snapshot",
  rSeasonality: "/reports/seasonality",
  rBidirectional: "/reports/bi_directional",
  rYoY: "/reports/year_over_year",
  rThreeWay: "/reports/this_month_vs_last_month_vs_last_year",
  rMonthlyCongestion: "/reports/monthly_congestion",
};

// ── band-head helper (the house recipe: eyebrow ROW → displaySM title, FLAT) ──
const bandHead = (num, descriptor, title, link) => {
  const items = [litem(styled("kicker", text(`// ${num}`))), litem(styled("metaSM", text(descriptor)))];
  const cols = link ? "items-center grid-cols-1 md:grid-cols-[max-content_1fr_max-content] gap-x-3"
                    : "items-center grid-cols-1 md:grid-cols-[max-content_1fr] gap-x-3";
  if (link) items.push(litem(para(button(link.text, link.path, "linkMono"))));
  return lexical(layout(cols, items), styled("displaySM", text(title)));
};

// ── doorway card (§ 01/02/03/04's "opens this product" card) ─────────────────
// The in-card deep-link row. THREE things here are load-bearing, all measured
// 2026-08-14 (horizontal-parity pass) on the § 01 doorway, whose content box is
// 209.3px inside a 243.3px card:
//   1. `minmax(0,max-content)`, never a bare `max-content`. A grid item's automatic
//      minimum size is min-content, so a bare max-content track cannot shrink below
//      its longest link and the WHOLE lexical column takes that width — the card's
//      content measured 268.7px in a 209.3px box and hung 30.4px past the section,
//      into the band's grey gutter, clipping "…read th" at the card's edge.
//      minmax(0,…) lets the track shrink; nothing overflows even in the worst case.
//   2. no `1fr` filler item. The old row was `[max-content_max-content_1fr]` with an
//      empty third layout-item purely to left-align the pair — but a third column
//      costs a second `gap-x-4`, i.e. 16px of the 209px, for nothing. Two links = two
//      tracks; grid tracks don't stretch without an `fr`, so the pair still sits left.
//   3. `linkMonoXS` (10px/tracking-wider), the mockup's own type for this row, not the
//      band-head `linkMono` (11px/0.14em). The pair measures 185px instead of 237px,
//      which is the difference between fitting on one line and wrapping.
// The template must be a LITERAL string (Tailwind v4 scans this file for class names);
// building it by concatenation would emit a class that was never compiled.
const LINK_ROW_COLS = {
  1: "items-center grid-cols-1 md:grid-cols-[minmax(0,max-content)] gap-x-4",
  2: "items-center grid-cols-1 md:grid-cols-[minmax(0,max-content)_minmax(0,max-content)] gap-x-4",
};
// ── the doorway as a CARD (2026-08-14) ───────────────────────────────────────
// It was ONE lexical document until this pass. The mockup makes the reason for the
// change plain: its CTA rail is a **sibling** of the `flex-1` content block —
//
//   card  flex flex-col h-full rounded-[8px] overflow-hidden
//   ├── content  p-5 pt-7 flex-1        ← grows to fill
//   └── <a> rail h-11 px-5 justify-between   ← lands flush on the bottom edge
//
// so it is pinned to the card's bottom edge and runs edge to edge. A lexical
// section has no such mechanism: its content is ONE top-anchored flow, so the rail
// sat wherever the copy ended (measured 16px above the card's bottom edge on § 01
// and § 03, 96.4 on § 02, 42.7 on § 04) and inside the lexical element's own `p-4`
// (209.3px wide in a 243.3px card).
//
// As a Card the same drawing is 5 cells (7 with § 02's chip block) in a ONE-track
// cells grid, and the pin is `display.cellsRowsTemplate` = `'… 1fr max-content'`:
// the row above the CTA absorbs the card's leftover height (the mockup's `flex-1`),
// the CTA row stays exactly `h-11`, and the CTA cell's padding is 0 so its
// `ctaRail*` token bleeds to the card's edges. See Card.layout.js
// (`resolveCellsGridStyle`) and themev2 `dataCard.ctaRail*`.
//
// WHICH CELLS ARE LEXICAL, and why (the rule from the § 01/§ 02 conversions: a
// lexical cell earns its place only when the cell needs MIXED RUNS):
//   · tab badge — an inline-styled pill atom (`badge()`); no plain cell can draw a
//     background box that shrink-wraps its text.
//   · icon shield + title — an icon node AND a text run in one cell.
//   · links row — two link decorators on one flex line.
//   · § 02's chip row — three bordered chip atoms on one line.
// prose and the CTA are plain static cells: one styled run each, and the CTA must
// be a LINK cell (a lexical cell cannot be one — CompWrapper early-returns the raw
// value for a link cell, so the lexical ViewComp never runs).
//
// SPACING. Every gap below is a measured cell padding, not a lexical margin. The
// mockup's own rhythm is `p-5 pt-7` + `mt-3` between blocks (28/12/12/20); live
// that does not fit, and the arithmetic is worth keeping because it is the same
// on all six NPMRDS pages:
//   card = 2 (border) + Σpads + 18.8 (badge) + 56 (icon row) + prose + links
//          + 8 (the 1px transparent border every v1 cell ships, × 4 text rows)
//          + 45 (CTA row) ⇒ § 01 = 241.7 + Σpads against a 264.5 mockup.
// Two costs the mockup does not pay put ~38px on the live card before ANY padding:
// the tab badge renders INSIDE the card (+18.8 — the mockup floats it `-top-3`,
// out of flow) and the live card is 24px narrower than the mockup's column
// (band gutter = section padding, escalated), which costs the prose a 5th line
// (+19.4). Spending the design's 72px of internal padding on top of that would put
// § 01's band at ~304 against the mockup's 264.5 (+40, four times § 8.1's ±10px
// tolerance) and — because the measures panel beside it is `height:'fill'` —
// stretch its eight measure rows past their own ±3px row tolerance. So the gaps
// are compressed to 10/4/6/6/6, which lands § 01 at 273.7 (+9.2, inside the gate)
// while still giving the card the breathing room the lexical version had none of
// (its blocks abutted at 0/0/8px).
// ⚠ `padX` is 16, not the mockup's 20: § 01's link pair measures **205.1px**
// natural (`probe_natural.mjs`), and 20px of side padding would leave it a 199.3px
// box — the row would wrap and cost 15px on every doorway. 16 leaves 207.3 (2.2px
// of headroom). Re-run that probe before changing padX or the link copy.
const DOOR = {
  padX: 16,        // mockup p-5 (20) — see the ⚠ above
  padTop: 10,      // badge row (the mockup's pt-7 clears a badge that floats OUTSIDE)
  gapTitle: 4,     // badge → icon+title
  gapProse: 6,     // icon+title → prose   (mockup mt-3)
  gapLinks: 6,     // prose → links row    (mockup mt-3)
  padBottom: 6,    // links → CTA rail     (mockup pb-5)
  gapExtra: 10,    // § 02's `mt-4 pt-3 border-t` block
  gapChips: 4,     // its eyebrow → chip row (mockup mb-1.5)
};

const doorwayCells = ({ tab, tabColor, shield, iconName, title, prose, links, extra = [], cta }) => {
  const X = { cellPaddingLeft: DOOR.padX, cellPaddingRight: DOOR.padX };
  return [
    // An all-static card still fires a UDA request with an EMPTY attribute list and
    // the server compiles `SELECT data AS data` → a console error on every load.
    // One selectOnly aggregate gives it something real to ask for (see SEED below).
    SEED("door_seed"),
    lexCell("door_tab", [styled("buttonRow", text(tab, 0, badge(tabColor)))],
      { ...X, cellPaddingTop: DOOR.padTop, cellPaddingBottom: 0 }),
    // `cardTitle` is Oswald-uppercase 18px; the mockup draws this title at 22px.
    // Token-first (matching family + case + weight) over an invented size — the
    // 22px `cardTitleLG` is still an open ask in the task doc's Escalations.
    lexCell("door_title", [styled("cardTitle", icon(iconName, shield), text(title))],
      { ...X, cellPaddingTop: DOOR.gapTitle, cellPaddingBottom: 0 }),
    // `proseSMInk`, not `proseSM`: a plain cell's valueFontStyle resolves against the
    // dataCard mirror, where proseSM is slate-500 — the lexical paragraph this cell
    // replaces resolved against textSettings, where it is the design's slate-600.
    { name: "door_prose", origin: "static", staticValue: prose, valueFontStyle: "proseSMInk",
      show: true, hideHeader: true, justify: "left",
      ...X, cellPaddingTop: DOOR.gapProse, cellPaddingBottom: 0 },
    // The in-card deep-link row keeps the three load-bearing choices from the
    // horizontal-parity pass (see LINK_ROW_COLS above); only its wrapper changed
    // from a lexical paragraph flow to a cell, so the `mb-3` spacer is gone —
    // the cell's own padding is the gap now.
    lexCell("door_links", [layout(LINK_ROW_COLS[links.length] || LINK_ROW_COLS[2],
      links.map(l => litem(styled("buttonRow", button(l.text, l.path, "linkMonoXS")))))],
      { ...X, cellPaddingTop: DOOR.gapLinks, cellPaddingBottom: DOOR.padBottom }),
    ...extra,
    // The CTA rail. `cellPadding: 0` + the `ctaRail*` token (which carries the bar's
    // height, colour, gold arrow and a `-mx-px -mb-px` bleed over the cell's
    // transparent border) = the mockup's full-bleed rail, clipped to the card's own
    // 7px inner radius. It is a LINK cell, so the whole rail is the anchor.
    { name: "door_cta", origin: "static", staticValue: cta.text, valueFontStyle: cta.style,
      isLink: true, location: cta.path, searchParams: "none",
      show: true, hideHeader: true, justify: "left", cellPadding: 0 },
  ];
};

// § 02's in-card "6 more ready-made, by question" block — the mockup's
// `mt-4 pt-3 border-t` eyebrow over a row of chips, as two cells.
// ⚠ Deviation: `cellBorderTop` draws on the cell's BORDER box, so the rule runs the
// full width of the card where the mockup insets it by its `p-5`. A Card has no
// inset-rule knob; the same full-bleed rule is what § 02's ready-made rows already
// draw, so it reads as house style rather than as an error.
const doorwayChips = ({ label, chips }) => ([
  { name: "door_extra_label", origin: "static", staticValue: label, valueFontStyle: "unitXS",
    show: true, hideHeader: true, justify: "left", cellBorderTop: true,
    cellPaddingLeft: DOOR.padX, cellPaddingRight: DOOR.padX,
    cellPaddingTop: DOOR.gapExtra, cellPaddingBottom: DOOR.gapChips },
  lexCell("door_extra_chips", [para(...chips.map(c => text(c, 0, CHIP)))],
    { cellPaddingLeft: DOOR.padX, cellPaddingRight: DOOR.padX,
      cellPaddingTop: 0, cellPaddingBottom: DOOR.padBottom }),
]);

const doorwayCard = cfg => {
  const cells = doorwayCells(cfg);
  // SEED renders no cell (selectOnly), so it takes no grid row.
  const rows = cells.filter(c => !c.selectOnly).length;
  // `'max-content … 1fr max-content'` — the mockup's `mt-auto`, expressed with the
  // key that exists for it: every row keeps its authored rhythm, the row ABOVE the
  // CTA absorbs the leftover height, and the CTA row stays content-sized (44px).
  // Naming the rows explicitly means `align-content` never has to distribute
  // anything, so no other row can quietly grow (contrast § 01's measures panel,
  // which wants the opposite: `'max-content'` + cellsVerticalAlign:'stretch').
  const cellsRowsTemplate = [...Array(Math.max(rows - 2, 0)).fill("max-content"), "1fr", "max-content"].join(" ");
  return card(CH_META, cells, {
    cardStyle: "context", cellsGridSize: 1, cellsGridGap: 0,
    cardsPadding: 0, cardsBgColor: "#ffffff",
    cellsRowsTemplate,
    totalLength: 1, fetchMode: "force",
  });
};

// ── ready-made report card (§ 02's two category cards) ──────────────────────
// RETIRED 2026-08-13 — both § 02 category cards are now Cards (`readyMadeCard()` below),
// because the mockup's rows need one grid shared by every row for the chevron column to
// line up. Kept here, commented, as the before/after pair for the conversion write-up in
// planning/transportny/tasks/current/npmrds-home-page-build.md § Design notes.
// const readyMade = ({ iconName, kicker, count, title, prose, rows, foot }) => lexical(
//   layout("items-center grid-cols-[1fr_max-content] gap-x-2", [
//     litem(styled("kicker", icon(iconName), text(` ${kicker}`))),
//     litem(styled("metaXS", text(count))),
//   ]),
//   styled("displayXS", text(title)),
//   styled("proseSM", text(prose)),
//   hr(),
//   ...rows.flatMap(r => [para(button(r.title, r.path, "cardlink")), styled("proseXS", text(r.desc))]),
//   hr(),
//   styled("metaXS", text(foot)),
// );

// ── Card (dataWrapper) helpers ───────────────────────────────────────────────
// ClickHouse NPMRDS production (the tsmo freshness card's proven binding).
const CH_NPMRDS = {
  name: "NPMRDS", source_id: 583, view_id: 982, view_name: "NPMRDS_V6",
  type: "npmrds", env: "npmrds2", srcEnv: "npmrds2", isDms: false, baseUrl: "/datasources",
  columns: [
    { desc: null, name: "tmc", type: "STRING", display_name: "tmc" },
    { desc: null, name: "date", type: "STRING", display_name: "date" },
    { desc: null, name: "epoch", type: "INTEGER", display_name: "epoch" },
    { desc: null, name: "travel_time_all_vehicles", type: "NUMBER", display_name: "travel_time_all_vehicles" },
    { desc: null, name: "data_density_all_vehicles", type: "STRING", display_name: "data_density_all_vehicles" },
    { desc: null, name: "state", type: "STRING", display_name: "state" },
  ],
};
// ClickHouse npmrds_meta — the TMC network, one row per segment per vintage year.
const CH_META = {
  name: "NPMRDS TMC Meta", source_id: 582, view_id: 983, view_name: "NPMRDS_V6_tmc_meta",
  type: "npmrds_meta", env: "npmrds2", srcEnv: "npmrds2", isDms: false, baseUrl: "/datasources",
  columns: [
    { desc: null, name: "tmc", type: "STRING", display_name: "tmc" },
    { desc: null, name: "year", type: "INTEGER", display_name: "year" },
    { desc: null, name: "miles", type: "NUMBER", display_name: "miles" },
    { desc: null, name: "county_name", type: "STRING", display_name: "county_name" },
    { desc: null, name: "region_code", type: "STRING", display_name: "region_code" },
    { desc: null, name: "f_system", type: "INTEGER", display_name: "f_system" },
    { desc: null, name: "is_interstate", type: "STRING", display_name: "is_interstate" },
  ],
};
// DMS-internal `Routes Data` dataset (the saved-route catalogue).
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

const card = (externalSource, columns, display, filters = { op: "AND", groups: [] }) => JSON.stringify({
  externalSource, columns, filters,
  display: {
    usePagination: false, pageSize: 1, totalLength: 1, striped: false, autoResize: false,
    readyToLoad: true, showAttribution: false, allowDownload: false, reverse: false,
    cardsGridSize: 1, cardsGridGap: 0, cardBorder: false, cellBorder: false,
    preventDuplicateFetch: true, ...display,
  },
  data: [], join: { sources: {} },
});

// A static chrome cell (an eyebrow / a label with no row data) — card-layout.md
// "Static columns": shares the card's cell spacing instead of costing a whole
// lexical section in the band's own gutter.
const stat = (name, staticValue, valueFontStyle, extra = {}) =>
  ({ name, origin: "static", staticValue, valueFontStyle, show: true, hideHeader: true, justify: "left", cellPadding: 0, ...extra });
const calc = (name, extra = {}) =>
  ({ name, origin: "calculated-column", type: "calculated", fn: "exempt", formatFn: " ", show: true, justify: "left", ...extra });

// ── static LEXICAL cell — chrome that needs the richtext column type ──────────
// `origin:'static'` + `type:'lexical'`. Card.jsx resolves the cell value from
// `staticValue` (never from the row) and CompWrapper forces editMode=false for a
// static cell, so the cell always renders the read-only LexicalView — no toolbar,
// no edit outline, in /edit as well as in view. Card.jsx has explicit support for
// this pairing (`hideControls`/`showBorder` are keyed off `attribute.type==='lexical'`).
//
// Why a lexical cell instead of a plain `stat()` cell: the doc's styleKey resolves
// against the brand's textSettings, so a cell can carry named tokens AND mixed runs
// (two paragraphs, an icon, an inline chip) — a plain cell has ONE `valueFontStyle`.
// ⚠ `isLink` and `type:'lexical'` are mutually exclusive: CompWrapper early-returns
// the raw value for a link cell in view mode, so the lexical ViewComp never runs.
const lexCell = (name, nodes, extra = {}) =>
  ({ name, origin: "static", type: "lexical", staticValue: lexDoc(...nodes),
     show: true, hideHeader: true, justify: "left", ...extra });

// ── § 01 · the eight measures, as a CARD ─────────────────────────────────────
// The vocabulary is a cross-page contract artifact (item 5) — names and units are
// byte-identical to npmrds-macro § 01. What changed is the RENDERING: the mockup's
// row is `name (w-16) · description (1fr) · unit (right)` and all eight rows share
// ONE set of column edges. Eight lexical paragraphs cannot do that (a paragraph has
// no columns), and eight lexical layout-containers cannot either (each container is
// its own grid, so every row's `max-content` unit column lands somewhere different).
// The Card's cells grid IS the shared grid: 6 tracks = 2 measures across × 3 parts.
//
// The fourth element is the MACRO VIEW's measure key (`measures.js` MEASURE_ORDER), which
// is what turns each row into a deep link — see MEASURE_HREF below.
const MEASURES = [
  ["LOTTR",    "Travel-time reliability",   "ratio",   "lottr"],
  ["TTTR",     "Truck reliability",         "ratio",   "tttr"],
  ["TED",      "Total excessive delay",     "veh-hr",  "ted"],
  ["PHED",     "Peak-hour excessive delay", "per-hr",  "phed"],
  ["Speed",    "Percentile · 5th → 95th",   "mph",     "speed"],
  ["Freeflow", "Uncongested reference",     "mph",     "freeflow"],
  ["CO₂",      "Emissions · 6 pollutants",  "tons/yr", "emissions"],
  ["Network",  "TMC & RIS attributes",      "meta",    "attributes"],
];

// ── § 01's deep links ────────────────────────────────────────────────────────
// Each row targets the macro view AT ITS MEASURE, using the URL contract the plugin owns
// (`src/themes/transportny/components/macroview/urlState.js`): `?measure=<key>`, where the
// key is the measure select's own value and every other control is left at its default so
// the param stays the only thing in the query string.
//
// ⚠ THREE OF THE EIGHT CANNOT BE HONOURED. The pm3 source (1410) does not compute
// freeflow, emissions or the network attributes, so those measures are NOT in the measure
// select — `?measure=freeflow` would be a link to a control that does not exist. Those
// three rows therefore point at plain `/macro`, and the plugin's decoder degrades an
// unknown or unsupported `measure` value to the default rather than rendering empty, so a
// hand-typed `?measure=freeflow` is safe too. That is the SECOND line of defence, not the
// design: the design decision — whether to mark the three rows or drop them — is an open
// question for Alex in the task doc. Today all eight rows look identical and click through
// to a working page; three of them just land on LOTTR.
//
// The availability flag is READ from the plugin's record, never restated here.
const MEASURE_HREF = (key) =>
  MACRO_MEASURES[key]?.available ? `${L.macro}?measure=${key}` : L.macro;
// Each part is its own cell so it can carry a NAMED textSettings token
// (metaSM / labelSM / proseSM / metaXS) instead of the inline style atom a
// single mixed-run paragraph needs (cf. the UNIT/CHIP atoms above).
//
// LINK MECHANISM — decided by trying all three live (see the task doc's § 01
// design note; evidence in scratchpad/.../c2_measures_crop.png):
//   · lexical cell + `isLink`  ✗ CompWrapper early-returns the raw value for a link
//     cell in view mode, so the lexical ViewComp never runs and the cell renders its
//     staticValue as literal JSON inside a blue underlined <a>.
//   · lexical cell + a `button` node in the doc  ~ navigates, but the button's look
//     comes from theme.button.styles[] (`cardlink` = mono 10.5px uppercase blue), so
//     the mockup's display-face name is lost.
//   · plain static cell + `isLink` + `valueFontStyle`  ✓ renders <a href> with EXACTLY
//     the named token and no underline. Used on all three parts, so the whole row is
//     clickable like the mockup's single <a> (at the cost of 3 anchors instead of 1 —
//     a true row link would need a Card-level affordance; logged as an Escalation).
// A card whose columns are ALL `origin:'static'` still fires a UDA request, but with an
// EMPTY attribute list — falcor then asks for the bare `data` leaf and the server compiles
// `SELECT data AS data FROM …` → "Unknown expression identifier 'data'". The card still
// PAINTS (the error payload arrives as one row and a static cell never reads the row), so
// the failure is invisible except for a console error on every load. One `selectOnly`
// aggregate gives the query something real to ask for. Because it carries `fn`, getData's
// `isRequestingSingleRow` short-circuit still applies, so there is no length query either.
const SEED = name => calc(`count() as ${name}`, { selectOnly: true, hideHeader: true });

const measureCells = () => {
  // ⚠ `searchParams: "none"` means Card.jsx uses `location` VERBATIM as the href (it does
  // not append the page's own search params), so a query string in `location` survives
  // intact — which is exactly what these deep links need. Verified live: the anchors are
  // real `<a href="/macro?measure=lottr">` elements.
  const linkTo = (key) => ({ isLink: true, location: MEASURE_HREF(key), searchParams: "none" });
  const cell = (name, staticValue, valueFontStyle, extra = {}) =>
    ({ name, origin: "static", staticValue, valueFontStyle, show: true, hideHeader: true, justify: "left", ...extra });
  const cells = [
    SEED("measures_seed"),
    // header strip — the mockup's `px-4 h-10 … border-b` row
    cell("measures_label", "go straight to a measure", "metaSM",
      { cellSpan: 3, cellBorderBottom: true, cellPaddingTop: 12, cellPaddingBottom: 12, cellPaddingLeft: 16, cellPaddingRight: 8 }),
    // "· region 8" REMOVED 2026-08-18 (Alex): it dated from a region dropdown that no
    // longer exists — the macro view now defaults to the whole state, so naming one
    // region here was actively misleading. The year stays; it is the PM3 vintage these
    // measures are reported for. NB the mockup still draws "2025 · region 8".
    cell("measures_asof", "2025", "metaXS",
      { cellSpan: 3, cellBorderBottom: true, justify: "right", cellPaddingTop: 12, cellPaddingBottom: 12, cellPaddingLeft: 8, cellPaddingRight: 16 }),
  ];
  MEASURES.forEach(([n, d, u, mKey], i) => {
    const isLeftColumn = i % 2 === 0;              // mockup: left cells carry the border-r
    const isLastRow = i >= MEASURES.length - 2;    // mockup: last row carries no border-b
    // 15, not the mockup's `py-2.5` (10). The mockup's rows ARE py-2.5 — they render
    // at 55.9px because the panel is the short sibling and its `flex-1` grid stretches
    // 38.8px rows to fill the doorway card beside it. A Card cells grid cannot
    // distribute slack that way (see the display block below), so the same 55–56px
    // rhythm is set directly, and the panel's NATURAL height then matches the doorway
    // to ~2px instead of leaving a 42px blank strip under the last row.
    // ⚠ Coupled to the doorway's height: re-measure both if either card's content changes.
    const row = { cellBorderBottom: !isLastRow, cellPaddingTop: 15, cellPaddingBottom: 15, ...linkTo(mKey) };
    // ⚠ OPTICAL CENTRING OF THE THREE PARTS — now the CARD's job, not this file's
    // (2026-08-14). Until the link-cell line-height fix landed, all three parts of a
    // row rendered with the SAME 24px line box — not because they asked for one, but
    // because an inline <a>'s token leading was inert and every part inherited the
    // value div's strut. That accident is what lined them up. Each part now gets its
    // OWN token leading (name 16.25 · description 19.4 · unit 13.5), so for one day
    // this file re-centred the two shorter parts with hand-computed top padding
    // (`cellPaddingTop` 16.5 on the name = 15 + (19.4 − 16.25)/2, and 18 on the unit
    // = 15 + (19.4 − 13.5)/2). Both bumps are GONE: `display.cellsContentVAlign:
    // 'center'` (below) centres every part's line box in its own cell, and because
    // the three cells share a grid row and identical 15/15 padding, their midlines
    // coincide exactly. Measured at 1280 — line-box midline vs the description:
    //   bumps, no knob   name −0.1 · unit  0.0   (hand-tuned, drifts with any token)
    //   no bumps, no knob name −1.6 · unit −3.0   (the defect this replaced)
    //   no bumps + knob   name  0.0 · unit  0.0   (exact, and token-agnostic)
    cells.push(
      cell(`m${i}_name`, n, "labelSM", { ...row, cellPaddingLeft: 16, cellPaddingRight: 8 }),
      // `proseSMTrunc1`, not `proseSM`: the mockup's description span is
      // `flex-1 min-w-0 truncate` — ONE line, ellipsised ("Peak-hour excessive …").
      // Left to wrap, these eight rows grew 56px → 69px each and pushed the § 01
      // band 63px past the mockup's 265px. See themev2 `proseSMClamp1` for why the
      // token clamps rather than truncates, and why it carries no `leading-*`.
      // `Trunc1` = that token + `break-all`, so the ellipsis lands mid-word at the
      // track's edge the way `truncate` does ("Emissions · 6 pollut…", exactly the
      // mockup's clip) instead of after the last whole word ("Emissions · 6…"),
      // which was leaving up to 44px of the track empty (2026-08-14).
      cell(`m${i}_desc`, d, "proseSMTrunc1", { ...row, cellPaddingLeft: 0, cellPaddingRight: 8 }),
      // `unitXS`, not `metaXS`: the mockup's unit run is 9px, metaXS is 9.5px. That half
      // pixel is worth writing down because this cell sits in a `minmax(0,max-content)`
      // TRACK shared by the four rows of its half, so the widest unit sizes the track and
      // taxes every description beside it — `TONS/YR` at 9.5px makes it 69px, at 9px 66.3px
      // (horizontal-parity pass 2026-08-14).
      cell(`m${i}_unit`, u, "unitXS", { ...row, justify: "right", cellPaddingLeft: 0, cellPaddingRight: 16, cellBorderRight: isLeftColumn }),
    );
  });
  return cells;
};

// ── § 02 · the two ready-made report cards, as CARDS ─────────────────────────
// Same treatment as § 01: the mockup's rows are `title / description` stacked in a
// clickable row with a chevron pinned right, and the chevron must sit on the SAME
// vertical edge in all three rows — one grid, two tracks (`1fr` text · chevron).
// Two cells here are genuinely LEXICAL, because they need something a plain cell
// cannot express:
//   · the eyebrow — an icon node AND a text run in ONE cell;
//   · the chevron — an icon with no text at all.
// Every other cell is one styled run (and the report rows must LINK), so they are
// plain static cells with a `valueFontStyle`.
const readyMadeCells = ({ iconName, kicker, count, title, prose, rows, foot }) => {
  const cell = (name, staticValue, valueFontStyle, extra = {}) =>
    ({ name, origin: "static", staticValue, valueFontStyle, show: true, hideHeader: true, justify: "left", ...extra });
  const cells = [
    SEED("rm_seed"),
    // header block — mockup `px-4 pt-4 pb-3 border-b`
    // `kickerXS` = the mockup's in-card eyebrow (`text-[10px] tracking-[0.18em]`).
    // At the band-head `kicker`'s 11px/0.2em, "// change over time" wrapped to a
    // second line in this column and added 22px to the § 02 band.
    lexCell("rm_eyebrow", [styled("kickerXS", icon(iconName), text(` ${kicker}`))],
      { cellPaddingTop: 14, cellPaddingBottom: 0, cellPaddingLeft: 16, cellPaddingRight: 8 }),
    cell("rm_count", count, "metaXS",
      { justify: "right", cellPaddingTop: 16, cellPaddingBottom: 0, cellPaddingLeft: 8, cellPaddingRight: 16 }),
    cell("rm_title", title, "displayXS",
      { cellSpan: 2, cellPaddingTop: 6, cellPaddingBottom: 0, cellPaddingLeft: 16, cellPaddingRight: 16 }),
    cell("rm_prose", prose, "proseSM",
      { cellSpan: 2, cellBorderBottom: true, cellPaddingTop: 4, cellPaddingBottom: 12, cellPaddingLeft: 16, cellPaddingRight: 16 }),
  ];
  rows.forEach((r, i) => {
    const last = i === rows.length - 1;
    const link = { isLink: true, location: r.path, searchParams: "none" };
    cells.push(
      // `proseRowSM` = the mockup's `text-[13px] font-medium text-[#0f1722]`. It was
      // `prose` (14.5px), and because a link cell's token lands on an INLINE <a> the
      // line box came from the value div's 24px strut, not the token — 7.4px of drift
      // on every one of the six rows (vertical-rhythm parity pass 2026-08-13).
      cell(`rm${i}_title`, r.title, "proseRowSM",
        { ...link, cellPaddingTop: 10, cellPaddingBottom: 0, cellPaddingLeft: 16, cellPaddingRight: 8 }),
      // rowspan 2 so one chevron serves the title+description pair, like the mockup's
      // `flex items-start` row where the chevron is a sibling of the whole text block.
      // ⚠ NO `cellVAlign` here: `align-self` shrink-wraps the cell inside its 2-row area,
      // so a centred cell's `cellBorderBottom` floats ABOVE the row's real bottom edge and
      // the rule no longer lines up with the sibling column's (measured, then fixed).
      // `rowChevron` pins the glyph to the mockup's `size-3` (12px). Unstyled it
      // rendered at ~28px, which widened this track from 36px to 51.75px and stole
      // 16px from the description column beside it — the difference between a
      // 2-line and a 3-line description.
      lexCell(`rm${i}_chev`, [para(icon("ChevronRight", "rowChevron"))],
        { cellRowSpan: 2, justify: "right", cellBorderBottom: !last,
          cellPaddingTop: 10, cellPaddingBottom: 10, cellPaddingLeft: 8, cellPaddingRight: 16 }),
      // 2 lines is the mockup's line budget for this row (its longest description
      // sets a 34.5px two-line block; none of the six ever reaches a third line).
      // Live these were running to 3-4 lines and adding ~120px to the § 02 band.
      cell(`rm${i}_desc`, r.desc, "proseXSClamp2",
        { ...link, cellBorderBottom: !last, cellPaddingTop: 0, cellPaddingBottom: 10, cellPaddingLeft: 16, cellPaddingRight: 8 }),
    );
  });
  cells.push(cell("rm_foot", foot, "metaXS",
    { cellSpan: 2, cellBorderTop: true, cellBgColor: "#f8fafc",
      cellPaddingTop: 8, cellPaddingBottom: 8, cellPaddingLeft: 16, cellPaddingRight: 16 }));
  return cells;
};
const readyMadeCard = cfg => card(CH_META, readyMadeCells(cfg), {
  cardStyle: "context", cellsGridSize: 2, cellsGridGap: 0,
  cardsPadding: 0, cardsBgColor: "#ffffff",
  // The two ready-made cards are `height:'fill'` siblings, so the SHORTER one's
  // rows used to leave the leftover pooled below the last row — the tinted footer
  // strip stopped short of the card's bottom border (measured 43px at 1440, 20px
  // at 1600/1680; whichever card is shorter flips with the width).
  // `cellsVerticalAlign: 'stretch'` now emits `align-content: stretch`, which
  // spreads that leftover equally across the ten rows (CSS Grid §12.9). It is
  // inert when the rows already fill the box, so the taller card is untouched.
  // ⚠ It did NOT always mean this: until 2026-08-14 the key emitted
  // `gridAutoRows: minmax(max-content, 1fr)`, which EQUALIZES rows to the tallest
  // row's max-content and took this card to 751px. Fixed in `Card.layout.js`
  // (`src/dms/planning/tasks/current/card-cell-row-slack-absorption.md`).
  cellsVerticalAlign: "stretch",
  cellsTracksTemplate: "minmax(0,1fr) minmax(0,max-content)",
  totalLength: 1, fetchMode: "force",
});

// ── The four PM3 KPI cards, cloned VERBATIM from the live MAP-21 report page
// (sections 2173919 / 2173920 / 2173921 / 2173922 on page 2173915).
//
// ⚠ THESE ARE NO LONGER RENDERED AS FOUR SECTIONS. Since 2026-08-14 they are the
// *SQL quarry* for ONE combined § 04 panel (`pm3PanelCard()` below), which is what
// the mockup draws: a single `col-span-8` bordered box holding a header strip, a
// 2x2 of compact measure cells and an `mt-auto` footer link row. Four full-size
// report cards carried far more content than the design's cells (a status pill, a
// 44px figure, a captioned bar, a delta AND a margin sentence each) and, being four
// SECTIONS, could never be combined into one box.
//
// The BINDINGS are unchanged and still byte-identical to the report page's:
// `kpiSql()` lifts each expression out of this array by alias and only ever renames
// the SQL alias, so the home page and the MAP-21 report cannot disagree.
// Source 2001 / view 3394 LEFT JOIN FHWA targets 2027 / 3460 on year_record; the
// `ds.year_record` leaf keeps `includePriorPeriod` so the lag()/delta columns
// resolve; its value ['2025','2024'] is what the home page shows.
const KPI_CARDS = [
 {
  "_from": "2173919",
  "_label": "LOTTR Interstate reliability",
  "ed": {
   "externalSource": {
    "name": "Map 21 Extended ",
    "columns": [
     {
      "desc": null,
      "name": "lottr_pmp",
      "type": "DOUBLE PRECISION",
      "display_name": "lottr_pmp"
     },
     {
      "desc": null,
      "name": "year_record",
      "type": "INTEGER",
      "display_name": "year_record"
     },
     {
      "desc": null,
      "name": "state_code",
      "type": "BIGINT",
      "display_name": "state_code"
     },
     {
      "desc": null,
      "name": "travel_time_code",
      "type": "TEXT",
      "display_name": "travel_time_code"
     },
     {
      "desc": null,
      "name": "f_system",
      "type": "BIGINT",
      "display_name": "f_system"
     },
     {
      "desc": null,
      "name": "urban_code",
      "type": "BIGINT",
      "display_name": "urban_code"
     },
     {
      "desc": null,
      "name": "facility_type",
      "type": "BIGINT",
      "display_name": "facility_type"
     },
     {
      "desc": null,
      "name": "nhs",
      "type": "BIGINT",
      "display_name": "nhs"
     },
     {
      "desc": null,
      "name": "segment_length",
      "type": "DOUBLE PRECISION",
      "display_name": "segment_length"
     },
     {
      "desc": null,
      "name": "directionality",
      "type": "TEXT",
      "display_name": "directionality"
     },
     {
      "desc": null,
      "name": "dir_aadt",
      "type": "DOUBLE PRECISION",
      "display_name": "dir_aadt"
     },
     {
      "desc": null,
      "name": "lottr_amp",
      "type": "DOUBLE PRECISION",
      "display_name": "lottr_amp"
     },
     {
      "desc": null,
      "name": "tt_amp50pct",
      "type": "BIGINT",
      "display_name": "tt_amp50pct"
     },
     {
      "desc": null,
      "name": "tt_amp80pct",
      "type": "BIGINT",
      "display_name": "tt_amp80pct"
     },
     {
      "desc": null,
      "name": "lottr_midd",
      "type": "DOUBLE PRECISION",
      "display_name": "lottr_midd"
     },
     {
      "desc": null,
      "name": "tt_midd50pct",
      "type": "BIGINT",
      "display_name": "tt_midd50pct"
     },
     {
      "desc": null,
      "name": "tt_midd80pct",
      "type": "BIGINT",
      "display_name": "tt_midd80pct"
     },
     {
      "desc": null,
      "name": "tt_pmp50pct",
      "type": "BIGINT",
      "display_name": "tt_pmp50pct"
     },
     {
      "desc": null,
      "name": "tt_pmp80pct",
      "type": "BIGINT",
      "display_name": "tt_pmp80pct"
     },
     {
      "desc": null,
      "name": "lottr_we",
      "type": "DOUBLE PRECISION",
      "display_name": "lottr_we"
     },
     {
      "desc": null,
      "name": "tt_we50pct",
      "type": "BIGINT",
      "display_name": "tt_we50pct"
     },
     {
      "desc": null,
      "name": "tt_we80pct",
      "type": "BIGINT",
      "display_name": "tt_we80pct"
     },
     {
      "desc": null,
      "name": "tttr_amp",
      "type": "DOUBLE PRECISION",
      "display_name": "tttr_amp"
     },
     {
      "desc": null,
      "name": "ttt_amp50pct",
      "type": "BIGINT",
      "display_name": "ttt_amp50pct"
     },
     {
      "desc": null,
      "name": "ttt_amp95pct",
      "type": "BIGINT",
      "display_name": "ttt_amp95pct"
     },
     {
      "desc": null,
      "name": "tttr_midd",
      "type": "DOUBLE PRECISION",
      "display_name": "tttr_midd"
     },
     {
      "desc": null,
      "name": "ttt_midd50pct",
      "type": "BIGINT",
      "display_name": "ttt_midd50pct"
     },
     {
      "desc": null,
      "name": "ttt_midd95pct",
      "type": "BIGINT",
      "display_name": "ttt_midd95pct"
     },
     {
      "desc": null,
      "name": "tttr_pmp",
      "type": "DOUBLE PRECISION",
      "display_name": "tttr_pmp"
     },
     {
      "desc": null,
      "name": "ttt_pmp50pct",
      "type": "BIGINT",
      "display_name": "ttt_pmp50pct"
     },
     {
      "desc": null,
      "name": "ttt_pmp95pct",
      "type": "BIGINT",
      "display_name": "ttt_pmp95pct"
     },
     {
      "desc": null,
      "name": "tttr_we",
      "type": "DOUBLE PRECISION",
      "display_name": "tttr_we"
     },
     {
      "desc": null,
      "name": "ttt_we50pct",
      "type": "BIGINT",
      "display_name": "ttt_we50pct"
     },
     {
      "desc": null,
      "name": "ttt_we95pct",
      "type": "BIGINT",
      "display_name": "ttt_we95pct"
     },
     {
      "desc": null,
      "name": "tttr_ovn",
      "type": "DOUBLE PRECISION",
      "display_name": "tttr_ovn"
     },
     {
      "desc": null,
      "name": "ttt_ovn50pct",
      "type": "BIGINT",
      "display_name": "ttt_ovn50pct"
     },
     {
      "desc": null,
      "name": "ttt_ovn95pct",
      "type": "BIGINT",
      "display_name": "ttt_ovn95pct"
     },
     {
      "desc": null,
      "name": "phed",
      "type": "DOUBLE PRECISION",
      "display_name": "phed"
     },
     {
      "desc": null,
      "name": "occ_fac",
      "type": "DOUBLE PRECISION",
      "display_name": "occ_fac"
     },
     {
      "desc": null,
      "name": "metric_source",
      "type": "BIGINT",
      "display_name": "metric_source"
     },
     {
      "desc": null,
      "name": "comments",
      "type": "TEXT",
      "display_name": "comments"
     },
     {
      "desc": null,
      "name": "begindate",
      "type": "TEXT",
      "display_name": "begindate"
     },
     {
      "desc": null,
      "name": "county_name",
      "type": "TEXT",
      "display_name": "county_name"
     },
     {
      "desc": null,
      "name": "county_code",
      "type": "TEXT",
      "display_name": "county_code"
     },
     {
      "desc": null,
      "name": "mpo_code",
      "type": "TEXT",
      "display_name": "mpo_code"
     },
     {
      "desc": null,
      "name": "mpo_name",
      "type": "TEXT",
      "display_name": "mpo_name"
     },
     {
      "desc": null,
      "name": "ua_code",
      "type": "TEXT",
      "display_name": "ua_code"
     },
     {
      "desc": null,
      "name": "ua_name",
      "type": "TEXT",
      "display_name": "ua_name"
     },
     {
      "desc": null,
      "name": "state_name",
      "type": "TEXT",
      "display_name": "state_name"
     },
     {
      "desc": null,
      "name": "road",
      "type": "TEXT",
      "display_name": "road"
     },
     {
      "desc": null,
      "name": "geo_direction",
      "type": "TEXT",
      "display_name": "geo_direction"
     },
     {
      "desc": null,
      "name": "geo_miles",
      "type": "DOUBLE PRECISION",
      "display_name": "geo_miles"
     },
     {
      "desc": null,
      "name": "geo_f_system",
      "type": "INTEGER",
      "display_name": "geo_f_system"
     },
     {
      "desc": null,
      "name": "geo_aadt",
      "type": "BIGINT",
      "display_name": "geo_aadt"
     },
     {
      "desc": null,
      "name": "is_interstate",
      "type": "INTEGER",
      "display_name": "is_interstate"
     },
     {
      "name": "round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1) as lottr_interstate",
      "display_name": "lottr_interstate"
     },
     {
      "name": "round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1) as lottr_non_interstate",
      "display_name": "lottr_non_interstate"
     },
     {
      "name": "round((sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then greatest(\"tttr_amp\",\"tttr_midd\",\"tttr_pmp\",\"tttr_we\",\"tttr_ovn\") * \"segment_length\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" else 0 end), 0))::numeric, 2) as tttr_interstate",
      "display_name": "tttr_interstate"
     }
    ],
    "source_id": 2001,
    "env": "npmrds2",
    "srcEnv": "npmrds2",
    "isDms": false,
    "baseUrl": "/datasources",
    "type": "map_21_extended",
    "view_id": 3394,
    "view_name": "all_years 2016-2025",
    "updated_at": "2026-04-22T16:06:42.952Z"
   },
   "columns": [
    {
     "name": "year_record",
     "type": "INTEGER",
     "display_name": "year_record",
     "show": true,
     "group": true,
     "sort": "desc",
     "hideHeader": true,
     "hideValue": true,
     "justify": "left",
     "customName": "year",
     "valueFontStyle": "textXLBold"
    },
    {
     "name": "case when (round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1)) >= max(t.lottr_interstate_applicable_target) then 'Meets target' else 'Below target' end as status_text",
     "type": "status_pill",
     "display_name": "status_text",
     "show": true,
     "fn": "exempt",
     "formatFn": " ",
     "customName": "Status",
     "valueFontStyle": "textSMBold",
     "headerFontStyle": "metaSM",
     "justify": "left",
     "hideHeader": true,
     "hideValue": false
    },
    {
     "name": "round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1) as lottr_interstate",
     "display_name": "lottr_interstate",
     "show": true,
     "fn": "exempt",
     "formatFn": "percent",
     "customName": "Interstate reliable",
     "valueFontStyle": "displayXL",
     "headerFontStyle": "displayXS",
     "justify": "left",
     "hideHeader": false,
     "hideValue": false,
     "cellSpan": "",
     "cellRowSpan": "",
     "cellBgColor": "",
     "wrapText": false
    },
    {
     "name": "max(t.lottr_interstate_applicable_target) as target_value",
     "type": "calculated",
     "display_name": "target_value",
     "show": true,
     "fn": "exempt",
     "formatFn": " ",
     "customName": "4-yr target",
     "valueFontStyle": "metaSM",
     "headerFontStyle": "metaSM",
     "justify": "left",
     "hideHeader": true,
     "hideValue": true
    },
    {
     "name": "lag(round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1)) over (order by ds.year_record) as lottr_interstate_py",
     "type": "calculated",
     "display_name": "lottr_interstate_py",
     "show": true,
     "fn": "exempt",
     "formatFn": " ",
     "hideHeader": true,
     "hideValue": true,
     "justify": "left",
     "customName": "prior(lag)",
     "valueFontStyle": "textXLBold"
    },
    {
     "name": "round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1) as lottr_interstate_bar",
     "key": "round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1) as lottr_interstate_bar",
     "type": "target_bar",
     "display_name": "lottr_interstate_bar",
     "customName": "4-yr target",
     "show": true,
     "hideHeader": true,
     "hideValue": false,
     "fn": "exempt",
     "justify": "left",
     "targetValue": "75",
     "barMax": "100",
     "barDirection": "up",
     "barUnit": "%"
    },
    {
     "name": "round((round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1)) - (lag(round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1)) over (order by ds.year_record)), 1) as lottr_interstate_delta",
     "type": "delta",
     "display_name": "\u0394 vs prior yr",
     "customName": "\u0394 vs prior yr",
     "show": true,
     "formatFn": " ",
     "valueFontStyle": "metaMD",
     "headerFontStyle": "metaSM",
     "justify": "left",
     "hideHeader": true,
     "hideValue": false,
     "key": "round((round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1)) - (lag(round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1)) over (order by ds.year_record)), 1) as lottr_interstate_delta",
     "fn": "exempt",
     "deltaGoodDirection": "up",
     "deltaYearField": "year_record"
    },
    {
     "name": "abs(round((round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1)) - 75, 1))::text || ' pts ' || case when (round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1)) >= 75 then 'above' else 'below' end || ' target' as lottr_interstate_margin",
     "key": "abs(round((round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1)) - 75, 1))::text || ' pts ' || case when (round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1)) >= 75 then 'above' else 'below' end || ' target' as lottr_interstate_margin",
     "type": "calculated",
     "display_name": "lottr_interstate_margin",
     "customName": "",
     "show": true,
     "hideHeader": true,
     "hideValue": false,
     "fn": "exempt",
     "justify": "left",
     "valueFontStyle": "proseSM",
     "formatFn": " "
    }
   ],
   "filters": {
    "op": "AND",
    "groups": [
     {
      "col": "county_name",
      "op": "filter",
      "value": [],
      "usePageFilters": true,
      "searchParamKey": "county_name"
     },
     {
      "col": "ua_name",
      "op": "filter",
      "value": [],
      "usePageFilters": true,
      "searchParamKey": "ua_name"
     },
     {
      "col": "mpo_name",
      "op": "filter",
      "value": [],
      "usePageFilters": true,
      "searchParamKey": "mpo_name"
     },
     {
      "col": "ds.year_record",
      "op": "filter",
      "value": [
       "2025",
       "2024"
      ],
      "usePageFilters": true,
      "searchParamKey": "year_record",
      "includePriorPeriod": true,
      "priorPeriodStep": 1
     }
    ]
   },
   "display": {
    "usePagination": false,
    "pageSize": 1,
    "totalLength": 1,
    "preventDuplicateFetch": true,
    "showAttribution": false,
    "striped": false,
    "autoResize": false,
    "readyToLoad": true,
    "headerValueLayout": "col",
    "reverse": false,
    "cellsGridSize": 1,
    "cellsGridGap": 6,
    "cardsGridSize": 1,
    "cardsGridGap": 0,
    "cardBorder": false,
    "cellBorder": false,
    "hideSection": false,
    "cardsPadding": 20,
    "fetchMode": "smart"
   },
   "data": [],
   "join": {
    "operator": "=",
    "sources": {
     "t": {
      "source": 2027,
      "view": 3460,
      "env": "npmrds2",
      "srcEnv": "npmrds2",
      "type": "left",
      "mergeStrategy": "join",
      "joinColumns": [
       {
        "dsColumn": "year_record",
        "joinSourceColumn": "year_record"
       }
      ],
      "sourceInfo": {
       "source_id": 2027,
       "view_id": 3460,
       "env": "npmrds2",
       "srcEnv": "npmrds2",
       "isDms": false,
       "baseUrl": "/datasources",
       "type": "csv_dataset",
       "name": "FHWA Map 21 Targets",
       "columns": [
        {
         "desc": null,
         "name": "year_record",
         "type": "INTEGER",
         "display_name": "year_record"
        },
        {
         "desc": null,
         "name": "state_code",
         "type": "TEXT",
         "display_name": "state_code"
        },
        {
         "desc": null,
         "name": "performance_period",
         "type": "TEXT",
         "display_name": "performance_period"
        },
        {
         "desc": null,
         "name": "baseline_year",
         "type": "INTEGER",
         "display_name": "baseline_year"
        },
        {
         "desc": null,
         "name": "lottr_interstate_2_yr_target",
         "type": "DOUBLE PRECISION",
         "display_name": "lottr_interstate_2_yr_target"
        },
        {
         "desc": null,
         "name": "lottr_interstate_4_yr_target",
         "type": "DOUBLE PRECISION",
         "display_name": "lottr_interstate_4_yr_target"
        },
        {
         "desc": null,
         "name": "lottr_interstate_applicable_target",
         "type": "DOUBLE PRECISION",
         "display_name": "lottr_interstate_applicable_target"
        },
        {
         "desc": null,
         "name": "lottr_non_interstate_2_yr_target",
         "type": "TEXT",
         "display_name": "lottr_non_interstate_2_yr_target"
        },
        {
         "desc": null,
         "name": "lottr_non_interstate_4_yr_target",
         "type": "DOUBLE PRECISION",
         "display_name": "lottr_non_interstate_4_yr_target"
        },
        {
         "desc": null,
         "name": "lottr_non_interstate_applicable_target",
         "type": "DOUBLE PRECISION",
         "display_name": "lottr_non_interstate_applicable_target"
        },
        {
         "desc": null,
         "name": "tttr_interstate_2_yr_target",
         "type": "DOUBLE PRECISION",
         "display_name": "tttr_interstate_2_yr_target"
        },
        {
         "desc": null,
         "name": "tttr_interstate_4_yr_target",
         "type": "DOUBLE PRECISION",
         "display_name": "tttr_interstate_4_yr_target"
        },
        {
         "desc": null,
         "name": "tttr_interstate_applicable_target",
         "type": "DOUBLE PRECISION",
         "display_name": "tttr_interstate_applicable_target"
        },
        {
         "desc": null,
         "name": "applicable_target_horizon",
         "type": "TEXT",
         "display_name": "applicable_target_horizon"
        },
        {
         "desc": null,
         "name": "target_set_date",
         "type": "TEXT",
         "display_name": "target_set_date"
        },
        {
         "desc": null,
         "name": "source",
         "type": "TEXT",
         "display_name": "source"
        },
        {
         "desc": null,
         "name": "notes",
         "type": "TEXT",
         "display_name": "notes"
        }
       ]
      }
     }
    }
   },
   "outputSourceInfo": {
    "columns": [
     {
      "name": "year_record",
      "originalName": "year_record",
      "type": "INTEGER",
      "display": "text",
      "source": "passthrough",
      "fn": null,
      "meta_lookup": null
     },
     {
      "name": "round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1) as lottr_interstate",
      "originalName": "round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1) as lottr_interstate",
      "type": "number",
      "display": "number",
      "source": "aggregation",
      "fn": "exempt",
      "meta_lookup": null
     },
     {
      "name": "lag(round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1)) over (order by \"year_record\") as lottr_interstate_py",
      "originalName": "lag(round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1)) over (order by \"year_record\") as lottr_interstate_py",
      "type": "number",
      "display": "number",
      "source": "aggregation",
      "fn": "exempt",
      "meta_lookup": null
     },
     {
      "name": "2250f123-5684-440c-9c17-a0d3e994ee01",
      "originalName": "2250f123-5684-440c-9c17-a0d3e994ee01",
      "type": "number",
      "display": "number",
      "source": "formula",
      "fn": null,
      "meta_lookup": null
     }
    ],
    "isGrouped": true,
    "asUdaConfig": {
     "options": {
      "join": null,
      "filterGroups": {
       "op": "AND",
       "groups": [
        {
         "col": "county_name",
         "op": "filter",
         "value": [],
         "usePageFilters": true,
         "searchParamKey": "county_name"
        },
        {
         "col": "ua_name",
         "op": "filter",
         "value": [],
         "usePageFilters": true,
         "searchParamKey": "ua_name"
        },
        {
         "col": "mpo_name",
         "op": "filter",
         "value": [],
         "usePageFilters": true,
         "searchParamKey": "mpo_name"
        },
        {
         "col": "year_record",
         "op": "filter",
         "value": [
          "2020"
         ],
         "usePageFilters": true,
         "searchParamKey": "year_record",
         "includePriorPeriod": true,
         "priorPeriodStep": 1
        }
       ]
      },
      "groupBy": [
       "year_record"
      ],
      "orderBy": {
       "year_record": "desc"
      },
      "filter": {},
      "exclude": {},
      "normalFilter": [],
      "meta": {},
      "serverFn": {},
      "keepOriginalValues": true
     },
     "attributes": [
      "year_record",
      "round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1) as lottr_interstate",
      "lag(round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1)) over (order by \"year_record\") as lottr_interstate_py"
     ],
     "sourceInfo": {
      "name": "Map 21 Extended ",
      "columns": [
       {
        "desc": null,
        "name": "lottr_pmp",
        "type": "DOUBLE PRECISION",
        "display_name": "lottr_pmp"
       },
       {
        "desc": null,
        "name": "year_record",
        "type": "INTEGER",
        "display_name": "year_record"
       },
       {
        "desc": null,
        "name": "state_code",
        "type": "BIGINT",
        "display_name": "state_code"
       },
       {
        "desc": null,
        "name": "travel_time_code",
        "type": "TEXT",
        "display_name": "travel_time_code"
       },
       {
        "desc": null,
        "name": "f_system",
        "type": "BIGINT",
        "display_name": "f_system"
       },
       {
        "desc": null,
        "name": "urban_code",
        "type": "BIGINT",
        "display_name": "urban_code"
       },
       {
        "desc": null,
        "name": "facility_type",
        "type": "BIGINT",
        "display_name": "facility_type"
       },
       {
        "desc": null,
        "name": "nhs",
        "type": "BIGINT",
        "display_name": "nhs"
       },
       {
        "desc": null,
        "name": "segment_length",
        "type": "DOUBLE PRECISION",
        "display_name": "segment_length"
       },
       {
        "desc": null,
        "name": "directionality",
        "type": "TEXT",
        "display_name": "directionality"
       },
       {
        "desc": null,
        "name": "dir_aadt",
        "type": "DOUBLE PRECISION",
        "display_name": "dir_aadt"
       },
       {
        "desc": null,
        "name": "lottr_amp",
        "type": "DOUBLE PRECISION",
        "display_name": "lottr_amp"
       },
       {
        "desc": null,
        "name": "tt_amp50pct",
        "type": "BIGINT",
        "display_name": "tt_amp50pct"
       },
       {
        "desc": null,
        "name": "tt_amp80pct",
        "type": "BIGINT",
        "display_name": "tt_amp80pct"
       },
       {
        "desc": null,
        "name": "lottr_midd",
        "type": "DOUBLE PRECISION",
        "display_name": "lottr_midd"
       },
       {
        "desc": null,
        "name": "tt_midd50pct",
        "type": "BIGINT",
        "display_name": "tt_midd50pct"
       },
       {
        "desc": null,
        "name": "tt_midd80pct",
        "type": "BIGINT",
        "display_name": "tt_midd80pct"
       },
       {
        "desc": null,
        "name": "tt_pmp50pct",
        "type": "BIGINT",
        "display_name": "tt_pmp50pct"
       },
       {
        "desc": null,
        "name": "tt_pmp80pct",
        "type": "BIGINT",
        "display_name": "tt_pmp80pct"
       },
       {
        "desc": null,
        "name": "lottr_we",
        "type": "DOUBLE PRECISION",
        "display_name": "lottr_we"
       },
       {
        "desc": null,
        "name": "tt_we50pct",
        "type": "BIGINT",
        "display_name": "tt_we50pct"
       },
       {
        "desc": null,
        "name": "tt_we80pct",
        "type": "BIGINT",
        "display_name": "tt_we80pct"
       },
       {
        "desc": null,
        "name": "tttr_amp",
        "type": "DOUBLE PRECISION",
        "display_name": "tttr_amp"
       },
       {
        "desc": null,
        "name": "ttt_amp50pct",
        "type": "BIGINT",
        "display_name": "ttt_amp50pct"
       },
       {
        "desc": null,
        "name": "ttt_amp95pct",
        "type": "BIGINT",
        "display_name": "ttt_amp95pct"
       },
       {
        "desc": null,
        "name": "tttr_midd",
        "type": "DOUBLE PRECISION",
        "display_name": "tttr_midd"
       },
       {
        "desc": null,
        "name": "ttt_midd50pct",
        "type": "BIGINT",
        "display_name": "ttt_midd50pct"
       },
       {
        "desc": null,
        "name": "ttt_midd95pct",
        "type": "BIGINT",
        "display_name": "ttt_midd95pct"
       },
       {
        "desc": null,
        "name": "tttr_pmp",
        "type": "DOUBLE PRECISION",
        "display_name": "tttr_pmp"
       },
       {
        "desc": null,
        "name": "ttt_pmp50pct",
        "type": "BIGINT",
        "display_name": "ttt_pmp50pct"
       },
       {
        "desc": null,
        "name": "ttt_pmp95pct",
        "type": "BIGINT",
        "display_name": "ttt_pmp95pct"
       },
       {
        "desc": null,
        "name": "tttr_we",
        "type": "DOUBLE PRECISION",
        "display_name": "tttr_we"
       },
       {
        "desc": null,
        "name": "ttt_we50pct",
        "type": "BIGINT",
        "display_name": "ttt_we50pct"
       },
       {
        "desc": null,
        "name": "ttt_we95pct",
        "type": "BIGINT",
        "display_name": "ttt_we95pct"
       },
       {
        "desc": null,
        "name": "tttr_ovn",
        "type": "DOUBLE PRECISION",
        "display_name": "tttr_ovn"
       },
       {
        "desc": null,
        "name": "ttt_ovn50pct",
        "type": "BIGINT",
        "display_name": "ttt_ovn50pct"
       },
       {
        "desc": null,
        "name": "ttt_ovn95pct",
        "type": "BIGINT",
        "display_name": "ttt_ovn95pct"
       },
       {
        "desc": null,
        "name": "phed",
        "type": "DOUBLE PRECISION",
        "display_name": "phed"
       },
       {
        "desc": null,
        "name": "occ_fac",
        "type": "DOUBLE PRECISION",
        "display_name": "occ_fac"
       },
       {
        "desc": null,
        "name": "metric_source",
        "type": "BIGINT",
        "display_name": "metric_source"
       },
       {
        "desc": null,
        "name": "comments",
        "type": "TEXT",
        "display_name": "comments"
       },
       {
        "desc": null,
        "name": "begindate",
        "type": "TEXT",
        "display_name": "begindate"
       },
       {
        "desc": null,
        "name": "county_name",
        "type": "TEXT",
        "display_name": "county_name"
       },
       {
        "desc": null,
        "name": "county_code",
        "type": "TEXT",
        "display_name": "county_code"
       },
       {
        "desc": null,
        "name": "mpo_code",
        "type": "TEXT",
        "display_name": "mpo_code"
       },
       {
        "desc": null,
        "name": "mpo_name",
        "type": "TEXT",
        "display_name": "mpo_name"
       },
       {
        "desc": null,
        "name": "ua_code",
        "type": "TEXT",
        "display_name": "ua_code"
       },
       {
        "desc": null,
        "name": "ua_name",
        "type": "TEXT",
        "display_name": "ua_name"
       },
       {
        "desc": null,
        "name": "state_name",
        "type": "TEXT",
        "display_name": "state_name"
       },
       {
        "desc": null,
        "name": "road",
        "type": "TEXT",
        "display_name": "road"
       },
       {
        "desc": null,
        "name": "geo_direction",
        "type": "TEXT",
        "display_name": "geo_direction"
       },
       {
        "desc": null,
        "name": "geo_miles",
        "type": "DOUBLE PRECISION",
        "display_name": "geo_miles"
       },
       {
        "desc": null,
        "name": "geo_f_system",
        "type": "INTEGER",
        "display_name": "geo_f_system"
       },
       {
        "desc": null,
        "name": "geo_aadt",
        "type": "BIGINT",
        "display_name": "geo_aadt"
       },
       {
        "desc": null,
        "name": "is_interstate",
        "type": "INTEGER",
        "display_name": "is_interstate"
       },
       {
        "name": "round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1) as lottr_interstate",
        "display_name": "lottr_interstate"
       },
       {
        "name": "round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1) as lottr_non_interstate",
        "display_name": "lottr_non_interstate"
       },
       {
        "name": "round((sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then greatest(\"tttr_amp\",\"tttr_midd\",\"tttr_pmp\",\"tttr_we\",\"tttr_ovn\") * \"segment_length\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" else 0 end), 0))::numeric, 2) as tttr_interstate",
        "display_name": "tttr_interstate"
       }
      ],
      "source_id": 2001,
      "env": "npmrds2",
      "srcEnv": "npmrds2",
      "isDms": false,
      "baseUrl": "/datasources",
      "type": "map_21_extended",
      "view_id": 3394,
      "view_name": "all_years 2016-2025",
      "updated_at": "2026-04-22T16:06:42.952Z"
     }
    }
   }
  }
 },
 {
  "_from": "2173920",
  "_label": "LOTTR non-Interstate NHS reliability",
  "ed": {
   "externalSource": {
    "name": "Map 21 Extended ",
    "columns": [
     {
      "desc": null,
      "name": "lottr_pmp",
      "type": "DOUBLE PRECISION",
      "display_name": "lottr_pmp"
     },
     {
      "desc": null,
      "name": "year_record",
      "type": "INTEGER",
      "display_name": "year_record"
     },
     {
      "desc": null,
      "name": "state_code",
      "type": "BIGINT",
      "display_name": "state_code"
     },
     {
      "desc": null,
      "name": "travel_time_code",
      "type": "TEXT",
      "display_name": "travel_time_code"
     },
     {
      "desc": null,
      "name": "f_system",
      "type": "BIGINT",
      "display_name": "f_system"
     },
     {
      "desc": null,
      "name": "urban_code",
      "type": "BIGINT",
      "display_name": "urban_code"
     },
     {
      "desc": null,
      "name": "facility_type",
      "type": "BIGINT",
      "display_name": "facility_type"
     },
     {
      "desc": null,
      "name": "nhs",
      "type": "BIGINT",
      "display_name": "nhs"
     },
     {
      "desc": null,
      "name": "segment_length",
      "type": "DOUBLE PRECISION",
      "display_name": "segment_length"
     },
     {
      "desc": null,
      "name": "directionality",
      "type": "TEXT",
      "display_name": "directionality"
     },
     {
      "desc": null,
      "name": "dir_aadt",
      "type": "DOUBLE PRECISION",
      "display_name": "dir_aadt"
     },
     {
      "desc": null,
      "name": "lottr_amp",
      "type": "DOUBLE PRECISION",
      "display_name": "lottr_amp"
     },
     {
      "desc": null,
      "name": "tt_amp50pct",
      "type": "BIGINT",
      "display_name": "tt_amp50pct"
     },
     {
      "desc": null,
      "name": "tt_amp80pct",
      "type": "BIGINT",
      "display_name": "tt_amp80pct"
     },
     {
      "desc": null,
      "name": "lottr_midd",
      "type": "DOUBLE PRECISION",
      "display_name": "lottr_midd"
     },
     {
      "desc": null,
      "name": "tt_midd50pct",
      "type": "BIGINT",
      "display_name": "tt_midd50pct"
     },
     {
      "desc": null,
      "name": "tt_midd80pct",
      "type": "BIGINT",
      "display_name": "tt_midd80pct"
     },
     {
      "desc": null,
      "name": "tt_pmp50pct",
      "type": "BIGINT",
      "display_name": "tt_pmp50pct"
     },
     {
      "desc": null,
      "name": "tt_pmp80pct",
      "type": "BIGINT",
      "display_name": "tt_pmp80pct"
     },
     {
      "desc": null,
      "name": "lottr_we",
      "type": "DOUBLE PRECISION",
      "display_name": "lottr_we"
     },
     {
      "desc": null,
      "name": "tt_we50pct",
      "type": "BIGINT",
      "display_name": "tt_we50pct"
     },
     {
      "desc": null,
      "name": "tt_we80pct",
      "type": "BIGINT",
      "display_name": "tt_we80pct"
     },
     {
      "desc": null,
      "name": "tttr_amp",
      "type": "DOUBLE PRECISION",
      "display_name": "tttr_amp"
     },
     {
      "desc": null,
      "name": "ttt_amp50pct",
      "type": "BIGINT",
      "display_name": "ttt_amp50pct"
     },
     {
      "desc": null,
      "name": "ttt_amp95pct",
      "type": "BIGINT",
      "display_name": "ttt_amp95pct"
     },
     {
      "desc": null,
      "name": "tttr_midd",
      "type": "DOUBLE PRECISION",
      "display_name": "tttr_midd"
     },
     {
      "desc": null,
      "name": "ttt_midd50pct",
      "type": "BIGINT",
      "display_name": "ttt_midd50pct"
     },
     {
      "desc": null,
      "name": "ttt_midd95pct",
      "type": "BIGINT",
      "display_name": "ttt_midd95pct"
     },
     {
      "desc": null,
      "name": "tttr_pmp",
      "type": "DOUBLE PRECISION",
      "display_name": "tttr_pmp"
     },
     {
      "desc": null,
      "name": "ttt_pmp50pct",
      "type": "BIGINT",
      "display_name": "ttt_pmp50pct"
     },
     {
      "desc": null,
      "name": "ttt_pmp95pct",
      "type": "BIGINT",
      "display_name": "ttt_pmp95pct"
     },
     {
      "desc": null,
      "name": "tttr_we",
      "type": "DOUBLE PRECISION",
      "display_name": "tttr_we"
     },
     {
      "desc": null,
      "name": "ttt_we50pct",
      "type": "BIGINT",
      "display_name": "ttt_we50pct"
     },
     {
      "desc": null,
      "name": "ttt_we95pct",
      "type": "BIGINT",
      "display_name": "ttt_we95pct"
     },
     {
      "desc": null,
      "name": "tttr_ovn",
      "type": "DOUBLE PRECISION",
      "display_name": "tttr_ovn"
     },
     {
      "desc": null,
      "name": "ttt_ovn50pct",
      "type": "BIGINT",
      "display_name": "ttt_ovn50pct"
     },
     {
      "desc": null,
      "name": "ttt_ovn95pct",
      "type": "BIGINT",
      "display_name": "ttt_ovn95pct"
     },
     {
      "desc": null,
      "name": "phed",
      "type": "DOUBLE PRECISION",
      "display_name": "phed"
     },
     {
      "desc": null,
      "name": "occ_fac",
      "type": "DOUBLE PRECISION",
      "display_name": "occ_fac"
     },
     {
      "desc": null,
      "name": "metric_source",
      "type": "BIGINT",
      "display_name": "metric_source"
     },
     {
      "desc": null,
      "name": "comments",
      "type": "TEXT",
      "display_name": "comments"
     },
     {
      "desc": null,
      "name": "begindate",
      "type": "TEXT",
      "display_name": "begindate"
     },
     {
      "desc": null,
      "name": "county_name",
      "type": "TEXT",
      "display_name": "county_name"
     },
     {
      "desc": null,
      "name": "county_code",
      "type": "TEXT",
      "display_name": "county_code"
     },
     {
      "desc": null,
      "name": "mpo_code",
      "type": "TEXT",
      "display_name": "mpo_code"
     },
     {
      "desc": null,
      "name": "mpo_name",
      "type": "TEXT",
      "display_name": "mpo_name"
     },
     {
      "desc": null,
      "name": "ua_code",
      "type": "TEXT",
      "display_name": "ua_code"
     },
     {
      "desc": null,
      "name": "ua_name",
      "type": "TEXT",
      "display_name": "ua_name"
     },
     {
      "desc": null,
      "name": "state_name",
      "type": "TEXT",
      "display_name": "state_name"
     },
     {
      "desc": null,
      "name": "road",
      "type": "TEXT",
      "display_name": "road"
     },
     {
      "desc": null,
      "name": "geo_direction",
      "type": "TEXT",
      "display_name": "geo_direction"
     },
     {
      "desc": null,
      "name": "geo_miles",
      "type": "DOUBLE PRECISION",
      "display_name": "geo_miles"
     },
     {
      "desc": null,
      "name": "geo_f_system",
      "type": "INTEGER",
      "display_name": "geo_f_system"
     },
     {
      "desc": null,
      "name": "geo_aadt",
      "type": "BIGINT",
      "display_name": "geo_aadt"
     },
     {
      "desc": null,
      "name": "is_interstate",
      "type": "INTEGER",
      "display_name": "is_interstate"
     },
     {
      "name": "round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1) as lottr_interstate",
      "display_name": "lottr_interstate"
     },
     {
      "name": "round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1) as lottr_non_interstate",
      "display_name": "lottr_non_interstate"
     },
     {
      "name": "round((sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then greatest(\"tttr_amp\",\"tttr_midd\",\"tttr_pmp\",\"tttr_we\",\"tttr_ovn\") * \"segment_length\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" else 0 end), 0))::numeric, 2) as tttr_interstate",
      "display_name": "tttr_interstate"
     }
    ],
    "source_id": 2001,
    "env": "npmrds2",
    "srcEnv": "npmrds2",
    "isDms": false,
    "baseUrl": "/datasources",
    "type": "map_21_extended",
    "view_id": 3394,
    "view_name": "all_years 2016-2025",
    "updated_at": "2026-04-22T16:06:42.952Z"
   },
   "columns": [
    {
     "name": "year_record",
     "type": "INTEGER",
     "display_name": "year_record",
     "show": true,
     "group": true,
     "sort": "desc",
     "hideHeader": true,
     "hideValue": true,
     "justify": "center"
    },
    {
     "name": "case when (round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1)) >= max(t.lottr_non_interstate_applicable_target) then 'Meets target' else 'Below target' end as status_text",
     "type": "status_pill",
     "display_name": "status_text",
     "show": true,
     "fn": "exempt",
     "formatFn": " ",
     "customName": "Status",
     "valueFontStyle": "textSMBold",
     "headerFontStyle": "metaSM",
     "justify": "left",
     "hideHeader": true
    },
    {
     "name": "round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1) as lottr_non_interstate",
     "type": "calculated",
     "display_name": "lottr_non_interstate",
     "show": true,
     "fn": "exempt",
     "formatFn": "percent",
     "customName": "Non-Interstate NHS reliable",
     "valueFontStyle": "displayXL",
     "headerFontStyle": "displayXS",
     "justify": "left",
     "hideHeader": false,
     "hideValue": false
    },
    {
     "name": "max(t.lottr_non_interstate_applicable_target) as target_value",
     "type": "calculated",
     "display_name": "target_value",
     "show": true,
     "fn": "exempt",
     "formatFn": " ",
     "customName": "4-yr target",
     "valueFontStyle": "metaSM",
     "headerFontStyle": "metaSM",
     "justify": "center",
     "hideHeader": true,
     "hideValue": true
    },
    {
     "name": "lag(round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1)) over (order by ds.year_record) as lottr_non_interstate_py",
     "type": "calculated",
     "display_name": "lottr_non_interstate_py",
     "show": true,
     "fn": "exempt",
     "formatFn": " ",
     "hideHeader": true,
     "hideValue": true,
     "justify": "center"
    },
    {
     "name": "round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1) as lottr_non_interstate_bar",
     "key": "round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1) as lottr_non_interstate_bar",
     "type": "target_bar",
     "display_name": "lottr_non_interstate_bar",
     "customName": "4-yr target",
     "show": true,
     "hideHeader": true,
     "hideValue": false,
     "fn": "exempt",
     "justify": "left",
     "targetValue": "70",
     "barMin": "0",
     "barMax": "100",
     "barDirection": "up",
     "barUnit": "%"
    },
    {
     "name": "round((round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1)) - (lag(round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1)) over (order by ds.year_record)), 1) as lottr_non_interstate_delta",
     "type": "delta",
     "display_name": "\u0394 vs prior yr",
     "customName": "\u0394 vs prior yr",
     "show": true,
     "formatFn": " ",
     "valueFontStyle": "metaMD",
     "headerFontStyle": "metaSM",
     "justify": "left",
     "hideHeader": true,
     "hideValue": false,
     "key": "round((round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1)) - (lag(round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1)) over (order by ds.year_record)), 1) as lottr_non_interstate_delta",
     "fn": "exempt",
     "deltaGoodDirection": "up",
     "deltaYearField": "year_record"
    },
    {
     "name": "abs(round((round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1)) - 70, 1))::text || ' pts ' || case when (round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1)) >= 70 then 'above' else 'below' end || ' target' as lottr_non_interstate_margin",
     "key": "abs(round((round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1)) - 70, 1))::text || ' pts ' || case when (round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1)) >= 70 then 'above' else 'below' end || ' target' as lottr_non_interstate_margin",
     "type": "calculated",
     "display_name": "lottr_non_interstate_margin",
     "customName": "",
     "show": true,
     "hideHeader": true,
     "hideValue": false,
     "fn": "exempt",
     "justify": "left",
     "valueFontStyle": "proseSM",
     "formatFn": " "
    }
   ],
   "filters": {
    "op": "AND",
    "groups": [
     {
      "col": "county_name",
      "op": "filter",
      "value": [],
      "usePageFilters": true,
      "searchParamKey": "county_name"
     },
     {
      "col": "ua_name",
      "op": "filter",
      "value": [],
      "usePageFilters": true,
      "searchParamKey": "ua_name"
     },
     {
      "col": "mpo_name",
      "op": "filter",
      "value": [],
      "usePageFilters": true,
      "searchParamKey": "mpo_name"
     },
     {
      "col": "ds.year_record",
      "op": "filter",
      "value": [
       "2025",
       "2024"
      ],
      "usePageFilters": true,
      "searchParamKey": "year_record",
      "includePriorPeriod": true,
      "priorPeriodStep": 1
     }
    ]
   },
   "display": {
    "usePagination": false,
    "pageSize": 1,
    "totalLength": 1,
    "preventDuplicateFetch": true,
    "showAttribution": false,
    "striped": false,
    "autoResize": false,
    "readyToLoad": true,
    "headerValueLayout": "col",
    "reverse": false,
    "cellsGridSize": 1,
    "cellsGridGap": 6,
    "cardsGridSize": 1,
    "cardsGridGap": 0,
    "cardBorder": false,
    "cellBorder": false,
    "cardsPadding": 20,
    "fetchMode": "smart"
   },
   "data": [],
   "join": {
    "operator": "=",
    "sources": {
     "t": {
      "source": 2027,
      "view": 3460,
      "env": "npmrds2",
      "srcEnv": "npmrds2",
      "type": "left",
      "mergeStrategy": "join",
      "joinColumns": [
       {
        "dsColumn": "year_record",
        "joinSourceColumn": "year_record"
       }
      ],
      "sourceInfo": {
       "source_id": 2027,
       "view_id": 3460,
       "env": "npmrds2",
       "srcEnv": "npmrds2",
       "isDms": false,
       "baseUrl": "/datasources",
       "type": "csv_dataset",
       "name": "FHWA Map 21 Targets",
       "columns": [
        {
         "desc": null,
         "name": "year_record",
         "type": "INTEGER",
         "display_name": "year_record"
        },
        {
         "desc": null,
         "name": "state_code",
         "type": "TEXT",
         "display_name": "state_code"
        },
        {
         "desc": null,
         "name": "performance_period",
         "type": "TEXT",
         "display_name": "performance_period"
        },
        {
         "desc": null,
         "name": "baseline_year",
         "type": "INTEGER",
         "display_name": "baseline_year"
        },
        {
         "desc": null,
         "name": "lottr_interstate_2_yr_target",
         "type": "DOUBLE PRECISION",
         "display_name": "lottr_interstate_2_yr_target"
        },
        {
         "desc": null,
         "name": "lottr_interstate_4_yr_target",
         "type": "DOUBLE PRECISION",
         "display_name": "lottr_interstate_4_yr_target"
        },
        {
         "desc": null,
         "name": "lottr_interstate_applicable_target",
         "type": "DOUBLE PRECISION",
         "display_name": "lottr_interstate_applicable_target"
        },
        {
         "desc": null,
         "name": "lottr_non_interstate_2_yr_target",
         "type": "TEXT",
         "display_name": "lottr_non_interstate_2_yr_target"
        },
        {
         "desc": null,
         "name": "lottr_non_interstate_4_yr_target",
         "type": "DOUBLE PRECISION",
         "display_name": "lottr_non_interstate_4_yr_target"
        },
        {
         "desc": null,
         "name": "lottr_non_interstate_applicable_target",
         "type": "DOUBLE PRECISION",
         "display_name": "lottr_non_interstate_applicable_target"
        },
        {
         "desc": null,
         "name": "tttr_interstate_2_yr_target",
         "type": "DOUBLE PRECISION",
         "display_name": "tttr_interstate_2_yr_target"
        },
        {
         "desc": null,
         "name": "tttr_interstate_4_yr_target",
         "type": "DOUBLE PRECISION",
         "display_name": "tttr_interstate_4_yr_target"
        },
        {
         "desc": null,
         "name": "tttr_interstate_applicable_target",
         "type": "DOUBLE PRECISION",
         "display_name": "tttr_interstate_applicable_target"
        },
        {
         "desc": null,
         "name": "applicable_target_horizon",
         "type": "TEXT",
         "display_name": "applicable_target_horizon"
        },
        {
         "desc": null,
         "name": "target_set_date",
         "type": "TEXT",
         "display_name": "target_set_date"
        },
        {
         "desc": null,
         "name": "source",
         "type": "TEXT",
         "display_name": "source"
        },
        {
         "desc": null,
         "name": "notes",
         "type": "TEXT",
         "display_name": "notes"
        }
       ]
      }
     }
    }
   }
  }
 },
 {
  "_from": "2173921",
  "_label": "TTTR Interstate truck reliability",
  "ed": {
   "externalSource": {
    "name": "Map 21 Extended ",
    "columns": [
     {
      "desc": null,
      "name": "lottr_pmp",
      "type": "DOUBLE PRECISION",
      "display_name": "lottr_pmp"
     },
     {
      "desc": null,
      "name": "year_record",
      "type": "INTEGER",
      "display_name": "year_record"
     },
     {
      "desc": null,
      "name": "state_code",
      "type": "BIGINT",
      "display_name": "state_code"
     },
     {
      "desc": null,
      "name": "travel_time_code",
      "type": "TEXT",
      "display_name": "travel_time_code"
     },
     {
      "desc": null,
      "name": "f_system",
      "type": "BIGINT",
      "display_name": "f_system"
     },
     {
      "desc": null,
      "name": "urban_code",
      "type": "BIGINT",
      "display_name": "urban_code"
     },
     {
      "desc": null,
      "name": "facility_type",
      "type": "BIGINT",
      "display_name": "facility_type"
     },
     {
      "desc": null,
      "name": "nhs",
      "type": "BIGINT",
      "display_name": "nhs"
     },
     {
      "desc": null,
      "name": "segment_length",
      "type": "DOUBLE PRECISION",
      "display_name": "segment_length"
     },
     {
      "desc": null,
      "name": "directionality",
      "type": "TEXT",
      "display_name": "directionality"
     },
     {
      "desc": null,
      "name": "dir_aadt",
      "type": "DOUBLE PRECISION",
      "display_name": "dir_aadt"
     },
     {
      "desc": null,
      "name": "lottr_amp",
      "type": "DOUBLE PRECISION",
      "display_name": "lottr_amp"
     },
     {
      "desc": null,
      "name": "tt_amp50pct",
      "type": "BIGINT",
      "display_name": "tt_amp50pct"
     },
     {
      "desc": null,
      "name": "tt_amp80pct",
      "type": "BIGINT",
      "display_name": "tt_amp80pct"
     },
     {
      "desc": null,
      "name": "lottr_midd",
      "type": "DOUBLE PRECISION",
      "display_name": "lottr_midd"
     },
     {
      "desc": null,
      "name": "tt_midd50pct",
      "type": "BIGINT",
      "display_name": "tt_midd50pct"
     },
     {
      "desc": null,
      "name": "tt_midd80pct",
      "type": "BIGINT",
      "display_name": "tt_midd80pct"
     },
     {
      "desc": null,
      "name": "tt_pmp50pct",
      "type": "BIGINT",
      "display_name": "tt_pmp50pct"
     },
     {
      "desc": null,
      "name": "tt_pmp80pct",
      "type": "BIGINT",
      "display_name": "tt_pmp80pct"
     },
     {
      "desc": null,
      "name": "lottr_we",
      "type": "DOUBLE PRECISION",
      "display_name": "lottr_we"
     },
     {
      "desc": null,
      "name": "tt_we50pct",
      "type": "BIGINT",
      "display_name": "tt_we50pct"
     },
     {
      "desc": null,
      "name": "tt_we80pct",
      "type": "BIGINT",
      "display_name": "tt_we80pct"
     },
     {
      "desc": null,
      "name": "tttr_amp",
      "type": "DOUBLE PRECISION",
      "display_name": "tttr_amp"
     },
     {
      "desc": null,
      "name": "ttt_amp50pct",
      "type": "BIGINT",
      "display_name": "ttt_amp50pct"
     },
     {
      "desc": null,
      "name": "ttt_amp95pct",
      "type": "BIGINT",
      "display_name": "ttt_amp95pct"
     },
     {
      "desc": null,
      "name": "tttr_midd",
      "type": "DOUBLE PRECISION",
      "display_name": "tttr_midd"
     },
     {
      "desc": null,
      "name": "ttt_midd50pct",
      "type": "BIGINT",
      "display_name": "ttt_midd50pct"
     },
     {
      "desc": null,
      "name": "ttt_midd95pct",
      "type": "BIGINT",
      "display_name": "ttt_midd95pct"
     },
     {
      "desc": null,
      "name": "tttr_pmp",
      "type": "DOUBLE PRECISION",
      "display_name": "tttr_pmp"
     },
     {
      "desc": null,
      "name": "ttt_pmp50pct",
      "type": "BIGINT",
      "display_name": "ttt_pmp50pct"
     },
     {
      "desc": null,
      "name": "ttt_pmp95pct",
      "type": "BIGINT",
      "display_name": "ttt_pmp95pct"
     },
     {
      "desc": null,
      "name": "tttr_we",
      "type": "DOUBLE PRECISION",
      "display_name": "tttr_we"
     },
     {
      "desc": null,
      "name": "ttt_we50pct",
      "type": "BIGINT",
      "display_name": "ttt_we50pct"
     },
     {
      "desc": null,
      "name": "ttt_we95pct",
      "type": "BIGINT",
      "display_name": "ttt_we95pct"
     },
     {
      "desc": null,
      "name": "tttr_ovn",
      "type": "DOUBLE PRECISION",
      "display_name": "tttr_ovn"
     },
     {
      "desc": null,
      "name": "ttt_ovn50pct",
      "type": "BIGINT",
      "display_name": "ttt_ovn50pct"
     },
     {
      "desc": null,
      "name": "ttt_ovn95pct",
      "type": "BIGINT",
      "display_name": "ttt_ovn95pct"
     },
     {
      "desc": null,
      "name": "phed",
      "type": "DOUBLE PRECISION",
      "display_name": "phed"
     },
     {
      "desc": null,
      "name": "occ_fac",
      "type": "DOUBLE PRECISION",
      "display_name": "occ_fac"
     },
     {
      "desc": null,
      "name": "metric_source",
      "type": "BIGINT",
      "display_name": "metric_source"
     },
     {
      "desc": null,
      "name": "comments",
      "type": "TEXT",
      "display_name": "comments"
     },
     {
      "desc": null,
      "name": "begindate",
      "type": "TEXT",
      "display_name": "begindate"
     },
     {
      "desc": null,
      "name": "county_name",
      "type": "TEXT",
      "display_name": "county_name"
     },
     {
      "desc": null,
      "name": "county_code",
      "type": "TEXT",
      "display_name": "county_code"
     },
     {
      "desc": null,
      "name": "mpo_code",
      "type": "TEXT",
      "display_name": "mpo_code"
     },
     {
      "desc": null,
      "name": "mpo_name",
      "type": "TEXT",
      "display_name": "mpo_name"
     },
     {
      "desc": null,
      "name": "ua_code",
      "type": "TEXT",
      "display_name": "ua_code"
     },
     {
      "desc": null,
      "name": "ua_name",
      "type": "TEXT",
      "display_name": "ua_name"
     },
     {
      "desc": null,
      "name": "state_name",
      "type": "TEXT",
      "display_name": "state_name"
     },
     {
      "desc": null,
      "name": "road",
      "type": "TEXT",
      "display_name": "road"
     },
     {
      "desc": null,
      "name": "geo_direction",
      "type": "TEXT",
      "display_name": "geo_direction"
     },
     {
      "desc": null,
      "name": "geo_miles",
      "type": "DOUBLE PRECISION",
      "display_name": "geo_miles"
     },
     {
      "desc": null,
      "name": "geo_f_system",
      "type": "INTEGER",
      "display_name": "geo_f_system"
     },
     {
      "desc": null,
      "name": "geo_aadt",
      "type": "BIGINT",
      "display_name": "geo_aadt"
     },
     {
      "desc": null,
      "name": "is_interstate",
      "type": "INTEGER",
      "display_name": "is_interstate"
     },
     {
      "name": "round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1) as lottr_interstate",
      "display_name": "lottr_interstate"
     },
     {
      "name": "round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1) as lottr_non_interstate",
      "display_name": "lottr_non_interstate"
     },
     {
      "name": "round((sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then greatest(\"tttr_amp\",\"tttr_midd\",\"tttr_pmp\",\"tttr_we\",\"tttr_ovn\") * \"segment_length\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" else 0 end), 0))::numeric, 2) as tttr_interstate",
      "display_name": "tttr_interstate"
     }
    ],
    "source_id": 2001,
    "env": "npmrds2",
    "srcEnv": "npmrds2",
    "isDms": false,
    "baseUrl": "/datasources",
    "type": "map_21_extended",
    "view_id": 3394,
    "view_name": "all_years 2016-2025",
    "updated_at": "2026-04-22T16:06:42.952Z"
   },
   "columns": [
    {
     "name": "year_record",
     "type": "INTEGER",
     "display_name": "year_record",
     "show": true,
     "group": true,
     "sort": "desc",
     "hideHeader": true,
     "hideValue": true,
     "justify": "center"
    },
    {
     "name": "case when (round((sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then greatest(\"tttr_amp\",\"tttr_midd\",\"tttr_pmp\",\"tttr_we\",\"tttr_ovn\") * \"segment_length\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" else 0 end), 0))::numeric, 2)) <= max(t.tttr_interstate_applicable_target) then 'Meets target' else 'Below target' end as status_text",
     "type": "status_pill",
     "display_name": "status_text",
     "show": true,
     "fn": "exempt",
     "formatFn": " ",
     "customName": "Status",
     "valueFontStyle": "textSMBold",
     "headerFontStyle": "metaSM",
     "justify": "left",
     "hideHeader": true
    },
    {
     "name": "round((sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then greatest(\"tttr_amp\",\"tttr_midd\",\"tttr_pmp\",\"tttr_we\",\"tttr_ovn\") * \"segment_length\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" else 0 end), 0))::numeric, 2) as tttr_interstate",
     "type": "calculated",
     "display_name": "tttr_interstate",
     "show": true,
     "fn": "exempt",
     "formatFn": " ",
     "customName": "Truck TT reliability index",
     "valueFontStyle": "displayXL",
     "headerFontStyle": "displayXS",
     "justify": "left",
     "hideHeader": false,
     "hideValue": false
    },
    {
     "name": "max(t.tttr_interstate_applicable_target) as target_value",
     "type": "calculated",
     "display_name": "target_value",
     "show": true,
     "fn": "exempt",
     "formatFn": " ",
     "customName": "4-yr target",
     "valueFontStyle": "metaSM",
     "headerFontStyle": "metaSM",
     "justify": "center",
     "hideHeader": true,
     "hideValue": true
    },
    {
     "name": "lag(round((sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then greatest(\"tttr_amp\",\"tttr_midd\",\"tttr_pmp\",\"tttr_we\",\"tttr_ovn\") * \"segment_length\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" else 0 end), 0))::numeric, 2)) over (order by ds.year_record) as tttr_interstate_py",
     "type": "calculated",
     "display_name": "tttr_interstate_py",
     "show": true,
     "fn": "exempt",
     "formatFn": " ",
     "hideHeader": true,
     "hideValue": true,
     "justify": "center"
    },
    {
     "name": "round((sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then greatest(\"tttr_amp\",\"tttr_midd\",\"tttr_pmp\",\"tttr_we\",\"tttr_ovn\") * \"segment_length\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" else 0 end), 0))::numeric, 2) as tttr_interstate_bar",
     "key": "round((sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then greatest(\"tttr_amp\",\"tttr_midd\",\"tttr_pmp\",\"tttr_we\",\"tttr_ovn\") * \"segment_length\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" else 0 end), 0))::numeric, 2) as tttr_interstate_bar",
     "type": "target_bar",
     "display_name": "tttr_interstate_bar",
     "customName": "4-yr target",
     "show": true,
     "hideHeader": true,
     "hideValue": false,
     "fn": "exempt",
     "justify": "left",
     "targetValue": "2.0",
     "barMin": "1.0",
     "barMax": "2.2",
     "barDirection": "down",
     "barUnit": ""
    },
    {
     "name": "round((round((sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then greatest(\"tttr_amp\",\"tttr_midd\",\"tttr_pmp\",\"tttr_we\",\"tttr_ovn\") * \"segment_length\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" else 0 end), 0))::numeric, 2)) - (lag(round((sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then greatest(\"tttr_amp\",\"tttr_midd\",\"tttr_pmp\",\"tttr_we\",\"tttr_ovn\") * \"segment_length\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" else 0 end), 0))::numeric, 2)) over (order by ds.year_record)), 2) as tttr_interstate_delta",
     "type": "delta",
     "display_name": "\u0394 vs prior yr",
     "customName": "\u0394 vs prior yr",
     "show": true,
     "formatFn": " ",
     "valueFontStyle": "metaMD",
     "headerFontStyle": "metaSM",
     "justify": "left",
     "hideHeader": true,
     "hideValue": false,
     "key": "round((round((sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then greatest(\"tttr_amp\",\"tttr_midd\",\"tttr_pmp\",\"tttr_we\",\"tttr_ovn\") * \"segment_length\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" else 0 end), 0))::numeric, 2)) - (lag(round((sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then greatest(\"tttr_amp\",\"tttr_midd\",\"tttr_pmp\",\"tttr_we\",\"tttr_ovn\") * \"segment_length\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" else 0 end), 0))::numeric, 2)) over (order by ds.year_record)), 2) as tttr_interstate_delta",
     "fn": "exempt",
     "deltaGoodDirection": "down",
     "deltaYearField": "year_record"
    },
    {
     "name": "abs(round((round((sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then greatest(\"tttr_amp\",\"tttr_midd\",\"tttr_pmp\",\"tttr_we\",\"tttr_ovn\") * \"segment_length\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" else 0 end), 0))::numeric, 2)) - 2.0, 1))::text || ' pts ' || case when (round((sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then greatest(\"tttr_amp\",\"tttr_midd\",\"tttr_pmp\",\"tttr_we\",\"tttr_ovn\") * \"segment_length\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" else 0 end), 0))::numeric, 2)) <= 2.0 then 'below' else 'above' end || ' target' as tttr_interstate_margin",
     "key": "abs(round((round((sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then greatest(\"tttr_amp\",\"tttr_midd\",\"tttr_pmp\",\"tttr_we\",\"tttr_ovn\") * \"segment_length\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" else 0 end), 0))::numeric, 2)) - 2.0, 1))::text || ' pts ' || case when (round((sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then greatest(\"tttr_amp\",\"tttr_midd\",\"tttr_pmp\",\"tttr_we\",\"tttr_ovn\") * \"segment_length\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" else 0 end), 0))::numeric, 2)) <= 2.0 then 'below' else 'above' end || ' target' as tttr_interstate_margin",
     "type": "calculated",
     "display_name": "tttr_interstate_margin",
     "customName": "",
     "show": true,
     "hideHeader": true,
     "hideValue": false,
     "fn": "exempt",
     "justify": "left",
     "valueFontStyle": "proseSM",
     "formatFn": " "
    }
   ],
   "filters": {
    "op": "AND",
    "groups": [
     {
      "col": "county_name",
      "op": "filter",
      "value": [],
      "usePageFilters": true,
      "searchParamKey": "county_name"
     },
     {
      "col": "ua_name",
      "op": "filter",
      "value": [],
      "usePageFilters": true,
      "searchParamKey": "ua_name"
     },
     {
      "col": "mpo_name",
      "op": "filter",
      "value": [],
      "usePageFilters": true,
      "searchParamKey": "mpo_name"
     },
     {
      "col": "ds.year_record",
      "op": "filter",
      "value": [
       "2025",
       "2024"
      ],
      "usePageFilters": true,
      "searchParamKey": "year_record",
      "includePriorPeriod": true,
      "priorPeriodStep": 1
     }
    ]
   },
   "display": {
    "usePagination": false,
    "pageSize": 1,
    "totalLength": 1,
    "preventDuplicateFetch": true,
    "showAttribution": false,
    "striped": false,
    "autoResize": false,
    "readyToLoad": true,
    "headerValueLayout": "col",
    "reverse": false,
    "cellsGridSize": 1,
    "cellsGridGap": 6,
    "cardsGridSize": 1,
    "cardsGridGap": 0,
    "cardBorder": false,
    "cellBorder": false,
    "cardsPadding": 20,
    "fetchMode": "smart"
   },
   "data": [],
   "join": {
    "operator": "=",
    "sources": {
     "t": {
      "source": 2027,
      "view": 3460,
      "env": "npmrds2",
      "srcEnv": "npmrds2",
      "type": "left",
      "mergeStrategy": "join",
      "joinColumns": [
       {
        "dsColumn": "year_record",
        "joinSourceColumn": "year_record"
       }
      ],
      "sourceInfo": {
       "source_id": 2027,
       "view_id": 3460,
       "env": "npmrds2",
       "srcEnv": "npmrds2",
       "isDms": false,
       "baseUrl": "/datasources",
       "type": "csv_dataset",
       "name": "FHWA Map 21 Targets",
       "columns": [
        {
         "desc": null,
         "name": "year_record",
         "type": "INTEGER",
         "display_name": "year_record"
        },
        {
         "desc": null,
         "name": "state_code",
         "type": "TEXT",
         "display_name": "state_code"
        },
        {
         "desc": null,
         "name": "performance_period",
         "type": "TEXT",
         "display_name": "performance_period"
        },
        {
         "desc": null,
         "name": "baseline_year",
         "type": "INTEGER",
         "display_name": "baseline_year"
        },
        {
         "desc": null,
         "name": "lottr_interstate_2_yr_target",
         "type": "DOUBLE PRECISION",
         "display_name": "lottr_interstate_2_yr_target"
        },
        {
         "desc": null,
         "name": "lottr_interstate_4_yr_target",
         "type": "DOUBLE PRECISION",
         "display_name": "lottr_interstate_4_yr_target"
        },
        {
         "desc": null,
         "name": "lottr_interstate_applicable_target",
         "type": "DOUBLE PRECISION",
         "display_name": "lottr_interstate_applicable_target"
        },
        {
         "desc": null,
         "name": "lottr_non_interstate_2_yr_target",
         "type": "TEXT",
         "display_name": "lottr_non_interstate_2_yr_target"
        },
        {
         "desc": null,
         "name": "lottr_non_interstate_4_yr_target",
         "type": "DOUBLE PRECISION",
         "display_name": "lottr_non_interstate_4_yr_target"
        },
        {
         "desc": null,
         "name": "lottr_non_interstate_applicable_target",
         "type": "DOUBLE PRECISION",
         "display_name": "lottr_non_interstate_applicable_target"
        },
        {
         "desc": null,
         "name": "tttr_interstate_2_yr_target",
         "type": "DOUBLE PRECISION",
         "display_name": "tttr_interstate_2_yr_target"
        },
        {
         "desc": null,
         "name": "tttr_interstate_4_yr_target",
         "type": "DOUBLE PRECISION",
         "display_name": "tttr_interstate_4_yr_target"
        },
        {
         "desc": null,
         "name": "tttr_interstate_applicable_target",
         "type": "DOUBLE PRECISION",
         "display_name": "tttr_interstate_applicable_target"
        },
        {
         "desc": null,
         "name": "applicable_target_horizon",
         "type": "TEXT",
         "display_name": "applicable_target_horizon"
        },
        {
         "desc": null,
         "name": "target_set_date",
         "type": "TEXT",
         "display_name": "target_set_date"
        },
        {
         "desc": null,
         "name": "source",
         "type": "TEXT",
         "display_name": "source"
        },
        {
         "desc": null,
         "name": "notes",
         "type": "TEXT",
         "display_name": "notes"
        }
       ]
      }
     }
    }
   }
  }
 },
 {
  "_from": "2173922",
  "_label": "PHED peak-hour excessive delay",
  "ed": {
   "externalSource": {
    "name": "Map 21 Extended ",
    "columns": [
     {
      "desc": null,
      "name": "lottr_pmp",
      "type": "DOUBLE PRECISION",
      "display_name": "lottr_pmp",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "year_record",
      "type": "INTEGER",
      "display_name": "year_record",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "state_code",
      "type": "BIGINT",
      "display_name": "state_code",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "travel_time_code",
      "type": "TEXT",
      "display_name": "travel_time_code",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "f_system",
      "type": "BIGINT",
      "display_name": "f_system",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "urban_code",
      "type": "BIGINT",
      "display_name": "urban_code",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "facility_type",
      "type": "BIGINT",
      "display_name": "facility_type",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "nhs",
      "type": "BIGINT",
      "display_name": "nhs",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "segment_length",
      "type": "DOUBLE PRECISION",
      "display_name": "segment_length",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "directionality",
      "type": "TEXT",
      "display_name": "directionality",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "dir_aadt",
      "type": "DOUBLE PRECISION",
      "display_name": "dir_aadt",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "lottr_amp",
      "type": "DOUBLE PRECISION",
      "display_name": "lottr_amp",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "tt_amp50pct",
      "type": "BIGINT",
      "display_name": "tt_amp50pct",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "tt_amp80pct",
      "type": "BIGINT",
      "display_name": "tt_amp80pct",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "lottr_midd",
      "type": "DOUBLE PRECISION",
      "display_name": "lottr_midd",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "tt_midd50pct",
      "type": "BIGINT",
      "display_name": "tt_midd50pct",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "tt_midd80pct",
      "type": "BIGINT",
      "display_name": "tt_midd80pct",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "tt_pmp50pct",
      "type": "BIGINT",
      "display_name": "tt_pmp50pct",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "tt_pmp80pct",
      "type": "BIGINT",
      "display_name": "tt_pmp80pct",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "lottr_we",
      "type": "DOUBLE PRECISION",
      "display_name": "lottr_we",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "tt_we50pct",
      "type": "BIGINT",
      "display_name": "tt_we50pct",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "tt_we80pct",
      "type": "BIGINT",
      "display_name": "tt_we80pct",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "tttr_amp",
      "type": "DOUBLE PRECISION",
      "display_name": "tttr_amp",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "ttt_amp50pct",
      "type": "BIGINT",
      "display_name": "ttt_amp50pct",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "ttt_amp95pct",
      "type": "BIGINT",
      "display_name": "ttt_amp95pct",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "tttr_midd",
      "type": "DOUBLE PRECISION",
      "display_name": "tttr_midd",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "ttt_midd50pct",
      "type": "BIGINT",
      "display_name": "ttt_midd50pct",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "ttt_midd95pct",
      "type": "BIGINT",
      "display_name": "ttt_midd95pct",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "tttr_pmp",
      "type": "DOUBLE PRECISION",
      "display_name": "tttr_pmp",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "ttt_pmp50pct",
      "type": "BIGINT",
      "display_name": "ttt_pmp50pct",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "ttt_pmp95pct",
      "type": "BIGINT",
      "display_name": "ttt_pmp95pct",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "tttr_we",
      "type": "DOUBLE PRECISION",
      "display_name": "tttr_we",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "ttt_we50pct",
      "type": "BIGINT",
      "display_name": "ttt_we50pct",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "ttt_we95pct",
      "type": "BIGINT",
      "display_name": "ttt_we95pct",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "tttr_ovn",
      "type": "DOUBLE PRECISION",
      "display_name": "tttr_ovn",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "ttt_ovn50pct",
      "type": "BIGINT",
      "display_name": "ttt_ovn50pct",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "ttt_ovn95pct",
      "type": "BIGINT",
      "display_name": "ttt_ovn95pct",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "phed",
      "type": "DOUBLE PRECISION",
      "display_name": "phed",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "occ_fac",
      "type": "DOUBLE PRECISION",
      "display_name": "occ_fac",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "metric_source",
      "type": "BIGINT",
      "display_name": "metric_source",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "comments",
      "type": "TEXT",
      "display_name": "comments",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "begindate",
      "type": "TEXT",
      "display_name": "begindate",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "county_name",
      "type": "TEXT",
      "display_name": "county_name",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "county_code",
      "type": "TEXT",
      "display_name": "county_code",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "mpo_code",
      "type": "TEXT",
      "display_name": "mpo_code",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "mpo_name",
      "type": "TEXT",
      "display_name": "mpo_name",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "ua_code",
      "type": "TEXT",
      "display_name": "ua_code",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "ua_name",
      "type": "TEXT",
      "display_name": "ua_name",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "state_name",
      "type": "TEXT",
      "display_name": "state_name",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "road",
      "type": "TEXT",
      "display_name": "road",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "geo_direction",
      "type": "TEXT",
      "display_name": "geo_direction",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "geo_miles",
      "type": "DOUBLE PRECISION",
      "display_name": "geo_miles",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "geo_f_system",
      "type": "INTEGER",
      "display_name": "geo_f_system",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "geo_aadt",
      "type": "BIGINT",
      "display_name": "geo_aadt",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "is_interstate",
      "type": "INTEGER",
      "display_name": "is_interstate",
      "source_id": 2001
     },
     {
      "name": "round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1) as lottr_interstate",
      "display_name": "lottr_interstate",
      "source_id": 2001
     },
     {
      "name": "round((sum(case when greatest(\"lottr_amp\",\"lottr_midd\",\"lottr_pmp\",\"lottr_we\") >= 1.5 then 0 when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end) / nullif(sum(case when \"f_system\" > 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" * round(\"dir_aadt\"::numeric, 0) * \"occ_fac\" else 0 end), 0) * 100)::numeric, 1) as lottr_non_interstate",
      "display_name": "lottr_non_interstate",
      "source_id": 2001
     },
     {
      "name": "round((sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then greatest(\"tttr_amp\",\"tttr_midd\",\"tttr_pmp\",\"tttr_we\",\"tttr_ovn\") * \"segment_length\" else 0 end) / nullif(sum(case when \"f_system\" = 1 and \"nhs\" in (1,2,3,4,5,6,7,8,9) and \"urban_code\" is not null and \"facility_type\" in (1,2,6) then \"segment_length\" else 0 end), 0))::numeric, 2) as tttr_interstate",
      "display_name": "tttr_interstate",
      "source_id": 2001
     },
     {
      "desc": null,
      "name": "year_record",
      "type": "INTEGER",
      "display_name": "year_record",
      "source_id": 2027
     },
     {
      "desc": null,
      "name": "state_code",
      "type": "TEXT",
      "display_name": "state_code",
      "source_id": 2027
     },
     {
      "desc": null,
      "name": "performance_period",
      "type": "TEXT",
      "display_name": "performance_period",
      "source_id": 2027
     },
     {
      "desc": null,
      "name": "baseline_year",
      "type": "INTEGER",
      "display_name": "baseline_year",
      "source_id": 2027
     },
     {
      "desc": null,
      "name": "lottr_interstate_2_yr_target",
      "type": "DOUBLE PRECISION",
      "display_name": "lottr_interstate_2_yr_target",
      "source_id": 2027
     },
     {
      "desc": null,
      "name": "lottr_interstate_4_yr_target",
      "type": "DOUBLE PRECISION",
      "display_name": "lottr_interstate_4_yr_target",
      "source_id": 2027
     },
     {
      "desc": null,
      "name": "lottr_interstate_applicable_target",
      "type": "DOUBLE PRECISION",
      "display_name": "lottr_interstate_applicable_target",
      "source_id": 2027
     },
     {
      "desc": null,
      "name": "lottr_non_interstate_2_yr_target",
      "type": "TEXT",
      "display_name": "lottr_non_interstate_2_yr_target",
      "source_id": 2027
     },
     {
      "desc": null,
      "name": "lottr_non_interstate_4_yr_target",
      "type": "DOUBLE PRECISION",
      "display_name": "lottr_non_interstate_4_yr_target",
      "source_id": 2027
     },
     {
      "desc": null,
      "name": "lottr_non_interstate_applicable_target",
      "type": "DOUBLE PRECISION",
      "display_name": "lottr_non_interstate_applicable_target",
      "source_id": 2027
     },
     {
      "desc": null,
      "name": "tttr_interstate_2_yr_target",
      "type": "DOUBLE PRECISION",
      "display_name": "tttr_interstate_2_yr_target",
      "source_id": 2027
     },
     {
      "desc": null,
      "name": "tttr_interstate_4_yr_target",
      "type": "DOUBLE PRECISION",
      "display_name": "tttr_interstate_4_yr_target",
      "source_id": 2027
     },
     {
      "desc": null,
      "name": "tttr_interstate_applicable_target",
      "type": "DOUBLE PRECISION",
      "display_name": "tttr_interstate_applicable_target",
      "source_id": 2027
     },
     {
      "desc": null,
      "name": "applicable_target_horizon",
      "type": "TEXT",
      "display_name": "applicable_target_horizon",
      "source_id": 2027
     },
     {
      "desc": null,
      "name": "target_set_date",
      "type": "TEXT",
      "display_name": "target_set_date",
      "source_id": 2027
     },
     {
      "desc": null,
      "name": "source",
      "type": "TEXT",
      "display_name": "source",
      "source_id": 2027
     },
     {
      "desc": null,
      "name": "notes",
      "type": "TEXT",
      "display_name": "notes",
      "source_id": 2027
     }
    ],
    "source_id": 2001,
    "env": "npmrds2",
    "srcEnv": "npmrds2",
    "isDms": false,
    "baseUrl": "",
    "type": "map_21_extended",
    "view_id": 3394,
    "view_name": "all_years 2016-2025",
    "updated_at": "2026-04-22T16:06:42.952Z"
   },
   "columns": [
    {
     "name": "year_record",
     "type": "INTEGER",
     "display_name": "year_record",
     "show": true,
     "group": true,
     "sort": "desc",
     "hideHeader": true,
     "hideValue": true,
     "justify": "left",
     "customName": "year",
     "valueFontStyle": "textXLBold"
    },
    {
     "name": "'UZA measure' as phed_uza_status",
     "display_name": "phed_uza_status",
     "show": true,
     "fn": "exempt",
     "formatFn": " ",
     "customName": "",
     "valueFontStyle": "textSMBold",
     "headerFontStyle": "displayXS",
     "justify": "left",
     "hideHeader": true,
     "hideValue": false,
     "cellSpan": "",
     "cellRowSpan": "",
     "cellBgColor": "",
     "wrapText": false,
     "key": "'UZA measure' as phed_uza_status",
     "type": "status_pill"
    },
    {
     "name": "to_char(round(sum(\"phed\"))::numeric, 'FM999,999,999,999') || ' hr/yr' as phed_total",
     "display_name": "phed_total",
     "show": true,
     "fn": "exempt",
     "formatFn": " ",
     "customName": "Peak-hour excessive delay",
     "valueFontStyle": "displayMD",
     "headerFontStyle": "displayXS",
     "justify": "left",
     "hideHeader": false,
     "hideValue": false,
     "cellSpan": "",
     "cellRowSpan": "",
     "cellBgColor": "",
     "wrapText": false,
     "key": "to_char(round(sum(\"phed\"))::numeric, 'FM999,999,999,999') || ' hr/yr' as phed_total",
     "type": "calculated"
    },
    {
     "name": "'PHED targets are per-capita, per UZA \u2014 set only for New York-Newark and Poughkeepsie-Newburgh.' as phed_note",
     "display_name": "phed_note",
     "show": true,
     "fn": "exempt",
     "formatFn": " ",
     "customName": "",
     "valueFontStyle": "proseSM",
     "headerFontStyle": "displayXS",
     "justify": "left",
     "hideHeader": true,
     "hideValue": false,
     "cellSpan": "",
     "cellRowSpan": "",
     "cellBgColor": "",
     "wrapText": true,
     "key": "'PHED targets are per-capita, per UZA \u2014 set only for New York-Newark and Poughkeepsie-Newburgh.' as phed_note",
     "type": "text"
    }
   ],
   "filters": {
    "op": "AND",
    "groups": [
     {
      "col": "county_name",
      "op": "filter",
      "value": [],
      "usePageFilters": true,
      "searchParamKey": "county_name"
     },
     {
      "col": "ua_name",
      "op": "filter",
      "value": [],
      "usePageFilters": true,
      "searchParamKey": "ua_name"
     },
     {
      "col": "mpo_name",
      "op": "filter",
      "value": [],
      "usePageFilters": true,
      "searchParamKey": "mpo_name"
     },
     {
      "col": "ds.year_record",
      "op": "filter",
      "value": [
       "2025"
      ],
      "usePageFilters": true,
      "searchParamKey": "year_record",
      "includePriorPeriod": true,
      "priorPeriodStep": 1
     }
    ]
   },
   "display": {
    "usePagination": false,
    "pageSize": 1,
    "totalLength": 2,
    "preventDuplicateFetch": true,
    "showAttribution": false,
    "striped": false,
    "autoResize": false,
    "readyToLoad": true,
    "headerValueLayout": "col",
    "reverse": false,
    "cellsGridSize": 1,
    "cellsGridGap": 6,
    "cardsGridSize": 1,
    "cardsGridGap": 0,
    "cardBorder": false,
    "cellBorder": false,
    "cardStyle": "context",
    "cardsPadding": 20,
    "fetchMode": "smart"
   },
   "data": [],
   "join": {
    "operator": "=",
    "sources": {
     "t": {
      "source": 2027,
      "view": 3460,
      "env": "npmrds2",
      "srcEnv": "npmrds2",
      "type": "left",
      "mergeStrategy": "join",
      "joinColumns": [
       {
        "dsColumn": "year_record",
        "joinSourceColumn": "year_record"
       }
      ],
      "sourceInfo": {
       "source_id": 2027,
       "view_id": 3460,
       "env": "npmrds2",
       "srcEnv": "npmrds2",
       "isDms": false,
       "baseUrl": "/datasources",
       "type": "csv_dataset",
       "name": "FHWA Map 21 Targets",
       "columns": [
        {
         "desc": null,
         "name": "year_record",
         "type": "INTEGER",
         "display_name": "year_record"
        },
        {
         "desc": null,
         "name": "state_code",
         "type": "TEXT",
         "display_name": "state_code"
        },
        {
         "desc": null,
         "name": "performance_period",
         "type": "TEXT",
         "display_name": "performance_period"
        },
        {
         "desc": null,
         "name": "baseline_year",
         "type": "INTEGER",
         "display_name": "baseline_year"
        },
        {
         "desc": null,
         "name": "lottr_interstate_2_yr_target",
         "type": "DOUBLE PRECISION",
         "display_name": "lottr_interstate_2_yr_target"
        },
        {
         "desc": null,
         "name": "lottr_interstate_4_yr_target",
         "type": "DOUBLE PRECISION",
         "display_name": "lottr_interstate_4_yr_target"
        },
        {
         "desc": null,
         "name": "lottr_interstate_applicable_target",
         "type": "DOUBLE PRECISION",
         "display_name": "lottr_interstate_applicable_target"
        },
        {
         "desc": null,
         "name": "lottr_non_interstate_2_yr_target",
         "type": "TEXT",
         "display_name": "lottr_non_interstate_2_yr_target"
        },
        {
         "desc": null,
         "name": "lottr_non_interstate_4_yr_target",
         "type": "DOUBLE PRECISION",
         "display_name": "lottr_non_interstate_4_yr_target"
        },
        {
         "desc": null,
         "name": "lottr_non_interstate_applicable_target",
         "type": "DOUBLE PRECISION",
         "display_name": "lottr_non_interstate_applicable_target"
        },
        {
         "desc": null,
         "name": "tttr_interstate_2_yr_target",
         "type": "DOUBLE PRECISION",
         "display_name": "tttr_interstate_2_yr_target"
        },
        {
         "desc": null,
         "name": "tttr_interstate_4_yr_target",
         "type": "DOUBLE PRECISION",
         "display_name": "tttr_interstate_4_yr_target"
        },
        {
         "desc": null,
         "name": "tttr_interstate_applicable_target",
         "type": "DOUBLE PRECISION",
         "display_name": "tttr_interstate_applicable_target"
        },
        {
         "desc": null,
         "name": "applicable_target_horizon",
         "type": "TEXT",
         "display_name": "applicable_target_horizon"
        },
        {
         "desc": null,
         "name": "target_set_date",
         "type": "TEXT",
         "display_name": "target_set_date"
        },
        {
         "desc": null,
         "name": "source",
         "type": "TEXT",
         "display_name": "source"
        },
        {
         "desc": null,
         "name": "notes",
         "type": "TEXT",
         "display_name": "notes"
        }
       ]
      }
     }
    }
   }
  }
 }
];


// ── § 04 · the PM3 panel — ONE Card, the mockup's `col-span-8` combined box ───
//
// STRUCTURE (npmrds-home.html `data-dms-section="map21-body"`): a single
// `rounded-[8px] border bg-white h-full flex flex-col` containing, in order,
//   1. a header strip   `px-4 h-9 flex items-center gap-2 border-b`
//                       ("reporting year 2025" · "change vs 2024"),
//   2. `grid grid-cols-1 sm:grid-cols-2 flex-1` of FOUR compact measure cells,
//      each `px-4 py-3 border-b [border-r] flex flex-col justify-center` holding
//      a label row (dot · name · figure), a bar with a target tick, and a footer
//      row (target caption · delta),
//   3. a footer link row `px-4 py-2.5 flex flex-wrap gap-x-5 mt-auto`.
//
// A Card's cells grid IS that 2x2 — one grid shared by every cell, which is the
// only way the four cells' column edges, their border-r and their border-b line
// up (card-layout.md § "Row rules are per-cell borders"). Four TRACKS, two per
// measure: `name (1fr) · figure (max-content)`; the bar spans both; the caption +
// delta share the third row. `minmax(0,…)`, never a bare `max-content`
// (§ 8.2 failure 1). The header strip and the footer row are cells spanning
// tracks — a spanning item that crosses a flexible track does not contribute to
// intrinsic track sizing, so neither can inflate the figure column.
//
// WHAT IS BOUND (nothing on this panel is typed by hand):
//   · figure          — the report card's own metric expression, verbatim
//   · bar + tick      — `target_bar`, value = the metric, marker = `targetColumn`
//                       pointing at the FHWA applicable target off the join
//                       (the report cards hard-code `targetValue: "75"`; binding
//                        the column instead means the tick can never go stale)
//   · target caption  — the same applicable target, as text
//   · delta           — the report card's own `round(cur − lag(cur), n)` column
//   · header strip    — max(year_record) and max(year_record) − 1
//
// PHED (from 2173922) is the odd one, and stays odd on purpose — see the task
// doc's Escalations. 2027/3460 has NO phed target column at all (its columns are
// lottr_interstate_*, lottr_non_interstate_*, tttr_interstate_*), because PHED
// targets are per-capita per-UZA, which is exactly what 2173922's own note says.
// So PHED gets no target, no tick and no bar — an empty placeholder cell holds the
// slot so the other three rows stay aligned — and its caption states why.
const kpiEd = id => KPI_CARDS.find(k => k._from === id).ed;
// Lift an expression out of a cloned report card BY ALIAS and (optionally) rename
// only the alias, so the SQL that produces the number is provably the same string
// the MAP-21 page sends. Throws rather than silently emitting a wrong column.
const kpiSql = (id, alias, newAlias) => {
  const col = kpiEd(id).columns.find(c => typeof c.name === "string" && c.name.endsWith(` as ${alias}`));
  if (!col) throw new Error(`§04: card ${id} has no column aliased "${alias}"`);
  return newAlias ? col.name.slice(0, -(` as ${alias}`).length) + ` as ${newAlias}` : col.name;
};

// The four measures, in the mockup's reading order (2x2, row-major).
const PM3 = [
  { key: "m1", from: "2173919", name: "Interstate reliability",
    metric: "lottr_interstate", unit: "%", tag: "LOTTR", op: "≥", round: 0,
    target: "max(t.lottr_interstate_applicable_target)", good: "up",
    barMin: "0", barMax: "100" },
  { key: "m2", from: "2173920", name: "Non-Interstate NHS reliability",
    metric: "lottr_non_interstate", unit: "%", tag: "LOTTR", op: "≥", round: 0,
    target: "max(t.lottr_non_interstate_applicable_target)", good: "up",
    barMin: "0", barMax: "100" },
  { key: "m3", from: "2173921", name: "Truck reliability",
    metric: "tttr_interstate", unit: "", tag: "TTTR", op: "≤", round: 2,
    target: "max(t.tttr_interstate_applicable_target)", good: "down",
    // A ratio pinned to a 0-100 scale would sit invisibly near zero; the report
    // card's own 1.0-2.2 window is kept so both surfaces draw the same bar.
    barMin: "1.0", barMax: "2.2" },
];
// PHED's figure: the SAME `sum("phed")` 2173922 reports, at the scale the design
// draws (M hr/yr) instead of `to_char(…,'FM999,999,999,999') || ' hr/yr'`. Same
// number, two renderings — 374,711,700 hr/yr IS 374.7 M hr/yr.
const PHED_M = `round((sum("phed") / 1000000.0)::numeric, 1)`;

const pm3PanelCells = () => {
  const src = kpiEd("2173919");
  // The report cards' own column shape — `fn:'exempt'` + `formatFn:' '`, and NO
  // `origin`. Deliberately not the file's `col()` helper: that stamps
  // `origin:'calculated-column'`, which flips buildUdaConfig's outputColumns source
  // from "aggregation" to "calculated". These expressions ARE the report page's, so
  // they travel with the report page's column shape too.
  const col = (name, extra = {}) =>
    ({ name, type: "calculated", show: true, fn: "exempt", formatFn: " ", hideHeader: true, justify: "left", ...extra });
  // Geometry, straight off the mockup's cell: `px-4 py-3`, the label row, then the
  // bar at `mt-2`, then the footer row at `mt-1`.
  const L16 = { cellPaddingLeft: 16, cellPaddingRight: 8 };   // a measure's left track
  const R16 = { cellPaddingLeft: 8, cellPaddingRight: 16 };   // a measure's right track
  const cells = [
    // GROUP BY + sort. `selectOnly`, NOT `hideValue`: a hidden-but-shown column still
    // occupies a grid slot and would shift every cell after it (Card.jsx, visibleColumns).
    { ...src.columns.find(c => c.name === "year_record"), selectOnly: true, hideValue: true, sort: "desc" },
  ];
  // The applicable targets — fetched, never rendered. `normalName` is what the row is
  // keyed by (getData: `rowWithData[column.normalName || column.name]`), and it is what
  // `target_bar`'s `targetColumn` looks up.
  for (const m of PM3)
    cells.push(col(`${m.target} as ${m.key}_target`, { selectOnly: true, normalName: `${m.key}_target` }));

  // ── 1 · header strip ──
  cells.push(
    col(`'reporting year ' || max(ds.year_record)::text as pm3_hdr_year`, {
      hideHeader: true, valueFontStyle: "metaSM", cellSpan: 2, cellBorderBottom: true,
      // 6/5, not the mockup's own padding: the mockup's `h-9` strip holds a 15px
      // line, live the value div's line box is 23px and every Card cell adds a 1px
      // transparent border top and bottom. 6 + 23 + 5 + 2 = 36 = `h-9`.
      cellPaddingTop: 6, cellPaddingBottom: 5, ...L16 }),
    col(`'change vs ' || (max(ds.year_record) - 1)::text as pm3_hdr_change`, {
      hideHeader: true, valueFontStyle: "unitXS", justify: "right", cellSpan: 2, cellBorderBottom: true,
      cellPaddingTop: 6, cellPaddingBottom: 5, cellPaddingLeft: 8, cellPaddingRight: 16 }),
  );

  // ── 2 · the 2x2 of measure cells, emitted a ROW of the 2x2 at a time so the
  //        column order matches auto-flow (name · figure · name · figure, then the
  //        two bars, then the two caption/delta pairs).
  const M = [...PM3, { key: "m4" }];
  for (const pair of [[0, 1], [2, 3]]) {
    // The mockup's `border-r` sits on the LEFT measure of each row — i.e. on the
    // cells in track 2, whose right edge is the seam between the two halves.
    const side = i => (i === pair[0] ? { ...R16, cellBorderRight: true } : R16);
    // row A — name + figure
    for (const i of pair) {
      const m = M[i];
      const isPhed = m.key === "m4";
      cells.push(
        stat(`${m.key}_name`, isPhed ? "Peak-hour excessive delay" : m.name, "labelMDTrunc1",
          { ...L16, cellPaddingTop: 12, cellPaddingBottom: 0 }),
        col(isPhed ? `${PHED_M} as m4_value` : kpiSql(m.from, m.metric, `${m.key}_value`), {
          type: "stat_value", hideHeader: true, justify: "right",
          valueFontStyle: "statMD", unitFontStyle: "statUnitSM",
          unit: isPhed ? "M hr/yr" : m.unit,
          ...side(i), cellPaddingTop: 9, cellPaddingBottom: 0 }),
      );
    }
    // row B — the bar. PHED has no target in 2027/3460, so it gets an empty
    // placeholder rather than a bar drawn against an invented scale.
    for (const i of pair) {
      const m = M[i];
      if (m.key === "m4") {
        // `hideValue`, not an empty string: an empty value cell still renders its
        // value div, which carries `min-h-[20px]` — the placeholder was making the
        // second bar row 30px against the first's 18. hideValue drops the content and
        // keeps the SLOT (card-layout.md: hideHeader+hideValue hides content, not the slot).
        cells.push(stat("m4_bar_na", "", "unitXS",
          { hideValue: true, cellSpan: 2, ...(i === pair[0] ? { cellBorderRight: true } : {}),
            cellPaddingTop: 8, cellPaddingBottom: 0, cellPaddingLeft: 16, cellPaddingRight: 16 }));
      } else {
        cells.push(col(kpiSql(m.from, `${m.metric}_bar`, `${m.key}_bar`), {
          type: "target_bar", hideHeader: true,
          targetColumn: `${m.key}_target`, barMin: m.barMin, barMax: m.barMax,
          barDirection: m.good, barUnit: m.unit,
          // The mockup puts the target on the footer row beside the delta, not
          // above the bar — this is the column type's own caption, switched off.
          barShowCaption: false,
          cellSpan: 2, ...(i === pair[0] ? { cellBorderRight: true } : {}),
          cellPaddingTop: 8, cellPaddingBottom: 0, cellPaddingLeft: 16, cellPaddingRight: 16 }));
      }
    }
    // row C — target caption + delta, and the cell's bottom rule
    for (const i of pair) {
      const m = M[i];
      const isPhed = m.key === "m4";
      const capSql = isPhed
        // No phed target column exists in 2027/3460 at all — PHED targets are
        // per-capita per UZA (2173922's own note). The design's own copy, verbatim.
        ? `'PHED · uza measure — no statewide target' as m4_caption`
        : `'${m.tag} · ${m.op} ' || round(${m.target}::numeric, ${m.round})::text${m.unit ? ` || '${m.unit}'` : ""} as ${m.key}_caption`;
      cells.push(
        col(capSql, { hideHeader: true, valueFontStyle: "unitXS", cellBorderBottom: true,
          cellPaddingLeft: 16, cellPaddingRight: 0, cellPaddingTop: 4, cellPaddingBottom: 12 }),
        col(isPhed
          // Same lag() shape the other three carry, over the same sum("phed").
          // 2173922 shows no delta; the design's cell does, and the data supports
          // it — logged in the task doc so the report card can gain the same column.
          ? `round((${PHED_M} - (lag(${PHED_M}) over (order by ds.year_record)))::numeric, 1) as m4_delta`
          : kpiSql(m.from, `${m.metric}_delta`, `${m.key}_delta`), {
          type: "delta", hideHeader: true, justify: "right",
          // less delay is better; reliability higher is better; TTTR lower is better
          deltaGoodDirection: isPhed ? "down" : m.good,
          // No `deltaYearField`: the mockup states the comparison ONCE, in the
          // header strip ("change vs 2024"), not on every one of the four cells.
          cellBorderBottom: true, ...side(i), cellPaddingTop: 4, cellPaddingBottom: 12 }),
      );
    }
  }

  // ── 3 · footer link row. A LEXICAL cell: five link decorators on one flex line
  //        is not something four plain cells in a four-track grid can draw, and a
  //        lexical cell is the documented way to put mixed/decorator content in a
  //        Card cell (card-layout.md § "Static lexical cells").
  //        The mockup pins this row with `mt-auto`; a Card cells grid has no row
  //        that absorbs slack, so it sits directly under the 2x2 (logged).
  cells.push(lexCell("pm3_goto", [
    layout(PM3_GOTO_COLS, [
      litem(styled("metaXS", text("go to"))),
      litem(styled("buttonRow", button("per-year", L.map21, "linkMonoXS"))),
      // No live page for map-21-system-performance or map-21-trend yet — both land
      // on the MAP-21 report rather than a dead '#'. Logged in the task doc.
      litem(styled("buttonRow", button("system performance", L.map21, "linkMonoXS"))),
      litem(styled("buttonRow", button("lottr", L.lottr, "linkMonoXS"))),
      litem(styled("buttonRow", button("multi-year trend", L.map21, "linkMonoXS"))),
    ]),
  ], { cellSpan: 4, cellPaddingTop: 5, cellPaddingBottom: 5, cellPaddingLeft: 16, cellPaddingRight: 16 }));

  return cells;
};
// LITERAL (Tailwind v4 scans this file for class names — a concatenated template
// would emit a class that was never compiled). `minmax(0,max-content)`, never bare
// `max-content`: a grid item's automatic minimum size is its min-content, so a bare
// track cannot shrink and the row overflows at 390 (§ 8.2 failure 1).
const PM3_GOTO_COLS = "items-center grid-cols-2 md:grid-cols-[minmax(0,max-content)_minmax(0,max-content)_minmax(0,max-content)_minmax(0,max-content)_minmax(0,max-content)] gap-x-5";

const pm3PanelCard = () => JSON.stringify({
  externalSource: kpiEd("2173919").externalSource,
  columns: pm3PanelCells(),
  filters: kpiEd("2173919").filters,
  join: kpiEd("2173919").join,
  data: [],
  display: {
    usePagination: false, pageSize: 1, totalLength: 1, preventDuplicateFetch: true,
    showAttribution: false, striped: false, autoResize: false, readyToLoad: true,
    headerValueLayout: "col", reverse: false,
    // The SECTION paints the white box (theme radius 8px, one source of chrome), and
    // `context` is the named dataCard style whose `value` is '' — without it theme.value's
    // baked `px-3 pb-3` leaks into every cell and no cell knob can reach it. Its slate
    // shell is overridden inline by cardsPadding/cardsBgColor.
    cardBorder: false, cellBorder: false, cardStyle: "context",
    cardsGridSize: 1, cardsGridGap: 0, cardsPadding: 0, cardsBgColor: "#ffffff",
    cellsGridSize: 4, cellsGridGap: 0,
    cellsTracksTemplate: "minmax(0,1fr) minmax(0,max-content) minmax(0,1fr) minmax(0,max-content)",
    // `smart`: the ds.year_record leaf is a page-filter leaf, so the panel refetches
    // only when a param changes — the MAP-21 page's own behaviour.
    fetchMode: "smart",
  },
});

// ── bands ────────────────────────────────────────────────────────────────────
const B = { hero: randomUUID(), content: randomUUID(), footer: randomUUID() };
const GROUPS = [
  { name: B.hero,    index: 0, theme: "hero",    position: "content", displayName: "Hero" },
  { name: B.content, index: 1, theme: "content", position: "content", displayName: "§01–05 Products + rail" },
  // The rail lives beside the band that owns the first navLabel'd section (the
  // content band). `sidebar` is the reserved group name the page pattern looks for.
  { name: "sidebar", index: 2, theme: "default", position: "sidebar", displayName: "Sidebar" },
  // A footer at position 'bottom' renders full-viewport-width OUTSIDE the layout and
  // would not line up with the sidenav-offset content column — so it is the last
  // CONTENT band wearing the `footer` layoutGroup style (§ 4.2).
  { name: B.footer,  index: 3, theme: "footer",  position: "content", displayName: "Footer" },
];

// ═════════════════════════════════════════════════════════════════════════════
// SECTIONS — draft_sections order IS render order
// ═════════════════════════════════════════════════════════════════════════════
const SECTIONS = [

  // ══════════ HERO ══════════
  // Page header. size 8 = the mockup's max-w-[760px] measure (themev2 MEASURE RULE).
  { group: B.hero, size: "8", data: lexical(
    layout("items-center grid-cols-1 md:grid-cols-[max-content_max-content] gap-x-3", [
      litem(styled("kicker", text("// national performance management research data set"))),
      litem(styled("metaSM", text("new york state · fhwa probe data"))),
    ]),
    styled("displayLG", text("NPMRDS"), text(".", 0, GOLD)),
    styled("proseLG", text("Five-minute travel-time and speed observations on every NHS road segment in New York State. Use it to measure reliability, quantify congestion, evaluate a project before and after, and file the federal MAP-21 performance report.")),
  )},

  // DATA SPINE · the page's only freshness statement (contract item 4 exception).
  // Two bindings at different grains fused into ONE white row by zeroing the
  // shared edge (the mockup's own comment sanctions "a sibling cell").
  { group: B.hero, size: "8", bg: "white", height: "fill",
    border: { top: true, left: true, bottom: true }, radius: { tl: true, bl: true }, padding: { right: "0" },
    elementType: "Card",
    data: card(CH_NPMRDS, [
      calc("replaceAll(concat(formatDateTime(min(date), '%b %e, %Y'), ' – ', formatDateTime(max(date), '%b %e, %Y')), '  ', ' ') as extent", {
        customName: "data available", valueFontStyle: "displayXS", headerFontStyle: "metaXS", hideHeader: false }),
      calc("toString(round(count() / 1000000000, 2)) as observations", {
        type: "stat_value", unit: " billion", customName: "observations",
        valueFontStyle: "displayXS", headerFontStyle: "metaXS", hideHeader: false }),
    ], { cellsGridSize: 2, cellsGridGap: 12, cardsPadding: 6, headerValueLayout: "col", fetchMode: "force" }) },

  { group: B.hero, size: "4", bg: "white", height: "fill",
    border: { top: true, right: true, bottom: true }, radius: { tr: true, br: true }, padding: { left: "0" },
    elementType: "Card",
    // GROUP BY year + sort desc + pageSize 1 ⇒ the newest vintage, always. A literal
    // `year = 2026` filter would silently go a year stale.
    data: card(CH_META, [
      { name: "year", type: "INTEGER", display_name: "year", show: true, group: true, sort: "desc", selectOnly: true },
      calc("concat('road segments · ', toString(any(year)), ' map') as segments_label", {
        valueFontStyle: "metaXS", hideHeader: true }),
      calc("concat(toString(intDiv(count(), 1000)), ',', leftPad(toString(count() % 1000), 3, '0')) as tmc_count", {
        type: "stat_value", unit: " TMCs", valueFontStyle: "displayXS", hideHeader: true }),
    ], { cellsGridSize: 1, cellsGridGap: 0, cardsPadding: 6, totalLength: 12, fetchMode: "force" }) },

  // ══════════ § 01 · MACRO VIEW ══════════
  { group: B.content, size: "12", navLabel: "Macro View", anchorId: "macro",
    data: bandHead("01", "statewide · one measure, one year at a time · 11 regions", "Macro View.",
      { text: "open macro view →", path: L.macro }) },

  { group: B.content, size: "4", border: "full", height: "fill", elementType: "Card", data: doorwayCard({
    tab: "statewide map", tabColor: "#1F3F8F", shield: "productShieldBlue", iconName: "GeographicFlexibility",
    title: "Macro View",
    prose: "Every performance measure, mapped on the whole NHS network. Filter to a region, read the distribution against the definition, download exactly what the map is drawing.",
    links: [{ text: "Measure reference →", path: L.macro }, { text: "Download →", path: L.macro }],
    cta: { text: "Open Macro View", path: L.macro, style: "ctaRailBlue" },
  })},

  // The eight measures — a CARD of static lexical cells (see measureCells() above).
  // `cardStyle:'context'` is picked ONLY for its `value: ""` — the default dataCard
  // value wrapper bakes `px-3 pb-3` into every cell, which no per-cell knob can
  // reach; the named style drops it so cellPadding* owns the geometry outright.
  // Its slate shell is overridden inline by cardsPadding/cardsBgColor.
  { group: B.content, size: "8", border: "full", height: "fill",
    elementType: "Card",
    data: card(CH_META, measureCells(), {
      cardStyle: "context", cellsGridSize: 6, cellsGridGap: 0,
      cardsPadding: 0, cardsBgColor: "#ffffff",
      // ── VERTICAL RHYTHM (2026-08-13) ────────────────────────────────────────
      // `cellsVAlign: 'center'` was REMOVED here. align-self:center shrink-wraps a
      // cell inside its row, so each cell's `cellBorderBottom` floats at its OWN
      // bottom edge — the eight rules stopped being one line and the column divider
      // became a dashed stub (visible in the before crop: the 45px name cell's rule
      // sat 12px above the 69px description cell's). Unset = the grid default
      // `stretch`, so every cell fills its row and the rules line up.
      // The mockup gets BOTH (its row is one <a> with `items-center`); a Card cell
      // can fill its row OR center its content, not both — logged as an escalation.
      //
      // ⚠ `cellsVerticalAlign: 'stretch'` is DELIBERATELY NOT SET here, even though the
      // key was fixed on 2026-08-14 (it now emits `align-content: stretch`, which really
      // does distribute the leftover — see `readyMadeCard` above, where it IS set).
      // Measured on this card: there is no slack at all from 1480 up (0.7px at 1480/1560,
      // 0 at ≥1600), and where slack does exist the fix would spend it on the header
      // strip too — `align-content: stretch` gives every row an EQUAL share, so the 49px
      // header went 49 → 56 at 1440 and 60.5 → 80.1 at 1280. This card wants "ONE row
      // absorbs it all" (the mockup's `mt-auto`), which is the still-open half of
      // `src/dms/planning/tasks/current/card-cell-row-slack-absorption.md`.
      // (The pre-fix implementation was worse still: `gridAutoRows: minmax(max-content,
      // 1fr)` sized EVERY row to the tallest row's max-content — 49 → 56 even at 1680,
      // where there is no slack to distribute at all.)
      // minmax(0,…) on every track: a bare `max-content` track can't shrink below
      // its content, which is the default mobile-overflow bug on these pages (P5).
      //
      // ⚠ 2 MEASURES ACROSS × 3 PARTS = 6 tracks, and `cellsTracksTemplate` is an INLINE
      // style, so this ONE template governs every viewport — the mockup's
      // `grid-cols-1 sm:grid-cols-2` collapse is not expressible (a lexical
      // layout-container's templateColumns IS responsive because it's a Tailwind class).
      // Consequence, measured: at 390px the two `1fr` description tracks are squeezed to
      // ~1px and the text overlaps the unit column (c4_measures_mobile.png). Kept 2-across
      // because 1-across (below) makes the § 01 band 410px tall against a 323px doorway
      // card and opens a ~150px void beside it (c5_band01.png) — the mockup composes the
      // two cards at equal height. ONE-LINE FLIP if mobile wins:
      //   "76px minmax(0,1fr) minmax(0,max-content)"  + cellsGridSize 3
      //   + header cellSpans 2/1, isLastRow `>= MEASURES.length - 1`, cellBorderRight false
      // Logged in the task doc's Escalations; the real fix is a responsive
      // cellsTracksTemplate (breakpoint map or class string).
      // ── HORIZONTAL RHYTHM (2026-08-14) ──────────────────────────────────────
      // The name track was 76px: the mockup's `w-16` (64px) name box scaled from its
      // 15px type to this page's 12.5px `labelSM`, plus 16+8 of cell padding. That
      // reserved 52px of box for a 41px longest name ("Freeflow"), and every reserved
      // pixel here is a pixel the `1fr` description track does NOT get — twice over,
      // because there are two halves. 66px = 16 padL + 41 name + 8 padR + 1 of slack,
      // which hands 20px back to the two description tracks (+10 each). The names are
      // left-aligned, so nothing about them moves; only the description column starts
      // 10px earlier. Do NOT go below 66 — at 65 "Freeflow" has zero slack and any
      // font shift wraps it.
      cellsTracksTemplate: "66px minmax(0,1fr) minmax(0,max-content) 66px minmax(0,1fr) minmax(0,max-content)",
      // ── SLACK ABSORPTION, PHASE 2 (2026-08-14) ──────────────────────────────
      // This panel is the case Phase 1 could NOT serve (see the note above): it has
      // real slack at narrow widths, but `align-content: stretch` alone hands the
      // header strip an equal share of it (49 → 52.8 at 1480, 60.5 → 83.8 at 1280).
      // `cellsRowsTemplate` (the row-axis peer of cellsTracksTemplate, shipped with
      // Phase 2) fixes exactly that: `max-content` makes row 1 an EXPLICIT
      // content-sized track, and CSS Grid §12.9 only grows tracks whose max sizing
      // function is `auto` — so the header is skipped and the four measure rows
      // split the leftover between them. Measured on /edit/home:
      //   width   header      measure rows      slack
      //   1280    60.5 (=)    50.4 → 79.5       116.4 → 0
      //   1366    49   (=)    50.4 → 68.7        72.7 → 0
      //   1440    49   (=)    50.4 → 63.8        53.4 → 0
      //   1480    49   (=)    50.4 → 55.2        19.1 → 0   ← mockup row is 55.9
      // Naming only row 1 leaves every other row implicit, so nothing here has to
      // know how many measures there are.
      cellsVerticalAlign: "stretch",
      cellsRowsTemplate: "max-content",
      // ── CONTENT INSIDE THE (STRETCHED) ROW, 2026-08-14 ──────────────────────
      // The two keys above make the four measure rows absorb the card's slack; this
      // one says where the text sits inside them. It is NOT `cellsVAlign` — that is
      // `align-self`, which shrink-wraps each cell so its `cellBorderBottom` leaves
      // the row's edge (measured here: 13 rule segments at 13 different y instead of
      // 5 continuous ones, and the cells collapse 81.7 → 47.3/50.4/44.5). This key
      // emits no align-self at all: the cells keep filling the row (rules unmoved,
      // `spread = 0` across all three parts of all 8 rows) and only the content moves.
      // At 1280 a row is 81.7px holding 16.3px of text; before: 15 above / 47.4
      // below. After: 30.7 / 31.7 — and the header strip, which is NOT part of this
      // (it is its own `max-content` row), is untouched at 60.5px.
      // The knob also RETIRES the two hand-computed padding bumps in measureCells().
      cellsContentVAlign: "center",
      totalLength: 1, fetchMode: "force",
    }) },

  // ══════════ § 02 · REPORTS ══════════
  // The head's meta line carries the only bindable § 02 figure, so the eyebrow row
  // is a Card (static chrome cells + one live aggregate) fused above the title.
  { group: B.content, size: "12", navLabel: "Reports", anchorId: "reports", padding: { bottom: "0" },
    elementType: "Card",
    data: card(ROUTES, [
      stat("kicker", "// 02", "kicker"),
      stat("library", "869 in the library ·", "metaSM"),
      // isDms ⇒ the column lives in the `data` JSONB, and the expression must
      // contain NO COMMAS (reference_dms_calc_column_no_commas).
      { name: "count(distinct data->>'route_id') as saved_routes", origin: "calculated-column",
        fn: "exempt", formatFn: "comma", show: true, hideHeader: true, justify: "left",
        valueFontStyle: "metaSM", cellPadding: 0 },
      stat("ready", "saved routes · 12 ready-made", "metaSM"),
    ], { cellsGridSize: 4, cellsGridGap: 4, cellsPadding: 0, cardsPadding: 0,
         cellsTracksTemplate: "minmax(0,max-content) minmax(0,max-content) minmax(0,max-content) minmax(0,1fr)",
         totalLength: 1, fetchMode: "force" }) },

  { group: B.content, size: "12", padding: { top: "0" }, data: lexical(
    layout("items-center grid-cols-[1fr_max-content] gap-x-3", [
      litem(styled("displaySM", text("Reports."))),
      litem(para(button("open reports →", L.reports, "linkMono"))),
    ]),
  )},

  { group: B.content, size: "4", border: "full", height: "fill", elementType: "Card", data: doorwayCard({
    tab: "start something", tabColor: "#37576B", shield: "productShieldSlate", iconName: "Report",
    title: "New report",
    prose: "A report is a page: routes in the left rail, graphs bound to them. Start blank and add your own graphs, or take a ready-made report beside this and just supply the route.",
    links: [{ text: "Search 869 →", path: L.reports }, { text: "Your 7 →", path: L.reports }],
    extra: doorwayChips({
      label: "6 more ready-made, by question",
      chips: ["floating car", "before & after", "events"],
    }),
    cta: { text: "Create a report", path: L.reportIndex, style: "ctaRailSlate" },
  })},

  { group: B.content, size: "4", border: "full", height: "fill", elementType: "Card", data: readyMadeCard({
    iconName: "Activity", kicker: "// behavioral", count: "3", title: "How the road behaves",
    prose: "Ready-made reports for normal conditions — what a typical day, week or season actually looks like.",
    rows: [
      { title: "Snapshot", path: L.rSnapshot, desc: "One route, one window, every measure at five-minute resolution." },
      { title: "Seasonality", path: L.rSeasonality, desc: "Winter, spring, summer and fall on one axis." },
      { title: "Bi-directional", path: L.rBidirectional, desc: "Two routes, opposite directions, paired on every graph." },
    ],
    foot: "1 route · 2 for bi-directional",
  })},

  { group: B.content, size: "4", border: "full", height: "fill", elementType: "Card", data: readyMadeCard({
    iconName: "History", kicker: "// change over time", count: "3", title: "Whether it changed",
    prose: "Ready-made reports that put two or more periods side by side and show the difference.",
    rows: [
      { title: "Year over year", path: L.rYoY, desc: "Same window, consecutive years, stacked for comparison." },
      { title: "This month vs. last month vs. last year", path: L.rThreeWay, desc: "Three-way rolling comparison for a monthly memo." },
      { title: "Monthly congestion", path: L.rMonthlyCongestion, desc: "Delay and excessive-delay hours, by month." },
    ],
    foot: "1 route · dates from the template",
  })},

  // ══════════ § 03 · ROUTE COMPARISON ══════════
  { group: B.content, size: "12", navLabel: "Route comparison", anchorId: "comparison",
    data: bandHead("03", "many routes × many periods · one cross-tab", "Route comparison.",
      { text: "open route comparison →", path: L.comparison }) },

  { group: B.content, size: "4", border: "full", height: "fill", elementType: "Card", data: doorwayCard({
    tab: "batch tool", tabColor: "#8A5F03", shield: "productShieldGold", iconName: "ScatterMatrix",
    title: "Route comparison",
    prose: "Rows are routes, columns are periods × metrics, cells compute on demand. Typical use: every corridor in a region against the same month last year, exported as one table.",
    links: [{ text: "Batch Reports API →", path: L.docBatchApi }],
    cta: { text: "Build a cross-tab", path: L.comparison, style: "ctaRailGold" },
  })},

  { group: B.content, size: "8", border: "full", height: "fill", data: lexical(
    layout("items-center grid-cols-[1fr_max-content] gap-x-3", [
      litem(styled("metaSM", text("what a run gives you"))),
      // contract item 7 · download affordance, section-header right
      litem(styled("metaXS", icon("Download"), text(" csv"))),
    ]),
    styled("metaXS", text("metrics per cell")),
    para(text("speed", 0, CHIP), text("travel time", 0, CHIP), text("delay", 0, CHIP), text("% change vs base", 0, CHIP_ON)),
    styled("metaXS", text("period modes")),
    para(text("fixed dates", 0, CHIP), text("each route's own", 0, CHIP), text("relative to base", 0, CHIP)),
    styled("metaXS", text("vehicle class")),
    para(text("all vehicles", 0, CHIP), text("freight trucks", 0, CHIP), text("passenger", 0, CHIP)),
    hr(),
    para(button("run it from the API instead →", L.docBatchApi, "linkMono")),
  )},

  // ══════════ § 04 · MAP-21 PM3 ══════════
  { group: B.content, size: "12", navLabel: "MAP-21 PM3", anchorId: "map21",
    data: bandHead("04", "cy 2025 · 23 cfr 490 subparts e–g", "MAP-21 PM3.",
      { text: "open map-21 →", path: L.map21 }) },

  // ONE row: the doorway (4) beside the ONE combined PM3 panel (8), which is how the
  // mockup draws it — `col-span-4` next to a single `col-span-8` box. `rowspan: "2"`
  // was needed only while the band was four separate KPI card sections stacked 2x2;
  // with one panel section there is no second row to span, and leaving it on would
  // reserve an empty grid row. `height: "fill"` stays — it is what makes the doorway
  // match the panel's height (the mockup's `flex flex-col h-full`).
  { group: B.content, size: "4", border: "full", height: "fill", elementType: "Card", data: doorwayCard({
    tab: "cy 2025", tabColor: "#0F2D4D", shield: "productShieldNavy", iconName: "Activity",
    title: "MAP-21 PM3",
    // The mockup's closing sentence ("Two of the four measures are currently below
    // target") is FALSE against view 3394 today — all three scored measures meet
    // their applicable target. Dropped rather than shipped wrong; the KPI cards
    // beside this card state the live position. Backported into the mockup.
    prose: "The federal performance report against agency-set four-year targets, by segment, region and MPO.",
    links: [{ text: "23 CFR 490 →", path: L.docPm3 }, { text: "Methodology →", path: L.map21 }],
    cta: { text: "Open PM3 report", path: L.map21, style: "ctaRail" },
  })},

  // The mockup's ONE `col-span-8` panel: header strip + 2x2 measure cells + the
  // "go to" footer row, all inside one bordered white box. Replaces the four
  // full-size report-card clones (2173919/20/21/22) AND the 4-col spacer + the
  // separate "go to" lexical section they needed — 6 sections became 1. The
  // bindings are unchanged; see pm3PanelCard() for how each expression is lifted
  // out of the clones by alias.
  { group: B.content, size: "8", bg: "white", border: "full", height: "fill",
    elementType: "Card", data: pm3PanelCard() },

  // ══════════ § 05 · ABOUT ══════════
  { group: B.content, size: "12", navLabel: "About the data", anchorId: "about",
    data: bandHead("05", "before you quote a number", "What NPMRDS is good at — and what it isn't.") },

  { group: B.content, size: "4", border: "full", height: "fill", data: lexical(
    styled("displayXS", text("What it is")),
    styled("prose", text("Anonymised probe observations — vehicles reporting position and speed — aggregated by FHWA to five-minute averages on each TMC road segment. NYSDOT receives the New York extract; AVAIL loads, validates and indexes it for query.")),
  )},

  { group: B.content, size: "4", border: "full", height: "fill", data: lexical(
    styled("displayXS", text("Strengths")),
    ...[
      "Continuous, statewide, nine-plus years deep — no field deployment needed.",
      "Consistent method year over year, so before-and-after comparisons are fair.",
      "Separate all-vehicle, truck and passenger feeds for freight work.",
    ].map(t => styled("proseSM", text("✓  ", 0, OK_MARK), text(t))),
  )},

  { group: B.content, size: "4", border: "full", height: "fill", data: lexical(
    styled("displayXS", text("Limits")),
    ...[
      "It measures speed, not volume. Pair with AADT for delay and cost.",
      "Low-volume rural segments have thin samples; short windows get noisy.",
      "The TMC map changes between vintages — segment IDs are not eternal.",
    ].map(t => styled("proseSM", text("⚠  ", 0, WARN_MARK), text(t))),
  )},

  // ══════════ RAIL · the `sidebar` group ══════════
  // The "on this page" nav card above this is rendered by InPageNav from the five
  // navLabel'd sections — it is not a section and must not be authored as one.
  //
  // ⚠ `padding: { left: "0", right: "0" }` is what makes the two rail cards the SAME
  // WIDTH. InPageNav is not a section, so it paints straight onto the 294px rail
  // column; this card IS a section, so it also gets the section wrapper's default
  // `p-3` (pages theme `defaultPaddingStep: "3"`) and measured 270px against the
  // nav's 294 — 12px narrower on each side, which reads as a misaligned rail.
  // X ONLY: the vertical padding is the gap BETWEEN the two cards inside the rail's
  // sticky wrapper, and zeroing it would fuse them.
  { group: "sidebar", size: "12", border: "full", padding: { left: "0", right: "0" }, data: lexical(
    layout("items-center grid-cols-[max-content_1fr] gap-x-2", [
      litem(para(icon("Book"))),
      litem(styled("cardTitleSM", text("Documentation"))),
    ]),
    hr(),
    styled("kicker", text("// new here?")),
    ...[["1", "Build a route"], ["2", "Put it in a report"], ["3", "Read the measure"]]
      .map(([n, t]) => styled("proseSM", text(`${n}  `, 0, STEPNUM), text(t))),
    para(button("walk me through it →", L.docQuickStart, "linkMono")),
    hr(),
    // Every npmrds_docs page — a docs index's completeness is its content.
    ...[
      ["NPMRDS overview", L.docOverview],
      ["Quick start", L.docQuickStart],
      ["Route analysis", L.docRoute],
      ["Regional analysis", L.docRegional],
      ["PM3 measures", L.docPm3],
      ["Batch reports", L.docBatch],
      ["Batch Reports API", L.docBatchApi],
      ["Training videos", L.docVideos],
      ["Appendix & glossary", L.docAppendix],
    ].map(([t, p]) => para(button(t, p, "cardlink"))),
    hr(),
    para(button("all documentation", L.docOverview, "linkMono")),
  )},

  // ══════════ FOOTER ══════════
  { group: B.footer, size: "12", data: lexical(
    layout("w-full !mt-0 items-center grid-cols-1 md:grid-cols-[max-content_1fr_max-content]", [
      litem(para(
        button("macro-view", L.macro, "plain"),
        button("reports", L.reports, "plain"),
        button("report", L.reportIndex, "plain"),
        button("route-comparison", L.comparison, "plain"),
        button("map-21", L.map21, "plain"),
        button("docs", L.docOverview, "plain"),
      )),
      litem(para(text(""))),
      litem(styled("metaXS", text("© NYSDOT · TransportNY DMS v0.2"))),
    ]),
  )},
];

// offline guard — a nested layout-container renders empty/scrambled at runtime
SECTIONS.forEach((s, i) => { if ((s.elementType || "lexical") === "lexical") assertFlat(s.data, `SECTIONS[${i}]`); });
// offline guard — a lexical CELL's staticValue must be a BARE {root:…} document.
// The section envelope ({text:{root:…}}) fails LexicalView's isLexicalJSON() test and
// renders as literal JSON text in the cell, which is silent and very ugly.
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

// Offline inspection escape: `SECTIONS_DUMP=<index> node …` prints one section's
// element-data and exits WITHOUT touching the live page. Cheap way to eyeball a
// generated Card's columns/SQL before spending a build cycle on it.
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
  // The pattern's `/` landing item is `index === 0 && parent === ''`, which today is
  // map_21 (2173915). Take the next free index instead of stealing it — promoting
  // `home` to the landing page is the owner's call (task doc, Open decisions).
  cli("page", "update", String(id), "--data", tmp("page.json", { index: maxIndex + 1, sidebar: "right" }));
  page = { id };
  console.log(`created page ${id} (slug ${SLUG}, index ${maxIndex + 1})`);
}
const PAGE = String(page.id);
console.log(`page: ${PAGE} (${PATTERN}/${SLUG}) on ${ENV.DMS_HOST} ${ENV.DMS_APP}/${ENV.DMS_TYPE}`);

// 0 · § 01 deep-link preflight. The eight rows are an authored design artifact; the five
//     that may carry `?measure=` are NOT — that comes from the plugin's own record. Refuse
//     to build a row that names a measure the plugin does not know at all (a typo here
//     would ship eight identical `/macro` links and look like it worked).
{
  const unknown = MEASURES.filter(([, , , k]) => !MACRO_MEASURES[k]).map(([n, , , k]) => `${n}→${k}`);
  if (unknown.length) {
    console.error(`\nREFUSING TO BUILD: § 01 names measure keys the macro plugin does not have: ${unknown.join(", ")}`);
    process.exit(1);
  }
  const linked = MEASURES.filter(([, , , k]) => MACRO_MEASURES[k].available);
  console.log(`§ 01 deep links (${linked.length} of ${MEASURES.length} measures are computed by pm3):`);
  MEASURES.forEach(([n, , , k]) => console.log(`  ${n.padEnd(9)} → ${MEASURE_HREF(k)}${MACRO_MEASURES[k].available ? "" : "   (not computed — plain /macro)"}`));
}

// 1 · runtime parity guard — never wipe live authoring away silently
const existing = jget(PAGE).data.draft_sections || [];
if (existing.length && existing.length !== SECTIONS.length && process.env.ALLOW_SECTION_COUNT_CHANGE !== "1") {
  console.error(
    `\nREFUSING TO WIPE ${PATTERN}/${SLUG} (page ${PAGE}): the live draft has ${existing.length} ` +
    `sections but this builder carries ${SECTIONS.length}.\n` +
    `Someone has authored the live page since this script was last run, or the script has drifted.\n` +
    `Diff first:\n` +
    `  node src/themes/transportny/qa_skills/tools/page_to_build.mjs --pattern ${PATTERN} --slug ${SLUG} --out /tmp/live_home.mjs\n` +
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

// 4 · the rail: `sidebar: right` + a sidebar group + navLabel'd sections
cli("page", "update", PAGE, "--data", tmp("sidebar.json", { sidebar: "right" }));

// 5 · sections, in order
let n = 0;
for (const s of SECTIONS) {
  const elementType = s.elementType || "lexical";
  const payload = {
    title: "", size: s.size, group: s.group,
    element: { "element-type": elementType, "element-data": s.data },
    trackingId: randomUUID(),
  };
  for (const k of ["border", "radius", "padding", "height", "bg", "rowspan", "navLabel", "anchorId"])
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
// 6 · the pattern's SideNav — the design's chrome is part of the page.
//     Cross-page contract item 1: FLAT, five items, no sub-items, Docs NOT in it
//     (Docs is a QuickLink), in the SAME ORDER as this page's sections and its footer.
//     Idempotent: backs the row up, then writes only if the nav actually differs.
//     ⚠ `theme.layout.options.sideNav.size` is deliberately NOT touched — see the task
//     doc Escalations ("compact vs 256px rail is one pattern-level field").
const NAV_ITEMS = [
  { icon: "House",                 name: "Home",             path: `/${SLUG}` },
  { icon: "GeographicFlexibility", name: "Macro View",       path: L.macro },
  { icon: "Report",                name: "Reports",          path: L.reports },
  { icon: "ScatterMatrix",         name: "Route comparison", path: L.comparison },
  { icon: "Activity",              name: "MAP-21 PM3",       path: L.map21 },
];
const PATTERN_ID = "2100394";
const patRow = jget(PATTERN_ID);
const theme = typeof patRow.data.theme === "string" ? JSON.parse(patRow.data.theme) : (patRow.data.theme || {});
const current = theme?.navOptions?.secondaryNav?.navItems;
if (JSON.stringify(current) === JSON.stringify(NAV_ITEMS)) {
  console.log("pattern nav: already the contract's five flat items — unchanged");
} else {
  const bak = "scratchpad/npmrdsv5-dev2/backups";
  fs.mkdirSync(bak, { recursive: true });
  const p = `${bak}/${PATTERN_ID}.before.json`;
  if (!fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify(patRow, null, 1));
  const nextTheme = {
    ...theme,
    navOptions: { ...(theme.navOptions || {}), secondaryNav: { ...(theme.navOptions?.secondaryNav || {}), navItems: NAV_ITEMS } },
  };
  cli("raw", "update", PATTERN_ID, "--data", tmp("pattern.json", { theme: nextTheme }));
  console.log(`pattern nav: set ${NAV_ITEMS.length} flat items (${NAV_ITEMS.map(i => i.name).join(" · ")}); pre-write row backed up at ${p}`);
}

console.log(`\nDRAFT ONLY — nothing published. Review at ${ENV.DMS_HOST.replace("dmsserver", "npmrds")}/edit/${SLUG}`);
console.log(`Publishing is the owner's call: dms page publish ${PAGE}`);
