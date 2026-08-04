# Report spec format

The declarative input to `scripts/npmrds-reports/report_build.mjs`: one JSON file describing an NPMRDS report page
— its routes, its graphs, and which routes feed which graphs — that the script turns into a live
DMS page plus a `reports_snap_2` route-snapshot row.

Companion docs: `npmrds-report-data-shapes.md` (how the resulting rows are shaped, and the
inspection gotchas), `../../planning/transportny/tasks/current/report-spec-and-build-script.md` (the design
record and progress log).

---

## Why a spec

**The parity guarantee.** Graph state is composed by calling the same `applyMeasurePick`
(`src/themes/transportny/components/MeasurePicker/index.js`) that the UI's Measure Picker calls —
the script is a third caller, not a reimplementation. So CLI-built and UI-built sections are
identical by construction, and "does the UI have feature parity?" reduces to the checkable question
"is there a control for each spec field?" rather than a comparison of two implementations.

Verified 2026-07-27: all three AVL Graph rows written by the first live build were byte-identical to
the `--dry-run` composed states, and a composed state diffed cleanly against a live UI-built section.

**Turning silent failures into declared data.** Three of the UI click-path's failure modes are
invisible when they happen — a graph-assignment pill that doesn't register, a measure pick lost
because Save wasn't clicked, and a difference graph whose anchor arm is whichever route instance
happened to be added first. In a spec these are all explicit fields, and `graphIds` is *computed*
from `routes[].graphs`, so the assignment class cannot silently fail.

**A reviewable intermediate representation.** `request` and per-graph `why` record the client ask
and the reasoning that turned it into these particular graphs, so an inferred report can be
corrected before anything is built.

---

## Top-level fields

| field | required | meaning |
|---|---|---|
| `title` | yes | Page title, and the `name` on the `reports_snap_2` row. |
| `slug` | no | Full page slug. Defaults to `<parent>/<title slugified>`. |
| `parent` | no | Slug of the parent page. Defaults to `converted_reports`. Must already exist. |
| `description` | no | Written to the snap row's `description` — **not visible anywhere on the page.** For a client-visible summary use `intro` instead. |
| `intro` | no | Prose paragraph(s), rendered on the page. See "The title block" below. |
| `request` | no | The literal client ask, verbatim. Printed by `--summary`, stored on the snap row as `_client_request`. |
| `graphs` | yes | Non-empty array — see below. |
| `routes` | yes | Non-empty array — see below. |

The snap row also records `_built_from_spec` (the spec's path) automatically.

## `graphs[]`

| field | required | meaning |
|---|---|---|
| `key` | yes | Spec-local identifier, unique. Referenced by `routes[].graphs` and `graphs[].anchor`. Never written to the DB. |
| `graphType` | yes | `BarGraph` \| `LineGraph` \| `GridGraph` \| `Map` \| `InfoBox` \| `RouteCompare` — see "Route Map graphs", "Route/TMC Info Box graphs", and "Route Compare graphs" below, three different shapes entirely. |
| `measure` | yes | A vocabulary measure — see the enum note below (Map, InfoBox, and RouteCompare each have their own, separate list). |
| `resolution` | AVL Graph only | `5-minutes` \| `15-minutes` \| `hour` \| `day` \| `weekday` \| `month`. Map graphs only need this for `measure: avgHoursOfDelay` (`day` \| `5-minutes`); every other Map measure omits it. InfoBox/RouteCompare never use it (neither old-tool component ever read `resolution` either). |
| `grain` | InfoBox only | `route` (default) \| `tmc` — see below. |
| `bin` | InfoBox `reliability` only | `amp` \| `midd` \| `pmp` \| `we` — the FHWA time-of-day period, required only for the `reliability` measure. |
| `title` | no | Sets both the section row's `title` and `display.title.title`. |
| `comparisonMode` | no | `plain` (default) — each assigned route renders as its own series — or `difference`. **Not supported on `Map`/`InfoBox`/`RouteCompare`** — fails the build if set (each assigned route already renders as its own choropleth-colored layer / comparisonSeries row / %-vs-anchor delta row, not a subtraction). |
| `anchor` | difference only | A `routes[].id`. Names the arm the others are subtracted *from*. RouteCompare has no field of its own for this — its anchor is always whichever route is first in `routes[]`, same convention a difference graph's implicit anchor uses. |
| `size` | no | Colspan, `"1"`–`"12"`, written as the section row's own `size` field. |
| `colorRange` | Map only | Array of hex colors, low→high. Defaults to a neutral speed ramp if omitted. |
| `caption` | AVL Graph only | Prose, rendered as a subtitle line under the chart's own title (`GraphComponent.jsx`'s `GraphTitle`, reading `display.description` — already wired on the render side; this is the write path). **Not supported on `Map`/`InfoBox`/`RouteCompare`** — fails the build if set (none of the three has a title/description render path — Spreadsheet, Info Box's and RouteCompare's shared element-type, has no GraphTitle-equivalent). |
| `why` | no | Free text: why this graph answers part of the request. Printed by `--summary`, never written. |

