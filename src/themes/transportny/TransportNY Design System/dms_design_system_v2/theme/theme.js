// TransportNY · DMS theme overlay
// v0.2 · 2026-05-26
//
// Second-pass overlay. Inherits the v1 shape but applies the
// up-to-date authoring skills:
//
//   • textSettings uses the universal {role}{Size}[Variant] pattern
//     (display / displayItalic / prose / meta ladders) alongside the
//     legacy textXS..text8XL ladder. The brand tokens show up in the
//     Card valueFontStyle dropdown and (via Approach B) in the Lexical
//     /Style: slash menu.
//   • lexical.heading_h1..h6 is set explicitly so the codebase
//     default's font-display rule doesn't shadow the brand tokens
//     (the textSettings → lexical backfill only fires when
//     lexical.heading_h1 is falsy — see skill §3.1.5).
//   • pages.sectionArray uses _replace: ['sizes'] + gridSize: 12 +
//     defaultSize: '12' + layouts.centered: 'max-w-[1480px] mx-auto'
//     (skill §3.1.55 — the sectionArray gotchas). Authors who hit "+
//     Add section" land on a full-width section out of the box.
//   • The codebase's edit-mode chrome (sectionEditHover, sectionEditing,
//     addSectionIcon, addSectionText, border.full) is re-skinned in
//     the brand palette so it doesn't leak Catalyst aesthetics on
//     hover.
//   • Lexical layoutTemplates + layoutItem padding are overridden so
//     /Columns produces brand-grid templates with sensible gutters.
//
// Color & type tokens are referenced as literal Tailwind classes
// throughout (the consuming dms-template project runs Tailwind v4 in
// the browser via the CDN, which supports arbitrary-value classes
// like `bg-[#1F3F8F]`). The brand palette is also exported in
// tailwind.additions.js for projects on v3 that prefer named colors.
// @font-face declarations and the surface utility classes
// (.tny-pane, .tny-card, .tny-press, .tny-hero-topo, etc.) live in
// index.css.additions.

import icons from "./icons";

// ─────────────────────────────────────────────────────────────────────────────
// textSettings — the global type scale.
//
// Brand families (set up in tailwind.additions.js + index.css.additions):
//   font-display → Oswald (condensed display; headings & chrome only)
//   font-sans / font-proxima → Proxima Nova / Source Sans 3 (prose)
//   font-mono → ui-monospace stack (numerics, kickers, metadata)
//
// Three ladders coexist:
//   • {role}{Size} brand tokens (display/displayItalic/prose/meta) —
//     the names new Lexical sections and Card valueFontStyle dropdowns
//     should reach for.
//   • textXS..text8XL — legacy generic size ladder. Required by the
//     Card toolbar (`Object.keys(styles[0])` populates the dropdown).
//   • h1..h6 — semantic heading roles consumed by Lexical (backfill)
//     and Header.
//
// Aliases (body / bodySmall / caption / label / kicker / nav) are
// referenced by pattern themes; keep them populated.
// ─────────────────────────────────────────────────────────────────────────────
const F_DISP  = "font-display";   // Oswald
const F_SANS  = "font-proxima";   // Proxima Nova / Source Sans 3
const F_MONO  = "font-mono";

const INK     = "text-[#0F1722]"; // primary ink
const INK_2   = "text-[#37576B]"; // secondary ink
const INK_3   = "text-slate-500"; // tertiary

const textSettings = {
  options: {
    activeStyle: 0,
    // Lexical's /Style: slash menu shows only these tokens — the
    // brand ladder, not the generic textXS..text8XL noise.
    slashKeys: [
      "displayHero", "displayXL", "displayLG", "displayMD", "displaySM", "displayXS",
      "displayItalicLG", "displayItalicMD",
      "proseLG", "prose", "proseSM", "proseXS",
      "metaMD", "metaSM", "metaXS",
      "kicker",
    ],
  },
  styles: [{
    name: "default",

    // ── Heading roles — Lexical backfill, Header section ──
    h1: `${F_DISP} font-semibold text-[52px] leading-[1.02] tracking-tight ${INK} scroll-mt-36`,
    h2: `${F_DISP} font-semibold text-[38px] leading-[1.05] tracking-tight uppercase ${INK} scroll-mt-36`,
    h3: `${F_DISP} font-semibold text-[28px] leading-[1.1] ${INK} scroll-mt-36`,
    h4: `${F_DISP} font-medium text-[20px] leading-[1.2] ${INK} scroll-mt-36`,
    h5: `${F_DISP} font-medium text-[16px] leading-[1.3] uppercase tracking-wide ${INK} scroll-mt-36`,
    h6: `${F_DISP} font-medium text-[14px] leading-[1.4] uppercase tracking-[0.16em] text-slate-700 scroll-mt-36`,

    // ── Display ladder (Oswald) — chrome, page titles, KPI giants ──
    displayHero: `${F_DISP} font-semibold text-[52px] leading-[1.02] tracking-tight ${INK}`,
    displayXL:   `${F_DISP} font-semibold text-[44px] leading-[1.05] tracking-tight ${INK}`,
    displayLG:   `${F_DISP} font-semibold text-[38px] leading-[1.05] tracking-tight uppercase ${INK}`,
    displayMD:   `${F_DISP} font-semibold text-[28px] leading-[1.1] ${INK}`,
    displaySM:   `${F_DISP} font-medium text-[22px] leading-[1.2] ${INK}`,
    displayXS:   `${F_DISP} font-medium text-[18px] leading-[1.25] ${INK}`,

    // ── Display italic — used for editorial pull quotes (rare) ──
    displayItalicLG: `${F_DISP} italic font-medium text-[28px] leading-[1.2] ${INK_2}`,
    displayItalicMD: `${F_DISP} italic font-medium text-[20px] leading-[1.3] ${INK_2}`,

    // ── Prose ladder (Proxima Nova) — running copy ──
    proseLG: `${F_SANS} text-[16px] leading-[1.65] text-slate-700`,
    prose:   `${F_SANS} text-[14.5px] leading-[1.65] text-slate-700`,
    proseSM: `${F_SANS} text-[12.5px] leading-[1.55] text-slate-600`,
    proseXS: `${F_SANS} text-[11.5px] leading-[1.5] text-slate-500`,

    // ── Meta ladder (mono) — kickers, metadata, codes, mono labels ──
    metaMD: `${F_MONO} text-[12px] leading-[1.45] tabular-nums text-slate-600`,
    metaSM: `${F_MONO} text-[10.5px] leading-[1.4] uppercase tracking-[0.18em] text-slate-500`,
    metaXS: `${F_MONO} text-[9.5px] leading-[1.4] uppercase tracking-[0.18em] text-slate-400`,

    // Editorial kicker — the "// 01" amber labels that head sections.
    // Distinct enough from metaSM to justify its own token (color shift).
    kicker: `${F_MONO} text-[10.5px] uppercase tracking-[0.2em] text-[#CA8A04]`,
    nav:    `${F_DISP} font-medium text-[13.5px] uppercase tracking-wide`,

    // ── Legacy generic size scale (the Card valueFontStyle dropdown
    //     populates from Object.keys(styles[0]), so these must exist) ──
    textXS:           `text-[11px] font-medium`,
    textXSReg:        `text-[11px] font-normal`,
    textXSBold:       `text-[11px] font-bold`,
    textSM:           `text-[12.5px] font-medium`,
    textSMReg:        `text-[12.5px] font-normal`,
    textSMBold:       `text-[12.5px] font-bold`,
    textSMSemiBold:   `text-[12.5px] font-semibold`,
    textBase:         `text-[14.5px] font-normal leading-[1.6]`,
    textBaseMed:      `text-[14.5px] font-medium leading-[1.6]`,
    textBaseSemiBold: `text-[14.5px] font-semibold leading-[1.6]`,
    textMD:           `text-[15px] font-medium`,
    textMDReg:        `text-[15px] font-normal`,
    textMDBold:       `text-[15px] font-bold`,
    textMDSemiBold:   `text-[15px] font-semibold`,
    textLG:           `text-[18px] font-medium`,
    textLGReg:        `text-[18px] font-normal`,
    textLGBold:       `text-[18px] font-bold`,
    textXL:           `text-[20px] ${F_DISP} font-medium`,
    textXLReg:        `text-[20px] ${F_DISP} font-normal`,
    textXLSemiBold:   `text-[20px] ${F_DISP} font-semibold`,
    textXLBold:       `text-[20px] ${F_DISP} font-bold`,
    text2XL:          `text-[24px] ${F_DISP} font-semibold`,
    text2XLReg:       `text-[24px] ${F_DISP} font-normal`,
    text2XLSemiBold:  `text-[24px] ${F_DISP} font-semibold`,
    text2XLBold:      `text-[24px] ${F_DISP} font-bold`,
    text3XL:          `text-[28px] ${F_DISP} font-semibold`,
    text3XLReg:       `text-[28px] ${F_DISP} font-normal`,
    text3XLSemiBold:  `text-[28px] ${F_DISP} font-semibold`,
    text3XLBold:      `text-[28px] ${F_DISP} font-bold`,
    text4XL:          `text-[34px] ${F_DISP} font-semibold tracking-tight`,
    text4XLBold:      `text-[34px] ${F_DISP} font-bold tracking-tight`,
    text5XL:          `text-[40px] ${F_DISP} font-semibold tracking-tight`,
    text5XLBold:      `text-[40px] ${F_DISP} font-bold tracking-tight`,
    text6XL:          `text-[52px] ${F_DISP} font-semibold tracking-tight`,
    text7XL:          `text-[64px] ${F_DISP} font-semibold tracking-tight`,
    text8XL:          `text-[80px] ${F_DISP} font-semibold tracking-tight`,

    // ── Tabular numeric variants — KPI cells, table cells with numbers ──
    numXS:   `${F_MONO} text-[11px] tabular-nums`,
    numSM:   `${F_MONO} text-[12.5px] tabular-nums`,
    numBase: `${F_MONO} text-[14.5px] tabular-nums`,
    numMD:   `${F_MONO} text-[18px] font-medium tabular-nums`,
    numLG:   `${F_MONO} text-[22px] font-medium tabular-nums`,
    numXL:   `${F_MONO} text-[28px] font-medium tabular-nums`,
    num2XL:  `${F_MONO} text-[40px] font-medium tabular-nums`,

    // ── Semantic aliases (consumed by pattern themes) ──
    body:      `${F_SANS} text-[14.5px] font-normal leading-[1.65] text-slate-700`,
    bodySmall: `${F_SANS} text-[12.5px] font-normal leading-[1.55] text-slate-600`,
    caption:   `${F_SANS} text-[12px] font-normal text-slate-500`,
    label:     `${F_SANS} text-[13px] font-medium text-slate-700`,
    designator:`${F_MONO} text-[10.5px] uppercase tracking-[0.18em] text-slate-500`,
  }],
};

