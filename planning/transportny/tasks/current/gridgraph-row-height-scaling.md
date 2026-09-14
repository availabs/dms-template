# GridGraph row-height-by-TMC-length (default) + optional row-average strip

**Project:** TransportNY · **Topic:** themes · **Status:** Part 1 BUILT 2026-09-02 (not yet live-verified against a real dev-DB query — see Testing checklist); Part 2 SCOPED ONLY, explicitly not started · **Started:** 2026-09-02

## Decisions (Ryan, 2026-09-02)

- **No retroactivity/backfill.** Don't worry about already-built report pages' GridGraphs — the
  default only applies to freshly-composed sections (a new pick through the Measure Picker or
  `report_build.mjs`), same as this file's own Part 1 recommendation. Nothing further to decide.
- **Part 2 (row-average strip): scope only, not built.** If it's ever built, it must ship with a
  real user-facing toggle/control (option 3 in the Part 2 section below — a checkbox in the
  Measure Picker / Add Graph Modal), not just a skill recipe or a spec-only flag — "everything we
  do now needs a user facing toggle/control." Not started; do not build without a separate go-ahead.
- **Part 1: built this session**, see "What was built" below.

## Objective

For per-TMC GridGraphs (one row = one TMC) in NPMRDS Reports:

1. Make row height proportional to TMC length (`miles`) the **default**, so a grid visually reads
   as a real space-time diagram (a long TMC gets a tall row) instead of every TMC getting an equal
   sliver regardless of real-world length.
2. Add an **optional** narrow strip alongside the main grid showing each row's overall average
   value (not bucketed by time), toggleable — not default.

Both are asked for "exactly like" the live reference at devtny.org's TSMO Corridor View. Per Ryan
(mid-scoping): don't chase the old pre-DMS transportNY tool for this — the equivalent, already
proven, lives inside DMS itself (see below) and is the real reference.

## The good news: the rendering primitive already exists and is proven live

Both asks are **already fully supported by the `graph_new` GridGraph component** — no new
rendering-layer code is needed for either one. This was almost certainly built for, and is proven
live on, DMS page `tsmo2/corridor_view` (page id 2182912; owning build script
`src/themes/transportny/qa_skills/tools/builds/build_tsmo2_corridor_view.mjs`; not the same as the
old transportNY-repo `pages/analysis`/`CorridorView` React code, which is unrelated).

