// Control Room — SYNC script (client-custom, non-core; the create + refresh tool).
// HOME: src/themes/transportny/qa_skills/tools/ (promoted from scratchpad 2026-07-07 so the
// agent QA process — qa_skills/qa-process.md — can rely on it). Run from dms-template root.
// Parameterized by --app and a --patterns list. Pulls live pages from each content pattern,
// upserts them into the control room's `sitemgmt_pages` source (keyed by page_key), and keeps
// the QA-process columns coherent. The `sitemgmt_tickets` dataset is left in place (the tool's
// other half); pass --clear-tickets to empty it.
//
//   --reset         force EVERY page to the process-start stage "Proposed"
//                   (gates cleared, bug counts zeroed). Without it the script only refreshes
//                   inventory fields (name/route/build) and PRESERVES accumulated QA state.
//   --prune         delete page rows whose page_key is NOT in the synced patterns (mirror the
//                   inventory exactly to the configured patterns — drops stale/demo rows).
//   --clear-tickets delete all rows from sitemgmt_tickets (the dataset/source stays).
//   --clear-stories delete all rows from sitemgmt_stories (ground-up process reset; T1 re-proposes).
//   --no-design     skip the design-mockup ingest (by default each page's design-system mockup
//                   HTML is inlined into design_html so the control room's Design page can render it).
//   --apply         actually write (DRY by default — prints the plan and exits).
//
// Usage (from dms-template root):
//   DMS_AUTH_TOKEN=… node src/themes/transportny/qa_skills/tools/cr_sync.mjs --app npmrdsv5 --apply
//
// CLI (dataset/page reads, schema edits) + falcor client (split-table row read/write/delete).
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { createFalcorClient } from "../../../../dms/packages/dms/cli/src/client.js";

// ── args ──
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : def; };
const APP = opt("app", process.env.APP || "npmrdsv5");
// --patterns overrides the config; when omitted, the tracked patterns come from the
// `sitemgmt_patterns` internal dataset (add a row there + re-run sync to track a new pattern).
const PATTERNS_FLAG = (opt("patterns", process.env.PATTERNS || "")).split(",").map((s) => s.trim()).filter(Boolean);
const APPLY = flag("apply") || process.env.APPLY === "1";
const RESET = flag("reset") || process.env.RESET === "1";
const PRUNE = flag("prune") || process.env.PRUNE === "1";
const CLEAR_TICKETS = flag("clear-tickets") || process.env.CLEAR_TICKETS === "1";
const CLEAR_STORIES = flag("clear-stories") || process.env.CLEAR_STORIES === "1";
const DESIGN = !flag("no-design"); // ingest design-system mockup HTML into design_html by default
const ASOF = opt("asof", process.env.ASOF || new Date().toISOString().slice(0, 10));
const HOST = process.env.DMS_HOST || "http://localhost:3001";
const TOKEN = process.env.DMS_AUTH_TOKEN;
if (!TOKEN) { console.error("set DMS_AUTH_TOKEN (mint via /login)"); process.exit(1); }

