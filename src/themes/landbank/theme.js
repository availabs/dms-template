/* =============================================================================
   Albany County Land Bank — DMS Theme (v0.1)

   Translation of `src/themes/landbank/design_system/` (README + theme /
   layouts / grid / components / patterns + pages) into the runnable DMS
   theme overlay, per `src/dms/skills/translating-design-system-to-dms-theme.md`.

   The brand in one line: records-office polish — survey grids and parcel
   ledgers in the ACLB logo's sky/leaf, grounded in a deep civic ink on
   record-paper neutrals. Archivo (118% width) is the display voice,
   Public Sans the prose voice, IBM Plex Mono the ledger voice.

   Conventions:
   - Class strings use Tailwind ARBITRARY hex values (`bg-[#0A6E99]`) — the
     live build has no named landbank colors. Borders are `border-[#16232C]/10`
     everywhere (one border tone, no exceptions).
   - styles[0] is the complete default for every primitive; named variants
     are sparse overrides.
   - One radius: 6px (`rounded-md`). Buttons press (`.lb-press`); pills are
     full-round; the seven-status color system drives pills, chart palettes,
     and map pins identically.
   - Surface utilities (`lb-paper`, `lb-plat`, `lb-card`, `lb-press`, …) are
     injected via the `fonts` array's `landbank-surfaces` style entry below —
     no consumer index.css edits needed.
   ============================================================================= */

import icons from './icons';
import parcelPlate from './columnTypes/parcelPlate.config';
import { parcelPlateTheme } from './columnTypes/parcelPlate.theme';

/* ---------- Brand palette (design_system/theme.html#color) ----------------- */

const C = {
  // Neutrals — record paper
  ink:       '#16232C',   // primary text, footer band
  slate:     '#475A66',   // secondary text
  mist:      '#8CA0AB',   // muted labels, disabled
  paper:     '#F2F5F6',   // the page pane
  papertint: '#EAEFF1',   // alternating band

  // Brand brights (graphic only — never body text)
  sky:      '#0AA7E4',
  skydeep:  '#0A6E99',    // links, primary buttons, active nav
  leaf:     '#8CC63E',    // eyebrow squares, accents only
  field:    '#4C9129',    // "For Sale" green — white text passes
  forest:   '#33641B',

  // Semantic accents (one job each — the status system)
  amber:      '#E0940B',
  amberdeep:  '#8F5E08',
  violet:     '#8B6FC7',
  violetdeep: '#6C50A8',
  rose:       '#CE5B4E',
  rosedeep:   '#B03E31',
  steel:      '#8195A1',
};

// The one border tone. `border-[#16232C]/10` everywhere; /5 for hairlines
// inside cards (table row separators, band edges).
const BORDER = `border-[${C.ink}]/10`;

const FONT_DISPLAY = 'font-display';  // Archivo @ 118% width
const FONT_PROSE   = 'font-prose';    // Public Sans
const FONT_META    = 'font-meta';     // IBM Plex Mono

/* ---------- Brand type tokens (theme.html#type — 14 tokens) ----------------
   Color is part of the shipped token: ink on display/label, slate on prose,
   mist on metaXS. metaMD/metaSM stay color-free (color is a call-site
   modifier axis — they render on light and dark grounds alike).            */

const T = {
  displayHero: `${FONT_DISPLAY} font-bold text-[54px] leading-[1.04] tracking-[-0.015em] scroll-mt-36 text-[${C.ink}]`,
  displayXL:   `${FONT_DISPLAY} font-bold text-[38px] leading-[1.1] tracking-[-0.01em] scroll-mt-36 text-[${C.ink}]`,
  displayLG:   `${FONT_DISPLAY} font-semibold text-[27px] leading-[1.15] scroll-mt-36 text-[${C.ink}]`,
  displayMD:   `${FONT_DISPLAY} font-semibold text-[21px] leading-[1.2] scroll-mt-36 text-[${C.ink}]`,
  displaySM:   `${FONT_DISPLAY} font-semibold text-[17px] leading-[1.3] scroll-mt-36 text-[${C.ink}]`,
  // h6 only — a step below displaySM; not a declared design-system token.
  displayXS:   `${FONT_DISPLAY} font-semibold text-[15px] leading-[1.3] scroll-mt-36 text-[${C.ink}]`,

  proseLG: `${FONT_PROSE} text-[17.5px] leading-[1.6] font-normal text-[${C.slate}]`,
  prose:   `${FONT_PROSE} text-[15px] leading-[1.65] font-normal text-[${C.slate}]`,
  proseSM: `${FONT_PROSE} text-[13.5px] leading-[1.55] font-normal text-[${C.slate}]`,
  proseXS: `${FONT_PROSE} text-[12px] leading-[1.5] font-normal text-[${C.slate}]`,

  labelMD: `${FONT_PROSE} text-[13.5px] leading-[1.2] font-semibold text-[${C.ink}]`,
  labelSM: `${FONT_PROSE} text-[12px] leading-[1.2] font-semibold text-[${C.ink}]`,

  metaMD: `${FONT_META} text-[12.5px] leading-[1.5] font-medium tabular-nums`,
  metaSM: `${FONT_META} text-[11px] leading-[1.4] font-medium uppercase tracking-[0.16em]`,
  metaXS: `${FONT_META} text-[9.5px] leading-[1.3] font-medium uppercase tracking-[0.14em] text-[${C.mist}]`,
};

/* ---------- textSettings — the global type scale --------------------------- */
/* Read by Lexical (h1..h6 backfill + /Style: slash menu), Card cells
   (valueFontStyle dropdown), Header, and any text-rendering column type.   */

const textSettings = {
  options: {
    activeStyle: 0,
    // The 14 brand tokens surface as `/Style: <key>` options in Lexical's
    // slash menu; the generic textXS..text8XL ladder stays out of the menu.
    slashKeys: [
      'displayHero', 'displayXL', 'displayLG', 'displayMD', 'displaySM',
      'proseLG', 'prose', 'proseSM', 'proseXS',
      'labelMD', 'labelSM',
      'metaMD', 'metaSM', 'metaXS',
    ],
  },
  styles: [{
    name: 'default',

    // ----- The 14 brand tokens (theme.html#type) --------------------------
    displayHero: T.displayHero,
    displayXL:   T.displayXL,
    displayLG:   T.displayLG,
    displayMD:   T.displayMD,
    displaySM:   T.displaySM,
    proseLG:     T.proseLG,
    prose:       T.prose,
    proseSM:     T.proseSM,
    proseXS:     T.proseXS,
    labelMD:     T.labelMD,
    labelSM:     T.labelSM,
    metaMD:      T.metaMD,
    metaSM:      T.metaSM,
    metaXS:      T.metaXS,

    // ----- Heading roles — h1..h6 mapped onto the display ladder ----------
    // (mirrored explicitly into lexical.styles[0].heading_h1..h6 below —
    // the textSettings backfill only fires when those keys are falsy.)
    h1: T.displayHero,
    h2: T.displayXL,
    h3: T.displayLG,
    h4: T.displayMD,
    h5: T.displaySM,
    h6: T.displayXS,

    // ----- Generic size + weight ladder (Card valueFontStyle dropdown) ----
    // Re-skinned: Public Sans on working sizes, Archivo on display sizes,
    // ink text throughout.
    textXS:          `${FONT_PROSE} text-xs font-medium text-[${C.ink}]`,
    textXSReg:       `${FONT_PROSE} text-xs font-normal text-[${C.ink}]`,
    textXSBold:      `${FONT_PROSE} text-xs font-bold text-[${C.ink}]`,
    textSM:          `${FONT_PROSE} text-sm font-medium text-[${C.ink}]`,
    textSMReg:       `${FONT_PROSE} text-sm font-normal text-[${C.ink}]`,
    textSMBold:      `${FONT_PROSE} text-sm font-bold text-[${C.ink}]`,
    textSMSemiBold:  `${FONT_PROSE} text-sm font-semibold text-[${C.ink}]`,
    textBase:        `${FONT_PROSE} text-base font-normal text-[${C.ink}]`,
    textBaseMedium:  `${FONT_PROSE} text-base font-medium text-[${C.ink}]`,
    textBaseBold:    `${FONT_PROSE} text-base font-bold text-[${C.ink}]`,
    textLG:          `${FONT_PROSE} text-lg font-medium text-[${C.ink}]`,
    textLGReg:       `${FONT_PROSE} text-lg font-normal text-[${C.ink}]`,
    textLGBold:      `${FONT_PROSE} text-lg font-bold text-[${C.ink}]`,
    textXL:          `${FONT_DISPLAY} text-xl font-medium text-[${C.ink}]`,
    textXLReg:       `${FONT_DISPLAY} text-xl font-normal text-[${C.ink}]`,
    textXLSemiBold:  `${FONT_DISPLAY} text-xl font-semibold text-[${C.ink}]`,
    textXLBold:      `${FONT_DISPLAY} text-xl font-bold text-[${C.ink}]`,
    text2XL:         `${FONT_DISPLAY} text-2xl font-medium leading-tight text-[${C.ink}]`,
    text2XLReg:      `${FONT_DISPLAY} text-2xl font-normal leading-tight text-[${C.ink}]`,
    text2XLSemiBold: `${FONT_DISPLAY} text-2xl font-semibold leading-tight text-[${C.ink}]`,
    text2XLBold:     `${FONT_DISPLAY} text-2xl font-bold leading-tight text-[${C.ink}]`,
    text3XL:         `${FONT_DISPLAY} text-3xl font-medium leading-tight text-[${C.ink}]`,
    text3XLReg:      `${FONT_DISPLAY} text-3xl font-normal leading-tight text-[${C.ink}]`,
    text3XLSemiBold: `${FONT_DISPLAY} text-3xl font-semibold leading-tight text-[${C.ink}]`,
    text3XLBold:     `${FONT_DISPLAY} text-3xl font-bold leading-tight text-[${C.ink}]`,
    text4XL:         `${FONT_DISPLAY} text-4xl font-semibold leading-tight tracking-[-0.01em] text-[${C.ink}]`,
    text4XLBold:     `${FONT_DISPLAY} text-4xl font-bold leading-tight tracking-[-0.01em] text-[${C.ink}]`,
    text5XL:         `${FONT_DISPLAY} text-5xl font-semibold leading-none tracking-[-0.01em] text-[${C.ink}]`,
    text5XLBold:     `${FONT_DISPLAY} text-5xl font-bold leading-none tracking-[-0.01em] text-[${C.ink}]`,
    text6XL:         `${FONT_DISPLAY} text-6xl font-bold leading-none tracking-[-0.015em] text-[${C.ink}]`,
    text7XL:         `${FONT_DISPLAY} text-7xl font-bold leading-none tracking-[-0.015em] text-[${C.ink}]`,
    text8XL:         `${FONT_DISPLAY} text-8xl font-bold leading-none tracking-[-0.015em] text-[${C.ink}]`,

    // ----- Semantic aliases ------------------------------------------------
    body:      T.prose,
    bodySmall: T.proseSM,
    caption:   `${FONT_PROSE} text-[12px] leading-[1.5] font-normal text-[${C.mist}]`,
    label:     T.labelMD,

    button: '',
  }],
};

/* ---------- Fonts — theme-owned loader (Tailwind 4 @theme + surfaces) ------ */
/* Archivo carries a width axis (wdth 100..125); `.font-display` pins
   font-stretch:118% so the civic wide-caps cut renders everywhere.         */

