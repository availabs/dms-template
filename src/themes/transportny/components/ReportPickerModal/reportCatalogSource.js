// The reports catalog (`reports_snap_2`, source 2177438 / view 2177440) — the same dataset
// backing the /reports homepage's AVAIL-curated Card grid (converted_reports/reports, page
// 2208581) and the earlier find-a-report dialog prototype (converted_reports, page 2188366,
// section 2214393). Real column names/types confirmed live via that section's `externalSource`
// (`dms raw get 2214393`, 2026-08-25) — the full source has 18 columns; this only DECLARES the
// ones the picker actually needs (fetchCatalogRows.js fetches every declared column, and several
// of the omitted ones are large JSON blobs — `route_comps`/`graph_comps`/`station_comps`/
// `routes`/`thumbnail`/`pic` — no reason to pull those over the wire for a search/list view).
// `tags` is deliberately omitted too: fetchCatalogRows.js force-injects it into every query
// regardless of what's declared here, so there's nothing to gain by listing it. `app` is filled
// in by the caller from CMSContext/PageContext rather than hardcoded.
export function buildReportCatalogSource(app) {
  return {
    app,
    name: 'reports_snap_2',
    default_columns: null,
    source_id: 2177438,
    view_id: 2177440,
    view_name: 'version 1',
    env: `${app}+reports_snap_2`,
    srcEnv: `${app}+datasets`,
    isDms: true,
    baseUrl: '/forms',
    type: 'reports_snap_2',
    columns: [
      { name: 'report_id', display_name: 'report_id', options: null, required: false, source_id: 2177438, type: 'text' },
      { name: 'name', display_name: 'name', options: null, required: false, source_id: 2177438, type: 'text' },
      { name: 'description', display_name: 'description', options: null, required: false, source_id: 2177438, type: 'text' },
      { name: 'created_by', display_name: 'created_by', options: null, required: false, source_id: 2177438, type: 'text' },
      { name: 'created_at', display_name: 'created_at', options: null, required: false, source_id: 2177438, type: 'text' },
      { name: 'updated_at', display_name: 'updated_at', options: null, required: false, source_id: 2177438, type: 'text' },
      { name: 'graph_count', display_name: 'graph_count', options: null, required: false, source_id: 2177438, type: 'number' },
      { name: 'page_path', display_name: 'page_path', options: null, required: false, source_id: 2177438, type: 'text' },
    ],
  };
}