// ─────────────────────────────────────────────────────────────────────────────
// Layout — page chrome.
//
//   default → marketing/landing — no nav, white background, generous gutters.
//   app     → canonical product surface — persistent SideNav, pane bg.
//   bare    → auth / embedded — centered, no chrome.
// ─────────────────────────────────────────────────────────────────────────────
const layout = {
  options: {
    activeStyle: 1, // most pages use `app`
    sideNav: {
      size: "compact",
      nav: "main",
      activeStyle: 0,
      subMenuActivate: "onHover",
      topMenu:    [{ type: "LogoNav" }],
      bottomMenu: [{ type: "UserMenu" }],
    },
    topNav: { size: "none", nav: "none", activeStyle: null, leftMenu: [], rightMenu: [] },
  },
  styles: [
    {
      name: "default",
      outerWrapper: "bg-white",
      wrapper:      "relative isolate flex min-h-svh w-full max-lg:flex-col",
      wrapper2:     "flex-1 flex flex-col items-stretch max-w-full min-h-screen",
      wrapper3:     "flex flex-1 items-start",
      childWrapper: "flex-1 flex flex-col h-full",
    },
    {
      name: "app",
      outerWrapper: "bg-[#ECEEF2]",
      wrapper:      "relative isolate flex min-h-svh w-full max-lg:flex-col",
      wrapper2:     "flex-1 flex flex-col items-stretch max-w-full min-h-screen lg:ml-60",
      wrapper3:     "flex flex-1 items-start",
      childWrapper: "flex-1 flex flex-col h-full bg-[#ECEEF2]",
    },
    {
      name: "bare",
      outerWrapper: "bg-[#ECEEF2]",
      wrapper:      "relative isolate flex min-h-svh w-full place-content-center",
      wrapper2:     "flex-1 flex flex-col items-center justify-center max-w-full min-h-screen",
      wrapper3:     "flex flex-1 items-center justify-center w-full",
      childWrapper: "flex-1 flex flex-col items-center justify-center w-full h-full",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// LayoutGroup — bands of content within a Layout.
//
// The cards-on-pane rule: section bg is always the pane (or pane-tint).
// Content lives inside cards. wrapper1 is the band's outer container
// (full-width, sets band background); wrapper2 is the bounded inner
// container that holds Sections (max-w 1480 = brand "data" container,
// per the handoff grid system).
//
// Variants the brand ships:
//   content      → main page body (cards on pane bg) · the default
//   content_tint → alternating section on pane-tint
//   header       → white band w/ hairline border at bottom · page header
//   hero         → topo background, taller padding · landing/docs hero
//   tone_bar     → saturated NYS-blue filter strip · filter rows
//   tone_bar_dark→ darker pill strip · route pills
//   auth         → centered card · sign-in / sign-up
//   footer       → white band w/ hairline at top · footer
//   workbench    → no max-width, edge-to-edge · map/canvas workbench
// ─────────────────────────────────────────────────────────────────────────────
const layoutGroup = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: "content",
      wrapper1: "w-full bg-[#ECEEF2] py-12",
      wrapper2: "mr-auto w-full max-w-[1480px] pl-12 pr-8 flex flex-col gap-6",
      wrapper3: "",
    },
    {
      name: "content_tint",
      wrapper1: "w-full bg-[#E4E8EE] py-12",
      wrapper2: "mr-auto w-full max-w-[1480px] pl-12 pr-8 flex flex-col gap-6",
      wrapper3: "",
    },
    {
      name: "header",
      wrapper1: "w-full bg-white border-b border-zinc-950/10",
      wrapper2: "mr-auto w-full max-w-[1480px] pl-12 pr-8 py-10 flex flex-col gap-4",
      wrapper3: "",
    },
    {
      name: "hero",
      wrapper1: "w-full tny-hero-topo border-b border-zinc-950/10",
      wrapper2: "mr-auto w-full max-w-[1480px] pl-12 pr-8 py-14 flex flex-col gap-5",
      wrapper3: "",
    },
    {
      name: "tone_bar",
      wrapper1: "w-full bg-[#1F3F8F] text-white border-b border-black/10",
      wrapper2: "mr-auto w-full max-w-[1480px] pl-12 pr-8 h-12 flex items-center gap-8",
      wrapper3: "",
    },
    {
      name: "tone_bar_dark",
      wrapper1: "w-full bg-[#16307A] text-white border-b border-black/20",
      wrapper2: "mr-auto w-full max-w-[1480px] pl-12 pr-8 h-14 flex items-center gap-2 overflow-x-auto",
      wrapper3: "",
    },
    {
      name: "auth",
      wrapper1: "w-full flex-1 flex flex-row p-6 bg-[#ECEEF2]",
      wrapper2: "mx-auto w-full max-w-md flex flex-col rounded-[8px] border border-zinc-950/10 bg-white shadow-sm p-8 place-content-center",
      wrapper3: "",
    },
    {
      name: "footer",
      wrapper1: "w-full bg-white border-t border-zinc-950/10",
      wrapper2: "mr-auto w-full max-w-[1480px] pl-12 pr-8 py-4 flex items-center justify-between",
      wrapper3: "",
    },
    {
      name: "workbench",
      wrapper1: "w-full bg-[#ECEEF2] py-6",
      wrapper2: "w-full px-0 flex flex-col gap-6",
      wrapper3: "",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// sidenav — the persistent dark ink rail.
//
// `default`: 240px expanded with labels.
// `compact`: 64px icon-only with hover-flyout submenus.
//
// Real key set sourced from SideNav.theme.jsx — the v1 pass had every
// key except sectionDivider/sectionHeading, which v2 ships explicitly.
// ─────────────────────────────────────────────────────────────────────────────
const sidenav = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: "default",
      layoutContainer1: "lg:ml-60",
      layoutContainer2: "fixed inset-y-0 left-0 w-60 max-lg:hidden z-30",
      logoWrapper:      "relative h-16 bg-[#0A0E13] border-b border-[#2a3545] flex items-center px-3",
      sidenavWrapper:   "flex flex-col w-60 h-full bg-[#12181F] border-r border-[#2a3545]",
      menuItemWrapper:           "flex flex-col",
      menuItemWrapper_level_1:   "",
      menuItemWrapper_level_2:   "pl-4 bg-[#0d1117]",
      menuItemWrapper_level_3:   "pl-6 bg-[#0d1117]",
      menuItemWrapper_level_4:   "pl-8 bg-[#0d1117]",
      navitemSide:       "font-proxima text-[13.5px] group flex items-center px-4 py-2.5 hover:bg-[#1e2530] text-slate-300 border-l-[3px] border-transparent transition-colors cursor-pointer",
      navitemSideActive: "font-proxima text-[13.5px] group flex items-center px-4 py-2.5 bg-[#1e2530] text-white border-l-[3px] border-[#FACC15] transition-colors cursor-pointer",
      menuIconSide:        "size-[18px] mr-3 text-slate-400 group-hover:text-slate-300 flex-shrink-0",
      menuIconSideActive:  "size-[18px] mr-3 text-[#FACC15] flex-shrink-0",
      forcedIcon:         "size-4 text-slate-400",
      forcedIcon_level_1: "size-[18px]",
      forcedIcon_level_2: "size-4",
      forcedIcon_level_3: "size-3.5",
      forcedIcon_level_4: "size-3",
      itemsWrapper: "flex-1 py-2 overflow-y-auto",
      navItemContent: "flex-1 flex items-center justify-between transition-transform",
      navItemContent_level_1: "",
      navItemContent_level_2: "text-[12.5px]",
      navItemContent_level_3: "text-[12px]",
      navItemContent_level_4: "text-[11.5px]",
      indicatorIcon:     "ChevronRight",
      indicatorIconOpen: "ChevronDown",
      indicatorIconWrapper: "size-4 text-slate-500 transition-transform ml-auto",
      subMenuWrapper_1:     "w-full bg-[#0d1117]",
      subMenuWrapper_2:     "w-full bg-[#0d1117]",
      subMenuWrapper_3:     "w-full bg-[#0d1117]",
      subMenuOuterWrapper:  "",
      subMenuParentWrapper: "flex flex-col",
      subMenuTitle:         "px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500",
      bottomMenuWrapper:    "border-t border-[#2a3545] py-2",
      sectionDivider:       "my-3 border-t border-[#2a3545]",
      sectionHeading:       "px-4 py-2 font-mono text-[10px] font-semibold text-slate-500 uppercase tracking-[0.2em]",
      // mobile-toggle (sidenav consumes a few topnav-shaped keys too)
      topnavWrapper:                "lg:hidden flex items-center h-12 px-3 bg-[#0A0E13] text-white",
      topnavContent:                "flex items-center justify-between w-full",
      topnavMenu:                   "flex items-center gap-3",
      topmenuRightNavContainer:     "flex items-center gap-2",
      topnavMobileContainer:        "lg:hidden",
      searchButtonWrapper: "px-3 pt-3",
      searchButton:       "w-full h-9 px-3 rounded-full bg-[#1a2029] border border-[#2a3545] hover:border-[#3a4555] flex items-center gap-2 text-slate-400 hover:text-slate-300",
      searchButtonText:   "font-proxima text-[13px] flex-1 text-left",
      userBlock:  "flex items-center gap-3 px-4 py-2",
      userAvatar: "w-8 h-8 rounded-full bg-gradient-to-br from-[#37576B] to-[#1f3450] flex items-center justify-center text-white text-[11px] font-medium ring-1 ring-[#FACC15]/20",
      userName:   "font-display uppercase text-white text-[12px] tracking-wide truncate",
      userRole:   "font-mono text-slate-400 text-[10px] uppercase tracking-[0.18em] truncate",
    },
    {
      name: "compact",
      layoutContainer1: "lg:ml-16",
      layoutContainer2: "fixed inset-y-0 left-0 w-16 max-lg:hidden z-30",
      logoWrapper:      "relative h-16 bg-[#0A0E13] border-b border-[#2a3545] flex items-center justify-center",
      sidenavWrapper:   "flex flex-col w-16 h-full bg-[#12181F] border-r border-[#2a3545] items-center overflow-visible",
      navitemSide:       "group relative flex items-center justify-center w-full py-3 hover:bg-[#1e2530] text-slate-400 border-l-[3px] border-transparent transition-colors cursor-pointer",
      navitemSideActive: "group relative flex items-center justify-center w-full py-3 bg-[#1e2530] text-white border-l-[3px] border-[#FACC15] transition-colors cursor-pointer",
      menuIconSide:        "size-6 text-slate-400 group-hover:text-slate-300",
      menuIconSideActive:  "size-6 text-[#FACC15]",
      subMenuWrapper_1:    "min-w-[220px] bg-[#1a2029] border border-[#3a4555] shadow-2xl",
      subMenuOuterWrapper: "absolute left-full top-0 z-50",
      sectionHeading: "hidden",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// topnav — only rendered on `default` (marketing) Layout. Product Layouts
// use SideNav exclusively. Keys sourced from TopNav.theme.jsx.
// ─────────────────────────────────────────────────────────────────────────────
const topnav = {
  options: { activeStyle: 0, maxDepth: 2 },
  styles: [{
    name: "default",
    layoutContainer1: "h-[60px]",
    layoutContainer2: "w-full z-20 bg-white border-b border-zinc-950/10",
    topnavWrapper:   "w-full h-[60px] flex items-center",
    topnavContent:   "mx-auto max-w-[1280px] w-full flex items-center justify-between px-8",
    leftMenuContainer:   "flex items-center gap-6",
    centerMenuContainer: "hidden lg:flex items-center gap-8",
    rightMenuContainer:  "flex items-center gap-3",
    mobileNavContainer:  "lg:hidden w-full flex flex-col bg-white border-t border-zinc-950/10",
    mobileButton:        "lg:hidden h-8 w-8 inline-flex items-center justify-center text-slate-700 hover:bg-slate-100 rounded",
    menuOpenIcon:  "Menu",
    menuCloseIcon: "XMark",
    navitemWrapper:          "relative",
    navitemWrapper_level_2:  "flex flex-col",
    navitemWrapper_level_3:  "flex flex-col pl-3",
    navitem:                 "font-display font-medium text-[13.5px] uppercase tracking-wide text-slate-700 hover:text-[#0F1722] cursor-pointer transition-colors",
    navitemActive:           "font-display font-medium text-[13.5px] uppercase tracking-wide text-[#0F1722] border-b-2 border-[#FACC15] cursor-pointer",
    navIcon:                 "size-4 text-slate-500",
    navIconActive:           "size-4 text-[#FACC15]",
    navitemContent:          "flex items-center gap-2",
    navitemName:             "",
    navitemName_level_2:     "text-[12.5px]",
    navitemName_level_3:     "text-[12px]",
    navitemDescription:           "font-proxima text-[11px] text-slate-500",
    navitemDescription_level_2:   "font-proxima text-[11px] text-slate-500",
    navitemDescription_level_3:   "font-proxima text-[10.5px] text-slate-400",
    indicatorIconWrapper:    "size-3 ml-1 text-slate-500 transition-transform",
    indicatorIcon:           "ChevronDown",
    indicatorIconOpen:       "ChevronUp",
    subMenuWrapper:           "absolute top-full left-0 mt-1 min-w-[220px] bg-white border border-zinc-950/10 rounded-[8px] shadow-lg z-30 py-1",
    subMenuWrapper2:          "flex flex-col",
    subMenuWrapper_level_2:   "px-3 py-1.5 hover:bg-slate-50",
    subMenuWrapper2_level_2:  "flex flex-col",
    subMenuItemsWrapper:        "flex flex-col py-1",
    subMenuItemsWrapperParent:  "px-3 py-2 border-b border-zinc-950/05",
    subMenuParentWrapper:       "flex items-start gap-3 px-3 py-2",
    subMenuParentContent:       "flex flex-col",
    subMenuParentName:          "font-display uppercase text-[12.5px] tracking-wide text-[#0F1722]",
    subMenuParentDesc:          "font-proxima text-[11.5px] text-slate-500",
    subMenuParentLink:          "text-[#1F3F8F] hover:underline",
  }],
};

// ─────────────────────────────────────────────────────────────────────────────
// logo
// ─────────────────────────────────────────────────────────────────────────────
const logo = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: "default",
      wrapper: "flex items-center gap-3 px-3 h-16 bg-[#0A0E13]",
      image:   "w-9 h-9 object-contain",
      text:    "font-display uppercase text-white text-[15px] tracking-wide truncate flex-1",
      img:     "/themes/transportny/nys_logo_white.svg",
      title:   "TransportNY",
      linkPath:"/",
    },
    {
      name: "compact",
      wrapper: "flex items-center justify-center h-16 w-16 bg-[#0A0E13]",
      image:   "w-9 h-9 object-contain",
      text:    "hidden",
    },
    {
      name: "light",
      wrapper: "flex items-center gap-3 h-16",
      image:   "w-9 h-9 object-contain",
      text:    "font-display uppercase text-[#0F1722] text-[15px] tracking-wide",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// button
// ─────────────────────────────────────────────────────────────────────────────
const button = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: "default",
      // Primary NYS-blue with the tone-bar press effect.
      button: "tny-press cursor-pointer inline-flex items-center gap-2 px-4 h-10 bg-[#1F3F8F] hover:bg-[#16307A] border-b-4 border-[#0F2D4D] text-white font-display uppercase text-[13px] tracking-wide rounded-[6px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F3F8F]/40 disabled:opacity-50",
      icon:      "",
      iconLeft:  "size-4",
      iconRight: "size-4",
    },
    {
      name: "plain",
      // Text-only ghost. Used for tertiary actions and inline links.
      button: "cursor-pointer inline-flex items-center gap-2 px-3 h-9 text-slate-700 hover:text-[#0F1722] hover:bg-slate-100 font-proxima text-[13px] rounded-[6px] transition-colors disabled:opacity-50",
    },
    {
      name: "active",
      button: "tny-press cursor-pointer inline-flex items-center gap-2 px-4 h-10 bg-[#16307A] border-b-4 border-[#0A1C4D] text-white font-display uppercase text-[13px] tracking-wide rounded-[6px]",
    },
    {
      name: "secondary",
      // Outlined white surface.
      button: "cursor-pointer inline-flex items-center gap-2 px-4 h-10 bg-white hover:bg-slate-50 border border-[#1F3F8F] text-[#1F3F8F] font-proxima text-[13px] font-semibold rounded-[6px] transition-colors disabled:opacity-50",
    },
    {
      name: "tertiary",
      button: "cursor-pointer inline-flex items-center gap-2 px-4 h-10 text-[#1F3F8F] hover:bg-[#1F3F8F]/5 font-proxima text-[13px] font-semibold rounded-[6px]",
    },
    {
      name: "ghost",
      button: "cursor-pointer inline-flex items-center gap-2 px-3 h-9 border border-transparent hover:bg-slate-100 text-slate-600 font-proxima text-[13px] rounded-[6px]",
    },
    {
      name: "danger",
      button: "tny-press cursor-pointer inline-flex items-center gap-2 px-4 h-10 bg-[#EF4444] hover:bg-[#DC2626] border-b-4 border-[#991B1B] text-white font-display uppercase text-[13px] tracking-wide rounded-[6px]",
    },
    {
      name: "compact",
      // h-8 chip used in toolbars and page headers (e.g. "Display ▾").
      button: "cursor-pointer inline-flex items-center gap-1.5 px-2.5 h-8 bg-white border border-zinc-950/10 hover:border-[#37576B] text-slate-700 font-proxima text-[12px] rounded-[6px] transition-colors",
    },
    {
      name: "icon",
      button: "cursor-pointer inline-flex items-center justify-center h-9 w-9 border border-zinc-950/15 bg-white hover:bg-slate-50 text-slate-700 rounded-[6px]",
    },
    {
      name: "amber",
      // Amber tone-bar action (used in MAP-21 hero "PM3 HPMS report" button)
      button: "tny-press cursor-pointer inline-flex items-center gap-2 px-4 h-10 bg-[#EAAD43] hover:bg-[#F1CA87] text-[#37576B] font-proxima font-bold text-[11.5px] uppercase tracking-[0.12em] rounded-[6px] border-b-4 border-[#C68B1F]",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// input — flat theme (per the spec, input/textarea/edit are flat)
// ─────────────────────────────────────────────────────────────────────────────
const input = {
  input:          "relative w-full block appearance-none rounded-[6px] px-3 h-11 text-[14px] text-[#0F1722] placeholder:text-slate-400 border border-zinc-950/15 hover:border-zinc-950/30 bg-white focus:outline-none focus:border-[#1F3F8F] focus:ring-2 focus:ring-[#1F3F8F]/15 aria-invalid:border-[#EF4444] disabled:opacity-50 disabled:bg-slate-50",
  inputContainer: "group flex relative w-full",
  textarea:       "relative block h-full w-full appearance-none rounded-[6px] px-3 py-2 text-[14px] text-[#0F1722] placeholder:text-slate-400 border border-zinc-950/15 hover:border-zinc-950/30 bg-white focus:outline-none focus:border-[#1F3F8F] focus:ring-2 focus:ring-[#1F3F8F]/15 resize-y",
  confirmButtonContainer: "absolute right-0 hidden group-hover:flex items-center",
  editButton:    "py-1.5 px-2 text-slate-400 hover:text-[#1F3F8F] cursor-pointer",
  cancelButton:  "text-slate-400 hover:text-[#EF4444] cursor-pointer py-1.5 pr-1",
  confirmButton: "text-[#10B981] hover:text-white hover:bg-[#10B981] cursor-pointer rounded-full",
};

// ─────────────────────────────────────────────────────────────────────────────
// multiselect — four named variants matching the handoff's "// 01-04"
// gallery: compact, standard, multiselect, multiselect_with_search.
// ─────────────────────────────────────────────────────────────────────────────
const multiselect = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: "default",
      view:           "font-proxima",
      mainWrapper:    "relative",
      inputWrapper:   "flex w-full items-center gap-1.5 min-h-11 px-3 rounded-[6px] border border-zinc-950/15 hover:border-zinc-950/30 bg-white focus-within:border-[#1F3F8F] focus-within:ring-2 focus-within:ring-[#1F3F8F]/15 cursor-pointer",
      caretWrapper:   "ml-auto pl-1 text-slate-500",
      caretIcon:      "CaretDown",
      input:          "flex-1 bg-transparent text-[14px] text-[#0F1722] placeholder:text-slate-400 focus:outline-none",
      statusWrapper:  "text-[12px] text-slate-500",
      singleValue:        "text-[14px] text-[#0F1722]",
      singlePlaceholder:  "text-[14px] text-slate-400",
      tokenWrapper:   "inline-flex items-center gap-1 h-7 pl-2 pr-1 rounded-[4px] bg-[#37576B]/10 text-[#0F2D4D] text-[12.5px] font-medium",
      removeIcon:     "XMark",
      removeIconClass:"size-3.5 text-slate-500 hover:text-[#EF4444] cursor-pointer",
      menuWrapper:    "absolute z-40 mt-1 w-full rounded-[8px] border border-zinc-950/10 bg-white shadow-lg overflow-hidden",
      optionsWrapper: "max-h-72 overflow-y-auto py-1",
      menuItem:         "px-3 py-2 text-[13.5px] text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center gap-2",
      menuItemSelected: "px-3 py-2 text-[13.5px] text-[#0F1722] bg-[#1F3F8F]/5 cursor-pointer flex items-center gap-2 font-medium",
      smartMenuWrapper: "px-3 py-2 border-b border-zinc-950/05 bg-slate-50/60",
      smartMenuItem:    "text-[12px] text-slate-500",
      error:            "mt-1 text-[12px] text-[#EF4444]",
    },
    {
      name: "compact",
      // h-8 chip — lives in page headers / filter rows.
      inputWrapper: "flex items-center gap-1.5 h-8 px-2.5 rounded-[6px] border border-zinc-950/10 hover:border-[#37576B] bg-white text-[12px] cursor-pointer transition-colors",
      caretWrapper: "ml-1 text-slate-500",
      singleValue:  "text-[12px] text-slate-700 font-medium",
      menuWrapper:  "absolute z-40 mt-1 min-w-[180px] rounded-[6px] border border-zinc-950/10 bg-white shadow-lg overflow-hidden",
      menuItem:     "px-3 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-50 cursor-pointer",
    },
    {
      name: "tone_bar",
      // White-on-blue: lives inside the saturated NYS-blue filter strip.
      inputWrapper: "flex items-center gap-1.5 px-2 -mx-2 py-1 rounded text-white hover:bg-white/10 cursor-pointer",
      singleValue:  "font-semibold text-[13px] text-white",
      caretWrapper: "ml-1 text-white/70",
    },
    {
      name: "multiselect_with_search",
      // h-11 trigger + token chips. Search field pinned to the top of menu.
      inputWrapper:     "flex w-full items-center gap-1.5 min-h-11 px-3 rounded-[6px] border border-zinc-950/15 hover:border-zinc-950/30 bg-white cursor-pointer",
      menuWrapper:      "absolute z-40 mt-1 w-full rounded-[8px] border border-zinc-950/10 bg-white shadow-lg overflow-hidden",
      smartMenuWrapper: "px-2 py-2 border-b border-zinc-950/10 bg-slate-50/60",
      smartMenuItem:    "w-full h-8 px-2 rounded border border-zinc-950/10 bg-white text-[13px] focus:outline-none focus:border-[#1F3F8F]",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// tabs — segmented controls (the Graph/Table/Cards toggle) + standard
// horizontal tab strip.
// ─────────────────────────────────────────────────────────────────────────────
const tabs = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: "default",
      wrapper: "flex flex-col gap-3",
      tabList: "flex items-center border-b border-zinc-950/10",
      tab:       "px-3 h-10 font-display uppercase text-[12.5px] tracking-wide text-slate-500 hover:text-[#0F1722] cursor-pointer border-b-2 border-transparent",
      tabActive: "px-3 h-10 font-display uppercase text-[12.5px] tracking-wide text-[#0F1722] border-b-2 border-[#FACC15] cursor-pointer",
      tabPanel:  "py-4",
    },
    {
      name: "segmented",
      tabList: "inline-flex items-center gap-0 rounded-[6px] bg-[#0A0E13] p-0.5",
      tab:       "px-3 h-7 inline-flex items-center gap-1.5 font-proxima text-[12px] text-slate-400 hover:text-slate-200 cursor-pointer rounded-[4px]",
      tabActive: "px-3 h-7 inline-flex items-center gap-1.5 font-proxima text-[12px] text-white bg-[#1e2530] cursor-pointer rounded-[4px] [&_svg]:text-[#FACC15]",
    },
    {
      name: "pill",
      // Trend page "Geography" picker — 4 named scope tabs.
      tabList: "inline-flex items-center gap-1 bg-white border border-zinc-950/10 rounded-[6px] p-0.5",
      tab:       "px-3 h-8 inline-flex items-center gap-1.5 font-proxima text-[12.5px] text-slate-600 hover:text-[#0F1722] cursor-pointer rounded-[4px]",
      tabActive: "px-3 h-8 inline-flex items-center gap-1.5 font-proxima text-[12.5px] font-medium text-white bg-[#1F3F8F] cursor-pointer rounded-[4px]",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// switch
// ─────────────────────────────────────────────────────────────────────────────
const switchTheme = {
  options: { activeStyle: 0 },
  styles: [{
    name: "default",
    wrapper:      "inline-flex items-center gap-2 cursor-pointer",
    track:        "relative inline-flex h-5 w-9 items-center rounded-full bg-slate-300 transition-colors",
    trackChecked: "relative inline-flex h-5 w-9 items-center rounded-full bg-[#1F3F8F] transition-colors",
    thumb:        "inline-block h-4 w-4 rounded-full bg-white shadow translate-x-0.5 transition-transform",
    thumbChecked: "inline-block h-4 w-4 rounded-full bg-white shadow translate-x-4 transition-transform",
    label:        "font-proxima text-[13px] text-slate-700",
  }],
};

// ─────────────────────────────────────────────────────────────────────────────
// field / label
// ─────────────────────────────────────────────────────────────────────────────
const field = {
  field:       "flex flex-col gap-1.5 pb-2",
  label:       "font-display uppercase text-[11px] tracking-[0.16em] text-slate-600",
  description: "font-proxima text-[12px] text-slate-500",
  error:       "font-proxima text-[12px] text-[#EF4444]",
};

const labelTheme = {
  labelWrapper: "px-2.5 pt-2 pb-1.5 rounded-md",
  label:        "inline-flex items-center rounded-[4px] px-1.5 py-0.5 text-[12.5px] font-medium",
};

// ─────────────────────────────────────────────────────────────────────────────
// dialog / modal — flat themes.
//
// The brand modal palette: bone surface, square corners (Tessera-style is
// rounded; TransportNY is institutional and prefers crisp). The shared
// `useModal` hook reads header/title/closeButton.
// ─────────────────────────────────────────────────────────────────────────────
const dialog = {
  backdrop:          "fixed inset-0 bg-zinc-950/40",
  dialogContainer:   "fixed inset-0 z-50 w-screen overflow-y-auto pt-6 sm:pt-0",
  dialogContainer2:  "relative grid min-h-full grid-rows-[1fr_auto] justify-items-center sm:grid-rows-[1fr_auto_3fr] sm:p-4",
  dialogPanel:       "row-start-2 w-full min-w-0 rounded-t-[12px] sm:rounded-[8px] bg-white p-8 shadow-2xl ring-1 ring-zinc-950/10 sm:mb-auto",
  sizes: {
    xs:    "sm:max-w-xs",
    sm:    "sm:max-w-sm",
    md:    "sm:max-w-md",
    lg:    "sm:max-w-lg",
    xl:    "sm:max-w-xl",
    "2xl": "sm:max-w-2xl",
    "3xl": "sm:max-w-3xl",
    "4xl": "sm:max-w-4xl",
    "5xl": "sm:max-w-5xl",
  },
};

const modal = {
  // Outer wrapper + backdrop + panel (the keys useModal reads).
  wrapper:     "fixed inset-0 z-50 flex items-center justify-center p-4",
  backdrop:    "absolute inset-0 bg-zinc-950/40",
  panel:       "relative bg-white border border-zinc-950/10 shadow-2xl rounded-[8px] p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto",
  header:      "flex items-center justify-between mb-4 pb-4 border-b border-zinc-950/10",
  title:       "font-display uppercase text-[16px] tracking-wide text-[#0F1722]",
  closeButton: "cursor-pointer p-1 text-slate-500 hover:text-[#0F1722]",
  // Plus the dialog shape (for the SizedDialog flow):
  backdropDialog:   dialog.backdrop,
  dialogContainer:  dialog.dialogContainer,
  dialogContainer2: dialog.dialogContainer2,
  dialogPanel:      dialog.dialogPanel,
  sizes:            dialog.sizes,
};

const drawer = {
  options: { activeStyle: 0 },
  styles: [{
    name: "default",
    backdrop:  "fixed inset-0 bg-zinc-950/40 z-40",
    panel:     "fixed top-0 right-0 h-full w-80 bg-white border-l border-zinc-950/10 shadow-2xl z-50 flex flex-col",
    header:    "flex items-center justify-between p-4 border-b border-zinc-950/10",
    title:     "font-display uppercase text-[14px] tracking-wide text-[#0F1722]",
    body:      "flex-1 overflow-y-auto p-4",
    footer:    "p-4 border-t border-zinc-950/10 flex items-center justify-end gap-2",
    closeButton: "cursor-pointer text-slate-500 hover:text-[#0F1722]",
  }],
};

const deleteModal = {
  wrapper:     "max-w-md w-full bg-white rounded-[8px] border border-zinc-950/10 shadow-2xl p-6",
  title:       "font-display uppercase text-[14px] tracking-wide text-[#EF4444] mb-3",
  body:        "font-proxima text-[13.5px] text-slate-700 leading-[1.6]",
  actions:     "mt-5 flex items-center justify-end gap-2",
  confirmButton: "px-4 h-10 bg-[#EF4444] hover:bg-[#DC2626] border-b-4 border-[#991B1B] text-white font-display uppercase text-[13px] tracking-wide rounded-[6px]",
  cancelButton:  "px-4 h-10 border border-zinc-950/15 bg-white hover:bg-slate-50 text-slate-700 font-proxima text-[13px] rounded-[6px]",
};

const popup = {
  options: { activeStyle: 0 },
  styles: [{
    name: "default",
    wrapper: "absolute z-40 rounded-[6px] bg-[#0F1722] text-white text-[12px] px-2.5 py-1.5 shadow-lg font-proxima max-w-xs",
    arrow:   "absolute size-2 bg-[#0F1722] rotate-45",
  }],
};

// ─────────────────────────────────────────────────────────────────────────────
// navigableMenu — keyboard-navigable popover (section menus, toolbars)
// ─────────────────────────────────────────────────────────────────────────────
const navigableMenu = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: "default",
      button:        "h-7 w-7 inline-flex items-center justify-center rounded hover:bg-slate-100 text-slate-500 cursor-pointer",
      buttonHidden:  "hidden group-hover:flex",
      icon:          "More",
      iconWrapper:   "size-4",
      menuWrapper:       "bg-white border border-zinc-950/10 w-60 p-1 min-h-[60px] rounded-[8px] shadow-lg",
      menuHeaderWrapper: "flex px-2 py-1 justify-between items-center",
      menuTitle:         "font-display uppercase text-[11px] tracking-wide text-slate-500",
      menuItemsWrapper:  "max-h-[60vh] overflow-y-auto",
      menuItem:                "group flex w-full gap-2 items-center justify-between px-2.5 py-1.5 rounded-[6px] text-[13px] text-slate-700",
      menuItemHover:           "hover:bg-slate-50 hover:text-[#0F1722]",
      menuItemIconLabelWrapper:"flex flex-1 items-center gap-2",
      menuItemIconWrapper:     "size-4 text-slate-500 group-hover:text-slate-700",
      menuItemLabel:           "text-slate-700",
      subMenuIcon:        "ChevronRight",
      subMenuIconWrapper: "size-3.5 text-slate-400",
      valueWrapper:       "px-1.5 rounded bg-slate-100 text-slate-700 text-[12px]",
      separator:          "w-full border-b border-zinc-950/05 my-1",
    },
    {
      name: "dark",
      menuWrapper:           "bg-[#1a2029] border border-[#3a4555] w-60 p-1 min-h-[60px] rounded-[8px] shadow-2xl",
      menuItem:              "group flex w-full gap-2 items-center justify-between px-2.5 py-1.5 rounded-[6px] text-[13px] text-slate-300",
      menuItemHover:         "hover:bg-[#2a3545] hover:text-white",
      menuItemLabel:         "text-slate-300",
      menuItemIconWrapper:   "size-4 text-slate-400 group-hover:text-slate-200",
      separator:             "w-full border-b border-[#3a4555] my-1",
    },
    {
      name: "dock",
      // Floating black-pill dock (editor view).
      menuWrapper: "rounded-full bg-[#1a2029] text-white inline-flex items-center gap-3 px-3 h-10 shadow-2xl",
      menuItem:    "size-6 flex items-center justify-center text-slate-300 hover:text-[#FACC15] cursor-pointer",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// nestable / nestableInHouse — drag-to-nest lists (page tree, side-nav editor)
// ─────────────────────────────────────────────────────────────────────────────
const nestable = {
  options: { activeStyle: 0 },
  styles: [{
    name: "default",
    wrapper:     "flex flex-col text-[13px] font-proxima",
    item:        "flex items-center gap-2 px-2 py-1 hover:bg-slate-50 cursor-pointer text-slate-700",
    itemActive:  "flex items-center gap-2 px-2 py-1 bg-[#1F3F8F]/10 text-[#0F2D4D] font-medium cursor-pointer",
    handle:      "text-slate-300 hover:text-slate-500 cursor-grab",
    indent:      "pl-4",
    dropTarget:  "border-2 border-dashed border-[#FACC15] bg-amber-50/40 rounded-[4px]",
  }],
};

const nestableInHouse = { ...nestable };

// ─────────────────────────────────────────────────────────────────────────────
// dataCard — the workhorse Card primitive.
//
// styles[0] is the complete default (single-column "every section on its
// own row" rule). Named variants:
//   • kpi        → tight KPI card · kicker → value → delta
//   • compliance → KPI with target-bar (federal reporting)
//   • editorial  → bone surface, amber-underlined title, printable
//   • title_bar  → tinted title bar w/ Display dropdown + drag handle
//   • compact    → smaller padding for dashboard tile strips
//   • dashboard  → dashboard-shaped card, no chrome
// ─────────────────────────────────────────────────────────────────────────────
const dataCard = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: "default",
      // Card surface (matches .tny-card)
      wrapper:                       "rounded-[8px] border border-zinc-950/10 bg-white shadow-sm overflow-hidden",
      cardsGrid:                     "grid gap-4",
      cellsGrid:                     "grid",
      subWrapper:                    "flex flex-col w-full",
      subWrapperCompactView:         "rounded-[8px] bg-white",

      // Headers + values
      header:                        "font-display uppercase text-[12.5px] tracking-[0.04em] text-slate-500 px-3 pt-3 pb-1",
      headerValueWrapper:            "flex flex-col w-full",
      headerValueWrapperFullBleed:   "w-full relative overflow-hidden",
      headerValueWrapperBorderBelow: "border-b border-zinc-950/05 rounded-none",
      value:                         "px-3 pb-3 text-[14px] text-[#0F1722]",
      valueWrapper:                  "min-h-[20px]",
      description:                   "font-proxima text-[12px] font-light text-slate-500 px-3 pb-2",
      itemBorder:                    "border border-zinc-950/05",
      cardBorder:                    "border border-zinc-950/10",
      cellBorderBelow:               "border-b border-zinc-950/05",

      // Image cell sizing (used when type:'image')
      imgXS:      "max-w-16 max-h-16",
      imgSM:      "max-w-24 max-h-24",
      imgMD:      "max-w-32 max-h-32",
      imgXL:      "max-w-40 max-h-40",
      img2XL:     "max-w-48 max-h-48",
      img3XL:     "max-w-56 max-h-56",
      img4XL:     "max-w-64 max-h-64",
      img5XL:     "max-w-72 max-h-72",
      img6XL:     "max-w-80 max-h-80",
      img7XL:     "max-w-96 max-h-96",
      img8XL:     "max-w-[32rem] max-h-[32rem]",
      imgDefault: "max-w-[50px] max-h-[50px]",

      // Mirrors of textSettings so Card cells can resolve a font-style
      // by name without going up to textSettings. DMS reads
      // valueFontStyle from this dictionary first then falls back.
      // Brand ladder
      displayHero:     `${F_DISP} font-semibold text-[52px] leading-[1.02] tracking-tight`,
      displayXL:       `${F_DISP} font-semibold text-[44px] leading-[1.05] tracking-tight`,
      displayLG:       `${F_DISP} font-semibold text-[38px] leading-[1.05] tracking-tight uppercase`,
      displayMD:       `${F_DISP} font-semibold text-[28px] leading-[1.1]`,
      displaySM:       `${F_DISP} font-medium text-[22px] leading-[1.2]`,
      displayXS:       `${F_DISP} font-medium text-[18px] leading-[1.25]`,
      proseLG:         `${F_SANS} text-[16px] leading-[1.65]`,
      prose:           `${F_SANS} text-[14.5px] leading-[1.65]`,
      proseSM:         `${F_SANS} text-[12.5px] leading-[1.55]`,
      proseXS:         `${F_SANS} text-[11.5px] leading-[1.5]`,
      metaMD:          `${F_MONO} text-[12px] leading-[1.45] tabular-nums`,
      metaSM:          `${F_MONO} text-[10.5px] uppercase tracking-[0.18em]`,
      metaXS:          `${F_MONO} text-[9.5px] uppercase tracking-[0.18em]`,
      kicker:          `${F_MONO} text-[10.5px] uppercase tracking-[0.2em] text-[#CA8A04]`,
      // Generic ladder
      textXS:           "text-[11px] font-medium",
      textXSReg:        "text-[11px] font-normal",
      textSM:           "text-[12.5px] font-medium",
      textSMReg:        "text-[12.5px] font-normal",
      textSMBold:       "text-[12.5px] font-bold",
      textSMSemiBold:   "text-[12.5px] font-semibold",
      textMD:           "text-[15px] font-medium",
      textMDReg:        "text-[15px] font-normal",
      textMDBold:       "text-[15px] font-bold",
      textMDSemiBold:   "text-[15px] font-semibold",
      textXL:           `text-[20px] font-medium ${F_DISP}`,
      textXLSemiBold:   `text-[20px] font-semibold ${F_DISP}`,
      text2XL:          `text-[24px] font-semibold ${F_DISP}`,
      text2XLReg:       `text-[24px] font-normal ${F_DISP}`,
      text3XL:          `text-[28px] font-semibold ${F_DISP}`,
      text3XLReg:       `text-[28px] font-normal ${F_DISP}`,
      text4XL:          `text-[34px] font-semibold ${F_DISP} tracking-tight`,
      text5XL:          `text-[40px] font-semibold ${F_DISP} tracking-tight`,
      text6XL:          `text-[52px] font-semibold ${F_DISP} tracking-tight`,
      text7XL:          `text-[64px] font-semibold ${F_DISP} tracking-tight`,
      text8XL:          `text-[80px] font-semibold ${F_DISP} tracking-tight`,
      numLG:            `${F_MONO} text-[22px] font-medium tabular-nums text-[#0F1722]`,
      numXL:            `${F_MONO} text-[28px] font-medium tabular-nums text-[#0F1722]`,
      num2XL:           `${F_MONO} text-[40px] font-medium tabular-nums text-[#0F1722]`,

      justifyTextLeft:   "text-start justify-items-start",
      justifyTextRight:  "text-end justify-items-end",
      justifyTextCenter: "text-center justify-items-center",
      justifyTextFull:   "text-justify",
    },
    {
      name: "kpi",
      // Tight KPI card. Single-column rule still applies — kicker, value,
      // delta each on their own line.
      wrapper:     "rounded-[8px] border border-zinc-950/10 bg-white shadow-sm p-5 flex flex-col gap-2",
      header:      "font-display font-medium text-[15px] text-[#0f1722] leading-tight",
      value:       `${F_MONO} text-[40px] font-medium tabular-nums text-[#0F1722]`,
      description: "font-proxima text-[12.5px] text-slate-600 leading-snug",
    },
    {
      name: "compliance",
      // KPI with target bar built in. Adds the bar inline; authors style
      // it via a separate column with formatFn 'comma' + a 'target_bar'
      // column type (or as a Lexical embed).
      wrapper:     "rounded-[8px] border border-zinc-950/10 bg-white shadow-sm p-5 flex flex-col gap-3",
      header:      "font-display font-medium text-[15px] text-[#0f1722] leading-tight",
      value:       `${F_MONO} text-[40px] font-medium tabular-nums text-[#0F1722]`,
    },
    {
      name: "editorial",
      // Warm bone surface for printable narrative cards
      wrapper: "rounded-[8px] border-2 border-dashed border-amber-300 bg-[#F5F1E8] p-6",
      header:  "font-display uppercase font-bold text-[14px] tracking-wide text-[#0F1722] border-b-2 border-[#EAAD43] inline-block pb-0.5",
      value:   "text-[13px] text-slate-700 mt-3 leading-[1.65]",
    },
    {
      name: "title_bar",
      // Card with a tinted title bar (Display dropdown + drag handle row)
      wrapper: "rounded-[8px] border border-zinc-950/10 bg-white shadow-sm overflow-hidden",
      header:  "h-11 px-3 flex items-center gap-2 border-b border-zinc-950/10 bg-slate-50/60 font-display font-medium text-[14px] text-[#2D3E4C]",
      value:   "p-4 text-[14px] text-[#0F1722]",
    },
    {
      name: "compact",
      // Smaller padding — dashboard tile strips.
      wrapper:     "rounded-[8px] border border-zinc-950/10 bg-white shadow-sm p-4 flex flex-col gap-2 relative",
      header:      "font-display uppercase text-[10.5px] tracking-[0.18em] text-slate-500",
      value:       `${F_MONO} text-[24px] font-medium tabular-nums text-[#0F1722]`,
      description: "font-proxima text-[11.5px] text-slate-500",
    },
    {
      name: "dashboard",
      // Even tighter — no chrome, used for inline metric rows.
      wrapper:     "rounded-[6px] border border-zinc-950/05 bg-white p-3 flex items-center gap-3",
      header:      "font-display uppercase text-[10.5px] tracking-[0.18em] text-slate-500",
      value:       `${F_MONO} text-[18px] font-medium tabular-nums text-[#0F1722]`,
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// card — generic small container card (less rich than dataCard)
// ─────────────────────────────────────────────────────────────────────────────
const card = {
  options: { activeStyle: 0 },
  styles: [{
    name: "default",
    wrapper: "rounded-[8px] border border-zinc-950/10 bg-white shadow-sm",
    header:  "px-4 py-3 border-b border-zinc-950/05 font-display uppercase text-[12.5px] tracking-wide text-slate-700",
    body:    "p-4 text-[14px] text-slate-700",
    footer:  "px-4 py-3 border-t border-zinc-950/05 text-[12px] text-slate-500",
  }],
};

// ─────────────────────────────────────────────────────────────────────────────
// pill — status / badge / token
// ─────────────────────────────────────────────────────────────────────────────
const pill = {
  options: { activeStyle: 0 },
  styles: [
    { name: "default", wrapper: "inline-flex items-center gap-1.5 px-2 h-6 rounded-[4px] text-[11.5px] font-medium border border-zinc-950/10 bg-slate-100 text-slate-700" },
    { name: "blue",    wrapper: "inline-flex items-center gap-1.5 px-2 h-6 rounded-[4px] text-[11.5px] font-medium border border-[#1F3F8F]/20 bg-[#1F3F8F]/10 text-[#0F2D4D]" },
    { name: "slate",   wrapper: "inline-flex items-center gap-1.5 px-2 h-6 rounded-[4px] text-[11.5px] font-medium border border-[#37576B]/20 bg-[#37576B]/10 text-[#0F2D4D]" },
    { name: "amber",   wrapper: "inline-flex items-center gap-1.5 px-2 h-6 rounded-[4px] text-[11.5px] font-medium border border-[#EAAD43]/30 bg-[#EAAD43]/15 text-[#7C5A12]" },
    { name: "green",   wrapper: "inline-flex items-center gap-1.5 px-2 h-6 rounded-[4px] text-[11.5px] font-medium border border-[#10B981]/30 bg-[#10B981]/10 text-[#065F46]" },
    { name: "red",     wrapper: "inline-flex items-center gap-1.5 px-2 h-6 rounded-[4px] text-[11.5px] font-medium border border-[#EF4444]/30 bg-[#EF4444]/10 text-[#991B1B]" },
    { name: "zinc",    wrapper: "inline-flex items-center gap-1.5 px-2 h-6 rounded-[4px] text-[11.5px] font-medium border border-zinc-950/10 bg-slate-100 text-slate-700" },
    { name: "ink",     wrapper: "inline-flex items-center gap-1.5 px-2 h-6 rounded-[4px] text-[11.5px] font-medium bg-[#0a0e13] text-white font-display uppercase tracking-wide" },
    // Brand "beta" / "admin" pills
    { name: "beta",    wrapper: "inline-flex items-center px-2 h-6 rounded-[4px] text-[11px] font-medium bg-amber-100 text-amber-900 font-display uppercase tracking-wide" },
    { name: "admin",   wrapper: "inline-flex items-center px-2 h-6 rounded-[4px] text-[11px] font-medium bg-slate-900 text-white font-display uppercase tracking-wide" },
    // Status dots — a leading colored dot + label; never a colored bg.
    { name: "status_good", wrapper: "inline-flex items-center gap-1.5 text-[12px] text-emerald-700 [&::before]:content-[''] [&::before]:size-1.5 [&::before]:rounded-full [&::before]:bg-emerald-500" },
    { name: "status_warn", wrapper: "inline-flex items-center gap-1.5 text-[12px] text-amber-700 [&::before]:content-[''] [&::before]:size-1.5 [&::before]:rounded-full [&::before]:bg-amber-400" },
    { name: "status_bad",  wrapper: "inline-flex items-center gap-1.5 text-[12px] text-rose-700 [&::before]:content-[''] [&::before]:size-1.5 [&::before]:rounded-full [&::before]:bg-rose-500" },
    { name: "status_na",   wrapper: "inline-flex items-center gap-1.5 text-[12px] text-slate-500 [&::before]:content-[''] [&::before]:size-1.5 [&::before]:rounded-full [&::before]:bg-slate-400" },
    // Route chip — the colored-dot pill that lives in tone_bar_dark.
    { name: "route", wrapper: "inline-flex items-center gap-2 h-8 pl-2.5 pr-2 rounded-full bg-white text-slate-700 shadow-sm border border-zinc-950/5 text-[12.5px] font-proxima" },
  ],
};

const pagination = {
  options: { activeStyle: 0 },
  styles: [{
    name: "default",
    wrapper:     "flex items-center gap-1 justify-between px-3 h-10 border-t border-zinc-950/05 bg-slate-50/40",
    info:        "font-mono text-[11px] uppercase tracking-wider text-slate-500",
    pageButton:  "h-7 min-w-7 px-2 inline-flex items-center justify-center text-[12px] text-slate-600 hover:bg-slate-100 rounded cursor-pointer",
    pageButtonActive: "h-7 min-w-7 px-2 inline-flex items-center justify-center text-[12px] text-[#0F1722] bg-white border border-zinc-950/10 rounded font-medium cursor-pointer",
    arrowButton: "h-7 w-7 inline-flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 cursor-pointer",
  }],
};

// ─────────────────────────────────────────────────────────────────────────────
// table — editorial (deep-navy header) and dashboard (light, amber-hover)
// ─────────────────────────────────────────────────────────────────────────────
const table = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: "default",
      // Dashboard table: light header, amber hover rows
      wrapper:                "rounded-[8px] border border-zinc-950/10 bg-white shadow-sm overflow-hidden",
      table:                  "w-full text-[13px] text-slate-700",
      thead:                  "bg-slate-50/80 border-b border-zinc-950/10",
      th:                     "px-3 py-2 text-left font-display uppercase text-[11px] tracking-wide text-slate-600",
      tr:                     "border-b border-zinc-950/05 hover:bg-[#FFFBEB]",
      trAlt:                  "border-b border-zinc-950/05 bg-slate-50/50 hover:bg-[#FFFBEB]",
      td:                     "px-3 py-2 text-[13px] text-slate-700",
      tdEdit:                 "px-3 py-2",
      headerCell:             "px-3 py-2 text-left font-display uppercase text-[11px] tracking-wide text-slate-600",
      headerCellSortable:     "px-3 py-2 text-left font-display uppercase text-[11px] tracking-wide text-slate-600 cursor-pointer hover:text-[#0F1722]",
      pagination:             "px-3 h-10 flex items-center justify-between border-t border-zinc-950/05 bg-slate-50/40",
      pageRangeItem:          "px-2 py-0.5 text-[12px] text-slate-600 hover:bg-slate-100 rounded cursor-pointer",
      pageRangeItemActive:    "px-2 py-0.5 text-[12px] text-[#0F1722] bg-slate-200 rounded font-medium",
      sortIcon:               "SortAsc",
      sortIconClass:          "size-3.5 text-slate-400 ml-1",
    },
    {
      name: "editorial",
      // Deep navy header, bone tint, for printable docs
      wrapper:    "rounded-[8px] border border-zinc-950/10 bg-[#F5F1E8] shadow-sm overflow-hidden",
      table:      "w-full text-[12.5px] text-[#0F1722] border-collapse",
      thead:      "bg-[#0F2D4D]",
      th:         "px-3 py-2 text-left font-display uppercase text-[11px] tracking-wide text-white border border-white",
      tr:         "border-b border-amber-900/10",
      td:         "px-3 py-1.5 text-[12.5px] text-[#0F1722] border border-slate-200",
    },
    {
      name: "compact",
      wrapper: "rounded-[6px] border border-zinc-950/05 bg-white overflow-hidden",
      table:   "w-full text-[12px] text-slate-700",
      thead:   "bg-white border-b border-zinc-950/05",
      th:      "px-2 py-1.5 text-left font-display uppercase text-[10px] tracking-wide text-slate-500",
      tr:      "border-b border-zinc-950/05",
      td:      "px-2 py-1.5 text-[12px] text-slate-700",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// lexical — rich text editor.
//
// Lexical's theme uses underscore-flat keys (heading_h1, list_ol, etc.), not
// nested objects. textSettings.h1..h6 only backfills these keys when
// they're absent — and the codebase default has them set, so the brand
// MUST set them explicitly (skill §3.1.5 Quirk 2).
// ─────────────────────────────────────────────────────────────────────────────
const lexical = {
  options: { activeStyle: 0 },
  styles: [{
    name: "default",

    // Heading roles — explicit so codebase defaults don't shadow.
    heading_h1: `${F_DISP} font-semibold text-[52px] leading-[1.02] tracking-tight ${INK} mt-8 mb-4 scroll-mt-36`,
    heading_h2: `${F_DISP} font-semibold text-[38px] leading-[1.05] tracking-tight uppercase ${INK} mt-7 mb-3 scroll-mt-36`,
    heading_h3: `${F_DISP} font-semibold text-[28px] leading-[1.1] ${INK} mt-6 mb-2 scroll-mt-36`,
    heading_h4: `${F_DISP} font-medium text-[20px] leading-[1.2] ${INK} mt-4 mb-2 scroll-mt-36`,
    heading_h5: `${F_DISP} font-medium text-[16px] leading-[1.3] uppercase tracking-wide ${INK} mt-3 mb-1 scroll-mt-36`,
    heading_h6: `${F_DISP} font-medium text-[14px] leading-[1.4] uppercase tracking-[0.16em] text-slate-700 mt-3 mb-1 scroll-mt-36`,

    paragraph:    `${F_SANS} text-[14.5px] leading-[1.65] text-slate-700 mb-3`,

    text_bold:    "font-semibold",
    text_italic:  "italic",
    text_underline: "underline underline-offset-2",
    text_code:    `${F_MONO} text-[0.92em] px-1.5 py-0.5 rounded bg-zinc-950/05 border border-zinc-950/06 text-[#37576B]`,
    text_strikethrough: "line-through",

    list_ol:                 "list-decimal pl-6 space-y-1 text-[14.5px] text-slate-700",
    list_ul:                 "list-disc pl-6 space-y-1 text-[14.5px] text-slate-700",
    list_listitem:           "leading-[1.65]",
    list_nested_listitem:    "list-none",

    link: "text-[#1F3F8F] underline underline-offset-2 hover:text-[#16307A]",
    quote: "border-l-4 border-[#EAAD43] pl-4 italic text-slate-600",
    code:  `${F_MONO} text-[12.5px] leading-[1.55] p-4 rounded-[6px] bg-[#0F1722] text-slate-100 overflow-x-auto block`,
    image: "rounded-[6px] my-4",

    // /Columns layout templates
    layoutContainer: "grid gap-3 mt-2",
    layoutItem:      "min-w-0 max-w-full",
    layoutItemEditable: "border border-dashed border-zinc-950/10",
    layoutTemplates: [
      { label: "2 columns (equal)",     value: "grid-cols-1 md:grid-cols-2", count: 2 },
      { label: "2 columns (1/3 + 2/3)", value: "grid-cols-1 md:grid-cols-[1fr_2fr]", count: 2 },
      { label: "2 columns (2/3 + 1/3)", value: "grid-cols-1 md:grid-cols-[2fr_1fr]", count: 2 },
      { label: "3 columns (equal)",     value: "grid-cols-1 md:grid-cols-3", count: 3 },
      { label: "4 columns (equal)",     value: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4", count: 4 },
      // Prose + TOC: 720px-prose-left + 220-toc-right
      { label: "Prose + TOC", value: "grid-cols-1 md:grid-cols-[1fr_220px]", count: 2 },
    ],
  }],
};

// ─────────────────────────────────────────────────────────────────────────────
// graph / avlGraph — chart container, axis, tooltip, palettes
// ─────────────────────────────────────────────────────────────────────────────
const graph = {
  options: { activeStyle: 0 },
  styles: [{
    name: "default",
    text:         `${F_SANS} text-[12px] text-slate-600`,
    darkModeText: `${F_SANS} text-[12px] text-white bg-transparent`,
    headerWrapper:"flex items-baseline justify-between mb-2",
    title:        "font-display uppercase text-[12.5px] tracking-wide text-slate-700",
    subtitle:     "font-mono text-[10.5px] uppercase tracking-wider text-slate-500",
    axis:         "stroke-zinc-950/15",
    grid:         "stroke-zinc-950/05",
    tooltip:      "rounded-[6px] bg-[#0F1722] text-white text-[12px] px-2.5 py-1.5 shadow-lg font-proxima",
    legend:       "flex items-center gap-4 font-mono text-[10.5px] uppercase tracking-wider text-slate-500",
    legendSwatch: "h-0.5 w-4",
    // Categorical palette (max 5)
    catPalette:     ["#6F6F6F", "#E5A646", "#94C24E", "#E160A4", "#F2CB3D"],
    // Sequential speed ramp (slowest → freeflow)
    seqSpeedPalette:["#D6453B", "#E8843F", "#F2E18A", "#A8D26B", "#3FA34D"],
    // Single-series primary + area
    primary:        "#1F3F8F",
    primaryArea:    "rgba(31,63,143,0.15)",
    targetLine:     "stroke-amber-400 [stroke-dasharray:4_3]",
    targetLabel:    "font-mono text-[10.5px] uppercase tracking-wider text-amber-700",
    focusLine:      "stroke-[#0F1722] [stroke-dasharray:2_3]",
    peakDot:        "fill-white stroke-[#1F3F8F]",
  }],
};

const avlGraph = graph;

// ─────────────────────────────────────────────────────────────────────────────
// map — MapLibre wrapper
// ─────────────────────────────────────────────────────────────────────────────
const map = {
  options: { activeStyle: 0 },
  styles: [{
    name: "default",
    container:   "relative rounded-[8px] border border-zinc-950/10 overflow-hidden bg-[#E8E4D2] tny-map",
    controls:    "absolute top-2 right-2 flex flex-col gap-1 rounded-[6px] bg-white shadow-md p-1",
    legend:      "absolute bottom-2 left-2 rounded-[6px] bg-white shadow-md p-3 border border-zinc-950/10",
    legendTitle: "font-display uppercase text-[11px] tracking-wide text-slate-600 mb-1.5",
    popover:     "rounded-[6px] bg-white shadow-lg border border-zinc-950/10 p-3 text-[12.5px]",
  }],
};

// ─────────────────────────────────────────────────────────────────────────────
// icon
// ─────────────────────────────────────────────────────────────────────────────
const iconTheme = {
  iconWrapper: "",
  icon: "size-5",
};

// ─────────────────────────────────────────────────────────────────────────────
// attribution / filters — data-section chrome
// ─────────────────────────────────────────────────────────────────────────────
const attribution = {
  wrapper: "w-full px-3 py-1.5 flex gap-2 text-[11px] text-slate-500 font-mono uppercase tracking-wide border-t border-zinc-950/05 bg-slate-50/40",
  label:   "",
  link:    "text-[#1F3F8F] hover:text-[#16307A]",
};

const filters = {
  filterLabel:                 "font-display uppercase text-[11px] tracking-wide text-slate-500 mb-1",
  loadingText:                 "text-[12px] text-slate-400",
  filterSettingsWrapperInline: "w-2/3",
  filterSettingsWrapperStacked:"w-full",
  labelWrapperInline:          "w-1/3 text-[12px]",
  labelWrapperStacked:         "w-full text-[12px]",
  input:                       "w-full max-h-[150px] flex text-[12px] overflow-auto border border-zinc-950/10 rounded-[6px] bg-white p-2",
  settingPillsWrapper:         "flex flex-row flex-wrap gap-1",
  settingPill:                 "px-1.5 py-0.5 bg-[#EAAD43]/15 text-amber-800 hover:bg-[#EAAD43]/25 rounded-[4px] text-[11.5px]",
  settingLabel:                "text-slate-700 font-medium",
  filtersWrapper:              "w-full p-3 flex flex-col gap-2 rounded-[6px] bg-slate-50/60",
};

// ─────────────────────────────────────────────────────────────────────────────
// pages.* — pattern-level chrome for the page pattern
//
// THE single most important override here is `sectionArray`. v1 set
// gridSize: 12 but didn't add _replace:['sizes'] or defaultSize, so the
// codebase's `"1"` (which means "full row" on a 6-col grid) leaked
// through and meant "1/12" on a 12-col grid — every section the editor
// created sat at 8% width. v2 wholesale-replaces the sizes map and
// pins defaultSize to '12'.
// ─────────────────────────────────────────────────────────────────────────────
const pages = {

  // Section chrome (drag handles, titles, edit-mode toolbar)
  section: {
    options: { activeStyle: 0 },
    styles: [{
      name: "default",
      wrapper:       "",
      wrapperHidden: "hidden",
      topBar:        "flex w-full",
      topBarSpacer:  "flex-1",
      menuPosition:  "absolute top-2 right-2 items-center",
      editIcon:      "hover:text-[#1F3F8F] size-5",
      contentWrapper:"h-full",
    }],
  },

  // Section group (the column grid every Section sits on)
  sectionArray: {
    options: { activeStyle: 0 },
    styles: [{
      name: "default",
      _replace: ["sizes"], // wholesale-replace; don't merge with codebase keys
      wrapper:        "relative",
      container:      "w-full grid grid-cols-12 gap-6",
      gridSize:       12,
      defaultSize:    "12",
      sectionPadding: "p-2",
      layouts: {
        centered:  "max-w-[1480px] mr-auto",
        fullwidth: "",
      },
      sizes: {
        "1":  { className: "col-span-12 md:col-span-1",  iconSize: 8.3 },
        "2":  { className: "col-span-12 md:col-span-2",  iconSize: 16.7 },
        "3":  { className: "col-span-12 md:col-span-3",  iconSize: 25 },
        "4":  { className: "col-span-12 md:col-span-4",  iconSize: 33.3 },
        "5":  { className: "col-span-12 md:col-span-5",  iconSize: 41.7 },
        "6":  { className: "col-span-12 md:col-span-6",  iconSize: 50 },
        "7":  { className: "col-span-12 md:col-span-7",  iconSize: 58.3 },
        "8":  { className: "col-span-12 md:col-span-8",  iconSize: 66.7 },
        "9":  { className: "col-span-12 md:col-span-9",  iconSize: 75 },
        "10": { className: "col-span-12 md:col-span-10", iconSize: 83.3 },
        "11": { className: "col-span-12 md:col-span-11", iconSize: 91.7 },
        "12": { className: "col-span-12 md:col-span-12", iconSize: 100 },
      },
      rowspans: {
        "1": "row-span-1",
        "2": "row-span-2",
        "3": "row-span-3",
      },
      // Edit-mode chrome — re-skinned in brand palette so it doesn't
      // leak blue/orange from the Catalyst defaults.
      border: {
        none:       "",
        full:       "rounded-[8px] border border-zinc-950/10 bg-white shadow-sm",
        openLeft:   "rounded-r-[8px] border border-zinc-950/10 border-l-transparent bg-white shadow-sm",
        openRight:  "rounded-l-[8px] border border-zinc-950/10 border-r-transparent bg-white shadow-sm",
        openTop:    "rounded-b-[8px] border border-zinc-950/10 border-t-transparent bg-white shadow-sm",
        openBottom: "rounded-t-[8px] border border-zinc-950/10 border-b-transparent bg-white shadow-sm",
      },
      sectionEditHover: "outline outline-2 outline-[#FACC15]/60",
      sectionEditing:   "outline outline-2 outline-[#FACC15]",
      addSectionIcon:   "Plus",
      addSectionIconClass: "size-3.5 text-white",
      addSectionText:   "bg-[#1F3F8F] text-white px-3 h-8 inline-flex items-center gap-1.5 rounded-[6px] font-display uppercase text-[11px] tracking-wide",
      gridviewGrid:     "grid grid-cols-12 gap-6 [&>*]:bg-[#FACC15]/15 [&>*]:border [&>*]:border-dashed [&>*]:border-[#FACC15]/40 [&>*]:rounded-[6px] [&>*]:min-h-12",
      gridviewItem:     "bg-[#FACC15]/15 border border-dashed border-[#FACC15]/40 rounded-[6px]",
    }],
  },

  // Section-groups pane (admin edit mode)
  sectionGroupsPane: {
    wrapper:        "w-72 bg-white border-l border-zinc-950/10 p-4 overflow-y-auto",
    title:          "font-display uppercase text-[12.5px] tracking-wide text-slate-700 mb-3",
    groupRow:       "flex items-center gap-2 px-2 py-1.5 rounded-[4px] hover:bg-slate-50 cursor-pointer text-[13px] text-slate-700",
    groupRowActive: "flex items-center gap-2 px-2 py-1.5 rounded-[4px] bg-[#1F3F8F]/10 text-[#0F2D4D] cursor-pointer text-[13px] font-medium",
  },

  // Search button (in the side nav)
  searchButton: {
    options: { activeStyle: 0 },
    styles: [{
      name: "default",
      button:      "w-full h-9 px-3 rounded-full bg-[#1a2029] border border-[#2a3545] hover:border-[#3a4555] flex items-center gap-2 text-slate-400 hover:text-slate-300 cursor-pointer",
      buttonText:  "font-proxima text-[13px] flex-1 text-left",
      iconWrapper: "size-4",
      icon:        "Search",
    }],
  },

  // Search pallet (Cmd-K modal)
  searchPallet: {
    options: { activeStyle: 0 },
    styles: [{
      name: "default",
      backdrop:          "fixed inset-0 bg-black/60",
      dialogContainer:   "fixed inset-0 z-50 w-screen overflow-y-auto p-6 sm:p-20 flex items-start justify-center",
      dialogPanel:       "relative w-full max-w-2xl flex flex-col gap-2 rounded-[12px] bg-[#1a2029] border border-[#3a4555] p-4 shadow-2xl",
      inputWrapper:      "flex items-center gap-2 px-4 h-12 bg-[#12181F] rounded-[8px] border border-[#2a3545]",
      input:             "flex-1 bg-transparent text-white text-[14px] focus:outline-none placeholder:text-slate-500",
      searchIcon:        "Search",
      searchIconClass:   "text-slate-400 size-5",
      resultsWrapper:    "bg-[#12181F] rounded-[8px] divide-y divide-[#2a3545] max-h-[400px] overflow-y-auto",
      pageResultWrapper: "flex items-center gap-2 px-4 py-3 hover:bg-[#1e2530] cursor-pointer",
      pageTitle:         "font-display uppercase text-[14px] text-slate-200",
      sectionTitle:      "font-proxima text-[13px] text-slate-400",
    }],
  },

  // Complex filters editor
  complexFilters: {
    wrapper:     "rounded-[8px] border border-zinc-950/10 bg-slate-50/60 p-3",
    headerRow:   "flex items-center gap-2 mb-2",
    headerLabel: "font-display uppercase text-[11px] tracking-wide text-slate-600",
    addButton:   "ml-auto text-[12px] text-[#1F3F8F] hover:text-[#16307A] cursor-pointer",
    filterRow:   "flex items-center gap-2 px-2 py-1.5 bg-white rounded-[4px] border border-zinc-950/05 text-[13px] text-slate-700",
    operator:    "font-mono text-[11px] uppercase tracking-wide text-slate-500 px-2",
  },

  // Attribution chip
  attribution: { ...attribution },

  // Page-tree / TOC editor
  pageTree: {
    wrapper:    "flex flex-col text-[13px] font-proxima",
    item:       "flex items-center gap-2 px-2 py-1 hover:bg-slate-50 cursor-pointer text-slate-700",
    itemActive: "flex items-center gap-2 px-2 py-1 bg-[#1F3F8F]/10 text-[#0F2D4D] font-medium cursor-pointer",
    handle:     "text-slate-300 hover:text-slate-500 cursor-grab",
  },

  // User menu in the bottom of the side nav
  userMenu: {
    options: { activeStyle: 0 },
    styles: [{
      name: "default",
      userMenuContainer: "flex items-center gap-3 px-4 py-2",
      avatar:            "w-8 h-8 rounded-full bg-gradient-to-br from-[#37576B] to-[#1f3450] flex items-center justify-center text-white text-[11px] font-medium ring-1 ring-[#FACC15]/20",
      avatarIcon:        "User",
      infoWrapper:       "flex-1 min-w-0",
      emailText:         "font-mono text-slate-400 text-[10px] uppercase tracking-[0.18em] truncate",
      groupText:         "font-display uppercase text-white text-[12px] tracking-wide truncate",
      loginWrapper:      "flex items-center gap-3 px-4 py-2 hover:bg-[#1e2530] cursor-pointer",
      loginIcon:         "size-4 text-slate-400",
      loginText:         "font-display uppercase text-white text-[12px] tracking-wide",
    }],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// datasets.* — pattern-level chrome for the dataset pattern
// ─────────────────────────────────────────────────────────────────────────────
const datasets = {
  breadcrumbs: {
    nav:       "border-b border-zinc-950/10 flex h-10 bg-white",
    ol:        "w-full px-8 flex items-center space-x-3",
    li:        "flex items-center",
    link:      "font-mono text-[11px] uppercase tracking-[0.16em] text-slate-500 hover:text-[#0F1722]",
    homeLink:  "text-slate-400 hover:text-[#1F3F8F]",
    separator: "size-4 text-slate-300 mx-1",
  },
  datasetsList: {
    pageWrapper:    "mx-auto max-w-[1280px] w-full px-8 py-8",
    categoryHeader: "font-display uppercase text-[14px] tracking-wide text-slate-700 mb-3",
    cardGrid:       "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4",
    datasetCard:    "rounded-[8px] border border-zinc-950/10 bg-white shadow-sm p-4 hover:border-[#37576B] transition-colors cursor-pointer",
    datasetTitle:   "font-display uppercase text-[14px] tracking-wide text-[#0F1722]",
    datasetMeta:    "font-mono text-[11px] uppercase tracking-wide text-slate-500 mt-1",
    datasetDesc:    "font-proxima text-[13px] text-slate-600 mt-2 leading-relaxed",
  },
  metadataComp: {
    wrapper:    "rounded-[8px] border border-zinc-950/10 bg-white p-6 shadow-sm",
    fieldRow:   "grid grid-cols-[200px_1fr] gap-6 py-3 border-b border-zinc-950/05",
    fieldLabel: "font-display uppercase text-[11px] tracking-wide text-slate-500",
    fieldValue: "font-proxima text-[13.5px] text-slate-700",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// auth.*
// ─────────────────────────────────────────────────────────────────────────────
const auth = {
  login: {
    wrapper:      "rounded-[8px] border border-zinc-950/10 bg-white shadow-sm p-8 w-full max-w-md",
    title:        "font-display uppercase text-[20px] tracking-tight text-[#0F1722] mb-6",
    fieldStack:   "flex flex-col gap-4 mb-5",
    submitButton: "w-full",
    divider:      "flex items-center gap-3 my-5 text-[11px] font-mono uppercase tracking-[0.18em] text-slate-400 before:flex-1 before:h-px before:bg-zinc-950/10 after:flex-1 after:h-px after:bg-zinc-950/10",
    ssoButton:    "w-full h-11 inline-flex items-center justify-center gap-2 rounded-[6px] border border-zinc-950/15 bg-white hover:bg-slate-50 font-proxima text-[13.5px] text-slate-800",
  },
  signup: {
    wrapper: "rounded-[8px] border border-zinc-950/10 bg-white shadow-sm p-8 w-full max-w-md",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// fonts — the theme-owned font loader entry array.
//
// Consumed by ui/useTheme.js#getPatternTheme via `loadThemeFonts`. The
// runtime injects these into <head> idempotently once the theme is
// selected. Brands ship Oswald via Google Fonts (variable, opsz axis)
// + Source Sans 3 (open-source Proxima Nova substitute) via woff2 at
// /themes/transportny/fonts/SourceSans3-Variable.woff2.
// ─────────────────────────────────────────────────────────────────────────────
const fonts = [
  {
    type: "google",
    href: "https://fonts.googleapis.com/css2?family=Oswald:wght@300..700&family=Source+Sans+3:ital,wght@0,300..700;1,300..700&display=swap",
  },
  {
    type: "tailwind",
    id: "transportny-tw-theme",
    content: `
      @theme {
        --font-display: "Oswald", "Bebas Neue", sans-serif;
        --font-sans: "Proxima Nova", "Source Sans 3", system-ui, sans-serif;
        --font-mono: "ui-monospace", "SFMono-Regular", "Menlo", monospace;
        --default-font-family: "Proxima Nova", "Source Sans 3", system-ui, sans-serif;
      }
    `,
  },
  {
    type: "style",
    id: "transportny-font-stacks",
    content: `
      :root, :host {
        --font-display: "Oswald", "Bebas Neue", sans-serif;
        --font-sans: "Proxima Nova", "Source Sans 3", system-ui, sans-serif;
        --font-mono: "ui-monospace", "SFMono-Regular", "Menlo", monospace;
        --default-font-family: "Proxima Nova", "Source Sans 3", system-ui, sans-serif;
      }
      html, body { font-family: var(--font-sans); }
      .font-display, .font-oswald { font-family: var(--font-display); }
      .font-sans, .font-proxima { font-family: var(--font-sans); }
      .font-mono { font-family: var(--font-mono); }
    `,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// THE THEME OVERLAY
// ─────────────────────────────────────────────────────────────────────────────
const transportnyTheme = {
  // Foundation
  textSettings,
  Icons: icons,
  fonts,

  // Composition
  layout,
  layoutGroup,

  // Navigation
  topnav,
  sidenav,
  navigableMenu,
  nestable,
  nestableInHouse,
  logo,

  // Interaction
  button,
  input,
  multiselect,
  tabs,
  switch: switchTheme,
  field,
  label: labelTheme,

  // Overlays
  dialog,
  modal,
  drawer,
  deleteModal,
  popup,

  // Containers / atoms
  dataCard,
  card,
  pill,
  pagination,
  icon: iconTheme,

  // Rich content
  lexical,
  graph,
  avlGraph,
  map,
  table,

  // Data-section chrome
  attribution,
  filters,

  // Pattern-level
  pages,
  datasets,
  auth,
};

export default transportnyTheme;
