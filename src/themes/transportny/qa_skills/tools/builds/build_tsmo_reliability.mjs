// Build the TSMO RELIABILITY (PM3) page as a NEW page (slug reliability_v2) in the
// MIGRATED to qa_skills/tools/builds/ (2026-07-07, task qa-build-scripts-migration.md).
// Run from dms-template root. Wipe hardened: delete by PAGE ID with loud failures.
// tsmo2 pattern, matching tsmo-reliability.html. Draft-only; idempotent (wipes this
// page's drafts). Reuses the MAP-21 reliability bindings: source 2001/view 3394
// "Map 21 Extended" JOINED to FHWA targets 2027/3460, plus the status_pill/
// target_bar/delta column types. §01 KPI cards are cloned from MAP-21 cards
// 2173919/20/21 (Interstate / Non-Interstate / TTTR) at runtime and re-filtered.
// Page variables: year_record (default 2024) + region (derived crosswalk) + system.
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";

import { mkdirSync as __mk } from "node:fs";
__mk("scratchpad/npmrdsv5-dev2", { recursive: true });

const ENV = { ...process.env, DMS_HOST: "http://localhost:3001", DMS_APP: "npmrdsv5", DMS_TYPE: "dev2" };
const CLI = "src/dms/packages/dms/cli/bin/dms.js";
const SLUG = "reliability_v2", PATTERN = "tsmo2", PAGE_ID = "2180946";
const cli = (...a) => execFileSync("node", [CLI, ...a], { env: ENV, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const clean = s => s.split("\n").filter(l => l.trim().startsWith("{")).pop();
const jget = id => JSON.parse(clean(cli("raw", "get", String(id))));

// ── lexical builders (from the congestion build) ─────────────────────────────
const text = (t, format = 0, style = "") => ({ type: "text", version: 1, detail: 0, format, mode: "normal", style, text: t });
const sq = c => text("■", 0, `color:${c};font-size:0.75em;vertical-align:middle`);
const dash = c => text("—", 0, `color:${c};font-weight:bold;letter-spacing:-2px`);
const para = (...children) => ({ type: "paragraph", version: 1, direction: "ltr", format: "", indent: 0, textFormat: 0, textStyle: "", children });
const styled = (styleKey, ...children) => ({ type: "styled-paragraph", version: 1, direction: "ltr", format: "", indent: 0, textFormat: 0, textStyle: "", styleKey, children });
const head = (tag, t) => ({ type: "heading", tag, version: 1, direction: "ltr", format: "", indent: 0, children: [text(t)] });
const button = (linkText, path, style = "plain") => ({ type: "button", version: 1, linkText, path, style, keepSearchParams: false });
// single-line compound header: layout-container[grid-cols-[auto_1fr]] holding two layout-items
const layoutItem = (...children) => ({ type: "layout-item", version: 1, direction: "ltr", format: "", indent: 0, children });
const compoundHeader = (titleNode, kickerNode) => ({
  type: "layout-container", version: 1, direction: "ltr", format: "", indent: 0,
  templateColumns: "items-center grid-cols-[auto_1fr]",
  children: [layoutItem(titleNode), layoutItem(kickerNode)],
});
const lexical = (...nodes) => JSON.stringify({ bgColor: "rgba(0,0,0,0)", isCard: "", showToolbar: false,
  text: { root: { type: "root", version: 1, direction: "ltr", format: "", indent: 0, children: nodes } } });
const GOLD = "color:#CA8A04";

// ── crosswalk → region CASE (region filter = "option A": the CASE EXPRESSION is
// the filter `col` directly, with NO column added to the section). A `show:false`
// derived column poisons the UDA data fetch (null branch key, blank cells); a
// bare leaf whose `col` doesn't resolve to a section column passes through to the
// server verbatim → `WHERE (CASE …) IN ('Region 1 …')`. Empty/default leaf is a
// safe no-op server-side (same as congestion's region_name control). System uses
// the REAL `is_interstate` boolean column the same pass-through way.
const xwalk = JSON.parse(fs.readFileSync("scratchpad/npmrdsv5-dev2/reliability/xwalk.json", "utf8"));
const regionExpr = (cc = `"county_code"`) => "case " + Object.keys(xwalk).sort((a, b) => +a - +b)
  .map(rc => `when ${cc} in (${xwalk[rc].cc.map(c => `'${c}'`).join(",")}) then '${xwalk[rc].rn}'`)
  .join(" ") + " end";   // NB: no "as region" alias — this string is used as a filter col, not a SELECT col
const rsCols = () => [];   // option A adds no columns
const rsLeaves = () => [REGION_LEAF(), SYSTEM_LEAF()];

// ── sources ──────────────────────────────────────────────────────────────────
// resolve a section's element-data robustly across raw-get shapes
function cardEd(id) {
  const row = jget(id);
  const el = row.element || row.data?.element || row.data || row;
  const ed = el?.["element-data"] || row["element-data"];
  if (!ed) throw new Error(`no element-data for ${id}; keys=${Object.keys(row)} / ${Object.keys(el || {})}`);
  return typeof ed === "string" ? JSON.parse(ed) : ed;
}
const kpiInterstate = cardEd(2173919);
const RSRC = kpiInterstate.externalSource;          // Map 21 Extended 2001/3394
const RJOIN = kpiInterstate.join;                    // join to FHWA targets 2027/3460

const ED_SRC = {
  name: "excessive_delay_v2_series", source_id: 2039, env: "npmrds2", srcEnv: "npmrds2",
  isDms: false, baseUrl: "/datasources", type: "excessive_delay",
  view_id: 3488, view_name: "v2 series",
  columns: [{ name: "region_name", type: "character varying" }, { name: "region_code", type: "character varying" }, { name: "year", type: "smallint" }],
};

// ── reliability metric expressions (verbatim from view 3394 calc columns) ─────
const NHS = `"nhs" in (1,2,3,4,5,6,7,8,9) and "urban_code" is not null and "facility_type" in (1,2,6)`;
const PM = `"segment_length" * round("dir_aadt"::numeric, 0) * "occ_fac"`;
const RELIABLE_INT = `round((sum(case when greatest("lottr_amp","lottr_midd","lottr_pmp","lottr_we") >= 1.5 then 0 when "f_system" = 1 and ${NHS} then ${PM} else 0 end) / nullif(sum(case when "f_system" = 1 and ${NHS} then ${PM} else 0 end), 0) * 100)::numeric, 1)`;
const RELIABLE_NONINT = `round((sum(case when greatest("lottr_amp","lottr_midd","lottr_pmp","lottr_we") >= 1.5 then 0 when "f_system" > 1 and ${NHS} then ${PM} else 0 end) / nullif(sum(case when "f_system" > 1 and ${NHS} then ${PM} else 0 end), 0) * 100)::numeric, 1)`;
const TTTR_INT = `round((sum(case when "f_system" = 1 and ${NHS} then greatest("tttr_amp","tttr_midd","tttr_pmp","tttr_we","tttr_ovn") * "segment_length" else 0 end) / nullif(sum(case when "f_system" = 1 and ${NHS} then "segment_length" else 0 end), 0))::numeric, 2)`;
// worst-period LOTTR for a segment (max of the 4 LOTTR periods) — used by §03 bins / §04 corridors
const WORST_LOTTR = `greatest("lottr_amp","lottr_midd","lottr_pmp","lottr_we")`;

// ── dataWrapper helpers ──────────────────────────────────────────────────────
const DEFAULT_YEAR = "2025";   // latest in view 3394 (Int 79.8% — matches the design headline + task data contract)
const YEAR_LEAF = () => ({ col: "ds.year_record", op: "filter", value: ["2025", "2024"], usePageFilters: true,
  searchParamKey: "year_record", includePriorPeriod: true, priorPeriodStep: 1 });
const YEAR_LEAF_PLAIN = (col = "year_record") => ({ col, op: "filter", value: [DEFAULT_YEAR], usePageFilters: true, searchParamKey: "year_record" });
// Option A: the CASE expression IS the filter col (no section column). is_interstate is a real boolean col.
// `cc` qualifies county_code with the table alias when a join is present (KPIs join FHWA targets → ds.).
const REGION_LEAF = (cc = `"county_code"`) => ({ col: regionExpr(cc), op: "filter", value: [], usePageFilters: true, searchParamKey: "region" });
const SYSTEM_LEAF = () => ({ col: "is_interstate", op: "filter", value: [], usePageFilters: true, searchParamKey: "system" });

const dw = ({ src = RSRC, columns, filters = [], display = {}, fetchMode = "smart", join = { sources: {} } }) => JSON.stringify({
  externalSource: src, columns,
  filters: { op: "AND", groups: filters },
  display: { usePagination: false, preventDuplicateFetch: true, readyToLoad: true, fetchMode,
             showAttribution: false, striped: false, autoResize: false, hideSection: false, ...display },
  data: [], join,
});

const KPI_DISPLAY = { pageSize: 1, totalLength: 1, headerValueLayout: "col", reverse: false,
  cellsGridSize: 2, cellsGridGap: 6, cardsGridSize: 1, cardsGridGap: 0,
  cardBorder: true, cellBorder: false, cardsPadding: 10 };
const groupCol = (name) => ({ name, type: "INTEGER", show: true, group: true, sort: "desc",
  hideHeader: true, hideValue: true, selectOnly: true, justify: "left", customName: name, valueFontStyle: "metaSM" });
const calc = (sql, alias, over = {}) => ({ name: sql, type: "calculated", display_name: alias,
  normalName: alias, show: true, fn: "exempt", formatFn: " ", justify: "left",
  hideHeader: true, hideValue: false, cellSpan: 2, ...over });
const chipCol = (sql, alias) => calc(sql, alias, { valueFontStyle: "chip", justify: "right", cellSpan: 1, cellWidth: "110px" });
const labelCol = (sql, alias) => calc(sql, alias, { valueFontStyle: "metaSM", cellSpan: 1 });

// data_bar column helper (from congestion's data_bar work)
const barCol = (sql, alias, over = {}) => ({ name: sql, type: "data_bar", display_name: alias, normalName: alias,
  show: true, fn: "exempt", formatFn: " ", justify: "left", hideHeader: false, ...over });
// target_bar (value bar + target marker), standalone — mirrors the KPI card's target_bar
const targetBar = (valueSql, target, key, label) => ({ name: `${valueSql} as ${key}`, key: `${valueSql} as ${key}`,
  type: "target_bar", display_name: key, normalName: key, customName: label, show: true,
  hideHeader: false, hideValue: false, fn: "exempt", justify: "left",
  targetValue: String(target), barMax: "100", barDirection: "up", barUnit: "%", cellSpan: 2 });
// % of Interstate person-miles failing (LOTTR ≥ 1.50) in a given period — data_bar
// (person-miles weighted, consistent with the §01 reliable-% definition)
const periodFail = (label, lottrCol, key) => barCol(
  `round((100.0 * sum(${PM}) filter (where ${lottrCol} >= 1.5 and "f_system" = 1 and ${NHS}) / nullif(sum(${PM}) filter (where "f_system" = 1 and ${NHS}), 0))::numeric, 1) as ${key}`,
  key, { customName: label, barMax: "20", barShowValue: true, barUnit: "%", cellSpan: 2 });

// ── §01 KPI cards: clone MAP-21 2173919/20/21, re-filter to year+region ──────
function kpiCard(srcId) {
  const ed = cardEd(srcId);
  // swap geography/year leaves → reliability page filters (year + region). No system leaf on KPIs.
  // §01 KPIs react to Year + Region (NOT System — System is baked into each KPI's
  // SQL: Interstate / Non-Interstate / truck). Region uses option A with the join's
  // `ds.` alias on county_code. (Federal targets are statewide, but Region scoping
  // the reliable-% to a region is a useful regional read.)
  ed.filters = { op: "AND", groups: [YEAR_LEAF(), REGION_LEAF(`ds."county_code"`)] };   // year+includePriorPeriod (Δ) + region
  // ensure smart fetch + KPI display parity
  // white rounded card comes from the SECTION frame (bg:white + border:full) → turn
  // off the card's own border so we don't double up. (matches §03/§04/§05 cards)
  ed.display = { ...ed.display, fetchMode: "smart", preventDuplicateFetch: true, readyToLoad: true, cardBorder: false };
  ed.data = [];
  return JSON.stringify(ed);
}

// ── bands ────────────────────────────────────────────────────────────────────
const B = { hdr: randomUUID(), bar: randomUUID(), kpi: randomUUID(), trend: randomUUID(),
            map: randomUUID(), corr: randomUUID(), split: randomUUID(), foot: randomUUID() };
const groups = [
  { name: B.hdr,   index: 0, theme: "header",       position: "content", displayName: "Page header" },
  { name: B.bar,   index: 1, theme: "tone_bar",     position: "content", displayName: "Filter bar" },
  { name: B.kpi,   index: 2, theme: "content",      position: "content", displayName: "§01 KPIs vs targets" },
  { name: B.trend, index: 3, theme: "content",      position: "content", displayName: "§02 LOTTR trend" },
  { name: B.map,   index: 4, theme: "content_tint", position: "content", displayName: "§03 Map + LOTTR bins" },
  { name: B.corr,  index: 5, theme: "content",      position: "content", displayName: "§04 Worst corridors" },
  { name: B.split, index: 6, theme: "content",      position: "content", displayName: "§05 System split + truck" },
  { name: B.foot,  index: 7, theme: "footer",       position: "content", displayName: "Footer" },
];

const S = [];
const sec = (group, size, et, data, extra = {}) => S.push({ group, size, et, data, ...extra });

// ═════════ PAGE HEADER ═════════
sec(B.hdr, "8", "lexical", lexical(
  styled("kicker", text("// MAP-21 · PM3 · how predictable is travel")),
  styled("displayLG", text("RELIABILITY"), text(".", 0, GOLD)),
  styled("prose", text("The federal PM3 reliability measures for New York — how consistent travel times are, not how long they take. A road is reliable when its worst regular day (80th percentile) stays close to a typical day (50th percentile). These are the same numbers NYSDOT reports to FHWA under MAP-21.")),
));
sec(B.hdr, "4", "Card", dw({
  columns: [
    calc(`'data as of · PM3 ' || max("year_record")::text || ' · final' as asof`, "asof",
      { valueFontStyle: "chip", justify: "right" }),
    calc(`'source · HPMS travel-time metrics · 23 CFR 490' as src`, "src",
      { valueFontStyle: "metaXS", justify: "right" }),
  ],
  filters: [YEAR_LEAF_PLAIN()], display: { ...KPI_DISPLAY, cardBorder: false, cardsPadding: 0, cellsGridSize: 1 },
  fetchMode: "smart",
}));

// ═════════ TONE BAR · region + year + system controls ═════════
// Region control binds to ED region_name (real col → options auto-populate); shares searchParamKey "region"
sec(B.bar, "3", "Filter", JSON.stringify({
  externalSource: ED_SRC,
  columns: [{ name: "region_name", customName: "Region", type: "multiselect", show: true,
    filters: [{ type: "external", operation: "filter", values: [], isMulti: true, usePageFilters: true, searchParamKey: "region" }] }],
  filters: { op: "AND", groups: [] },
  display: { totalLength: 1, hideExternalToggle: true, showAttribution: false, filterStyle: "tone_bar", fetchMode: "smart" },
  data: [], join: { sources: {} },
}));
// Year control binds to view 3394 year_record
sec(B.bar, "3", "Filter", dw({
  columns: [{ name: "year_record", customName: "Year", type: "multiselect", show: true,
    filters: [{ type: "external", operation: "filter", values: ["2025"], isMulti: true, usePageFilters: true, searchParamKey: "year_record" }] }],
  filters: [],
  display: { totalLength: 1, hideExternalToggle: true, showAttribution: false, filterStyle: "tone_bar" },
  src: RSRC,
}));
// System control — binds to the real is_interstate boolean (Interstate = true /
// Non-Interstate = false; "All NHS" = nothing selected). Drives §03 + §04.
sec(B.bar, "3", "Filter", dw({
  columns: [{ name: "is_interstate", customName: "System", type: "multiselect", show: true,
    filters: [{ type: "external", operation: "filter", values: [], isMulti: true, usePageFilters: true, searchParamKey: "system" }] }],
  filters: [],
  display: { totalLength: 1, hideExternalToggle: true, showAttribution: false, filterStyle: "tone_bar" },
  src: RSRC,
}));
sec(B.bar, "3", "lexical", lexical(
  styled("metaXS", text("LOTTR threshold 1.50 · periods AM / Midday / PM / Weekend")),
));

// ═════════ § 01 · KPIs vs FEDERAL TARGETS ═════════
sec(B.kpi, "8", "lexical", lexical(
  compoundHeader(head("h2", "Three of three federal targets met."),
    styled("kicker", text("// 01   Compliance · 4-yr FHWA targets · Performance Period 2022–2025"))),
  styled("proseSM", text("FHWA counts a measure as making significant progress when it meets its target or beats its baseline. New York clears all three reliability measures on the target alone — Interstate and non-Interstate person-miles reliable, and truck travel-time reliability.")),
));
sec(B.kpi, "4", "lexical", lexical(
  para(button("full MAP-21 system performance →", "/map-21", "plain")),
), { padding: { top: "0" } });
sec(B.kpi, "4", "Card", kpiCard(2173919), { bg: "white", border: "full", height: "fill" });   // Interstate 79.8% ≥75%
sec(B.kpi, "4", "Card", kpiCard(2173920), { bg: "white", border: "full", height: "fill" });   // Non-Interstate 85.0% ≥70%
sec(B.kpi, "4", "Card", kpiCard(2173921), { bg: "white", border: "full", height: "fill" });   // Truck TTTR 1.42 ≤2.00

// ═════════ § 02 · LOTTR TREND (all years; reacts to region) ═════════
sec(B.trend, "12", "lexical", lexical(
  compoundHeader(styled("cardTitleSM", text("Person-miles reliable by year")),
    styled("kicker", text("// 02   2018–2024 · statewide · PM3 annual"))),
), { border: { top: true, left: true, right: true }, radius: { tl: true, tr: true }, padding: { bottom: "0" }, bg: "white" });
sec(B.trend, "12", "AVL Graph", dw({
  columns: [
    { name: "year_record", show: true, group: true, sort: "asc", target: "xAxis", customName: "year" },
    { name: `${RELIABLE_INT} as interstate`, type: "calculated", display_name: "interstate", normalName: "interstate", show: true, fn: "exempt", target: "yAxis", color: "#1F3F8F" },
    { name: `${RELIABLE_NONINT} as non_interstate`, type: "calculated", display_name: "non_interstate", normalName: "non_interstate", show: true, fn: "exempt", target: "yAxis", color: "#37576B" },
  ],
  filters: [REGION_LEAF()],   // all years; Region-scoped; targets in the caption (reference-line recipe is a P3 follow-up). No System leaf — both lines always shown.
  display: { graphType: "LineGraph", height: 300, totalLength: 12, bgColor: "#ffffff", textColor: "#0F1722",
    hideExternalToggle: true, margin: { top: 16, right: 24, bottom: 30, left: 44 },
    colors: { type: "palette", value: ["#1F3F8F", "#37576B", "#CA8A04", "#CA8A04"] },
    xAxis: { show: true, showGridLines: false, axisColor: "transparent", tickColor: "#94a3b8", tickFontSize: "10px", tickFontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
    yAxis: { show: true, showGridLines: true, format: "integer", tickSpacing: 5, domainMin: 65, domainMax: 100, tickColor: "#94a3b8", tickFontSize: "10px", tickFontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
    legend: { show: false }, tooltip: { show: true } },
}), { border: { left: true, right: true }, padding: { top: "0", bottom: "0" }, bg: "white" });
sec(B.trend, "12", "lexical", lexical(
  para(sq("#1F3F8F"), text(" Interstate · % person-miles reliable    "), sq("#37576B"), text(" Non-Interstate NHS    "), dash("#CA8A04"), text(" FHWA targets (≥75% / ≥70%)")),
  styled("proseSM", text("The 2020 spike is honest but misleading: with traffic volumes collapsed, almost everything ran reliably. Both systems eased back as volumes returned, but each has stayed clear of its 4-yr federal target every year since 2019. The margin, not the direction, is the story: New York is well above the floor on both.")),
), { border: { left: true, right: true, bottom: true }, radius: { bl: true, br: true }, padding: { top: "0" }, bg: "white" });

// ═════════ § 03 · RELIABILITY MAP (placeholder) + LOTTR BINS ═════════
sec(B.map, "8", "lexical", lexical(
  compoundHeader(styled("cardTitleSM", text("Where travel is unreliable")),
    styled("kicker", text("// 03   worst-period LOTTR by TMC · selected year"))),
  styled("proseSM", text("Per-segment reliability choropleth for the selected year — every monitored NHS segment colored by its worst-period LOTTR.")),
  styled("metaXS", text("[BACKFILL→Map · tile layer from view 3394 TMC geometry — pending tile-source decision, same as the congestion corridor map]")),
), { bg: "white", border: "full", height: "fill" });
// LOTTR bins as a single-row Card (conditional FILTER sums — no GROUP BY, since
// grouping by a calculated CASE column breaks the UDA fetch). Matches the design's
// stacked breakdown: 4 bins (miles · %) + a reliable-miles headline.
const TOT_MI = `sum("segment_length")`;
const binMi = (cond) => `sum("segment_length") filter (where ${cond})`;
const binCalc = (label, cond, key) => calc(
  `'${label}' || '  ·  ' || to_char(round((${binMi(cond)})::numeric, 0), 'FM999,999') || ' mi · ' || round((100.0 * (${binMi(cond)}) / nullif(${TOT_MI}, 0))::numeric, 0)::text || '%' as ${key}`,
  key, { valueFontStyle: "metaSM", cellSpan: 2, cellPaddingTop: 4 });
sec(B.map, "4", "Card", dw({
  columns: [
    groupCol("year_record"),
    calc(`'NHS miles by LOTTR bin · ' || max("year_record")::text as title`, "title", { valueFontStyle: "cardTitleSM", cellBorderBelow: true }),
    binCalc("under 1.25 · reliable", `${WORST_LOTTR} < 1.25`, "bin1"),
    binCalc("1.25–1.49 · reliable", `${WORST_LOTTR} >= 1.25 and ${WORST_LOTTR} < 1.5`, "bin2"),
    binCalc("1.50–1.99 · unreliable", `${WORST_LOTTR} >= 1.5 and ${WORST_LOTTR} < 2.0`, "bin3"),
    binCalc("2.00+ · unreliable", `${WORST_LOTTR} >= 2.0`, "bin4"),
    calc(`round((100.0 * (${binMi(`${WORST_LOTTR} < 1.5`)}) / nullif(${TOT_MI}, 0))::numeric, 0) as reliable_pct`, "reliable_pct",
      { valueFontStyle: "statXL", cellPaddingTop: 6, formatFn: "percent" }),
    calc(`'of NHS directional miles reliable · binned by worst period' as note`, "note", { valueFontStyle: "proseSM" }),
  ],
  filters: [YEAR_LEAF_PLAIN(), ...rsLeaves(),
    { col: "nhs", op: "filter", value: ["1", "2", "3", "4", "5", "6", "7", "8", "9"] }],
  display: { ...KPI_DISPLAY, cellsGridSize: 1, cardBorder: false, cardsPadding: 14 },
}), { bg: "white", border: "full", height: "fill" });

// ═════════ § 04 · WORST-RELIABILITY CORRIDORS ═════════
sec(B.corr, "12", "lexical", lexical(
  compoundHeader(styled("cardTitleSM", text("Least-reliable corridors")),
    styled("kicker", text("// 04   ranked by worst-period LOTTR · selected year"))),
), { border: { top: true, left: true, right: true }, radius: { tl: true, tr: true }, padding: { bottom: "0" }, bg: "white" });
sec(B.corr, "12", "Spreadsheet", dw({
  columns: [
    { name: "road", show: true, group: true, customName: "Corridor", justify: "left" },
    calc(`max("county_name") as county`, "county", { customName: "County", hideHeader: false, cellSpan: 1, justify: "left", formatFn: " " }),
    { name: `round((sum(${WORST_LOTTR} * "segment_length") / nullif(sum("segment_length"), 0))::numeric, 2) as worst_lottr`, type: "calculated", display_name: "worst_lottr", normalName: "worst_lottr",
      show: true, fn: "exempt", formatFn: " ", customName: "Worst LOTTR", justify: "right", sort: "desc", hideHeader: false, hideValue: false, cellSpan: 1 },
    calc(`round((sum(greatest("tttr_amp","tttr_midd","tttr_pmp","tttr_we","tttr_ovn") * "segment_length") / nullif(sum("segment_length"), 0))::numeric, 2) as tttr`, "tttr",
      { customName: "TTTR", hideHeader: false, cellSpan: 1, justify: "right", formatFn: " " }),
    calc(`round(sum("phed")::numeric, 0) as phed`, "phed", { customName: "PHED · p-hrs", hideHeader: false, cellSpan: 1, justify: "right", formatFn: " " }),
    calc(`round(max("dir_aadt")::numeric, 0) as aadt`, "aadt", { customName: "AADT", hideHeader: false, cellSpan: 1, justify: "right", formatFn: "comma" }),
    ...rsCols(),
  ],
  filters: [YEAR_LEAF_PLAIN(), ...rsLeaves(),
    { col: "road", op: "neq", value: [""] },
    { col: "f_system", op: "filter", value: ["1", "2", "3"] },   // major highways only (drops minor-road single-segment noise)
    { col: "nhs", op: "filter", value: ["1", "2", "3", "4", "5", "6", "7", "8", "9"] }],
  display: { usePagination: true, pageSize: 10, totalLength: 10 },
}), { border: { left: true, right: true, bottom: true }, radius: { bl: true, br: true }, bg: "white" });

// ═════════ § 05 · SYSTEM SPLIT + TRUCK TTTR ═════════
sec(B.split, "7", "Card", dw({
  columns: [
    groupCol("year_record"),
    calc(`'Interstate vs non-Interstate NHS · ' || max("year_record")::text as title`, "title", { valueFontStyle: "cardTitleSM", cellBorderBelow: true }),
    targetBar(RELIABLE_INT, 75, "int_rel", "Interstate · % person-miles reliable"),
    targetBar(RELIABLE_NONINT, 70, "nonint_rel", "Non-Interstate NHS · reliable"),
    calc(`'Interstate NHS-miles failing (worst LOTTR ≥ 1.50) · by period' as flbl`, "flbl",
      { valueFontStyle: "metaSM", cellPaddingTop: 8, cellBorderAbove: true }),
    periodFail("AM peak", `"lottr_amp"`, "f_am"),
    periodFail("Midday", `"lottr_midd"`, "f_midd"),
    periodFail("PM peak", `"lottr_pmp"`, "f_pmp"),
    periodFail("Weekend", `"lottr_we"`, "f_we"),
    calc(`'A segment fails the federal test if any one period is unreliable — the weekday PM peak does most of the damage.' as note`, "note", { valueFontStyle: "proseSM", cellPaddingTop: 6 }),
  ],
  filters: [YEAR_LEAF_PLAIN(), REGION_LEAF(),   // Region only — this card shows BOTH systems, so no System leaf
    { col: "nhs", op: "filter", value: ["1", "2", "3", "4", "5", "6", "7", "8", "9"] }],
  display: { ...KPI_DISPLAY, cellsGridSize: 1, cardBorder: false, cardsPadding: 14 },
}), { bg: "white", border: "full", height: "fill" });
sec(B.split, "5", "Card", dw({
  columns: [
    groupCol("year_record"),
    calc(`'truck travel-time reliability' as label`, "label", { valueFontStyle: "metaSM", cellSpan: 1 }),
    { name: `${TTTR_INT} as tttr`, type: "stat_value", display_name: "tttr", normalName: "tttr", show: true, fn: "exempt",
      formatFn: " ", justify: "left", hideHeader: true, hideValue: false, valueFontStyle: "statXL", cellSpan: 2 },
    calc(`'meets 4-yr target ≤ 2.00 · Interstate only' as note`, "note", { valueFontStyle: "proseSM", cellBorderBelow: true }),
    calc(`'Freight''s worst regular period runs ' || round((${TTTR_INT} - 1) * 100)::text || '% longer than a typical trip, length-weighted across the Interstate.' as desc`, "desc",
      { valueFontStyle: "proseSM", cellPaddingTop: 6 }),
    ...rsCols(),
  ],
  filters: [YEAR_LEAF_PLAIN(), REGION_LEAF(),   // Region only — truck TTTR is Interstate-only by definition
    { col: "nhs", op: "filter", value: ["1", "2", "3", "4", "5", "6", "7", "8", "9"] }],
  display: KPI_DISPLAY,
}), { bg: "white", border: "full", height: "fill" });

// ═════════ METHOD NOTE ═════════
sec(B.split, "12", "lexical", lexical(
  styled("kicker", text("// methodology")),
  styled("cardTitleSM", text("How reliability is measured")),
  styled("proseSM", text("LOTTR divides the 80th-percentile travel time by the 50th-percentile travel time for each TMC, computed separately for four periods: weekday AM (6–10a), Midday (10a–4p), PM (4–8p), and Weekend (6a–8p). A segment is reliable when every period stays below 1.50; person-miles weight each segment by AADT, average occupancy (1.7), and length. TTTR uses the 95th/50th truck ratio over five periods (adding Overnight, 8p–6a) and takes each segment's worst. Defined by MAP-21, codified at 23 CFR 490 Subparts E and F, computed from NPMRDS probe data. PM3 2024 is the final FHWA submission; 2025 will publish after the federal reporting cycle closes.")),
  para(button("full methodology & data coverage →", "/tsmo-methodology", "plain"), button("  how much delay · congestion →", "/congestion_v2", "plain")),
), { bg: "white", border: "full" });

// footer
sec(B.foot, "12", "lexical", lexical(
  para(button("congestion", "/congestion_v2", "plain"), button("incidents", "/incidents", "plain"), button("work-zones", "/work_zones", "plain"), button("methodology", "/tsmo-methodology", "plain"),
       text("        © NYSDOT · TransportNY DMS v0.2", 0, "color:#64748b;font-size:11px")),
));

// ── apply ────────────────────────────────────────────────────────────────────
const pageId = PAGE_ID;
const existing = jget(pageId).data.draft_sections || [];
for (const e of existing) { try { cli("section", "delete", String(e.id), "--page", String(pageId)); } catch (err) { console.log("  DELETE FAILED for", e.id, String(err).slice(0, 120)); } }
console.log("wiped", existing.length, "draft sections");

const gf = "scratchpad/npmrdsv5-dev2/reliability/tsmo_reliability_groups.json";
fs.writeFileSync(gf, JSON.stringify({
  draft_section_groups: groups,
  filters: [
    { id: "tsmo-rel-region", values: "", searchKey: "region", useSearchParams: true },
    { id: "tsmo-rel-year", values: "2025", searchKey: "year_record", useSearchParams: true },
    { id: "tsmo-rel-system", values: "", searchKey: "system", useSearchParams: true },
  ],
}));
cli("raw", "update", String(pageId), "--data", gf);
console.log("bands + page variables (region, year_record, system) registered");

let n = 0;
for (const s of S) {
  const payload = { size: s.size, group: s.group, title: "",
    element: { "element-data": s.data, "element-type": s.et }, "element-type": s.et };
  for (const k of ["border", "radius", "padding", "height", "bg"]) if (s[k] != null) payload[k] = s[k];
  cli("section", "create", String(pageId), "--pattern", PATTERN, "--data", JSON.stringify(payload));
  n++;
}
console.log(`created ${n} sections on ${SLUG} (page ${pageId})`);
