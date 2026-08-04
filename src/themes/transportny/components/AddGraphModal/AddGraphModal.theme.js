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

  pickerGrid: 'grid grid-cols-2 gap-3 content-start',
  pickerField: 'flex flex-col gap-1',
  pickerLabel: 'text-[11px] font-bold text-slate-500 uppercase tracking-wider',

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
