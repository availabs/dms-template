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
const STATUS_PILL = { "Triage": "slate", "In progress": "blue", "In review": "amber", "Needs decision": "ink", "Needs data": "zinc", "Resolved": "green", "Closed": "green" };
const SOURCE_PILL = { "ai": "blue", "dev": "slate", "client": "ink", "qa": "zinc" };
const STORY_PILL = { "proposed": "amber", "accepted": "blue", "verified": "green" };
const W = "(case (data->>'severity') when 'Blocker' then 5 when 'Major' then 3 when 'Minor' then 2 else 1 end)";
const OPEN = "('Triage','In progress','In review','Needs decision','Needs data')", CLOSED = "('Resolved','Closed')";
// Ticket display number: the friendly ticket_id when present, else the DMS row id. Links and
// filters key on the ROW ID (searchParams:"id" / col:"id") — it exists the instant the row does,
// so a modal-created ticket is openable before any numbering runs. Comma-free CASE only (the UDA
// SELECT list is comma-split). 2026-07-15, Alex: "use its dms id value".
const TNUM = `('#' || (case when (data->>'ticket_id') is null or (data->>'ticket_id') = '' then (id)::text else (data->>'ticket_id') end))`;

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
  { name: B.modal, index: 4, theme: "content",    position: "content", displayName: "Add-ticket modal", isModal: true, modalParamKey: "addticket", modalSize: "xl" },
];
const S = [];
const sec = (g, size, et, data, extra = {}) => S.push({ group: g, size, et, data, ...extra });

// ── breadcrumb ──
sec(B.crumb, "12", "lexical", lexical(styled("metaXS", text("Site Management     /     Page QA"))));

// ── header — identity only (2026-07-15 redesign, sitemgmt-page.html): eyebrow → big UPPERCASE
//    title (displayLG) + right cluster [QA ⇄ Design toggle chips · View live page ↗] → description.
//    The old facts strip (surface/route/build/data/owner/updated) and the stage pill are GONE —
//    every one of those already lives in the sidebar Page-status card, and a stage of "QA" under
//    the QA toggle chip read as a confusing double.
sec(B.hdr, "12", "Card", dw(PAGES_SRC, {
  columns: [
    // eyebrow as a STATIC column (origin:'static' + staticValue) so it shares the card's tight cell
    // spacing instead of a separate lexical section sitting in the band's gap-4.
    { name: "eyebrow", origin: "static", staticValue: "// page QA", valueFontStyle: "kicker", show: true, hideHeader: true, cellSpan: 4 },
    // title row: name (col 1, the 1fr track) + the action cluster packed right on max-content tracks
    col("name", "Page", { valueFontStyle: "displayLG", hideHeader: true }),
    // QA ⇄ Design toggle — a direction-free chip pair (toggleOn = this page, toggleOff = the link);
    // the Design chip links by this page's key so the toggle round-trips (?key= on both pages).
    { name: "t_qa", origin: "static", staticValue: "QA", valueFontStyle: "toggleOn", show: true, hideHeader: true, justify: "right", cellVAlign: "center" },
    { name: "page_key", customName: "", show: true, hideHeader: true, valueFontStyle: "toggleOff", isLink: true,
      location: "/sitemgmt/design?key=", searchParams: "value", linkText: "Design", justify: "right", cellVAlign: "center" },
    // "View live page" — the row's url column IS the href (no `location`), new tab via isLinkExternal
    { name: "url", customName: "", show: true, hideHeader: true, valueFontStyle: "btnOutline", isLink: true,
      isLinkExternal: true, linkText: "View live page ↗", justify: "right", cellVAlign: "center" },
    // description (full width)
    col("description", "", { valueFontStyle: "prose", hideHeader: true, cellSpan: 4 }),
  ],
  filters: [keyLeaf("page_key")],
  // 1fr title track + three max-content action tracks → the cluster packs tight-right;
  // cellsPadding 0 + small gap removes the airy spacing.
  display: { usePagination: false, pageSize: 1, cellsGridSize: 4, cellsGridGap: 8, cellsRowGap: 3, cellsPadding: 0,
    cellsTracksTemplate: "minmax(0,1fr) max-content max-content max-content", cardBorder: false },
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
    // '#N' display (ticket_id, falling back to the row id) — the LINK always carries the row id.
    // size fits the 7-digit row-id fallback ('#2191487'); at 56px it clipped to a misleading '#21914'.
    { name: `${TNUM} as num`, type: "calculated", normalName: "num", customName: "#", show: true, justify: "left",
      isLink: true, location: "/sitemgmt/ticket?id=", searchParams: "id", size: 80 },
    col("title", "Ticket", { size: 300, wrapText: true, stretch: true }),           // text — left, fills width
    pcol("severity", "Sev", SEV_PILL, { size: 92, justify: "right" }),             // pills — right
    pcol("source", "Source", SOURCE_PILL, { size: 92, justify: "right" }),
    pcol("status", "Status", STATUS_PILL, { size: 130, justify: "right", allowEditInView: true }), // editable pill
  ],
  filters: [keyLeaf("page_key")],
  // data_refresh: refetch when the modal's add_publish bumps 'tickets_v' (new ticket → row
  // appears without a reload)
  display: { usePagination: true, pageSize: 25, fetchMode: "smart", autoResize: false, tableStyle: "flush",
    _functions: { subscribers: [{ functionId: "data_refresh", enabled: true, paramKey: "tickets_v" }] } },
}), cardBody);

