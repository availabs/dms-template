// TransportNY · DMS theme overlay
// v0.1 · 2026-05-22
//
// This is the shipped code artifact for the TransportNY brand, expressed
// in the DMS theme contract: `options.activeStyle` + `styles[]` per
// primitive, with class strings as values. styles[0] is the complete
// default; styles[1+] are sparse overrides keyed by `name`.
//
// Color & type tokens are referenced as raw Tailwind classes throughout.
// Brand colors live in `tailwind.additions.js`; @font-face declarations
// and surface-utility classes live in `index.css.additions`.
//
// Pair with:
//   - icons.js                  → name → SVG-component map
//   - tailwind.additions.js     → theme.extend additions
//   - index.css.additions       → @font-face + tny-* utility classes

import icons from "./icons";

// ─────────────────────────────────────────────────────────────────────────────
// textSettings — the global type scale.
//
// `font-display` resolves to Oswald (condensed, headings & chrome).
// `font-sans` / `font-proxima` resolves to Proxima Nova / Source Sans 3
// (running prose & form copy). `font-mono` is the system mono stack.
//
// Heading sizes are tuned to the brand brief: Display 52px, H2 28px, H3 20px.
// Numeric scales use mono + tabular-nums so KPI values line up across cards.
// ─────────────────────────────────────────────────────────────────────────────
const textSettings = {
  options: { activeStyle: 0 },
  styles: [{
    name: "default",

    // Heading roles
    h1: "font-display font-semibold text-[52px] leading-[1.02] tracking-tight text-[#0F1722] scroll-mt-36",
    h2: "font-display font-semibold text-[38px] leading-[1.05] tracking-tight uppercase text-[#0F1722] scroll-mt-36",
    h3: "font-display font-semibold text-[28px] leading-[1.1] text-[#0F1722] scroll-mt-36",
    h4: "font-display font-medium text-[20px] leading-[1.2] text-[#0F1722] scroll-mt-36",
    h5: "font-display font-medium text-[16px] leading-[1.3] uppercase tracking-wide text-[#0F1722] scroll-mt-36",
    h6: "font-display font-medium text-[14px] leading-[1.4] uppercase tracking-[0.16em] text-slate-700 scroll-mt-36",

    // Size + weight scale (Card cells select these via valueFontStyle)
    textXS: "text-[11px] font-medium",
    textXSReg: "text-[11px] font-normal",
    textXSBold: "text-[11px] font-bold",
    textSM: "text-[12.5px] font-medium",
    textSMReg: "text-[12.5px] font-normal",
    textSMBold: "text-[12.5px] font-bold",
    textSMSemiBold: "text-[12.5px] font-semibold",
    textBase: "text-[14.5px] font-normal leading-[1.6]",
    textBaseMed: "text-[14.5px] font-medium leading-[1.6]",
    textBaseSemiBold: "text-[14.5px] font-semibold leading-[1.6]",
    textMD: "text-[15px] font-medium",
    textMDReg: "text-[15px] font-normal",
    textMDBold: "text-[15px] font-bold",
    textMDSemiBold: "text-[15px] font-semibold",
    textLG: "text-[18px] font-medium",
    textXL: "text-[20px] font-medium font-display",
    textXLSemiBold: "text-[20px] font-semibold font-display",
    text2XL: "text-[24px] font-semibold font-display",
    text2XLReg: "text-[24px] font-normal font-display",
    text3XL: "text-[28px] font-semibold font-display",
    text3XLReg: "text-[28px] font-normal font-display",
    text4XL: "text-[34px] font-semibold font-display tracking-tight",
    text5XL: "text-[40px] font-semibold font-display tracking-tight",
    text6XL: "text-[52px] font-semibold font-display tracking-tight",
    text7XL: "text-[64px] font-semibold font-display tracking-tight",
    text8XL: "text-[80px] font-semibold font-display tracking-tight",

    // Tabular variants — numbers in tables, KPI cells, time-series axes
    numXS: "font-mono text-[11px] tabular-nums",
    numSM: "font-mono text-[12.5px] tabular-nums",
    numBase: "font-mono text-[14.5px] tabular-nums",
    numMD: "font-mono text-[18px] font-medium tabular-nums",
    numLG: "font-mono text-[22px] font-medium tabular-nums",
    numXL: "font-mono text-[28px] font-medium tabular-nums",
    num2XL: "font-mono text-[40px] font-medium tabular-nums",

    // Semantic aliases
    body: "font-proxima text-[14.5px] font-normal leading-[1.65] text-slate-700",
    bodySmall: "font-proxima text-[12.5px] font-normal leading-[1.55] text-slate-600",
    caption: "font-proxima text-[12px] font-normal text-slate-500",
    label: "font-proxima text-[13px] font-medium text-slate-700",

    // Editorial kicker — the "// 01" mono labels that mark section heads
    kicker: "font-mono text-[10.5px] uppercase tracking-[0.2em] text-[#CA8A04]",
    nav: "font-display font-medium text-[13.5px] uppercase tracking-wide",
  }],
};

