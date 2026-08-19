// Theme for the `row_action` column type. Two registers, both from the design:
// `quiet` fades in on row hover (the log's Edit), `outlined` is always there
// because the row is asking for it (a gap's + Add).
export const rowActionTheme = {
  quiet:
    "justify-self-end inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 cursor-pointer " +
    "font-[family-name:var(--font-mono)] text-[9px] tracking-[0.10em] uppercase text-[color:var(--ink-4)] " +
    "opacity-0 group-hover:opacity-100 hover:text-[color:var(--ink-1)] hover:bg-[var(--accent-soft)] transition-all",
  outlined:
    "justify-self-end inline-flex items-center gap-1.5 rounded-full border border-[var(--line-3)] px-3 py-1.5 cursor-pointer " +
    "font-[family-name:var(--font-mono)] text-[9px] tracking-[0.10em] uppercase text-[color:var(--ink-2)] " +
    "hover:text-[color:var(--ink-1)] hover:bg-[var(--accent-soft)] transition-colors",
  icon: "size-3",
}
