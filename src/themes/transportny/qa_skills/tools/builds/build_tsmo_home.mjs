// Build the TSMO HOME page (tsmo2 pattern 1431209, page 1431215) to match
// MIGRATED to qa_skills/tools/builds/ (2026-07-07, task qa-build-scripts-migration.md).
// Run from dms-template root. Wipe hardened: delete by PAGE ID with loud failures.
// dms_design_system_v2/pages/tsmo-home.html, against transportnyv2.
// Draft-only. Idempotent: WIPES existing draft sections, then rebuilds.
//
// Real dataWrapped sections everywhere data appears:
//   - ED v2 series  source 2039 / view 3488 (excessive_delay, npmrds2 pgEnv)
//   - Map 21 Extended source 2001 / view 3394 (PM3; LOTTR SQL reused verbatim
//     from MAP-21 KPI card 2173919)
//   - Transcom Events source 956 / view 1947
// Year control: Filter section writes page variable `year`; every full-year
// card/spark consumes it (map21 leaves use col year_record, bare key `year`).
// Bands: hero · §01 dashboards (content) · §02 explorers (content_tint) ·
// §03 freshness (content) · footer.
// Doorway cards are 4 fused sections per column (head lexical / stat Card /
// spark AVL Graph / prose lexical) — grid rows keep columns aligned.
// ⚠⚠ STALE — DO NOT RUN (2026-07-16). The published home (page 1431215) carries authored
// refinements (graph colors/backgrounds/padding/labels, card backgrounds) that were NEVER
// backported here. Running this script wipes the good drafts and regresses the page (it did,
// 2026-07-15 — restored from published via scratchpad/npmrdsv5-dev2/restore_home_draft.mjs).
// Backport the published configs into this script before it is ever run again.
throw new Error("build_tsmo_home.mjs is STALE vs the authored/published page — see header comment");

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";

import { mkdirSync as __mk } from "node:fs";
__mk("scratchpad/npmrdsv5-dev2", { recursive: true });

