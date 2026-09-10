# Graph legend position — template default + QuickControls pill

**Project:** TransportNY · **Topic:** themes · **Status: BUILT + live-verified working**, including
the 2026-09-04 default flip. Default is now `top`/`top-right` (was `bottom`/`bottom-right`,
live-verified working 2026-09-01 then superseded same-day per Ryan's feedback batch — see note
below). All 4 mint sites (`useAddGraphSection.js`, `compose_bridge.mjs`, `report_build.mjs`,
`template_specs.py`'s hand-synced dict) updated together; live-verified via
`npmrds-reports-routes-feedback-triage.md`'s Phase 1 work (paired with the new title/legend inline
row — see that doc for the live-verification detail, not duplicated here). Mechanism/pill itself
unchanged from what this doc built. · **Started:** 2026-09-01

## Objective

Follow-on from confirming (see `src/dms/planning/tasks/completed/
graph-legend-top-bottom-position-scoping.md`) that `@availabs/dms`'s `avlGraph` legend can already
render at top/bottom/left/right — no library change needed, an author can already do it from the
Settings drawer. Two NPMRDS-specific asks on top of that:

1. **Change what our own graph templates default to** — right now every NPMRDS graph (however
   it's created) inherits the DMS library's own default, `legend.position: "right"`. Want a
   different NPMRDS-specific default.
2. **A new QuickControls pill** so an author can change a graph's legend position from the
   section's header row, without opening the Settings drawer — same "discoverability shortcut,
   not a new mechanism" pattern the existing Width pill already established
   (`QuickControls/index.jsx`'s own comment on `applyWidth`).

**Constraint** (carried over from `report-authoring-ux-overhaul.md`'s Objective, still applies):
avoid changes to the `@availabs/dms` submodule if at all possible; any NPMRDS-specific default
belongs in `src/themes/transportny/`, never in `dms`.

## Current state (confirmed via source read, 2026-09-01)

Every NPMRDS graph section — however it's created — ends up going through the same one function,
`composeMeasureConfig()` (`src/themes/transportny/components/MeasurePicker/composeMeasureConfig.js`),
applied via `applyMeasurePick`/`applyMeasurePickToState`. Three creation/edit paths all funnel
through it:

- **AddGraphModal** ("+ Add Graph") → `useAddGraphSection.js` → `state =
  cloneDeep(graphComponent.defaultState)` (the DMS-library default, `position: "right"`, from
  `graph_new/config.jsx`'s `graphOptions`) → `applyMeasurePickToState(state, pick, ...)`.
- **QuickControls' own Measure/When/Aggregate/Mode/Routes pills** (an author editing an existing
  graph) — same `applyMeasurePick` call, via `QuickControlsRow`'s `applyPick` helper.
- **The Settings-drawer Measure Picker** (`MeasurePicker/index.js`) — same function again.
- **The old-report Python auto-converter** — as of round 76/77 (`convert_old_reports_lib/
  compose_bridge.py`), most templates (`BRIDGE_GRAPH_SPECS` in `template_specs.py`) now call the
  REAL `composeMeasureConfig.js` via `ssrLoadModule` (SSR bridge), not a parallel reimplementation
  — so a JS-side default change reaches these too. **Exceptions, still hand-built in Python,
  need a direct edit**: the base template (`tmc_travel_time_line_graph`, `TEMPLATE_BASE_NAME`) and
  the 5 per-TMC `categorize:"tmc"` BarGraph entries in `TEMPLATE_SPECS` (`template_specs.py`) —
  see that file's own header comment for why these two categories stayed hand-built.

`composeMeasureConfig()` only ever sets `displayPatch.legend = { show: resolutionKey !== 'summary'
}` — it never touches `position` today. The file documents its own design philosophy explicitly
(`MeasurePicker/index.js`'s header comment): **"every apply fully re-composes and overwrites the
fields it owns ... rather than tracking drift against a saved spec."** `show` is one of those
owned/reasserted fields. `position` currently is not owned by this function at all — it's simply
whatever the section's `display.legend.position` was left at, which for a brand-new section is the
DMS-library default (`"right"`), inherited once at creation and never touched again by any repick.

**One separate, already-known gotcha** (already documented in `src/dms/skills/
authoring-graphs.md`, fixed this session): the generic DMS Settings-drawer's Graph Type `select`
(`ComponentRegistry/graph_new/config.jsx` onChange) hard-resets `legend.position` to `"right"`
whenever the chart type changes. This is a `dms`-library behavior, not NPMRDS-specific, and is
**not** touched by QuickControls (which has no Graph Type pill — Graph Type is Settings-drawer
only).

## Design decision: don't make `position` a re-asserted field

`composeMeasureConfig()`'s "fully determine every field it owns" convention is deliberate for
`show`/`colors`/`tooltip` — but adopting the same pattern for `position` would actively fight Part
2 of this ask: if `displayPatch.legend.position` were reasserted on every apply, then clicking
**any** QuickControls pill (Routes, Measure, When, Aggregate, Mode) on a graph an author had
manually set to "Top" would silently snap it back to the template default the next time they
touched anything else on that same card — a QuickControls pill users would learn not to trust.

**Recommendation: treat `position` as a creation-time seed, not a re-asserted compose field.**
Set the NPMRDS default once, at the point a graph section is first minted, and leave
`composeMeasureConfig()` untouched (still never mentions `position`). Concretely:

- **`useAddGraphSection.js`** (AddGraphModal's real section-creation path) — right after `state =
  cloneDeep(graphComponent.defaultState)` (line ~73), override the seeded legend position before
  `applyMeasurePickToState` runs, e.g. `state.display.legend = { ...state.display.legend,
  position: <NPMRDS_DEFAULT> }`. Scoped to this one call site — never touches the shared `dms`
  library default, so every other DMS site (mitigateny, wcdb, tessera, avail) is unaffected, per
  the "never NPMRDS-specific logic inside dms" constraint.
- **`template_specs.py`** — for the two still-hand-built categories (the base template + the 5
  per-TMC BarGraph entries), add `"legend": {"position": <NPMRDS_DEFAULT>}` to each entry's
  `"display"` patch dict directly (`ensure_graph_templates`'s existing drift-detection will pick
  up the change and update the live template rows in place, same as any other display-patch
  edit).
- **The `BRIDGE_GRAPH_SPECS` (SSR-bridge) templates** need no separate Python-side change if the
  JS-side default above is set at the right point in the bridge's own starting state — needs a
  short trace at implementation time to confirm exactly where `compose_bridge.py`'s SSR call seeds
  its `display` object (whether it clones `graphComponent.defaultState` the same way
  `useAddGraphSection.js` does, or starts from the base template row's own persisted `display`).
  If it turns out to start from the base template row, then fixing that one row's `display.legend.
  position` (via the `template_specs.py` edit above) may already be sufficient — verify, don't
  assume, before writing code.
- **Decided 2026-09-01 (Ryan)**: `"bottom"` for every chart type for now (BarGraph/LineGraph;
  GridGraph's own corner vocabulary has no plain "bottom", so it gets `"bottom-right"` as the
  closest analog — see the map's own doc comment). Ryan explicitly flagged this may change, AND
  explicitly asked for **per-graph-type** defaults (e.g. bottom for Line, right for Bar) to be a
  real, easy-to-edit capability going forward, not just a single global constant — see
  `DEFAULT_LEGEND_POSITION_BY_GRAPH_TYPE` below, one map entry per graph type.
- **Superseded 2026-09-04 (Ryan)**: live-verified `"bottom"` first, then changed his mind — new
  default is `top`/`top-right`, paired with an ask to align the legend inline with the graph title
  to save vertical space. Same one-line-per-type map, just different values; the QuickControls pill
  and the 4 mint-site seeding mechanism described below are unaffected. See
  `npmrds-reports-routes-feedback-triage.md` Phase 1 for the combined legend-default + title-alignment
  work item.

## Part 2: new QuickControls "Legend" pill

Follows the exact shape of the existing pills in `QuickControlsRow`
(`src/themes/transportny/components/QuickControls/index.jsx`) — no new mechanism, same file.

- **Gate**: same condition as the existing Mode pill, `graphType !== 'Map' && graphType !==
  'Table'` (`hasMode`) — Map has its own, unrelated legend system (`map.theme.js`/`LegendPanel`,
  different keys: `legend-orientation`/`legend-data`), and Table has no chart legend at all.
- **Placement**: recommend the **left-aligned layout group** (alongside Move Up/Down + Width),
  not the right-aligned DATA pill cluster — legend position is a layout/visual concern like Width,
  not a data-shape concern like Routes/Measure/When/Aggregate/Mode, and keeping it out of the
  right cluster avoids adding another pill to that row's existing responsive fit/overflow budget.
- **Popover body**: a small button row, mirroring `renderWidthSection`'s pattern — Right / Left /
  Top / Bottom for every chart type except GridGraph, which needs its own 6-way corner set (Right
  / Left / Top Right / Top Left / Bottom Right / Bottom Left) — the exact same split the DMS
  Settings drawer's own `legend`/`legendForGridGraph` control groups already use
  (`ComponentRegistry/graph_new/config.jsx`), so the pill's option set should branch on
  `graphType === 'GridGraph'` the same way.
- **Write path**: a small sibling of `applyPick`, **not** routed through `applyMeasurePick`/
  `composeMeasureConfig` (this is a pure display toggle — no columns/join/comparisonSeries
  recompute needed, and routing it through the compose pipeline would risk future coupling to the
  "fully determine every field it owns" convention this doc just argued against). Pattern:
  `cloneDeep(state)`, set `nextState.display.legend = { ...nextState.display.legend, position:
  value }`, persist via `actions.updateAttribute('element', { ...sectionValue?.element,
  'element-data': JSON.stringify(nextState) })` — same persistence channel `applyPick` already
  uses, same instant-feedback mirror to `dwAPI.setState` when mounted under `SectionEdit`.
- **Current-value read**: `state?.display?.legend?.position || 'right'`.
- **Known caveat to carry into the UI** (already true today, not introduced by this pill): a
  manual Graph-Type change via the Settings drawer will still silently reset position to
  `"right"` (the `dms`-library behavior noted above) — the pill's write isn't what's fragile here,
  the Settings drawer's Graph Type control is. Not worth fixing as part of this task (would be a
  `dms`-library change, and per this project's constraint, existing behavior elsewhere).

## Implementation — DONE 2026-09-01 (code only, live-verification pending)

**Bridge trace, resolved** (this doc's own "needs a short trace at implementation time" item):
`compose_bridge.py`'s subprocess runs `compose_bridge.mjs` (a Node/Vite-SSR script, NOT
`useAddGraphSection.js`) — a genuinely separate 3rd seed point, `const state =
structuredClone(componentCfg.defaultState)`. `report_build.mjs` turned out to be a 4th,
independent seed point (`const state = structuredClone(avlGraph.defaultState)`, its own
`spec.graphs.map()`) — not caught in the original scoping pass, found while implementing. Both
needed their own call, same as `useAddGraphSection.js`.

**Single source of truth** — `composeMeasureConfig.js` (already the shared module all 4 paths
either import or `ssrLoadModule`) gained:
- `DEFAULT_LEGEND_POSITION_BY_GRAPH_TYPE` — `{ BarGraph: 'bottom', LineGraph: 'bottom', GridGraph:
  'bottom-right' }`. One line per graph type, per Ryan's explicit ask — change one line to give
  Bar a different default than Line, no other file needs touching.
- `applyDefaultLegendPosition(state, graphType)` — looks up the map (falls back to `'bottom'`),
  no-ops for `'Table'` or a state with no `display`. Called once, only at real section-creation
  time, by all 4 seed points below. Deliberately NOT called by `composeMeasureConfig()` itself —
  see the map's own doc comment for why (would fight the QuickControls pill below).
- `LEGEND_POSITION_OPTIONS` (right/left/top/bottom) + `LEGEND_POSITION_OPTIONS_GRID` (right/left/
  top-right/top-left/bottom-right/bottom-left) + `legendPositionOptionsFor(graphType)` — the same
  split `ComponentRegistry/graph_new/config.jsx`'s Settings-drawer `legend`/`legendForGridGraph`
  groups already use, reused (not re-derived) by the QuickControls pill below.

**4 seed-point call sites**, each one line:
- `useAddGraphSection.js` — `applyDefaultLegendPosition(state, pick.graphType)` right after
  `state.externalSource = ...`, before `applyMeasurePickToState`.
- `report_build.mjs` — `cmc.applyDefaultLegendPosition(state, g.graphType)` right after its own
  `structuredClone(avlGraph.defaultState)` (it already had `cmc` = the ssrLoadModule'd
  `composeMeasureConfig.js` handle, from its own pre-existing code).
- `compose_bridge.mjs` — added a new `ssrLoadModule('.../composeMeasureConfig.js')` call (`cmc`,
  matching `report_build.mjs`'s own naming) + `cmc.applyDefaultLegendPosition(state, req.graphType)`
  right after its own `structuredClone(componentCfg.defaultState)`.
- `template_specs.py` — the 2 still-hand-built categories (base LineGraph template + 5 per-TMC
  BarGraph entries) got `"display": {"legend": {"position": _DEFAULT_LEGEND_POSITION[graphType]}}`
  added directly, via a small local `_DEFAULT_LEGEND_POSITION` dict with an explicit "kept in sync
  BY HAND with composeMeasureConfig.js" comment (Python can't import the JS map — this is the one
  place the 2-systems drift risk this project already knows about, per `graph_templates.py`'s own
  header comment, still applies and has to be watched by hand).

**QuickControls "Legend" pill** — `QuickControls/index.jsx`, no theme file changes needed (reused
existing `t.pill`/`t.pillOn`/`t.popSection`/`t.popPillRow` tokens the Width pill already
established). Gated the same as Mode (`graphType !== 'Map' && graphType !== 'Table'`), placed in
the left-aligned layout group next to Width (not the right-aligned data-pill cluster/overflow
system), writes `state.display.legend.position` directly via the same `updateAttribute('element',
...)` + live-`dwAPI.setState` mirror shape `applyPick` uses — deliberately bypassing
`applyMeasurePick`/`composeMeasureConfig` entirely, per this doc's own design note. Option set
comes from `legendPositionOptionsFor(graphType)`, so GridGraph automatically gets the 6-way corner
set and every other chart type gets the 4-way set.

**Local sanity checks run** (syntax/parse only — no dev server, no DB, deliberately held per
Ryan's "another Claude is using the dev environment right now" instruction): `node --check` on
`composeMeasureConfig.js`/`useAddGraphSection.js`/`compose_bridge.mjs`/`report_build.mjs`, `python3
-m py_compile` on `template_specs.py`, and an `esbuild.transformSync` JSX parse of
`QuickControls/index.jsx` — all clean. **None of this is live verification.**

## Files touched

- `src/themes/transportny/components/MeasurePicker/composeMeasureConfig.js`
- `src/themes/transportny/components/ReportRouteList/useAddGraphSection.js`
- `scripts/npmrds-reports/report_build.mjs`
- `scripts/npmrds-reports/compose_bridge.mjs`
- `scripts/npmrds-reports/convert_old_reports_lib/template_specs.py`
- `src/themes/transportny/components/QuickControls/index.jsx`

## Testing checklist

Original build's checklist (2026-09-01) was never run before the default flip superseded it. Status
as of the 2026-09-04 flip work (see `npmrds-reports-routes-feedback-triage.md` for full detail):

- [x] A brand-new graph created via AddGraphModal (the UI "+ Add Graph" flow, `useAddGraphSection.js`)
  renders with the new default (`top`) position — verified live on a scratch page with a real route
  and real ClickHouse data (`page_25`, since deleted).
- [ ] `node scripts/npmrds-reports/probe_corpus.mjs` before/after (standing convention for any
  RRL/report touch, per `report-authoring-ux-overhaul.md`'s testing-requirements section) — **not
  run this pass**, still owed.
- [ ] A brand-new old-report conversion (Python converter) renders with the new default position,
  for both a bridge-composed template and one of the 2 hand-built categories — **not run**; only the
  `_DEFAULT_LEGEND_POSITION` dict value was updated + `py_compile`-checked, not live-verified through
  an actual conversion.
- [ ] The new QuickControls pill changes an existing graph's legend position, live, without
  entering the Settings drawer — **not re-verified this pass** (unrelated to the default-value flip;
  still resting on whatever verification the original 2026-09-01 build had, if any).
- [ ] That change survives clicking a different QuickControls pill on the same card afterward — **not
  re-verified this pass**.
- [ ] GridGraph's pill offers the 6-way corner set, every other chart type offers the 4-way set —
  **not re-verified this pass**.
- [x] Update `src/dms/skills/traversing-dms-pages.md` if live verification surfaces anything it
  doesn't already say — done (the `url_slug` prefix gotcha found while verifying Item 3, unrelated
  to legend position specifically but from the same session).
- [x] Use a dedicated scratch report for the live click-through, per this project's standing
  convention — never a page Ryan might have open. Done (`page_25`, a `report_build.mjs`-built spec
  page, both created and deleted this session).