const fonts = [
  // 1. Load the typefaces (Archivo w/ width axis, Public Sans, Plex Mono).
  {
    type: 'google',
    href: 'https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,100..125,400..800&family=Public+Sans:ital,wght@0,400..800;1,400..600&family=IBM+Plex+Mono:wght@400;500;600&display=swap',
  },

  // 2. Register the families with the runtime Tailwind 4 via @theme, so
  //    .font-sans / .font-mono / .font-display utilities resolve and the
  //    body picks up Public Sans via --default-font-family.
  {
    type: 'tailwind',
    id: 'landbank-tw-theme',
    content: `
      @theme {
        --font-sans: "Public Sans", ui-sans-serif, system-ui, sans-serif;
        --font-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
        --font-display: "Archivo", "Franklin Gothic Medium", ui-sans-serif, sans-serif;
        --default-font-family: "Public Sans", ui-sans-serif, system-ui, sans-serif;
      }
    `,
  },

  // 3. Belt-and-braces :root re-pin + the brand font-role classes. The
  //    mockups (and every class string in this file) use font-display /
  //    font-prose / font-meta — these exact class names must keep working.
  {
    type: 'style',
    id: 'landbank-font-stacks',
    content: `
      :root, :host {
        --font-sans: "Public Sans", ui-sans-serif, system-ui, sans-serif;
        --font-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
        --font-display: "Archivo", "Franklin Gothic Medium", ui-sans-serif, sans-serif;
        --default-font-family: "Public Sans", ui-sans-serif, system-ui, sans-serif;
      }
      html, body { font-family: var(--font-sans); }
      .font-sans    { font-family: var(--font-sans); }
      .font-mono    { font-family: var(--font-mono); }
      .font-display { font-family: var(--font-display); font-stretch: 118%; }
      .font-prose   { font-family: var(--font-sans); }
      .font-meta    { font-family: var(--font-mono); }
    `,
  },

  // 4. Brand surface utilities (mirrors design_system/_shared.css, minus the
  //    body rule and the docs-only .dms-annotated rules).
  {
    type: 'style',
    id: 'landbank-surfaces',
    content: `
      /* Surfaces */
      .lb-paper      { background: #F2F5F6; }
      .lb-paper-tint { background: #EAEFF1; }
      .lb-card {
        background: #FFFFFF;
        border: 1px solid rgba(22, 35, 44, 0.10);
        border-radius: 6px;
        box-shadow: 0 1px 2px rgba(22, 35, 44, 0.05);
      }
      .lb-card-ink   { background: #16232C; color: #fff; border-radius: 6px; }
      .lb-card-tint  { background: #F7FAFB; }

      /* Plat-map texture — survey-sheet grid behind heroes / the ink footer */
      .lb-plat {
        background:
          radial-gradient(ellipse 60% 50% at 78% 18%, rgba(10, 167, 228, 0.07), transparent 65%),
          repeating-linear-gradient(0deg,  transparent 0 47px, rgba(22, 35, 44, 0.055) 47px 48px),
          repeating-linear-gradient(90deg, transparent 0 61px, rgba(22, 35, 44, 0.055) 61px 62px),
          repeating-linear-gradient(0deg,  transparent 0 189px, rgba(22, 35, 44, 0.075) 189px 190.5px),
          repeating-linear-gradient(90deg, transparent 0 233px, rgba(22, 35, 44, 0.075) 233px 234.5px),
          #EDF2F4;
      }
      .lb-plat-ink {
        background:
          radial-gradient(ellipse 55% 45% at 80% 0%, rgba(10, 167, 228, 0.12), transparent 60%),
          repeating-linear-gradient(0deg,  transparent 0 47px, rgba(255, 255, 255, 0.045) 47px 48px),
          repeating-linear-gradient(90deg, transparent 0 61px, rgba(255, 255, 255, 0.045) 61px 62px),
          #16232C;
      }

      /* Parcel plate — the lot-geometry thumbnail on property cards */
      .lb-plate {
        background:
          repeating-linear-gradient(0deg,  transparent 0 11px, rgba(22, 35, 44, 0.05) 11px 12px),
          repeating-linear-gradient(90deg, transparent 0 11px, rgba(22, 35, 44, 0.05) 11px 12px),
          #F0F4F2;
      }
      .lb-lot {
        background:
          repeating-linear-gradient(45deg, rgba(85, 164, 48, 0.28) 0 2px, transparent 2px 7px),
          rgba(140, 198, 62, 0.14);
        border: 1.5px solid #55A430;
      }
      .lb-lot-sky {
        background:
          repeating-linear-gradient(45deg, rgba(10, 167, 228, 0.26) 0 2px, transparent 2px 7px),
          rgba(10, 167, 228, 0.10);
        border: 1.5px solid #0B87BC;
      }
      .lb-lot-slate {
        background:
          repeating-linear-gradient(45deg, rgba(90, 110, 124, 0.24) 0 2px, transparent 2px 7px),
          rgba(90, 110, 124, 0.10);
        border: 1.5px solid #5A6E7C;
      }

      /* Interaction helpers */
      .lb-press          { border-bottom-width: 3px; transition: all 0.08s ease; }
      .lb-press:active   { border-bottom-width: 1px; margin-top: 2px; }

      .dot-pulse { animation: lb-pulse 2.4s ease-in-out infinite; }
      @keyframes lb-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }

      :focus-visible { outline: 2px solid #0B87BC; outline-offset: 2px; }

      @media (prefers-reduced-motion: reduce) {
        .dot-pulse { animation: none; }
        .lb-press, .lb-press:active { transition: none; }
      }
    `,
  },
];

/* ---------- Layout ---------------------------------------------------------
   default — public site: TopNav (compact), no SideNav, paper page pane.
   app     — staff console: SideNav present (flip options per-site).
   bare    — auth / print: no chrome.                                       */

const layout = {
  options: {
    activeStyle: 0,
    sideNav: {
      size: 'none',
      nav: 'none',
      activeStyle: null,
      _replace: ['topMenu', 'bottomMenu'],
      topMenu: [{ type: 'Logo' }],
      bottomMenu: [{ type: 'UserMenu' }],
    },
    topNav: {
      size: 'compact',
      nav: 'main',
      activeStyle: null,
      _replace: ['leftMenu', 'rightMenu'],
      leftMenu: [{ type: 'Logo' }],
      rightMenu: [],
    },
  },
  styles: [
    {
      name: 'default',
      outerWrapper: `lb-paper`,
      wrapper: `relative isolate flex min-h-svh w-full max-lg:flex-col lb-paper`,
      wrapper2: `flex-1 flex items-start flex-col items-stretch max-w-full min-h-screen`,
      wrapper3: `flex flex-1 items-start`,
      // min-h + flex-col so the footer band's mt-auto pins on short pages
      childWrapper: `flex-1 flex flex-col h-full`,
    },
    {
      name: 'app',
      outerWrapper: `lb-paper`,
      wrapper: `relative isolate flex min-h-svh w-full max-lg:flex-col lb-paper`,
      wrapper2: `flex-1 flex items-start flex-col items-stretch max-w-full min-h-screen`,
      wrapper3: `flex flex-1 items-start`,
      childWrapper: `flex-1 flex flex-col h-full lb-paper`,
    },
    {
      name: 'bare',
      outerWrapper: `lb-paper`,
      wrapper: `relative isolate flex min-h-svh w-full`,
      wrapper2: `flex-1 flex flex-col w-full min-h-screen`,
      wrapper3: `flex flex-1`,
      childWrapper: `flex-1 flex flex-col h-full`,
    },
  ],
};

/* ---------- LayoutGroup — the eight named bands (layouts.html) -------------
   PUBLIC THEME NOTE: wrapper2 keeps `mx-auto` deliberately. The platform's
   mr-auto rule exists for SideNav surfaces; the public default layout has
   no SideNav — a civic website centers. Documented deviation, keep it.     */

const layoutGroup = {
  options: { activeStyle: 0 },
  styles: [
    {
      // The default body band. styles[0] = complete.
      name: 'content',
      wrapper1: `w-full lb-paper py-12`,
      wrapper2: `mx-auto w-full max-w-[1240px] px-6`,
      wrapper3: ``,
    },
    {
      // Alternating emphasis band — never two in a row.
      name: 'content_tint',
      wrapper1: `w-full lb-paper-tint border-y border-[${C.ink}]/5 py-12`,
      wrapper2: `mx-auto w-full max-w-[1240px] px-6`,
    },
    {
      // Page-opening band on the survey sheet. One per page.
      name: 'hero',
      wrapper1: `w-full lb-plat border-b ${BORDER}`,
      wrapper2: `mx-auto w-full max-w-[1240px] px-6 py-14`,
    },
    {
      // Interior page-title band (the properties dashboard opens with it).
      name: 'header',
      wrapper1: `w-full lb-plat border-b ${BORDER}`,
      wrapper2: `mx-auto w-full max-w-[1240px] px-6 py-10`,
    },
    {
      // The dark highlight band — impact numbers. At most one per page.
      name: 'feature',
      wrapper1: `w-full lb-plat-ink py-14`,
      wrapper2: `mx-auto w-full max-w-[1240px] px-6`,
    },
    {
      // Site footer — ink plat, pinned to the viewport bottom on short pages.
      name: 'footer',
      wrapper1: `w-full lb-plat-ink mt-auto`,
      wrapper2: `mx-auto w-full max-w-[1240px] px-6 pt-12 pb-6`,
    },
    {
      // Sign-in band — the one centered-and-capped-small surface.
      name: 'auth',
      wrapper1: `w-full flex-1 grid place-content-center p-6`,
      wrapper2: `mx-auto w-full max-w-md`,
    },
    {
      // Edge-to-edge canvas (staff map workbench). Pair with full_width:'show'.
      name: 'workbench',
      wrapper1: `w-full lb-paper py-6`,
      wrapper2: `w-full px-0`,
    },
  ],
};

/* ---------- TopNav — white bar, h-16, underline-active (components.html §01)
   Keys mirror ui/components/TopNav.theme.jsx exactly.                       */

const topnav = {
  options: { activeStyle: 0, maxDepth: 2 },
  styles: [{
    name: 'default',

    // Layout containers
    layoutContainer1: `sticky top-0 z-50`,
    layoutContainer2: `w-full bg-white border-b ${BORDER}`,

    // Wrappers (band + content row, centered to the public 1240 cap)
    topnavWrapper: `w-full h-16 flex items-center px-6`,
    topnavContent: `flex items-center w-full h-full max-w-[1240px] mx-auto justify-between gap-8`,

    // Slot containers
    leftMenuContainer: `flex items-center gap-3 h-full shrink-0`,
    centerMenuContainer: `hidden lg:flex items-center justify-end flex-1 h-full overflow-visible gap-1`,
    rightMenuContainer: `hidden md:flex h-full items-center gap-3 justify-end shrink-0`,
    mobileNavContainer: `py-2 bg-white border-b ${BORDER} ${FONT_PROSE} text-[13.5px] font-semibold`,

    // Mobile toggle
    mobileButton: `lg:hidden inline-flex items-center justify-center p-2 rounded-md text-[${C.slate}] hover:text-[${C.ink}] hover:bg-[${C.paper}] transition-colors cursor-pointer`,
    menuOpenIcon: `Menu`,
    menuCloseIcon: `XMark`,

    // Nav items — 13.5px semibold, underline-active on the sky rule
    navitemWrapper: `relative h-full`,
    navitemWrapper_level_2: `relative`,
    navitemWrapper_level_3: ``,

    navitem: `px-3 h-16 flex items-center gap-1.5 ${FONT_PROSE} text-[13.5px] font-semibold text-[${C.slate}] hover:text-[${C.ink}] border-b-2 border-transparent transition-colors cursor-pointer`,
    navitemActive: `px-3 h-16 flex items-center gap-1.5 ${FONT_PROSE} text-[13.5px] font-semibold text-[${C.skydeep}] border-b-2 border-[${C.sky}] cursor-pointer`,

    navIcon: `size-4 text-[${C.mist}]`,
    navIconActive: `size-4 text-[${C.skydeep}]`,

    navitemContent: `flex items-center gap-1.5`,
    navitemName: ``,
    navitemName_level_2: `w-full ${FONT_PROSE} text-[13.5px] font-semibold text-[${C.slate}] hover:text-[${C.skydeep}] hover:bg-[${C.sky}]/5 py-2 px-4 flex items-center justify-between gap-2 transition-colors cursor-pointer`,
    navitemName_level_3: `w-full ${FONT_PROSE} text-[13px] font-semibold text-[${C.slate}] hover:text-[${C.skydeep}] hover:bg-[${C.sky}]/5 py-2 px-4 transition-colors cursor-pointer`,

    navitemDescription: `hidden`,
    navitemDescription_level_2: `${FONT_PROSE} text-[12px] font-normal text-[${C.mist}] mt-0.5`,
    navitemDescription_level_3: `${FONT_PROSE} text-[12px] font-normal text-[${C.mist}] mt-0.5`,

    // Expand indicator
    indicatorIconWrapper: `size-3.5 text-[${C.mist}]`,
    indicatorIcon: `ChevronDown`,
    indicatorIconOpen: `ChevronDown`,

    // Level-1 submenu (flyout below the item)
    subMenuWrapper: `absolute top-full left-0 z-50`,
    subMenuWrapper2: `w-56 bg-white rounded-md border ${BORDER} shadow-lg py-1.5`,

    // Level-2 submenu (flyout to the right)
    subMenuWrapper_level_2: `absolute left-full top-0 ml-1 z-50`,
    subMenuWrapper2_level_2: `w-56 bg-white rounded-md border ${BORDER} shadow-lg py-1.5`,

    subMenuItemsWrapper: `flex flex-col`,
    subMenuItemsWrapperParent: `flex flex-col`,

    subMenuParentWrapper: `hidden`,
    subMenuParentContent: `px-4 py-2 border-b ${BORDER} mb-1`,
    subMenuParentName: `${FONT_META} text-[9.5px] font-medium uppercase tracking-[0.14em] text-[${C.mist}]`,
    subMenuParentDesc: `${FONT_PROSE} text-[12px] text-[${C.mist}] mt-0.5`,
    subMenuParentLink: `${FONT_PROSE} text-[12px] font-semibold text-[${C.skydeep}] hover:text-[${C.ink}] mt-1 inline-block`,
  }],
};

