export const addGraphModalTheme = {
  wrapper: 'flex flex-col max-h-[80vh]',
  header: 'text-base font-bold text-slate-800 mb-1',
  subheader: 'text-xs text-slate-500 mb-3',
  body: 'flex-1 min-h-0 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4',
  sectionLabel: 'text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5',

  routeChecklist: 'space-y-1 max-h-56 overflow-y-auto',
  routeItem: 'w-full flex items-center gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 text-left',
  routeItemSelected: 'w-full flex items-center gap-2 p-1.5 bg-blue-50 border border-blue-300 rounded hover:bg-blue-100 text-left',
  routeCheckbox: 'shrink-0',
  routeColorSwatch: 'w-2.5 h-2.5 rounded-full shrink-0 border border-black/10',
  routeName: 'text-sm text-slate-700 truncate flex-1 min-w-0',
  empty: 'text-gray-400 italic text-sm p-2',
  routesNote: 'mt-1.5 text-[11px] text-slate-500',

  // 5 shape cards (Bar/Line/Grid/Table/Map) replacing a plain "Graph Type" dropdown — picking
  // what a graph looks like is the modal's primary decision, worth more visual weight than a
  // <select>. Map renders disabled (grayed, cursor-not-allowed) until its compose path exists.
  shapeCardGrid: 'grid grid-cols-5 gap-1.5 mb-3',
  shapeCard: 'flex flex-col items-center gap-1 p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-50',
  shapeCardSelected: 'flex flex-col items-center gap-1 p-2 rounded-lg border border-blue-300 bg-blue-50 text-blue-700',
  shapeCardGlyph: 'w-6 h-6',
  shapeCardLabel: 'text-[10px] font-semibold uppercase tracking-wide',
  measureNativeSelect: 'w-full h-9 px-2 rounded-[6px] border border-zinc-950/15 bg-white text-[13px] text-slate-700 focus:outline-none focus:border-blue-400',
  pickerGrid: 'grid grid-cols-2 gap-3 content-start',
  pickerField: 'flex flex-col gap-1',
  pickerLabel: 'text-[11px] font-bold text-slate-500 uppercase tracking-wider',

  // "When" — time-of-day + day-of-week, the facets that moved off the route (design push #2,
  // 2026-08-06). Same slate/blue vocabulary as the rest of this not-yet-reskinned modal (see
  // RouteTagBrowserModal/AddGraphModal note in the task file — a navy pass here is a separate,
  // deferred piece of work, not part of this structural change).
  whenPresetRow: 'flex flex-wrap items-center gap-1',
  whenPreset: 'h-6 px-2 inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 text-slate-600 text-[11px] font-medium hover:bg-slate-100',
  whenPresetSelected: 'h-6 px-2 inline-flex items-center gap-1 rounded border border-blue-300 bg-blue-50 text-blue-700 text-[11px] font-medium',
  dowRow: 'flex flex-wrap items-center gap-1 mt-1.5',
  dayToggle: 'w-6 h-6 rounded border border-slate-200 bg-slate-50 text-slate-500 text-[11px] font-medium hover:bg-slate-100',
  dayToggleSelected: 'w-6 h-6 rounded border border-blue-300 bg-blue-50 text-blue-700 text-[11px] font-medium',
  daySetBtn: 'h-6 px-2 inline-flex items-center rounded border border-slate-200 bg-slate-50 text-slate-600 text-[10.5px] font-semibold uppercase tracking-wide hover:bg-slate-100',

  preview: 'mt-3 flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg',
  previewGlyph: 'w-10 h-10 shrink-0 text-blue-500',
  previewTextWrap: 'flex flex-col gap-0.5 min-w-0',
  previewTitle: 'text-sm font-semibold text-slate-700',
  previewDescription: 'text-xs text-slate-500',
  previewSummary: 'text-[11px] text-slate-400',

  footer: 'flex items-center justify-between gap-2 pt-3 mt-3 border-t border-slate-200',
  footerCount: 'text-xs text-slate-500',
  footerButtons: 'flex items-center gap-2',
};
