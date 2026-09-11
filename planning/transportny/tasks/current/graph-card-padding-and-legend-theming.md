# Graph-card padding + legend quality pass (Phase 5)

**Project:** TransportNY · **Topic:** themes · **Status:** **LEGEND VALUES SET + live-verified and
owner-reviewed 2026-09-11.** The submodule half's pass 1 and pass 2 items 1-2 are DONE. This site's
**legend** token values are authored and rendering; the **tooltip** and **padding** values are still
unset, pending submodule items 3 and 4. · **Started:** 2026-09-09

### What is authored on this site now (`themev2.js`, the `avlGraph` block)

| token | value | note |
|---|---|---|
| `legend` | `gap-4 font-mono text-[10.5px] uppercase tracking-wider text-slate-500` | was authored years ago as DEAD scaffolding and went live the moment the token layer was wired. Its original value led with `flex items-center`, which **broke the gradient legend** — see the submodule file's "Two bugs". Layout is component-owned; a legend token must carry **no display/alignment class**. |
| `legendSwatch` | `h-0.5 w-4 mr-2` | a thin rule rather than a block swatch, as originally authored. The token REPLACES `w-4 h-4 rounded mr-1`, so it has to carry its own gap. |
| `legendTitle` | `font-mono text-[9.5px] uppercase tracking-wider text-slate-400 mb-0.5` | the caption above a gradient ramp — deliberately quieter than the numerals it labels. |
| `resolveLegendUnit` | `components/MeasurePicker/resolveLegendUnit.js` | optional hook read by the library; supplies the automatic unit. `units` added to all 11 measures in `vocabulary.json`. |

`legendLabel`, `legendTick` and `legendRamp` are **available and intentionally unset** — gradient
ticks and the ramp keep their historical look.

**The design system's "chip treatment" was NOT adopted.** The earlier instruction to use it rather
than the older mono/uppercase values is **superseded**: the values above were reviewed on the live
client and accepted as-is.

> **Read first:** the ▶ START HERE block in
> [`src/dms/planning/tasks/current/avlgraph-legend-and-padding-theming.md`](../../../../src/dms/planning/tasks/current/avlgraph-legend-and-padding-theming.md)
> — current state, exact next action, and the four constraints (chiefly: core `avlGraphTheme`
> defaults must stay byte-identical, because that is the only thing protecting MitigateNY's 7,415
> legend-rendering graphs).
>
> **This file's remaining work** is step 3 of "Next steps" below: set transportny's legend + tooltip
> values in `themev2.js`, then **padding last** — and padding goes on the report sections'
> `display.padding`, **not** on `graph.styles[0]`, which MAP-21 (4 graphs), tsmo2 (368), sitemgmt (6)
> and `landing` all render with.

## Objective

