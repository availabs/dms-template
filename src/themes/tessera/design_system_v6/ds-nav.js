/* ═══════════════════════════════════════════════════════════════════════
   Tessera Design System v6 — shared floating navigation widget
   Documentation scaffolding only; never ships on a live DMS site.

   Every page in design-system/ and pages/ includes, before </body>:
       <script src="../ds-nav.js"></script>

   To add a page to the widget, add ONE { f, t } line to the relevant
   SECTIONS[].pages array below. Do not hand-edit per-page widgets.

   The widget reads the v6 CSS custom properties, so it follows the
   page's light/dark mode automatically.
   ═══════════════════════════════════════════════════════════════════════ */

(function () {
  var SECTIONS = [
    {
      key: "ds",
      label: "Design system",
      dir: "design-system",
      landing: "theme.html",
      pages: [
        { f: "theme.html", t: "Theme — tokens" },
        { f: "layouts.html", t: "Layouts — page chrome" },
        { f: "grid.html", t: "Grid — the sheet" },
        { f: "components.html", t: "Components" },
        { f: "patterns.html", t: "Patterns" },
      ],
    },
    {
      key: "pages",
      label: "Example pages",
      dir: "pages",
      landing: "beta-landing.html",
      pages: [
        { f: "beta-landing.html", t: "Beta landing" },
        { f: "features.html", t: "Features" },
        { f: "docs.html", t: "Docs landing" },
      ],
    },
  ];

  var path = location.pathname;
  var curFile = path.split("/").pop() || "";
  var curDir = path.indexOf("/design-system/") !== -1 ? "design-system" : "pages";

  function href(dir, file) {
    return dir === curDir ? file : "../" + dir + "/" + file;
  }

  var current = null;
  for (var i = 0; i < SECTIONS.length; i++) {
    var s = SECTIONS[i];
    for (var j = 0; j < s.pages.length; j++) {
      if (s.pages[j].f === curFile && s.dir === curDir) current = s;
    }
  }
  if (!current) {
    for (var k = 0; k < SECTIONS.length; k++) {
      for (var m = 0; m < SECTIONS[k].pages.length; m++) {
        if (SECTIONS[k].pages[m].f === curFile) current = SECTIONS[k];
      }
    }
  }
  if (!current) current = SECTIONS[0];

  var mono = "'IBM Plex Mono',ui-monospace,monospace";
  var sans = "'IBM Plex Sans',system-ui,sans-serif";

  var linksHtml = "";
  for (var p = 0; p < current.pages.length; p++) {
    var pg = current.pages[p];
    var active = pg.f === curFile;
    linksHtml +=
      '<a href="' + href(current.dir, pg.f) + '" style="display:flex;align-items:center;gap:10px;padding:6px 16px;font-family:' + sans + ';font-size:13px;text-decoration:none;font-weight:' + (active ? "600" : "400") + ';color:var(' + (active ? "--t-cobalt" : "--t-ink") + ');">' +
      '<span style="width:7px;height:7px;flex:none;border-radius:2px;background:var(' + (active ? "--t-cobalt" : "--t-rule-strong") + ');' + (active ? "transform:rotate(-8deg);" : "") + '"></span>' +
      pg.t + "</a>";
  }

  var jumpHtml = "";
  for (var q = 0; q < SECTIONS.length; q++) {
    if (SECTIONS[q].key === current.key) continue;
    jumpHtml +=
      '<a href="' + href(SECTIONS[q].dir, SECTIONS[q].landing) + '" style="display:block;padding:5px 16px;font-family:' + mono + ';font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--t-graphite);text-decoration:none;">' +
      SECTIONS[q].label + " →</a>";
  }

  var widget = document.createElement("div");
  widget.id = "dsWidget";
  widget.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:9999;";
  widget.innerHTML =
    '<div id="dsPanel" style="position:absolute;bottom:52px;right:0;background:var(--t-panel);border:1px solid var(--t-rule);border-radius:8px;padding:12px 0;min-width:230px;box-shadow:var(--t-shadow-drag);opacity:0;transform:translateY(6px) scale(0.98);pointer-events:none;transition:opacity 0.15s ease-out,transform 0.15s ease-out;">' +
    '<div style="font-family:' + mono + ';font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--t-graphite);padding:0 16px 9px;border-bottom:1px solid var(--t-rule);margin-bottom:6px;">Tessera design system · v6</div>' +
    linksHtml +
    (jumpHtml ? '<div style="border-top:1px solid var(--t-rule);margin-top:6px;padding-top:6px;">' + jumpHtml + "</div>" : "") +
    "</div>" +
    '<button onclick="var p=document.getElementById(\'dsPanel\');var o=p.style.opacity===\'1\';p.style.opacity=o?\'0\':\'1\';p.style.transform=o?\'translateY(6px) scale(0.98)\':\'translateY(0) scale(1)\';p.style.pointerEvents=o?\'none\':\'auto\';" aria-label="Design system navigation" style="width:40px;height:40px;border-radius:8px;background:var(--t-ink);color:var(--t-paper);border:1px solid var(--t-rule);cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:var(--t-shadow-lift);">' +
    '<svg xmlns="http://www.w3.org/2000/svg" style="width:18px;height:18px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3.5 9.5h17M3.5 14.5h17M9.5 3.5v17M14.5 3.5v17"/><rect x="9.5" y="9.5" width="5" height="5" fill="var(--t-cobalt)" stroke="none" transform="rotate(-6 12 12)"/></svg>' +
    "</button>";

  function mount() { document.body.appendChild(widget); }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