/* ---------- SideNav — the ink staff-console rail (components.html §01) -----
   Keys mirror ui/components/SideNav.theme.jsx exactly. Level-1 active is
   bg-white/10 + white text + leaf left rail; level-2 is indented 12px.     */

const sidenav = {
  options: { activeStyle: 0 },
  styles: [{
    name: 'default',

    // Layout containers
    layoutContainer1: `lg:pl-60`,
    layoutContainer2: `fixed inset-y-0 left-0 w-60 max-lg:hidden`,

    // Logo area — the mark sits in a white chip on the ink ground
    logoWrapper: `flex items-center h-14 px-3 gap-2.5 bg-black/25 border-b border-white/10`,

    // The rail
    sidenavWrapper: `flex flex-col w-60 h-full bg-[${C.ink}]`,

    // Menu structure
    menuItemWrapper: `flex flex-1 flex-col`,
    menuItemWrapper_level_1: ``,
    menuItemWrapper_level_2: ``,
    menuItemWrapper_level_3: ``,
    menuItemWrapper_level_4: ``,

    // Nav rows
    navitemSide: `group w-full flex items-center px-4 py-2.5 ${FONT_PROSE} text-[13.5px] font-semibold text-white/70 hover:text-white hover:bg-white/5 border-l-[3px] border-transparent cursor-pointer transition-colors`,
    navitemSideActive: `group w-full flex items-center px-4 py-2.5 ${FONT_PROSE} text-[13.5px] font-semibold bg-white/10 text-white border-l-[3px] border-[${C.leaf}] cursor-pointer`,

    // Icons
    menuIconSide: `size-[18px] mr-3 text-white/50 group-hover:text-white/80 transition-colors`,
    menuIconSideActive: `size-[18px] mr-3 text-[${C.leaf}]`,

    forcedIcon: ``,
    forcedIcon_level_1: ``,
    forcedIcon_level_2: ``,
    forcedIcon_level_3: ``,
    forcedIcon_level_4: ``,

    // Scroll container
    itemsWrapper: `flex-1 overflow-y-auto py-2 scrollbar-sm`,

    // Row content (level-2+ indented, smaller, white/60)
    navItemContent: `flex items-center gap-2 flex-1`,
    navItemContent_level_1: ``,
    navItemContent_level_2: `pl-7 text-[12px] text-white/60`,
    navItemContent_level_3: `pl-10 text-[12px] text-white/60`,
    navItemContent_level_4: `pl-12 text-[12px] text-white/60`,

    // Expand indicators
    indicatorIcon: `ChevronRight`,
    indicatorIconOpen: `ChevronDown`,
    indicatorIconWrapper: `size-3 text-white/40 transition-transform duration-200`,

    // Submenu shells
    subMenuWrapper_1: `mt-0.5 space-y-0.5`,
    subMenuWrapper_2: `mt-0.5 space-y-0.5`,
    subMenuWrapper_3: `mt-0.5 space-y-0.5`,
    subMenuOuterWrapper: ``,
    subMenuParentWrapper: `flex flex-col`,
    subMenuTitle: `hidden`,

    // Bottom slot — user chip + role
    bottomMenuWrapper: `mt-auto border-t border-white/10 py-2.5 px-4`,

    // Section divider + heading (metaXS on white/40)
    sectionDivider: `my-2 border-t border-white/10`,
    sectionHeading: `px-4 pt-3 pb-1 ${FONT_META} text-[9.5px] font-medium uppercase tracking-[0.16em] text-white/40`,

    // Mobile-collapse topnav strip
    topnavWrapper: `w-full h-14 flex items-center px-4`,
    topnavContent: `flex items-center w-full h-full bg-[${C.ink}] justify-between`,
    topnavMenu: `hidden lg:flex items-center flex-1 h-full overflow-visible`,
    topmenuRightNavContainer: `flex items-center gap-2`,
    topnavMobileContainer: `bg-[${C.ink}] border-b border-white/10`,
  }],
};

/* ---------- NavigableMenu — the white context menu (components.html §01) --- */

const navigableMenu = {
  options: { activeStyle: 0 },
  styles: [{
    name: 'default',
    button: `px-1 py-0.5 cursor-pointer text-[${C.mist}] hover:text-[${C.ink}]`,
    buttonHidden: `flex sm:hidden group-hover:flex`,
    icon: `Menu`,
    iconWrapper: `size-6`,

    menuWrapper: `bg-white border ${BORDER} w-80 p-1 min-h-[75px] rounded-md shadow-lg`,

    menuHeaderWrapper: `flex px-3 py-1.5 justify-between`,
    menuHeaderContent: `flex gap-2 items-center w-full`,
    menuTitle: `${FONT_DISPLAY} font-semibold text-[15px] text-[${C.ink}]`,
    backButton: `w-fit`,
    backIcon: `ArrowLeft`,
    backIconWrapper: `size-4 text-[${C.slate}]`,
    closeButton: `w-fit`,
    menuCloseIcon: `XMark`,
    menuCloseIconWrapper: `cursor-pointer size-4 text-[${C.mist}] hover:text-[${C.ink}]`,

    menuItemsWrapper: `max-h-[80vh] overflow-y-auto scrollbar-sm`,
    menuItem: `group flex w-full gap-1 items-center justify-between px-3 py-2 rounded ${FONT_PROSE} text-[13.5px] text-[${C.slate}]`,
    menuItemHover: `hover:bg-[${C.sky}]/10 hover:text-[${C.ink}]`,
    menuItemIconLabelWrapper: `flex flex-1 items-center gap-1.5`,
    menuItemIconWrapper: `min-w-4 size-4 text-[${C.mist}] group-hover:text-[${C.skydeep}]`,
    menuItemLabel: ``,
    menuItemLabelLink: `cursor-pointer`,

    subMenuIcon: `ChevronRight`,
    subMenuIconWrapper: `place-self-center size-3.5 text-[${C.mist}]`,
    valueSubmenuIconWrapper: `flex gap-0.5 items-center`,
    valueWrapper: `px-1.5 py-0.5 rounded bg-[${C.papertint}] ${FONT_META} text-[11px] text-[${C.slate}] tabular-nums whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]`,

    separator: `w-full border-b border-[${C.ink}]/5`,

    breadcrumbWrapper: `flex items-center flex-wrap gap-1 px-3 py-1.5 ${FONT_PROSE} text-[12px] text-[${C.mist}] overflow-x-auto`,
    breadcrumbItem: `font-semibold text-[${C.skydeep}] hover:text-[${C.ink}] cursor-pointer whitespace-nowrap`,
    breadcrumbItemActive: `text-[${C.slate}] whitespace-nowrap`,
    breadcrumbSeparator: `text-[${C.mist}]`,
  }],
};

/* ---------- Logo — the ACLB mark (never recolored; white chip on dark) ----- */

const logo = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: 'default',
      logoWrapper: `h-16 flex px-0 items-center shrink-0`,
      logoAltImg: `rounded-md h-9 w-9 bg-[${C.skydeep}]`,
      imgWrapper: ``,
      img: '/themes/landbank/aclb-logo.png',
      imgClass: `h-10 w-auto`,
      titleWrapper: `sr-only`,
      title: 'Albany County Land Bank',
      linkPath: '/',
    },
    {
      // On dark grounds the logo sits in a white chip — the mark is never
      // recolored (SideNav logo slot, footer brand block).
      name: 'dark_chip',
      logoWrapper: `flex px-0 py-0 items-center`,
      logoAltImg: `rounded-md h-7 w-7 bg-white`,
      imgWrapper: `bg-white rounded px-1.5 py-1 inline-flex`,
      img: '/themes/landbank/aclb-logo.png',
      imgClass: `h-6 w-auto`,
      titleWrapper: `sr-only`,
      title: 'Albany County Land Bank',
      linkPath: '/',
    },
  ],
};

/* ---------- Button — five named styles; names drive the Lexical /Button
   dialog's style dropdown. Primary/cta/danger use the .lb-press effect
   (3px bottom border collapses on :active).                                */

const BTN_BASE = `cursor-pointer inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md ${FONT_PROSE} text-[13.5px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[${C.skydeep}]/40 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed`;

const button = {
  options: { activeStyle: 0 },
  styles: [
    {
      // Primary — skydeep press; hover darkens to ink.
      name: 'default',
      button: `lb-press ${BTN_BASE} bg-[${C.skydeep}] hover:bg-[${C.ink}] border-b-[3px] border-[${C.ink}]/40 text-white`,
    },
    {
      // CTA green — the for-sale action.
      name: 'cta',
      button: `lb-press ${BTN_BASE} bg-[${C.field}] hover:bg-[${C.forest}] border-b-[3px] border-[${C.forest}] text-white`,
    },
    {
      // Secondary — white, hairline border.
      name: 'secondary',
      button: `${BTN_BASE} bg-white hover:bg-[${C.paper}] border border-[${C.ink}]/15 text-[${C.ink}]`,
    },
    {
      // Ghost — text-only skydeep.
      name: 'plain',
      button: `cursor-pointer inline-flex items-center gap-1.5 h-10 px-2 rounded-md ${FONT_PROSE} text-[13.5px] font-semibold text-[${C.skydeep}] hover:text-[${C.ink}] focus:outline-none focus-visible:ring-2 focus-visible:ring-[${C.skydeep}]/40 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed`,
    },
    {
      // Danger — rose press.
      name: 'danger',
      button: `lb-press ${BTN_BASE} bg-[${C.rose}] hover:bg-[${C.rosedeep}] border-b-[3px] border-[${C.rosedeep}] text-white`,
    },
  ],
};

/* ---------- Input (flat) ---------------------------------------------------- */

