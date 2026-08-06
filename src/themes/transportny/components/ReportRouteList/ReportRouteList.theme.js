// Visual spec taken directly from the authoritative design file
// (`TransportNY Design System/dms_design_system_v2/pages/npmrds-report.js`'s own `var C = {...}`
// class dictionary and `npmrds-report.html`'s rail markup) — matched to those exact class
// strings/hex values, not approximated. Ryan, 2026-08-06: "the styling should match without
// question." Kept as literal Tailwind classes (not CSS variables) — same convention the rest of
// themev2.js already uses throughout.
export const reportRouteListTheme = {
  wrapper: 'flex flex-col h-full',

  // ── Panel head · pinned. "Routes" + count + collapse toggle, dark navy. ──
  panelHead: 'h-12 px-3 flex items-center gap-2 bg-[#12181F] shrink-0',
  panelHeadIcon: 'size-4 text-[#FACC15] shrink-0',
  title: 'font-display uppercase text-white text-[12.5px] tracking-wide flex-1',
  routeCount: 'px-1.5 h-5 inline-flex items-center rounded-full bg-white/10 text-white font-mono text-[10px] tabular-nums',
  panelCollapseBtn: 'size-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10',

  // ── Actions row · always present (Add Route / Add Graph are the report's two jobs). ──
  actionsRow: 'px-3 py-2.5 border-b border-zinc-950/08 bg-slate-50 flex items-center gap-2 shrink-0',
  addRouteBtn: 'tny-press h-8 px-2.5 inline-flex items-center gap-1.5 rounded-[6px] bg-[#1F3F8F] text-white border-b-4 border-[#16306e]',
  addGraphBtn: 'h-8 px-2.5 inline-flex items-center gap-1.5 rounded-[6px] bg-white border border-zinc-950/15 text-[#0f1722] hover:border-[#37576B]',
  addBtnIcon: 'size-3.5 shrink-0',
  addGraphBtnIcon: 'size-3.5 text-[#37576B] shrink-0',
  addBtnLabel: 'font-display uppercase text-[11.5px] tracking-wide',

  dynamicToggleWrapper: 'px-3 py-2.5 border-b border-zinc-950/08 bg-slate-50/60 flex items-center gap-2',
  dynamicToggleLabel: 'font-display uppercase text-[11px] tracking-[0.16em] text-slate-600 flex-1',

  searchOuterWrapper: 'px-3 py-2 border-b border-zinc-950/05 shrink-0',
  searchInnerBox: 'h-8 px-2 flex items-center gap-2 rounded-[6px] border border-zinc-950/15 bg-white focus-within:border-[#1F3F8F] focus-within:ring-2 focus-within:ring-[#1F3F8F]/15',
  searchIcon: 'size-3.5 text-slate-400 shrink-0',
  searchClearBtn: 'size-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-700',

  list: 'flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-0.5',

  // ── Row · collapsed rows carry NO background at all (same as the rail's own
  //     background) — only an OPEN row gets a faint tint. This is the specific thing
  //     flagged live: rows used to read as separate bordered cards. ──
  row: 'px-2 py-2.5',
  rowOpen: 'px-2 py-2.5 bg-slate-50/60 rounded-[6px]',
  rowRenaming: 'px-2 py-2.5 bg-[#1F3F8F]/5 rounded-[6px]',
  rowHeaderWrapper: 'flex items-start gap-1 min-w-0',
  reorderButtons: 'flex flex-col shrink-0 mt-0.5',
  reorderBtn: 'size-4 flex items-center justify-center text-slate-400 hover:text-slate-700 disabled:text-slate-200 disabled:cursor-not-allowed',
  // The +/- expander: small, WHITE, bordered — a plain +/- character, not a filled button.
  expander: 'size-5 mt-0.5 shrink-0 rounded border border-zinc-950/12 bg-white flex items-center justify-center font-mono text-[11px] leading-none text-slate-500 hover:border-[#37576B]',
  expanderOpen: 'size-5 mt-0.5 shrink-0 rounded border border-[#37576B]/40 bg-white flex items-center justify-center font-mono text-[11px] leading-none text-[#37576B]',
  // Identity-colour dot: edit permission gets a ring-hover popover trigger; a read-only
  // viewer gets a plain static swatch.
  colorDot: 'size-3 mt-1 rounded-full shrink-0',
  colorDotButton: 'size-3.5 mt-1 rounded-full ring-1 ring-[#0f1722]/20 shrink-0 hover:ring-2 hover:ring-[#1F3F8F]/40 cursor-pointer',
  iconContainer: 'min-w-0 flex-1 flex items-center gap-1',
  routeTitle: 'font-proxima text-[13px] font-semibold text-slate-700 truncate flex-1 min-w-0',
  // Row-level actions (rename/remove) — transparent icon buttons, background only on hover.
  iconBtn: 'size-6 rounded flex items-center justify-center text-slate-400 hover:bg-slate-100 shrink-0',
  dangerBtn: 'size-6 rounded flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600 shrink-0',
  editContainer: 'flex items-center gap-1.5 min-w-0',
  renameInput: 'flex-1 min-w-0 h-8 px-2 rounded-[6px] border border-[#1F3F8F] bg-white ring-2 ring-[#1F3F8F]/15 font-proxima text-[12.5px] text-slate-700 focus:outline-none',
  saveBtn: 'size-7 rounded-[6px] border border-[#10B981]/40 bg-[#10B981]/10 flex items-center justify-center text-[#0f7a52] shrink-0',
  cancelBtn: 'size-7 rounded-[6px] border border-[#EF4444]/40 bg-[#EF4444]/10 flex items-center justify-center text-[#b91c1c] shrink-0',

  // Meta line ("9 TMC · 2.0 mi · 2025-01-06 → 2025-02-28") — a compact mono micro-label,
  // indented to the name's left edge (past reorder/expander/dot).
  metaIndent: 'pl-7',
  meta: 'font-mono text-[9.5px] uppercase tracking-[0.08em] text-slate-400 tabular-nums mt-0.5',

  // ── Open-out · full row width (no indent), a bordered white card. NO TMC list —
  //     the count already lives in the meta line; nobody reads codes off a 340px rail. ──
  expandedContainer: 'mt-2 rounded-[6px] border border-zinc-950/08 bg-white p-2.5 space-y-3',
  openOutRemoveRow: 'pt-2.5 border-t border-zinc-950/05 flex justify-end',
  openOutRemoveBtn: 'h-7 px-2 inline-flex items-center gap-1.5 rounded-[6px] border border-[#EF4444]/40 bg-[#EF4444]/5 text-[#b91c1c] hover:bg-[#EF4444]/10',
  openOutRemoveLabel: 'font-display uppercase text-[10.5px] tracking-wide',

  // ── Date-span block · the one window facet a route still owns (design push #2, 2026-08-06 —
  //     weekday mask/time-of-day moved to the graph, see QuickControls). ──
  facetLabel: 'font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500',
  windowHead: 'flex items-center justify-between gap-2',
  windowActionsRow: 'flex items-center gap-1',
  derivedNote: 'font-proxima text-[11px] italic text-slate-500 mt-1',
  // Read-only: a single row, clickable as a whole to enter edit mode.
  windowReadWrapper: 'mt-1.5 space-y-1',
  windowReadWrapperOpener: 'mt-1.5 space-y-1 cursor-pointer group/win rounded-[4px] -mx-1 px-1 py-0.5 hover:bg-[#1F3F8F]/5',
  windowReadRow: 'flex items-baseline gap-2',
  windowReadRowValue: 'font-proxima text-[12px] text-slate-700 flex-1 min-w-0',

  facetBlockFirst: 'mt-2',
  dateFieldRow: 'flex items-end gap-1.5',
  dateFieldWrapper: 'flex-1 min-w-0',
  dateFieldLabel: 'font-proxima text-[10px] font-semibold text-slate-500 block mb-0.5',
  dateFieldInput: 'w-full h-7 px-1.5 rounded-[4px] border border-zinc-950/15 bg-white font-mono text-[11px] tabular-nums text-[#0f1722] focus:outline-none focus:border-[#1F3F8F]',
  dateFieldArrow: 'pb-1.5 text-slate-300',
  shiftRow: 'mt-1.5 flex items-center gap-1',
  shiftLabel: 'font-proxima text-[10.5px] text-slate-400 mr-0.5',
  shiftKeepsLength: 'font-proxima text-[10.5px] text-slate-400 ml-auto',

  // Shared pill vocabulary (matches the design file's C.pill).
  pill: 'h-5 px-1.5 rounded border border-zinc-950/12 bg-slate-100 text-slate-600 font-mono text-[10px] hover:bg-slate-200',

  // Derive-mode (Mechanism B) controls — kept from before, restyled to the same vocabulary.
  dateModeWrapper: 'flex items-center gap-1.5',
  dateModeLabel: 'font-proxima text-[11px] font-semibold text-slate-600',
  deriveControlsWrapper: 'space-y-1.5 p-1.5 bg-[#1F3F8F]/5 border border-[#1F3F8F]/15 rounded-[4px]',
  deriveFormulaError: 'font-proxima text-[11px] text-[#b91c1c]',
  dowSummary: 'font-proxima text-[11px] text-slate-500 italic',

  // "Base for N routes" — a standing fact about a base row.
  dependentsRow: 'pt-1',
  dependentsToggle: 'flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-slate-500 bg-transparent border-none p-0 cursor-pointer',
  dependentsPillList: 'flex flex-wrap gap-1 mt-1.5',
  miniPill: 'h-5 px-1.5 inline-flex items-center rounded-full font-mono text-[9.5px] border bg-slate-100 text-slate-600 border-zinc-950/12',
  sectionToggleChevron: 'size-3 text-slate-400 shrink-0',

  // ── Identity-colour popover (portalled via UI.Popup — see colorDotButton above). ──
  colorPopoverBody: 'w-[204px] bg-white border border-zinc-950/10 rounded-[8px] shadow-lg p-2.5',
  colorPopoverHead: 'flex items-center gap-2 mb-2',
  colorPopoverLabel: 'font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500 flex-1',
  colorPopoverHex: 'font-mono text-[10.5px] tabular-nums text-slate-500',
  colorSwatchGrid: 'grid grid-cols-9 gap-1',
  colorSwatch: 'size-4 rounded-full hover:ring-2 hover:ring-offset-1 hover:ring-[#0f1722]/20',
  colorSwatchActive: 'size-4 rounded-full ring-2 ring-offset-1 ring-[#0f1722]/50',
  colorPopoverFooter: 'mt-2 pt-2 border-t border-zinc-950/05 font-proxima text-[11px] leading-[1.4] text-slate-500',

  // ── Skeleton / empty states ──
  skeletonWrapper: 'space-y-1',
  skeletonRow: 'h-11 rounded-[6px] bg-slate-100 animate-pulse',
  empty: 'font-proxima text-[11.5px] text-slate-400 italic p-2',
  error: 'font-proxima text-[11px] text-[#b91c1c] px-3 pb-2',

  // ── Rail-top clipboard strip ──
  clipboardStrip: 'px-3 py-2.5 border-b border-[#1F3F8F]/20 bg-[#1F3F8F]/5 shrink-0',
  clipboardStripHead: 'flex items-center gap-2',
  clipboardStripIcon: 'text-[#1F3F8F] shrink-0 size-3.5',
  clipboardStripLabel: 'font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500 flex-1 min-w-0 truncate',
  clipboardStripClear: 'size-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 shrink-0',
  clipboardStripPreview: 'font-proxima text-[11.5px] text-slate-700 mt-1',
  clipboardStripPasteAll: 'mt-1.5 h-6 px-2 inline-flex items-center gap-1 rounded-[4px] border border-[#1F3F8F]/30 bg-white hover:bg-[#1F3F8F]/5 font-mono text-[9.5px] uppercase tracking-wider text-[#1F3F8F]',
};
