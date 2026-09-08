/**
 * Deletes an NPMRDS report page's `reports_snap_2` catalog row alongside the
 * page itself. dms-server's generic page-delete cascade (dms.controller.js's
 * cascadePageDelete) has no built-in knowledge of this relationship — it's
 * transportny/npmrds_sub-specific business data, not a DMS structural
 * concept — so it just dispatches here via DMS_PAGE_DELETE_HOOK.
 *
 * This same exported function is called for every deleted page row on every
 * app this server hosts, so the app check below is load-bearing, not a
 * defensive nicety.
 *
 * reports_snap_ids.json lives next to this file (rather than beside its other
 * consumers in scripts/npmrds-reports/) so it ships inside the Docker image
 * with the hook that needs it at server-boot runtime — see Dockerfile's
 * `COPY hooks ./hooks`. The dev-time consumers (convert_old_reports_lib's
 * config.py, report_build.mjs, prune_report_snap_orphans.mjs) read the same
 * file via a REPO-relative path instead.
 */
const path = require('path');
const {
  app: APP,
  reports_snap_source_id: REPORTS_SNAP_SOURCE_ID,
  reports_snap_view_id: REPORTS_SNAP_VIEW_ID,
} = require(path.join(__dirname, 'reports_snap_ids.json'));

const REPORTS_SNAP_TYPE = `reports_snap_2|${REPORTS_SNAP_VIEW_ID}:data`;

async function onPageDeleted(row, ctx) {
  if (row.app !== APP) return;

  const { dms_db, resolveTable, jsonField, dbType, splitMode } = ctx;
  const resolved = resolveTable(APP, REPORTS_SNAP_TYPE, dbType, splitMode, REPORTS_SNAP_SOURCE_ID);
  if (!resolved.table.startsWith('data_items__')) return;

  const deleted = await dms_db.promise(
    `DELETE FROM ${resolved.fullName} WHERE ${jsonField('data', 'report_id')} = $1 RETURNING id;`,
    [String(row.id)]
  );
  console.log(`[page-delete-hook] npmrds_report_page_delete: removed ${deleted.length} reports_snap_2 row(s) for page #${row.id}`);
}

module.exports = onPageDeleted;
