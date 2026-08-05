# Port transportNY map plugins into dms-template via theme

**Project:** TransportNY

## Objective

Map plugins currently only work in the transportNY repo (the only remaining repo with that
overall architecture generation). Port them so they work in dms-template like custom components
or section header extensions — configured and loaded through `theme`, not a site-level prop.

## Scope

- **In scope**: `routecreation` (actively developed, live-verified in transportNY), `macroview`
  (user wants it fixed — was functional after prior porting work, broke since).
- **Explicitly out of scope for now**: `rerouter` — user: "If we hear from a coworker or client
  that they want it ported, we can do it then." Don't revisit unless that happens.
- **Excluded**: `pointselector` (no confirmed live usage, depends on legacy `dama` falcor routes
  dms-server has largely moved off of), `routing` (confirmed fully dead code in transportNY —
  commented out in both its plugin registries, no callers anywhere).

## Current State

- The registration mechanism itself is done — see `src/dms/planning/tasks/completed/map-plugins-theme-registration.md`.
  A theme can now declare `theme.mapPlugins = { <name>: <pluginObject> }` and it'll register into
  the same `PluginLibrary` the report-page `Map` section already consumes.
- All actual plugin *code* lives only in transportNY, at
  `src/pages/TransportNYDataTypes/plugins/<name>/`. dms-template has never had a native
  implementation of any of these — `research/route-creation/findings.md` and this repo's other
  route-creation docs are planning/research trail, not the implementation.

## Proposed Changes

### Phase 1 — routecreation — DONE, live-verified 2026-07-29

Ported to `src/themes/transportny/components/routecreation/` (mirrors transportNY's file
structure exactly: `routecreation.plugin.jsx`, `comp.jsx`, `internalPanel.jsx`, `dataUpdate.jsx`,
`constants.js`, `paint.js`, `utils.jsx`, `hooks/*`, `components/*`). Registered via
`theme.mapPlugins.routecreation` in `theme.js`.

**Adjustments made during the port** (behavior-preserving, not design changes):
- Context imports (`CMSContext`, `MapEditorContext`, `PageContext`, `fetchBoundsForFilter`,
  `nameToSlug`, `convertToUrlParams`) rewritten from transportNY's `~/modules/dms/packages/dms/src/...`
  aliases to relative paths into dms-template's own `src/dms/packages/dms/src/...` copy of the
  same shared `@availabs/dms` submodule — same library, different repo-relative path.
- `Button` (was `~/modules/avl-components/src`, a transportNY-only submodule dms-template doesn't
  have) replaced with dms-template's own `UI.Button` via `ThemeContext` — same `themeOptions={{color,size}}`
  prop API, confirmed by reading both components' source, so no behavior change.
- Added `d3-scale` as a new npm dependency (only used for the marker gradient color
  interpolation in `useMapMarkerHandler.js`; not otherwise present in dms-template).
- Dropped a few dead imports that don't exist in dms-template at all (`getAttributes` from
  transportNY's bespoke `DataManager`, unused in the routecreation file that had it; unused
  `CMSContext`/`MapEditorContext`/`isEqual` imports in `dataUpdate.jsx`; unused `PageContext`
  import in `useRouteData.js`) — verified unused before dropping, not a behavior change.