// ─────────────────────────────────────────────────────────────────────────────
// Layout — page chrome (outer wrapper, optional TopNav, optional SideNav).
//
// TransportNY uses a persistent dark sidebar (sidebar-ink #12181F) and no
// TopNav. The content pane is the pale grey "tny-pane" (#ECEEF2), which
// hosts white cards. `default` is the marketing variant (no nav, plain
// background); `app` is the canonical product variant (sidebar, pane bg);
// `bare` is the auth variant (no chrome).
// ─────────────────────────────────────────────────────────────────────────────
const layout = {
  options: {
    activeStyle: 1,
    sideNav: {
      size: "compact",
      nav: "main",
      activeStyle: 0,
      subMenuActivate: "onHover",
      topMenu: [{ type: "LogoNav" }],
      bottomMenu: [{ type: "UserMenu" }],
    },
    topNav: { size: "none", nav: "none", activeStyle: null, leftMenu: [], rightMenu: [] },
  },
  styles: [
    {
      name: "default",
      outerWrapper: "bg-white",
      wrapper: "relative isolate flex min-h-svh w-full max-lg:flex-col",
      wrapper2: "flex-1 flex flex-col items-stretch max-w-full min-h-screen",
      wrapper3: "flex flex-1 items-start",
      childWrapper: "flex-1 flex flex-col h-full",
    },
    {
      name: "app",
      outerWrapper: "bg-[#ECEEF2]",
      wrapper: "relative isolate flex min-h-svh w-full max-lg:flex-col",
      wrapper2: "flex-1 flex flex-col items-stretch max-w-full min-h-screen lg:ml-60",
      wrapper3: "flex flex-1 items-start",
      childWrapper: "flex-1 flex flex-col h-full bg-[#ECEEF2]",
    },
    {
      name: "bare",
      outerWrapper: "bg-[#ECEEF2]",
      wrapper: "relative isolate flex min-h-svh w-full place-content-center",
      wrapper2: "flex-1 flex flex-col items-center justify-center max-w-full min-h-screen",
      wrapper3: "flex flex-1 items-center justify-center w-full",
      childWrapper: "flex-1 flex flex-col items-center justify-center w-full h-full",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// LayoutGroup — bands of content within a Layout.
//
// The cards-on-pane rule: section bg is always the pane (or pane-tint);
// content lives inside cards. wrapper1 is the band's outer container
// (full-width, sets the band's background); wrapper2 is the bounded inner
// container that holds Sections.
// ─────────────────────────────────────────────────────────────────────────────
const layoutGroup = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: "content",
      wrapper1: "w-full bg-[#ECEEF2] py-12",
      wrapper2: "mx-auto w-full max-w-[1480px] px-8 flex flex-col gap-6",
      wrapper3: "",
    },
    {
      name: "content_tint",
      wrapper1: "w-full bg-[#E4E8EE] py-12",
      wrapper2: "mx-auto w-full max-w-[1480px] px-8 flex flex-col gap-6",
      wrapper3: "",
    },
    {
      name: "header",
      wrapper1: "w-full bg-white border-b border-zinc-950/10",
      wrapper2: "mx-auto w-full max-w-[1480px] px-8 py-10 flex flex-col gap-4",
      wrapper3: "",
    },
    {
      name: "hero",
      wrapper1: "w-full tny-hero-topo border-b border-zinc-950/10",
      wrapper2: "mx-auto w-full max-w-[1480px] px-8 py-14 flex flex-col gap-5",
      wrapper3: "",
    },
    {
      name: "tone_bar",
      wrapper1: "w-full bg-[#1F3F8F] text-white border-b border-black/10",
      wrapper2: "mx-auto w-full max-w-[1480px] px-8 h-12 flex items-center gap-8",
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
      wrapper2: "mx-auto w-full max-w-[1480px] px-8 py-4 flex items-center justify-between",
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
// `default` is the expanded 240px rail with full labels.
// `compact` is the 64px icon-only rail with hover-flyout submenus.
// ─────────────────────────────────────────────────────────────────────────────
const sidenav = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: "default",
      layoutContainer1: "lg:ml-60",
      layoutContainer2: "fixed inset-y-0 left-0 w-60 max-lg:hidden z-30",
      logoWrapper: "relative h-16 bg-[#0A0E13] border-b border-[#2a3545] flex items-center px-3",
      sidenavWrapper: "flex flex-col w-60 h-full bg-[#12181F] border-r border-[#2a3545]",
      menuItemWrapper: "flex flex-col",
      menuItemWrapper_level_1: "",
      menuItemWrapper_level_2: "pl-4 bg-[#0d1117]",
      menuItemWrapper_level_3: "pl-6",
      menuItemWrapper_level_4: "pl-8",
      navitemSide: "font-proxima text-[13.5px] group flex items-center px-4 py-2.5 hover:bg-[#1e2530] text-slate-300 border-l-[3px] border-transparent transition-colors cursor-pointer",
      navitemSideActive: "font-proxima text-[13.5px] group flex items-center px-4 py-2.5 bg-[#1e2530] text-white border-l-[3px] border-[#FACC15] transition-colors cursor-pointer",
      menuIconSide: "size-[18px] mr-3 text-slate-400 group-hover:text-slate-300 flex-shrink-0",
      menuIconSideActive: "size-[18px] mr-3 text-[#FACC15] flex-shrink-0",
      itemsWrapper: "flex-1 py-2 overflow-y-auto scrollbar-sm",
      navItemContent: "flex-1 flex items-center justify-between transition-transform",
      indicatorIcon: "ChevronRight",
      indicatorIconOpen: "ChevronDown",
      indicatorIconWrapper: "size-4 text-slate-500 transition-transform ml-auto",
      subMenuWrapper_1: "w-full bg-[#0d1117]",
      subMenuWrapper_2: "w-full",
      bottomMenuWrapper: "border-t border-[#2a3545] py-2",
      sectionDivider: "my-3 border-t border-[#2a3545]",
      sectionHeading: "px-4 py-2 text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-[0.2em]",
      searchButtonWrapper: "px-3 pt-3",
      searchButton: "w-full h-9 px-3 rounded-full bg-[#1a2029] border border-[#2a3545] hover:border-[#3a4555] flex items-center gap-2 text-slate-400 hover:text-slate-300",
      searchButtonText: "font-proxima text-[13px] flex-1 text-left",
      userBlock: "flex items-center gap-3 px-4 py-2",
      userAvatar: "w-8 h-8 rounded-full bg-gradient-to-br from-[#37576B] to-[#1f3450] flex items-center justify-center text-white text-[11px] font-medium ring-1 ring-[#FACC15]/20",
      userName: "font-display uppercase text-white text-[12px] tracking-wide truncate",
      userRole: "font-mono text-slate-400 text-[10px] uppercase tracking-[0.18em] truncate",
    },
    {
      name: "compact",
      layoutContainer1: "lg:ml-16",
      layoutContainer2: "fixed inset-y-0 left-0 w-16 max-lg:hidden z-30",
      logoWrapper: "relative h-16 bg-[#0A0E13] border-b border-[#2a3545] flex items-center justify-center",
      sidenavWrapper: "flex flex-col w-16 h-full bg-[#12181F] border-r border-[#2a3545] items-center overflow-visible",
      navitemSide: "group relative flex items-center justify-center w-full py-3 hover:bg-[#1e2530] text-slate-400 border-l-[3px] border-transparent transition-colors cursor-pointer",
      navitemSideActive: "group relative flex items-center justify-center w-full py-3 bg-[#1e2530] text-white border-l-[3px] border-[#FACC15] transition-colors cursor-pointer",
      menuIconSide: "size-6 text-slate-400 group-hover:text-slate-300",
      menuIconSideActive: "size-6 text-[#FACC15]",
      subMenuWrapper_1: "min-w-[220px] bg-[#1a2029] border border-[#3a4555] shadow-2xl",
      subMenuOuterWrapper: "absolute left-full top-0 z-50",
      sectionHeading: "hidden",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// topnav — used only on the marketing/landing variant; product pages
// don't render a TopNav.
// ─────────────────────────────────────────────────────────────────────────────
const topnav = {
  options: { activeStyle: 0 },
  styles: [{
    name: "default",
    layoutContainer1: "h-[60px]",
    layoutContainer2: "w-full z-20 bg-white border-b border-zinc-950/10",
    topnavWrapper: "w-full h-[60px] flex items-center",
    topnavContent: "mx-auto max-w-[1280px] w-full flex items-center justify-between px-8",
    leftMenuContainer: "flex items-center gap-6",
    centerMenuContainer: "hidden lg:flex items-center gap-8",
    rightMenuContainer: "flex items-center gap-3",
    navitem: "font-display font-medium text-[13.5px] uppercase tracking-wide text-slate-700 hover:text-[#0F1722] cursor-pointer transition-colors",
    navitemActive: "font-display font-medium text-[13.5px] uppercase tracking-wide text-[#0F1722] border-b-2 border-[#FACC15] cursor-pointer",
    mobileButton: "lg:hidden h-8 w-8 inline-flex items-center justify-center text-slate-700 hover:bg-slate-100 rounded",
    menuOpenIcon: "Menu",
    menuCloseIcon: "XMark",
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
      image: "w-9 h-9 object-contain",
      text: "font-display uppercase text-white text-[15px] tracking-wide truncate flex-1",
      img: "/themes/transportny/nys_logo_white.svg",
      title: "TransportNY",
      linkPath: "/",
    },
    {
      name: "compact",
      wrapper: "flex items-center justify-center h-16 w-16 bg-[#0A0E13]",
      image: "w-9 h-9 object-contain",
      text: "hidden",
    },
    {
      name: "light",
      wrapper: "flex items-center gap-3 h-16",
      image: "w-9 h-9 object-contain",
      text: "font-display uppercase text-[#0F1722] text-[15px] tracking-wide",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// button
//
// `default`  → primary NYS-blue with tone-bar press (4px bottom edge that
//              compresses on :active for an 80ms mass effect)
// `plain`    → text-only ghost
// `active`   → solid filled state
// `secondary`→ outlined white surface
// `danger`   → destructive
// ─────────────────────────────────────────────────────────────────────────────
const button = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: "default",
      button: "tny-press cursor-pointer inline-flex items-center gap-2 px-4 h-10 bg-[#1F3F8F] hover:bg-[#16307A] border-b-4 border-[#0F2D4D] text-white font-display uppercase text-[13px] tracking-wide rounded-[6px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F3F8F]/40 disabled:opacity-50",
      icon: "",
      iconLeft: "size-4",
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
      button: "cursor-pointer inline-flex items-center gap-2 px-4 h-10 bg-white hover:bg-slate-50 border border-zinc-950/15 text-slate-800 font-proxima text-[13px] font-medium rounded-[6px] transition-colors disabled:opacity-50",
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
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// input — flat theme (per the spec, input/textarea/edit are flat)
// ─────────────────────────────────────────────────────────────────────────────
const input = {
  input: "relative w-full block appearance-none rounded-[6px] px-3 h-11 text-[14px] text-[#0F1722] placeholder:text-slate-400 border border-zinc-950/15 hover:border-zinc-950/30 bg-white focus:outline-none focus:border-[#1F3F8F] focus:ring-2 focus:ring-[#1F3F8F]/15 aria-invalid:border-[#EF4444] disabled:opacity-50 disabled:bg-slate-50",
  inputContainer: "group flex relative w-full",
  textarea: "relative block h-full w-full appearance-none rounded-[6px] px-3 py-2 text-[14px] text-[#0F1722] placeholder:text-slate-400 border border-zinc-950/15 hover:border-zinc-950/30 bg-white focus:outline-none focus:border-[#1F3F8F] focus:ring-2 focus:ring-[#1F3F8F]/15 resize-y",
  confirmButtonContainer: "absolute right-0 hidden group-hover:flex items-center",
  editButton: "py-1.5 px-2 text-slate-400 hover:text-[#1F3F8F] cursor-pointer",
  cancelButton: "text-slate-400 hover:text-[#EF4444] cursor-pointer py-1.5 pr-1",
  confirmButton: "text-[#10B981] hover:text-white hover:bg-[#10B981] cursor-pointer rounded-full",
};

// ─────────────────────────────────────────────────────────────────────────────
// multiselect — the largest single primitive theme
// ─────────────────────────────────────────────────────────────────────────────
const multiselect = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: "default",
      view: "font-proxima",
      mainWrapper: "relative",
      inputWrapper: "flex w-full items-center gap-1.5 min-h-11 px-3 rounded-[6px] border border-zinc-950/15 hover:border-zinc-950/30 bg-white focus-within:border-[#1F3F8F] focus-within:ring-2 focus-within:ring-[#1F3F8F]/15 cursor-pointer",
      caretWrapper: "ml-auto pl-1 text-slate-500",
      caretIcon: "CaretDown",
      input: "flex-1 bg-transparent text-[14px] text-[#0F1722] placeholder:text-slate-400 focus:outline-none",
      statusWrapper: "text-[12px] text-slate-500",
      singleValue: "text-[14px] text-[#0F1722]",
      singlePlaceholder: "text-[14px] text-slate-400",
      tokenWrapper: "inline-flex items-center gap-1 h-7 pl-2 pr-1 rounded-[4px] bg-[#37576B]/10 text-[#0F2D4D] text-[12.5px] font-medium",
      removeIcon: "XMark",
      removeIconClass: "size-3.5 text-slate-500 hover:text-[#EF4444] cursor-pointer",
      menuWrapper: "absolute z-40 mt-1 w-full rounded-[8px] border border-zinc-950/10 bg-white shadow-lg overflow-hidden",
      optionsWrapper: "max-h-72 overflow-y-auto scrollbar-sm py-1",
      menuItem: "px-3 py-2 text-[13.5px] text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center gap-2",
      menuItemSelected: "px-3 py-2 text-[13.5px] text-[#0F1722] bg-[#1F3F8F]/5 cursor-pointer flex items-center gap-2",
      smartMenuWrapper: "px-3 py-2 border-b border-zinc-950/05 bg-slate-50/60",
      smartMenuItem: "text-[12px] text-slate-500",
      error: "mt-1 text-[12px] text-[#EF4444]",
    },
    {
      name: "compact",
      // h-8 chip: lives inside page headers / toolbars (year picker, geography, etc.)
      inputWrapper: "flex items-center gap-1.5 h-8 px-2.5 rounded-[6px] border border-zinc-950/10 hover:border-[#37576B] bg-white text-[12px] cursor-pointer transition-colors",
      caretWrapper: "ml-1 text-slate-500",
      singleValue: "text-[12px] text-slate-700 font-medium",
      menuWrapper: "absolute z-40 mt-1 min-w-[180px] rounded-[6px] border border-zinc-950/10 bg-white shadow-lg overflow-hidden",
      menuItem: "px-3 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-50 cursor-pointer",
    },
    {
      name: "tone_bar",
      // white-on-blue: lives inside the saturated NYS-blue filter strip
      inputWrapper: "flex items-center gap-1.5 px-2 -mx-2 py-1 rounded text-white hover:bg-white/10 cursor-pointer",
      singleValue: "font-semibold text-[13px] text-white",
      caretWrapper: "ml-1 text-white/70",
    },
    {
      name: "multiselect_with_search",
      inputWrapper: "flex w-full items-center gap-1.5 min-h-11 px-3 rounded-[6px] border border-zinc-950/15 hover:border-zinc-950/30 bg-white cursor-pointer",
      menuWrapper: "absolute z-40 mt-1 w-full rounded-[8px] border border-zinc-950/10 bg-white shadow-lg overflow-hidden",
      smartMenuWrapper: "px-2 py-2 border-b border-zinc-950/10 bg-white",
      smartMenuItem: "w-full h-8 px-2 rounded border border-zinc-950/10 bg-white text-[13px] focus:outline-none focus:border-[#1F3F8F]",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// tabs — the segmented Graph / Table / Cards toggle in trend pages,
// plus the standard pattern-editor tab strip
// ─────────────────────────────────────────────────────────────────────────────
const tabs = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: "default",
      wrapper: "flex flex-col gap-3",
      tabList: "flex items-center border-b border-zinc-950/10",
      tab: "px-3 h-10 font-display uppercase text-[12.5px] tracking-wide text-slate-500 hover:text-[#0F1722] cursor-pointer border-b-2 border-transparent",
      tabActive: "px-3 h-10 font-display uppercase text-[12.5px] tracking-wide text-[#0F1722] border-b-2 border-[#FACC15] cursor-pointer",
      tabPanel: "py-4",
    },
    {
      name: "segmented",
      tabList: "inline-flex items-center gap-0 rounded-[6px] bg-[#0A0E13] p-0.5",
      tab: "px-3 h-7 inline-flex items-center gap-1.5 font-proxima text-[12px] text-slate-400 hover:text-slate-200 cursor-pointer rounded-[4px]",
      tabActive: "px-3 h-7 inline-flex items-center gap-1.5 font-proxima text-[12px] text-white bg-[#1e2530] cursor-pointer rounded-[4px] [&_svg]:text-[#FACC15]",
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
    wrapper: "inline-flex items-center gap-2 cursor-pointer",
    track: "relative inline-flex h-5 w-9 items-center rounded-full bg-slate-300 transition-colors",
    trackChecked: "relative inline-flex h-5 w-9 items-center rounded-full bg-[#1F3F8F] transition-colors",
    thumb: "inline-block h-4 w-4 rounded-full bg-white shadow translate-x-0.5 transition-transform",
    thumbChecked: "inline-block h-4 w-4 rounded-full bg-white shadow translate-x-4 transition-transform",
    label: "font-proxima text-[13px] text-slate-700",
  }],
};

// ─────────────────────────────────────────────────────────────────────────────
// field / label
// ─────────────────────────────────────────────────────────────────────────────
const field = {
  field: "flex flex-col gap-1.5 pb-2",
  label: "font-display uppercase text-[11px] tracking-[0.16em] text-slate-600",
  description: "font-proxima text-[12px] text-slate-500",
  error: "font-proxima text-[12px] text-[#EF4444]",
};

const label = {
  labelWrapper: "px-2.5 pt-2 pb-1.5 rounded-md",
  label: "inline-flex items-center rounded-[4px] px-1.5 py-0.5 text-[12.5px] font-medium",
};

// ─────────────────────────────────────────────────────────────────────────────
// dialog / modal — flat themes
// ─────────────────────────────────────────────────────────────────────────────
const dialog = {
  backdrop: "fixed inset-0 bg-zinc-950/40",
  dialogContainer: "fixed inset-0 z-50 w-screen overflow-y-auto pt-6 sm:pt-0",
  dialogContainer2: "relative grid min-h-full grid-rows-[1fr_auto] justify-items-center sm:grid-rows-[1fr_auto_3fr] sm:p-4",
  dialogPanel: "row-start-2 w-full min-w-0 rounded-t-[12px] sm:rounded-[12px] bg-white p-8 shadow-2xl ring-1 ring-zinc-950/10 sm:mb-auto",
  sizes: {
    xs: "sm:max-w-xs",
    sm: "sm:max-w-sm",
    md: "sm:max-w-md",
    lg: "sm:max-w-lg",
    xl: "sm:max-w-xl",
    "2xl": "sm:max-w-2xl",
    "3xl": "sm:max-w-3xl",
    "4xl": "sm:max-w-4xl",
    "5xl": "sm:max-w-5xl",
  },
};

const modal = { ...dialog };

// ─────────────────────────────────────────────────────────────────────────────
// navigableMenu — keyboard-navigable popover (section menus, toolbars)
// ─────────────────────────────────────────────────────────────────────────────
const navigableMenu = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: "default",
      button: "h-7 w-7 inline-flex items-center justify-center rounded hover:bg-slate-100 text-slate-500 cursor-pointer",
      buttonHidden: "hidden group-hover:flex",
      icon: "More",
      iconWrapper: "size-4",
      menuWrapper: "bg-white border border-zinc-950/10 w-60 p-1 min-h-[60px] rounded-[8px] shadow-lg",
      menuHeaderWrapper: "flex px-2 py-1 justify-between items-center",
      menuTitle: "font-display uppercase text-[11px] tracking-wide text-slate-500",
      menuItemsWrapper: "max-h-[60vh] overflow-y-auto scrollbar-sm",
      menuItem: "group flex w-full gap-2 items-center justify-between px-2.5 py-1.5 rounded-[6px] text-[13px] text-slate-700",
      menuItemHover: "hover:bg-slate-50 hover:text-[#0F1722]",
      menuItemIconLabelWrapper: "flex flex-1 items-center gap-2",
      menuItemIconWrapper: "size-4 text-slate-500 group-hover:text-slate-700",
      menuItemLabel: "text-slate-700",
      subMenuIcon: "ChevronRight",
      subMenuIconWrapper: "size-3.5 text-slate-400",
      valueWrapper: "px-1.5 rounded bg-slate-100 text-slate-700 text-[12px]",
      separator: "w-full border-b border-zinc-950/05 my-1",
    },
    {
      name: "dark",
      menuWrapper: "bg-[#1a2029] border border-[#3a4555] w-60 p-1 min-h-[60px] rounded-[8px] shadow-2xl",
      menuItem: "group flex w-full gap-2 items-center justify-between px-2.5 py-1.5 rounded-[6px] text-[13px] text-slate-300",
      menuItemHover: "hover:bg-[#2a3545] hover:text-white",
      menuItemLabel: "text-slate-300",
      menuItemIconWrapper: "size-4 text-slate-400 group-hover:text-slate-200",
      separator: "w-full border-b border-[#3a4555] my-1",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// dataCard — the workhorse. Single-column "every section on its own row"
// rule plus the size + image + font scales authors choose from.
// ─────────────────────────────────────────────────────────────────────────────
const dataCard = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: "default",
      // Card surface
      wrapper: "rounded-[8px] border border-zinc-950/10 bg-white shadow-sm overflow-hidden",
      cardsGrid: "grid gap-4",
      cellsGrid: "grid",
      // Headers + values
      header: "font-display uppercase text-[12.5px] tracking-[0.04em] text-slate-500 px-3 pt-3 pb-1",
      headerValueWrapper: "flex flex-col w-full",
      headerValueWrapperFullBleed: "w-full",
      value: "px-3 pb-3 text-[14px] text-[#0F1722]",
      valueWrapper: "min-h-[20px]",
      description: "font-proxima text-[12px] font-light text-slate-500 px-3 pb-2",
      itemBorder: "border border-zinc-950/05",
      cardBorder: "border border-zinc-950/10",
      cellBorderBelow: "border-b border-zinc-950/05",

      // Image cell sizing (used when type:'image')
      imgXS: "max-w-16 max-h-16",
      imgSM: "max-w-24 max-h-24",
      imgMD: "max-w-32 max-h-32",
      imgXL: "max-w-40 max-h-40",
      img2XL: "max-w-48 max-h-48",
      img3XL: "max-w-56 max-h-56",
      img4XL: "max-w-64 max-h-64",
      img5XL: "max-w-72 max-h-72",
      img6XL: "max-w-80 max-h-80",
      img7XL: "max-w-96 max-h-96",
      img8XL: "max-w-[32rem] max-h-[32rem]",
      imgDefault: "max-w-[50px] max-h-[50px]",

      // Mirrors of textSettings keys so Card cells can resolve a font style
      // by name without going up to textSettings. (DMS Card reads
      // valueFontStyle from this dictionary first, falling back to
      // textSettings.)
      textXS: "text-[11px] font-medium",
      textXSReg: "text-[11px] font-normal",
      textSM: "text-[12.5px] font-medium",
      textSMReg: "text-[12.5px] font-normal",
      textSMBold: "text-[12.5px] font-bold",
      textSMSemiBold: "text-[12.5px] font-semibold",
      textMD: "text-[15px] font-medium",
      textMDReg: "text-[15px] font-normal",
      textMDBold: "text-[15px] font-bold",
      textMDSemiBold: "text-[15px] font-semibold",
      textXL: "text-[20px] font-medium font-display",
      textXLSemiBold: "text-[20px] font-semibold font-display",
      text2XL: "text-[24px] font-semibold font-display",
      text2XLReg: "text-[24px] font-normal font-display",
      text3XL: "text-[28px] font-semibold font-display",
      text3XLReg: "text-[28px] font-normal font-display",
      text4XL: "text-[34px] font-semibold font-display tracking-tight",
      text5XL: "text-[40px] font-semibold font-display tracking-tight",
      text6XL: "text-[52px] font-semibold font-display tracking-tight",
      text7XL: "text-[64px] font-semibold font-display tracking-tight",
      text8XL: "text-[80px] font-semibold font-display tracking-tight",
      numLG: "font-mono text-[22px] font-medium tabular-nums text-[#0F1722]",
      numXL: "font-mono text-[28px] font-medium tabular-nums text-[#0F1722]",

      justifyTextLeft: "text-start justify-items-start",
      justifyTextRight: "text-end justify-items-end",
      justifyTextCenter: "text-center justify-items-center",
    },
    {
      name: "kpi",
      // Tight KPI card: kicker → value → delta. Used by composed KpiCard.
      wrapper: "rounded-[8px] border border-zinc-950/10 bg-white shadow-sm p-4 flex flex-col gap-1",
      header: "font-display uppercase text-[12.5px] tracking-[0.04em] text-slate-500",
      value: "font-mono text-[28px] font-medium tabular-nums text-[#0F1722]",
      description: "font-proxima text-[12px] text-slate-500",
    },
    {
      name: "editorial",
      // Warm bone surface for printable narrative cards
      wrapper: "rounded-[8px] border-2 border-dashed border-amber-300 bg-[#F5F1E8] p-6",
      header: "font-display uppercase font-bold text-[14px] tracking-wide text-[#0F1722] border-b-2 border-[#EAAD43] inline-block pb-0.5",
      value: "text-[13px] text-slate-700 mt-3 leading-[1.65]",
    },
    {
      name: "title_bar",
      // Card with a tinted title bar (Display dropdown + drag handle row)
      wrapper: "rounded-[8px] border border-zinc-950/10 bg-white shadow-sm overflow-hidden",
      header: "h-11 px-3 flex items-center gap-2 border-b border-zinc-950/10 bg-slate-50/60 font-display font-medium text-[14px] text-[#2D3E4C]",
      value: "p-4 text-[14px] text-[#0F1722]",
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
    header: "px-4 py-3 border-b border-zinc-950/05 font-display uppercase text-[12.5px] tracking-wide text-slate-700",
    body: "p-4 text-[14px] text-slate-700",
    footer: "px-4 py-3 border-t border-zinc-950/05 text-[12px] text-slate-500",
  }],
};

