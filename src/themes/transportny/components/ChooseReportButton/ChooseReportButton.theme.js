// Theme for the "Choose a report" trigger. `ChooseReportButton.jsx` spreads these as its local
// defaults under `getComponentTheme(theme, 'chooseReportButton')`, so a site theme can override any
// key at `theme.chooseReportButton.<key>` — and the JSX carries no Tailwind of its own.
//
// npmrds-reports.html REVISION 3 (2026-09-02) draws this trigger as the header's SEARCH BAR
// (`#findTrigger`), not a button: a 40px bordered white field that takes the controls row's
// flexible remainder, holding the Search glyph, a resting prompt and — only while the page carries
// a `?search=` query — the query itself plus a mono "N matches · show results" run (the mockup's
// `syncTrigger`). Every class below is lifted from the mockup; the one deliberate departure is
// noted on `trigger`. The look lives HERE as named keys rather than being passed into the shared
// `Button` primitive's `className` (feedback_no_className_passthrough_to_ui_primitives).
export const chooseReportButtonTheme = {
  // The component fills whatever section it is placed in — the mockup's `flex-1`.
  wrapper: 'flex w-full min-w-0',
  // `min-w-0`, NOT the mockup's `min-w-[260px]`: a DMS band grid cannot wrap its sections the way
  // the mockup's flex row does below ~1300, so the honest equivalent of "wrap rather than
  // overflow" is "truncate the prompt, never overflow the column".
  trigger: 'flex-1 min-w-0 h-10 flex items-center gap-2.5 rounded-[6px] border border-zinc-950/15 bg-white hover:border-[#37576B] px-3.5 text-left transition-colors cursor-pointer',
  // With a live query the mockup swaps the hairline for the field's accent colour.
  triggerActive: 'flex-1 min-w-0 h-10 flex items-center gap-2.5 rounded-[6px] border border-[#37576B] bg-white px-3.5 text-left transition-colors cursor-pointer',
  triggerIcon: 'size-4 text-[#37576B] shrink-0',
  // Resting prompt ("Find a report — search N by name, road, route or description…").
  triggerLabel: 'font-proxima text-[13.5px] text-slate-500 flex-1 truncate',
  // The query itself, in ink, when the URL carries one.
  triggerQuery: 'font-proxima text-[13.5px] text-[#0F1722] flex-1 truncate',
  // "N matches · show results" — rendered only with a query (resting: nothing, the view toggle
  // took that room in revision 3).
  triggerMeta: 'font-mono text-[9.5px] uppercase tracking-[0.18em] text-[#1F3F8F] shrink-0',
};
