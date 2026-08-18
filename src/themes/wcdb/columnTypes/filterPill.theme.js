// Theme namespace for the `filter_pill` column type. The segmented control the
// admin design opens every list page with: a mono micro-caps label, the count
// beside it, the active segment filled with the accent tint.
//
// Both modes: every colour is a token, so the pill inverts with the rail.
export const filterPillTheme = {
  pill:
    "inline-flex items-center gap-2 rounded-full border border-[var(--line-2)] px-4 py-2 " +
    "font-[family-name:var(--font-mono)] text-[10px] tracking-[0.10em] uppercase " +
    "text-[color:var(--ink-3)] hover:text-[color:var(--ink-1)] hover:border-[var(--line-3)] " +
    "transition-colors cursor-pointer whitespace-nowrap",
  pillActive:
    "inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] border border-[var(--line-3)] px-4 py-2 " +
    "font-[family-name:var(--font-mono)] text-[10px] tracking-[0.10em] uppercase font-semibold " +
    "text-[color:var(--ink-1)] transition-colors cursor-pointer whitespace-nowrap",
  label: "",
  // The count is the point of the control — it reads as the data it is, not as
  // part of the label.
  count: "tabular-nums text-[color:var(--ink-4)]",
  countActive: "tabular-nums text-[color:var(--ink-1)]",
}