const ENV = { ...process.env, DMS_HOST: HOST, DMS_APP: APP, DMS_TYPE: process.env.DMS_TYPE || "dev2" };
const cli = (...a) => execFileSync("node", ["src/dms/packages/dms/cli/bin/dms.js", ...a], { env: ENV, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const clean = (s) => s.split("\n").filter((l) => l.trim().startsWith("{") || l.trim().startsWith("[")).pop();
const jget = (id) => JSON.parse(clean(cli("raw", "get", String(id))));
const fc = createFalcorClient(HOST, TOKEN);
const unwrap = (v) => (v && typeof v === "object" && "$type" in v ? v.value : v);

// ── resolve the control-room sources for this app (source_id + view_id) ──
function resolveSource(instance) {
  const list = JSON.parse(clean(cli("dataset", "list")));
  const item = (list.items || []).find((s) => s.data?.instance === instance);
  if (!item?.id) throw new Error(`source '${instance}' not found in app ${APP}`);
  const view = jget(item.id).data?.views?.[0];
  if (!view?.id) throw new Error(`source '${instance}' has no view`);
  const env = `${APP}+${instance}`;
  return { source_id: +item.id, view_id: +view.id, env, dataType: `${instance}|${view.id}:data` };
}
const PAGES = resolveSource("sitemgmt_pages");
const TICKETS = resolveSource("sitemgmt_tickets");
const PATTERNS_CFG = resolveSource("sitemgmt_patterns");

// ── helpers ──
async function readRows(env, viewId, cols) {
  const attrs = cols.map((c) => (c === "id" ? "id" : `data->>'${c}' as ${c}`));
  await fc.get(["uda", env, "viewsById", viewId, "options", "{}", "length"]);
  let c = fc.getCache(); const len = unwrap(c?.uda?.[env]?.viewsById?.[viewId]?.options?.["{}"]?.length) || 0;
  if (!len) return [];
  await fc.get(["uda", env, "viewsById", viewId, "options", "{}", "dataByIndex", { from: 0, to: len - 1 }, attrs]);
  c = fc.getCache(); const bi = c?.uda?.[env]?.viewsById?.[viewId]?.options?.["{}"]?.dataByIndex || {};
  const rows = [];
  for (let i = 0; i < len; i++) { const n = bi[i]; if (!n) continue; const r = {}; cols.forEach((cn, j) => r[cn] = unwrap(n[attrs[j]])); rows.push(r); }
  return rows;
}
function listPages(pattern) {
  const out = cli("page", "list", "--pattern", pattern);
  const line = out.split("\n").find((l) => l.trim().startsWith("{") || l.trim().startsWith("["));
  return (line ? (JSON.parse(line).items || JSON.parse(line)) : []) || [];
}
const buildOf = (published) => (published && published !== "draft" ? "Published" : "Built (draft)");
const LABELS = { tsmo2: "TSMO", freightatlas2: "Freight Atlas", npmrds2: "NPMRDS", npmrdsv5: "NPMRDS" };
const labelOf = (p) => LABELS[p] || p.replace(/[_-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

// ── process-start fields (the QA workflow starts every page at "Proposed") ──
const PROPOSED = { stage: "Proposed", stage_order: 1, next_step: "Scope & accept the user stories",
  ai_reviewed: "", dev_ready: "", client_approved: "", open_bugs: 0, blockers: 0, majors: 0, rag: "amber" };

// 0) make sure sitemgmt_pages carries the workflow columns + 6-stage select options
function ensurePagesSchema() {
  const row = jget(PAGES.source_id), data = row.data;
  const config = typeof data.config === "string" ? JSON.parse(data.config || "{}") : (data.config || {});
  config.attributes = config.attributes || [];
  const byName = new Map(config.attributes.map((a) => [a.name, a]));
  const STAGE_OPTS = ["Proposed", "Design", "Implemented", "QA", "Dev Acceptance", "Client Acceptance"].map((v) => ({ label: v, value: v }));
  const want = [
    { name: "stage", display_name: "Stage", type: "select", options: STAGE_OPTS },
    { name: "stage_order", display_name: "Stage order", type: "integer" },
    { name: "next_step", display_name: "Next step", type: "text" },
    { name: "url", display_name: "Live URL", type: "text" },
    { name: "ai_reviewed", display_name: "AI Reviewed", type: "text" },
    { name: "dev_ready", display_name: "Dev Ready", type: "text" },
    { name: "client_approved", display_name: "Client Approved", type: "text" },
    { name: "design_file", display_name: "Design file", type: "text" },
    { name: "design_html", display_name: "Design HTML", type: "text" },
  ];
  let changed = false;
  for (const w of want) {
    const ex = byName.get(w.name);
    if (!ex) { config.attributes.push(w); changed = true; }
    else if (w.name === "stage" && JSON.stringify(ex.options) !== JSON.stringify(STAGE_OPTS)) { ex.options = STAGE_OPTS; changed = true; }
  }
  console.log(`SCHEMA sitemgmt_pages: ${changed ? "updated (workflow cols + 6-stage options)" : "already coherent"}`);
  if (changed && APPLY) cli("raw", "update", String(PAGES.source_id), "--data", JSON.stringify({ config: JSON.stringify(config) }));
}
ensurePagesSchema();

// 0a) make sure sitemgmt_tickets carries the denormalized target-page columns (script-owned; the
// tickets table shows the friendly page name, and the ticket detail's target line / Details rail
// need the route + current stage — per the tickets/ticket mockups).
function ensureTicketsSchema() {
  const row = jget(TICKETS.source_id), data = row.data;
  const config = typeof data.config === "string" ? JSON.parse(data.config || "{}") : (data.config || {});
  config.attributes = config.attributes || [];
  const byName = new Map(config.attributes.map((a) => [a.name, a]));
  let changed = false;
  // 7-status vocabulary (2026-07-15, Alex): Triage / In progress / In review are the
  // agent-actionable open set; "Needs decision" parks tickets awaiting a human product/design
  // call (style or content changes), "Needs data" parks tickets requiring dataset/ETL work we
  // don't do automatically — both still count as OPEN in every counter, but the QA agent must
  // not pick them up. Resolved / Closed unchanged.
  const STATUS_OPTS = ["Triage", "In progress", "In review", "Needs decision", "Needs data", "Resolved", "Closed"]
    .map((v) => ({ label: v, value: v }));
  const want = [
    { name: "page_name", display_name: "Page", type: "text" },
    { name: "page_route", display_name: "Page route", type: "text" },
    { name: "page_stage", display_name: "Page stage", type: "text" },
    // surface (page_key prefix) — filter ops are exact-match only, so per-pattern ticket
    // queries (overview tickets bars) need it denormalized; LIKE on page_key isn't available.
    { name: "surface", display_name: "Surface", type: "text" },
    { name: "status", display_name: "Status", type: "select", options: STATUS_OPTS },
    // triage assessment: the agent's proposed fix / disposition, written during T3 assess
    { name: "suggested_solution", display_name: "Suggested solution", type: "textarea" },
    // ── tracking fields (2026-07-15, Alex: "add all the values you suggested") ──
    // kind of ask — orthogonal to the lifecycle status
    { name: "category", display_name: "Category", type: "select",
      options: ["bug", "style", "data", "content", "enhancement"].map((v) => ({ label: v, value: v })) },
    // what was actually done (written when a ticket is Resolved) + when
    { name: "resolution", display_name: "Resolution", type: "textarea" },
    { name: "resolved_date", display_name: "Resolved", type: "text" },
    // row id of the ticket this duplicates (dupes are kept + linked, not deleted)
    { name: "duplicate_of", display_name: "Duplicate of", type: "text" },
    { name: "effort", display_name: "Effort", type: "select",
      options: ["S", "M", "L"].map((v) => ({ label: v, value: v })) },
    // reporter/human confirmation that the fix landed ("agent says fixed" ≠ verified)
    { name: "verified", display_name: "Verified", type: "text" },
    { name: "verified_by", display_name: "Verified by", type: "text" },
    // screenshot / attachment URL (one image disambiguates most style reports)
    { name: "screenshot", display_name: "Screenshot", type: "text" },
  ];
  const added = [];
  for (const w of want) {
    const ex = byName.get(w.name);
    if (!ex) { config.attributes.push(w); added.push(w.name); changed = true; }
    else if (w.name === "status" && JSON.stringify(ex.options) !== JSON.stringify(STATUS_OPTS)) { ex.options = STATUS_OPTS; ex.type = "select"; added.push("status options"); changed = true; }
  }
  console.log(`SCHEMA sitemgmt_tickets: ${changed ? `updated (+${added.join(", +")})` : "already coherent"}`);
  if (changed && APPLY) cli("raw", "update", String(TICKETS.source_id), "--data", JSON.stringify({ config: JSON.stringify(config) }));
}
ensureTicketsSchema();

// 0b) resolve the tracked patterns — from the sitemgmt_patterns config dataset by default, or
// from --patterns when given. Each entry carries its own surface + label (single source of truth).
//
// subdomain/base_url are READ FROM THE PATTERN ROWS themselves (per Alex 2026-07-14: "they
// really should read from the pattern themselves") — the DMS pattern row's data.subdomain/
// data.base_url are what actually route the site, so links composed from them can't drift.
// A NON-EMPTY subdomain/base_url on the sitemgmt_patterns config row acts as an EXPLICIT
// OVERRIDE (logged loudly). A pattern subdomain of "*" (wildcard) yields path-only links.
const patternRowFields = (() => {
  const list = JSON.parse(clean(cli("pattern", "list")));
  const items = list.items || list || [];
  return (name) => {
    const row = items.find((p) => (p.data?.name || p.name) === name);
    const dd = row?.data || row || {};
    const sd = dd.subdomain && dd.subdomain !== "*" ? dd.subdomain : "";
    return { subdomain: sd, base_url: dd.base_url || "/" };
  };
})();
const withPatternFields = (entry, cfgSubdomain = "", cfgBase = "") => {
  const fromPattern = patternRowFields(entry.pattern);
  const subdomain = cfgSubdomain || fromPattern.subdomain;
  const base_url = cfgBase || fromPattern.base_url;
  if (cfgSubdomain && cfgSubdomain !== fromPattern.subdomain)
    console.log(`  OVERRIDE ${entry.pattern}: config subdomain '${cfgSubdomain}' (pattern row says '${fromPattern.subdomain || "*"}') — blank the config column to follow the pattern`);
  return { ...entry, subdomain, base_url };
};
let surfaces;
if (PATTERNS_FLAG.length) {
  surfaces = PATTERNS_FLAG.map((p) => withPatternFields({ pattern: p, surface: p, surface_label: labelOf(p) }));
} else {
  const cfg = await readRows(PATTERNS_CFG.env, PATTERNS_CFG.view_id, ["pattern", "surface", "surface_label", "subdomain", "base_url", "sort_order", "enabled"]);
  surfaces = cfg.filter((r) => r.enabled === "yes").sort((a, b) => (+a.sort_order || 0) - (+b.sort_order || 0))
    .map((r) => withPatternFields({ pattern: r.pattern, surface: r.surface || r.pattern, surface_label: r.surface_label || labelOf(r.pattern) }, r.subdomain || "", r.base_url === "/" ? "" : (r.base_url || "")));
}
// compose the live-page URL: //<subdomain>.<host-suffix><base_url><slug>, protocol-relative.
// The patterns are multi-tenant — subdomain is a host label (tsmo2, freightatlas, npmrds2), so it
// needs the shared host suffix appended. The URL is STORED DATA, so it can't follow the viewing
// host — we hardcode the deployed dev domain (devtny.org, per Alex 2026-07-08) rather than a
// localhost suffix that breaks everywhere but a local dev box. --host-suffix / HOST_SUFFIX override
// (e.g. --host-suffix localhost:5173 for a purely local loop).
const HOST_SUFFIX = opt("host-suffix", process.env.HOST_SUFFIX || "devtny.org");
const pageUrl = (sd, base, slug) => { const path = "/" + `${base || "/"}/${slug}`.replace(/\/+/g, "/").replace(/^\//, ""); return sd ? `//${sd}.${HOST_SUFFIX}${path}` : path; };
console.log(`app=${APP}  patterns=[${surfaces.map((s) => s.pattern).join(", ")}]${PATTERNS_FLAG.length ? " (--patterns)" : " (from sitemgmt_patterns config)"}  ${APPLY ? "APPLY" : "DRY"}${RESET ? " RESET" : ""}${PRUNE ? " PRUNE" : ""}${CLEAR_TICKETS ? " CLEAR-TICKETS" : ""}${CLEAR_STORIES ? " CLEAR-STORIES" : ""}`);

// ── design-system mockup ingest ──
// Each tracked page pulls its converged design-system mockup HTML into design_html so the control
// room's Design page can render it (via the design_frame columnType, in a sandboxed iframe). We
// INLINE _shared.css and STRIP the dev-only ds-nav widget; the Tailwind + Google-Fonts CDN tags are
// kept (they load inside the iframe). Filenames are mostly conventional — a small override map covers
// the irregular slugs. Add a KEY_FILE_OVERRIDE entry when a new page's file doesn't match the rule.
const PAGES_DIR = "src/themes/transportny/TransportNY Design System/dms_design_system_v2/pages";
const SURFACE_PREFIX = { tsmo2: "tsmo-", freightatlas2: "freight-atlas-" };
const KEY_FILE_OVERRIDE = {
  "tsmo2:corridor_view": "tsmo-corridor.html",
  "freightatlas2:maps_gallery": "freight-atlas-gallery.html",
  "freightatlas2:freight_atlas": "freight-atlas-map.html",
  "freightatlas2:data_downloads": "freight-atlas-data.html",
  "npmrds2:map_21": "map-21.html",
  "npmrds2:map_21_system_performance": "map-21-system-performance.html",
};
const SHARED_CSS = DESIGN && existsSync(`${PAGES_DIR}/_shared.css`) ? readFileSync(`${PAGES_DIR}/_shared.css`, "utf8") : "";
const resolveDesignFile = (surface, slug, page_key) => {
  if (KEY_FILE_OVERRIDE[page_key]) return KEY_FILE_OVERRIDE[page_key];
  const prefix = SURFACE_PREFIX[surface];
  return prefix ? `${prefix}${slug.replace(/_v\d+$/, "").replace(/_/g, "-")}.html` : "";
};
function ingestDesign(surface, slug, page_key) {
  const file = resolveDesignFile(surface, slug, page_key);
  if (!file || !existsSync(`${PAGES_DIR}/${file}`)) return { design_file: "", design_html: "" };
  let html = readFileSync(`${PAGES_DIR}/${file}`, "utf8");
  html = html.replace(/<link\b[^>]*href=["']_shared\.css["'][^>]*>/i, SHARED_CSS ? `<style>\n${SHARED_CSS}\n</style>` : "");
  html = html.replace(/<script\b[^>]*src=["'][^"']*ds-nav\.js["'][^>]*>\s*<\/script>/i, "");
  return { design_file: file, design_html: html };
}

// 1) live content pages → desired inventory rows
const desired = [];
for (const { pattern, surface, surface_label, subdomain, base_url } of surfaces) {
  for (const p of listPages(pattern)) {
    const slug = p.url_slug || p.data?.url_slug; if (!slug) continue;
    const page_key = `${surface}:${slug}`;
    desired.push({ page_key, surface, surface_label,
      name: p.title || p.data?.title || slug, route: `/${slug}`, url: pageUrl(subdomain, base_url, slug),
      build: buildOf(p.published ?? p.data?.published),
      ...(DESIGN ? ingestDesign(surface, slug, page_key) : {}) });
  }
}
console.log(`live pages across ${surfaces.length} pattern(s): ${desired.length}`);
if (DESIGN) console.log(`design mockups ingested: ${desired.filter((d) => d.design_html).length}/${desired.length}` +
  ` (missing: ${desired.filter((d) => !d.design_html).map((d) => d.page_key).join(", ") || "none"})`);

// 2) existing sitemgmt_pages
const existing = await readRows(PAGES.env, PAGES.view_id, ["id", "page_key", "qa", "data", "owner", "build", "name", "stage", "route"]);
const byKey = new Map(existing.map((r) => [r.page_key, r]));

let updates = 0, creates = 0; const plan = [];
for (const d of desired) {
  const ex = byKey.get(d.page_key);
  if (ex) {
    // always refresh inventory fields; reset process state only when --reset
    const patch = { surface: d.surface, surface_label: d.surface_label, name: d.name, route: d.route, url: d.url, build: d.build, updated: ASOF };
    if (RESET) Object.assign(patch, PROPOSED);
    if (DESIGN) { patch.design_file = d.design_file; patch.design_html = d.design_html; }
    plan.push(`UPDATE ${d.page_key.padEnd(30)} build:${d.build}${RESET ? "  → Proposed" : `  (stage kept: ${ex.stage || "—"})`}`);
    if (APPLY) await fc.call(["dms", "data", "edit"], [APP, +ex.id, patch, PAGES.dataType]);
    updates++;
  } else {
    const row = { page_key: d.page_key, surface: d.surface, surface_label: d.surface_label, name: d.name, route: d.route, url: d.url,
      build: d.build, qa: "Needs QA", data: "Mock", owner: "—", updated: ASOF, ...PROPOSED,
      ...(DESIGN ? { design_file: d.design_file, design_html: d.design_html } : {}) };
    plan.push(`CREATE ${d.page_key.padEnd(30)} build:${d.build}  → Proposed`);
    if (APPLY) await fc.call(["dms", "data", "create"], [APP, PAGES.dataType, row]);
    creates++;
  }
}
console.log("\n" + plan.join("\n"));
const unmatched = existing.filter((r) => !desired.find((d) => d.page_key === r.page_key));
console.log(`\nUPDATE ${updates} | CREATE ${creates} | existing rows not in live patterns: ${unmatched.map((r) => r.page_key).join(", ") || "none"}`);

// 2b) optionally prune stale rows (mirror inventory exactly to the synced patterns)
if (PRUNE && unmatched.length) {
  console.log(`\nPRUNE: ${unmatched.length} stale page row(s) to delete`);
  if (APPLY) {
    const ids = unmatched.map((r) => +r.id);
    await fc.call(["dms", "data", "delete"], [APP, PAGES.dataType, ...ids]);
    console.log(`deleted ${ids.length} stale page rows`);
  }
}

// 3) optionally clear all tickets (dataset/source stays)
if (CLEAR_TICKETS) {
  const trows = await readRows(TICKETS.env, TICKETS.view_id, ["id"]);
  console.log(`\nCLEAR-TICKETS: ${trows.length} ticket row(s) to delete`);
  if (APPLY && trows.length) {
    const ids = trows.map((r) => +r.id);
    await fc.call(["dms", "data", "delete"], [APP, TICKETS.dataType, ...ids]);
    console.log(`deleted ${ids.length} ticket rows`);
  }
}

// 3b) optionally clear all stories (dataset/source stays) — a ground-up process reset:
// T1 (qa-scope-stories) re-proposes them fresh.
if (CLEAR_STORIES) {
  const STORIES = resolveSource("sitemgmt_stories");
  const srows = await readRows(STORIES.env, STORIES.view_id, ["id"]);
  console.log(`\nCLEAR-STORIES: ${srows.length} story row(s) to delete`);
  if (APPLY && srows.length) {
    const ids = srows.map((r) => +r.id);
    await fc.call(["dms", "data", "delete"], [APP, STORIES.dataType, ...ids]);
    console.log(`deleted ${ids.length} story rows`);
  }
}

// 4) ticket hygiene + target-page denormalize. (a) HEAL form-created tickets (the Page-QA
// add-ticket modal writes only the authored fields): default status to Triage, stamp
// opened/updated with ASOF. NO ticket_id healing (removed 2026-07-15): ticket identity is the
// DMS ROW ID — links/filters key on it and displays fall back to it — and re-numbering a ticket
// after someone has referenced its displayed # would silently rename it. (b) denormalize
// page_key → name/route/stage (name+route fresh from the live pages; stage from sitemgmt_pages
// process state). Idempotent.
if (!CLEAR_TICKETS) {
  const infoOf = new Map(existing.map((r) => [r.page_key, { name: r.name, route: r.route, stage: r.stage }]));
  for (const d of desired) {
    const prev = infoOf.get(d.page_key) || {};
    infoOf.set(d.page_key, { ...prev, name: d.name, route: d.route, ...(RESET ? { stage: "Proposed" } : {}) });
  }
  const trows = await readRows(TICKETS.env, TICKETS.view_id,
    ["id", "ticket_id", "status", "severity", "opened", "updated", "page_key", "page_name", "page_route", "page_stage", "surface"]);
  const patches = [];
  for (const t of trows) {
    const patch = {};
    if (!t.status) { patch.status = "Triage"; t.status = "Triage"; } // heal in-memory too — counters below use it
    if (!t.opened) patch.opened = ASOF;
    if (!t.updated) patch.updated = ASOF;
    const i = t.page_key && infoOf.get(t.page_key);
    if (i && ((i.name || "") !== (t.page_name || "") || (i.route || "") !== (t.page_route || "") || (i.stage || "") !== (t.page_stage || ""))) {
      patch.page_name = i.name || ""; patch.page_route = i.route || ""; patch.page_stage = i.stage || "";
    }
    const surface = (t.page_key || "").split(":")[0];
    if (surface && (t.surface || "") !== surface) patch.surface = surface;
    if (Object.keys(patch).length) patches.push({ id: t.id, page_key: t.page_key, patch });
  }
  console.log(`\nTICKET hygiene+denormalize: ${trows.length} ticket(s), ${patches.length} to patch` +
    (patches.length ? ` (${patches.map((p) => `#${p.id}`).join(", ")})` : ""));
  if (APPLY) for (const p of patches) await fc.call(["dms", "data", "edit"], [APP, +p.id, p.patch, TICKETS.dataType]);

  // 5) recompute per-page ticket COUNTERS onto sitemgmt_pages (open_bugs / blockers / majors +
  // the rag rollup) — the overview's "Open" column and the QA-process orchestrator read these.
  // open = status ∈ (Triage, In progress, In review). Idempotent: patch only rows that differ.
  const OPEN_ST = new Set(["Triage", "In progress", "In review", "Needs decision", "Needs data"]);
  const byPage = new Map();
  for (const t of trows) {
    if (!t.page_key || !OPEN_ST.has(t.status)) continue;
    const c = byPage.get(t.page_key) || { open: 0, blockers: 0, majors: 0 };
    c.open++;
    if (t.severity === "Blocker") c.blockers++;
    if (t.severity === "Major") c.majors++;
    byPage.set(t.page_key, c);
  }
  // + STAGE-TUPLE RECONCILE: the QA page's editable stage pill (liveEdit) writes ONLY `stage`,
  // leaving stage_order/next_step stale. Reconcile them from the canonical 6-stage model here.
  const STAGE_TUPLE = {
    "Proposed": [1, "Scope & accept the user stories"], "Design": [2, "Review & approve the design mockup"],
    "Implemented": [3, "Run QA"], "QA": [4, "Resolve QA tickets, then dev sign-off"],
    "Dev Acceptance": [5, "Send to client for acceptance"], "Client Acceptance": [6, "Done (reopens on new features)"],
  };
  const prows = await readRows(PAGES.env, PAGES.view_id, ["id", "page_key", "open_bugs", "blockers", "majors", "rag", "stage", "stage_order", "next_step"]);
  const cpatches = [];
  for (const p of prows) {
    const c = byPage.get(p.page_key) || { open: 0, blockers: 0, majors: 0 };
    const rag = (c.blockers || c.majors) ? "red" : (c.open ? "amber" : "green");
    const patch = {};
    if ((+p.open_bugs || 0) !== c.open || (+p.blockers || 0) !== c.blockers || (+p.majors || 0) !== c.majors || (p.rag || "") !== rag) {
      Object.assign(patch, { open_bugs: c.open, blockers: c.blockers, majors: c.majors, rag });
    }
    const tuple = STAGE_TUPLE[p.stage];
    if (tuple && ((+p.stage_order || 0) !== tuple[0] || (p.next_step || "") !== tuple[1])) {
      Object.assign(patch, { stage_order: tuple[0], next_step: tuple[1] });
    }
    if (Object.keys(patch).length) cpatches.push({ id: p.id, page_key: p.page_key, patch });
  }
  console.log(`PAGE counters: ${prows.length} page(s), ${cpatches.length} to patch` +
    (cpatches.length ? ` (${cpatches.map((p) => `${p.page_key}→${Object.keys(p.patch).join("+")}`).join(", ")})` : ""));
  if (APPLY) for (const p of cpatches) await fc.call(["dms", "data", "edit"], [APP, +p.id, p.patch, PAGES.dataType]);
}

console.log(APPLY ? "\nsync complete." : "\nDRY RUN — no writes. Add --apply to write.");