**Enums are validated at runtime against the live vocabulary**, not against this table — a typo
fails loudly at compose time rather than producing a silently empty graph. Current measures:
`travelTime`, `speed`, `speedTruck`, `hoursOfDelay`, `avgHoursOfDelay`, `co2Emissions_passenger`,
`co2Emissions_truck`, `avgCo2Emissions_passenger`, `avgCo2Emissions_truck`. The authority is
`src/themes/transportny/components/MeasurePicker/vocabulary.json` (measures, resolutions) and
`GRAPH_TYPE_OPTIONS` in `MeasurePicker/composeMeasureConfig.js`; if a build rejects a value, read
those rather than this list.

## `routes[]`

Each entry is a route **instance** — a catalog route plus a date window. Two instances routinely
share one `route_id` and differ only by window; that is how before/after comparisons are expressed.

| field | required | meaning |
|---|---|---|
| `id` | yes | Spec-local identifier, unique. Referenced by `routes[].graphs` targets and `graphs[].anchor`. Never written. |
| `route_id` | yes | The route's DMS id in the Routes Data catalog (source `2107426` / view `2107427`). Resolved at build time to pull its `tmc_array`. |
| `name` | yes | The series label. See the duplicate-name rule below. |
| `graphs` | yes in practice | Array of `graphs[].key`. Empty means this instance feeds nothing — the build warns and fails the structural check. |
| `startDate` | no | Inclusive window start. Omit both dates for all available data. |
| `endDate` | no | Window end. |
| `startTime` | no | Time-of-day window start, `"HH:mm"` 24-hour (e.g. `"07:00"`). Requires `endTime` and a `startDate`/`endDate` window — see the semantics below. |
| `endTime` | no | Time-of-day window end. Requires `startTime`. |
| `color` | no | Series color, hex. |
| `weekdays` | no | Day mask — see the semantics below. |
| `confidence` | no | `{level: "low"\|"medium"\|"high", note}` — flags an inferred, not-determinate choice (typically segment extent — "around Verplank Ave and Beekman St" has no exact answer). Guess-and-flag, not a gate: `level: "low"` prints a "NEEDS REVIEW" banner in both `--summary` and a real build, but never blocks the build. See "Intake checklist" in `creating-reports.md`. |

---

## Semantics that are easy to get wrong

### Route names are the only series discriminator

`name` is what becomes the server's SQL alias and the client's legend/color key. **Two instances
sharing a name collapse into one series.** The script auto-suffixes duplicates (`… (2)`) and warns,
matching what ReportRouteList does on add — but a report whose two arms silently merged is the
failure this prevents, so prefer distinct names in the spec.

### `confidence` flags an inferred choice, and never blocks the build

A client request routinely underspecifies the thing a route depends on most — segment
extent. "Peak travel times on 9D, including the intersections of Verplank Ave and
Beekman St" names two cross-streets but not how far past them the corridor should run.
There is no determinate answer, so the right move is a best-guess route plus a
reviewable flag — not a stalled report waiting for detail the client was never going to
provide (see the "Guess and flag, don't gate" rule in `creating-reports.md`).

```json
{ "id": "nb", "route_id": 2195805, "name": "NY-9D Northbound",
  "confidence": { "level": "low", "note": "Client named Verplank Ave and Beekman St only; extended ~0.3mi past each on the along-road TMC chain. Confirm extent with client." },
  "graphs": ["overview"] }
```

`level: "low"` prints a "⚠ NEEDS REVIEW" banner in `--summary` **and** in a real build
(so the flag survives even if `--summary` is skipped) — but the build always proceeds.
This is deliberately the only spec field with a gating-adjacent effect that does *not*
gate: everything else that could block a build (a missing `route_id`, a malformed
enum) is a hard error, because those are unambiguous mistakes. Confidence is not a
mistake, it's an acknowledged guess, and the correction mechanism is AVAIL feedback →
`--update`, not a stalled first draft.

### The weekday mask excludes only on an explicit `false`

Per `useGraphPublish.js:34`, an **absent** key means the day is *included*. So:

```json
"weekdays": { "saturday": false, "sunday": false }
```

means Monday–Friday, not "only Saturday and Sunday excluded from nothing". An empty or absent
`weekdays` means all seven days. (Easy to read backwards — it was, on the first pass.)

`weekdays` got a UI control 2026-07-30 — a "Days of Week" toggle row (plus Weekdays/Weekends/All
Days presets) next to `RouteRow.jsx`'s date-edit inputs, saving down to only the `false` entries on
this same normalized shape. See `report-route-ui-parity-gaps.md` gap #10 for the live verification.

