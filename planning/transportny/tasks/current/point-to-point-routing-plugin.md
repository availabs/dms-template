# Point-to-point routing plugin — new map plugin + backend routing service

## Objective

Add a new map plugin: user picks two points on the map (source, destination), and gets back the
actual shortest/best route between them — computed by a **new, conflation-aware routing backend**
that respects turn restrictions and one-way streets (not just physical shortest-path-by-length),
with attribute-based costing (truck/weight limits, road-class preference) as a later phase.

This is **not** the existing `routecreation` plugin's job — that tool builds/saves named,
multi-point TMC routes for the NPMRDS Reports feature (an authoring tool), and already has its own
active arc (see [`route-creation-tool.md`](./route-creation-tool.md)). This is a separate, focused
"get directions between 2 points" feature. `routecreation` could point at the same backend later
if useful, but that's not part of this task.

**Cross-repo context**: the routing computation's data prerequisites (a real, DAMA-registered
turn-restriction table; a confirmed-correct, confirmed-full-scale-capable pgRouting query) were
built and validated in a **sibling repo**, `/home/sarang/Documents/avail/conflation`, this same
day (2026-08-03) — see that repo's `routing/ROUTING_API_TASKS.md` and `routing/ROUTING_LOG.md` for
the full narrative (persisted relations tables, the `pgr_trsp` vs `graphology` vs
`pgr_turnRestrictedPath` comparison, a real 150-mile Albany→Buffalo test in 62 seconds against
9.66M edges). This task file is the dms-template/frontend-and-backend-integration side of that
same effort — read the conflation repo's docs first if anything here references a result without
re-deriving it.

## Scope

**In scope (v1):**
- One new map plugin, separate from `routecreation`.
- Backend routing endpoint, single conflation source/view for now (2024 — no multi-year selector).
- Point-to-point only: two coordinates in, one GeoJSON route out.
- Turn-restriction-aware routing (the actual differentiator vs. the existing external
  `routing2.availabs.org` service, which this doesn't call).

**Explicitly out of scope for v1** (tracked as later phases below, not forgotten):
- Extending/replacing `routecreation` or its external-service call.
- Multi-year/multi-source selection.
- Attribute-based hard filters (truck/weight/height) — blocked on the conflation repo's
  ROUTING_TASKS.md Task 2 (way tags aren't captured yet at all).
- Multi-way `via` turn-restriction chains (1,540 of 21,018 2024 relations) — restriction-building
  tested so far only covers the single-node-`via` case.
- Bulk OD-pair queries / traffic-assignment feed — the conflation repo's plan treats these as a
  later phase after point-to-point is proven, not dropped.

## Current state

### Map plugin architecture (confirmed via full repo exploration, 2026-08-03)

- Plugins are plain objects with a documented shape (`MapEditor/index.jsx`, lines 190-238):
  `{ id, type: "plugin", mapRegister(map, state, setState), dataUpdate(map, state, setState),
  comp({state, setState, map}), internalPanel({state, setState}), externalPanel({state, setState}),
  cleanup(map, state, setState) }`. `mapRegister`/`dataUpdate`/`cleanup` run outside React's render
  cycle (no hooks allowed); `comp`/`internalPanel`/`externalPanel` may use hooks.
- Registered globally via `RegisterPlugin(name, plugin)` into a shared `PluginLibrary` object,
  normally auto-wired per-theme: `theme.js` exports a `mapPlugins: { name: PluginComponent }` map,
  and `patterns/page/siteConfig.jsx`/`patterns/mapeditor/siteConfig.jsx` are supposed to iterate it
  and call `RegisterPlugin` for each entry.
- **Blocker, confirmed present right now**: `src/dms` (the `@availabs/dms` submodule) is checked
  out at `754b55b9`, ~10 days behind the commit dms-template's own git tree records (`a6f4fdbf`,
  "map plugins", 2026-07-29) — `git status` shows `M src/dms`. The `theme.mapPlugins` iteration
  block does not exist in the stale checkout. **Nothing registers until `git submodule update` is
  run** from the dms-template root. This must be the first real step, not an afterthought — every
  other item here is blocked on it.
- A layer a plugin drives should be referenced through the `'active-layers'` path in plugin data
  (`INITIAL_PLUGIN_DATA_STATE = { 'default-legend': true, 'active-layers': {} }`), not hardcoded,
  so the shared MapEditor machinery doesn't fight it.
- MapLibre GL (imported as `maplibre-gl`, sometimes aliased to the identifier `mapboxgl` in
  existing code — not real Mapbox GL, don't be misled by the variable name) is the rendering
  library underneath all of this (`ui/components/map/avl-map.jsx`/`avl-layer.jsx`).

### The closest existing example: `routecreation`

`src/themes/transportny/components/routecreation/` (files: `routecreation.plugin.jsx`, `comp.jsx`,
`internalPanel.jsx`, `dataUpdate.jsx`, `constants.js`, `paint.js`, `utils.jsx`,
`hooks/{resolveRoute,useMapMarkerHandler,useMapTmcHandler,useRouteData}.js`,
`components/{RouteEditor,SaveRouteModal}.jsx`) is the file-shape template to mirror. Two things
worth copying exactly:
- Every plugin's `comp.jsx` branches on whether it's running inside MapEditor
  (`state.symbologies`) vs. a published DMS page (`state.symbology` directly) for path
  construction — copy this branch, don't skip it.
- MapLibre vector tiles only carry feature properties for columns explicitly named via
  `data-column`/`filter`/`filter-group`/`dynamic-filters`. A plugin whose layer only needs
  click-identity (no color/filter binding) must fake one of those fields in to get properties back
  on click — `routecreation.plugin.jsx`'s `mapRegister` sets `data-column: 'tmc'` purely as this
  workaround. The new routing plugin will likely need the same trick if it renders a
  clickable/hoverable network layer (it may not, if points are placed freely rather than snapped
  to a rendered feature — see Open Questions).

`resolveRoute.js`'s isolation pattern (one narrow function owning an entire external service
contract — URL, request/response shape — so a future swap is a one-function edit) is exactly the
shape the new plugin's backend-calling code should follow, even though it's calling a *different*
(new, conflation-aware) backend rather than `routing2.availabs.org`.

### Backend: no ready-made home yet

`avail-falcor`'s `dama/routes/data_types/pgr/` has real, wired Express routes
(`POST /dama-admin/:pgEnv/{pgr/routing,osm/routing,osm/isochrone,osm/rerouter}`) using the right
schema convention (a DAMA conflation view resolves to `<table>_nodes`/`<table>_edges`), but with
known, specific problems: the batch/DAMA-worker route (`pgr.worker.js`) is broken (references a
nonexistent `pgr.worker.mjs`, invalid mixed CJS/ESM syntax); nearest-point-to-edge snapping
hardcodes one global table (`osm_datasets.edges`) instead of the per-view table it just resolved;
heavy geoprocessing (temp tables, COPY streaming, Dijkstra) runs synchronously inline in the
request handler instead of via the task queue. `dms-template`'s own `data-types/` (a separate,
server-side ETL/data-type plugin system, contract in `data-types/CLAUDE.md`) has **no**
routing/pgRouting data-type at all today — only raw OSM PBF ingestion (`data-types/osm/`).