// (Timeline section removed 2026-07-15 per Alex — it was non-functional: tickets have no event
// stream, so it just re-listed the tickets table sorted by `updated`. Bring it back only when a
// real work-history source exists.)

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
  // data_refresh: closed/open counts + % update the moment the modal creates a ticket
  display: { usePagination: false, pageSize: 1, cellsGridSize: 2, cellsGridGap: 10, cellsRowGap: 7, cardsPadding: 14, headerValueLayout: "col", cardBorder: false,
    _functions: { subscribers: [{ functionId: "data_refresh", enabled: true, paramKey: "tickets_v" }] } },
}), sWork);

// ── ADD-TICKET MODAL (B.modal, isModal group + modalSize "xl") — an allowAdddNew Card = the
// create form. 2026-07-15 redesign (sitemgmt-page.html): THREE fields — title · severity ·
// description — priority/source/assignee/steps/expected/actual are triage's job, not the
// reporter's. Labels use labelSM (bigger + darker than the old mono micro-caps); title and
// description carry per-column `placeholder`s (Card's attribute spread wins over its hardcoded
// default). The never-match filter keeps existing tickets out of the modal (only the new-item
// form renders). page_key pre-fills from the page's `key` filter (usePageParams); read-only
// (editable:false → renders view).
// Create-time defaults (selectOnly — no form field renders): status → Triage, source → client
// (dev/agent tickets come in via CLI), ticket_id → autoNumber max+1 floor 101, the FRIENDLY
// display number. Viewability does NOT depend on it: ticket links/filters key on the DMS row
// id (searchParams:"id" / col:"id"), which exists at create no matter what, and displays fall
// back to the row id when ticket_id is missing. opened/updated/reporter are stamped AT CREATE
// via defaultFn (today/user); cr_sync healing remains the backstop for CLI-created rows.
const mCol = (name, label, over = {}) => ({ name, customName: label, show: true, hideHeader: false,
  headerFontStyle: "labelSM", justify: "left", ...over });
sec(B.modal, "12", "Card", dw(TICKETS_SRC, {
  columns: [
    // header: title, then a friendly caption closed with a hairline divider (the core modal ✕
    // floats top-right and is the cancel — no in-card buttons besides Add)
    { name: "m_hdr", origin: "static", staticValue: "New ticket", valueFontStyle: "cardTitleSM", show: true, hideHeader: true, cellSpan: 2 },
    { name: "m_cap", origin: "static", staticValue: "Tell us what you saw on this page — triage takes it from there.", valueFontStyle: "proseSM", show: true, hideHeader: true, cellSpan: 2, cellBorderBottom: true },
    // create-time defaults — no rendered cells (selectOnly), consumed by dataWrapper addItem.
    // defaultFn (2026-07-15): opened/updated stamped at create (was a cr_sync backfill),
    // reporter = the logged-in user's email (skipped if anonymous → sync heal still applies).
    // opened/updated use "now" ("YYYY-MM-DD HH:MM:SS" UTC) to match the sidenav
    // ReportIssueModal's rows — mixed date/datetime formats break same-day sort order.
    { name: "ticket_id", show: true, selectOnly: true, autoNumber: true, autoNumberStart: 101 },
    { name: "status", show: true, selectOnly: true, defaultValue: "Triage" },
    { name: "source", show: true, selectOnly: true, defaultValue: "client" },
    { name: "reporter", show: true, selectOnly: true, defaultFn: "user" },
    { name: "opened", show: true, selectOnly: true, defaultFn: "now" },
    { name: "updated", show: true, selectOnly: true, defaultFn: "now" },
    mCol("page_key", "Filing against", { valueFontStyle: "chip", usePageParams: true, pageParamKey: "key", editable: false, cellSpan: 2 }),
    mCol("title", "Title", { type: "text", placeholder: "Short, specific summary…", cellSpan: 2 }),
    mCol("severity", "Severity", { type: "select", options: ["Blocker", "Major", "Minor", "Polish"].map(v => ({ label: v, value: v })), cellSpan: 1 }),
    mCol("description", "Description", { type: "textarea", rows: 4, placeholder: "What happened? What did you expect?", cellSpan: 2 }),
    { name: "m_note", origin: "static", staticValue: "numbered automatically · starts in triage", valueFontStyle: "metaXS", show: true, hideHeader: true, cellSpan: 2 },
  ],
  filters: [{ col: "ticket_id", op: "filter", value: ["__none__"] }],
  // closeModalOnAdd = the group's modalParamKey: a successful create clears the action param,
  // closing the modal. add_publish publishes the created ROW ID to 'tickets_v'; the tickets
  // table + work-completed card subscribe (data_refresh) so the new ticket appears instantly —
  // no reload (core enrichments 2026-07-15).
  display: { usePagination: false, pageSize: 1, fetchMode: "smart", allowAdddNew: true, addItemLabel: "Add ticket", closeModalOnAdd: "addticket", cardBorder: false,
    cellsGridSize: 2, cellsGridGap: 14, cellsRowGap: 12, cardsPadding: 24, headerValueLayout: "col",
    _functions: { providers: [{ functionId: "add_publish", enabled: true, paramKey: "tickets_v" }] } },
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
