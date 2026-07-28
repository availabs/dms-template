// Control Room — OVERVIEW = client-facing QA process board (ports sitemgmt-overview.html).
// MIGRATED to qa_skills/tools/builds/ (2026-07-07, task qa-build-scripts-migration.md).
// Run from dms-template root. Wipe hardened: delete by PAGE ID with loud failures.
// DATA-DRIVEN: reads the tracked patterns from the `sitemgmt_patterns` internal dataset and renders
// ONE compound card per pattern (a lexical identity header fused to a Spreadsheet of that pattern's
// pages via coordinated section border/radius/padding — the TSMO compound-section technique).
// Header → "How delivery works" 4-stage strip → "For your review" framing → per-pattern cards.
// Targets the existing `overview` page (2184939). Idempotent, draft-only. PAGE_ID env overrides.
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createFalcorClient } from "../../../../../dms/packages/dms/cli/src/client.js";

const TOKEN = process.env.DMS_AUTH_TOKEN; if (!TOKEN) { console.error("set DMS_AUTH_TOKEN"); process.exit(1); }
const APP = process.env.APP || "npmrdsv5", HOST = process.env.DMS_HOST || "http://localhost:3001";
const ENV = { ...process.env, DMS_HOST: HOST, DMS_APP: APP, DMS_TYPE: process.env.DMS_TYPE || "dev2" };
const CLI = "src/dms/packages/dms/cli/bin/dms.js";
const PATTERN = "sitemgmt", SLUG = "overview";
const cli = (...a) => execFileSync("node", [CLI, ...a], { env: ENV, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const clean = (s) => s.split("\n").filter((l) => l.trim().startsWith("{") || l.trim().startsWith("[")).pop();
const jget = (id) => JSON.parse(clean(cli("raw", "get", String(id))));
const fc = createFalcorClient(HOST, TOKEN);
const unwrap = (v) => (v && typeof v === "object" && "$type" in v ? v.value : v);

// resolve a source's view_id from its instance name
function resolveView(instance) {
  const list = JSON.parse(clean(cli("dataset", "list")));
  const item = (list.items || []).find((s) => s.data?.instance === instance);
  if (!item?.id) throw new Error(`source '${instance}' not found`);
  return { source_id: +item.id, view_id: +jget(item.id).data.views[0].id, env: `${APP}+${instance}` };
}
async function readRows(env, viewId, cols) {
  const attrs = cols.map((c) => (c === "id" ? "id" : `data->>'${c}' as ${c}`));
  await fc.get(["uda", env, "viewsById", viewId, "options", "{}", "length"]);
  let c = fc.getCache(); const len = unwrap(c?.uda?.[env]?.viewsById?.[viewId]?.options?.["{}"]?.length) || 0;
  if (!len) return [];
  await fc.get(["uda", env, "viewsById", viewId, "options", "{}", "dataByIndex", { from: 0, to: len - 1 }, attrs]);
  c = fc.getCache(); const bi = c?.uda?.[env]?.viewsById?.[viewId]?.options?.["{}"]?.dataByIndex || {};
  const out = []; for (let i = 0; i < len; i++) { const n = bi[i]; if (!n) continue; const r = {}; cols.forEach((cn, j) => r[cn] = unwrap(n[attrs[j]])); out.push(r); } return out;
}

const PAGES = resolveView("sitemgmt_pages"), PATS = resolveView("sitemgmt_patterns");
const PAGES_SRC = { isDms: true, app: APP, type: "sitemgmt_pages", name: "Site Management — Pages",
  source_id: PAGES.source_id, view_id: PAGES.view_id, env: PAGES.env, srcEnv: PAGES.env, baseUrl: "/forms",
  columns: ["page_key","surface","surface_label","name","route","url","build","stage","stage_order","next_step","open_bugs","owner"].map(n => ({ name: n, display_name: n, type: "text" })) };

// ── read the data the board is built from ──
const trackedAll = await readRows(PATS.env, PATS.view_id, ["pattern", "surface", "surface_label", "sort_order", "enabled"]);
const tracked = trackedAll.filter((t) => t.enabled === "yes").sort((a, b) => (+a.sort_order || 0) - (+b.sort_order || 0));
const pages = await readRows(PAGES.env, PAGES.view_id, ["surface", "stage"]);
const TICK = resolveView("sitemgmt_tickets");
const tickets = await readRows(TICK.env, TICK.view_id, ["page_key", "status"]);
// tickets as a section data source (the per-pattern tickets bars) — `surface` is the cr_sync
// denormalized page_key prefix (filter ops are exact-match; LIKE on page_key isn't available)
const TICK_SRC = { isDms: true, app: APP, type: "sitemgmt_tickets", name: "Site Management — Tickets",
  source_id: TICK.source_id, view_id: TICK.view_id, env: TICK.env, srcEnv: TICK.env, baseUrl: "/forms",
  columns: ["ticket_id", "page_key", "surface", "status", "severity"].map(n => ({ name: n, display_name: n, type: "text" })) };
const STAGES = ["Proposed", "Design", "Implemented", "QA", "Dev Acceptance", "Client Acceptance"];
const OPEN = new Set(["Triage", "In progress", "In review", "Needs decision", "Needs data"]);
// build-time tallies now feed ONLY the header stat line (the tiles + pattern-card numbers/bars
// are live aggregate Cards — they track the datasets without a rebuild)
const stageCount = Object.fromEntries(STAGES.map((s) => [s, pages.filter((p) => p.stage === s).length]));
console.log(`tracked patterns: ${tracked.map((t) => t.pattern).join(", ")} | ${pages.length} pages | ${tickets.length} tickets | stages ${JSON.stringify(stageCount)}`);

// ── lexical + section helpers ──
const text = (t, format = 0, style = "") => ({ type: "text", version: 1, detail: 0, format, mode: "normal", style, text: t });
const styled = (styleKey, ...children) => ({ type: "styled-paragraph", version: 1, direction: "ltr", format: "", indent: 0, textFormat: 0, textStyle: "", styleKey, children });
const lexical = (...nodes) => JSON.stringify({ bgColor: "rgba(0,0,0,0)", isCard: "", showToolbar: false, text: { root: { type: "root", version: 1, direction: "ltr", format: "", indent: 0, children: nodes } } });
const GOLD = "color:#CA8A04";
const STAGE_PILL = { "Proposed": "zinc", "Design": "slate", "Implemented": "amber", "QA": "blue", "Dev Acceptance": "ink", "Client Acceptance": "green" };
const STAGE_WHO = { "Proposed": "we scope the user stories", "Design": "we design the page", "Implemented": "our team builds it", "QA": "we test + fix", "Dev Acceptance": "our team signs off", "Client Acceptance": "you review + approve" };
const STAGE_HEX = { "Proposed": "#a1a1aa", "Design": "#8b5cf6", "Implemented": "#f59e0b", "QA": "#38bdf8", "Dev Acceptance": "#14b8a6", "Client Acceptance": "#10b981" };
const STAGE_SHORT = { "Proposed": "proposed", "Design": "design", "Implemented": "impl", "QA": "qa", "Dev Acceptance": "dev", "Client Acceptance": "client" };
// (build-time pct/seg/barPara span-bar helpers removed 2026-07-08 -- bars are live
// `stacked_bar` Card cells now; see cr-overview-live-cards.md)

const dw = (src, { columns, filters = [], display = {} }) => JSON.stringify({
  externalSource: src, columns, filters: { op: "AND", groups: filters },
  display: { usePagination: true, pageSize: 50, readyToLoad: true, fetchMode: "smart", showAttribution: false, striped: false, ...display },
  data: [], join: { sources: {} } });
const col = (name, label, over = {}) => ({ name, customName: label, show: true, justify: "left", ...over });
const pcol = (name, label, map, over = {}) => ({ name, customName: label, type: "status_pill", pillColors: map, show: true, justify: "left", ...over });
// LIVE numbers/bars (2026-07-08, cr-overview-live-cards): counts + distribution bars are one-row
// aggregate Cards — `count(*) filter (…)` calculated columns (fn:"exempt", the tickets-page
// idiom) — so they track the datasets without a rebuild. Bars render via the core `stacked_bar`
// columnType reading sibling selectOnly seg columns; legends are the breakdown lines.
const calcCol = (sql, alias, over = {}) => ({ name: sql, type: "calculated", display_name: alias, normalName: alias,
  show: true, fn: "exempt", formatFn: " ", justify: "left", hideHeader: true, ...over });
const statCol = (name, txt, over = {}) => ({ name, origin: "static", staticValue: txt, show: true, hideHeader: true, ...over });
const AGG = { usePagination: false, pageSize: 1, fetchMode: "smart", cardBorder: false,
  cellsGridSize: 1, cellsGridGap: 0, cellsRowGap: 2, cellsPadding: 0, cardsPadding: 14 };
const stageCountSql = (st) => `(count(*) filter (where (data->>'stage') = '${st}'))::text`;
const segAlias = (st) => `seg_${STAGE_SHORT[st]}`;

const B = { crumb: randomUUID(), hdr: randomUUID(), how: randomUUID() };
const groups = [
  { name: B.crumb, index: 0, theme: "breadcrumb", position: "content", displayName: "Breadcrumb" },
  { name: B.hdr,   index: 1, theme: "header",  position: "content", displayName: "Header" },
  { name: B.how,   index: 2, theme: "content", position: "content", displayName: "How delivery works" },
];
const S = [];
const sec = (group, size, et, data, extra = {}) => S.push({ group, size, et, data, ...extra });

// ── breadcrumb bar (theme "breadcrumb" = slim full-width white band) ──
sec(B.crumb, "12", "lexical", lexical(
  styled("metaXS", text("Site Management     /     Control Room")),
));

// ── header — uppercase title + summary stat line (mirrors the mockup header band) ──
const openT = tickets.filter((t) => OPEN.has(t.status)).length, doneT = tickets.length - openT;
const accepted = stageCount["Client Acceptance"] || 0;
sec(B.hdr, "9", "lexical", lexical(
  styled("kicker", text("// site management · QA workflow")),
  styled("displayLG", text("CONTROL ROOM"), text(".", 0, GOLD)),
  styled("metaSM", text(`${tracked.length} patterns · ${pages.length} pages · ${accepted} accepted · ${openT} open / ${doneT} done tickets`)),
));

// ── How delivery works — 6 stage tiles, LIVE: each is a one-row aggregate Card (the count is a
// `count(*) filter (where stage=…)` calc; label/who-line are static chrome cells). A 0 count
// renders as "0" (the Card zero-blank bug was fixed 2026-07-06 — the old lexical bake-around).
sec(B.how, "12", "lexical", lexical(styled("kicker", text("// how delivery works — AI flags issues · we fix & sign off · you approve"))));
for (const st of STAGES) sec(B.how, "2", "Card", dw(PAGES_SRC, {
  columns: [
    calcCol(`${stageCountSql(st)} as n_stage`, "n_stage", { valueFontStyle: "statXL" }),
    statCol("lbl", st, { valueFontStyle: "metaSM" }),
    statCol("who", STAGE_WHO[st], { valueFontStyle: "metaXS" }),
  ],
  display: AGG,
}), { bg: "white", border: "full", height: "fill" });

// ── one COMPOUND card per tracked pattern: LIVE identity header (title + page count + stage
// distribution bar + tickets bar, all one-row aggregate Cards) fused to its pages Spreadsheet.
// The stacked_bar cells read sibling selectOnly `count(*) filter` seg columns; their legends
// are the breakdown lines (zeros included, so categories read stably).
for (const t of tracked) {
  const g = randomUUID();
  groups.push({ name: g, index: groups.length, theme: "content", position: "content", displayName: t.surface_label });
  const surfFilter = { col: "surface", op: "filter", value: [t.surface] };
  // slice 1 — identity: static title + live "pattern · N pages" meta line
  sec(g, "12", "Card", dw(PAGES_SRC, {
    columns: [
      statCol("ttl", t.surface_label, { valueFontStyle: "displaySM" }),
      calcCol(`('${t.pattern} · ' || count(*) || ' page' || (case when count(*) = 1 then '' else 's' end)) as meta`, "meta", { valueFontStyle: "metaXS" }),
    ],
    filters: [surfFilter],
    display: AGG,
  }), { bg: "white", border: { top: true, left: true, right: true }, radius: { tl: true, tr: true }, padding: { bottom: "0" } });
  // slice 2 — stage distribution bar + breakdown legend (live)
  sec(g, "12", "Card", dw(PAGES_SRC, {
    columns: [
      ...STAGES.map((st) => calcCol(`${stageCountSql(st)} as ${segAlias(st)}`, segAlias(st), { selectOnly: true })),
      calcCol(`count(*)::text as bar_total`, "bar_total", {
        type: "stacked_bar",
        segments: STAGES.map((st) => ({ col: segAlias(st), label: STAGE_SHORT[st], color: STAGE_HEX[st] })),
      }),
    ],
    filters: [surfFilter],
    display: AGG,
  }), { bg: "white", border: { left: true, right: true }, padding: { top: "0", bottom: "0" } });
  // slice 3 — tickets open/done bar (live; `surface` = cr_sync denorm). Done-first keeps the
  // mockup's green-left bar; the legend follows segment order ("N done · N open").
  sec(g, "12", "Card", dw(TICK_SRC, {
    columns: [
      calcCol(`(count(*) filter (where (data->>'status') not in ('Triage','In progress','In review','Needs decision','Needs data') and (data->>'status') is not null))::text as seg_done`, "seg_done", { selectOnly: true }),
      calcCol(`(count(*) filter (where (data->>'status') in ('Triage','In progress','In review','Needs decision','Needs data') or (data->>'status') is null))::text as seg_open`, "seg_open", { selectOnly: true }),
      calcCol(`count(*)::text as tix_total`, "tix_total", {
        type: "stacked_bar",
        segments: [{ col: "seg_done", label: "done", color: "#10b981" }, { col: "seg_open", label: "open", color: "#fca5a5" }],
        emptyText: "no tickets yet",
      }),
    ],
    filters: [surfFilter],
    display: AGG,
  }), { bg: "white", border: { left: true, right: true }, padding: { top: "0", bottom: "0" } });
  // bottom of the card — the pattern's pages (non-empty → renders cleanly)
  sec(g, "12", "Spreadsheet", dw(PAGES_SRC, {
    columns: [
      // page title links to the QA page (displays the name, links by page_key via searchParamsCol)
      { name: "name", customName: "Page", show: true, justify: "left", isLink: true, location: "/sitemgmt/page?key=", searchParamsCol: "page_key" },
      pcol("stage", "Stage", STAGE_PILL),
      col("open_bugs", "Open", { justify: "right" }),
      { name: "url", customName: "Live page", show: true, justify: "right", isLink: true, isLinkExternal: true, searchParams: "none", linkText: "view →" },
      { name: "page_key", customName: "Design", show: true, justify: "right", isLink: true, location: "/sitemgmt/design?key=", searchParams: "value", linkText: "design →" },
    ],
    filters: [{ col: "surface", op: "filter", value: [t.surface] }, { col: "stage_order", op: "filter", value: [], sort: "asc" }],
    display: { usePagination: true, pageSize: 50, fetchMode: "smart" },
  }), { bg: "white", border: { left: true, right: true, bottom: true }, radius: { bl: true, br: true }, padding: { top: "0" } });
}

// ── target the existing overview page ──
let pageId = process.env.PAGE_ID;
if (!pageId) {
  const out = cli("page", "list", "--pattern", PATTERN);
  const line = out.split("\n").find((l) => l.trim().startsWith("{") || l.trim().startsWith("["));
  const items = (line ? (JSON.parse(line).items || JSON.parse(line)) : []) || [];
  pageId = items.find((p) => (p.url_slug || p.data?.url_slug) === SLUG)?.id;
}
if (!pageId) { console.error("overview page not found"); process.exit(1); }
console.log("targeting overview page", pageId);
const existing = jget(pageId).data.draft_sections || [];
for (const e of existing) { try { cli("section", "delete", String(e.id), "--page", String(pageId)); } catch (err) { console.log("  DELETE FAILED for", e.id, String(err).slice(0, 120)); } }
cli("raw", "update", String(pageId), "--data", JSON.stringify({ draft_section_groups: groups }));
for (const s of S) {
  const payload = { size: s.size, group: s.group, title: "", element: { "element-data": s.data, "element-type": s.et }, "element-type": s.et };
  for (const k of ["border", "radius", "padding", "height", "bg"]) if (s[k] != null) payload[k] = s[k];
  cli("section", "create", String(pageId), "--pattern", PATTERN, "--data", JSON.stringify(payload));
}
console.log(`built ${S.length} sections (${tracked.length} pattern cards) on /${SLUG} (${pageId})`);
