// Prune orphaned `reports_snap_2` catalog rows. Historically the generic "Delete Page" admin
// action never cascaded to this dataset — fixed at the source 2026-09-04 by
// dms-server's cascadePageDelete + hooks/npmrds_report_page_delete_hook.js (see
// src/dms/planning/tasks/current/page-delete-lifecycle-hook.md), so a page delete going
// forward should no longer orphan its catalog row. Keep this script around as a defense-in-depth
// backstop (same reasoning as ReportPickerModal/useReportSearch.js's `checkIdsExist` — a hook
// failure is logged but never blocks the delete, and any row created before the fix landed is
// still out there) and to prune anything a future regression or out-of-band delete produces.
// Run whenever the list page looks like it's showing dead rows, or periodically as maintenance.
//
// DRY BY DEFAULT — prints what it would delete and exits. Pass --apply to actually delete.
//
// Usage (from dms-template root):
//   export DMS_AUTH_TOKEN=$(node src/dms/packages/dms/cli/bin/mint-token.mjs \
//     --host https://dmsserver.availabs.org --project npmrdsv5 --email availabs@gmail.com --password test123)
//   node src/themes/transportny/qa_skills/tools/prune_report_snap_orphans.mjs           # dry run
//   node src/themes/transportny/qa_skills/tools/prune_report_snap_orphans.mjs --apply   # actually delete
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");

// npmrdsv5's app/pattern name and the reports_snap_2 catalog's source/view ids
// are the single source of truth in hooks/reports_snap_ids.json — also read by
// convert_old_reports_lib/config.py, report_build.mjs, and dms-server's
// npmrds_report_page_delete_hook.js. Do not hardcode a second copy here.
const REPORTS_SNAP_IDS = JSON.parse(readFileSync(resolve(REPO, "hooks/reports_snap_ids.json"), "utf8"));

const APPLY = process.argv.includes("--apply");
const ENV = {
  ...process.env,
  DMS_HOST: process.env.DMS_HOST || "https://dmsserver.availabs.org",
  DMS_APP: process.env.DMS_APP || REPORTS_SNAP_IDS.app,
  DMS_TYPE: process.env.DMS_TYPE || "dev2",
};
const CLI = "src/dms/packages/dms/cli/bin/dms.js";
const PATTERN = REPORTS_SNAP_IDS.pattern;
// The `reports_snap_2` catalog binding — same source/view every report page and picker reads
// (reportCatalogSource.js, build_npmrds_reports.mjs, build_npmrds_reports_list.mjs).
const CATALOG_SOURCE_ID = REPORTS_SNAP_IDS.reports_snap_source_id;
const CATALOG_VIEW_ID = REPORTS_SNAP_IDS.reports_snap_view_id;
const CATALOG_SPLIT_TYPE = `reports_snap_2|${CATALOG_VIEW_ID}:data`;

const cli = (...a) => execFileSync("node", [CLI, ...a], { env: ENV, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const lastJson = (s) => JSON.parse(s.split("\n").filter((l) => l.trim().startsWith("{") || l.trim().startsWith("[")).pop());

console.log(`checking reports_snap_2 (source ${CATALOG_SOURCE_ID}/view ${CATALOG_VIEW_ID}) against real ${PATTERN} pages on ${ENV.DMS_HOST} ${ENV.DMS_APP}/${ENV.DMS_TYPE}...`);

const catalog = lastJson(cli("dataset", "dump", String(CATALOG_SOURCE_ID))).items || [];
const pages = lastJson(cli("page", "list", "--pattern", PATTERN, "--limit", "1000")).items || [];
const realPageIds = new Set(pages.map((p) => String(p.id)));

const orphans = catalog.filter((row) => {
  const reportId = row.data?.report_id;
  return reportId != null && reportId !== "" && !realPageIds.has(String(reportId));
});

console.log(`catalog rows: ${catalog.length} · real pages: ${pages.length} · orphans found: ${orphans.length}`);
if (!orphans.length) {
  console.log("nothing to prune.");
  process.exit(0);
}
for (const o of orphans) {
  console.log(`  orphan: row ${o.id} — "${o.data?.name}" — dead report_id ${o.data?.report_id} (page_path was ${o.data?.page_path})`);
}

if (!APPLY) {
  console.log(`\nDRY RUN — pass --apply to actually delete these ${orphans.length} row(s).`);
  process.exit(0);
}

let deleted = 0, failed = 0;
for (const o of orphans) {
  try {
    cli("raw", "delete", ENV.DMS_APP, CATALOG_SPLIT_TYPE, String(o.id));
    deleted++;
  } catch (err) {
    failed++;
    console.error(`  FAILED to delete ${o.id}: ${String(err).split("\n")[0].slice(0, 150)}`);
  }
}
console.log(`done — ${deleted} deleted, ${failed} failed.`);
