/* WCDB design-system nav widget — shared, section-contextual.
 *
 * Dev scaffolding only (NOT production Layout chrome — never on a live DMS
 * site, and never translated into wcdb_theme.js). Replaces the old per-page
 * inline `.wcdb-meta-nav` strip, which pasted a flat list of every page into
 * all 14 files and had to be re-edited in 14 places whenever a page was added.
 * Each page now includes this once, just before </body>:
 *
 *     <script src="../ds-nav.js"></script>        (design-system/, pages/)
 *     <script src="../../ds-nav.js"></script>     (any future nested folder)
 *
 * On load it works out which page and which SECTION it is on from
 * location.pathname, then renders a floating panel listing only THIS section's
 * pages (current one highlighted in the on-air accent) plus one "jump to
 * section" link per other section, pointing at that section's landing page.
 * The panel stays short and every page is reachable in at most two hops.
 *
 * Adding a page = add one line to the section's `pages` array below, plus the
 * script tag on the new page. Nothing else. Then re-run
 * `node scripts/verify-nav.mjs` to confirm every href resolves.
 *
 * `dir` is the page folder relative to this file (the deliverable root); it may
 * be nested, and hrefs are recomputed from the current section's depth, so the
 * links hold whether the folder is served at the root, under a subpath, or
 * opened straight off disk via file://.
 *
 * See src/dms/skills/designing-a-dms-design-system.md §7.0.2.
 */
