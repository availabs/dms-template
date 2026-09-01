# Graph legend position — template default + QuickControls pill

**Project:** TransportNY · **Topic:** themes · **Status: SCOPED, not yet implemented** — awaiting
Ryan's go-ahead. · **Started:** 2026-09-01

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
- **Open question for Ryan**: what should `<NPMRDS_DEFAULT>` actually be? "Top" vs "Bottom" reads
  differently depending on chart type/height — worth picking per your actual reports, not
  guessing. (This doc uses `<NPMRDS_DEFAULT>` as a placeholder throughout.)

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

## Files likely touched (implementation, not yet started)

- `src/themes/transportny/components/ReportRouteList/useAddGraphSection.js` — seed the NPMRDS
  default at creation.
- `scripts/npmrds-reports/convert_old_reports_lib/template_specs.py` — same default for the 2
  still-hand-built template categories.
- `scripts/npmrds-reports/convert_old_reports_lib/compose_bridge.py` — trace/confirm whether the
  bridge path needs its own seed point, or inherits the JS-side fix for free.
- `src/themes/transportny/components/QuickControls/index.jsx` +
  `QuickControls.theme.js` — the new pill.

## Testing checklist (once built)

- [ ] `node scripts/npmrds-reports/probe_corpus.mjs` before/after (standing convention for any
  RRL/report touch, per `report-authoring-ux-overhaul.md`'s testing-requirements section).
- [ ] A brand-new graph created via AddGraphModal renders with the new default position.
- [ ] A brand-new old-report conversion (Python converter) renders with the new default position,
  for both a bridge-composed template and one of the 2 hand-built categories.
- [ ] The new QuickControls pill changes an existing graph's legend position, live, without
  entering the Settings drawer.
- [ ] That change survives clicking a different QuickControls pill on the same card afterward
  (Routes/Measure/When/Aggregate/Mode) — proves the "seed once, don't reassert" design actually
  holds.
- [ ] GridGraph's pill offers the 6-way corner set, every other chart type offers the 4-way set.
- [ ] Update `src/dms/skills/authoring-graphs.md` / `traversing-report-pages.md` if live
  verification surfaces anything they don't already say (standing project convention).
