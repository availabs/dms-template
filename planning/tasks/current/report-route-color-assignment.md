# Report route color assignment — per-route identity color in graphs

## Status: IMPLEMENTED, live-verified 2026-07-22 (theme side). Scoped 2026-07-22, plan finalized
## 2026-07-22, built + verified same day.

**Cross-repo note:** `ReportRouteList` (the component this task edits) is manually
duplicated into transportNY with no sync mechanism — see
[`documentation/reportroutelist-cross-repo-sync.md`](../../../documentation/reportroutelist-cross-repo-sync.md).
Any change here must be manually ported there too if it needs to be user-testable
(transportNY is the only place the routecreation-tool end-to-end flow can run).

All 4 theme-side files done (schema/auto-assign, picker UI, publish wiring). Live-verified against
the pre-existing scratch page `claude_scratch_measure_picker` (id 2195034): color picker renders,
persists through `updateRoute` → `apiUpdate`, survives a full reload (dot + picker both show the
persisted color), and the identity dot renders in the collapsed row.

**A real bug was caught during live verification (by the user, not by me) and fixed same round**:
passing the inline `onChangeColor={(c) => updateRoute(...)}` callback straight through to the
library's `UI.ColorPicker` caused an infinite render loop — `Colorpicker.jsx`'s internal effect has
`onChange` itself in its dependency array (`useEffect(..., [selfColor, onChange])`), so a
freshly-identitied callback on every parent render re-fires `onChange` every render, which calls
`updateRoute`, which re-renders, which creates a new callback — unbounded. The user caught this via
their own DevTools Network tab (a request storm) while trying to verify the color-on-graph
rendering; I had missed it because my own automated verification only checked for JS errors/console
output, never actual request volume over time. Fixed in `RouteRow.jsx` by routing the callback
through a ref (`onChangeColorRef`) so the function identity handed to `ColorPicker` never changes
across renders, while always invoking the latest `onChangeColor` — confirmed live afterward: exactly
one POST per real color pick, zero requests at idle, persists correctly across reload. The two
pre-existing callers of `UI.ColorPicker` (`colorPickerComp.jsx`, `ColorControls.jsx`) never hit this
because they happen to pass a `useState` setter, which React guarantees is referentially stable —
this component was the first caller to pass a non-stable callback. Not fixed in the shared
`Colorpicker.jsx` itself (out of scope, unclear blast radius on other future callers); worth flagging
if `ColorPicker` gets a third consumer.

**Full end-to-end loop confirmed live 2026-07-22, after two more real bugs were found and fixed in
the same session:**

1. **The blank-graph scratch page was actually just "no routes assigned"** — once real routes were
   assigned to Graph 1 (by the user, testing independently), the LineGraph rendered real data
   immediately. Not a bug at all — the earlier "blank graph" note above was a false lead.
