// Theme sibling for RouteDetailsPanel.jsx (the `.theme.{js,jsx}` convention documented in
// src/dms/packages/dms/CLAUDE.md's Vite Fast Refresh section). Not registered into any site-wide
// merge pipeline - `patterns/mapeditor/` has no defaultTheme.js, and adding one is a separate,
// larger decision (would touch core `src/dms/` library code) deferred for now. This file exists so
// every visual class lives in one named place instead of scattered inline in the component, per
// this package's "no Tailwind in markup" rule - RouteDetailsPanel.jsx reads it via the standard
// local-default-spread + getComponentTheme pattern, which safely falls back to these exact values
// since nothing registers a `routeDetailsPanel` key into ThemeContext.
import { ROUTE_VARIANT_COLORS } from "../constants";

export const routeDetailsPanelTheme = {
  // Dynamic (not Tailwind-class) colors, folded into the theme too so a site override can restyle
  // the selected/unselected route variant colors the same way it can restyle layout - single
  // source of truth, ROUTE_VARIANT_COLORS in constants.js is what other files (map paint, etc.)
  // still read directly for non-panel uses.
  colors: ROUTE_VARIANT_COLORS,

  panel: "absolute bottom-4 left-4 z-10 w-80 bg-white/95 border rounded-md shadow-md p-3 text-sm pointer-events-auto",
  title: "font-bold mb-1",
  stepText: "text-gray-600 mb-2",
  loadingText: "text-gray-600 mb-2",
  errorText: "text-red-600 mb-2",

  variantRow: "flex gap-2 mb-2",
  variantButton: "flex-1 text-left border rounded p-2",
  variantButtonHeader: "flex items-center gap-1.5 text-xs font-semibold text-gray-700",
  variantDot: "inline-block w-2.5 h-2.5 rounded-full",
  variantSubtext: "text-xs text-gray-500 mt-0.5",

  statsList: "divide-y",
  statRow: "flex justify-between py-1",
  statLabel: "text-gray-500",
  statValue: "font-mono",

  segmentsWrapper: "mt-2",
  segmentsHeader: "text-gray-500 text-xs uppercase tracking-wide mb-1",
  segmentsList: "max-h-40 overflow-y-auto border rounded divide-y",
  segmentRow: "flex justify-between px-2 py-1 text-xs",
  segmentLabel: "text-gray-500",
  segmentValue: "font-mono",

  getRouteButton: "mt-3 w-full",
  clearButton: "mt-2 w-full",
};