### `startTime`/`endTime`: a peak-hour (or any time-of-day) sub-window (added 2026-07-28)

Closes the gap tracked as `report-route-ui-parity-gaps.md` gap #11 and
`client-request-to-report-skill.md` next-steps item #11: no way to express "just the AM/PM peak"
on a route instance. Reuses an existing, already-live runtime mechanism rather than adding a new
one — `useGraphPublish.js`'s `transformReportRoutes` already turns a `startDate`/`endDate` pair
containing a clock time (the exact ISO-ish `"YYYY-MM-DDTHH:mm"` format `ReportRouteList`'s own
date+time inputs produce) into a real ClickHouse `epoch` IN-filter, ANDed with the date filter —
this has worked since 2026-06-23 for hand-built routes. The gap was purely that
`report_build.mjs` had no spec field to feed it.

```json
{ "id": "am", "route_id": 2126095, "name": "AM Peak",
  "startDate": "2026-04-20", "endDate": "2026-04-30", "startTime": "07:00", "endTime": "10:00",
  "graphs": ["overview"] },
{ "id": "pm", "route_id": 2126095, "name": "PM Peak",
  "startDate": "2026-04-20", "endDate": "2026-04-30", "startTime": "16:00", "endTime": "19:00",
  "graphs": ["overview"] }
```

**The epoch filter is a time-of-day range, independent of date** — so one `startTime`/`endTime`
pair applies to *every* date in the window, not just the boundary days. The example above is
exactly how to reproduce the old tool's AM-Peak/PM-Peak sub-window split (each as its own named
series) rather than a categorical `"amPeak": true` flag: the old tool's peak checkboxes computed
an envelope into `startTime`/`endTime` and were themselves just this mechanism with a friendlier
label — see the rules note below on why this spec exposes the raw window instead of AM/PM enums.

**`startDate`/`endDate` stay pure dates on the spec** — `startTime`/`endTime` are separate fields,
combined into the single time-suffixed string only when writing the `reports_snap_2` row's route
entries. **Correction, 2026-07-28 (later the same day):** this section originally claimed the time
window is "simply inert" for Route Map and Info Box graphs. That was wrong, and wrong for a
checkable reason — `report_build.mjs`'s two build-time Python shell-outs
(`composeMapGraphState`/`composeInfoBoxGraphState`) genuinely never see `startTime`/`endTime`
(Route Map's per-report choropleth bake, `pooled_route_map_values`, has no epoch predicate in its
SQL at all), but that is not the same question as "does the *live rendering* apply the window."
`findSelfBoundGraphs` (`useGraphPublish.js`) discovers any section with an enabled
`comparison_series` subscriber bound to `$self` — it does not check element-type — so the same
epoch-bearing filter list `transformReportRoutes` builds is published to Route Map and Info Box
sections exactly as it is to AVL Graph, and both ride the same generic
`comparisonSeries`/`buildUdaConfig.js` query-building path at render time. **Live-verified
2026-07-28**: a two-instance (AM/PM) build assigning the same route to one Info Box `travelTime`
graph and two Route Map `speed` graphs produced, per `report_probe.mjs`'s decoded network capture,
genuinely different results per arm — Info Box: 8.615 min (07:00–09:00) vs 8.498 min
(16:00–18:00); Route Map's live `colorDomain` re-break: 71.67 mph vs 70.69 mph — over the identical
TMC and date range, differing only by `startTime`/`endTime`. So **the mechanism already worked with
zero code changes**, for both graph types, the moment a route carrying `startTime`/`endTime` was
assigned to them — the earlier claim was an unverified analogy from a genuinely different fact
(Route Map's static build-time bake ignores epoch), over-generalized to the live render without
testing it, the same mistake class flagged in `feedback_verify_no_shape_claims_against_code`.

**What is still real:** Route Map's *build-time* choropleth bake (`pooled_route_map_values`) has no
epoch predicate, so the section's initial/placeholder color breaks and first paint reflect the
whole date range, not the peak window — only corrected once the live `comparisonSeries` re-break
runs client-side. Info Box has no equivalent static step (queries live from the first render), so
this gap doesn't apply there at all. Not fixed in this pass — narrower and lower-priority than the
"UI half" below, since the page a viewer actually sees is already correct.

**No named shorthand (`"peak": "am"`/`"pm"`) on purpose.** AM/PM windows aren't universal — a
signal-timing study and a school-zone study don't share one. The old tool's own `amPeak`/`pmPeak`
checkboxes were dead code (computed an envelope, never reached the query — see
`old-reports-conversion.md:882-883`), so there's no real precedent to match, only a UI convenience
to reproduce if a control ever gets built. Writing the literal window per client ask, with the
reasoning in `why`, matches the "guess and flag" posture the rest of this spec already uses.

**The UI convenience got built, 2026-07-28 (later same day):** `RouteRow.jsx`'s existing date+time
`<Input>`s (the only UI surface for `startTime`/`endTime`, unchanged) gained a row of one-click
presets — AM Peak (06:00–10:00), PM Peak (16:00–20:00), PM Peak (alt) (15:00–19:00), Midday
(10:00–16:00), All Day (clears both) — matching the non-wrapping windows in `REPORTING_BINS`
(`data-types/map21/constants.js`). Since a route's date/time window is graph-type-agnostic (the
same `RouteRow` control feeds whichever graphs the route is assigned to), this one control closes
gap #11's "UI half" for AVL Graph, Route Map, and Info Box simultaneously — no per-graph-type work
needed, consistent with the correction above. `OVN`/`FREEFLOW` are omitted: both wrap past
midnight, which `generateEpochRange`'s plain `start<=end` loop can't express (see
`report-route-ui-parity-gaps.md` gap #11 for the full writeup and live verification).

**Validation**: `startTime`/`endTime` must both be present together (`"HH:mm"`, 24-hour) if either
is, and both require `startDate`/`endDate` to already be set — a time-of-day window needs a date
window to apply within; that's a hard build error, not a warning.

**Known pre-existing gap, not fixed by this feature**: `--from-page`'s drift check (the "does the
live page still match its stored spec" test that decides whether to echo the stored spec or
reconstruct from live state) only inspects graph-section content — title, `_measurePick`, caption.
It does not compare the snap row's own `routes` field against the stored spec's `routes[]`, so a
route hand-edited live via `ReportRouteList` (including its date/time inputs) after a build can go
undetected as drift, and `--from-page` will happily echo back the stale stored spec instead of
reconstructing. This has been true since routes first got a `startDate`/`endDate`/`weekdays`
comparison surface, not introduced here — just newly relevant now that a route field (peak window)
is more likely to get hand-tweaked post-build. Not fixed in this pass (would touch the shared drift
check broadly, not just this feature); logged in the task file's next-steps.

