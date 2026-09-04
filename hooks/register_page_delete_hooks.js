/**
 * Bootstrap entry point for app-owned page-delete side effects.
 *
 * dms-server loads this file at boot via the DMS_PAGE_DELETE_HOOK env var and
 * calls its default export as the one page-delete hook (see
 * dms.controller.js's cascadePageDelete). Mirrors register-datatypes.js's
 * role for data-types/ plugins: dms-server itself, and the Dockerfile that
 * points at this file, never see a project-specific name — only the list
 * below (and whatever it requires) does.
 *
 * Each handler is required INDEPENDENTLY and invoked in its own try/catch, so
 * one broken/throwing handler can't take another down with it — same
 * reasoning as register-datatypes.js's own header comment.
 */
const HANDLERS = [
  ['npmrds_report_page_delete', './npmrds_report_page_delete_hook'],
];

const loaded = [];
for (const [name, modulePath] of HANDLERS) {
  try {
    loaded.push([name, require(modulePath)]);
  } catch (e) {
    console.error(`[page-delete-hook] SKIPPED ${name} (${modulePath}): ${e.message}`);
  }
}

module.exports = async function onPageDeleted(row, ctx) {
  for (const [name, handler] of loaded) {
    try {
      await handler(row, ctx);
    } catch (e) {
      console.error(`[page-delete-hook] ${name} failed for ${row.app}/${row.type}#${row.id}: ${e.message}`);
    }
  }
};
