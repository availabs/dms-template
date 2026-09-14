/* TransportNY documentation — the docs tree and the docs sidebar renderer.
 *
 * ONE data structure (DOCS_TREE) drives: the sidebar on every docs page, the breadcrumb and prev/next links,
 * the lint (`_lint.mjs` checks every file here exists and every file in the folder is here), and later the
 * pattern build (`build_docs_pattern.mjs` creates one DMS page per entry) and the redirect map.
 *
 * It mirrors §08 of reports/platform-documentation-plan.html (95 pages after the owner dropped the legacy
 * page, 2026-09-04). Filenames: `<hub>--<slug>.html`, hubs are `<hub>.html`, the home is `index.html`.
 * `status`: 'planned' until a worker writes the page ('written'), then 'reviewed' after the orchestrator's
 * check-back. `type` is the page type from docs/STYLE.md §3. `ia` is the report's row number.
 *
 * Every docs page includes this once, after its markup:  <script src="_docs-nav.js"></script>
 * and has  <nav id="docsSidebar"></nav>  in the shell (see _template.html). Dual-use: in Node it exports
 * { DOCS_TREE } for the lint/build scripts.
 */
(function (root) {
  var P = function (f, t, type, ia, status) { return { f: f, t: t, type: type, ia: ia, status: status || 'planned' }; };
  var DOCS_TREE = [
    { key: 'home', label: 'Documentation', hub: 'index.html', status: 'reviewed', pages: [] },
    { key: 'start', label: 'Get started', hub: 'start.html', ia: 2, status: 'reviewed', pages: [
      P('start--what_is_transportny.html', 'What TransportNY is', 'concept', 3, 'reviewed'),
      P('start--accounts_and_sessions.html', 'Sign in, sessions and accounts', 'how-to', 4, 'reviewed'),
      P('start--navigating.html', 'Navigating the platform', 'how-to', 5, 'reviewed'),
      P('start--which_tool.html', 'Which tool answers my question?', 'reference', 6, 'reviewed'),
      P('start--faq.html', 'Platform FAQ', 'faq', 7, 'reviewed'),
    ]},
    { key: 'npmrds', label: 'NPMRDS', hub: 'npmrds.html', ia: 8, status: 'reviewed', pages: [
      P('npmrds--start.html', 'Start here: route → report → measure', 'start', 9, 'reviewed'),
      P('npmrds--routes--create.html', 'Create a route', 'how-to', 10, 'reviewed'),
      P('npmrds--routes--manage.html', 'Find, edit, tag and share routes', 'how-to', 11, 'reviewed'),
      P('npmrds--reports--start_from_template.html', 'Start a report from a template', 'how-to', 12, 'reviewed'),
      P('npmrds--reports--find.html', 'Find a report', 'how-to', 13, 'reviewed'),
      P('npmrds--reports--build.html', 'Build and edit a report', 'how-to', 14, 'reviewed'),
      P('npmrds--reports--share_and_print.html', 'Share, print and publish a report', 'how-to', 15, 'reviewed'),
      P('npmrds--reports--templates.html', 'Template reference', 'reference', 16, 'reviewed'),
      P('npmrds--reports--graph_types.html', 'Graph types reference', 'reference', 17, 'reviewed'),
      P('npmrds--macro_view.html', 'Macro View: how to use', 'how-to', 18, 'reviewed'),
      P('npmrds--macro_view--download.html', 'Download data from the Macro View', 'how-to', 19, 'reviewed'),
      P('npmrds--route_comparison.html', 'Compare routes across periods', 'how-to', 20, 'reviewed'),
      P('npmrds--segment.html', 'Look at one segment (TMC)', 'how-to', 21, 'reviewed'),
      P('npmrds--map21.html', 'MAP-21 PM3 reporting pages', 'how-to', 22, 'reviewed'),
      P('npmrds--recipes.html', 'Recipes', 'hub', 23, 'reviewed'),
      P('npmrds--recipes--composite_score.html', 'Recipe: a composite bottleneck score', 'recipe', 24, 'reviewed'),
      P('npmrds--recipes--congestion_management_process.html', 'Recipe: a Congestion Management Process', 'recipe', 25, 'reviewed'),
      P('npmrds--recipes--before_and_after.html', 'Recipe: a before/after study', 'recipe', 26, 'reviewed'),
      P('npmrds--faq.html', 'NPMRDS FAQ', 'faq', 28, 'reviewed'),
    ]},
    { key: 'tsmo', label: 'TSMO', hub: 'tsmo.html', ia: 29, status: 'reviewed', pages: [
      P('tsmo--start.html', 'Start here: a year, three numbers, a dashboard', 'start', 30, 'reviewed'),
      P('tsmo--filters.html', 'Using the filter bar', 'how-to', 31, 'reviewed'),
      P('tsmo--congestion.html', 'Congestion dashboard', 'screens', 32, 'reviewed'),
      P('tsmo--reliability.html', 'Reliability dashboard', 'screens', 33, 'reviewed'),
      P('tsmo--incidents.html', 'Incidents dashboard', 'screens', 34, 'reviewed'),
      P('tsmo--work_zones.html', 'Work Zones dashboard', 'screens', 35, 'reviewed'),
      P('tsmo--incident_search.html', 'Find an incident', 'how-to', 36, 'reviewed'),
      P('tsmo--incident_view.html', 'Read an incident page', 'how-to', 37, 'reviewed'),
      P('tsmo--corridor_view.html', 'Explore a corridor over time', 'how-to', 38, 'reviewed'),
      P('tsmo--faq.html', 'TSMO FAQ', 'faq', 39, 'reviewed'),
    ]},
    { key: 'freight_atlas', label: 'Freight Atlas', hub: 'freight_atlas.html', ia: 40, status: 'reviewed', pages: [
      P('freight_atlas--start.html', 'Start here: open a map, read it, share it', 'start', 41, 'reviewed'),
      P('freight_atlas--map.html', 'Use the map', 'how-to', 42, 'reviewed'),
      P('freight_atlas--gallery.html', 'Maps Gallery', 'how-to', 43, 'reviewed'),
      P('freight_atlas--layers.html', 'Layer reference', 'reference', 44, 'reviewed'),
      P('freight_atlas--downloads.html', 'Download freight data', 'how-to', 45, 'reviewed'),
      P('freight_atlas--the_plan.html', 'The 2024 State Freight Plan', 'concept', 46, 'reviewed'),
      P('freight_atlas--faq.html', 'Freight Atlas FAQ', 'faq', 47, 'reviewed'),
    ]},
    { key: 'measures_and_data', label: 'Measures & Data', hub: 'measures_and_data.html', ia: 48, status: 'reviewed', pages: [
      P('measures_and_data--federal_vs_analytical.html', 'Federal PM3 and what this site publishes', 'concept', 49, 'reviewed'),
      P('measures_and_data--which_measure.html', 'Which measure should I use?', 'reference', 50, 'reviewed'),
      P('measures_and_data--measures--lottr.html', 'LOTTR', 'measure', 51, 'reviewed'),
      P('measures_and_data--measures--tttr.html', 'TTTR', 'measure', 52, 'reviewed'),
      P('measures_and_data--measures--tttr80.html', 'TTTR₈₀', 'measure', 53, 'reviewed'),
      P('measures_and_data--measures--phed.html', 'PHED', 'measure', 54, 'reviewed'),
      P('measures_and_data--measures--ted.html', 'TED', 'measure', 55, 'reviewed'),
      P('measures_and_data--measures--percentile_speed.html', 'Percentile speed', 'measure', 56, 'reviewed'),
      P('measures_and_data--measures--coverage.html', 'Data coverage', 'measure', 57, 'reviewed'),
      P('measures_and_data--measures--excessive_delay.html', 'Excessive delay', 'measure', 58, 'reviewed'),
      P('measures_and_data--measures--delay_attribution.html', 'Delay attribution', 'measure', 59, 'reviewed'),
      P('measures_and_data--measures--cost_of_congestion.html', 'Cost of congestion', 'measure', 60, 'reviewed'),
      P('measures_and_data--measures--incident_delay_and_clearance.html', 'Incident delay and clearance', 'measure', 61, 'reviewed'),
      P('measures_and_data--measures--work_zone_delay.html', 'Work-zone delay', 'measure', 62, 'reviewed'),
      P('measures_and_data--measures--in_development.html', 'Measures in development', 'reference', 63, 'reviewed'),
      P('measures_and_data--measures--retired.html', 'Measures that used to be here', 'reference', 64, 'reviewed'),
      P('measures_and_data--concepts--peak_periods_and_epochs.html', 'Peak periods and epochs', 'concept', 65, 'reviewed'),
      P('measures_and_data--concepts--geography.html', 'Geography: regions, counties, MPOs, statewide', 'concept', 66, 'reviewed'),
      P('measures_and_data--concepts--tmc_network_and_vintages.html', 'The TMC network and its vintages', 'concept', 67, 'reviewed'),
      P('measures_and_data--concepts--aadt_and_vintage.html', 'AADT and its vintage', 'concept', 68, 'reviewed'),
      P('measures_and_data--concepts--coverage_eras_and_comparability.html', 'Coverage eras and comparability', 'concept', 69, 'reviewed'),
      P('measures_and_data--data--npmrds_travel_times.html', 'NPMRDS travel times', 'data', 70, 'reviewed'),
      P('measures_and_data--data--tmc_network.html', 'TMC network', 'data', 71, 'reviewed'),
      P('measures_and_data--data--pm3_and_map21.html', 'PM3 and MAP-21 datasets', 'data', 72, 'reviewed'),
      P('measures_and_data--data--transcom_events.html', 'TRANSCOM events', 'data', 73, 'reviewed'),
      P('measures_and_data--data--excessive_delay_series.html', 'Excessive-delay series', 'data', 74, 'reviewed'),
      P('measures_and_data--data--hpms_ris_attributes.html', 'HPMS / RIS attributes', 'data', 75, 'reviewed'),
      P('measures_and_data--data--routes_data.html', 'Routes data', 'data', 76, 'reviewed'),
      P('measures_and_data--data--freight_atlas_sources.html', 'Freight Atlas sources', 'data', 77, 'reviewed'),
      P('measures_and_data--coverage_and_freshness.html', 'Coverage and freshness', 'reference', 78, 'reviewed'),
      P('measures_and_data--methodology_changes.html', 'Methodology changes', 'log', 79, 'reviewed'),
    ]},
    { key: 'developers', label: 'Developers', hub: 'developers.html', ia: 80, status: 'reviewed', pages: [
      P('developers--quickstart.html', 'Quick start', 'start', 81, 'reviewed'),
      P('developers--data_manager_api.html', 'Data Manager API', 'reference', 82, 'reviewed'),
      P('developers--examples.html', 'Worked examples', 'how-to', 83, 'reviewed'),
      P('developers--downloads_and_formats.html', 'Bulk downloads and formats', 'reference', 84, 'reviewed'),
      P('developers--batch_reports_api.html', 'Batch Reports API', 'reference', 85, 'reviewed'),
      P('developers--changelog.html', 'API changelog', 'log', 86, 'reviewed'),
    ]},
    { key: 'admin', label: 'Admin', hub: 'admin.html', ia: 87, status: 'reviewed', pages: [
      P('admin--upload_data.html', 'Upload a dataset', 'how-to', 88, 'reviewed'),
      P('admin--manage_data.html', 'Manage a dataset', 'how-to', 89, 'reviewed'),
      P('admin--map_editor.html', 'Map Editor', 'how-to', 90, 'reviewed'),
      P('admin--add_map_to_page.html', 'Add a saved map to a page', 'how-to', 91, 'reviewed'),
      P('admin--map21_pm3_sources.html', 'Create the map21 / pm3 sources', 'how-to', 92, 'reviewed'),
      P('admin--users_and_permissions.html', 'Users and permissions', 'how-to', 93, 'reviewed'),
    ]},
    { key: 'utilities', label: 'Reference', hub: null, pages: [
      P('glossary.html', 'Glossary', 'glossary', 94, 'reviewed'),
      P('whats_new.html', "What's new", 'log', 95, 'reviewed'),
      P('help.html', 'Help and feedback', 'reference', 96, 'reviewed'),
    ]},
  ];

  // flat ordered list of every page (hubs included) for prev/next and lint
  function flat() {
    var out = [];
    DOCS_TREE.forEach(function (h) {
      if (h.hub) out.push({ f: h.hub, t: h.label, type: 'hub', ia: h.ia, hubKey: h.key, status: h.status || 'planned' });
      h.pages.forEach(function (p) { out.push({ f: p.f, t: p.t, type: p.type, ia: p.ia, hubKey: h.key, status: p.status }); });
    });
    return out;
  }

  root.DOCS_TREE = DOCS_TREE;
  root.docsFlat = flat;

  if (typeof module !== 'undefined' && module.exports) { module.exports = { DOCS_TREE: DOCS_TREE, docsFlat: flat }; return; }
  if (typeof document === 'undefined') return;

  // ── browser: render sidebar, breadcrumb, prev/next ──────────────────────────────
  var cur = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  var all = flat();
  var idx = -1; all.forEach(function (p, i) { if (p.f.toLowerCase() === cur) idx = i; });
  var curPage = idx >= 0 ? all[idx] : null;
  var curHub = curPage ? curPage.hubKey : 'home';

  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
  function sidebar() {
    var h = '';
    h += '<a class="docs-home' + (cur === 'index.html' ? ' active' : '') + '" href="index.html">Documentation</a>';
    DOCS_TREE.forEach(function (hub) {
      if (hub.key === 'home') return;
      var open = hub.key === curHub;
      h += '<div class="docs-hub' + (open ? ' open' : '') + '">';
      if (hub.hub) h += '<a class="docs-hub-label' + (cur === hub.hub ? ' active' : '') + '" href="' + hub.hub + '">' + esc(hub.label) + '</a>';
      else h += '<div class="docs-hub-label static">' + esc(hub.label) + '</div>';
      if (open || !hub.hub) {
        h += '<ul>';
        hub.pages.forEach(function (p) {
          var cls = (p.f.toLowerCase() === cur ? 'active ' : '') + (p.status === 'planned' ? 'planned' : '');
          h += '<li><a class="' + cls.trim() + '" href="' + p.f + '"' + (p.status === 'planned' ? ' title="not written yet"' : '') + '>' + esc(p.t) + '</a></li>';
        });
        h += '</ul>';
      }
      h += '</div>';
    });
    return h;
  }
  function crumbs() {
    if (!curPage || cur === 'index.html') return '';
    var hub = DOCS_TREE.filter(function (x) { return x.key === curHub; })[0];
    var h = '<a href="index.html">Docs</a>';
    if (hub && hub.hub && hub.hub !== cur) h += '<span class="sep">/</span><a href="' + hub.hub + '">' + esc(hub.label) + '</a>';
    else if (hub && !hub.hub) h += '<span class="sep">/</span><span>' + esc(hub.label) + '</span>';
    h += '<span class="sep">/</span><span class="here">' + esc(curPage.t) + '</span>';
    return h;
  }
  function prevnext() {
    if (idx < 0) return '';
    var h = '';
    var prev = idx > 0 ? all[idx - 1] : null, next = idx < all.length - 1 ? all[idx + 1] : null;
    h += prev ? '<a class="pn prev" href="' + prev.f + '"><span class="k">previous</span><span>' + esc(prev.t) + '</span></a>' : '<span></span>';
    h += next ? '<a class="pn next" href="' + next.f + '"><span class="k">next</span><span>' + esc(next.t) + '</span></a>' : '<span></span>';
    return h;
  }
  function mount() {
    var s = document.getElementById('docsSidebar'); if (s) s.innerHTML = sidebar();
    var b = document.getElementById('docsCrumbs'); if (b) b.innerHTML = crumbs();
    var pn = document.getElementById('docsPrevNext'); if (pn) pn.innerHTML = prevnext();
    // right rail: "on this page" from h2s
    var toc = document.getElementById('docsToc');
    if (toc) {
      var h2s = document.querySelectorAll('main h2[id]'), h = '';
      h2s.forEach(function (el) { h += '<a href="#' + el.id + '">' + esc(el.textContent) + '</a>'; });
      toc.innerHTML = h2s.length ? '<div class="k">on this page</div>' + h : '';
    }
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})(typeof globalThis !== 'undefined' ? globalThis : this);
