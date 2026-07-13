/* =============================================================================
   Tessera — DMS Theme (v0.1)

   The brand applied to the DMS UI kit. Translates the Tessera design tokens
   (see `Tessera Design System/colors_and_type.css`) into the `options/styles`
   shape DMS theme primitives expect.

   Read together with:
   - references/dms product/positioning-v2.md
   - references/dms product/brand-tessera.md
   - src/dms/skills/designing-a-dms-theme.md
   - src/themes/tessera/Tessera Design System/README.md

   Conventions:
   - Class strings use Tailwind arbitrary values (`bg-[#F4F1EA]`) for the
     brand-specific mineral palette. A future pass should extend the project
     `tailwind.config.js` with named colors (`bone`, `slate`, `oxide`, etc.)
     and swap arbitrary values for the names. For v0.1 portability wins.
   - styles[0] is the complete default. Named variants are sparse overrides.
   - Square corners by default; only buttons / inputs get `rounded-[2px]`;
     pills get the full pill.
   - No gradients, no glass, no drop shadows beyond the single `lifted`
     treatment. Snap motion (`duration-100`), no eases longer than 200ms.
   ============================================================================= */

import {
  TypeBadgeView, TypeBadgeEdit,
  SubdomainPillView, SubdomainPillEdit,
  UserAvatarView, UserAvatarEdit,
  GroupPillView, GroupPillEdit,
  PermBadgeView, PermBadgeEdit,
  AvatarStackView,
} from './admin.columnTypes';

/* ---------- Brand palette (mirrors colors_and_type.css :root) ------------- */

const c = {
  // Surfaces (≈85% of any composition)
  bone:       '#F4F1EA',
  limestone:  '#E8E2D5',
  parchment:  '#FBF9F4',

  // Ink
  slate:      '#2A2F36',
  graphite:   '#4A5160',
  fog:        '#A7ADB6',

  // Accents (≤15%; emphasis only, never decoration)
  oxide:      '#B5532C',
  tile:       '#7F1D1D',
  verdigris:  '#5D8A85',
  ochre:      '#B45309',

  // Grout
  groutLight: '#D9D2C2',
  groutDark:  '#1A1D22',
};

const FONT_DISPLAY = 'font-serif';   // Tiempos Headline (Newsreader fallback)
const FONT_FINE    = 'font-fine';    // Tiempos Fine — for hero-scale display (60+px)
const FONT_SANS    = 'font-sans';    // IBM Plex Sans
const FONT_MONO    = 'font-mono';    // IBM Plex Mono

/* ---------- textSettings — global type scale ------------------------------ */
/* Sourced by Lexical, Card, Header, and any column type that renders text.
   Heading keys (h1..h6) and the textXS..text8XL ramp are both populated;
   semantic aliases (body, caption, label) round it out. */

/* ---------- Brand token strings (the 17-token system from theme.html#type) -
   Universal pattern: {role}{Size}[{Variant}].
     role: display · displayItalic · prose · meta
     Size: Hero · XL · LG · MD · SM · XS (base body drops the suffix)
   Color, italic-on-prose, tabular-nums, and uppercase tracking-only variants
   are MODIFIER axes applied at the call site, not new tokens. */

const T = {
  // Display — Tiempos Headline 500 (with Newsreader fallback), tight tracking.
  // Hero size uses FONT_FINE (Tiempos Fine) — its hairlines are designed for
  // 60+ px and look more deliberate than the headline cut blown up.
  displayHero: `${FONT_FINE}    font-medium text-[76px] leading-[1.04] tracking-[-0.02em]  scroll-mt-36 text-[${c.slate}]`,
  displayXL:   `${FONT_DISPLAY} font-medium text-5xl   leading-[1.08] tracking-[-0.012em] scroll-mt-36 text-[${c.slate}]`,
  displayLG:   `${FONT_DISPLAY} font-medium text-4xl   leading-[1.08] tracking-[-0.012em] scroll-mt-36 text-[${c.slate}]`,
  displayMD:   `${FONT_DISPLAY} font-medium text-[28px] leading-[1.2]  tracking-[-0.012em] scroll-mt-36 text-[${c.slate}]`,
  displaySM:   `${FONT_DISPLAY} font-medium text-[22px] leading-[1.2]  tracking-[-0.008em] scroll-mt-36 text-[${c.slate}]`,
  displayXS:   `${FONT_DISPLAY} font-medium text-[18px] leading-[1.25] tracking-[-0.005em] scroll-mt-36 text-[${c.slate}]`,

  // Display Italic — Tiempos Headline Italic 400 (Newsreader Italic fallback).
  // Hero italic uses Tiempos Fine Italic for the same reason as roman hero.
  displayItalicHero: `${FONT_FINE}    italic font-normal text-[64px] leading-[1.05] tracking-[-0.018em] text-[${c.slate}]`,
  displayItalicLG:   `${FONT_DISPLAY} italic font-normal text-4xl   leading-[1.18] tracking-[-0.012em] text-[${c.slate}]`,
  displayItalicMD:   `${FONT_DISPLAY} italic font-normal text-[26px] leading-[1.35] text-[${c.slate}]`,
  displayItalicSM:   `${FONT_DISPLAY} italic font-normal text-xl    leading-[1.5]  text-[${c.slate}]`,

  // Prose — IBM Plex Sans 400
  proseLG: `${FONT_SANS} font-normal text-xl   leading-[1.55] text-[${c.slate}]`,
  prose:   `${FONT_SANS} font-normal text-base leading-[1.55] text-[${c.slate}]`,
  proseSM: `${FONT_SANS} font-normal text-sm   leading-[1.5]  text-[${c.slate}]`,
  proseXS: `${FONT_SANS} font-normal text-xs   leading-[1.45] text-[${c.slate}]`,

  // Meta — IBM Plex Mono 400
  metaMD: `${FONT_MONO} font-normal text-sm   leading-[1.45] tabular-nums text-[${c.slate}]`,
  metaSM: `${FONT_MONO} font-normal text-[11px] leading-[1.4] tracking-[0.06em] uppercase text-[${c.graphite}]`,
  metaXS: `${FONT_MONO} font-normal text-[10px] leading-[1.4] tracking-[0.08em] uppercase text-[${c.graphite}]`,

  // Eyebrow — the small mono kicker that sits above section headings in the
  // design (`Surfaces`, `Two doors`, `In use`, `Theory`). Differs from metaSM
  // in three ways tuned for that specific use:
  //   1. Lighter color (fog, not graphite) — eyebrows in the design read as
  //      label-faint, not body-weight.
  //   2. Tight bottom margin (mb-2) — the eyebrow sits 8px above the heading,
  //      not the default paragraph `mb-4` which leaves a big gap.
  //   3. A small oxide square mark before the text, rendered via ::before.
  //      This is the recurring brand mark from the design's section eyebrows.
  //      `flex items-center` aligns the square with the cap height of the
  //      mono text.
  eyebrow: `${FONT_MONO} font-normal text-[11px] leading-[1.4] tracking-[0.08em] uppercase text-[${c.fog}] mb-2 flex items-center before:content-[''] before:inline-block before:w-2 before:h-2 before:bg-[${c.oxide}] before:mr-2`,
};

const textSettings = {
  options: {
    activeStyle: 0,
    // Filter which textSettings keys surface as `/Style: <key>` options in
    // Lexical's slash menu. Without this, every key (including the generic
    // textXS..text8XL size ladder) shows up — which is a lot. Listing only
    // the 17 brand tokens keeps the author menu focused on the brand's
    // designed vocabulary.
    slashKeys: [
      'displayHero', 'displayXL', 'displayLG', 'displayMD', 'displaySM', 'displayXS',
      'displayItalicHero', 'displayItalicLG', 'displayItalicMD', 'displayItalicSM',
      'proseLG', 'prose', 'proseSM', 'proseXS',
      'metaMD', 'metaSM', 'metaXS',
      'eyebrow',
    ],
  },
  styles: [{
    name: 'default',

    // ----- Brand tokens (17) — see theme.html#type ---------------------------
    displayHero:       T.displayHero,
    displayXL:         T.displayXL,
    displayLG:         T.displayLG,
    displayMD:         T.displayMD,
    displaySM:         T.displaySM,
    displayXS:         T.displayXS,
    displayItalicHero: T.displayItalicHero,
    displayItalicLG:   T.displayItalicLG,
    displayItalicMD:   T.displayItalicMD,
    displayItalicSM:   T.displayItalicSM,
    proseLG:           T.proseLG,
    prose:             T.prose,
    proseSM:           T.proseSM,
    proseXS:           T.proseXS,
    metaMD:            T.metaMD,
    metaSM:            T.metaSM,
    metaXS:            T.metaXS,
    eyebrow:           T.eyebrow,

    // ----- Heading roles — map h1..h6 onto the display ladder ----------------
    // Lexical's slash menu lets authors type `/heading 1`..`/heading 6` to
    // convert a paragraph; getLexicalTheme() backfills these onto
    // heading_h1..heading_h6 when the lexical theme doesn't define them
    // explicitly. By aliasing h1..h6 to the display tokens here AND defining
    // heading_h1..h6 below, an author who types `/heading 1` gets displayHero,
    // `/heading 2` gets displayXL, etc. — six display sizes via the existing
    // slash mechanism, no new Lexical node needed.
    h1: T.displayHero,
    h2: T.displayXL,
    h3: T.displayLG,
    h4: T.displayMD,
    h5: T.displaySM,
    h6: T.displayXS,

    // Size + weight scale (consumed by Card cells via valueFontStyle dropdown)
    textXS:           `${FONT_SANS} text-xs font-medium`,
    textXSReg:        `${FONT_SANS} text-xs font-normal`,
    textXSBold:       `${FONT_SANS} text-xs font-bold`,
    textSM:           `${FONT_SANS} text-sm font-medium`,
    textSMReg:        `${FONT_SANS} text-sm font-normal`,
    textSMBold:       `${FONT_SANS} text-sm font-semibold`,
    textSMSemiBold:   `${FONT_SANS} text-sm font-semibold`,
    textBase:         `${FONT_SANS} text-base font-normal`,
    textBaseMedium:   `${FONT_SANS} text-base font-medium`,
    textBaseBold:     `${FONT_SANS} text-base font-semibold`,
    textLG:           `${FONT_SANS} text-lg font-medium`,
    textLGReg:        `${FONT_SANS} text-lg font-normal`,
    textLGBold:       `${FONT_SANS} text-lg font-semibold`,
    textXL:           `${FONT_DISPLAY} text-xl font-medium`,
    textXLReg:        `${FONT_DISPLAY} text-xl font-normal`,
    textXLSemiBold:   `${FONT_DISPLAY} text-xl font-semibold`,
    textXLBold:       `${FONT_DISPLAY} text-xl font-semibold`,
    text2XL:          `${FONT_DISPLAY} text-2xl font-medium leading-tight`,
    text2XLReg:       `${FONT_DISPLAY} text-2xl font-normal leading-tight`,
    text2XLSemiBold:  `${FONT_DISPLAY} text-2xl font-semibold leading-tight`,
    text2XLBold:      `${FONT_DISPLAY} text-2xl font-semibold leading-tight`,
    text3XL:          `${FONT_DISPLAY} text-3xl font-medium leading-tight`,
    text3XLReg:       `${FONT_DISPLAY} text-3xl font-normal leading-tight`,
    text3XLSemiBold:  `${FONT_DISPLAY} text-3xl font-semibold leading-tight`,
    text3XLBold:      `${FONT_DISPLAY} text-3xl font-semibold leading-tight`,
    text4XL:          `${FONT_DISPLAY} text-4xl font-medium leading-tight tracking-tight`,
    text4XLBold:      `${FONT_DISPLAY} text-4xl font-semibold leading-tight tracking-tight`,
    text5XL:          `${FONT_DISPLAY} text-5xl font-medium leading-tight tracking-tight`,
    text5XLBold:      `${FONT_DISPLAY} text-5xl font-semibold leading-tight tracking-tight`,
    text6XL:          `${FONT_DISPLAY} text-6xl font-medium leading-none tracking-tight`,
    text7XL:          `${FONT_DISPLAY} text-7xl font-medium leading-none tracking-tight`,
    text8XL:          `${FONT_DISPLAY} text-8xl font-medium leading-none tracking-tighter`,

    // Semantic aliases
    body:      `${FONT_SANS} text-base font-normal leading-relaxed text-[${c.slate}]`,
    bodySmall: `${FONT_SANS} text-sm font-normal leading-relaxed text-[${c.slate}]`,
    caption:   `${FONT_SANS} text-xs font-normal text-[${c.graphite}]`,
    label:     `${FONT_SANS} text-sm font-medium text-[${c.slate}]`,

    // Designator (small caps with tracking; consumed by section labels)
    designator: `${FONT_SANS} text-xs font-medium uppercase tracking-[0.08em] text-[${c.graphite}]`,
  }],
};

