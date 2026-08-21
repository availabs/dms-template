import "./tokens.css"
import icons from "./icons"
import { NavLeftStyleWidget, NavRightStyleWidget, SideNavHeading, SideNavSiteLink } from "./widgets"
import ThemeModeToggle from "./ThemeModeToggle"
import portraitBanner from "./columnTypes/portraitBanner.config"
import { portraitBannerTheme } from "./columnTypes/portraitBanner.theme"
import streamPlayer from "./columnTypes/streamPlayer.config"
import { streamPlayerTheme } from "./columnTypes/streamPlayer.theme"
import nowIndicator from "./columnTypes/nowIndicator.config"
import { nowIndicatorTheme } from "./columnTypes/nowIndicator.theme"
import filterPill from "./columnTypes/filterPill.config"
import { filterPillTheme } from "./columnTypes/filterPill.theme"
import provenanceBadge from "./columnTypes/provenanceBadge.config"
import { provenanceBadgeTheme } from "./columnTypes/provenanceBadge.theme"
import rowAction from "./columnTypes/rowAction.config"
import { rowActionTheme } from "./columnTypes/rowAction.theme"
import scheduleGrid from "./ScheduleGrid.config"
import { scheduleGridTheme } from "./ScheduleGrid.theme"
import { wcdbSectionTheme } from "./wcdb_section.theme"

// ── The brand's section grid ────────────────────────────────────────────────
// `design-system/grid.html` specifies twelve columns for WCDB; the DMS default
// is six, keyed by FRACTION ("1/3", "1/2", …), so a numeric `size` matches
// nothing and the section silently takes a full row. Shared by every named
// sectionArray style below (they differ only in their width cap), and written
// out literally because Tailwind only emits classes it can see as literal
// strings — a template-built `md:col-span-${n}` yields class names that exist
// in the DOM and nowhere in the stylesheet.
const GRID_12 = {
  _replace: ["sizes"],
  container: "w-full grid grid-cols-12 gap-0",
  gridSize: 12,
  defaultSize: "12",
  sectionPadding: "p-0",
  defaultPaddingStep: "0",
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
  // The compound-card controls in brand tokens. The shipped defaults are a
  // light-blue hairline (#E0EBF0) and `bg-white`, both invisible on this
  // surface — and these are the keys a fused card composes itself from.
  borderSides: {
    top: "border-t border-[var(--line-2)]",
    right: "border-r border-[var(--line-2)]",
    bottom: "border-b border-[var(--line-2)]",
    left: "border-l border-[var(--line-2)]",
  },
  radiusCorners: {
    tl: "rounded-tl-[18px]", tr: "rounded-tr-[18px]",
    bl: "rounded-bl-[18px]", br: "rounded-br-[18px]",
  },
  border: {
    none: "",
    full: "border border-[var(--line-2)] rounded-[18px]",
    openLeft: "border border-[var(--line-2)] border-l-transparent rounded-r-[18px]",
    openRight: "border border-[var(--line-2)] border-r-transparent rounded-l-[18px]",
    openTop: "border border-[var(--line-2)] border-t-transparent rounded-b-[18px]",
    openBottom: "border border-[var(--line-2)] border-b-transparent rounded-t-[18px]",
    borderX: "border border-[var(--line-2)] border-y-transparent",
  },
  backgrounds: {
    none: "", white: "bg-[var(--card-bg)]", card: "bg-[var(--card-bg)]", tint: "bg-[var(--bg-2)]",
    // The design's `.wcdb-card-inv` — a card that FLIPS the mode (light block on
    // the dark site, dark block on the light one). The footer is the one place
    // the brand uses it, and it is what makes the foot of the page read as a
    // separate object rather than more page.
    // `wcdb-inv` is a marker class, not decoration: an inverted block flips the
    // mode, so anything inside it that reaches for a page-level colour comes
    // out invisible. tokens.css uses the marker to re-point those — the
    // lexical `<hr>` was drawing its rule in the page's line colour, which on
    // this surface is the same near-white as the background.
    inverted: "wcdb-inv bg-[var(--inv-bg)] text-[color:var(--inv-ink)]",
  },
  borderColors: ["var(--line-1)", "var(--line-2)", "var(--line-3)"],
}

