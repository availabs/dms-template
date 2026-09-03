import { Icons } from "./icons";
import mny_auth from "./auth.js";


// ─────────────────────────────────────────────────────────────────────────────
// avlGraph — brand chart defaults for the AVL Graph section (graph_new).
//
// `chartDefaults` merges UNDER a section's own `display` (per-section author
// overrides always win) — see graph_new/index.jsx mergeChartDefaults. Every key
// here is one the library already reads, so this is pure theming: no section
// needs configuration to look on-brand.
//
// NOT to be confused with the legacy `graph` key below, which themes the older
// ui/components/graph component and is deliberately left untouched.
// ─────────────────────────────────────────────────────────────────────────────

// CSS font stacks — NOT Tailwind classes. The axis renderers apply these inline
// via .style("font-family", …). Mirrors design/theme/index.css.additions.
const MNY_F_DISPLAY = `"Oswald", "Bebas Neue", sans-serif`;
const MNY_F_PROSE = `"Proxima Nova", "Source Sans 3", system-ui, sans-serif`;

// Categorical series palette. Blue is the primary family and amber the sole warm
// accent (design-system/theme.html), so a 2-series chart — by far the common
// case — lands on blue-700 + amber-700, the highest-contrast on-brand pair.
// Later stops follow the stacked-bar order used in pages/county-actions/state-dashboard.html.
// ─────────────────────────────────────────────────────────────────────────────
// MNY_RULE — the brand's divider scale. One weight (1px); three inks, chosen by
// the surface the rule sits on. Census of the 74 design mockups: mny-100 is the
// canonical rule (2,229 uses), mny-200 the strong one (1,736), mny-50 the
// subtle one (797); every neutral rule in the design is 1px (the 2px/4px
// borders are accents — the amber heading underline, active tabs).
//
// Documented in design/design-system/components.html → "Rules & dividers".
//
//   subtle (#F3F8F9) — inside a block: a heading underline, a row separator
//   base   (#E0EBF0) — the default: between blocks, around framed white cards
//   strong (#C5D7E0) — on the mny-50 tint, where a base rule disappears
// ─────────────────────────────────────────────────────────────────────────────
const MNY_RULE = { subtle: '#F3F8F9', base: '#E0EBF0', strong: '#C5D7E0' };
const ruleSides = (ink, bottomInk = ink) => ({
  top:    `border-t border-t-[${ink}] rounded-none!`,
  right:  `border-r border-r-[${ink}] rounded-none!`,
  bottom: `border-b border-b-[${bottomInk}] rounded-none!`,
  left:   `border-l border-l-[${ink}] rounded-none!`,
});

const MNY_GRAPH_PALETTE = [
  "#37576B", // blue 700   — primary series
  "#EAAD43", // yellow 700 — the accent
  "#6D96AE", // blue 400
  "#54B99B", // green 700
  "#EA8954", // orange 400
  "#C5D7E0", // blue 200
  "#DD524C", // red 500
];

const mnyChartDefaults = {
  colors: { type: "palette", value: MNY_GRAPH_PALETTE },
  // left 64 (the library default is 100): fits MNY's count-sized numeric ticks
  // and horizontal-bar category labels without eating a quarter of a narrow card.
  margin: { top: 16, right: 20, bottom: 44, left: 64 },
  height: 300,

  // Line look — slightly bolder line, smooth curve. `area` stays opt-in so
  // non-trend graphs aren't forced into area mode.
  interpolation: "catmullrom",
  strokeWidth: 2,
  area: false,
  areaOpacity: 0.14,

  // Bars — solid fills (the 0.75 avl-graph CSS default reads washed out on MNY's
  // white and mny-50 surfaces), and real spacing between bars. `paddingInner` is
  // the d3 band-scale inner padding: 0.3 reads like the design-system bar rows;
  // the library default is 0.0, i.e. bars touching.
  barOpacity: 1,
  paddingInner: 0.3,
  paddingOuter: 0.15,

  // Axis chrome. Ticks = Prose voice (Proxima, mny-400); axis titles = Meta voice
  // (Oswald, mny-700). axisColor is the mny-100 hairline used for every border in
  // the design system. Gridline COLOR is hardcoded to currentColor in the axis
  // renderers, so only its opacity is themeable — 0.12 approximates #E0EBF0
  // against the mny-900 ink this style sets as textColor.
  xAxis: {
    show: true, showGridLines: false, rotateLabels: false, tickDensity: 2,
    gridLineOpacity: 0.12, axisColor: "#E0EBF0",
    tickFontFamily: MNY_F_PROSE, tickFontSize: "11px", tickFontWeight: "600", tickColor: "#6D96AE",
    labelFontFamily: MNY_F_DISPLAY, labelFontSize: "12px", labelFontWeight: "500", labelColor: "#37576B",
  },
  yAxis: {
    show: true, showGridLines: true, format: "Integer",
    gridLineOpacity: 0.12, axisColor: "#E0EBF0",
    tickFontFamily: MNY_F_PROSE, tickFontSize: "11px", tickFontWeight: "600", tickColor: "#6D96AE",
    labelFontFamily: MNY_F_DISPLAY, labelFontSize: "12px", labelFontWeight: "500", labelColor: "#37576B",
  },

  // MNY's dashboard mockups label rows/bars directly and carry no legend. A
  // section turns it back on with display.legend = {show:true, position:"right"}
  // — BarGraph renders no legend at all without a left/right position.
  legend: { show: false },
};

const mny_avlGraph = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: "default",
      bgColor: "bg-white",
      textColor: "text-[#2D3E4C]",
      // Built-in breathing room so the plot doesn't sit flush against the section edge.
      padding: "p-4",
      chartDefaults: mnyChartDefaults,
      // ⚠ Deliberately NOT the legacy `graph.text` — that one is `uppercase
      // font-[Oswald]`, and since the axis renderers set font-family/size/weight
      // inline but NOT text-transform, an uppercase wrapper class cascades into
      // the SVG and upper-cases every category tick label ("Community
      // infrastructure" → "COMMUNITY INFRASTRUCTURE").
      text: `font-['Proxima_Nova'] text-[12px] text-[#37576B]`,
      headerWrapper: "flex items-baseline justify-between gap-3 mb-2",
      title: "font-[Oswald] font-[500] text-[16px] text-[#2D3E4C] uppercase leading-[1] shrink-0",
      subtitle: "font-['Proxima_Nova'] text-[12px] text-[#6D96AE] leading-[140%] text-right",
      columnControlWrapper: "px-1 font-semibold border border-[#E0EBF0] bg-[#F3F8F9] text-[#37576B]",
      scaleWrapper: "flex rounded-[8px] divide-x border w-fit border-[#E0EBF0] overflow-hidden",
      scaleItem:
        "px-[12px] py-[7px] font-[Oswald] font-medium text-[12px] text-[#2D3E4C] text-center leading-[100%] uppercase cursor-pointer",
      scaleItemActive: "bg-white",
      scaleItemInActive: "bg-[#F3F8F9]",
    },
    {
      // For the dark topo bands (pages/home.html hero). Bars go amber on dark,
      // ticks go mny-200, per that mockup's bar chart.
      name: "dark",
      bgColor: "bg-transparent",
      textColor: "text-white",
      padding: "p-4",
      chartDefaults: {
        ...mnyChartDefaults,
        colors: { type: "palette", value: ["#EAAD43", "#FFFFFF", "#F1CA87", "#C5D7E0", "#6D96AE"] },
        xAxis: {
          ...mnyChartDefaults.xAxis,
          tickColor: "#C5D7E0", labelColor: "#C5D7E0", axisColor: "rgba(255,255,255,0.25)",
        },
        yAxis: {
          ...mnyChartDefaults.yAxis,
          tickColor: "#C5D7E0", labelColor: "#C5D7E0", axisColor: "rgba(255,255,255,0.25)",
        },
      },
      text: `font-['Proxima_Nova'] text-[12px] text-[#C5D7E0]`,
      headerWrapper: "flex items-baseline justify-between gap-3 mb-2",
      title: "font-[Oswald] font-[500] text-[16px] text-white uppercase leading-[1] shrink-0",
      subtitle: "font-['Proxima_Nova'] text-[12px] text-[#C5D7E0] leading-[140%] text-right",
      columnControlWrapper: "px-1 font-semibold border border-white/20 bg-white/10 text-[#C5D7E0]",
      scaleWrapper: "flex rounded-[8px] divide-x border w-fit border-white/20 overflow-hidden",
      scaleItem:
        "px-[12px] py-[7px] font-[Oswald] font-medium text-[12px] text-white text-center leading-[100%] uppercase cursor-pointer",
      scaleItemActive: "bg-white/20",
      scaleItemInActive: "bg-transparent",
    },
  ],
};

