// icon_link — theme tokens for an icon-only row-action link.
//
// Transcribed from admin-dashboard.html's inventory-table Actions cell (:446-449):
//   <a href="property-view.html" title="View"
//      class="size-7 rounded flex items-center justify-center
//             text-mist hover:text-skydeep hover:bg-sky/[0.08]">
//     <svg class="size-4" …/>
//   </a>
// A 28px hit target holding a 16px glyph: mist at rest so a column of them reads
// as quiet chrome beside the data, skydeep on a faint sky wash on hover — the
// same hover language as the table's own row highlight.
const C = {
  ink: '#16232C', slate: '#475A66', mist: '#8CA0AB',
  sky: '#0AA7E4', skydeep: '#0A6E99', field: '#4C9129',
  amber: '#E0940B', rose: '#CE5B4E',
};

// Mirrors theme.js's BTN_BASE, minus `cursor-pointer` (an <a> already has one) and
// the disabled: variants (a link has no disabled state — an unresolvable link
// renders as the disabled SPAN below instead).
const BTN_LINK_BASE = 'inline-flex items-center justify-center gap-2 whitespace-nowrap h-10 px-4 '
  + 'rounded-md font-prose text-[13.5px] font-semibold transition-colors '
  + 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0A6E99]/40 focus-visible:ring-offset-2';

export const iconLinkTheme = {
  button: `size-7 rounded flex items-center justify-center shrink-0 text-[${C.mist}] `
        + `hover:text-[${C.skydeep}] hover:bg-[${C.sky}]/[0.08] `
        + `focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[${C.skydeep}] transition-colors`,
  icon: 'size-4',
  // A row with no link value still reserves the same 28px box, so the action
  // column doesn't jitter between rows.
  buttonDisabled: `size-7 rounded flex items-center justify-center shrink-0 text-[${C.mist}]/40 cursor-not-allowed`,

  // Optional per-column accent, for a destructive or primary action sitting in
  // the same column group. Unset → the neutral `button` above.
  buttonColors: {
    ink:     `text-[${C.ink}] hover:text-[${C.ink}]`,
    slate:   `text-[${C.slate}] hover:text-[${C.ink}]`,
    skydeep: `text-[${C.skydeep}] hover:text-[${C.skydeep}]`,
    field:   `text-[${C.field}] hover:text-[${C.field}]`,
    amber:   `text-[${C.amber}] hover:text-[${C.amber}]`,
    rose:    `text-[${C.rose}] hover:text-[${C.rose}]`,
  },

  // ---- Labelled variants -------------------------------------------------
  // With a `linkText`, the cell stops being a bare hit-target and becomes a real
  // button — the design's "Edit record" / "Public listing" / "Back to inventory"
  // actions, which are LINKS (they navigate) and so can't be the theme's `button`
  // component. Same three treatments as `button.styles`, kept in step with it.
  // The icon shrinks to the button's own text scale.
  labelled: {
    primary:   `lb-press ${BTN_LINK_BASE} bg-[${C.skydeep}] hover:bg-[${C.ink}] border-b-[3px] border-[${C.ink}]/40 text-white`,
    secondary: `${BTN_LINK_BASE} bg-white hover:bg-[${C.paper}] border border-[${C.ink}]/15 text-[${C.ink}]`,
    ghost:     `${BTN_LINK_BASE} text-[${C.slate}] hover:text-[${C.ink}]`,
  },
  labelledDefault: 'secondary',
  labelledIcon: 'size-4 shrink-0',
  // The link text itself; the button classes carry the font, so this is layout only.
  labelText: '',
};
