// Local-default fallback theme (DMS package convention: spread this first, then override with
// whatever the caller's own ThemeContext theme supplies via getComponentTheme). Byte-identical to
// ReportRouteList.theme.js's existing tagsEditor* keys so swapping ReportTagsEditor for the shared
// TagsEditor here changes zero pixels; SaveRouteModal (no themed `tagsEditor*` keys of its own,
// plain hardcoded Tailwind throughout) gets this same look for free instead of its previous
// unstyled/differently-styled free-text field.
export const tagsEditorTheme = {
  tagsEditorWrapper: 'pt-1.5 border-t border-zinc-950/06',
  // `inline` mode (2026-09-01, ReportPageHeader's inline-next-to-Done placement): label sits
  // beside the chips in one row instead of stacked above them, no top divider (the header has its
  // own separate divider rhythm already, via dataHrefRow).
  tagsEditorWrapperInline: 'flex items-center flex-wrap',
  tagsEditorLabel: 'font-display uppercase text-[11px] tracking-[0.16em] text-slate-600 mb-1',
  tagsEditorChips: 'flex flex-wrap items-center gap-1.5',
  tagsEditorChip: 'flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] text-blue-800',
  tagsEditorChipRemove: 'size-3 cursor-pointer text-blue-500 hover:text-blue-700',
  // `user:` tags (2026-09-02): a distinct, quieter treatment from the institutional blue chip
  // every agency:/county:/region:/free-text tag shares — a small dot + "You" (tagToLabel already
  // simplifies the text; this is the visual half of "tell user apart from agency at a glance").
  tagsEditorChipUser: 'flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-700',
  tagsEditorChipUserDot: 'size-1.5 rounded-full bg-slate-400',
  tagsEditorChipRemoveUser: 'size-3 cursor-pointer text-slate-400 hover:text-slate-600',
  tagsEditorInput: 'flex-1 min-w-[7rem] bg-transparent outline-none text-[11px] font-proxima placeholder:text-slate-400 py-0.5',
  // New keys (2026-09-01, Workstream D): one-click "add my own tag" suggestion chips, and an
  // inline rejection message when a user tries to commit an agency tag they're not a member of.
  tagsEditorSuggestionChip: 'flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[11px] text-slate-500 hover:border-blue-400 hover:text-blue-700 cursor-pointer',
  tagsEditorError: 'text-[11px] text-red-600 mt-1',
};
