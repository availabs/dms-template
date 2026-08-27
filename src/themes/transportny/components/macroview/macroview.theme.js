// macroview — Tailwind class map for the plugin's floating panels, ported from the
// converged mockup
//   TransportNY Design System/dms_design_system_v2/pages/npmrds-macro.html
// (Revision 6 of npmrds-category-design-set.md, drawn ON the Map component's own chrome).
//
// TWO theme sources, deliberately:
//
//   1. THE MAP COMPONENT'S OWN KEYS — `damaMap.layerLibrary` in
//      dms/…/ComponentRegistry/map/map.theme.js. The design was drawn FROM these, so the
//      panel shell is CONSUMED, not restated: `panel`, `panelInner`, `header`,
//      `headerTitle`, `headerCount`, `headerCollapseBtn`, `headerCollapseIcon`, `body`,
//      `searchWrapper`, `searchInput`. Nothing in this file duplicates them; a site that
//      re-skins the Map's layer library re-skins these panels with it.
//
//   2. THIS FILE — everything the layer-library panel has no equivalent for: where each
//      panel sits over the canvas, the measure GROUP tint, segmented controls, chips,
//      the value-distribution + legend blocks, the map chrome bar and the download
//      builder. Read through ThemeContext + getComponentTheme(theme, 'macroview'), the
//      RouteComparison.theme.js precedent — the .jsx files carry NO inline Tailwind and
//      no `style` objects.
//
// Colour vocabulary is the Map component's, NOT the brand's: selection is `blue-600`,
// surfaces are `zinc`. The two places brand colour is correct are the download builder's
// dark head (it is a modal, not map chrome) and the measure select's amber hover, both
// as drawn.
export const macroviewTheme = {
  // ── where the panels sit ─────────────────────────────────────────────────────
  // Composed with damaMap.layerLibrary.panel ("p-4 pointer-events-none"), exactly the
  // way map/index.jsx composes `absolute ${position} ${damaMapT.legendWrapper}`.
  posTopLeft: "absolute top-0 left-0",
  posTopRight: "absolute top-0 right-0",
  posBottomLeft: "absolute bottom-0 left-0 p-4",
  // UNUSED since 2026-08-17 and it should stay that way: with the full-width overlay
  // (`fullWidthOverlay` → AvlMap's `floatMapActions`) the map's bottom-right corner is
  // core's nav controls, and their basemap menu opens upward 240×144px over anything
  // parked there. Retained as the record of where the mockup put the download pill.
  posBottomRight: "absolute bottom-0 right-0 p-4",

  // ── controls panel · always-on context block ─────────────────────────────────
  ctxBlock: "p-2.5 space-y-2.5 border-b border-zinc-950/5",
  label: "text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1",

  // geography chip field
  chipField:
    "min-h-8 px-2 py-1 flex flex-wrap items-center gap-1 rounded-md border border-zinc-950/10 bg-zinc-50 cursor-pointer",
  chip: "h-5 pl-1.5 pr-1 inline-flex items-center gap-1 rounded bg-blue-600 text-white text-[10px] font-medium",
  chipRemove: "inline-flex items-center cursor-pointer",
  chipRemoveIcon: "size-2.5",
  chipPlaceholder: "text-[12px] text-zinc-400",

  // a dropdown-shaped button (Year, Threshold, AADT source, …)
  selectBtn:
    "w-full h-8 px-2.5 inline-flex items-center justify-between rounded-md border border-zinc-950/10 bg-white text-[13px] text-zinc-700 hover:border-zinc-950/20 cursor-pointer",
  selectValue: "truncate",
  selectValueNum: "tabular-nums font-medium",
  selectCaret: "size-3.5 text-zinc-400 shrink-0",

  // two/three-way segmented control (View mode, Sum by, Unit, Fuel type, Format)
  segment2: "h-8 grid grid-cols-2 rounded-md border border-zinc-950/10 overflow-hidden",
  segment3: "h-8 grid grid-cols-3 rounded-md border border-zinc-950/10 overflow-hidden",
  segmentBtnFirst: "bg-white text-zinc-600 text-[12px] hover:bg-zinc-50 cursor-pointer",
  segmentBtn:
    "bg-white text-zinc-600 text-[12px] border-l border-zinc-950/10 hover:bg-zinc-50 cursor-pointer",
  segmentBtnActive: "bg-blue-600 text-white text-[12px] font-medium cursor-pointer",
  segmentBtnActiveFirst: "bg-blue-600 text-white text-[12px] font-medium cursor-pointer",
  // "Compare years" ships DISABLED this pass — the mode does not exist yet, and a live
  // segment that does nothing is worse than a visibly-planned one (Alex, 2026-08-12).
  segmentBtnPlanned:
    "bg-white text-zinc-300 text-[12px] border-l border-zinc-950/10 cursor-not-allowed",

  // ── the MEASURE GROUP ────────────────────────────────────────────────────────
  // One tinted block holds the measure select AND its dependent controls, so they read
  // as ONE thing. GREY, not amber (amber read as too loud inside a dense panel and
  // competed with blue-600 selection). Last block in the panel, so `border-t` only —
  // a bottom border would double the panel's own edge.
  groupBlock: "p-2.5 bg-zinc-100 border-t border-zinc-950/15",
  groupLabel: "text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-1",
  measureBtn:
    "w-full h-8 px-2.5 inline-flex items-center justify-between rounded-md border border-zinc-950/20 bg-white text-[13px] font-medium text-zinc-800 hover:border-[#CA8A04]/60 cursor-pointer",
  measureBtnLabel: "truncate",
  measureBtnCaret: "size-3.5 text-zinc-400 shrink-0",

  // the dependent-control sub-block, inside the same tint
  groupDivider: "mt-2.5 pt-2.5 border-t border-zinc-950/10",
  groupHead: "flex items-center gap-2 mb-1.5",
  groupHeadLabel: "text-[10px] font-semibold uppercase tracking-wider text-zinc-600",
  groupHeadRule: "h-px flex-1 bg-zinc-950/10",
  groupHeadCount: "text-[9.5px] uppercase tracking-wider text-zinc-400",
  subControls: "space-y-2",
  grid2: "grid grid-cols-2 gap-2",
  groupNote: "text-[11px] leading-[1.45] text-zinc-500 mt-2",

  // chip-style option row (Peak period, Traffic type)
  pillRow: "flex flex-wrap gap-1",
  pill: "h-6 px-2 rounded border border-zinc-950/10 bg-white text-zinc-600 text-[11px] hover:bg-zinc-50 cursor-pointer",
  pillActive: "h-6 px-2 rounded bg-blue-600 text-white text-[11px] font-medium cursor-pointer",

  // ── the measure MENU (§ 04 "measure menu open") ──────────────────────────────
  menu: "mt-1 rounded-md border border-zinc-950/10 bg-white shadow-md overflow-hidden",
  menuGroupLabel:
    "px-2.5 pt-2 pb-1 text-[9.5px] font-semibold uppercase tracking-wider text-zinc-400",
  menuRow:
    "w-full px-2.5 py-1.5 flex items-center gap-2 text-left hover:bg-zinc-50 cursor-pointer",
  menuRowActive: "w-full px-2.5 py-1.5 flex items-center gap-2 text-left bg-blue-50 cursor-pointer",
  menuRowLabel: "text-[12.5px] text-zinc-700 flex-1",
  menuRowLabelActive: "text-[12.5px] font-medium text-zinc-900 flex-1",
  menuRowUnit: "text-[9.5px] uppercase tracking-wider text-zinc-400",
  menuRowCheck: "size-3.5 text-blue-600",

  // ── the GEOGRAPHY list · grouped by family (2026-08-17) ──────────────────────
  // The list used to be flat and sliced to 60 rows over a counties-first array, so on a
  // 62-county state the MPO / urban-area / region families were unreachable until you
  // typed (Alex). It is now grouped under sticky family headers with NO cap: every
  // family is visible by scrolling, smallest first. Taller than `searchResults`
  // (max-h-44) because it now holds ~120 rows across four groups, and the panel body
  // (damaMap.layerLibrary.body) scrolls behind it.
  geoResults: "max-h-64 overflow-y-auto border-b border-zinc-950/5",
  geoGroupLabel:
    "sticky top-0 z-10 px-2.5 py-1 flex items-center justify-between bg-zinc-50 border-y border-zinc-950/5 text-[9.5px] font-semibold uppercase tracking-wider text-zinc-500",
  geoGroupCount: "text-[9.5px] tabular-nums text-zinc-400",

  // ── measure-context panel ────────────────────────────────────────────────────
  headIcon: "size-4 text-zinc-400 shrink-0",
  headBtn:
    "h-6 px-2 inline-flex items-center gap-1 rounded border border-zinc-950/10 bg-white text-[10px] uppercase tracking-wider text-zinc-600 hover:border-zinc-950/20 cursor-pointer",
  headBtnIcon: "size-3",

  block: "p-3 border-b border-zinc-950/5",
  blockLast: "p-3",
  blockHead: "flex items-center justify-between mb-1.5",
  blockHeadLabel: "text-[10px] font-semibold uppercase tracking-wider text-zinc-500",
  blockHeadMeta: "text-[9.5px] uppercase tracking-wider text-zinc-400 tabular-nums",
  blockHeadNote: "text-[9.5px] uppercase tracking-wider text-zinc-400",

  defTitle: "text-[13px] font-medium text-zinc-800",
  defBody: "text-[12px] leading-[1.5] text-zinc-600 mt-1",
  factGrid: "mt-2 grid grid-cols-2 gap-2",
  // a measure with no reliability threshold gets ONE full-width fact instead of an
  // empty second tile.
  factGridSolo: "mt-2 grid grid-cols-1 gap-2",
  fact: "rounded bg-zinc-50 px-2 py-1.5",
  factLabel: "text-[9.5px] uppercase tracking-wider text-zinc-400",
  factValue: "text-[12px] font-medium text-zinc-700",
  factValueNum: "text-[12px] font-medium tabular-nums text-zinc-700",
  equation: "mt-2 text-[11px] font-mono text-zinc-600 bg-zinc-50 rounded px-2 py-1.5",

  // ── the shared scale: horizontal legend ON TOP OF the value distribution ──────
  // Alex, 2026-08-17: "move the legend up above the value distribution, horizontal,
  // drop the per-bin counts, and have the distribution use the same breaks as the
  // legend". The legend strip, its tick row and the histogram are the SAME 7 ckmeans
  // bins, so they are three rows of ONE scale block with no padding of their own —
  // that is what makes bin edge i land at exactly i/n of the same width in all three.
  scale: "",
  legendStrip: "flex h-2 rounded-sm overflow-hidden",
  // flex-1 (not a width) so n segments always divide the block's width exactly evenly,
  // matching the histogram's n equal-width bars. The bin's range is the segment's
  // `title` — at ~40px per segment there is no room to letter it, and the tick row
  // below carries the break values instead of the counts the vertical legend used to.
  legendSeg: "block flex-1 h-full",
  legendTicks: "flex mt-1",
  legendTick:
    "flex-1 min-w-0 flex items-baseline justify-end overflow-hidden text-[9.5px] tabular-nums text-zinc-400",
  // the first cell also carries the domain minimum, at the left edge of the ramp
  legendTickFirst:
    "flex-1 min-w-0 flex items-baseline justify-between gap-1 overflow-hidden text-[9.5px] tabular-nums text-zinc-400",

  // value distribution — the same bins, now directly under their legend segment
  distHead: "flex items-center justify-between mt-2.5 mb-1",
  histo: "w-full h-[64px] block",
  histoNote: "mt-0.5 text-[9.5px] uppercase tracking-wider text-zinc-400 tabular-nums",
  // the no-data line under the distribution (2026-08-18). PHED/TED are computed on
  // urbanized-area segments only, so ~59 % of the 2025 network has no value and is painted
  // grey; the bars count values, and this states what is not in them. Same scale as
  // histoNote, one step darker because it is a caveat about the data rather than a note
  // about the chart's furniture.
  noDataNote: "mt-0.5 text-[9.5px] uppercase tracking-wider text-zinc-500 tabular-nums",
  // retained (unused since the 2026-08-17 horizontal-legend pass) so a site override
  // keyed to the pre-pass names still resolves instead of throwing away a class string.
  histoBar: "",
  histoThreshold: "",
  histoAxis:
    "flex items-center justify-between text-[9.5px] uppercase tracking-wider text-zinc-400 tabular-nums",
  histoAxisMid: "text-zinc-600",
  statGrid: "mt-2 grid grid-cols-3 gap-2",
  statLabel: "text-[9.5px] uppercase tracking-wider text-zinc-400",
  statValue: "text-[12px] font-medium tabular-nums text-zinc-700",
  statValueAlert: "text-[12px] font-medium tabular-nums text-[#d73027]",

  // legend · the pre-2026-08-17 VERTICAL rows (swatch · range · count). Retained for
  // the same override reason as histoAxis above; the panel renders `legendStrip` now.
  legendList: "space-y-1",
  legendRow: "flex items-center gap-2",
  legendSwatch: "block w-6 h-2 rounded-sm shrink-0",
  legendLabel: "text-[11px] tabular-nums text-zinc-600 flex-1",
  legendCount: "text-[10px] tabular-nums text-zinc-400",

  // an honest empty/pending state inside any block
  pending: "text-[11px] leading-[1.45] text-zinc-500",

  // ── inspect · "Get to a segment" ─────────────────────────────────────────────
  inspectHead: "px-3 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500",
  searchField: "relative flex items-center",
  searchIcon: "size-4 text-zinc-400 shrink-0 absolute left-2.5 pointer-events-none",
  // composed with damaMap.layerLibrary.searchInput — this only makes room for the icon
  searchInputIndent: "pl-8",
  searchResults: "max-h-44 overflow-y-auto divide-y divide-zinc-950/5 border-b border-zinc-950/5",
  searchResult: "w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-zinc-50 cursor-pointer",
  searchResultName: "text-[12px] text-zinc-700 flex-1 truncate",
  searchResultMeta: "text-[10px] tabular-nums text-zinc-400 shrink-0",
  searchEmpty: "px-3 py-2 text-[11px] text-zinc-400",

  selectedRow:
    "px-3 py-1.5 flex items-center gap-2 bg-blue-500/[0.07] border-b border-zinc-950/5",
  selectedLabel: "text-[11.5px] font-medium text-zinc-800 flex-1 truncate",
  selectedValue: "text-[11px] font-medium tabular-nums text-zinc-600",
  selectedClear: "size-4 inline-flex items-center justify-center text-zinc-400 hover:text-zinc-700 cursor-pointer",

  inspectRows: "divide-y divide-zinc-950/5",
  inspectRow: "w-full px-3 py-2.5 flex items-center gap-2 hover:bg-zinc-50 cursor-pointer",
  inspectRowIcon: "size-4 text-zinc-400 shrink-0",
  inspectRowLabel: "text-[12px] text-zinc-700 flex-1 text-left",
  inspectRowMeta: "text-[9.5px] uppercase tracking-wider text-zinc-400 shrink-0",
  // UNUSED since 2026-08-17: these two styled the non-interactive "TRANSCOM events on
  // these segments · not connected" row, which Alex had removed. Retained rather than
  // deleted (this file's convention — see posBottomRight above — is that keys are
  // additive, and a site may already override them); they are the treatment to reuse if
  // a real TRANSCOM join ever puts a static count row back (ticket 2211484).
  inspectRowIdle: "w-full px-3 py-2.5 flex items-center gap-2 cursor-default",
  inspectRowMetaNum: "text-[9.5px] uppercase tracking-wider text-zinc-400 tabular-nums shrink-0",
  inspectList: "border-t border-zinc-950/5 divide-y divide-zinc-950/5 max-h-56 overflow-y-auto",
  inspectListRow: "w-full px-3 py-1.5 flex items-center gap-2 text-left hover:bg-zinc-50 cursor-pointer",
  inspectListRank: "w-5 text-[10px] tabular-nums text-zinc-400 shrink-0",
  inspectListName: "text-[11.5px] text-zinc-700 flex-1 truncate",
  inspectListValue: "text-[11px] font-medium tabular-nums text-zinc-700 shrink-0",

  // ── map chrome bar (bottom-left) ─────────────────────────────────────────────
  chromeBar: "flex items-center gap-2",
  chromeGroup:
    "h-9 rounded-lg border border-zinc-950/10 bg-white/95 shadow-sm flex items-center overflow-hidden pointer-events-auto",
  chromeBtnFirst: "h-full px-3 text-[12px] text-zinc-600 hover:bg-zinc-50 cursor-pointer",
  chromeBtn:
    "h-full px-3 text-[12px] text-zinc-600 border-l border-zinc-950/10 hover:bg-zinc-50 cursor-pointer",
  chromeBtnActive: "h-full px-3 text-[12px] font-medium text-white bg-blue-600 cursor-pointer",
  chromeIconBtn:
    "size-9 rounded-lg border border-zinc-950/10 bg-white/95 shadow-sm flex items-center justify-center text-zinc-600 hover:text-zinc-900 pointer-events-auto cursor-pointer",
  chromeIcon: "size-4",
  freshness:
    "h-9 px-3 rounded-lg border border-zinc-950/10 bg-white/95 shadow-sm flex items-center gap-2 text-[11px] text-zinc-500 pointer-events-auto",
  freshnessLive: "inline-flex items-center gap-1.5 text-emerald-700",
  freshnessDot: "size-1.5 rounded-full bg-emerald-500",
  freshnessSep: "text-zinc-300",
  freshnessNum: "tabular-nums text-zinc-700",

  // ── download dock pill (bottom-right) ────────────────────────────────────────
  dockPill:
    "h-9 px-3 rounded-lg border border-zinc-950/10 bg-white/95 shadow-sm flex items-center gap-2 text-[12px] font-medium text-zinc-700 hover:border-zinc-950/20 pointer-events-auto cursor-pointer",
  dockPillIcon: "size-4 text-zinc-500",
  // Same box as dockPillIcon so swapping the glyph cannot reflow the pill mid-request. `animate-spin`
  // follows the precedent in ui/components/map/avl-map.jsx.
  dockPillSpinner: "size-4 text-zinc-500 animate-spin",
  dockPillBusy: "text-zinc-500",
  dockPillCount: "tabular-nums text-zinc-500",

  // ── download builder ─────────────────────────────────────────────────────────
  builderBackdrop: "absolute inset-0 z-40 bg-zinc-950/20 pointer-events-auto",
  builderWrapper: "absolute inset-0 z-50 flex items-center justify-center p-8 pointer-events-none",
  builder:
    "w-full max-w-[760px] max-h-full flex flex-col rounded-[8px] border border-zinc-950/10 bg-white shadow-lg overflow-hidden pointer-events-auto",
  builderHead: "h-10 px-3 flex items-center gap-2 border-b border-zinc-950/10 bg-[#12181F] shrink-0",
  builderHeadIcon: "size-4 text-[#FACC15]",
  builderTitle: "font-display uppercase text-white text-[12.5px] tracking-wide flex-1",
  builderClose:
    "size-6 inline-flex items-center justify-center rounded text-slate-300 hover:bg-white/10 cursor-pointer",
  builderCloseIcon: "size-4",
  builderBody: "p-4 grid grid-cols-12 gap-4 overflow-y-auto",
  builderCol6: "col-span-12 md:col-span-6",
  builderCol6Stack: "col-span-12 md:col-span-6 space-y-2.5",
  builderCol12: "col-span-12",
  builderLabel: "font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500 mb-1",

  scopeList: "space-y-1",
  scopeOpt: "flex items-center gap-2 px-2 py-1.5 rounded-[4px] border border-zinc-950/10 bg-white cursor-pointer",
  scopeOptActive:
    "flex items-center gap-2 px-2 py-1.5 rounded-[4px] border border-[#37576B] bg-[#37576B]/8 cursor-pointer",
  scopeRadio: "size-3.5 rounded-full border-2 border-slate-300 shrink-0",
  scopeRadioActive:
    "size-3.5 rounded-full border-2 border-[#37576B] flex items-center justify-center shrink-0",
  scopeRadioDot: "size-1.5 rounded-full bg-[#37576B]",
  scopeLabel: "font-proxima text-[12.5px] text-slate-700 flex-1",
  scopeLabelActive: "font-proxima text-[12.5px] text-[#0f1722] flex-1",
  scopeCount: "font-mono text-[10px] tabular-nums text-slate-400",
  scopeCountActive: "font-mono text-[10px] tabular-nums text-slate-500",
  scopeNote: "mt-2 font-proxima text-[11.5px] leading-[1.45] text-slate-500 capitalize",

  // TWO columns, not three: the disabled `json` button was removed on 2026-08-24 (ogr2ogr has no
  // plain-JSON driver and pm3 will not be growing one), and a 3-column grid holding two buttons
  // leaves a third of the segmented control as empty bordered white space.
  formatSeg: "h-8 grid grid-cols-2 rounded-[6px] border border-zinc-950/10 overflow-hidden",
  formatBtnFirst: "bg-white text-slate-600 font-mono text-[10px] uppercase tracking-wider cursor-pointer",
  formatBtn:
    "bg-white text-slate-600 font-mono text-[10px] uppercase tracking-wider border-l border-zinc-950/10 cursor-pointer",
  formatBtnActive: "bg-[#37576B] text-white font-mono text-[10px] uppercase tracking-wider cursor-pointer",

  includeBtn:
    "w-full h-8 px-2 inline-flex items-center justify-between rounded-[6px] border border-zinc-950/10 bg-white hover:border-[#37576B] cursor-pointer",
  includeLabel: "font-proxima text-[12px] text-[#0f1722]",
  includeCaret: "size-3 text-slate-500",

  colChips: "flex flex-wrap gap-1",
  colChip: "h-5 px-1.5 inline-flex items-center rounded bg-slate-100 font-mono text-[10px] text-slate-600 cursor-pointer",
  colChipMeasure:
    "h-5 px-1.5 inline-flex items-center rounded bg-[#37576B]/12 font-mono text-[10px] text-[#1f3450] font-medium cursor-pointer",
  colPicker: "mt-2 grid grid-cols-2 gap-2",

  builderFoot: "col-span-12 flex items-center gap-3 flex-wrap",
  builderSubmit:
    "h-9 px-4 inline-flex items-center justify-center gap-2 rounded-[6px] bg-[#1F3F8F] text-white border-b-4 border-[#16306e] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
  builderSubmitLabel: "font-display uppercase text-[12.5px] tracking-wide",
  builderNote: "font-proxima text-[11.5px] leading-[1.45] text-slate-500 flex-1 min-w-[220px]",
};
