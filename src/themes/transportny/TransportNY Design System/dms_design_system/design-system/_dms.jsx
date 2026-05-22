/* eslint-disable */
/* TransportNY · DMS structural shells for mockup pages
 *
 * Provides Layout / LayoutGroup / Section helpers shaped like the real
 * DMS render path. Mockup pages compose Layout → LayoutGroup → Section →
 * Component(s), with class strings sourced from window.TNYTheme.
 *
 * Exposes: window.Layout, window.LayoutGroup, window.Section,
 *          window.getComponentTheme, window.TNYIcon
 *
 * Requires _theme.jsx loaded first; falls back to {} silently for any
 * unrecognised key. Annotation badges (LAYOUT / GROUP / SECTION) are
 * shown only when the page <body> has the `dms-annotated` class. */

const { useState } = React;

/* ─── getComponentTheme — minimal DMS contract ────────────────────────
 * Resolves a primitive's named style. Mirrors the production helper
 * just enough for mockup pages — supports `options/styles` shape (with
 * sparse styles[1..n] inheriting from styles[0]) and flat shape. */
function getComponentTheme(theme, name, activeStyleArg = null) {
  if (!theme) return {};
  const node = name.split(".").reduce((o, k) => (o ? o[k] : undefined), theme);
  if (!node) return {};
  if (Array.isArray(node.styles)) {
    const base = node.styles[0] || {};
    const idx = activeStyleArg ?? (node.options && node.options.activeStyle) ?? 0;
    const sel = typeof idx === "number"
      ? node.styles[idx]
      : node.styles.find((s) => s.name === idx);
    return { ...base, ...(sel || {}) };
  }
  return node;
}

/* ─── Layout · LayoutGroup · Section ──────────────────────────────────
 * Each shell renders the markup tree from the spec (§3.1, §4.1) and pulls
 * class strings from the theme so styling changes propagate from theme.js. */

function Layout({ style = 1, children, sideNav, topNav, footer, annotated, name }) {
  const t = getComponentTheme(window.TNYTheme, "layout", style);
  return (
    <div data-dms-layout={name || (typeof style === "string" ? style : window.TNYTheme.layout.styles[style]?.name) || "default"} className={t.outerWrapper}>
      {topNav && <div>{topNav}</div>}
      <div className={t.wrapper}>
        <div className={t.wrapper2}>
          <div className={t.wrapper3}>
            {sideNav}
            <div className={t.childWrapper}>{children}</div>
          </div>
        </div>
      </div>
      {footer}
    </div>
  );
}

function LayoutGroup({ style = 0, children, outerChildren, name }) {
  const t = getComponentTheme(window.TNYTheme, "layoutGroup", style);
  const styleName = typeof style === "string" ? style : window.TNYTheme.layoutGroup.styles[style]?.name;
  return (
    <div data-dms-group={name || styleName} className={t.wrapper1}>
      {outerChildren}
      <div className={t.wrapper2}>
        <div className={t.wrapper3}>{children}</div>
      </div>
    </div>
  );
}

