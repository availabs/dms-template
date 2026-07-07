/* =============================================================================
   Tessera — DMS Theme v6 · "Graph Paper"

   The v6 design system (src/themes/tessera/design_system_v6/) translated into
   the `options/styles` shape DMS theme primitives expect. Structure mirrors
   the worked example `tessera-theme.js` (v2) key-for-key; every class value
   is re-skinned to the v6 language: paper surfaces, hairline rules, one
   cobalt accent, IBM Plex Sans/Mono (+ Caveat margin voice), 6px controls /
   8px cards, borders over shadows.

   Read together with:
   - src/dms/skills/translating-design-system-to-dms-theme.md
   - src/themes/tessera/design_system_v6/README.md
   - src/themes/tessera/design_system_v6/theme/README.md   (translation notes)

   Light + dark with ONE set of class strings:
   - Every color is a `var(--t-*)` custom property; `[data-theme="dark"]` on
     <html> swaps the whole palette (markup never changes). The canonical
     `_shared.css` is injected via the theme's `fonts` array (type: 'style'),
     so a site that selects this theme needs no index.css edits.
   - Slash-opacity utilities (bg-x/10) don't work on var() colors — use the
     `*-soft` custom properties instead.
   - Exception: graph/avlGraph `palette` + `grid` are hex (SVG presentation
     attributes can't resolve var()); they ship the light-lamp values.

   Known v0 gaps (see README notes at the bottom of this file's summary):
   - Logo renders the wordmark as text (no SVG asset exported yet).
   - The t6-joint squares and edge-pattern rails are mockup chrome the theme
     can't inject via class strings; bands ship without them.
   ============================================================================= */

import {
  TypeBadgeView, TypeBadgeEdit,
  SubdomainPillView, SubdomainPillEdit,
  UserAvatarView, UserAvatarEdit,
  GroupPillView, GroupPillEdit,
  PermBadgeView, PermBadgeEdit,
  AvatarStackView,
} from './admin.columnTypes';

import { icons } from './design_system_v6/theme/icons.js';
import sharedCss from './design_system_v6/_shared.css?raw';

/* ---------- Palette — var()-backed (light+dark from _shared.css) ---------- */

const c = {
  // Surfaces
  paper:      'var(--t-paper)',
  panel:      'var(--t-panel)',
  well:       'var(--t-well)',

  // Ink
  ink:        'var(--t-ink)',
  graphite:   'var(--t-graphite)',
  pencil:     'var(--t-pencil)',

  // Rules
  rule:       'var(--t-rule)',
  ruleStrong: 'var(--t-rule-strong)',
  grid:       'var(--t-grid)',

  // THE accent
  cobalt:     'var(--t-cobalt)',
  cobaltDeep: 'var(--t-cobalt-deep)',
  cobaltSoft: 'var(--t-cobalt-soft)',
  cobaltLine: 'var(--t-cobalt-line)',
  accentInk:  'var(--t-accent-ink)',

  // Status
  go:         'var(--t-go)',
  goSoft:     'var(--t-go-soft)',
  amber:      'var(--t-amber)',
  amberSoft:  'var(--t-amber-soft)',
  brick:      'var(--t-brick)',
  brickSoft:  'var(--t-brick-soft)',
  marker:     'var(--t-marker)',
  markerSoft: 'var(--t-marker-soft)',

  // Board (code panes — dark in both lamps)
  board:      'var(--t-board)',
  board2:     'var(--t-board-2)',
  chalk:      'var(--t-chalk)',
  chalkDim:   'var(--t-chalk-dim)',

  scrim:      'var(--t-scrim)',
  shadowLift: 'var(--t-shadow-lift)',
  shadowDrag: 'var(--t-shadow-drag)',
};

const FONT_SANS = 'font-sans';   // IBM Plex Sans — display AND prose in v6
const FONT_MONO = 'font-mono';   // IBM Plex Mono — the chrome voice
const FONT_NOTE = 'font-note';   // Caveat — the margin voice (never UI chrome)

/* ---------- Brand token strings (the 15-token system, theme.html#type) -----
   The `.t-*` classes live in the injected _shared.css; tokens compose them
   with ink color + scroll offsets so they're complete on their own. */

const T = {
  // Display — IBM Plex Sans 600, tight tracking
  displayHero: `t-displayHero text-[${c.ink}] scroll-mt-36`,
  displayXL:   `t-displayXL   text-[${c.ink}] scroll-mt-36`,
  displayLG:   `t-displayLG   text-[${c.ink}] scroll-mt-36`,
  displayMD:   `t-displayMD   text-[${c.ink}] scroll-mt-36`,
  displaySM:   `t-displaySM   text-[${c.ink}] scroll-mt-36`,

  // Prose — IBM Plex Sans 400
  proseLG: `t-proseLG text-[${c.ink}]`,
  prose:   `t-prose   text-[${c.ink}]`,
  proseSM: `t-proseSM text-[${c.ink}]`,
  proseXS: `t-proseXS text-[${c.ink}]`,

  // Meta — IBM Plex Mono (eyebrows, badges, code, tables of fact)
  metaLG: `t-metaLG text-[${c.ink}]`,
  metaMD: `t-metaMD text-[${c.graphite}]`,
  metaSM: `t-metaSM text-[${c.pencil}]`,
  metaXS: `t-metaXS text-[${c.pencil}]`,

  // Note — Caveat margin voice. Authors may use it in Cards; never UI chrome.
  noteLG: `t-noteLG text-[${c.graphite}]`,
  noteMD: `t-noteMD text-[${c.graphite}]`,
};

/* ---------- textSettings — global type scale ------------------------------ */

const textSettings = {
  options: {
    activeStyle: 0,
    // Only the 15 brand tokens surface as `/Style: <key>` slash options.
    slashKeys: [
      'displayHero', 'displayXL', 'displayLG', 'displayMD', 'displaySM',
      'proseLG', 'prose', 'proseSM', 'proseXS',
      'metaLG', 'metaMD', 'metaSM', 'metaXS',
      'noteLG', 'noteMD',
    ],
  },
  styles: [{
    name: 'default',

    // ----- Brand tokens (15) — see design-system/theme.html#type -----------
    displayHero: T.displayHero,
    displayXL:   T.displayXL,
    displayLG:   T.displayLG,
    displayMD:   T.displayMD,
    displaySM:   T.displaySM,
    proseLG:     T.proseLG,
    prose:       T.prose,
    proseSM:     T.proseSM,
    proseXS:     T.proseXS,
    metaLG:      T.metaLG,
    metaMD:      T.metaMD,
    metaSM:      T.metaSM,
    metaXS:      T.metaXS,
    noteLG:      T.noteLG,
    noteMD:      T.noteMD,

    // ----- Heading roles — h1..h6 across the display ladder -----------------
    // v6 has five display sizes; h5 and h6 share displaySM (the smallest).
    h1: T.displayHero,
    h2: T.displayXL,
    h3: T.displayLG,
    h4: T.displayMD,
    h5: T.displaySM,
    h6: T.displaySM,

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
    textXL:           `${FONT_SANS} text-xl font-medium tracking-[-0.01em]`,
    textXLReg:        `${FONT_SANS} text-xl font-normal tracking-[-0.01em]`,
    textXLSemiBold:   `${FONT_SANS} text-xl font-semibold tracking-[-0.01em]`,
    textXLBold:       `${FONT_SANS} text-xl font-semibold tracking-[-0.01em]`,
    text2XL:          `${FONT_SANS} text-2xl font-semibold leading-tight tracking-[-0.015em]`,
    text2XLReg:       `${FONT_SANS} text-2xl font-normal leading-tight tracking-[-0.015em]`,
    text2XLSemiBold:  `${FONT_SANS} text-2xl font-semibold leading-tight tracking-[-0.015em]`,
    text2XLBold:      `${FONT_SANS} text-2xl font-semibold leading-tight tracking-[-0.015em]`,
    text3XL:          `${FONT_SANS} text-3xl font-semibold leading-tight tracking-[-0.02em]`,
    text3XLReg:       `${FONT_SANS} text-3xl font-normal leading-tight tracking-[-0.02em]`,
    text3XLSemiBold:  `${FONT_SANS} text-3xl font-semibold leading-tight tracking-[-0.02em]`,
    text3XLBold:      `${FONT_SANS} text-3xl font-semibold leading-tight tracking-[-0.02em]`,
    text4XL:          `${FONT_SANS} text-4xl font-semibold leading-tight tracking-[-0.025em]`,
    text4XLBold:      `${FONT_SANS} text-4xl font-bold leading-tight tracking-[-0.025em]`,
    text5XL:          `${FONT_SANS} text-5xl font-semibold leading-none tracking-[-0.025em]`,
    text5XLBold:      `${FONT_SANS} text-5xl font-bold leading-none tracking-[-0.025em]`,
    text6XL:          `${FONT_SANS} text-6xl font-semibold leading-none tracking-[-0.03em]`,
    text7XL:          `${FONT_SANS} text-7xl font-semibold leading-none tracking-[-0.03em]`,
    text8XL:          `${FONT_SANS} text-8xl font-semibold leading-none tracking-[-0.03em]`,

    // Semantic aliases
    body:      `${FONT_SANS} text-base font-normal leading-relaxed text-[${c.ink}]`,
    bodySmall: `${FONT_SANS} text-sm font-normal leading-relaxed text-[${c.ink}]`,
    caption:   `${FONT_SANS} text-xs font-normal text-[${c.graphite}]`,
    label:     `${FONT_SANS} text-sm font-medium text-[${c.ink}]`,

    // Designator (mono eyebrow; consumed by section labels)
    designator: `${FONT_MONO} text-[11px] font-medium uppercase tracking-[0.06em] text-[${c.graphite}]`,
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
      outerWrapper: `bg-[${c.paper}]`,
      wrapper: `relative isolate flex min-h-svh w-full max-lg:flex-col`,
      wrapper2: `flex-1 flex items-start flex-col items-stretch max-w-full min-h-screen`,
      wrapper3: `flex flex-1 items-start`,
      childWrapper: `flex-1 flex flex-col h-full`,
    },
    {
      name: 'app',
      outerWrapper: `bg-[${c.paper}]`,
      wrapper: `relative isolate flex min-h-svh w-full max-lg:flex-col`,
      wrapper2: `flex-1 flex items-start flex-col items-stretch max-w-full min-h-screen`,
      wrapper3: `flex flex-1 items-start`,
      childWrapper: `flex-1 flex flex-col h-full bg-[${c.paper}]`,
    },
    {
      name: 'bare',
      outerWrapper: `bg-[${c.paper}]`,
      wrapper: `relative isolate flex min-h-svh w-full`,
      wrapper2: `flex-1 flex flex-col w-full min-h-screen`,
      wrapper3: `flex flex-1`,
      childWrapper: `flex-1 flex flex-col h-full`,
    },
  ],
};

