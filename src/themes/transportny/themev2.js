// TransportNY · DMS theme overlay — v2
// ─────────────────────────────────────────────────────────────────────────────
// Built by translating the v2 design system at
// ./TransportNY Design System/dms_design_system_v2/  using the
// translating-design-system-to-dms-theme.md skill. Replaces theme.js
// once verified.
//
// What's preserved from the original theme.js (NOT taken from v2):
//   • Widget imports (LogoNav, QuickLinks) and the `widgets` registry
//   • pageComponents (AddPageButton, Header) — used as page-section types
//   • navOptions.authMenu (Datasets · Site Status)
//   • The full `sidenav` block — both `transportny-dark` (active) and
//     `compact` styles, verbatim. The user prefers where these are.
//   • layout.options.sideNav.bottomMenu — keeps QuickLinks alongside
//     UserMenu (v2's design didn't carry QuickLinks across)
//
// Everything else (textSettings, layoutGroup, topnav, button, dataCard,
// table, pill, lexical, pages.*, datasets.*, auth.*, …) is the v2
// translation.
//
// Suggestions for follow-up passes (NOT applied here):
//   - `logo` is shipped as a flat theme matching Logo.theme.js's
//     actual keys (logoWrapper / imgClass / titleWrapper / etc.). v2's
//     design system used renamed keys (wrapper/image/text) which would
//     have silently no-op'd against the source — skill §3.1. v1's
//     responsive `@container` behavior is preserved so the logo
//     collapses cleanly inside the active compact sidenav (hides
//     title under 120px).
//   - The sidenav block uses v2 brand conventions throughout:
//     `font-['Proxima_Nova']` → `font-proxima` (Tailwind v4 named
//     family from the @theme block) and `yellow-400` → `#FACC15`.
// ─────────────────────────────────────────────────────────────────────────────

import LogoNav from "./LogoNav";
import QuickLinks from "./QuickLinks";
import Header from "./components/Header";
import AddPageButton from "./components/AddPageButton";

import icons from "./icons";

// ─────────────────────────────────────────────────────────────────────────────
// textSettings — the global type scale.
//
// MEASURE RULE (page authoring): hero/section title + description blocks almost
// always want a section `size` of 6 or 8 — NOT 12 — to reproduce the designs'
// text wrap (the mockups cap ledes at ~640-760px). A full-width prose section
// reads as off-brand even with the right tokens. See
// skills/creating-pages-from-a-design-pattern.md §5.6.7 ("measure" pattern).
// ─────────────────────────────────────────────────────────────────────────────
const F_DISP = "font-display";   // Oswald
const F_SANS = "font-proxima";   // Proxima Nova / Source Sans 3
const F_MONO = "font-mono";

const INK   = "text-[#0F1722]";  // primary ink
const INK_2 = "text-[#37576B]";  // secondary ink

const textSettings = {
  options: {
    activeStyle: 0,
    slashKeys: [
      "displayMax", "displayHero", "displayXL", "displayLG", "displayMD", "displaySM", "displayXS",
      "displayItalicLG", "displayItalicMD",
      "proseLG", "prose", "proseSM", "proseXS",
      "metaMD", "metaSM", "metaXS", "metaAccent", "chip",
      "kicker", "cardTitle", "cardTitleSM",
      "statNum", "statXL", "statLG", "statMD",
    ],
  },
  styles: [{
    name: "default",

    // ── Heading roles — Lexical backfill, Header section ──
    // h1 is set to the displayLG style (38px uppercase) rather than
    // the 52px displayHero, because this site is product-page-heavy
    // and h1 → page title in most contexts. Reach displayHero
    // explicitly via styled-paragraph for marketing/landing heroes.
    h1: `${F_DISP} font-semibold text-[38px] leading-[1.05] tracking-tight uppercase ${INK} scroll-mt-36`,
    h2: `${F_DISP} font-semibold text-[28px] leading-[1.1] ${INK} scroll-mt-36`,
    h3: `${F_DISP} font-semibold text-[28px] leading-[1.1] ${INK} scroll-mt-36`,
    h4: `${F_DISP} font-medium text-[20px] leading-[1.2] ${INK} scroll-mt-36`,
    h5: `${F_DISP} font-medium text-[16px] leading-[1.3] uppercase tracking-wide ${INK} scroll-mt-36`,
    h6: `${F_DISP} font-medium text-[14px] leading-[1.4] uppercase tracking-[0.16em] text-slate-700 scroll-mt-36`,

    // ── Display ladder (Oswald) — chrome, page titles, KPI giants ──
    displayMax:  `${F_DISP} font-semibold text-[64px] leading-[1.02] tracking-tight ${INK}`,
    displayHero: `${F_DISP} font-semibold text-[52px] leading-[1.02] tracking-tight ${INK}`,
    displayXL:   `${F_DISP} font-semibold text-[44px] leading-[1.05] tracking-tight ${INK}`,
    displayLG:   `${F_DISP} font-semibold text-[38px] leading-[1.05] tracking-tight uppercase ${INK}`,
    displayMD:   `${F_DISP} font-semibold text-[28px] leading-[1.1] ${INK}`,
    displaySM:   `${F_DISP} font-medium text-[22px] leading-[1.2] ${INK}`,
    displayXS:   `${F_DISP} font-medium text-[18px] leading-[1.25] ${INK}`,

    // ── Display italic — editorial pull quotes ──
    displayItalicLG: `${F_DISP} italic font-medium text-[28px] leading-[1.2] ${INK_2}`,
    displayItalicMD: `${F_DISP} italic font-medium text-[20px] leading-[1.3] ${INK_2}`,

    // ── Prose ladder (Proxima Nova) — running copy ──
    proseLG: `${F_SANS} text-[16px] leading-[1.65] text-slate-700`,
    prose:   `${F_SANS} text-[14.5px] leading-[1.65] text-slate-700`,
    proseSM: `${F_SANS} text-[12.5px] leading-[1.55] text-slate-600`,
    proseXS: `${F_SANS} text-[11.5px] leading-[1.5] text-slate-500`,

    // ── Meta ladder (mono) — kickers, metadata, codes ──
    // The `!` (important) suffix on font/size/color overrides the
    // lexical.paragraph defaults that StyledParagraphNode appends
    // rather than replaces — without `!`, the paragraph's
    // text-[14.5px] font-sans text-slate-700 win over these tokens
    // (Tailwind compile order is non-deterministic for arbitrary
    // values). Leading/tracking/uppercase don't conflict so they
    // need no override.
    metaMD: `font-mono! text-[12px]! leading-[1.45] tabular-nums text-slate-600!`,
    metaSM: `font-mono! text-[11px]! leading-[1.4] uppercase tracking-[0.18em] text-slate-500!`,
    metaXS: `font-mono! text-[10px]! leading-[1.4] uppercase tracking-[0.18em] text-slate-400!`,
    // Accent meta — the amber data callout under hero KPIs ("51% non-recurrent —
    // incidents, work zones, weather"). Mono like metaMD, NOT uppercase, amber-700.
    metaAccent: `font-mono! text-[12px]! leading-[1.45] tabular-nums font-medium text-[#B45309]!`,
    // Chip — the bordered as-of badge on data cards ("2025 · statewide",
    // "thru 2026-04"). Mono micro-caps in a hairline rounded box; works as a
    // Card valueFontStyle or a Lexical /Style token.
    chip: `font-mono! text-[9.5px]! uppercase tracking-[0.14em] text-slate-400! border border-zinc-950/10 rounded px-1.5 py-0.5 inline-block w-fit`,

    // Editorial kicker — the "// 01" amber labels that head sections
    kicker: `font-mono! text-[11px]! uppercase tracking-[0.2em] text-[#CA8A04]!`,
    nav:    `${F_DISP} font-medium text-[13.5px] uppercase tracking-wide`,

    // Card title — Oswald uppercase 18px (product / feature cards)
    cardTitle: `${F_DISP} font-medium text-[18px] leading-[1.15] tracking-tight uppercase ${INK}`,
    // Compact card title — Oswald uppercase 15px (mode / metric cards; cardTitle is 18px)
    cardTitleSM: `${F_DISP} font-medium text-[15px] leading-[1.15] tracking-tight uppercase ${INK}`,
    // Stat giant — mono tabular figure (KPI / coverage numbers). Vertical margin
    // gives the big number breathing room from the label above + sublabel below
    // (statNum is used only on stat cards, so this margin is effectively per-instance).
    statNum:   `font-mono! text-[40px]! font-medium leading-[1.05] tabular-nums ${INK}! mt-2! mb-2.5!`,
    // ── Display stat numbers (Oswald, tabular) — the brand's KPI / metric figures on
    // data cards, matching the design mockups (statNum above is the mono variant). Use
    // statXL for hero KPIs (52px), statLG for stat-strip / compact KPIs (28px), statMD
    // for inline metric figures like a mode card's count (22px).
    statXL: `${F_DISP} font-semibold text-[52px] leading-[1.0] tracking-tight tabular-nums ${INK}`,
    statLG: `${F_DISP} font-semibold text-[28px] leading-[1.05] tabular-nums ${INK}`,
    statMD: `${F_DISP} font-semibold text-[22px] leading-[1.15] tabular-nums ${INK}`,

    // ── Legacy generic size scale ──
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

    // ── Tabular numeric variants ──
    numXS:   `${F_MONO} text-[11px] tabular-nums`,
    numSM:   `${F_MONO} text-[12.5px] tabular-nums`,
    numBase: `${F_MONO} text-[14.5px] tabular-nums`,
    numMD:   `${F_MONO} text-[18px] font-medium tabular-nums`,
    numLG:   `${F_MONO} text-[22px] font-medium tabular-nums`,
    numXL:   `${F_MONO} text-[28px] font-medium tabular-nums`,
    num2XL:  `${F_MONO} text-[40px] font-medium tabular-nums`,
    // "Diagnostic" — a value that's shown but isn't scored against a target.
    // Compliance matrices use this on rows like PHED total (informational, no
    // pass/fail). Only the color/weight is declared so it stacks with the
    // table's `cellInner text-[13px]` without conflicting on font-size.
    numDiag: `${F_MONO} tabular-nums text-slate-500`,
    // Micro-mono numeric — for compliance-matrix row numbers ("01", "02"…).
    // `!` overrides the table's `cellInner text-[13px] text-slate-700`.
    numMicro: `${F_MONO}! text-[11px]! tabular-nums text-slate-400!`,

    // ── Semantic aliases ──
    body:       `${F_SANS} text-[14.5px] font-normal leading-[1.65] text-slate-700`,
    bodySmall:  `${F_SANS} text-[12.5px] font-normal leading-[1.55] text-slate-600`,
    caption:    `${F_SANS} text-[12px] font-normal text-slate-500`,
    label:      `${F_SANS} text-[13px] font-medium text-slate-700`,
    designator: `${F_MONO} text-[10.5px] uppercase tracking-[0.18em] text-slate-500`,
  }],
};

