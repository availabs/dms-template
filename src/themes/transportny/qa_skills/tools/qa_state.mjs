// qa_state.mjs — shared state reader/writer for the agent QA process (qa_skills/qa-process.md).
// Falcor-only (no CLI); needs DMS_AUTH_TOKEN (+ optional DMS_HOST). Run from anywhere.
//
//   node qa_state.mjs state [--pattern tsmo2] [--page tsmo2:home]
//       → JSON { pages: [ {..., open_tickets: [...], stories: {proposed,accepted,verified} } ] }
//   node qa_state.mjs set-stage <page_key> <Stage> [gates-json]
//       → writes canonical stage/stage_order/next_step (+ optional gate fields, e.g.
//         '{"dev_ready":"yes"}'). Stage must be one of the six canonical names.
//   node qa_state.mjs add-ticket '<json>'|@file.json
//       → creates a ticket; defaults status Triage, source ai, reporter QA-agent, dates today.
//         DEDUPE: skipped (exit 0, prints existing id) if an OPEN ticket with the same page_key
//         + normalized title exists. ticket_id/page_name/page_route/page_stage land via cr_sync.
//   node qa_state.mjs patch-ticket <row_id> '<json>'|@file.json   (auto-stamps updated=today)
//   node qa_state.mjs add-story '<json>'|@file.json
//       → { page_key, story, [stage=proposed], [source=ai], [sort_order] }; idempotent by
//         page_key + normalized story text.
//   node qa_state.mjs patch-story <row_id> '<json>'
//   node qa_state.mjs add-stories @file.json [--stage accepted]
//       → bulk: { "<page_key>": ["story", …], … }; same dedupe as add-story; --stage overrides
//         the default 'proposed' (e.g. when a human has pre-accepted the batch).
import { createFalcorClient } from "../../../../dms/packages/dms/cli/src/client.js";
import { readFileSync } from "node:fs";

const APP = process.env.APP || "npmrdsv5";
const HOST = process.env.DMS_HOST || "http://localhost:3001";
const TOKEN = process.env.DMS_AUTH_TOKEN;
if (!TOKEN) { console.error("set DMS_AUTH_TOKEN (mint via cli/bin/mint-token.mjs)"); process.exit(1); }
const fc = createFalcorClient(HOST, TOKEN);
const unwrap = (v) => (v && typeof v === "object" && "$type" in v ? v.value : v);
const today = () => new Date().toISOString().slice(0, 10);

// dataset bindings (control room, app npmrdsv5 — see qa-process.md §datasets)
const PAGES = { env: `${APP}+sitemgmt_pages`, viewId: 2184890, dataType: `sitemgmt_pages|2184890:data` };
const TICKETS = { env: `${APP}+sitemgmt_tickets`, viewId: 2184924, dataType: `sitemgmt_tickets|2184924:data` };
const STORIES = { env: `${APP}+sitemgmt_stories`, viewId: 2186441, dataType: `sitemgmt_stories|2186441:data` };

// THE canonical 6-stage model (strings must match build_cr_overview/build_cr_page exactly)
export const STAGES = {
  "Proposed":          { order: 1, next_step: "Scope & accept the user stories" },
  "Design":            { order: 2, next_step: "Review & approve the design mockup" },
  "Implemented":       { order: 3, next_step: "Run QA" },
  "QA":                { order: 4, next_step: "Resolve QA tickets, then dev sign-off" },
  "Dev Acceptance":    { order: 5, next_step: "Send to client for acceptance" },
  "Client Acceptance": { order: 6, next_step: "Done (reopens on new features)" },
};
export const OPEN_STATUSES = ["Triage", "In progress", "In review"];
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

async function readRows(ds, cols) {
  const attrs = cols.map((c) => (c === "id" ? "id" : `data->>'${c}' as ${c}`));
  await fc.get(["uda", ds.env, "viewsById", ds.viewId, "options", "{}", "length"]);
  let c = fc.getCache();
  const len = unwrap(c?.uda?.[ds.env]?.viewsById?.[ds.viewId]?.options?.["{}"]?.length) || 0;
  if (!len) return [];
  await fc.get(["uda", ds.env, "viewsById", ds.viewId, "options", "{}", "dataByIndex", { from: 0, to: len - 1 }, attrs]);
  c = fc.getCache();
  const bi = c?.uda?.[ds.env]?.viewsById?.[ds.viewId]?.options?.["{}"]?.dataByIndex || {};
  const rows = [];
  for (let i = 0; i < len; i++) { const n = bi[i]; if (!n) continue; const r = {}; cols.forEach((cn, j) => r[cn] = unwrap(n[attrs[j]])); rows.push(r); }
  return rows;
}
const edit = (ds, id, patch) => fc.call(["dms", "data", "edit"], [APP, +id, patch, ds.dataType]);
const create = (ds, row) => fc.call(["dms", "data", "create"], [APP, ds.dataType, row]);
const parseArg = (a) => JSON.parse(a.startsWith("@") ? readFileSync(a.slice(1), "utf8") : a);

const [cmd, ...args] = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };

