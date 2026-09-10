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

  // Round 82 (old-reports-conversion.md, "Round B") — category→value tag drill-down, same
  // tokens/values as RouteTagBrowserModal.theme.js so the two pickers stay visually identical.
  breadcrumb: 'flex items-center flex-wrap gap-1 text-xs text-slate-500 mb-2',
  breadcrumbStep: 'hover:text-blue-600 hover:underline cursor-pointer',
  breadcrumbStepCurrent: 'text-slate-700 font-semibold',
  breadcrumbSep: 'text-slate-300',
  categoryPillRow: 'flex flex-wrap items-center gap-1.5 mt-1',
  categoryPill: 'px-2.5 py-1 rounded-full text-sm font-semibold text-slate-700 bg-slate-100 border border-slate-200 hover:bg-slate-200 flex items-center gap-1',
  categoryPillHint: 'text-[10px] font-normal text-slate-400',
  categoryLinkRow: 'flex items-center gap-1.5 mt-1.5 text-xs',
  categoryLink: 'text-blue-600 hover:underline',
  categoryLinkSep: 'text-slate-300',
  sectionLabel: 'text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-3 mb-1',
  valueList: 'grid grid-cols-2 sm:grid-cols-3 gap-1.5',
  valueItem: 'w-full text-left px-2 py-1.5 bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 text-sm text-slate-700 truncate',
  reportTagChips: 'flex flex-wrap items-center gap-1',
  reportTagChip: 'px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500 border border-slate-200',

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
