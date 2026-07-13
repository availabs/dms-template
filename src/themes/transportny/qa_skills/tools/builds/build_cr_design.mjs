// Control Room — Design page (/sitemgmt/design?key=<page_key>). Renders the page's design-system
// MIGRATED to qa_skills/tools/builds/ (2026-07-07, task qa-build-scripts-migration.md).
// Run from dms-template root. Wipe hardened: delete by PAGE ID with loud failures.
// mockup HTML (ingested into sitemgmt_pages.design_html by cr_sync) via the design_frame columnType
// (a sandboxed iframe). Bands: back link → header (identity + stage + view→/QA→ links) → the mockup
// full-width. Mockup + identity/nav only (user stories live on the QA page). Draft-only, idempotent.
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const ENV = { ...process.env, DMS_HOST: "http://localhost:3001", DMS_APP: "npmrdsv5", DMS_TYPE: "dev2" };
const CLI = "src/dms/packages/dms/cli/bin/dms.js";
const PATTERN = "sitemgmt", SLUG = "design";
const cli = (...a) => execFileSync("node", [CLI, ...a], { env: ENV, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const clean = (s) => s.split("\n").filter((l) => l.trim().startsWith("{")).pop();
const jget = (id) => JSON.parse(clean(cli("raw", "get", String(id))));

const PAGES_SRC = { isDms: true, app: "npmrdsv5", type: "sitemgmt_pages", name: "Site Management — Pages",
  source_id: 2184889, view_id: 2184890, env: "npmrdsv5+sitemgmt_pages", srcEnv: "npmrdsv5+sitemgmt_pages", baseUrl: "/forms",
  columns: ["page_key","surface_label","name","route","url","description","build","data","owner","updated","stage","design_file","design_html"].map(n => ({ name: n, display_name: n, type: "text" })) };

const text = (t, format = 0, style = "") => ({ type: "text", version: 1, detail: 0, format, mode: "normal", style, text: t });
const linkNode = (t, url) => ({ type: "link", version: 1, direction: "ltr", format: "", indent: 0, rel: null, target: null, title: null, url, children: [text(t)] });
const styled = (styleKey, ...children) => ({ type: "styled-paragraph", version: 1, direction: "ltr", format: "", indent: 0, textFormat: 0, textStyle: "", styleKey, children });
const lexical = (...nodes) => JSON.stringify({ bgColor: "rgba(0,0,0,0)", isCard: "", showToolbar: false, text: { root: { type: "root", version: 1, direction: "ltr", format: "", indent: 0, children: nodes } } });

const STAGE_PILL = { "Proposed": "zinc", "Design": "slate", "Implemented": "amber", "QA": "blue", "Dev Acceptance": "ink", "Client Acceptance": "green" };
const SURFACE_PILL = { "TSMO": "blue", "Freight Atlas": "blue", "NPMRDS": "blue", "NPMRDS (DMS)": "blue", "NPMRDS (transportNY)": "blue" };
const BUILD_PILL = { "Not started": "slate", "In progress": "amber", "Built (draft)": "blue", "Published": "green" };
const DATA_PILL = { "Real": "green", "Partial": "amber", "Mock": "slate" };

const keyLeaf = (col) => ({ col, op: "filter", value: [], usePageFilters: true, searchParamKey: "key", requireResolved: true });
const dw = (src, { columns, filters = [], display = {} }) => JSON.stringify({
  externalSource: src, columns, filters: { op: "AND", groups: filters },
  display: { usePagination: false, readyToLoad: true, fetchMode: "smart", showAttribution: false, striped: false, ...display },
  data: [], join: { sources: {} } });
const col = (name, label, over = {}) => ({ name, customName: label, show: true, justify: "left", hideHeader: false, ...over });
const pcol = (name, label, map, over = {}) => ({ name, customName: label, type: "status_pill", pillColors: map, show: true, justify: "left", hideHeader: false, ...over });

const B = { crumb: randomUUID(), hdr: randomUUID(), frame: randomUUID() };
const groups = [
  { name: B.crumb, index: 0, theme: "breadcrumb", position: "content", displayName: "Breadcrumb" },
  { name: B.hdr,   index: 1, theme: "header",     position: "content", displayName: "Header" },
  { name: B.frame, index: 2, theme: "content",    position: "content", displayName: "Design mockup" },
];
const S = [];
const sec = (g, size, et, data, extra = {}) => S.push({ group: g, size, et, data, ...extra });

// ── breadcrumb ── (mirrors the Page QA header exactly, with Design wording)
sec(B.crumb, "12", "lexical", lexical(styled("metaXS", text("Site Management     /     Design"))));

// ── header — identical structure to the Page QA header: flat on the white "header" band,
//    eyebrow → big UPPERCASE title (displayLG) + stage pill → description → compact meta row.
sec(B.hdr, "12", "Card", dw(PAGES_SRC, {
  columns: [
    { name: "eyebrow", origin: "static", staticValue: "// page design", valueFontStyle: "kicker", show: true, hideHeader: true, cellSpan: 6 },
    col("name", "Page", { valueFontStyle: "displayLG", hideHeader: true, cellSpan: 5 }),
    pcol("stage", "Stage", STAGE_PILL, { hideHeader: true, cellSpan: 1, justify: "right" }),
    col("description", "", { valueFontStyle: "prose", hideHeader: true, cellSpan: 6 }),
    pcol("surface_label", "Surface", SURFACE_PILL, { hideHeader: true }),
    col("route", "Route", { valueFontStyle: "metaMD", hideHeader: true }),
    pcol("build", "Build", BUILD_PILL, { hideHeader: true }),
    pcol("data", "Data", DATA_PILL, { hideHeader: true }),
    col("owner", "Owner", { valueFontStyle: "metaMD", hideHeader: true }),
    col("updated", "Updated", { valueFontStyle: "metaMD", hideHeader: true }),
  ],
  filters: [keyLeaf("page_key")],
  display: { usePagination: false, pageSize: 1, cellsGridSize: 6, cellsGridGap: 10, cellsRowGap: 3, cellsPadding: 0,
    cellsTracksTemplate: "max-content max-content max-content max-content max-content minmax(0,1fr)", cardBorder: false },
}), {});

// ── the mockup, full-width, rendered in a sandboxed iframe via the design_frame columnType ──
// (no "design-system mockup" label — self-evident)
sec(B.frame, "12", "Card", dw(PAGES_SRC, {
  columns: [
    { name: "design_html", customName: "", type: "design_frame", height: "85vh", show: true, justify: "left", hideHeader: true, cellSpan: 1 },
  ],
  filters: [keyLeaf("page_key")],
  display: { usePagination: false, pageSize: 1, cellsGridSize: 1, cellsGridGap: 0, cardBorder: false, cardsPadding: 0 },
}), { bg: "white", border: "full" });

// find or create the page
const out = cli("page", "list", "--pattern", PATTERN);
const line = out.split("\n").find((l) => l.trim().startsWith("{") || l.trim().startsWith("["));
const items = (line ? (JSON.parse(line).items || JSON.parse(line)) : []) || [];
let pageId = items.find((p) => (p.url_slug || p.data?.url_slug) === SLUG)?.id;
if (!pageId) { pageId = (cli("page", "create", "--pattern", PATTERN, "--title", "Design", "--slug", SLUG).match(/"id"\s*:\s*"?(\d+)"?/) || [])[1]; console.log("created", SLUG, pageId); }
else console.log("reusing", SLUG, pageId);
const existing = jget(pageId).data.draft_sections || [];
for (const e of existing) { try { cli("section", "delete", String(e.id), "--page", String(pageId)); } catch (err) { console.log("  DELETE FAILED for", e.id, String(err).slice(0, 120)); } }
cli("raw", "update", String(pageId), "--data", JSON.stringify({ draft_section_groups: groups, filters: [{ id: "cr-page-key", values: "", searchKey: "key", useSearchParams: true }] }));
for (const s of S) {
  const payload = { size: s.size, group: s.group, title: s.title || "", element: { "element-data": s.data, "element-type": s.et }, "element-type": s.et };
  for (const k of ["border", "radius", "padding", "height", "bg"]) if (s[k] != null) payload[k] = s[k];
  cli("section", "create", String(pageId), "--pattern", PATTERN, "--data", JSON.stringify(payload));
}
console.log(`built ${S.length} sections on /${SLUG} (${pageId})`);