/* ---------- Layout -------------------------------------------------------- */

const layout = {
  options: {
    activeStyle: 0,
    sideNav: {
      size: 'compact',
      nav: 'main',
      activeStyle: null,
      _replace: ['topMenu', 'bottomMenu'],
      topMenu: [{ type: 'Logo' }],
      bottomMenu: [{ type: 'UserMenu' }],
    },
    topNav: {
      size: 'none',
      nav: 'none',
      activeStyle: null,
      _replace: ['leftMenu', 'rightMenu'],
      leftMenu: [],
      rightMenu: [],
    },
  },
  styles: [
    {
      name: 'default',
      outerWrapper: `bg-[${c.bone}]`,
      wrapper: `relative isolate flex min-h-svh w-full max-lg:flex-col`,
      wrapper2: `flex-1 flex items-start flex-col items-stretch max-w-full min-h-screen`,
      wrapper3: `flex flex-1 items-start`,
      childWrapper: `flex-1 flex flex-col h-full`,
    },
    {
      name: 'app',
      outerWrapper: `bg-[${c.bone}]`,
      wrapper: `relative isolate flex min-h-svh w-full max-lg:flex-col`,
      wrapper2: `flex-1 flex items-start flex-col items-stretch max-w-full min-h-screen`,
      wrapper3: `flex flex-1 items-start`,
      childWrapper: `flex-1 flex flex-col h-full bg-[${c.bone}]`,
    },
    {
      name: 'bare',
      outerWrapper: `bg-[${c.bone}]`,
      wrapper: `relative isolate flex min-h-svh w-full`,
      wrapper2: `flex-1 flex flex-col w-full min-h-screen`,
      wrapper3: `flex flex-1`,
      childWrapper: `flex-1 flex flex-col h-full`,
    },
  ],
};

/* ---------- LayoutGroup --------------------------------------------------- */

const layoutGroup = {
  options: { activeStyle: 0 },
  styles: [
    {
      // The default "content" surface — boxed parchment card, square corners,
      // hairline frame, the single subtle "lifted" elevation treatment.
      // wrapper2 padding reduced from p-8 (32px) to p-6 (24px) — the
      // codebase default + p-8 + sectionArray's p-4 = 48px total padding
      // around section content, which feels overstuffed at design scale.
      // With p-6 + sectionPadding p-2 (see pages.sectionArray.styles[0])
      // we get a tighter 32px total — closer to the design mockup's feel.
      name: 'content',
      wrapper1: `w-full flex flex-row px-6 py-4 max-w-[1280px] mx-auto`,
      wrapper2: `flex flex-1 w-full flex-col bg-[${c.parchment}] border border-[${c.groutLight}] rounded-none relative ${FONT_SANS} text-base font-normal leading-relaxed p-6 min-h-[200px] shadow-[0_1px_2px_rgba(42,47,54,0.04)] text-[${c.slate}]`,
      wrapper3: '',
    },
    {
      // Unboxed band — sits directly on the bone background. For heroes,
      // page titles, full-bleed bands.
      name: 'header',
      wrapper1: `w-full flex flex-row px-6 pt-12 pb-6 max-w-[1280px] mx-auto`,
      wrapper2: `flex flex-1 w-full flex-col relative`,
      wrapper3: '',
    },
    {
      // Centred sign-in / sign-up form surface.
      name: 'auth',
      wrapper1: `w-full flex-1 flex flex-row p-6 items-center justify-center min-h-[80vh]`,
      wrapper2: `flex flex-col bg-[${c.parchment}] border border-[${c.groutLight}] rounded-none relative ${FONT_SANS} text-base font-normal leading-relaxed p-10 w-full max-w-md shadow-[0_1px_2px_rgba(42,47,54,0.04)]`,
      wrapper3: '',
    },
    {
      // Full-bleed footer band — flat, distinct contrast, no shadow.
      name: 'footer',
      wrapper1: `w-full flex flex-row border-t border-[${c.groutLight}] bg-[${c.limestone}] px-6 py-10 mt-12`,
      wrapper2: `flex flex-1 w-full flex-col max-w-[1280px] mx-auto`,
      wrapper3: '',
    },
  ],
};

/* ---------- TopNav -------------------------------------------------------- */
/* Keys mirror src/dms/packages/dms/src/ui/components/TopNav.theme.jsx — the
   live TopNav.jsx only reads the names below, so anything else (wrapper,
   inner, menu, menuItem, ...) silently no-ops. */

const topnav = {
  options: { activeStyle: 0, maxDepth: 2 },
  styles: [{
    name: 'default',

    // Layout containers (the sticky outer + full-width inner)
    layoutContainer1: `sticky top-0 z-40`,
    layoutContainer2: `w-full bg-[${c.bone}] border-b border-[${c.groutLight}]`,

    // Wrappers (band + content row)
    topnavWrapper: `w-full h-14 flex items-center px-6`,
    topnavContent: `flex items-center w-full h-full max-w-[1280px] mx-auto justify-between gap-4`,

    // Slot containers
    leftMenuContainer: `flex items-center gap-6`,
    centerMenuContainer: `hidden lg:flex items-center flex-1 h-full overflow-visible gap-1`,
    rightMenuContainer: `hidden md:flex h-full items-center gap-3 min-w-[200px] justify-end`,
    mobileNavContainer: `px-6 py-3 bg-[${c.bone}] border-b border-[${c.groutLight}]`,

    // Mobile toggle
    mobileButton: `lg:hidden inline-flex items-center justify-center p-2 text-[${c.slate}] hover:bg-[${c.limestone}] cursor-pointer rounded-[2px]`,
    menuOpenIcon: `Menu`,
    menuCloseIcon: `XMark`,

    // Top-level nav items
    navitemWrapper: `relative`,
    navitemWrapper_level_2: `relative`,
    navitemWrapper_level_3: ``,

    navitem: `flex items-center gap-1.5 cursor-pointer ${FONT_SANS} text-sm font-medium px-3 py-1.5 text-[${c.graphite}] hover:text-[${c.slate}] transition-colors duration-100`,
    navitemActive: `flex items-center gap-1.5 cursor-pointer ${FONT_SANS} text-sm font-medium px-3 py-1.5 text-[${c.slate}] border-b-2 border-[${c.slate}] -mb-px`,

    navIcon: `w-4 h-4 text-[${c.graphite}]`,
    navIconActive: `w-4 h-4 text-[${c.slate}]`,

    navitemContent: `flex items-center gap-1.5`,
    navitemName: ``,
    navitemName_level_2: `w-full ${FONT_SANS} text-sm font-medium text-[${c.slate}] hover:bg-[${c.limestone}] py-2 px-3 cursor-pointer flex items-center justify-between gap-2 transition-colors duration-100`,
    navitemName_level_3: `w-full ${FONT_SANS} text-sm font-normal text-[${c.graphite}] hover:text-[${c.slate}] hover:bg-[${c.limestone}] py-1.5 px-3 cursor-pointer transition-colors duration-100`,

    navitemDescription: `hidden`,
    navitemDescription_level_2: `${FONT_SANS} text-xs text-[${c.graphite}] mt-0.5`,
    navitemDescription_level_3: `${FONT_SANS} text-xs text-[${c.fog}] mt-0.5`,

    // Expand indicator on items with children
    indicatorIconWrapper: `w-3.5 h-3.5 text-[${c.graphite}]`,
    indicatorIcon: `ChevronDown`,
    indicatorIconOpen: `ChevronDown`,

    // Level-1 submenu (dropdown below the top item)
    subMenuWrapper: `absolute top-full left-0 mt-1 z-40`,
    subMenuWrapper2: `bg-[${c.parchment}] border border-[${c.groutLight}] rounded-none py-1 min-w-[14rem] shadow-[0_1px_2px_rgba(42,47,54,0.04)]`,

    // Level-2 submenu (flyout to the right of a level-2 item)
    subMenuWrapper_level_2: `absolute left-full top-0 ml-1 z-40`,
    subMenuWrapper2_level_2: `bg-[${c.parchment}] border border-[${c.groutLight}] rounded-none py-1 min-w-[14rem] shadow-[0_1px_2px_rgba(42,47,54,0.04)]`,

    subMenuItemsWrapper: `flex flex-col`,
    subMenuItemsWrapperParent: `flex flex-col`,

    // The "section header" inside a submenu (shown when a parent has a description)
    subMenuParentWrapper: `hidden`,
    subMenuParentContent: `px-3 py-2 border-b border-[${c.groutLight}] mb-1`,
    subMenuParentName: `${FONT_SANS} text-xs font-medium uppercase tracking-[0.08em] text-[${c.graphite}]`,
    subMenuParentDesc: `${FONT_SANS} text-xs text-[${c.fog}] mt-0.5`,
    subMenuParentLink: `${FONT_SANS} text-xs text-[${c.slate}] hover:text-[${c.oxide}] underline decoration-[${c.fog}] mt-1 inline-block`,
  }],
};