const theme = {
  layout: {
    styles: [
      {
        // "default" — the public cutaway: a two-column grid whose left column is
        // the sticky header panel. The TopNav notch is the only chrome.
        name: "default",
        outerWrapper: "bg-[var(--page-bg)] text-[color:var(--ink-1)] font-[family-name:var(--font-sans)]",
        wrapper: "relative isolate flex min-h-svh w-full max-lg:flex-col",
        wrapper2: "flex-1 flex items-start flex-col items-stretch max-w-full min-h-screen",
        wrapper3: "flex flex-1 items-start",
        childWrapper: "flex-1 flex flex-col md:grid md:grid-cols-2",
      },
      {
        // "app" — the brand's SECOND Layout style, for authoring/admin surfaces:
        // a persistent SideNav rail and a single dense content column instead of
        // the public cutaway (design skill §3.3). Selected per-pattern via the
        // pattern row's `theme.layout.options.activeStyle`, so the public pattern
        // keeps style 0 — admin and public never share a layout config.
        //
        // `min-w-0` on every link in the chain is load-bearing, not defensive:
        // flex/grid items default to `min-width: auto`, so one horizontally
        // scrolling child (the schedule grid, a wide Card) sets a min-content
        // width that propagates up and makes the whole page scroll sideways.
        // That exact bug cost a debugging pass on the schedule mockup.
        name: "app",
        outerWrapper: "bg-[var(--page-bg)] text-[color:var(--ink-1)] font-[family-name:var(--font-sans)]",
        wrapper: "relative isolate flex min-h-svh w-full",
        wrapper2: "flex-1 flex items-start flex-col items-stretch max-w-full min-h-screen min-w-0",
        wrapper3: "flex flex-1 items-start w-full min-w-0",
        childWrapper: "flex-1 flex flex-col min-w-0",
      },
    ],
    options: {
      topNav: {
        nav: "main",
        size: "compact",
        leftMenu: [
          { type: "NavLeftStyleWidget" },
          { type: "Logo" },
        ],
        rightMenu: [
          { type: "ThemeModeToggle" },
          { type: "UserMenu" },
          { type: "NavRightStyleWidget" },
        ],
        activeStyle: null,
      },
      sideNav: {
        nav: "main",
        size: "none",
        topMenu: [],
        bottomMenu: [],
        activeStyle: null,
      },
      activeStyle: 0,
    },
  },
  layoutGroup: {
    options: {
      activeStyle: 0,
    },
    styles: [
      {
        // "content" — right column, scrolls. Sits on the page background.
        name: "content",
        wrapper1: "w-full flex-1 flex flex-row p-2",
        wrapper2: "flex flex-1 w-full flex-col relative text-[color:var(--ink-1)] text-md font-light leading-7 p-4 min-h-[200px]",
        wrapper3: "",
      },
      {
        // "header" — left column, sticky cutaway panel at md+.
        // Below md the grid collapses to a single column (childWrapper drops
        // md:grid) and the header should scroll normally with the page.
        name: "header",
        wrapper1: "w-full p-2 md:sticky md:top-0 md:h-screen",
        // `--bg-2`, NOT `--card-bg`. This band is full viewport height and its
        // two sections (the photo, then the now-playing block) are content
        // sized, so whatever height they do not consume shows this colour. The
        // design has the photo absorbing that slack via `flex-1`, which is not
        // reproducible here — `height: 'fill'` never reaches a section, and the
        // wrappers between this band and its sections are content-sized boxes,
        // so there is no unbroken chain to fill (see the notes on the on-air
        // card in build-wcdb-public-pages.md Phase 6).
        //
        // Painting the band in the BOTTOM block's own tone makes the leftover
        // indistinguishable from that block simply being taller, which is what
        // the design looks like anyway. It is also the only place this colour
        // is ever visible: the photo covers the top, the now-playing section
        // paints its own `--bg-2` over the middle.
        wrapper2: "overflow-hidden rounded-[18px] bg-[var(--bg-2)] text-[color:var(--ink-1)] md:h-full",
        wrapper3: "md:h-full",
      },
      {
        // "admin" — the only band an admin page uses. Same idea as `content`,
        // but with the SideNav's two consequences: the content HUGS the rail
        // (`mr-auto`, never `mx-auto` — centring between the rail and the right
        // edge drifts away from the rail on a wide monitor, design skill §7.3.1),
        // and a tighter top gutter, because an admin page is somewhere you are
        // already working rather than somewhere you arrive.
        // NB: no `min-h-[200px]` — the public `content` style carries one, and
        // copying it here reserved 200px per BAND. An admin page is a stack of
        // small bands (header, control, table, modals), so that read as a page
        // full of holes. Bands here are exactly as tall as their content.
        name: "admin",
        wrapper1: "w-full flex-1 flex flex-row px-2 py-0 min-w-0",
        wrapper2: "flex flex-1 w-full flex-col relative text-[color:var(--ink-1)] px-4 pt-3 min-w-0 mr-auto",
        wrapper3: "",
      },
    ],
  },
  // SideNav — the admin rail. Keys are the ones SideNav.jsx ACTUALLY reads
  // (ui/components/SideNav.theme.jsx); a plausible-looking invented key
  // (`wrapper`, `inner`, `menu`) silently no-ops, which is the trap
  // translating-design-system-to-dms-theme.md §3.1 documents. The admin mockups
  // were drawn on these names, so this block is transcription, not redesign.
  //
  // layoutContainer1 reserves the rail's width in the Layout's flex row (it is a
  // sibling of the content column, so its `lg:pl-48` IS the space the fixed
  // rail sits in); layoutContainer2 is the rail itself.
  sidenav: {
    options: { activeStyle: 0 },
    styles: [
      {
        name: "wcdb",
        // 192px, matching the design (narrowed from 256 on 2026-08-14). An item
        // is a short label plus a 17px glyph; the width went to the content
        // column, which is what an admin page actually needs.
        layoutContainer1: "lg:pl-48 max-lg:hidden",
        layoutContainer2: "fixed inset-y-0 left-0 w-48 max-lg:hidden z-40",
        sidenavWrapper: "flex flex-col w-48 h-full bg-[var(--bg-0)] border-r border-[var(--line-1)]",
        // NB: there is no `logoWrapper` here even though SideNav.theme.jsx lists
        // one — `DesktopSidebar` renders `topMenu` straight into sidenavWrapper
        // and never reads that key. The rail's logo box is the `Logo` widget's
        // own `theme.logo.imgWrapper`/`imgClass`.
        itemsWrapper: "flex-1 overflow-y-auto px-2 py-5",
        menuItemWrapper: "flex flex-1 flex-col gap-0.5",
        menuItemWrapper_level_1: "",
        menuItemWrapper_level_2: "ml-4 border-l border-[var(--line-1)]",
        menuItemWrapper_level_3: "ml-4 border-l border-[var(--line-1)]",
        navitemSide:
          "group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] " +
          "font-[family-name:var(--font-sans)] text-[14px] font-medium text-[color:var(--ink-3)] " +
          "hover:bg-[var(--accent-soft)] hover:text-[color:var(--ink-1)] transition-colors cursor-pointer",
        navitemSideActive:
          "group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] " +
          "font-[family-name:var(--font-sans)] text-[14px] font-medium text-[color:var(--ink-1)] " +
          "bg-[var(--accent-soft)] cursor-pointer",
        menuIconSide: "size-[17px] text-[color:var(--ink-4)] group-hover:text-[color:var(--ink-2)] transition-colors",
        menuIconSideActive: "size-[17px] text-[color:var(--ink-1)]",
        navItemContent: "flex items-center gap-3 flex-1",
        // A nav item with no target renders as plain styled text — the rail's
        // group labels ("Station admin", "Public site").
        navLabel: "px-2.5 py-1.5 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.14em] uppercase text-[color:var(--ink-4)]",
        sectionHeading: "px-2.5 py-1.5 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.14em] uppercase text-[color:var(--ink-4)]",
        sectionDivider: "my-5 border-t border-[var(--line-1)]",
        indicatorIcon: "ChevronRight",
        indicatorIconOpen: "ChevronDown",
        indicatorIconWrapper: "size-4 text-[color:var(--ink-4)] transition-transform duration-200",
        subMenuWrapper_1: "mt-1 space-y-0.5",
        subMenuWrapper_2: "mt-1 space-y-0.5",
        subMenuWrapper_3: "mt-1 space-y-0.5",
        subMenuParentWrapper: "flex flex-col",
        subMenuTitle: "hidden",
        // The rail's foot. The mockup draws the site link at the end of the item
        // list and the user row below a rule; widgets can only mount above
        // (`topMenu`) or below (`bottomMenu`) the item list, so both live here in
        // a column — the site link keeps its own rule and heading, the user row
        // and mode toggle stack under it. (The mockup has those two side by side;
        // making that exact would mean a wrapper widget that re-implements
        // UserMenu's auth states, which is not worth one row of alignment.)
        bottomMenuWrapper: "mt-auto border-t border-[var(--line-1)] px-2 py-2.5 flex flex-col gap-0.5",
        siteLinkWrapper: "pb-1",
        // Below lg the rail collapses to a bar. These are the ONLY place
        // SideNav's topnav* keys are used.
        topnavWrapper: "w-full h-14 flex items-center px-4",
        topnavContent: "flex items-center w-full h-full justify-between",
        topnavMenu: "hidden lg:flex items-center flex-1 h-full overflow-visible",
        topmenuRightNavContainer: "flex items-center gap-2",
        topnavMobileContainer: "bg-[var(--bg-0)] border-b border-[var(--line-1)]",
        menuOpenIcon: "Menu",
        menuCloseIcon: "XMark",
      },
    ],
  },
  topnav: {
    options: {
      activeStyle: 0,
      maxDepth: 2,
    },
    styles: [
      {
        name: "wcdb",
        layoutContainer1: "fixed top-0 z-50",
        layoutContainer2: "w-full",
        topnavWrapper: "w-full h-14 flex items-center",
        topnavContent: "flex items-center w-full h-full",
        leftMenuContainer: "flex items-center bg-[var(--page-bg)] h-14",
        centerMenuContainer: "hidden lg:flex items-center flex-1 h-full overflow-visible gap-1 px-2 bg-[var(--page-bg)]",
        rightMenuContainer: "hidden md:flex h-full items-center pr-4 gap-2 bg-[var(--page-bg)] lg:rounded-br-[28px]",
        mobileNavContainer: "px-4 py-2 bg-[var(--page-bg)]",
        mobileButton: "lg:hidden rounded-br-[28px] py-4 pr-4 pl-0 bg-[var(--page-bg)]  inline-flex items-center justify-center text-[color:var(--ink-3)] hover:text-[color:var(--ink-1)]  transition-colors",
        menuOpenIcon: "Menu",
        menuCloseIcon: "XMark",
        navitemWrapper: "relative",
        navitemWrapper_level_2: "relative",
        navitemWrapper_level_3: "",
        navitem: `wcdb-navitem group px-1 py-2 text-[14px] font-medium text-[color:var(--ink-1)] transition-colors duration-300 ease-in-out cursor-pointer flex items-center gap-1.5`,
        navitemActive: `wcdb-navitem px-1 py-2 text-[14px] font-medium text-[color:var(--ink-1)] transition-colors duration-300 ease-in-out cursor-pointer flex items-center gap-1.5`,
        navIcon: "size-4 text-[color:var(--ink-3)]",
        navIconActive: "size-4 text-[color:var(--ink-1)]",
        navitemContent: "",
        navitemName: "",
        navitemDescription: "hidden",
        navitemDescription_level_2: "text-xs text-[color:var(--ink-3)] mt-0.5",
        navitemDescription_level_3: "text-xs text-[color:var(--ink-3)] mt-0.5",
        indicatorIconWrapper: "size-4 text-[color:var(--ink-3)]",
        indicatorIcon: "ChevronDown",
        indicatorIconOpen: "ChevronDown",
        subMenuWrapper: "absolute top-full left-0 mt-2 z-50",
        subMenuWrapper2: "bg-[var(--card-bg)] text-[color:var(--ink-1)] rounded-xl shadow-lg ring-1 ring-[var(--line-2)] py-1 min-w-[200px]",
        subMenuWrapper_level_2: "absolute left-full top-0 ml-2 z-50",
        subMenuWrapper2_level_2: "bg-[var(--card-bg)] text-[color:var(--ink-1)] rounded-xl shadow-lg ring-1 ring-[var(--line-2)] py-1 min-w-[200px]",
        subMenuItemsWrapper: "flex flex-col",
        subMenuItemsWrapperParent: "flex flex-col",
        subMenuParentWrapper: "hidden",
        subMenuParentContent: "px-3 py-2 border-b border-[var(--line-1)] mb-1",
        subMenuParentName: "text-xs font-semibold text-[color:var(--ink-3)] uppercase tracking-wide",
        subMenuParentDesc: "text-xs text-[color:var(--ink-4)] mt-0.5",
        subMenuParentLink: "text-xs text-[color:var(--ink-1)] hover:underline mt-1 inline-block",
      },
    ],
  },
  logo: {
    logoWrapper: "items-center",
    logoAltImg: "",
    imgWrapper: "pt-1 pl-4",
    img: "/themes/wcdb/logo_white.svg",
    imgClass: "h-9 wcdb-logo-img",
    titleWrapper: "",
    title: "",
    linkPath: "/",
  },
  // Hanssen typography for the whole theme.
  // Anything that reads from textSettings (Lexical headings, Card text*, Table
  // text*, etc.) picks these up. Components that hardcode classes locally are
  // not affected — those need explicit overrides on their own theme blocks.
  textSettings: {
    // slashKeys surfaces a token in the editor's `/Style:` menu, so an author
    // can reach the admin title token without knowing the theme.
    options: { activeStyle: 0, slashKeys: ["titleAdmin", "label", "caption", "body", "bodySmall", "metaLink", "colHead", "rowTitle", "rowMeta"] },
    styles: [
      {
        name: "default",

        // Size + weight scale, retuned for the WCDB type ramp.
        // Sans by default; mono/display variants live below in semantic aliases.
        textXS: "font-[family-name:var(--font-sans)] text-[length:var(--tx-xs)] font-medium text-[color:var(--ink-2)]",
        textXSReg: "font-[family-name:var(--font-sans)] text-[length:var(--tx-xs)] font-normal text-[color:var(--ink-2)]",
        textXSBold: "font-[family-name:var(--font-sans)] text-[length:var(--tx-xs)] font-bold text-[color:var(--ink-1)]",
        textSM: "font-[family-name:var(--font-sans)] text-[length:var(--tx-sm)] font-medium text-[color:var(--ink-2)]",
        textSMReg: "font-[family-name:var(--font-sans)] text-[length:var(--tx-sm)] font-normal text-[color:var(--ink-2)]",
        textSMBold: "font-[family-name:var(--font-sans)] text-[length:var(--tx-sm)] font-bold text-[color:var(--ink-1)]",
        textSMSemiBold: "font-[family-name:var(--font-sans)] text-[length:var(--tx-sm)] font-semibold text-[color:var(--ink-1)]",
        textBase: "font-[family-name:var(--font-sans)] text-[length:var(--tx-md)] font-normal text-[color:var(--ink-1)]",
        textBaseMedium: "font-[family-name:var(--font-sans)] text-[length:var(--tx-md)] font-medium text-[color:var(--ink-1)]",
        textBaseBold: "font-[family-name:var(--font-sans)] text-[length:var(--tx-md)] font-bold text-[color:var(--ink-1)]",
        textMD: "font-[family-name:var(--font-sans)] text-[length:var(--tx-md)] font-medium text-[color:var(--ink-1)]",
        textMDReg: "font-[family-name:var(--font-sans)] text-[length:var(--tx-md)] font-normal text-[color:var(--ink-1)]",
        textMDSemiBold: "font-[family-name:var(--font-sans)] text-[length:var(--tx-md)] font-semibold text-[color:var(--ink-1)]",
        textMDBold: "font-[family-name:var(--font-sans)] text-[length:var(--tx-md)] font-bold text-[color:var(--ink-1)]",
        textLG: "font-[family-name:var(--font-sans)] text-[length:var(--tx-lg)] font-medium text-[color:var(--ink-1)]",
        textLGReg: "font-[family-name:var(--font-sans)] text-[length:var(--tx-lg)] font-normal text-[color:var(--ink-1)]",
        textLGBold: "font-[family-name:var(--font-sans)] text-[length:var(--tx-lg)] font-bold text-[color:var(--ink-1)]",

        // From XL up, headlines flip to display-italic — the WCDB signature.
        textXL: "font-[family-name:var(--font-display)] italic text-[length:var(--tx-xl)] leading-[1.1] tracking-[-0.02em] text-[color:var(--ink-1)]",
        textXLReg: "font-[family-name:var(--font-display)] italic text-[length:var(--tx-xl)] font-normal leading-[1.1] tracking-[-0.02em] text-[color:var(--ink-1)]",
        textXLSemiBold: "font-[family-name:var(--font-display)] italic text-[length:var(--tx-xl)] font-semibold leading-[1.1] tracking-[-0.02em] text-[color:var(--ink-1)]",
        textXLBold: "font-[family-name:var(--font-display)] italic text-[length:var(--tx-xl)] font-bold leading-[1.1] tracking-[-0.02em] text-[color:var(--ink-1)]",
        text2XL: "font-[family-name:var(--font-display)] italic text-[length:var(--tx-2xl)] leading-[1.1] tracking-[-0.03em] text-[color:var(--ink-1)]",
        text2XLReg: "font-[family-name:var(--font-display)] italic text-[length:var(--tx-2xl)] font-normal leading-[1.1] tracking-[-0.03em] text-[color:var(--ink-1)]",
        text2XLSemiBold: "font-[family-name:var(--font-display)] italic text-[length:var(--tx-2xl)] font-semibold leading-[1.1] tracking-[-0.03em] text-[color:var(--ink-1)]",
        text2XLBold: "font-[family-name:var(--font-display)] italic text-[length:var(--tx-2xl)] font-bold leading-[1.1] tracking-[-0.03em] text-[color:var(--ink-1)]",
        text3XL: "font-[family-name:var(--font-display)] italic text-[length:var(--tx-3xl)] leading-[1.05] tracking-[-0.03em] text-[color:var(--ink-1)]",
        text3XLReg: "font-[family-name:var(--font-display)] italic text-[length:var(--tx-3xl)] font-normal leading-[1.05] tracking-[-0.03em] text-[color:var(--ink-1)]",
        text3XLSemiBold: "font-[family-name:var(--font-display)] italic text-[length:var(--tx-3xl)] font-semibold leading-[1.05] tracking-[-0.03em] text-[color:var(--ink-1)]",
        text3XLBold: "font-[family-name:var(--font-display)] italic text-[length:var(--tx-3xl)] font-bold leading-[1.05] tracking-[-0.03em] text-[color:var(--ink-1)]",
        text4XL: "font-[family-name:var(--font-display)] italic text-[length:var(--tx-4xl)] leading-[1.0] tracking-[-0.03em] text-[color:var(--ink-1)]",
        text4XLBold: "font-[family-name:var(--font-display)] italic text-[length:var(--tx-4xl)] font-bold leading-[1.0] tracking-[-0.03em] text-[color:var(--ink-1)]",
        text5XL: "font-[family-name:var(--font-display)] italic text-[length:var(--tx-5xl)] leading-[1.0] tracking-[-0.03em] text-[color:var(--ink-1)]",
        text5XLBold: "font-[family-name:var(--font-display)] italic text-[length:var(--tx-5xl)] font-bold leading-[1.0] tracking-[-0.03em] text-[color:var(--ink-1)]",
        text6XL: "font-[family-name:var(--font-display)] italic text-[length:var(--tx-6xl)] leading-[0.98] tracking-[-0.03em] text-[color:var(--ink-1)]",
        text7XL: "font-[family-name:var(--font-display)] italic text-[length:var(--tx-7xl)] leading-[0.95] tracking-[-0.03em] text-[color:var(--ink-1)]",
        text8XL: "font-[family-name:var(--font-display)] italic text-[length:var(--tx-8xl)] leading-[0.95] tracking-[-0.03em] text-[color:var(--ink-1)]",

        // Semantic heading aliases — Lexical's useLexicalTheme overlays these
        // onto its style as heading_h1..h6 when the active lexical style does
        // not define its own.
        // h1 is page-hero scale (fluid clamp 56–88px) — matches the
        // "Stereolab, somewhere in Albany" treatment in the home design.
        // h2..h4 step down through section/card-title sizes.
        h1: "font-[family-name:var(--font-display)] italic text-[length:var(--tx-hero)] leading-[0.95] tracking-[-0.03em] text-[color:var(--ink-1)]",
        h2: "font-[family-name:var(--font-display)] italic text-[length:var(--tx-5xl)] leading-[1.0] tracking-[-0.03em] text-[color:var(--ink-1)]",
        h3: "font-[family-name:var(--font-display)] italic text-[length:var(--tx-3xl)] leading-[1.05] tracking-[-0.03em] text-[color:var(--ink-1)]",
        h4: "font-[family-name:var(--font-display)] italic text-[length:var(--tx-2xl)] leading-[1.1] tracking-[-0.03em] text-[color:var(--ink-1)]",
        // h5/h6 are mono uppercase eyebrows — the analogue of the design's
        // .uppercase-meta utility, used above headings/sections.
        h5: "font-[family-name:var(--font-mono)] uppercase tracking-[0.12em] text-[length:var(--tx-xs)] text-[color:var(--ink-3)]",
        h6: "font-[family-name:var(--font-mono)] uppercase tracking-[0.10em] text-[length:var(--tx-xs)] text-[color:var(--ink-4)]",

        // The admin page title. A purpose-built token because no step of the
        // ramp matches it: the design deliberately drops the admin title to
        // clamp(30px,3.2vw,42px) — between h3 (28) and h2 (48) — since a
        // functional page does not get a hero band, and the top of the viewport
        // is working space. Identical on all five admin pages.
        titleAdmin: "font-[family-name:var(--font-display)] italic text-[clamp(30px,3.2vw,42px)] leading-[1.0] tracking-[-0.03em] text-[color:var(--ink-1)] mb-1",

        // Buttons as TEXT tokens, because a Card cell styles its value through
        // `valueFontStyle` — that is how a static cell becomes the design's
        // primary action pill (`+ Add a song`, `+ Add DJ`, `+ New event`).
        btnPrimary:
          "w-fit! ml-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[color:var(--ink-1)] " +
          "text-[color:var(--page-bg)] font-[family-name:var(--font-sans)] text-[13px] font-medium " +
          "whitespace-nowrap cursor-pointer hover:opacity-90 transition-opacity",
        btnGhost:
          "w-fit! inline-flex items-center gap-2 rounded-full border border-[var(--line-2)] px-4 py-2 " +
          "font-[family-name:var(--font-mono)] text-[10px] tracking-[0.10em] uppercase text-[color:var(--ink-2)] " +
          "cursor-pointer hover:text-[color:var(--ink-1)] hover:border-[var(--line-3)] transition-colors",
        // A link that reads as chrome, not as a control — the design's
        // `PUBLIC SPIN LOG →` / `PUBLIC EVENTS PAGE →`.
        metaLink:
          "w-fit! ml-auto inline-flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-[10px] " +
          "tracking-[0.10em] uppercase text-[color:var(--ink-3)] hover:text-[color:var(--ink-1)] transition-colors",
        // The list's own column-header micro-caps, one step quieter than `label`.
        colHead: "font-[family-name:var(--font-mono)] text-[10px] tracking-[0.12em] uppercase text-[color:var(--ink-4)]",
        // A row's second line: the mono meta under an editorial title.
        rowMeta: "font-[family-name:var(--font-mono)] text-[9px] tracking-[0.08em] uppercase text-[color:var(--ink-3)]",
        // A row's editorial title — display italic at list scale (17px).
        rowTitle: "font-[family-name:var(--font-display)] italic text-[17px] leading-[1.15] tracking-[-0.02em] text-[color:var(--ink-1)]",
        // Mono tabular value (times, ids, counts).
        rowMono: "font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--ink-3)] tabular-nums",

        // ── Card-grid tiles ────────────────────────────────────────────────
        // The public pages' grid designs (the executive board's role tiles, the
        // DJ roster, the blog grid) share one type ramp, transcribed off the
        // mockups. `rowTitle` (17px) is the LIST scale and reads undersized in a
        // tile, which is the C5 finding — `cardTitle` is the tile scale.
        // A group's header line: display italic, one step above the tile title.
        groupTitle: "font-[family-name:var(--font-display)] italic text-[26px] leading-[1.05] tracking-[-0.03em] text-[color:var(--ink-1)]",
        // The count that sits at the right end of a group header (`04 ROLES`).
        groupCount: "w-fit! ml-auto font-[family-name:var(--font-mono)] text-[10px] tracking-[0.12em] uppercase text-[color:var(--ink-4)] tabular-nums",
        // A tile's kicker — the role, the department, the category.
        tileEyebrow: "font-[family-name:var(--font-mono)] text-[10px] tracking-[0.12em] uppercase text-[color:var(--ink-3)]",
        // A tile's headline. 22px display italic — the design's card title.
        cardTitle: "font-[family-name:var(--font-display)] italic text-[22px] leading-[1.15] tracking-[-0.02em] text-[color:var(--ink-1)]",
        // A tile's mono detail line (an address, a handle). `break-all` because
        // the board's obfuscated addresses are long and must not blow the track.
        tileMono: "font-[family-name:var(--font-mono)] text-[11px] tracking-[0.02em] text-[color:var(--ink-2)] break-all",
        // A tile's quietest line — office hours, a joined date.
        tileMeta: "font-[family-name:var(--font-mono)] text-[10px] tracking-[0.10em] uppercase text-[color:var(--ink-4)]",
        // A tile's body copy (a blog excerpt, a bio).
        tileBody: "font-[family-name:var(--font-sans)] text-[13px] font-normal leading-[1.5] tracking-[-0.01em] text-[color:var(--ink-2)]",

        // ── The now-playing block ─────────────────────────────────────────
        // The track is the CONTENT of this block, and with the label row lifted
        // out above it the design sets it at something close to a headline.
        // These are page-ink tokens (unlike the on-air ones) — this block sits
        // on its own surface, not on a photograph, so it follows the mode.
        npTitle: "font-[family-name:var(--font-display)] italic text-[32px] leading-[1.02] tracking-[-0.02em] text-[color:var(--ink-1)] truncate",
        npArtist: "font-[family-name:var(--font-display)] italic text-[19px] leading-[1.2] tracking-[-0.02em] text-[color:var(--ink-2)] truncate",
        npMeta: "font-[family-name:var(--font-mono)] text-[11px] tracking-[0.08em] uppercase text-[color:var(--ink-4)] truncate",
        // `FULL PLAYLIST →` — chrome, not a control. Underlined rather than
        // pilled, per the design.
        npLink:
          "w-fit! ml-auto inline-flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-[10px] " +
          "tracking-[0.10em] uppercase text-[color:var(--ink-2)] hover:text-[color:var(--ink-1)] " +
          "border-b border-[var(--line-2)] hover:border-[var(--line-3)] pb-0.5 transition-colors",

        // A section heading one step above `cardHeading` — the design's 36px
        // for sections that own a whole band (events, the schedule's day list).
        sectionHeading: "font-[family-name:var(--font-display)] italic text-[36px] leading-[1.0] tracking-[-0.03em] text-[color:var(--ink-1)]",
        // The stats strip: a figure at 64px over a mono label.
        statValue: "font-[family-name:var(--font-display)] italic text-[64px] leading-[0.95] tracking-[-0.04em] text-[color:var(--ink-1)] tabular-nums",
        statLabel: "font-[family-name:var(--font-mono)] text-[11px] tracking-[0.10em] uppercase text-[color:var(--ink-3)]",
        // The featured post's read-through link — a sentence-case control, not
        // the mono chrome the section links use.
        featureLink: "w-fit! inline-flex items-center gap-2 font-[family-name:var(--font-sans)] text-[13px] text-[color:var(--ink-1)] border-b border-[var(--line-2)] hover:border-[var(--line-3)] pb-0.5 transition-colors",

        // ── The footer (an INVERTED card) ─────────────────────────────────
        // These deliberately use `--inv-ink*`, not `--ink-*`: the block flips
        // the mode, so the page's own ink would be invisible on it.
        footEyebrow: "font-[family-name:var(--font-mono)] text-[11px] tracking-[0.12em] uppercase text-[color:var(--inv-ink-2)]",
        footHeadline: "font-[family-name:var(--font-display)] italic text-[44px] leading-[1.0] tracking-[-0.03em] text-[color:var(--inv-ink)]",
        footBody: "font-[family-name:var(--font-sans)] text-[15px] leading-[1.5] max-w-[440px] text-[color:var(--inv-ink-2)]",
        // The footer's one mono detail line — the request line under the
        // address. Inverted ink, like everything else on that surface.
        footMeta: "font-[family-name:var(--font-mono)] text-[11px] tracking-[0.10em] uppercase text-[color:var(--inv-ink)]",
        footListHead: "font-[family-name:var(--font-mono)] text-[10px] tracking-[0.12em] uppercase text-[color:var(--inv-ink-2)]",
        footLink: "font-[family-name:var(--font-sans)] text-[13px] text-[color:var(--inv-ink)] hover:underline",
        footColophon: "font-[family-name:var(--font-mono)] text-[10px] tracking-[0.12em] uppercase text-[color:var(--inv-ink-2)]",
        footColophonEnd: "w-fit! ml-auto font-[family-name:var(--font-mono)] text-[10px] tracking-[0.12em] uppercase text-[color:var(--inv-ink-2)]",

        // ── The home page's editorial sections ────────────────────────────
        // The strip's glyph disc — the design's `size-[34px] rounded-full`
        // leading column, so the eye can scan the list by kind without reading
        // a genre label on every row.
        // `w-[34px]!` explicitly, NOT `w-fit! size-[34px]`: `w-fit` beats the
        // size utility's width, which left the disc 16px wide and 34 tall — a
        // rounded slot rather than a circle. THREE `!`s, all for the same
        // reason: Card stacks `theme.value` (`w-full`) and the justify utility
        // on this element alongside the token. The utility carries both a
        // `rounded-md` (which turned the disc into a squircle) and a
        // `justify-items-start` (which resolved `place-items-center` down to
        // `center start`, pinning the glyph to the disc's left edge).
        glyphDisc: "w-[34px]! h-[34px] grid place-items-center justify-items-center! rounded-full! bg-[var(--bg-3)] text-[color:var(--ink-2)]",
        // The strip's right-hand status: `Live`, or `in 1h 13m`.
        stripStatus: "w-fit! ml-auto font-[family-name:var(--font-mono)] text-[10px] tracking-[0.10em] uppercase text-[color:var(--ink-4)] tabular-nums whitespace-nowrap",
        // A carded section's own heading — the design's 28px display italic,
        // one step below the page hero. `h4` was standing in and reads small.
        cardHeading: "font-[family-name:var(--font-display)] italic text-[28px] leading-[1.05] tracking-[-0.03em] text-[color:var(--ink-1)]",
        // The schedule strip: a glyph, a time, and the show over its host.
        stripTime: "font-[family-name:var(--font-mono)] text-[12px] tracking-[0.08em] uppercase text-[color:var(--ink-2)]",
        stripTitle: "font-[family-name:var(--font-display)] italic text-[22px] leading-[1.1] tracking-[-0.03em] text-[color:var(--ink-1)]",
        stripHost: "font-[family-name:var(--font-mono)] text-[11px] tracking-[0.08em] uppercase text-[color:var(--ink-3)]",
        // The featured post — the page's second-largest type after the hero.
        featureTitle: "font-[family-name:var(--font-display)] italic text-[44px] leading-[1.0] tracking-[-0.03em] text-[color:var(--ink-1)]",
        featureBody: "font-[family-name:var(--font-sans)] text-[15px] font-normal leading-[1.5] text-[color:var(--ink-2)] max-w-[460px]",
        // An event tile: the day number is the tile's subject, at 64px.
        eventDay: "font-[family-name:var(--font-display)] italic text-[64px] leading-[0.9] tracking-[-0.04em] text-[color:var(--ink-1)]",
        eventTitle: "font-[family-name:var(--font-display)] italic text-[18px] leading-[1.15] tracking-[-0.02em] text-[color:var(--ink-1)]",
        eventWhere: "font-[family-name:var(--font-sans)] text-[12px] text-[color:var(--ink-3)]",

        // ── The on-air panel ──────────────────────────────────────────────
        // Type set OVER the show photograph, in the rail.
        //
        // These colours are FIXED LIGHT in both modes, and deliberately do not
        // use `--ink-1`. The design says why: "this block is a photograph, and
        // a photo does not become light because the page did" — `--ink-1` in
        // light mode is near-black, which would put black type on a dark
        // picture. Each token also carries its own drop shadow, because the
        // scrim is a gradient and the type has to survive the bright end of it.
        onAirSlot:
          "font-[family-name:var(--font-mono)] text-[13px] tracking-[0.10em] uppercase font-medium " +
          "text-[#f5f5f5] [text-shadow:0_1px_12px_rgba(10,10,10,0.9)]",
        onAirTitle:
          "font-[family-name:var(--font-display)] italic text-[clamp(32px,3.4vw,44px)] leading-[0.98] " +
          "tracking-[-0.03em] text-[#f5f5f5] [text-shadow:0_2px_18px_rgba(10,10,10,0.9)]",
        onAirHost:
          "font-[family-name:var(--font-display)] italic text-[24px] leading-[1.1] tracking-[-0.02em] " +
          "text-[rgba(245,245,245,0.86)] [text-shadow:0_2px_14px_rgba(10,10,10,0.9)]",
        // The genre, as the design's NOTCH CHIP — the brand's cut-corner join,
        // reading as the block below the photo pushing up into it. `--chip` is
        // set to that block's own tone (`--bg-2`), which is what makes the two
        // surfaces read as continuous. The class and its masked pseudo-element
        // live in tokens.css; this token just selects it and colours it.
        //
        // Unlike the other on-air tokens this one does NOT force a light ink:
        // the chip has its own opaque background, so it follows the mode like
        // any other surface, exactly as the design has it.
        // `w-fit!` is load-bearing: Card puts `theme.value` (`w-full`) on the
        // same element as this token, and an explicit width beats
        // `inline-flex`'s shrink-to-fit — without it the chip stretches the
        // whole cell and reads as a band, not a chip. Same trap as `btnPrimary`.
        // `mr-auto` pushes it to the LEFT edge: the cell's `headerValueWrapper`
        // is `flex … justify-center`, so a `w-fit` value centres itself.
        // (`btnPrimary` uses `ml-auto` for the mirror-image reason.)
        onAirGenre: "w-fit! mr-auto wcdb-chip-inline [--chip:var(--bg-2)]",

        body: "font-[family-name:var(--font-sans)] text-[15px] font-normal leading-[1.4] tracking-[-0.01em] text-[color:var(--ink-1)]",
        bodySmall: "font-[family-name:var(--font-sans)] text-[length:var(--tx-sm)] font-normal leading-[1.45] tracking-[-0.01em] text-[color:var(--ink-2)]",
        caption: "font-[family-name:var(--font-mono)] text-[length:var(--tx-xs)] tracking-[0.12em] uppercase text-[color:var(--ink-3)]",
        label: "font-[family-name:var(--font-mono)] text-[length:var(--tx-xs)] tracking-[0.10em] uppercase text-[color:var(--ink-3)]",
      },
    ],
  },
  lexical: {
    options: { activeStyle: 0 },
    styles: [
      {
        // Headings explicitly override the base theme's heading_h*. They mirror
        // textSettings.h1..h6 — kept in sync here because the base lexical
        // style already defines headings, and useLexicalTheme's textSettings
        // overlay only fires when the resolved style has none.
        name: "default",
        heading_h1: "font-[family-name:var(--font-display)] italic text-[length:var(--tx-hero)] leading-[0.95] tracking-[-0.03em] text-[color:var(--ink-1)] scroll-mt-36",
        heading_h2: "font-[family-name:var(--font-display)] italic text-[length:var(--tx-5xl)] leading-[1.0] tracking-[-0.03em] text-[color:var(--ink-1)] scroll-mt-36",
        heading_h3: "font-[family-name:var(--font-display)] italic text-[length:var(--tx-3xl)] leading-[1.05] tracking-[-0.03em] text-[color:var(--ink-1)] scroll-mt-36",
        heading_h4: "font-[family-name:var(--font-display)] italic text-[length:var(--tx-2xl)] leading-[1.1] tracking-[-0.03em] text-[color:var(--ink-1)] scroll-mt-36",
        heading_h5: "font-[family-name:var(--font-mono)] uppercase tracking-[0.12em] text-[length:var(--tx-xs)] text-[color:var(--ink-3)] scroll-mt-36",
        heading_h6: "font-[family-name:var(--font-mono)] uppercase tracking-[0.10em] text-[length:var(--tx-xs)] text-[color:var(--ink-4)] scroll-mt-36",

        editorScroller: "min-h-[150px] border-0 flex relative outline-0 z-0 resize-y",
        viewScroller: "border-0 flex relative outline-0 z-0 resize-none",
        editorContainer: "relative block rounded-[18px] min-h-[50px]",
        // Editor body baseline — Geist 15px / 1.4 / -0.01em.
        editorShell: "font-[family-name:var(--font-sans)] font-[400] text-[15px] leading-[1.4] tracking-[-0.01em] text-[color:var(--ink-1)]",
        card: "overflow-hidden p-[24px] rounded-[18px] bg-[var(--card-bg)]",
        paragraph: "-ml-8 pl-8 relative mb-3 text-[color:var(--ink-2)]",
        contentEditable: "border-none relative [tab-size:1] outline-none outline-0",
        quote: "m-0 mb-2 font-[family-name:var(--font-display)] italic text-[length:var(--tx-3xl)] leading-[1.05] text-[color:var(--ink-1)] border-l-2 border-[var(--line-3)] pl-4 pb-[12px]",

        text_bold: "font-[700]",
        text_code: "bg-[var(--bg-2)] text-[color:var(--ink-1)] px-1 py-0.5 font-[family-name:var(--font-mono)] text-[94%] rounded-[var(--r-sm)]",
        text_italic: "italic",
        text_strikethrough: "line-through",
        text_subscript: "align-sub text-[0.8em]",
        text_superscript: "align-super text-[0.8em]",
        text_underline: "underline",
        text_underlineStrikethrough: "underline line-through",
      },
    ],
  },
  // Lexical BUTTON node styles, resolved by NAME (`ButtonNode.tsx` looks the
  // stored style name up in `theme.button.styles[]`). A lexical button is the
  // only way to get a real anchor out of a lexical section — `styled(...)`
  // produces text, which cannot be clicked.
  //
  // `styles[0]` is left almost empty on purpose: `mergeComponentStyles` deep-
  // merges index 0 with the library default, so the stock button keeps working;
  // named styles after it are taken wholesale.
  button: {
    options: { activeStyle: 0 },
    styles: [
      { name: "default Buttons" },
      {
        // The design's quiet section link — `FULL SCHEDULE →`. Chrome, not a
        // control: mono micro-caps with a hairline underline that only gains
        // contrast on hover. Mirrors the `metaLink` text token, which is what
        // this replaces wherever the link has to actually navigate.
        name: "metaLink",
        button:
          "inline-flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-[11px] " +
          "tracking-[0.10em] uppercase text-[color:var(--ink-3)] hover:text-[color:var(--ink-1)] " +
          "border-b border-transparent hover:border-[var(--line-3)] pb-0.5 transition-colors cursor-pointer",
      },
    ],
  },
  // Card surface treatments — Hanssen card aesthetic.
  //
  // ── v2 layout model (migrated 2026-08-15) ────────────────────────────────
  // WCDB is on `layoutModel: 'v2'`, the predictable box model. Three things
  // change versus the v1 default the theme shipped with, and all three are why
  // the design-system mockups now reproduce faithfully at runtime:
  //
  //  1. Cards-grid rows are content-sized and packed to the TOP. Under v1 the
  //     grid distributed leftover height BETWEEN card rows, so a short list in
  //     a tall section came out with invented gaps that no amount of section
  //     config could remove. A section that genuinely wants the old fill
  //     behaviour opts back in with `cardsVerticalAlign: 'stretch'` — the
  //     `fill`-height sections (wcdb_section.theme.js) are the ones to watch.
  //  2. The ambient cell gutter is the single `cellGutter` number below,
  //     emitted INLINE by Card.jsx, so a section's `cellsPadding`/`cellPadding`
  //     (including an explicit 0) always wins. Under v1 it was `p-2` baked into
  //     `headerValueWrapper`, which an author could not beat from the section.
  //  3. Cells carry no always-on transparent border; edit hover is an
  //     `itemEditOutline`, which costs no layout space. View-mode geometry
  //     loses the constant +2px per cell.
  //
  // The typography question, settled from the code rather than from the skill
  // (which overstates it — corrected there in the same pass):
  //   • `value` IS a real collision — Card.jsx:580 puts `theme.value` and the
  //     column's `valueFontStyle` token on the SAME element, where arbitrary
  //     Tailwind values resolve by stylesheet order, not author intent. WCDB
  //     never set `value`, so it was already clean.
  //   • `header` is NOT — Card.jsx:563-567 puts `theme.header` on a wrapper
  //     div whose child <span> always carries a token (`headerFontStyle`, or
  //     `textXS` by default). The eyebrow spec below is therefore an inherited
  //     FALLBACK, and it is load-bearing: the renderer has no theme-level
  //     default `headerFontStyle`, so without it every untagged column header
  //     would lose the mono voice. Columns that want something else name a
  //     token (`label`, `colHead`, …) and win on the span.
  //   • `subWrapper` is the cards-grid container (Card.jsx:753) — an ANCESTOR
  //     of every cell, so the body baseline here is inheritance, not a
  //     collision. Kept deliberately: custom column types that draw their own
  //     chrome (portrait_banner, stream_player) rely on it for their rhythm.
  dataCard: {
    options: { activeStyle: 0 },
    styles: [
      {
        name: "default",
        layoutModel: "v2",
        // 8 = the `p-2` this replaces, so day-one spacing is unchanged. Tune
        // deliberately from here, not by reintroducing a padding class.
        cellGutter: 8,
        itemEditOutline: "outline outline-[var(--accent)] -outline-offset-1",
        subWrapper: "w-full font-[family-name:var(--font-sans)] text-[15px] leading-[1.4] tracking-[-0.01em] text-[color:var(--ink-1)]",
        subWrapperCompactView: "flex flex-col rounded-[18px] bg-[var(--card-bg)] text-[color:var(--ink-1)]",
        headerValueWrapper: "w-full rounded-[18px] flex items-center justify-center",
        header: "w-full font-[family-name:var(--font-mono)] uppercase tracking-[0.12em] text-[length:var(--tx-xs)] text-[color:var(--ink-3)]",
        description: "w-full font-[family-name:var(--font-sans)] text-[length:var(--tx-xs)] font-light text-[color:var(--ink-3)]",
        // New image-size key alongside the inherited `imgXS`…`img8XL` caps.
        // (see `imgFill` below — kept here so the default style still owns it)
        // `imgFill` is for cells where the *cell* is the source of truth for
        // size (the grid track has an explicit `cellWidth`) — the image
        // should be responsive to that cell and crop to keep aspect instead
        // of rendering at its natural size and overflowing. Author opts in
        // per-cell via `imageSize: 'imgFill'`; the standard `imgSM` etc.
        // keep their `max-w-N max-h-N` cap semantics unchanged for every
        // other card on the site.
        imgFill: "w-full h-full object-cover rounded-md",
        // The on-air panel's photograph — the rail's main subject, not a
        // thumbnail, so it crops to its box rather than sizing to its natural
        // dimensions.
        //
        // The height is VIEWPORT-relative, not parent-relative, and that is
        // deliberate. The design's block is `flex-1` inside a screen-height
        // rail, but `height: 'fill'` on the section cannot deliver that today:
        // measured live, the sentinel never reaches the section (it keeps
        // `flex: 0 1 auto`) and the `.relative` wrapper and sectionArray grid
        // between the band and the section are content-sized boxes, so there is
        // no unbroken height chain to fill. Since the rail IS `md:h-screen`,
        // the height is knowable without that chain — the same trick
        // `wcdb_section.theme.js` already uses for its `hero` height.
        //
        // 160px is what sits below the photo in the rail: the now-playing card
        // (~147) plus the band's own padding. Measured, not guessed — at 200 it
        // left ~50px of band showing under the block. `min-h` keeps it sane on a
        // short viewport, where the subtraction would otherwise win.
        imgOnAir: "w-full h-[calc(100vh-160px)] min-h-[420px] object-cover object-center",
        // The now-playing cover art — a fixed square slot, sized by the design
        // (104px) rather than by the cell, so it stays square whatever the
        // track name does to the row beside it.
        imgArt: "w-[104px] h-[104px] object-cover rounded-[10px] bg-[var(--bg-3)]",
      },
      {
        // "adminRow" — a record-card drawn as a ROW of a list, not as a card.
        //
        // Every admin list in the design (the spin log, the DJ roster, the
        // events table) is ONE card containing hairline-separated rows. A Card
        // section renders one record-card per row, so left at the default each
        // row became its own rounded, gapped surface — which is what made the
        // pages read as a stack of tiles instead of a table. This style turns a
        // record-card into a row: no radius, a hairline above, a hover wash, and
        // the design's horizontal gutter. Pair it with `cardsGridGap: 0` so the
        // rows touch, and fuse a header/footer section above and below for the
        // card's own chrome.
        name: "adminRow",
        // The on-air row: the station's red, washed across the WHOLE row with a
        // rule down its left edge — the design's "the live row gets an accent
        // tint + a left rule rather than only a pill, so 'what is on right now'
        // survives a squint". Applied by `display.highlightColumn/Value`.
        itemHighlight: "bg-[var(--on-air-soft)] border-l-2 border-l-[var(--on-air)]",
        itemHighlightBorder: "ring-1 ring-[var(--on-air)]",
        // `cellGutter: 0`, not inherited-8. A named style inherits every key it
        // does not set from styles[0], so the v2 migration would otherwise have
        // handed each row cell 8px of ambient padding it never had under v1
        // (this style's `headerValueWrapper` carries none on purpose). A row's
        // gutter is the row's, set once on `subWrapperCompactView` below —
        // `px-6 py-2` — so the cells inside must sit flush.
        cellGutter: 0,
        subWrapper: "w-full font-[family-name:var(--font-sans)] text-[15px] leading-[1.4] tracking-[-0.01em] text-[color:var(--ink-1)]",
        // `group` is load-bearing: the row-action cell reveals on row hover
        // (`group-hover:opacity-100`), and without a group ancestor it never
        // becomes visible at all.
        subWrapperCompactView:
          "group flex flex-col justify-center min-h-[52px] rounded-none border-t border-[var(--line-1)] " +
          "px-6 py-2 hover:bg-[var(--accent-soft)] transition-colors text-[color:var(--ink-1)]",
        headerValueWrapper: "w-full flex items-center justify-center",
        header: "w-full font-[family-name:var(--font-mono)] uppercase tracking-[0.12em] text-[length:var(--tx-xs)] text-[color:var(--ink-4)]",
        description: "w-full font-[family-name:var(--font-sans)] text-[length:var(--tx-xs)] font-light text-[color:var(--ink-3)]",
        imgFill: "w-full h-full object-cover rounded-[6px]",
      },
      {
        // "tileSoft" — `tile` on the card-soft tone with a tighter radius. The
        // design uses two tile surfaces: `--bg-2` for the board's role tiles
        // (inset inside a card) and `--card-bg-soft` at 14px for the event
        // tiles (sitting on the page). Same geometry, different ground.
        name: "tileSoft",
        cellGutter: 0,
        subWrapper: "w-full font-[family-name:var(--font-sans)] text-[15px] leading-[1.4] tracking-[-0.01em] text-[color:var(--ink-1)]",
        subWrapperCompactView: "group flex flex-col rounded-[14px] bg-[var(--card-bg-soft)] p-5 h-full text-[color:var(--ink-1)] transition-colors",
        headerValueWrapper: "w-full flex items-center",
      },
      {
        // "plain" — a card that paints NO surface of its own, so the SECTION's
        // background and radius are what you see.
        //
        // `styles[0]` bakes `rounded-[18px] bg-[var(--card-bg)]` into
        // `subWrapperCompactView`, which means a card always paints `--card-bg`
        // OVER whatever its section painted. That is invisible until the two
        // differ — and on the rail they do: the design puts the now-playing
        // block on `--bg-2` (#141618) and the card was overpainting it with
        // `--card-bg` (#1f2122), so the genre chip (correctly `--bg-2`) no
        // longer matched the surface it is supposed to be continuous with.
        //
        // `card-layout.md` §3.1.58 is explicit that border/radius/bg belong to
        // the section, not the card; moving them off `styles[0]` site-wide is
        // logged in modernize-wcdb-datacard-to-v2.md as deliberately deferred
        // (it would strip the surface from every card whose section does not
        // paint one). This style is the opt-in half of that change: sections
        // that own their surface select it and get exactly what they painted.
        name: "plain",
        cellGutter: 0,
        subWrapper: "w-full font-[family-name:var(--font-sans)] text-[15px] leading-[1.4] tracking-[-0.01em] text-[color:var(--ink-1)]",
        subWrapperCompactView: "flex flex-col text-[color:var(--ink-1)]",
        headerValueWrapper: "w-full flex items-center justify-center",
      },
      {
        // "adminRowDim" — `adminRow`, quieted. The events page keeps past
        // events on the record rather than dropping them, and the design dims
        // that list instead of styling it differently. One opacity, so a past
        // row still reads and still hovers.
        name: "adminRowDim",
        cellGutter: 0,
        subWrapper: "w-full font-[family-name:var(--font-sans)] text-[15px] leading-[1.4] tracking-[-0.01em] text-[color:var(--ink-1)]",
        subWrapperCompactView:
          "group flex flex-col justify-center min-h-[52px] rounded-none border-t border-[var(--line-1)] " +
          "px-6 py-2 opacity-55 hover:opacity-100 hover:bg-[var(--accent-soft)] transition-all text-[color:var(--ink-1)]",
        headerValueWrapper: "w-full flex items-center justify-center",
        header: "w-full font-[family-name:var(--font-mono)] uppercase tracking-[0.12em] text-[length:var(--tx-xs)] text-[color:var(--ink-4)]",
        description: "w-full font-[family-name:var(--font-sans)] text-[length:var(--tx-xs)] font-light text-[color:var(--ink-3)]",
        imgFill: "w-full h-full object-cover rounded-[6px]",
      },
      {
        // "tile" — a record-card drawn as a TILE in a grid, the counterpart of
        // `adminRow`. Every grid page in the public design (the executive
        // board's role tiles, the DJ roster, the blog grid) repeats the same
        // unit: an inset surface one step lighter than the card it sits in,
        // 12px corners, a generous inner gutter, contents stacked. Pair it with
        // `cardsGridSize: 2|3` and `cardsGridGap: 12`, and put the group's own
        // surface on the section (the fused header + grid pair).
        //
        // This is the style that fixes the Phase 5 C1 finding: the lists were
        // built as tables because there was no tile style to reach for.
        name: "tile",
        // The tile's inner gutter is the TILE's (`p-5` below), so cells sit
        // flush — same reasoning as `adminRow`, see the v2 note at the top.
        cellGutter: 0,
        subWrapper: "w-full font-[family-name:var(--font-sans)] text-[15px] leading-[1.4] tracking-[-0.01em] text-[color:var(--ink-1)]",
        subWrapperCompactView:
          "group flex flex-col rounded-[12px] bg-[var(--bg-2)] p-5 h-full " +
          "text-[color:var(--ink-1)] transition-colors",
        headerValueWrapper: "w-full flex items-center",
        header: "w-full font-[family-name:var(--font-mono)] uppercase tracking-[0.12em] text-[10px] text-[color:var(--ink-3)]",
        description: "w-full font-[family-name:var(--font-sans)] text-[length:var(--tx-xs)] font-light text-[color:var(--ink-3)]",
        imgFill: "w-full h-full object-cover rounded-[8px]",
      },
      {
        // "adminHeaderRow" — the column-header strip fused above a list. Same
        // gutter as `adminRow` so the tracks line up exactly, but no hairline of
        // its own (the first row provides it) and no hover.
        name: "adminHeaderRow",
        // Same reasoning as `adminRow` — and doubly so here, because the header
        // strip's tracks must line up EXACTLY with the row tracks below it.
        cellGutter: 0,
        subWrapper: "w-full",
        subWrapperCompactView: "flex flex-col rounded-none px-6 pb-2",
        headerValueWrapper: "w-full flex items-center",
        header: "hidden",
      },
    ],
  },
  // Table treatments — borderless rows with mono uppercase header.
  // Outer container carries the body baseline so any cell content lacking
  // an explicit text* class still falls onto the WCDB rhythm.
  table: {
    options: { activeStyle: 0 },
    styles: [
      {
        name: "default",
        tableContainer: "flex flex-col overflow-x-auto min-h-[40px] max-h-[calc(78vh_-_10px)] overflow-y-auto font-[family-name:var(--font-sans)] text-[15px] leading-[1.4] tracking-[-0.01em] text-[color:var(--ink-1)]",
        headerCellContainer: "w-full font-[family-name:var(--font-mono)] uppercase tracking-[0.12em] text-[length:var(--tx-xs)] px-3 py-2 content-center text-[color:var(--ink-3)]",
        headerCellContainerBg: "bg-transparent",
        headerCellContainerBgSelected: "bg-[var(--accent-soft)] text-[color:var(--ink-1)]",
        cell: "relative flex items-center min-h-[44px] border-t border-[var(--line-1)]",
        cellInner: "w-full min-h-full flex flex-wrap items-center truncate py-1 px-3 text-[color:var(--ink-2)]",
        cellBg: "bg-transparent hover:bg-[var(--bg-2)]",
        cellBgEven: "bg-transparent hover:bg-[var(--bg-2)]",
        cellBgOdd: "bg-transparent hover:bg-[var(--bg-2)]",
        cellBgSelected: "bg-[var(--accent-soft)]",
        stripedRow: "",
        gutterCellWrapperNotSelected: "bg-transparent text-[color:var(--ink-3)]",
        gutterCellWrapperSelected: "bg-[var(--accent-soft)] text-[color:var(--ink-1)]",
      },
    ],
  },
  pages: {
    // Section grid. The band's `theme` name selects the style, so the admin
    // bands get their own without touching the public ones.
    sectionArray: {
      options: { activeStyle: 0 },
      styles: [
        // styles[0] — the codebase default, the fallback for any band that
        // names no style. Left untouched.
        { name: "default" },
        {
          // "content" — the PUBLIC page column. A 1280 cap, wider than the
          // 1020 default because the public pages are composed in 12ths (a
          // 4-col card at 1020 is 340px; the designs draw it at ~427), and
          // `mr-auto` NOT `mx-auto` so the column stays anchored under the
          // TopNav notch instead of drifting to the middle of a wide monitor.
          name: "content",
          ...GRID_12,
          layouts: { centered: "max-w-[1280px] mr-auto", fullwidth: "w-full" },
        },
        {
          // "header" — the public cutaway panel (the sticky left column). It is
          // already constrained by its layoutGroup, so it takes the grid but no
          // cap of its own.
          name: "header",
          ...GRID_12,
          layouts: { centered: "w-full", fullwidth: "w-full" },
        },
        {
          // "admin" — an admin page has a 192px rail and one content column;
          // capping that column and centring it left every page ~210px
          // narrower than the design and pushed 106px right.
          name: "admin",
          ...GRID_12,
          layouts: { centered: "w-full", fullwidth: "w-full" },
        },
      ],
    },
    // Modal bands (`isModal` section groups) — the add/edit dialogs on every
    // admin page. The library's defaults are a white card with a grey ✕, which
    // is unreadable on this surface; these are the mockup's dialog chrome
    // (rounded-18 card on --card-bg, hairline border, heavy drop shadow,
    // top-aligned with an 8vh offset so a tall form scrolls rather than
    // centring off-screen). The close button uses the registry's XMark.
    sectionGroup: {
      modalOverlay:
        "fixed inset-0 z-[9998] bg-[var(--scrim)] flex items-start justify-center overflow-y-auto p-6",
      modalCard:
        "relative w-full rounded-[18px] bg-[var(--card-bg)] border border-[var(--line-2)] " +
        "shadow-[var(--shadow-modal)] mt-[8vh] mb-10 max-h-[84vh] overflow-y-auto",
      modalClose:
        "sticky float-right top-3 right-3 z-10 size-8 rounded-full grid place-items-center " +
        "text-[color:var(--ink-3)] hover:text-[color:var(--ink-1)] hover:bg-[var(--accent-soft)] transition-colors",
      modalCloseIcon: "XMark",
      modalCloseIconClass: "size-4",
    },
    // WCDB-flavoured section theme — owns `heights` preset map (selectable
    // via Layout > Height in the section menu) and `editMinHeight` (settings-
    // handle reachability in edit mode for empty sections). See
    // wcdb_section.theme.js for the values and the dms default at
    // packages/dms/src/patterns/page/components/sections/section.theme.jsx
    // for the keys this is allowed to override.
    section: wcdbSectionTheme,
    userMenu: {
      options: { activeStyle: 0 },
      styles: [
        {
          name: "default",
          userMenuContainer: "flex flex-1 w-full items-center justify-center rounded-xl min-w-[60px] @container",
          avatarWrapper: "flex p-2 justify-center items-center",
          avatar: "size-8 border border-[var(--line-2)] rounded-full place-items-center content-center hover:bg-[var(--accent-soft)]",
          avatarIcon: "size-6 fill-[var(--ink-2)]",
          infoWrapper: "flex-1 py-2 @max-[150px]:hidden",
          emailText: "text-xs font-thin tracking-tighter text-left text-[color:var(--ink-2)]",
          groupText: "text-xs font-medium -mt-1 tracking-widest text-left text-[color:var(--ink-3)]",

          editControlWrapper: "flex justify-center items-center py-2 pr-2",
          iconWrapper: "size-9 flex items-center justify-center",
          icon: "text-[color:var(--ink-3)] hover:text-[color:var(--ink-1)] size-7",
          viewIcon: "ViewPage",
          editIcon: "EditPage",

          loginWrapper: "flex items-center justify-center py-2",
          loginLink: "flex items-center",
          loginIconWrapper: "size-8 place-items-center content-center border border-[var(--line-2)] rounded-full hover:bg-[var(--accent-soft)]",
          loginIcon: "size-6 stroke-[var(--ink-2)] text-[color:var(--ink-2)]",
          loginText: "hidden",
          authContainer: "@container w-full min-w-[80px]",
          authWrapper: "flex items-center justify-center",
          userMenuWrapper: "flex items-center flex-1 w-full",
        },
      ],
    },
  },
  // Pills — what `status_pill` cells render through. The shipped styles are
  // light-mode emerald/rose/slate on a white ground; the admin's status chips
  // are the design's tinted micro-caps, and the station spends exactly one
  // accent colour (--on-air) on the states that want a person.
  pill: {
    options: { activeStyle: 0 },
    styles: [
      { name: "default", wrapper: "inline-flex items-center rounded-full border border-[var(--line-3)] px-2.5 py-1 font-[family-name:var(--font-mono)] text-[9px] tracking-[0.12em] uppercase text-[color:var(--ink-2)]" },
      // "on" — the state the roster opens on (CURRENT / LIVE).
      { name: "status_good", wrapper: "inline-flex items-center rounded-full bg-[var(--on-air-soft)] px-2.5 py-1 font-[family-name:var(--font-mono)] text-[9px] tracking-[0.12em] uppercase font-semibold text-[var(--on-air)]" },
      // "not yet / not any more" — quiet, bordered, never alarming.
      { name: "status_na",   wrapper: "inline-flex items-center rounded-full border border-[var(--line-3)] px-2.5 py-1 font-[family-name:var(--font-mono)] text-[9px] tracking-[0.12em] uppercase text-[color:var(--ink-3)]" },
      { name: "status_warn", wrapper: "inline-flex items-center rounded-full border border-[var(--line-3)] px-2.5 py-1 font-[family-name:var(--font-mono)] text-[9px] tracking-[0.12em] uppercase text-[color:var(--ink-2)]" },
      { name: "status_bad",  wrapper: "inline-flex items-center rounded-full bg-[var(--on-air-soft)] px-2.5 py-1 font-[family-name:var(--font-mono)] text-[9px] tracking-[0.12em] uppercase font-semibold text-[var(--on-air)]" },
    ],
  },
  // Select / multiselect. The shipped default is Catalyst-flavoured and switches
  // on Tailwind's `dark:` variant — but this brand's dark mode is the
  // `data-mode="dark"` ATTRIBUTE, so `dark:` never fires and every select
  // rendered as a white box on the dark admin. These are the same bordered
  // fields as `input` below, in tokens that follow the mode.
  multiselect: {
    options: { activeStyle: 0 },
    styles: [
      {
        name: "wcdb",
        view: "w-full h-full",
        mainWrapper: "group relative block w-full",
        inputWrapper:
          "relative flex flex-wrap items-center gap-1 w-full min-h-[42px] rounded-[8px] cursor-pointer " +
          "pl-[13px] pr-7 py-[9px] border border-[var(--line-2)] bg-[var(--bg-2)] " +
          "font-[family-name:var(--font-sans)] text-[length:var(--tx-md)] text-[color:var(--ink-1)] " +
          "hover:border-[var(--line-3)] focus-within:border-[color:var(--ink-3)] transition-colors duration-150",
        caretWrapper: "pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5",
        caretIcon: "size-4 stroke-[var(--ink-3)] text-[color:var(--ink-3)]",
        input:
          "block w-full appearance-none rounded-[8px] focus:outline-none px-3 py-2 " +
          "border border-[var(--line-2)] bg-[var(--bg-2)] " +
          "font-[family-name:var(--font-sans)] text-[length:var(--tx-md)] " +
          "text-[color:var(--ink-1)] placeholder:text-[color:var(--ink-4)]",
        statusWrapper: "flex items-center text-[length:var(--tx-md)] text-[color:var(--ink-2)]",
        singleValue: "font-[family-name:var(--font-sans)] text-[length:var(--tx-md)] text-[color:var(--ink-1)] truncate",
        singlePlaceholder: "font-[family-name:var(--font-sans)] text-[length:var(--tx-md)] text-[color:var(--ink-4)]",
        tokenWrapper:
          "inline-flex items-center gap-1 rounded-full border border-[var(--line-3)] px-2 py-0.5 " +
          "font-[family-name:var(--font-mono)] text-[10px] tracking-[0.08em] uppercase text-[color:var(--ink-2)]",
        menuWrapper:
          "absolute z-50 mt-1 w-full rounded-[12px] border border-[var(--line-2)] bg-[var(--card-bg)] " +
          "shadow-[var(--shadow-modal)] p-2",
        alwaysOpenMenuWrapper: "mt-1 w-full rounded-[12px] border border-[var(--line-2)] bg-[var(--card-bg)] p-2",
        tabularMenuWrapper: "grid grid-cols-2 gap-1",
        optionsWrapper: "mt-1 max-h-[300px] overflow-auto",
        menuItem:
          "flex items-center gap-2 w-full px-3 py-2 rounded-[8px] cursor-pointer " +
          "font-[family-name:var(--font-sans)] text-[length:var(--tx-md)] text-[color:var(--ink-2)] " +
          "hover:bg-[var(--accent-soft)] hover:text-[color:var(--ink-1)] transition-colors",
        smartMenuWrapper: "flex flex-wrap gap-1",
        smartMenuItem:
          "inline-flex items-center rounded-full border border-[var(--line-2)] px-2.5 py-1 cursor-pointer " +
          "font-[family-name:var(--font-mono)] text-[10px] tracking-[0.08em] uppercase " +
          "text-[color:var(--ink-3)] hover:text-[color:var(--ink-1)]",
        error: "p-1 text-xs text-[var(--on-air)] font-medium",
        selectedValueIcon: "size-4 text-[color:var(--ink-1)]",
      },
    ],
  },
  // Form controls — bordered variant from the WCDB design system
  // (`.wc-input--bordered`, `SelectStrip`). Geist 14px, line-2 border on
  // bg-2/bg-1, 8px radius, ink-3 on focus, ink-4 placeholder. The Select
  // chevron in `Select.jsx` is hardcoded `stroke-zinc-*` and isn't themable
  // here — `dark:stroke-zinc-400` reads close enough to ink-3 in both modes.
  input: {
    inputContainer: "relative block w-full",
    input:
      "w-full appearance-none rounded-[8px] border border-[var(--line-2)] bg-[var(--bg-2)] " +
      "px-[14px] py-[12px] font-[family-name:var(--font-sans)] text-[length:var(--tx-md)] " +
      "text-[color:var(--ink-1)] placeholder:text-[color:var(--ink-4)] outline-none " +
      "transition-colors duration-150 focus:border-[color:var(--ink-3)] " +
      "disabled:opacity-50 disabled:cursor-not-allowed",
    textarea:
      "w-full appearance-none rounded-[8px] border border-[var(--line-2)] bg-[var(--bg-2)] " +
      "px-[14px] py-[12px] font-[family-name:var(--font-sans)] text-[length:var(--tx-md)] " +
      "text-[color:var(--ink-1)] placeholder:text-[color:var(--ink-4)] outline-none " +
      "transition-colors duration-150 focus:border-[color:var(--ink-3)] " +
      "disabled:opacity-50 disabled:cursor-not-allowed resize-y min-h-[80px]",
    // ConfirmInput overlay buttons — keep them tonal so they sit cleanly on
    // top of the bordered input without breaking the WCDB monochrome palette.
    confirmButtonContainer:
      "absolute inset-y-0 right-2 hidden group-hover:flex items-center gap-1",
    editButton:
      "p-1 text-[color:var(--ink-3)] hover:text-[color:var(--ink-1)] cursor-pointer",
    cancelButton:
      "p-1 text-[color:var(--ink-3)] hover:text-[color:var(--on-air)] cursor-pointer",
    confirmButton:
      "p-1 text-[color:var(--ink-1)] hover:bg-[var(--accent-soft)] cursor-pointer rounded-full",
  },
  widgets: {
    NavRightStyleWidget: { label: "Nav Right Style", component: NavRightStyleWidget },
    NavLeftStyleWidget: { label: "Nav Left Style", component: NavLeftStyleWidget },
    ThemeModeToggle: { label: "Theme Mode Toggle", component: ThemeModeToggle },
    // Admin-rail chrome. Both take options from the pattern's widget entry:
    // { type: 'SideNavHeading', options: { label: 'Station admin' } }
    SideNavHeading: { label: "SideNav Heading", component: SideNavHeading },
    SideNavSiteLink: { label: "SideNav Site Link", component: SideNavSiteLink },
  },
  // The brand's 49-glyph registry, GENERATED from the design-system catalogue
  // (`node scripts/icons-sync.mjs` in dms_design_system/). This is what makes an
  // icon NAME work anywhere a name is accepted — sidenav items, Card icon cells,
  // the lexical `icon` node. A name that is not in here renders nothing at all,
  // which is the failure mode the admin pages would have hit: they reference ~30
  // of these by name.
  Icons: icons,
  // Theme-shipped page-section components — auto-registered by the page
  // pattern's siteConfig via registerComponents(theme.pageComponents), so the
  // section, its config and its skin all live in this brand's folder rather
  // than in the library.
  pageComponents: {
    ScheduleGrid: scheduleGrid,
  },
  scheduleGrid: scheduleGridTheme,
  // Theme-registered column types. Auto-registered in
  // patterns/page/siteConfig.jsx via the registerColumnType API.
  columnTypes: {
    portrait_banner: portraitBanner,
    stream_player: streamPlayer,
    now_indicator: nowIndicator,
    // Admin cells. Both are "the look depends on the value" cases, which is
    // what a small column type is for — a formatFn can only change the text.
    filter_pill: filterPill,
    provenance_badge: provenanceBadge,
    row_action: rowAction,
  },
  // Theme namespace consumed by the portrait_banner column type via
  // getComponentTheme. Lets us tune the banner height, scan-line texture,
  // and initials glyph size site-wide without touching column metadata.
  portraitBanner: portraitBannerTheme,
  // Theme namespace consumed by the stream_player column type. Owns the
  // player's padding, art size, play-button size, and the static
  // placeholders (elapsed/total/listeners) used until a live-clock data
  // source replaces them.
  streamPlayer: streamPlayerTheme,
  // Theme namespace consumed by the now_indicator column type. Owns the
  // pill/meta typography sizes and the default `timestampField` name; the
  // pulsing red dot animation uses `@keyframes wcdb-pulse-dot` from
  // `src/themes/wcdb/tokens.css`.
  nowIndicator: nowIndicatorTheme,
  // Theme namespaces for the two admin column types — the segmented control's
  // pill states, and the playlist badge's four provenance registers.
  filterPill: filterPillTheme,
  provenanceBadge: provenanceBadgeTheme,
  rowAction: rowActionTheme,
}

export default theme
