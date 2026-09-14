// Theme sibling for ClosureDensityPanel.jsx (the `.theme.{js,jsx}` convention documented in
// src/dms/packages/dms/CLAUDE.md's Vite Fast Refresh section). Not registered into any site-wide
// merge pipeline - see ../../routing/components/RouteDetailsPanel.theme.js for the full reasoning;
// same local-default-spread + getComponentTheme pattern, same safe no-op fallback since nothing
// registers a `closureDensityPanel` key into ThemeContext.
export const closureDensityPanelTheme = {
  wrapper: "absolute bottom-4 left-4 right-4 sm:right-auto z-10 flex flex-col-reverse gap-3 pointer-events-none",
  panel: "w-auto sm:w-80 bg-white/95 border rounded-md shadow-md p-3 text-sm pointer-events-auto",
  title: "font-bold mb-1",
  instructionText: "text-gray-600 mb-2",

  selectedBanner: "mb-2 text-xs bg-red-50 border border-red-200 rounded px-2 py-1.5",
  selectedBannerText: "text-red-700",

  statusText: "text-gray-600 mb-2",
  errorText: "text-red-600 mb-2",
  summaryText: "text-xs text-gray-600 mb-2",

  legendWrapper: "mb-2",
  legendHeader: "text-gray-500 text-xs uppercase tracking-wide mb-1",
  legendSwatches: "flex h-3 rounded overflow-hidden",
  legendSwatch: "flex-1",
  legendRangeRow: "flex text-[10px] text-gray-500 mt-0.5 font-mono",
  legendRangeLabel: "flex-1 text-center",

  pairPickerBox: "mb-2 text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1.5",
  pairPickerTitle: "font-semibold text-slate-700 mb-1",
  pairPickerHint: "text-slate-500",
  pairPickerStatus: "text-slate-600",
  pairPickerLoading: "text-slate-500 mt-0.5",
  pairPickerError: "text-red-600 mt-0.5",
  pairPickerResult: "text-slate-600 mt-0.5 font-mono",
  pairPickerClearButton: "text-slate-500 underline mt-1",

  analyzeButton: "mt-1 w-full",
  clearButton: "mt-2 w-full",

  comparisonTitle: "font-bold mb-3",
  comparisonMetricLabel: "text-slate-700 text-xs font-semibold mb-1.5",
  comparisonMetricLabelSecond: "text-slate-700 text-xs font-semibold mt-4 mb-1.5 pt-3 border-t border-gray-200",
};
