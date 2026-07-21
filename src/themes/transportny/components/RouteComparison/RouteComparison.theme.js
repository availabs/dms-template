// RouteComparison — Tailwind class map, ported from the design mockup
//   TransportNY Design System/dms_design_system_v2/pages/route-comparison.html
//   (the LEFT "Build comparison" builder rail: Scope · Routes · Periods · Metrics).
//
// The `.jsx` carries NO inline Tailwind — every class lives here and is pulled in
// through ThemeContext + getComponentTheme(theme, 'routeComparison'). A downstream
// theme can override any key by defining a `routeComparison` block; absent that,
// these defaults apply (see dms src/themes/CLAUDE.md — style via the theme, not
// className passthroughs).
export const routeComparisonTheme = {
  // ── shell ──────────────────────────────────────────────────────────────────
  wrapper: 'flex flex-col gap-3',
  card: 'rounded-[8px] border border-zinc-950/10 bg-white shadow-sm',

  // ── card header (Reset action only — title removed) ──
  cardHeader: 'px-4 pt-3 pb-2.5 border-b border-zinc-950/10 flex items-center justify-end gap-2',
  resetBtn: 'font-mono text-[10px] uppercase tracking-wider text-slate-400 hover:text-slate-700 cursor-pointer',

  // ── generic numbered/labelled block ──
  block: 'px-4 py-4 border-b border-zinc-950/10',
  blockLast: 'px-4 py-4',
  blockHead: 'flex items-center gap-2 mb-2.5',
  stepBadge: 'flex size-5 items-center justify-center rounded-full bg-[#1F3F8F] text-white font-mono text-[11px] font-semibold',
  blockIcon: 'size-4 text-slate-500',
  blockTitle: 'font-display font-medium text-[13.5px] uppercase tracking-wide text-[#0F1722] flex-1',
  blockHint: 'font-mono text-[10px] text-slate-400',

  // ── Scope block ──
  scopeGrid: 'grid gap-1.5',
  scopeBtn: 'flex items-center h-10 px-2.5 rounded-[6px] border border-zinc-950/10 bg-slate-50 hover:bg-white text-left cursor-pointer w-full',
  scopeBtnActive: 'flex items-center h-10 px-2.5 rounded-[6px] border border-[#1F3F8F]/40 bg-white text-left cursor-pointer w-full',
  scopeBtnIconWrap: 'mr-2 text-slate-400',
  scopeBtnIcon: 'size-3.5',
  scopeBtnBody: 'flex-1 min-w-0',
  scopeBtnLabel: 'block font-mono text-[9.5px] uppercase tracking-wider text-slate-400 leading-tight',
  scopeBtnValue: 'block text-[12.5px] text-[#0F1722] leading-tight',
  scopeBtnValueHint: 'font-mono text-[10px] text-slate-400',
  scopeCaret: 'size-3 text-slate-400 shrink-0',
  scopeNote: 'mt-1.5 font-proxima text-[10.5px] leading-snug text-slate-400',

  // inline scope editor (revealed under a scope button)
  scopeEditor: 'mt-1.5 p-2.5 rounded-[6px] border border-zinc-950/10 bg-white flex flex-col gap-2',
  scopeEditorRow: 'flex items-center gap-2',
  scopeEditorLabel: 'font-mono text-[9.5px] uppercase tracking-wider text-slate-400 w-14 shrink-0',
  scopeTimeInputs: 'flex items-center gap-1.5 flex-1',
  scopeTimeInput: 'h-7 px-2 rounded-[6px] border border-zinc-950/15 bg-slate-50 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1F3F8F]/30 tabular-nums',
  scopeTimeSep: 'text-slate-400 text-[11px]',
  dowRow: 'flex items-center gap-1 flex-wrap',
  dowChip: 'flex size-6 items-center justify-center rounded text-[11px] border border-zinc-950/10 bg-slate-50 text-slate-500 hover:bg-slate-100 cursor-pointer',
  dowChipActive: 'flex size-6 items-center justify-center rounded text-[11px] border border-[#1F3F8F] bg-[#1F3F8F] text-white cursor-pointer',
  vehRow: 'flex items-center gap-1 flex-wrap',
  vehChip: 'px-2 h-7 inline-flex items-center rounded-[6px] text-[11.5px] border border-zinc-950/10 bg-slate-50 text-slate-600 hover:bg-slate-100 cursor-pointer',
  vehChipActive: 'px-2 h-7 inline-flex items-center rounded-[6px] text-[11.5px] border border-[#1F3F8F] bg-[#1F3F8F]/5 text-[#1F3F8F] font-medium cursor-pointer',

  // ── Routes block ──
  searchWrap: 'relative',
  searchIcon: 'size-3.5 absolute left-2.5 top-2.5 text-slate-400 pointer-events-none',
  searchInput: 'w-full h-8 pl-8 pr-2 rounded-[6px] border border-zinc-950/15 bg-slate-50 text-[12.5px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1F3F8F]/30',
  routesMeta: 'mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-slate-400',
  clearAll: 'text-rose-500 hover:text-rose-700 cursor-pointer',

  chipsList: 'mt-2 grid gap-1.5',
  chip: 'group flex items-center gap-2 h-9 pl-2.5 pr-1.5 rounded-[6px] border border-zinc-950/10 bg-slate-50 hover:bg-white',
  chipDot: 'size-2 rounded-full bg-[#1F3F8F] shrink-0',
  chipBody: 'flex-1 min-w-0',
  chipName: 'text-[12.5px] text-[#0F1722] truncate leading-tight',
  chipMeta: 'font-mono text-[9.5px] text-slate-400 leading-tight',
  chipRemove: 'size-5 flex items-center justify-center rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer',
  chipRemoveIcon: 'size-3',

  // search results dropdown
  results: 'mt-2 grid gap-0.5 max-h-64 overflow-y-auto',
  resultItem: 'flex items-center gap-2 h-9 px-2.5 rounded-[6px] border border-transparent hover:bg-slate-50 cursor-pointer text-left w-full',
  resultItemOn: 'flex items-center gap-2 h-9 px-2.5 rounded-[6px] border border-transparent bg-[#1F3F8F]/5 cursor-default text-left w-full',
  resultBody: 'flex-1 min-w-0',
  resultName: 'text-[12.5px] text-[#0F1722] truncate leading-tight',
  resultMeta: 'font-mono text-[9.5px] text-slate-400 leading-tight',
  resultAddIcon: 'size-3.5 text-[#1F3F8F] shrink-0',
  resultOnIcon: 'size-3.5 text-emerald-600 shrink-0',

  addBtn: 'mt-2 w-full h-8 inline-flex items-center justify-center gap-1.5 rounded-[6px] border border-dashed border-[#1F3F8F]/40 text-[#1F3F8F] hover:bg-[#1F3F8F]/5 font-proxima text-[12px] font-semibold cursor-pointer',
  addBtnIcon: 'size-3.5',

  // ── Periods block (TODO 3.4 — shell) ──
  periodsGrid: 'grid gap-1.5',
  periodCardBase: 'rounded-[6px] border border-amber-300/70 bg-amber-50/60 px-2.5 py-2',
  periodCard: 'rounded-[6px] border border-zinc-950/10 bg-slate-50 px-2.5 py-2',
  periodHead: 'flex items-center gap-1.5',
  baseBadge: 'inline-flex items-center h-4 px-1.5 rounded-[3px] bg-[#FACC15] text-[#0F1722] font-mono text-[9px] font-bold uppercase tracking-wider',
  periodTitle: 'text-[12.5px] font-semibold text-[#0F1722] flex-1',
  periodDates: 'mt-1 flex items-center gap-1.5 font-mono text-[10px] text-slate-500',
  periodModeChip: 'inline-flex items-center h-4 px-1 rounded bg-white border border-zinc-950/10 text-slate-600',
  periodModeChipRel: 'inline-flex items-center h-4 px-1 rounded bg-indigo-50 border border-indigo-200 text-indigo-700',
  periodDatesVal: 'tabular-nums',
  periodBaseNote: 'mt-0.5 font-proxima text-[10.5px] text-amber-700',
  periodRelNote: 'mt-0.5 font-proxima text-[10.5px] text-slate-500',
  periodsNote: 'mt-2 font-proxima text-[10.5px] leading-snug text-slate-400',
  periodsNoteStrong: 'text-slate-600',
  periodsEmpty: 'text-[11.5px] text-slate-400 italic px-1 py-2',

  // ── Metrics block (TODO 3.5 — shell) ──
  metricsGrid: 'grid gap-1',
  metricRow: 'flex items-center gap-2.5 h-8 px-2 rounded-[6px] hover:bg-slate-50 cursor-pointer',
  metricRowDisabled: 'flex items-center gap-2.5 h-8 px-2 rounded-[6px] cursor-not-allowed opacity-60',
  metricCheck: 'flex size-4 items-center justify-center rounded-[4px] bg-[#1F3F8F] text-white',
  metricCheckOff: 'flex size-4 items-center justify-center rounded-[4px] border border-zinc-950/25 bg-white',
  metricCheckIcon: 'size-2.5',
  metricLabel: 'text-[12.5px] text-[#0F1722] flex-1',
  metricLabelDisabled: 'text-[12.5px] text-slate-500 flex-1',
  metricUnit: 'font-mono text-[10px] text-slate-400',
  metricDelta: 'inline-flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-wider text-[#1F3F8F]',
  metricDeltaTrack: 'relative inline-flex h-3.5 w-6 items-center rounded-full bg-[#1F3F8F]',
  metricDeltaTrackOff: 'relative inline-flex h-3.5 w-6 items-center rounded-full bg-slate-300',
  metricDeltaKnob: 'absolute right-0.5 size-2.5 rounded-full bg-white',
  metricDeltaKnobOff: 'absolute left-0.5 size-2.5 rounded-full bg-white',
  metricOverrides: 'ml-6 mt-0.5 mb-1 grid grid-cols-3 gap-1.5 font-mono text-[9.5px] text-slate-500',
  metricOverrideField: 'flex flex-col gap-0.5',
  metricOverrideLabel: 'uppercase tracking-wider',
  metricOverrideInput: 'h-6 px-1.5 rounded border border-zinc-950/10 bg-slate-50 text-slate-600 text-[10px] w-full',

  // ── footer note (shareable) ──
  footNote: 'rounded-[8px] border border-zinc-950/10 bg-white shadow-sm px-4 py-3',
  footKicker: 'font-mono text-[10px] uppercase tracking-[0.18em] text-[#CA8A04] mb-1',
  footText: 'font-proxima text-[11.5px] leading-[1.55] text-slate-700',
  footMono: 'font-mono text-[11px] text-slate-500',

  // ── status ──
  loading: 'text-slate-400 text-[11.5px] px-1 py-1',
  error: 'text-rose-500 text-[11px] px-1 py-1',
  empty: 'text-slate-400 italic text-[11.5px] px-1 py-2',
};