const input = {
  input: `relative w-full block appearance-none h-10 px-3 rounded bg-white border border-[${C.ink}]/15 ${FONT_PROSE} text-[13.5px] text-[${C.ink}] placeholder:text-[${C.mist}] hover:border-[${C.ink}]/25 focus:border-[${C.skydeep}] focus:outline-none aria-invalid:border-[${C.rose}] aria-invalid:hover:border-[${C.rose}] disabled:bg-[${C.papertint}] disabled:text-[${C.mist}] disabled:border-[${C.ink}]/10 transition-colors`,
  inputContainer: `group flex relative w-full`,
  textarea: `relative block h-full w-full appearance-none p-3 rounded bg-white border border-[${C.ink}]/15 ${FONT_PROSE} text-[13.5px] text-[${C.ink}] placeholder:text-[${C.mist}] hover:border-[${C.ink}]/25 focus:border-[${C.skydeep}] focus:outline-none aria-invalid:border-[${C.rose}] disabled:bg-[${C.papertint}] disabled:text-[${C.mist}] resize-y transition-colors`,
  confirmButtonContainer: `absolute right-0 hidden group-hover:flex items-center`,
  editButton: `py-1.5 px-2 text-[${C.mist}] hover:text-[${C.skydeep}] cursor-pointer bg-white/10`,
  cancelButton: `text-[${C.mist}] hover:text-[${C.rosedeep}] cursor-pointer py-1.5 pr-1`,
  confirmButton: `text-[${C.field}] hover:text-white hover:bg-[${C.field}] cursor-pointer rounded-full`,
};

/* ---------- MultiSelect — white trigger, sky token chips, check menu -------- */

const multiselect = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: 'default',
      view: `w-full h-full`,
      mainWrapper: `group relative block w-full h-full`,

      // Trigger shell (closed: hairline; open/focus: skydeep border)
      inputWrapper: `relative flex flex-wrap items-center gap-1.5 w-full min-h-10 rounded cursor-pointer px-3 py-1.5 pr-8 bg-white border border-[${C.ink}]/15 hover:border-[${C.skydeep}]/50 ${FONT_PROSE} text-[13.5px] text-[${C.ink}] focus-within:border-[${C.skydeep}] transition-colors`,
      caretWrapper: `pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5`,
      caretIcon: `size-4 text-[${C.mist}]`,

      // Search input inside the open menu
      input: `block w-full appearance-none rounded focus:outline-none px-3 py-2 ${FONT_PROSE} text-[13.5px] border-b ${BORDER} bg-white text-[${C.ink}] placeholder:text-[${C.mist}]`,

      statusWrapper: `flex items-center ${FONT_PROSE} text-[13.5px] text-[${C.slate}]`,
      singleValue: `truncate ${FONT_PROSE} text-[13.5px] text-[${C.ink}]`,
      singlePlaceholder: `truncate ${FONT_PROSE} text-[13.5px] text-[${C.mist}]`,
      singleClearWrapper: `absolute inset-y-0 right-7 flex items-center cursor-pointer text-[${C.mist}] hover:text-[${C.rosedeep}]`,

      // Selected-value chips — sky tint tokens
      tokenWrapper: `inline-flex items-center gap-1 h-6 px-2 rounded-full bg-[${C.sky}]/10 text-[${C.skydeep}] ${FONT_PROSE} text-[12px] font-semibold whitespace-nowrap transition-colors`,
      removeIcon: `inline-flex items-center self-center cursor-pointer text-[${C.skydeep}] hover:text-[${C.rosedeep}]`,
      removeIconName: `XMark`,
      removeIconClass: `size-3`,

      // Menu shells
      menuWrapper: `isolate min-w-[var(--button-width,10rem)] p-1 rounded-md bg-white border ${BORDER} shadow-lg`,
      alwaysOpenMenuWrapper: `w-full p-1 rounded-md z-20 bg-white border ${BORDER}`,
      tabularMenuWrapper: `flex flex-row flex-wrap gap-1.5 p-1.5 w-full rounded-md z-20 bg-white border ${BORDER}`,

      optionsWrapper: `mt-1 max-h-[300px] overflow-auto scrollbar-sm`,
      menuItem: `flex items-center gap-2.5 rounded cursor-pointer outline-none px-3 py-2 ${FONT_PROSE} text-[13.5px] text-[${C.slate}] hover:bg-[${C.sky}]/5 hover:text-[${C.ink}] transition-colors`,

      smartMenuWrapper: `flex flex-wrap gap-1`,
      smartMenuItem: `inline-flex items-center rounded-full h-6 px-2 ${FONT_PROSE} text-[12px] font-semibold cursor-pointer bg-[${C.sky}]/10 text-[${C.skydeep}] hover:bg-[${C.sky}]/20 transition-colors`,

      error: `p-1 ${FONT_PROSE} text-[12px] text-[${C.rosedeep}] font-medium`,
      selectedValueIconName: `CircleCheck`,
      selectedValueIcon: `size-4 text-[${C.skydeep}]`,
    },
    {
      // Borderless control for use INSIDE the filter chip design — the
      // filters `chip` style names this via controlStyle.
      name: 'filter_chip',
      inputWrapper: `relative flex flex-wrap items-center gap-1 w-fit min-w-[5rem] min-h-7 cursor-pointer pl-1 pr-6 py-0.5 bg-transparent border-0 ${FONT_PROSE} text-[12px] font-semibold text-[${C.skydeep}]`,
      caretWrapper: `pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1`,
      caretIcon: `size-3.5 text-[${C.skydeep}]`,
      tokenWrapper: `inline-flex items-center gap-1 px-1 text-[${C.skydeep}] ${FONT_PROSE} text-[12px] font-semibold whitespace-nowrap`,
      singleValue: `truncate ${FONT_PROSE} text-[12px] font-semibold text-[${C.skydeep}]`,
      singlePlaceholder: `truncate ${FONT_PROSE} text-[12px] font-semibold text-[${C.skydeep}]/60`,
    },
  ],
};

/* ---------- Tabs — underline tabs on the sky rule --------------------------- */

const tabs = {
  options: { activeStyle: 0 },
  styles: [{
    name: 'default',
    tabGroup: `flex flex-col-reverse`,
    tablist: `flex border-b ${BORDER} ${FONT_PROSE} text-[13.5px] font-semibold`,
    tab: `px-4 h-10 flex items-center text-[${C.slate}] hover:text-[${C.ink}] border-b-2 border-transparent -mb-px focus:outline-none aria-selected:text-[${C.skydeep}] aria-selected:border-[${C.sky}] cursor-pointer transition-colors`,
    tabpanels: `w-full`,
    tabpanel: ``,
  }],
};

/* ---------- FieldSet (flat — keys: field, labelRow, label, description) ----- */

const field = {
  field: `pb-2`,
  labelRow: `flex items-center justify-between`,
  label: `select-none ${FONT_PROSE} text-[12px] leading-[1.2] font-semibold text-[${C.ink}] mb-1`,
  description: `${FONT_PROSE} text-[12px] leading-[1.5] text-[${C.mist}] mt-1.5`,
};

/* ---------- Label (flat — keys: labelWrapper, label) ------------------------ */

const label = {
  labelWrapper: `px-1 py-1`,
  label: `inline-flex items-center rounded-full h-6 px-2.5 ${FONT_PROSE} text-[12px] font-semibold bg-[${C.papertint}] text-[${C.slate}]`,
};

/* ---------- Icon (flat) ------------------------------------------------------ */

const icon = {
  iconWrapper: ``,
  icon: `size-6 fill-none`,
};

/* ---------- Dialog (flat) — ink-scrim backdrop, white rounded-md panel ------ */

const dialog = {
  dialogContainer: `fixed z-50 inset-0 w-screen overflow-y-auto pt-6 sm:pt-0`,
  backdrop: `fixed inset-0 bg-[${C.ink}]/40 pointer-events-none`,
  dialogContainer2: `relative grid min-h-full grid-rows-[1fr_auto] justify-items-center sm:grid-rows-[1fr_auto_3fr] sm:p-4`,
  dialogPanel: `row-start-2 w-full p-5 min-w-0 rounded-t-md sm:rounded-md bg-white shadow-lg sm:mb-auto forced-colors:outline`,
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

/* ---------- Modal — panel + the header/title/closeButton/body keys the
   Lexical plugin dialogs read via useModal (all five keys shipped).        */

const modal = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: 'default',
      panel: `relative transform overflow-hidden rounded-md bg-white p-5 text-left shadow-lg sm:my-8 sm:w-full sm:max-w-lg`,
      header: `flex items-center justify-between mb-4 pb-3 border-b ${BORDER}`,
      title: `${FONT_DISPLAY} font-semibold text-[17px] leading-[1.3] text-[${C.ink}]`,
      closeButton: `cursor-pointer p-1 text-[${C.mist}] hover:text-[${C.ink}]`,
      body: `${FONT_PROSE} text-[13.5px] leading-[1.55] text-[${C.slate}]`,
    },
    {
      name: 'wide',
      panel: `relative transform overflow-hidden rounded-md bg-white p-5 text-left shadow-lg sm:my-8 sm:w-full sm:max-w-7xl`,
    },
  ],
};

/* ---------- DialogActions — the Confirm/Cancel row at a dialog's foot ------- */

const dialogActions = {
  wrapper: `flex items-center justify-end gap-2 mt-4 pt-3 border-t ${BORDER}`,
};

/* ---------- dataCard — the workhorse Card section (card.theme.jsx keys) -----
   Default: metaSM mist headers over display-ink values, hairline cell
   borders, 6px radius, sky link color. `kpi` = the border-t accent stat
   tile from components.html §04.                                           */

const dataCard = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: 'default',

      // v2 layout model (see card.theme.jsx + Card.layout.js): cards-grid
      // rows content-sized/packed by default (`cardsVerticalAlign:'stretch'`
      // opts into fill), no transparent cell border (+2px) — edit hover uses
      // an outline — and the ambient cell gutter is the single `cellGutter`
      // below (emitted inline, so explicit knobs including 0 always win;
      // headerValueWrapper therefore carries NO padding class).
      layoutModel: 'v2',
      cellGutter: 8,
      itemEditOutline: `outline outline-[${C.sky}] -outline-offset-1`,

      header: `w-full ${FONT_META} text-[11px] leading-[1.4] font-medium uppercase tracking-[0.16em] text-[${C.mist}]`,
      // Layout-only. Typography comes from the column's valueFontStyle token
      // (textSettings; Card falls back to `textXS` when unset). Baking a font
      // spec here (the v0.1 displaySM classes) collided with EVERY chosen
      // token — both class strings land on the cell and the arbitrary-value
      // utilities (text-[17px] vs text-[12px]) resolve by stylesheet order,
      // not author intent.
      value: `w-full`,
      // No min-height: a 20px floor under short content (a 10px data_bar
      // track) reads as phantom padding above/below the bar in tight lists.
      valueWrapper: ``,
      description: `w-full ${FONT_PROSE} text-[12px] leading-[1.5] font-normal text-[${C.slate}]`,

      columnControlWrapper: `grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-x-1 gap-y-0.5`,
      columnControlHeaderWrapper: `px-1 ${FONT_PROSE} font-semibold border ${BORDER} bg-[${C.paper}] text-[${C.slate}]`,

      mainWrapperCompactView: `grid`,
      mainWrapperSimpleView: `flex flex-col`,

      subWrapper: `w-full`,
      // No rounded-* / bg-* here — the SECTION owns border/radius/bg
      // (see the section layout model, skill §3.1.58).
      subWrapperCompactView: `flex flex-col`,
      subWrapperSimpleView: `grid`,

      headerValueWrapper: `w-full rounded-md flex items-center justify-center`,
      headerValueWrapperCompactView: `py-0`,
      headerValueWrapperSimpleView: ``,
      headerValueWrapperFullBleed: `w-full relative overflow-hidden`,
      componentWrapper: `w-full`,
      headerValueWrapperBorderBelow: `border-b rounded-none`,

      // Per-side cell borders — the one border tone.
      cellBorderSides: {
        top:    `border-t border-t-[${C.ink}]/10`,
        right:  `border-r border-r-[${C.ink}]/10`,
        bottom: `border-b border-b-[${C.ink}]/10`,
        left:   `border-l border-l-[${C.ink}]/10`,
      },

      // Per-card chrome for multi-card grids (the record-card look).
      itemBorder: `bg-white border ${BORDER} rounded-md shadow-[0_1px_2px_rgba(22,35,44,0.05)]`,
      cardBorder: `bg-white border ${BORDER} rounded-md shadow-[0_1px_2px_rgba(22,35,44,0.05)]`,
      itemFlexCol: `flex-col`,
      itemFlexRow: `flex-row`,
      itemFlexColReverse: `flex-col flex-col-reverse`,
      itemFlexRowReverse: `flex-row flex-row-reverse`,
      iconAndColorValues: `flex items-center gap-1.5 uppercase`,

      formEditButtonsWrapper: `w-fit justify-self-end self-end flex gap-0.5`,
      formAddNewItemWrapper: `w-fit justify-self-end self-end`,

      justifyTextLeft: `text-start justify-items-start rounded-md`,
      justifyTextRight: `text-end justify-items-end rounded-md`,
      justifyTextCenter: `text-center justify-items-center rounded-md`,

      // Link cells default to the brand link (authors can re-style via
      // valueFontStyle).
      linkColValue: `text-[${C.skydeep}] ${FONT_PROSE} font-semibold underline decoration-[${C.sky}]/40 underline-offset-2 hover:decoration-[${C.sky}]`,

      imgXS: `max-w-16 max-h-16`,
      imgSM: `max-w-24 max-h-24`,
      imgMD: `max-w-32 max-h-32`,
      imgXL: `max-w-40 max-h-40`,
      img2XL: `max-w-48 max-h-48`,
      img3XL: `max-w-56 max-h-56`,
      img4XL: `max-w-64 max-h-64`,
      img5XL: `max-w-72 max-h-72`,
      img6XL: `max-w-80 max-h-80`,
      img7XL: `max-w-96 max-h-96`,
      img8XL: `max-w-128 max-h-128`,
      imgDefault: `max-w-[50px] max-h-[50px]`,
    },
    {
      // The stat tile — white card with a 2px status-color top accent,
      // metaXS mist header over a big display numeral (KPI = displayXL +
      // tabular-nums per theme.html). Swap the accent color per card via
      // the section border controls when needed.
      name: 'kpi',
      header: `w-full ${FONT_META} text-[9.5px] leading-[1.3] font-medium uppercase tracking-[0.14em] text-[${C.mist}]`,
      value: `w-full ${FONT_DISPLAY} font-bold text-[38px] leading-[1.1] tracking-[-0.01em] text-[${C.ink}] tabular-nums`,
      description: `w-full ${FONT_PROSE} text-[12px] leading-[1.5] font-normal text-[${C.slate}]`,
      itemBorder: `bg-white border ${BORDER} border-t-2 border-t-[${C.field}] rounded-md shadow-[0_1px_2px_rgba(22,35,44,0.05)]`,
      cardBorder: `bg-white border ${BORDER} border-t-2 border-t-[${C.field}] rounded-md shadow-[0_1px_2px_rgba(22,35,44,0.05)]`,
      // v2 (inherited from default): gutter is data, not a class — 16px
      // ambient, overridable per section/cell (was `p-4`).
      cellGutter: 16,
      headerValueWrapper: `w-full rounded-md flex flex-col items-start justify-center gap-1`,
    },
  ],
};

