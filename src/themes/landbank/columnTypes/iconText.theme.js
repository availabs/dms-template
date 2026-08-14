// icon_text — theme tokens for a "leading glyph + value" cell.
//
// Transcribed from admin-dashboard.html's "Needs attention" line (:398-401):
//   <p class="font-prose text-[12px] text-slate mt-1.5 flex items-center gap-1.5">
//     <svg class="size-3.5 shrink-0 text-amberdeep" …/>
//     6 title problems · 6 tabled by board · 15 parcels held > 8 years
//   </p>
// The same shape recurs across the design set (the components.html field-error
// line, the pattern callouts), which is what makes it a type rather than a
// one-off: only the glyph, its hue and the sentence change.
const C = {
  ink: '#16232C', slate: '#475A66', mist: '#8CA0AB',
  sky: '#0AA7E4', skydeep: '#0A6E99', field: '#4C9129', forest: '#33641B',
  amber: '#E0940B', amberdeep: '#8F5E08', violet: '#8B6FC7',
  rose: '#CE5B4E', rosedeep: '#B03E31', steel: '#8195A1',
};

export const iconTextTheme = {
  // `flex w-full` (not inline-flex) for the same reason status_dot uses it: an
  // inline-flex box sizes to its content, so a long sentence overruns the cell
  // instead of wrapping inside it.
  wrapper: 'flex w-full items-center gap-1.5 min-w-0',
  // The glyph never shrinks — with `min-w-0` on the label the sentence wraps first.
  icon: 'shrink-0',
  // Typography is the CELL's job (`valueFontStyle`), exactly as for a plain text
  // cell: this key carries layout only, so a token swap can't be silently
  // overridden by a font spec baked in here.
  label: 'flex-1 min-w-0',

  // `iconSize` keys → a Tailwind size class. Authors pick a name, not a number,
  // so glyphs stay on the design set's scale.
  iconSizes: {
    xs: 'size-3',
    sm: 'size-3.5',   // the design set's inline-with-12px-prose size
    md: 'size-4',
    lg: 'size-5',
    xl: 'size-6',
  },
  iconSizeDefault: 'size-3.5',

  // `iconColor` keys → a text color. Brand names, not hex, so a palette change
  // lands in one place.
  iconColors: {
    ink:       `text-[${C.ink}]`,
    slate:     `text-[${C.slate}]`,
    mist:      `text-[${C.mist}]`,
    sky:       `text-[${C.sky}]`,
    skydeep:   `text-[${C.skydeep}]`,
    field:     `text-[${C.field}]`,
    forest:    `text-[${C.forest}]`,
    amber:     `text-[${C.amber}]`,
    amberdeep: `text-[${C.amberdeep}]`,
    violet:    `text-[${C.violet}]`,
    rose:      `text-[${C.rose}]`,
    rosedeep:  `text-[${C.rosedeep}]`,
    steel:     `text-[${C.steel}]`,
  },
  // Unset → the glyph inherits the cell's own text color (a neutral default that
  // never fights the chosen valueFontStyle).
  iconColorDefault: '',
};
