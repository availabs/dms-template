// ReportPageHeader — the report canvas's page-header card (npmrds-report.html):
// kicker+meta → h1+purpose → action stack. Local-default theme,
// same convention as ReportRouteList: no site theme override exists today, so this
// file is the sole source of truth — see reportRouteListTheme for precedent.
export const reportPageHeaderTheme = {
  wrapper: "rounded-[8px] border border-zinc-950/10 bg-white shadow-sm px-6 py-6",

  // ── backlink to the reports landing page (same vocabulary as routecreation's own
  // "All routes" backlink — font-mono uppercase kicker-style label, brand-blue link color) ──
  backLink: "inline-flex items-center gap-1.5 mb-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#1F3F8F] hover:underline",
  backIcon: "size-3",

  // ── kicker row: label · rule · meta · published/draft pill ──
  kickerRow: "flex items-center gap-3 mb-2 flex-wrap",
  kickerLabel: "font-mono text-[10.5px] uppercase tracking-[0.2em] text-[#CA8A04]",
  kickerRule: "h-px w-10 bg-[#CA8A04]/50 shrink-0",
  kickerMeta: "font-mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500",
  statusPillPublished: "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border border-[#10B981]/30 bg-[#10B981]/10 font-mono text-[10px] uppercase tracking-[0.16em] text-[#065F46]",
  statusDotPublished: "size-1.5 rounded-full bg-[#10B981]",
  statusPillDraft: "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border border-zinc-950/15 bg-slate-100 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500",
  statusDotDraft: "size-1.5 rounded-full bg-slate-400",

  // ── title row: h1+purpose (left) · action stack (right) ──
  titleRow: "flex items-end justify-between gap-6 flex-wrap",
  titleCol: "flex-1 min-w-[360px] max-w-[780px]",
  h1: "font-display font-semibold text-[38px] leading-[1.05] tracking-tight uppercase text-[#0F1722]",
  h1Dot: "text-[#CA8A04]",
  purpose: "font-proxima text-[14.5px] leading-[1.65] text-slate-700 mt-3",

  actionCol: "flex flex-col items-start gap-3 shrink-0",
  actionRow: "flex items-center gap-2 flex-wrap justify-end",
  actionIcon: "size-4 text-[#37576B]",
  actionLabel: "font-display uppercase text-[12.5px] tracking-wide",
  // Inline tag editor next to Done (2026-09-01, Workstream D) — right-aligned, wraps under the
  // action buttons naturally rather than a hard width cap.
  tagsRow: "w-full flex justify-end",
  // TagsEditor theme override, matched to this header's own vocabulary instead of the shared
  // component's generic blue-chip default (which visibly clashed with this design system — caught
  // live 2026-09-01): label reuses inlineFieldLabel's look, chips reuse routePill's look, the
  // free-text input reuses inlineInput's dashed-underline look.
  tagsEditorWrapperInline: "flex items-center flex-wrap gap-1.5",
  tagsEditorLabel: "font-mono text-[9px] uppercase tracking-[0.16em] text-slate-400 mr-1",
  tagsEditorChips: "flex flex-wrap items-center gap-1.5 justify-end",
  tagsEditorChip: "inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] border border-zinc-950/10 bg-slate-50 font-mono text-[10.5px] text-slate-700",
  tagsEditorChipRemove: "size-3 cursor-pointer text-slate-400 hover:text-[#1F3F8F]",
  tagsEditorSuggestionChip: "inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] border border-dashed border-slate-300 font-mono text-[10.5px] text-slate-400 hover:border-[#1F3F8F] hover:text-[#1F3F8F] cursor-pointer",
  tagsEditorInput: "bg-transparent border-b border-dashed border-slate-300 focus:border-[#1F3F8F] focus:outline-none text-[10.5px] font-mono placeholder:text-slate-400 py-0.5 min-w-[6rem]",
  tagsEditorError: "font-mono text-[10px] text-red-600 w-full text-right mt-1",

  // ── "Viewing as of" (Dynamic Reports using the Today anchor only) ──
  asOfRow: "mt-3 flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500",
  asOfLabel: "shrink-0",
  asOfInput: "font-sans normal-case tracking-normal text-[12.5px] text-[#0F1722] border border-zinc-950/15 rounded-[4px] px-2 py-1 bg-white",
  asOfReset: "normal-case tracking-normal text-[#1F3F8F] hover:underline cursor-pointer",
  asOfHint: "normal-case tracking-normal text-slate-400",

  // ── routes-in-this-report disclosure (view mode's only route list — RRL itself is edit-only) ──
  routesWrapper: "mt-3",
  routesToggle: "inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500 hover:text-[#1F3F8F] cursor-pointer",
  routesToggleIcon: "size-3",
  routesGroupList: "flex flex-col gap-2.5 mt-2",
  routeGroup: "flex flex-col gap-1",
  routeGroupName: "font-display text-[13px] font-semibold text-[#0F1722]",
  routesList: "flex flex-wrap items-center gap-1.5",
  routePill: "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border border-zinc-950/10 bg-slate-50 font-mono text-[10.5px] text-slate-700",
  routeDot: "size-1.5 rounded-full shrink-0",

  // ── shared inline-edit input look (kicker meta / purpose / freshness fields) ──
  inlineInput: "bg-transparent border-b border-dashed border-slate-300 focus:border-[#1F3F8F] focus:outline-none",
  inlineTextarea: "bg-transparent border border-dashed border-slate-300 focus:border-[#1F3F8F] focus:outline-none rounded-[4px] px-2 py-1 w-full resize-y",
  inlineFieldLabel: "font-mono text-[9px] uppercase tracking-[0.16em] text-slate-400",
};