Live-verified 2026-07-28: a two-instance (`AM Peak`/`PM Peak`, same `route_id`) LineGraph build
produced a live query whose two `seriesVariants` carried identical `tmc`/`date` filter groups and
distinct `epoch` filter lists (`[84..120]` vs `[192..228]`) — confirmed via `report_probe.mjs`'s
decoded `/graph` capture, not just a structural check. The two series' rendered means
(8.5179 / 8.4455 minutes) matched a direct ClickHouse query over the same TMC/window/epoch-range
to 5 decimal places. `--from-page` round-tripped correctly in both branches: the no-drift echo path
(trivial, since `stripInternal` already preserves `startTime`/`endTime` verbatim) and, after forcing
drift with a hand-edited section title, the live-reconstruction path (which splits the persisted
combined date+time string back into clean `startTime`/`endTime` fields). Test page `2196692` +
sections `2196693`-`2196696` + snap row `2196698` deleted after, confirmed gone via `page show`
and the split-table dataset query.

### Difference graphs: anchor and sign

A difference graph returns **anchor − other**. The server treats `seriesVariants[0]` — the first
assigned route in `routes` array order — as the anchor, and the UI exposes no control for this at
all. Naming `anchor` explicitly lets the spec fix the sign without reordering:

- anchor is the **first** assigned route → nothing special, `combine.invert` stays unset (so the
  state stays byte-identical to what the UI would produce).
- anchor is the **second** of exactly two arms → the script sets `comparisonSeries.combine.invert:
  true`, flipping the subtraction rather than reordering the routes array.
- anchor is arm #3+ of more than two → hard error with a fix hint. Reorder `routes` so the anchor
  comes first.

Omitting `anchor` on a difference graph is allowed but warns, and defaults to the first assigned
route.

**FIXED 2026-07-30** (was: the default difference palette mapped green→lowest and red→highest, so
for `before − after` on travel time a *positive* bar — the improvement — rendered red). Root cause
and fix are in `planning/transportny/tasks/current/report-spec-and-build-script.md`'s "Finding: difference-graph
color scale reads backwards" — `composeMeasureConfig.js`'s `buildDiffColors` was reusing the raw-value
`reverseColors` flag verbatim for difference mode, but the polarity provably inverts between coloring
a raw value and coloring a before-minus-after delta. No new vocabulary field needed, just negating
the existing flag for the diff-mode case. Mirrored into `convert_old_reports.py`'s `_diff_colors()`
and a second independent instance of the same bug in its custom-`color_range` wiring. **Only affects
graphs composed from 2026-07-30 forward** — already-persisted difference sections still carry the
old wrong colors until explicitly rebuilt; per explicit user direction, only
`converted_reports/ny9d_beacon_spec_test` was rebuilt (nothing in this arc is live/production —
everything here is dev-environment build work).