// ─────────────────────────────────────────────────────────────────────────────
// Layout — page chrome.
//   default → marketing/landing (no nav)
//   app     → canonical product surface (SideNav + pane bg) · most pages
//   bare    → auth / embedded
//
// bottomMenu keeps QuickLinks alongside UserMenu (v1 had this; v2 didn't).
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
      bottomMenu: [
        { type: "QuickLinks" },
        { type: "UserMenu", options: { activeStyle: 0, navigableMenuActiveStyle: 0 } },
      ],
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
// LayoutGroup — bands of content within a Layout (v2)
// ─────────────────────────────────────────────────────────────────────────────
const layoutGroup = {
  options: { activeStyle: 0 },
  styles: [
    {
      // Band Y padding stays minimal (py-2): sections carry their own p-3 gutters
      // (sectionArray defaultPaddingStep), so the band only needs a slim frame.
      name: "content",
      wrapper1: "w-full bg-[#ECEEF2] py-2",
      wrapper2: "mr-auto w-full max-w-[1480px] pl-12 pr-8 flex flex-col gap-6",
      wrapper3: "",
    },
    {
      name: "content_tint",
      wrapper1: "w-full bg-[#E4E8EE] py-2",
      wrapper2: "mr-auto w-full max-w-[1480px] pl-12 pr-8 flex flex-col gap-6",
      wrapper3: "",
    },
    {
      name: "header",
      wrapper1: "w-full bg-white border-b border-zinc-950/10",
      wrapper2: "mr-auto w-full max-w-[1480px] pl-12 pr-8 py-2 flex flex-col gap-4",
      wrapper3: "",
    },
    {
      // Tight top-of-page nav bar — fixed height, no vertical padding (unlike
      // `header`, which is py-10 for page-title blocks). For a topnav band that
      // holds one full-width section (brand + links + actions row). wrapper2
      // matches the content bands (mr-auto max-w-[1480px] pl-12 pr-8) so the nav
      // left-aligns and shares their content width.
      name: "topbar",
      wrapper1: "w-full bg-white border-b border-zinc-950/10",
      // flex-COL (not items-center row): a row would shrink-wrap the section to its
      // content width; flex-col stretches the section to the full band width (cross-axis
      // stretch, like the content bands) while justify-center centers it in the 60px bar.
      wrapper2: "mr-auto w-full max-w-[1480px] pl-12 pr-8 h-[60px] flex flex-col justify-center",
      wrapper3: "",
    },
    {
      name: "hero",
      wrapper1: "w-full tny-hero-topo border-b border-zinc-950/10",
      wrapper2: "mr-auto w-full max-w-[1480px] pl-12 pr-8 py-2 flex flex-col gap-5",
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
      // login.html is borderless — the form sits directly on the #ECEEF2 pane,
      // centered, max-w-[400px]. No card chrome here (the old white-card wrapper2
      // double-carded with authPages.pageWrapper). Card styling, if a future auth
      // page wants it, belongs on authPages.pageWrapper, not the group.
      name: "auth",
      wrapper1: "w-full flex-1 flex items-center justify-center px-6 py-12 bg-[#ECEEF2]",
      wrapper2: "mx-auto w-full max-w-[400px] flex flex-col",
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
// sidenav — VERBATIM from the original theme.js. The user explicitly
// asked to defer to the existing sidenav settings.
// ─────────────────────────────────────────────────────────────────────────────
const sidenav = {
  options: {
    activeStyle: 0,
  },
  styles: [
    {
      name: "transportny-dark",
      layoutContainer1: "lg:ml-64",
      layoutContainer2: "fixed inset-y-0 left-0 w-64 max-lg:hidden",
      logoWrapper: "w-64 bg-[#12181F]",
      sidenavWrapper: "flex flex-col w-64 h-full z-20 bg-[#12181F]",
      menuItemWrapper: "flex flex-1 flex-col",
      menuItemWrapper_level_1: "",
      menuItemWrapper_level_2: "pl-4",
      menuItemWrapper_level_3: "pl-6",
      menuItemWrapper_level_4: "pl-8",
      navitemSide: "font-proxima font-[400] text-[15px] group flex items-center px-4 py-2.5 hover:bg-[#1e2530] text-slate-300 border-l-[3px] border-transparent focus:outline-none transition-all cursor-pointer",
      navitemSideActive: "font-proxima font-[500] text-[15px] group flex items-center px-4 py-2.5 bg-[#1e2530] text-white border-l-[3px] border-[#FACC15] focus:outline-none transition-all cursor-pointer",
      menuIconSide: "size-5 mr-3 text-slate-400 group-hover:text-slate-300 flex-shrink-0",
      menuIconSideActive: "size-5 mr-3 text-[#FACC15] flex-shrink-0",
      forcedIcon: "",
      forcedIcon_level_1: "",
      forcedIcon_level_2: "",
      forcedIcon_level_3: "",
      forcedIcon_level_4: "",
      itemsWrapper: "flex-1 py-4 overflow-y-auto scrollbar-sm",
      navItemContent: "flex-1 flex items-center justify-between transition-transform duration-300 ease-in-out",
      navItemContent_level_1: "",
      navItemContent_level_2: "",
      navItemContent_level_3: "",
      navItemContent_level_4: "",
      indicatorIcon: "ChevronRight",
      indicatorIconOpen: "ChevronDown",
      indicatorIconWrapper: "size-4 text-slate-500 transition-transform duration-200 ml-auto",
      subMenuWrapper_1: "w-full bg-[#0d1117]",
      subMenuWrapper_2: "w-full",
      subMenuWrapper_3: "w-full",
      subMenuOuterWrapper: "",
      subMenuParentWrapper: "flex flex-col w-full",
      bottomMenuWrapper: "border-t border-[#2a3545] pt-2",
      sectionDivider: "my-3 border-t border-[#2a3545]",
      sectionHeading: "px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider",
      topnavWrapper: "w-full h-[50px] flex items-center pr-1",
      topnavContent: "flex items-center w-full h-full bg-[#12181F] justify-between",
      topnavMenu: "hidden lg:flex items-center flex-1 h-full overflow-x-auto overflow-y-hidden scrollbar-sm",
      topmenuRightNavContainer: "hidden md:flex h-full items-center",
      topnavMobileContainer: "bg-[#12181F]",
    },
    {
      name: "compact",
      subMenuActivate: "onHover",
      layoutContainer1: "lg:ml-16",
      layoutContainer2: "fixed inset-y-0 left-0 w-16 max-lg:hidden z-20",
      logoWrapper: "w-16 bg-[#12181F]",
      sidenavWrapper: "flex flex-col w-16 h-full z-20 bg-[#12181F] items-center overflow-visible",
      menuItemWrapper: "flex justify-center",
      menuItemWrapper_level_1: "",
      menuItemWrapper_level_2: "flex flex-col w-full",
      menuItemWrapper_level_3: "",
      menuItemWrapper_level_4: "",
      navitemSide: "group relative flex items-center justify-center w-full py-3 hover:bg-[#1e2530] text-slate-400 border-l-[3px] border-transparent focus:outline-none transition-all cursor-pointer",
      navitemSideActive: "group relative flex items-center justify-center w-full py-3 bg-[#1e2530] text-white border-l-[3px] border-[#FACC15] focus:outline-none transition-all cursor-pointer",
      menuIconSide: "size-6 text-slate-400 group-hover:text-slate-300",
      menuIconSideActive: "size-6 text-[#FACC15]",
      forcedIcon: "",
      forcedIcon_level_1: "Circle",
      forcedIcon_level_2: "",
      forcedIcon_level_3: "",
      forcedIcon_level_4: "",
      itemsWrapper: "flex-1 py-4 w-full overflow-visible",
      navItemContent: "",
      navItemContent_level_1: "absolute inset-0 text-transparent",
      navItemContent_level_2: "flex-1 px-4 py-2.5 text-[14px] text-slate-300 hover:text-white hover:bg-[#2a3545] font-proxima font-[400] cursor-pointer transition-all border-l-2 border-transparent hover:border-[#FACC15]",
      navItemContent_level_3: "",
      navItemContent_level_4: "",
      indicatorIcon: "hidden",
      indicatorIconOpen: "hidden",
      indicatorIconWrapper: "hidden",
      subMenuWrapper_1: "min-w-[220px] bg-[#1a2029] border border-[#3a4555] shadow-2xl flex flex-col overflow-hidden",
      subMenuWrapper_2: "min-w-[180px] bg-[#1a2029] border border-[#3a4555] shadow-xl py-1",
      subMenuWrapper_3: "hidden",
      subMenuTitle: "text-sm uppercase tracking-wider text-slate-400 font-semibold py-2 px-4 w-full bg-[#12181F] border-b border-[#2a3545]",
      subMenuParentWrapper: "flex flex-col w-full",
      subMenuOuterWrapper: "absolute left-full top-0",
      subMenuWrapperChild: "flex flex-col",
      bottomMenuWrapper: "border-t border-[#2a3545] pt-2 w-full",
      sectionDivider: "my-3 border-t border-[#2a3545] w-full",
      sectionHeading: "hidden",
      topnavWrapper: "w-full h-[50px] flex items-center justify-center",
      topnavContent: "flex items-center justify-center w-full h-full bg-[#12181F]",
      topnavMenu: "hidden",
      topmenuRightNavContainer: "hidden",
      topnavMobileContainer: "bg-[#12181F]",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// topnav — v2 (rendered only on the `default` marketing Layout)
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
    subMenuItemsWrapperParent:  "px-3 py-2 border-b border-zinc-950/5",
    subMenuParentWrapper:       "flex items-start gap-3 px-3 py-2",
    subMenuParentContent:       "flex flex-col",
    subMenuParentName:          "font-display uppercase text-[12.5px] tracking-wide text-[#0F1722]",
    subMenuParentDesc:          "font-proxima text-[11.5px] text-slate-500",
    subMenuParentLink:          "text-[#1F3F8F] hover:underline",
  }],
};

// ─────────────────────────────────────────────────────────────────────────────
// logo — flat theme.
//
// Logo.theme.js is flat (no options/styles), and Logo.jsx reads these
// keys directly: logoWrapper, logoAltImg, imgWrapper, img, imgClass,
// titleWrapper, title, linkPath. The v2 design system shipped renamed
// keys (wrapper/image/text) which would have silently no-op'd against
// the source — flagged in skill §3.1.
//
// `@container` on logoWrapper makes the whole logo block its own
// container-query scope. `@[120px]:` variants flip the layout open
// when the parent is wider than 120px (the active sidenav is the
// compact 64px rail; the full transportny-dark is 256px). On compact,
// the title hides and the row centers; on full, the title and image
// grow and left-align.
// ─────────────────────────────────────────────────────────────────────────────
const logo = {
  logoWrapper:  "@container h-16 flex px-2 @[120px]:px-4 py-3 items-center justify-center @[120px]:justify-start gap-0 @[120px]:gap-2 bg-[#12181F]",
  logoAltImg:   "hidden",
  imgWrapper:   "flex-shrink-0",
  img:          "/themes/transportny/nys_logo_white.svg",
  imgClass:     "h-8 @[120px]:h-10 w-auto",
  titleWrapper: "hidden @[120px]:block text-white font-display font-semibold text-[18px] tracking-wide uppercase",
  title:        "TransportNY",
  linkPath:     "/",
};

// ─────────────────────────────────────────────────────────────────────────────
// button — v2 brand vocabulary
// ─────────────────────────────────────────────────────────────────────────────
const button = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: "default",
      button: "tny-press cursor-pointer inline-flex items-center gap-2 px-4 h-10 bg-[#1F3F8F] hover:bg-[#16307A] border-b-4 border-[#0F2D4D] text-white font-display uppercase text-[13px] tracking-wide rounded-[6px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F3F8F]/40 disabled:opacity-50",
      icon:      "",
      iconLeft:  "size-4",
      iconRight: "size-4",
    },
    {
      name: "plain",
      button: "cursor-pointer inline-flex items-center gap-2 px-3 h-9 text-slate-700 hover:text-[#0F1722] hover:bg-slate-100 font-proxima text-[13px] rounded-[6px] transition-colors disabled:opacity-50",
    },
    {
      name: "active",
      button: "tny-press cursor-pointer inline-flex items-center gap-2 px-4 h-10 bg-[#16307A] border-b-4 border-[#0A1C4D] text-white font-display uppercase text-[13px] tracking-wide rounded-[6px]",
    },
    {
      name: "secondary",
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
      button: "cursor-pointer inline-flex items-center gap-1.5 px-2.5 h-8 bg-white border border-zinc-950/10 hover:border-[#37576B] text-slate-700 font-proxima text-[12px] rounded-[6px] transition-colors",
    },
    {
      name: "icon",
      button: "cursor-pointer inline-flex items-center justify-center h-9 w-9 border border-zinc-950/15 bg-white hover:bg-slate-50 text-slate-700 rounded-[6px]",
    },
    {
      name: "amber",
      button: "tny-press cursor-pointer inline-flex items-center gap-2 px-4 h-10 bg-[#EAAD43] hover:bg-[#F1CA87] text-[#37576B] font-proxima font-bold text-[11.5px] uppercase tracking-[0.12em] rounded-[6px] border-b-4 border-[#C68B1F]",
    },
    // ── Inline text-link button variants (no chrome) — for nav/footer/card links
    //    that must navigate client-side (ButtonNode → useNavigate) yet read as text.
    {
      name: "navlink",
      button: "cursor-pointer inline-flex items-center px-3 h-9 font-display font-medium text-[13.5px] uppercase tracking-wide text-slate-700 hover:text-[#0F1722] transition-colors",
    },
    {
      name: "footerlink",
      button: "cursor-pointer inline-flex items-center py-0.5 font-proxima text-[12.5px] text-slate-600 hover:text-[#1F3F8F] transition-colors",
    },
    {
      name: "cardlink",
      button: "cursor-pointer inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-wider text-[#1F3F8F] hover:text-[#16307A] transition-colors",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// input — flat theme
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
// multiselect
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
      smartMenuWrapper: "px-3 py-2 border-b border-zinc-950/5 bg-slate-50/60",
      smartMenuItem:    "text-[12px] text-slate-500",
      error:            "mt-1 text-[12px] text-[#EF4444]",
    },
    {
      name: "compact",
      inputWrapper: "flex items-center gap-1.5 h-8 px-2.5 rounded-[6px] border border-zinc-950/10 hover:border-[#37576B] bg-white text-[12px] cursor-pointer transition-colors",
      caretWrapper: "ml-1 text-slate-500",
      singleValue:  "text-[12px] text-slate-700 font-medium",
      menuWrapper:  "absolute z-40 mt-1 min-w-[180px] rounded-[6px] border border-zinc-950/10 bg-white shadow-lg overflow-hidden",
      menuItem:     "px-3 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-50 cursor-pointer",
    },
    {
      // Borderless variant for use INSIDE a filter-row chip — the chip's border
      // lives on theme.filters.conditionRowInline, so the control itself is bare.
      name: "filter_chip",
      inputWrapper: "flex items-center gap-1 bg-transparent cursor-pointer",
      caretWrapper: "ml-0.5 text-slate-500",
      caretIcon:    "CaretDown",
      singleValue:  "text-[12px] text-[#0F1722] font-medium tabular-nums",
      singlePlaceholder: "text-[12px] text-slate-400",
      menuWrapper:  "absolute z-40 mt-1 min-w-[160px] rounded-[6px] border border-zinc-950/10 bg-white shadow-lg overflow-hidden",
      menuItem:         "px-3 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-50 cursor-pointer",
      menuItemSelected: "px-3 py-1.5 text-[12.5px] text-[#0F1722] bg-[#1F3F8F]/5 font-medium cursor-pointer",
    },
    {
      name: "tone_bar",
      inputWrapper: "flex items-center gap-1.5 px-2 -mx-2 py-1 rounded text-white hover:bg-white/10 cursor-pointer",
      singleValue:  "font-semibold text-[13px] text-white",
      caretWrapper: "ml-1 text-white/70",
    },
    {
      name: "multiselect_with_search",
      inputWrapper:     "flex w-full items-center gap-1.5 min-h-11 px-3 rounded-[6px] border border-zinc-950/15 hover:border-zinc-950/30 bg-white cursor-pointer",
      menuWrapper:      "absolute z-40 mt-1 w-full rounded-[8px] border border-zinc-950/10 bg-white shadow-lg overflow-hidden",
      smartMenuWrapper: "px-2 py-2 border-b border-zinc-950/10 bg-slate-50/60",
      smartMenuItem:    "w-full h-8 px-2 rounded border border-zinc-950/10 bg-white text-[13px] focus:outline-none focus:border-[#1F3F8F]",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// tabs
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
  // fieldWrapper styles FieldSet's <fieldset>; without it a bare <fieldset> falls
  // back to the browser-default groove border + padding. Stack the fields with a
  // consistent gap (matches the login form's `flex flex-col gap-4`).
  fieldWrapper: "flex flex-col gap-4",
  field:       "flex flex-col gap-1.5 pb-2",
  labelRow:    "flex items-center justify-between",
  label:       "font-display uppercase text-[11px] tracking-[0.16em] text-slate-600",
  description: "font-proxima text-[12px] text-slate-500",
  error:       "font-proxima text-[12px] text-[#EF4444]",
};

const labelTheme = {
  labelWrapper: "px-2.5 pt-2 pb-1.5 rounded-md",
  label:        "inline-flex items-center rounded-[4px] px-1.5 py-0.5 text-[12.5px] font-medium",
};


// ─────────────────────────────────────────────────────────────────────────────
// dialog / modal / drawer / deleteModal / popup
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
  wrapper:     "fixed inset-0 z-50 flex items-center justify-center p-4",
  backdrop:    "absolute inset-0 bg-zinc-950/40",
  panel:       "relative bg-white border border-zinc-950/10 shadow-2xl rounded-[8px] p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto",
  header:      "flex items-center justify-between mb-4 pb-4 border-b border-zinc-950/10",
  title:       "font-display uppercase text-[16px] tracking-wide text-[#0F1722]",
  closeButton: "cursor-pointer p-1 text-slate-500 hover:text-[#0F1722]",
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
// navigableMenu
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
      menuWrapper:       "bg-white border border-zinc-950/10 w-80 p-1 min-h-[60px] rounded-[8px] shadow-lg",
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
      separator:          "w-full border-b border-zinc-950/5 my-1",
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
      menuWrapper: "rounded-full bg-[#1a2029] text-white inline-flex items-center gap-3 px-3 h-10 shadow-2xl",
      menuItem:    "size-6 flex items-center justify-center text-slate-300 hover:text-[#FACC15] cursor-pointer",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// nestable / nestableInHouse
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
// dataCard — the workhorse Card primitive
// ─────────────────────────────────────────────────────────────────────────────
const dataCard = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: "default",
      wrapper:                       "rounded-[8px] border border-zinc-950/10 bg-white shadow-sm overflow-hidden",
      cardsGrid:                     "grid gap-4",
      cellsGrid:                     "grid",
      subWrapper:                    "flex flex-col w-full",
      subWrapperCompactView:         "rounded-[8px] bg-white",
      header:                        "font-display text-[12.5px] tracking-[0.04em] text-slate-500 px-3 pt-3 pb-1",
      headerValueWrapper:            "flex flex-col w-full",
      headerValueWrapperFullBleed:   "w-full relative overflow-hidden",
      headerValueWrapperBorderBelow: "border-b border-zinc-950/5 rounded-none",
      value:                         "px-3 pb-3 text-[14px] text-[#0F1722]",
      valueWrapper:                  "min-h-[20px]",
      description:                   "font-proxima text-[12px] font-light text-slate-500 px-3 pb-2",
      itemBorder:                    "border border-zinc-950/5",
      cardBorder:                    "border border-zinc-950/10",
      cellBorderBelow:               "border-b border-zinc-950/5",
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
      // Mirror of textSettings so Card cells can resolve a font-style by name
      displayHero: `${F_DISP} font-semibold text-[52px]! leading-[1.02] tracking-tight`,
      displayXL: `${F_DISP} font-semibold text-[44px]! leading-[1.05] tracking-tight`,
      displayLG: `${F_DISP} font-semibold text-[38px]! leading-[1.05] tracking-tight uppercase`,
      displayMD: `${F_DISP} font-semibold text-[28px]! leading-[1.1]`,
      displaySM: `${F_DISP} font-medium text-[22px]! leading-[1.2]`,
      displayXS: `${F_DISP} font-medium text-[18px]! leading-[1.25]`,
      proseLG: `${F_SANS} text-[16px]! leading-[1.65]`,
      prose: `${F_SANS} text-[14.5px]! leading-[1.65]`,
      proseSM: `${F_SANS} text-[12.5px]! leading-[1.55]`,
      proseXS: `${F_SANS} text-[11.5px]! leading-[1.5]`,
      metaMD: `${F_MONO} text-[12px]! leading-[1.45] tabular-nums`,
      metaSM: `${F_MONO} text-[10.5px]! uppercase tracking-[0.18em] pb-1!`,
      // ── Parity with textSettings (keep these in sync!): every token an author
      // can pick in Lexical should also exist here, because Card cells resolve
      // valueFontStyle/headerFontStyle against THIS map, not textSettings.
      statNum: `${F_MONO} text-[40px]! font-medium leading-[1.05] tabular-nums ${INK} pb-0!`,
      statXL: `${F_DISP} font-semibold text-[52px]! leading-[1.0] tracking-tight tabular-nums ${INK} pb-0!`,
      statLG: `${F_DISP} font-semibold text-[28px]! leading-[1.05] tabular-nums ${INK} pb-0!`,
      statMD: `${F_DISP} font-semibold text-[22px]! leading-[1.15] tabular-nums ${INK} pb-0!`,
      cardTitle: `${F_DISP} font-medium text-[18px]! leading-[1.15] tracking-tight uppercase ${INK}`,
      cardTitleSM: `${F_DISP} font-medium text-[15px]! leading-[1.15] tracking-tight uppercase ${INK}`,
      metaAccent: `${F_MONO} text-[12px]! leading-[1.45] tabular-nums font-medium text-[#B45309]!`,
      chip: `${F_MONO} text-[9.5px]! uppercase tracking-[0.14em] text-slate-400! border border-zinc-950/10 rounded px-1.5 py-0.5 inline-block w-fit pb-0!`,
      metaXS: `${F_MONO} text-[9.5px]! uppercase tracking-[0.18em]`,
      kicker: `${F_MONO} text-[10.5px]! uppercase tracking-[0.2em] text-[#CA8A04]!`,
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
      wrapper:     "rounded-[8px] border border-zinc-950/10 bg-white shadow-sm p-5 flex flex-col gap-2",
      header:      "font-display font-medium text-[15px] text-[#0f1722] leading-tight",
      value:       `${F_MONO} text-[40px] font-medium tabular-nums text-[#0F1722]`,
      description: "font-proxima text-[12.5px] text-slate-600 leading-snug",
    },
    {
      name: "compliance",
      wrapper:     "rounded-[8px] border border-zinc-950/10 bg-white shadow-sm p-5 flex flex-col gap-3",
      header:      "font-display font-medium text-[15px] text-[#0f1722] leading-tight",
      value:       `${F_MONO} text-[40px] font-medium tabular-nums text-[#0F1722]`,
    },
    {
      name: "editorial",
      wrapper: "rounded-[8px] border-2 border-dashed border-amber-300 bg-[#F5F1E8] p-6",
      header:  "font-display uppercase font-bold text-[14px] tracking-wide text-[#0F1722] border-b-2 border-[#EAAD43] inline-block pb-0.5",
      value:   "text-[13px] text-slate-700 mt-3 leading-[1.65]",
    },
    {
      name: "title_bar",
      wrapper: "rounded-[8px] border border-zinc-950/10 bg-white shadow-sm overflow-hidden",
      header:  "h-11 px-3 flex items-center gap-2 border-b border-zinc-950/10 bg-slate-50/60 font-display font-medium text-[14px] text-[#2D3E4C]",
      value:   "p-4 text-[14px] text-[#0F1722]",
    },
    {
      name: "compact",
      wrapper:     "rounded-[8px] border border-zinc-950/10 bg-white shadow-sm p-4 flex flex-col gap-2 relative",
      header:      "font-display uppercase text-[10.5px] tracking-[0.18em] text-slate-500",
      value:       `${F_MONO} text-[24px] font-medium tabular-nums text-[#0F1722]`,
      description: "font-proxima text-[11.5px] text-slate-500",
    },
    {
      name: "dashboard",
      wrapper:     "rounded-[6px] border border-zinc-950/5 bg-white p-3 flex items-center gap-3",
      header:      "font-display uppercase text-[10.5px] tracking-[0.18em] text-slate-500",
      value:       `${F_MONO} text-[18px] font-medium tabular-nums text-[#0F1722]`,
    },
    {
      // "context" — diagnostic / explainer card, no value-vs-target verdict.
      // Source: MAP-21 page §01 PHED card (`[data-dms-section="kpi-phed"]`).
      // Distinguished from `kpi` by a dashed slate shell + slate-50/60 tint
      // (vs solid white shadow). Pairs with a slate-tone pill ("UZA measure").
      //
      // Card.jsx UI primitive reads `subWrapperCompactView` + (cardBorder?
      // `cardBorder` : '') for the visible per-card chrome — NOT `wrapper`.
      // `wrapper` is the outer container around the cards grid; the per-card
      // shell is `subWrapperCompactView`, so the design tokens live there.
      //
      // `value` is intentionally empty so the column's `valueFontStyle` is
      // the sole font-size driver — declaring `text-[28px]` here would
      // collide with column-level `text-[12.5px]` (proseSM) since both
      // compile to the same Tailwind utility, and arbitrary-value ordering
      // picks the wrong winner.
      name: "context",
      subWrapperCompactView: "rounded-[8px] bg-slate-50/60 p-5",
      cardBorder:            "border border-dashed border-zinc-950/15",
      header:                "font-display font-medium text-[15px] text-[#0f1722] leading-tight",
      value:                 "",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// card
// ─────────────────────────────────────────────────────────────────────────────
const card = {
  options: { activeStyle: 0 },
  styles: [{
    name: "default",
    wrapper: "rounded-[8px] border border-zinc-950/10 bg-white shadow-sm",
    header:  "px-4 py-3 border-b border-zinc-950/5 font-display uppercase text-[12.5px] tracking-wide text-slate-700",
    body:    "p-4 text-[14px] text-slate-700",
    footer:  "px-4 py-3 border-t border-zinc-950/5 text-[12px] text-slate-500",
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
    { name: "beta",    wrapper: "inline-flex items-center px-2 h-6 rounded-[4px] text-[11px] font-medium bg-amber-100 text-amber-900 font-display uppercase tracking-wide" },
    { name: "admin",   wrapper: "inline-flex items-center px-2 h-6 rounded-[4px] text-[11px] font-medium bg-slate-900 text-white font-display uppercase tracking-wide" },
    // status_* — the card-design status pill: bordered tint + leading dot (::before) + uppercase mono, color-coded. Selected by the status_pill column type.
    { name: "status_good", wrapper: "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border border-[#10B981]/30 bg-[#10B981]/10 font-mono text-[10px] uppercase tracking-[0.16em] text-[#065F46] [&::before]:content-[''] [&::before]:size-1.5 [&::before]:rounded-full [&::before]:bg-[#10B981]" },
    { name: "status_warn", wrapper: "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border border-[#EAAD43]/30 bg-[#EAAD43]/15 font-mono text-[10px] uppercase tracking-[0.16em] text-[#7C5A12] [&::before]:content-[''] [&::before]:size-1.5 [&::before]:rounded-full [&::before]:bg-[#EAAD43]" },
    { name: "status_bad",  wrapper: "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border border-[#EF4444]/30 bg-[#EF4444]/10 font-mono text-[10px] uppercase tracking-[0.16em] text-[#991B1B] [&::before]:content-[''] [&::before]:size-1.5 [&::before]:rounded-full [&::before]:bg-[#EF4444]" },
    { name: "status_na",   wrapper: "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border border-zinc-950/10 bg-slate-100 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-600 [&::before]:content-[''] [&::before]:size-1.5 [&::before]:rounded-full [&::before]:bg-slate-400" },
    { name: "route", wrapper: "inline-flex items-center gap-2 h-8 pl-2.5 pr-2 rounded-full bg-white text-slate-700 shadow-sm border border-zinc-950/5 text-[12.5px] font-proxima" },
  ],
};

const pagination = {
  options: { activeStyle: 0 },
  styles: [{
    name: "default",
    wrapper:     "flex items-center gap-1 justify-between px-3 h-10 border-t border-zinc-950/5 bg-slate-50/40",
    info:        "font-mono text-[11px] uppercase tracking-wider text-slate-500",
    pageButton:  "h-7 min-w-7 px-2 inline-flex items-center justify-center text-[12px] text-slate-600 hover:bg-slate-100 rounded cursor-pointer",
    pageButtonActive: "h-7 min-w-7 px-2 inline-flex items-center justify-center text-[12px] text-[#0F1722] bg-white border border-zinc-950/10 rounded font-medium cursor-pointer",
    arrowButton: "h-7 w-7 inline-flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 cursor-pointer",
  }],
};

// ─────────────────────────────────────────────────────────────────────────────
// table
// The Table component (dms/src/ui/components/table/index.jsx) renders a CSS
// grid of <div>s, NOT an HTML <table>, so the design tokens here use the
// component's actual class keys (tableContainer / headerCellContainer / cell /
// cellInner / cellBg / …). The earlier HTML-element keys (wrapper/thead/th/tr/
// td) were never read by anything.
//
// Three styles, sourced from the design system:
//   - default   — dms_design_system_v2/design-system/components.html "default ·
//                 dashboard · amber-hover" (font-display header, px-3 py-2)
//   - editorial — same components page "editorial" example (deep-navy header,
//                 printable, all-sides border on body)
//   - report    — the MAP-21 system performance page treatment (font-mono
//                 header, px-4 py-2.5, slate-50/60 header bg) — tighter,
//                 report-document look; used by §04/§05/§06 here
//
// Non-default styles inherit missing keys from styles[0] (see getComponentTheme).
// `default` therefore declares the full key set; `editorial` and `report`
// override only what differs.
// ─────────────────────────────────────────────────────────────────────────────

// Header / popup / menu chrome shared by every named style — admin-side only,
// invisible in the printed table but required by the component.
const tableHeaderChrome = {
  headerCellWrapper:              "relative w-full",
  headerCellBtn:                  "group inline-flex items-center w-full justify-between gap-x-1.5 rounded-md cursor-pointer",
  headerCellBtnActive:            "bg-slate-200",
  headerCellFnIconClass:          "text-slate-400",
  headerCellCountIcon:            "TallyMark",
  headerCellListIcon:             "LeftToRightListBullet",
  headerCellSumIcon:              "Sum",
  headerCellAvgIcon:              "Avg",
  headerCellGroupIcon:            "Group",
  headerCellSortAscIcon:          "SortAsc",
  headerCellSortDescIcon:         "SortDesc",
  headerCellMenuIcon:             "ArrowDown",
  headerCellMenuIconClass:        "text-slate-400 group-hover:text-slate-600 transition ease-in-out duration-200 print:hidden",
  headerCellIconWrapper:          "flex items-center",
  headerCellMenu:                 "py-0.5 flex flex-col gap-0.5 items-center px-1 text-xs text-slate-600 max-h-[500px] min-w-[180px] z-[10] overflow-auto scrollbar-sm bg-white divide-y divide-slate-100 rounded-md shadow-lg ring-1 ring-black ring-opacity-5",
  headerCellControlWrapper:       "w-full group px-2 py-1 flex justify-between items-center rounded-md hover:bg-slate-100",
  headerCellControlLabel:         "w-fit text-slate-500 cursor-default",
  headerCellControl:              "p-0.5 w-full rounded-md bg-white group-hover:bg-slate-100 cursor-pointer",
};

const tableOpenOutChrome = {
  openOutContainer:               "w-[330px] overflow-auto scrollbar-sm flex flex-col gap-[12px] p-[16px] bg-white h-full float-right",
  openOutContainerWrapper:        "fixed inset-0 right-0 h-full w-full z-[100]",
  openOutHeader:                  "font-semibold text-slate-600",
  openOutCloseIconContainer:      "w-full flex justify-end",
  openOutCloseIconWrapper:        "w-fit h-fit p-[8px] text-[#37576B] border border-[#E0EBF0] rounded-full cursor-pointer",
  openOutCloseIcon:               "XMark",
  openOutContainerWrapperBgColor: "#00000066",
  openOutIconWrapper:             "px-2 cursor-pointer bg-transparent text-slate-500 hover:text-slate-700",
};

const table = {
  // `report` is the brand default for now because §04/§05/§06 of the MAP-21
  // page are the active Spreadsheets on the site. When per-section style
  // picking lands (mirror of `display.filterStyle`), this can flip back to
  // `default` and authors will pick per-section.
  options: { activeStyle: "report" },
  styles: [
    {
      // dms_design_system_v2/design-system/components.html : "default ·
      // dashboard · amber-hover"
      name: "default",

      // Outer shell — rounded white card.
      tableContainer:                 "flex flex-col rounded-[8px] border border-zinc-950/10 bg-white shadow-sm overflow-x-auto overflow-y-auto max-h-[calc(78vh_-_10px)]",
      tableContainerNoPagination:     "",

      // Header row — font-display uppercase 11px, slate-50/80 bg.
      headerContainer:                "sticky top-0 grid z-[2]",
      headerLeftGutter:               "flex justify-between sticky left-0 z-[1]",
      headerWrapper:                  "flex justify-between",
      headerCellContainer:            "w-full px-3 py-2 content-center font-display uppercase text-[11px] tracking-wide",
      headerCellContainerBg:          "bg-slate-50/80 text-slate-600 border-b border-zinc-950/10",
      headerCellContainerBgSelected:  "bg-blue-100 text-[#0F1722]",
      colResizer:                     "z-5 -ml-2 w-[1px] hover:w-[2px] bg-zinc-950/5 hover:bg-zinc-950/15",
      headerCellLabel:                "truncate select-none",
      ...tableHeaderChrome,

      // Data cell — bottom hairline, 13px slate-700, px-3 py-2.
      wrapText:                       "whitespace-pre-wrap",
      cell:                           "relative flex items-center min-h-[36px] border-b border-zinc-950/5",
      cellInner:                      "w-full min-h-full flex flex-wrap items-center truncate py-2 px-3 font-[400] text-[13px] leading-[18px] text-slate-700",
      cellBg:                         "bg-white hover:bg-[#FFFBEB]",
      cellBgOdd:                      "bg-white hover:bg-[#FFFBEB]",
      cellBgEven:                     "bg-white hover:bg-[#FFFBEB]",
      cellBgSelected:                 "bg-blue-50 hover:bg-blue-100",
      cellInvalid:                    "bg-red-50 hover:bg-red-100",
      cellEditableTextBox:            "absolute border focus:outline-none min-w-[180px] min-h-[50px] z-[10] whitespace-pre-wrap",
      cellFrozenCol:                  "",

      // Total / striped / gutter.
      totalRow:                       "bg-slate-50 sticky bottom-0 z-[3] border-t border-zinc-950/10",
      totalCell:                      "hover:bg-slate-100 font-medium",
      stripedRow:                     "",
      gutterCellWrapper:              "flex items-center justify-center cursor-pointer sticky left-0 z-[1] font-mono text-[11px]",
      gutterCellWrapperNotSelected:   "bg-slate-50/60 text-slate-400",
      gutterCellWrapperSelected:      "bg-blue-100 text-[#0F1722]",

      pivotGroupHeader:               "bg-slate-100 text-slate-700 text-center border-b border-r border-zinc-950/5",

      // Pagination strip.
      paginationContainer:            "w-full px-3 py-2 flex items-center justify-between border-t border-zinc-950/5 bg-slate-50/40",
      paginationInfoContainer:        "",
      paginationPagesInfo:            "font-mono text-[11px] uppercase tracking-wider text-slate-500",
      paginationRowsInfo:             "font-mono text-[10px] text-slate-500",
      paginationControlsContainer:    "flex flex-row items-center overflow-hidden gap-0.5",
      pageRangeItem:                  "cursor-pointer px-2 py-1 text-[12px] text-slate-600 hover:bg-slate-100 rounded",
      pageRangeItemInactive:          "",
      pageRangeItemActive:            "bg-white border border-zinc-950/10 text-[#0F1722] font-medium",

      ...tableOpenOutChrome,
    },

    {
      // dms_design_system_v2/design-system/components.html : "editorial ·
      // deep-navy header · printable". Body has all-sides slate-200 hairlines.
      name: "editorial",
      tableContainer:                 "flex flex-col rounded-[8px] border border-zinc-950/10 bg-[#F5F1E8] shadow-sm overflow-x-auto overflow-y-auto max-h-[calc(78vh_-_10px)]",
      headerCellContainer:            "w-full px-3 py-2 content-center font-display font-semibold uppercase text-[11px] tracking-wide border border-white",
      headerCellContainerBg:          "bg-[#0F2D4D] text-white",
      cell:                           "relative flex items-center min-h-[34px] border border-slate-200",
      cellInner:                      "w-full min-h-full flex flex-wrap items-center truncate py-1.5 px-3 font-[400] text-[12.5px] leading-[18px] text-[#0F1722]",
      cellBg:                         "bg-[#F5F1E8] hover:bg-amber-50",
      cellBgOdd:                      "bg-[#F5F1E8] hover:bg-amber-50",
      cellBgEven:                     "bg-[#F5F1E8] hover:bg-amber-50",
    },

    {
      // MAP-21 system-performance page treatment — font-mono 10px header,
      // slate-50/60 bg, px-4 py-2.5 cells, Proxima 13px body. The "report"
      // style: tighter labels, more breathing room in the body, denser
      // information than the dashboard default.
      name: "report",
      headerCellContainer:            "w-full px-4 py-2.5 content-center font-mono text-[10px] font-normal uppercase tracking-[0.16em]",
      headerCellContainerBg:          "bg-slate-50/60 text-slate-500 border-b border-zinc-950/10",
      cell:                           "relative flex items-center min-h-[42px] border-b border-zinc-950/5",
      cellInner:                      "w-full min-h-full flex flex-wrap items-center truncate py-2.5 px-4 font-[400] text-[13px] leading-[18px] text-slate-700",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// lexical
// ─────────────────────────────────────────────────────────────────────────────
const lexical = {
  options: { activeStyle: 0 },
  styles: [{
    name: "default",
    // h1 maps to displayLG (38 px uppercase, product-page title).
    // Reach displayHero (52 px) explicitly via styled-paragraph for
    // landing/marketing heroes. h2-h6 cascade. Margins tightened so
    // consecutive heading + paragraph blocks pack close together —
    // the codebase default mt-8 was creating a 32 px gap above every
    // h1 that read as "huge whitespace" on product page headers.
    heading_h1: `${F_DISP} font-semibold text-[38px] leading-[1.05] tracking-tight uppercase ${INK} mt-1 mb-2 scroll-mt-36`,
    heading_h2: `${F_DISP} font-semibold text-[28px] leading-[1.1] ${INK} mt-4 mb-2 scroll-mt-36`,
    heading_h3: `${F_DISP} font-semibold text-[22px] leading-[1.2] ${INK} mt-3 mb-2 scroll-mt-36`,
    heading_h4: `${F_DISP} font-medium text-[18px] leading-[1.25] ${INK} mt-2 mb-1 scroll-mt-36`,
    heading_h5: `${F_DISP} font-medium text-[16px] leading-[1.3] uppercase tracking-wide ${INK} mt-2 mb-1 scroll-mt-36`,
    heading_h6: `${F_DISP} font-medium text-[14px] leading-[1.4] uppercase tracking-[0.16em] text-slate-700 mt-2 mb-1 scroll-mt-36`,

    // Tight paragraph spacing — mb-1 (4 px) instead of mb-3 (12 px) —
    // so styled-paragraph + paragraph blocks (breadcrumb → kicker →
    // title → description) sit close together.
    paragraph:    `${F_SANS} text-[14.5px] leading-[1.55] text-slate-700 mb-1`,

    text_bold:    "font-semibold",
    text_italic:  "italic",
    text_underline: "underline underline-offset-2",
    text_code:    `${F_MONO} text-[0.92em] px-1.5 py-0.5 rounded bg-zinc-950/5 border border-zinc-950/6 text-[#37576B]`,
    text_strikethrough: "line-through",

    list_ol:                 "list-decimal pl-6 space-y-1 text-[14.5px] text-slate-700",
    list_ul:                 "list-disc pl-6 space-y-1 text-[14.5px] text-slate-700",
    list_listitem:           "leading-[1.65]",
    list_nested_listitem:    "list-none",

    link:  "text-[#1F3F8F] underline underline-offset-2 hover:text-[#16307A]",
    quote: "border-l-4 border-[#EAAD43] pl-4 italic text-slate-600",
    code:  `${F_MONO} text-[12.5px] leading-[1.55] p-4 rounded-[6px] bg-[#0F1722] text-slate-100 overflow-x-auto block`,
    image: "rounded-[6px] my-4",

    layoutContainer: "grid gap-3 mt-2",
    layoutItem:      "min-w-0 max-w-full",
    layoutItemEditable: "border border-dashed border-zinc-950/10",
    layoutTemplates: [
      { label: "2 columns (equal)",     value: "grid-cols-1 md:grid-cols-2", count: 2 },
      { label: "2 columns (1/3 + 2/3)", value: "grid-cols-1 md:grid-cols-[1fr_2fr]", count: 2 },
      { label: "2 columns (2/3 + 1/3)", value: "grid-cols-1 md:grid-cols-[2fr_1fr]", count: 2 },
      { label: "3 columns (equal)",     value: "grid-cols-1 md:grid-cols-3", count: 3 },
      { label: "4 columns (equal)",     value: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4", count: 4 },
      { label: "Prose + TOC",           value: "grid-cols-1 md:grid-cols-[1fr_220px]", count: 2 },
    ],
  }],
};

// ─────────────────────────────────────────────────────────────────────────────
// graph / avlGraph
// ─────────────────────────────────────────────────────────────────────────────
const graph = {
  options: { activeStyle: 0 },
  styles: [{
    name: "default",
    // Built-in chart padding (consumed by graph_new/GraphComponent's outer div) —
    // keeps the plot off the section/card edge without per-section margin tweaks.
    padding:      "p-4",
    text:         `${F_SANS} text-[12px] text-slate-600`,
    darkModeText: `${F_SANS} text-[12px] text-white bg-transparent`,
    headerWrapper:"flex items-baseline justify-between mb-2",
    title:        "font-display uppercase text-[12.5px] tracking-wide text-slate-700",
    subtitle:     "font-mono text-[10.5px] uppercase tracking-wider text-slate-500",
    axis:         "stroke-zinc-950/15",
    grid:         "stroke-zinc-950/5",
    tooltip:      "rounded-[6px] bg-[#0F1722] text-white text-[12px] px-2.5 py-1.5 shadow-lg font-proxima",
    legend:       "flex items-center gap-4 font-mono text-[10.5px] uppercase tracking-wider text-slate-500",
    legendSwatch: "h-0.5 w-4",
    catPalette:     ["#6F6F6F", "#E5A646", "#94C24E", "#E160A4", "#F2CB3D"],
    seqSpeedPalette:["#D6453B", "#E8843F", "#F2E18A", "#A8D26B", "#3FA34D"],
    primary:        "#1F3F8F",
    primaryArea:    "rgba(31,63,143,0.15)",
    targetLine:     "stroke-amber-400 [stroke-dasharray:4_3]",
    targetLabel:    "font-mono text-[10.5px] uppercase tracking-wider text-amber-700",
    focusLine:      "stroke-[#0F1722] [stroke-dasharray:2_3]",
    peakDot:        "fill-white stroke-[#1F3F8F]",
    // Brand chart defaults consumed by the avlGraph component (merged under a section's
    // own display settings). Drives line/series colours, margins and axes for every
    // graph without per-section config. (See graph_new/theme.js ChartDefaults.)
    chartDefaults: {
      colors: { type: "palette", value: ["#10B981", "#1F3F8F", "#EAAD43", "#37576B", "#EF4444"] },
      margin: { top: 16, right: 24, bottom: 40, left: 56 },
      height: 280,
      // Brand line look: a slightly bolder emerald line, smooth curve, faint
      // gridlines. `area`/`areaOpacity` stay opt-in (a section or yColumn turns the
      // gradient fill on) so non-trend graphs aren't forced into area mode.
      interpolation: "catmullrom",
      strokeWidth: 2,
      area: false,
      areaOpacity: 0.14,
      // Brand axis typography (CSS values, applied inline by the axis renderers). Ticks
      // use the mono numeric ladder (matches the report's metaSM/num treatment) — 11px
      // slate-500 monospace; axis labels use the Proxima sans, 13px medium slate-700.
      // Full set so the brand defines every new axis-font key (not just the visible tick).
      xAxis: { show: true, showGridLines: false, rotateLabels: false, tickDensity: 2, gridLineOpacity: 0.18, axisColor: "#0f172a26",
        tickFontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", tickFontSize: "11px", tickFontWeight: "400", tickColor: "#64748b",
        labelFontFamily: "Proxima Nova, 'Source Sans 3', system-ui, sans-serif", labelFontSize: "13px", labelFontWeight: "600", labelColor: "#334155" },
      yAxis: { show: true, showGridLines: true, format: "Integer", gridLineOpacity: 0.14, axisColor: "#0f172a26",
        tickFontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", tickFontSize: "11px", tickFontWeight: "400", tickColor: "#64748b",
        labelFontFamily: "Proxima Nova, 'Source Sans 3', system-ui, sans-serif", labelFontSize: "13px", labelFontWeight: "600", labelColor: "#334155" },
      legend: { show: false },
    },
  }],
};

const avlGraph = graph;

// ─────────────────────────────────────────────────────────────────────────────
// map
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
// attribution / filters
// ─────────────────────────────────────────────────────────────────────────────
const attribution = {
  wrapper: "w-full px-3 py-1.5 flex gap-2 text-[11px] text-slate-500 font-mono uppercase tracking-wide border-t border-zinc-950/5 bg-slate-50/40",
  label:   "",
  link:    "text-[#1F3F8F] hover:text-[#16307A]",
};

// filters — named filter DESIGNS (whole-filter styles). Each style bundles the
// wrapper + label + row layout + `placement` + `controlStyle` (the multiselect
// style its value control renders with). A Filter section picks one via
// display.filterStyle; ExternalFilters/RenderFilters resolve it with
// getComponentTheme(theme,'filters',style) and pass controlStyle → the control.
// Non-default styles inherit missing keys from styles[0] (panel).
const filters = {
  options: { activeStyle: 0 },
  styles: [
    { // 0 · panel — boxed multi-filter (default; label above, h-11 control)
      name: "panel",
      placement: "stacked",
      controlStyle: "default",
      filterLabel:                 "font-display uppercase text-[11px] tracking-wide text-slate-500 mb-1",
      loadingText:                 "text-[12px] text-slate-400",
      filterSettingsWrapperInline: "w-2/3",
      filterSettingsWrapperStacked:"w-full",
      labelWrapperInline:          "w-1/3 text-[12px]",
      labelWrapperStacked:         "w-full text-[12px]",
      conditionRowInline:          "w-full flex flex-row items-center gap-2",
      conditionRowStacked:         "w-full flex flex-col gap-1",
      conditionsGrid:              "grid",
      input:                       "w-full max-h-[150px] flex text-[12px] overflow-auto border border-zinc-950/10 rounded-[6px] bg-white p-2",
      settingPillsWrapper:         "flex flex-row flex-wrap gap-1",
      settingPill:                 "px-1.5 py-0.5 bg-[#EAAD43]/15 text-amber-800 hover:bg-[#EAAD43]/25 rounded-[4px] text-[11.5px]",
      settingLabel:                "text-slate-700 font-medium",
      filtersWrapper:              "w-full p-3 flex flex-col gap-2 rounded-[6px] bg-slate-50/60",
      toggleButton:                "hidden",
      toggleIcon:                  "hidden",
    },
    { // 1 · chip — compact inline; label sits INSIDE the bordered chip; borderless control
      name: "chip",
      placement: "inline",
      controlStyle: "filter_chip",
      filterLabel:                 "font-mono text-[10.5px] uppercase tracking-wider text-slate-500",
      filterSettingsWrapperInline: "min-w-0",
      labelWrapperInline:          "shrink-0 inline-flex items-center gap-1",
      conditionRowInline:          "inline-flex items-center gap-1.5 h-8 pl-2.5 pr-1.5 rounded-[6px] border border-zinc-950/10 hover:border-[#37576B] bg-white w-fit transition-colors",
      filtersWrapper:              "w-full flex flex-wrap items-start gap-2",
    },
    { // 2 · labeled — stacked label above a compact control, no panel box
      name: "labeled",
      placement: "stacked",
      controlStyle: "compact",
      filterLabel:                 "font-mono text-[10.5px] uppercase tracking-wider text-slate-500 mb-1",
      filtersWrapper:              "w-full flex flex-col gap-2",
    },
    { // 3 · tone_bar — inline on a dark band (white label, transparent control)
      name: "tone_bar",
      placement: "inline",
      controlStyle: "tone_bar",
      filterLabel:                 "font-mono text-[10.5px] uppercase tracking-wider text-white/60",
      labelWrapperInline:          "shrink-0 inline-flex items-center gap-1",
      conditionRowInline:          "inline-flex items-center gap-1.5 w-fit",
      filtersWrapper:              "w-full flex flex-wrap items-center gap-2",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// pages.* — pattern-level chrome
// ─────────────────────────────────────────────────────────────────────────────
const pages = {
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

  // The sticky in-page-nav rail (the mockup's "on this page" <aside>). A distinct
  // layout region rendered as the content LayoutGroup's outerChildren, themed
  // entirely here (flat shape — sectionGroup.jsx / InPageNav.jsx read it via
  // getComponentTheme(theme,'pages.sectionGroup')). Rail = a nav card + any
  // sidebar-group sections stacked below.
  sectionGroup: {
    // content ↔ rail row (inside the band's max-w-[1480px] content container).
    // items-stretch keeps the rail column full-height so its inner sticky pins.
    contentRow: "flex flex-row gap-10 items-stretch",
    contentCol: "flex-1 min-w-0",
    sideNavContainer1: "w-[302px] shrink-0 hidden xl:block",
    sideNavContainer2: "sticky top-[60px] h-[calc(100vh_-_68px)] overflow-y-auto pr-2",
    sideNavContainer3: "flex flex-col gap-4",
    // "On this page" nav card
    navWrapper:    "rounded-[8px] border border-zinc-950/10 bg-white p-4",
    navLabelText:  "On this page",
    navLabel:      "font-mono uppercase text-[10px] tracking-[0.16em] text-slate-500 mb-3",
    navList:       "flex flex-col gap-0.5",
    navItem:       "block w-full text-left font-proxima text-[13px] text-slate-600 hover:text-[#0F2D4D] py-1.5 pl-3 border-l-2 border-transparent transition-colors cursor-pointer",
    navItemActive: "block w-full text-left font-proxima text-[13px] text-[#0F2D4D] font-medium py-1.5 pl-3 border-l-2 border-[#EAAD43] bg-slate-50/60 transition-colors cursor-pointer",
  },

  sectionArray: {
    options: { activeStyle: 0 },
    styles: [{
      name: "default",
      _replace: ["sizes"],

      // ── Grid container ──
      wrapper:        "relative",
      gridOverlay:    "absolute inset-0 pointer-events-none",
      // Compound-card model: the band grid is gap-0; spacing is per-section PADDING
      // (no margins — they fight grid/flex). The section wrapper's padding is the
      // gutter; removing it on a shared edge lets a section sit flush with a neighbor.
      container:      "w-full grid grid-cols-12 gap-0",
      gridSize:       12,
      defaultSize:    "12",
      sectionPadding: "p-3",        // fallback gutter (un-migrated path)
      defaultPaddingStep: "3",      // per-side gutter default → 24px between sections
      layouts: {
        centered:  "max-w-[1480px] mr-auto",
        fullwidth: "",
      },

      // ── Section wrappers ──
      // The `group` class is LOAD-BEARING: every group-hover:* utility
      // on overlays + the add-section button below depends on it. The
      // codebase default ships `relative group` and we keep that.
      //
      // `hover:bg-…` here gives the section a subtle blue wash on
      // hover that sits UNDER content (since the wrapper paints first,
      // then children paint on top). This is the right place for the
      // hover tint because sectionEditWrapper is applied to every
      // section regardless of its `border` setting — `border.full` is
      // only applied when v.border === 'full', so putting the hover
      // tint there would silently no-op on the (default) 'none'
      // sections.
      sectionEditWrapper: "relative group hover:bg-[#1F3F8F]/6 transition-colors rounded-[8px]",
      sectionViewWrapper: "relative group",

      // ── Edit-mode overlays ──
      // These three are sibling divs INSIDE sectionEditWrapper and need
      // `absolute inset-0` to render as full-bleed overlays. Without
      // absolute positioning the div has zero size and the styling
      // never paints anywhere. (Previous v2 used `outline …` here,
      // which is why hover/highlight didn't appear.)
      //   • sectionEditHover  — visible only on group-hover (transparent
      //     border until parent is hovered, then brand amber).
      //   • sectionEditing    — always visible on the section currently
      //     being edited.
      //   • sectionHighlight  — always visible on URL-hash deeplink
      //     (clicked TOC link → section flashes amber).
      // Edit/hover/highlight overlays — outline only, no bg tint.
      // The bg tint lives on `border.full` below (via group-hover for
      // hover, and the wrapper's own classes can't differentiate
      // editing vs highlight without JS, so those states rely on the
      // outline alone to differentiate). Overlay still sits on top
      // (z-10) but it's transparent except for the dashed line at
      // the edge — content paints undisturbed.
      sectionEditHover: "absolute inset-0 outline-1 outline-dashed outline-transparent group-hover:outline-[#1F3F8F]/70 pointer-events-none z-10 rounded-[8px] transition-colors",
      sectionEditing:   "absolute inset-0 outline-1 outline-dashed outline-[#1F3F8F] pointer-events-none z-10 rounded-[8px]",
      sectionHighlight: "absolute inset-0 outline-1 outline-dashed outline-[#EAAD43] pointer-events-none z-10 rounded-[8px]",

      // ── Add-section button ──
      // Sits ABOVE each section (`absolute -top-5`), hidden until the
      // parent's group-hover fires. The icon→text expansion uses a
      // nested `group/icon` so the "+" pill grows into an "Add" label
      // when the user hovers the pill itself (a small but nice tell).
      // The Icon name "Plus" is hardcoded in the JSX — `addSectionIcon`
      // is the class string on that <Icon>, NOT a name string.
      addSectionButton:      "cursor-pointer flex items-center w-full -ml-4 my-2 hidden group-hover:flex absolute -top-5 z-20",
      spacer:                "flex-1",
      addSectionIconWrapper: "flex items-center group/icon cursor-pointer",
      addSectionIcon:        "size-6 p-1.5 text-white bg-[#1F3F8F] rounded-full group-hover/icon:hidden",
      addSectionTextWrapper: "hidden group-hover/icon:flex items-center",
      addSectionText:        "px-2.5 py-1 text-white text-[12px] font-display uppercase tracking-wide bg-[#1F3F8F] rounded-full",

      // ── Grid view (overlay mode) ──
      gridviewGrid: "z-0 bg-slate-50 h-full",
      gridviewItem: "border-x bg-white border-slate-100/75 border-dashed h-full p-[6px]",
      defaultOffset: 16,

      // ── Sizes (12-col, _replace'd above) ──
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

      // ── Rowspans ──
      // Codebase reads `theme?.rowspans?.["1"]?.className` — must be
      // {className} objects, NOT flat strings. Previous v2 shipped
      // flat strings which silently broke row spans.
      rowspans: {
        "1": { className: "" },
        "2": { className: "md:row-span-2" },
        "3": { className: "md:row-span-3" },
        "4": { className: "md:row-span-4" },
        "5": { className: "md:row-span-5" },
        "6": { className: "md:row-span-6" },
        "7": { className: "md:row-span-7" },
        "8": { className: "md:row-span-8" },
      },

      // ── Section borders (per-section frame variants) ──
      // Applied only when `v.border` is set on a section (default is
      // 'none'). The hover tint is on sectionEditWrapper above, not
      // here, so it fires for every section regardless of border.
      border: {
        none:       "",
        full:       "rounded-[8px] border border-zinc-950/10 bg-white shadow-sm",
        openLeft:   "rounded-r-[8px] border border-zinc-950/10 border-l-transparent bg-white shadow-sm",
        openRight:  "rounded-l-[8px] border border-zinc-950/10 border-r-transparent bg-white shadow-sm",
        openTop:    "rounded-b-[8px] border border-zinc-950/10 border-t-transparent bg-white shadow-sm",
        openBottom: "rounded-t-[8px] border border-zinc-950/10 border-b-transparent bg-white shadow-sm",
        borderX:    "border border-zinc-950/10 border-y-transparent",
      },
      // ── Compound-card per-edge controls (the author tools; literal classes so
      // Tailwind generates them). Border line = the brand hairline; radius = 8px. ──
      borderSides: {
        top:    "border-t border-zinc-950/10",
        right:  "border-r border-zinc-950/10",
        bottom: "border-b border-zinc-950/10",
        left:   "border-l border-zinc-950/10",
      },
      radiusCorners: {
        tl: "rounded-tl-[8px]", tr: "rounded-tr-[8px]", bl: "rounded-bl-[8px]", br: "rounded-br-[8px]",
      },
      // Inner-card background options (per-side border carries no bg of its own).
      backgrounds: {
        none: "", white: "bg-white", tint: "bg-slate-50/60",
      },
      // Curated gutter steps (fewer = wider, more usable buttons): flush / tight /
      // default(3) / comfortable / loose / wide.
      paddings: {
        top:    { "0":"pt-0","2":"pt-2","3":"pt-3","4":"pt-4","6":"pt-6","8":"pt-8" },
        right:  { "0":"pr-0","2":"pr-2","3":"pr-3","4":"pr-4","6":"pr-6","8":"pr-8" },
        bottom: { "0":"pb-0","2":"pb-2","3":"pb-3","4":"pb-4","6":"pb-6","8":"pb-8" },
        left:   { "0":"pl-0","2":"pl-2","3":"pl-3","4":"pl-4","6":"pl-6","8":"pl-8" },
      },
    }],
  },

  sectionGroupsPane: {
    wrapper:        "w-72 bg-white border-l border-zinc-950/10 p-4 overflow-y-auto",
    title:          "font-display uppercase text-[12.5px] tracking-wide text-slate-700 mb-3",
    groupRow:       "flex items-center gap-2 px-2 py-1.5 rounded-[4px] hover:bg-slate-50 cursor-pointer text-[13px] text-slate-700",
    groupRowActive: "flex items-center gap-2 px-2 py-1.5 rounded-[4px] bg-[#1F3F8F]/10 text-[#0F2D4D] cursor-pointer text-[13px] font-medium",
  },

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

  complexFilters: {
    wrapper:     "rounded-[8px] border border-zinc-950/10 bg-slate-50/60 p-3",
    headerRow:   "flex items-center gap-2 mb-2",
    headerLabel: "font-display uppercase text-[11px] tracking-wide text-slate-600",
    addButton:   "ml-auto text-[12px] text-[#1F3F8F] hover:text-[#16307A] cursor-pointer",
    filterRow:   "flex items-center gap-2 px-2 py-1.5 bg-white rounded-[4px] border border-zinc-950/5 text-[13px] text-slate-700",
    operator:    "font-mono text-[11px] uppercase tracking-wide text-slate-500 px-2",
  },

  attribution: { ...attribution },

  pageTree: {
    wrapper:    "flex flex-col text-[13px] font-proxima",
    item:       "flex items-center gap-2 px-2 py-1 hover:bg-slate-50 cursor-pointer text-slate-700",
    itemActive: "flex items-center gap-2 px-2 py-1 bg-[#1F3F8F]/10 text-[#0F2D4D] font-medium cursor-pointer",
    handle:     "text-slate-300 hover:text-slate-500 cursor-grab",
  },

  // userMenu — reverted to v1 (transportny-responsive). The v1 block
  // has full `@container` + `@[120px]:` responsive behavior tuned for
  // both the compact (64px) and full (256px) sidenav widths — collapses
  // the email/group block when narrow and expands it when wide. The v2
  // design system version was a simpler always-shown card.
  userMenu: {
    options: { activeStyle: 0 },
    styles: [{
      name: "transportny-responsive",
      userMenuContainer: "@container flex flex-1 flex-row w-full items-center justify-center @[120px]:justify-start rounded-lg bg-transparent @[120px]:bg-[#1a2029] @[120px]:mx-2 @[120px]:mb-2 p-1 @[120px]:p-2",
      avatarWrapper:     "flex justify-center items-center",
      avatar:            "size-10 border-2 border-[#3a4555] rounded-full flex items-center justify-center bg-[#2a3545] hover:bg-[#3a4555] cursor-pointer",
      avatarIcon:        "size-5 @[120px]:size-6 fill-slate-400",
      infoWrapper:       "hidden @[120px]:flex flex-col flex-1 px-2",
      emailText:         "text-xs font-normal text-slate-400 tracking-tight text-left truncate",
      groupText:         "text-sm font-medium text-white tracking-wide text-left",
      editControlWrapper:"flex justify-center items-center mt-2 @[120px]:mt-0",
      iconWrapper:       "size-10 @[120px]:size-8 flex items-center justify-center rounded-full @[120px]:rounded-md hover:bg-[#2a3545] cursor-pointer",
      icon:              "text-slate-400 hover:text-white size-5",
      viewIcon:          "ViewPage",
      editIcon:          "EditPage",
      loginWrapper:      "flex items-center transition-all cursor-pointer border-l-[3px] border-transparent text-slate-300 hover:text-white hover:bg-[#1e2530] justify-center py-3 @[120px]:justify-start @[120px]:px-4 @[120px]:py-2.5 @[120px]:gap-3",
      loginLink:         "",
      loginIconWrapper:  "",
      loginIcon:         "size-6 @[120px]:size-5 flex-shrink-0 text-slate-400",
      loginText:         "hidden @[120px]:inline font-['Proxima_Nova'] font-[400] text-[15px]",
      authContainer:     "@container w-full",
      authWrapper:       "flex flex-col-reverse @[120px]:flex-row p-1 @[120px]:p-2 items-center gap-2",
      userMenuWrapper:   "flex flex-col @[120px]:flex-row items-center @[120px]:flex-1 w-full",
    }],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// datasets.*
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
    fieldRow:   "grid grid-cols-[200px_1fr] gap-6 py-3 border-b border-zinc-950/5",
    fieldLabel: "font-display uppercase text-[11px] tracking-wide text-slate-500",
    fieldValue: "font-proxima text-[13.5px] text-slate-700",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// auth.*
// ─────────────────────────────────────────────────────────────────────────────
// The auth pages (authLogin.jsx / authSignup.jsx) are FIXED components styled via
// `theme.auth.authPages.sectionGroup.default.*` — that's the surface they actually
// read (authLogin.jsx:18). The earlier `auth.login` / `auth.signup` draft keys were
// wired to nothing and have been retired in favour of this surface. Keys here
// deep-merge over patterns/auth/defaultTheme.js.
//
// authLogin.jsx renders the extra mockup structure (brand line, kicker + headline +
// subtitle, "or" divider, SSO button, utility row) ONLY when the matching keys below
// are set — themes that omit them render the plain default form (backward-compatible).
// SSO has no provider wired yet; clicking it surfaces a "not available yet" notice.
const auth = {
  authPages: {
    sectionGroup: {
      default: {
        // AuthLayout wrappers — wrap the form column. The TNY mockup has no hero
        // panel, so wrapper4 (the background-image side) is hidden; wrapper3 is a
        // pass-through (centering + max-width live on the layoutGroup `auth` style).
        wrapper3: "w-full",
        wrapper4: "hidden",
        // AuthLogin / AuthSignup form content (single flex stack on the pane).
        pageWrapper:        "w-full flex flex-col gap-5",
        // Brand line (mark + wordmark).
        brandWrapper:       "flex items-center gap-2.5",
        brandMark:          "inline-flex size-7 bg-[#1F3F8F] rounded text-white font-display font-bold text-[11px] items-center justify-center",
        brandMarkText:      "NY",
        brandName:          "font-display uppercase text-[#0F1722] text-[13px] tracking-[0.14em]",
        brandNameText:      "TransportNY",
        // Title block — kicker + headline (+ amber period accent) + subtitle. Setting
        // headingText switches the component from the plain `pageTitle` to this block.
        headingBlock:       "flex flex-col",
        kicker:             "font-mono text-[10.5px] uppercase tracking-[0.2em] text-[#CA8A04]",
        kickerText:         "// SIGN IN",
        heading:            "mt-2 font-display font-semibold text-[32px] leading-[1.05] tracking-tight text-[#0F1722]",
        headingText:        "Welcome back",
        headingAccent:      "text-[#CA8A04]",
        headingAccentText:  ".",
        subtitle:           "mt-2.5 font-proxima text-[13.5px] leading-[1.55] text-slate-600",
        subtitleText:       "Public dashboards don't require an account. Sign in to save reports and configure alerts.",
        // pageTitle is the BC fallback when headingText is unset (e.g. authSignup).
        pageTitle:          "font-display font-semibold text-[32px] leading-[1.05] tracking-tight text-[#0F1722]",
        forgotPasswordText: "font-proxima text-[12px] text-[#1F3F8F] hover:text-[#16307A] cursor-pointer",
        actionButton:       "tny-press cursor-pointer inline-flex items-center justify-center gap-2 w-full px-4 h-11 bg-[#1F3F8F] hover:bg-[#16307A] border-b-4 border-[#0F2D4D] text-white font-display uppercase text-[13px] tracking-wide rounded-[6px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F3F8F]/40 disabled:opacity-50 mt-1",
        actionText:         "text-white font-display uppercase text-[13px] tracking-wide",
        // "or" divider + SSO button — DISABLED until NY.gov SSO exists. authLogin.jsx
        // only renders these when `divider` / `ssoButton` are set, so leaving them
        // commented hides the block. Uncomment to re-enable once a provider is wired.
        // divider:            "flex items-center gap-3 my-1 text-[10.5px] font-mono uppercase tracking-[0.18em] text-slate-400 before:flex-1 before:h-px before:bg-zinc-950/10 after:flex-1 after:h-px after:bg-zinc-950/10",
        // dividerText:        "or",
        // ssoButton:          "cursor-pointer w-full h-11 inline-flex items-center justify-center gap-2 rounded-[6px] border border-zinc-950/15 bg-white hover:bg-slate-50 font-proxima text-[13.5px] text-slate-800",
        // ssoMark:            "inline-flex size-5 rounded bg-[#1F3F8F] text-white font-display font-bold text-[10px] items-center justify-center",
        // ssoMarkText:        "NY",
        // ssoButtonText:      "Continue with NY.gov ID",
        prompt:             "mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-slate-500 flex gap-1",
        // Trailing utility row.
        utilityWrapper:     "mt-2 flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.16em] text-slate-500",
        utilityLink:        "hover:text-slate-900 cursor-pointer",
        utilityLinks: [
          { text: "Browse without account →", to: "/" },
          { text: "Request access",           to: "#" },
        ],
      },
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// fonts — theme-owned font loader.
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
  {
    // Brand surface utilities that can't be pure Tailwind class strings
    // (stacked gradients, :active margin-shift). Ported from the design
    // system's _shared.css so classes referenced in the theme (tny-hero-topo
    // on the hero band, tny-press on every brand button) actually render live.
    type: "style",
    id: "transportny-surfaces",
    content: `
      .tny-hero-topo {
        background:
          radial-gradient(circle at 25% 30%, rgba(15, 23, 42, 0.04), transparent 40%),
          radial-gradient(circle at 75% 70%, rgba(15, 23, 42, 0.05), transparent 50%),
          repeating-linear-gradient(28deg, transparent 0 30px, rgba(15, 23, 42, 0.035) 30px 31px, transparent 31px 60px),
          repeating-linear-gradient(-30deg, transparent 0 36px, rgba(15, 23, 42, 0.028) 36px 37px, transparent 37px 70px),
          #EEF1F3;
      }
      .tny-press        { border-bottom-width: 4px; transition: all 0.08s; }
      .tny-press:active { border-bottom-width: 2px; margin-bottom: 2px; }
    `,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// navOptions — preserved from original theme.js
// ─────────────────────────────────────────────────────────────────────────────
const navOptions = {
  authMenu: {
    navItems: [
      { name: "Datasets",    icon: "Database", path: "/datasources", type: "link" },
      { name: "Site Status", icon: "Settings", path: "/status",      type: "link" },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// pageComponents — preserved page-section types from original theme.js
// ─────────────────────────────────────────────────────────────────────────────
const pageComponents = {
  AddPageButton,
  Header,
};

// ─────────────────────────────────────────────────────────────────────────────
// widgets — preserved widget registry from original theme.js
// ─────────────────────────────────────────────────────────────────────────────
const widgets = {
  LogoNav:    { label: "Logo Nav",    component: LogoNav },
  QuickLinks: { label: "Quick Links", component: QuickLinks },
};

// ─────────────────────────────────────────────────────────────────────────────
// THE THEME OVERLAY
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// iconStyles — named box treatments for the lexical IconNode. An icon node with
// `styleKey: "productChip"` renders its SVG inside this padded, tinted square.
// Resolved in IconNode.decorate via config.theme.iconStyles[styleKey].
// ─────────────────────────────────────────────────────────────────────────────
const iconStyles = {
  productChip: {
    box:  "inline-flex size-12 rounded bg-[#1F3F8F]/10 items-center justify-center text-[#1F3F8F] mb-1",
    icon: "w-6 h-6",
  },
};

const transportnyTheme = {
  // Foundation
  textSettings,
  iconStyles,
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
  richtext: { contentPadding: 'p-4' },
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

  // Preserved from original
  navOptions,
  pageComponents,
  widgets,
};

export default transportnyTheme;