const ENV = { ...process.env, DMS_HOST: "http://localhost:3001", DMS_APP: "npmrdsv5", DMS_TYPE: "dev2" };
const CLI = "src/dms/packages/dms/cli/bin/dms.js";
const PAGE = "1431215", SLUG = "home", PATTERN = "tsmo2";
const cli = (...a) => execFileSync("node", [CLI, ...a], { env: ENV, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const clean = s => s.split("\n").filter(l => l.trim().startsWith("{")).pop();
const jget = id => JSON.parse(clean(cli("raw", "get", String(id))));

// ── lexical builders ─────────────────────────────────────────────────────────
const text = (t, format = 0, style = "") => ({ type: "text", version: 1, detail: 0, format, mode: "normal", style, text: t });
const dot  = c => text("●", 0, `color:${c};font-size:0.8em;vertical-align:middle`);
const para = (...children) => ({ type: "paragraph", version: 1, direction: "ltr", format: "", indent: 0, textFormat: 0, textStyle: "", children });
const styled = (styleKey, ...children) => ({ type: "styled-paragraph", version: 1, direction: "ltr", format: "", indent: 0, textFormat: 0, textStyle: "", styleKey, children });
const head = (tag, t) => ({ type: "heading", tag, version: 1, direction: "ltr", format: "", indent: 0, children: [text(t)] });
const hr = () => ({ type: "horizontalrule", version: 1 });
const button = (linkText, path, style = "default") => ({ type: "button", version: 1, linkText, path, style, keepSearchParams: false });
const layout = (templateColumns, columns) => ({ type: "layout-container", version: 1, templateColumns,
  children: columns.map(col => ({ type: "layout-item", version: 1, children: col })) });
const lexical = (...nodes) => JSON.stringify({ bgColor: "rgba(0,0,0,0)", isCard: "", showToolbar: false,
  text: { root: { type: "root", version: 1, direction: "ltr", format: "", indent: 0, children: nodes } } });
const GOLD = "color:#CA8A04", MUTE = "font-size:0.55em;color:#64748b", AMBER = "color:#B45309";

// ── data sources ─────────────────────────────────────────────────────────────
// Map21 externalSource: copied verbatim from the live MAP-21 KPI card (incl. schema).
const refED = JSON.parse(jget(2173919).data.element["element-data"]);
const MAP21_SRC = refED.externalSource;
const LOTTR_I_SQL = refED.columns[2].name;                       // …as lottr_interstate (verbatim)
const LOTTR_I_CORE = LOTTR_I_SQL.replace(/ as lottr_interstate\s*$/, "");
const LOTTR_N_CORE = LOTTR_I_CORE.replaceAll('"f_system" = 1', '"f_system" > 1');
const TTTR_CORE = `round((sum(case when "f_system" = 1 then greatest(coalesce("tttr_amp",0),coalesce("tttr_midd",0),coalesce("tttr_pmp",0),coalesce("tttr_we",0),coalesce("tttr_ovn",0)) * "segment_length" else 0 end) / nullif(sum(case when "f_system" = 1 then "segment_length" else 0 end), 0))::numeric, 2)`;

const ED_SRC = {
  name: "excessive_delay_v2_series", source_id: 2039, env: "npmrds2", srcEnv: "npmrds2",
  isDms: false, baseUrl: "/datasources", type: "excessive_delay",
  view_id: 3488, view_name: "v2 series (Dec 2024 → present)",
  columns: [
    { name: "tmc", type: "character varying" }, { name: "year", type: "smallint" },
    { name: "month", type: "smallint" }, { name: "total", type: "double precision" },
    { name: "non_recurrent", type: "double precision" }, { name: "construction", type: "double precision" },
    { name: "accident", type: "double precision" }, { name: "other", type: "double precision" },
    { name: "region_code", type: "character varying" }, { name: "county_code", type: "character varying" },
  ],
};
const TRANSCOM_SRC = {
  name: "Transcom Events", source_id: 956, env: "npmrds2", srcEnv: "npmrds2",
  isDms: false, baseUrl: "/datasources", type: "transcom",
  view_id: 1947, view_name: "Transcom Events Production",
  columns: [
    { name: "event_id", type: "text" }, { name: "year", type: "smallint" },
    { name: "month", type: "smallint" }, { name: "state", type: "text" },
    { name: "start_date_time", type: "timestamp with time zone" },
    { name: "nysdot_general_category", type: "text" }, { name: "facility", type: "text" },
  ],
};

// ── dataWrapper payload helpers ──────────────────────────────────────────────
const YEAR_LEAF = (col) => ({ col, op: "filter", value: ["2025"], usePageFilters: true, searchParamKey: "year" });
const dw = ({ src, columns, filters = [], display = {} }) => JSON.stringify({
  externalSource: src,
  columns,
  filters: { op: "AND", groups: filters },
  display: { usePagination: false, preventDuplicateFetch: true, readyToLoad: true,
             showAttribution: false, striped: false, autoResize: false, hideSection: false, ...display },
  data: [], join: { sources: {} },
});
const KPI_DISPLAY = { pageSize: 1, totalLength: 1, headerValueLayout: "col", reverse: false,
  cellsGridSize: 1, cellsGridGap: 6, cardsGridSize: 1, cardsGridGap: 0,
  cardBorder: true, cellBorder: false, cardsPadding: 20 };
const STAT_DISPLAY = { pageSize: 1, totalLength: 1, headerValueLayout: "col", reverse: false,
  cellsGridSize: 1, cellsGridGap: 2, cardsGridSize: 1, cardsGridGap: 0,
  cardBorder: false, cellBorder: false, cardsPadding: 0 };
const SPARK_DISPLAY = (extra = {}) => ({ graphType: "BarGraph", height: 96, totalLength: 13,
  bgColor: "#ffffff", textColor: "#0F1722", hideExternalToggle: true,
  title: { title: "", position: "start", fontSize: 12, fontWeight: "normal" }, description: "",
  xAxis: { show: false, showGridLines: false }, yAxis: { show: false, showGridLines: false },
  legend: { show: false }, tooltip: { show: true, showTotal: false }, ...extra });

const groupCol = (name) => ({ name, type: "INTEGER", show: true, group: true, sort: "desc",
  hideHeader: true, hideValue: true, justify: "left", customName: name, valueFontStyle: "metaSM" });
const calc = (sql, alias, over = {}) => ({ name: sql, type: "calculated", display_name: alias,
  normalName: alias, show: true, fn: "exempt", formatFn: " ", justify: "left",
  hideHeader: true, hideValue: false, ...over });

// ── bands ────────────────────────────────────────────────────────────────────
const B = { hero: randomUUID(), dash: randomUUID(), expl: randomUUID(), fresh: randomUUID(), foot: randomUUID() };
const groups = [
  { name: B.hero,  index: 0, theme: "hero",         position: "content", displayName: "Hero" },
  { name: B.dash,  index: 1, theme: "content",      position: "content", displayName: "§01 The dashboards" },
  { name: B.expl,  index: 2, theme: "content_tint", position: "content", displayName: "§02 Explorers" },
  { name: B.fresh, index: 3, theme: "content",      position: "content", displayName: "§03 Data freshness" },
  { name: B.foot,  index: 4, theme: "footer",       position: "content", displayName: "Footer" },
];

// fused doorway chrome (top / middle / bottom of one visual card)
const TOP    = { border: { top: true, left: true, right: true }, radius: { tl: true, tr: true }, padding: { bottom: "0" } };
const MID    = { border: { left: true, right: true }, padding: { top: "0", bottom: "0" } };
const BOTTOM = { border: { left: true, right: true, bottom: true }, radius: { bl: true, br: true }, padding: { top: "0" } };

// ── section inventory ────────────────────────────────────────────────────────
const S = [];
const lex = (group, size, data, extra = {}) => S.push({ group, size, et: "lexical", data, ...extra });
const card = (group, size, data, extra = {}) => S.push({ group, size, et: "Card", data, ...extra });
const filt = (group, size, data, extra = {}) => S.push({ group, size, et: "Filter", data, ...extra });
const graph = (group, size, data, extra = {}) => S.push({ group, size, et: "AVL Graph", data, ...extra });

// ═════════ HERO ═════════
lex(B.hero, "12", lexical(
  styled("kicker", text("// nysdot · transportation systems management & operations")),
  styled("displayHero", text("TSMO at NYSDOT"), text(".", 0, GOLD)),
  styled("prose", text("TSMO is how New York gets more out of the roads it already owns — clearing incidents faster, managing work zones smarter, and measuring all of it. These dashboards turn 14 billion speed records and a decade of event data into the statewide operations picture. ")),
  para(button("What is TSMO? →", "#", "plain")),
));
// year control + helper note
filt(B.hero, "4", dw({
  src: ED_SRC, columns: [],
  filters: [{ col: "year", op: "filter", value: ["2025"], isExternal: true, usePageFilters: true, searchParamKey: "year" }],
  display: { totalLength: 1, placement: "inline", gridSize: 2, hideExternalToggle: true, showAttribution: true, filterStyle: "chip" },
}));
lex(B.hero, "8", lexical(
  styled("metaSM", text("full-year view — 2025 is the latest complete year · v2 series begins Dec 2024 · figures are NOT comparable to pre-2025 published numbers (methodology v2)")),
));
// KPI 1 · excessive delay (ED v2)
card(B.hero, "4", dw({
  src: ED_SRC,
  columns: [
    groupCol("year"),
    calc(`round((sum(total) / 1000000.0)::numeric, 1) as total_mvh`, "total_mvh",
      { customName: "Excessive delay · M veh-hrs", hideHeader: false, valueFontStyle: "statXL", headerFontStyle: "metaSM" }),
    calc(`'time lost below speed-limit-based thresholds · all NY roads with probe data' as note`, "note",
      { valueFontStyle: "proseSM" }),
    calc(`round((100.0 * sum(non_recurrent) / nullif(sum(total), 0))::numeric, 0)::text || '% non-recurrent — incidents, work zones, weather' as nonrec_note`, "nonrec_note",
      { valueFontStyle: "metaSM" }),
  ],
  filters: [YEAR_LEAF("year")],
  display: KPI_DISPLAY,
}), { height: "fill" });
// KPI 2 · cost (ED v2)
card(B.hero, "4", dw({
  src: ED_SRC,
  columns: [
    groupCol("year"),
    calc(`round((sum(total) * 20 / 1000000000.0)::numeric, 1) as cost_b`, "cost_b",
      { customName: "Cost of congestion · $ billions", hideHeader: false, valueFontStyle: "statXL", headerFontStyle: "metaSM" }),
    calc(`round((sum(total) / 1000000.0)::numeric, 1)::text || 'M vehicle-hours × $20 FHWA value of time per veh-hr' as note`, "note",
      { valueFontStyle: "proseSM" }),
  ],
  filters: [YEAR_LEAF("year")],
  display: KPI_DISPLAY,
}), { height: "fill" });
// KPI 3 · PM3 reliable person-miles (Map 21 Extended)
card(B.hero, "4", dw({
  src: MAP21_SRC,
  columns: [
    { ...groupCol("year_record"), name: "year_record" },
    { name: LOTTR_I_SQL, type: "calculated", display_name: "lottr_interstate", normalName: "lottr_interstate",
      show: true, fn: "exempt", formatFn: "percent", justify: "left", hideHeader: false,
      customName: "Reliable person-miles · interstate", valueFontStyle: "statXL", headerFontStyle: "metaSM" },
    calc(`'interstate person-miles on reliable segments · PM3 LOTTR < 1.5' as note`, "note",
      { valueFontStyle: "proseSM" }),
    calc(`'non-interstate ' || (${LOTTR_N_CORE})::text || '% · truck travel time index (TTTR) ' || (${TTTR_CORE})::text as pm3_sub`, "pm3_sub",
      { valueFontStyle: "metaSM" }),
  ],
  filters: [YEAR_LEAF("year_record")],
  display: KPI_DISPLAY,
}), { height: "fill" });

// ═════════ §01 THE DASHBOARDS ═════════
lex(B.dash, "12", lexical(
  styled("kicker", text("// 01   4 dashboards · region + period selectors on every page")),
  head("h2", "The dashboards."),
));
// Row 1 — doorway heads
const doorHead = (kicker, asof, title) => lexical(
  styled("kicker", text(kicker), text(`   ${asof}`, 0, "color:#94a3b8;letter-spacing:0.08em")),
  styled("cardTitle", text(title)),
);
lex(B.dash, "3", doorHead("congestion", "thru 2026-04", "Delay & its causes"), { ...TOP, height: "fill" });
lex(B.dash, "3", doorHead("reliability", "pm3 · annual", "How predictable is travel"), { ...TOP, height: "fill" });
lex(B.dash, "3", doorHead("incidents", "live", "The event landscape"), { ...TOP, height: "fill" });
lex(B.dash, "3", doorHead("work zones", "thru 2026-04", "What construction costs"), { ...TOP, height: "fill" });
// Row 2 — doorway stats (real cards)
card(B.dash, "3", dw({
  src: ED_SRC,
  columns: [groupCol("year"),
    calc(`round((sum(total) / 1000000.0)::numeric, 1) as v`, "v", { valueFontStyle: "statLG" }),
    calc(`'M veh-hrs · selected year' as u`, "u", { valueFontStyle: "metaSM" })],
  filters: [YEAR_LEAF("year")], display: STAT_DISPLAY,
}), { ...MID, height: "fill" });
card(B.dash, "3", dw({
  src: MAP21_SRC,
  columns: [{ ...groupCol("year_record"), name: "year_record" },
    { name: LOTTR_I_SQL, type: "calculated", display_name: "lottr_interstate", normalName: "lottr_interstate",
      show: true, fn: "exempt", formatFn: "percent", justify: "left", hideHeader: true, valueFontStyle: "statLG" },
    calc(`'reliable · interstate · selected year' as u`, "u", { valueFontStyle: "metaSM" })],
  filters: [YEAR_LEAF("year_record")], display: STAT_DISPLAY,
}), { ...MID, height: "fill" });
card(B.dash, "3", dw({
  src: TRANSCOM_SRC,
  columns: [groupCol("year"),
    calc(`round((count(1) / 1000.0)::numeric, 0) as v`, "v", { valueFontStyle: "statLG" }),
    calc(`'K events · NY · selected year' as u`, "u", { valueFontStyle: "metaSM" })],
  filters: [{ col: "state", op: "filter", value: ["NY"] }, YEAR_LEAF("year")], display: STAT_DISPLAY,
}), { ...MID, height: "fill" });
card(B.dash, "3", dw({
  src: ED_SRC,
  columns: [groupCol("year"),
    calc(`round((sum(construction) / 1000000.0)::numeric, 1) as v`, "v", { valueFontStyle: "statLG" }),
    calc(`'M veh-hrs construction · selected year' as u`, "u", { valueFontStyle: "metaSM" })],
  filters: [YEAR_LEAF("year")], display: STAT_DISPLAY,
}), { ...MID, height: "fill" });
// Row 3 — sparks (real monthly/annual series)
graph(B.dash, "3", dw({
  src: ED_SRC,
  columns: [
    { name: "month", show: true, group: true, sort: "asc", target: "xAxis" },
    calc(`round((sum(total) / 1000000.0)::numeric, 2) as mvh`, "mvh", { target: "yAxis", color: "#1F3F8F" }),
  ],
  filters: [YEAR_LEAF("year")],
  display: SPARK_DISPLAY(),
}), { ...MID, height: "fill" });
graph(B.dash, "3", dw({
  src: MAP21_SRC,
  columns: [
    { name: "year_record", show: true, group: true, sort: "asc", target: "xAxis" },
    { name: LOTTR_I_SQL, type: "calculated", display_name: "lottr_interstate", normalName: "lottr_interstate",
      show: true, fn: "exempt", target: "yAxis", color: "#1F3F8F" },
  ],
  filters: [],                                   // trend: all submission years, ignores the year control
  display: SPARK_DISPLAY({ yAxis: { show: false, showGridLines: false, domainMin: 60, domainMax: 100 } }),
}), { ...MID, height: "fill" });
graph(B.dash, "3", dw({
  src: TRANSCOM_SRC,
  columns: [
    { name: "month", show: true, group: true, sort: "asc", target: "xAxis" },
    calc(`count(1) as n`, "n", { target: "yAxis", color: "#1F3F8F" }),
  ],
  filters: [{ col: "state", op: "filter", value: ["NY"] }, YEAR_LEAF("year")],
  display: SPARK_DISPLAY(),
}), { ...MID, height: "fill" });
graph(B.dash, "3", dw({
  src: ED_SRC,
  columns: [
    { name: "month", show: true, group: true, sort: "asc", target: "xAxis" },
    calc(`round((sum(construction) / 1000000.0)::numeric, 2) as mvh`, "mvh", { target: "yAxis", color: "#E5A646" }),
  ],
  filters: [YEAR_LEAF("year")],
  display: SPARK_DISPLAY(),
}), { ...MID, height: "fill" });
// Row 4 — doorway prose + links
const doorFoot = (prose, linkText, path) => lexical(
  styled("proseSM", text(prose)),
  para(button(linkText, path, "plain")),
);
lex(B.dash, "3", doorFoot("Where, when, and why delay happens — recurrent vs incident-driven, by region and corridor, in vehicle-hours and dollars.", "open congestion →", "/congestion"), { ...BOTTOM, height: "fill" });
lex(B.dash, "3", doorFoot("The federal PM3 story — LOTTR person-mile reliability, the truck TTTR index, and peak-hour excessive delay vs targets.", "open reliability →", "#"), { ...BOTTOM, height: "fill" });
lex(B.dash, "3", doorFoot("Every TRANSCOM crash, hazard, and closure — categories, durations, attributed delay, and an honest TIM-coverage panel.", "open incidents →", "/incidents"), { ...BOTTOM, height: "fill" });
lex(B.dash, "3", doorFoot("Construction is our single largest attributed-delay category — tracked by month, corridor, and region, planned vs emergency.", "open work zones →", "/work_zones"), { ...BOTTOM, height: "fill" });

// ═════════ §02 EXPLORERS ═════════
lex(B.expl, "12", lexical(
  styled("kicker", text("// 02")),
  head("h2", "Dig into a single event or corridor."),
));
lex(B.expl, "6", lexical(
  styled("kicker", text("explorer"), text("   · 3.7M events · 2014 → present", 0, "color:#94a3b8")),
  styled("cardTitle", text("Incident Search")),
  styled("proseSM", text("Find any event by region, county, date range, category, facility, or keyword — then open its detail page: response timeline, congestion footprint, and the 5-minute speed grid around it.")),
  para(button("search events →", "/incidents", "plain")),
), { border: "full", height: "fill" });
lex(B.expl, "6", lexical(
  styled("kicker", text("explorer"), text("   · 52,157 TMCs · 5-min resolution", 0, "color:#94a3b8")),
  styled("cardTitle", text("Corridor View")),
  styled("proseSM", text("Replay any corridor on any day — a time-space grid of speeds and delay along the road, with incident and construction overlays, keyed to a strip map. Compare dates side by side.")),
  para(button("open a corridor →", "#", "plain")),
), { border: "full", height: "fill" });

// ═════════ §03 DATA FRESHNESS ═════════
lex(B.fresh, "12", lexical(
  styled("kicker", text("// 03   every panel on every page carries its own as-of badge")),
  head("h2", "How fresh is this data."),
));
card(B.fresh, "4", dw({
  src: TRANSCOM_SRC,
  columns: [
    calc(`'TRANSCOM events — latest: ' || to_char(max(start_date_time), 'YYYY-MM-DD') as latest`, "latest",
      { customName: "TRANSCOM events", hideHeader: false, valueFontStyle: "cardTitleSM", headerFontStyle: "metaSM" }),
    calc(`'Incidents, work zones & closures update continuously, NY-filtered from the multi-state feed.' as note`, "note",
      { valueFontStyle: "proseSM" }),
  ],
  filters: [], display: KPI_DISPLAY,
}), { height: "fill" });
lex(B.fresh, "4", lexical(
  styled("metaSM", text("NPMRDS speeds")),
  styled("cardTitleSM", text("Through 2026-05-31")),
  styled("proseSM", text("Probe speeds arrive on a ~2-week lag; corridor grids and bottleneck ranks follow.")),
  styled("metaXS", text("[BACKFILL→Card · CH-backed npmrds source via UDA]")),
), { border: "full", height: "fill" });
card(B.fresh, "4", dw({
  src: ED_SRC,
  columns: [
    calc(`to_char(to_date(min(year * 100 + month)::text, 'YYYYMM'), 'Mon YYYY') || ' → ' || to_char(to_date(max(year * 100 + month)::text, 'YYYYMM'), 'Mon YYYY') as span`, "span",
      { customName: "Delay attribution · v2 series", hideHeader: false, valueFontStyle: "cardTitleSM", headerFontStyle: "metaSM" }),
    calc(`'Methodology-v2 series, extending monthly (backfill to 2017 in progress); federal reliability measures are annual.' as note`, "note",
      { valueFontStyle: "proseSM" }),
  ],
  filters: [], display: KPI_DISPLAY,
}), { height: "fill" });
// data spine strip — real counts where a query backs them
card(B.fresh, "4", dw({
  src: ED_SRC,
  columns: [groupCol("year"),
    calc(`to_char(count(distinct tmc), 'FM999,999') || ' TMC road segments · selected year' as spine`, "spine",
      { valueFontStyle: "metaMD" })],
  filters: [YEAR_LEAF("year")], display: STAT_DISPLAY,
}), { border: { top: true, left: true, bottom: true }, radius: { tl: true, bl: true }, padding: { right: "0" }, height: "fill" });
card(B.fresh, "4", dw({
  src: TRANSCOM_SRC,
  columns: [
    calc(`to_char(count(1), 'FM9,999,999') || ' events · 2014 → present' as spine`, "spine",
      { valueFontStyle: "metaMD" })],
  filters: [], display: STAT_DISPLAY,
}), { border: { top: true, bottom: true }, padding: { left: "0", right: "0" }, height: "fill" });
lex(B.fresh, "4", lexical(
  para(dot("#37576B"), text(" 14.0B 5-min speed records · 2017 → May 2026    "), dot("#E5A646"), text(" 11 NYSDOT regions")),
), { border: { top: true, right: true, bottom: true }, radius: { tr: true, br: true }, padding: { left: "0" }, height: "fill" });

// ═════════ FOOTER ═════════
lex(B.foot, "12", lexical(
  layout("w-full !mt-0 items-center grid-cols-1 gap-1 md:gap-0 md:grid-cols-[max-content_1fr_max-content]", [
    [para(
      button("congestion", "/congestion", "plain"), button("incidents", "/incidents", "plain"),
      button("work-zones", "/work_zones", "plain"),
    )],
    [para(text(""))],
    [para(styled("metaXS", text("© NYSDOT · TransportNY DMS v0.2")))],
  ]),
));

// ── apply ────────────────────────────────────────────────────────────────────
// 0) wipe existing draft sections
const existing = jget(PAGE).data.draft_sections || [];
for (const e of existing) { try { cli("section", "delete", String(e.id), "--page", String(PAGE)); } catch (err) { console.log("  delete failed for", e.id, String(err).slice(0, 120)); } }
console.log("wiped", existing.length, "existing draft sections");

// 1) bands + page-variable registry (year)
const gf = "scratchpad/npmrdsv5-dev2/tsmo_home_groups.json";
fs.writeFileSync(gf, JSON.stringify({
  draft_section_groups: groups,
  filters: [{ id: "tsmo-year", values: "2025", searchKey: "year", useSearchParams: true }],
}));
cli("raw", "update", PAGE, "--data", gf);
console.log("bands:", groups.map(g => g.index + ":" + g.displayName).join(" · "), "| page filters registered: year");

// 2) create sections in order
let n = 0;
for (const s of S) {
  const payload = { size: s.size, group: s.group, title: "",
    element: { "element-data": s.data, "element-type": s.et }, "element-type": s.et };
  for (const k of ["border", "radius", "padding", "height", "bg"]) if (s[k] != null) payload[k] = s[k];
  cli("section", "create", PAGE, "--pattern", PATTERN, "--data", JSON.stringify(payload));
  n++;
}
console.log(`created ${n} sections; page now has`, jget(PAGE).data.draft_sections.length, "draft sections");
