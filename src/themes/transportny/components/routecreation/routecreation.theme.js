// routecreation — Tailwind class map for the plugin's floating panels, ported from
//   TransportNY Design System/dms_design_system_v2/pages/npmrds-route-creation.html
// (routes-reports-users-mesh.md, Workstream E). Same shape/convention as the MacroView
// precedent (macroview.theme.js) — read that file's own header comment first.
//
// TWO theme sources, deliberately:
//   1. THE MAP COMPONENT'S OWN KEYS — `damaMap.layerLibrary` in
//      dms/…/ComponentRegistry/map/map.theme.js. The design was drawn FROM these, so the panel
//      shell is CONSUMED, not restated: `panel`/`panelInner`/`header`/`headerTitle`/
//      `headerCount`/`body`. A site that re-skins the Map's layer library re-skins these
//      panels with it.
//   2. THIS FILE — everything the layer-library panel has no equivalent for: the route
//      editor's own bespoke position (kept as-is per the mockup's own note — see
//      `editorWrapper` below — not switched to the shared `p-4` positioning), the mode
//      segmented control, the TMC search/list rows (incl. the hover-highlight state), the
//      route-identity panel, and the docked mode-hint pill.
//
// Colour vocabulary: brand blue (`#1F3F8F`, route/selection) and amber (`#CA8A04`,
// highlight) — NOT the map component's generic `blue-600`, because these two colors are also
// the literal Mapbox paint colors in `constants.js`/`dataUpdate.jsx` and must read as the same
// color in the chrome and on the canvas.
export const routecreationTheme = {
  // ── where the OTHER panels sit ─────────────────────────────────────────────────
  // Composed with damaMap.layerLibrary.panel ("p-4 pointer-events-none"), exactly the way
  // macroview's controlsPanel.jsx composes `${t.posTopLeft} ${mapT.panel}`. The route editor
  // (below) does NOT use these — see its own note.
  posTopLeft: "absolute top-0 left-0",
  posBottomCenter: "absolute bottom-0 left-1/2 -translate-x-1/2 p-4",

  // ── route editor (Panel 2) — position is the component's OWN, not the shared panel's p-4
  // positioning wrapper. npmrds-route-creation.html's own header note: "Position and width are
  // the component's own (top ~25px, right 8px, 318px, max-h 520px) — w-80 is 320px, so the
  // drawing and the component agree" — i.e. this was checked against the mockup and kept.
  editorWrapper:
    "absolute top-[25px] right-2 w-[318px] max-h-[520px] flex flex-col rounded-lg border border-zinc-950/10 bg-white/95 shadow-sm pointer-events-auto overflow-hidden",
  editorBody: "p-2.5 flex flex-col gap-2.5 overflow-hidden flex-1 min-h-0",

  // mode toggle — two-way segmented control (TMC click / Markers)
  segment2: "h-8 grid grid-cols-2 rounded-md border border-zinc-950/10 overflow-hidden shrink-0",
  segmentBtnFirst: "text-[12px] font-medium cursor-pointer",
  segmentBtn: "text-[12px] font-medium border-l border-zinc-950/10 cursor-pointer",
  segmentActive: "bg-[#1F3F8F] text-white",
  segmentInactive: "bg-white text-zinc-600 hover:bg-zinc-50",

  // count + Remove last / Clear all — same row in both modes
  countRow: "flex items-center justify-between shrink-0",
  countLabel: "text-[12px] font-semibold text-zinc-700 tabular-nums",
  countActions: "flex gap-1",
  countActionBtn: "text-[11px] text-zinc-600 hover:bg-zinc-100 rounded px-1.5 py-0.5 cursor-pointer",
  countActionBtnDestructive:
    "text-[11px] text-rose-600 hover:bg-rose-50 rounded px-1.5 py-0.5 cursor-pointer",

  // TMC search (TMC-click mode only)
  searchBlock: "shrink-0",
  searchLabel: "text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1",
  searchRow: "flex gap-1.5",
  searchInput:
    "flex-1 h-8 px-2.5 rounded-md border border-zinc-950/10 bg-white text-[12px] font-mono text-zinc-700 focus:outline-none focus:border-[#1F3F8F]/50",
  searchBtn:
    "h-8 px-3 rounded-md bg-[#1F3F8F] text-white text-[12px] font-medium hover:bg-[#16306e] disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed cursor-pointer",
  searchError: "text-[11px] text-rose-600 mt-1",

  // TMC list header + rows
  listHeader: "px-0.5 pt-1 pb-1 flex items-center gap-2 shrink-0 border-b border-zinc-950/10",
  listHeaderLabel: "text-[10px] font-semibold uppercase tracking-wider text-zinc-500 flex-1",
  listHeaderTotal: "font-mono text-[10.5px] tabular-nums text-zinc-500",
  list: "flex-1 min-h-0 overflow-y-auto scrollbar-sm divide-y divide-zinc-950/5",
  row: "px-2 py-1.5 hover:bg-zinc-50",
  rowHighlighted: "px-2 py-1.5 bg-amber-50 border-l-2 border-[#CA8A04]",
  rowTop: "flex items-center gap-2",
  rowTmc: "font-mono text-[12px] font-semibold text-zinc-800 flex-1",
  rowMiles: "font-mono text-[10.5px] tabular-nums text-zinc-500",
  rowBottom: "flex items-center gap-2",
  rowIntersection: "text-[11px] text-zinc-500 flex-1 truncate",
  rowRemove: "text-[10px] text-rose-600 hover:underline cursor-pointer",

  // save/update footer button
  footer: "p-2.5 border-t border-zinc-950/10 bg-zinc-50/80 shrink-0",
  saveBtn:
    "w-full h-9 rounded-md bg-[#1F3F8F] text-white text-[12.5px] font-medium hover:bg-[#16306e] cursor-pointer",

  // ── route identity panel (Panel 1, top-left) ────────────────────────────────────
  identityBody: "p-2.5 space-y-2.5",
  identityDot: "size-3 rounded-full bg-[#1F3F8F] shrink-0",
  identityName: "text-[13px] font-semibold text-zinc-800 truncate",
  identityMeta: "mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 tabular-nums",
  identityEditingBadge:
    "px-1.5 h-5 inline-flex items-center rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold uppercase tracking-wider",
  tagRow: "flex flex-wrap gap-1",
  tag: "h-5 px-1.5 inline-flex items-center rounded bg-zinc-100 text-zinc-600 text-[10px] font-medium",
  vintageBlock: "pt-2.5 border-t border-zinc-950/5",
  vintageLabel: "text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1",
  vintageChip: "h-8 px-2.5 flex items-center gap-2 rounded-md border border-zinc-950/10 bg-zinc-50",
  vintageYear: "text-[13px] font-medium tabular-nums text-zinc-700",
  vintagePinned: "ml-auto font-mono text-[9.5px] uppercase tracking-wider text-zinc-400",
  backLink: "flex items-center gap-1.5 text-[12px] text-[#1F3F8F] hover:underline",
  backIcon: "size-3.5",

  // ── mode hint pill (Panel 4, docked bottom-center) ──────────────────────────────
  hintPill:
    "h-9 px-3 rounded-lg border border-zinc-950/10 bg-white/95 shadow-sm flex items-center gap-2 text-[12px] text-zinc-600 pointer-events-auto",
  hintIcon: "size-4 text-zinc-400 shrink-0",
  hintSep: "text-zinc-300",
  hintCaveat: "text-zinc-400",
};