/* ---------- SideNav ------------------------------------------------------- */
/* Keys mirror src/dms/packages/dms/src/ui/components/SideNav.theme.jsx — the
   live SideNav.jsx only reads the names below. Levels 1..4 are styled via
   the _level_N suffix; the active treatment is the oxide left-rule. */

const sidenav = {
  options: { activeStyle: 0 },
  styles: [{
    name: 'default',

    // Layout containers (push the page over by sidebar width + the fixed rail)
    layoutContainer1: `lg:pl-64`,
    layoutContainer2: `fixed inset-y-0 left-0 w-64 max-lg:hidden`,

    // Brand / logo area at top
    logoWrapper: `flex items-center h-14 px-4 border-b border-[${c.groutLight}] bg-[${c.bone}]`,

    // Main sidebar wrapper (the rail itself)
    sidenavWrapper: `flex flex-col w-64 h-full bg-[${c.bone}] border-r border-[${c.groutLight}]`,

    // Menu structure
    menuItemWrapper: `flex flex-1 flex-col gap-px`,
    menuItemWrapper_level_1: ``,
    menuItemWrapper_level_2: `ml-3 border-l border-[${c.groutLight}]`,
    menuItemWrapper_level_3: `ml-3 border-l border-[${c.groutLight}]`,
    menuItemWrapper_level_4: `ml-3`,

    // Nav items (the rows)
    navitemSide: `
      group w-full flex items-center gap-2 px-3 py-2 mx-1
      ${FONT_SANS} text-sm font-medium text-[${c.graphite}]
      hover:bg-[${c.limestone}] hover:text-[${c.slate}]
      cursor-pointer transition-colors duration-100`,
    navitemSideActive: `
      group w-full flex items-center gap-2 px-3 py-2 mx-1
      ${FONT_SANS} text-sm font-medium text-[${c.slate}]
      bg-[${c.limestone}]
      border-l-2 border-[${c.oxide}] -ml-px
      cursor-pointer`,

    // Icons
    menuIconSide: `w-4 h-4 text-[${c.graphite}] group-hover:text-[${c.slate}] transition-colors duration-100`,
    menuIconSideActive: `w-4 h-4 text-[${c.slate}]`,

    // Forced icon (rendered when nav item has no icon set)
    forcedIcon: ``,
    forcedIcon_level_1: ``,
    forcedIcon_level_2: ``,
    forcedIcon_level_3: ``,
    forcedIcon_level_4: ``,

    // The scroll container that holds the menu
    itemsWrapper: `flex-1 overflow-y-auto px-2 py-3`,

    // The flex row inside each navitem (label + value/badge)
    navItemContent: `flex items-center gap-2 flex-1`,
    navItemContent_level_1: ``,
    navItemContent_level_2: `${FONT_SANS} text-sm font-normal`,
    navItemContent_level_3: `${FONT_SANS} text-sm font-normal`,
    navItemContent_level_4: `${FONT_SANS} text-xs font-normal`,

    // Expand-indicator on expandable items
    indicatorIcon: `ChevronRight`,
    indicatorIconOpen: `ChevronDown`,
    indicatorIconWrapper: `w-4 h-4 text-[${c.graphite}] transition-transform duration-100`,

    // Submenu shells
    subMenuWrapper_1: `mt-px space-y-px`,
    subMenuWrapper_2: `mt-px space-y-px`,
    subMenuWrapper_3: `mt-px space-y-px`,
    subMenuOuterWrapper: ``,
    subMenuParentWrapper: `flex flex-col`,
    subMenuTitle: `hidden`,

    // Bottom widget slot (user menu / version chip)
    bottomMenuWrapper: `mt-auto border-t border-[${c.groutLight}] p-4 bg-[${c.bone}]`,

    // Section divider + heading (when the side nav is grouped)
    sectionDivider: `my-3 border-t border-[${c.groutLight}]`,
    sectionHeading: `px-3 py-2 ${FONT_SANS} text-xs font-medium uppercase tracking-[0.08em] text-[${c.graphite}]`,

    // Mobile-only topnav-ish strip the SideNav renders when collapsed
    topnavWrapper: `w-full h-14 flex items-center px-4`,
    topnavContent: `flex items-center w-full h-full bg-[${c.bone}] justify-between`,
    topnavMenu: `hidden lg:flex items-center flex-1 h-full overflow-visible`,
    topmenuRightNavContainer: `flex items-center gap-2`,
    topnavMobileContainer: `bg-[${c.bone}] border-b border-[${c.groutLight}]`,
  }],
};

/* ---------- NavigableMenu (dropdown / popover menu) ----------------------- */

const navigableMenu = {
  options: { activeStyle: 0 },
  styles: [{
    name: 'default',
    button: `inline-flex items-center justify-center gap-1.5 px-2 py-1 rounded-[2px] hover:bg-[${c.limestone}] cursor-pointer transition-colors duration-100`,
    icon: 'Menu',
    iconWrapper: `w-4 h-4 stroke-[${c.slate}]`,
    menuWrapper: `bg-[${c.parchment}] border border-[${c.groutLight}] min-w-[16rem] p-1 shadow-[0_1px_2px_rgba(42,47,54,0.04)] rounded-none`,
    menuCloseIcon: 'XMark',
    menuCloseIconWrapper: `cursor-pointer w-4 h-4 stroke-[${c.graphite}] hover:stroke-[${c.slate}]`,
    menuItem: `group flex items-center justify-between px-3 py-2 text-sm ${FONT_SANS} text-[${c.slate}] cursor-pointer rounded-none`,
    menuItemHover: `hover:bg-[${c.limestone}]`,
    menuItemIconLabelWrapper: `flex flex-grow items-center gap-2`,
    menuItemIconWrapper: `w-4 h-4 stroke-[${c.graphite}] group-hover:stroke-[${c.slate}]`,
    menuItemLabel: '',
    subMenuIcon: 'ChevronRight',
    valueSubmenuIconWrapper: `flex gap-1 items-center`,
    subMenuIconWrapper: `place-self-center w-3.5 h-3.5 stroke-[${c.graphite}]`,
    valueWrapper: `px-1.5 py-0.5 ${FONT_MONO} text-xs text-[${c.graphite}] bg-[${c.limestone}] border border-[${c.groutLight}] tabular-nums`,
    separator: `w-full border-b border-[${c.groutLight}] my-1`,
  }],
};

/* ---------- Nestable ------------------------------------------------------ */

const nestable = {
  options: { activeStyle: 0 },
  styles: [{
    name: 'default',
    wrapper: `${FONT_SANS} text-sm`,
    item: `flex items-center gap-2 px-2 py-1 hover:bg-[${c.limestone}] cursor-pointer text-[${c.slate}]`,
    handle: `w-4 h-4 stroke-[${c.fog}] cursor-grab`,
    dropZone: `border-2 border-dashed border-[${c.oxide}] h-1 my-px`,
  }],
};

/* ---------- Logo (theme-level brand mark slot) ---------------------------- */

const logo = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: 'default',
      logoWrapper: `inline-flex items-center gap-2 px-3 py-3`,
      img: '/themes/tessera/tessera-wordmark.svg',
      imgWrapper: ``,
      imgClass: `h-10 w-auto`,
      logoAltImg: `inline-flex h-10 w-10 rounded items-center justify-center bg-[${c.slate}] text-[${c.parchment}] ${FONT_DISPLAY} text-sm font-medium`,
      title: '',
      titleWrapper: `sr-only`,
      linkPath: '/',
    },
    {
      name: 'compact',
      logoWrapper: `inline-flex items-center justify-center px-3 py-3`,
      img: '/themes/tessera/tessera-mark.svg',
      imgWrapper: ``,
      imgClass: `h-6 w-auto`,
      logoAltImg: `inline-flex h-6 w-6 rounded items-center justify-center bg-[${c.slate}]`,
      title: '',
      titleWrapper: `sr-only`,
      linkPath: '/',
    },
    {
      name: 'stacked',
      logoWrapper: `inline-flex flex-col items-center gap-1 px-3 py-4`,
      img: '/themes/tessera/tessera-mark.svg',
      imgWrapper: ``,
      imgClass: `h-10 w-auto`,
      logoAltImg: `inline-flex h-10 w-10 rounded items-center justify-center bg-[${c.slate}]`,
      title: 'Tessera',
      titleWrapper: `${FONT_DISPLAY} text-sm font-medium tracking-tight text-[${c.slate}]`,
      linkPath: '/',
    },
  ],
};

/* ---------- Button -------------------------------------------------------- */

