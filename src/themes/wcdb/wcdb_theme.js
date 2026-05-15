import "./tokens.css"
import { NavLeftStyleWidget, NavRightStyleWidget } from "./widgets"
import ThemeModeToggle from "./ThemeModeToggle"
import portraitBanner from "./columnTypes/portraitBanner.config"
import { portraitBannerTheme } from "./columnTypes/portraitBanner.theme"
import { wcdbSectionTheme } from "./wcdb_section.theme"

const theme = {
  layout: {
    styles: [
      {
        outerWrapper: "bg-[var(--page-bg)] text-[color:var(--ink-1)] font-[family-name:var(--font-sans)]",
        wrapper: "relative isolate flex min-h-svh w-full max-lg:flex-col",
        wrapper2: "flex-1 flex items-start flex-col items-stretch max-w-full min-h-screen",
        wrapper3: "flex flex-1 items-start",
        childWrapper: "flex-1 flex flex-col md:grid md:grid-cols-2",
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
        wrapper2: "overflow-hidden rounded-[18px] bg-[var(--card-bg)] text-[color:var(--ink-1)] md:h-full",
        wrapper3: "md:h-full",
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
    imgClass: "h-12 wcdb-logo-img",
    titleWrapper: "",
    title: "",
    linkPath: "/",
  },
  // Hanssen typography for the whole theme.
  // Anything that reads from textSettings (Lexical headings, Card text*, Table
  // text*, etc.) picks these up. Components that hardcode classes locally are
  // not affected — those need explicit overrides on their own theme blocks.
  textSettings: {
    options: { activeStyle: 0 },
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
  // Card surface treatments — Hanssen card aesthetic.
  // The card's outer wrappers carry the body baseline (Geist 15px / 1.4 /
  // -0.01em) so anything rendered inside inherits the right rhythm by default;
  // text* tokens still override per-cell where needed.
  dataCard: {
    options: { activeStyle: 0 },
    styles: [
      {
        name: "default",
        subWrapper: "w-full font-[family-name:var(--font-sans)] text-[15px] leading-[1.4] tracking-[-0.01em] text-[color:var(--ink-1)]",
        subWrapperCompactView: "flex flex-col rounded-[18px] bg-[var(--card-bg)] text-[color:var(--ink-1)]",
        headerValueWrapper: "w-full rounded-[18px] flex items-center justify-center p-2",
        header: "w-full font-[family-name:var(--font-mono)] uppercase tracking-[0.12em] text-[length:var(--tx-xs)] text-[color:var(--ink-3)]",
        description: "w-full font-[family-name:var(--font-sans)] text-[length:var(--tx-xs)] font-light text-[color:var(--ink-3)]",
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
  },
  // Theme-registered column types. Auto-registered in
  // patterns/page/siteConfig.jsx via the registerColumnType API.
  columnTypes: {
    portrait_banner: portraitBanner,
  },
  // Theme namespace consumed by the portrait_banner column type via
  // getComponentTheme. Lets us tune the banner height, scan-line texture,
  // and initials glyph size site-wide without touching column metadata.
  portraitBanner: portraitBannerTheme,
}

export default theme