/* ---------- Pill — the seven-status system, rendered (theme.html#status) ----
   Tinted ground at /10, deep text pair, no border. Legacy color names and
   the status_pill column-type variants map onto the same seven recipes.    */

const PILL = `inline-flex h-6 items-center px-2.5 rounded-full ${FONT_PROSE} text-[12px] font-semibold`;

const pillForSale       = `${PILL} bg-[${C.field}]/10 text-[${C.forest}]`;
const pillAclbRehab     = `${PILL} bg-[${C.sky}]/10 text-[${C.skydeep}]`;
const pillSalePending   = `${PILL} bg-[${C.amber}]/10 text-[${C.amberdeep}]`;
const pillCoDevelopment = `${PILL} bg-[${C.violet}]/10 text-[${C.violetdeep}]`;
const pillInProcess     = `${PILL} bg-[${C.steel}]/10 text-[${C.slate}]`;
const pillOnHold        = `${PILL} bg-[${C.rose}]/10 text-[${C.rosedeep}]`;
const pillSold          = `${PILL} bg-[${C.ink}]/5 text-[${C.slate}]`;

const pill = {
  options: { activeStyle: 0 },
  styles: [
    // Default — the neutral tag chip (white, hairline, metaXS-ish).
    { name: 'default', wrapper: `inline-flex h-6 items-center gap-1.5 px-2.5 rounded-full bg-white border ${BORDER} text-[${C.slate}] ${FONT_META} font-medium text-[10px] uppercase tracking-[0.12em]` },

    // The seven statuses (canonical names).
    { name: 'for_sale',       wrapper: pillForSale },
    { name: 'aclb_rehab',     wrapper: pillAclbRehab },
    { name: 'sale_pending',   wrapper: pillSalePending },
    { name: 'co_development', wrapper: pillCoDevelopment },
    { name: 'in_process',     wrapper: pillInProcess },
    { name: 'on_hold',        wrapper: pillOnHold },
    { name: 'sold',           wrapper: pillSold },

    // Legacy color-prop names (Pill.jsx back-compat) → nearest status recipe.
    { name: 'gray',   wrapper: pillSold },
    { name: 'orange', wrapper: pillSalePending },
    { name: 'blue',   wrapper: pillAclbRehab },
    { name: 'green',  wrapper: pillForSale },
    { name: 'red',    wrapper: pillOnHold },
    { name: 'violet', wrapper: pillCoDevelopment },

    // status_pill column-type variants.
    { name: 'status_good', wrapper: pillForSale },
    { name: 'status_warn', wrapper: pillSalePending },
    { name: 'status_bad',  wrapper: pillOnHold },
    { name: 'status_na',   wrapper: pillInProcess },
  ],
};

/* ---------- Table — the ledger recipe (components.html §05) -----------------
   papertint/60 header band, 12px semibold slate header labels, hairline
   ink/5 row rules, sky-wash row hover, mono numerals. Keys mirror
   ui/components/table/table.theme.jsx.                                     */

const table = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: 'default',
      tableContainer: `flex flex-col overflow-x-auto min-h-[40px] max-h-[calc(78vh_-_10px)] overflow-y-auto rounded-md border ${BORDER} bg-white`,
      tableContainerNoPagination: ``,

      headerContainer: `sticky top-0 grid z-[2]`,
      headerLeftGutter: `flex justify-between sticky left-0 z-[1]`,
      headerWrapper: `flex justify-between border-b ${BORDER}`,
      headerCellContainer: `w-full px-3 py-2 content-center ${FONT_PROSE} text-[12px] font-semibold text-[${C.slate}]`,
      headerCellContainerBgSelected: `bg-[${C.sky}]/10 text-[${C.ink}]`,
      headerCellContainerBg: `bg-[${C.papertint}]/60 text-[${C.slate}]`,
      colResizer: `z-5 -ml-2 w-[1px] hover:w-[2px] bg-[${C.ink}]/10 hover:bg-[${C.mist}]`,

      wrapText: `whitespace-pre-wrap`,
      cell: `relative flex items-center min-h-[35px] border-b border-[${C.ink}]/5`,
      cellInner: `w-full min-h-full flex flex-wrap items-center truncate py-1 px-3 ${FONT_PROSE} font-normal text-[13px] leading-[18px] text-[${C.slate}]`,
      cellBgOdd: `bg-[${C.papertint}]/30 hover:bg-[${C.sky}]/5`,
      cellBgEven: `bg-white hover:bg-[${C.sky}]/5`,
      cellBg: `bg-white hover:bg-[${C.sky}]/5`,
      cellBgSelected: `bg-[${C.sky}]/10 hover:bg-[${C.sky}]/15`,
      totalCell: `hover:bg-[${C.papertint}]`,
      cellEditableTextBox: `absolute border border-[${C.skydeep}] rounded bg-white focus:outline-none min-w-[180px] min-h-[50px] z-[10] whitespace-pre-wrap ${FONT_PROSE} text-[13px]`,
      cellFrozenCol: ``,
      cellInvalid: `bg-[${C.rose}]/10 hover:bg-[${C.rose}]/15`,
      gutterCellWrapper: `flex ${FONT_META} text-[10px] items-center justify-center cursor-pointer sticky left-0 z-[1]`,
      gutterCellWrapperNotSelected: `bg-[${C.papertint}]/60 text-[${C.mist}]`,
      gutterCellWrapperSelected: `bg-[${C.sky}]/10 text-[${C.ink}]`,

      paginationInfoContainer: ``,
      paginationPagesInfo: `${FONT_META} font-medium text-[11px] uppercase tracking-[0.12em] text-[${C.slate}] leading-[18px]`,
      paginationRowsInfo: `${FONT_META} text-[11px] text-[${C.mist}]`,
      paginationContainer: `w-full p-2 flex items-center justify-between border-t ${BORDER} bg-white`,
      paginationControlsContainer: `flex flex-row items-center overflow-hidden gap-1`,
      pageRangeItem: `cursor-pointer size-8 flex items-center justify-center rounded border border-[${C.ink}]/15 text-[${C.slate}] ${FONT_PROSE} text-[12px] font-semibold hover:border-[${C.skydeep}]/50`,
      pageRangeItemInactive: ``,
      pageRangeItemActive: `bg-[${C.skydeep}] border-[${C.skydeep}] text-white`,

      totalRow: `bg-[${C.papertint}]/60 sticky bottom-0 z-[3] ${FONT_META} font-medium tabular-nums`,
      stripedRow: `even:bg-[${C.papertint}]/30`,

      openOutContainer: `w-[330px] overflow-auto scrollbar-sm flex flex-col gap-3 p-4 bg-white h-full float-right border-l ${BORDER}`,
      openOutContainerWrapper: `fixed inset-0 right-0 h-full w-full z-[100]`,
      openOutHeader: `${FONT_DISPLAY} font-semibold text-[17px] text-[${C.ink}]`,
      openOutCloseIconContainer: `w-full flex justify-end`,
      openOutCloseIconWrapper: `w-fit h-fit p-2 text-[${C.slate}] border ${BORDER} rounded-full cursor-pointer hover:bg-[${C.paper}]`,
      openOutCloseIcon: `XMark`,
      openOutContainerWrapperBgColor: `rgba(22,35,44,0.4)`,
      openOutIconWrapper: `px-2 cursor-pointer bg-transparent text-[${C.mist}] hover:text-[${C.skydeep}]`,
      openOutBelowRow: false,
      openOutHideTitle: false,

      pivotGroupHeader: `bg-[${C.papertint}] text-[${C.slate}] text-center border-b border-r ${BORDER} ${FONT_PROSE} text-[12px] font-semibold`,

      headerCellWrapper: `relative w-full`,
      headerCellBtn: `group inline-flex items-center w-full justify-between gap-x-1.5 rounded cursor-pointer`,
      headerCellLabel: `truncate select-none`,
      headerCellBtnActive: `bg-[${C.sky}]/10`,
      headerCellFnIconClass: `text-[${C.mist}]`,
      headerCellCountIcon: `TallyMark`,
      headerCellListIcon: `LeftToRightListBullet`,
      headerCellSumIcon: `Sum`,
      headerCellAvgIcon: `Avg`,
      headerCellGroupIcon: `Group`,
      headerCellSortAscIcon: `SortAsc`,
      headerCellSortDescIcon: `SortDesc`,
      headerCellMenuIcon: `ChevronDown`,
      headerCellMenuIconClass: `text-[${C.mist}] group-hover:text-[${C.slate}] transition ease-in-out duration-200 print:hidden`,
      headerCellIconWrapper: `flex items-center`,
      headerCellMenu: `py-1 flex flex-col gap-0.5 items-center px-1 ${FONT_PROSE} text-[12px] text-[${C.slate}] font-normal max-h-[500px] min-w-[180px] z-[10] overflow-auto scrollbar-sm bg-white divide-y divide-[${C.ink}]/5 rounded-md shadow-lg border ${BORDER}`,
      headerCellControlWrapper: `w-full group px-2 py-1 flex justify-between items-center rounded hover:bg-[${C.sky}]/5`,
      headerCellControlLabel: `w-fit font-normal text-[${C.mist}] cursor-default`,
      headerCellControl: `p-0.5 w-full rounded bg-white group-hover:bg-[${C.sky}]/5 cursor-pointer`,
    },
    {
      // Chrome-less variant for tables fused inside a section card (the
      // compact-card pattern): the SECTION inner box draws the border and
      // radius, so the table itself is flush — no border, no rounding.
      // All other keys inherit from styles[0].
      name: 'flush',
      tableContainer: `flex flex-col overflow-x-auto min-h-[40px] max-h-[calc(78vh_-_10px)] overflow-y-auto bg-white`,
    },
    {
      // openOut opens inline below the row (inherits everything else).
      name: 'below-row',
      openOutContainer: `w-full flex flex-col bg-white`,
      openOutContainerWrapper: `w-full`,
      openOutContainerWrapperBgColor: `transparent`,
      openOutHeader: `${FONT_DISPLAY} font-semibold text-[15px] text-[${C.ink}]`,
      openOutCloseIconContainer: `hidden`,
      openOutCloseIconWrapper: ``,
      openOutCloseIcon: `XMark`,
      openOutIconWrapper: `hidden`,
      openOutBelowRow: true,
      openOutHideTitle: true,
    },
  ],
};

