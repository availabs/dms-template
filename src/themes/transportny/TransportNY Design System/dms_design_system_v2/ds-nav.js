/* TransportNY design-system nav widget — shared, section-contextual.
 *
 * Dev scaffolding only (NOT production Layout chrome — never on a live DMS site).
 * Replaces the old per-page inline #dsWidget. Each page includes this once:
 *     <script src="../ds-nav.js"></script>
 * On load it detects the current page + section from location.pathname and
 * renders a floating panel that lists THIS section's pages (current highlighted)
 * plus "jump to section" links to every other section's landing page — so the
 * panel stays short while still reaching every page in two hops.
 *
 * Adding a page = add one line to the section's `pages` array below.
 * `dir` is 'pages' or 'design-system' (the two folders under the design-system
 * root); hrefs are computed relative to whichever folder the current page is in.
 */
(function () {
  var SECTIONS = [
    { key: 'ds', label: 'Design System', landing: 'theme.html', dir: 'design-system', pages: [
      { f: 'theme.html', t: 'theme' }, { f: 'layouts.html', t: 'layouts' },
      { f: 'grid.html', t: 'grid' }, { f: 'components.html', t: 'components' },
      { f: 'patterns.html', t: 'patterns' },
    ]},
    { key: 'platform', label: 'Platform', landing: 'landing.html', dir: 'pages', pages: [
      { f: 'landing.html', t: 'landing' }, { f: 'login.html', t: 'login' },
      { f: 'getting-started.html', t: 'getting-started' }, { f: 'docs-overview.html', t: 'docs-overview' },
    ]},
    { key: 'map21', label: 'MAP-21', landing: 'map-21.html', dir: 'pages', pages: [
      { f: 'map-21.html', t: 'overview' }, { f: 'map-21-system-performance.html', t: 'system performance' },
      { f: 'map-21-trend.html', t: 'trend' },
    ]},
    { key: 'explorers', label: 'Explorers', landing: 'congestion.html', dir: 'pages', pages: [
      { f: 'congestion.html', t: 'congestion' }, { f: 'work-zones.html', t: 'work-zones' },
      { f: 'floating-car.html', t: 'floating-car' }, { f: 'employment-estimates.html', t: 'employment-estimates' },
      { f: 'employment-estimates-mpo.html', t: 'employment · mpo' }, { f: 'lehd-od.html', t: 'lehd-od' },
    ]},
    { key: 'fa', label: 'Freight Atlas', landing: 'freight-atlas-home.html', dir: 'pages', pages: [
      { f: 'freight-atlas-home.html', t: 'home' }, { f: 'freight-atlas-map.html', t: 'map' },
      { f: 'freight-atlas-gallery.html', t: 'gallery' }, { f: 'freight-atlas-insights.html', t: 'insights' },
      { f: 'freight-atlas-data.html', t: 'data' }, { f: 'freight-atlas-dataset.html', t: 'dataset' },
      { f: 'freight-atlas-about.html', t: 'about' },
    ]},
    { key: 'tsmo', label: 'TSMO', landing: 'tsmo-home.html', dir: 'pages', pages: [
      { f: 'tsmo-home.html', t: 'home' }, { f: 'tsmo-congestion.html', t: 'congestion' },
      { f: 'tsmo-reliability.html', t: 'reliability' }, { f: 'tsmo-incidents.html', t: 'incidents' },
      { f: 'tsmo-workzones.html', t: 'work zones' }, { f: 'tsmo-incident-search.html', t: 'incident search' },
      { f: 'tsmo-incident-view.html', t: 'incident view' }, { f: 'tsmo-corridor.html', t: 'corridor view' },
      { f: 'tsmo-about.html', t: 'about' }, { f: 'tsmo-methodology.html', t: 'methodology' },
    ]},
    { key: 'sm', label: 'Site Management', landing: 'sitemgmt-overview.html', dir: 'pages', pages: [
      { f: 'sitemgmt-overview.html', t: 'control room' }, { f: 'sitemgmt-tickets.html', t: 'tickets' },
      { f: 'sitemgmt-ticket.html', t: 'ticket detail' }, { f: 'sitemgmt-page.html', t: 'page QA detail' },
      { f: 'sitemgmt-design.html', t: 'design review' },
    ]},
    { key: 'ds2', label: 'Datasets', landing: 'datasets-catalog.html', dir: 'pages', pages: [
      { f: 'datasets-catalog.html', t: 'data catalog' }, { f: 'datasets-source.html', t: 'source · overview' },
    ]},
  ];

  // current page + folder
  var path = location.pathname;
  var curFile = (path.split('/').pop() || 'index.html').toLowerCase();
  var curDir = path.indexOf('/design-system/') !== -1 ? 'design-system' : 'pages';

  // href to (dir,file) relative to the current folder (pages/ and design-system/
  // are siblings under the root, so a cross-folder hop is one '../').
  function href(dir, file) {
    return dir === curDir ? file : '../' + dir + '/' + file;
  }

  // which section owns the current page (match by file, prefer same dir)
  var current = null;
  for (var i = 0; i < SECTIONS.length; i++) {
    var s = SECTIONS[i];
    for (var j = 0; j < s.pages.length; j++) {
      if (s.pages[j].f.toLowerCase() === curFile && s.dir === curDir) { current = s; break; }
    }
    if (current) break;
  }
  if (!current) { // fallback: match by file regardless of dir, else first section
    for (var k = 0; k < SECTIONS.length && !current; k++)
      for (var m = 0; m < SECTIONS[k].pages.length; m++)
        if (SECTIONS[k].pages[m].f.toLowerCase() === curFile) { current = SECTIONS[k]; break; }
    if (!current) current = SECTIONS[0];
  }

  var S = {
    head: 'font-family:Oswald,sans-serif;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;padding:0 16px 8px;border-bottom:1px solid #e2e8f0;margin-bottom:4px;',
    grp:  'font-family:Oswald,sans-serif;font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;padding:8px 16px 4px;',
    link: 'display:flex;align-items:center;gap:8px;padding:6px 16px;font-size:13px;font-weight:500;color:#334155;text-decoration:none;',
    active: 'display:flex;align-items:center;gap:8px;padding:6px 16px;font-size:13px;font-weight:600;color:#CA8A04;text-decoration:none;',
    sect: 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 16px;font-size:13px;font-weight:500;color:#334155;text-decoration:none;',
  };

  var html = '<div style="' + S.head + '">TransportNY DMS · v0.2</div>';
  // current section, expanded
  html += '<div style="' + S.grp + '">' + current.label + '</div>';
  current.pages.forEach(function (p) {
    var isCur = p.f.toLowerCase() === curFile;
    html += '<a href="' + href(current.dir, p.f) + '" style="' + (isCur ? S.active : S.link) + '">' + p.t + '</a>';
  });
  // jump to other sections
  html += '<div style="' + S.grp + '">jump to section</div>';
  SECTIONS.forEach(function (s) {
    if (s.key === current.key) return;
    html += '<a href="' + href(s.dir, s.landing) + '" style="' + S.sect + '"><span>' + s.label +
      '</span><span style="color:#cbd5e1;">&rarr;</span></a>';
  });

  var wrap = document.createElement('div');
  wrap.id = 'dsWidget';
  wrap.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:9999;font-family:'Source Sans 3',system-ui,sans-serif;";
  wrap.innerHTML =
    '<div id="dsPanel" style="position:absolute;bottom:52px;right:0;background:white;border-radius:10px;padding:12px 0;min-width:230px;max-height:72vh;overflow-y:auto;box-shadow:0 4px 20px rgba(0,0,0,0.12);opacity:0;transform:translateY(8px) scale(0.95);pointer-events:none;transition:opacity .15s,transform .15s;">' + html + '</div>' +
    '<button id="dsBtn" aria-label="Design system navigation" style="width:40px;height:40px;border-radius:10px;background:#12181F;color:white;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.15);">' +
      '<svg xmlns="http://www.w3.org/2000/svg" style="width:20px;height:20px;" viewBox="0 0 20 20" fill="currentColor"><path d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 10.5a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1-.75-.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Z"/></svg>' +
    '</button>';

  function mount() {
    document.body.appendChild(wrap);
    var panel = wrap.querySelector('#dsPanel');
    wrap.querySelector('#dsBtn').addEventListener('click', function () {
      var open = panel.style.opacity === '1';
      panel.style.opacity = open ? '0' : '1';
      panel.style.transform = open ? 'translateY(8px) scale(0.95)' : 'translateY(0) scale(1)';
      panel.style.pointerEvents = open ? 'none' : 'auto';
    });
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