const theme = {
  // -------------------- Layout ------------------------
  layout: {
    "options": {
      "activeStyle": 0,
      "sideNav": {
        "size": "none",
        "nav": "main",
        "activeStyle": null,
        "navDepth": "2",
        "navTitle": "flex-1 text-[24px] font-['Oswald'] font-[500] leading-[24px] text-[#2D3E4C] py-3 px-4 uppercase",
        "topMenu": [],
        "bottomMenu": []
      },
      "topNav": {
        "size": "compact",
        "nav": "main",
        "leftMenu": [{ type: "Logo" }],
        "rightMenu": [{ type: "Search" }, { type: "UserMenu" }]
      }
    },
    "styles": [{
      outerWrapper: "bg-[linear-gradient(0deg,rgba(244,244,244,0.96),rgba(244,244,244,0.96)),url('/themes/mny/topolines.png')]  bg-[size:500px]",
      wrapper: "max-w-[1440px] mx-auto",
      wrapper2: "flex-1 flex items-start flex-col items-stretch max-w-full",
      wrapper3: "flex flex-1 md:px-4 xl:px-[64px]",
      childWrapper: "h-full flex-1",
    },
      {
        name: 'auth',
        outerWrapper: "w-screen h-screen bg-[linear-gradient(0deg,rgba(244,244,244,0.96),rgba(244,244,244,0.96)),url('/themes/mny/topolines.png')]  bg-[size:500px]",
        wrapper: "w-screen h-screen",
        wrapper2: "w-screen h-screen flex items-start flex-col items-stretch max-w-full",
        wrapper3: "mt-[15vh] md:mt-0 w-screen h-screen overflow-y-auto",
        childWrapper: 'w-screen h-screen',
        topnavContainer1: 'print:hidden',
        topnavContainer2: `fixed top-0 z-20 max-w-[1440px] left-50% -translate-50% w-full md:px-4 md:pt-[32px] xl:px-[64px] pointer-events-none`,
        sidenavContainer1: 'pr-2  hidden lg:block min-w-[222px] max-w-[222px]',
        sidenavContainer2: 'hidden lg:block fixed min-w-[222px] max-w-[222px] top-[0px] h-[calc(100vh_-_1px)] w-full overflow-y-auto overflow-x-hidden'
      }],
  },
  "sidenav": {
    "options": {
      "activeStyle": "0",
    },
    "styles": [
      {
        "layoutContainer1": "pr-2  hidden lg:block min-w-[302px] max-w-[302px] pt-[88px]  print:hidden ",
        "layoutContainer2": "hidden scrollbar-sm lg:block sticky top-[120px] h-[calc(100vh_-_125px)] bg-white rounded-lg shadow-md w-full overflow-y-auto overflow-x-hidden mt-8",
        "logoWrapper": "bg-neutral-100 text-slate-800",
        "sidenavWrapper": "hidden md:flex bg-white w-full h-full z-20  flex-col pr-5",
        "menuItemWrapper": " flex-1 flex flex-col flex flex-col",
        "menuItemWrapper_level_1": "pl-8",
        "menuItemWrapper_level_2": "",
        "menuItemWrapper_level_3": "",
        "menuItemWrapper_level_4": "",
        "menuIconSide": "hidden size-8 text-[#37576B]",
        "menuIconSideActive": "hidden size-8 text-[#37576B]",
        "itemsWrapper": "border-slate-200 py-6 flex-1",
        "navItemContent": "transition-transform duration-300 ease-in-out flex-1 w-full",
        "navItemContent_level_1": "pl-1 text-[16px] font-['Oswald'] font-[500] leading-[16px]  text-[#2D3E4C] py-3 uppercase",
        "navItemContent_level_2": `text-[16px] font-['Proxima_Nova'] font-[600] leading-[19.2px] text-[#37576B] pl-4 py-3`,
        "navItemContent_level_3": `text-[14px] font-['Proxima_Nova'] font-[400] leading-[19.6px] text-[#37576B] pl-4 py-2`,
        "navItemContent_level_4": `text-[14px] font-['Proxima_Nova'] font-[400] leading-[19.6px] text-[#37576B] pl-4 py-2`,
        "navitemSide": "w-full md:flex-1  group flex flex-col border-white focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300        transition-all cursor-pointer",
        "navitemSideActive": " w-full md:flex-1 group  flex flex-col focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300        transition-all cursor-pointer border-l-2 border-slate-600       ",
        "indicatorIcon": "ArrowRight",
        "indicatorIconOpen": "ArrowDown",
        "bottomMenuWrapper": "",
        "topnavWrapper": "w-full h-[50px] flex items-center pr-1",
        "topnavContent": "flex items-center w-full h-full bg-white lg:bg-zinc-100 dark:bg-zinc-900 dark:lg:bg-zinc-950 justify-between",
        "topnavMenu": "hidden  lg:flex items-center flex-1  h-full overflow-x-auto overflow-y-hidden scrollbar-sm",
        "topmenuRightNavContainer": "hidden md:flex h-full items-center",
        "topnavMobileContainer": "bg-slate-50",
        "topNavWrapper": "flex flex-row md:flex-col p-2",
        "indicatorIconWrapper": "text-[#37576B] size-4",
        "subMenuParentWrapper": "flex w-full",
        "subMenuOuterWrapper":"",
        "subMenuWrapperChild": "flex flex-col",
        "subMenuWrapperTop": "",
        //"subMenuWrapper_1": "pl-2 w-full",
        "subMenuWrapper_1": "w-full bg-[#F3F8F9] rounded-[12px] py-[12px]",
        "subMenuWrapper_2":"w-full bg-[#E0EBF0]"

      },
      {
        "layoutContainer1": "pr-2  hidden lg:block min-w-[64px] max-w-[84px]  print:hidden",
        "layoutContainer2": "hidden scrollbar-sm lg:block sticky top-[9px] h-[calc(100vh_-_20px)] bg-white rounded-lg shadow-md w-full overflow-y-auto overflow-x-hidden",
        "logoWrapper": "bg-neutral-100 text-slate-800",
        "sidenavWrapper": "hidden md:flex flex-col bg-white w-full h-full z-20",
        "menuItemWrapper": "flex flex-col",
        "menuIconSide": "size-11 mx-4 text-[#37576B] hover:text-slate-500 ",
        "menuIconSideActive": "size-10 mx-3 text-[#37576B] ",
        "itemsWrapper": "border-slate-200 py-6 flex-1",
        "navItemContent": "hidden",
        "navItemContents": "hidden",
        "navitemSide": "md:flex-1 group flex flex-col border-white focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300        transition-all cursor-pointer",
        "navitemSideActive": "        md:flex-1 group  flex flex-col        focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300        transition-all cursor-pointer border-l-2 border-slate-600       ",
        "indicatorIcon": "ArrowRight",
        "indicatorIconOpen": "ArrowDown",
        "subMenuWrapper": "pl-2 w-full",
        "subMenuParentWrapper": "flex w-full",
        "bottomMenuWrapper": "",
        "topnavWrapper": "w-full h-[50px] flex items-center pr-1",
        "topnavContent": "flex items-center w-full h-full bg-white lg:bg-zinc-100 dark:bg-zinc-900 dark:lg:bg-zinc-950 justify-between",
        "topnavMenu": "hidden  lg:flex items-center flex-1  h-full overflow-x-auto overflow-y-hidden scrollbar-sm",
        "topmenuRightNavContainer": "hidden md:flex h-full items-center",
        "topnavMobileContainer": "bg-slate-50",
        "topNavWrapper": "flex flex-row md:flex-col p-2",
        "indicatorIconWrapper": "text-[#37576B] size-4",
        "subMenuWrapperChild": "flex flex-col",
        "subMenuWrapperTop": "",
        "name": "small"
      }
    ]
  },
  "topnav": {
    "options": {
      "activeStyle": "0",
      "maxDepth": "1"
    },
    "styles": [{
      "layoutContainer1": `print:hidden`,
      "layoutContainer2": `fixed top-0 z-20 max-w-[1440px] left-50% -translate-50% w-full md:px-4 md:pt-[32px] xl:px-[64px] pointer-events-none`,
      "topnavWrapper": `px-[24px] py-[16px] w-full bg-white h-20 flex items-center md:rounded-lg shadow pointer-events-auto relative`,
      "topnavContent": `flex items-center w-full h-full  max-w-[1400px] mx-auto `,
      "leftMenuContainer": '',
      "centerMenuContainer": `hidden md:flex items-center flex-1 h-full overflow-x-auto overflow-y-hidden scrollbar-sm`,
      "rightMenuContainer": "hidden md:flex h-full items-center justify-end  min-w-[110px]",
      "mobileNavContainer": "bg-white pointer-events-auto h-[calc(100vh_-_80px)] overflow-y-auto",
      "mobileButtonContainer": "flex flex-1 justify-end content-end md:hidden",
      "mobileButton": `md:hidden inline-flex items-center justify-center border-3 rounded-full border-[#E0EBF0] size-8`,
      "menuOpenIcon": `BarsMenu`,
      "menuCloseIcon": `XMark`,

      // Menu Item Styles
      "navitemWrapper": "",
      "navitemWrapper_level_2": 'bg-[#F3F8F9] p-4 rounded-lg',
      "navitem": `
          md:w-fit group  whitespace-nowrap
          text-[16px] font-['Proxima_Nova'] font-[500] text-[#37576B]
          px-2
          focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300
          transition cursor-pointer
      `,
      "navitemActive": `w-fit group  whitespace-nowrap
        text-[16px] font-['Proxima_Nova'] font-[500] text-[#37576B]
        px-2 text-blue
        focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300
        transition cursor-pointer
      `,
      "navitemContent": "flex-1 flex items-center gap-[2px]",
      "navIcon": `text-[#37576B]  size-6`,
      "navIconActive": `text-[#37576B] items-center text-lg`,
      "navitemDescription":"hidden",
      "navitemDescription_level_2": `text-[16px] font-['Proxima_Nova'] font-[400] text-[#37576B] text-wrap`,
      "navitemName_level_1": "",
      "navitemName_level_2": "uppercase font-[Oswald] text-[14px] flex items-center p-1",

      "indicatorIconWrapper": "size-3",
      "indicatorIcon": "ArrowDown",
      "indicatorIconOpen": "ArrowDown",


      // SubMenu Styles
      "subMenuWrapper":"absolute left-0 right-0 normal-case z-10 px-4 -mx-[15px] pt-[34px] cursor-default",
      "subMenuWrapper2": `bg-white flex items-stretch rounded-lg p-4 shadow`,
      "subMenuParentContent": "basis-1/3  text-wrap pr-[64px]",
      "subMenuParentName": `text-[36px] font-['Oswald'] font-500 text-[#2D3E4C] uppercase pb-2`,
      "subMenuParentDesc": `text-[16px] font-['Proxima_Nova'] font-[400] text-[#37576B]`,
      "subMenuParentLink": `w-fit h-fit cursor-pointer uppercase border border-[#E0EBF0] bg-white hover:bg-[#E0EBF0] text-[#37576B] font-[700] leading-[14.62px] rounded-full text-[12px] text-center py-[16px] px-[24px]`,
      "subMenuItemsWrapperParent": "grid grid-cols-2 gap-1 flex-1",
      "subMenuItemsWrapper": "grid grid-cols-4 flex-1"
    },
      {
        name: 'auth',
        fixed: 'mt-8',
        layoutContainer1: 'absolute w-full md:w-1/2 z-1 px-2 px-32 py-[2vh]',
        topnavWrapper: `w-full bg-transparent h-[15vh] md:h-40 flex items-center rounded-lg pointer-events-auto`,
        topnavContent: `max-w-lg mx-auto my-auto flex flex-1`,
        topnavMenu: `hidden  md:flex items-center flex-1  h-full overflow-x-auto overflow-y-hidden scrollbar-sm`,
        menuItemWrapper: 'hidden text-[#37576B]',
        menuIconTop: `text-blue-400 mr-3 text-lg group-hover:text-blue-500`,
        menuIconTopActive: `text-blue-500 mr-3 text-lg group-hover:text-blue-500`,
        menuOpenIcon: `fa-light fa-bars fa-fw`,
        menuCloseIcon: `fa-light fa-xmark fa-fw"`,
        navitemTop: `
          w-fit group font-display whitespace-nowrap
          flex tracking-widest items-center font-[Oswald] font-medium text-slate-700 text-[11px] px-2 h-12
          focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300
          transition cursor-pointer
      `,
        navitemTopActive:
            ` w-fit group font-display whitespace-nowrap
          flex tracking-widest items-center font-[Oswald] font-medium text-slate-700 text-[11px] px-2 h-12 text-blue
          focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300
          transition cursor-pointer
        `,
        topmenuRightNavContainer: "hidden md:flex h-full items-center",
        topnavMobileContainer: "bg-slate-50",

        mobileButton: `hidden`,
        indicatorIcon: 'fal fa-angle-down pl-2 pt-1',
        indicatorIconOpen: 'fal fa-angle-down pl-2 pt-1',
        subMenuWrapper: `hidden`,
        subMenuParentWrapper: 'hidden',
        subMenuWrapperChild: `divide-x overflow-x-auto max-w-[1400px] mx-auto`,
        subMenuWrapperTop: 'hidden',
        subMenuWrapperInactiveFlyout: `absolute left-0 right-0  mt-8 normal-case shadow-lg z-10 p-2`,
        subMenuWrapperInactiveFlyoutBelow: ` absolute ml-40 normal-case shadow-lg z-10 p-2`,
        subMenuWrapperInactiveFlyoutDirection: 'grid grid-cols-4',
        "layoutContainer2": `w-full`,

        // menu containers
        "leftMenuContainer": "flex items-center",
        "centerMenuContainer": `hidden lg:flex items-center flex-1 h-full overflow-visible gap-1 px-4`,
        "rightMenuContainer": "hidden",
        "mobileNavContainer": "px-4 py-2 bg-zinc-100 dark:bg-zinc-900",

        // Menu Item Styles
        "navitemWrapper": 'relative',
        "navitemWrapper_level_2": 'relative',
        "navitemWrapper_level_3": '',
        "navitem": `
        px-3 py-2 rounded-lg
        text-sm font-medium text-zinc-600 dark:text-zinc-400
        hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white
        transition-colors cursor-pointer
        flex items-center gap-1.5
    `,
        "navitemActive": `
        px-3 py-2 rounded-lg
        text-sm font-medium text-zinc-900 dark:text-white
        bg-zinc-200 dark:bg-zinc-800
        cursor-pointer
        flex items-center gap-1.5
    `,
        "navIcon": "size-4 text-zinc-500 dark:text-zinc-400",
        "navIconActive": "size-4 text-zinc-900 dark:text-white",
        "navitemContent": "flex items-center gap-1.5",
        "navitemName": "",
        "navitemName_level_2": "w-full text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white py-2 px-3 rounded-md transition-colors flex items-center justify-between gap-2",
        "navitemName_level_3": "w-full text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white py-2 px-3 rounded-md transition-colors",
        "navitemDescription": "hidden",
        "navitemDescription_level_2": `text-xs text-zinc-500 dark:text-zinc-400 mt-0.5`,
        "navitemDescription_level_3": `text-xs text-zinc-500 dark:text-zinc-400 mt-0.5`,

        "indicatorIconWrapper": "size-4 text-zinc-400",
        "subMenuWrapper2": " dark:bg-zinc-900 rounded-xl shadow-lg ring-1 ring-zinc-950/5 dark:ring-white/10 py-1 min-w-[200px]",
        // Level 2 submenu (flyout to the right of level 2 item)
        "subMenuWrapper_level_2": `absolute left-full top-0 ml-2 z-50`,
        "subMenuWrapper2_level_2": " dark:bg-zinc-900 rounded-xl shadow-lg ring-1 ring-zinc-950/5 dark:ring-white/10 py-1 min-w-[200px]",
        "subMenuItemsWrapper": "flex flex-col",
        "subMenuItemsWrapperParent": "flex flex-col",
        subMenuParentContent: 'px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 mb-1',
        subMenuParentName: 'text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide',
        subMenuParentDesc: 'text-xs text-zinc-400 dark:text-zinc-500 mt-0.5',
        subMenuParentLink: 'text-xs text-zinc-900 dark:text-white hover:underline mt-1 inline-block',
      }
    ]
  },
  layoutGroup: {
    options: {
      activeStyle: 0
    },
    styles: [
      {
        name: "default",
        wrapper1: "w-full h-full flex-1 flex flex-row pt-2", // inside page header, wraps sidebar
        wrapper2:
          "flex flex-1 w-full  flex-col  shadow-md bg-white rounded-lg relative text-md font-light leading-7 p-4 h-full min-h-[200px]", // content wrapepr
        wrapper3:""
      },
      {
        name: "content",
        wrapper1: "w-full h-full flex-1 flex flex-row lg:pt-[118px] pb-[5px]", // inside page header, wraps sidebar
        wrapper2:
          "flex flex-1 w-full  flex-col  shadow-md bg-white rounded-lg relative text-md font-light leading-7 p-4 h-full min-h-[calc(100vh_-_102px)]", // content wrapepr
        wrapper3: ""
      },
      {
        name: "darkSection",
        wrapper1: `w-full h-full flex-1 flex flex-row -my-8 py-10 bg-[linear-gradient(0deg,rgba(33,52,64,.96),rgba(55,87,107,.96)),url('/themes/mny/topolines.png')]  bg-[size:500px] pb-[4px]`, // inside page header, wraps sidebar
        wrapper2: "max-w-[1440px]  xl:px-[64px] md:px-4 mx-auto",
        wrapper3:
          "flex flex-1 w-full  flex-col  relative text-md font-light leading-7 p-4 h-full min-h-[200px]", // content wrapepr
      },
      {
        name: "lightCentered",
        wrapper1: `w-full h-full flex-1 flex flex-row pb-[4px] `, // inside page header, wraps sidebar
        wrapper2: "max-w-[1440px]  xl:px-[64px] md:px-4 mx-auto",
        wrapper3:
          "flex flex-1 w-full  shadow-md bg-white rounded-lg  flex-col  relative text-md font-light leading-7 p-4 h-full min-h-[200px]", // content wrapepr
      },
      {
        name: "clearCentered",
        wrapper1: `w-full h-full flex-1 flex flex-row -mt-3`, // inside page header, wraps sidebar
        wrapper2: "max-w-[1440px] w-full xl:px-[48px] mx-auto",
        wrapper3: "flex flex-1 w-full flex-col relative h-full min-h-[200px]", // content wrapepr
      },
      {
        name: "header",
        wrapper1: "w-full h-full flex-1 flex flex-row", // inside page header, wraps sidebar
        wrapper2: "flex flex-1 w-full  flex-col  relative min-h-[200px]", // content wrapepr
        wrapper3: ""
      },
      {
        name: "auth",
        wrapper1: 'w-full h-full flex-1 flex flex-row ', // first div inside Layout
        wrapper2: 'w-full h-full flex-1 flex flex-row min-h-screen', // inside page header, wraps sidebar
        wrapper3: 'flex w-full flex-row gap-4 relative text-md',
      },
    ]
  },
  // ----------------------- End Layout ------------------------
  // Pages Pattern
  // ------------------
  richtext: {
    contentPadding: 'p-0',
  },
  pages: {
    sectionArray: {
      "options": {
        "activeStyle": 0
      },
      "styles": [
        {
          container: "w-full grid grid-cols-6 md:grid-cols-12 ",
          gridSize: 12,
          sectionPadding: 'p-0',
          sectionEditHover: 'absolute inset-0 border border-transparent group-hover:border-[#37576b] border border-2 pointer-events-none z-10 rounded-md',
          addSectionIcon: 'size-6 p-1.5 text-white bg-[#37576b] rounded-full group-hover/icon:hidden',
          addSectionText: 'px-1.5 py-1 text-white text-sm font-semibold bg-[#37576b] rounded-full',
          layouts: {
            centered: "max-w-[1020px] mx-auto  px-0 lg:px-[56px]",
            fullwidth: "",
          },
          sizes: {
            // sub-1/4 steps (added 2026-08-27): small chrome sections — e.g. the
            // dashboard's auth-gated CTA buttons — that shouldn't claim a quarter row
            "1/12": { className: "col-span-3 md:col-span-1", iconSize: 8 },
            "1/6": { className: "col-span-3 md:col-span-2", iconSize: 16 },
            "1/4": { className: "col-span-6 md:col-span-3", iconSize: 25 },
            "1/3": { className: "col-span-6 md:col-span-4", iconSize: 33 },
            "1/2": { className: "col-span-6 md:col-span-6", iconSize: 50 },
            "2/3": { className: "col-span-6 md:col-span-8", iconSize: 66 },
            1: { className: "col-span-6 md:col-span-9", iconSize: 75 },
            2: { className: "col-span-6 md:col-span-12", iconSize: 100 },
          },
          // same shape as landbank/transportny/avail — lets a tall section (the
          // Actions Dashboard map) sit beside a stacked column of siblings
          rowspans: {
            "1": { className: "" },
            "2": { className: "md:row-span-2" },
            "3": { className: "md:row-span-3" },
            "4": { className: "md:row-span-4" },
          },
        }
      ]
    },
    sectionGroupsPane: {
      options: {
        activeStyle: 0
      },
      styles: [
        {
          sectionTargetWrapper: 'py-2 px-3 text-xs font-semibold uppercase tracking-wide text-[#37576B] bg-white cursor-default flex justify-between items-center',
          sectionTargetDivider: 'border-t border-[#C5D7E0]',
          addGroupBtn: 'text-[#6D96AE] hover:bg-[#F3F8F9] rounded px-2 py-1 transition-colors font-medium normal-case',
          sectionGroupWrapper: 'group rounded-sm mx-2 px-2 py-1 hover:bg-[#E0EBF0] flex justify-between items-center transition-all',
          activePageSectionBorder: `border border-dashed border-orange-200 hover:border-orange-300`,
          sectionGroupBorder: `border border-[#C5D7E0] hover:border-[#6D96AE]`,
          pageSectionBG: `bg-[#F3F8F9] hover:bg-[#E0EBF0]`,
          expandedGroupBG: `bg-white`,
          unexpandedGroupBG: `bg-white`,
          pageSectionCursor: `cursor-pointer`,
          sectionGroupCursor: `cursor-grab`,
          titleWrapper: 'flex items-center gap-3',

          sectionGroupIcon: 'size-4 text-[#37576B] group-hover:text-[#2D3E4C]',
          sectionGroupTitle: 'text-sm font-medium text-[#2D3E4C]',

          pageSectionIcon: 'hidden',
          pageSectionTitle: 'text-sm font-medium text-[#2D3E4C]',

          controlsWrapper: 'flex gap-1 items-center',
          expandGroupIcon: 'size-6 place-content-center cursor-pointer text-[#37576B] hover:text-[#2D3E4C]',
        }
      ]
    },
  },
  auth: mny_auth,
  pageOptions: {
    settingsPane: [
      {
        type: "MultiSelect",
        singleSelectOnly: true,
        label: "Page Background",
        location: "theme.page.container",
        default: "",
        options: [
          {
            label: "Default",
            value: `bg-[linear-gradient(0deg,rgba(244,244,244,0.96),rgba(244,244,244,0.96)),url('/themes/mny/topolines.png')]  bg-[size:500px] pb-[4px]`,
          },
          {
            label: "Blue",
            value: `bg-[linear-gradient(0deg,rgba(33,52,64,.96),rgba(55,87,107,.96)),url('/themes/mny/topolines.png')] bg-[size:500px] pb-[4px]`,
          },
          {
            label: "Yellow",
            value: `bg-[linear-gradient(0deg,rgba(252,246,236,.96),rgba(252,246,236,.96)),url('/themes/mny/topolines.png')] bg-[size:500px] pb-[4px]`,
          },
        ],
      },
      {
        type: "MultiSelect",
        singleSelectOnly: true,
        label: "Show in Footer",
        location: "navOptions.show_in_footer",
        default: "",
        options: [
          { label: "No", value: "" },
          { label: "Yes", value: `show` },
        ],
      },
    ],
  },
  logo: {
    logoWrapper: "",
    logoAltImg: "",
    imgWrapper: "h-12 pl-3 pr-2 flex items-center",
    img: "/themes/mny/mnyLogo.svg",
    titleWrapper: "",
    title: "",
    linkPath: "/",
  },
  heading: {
    base: "p-2 w-full font-sans font-medium text-md bg-transparent",
    1: `font-[500]  text-[#2D3E4C] text-[36px] leading-[140%] tracking-[-.02em] font-[500] underline-offset-8 underline decoration-4 decoration-[#EAAD43] uppercase font-['Oswald'] pb-[12px]`,
    2: `font-[500]  text-[#2D3E4C] text-[24px] leading-[24px] scroll-mt-36 font-['Oswald'] pb-[12x]`,
    3: `font-[500]  text-[#2D3E4C] text-[16px] leading-[16px] scroll-mt-36 font-['Oswald'] pb-[12x]`,
    4: `text-[36px] sm:text-[48px] tracking-[-2px] items-center font-medium font-['Oswald'] text-[#2D3E4C] sm:leading-[100%] uppercase`,
    default: "",
  },
  button: {
    options: { activeStyle: 0 },
    styles: [
      {
        name: 'default Buttons',
        button: `cursor-pointer inline-flex items-center gap-2 bg-white hover:bg-[#E0EBF0] text-[#37576B] font-['Proxima_Nova'] font-[700] text-[12px] uppercase tracking-wider rounded-full transition-colors focus:outline-none disabled:bg-[#F1CA87] disabled:text-[#2D3E4C]/40 disabled:cursor-not-allowed px-3 py-[6px] ring ring-[#E0EBF0]`,
      },
      {
        name: 'plain',
        button: `cursor-pointer inline-flex items-center gap-2 border border-[#E0EBF0] bg-white hover:bg-[#E0EBF0] hover:border-[#C5D7E0] text-[#37576B] font-['Proxima_Nova'] font-[700] text-[14px] uppercase tracking-wider rounded-full transition-colors focus:outline-none disabled:text-[#C5D7E0] disabled:cursor-not-allowed px-5 py-2.5`,
      },
      {
        name: 'active',
        button: `cursor-pointer inline-flex items-center gap-2 border border-[#C5D7E0] bg-[#C5D7E0] hover:bg-[#E0EBF0] text-[#37576B] font-['Proxima_Nova'] font-[700] text-[12px] uppercase tracking-wider rounded-full transition-colors focus:outline-none disabled:bg-[#F3F8F9] disabled:border-[#E0EBF0] disabled:text-[#C5D7E0] disabled:cursor-not-allowed px-3 py-[6px]`,
      },
      {
        name: 'secondarySmall',
        button: `cursor-pointer inline-flex items-center gap-2 border border-[#C5D7E0] bg-[#C5D7E0] hover:bg-[#E0EBF0] text-[#37576B] font-['Proxima_Nova'] font-[700] text-[12px] uppercase tracking-wider rounded-full transition-colors focus:outline-none disabled:bg-[#F3F8F9] disabled:border-[#E0EBF0] disabled:text-[#C5D7E0] disabled:cursor-not-allowed px-3 py-[6px]`,
        icon: 'inline-block size-4 shrink-0',
      },
      {
        name: 'primarySmall',
        button: `cursor-pointer inline-flex items-center gap-2 bg-[#EAAD43] hover:bg-[#D49B35] text-[#2D3E4C] font-['Proxima_Nova'] font-[700] text-[12px] uppercase tracking-wider rounded-full transition-colors focus:outline-none disabled:bg-[#F1CA87] disabled:text-[#2D3E4C]/40 disabled:cursor-not-allowed px-3 py-[6px]`,
        icon: 'inline-block size-4 shrink-0',
      },
      {
        // the design's white table-chrome pill (dashboard mockup CSV/Columns
        // buttons): white, mny-200 hairline darkening on hover, 13px/600
        // sentence-case label + optional 14px leading icon (`icon` key — the
        // lexical button's author-picked icon takes its classes from here)
        name: 'pillWhite',
        button: `cursor-pointer inline-flex items-center gap-1.5 bg-white border border-[#C5D7E0] hover:border-[#6D96AE] text-[#37576B] font-['Proxima_Nova'] font-[600] text-[13px] normal-case rounded-full transition-colors focus:outline-none disabled:text-[#C5D7E0] disabled:border-[#E0EBF0] disabled:cursor-not-allowed px-3 py-[6px]`,
        icon: 'inline-block size-3.5 shrink-0 text-[#37576B]',
      },
    ],
  },
  levelClasses: {
    1: " pt-2 pb-1 uppercase text-sm text-blue-400 hover:underline cursor-pointer border-r-2 mr-4",
    2: "pl-2 pt-2 pb-1 uppercase text-sm text-slate-400 hover:underline cursor-pointer border-r-2 mr-4",
    3: "pl-4 pt-2 pb-1 text-sm text-slate-400 hover:underline cursor-pointer border-r-2 mr-4",
    4: "pl-6 pt-2 pb-1 text-sm text-slate-400 hover:underline cursor-pointer border-r-2 mr-4",
  },





  pageControls: {
    controlItem:
      "pl-6 py-0.5 text-md cursor-pointer hover:text-blue-500 text-slate-400 flex items-center",
    select:
      "bg-transparent border-none rounded-sm focus:ring-0 focus:border-0 pl-1",
    selectOption:
      "p-4 text-md cursor-pointer hover:text-blue-500 text-slate-400 hover:bg-blue-600",
  },
  navPadding: {
    1: "",
    2: "",
    3: "",
  },

  table: {
    options: { activeStyle: 0 },
    styles: [
      {
        name: "mny",
        tableContainer:
            "relative flex flex-col w-full h-full min-h-[200px] max-h-[calc(100vh_-_90px)] overflow-y-auto overflow-x-auto scrollbar-sm border rounded-t-[12px]",
        tableContainerNoPagination: "rounded-b-[12px]",
        headerContainer: "sticky top-0 grid ",
        headerLeftGutter: 'flex justify-between sticky left-0 z-[1]',
        headerWrapper: "flex justify-between",
        colResizer: "z-5 -ml-2 w-[1px] hover:w-[2px] bg-gray-200 hover:bg-gray-400",
        headerWrapperFrozen: "",
        headerCellContainer:
            "w-full font-[500] py-4 pl-4 pr-0 font-[Oswald] text-[12px] uppercase text-[#2d3e4c]",
        headerCellContainerBg: "bg-[#F3F8F9] text-gray-900",
        headerCellContainerBgSelected: "bg-gray-50 text-gray-900",
        pivotGroupHeader: "bg-[#F3F8F9] text-[#37576B] text-center border-b border-r border-[#E0EBF0]",
        cell: "relative flex items-center min-h-[36px]  border border-slate-50",
        cellInner: `
          w-full min-h-full flex flex-wrap items-center truncate py-1 px-2
          font-['Proxima_Nova'] font-[400] text-[14px] text-[#37576B] leading-[20px]
      `,
        cellBgOdd: 'bg-gray-50 hover:bg-gray-100',
        cellBgEven: 'bg-white hover:bg-gray-100',
        cellBg: 'bg-white hover:bg-gray-100',
        totalCell: 'hover:bg-gray-150',
        wrapText: 'whitespace-pre-wrap',
        cellEditableTextBox: 'absolute border focus:outline-none min-w-[180px] min-h-[50px] z-[10] whitespace-pre-wrap',
        cellBgSelected: "bg-blue-50 hover:bg-blue-100",
        cellFrozenCol: "",
        cellInvalid: 'bg-red-50 hover:bg-red-100',
        paginationContainer:
            "w-full p-2 rounded-b-[12px] bg-[#F3F8F9] flex items-center justify-between",
        paginationInfoContainer: "",
        paginationPagesInfo:
            "font-[500] font-[Oswald] text-[12px] uppercase text-[#2d3e4c] leading-[18px]",
        paginationRowsInfo: "text-xs font-[Proxima Nova] leading-[14px]",
        paginationControlsContainer:
            "flex flex-row items-center border rounded-[8px] overflow-hidden",
        pageRangeItem:
            "cursor-pointer px-[12px]  py-[7px] font-[Oswald] font-[500] text-[12px] border-r last:border-none uppercase leading-[18px]",
        pageRangeItemInactive: "bg-white text-[#2D3E4C]",
        pageRangeItemActive: "bg-[#2D3E4C] text-white",
        openOutContainer:
            "w-[420px] overflow-auto scrollbar-sm flex flex-col gap-[12px] p-[16px] bg-white h-full float-right",
        openOutContainerWrapper: "absolute inset-0 right-0 h-full w-full z-[100]",
        openOutHeader:
            "font-semibold font-[Proxima Nova] text-[#37576B] text-[14px] leading-[17.05px]",
        openOutValue:
            "font-normal font-[Proxima Nova] text-[#37576B] text-[14px] leading-[19.6px]",
        openOutTitle:
            "font-medium font-[Oswald] text-[24px] leading-[100%] uppercase text-[#2D3E4C]",
        // inline openOut (display.openOutMode:'inline') — expanded detail panel below the row
        // (Description of the Problem/Solution + field chips), matching the mockup's inline expand.
        openOutInlineRow: "w-full px-3 pb-4 bg-[#FCF6EC]/40",
        openOutInlinePanel: "bg-white rounded-[10px] border border-[#E0EBF0] p-4 grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-3",
        openOutInlineField: "min-w-0",
        openOutInlineLabel: "font-[Oswald] text-[10px] font-[500] uppercase tracking-wider text-[#6D96AE] mb-1",
        openOutInlineValue: "font-['Proxima_Nova'] text-[13px] text-[#37576B] leading-[1.5]",
        totalRow: 'bg-gray-100 sticky bottom-0 z-[3]',
        stripedRow: 'even:bg-gray-50',
        // conditional_row_style accent (Phase 3 #5): amber left-edge + faint tint on rows
        // still needing work (county_priority empty). border-l-4 is the reliable cue (a bg
        // tint is largely occluded by opaque cells). Referenced via provider styleKey.
        rowAccentAmber: 'border-l-4 border-[#EAAD43] bg-[#FCF6EC]/60',
        gutterCellWrapper: `flex text-xs items-center justify-center cursor-pointer sticky left-0 z-[1]`,
        gutterCellWrapperNotSelected: 'bg-gray-50 text-gray-500',
        gutterCellWrapperSelected: 'bg-blue-100 text-gray-900',
        openOutCloseIconContainer: 'w-full flex justify-end',
        openOutCloseIconWrapper: 'w-fit h-fit p-[8px] text-[#37576B] border border-[#E0EBF0] rounded-full cursor-pointer',
        openOutCloseIcon: 'XMark',
        openOutContainerWrapperBgColor: '#00000066',
        openOutIconWrapper: 'px-2 cursor-pointer bg-transparent text-gray-500 hover:text-gray-600',
        headerCellWrapper: 'relative w-full',
        headerCellBtn: 'group inline-flex items-center w-full justify-between gap-x-1.5 rounded-md cursor-pointer',
        headerCellLabel: 'truncate select-none',
        headerCellBtnActive: 'bg-gray-300',
        headerCellFnIconClass: 'text-gray-400',
        headerCellCountIcon: 'TallyMark',
        headerCellListIcon: 'LeftToRightListBullet',
        headerCellSumIcon: 'Sum',
        headerCellAvgIcon: 'Avg',
        headerCellGroupIcon: 'Group',
        headerCellSortAscIcon: 'SortAsc',
        headerCellSortDescIcon: 'SortDesc',
        headerCellMenuIcon: 'ArrowDown',
        headerCellMenuIconClass: 'text-gray-400 group-hover:text-gray-600 transition ease-in-out duration-200 print:hidden',
        headerCellIconWrapper: 'flex items-center',
        headerCellMenu: 'py-0.5 flex flex-col gap-0.5 items-center px-1 text-xs text-gray-600 font-regular max-h-[500px] min-w-[180px] ' +
            'z-[10] overflow-auto scrollbar-sm bg-white divide-y divide-gray-100 rounded-md shadow-lg ring-1 ring-black ring-opacity-5',
        headerCellControlWrapper: 'w-full group px-2 py-1 flex justify-between items-center rounded-md hover:bg-gray-100',
        headerCellControlLabel: 'w-fit font-regular text-gray-500 cursor-default',
        headerCellControl: 'p-0.5 w-full rounded-md bg-white group-hover:bg-gray-100 cursor-pointer'
      },
      {
        name: "basic",
        tableContainer: "relative flex flex-col w-full h-full overflow-x-auto scrollbar-sm border rounded-t-[12px]",
        tableContainerNoPagination: "rounded-b-[12px]",
        tableContainer1: "flex flex-col no-wrap min-h-[200px] max-h-[calc(78vh_-_10px)] overflow-y-auto scrollbar-sm",
        headerContainer: "sticky top-0 grid ",
        thead: "flex justify-between",
        theadfrozen: "",
        thContainer: "w-full font-[500] py-4 pl-4 pr-0 font-[Oswald] text-[12px] uppercase text-[#2d3e4c] border-x",
        thContainerBgSelected: "bg-gray-50 text-gray-900",
        thContainerBg: "bg-[#F3F8F9] text-gray-900",
        cell: "relative flex items-center min-h-[36px]  border border-slate-50",
        cellInner: `
          w-full min-h-full flex flex-wrap items-center truncate py-1 px-2
          font-['Proxima_Nova'] font-[400] text-[14px] text-[#37576B] leading-[20px]
      `,
        cellBg: "bg-white",
        cellBgSelected: "bg-blue-50",
        cellFrozenCol: "",
        paginationInfoContainer: "",
        paginationPagesInfo: "font-[500] font-[Oswald] text-[12px] uppercase text-[#2d3e4c] leading-[18px]",
        paginationRowsInfo: "text-xs font-[Proxima Nova] leading-[14px]",
        paginationContainer: "w-full p-2 rounded-b-[12px] bg-[#F3F8F9] flex items-center justify-between",
        paginationControlsContainer: "flex flex-row items-center border rounded-[8px] overflow-hidden",
        pageRangeItem: "cursor-pointer px-[12px]  py-[7px] font-[Oswald] font-[500] text-[12px] border-r last:border-none uppercase leading-[18px]",
        pageRangeItemInactive: "bg-white text-[#2D3E4C]",
        pageRangeItemActive: "bg-[#2D3E4C] text-white",
        openOutContainer: "w-[420px] overflow-auto scrollbar-sm flex flex-col gap-[12px] p-[16px] bg-white h-full float-right",
        openOutContainerWrapper: "absolute inset-0 right-0 h-full w-full z-[100]",
        openOutHeader: "font-semibold font-[Proxima Nova] text-[#37576B] text-[14px] leading-[17.05px]",
        openOutValue: "font-normal font-[Proxima Nova] text-[#37576B] text-[14px] leading-[19.6px]",
        openOutTitle: "font-medium font-[Oswald] text-[24px] leading-[100%] uppercase text-[#2D3E4C]"
      },
      {
        // "mny-clean" (styles[2]) — design-aligned worklist table: horizontal row rules
        // only, NO vertical cell dividers (the Action Prioritize mockup has no gridlines).
        // Inherits every other key from styles[0] ("mny") via getComponentTheme; selected
        // per-section with display.tableStyle:2, so other mny tables are untouched (BC).
        // Registered in design-system/components.html.
        name: "mny-clean",
        cell: "relative flex items-center min-h-[36px] border-b border-[#E0EBF0]",
      },
      {
        // "mny-inventory" (styles[3]) — the Actions Dashboard "Action inventory"
        // table (design/pages/county-actions/dashboard.html §actions-table):
        // fully-rounded bordered card, mny-50 header band with 11px Oswald
        // tracking-wider headers, horizontal-only row rules in mny-50, roomy px-3
        // cells at 13px, and an in-card pagination bar (square page buttons, dark
        // active). Inherits every other key from styles[0] ("mny"); selected
        // per-section with display.tableStyle:'mny-inventory', so other mny tables
        // are untouched (BC). Registered in design-system/components.html.
        name: "mny-inventory",
        tableContainer:
            "relative flex flex-col w-full h-full min-h-[200px] max-h-[calc(100vh_-_90px)] overflow-y-auto overflow-x-auto scrollbar-sm border-x border-t border-[#E0EBF0] rounded-t-[12px]",
        tableContainerNoPagination: "border-b border-[#E0EBF0] rounded-b-[12px]",
        headerCellContainer:
            "w-full font-[500] py-3 px-4 font-[Oswald] text-[11px] uppercase tracking-wider text-[#37576B]",
        // border-b = the design's thead rule (mny-100) — per-cell, so it reads
        // as one continuous line under the header band
        headerCellContainerBg: "bg-[#F3F8F9] border-b border-[#E0EBF0]",
        headerCellContainerBgSelected: "bg-[#E0EBF0] border-b border-[#E0EBF0] text-[#2D3E4C]",
        // the design has NO vertical header dividers — the resizer strip blends in
        // and only surfaces on its own hover (still draggable)
        colResizer: "z-5 -ml-2 w-[1px] hover:w-[2px] bg-transparent hover:bg-[#C5D7E0]",
        // header menu opener reads as the design's sort affordance
        headerCellMenuIcon: 'ArrowsVertical',
        headerCellMenuIconClass: 'text-[#A9BECC] group-hover:text-[#37576B] transition ease-in-out duration-200 print:hidden',
        cell: "relative flex items-center min-h-[52px] border-b border-[#F3F8F9]",
        // px-4/py-4 (not the mockup's px-3/py-3): live cells sit flush in fixed
        // grid tracks so 12px x-padding reads too tight, and the mockup's rows
        // carry a chip line under the action name (≈77px tall) that we don't
        // render — py-4 (52px rows) restores the design's vertical air.
        // BLOCK, not flex (styles[0] uses flex): truncate can't ellipsize a flex
        // container, so overflowing text clipped at the cell's outer edge —
        // running straight through the right padding into the next column.
        // Block + truncate = real ellipsis that stops at the content box; the
        // `.cell` wrapper's items-center keeps vertical centering.
        cellInner: `
          w-full block truncate py-4 px-4
          font-['Proxima_Nova'] font-[400] text-[13px] text-[#37576B] leading-[20px]
      `,
        // whole-ROW hover (the design's `<tr>` hover): the row is a named group
        // and every cell tints on it — not per-cell hover
        row: "group/row",
        cellBg: "bg-white group-hover/row:bg-[#F3F8F9]/60",
        cellBgOdd: "bg-white group-hover/row:bg-[#F3F8F9]/60",
        cellBgEven: "bg-white group-hover/row:bg-[#F3F8F9]/60",
        // The design's emphasized identity columns (Jurisdiction, Action Name):
        // a column opts in with valueFontStyle:'cellEmphasis' (TableCell resolves
        // valueFontStyle keys against the merged table style).
        cellEmphasis: "font-['Proxima_Nova'] text-[14px] font-[600] text-[#2D3E4C]",
        // icon-only action column (linkIcon link body): centered 16px chevron in
        // the design's muted blue, darkening on hover (flex restores centering —
        // cellInner is block in this style)
        cellActionIcon: "flex items-center justify-center text-[#6D96AE] hover:text-[#2D3E4C] [&_svg]:size-4",
        // pagination completes the card: mny-50 bar, bottom rounding + border
        paginationContainer:
            "w-full px-3 py-1.5 rounded-b-[12px] bg-[#F3F8F9] border-x border-b border-t border-[#E0EBF0] flex items-center justify-between",
        // tight leading pulls the Page/Rows lines together so the footer stays
        // one compact bar (the design's is single-line)
        paginationPagesInfo: "font-['Proxima_Nova'] text-[12px] leading-[15px] text-[#6D96AE]",
        paginationRowsInfo: "font-['Proxima_Nova'] text-[12px] leading-[15px] text-[#6D96AE]",
        paginationControlsContainer: "flex flex-row items-center gap-1",
        pageRangeItem:
            "cursor-pointer min-w-7 h-7 px-1.5 rounded-md flex items-center justify-center font-['Proxima_Nova'] text-[12px] font-[600] tabular-nums",
        pageRangeItemInactive: "text-[#37576B] hover:bg-[#E0EBF0]",
        pageRangeItemActive: "bg-[#2D3E4C] text-white font-[700]",
        // expand caret + inline expansion sit on the blue-gray tint (not the
        // amber worklist tint styles[0] uses); the expander is the design's
        // chevron pair (right = collapsed, down = expanded), not InfoCircle
        openOutIconWrapper:
            "mx-1 size-6 rounded-md flex items-center justify-center cursor-pointer bg-transparent text-[#6D96AE] hover:text-[#2D3E4C] hover:bg-[#E0EBF0]",
        openOutIcon: 'ChevronRight',
        openOutIconOpen: 'ChevronDown',
        openOutIconSize: 16,
        openOutInlineRow: "w-full px-3 pb-4 bg-[#F3F8F9]/40",
      }
    ]
  },
  // stacked_bar columnType palette — the Action Prioritize progress lede's tier
  // distribution (T1 amber → T4 pale + not-set). Registered in components.html.
  stackedBar: {
    wrapper: "w-full",
    track: "w-full flex h-[8px] rounded-full overflow-hidden bg-white border border-[#F1CA87]/50",
    segment: "h-full shrink-0",
    legend: "pt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-['Proxima_Nova'] font-[500] text-[#37576B] normal-case tracking-normal",
    empty: "pt-2 text-[11px] font-['Proxima_Nova'] text-[#6D96AE]",
    fills: {
      tier1: "bg-[#EAAD43]",
      tier2: "bg-[#37576B]",
      tier3: "bg-[#6D96AE]",
      tier4: "bg-[#C5D7E0]",
      tierNone: "bg-white border border-[#C5D7E0]",
    },
  },
  // Map section container: h-full/flex-1 so a Map with NO height option set
  // fills its section cell — pair with section height:'fill' (+ rowspan) to let
  // a sibling column drive the band height (Actions Dashboard map ↔ charts).
  // Maps WITH a height option keep it (inline style wins over the class).
  damaMap: {
    container: "w-full relative h-full flex-1 min-h-[300px]",
  },
  // data_bar columnType palette — the Actions Dashboard portfolio-mix bar lists
  // (hazards = primary mny-400, type-of-work = deep mny-700). Same registration
  // pattern as stackedBar above.
  // code_with_sub — the rail's two-part rows ("Highway Department" over "Town of
  // Delaware", "Community Infrastructure" over "Drainage, underground utilities").
  // The library default is an INLINE Oswald-uppercase code + tiny slate sub; the mny
  // design stacks a proseSMSemibold line over a proseXS line. `flex flex-col` with no
  // items-* keeps alignment with the cell (the rail cells justify right).
  code_with_sub: {
    wrapper: "flex flex-col",
    code: "font-semibold font-[Proxima Nova] text-[14px] leading-[140%] normal-case text-[#2D3E4C]",
    sub:  "font-normal font-[Proxima Nova] text-[12px] leading-[140%] normal-case text-[#6D96AE]",
  },

  dataBar: {
    track: "relative flex-1 min-w-0 h-[14px] rounded-full bg-[#F3F8F9] overflow-hidden",
    fill: "absolute inset-y-0 left-0 rounded-full",
    fills: {
      primary: "bg-[#6D96AE]",
      deep: "bg-[#37576B]",
      muted: "bg-[#C5D7E0]",
    },
  },
  attribution: {
    wrapper: "w-full flex flex-col gap-[4px] text-[#2D3E4C] text-xs",
    label: "font-semibold text-[12px] leading-[14.62px] border-t pt-[14px]",
    link: "font-normal leading-[14.62px] text-[12px] underline",
  },
  label: {
    labelWrapper:
      "w-full px-[12px] pt-[9px] pb-[7px] bg-[#C5D7E0] hover:bg-[#E0EBF0] group rounded-[1000px]",
    labelWrapperDisabled:
      "px-[12px] pt-[9px] pb-[7px] bg-[#F3F8F9] group rounded-[1000px]",
    label: "text-[12px] text-[#37576B] font-bold leading-[14.62px]",
    labelDisabled: "text-[12px] text-[#C5D7E0] font-bold leading-[14.62px]",
  },
  // Pill styles — selected by name via `activeStyle` (or the `status_pill` column
  // type's pillColors map). styles[0..9] REPRODUCE the DMS default (Pill.theme.js)
  // verbatim so any existing mny pill renders exactly as before (backward-compatible);
  // the mny-branded `status_*` and `tier_*` variants are appended for the Action
  // Prioritize worklist (implementation status + county priority). See task
  // planning/mitigateny/tasks/current/mny-action-prioritize-v2-live-build.md (Phase 2).
  pill: {
    options: { activeStyle: 0 },
    styles: [
      // --- DMS defaults, reproduced verbatim (do not restyle — BC for other pages) ---
      { name: 'default', wrapper: 'inline-flex items-center gap-x-1.5 rounded-md px-1.5 py-0.5 text-sm/5 font-regular sm:text-xs/5 forced-colors:outline text-gray-400' },
      { name: 'gray',    wrapper: 'inline-flex items-center gap-x-1.5 rounded-md px-1.5 py-0.5 text-sm/5 font-regular sm:text-xs/5 forced-colors:outline text-gray-400' },
      { name: 'orange',  wrapper: 'inline-flex items-center gap-x-1.5 rounded-md px-1.5 py-0.5 text-sm/5 font-regular sm:text-xs/5 forced-colors:outline bg-orange-500/15 text-orange-700 hover:bg-orange-500/25' },
      { name: 'blue',    wrapper: 'inline-flex items-center gap-x-1.5 rounded-md px-1.5 py-0.5 text-sm/5 font-regular sm:text-xs/5 forced-colors:outline bg-blue-500/15 text-blue-700 hover:bg-blue-500/25' },
      { name: 'green',   wrapper: 'inline-flex items-center gap-x-1.5 rounded-md px-1.5 py-0.5 text-sm/5 font-regular sm:text-xs/5 forced-colors:outline bg-green-500/15 text-green-700 hover:bg-green-500/25' },
      { name: 'red',     wrapper: 'inline-flex items-center gap-x-1.5 rounded-md px-1.5 py-0.5 text-sm/5 font-regular sm:text-xs/5 forced-colors:outline bg-red-500/15 text-red-700 hover:bg-red-500/25' },
      { name: 'status_good', wrapper: "inline-flex items-center gap-1.5 text-sm text-emerald-700 [&::before]:content-[''] [&::before]:size-1.5 [&::before]:rounded-full [&::before]:mr-0.5 [&::before]:bg-emerald-500" },
      { name: 'status_warn', wrapper: "inline-flex items-center gap-1.5 text-sm text-amber-700 [&::before]:content-[''] [&::before]:size-1.5 [&::before]:rounded-full [&::before]:mr-0.5 [&::before]:bg-amber-400" },
      { name: 'status_bad',  wrapper: "inline-flex items-center gap-1.5 text-sm text-rose-700 [&::before]:content-[''] [&::before]:size-1.5 [&::before]:rounded-full [&::before]:mr-0.5 [&::before]:bg-rose-500" },
      { name: 'status_na',   wrapper: "inline-flex items-center gap-1.5 text-sm text-slate-500 [&::before]:content-[''] [&::before]:size-1.5 [&::before]:rounded-full [&::before]:mr-0.5 [&::before]:bg-slate-400" },

      // --- mny implementation-status dots (dotted, brand palette) ---
      { name: 'status_proposed',     wrapper: "inline-flex items-center gap-1.5 font-['Proxima_Nova'] text-[13px] text-[#37576B] [&::before]:content-[''] [&::before]:size-2 [&::before]:rounded-full [&::before]:bg-[#6D96AE]" },
      { name: 'status_inprogress',   wrapper: "inline-flex items-center gap-1.5 font-['Proxima_Nova'] text-[13px] text-[#37576B] [&::before]:content-[''] [&::before]:size-2 [&::before]:rounded-full [&::before]:bg-[#54B99B]" },
      { name: 'status_completed',    wrapper: "inline-flex items-center gap-1.5 font-['Proxima_Nova'] text-[13px] text-[#37576B] [&::before]:content-[''] [&::before]:size-2 [&::before]:rounded-full [&::before]:bg-[#2D3E4C]" },
      { name: 'status_discontinued', wrapper: "inline-flex items-center gap-1.5 font-['Proxima_Nova'] text-[13px] text-[#37576B] [&::before]:content-[''] [&::before]:size-2 [&::before]:rounded-full [&::before]:bg-[#DD524C]" },
      { name: 'status_none',         wrapper: "inline-flex items-center gap-1.5 font-['Proxima_Nova'] text-[13px] text-[#6D96AE] [&::before]:content-[''] [&::before]:size-2 [&::before]:rounded-full [&::before]:bg-[#C5D7E0]" },

      // --- mny county-priority tiers (bordered fill; rank reads from fill weight) ---
      { name: 'tier_1',     wrapper: "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 border border-[#EAAD43] bg-[#FCF6EC] font-['Proxima_Nova'] font-[600] text-[12px] text-[#2D3E4C]" },
      { name: 'tier_2',     wrapper: "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 border border-[#C5D7E0] bg-[#F3F8F9] font-['Proxima_Nova'] font-[600] text-[12px] text-[#2D3E4C]" },
      { name: 'tier_3',     wrapper: "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 border border-[#C5D7E0] bg-[#F3F8F9] font-['Proxima_Nova'] font-[600] text-[12px] text-[#37576B]" },
      { name: 'tier_4',     wrapper: "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 border border-[#E0EBF0] bg-white font-['Proxima_Nova'] font-[600] text-[12px] text-[#6D96AE]" },
      { name: 'tier_unset', wrapper: "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 border border-dashed border-[#EAAD43] bg-white font-['Proxima_Nova'] font-[600] text-[12px] text-[#2D3E4C]" },

      // --- mny jurisdictional-priority pills (Actions Dashboard inventory table;
      // shape = the dashboard mockup's High pill, weights = the state-dashboard
      // amber ramp High #EAAD43 → Medium #F1CA87 → Low #FCF6EC+ring; unset
      // values render as muted italic TEXT per the design, not a pill) ---
      { name: 'priority_high',   wrapper: "inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#EAAD43]/15 border border-[#EAAD43]/60 font-['Proxima_Nova'] text-[11px] font-[700] text-[#2D3E4C]" },
      { name: 'priority_medium', wrapper: "inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#F1CA87]/20 border border-[#F1CA87] font-['Proxima_Nova'] text-[11px] font-[700] text-[#2D3E4C]" },
      { name: 'priority_low',    wrapper: "inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#FCF6EC] border border-[#C5D7E0] font-['Proxima_Nova'] text-[11px] font-[700] text-[#37576B]" },
      { name: 'priority_unset',  wrapper: "inline-flex items-center font-['Proxima_Nova'] text-[13px] italic text-[#6D96AE]" },

      // --- mny jurisdiction-kind pills (Jurisdictions page tiles: Town neutral,
      // Village amber-tinted, County solid dark — jurisdictions.html mockup) ---
      { name: 'juris_town',    wrapper: "inline-flex items-center px-2 py-0.5 rounded-full bg-[#E0EBF0] font-['Proxima_Nova'] text-[10px] font-[700] uppercase tracking-wider text-[#37576B]" },
      { name: 'juris_village', wrapper: "inline-flex items-center px-2 py-0.5 rounded-full bg-[#FCF6EC] border border-[#F1CA87]/50 font-['Proxima_Nova'] text-[10px] font-[700] uppercase tracking-wider text-[#2D3E4C]" },
      { name: 'juris_county',  wrapper: "inline-flex items-center px-2 py-0.5 rounded-full bg-[#2D3E4C] font-['Proxima_Nova'] text-[10px] font-[700] uppercase tracking-wider text-white" },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────────
  // textSettings — the global type scale, 1:1 with the Type section of
  // design/design-system/theme.html (§7.2.1 of designing-a-dms-design-system).
  //
  // ADDED 2026-08-27 (type audit). Before this, mny had NO textSettings block at
  // all: `buildFontStyleOptions` in Card.config.jsx builds the toolbar's Value /
  // Header font pickers from `getComponentTheme(theme,'textSettings')`, so those
  // dropdowns were EMPTY for every mny author — a token could only be applied by
  // editing element-data directly. The type keys lived under `dataCard` instead,
  // where Card.jsx's `{...textSettings, ...dataCard}` merge still resolved them
  // at render time, which is why pages looked right while authoring was broken.
  //
  // ADDITIVE: the legacy `textXS … text8XL` keys stay on dataCard untouched, so
  // every page built against them (the Actions Dashboard, the prioritize pages)
  // renders byte-identically. New work uses the names below.
  //
  // Two intrinsic properties are baked in rather than left as call-site modifiers,
  // because a DMS Card cell has ONE style slot and no way to add a class beside it:
  //   · prose carries `normal-case!` — `dataCard.header` forces `uppercase` on every
  //     header cell, so a prose label would render shouty without it.
  //   · metaXXS carries its 0.05em tracking and #6D96AE ink — both are uniform
  //     across all 45 uses in the mockups, so they are part of the role, not a
  //     variation of it.
  // ───────────────────────────────────────────────────────────────────────────
  textSettings: {
    options: {
      activeStyle: 0,
      // Lexical's `/Style:` slash menu lists every textSettings key unless this
      // allow-list is present. The three `*Semibold` keys exist only so a Card
      // cell can reach the weight modifier — in a lexical block weight is a
      // call-site class, so they'd just be noise in the menu.
      slashKeys: [
        'displayHero', 'displayXL', 'displayLG', 'displayMD', 'displaySM', 'displayXS',
        'metaLG', 'metaMD', 'metaSM', 'metaXS', 'metaXXS',
        'proseLG', 'prose', 'proseSM', 'proseXS',
      ],
    },
    styles: [
      {
        name: 'default',

        // ── Display — Oswald 500, always uppercase (headlines) ──
        displayHero: "font-medium font-[Oswald] text-[96px] leading-[95%] uppercase tracking-[-0.02em]",
        displayXL:   "font-medium font-[Oswald] text-[72px] leading-[100%] uppercase",
        displayLG:   "font-medium font-[Oswald] text-[60px] leading-[100%] uppercase",
        displayMD:   "font-medium font-[Oswald] text-[48px] leading-[100%] uppercase",
        displaySM:   "font-medium font-[Oswald] text-[36px] leading-[100%] uppercase tracking-[-0.05em]",
        displayXS:   "font-medium font-[Oswald] text-[30px] leading-[100%] uppercase tracking-[-0.05em]",

        // ── Meta — Oswald 500, uppercase (labels, chrome, eyebrows) ──
        metaLG:  "font-medium font-[Oswald] text-[24px] leading-[100%] uppercase",
        metaMD:  "font-medium font-[Oswald] text-[16px] leading-[100%] uppercase",
        metaSM:  "font-medium font-[Oswald] text-[14px] leading-[100%] uppercase",
        metaXS:  "font-medium font-[Oswald] text-[12px] leading-[100%] uppercase",
        // earned 2026-08-27 — the field-label voice (1,397 uses across pages/)
        metaXXS: "font-medium font-[Oswald] text-[10px] leading-[100%] uppercase tracking-[0.05em] text-[#6D96AE]",

        // ── Prose — Proxima Nova / Source Sans 3 (body, captions) ──
        proseLG: "font-normal font-['Proxima_Nova',_system-ui,_sans-serif] text-[20px] leading-[140%] normal-case!",
        prose:   "font-normal font-['Proxima_Nova',_system-ui,_sans-serif] text-[16px] leading-[140%] normal-case!",
        proseSM: "font-normal font-['Proxima_Nova',_system-ui,_sans-serif] text-[14px] leading-[140%] normal-case!",
        proseXS: "font-normal font-['Proxima_Nova',_system-ui,_sans-serif] text-[12px] leading-[140%] normal-case!",

        // ── Weight modifier, reachable from a Card cell ──
        // Same three prose ROLES, not new ones. The design system expresses weight
        // as a call-site class; a Card cell has no call site, so it gets these.
        proseLGSemibold: "font-semibold font-['Proxima_Nova',_system-ui,_sans-serif] text-[20px] leading-[140%] normal-case!",
        proseSemibold:   "font-semibold font-['Proxima_Nova',_system-ui,_sans-serif] text-[16px] leading-[140%] normal-case!",
        proseSMSemibold: "font-semibold font-['Proxima_Nova',_system-ui,_sans-serif] text-[14px] leading-[140%] normal-case!",
        // earned 2026-08-27 — the chart-row label voice (Actions Dashboard bar
        // lists: proxima 12px/600, tight leading so two-line labels stay compact)
        proseXSSemibold: "font-semibold font-['Proxima_Nova',_system-ui,_sans-serif] text-[12px] leading-[115%] normal-case!",
      }
    ]
  },

  dataCard: {
    styles: [
      {
        name: "default",
        columnControlWrapper:
            "grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-x-1 gap-y-0.5",
        columnControlHeaderWrapper: `px-1 font-semibold border bg-gray-50 text-gray-500`,

        mainWrapperCompactView: "grid",
        mainWrapperSimpleView: "flex flex-col",
        subWrapper: "w-full text-[#2D3E4C]",
        subWrapperCompactView: "flex flex-col flex-wrap rounded-[12px]",
        subWrapperSimpleView: "grid",

        headerValueWrapper:
            "w-full rounded-[12px] flex items-center gap-[4px] justify-center p-2",
        headerValueWrapperCompactView: "rounded-none ",
        // Per-side cell borders, read by Card.jsx's `cellBorderSides()` for the
        // per-column cellBorderTop/Right/Bottom/Left (cellBorderBelow = bottom).
        // Without this mny fell through to the library default
        // (`border-b-zinc-950/15`), which is both the wrong ink AND keeps the
        // cell's `rounded-[12px]` — so every divider rendered as a curved grey
        // hairline. `rounded-none!` squares the cell whenever a side is drawn.
        // A `top` rule separates blocks (structural → base ink); a `bottom` rule
        // underlines a heading inside a block (decorative → subtle ink). That is
        // the distinction the mockups draw, and it falls out of Card usage for
        // free. Cards on other surfaces pick the `tinted` / `framed` style below.
        cellBorderSides: ruleSides(MNY_RULE.base, MNY_RULE.subtle),
        headerValueWrapperBorderBelow: "border-b border-[#C0D8E1] rounded-none", // custom added border
        headerValueWrapperSimpleView: "",
        // Card surface border. The library default is 'border shadow'; mny's cards
        // are flat panels with a hairline (the shadow lives on the section/layout).
        // NOTE: `display.cardsBorderColor` is inert in this build — Card.jsx forwards
        // only a subset of `display` to resolveCellsGridStyle and drops
        // cardsRadius/cardsBorderColor — so the card hairline has to come from here.
        cardBorder: 'border border-[#E0EBF0] shadow-none',
        itemBorder: 'border shadow',
        // active state for an `activeOnSearchParam` link cell (stat strip): the cell
        // whose link params match the live page filters gets a tint + ring. Replaces
        // the old hardcoded cellBgColor fake-active. (Phase 3 #2)
        cellActive: 'bg-[#F3F8F9] ring-2 ring-[#2D3E4C]/30',
        itemFlexCol: 'flex-col',
        itemFlexRow: 'flex-row',
        itemFlexColReverse: 'flex-col flex-col-reverse',
        itemFlexRowReverse: 'flex-row flex-row-reverse',
        iconAndColorValues: 'flex items-center gap-1.5 uppercase',

        formEditButtonsWrapper: 'self-end flex gap-0.5 text-sm',
        formAddNewItemButton: 'font-[Proxima Nova] bg-[#C5D7E0] hover:bg-[#E0EBF0] text-[#37576B] font-bold uppercase rounded-lg w-fit px-2 py-1 mr-0.5 mb-0.5 self-end cursor-pointer',
        formEditSaveButton: 'font-[Proxima Nova] bg-[#F1CA87] hover:bg-[#EAAD43] text-[#2D3E4C] font-bold uppercase rounded-lg w-fit px-2 py-1 mr-0.5 mb-0.5 self-end cursor-pointer',
        formEditCancelButton: 'font-[Proxima Nova] bg-[#DD524C] hover:bg-[#AA2E26] text-[#2D3E4C] font-bold uppercase rounded-lg w-fit px-2 py-1 mr-0.5 mb-0.5 self-end cursor-pointer',
        formEditSavingAnimation: 'ring-2 ring-blue-400 animate-pulse',
        linkColValue:
            "flex-1 flex justify-center w-full bg-[#C5D7E0] rounded-full px-[12px] py-[8px] font-[Proxima Nova] font-bold text-[12px] leading-[100%] tracking-[0px] uppercase",
        justifyTextLeft: "text-start justify-items-start",
        justifyTextRight: "text-end justify-items-end",
        justifyTextCenter: "text-center justify-items-center",
        // chart-row label ROLE (Actions Dashboard bar lists): proseXSSemibold's
        // voice + the design's link colors (mny-700, darkening on hover). A role
        // key rather than color on the prose token — the type scale stays
        // color-free; reached per-column via valueFontStyle (Card resolves it
        // against the {textSettings, ...dataCard} merge).
        chartRowLabel:
            "font-semibold font-['Proxima_Nova',_system-ui,_sans-serif] text-[12px] leading-[115%] normal-case! text-[#37576B] hover:text-[#2D3E4C]",
        // stat-card ROLES (Actions Dashboard status strip): 11px tracked label
        // (Strong = the "All actions" card), value = displayXS at the cell level,
        // 11px muted "N% of actions" subline (via subValueFontStyle)
        statCardLabel:
            "font-['Proxima_Nova'] text-[11px] font-[600] uppercase tracking-wide leading-[140%] text-[#37576B]",
        statCardLabelStrong:
            "font-['Proxima_Nova'] text-[11px] font-[700] uppercase tracking-wide leading-[140%] text-[#2D3E4C]",
        // w-full: the subline div takes only this key's classes, and the cell
        // wrapper centers non-full children — full width keeps it left-aligned
        // under the value like the design
        statCardSub:
            "w-full font-['Proxima_Nova'] text-[11px] leading-[140%] text-[#6D96AE] mt-1",
        // amber count chip ("N to tier" — Jurisdictions page tiles). Ink baked in
        // like metaXXS: uniform across every use in the mockup.
        chipAmber:
            "font-['Proxima_Nova'] text-[11px] font-[700] text-[#EAAD43] whitespace-nowrap",
        textXS: "font-medium font-[Oswald] text-[12px] leading-[140%]",
        textXSReg:
            "font-normal font-[Proxima Nova] text-[12px] leading-[100%] uppercase",
        textXSSemiBold:
            "font-semibold font-[Proxima Nova] text-[12px] leading-[100%] uppercase",
        textSM: "font-medium font-[Oswald] text-[14px] leading-[100%] uppercase",
        textSMReg: "font-normal font-[Proxima Nova] text-[14px] leading-[140%]",
        textSMBold: "font-normal font-[Proxima Nova] text-[14px] leading-[140%]",
        textSMSemiBold:
            "font-semibold font-[Proxima Nova] text-[14px] leading-[140%]",
        textMD: "font-medium font-[Oswald] text-[16px] leading-[100%] uppercase",
        textMDReg: "font-normal font-[Proxima Nova] text-[16px] leading-[140%]",
        textMDBold: "font-bold font-[Proxima Nova] text-[16px] leading-[140%]",
        textMDSemiBold:
            "font-semibold font-[Proxima Nova] text-[16px] leading-[140%]",
        textXL: "font-medium font-[Oswald] text-[20px] leading-[100%] uppercase",
        textXLSemiBold:
            "font-semibold font-[Proxima Nova] text-[20px] leading-[120%]",
        text2XL: "font-medium font-[Oswald] text-[24px] leading-[100%] uppercase",
        text2XLReg:
            "font-regular font-[Oswald] text-[24px] leading-[120%] uppercase",
        text3XL:
            "font-medium font-[Oswald] text-[30px] leading-[100%] uppercase tracking-[-0.05em]",
        text3XLReg:
            "font-normal font-[Oswald] text-[30px] leading-[120%] uppercase",
        text4XL:
            "font-medium font-[Oswald] text-[36px] leading-[100%] uppercase tracking-[-0.05em]",
        text5XL:
            "font-medium font-[Oswald] text-[48px] leading-[100%] uppercase tracking-[-0.05em]",
        text6XL: "font-medium font-[Oswald] text-[60px] leading-[100%] uppercase",
        text7XL:
            "font-medium font-[Oswald] text-[72px] leading-[100%] uppercase tracking-normal",
        text8XL:
            "font-medium font-[Oswald] text-[96px] leading-[95%] uppercase tracking-normal ",

        imgXS: "max-w-16 max-h-16",
        imgSM: "max-w-24 max-h-24",
        imgMD: "max-w-32 max-h-32",
        imgXL: "max-w-40 max-h-40",
        img2XL: "max-w-48 max-h-48",
        img3XL: "max-w-56 max-h-56",
        img4XL: "max-w-64 max-h-64",
        img5XL: "w-full",
        img6XL: "max-w-80 max-h-80",
        img7XL: "max-w-96 max-h-96",
        img8XL: "max-w-128 max-h-128",
        imgDefault: 'max-w-[50px] max-h-[50px]',

        header: "w-full flex-1 uppercase text-[#37576B]",
        headerCompactView: "",
        headerSimpleView: "",
        value: "w-full text-[#2D3E4C]",
        valueWrapper: 'min-h-[20px]',
        valueCompactView: "",
        valueSimpleView: "",
        description: "text-[#2D3E4C] font-light normal-case font-[Oswald] text-[12px]",

        componentWrapper: 'w-full',
      },
      {
        // Dark-band variant. Geometry, typography and every other key are
        // inherited from styles[0] by getComponentTheme — only the ink is
        // restated, because that is the only thing a dark surface changes.
        //
        // Chosen per-section from the Card toolbar's "Card style" picker
        // (`display.cardStyle`), so any Card an author drops onto a
        // `darkSection` layoutGroup can be made legible without code. Before
        // this existed, `value: "w-full text-[#2D3E4C]"` was declared on the
        // element itself and no ancestor colour could override it — a Card on a
        // dark band rendered dark-on-dark with no authoring escape hatch.
        name: "Dark",
        subWrapper: "w-full text-white",
        header: "w-full flex-1 uppercase text-[#C5D7E0]",
        value: "w-full text-white",
        description: "text-[#C5D7E0] font-light normal-case font-[Oswald] text-[12px]",
      },
      {
        // Card sitting ON the mny-50 tint (the Action View key-facts rail). A
        // base rule disappears against the tint, so every side steps up to the
        // strong ink — which is exactly what the mockups draw there.
        // Named styles inherit every other key from styles[0] (getComponentTheme),
        // so this is a one-key style. Reach it with `display.cardStyle: 'tinted'`
        // (toolbar: Card style).
        name: "tinted",
        cellBorderSides: ruleSides(MNY_RULE.strong),
      },
      {
        // Framed white card (the Action Record). Its own hairline is the base
        // ink, so its internal rules match rather than dropping to subtle.
        name: "framed",
        cellBorderSides: ruleSides(MNY_RULE.base),
      }
    ]
  },
  tabs: {
    options: {
      activeStyle: 0
    },
    styles: [
      {
        tabGroup: 'flex flex-col-reverse',
        tablist: 'flex gap-4',
        tab: `
    py-1 px-3 font-semibold text-slate-600 focus:outline-none border-b-2 border-white text-xs hover:text-slate-900
    aria-selected:border-blue-500 aria-selected:bg-white/10 hover:bg-white/5 aria-selected:hover:bg-white/10 focus-visible:outline-1 focus-visible:outline-white
  `,
        tabpanels: '',
        tabpanel: 'rounded-xl bg-white/5'
      },
      {
        tabGroup: 'flex flex-row flex-row-reverse divide-x divide-x-reverse divide-[#37576b8c]', // #37576bab #37576b8c #37576bc9
        tablist: 'flex flex-col',
        tab: `
    px-2 py-2 font-semibold text-[#37576B] text-xs hover:text-[#2D3E4C] focus:outline-none border-b-2 border-white
    aria-selected:bg-[#2D3E4C] aria-selected:text-white hover:bg-white/5 aria-selected:text-white focus-visible:outline-1 focus-visible:outline-white cursor-pointer
  `,
        tabpanels: 'w-full h-screen max-h-screen overflow-y-auto scrollbar-sm',
        tabpanel: 'rounded-xl bg-white/5 divide-y divide-[#37576b8c]',
        tabTitle: 'p-2 text-[#2D3E4C]'
      },
      {
        name: 'pages-pane',
        tabGroup: 'flex flex-row divide-x divide-[#37576b8c]',
        tablist: 'flex flex-col gap-1 pt-12',
        tab: `
    px-2 py-3 font-semibold text-[#37576B] text-xs hover:text-[#2D3E4C] focus:outline-none border-b-2 border-white
    aria-selected:bg-[#2D3E4C] aria-selected:text-white hover:bg-white/5 aria-selected:text-white focus-visible:outline-1 focus-visible:outline-white cursor-pointer
  `,
        tabpanels: 'w-full max-h-screen overflow-y-auto scrollbar-sm',
        tabpanel: 'rounded-xl bg-white/5 divide-y divide-[#37576b8c]',
        tabTitle: 'p-2 text-[#2D3E4C]'
      },
    ]
  },
  filters: {
    // options/styles pattern (same as `lexical`/`table`): a section picks a
    // variant by name via `display.filterStyle` (see FilterComponent.config.js);
    // getComponentTheme resolves it with inheritance from styles[0]. styles[0]
    // is the historical flat map, verbatim → existing filter sections are BC.
    options: { activeStyle: 0 },
    styles: [
      {
        name: "default",
        filtersWrapper: "w-full flex flex-col rounded-md",
        // --- interactive chrome (Phase 3 follow-up): Needs-priority toggle + active tokens + clear-all.
        // New keys, unused by existing filter sections → BC. The toggle button is a `group` with data-on. ---
        toggleChip: "group inline-flex items-center cursor-pointer h-[38px]",
        toggleChipOn: "",
        toggleTrack: "w-9 h-5 rounded-full bg-[#C5D7E0] group-data-[on]:bg-[#EAAD43] flex items-center px-0.5 transition-colors",
        toggleKnob: "w-4 h-4 rounded-full bg-white shadow-sm transition-transform group-data-[on]:translate-x-4",
        activeTokensWrapper: "flex flex-wrap items-center gap-2 mt-3",
        activeToken: "inline-flex items-center gap-1 bg-[#C5D7E0] rounded-full pl-2.5 pr-1.5 py-1 font-['Proxima_Nova'] text-[12px] text-[#37576B]",
        activeTokenRemove: "text-[#6D96AE] hover:text-[#2D3E4C] cursor-pointer",
        clearAll: "font-['Proxima_Nova'] text-[12px] font-[600] text-[#6D96AE] hover:text-[#2D3E4C] underline underline-offset-2 cursor-pointer",
        filterLabel:
          "py-0.5 font-[Proxima Nova] font-regular text-[14px] text-[#2D3E4C] leading-[140%] tracking-[0px] capitalize text-balance",
        loadingText: "pl-0.5 font-thin text-[#2D3E4C]",
        filterSettingsWrapperInline: "w-2/3",
        filterSettingsWrapperStacked: "w-full",
        labelWrapperInline: "w-1/3 text-xs",
        labelWrapperStacked: "w-full text-xs",
        input:
          "w-full max-h-[150px] flex rounded-[12px] px-[10px] py-[4px] gap-[6px] text-[14px] text-[#37576B] border leading-[140%] tracking-[0px] bg-white overflow-auto scrollbar-sm text-nowrap",
        settingPillsWrapper: "flex flex-row flex-wrap gap-1",
        settingPill:
          "px-1 py-0.5 bg-orange-500/15 text-orange-700 hover:bg-orange-500/25 rounded-md",
        settingLabel: "text-gray-900 font-regular min-w-fit",
      },
      {
        // Style 1: pillBar — horizontal rounded-pill filter bar (MNY Action
        // Prioritize v3, gap #3; aligned to the county-actions mockup filter
        // bar 2026-08-25). Everything not overridden here inherits from
        // styles[0] (toggle switch, tokens, clear-all, loadingText, input …).
        // `placement:'inline'` puts each label beside its control inside a
        // white rounded-full pill; the whole set sits in a tinted band.
        // `controlStyle` names the multiselect/input style the actual control
        // renders with (see the `multiselect`/`input` pill styles below).
        name: "pillBar",
        placement: "inline",
        controlStyle: "pill",
        filtersWrapper:
          "w-full bg-[#F3F8F9] rounded-[12px] border border-[#E0EBF0] px-4 py-3 flex flex-wrap items-center gap-2",
        conditionsGrid: "w-full flex flex-wrap items-center gap-2",
        conditionRowInline:
          "flex items-center gap-1.5 bg-white rounded-full pl-3 pr-2.5 py-1.5 border border-[#C5D7E0] hover:border-[#6D96AE] focus-within:border-[#6D96AE] transition-colors",
        labelWrapperInline: "w-auto shrink-0",
        filterSettingsWrapperInline: "w-auto min-w-[64px]",
        filterLabel:
          "font-['Proxima_Nova'] text-[13px] text-[#37576B] whitespace-nowrap capitalize",
        activeTokensWrapper: "flex flex-wrap items-center gap-2 pt-0.5",
      },
    ],
  },
  // Filter-bar CONTROL styles — referenced by filters.pillBar.controlStyle.
  // styles[0] is intentionally EMPTY (name only): components merge the resolved
  // style over their library defaults, so an empty default = library look, and
  // only sections whose filter style names 'pill' get the branded treatment.
  multiselect: {
    options: { activeStyle: 0 },
    styles: [
      { name: "default" },
      {
        // Borderless trigger that lives INSIDE the pillBar's white pill row
        // (the row draws the pill; the control is just value text + caret),
        // plus the branded dropdown menu.
        name: "pill",
        inputWrapper:
          "relative flex flex-wrap items-center gap-1 w-full min-h-0 cursor-pointer border-0 bg-transparent pl-0 pr-5 py-0 text-[13px] focus-within:ring-0",
        caretWrapper: "pointer-events-none absolute inset-y-0 right-0 flex items-center",
        caretIcon: "size-3.5 stroke-[#6D96AE]",
        singleValue: "truncate font-['Proxima_Nova'] text-[13px] text-[#2D3E4C]",
        singlePlaceholder: "truncate font-['Proxima_Nova'] text-[13px] text-[#6D96AE]",
        statusWrapper: "flex items-center font-['Proxima_Nova'] text-[13px] text-[#37576B]",
        singleClearWrapper:
          "absolute inset-y-0 right-4 flex items-center cursor-pointer text-[#6D96AE] hover:text-[#DD524C]",
        tokenWrapper:
          "inline-flex items-center gap-x-1 rounded-full bg-[#E0EBF0] px-2 py-0.5 font-['Proxima_Nova'] text-[12px] font-[600] text-[#37576B] whitespace-nowrap",
        menuWrapper:
          "isolate min-w-[var(--button-width,11rem)] p-1.5 rounded-[12px] bg-white shadow-lg ring-1 ring-[#C5D7E0]",
        alwaysOpenMenuWrapper: "w-full p-1.5 rounded-[12px] bg-white ring-1 ring-[#C5D7E0] z-20",
        input:
          "block w-full appearance-none rounded-[8px] focus:outline-none px-2.5 py-1.5 font-['Proxima_Nova'] text-[13px] border border-[#E0EBF0] bg-[#F3F8F9] text-[#2D3E4C] placeholder:text-[#6D96AE] focus:ring-1 focus:ring-[#6D96AE]",
        optionsWrapper: "mt-1 max-h-[280px] overflow-auto scrollbar-sm",
        menuItem:
          "flex items-center gap-2 rounded-[8px] cursor-pointer outline-none px-2.5 py-1.5 font-['Proxima_Nova'] text-[13px] text-[#2D3E4C] hover:bg-[#F3F8F9]",
        smartMenuItem:
          "inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-['Proxima_Nova'] font-[600] cursor-pointer bg-[#F3F8F9] text-[#37576B] hover:bg-[#E0EBF0]",
        selectedValueIcon: "size-4 text-[#EAAD43]",
      },
    ],
  },
  input: {
    options: { activeStyle: 0 },
    styles: [
      { name: "default" },
      {
        // Bare input INSIDE the pillBar pill row — the row is the box.
        name: "pill",
        inputContainer: "w-full flex",
        input:
          "w-full bg-transparent border-0 outline-none focus:outline-none focus:ring-0 p-0 font-['Proxima_Nova'] text-[13px] text-[#2D3E4C] placeholder:text-[#6D96AE]",
      },
    ],
  },
  // filter_control Card cells — the cell wrapper IS the white pill; pair the
  // column with activeStyle:'pill' so the control inside is the bare variant.
  filterControlCell: {
    wrapper:
      "w-full flex items-center gap-1.5 bg-white rounded-full pl-3 pr-2.5 py-1.5 border border-[#C5D7E0] hover:border-[#6D96AE] focus-within:border-[#6D96AE] transition-colors",
    label: "font-['Proxima_Nova'] text-[13px] text-[#37576B] whitespace-nowrap",
    icon: "size-4 text-[#6D96AE] shrink-0",
    // toggles are BARE per the design (checkbox + 12px label, no pill chrome)
    toggleCellWrapper: "w-full flex items-center",
    toggleWrapper: "flex items-center gap-1.5 cursor-pointer",
    toggleLabel: "font-['Proxima_Nova'] text-[12px] text-[#37576B] whitespace-nowrap",
    checkbox: "size-4 rounded border-[#C5D7E0] text-[#2D3E4C] focus:ring-[#E0EBF0]",
  },
  graph: {
    text: "text-[#2D3E4C] font-[Oswald] font-semibold text-[12px] leading-[100%] tracking-[0px] uppercase",
    darkModeText:
      "bg-transparent text-white font-[Oswald] font-semibold text-[12px] leading-[100%] tracking-[0px] uppercase",
    headerWrapper:
      "grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-x-1 gap-y-0.5",
    columnControlWrapper: `px-1 font-semibold border bg-gray-50 text-gray-500`,
    scaleWrapper:
      "flex rounded-[8px] divide-x border w-fit border-[#E0EBF0] overflow-hidden",
    scaleItem:
      "px-[12px] py-[7px] font-[Oswald] font-medium text-[12px] text-[#2D3E4C] text-center leading-[100%] tracking-[0px] uppercase cursor-pointer",
    scaleItemActive: "bg-white",
    scaleItemInActive: "bg-[#F3F8F9]",
  },
  // The AVL Graph (graph_new) section — brand defaults defined at the top of this
  // file. Separate from `graph` above, which themes the legacy graph component.
  avlGraph: mny_avlGraph,
  icon: {
    icon: "text-slate-400 hover:text-blue-500 size-4",
  },
  scrollbar: {
    sm: "[&::-webkit-scrollbar]:h-[6px] [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar]:rounded-[10px] [&::-webkit-scrollbar-thumb]:rounded-[10px]"
    // sm: "[&::-webkit-scrollbar]:h-[6px] [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar]:bg-[#C5D7E0] [&::-webkit-scrollbar]:rounded-[10px] [&::-webkit-scrollbar-thumb]:bg-[#37576B] [&::-webkit-scrollbar-thumb]:rounded-[10px]"
  },
  lexical: {
    // MNY theme uses options/styles pattern with flat keys
    // The default style (0) contains MNY-branded defaults
    // Additional styles available: Inline Guidance, Annotation, etc.
    options: { activeStyle: 0 },
    styles: [
      {
        // Style 0: Default (mny branded)
        name: "default",
        // Lexical horizontal rule. The library default is a 2px #ccc bar
        // (ui/components/lexical/theme.js hr_after) — twice the brand's weight
        // and an off-brand grey, on every <hr> an author inserts anywhere on the
        // site. Brought onto the brand's 1px base rule (design-system →
        // "Rules & dividers"). NOTE the keys are FLAT (`hr_after`), not a nested
        // `hr: {}` — buildLexicalInternalTheme assembles the nested object from
        // them, so a nested override silently no-ops.
        hr_base: "p-px border-none my-4 cursor-pointer relative",
        hr_after: `absolute left-0 right-0 h-px bg-[${MNY_RULE.base}] leading-[1px]`,
        hr_selected: "outline-[2px] outline-solid outline-[#6D96AE] select-none",
        contentEditable: "border-none relative [tab-size:1] outline-0",
        editorScroller: "min-h-[150px] border-0 flex relative outline-0 z-0 resize-y",
        viewScroller: "border-0 flex relative outline-0 z-0 resize-none",
        editorContainer: "relative block rounded-[10px] min-h-[50px]",
        editorShell: "font-['Proxima_Nova'] font-[400] text-[16px] text-[#37576B] leading-[22.4px]",
        card: "p-[12px] shadow-[0px_0px_6px_0px_rgba(0,0,0,0.02),0px_2px_4px_0px_rgba(0,0,0,0.08)]",
        paragraph: "m-0 relative",
        quote: "m-0 mb-2 py-6 font-['Oswald'] text-[30px] leading-[36px] text-[#2D3E4C] border-l-4 border-[#37576B] pl-4",
        link: "text-[#37576B] font-[500] no-underline inline-block hover:underline hover:cursor-pointer",
        heading_h1: "font-[500] text-[#2D3E4C] text-[36px] leading-[140%] tracking-[-.02em] underline-offset-8 underline decoration-4 decoration-[#EAAD43] uppercase font-['Oswald'] pb-[12px]",
        heading_h2: "font-[500] text-[#2D3E4C] text-[24px] leading-[24px] scroll-mt-36 font-['Oswald']",
        heading_h3: "font-[500] text-[#2D3E4C] text-[16px] leading-[16px] scroll-mt-36 font-['Oswald']",
        heading_h4: "font-medium text-[#2D3E4C] scroll-mt-36 font-display",
        heading_h5: "text-[36px] sm:text-[48px] tracking-[-2px] items-center font-medium font-['Oswald'] text-[#2D3E4C] sm:leading-[100%] uppercase",
        heading_h6: "scroll-mt-36 font-display",
        text_bold: "font-[700]",
        text_code: "bg-gray-200 px-1 py-0.5 font-mono text-[94%]",
        text_italic: "italic",
        text_strikethrough: "line-through",
        text_subscript: "align-sub text-[0.8em]",
        text_superscript: "align-super text-[0.8em]",
        text_underline: "underline",
        text_underlineStrikethrough: "underline line-through",
        blockCursor: "block pointer-events-none absolute content-[''] after:absolute after:-top-[2px] after:w-[20px] after:border-t-[1px_solid_black]",
        characterLimit: "inline !bg-[#ffbbbb]",
        layoutContainer: "grid gap-[10px]",
        layoutItem: "px-2 py-4 min-w-0 max-w-full",
        layoutItemEditable: "border border-dashed border-slate-300 rounded-lg",
      },
      {
        // Style 1: Inline Guidance (dashed orange border)
        name: "Inline Guidance",
        contentEditable: "border-3 border-dashed border-[#e7ae48] px-6 py-4 rounded-lg relative [tab-size:1] outline-none",
      },
      {
        // Style 2: Annotation Card
        name: "Annotation",
        contentEditable: "border-none relative [tab-size:1] outline-none",
        editorContainer: "relative block rounded-[12px] min-h-[50px] px-[12px] shadow-[0px_0px_6px_0px_rgba(0,0,0,0.02),0px_2px_4px_0px_rgba(0,0,0,0.08)] overflow-hidden",
        editorViewContainer: "relative block rounded-[12px] px-[12px] shadow-[0px_0px_6px_0px_rgba(0,0,0,0.02),0px_2px_4px_0px_rgba(0,0,0,0.08)] overflow-hidden",
        paragraph: "m-0 relative",
        layoutContainer: "grid",
        layoutItem: "border-b border-slate-300 min-w-0 max-w-full",
        heading_h1: "pt-[8px] font-[500] text-[34px] text-[#2D3E4C] leading-[40px] uppercase font-['Oswald'] pb-[12px]",
        heading_h2: "pt-[8px] font-[500] text-[24px] text-[#2D3E4C] leading-[24px] scroll-mt-36 font-['Oswald']",
        heading_h3: "pt-[8px] font-[500] text-[16px] text-[#2D3E4C] font-['Oswald']",
        heading_h4: "pt-[8px] font-medium scroll-mt-36 text-[#2D3E4C] font-display",
        heading_h5: "scroll-mt-36 font-display",
        heading_h6: "scroll-mt-36 font-display",
      },
      {
        // Style 3: Annotation Image Card
        name: "Annotation Image Card",
        editorShell: "font-['Proxima_Nova'] font-[400] text-[16px] text-[#37576B] leading-[22.4px] pt-[120px]",
        contentEditable: "border-none relative [tab-size:1] outline-none",
        editorContainer: "relative block rounded-[12px] min-h-[50px] p-[12px] shadow-[0px_0px_6px_0px_rgba(0,0,0,0.02),0px_2px_4px_0px_rgba(0,0,0,0.08)]",
        editorViewContainer: "relative block rounded-[12px] p-[12px] shadow-[0px_0px_6px_0px_rgba(0,0,0,0.02),0px_2px_4px_0px_rgba(0,0,0,0.08)]",
        paragraph: "m-0 relative",
        layoutContainer: "grid",
        layoutItem: "border-b border-slate-300 min-w-0 max-w-full",
        heading_h1: "pl-[16px] pt-[8px] font-[500] text-[34px] text-[#2D3E4C] leading-[40px] uppercase font-['Oswald'] pb-[12px]",
        heading_h2: "pl-[16px] pt-[8px] font-[500] text-[24px] text-[#2D3E4C] leading-[24px] scroll-mt-36 font-['Oswald']",
        heading_h3: "pl-[16px] pt-[8px] font-[500] text-[16px] text-[#2D3E4C] font-['Oswald']",
        heading_h4: "pl-[16px] pt-[8px] font-medium scroll-mt-36 text-[#2D3E4C] font-display",
        heading_h5: "pl-[16px] scroll-mt-36 font-display",
        heading_h6: "pl-[16px] scroll-mt-36 font-display",
        inlineImage: "inline-block relative z-10 cursor-default select-none mx-[-12px] mt-[-120px]",
      },
      {
        // Style 6: Dark (white text on dark backgrounds)
        name: "Dark",
        editorShell: "font-['Proxima_Nova'] font-[400] text-[16px] text-white leading-[22.4px]",
        heading_h1: "pt-[8px] font-[500] text-[64px] text-white leading-[40px] uppercase font-['Oswald'] pb-[12px]",
        heading_h2: "pt-[8px] font-[500] text-[24px] text-white leading-[24px] scroll-mt-36 font-['Oswald']",
        heading_h3: "pt-[8px] font-[500] text-[16px] text-white font-['Oswald']",
        heading_h4: "pt-[8px] font-medium scroll-mt-36 text-white font-display",
        heading_h5: "scroll-mt-36 font-display",
        heading_h6: "scroll-mt-36 font-display",
      },
      {
        // Style 4: Handwritten (Caveat font)
        name: "Handwritten_2",
        contentEditable: "border-none relative [tab-size:1] outline-none",
        editorScroller: "min-h-[150px] border-0 flex relative outline-0 z-0 resize-y",
        viewScroller: "border-0 flex relative outline-0 z-0 resize-none",
        editorContainer: "relative block rounded-[10px] min-h-[50px]",
        editorShell: "font-['Caveat'] font-[600] text-[20px] text-[#37576B] leading-[22.4px]",
      },
      {
        // Style 5: Sitemap
        name: "sitemap",
        link: "leading-[22.4px] tracking-normal",
        heading_h1: "pt-[8px] font-[500] text-[64px] text-white leading-[40px] uppercase font-['Oswald'] pb-[12px]",
        heading_h2: "text-[#2D3E4C] no-underline font-[Oswald] font-medium text-[16px] leading-[14px] uppercase tracking-normal",
        heading_h3: "text-[#2D3E4C] font-[Oswald] font-medium text-[14px] leading-[14px] uppercase tracking-normal",
        heading_h4: "pt-[8px] font-medium scroll-mt-36 text-white font-display",
        heading_h5: "scroll-mt-36 font-display",
        heading_h6: "scroll-mt-36 font-display",
      },
    ],
  },
};

//theme.navOptions.logo = <Link to='/' className='h-12 flex px-4 items-center'><div className='rounded-full h-10 bg-blue-500 border border-slate-50' /></Link>

export default {
  ...theme,
  Icons
};
