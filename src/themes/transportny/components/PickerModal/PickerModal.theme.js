// Shared theme keys for the picker-modal chrome both RouteTagBrowserModal and
// ReportPickerModal compose (PickerModalParts.jsx) — search box, facet-chip row, count/sort
// bar, footer note bar. Each modal's own `.theme.js` spreads this in first, then adds/overrides
// its domain-specific keys (route items, category pills, report rows, …) — so the two modals
// share actual STYLING, not just component code, and a future visual tweak here lands on both
// at once instead of drifting.
export const pickerModalTheme = {
  searchWrapper: 'flex items-center gap-1.5 mb-2',
  searchIcon: 'w-3.5 h-3.5 text-slate-400 shrink-0',
  searchClear: 'shrink-0 text-slate-400 hover:text-slate-600',

  facetRow: 'flex flex-wrap items-center gap-1.5 mt-2 mb-1',
  facetLabel: 'text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-0.5',
  facetClearAll: 'ml-auto text-[11px] text-blue-600 hover:underline',

  countBar: 'flex items-center justify-between gap-3 text-xs text-slate-500 mb-1',
  countLabel: 'tabular-nums',
  sortPill: 'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400',
  sortPillValue: 'text-slate-600 font-medium normal-case tracking-normal',

  footerNoteBar: 'flex items-center justify-between gap-3 text-[11px] text-slate-400 pt-1.5 mt-1 border-t border-slate-100',
};