/* ---------- LayoutGroup — the v6 band model -------------------------------- */
/* Bands sit flat on paper, separated by hairline rules; NO boxed cards.
   Product bands hug the SideNav (mr-auto — see the skill §3.1.55); only
   `auth` centres. The `feature` band carries the fading 24px sheet grid via
   the injected `.t6-band-sheet` utility; `board` is the dark code-pane band
   (dark in both lamps). */

const layoutGroup = {
  options: { activeStyle: 0 },
  styles: [
    {
      // The default content band — flat paper, hairline bottom rule.
      name: 'content',
      wrapper1: `w-full flex flex-row border-b border-[${c.rule}]`,
      wrapper2: `flex flex-1 w-full flex-col relative max-w-[1200px] mr-auto pl-6 lg:pl-12 pr-6 lg:pr-8 py-8 ${FONT_SANS} text-base font-normal leading-relaxed text-[${c.ink}] min-h-[100px]`,
      wrapper3: '',
    },
    {
      // Page-title band — same surface, more head-room.
      name: 'header',
      wrapper1: `w-full flex flex-row border-b border-[${c.rule}]`,
      wrapper2: `flex flex-1 w-full flex-col relative max-w-[1200px] mr-auto pl-6 lg:pl-12 pr-6 lg:pr-8 pt-12 pb-8 ${FONT_SANS} text-[${c.ink}]`,
      wrapper3: '',
    },
    {
      // Feature band — the sheet grid appears (and dissolves into paper).
      name: 'feature',
      wrapper1: `w-full flex flex-row border-b border-[${c.rule}] t6-band-sheet`,
      wrapper2: `flex flex-1 w-full flex-col relative max-w-[1200px] mr-auto pl-6 lg:pl-12 pr-6 lg:pr-8 py-12 ${FONT_SANS} text-[${c.ink}]`,
      wrapper3: '',
    },
    {
      // Board band — the dark drafting board (does not invert in dark mode).
      name: 'board',
      wrapper1: `w-full flex flex-row t6-board`,
      wrapper2: `flex flex-1 w-full flex-col relative max-w-[1200px] mr-auto pl-6 lg:pl-12 pr-6 lg:pr-8 py-12 ${FONT_SANS} text-[${c.chalk}]`,
      wrapper3: '',
    },
    {
      // Centred sign-in / sign-up panel — the one intentionally centred band.
      name: 'auth',
      wrapper1: `w-full flex-1 flex flex-row p-6 items-center justify-center min-h-[80vh]`,
      wrapper2: `flex flex-col bg-[${c.panel}] border border-[${c.rule}] rounded-lg relative ${FONT_SANS} text-base font-normal leading-relaxed p-10 w-full max-w-md text-[${c.ink}]`,
      wrapper3: '',
    },
    {
      // Footer band — hairline top rule, quiet.
      name: 'footer',
      wrapper1: `w-full flex flex-row border-t border-[${c.rule}] mt-12`,
      wrapper2: `flex flex-1 w-full flex-col max-w-[1200px] mr-auto pl-6 lg:pl-12 pr-6 lg:pr-8 py-10`,
      wrapper3: '',
    },
  ],
};

/* ---------- TopNav -------------------------------------------------------- */
/* Keys mirror TopNav.theme.jsx — anything else silently no-ops. Nav items
   speak mono (the chrome voice); active = ink, no underline chrome. */

const topnav = {
  options: { activeStyle: 0, maxDepth: 2 },
  styles: [{
    name: 'default',

    layoutContainer1: `sticky top-0 z-40`,
    layoutContainer2: `w-full bg-[${c.paper}] border-b border-[${c.rule}]`,

    topnavWrapper: `w-full h-16 flex items-center px-6`,
    topnavContent: `flex items-center w-full h-full max-w-[1200px] mx-auto justify-between gap-4`,

    leftMenuContainer: `flex items-center gap-6`,
    centerMenuContainer: `hidden lg:flex items-center flex-1 h-full overflow-visible gap-1`,
    rightMenuContainer: `hidden md:flex h-full items-center gap-3 min-w-[200px] justify-end`,
    mobileNavContainer: `px-6 py-3 bg-[${c.paper}] border-b border-[${c.rule}]`,

    mobileButton: `lg:hidden inline-flex items-center justify-center w-8 h-8 rounded-md border border-[${c.rule}] text-[${c.graphite}] hover:text-[${c.ink}] hover:border-[${c.ruleStrong}] cursor-pointer transition-colors duration-150`,
    menuOpenIcon: `Menu`,
    menuCloseIcon: `XMark`,

    navitemWrapper: `relative`,
    navitemWrapper_level_2: `relative`,
    navitemWrapper_level_3: ``,

    navitem: `flex items-center gap-1.5 cursor-pointer ${FONT_MONO} text-[13px] font-medium px-3 py-1.5 text-[${c.graphite}] hover:text-[${c.ink}] transition-colors duration-150`,
    navitemActive: `flex items-center gap-1.5 cursor-pointer ${FONT_MONO} text-[13px] font-medium px-3 py-1.5 text-[${c.ink}]`,

    navIcon: `w-4 h-4 text-[${c.graphite}]`,
    navIconActive: `w-4 h-4 text-[${c.cobalt}]`,

    navitemContent: `flex items-center gap-1.5`,
    navitemName: ``,
    navitemName_level_2: `w-full ${FONT_SANS} text-sm font-medium text-[${c.ink}] hover:bg-[${c.well}] py-2 px-3 cursor-pointer flex items-center justify-between gap-2 rounded-md transition-colors duration-150`,
    navitemName_level_3: `w-full ${FONT_SANS} text-sm font-normal text-[${c.graphite}] hover:text-[${c.ink}] hover:bg-[${c.well}] py-1.5 px-3 cursor-pointer rounded-md transition-colors duration-150`,

    navitemDescription: `hidden`,
    navitemDescription_level_2: `${FONT_SANS} text-xs text-[${c.graphite}] mt-0.5`,
    navitemDescription_level_3: `${FONT_SANS} text-xs text-[${c.pencil}] mt-0.5`,

    indicatorIconWrapper: `w-3.5 h-3.5 text-[${c.graphite}]`,
    indicatorIcon: `ChevronDown`,
    indicatorIconOpen: `ChevronDown`,

    subMenuWrapper: `absolute top-full left-0 mt-1 z-40`,
    subMenuWrapper2: `bg-[${c.panel}] border border-[${c.rule}] rounded-lg py-1 min-w-[14rem] shadow-[${c.shadowDrag}]`,

    subMenuWrapper_level_2: `absolute left-full top-0 ml-1 z-40`,
    subMenuWrapper2_level_2: `bg-[${c.panel}] border border-[${c.rule}] rounded-lg py-1 min-w-[14rem] shadow-[${c.shadowDrag}]`,

    subMenuItemsWrapper: `flex flex-col px-1`,
    subMenuItemsWrapperParent: `flex flex-col px-1`,

    subMenuParentWrapper: `hidden`,
    subMenuParentContent: `px-3 py-2 border-b border-[${c.rule}] mb-1`,
    subMenuParentName: `${FONT_MONO} text-[11px] font-medium uppercase tracking-[0.06em] text-[${c.pencil}]`,
    subMenuParentDesc: `${FONT_SANS} text-xs text-[${c.pencil}] mt-0.5`,
    subMenuParentLink: `${FONT_SANS} text-xs text-[${c.cobalt}] hover:text-[${c.cobaltDeep}] underline underline-offset-[2px] mt-1 inline-block`,
  }],
};