- Fixed a copy-paste bug found in `internalPanel.jsx`: hardcoded `pluginDataPath =
  'symbology.pluginData.macroview'` (copied from macroview's internalPanel) corrected to
  `'symbology.pluginData.routecreation'`. Was inert (the variable wasn't actually referenced in
  the returned controls), so no behavior change either way — fixed for correctness.
- `RouteEditor.jsx`'s panel positioning (`right: "-168px"`) assumed transportNY's narrower map
  container and rendered off-screen in dms-template's wider one. Changed to `right: "8px"`
  (flush against the container's right edge) — a real, confirmed-by-screenshot fix, not
  speculative.

**Live-verified** on an existing pre-staged scratch page, `converted_reports/route_creation_demo`
(already had `symbology.plugins.routecreation` + a real `npmrds_shapefile` layer configured from
earlier research work — a ready-made test fixture):
- [x] Plugin registers into `PluginLibrary` and `AvlMap` receives both layers (`iecsoywmi` +
      `routecreation`), confirmed via React fiber inspection
- [x] `RouteEditor` panel renders (TMC Click/Markers toggle, TMC Search, TMC List) — positioning
      fixed to actually be visible
- [x] Shapefile TMC network renders correctly when zoomed in (was invisible only because the
      default statewide zoom makes ~0.3px lines imperceptible — not a bug)
- [x] **Full click-to-select pipeline confirmed live**: clicked a road → resolved to TMC
      `120-12083` → `useRouteData` fetched real mileage (1.388 miles) via falcor/UDA → RouteEditor
      list updated correctly. Exercises tile click-property reading, state update, paint recolor,
      and the falcor data-fetch path all at once.
- [ ] Not yet tested: marker/auto-route mode, save/load a route (the `apiUpdate`/`INTERNAL_ROUTES_*`
      dataset-write path) — click-to-select (the core, most-used mode) is proven; these are the
      remaining untested surface

### Phase 2 — macroview — DONE, live-verified 2026-07-29

**Root cause found and fixed in transportNY, 2026-07-29.** Summary: macroview's
`externalPanel`/`internalPanel` were implemented as full React components with hooks
(`useState`/`useMemo`/`useEffect`), but the plugin contract calls them as **plain function calls**
(not JSX) from the shared `ExternalPluginPanel`/`InternalPluginPanel` — a Rules-of-Hooks violation
that crashed the whole page ("Rendered fewer hooks than expected") whenever the call count varied
between renders. Fixed by moving all side-effecting logic into `comp.jsx` (`Comp`, the one part of
the plugin that's actually mounted via JSX) and making both panel functions pure descriptor-only
reads of already-computed shared state. Live-verified at `npmrds.localhost:5174/macro` — panel
renders, Geography dropdown populated with real county options, Year/Measure/Peak controls
populated, Legend shows real computed color breaks, zero console errors.

**Full root-cause detail (rescued 2026-07-30 from transportNY's `macroview-panel-hooks-crash.md`,
the only place it existed — reproduced here in full since it has real diagnostic value beyond the
one-paragraph summary above):**

`ExternalPluginPanel` calls `externalPanel()` once per candidate tab (to check if it has controls)
plus once more for the active tab; any variation in how many times that happens between two renders
(tab count changing, `PluginLibrary` not yet populated on first render, etc.) desyncs the hook count
for that fiber and crashes. `InternalPanel` had the identical issue (gated on `activePluginName`
truthiness instead of a tab-count loop), just less immediately visible since it's only ever called
once per render. This was unrelated to (and not caught by) an earlier assessment that macroview was
"already migrated, no functional work needed" — that assessment covered the `MapEditorContext`/
`CMSContext` swap specifically (confirmed correct), not this separate structural bug.

Fix specifics: `comp.jsx` gained the geometry-options fetch effect (writing
`pluginData.macroview.geomControlOptions` via `setState` instead of local `useState`/`useMemo`),
the geography-based border-filter effect, the sub-measure-normalization effect, the
color-domain/paint/legend effect, the PM3-views cache-warm effect, and five initial-geometry-style
effects previously in `internalPanel.jsx` — all copied verbatim in logic, only relocated, writing
outputs into shared `pluginData` state instead of local component state. `externalPanel.jsx`/
`internalPanel.jsx` were reduced to plain functions reading `state` via `get()`. `utils.jsx` gained
`buildGeomControlOptions(geomData)`, a pure extraction of a `useMemo` that used to live inside
`externalPanel.jsx`.

**A second, separate bug was found after the crash fix**: with the panel no longer crashing, the
map area itself stayed collapsed to 0 height (canvas existed, style/tiles/sprite all fetched fine,
nothing visible). Root cause: the "Macro" page's persisted component data had
`element['element-data'].height` set to the literal string `"100vh"` — not one of the `Map`
component's recognized `HEIGHT_OPTIONS` keys (`full`/`screen`/`1`/`2/3`/`1/3`/`1/4`) — so the height
lookup returned `undefined` and the container collapsed. Not a code bug, a stale/invalid persisted
config value on that one page. Fixed by correcting the DB row directly (`height: "100vh"` →
`"full"`) rather than changing component code — confirmed transportNY and dms-template's local dev
instances share the same backend DB, so the one fix applied to both repos' pages at once.
**Flag for anyone porting a map plugin in the future**: whatever page/section hosts it needs a
valid `height` key, not a raw CSS string, or the map comes up blank/collapsed.

- [x] Root-cause the crash (transportNY, 2026-07-29)
- [x] Fix in transportNY: `comp.jsx`, `externalPanel.jsx`, `internalPanel.jsx`, `utils.jsx` (new
      `buildGeomControlOptions` helper) — see transportNY task file for exact diff description
- [x] Live-verify the fix in transportNY
- [x] Port the fixed plugin into dms-template
- [x] Live-verify in dms-template

Ported to `src/themes/transportny/components/macroview/` (same file layout as transportNY:
`macroview.plugin.jsx`, `comp.jsx`, `externalPanel.jsx`, `internalPanel.jsx`, `dataUpdate.jsx`,
`constants.js`, `paint.js`, `measures.js`, `updateFilters.jsx`, `utils.jsx`, `ua_code_to_name.js`).
Registered via `theme.mapPlugins.macroview`.

**Adjustments made during the port**:
- Same context-import path rewrite as routecreation (`CMSContext`/`MapEditorContext`/
  `extractState`/`createFalcorFilterOptions`/`filterToUda` → relative paths into dms-template's
  own `src/dms/...` copy of the shared submodule).
- `choroplethPaint` (was transportNY's bespoke `~/pages/DataManager/MapEditor/components/
  LayerEditor/datamaps`) → dms-template's own copy at `src/dms/packages/dms/src/patterns/
  mapeditor/MapEditor/components/LayerEditor/datamaps` — confirmed by diffing both repos' copies
  that it's the *same* shared-submodule function (dms-template's copy even has a small bug fix,
  `=` → `===`, that transportNY's doesn't).
- `Button` → `UI.Button` via `ThemeContext` (same swap as routecreation).
- `MultiLevelSelect` (transportNY-only `avl-map-2` submodule, hierarchical/grouped select) → 
  dms-template's `UI.Select` (single-value wrapper around `MultiSelect`, confirmed matching
  `value`-is-a-string / `onChange`-receives-a-string API) with pre-mapped `{label, value}` options
  instead of `displayAccessor`/`valueAccessor` props.
- `@heroicons/react` (`CheckCircleIcon`/`XCircleIcon`) → Font Awesome 6 classes
  (`fa-circle-check`/`fa-circle-xmark`), matching this same file's own pre-existing FA icon usage
  elsewhere, rather than adding a new icon-library dependency for two icons.
- `getAttributes`/`usePrevious` (transportNY's bespoke `~/pages/DataManager/MapEditor/...` —
  genuinely generic, not DataManager-specific logic) inlined directly into `utils.jsx` instead of
  chasing a nonexistent import path.
- `DAMA_HOST` (was a static `~/config` import) → read from `CMSContext.fileUploadInfo.DAMA_HOST`
  (falls back to `API_HOST`). **Known gap**: this only resolves on published pages (`CMSContext`);
  `MapEditorContext` (authoring) has no equivalent field today, so the "Data Downloader"
  button/URL-building will be a no-op in the MapEditor until that's added upstream. Flagged, not
  blocking — this is a secondary feature (GIS export), not the core map/filter/legend
  functionality, which doesn't depend on it.
- `Comp`'s absolute-positioned info panel (`right: "-168px"`) — applied the same fix as
  routecreation's `RouteEditor` *proactively* this time (`right: "8px"`), correctly anticipating
  the same transportNY-vs-dms-template container-width mismatch found during Phase 1.
- Added `d3-scale` as a new npm dependency (shared with Phase 1 — only needed once).

**Live-verified** on `npmrds.localhost:5173/macro` in dms-template — the *exact same* underlying
DB row already fixed for Phase 2's height bug (both repos share the same local dms-server/DB):
- [x] Map renders (NY state basemap, cities/labels)
- [x] Geography multiselect populated with 112 real options (fetched live via falcor/UDA — proves
      `buildGeomControlOptions` + the geometry-fetch effect work end-to-end)
- [x] Year/Performance Measure/Peak Selector all populated with real values
- [x] "Measure Definition"/"Equation" info box renders, correctly positioned (not clipped)
- [x] Legend renders real computed color breaks (1.22-8.78), matching transportNY's values
- [x] Zero console errors
- [ ] Not yet tested: the "Open Data Downloader" flow itself (known DAMA_HOST gap above), and the
      internalPanel authoring controls in the MapEditor (only the published-page path is verified)

## Files Requiring Changes — DONE

- [x] `src/themes/transportny/components/routecreation/**`
- [x] `src/themes/transportny/components/macroview/**`
- [x] `src/themes/transportny/theme.js` — `mapPlugins: { routecreation, macroview }`

## Testing Checklist

- [x] routecreation: TMC-click selection live-verified end-to-end (see Phase 1 above). Marker/
      auto-route mode and save/load a route not yet tested.
- [x] macroview: Geography/Year/Measure/Peak controls populate and write back correctly, map
      choropleth + legend render, no console errors. Data Downloader flow and MapEditor-side
      internalPanel not yet tested (see gaps noted above).
