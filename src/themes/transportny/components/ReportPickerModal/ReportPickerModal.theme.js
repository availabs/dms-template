import { pickerModalTheme } from '../PickerModal/PickerModal.theme';

// Spreads the shared picker-modal chrome (search box, facet chips, count/sort bar — see
// PickerModal.theme.js) first, then layers report-specific keys on top — same sharing
// convention as RouteTagBrowserModal.theme.js, so the two pickers stay visually consistent by
// construction rather than by discipline.
export const reportPickerModalTheme = {
  ...pickerModalTheme,
  wrapper: 'flex flex-col h-[70vh] max-h-[640px]',
  header: 'text-base font-bold text-slate-800 mb-1',
  headerSub: 'text-xs text-slate-500 mb-2',
  body: 'flex-1 min-h-0 overflow-y-auto',
  reportList: 'space-y-1',
  reportItem: 'w-full flex items-start gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 text-left',
  reportItemDisabled: 'w-full flex items-start gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded text-left opacity-60 cursor-not-allowed',
  reportItemBody: 'flex-1 min-w-0 flex flex-col gap-0.5',
  reportItemTopLine: 'flex items-center gap-2',
  reportName: 'text-sm font-medium text-slate-800 truncate flex-1 min-w-0',
  reportUpdated: 'text-[11px] text-slate-400 shrink-0 tabular-nums',
  reportBadgeRow: 'flex flex-wrap items-center gap-1.5',
  reportDescription: 'text-xs text-slate-500 line-clamp-2',
  reportDescriptionEmpty: 'text-xs text-slate-400 italic',
  reportMetaRight: 'text-[11px] text-slate-400 shrink-0 text-right',
  loading: 'text-gray-500 text-sm p-2',
  empty: 'text-gray-400 italic text-sm p-2',
  error: 'text-red-500 mt-1 text-xs',
  footer: 'flex items-center justify-between gap-2 pt-3 mt-2 border-t border-slate-200',
  footerCount: 'text-xs text-slate-500',
  footerButtons: 'flex items-center gap-2',
};
