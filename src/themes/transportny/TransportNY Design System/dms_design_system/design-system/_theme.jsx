/* eslint-disable */
/* TransportNY · theme shim for HTML mockup pages
 *
 * Mirrors theme/theme.js as window.TNYTheme so the design-system and pages/
 * HTML mockups can read the same class strings without a bundler.
 *
 * KEEP IN SYNC WITH theme/theme.js. Canonical source is theme.js; this is a
 * UMD-style mirror. The two files have identical key-shape; if you change
 * a value in theme.js, mirror it here.
 *
 * Loaded via <script type="text/babel" src="_theme.jsx"></script>.
 * After this runs, mockups read TNYTheme.dataCard.styles[0].header, etc. */

window.TNYTheme = {
  textSettings: { options: { activeStyle: 0 }, styles: [{
    name: "default",
    h1: "font-display font-semibold text-[52px] leading-[1.02] tracking-tight text-[#0F1722]",
    h2: "font-display font-semibold text-[38px] leading-[1.05] tracking-tight uppercase text-[#0F1722]",
    h3: "font-display font-semibold text-[28px] leading-[1.1] text-[#0F1722]",
    h4: "font-display font-medium text-[20px] leading-[1.2] text-[#0F1722]",
    h5: "font-display font-medium text-[16px] leading-[1.3] uppercase tracking-wide text-[#0F1722]",
    h6: "font-display font-medium text-[14px] leading-[1.4] uppercase tracking-[0.16em] text-slate-700",
    textXS: "text-[11px] font-medium",
    textSM: "text-[12.5px] font-medium",
    textSMReg: "text-[12.5px] font-normal",
    textBase: "text-[14.5px] font-normal leading-[1.6]",
    textMD: "text-[15px] font-medium",
    textLG: "text-[18px] font-medium",
    textXL: "text-[20px] font-medium font-display",
    text2XL: "text-[24px] font-semibold font-display",
    text3XL: "text-[28px] font-semibold font-display",
    text4XL: "text-[34px] font-semibold font-display tracking-tight",
    text5XL: "text-[40px] font-semibold font-display tracking-tight",
    text6XL: "text-[52px] font-semibold font-display tracking-tight",
    numSM:  "font-mono text-[12.5px] tabular-nums",
    numMD:  "font-mono text-[18px] font-medium tabular-nums",
    numLG:  "font-mono text-[22px] font-medium tabular-nums",
    numXL:  "font-mono text-[28px] font-medium tabular-nums",
    num2XL: "font-mono text-[40px] font-medium tabular-nums",
    body:      "font-proxima text-[14.5px] font-normal leading-[1.65] text-slate-700",
    bodySmall: "font-proxima text-[12.5px] font-normal leading-[1.55] text-slate-600",
    caption:   "font-proxima text-[12px] font-normal text-slate-500",
    label:     "font-proxima text-[13px] font-medium text-slate-700",
    kicker:    "font-mono text-[10.5px] uppercase tracking-[0.2em] text-[#CA8A04]",
    nav:       "font-display font-medium text-[13.5px] uppercase tracking-wide",
  }]},

  layout: {
    options: { activeStyle: 1 },
    styles: [
      { name: "default", outerWrapper: "bg-white",         wrapper: "relative isolate flex min-h-svh w-full max-lg:flex-col", wrapper2: "flex-1 flex flex-col items-stretch max-w-full min-h-screen", wrapper3: "flex flex-1 items-start", childWrapper: "flex-1 flex flex-col h-full" },
      { name: "app",     outerWrapper: "bg-[#ECEEF2]",      wrapper: "relative isolate flex min-h-svh w-full max-lg:flex-col", wrapper2: "flex-1 flex flex-col items-stretch max-w-full min-h-screen lg:ml-60", wrapper3: "flex flex-1 items-start", childWrapper: "flex-1 flex flex-col h-full bg-[#ECEEF2]" },
      { name: "bare",    outerWrapper: "bg-[#ECEEF2]",      wrapper: "relative isolate flex min-h-svh w-full place-content-center", wrapper2: "flex-1 flex flex-col items-center justify-center max-w-full min-h-screen", wrapper3: "flex flex-1 items-center justify-center w-full", childWrapper: "flex-1 flex flex-col items-center justify-center w-full h-full" },
    ],
  },

  layoutGroup: { options: { activeStyle: 0 }, styles: [
    { name: "content",       wrapper1: "w-full bg-[#ECEEF2] py-12",                                  wrapper2: "mx-auto w-full max-w-[1480px] px-8 flex flex-col gap-6",                                            wrapper3: "" },
    { name: "content_tint",  wrapper1: "w-full bg-[#E4E8EE] py-12",                                  wrapper2: "mx-auto w-full max-w-[1480px] px-8 flex flex-col gap-6",                                            wrapper3: "" },
    { name: "header",        wrapper1: "w-full bg-white border-b border-zinc-950/10",                wrapper2: "mx-auto w-full max-w-[1480px] px-8 py-10 flex flex-col gap-4",                                     wrapper3: "" },
    { name: "hero",          wrapper1: "w-full tny-hero-topo border-b border-zinc-950/10",           wrapper2: "mx-auto w-full max-w-[1480px] px-8 py-14 flex flex-col gap-5",                                     wrapper3: "" },
    { name: "tone_bar",      wrapper1: "w-full bg-[#1F3F8F] text-white border-b border-black/10",    wrapper2: "mx-auto w-full max-w-[1480px] px-8 h-12 flex items-center gap-8",                                   wrapper3: "" },
    { name: "auth",          wrapper1: "w-full flex-1 flex flex-row p-6 bg-[#ECEEF2]",               wrapper2: "mx-auto w-full max-w-md flex flex-col rounded-[8px] border border-zinc-950/10 bg-white shadow-sm p-8 place-content-center", wrapper3: "" },
    { name: "footer",        wrapper1: "w-full bg-white border-t border-zinc-950/10",                wrapper2: "mx-auto w-full max-w-[1480px] px-8 py-4 flex items-center justify-between",                         wrapper3: "" },
    { name: "workbench",     wrapper1: "w-full bg-[#ECEEF2] py-6",                                   wrapper2: "w-full px-0 flex flex-col gap-6",                                                                    wrapper3: "" },
  ]},

  button: { options: { activeStyle: 0 }, styles: [
    { name: "default",   button: "tny-press cursor-pointer inline-flex items-center gap-2 px-4 h-10 bg-[#1F3F8F] hover:bg-[#16307A] border-b-4 border-[#0F2D4D] text-white font-display uppercase text-[13px] tracking-wide rounded-[6px] transition-colors" },
    { name: "plain",     button: "cursor-pointer inline-flex items-center gap-2 px-3 h-9 text-slate-700 hover:text-[#0F1722] hover:bg-slate-100 font-proxima text-[13px] rounded-[6px]" },
    { name: "active",    button: "tny-press cursor-pointer inline-flex items-center gap-2 px-4 h-10 bg-[#16307A] border-b-4 border-[#0A1C4D] text-white font-display uppercase text-[13px] tracking-wide rounded-[6px]" },
    { name: "secondary", button: "cursor-pointer inline-flex items-center gap-2 px-4 h-10 bg-white hover:bg-slate-50 border border-zinc-950/15 text-slate-800 font-proxima text-[13px] font-medium rounded-[6px]" },
    { name: "ghost",     button: "cursor-pointer inline-flex items-center gap-2 px-3 h-9 hover:bg-slate-100 text-slate-600 font-proxima text-[13px] rounded-[6px]" },
    { name: "danger",    button: "tny-press cursor-pointer inline-flex items-center gap-2 px-4 h-10 bg-[#EF4444] hover:bg-[#DC2626] border-b-4 border-[#991B1B] text-white font-display uppercase text-[13px] tracking-wide rounded-[6px]" },
    { name: "compact",   button: "cursor-pointer inline-flex items-center gap-1.5 px-2.5 h-8 bg-white border border-zinc-950/10 hover:border-[#37576B] text-slate-700 font-proxima text-[12px] rounded-[6px]" },
  ]},

  input: {
    input: "relative w-full block appearance-none rounded-[6px] px-3 h-11 text-[14px] text-[#0F1722] placeholder:text-slate-400 border border-zinc-950/15 hover:border-zinc-950/30 bg-white focus:outline-none focus:border-[#1F3F8F] focus:ring-2 focus:ring-[#1F3F8F]/15",
    inputContainer: "group flex relative w-full",
    textarea: "relative block h-full w-full appearance-none rounded-[6px] px-3 py-2 text-[14px] text-[#0F1722] placeholder:text-slate-400 border border-zinc-950/15 hover:border-zinc-950/30 bg-white focus:outline-none focus:border-[#1F3F8F] resize-y",
  },

  multiselect: { options: { activeStyle: 0 }, styles: [
    { name: "default", inputWrapper: "flex w-full items-center gap-1.5 min-h-11 px-3 rounded-[6px] border border-zinc-950/15 hover:border-zinc-950/30 bg-white cursor-pointer", caretIcon: "CaretDown", caretWrapper: "ml-auto pl-1 text-slate-500", singleValue: "text-[14px] text-[#0F1722]" },
    { name: "compact", inputWrapper: "flex items-center gap-1.5 h-8 px-2.5 rounded-[6px] border border-zinc-950/10 hover:border-[#37576B] bg-white text-[12px] cursor-pointer", caretWrapper: "ml-1 text-slate-500", singleValue: "text-[12px] text-slate-700 font-medium" },
    { name: "tone_bar", inputWrapper: "flex items-center gap-1.5 px-2 -mx-2 py-1 rounded text-white hover:bg-white/10 cursor-pointer", singleValue: "font-semibold text-[13px] text-white", caretWrapper: "ml-1 text-white/70" },
  ]},

  tabs: { options: { activeStyle: 0 }, styles: [
    { name: "default",   tabList: "flex items-center border-b border-zinc-950/10", tab: "px-3 h-10 font-display uppercase text-[12.5px] tracking-wide text-slate-500 hover:text-[#0F1722] cursor-pointer border-b-2 border-transparent", tabActive: "px-3 h-10 font-display uppercase text-[12.5px] tracking-wide text-[#0F1722] border-b-2 border-[#FACC15] cursor-pointer" },
    { name: "segmented", tabList: "inline-flex items-center gap-0 rounded-[6px] bg-[#0A0E13] p-0.5",                tab: "px-3 h-7 inline-flex items-center gap-1.5 font-proxima text-[12px] text-slate-400 hover:text-slate-200 cursor-pointer rounded-[4px]",                                    tabActive: "px-3 h-7 inline-flex items-center gap-1.5 font-proxima text-[12px] text-white bg-[#1e2530] cursor-pointer rounded-[4px]" },
  ]},

  dataCard: { options: { activeStyle: 0 }, styles: [
    { name: "default",   wrapper: "rounded-[8px] border border-zinc-950/10 bg-white shadow-sm overflow-hidden", header: "font-display uppercase text-[12.5px] tracking-[0.04em] text-slate-500 px-3 pt-3 pb-1", value: "px-3 pb-3 text-[14px] text-[#0F1722]" },
    { name: "kpi",       wrapper: "rounded-[8px] border border-zinc-950/10 bg-white shadow-sm p-4 flex flex-col gap-1", header: "font-display uppercase text-[12.5px] tracking-[0.04em] text-slate-500", value: "font-mono text-[28px] font-medium tabular-nums text-[#0F1722]", description: "font-proxima text-[12px] text-slate-500" },
    { name: "editorial", wrapper: "rounded-[8px] border-2 border-dashed border-amber-300 bg-[#F5F1E8] p-6", header: "font-display uppercase font-bold text-[14px] tracking-wide text-[#0F1722] border-b-2 border-[#EAAD43] inline-block pb-0.5", value: "text-[13px] text-slate-700 mt-3 leading-[1.65]" },
    { name: "title_bar", wrapper: "rounded-[8px] border border-zinc-950/10 bg-white shadow-sm overflow-hidden", header: "h-11 px-3 flex items-center gap-2 border-b border-zinc-950/10 bg-slate-50/60 font-display font-medium text-[14px] text-[#2D3E4C]", value: "p-4 text-[14px] text-[#0F1722]" },
  ]},

  pill: { options: { activeStyle: 0 }, styles: [
    { name: "default",       wrapper: "inline-flex items-center gap-1.5 px-2 h-6 rounded-[4px] text-[11.5px] font-medium border" },
    { name: "blue",          wrapper: "inline-flex items-center gap-1.5 px-2 h-6 rounded-[4px] text-[11.5px] font-medium border border-[#1F3F8F]/20 bg-[#1F3F8F]/10 text-[#0F2D4D]" },
    { name: "slate",         wrapper: "inline-flex items-center gap-1.5 px-2 h-6 rounded-[4px] text-[11.5px] font-medium border border-[#37576B]/20 bg-[#37576B]/10 text-[#0F2D4D]" },
    { name: "amber",         wrapper: "inline-flex items-center gap-1.5 px-2 h-6 rounded-[4px] text-[11.5px] font-medium border border-[#EAAD43]/30 bg-[#EAAD43]/15 text-[#7C5A12]" },
    { name: "green",         wrapper: "inline-flex items-center gap-1.5 px-2 h-6 rounded-[4px] text-[11.5px] font-medium border border-[#10B981]/30 bg-[#10B981]/10 text-[#065F46]" },
    { name: "red",            wrapper: "inline-flex items-center gap-1.5 px-2 h-6 rounded-[4px] text-[11.5px] font-medium border border-[#EF4444]/30 bg-[#EF4444]/10 text-[#991B1B]" },
    { name: "zinc",          wrapper: "inline-flex items-center gap-1.5 px-2 h-6 rounded-[4px] text-[11.5px] font-medium border border-zinc-950/10 bg-slate-100 text-slate-700" },
  ]},

  sidenav: { options: { activeStyle: 0 }, styles: [{
    name: "default",
    layoutContainer2: "fixed inset-y-0 left-0 w-60 z-30",
    logoWrapper:      "relative h-16 bg-[#0A0E13] border-b border-[#2a3545] flex items-center px-3",
    sidenavWrapper:   "flex flex-col w-60 h-full bg-[#12181F] border-r border-[#2a3545]",
    navitemSide:      "font-proxima text-[13.5px] group flex items-center px-4 py-2.5 hover:bg-[#1e2530] text-slate-300 border-l-[3px] border-transparent cursor-pointer",
    navitemSideActive:"font-proxima text-[13.5px] group flex items-center px-4 py-2.5 bg-[#1e2530] text-white border-l-[3px] border-[#FACC15] cursor-pointer",
    menuIconSide:     "size-[18px] mr-3 text-slate-400 group-hover:text-slate-300 flex-shrink-0",
    menuIconSideActive:"size-[18px] mr-3 text-[#FACC15] flex-shrink-0",
    sectionHeading:   "px-4 py-2 text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-[0.2em]",
    userBlock:        "flex items-center gap-3 px-4 py-2 border-t border-[#2a3545]",
    userAvatar:       "w-8 h-8 rounded-full bg-gradient-to-br from-[#37576B] to-[#1f3450] flex items-center justify-center text-white text-[11px] font-medium ring-1 ring-[#FACC15]/20",
  }]},

  table: { options: { activeStyle: 0 }, styles: [{
    name: "default",
    wrapper: "rounded-[8px] border border-zinc-950/10 bg-white shadow-sm overflow-hidden",
    table:   "w-full text-[13px] text-slate-700",
    thead:   "bg-slate-50/80 border-b border-zinc-950/10",
    th:      "px-3 py-2 text-left font-display uppercase text-[11px] tracking-wide text-slate-600",
    tr:      "border-b border-zinc-950/05 hover:bg-[#FFFBEB]",
    td:      "px-3 py-2 text-[13px] text-slate-700",
  }]},

  graph: {
    catPalette:        ["#6F6F6F", "#E5A646", "#94C24E", "#E160A4", "#F2CB3D"],
    seqSpeedPalette:   ["#D6453B", "#E8843F", "#F2E18A", "#A8D26B", "#3FA34D"],
    primary:           "#1F3F8F",
    primaryArea:       "rgba(31,63,143,0.15)",
  },
};
