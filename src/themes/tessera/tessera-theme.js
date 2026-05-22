/* =============================================================================
   Tessera — DMS Theme (v0.1)

   The brand applied to the DMS UI kit. Translates the Tessera design tokens
   (see `Tessera Design System/colors_and_type.css`) into the `options/styles`
   shape DMS theme primitives expect.

   Read together with:
   - references/dms product/positioning-v2.md
   - references/dms product/brand-tessera.md
   - references/dms product/design-system-for-dms.md
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

const FONT_DISPLAY = 'font-serif';   // Newsreader (mapped via tailwind.config)
const FONT_SANS    = 'font-sans';    // IBM Plex Sans
const FONT_MONO    = 'font-mono';    // IBM Plex Mono

/* ---------- textSettings — global type scale ------------------------------ */
/* Sourced by Lexical, Card, Header, and any column type that renders text.
   Heading keys (h1..h6) and the textXS..text8XL ramp are both populated;
   semantic aliases (body, caption, label) round it out. */

const textSettings = {
  options: { activeStyle: 0 },
  styles: [{
    name: 'default',

    // Heading roles — display serif, tight tracking, balanced
    h1: `${FONT_DISPLAY} font-medium text-5xl leading-tight tracking-tight scroll-mt-36 text-[${c.slate}]`,
    h2: `${FONT_DISPLAY} font-medium text-4xl leading-tight tracking-tight scroll-mt-36 text-[${c.slate}]`,
    h3: `${FONT_DISPLAY} font-medium text-3xl leading-snug tracking-tight scroll-mt-36 text-[${c.slate}]`,
    h4: `${FONT_DISPLAY} font-medium text-2xl leading-snug scroll-mt-36 text-[${c.slate}]`,
    h5: `${FONT_DISPLAY} font-medium text-xl leading-snug scroll-mt-36 text-[${c.slate}]`,
    h6: `${FONT_DISPLAY} font-medium text-lg leading-snug scroll-mt-36 text-[${c.slate}]`,

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
      name: 'content',
      wrapper1: `w-full flex flex-row px-6 py-4 max-w-[1280px] mx-auto`,
      wrapper2: `flex flex-1 w-full flex-col bg-[${c.parchment}] border border-[${c.groutLight}] rounded-none relative ${FONT_SANS} text-base font-normal leading-relaxed p-8 min-h-[200px] shadow-[0_1px_2px_rgba(42,47,54,0.04)] text-[${c.slate}]`,
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

const topnav = {
  options: { activeStyle: 0 },
  styles: [{
    name: 'default',
    wrapper: `w-full bg-[${c.bone}] border-b border-[${c.groutLight}]`,
    inner: `flex items-center justify-between gap-4 px-6 h-14 max-w-[1280px] mx-auto`,
    leftMenu: `flex items-center gap-6`,
    rightMenu: `flex items-center gap-4`,
    menu: `flex items-center gap-1`,
    menuItem: `${FONT_SANS} text-sm font-medium px-3 py-1.5 text-[${c.graphite}] hover:text-[${c.slate}] transition-colors duration-100`,
    menuItemActive: `${FONT_SANS} text-sm font-medium px-3 py-1.5 text-[${c.slate}] border-b-2 border-[${c.slate}] -mb-px`,
    mobileToggle: `lg:hidden p-2 text-[${c.slate}]`,
  }],
};

/* ---------- SideNav ------------------------------------------------------- */

const sidenav = {
  options: { activeStyle: 0 },
  styles: [{
    name: 'default',
    wrapper: `w-64 max-lg:hidden bg-[${c.bone}] border-r border-[${c.groutLight}] min-h-screen flex flex-col`,
    inner: `flex flex-col h-full`,
    topMenu: `p-4 border-b border-[${c.groutLight}]`,
    bottomMenu: `p-4 border-t border-[${c.groutLight}] mt-auto`,
    menu: `flex flex-col p-3 gap-px flex-1 overflow-y-auto`,

    // A nav item is a row: optional icon + label + optional value/badge
    menuItem: `${FONT_SANS} text-sm font-medium px-3 py-2 text-[${c.graphite}] hover:text-[${c.slate}] hover:bg-[${c.limestone}] cursor-pointer flex items-center gap-2 transition-colors duration-100`,
    menuItemActive: `${FONT_SANS} text-sm font-medium px-3 py-2 text-[${c.slate}] bg-[${c.limestone}] border-l-2 border-[${c.oxide}] -ml-px cursor-pointer flex items-center gap-2`,

    // Depth-specific indent
    item_level_1: `pl-3`,
    item_level_2: `pl-6`,
    item_level_3: `pl-9`,

    subItem: `${FONT_SANS} text-sm font-normal px-3 py-1.5 text-[${c.graphite}] hover:text-[${c.slate}] hover:bg-[${c.limestone}] cursor-pointer`,
    subItemActive: `${FONT_SANS} text-sm font-normal px-3 py-1.5 text-[${c.slate}] bg-[${c.limestone}] cursor-pointer`,

    icon: 'ChevronRight',
    iconOpen: 'ChevronDown',
    iconClosed: 'ChevronRight',
    iconWrapper: `w-4 h-4 stroke-[${c.graphite}]`,
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
      wrapper: `inline-flex items-center gap-2`,
      image: `h-7 w-auto`,
      text: `${FONT_DISPLAY} text-lg font-medium tracking-tight text-[${c.slate}]`,
    },
    {
      name: 'compact',
      wrapper: `inline-flex items-center`,
      image: `h-6 w-auto`,
      text: 'sr-only',
    },
    {
      name: 'stacked',
      wrapper: `inline-flex flex-col items-center gap-1`,
      image: `h-12 w-auto`,
      text: `${FONT_DISPLAY} text-base font-medium tracking-tight text-[${c.slate}]`,
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
  inputContainer: `relative w-full`,
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

const lexical = {
  // Lexical theme — inherits semantic headings from textSettings via h1..h6 alias,
  // and adds editor-specific node classes.
  ltr: 'text-left',
  rtl: 'text-right',
  paragraph: `${FONT_SANS} text-base leading-relaxed text-[${c.slate}] mb-4`,
  heading: {
    h1: `${FONT_DISPLAY} text-5xl font-medium leading-tight tracking-tight text-[${c.slate}] mt-12 mb-6`,
    h2: `${FONT_DISPLAY} text-4xl font-medium leading-tight tracking-tight text-[${c.slate}] mt-10 mb-5`,
    h3: `${FONT_DISPLAY} text-3xl font-medium leading-snug text-[${c.slate}] mt-8 mb-4`,
    h4: `${FONT_DISPLAY} text-2xl font-medium text-[${c.slate}] mt-6 mb-3`,
    h5: `${FONT_DISPLAY} text-xl font-medium text-[${c.slate}] mt-5 mb-2`,
    h6: `${FONT_DISPLAY} text-lg font-medium text-[${c.slate}] mt-4 mb-2`,
  },
  list: {
    nested: { listitem: 'list-none' },
    ol: `${FONT_SANS} list-decimal pl-6 mb-4 marker:text-[${c.graphite}]`,
    ul: `${FONT_SANS} list-disc pl-6 mb-4 marker:text-[${c.graphite}]`,
    listitem: `${FONT_SANS} text-base leading-relaxed text-[${c.slate}] mb-1`,
  },
  link: `text-[${c.slate}] underline decoration-[${c.fog}] hover:decoration-[${c.oxide}] underline-offset-[3px]`,
  text: {
    bold: 'font-semibold',
    italic: 'italic',
    underline: 'underline underline-offset-[3px]',
    strikethrough: 'line-through',
    code: `${FONT_MONO} text-[0.92em] bg-[${c.limestone}] border border-[${c.groutLight}] px-1 py-0.5 rounded-[2px]`,
  },
  quote: `border-l-2 border-[${c.oxide}] pl-4 italic text-[${c.graphite}] ${FONT_DISPLAY} text-lg my-4`,
  code: `${FONT_MONO} text-sm bg-[${c.limestone}] border border-[${c.groutLight}] p-4 rounded-none overflow-x-auto my-4 text-[${c.slate}]`,
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

/* ---------- Icons registry ------------------------------------------------ */
/* For DMS, icons are referenced by name; the actual component map is wired
   up by the host site. This export gives the brand its named icon set —
   downstream code maps names to React components (Lucide is the working
   set per `Tessera Design System/README.md`). */

const Icons = {};   // populated by host site / icons.js

/* ---------- Theme-registered column types (none for v0.1) ----------------- */

const columnTypes = {};   // brand may add e.g. portrait_banner, stream_player

/* ---------- Page components registered via theme (none for v0.1) ---------- */

const pageComponents = {};

/* ---------- Compose ------------------------------------------------------- */

const tesseraTheme = {
  // Foundation
  textSettings,
  Icons,

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

  // Theme-registered column types and page components (extension slots)
  columnTypes,
  pageComponents,
};

export default tesseraTheme;
