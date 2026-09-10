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
  // Marker mode's tmc_array only appears once resolveRouteFromPoints returns (a real
  // network round-trip) - shown in the list area while that's in flight so the panel
  // doesn't look frozen/empty (2026-09-03).
  listLoading: "px-2 py-3 text-[11px] text-zinc-400 text-center",
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
  // Tags — the shared TagsEditor (routes-reports-users-mesh.md, Workstream D), not a hand-rolled
  // read-only span list: gets tagToLabel's "You"/agency-code simplification, the user-vs-agency
  // chip distinction (TagsEditor.theme.js), AND live add/remove right from this panel (same
  // `modalState.tags` the Save dialog edits), replacing what used to be a raw `user:993` string.
  // Only SIZE is overridden here to match this panel's h-5/10px chip density elsewhere — color
  // semantics (blue institutional chip vs. the slate "You" identity chip) are the shared default,
  // not a one-off palette (2026-09-02).
  tagsEditorWrapper: "pt-2.5 border-t border-zinc-950/5",
  tagsEditorLabel: "text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1",
  tagsEditorChips: "flex flex-wrap items-center gap-1",
  tagsEditorChip: "h-5 px-1.5 inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[10px]",
  tagsEditorChipRemove: "size-2.5 cursor-pointer text-blue-500 hover:text-blue-700",
  tagsEditorChipUser: "h-5 px-1.5 inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-300 text-slate-700 text-[10px] font-medium",
  tagsEditorChipUserDot: "size-1.5 rounded-full bg-slate-400",
  tagsEditorChipRemoveUser: "size-2.5 cursor-pointer text-slate-400 hover:text-slate-600",
  tagsEditorSuggestionChip: "h-5 px-1.5 inline-flex items-center rounded-full border border-dashed border-zinc-300 text-zinc-400 text-[10px] hover:border-[#1F3F8F] hover:text-[#1F3F8F] cursor-pointer",
  tagsEditorInput: "flex-1 min-w-[5rem] bg-transparent outline-none text-[10px] text-zinc-500 placeholder:text-zinc-400 py-0.5",
  tagsEditorError: "text-[10px] text-rose-600 mt-1",
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

  // ── save/update modal ────────────────────────────────────────────────────────────
  // Replaces the old inline-`style` div (no backdrop, no close-on-escape/click-outside, plain
  // unstyled inputs) with the SAME backdrop+wrapper mechanism macroview's DownloadBuilder
  // (downloadBuilder.jsx's builderBackdrop/builderWrapper/builder) already uses for a floating
  // map-plugin modal — styled per npmrds-route-creation.html § 02 ("the modal, drawn") instead
  // of macroview's own dark-header/yellow-accent skin: white header, the Panel 1 Road icon in a
  // blue-50 circle, brand blue `#1F3F8F` submit button. Same three fields the old modal had
  // (name/description/tags) — findings.md Part 4 covers why folder + start/end date stay out.
  saveModalBackdrop: "absolute inset-0 z-40 bg-zinc-950/20 pointer-events-auto",
  saveModalWrapper: "absolute inset-0 z-50 flex items-center justify-center p-4 pointer-events-none",
  saveModalCard:
    "w-full max-w-[480px] max-h-full flex flex-col rounded-[8px] border border-zinc-950/10 bg-white shadow-lg overflow-hidden pointer-events-auto",
  saveModalBody: "p-5 overflow-y-auto",
  saveModalHead: "flex items-start gap-3 pb-3 border-b border-zinc-950/05",
  saveModalIconWrap: "size-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0",
  saveModalIcon: "size-5 text-[#1F3F8F]",
  saveModalTitle: "font-display uppercase text-[16px] tracking-wide text-[#0F1722]",
  saveModalWarning: "font-proxima text-[12.5px] leading-[1.5] text-rose-700 mt-0.5",
  saveModalFields: "mt-4 space-y-3",
  saveModalFieldLabel: "font-proxima text-[13px] font-medium text-slate-700 mb-1",
  saveModalNameInput:
    "w-full h-9 px-3 rounded-[6px] border border-zinc-950/15 bg-white font-proxima text-[13.5px] text-[#0f1722] focus:outline-none focus:border-[#1F3F8F]/60",
  saveModalDescInput:
    "w-full min-h-[64px] px-3 py-2 rounded-[6px] border border-zinc-950/15 bg-white font-proxima text-[13.5px] leading-[1.55] text-slate-700 focus:outline-none focus:border-[#1F3F8F]/60 resize-none",
  saveModalFoot: "mt-5 pt-4 border-t border-zinc-950/05 flex items-center gap-2 justify-end shrink-0",
  saveModalCancelBtn:
    "h-9 px-3.5 rounded-[6px] bg-white border border-zinc-950/15 text-[#0f1722] hover:border-[#37576B] font-display uppercase text-[12.5px] tracking-wide cursor-pointer",
  saveModalSubmitBtn:
    "tny-press h-9 px-4 rounded-[6px] bg-[#1F3F8F] text-white border-b-4 border-[#16306e] font-display uppercase text-[12.5px] tracking-wide cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
};
