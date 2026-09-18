// Theme for the WCDB ShowBlockNav section — the strip above the spins list
// that names the block being shown (the show, or an automation slice) and
// steps to the previous / next one. Tokens only; it follows the mode.
//
// Type ramp is the list's: `groupTitle`-scale display italic for the show,
// mono micro-caps for the eyebrow and meta, `btnGhost` geometry for the two
// arrows so they read as the same family as `LISTEN LIVE` / `FULL SCHEDULE`.
export const showBlockNavTheme = {
  wrapper: "w-full min-w-0 flex items-center gap-4 px-6 pt-1 pb-4 max-md:px-4 max-md:gap-3",

  // The centre column — eyebrow / title / meta stacked, truncating rather
  // than pushing the arrows off the row.
  body: "flex-1 min-w-0 flex flex-col gap-1",
  // Below `md` the row wraps instead of truncating the time range — the range
  // is the one line here a phone reader actually needs.
  eyebrowRow: "flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0",
  eyebrow: "font-[family-name:var(--font-mono)] text-[10px] tracking-[0.12em] uppercase text-[color:var(--ink-4)] whitespace-nowrap",
  range: "font-[family-name:var(--font-mono)] text-[10px] tracking-[0.10em] uppercase text-[color:var(--ink-3)] truncate max-md:whitespace-normal max-md:overflow-visible",
  title: "font-[family-name:var(--font-display)] italic text-[26px] max-md:text-[22px] leading-[1.05] tracking-[-0.03em] text-[color:var(--ink-1)] truncate",
  meta: "font-[family-name:var(--font-mono)] text-[10px] tracking-[0.08em] uppercase text-[color:var(--ink-3)] truncate",

  // The live pill — the station's red, same as `now_indicator`.
  livePill:
    "inline-flex items-center gap-1.5 rounded-full px-2 py-[2px] " +
    "font-[family-name:var(--font-mono)] text-[9px] tracking-[0.08em] uppercase whitespace-nowrap " +
    "bg-[var(--on-air-soft)] text-[color:var(--on-air)] border border-[rgba(255,59,47,0.3)]",
  liveDot: "size-[6px] rounded-full bg-[var(--on-air)] animate-[wcdb-pulse-dot_1.4s_ease-in-out_infinite]",

  // The two arrows. Round ghost buttons; the disabled one stays in the row so
  // the title never jumps sideways when Next comes and goes.
  arrow:
    "shrink-0 inline-flex items-center justify-center size-[40px] rounded-full border border-[var(--line-2)] " +
    "text-[color:var(--ink-2)] hover:text-[color:var(--ink-1)] hover:border-[var(--line-3)] " +
    "transition-colors cursor-pointer",
  arrowDisabled:
    "shrink-0 inline-flex items-center justify-center size-[40px] rounded-full border border-[var(--line-1)] " +
    "text-[color:var(--ink-4)] opacity-50 cursor-not-allowed",
  arrowIcon: "size-[18px]",

  // `NOW →` — chrome, not a control, in the `metaLink` voice. Only shown when
  // the block on screen is not the one on air.
  nowLink:
    "shrink-0 inline-flex items-center gap-1 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.10em] uppercase " +
    "text-[color:var(--ink-3)] hover:text-[color:var(--ink-1)] border-b border-transparent hover:border-[var(--line-3)] " +
    "pb-0.5 transition-colors cursor-pointer max-md:hidden",

  // What the strip says while the schedule is still loading.
  pending: "font-[family-name:var(--font-mono)] text-[10px] tracking-[0.10em] uppercase text-[color:var(--ink-4)]",
}
