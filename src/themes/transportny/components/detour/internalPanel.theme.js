// Theme sibling for internalPanel.jsx's inline base-layer-status text (the `.theme.{js,jsx}`
// convention documented in src/dms/packages/dms/CLAUDE.md's Vite Fast Refresh section). Not
// registered into any site-wide merge pipeline - see RouteDetailsPanel.theme.js (../routing) for
// the full reasoning; same local-default-spread + getComponentTheme pattern, same safe no-op
// fallback since nothing registers an `internalPanel` key into ThemeContext.
export const internalPanelTheme = {
  checkingText: "text-[11px] text-slate-400 mt-1",
  warningText: "text-[11px] text-red-600 mt-1",
};
