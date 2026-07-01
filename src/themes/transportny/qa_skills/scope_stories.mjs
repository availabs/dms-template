// qa_skills · scope_stories — helper for the "scope user stories" skill.
//   list                 → print the sitemgmt_pages rows in the Scoping stage (page_key,name,desc)
//   write <stories.json> → create proposed stories from {page_key:[story,...]} (idempotent)
// Falcor-only (no CLI) so it runs from anywhere; needs DMS_AUTH_TOKEN + (optional) DMS_HOST.
import { createFalcorClient } from "../../../dms/packages/dms/cli/src/client.js";
import { readFileSync } from "node:fs";

const TOKEN = process.env.DMS_AUTH_TOKEN; if (!TOKEN) { console.error("set DMS_AUTH_TOKEN (POST /login → user.token)"); process.exit(1); }
const APP = process.env.APP || "npmrdsv5", HOST = process.env.DMS_HOST || "http://localhost:3001";
// control-room sources (this app)
const PAGES = { env: `${APP}+sitemgmt_pages`, view: 2184890 };
const STORIES = { env: `${APP}+sitemgmt_stories`, view: 2186441, dt: "sitemgmt_stories|2186441:data" };
const fc = createFalcorClient(HOST, TOKEN); const u = (v) => (v && typeof v === "object" && "$type" in v ? v.value : v);

async function readRows(env, view, cols) {
  const attrs = cols.map((c) => (c === "id" ? "id" : `data->>'${c}' as ${c}`));
  await fc.get(["uda", env, "viewsById", view, "options", "{}", "length"]);
  let c = fc.getCache(); const len = u(c?.uda?.[env]?.viewsById?.[view]?.options?.["{}"]?.length) || 0;
  if (!len) return [];
  await fc.get(["uda", env, "viewsById", view, "options", "{}", "dataByIndex", { from: 0, to: len - 1 }, attrs]);
  c = fc.getCache(); const bi = c?.uda?.[env]?.viewsById?.[view]?.options?.["{}"]?.dataByIndex || {};
  const out = []; for (let i = 0; i < len; i++) { const n = bi[i]; if (!n) continue; const r = {}; cols.forEach((cn, j) => r[cn] = u(n[attrs[j]])); out.push(r); } return out;
}

const mode = process.argv[2] || "list";

if (mode === "list") {
  const pages = (await readRows(PAGES.env, PAGES.view, ["page_key", "name", "surface_label", "route", "description", "stage"]))
    .filter((p) => p.stage === "Proposed");
  console.log(JSON.stringify(pages, null, 2));
  console.error(`\n${pages.length} page(s) in Proposed. Propose stories, then: node scope_stories.mjs write <stories.json>`);
} else if (mode === "write") {
  const file = process.argv[3]; if (!file) { console.error("usage: write <stories.json>  ({ \"page_key\": [\"story\", …] })"); process.exit(1); }
  const map = JSON.parse(readFileSync(file, "utf8"));
  const existing = await readRows(STORIES.env, STORIES.view, ["page_key", "story"]);
  const seen = new Set(existing.map((r) => `${r.page_key}|||${r.story}`));
  let created = 0, skipped = 0;
  for (const [page_key, stories] of Object.entries(map)) {
    let i = (existing.filter((r) => r.page_key === page_key).length);
    for (const story of stories) {
      if (seen.has(`${page_key}|||${story}`)) { skipped++; continue; }
      await fc.call(["dms", "data", "create"], [APP, STORIES.dt, { page_key, story, stage: "proposed", source: "ai", sort_order: ++i }]);
      created++; console.error(`  + ${page_key}: ${story}`);
    }
  }
  console.error(`\ncreated ${created} proposed stor${created === 1 ? "y" : "ies"}, skipped ${skipped} existing.`);
} else { console.error("modes: list | write <stories.json>"); process.exit(1); }
