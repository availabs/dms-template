// SaveAsReportModal — the "Save as…" dialog launched from ReportPageHeader's action row
// (report-save-as-copy.md). Local-default theme, same convention as ReportPageHeader/
// ReportRouteList: no site theme override exists today, so this file is the sole source of truth.
// Vocabulary deliberately matches reportPageHeaderTheme (mono uppercase kickers, Oswald display
// headings, the #1F3F8F brand blue) rather than the shared PickerModal chrome — this is a small
// form, not a browse/search surface.
export const saveAsReportModalTheme = {
  backdrop: "fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4",
  modal: "w-full max-w-[520px] max-h-[88vh] overflow-y-auto rounded-[8px] border border-zinc-950/10 bg-white shadow-xl",

  header: "px-5 pt-5 pb-3",
  headerTitle: "font-display font-semibold text-[19px] leading-tight uppercase tracking-tight text-[#0F1722]",
  headerSub: "font-proxima text-[13px] leading-[1.6] text-slate-600 mt-1.5",

  body: "px-5 pb-1 flex flex-col gap-4",
  fieldLabel: "font-mono text-[9.5px] uppercase tracking-[0.16em] text-slate-400 mb-1.5 block",
  textInput: "w-full border border-zinc-950/15 rounded-[4px] px-2.5 py-1.5 text-[14px] text-[#0F1722] focus:border-[#1F3F8F] focus:outline-none",

  // ── report-kind choice: two selectable cards, the source's own kind preselected ──
  kindList: "flex flex-col gap-2",
  kindOption: "text-left w-full border border-zinc-950/15 rounded-[6px] px-3 py-2.5 hover:border-[#1F3F8F] cursor-pointer",
  kindOptionSelected: "text-left w-full border-2 border-[#1F3F8F] bg-[#1F3F8F]/[0.04] rounded-[6px] px-3 py-2.5 cursor-pointer",
  kindOptionDisabled: "text-left w-full border border-zinc-950/10 rounded-[6px] px-3 py-2.5 opacity-50 cursor-not-allowed",
  kindName: "font-display text-[13.5px] font-semibold text-[#0F1722]",
  kindDesc: "font-proxima text-[12px] leading-[1.5] text-slate-600 mt-0.5",
  kindBadge: "ml-2 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-400",

  // ── tag preview: makes the user/agency scoping rule visible instead of magic ──
  tagPreview: "flex flex-wrap items-center gap-1.5",
  tagChip: "inline-flex items-center px-2 py-0.5 rounded-[4px] border border-zinc-950/10 bg-slate-50 font-mono text-[10.5px] text-slate-700",
  tagChipNew: "inline-flex items-center px-2 py-0.5 rounded-[4px] border border-[#10B981]/30 bg-[#10B981]/10 font-mono text-[10.5px] text-[#065F46]",
  tagChipDropped: "inline-flex items-center px-2 py-0.5 rounded-[4px] border border-dashed border-slate-300 font-mono text-[10.5px] text-slate-400 line-through",
  tagNote: "font-proxima text-[11.5px] leading-[1.5] text-slate-500 mt-1.5",

  footer: "flex items-center justify-end gap-2 px-5 py-4 mt-2 border-t border-slate-200",
  error: "font-mono text-[11px] text-red-600 mr-auto",
  hint: "font-mono text-[10.5px] text-slate-400 mr-auto",
  cancelBtn: "px-3 py-1.5 rounded-[4px] font-display uppercase text-[12.5px] tracking-wide text-slate-600 hover:text-[#0F1722] cursor-pointer",
  saveBtn: "px-4 py-1.5 rounded-[4px] bg-[#1F3F8F] text-white font-display uppercase text-[12.5px] tracking-wide hover:bg-[#17306E] cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed",
};