/* ---------- Lexical — flat keys; headings set EXPLICITLY (gotcha #4) -------- */

const lexical = {
  options: { activeStyle: 0 },
  styles: [{
    name: 'default',

    // Shell (structural — keep)
    editorScroller: `min-h-[150px] border-0 flex relative outline-0 z-0 resize-y`,
    viewScroller: `border-0 flex relative outline-0 z-0 resize-none`,
    editorContainer: `relative block min-h-[50px]`,
    editorShell: `${FONT_PROSE} text-[15px] leading-[1.65] text-[${C.slate}]`,
    contentEditable: `border-none relative [tab-size:1] outline-none outline-0`,

    // Paragraph
    paragraph: `${FONT_PROSE} text-[15px] leading-[1.65] text-[${C.slate}] mb-4`,

    // Headings — the display ladder, explicit so the codebase default's
    // font-display-with-wrong-sizes rule can't shadow the brand tokens.
    heading_h1: `${T.displayHero} mt-0 mb-4`,
    heading_h2: `${T.displayXL} mt-0 mb-3`,
    heading_h3: `${T.displayLG} mt-0 mb-3`,
    heading_h4: `${T.displayMD} mt-0 mb-2`,
    heading_h5: `${T.displaySM} mt-0 mb-1`,
    heading_h6: `${T.displayXS} mt-0 mb-1`,

    // Lists
    list_ol: `${FONT_PROSE} list-decimal pl-5 mb-4 marker:text-[${C.mist}]`,
    list_ul: `${FONT_PROSE} list-disc pl-5 mb-4 marker:text-[${C.mist}]`,
    list_listitem: `${FONT_PROSE} text-[15px] leading-[1.65] text-[${C.slate}] mb-1`,
    list_nested_listitem: `list-none before:hidden after:hidden`,

    // Inline link — skydeep on the sky underline
    link: `${FONT_PROSE} font-semibold text-[${C.skydeep}] underline decoration-[${C.sky}]/40 underline-offset-2 hover:decoration-[${C.sky}] cursor-pointer`,

    // Inline decorations
    text_bold: `font-semibold text-[${C.ink}]`,
    text_italic: `italic`,
    text_underline: `underline underline-offset-2`,
    text_strikethrough: `line-through`,
    text_underlineStrikethrough: `underline line-through`,
    text_subscript: `align-sub text-[0.8em]`,
    text_superscript: `align-super text-[0.8em]`,
    text_code: `${FONT_META} font-medium text-[12.5px] bg-[${C.papertint}] rounded px-1.5 py-0.5 text-[${C.ink}]`,

    // Block quote — the leaf rule
    quote: `border-l-2 border-[${C.leaf}] pl-4 italic ${FONT_PROSE} text-[15px] leading-[1.65] text-[${C.slate}] my-4`,

    // Code block — the SBL ledger look
    code: `${FONT_META} font-medium text-[12.5px] leading-[1.6] bg-[${C.papertint}] rounded-md block p-4 my-2 text-[${C.ink}] overflow-x-auto [tab-size:2] relative`,

    // Horizontal rule in the one border tone
    hr_base: `p-[1px] border-none my-6 cursor-pointer relative`,
    hr_after: `absolute left-0 right-0 h-px bg-[${C.ink}]/10 leading-[1px]`,

    // Column layout — tight (the codebase's px-2 py-4 item padding is
    // dropped so side-by-side CTAs sit close).
    layoutContainer: `grid gap-3 mt-2`,
    layoutItem: `min-w-0 max-w-full`,
    layoutItemEditable: `border border-dashed border-[${C.sky}]/40 rounded-md`,
  }],

  // /Columns presets — brand grid-aligned (read by InsertLayoutDialog).
  layoutTemplates: [
    { label: '2 buttons side-by-side', value: 'grid-cols-1 md:grid-cols-[max-content_max-content_1fr]', count: 3 },
    { label: '2 columns (equal)',      value: 'grid-cols-1 md:grid-cols-2',         count: 2 },
    { label: '2 columns (1/3 + 2/3)',  value: 'grid-cols-1 md:grid-cols-[1fr_2fr]', count: 2 },
    { label: '2 columns (2/3 + 1/3)',  value: 'grid-cols-1 md:grid-cols-[2fr_1fr]', count: 2 },
    { label: '3 columns (equal)',      value: 'grid-cols-1 md:grid-cols-3',         count: 3 },
  ],
};

/* ---------- Graphs — the status system drives every palette ----------------- */

// Order per the design system: sky, field, amber, violet, steel, rose, leaf.
const GRAPH_PALETTE = [C.sky, C.field, C.amber, C.violet, C.steel, C.rose, C.leaf];

// Legacy graph theme (flat — keys from ui/components/graph/theme.js).
const graph = {
  text: `${FONT_PROSE} font-normal text-[12px] text-[${C.slate}]`,
  darkModeText: `bg-transparent text-white`,
  headerWrapper: `grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-x-1 gap-y-0.5`,
  columnControlWrapper: `px-1 ${FONT_PROSE} font-semibold border ${BORDER} bg-[${C.paper}] text-[${C.slate}]`,
  scaleWrapper: `flex rounded-md p-1 divide-x divide-[${C.ink}]/10 border ${BORDER} w-fit`,
  scaleItem: `${FONT_PROSE} font-semibold text-[12px] text-[${C.slate}] hover:text-[${C.ink}] px-2 py-1`,
};

// avlGraph (options/styles — keys from ui/components/graph_new/theme.js).
const avlGraphChartDefaults = {
  colors: { type: 'palette', value: GRAPH_PALETTE },
  margin: { top: 20, right: 20, bottom: 50, left: 70 },
  height: 300,
  interpolation: 'catmullrom',
  strokeWidth: 1.5,
  area: false,
  areaOpacity: 0.15,
  // Mono axis chrome — the ledger voice (metaXS on chart axes).
  xAxis: {
    show: true, showGridLines: false, rotateLabels: false, tickDensity: 2,
    gridLineOpacity: 0.25, axisColor: 'rgba(22,35,44,0.2)',
    tickFontSize: '0.625rem', tickFontFamily: "'IBM Plex Mono', ui-monospace, monospace",
    tickFontWeight: '500', tickColor: C.slate,
    labelFontSize: '0.6875rem', labelFontFamily: "'IBM Plex Mono', ui-monospace, monospace",
    labelFontWeight: '500', labelColor: C.slate,
  },
  yAxis: {
    show: true, showGridLines: true, format: 'Integer',
    gridLineOpacity: 0.25, axisColor: 'rgba(22,35,44,0.2)',
    tickFontSize: '0.625rem', tickFontFamily: "'IBM Plex Mono', ui-monospace, monospace",
    tickFontWeight: '500', tickColor: C.slate,
    labelFontSize: '0.6875rem', labelFontFamily: "'IBM Plex Mono', ui-monospace, monospace",
    labelFontWeight: '500', labelColor: C.slate,
  },
  legend: { show: true },
};

const avlGraph = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: 'default',
      bgColor: `bg-white`,
      textColor: `text-[${C.ink}]`,
      padding: `p-4`,
      chartDefaults: avlGraphChartDefaults,
      text: `${FONT_PROSE} text-[13px] text-[${C.slate}]`,
      headerWrapper: `grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-x-1 gap-y-0.5`,
      columnControlWrapper: `px-1 ${FONT_PROSE} font-semibold border ${BORDER} bg-[${C.paper}] text-[${C.slate}]`,
      scaleWrapper: `flex rounded-md p-1 divide-x divide-[${C.ink}]/10 border ${BORDER} w-fit`,
      scaleItem: `${FONT_PROSE} font-semibold text-[12px] text-[${C.slate}] hover:text-[${C.ink}] px-2 py-1`,
    },
    {
      // For the feature (lb-plat-ink) band — transparent plot, white text.
      name: 'dark',
      bgColor: `bg-transparent`,
      textColor: `text-white`,
      chartDefaults: {
        ...avlGraphChartDefaults,
        xAxis: { ...avlGraphChartDefaults.xAxis, tickColor: 'rgba(255,255,255,0.7)', labelColor: 'rgba(255,255,255,0.7)', axisColor: 'rgba(255,255,255,0.2)' },
        yAxis: { ...avlGraphChartDefaults.yAxis, tickColor: 'rgba(255,255,255,0.7)', labelColor: 'rgba(255,255,255,0.7)', axisColor: 'rgba(255,255,255,0.2)' },
      },
    },
  ],
};

/* ---------- Map — white chrome panels; pins are the status system ----------
   Sparse styles[0]: only the visible surfaces are re-skinned; control-icon
   names and the deep structural keys inherit from the codebase default.    */

const map = {
  options: { activeStyle: 0 },
  styles: [{
    name: 'default',
    legend: {
      panelInner: `relative min-h-10 max-h-[calc(100vh_-_111px)] overflow-auto bg-white/90 pointer-events-auto scrollbar-sm rounded-md border border-[${C.ink}]/10`,
      row: `border border-transparent`,
      rowHover: `hover:border-[${C.sky}]/40 hover:bg-[${C.sky}]/5`,
      rowActive: `bg-[${C.sky}]/10`,
      title: `w-full ${FONT_PROSE} text-[13px] font-semibold text-[${C.slate}] truncate flex justify-between flex-wrap`,
      label: `flex items-center text-center flex-1 px-4 ${FONT_PROSE} text-[13px] text-[${C.slate}] h-6 truncate`,
      groupLabel: `${FONT_PROSE} text-[13px] font-semibold text-[${C.slate}] truncate flex-1`,
      infoIcon: `text-[${C.mist}] group-hover/icon:text-[${C.skydeep}]`,
      empty: `${FONT_PROSE} text-[13px] text-[${C.mist}]`,
      selectorBox: `rounded-md h-[36px] pl-0 flex w-full w-[216px] items-center border border-transparent cursor-pointer hover:border-[${C.ink}]/15`,
    },
    popup: {
      panel: `rounded-md bg-white shadow-lg border border-[${C.ink}]/10`,
      infoPanel: `w-64 rounded-md bg-white shadow-lg border border-[${C.ink}]/10 px-3 py-2 flex gap-2 flex-col`,
      menuPanel: `rounded-md bg-white shadow-lg border border-[${C.ink}]/10`,
      listPanel: `w-48 rounded-md bg-white shadow-lg border border-[${C.ink}]/10 p-2 max-h-[250px] overflow-auto`,
      listItem: `group flex w-full items-center rounded px-1 py-1 ${FONT_PROSE} text-[13px] hover:bg-[${C.sky}]/5`,
    },
    hover: {
      panel: `bg-white p-4 max-h-64 w-[300px] min-w-[300px] max-w-[300px] scrollbar-xs overflow-y-scroll rounded-md border border-[${C.ink}]/10 shadow-lg`,
      title: `${FONT_DISPLAY} font-semibold text-[17px] leading-[1.3] text-[${C.ink}] pb-1 w-full border-b border-[${C.ink}]/10`,
      row: `flex border-b border-[${C.ink}]/5 pt-1`,
      label: `flex-1 ${FONT_META} font-medium text-[11px] text-[${C.mist}] pl-1`,
      value: `flex-1 text-right ${FONT_PROSE} text-[13px] text-[${C.ink}] pl-4 pr-1`,
    },
  }],
};

