// Theme sibling for RouteComparisonBarChart.jsx (the `.theme.{js,jsx}` convention documented in
// src/dms/packages/dms/CLAUDE.md's Vite Fast Refresh section). Not registered into any site-wide
// merge pipeline - see ../../routing/components/RouteDetailsPanel.theme.js for the full reasoning;
// same local-default-spread + getComponentTheme pattern, same safe no-op fallback since nothing
// registers a `routeComparisonBarChart` key into ThemeContext.
import { ROUTE_COLOR } from "../constants";

export const routeComparisonBarChartTheme = {
  // Dynamic (not Tailwind-class) color, folded in alongside the classNames.
  colors: { primary: ROUTE_COLOR },

  emptyText: "text-gray-500 text-xs",
  headerRow: "flex items-baseline gap-1.5 mb-2",
  avgValue: "text-2xl font-bold tabular-nums",
  avgUnit: "text-sm font-medium text-gray-500",
  sectionLabel: "text-gray-500 text-[11px] uppercase tracking-wide mb-1.5 pt-1.5 border-t",
  bucketList: "space-y-1.5",
  bucketRow: "flex items-center gap-1.5",
  bucketRangeLabel: "w-20 text-right text-[10px] font-mono text-gray-500 shrink-0",
  bucketBarTrack: "flex-1 h-3 bg-gray-100 rounded-sm overflow-hidden",
  bucketBarFill: "h-full rounded-sm",
  bucketCountLabel: "w-16 text-[10px] font-mono text-gray-600 shrink-0",
};
