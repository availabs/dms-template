// Control Room — Tickets list + Ticket detail pages (sitemgmt pattern).
// MIGRATED to qa_skills/tools/builds/ (2026-07-07, task qa-build-scripts-migration.md).
// Run from dms-template root. Wipe hardened: delete by PAGE ID with loud failures.
// list: faceted Spreadsheet over sitemgmt_tickets, rows deep-link to /sitemgmt/ticket?id=.
// detail: Card filtered by ?id= page variable, editable in view. Draft-only, idempotent.
// Find-or-create by slug via `page list` (raw list is unreliable for page types).
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const ENV = { ...process.env, DMS_HOST: "http://localhost:3001", DMS_APP: "npmrdsv5", DMS_TYPE: "dev2" };
const CLI = "src/dms/packages/dms/cli/bin/dms.js";
const PATTERN = "sitemgmt";
const cli = (...a) => execFileSync("node", [CLI, ...a], { env: ENV, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const clean = (s) => s.split("\n").filter((l) => l.trim().startsWith("{")).pop();
const jget = (id) => JSON.parse(clean(cli("raw", "get", String(id))));

const TICKETS_SRC = { isDms: true, app: "npmrdsv5", type: "sitemgmt_tickets", name: "Site Management — Tickets",
  source_id: 2184923, view_id: 2184924, env: "npmrdsv5+sitemgmt_tickets", srcEnv: "npmrdsv5+sitemgmt_tickets", baseUrl: "/forms",
  columns: ["ticket_id","title","page_key","severity","priority","status","source","assignee","reporter","opened","updated","description","steps","expected","actual","env","comments"].map(n => ({ name: n, display_name: n, type: "text" })) };
const SOURCE_PILL = { "ai": "blue", "dev": "slate", "client": "ink", "qa": "zinc" };

// lexical
const text = (t, format = 0, style = "") => ({ type: "text", version: 1, detail: 0, format, mode: "normal", style, text: t });
const styled = (styleKey, ...children) => ({ type: "styled-paragraph", version: 1, direction: "ltr", format: "", indent: 0, textFormat: 0, textStyle: "", styleKey, children });
const lexical = (...nodes) => JSON.stringify({ bgColor: "rgba(0,0,0,0)", isCard: "", showToolbar: false,
  text: { root: { type: "root", version: 1, direction: "ltr", format: "", indent: 0, children: nodes } } });
const GOLD = "color:#CA8A04";

const SEV_PILL = { "Blocker": "red", "Major": "amber", "Minor": "slate", "Polish": "zinc" };
const PRIO_PILL = { "Now": "red", "Next": "amber", "Later": "slate" };
const STATUS_PILL = { "Triage": "slate", "In progress": "blue", "In review": "amber", "Resolved": "green", "Closed": "green" };

const dw = ({ columns, filters = [], display = {} }) => JSON.stringify({
  externalSource: TICKETS_SRC, columns, filters: { op: "AND", groups: filters },
  display: { usePagination: true, pageSize: 25, readyToLoad: true, fetchMode: "smart", showAttribution: false, striped: false, ...display },
  data: [], join: { sources: {} } });
const col = (name, label, over = {}) => ({ name, customName: label, show: true, justify: "left", ...over });
const pcol = (name, label, map, over = {}) => ({ name, customName: label, type: "status_pill", pillColors: map, show: true, justify: "left", ...over });
const calc = (sql, label, over = {}) => ({ name: sql, type: "calculated", display_name: label, normalName: label, show: true, fn: "exempt", formatFn: " ", justify: "left", hideHeader: false, hideValue: false, ...over });
const linkNode = (t, url) => ({ type: "link", version: 1, direction: "ltr", format: "", indent: 0, rel: null, target: null, title: null, url, children: [text(t)] });
const W = "(case (data->>'severity') when 'Blocker' then 5 when 'Major' then 3 when 'Minor' then 2 else 1 end)";
const OPEN = "('Triage','In progress','In review')", CLOSED = "('Resolved','Closed')";
const st = (s) => `(data->>'status')`; // shorthand
// composed-card section styles for a fused stack on the gap-0 band. RULE: zero EVERY interior edge —
// the section's default `defaultPaddingStep` gutter sits OUTSIDE the border, so any non-zero interior
// edge shows as a gray gap between the boxes. Top keeps its natural top; bottom keeps its natural
// bottom; every middle section is top:0 AND bottom:0. (bottom border on each = the divider line.)
const cHeadr = { bg: "white", border: { top: true, left: true, right: true, bottom: true }, radius: { tl: true, tr: true }, padding: { bottom: "0" } };
const cMid   = { bg: "white", border: { left: true, right: true, bottom: true }, padding: { top: "0", bottom: "0" } };
const cBot   = { bg: "white", border: { left: true, right: true, bottom: true }, radius: { bl: true, br: true }, padding: { top: "0" } };

function resolvePage(slug, title) {
  const out = cli("page", "list", "--pattern", PATTERN);
  const line = out.split("\n").find((l) => l.trim().startsWith("{") || l.trim().startsWith("["));
  const items = (line ? (JSON.parse(line).items || JSON.parse(line)) : []) || [];
  let id = items.find((p) => (p.url_slug || p.data?.url_slug) === slug)?.id;
  if (!id) { id = (cli("page", "create", "--pattern", PATTERN, "--title", title, "--slug", slug).match(/"id"\s*:\s*"?(\d+)"?/) || [])[1]; console.log("created", slug, id); }
  else console.log("reusing", slug, id);
  return id;
}
function applyPage(pageId, groups, S, filters = []) {
  const existing = jget(pageId).data.draft_sections || [];
  for (const e of existing) { try { cli("section", "delete", String(e.id), "--page", String(pageId)); } catch (err) { console.log("  DELETE FAILED for", e.id, String(err).slice(0, 120)); } }
  cli("raw", "update", String(pageId), "--data", JSON.stringify({ draft_section_groups: groups, ...(filters.length ? { filters } : {}) }));
  for (const s of S) {
    const payload = { size: s.size, group: s.group, title: "", element: { "element-data": s.data, "element-type": s.et }, "element-type": s.et };
    for (const k of ["border", "radius", "padding", "height", "bg"]) if (s[k] != null) payload[k] = s[k];
    cli("section", "create", String(pageId), "--pattern", PATTERN, "--data", JSON.stringify(payload));
  }
  console.log(`  built ${S.length} sections on ${pageId}`);
}

// ═══════════════════ TICKETS LIST (/sitemgmt/tickets) — faithful to sitemgmt-tickets.html ═══════════════════
// breadcrumb → header band ("// site management" + Tickets.) → "Where tickets stand" summary (flow
// strip + resolution bar + severity/source breakdown) → tickets table.
{
  const B = { crumb: randomUUID(), hdr: randomUUID(), sum: randomUUID(), bar: randomUUID(), tbl: randomUUID() };
  const groups = [
    { name: B.crumb, index: 0, theme: "breadcrumb", position: "content", displayName: "Breadcrumb" },
    { name: B.hdr,   index: 1, theme: "header",     position: "content", displayName: "Header" },
    { name: B.sum,   index: 2, theme: "content",    position: "content", displayName: "Summary" },
    { name: B.bar,   index: 3, theme: "content",    position: "content", displayName: "Filters" },
    { name: B.tbl,   index: 4, theme: "content",    position: "content", displayName: "Tickets table" },
  ];
  const S = [];
  const agg = (columns, display = {}) => dw({ columns, filters: [], display: { usePagination: false, pageSize: 1, cardBorder: false, ...display } });

  // breadcrumb + header band (title left · "Add ticket" link-as-button right; the button is a
  // static isLink Card cell styled by the btnPrimary textSettings token, landing on the tickets
  // source's authoring surface — its TABLE tab is where rows are added)
  S.push({ group: B.crumb, size: "12", et: "lexical", data: lexical(styled("metaXS", text("Site Management     /     Tickets"))) });
  S.push({ group: B.hdr, size: "9", et: "lexical", data: lexical(
    styled("kicker", text("// site management")),
    styled("displayLG", text("Tickets"), text(".", 0, GOLD)),
  ) });
  S.push({ group: B.hdr, size: "3", et: "Card", data: dw({
    // cellPaddingTop drops the button to sit level with the title (the section grid is
    // content-anchored top, so vAlign can't center it against the taller lexical neighbor).
    columns: [{ name: "add_ticket", origin: "static", staticValue: "+ Add ticket", valueFontStyle: "btnPrimary",
      show: true, hideHeader: true, justify: "right", isLink: true, location: "/datasources/internal_source/2184923/table", searchParams: "none", cellPaddingTop: 26 }],
    display: { usePagination: false, pageSize: 1, cardBorder: false, cellsGridSize: 1, cardsPadding: 0 },
  }), height: "fill" });

  // ── "Where tickets stand" summary (fused composed card, mockup layout) ──
  // title row (title left · lifecycle caption right) → flow strip (4 status boxes, proper-case
  // labels, NO prefix label) → 3-col stats row: resolution | open by severity | found by.
  S.push({ group: B.sum, size: "12", et: "Card", data: agg([
    { name: "t_title", origin: "static", staticValue: "Where tickets stand", valueFontStyle: "cardTitleSM", show: true, hideHeader: true },
    { name: "t_cap", origin: "static", staticValue: "lifecycle · reported → resolved", valueFontStyle: "metaXS", show: true, hideHeader: true, justify: "right" },
  ], { cellsGridSize: 2, cellsGridGap: 10, cardsPadding: 14, cellsVAlign: "center", headerValueLayout: "col" }), ...cHeadr });
  // flow strip: Triage → In progress → In review → Resolved/closed as flow_step boxes
  // (dot · label · count, '›' connectors in the grid gap, emerald tint on the terminal step).
  const step = (stepColor, over = {}) => ({ type: "flow_step", stepColor, connector: true, hideHeader: true, ...over });
  S.push({ group: B.sum, size: "12", et: "Card", data: agg([
    calc(`(count(*) filter (where ${st()} = 'Triage'))::text as c_triage`, "Triage", step("neutral")),
    calc(`(count(*) filter (where ${st()} = 'In progress'))::text as c_prog`, "In progress", step("info")),
    calc(`(count(*) filter (where ${st()} = 'In review'))::text as c_review`, "In review", step("warn")),
    calc(`(count(*) filter (where ${st()} in ${CLOSED}))::text as c_done`, "Resolved / closed", step("done", { connector: false, stepTint: true })),
  ], { cellsGridSize: 4, cellsGridGap: 6, cellsRowGap: 8, cardsPadding: 14 }), ...cMid });
  // bottom stats row — ONE fused section on a 12-col cells grid, so the three stat columns
  // (resolution | open by severity | found by) share aligned, tight rows: labels row (resolution
  // carries its % on the label row, mockup-style) → content row (bar | severity legend | found-by)
  // → caption row. One section = one bottom border + radius, no height-equalizing needed.
  const cBot = { bg: "white", border: { left: true, right: true, bottom: true }, radius: { bl: true, br: true }, padding: { top: "0" } };
  const leg = (over = {}) => ({ valueFontStyle: "metaMD", headerFontStyle: "labelSM", justify: "right", cellSpan: 1, ...over });
  const stat = (name, txt, over = {}) => ({ name, origin: "static", staticValue: txt, valueFontStyle: "metaXS", show: true, hideHeader: true, ...over });
  S.push({ group: B.sum, size: "12", et: "Card", data: agg([
    // row 1 — labels
    calc(`(coalesce(round(100.0 * sum(${W}) filter (where ${st()} in ${CLOSED}) / nullif(sum(${W}),0)),0)::text || '%') as res`, "resolution", { valueFontStyle: "displayXS", headerFontStyle: "metaXS", justify: "right", cellSpan: 4 }),
    stat("s_lbl", "open by severity", { cellSpan: 4 }),
    stat("f_lbl", "found by", { cellSpan: 4 }),
    // row 2 — bar | severity legend ×4 | found-by ×3 | filler
    // headerValueLayout col PER-COLUMN (new Card override): the card is row-aligned but the bar
    // needs col layout or it collapses to content width (the documented data_bar gotcha).
    { name: `coalesce(round(100.0 * sum(${W}) filter (where ${st()} in ${CLOSED}) / nullif(sum(${W}),0)),0)::text as res_bar`, type: "data_bar", origin: "calculated-column", fn: "exempt", formatFn: " ", show: true, hideHeader: true, cellSpan: 4, barMin: 0, barMax: 100, barColorKey: "success", headerValueLayout: "col" },
    calc(`(count(*) filter (where ${st()} in ${OPEN} and data->>'severity' = 'Blocker'))::text as s_block`, "Blocker", leg()),
    calc(`(count(*) filter (where ${st()} in ${OPEN} and data->>'severity' = 'Major'))::text as s_major`, "Major", leg()),
    calc(`(count(*) filter (where ${st()} in ${OPEN} and data->>'severity' = 'Minor'))::text as s_minor`, "Minor", leg()),
    calc(`(count(*) filter (where ${st()} in ${OPEN} and data->>'severity' = 'Polish'))::text as s_polish`, "Polish", leg()),
    calc(`(count(*) filter (where data->>'source' = 'ai'))::text as f_ai`, "AI", leg()),
    calc(`(count(*) filter (where data->>'source' = 'dev'))::text as f_dev`, "Dev", leg()),
    calc(`(count(*) filter (where data->>'source' = 'client'))::text as f_client`, "Client", leg()),
    stat("fill", " ", { cellSpan: 1 }),
    // row 3 — open · done caption under the bar
    calc(`((count(*) filter (where ${st()} in ${OPEN}))::text || ' open · ' || (count(*) filter (where ${st()} in ${CLOSED}))::text || ' done') as od`, "", { valueFontStyle: "metaMD", hideHeader: true, cellSpan: 4 }),
  ], { cellsGridSize: 12, cellsGridGap: 12, cellsRowGap: 4, cardsPadding: 14, cardStyle: "rowaligned", headerValueLayout: "row", cellsVAlign: "center" }), ...cBot });

  // ── filter bar (status · severity · source) — DMS Filter controls (multiselect chips), each
  // writing a searchParam the table's usePageFilters leaves read. Status facets the 5 raw statuses
  // (finer than the mockup's All/Open/Closed rollup — a value facet is what the primitive does).
  const facet = (column, label, key) => JSON.stringify({ externalSource: TICKETS_SRC,
    columns: [{ name: column, customName: label, type: "multiselect", show: true,
      filters: [{ type: "external", operation: "filter", values: [], isMulti: true, usePageFilters: true, searchParamKey: key }] }],
    filters: { op: "AND", groups: [] },
    display: { totalLength: 1, hideExternalToggle: true, showAttribution: false, filterStyle: "filter_panel_light", fetchMode: "smart" },
    data: [], join: { sources: {} } });
  S.push({ group: B.bar, size: "4", et: "Filter", data: facet("status", "Status", "status") });
  S.push({ group: B.bar, size: "4", et: "Filter", data: facet("severity", "Severity", "severity") });
  S.push({ group: B.bar, size: "4", et: "Filter", data: facet("source", "Source", "source") });

  // ── tickets table (mockup columns: # · Severity · Source · Status · Ticket · Page · Owner · Updated) ──
  // mockup fidelity: open-first sort (then updated desc); '#'-prefixed id linking to the detail page
  // (ABSOLUTE location — relative resolved against /edit/tickets and 404'd); Source shows AI/Dev/Client
  // labels via a case-map calc pill; Page shows the denormalized friendly page_name (cr_sync).
  S.push({ group: B.tbl, size: "12", et: "Spreadsheet", data: dw({
    columns: [
      // open-first rank — 0px sorted helper (multi-sort: orderBy keys follow column order)
      // NOTE: no fn:"exempt" on these row-level calcs — getData's invalid-state guard counts ANY
      // truthy fn, and "some visible columns have fn, some don't" kills the fetch (perma-loading).
      // fn undefined generates the identical `expr as alias` SQL for non-aggregate calcs.
      { name: `(case when (data->>'status') in ${OPEN} then 0 else 1 end) as openrank`,
        type: "calculated", normalName: "openrank", display_name: "", customName: "", show: true,
        formatFn: " ", hideHeader: true, size: 0, sort: "asc" },
      // '#' — displays '#<id>', links by the ticket_id column's value (searchParamsCol, BC)
      { name: "('#' || (data->>'ticket_id')) as num", type: "calculated", normalName: "num",
        display_name: "#", customName: "#", show: true, formatFn: " ",
        justify: "right", size: 56, valueFontStyle: "metaXS",
        isLink: true, location: "/sitemgmt/ticket?id=", searchParamsCol: "ticket_id" },
      // ticket_id must stay fetched for searchParamsCol to read it — 0px helper
      { name: "ticket_id", customName: "", show: true, hideHeader: true, size: 0 },
      pcol("severity", "Severity", SEV_PILL, { size: 100 }),
      { name: "(case data->>'source' when 'ai' then 'AI' when 'dev' then 'Dev' when 'client' then 'Client' else (data->>'source') end) as src",
        type: "status_pill", normalName: "src", display_name: "Source", customName: "Source", show: true,
        formatFn: " ", pillColors: { AI: "blue", Dev: "slate", Client: "ink" }, justify: "left", size: 92 },
      pcol("status", "Status", STATUS_PILL, { size: 120 }),
      col("title", "Ticket", { size: 300, wrapText: true, stretch: true }),
      col("page_name", "Page", { size: 150 }),
      col("assignee", "Owner", { size: 78, justify: "center", valueFontStyle: "metaXS" }),
      col("updated", "Updated", { size: 108, sort: "desc", valueFontStyle: "metaXS" }),
    ],
    filters: [
      { col: "status", op: "filter", value: [], usePageFilters: true, searchParamKey: "status" },
      { col: "severity", op: "filter", value: [], usePageFilters: true, searchParamKey: "severity" },
      { col: "source", op: "filter", value: [], usePageFilters: true, searchParamKey: "source" },
    ],
    display: { usePagination: true, pageSize: 25, fetchMode: "smart", autoResize: false },
  }), bg: "white", border: { top: true, left: true, right: true, bottom: true }, radius: { tl: true, tr: true, bl: true, br: true } });
  console.log("TICKETS LIST:");
  applyPage(resolvePage("tickets", "Tickets"), groups, S, [
    { id: "cr-tickets-status", values: "", searchKey: "status", useSearchParams: true },
    { id: "cr-tickets-severity", values: "", searchKey: "severity", useSearchParams: true },
    { id: "cr-tickets-source", values: "", searchKey: "source", useSearchParams: true },
  ]);
}

// ═══════════════════ TICKET DETAIL (/sitemgmt/ticket?id=) — faithful to sitemgmt-ticket.html ═══
// breadcrumb (#id) → header (kicker · badge row + All-tickets btnOutline · title · target line)
// → left content card (labeled prose + environment chip) + Details rail (status = editable pill,
// liveEdit) → comments card. Row-level calcs carry NO fn (the mixed-fn invalid-state trap).
{
  const B = { crumb: randomUUID(), hdr: randomUUID(), body: randomUUID(), com: randomUUID() };
  const groups = [
    { name: B.crumb, index: 0, theme: "breadcrumb", position: "content", displayName: "Breadcrumb" },
    { name: B.hdr,   index: 1, theme: "header",     position: "content", displayName: "Header" },
    { name: B.body,  index: 2, theme: "content",    position: "content", displayName: "Ticket body" },
    { name: B.com,   index: 3, theme: "content",    position: "content", displayName: "Comments" },
  ];
  const STAGE_PILL = { "Proposed": "zinc", "Design": "slate", "Implemented": "amber", "QA": "blue", "Dev Acceptance": "ink", "Client Acceptance": "green" };
  // ?id → ticket_id filter leaf (requireResolved so it waits for the param)
  const idLeaf = () => ({ col: "ticket_id", op: "filter", value: [], usePageFilters: true, searchParamKey: "id", requireResolved: true });
  const detail = (columns, display = {}) => dw({ columns, filters: [idLeaf()],
    display: { usePagination: false, pageSize: 1, fetchMode: "smart", ...display } });
  // row-level calc (NO fn — see the tickets-table gotcha)
  const rcalc = (sql, label, over = {}) => ({ name: sql, type: "calculated", normalName: (sql.match(/ as (\w+)$/) || [])[1] || label,
    display_name: label, customName: label, show: true, formatFn: " ", justify: "left", hideHeader: true, ...over });
  const stat = (name, txt, over = {}) => ({ name, origin: "static", staticValue: txt, valueFontStyle: "proseSM", show: true, hideHeader: true, ...over });
  const S = [];

  // breadcrumb — key-filtered so the crumb carries the real #id
  S.push({ group: B.crumb, size: "12", et: "Card", data: detail([
    rcalc(`('Site Management     /     Tickets     /     #' || (data->>'ticket_id')) as crumb`, "", { valueFontStyle: "metaXS" }),
  ], { cardBorder: false, cardsPadding: 0 }) });

  // header — one Card: kicker → badge row (+ All tickets right) → title → target line.
  // 6 max-content tracks + a stretch tail; full-row cells span 6.
  S.push({ group: B.hdr, size: "12", et: "Card", data: detail([
    stat("kick", "// ticket", { valueFontStyle: "kicker", cellSpan: 6 }),
    rcalc(`('#' || (data->>'ticket_id')) as num`, "", { valueFontStyle: "metaXS" }),
    pcol("severity", "", SEV_PILL, { hideHeader: true }),
    pcol("priority", "", PRIO_PILL, { hideHeader: true }),
    pcol("status", "", STATUS_PILL, { hideHeader: true }),
    rcalc(`(case data->>'source' when 'ai' then 'AI found' when 'dev' then 'Dev found' when 'client' then 'Client found' else (data->>'source') end) as found`, "",
      { type: "status_pill", pillColors: { "AI found": "blue", "Dev found": "slate", "Client found": "ink" } }),
    stat("alltix", "All tickets", { valueFontStyle: "btnOutline", justify: "right", isLink: true, location: "/sitemgmt/tickets", searchParams: "none" }),
    col("title", "", { hideHeader: true, valueFontStyle: "displayMD", cellSpan: 6 }),
    stat("tgt", "target ·"),
    { name: "page_name", customName: "", show: true, hideHeader: true, isLink: true, location: "/sitemgmt/page?key=", searchParamsCol: "page_key" },
    col("page_route", "", { hideHeader: true, valueFontStyle: "metaMD" }),
    stat("pis", "· page is"),
    pcol("page_stage", "", STAGE_PILL, { hideHeader: true }),
    stat("fill", " "),
    // page_key fetched (0-size-ish hidden) for searchParamsCol
    col("page_key", "", { hideHeader: true, hideValue: true }),
  ], { cellsTracksTemplate: "max-content max-content max-content max-content max-content minmax(0,1fr)",
       cellsGridGap: 10, cellsRowGap: 6, cellsPadding: 0, cardsPadding: 0, cardBorder: false, cellsVAlign: "center" }) });

  // content band — left: labeled prose sections + environment chip (READ-ONLY: text columns with
  // allowEditInView render as permanent inputs — no click-to-swap like pills. Body edits happen on
  // the datasets table, same surface as Add ticket); right: Details rail.
  S.push({ group: B.body, size: "8", et: "Card", data: detail([
    col("description", "description", { hideHeader: false, valueFontStyle: "prose" }),
    col("steps", "steps to reproduce", { hideHeader: false, valueFontStyle: "prosePre" }),
    col("expected", "expected", { hideHeader: false, valueFontStyle: "prose" }),
    col("actual", "actual", { hideHeader: false, valueFontStyle: "prose" }),
    col("env", "environment", { hideHeader: false, valueFontStyle: "chip" }),
  ], { cellsGridSize: 1, cellsRowGap: 12, cardsPadding: 18, cardBorder: false, headerValueLayout: "col",
       headerFontStyle: "metaXS" }),
    bg: "white", border: { top: true, left: true, right: true, bottom: true }, radius: { tl: true, tr: true, bl: true, br: true } });
  // Details rail — ONE section (a separate fused title section would wrap to the next band row
  // beside the tall left card); title = static first cell. Status is the live control (editable
  // pill, liveEdit persists on change = the mockup's Mark resolved / Reopen).
  const fld = (over = {}) => ({ hideHeader: false, headerFontStyle: "metaXS", cellBorderBottom: true, ...over });
  S.push({ group: B.body, size: "4", et: "Card", data: detail([
    stat("dtitle", "Details", { valueFontStyle: "cardTitleSM", cellBorderBottom: true }),
    pcol("status", "status", STATUS_PILL, fld({ allowEditInView: true })),
    rcalc(`(case data->>'source' when 'ai' then 'AI' when 'dev' then 'Dev' when 'client' then 'Client' else (data->>'source') end) as src`, "source",
      { type: "status_pill", pillColors: { AI: "blue", Dev: "slate", Client: "ink" }, hideHeader: false, headerFontStyle: "metaXS", cellBorderBottom: true }),
    col("assignee", "assignee", fld({ valueFontStyle: "proseSM" })),
    col("reporter", "reporter", fld({ valueFontStyle: "proseSM" })),
    pcol("severity", "severity", SEV_PILL, fld()),
    pcol("priority", "priority", PRIO_PILL, fld()),
    { name: "page_name", customName: "target page", show: true, hideHeader: false, headerFontStyle: "metaXS", cellBorderBottom: true,
      isLink: true, location: "/sitemgmt/page?key=", searchParamsCol: "page_key" },
    col("opened", "opened", fld({ valueFontStyle: "metaMD" })),
    col("updated", "updated", { hideHeader: false, headerFontStyle: "metaXS", valueFontStyle: "metaMD" }),
    col("page_key", "", { hideHeader: true, hideValue: true }),
  ], { cellsGridSize: 1, cellsRowGap: 6, cardsPadding: 14, headerValueLayout: "col", liveEdit: true }),
    bg: "white", border: { top: true, left: true, right: true, bottom: true }, radius: { tl: true, tr: true, bl: true, br: true } });

  // comments — fused title + prose, click-to-edit (threaded comments = logged enrichment; the
  // mockup's add-comment box is disabled too)
  S.push({ group: B.com, size: "12", et: "lexical", data: lexical(styled("cardTitleSM", text("Comments"))), ...cHeadr });
  S.push({ group: B.com, size: "12", et: "Card", data: detail([
    col("comments", "", { hideHeader: true, valueFontStyle: "prosePre" }),
  ], { cellsGridSize: 1, cardsPadding: 18, cardBorder: false }), ...cBot });

  console.log("TICKET DETAIL:");
  applyPage(resolvePage("ticket", "Ticket"), groups, S, [
    { id: "cr-ticket-id", values: "", searchKey: "id", useSearchParams: true },
  ]);
}
console.log("done — tickets list + ticket detail");