function Section({ title, kicker, children, span = "1", name, padding = "p-0" }) {
  // Span maps onto the DMS sectionArray 12-column grid.
  const colSpan = {
    "1":   "col-span-12",
    "1/2": "col-span-12 md:col-span-6",
    "1/3": "col-span-12 md:col-span-4",
    "2/3": "col-span-12 md:col-span-8",
    "1/4": "col-span-12 md:col-span-3",
    "3/4": "col-span-12 md:col-span-9",
  }[span] || "col-span-12";
  return (
    <div data-dms-section={name || title || "section"} className={`${colSpan} ${padding}`}>
      {(title || kicker) && (
        <div className="mb-3 flex items-center gap-3">
          {kicker && <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-[#CA8A04]">{kicker}</span>}
          {kicker && title && <span className="h-px w-10 bg-[#CA8A04]/50"/>}
          {title && <h3 className="font-display font-semibold text-[20px] text-[#0F1722]">{title}</h3>}
        </div>
      )}
      {children}
    </div>
  );
}

/* SectionGrid — the row container Sections live in (DMS sectionArray) */
function SectionGrid({ children, className = "" }) {
  return <div className={`grid grid-cols-12 gap-6 ${className}`}>{children}</div>;
}

/* ─── Sidebar (rendered from theme.sidenav.styles[0]) ────────────────── */
function TNYSidebar({ active = "theme", nav = null, product = "DESIGN" }) {
  const t = getComponentTheme(window.TNYTheme, "sidenav", 0);
  const items = nav || [
    { id: "theme",      label: "Theme",      icon: "Sections", href: "theme.html"      },
    { id: "grid",       label: "Grid",       icon: "Grid",     href: "grid.html"       },
    { id: "components", label: "Components", icon: "Pages",    href: "components.html" },
    { id: "patterns",   label: "Patterns",   icon: "MapLayers",href: "patterns.html"   },
  ];
  return (
    <aside className={`${t.layoutContainer2} max-lg:hidden`}>
      <div className={t.sidenavWrapper}>
        <div className={t.logoWrapper}>
          <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
            <img src="../../design_handoff_transportny_design_system/assets/nys_logo_white.svg" className="w-9 h-9 object-contain" alt="NYS"/>
          </div>
          <div className="flex-1 ml-3 min-w-0">
            <span className="font-display uppercase text-white text-[15px] tracking-wide truncate">{product}</span>
          </div>
        </div>
        <div className={t.sectionHeading}>System</div>
        <div className="flex-1 py-1">
          {items.map((n) => (
            <a key={n.id} href={n.href || "#"} className={active === n.id ? t.navitemSideActive : t.navitemSide}>
              <TNYIcon name={n.icon} className={active === n.id ? t.menuIconSideActive : t.menuIconSide}/>
              <span className="flex-1 text-left">{n.label}</span>
            </a>
          ))}
        </div>
        <div className={t.userBlock}>
          <div className={t.userAvatar}>AM</div>
          <div className="flex-1 min-w-0">
            <div className="font-display uppercase text-white text-[12px] tracking-wide truncate">Alex Muro</div>
            <div className="font-mono text-slate-400 text-[10px] uppercase tracking-[0.18em] truncate">Design</div>
          </div>
          <TNYIcon name="CaretDown" className="size-3.5 text-slate-400"/>
        </div>
      </div>
    </aside>
  );
}

/* ─── Icon registry (mirrors theme/icons.js, just enough for mockups) ── */
const _ICONS = {
  Pages:        "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z",
  Sections:     "M6 6.878V6a2.25 2.25 0 0 1 2.25-2.25h7.5A2.25 2.25 0 0 1 18 6v.878M6 6.878A2.25 2.25 0 0 0 4.5 9v9a2.25 2.25 0 0 0 2.25 2.25h10.5A2.25 2.25 0 0 0 19.5 18V9A2.25 2.25 0 0 0 18 6.878",
  Search:       "M21 21l-4.5-4.5M3 11a8 8 0 1 0 16 0 8 8 0 0 0-16 0z",
  Database:     "M4 5c0-1.657 3.582-3 8-3s8 1.343 8 3-3.582 3-8 3-8-1.343-8-3zM4 5v14c0 1.657 3.582 3 8 3s8-1.343 8-3V5M4 12c0 1.657 3.582 3 8 3s8-1.343 8-3",
  CaretDown:    "m19.5 8.25-7.5 7.5-7.5-7.5",
  CaretUp:      "m4.5 15.75 7.5-7.5 7.5 7.5",
  ChevronRight: "m8.25 4.5 7.5 7.5-7.5 7.5",
  ChevronLeft:  "M15.75 19.5 8.25 12l7.5-7.5",
  ArrowRight:   "M5 12h14M13 5l7 7-7 7",
  User:         "M18.5 20v-2c0-1.5-1-2.5-2.5-3-1-.5-2.5-1-4-1s-3 .5-4 1c-1.5.5-2.5 1.5-2.5 3v2 M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
  Plus:         "M12 4v16M4 12h16",
  XMark:        "M6 18 18 6M6 6l12 12",
  Check:        "M4.5 12.75 9 17.25 19.5 6.75",
  Filter:       "M3 4h18l-7 8v6l-4 2v-8L3 4z",
  Download:     "M12 3v12m-4-4 4 4 4-4M3 19h18",
  More:         "M12 6h.01M12 12h.01M12 18h.01",
  Menu:         "M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5",
  Drag:         "M9 6v.01M15 6v.01M9 12v.01M15 12v.01M9 18v.01M15 18v.01",
  MapLayers:    "M2.25 12 12 16.5l9.75-4.5M2.25 7.5 12 12l9.75-4.5L12 3 2.25 7.5z",
  MapPin:       "M12 21s7-5.5 7-12a7 7 0 1 0-14 0c0 6.5 7 12 7 12zM12 9a2 2 0 1 1 0 4 2 2 0 0 1 0-4z",
  Activity:     "M3 12h4l3-8 4 16 3-8h4",
  Grid:         "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  SortAsc:      "M4 14h6m-3-3-3 3 3 3M14 4h7m-3-1 3 1-3 1",
  History:      "M12 22a10 10 0 1 1 10-10M12 8v4l2 2",
};

function TNYIcon({ name, className = "size-5" }) {
  const d = _ICONS[name] || _ICONS.Pages;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={d}/>
    </svg>
  );
}

/* ─── Render a Button by named style — used in every page ─────────── */
function Button({ style = "default", icon, iconRight, children }) {
  const styles = window.TNYTheme.button.styles;
  const sel = styles.find((s) => s.name === style) || styles[0];
  return (
    <button className={sel.button}>
      {icon && <TNYIcon name={icon} className="size-4"/>}
      <span>{children}</span>
      {iconRight && <TNYIcon name={iconRight} className="size-4"/>}
    </button>
  );
}

/* ─── Pill by named style ─────────────────────────────────────────── */
function Pill({ style = "default", icon, children }) {
  const styles = window.TNYTheme.pill.styles;
  const sel = styles.find((s) => s.name === style) || styles[0];
  return (
    <span className={sel.wrapper}>
      {icon && <span className={`size-1.5 rounded-full inline-block`} style={{ background: "currentColor" }}/>}
      {children}
    </span>
  );
}

/* ─── Footer band (Layout footer) ─────────────────────────────────── */
function Footer() {
  return (
    <LayoutGroup style="footer" name="footer">
      <Section span="1" name="footer-links">
        <div className="flex items-center justify-between text-[13px]">
          <div className="flex gap-6">
            <a className="tny-link">User Guide</a>
            <a className="tny-link">API Guide</a>
            <a className="tny-link">Data Dictionary</a>
          </div>
          <span className="text-slate-500 font-mono text-[11px]">© NYSDOT · DMS v0.1</span>
        </div>
      </Section>
    </LayoutGroup>
  );
}

Object.assign(window, {
  Layout, LayoutGroup, Section, SectionGrid,
  TNYSidebar, TNYIcon, Button, Pill, Footer,
  getComponentTheme,
});