### Route Map graphs (added 2026-07-27)

`{graphType: "Map", measure: "none"|"speed"|"travelTime"|"hoursOfDelay"|"avgHoursOfDelay"}` builds
a choropleth Map section — TMC segments colored by the measure's value, live dms-server
ClickHouse tile-join, the same shape as the old tool's "Route Map" panel (the single most
consistent panel across the old corpus — see
`planning/transportny/tasks/current/client-request-to-report-skill.md`'s composition-rules analysis).

**This is not composed by `applyMeasurePick`.** `report_build.mjs` has no Map-section code of its
own; it shells out to `convert_old_reports.py --route-map-section` (new
`build_route_map_section_state` function), which reuses the exact template-minting
(`ensure_route_map_*_template`) and per-report choropleth-baking machinery built for the
old-report-conversion task (rounds 47-50) — same reuse principle as the AVL Graph parity
guarantee above, just against a different script. `measure: "none"` is geometry-only (no
choropleth, no baking); every other measure gets a real per-report choropleth baked from the
pooled TMCs and date range across every route assigned to that graph — a graph with no
resolvable tmcs/dates, or a bake query that returns no values, still builds (placeholder paint
renders, a warning prints; matches this task's "guess and flag, don't block" rule).

`avgHoursOfDelay` is the one measure that needs `resolution` (`day` or `5-minutes`); every other
measure is resolution-invariant (a Map choropleth is a whole-range per-TMC aggregate, not a
time-bucketed series).

Live-verified 2026-07-27: a one-route `measure: "speed"` Map graph built end-to-end, and
`report_probe.mjs` confirmed the section's own `colorDomain` UDA call returned a real baked value
matching a direct ClickHouse query over the same TMC/date range, with a populated legend and zero
console/page errors.

### Route/TMC Info Box graphs (added 2026-07-28)

`{graphType: "InfoBox", measure: "reliability"|"travelTime"|"length"|"aadt"|"hoursOfDelay", grain?:
"route"|"tmc", bin?: "amp"|"midd"|"pmp"|"we"}` builds a per-route (or per-TMC) summary table — the
single most consistent panel across the old corpus after Route Map (Route Info Box appears in 100%
of `before_after` reports at two measures, 86% of `reliability`/`speed_study`, 56% of
`route_comparison` — see the composition-rules analysis in
`planning/transportny/tasks/current/client-request-to-report-skill.md`).

**This is not an AVL Graph.** Its element-type is `Spreadsheet`, not `AVL Graph`, and like Route Map
it's composed by shelling out to `convert_old_reports.py --route-info-box-section` (new
`build_route_info_box_section_state` function) rather than `applyMeasurePick` — same reuse principle,
reusing the exact template-minting machinery (`ensure_pm3_join_template`/
`ensure_info_box_traveltime_template`/`ensure_info_box_length_template`/`ensure_info_box_aadt_template`/
`ensure_info_box_delay_template`) built for old-report conversion (rounds 18/38/40).

**Unlike Route Map, there is no per-report baking step.** Every one of the five measure buckets
queries live at render time via the cloned template's own join (a cross-engine `pgFederated` join
against source 1410's per-year view for `reliability`; a plain ClickHouse join for the other four) —
the same `fetchMode:"force"`/`comparisonSeries` mechanism an AVL Graph section already uses. So an
Info Box graph composes in one pass, before route resolution, and there is no placeholder-vs-baked
distinction the way Route Map has one.

`grain` defaults to `"route"`: each assigned route renders as its own row via the `__series`
comparison-series discriminator (same fan-out mechanism as an AVL Graph section — the structural
checks below apply to InfoBox exactly as they do to AVL Graph, unlike Map). `grain: "tmc"` groups by
a plain `tmc` column instead — matches the old tool's TMC Info Box, which only ever rendered one TMC
at a time.

**`measure: "reliability"` is the one bucket with a real dependency.** It's the LOTTR/TTTR/Freeflow
join against source 1410 (old code's own internal key for this bucket is the confusingly-reused
`"speed"` measure — the spec calls it `"reliability"` instead, so it doesn't collide with AVL Graph's
real speed-in-mph measure). It needs:
- `bin` — one of the four periods source 1410 actually precomputes (`amp`/`midd`/`pmp`/`we` — AM
  Peak/Midday/PM Peak/Weekend). There is no "all hours" bin and no live way to compute one.
- A `year`, derived automatically from the assigned routes' `endDate`/`startDate` (same idiom as
  Route Map's network-year resolution) — **not** a spec field.

Unlike Route Map's geometry-year clamp (which always has some network to fall back to), a
`reliability` year outside source 1410's real coverage (2018–2025) has **no fallback** — the build
fails loudly rather than silently substituting a different year's data. Pick a measure with no year
dependency (`travelTime`/`length`/`aadt`/`hoursOfDelay`) instead, or a route inside that window.