const button = {
  options: { activeStyle: 0 },
  styles: [
    {
      // Primary — slate ink filled, parchment text.
      name: 'default',
      button: `cursor-pointer inline-flex items-center justify-center gap-2 ${FONT_SANS} text-sm font-medium leading-none px-4 py-2.5 rounded-[2px] border border-transparent bg-[${c.slate}] text-[${c.parchment}] hover:bg-[${c.groutDark}] active:bg-[${c.groutDark}] active:shadow-[inset_0_1px_0_rgba(0,0,0,0.2)] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[${c.slate}] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-100`,
    },
    {
      // Secondary — outlined slate on bone.
      name: 'plain',
      button: `cursor-pointer inline-flex items-center justify-center gap-2 ${FONT_SANS} text-sm font-medium leading-none px-4 py-2.5 rounded-[2px] border border-[${c.slate}] bg-transparent text-[${c.slate}] hover:bg-[${c.limestone}] active:bg-[${c.limestone}] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[${c.slate}] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-100`,
    },
    {
      // Tertiary — text-only, ghost.
      name: 'active',
      button: `cursor-pointer inline-flex items-center justify-center gap-2 ${FONT_SANS} text-sm font-medium leading-none px-2 py-2.5 rounded-[2px] border border-transparent bg-transparent text-[${c.slate}] hover:bg-[${c.limestone}] active:bg-[${c.limestone}] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[${c.slate}] disabled:opacity-50 transition-colors duration-100`,
    },
    {
      // Danger — oxide accent (terracotta), the brand's sharp note.
      name: 'danger',
      button: `cursor-pointer inline-flex items-center justify-center gap-2 ${FONT_SANS} text-sm font-medium leading-none px-4 py-2.5 rounded-[2px] border border-transparent bg-[${c.oxide}] text-[${c.parchment}] hover:bg-[${c.tile}] active:bg-[${c.tile}] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[${c.slate}] disabled:opacity-50 transition-colors duration-100`,
    },
  ],
};

/* ---------- Input (flat theme) -------------------------------------------- */

const input = {
  input: `w-full ${FONT_SANS} text-sm text-[${c.slate}] bg-[${c.parchment}] border border-[${c.groutLight}] rounded-[2px] px-3 py-2.5 placeholder:text-[${c.fog}] hover:border-[${c.fog}] focus:outline-none focus:border-[${c.slate}] focus:ring-1 focus:ring-[${c.slate}] aria-invalid:border-[${c.oxide}] disabled:opacity-50 transition-colors duration-100`,
  inputContainer: `flex-1 relative w-full`,
  textarea: `w-full ${FONT_SANS} text-sm text-[${c.slate}] bg-[${c.parchment}] border border-[${c.groutLight}] rounded-[2px] px-3 py-2.5 placeholder:text-[${c.fog}] hover:border-[${c.fog}] focus:outline-none focus:border-[${c.slate}] focus:ring-1 focus:ring-[${c.slate}] resize-y min-h-[6rem] transition-colors duration-100`,
  confirmButtonContainer: `absolute right-0 top-0 bottom-0 hidden group-hover:flex items-center gap-1 pr-1`,
  editButton: `p-1 text-[${c.fog}] hover:text-[${c.slate}] cursor-pointer`,
  cancelButton: `p-1 text-[${c.fog}] hover:text-[${c.oxide}] cursor-pointer`,
  confirmButton: `p-1 text-[${c.verdigris}] hover:text-[${c.slate}] cursor-pointer`,
};

/* ---------- MultiSelect --------------------------------------------------- */

const multiselect = {
  options: { activeStyle: 0 },
  styles: [{
    name: 'default',
    view: `w-full h-full`,
    mainWrapper: `group relative block w-full h-full`,

    // Trigger
    inputWrapper: `relative flex flex-wrap items-center gap-1 w-full min-h-9 rounded-[2px] cursor-pointer pl-3 pr-7 py-1.5 border border-[${c.groutLight}] bg-[${c.parchment}] hover:border-[${c.fog}] ${FONT_SANS} text-sm text-[${c.slate}] focus-within:ring-1 focus-within:ring-[${c.slate}] focus-within:border-[${c.slate}] transition-colors duration-100`,
    caretWrapper: `pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2`,
    caretIcon: `w-4 h-4 stroke-[${c.graphite}]`,

    // Search input inside menu
    input: `block w-full appearance-none rounded-none focus:outline-none px-3 py-1.5 ${FONT_SANS} text-sm border-b border-[${c.groutLight}] bg-[${c.parchment}] text-[${c.slate}] placeholder:text-[${c.fog}]`,

    statusWrapper: `flex items-center ${FONT_SANS} text-sm text-[${c.graphite}]`,
    singleValue: `truncate ${FONT_SANS} text-sm text-[${c.slate}]`,
    singlePlaceholder: `truncate ${FONT_SANS} text-sm text-[${c.fog}]`,

    // Token chips (selected values in multi-select mode)
    tokenWrapper: `inline-flex items-center gap-x-1 rounded-[2px] px-2 py-0.5 ${FONT_MONO} text-xs font-normal bg-[${c.limestone}] text-[${c.slate}] border border-[${c.groutLight}] hover:bg-[${c.bone}] transition-colors duration-100 whitespace-nowrap`,
    removeIcon: `inline-flex items-center self-center cursor-pointer text-[${c.fog}] hover:text-[${c.oxide}]`,
    removeIconName: 'XMark',
    removeIconClass: `w-3 h-3`,

    // Menu shells
    menuWrapper: `isolate min-w-[var(--button-width,12rem)] p-1 rounded-none bg-[${c.parchment}] border border-[${c.groutLight}] shadow-[0_1px_2px_rgba(42,47,54,0.04)]`,
    alwaysOpenMenuWrapper: `w-full p-1 rounded-none z-20 bg-[${c.parchment}] border border-[${c.groutLight}]`,
    tabularMenuWrapper: `flex flex-row flex-wrap gap-1.5 p-1.5 w-full rounded-none z-20 bg-[${c.parchment}] border border-[${c.groutLight}]`,

    optionsWrapper: `mt-1 max-h-[300px] overflow-auto`,
    menuItem: `flex items-center gap-2 rounded-none cursor-pointer outline-none px-2 py-1.5 ${FONT_SANS} text-sm text-[${c.slate}] hover:bg-[${c.limestone}] transition-colors duration-100`,

    smartMenuWrapper: `flex flex-wrap gap-1`,
    smartMenuItem: `inline-flex items-center rounded-[2px] px-2 py-0.5 ${FONT_MONO} text-xs font-normal cursor-pointer bg-[${c.limestone}] text-[${c.slate}] hover:bg-[${c.bone}] border border-[${c.groutLight}] transition-colors duration-100`,

    error: `p-1 ${FONT_SANS} text-xs text-[${c.oxide}] font-medium`,
    selectedValueIconName: 'Check',
    selectedValueIcon: `w-4 h-4 text-[${c.oxide}]`,
  }],
};

/* ---------- Tabs ---------------------------------------------------------- */

const tabs = {
  options: { activeStyle: 0 },
  styles: [{
    name: 'default',
    wrapper: `w-full`,
    tabList: `flex items-center gap-0 border-b border-[${c.groutLight}]`,
    tab: `cursor-pointer ${FONT_SANS} text-sm font-medium px-4 py-2.5 text-[${c.graphite}] hover:text-[${c.slate}] border-b-2 border-transparent -mb-px transition-colors duration-100`,
    tabActive: `cursor-pointer ${FONT_SANS} text-sm font-medium px-4 py-2.5 text-[${c.slate}] border-b-2 border-[${c.slate}] -mb-px`,
    tabPanel: `pt-6`,
  }],
};

/* ---------- Switch -------------------------------------------------------- */

const switchTheme = {
  options: { activeStyle: 0 },
  styles: [{
    name: 'default',
    wrapper: `inline-flex items-center gap-2 cursor-pointer`,
    track: `relative w-9 h-5 bg-[${c.limestone}] border border-[${c.groutLight}] rounded-full transition-colors duration-100`,
    trackChecked: `relative w-9 h-5 bg-[${c.slate}] border border-[${c.slate}] rounded-full transition-colors duration-100`,
    thumb: `absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-[${c.parchment}] rounded-full transition-transform duration-100`,
    thumbChecked: `absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-[${c.parchment}] rounded-full translate-x-4 transition-transform duration-100`,
    label: `${FONT_SANS} text-sm text-[${c.slate}]`,
  }],
};

/* ---------- FieldSet ------------------------------------------------------ */

const field = {
  wrapper: `flex flex-col gap-1.5 mb-4`,
  label: `${FONT_SANS} text-sm font-medium text-[${c.slate}]`,
  description: `${FONT_SANS} text-xs text-[${c.graphite}]`,
  error: `${FONT_SANS} text-xs font-medium text-[${c.oxide}]`,
};

/* ---------- Label --------------------------------------------------------- */

const label = {
  label: `${FONT_SANS} text-sm font-medium text-[${c.slate}]`,
};

/* ---------- Icon ---------------------------------------------------------- */

const icon = {
  wrapper: `inline-flex items-center justify-center`,
  default: `w-4 h-4 stroke-[${c.slate}]`,
};

/* ---------- Dialog (flat theme) ------------------------------------------- */

const dialog = {
  dialogContainer: `fixed z-50 inset-0 w-screen overflow-y-auto pt-6 sm:pt-0`,
  backdrop: `fixed inset-0 bg-[${c.slate}]/40 pointer-events-none`,
  dialogContainer2: `relative grid min-h-full grid-rows-[1fr_auto] justify-items-center sm:grid-rows-[1fr_auto_3fr] sm:p-4`,
  dialogPanel: `row-start-2 w-full p-6 min-w-0 bg-[${c.parchment}] border border-[${c.groutLight}] shadow-[0_1px_2px_rgba(42,47,54,0.04)] rounded-none [--gutter:32px] sm:mb-auto`,
  sizes: {
    xs: 'sm:max-w-xs',
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl',
    '2xl': 'sm:max-w-2xl',
    '3xl': 'sm:max-w-3xl',
    '4xl': 'sm:max-w-4xl',
    '5xl': 'sm:max-w-5xl',
  },
};

/* ---------- Modal --------------------------------------------------------- */

const modal = {
  wrapper: `fixed inset-0 z-50 flex items-center justify-center p-4`,
  backdrop: `absolute inset-0 bg-[${c.slate}]/40`,
  panel: `relative bg-[${c.parchment}] border border-[${c.groutLight}] shadow-[0_1px_2px_rgba(42,47,54,0.04)] rounded-none p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto`,
  header: `flex items-center justify-between mb-4 pb-4 border-b border-[${c.groutLight}]`,
  title: `${FONT_DISPLAY} text-xl font-medium text-[${c.slate}]`,
  body: `${FONT_SANS} text-sm text-[${c.slate}]`,
  footer: `flex items-center justify-end gap-2 mt-6 pt-4 border-t border-[${c.groutLight}]`,
  closeButton: `cursor-pointer p-1 text-[${c.graphite}] hover:text-[${c.slate}]`,
};

