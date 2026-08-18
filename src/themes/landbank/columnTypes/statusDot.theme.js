// status_dot — theme tokens for the "colored dot + label" legend row.
//
// Transcribed from admin-dashboard.html's composition legend (§"Held by status"):
//   <div class="flex items-center gap-2">
//     <span class="size-2.5 rounded-full bg-field shrink-0"></span>
//     <span class="flex-1 text-slate">For Sale</span>
//     ...
// The count is the Card's SECOND cell (right-aligned metaMD), so this type renders
// only the dot + label. Pairs with `status_pill` — same `pillColors`-style value map,
// but an unfilled row: a dot reads as a chart legend, a pill reads as a state badge.
const C = {
  ink: '#16232C', slate: '#475A66',
  sky: '#0AA7E4', field: '#4C9129',
  amber: '#E0940B', violet: '#8B6FC7', rose: '#CE5B4E', steel: '#8195A1',
};

export const statusDotTheme = {
  // `flex w-full` (not inline-flex): an inline-flex box sizes to its content, so a
  // long label overruns the cell and `truncate` never engages — the count in the
  // next cell ends up sitting under it. Full-width + a flex-1/min-w-0 label gives
  // the ellipsis a constrained basis, and mirrors the mockup's
  // `flex items-center gap-2` row with a `flex-1` label.
  wrapper: 'flex w-full items-center gap-2 min-w-0',
  dot: 'size-2.5 rounded-full shrink-0',
  label: 'flex-1 min-w-0 font-prose text-[12.5px] leading-[1.4] truncate',
  labelColor: `text-[${C.slate}]`,
  // Fallback dot when a value isn't in the map below.
  dotDefault: `bg-[${C.steel}]`,

  // Raw ACLB `property_status` values → dot color. Keyed on the same vocabulary the
  // pills use (see theme.pill.styles), collapsed onto the mockup's six legend hues:
  // in-process statuses share steel, on-hold statuses share rose.
  dotColorByValue: {
    'For Sale':             `bg-[${C.field}]`,
    'ACLB Project':         `bg-[${C.sky}]`,
    'Sale Pending':         `bg-[${C.amber}]`,
    'CoDev':                `bg-[${C.violet}]`,
    'Processing':           `bg-[${C.steel}]`,
    'Under Option':         `bg-[${C.steel}]`,
    'Application to Board': `bg-[${C.steel}]`,
    'Title Problem':        `bg-[${C.rose}]`,
    'Tabled':               `bg-[${C.rose}]`,
    'Foreclosure Vacated':  `bg-[${C.rose}]`,
    'Sold':                 `bg-[${C.ink}]`,
  },
};
