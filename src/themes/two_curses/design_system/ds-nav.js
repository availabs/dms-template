/* Two Curses design-system nav widget — shared, section-contextual.
 * Dev scaffolding only (never on a live DMS site). Every page includes it once,
 * just before </body>:  <script src="../ds-nav.js"></script>
 * Adding a page = one line in the section's `pages` array below.
 * The `design-system/` section is added when those five pages exist
 * (every href here must resolve to a real file).
 */
(function () {
  var VERSION = 'Two Curses DS · v0.1';
  var SECTIONS = [
    { key: 'public', label: 'Songbook', dir: 'pages', landing: 'home.html', pages: [
      { f: 'home.html',  t: 'home' },
      { f: 'poems.html', t: 'poems · contents' },
      { f: 'poem.html',  t: 'poem · The Night Was Left' },
    ]},
  ];

  var path = location.pathname.toLowerCase();
  var curFile = (path.split('/').pop() || 'index.html');
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
  scan(true); if (!current) scan(false); if (!current) current = SECTIONS[0];

  var up = new Array(current.dir.split('/').length + 1).join('../');
  function href(dir, file) { return up + dir + '/' + file; }

  var C = { ink: '#1E1B16', body: '#4A4238', muted: '#7A6A52', line: '#C6B58D', paper: '#F6EFDD', tint: '#EFE5CC', accent: '#8A2B1E' };
  var META = "font-family:'IM Fell English SC','EB Garamond',Georgia,serif;";
  var S = {
    head: META + 'display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;letter-spacing:0.1em;color:' + C.muted + ';padding:0 16px 8px;border-bottom:1px solid ' + C.line + ';margin-bottom:4px;',
    grp:  META + 'display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:11px;letter-spacing:0.12em;color:' + C.muted + ';padding:10px 16px 4px;',
    grp2: META + 'font-size:11px;letter-spacing:0.12em;color:' + C.muted + ';padding:10px 16px 4px;margin-top:6px;border-top:1px solid ' + C.line + ';',
    link: 'display:flex;align-items:center;gap:10px;padding:6px 16px;font-size:15px;color:' + C.body + ';text-decoration:none;',
    active: 'display:flex;align-items:center;gap:10px;padding:6px 16px;font-size:15px;color:' + C.accent + ';text-decoration:none;background:' + C.tint + ';',
    num: META + 'font-size:11px;color:' + C.line + ';min-width:16px;',
    numActive: META + 'font-size:11px;color:' + C.accent + ';min-width:16px;',
    sect: 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 16px;font-size:15px;color:' + C.body + ';text-decoration:none;',
    count: META + 'font-size:11px;color:' + C.muted + ';',
  };

  var html = '<div style="' + S.head + '"><span>' + VERSION + '</span></div>';
  html += '<div style="' + S.grp + '"><span>' + current.label + '</span><span style="' + S.count + '">' + current.pages.length + '</span></div>';
  current.pages.forEach(function (p, i) {
    var isCur = p === currentPage;
    html += '<a href="' + href(current.dir, p.f) + '" style="' + (isCur ? S.active : S.link) + '">' +
      '<span style="' + (isCur ? S.numActive : S.num) + '">' + (i + 1) + '</span>' + p.t + '</a>';
  });
  var others = SECTIONS.filter(function (s) { return s.key !== current.key; });
  if (others.length) {
    html += '<div style="' + S.grp2 + '">jump to section</div>';
    others.forEach(function (s) {
      html += '<a href="' + href(s.dir, s.landing) + '" style="' + S.sect + '"><span>' + s.label + '</span>' +
        '<span style="' + S.count + '">' + s.pages.length + ' &rarr;</span></a>';
    });
  }

  var wrap = document.createElement('div');
  wrap.id = 'dsWidget';
  wrap.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:9999;font-family:'EB Garamond',Georgia,serif;";
  wrap.innerHTML =
    '<div id="dsPanel" role="navigation" aria-label="Design system navigation" style="position:absolute;bottom:52px;right:0;background:' + C.paper + ';border:1px solid ' + C.line + ';outline:1px solid ' + C.line + ';outline-offset:3px;border-radius:2px;padding:12px 0;min-width:260px;max-height:72vh;overflow-y:auto;box-shadow:0 18px 40px -20px rgba(60,40,15,.5);opacity:0;transform:translateY(8px) scale(0.97);pointer-events:none;transition:opacity .15s,transform .15s;">' + html + '</div>' +
    '<button id="dsBtn" aria-label="Design system navigation" aria-expanded="false" style="width:40px;height:40px;border-radius:2px;background:' + C.ink + ';color:' + C.paper + ';border:1px solid ' + C.line + ';cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.25);">' +
      '<svg xmlns="http://www.w3.org/2000/svg" style="width:20px;height:20px;" viewBox="0 0 20 20" fill="currentColor"><path d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 10.5a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1-.75-.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Z"/></svg>' +
    '</button>';

  function mount() {
    document.body.appendChild(wrap);
    var panel = wrap.querySelector('#dsPanel'), btn = wrap.querySelector('#dsBtn');
    function set(open) {
      panel.style.opacity = open ? '1' : '0';
      panel.style.transform = open ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.97)';
      panel.style.pointerEvents = open ? 'auto' : 'none';
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    btn.addEventListener('click', function (e) { e.stopPropagation(); set(panel.style.opacity !== '1'); });
    document.addEventListener('click', function (e) { if (panel.style.opacity === '1' && !wrap.contains(e.target)) set(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