/* ---------- Filters — PROMOTED to options/styles (skill §3.1.7) -------------
   `panel` = the dashboard filter band (patterns.html §02a): white triggers,
   hairline borders, applied-filter chips. `chip` = inline sky token chips.
   controlStyle names a real multiselect style shipped above.               */

const filters = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: 'panel',
      placement: 'stacked',
      controlStyle: 'default',

      filterLabel: `py-0.5 ${FONT_PROSE} text-[12px] leading-[1.2] font-semibold text-[${C.ink}]`,
      loadingText: `pl-0.5 ${FONT_PROSE} text-[12px] font-normal text-[${C.mist}]`,

      filterSettingsWrapperInline: `w-2/3`,
      filterSettingsWrapperStacked: `w-full`,
      labelWrapperInline: `w-1/3 ${FONT_PROSE} text-[12px]`,
      labelWrapperStacked: `w-full ${FONT_PROSE} text-[12px]`,
      conditionRowInline: `w-full flex flex-row items-center gap-1.5`,
      conditionRowStacked: `w-full flex flex-col items-start gap-1`,
      conditionsGrid: `grid gap-2`,

      input: `w-full max-h-[150px] flex overflow-auto scrollbar-sm ${FONT_PROSE} text-[13.5px] text-[${C.ink}] bg-white border border-[${C.ink}]/15 rounded p-2 text-nowrap`,

      // Applied-filter chips (sky tokens)
      settingPillsWrapper: `flex flex-row flex-wrap items-center gap-2`,
      settingPill: `inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-[${C.sky}]/10 text-[${C.skydeep}] ${FONT_PROSE} text-[12px] font-semibold`,
      settingLabel: `${FONT_PROSE} text-[12px] font-semibold text-[${C.ink}] min-w-fit`,

      // The filter band card itself
      filtersWrapper: `w-full p-2.5 flex flex-col gap-2 rounded-md bg-white border ${BORDER}`,

      // Hide the round toggle pill — the band is always visible.
      toggleButton: `hidden`,
      toggleIcon: `hidden`,

      // Edit-mode value editor rows
      filterRowWrapper: `p-1 relative ${FONT_PROSE} text-[12px]`,
      inlineSwitchRow: `flex flex-wrap items-center gap-1`,
      searchKeyRow: `flex items-center gap-0.5`,
      searchKeySelectorWrapper: `min-w-fit w-full relative bg-white`,
      searchKeyMenuWrapper: `absolute w-full bg-white p-1 ${FONT_PROSE} text-[12px] rounded-md shadow-lg border ${BORDER} z-1`,
      searchKeyMenuItem: `p-1.5 hover:bg-[${C.sky}]/10 hover:text-[${C.skydeep}] cursor-pointer rounded`,
    },
    {
      // Inline chip design — label inside a bordered chip, borderless control.
      name: 'chip',
      placement: 'inline',
      controlStyle: 'filter_chip',
      conditionRowInline: `inline-flex items-center gap-1.5 h-8 pl-2.5 pr-1.5 rounded-full border border-[${C.ink}]/15 bg-white w-fit`,
      labelWrapperInline: `shrink-0 inline-flex items-center gap-1 ${FONT_PROSE} text-[12px] font-semibold text-[${C.mist}]`,
      filtersWrapper: `w-full flex flex-wrap items-start gap-2`,
    },
  ],
};

/* ---------- Attribution — the white chip strip (TOP-LEVEL key) -------------- */

const attribution = {
  wrapper: `w-full pt-3 flex flex-wrap items-center gap-1.5 ${FONT_META} font-medium text-[10px] uppercase tracking-[0.12em] text-[${C.mist}]`,
  label: ``,
  link: `inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-white border ${BORDER} text-[${C.slate}] hover:text-[${C.skydeep}]`,
};

/* ---------- Pages (pattern-level) ------------------------------------------- */

const pagesTheme = {
  /* sectionArray — the 12-col gap-0 grid with p-3 padding gutters and
     chrome on inner boxes (grid.html). All eleven edit-chrome keys are
     re-skinned; structural classes kept verbatim.                          */
  sectionArray: {
    options: { activeStyle: 0 },
    styles: [{
      name: 'default',
      // _replace: swap the sizes map wholesale — without it the codebase's
      // 6-col "1/3"/"1/2"/"2/3"/"1" keys leak through and "1" re-reads as
      // 1/12 width.
      _replace: ['sizes'],

      wrapper: `relative`,
      gridOverlay: `absolute inset-0 pointer-events-none`,
      container: `grid grid-cols-12 gap-0 w-full`,
      gridSize: 12,
      defaultSize: '12',
      sizes: {
        '1':  { className: 'col-span-12 md:col-span-1',  iconSize: 8.3 },
        '2':  { className: 'col-span-12 md:col-span-2',  iconSize: 16.7 },
        '3':  { className: 'col-span-12 md:col-span-3',  iconSize: 25 },
        '4':  { className: 'col-span-12 md:col-span-4',  iconSize: 33.3 },
        '5':  { className: 'col-span-12 md:col-span-5',  iconSize: 41.7 },
        '6':  { className: 'col-span-12 md:col-span-6',  iconSize: 50 },
        '7':  { className: 'col-span-12 md:col-span-7',  iconSize: 58.3 },
        '8':  { className: 'col-span-12 md:col-span-8',  iconSize: 66.7 },
        '9':  { className: 'col-span-12 md:col-span-9',  iconSize: 75 },
        '10': { className: 'col-span-12 md:col-span-10', iconSize: 83.3 },
        '11': { className: 'col-span-12 md:col-span-11', iconSize: 91.7 },
        '12': { className: 'col-span-12 md:col-span-12', iconSize: 100 },
      },
      rowspans: {
        '1': { className: '' },
        '2': { className: 'md:row-span-2' },
        '3': { className: 'md:row-span-3' },
        '4': { className: 'md:row-span-4' },
      },

      layouts: {
        centered: `max-w-[1240px] mx-auto`,  // public cap — mx-auto is the documented deviation
        fullwidth: ``,
      },

      // Padding-only gap-0 gutter model: p-3 default, curated step scale.
      sectionPadding: `p-3`,
      defaultPaddingStep: '3',
      paddings: {
        top:    { '0': 'pt-0', '1.5': 'pt-1.5', '3': 'pt-3', '6': 'pt-6' },
        right:  { '0': 'pr-0', '1.5': 'pr-1.5', '3': 'pr-3', '6': 'pr-6' },
        bottom: { '0': 'pb-0', '1.5': 'pb-1.5', '3': 'pb-3', '6': 'pb-6' },
        left:   { '0': 'pl-0', '1.5': 'pl-1.5', '3': 'pl-3', '6': 'pl-6' },
      },

      // Inner-box chrome: one border tone, one radius (6px), two fills.
      borderSides: {
        top:    `border-t border-[${C.ink}]/10`,
        right:  `border-r border-[${C.ink}]/10`,
        bottom: `border-b border-[${C.ink}]/10`,
        left:   `border-l border-[${C.ink}]/10`,
      },
      radiusCorners: {
        tl: `rounded-tl-md`, tr: `rounded-tr-md`, bl: `rounded-bl-md`, br: `rounded-br-md`,
      },
      backgrounds: {
        none: ``, white: `bg-white`, tint: `bg-[#F7FAFB]`,
      },
      // Legacy named presets (radius baked in) — kept for stored sections.
      border: {
        none: ``,
        full: `border border-[${C.ink}]/10 rounded-md`,
        openLeft: `border border-[${C.ink}]/10 border-l-transparent rounded-r-md`,
        openRight: `border border-[${C.ink}]/10 border-r-transparent rounded-l-md`,
        openTop: `border border-[${C.ink}]/10 border-t-transparent rounded-b-md`,
        openBottom: `border border-[${C.ink}]/10 border-b-transparent rounded-t-md`,
        borderX: `border border-[${C.ink}]/10 border-y-transparent`,
      },

      // ── Edit-mode chrome (all eleven keys; structural classes verbatim) ──
      sectionEditWrapper: `relative group`,
      sectionViewWrapper: `relative group`,
      sectionEditHover: `absolute inset-0 border-2 border-transparent group-hover:border-[${C.sky}] border-dashed pointer-events-none z-10 rounded-md transition-colors`,
      sectionEditing: `absolute inset-0 border-2 border-[${C.skydeep}] border-dashed pointer-events-none z-10 rounded-md`,
      sectionHighlight: `absolute inset-0 border-2 border-[${C.leaf}] border-dashed pointer-events-none z-10 rounded-md`,
      addSectionButton: `cursor-pointer py-0.5 text-sm text-[${C.mist}] hover:text-[${C.skydeep}] truncate w-full -ml-4 my-2 hidden group-hover:flex absolute -top-5 z-20`,
      spacer: `flex-1`,
      addSectionIconWrapper: `flex items-center group/icon cursor-pointer`,
      addSectionIcon: `size-6 p-1.5 text-white bg-[${C.skydeep}] rounded-full group-hover/icon:hidden`,
      addSectionTextWrapper: `hidden group-hover/icon:flex items-center`,
      addSectionText: `px-2.5 py-1 text-white ${FONT_PROSE} text-[12px] font-semibold bg-[${C.skydeep}] rounded-full`,

      // Grid-view scaffolding (edit mode)
      gridviewGrid: `z-0 bg-[${C.papertint}]/60 h-full`,
      gridviewItem: `border-x bg-white border-[${C.ink}]/5 border-dashed h-full p-[6px]`,
      defaultOffset: 16,
    }],
  },

  /* sectionGroup — new pages seed `content` bands; the in-page nav rail
     gets the brand jump-link treatment. Structural rail keys inherit.      */
  sectionGroup: {
    defaultStyle: 'content',
    navWrapper: ``,
    navLabelText: 'On this page',
    navLabel: `${FONT_META} text-[9.5px] font-medium uppercase tracking-[0.16em] text-[${C.mist}] mb-2`,
    navList: `flex flex-col`,
    navItem: `block w-full text-left ${FONT_PROSE} text-[13.5px] text-[${C.slate}] hover:text-[${C.ink}] py-1 cursor-pointer transition-colors`,
    navItemActive: `block w-full text-left ${FONT_PROSE} text-[13.5px] font-semibold text-[${C.skydeep}] py-1 cursor-pointer`,
  },

  /* userMenu — compact avatar + edit-control for the white TopNav.
     The codebase default relies on the TopNav rightMenuContainer's
     min-w-[250px]; landbank's compact rightMenuContainer is content-sized,
     and the default's `authContainer: w-full` + `userMenuContainer: flex-1
     w-full` collapse to ~0 width there — the EditControl link then paints
     on top of the avatar. Content-size everything instead.               */
  userMenu: {
    options: { activeStyle: 0 },
    styles: [{
      name: 'default',
      userMenuContainer: `flex items-center shrink-0`,
      avatarWrapper: `flex p-1 justify-center items-center`,
      avatar: `size-8 border border-[${C.ink}]/15 rounded-full flex items-center justify-center hover:border-[${C.skydeep}]/50 transition-colors`,
      avatarIcon: `size-5 fill-[${C.slate}]`,
      // Compact chrome — no email/group text in the 1240-cap public bar.
      infoWrapper: `hidden`,
      emailText: `hidden`,
      groupText: `hidden`,

      editControlWrapper: `flex justify-center items-center shrink-0`,
      iconWrapper: `size-9 flex items-center justify-center rounded-md hover:bg-[${C.paper}] transition-colors`,
      icon: `size-6 text-[${C.mist}] hover:text-[${C.skydeep}]`,
      viewIcon: 'ViewPage',
      editIcon: 'EditPage',

      loginWrapper: `flex items-center justify-center py-2`,
      loginLink: `flex items-center`,
      loginIconWrapper: `size-8 flex items-center justify-center border border-[${C.ink}]/15 rounded-full hover:border-[${C.skydeep}]/50`,
      loginIcon: `size-5 stroke-[${C.slate}] text-[${C.slate}]`,
      loginText: `hidden`,
      authContainer: `shrink-0`,
      authWrapper: `flex items-center gap-1`,
      userMenuWrapper: `flex items-center`,
    }],
  },

  /* searchButton — quiet white chip with the sky icon puck. */
  searchButton: {
    options: { activeStyle: 0 },
    styles: [{
      name: 'default',
      button: `bg-white flex justify-between items-center h-10 w-[217px] py-1 pr-1 pl-4 border border-[${C.ink}]/15 rounded-full shadow-[0_1px_2px_rgba(22,35,44,0.05)] hover:border-[${C.skydeep}]/50 transition-colors cursor-pointer`,
      buttonText: `${FONT_PROSE} text-[13.5px] text-[${C.mist}]`,
      iconWrapper: `bg-[${C.skydeep}] p-2 rounded-full`,
      icon: `Search`,
      iconClass: `text-white`,
      iconSize: 12,
    }],
  },

  /* searchPallet — sparse re-skin of the visible surfaces; deep structural
     keys inherit from the codebase default.                                */
  searchPallet: {
    options: { activeStyle: 0 },
    styles: [{
      name: 'default',
      backdrop: `fixed inset-0 bg-[${C.ink}]/40 transition-opacity`,
      dialogContainer: `fixed inset-0 z-20 w-screen overflow-y-auto p-4 sm:p-6 md:p-20 flex items-center place-content-center`,
      dialogPanel: `relative max-w-3xl sm:w-[637px] max-h-3/4 sm:h-[700px] p-4 flex flex-col gap-2 overflow-hidden rounded-md bg-[${C.paper}] border ${BORDER} shadow-lg transition-all`,
      inputWrapper: `w-full flex items-center relative px-5 py-3 bg-white w-full rounded-full border border-[${C.ink}]/15`,
      input: `px-0.5 flex-1 ${FONT_PROSE} font-normal text-[15px] text-[${C.ink}] leading-[140%] bg-transparent placeholder:text-[${C.mist}] focus:ring-0 rounded-full ring-0 outline-none`,
      searchIcon: `Search`,
      searchIconClass: `text-[${C.mist}]`,
      resultsWrapper: `bg-white rounded-md border ${BORDER} px-3 py-4 flex flex-col gap-2 divide-y divide-[${C.ink}]/5 max-h-[500px] transform-gpu scroll-py-3 overflow-x-hidden overflow-y-auto scrollbar-sm`,
      pageTitle: `pl-2 ${FONT_DISPLAY} font-semibold text-[15px] leading-none text-[${C.ink}]`,
      sectionTitle: `pl-1 ${FONT_PROSE} font-normal text-[13.5px] leading-[140%] text-[${C.slate}]`,
      tag: `tracking-wide p-1 ${FONT_PROSE} text-[11px] font-semibold rounded-md border`,
      tagMatch: `border-[${C.skydeep}] bg-[${C.sky}]/10 text-[${C.skydeep}]`,
      tagNoMatch: `bg-[${C.papertint}] border-[${C.ink}]/10 text-[${C.mist}]`,
      noResultsTitle: `mt-4 ${FONT_DISPLAY} font-semibold text-[17px] text-[${C.ink}]`,
      noResultsText: `mt-2 ${FONT_PROSE} text-[13.5px] text-[${C.slate}]`,
    }],
  },
};

