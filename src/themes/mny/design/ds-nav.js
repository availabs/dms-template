/* MitigateNY design-system nav widget — shared, section-contextual.
 *
 * Dev scaffolding only (NOT production Layout chrome — never on a live DMS site).
 * Replaces the old per-page inline #dsWidget, which pasted a flat list of every
 * page into all 22 files and drifted out of sync page by page. Each page now
 * includes this once, just before </body>:
 *
 *     <script src="../ds-nav.js"></script>        (design-system/, pages/, reports/)
 *     <script src="../../ds-nav.js"></script>     (pages/county-actions/)
 *
 * On load it works out which page and which SECTION it is on from
 * location.pathname, then renders a floating panel that lists only THIS
 * section's pages (current one highlighted) plus one "jump to section" link per
 * other section, pointing at that section's landing page. The panel stays short
 * and every page is reachable in at most two hops.
 *
 * Adding a page = add one line to the section's `pages` array below.
 * `dir` is the page folder relative to this file (the design/ root); it may be
 * nested ('pages/county-actions'), and hrefs are recomputed from the current
 * page's depth, so no section needs to know where any other section sits.
 */
(function () {
  var VERSION = 'MitigateNY DS · v1.1';

  var SECTIONS = [
    { key: 'ds', label: 'Design System', dir: 'design-system', landing: 'theme.html', pages: [
      { f: 'theme.html', t: 'theme tokens' }, { f: 'layouts.html', t: 'layouts' },
      { f: 'grid.html', t: 'grid' }, { f: 'components.html', t: 'components' },
      { f: 'patterns.html', t: 'patterns' },
    ]},
    { key: 'public', label: 'Public Site', dir: 'pages', landing: 'home.html', pages: [
      { f: 'home.html', t: 'home' }, { f: 'home-v2.html', t: 'home · v2' },
      { f: 'section-landing.html', t: 'section landing' },
    ]},
    { key: 'actions', label: 'Actions (Statewide)', dir: 'pages', landing: 'actions-dashboard.html', pages: [
      { f: 'actions-dashboard.html', t: 'dashboard' },
      { f: 'actions-prioritize.html', t: 'prioritize · list' },
      { f: 'actions-prioritization.html', t: 'prioritize · cards' },
      { f: 'actions-location-overview.html', t: 'location overview' },
    ]},
    { key: 'county', label: 'County Actions Workflow', dir: 'pages/county-actions', landing: 'dashboard.html', pages: [
      { f: 'dashboard.html', t: 'county dashboard' }, { f: 'jurisdictions.html', t: 'jurisdictions' },
      { f: 'jurisdiction-prioritization.html', t: 'jurisdiction prioritization' },
      { f: 'workspace.html', t: 'county workspace' }, { f: 'action-view.html', t: 'action view' },
      { f: 'action-edit.html', t: 'action edit' },
    ]},
    { key: 'panel', label: 'Admin Panel', dir: 'pages', landing: 'admin-forms.html', pages: [
      { f: 'admin-forms.html', t: 'plan data · task view' },
      { f: 'admin-forms-insights.html', t: 'plan data · insight view' },
      { f: 'admin-forms-lisa-frank.html', t: 'plan data · lisa frank 🐬' },
      { f: 'admin-home.html', t: 'panel home' },
      { f: 'plan-status-dashboard.html', t: 'plan status' },
    ]},
    { key: 'admin', label: 'Site Management', dir: 'pages', landing: 'site-management-v2.html', pages: [
      { f: 'site-management-v2.html', t: 'site management · v2' },
      { f: 'site-management.html', t: 'site management' },
      { f: 'pattern-creation-flow.html', t: 'pattern creation flow' },
    ]},
    { key: 'authoring', label: 'Authoring Reference', dir: 'pages', landing: 'page-templates.html', pages: [
      { f: 'page-templates.html', t: 'page templates' },
      { f: 'page-templates-data.html', t: 'templates · data-driven' },
      { f: 'page-template-layouts.html', t: 'template layouts' },
      { f: 'column-types.html', t: 'column types' },
      { f: 'datasets-files.html', t: 'datasets · files' },
    ]},
    { key: 'lhmpadmin', label: 'LHMP Admin', dir: 'pages/lhmp-admin', landing: 'plan-status-admin.html', pages: [
      { f: 'plan-status-admin.html', t: 'plan status · admin panel' },
      { f: 'plan-status-plan.html', t: 'plan status · in the plan' },
    ]},
    { key: 'reports', label: 'Reports', dir: 'reports', landing: 'actions-qa.html', pages: [
      { f: 'actions-qa.html', t: 'actions data quality' },
      { f: 'duplicate-actions.html', t: 'duplicate actions' },
      { f: 'boilerplate-actions.html', t: 'boilerplate actions' },
      { f: 'location-from-text.html', t: 'locating from text' },
      { f: 'priority-coverage.html', t: 'local priority coverage' },
      { f: 'capabilities-vs-capacity.html', t: 'capabilities vs capacity' },
      { f: 'capability-inventory.html', t: 'capability inventory' },
      { f: 'capacity-assessment-architecture.html', t: 'capacity assessment architecture' },
      { f: 'state-capability-catalog.html', t: 'state capability catalog' },
      { f: 'admin-panel-information-architecture.html', t: 'admin panel IA (july)' },
      { f: 'admin-workflow-current-state.html', t: 'admin review 1 · current state' },
      { f: 'admin-direction-consolidate.html', t: 'admin review 2 · direction A' },
      { f: 'admin-direction-dissolve.html', t: 'admin review 3 · direction B' },
    ]},
  ];

  var path = location.pathname.toLowerCase();
  var curFile = (path.split('/').pop() || 'index.html');

  // Which section owns the current page? Prefer a full dir+file match so a
  // filename reused across folders (dashboard.html) resolves to the right one.
  var current = null, currentPage = null;
  function scan(matchDir) {
    for (var i = 0; i < SECTIONS.length; i++) {
      var s = SECTIONS[i];
      for (var j = 0; j < s.pages.length; j++) {
        var p = s.pages[j];
        var hit = matchDir
          ? path.indexOf('/' + s.dir.toLowerCase() + '/' + p.f.toLowerCase()) !== -1
          : p.f.toLowerCase() === curFile;
        if (hit) { current = s; currentPage = p; return; }
      }
    }
  }
  scan(true);
  if (!current) scan(false);
  if (!current) current = SECTIONS[0]; // unlisted page: show the DS section, nothing active

  // The current folder's depth below the design/ root, from the section table
  // rather than from the URL — so this works under any server mount point.
  var up = new Array(current.dir.split('/').length + 1).join('../');
  function href(dir, file) { return up + dir + '/' + file; }

  var C = { ink: '#2D3E4C', body: '#37576B', muted: '#6D96AE', line: '#E0EBF0', faint: '#C5D7E0', accent: '#EAAD43' };
  var OSWALD = "font-family:'Oswald',sans-serif;";
  var S = {
    head: OSWALD + 'display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.08em;color:' + C.muted + ';padding:0 16px 8px;border-bottom:1px solid ' + C.line + ';margin-bottom:4px;',
    grp:  OSWALD + 'display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:0.1em;color:' + C.muted + ';padding:10px 16px 4px;',
    grp2: OSWALD + 'font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:0.1em;color:' + C.muted + ';padding:10px 16px 4px;margin-top:6px;border-top:1px solid ' + C.line + ';',
    link: 'display:flex;align-items:center;gap:8px;padding:6px 16px;font-size:13px;font-weight:500;color:' + C.body + ';text-decoration:none;',
    active: 'display:flex;align-items:center;gap:8px;padding:6px 16px;font-size:13px;font-weight:600;color:' + C.accent + ';text-decoration:none;background:#FCF6EC;',
    num: 'font-size:10px;font-weight:500;color:' + C.faint + ';min-width:14px;',
    numActive: 'font-size:10px;font-weight:600;color:' + C.accent + ';min-width:14px;',
    sect: 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 16px;font-size:13px;font-weight:500;color:' + C.body + ';text-decoration:none;',
    count: OSWALD + 'font-size:10px;color:' + C.faint + ';',
  };

  var html = '<div style="' + S.head + '"><span>' + VERSION + '</span></div>';

  // 1 — the current section, expanded
  html += '<div style="' + S.grp + '"><span>' + current.label + '</span>' +
    '<span style="' + S.count + '">' + current.pages.length + '</span></div>';
  current.pages.forEach(function (p, i) {
    var isCur = p === currentPage;
    html += '<a href="' + href(current.dir, p.f) + '" style="' + (isCur ? S.active : S.link) + '">' +
      '<span style="' + (isCur ? S.numActive : S.num) + '">' + (i + 1) + '</span>' + p.t + '</a>';
  });

  // 2 — one link per other section, to its landing page
  html += '<div style="' + S.grp2 + '">jump to section</div>';
  SECTIONS.forEach(function (s) {
    if (s.key === current.key) return;
    html += '<a href="' + href(s.dir, s.landing) + '" style="' + S.sect + '">' +
      '<span>' + s.label + '</span>' +
      '<span style="' + S.count + 'color:' + C.faint + ';">' + s.pages.length + ' &rarr;</span></a>';
  });

  var wrap = document.createElement('div');
  wrap.id = 'dsWidget';
  wrap.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:9999;font-family:'Source Sans 3',system-ui,sans-serif;";
  wrap.innerHTML =
    '<div id="dsPanel" role="navigation" aria-label="Design system navigation" style="position:absolute;bottom:52px;right:0;background:white;border-radius:12px;padding:12px 0;min-width:250px;max-height:72vh;overflow-y:auto;box-shadow:0 0 4px 0 rgba(0,0,0,.04),0 4px 20px 0 rgba(0,0,0,.12);opacity:0;transform:translateY(8px) scale(0.95);pointer-events:none;transition:opacity .15s,transform .15s;">' + html + '</div>' +
    '<button id="dsBtn" aria-label="Design system navigation" aria-expanded="false" style="width:40px;height:40px;border-radius:12px;background:' + C.ink + ';color:white;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.15);">' +
      '<svg xmlns="http://www.w3.org/2000/svg" style="width:20px;height:20px;" viewBox="0 0 20 20" fill="currentColor"><path d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 10.5a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1-.75-.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Z"/></svg>' +
    '</button>';

  function mount() {
    document.body.appendChild(wrap);
    var panel = wrap.querySelector('#dsPanel');
    var btn = wrap.querySelector('#dsBtn');
    function set(open) {
      panel.style.opacity = open ? '1' : '0';
      panel.style.transform = open ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.95)';
      panel.style.pointerEvents = open ? 'auto' : 'none';
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      set(panel.style.opacity !== '1');
    });
    document.addEventListener('click', function (e) {
      if (panel.style.opacity === '1' && !wrap.contains(e.target)) set(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') set(false);
    });
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