/* ---------- SideNav ------------------------------------------------------- */
/* Keys mirror SideNav.theme.jsx. The active treatment is the docs-sidenav
   look: cobalt-soft fill + cobalt text, rounded-md rows. */

const sidenav = {
  options: { activeStyle: 0 },
  styles: [{
    name: 'default',

    layoutContainer1: `lg:pl-60`,
    layoutContainer2: `fixed inset-y-0 left-0 w-60 max-lg:hidden`,

    logoWrapper: `flex items-center h-14 px-5 border-b border-[${c.rule}] bg-[${c.paper}]`,

    sidenavWrapper: `flex flex-col w-60 h-full bg-[${c.paper}] border-r border-[${c.rule}]`,

    menuItemWrapper: `flex flex-1 flex-col gap-px`,
    menuItemWrapper_level_1: ``,
    menuItemWrapper_level_2: `ml-4 border-l border-[${c.rule}]`,
    menuItemWrapper_level_3: `ml-4 border-l border-[${c.rule}]`,
    menuItemWrapper_level_4: `ml-4`,

    navitemSide: `
      group w-full flex items-center gap-2.5 px-2 py-1.5 mx-1 rounded-md
      ${FONT_SANS} text-sm font-normal text-[${c.graphite}]
      hover:bg-[${c.well}] hover:text-[${c.ink}]
      cursor-pointer transition-colors duration-150`,
    navitemSideActive: `
      group w-full flex items-center gap-2.5 px-2 py-1.5 mx-1 rounded-md
      ${FONT_SANS} text-sm font-medium text-[${c.cobalt}]
      bg-[${c.cobaltSoft}]
      cursor-pointer`,

    menuIconSide: `w-4 h-4 text-[${c.graphite}] group-hover:text-[${c.ink}] transition-colors duration-150`,
    menuIconSideActive: `w-4 h-4 text-[${c.cobalt}]`,

    forcedIcon: ``,
    forcedIcon_level_1: ``,
    forcedIcon_level_2: ``,
    forcedIcon_level_3: ``,
    forcedIcon_level_4: ``,

    itemsWrapper: `flex-1 overflow-y-auto px-2 py-4`,

    navItemContent: `flex items-center gap-2 flex-1`,
    navItemContent_level_1: ``,
    navItemContent_level_2: `${FONT_SANS} text-sm font-normal`,
    navItemContent_level_3: `${FONT_SANS} text-sm font-normal`,
    navItemContent_level_4: `${FONT_SANS} text-xs font-normal`,

    indicatorIcon: `ChevronRight`,
    indicatorIconOpen: `ChevronDown`,
    indicatorIconWrapper: `w-4 h-4 text-[${c.pencil}] transition-transform duration-150`,

    subMenuWrapper_1: `mt-px space-y-px`,
    subMenuWrapper_2: `mt-px space-y-px`,
    subMenuWrapper_3: `mt-px space-y-px`,
    subMenuOuterWrapper: ``,
    subMenuParentWrapper: `flex flex-col`,
    subMenuTitle: `hidden`,

    bottomMenuWrapper: `mt-auto border-t border-[${c.rule}] px-5 py-4 bg-[${c.paper}]`,

    sectionDivider: `my-3 border-t border-[${c.rule}]`,
    sectionHeading: `px-2 pb-2 pt-4 ${FONT_MONO} text-[10px] font-medium uppercase tracking-[0.08em] text-[${c.pencil}]`,

    topnavWrapper: `w-full h-14 flex items-center px-4`,
    topnavContent: `flex items-center w-full h-full bg-[${c.paper}] justify-between`,
    topnavMenu: `hidden lg:flex items-center flex-1 h-full overflow-visible`,
    topmenuRightNavContainer: `flex items-center gap-2`,
    topnavMobileContainer: `bg-[${c.paper}] border-b border-[${c.rule}]`,
  }],
};

/* ---------- NavigableMenu (dropdown / popover menu) ----------------------- */

const navigableMenu = {
  options: { activeStyle: 0 },
  styles: [{
    name: 'default',
    button: `inline-flex items-center justify-center gap-1.5 px-2 py-1 rounded-md hover:bg-[${c.well}] cursor-pointer transition-colors duration-150`,
    icon: 'Menu',
    iconWrapper: `w-4 h-4 stroke-[${c.ink}]`,
    menuWrapper: `bg-[${c.panel}] border border-[${c.rule}] min-w-[16rem] p-1 rounded-lg shadow-[${c.shadowDrag}]`,
    menuCloseIcon: 'XMark',
    menuCloseIconWrapper: `cursor-pointer w-4 h-4 stroke-[${c.graphite}] hover:stroke-[${c.ink}]`,
    menuItem: `group flex items-center justify-between px-3 py-2 text-sm ${FONT_SANS} text-[${c.ink}] cursor-pointer rounded-md`,
    menuItemHover: `hover:bg-[${c.well}]`,
    menuItemIconLabelWrapper: `flex flex-grow items-center gap-2`,
    menuItemIconWrapper: `w-4 h-4 stroke-[${c.graphite}] group-hover:stroke-[${c.ink}]`,
    menuItemLabel: '',
    subMenuIcon: 'ChevronRight',
    valueSubmenuIconWrapper: `flex gap-1 items-center`,
    subMenuIconWrapper: `place-self-center w-3.5 h-3.5 stroke-[${c.pencil}]`,
    valueWrapper: `px-1.5 py-0.5 ${FONT_MONO} text-xs text-[${c.graphite}] bg-[${c.well}] border border-[${c.rule}] rounded tabular-nums`,
    separator: `w-full border-b border-[${c.rule}] my-1`,
  }],
};

/* ---------- Nestable ------------------------------------------------------ */

const nestable = {
  options: { activeStyle: 0 },
  styles: [{
    name: 'default',
    wrapper: `${FONT_SANS} text-sm`,
    item: `flex items-center gap-2 px-2 py-1 rounded-md hover:bg-[${c.well}] cursor-pointer text-[${c.ink}]`,
    handle: `w-4 h-4 stroke-[${c.pencil}] cursor-grab`,
    dropZone: `border-2 border-dashed border-[${c.cobalt}] h-1 my-px`,
  }],
};

/* ---------- Logo (theme-level brand mark slot) ---------------------------- */
/* v0: text wordmark next to the Tile glyph is not expressible here (Logo
   renders an <img> or alt block) — ship the alt block styled as the mark
   until the logo-B SVG assets are exported to public/themes/tessera/. */

const logo = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: 'default',
      logoWrapper: `inline-flex items-center gap-2.5 px-3 py-3`,
      img: '',
      imgWrapper: ``,
      imgClass: `h-7 w-auto`,
      logoAltImg: `inline-flex h-7 w-7 rounded-md items-center justify-center bg-[${c.cobalt}] text-[${c.accentInk}] ${FONT_SANS} text-sm font-semibold`,
      title: 'Tessera',
      titleWrapper: `t-displaySM text-[${c.ink}]`,
      linkPath: '/',
    },
    {
      name: 'compact',
      logoWrapper: `inline-flex items-center justify-center px-3 py-3`,
      img: '',
      imgWrapper: ``,
      imgClass: `h-6 w-auto`,
      logoAltImg: `inline-flex h-6 w-6 rounded-md items-center justify-center bg-[${c.cobalt}] text-[${c.accentInk}] ${FONT_SANS} text-xs font-semibold`,
      title: '',
      titleWrapper: `sr-only`,
      linkPath: '/',
    },
  ],
};

/* ---------- Button -------------------------------------------------------- */