Phase 5 of `npmrds-reports-routes-feedback-triage.md` ("open-ended graph/section polish, Item 4
remainder") — the two bounded pieces:

- General graph-card padding: still enough to avoid clipping unpredictable content, but tighter than
  today's default.
- Legend implementation/design quality pass, especially GridGraph.

(The third Phase 5 bullet — migrating titles from graph-native to section-level everywhere — is
explicit backlog, deferred by Ryan 2026-09-04, not touched by this file.)

The actual token-contract work (extending `theme.avlGraph.chartDefaults.legend`, fixing
`Legend.jsx`) lives in the `@availabs/dms` submodule and is tracked in its own task file:
**`src/dms/planning/tasks/current/avlgraph-legend-and-padding-theming.md`** — read that first for the
full grounding (exact files/lines, the concrete clipping bug, the proposed token shape). This file
tracks the transportny-side half: this site's own token *values*, and live-verification against real
NPMRDS report pages.

## Grounding (2026-09-09)

Live-checked on `reports/snapshot` (real route `2216791`, "Route 5 Part") at `www.localhost:5173`:

- **Padding**: `GraphComponent.jsx`'s outer wrapper applies `theme.avlGraph.styles[activeStyle].padding`
  — transportny's own value in `themev2.js` is `"p-4"` (16px), **identical to the core default** — the
  brand theme was never actually tuned tighter, despite this being an explicit ask. ~~Sits inside the
  generic per-section grid-cell gutter (`sectionArray.defaultPaddingStep = "3"` = 12px) — two stacked
  paddings today.~~ **Wrong, corrected 2026-09-10:** that gutter is on the *outer* box, outside the
  card chrome that draws the border/radius/bg (`sectionArray.jsx:100-106`), so it's the space
  *between* cards. `p-4` is the only padding inside a card. And because a rounded chrome box gets
  `overflow-hidden` (`sectionArray.jsx:126`), that 16px is currently the accidental cover the
  overflowing legend depends on — **tightening it before the legend fix makes the clip worse.**
  DOM-measured on the real GridGraph section ("Average Speed by TMC by 5-Minute Epoch"): card left
  edge → SVG left edge = 17px, card right edge → SVG right edge = 17px (roughly matches the
  theoretical 16px `p-4`, confirms the wrapper is real and live, not dead code).
- **Legend clipping — a real bug, not a style nitpick.** Directly zoom-confirmed (not just visually
  eyeballed) on 3 of this template's graphs: "Average Speed" (per-TMC bar), "Daily Average Speed by
  Month" (bar), and "Average Speed by TMC by 5-Minute Epoch" (the actual GridGraph) — each one's
  gradient legend has its rightmost tick label sitting flush against the card's own right edge. Four
  more on the same page ("Avg. Hours of Delay," "Monthly Hours of Delay by Month," "Average Speed by
  Day of Week," "Total Hours of Delay by Day of Week") render the visually identical legend widget and
  are inferred to share the same defect since they go through the identical `Legend.jsx` component and
  CSS — **not individually zoom-verified**, worth a quick confirm during implementation rather than
  assumed. No unit (`mph`, hours) is ever appended to a tick value on any of them.
- **Not affected, corrected from an earlier draft of this file**: the Route Map's own legend overlay
  ("Legend / 1 LAYER" + a `VALUE` label) looked visually similar but is a different component entirely
  (`gis_dataset/pages/Map/Layer2.jsx`'s `LegendContainer`, themed via `mapTheme.legend.*`) — confirmed
  by reading the code, not assumed. See the submodule task file for detail; out of scope for this fix.

## Proposed values, this site

Once the submodule task lands the token contract, transportny's own `themev2.js` values (transportny
has exactly one `avlGraph` style, named `"default"`, index 0, pinned via `options: {activeStyle: 0}`
— no dark-mode variant to also update):

**Legend class strings — replace the authored values, don't revive them verbatim.** `graph.styles[0]`
already carries `legend: "flex items-center gap-4 font-mono text-[10.5px] uppercase tracking-wider
text-slate-500"` and `legendSwatch: "h-0.5 w-4"` (both dead — never read by any render code). The
design system's report mockup was later updated to converge on `Legend.jsx`'s actual render
(`npmrds-report.js:361` — "a 16-px rounded swatch with a truncating label"), so the drawn target is
*different and newer* than those authored values. Set:

- `legend`: `"flex flex-wrap items-center gap-x-4 gap-y-1.5"` — the mockup's chip row
  (`npmrds-report.html:697-699`).
- `legendSwatch`: `"w-4 h-4 rounded"` + a hairline inset ring (the design system's own rule: swatches
  at small sizes "need .55 and a hairline border to be visible at all", `patterns.html:733`).
- `legendLabel`: `"font-proxima text-[12px] text-slate-700"` — sentence case, not the old uppercase mono.
- `legendTick`: `"font-mono text-[10.5px] text-slate-500 tabular-nums"` — the gradient tick labels;
  `tabular-nums` stops the digits jittering between ticks.
- `legendRamp`: `"rounded-[3px] ring-1 ring-inset ring-zinc-950/10"`.

**Layer B (`chartDefaults.legend`)** — the corrected flat keys, not the old nested `scale` object
(which collides with the d3 scale every graph wrapper injects; see the submodule task's correction 1):
`rampThickness: 6`, `rampLength` left at the core default so it resolves as `min(value, 100%)`,
`tickCount: 5` (3 for a narrow card if clause 5 gets built). **No `endCapMargin`** (the anchoring fix
replaces it) and **no `unit`** — units belong in the measure's own `valueFormat`, which is already
wired end-to-end.

**Padding — CHANGED 2026-09-10: do NOT set it on `graph.styles[0]`.** Measured: no non-report graph
sets `activeStyle`, so `styles[0]` is what MAP-21 (`/map_21`, 4 graphs), tsmo2 (368), sitemgmt (6) and
`landing` all render with — ~380 real graphs Ryan explicitly doesn't want regressed. Since a chart
setting is useful even with its UI deferred (Ryan 2026-09-10), **padding becomes a per-section
setting** instead: `GraphComponent` reads `graphFormat.padding || theme.padding`, report sections set
`display.padding`, `styles[0].padding` stays `"p-4"`. Unset ⇒ today's value ⇒ zero change off-report.
The value report sections get is the asymmetric one below.

~~**Padding, last:** `graph.styles[0].padding`: `"p-4"` → **`"px-3 pt-3 pb-2"`**, not a uniform `p-3`.~~
**Revised: that string is right, but it goes on the report sections' own `display.padding`, not the
shared style.**
The design system's graph-card contract clause 4 spends this asymmetrically (`px-4 pt-4` on the plot,
`px-4 pb-3` under the legend, `npmrds-report.html:50` + `:689,697`) so the card reads tighter at the
bottom where the attribution line follows — and since `padding` is a free-form class string, the
asymmetry needs no code at all. Live-verify no clipping on every graph type before calling it final
(Map/Route Compare/InfoBox render very differently from Line/Bar/GridGraph and weren't part of the
grounding pass).

**Note on the ramp, no change requested:** `seqSpeedPalette` is labelled sequential but is
red→amber→pale→green. Read as a sequential ramp it's a rainbow; read as what it actually is — two hues
either side of a pale midpoint, with the design system's own end-cap labels "slowest"/"freeflow" — it's
a *diverging* ramp over a measure with a genuinely meaningful middle. That's correct, and it's a
domain convention nobody should relitigate. Recording it so a future palette pass doesn't "fix" it.

## Design artifact

**https://claude.ai/code/artifact/8adeb3e1-a319-4ba2-9f4e-6a4580b72bf8** ("Report Graph Punch List",
rewritten 2026-09-10) — the current one and the right entry point. Nine punch-list items written as
**See → Why → After** in plain language, ordered by how visible they are on a report page, with a
glossary up front and the code contract demoted to a short section. Rewritten after Ryan's feedback
that the first version was too vague and jargon-heavy. Superseded framings (same URL's first version
"Graph Chrome Tokens"; and `9ffcc86a-768e-4fef-9f14-f9abeb76d545` "AVL Graph Skins") — don't send
anyone to those.

## Decided by Ryan, 2026-09-10 (full list in the submodule task file)

Affecting this file specifically:

- **Tooltip is IN** — so transportny's dead `tooltip` key
  (`"rounded-[6px] bg-[#0F1722] text-white text-[12px] px-2.5 py-1.5 shadow-lg font-proxima"`,
  `themev2.js:1986`) gets wired and, like the legend keys, checked against the design system's drawing
  before being switched on as-is. Add `tabular-nums` for the value column. **This one stays on
  `styles[0]`, so it DOES reach MAP-21 / tsmo2** — it replaces the generic white-box-with-black-shadow
  those pages get today, so it should read as an improvement, but **browser-verify MAP-21 `/map_21`
  and a tsmo2 page before calling it done.** Don't assume.
- **Legend styling can't regress any real non-report page *within TransportNY*** — measured
  2026-09-10: `legend.show=false` on all 368 tsmo2 graphs, all 4 MAP-21 graphs, all 6 sitemgmt, and the
  1 freightatlas2. The only real non-report TransportNY graph that renders a legend is a single one on
  `landing` (check it). The ~583 that do show legends live in `page_test` / `sandbox2` / `graph_test` —
  scratch patterns.
  **⚠ But this is NOT true site-wide: MitigateNY renders 7,415 graph legends — more than TransportNY.**
  It uses the legacy `Graph` element-type, which resolves to the same component
  (`ComponentRegistry/index.jsx:54`), so an `element-type='AVL Graph'` filter hides it entirely. Only 4
  of MNY's are gradient legends. Full corrected numbers and the per-item consequences are in the
  submodule task file's blast-radius section — **read that before touching `Legend.jsx` or the core
  `avlGraphTheme` defaults.**
- **Dark mode is OUT** — transportny's `avlGraph` stays at two styles (and loses one; see below).
- **`reportInlineTitle` — first plan withdrawn, now OPTIONAL.** Ryan caught that deleting the theme
  boolean would regress every non-transportny site that shows a legend at the top (they're built
  expecting the title on its own row — that's what the flag prevents). The revised version keeps the
  flag with a default of **off** everywhere and moves it from a named style to `display.title.inline`,
  set per section by `useAddGraphSection.js:112` / `report_build.mjs:1609`; `themev2.js:2028-2044`
  **stays** as a no-op for existing sections. Not required by any punch-list item — skip it if the
  churn isn't wanted. See the submodule task file for the exact shape and the no-regression assertion.
- **Design-system clause 2 gets annotated** with the 2026-09-04 reversal — a docs edit in
  `TransportNY Design System/dms_design_system_v2/pages/npmrds-report.html:46-47`.

## Next steps

1. Submodule **pass 1** — make the legend stop spilling out of its own box (geometry only, no tokens,
   no site values). **Blocks the padding change in step 3.**
2. Submodule **pass 2** — wire the legend + tooltip brand layers, plus the two cheap admin
   theme-editor pieces (for verification speed, not the admin story).
3. Set transportny's values in `themev2.js` per "Proposed values" above — legend keys, tooltip,
   `tabular-nums`, then **padding last**. Live-verify across every NPMRDS graph type
   (Line/Bar/GridGraph/Map/RouteCompare/InfoBox) plus Macro View and MAP-21 PM3, `probe_corpus.mjs`
   at 0 console errors, and update `traversing-report-pages.md` in the same session. **Local API is on
   `:3001`** (`.env:31`), not the `:4444` in CLAUDE.md's examples — an earlier note in these files
   wrongly said the server was down on that basis.
4. Submodule **pass 3** — the collapsing small-card legend (three tiers, reveal at tier 3). Separate
   because it adds behaviour rather than restyling existing behaviour.
5. Annotate design-system clause 2.
6. Update this file + the parent triage doc's Phase 5 section to CLOSED.

## Cross-references

- `src/dms/planning/tasks/current/avlgraph-legend-and-padding-theming.md` — the actual token-contract
  build (submodule).
- `planning/transportny/tasks/current/npmrds-reports-routes-feedback-triage.md` — Phase 5, parent item.
- `src/dms/planning/tasks/completed/avlgraph-theme-integration.md`,
  `graph-axis-font-theming.md` — the established pattern this extends.