/* ---------- Datasets — conservative re-skin in brand neutrals ---------------- */

const datasetsTheme = {
  datasetsList: {
    // Category swatches hash to the status palette.
    categorySwatches: [C.skydeep, C.field, C.amber, C.violet, C.steel, C.rosedeep, C.forest, C.sky],

    pageWrapper: `w-full lb-paper`,

    header: `w-full bg-white border-b ${BORDER} px-6 py-3 flex flex-col gap-2`,
    count: `${FONT_META} text-[10px] font-medium uppercase tracking-[0.14em] text-[${C.mist}]`,
    toolbar: `flex flex-row items-center gap-2`,

    viewSwitcher: `inline-flex items-center gap-0.5 rounded-md border border-[${C.ink}]/15 p-0.5`,
    viewBtn: `size-8 inline-flex items-center justify-center rounded text-[${C.mist}] hover:bg-[${C.paper}]`,
    viewBtnActive: `size-8 inline-flex items-center justify-center rounded bg-[${C.skydeep}] text-white`,
    newBtn: `inline-flex items-center text-[${C.slate}] hover:text-[${C.skydeep}]`,

    body: `flex flex-row gap-4 px-6 py-4 lb-paper`,
    sidebarItem: `flex items-center gap-2 px-2 py-1.5 rounded ${FONT_PROSE} text-[13.5px] text-[${C.slate}] hover:bg-white`,
    sidebarItemActive: `flex items-center gap-2 px-2 py-1.5 rounded ${FONT_PROSE} text-[13.5px] font-semibold bg-white border ${BORDER} text-[${C.ink}]`,
    sidebarBadge: `ml-auto shrink-0 ${FONT_META} text-[11px] tabular-nums text-[${C.mist}]`,
    sidebarSubItem: `flex items-center pl-6 pr-2 py-1 rounded ${FONT_PROSE} text-[13px] text-[${C.slate}] hover:bg-white`,
    sidebarSubItemActive: `flex items-center pl-6 pr-2 py-1 rounded ${FONT_PROSE} text-[13px] font-semibold bg-white text-[${C.ink}]`,

    card: `group relative flex flex-col rounded-md border ${BORDER} bg-white shadow-[0_1px_2px_rgba(22,35,44,0.05)] p-4 hover:border-[${C.skydeep}]/50 transition-colors`,
    cardFull: `group relative flex items-start gap-4 rounded-md border ${BORDER} bg-white shadow-[0_1px_2px_rgba(22,35,44,0.05)] p-4 hover:border-[${C.skydeep}]/50 transition-colors`,
    typeBadge: `inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${BORDER} bg-[${C.paper}] ${FONT_META} text-[9.5px] font-medium uppercase tracking-[0.12em] text-[${C.mist}]`,
    categoryPill: `inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full ${FONT_PROSE} text-[11px] font-semibold text-[${C.slate}] bg-[${C.papertint}] hover:bg-[${C.paper}]`,
    subCategoryPill: `inline-flex items-center px-1.5 py-0.5 rounded-full ${FONT_PROSE} text-[11px] text-[${C.mist}] bg-white border ${BORDER} hover:text-[${C.slate}]`,
    cardTitle: `block ${FONT_DISPLAY} font-semibold text-[17px] leading-[1.3] text-[${C.ink}] hover:text-[${C.skydeep}]`,
    cardDescription: `mt-1 ${FONT_PROSE} text-[13.5px] leading-[1.55] text-[${C.slate}] line-clamp-2`,
    cardView: `shrink-0 mt-2 ${FONT_META} text-[9.5px] font-medium uppercase tracking-[0.14em] text-[${C.skydeep}]`,

    tableWrap: `flex-1 rounded-md border ${BORDER} bg-white shadow-[0_1px_2px_rgba(22,35,44,0.05)] overflow-hidden self-start`,
    theadRow: `bg-[${C.papertint}]/60 border-b ${BORDER}`,
    th: `px-3 py-2 ${FONT_PROSE} text-[12px] font-semibold text-[${C.slate}]`,
    tr: `border-b border-[${C.ink}]/5 hover:bg-[${C.sky}]/5`,
    td: `px-3 py-2 ${FONT_PROSE} text-[13px] align-top`,
    tdName: `${FONT_PROSE} font-semibold text-[${C.ink}] hover:text-[${C.skydeep}]`,
    tdMuted: `px-3 py-2.5 ${FONT_PROSE} text-[13px] text-[${C.mist}] align-middle max-w-[40ch] truncate`,
  },
};

/* ---------- Auth — the staff sign-in card (patterns.html §04c) --------------
   NOTE: the login/signup pages read auth.authPages.sectionGroup.default.*
   (NOT auth.login). Inputs/labels come from the global field/input themes. */

const authTheme = {
  authPages: {
    container: `lb-paper`,
    wrapper1: `w-full h-full flex-1 flex flex-col`,
    wrapper2: `w-full h-full flex-1 flex flex-row p-4 min-h-screen lb-paper`,
    wrapper3: `flex flex-1 w-full flex-col relative ${FONT_PROSE} justify-content-center`,
    iconWrapper: `z-5 absolute right-[10px] top-[5px]`,
    icon: `text-[${C.mist}] hover:text-[${C.skydeep}]`,
    sectionGroup: {
      default: {
        wrapper1: `w-screen h-screen flex flex-row lb-paper`,
        wrapper2: `flex w-screen h-screen justify-center`,
        wrapper3: `w-full place-content-start md:place-content-center`,
        iconWrapper: `z-5 absolute right-[10px] top-[5px] print:hidden`,
        icon: `text-[${C.mist}] hover:text-[${C.skydeep}]`,
        sideNavContainer1: `hidden xl:block`,
        sideNavContainer2: `min-w-[302px] max-w-[302px] sticky top-20 hidden xl:block h-[100vh_-_102px] pr-2`,
        // The centered max-w-md lb-card sign-in panel.
        pageWrapper: `max-w-md w-full mx-auto my-auto flex flex-col gap-4 p-8 bg-white border ${BORDER} rounded-md shadow-[0_1px_2px_rgba(22,35,44,0.05)]`,
        pageTitle: `${FONT_DISPLAY} font-semibold text-[21px] leading-[1.2] text-[${C.ink}] text-center`,
        forgotPasswordText: `${FONT_PROSE} text-[12px] font-semibold text-[${C.skydeep}] hover:text-[${C.ink}] underline decoration-[${C.sky}]/40 underline-offset-2`,
        actionButton: `lb-press w-full inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-[${C.skydeep}] hover:bg-[${C.ink}] border-b-[3px] border-[${C.ink}]/40 cursor-pointer`,
        actionText: `${FONT_PROSE} text-[13.5px] font-semibold text-white text-center`,
        prompt: `${FONT_PROSE} text-[12px] text-[${C.mist}] flex gap-1 justify-center`,
      },
    },
  },
  field: {
    fieldWrapper: `flex flex-col gap-4`,
    field: `flex flex-col gap-1.5`,
    label: `${FONT_PROSE} text-[12px] leading-[1.2] font-semibold text-[${C.ink}]`,
  },
};

/* ---------- Compose ---------------------------------------------------------- */

const landbankTheme = {
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
  logo,

  // Interaction
  button,
  input,
  multiselect,
  tabs,
  field,
  label,

  // Overlays
  dialog,
  dialogActions,
  modal,

  // Containers / atoms
  dataCard,
  pill,
  icon,

  // Rich content / data
  lexical,
  graph,
  avlGraph,
  map,
  table,

  // Data-wrapper filters + attribution (top-level keys, per ui/defaultTheme.js)
  filters,
  attribution,

  // Value-driven column-type skins (top-level keys, per each type's
  // getComponentTheme read). data_bar: papertint track, status-system fills;
  // barColorKey 'sky' for inventory bars, 'field' for for-sale bars.
  dataBar: {
    wrapper: 'w-full flex items-center gap-2',
    track: `relative flex-1 min-w-0 h-2.5 rounded-sm bg-[${C.papertint}] overflow-hidden`,
    fill: 'absolute inset-y-0 left-0',
    value: `${FONT_META} text-[11px] font-medium tabular-nums text-[${C.ink}] shrink-0`,
    fills: {
      primary: `bg-[${C.sky}]`,
      sky: `bg-[${C.sky}]`,
      field: `bg-[${C.field}]`,
      muted: `bg-[${C.steel}]/45`,
    },
  },
  parcelPlate: parcelPlateTheme,

  // Pattern-level
  pages: pagesTheme,
  datasets: datasetsTheme,
  auth: authTheme,

  // Theme-registered column types (auto-registered in patterns/page/siteConfig.jsx)
  columnTypes: {
    parcel_plate: parcelPlate,
  },
  pageComponents: {},
};

export default landbankTheme;
