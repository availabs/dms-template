#!/usr/bin/env node
// add_cr_pattern.mjs — enrol ONE pattern in the TransportNY QA control room.
//
// Writes a single row to `sitemgmt_patterns` (source 2186148 / view 2186149). That table is
// otherwise READ-ONLY to agents (qa_skills/qa-process.md) — enrolling is an owner-requested
// action, so this script backs the table up, prints the planned row, and does nothing at all
// unless `--apply` is passed.
//
// ENROLMENT IS DEFAULT-DENY (Alex, 2026-08-12): "I don't want to automatically add pages to the
// QA — only pages we specifically ask for." That rule is enforced HERE, not just documented:
// `--include-slugs` is REQUIRED unless you explicitly pass `--all-pages`. A pattern like
// `npmrds_sub` holds 39 live pages, 22 of them report conversions that must never enter the
// pipeline; forgetting the allowlist would enrol all of them on the next `cr_sync --apply`.
//
// Generalised from scratchpad/add_cr_pattern_landing.mjs (the 2026-07-29 `landing` job).
//
// USAGE (from the dms-template root, with DMS_AUTH_TOKEN exported):
//   export DMS_AUTH_TOKEN=$(node src/dms/packages/dms/cli/bin/mint-token.mjs \
//     --host https://dmsserver.availabs.org --project npmrdsv5 \
//     --email availabs@gmail.com --password test123)
//   DMS_HOST=https://dmsserver.availabs.org node src/themes/transportny/qa_skills/tools/add_cr_pattern.mjs \
//     --pattern npmrds_sub --surface npmrds --label NPMRDS --sort-order 4 --include-slugs macro,home
//   # …review the plan, then re-run with --apply
//
// AFTER APPLYING: run `cr_sync --app npmrdsv5` DRY first and read the ALLOWLIST lines — they must
// show exactly the slugs you asked for and nothing else — then `--apply`. The control-room
// overview page does not show the new surface until build_cr_overview.mjs is re-run.
//
// FLAGS
//   --pattern <name|id>   the DMS pattern's data.name (or its numeric id, as the Freight Atlas row
//                         does — `cr_sync`'s patternRowFields matches on NAME only, so an id-based
//                         row must also pass --subdomain explicitly).
//   --surface <key>       page_key prefix + ticket `surface` value. Defaults to --pattern.
//                         ⚠ NEVER rename a surface that already has tickets — page_key is the FK.
//   --label <text>        surface_label shown in the control room. Defaults to a titlecased pattern.
//   --subdomain <host>    EXPLICIT OVERRIDE of the live pattern row's subdomain. Leave blank to let
//                         cr_sync read it off the pattern (the normal case).
//   --base-url <path>     default "/" — which cr_sync treats as "unset, follow the pattern row".
//   --sort-order <n>      display order in the control room. Default: max(existing)+1.
//   --include-slugs a,b   the allowlist. REQUIRED unless --all-pages.
//   --all-pages           opt OUT of the allowlist (legacy behaviour: inventory every live page).
//   --apply               actually write. Without it this is a dry run.

import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { createFalcorClient } from "../../../../dms/packages/dms/cli/src/client.js";

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d = "") => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };

const APPLY = flag("apply");
const HOST = process.env.DMS_HOST || "http://localhost:3001";
const APP = process.env.DMS_APP || "npmrdsv5";
const TYPE = process.env.DMS_TYPE || "dev2";
const TOKEN = process.env.DMS_AUTH_TOKEN;
if (!TOKEN) { console.error("set DMS_AUTH_TOKEN (mint via src/dms/packages/dms/cli/bin/mint-token.mjs)"); process.exit(1); }

