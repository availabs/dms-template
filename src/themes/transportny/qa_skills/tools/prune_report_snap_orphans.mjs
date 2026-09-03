// Prune orphaned `reports_snap_2` catalog rows — a real, currently-recurring bug: the generic
// "Delete Page" admin action does not cascade to this dataset (same root cause
// ReportPickerModal/useReportSearch.js's `checkIdsExist` band-aid was built for, 2026-09-01 —
// see that file's own comment). Deleting a report page leaves its `reports_snap_2` catalog row
// behind, pointing at a `report_id` that no longer resolves to any real page. The picker modal
// hides these live, per-search, via a runtime existence check (`checkIdsExist`); the native
// `Spreadsheet`-based "All reports" list page (npmrds-all-reports-list-page.md) has no
// equivalent runtime hook — it is a plain SQL query with no per-row cross-table check available
// — so orphans need to be pruned at the DATA layer instead. Run this whenever the list page
// looks like it's showing dead rows, or periodically as a maintenance task, until "Delete Page"
// itself cascades to this dataset (a deeper platform fix, out of scope here).
//
// DRY BY DEFAULT — prints what it would delete and exits. Pass --apply to actually delete.
//
// Usage (from dms-template root):
//   export DMS_AUTH_TOKEN=$(node src/dms/packages/dms/cli/bin/mint-token.mjs \
//     --host https://dmsserver.availabs.org --project npmrdsv5 --email availabs@gmail.com --password test123)
//   node src/themes/transportny/qa_skills/tools/prune_report_snap_orphans.mjs           # dry run
//   node src/themes/transportny/qa_skills/tools/prune_report_snap_orphans.mjs --apply   # actually delete
import { execFileSync } from "node:child_process";

const APPLY = process.argv.includes("--apply");
const ENV = {
  ...process.env,
  DMS_HOST: process.env.DMS_HOST || "https://dmsserver.availabs.org",
  DMS_APP: process.env.DMS_APP || "npmrdsv5",
  DMS_TYPE: process.env.DMS_TYPE || "dev2",
};
const CLI = "src/dms/packages/dms/cli/bin/dms.js";
const PATTERN = "npmrds_sub";
// The `reports_snap_2` catalog binding — same source/view every report page and picker reads
// (reportCatalogSource.js, build_npmrds_reports.mjs, build_npmrds_reports_list.mjs).
const CATALOG_SOURCE_ID = 2177438;
const CATALOG_VIEW_ID = 2177440;
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
