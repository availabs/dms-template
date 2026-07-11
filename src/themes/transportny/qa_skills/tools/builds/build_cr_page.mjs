// Control Room — Page QA detail (/sitemgmt/page?key=<page_key>) — faithful port of the converged
// MIGRATED to qa_skills/tools/builds/ (2026-07-07, task qa-build-scripts-migration.md).
// Run from dms-template root. Wipe hardened: delete by PAGE ID with loud failures.
// mockup (sitemgmt-page.html): breadcrumb band → full-width header (name · stage · desc · badges ·
// QA/Design links) → two columns. MAIN: Tickets · Features & user stories (editable status) · Timeline.
// SIDEBAR: ONE Page-status card — `select` stage dropdown + `stage_progress` 6-node bar + next-step +
// details, fused above a Work-completed card. Draft-only, idempotent, find-or-create by slug.
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const ENV = { ...process.env, DMS_HOST: "http://localhost:3001", DMS_APP: "npmrdsv5", DMS_TYPE: "dev2" };
const CLI = "src/dms/packages/dms/cli/bin/dms.js";
const PATTERN = "sitemgmt", SLUG = "page";
const cli = (...a) => execFileSync("node", [CLI, ...a], { env: ENV, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const clean = (s) => s.split("\n").filter((l) => l.trim().startsWith("{")).pop();
const jget = (id) => JSON.parse(clean(cli("raw", "get", String(id))));

const PAGES_SRC = { isDms: true, app: "npmrdsv5", type: "sitemgmt_pages", name: "Site Management — Pages",
  source_id: 2184889, view_id: 2184890, env: "npmrdsv5+sitemgmt_pages", srcEnv: "npmrdsv5+sitemgmt_pages", baseUrl: "/forms",
  columns: ["page_key","surface_label","name","route","url","description","build","data","owner","updated","stage","stage_order","next_step"].map(n => ({ name: n, display_name: n, type: "text" })) };
const TICKETS_SRC = { isDms: true, app: "npmrdsv5", type: "sitemgmt_tickets", name: "Site Management — Tickets",
  source_id: 2184923, view_id: 2184924, env: "npmrdsv5+sitemgmt_tickets", srcEnv: "npmrdsv5+sitemgmt_tickets", baseUrl: "/forms",
  columns: ["ticket_id","title","page_key","severity","priority","status","source","updated"].map(n => ({ name: n, display_name: n, type: "text" })) };
const STORIES_SRC = { isDms: true, app: "npmrdsv5", type: "sitemgmt_stories", name: "Site Management — Stories",
  source_id: 2186440, view_id: 2186441, env: "npmrdsv5+sitemgmt_stories", srcEnv: "npmrdsv5+sitemgmt_stories", baseUrl: "/forms",
  columns: ["story","stage","source","sort_order","page_key"].map(n => ({ name: n, display_name: n, type: "text" })) };

const text = (t, format = 0, style = "") => ({ type: "text", version: 1, detail: 0, format, mode: "normal", style, text: t });
const styled = (styleKey, ...children) => ({ type: "styled-paragraph", version: 1, direction: "ltr", format: "", indent: 0, textFormat: 0, textStyle: "", styleKey, children });
const lexical = (...nodes) => JSON.stringify({ bgColor: "rgba(0,0,0,0)", isCard: "", showToolbar: false, text: { root: { type: "root", version: 1, direction: "ltr", format: "", indent: 0, children: nodes } } });

const STAGES6 = ["Proposed", "Design", "Implemented", "QA", "Dev Acceptance", "Client Acceptance"];
const STAGE_OPTS = STAGES6.map((v) => ({ label: v, value: v }));
const STAGE_HEX = { "Proposed": "#a1a1aa", "Design": "#8b5cf6", "Implemented": "#f59e0b", "QA": "#38bdf8", "Dev Acceptance": "#14b8a6", "Client Acceptance": "#10b981" };
const STAGE_PILL = { "Proposed": "zinc", "Design": "slate", "Implemented": "amber", "QA": "blue", "Dev Acceptance": "ink", "Client Acceptance": "green" };
const BUILD_PILL = { "Not started": "slate", "In progress": "amber", "Built (draft)": "blue", "Published": "green" };
const DATA_PILL = { "Real": "green", "Partial": "amber", "Mock": "slate" };
const SURFACE_PILL = { "TSMO": "blue", "Freight Atlas": "blue", "NPMRDS": "blue", "NPMRDS (DMS)": "blue", "NPMRDS (transportNY)": "blue" };
const SEV_PILL = { "Blocker": "red", "Major": "amber", "Minor": "slate", "Polish": "zinc" };
const STATUS_PILL = { "Triage": "slate", "In progress": "blue", "In review": "amber", "Resolved": "green", "Closed": "green" };
const SOURCE_PILL = { "ai": "blue", "dev": "slate", "client": "ink", "qa": "zinc" };
const STORY_PILL = { "proposed": "amber", "accepted": "blue", "verified": "green" };
const W = "(case (data->>'severity') when 'Blocker' then 5 when 'Major' then 3 when 'Minor' then 2 else 1 end)";
const OPEN = "('Triage','In progress','In review')", CLOSED = "('Resolved','Closed')";

const keyLeaf = (col) => ({ col, op: "filter", value: [], usePageFilters: true, searchParamKey: "key", requireResolved: true });
const dw = (src, { columns, filters = [], display = {} }) => JSON.stringify({
  externalSource: src, columns, filters: { op: "AND", groups: filters },
  display: { usePagination: false, readyToLoad: true, fetchMode: "smart", showAttribution: false, striped: false, ...display },
  data: [], join: { sources: {} } });
const col = (name, label, over = {}) => ({ name, customName: label, show: true, justify: "left", hideHeader: false, ...over });
const pcol = (name, label, map, over = {}) => ({ name, customName: label, type: "status_pill", pillColors: map, show: true, justify: "left", hideHeader: false, ...over });
const calc = (sql, label, over = {}) => ({ name: sql, type: "calculated", display_name: label, normalName: label, show: true, fn: "exempt", formatFn: " ", justify: "left", hideHeader: false, hideValue: false, cellSpan: 1, ...over });

const B = { crumb: randomUUID(), hdr: randomUUID(), cols: randomUUID(), side: randomUUID(), modal: randomUUID() };
// The Page-status card lives in a position:"sidebar" group, which sectionGroup.jsx renders INSIDE the
// in-page-nav rail (an independent sticky column) — no flat-grid row-pairing whitespace. The rail
// attaches to the band flagged railHost:true (the main content band); needs item.sidebar set.
// The Add-ticket MODAL group (isModal + modalParamKey): opens in VIEW mode when the 'addticket'
// action param is published (the tickets-header button's click_publish provider); renders as a
// normal inline band in EDIT mode for authoring. See src/dms/skills/modal-section-group.md.
const groups = [
  { name: B.crumb, index: 0, theme: "breadcrumb", position: "content", displayName: "Breadcrumb" },
  { name: B.hdr,   index: 1, theme: "header",     position: "content", displayName: "Header" },
  { name: B.cols,  index: 2, theme: "content",    position: "content", displayName: "Content", railHost: true },
  { name: B.side,  index: 3, theme: "content",    position: "sidebar", displayName: "Page status" },
  { name: B.modal, index: 4, theme: "content",    position: "content", displayName: "Add-ticket modal", isModal: true, modalParamKey: "addticket" },
];
const S = [];
const sec = (g, size, et, data, extra = {}) => S.push({ group: g, size, et, data, ...extra });

// ── breadcrumb ──
sec(B.crumb, "12", "lexical", lexical(styled("metaXS", text("Site Management     /     Page QA"))));

// ── header — editorial block sitting flat on the white "header" band (no inner card chrome):
//    eyebrow → big UPPERCASE title (displayLG) + stage pill → description → compact meta (no labels).
sec(B.hdr, "12", "Card", dw(PAGES_SRC, {
  columns: [
    // eyebrow as a STATIC column (origin:'static' + staticValue) so it shares the card's tight cell
    // spacing instead of a separate lexical section sitting in the band's gap-4.
    { name: "eyebrow", origin: "static", staticValue: "// page QA", valueFontStyle: "kicker", show: true, hideHeader: true, cellSpan: 6 },
    // title row: name (cols 1-5) + stage right (col 6, the 1fr track)
    col("name", "Page", { valueFontStyle: "displayLG", hideHeader: true, cellSpan: 5 }),
    pcol("stage", "Stage", STAGE_PILL, { hideHeader: true, cellSpan: 1, justify: "right" }),
    // description (full width)
    col("description", "", { valueFontStyle: "prose", hideHeader: true, cellSpan: 6 }),
    // meta — all six on ONE line; max-content tracks make each cell content-width so they pack tight-left
    pcol("surface_label", "Surface", SURFACE_PILL, { hideHeader: true }),
    col("route", "Route", { valueFontStyle: "metaMD", hideHeader: true }),
    pcol("build", "Build", BUILD_PILL, { hideHeader: true }),
    pcol("data", "Data", DATA_PILL, { hideHeader: true }),
    col("owner", "Owner", { valueFontStyle: "metaMD", hideHeader: true }),
    col("updated", "Updated", { valueFontStyle: "metaMD", hideHeader: true }),
  ],
  filters: [keyLeaf("page_key")],
  // content-width tracks (5 × max-content + a trailing 1fr) → cells size to content and pack left
  // instead of distributing across equal fractions; cellsPadding 0 + small gap removes the airy spacing.
  display: { usePagination: false, pageSize: 1, cellsGridSize: 6, cellsGridGap: 10, cellsRowGap: 3, cellsPadding: 0,
    cellsTracksTemplate: "max-content max-content max-content max-content max-content minmax(0,1fr)", cardBorder: false },
}), {});

// MAIN content band (B.cols): Tickets · Stories · Timeline, full width. SIDEBAR rail (B.side,
// position:"sidebar"): the Page-status card — stage dropdown / progress+next+details / work — which
// sectionGroup.jsx renders as an independent sticky column (no flat-grid row-pairing whitespace).
// COMPOSED CARD (mockup panel): a header section fused with its body section. The band grid is
// gap-0, so a header with all four borders (its bottom border = the divider) + a body with padding
// top 0 and no top border read as ONE card. The spreadsheet body uses tableStyle "flush" so it drops
// its own container chrome and the section frame is the only card.
const cardHeadr = { bg: "white", border: { top: true, left: true, right: true, bottom: true }, radius: { tl: true, tr: true }, padding: { bottom: "0" } };
const cardBody  = { bg: "white", border: { left: true, right: true, bottom: true }, radius: { bl: true, br: true }, padding: { top: "0", bottom: "0" } };

// Composed-card header — title (cardTitleSM, 15px uppercase Oswald) + optional caption (metaXS).
const hdr = (title, sub) => lexical(...[styled("cardTitleSM", text(title))].concat(sub ? [styled("metaXS", text(sub))] : []));

// ── MAIN — Features & user stories (composed card: header fused with Spreadsheet, editable status) ──
sec(B.cols, "12", "lexical", hdr("Features & user stories", "acceptance status per story"), cardHeadr);
sec(B.cols, "12", "Spreadsheet", dw(STORIES_SRC, {
  columns: [
    col("story", "User story", { size: 400, wrapText: true, stretch: true }),                    // text — left, fills width
    pcol("stage", "Status", STORY_PILL, { size: 150, justify: "right", allowEditInView: true }), // editable pill — right
  ],
  filters: [keyLeaf("page_key"), { col: "sort_order", op: "filter", value: [], sort: "asc" }],
  display: { usePagination: true, pageSize: 50, fetchMode: "smart", autoResize: false, tableStyle: "flush" },
}), cardBody);

// ── MAIN — Tickets (composed card: header fused with Spreadsheet) ──
// The header is a CARD (not lexical) so it can carry the "+ Add ticket" button: a static
// btnPrimary cell whose click_publish provider publishes the 'addticket' action param — which
// opens the modal group below. Title+caption stack left; the button row-spans both, right.
sec(B.cols, "12", "Card", dw(TICKETS_SRC, {
  columns: [
    { name: "t_title", origin: "static", staticValue: "Tickets", valueFontStyle: "cardTitleSM", show: true, hideHeader: true },
    { name: "add_ticket", origin: "static", staticValue: "+ Add ticket", valueFontStyle: "btnPrimary", show: true, hideHeader: true, justify: "right", cellRowSpan: 2 },
    { name: "t_cap", origin: "static", staticValue: "severity · status · source", valueFontStyle: "metaXS", show: true, hideHeader: true },
  ],
  filters: [],
  // rowaligned strips the dataCard value cells' pt/pb (px-only padding) — without it every cell
  // carried pb-3 and the fused header grew ~2 rows of dead vertical space.
  display: { usePagination: false, pageSize: 1, cardBorder: false, cellsGridSize: 2,
    cellsTracksTemplate: "minmax(0,1fr) max-content", cellsGridGap: 8, cellsRowGap: 2,
    cellsPadding: 0, cardsPadding: 10, cellsVAlign: "center", cardStyle: "rowaligned",
    _functions: { providers: [{ functionId: "click_publish", enabled: true, paramKey: "addticket", args: { column: "add_ticket" } }] } },
}), cardHeadr);
sec(B.cols, "12", "Spreadsheet", dw(TICKETS_SRC, {
  columns: [
    { name: "ticket_id", customName: "#", show: true, justify: "left", isLink: true, location: "/sitemgmt/ticket?id=", searchParams: "value", linkText: "", size: 52 },
    col("title", "Ticket", { size: 300, wrapText: true, stretch: true }),           // text — left, fills width
    pcol("severity", "Sev", SEV_PILL, { size: 92, justify: "right" }),             // pills — right
    pcol("source", "Source", SOURCE_PILL, { size: 92, justify: "right" }),
    pcol("status", "Status", STATUS_PILL, { size: 130, justify: "right", allowEditInView: true }), // editable pill
  ],
  filters: [keyLeaf("page_key")],
  display: { usePagination: true, pageSize: 25, fetchMode: "smart", autoResize: false, tableStyle: "flush" },
}), cardBody);

// ── MAIN — Timeline (composed card: header fused with Card, most-recent first) ──
sec(B.cols, "12", "lexical", hdr("Timeline", "work history"), cardHeadr);
sec(B.cols, "12", "Card", dw(TICKETS_SRC, {
  columns: [
    col("updated", "", { hideHeader: true, valueFontStyle: "metaXS", cellSpan: 1 }),
    { name: "ticket_id", customName: "#", show: true, justify: "left", hideHeader: true, isLink: true, location: "/sitemgmt/ticket?id=", searchParams: "value", linkText: "#" },
    col("title", "", { hideHeader: true, cellSpan: 4 }),
    pcol("status", "", STATUS_PILL, { hideHeader: true }),
  ],
  filters: [keyLeaf("page_key"), { col: "updated", op: "filter", value: [], sort: "desc" }],
  display: { usePagination: true, pageSize: 25, fetchMode: "smart", cardsGridSize: 1, cardsGridGap: 6, cellsGridSize: 7, cellsGridGap: 10, cardBorder: false, cardsPadding: 6 },
}), cardBody);

// ════════════ SIDEBAR — Page-status card (mockup: eyebrow → stage → progress → facts → work) ════════
// One flat card (NO outer border). Sections carry NO section-level vertical padding (`padding
// top/bottom 0` removes the default `defaultPaddingStep` gutter that was showing as gray gaps between
// boxes) so they fuse into one continuous white column; thin bottom-border dividers (on A-cont and B)
// separate the mockup's 3 sections. The editable stage stays in its own card (allowEditInView).
// NOTE: radius {tl,tr} + offset 13 were set by the author in the UI to align the sidebar card's top
// with the page styles — preserved here verbatim so rebuilds don't overwrite them.
const sStage = { bg: "white", radius: { tl: true, tr: true }, offset: 13, padding: { top: "0", bottom: "0" } }; // section A head — no border, rounded top, aligned offset
const sProg  = { bg: "white", border: { bottom: true }, padding: { top: "0", bottom: "0" } };  // divider ends section A
const sFacts = { bg: "white", border: { bottom: true }, padding: { top: "0", bottom: "0" } };  // divider ends section B
const sWork  = { bg: "white", radius: { bl: true, br: true }, padding: { top: "0", bottom: "0" } }; // section C — rounded bottom (completes the card)

// A — eyebrow + the pipeline-stage control (editable, "field" activeStyle = prominent primary control)
sec(B.side, "12", "Card", dw(PAGES_SRC, {
  columns: [
    { name: "eyebrow", origin: "static", staticValue: "// page status", valueFontStyle: "kicker", show: true, hideHeader: true },
    { name: "stage", customName: "Pipeline stage", type: "select", show: true, justify: "left", hideHeader: false, headerFontStyle: "metaXS", allowEditInView: true, activeStyle: "field", options: STAGE_OPTS },
  ],
  filters: [keyLeaf("page_key")],
  // liveEdit → the stage persists immediately on change (no Save/Cancel buttons / their bugs).
  // cellsGridGap 1 + cellsPadding 0 minimize the eyebrow → selector vertical space.
  display: { usePagination: false, pageSize: 1, cellsGridSize: 1, cellsGridGap: 1, cellsPadding: 0, cardsPadding: 14, headerValueLayout: "col", cardBorder: false, allowEditInView: true, liveEdit: true },
}), sStage);

// A (cont.) — 6-node progress bar + step (read-only). ("Next step" removed per author — it read a
// generic static-looking value.)
sec(B.side, "12", "Card", dw(PAGES_SRC, {
  columns: [
    { name: "stage", customName: "", type: "stage_progress", stages: STAGES6, stageHex: STAGE_HEX, show: true, justify: "left", hideHeader: true },
  ],
  filters: [keyLeaf("page_key")],
  display: { usePagination: false, pageSize: 1, cellsGridSize: 1, cellsGridGap: 8, cardsPadding: 14, headerValueLayout: "col", cardBorder: false },
}), sProg);

// B — facts grid (label-left / value-right rows)
sec(B.side, "12", "Card", dw(PAGES_SRC, {
  columns: [
    col("surface_label", "Surface", { headerFontStyle: "metaXS", valueFontStyle: "metaMD", justify: "right" }),
    col("route", "Route", { headerFontStyle: "metaXS", valueFontStyle: "metaMD", justify: "right" }),
    col("owner", "Owner", { headerFontStyle: "metaXS", valueFontStyle: "metaMD", justify: "right" }),
    col("updated", "Updated", { headerFontStyle: "metaXS", valueFontStyle: "metaMD", justify: "right" }),
    pcol("build", "Build", BUILD_PILL, { headerFontStyle: "metaXS", justify: "right" }),
    pcol("data", "Data", DATA_PILL, { headerFontStyle: "metaXS", justify: "right" }),
  ],
  filters: [keyLeaf("page_key")],
  display: { usePagination: false, pageSize: 1, cellsGridSize: 1, cellsRowGap: 5, cardsPadding: 14, headerValueLayout: "row", headerWidth: 45, valueWidth: 55, cardBorder: false, cardStyle: "rowaligned" },
}), sFacts);

// C — work completed: big % + data_bar progress + closed / open (mockup-synced)
const PCT = `coalesce(round(100.0 * sum(${W}) filter (where data->>'status' in ${CLOSED}) / nullif(sum(${W}),0)),0)`;
sec(B.side, "12", "Card", dw(TICKETS_SRC, {
  columns: [
    calc(`(${PCT}::text || '%') as complete`, "Work completed", { valueFontStyle: "statLG", headerFontStyle: "metaXS", cellSpan: 2 }),
    // data_bar: origin "calculated-column" makes the SQL evaluate; type "data_bar" renders the % as a
    // blue progress bar (fills.primary = #1F3F8F). barMin/Max 0-100 → fill = the pct.
    { name: `${PCT}::text as complete_bar`, type: "data_bar", origin: "calculated-column", fn: "exempt", formatFn: " ", show: true, hideHeader: true, hideValue: false, justify: "left", cellSpan: 2, barMin: 0, barMax: 100, barColorKey: "primary" },
    calc(`(count(*) filter (where data->>'status' in ${CLOSED}))::text as closed`, "Closed", { valueFontStyle: "statMD", headerFontStyle: "metaXS" }),
    calc(`(count(*) filter (where data->>'status' in ${OPEN}))::text as open_n`, "Open", { valueFontStyle: "statMD", headerFontStyle: "metaXS" }),
  ],
  filters: [keyLeaf("page_key")],
  display: { usePagination: false, pageSize: 1, cellsGridSize: 2, cellsGridGap: 10, cellsRowGap: 7, cardsPadding: 14, headerValueLayout: "col", cardBorder: false },
}), sWork);

// ── ADD-TICKET MODAL (B.modal, isModal group) — an allowAdddNew Card = the create form. The
// never-match filter keeps existing tickets out of the modal (only the new-item form renders).
// page_key pre-fills from the page's `key` filter (usePageParams); read-only in the form
// (editable:false → renders view). ticket_id is assigned AT CREATE by the core `autoNumber`
// column attr (max+1 across the whole source, floor 101 — same rule as cr_sync healing) and
// status defaults to Triage via `defaultValue` — both selectOnly, so no form field renders.
// opened/updated still backfill on the next cr_sync (dates are dynamic).
const selCol = (name, label, opts, over = {}) => ({ name, customName: label, show: true, hideHeader: false,
  headerFontStyle: "metaXS", type: "select", options: opts.map(o => (typeof o === "string" ? { label: o, value: o } : o)), ...over });
sec(B.modal, "12", "Card", dw(TICKETS_SRC, {
  columns: [
    // header row: title + caption right, closed with a hairline divider (cellBorderBottom)
    { name: "m_hdr", origin: "static", staticValue: "New ticket", valueFontStyle: "cardTitleSM", show: true, hideHeader: true, cellSpan: 2, cellBorderBottom: true },
    { name: "m_cap", origin: "static", staticValue: "status starts at triage · id assigned on create", valueFontStyle: "metaXS", show: true, hideHeader: true, justify: "right", cellSpan: 2, cellBorderBottom: true, cellVAlign: "center" },
    // create-time defaults — no rendered cells (selectOnly), consumed by dataWrapper addItem
    { name: "ticket_id", show: true, selectOnly: true, autoNumber: true, autoNumberStart: 101 },
    { name: "status", show: true, selectOnly: true, defaultValue: "Triage" },
    { name: "page_key", customName: "target page · pre-filled from this page", show: true, hideHeader: false,
      headerFontStyle: "metaXS", valueFontStyle: "chip", usePageParams: true, pageParamKey: "key", editable: false, cellSpan: 4 },
    col("title", "title", { headerFontStyle: "metaXS", type: "text", cellSpan: 4 }),
    selCol("severity", "severity", ["Blocker", "Major", "Minor", "Polish"]),
    selCol("priority", "priority", ["Now", "Next", "Later"]),
    selCol("source", "source", [{ label: "Client", value: "client" }, { label: "Dev", value: "dev" }, { label: "AI", value: "ai" }]),
    col("assignee", "assignee", { headerFontStyle: "metaXS", type: "text" }),
    col("description", "description", { headerFontStyle: "metaXS", type: "textarea", cellSpan: 4 }),
    col("steps", "steps to reproduce", { headerFontStyle: "metaXS", type: "textarea", cellSpan: 2 }),
    col("expected", "expected", { headerFontStyle: "metaXS", type: "textarea", cellSpan: 1 }),
    col("actual", "actual", { headerFontStyle: "metaXS", type: "textarea", cellSpan: 1 }),
  ],
  filters: [{ col: "ticket_id", op: "filter", value: ["__none__"] }],
  display: { usePagination: false, pageSize: 1, fetchMode: "smart", allowAdddNew: true, cardBorder: false,
    cellsGridSize: 4, cellsGridGap: 14, cellsRowGap: 8, cardsPadding: 20, headerValueLayout: "col" },
}));

// find or create the page
const out = cli("page", "list", "--pattern", PATTERN);
const line = out.split("\n").find((l) => l.trim().startsWith("{") || l.trim().startsWith("["));
const items = (line ? (JSON.parse(line).items || JSON.parse(line)) : []) || [];
let pageId = items.find((p) => (p.url_slug || p.data?.url_slug) === SLUG)?.id;
if (!pageId) { pageId = (cli("page", "create", "--pattern", PATTERN, "--title", "Page QA", "--slug", SLUG).match(/"id"\s*:\s*"?(\d+)"?/) || [])[1]; console.log("created", SLUG, pageId); }
else console.log("reusing", SLUG, pageId);
const existing = jget(pageId).data.draft_sections || [];
for (const e of existing) { try { cli("section", "delete", String(e.id), "--page", String(pageId)); } catch (err) { console.log("  DELETE FAILED for", e.id, String(err).slice(0, 120)); } }
cli("raw", "update", String(pageId), "--data", JSON.stringify({ draft_section_groups: groups, sidebar: "right", filters: [{ id: "cr-page-key", values: "", searchKey: "key", useSearchParams: true }] }));
for (const s of S) {
  const payload = { size: s.size, group: s.group, title: s.title || "", element: { "element-data": s.data, "element-type": s.et }, "element-type": s.et };
  for (const k of ["border", "radius", "padding", "height", "bg", "offset"]) if (s[k] != null) payload[k] = s[k];
  cli("section", "create", String(pageId), "--pattern", PATTERN, "--data", JSON.stringify(payload));
}
console.log(`built ${S.length} sections on /${SLUG} (${pageId})`);
