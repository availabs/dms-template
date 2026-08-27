import { pickerModalTheme } from '../PickerModal/PickerModal.theme';

// Spreads the shared picker-modal chrome (search box, facet chips, count/sort bar — see
// PickerModal.theme.js) first, then layers route-specific keys on top — real STYLING sharing
// with ReportPickerModal.theme.js, not just component code, per Ryan's 2026-08-25 correction.
export const routeTagBrowserModalTheme = {
  ...pickerModalTheme,
  wrapper: 'flex flex-col h-[70vh] max-h-[640px]',
  header: 'text-base font-bold text-slate-800 mb-1',
  breadcrumb: 'flex items-center flex-wrap gap-1 text-xs text-slate-500 mb-2',
  breadcrumbStep: 'hover:text-blue-600 hover:underline cursor-pointer',
  breadcrumbStepCurrent: 'text-slate-700 font-semibold',
  breadcrumbSep: 'text-slate-300',
  selectedChips: 'flex flex-wrap gap-1.5 mb-2',
  selectedChip: 'flex items-center gap-1 pl-2 pr-1 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs text-blue-700 max-w-[220px]',
  selectedChipLabel: 'truncate',
  selectedChipRemove: 'shrink-0 text-blue-400 hover:text-blue-600',
  body: 'flex-1 min-h-0 overflow-y-auto',
  // 3 fixed/enumerable axes (County/Region/Agency) as header-weight pills; the other two
  // discovery paths (Auto-generated, Other tags) demoted to plain text links below them —
  // 5 equal-weight tiles overstated two provenance/free-text escape hatches to the same
  // visual weight as the three real browse axes.
  categoryPillRow: 'flex flex-wrap items-center gap-1.5 mt-1',
  categoryPill: 'px-2.5 py-1 rounded-full text-sm font-semibold text-slate-700 bg-slate-100 border border-slate-200 hover:bg-slate-200 flex items-center gap-1',
  categoryPillHint: 'text-[10px] font-normal text-slate-400',
  categoryLinkRow: 'flex items-center gap-1.5 mt-1.5 text-xs',
  categoryLink: 'text-blue-600 hover:underline',
  categoryLinkSep: 'text-slate-300',
  sectionLabel: 'text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-3 mb-1',
  valueList: 'grid grid-cols-2 sm:grid-cols-3 gap-1.5',
  valueItem: 'w-full text-left px-2 py-1.5 bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 text-sm text-slate-700 truncate',
  routeList: 'space-y-1',
  routeItem: 'w-full flex items-center gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 text-left',
  routeItemSelected: 'w-full flex items-center gap-2 p-1.5 bg-blue-50 border border-blue-300 rounded hover:bg-blue-100 text-left',
  routeCheckbox: 'shrink-0',
  // Body = name/meta line + tag-chips line stacked, so name+TMC-count alone never has to
  // stand in for what actually distinguishes two similarly-named routes.
  routeItemBody: 'flex-1 min-w-0 flex flex-col gap-0.5',
  routeItemTopLine: 'flex items-center gap-2',
  routeName: 'text-sm text-slate-700 truncate flex-1 min-w-0',
  // "Show N short segments" reveal for fragment-collapsed lists (2026-08-25) — styled as a
  // plain list row so it sits inline with the routes it's hiding, not as a separate button bar.
  fragmentsToggle: 'w-full text-left px-1.5 py-1.5 text-xs text-blue-600 hover:underline',
  // Badge line (mine/auto-generated/curated + fragment + already-added) — its own row below
  // name+TMC-count (2026-08-25) rather than crowded onto the name line, so the Pill badges can
  // wrap freely without fighting the name's `truncate`.
  routeBadgeRow: 'flex flex-wrap items-center gap-1.5',
  alreadyAddedBadge: 'px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-700 border border-amber-200 shrink-0',
  routeMeta: 'text-[11px] text-slate-400 shrink-0',
  routeTagChips: 'flex flex-wrap items-center gap-1',
  routeTagChip: 'px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500 border border-slate-200',
  loading: 'text-gray-500 text-sm p-2',
  empty: 'text-gray-400 italic text-sm p-2',
  error: 'text-red-500 mt-1 text-xs',
  // "As of date" row (Dynamic Reports' entry gate only, when the report uses a Today-derived
  // date) — sits between the route list and the footer, same weight as a plain form field.
  asOfDateRow: 'flex items-center gap-2 pt-2 mt-1 border-t border-slate-100',
  asOfDateLabel: 'text-xs font-semibold text-slate-600',
  asOfDateInput: 'text-sm border border-slate-300 rounded px-2 py-1',
  footer: 'flex items-center justify-between gap-2 pt-3 mt-2 border-t border-slate-200',
  footerCount: 'text-xs text-slate-500',
  footerButtons: 'flex items-center gap-2',
};