Live-verified 2026-07-28: a one-route spec with both a `reliability` (`bin: "amp"`) and a
`travelTime` Info Box graph built end-to-end on a real route (NY-9D Northbound); `report_probe.mjs`
confirmed both sections queried live and rendered real values (LOTTR≈1.30, TTTR≈2.29, freeflow≈31
mph; travel time 5:34), correctly distinct from the page's own Add-a-Route Spreadsheet section
(which shares InfoBox's `Spreadsheet` element-type — see the `--update`/`--from-page` note below).
An `--update` revision swapping one Info Box graph for another (`0`/`1` created/deleted paths both
exercised) left exactly the right sections behind with zero duplicates or orphans.

**A real gotcha found while wiring this, not by reasoning:** because an Info Box graph and the page's
own Add-a-Route section share the `Spreadsheet` element-type (Route Map and AVL Graph each have their
own unambiguous element-type), `--update`'s reconcile logic — which finds the Add-a-Route section and
sweeps orphaned graph sections by element-type — needed a real fix, not just a new branch: both now
consult the stored key map (or, for `--from-page`, each section's own `_infoBoxPick` marker) to tell
an Info Box graph's Spreadsheet section apart from the Add-a-Route one, rather than matching
element-type alone.

### Route Compare graphs (added 2026-07-29)

**Not the theme's custom `RouteComparison.jsx` page component** — a completely different, unrelated
tool ("the DMS replacement for the legacy npmrds *Batch Reports* tool"), out of scope for this spec
entirely. "Route Compare" here is the old-tool report/graph type name, converted to a plain
`Spreadsheet` section — one row per assigned route, a value column, and a `%` vs. anchor delta
column — needed for the `signal_timing` composition class (71% Route Compare Component on speed and
travelTime — the class NY-9D belongs to).

`{graphType: "RouteCompare", measure: "speed"|"travelTime"}` builds the section. Like Info Box and
unlike Route Map, there is **no per-report baking step**: composed by shelling out to
`convert_old_reports.py --route-compare-section` (new `build_route_compare_section_state` function),
reusing the shared, generic, per-measure `ensure_route_compare_template` (round 25) — one template per
measure, reused across every report. The anchor (the "Main"/base row) and every compare row's %-diff
resolve live at render time via `comparisonSeries` + dms-server's `__ANCHOR__(<expr>)` mechanism,
reading whichever route the page's own route list currently has first — same convention a difference
graph's implicit anchor uses (see "Difference graphs: anchor and sign" above), and no `anchor` field
of its own: reorder `routes[]` to change which one is first instead.

No `resolution`, no `comparisonMode` (a `RouteCompare` graph's delta column already *is* the
%-diff-from-anchor; `comparisonMode: "difference"` is rejected as redundant), no `caption`
(`Spreadsheet` has no `GraphTitle`-equivalent render path, same restriction as Route Map/Info Box).

Live-verified 2026-07-29: a two-route (NB/SB) spec with `speed` and `travelTime` `RouteCompare`
graphs, plus a `travelTime` Info Box graph on the same page (to stress-test the Spreadsheet
disambiguation below). Anchor row rendered exact `0`/neutral; the other row's delta matched
`(value − anchor) / anchor * 100` to the rendered precision for both measures (speed: 24.74 vs. 20.76
mph → **+19.19%**; travelTime: 4.51 vs. 5.37 min → **−16.10%**), the travelTime numbers cross-checked
exactly against the Info Box travelTime section's own values for the same two routes. `--update` and
`--from-page` round-trips both correct, including a forced-drift (`--from-page` after a hand-edited
section title) reconstruction pass that correctly told the `RouteCompare` and `InfoBox` sections apart
from each other and from the page's own Add-a-Route section — see the same Spreadsheet
disambiguation gotcha noted for Info Box above; `RouteCompare` sections carry a `_routeComparePick`
marker (mirrors `_infoBoxPick`/`_routeMapPick`), and `isGraphSectionElement`/the drift-detection and
live-reconstruction branches in `report_build.mjs` now check for either marker before falling back to
"neither, must be Add-a-Route."

**A real, live-caught bug, not theoretical — read before touching `travelTime` expressions again:**
`travelTime`'s raw SQL expression needs `ds.`-qualified columns here (`ds.tmc`,
`ds.travel_time_all_vehicles`), NOT the bare columns `TRAVEL_TIME_EXPR`/`vocabulary.json` currently use.
Round 35 (2026-07-13) originally set `TRAVEL_TIME_EXPR` to the `ds.`-qualified form, verified correct
for every template that has a join (this one, and Route Map's choropleth via
`TRAVEL_TIME_VALUE_EXPR`). The 2026-07-24 vocabulary fix (see
`research/npmrds-reports/reportroutelist-cross-repo-sync.md`) then stripped the `ds.` prefix —
correctly, for *that* fix's own context (AVL Graph's no-join vocabulary path) — but because
`TRAVEL_TIME_EXPR` is one constant shared by both contexts, it silently regressed every with-join
caller too. Bare columns make the delta query fail with a real ClickHouse error ("Aggregate function
avgMapIf(...) is found inside another aggregate function") — restoring `ds.`-qualification fixes it
(confirmed live, values cross-checked against Info Box). **Fixed here by forking a new, dedicated
constant** (`ROUTE_COMPARE_TRAVELTIME_EXPR` in `convert_old_reports.py`) rather than editing the
shared `TRAVEL_TIME_EXPR`/`vocabulary.json` a third time — that would just flip AVL Graph's no-join
path back to broken. **Route Map's travelTime choropleth (`TRAVEL_TIME_VALUE_EXPR`, also with-join,
also derives from `TRAVEL_TIME_EXPR`) does NOT carry this regression — checked and ruled out
2026-07-30** (`planning/todo.md`'s "Check Route Map's travelTime choropleth..." item). Ran the same
bare-column expression, same `table1` LEFT JOIN, same real NY-9D TMCs/dates, two ways: (1) the actual
`--route-map-section --measure travelTime` repro end to end — no error, real quantile breaks baked;
(2) a direct ClickHouse diff of the bare-column expression against a `ds.`-qualified control, straight
via `dbq.py ch` — byte-identical values. Two structural reasons it was never at risk: Route Compare's
"aggregate found inside aggregate" error came specifically from wrapping the bare expression in
dms-server's `__ANCHOR__(...)` delta composition, which the Map choropleth's CH-join tile path doesn't
use at all (`query.columns`+`groupBy`+`join` run directly, no anchor/window wrapping — see
`tile-join-clickhouse-source.md`); and the join predicate is exactly `ds.tmc = table1.tmc`, so an
ambiguous bare `tmc` reference can't diverge in value between the two sides, while
`travel_time_all_vehicles` only exists on the `ds` side at all (no ambiguity possible there either).

### The title block (added 2026-07-27)

A client-showable report needs a visible heading and an explanatory paragraph — but
`item.title`/`item.description` on the page itself are never rendered anywhere in `view.jsx`, and
no other existing primitive fits a real paragraph (the one "Header" component in the registry is a
MitigateNY hero banner — bg image, logo, fixed single-line subtitle — wrong shape and wrong look
for a data report). So the build always inserts one generic "lexical" (Rich Text) section as the
first section in the main content column: `title: spec.title` (the section's own generic title
field, the same one every section has) plus a body built from `intro`, split on blank lines into
paragraphs. An author can hand-edit it afterward like any other Rich Text block — no new component,
no new control.

**A real rendering gotcha, not just a design choice:** the read-only `RichtextView` component
requires `element-data.text` to already be a Lexical tree object (`{root:{children:[...]}}}`) — it
checks `text?.root` directly and renders nothing for a bare string. Only the *edit* component
auto-upgrades a plain string (via its own `textToLexicalJSON`, `ui/components/lexical/index.jsx`).
So the builder constructs the tree itself (`textToLexicalTree` in `report_build.mjs`, mirroring
that same node shape) rather than writing plain text — writing a bare string would build a page
that looks fine as a draft (edit mode upgrades it on load) and renders **empty** once published.

Tracked in `_specKeyMap` under the reserved key `title_block`, alongside the per-graph keys, so
`--update` edits it in place instead of duplicating it, and `--from-page` can recover both the
heading and the intro text for drift detection. It's always built, even with no `intro` — every
report gets a visible heading.

### Per-graph captions reuse an already-wired, unexposed field (added 2026-07-27)

Unlike the title block, this needed **no new section** — `display.description` already renders as
a subtitle line under the chart's own title (`GraphComponent.jsx`'s `GraphTitle`), and
`convert_old_reports.py` already writes old reports' captions into exactly this field. It was a
write-path gap, not a render gap: `report_build.mjs` didn't set it, and `graph_new/config.jsx` had
no control for an author to edit it by hand (a `Title` input existed, no `Description`). Both are
now fixed — one line in the compose step (`state.display.description = g.caption`, survives a
later measure-pick change untouched since `applyMeasurePick` never touches `description`), and one
textarea control in the shared `graph_new/config.jsx`.

