# NPMRDS Design System v2 → report page & report library implementation

**Project:** TransportNY · **Topic:** themes

**STALE / SUPERSEDED as of 2026-08-24 (Ryan's call).** Item 1 below ("Map graph-type support —
genuinely blocked") describes a pre-Map-authoring-UI state that no longer exists: Map creation UI
(`report-authoring-ux-overhaul.md` Tier 5C, 2026-08-20) and choropleth-by-measure (Tiers 5J/5K/10,
2026-08-20/24 — now covering speed/travelTime/hoursOfDelay/avgHoursOfDelay/all 4 CO2 variants) have
since fully shipped and live-verified there. Items 2-4 below were not independently re-checked this
pass — read `report-authoring-ux-overhaul.md` first for current NPMRDS report-authoring UI state
before trusting anything below.

**Status, corrected 2026-08-18** (the line below was stale for 12 days — see
`reports-docs-consolidation.md`): **the report canvas work is DONE.** Rail-width mechanism, the new
`ReportPageHeader` component, RRL's first restructure pass (Phase 3, all 7 sub-items except Map),
the template-propagation fix (so new reports inherit all of this automatically), and **Design push
#2's full 8-phase Quick Controls + storage-model rework** are all built and live-verified — full
build record, code traces, and verification walkthroughs moved to
[`npmrds-design-v2-implementation-archive.md`](./npmrds-design-v2-implementation-archive.md)
2026-08-18 (same live+archive split this project already uses for
`dynamic-reports-and-route-tags.md`). Everything below is what's actually still open, as of
2026-08-18 — not the 2026-08-06 snapshot the archive preserves.

**This file no longer supersedes `dynamic-reports-and-route-tags.md`.** That framing was accurate
on 2026-08-06 when this push was the active priority; the hub doc has since moved 12 days past this
file's last entry. Read this file for the 4 items below, not as a priority claim.

## Objective (still accurate context)

Bring two pages of Alex's `dms_design_system_v2` redesign onto real dms-template surfaces:
1. `npmrds-report.html`/`.js` — the individual report canvas — onto `ReportRouteList`/`RouteRow`/
   `RouteTagBrowserModal`/`AddGraphModal`, plus `ReportPageHeader`. **Done**, see archive.
2. `npmrds-reports.html` — the report library — a net-new page, reversing a prior "permanently out
   of scope" ruling. **Ryan's eventually, still blocked on Alex's design** — item 2 below.

## Open items

### 1. Map graph-type support — genuinely blocked, not a "ran out of time" gap

The Map section type's `ComponentRegistry` entry (`map/config.jsx`) has **no `defaultState` at
all** — unlike every other section type, a Map's layers/symbology are built entirely interactively
through its own edit UI, not a JSON shape a picker could compose against the way
`composeMeasureConfig` composes chart/table columns. `useAddGraphSection.js` already fails closed
on `pick.graphType === 'Map'` (returns `null`, no broken section created) and the Add Graph modal's
Map card stays disabled with an explanatory tooltip — so the blocked state is handled cleanly, just
not resolved.

Two ways to unblock it: (a) find an existing, already-working "Route Map colored by a
comparison-series measure" section somewhere to reverse-engineer the layer/symbology JSON shape
from — the same provenance approach `BASE_SOURCE` used for the chart path originally — or (b) read
`map/useComparisonSeriesLayers.js`/`SymbologySelector.jsx`/`SymbologyViewLayer.jsx` from scratch and
design the shape new. **Next step: ask Ryan if he knows of an existing Route Map section, anywhere,
already colored by a comparison-series measure** — that would collapse this from "design a new
system" to "compose against a known-working reference."

### 2. Report library (`npmrds-reports.html`) — blocked on Alex's design

Ryan's page eventually, not Alex's to build (`"reports lib I think is mine eventually, Alex is only
like 90% done with that design"`) — but as of the design's last known status (2026-08-06, ~90%
done), there's been no update in 12 days. **Worth checking with Ryan/Alex on design completion
before doing anything else here.** When it's ready: needs a real queryable index of report
metadata (869 reports, with denormalized route chips per report, per the original design critique's
Honesty §5) as a data-shape prerequisite, not just UI work — not yet scoped at the file level.