// ─────────────────────────────────────────────────────────────────────────────
// pill — status / badge / token
//
// Status is a colored dot, never a background — `status_dot_*` styles render
// a 6-7px dot + text. `solid_*` variants only used for category/tag chips.
// ─────────────────────────────────────────────────────────────────────────────
const pill = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: "default",
      wrapper: "inline-flex items-center gap-1.5 px-2 h-6 rounded-[4px] text-[11.5px] font-medium border",
    },
    { name: "blue",   wrapper: "inline-flex items-center gap-1.5 px-2 h-6 rounded-[4px] text-[11.5px] font-medium border border-[#1F3F8F]/20 bg-[#1F3F8F]/10 text-[#0F2D4D]" },
    { name: "slate",  wrapper: "inline-flex items-center gap-1.5 px-2 h-6 rounded-[4px] text-[11.5px] font-medium border border-[#37576B]/20 bg-[#37576B]/10 text-[#0F2D4D]" },
    { name: "amber",  wrapper: "inline-flex items-center gap-1.5 px-2 h-6 rounded-[4px] text-[11.5px] font-medium border border-[#EAAD43]/30 bg-[#EAAD43]/15 text-[#7C5A12]" },
    { name: "green",  wrapper: "inline-flex items-center gap-1.5 px-2 h-6 rounded-[4px] text-[11.5px] font-medium border border-[#10B981]/30 bg-[#10B981]/10 text-[#065F46]" },
    { name: "red",    wrapper: "inline-flex items-center gap-1.5 px-2 h-6 rounded-[4px] text-[11.5px] font-medium border border-[#EF4444]/30 bg-[#EF4444]/10 text-[#991B1B]" },
    { name: "zinc",   wrapper: "inline-flex items-center gap-1.5 px-2 h-6 rounded-[4px] text-[11.5px] font-medium border border-zinc-950/10 bg-slate-100 text-slate-700" },

    // Status dots (a leading colored dot + label; never a colored background)
    { name: "status_good",    wrapper: "inline-flex items-center gap-1.5 text-[12px] text-emerald-700 [&::before]:content-[''] [&::before]:size-1.5 [&::before]:rounded-full [&::before]:bg-emerald-500" },
    { name: "status_warn",    wrapper: "inline-flex items-center gap-1.5 text-[12px] text-amber-700 [&::before]:content-[''] [&::before]:size-1.5 [&::before]:rounded-full [&::before]:bg-amber-400" },
    { name: "status_bad",     wrapper: "inline-flex items-center gap-1.5 text-[12px] text-rose-700 [&::before]:content-[''] [&::before]:size-1.5 [&::before]:rounded-full [&::before]:bg-rose-500" },
    { name: "status_na",      wrapper: "inline-flex items-center gap-1.5 text-[12px] text-slate-500 [&::before]:content-[''] [&::before]:size-1.5 [&::before]:rounded-full [&::before]:bg-slate-400" },
  ],
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
      wrapper: "rounded-[8px] border border-zinc-950/10 bg-white shadow-sm overflow-hidden",
      table: "w-full text-[13px] text-slate-700",
      thead: "bg-slate-50/80 border-b border-zinc-950/10",
      th: "px-3 py-2 text-left font-display uppercase text-[11px] tracking-wide text-slate-600",
      tr: "border-b border-zinc-950/05 hover:bg-[#FFFBEB]",
      trAlt: "border-b border-zinc-950/05 bg-slate-50/50 hover:bg-[#FFFBEB]",
      td: "px-3 py-2 text-[13px] text-slate-700",
      tdEdit: "px-3 py-2",
      headerCell: "px-3 py-2 text-left font-display uppercase text-[11px] tracking-wide text-slate-600",
      headerCellSortable: "px-3 py-2 text-left font-display uppercase text-[11px] tracking-wide text-slate-600 cursor-pointer hover:text-[#0F1722]",
      pagination: "px-3 h-10 flex items-center justify-between border-t border-zinc-950/05 bg-slate-50/40",
      pageRangeItem: "px-2 py-0.5 text-[12px] text-slate-600 hover:bg-slate-100 rounded cursor-pointer",
      pageRangeItemActive: "px-2 py-0.5 text-[12px] text-[#0F1722] bg-slate-200 rounded font-medium",
    },
    {
      name: "editorial",
      // Deep navy header, bone tint, for printable docs
      wrapper: "rounded-[8px] border border-zinc-950/10 bg-[#F5F1E8] shadow-sm overflow-hidden",
      thead: "bg-[#0F2D4D]",
      th: "px-3 py-2 text-left font-display uppercase text-[11px] tracking-wide text-white",
      tr: "border-b border-amber-900/10",
      td: "px-3 py-2 text-[13px] text-[#0F1722]",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// lexical — rich text. Inherits headings from textSettings.
// ─────────────────────────────────────────────────────────────────────────────
const lexical = {
  paragraph: "font-proxima text-[14.5px] leading-[1.65] text-slate-700 mb-3",
  h1: "font-display font-semibold text-[40px] leading-[1.05] tracking-tight text-[#0F1722] mt-8 mb-3",
  h2: "font-display font-semibold text-[28px] leading-[1.1] text-[#0F1722] mt-6 mb-2",
  h3: "font-display font-medium text-[20px] leading-[1.2] text-[#0F1722] mt-4 mb-1.5",
  h4: "font-display font-medium text-[16px] leading-[1.3] text-[#0F1722] mt-3 mb-1",
  list: "list-disc pl-6 space-y-1 text-[14.5px] text-slate-700",
  listOrdered: "list-decimal pl-6 space-y-1 text-[14.5px] text-slate-700",
  listItem: "leading-[1.65]",
  link: "text-[#1F3F8F] underline underline-offset-2 hover:text-[#16307A]",
  code: "font-mono text-[0.92em] px-1.5 py-0.5 rounded bg-zinc-950/05 border border-zinc-950/06 text-[#37576B]",
  codeBlock: "font-mono text-[12.5px] leading-[1.55] p-4 rounded-[6px] bg-[#0F1722] text-slate-100 overflow-x-auto",
  quote: "border-l-4 border-[#EAAD43] pl-4 italic text-slate-600",
  image: "rounded-[6px] my-4",
};

// ─────────────────────────────────────────────────────────────────────────────
// graph / avlGraph — chart container, axis, tooltip, palettes
// ─────────────────────────────────────────────────────────────────────────────
const graph = {
  text: "font-proxima text-[12px] text-slate-600",
  darkModeText: "font-proxima text-[12px] text-white bg-transparent",
  headerWrapper: "flex items-baseline justify-between mb-2",
  title: "font-display uppercase text-[12.5px] tracking-wide text-slate-700",
  axis: "stroke-zinc-950/15",
  grid: "stroke-zinc-950/05",
  tooltip: "rounded-[6px] bg-[#0F1722] text-white text-[12px] px-2.5 py-1.5 shadow-lg font-proxima",
  // Categorical palette (max 5)
  catPalette: ["#6F6F6F", "#E5A646", "#94C24E", "#E160A4", "#F2CB3D"],
  // Sequential speed ramp
  seqSpeedPalette: ["#D6453B", "#E8843F", "#F2E18A", "#A8D26B", "#3FA34D"],
  // Single-series primary + area
  primary: "#1F3F8F",
  primaryArea: "rgba(31,63,143,0.15)",
  targetLine: "stroke-amber-400 [stroke-dasharray:4_3]",
  targetLabel: "font-mono text-[10.5px] uppercase tracking-wider text-amber-700",
};

const avlGraph = { ...graph };

// ─────────────────────────────────────────────────────────────────────────────
// map — MapLibre wrapper
// ─────────────────────────────────────────────────────────────────────────────
const map = {
  container: "relative rounded-[8px] border border-zinc-950/10 overflow-hidden bg-[#E8E4D2] tny-map",
  controls: "absolute top-2 right-2 flex flex-col gap-1 rounded-[6px] bg-white shadow-md p-1",
  legend: "absolute bottom-2 left-2 rounded-[6px] bg-white shadow-md p-3 border border-zinc-950/10",
  legendTitle: "font-display uppercase text-[11px] tracking-wide text-slate-600 mb-1.5",
  popover: "rounded-[6px] bg-white shadow-lg border border-zinc-950/10 p-3 text-[12.5px]",
};

// ─────────────────────────────────────────────────────────────────────────────
// attribution / filters — data-section chrome
// ─────────────────────────────────────────────────────────────────────────────
const attribution = {
  wrapper: "w-full px-3 py-1.5 flex gap-2 text-[11px] text-slate-500 font-mono uppercase tracking-wide border-t border-zinc-950/05 bg-slate-50/40",
  label: "",
  link: "text-[#1F3F8F] hover:text-[#16307A]",
};

const filters = {
  filterLabel: "font-display uppercase text-[11px] tracking-wide text-slate-500 mb-1",
  loadingText: "text-[12px] text-slate-400",
  filterSettingsWrapperInline: "w-2/3",
  filterSettingsWrapperStacked: "w-full",
  labelWrapperInline: "w-1/3 text-[12px]",
  labelWrapperStacked: "w-full text-[12px]",
  input: "w-full max-h-[150px] flex text-[12px] overflow-auto scrollbar-sm border border-zinc-950/10 rounded-[6px] bg-white p-2",
  settingPillsWrapper: "flex flex-row flex-wrap gap-1",
  settingPill: "px-1.5 py-0.5 bg-[#EAAD43]/15 text-amber-800 hover:bg-[#EAAD43]/25 rounded-[4px] text-[11.5px]",
  settingLabel: "text-slate-700 font-medium",
  filtersWrapper: "w-full p-3 flex flex-col gap-2 rounded-[6px] bg-slate-50/60",
};

// ─────────────────────────────────────────────────────────────────────────────
// pages.* — pattern-level chrome for the page pattern
// ─────────────────────────────────────────────────────────────────────────────
const pages = {
  // Section chrome (drag handles, titles, edit-mode toolbar)
  section: {
    options: { activeStyle: 0 },
    styles: [{
      name: "default",
      wrapper: "",
      wrapperHidden: "hidden",
      topBar: "flex w-full",
      topBarSpacer: "flex-1",
      menuPosition: "absolute top-2 right-2 items-center",
      editIcon: "hover:text-[#1F3F8F] size-5",
      contentWrapper: "h-full",
    }],
  },

  // Section group (grid) — 6-column layout per row
  sectionArray: {
    options: { activeStyle: 0 },
    styles: [{
      name: "default",
      wrapper: "relative",
      container: "w-full grid grid-cols-12 gap-6",
      gridSize: 12,
      sectionPadding: "",
      sizes: {
        "1":   { className: "col-span-12",                 iconSize: 100 },
        "1/2": { className: "col-span-12 md:col-span-6",   iconSize: 50 },
        "1/3": { className: "col-span-12 md:col-span-4",   iconSize: 33 },
        "2/3": { className: "col-span-12 md:col-span-8",   iconSize: 66 },
        "1/4": { className: "col-span-12 md:col-span-3",   iconSize: 25 },
        "3/4": { className: "col-span-12 md:col-span-9",   iconSize: 75 },
      },
      border: {
        none:       "",
        full:       "rounded-[8px] border border-zinc-950/10 bg-white shadow-sm",
        openLeft:   "rounded-r-[8px] border border-zinc-950/10 border-l-transparent bg-white shadow-sm",
        openRight:  "rounded-l-[8px] border border-zinc-950/10 border-r-transparent bg-white shadow-sm",
        openTop:    "rounded-b-[8px] border border-zinc-950/10 border-t-transparent bg-white shadow-sm",
        openBottom: "rounded-t-[8px] border border-zinc-950/10 border-b-transparent bg-white shadow-sm",
      },
    }],
  },

  // Section-groups pane (admin edit mode)
  sectionGroupsPane: {
    wrapper: "w-72 bg-white border-l border-zinc-950/10 p-4 overflow-y-auto",
    title: "font-display uppercase text-[12.5px] tracking-wide text-slate-700 mb-3",
    groupRow: "flex items-center gap-2 px-2 py-1.5 rounded-[4px] hover:bg-slate-50 cursor-pointer text-[13px] text-slate-700",
    groupRowActive: "flex items-center gap-2 px-2 py-1.5 rounded-[4px] bg-[#1F3F8F]/10 text-[#0F2D4D] cursor-pointer text-[13px] font-medium",
  },

  // Search button (in the side nav)
  searchButton: {
    options: { activeStyle: 0 },
    styles: [{
      name: "default",
      button: "w-full h-9 px-3 rounded-full bg-[#1a2029] border border-[#2a3545] hover:border-[#3a4555] flex items-center gap-2 text-slate-400 hover:text-slate-300 cursor-pointer",
      buttonText: "font-proxima text-[13px] flex-1 text-left",
      iconWrapper: "size-4",
      icon: "Search",
    }],
  },

  // Search pallet (the Cmd-K modal)
  searchPallet: {
    options: { activeStyle: 0 },
    styles: [{
      name: "default",
      backdrop: "fixed inset-0 bg-black/60",
      dialogContainer: "fixed inset-0 z-50 w-screen overflow-y-auto p-6 sm:p-20 flex items-start justify-center",
      dialogPanel: "relative w-full max-w-2xl flex flex-col gap-2 rounded-[12px] bg-[#1a2029] border border-[#3a4555] p-4 shadow-2xl",
      inputWrapper: "flex items-center gap-2 px-4 h-12 bg-[#12181F] rounded-[8px] border border-[#2a3545]",
      input: "flex-1 bg-transparent text-white text-[14px] focus:outline-none placeholder:text-slate-500",
      searchIcon: "Search",
      searchIconClass: "text-slate-400 size-5",
      resultsWrapper: "bg-[#12181F] rounded-[8px] divide-y divide-[#2a3545] max-h-[400px] overflow-y-auto",
      pageResultWrapper: "flex items-center gap-2 px-4 py-3 hover:bg-[#1e2530] cursor-pointer",
      pageTitle: "font-display uppercase text-[14px] text-slate-200",
      sectionTitle: "font-proxima text-[13px] text-slate-400",
    }],
  },

  // Complex filters editor (filter tree inside data sections)
  complexFilters: {
    wrapper: "rounded-[8px] border border-zinc-950/10 bg-slate-50/60 p-3",
    headerRow: "flex items-center gap-2 mb-2",
    headerLabel: "font-display uppercase text-[11px] tracking-wide text-slate-600",
    addButton: "ml-auto text-[12px] text-[#1F3F8F] hover:text-[#16307A] cursor-pointer",
    filterRow: "flex items-center gap-2 px-2 py-1.5 bg-white rounded-[4px] border border-zinc-950/05 text-[13px] text-slate-700",
    operator: "font-mono text-[11px] uppercase tracking-wide text-slate-500 px-2",
  },

  // Page-tree / TOC editor
  pageTree: {
    wrapper: "flex flex-col text-[13px] font-proxima",
    item: "flex items-center gap-2 px-2 py-1 hover:bg-slate-50 cursor-pointer text-slate-700",
    itemActive: "flex items-center gap-2 px-2 py-1 bg-[#1F3F8F]/10 text-[#0F2D4D] font-medium cursor-pointer",
    handle: "text-slate-300 hover:text-slate-500 cursor-grab",
  },

  // User menu in the bottom of the side nav
  userMenu: {
    options: { activeStyle: 0 },
    styles: [{
      name: "default",
      userMenuContainer: "flex items-center gap-3 px-4 py-2",
      avatar: "w-8 h-8 rounded-full bg-gradient-to-br from-[#37576B] to-[#1f3450] flex items-center justify-center text-white text-[11px] font-medium ring-1 ring-[#FACC15]/20",
      avatarIcon: "User",
      infoWrapper: "flex-1 min-w-0",
      emailText: "font-mono text-slate-400 text-[10px] uppercase tracking-[0.18em] truncate",
      groupText: "font-display uppercase text-white text-[12px] tracking-wide truncate",
      loginWrapper: "flex items-center gap-3 px-4 py-2 hover:bg-[#1e2530] cursor-pointer",
      loginIcon: "size-4 text-slate-400",
      loginText: "font-display uppercase text-white text-[12px] tracking-wide",
    }],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// datasets.* — pattern-level chrome for the dataset pattern
// ─────────────────────────────────────────────────────────────────────────────
const datasets = {
  breadcrumbs: {
    nav: "border-b border-zinc-950/10 flex h-10 bg-white",
    ol: "w-full px-8 flex items-center space-x-3",
    li: "flex items-center",
    link: "font-mono text-[11px] uppercase tracking-[0.16em] text-slate-500 hover:text-[#0F1722]",
    homeLink: "text-slate-400 hover:text-[#1F3F8F]",
    separator: "size-4 text-slate-300 mx-1",
  },
  datasetsList: {
    pageWrapper: "mx-auto max-w-[1280px] w-full px-8 py-8",
    categoryHeader: "font-display uppercase text-[14px] tracking-wide text-slate-700 mb-3",
    cardGrid: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4",
    datasetCard: "rounded-[8px] border border-zinc-950/10 bg-white shadow-sm p-4 hover:border-[#37576B] transition-colors cursor-pointer",
    datasetTitle: "font-display uppercase text-[14px] tracking-wide text-[#0F1722]",
    datasetMeta: "font-mono text-[11px] uppercase tracking-wide text-slate-500 mt-1",
    datasetDesc: "font-proxima text-[13px] text-slate-600 mt-2 leading-relaxed",
  },
  metadataComp: {
    wrapper: "rounded-[8px] border border-zinc-950/10 bg-white p-6 shadow-sm",
    fieldRow: "grid grid-cols-[200px_1fr] gap-6 py-3 border-b border-zinc-950/05",
    fieldLabel: "font-display uppercase text-[11px] tracking-wide text-slate-500",
    fieldValue: "font-proxima text-[13.5px] text-slate-700",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// auth.* — pattern-level chrome for the auth pattern
// ─────────────────────────────────────────────────────────────────────────────
const auth = {
  login: {
    wrapper: "rounded-[8px] border border-zinc-950/10 bg-white shadow-sm p-8 w-full max-w-md",
    title: "font-display uppercase text-[20px] tracking-tight text-[#0F1722] mb-6",
    fieldStack: "flex flex-col gap-4 mb-5",
    submitButton: "w-full",
    divider: "flex items-center gap-3 my-5 text-[11px] font-mono uppercase tracking-[0.18em] text-slate-400 before:flex-1 before:h-px before:bg-zinc-950/10 after:flex-1 after:h-px after:bg-zinc-950/10",
    ssoButton: "w-full h-11 inline-flex items-center justify-center gap-2 rounded-[6px] border border-zinc-950/15 bg-white hover:bg-slate-50 font-proxima text-[13.5px] text-slate-800",
  },
  signup: {
    wrapper: "rounded-[8px] border border-zinc-950/10 bg-white shadow-sm p-8 w-full max-w-md",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// icon — the icon-rendering primitive
// ─────────────────────────────────────────────────────────────────────────────
const iconTheme = {
  iconWrapper: "",
  icon: "size-5",
};

// ─────────────────────────────────────────────────────────────────────────────
// THE THEME OVERLAY
// ─────────────────────────────────────────────────────────────────────────────
const transportnyTheme = {
  // Foundation
  textSettings,
  Icons: icons,

  // Composition
  layout,
  layoutGroup,

  // Navigation
  topnav,
  sidenav,
  navigableMenu,
  logo,

  // Interaction
  button,
  input,
  multiselect,
  tabs,
  switch: switchTheme,
  field,
  label,

  // Overlays
  dialog,
  modal,

  // Containers / atoms
  dataCard,
  card,
  pill,
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
