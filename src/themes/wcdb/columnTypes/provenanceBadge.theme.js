// Theme namespace for the `provenance_badge` column type.
//
// Three registers, deliberately: an automatic match is quiet ink-4 mono (it is
// the 94% of rows nobody needs to look at), a hand-touched row is a bordered
// chip (a fact worth stating), and both failure states take the on-air red —
// the station's one accent colour, spent on the rows that need a person.
export const provenanceBadgeTheme = {
  score:
    "inline-flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-[9px] " +
    "tracking-[0.10em] uppercase text-[color:var(--ink-4)] tabular-nums",
  scoreLow:
    "inline-flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-[9px] " +
    "tracking-[0.10em] uppercase text-[var(--on-air)] tabular-nums",
  scoreIcon: "size-[11px]",
  gap:
    "inline-flex items-center gap-1.5 rounded-full bg-[var(--on-air-soft)] text-[var(--on-air)] " +
    "px-2.5 py-1 font-[family-name:var(--font-mono)] text-[9px] tracking-[0.12em] uppercase font-semibold",
  byDj:
    "inline-flex items-center gap-1.5 rounded-full border border-[var(--line-3)] text-[color:var(--ink-2)] " +
    "px-2.5 py-1 font-[family-name:var(--font-mono)] text-[9px] tracking-[0.12em] uppercase",
  corrected:
    "inline-flex items-center gap-1.5 rounded-full border border-[var(--line-3)] text-[color:var(--ink-2)] " +
    "px-2.5 py-1 font-[family-name:var(--font-mono)] text-[9px] tracking-[0.12em] uppercase",
}