Route Map sections have no equivalent — Map's view component doesn't render a title/description at
all — so `caption` on a `Map` graph fails the build rather than silently doing nothing.

### `resolution` is per-graph today, and that is expected to change

In the old tool, resolution is a property of the *attached route*
(`GeneralGraphComp.getResolution()` reads `activeRouteComponents[0].settings.resolution`) and is
read at render time. Deriving it dynamically is explicitly deferred in the report-page-redesign
findings. So `graphs[].resolution` is the current shape, **not the settled one** — expect it to
migrate to `routes[]`. Don't build anything that depends on it staying where it is.

---

## Modes

```bash
node scripts/npmrds-reports/report_build.mjs <spec.json> --summary   # plain-language review; no writes, no Vite boot
node scripts/npmrds-reports/report_build.mjs <spec.json> --dry-run   # compose every graph's state and print it; no writes
node scripts/npmrds-reports/report_build.mjs <spec.json>             # build, draft only
node scripts/npmrds-reports/report_build.mjs <spec.json> --publish   # also create published section copies
```

`--summary` is the review step for an inferred report: it renders the request, every route instance
with its window and weekday mask, and every graph with its mode, arms and `why` — enough to catch a
wrong date window or a mis-assigned arm before anything is written.

`--dry-run`'s **stdout is valid JSON** (the human-facing trailer goes to stderr), so it pipes:

```bash
node scripts/npmrds-reports/report_build.mjs <spec>.json --dry-run 2>/dev/null | jq '.[].key'
```

Working specs live in `scratchpad/npmrds-sub/report-specs/`.

---

## What the build checks, and what it doesn't

Three layers, and only the first two are decided here.

1. **spec → composed state.** Guaranteed by construction (the real `applyMeasurePick`), and
   inspectable with `--dry-run`.
2. **composed state → written row.** The structural checks run on every build: no route instance
   with empty `graphIds`, no graph nothing feeds, and per graph `display.fetchMode: "force"`,
   `comparisonSeries.enabled`, and the `$self`-bound `comparison_series` subscriber — the three keys
   whose absence makes a section render empty rather than error. A build with problems exits `1`.
   **Map graphs** only get the `$self` subscriber check (shared with AVL Graph — RRL discovery is
   element-type-agnostic) — `fetchMode`/`comparisonSeries.enabled` are AVL-Graph DataWrapper
   concepts a Map section doesn't have; it queries per-layer via its own tile/join config instead.
3. **written row → what the page renders.** *Not checked.* Deliberately: failures at this layer are
   platform bugs rather than build bugs — both prerequisites folded into this work
   (`epoch-time-format-bucket-width`, `length-query-calculated-groupby-alias`) had a correct
   composed state and a broken page.

For layer 3, run the probe:

```bash
node scripts/npmrds-reports/report_probe.mjs <slug>                  # published pages
node scripts/npmrds-reports/report_probe.mjs edit/<slug> --auth      # draft-only pages (a page with published='draft'
                                                      # legitimately renders nothing at its public URL)
```

A spec-aware assertion mode (`report_probe.mjs --expect <spec.json>` — asserting each graph fired a
`/graph` request and returned as many series as it has assigned route instances) is **deferred**, not
missing; see the task file for the trigger.

---

## Example

```json
{
  "title": "NY-9D Beacon Signal Study - Travel Time Comparison",
  "slug": "converted_reports/ny9d_beacon_spec_test",
  "request": "City of Beacon wants to document how the actuated signals installed ~March 2025 improved congestion on NY-9D through Beacon. Compare Jan/Feb 2025 (before) against Jan/Feb 2026 (after).",
  "intro": "This report compares travel time on NY-9D through Beacon before and after the actuated signals installed in March 2025.",
  "graphs": [
    { "key": "overview", "title": "Travel Time - all periods",
      "graphType": "LineGraph", "measure": "travelTime", "resolution": "5-minutes",
      "comparisonMode": "plain",
      "caption": "The line graph above overlays both periods. A lower after-trace during peak hours indicates the signals reduced delay.",
      "why": "One overlaid trace per direction and period, so the client can see the peak shape shift." },
    { "key": "nb_diff", "title": "Northbound Travel Time Difference",
      "graphType": "BarGraph", "measure": "travelTime", "resolution": "5-minutes",
      "comparisonMode": "difference", "anchor": "nb_before",
      "why": "Before minus after per bucket. Positive bars mean travel time fell." }
  ],
  "routes": [
    { "id": "nb_before", "route_id": 2195805,
      "name": "NY-9D Northbound (I-84 to Main St) - Jan-Feb 2025",
      "startDate": "2025-01-01", "endDate": "2025-02-28",
      "color": "#D72638", "weekdays": { "saturday": false, "sunday": false },
      "graphs": ["overview", "nb_diff"] },
    { "id": "nb_after", "route_id": 2195805,
      "name": "NY-9D Northbound (I-84 to Main St) - Jan-Feb 2026",
      "startDate": "2026-01-01", "endDate": "2026-02-28",
      "color": "#007F5F", "weekdays": { "saturday": false, "sunday": false },
      "graphs": ["overview", "nb_diff"] }
  ]
}
```

Note both route instances share `route_id: 2195805` — same corridor, different window. That is the
before/after idiom.