const pattern = opt("pattern");
if (!pattern) { console.error("--pattern is required"); process.exit(1); }
const surface = opt("surface") || pattern;
const includeSlugs = opt("include-slugs");
const allPages = flag("all-pages");
if (!includeSlugs && !allPages) {
  console.error(
    `REFUSING: enrolment is default-deny. Pass --include-slugs <slug,slug> to enrol named pages,\n` +
    `or --all-pages to deliberately inventory EVERY live page of '${pattern}'.`
  );
  process.exit(1);
}
const label = opt("label") || pattern.replace(/[_-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

const ENV = { ...process.env, DMS_HOST: HOST, DMS_APP: APP, DMS_TYPE: TYPE };
const cli = (...a) => execFileSync("node", ["src/dms/packages/dms/cli/bin/dms.js", ...a], { env: ENV, encoding: "utf8", maxBuffer: 1e8, stdio: ["ignore", "pipe", "ignore"] });
const clean = (s) => s.split("\n").filter((l) => l.trim().startsWith("{") || l.trim().startsWith("[")).pop();
const fc = createFalcorClient(HOST, TOKEN);
const unwrap = (v) => (v && typeof v === "object" && "$type" in v ? v.value : v);

// resolve sitemgmt_patterns by instance name rather than hardcoding ids (cr_sync does the same)
const list = JSON.parse(clean(cli("dataset", "list")));
const item = (list.items || []).find((s) => s.data?.instance === "sitemgmt_patterns");
if (!item?.id) { console.error(`source 'sitemgmt_patterns' not found in app ${APP}`); process.exit(1); }
const SRC = +item.id;
const VIEW = +JSON.parse(clean(cli("raw", "get", String(SRC)))).data?.views?.[0]?.id;
if (!VIEW) { console.error("sitemgmt_patterns has no view"); process.exit(1); }
const dataType = `sitemgmt_patterns|${VIEW}:data`;
const env = `${APP}+sitemgmt_patterns`;
console.log(`sitemgmt_patterns: source ${SRC} / view ${VIEW}  (host ${HOST}, app ${APP})`);

// read every existing row (id + app included, so the backup is restorable)
const cols = ["id", "app", "pattern", "surface", "surface_label", "subdomain", "base_url", "sort_order", "enabled", "include_slugs"];
const attrs = cols.map((c) => (c === "id" ? "id" : `data->>'${c}' as ${c}`));
await fc.get(["uda", env, "viewsById", VIEW, "options", "{}", "length"]);
const len = unwrap(fc.getCache()?.uda?.[env]?.viewsById?.[VIEW]?.options?.["{}"]?.length) || 0;
const rows = [];
if (len) {
  await fc.get(["uda", env, "viewsById", VIEW, "options", "{}", "dataByIndex", { from: 0, to: len - 1 }, attrs]);
  const bi = fc.getCache()?.uda?.[env]?.viewsById?.[VIEW]?.options?.["{}"]?.dataByIndex || {};
  for (let i = 0; i < len; i++) { const n = bi[i]; if (!n) continue; const r = {}; cols.forEach((cn, j) => (r[cn] = unwrap(n[attrs[j]]))); rows.push(r); }
}

// back up BEFORE anything else, dry run included, and stamp the filename so a second run
// cannot overwrite the first backup (the scratchpad original used a fixed name).
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
mkdirSync("scratchpad/npmrdsv5-dev2/backups", { recursive: true });
const backup = `scratchpad/npmrdsv5-dev2/backups/sitemgmt_patterns.${stamp}.before.json`;
writeFileSync(backup, JSON.stringify(rows, null, 1));
console.log(`existing rows: ${rows.length} (backed up → ${backup})`);
rows.forEach((r) => console.log(`  ${String(r.sort_order).padStart(2)} ${r.pattern} → ${r.surface} (${r.enabled})  include_slugs='${r.include_slugs || ""}'`));

if (rows.some((r) => r.pattern === pattern || r.surface === surface)) {
  console.log(`\n'${pattern}'/'${surface}' is ALREADY enrolled — nothing to do. Edit the row (or its include_slugs) instead.`);
  process.exit(0);
}

const sortOrder = opt("sort-order") || String(rows.reduce((m, r) => Math.max(m, +r.sort_order || 0), 0) + 1);
const row = {
  app: APP,
  pattern,
  surface,
  surface_label: label,
  subdomain: opt("subdomain"),
  base_url: opt("base-url") || "/",
  sort_order: String(sortOrder),
  enabled: "yes",
  include_slugs: allPages ? "" : includeSlugs,
};

console.log("\nPLANNED ROW:", JSON.stringify(row));
console.log(
  allPages
    ? "  scope: ALL live pages of this pattern will be inventoried (--all-pages)."
    : `  scope: ONLY [${row.include_slugs}] — every other live page of '${pattern}' stays out of the QA pipeline.`
);
if (!APPLY) { console.log("\nDRY — pass --apply to write."); process.exit(0); }
await fc.call(["dms", "data", "create"], [APP, dataType, row]);
console.log("created. Next: cr_sync --app " + APP + "  (DRY first — check the ALLOWLIST lines), then --apply.");
