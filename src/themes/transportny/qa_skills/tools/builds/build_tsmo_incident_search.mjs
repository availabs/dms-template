// Build the TSMO INCIDENT SEARCH explorer (slug incident_search, page 2183804) in
// MIGRATED to qa_skills/tools/builds/ (2026-07-07, task qa-build-scripts-migration.md).
// Run from dms-template root. Wipe hardened: delete by PAGE ID with loud failures.
// the tsmo2 pattern, from dms_design_system_v2/pages/tsmo-incident-search.html.
// Draft-only; idempotent (wipes this page's drafts). Faceted finder over the
// TRANSCOM event store (956/1947) with a multi-column keyword search; each row
// deep-links to incident_view. Plan:
//   planning/transportny/tasks/current/tsmo-incident-search-page-build.md
// Pattern proven: reliability builder (idiom) + incidents §04 table (2182349) +
// the MNY actions_index multi-column search (skills/full-text-search-filter.md).
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const ENV = { ...process.env, DMS_HOST: "http://localhost:3001", DMS_APP: "npmrdsv5", DMS_TYPE: "dev2" };
const CLI = "src/dms/packages/dms/cli/bin/dms.js";
const SLUG = "incident_search", PATTERN = "tsmo2", PAGE_ID = process.env.PAGE_ID || "2183804";
const cli = (...a) => execFileSync("node", [CLI, ...a], { env: ENV, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const clean = s => s.split("\n").filter(l => l.trim().startsWith("{")).pop();
const jget = id => JSON.parse(clean(cli("raw", "get", String(id))));
function cardEd(id) {
  const row = jget(id);
  const el = row.element || row.data?.element || row.data || row;
  const ed = el?.["element-data"] || row["element-data"];
  return typeof ed === "string" ? JSON.parse(ed) : ed;
}

// ── lexical builders (from the reliability/congestion build) ──────────────────
const text = (t, format = 0, style = "") => ({ type: "text", version: 1, detail: 0, format, mode: "normal", style, text: t });
const para = (...children) => ({ type: "paragraph", version: 1, direction: "ltr", format: "", indent: 0, textFormat: 0, textStyle: "", children });
const styled = (styleKey, ...children) => ({ type: "styled-paragraph", version: 1, direction: "ltr", format: "", indent: 0, textFormat: 0, textStyle: "", styleKey, children });
const head = (tag, t) => ({ type: "heading", tag, version: 1, direction: "ltr", format: "", indent: 0, children: [text(t)] });
const button = (linkText, path, style = "plain") => ({ type: "button", version: 1, linkText, path, style, keepSearchParams: false });
const layoutItem = (...children) => ({ type: "layout-item", version: 1, direction: "ltr", format: "", indent: 0, children });
const compoundHeader = (titleNode, kickerNode) => ({
  type: "layout-container", version: 1, direction: "ltr", format: "", indent: 0,
  templateColumns: "items-center grid-cols-[auto_1fr]",
  children: [layoutItem(titleNode), layoutItem(kickerNode)],
});
const lexical = (...nodes) => JSON.stringify({ bgColor: "rgba(0,0,0,0)", isCard: "", showToolbar: false,
  text: { root: { type: "root", version: 1, direction: "ltr", format: "", indent: 0, children: nodes } } });
const GOLD = "color:#CA8A04";

// ── source: reuse the TRANSCOM externalSource from the built incidents page ───
const TSRC = cardEd("2182325").externalSource;   // Transcom Events 956/1947 (npmrds2), full column schema

// ── page-variable leaves ──────────────────────────────────────────────────────
// Default time window = the PREVIOUS CALENDAR MONTH, computed at BUILD time (re-run the
// builder to advance it). `new Date()` is fine here (plain script, not a workflow).
// NB: this is a build-time default, not page-load. A true on-load "month before now()"
// needs an op:'time' relative leaf on start_date_time ({kind:'relative',unit:'month',
// count:1,direction:'past'}) which the server evaluates against now() at query time —
// offered as a follow-up (it replaces year+month equality with a time-range model).
const _now = new Date();
const _prev = new Date(_now.getFullYear(), _now.getMonth() - 1, 1);
const DEFAULT_YEAR = String(_prev.getFullYear());     // e.g. "2026"
const DEFAULT_MONTH = String(_prev.getMonth() + 1);   // e.g. "5" (May)
const NY = () => ({ col: "state", op: "filter", value: ["NY"] });          // base scope (cost/delay are NY-only)
const REGION = () => ({ col: "region_name", op: "filter", value: [], usePageFilters: true, searchParamKey: "region" });
const COUNTY = () => ({ col: "county_name", op: "filter", value: [], usePageFilters: true, searchParamKey: "county" });
const YEAR = () => ({ col: "year", op: "filter", value: [DEFAULT_YEAR], usePageFilters: true, searchParamKey: "year" });
const MONTH = () => ({ col: "month", op: "filter", value: [DEFAULT_MONTH], usePageFilters: true, searchParamKey: "month" });
const CATEGORY = () => ({ col: "nysdot_sub_category", op: "filter", value: [], usePageFilters: true, searchParamKey: "category" });
// multi-column keyword search: ONE OR group, one `like` leaf per searchable column,
// all sharing searchParamKey "search". Empty value → each leaf drops out server-side
// (lower(col)::text LIKE lower($n) — case-insensitive). Pattern: full-text-search-filter.md
const SEARCH_COLS = ["facility", "description", "summary_description", "nysdot_sub_category", "county_name", "event_id"];
const SEARCH = () => ({ op: "OR", groups: SEARCH_COLS.map(col => (
  { col, op: "like", value: "", usePageFilters: true, searchParamKey: "search" })) });
// every data section's WHERE: base NY + the 5 facets + the keyword OR group
const DATA_LEAVES = () => [NY(), REGION(), COUNTY(), YEAR(), MONTH(), CATEGORY(), SEARCH()];

// ── dataWrapper + column helpers ──────────────────────────────────────────────
const dw = ({ src = TSRC, columns, filters = [], display = {}, fetchMode = "smart", join = { sources: {} } }) => JSON.stringify({
  externalSource: src, columns,
  filters: { op: "AND", groups: filters },
  display: { usePagination: false, preventDuplicateFetch: true, readyToLoad: true, fetchMode,
             showAttribution: false, striped: false, autoResize: false, hideSection: false, ...display },
  data: [], join,
});
const KPI_DISPLAY = { pageSize: 1, totalLength: 1, headerValueLayout: "col", reverse: false,
  cellsGridSize: 1, cellsGridGap: 4, cardsGridSize: 1, cardsGridGap: 0, cardBorder: false, cellBorder: false, cardsPadding: 14 };
const calc = (sql, alias, over = {}) => ({ name: sql, type: "calculated", display_name: alias,
  normalName: alias, show: true, fn: "exempt", formatFn: " ", justify: "left",
  hideHeader: true, hideValue: false, cellSpan: 1, ...over });
// a plain spreadsheet column (aggregate or group)
const col = (sql, label, over = {}) => ({ name: sql, customName: label, show: true, justify: "left", ...over });

// a Filter control — cascading columns[] style so the option list can be SCOPED
// (state=NY + the page year/region). RenderFilters derives option-narrowing from
// columns[].filters, so scoping here (a) shrinks the DISTINCT scan on 3.7M-row 1947
// — county_name unscoped = 5.3s vs NY+year ≈ 0.95s — and (b) makes county/category/
// month options contextual to the current region+year. (filters.groups style can't scope.)
const FLABEL = { region_name: "Region", county_name: "County", year: "Year", month: "Month", nysdot_sub_category: "Category" };
const NYS = { col: "state", static: ["NY"] };   // base scope on every control's option query
// static labeled options for the month control (DB column is int 1–12; show names).
// RenderFilters picks up column.options [{value,label}] (RenderFilters.jsx:121) and skips
// the DB distinct query — the documented "months with no real DB column" use case.
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  .map((label, i) => ({ value: String(i + 1), label }));
// NB: external filter MUST be isMulti:true (operation:'filter' → multiselect EditComp;
// isMulti:false misrenders as a number input — RenderFilterValueSelector.jsx:112). Multi
// also makes each value a removable chip → clearing Year/Month widens to all events.
const facet = (column, key, { value = [], scopes = [], options } = {}) => JSON.stringify({
  externalSource: TSRC,
  columns: [
    { name: column, customName: FLABEL[column] || column, type: "multiselect", show: true,
      ...(options ? { options } : {}),
      filters: [{ type: "external", operation: "filter", values: value, isMulti: true, usePageFilters: true, searchParamKey: key }] },
    ...scopes.map(s => ({ name: s.col, show: false,
      filters: [s.static
        ? { type: "internal", operation: "filter", values: s.static }
        : { type: "internal", operation: "filter", values: [], usePageFilters: true, searchParamKey: s.key }] })),
  ],
  filters: { op: "AND", groups: [] },
  display: { totalLength: 1, hideExternalToggle: true, showAttribution: false, filterStyle: "filter_panel", fetchMode: "smart" },
  data: [], join: { sources: {} },
});
// the keyword Search control (MNY actions_index idiom: a columns[] entry with operation:'like')
const searchControl = () => JSON.stringify({
  externalSource: TSRC,
  columns: [{ name: "facility", customName: "Search · facility · description · category · county · id", type: "select", show: true,
    filters: [{ type: "external", operation: "like", values: [], isMulti: false, usePageFilters: true, searchParamKey: "search", display: "" }] }],
  filters: { op: "AND", groups: [] },
  display: { totalLength: 1, readyToLoad: true, hideExternalToggle: true, showAttribution: false, filterStyle: "filter_panel", fetchMode: "smart" },
  data: [], join: { sources: {} },
});

// ── bands ──────────────────────────────────────────────────────────────────
const B = { hdr: randomUUID(), bar: randomUUID(), res: randomUUID(), cov: randomUUID(), foot: randomUUID() };
const groups = [
  { name: B.hdr,  index: 0, theme: "header",       position: "content", displayName: "Page header" },
  { name: B.bar,  index: 1, theme: "filter_bar",   position: "content", displayName: "Filter + search bar" },
  { name: B.res,  index: 2, theme: "content",      position: "content", displayName: "Results table" },
  { name: B.cov,  index: 3, theme: "content_tint", position: "content", displayName: "Coverage note" },
  { name: B.foot, index: 4, theme: "footer",       position: "content", displayName: "Footer" },
];
const S = [];
const sec = (group, size, et, data, extra = {}) => S.push({ group, size, et, data, ...extra });

// ═════════ PAGE HEADER ═════════
sec(B.hdr, "8", "lexical", lexical(
  styled("kicker", text("// explorer · transcom event store")),
  styled("displayLG", text("INCIDENT SEARCH"), text(".", 0, GOLD)),
  styled("prose", text("Find any event in the TRANSCOM feed — by region, county, time period, category or keyword — and follow it through to its congestion footprint. NY-filtered; 3.7M events since 2015.")),
));
sec(B.hdr, "4", "lexical", lexical(
  styled("metaXS", text("NY-filtered · live transcom feed")),
  styled("metaXS", text("attributed delay & cost on ~18.5% of events")),
), { padding: { top: "0" } });

// ═════════ FILTER + SEARCH BAR ═════════
sec(B.bar, "3", "Filter", facet("region_name", "region", { scopes: [NYS] }));
sec(B.bar, "3", "Filter", facet("county_name", "county", { scopes: [NYS, { col: "year", key: "year" }, { col: "region_name", key: "region" }] }));
sec(B.bar, "3", "Filter", facet("year", "year", { value: [DEFAULT_YEAR], scopes: [NYS] }));
sec(B.bar, "3", "Filter", facet("month", "month", { value: [DEFAULT_MONTH], options: MONTHS }));
sec(B.bar, "4", "Filter", facet("nysdot_sub_category", "category", { scopes: [NYS, { col: "year", key: "year" }] }));
sec(B.bar, "8", "Filter", searchControl());

// ═════════ RESULTS ═════════
sec(B.res, "8", "lexical", lexical(
  compoundHeader(styled("cardTitleSM", text("Matching events")),
    styled("kicker", text("// results · one row per event · ranked by attributed delay"))),
  styled("proseSM", text("Click a row's view link for the full congestion footprint. Rows without a measured footprint show “—” for delay and cost and still appear.")),
));
// count strip — reacts to every filter + the keyword search
sec(B.res, "4", "Card", dw({
  columns: [
    calc("count(distinct event_id) as n", "n", { valueFontStyle: "statXL", formatFn: "comma", justify: "right", cellSpan: 1 }),
    calc("'events match' as lbl", "lbl", { valueFontStyle: "proseSM", justify: "right", cellSpan: 1 }),
  ],
  filters: DATA_LEAVES(),
  display: { ...KPI_DISPLAY },
}), { bg: "white", border: "full", height: "fill" });
// the results table — one row per event (event_id is UNIQUE on 1947, so no GROUP BY:
// a plain filtered ORDER BY … LIMIT is ~1s vs a multi-second group+aggregate). Smart fetch.
sec(B.res, "12", "Spreadsheet", dw({
  columns: [
    col("to_char(start_date_time::timestamp, 'Mon DD, YYYY') as evt_date", "Date", { justify: "left" }),
    col("nysdot_sub_category", "Category", { justify: "left" }),
    col("facility", "Facility", { justify: "left" }),
    col("coalesce(county_name,'—') as county", "County", { justify: "left" }),
    col("estimated_duration_mins", "Duration · min", { formatFn: " ", justify: "right" }),
    col("round(vehicle_delay) as delay", "Attr. delay · vh", { formatFn: "comma", justify: "right", sort: "desc nulls last" }),
    col("case when cost is null then '—' when cost >= 1e6 then '$' || round(cost/1e6,2)::text || 'M' when cost >= 1e3 then '$' || round(cost/1e3)::text || 'k' else '$' || cost::text end as cost", "Cost", { justify: "right" }),
    { name: "event_id", customName: "", show: true, justify: "right",
      isLink: true, location: "/incident_view?event_id=", searchParams: "value", linkText: "view →" },
  ],
  filters: DATA_LEAVES(),
  display: { usePagination: true, pageSize: 12, fetchMode: "smart", showAttribution: false, readyToLoad: true },
}));

// ═════════ COVERAGE NOTE ═════════
sec(B.cov, "12", "lexical", lexical(
  styled("kicker", text("// about attributed delay")),
  styled("proseSM", text("Delay and cost are computed only for events with a measured congestion footprint — about 18.5% of all events. Rows without a footprint show “—” and still appear in results. Cost is an interim flat $20/veh-hr basis and will re-base to the AADT class-weighted value-of-time formula as that ETL lands.")),
  para(button("data & methodology →", "/tsmo-methodology", "plain")),
), { bg: "white", border: "full" });

// ═════════ FOOTER ═════════
sec(B.foot, "12", "lexical", lexical(
  para(button("incidents", "/incidents_v2", "plain"), button("corridor-view", "/corridor_view", "plain"),
       button("work-zones", "/workzones_v2", "plain"), button("methodology", "/tsmo-methodology", "plain"),
       text("        © NYSDOT · TransportNY DMS v0.2", 0, "color:#64748b;font-size:11px")),
));

// ── apply ────────────────────────────────────────────────────────────────────
const pageId = PAGE_ID;
const existing = jget(pageId).data.draft_sections || [];
for (const e of existing) { try { cli("section", "delete", String(e.id), "--page", String(pageId)); } catch (err) { console.log("  DELETE FAILED for", e.id, String(err).slice(0, 120)); } }
console.log("wiped", existing.length, "draft sections");

const gf = JSON.stringify({
  draft_section_groups: groups,
  filters: [
    { id: "tsmo-is-region",   values: "",           searchKey: "region",   useSearchParams: true },
    { id: "tsmo-is-county",   values: "",           searchKey: "county",   useSearchParams: true },
    { id: "tsmo-is-year",     values: DEFAULT_YEAR,  searchKey: "year",     useSearchParams: true },
    { id: "tsmo-is-month",    values: DEFAULT_MONTH, searchKey: "month",    useSearchParams: true },
    { id: "tsmo-is-category", values: "",           searchKey: "category", useSearchParams: true },
    { id: "tsmo-is-search",   values: "",           searchKey: "search",   useSearchParams: true },
  ],
});
cli("raw", "update", String(pageId), "--data", gf);
console.log("bands + page variables (region, county, year, month, category, search) registered");

let n = 0;
for (const s of S) {
  const payload = { size: s.size, group: s.group, title: "",
    element: { "element-data": s.data, "element-type": s.et }, "element-type": s.et };
  for (const k of ["border", "radius", "padding", "height", "bg"]) if (s[k] != null) payload[k] = s[k];
  cli("section", "create", String(pageId), "--pattern", PATTERN, "--data", JSON.stringify(payload));
  n++;
}
console.log(`created ${n} sections on ${SLUG} (page ${pageId})`);
