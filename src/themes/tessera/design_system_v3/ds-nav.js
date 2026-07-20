/* ═══════════════════════════════════════════════════════════════════════
   Tessera Design System v3 — shared floating navigation widget
   Documentation scaffolding only; never ships on a live DMS site.

   Every page in design-system/ and pages/ includes, before </body>:
       <script src="../ds-nav.js"></script>

   To add a page to the widget, add ONE { f, t } line to the relevant
   SECTIONS[].pages array below. Do not hand-edit per-page widgets.
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
        { f: "grid.html", t: "Grid — opus tessellatum" },
        { f: "components.html", t: "Components" },
        { f: "patterns.html", t: "Patterns" },
      ],
    },
    {
      key: "pages",
      label: "Example pages",
      dir: "pages",
      landing: "product-landing.html",
      pages: [
        { f: "product-landing.html", t: "Product landing" },
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
      '<a href="' + href(current.dir, pg.f) + '" style="display:flex;align-items:center;gap:10px;padding:6px 16px;font-family:' + sans + ';font-size:13px;text-decoration:none;font-weight:' + (active ? "600" : "400") + ';color:' + (active ? "#B5532C" : "#2A2F36") + ';">' +
      '<span style="width:7px;height:7px;flex:none;background:' + (active ? "#B5532C" : "#D9D2C2") + ';' + (active ? "transform:rotate(45deg);" : "") + '"></span>' +
      pg.t + "</a>";
  }

  var jumpHtml = "";
  for (var q = 0; q < SECTIONS.length; q++) {
    if (SECTIONS[q].key === current.key) continue;
    jumpHtml +=
      '<a href="' + href(SECTIONS[q].dir, SECTIONS[q].landing) + '" style="display:block;padding:5px 16px;font-family:' + mono + ';font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#4A5160;text-decoration:none;">' +
      SECTIONS[q].label + " →</a>";
  }

  var widget = document.createElement("div");
  widget.id = "dsWidget";
  widget.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:9999;";
  widget.innerHTML =
    '<div id="dsPanel" style="position:absolute;bottom:52px;right:0;background:#FBF9F4;border:1px solid #D9D2C2;padding:12px 0;min-width:230px;box-shadow:0 4px 20px rgba(42,47,54,0.12);opacity:0;transform:translateY(6px) scale(0.98);pointer-events:none;transition:opacity 0.1s cubic-bezier(0.2,0,0.1,1),transform 0.1s cubic-bezier(0.2,0,0.1,1);">' +
    '<div style="font-family:' + mono + ';font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#4A5160;padding:0 16px 9px;border-bottom:1px solid #D9D2C2;margin-bottom:6px;">Tessera design system · v3</div>' +
    linksHtml +
    (jumpHtml ? '<div style="border-top:1px solid #D9D2C2;margin-top:6px;padding-top:6px;">' + jumpHtml + "</div>" : "") +
    "</div>" +
    '<button onclick="var p=document.getElementById(\'dsPanel\');var o=p.style.opacity===\'1\';p.style.opacity=o?\'0\':\'1\';p.style.transform=o?\'translateY(6px) scale(0.98)\':\'translateY(0) scale(1)\';p.style.pointerEvents=o?\'none\':\'auto\';" aria-label="Design system navigation" style="width:40px;height:40px;background:#1A1D22;color:#F4F1EA;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(26,29,34,0.2);">' +
    '<svg xmlns="http://www.w3.org/2000/svg" style="width:18px;height:18px;" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><rect x="13" y="13" width="8" height="8" fill="#B5532C"/></svg>' +
    "</button>";

  function mount() { document.body.appendChild(widget); }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