/* ---------- DialogActions ------------------------------------------------- */
/* The brand action-bar wrapper rendered at the bottom of dialogs / modal
   forms (the row of "Confirm" / "Cancel" / "Apply" buttons). Mirrors
   modal.footer so a dialog's action bar matches the modal's own bottom
   rule treatment — same hairline border, same right-aligned gap. Consumed
   by every Lexical plugin dialog via `UI.DialogActions` from ThemeContext. */

const dialogActions = {
  wrapper: modal.footer,
};

/* ---------- Card (UI primitive, generic) ---------------------------------- */

const card = {
  wrapper: `bg-[${c.parchment}] border border-[${c.groutLight}] rounded-none p-6`,
  header: `pb-4 mb-4 border-b border-[${c.groutLight}]`,
  body: `${FONT_SANS} text-sm text-[${c.slate}]`,
  footer: `pt-4 mt-6 border-t border-[${c.groutLight}]`,
};

/* ---------- dataCard — the workhorse Card section ------------------------- */

const dataCard = {
  options: { activeStyle: 0 },
  styles: [{
    name: 'default',
    // Outer section wrapper
    wrapper: `w-full ${FONT_SANS} text-[${c.slate}]`,
    sectionTitle: `${FONT_DISPLAY} text-2xl font-medium text-[${c.slate}] mb-4`,

    // Cards-grid (outer grid; one cell per record)
    cardsGrid: `grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6`,

    // A single card
    card: `bg-[${c.parchment}] border border-[${c.groutLight}] rounded-none p-6 shadow-[0_1px_2px_rgba(42,47,54,0.04)]`,

    // Cells-grid (inner grid; one cell per column)
    cellsGrid: `grid grid-cols-12 gap-3`,

    // Per-cell wrappers
    headerValueWrapper: `flex flex-col gap-1 px-1 py-1`,
    headerValueWrapperFullBleed: `w-full relative overflow-hidden`,

    // Per-cell header (column label, optional)
    header: `${FONT_SANS} text-xs font-medium uppercase tracking-[0.08em] text-[${c.graphite}]`,

    // Per-cell value (the data)
    value: `${FONT_SANS} text-sm text-[${c.slate}] tabular-nums`,

    // Image cell
    image: `w-full h-auto object-cover`,
    imageContainer: `w-full overflow-hidden`,

    // Link cell
    link: `text-[${c.slate}] hover:text-[${c.oxide}] underline decoration-[${c.fog}] hover:decoration-[${c.oxide}] underline-offset-[3px]`,
    linkText: `${FONT_SANS} text-sm cursor-pointer`,
  }],
};

/* ---------- Pill ---------------------------------------------------------- */

const pill = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: 'default',
      wrapper: `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${FONT_SANS} text-xs font-medium bg-[${c.limestone}] text-[${c.graphite}] border border-[${c.groutLight}]`,
      zinc:  `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${FONT_SANS} text-xs font-medium bg-[${c.limestone}] text-[${c.graphite}] border border-[${c.groutLight}]`,
      blue:  `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${FONT_SANS} text-xs font-medium bg-transparent text-[${c.verdigris}] border border-[${c.verdigris}]`,
      green: `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${FONT_SANS} text-xs font-medium bg-transparent text-[${c.verdigris}] border border-[${c.verdigris}]`,
      amber: `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${FONT_SANS} text-xs font-medium bg-transparent text-[${c.ochre}] border border-[${c.ochre}]`,
      red:   `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${FONT_SANS} text-xs font-medium bg-transparent text-[${c.oxide}] border border-[${c.oxide}]`,
      slate: `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${FONT_SANS} text-xs font-medium bg-[${c.slate}] text-[${c.parchment}] border border-[${c.slate}]`,
    },
  ],
};

/* ---------- Table --------------------------------------------------------- */

const table = {
  options: { activeStyle: 0 },
  styles: [{
    name: 'default',
    wrapper: `w-full overflow-x-auto`,
    table: `w-full border-collapse ${FONT_SANS} text-sm tabular-nums text-[${c.slate}]`,
    thead: `border-b border-[${c.slate}]`,
    th: `text-left ${FONT_SANS} text-xs font-medium uppercase tracking-[0.08em] text-[${c.graphite}] px-3 py-2.5`,
    headerCell: `text-left ${FONT_SANS} text-xs font-medium uppercase tracking-[0.08em] text-[${c.graphite}] px-3 py-2.5`,
    headerCellSortable: `text-left ${FONT_SANS} text-xs font-medium uppercase tracking-[0.08em] text-[${c.graphite}] px-3 py-2.5 cursor-pointer hover:text-[${c.slate}]`,
    tr: `border-b border-[${c.groutLight}] hover:bg-[${c.limestone}] transition-colors duration-100`,
    trAlt: `border-b border-[${c.groutLight}] bg-[${c.bone}] hover:bg-[${c.limestone}] transition-colors duration-100`,
    td: `px-3 py-2.5 ${FONT_SANS} text-sm text-[${c.slate}]`,
    tdNum: `px-3 py-2.5 ${FONT_SANS} text-sm text-[${c.slate}] text-right tabular-nums`,
    tdEdit: `px-3 py-2.5 bg-[${c.parchment}]`,
    cellEditing: `bg-[${c.parchment}] outline-2 outline-[${c.slate}] -outline-offset-2`,
    pagination: `flex items-center justify-between gap-2 px-3 py-3 border-t border-[${c.groutLight}] ${FONT_SANS} text-xs text-[${c.graphite}]`,
  }],
};

/* ---------- Lexical (rich text) ------------------------------------------- */
/* IMPORTANT — Lexical uses FLAT keys (`heading_h1`, `text_bold`, `list_ol`)
   and the `options/styles` wrapper, NOT nested objects. The default DMS
   lexical theme also pre-populates `heading_h1..h6` with `font-display`
   utility classes — which means the textSettings.h1 backfill in
   getLexicalTheme() only fires when our override doesn't set them. So we
   set every heading + text key explicitly here in flat form. */