const button = {
  options: { activeStyle: 0 },
  styles: [
    {
      // Primary — cobalt filled. text-accentInk (white in light, near-black
      // in dark where the accent lightens) — never text-white on an accent.
      name: 'default',
      button: `cursor-pointer inline-flex items-center justify-center gap-2 ${FONT_SANS} text-sm font-medium leading-none px-4 py-2.5 rounded-md border border-transparent bg-[${c.cobalt}] text-[${c.accentInk}] hover:bg-[${c.cobaltDeep}] active:bg-[${c.cobaltDeep}] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[${c.cobalt}] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150`,
    },
    {
      // Secondary — panel with a strong hairline; border darkens on hover.
      name: 'plain',
      button: `cursor-pointer inline-flex items-center justify-center gap-2 ${FONT_SANS} text-sm font-medium leading-none px-4 py-2.5 rounded-md border border-[${c.ruleStrong}] bg-[${c.panel}] text-[${c.ink}] hover:border-[${c.ink}] active:border-[${c.ink}] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[${c.cobalt}] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150`,
    },
    {
      // Tertiary — ghost.
      name: 'active',
      button: `cursor-pointer inline-flex items-center justify-center gap-2 ${FONT_SANS} text-sm font-medium leading-none px-2 py-2.5 rounded-md border border-transparent bg-transparent text-[${c.graphite}] hover:text-[${c.ink}] hover:bg-[${c.well}] active:bg-[${c.well}] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[${c.cobalt}] disabled:opacity-50 transition-colors duration-150`,
    },
    {
      // Danger — brick.
      name: 'danger',
      button: `cursor-pointer inline-flex items-center justify-center gap-2 ${FONT_SANS} text-sm font-medium leading-none px-4 py-2.5 rounded-md border border-transparent bg-[${c.brick}] text-[${c.accentInk}] hover:opacity-90 active:opacity-90 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[${c.brick}] disabled:opacity-50 transition-colors duration-150`,
    },
  ],
};

/* ---------- Input (flat theme) -------------------------------------------- */

const input = {
  input: `w-full ${FONT_SANS} text-sm text-[${c.ink}] bg-[${c.panel}] border border-[${c.ruleStrong}] rounded-md px-3 py-2.5 placeholder:text-[${c.pencil}] hover:border-[${c.graphite}] focus:outline-none focus:border-[${c.cobalt}] focus:ring-1 focus:ring-[${c.cobalt}] aria-invalid:border-[${c.brick}] disabled:opacity-50 transition-colors duration-150`,
  inputContainer: `flex-1 relative w-full`,
  textarea: `w-full ${FONT_SANS} text-sm text-[${c.ink}] bg-[${c.panel}] border border-[${c.ruleStrong}] rounded-md px-3 py-2.5 placeholder:text-[${c.pencil}] hover:border-[${c.graphite}] focus:outline-none focus:border-[${c.cobalt}] focus:ring-1 focus:ring-[${c.cobalt}] resize-y min-h-[6rem] transition-colors duration-150`,
  confirmButtonContainer: `absolute right-0 top-0 bottom-0 hidden group-hover:flex items-center gap-1 pr-1`,
  editButton: `p-1 text-[${c.pencil}] hover:text-[${c.ink}] cursor-pointer`,
  cancelButton: `p-1 text-[${c.pencil}] hover:text-[${c.brick}] cursor-pointer`,
  confirmButton: `p-1 text-[${c.go}] hover:text-[${c.ink}] cursor-pointer`,
};

/* ---------- MultiSelect --------------------------------------------------- */

const multiselect = {
  options: { activeStyle: 0 },
  styles: [{
    name: 'default',
    view: `w-full h-full`,
    mainWrapper: `group relative block w-full h-full`,

    inputWrapper: `relative flex flex-wrap items-center gap-1 w-full min-h-9 rounded-md cursor-pointer pl-3 pr-7 py-1.5 border border-[${c.ruleStrong}] bg-[${c.panel}] hover:border-[${c.graphite}] ${FONT_SANS} text-sm text-[${c.ink}] focus-within:ring-1 focus-within:ring-[${c.cobalt}] focus-within:border-[${c.cobalt}] transition-colors duration-150`,
    caretWrapper: `pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2`,
    caretIcon: `w-4 h-4 stroke-[${c.graphite}]`,

    input: `block w-full appearance-none rounded-none focus:outline-none px-3 py-1.5 ${FONT_SANS} text-sm border-b border-[${c.rule}] bg-[${c.panel}] text-[${c.ink}] placeholder:text-[${c.pencil}]`,

    statusWrapper: `flex items-center ${FONT_SANS} text-sm text-[${c.graphite}]`,
    singleValue: `truncate ${FONT_SANS} text-sm text-[${c.ink}]`,
    singlePlaceholder: `truncate ${FONT_SANS} text-sm text-[${c.pencil}]`,

    tokenWrapper: `inline-flex items-center gap-x-1 rounded-full px-2 py-0.5 ${FONT_MONO} text-xs font-normal bg-[${c.well}] text-[${c.ink}] border border-[${c.rule}] hover:border-[${c.ruleStrong}] transition-colors duration-150 whitespace-nowrap`,
    removeIcon: `inline-flex items-center self-center cursor-pointer text-[${c.pencil}] hover:text-[${c.brick}]`,
    removeIconName: 'XMark',
    removeIconClass: `w-3 h-3`,

    menuWrapper: `isolate min-w-[var(--button-width,12rem)] p-1 rounded-lg bg-[${c.panel}] border border-[${c.rule}] shadow-[${c.shadowDrag}]`,
    alwaysOpenMenuWrapper: `w-full p-1 rounded-lg z-20 bg-[${c.panel}] border border-[${c.rule}]`,
    tabularMenuWrapper: `flex flex-row flex-wrap gap-1.5 p-1.5 w-full rounded-lg z-20 bg-[${c.panel}] border border-[${c.rule}]`,

    optionsWrapper: `mt-1 max-h-[300px] overflow-auto`,
    menuItem: `flex items-center gap-2 rounded-md cursor-pointer outline-none px-2 py-1.5 ${FONT_SANS} text-sm text-[${c.ink}] hover:bg-[${c.well}] transition-colors duration-150`,

    smartMenuWrapper: `flex flex-wrap gap-1`,
    smartMenuItem: `inline-flex items-center rounded-full px-2 py-0.5 ${FONT_MONO} text-xs font-normal cursor-pointer bg-[${c.well}] text-[${c.ink}] hover:border-[${c.ruleStrong}] border border-[${c.rule}] transition-colors duration-150`,

    error: `p-1 ${FONT_SANS} text-xs text-[${c.brick}] font-medium`,
    selectedValueIconName: 'Check',
    selectedValueIcon: `w-4 h-4 text-[${c.cobalt}]`,
  }],
};

/* ---------- Tabs ---------------------------------------------------------- */

const tabs = {
  options: { activeStyle: 0 },
  styles: [{
    name: 'default',
    wrapper: `w-full`,
    tabList: `flex items-center gap-0 border-b border-[${c.rule}]`,
    tab: `cursor-pointer ${FONT_MONO} text-[13px] font-medium px-4 py-2.5 text-[${c.graphite}] hover:text-[${c.ink}] border-b-2 border-transparent -mb-px transition-colors duration-150`,
    tabActive: `cursor-pointer ${FONT_MONO} text-[13px] font-medium px-4 py-2.5 text-[${c.cobalt}] border-b-2 border-[${c.cobalt}] -mb-px`,
    tabPanel: `pt-6`,
  }],
};

/* ---------- Switch -------------------------------------------------------- */

const switchTheme = {
  options: { activeStyle: 0 },
  styles: [{
    name: 'default',
    wrapper: `inline-flex items-center gap-2 cursor-pointer`,
    track: `relative w-9 h-5 bg-[${c.well}] border border-[${c.ruleStrong}] rounded-full transition-colors duration-150`,
    trackChecked: `relative w-9 h-5 bg-[${c.cobalt}] border border-[${c.cobalt}] rounded-full transition-colors duration-150`,
    thumb: `absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-[${c.panel}] rounded-full transition-transform duration-150`,
    thumbChecked: `absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-[${c.accentInk}] rounded-full translate-x-4 transition-transform duration-150`,
    label: `${FONT_SANS} text-sm text-[${c.ink}]`,
  }],
};

/* ---------- FieldSet ------------------------------------------------------ */

const field = {
  wrapper: `flex flex-col gap-1.5 mb-4`,
  label: `${FONT_SANS} text-sm font-medium text-[${c.ink}]`,
  description: `${FONT_SANS} text-xs text-[${c.graphite}]`,
  error: `${FONT_SANS} text-xs font-medium text-[${c.brick}]`,
};

/* ---------- Label --------------------------------------------------------- */

const label = {
  label: `${FONT_SANS} text-sm font-medium text-[${c.ink}]`,
};

/* ---------- Icon ---------------------------------------------------------- */

const icon = {
  wrapper: `inline-flex items-center justify-center`,
  default: `w-4 h-4 stroke-[${c.ink}]`,
};

/* ---------- Dialog (flat theme) ------------------------------------------- */

