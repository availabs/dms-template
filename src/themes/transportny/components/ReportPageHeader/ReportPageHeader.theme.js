// ReportPageHeader — the report canvas's page-header card (npmrds-report.html):
// kicker+meta → h1+purpose → action stack → freshness footline. Local-default theme,
// same convention as ReportRouteList: no site theme override exists today, so this
// file is the sole source of truth — see reportRouteListTheme for precedent.
export const reportPageHeaderTheme = {
  wrapper: "rounded-[8px] border border-zinc-950/10 bg-white shadow-sm px-6 py-6",

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
  dataHrefRow: "flex items-center gap-2",

  // ── freshness footline ──
  freshnessWrapper: "mt-4 pt-3 border-t border-zinc-950/05 font-mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1",
  freshnessDotWrap: "text-emerald-700 inline-flex items-center gap-1.5",
  freshnessDot: "size-1.5 rounded-full bg-emerald-500",
  freshnessSep: "text-slate-300",
  freshnessValue: "text-[#0f1722]",
  freshnessEditRow: "mt-4 pt-3 border-t border-zinc-950/05 flex flex-wrap items-center gap-2",

  // ── shared inline-edit input look (kicker meta / purpose / freshness fields) ──
  inlineInput: "bg-transparent border-b border-dashed border-slate-300 focus:border-[#1F3F8F] focus:outline-none",
  inlineTextarea: "bg-transparent border border-dashed border-slate-300 focus:border-[#1F3F8F] focus:outline-none rounded-[4px] px-2 py-1 w-full resize-y",
  inlineFieldLabel: "font-mono text-[9px] uppercase tracking-[0.16em] text-slate-400",
};