Minor, non-blocking loose end folded in here rather than tracked separately: a referenced task file
`npmrds-category-design-set.md` (the presumed authoritative cross-page-contract doc) was never
found in the repo; assessed 2026-08-06 as **not actually blocking** anything in this list (its
content is either already duplicated elsewhere or concerns pages outside this task's scope) — worth
asking Alex for it only if a real question about the report-library design comes up that it might
answer, not worth chasing on its own.

### 3. Post-ship gap review — 7 items, TABLED 2026-08-06, needs re-triage before picking up

Ryan reviewed the live v2 RRL implementation against the mockup and found 7 discrepancies, triaged
(code-read only) the same day, then explicitly tabled the whole list because Design Push #2 was
about to land and might change or moot some of it. **Design Push #2 has since shipped and was never
re-triaged against this list** — do that first, before starting any of these:

1. Add Route modal: tag chips render below the recent-routes list; mockup has them above. Confirmed
   real, simple reorder.
2. "Pending routes to add" pills use generic blue Tailwind classes instead of the v2 navy tokens.
   Confirmed real.
3. Result-row tag chips + TMC-count styling are still generic, never touched by the 2026-08-06
   visual reskin (which explicitly covered only `RouteRow`/`ReportRouteList`, not
   `RouteTagBrowserModal.jsx`/`AddGraphModal.jsx` — this is that deferred pass).
4. **RRL rail has no bottom summary line** ("4 routes · 36 TMC · 7.8 mi · 5 graphs" in the mockup).
   Confirmed missing. The mileage math already exists (`useRouteMileage`/`mileageByRouteCompId`,
   built for the per-row meta line) — just needs summing across all routes plus the graph count.
   (Same gap independently flagged once more, same session, as "the reference file's rail also
   totals mileage/TMCs at the bottom" — one item, not two.)
5. Graph-assignment pill styling — **checked directly, already matches the mockup byte-for-byte,
   no real gap.** Either Ryan was looking at a stale/pre-reskin page, or means something else; needs
   a fresh URL/screenshot to resolve, not a code fix.
6. A separate page-header-adjacent "report summary strip" (distinct from #4 — a sibling of the
   header card, not part of the rail) is missing entirely. **Real decision needed before building
   either #4 or #6**: the mockup's own comment says the two must show identical live-computed
   numbers ("checked against the rail without scrolling"), but RRL computes routes/TMC/mileage
   internally and `ReportPageHeader` has no access to that state today — decide a shared source of
   truth (lift the computation, or accept two independent queries) before building.
7. Every graph needs re-styling (labels/headers/colors) via theming — already tracked under
   `report-page-redesign.md` gap 03, not new. A 2026-08-06 survey already mapped out what's
   reusable (axis/palette theming already wired site-wide; `Legend.jsx` is theme-blind despite
   `graph.legend` existing; the generic `pill.status_na` variant is nearly the mockup's quick-control
   pill spec already) — see the archive's "Post-ship gap review" section for the full reuse map if
   this gets picked up.

Proposed order if/when picked up: 1-3 together (one modal, one pass) → 4 (small, local) → decide
the 4/6 shared-data-source question → 6 → 7 last (touches shared/site-wide theme).

### 4. Phase 4 — theme tokens (`chromeLabel`/`chromeTick`/`chromeNav`) — small, not started

Declare-to-match micro-type tokens the page's attribution lines/quick-control pills/kicker labels
need. Doesn't block anything, can happen any time. **Caution flagged in the original scoping**:
three separate "small mono uppercase micro-label" lineages already exist (`graph.subtitle`,
`pill.status_*`, `dataCard.metaXS`/`kicker`) — extend one of those three rather than adding a fourth.

## Sources

- Design: `src/themes/transportny/TransportNY Design System/dms_design_system_v2/pages/npmrds-report.html`
  + `npmrds-report.js`, plus `theme/theme.js`.
- Live components: `src/themes/transportny/components/{ReportRouteList,RouteTagBrowserModal,AddGraphModal,MeasurePicker,ReportPageHeader}/`
- Full build history: [`npmrds-design-v2-implementation-archive.md`](./npmrds-design-v2-implementation-archive.md)
  — includes the "Reference: the rest of the design set" section covering the 4 surfaces that stay
  Alex's purview (`npmrds-home.html`, `npmrds-macro.html`, `route-comparison.html`, the MAP-21
  family), kept there for continuity/handoff, not part of this task's active scope.
- Related: [`dynamic-reports-and-route-tags.md`](./dynamic-reports-and-route-tags.md),
  [`report-page-redesign.md`](./report-page-redesign.md) (gap 03, continuous with item 3.7 above),
  [`reportroutelist.md`](./reportroutelist.md), [`report-route-ui-parity-gaps.md`](./report-route-ui-parity-gaps.md)
- The sidebar-group Settings-trigger positioning bug hit repeatedly while browser-testing this
  work is tracked in `src/dms/skills/traversing-dms-pages.md` §2, not duplicated here.
