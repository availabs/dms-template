// Theme sibling for DetourDetailsPanel.jsx (the `.theme.{js,jsx}` convention documented in
// src/dms/packages/dms/CLAUDE.md's Vite Fast Refresh section). Not registered into any site-wide
// merge pipeline - see ../../routing/components/RouteDetailsPanel.theme.js for the full reasoning;
// same local-default-spread + getComponentTheme pattern, same safe no-op fallback since nothing
// registers a `detourDetailsPanel` key into ThemeContext. Covers DetourDetailsPanel, its
// co-located ImpactBlock sub-component, and DetourModeSwitch (shares this theme object under the
// modeSwitch* keys below instead of its own sibling file).
import { ROUTE_COLOR, ROUTE_SECONDARY_COLOR } from "../constants";

export const detourDetailsPanelTheme = {
  // Dynamic (not Tailwind-class) colors, folded in alongside the classNames - single
  // source of truth, constants.js is what other files (map paint, etc.) still read directly.
  colors: { primary: ROUTE_COLOR, secondary: ROUTE_SECONDARY_COLOR },

  // DetourModeSwitch
  modeSwitchWrapper: "absolute top-4 left-4 z-10 inline-flex bg-white/95 border rounded-md shadow-md p-1 pointer-events-auto gap-1",
  modeSwitchOption: "text-xs font-medium px-2.5 py-1.5 rounded text-gray-500 hover:bg-gray-100 cursor-pointer",
  modeSwitchOptionActive: "text-xs font-medium px-2.5 py-1.5 rounded bg-blue-600 text-white cursor-pointer",

  panel: "absolute bottom-4 left-4 right-4 sm:right-auto z-10 w-auto sm:w-80 max-h-[calc(100vh-2rem)] overflow-y-auto bg-white/95 border rounded-md shadow-md p-3 text-sm pointer-events-auto",
  title: "font-bold mb-1",
  instructionText: "text-gray-600 mb-2",

  selectedBanner: "mb-2 text-xs bg-red-50 border border-red-200 rounded px-2 py-1.5",
  selectedBannerText: "text-red-700",
  warningBanner: "mb-2 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded px-2 py-1",

  loadingText: "text-gray-600 mb-2",
  errorText: "text-red-600 mb-2",

  variantRow: "flex gap-2 mb-2",
  variantButton: "flex-1 text-left border rounded p-2",
  variantButtonLabel: "text-xs font-semibold text-gray-700",

  segmentsWrapper: "mt-1",
  segmentsHeader: "text-gray-500 text-xs uppercase tracking-wide mb-1",
  segmentsList: "max-h-64 overflow-y-auto border rounded divide-y",
  segmentRow: "flex justify-between px-2 py-1 text-xs",
  segmentLabel: "text-gray-500",
  segmentValue: "font-mono",

  getDetourButton: "mt-3 w-full",
  clearButton: "mt-2 w-full",

  // ImpactBlock sub-component
  impactNoRouteBlock: "border rounded p-2 text-xs text-gray-400 border-dashed mb-2",
  impactNoRouteHeader: "flex items-center gap-1.5 font-semibold mb-0.5",
  impactSwatch: "inline-block w-4",
  impactBlock: "border rounded p-2 mb-2",
  impactBlockHeader: "flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5",
  impactStatRow: "flex justify-between text-xs py-0.5",
  impactStatLabel: "text-gray-500",
  impactStatValue: "font-mono",
  impactDeltaRow: "flex justify-between text-xs py-0.5 border-t mt-0.5 pt-1 font-semibold",
  impactClosedOnlyText: "text-xs text-gray-500",
  impactUnavailableText: "text-xs text-gray-400 italic mt-0.5",
};