**Not yet decided**: fix/extend `avail-falcor`'s existing (flawed) data type, or build fresh. See
Open Questions.

## Proposed changes

1. Fix the `dms-template` submodule (`git submodule update`) — prerequisite, blocks everything.
2. Decide + implement the backend routing endpoint (location TBD — see Open Questions), using:
   - The conflation repo's persisted `temp.osm_conflation_1_2024_relations`/`_edges`/`_nodes`.
   - `pgr_trsp` (confirmed correct and full-scale-capable; `pgr_turnRestrictedPath` is confirmed
     broken, don't use it).
   - The validated nearest-node snapping query (GIST spatial index, `ORDER BY wkb_geometry <->
     ST_SetSRID(ST_MakePoint(lon,lat),4326) LIMIT 1` — confirmed 41ms, 44m/11m accuracy against
     the real 2024 network).
   - Response: a single GeoJSON `LineString` feature (matches `osm.routing.js`'s existing
     `{ ok, result: { feature } }` shape — reuse that response contract even if the internals are
     rewritten).
3. Build the new plugin (`src/themes/<theme>/components/routing/` — theme TBD, see Open
   Questions), mirroring `routecreation`'s file structure: a `.plugin.jsx` entry object, `comp.jsx`
   for the mounted UI (2-point picker), `internalPanel.jsx` for author-facing config, a hook that
   owns the backend call (mirroring `resolveRoute.js`'s isolation pattern).
4. Register the plugin in the target theme's `theme.js` (`mapPlugins: { routing: RoutingPlugin }`).
5. Render the returned GeoJSON `LineString` as a MapLibre `geojson` source/layer.

## Files requiring changes

**dms-template (this repo):**
- `src/dms` — submodule pointer update (not a content change, just un-sticking it)
- `src/themes/<theme>/theme.js` — register the new plugin
- `src/themes/<theme>/components/routing/*` — new files (plugin entry, comp, internalPanel,
  dataUpdate, hooks)

**avail-falcor (sibling repo) — if that's where the backend lands (Open Questions):**
- `dama/routes/data_types/pgr/` — fix or replace the relevant route(s); at minimum needs the
  per-view snapping bug fixed (don't hardcode `osm_datasets.edges`)

**conflation repo (sibling repo) — already done, reference only, no further change expected here:**
- `persistRelations.mjs`, `temp.osm_conflation_1_2024_relations`/`_edges`/`_nodes` — already built
  and validated; see `routing/ROUTING_API_TASKS.md` there for the full data-readiness picture

## Testing checklist

- [ ] `git submodule update` run, `theme.mapPlugins` block confirmed present in
      `patterns/page/siteConfig.jsx`/`patterns/mapeditor/siteConfig.jsx`
- [ ] New plugin registers without error in MapEditor (shows up in the plugin selector)
- [ ] Two-point picking UI works (click/drag to place source + destination)
- [ ] Backend call returns a valid GeoJSON `LineString` for a real OD pair
- [ ] Route renders correctly on the map
- [ ] A known turn-restriction case is respected, not just "a path exists" — reuse the conflation
      repo's already-identified real example (relation `3896860`, way `44705074`'s U-turn) as a
      concrete regression check
- [ ] Spot-check 2-3 real routes against a known-good router (Google/OSRM) for the same OD pairs
- [ ] Confirm behavior on a source/destination point far from any road (should snap sensibly, not
      error or return a nonsensical route)

## Sequential tasks (phased)

### Phase 0 — Prerequisite fix (do first, blocks everything else)
- [ ] Run `git submodule update` in dms-template; confirm `theme.mapPlugins` wiring is present.
- [ ] Confirm existing plugins (`routecreation`, `macroview`) still register/work after the update
      (regression check — don't silently break what's already live).

### Phase 1 — Backend decision + minimal endpoint
- [ ] Decide: fix/extend `avail-falcor`'s `dama/routes/data_types/pgr/`, or build fresh (see Open
      Questions — needs a decision, not further research; the tradeoffs are already documented).
- [ ] Implement one endpoint: two coordinates in, GeoJSON `LineString` out, using `pgr_trsp` +
      2024's persisted relations/edges from the conflation repo.
- [ ] Fix the per-view nearest-edge-snapping bug while doing this (don't hardcode a global table).
- [ ] Smoke-test the endpoint directly (curl/Postman) against the same Albany→Buffalo OD pair
      already validated in the conflation repo's full-scale test, confirm a consistent result.

### Phase 2 — Plugin scaffolding
- [ ] Create `src/themes/<theme>/components/routing/` files mirroring `routecreation`'s shape.
- [ ] Build the 2-point-picker UI (`comp.jsx`) — click/drag markers for source + destination.
- [ ] Wire the backend-calling hook, following `resolveRoute.js`'s isolation pattern.
- [ ] Register in the target theme's `theme.js`.

### Phase 3 — Wire + render
- [ ] Call the Phase 1 endpoint from the Phase 2 plugin on point placement/change.
- [ ] Render the returned route as a MapLibre `geojson` layer.
- [ ] Handle the no-route/error case in the UI (don't just silently fail).

### Phase 4 — Validation
- [ ] Run the full testing checklist above.
- [ ] Document any real discrepancies found against a known-good router — feed back into the
      conflation repo's `routing/ROUTING_API_TASKS.md` Task C1 if a systemic issue turns up (that's
      where the broader validation task is tracked).

### Phase 5 — Later phases (explicitly deferred, not forgotten)
- [ ] Attribute-based hard filters (truck/weight/height) — depends on conflation repo
      ROUTING_TASKS.md Task 2 (way tags capture) landing first.
- [ ] Multi-way `via` turn-restriction chains — depends on conflation repo ROUTING_API_TASKS.md
      Task A3.
- [ ] Multi-year/multi-source selection (once "the stable conflation source," per the user, exists).
- [ ] Bulk OD-pair / traffic-assignment support.
- [ ] Consider whether `routecreation` should eventually call this same backend (not decided now).

## Open questions (need input before Phase 1/2 can really start)

1. **Backend location**: fix/extend `avail-falcor`'s existing `dama/routes/data_types/pgr/`, or
   build the routing endpoint somewhere new? Fixing reuses a real (if bug-ridden) foundation and
   the existing DAMA conflation-view convention; building fresh avoids inheriting its specific
   bugs and the repo's three-different-routing-engines history (pgRouting SQL-pushdown,
   `graphology`, `ngraph`, accumulated over time — see the conflation repo's ROUTING_LOG.md for
   the full account).
2. **Which theme** does the new plugin belong to? `routecreation`/`macroview` both live under
   `transportny` — is that the right target for this too, or does it belong under a different/new
   theme?
3. **Point placement UX**: free-form map clicks (matching the conflation repo's validated
   approach — snap to nearest node server-side) or snapping to a rendered network layer client-side
   first? Affects whether the `data-column` workaround (needed for click-identity on a rendered
   layer) is required at all.
4. **Auth model** for the new endpoint — `avail-falcor`'s existing `pgRouterRouting/` routes have
   no visible per-route auth beyond a global JWT check; is that sufficient here?
