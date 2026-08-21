// Visual vocabulary matches ReportRouteList.theme.js's own navy/mono pill styling (design push
// #2, 2026-08-06) — same reference file (`TransportNY Design System/dms_design_system_v2/pages/
// npmrds-report.js`'s `qcPill`/`qcIconPill`/`qcPop` functions), not a separate look invented for
// this row.
export const quickControlsTheme = {
  // Outer row: pins the reorder group to the left edge while the pill cluster
  // (a `flex-1` sibling, still internally `justify-end`) stays right-justified —
  // two independently-aligned groups sharing one row, not one `justify-end` list
  // where "first in DOM" only means "leftmost within the packed-right cluster."
  rowWrapper: 'w-full flex items-center gap-1.5',
  // Layout controls (Move Up/Down + Width) — deliberately outside `wrapper` below
  // so the row-fit measurement there only ever sees the DATA pill cluster's own
  // available width, not this group's. Named `reorderGroup` for its original
  // members; Width joined it later (report-authoring-ux-overhaul.md Tier 5,
  // 2026-08-20) per Ryan's own call that both layout controls read as one group.
  reorderGroup: 'flex items-center gap-1 shrink-0',
  reorderBtn: 'size-6 shrink-0 rounded-[4px] border border-zinc-950/12 bg-white hover:border-[#37576B] flex items-center justify-center text-slate-600',

  wrapper: 'flex-1 min-w-0 flex items-center justify-end gap-1.5 flex-nowrap overflow-hidden',

  // Pills — the row's own trigger buttons. `pillDefault` is the plain/unset look; `pillStrong`
  // flags an attention-worthy state (no routes assigned yet, difference mode active).
  pillDefault: 'h-6 max-w-[150px] px-2 inline-flex items-center rounded-[4px] border border-zinc-950/12 bg-white hover:border-[#37576B] font-mono text-[10px] uppercase tracking-wider text-slate-600 truncate shrink-0 whitespace-nowrap',
  pillStrong: 'h-6 max-w-[150px] px-2 inline-flex items-center rounded-[4px] border border-[#37576B] bg-[#37576B]/8 font-mono text-[10px] uppercase tracking-wider text-[#1f3450] truncate shrink-0 whitespace-nowrap',
  morePill: 'size-6 shrink-0 rounded-[4px] border border-zinc-950/12 bg-white hover:border-[#37576B] flex items-center justify-center text-slate-600',

  // Popover — one shared body shape reused by every pill's own popup and the "⋯" combined one.
  popBody: 'w-[240px] max-h-[70vh] overflow-y-auto bg-white border border-zinc-950/10 rounded-[8px] shadow-lg p-2.5 space-y-2.5',
  popSection: 'space-y-1',
  popSectionLabel: 'font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500',
  popGroupLabel: 'font-mono text-[8.5px] uppercase tracking-[0.16em] text-slate-400 pt-1',
  popEmpty: 'font-proxima text-[11.5px] text-slate-400 italic',
  popNote: 'font-proxima text-[11px] leading-[1.4] text-slate-500',
  popWarning: 'rounded-[4px] px-2 py-1.5 font-proxima text-[11px] leading-[1.4] bg-[#FACC15]/12 border border-[#CA8A04]/25 text-[#8a5f03]',

  popRouteList: 'space-y-0.5 max-h-[180px] overflow-y-auto',
  popRouteRow: 'w-full flex items-center gap-2 px-1.5 py-1 rounded-[4px] border border-transparent hover:bg-slate-50 text-left',
  popRouteRowOn: 'w-full flex items-center gap-2 px-1.5 py-1 rounded-[4px] border border-[#1F3F8F]/25 bg-[#1F3F8F]/8 text-left',
  popRouteCheck: 'size-3.5 shrink-0 rounded-[3px] border border-zinc-950/25 bg-white flex items-center justify-center',
  popRouteCheckOn: 'size-3.5 shrink-0 rounded-[3px] bg-[#1F3F8F] text-white flex items-center justify-center',
  popRouteDot: 'size-2.5 rounded-full shrink-0',
  popRouteName: 'flex-1 min-w-0 truncate font-proxima text-[12px] text-slate-700',
  popRouteMeta: 'shrink-0 font-mono text-[9px] uppercase tracking-wider text-slate-400',

  popMeasureList: 'max-h-[150px] overflow-y-auto',
  popMeasureItem: 'w-full text-left px-1.5 py-1 rounded-[4px] font-proxima text-[12px] text-slate-700 hover:bg-slate-50',
  popMeasureItemOn: 'w-full text-left px-1.5 py-1 rounded-[4px] font-proxima text-[12px] font-medium text-[#16307A] bg-[#1F3F8F]/8',

  popPillRow: 'flex flex-wrap items-center gap-1',
  pill: 'h-5 px-1.5 rounded border border-zinc-950/12 bg-slate-100 text-slate-600 font-mono text-[10px] hover:bg-slate-200',
  pillOn: 'h-5 px-1.5 rounded border border-[#1F3F8F] bg-[#1F3F8F]/10 text-[#16307A] font-mono text-[10px]',
  // Tier 5E (2026-08-20): an option that's structurally unavailable right now (e.g.
  // Difference mode below 2 routes) — visible so it stays discoverable, not just
  // hidden, but not interactive.
  pillDisabled: 'h-5 px-1.5 rounded border border-zinc-950/8 bg-slate-50 text-slate-300 font-mono text-[10px] cursor-not-allowed',
  dayOn: 'w-6 h-5 rounded border border-[#1F3F8F]/40 bg-[#1F3F8F]/10 text-[#16307A] font-mono text-[10px]',
  dayOff: 'w-6 h-5 rounded border border-zinc-950/12 bg-slate-100 text-slate-400 font-mono text-[10px]',
};