const dialog = {
  dialogContainer: `fixed z-50 inset-0 w-screen overflow-y-auto pt-6 sm:pt-0`,
  backdrop: `fixed inset-0 bg-[${c.scrim}] pointer-events-none`,
  dialogContainer2: `relative grid min-h-full grid-rows-[1fr_auto] justify-items-center sm:grid-rows-[1fr_auto_3fr] sm:p-4`,
  dialogPanel: `row-start-2 w-full p-6 min-w-0 bg-[${c.panel}] border border-[${c.rule}] shadow-[${c.shadowDrag}] rounded-lg [--gutter:32px] sm:mb-auto`,
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
  backdrop: `absolute inset-0 bg-[${c.scrim}]`,
  panel: `relative bg-[${c.panel}] border border-[${c.rule}] shadow-[${c.shadowDrag}] rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto`,
  header: `flex items-center justify-between mb-4 pb-4 border-b border-[${c.rule}]`,
  title: `t-displaySM text-[${c.ink}]`,
  body: `${FONT_SANS} text-sm text-[${c.ink}]`,
  footer: `flex items-center justify-end gap-2 mt-6 pt-4 border-t border-[${c.rule}]`,
  closeButton: `cursor-pointer p-1 text-[${c.graphite}] hover:text-[${c.ink}]`,
};

/* ---------- DialogActions ------------------------------------------------- */

const dialogActions = {
  wrapper: modal.footer,
};

/* ---------- Card (UI primitive, generic) ---------------------------------- */

const card = {
  wrapper: `bg-[${c.panel}] border border-[${c.rule}] rounded-lg p-6`,
  header: `pb-4 mb-4 border-b border-[${c.rule}]`,
  body: `${FONT_SANS} text-sm text-[${c.ink}]`,
  footer: `pt-4 mt-6 border-t border-[${c.rule}]`,
};

/* ---------- dataCard — the workhorse Card section ------------------------- */

const dataCard = {
  options: { activeStyle: 0 },
  styles: [{
    name: 'default',
    wrapper: `w-full ${FONT_SANS} text-[${c.ink}]`,
    sectionTitle: `t-displayMD text-[${c.ink}] mb-4`,

    cardsGrid: `grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6`,

    card: `bg-[${c.panel}] border border-[${c.rule}] rounded-lg p-6 t6-lift`,

    cellsGrid: `grid grid-cols-12 gap-3`,

    headerValueWrapper: `flex flex-col gap-1 px-1 py-1`,
    headerValueWrapperFullBleed: `w-full relative overflow-hidden`,

    // Per-cell header — the mono eyebrow voice
    header: `${FONT_MONO} text-[10px] font-medium uppercase tracking-[0.08em] text-[${c.pencil}]`,

    value: `${FONT_SANS} text-sm text-[${c.ink}] tabular-nums`,

    image: `w-full h-auto object-cover`,
    imageContainer: `w-full overflow-hidden rounded-md`,

    link: `text-[${c.cobalt}] hover:text-[${c.cobaltDeep}] underline underline-offset-[3px]`,
    linkText: `${FONT_SANS} text-sm cursor-pointer`,
  }],
};

/* ---------- Pill ---------------------------------------------------------- */
/* v6 status pills: mono metaXS on soft fills. cobalt=info/beta, go=success,
   amber=warning, brick=danger, slate=ink-filled. */

const pill = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: 'default',
      wrapper: `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${FONT_MONO} text-[10px] uppercase tracking-[0.08em] bg-[${c.well}] text-[${c.graphite}] border border-[${c.rule}]`,
      zinc:  `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${FONT_MONO} text-[10px] uppercase tracking-[0.08em] bg-[${c.well}] text-[${c.graphite}] border border-[${c.rule}]`,
      blue:  `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${FONT_MONO} text-[10px] uppercase tracking-[0.08em] bg-[${c.cobaltSoft}] text-[${c.cobalt}]`,
      green: `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${FONT_MONO} text-[10px] uppercase tracking-[0.08em] bg-[${c.goSoft}] text-[${c.go}]`,
      amber: `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${FONT_MONO} text-[10px] uppercase tracking-[0.08em] bg-[${c.amberSoft}] text-[${c.amber}]`,
      red:   `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${FONT_MONO} text-[10px] uppercase tracking-[0.08em] bg-[${c.brickSoft}] text-[${c.brick}]`,
      slate: `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${FONT_MONO} text-[10px] uppercase tracking-[0.08em] bg-[${c.ink}] text-[${c.paper}]`,
    },
  ],
};

/* ---------- Table --------------------------------------------------------- */

const table = {
  options: { activeStyle: 0 },
  styles: [{
    name: 'default',
    wrapper: `w-full overflow-x-auto`,
    table: `w-full border-collapse ${FONT_SANS} text-sm tabular-nums text-[${c.ink}]`,
    thead: `border-b border-[${c.ruleStrong}]`,
    th: `text-left ${FONT_MONO} text-[10px] font-medium uppercase tracking-[0.08em] text-[${c.pencil}] px-3 py-2.5`,
    headerCell: `text-left ${FONT_MONO} text-[10px] font-medium uppercase tracking-[0.08em] text-[${c.pencil}] px-3 py-2.5`,
    headerCellSortable: `text-left ${FONT_MONO} text-[10px] font-medium uppercase tracking-[0.08em] text-[${c.pencil}] px-3 py-2.5 cursor-pointer hover:text-[${c.ink}]`,
    tr: `border-b border-[${c.rule}] hover:bg-[${c.well}] transition-colors duration-150`,
    trAlt: `border-b border-[${c.rule}] bg-[${c.well}] hover:bg-[${c.well}] transition-colors duration-150`,
    td: `px-3 py-2.5 ${FONT_SANS} text-sm text-[${c.ink}]`,
    tdNum: `px-3 py-2.5 ${FONT_MONO} text-sm text-[${c.ink}] text-right tabular-nums`,
    tdEdit: `px-3 py-2.5 bg-[${c.panel}]`,
    cellEditing: `bg-[${c.panel}] outline-2 outline-[${c.cobalt}] -outline-offset-2`,
    pagination: `flex items-center justify-between gap-2 px-3 py-3 border-t border-[${c.rule}] ${FONT_MONO} text-xs text-[${c.pencil}]`,
  }],
};

/* ---------- Lexical (rich text) ------------------------------------------- */
/* FLAT keys + the options/styles wrapper (see the translation skill §3.1.5).
   heading_h1..h6 set explicitly so the codebase default's `font-display`
   rule never shadows the brand tokens. */