2. **Second bug, found by the user**: the ColorPicker's saturation/value gradient square rendered as
   a single flat color instead of the classic hue/saturation gradient — clicking around it DID
   change the underlying color value correctly, just with no visual feedback about where in the
   gradient you were clicking. Root cause: `ui/components/Colorpicker.jsx`'s
   `bg-[linear-gradient(...),_linear-gradient(...)]` Tailwind arbitrary-value utility silently
   compiled to `background-image: none` under this project's Tailwind v4 setup (confirmed via
   `getComputedStyle` in the live page) — a dormant bug, since both pre-existing callers of
   `ColorPicker` (`colorPickerComp.jsx`, `ColorControls.jsx`) pass `showColorPicker={false}` and so
   never actually render this gradient panel in production. `RouteRow.jsx`'s picker (`showColorPicker
   ={true}`) was the first real exercise of this code path. **Fixed** in `Colorpicker.jsx`: moved the
   two-layer gradient into an inline `backgroundImage` style (alongside the existing inline
   `backgroundColor` for hue) at both call sites (`ColorPicker` and `ColorPickerFlat`), removed the
   dead Tailwind class fragment. Rebuilt dist, confirmed live: gradient now renders correctly.
3. With the gradient fixed, a genuinely vibrant, visually-distinct color was picked and **confirmed
   live end-to-end**: the route's line color and legend swatch on the real chart updated to match,
   in real time, as the color was changed via the picker. Full loop proven.

**A third, separate, pre-existing bug was also found (by the user) and confirmed live — NOT part of
this task, not fixed here**: two routes sharing the identical `name`, both assigned to the same
graph, collapse into a single line/legend entry instead of two. Root cause (confirmed by
deliberately reproducing it): `comparisonSeries` uses the route's display `label` as the ONLY series
discriminator (both the server's `__series` SQL alias and the client's grouping key) — two variants
with an identical label are indistinguishable by design, merge into one data series, and
`colorsByKey` (keyed by that same label) just has the later duplicate's color overwrite the
earlier's in the map. This predates the color feature entirely and isn't something the color
threading caused or could avoid — see `comparison-series-explicit-color.md`'s note. A real fix needs
a stable per-route key independent of the editable display name, threaded through
`comparisonSeries`'s whole fan-out/grouping/legend-label pipeline — a separate, nontrivial task, not
scoped here. The library-side task file has a fuller writeup.

**Decision confirmed with user 2026-07-22: Option A (library-side).** Full render-path plan is in
the library-side task, `src/dms/planning/tasks/current/comparison-series-explicit-color.md` — read
that first; it corrects one detail in this doc's original sketch (color never needs to reach
`buildUdaConfig`'s server-bound `options.seriesVariants` — it's a pure client-rendering concern
threaded via `state.comparisonSeries` directly into the chart-type wrappers). This doc still owns
everything below: the route schema, the picker UI, and publish-time threading (all dms-template
theme-side, no library dependency to start those in parallel).

## Origin

Gap 02 of `research/report-page-redesign/findings.md`'s old-tool-vs-new-tool audit (Gap 01, the
inline Measure/Comparison Mode quick controls, shipped separately — see
`planning/tasks/completed/avl-graph-quick-controls.md`). The audit flagged this gap as
**unconfirmed** — whether anything in the new tool already covers the old tool's two color systems.
This document is that confirmation pass plus the resulting scope.

## Objective

Let an author assign each **route** in `ReportRouteList` a consistent identity color, so that route
appears in the same color on every graph in the report it's plotted on — mirroring the old tool's
per-route free-form color system. Auto-assign from a cycling palette when a route is added (matching
old-tool behavior), with a per-row override control.

## Old-tool ground truth (from findings.md, restated for this doc's self-containedness)

Two **independent** color systems existed:
- **(a) Per-route/station identity color** — free-form HSV picker
  (`Sidebar/components/ColorPicker.jsx`), new routes auto-assigned from a shared cycling palette
  (`COLORS`/`getRouteColor()`/`getStationColor()` in `store/index.js`). This is the gap this task
  covers.
- **(b) A separate graph color-***range*** picker** (`ColorRangeSelector.jsx`, ColorBrewer-style
  diverging/sequential palettes, length 3–9, reversible) for choropleth/heatmap-style graphs
  (`isColorfull` graph types) — colors grid cells/fills **by value**, unrelated to route identity.

## Current state (confirmed by direct code reading, 2026-07-22)

**(b) is already covered — not a gap.** `ComponentRegistry/graph_new/config.jsx` already exposes a
real Settings-drawer "Colors" section: `colors.scheme` (select, ColorBrewer categorical/diverging/
sequential/cyclical options built in `colorSchemeUnifier.js`) and `colors.reverse` (toggle), plus
`colors.byValue`/`byValueSymmetric`/`nullColor` for value-driven graphs (GridGraph, BarGraph). This
is a faithful, already-shipped equivalent of the old tool's `ColorRangeSelector`. One related wrinkle
worth noting but **not itself in scope**: `MeasurePicker/composeMeasureConfig.js`'s `buildDiffColors()`
auto-writes `display.colors` from the measure's vocabulary entry whenever Comparison Mode is
"difference" (`data-types/npmrds_graph_vocabulary/vocabulary.json`'s `comparisonModes.difference.
defaultColorRange`) — an author's manual `colors.scheme` override could get silently clobbered the
next time Measure or Comparison Mode is changed via the picker/QuickControls. Not addressed here;
flag if it becomes a real complaint.

**(a) is a confirmed, genuine gap.** `ReportRouteList.jsx`/`RouteRow.jsx` have **no route-color field
at all** — every "color" match in those files is a `Button`'s `themeOptions.color` (button chrome
styling), not route identity. Each route object (managed by `useReportRow.js`, persisted via
`persistRoutes`) carries `route_comp_id`, `name`, `tmc_array`, `startDate`/`endDate`, `weekdays`,
`graphIds` — no `color`.

**How series get colored today (positional, not identity-based)** — confirmed via direct read of the
chart rendering path:
- `avl-graph/utils/index.js` — `getColorFunc(colors)` returns `(d, i) => colorRange[i % colorRange.length]`
  — indexes into a flat color array **by the series' position in the current dataset**, not by any
  stable key. Used identically by BarGraph, LineGraph, PieGraph, SunburstGraph, TreemapGraph, GridGraph.
- `colorRange` is `display.colors.value` when `display.colors.type === "palette"` (resolved in
  `ui/components/graph_new/components/BarGraph.jsx`), or computed from `display.colors.scheme` via
  `getColorRange(scheme, keys.length)` otherwise.
- Default palette: `ComponentRegistry/graph_new/config.jsx` — `DefaultPalette = getColorRange(20,
  "div7")`, set as the component's `defaultState.display.colors`.
- Consequence: if a route is removed/reordered/added to a graph's route subset, **every other
  route's color on that graph can shift**, and the same route can show different colors across
  different graphs on the same report (each graph's own series ordering is independent). This is the
  precise gap the old tool's per-route identity color avoided.

**How routes reach a graph today** (`ReportRouteList/useGraphPublish.js`) — each graph discovers its
own assigned route subset and gets it published via `setActionParam` as an array of
`{label, filters}` **variants** (built by `transformReportRoutes()`, `useGraphPublish.js:62-88`) —
keyed to the graph's own self-derived `paramKey` (`$self` sentinel resolution, see
`ReportRouteList/README.md`). `buildUdaConfig.js` fans these variants out into the actual plotted
series. This is the natural place to thread a per-route `color` through: add `color: route.color` to
the object `transformReportRoutes` returns per route (`useGraphPublish.js:83-86`).

**Existing reusable primitive**: a generic `colorpicker` control type already exists
(`ui/components/navigableMenu/index.jsx`'s `ColorPickerControl`, used today for a graph's hover-
highlight color, richtext config, and sectionMenu). No per-list-item (per-row) usage exists yet, but
it's the right control to reuse rather than building a new swatch/picker from scratch.

## Scope

### In scope
1. **`route.color` field** — added to the route object schema (`useReportRow.js`/`RouteRow.jsx`),
   auto-assigned from a cycling palette when a route is created (mirroring the old tool's
   `getRouteColor()` — likely reuse the same `DefaultPalette`/`getColorRange` primitive already used
   for the graph's own default series palette, for visual consistency between "no explicit color set"
   states and the picker's own swatch options).
2. **Per-row color swatch + picker** in `RouteRow.jsx`, using the existing `colorpicker` control
   (`ColorPickerControl`) — one swatch per route, click to override.
3. **Thread `color` through publishing** — `transformReportRoutes()` includes `color: route.color`
   in each variant it returns.
4. **Consume the explicit color in the render path** — the real design fork, see below.

### Explicitly out of scope this round
- **The `buildDiffColors`/manual-override clobber wrinkle** noted above (color-range picker, not
  per-route identity) — separate, lower-priority, not raised as a real complaint yet.
- **Station color** (old tool's `getStationColor()`) — no equivalent "station" concept exists in the
  new tool's report model at all (routes only); out of scope unless stations get built as their own
  feature first.
- **Gap 03** (card visual/density polish) — separate item in `findings.md`, not touched here.

## Architecture decision — RESOLVED 2026-07-22

Option A confirmed. Full render-path plan (and the finding that `color` never needs to reach
`buildUdaConfig`'s server-bound `options.seriesVariants` — it's threaded client-side via
`state.comparisonSeries` instead) is in
`src/dms/planning/tasks/current/comparison-series-explicit-color.md`. Do not re-derive that plan
here; read it before touching any library code.

## Theme-side implementation plan (this repo, dms-template)

Everything below is scoped to this repo and has no dependency on the library task landing first —
`route.color` will simply have no visible effect on any graph until the library-side primitive
ships, but the schema/UI/publish-threading work is independently valid and can proceed in parallel.

### 1. `useReportRow.js` — route schema + auto-assignment

- Import `getColorRange` from `../../../../dms/packages/dms/src/ui/components/graph_new/colorSchemeUnifier`
  (same module `ComponentRegistry/graph_new/config.jsx` uses for its `DefaultPalette = getColorRange(20,
  "div7")` — reuse the identical palette for visual consistency between a graph's own default series
  colors and a route's auto-assigned identity color).
- In `addRoute` (~line 214-242), when building `newRoute`, auto-assign a color cycling through that
  palette by the route's position: `color: PALETTE[routes.length % PALETTE.length]`. `routes.length`
  (the count *before* the new route is appended) is the right index — first route gets palette[0],
  etc. — mirrors old-tool `getRouteColor()`'s cycling behavior.
- No change needed to `updateRoute` — it already accepts an arbitrary `{ index, updates }` object
  and writes any field (`newRoutes[index][field] = finalValue` at line ~292), so
  `updateRoute({ index: i, updates: { color: newColor } })` from the picker just works today.

### 2. `RouteRow.jsx` — per-row swatch + picker

- New prop `onChangeColor(newColor)` passed in from `ReportRouteList.jsx` (mirrors the existing
  `onToggleGraph`/`onRemove` callback-prop pattern — `RouteRow` stays purely presentational, owns no
  persistence).
- Use `UI.ColorPicker` (the library's already-exported, already-generic component —
  `ui/index.js:72`, default export of `ui/components/Colorpicker.jsx`) — **not** the internal
  `ColorPickerControl`/`ColorPickerFlat` used by `navigableMenu` (those aren't part of the public
  `UI` object; reaching for them would mean a direct deep import, violating this repo's "always
  access UI components through ThemeContext" convention documented in `src/dms/CLAUDE.md`).
  `UI.ColorPicker` takes `{ color, onChange, colors, showColorPicker }` — pass
  `colors={PALETTE}` (same palette as step 1, imported once and shared) and `showColorPicker={true}`
  to always show the full HSV/hex picker inline (mirrors the old tool's free-form picker, not just a
  fixed swatch grid).
- Placement: a small always-visible color dot next to `r.name` in the collapsed header (pure visual
  identity, no interaction) + the full `UI.ColorPicker` inside the expanded content (`isEdit` only),
  next to the other per-route edit affordances (dates, TMCs, remove).

### 3. `ReportRouteList.jsx` — wire the callback

- Add `onChangeColor={(c) => updateRoute({ index: i, updates: { color: c } })}` to the `<RouteRow>`
  invocation in the `filteredEntries.map(...)` loop (~line 188-221), alongside the existing
  `onToggleGraph`/`onRemove` props.

### 4. `useGraphPublish.js` — thread `color` into published variants

- `transformReportRoutes()` (~line 62-88) — the returned object (line 83-86) becomes:

  ```js
  return {
    label: route.name,
    filters: { op: "AND", groups: groups },
    ...(route.color ? { color: route.color } : {}),
  };
  ```

  This is the object that flows through `setActionParam` → page-state action param →
  `resolveComparisonVariants` (library-side task, step 1) → `state.comparisonSeries.config` on every
  graph the route is assigned to.

## Files requiring changes

| File | Change |
|---|---|
| `src/themes/transportny/components/ReportRouteList/useReportRow.js` | Add `color` to route schema; auto-assign from `getColorRange(20, "div7")` cycling on `addRoute` |
| `src/themes/transportny/components/ReportRouteList/RouteRow.jsx` | Color dot (collapsed) + `UI.ColorPicker` (expanded, edit mode) |
| `src/themes/transportny/components/ReportRouteList/ReportRouteList.jsx` | Wire `onChangeColor` → `updateRoute({ index, updates: { color } })` |
| `src/themes/transportny/components/ReportRouteList/useGraphPublish.js` | `transformReportRoutes()` includes `color: route.color` per variant (line 83-86) |
| *(library — see `comparison-series-explicit-color.md`)* | Render-path: `getColorFunc`/Legend keyed lookup, `resolveComparisonVariants` color passthrough |
| `src/dms/packages/dms/src/ui/components/Colorpicker.jsx` *(bugfix, found live)* | Saturation/value gradient moved to inline `backgroundImage` — dead Tailwind arbitrary-value class was compiling to no CSS |

## Testing checklist

- [ ] A new route gets an auto-assigned color distinct from existing routes on the same report (cycling palette, no immediate repeats) — not yet tested with a fresh `addRoute` call
- [x] Overriding a route's color via the picker persists — live-verified 2026-07-22 (survives full page reload, dot + picker both reflect the new color)
- [x] The explicit color actually renders as the line/legend color on a real chart, and updates live
      when changed — live-verified 2026-07-22 on `claude_scratch_measure_picker` (LineGraph, real
      ClickHouse data)
- [ ] The same route shows the identical color across two different graphs on the same report — not yet directly tested (only one graph available on the scratch page)
- [ ] Adding/removing/reordering routes on a graph does not shift other routes' colors — not yet directly tested
- [x] Two routes sharing the identical name on the same graph: confirmed they collapse into one
      series (pre-existing `comparisonSeries` limitation, not caused by this change — see Status).
      Not a pass/fail item for this task; documented as a known, separate limitation.
- [x] A route with no explicit color still renders sensibly (falls back cleanly, no crash) — confirmed both in code (`r.color || '#000000'` fallback in `RouteRow.jsx`) and live (pre-existing routes without a color rendered fine before one was set)
- [ ] Existing non-report AVL Graph sections (no `ReportRouteList` sibling) are unaffected — regression check — covered on the library side, not re-tested here
- [ ] `colors.scheme`/`colors.reverse` (Gap 02b, already-shipped) still work unchanged on a report graph after this change
- [x] Picker interaction does not cause a render loop / request storm — confirmed exactly one POST per real color pick, zero requests at idle, on repeated expand/collapse and repeated color picks
- [x] ColorPicker's saturation/value gradient renders correctly (not a flat color) — live-verified 2026-07-22 after the `Colorpicker.jsx` fix

## Cross-references

- `research/report-page-redesign/findings.md` — Gap 02
- `src/themes/transportny/components/ReportRouteList/README.md` — storage/publishing model
- `planning/tasks/completed/avl-graph-quick-controls.md` — sibling task, library/theme boundary precedent
- `src/dms/planning/tasks/current/comparison-series-explicit-color.md` — library-side render-path plan (owns everything the chart actually needs to render the color)