**Row-height mechanism** (`GridGraphWrapper`,
`src/dms/packages/dms/src/ui/components/graph_new/components/GridGraph.jsx:37-47,74-79`): a column
targeted `"height"` is read once per yAxis group and becomes that row's `height`
(`Math.max(0.0001, +value || 1)`, uniform `1` if absent — fully backward compatible). The renderer
(`avl-graph/GridGraph.jsx:255-261,337`) sums all row heights into a linear scale
(`hScale = scaleLinear().domain([0, dataHeight]).range([0, adjustedHeight])`) and positions/sizes
each row through it — ticks, midpoints, everything already respects it. (A sibling `"width"`/`"size"`
target does the same for grid *columns* — e.g. TMC length on an x-axis-is-distance grid — but the
live reference doesn't use it, since its x-axis is time; not needed for this ask.)

Confirmed live use — `tsmo-cv-grid` group, main time-space grid (GridGraph, `size: 11` of 12
columns):
```
columns: [
  { name: "...as seg", target: "yAxis", group: true },                    // per-TMC row
  { name: "...as tod", target: "xAxis", group: true, sort: "asc" },       // 5-min time bucket
  { fn: "exempt", name: "least(round(avg(meta.miles/nullif(ds.travel_time_all_vehicles,0)*3600)),80) as speed",
    target: "color" },                                                    // cell value
  { fn: "exempt", name: "round(max(meta.miles),3) as rowmiles", target: "height" },  // ← the row-height column
  { fn: "exempt", name: "max(ds.tmc) as rowtmc" }                         // (unrelated — incident overlay rowKey)
]
```
`meta.miles` is `table1.miles` off the same NPMRDS-meta join (source 582 / view 983,
`NPMRDS_V6_tmc_meta`) that the `speed` cell expression *already* reads — nothing new had to be
joined in for this specific page. `fn: "exempt"` + `max(...)` (not `avg`) matches the existing
self-aggregating-expression convention (`TMC_GRAIN_MEASURE_OVERRIDE` in `composeMeasureConfig.js`)
used elsewhere to avoid ClickHouse's nested-aggregate error — `max` is safe here because the value
is constant across every row in the TMC's group.

**Row-average strip mechanism** — a *second*, independent, narrow GridGraph section
(`size: 1` of 12 — this is literally the "corridor-view 52px day-avg strip" referenced in
`avl-graph/components/HoverCompContainer.jsx:57`) placed immediately to the right of the main grid,
in the same section group:
```
columns: [
  { name: "...as seg", target: "yAxis", group: true },                    // SAME per-TMC row column
  { fn: "exempt", name: "max(meta.road_order) as roadpos", sort: "asc" }, // SAME row order
  { name: "'avg' as tod", target: "xAxis", group: true, sort: "asc" },    // ← ONE constant xAxis key -> exactly 1 column
  { fn: "exempt", name: "least(round(avg(meta.miles/nullif(ds.travel_time_all_vehicles,0)*3600)),80) as speed",
    target: "color" },                                                    // SAME expr, but no time grouping -> whole-range average
  { fn: "exempt", name: "round(max(meta.miles),3) as rowmiles", target: "height" }  // SAME height column -> rows line up pixel-for-pixel
]
display: { xAxis: { show: false }, yAxis: { show: false }, legend: { show: false } }
```
captioned by a plain lexical "day Avg" heading placed above it, not by the grid itself. **This is a
pure composition pattern — two sibling GridGraph sections sharing the same yAxis/height columns —
not a new library capability.**

## What's actually missing (the real scope of work)

Neither gap is in the rendering component. Both are in the **authoring path** — NPMRDS Reports
sections are composed through `composeMeasureConfig.js` (Measure Picker / Add Graph Modal), not
hand-edited JSON the way the corridor_view page was built via the CLI.

### Part 1 — row-height default

- **Gap A (small, not blocking):** `ComponentRegistry/graph_new/config.jsx`'s column "Target"
  select (~line 176) offers X axis / Y axis / Categorize / Index / Slice / Rectangle / Color
  (each gated by `displayCdn`) but has **no "Height" or "Width"/"Size" option**, even though the
  wrapper already reads both. An author hand-editing a GridGraph section today cannot pick either
  target from the UI. Fix: two new entries gated `display.graphType === "GridGraph"`, same pattern
  as the existing "Color" entry.
- **Gap B (the real work):** `composeMeasureConfig.js` has `buildGridBreakdownColumn()` (line 311)
  for the yAxis per-TMC column but no sibling that builds a `target: 'height'` column. Needs a new
  `buildGridHeightColumn(externalSourceColumns)`, wired in alongside `buildGridBreakdownColumn` at
  its call site (~line 489) whenever `graphType === 'GridGraph' && gridBreakdownColumn` — i.e.
  whenever there's a per-TMC row breakdown at all, which is exactly the "1 row = 1 tmc" condition
  Ryan named as the trigger for making this the default.
- **Gap C (the sharp edge):** `buildJoin(measure)` only joins `META_JOIN` (the source with `miles`)
  for measures whose own expression needs it. Checked every measure in `vocabulary.json`:
  `speed`/`speedTruck`/`length`/`aadt`/`hoursOfDelay`/`avgHoursOfDelay`/both `co2Emissions*` pairs
  all already require it — but **`travelTime` (`requiresJoin: []`) does not**, and travelTime is
  very likely the single most common per-TMC GridGraph measure. Building a height column
  unconditionally will silently fail to resolve `table1.miles` unless the join-key set is widened
  to always include `META_JOIN` when composing a GridGraph with a tmc breakdown, independent of
  what the picked measure itself needs.
- **Retroactivity — resolved, no backfill.** Ryan's call: only freshly-composed sections pick
  this up (a new section, or an existing one re-picked through the Measure Picker/`report_build.mjs`);
  already-built report pages' GridGraphs are untouched. This falls out for free from where the
  fix lives (`composeMeasureConfig.js`, the compose-time function) — nothing extra needed to
  enforce it.
- **Data-quality unknown, not checked:** how many TMCs have null/0 `miles` in META_JOIN in
  practice? The existing `Math.max(0.0001, ...)` floor prevents a crash, but a 0-mile TMC would
  visually collapse to a hairline row. Still not checked — worth a spot-check before/soon after
  this reaches real report pages.

## What was built (2026-09-02)

All three gaps above, built and unit-verified (pure-function test against `composeMeasureConfig`
directly — no DB/dev-server dependency, see "Verification" below). Retroactivity needed no code
(see the resolved bullet above); Part 2 was explicitly NOT built (see Decisions).

- **`composeMeasureConfig.js`** (`src/themes/transportny/components/MeasurePicker/`):
  - `GRID_ROW_HEIGHT_MEASURE` + `buildGridHeightColumn()` — a `target:'height'` column reading
    `round(max(table1.miles),3) as tmc_miles`, built via the existing `buildMeasureYAxisColumn`
    helper (same shape every other measure/color column already uses — no new column-building
    machinery). Composed whenever `gridBreakdownColumn` exists (i.e. `graphType==='GridGraph'`),
    matching the "unconditional for every per-TMC GridGraph pick" rule.
  - `GRID_HEIGHT_FORCED_JOIN_MEASURE_OVERRIDE` — the fix for Gap C: when the height column forces
    `META_JOIN` in for a measure that wouldn't otherwise carry one (only `travelTime` today), that
    measure's own value expression is swapped for a `ds.`-qualified twin (`ds.tmc`,
    `ds.travel_time_all_vehicles`) so its previously-bare `tmc` reference doesn't become ambiguous
    against `META_JOIN`'s own `tmc` column. Fires only in that one forced-join case — a plain
    travelTime pick on any other graph type is byte-for-byte unaffected (verified).
  - `join` composition: when the height column is present, the join-key list is
    `[...new Set([...(measure.requiresJoin||[]), 'META_JOIN'])]` instead of the measure's own
    `requiresJoin` — Set-dedup preserves `table1`/`table2` ordering for every measure that already
    lists `META_JOIN` (verified against `hoursOfDelay`'s 2-join case), so this is a no-op there.
  - `columns` return value now includes `gridHeightColumn` alongside the existing three.
- **`MeasurePicker/index.js`**: added `'height'` to `MANAGED_TARGETS` — without this, a re-pick
  (measure/resolution change, or round-tripping the graph type through and back out of GridGraph)
  would leave a stale height column in place and append a second one alongside it, the same
  duplicate-column bug this list already exists to prevent for `xAxis`/`yAxis`/`color`/`delta`.
- **`ComponentRegistry/graph_new/config.jsx`** (submodule `src/dms`, Gap A): added "Height" and
  "Width" to the column Target picker, gated to GridGraph like the existing "Color" entry — an
  author hand-editing a GridGraph section's columns can now pick either target from the UI
  instead of only via direct JSON/CLI editing. Purely additive; not itself exercised by the
  default (that's compose-time, not UI-driven), but closes the "renderer supports it, UI doesn't
  expose it" gap identified in scoping. **Note:** this file lives in the `src/dms` git submodule —
  flagging in case it should get its own submodule-side task entry (`src/dms/planning/`); not
  created here given the size/risk of the change (2 additive dropdown entries).

### Verification

Ran a direct pure-function check against `composeMeasureConfig` (vitest, scratch test file,
deleted after — not a permanent addition to the test suite) with real `BASE_SOURCE.sourceInfo.columns`,
no DB dependency:

- `travelTime` + GridGraph: height column present (`table1.miles`-sourced), join now includes
  `table1 = META_JOIN` (source 582/view 983), and the color column correctly reads
  `ds.tmc`/`ds.travel_time_all_vehicles` — no bare `tmc` left anywhere in the composed expression.
- `speed` + GridGraph (already-joined measure): height column present; join **unchanged in shape**
  (still just `table1 = META_JOIN`, no `table2`); speed's own color expression is **byte-identical**
  to before this change (the override correctly does not fire for an already-joined measure).
- `hoursOfDelay` + GridGraph (2-join measure): height column present; join ordering preserved
  (`table1 = META_JOIN` source_id 582, `table2` = AADT_DIST_JOIN still present and second).
- `travelTime` + **LineGraph** (non-GridGraph, regression check): no height column, no forced
  join, travelTime's yAxis column is its original bare (unqualified) expression, completely
  unaffected — confirms every non-GridGraph measure pick is untouched by this change.

**Not yet done** (see Testing checklist below, unchanged from the original scoping pass): a real
live build through the Measure Picker or `report_build.mjs --dry-run`/`--summary` against the real
dev DB (needs VPN), visual confirmation of varying row heights on an actual per-TMC GridGraph, and
a `probe_corpus.mjs` golden-corpus regression pass. The pure-function check above proves the
composed *query shape* is correct; it does not prove the live query executes/renders correctly
end-to-end.

### Live-verified 2026-09-02 (Ryan): a fresh travelTime GridGraph works

Confirmed live: a brand-new travelTime GridGraph shows correct data and correctly varying row
heights. While testing it, Ryan also caught a **pre-existing, unrelated bug** switching the same
section from Travel Time to Speed (Truck) — the tooltip stayed in `M:SS` duration formatting
instead of switching to Speed's own format. Root cause: `displayPatch.tooltip`'s
`valueFormat`/`yFormat` were only ever set (to `'duration_mmss'`) for `measureKey === 'travelTime'`
and otherwise omitted from the object entirely — but `applyMeasurePickToState` **merges**
`display.tooltip` onto the existing state rather than replacing it, so a value only ever *set*,
never *cleared*, survives every later re-pick to a different measure. Same bug class this exact
file already guards against for `xAxis.format`/`yAxis.format`/`legend.show` (each has its own
explicit "clear the stale value" comment) — this was the one remaining spot that didn't.
**Fixed**: `valueFormat`/`yFormat` are now always explicitly set, `'duration_mmss'` for travelTime
or `null` otherwise, so a re-pick always fully determines the tooltip format.

While fixing it, found and consolidated an unrelated duplication: `GRID_HEIGHT_FORCED_JOIN_
MEASURE_OVERRIDE.travelTime` (added this session) and the pre-existing `QUALIFIED_EXPR_WHEN_TABLE_
HAS_JOIN.travelTime` (used by `composeTableMeasuresConfig`'s multi-measure union-join path) held
the **identical** `ds.`-qualified travelTime SQL string, typed independently — same root cause
(travelTime's bare `tmc` becomes ambiguous once ANY join forces the base table to be aliased),
two different call sites that can each force a join in. Both now read from one shared
`TRAVELTIME_JOIN_QUALIFIED_EXPR` constant so they can't independently drift.

Verified via the same pure-function approach (vitest, scratch file, deleted after): travelTime gets
`duration_mmss`; a re-pick to `speedTruck` gets an explicit `null` (not omitted); and a direct
simulation of `applyMeasurePickToState`'s own merge (`{...staleTooltipWithMmss, ...newComposed}`)
confirms the merged result no longer carries the stale format.

### Part 2 — row-average strip (toggle, not default)

Since it's authoring composition (not a rendering feature), the "toggle" has to live somewhere in
the authoring tooling. Three shapes, cheapest first — worth deciding between before building:

1. **Skill-only recipe, zero code.** Write up the exact recipe above in
   `src/dms/skills/authoring-graphs.md` (or `creating-reports.md`) so a human or an AI building a
   report spec can add the strip by hand. Doesn't literally satisfy "a toggle," but is the cheapest
   correct baseline and unblocks doing this today.
2. **Spec-level flag in `report_build.mjs`.** NPMRDS Reports' primary authoring path is spec-first
   (`creating-reports.md`); the pipeline already does similar multi-artifact choreography elsewhere
   (difference-graph RRL choreography is the closest precedent, not independently re-traced here).
   A GridGraph template spec gains e.g. `showRowAverageStrip: true`, and the build script emits the
   second section automatically, pre-wired, positioned next to the first. This is the natural
   "toggle" for the actual production authoring path.
3. **UI-level toggle in the Measure Picker / Add Graph Modal.** Highest cost, most author-facing:
   a checkbox that on submit creates a second sibling section instead of patching one. Not
   confirmed in this pass whether `useAddGraphSection.js`/`AddGraphModal.jsx`'s current
   single-section-patch flow supports spawning two sections from one pick at all.

**Recommendation:** start with (1) + (2) — they cover the real production path (spec-first
authoring) at much lower cost than (3). Revisit (3) only if ad-hoc in-UI report editing turns out
to need it too.

**Open item, not resolved here:** the two sibling GridGraphs each compute their own color domain
independently from their own data (`buildValueColorScale(min, max, colors)` — see
`GridGraph.jsx:139-145` — unless `colors.domainMin`/`domainMax` are pinned). Neither block on the
reference page pins a fixed domain, so the strip's color scale is **not guaranteed to match** the
main grid's (e.g. if the day's worst average happens to be milder than the day's worst 5-minute
reading, "the same red" could mean two different speeds in the two panels). `composeMeasureConfig.js`
already supports pinning a fixed domain (`colorBreaks.json`-driven for some measures) — worth
deciding whether the strip should inherit the main grid's domain explicitly. Flag for Ryan's call
before implementing.

## Files requiring changes

- `src/themes/transportny/components/MeasurePicker/composeMeasureConfig.js` — **DONE**:
  `buildGridHeightColumn`, `GRID_HEIGHT_FORCED_JOIN_MEASURE_OVERRIDE`, join-key widening (Part 1).
  Average-strip spec wiring (Part 2, option 2) NOT done — Part 2 not started.
- `src/themes/transportny/components/MeasurePicker/index.js` — **DONE**: `'height'` added to
  `MANAGED_TARGETS` (not originally listed as a file to touch — found during implementation).
- `src/dms/packages/dms/src/patterns/page/components/sections/components/ComponentRegistry/graph_new/config.jsx`
  — **DONE**: added Height/Width to the Target select.
- `scripts/npmrds-reports/report_build.mjs` (+ `convert_old_reports_lib/*` if the old-template port
  should get the same default) — **not touched**. `report_build.mjs` needs no separate change for
  Part 1 (it calls the same `applyMeasurePickToState`/`composeMeasureConfig` as the live Measure
  Picker, so the fix applies there automatically). `convert_old_reports_lib/*` (the Python
  old-report-port converter) was deliberately left alone — that path is for porting old/historical
  report content, which falls under "don't worry about retroactive/existing reports" per the
  Decisions above; revisit only if Ryan wants the old-report port to pick up the same default.
- `src/dms/skills/authoring-graphs.md` or `creating-reports.md` — **not done**. Worth a short note
  now that Part 1 ships a real default (an author picking a per-TMC GridGraph measure should know
  row height means something); full average-strip recipe docs wait for Part 2.

## Testing checklist

- [x] Pure-function verification (`composeMeasureConfig` called directly, no DB) — see
      "Verification" above. Confirms the composed query *shape* is correct for travelTime (forced
      join + re-qualified expr), speed (unchanged), hoursOfDelay (join ordering preserved), and a
      non-GridGraph pick (untouched).
- [x] A freshly Measure-Picked per-TMC GridGraph on `travelTime` (the currently-unjoined case)
      renders with visibly varying row heights and no query error, against the real dev DB.
      **Live-verified by Ryan, 2026-09-02** — also surfaced and fixed the tooltip-format bug above.
- [ ] A freshly Measure-Picked per-TMC GridGraph on `speed`/`length`/other already-joined measures
      is unchanged except for row height, against the real dev DB.
- [ ] `probe_corpus.mjs` golden-corpus regression pass (GridGraph baselines especially) — this
      changes every fresh per-TMC GridGraph's row geometry.
- [ ] Data-quality spot-check: how many TMCs have null/0 `miles` in META_JOIN in practice (flagged
      above, still not checked).
- [ ] (Part 2, not started) Row-average strip: rows visually line up 1:1 with the main grid, at
      both a short (3-TMC) and long (20+-TMC) test corridor.