const lexical = {
  options: { activeStyle: 0 },
  styles: [{
    name: 'default',

    editorScroller: 'min-h-[150px] border-0 flex relative outline-0 z-0 resize-y',
    viewScroller: 'border-0 flex relative outline-0 z-0 resize-none',
    editorContainer: 'relative block min-h-[50px]',
    editorShell: `${FONT_SANS} text-base leading-[1.6] text-[${c.ink}]`,
    contentEditable: 'border-none relative [tab-size:1] outline-none outline-0',

    paragraph: `${FONT_SANS} text-base leading-[1.6] text-[${c.ink}] mb-4`,

    // Headings — the five-size display ladder (h5/h6 share displaySM).
    heading_h1: `${T.displayHero} mt-0 mb-4`,
    heading_h2: `${T.displayXL}   mt-0 mb-3`,
    heading_h3: `${T.displayLG}   mt-0 mb-3`,
    heading_h4: `${T.displayMD}   mt-0 mb-2`,
    heading_h5: `${T.displaySM}   mt-0 mb-1`,
    heading_h6: `${T.displaySM}   mt-0 mb-1`,

    list_ol: `${FONT_SANS} list-decimal pl-6 mb-4 marker:text-[${c.pencil}]`,
    list_ul: `${FONT_SANS} list-disc pl-6 mb-4 marker:text-[${c.pencil}]`,
    list_listitem: `${FONT_SANS} text-base leading-[1.6] text-[${c.ink}] mb-1`,
    list_nested_listitem: 'list-none',

    link: `text-[${c.cobalt}] hover:text-[${c.cobaltDeep}] underline underline-offset-[3px]`,

    text_bold: 'font-semibold',
    text_italic: 'italic',
    text_underline: 'underline underline-offset-[3px]',
    text_strikethrough: 'line-through',
    text_code: `${FONT_MONO} text-[0.92em] bg-[${c.well}] border border-[${c.rule}] px-1 py-0.5 rounded`,

    // Quote — cobalt left rule, no italics (v6 has no italic voice).
    quote: `border-l-2 border-[${c.cobalt}] pl-4 text-[${c.graphite}] ${FONT_SANS} text-lg leading-[1.6] my-4`,
    // Code — a board pane (dark in both lamps).
    code: `${FONT_MONO} text-sm bg-[${c.board}] text-[${c.chalk}] border border-[${c.board2}] p-4 rounded-md overflow-x-auto my-4`,

    hr_base: `p-[1px] border-none my-6 cursor-pointer relative`,
    hr_after: `absolute left-0 right-0 h-px bg-[${c.rule}] leading-[1px]`,

    layoutContainer: 'grid gap-3 mt-2',
    layoutItem: 'min-w-0 max-w-full',
    layoutItemEditable: `border border-dashed border-[${c.rule}]`,
  }],

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
/* Palette + grid are hex (SVG attributes can't resolve var()); these are the
   light-lamp values. Dark-mode charts keep the light series colors — cobalt
   and the status hues hold up on the dark paper. */

const graphPaletteSeries = [
  '#0A46D8',  // 1 — cobalt (THE accent)
  '#1F8A4C',  // 2 — go
  '#B97516',  // 3 — amber
  '#CA3214',  // 4 — brick
  '#50545C',  // 5 — graphite
];

const graph = {
  options: { activeStyle: 0 },
  styles: [{
    name: 'default',
    wrapper: `w-full ${FONT_SANS}`,
    title: `t-displaySM text-[${c.ink}] mb-4`,
    axis: `${FONT_MONO} text-xs text-[${c.pencil}]`,
    axisLabel: `${FONT_MONO} text-[10px] uppercase tracking-[0.08em] text-[${c.pencil}]`,
    grid: '#E2E0D6',
    tooltip: `bg-[${c.board}] text-[${c.chalk}] ${FONT_MONO} text-xs px-2 py-1.5 rounded-md border border-[${c.board2}] tabular-nums`,
    legend: `${FONT_MONO} text-xs text-[${c.graphite}]`,
    palette: graphPaletteSeries,
  }],
};

const avlGraph = {
  options: { activeStyle: 0 },
  styles: [{
    name: 'default',
    wrapper: `w-full ${FONT_SANS}`,
    title: `t-displaySM text-[${c.ink}] mb-4`,
    axis: `${FONT_MONO} text-xs text-[${c.pencil}]`,
    axisLabel: `${FONT_MONO} text-[10px] uppercase tracking-[0.08em] text-[${c.pencil}]`,
    grid: '#E2E0D6',
    tooltip: `bg-[${c.board}] text-[${c.chalk}] ${FONT_MONO} text-xs px-2 py-1.5 rounded-md border border-[${c.board2}] tabular-nums`,
    legend: `${FONT_MONO} text-xs text-[${c.graphite}]`,
    palette: graphPaletteSeries,
  }],
};

/* ---------- Map ----------------------------------------------------------- */

const map = {
  options: { activeStyle: 0 },
  styles: [{
    name: 'default',
    container: `w-full h-full relative bg-[${c.well}] rounded-lg overflow-hidden`,
    controls: `absolute top-2 right-2 flex flex-col gap-1 bg-[${c.panel}] border border-[${c.rule}] rounded-md shadow-[${c.shadowLift}]`,
    controlButton: `p-2 hover:bg-[${c.well}] cursor-pointer text-[${c.ink}] rounded-md`,
    legend: `absolute bottom-3 left-3 bg-[${c.panel}] border border-[${c.rule}] rounded-md p-3 ${FONT_SANS} text-xs text-[${c.ink}] shadow-[${c.shadowLift}]`,
    popover: `bg-[${c.panel}] border border-[${c.rule}] rounded-md p-3 ${FONT_SANS} text-sm text-[${c.ink}] shadow-[${c.shadowDrag}]`,
  }],
};

/* ---------- Filters (promoted to options/styles — see skill §3.1.7) ------- */

const filters = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: 'panel',
      placement: 'stacked',
      controlStyle: 'default',
      filterLabel: `${FONT_MONO} text-[10px] font-medium uppercase tracking-[0.08em] text-[${c.pencil}]`,
      loadingText: `${FONT_MONO} text-xs text-[${c.pencil}]`,
      filterSettingsWrapperStacked: `w-full`,
      filterSettingsWrapperInline: `flex items-center gap-2`,
      labelWrapperStacked: `w-full`,
      labelWrapperInline: `shrink-0 inline-flex items-center gap-1`,
      conditionRowStacked: `flex flex-col gap-1`,
      conditionRowInline: `inline-flex items-center gap-1.5 w-fit`,
      conditionsGrid: `grid gap-2`,
      filtersWrapper: `w-full p-3 flex flex-col gap-2 rounded-lg bg-[${c.well}] border border-[${c.rule}]`,
      input: `w-full ${FONT_SANS} text-sm border border-[${c.ruleStrong}] rounded-md bg-[${c.panel}] text-[${c.ink}] p-2`,
      settingPillsWrapper: `flex flex-wrap gap-1.5`,
      settingPill: `inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${FONT_MONO} text-[10px] uppercase tracking-[0.06em] bg-[${c.panel}] border border-[${c.rule}] text-[${c.graphite}]`,
      settingLabel: `${FONT_MONO} text-[10px] uppercase tracking-[0.06em] text-[${c.pencil}]`,
      toggleButton: `hidden`,
      toggleIcon: `hidden`,
    },
    {
      name: 'chip',
      placement: 'inline',
      controlStyle: 'default',
      conditionRowInline: `inline-flex items-center gap-1.5 h-8 pl-2.5 pr-1.5 rounded-md border border-[${c.rule}] bg-[${c.panel}] w-fit`,
      labelWrapperInline: `shrink-0 inline-flex items-center gap-1`,
      filtersWrapper: `w-full flex flex-wrap items-start gap-2`,
    },
  ],
};

/* ---------- Pattern-level themes ------------------------------------------ */