if (cmd === "state") {
  const pages = await readRows(PAGES, ["id", "page_key", "surface", "surface_label", "name", "route", "url", "build", "data", "owner", "updated",
    "description", "stage", "stage_order", "next_step", "ai_reviewed", "dev_ready", "client_approved", "open_bugs", "blockers", "majors", "rag", "design_file"]);
  const tickets = await readRows(TICKETS, ["id", "ticket_id", "title", "page_key", "severity", "priority", "status", "source", "assignee", "opened", "updated"]);
  const stories = await readRows(STORIES, ["id", "page_key", "story", "stage", "source"]);
  const pat = opt("pattern"), pk = opt("page");
  const out = pages
    .filter((p) => (!pat || p.surface === pat) && (!pk || p.page_key === pk))
    .map((p) => ({
      ...p,
      open_tickets: tickets.filter((t) => t.page_key === p.page_key && OPEN_STATUSES.includes(t.status))
        .map(({ id, ticket_id, title, severity, priority, status, source, assignee }) => ({ id, ticket_id, title, severity, priority, status, source, assignee })),
      stories: {
        proposed: stories.filter((s) => s.page_key === p.page_key && s.stage === "proposed").length,
        accepted: stories.filter((s) => s.page_key === p.page_key && s.stage === "accepted").length,
        verified: stories.filter((s) => s.page_key === p.page_key && s.stage === "verified").length,
        rows: pk ? stories.filter((s) => s.page_key === p.page_key) : undefined,
      },
    }));
  console.log(JSON.stringify(out, null, 1));
} else if (cmd === "set-stage") {
  const [pageKey, stage] = args;
  const gates = args[2] && !args[2].startsWith("--") ? parseArg(args[2]) : {};
  const S = STAGES[stage];
  if (!S) { console.error(`unknown stage "${stage}" — one of: ${Object.keys(STAGES).join(" | ")}`); process.exit(1); }
  const pages = await readRows(PAGES, ["id", "page_key", "stage"]);
  const row = pages.find((p) => p.page_key === pageKey);
  if (!row) { console.error(`no sitemgmt_pages row for ${pageKey}`); process.exit(1); }
  await edit(PAGES, row.id, { stage, stage_order: S.order, next_step: S.next_step, updated: today(), ...gates });
  console.log(`${pageKey}: ${row.stage || "—"} → ${stage}${Object.keys(gates).length ? ` (+${Object.keys(gates).join(",")})` : ""}`);
} else if (cmd === "add-ticket") {
  const t = parseArg(args[0]);
  if (!t.page_key || !t.title) { console.error("add-ticket needs at least { page_key, title }"); process.exit(1); }
  const existing = await readRows(TICKETS, ["id", "ticket_id", "title", "page_key", "status"]);
  const dup = existing.find((e) => e.page_key === t.page_key && OPEN_STATUSES.includes(e.status) && norm(e.title) === norm(t.title));
  if (dup) { console.log(`DEDUPE: open ticket #${dup.ticket_id || dup.id} already covers "${t.title}" on ${t.page_key}`); process.exit(0); }
  const row = { status: "Triage", source: "ai", reporter: "QA-agent", opened: today(), updated: today(), ...t };
  const res = await create(TICKETS, row);
  console.log(`created ticket on ${t.page_key}: ${t.title}`);
} else if (cmd === "patch-ticket") {
  const [id, json] = args;
  await edit(TICKETS, id, { updated: today(), ...parseArg(json) });
  console.log(`patched ticket row ${id}`);
} else if (cmd === "add-story") {
  const s = parseArg(args[0]);
  if (!s.page_key || !s.story) { console.error("add-story needs { page_key, story }"); process.exit(1); }
  const existing = await readRows(STORIES, ["id", "page_key", "story"]);
  const dup = existing.find((e) => e.page_key === s.page_key && norm(e.story) === norm(s.story));
  if (dup) { console.log(`DEDUPE: story row ${dup.id} already exists on ${s.page_key}`); process.exit(0); }
  const row = { stage: "proposed", source: "ai", sort_order: String(existing.filter((e) => e.page_key === s.page_key).length + 1), ...s };
  const res = await create(STORIES, row);
  console.log(`created story on ${s.page_key}`);
} else if (cmd === "add-stories") {
  const byPage = parseArg(args[0]);
  const stage = opt("stage") || "proposed";
  const existing = await readRows(STORIES, ["id", "page_key", "story"]);
  let created = 0, deduped = 0;
  for (const [page_key, list] of Object.entries(byPage)) {
    let order = existing.filter((e) => e.page_key === page_key).length;
    for (const story of list) {
      const dup = existing.find((e) => e.page_key === page_key && norm(e.story) === norm(story));
      if (dup) { deduped++; continue; }
      await create(STORIES, { page_key, story, stage, source: "ai", sort_order: String(++order) });
      created++;
    }
  }
  console.log(`add-stories: ${created} created (stage=${stage}), ${deduped} deduped`);
} else if (cmd === "patch-story") {
  const [id, json] = args;
  await edit(STORIES, id, parseArg(json));
  console.log(`patched story row ${id}`);
} else {
  console.error("usage: qa_state.mjs state|set-stage|add-ticket|patch-ticket|add-story|patch-story …  (see header)");
  process.exit(1);
}