(function () {
  var VERSION = 'WCDB DS · v0.2';

  var SECTIONS = [
    { key: 'ds', label: 'Design System', dir: 'design-system', landing: 'theme.html', pages: [
      { f: 'theme.html', t: 'theme tokens' },
      { f: 'layouts.html', t: 'layouts' },
      { f: 'grid.html', t: 'grid' },
      { f: 'components.html', t: 'components' },
      { f: 'patterns.html', t: 'patterns' },
    ]},
    { key: 'station', label: 'Station Site', dir: 'pages', landing: 'home.html', pages: [
      { f: 'home.html', t: 'home' },
      { f: 'station-info.html', t: 'station info' },
      { f: 'schedule.html', t: 'schedule' },
      { f: 'show.html', t: 'show' },
      { f: 'djs.html', t: 'djs' },
      { f: 'spins.html', t: 'spins' },
      { f: 'blog.html', t: 'blog' },
      { f: 'events.html', t: 'events' },
      { f: 'login.html', t: 'login' },
    ]},
    { key: 'admin', label: 'Station Admin', dir: 'pages/admin', landing: 'djs.html', pages: [
      { f: 'djs.html', t: 'dj roster' },
      { f: 'dj-profile.html', t: 'dj profile' },
      { f: 'schedule.html', t: 'schedule editor' },
    ]},
  ];

  var path = location.pathname.toLowerCase();
  var curFile = (path.split('/').pop() || 'index.html');

  // Which section owns the current page? Prefer a full dir+file match so a
  // filename reused across folders resolves to the right section; fall back to
  // the bare filename for odd mount points.
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

  // Depth comes from the SECTION TABLE, not the URL, so this holds under any
  // mount point (server root, subpath, or file://).
  var up = new Array(current.dir.split('/').length + 1).join('../');
  function href(dir, file) { return up + dir + '/' + file; }

  /* Brand constants, hard-coded rather than read from _shared.css: the widget
   * must render correctly regardless of stylesheet load order or MIME issues.
   * WCDB is dark-first, so the panel is the dark card surface in both page
   * modes — a dark chip reads fine over the light-mode page bg. */
  var C = {
    panel: '#1f2122', shell: '#0a0a0a',
    ink: '#f5f5f5', body: '#c8c8c8', muted: '#8a8a8a', faint: '#5a5a5a',
    line: 'rgba(255,255,255,0.10)',
    accent: '#ff3b2f', accentSoft: 'rgba(255,59,47,0.12)',
  };
  var MONO = "font-family:'Geist Mono',ui-monospace,'SF Mono',monospace;";
  var S = {
    head: MONO + 'display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:0.12em;color:' + C.muted + ';padding:0 16px 10px;border-bottom:1px solid ' + C.line + ';margin-bottom:6px;',
    grp:  MONO + 'display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:9px;font-weight:500;text-transform:uppercase;letter-spacing:0.14em;color:' + C.muted + ';padding:8px 16px 4px;',
    grp2: MONO + 'font-size:9px;font-weight:500;text-transform:uppercase;letter-spacing:0.14em;color:' + C.muted + ';padding:10px 16px 4px;margin-top:8px;border-top:1px solid ' + C.line + ';',
    link: 'display:flex;align-items:center;gap:10px;padding:6px 16px;font-size:13px;font-weight:400;color:' + C.body + ';text-decoration:none;',
    active: 'display:flex;align-items:center;gap:10px;padding:6px 16px;font-size:13px;font-weight:500;color:' + C.accent + ';text-decoration:none;background:' + C.accentSoft + ';',
    num: MONO + 'font-size:10px;font-weight:400;color:' + C.faint + ';min-width:14px;',
    numActive: MONO + 'font-size:10px;font-weight:500;color:' + C.accent + ';min-width:14px;',
    sect: 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 16px;font-size:13px;font-weight:400;color:' + C.body + ';text-decoration:none;',
    count: MONO + 'font-size:10px;color:' + C.faint + ';',
  };

  var html = '<div style="' + S.head + '"><span>' + VERSION + '</span></div>';

  // 1 — the current section, expanded
  html += '<div style="' + S.grp + '"><span>' + current.label + '</span>' +
    '<span style="' + S.count + '">' + current.pages.length + '</span></div>';
  current.pages.forEach(function (p, i) {
    var isCur = p === currentPage;
    html += '<a href="' + href(current.dir, p.f) + '" style="' + (isCur ? S.active : S.link) + '"' +
      (isCur ? ' aria-current="page"' : '') + '>' +
      '<span style="' + (isCur ? S.numActive : S.num) + '">' + (i + 1) + '</span>' + p.t + '</a>';
  });

  // 2 — one link per other section, to its landing page
  html += '<div style="' + S.grp2 + '">jump to section</div>';
  SECTIONS.forEach(function (s) {
    if (s.key === current.key) return;
    html += '<a href="' + href(s.dir, s.landing) + '" style="' + S.sect + '">' +
      '<span>' + s.label + '</span>' +
      '<span style="' + S.count + '">' + s.pages.length + ' &rarr;</span></a>';
  });

  var wrap = document.createElement('div');
  wrap.id = 'dsWidget';
  wrap.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:9999;font-family:'Geist',ui-sans-serif,system-ui,sans-serif;";
  wrap.innerHTML =
    '<div id="dsPanel" role="navigation" aria-label="Design system navigation" style="position:absolute;bottom:52px;right:0;background:' + C.panel + ';border:1px solid ' + C.line + ';border-radius:14px;padding:14px 0;min-width:250px;max-height:72vh;overflow-y:auto;box-shadow:0 0 4px 0 rgba(0,0,0,.20),0 12px 32px 0 rgba(0,0,0,.45);opacity:0;transform:translateY(8px) scale(0.95);pointer-events:none;transition:opacity .15s,transform .15s;">' + html + '</div>' +
    '<button id="dsBtn" aria-label="Design system navigation" aria-expanded="false" style="width:40px;height:40px;border-radius:14px;background:' + C.shell + ';color:' + C.ink + ';border:1px solid ' + C.line + ';cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,0.35);">' +
      '<svg xmlns="http://www.w3.org/2000/svg" style="width:18px;height:18px;" viewBox="0 0 20 20" fill="currentColor"><path d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 10.5a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1-.75-.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Z"/></svg>' +
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