const pagesTheme = {
  attribution: {
    options: { activeStyle: 0 },
    styles: [{
      name: 'default',
      wrapper: `inline-flex items-center gap-1.5 ${FONT_MONO} text-[10px] uppercase tracking-[0.08em] text-[${c.pencil}]`,
      link: `text-[${c.graphite}] hover:text-[${c.ink}] underline underline-offset-[2px]`,
    }],
  },
  complexFilters: {
    groupWrapper: `border border-[${c.rule}] bg-[${c.well}] rounded-lg p-3 mb-2`,
    leafWrapper: `flex items-center gap-2 mb-2`,
    operatorPill: `${FONT_MONO} text-[10px] uppercase tracking-[0.06em] text-[${c.graphite}] px-2 py-0.5 border border-[${c.rule}] bg-[${c.panel}] rounded-full`,
    addButton: `${FONT_SANS} text-xs text-[${c.cobalt}] hover:text-[${c.cobaltDeep}] cursor-pointer`,
    removeButton: `text-[${c.pencil}] hover:text-[${c.brick}] cursor-pointer p-1`,
  },
  searchButton: {
    options: { activeStyle: 0 },
    styles: [{
      name: 'default',
      button: `inline-flex items-center gap-2 px-3 py-1.5 border border-[${c.rule}] bg-[${c.panel}] hover:border-[${c.ruleStrong}] cursor-pointer rounded-md transition-colors duration-150`,
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
      backdrop: `absolute inset-0 bg-[${c.scrim}]`,
      panel: `relative bg-[${c.panel}] border border-[${c.rule}] rounded-lg shadow-[${c.shadowDrag}] max-w-2xl w-full mx-4 overflow-hidden`,
      input: `w-full ${FONT_SANS} text-base text-[${c.ink}] bg-transparent border-b border-[${c.rule}] px-4 py-3 focus:outline-none focus:border-[${c.cobalt}] placeholder:text-[${c.pencil}]`,
      results: `max-h-[60vh] overflow-y-auto`,
      result: `px-4 py-2.5 hover:bg-[${c.well}] cursor-pointer ${FONT_SANS} text-sm text-[${c.ink}] border-b border-[${c.rule}]`,
    }],
  },
  sectionGroupsPane: {
    wrapper: `${FONT_SANS} text-sm`,
    group: `border border-[${c.rule}] bg-[${c.well}] rounded-lg p-3 mb-2`,
    groupHeader: `flex items-center justify-between gap-2 mb-2 pb-2 border-b border-[${c.rule}] ${FONT_MONO} text-[10px] uppercase tracking-[0.08em] text-[${c.pencil}]`,
    sectionItem: `flex items-center gap-2 px-2 py-1 rounded-md hover:bg-[${c.well}] cursor-pointer`,
  },

  /* sectionArray — the 12-col sheet inside each band. The mockup grid is
     `grid grid-cols-12 gap-0` with a p-3 gutter per section; chrome (border/
     radius/bg) renders on the inner box, inside the gutter (skill §3.1.58). */
  sectionArray: {
    options: { activeStyle: 0 },
    styles: [{
      name: 'default',
      _replace: ['sizes'],
      container: `w-full grid grid-cols-12`,
      gridSize: 12,
      // The v6 sheet gutter: p-3 (12px) per section = 24px between inner
      // boxes — one grid cell, exactly the mockups' rhythm.
      sectionPadding: 'p-3',
      defaultPaddingStep: 3,
      paddings: {
        top:    { 0: 'pt-0', 1: 'pt-1', 2: 'pt-2', 3: 'pt-3', 4: 'pt-6' },
        right:  { 0: 'pr-0', 1: 'pr-1', 2: 'pr-2', 3: 'pr-3', 4: 'pr-6' },
        bottom: { 0: 'pb-0', 1: 'pb-1', 2: 'pb-2', 3: 'pb-3', 4: 'pb-6' },
        left:   { 0: 'pl-0', 1: 'pl-1', 2: 'pl-2', 3: 'pl-3', 4: 'pl-6' },
      },
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
      rowspans: {
        "1": { className: '' },
        "2": { className: 'md:row-span-2' },
        "3": { className: 'md:row-span-3' },
        "4": { className: 'md:row-span-4' },
        "5": { className: 'md:row-span-5' },
        "6": { className: 'md:row-span-6' },
        "7": { className: 'md:row-span-7' },
        "8": { className: 'md:row-span-8' },
      },

      layouts: {
        centered: `max-w-[1200px] mr-auto`,   // product default: hug the SideNav
        fullwidth: '',
      },

      // Edit-mode chrome — cobalt selection language (the same one the
      // landing's editor illustration and hero animation use).
      sectionEditWrapper: `relative group`,
      sectionViewWrapper: `relative group`,
      sectionEditHover: `absolute inset-0 border-2 border-transparent group-hover:border-[${c.cobaltLine}] border-dashed pointer-events-none z-10 rounded-lg transition-colors`,
      sectionEditing:   `absolute inset-0 border-2 border-[${c.cobalt}] pointer-events-none z-10 rounded-lg`,
      sectionHighlight: `absolute inset-0 border-2 border-[${c.amber}] border-dashed pointer-events-none z-10 rounded-lg`,
      addSectionButton: `cursor-pointer py-0.5 text-sm text-[${c.pencil}] hover:text-[${c.ink}] truncate w-full -ml-4 my-2 hidden group-hover:flex absolute -top-5 z-11`,
      spacer: `flex-1`,
      addSectionIconWrapper: `flex items-center group/icon cursor-pointer`,
      addSectionIcon:   `size-6 p-1.5 text-[${c.accentInk}] bg-[${c.cobalt}] rounded-full group-hover/icon:hidden`,
      addSectionTextWrapper: `hidden group-hover/icon:flex items-center`,
      addSectionText:   `px-2.5 py-1 text-[${c.accentInk}] ${FONT_MONO} text-[11px] uppercase tracking-[0.06em] bg-[${c.cobalt}] rounded-full`,

      // Per-side chrome for the inner box (skill §3.1.58)
      borderSides: {
        top:    `border-t border-[${c.rule}]`,
        right:  `border-r border-[${c.rule}]`,
        bottom: `border-b border-[${c.rule}]`,
        left:   `border-l border-[${c.rule}]`,
      },
      radiusCorners: {
        tl: 'rounded-tl-lg',
        tr: 'rounded-tr-lg',
        bl: 'rounded-bl-lg',
        br: 'rounded-br-lg',
      },
      backgrounds: {
        none:  '',
        white: `bg-[${c.panel}]`,
        tint:  `bg-[${c.well}]`,
      },
      border: {
        none:        '',
        full:        `border border-[${c.rule}] rounded-lg`,
        openLeft:    `border border-[${c.rule}] border-l-transparent`,
        openRight:   `border border-[${c.rule}] border-r-transparent`,
        openTop:     `border border-[${c.rule}] border-t-transparent`,
        openBottom:  `border border-[${c.rule}] border-b-transparent`,
        borderX:     `border border-[${c.rule}] border-y-transparent`,
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
      header: `flex items-center justify-between gap-4 mb-6 pb-4 border-b border-[${c.rule}]`,
      title: `t-displayLG text-[${c.ink}]`,
      categoryNav: `flex flex-col gap-1 mb-4`,
      categoryItem: `${FONT_SANS} text-sm text-[${c.graphite}] hover:text-[${c.ink}] hover:bg-[${c.well}] rounded-md px-2 py-1.5 cursor-pointer transition-colors duration-150`,
      categoryItemActive: `${FONT_SANS} text-sm font-medium text-[${c.cobalt}] bg-[${c.cobaltSoft}] rounded-md px-2 py-1.5 cursor-pointer`,
      datasetGrid: `grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4`,
      datasetCard: `bg-[${c.panel}] border border-[${c.rule}] rounded-lg p-5 cursor-pointer t6-lift`,
      datasetTitle: `t-displaySM text-[${c.ink}] mb-2`,
      datasetMeta: `${FONT_MONO} text-[10px] text-[${c.pencil}] uppercase tracking-[0.06em]`,
    }],
  },
  metadataComp: {
    wrapper: `${FONT_SANS} text-sm`,
    field: `flex items-center gap-3 py-2 border-b border-[${c.rule}]`,
    fieldLabel: `${FONT_MONO} text-[10px] uppercase tracking-[0.06em] text-[${c.pencil}] w-40 flex-shrink-0`,
    fieldValue: `${FONT_SANS} text-sm text-[${c.ink}]`,
  },
};

const authTheme = {
  login: {
    wrapper: `${FONT_SANS}`,
    title: `t-displayLG text-[${c.ink}] mb-2 text-center`,
    subtitle: `${FONT_SANS} text-sm text-[${c.graphite}] mb-6 text-center`,
    form: `flex flex-col gap-4`,
    submitButton: `w-full inline-flex items-center justify-center px-4 py-2.5 ${FONT_SANS} text-sm font-medium bg-[${c.cobalt}] text-[${c.accentInk}] hover:bg-[${c.cobaltDeep}] cursor-pointer rounded-md transition-colors duration-150`,
    altLink: `${FONT_SANS} text-sm text-[${c.graphite}] hover:text-[${c.ink}] text-center mt-4`,
  },
};

/* ---------- Admin namespace ----------------------------------------------- */

const adminTheme = {
  kpiStrip: `grid border border-[${c.rule}] bg-[${c.panel}] rounded-lg overflow-hidden`,
  kpiCell: `px-6 py-5 border-r border-[${c.rule}] last:border-r-0`,
  kpiValue: `${FONT_SANS} text-4xl font-semibold tracking-[-0.025em] text-[${c.ink}] tabular-nums leading-none mt-1`,
  kpiLabel: `${FONT_MONO} text-[10px] uppercase tracking-[0.08em] text-[${c.pencil}]`,

  typeBadge: `inline-block px-2 py-0.5 rounded-full ${FONT_MONO} text-[10px] uppercase tracking-[0.06em] whitespace-nowrap`,
  typeBadgePage:      `text-[${c.cobalt}] bg-[${c.cobaltSoft}]`,
  typeBadgeDatasets:  `text-[${c.go}] bg-[${c.goSoft}]`,
  typeBadgeForms:     `text-[${c.graphite}] bg-[${c.well}] border border-[${c.rule}]`,
  typeBadgeAuth:      `text-[${c.amber}] bg-[${c.amberSoft}]`,
  typeBadgeMapeditor: `text-[${c.graphite}] border border-[${c.rule}]`,

  statusDotActive:   `w-1.5 h-1.5 rounded-full bg-[${c.go}] inline-block`,
  statusDotInactive: `w-1.5 h-1.5 rounded-full bg-[${c.pencil}] inline-block`,
  statusDotPending:  `w-1.5 h-1.5 rounded-full bg-[${c.amber}] inline-block`,

  subdomainPill:       `inline-flex items-center gap-1 px-2 py-0.5 bg-[${c.well}] border border-[${c.rule}] ${FONT_MONO} text-[11px] text-[${c.graphite}] rounded-full`,
  subdomainPillGlobal: `text-[${c.pencil}] bg-transparent border-[${c.rule}]`,

  filterChip:       `inline-flex items-center gap-1.5 px-2.5 py-1 border border-[${c.rule}] ${FONT_MONO} text-[11px] uppercase tracking-[0.06em] text-[${c.graphite}] cursor-pointer rounded-full transition-colors duration-150 hover:bg-[${c.well}] hover:border-[${c.ruleStrong}]`,
  filterChipActive: `bg-[${c.cobaltSoft}] border-[${c.cobalt}] text-[${c.cobalt}]`,

  avatar: `w-7 h-7 rounded-md inline-flex items-center justify-center ${FONT_SANS} text-[11px] font-semibold text-[${c.accentInk}] flex-shrink-0`,

  avatarStack:         `flex`,
  avatarStackItem:     `w-6 h-6 rounded-full inline-flex items-center justify-center ${FONT_SANS} text-[10px] font-semibold text-[${c.accentInk}] border-2 border-[${c.panel}] -mr-1.5 last:mr-0 flex-shrink-0`,
  avatarStackOverflow: `bg-[${c.well}] text-[${c.graphite}]`,

  groupPill:       `inline-flex items-center px-2 py-0.5 bg-[${c.well}] border border-[${c.rule}] ${FONT_MONO} text-[11px] text-[${c.graphite}] rounded-full whitespace-nowrap`,
  groupPillAdmin:  `bg-[${c.brickSoft}] border-transparent text-[${c.brick}]`,
  groupPillEditor: `bg-[${c.goSoft}] border-transparent text-[${c.go}]`,

  permBadge:       `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${FONT_MONO} text-[10px] uppercase tracking-[0.06em] whitespace-nowrap`,
  permBadgeAdmin:  `text-[${c.brick}] bg-[${c.brickSoft}]`,
  permBadgeEditor: `text-[${c.go}] bg-[${c.goSoft}]`,
  permBadgeViewer: `text-[${c.graphite}] bg-[${c.well}] border border-[${c.rule}]`,
  permBadgePublic: `text-[${c.pencil}] border border-[${c.rule}]`,

  systemBadge: `inline-block px-2 py-0.5 ${FONT_MONO} text-[10px] uppercase tracking-[0.06em] text-[${c.pencil}] border border-[${c.rule}] rounded-full`,

  bulkBar:      `sticky bottom-0 z-10 flex items-center gap-3 px-4 py-3 bg-[${c.board}] text-[${c.chalk}] shadow-[${c.shadowDrag}]`,
  bulkBarCount: `${FONT_MONO} text-xs uppercase tracking-[0.06em] text-[${c.chalkDim}]`,

  tabStrip:    `flex items-end border-b border-[${c.rule}] gap-0 mb-4`,
  tab:         `px-4 py-2 ${FONT_MONO} text-[13px] font-medium text-[${c.graphite}] cursor-pointer border-b-2 border-transparent -mb-px transition-colors duration-150 hover:text-[${c.ink}] whitespace-nowrap`,
  tabActive:   `text-[${c.cobalt}] border-b-2 border-[${c.cobalt}]`,
  tabCount:    `inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-[${c.well}] border border-[${c.rule}] ${FONT_MONO} text-[10px] text-[${c.graphite}] ml-1.5 rounded-full`,

  themeGrid:        `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4`,
  themeCard:        `bg-[${c.panel}] border border-[${c.rule}] rounded-lg overflow-hidden flex flex-col t6-lift`,
  themeCardPalette: `h-12 flex`,
  themeCardBody:    `p-4 flex-1`,
  themeCardName:    `t-displaySM text-[${c.ink}] mb-0.5`,
  themeCardMeta:    `${FONT_MONO} text-[11px] uppercase tracking-[0.06em] text-[${c.pencil}]`,
  themeCardFooter:  `px-4 py-3 border-t border-[${c.rule}] flex items-center justify-between gap-3`,
  themeUsageChip:   `inline-block px-2 py-0.5 bg-[${c.well}] border border-[${c.rule}] rounded ${FONT_MONO} text-[11px] text-[${c.graphite}]`,

  pageHeader: `w-full flex items-center justify-between border-b border-[${c.rule}] pb-4 mb-4`,
  pageTitle:  `t-displayMD text-[${c.ink}]`,

  toolbar: `flex items-center gap-3 mt-5 mb-3`,

  groupDescription: `${FONT_MONO} text-[11px] text-[${c.pencil}] mt-0.5`,

  permMatrixSection: `mt-8 pt-6 border-t border-[${c.rule}]`,
  permMatrixTitle:   `t-displaySM text-[${c.ink}] mb-1`,
  permMatrixSubtitle:`${FONT_SANS} text-sm text-[${c.graphite}] mb-4`,
  permMatrixTable:   `w-full border border-[${c.rule}] rounded-lg text-sm`,
  permMatrixHeaderRow: `bg-[${c.well}] border-b border-[${c.rule}]`,
  permMatrixHeaderCell:`px-4 py-3 ${FONT_MONO} text-[10px] uppercase tracking-[0.06em] text-[${c.pencil}] text-center`,
  permMatrixHeaderFirst:`px-4 py-3 ${FONT_MONO} text-[10px] uppercase tracking-[0.06em] text-[${c.pencil}]`,
  permMatrixRow:     `border-b border-[${c.rule}] last:border-0`,
  permMatrixRowAlt:  `border-b border-[${c.rule}] last:border-0 bg-[${c.well}]`,
  permMatrixCapability:`px-4 py-3 ${FONT_SANS} text-sm text-[${c.ink}]`,
  permMatrixCell:    `px-4 py-3 text-center`,
  permCheckYes:      `mx-auto w-5 h-5 rounded-full bg-[${c.go}] flex items-center justify-center`,
  permCheckPartial:  `mx-auto w-5 h-5 rounded-full bg-[${c.amber}] flex items-center justify-center`,
  permCheckNo:       `mx-auto w-5 h-5 rounded-full border border-[${c.rule}] bg-[${c.well}]`,
};

/* ---------- Icons — the v6 drawn registry (SOURCE OF TRUTH) ---------------- */
/* ~55 glyphs, 24px grid, 1.5px stroke, round caps. Imported directly from
   the design system's registry so there is exactly one copy. */

const Icons = icons;

/* ---------- Theme-registered column types --------------------------------- */

const columnTypes = {
  type_badge:     { ViewComp: TypeBadgeView,     EditComp: TypeBadgeEdit },
  subdomain_pill: { ViewComp: SubdomainPillView, EditComp: SubdomainPillEdit },
  user_avatar:    { ViewComp: UserAvatarView,    EditComp: UserAvatarEdit },
  group_pill:     { ViewComp: GroupPillView,     EditComp: GroupPillEdit },
  perm_badge:     { ViewComp: PermBadgeView,     EditComp: PermBadgeEdit },
  avatar_stack:   { ViewComp: AvatarStackView,   EditComp: () => null },
};

const pageComponents = {};

/* ---------- Fonts + injected CSS ------------------------------------------ */
/* loadThemeFonts injects these into <head> once when the theme resolves.
   Entry 4 inlines the canonical _shared.css (palette light+dark, the 15
   .t-* type tokens, t6-* utilities, grain/graph textures, reduced-motion),
   so the theme is fully self-contained — no consumer index.css edits. */

const fonts = [
  // 1. The three v6 families. Plex Sans doubles as display; Caveat is the
  //    margin voice (authors only — never UI chrome).
  {
    type: 'google',
    href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Caveat:wght@500;600;700&display=swap',
  },

  // 2. Register the families with Tailwind 4 via @theme (runtime browser
  //    build scans <style type="text/tailwindcss"> blocks).
  {
    type: 'tailwind',
    id: 'tessera-v6-tw-theme',
    content: `
      @theme {
        --font-sans: "IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, sans-serif;
        --font-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
        --font-display: "IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, sans-serif;
        --font-note: "Caveat", "Segoe Print", cursive;
        --default-font-family: "IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, sans-serif;
      }
    `,
  },

  // 3. Belt-and-braces :root re-pin + literal .font-* rules (the build-time
  //    Tailwind bundle can shadow runtime @theme on first paint).
  {
    type: 'style',
    id: 'tessera-v6-font-stacks',
    content: `
      :root, :host {
        --font-sans: "IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, sans-serif;
        --font-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
        --font-display: "IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, sans-serif;
        --font-note: "Caveat", "Segoe Print", cursive;
        --default-font-family: "IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, sans-serif;
      }
      html, body { font-family: var(--font-sans); }
      .font-sans    { font-family: var(--font-sans); }
      .font-mono    { font-family: var(--font-mono); }
      .font-display { font-family: var(--font-display); }
      .font-note    { font-family: var(--font-note); }
    `,
  },

  // 4. The canonical v6 stylesheet, inlined at build time from the design
  //    system folder (single source of truth — edits there flow here).
  {
    type: 'style',
    id: 'tessera-v6-shared',
    content: sharedCss,
  },

  // 5. Theme-only extras: the feature band's self-fading sheet grid. The
  //    mockups use an absolutely-positioned .t6-sheet-fade overlay div,
  //    which a class-string theme can't inject — this achieves the same
  //    dissolve with stacked background images on the band itself.
  {
    type: 'style',
    id: 'tessera-v6-theme-extras',
    content: `
      .t6-band-sheet {
        background-image:
          linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 45%, var(--t-paper) 95%),
          linear-gradient(var(--t-grid) 1px, transparent 1px),
          linear-gradient(90deg, var(--t-grid) 1px, transparent 1px);
        background-size: 100% 100%, 24px 24px, 24px 24px;
        background-color: var(--t-paper);
      }
    `,
  },
];

/* ---------- Compose ------------------------------------------------------- */

const tesseraThemeV6 = {
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
  filters,

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

  // Extension slots
  columnTypes,
  pageComponents,
};

export default tesseraThemeV6;
