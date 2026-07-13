// Build the TSMO CONGESTION page as a NEW page (slug congestion_v2) in the
// MIGRATED to qa_skills/tools/builds/ (2026-07-07, task qa-build-scripts-migration.md).
// Run from dms-template root. Wipe hardened: delete by PAGE ID with loud failures.
// tsmo2 pattern, matching the revised tsmo-congestion.html. Draft-only;
// idempotent (wipes this page's drafts). The OLD Congestion page (1473368) is
// untouched. Patterns reused from the home build: selectOnly group cols,
// stat_value figures, chip/metaAccent tokens, fixed cellWidth chip tracks,
// bg:white composites, spark/chart anatomy, fetchMode set here + seeding via
// seed_congestion_data.mjs (run after).
// Page variables: year (default 2025) + region (default all).
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";

import { mkdirSync as __mk } from "node:fs";
__mk("scratchpad/npmrdsv5-dev2", { recursive: true });

const ENV = { ...process.env, DMS_HOST: "http://localhost:3001", DMS_APP: "npmrdsv5", DMS_TYPE: "dev2" };
const CLI = "src/dms/packages/dms/cli/bin/dms.js";
const SLUG = "congestion_v2", PATTERN = "tsmo2";
const cli = (...a) => execFileSync("node", [CLI, ...a], { env: ENV, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const clean = s => s.split("\n").filter(l => l.trim().startsWith("{")).pop();
const jget = id => JSON.parse(clean(cli("raw", "get", String(id))));

// ── lexical builders ─────────────────────────────────────────────────────────
const text = (t, format = 0, style = "") => ({ type: "text", version: 1, detail: 0, format, mode: "normal", style, text: t });
const dot = c => text("●", 0, `color:${c};font-size:0.8em;vertical-align:middle`);
const sq = c => text("■", 0, `color:${c};font-size:0.75em;vertical-align:middle`);
const para = (...children) => ({ type: "paragraph", version: 1, direction: "ltr", format: "", indent: 0, textFormat: 0, textStyle: "", children });
const styled = (styleKey, ...children) => ({ type: "styled-paragraph", version: 1, direction: "ltr", format: "", indent: 0, textFormat: 0, textStyle: "", styleKey, children });
const head = (tag, t) => ({ type: "heading", tag, version: 1, direction: "ltr", format: "", indent: 0, children: [text(t)] });
const button = (linkText, path, style = "plain") => ({ type: "button", version: 1, linkText, path, style, keepSearchParams: false });
const lexical = (...nodes) => JSON.stringify({ bgColor: "rgba(0,0,0,0)", isCard: "", showToolbar: false,
  text: { root: { type: "root", version: 1, direction: "ltr", format: "", indent: 0, children: nodes } } });
const GOLD = "color:#CA8A04";

// ── sources ──────────────────────────────────────────────────────────────────
const ED_SRC = {
  name: "excessive_delay_v2_series", source_id: 2039, env: "npmrds2", srcEnv: "npmrds2",
  isDms: false, baseUrl: "/datasources", type: "excessive_delay",
  view_id: 3488, view_name: "v2 series (Dec 2024 → present)",
  columns: [
    { name: "tmc", type: "character varying" }, { name: "year", type: "smallint" },
    { name: "month", type: "smallint" }, { name: "total", type: "double precision" },
    { name: "non_recurrent", type: "double precision" }, { name: "construction", type: "double precision" },
    { name: "accident", type: "double precision" }, { name: "other", type: "double precision" },
    { name: "region_code", type: "character varying" }, { name: "region_name", type: "character varying" },
    { name: "county_code", type: "character varying" }, { name: "roadname", type: "character varying" },
    { name: "length", type: "double precision" }, { name: "f_system", type: "smallint" },
  ],
};

// ── dataWrapper helpers ──────────────────────────────────────────────────────
const YEAR_LEAF = (col = "year") => ({ col, op: "filter", value: ["2025"], usePageFilters: true, searchParamKey: "year" });
const REGION_LEAF = () => ({ col: "region_name", op: "filter", value: [], usePageFilters: true, searchParamKey: "region" });
const dw = ({ src = ED_SRC, columns, filters = [], display = {}, fetchMode = "smart" }) => JSON.stringify({
  externalSource: src, columns,
  filters: { op: "AND", groups: filters },
  display: { usePagination: false, preventDuplicateFetch: true, readyToLoad: true, fetchMode,
             showAttribution: false, striped: false, autoResize: false, hideSection: false, ...display },
  data: [], join: { sources: {} },
});
const KPI_DISPLAY = { pageSize: 1, totalLength: 1, headerValueLayout: "col", reverse: false,
  cellsGridSize: 2, cellsGridGap: 6, cardsGridSize: 1, cardsGridGap: 0,
  cardBorder: true, cellBorder: false, cardsPadding: 10 };
const groupCol = (name) => ({ name, type: "INTEGER", show: true, group: true, sort: "desc",
  hideHeader: true, hideValue: true, selectOnly: true, justify: "left", customName: name, valueFontStyle: "metaSM" });
const calc = (sql, alias, over = {}) => ({ name: sql, type: "calculated", display_name: alias,
  normalName: alias, show: true, fn: "exempt", formatFn: " ", justify: "left",
  hideHeader: true, hideValue: false, cellSpan: 2, ...over });
const statCol = (sql, alias, { prefix, unit } = {}) => ({ name: sql, type: "stat_value", display_name: alias,
  normalName: alias, show: true, fn: "exempt", formatFn: " ", justify: "left",
  hideHeader: true, hideValue: false, valueFontStyle: "statXL", cellSpan: 2,
  ...(prefix ? { prefix } : {}), ...(unit ? { unit } : {}) });
const chipCol = (sql, alias) => calc(sql, alias, { valueFontStyle: "chip", justify: "right", cellSpan: 1, cellWidth: "110px" });
const labelCol = (sql, alias) => calc(sql, alias, { valueFontStyle: "metaSM", cellSpan: 1 });

// composition series (shared by the stacked chart)
const SER = {
  recurrent: `round(((sum(total) - sum(non_recurrent)) / 1000000.0)::numeric, 1) as recurrent`,
  other_ev: `round(((sum(non_recurrent) - sum(construction) - sum(accident) - sum(other)) / 1000000.0)::numeric, 1) as other_events`,
  constr: `round((sum(construction) / 1000000.0)::numeric, 1) as construction_mvh`,
  accid: `round((sum(accident) / 1000000.0)::numeric, 1) as accident_mvh`,
};
const yser = (sql, alias, color) => ({ name: sql, type: "calculated", display_name: alias, normalName: alias,
  show: true, fn: "exempt", target: "yAxis", color });

// ── bands ────────────────────────────────────────────────────────────────────
const B = { hdr: randomUUID(), bar: randomUUID(), kpi: randomUUID(), comp: randomUUID(),
            season: randomUUID(), corr: randomUUID(), foot: randomUUID() };
const groups = [
  { name: B.hdr,    index: 0, theme: "header",       position: "content", displayName: "Page header" },
  { name: B.bar,    index: 1, theme: "tone_bar",     position: "content", displayName: "Filter bar" },
  { name: B.kpi,    index: 2, theme: "content",      position: "content", displayName: "§01 KPIs" },
  { name: B.comp,   index: 3, theme: "content",      position: "content", displayName: "§02 Composition" },
  { name: B.season, index: 4, theme: "content_tint", position: "content", displayName: "§03 Seasonality + regions" },
  { name: B.corr,   index: 5, theme: "content",      position: "content", displayName: "§04 Corridors" },
  { name: B.foot,   index: 6, theme: "footer",       position: "content", displayName: "Footer" },
];

const S = [];
const sec = (group, size, et, data, extra = {}) => S.push({ group, size, et, data, ...extra });

// ═════════ PAGE HEADER ═════════
sec(B.hdr, "8", "lexical", lexical(
  styled("kicker", text("// delay attribution · where, when & why")),
  styled("displayLG", text("CONGESTION"), text(".", 0, GOLD)),
  styled("prose", text("Excessive delay on New York's monitored roads, split into what recurs every day and what events cause — construction, crashes, and everything else. Computed per road segment and month from NPMRDS probe speeds with TRANSCOM event attribution (methodology v2 — median baselines, speed-limit thresholds); dollars use FHWA value of time at $20 per vehicle-hour.")),
));
sec(B.hdr, "4", "Card", dw({
  columns: [
    calc(`'data as of · v2 series thru ' || to_char(to_date(max(year * 100 + month)::text, 'YYYYMM'), 'Mon YYYY') as asof`, "asof",
      { valueFontStyle: "chip", justify: "right" }),
    calc(`'source · excessive_delay_v2_series · batch monthly' as src`, "src",
      { valueFontStyle: "metaXS", justify: "right" }),
  ],
  filters: [], display: { ...KPI_DISPLAY, cardBorder: false, cardsPadding: 0, cellsGridSize: 1 },
  fetchMode: "force",
}));

// ═════════ TONE BAR · year + region controls ═════════
sec(B.bar, "3", "Filter", dw({
  columns: [{ name: "year", customName: "Year", type: "multiselect", show: true,
    filters: [{ type: "external", operation: "filter", values: ["2025"], isMulti: true, usePageFilters: true, searchParamKey: "year" }] }],
  filters: [],
  display: { totalLength: 1, hideExternalToggle: true, showAttribution: false, filterStyle: "tone_bar" },
  fetchMode: "smart",
}));
sec(B.bar, "4", "Filter", dw({
  columns: [{ name: "region_name", customName: "Region", type: "multiselect", show: true,
    filters: [{ type: "external", operation: "filter", values: [], isMulti: true, usePageFilters: true, searchParamKey: "region" }] }],
  filters: [],
  display: { totalLength: 1, hideExternalToggle: true, showAttribution: false, filterStyle: "tone_bar" },
  fetchMode: "smart",
}));
sec(B.bar, "5", "Card", dw({
  columns: [groupCol("year"),
    calc(`to_char(count(distinct tmc), 'FM99,999') || ' monitored TMCs · NY only' as tmcs`, "tmcs",
      { valueFontStyle: "metaSM", justify: "right", cellSpan: 1 })],
  filters: [YEAR_LEAF()],
  display: { ...KPI_DISPLAY, cardBorder: false, cardsPadding: 0, cellsGridSize: 1 },
}));

// ═════════ § 01 · KPIs ═════════
sec(B.kpi, "4", "Card", dw({
  columns: [
    groupCol("year"),
    labelCol(`'total excessive delay' as label`, "label"),
    chipCol(`'cy ' || max(year)::text || ' · statewide' as asof`, "asof"),
    statCol(`round((sum(total) / 1000000.0)::numeric, 1) as total_mvh`, "total_mvh", { unit: "M veh-hrs" }),
    calc(`'statewide, all road classes · selected year and region' as note`, "note",
      { valueFontStyle: "proseSM", cellBorderBelow: true }),
    calc(`'methodology v2' as meth`, "meth", { valueFontStyle: "chip", cellSpan: 1, cellPaddingTop: 6 }),
    chipCol(`'v2 series · begins dec 2024' as ser`, "ser"),
  ],
  filters: [YEAR_LEAF(), REGION_LEAF()], display: KPI_DISPLAY,
}), { height: "fill" });
sec(B.kpi, "4", "Card", dw({
  columns: [
    groupCol("year"),
    labelCol(`'cost of congestion' as label`, "label"),
    chipCol(`'cy ' || max(year)::text || ' · statewide' as asof`, "asof"),
    statCol(`round((sum(total) * 20 / 1000000000.0)::numeric, 1) as cost_b`, "cost_b", { prefix: "$", unit: "billion" }),
    calc(`'$20 per vehicle-hour of delay (FHWA)' as note`, "note",
      { valueFontStyle: "proseSM", cellBorderBelow: true }),
    calc(`'recurrent $' || round(((sum(total) - sum(non_recurrent)) * 20 / 1000000000.0)::numeric, 1)::text || 'B' as rec_cost`, "rec_cost",
      { valueFontStyle: "metaMD", cellSpan: 1, cellPaddingTop: 6 }),
    calc(`'non-recurrent $' || round((sum(non_recurrent) * 20 / 1000000000.0)::numeric, 1)::text || 'B' as nr_cost`, "nr_cost",
      { valueFontStyle: "metaAccent", cellSpan: 1, cellPaddingTop: 6 }),
  ],
  filters: [YEAR_LEAF(), REGION_LEAF()], display: KPI_DISPLAY,
}), { height: "fill" });
sec(B.kpi, "4", "Card", dw({
  columns: [
    groupCol("year"),
    labelCol(`'non-recurrent share' as label`, "label"),
    chipCol(`'cy ' || max(year)::text as asof`, "asof"),
    statCol(`round((100.0 * sum(non_recurrent) / nullif(sum(total), 0))::numeric, 0) as nr_pct`, "nr_pct", { unit: "%" }),
    calc(`round((sum(non_recurrent) / 1000000.0)::numeric, 1)::text || 'M of ' || round((sum(total) / 1000000.0)::numeric, 1)::text || 'M veh-hrs tied to events, not everyday volume' as note`, "note",
      { valueFontStyle: "proseSM", cellBorderBelow: true }),
    calc(`'construction ' || round((sum(construction) / 1000000.0)::numeric, 1)::text || 'M · accident ' || round((sum(accident) / 1000000.0)::numeric, 1)::text || 'M · other events ' || round(((sum(non_recurrent) - sum(construction) - sum(accident) - sum(other)) / 1000000.0)::numeric, 1)::text || 'M' as split`, "split",
      { valueFontStyle: "metaAccent", cellPaddingTop: 6 }),
  ],
  filters: [YEAR_LEAF(), REGION_LEAF()], display: KPI_DISPLAY,
}), { height: "fill" });

// ═════════ § 02 · COMPOSITION (data-bound; grows as backfill lands) ═════════
sec(B.comp, "12", "lexical", lexical(
  styled("kicker", text("// 02   excessive delay by year · attribution buckets · M veh-hrs")),
  styled("cardTitleSM", text("Delay composition by year")),
), { ...{ border: { top: true, left: true, right: true }, radius: { tl: true, tr: true }, padding: { bottom: "0" } }, bg: "white" });
sec(B.comp, "12", "AVL Graph", dw({
  columns: [
    { name: "year", show: true, group: true, sort: "asc", target: "xAxis" },
    yser(SER.recurrent, "recurrent", "#6F6F6F"),
    yser(SER.other_ev, "other_events", "#E8843F"),
    yser(SER.constr, "construction_mvh", "#D6453B"),
    yser(SER.accid, "accident_mvh", "#7F1D1D"),
  ],
  filters: [REGION_LEAF()],                          // all years; reacts to region only
  display: { graphType: "BarGraph", groupMode: "stacked", height: 280, totalLength: 12,
    bgColor: "#ffffff", textColor: "#0F1722", hideExternalToggle: true,
    margin: { top: 10, right: 20, bottom: 30, left: 56 },
    paddingInner: 0.35, paddingOuter: 0.1,
    title: { title: "", position: "start", fontSize: 12, fontWeight: "normal" }, description: "",
    colors: { type: "palette", value: ["#6F6F6F", "#E8843F", "#D6453B", "#7F1D1D"] },
    xAxis: { show: true, showGridLines: false, axisColor: "transparent", tickColor: "#94a3b8",
             tickFontSize: "10px", tickFontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
    yAxis: { show: true, showGridLines: true, format: "integer",
             tickColor: "#94a3b8", tickFontSize: "10px", tickFontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
    legend: { show: false }, tooltip: { show: true, showTotal: true } },
}), { border: { left: true, right: true }, padding: { top: "0", bottom: "0" }, bg: "white" });
sec(B.comp, "12", "lexical", lexical(
  para(sq("#6F6F6F"), text(" recurrent (total − non-recurrent)    "), sq("#E8843F"), text(" non-recurrent · other events    "),
       sq("#D6453B"), text(" non-recurrent · construction    "), sq("#7F1D1D"), text(" non-recurrent · accident")),
  styled("proseSM", text("Bound to the v2 series — bars appear as the backfill lands (2024 completing; 2023→2017 queued). Partial years show partial totals. v2 figures are not comparable to previously published v1 numbers.")),
), { border: { left: true, right: true, bottom: true }, radius: { bl: true, br: true }, padding: { top: "0" }, bg: "white" });

// ═════════ § 03 · SEASONALITY + REGION RANK ═════════
sec(B.season, "12", "lexical", lexical(
  styled("kicker", text("// 03")),
  head("h2", "When and where."),
));
sec(B.season, "7", "AVL Graph", dw({
  columns: [
    { name: "month", show: true, group: true, sort: "asc", target: "xAxis" },
    yser(`round((sum(total) / 1000000.0)::numeric, 2) as mvh`, "mvh", "#1F3F8F"),
  ],
  filters: [YEAR_LEAF(), REGION_LEAF()],
  display: { graphType: "BarGraph", height: 240, totalLength: 13,
    bgColor: "#ffffff", textColor: "#0F1722", hideExternalToggle: true,
    margin: { top: 16, right: 20, bottom: 5, left: 44 },
    paddingInner: 0.3, paddingOuter: 0.05,
    title: { title: "Seasonality · monthly delay · M veh-hrs", position: "start", fontSize: 13, fontWeight: "bold" }, description: "",
    colors: { type: "palette", value: ["#1F3F8F"] },
    xAxis: { show: true, position: "top", showGridLines: false, axisColor: "transparent", tickColor: "#94a3b8",
             tickFontSize: "9px", tickFontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
             tickLabels: { "1": "J", "2": "F", "3": "M", "4": "A", "5": "M", "6": "J", "7": "J", "8": "A", "9": "S", "10": "O", "11": "N", "12": "D" } },
    yAxis: { show: false, showGridLines: false },
    legend: { show: false }, tooltip: { show: true } },
}), { bg: "white", border: "full", height: "fill" });
sec(B.season, "5", "AVL Graph", dw({
  columns: [
    { name: "region_name", show: true, group: true, target: "xAxis" },
    { name: `round((sum(total) / 1000000.0)::numeric, 1) as mvh`, type: "calculated", display_name: "mvh",
      normalName: "mvh", show: true, fn: "exempt", target: "yAxis", sort: "asc", color: "#1F3F8F" },
  ],
  filters: [YEAR_LEAF()],
  display: { graphType: "BarGraph", orientation: "horizontal", height: 240, totalLength: 12,
    bgColor: "#ffffff", textColor: "#0F1722", hideExternalToggle: true,
    margin: { top: 5, right: 20, bottom: 24, left: 150 },
    paddingInner: 0.3, paddingOuter: 0.05,
    title: { title: "Delay by NYSDOT region · M veh-hrs", position: "start", fontSize: 13, fontWeight: "bold" }, description: "",
    colors: { type: "palette", value: ["#1F3F8F"] },
    xAxis: { show: true, showGridLines: false, axisColor: "transparent", tickColor: "#64748b",
             tickFontSize: "10px", tickFontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
    yAxis: { show: true, showGridLines: true, format: "integer", tickColor: "#94a3b8", tickFontSize: "10px" },
    legend: { show: false }, tooltip: { show: true } },
}), { bg: "white", border: "full", height: "fill" });

// ═════════ § 04 · CORRIDORS ═════════
sec(B.corr, "12", "lexical", lexical(
  styled("kicker", text("// 04   worst corridors by excessive delay · grouped by roadname")),
  head("h2", "Where the delay lives."),
));
sec(B.corr, "8", "Spreadsheet", dw({
  columns: [
    { name: "roadname", show: true, group: true, customName: "Corridor", justify: "left" },
    calc(`max(region_code) as region`, "region", { customName: "Region", hideHeader: false, cellSpan: 1, justify: "left", formatFn: " " }),
    calc(`round((sum(length) / 12)::numeric, 1) as miles`, "miles", { customName: "Miles", hideHeader: false, cellSpan: 1, justify: "right", formatFn: " " }),
    calc(`count(distinct tmc) as tmcs`, "tmcs", { customName: "TMCs", hideHeader: false, cellSpan: 1, justify: "right", formatFn: " " }),
    { name: `round((sum(total) / 1000000.0)::numeric, 2) as delay_mvh`, type: "calculated", display_name: "delay_mvh",
      normalName: "delay_mvh", show: true, fn: "exempt", formatFn: " ", customName: "Delay · M vh", justify: "right", sort: "desc" },
    calc(`'$' || round((sum(total) * 20 / 1000000.0)::numeric, 0)::text || 'M' as cost`, "cost", { customName: "Cost", hideHeader: false, cellSpan: 1, justify: "right", formatFn: " " }),
    calc(`round((sum(construction) * 100.0 / nullif(sum(non_recurrent), 0))::numeric, 0)::text || '%' as wz_share`, "wz_share", { customName: "WZ share of non-rec", hideHeader: false, cellSpan: 1, justify: "right", formatFn: " " }),
  ],
  filters: [YEAR_LEAF(), REGION_LEAF(),
    { col: "roadname", op: "neq", value: [""] }],
  display: { usePagination: true, pageSize: 10, totalLength: 10 },
}), { bg: "white", border: "full" });
sec(B.corr, "4", "lexical", lexical(
  styled("metaSM", text("where the delay is")),
  styled("cardTitleSM", text("TMC delay map")),
  styled("proseSM", text("Per-segment excessive delay choropleth for the selected year — every monitored TMC colored by vehicle-hours per mile.")),
  styled("metaXS", text("[BACKFILL→Map · tile layer from ED view 3488 geometry — pending tile-source decision]")),
  para(button("open corridor explorer →", "#", "plain")),
), { bg: "white", border: "full", height: "fill" });

// method note
sec(B.corr, "12", "lexical", lexical(
  styled("kicker", text("// methodology")),
  styled("cardTitleSM", text("How delay is measured and attributed")),
  styled("proseSM", text("Excessive delay counts vehicle-hours spent below the congestion threshold — under methodology v2, segment speed limits set the threshold (no 20 mph floor) and baselines use the median — computed per TMC segment and month from NPMRDS 5-minute probe speeds. TRANSCOM events claim their share of the non-recurrent total, capped so attribution never exceeds it — construction, accident, and other events — and recurrent delay is the remainder. Cost multiplies vehicle-hours by FHWA's value of time at $20 per vehicle-hour. The v2 series begins Dec 2024 and backfills toward 2017. v2 figures are not comparable to previously published v1 numbers.")),
  para(button("full methodology & data coverage →", "#", "plain"), button("  drill into a corridor →", "#", "plain")),
), { bg: "white", border: "full" });

// footer
sec(B.foot, "12", "lexical", lexical(
  para(button("home", "/", "plain"), button("incidents", "/incidents", "plain"), button("work-zones", "/work_zones", "plain"),
       text("        © NYSDOT · TransportNY DMS v0.2", 0, "color:#64748b;font-size:11px")),
));

// ── apply ────────────────────────────────────────────────────────────────────
let pageId;
try {
  pageId = jget(clean(cli("page", "show", SLUG, "--compact"))).id;
} catch { pageId = null; }
if (!pageId) {
  const out = clean(cli("page", "create", "--title", "Congestion (v2)", "--slug", SLUG, "--pattern", PATTERN));
  pageId = JSON.parse(out).id;
  console.log("created page", pageId);
} else {
  console.log("reusing page", pageId);
}

const existing = jget(pageId).data.draft_sections || [];
for (const e of existing) { try { cli("section", "delete", String(e.id), "--page", String(pageId)); } catch (err) { console.log("  DELETE FAILED for", e.id, String(err).slice(0, 120)); } }
console.log("wiped", existing.length, "draft sections");

const gf = "scratchpad/npmrdsv5-dev2/tsmo_congestion_groups.json";
fs.writeFileSync(gf, JSON.stringify({
  draft_section_groups: groups,
  filters: [
    { id: "tsmo-cong-year", values: "2025", searchKey: "year", useSearchParams: true },
    { id: "tsmo-cong-region", values: "", searchKey: "region", useSearchParams: true },
  ],
}));
cli("raw", "update", String(pageId), "--data", gf);
console.log("bands + page variables (year, region) registered");

let n = 0;
for (const s of S) {
  const payload = { size: s.size, group: s.group, title: "",
    element: { "element-data": s.data, "element-type": s.et }, "element-type": s.et };
  for (const k of ["border", "radius", "padding", "height", "bg"]) if (s[k] != null) payload[k] = s[k];
  cli("section", "create", String(pageId), "--pattern", PATTERN, "--data", JSON.stringify(payload));
  n++;
}
console.log(`created ${n} sections on ${SLUG} (page ${pageId})`);