const lexical = {
  options: { activeStyle: 0 },
  styles: [{
    name: 'default',

    // Top-level scroller / shell — required for the editor chrome to layout
    editorScroller: 'min-h-[150px] border-0 flex relative outline-0 z-0 resize-y',
    viewScroller: 'border-0 flex relative outline-0 z-0 resize-none',
    editorContainer: 'relative block min-h-[50px]',
    editorShell: `${FONT_SANS} text-base leading-relaxed text-[${c.slate}]`,
    contentEditable: 'border-none relative [tab-size:1] outline-none outline-0',

    // Paragraphs
    paragraph: `${FONT_SANS} text-base leading-relaxed text-[${c.slate}] mb-4`,

    // Headings — flat keys mapped to the display token ladder.
    // h1 → displayHero (76px), h2 → displayXL (48), h3 → displayLG (36),
    // h4 → displayMD (28), h5 → displaySM (22), h6 → displayXS (18).
    //
    // Vertical rhythm: NO top margin (matches the design mockup's
    // `.hero-h1 { margin: 0 }` pattern; the gap above comes from the
    // preceding paragraph's mb). Bottom margins shrink down the ladder
    // — h1 needs visible breath below the hero, but h5/h6 are small
    // titles next to small body and shouldn't add a big gap before
    // their follow-up content.
    heading_h1: `${T.displayHero} mt-0 mb-4`,
    heading_h2: `${T.displayXL}   mt-0 mb-3`,
    heading_h3: `${T.displayLG}   mt-0 mb-3`,
    heading_h4: `${T.displayMD}   mt-0 mb-2`,
    heading_h5: `${T.displaySM}   mt-0 mb-1`,
    heading_h6: `${T.displayXS}   mt-0 mb-1`,

    // Lists
    list_ol: `${FONT_SANS} list-decimal pl-6 mb-4 marker:text-[${c.graphite}]`,
    list_ul: `${FONT_SANS} list-disc pl-6 mb-4 marker:text-[${c.graphite}]`,
    list_listitem: `${FONT_SANS} text-base leading-relaxed text-[${c.slate}] mb-1`,
    list_nested_listitem: 'list-none',

    // Inline link
    link: `text-[${c.slate}] underline decoration-[${c.fog}] hover:decoration-[${c.oxide}] underline-offset-[3px]`,

    // Inline text decorations
    text_bold: 'font-semibold',
    text_italic: 'italic',
    text_underline: 'underline underline-offset-[3px]',
    text_strikethrough: 'line-through',
    text_code: `${FONT_MONO} text-[0.92em] bg-[${c.limestone}] border border-[${c.groutLight}] px-1 py-0.5 rounded-[2px]`,

    // Block-level quote / code
    quote: `border-l-2 border-[${c.oxide}] pl-4 italic text-[${c.graphite}] ${FONT_DISPLAY} text-lg my-4`,
    code: `${FONT_MONO} text-sm bg-[${c.limestone}] border border-[${c.groutLight}] p-4 rounded-none overflow-x-auto my-4 text-[${c.slate}]`,

    // Horizontal rule. The codebase default ships `bg-[#ccc]` which doesn't
    // match any brand palette. Tessera renders the line in the brand's
    // groutLight (the same hairline divider color used in modals, table
    // separators, and section borders).
    hr_base: `p-[1px] border-none my-6 cursor-pointer relative`,
    hr_after: `absolute left-0 right-0 h-px bg-[${c.groutLight}] leading-[1px]`,

    // Column layout (Lexical's LayoutContainerNode + LayoutItemNode).
    // The codebase default layoutItem ships `px-2 py-4` which adds 16px
    // of vertical padding INSIDE each column — turning a row of two
    // buttons into a ~48px-tall block with lots of empty vertical
    // space above and below. Tessera wants the column layout to feel
    // tight: minimal item padding, smaller container gap.
    layoutContainer: 'grid gap-3 mt-2',
    layoutItem: 'min-w-0 max-w-full',
    layoutItemEditable: `border border-dashed border-[${c.groutLight}]`,
  }],

  // ----- Column-layout templates (theme-driven; see
  //   src/dms/packages/dms/src/ui/components/lexical/editor/plugins/LayoutPlugin/InsertLayoutDialog.tsx
  //   for the dialog that surfaces these). The codebase ships 6 generic
  //   Tailwind grid presets; tessera replaces them with templates that
  //   match the 12-col page grid AND adds a content-width preset for
  //   side-by-side CTAs (used by the marketing hero).
  layoutTemplates: [
    { label: '2 buttons side-by-side', value: 'grid-cols-1 md:grid-cols-[max-content_max-content_1fr]', count: 3 },
    { label: '2 columns (equal)',     value: 'grid-cols-1 md:grid-cols-2',            count: 2 },
    { label: '2 columns (1/3 + 2/3)', value: 'grid-cols-1 md:grid-cols-[1fr_2fr]',    count: 2 },
    { label: '2 columns (2/3 + 1/3)', value: 'grid-cols-1 md:grid-cols-[2fr_1fr]',    count: 2 },
    { label: '3 columns (equal)',     value: 'grid-cols-1 md:grid-cols-3',            count: 3 },
    { label: '4 columns (equal)',     value: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4', count: 4 },
  ],
};

/* ---------- Graph (legacy) and avlGraph ----------------------------------- */

const graphPaletteSeries = [
  c.oxide,      // 1 — terracotta (primary accent)
  c.verdigris,  // 2 — oxidized copper
  c.slate,      // 3 — ink
  c.ochre,      // 4 — warning ochre
  c.tile,       // 5 — deep tile red
];

const graph = {
  options: { activeStyle: 0 },
  styles: [{
    name: 'default',
    wrapper: `w-full ${FONT_SANS}`,
    title: `${FONT_DISPLAY} text-xl font-medium text-[${c.slate}] mb-4`,
    axis: `${FONT_MONO} text-xs text-[${c.graphite}]`,
    axisLabel: `${FONT_MONO} text-xs uppercase tracking-[0.06em] text-[${c.graphite}]`,
    grid: c.groutLight,
    tooltip: `bg-[${c.slate}] text-[${c.parchment}] ${FONT_SANS} text-xs px-2 py-1.5 rounded-none border border-[${c.slate}] tabular-nums`,
    legend: `${FONT_SANS} text-xs text-[${c.graphite}]`,
    palette: graphPaletteSeries,
  }],
};

const avlGraph = {
  options: { activeStyle: 0 },
  styles: [{
    name: 'default',
    wrapper: `w-full ${FONT_SANS}`,
    title: `${FONT_DISPLAY} text-xl font-medium text-[${c.slate}] mb-4`,
    axis: `${FONT_MONO} text-xs text-[${c.graphite}]`,
    axisLabel: `${FONT_MONO} text-xs uppercase tracking-[0.06em] text-[${c.graphite}]`,
    grid: c.groutLight,
    tooltip: `bg-[${c.slate}] text-[${c.parchment}] ${FONT_SANS} text-xs px-2 py-1.5 rounded-none border border-[${c.slate}] tabular-nums`,
    legend: `${FONT_SANS} text-xs text-[${c.graphite}]`,
    palette: graphPaletteSeries,
  }],
};

/* ---------- Map ----------------------------------------------------------- */

const map = {
  options: { activeStyle: 0 },
  styles: [{
    name: 'default',
    container: `w-full h-full relative bg-[${c.limestone}]`,
    controls: `absolute top-2 right-2 flex flex-col gap-1 bg-[${c.parchment}] border border-[${c.groutLight}] shadow-[0_1px_2px_rgba(42,47,54,0.04)]`,
    controlButton: `p-2 hover:bg-[${c.limestone}] cursor-pointer text-[${c.slate}]`,
    legend: `absolute bottom-3 left-3 bg-[${c.parchment}] border border-[${c.groutLight}] p-3 ${FONT_SANS} text-xs text-[${c.slate}] shadow-[0_1px_2px_rgba(42,47,54,0.04)]`,
    popover: `bg-[${c.parchment}] border border-[${c.groutLight}] p-3 ${FONT_SANS} text-sm text-[${c.slate}] shadow-[0_1px_2px_rgba(42,47,54,0.04)]`,
  }],
};

/* ---------- Pattern-level themes ------------------------------------------ */

const pagesTheme = {
  attribution: {
    options: { activeStyle: 0 },
    styles: [{
      name: 'default',
      wrapper: `inline-flex items-center gap-1.5 ${FONT_MONO} text-xs text-[${c.fog}]`,
      link: `text-[${c.graphite}] hover:text-[${c.slate}] underline decoration-[${c.fog}] underline-offset-[2px]`,
    }],
  },
  complexFilters: {
    groupWrapper: `border border-[${c.groutLight}] bg-[${c.bone}] p-3 mb-2`,
    leafWrapper: `flex items-center gap-2 mb-2`,
    operatorPill: `${FONT_MONO} text-xs uppercase tracking-[0.06em] text-[${c.graphite}] px-2 py-0.5 border border-[${c.groutLight}] bg-[${c.parchment}]`,
    addButton: `${FONT_SANS} text-xs text-[${c.slate}] hover:text-[${c.oxide}] cursor-pointer`,
    removeButton: `text-[${c.fog}] hover:text-[${c.oxide}] cursor-pointer p-1`,
  },
  searchButton: {
    options: { activeStyle: 0 },
    styles: [{
      name: 'default',
      button: `inline-flex items-center gap-2 px-3 py-1.5 border border-[${c.groutLight}] bg-[${c.parchment}] hover:border-[${c.fog}] cursor-pointer rounded-[2px] transition-colors duration-100`,
      buttonText: `${FONT_SANS} text-sm text-[${c.graphite}]`,
      icon: 'Search',
      iconWrapper: `w-4 h-4 stroke-[${c.graphite}]`,
    }],
  },
  searchPallet: {
    options: { activeStyle: 0 },
    styles: [{
      name: 'default',
      wrapper: `fixed inset-0 z-50 flex items-start justify-center pt-32`,
      backdrop: `absolute inset-0 bg-[${c.slate}]/40`,
      panel: `relative bg-[${c.parchment}] border border-[${c.groutLight}] shadow-[0_1px_2px_rgba(42,47,54,0.04)] max-w-2xl w-full mx-4`,
      input: `w-full ${FONT_SANS} text-base text-[${c.slate}] bg-transparent border-b border-[${c.groutLight}] px-4 py-3 focus:outline-none focus:border-[${c.slate}]`,
      results: `max-h-[60vh] overflow-y-auto`,
      result: `px-4 py-2.5 hover:bg-[${c.limestone}] cursor-pointer ${FONT_SANS} text-sm text-[${c.slate}] border-b border-[${c.groutLight}]`,
    }],
  },
  sectionGroupsPane: {
    wrapper: `${FONT_SANS} text-sm`,
    group: `border border-[${c.groutLight}] bg-[${c.bone}] p-3 mb-2`,
    groupHeader: `flex items-center justify-between gap-2 mb-2 pb-2 border-b border-[${c.groutLight}] ${FONT_SANS} text-xs uppercase tracking-[0.08em] text-[${c.graphite}]`,
    sectionItem: `flex items-center gap-2 px-2 py-1 hover:bg-[${c.limestone}] cursor-pointer`,
  },

  /* sectionArray — the inner grid inside each section_group.
     The codebase default caps `centered` at 1020px (max-w-[1020px] mx-auto),
     which is narrower than Tessera's --grid-max (1280px). Without this
     override every section_group renders a narrow centered column inside the
     wider parchment LayoutGroup, so text reads as "left-aligned inside an
     undersized box" rather than filling the surface.

     The right move per `creating-pages-from-a-design-pattern.md` §4.2 is to
     fix the DEFAULT so a new section_group looks right out of the gate —
     authors should not have to flip `full_width: 'show'` on every group. */
  sectionArray: {
    options: { activeStyle: 0 },
    styles: [{
      name: 'default',
      // 12-column grid (was the codebase default 6-column). Sections pick a
      // span 1..12 via the section's `size` field. Authors get fine-grained
      // width control in increments of 1/12 (8.3%) — wide enough for hero
      // bands at 7/12, side-by-side 6+6, or precise asymmetric splits.
      // _replace: ['sizes'] tells mergeComponentStyles to wholesale-replace
      // the sizes map instead of deep-merging — without it the codebase's
      // "1/3" / "1/2" / "2/3" / "1" keys leak through (and "1" gets
      // reinterpreted as "1 of 12" which would shrink every default
      // section to 8% width).
      _replace: ['sizes'],
      container: `w-full grid grid-cols-12`,
      gridSize: 12,
      // Per-section inner padding. Codebase default is `p-4` (16px). Combined
      // with the LayoutGroup wrapper2 padding (`p-6` = 24px) the visible
      // distance from the parchment edge to section text would be 40px,
      // which felt overstuffed at design scale. Dropping to `p-2` (8px) gives
      // 32px total — closer to the design mockup. Authors can override
      // per-section via the section's `padding` field (the menu offers
      // `p-0 / p-1 / p-2 / <theme default>`).
      sectionPadding: 'p-2',
      // `defaultSize` is what new sections (added via the editor's "+" button)
      // and sections without an explicit `size` field render at. The codebase
      // default is "1" — designed for the legacy 6-col grid where "1" meant
      // full width. In tessera's 12-col grid we need "12" so new sections
      // fill the band by default rather than shrinking to 8% width.
      defaultSize: '12',
      sizes: {
        "1":  { className: 'col-span-12 md:col-span-1',  iconSize: 8.3 },
        "2":  { className: 'col-span-12 md:col-span-2',  iconSize: 16.7 },
        "3":  { className: 'col-span-12 md:col-span-3',  iconSize: 25 },
        "4":  { className: 'col-span-12 md:col-span-4',  iconSize: 33.3 },
        "5":  { className: 'col-span-12 md:col-span-5',  iconSize: 41.7 },
        "6":  { className: 'col-span-12 md:col-span-6',  iconSize: 50 },
        "7":  { className: 'col-span-12 md:col-span-7',  iconSize: 58.3 },
        "8":  { className: 'col-span-12 md:col-span-8',  iconSize: 66.7 },
        "9":  { className: 'col-span-12 md:col-span-9',  iconSize: 75 },
        "10": { className: 'col-span-12 md:col-span-10', iconSize: 83.3 },
        "11": { className: 'col-span-12 md:col-span-11', iconSize: 91.7 },
        "12": { className: 'col-span-12 md:col-span-12', iconSize: 100 },
      },

      layouts: {
        centered: `max-w-[1280px] mx-auto`,   // matches --grid-max
        fullwidth: '',                          // unchanged — for the rare full-bleed band
      },
      // Re-skin the section-edit chrome to use brand colors instead of the
      // codebase default blue / orange.
      sectionEditHover: `absolute inset-0 border-2 border-transparent group-hover:border-[${c.slate}]/30 pointer-events-none z-10`,
      sectionEditing:   `absolute inset-0 border border-[${c.oxide}] border-dashed pointer-events-none z-10`,
      sectionHighlight: `absolute inset-0 border border-[${c.oxide}] border-dashed pointer-events-none z-10`,
      addSectionButton: `cursor-pointer py-0.5 text-sm text-[${c.fog}] hover:text-[${c.slate}] truncate w-full -ml-4 my-2 hidden group-hover:flex absolute -top-5 z-11`,
      addSectionIcon:   `size-6 p-1.5 text-[${c.parchment}] bg-[${c.slate}] rounded-full group-hover/icon:hidden`,
      addSectionText:   `px-1.5 py-1 text-[${c.parchment}] text-sm font-semibold bg-[${c.slate}] rounded-full`,
      border: {
        none:        '',
        full:        `border border-[${c.groutLight}] rounded-none`,
        openLeft:    `border border-[${c.groutLight}] border-l-transparent`,
        openRight:   `border border-[${c.groutLight}] border-r-transparent`,
        openTop:     `border border-[${c.groutLight}] border-t-transparent`,
        openBottom:  `border border-[${c.groutLight}] border-b-transparent`,
        borderX:     `border border-[${c.groutLight}] border-y-transparent`,
      },
    }],
  },
};

const datasetsTheme = {
  datasetsList: {
    options: { activeStyle: 0 },
    styles: [{
      name: 'default',
      wrapper: `${FONT_SANS}`,
      header: `flex items-center justify-between gap-4 mb-6 pb-4 border-b border-[${c.groutLight}]`,
      title: `${FONT_DISPLAY} text-3xl font-medium text-[${c.slate}]`,
      categoryNav: `flex flex-col gap-1 mb-4`,
      categoryItem: `${FONT_SANS} text-sm text-[${c.graphite}] hover:text-[${c.slate}] px-2 py-1.5 cursor-pointer`,
      categoryItemActive: `${FONT_SANS} text-sm text-[${c.slate}] bg-[${c.limestone}] px-2 py-1.5 border-l-2 border-[${c.oxide}] -ml-px cursor-pointer`,
      datasetGrid: `grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4`,
      datasetCard: `bg-[${c.parchment}] border border-[${c.groutLight}] p-5 hover:border-[${c.fog}] cursor-pointer rounded-none transition-colors duration-100`,
      datasetTitle: `${FONT_DISPLAY} text-lg font-medium text-[${c.slate}] mb-2`,
      datasetMeta: `${FONT_MONO} text-xs text-[${c.graphite}] uppercase tracking-[0.06em]`,
    }],
  },
  metadataComp: {
    wrapper: `${FONT_SANS} text-sm`,
    field: `flex items-center gap-3 py-2 border-b border-[${c.groutLight}]`,
    fieldLabel: `${FONT_MONO} text-xs uppercase tracking-[0.06em] text-[${c.graphite}] w-40 flex-shrink-0`,
    fieldValue: `${FONT_SANS} text-sm text-[${c.slate}]`,
  },
};

const authTheme = {
  login: {
    wrapper: `${FONT_SANS}`,
    title: `${FONT_DISPLAY} text-3xl font-medium text-[${c.slate}] mb-2 text-center`,
    subtitle: `${FONT_SANS} text-sm text-[${c.graphite}] mb-6 text-center`,
    form: `flex flex-col gap-4`,
    submitButton: `w-full inline-flex items-center justify-center px-4 py-2.5 ${FONT_SANS} text-sm font-medium bg-[${c.slate}] text-[${c.parchment}] hover:bg-[${c.groutDark}] cursor-pointer rounded-[2px] transition-colors duration-100`,
    altLink: `${FONT_SANS} text-sm text-[${c.graphite}] hover:text-[${c.slate}] text-center mt-4`,
  },
};

/* ---------- Admin namespace ----------------------------------------------- */
/* Class strings for admin pages (sites, themes, users, groups). Components
   read these via getComponentTheme(themeFromContext, 'admin'). */

const adminTheme = {
  // KPI strip
  kpiStrip: `grid border border-[${c.groutLight}] bg-[${c.parchment}] shadow-[0_2px_8px_rgba(42,47,54,0.08)]`,
  kpiCell: `px-6 py-5 border-r border-[${c.groutLight}] last:border-r-0`,
  kpiValue: `font-serif text-4xl font-medium text-[${c.slate}] tabular-nums leading-none mt-1`,
  kpiLabel: `font-mono text-xs uppercase tracking-[0.06em] text-[${c.graphite}]`,

  // Type badge (pattern_type)
  typeBadge: `inline-block px-2 py-0.5 border font-mono text-[10px] uppercase tracking-[0.06em] whitespace-nowrap`,
  typeBadgePage:      `text-[${c.verdigris}] border-[${c.verdigris}]`,
  typeBadgeDatasets:  `text-[${c.ochre}] border-[${c.ochre}]`,
  typeBadgeForms:     `text-[${c.graphite}] border-[${c.groutLight}] bg-[${c.limestone}]`,
  typeBadgeAuth:      `text-[${c.oxide}] border-[${c.oxide}]`,
  typeBadgeMapeditor: `text-[${c.graphite}] border-[${c.groutLight}]`,

  // Status dot
  statusDotActive:   `w-1.5 h-1.5 rounded-full bg-[${c.verdigris}] inline-block`,
  statusDotInactive: `w-1.5 h-1.5 rounded-full bg-[${c.fog}] inline-block`,
  statusDotPending:  `w-1.5 h-1.5 rounded-full bg-[${c.ochre}] inline-block`,

  // Subdomain pill
  subdomainPill:       `inline-flex items-center gap-1 px-2 py-0.5 bg-[${c.limestone}] border border-[${c.groutLight}] font-mono text-[11px] text-[${c.graphite}] rounded-full`,
  subdomainPillGlobal: `text-[${c.fog}] bg-transparent border-[${c.groutLight}]`,

  // Filter chips
  filterChip:       `inline-flex items-center gap-1.5 px-2.5 py-1 border border-[${c.groutLight}] font-mono text-[11px] uppercase tracking-[0.06em] text-[${c.graphite}] cursor-pointer rounded-full transition-colors duration-100 hover:bg-[${c.limestone}] hover:border-[${c.graphite}]`,
  filterChipActive: `bg-[${c.limestone}] border-[${c.slate}]`,

  // Avatar initials
  avatar: `w-7 h-7 inline-flex items-center justify-center font-sans text-[11px] font-semibold text-[${c.parchment}] flex-shrink-0`,

  // Avatar stack (groups page)
  avatarStack:         `flex`,
  avatarStackItem:     `w-6 h-6 rounded-full inline-flex items-center justify-center font-sans text-[10px] font-semibold text-[${c.parchment}] border-2 border-[${c.parchment}] -mr-1.5 last:mr-0 flex-shrink-0`,
  avatarStackOverflow: `bg-[${c.limestone}] text-[${c.graphite}]`,

  // Group pill (users page)
  groupPill:       `inline-flex items-center px-2 py-0.5 bg-[${c.limestone}] border border-[${c.groutLight}] font-mono text-[11px] text-[${c.graphite}] rounded-full whitespace-nowrap`,
  groupPillAdmin:  `bg-transparent border-[${c.oxide}] text-[${c.oxide}]`,
  groupPillEditor: `bg-transparent border-[${c.verdigris}] text-[${c.verdigris}]`,

  // Permission badge (groups page)
  permBadge:       `inline-flex items-center gap-1.5 px-2.5 py-0.5 border font-mono text-[10px] uppercase tracking-[0.06em] rounded-full whitespace-nowrap`,
  permBadgeAdmin:  `text-[${c.oxide}] border-[${c.oxide}]`,
  permBadgeEditor: `text-[${c.verdigris}] border-[${c.verdigris}]`,
  permBadgeViewer: `text-[${c.graphite}] border-[${c.groutLight}] bg-[${c.limestone}]`,
  permBadgePublic: `text-[${c.fog}] border-[${c.groutLight}]`,

  // System badge (non-deletable groups)
  systemBadge: `inline-block px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-[${c.fog}] border border-[${c.groutLight}]`,

  // Bulk action bar
  bulkBar:      `sticky bottom-0 z-10 flex items-center gap-3 px-4 py-3 bg-[${c.slate}] text-[${c.parchment}] shadow-[0_-2px_8px_rgba(0,0,0,0.15)]`,
  bulkBarCount: `font-mono text-xs uppercase tracking-[0.06em] text-[${c.fog}]`,

  // Tab strip
  tabStrip:    `flex items-end border-b border-[${c.groutLight}] gap-0 mb-4`,
  tab:         `px-4 py-2 font-sans text-sm font-medium text-[${c.graphite}] cursor-pointer border-b-2 border-transparent -mb-px transition-colors duration-100 hover:text-[${c.slate}] whitespace-nowrap`,
  tabActive:   `text-[${c.slate}] border-b-2 border-[${c.slate}]`,
  tabCount:    `inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-[${c.limestone}] border border-[${c.groutLight}] font-mono text-[10px] text-[${c.graphite}] ml-1.5 rounded-full`,

  // Theme cards (themes page)
  themeGrid:        `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4`,
  themeCard:        `bg-[${c.parchment}] border border-[${c.groutLight}] shadow-[0_2px_8px_rgba(42,47,54,0.08)] flex flex-col transition-[border-color] duration-100 hover:border-[${c.graphite}]`,
  themeCardPalette: `h-12 flex`,
  themeCardBody:    `p-4 flex-1`,
  themeCardName:    `font-serif text-xl font-medium text-[${c.slate}] mb-0.5`,
  themeCardMeta:    `font-mono text-[11px] uppercase tracking-[0.06em] text-[${c.fog}]`,
  themeCardFooter:  `px-4 py-3 border-t border-[${c.groutLight}] flex items-center justify-between gap-3`,
  themeUsageChip:   `inline-block px-2 py-0.5 bg-[${c.bone}] border border-[${c.groutLight}] font-mono text-[11px] text-[${c.graphite}]`,

  // Page-level containers
  pageHeader: `w-full flex items-center justify-between border-b border-[${c.groutLight}] pb-4 mb-4`,
  pageTitle:  `font-serif text-2xl font-medium text-[${c.slate}]`,

  // Toolbar (search + filter chips row beneath KPI strip)
  toolbar: `flex items-center gap-3 mt-5 mb-3`,

  // Group description (below group name)
  groupDescription: `font-mono text-[11px] text-[${c.fog}] mt-0.5`,

  // Permission matrix
  permMatrixSection: `mt-8 pt-6 border-t border-[${c.groutLight}]`,
  permMatrixTitle:   `font-serif text-lg font-medium text-[${c.slate}] mb-1`,
  permMatrixSubtitle:`font-sans text-sm text-[${c.graphite}] mb-4`,
  permMatrixTable:   `w-full border border-[${c.groutLight}] text-sm`,
  permMatrixHeaderRow: `bg-[${c.bone}] border-b border-[${c.groutLight}]`,
  permMatrixHeaderCell:`px-4 py-3 font-mono text-[10px] uppercase tracking-[0.06em] text-[${c.graphite}] text-center`,
  permMatrixHeaderFirst:`px-4 py-3 font-mono text-[10px] uppercase tracking-[0.06em] text-[${c.graphite}]`,
  permMatrixRow:     `border-b border-[${c.groutLight}] last:border-0`,
  permMatrixRowAlt:  `border-b border-[${c.groutLight}] last:border-0 bg-[${c.bone}]`,
  permMatrixCapability:`px-4 py-3 font-sans text-sm text-[${c.slate}]`,
  permMatrixCell:    `px-4 py-3 text-center`,
  permCheckYes:      `mx-auto w-5 h-5 rounded-full bg-[${c.verdigris}] flex items-center justify-center`,
  permCheckPartial:  `mx-auto w-5 h-5 rounded-full bg-[${c.ochre}] flex items-center justify-center`,
  permCheckNo:       `mx-auto w-5 h-5 rounded-full border border-[${c.groutLight}] bg-[${c.limestone}]`,
};

/* ---------- Icons registry ------------------------------------------------ */
/* For DMS, icons are referenced by name; the actual component map is wired
   up by the host site. This export gives the brand its named icon set —
   downstream code maps names to React components (Lucide is the working
   set per `Tessera Design System/README.md`). */

const Icons = {};   // populated by host site / icons.js

/* ---------- Theme-registered column types (none for v0.1) ----------------- */

const columnTypes = {
  type_badge:     { ViewComp: TypeBadgeView,     EditComp: TypeBadgeEdit },
  subdomain_pill: { ViewComp: SubdomainPillView, EditComp: SubdomainPillEdit },
  user_avatar:    { ViewComp: UserAvatarView,    EditComp: UserAvatarEdit },
  group_pill:     { ViewComp: GroupPillView,     EditComp: GroupPillEdit },
  perm_badge:     { ViewComp: PermBadgeView,     EditComp: PermBadgeEdit },
  avatar_stack:   { ViewComp: AvatarStackView,   EditComp: () => null },
};

/* ---------- Page components registered via theme (none for v0.1) ---------- */

const pageComponents = {};

/* ---------- Fonts --------------------------------------------------------- */
/* Loaded into <head> by ui/useTheme.js#loadThemeFonts when the theme is
   resolved (called from getPatternTheme). Keeps font wiring inside the
   theme so a site that selects this theme automatically pulls Newsreader,
   IBM Plex Sans, and IBM Plex Mono — no per-site index.css edits needed. */

/* Tiempos — the brand's licensed display family. Files live in
   src/themes/tessera/fonts/tiempos-font-family/ and are exposed to the
   browser via a symlink at public/fonts/tessera/tiempos/.
   Two optical-size cuts in use:
     - Tiempos Headline → display sizes 18–48px (most tokens)
     - Tiempos Fine     → very large display 60+px (displayHero,
                          displayItalicHero) — finer hairlines look
                          intentional at hero size
   We register 6 weights × 2 italics for each cut. Format is OpenType
   (.otf) because the supplied files are .otf; for production, convert to
   .woff2 for ~50% smaller payload. */
const TIEMPOS_DIR = '/fonts/tessera/tiempos';
const tiemposFace = (family, weight, italic, file) => ({
  type: 'face',
  family,
  weight,
  style: italic ? 'italic' : 'normal',
  display: 'swap',
  sources: [{ url: `${TIEMPOS_DIR}/${file}`, format: 'opentype' }],
});

const fonts = [
  // 1a. Tiempos Headline — display 18–48
  tiemposFace('Tiempos Headline', 400, false, 'TestTiemposHeadline-Regular-BF66457a508e31a.otf'),
  tiemposFace('Tiempos Headline', 400, true,  'TestTiemposHeadline-RegularItalic-BF66457a5091d70.otf'),
  tiemposFace('Tiempos Headline', 500, false, 'TestTiemposHeadline-Medium-BF66457a509b4ec.otf'),
  tiemposFace('Tiempos Headline', 500, true,  'TestTiemposHeadline-MediumItalic-BF66457a50b4260.otf'),
  tiemposFace('Tiempos Headline', 600, false, 'TestTiemposHeadline-Semibold-BF66457a509040b.otf'),
  tiemposFace('Tiempos Headline', 600, true,  'TestTiemposHeadline-SemiboldItalic-BF66457a510c462.otf'),

  // 1b. Tiempos Fine — for the very largest display sizes only.
  tiemposFace('Tiempos Fine', 400, false, 'TestTiemposFine-Regular-BF66457a50e8bc9.otf'),
  tiemposFace('Tiempos Fine', 400, true,  'TestTiemposFine-RegularItalic-BF66457a50e36f9.otf'),
  tiemposFace('Tiempos Fine', 500, false, 'TestTiemposFine-Medium-BF66457a50e62cd.otf'),
  tiemposFace('Tiempos Fine', 500, true,  'TestTiemposFine-MediumItalic-BF66457a511be83.otf'),
  tiemposFace('Tiempos Fine', 600, false, 'TestTiemposFine-Semibold-BF66457a50f016a.otf'),
  tiemposFace('Tiempos Fine', 600, true,  'TestTiemposFine-SemiboldItalic-BF66457a50b0e18.otf'),

  // 2. Plex Sans + Plex Mono from Google Fonts; Newsreader stays as a
  //    fallback for the Tiempos faces. Same `opsz` reasoning as before
  //    for Newsreader — gives the fallback the right glyph cut at any
  //    rendered size if Tiempos is unavailable.
  {
    type: 'google',
    href: 'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap',
  },

  // 2. Register the brand families with Tailwind 4 via @theme.
  //    The project loads @tailwindcss/browser@4 at the bottom of index.html
  //    which scans for <style type="text/tailwindcss"> blocks and processes
  //    their directives. Declaring `--font-X` in @theme makes Tailwind:
  //      (a) emit the corresponding .font-X utility class with the right stack
  //      (b) set --default-font-family to var(--font-sans) so the body picks
  //          up the brand sans by default
  //    This is the canonical Tailwind 4 way to register font config — no
  //    custom `.font-serif { font-family: … }` overrides needed.
  {
    type: 'tailwind',
    id: 'tessera-tw-theme',
    content: `
      @theme {
        --font-sans: "IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, sans-serif;
        --font-serif: "Tiempos Headline", "Newsreader", ui-serif, Georgia, serif;
        --font-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
        /* The default DMS lexical theme uses .font-display for headings.
           Tailwind 4 doesn't ship that token, so register it here pointing
           at our display serif. */
        --font-display: "Tiempos Headline", "Newsreader", ui-serif, Georgia, serif;
        /* Tiempos Fine is the cut for very large display sizes (60+px).
           displayHero / displayItalicHero tokens use this; everything
           else uses Headline. */
        --font-fine: "Tiempos Fine", "Tiempos Headline", "Newsreader", ui-serif, Georgia, serif;
        --default-font-family: "IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, sans-serif;
      }
    `,
  },

  // 3. Belt-and-braces: a runtime CSS override that also sets the CSS
  //    variables at :root, plus literal `.font-*` rules. This catches
  //    the case where the build-time Tailwind bundle (loaded via
  //    @tailwindcss/vite) sets its own :root variables after the runtime
  //    Tailwind has compiled @theme — without this, the build-time vars
  //    can shadow ours.
  {
    type: 'style',
    id: 'tessera-font-stacks',
    content: `
      :root, :host {
        --font-sans: "IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, sans-serif;
        --font-serif: "Tiempos Headline", "Newsreader", ui-serif, Georgia, serif;
        --font-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
        --font-display: "Tiempos Headline", "Newsreader", ui-serif, Georgia, serif;
        --font-fine: "Tiempos Fine", "Tiempos Headline", "Newsreader", ui-serif, Georgia, serif;
        --default-font-family: "IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, sans-serif;
      }
      html, body { font-family: var(--font-sans); }
      .font-serif   { font-family: var(--font-serif); }
      .font-sans    { font-family: var(--font-sans); }
      .font-mono    { font-family: var(--font-mono); }
      .font-display { font-family: var(--font-display); }
      .font-fine    { font-family: var(--font-fine); }
      /* Newsreader (the Tiempos fallback) auto-picks its opsz cut by
         rendered size. Tiempos is delivered as three discrete optical
         masters (Fine/Headline/Text) so it doesn't need this — but the
         rule is harmless on Tiempos and helps when the fallback kicks in. */
      :where(.font-serif, .font-display, .font-fine) { font-optical-sizing: auto; font-synthesis: none; }
    `,
  },
];

/* ---------- Compose ------------------------------------------------------- */

const tesseraTheme = {
  // Foundation
  textSettings,
  Icons,
  fonts,

  // Composition
  layout,
  layoutGroup,

  // Navigation
  topnav,
  sidenav,
  navigableMenu,
  nestable,
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
  dialogActions,
  modal,

  // Containers / atoms
  dataCard,
  card,
  pill,
  icon,

  // Rich content / data
  lexical,
  graph,
  avlGraph,
  map,
  table,

  // Pattern-level
  pages: pagesTheme,
  datasets: datasetsTheme,
  auth: authTheme,
  admin: adminTheme,

  // Theme-registered column types and page components (extension slots)
  columnTypes,
  pageComponents,
};

export default tesseraTheme;
