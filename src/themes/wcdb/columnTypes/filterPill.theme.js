// Theme namespace for the `filter_pill` column type — the segmented control the
// admin design opens every list page with: a mono micro-caps label, the count
// beside it, the active segment marked.
//
// NAMED STYLES (added 2026-08-21). This was a flat map, which meant every
// filter on the site had to look like the admin's segmented control. The
// schedule design uses two different filter shapes in ONE card — big day tiles
// across the top, department pills below — so the shape has to be selectable
// per column. Same `options.activeStyle` + `styles[]` convention every other
// themed primitive uses; a column picks one with `pillStyle: '<name>'`, and
// `styles[0]` is what it gets if it does not.
//
// Both modes: every colour is a token, so a pill inverts with its surface.
export const filterPillTheme = {
  options: { activeStyle: 0 },
  styles: [
    {
      // "default" — the admin segmented control. Active = accent tint.
      name: "default",
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
      // The count is the point of the control — it reads as the data it is, not
      // as part of the label.
      count: "tabular-nums text-[color:var(--ink-4)]",
      countActive: "tabular-nums text-[color:var(--ink-1)]",
      icon: "size-[13px] shrink-0",
    },
    {
      // "dayTile" — the schedule design's week strip. A block, not a pill: the
      // day name at display-italic 22px with its show count under it, on the
      // card-soft tone. Active is a tint plus a ring rather than a fill,
      // because one of these seven is always selected and a filled tile that
      // large would shout.
      //
      // `items-start` + `flex-col` is what stacks the label over the count —
      // the component renders label and count as two spans, so the style
      // decides whether they sit side by side or one above the other.
      name: "dayTile",
      pill:
        "flex flex-col items-start gap-2 w-full rounded-[14px] bg-[var(--card-bg-soft)] p-4 text-left " +
        "hover:bg-[var(--bg-3)] transition-colors cursor-pointer",
      pillActive:
        "flex flex-col items-start gap-2 w-full rounded-[14px] bg-[var(--accent-soft)] ring-1 ring-[var(--line-3)] p-4 text-left " +
        "transition-colors cursor-pointer",
      label:
        "font-[family-name:var(--font-display)] italic text-[22px] leading-[1.1] tracking-[-0.03em] " +
        "text-[color:var(--ink-1)]",
      // `after:` appends the unit, so "6" reads "6 shows" without the component
      // needing to know what it is counting. A theme concern, not a data one.
      count:
        "font-[family-name:var(--font-mono)] text-[11px] tracking-[0.12em] uppercase " +
        "text-[color:var(--ink-3)] tabular-nums after:content-['_shows']",
      countActive:
        "font-[family-name:var(--font-mono)] text-[11px] tracking-[0.12em] uppercase " +
        "text-[color:var(--ink-2)] tabular-nums after:content-['_shows']",
      icon: "size-[15px] shrink-0",
    },
    {
      // "solid" — the schedule design's department row. The design is explicit
      // about why the active state is FILLED rather than tinted: "so it reads
      // as a CHOICE rather than a hover". Only one department is ever active
      // and `All` is the default, so the filled state is rare and can afford
      // to be loud.
      name: "solid",
      pill:
        "inline-flex items-center gap-2 rounded-full border border-[var(--line-2)] pl-2.5 pr-3.5 py-1.5 " +
        "font-[family-name:var(--font-mono)] text-[10px] tracking-[0.10em] uppercase " +
        "text-[color:var(--ink-2)] hover:text-[color:var(--ink-1)] hover:border-[var(--line-3)] " +
        "hover:bg-[var(--accent-soft)] transition-colors cursor-pointer whitespace-nowrap",
      pillActive:
        "inline-flex items-center gap-2 rounded-full border border-[color:var(--ink-1)] bg-[color:var(--ink-1)] " +
        "text-[color:var(--page-bg)] pl-3.5 pr-3.5 py-1.5 " +
        "font-[family-name:var(--font-mono)] text-[10px] tracking-[0.10em] uppercase font-semibold " +
        "transition-colors cursor-pointer whitespace-nowrap",
      label: "",
      // The department row does NOT show counts — the design leaves them off,
      // and ten numbers on one line is noise. A column that wants them can
      // still select `default`.
      count: "hidden",
      countActive: "hidden",
      icon: "size-[13px] shrink-0",
    },
  ],
};

export default filterPillTheme;
