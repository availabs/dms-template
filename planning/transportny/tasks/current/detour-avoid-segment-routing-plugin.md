# Detour / avoid-segment routing plugin

**Project:** TransportNY · **Topic:** themes · **Status:** IN PROGRESS - point selection confirmed working & committed (2026-08-24); performance follow-up tracked separately below · **Started:** 2026-08-19

## Objective (corrected 2026-08-19 - see "Flow correction" below)

A standalone map plugin (`detour`, separate from `routing` - see that decision in the "Flow
correction" section) that answers: **"what happens to trips through this road segment if it's
closed?"** - not "give me a route for one traveler, but avoid this segment." The user's own
framing: "we are not here keeping the route for a single [person] but we are here to give
information about what happen to the trip of any [people] if that route/segment is closed... it's
a kind of point for so many, not one."

## Flow correction (2026-08-19) - supersedes the original scope below

**The original build (multi-segment exclusion on top of manual source/destination picking) was
the WRONG flow and has been removed.** Corrected flow, confirmed with the user:

1. User clicks **one** road segment on the map (the conflation network, rendered directly -
   no point-picking step at all).
2. The segment highlights.
3. **Start and end points are calculated automatically** - the closest points to that segment's
   own start and end (i.e. the segment's two endpoint nodes) - NOT picked by the user.
4. The plugin computes the route between those two auto-derived points, with that segment
   excluded - showing what a trip through that corridor would have to do instead if this segment
   were closed.

**Explicitly scoped down for the first build**: **one segment only**, not multi-select. The user's
own words: "for now just start with one segment... and then will expand for more." Multi-segment
exclusion (built in the removed first attempt) is a real future direction, not this pass.

**What was removed**: the entire first `src/themes/transportny/components/detour/` implementation
(manual source/destination point-picking via `usePointPicker`, then multi-segment toggle-select
exclusion layered on top) - deleted per the user's explicit instruction ("remove the old that you
did"). It solved a different problem (a single traveler's detour) than the one actually wanted
(corridor-impact analysis for any trip through a segment). Recoverable from git history if ever
needed for reference.

**What is NOT removed / still true from the original build**, since it's backend infrastructure
this corrected flow also needs:
- `data-types/routing/index.js`'s `GET /edges` bbox route (viewport-scoped, capped, for rendering
  the clickable segment layer) - unchanged, reused as-is.
- `data-types/routing/memoryGraph.js`'s `excluded_edge_ids` support in `findRoute` (excludes both
  directions of the physical road, per the earlier "exclude both directions" decision, still
  correct here) - unchanged, reused as-is.
- The `routing` plugin itself remains completely untouched throughout all of this.

## Flow correction #2 (2026-08-19) - refines the derived-point + reveal logic above

Two follow-on corrections to the flow above, both confirmed with the user the same day:

**"Nearest to the segment's start and end" does NOT mean the segment's own endpoint nodes** (an
ambiguity in the first correction's wording above) - it means **the nearest OTHER node** near
each of those two locations, explicitly excluding the segment's own `from_node`/`to_node`. Uses
the existing (Phase 6 leftover) `GET /nodes` bbox route: a small (~150m) bbox search around each
endpoint, expanding up to 5x if nothing else is found nearby, then picks the geometrically closest
node that isn't the segment's own endpoint. Rendered as two markers - **start green, end red**
(same color convention as `../routing/constants.js`'s `MARKER_COLORS`, just this plugin's own
copy: `#22c55e`/`#ef4444`).

**Explicit "Get detour" action, then hide the pickable network for a clean result view**:
selecting a segment resolves + shows the derived start/end markers immediately, but does NOT
auto-compute the route - the user presses **"Get detour"** to do that. Once a result (or a failed
"no route possible" attempt) is showing, the pickable conflation-network layer hides entirely
(`useEdgeLayer`'s `isActive` is passed `!hasResult` from `comp.jsx`) and further segment clicks
are ignored, leaving only the clean result: the excluded segment's highlight, the two derived
markers, and the detour route. **"Clear detour"** resets everything and brings the pickable
network back to let the user pick again.

## Directional detour routes - BUILT 2026-08-19

Raised by the user while testing: for a two-way road, **the actual usable detour can depend on
which direction the trip is traveling** - the user's own framing was a river-crossing analogy
("it will always depend on the way from where [traffic] is coming"). Concretely: turn
restrictions are directional, so the best detour for a trip heading one way through the closed
segment may not be the same as the best detour heading the other way. Confirmed by the user to
move forward on: "explore those all."

**Built**: "Get detour" now computes BOTH directions (derived-start -> derived-end AND
derived-end -> derived-start) via `Promise.allSettled` (not `Promise.all`) in
`hooks/useTrspRoute.js` - `allSettled` specifically because one direction can have no viable
detour while the other does (an asymmetric-restriction case), and losing the working direction
because the other rejected would hide exactly the asymmetry this feature exists to surface.
`routes` shape is now `{ AtoB: {shortest,fastest} | null, BtoA: {shortest,fastest} | null,
AtoBError, BtoAError }`.

- **Answered "shortest+fastest vs. direction A+B"**: kept as two independent selector axes, not
  collapsed into 4 flat variants - `DetourDetailsPanel.jsx` has a direction toggle ("Start → End" /
  "End → Start", disabled + labeled "(none)" if that direction had no route) ABOVE the existing
  shortest/fastest toggle, so both dimensions stay separately selectable rather than a combinatorial
  list.
- **Answered "how to present without clutter"**: only the currently-selected direction+variant
  renders on the map at once (via `useRouteLayer`) - not all 4 simultaneously. An amber banner
  appears when the two directions' `shortest` edge counts differ, flagging the asymmetry without
  forcing the user to compare both tabs manually to notice it.
- **Not yet done**: real live verification that the two directions actually DO differ on a real
  restriction-heavy segment (this was built and compiles, but hasn't been confirmed against a real
  asymmetric-restriction case the way the rest of this project's claims are held to - flag for the
  next live-testing pass).

## "Show all routes" test toggle + Legend-panel controls - BUILT 2026-08-19

Two follow-on asks from the user, both built:

- **"Show all routes" checkbox** (explicitly "just for test"): when on, all 4 computed
  direction/variant combinations render simultaneously - the currently-selected one bold (via the
  existing primary `ROUTE_*_ID` layer), the other 3 dimmed/dashed (a new secondary layer,
  `ROUTE_SECONDARY_*_ID` in `constants.js`, same primary/dimmed convention `../routing` already
  uses for its own shortest/fastest display). `hooks/useRouteLayer.js` now takes a
  `secondaryFeatures` array alongside the primary feature.
- **Legend-panel controls**: the user asked to also put the direction toggle and the show-all-
  routes checkbox into the plugin's Legend/internal panel (the "Display default legend" window,
  a MapEditor-provided panel next to the plugin picker - NOT the bottom-left `DetourDetailsPanel`).
  Discovered while wiring this up: that panel and `comp.jsx` share the exact same underlying store
  (`state.symbology.pluginData.detour`, via the `SymbologyContext` the whole MapEditor plugin
  framework is built on - see
  `src/dms/packages/dms/src/patterns/mapeditor/MapEditor/components/InternalPluginPanel/index.jsx`
  and `.../PluginControls/PluginControls.jsx`). So `internalPanel.jsx` now declares a `toggle`
  control (`['show-all-routes']`) and a `select` control (`['direction']`), and `comp.jsx` reads/
  writes those same paths via `lodash-es`' `get`/`set` instead of local `useState` - meaning the
  Legend-panel controls and the bottom-left panel's own direction/show-all buttons are two views
  onto the same one source of truth, always in sync, not two independently-tracked copies.
- Direction's "auto-pick whichever direction actually has a route" fallback (from the original
  build) still applies on top of the shared-state preferred value - if the user's chosen direction
  turns out to have no route for a newly-selected segment, `comp.jsx` falls back to whichever
  direction is actually available rather than showing nothing.

## Future direction: multi-segment selection (not this pass)

Explicitly deferred (see "one segment only for now" above), but the user flagged a real design
question to resolve before building it: **when multiple segments are selected, they may or may
not be physically connected to each other**, and that changes what "start and end" even means:

- **If the selected segments form one connected, contiguous corridor** (each segment touches the
  next at a shared node - e.g. three consecutive blocks of the same closure), they should
  effectively collapse into **a single logical segment** for the purpose of deriving start/end:
  the start is the one "loose" endpoint of the chain that isn't shared with another selected
  segment, and the end is the other loose endpoint. This matches the real-world case (a multi-block
  road closure) and keeps the "one corridor, one trip-impact analysis" framing intact.
- **If the selected segments are disconnected** (e.g. two unrelated closures in different parts of
  town), there is no single well-defined start/end pair anymore - this needs its own design
  decision before it's built (candidates not yet evaluated: run one detour analysis per
  disconnected group and show multiple results; require the user to run the tool once per group;
  or something else). Not decided - flag for discussion when this is actually picked up.
- Detecting "connected" is a graph question, not just a UI one: two selected segments are
  connected if they share a node (`from_node`/`to_node` overlap) - this needs to be computed from
  the segments' own endpoint data (already available on each selected segment), likely via a
  simple union-find/connected-components pass over the selected set before deriving endpoints.

This section exists so the connectivity question isn't rediscovered from scratch when
multi-segment support is actually built - it is NOT scoped or scheduled yet.

## Scope (for this corrected build)

**In scope:**
- Render the conflation network immediately when the `detour` plugin is selected (no point-picking
  gate) as a clickable line layer.
- Click ONE segment -> highlight it, derive source = that segment's one endpoint node, destination
  = its other endpoint node (using the segment's own geometry - first/last coordinate - which are
  already real node positions, so they should snap back to the same nodes server-side).
- Call `/trsp-memory` with those two points and `excluded_edge_ids: [thatSegment]`.
- Show the resulting detour route + an explicit "no route possible" state if the segment is a
  bridge/cut-vertex with no alternative.
- Clicking a different segment replaces the selection (not additive - single-segment only for
  this pass).
- Clicking the same selected segment again deselects it and clears the route.

**Explicitly out of scope for this pass:**
- Multi-segment exclusion (planned as a real next step, not now).
- Any manual point-picking UI at all - this flow has none.

## Current State

Rebuild in progress. Old implementation deleted. New implementation being written now (see
"Files Requiring Changes").

## Files Requiring Changes

- `src/themes/transportny/components/detour/` - full rewrite:
  - `constants.js` - drop the point-picker ids (`POINTS_*`) entirely, no longer needed; keep
    `EDGES_*`/`SELECTED_SEGMENT_*`/`SEGMENT_ENDPOINTS_*`/`ROUTE_*`.
  - `hooks/useEdgeLayer.js` - simplify back to single-segment selection (was array-based for
    multi-select; revert to one `selectedSegment | null`), always active (no `isActive` gate tied
    to point-picking, since there's no point-picking phase anymore).
  - Delete `hooks/usePointPicker.js` - not needed in the corrected flow.
  - `comp.jsx` - no `usePointPicker`; on segment selection, derive source/destination from the
    segment's own geometry endpoints and call `getRoute` automatically (or on a small "Get route"
    confirmation - TBD feel, defaulting to automatic-on-select since there's no other user action
    driving it).
  - `components/DetourDetailsPanel.jsx` - drop source/destination step text; show "Click a segment
    to see trip impact if it's closed," the selected segment, and the resulting route/error.
  - `detour.plugin.jsx` - drop `POINTS_*` cleanup references.
  - `hooks/resolveTrspRoute.js`, `hooks/useTrspRoute.js`, `hooks/useRouteLayer.js`,
    `hooks/resolveEdgesInBbox.js` - unchanged from the removed build, still correct.

## Legend-panel controls - tried, then reverted (2026-08-19/20)

Direction + "show all routes" controls were added to the plugin's Legend/internal panel (sharing
`state.symbology.pluginData.detour` with `comp.jsx`), then removed per the user's follow-up
("remove from this window") - they live only in the bottom-left `DetourDetailsPanel` now.
Direction/show-all-routes selection was also reverted from that shared plugin-state mechanism
back to plain local `useState` in `comp.jsx`, to remove any question of whether the shared-state
path was reliably triggering re-renders (suspected contributor to a "clicking direction doesn't
change the route" report - not conclusively root-caused before the revert, but not reproduced
since).

## Pick-tolerance + hover preview - BUILT 2026-08-20

User: "i need to full zoom to pick the segment... on hover closeby it will allow to pick the
segment." Picking previously relied on MapLibre's exact hit-testing against the rendered line's
own (thin) stroke width, which only had a workable hit area at high zoom.

**Built**: both hover and click now query a small (`CLICK_TOLERANCE_PX = 8`) screen-pixel box
around the cursor via `queryRenderedFeatures`, then pick whichever candidate line passes closest
to the cursor in screen space (`hooks/nearestFeatureToPoint.js` - point-to-segment distance over
each candidate's coordinates, not map/geo distance, so the tolerance is zoom-independent). A new
amber hover-preview layer (`HOVER_SEGMENT_*_ID`) shows the nearest pickable segment before any
click, with the cursor switching to a pointer - so the user can see what a click would select.
Click behavior (select/deselect/replace) is unchanged, just now driven by the tolerance query
instead of the layer's own exact hit area.

## Both directions shown simultaneously, always - BUILT 2026-08-20 (supersedes the direction toggle)

The direction toggle ("Start → End"/"End → Start" buttons) was tried in two places - the bottom
panel, then the Legend/internal panel - and removed both times per the user's follow-ups. Final
design, the user's own suggestion: **both directions render on the map at once, always**, no
toggle anywhere. `comp.jsx`: `AtoB` is primary (bold, `ROUTE_COLOR`), `BtoA` is secondary (dimmed/
dashed, `ROUTE_SECONDARY_COLOR`) - or just whichever one direction actually has a route, if only
one does. `DetourDetailsPanel.jsx` shows both directions' stats side by side (a `DirectionStats`
card each, color-keyed to match the map lines) instead of a single "selected direction" block.
The earlier "show all routes" idea (all 4 = 2 directions x shortest/fastest at once) is dropped -
this is simpler and was the direction actually being asked about (turn-restriction asymmetry
between the two travel directions), not the cost-objective axis.

`internalPanel.jsx` is back to empty - no controls needed in the Legend panel for this plugin.

## Two real bugs found and fixed - 2026-08-20

- **"Get detour" required switching shortest/fastest tabs before the route appeared.** Root cause:
  the exact same `map.once('load', ...)` race already documented for the `routing` plugin's own
  history - if `map.isStyleLoaded()` is false at the moment a layer-adding effect runs AND the
  map's one-time `'load'` event already fired before this effect subscribed, the layer never gets
  added (the event won't fire again), until some UNRELATED prop change re-runs the effect at a
  moment when `isStyleLoaded()` happens to be true. Fixed with a shared `hooks/runWhenStyleReady.js`
  helper - listens to BOTH `'load'` and `'idle'` (idle fires reliably even after 'load' already
  passed), guarded to run its callback only once. Applied to all three map-writing hooks
  (`useRouteLayer.js`, `useEdgeLayer.js`, `useStartEndMarkers.js`) - this same race was very likely
  also the real explanation for the "Clear detour not removing markers" reports below, not a
  logic bug in the reset handlers (which were already correct on inspection both times they were
  investigated).
- **"Clear detour"/"Clear selection" not removing the green/red start/end markers** - reported
  twice. First response added an imperative `clear()` from `useStartEndMarkers.js` (belt-and-
  suspenders, still in place); the `runWhenStyleReady` fix above is the more likely actual root
  cause, since the reset handler's logic was correct both times it was checked by reading the code.

## Base layer: author-selected DMS layer instead of bespoke bbox-fetch (2026-08-31, PLANNED)

**Problem**: the pickable network (`useEdgeLayer.js`) currently owns its own data pipeline —
bbox-chunked `GET /edges` fetches on activation + every `moveend`, entirely outside DMS's normal
source/view/symbology mechanism. This is slow on first render (N parallel Postgres round-trips
gate first paint) and bypasses the access-control boundary the normal Layer Manager path enforces
(a plugin querying a hardcoded table directly, vs. an author-added, permission-scoped layer).

**Decision**: follow the DMS convention instead — the author picks the base network layer through
MapEditor's normal Layer Manager (like any other layer), and `detour` consumes that
already-tiled, already-authorized layer via `map.queryRenderedFeatures` instead of fetching its
own GeoJSON. Both of detour's modes (single-trip + closure-density) share `useEdgeLayer.js`'s
segment-picking unchanged after this — only the base layer's origin changes, not how either mode
consumes `selectedSegment` afterward. `routing` (the sibling plugin) is explicitly OUT of scope
for this change — `detour` only, per direct instruction.

**Precedent, not invented**: `routecreation` already does exactly this — see
`routecreation/internalPanel.jsx` (author-facing layer `select` built from
`Object.keys(state.symbology.layers)`) and `routecreation.plugin.jsx`'s `mapRegister` (resolves
the chosen layer id, force-sets `data-column` so a needed column survives into tile properties)
and `hooks/useMapTmcHandler.js` (`map.queryRenderedFeatures(e.point, { layers: [shapefileLayerId] })`).

**Column check, done live via read-only SQL against `npmrds2`/`neptune.availabs.org:5758`
(2026-08-31, using creds already in
`src/dms/packages/dms-server/src/db/configs/npmrds2.config.json`)** — this corrects a wrong
assumption from earlier in this task file:
- View 3699 ("Temp OSM Conflation v2", source 2125) — the one this file's own "line-offset"
  investigation above checked for tile symbology — is **NOT** the right table. It's
  `temp.osm_conflation_1_2024`, the TMC/RIS-enriched match table, a **different physical table**
  with its own separate `ogc_fid` sequence and **no `highway` column**. Using it as the base layer
  would make clicked `ogc_fid`s meaningless to `excluded_edge_ids`/`resolveDetourEndpoints`.
- **Correct source: 2097 ("Temp OSM Conflation Edges")** — `temp.osm_conflation_1_2024_edges` for
  2024 (view 3701), `temp.osm_conflation_1_2023_edges` for 2023 (view 3704) — the exact table
  `data-types/routing/memoryGraph.js` and this plugin's backend already operate on
  (`ogc_fid`/`osm`/`tmc`/`ris`/`highway`/`reversed`/`from_node`/`to_node`/`wkb_geometry`).
  **Already has real DAMA tile symbology registered**
  (`https://graph.availabs.org/dama-admin/npmrds2/tiles/3701/{z}/{x}/{y}/t.pbf`) — an author can
  already add it as a normal layer via the Layer Manager today, no new backend/tiling work needed.

**Simplification found while planning (2026-08-31)**: grepped every consumer of `selectedSegment`
across `comp.jsx`/hooks/components — **`.fromNode`/`.toNode`/`.highway`/`.osm` are set today but
never actually read anywhere**; only `.ogcFid` and `.geometry` are consumed (endpoint
resolution moved fully server-side back on 2026-08-25, per `resolveVerifiedEndpoints`/
`resolveDetourEndpoints`). PostGIS's `ST_AsMVT` always keeps `ogc_fid`/geometry regardless of
`data-column`/`filter`/`filter-group` config — so **no column-forcing trick on the author's layer
is needed at all**, unlike `routecreation`'s `tmc` case. This removes the one part of the plan
that risked mutating the author's own filter/symbology config as a side effect.

**Plan**:
1. `constants.js` — add `EDGES_LAYER_KEY` (a plugin-data key, mirrors `SHAPEFILE_LAYER_KEY`) and
   `BLANK_OPTION`; remove now-dead `EDGES_SOURCE_ID`/`EDGES_LAYER_ID` (the plugin no longer owns
   this source/layer).
2. `internalPanel.jsx` — takes `{ state }` (currently ignores it), adds a `select` control listing
   `Object.keys(state.symbology.layers)` (mirrors `routecreation/internalPanel.jsx` exactly),
   writing to `pluginData.detour['active-layers'][EDGES_LAYER_KEY]`.
3. `detour.plugin.jsx` — no `mapRegister` column-forcing needed (see simplification above); its
   `cleanup` restores the author layer's visibility to `'visible'` (in case it was hidden by
   `isActive` toggling) and drops the `EDGES_SOURCE_ID`/`EDGES_LAYER_ID` teardown lines.
4. `useEdgeLayer.js` — rewritten, not patched: delete `resolveEdgesInBbox` import,
   `splitBboxIntoChunks`, `EDGE_CHUNK_SIZE_DEG`/`MAX_EDGE_CHUNKS`, `refreshEdges`, the `moveend`
   fetch loop, and all `addSource`/`addLayer`/`removeLayer`/`removeSource` calls for the base
   network (not owned by the plugin anymore). New signature `useEdgeLayer(map, edgesLayerId,
   isActive)`. Hover/click `queryRenderedFeatures` scope to `edgesLayerId` instead of
   `EDGES_LAYER_ID`. `isActive` toggling now does `map.setLayoutProperty(edgesLayerId,
   'visibility', isActive ? 'visible' : 'none')` instead of adding/removing a plugin-owned
   source. `selectedSegment` drops the dead `osm`/`fromNode`/`toNode`/`highway` fields, keeps only
   `{ ogcFid, geometry }`.
5. Delete `hooks/resolveEdgesInBbox.js` entirely (only consumer removed in step 4).
6. `comp.jsx` — resolves `edgesLayerId` from `pluginData.detour['active-layers'][EDGES_LAYER_KEY]`
   (same `pluginDataPath` already computed there) and passes it to
   `useEdgeLayer(map, edgesLayerId, !hasResult)` instead of `(map, DEFAULT_CONFLATION_VIEW_ID,
   pgEnv, !hasResult)`.

**Live-tested 2026-08-31** — added source 2097/view 3701 ("Temp OSM Conflation Edges 2024") as a
normal layer, picked it in detour's new internalPanel control. Base layer rendered (fast, no bbox
fetch) and hover worked (amber preview), but two real bugs found:

1. **MapEditor's generic per-layer hover/click "info popup"** (`state.symbology.layers[layerKey].hover`,
   read by the shared `HoverComp`/`pinHoverComp` in `SymbologyViewLayer.jsx`/`avl-map.jsx` -
   hardcoded truthy on every layer at creation, no author-facing toggle) popped up a card showing
   the layer's name ("Temp OSM Conflation Edges 2024") right at the cursor on hover, and a global
   click handler pins it (the X/up/down-arrow card in the screenshot). Confirmed via research this
   is NOT something detour added - it's unconditional shared MapEditor behavior for every added
   layer, with `layer.props.hover` as the only structural gate and no existing escape hatch
   anywhere in this codebase.
2. **Click wasn't selecting a segment** - hover/`queryRenderedFeatures`/layer-id matching all
   confirmed correct (research ruled out an id mismatch and ruled out the popup's click handler
   explicitly blocking propagation), but the popup card rendering directly at the click point was
   the most likely real cause - a DOM element sitting over the map canvas at the exact click
   location can eat the click before it reaches maplibre's canvas listeners, matching this
   project's own prior `pointer-events-auto` bug class (see `RouteDetailsPanel` fix earlier in
   this file).

**Fixed, staying entirely inside `detour`'s own files (explicit instruction: "do not change
anythingn in map stuff just make edit for this detoru plugin")** - `detour.plugin.jsx`'s
`mapRegister` now force-sets `hover: false` on the author-selected base layer (same class of
mutation `../routecreation.plugin.jsx`'s `mapRegister` already does via its `data-column` force-set
- editing the CHOSEN layer's own config field, not any shared map component). `cleanup` restores
`hover: "hover"` (its original default) alongside the existing visibility restore, so the layer
behaves normally again once the plugin unmounts/the author picks a different base layer.

**REVERTED same day, after deep architecture trace** - the `hover: false` fix was wrong. Traced
the real mechanism end-to-end (per user request: "understand the architecture... once we selected
the rest flow has to be same" before patching further):

- `mapRegister(map, state, setState)` fires **exactly once**, on `PluginLayer`'s mount
  (`PluginLayer.jsx:52-58`, empty-deps `useEffect`) - never re-fires when the author changes the
  base-layer selection afterward. Only `dataUpdate` gets that signal. So even a correct mutation
  placed here can only ever apply to whatever `edgesLayerId` was resolvable at that single mount
  moment.
- `state.symbology.layers[layerKey].hover` DOES genuinely reach the running `HoverComp` (traced
  through `MapEditor/index.jsx`'s `layerProps` useMemo -&gt; `avl-map.jsx:713`'s `l.props = get(...)`
  -&gt; `SymbologyViewLayer.jsx:794`'s `if(!layer.props.hover) return`) - no stale-snapshot issue.
  But **`hover` only gates `HoverComp`'s own inner content div** - nothing else.
- The actual popup/pin-marker/X-close-button chrome is produced by a SEPARATE, hardcoded pipeline
  that never checks `props.hover`: `avl-layer.jsx:225-226`'s mousemove hover detection
  (`if (!maplibreMap || !isActive || !onHover) return` - `onHover` is `ViewLayer.onHover`, a
  class-level constant with `isPinnable: this.isPinnable || true`, always truthy for every
  `ViewLayer`, no per-layer opt-out) sets `state.hoverData.hovering = true`; `avl-map.jsx:848-861`
  attaches a single global `click` listener whenever ANY active layer is pinnable (always); on
  click, `pinHoverComp` (`avl-map.jsx:770-776`) unconditionally creates a `maplibregl.Marker` and
  dispatches `pin-hover-comp`, pinned iff `hovering` was true; `HoverComponent.jsx:53-88`'s
  `PinnedHoverComponent` unconditionally renders the X `RemoveButton` regardless of whether
  `children` (i.e. `HoverComp`'s content) is empty. So `hover: false` blanked the popup's content
  but left the marker+pin-wrapper+X-button fully intact - confirmed live-tested as "even worse"
  (an empty pin instead of no pin).
- Separately, the "Layer is controlled by Plugin... To enable this panel, remove the plugin, or
  link it to a different layer" message the user also saw in the Layer Editor is UNRELATED to the
  hover mutation - traced to `LayerEditor/index.jsx:62-70`'s `isActiveLayerPlugin` check
  (`stateUtils.jsx:38-44,106`: true whenever the layer open in Layer Manager appears in ANY
  plugin's `pluginData[...]['active-layers']`). This is a pre-existing, arguably-correct side
  effect of the base-layer-selection feature itself (Base layer plan above) - it started the
  moment the author picked the layer via internalPanel.jsx, not because of the hover patch. Not a
  bug to fix, just a fact to know about (the Style/Legend/Popup/Filter/Join tabs for a
  plugin-claimed layer are intentionally locked while claimed).
- The pink Legend-tab highlight visible in the same screenshot was investigated as an alternative
  hypothesis (does Legend-item-selection drive the popup?) - **not supported by any code found**
  in `avl-map.jsx`/`avl-layer.jsx`/`SymbologyViewLayer.jsx`; the popup+marker are fully explained
  by the click-anywhere-while-hovering pin mechanism above, independent of the Legend tab.

**`mapRegister`/`setState` on `hover` is reverted back to a no-op.** `cleanup`'s visibility-restore
stays (that part was correct and unaffected by this finding).

**Real options going forward, not yet decided/built** (see conversation - user has not yet chosen
one, explicit instruction remains "do not change anything in map stuff"):
1. A small, additive, opt-in change to `avl-layer.jsx`'s `onHover` gate or `avl-map.jsx`'s
   `isPinnable` computation (e.g. reading a new `layer.props['suppress-hover']` flag) - would
   actually work, but is a change to shared map/library code, currently out of bounds per explicit
   instruction.
2. A plugin-side DOM/event-capture workaround (e.g. a capture-phase listener on
   `map.getCanvas()` calling `stopImmediatePropagation()`) - flagged as genuinely risky: it would
   very likely also block `useEdgeLayer.js`'s OWN `map.on('click', ...)` handler, since that goes
   through the exact same maplibre-internal dispatch the generic pin listener does - not a clean
   fix, not attempted.
3. Live with the popup/pin appearing as a known cosmetic side effect for now (confirm click
   selection itself isn't actually blocked - the architecture trace found no evidence propagation
   is stopped anywhere in the existing pin mechanism, so `useEdgeLayer`'s own click handler should
   still fire and select correctly despite the visual clutter) - needs a real live click-test to
   confirm this, not yet done since the hover-mutation attempt intervened first.

**Root cause found + fixed, 2026-08-31 - the actual bug, unrelated to the popup investigation
above.** Added a temporary debug log in `useEdgeLayer.js`'s `onClick` and had the user click live:
console showed `foundFeature: true` but `ogcFid: undefined` on every click - the click handler WAS
firing and WAS finding a feature via `queryRenderedFeatures`, it just could never read `ogc_fid`
off it. Cause: **`ogc_fid` comes back as the vector tile's FEATURE ID (`feature.id`), not a
`properties` key** - `useEdgeLayer.js` was reading `feature.properties.ogc_fid` (matching the old
plugin-owned-GeoJSON code, where the plugin controlled the property shape itself), but PostGIS's
`ST_AsMVT` keeps `ogc_fid` specifically as the MVT feature id when the tile is built, not inside
`properties`. `../routecreation` never surfaced this because it only ever reads a real property
(`tmc`, via its `data-column` trick) - it has no reason to read `ogc_fid` at all. This also
explains why hover appeared to "work" the whole time: `renderHover`/`nearestFeatureToPoint` only
ever needed `feature.geometry`, never `ogc_fid` - so the hover path never exercised the broken
line.

**Fix**: `useEdgeLayer.js`'s click handler now reads `const ogcFid = feature.id;` instead of
`feature.properties.ogc_fid`. One-line fix, entirely inside `detour`'s own file, no map/shared
code touched - resolves the actual reported bug ("just hovering, not selecting"). Debug log
removed.

**The popup/pin-marker cosmetic issue (options 1-3 above) is still open and separate** - this fix
only addresses click-to-select; the generic hover/pin popup chrome still appears as described
above and remains unresolved pending a decision on options 1-3.

**Live-verified 2026-08-31** - click-to-select works now (confirmed live: single-trip AND density
mode both ran real analyses end-to-end, e.g. a 100/100-pair closure-density heatmap with candidate
points, matching the pre-refactor behavior).

**Follow-on bug found + fixed same day**: after a result renders ("Get detour"/"Analyze coverage"),
the pickable base network layer stayed visible instead of hiding (`isActive` correctly flips to
`false`, but the one-shot `setLayoutProperty(edgesLayerId, "visibility", "none")` call in
`useEdgeLayer.js` wasn't sticking). Root cause: the author-selected layer's OWN rendering pipeline
(outside detour's control) re-syncs on any symbology state change - including the frequent,
unrelated state updates this plugin itself fires while showing a result (density progress,
candidate-point updates) - and each re-sync can reassert the layer's own default visibility,
silently undoing the one-shot call. **Fix, staying inside `useEdgeLayer.js` only**: the visibility
effect now also re-subscribes to the map's `'styledata'` event and reapplies the intended
visibility on every fire (not just once), so this plugin's intent keeps winning without touching
any shared layer/map code.

**Still visible live-tested, 2026-08-31**: the `'styledata'`-reassert fix above was NOT enough -
confirmed live, the base network layer stayed fully visible through density mode's "Points found -
computing routes..." intermediate phase (the point where `density` first becomes truthy and
`hasResult`/`isActive` should already have flipped). Whatever is reasserting the layer's own
default visibility fights harder/more often than a single map-event listener can reliably win
against event-ordering-wise.

**Fix #2, same file, more robust**: replaced the single `'styledata'` listener with a 300ms
`setInterval` that reapplies the intended visibility repeatedly while `!isActive` (cleared
immediately once `isActive` is true again or the effect tears down). This sidesteps needing to
know exactly what/when the other side reasserts - polling converges within one tick regardless.
Still entirely inside `useEdgeLayer.js`, no shared/map code touched.

**Live-verified 2026-08-31 - CONFIRMED FIXED.** Added temporary per-call debug logging
(`edgesLayerId`/`isActive`/`exists`/`before`/`after`) to get hard evidence rather than iterate
blind a third time; user re-tested with logging in place and separately confirmed via screenshot -
the base network layer now hides completely once a result renders (both single-trip and density
mode), leaving only the result (route line, candidate points, node markers) on the plain basemap.
Debug logging removed after confirmation. The 300ms interval-poll approach is the one that
actually works - both the one-shot apply and the `'styledata'`-listener-only version (both tried
first) did not.

Net history of this sub-bug, for future reference: one-shot `setLayoutProperty` (didn't stick) ->
`'styledata'` listener reassert (still lost the fight) -> 300ms `setInterval` reassert while
`!isActive` (works). All three attempts stayed entirely inside `useEdgeLayer.js`, no shared
map/layer code touched, per explicit instruction throughout this arc.

## Live DMS page Map component - checked, deferred (2026-08-31)

User asked whether this base-layer approach (author picks a layer, plugin auto-hides it - no
manual "eye" toggle exists for a page viewer, confirmed: `settings/controls.jsx`'s `setLayerPanel`
is an AUTHOR-side edit-mode control only) will actually work once `detour` is placed in a real
published DMS page's Map section, not just tested inside MapEditor.

**Checked, good news - no extra work needed for the automation itself.** `patterns/page/.../
ComponentRegistry/map/index.jsx:15` imports `PluginLayer` directly from
`mapeditor/MapEditor/components/PluginLayer` - the SAME component, not a fork - which is what
calls `plugin.mapRegister(map, state, setState)`/`plugin.cleanup(...)` and renders
`plugin.comp({state, setState, map})`. So `detour`'s own automated visibility logic
(`useEdgeLayer.js`'s `isActive`-driven interval) runs through the identical plugin lifecycle on a
live page as in MapEditor - nothing page-specific to build for the automation itself.

**What's still genuinely uncertain**: `SymbologyViewLayer.jsx` (the component rendering the
author-selected BASE layer itself - the thing our interval-poll fights against) IS a separately
forked file on the page side (`patterns/page/.../ComponentRegistry/map/SymbologyViewLayer.jsx` vs.
`patterns/mapeditor/MapEditor/components/SymbologyViewLayer.jsx` - diffed at 1,663 lines
different). The interval-poll doesn't care about the internals of what it's fighting, so it should
still work, but this has only been live-verified against MapEditor's copy so far.

**Decided 2026-08-31: focus stays on MapEditor for now** - live-page verification (publishing a
real page with a Map section + `detour`, confirming the same hide-on-result behavior there) is
explicitly deferred, not scheduled yet.

## False alarm: "layer still visible after result" - resolved, not a real bug (2026-08-31)

After the interval-poll fix was confirmed working (grey/pink "Temp OSM Conflation Edges" styling
genuinely disappeared in one test), a LATER test on a different map/symbology ("test osm detour")
appeared to show the same bug again - grey/white streets stayed visible through a completed
"Analyze coverage" result. Investigated properly instead of re-patching blind:

- **Layers tab showed only one DMS layer** ("Temp OSM Conflation Edges 2024") - no second
  basemap-style entry, but that alone didn't prove the grey streets belonged to it.
- **Decisive test**: switched `detour`'s "Base network layer" dropdown to blank/none entirely.
  The grey streets did not change AT ALL - proving they have nothing to do with that layer
  selection, and are the map's own base style/basemap streets (baked into the map style itself,
  never registered as a DMS/DAMA layer, never shown in the Layers panel, not something any plugin
  can control).
- **Real explanation surfaced once the layer was unclaimed and its actual Style panel was
  visible**: "Temp OSM Conflation Edges" on this particular test map had its own author-configured
  **Opacity: 0%** - set independently of any of this task's code, meaning the actual target layer
  has been invisible by its own paint config this whole time, unrelated to the `visibility`
  layout property `useEdgeLayer.js` toggles. Confirmed with the user directly ("opacity was 0
  only").
- **Revised, 2026-08-31 - it WAS a real bug after all, found by re-reading the Style-panel
  screenshot more carefully.** The panel showed TWO separate paint properties, not one: `Fill:
  Opacity 0%` (the main line, correctly invisible) AND `Casing: #7d7d7d / 2px / -1.5px` (a
  separate outline sub-layer, full opacity, mid-grey - an exact match for the "grey streets" seen
  throughout this investigation). This connects to a fact the earlier architecture-trace research
  pass already surfaced but wasn't applied here: **every line-type DMS layer renders as TWO
  maplibre layers sharing one symbology config** - the unsuffixed id (fill) and `${id}_case`
  (casing), confirmed via `LayerManager/utils.jsx`'s `getLineLayer`. `useEdgeLayer.js`'s
  visibility toggle only ever set `visibility` on `edgesLayerId` itself - never on
  `${edgesLayerId}_case` - so the casing sub-layer stayed visible regardless of `isActive`,
  regardless of the interval-poll fix, regardless of the base-layer dropdown (clearing the
  dropdown just stops the plugin from touching ANY layer id, which trivially left the untouched
  casing exactly as visible as before - that test wasn't actually informative, in hindsight).
- **Fixed**: `applyVisibility` in `useEdgeLayer.js` now sets `visibility` on both `edgesLayerId`
  AND `${edgesLayerId}_case` (each guarded by its own `map.getLayer(...)` existence check, so a
  layer type without a casing sub-layer doesn't error). Still entirely inside `useEdgeLayer.js`,
  same 300ms interval-poll mechanism from the earlier fix, just now targeting both real rendered
  layers instead of one.
- **User pushed back that the casing/opacity Style-panel edit wasn't the root cause** (it was their
  own manual test edit, not evidence of a code bug) - added temporary debug logging in both
  `comp.jsx` (`isActive`/`hasResult`/`edgesLayerId` chain) and `useEdgeLayer.js` (`applyVisibility`
  - what it believes vs. what it actually set/reads back on each real layer id) to get hard
  evidence instead of continuing to guess from screenshots.
- **CONFIRMED WORKING, 2026-08-31 (user's own words: "it's working now")** - both temporary debug
  logs removed after confirmation. The `_case` sub-layer fix combined with the 300ms interval-poll
  mechanism (from the earlier fix) is the final, correct implementation - base layer genuinely
  hides on result and restores on clear, in both single-trip and density modes.

## Separate bug found via console spam, fixed same session (2026-08-31)

User pasted live console output while testing the above - unrelated to the base-layer work, but a
real, pre-existing bug: `hooks/useDensityPointPicker.js`'s `onMouseMove`/`onClick` called
`map.queryRenderedFeatures(..., { layers: [DENSITY_CANDIDATES_LAYER_ID] })` unconditionally,
without checking the layer exists first (unlike `useEdgeLayer.js`'s `queryNearbyEdge`, which
already guards this). Race: `isActive` (density mode + "show candidate points" + "pick point pair
(beta)" all on) can go true before `useDensityCandidatesLayer.js` has actually added
`DENSITY_CANDIDATES_LAYER_ID` (only added once `density.startPoints`/`endPoints` resolve) -
querying a not-yet-added layer throws on every single mousemove, which is what flooded the
console (`[Violation] 'mousemove' handler took 180ms` alongside it, from the repeated throw/catch
overhead).

**Fixed**: both handlers now `if (!map.getLayer(DENSITY_CANDIDATES_LAYER_ID)) return;` before
querying, same guard pattern already used elsewhere in this plugin. Lint clean.

## Live DMS page Map component - first real test, crash found + fixed (2026-08-31)

User tried `detour` in an actual published page's Map section (not just MapEditor) for the first
time - console showed a cascade of `TypeError: Cannot read properties of undefined (reading
'getLayer')` at `ds.getLayer` (maplibre-gl internal), thrown during React's cleanup/unmount phase
across FIVE separate files: `useDensityCandidatesLayer.js:55`, `detour.plugin.jsx:57`,
`useEdgeLayer.js:184`, `useRouteLayer.js:64`, `useStartEndMarkers.js:53` - each caught by
`RenderErrorBoundary`, tearing down and remounting `<Comp>` repeatedly.

**Root cause**: on this page's Map component, the underlying maplibre `map` instance can be
destroyed (`.remove()`'d, internal `style` set to undefined) BEFORE React runs this plugin's own
cleanup effects - a lifecycle-ordering difference from MapEditor, where this never surfaced.
`map.getLayer(...)` then throws INSIDE maplibre itself, even though `map` is still a defined
object reference - so the `if (!map) return` guard already present at every one of these sites
doesn't catch it (it only checks the reference, not whether the map is still functionally alive).

**Not a new problem to solve from scratch** - this exact race was already hit and fixed once
before in this same plugin: `useClosureDensityLayer.js`'s cleanup (2026-08-26) already uses
`if (!map || !map.loaded()) return;` instead of a plain truthiness check, with a comment citing
`AvlLayer`'s own cleanup using the same guard. `.loaded()` (a real MapLibre API checking internal
state, not touching `.style`) survives being called on an already-torn-down map without throwing.

**Fixed**: applied the identical `.loaded()` guard to the other five cleanup sites that were still
using a plain `if (!map) return` - `useEdgeLayer.js`, `useRouteLayer.js`,
`useStartEndMarkers.js`, `useDensityCandidatesLayer.js`, `detour.plugin.jsx`. Lint clean. Not yet
live-verified on the page that surfaced this - needs a fresh test to confirm the crash/remount
loop is gone.

**Also note**: this is now the SECOND finding specific to the live-page Map-component context
(the first was the forked `SymbologyViewLayer.jsx` question, still deferred/unverified) - the
"focus stays on MapEditor for now" decision above has effectively been superseded by the user
actually testing on a live page; treat both contexts as in scope going forward, not just MapEditor.

## Base-layer column validation - no author-facing guardrail existed, built one (2026-08-31)

User raised a real, previously-unaddressed gap: nothing validates that the layer an author picks
in `internalPanel.jsx`'s "Base network layer" select is actually a conflation `_edges` table.
Traced the risk precisely:

- **`DEFAULT_CONFLATION_VIEW_ID` (constants.js, hardcoded `3699`) drives ALL backend routing calls**
  (`useTrspRoute`, `useClosureDensity`, `usePickedPairRoute`, `resolveVerifiedEndpoints`) -
  completely independent of whatever layer the author actually picks for click-identity. The two
  settings can silently diverge.
- **Failure mode 1 (visible)**: picked layer has no per-feature ids at all - `feature.id` (ogc_fid,
  per the earlier click-selection fix) comes back `undefined`, clicking does nothing.
- **Failure mode 2 (dangerous, silent)**: picked layer DOES have integer feature ids, but for a
  different table/year (e.g. 2023 `_edges` instead of 2024). Since `ogc_fid` is an independent
  auto-increment sequence per physical table, a number meaningful in the picked layer can
  coincidentally also exist in the graph `DEFAULT_CONFLATION_VIEW_ID` actually computes against -
  pointing at a completely different, unrelated road segment. The backend would return a real,
  plausible-looking route/exclusion for the WRONG segment with no error at all.

**Built**: `internalPanel.jsx` now fetches the picked layer's real source metadata and validates
its declared columns before treating it as valid, surfacing a red warning message directly under
the "Base network layer" picker if the layer is missing `ogc_fid`/`from_node`/`to_node`/`highway`.

- Confirmed via research (not guessed) that MapEditor's own `LayerEditor/*` components already use
  exactly this pattern in 8+ places to read a source's declared `metadata.columns` -
  `falcor.get(["uda", pgEnv, "sources", "byId", sourceId, "metadata"])` then read
  `falcorCache[...]"metadata"."value"."columns"` (with a fallback to `...value` directly for older
  sources that store the array there instead) - reused verbatim, no new backend route needed.
- `sourceId` comes for free off the picked layer itself - `state.symbology.layers[layerKey].source_id`
  is already set at layer-creation time (`SourceSelector/index.jsx`), no extra lookup required.
- `internalPanel.jsx` already runs `React.useContext`/hooks directly inside the plain function
  (confirmed established precedent - `../routecreation/internalPanel.jsx` already does this, since
  `InternalPluginPanel` calls `plugin.internalPanel({state, setState})` synchronously during its
  own render, so hooks called here attach to `InternalPluginPanel`'s fiber correctly as long as
  they're called unconditionally every render - matched that existing pattern exactly, not new
  ground).
- The warning renders via the control BLOCK's `label` field, confirmed (by reading
  `PluginControlWrappers.jsx`'s `SimpleControlWrapper`) to render as plain `{label}` JSX children -
  so `label` can be a real element (a small stacked div: the normal "Base network layer" text plus
  a conditional red warning line below it) instead of only a plain string. No new control type or
  shared-code change needed.

**Still open (this task file's own `DEFAULT_CONFLATION_VIEW_ID` gap is NOT yet closed)**: this
column-validation warning only protects the CLICK-IDENTITY side (what `useEdgeLayer.js` reads). It
does NOT yet fix the deeper architectural issue - the backend routing calls still use the separate
hardcoded `DEFAULT_CONFLATION_VIEW_ID` constant, not the picked layer's own `view_id`. An author
could still pick a layer that PASSES this column check (e.g. a real `_edges` table, just for the
WRONG YEAR) and still get the "coincidental wrong segment" failure mode, since the warning doesn't
know which specific conflation view the backend graph is loaded from. The real fix - deriving
`conflation_view_id` from the picked layer's own `view_id` instead of the separate constant - was
proposed in conversation but not yet built; flagged as the next real step, not done in this pass.

**Not yet live-verified** - needs a real MapEditor test: pick the correct "Temp OSM Conflation
Edges" layer (should show no warning once the falcor fetch resolves), then pick a deliberately
wrong layer (should show the red missing-columns warning).

## Performance: distance-based algorithm choice for "Get detour" (2026-08-31)

User asked what could make this faster via code. Traced the real request pattern: one "Get detour"
press fires 4 backend requests (AtoB/BtoA x closed/open), each computing shortest+fastest
server-side - 8 full graph searches per press, all landing on the same single-threaded Node
process. Two real levers identified:

1. **`worker_threads` for true parallelism** - the task history repeatedly flags this as the real
   fix for "N searches queued on one thread," repeatedly deferred as "a bigger lift." Touches
   shared `data-types/routing/` code (used by both `routing` and `detour`) - out of detour-only
   scope without explicit sign-off, not built this pass.
2. **Algorithm choice** - `resolveTrspRoute.js` never sent an `algorithm` param, always defaulting
   to the server's plain Dijkstra, even though `bidirectional` is already built and available.
   User: "choose algorithm wisely... because it will impact more here" (a bad default is felt 8x
   per press here vs. once for a single-search plugin) - not a blanket switch.

**Built**: `hooks/haversineMiles.js` (new) - straight-line distance + `chooseAlgorithm(start, end)`,
reusing the EXACT threshold already validated in `point-to-point-routing-plugin.md`'s 20-pair
benchmark for the sibling `routing` plugin (not a new guess): bidirectional was consistently
SLOWER under ~3mi, only a real (if noisy, modest) win past ~80mi. `routing` itself kept this
manual per an explicit prior user preference ("keep it dijkstra only") - that decision was specific
to `routing`, not binding here. Wired into `resolveTrspRoute.js` (new optional `algorithm` param,
passed through verbatim) and both call sites that hit it: `useTrspRoute.js` (the main "Get detour"
flow) and `usePickedPairRoute.js` (the beta pair-picker, for consistency). Single source of truth
for the threshold - both call sites import `chooseAlgorithm` rather than duplicating it.

**Not yet live-verified** - needs a real long-distance closure test (>80mi apart) to confirm the
backend actually receives/honors `algorithm: "bidirectional"` and responds faster, and a short
closure to confirm normal (<80mi) requests are unaffected (still plain `dijkstra`, matching
today's behavior exactly).

## `conflation_view_id` dynamic-from-picked-layer - attempted, REVERTED, plan-first now (2026-08-31)

Attempted implementing the fix flagged earlier (derive `conflation_view_id` from the picked
layer's own `view_id` in `comp.jsx`, replacing the hardcoded `DEFAULT_CONFLATION_VIEW_ID` constant
everywhere) - user said "no... stop and revert first give me plan then if i say then start".
**Fully reverted** - `comp.jsx` is back to the pre-existing baseline (hardcoded
`DEFAULT_CONFLATION_VIEW_ID` for all four backend calls, no button gating added). Lint-clean,
confirmed only pre-existing unrelated noise remains.

Confirmed while investigating (still true, not undone by the revert): the SERVER side already
supports this dynamically with zero code changes - `getOrLoadGraph(db, pgEnv, conflationViewId)`
is called fresh per-request and lazily loads+caches whatever view_id it's given
(`data-types/routing/memoryGraph.js:368-376`, `graphCache` keyed by `` `${pgEnv}:${conflationViewId}` ``).
The gap is entirely client-side (`detour` always sends the same hardcoded constant).

**Plan to be written up and approved before any further implementation** - see conversation for
the plan; do not re-attempt this change until explicitly told to start.

## Start/end point-picking: bearing-drift bug, live-observed + fixed (2026-08-31)

Separate topic, requested next ("let's improve the start and end points picking process"). Two
candidate gaps were identified by reading `walkToFirstBranchSimple`/`walkToFirstBranchDensity`
(server-side, `data-types/routing/memoryGraph.js` - NOT used by `../../routing`, this is
detour-exclusive logic that happens to live in the shared backend file, so touching it doesn't
cross into `routing`'s territory):
1. Bearing-only road continuation (no highway-class matching) - theoretical, not yet observed live.
2. Pure-topology branch detection (any 2+-connection node counts, including driveways) - theoretical.

**User provided live screenshot evidence of a THIRD, different, confirmed real bug** - the walked
path visibly bent/deflected at a real intersection (osm `5593248`, `highway: residential` - a real
road, not a driveway, ruling out gap 2 as the cause here) instead of continuing straight through
it. Root cause, confirmed by reading the code: the "pick straightest-continuing edge" comparison
used `incomingBearing` - the bearing of the hop JUST taken, **reset every single iteration** - not
the road's actual original direction. This is locally-greedy: small per-hop bearing drift (normal
on any real street, which rarely lies EXACTLY straight node-to-node) compounds over multiple hops,
and at a junction the walk could pick whichever candidate is straightest relative to the last hop
rather than relative to where the road actually started - visually a bend/turn with no real reason.

**Fixed in both `walkToFirstBranchSimple` and `walkToFirstBranchDensity`** (kept as two synced
copies per their existing 2026-08-26 "make search for both separate" convention): renamed
`incomingBearing` -> `referenceBearing`, captured ONCE on the first real hop
(`if (referenceBearing === null) referenceBearing = bearingDeg(...)`) and never updated again -
every subsequent hop's straightness comparison is against that fixed original direction, not the
constantly-drifting previous-hop bearing. The walk still genuinely stops at a real branch once
nothing continues that original direction closely enough - only the COMPARISON reference changed,
not the branch-detection/stop logic itself.

**Server-side change - needs a server restart to take effect** (unlike everything else fixed this
session, which was all client-side `src/themes/...` and hot-reloads). `node --check` confirms
syntax is valid; `npx eslint` on this file shows only 3 pre-existing, unrelated errors (this
subtree is CommonJS per `data-types/package.json`'s override, and the root eslint config doesn't
recognize `require`/`module` as globals here - none on the lines touched).

**Not yet live-verified** - needs a server restart + a fresh test on the exact same segment (near
osm `5593248`) to confirm the path no longer bends there, plus a regression check on a few other
segments (including a genuinely curving real road, to make sure the fixed-reference-bearing
approach doesn't now fail to track a real gradual curve - a theoretical tradeoff of this fix worth
confirming isn't a problem in practice).

Gaps 1 and 2 above remain theoretical/unconfirmed and untouched - not addressed in this pass,
only the concrete bug the user actually observed live.

## Closure-density candidate selection: 10-10 shortfall + wrong-side picks (2026-09-01)

Live screenshot (a real published DMS page, `sandbox2/page_13`, not just MapEditor) showed a
segment near Rouses Point (Lake Champlain, NY/Canada border - a genuinely sparse rural network)
producing only ~3-4 end candidates instead of the required 10. Two separate real issues, both in
`selectClosureDensityCandidates`/`farthestToNearestNodes` (`data-types/routing/memoryGraph.js`) -
server-side, needs a restart, NOT yet live-verified after these fixes:

1. **10-10 shortfall**: the count-is-a-hard-requirement gap-relaxation logic (already built earlier
   - see the file's own extensive inline history) was still bounded by a hard
   `MAX_CANDIDATE_DISTANCE_M` distance cap (8mi, reduced from 20mi on 2026-08-25 for a real,
   measured perf reason). In a sparse area, 10 valid candidates may genuinely not exist within
   8mi - no amount of gap-relaxation manufactures more points than the search radius reaches.
   **Fixed**: raised to 15mi - a middle ground, not a full revert to 20mi, explicitly to be
   tested live before treating as final (user: "let's test first for this detour and then will
   make rule if it's a good progress/upgrade").
2. **Wrong-side picks**: user flagged directly - candidates must never end up on the geometric
   "opposite side" of the closure from their own seed (a U-turn back onto the correct side is
   fine; ending up past the closure on the other side is not). The EXISTING corridor-block
   (`blockedNodes` in `farthestToNearestNodes`) only prevents crossing through the specific nodes
   the OTHER side's seed-walk visited - it does nothing to stop a genuinely different road
   (a parallel street, a loop, a bypass) from reaching the wrong side without ever touching those
   blocked nodes. **Fixed**: added `sideOfSegment` - a real geometric side-of-line test (the closed
   segment's own bearing + a perpendicular through its midpoint, local equirectangular
   approximation), applied as a post-filter on each side's raw candidate pool (same-road and
   "other" sub-groups filtered separately so `sameRoadCount` stays accurate). Evaluated on the
   candidate's FINAL position, not the path taken to reach it - so a U-turn that ends up back on
   the correct side still passes, matching the user's exact framing.

**Explicitly experimental, not yet a finalized rule** - user's own words: test first, decide if
it's a real upgrade after seeing it live. `node --check` passes, lint shows only the same 3
pre-existing CommonJS-global errors (unrelated). Needs: a server restart, then a live retest on
the same Rouses Point segment (and a regular/dense-network segment, to confirm the geometric
filter doesn't over-reject in a normal case) before either side of this change is treated as
settled.

**LIVE-TESTED AND REVERTED, same day.** Result was worse, not better: "Analyzed 10 of 100 possible
routes (10 had no route)" - every single candidate pair failed to find a route at all - and the
user reported it "taking a lot of time" (a real perf regression too, likely from the widened 15mi
search radius). User: "this is even worst taking a lot of time and then this, so revert last."

**Fully reverted, both parts** - `MAX_CANDIDATE_DISTANCE_M` back to `8 * MILE_M`, `sideOfSegment`/
`filterBySide` removed entirely (not left disabled/commented - deleted, matching this codebase's
"delete what's genuinely unused" convention). Confirmed via `grep` that no trace remains, `node
--check` passes, lint shows only the same 3 pre-existing errors. Back to the exact state this file
was in after the earlier bearing-drift point-picking fix (that fix is untouched by this revert -
only the 10-10/side-filter experiment from this section was undone).

**Open question for next time, not yet diagnosed**: WHY did raising the distance cap + adding the
side filter make things worse rather than better - "10 had no route" is a different failure mode
than "too few candidates found" (the original complaint). Possible causes not yet investigated:
the side filter may have been too strict and excluded valid candidates outright (leaving too few
to even attempt), the wider 15mi radius may have pushed candidates past where a real route exists
at all in this specific sparse area, or something else. Needs real diagnosis (add logging, inspect
an actual failing case) before attempting a fix again, not another blind parameter change.

**Diagnostic logging added, 2026-09-01** ("yeah but again i want 10-10 must and check why it's not
coming") - a `console.log` right before `selectClosureDensityCandidates`'s return, capturing the
count at every pipeline stage: raw pool size per side, same-road count, `candidatesRejected`,
valid count per side/group, final picked count, gap actually used. Lets a real shortfall be traced
to its actual cause (sparse raw pool vs. over-strict >50% validation vs. gap-relaxation itself
failing) instead of guessing at another parameter change. TEMP - remove once root-caused. Needs a
server restart to take effect, then a live "Analyze coverage" run on the same Rouses Point segment,
server log output pasted back for diagnosis before any further code change.

**Live-tested a DIFFERENT segment (not Rouses Point) same day - worked well**: "Analyzed 100 of
100 possible routes," a real distribution shown, candidate points spread across both sides. Not
the sparse-network failure case, but confirms the pipeline works correctly in a normal area.

**No-U-turn constraint added, 2026-09-01** ("keep things of the u turn, so in that direction do
not u turn, keep that and will check what is the result there" - explicitly another experimental
variant to test, not yet a finalized rule). `farthestToNearestNodes`'s Dijkstra expansion is
undirected by design (comment: "candidate picking only needs how far is this node, not a turn-
restriction-correct path") - meaning it could always immediately double back the way it came.
**Fixed**: added a `predecessorNode` typed array tracking which node each node was actually
reached FROM (alongside the existing `reachedVia` edge tracking), and the relaxation loop now
skips any edge leading straight back to that predecessor - a cheap O(1) per-relaxation check,
deliberately NOT using the existing `findReverseEdge` helper (an O(degree) adjacency scan) since
this runs inside the hot per-edge Dijkstra loop across a potentially large search radius. This
does NOT prevent all backtracking (a candidate can still loop around via a different path and
approach from a direction that feels like a U-turn geometrically) - it specifically prevents the
one cheap, common case: immediately reversing onto the same edge just traveled. `node --check`
passes, lint shows only the same 3 pre-existing errors.

**LIVE-TESTED AND REVERTED, same day.** Result: "Analyzed 100 of 100 possible routes (100 had no
route)" - every single pair failed, worse than the baseline. User's own diagnosis, precise and
useful: "it is not doing the u turn but the gap between the nodes is too less which is not useful
at all" - the no-U-turn constraint itself worked correctly, but forcing the search to never
backtrack pushed it into taking long, winding detours around any obstacle instead of the direct
nearby path, collapsing real network distance between consecutive candidates down to nearly
nothing (defeating `MIN_GAP_M`'s whole purpose) even though `dist[n]` (used for gap enforcement)
kept growing along that longer forced path - so the candidates were both too close together AND
routing-invalid. **Reverted, confirmed clean** - `predecessorNode`/`cameFrom` fully removed (no
trace via `grep`), `node --check` passes, lint shows only the same 3 pre-existing errors.
`farthestToNearestNodes` is back to its original unrestricted (U-turns allowed) form. The
diagnostic logging from the prior fix is still in place and untouched.

**Running tally of this candidate-selection area today**: distance-cap raise + side filter (tried,
reverted), no-U-turn constraint (tried, reverted) - two real, informative negative results, not
wasted effort. Current baseline is the original 8mi-cap, U-turn-allowed, no-side-filter version
plus the still-active diagnostic logging. Next attempt should use the diagnostic log's actual
numbers (once captured from a real "Analyze coverage" run) rather than another blind structural
change - two structural changes in a row have now both made results worse, which is itself useful
signal that the ORIGINAL algorithm's shortfall is likely a genuinely sparse-network case (not a
fixable algorithm flaw) rather than something more aggressive expansion/constraints can solve.

## DMS theme compliance - started with `routing`, `detour` on hold (2026-09-01)

User asked whether `routing`/`detour` follow DMS theming rules. Checked directly: neither does -
both only use `ThemeContext` to pull `{ UI }` component references, never `getComponentTheme` for
styling; every visual class is raw hardcoded Tailwind (`routing/RouteDetailsPanel.jsx`: 31,
`detour/DetourDetailsPanel.jsx`: 39, `detour/ClosureDensityPanel.jsx`: 32,
`detour/RouteComparisonBarChart.jsx`: 11, `detour/internalPanel.jsx`: 2). This matches this
project's own documented, established MapEditor-pattern precedent (raw Tailwind by convention,
deliberate, previously deferred as a separate compliance task) - not a `routing`/`detour`-specific
gap.

**Full site-wide-registerable compliance would require new core `src/dms/` library code** - traced
`getPatternTheme()`'s actual mechanism: `src/dms/packages/dms/src/ui/defaultTheme.js` manually
imports each pattern's own `defaultTheme.js` (page/datasets/auth/admin all do this); there is no
`patterns/mapeditor/defaultTheme.js` entry at all. Proposed creating one + one import line in the
core file - **user declined this piece explicitly** ("no revert that mapeditor default theme
thing" - nothing had actually been written yet, so nothing to literally revert).

**Decided approach instead**: local `.theme.js` sibling files per component (the DMS package's own
documented naming convention - `Foo.jsx` + `Foo.theme.{js,jsx}`), read via the standard
local-default-spread + `getComponentTheme` pattern, but NOT registered into any site-wide merge
pipeline. Since nothing registers these theme keys into `ThemeContext`, `getComponentTheme` always
returns `{}` and every component falls back to its local default - **zero visual change**, but
every className now lives in one named, discoverable file instead of scattered inline. Honest
tradeoff, stated to the user: a site author can't override these plugins' look through the normal
theme-admin UI this way, only by editing the `.theme.js` file directly - accepted as the cost of
not touching core `src/dms/` code.

**`routing` DONE**: `components/RouteDetailsPanel.theme.js` (new) exports `routeDetailsPanelTheme`
- every one of the 31 raw classNames moved into it, keyed semantically (`panel`, `title`,
`stepText`, `variantButton`, `statRow`, `segmentRow`, `getRouteButton`, etc.).
`RouteDetailsPanel.jsx` now imports `getComponentTheme` alongside the existing `ThemeContext`
import, builds `const t = { ...routeDetailsPanelTheme, ...getComponentTheme(themeFromContext,
"routeDetailsPanel") }`, and every JSX `className="..."` replaced with `className={t.<key>}`.
Confirmed zero raw `className="` strings remain (`grep` clean). Lint clean (only the same
pre-existing `prop-types` noise, no new errors).

**`detour` RESUMED AND DONE, 2026-09-01** ("yeah i want this too, these boxes too" - pointing at a
live screenshot of the detour panels). All 4 files converted:
- `internalPanel.theme.js` (new) - the base-layer-status warning text (2 classNames).
- `DetourDetailsPanel.theme.js` (new) - the main panel + its co-located `ImpactBlock` sub-component
  (39 classNames), plus `ROUTE_COLOR`/`ROUTE_SECONDARY_COLOR` folded in as `t.colors`.
- `ClosureDensityPanel.theme.js` (new) - both stacked panels (results + comparison), 32 classNames.
  Incidentally fixed a pre-existing unused-var lint warning (`(hex, i) =>` → `(hex) =>`) while
  rewriting the file.
- `RouteComparisonBarChart.theme.js` (new) - 11 classNames, plus `ROUTE_COLOR` folded in as
  `t.colors.primary`. This file had no `ThemeContext` import at all before - added it.

**`routing`'s dynamic colors also folded in** (user: "and it's all themable right?" → "yeha i want
this too"): `ROUTE_VARIANT_COLORS` moved into `RouteDetailsPanel.theme.js` as `t.colors`, the two
`style={{...}}` blocks that read it directly now read `t.colors.primary`/`t.colors.secondary`
instead - single source of truth, `constants.js` still holds the raw hex values, the theme file
just re-exports them alongside the classNames.

**Verified across both plugins together**: `grep -rn 'className="' detour/ routing/` returns
nothing - zero raw Tailwind strings remain anywhere in either plugin. Full lint pass shows only
pre-existing, unrelated `no-unused-vars` warnings in the two `comp.jsx` files (predates this
session) - no new errors introduced by the theme conversion across all 7 converted files (2 in
`routing`, 5 in `detour` counting `internalPanel.jsx`).

**Not yet live-verified** - needs a quick MapEditor check that both plugins' panels render
visually identically to before (expected, since every theme value is byte-identical to what was
inline - this was a pure refactor, no visual changes intended).

## DECIDED (2026-09-01): dynamic `conflation_view_id` proposal DECLINED for `detour` too - different shape than `routing`

Same underlying decision as `point-to-point-routing-plugin.md`'s matching note, but shaped
differently here since `detour` already has the layer-picker UI built (unlike `routing`, which
never got one):

- **The base-layer picker (`internalPanel.jsx`'s "Base network layer" select) STAYS** - author can
  pick any conflation-layer year for click-identity/rendering purposes. This part is NOT being
  removed or restricted to 2025-only.
- **But `conflation_view_id` sent to the backend (`/trsp-memory` etc.) does NOT derive from
  whichever layer the author picked.** It stays hardcoded (same single-constant approach as
  `routing`), and will be set to 2025's correct view_id once that data exists (does not exist yet
  as of this note). The earlier "derive conflation_view_id from the picked layer's own view_id"
  proposal (see the "conflation_view_id must be dynamic" section, still further up this file) is
  DECLINED, not just on hold.

**Real residual risk, stated plainly and acknowledged by the user, not silently accepted**: if an
author picks a NON-2025 layer as the base network layer, its `ogc_fid` values get read off that
layer's own tiles (via `feature.id`, see the click-identity fix earlier in this file) and sent to
a backend that is ALWAYS computing against the 2025 graph. Since `ogc_fid` is an independent
auto-increment sequence per physical table, an id meaningful in the picked (non-2025) layer could
coincidentally also exist in the 2025 graph, pointing at a completely different, unrelated
segment - a real "silently wrong route, no error at all" failure mode. The column-validation
warning already built (`internalPanel.jsx`, checks `ogc_fid`/`from_node`/`to_node`/`highway`
columns exist) does NOT catch this - it only validates the picked layer LOOKS like a conflation
edges table, not that it's specifically the 2025 vintage. User's explicit call: this residual risk
is acceptable ("that is not the problem here at all") - not revisited unless it becomes a real
issue in practice.

**Net effect: no further code changes needed for this decision** - the layer-picker UI already
built stays exactly as-is; only the (not-yet-built) "derive view_id from picked layer" work is
what's being declined, and that was never implemented (stayed at the proposal/discussion stage
throughout). The one real future action item, for both `routing` and `detour`: update the
hardcoded conflation_view_id constant to 2025's correct value once 2025 data is published - a
plain value swap in each plugin's `constants.js`, same mechanism already used for every prior
year's swap (see `point-to-point-routing-plugin.md`'s "View swap #1/#2/#3" history).

## Testing Checklist

- [ ] Clicking a segment immediately (no prior point-picking) computes a route between its two
  endpoints, excluding that segment.
- [ ] The computed route's edge list does not contain the selected segment or its reverse
  direction.
- [ ] Clicking a different segment replaces the previous selection/route (not additive).
- [ ] Clicking the same segment again deselects and clears the route.
- [ ] A segment with no viable detour (e.g. a dead-end spur) shows an explicit "no route possible"
  message, not a silent failure.
- [ ] Confirm this still doesn't touch/affect the `routing` plugin in any way.
- [ ] Confirm "Get detour" shows the route immediately, without needing to touch the shortest/
  fastest tabs first (the `runWhenStyleReady` fix above).
- [ ] Confirm "Clear detour" actually removes the start/end markers now, on a fresh hard refresh.
- [ ] Confirm both directions actually render on the map at once when both exist (bold + dashed),
  not just one.

## Same-road endpoint picking - BUILT 2026-08-20

User: "on a same road one point is there but one point is near the start/end of selected segment
in parallel road so high priority must be on the same road point... think like detour scenarios
where segment is disconnected and flow of traffic how it will affect from single or both
directions." The original nearest-any-node search (geometric distance only) could pick a point on
a PARALLEL road that happened to be closer than the real continuation of the SAME road - wrong for
a detour analysis, since the derived start/end is supposed to represent "where a trip on THIS road
would actually be."

**Built** (`hooks/findSameRoadNode.js`, wired into `comp.jsx`'s `resolveEndpointNode`):
- **Priority 1 - same road continuation.** For each segment endpoint, fetch nearby edges (reusing
  the same bbox-scoped `GET /edges` route the pickable layer already uses) and look for an edge
  touching that node with the SAME `highway` type as the closed segment. Among matches (or if none
  match on highway, among all connected edges), pick the one whose outgoing bearing is closest to
  the segment's own local approach bearing at that node - the straightest continuation, not a turn
  onto a same-class cross street. `selectedSegment` now carries `highway` (added in
  `useEdgeLayer.js`'s click handler) so this comparison is possible.
- **Priority 2 - the disconnected/dead-end case, explicitly handled, not silently substituted.**
  If the widened search (same progressive-expansion pattern as before, up to 5x) finds NO
  connected edge at all at that endpoint, that's a real topological fact - a genuine dead end or
  an isolated point - not just "the search radius was too small." Falls back to the original
  plain nearest-any-node search (`findNearestOtherNode.js`, unchanged) ONLY in this case, and
  tags the result `usedFallback: true`. `DetourDetailsPanel.jsx` shows an explicit amber notice
  ("no continuing road nearby... using the nearest node instead") when this happens, rather than
  presenting a degraded pick as if it were the normal case.
- **Single vs. both directions, tied to the existing directional-route work above**: this
  endpoint-picking logic runs once per endpoint regardless of direction - the SAME derived start/
  end feed both the AtoB and BtoA route computations already built. A disconnected endpoint (case
  2 above) affects BOTH directions equally, since it's a property of the point itself, not of
  which way you're traveling through it - worth knowing if debugging why both directions look odd
  for a particular segment.
- **Not yet live-verified against a real parallel-road case** - built and compiles, but hasn't
  been confirmed on an actual real segment where a parallel road is genuinely closer than the same
  road's continuation (the scenario this was built to fix). Flag for the next live-testing pass,
  per this project's standing discipline.

## Also: plain green/red dots, no text labels - BUILT 2026-08-20

"do not write start and end just green and red dots only" - removed the `START_END_LABEL_LAYER_ID`
symbol layer (and its `text-field`) from `useStartEndMarkers.js` entirely, not just hidden -
cleaned up the now-unused constant from `constants.js` and its `removeLayer` call in
`detour.plugin.jsx`'s cleanup, per this project's "delete what's genuinely unused" convention.

## Fault tolerance audit - 2026-08-20

User asked directly: "what are the fault tolerance scenarios here... what if no route found?"
Audited all the ways this plugin can fail, fixed two real gaps found in the process:

| Scenario | Status |
|---|---|
| No route in either direction | Already correct - map renders nothing, panel shows a clear error message |
| No route in only one direction | Already correct - that direction shows a "No route this direction" placeholder card |
| A segment endpoint is genuinely isolated (no connecting road at all, even the plain-nearest-node fallback finds nothing) | **Gap found and fixed** - previously left the panel stuck showing "Finding nearby start/end points…" forever with no indication anything had actually failed. Now sets a `resolveError` message and never enables "Get detour." |
| Network/backend error while resolving start/end points (e.g. the `GET /edges`/`GET /nodes` fetch itself fails) | **Gap found and fixed** - previously only `console.error`'d, invisible to the user. Now surfaces the same way as the isolated-endpoint case. |
| A segment endpoint had to fall back to plain-nearest-node (not disconnected, but no same-road continuation found) | Already correct - amber notice, not silent |

Both fixes live in `comp.jsx`'s new `resolveError` state (distinct from `resolving`/`loading`) and
`DetourDetailsPanel.jsx`'s corresponding message block. Not yet live-verified against a real
isolated-node case (hard to construct on demand) - flag for whenever one is found naturally during
testing.

## Live-verified real asymmetric case - Broadway & W Houston St, 2026-08-20

User tested a real closure between Broadway & W Houston St and got exactly one direction with a
route ("End → Start", 0.2mi/1min/26 edges) and the other "No route this direction." Verified this
is correct, not a bug, by querying the real network data directly rather than assuming: of 119
edges in that immediate area, only 12 have a reverse-direction counterpart - 90% are one-way
streets (SoHo/NoHo's real street grid). The failing direction requires using one of those one-way
side streets against its only legal direction, so no route can exist - exactly the "river
crossing" asymmetry this whole feature (direction-aware detours) was built to surface, confirmed
against real data rather than assumed correct just because the code looks symmetric.

## Open vs. closed comparison - BUILT 2026-08-20

User: "comparing the normal vs the closure difference like the distance if segment is open/close
and travel time and etc for each route." UI reviewed with the user first (stacked blocks per
direction, chosen over a side-by-side-cards alternative) before building.

**Built**: `hooks/useTrspRoute.js`'s `getRoute` now fetches FOUR routes per "Get detour" press
instead of two - the existing closed/excluded pair (AtoB, BtoA) plus an equivalent "open" baseline
pair (same start/end, no `excluded_edge_ids`) - stored separately as `baselineRoutes`, same shape
as `routes`. `DetourDetailsPanel.jsx`'s new `ImpactBlock` component shows, per direction: the open
distance/time/edge-count, the closed (detour) distance/time/edge-count, and the delta (signed,
plus a percentage) - color-keyed to match each direction's map line (solid/dashed). Map rendering
is unchanged (still only the closed/detour lines, per the reviewed UI decision) - the open-vs-
closed comparison lives in the panel only, to avoid cluttering the map with 4 simultaneous lines.
Not yet live-verified with real numbers - built and compiles, needs a real "Get detour" press to
confirm the delta math and the unavailable-baseline fallback path.

**UI simplification history for the impact panel (2026-08-20)**: three iterations were tried in
one session before landing back on the first design - (1) the original stacked Open/Closed/Δ
blocks per direction, (2) a "one headline delta number + small secondary line" simplification
("still tough" per the user), (3) a fully plain-English sentence version with no numbers/symbols
at all ("keep the first one" - reverted). **Current state: back to (1), the original design.**
Noted here so a future session doesn't re-litigate the same three options from scratch.

## Closure coverage / density analysis - PLANNED, NOT STARTED (2026-08-20)

A second mode within this SAME plugin (not a new plugin, not a new tab elsewhere - "plugin will
be same just add the switch to enable and disable that view"), answering a different question
than the single-trip detour above: **"of all the plausible trips that would have used this
segment, which surrounding roads absorb the most rerouted traffic?"** - a closure congestion
footprint, not one trip's detour.

**Confirmed with the user before starting:**
- Candidate points: **BFS outward along the real road network** from each of the closed segment's
  two endpoints (not a geographic-radius search) - respects actual connectivity/branching, same
  principle as the existing same-road endpoint-picking logic, just expanded to ~20 points per side
  instead of 1.
- Failed pairs (no route found between some candidate start/end combination): **skip from the
  tally, but report the count** ("X of 400 pairs had no route") - not hidden.

**Architecture decision: the 400 (20x20) route computations run server-side, in ONE new backend
call, not as 400 separate frontend requests.** The routing graph is already resident in the
server's memory - running the searches there avoids 400 HTTP round trips and lets the aggregation
(which edge appears in how many of the 400 routes) happen without shipping 400 full route
geometries to the browser.

### Backend (new)

- **New route**: `POST /:pgEnv/routing/trsp-memory-density` in `data-types/routing/index.js`.
  - Body: `{ conflation_view_id, ogc_fid (the closed segment), num_candidates (default 20),
    cost_objective ("distance"|"time") }`.
  - Response: `{ ok, result: { edgeFrequencies: [{ogc_fid, highway, count, geometry}], maxCount,
    totalPairsComputed, totalPairsFailed } }`.
- **New function in `data-types/routing/memoryGraph.js`**, e.g. `computeClosureDensity(graph,
  ogcFid, numCandidates, costObjective)`:
  1. Resolve the closed segment's two endpoint nodes (reuse the existing ogc_fid→edge-index
     lookup already used by `findRoute`'s exclusion logic).
  2. **BFS candidate generation** (new helper, e.g. `bfsCandidateNodes(graph, startNodeIdx,
     excludeEdgeIdx, count)`): walk the graph's own adjacency lists (already in memory - no SQL)
     outward from each endpoint, excluding the closed segment/edge itself, collecting up to
     `count` distinct nodes. Needs a real diversity strategy, not just "first N visited" (which
     could all cluster on one branch) - e.g. breadth-first level-by-level, taking nodes spread
     across different branches/directions before going deeper on any one.
  3. For all start x end combinations (<= `num_candidates`^2), run the existing
     `dijkstraEdgeExpansion` (or `bidirectionalDijkstra` for the longer pairs - reuse whichever
     the single-trip mode already validated), each with the closed segment's edge (and its
     reverse) excluded via the existing `excludedEdgeSet` parameter.
  4. Tally a `Map<edgeIndex, count>` across every edge in every successful route's path.
  5. Resolve geometry only for the edges that appeared at least once (reuse the existing small
     `ogc_fid = ANY($1)` geometry lookup pattern from `findRoute`).
  6. Return the aggregated result plus `totalPairsFailed`.

### Frontend (new)

- **Mode switch**: a `toggle` control in `internalPanel.jsx` (the Legend panel - consistent with
  where the earlier "show all routes" switch idea landed), backed by
  `state.symbology.pluginData.detour.mode` ("single" | "density", default "single"). `comp.jsx`
  reads it and branches.
- **Segment picking is shared, unchanged** - the existing `useEdgeLayer` selection flow (click a
  segment, hover-tolerance picking, same-road highlight) is reused as-is in density mode; only
  what happens AFTER selection differs.
- **New button**: "Analyze coverage" (density mode) instead of "Get detour" (single mode) -
  triggers the new backend call instead of `getRoute`.
- **New hook** `hooks/resolveClosureDensity.js` - fetch boundary for the new route, mirroring
  `resolveTrspRoute.js`'s pattern.
- **New hook** `hooks/useClosureDensityLayer.js` - renders the heatmap: a line layer whose
  `line-color` is a data-driven expression (MapLibre `interpolate`/`step`) keyed on each feature's
  `count` property, normalized against `maxCount`. Uses a proper **sequential color ramp** (one
  hue, light-to-dark - per the `dataviz` skill's convention, not a rainbow) rather than an
  arbitrary gradient. Reuses `runWhenStyleReady` (the same map-load race fix already applied
  elsewhere in this plugin).
- **New panel component** `components/ClosureDensityPanel.jsx` (or a conditional section inside
  the existing panel) - shows "Analyzed N of 400 possible routes (X had no route)", a small color-
  ramp legend, and stays out of the way of the existing single-trip panel content when not in
  density mode.

### Backend built and live-tested - 2026-08-20

Built `computeClosureDensity`/`bfsCandidateNodes` in `memoryGraph.js` and `POST
/trsp-memory-density` in `index.js`. Tested standalone (not just "compiles") against a real
segment (`ogc_fid = 6705113`, the standard test area near Albany):

- **20x20 (400 pairs): 35,475 ms** - exceeds the server's 30s default request timeout. Rejected.
- **10x10 (100 pairs): 7,900 ms** - safely under the timeout. `totalPairsFailed: 0`,
  `maxCount: 60`, `edgeFrequencies.length: 67`.

User's explicit call when offered "optimize the algorithm (multi-target search)" vs. "reduce
candidate count" vs. "scope a longer timeout": **"can't we just run all parallel?"** - explained
that `Promise.all`/`allSettled` don't give real concurrency for CPU-bound synchronous work on
Node's single thread (unlike I/O-bound calls); true parallelism needs `worker_threads`, a bigger
lift. User then chose the simple path: **"yeah keep 10-10 for now."** Both defaults
(`data-types/routing/index.js`'s `num_candidates || 10`, `memoryGraph.js`'s `numCandidates = 10`)
changed from 20 to 10 accordingly. Multi-target-search optimization and worker-thread parallelism
remain real future options if 10x10 ever proves insufficient, not pursued now.

### Not yet decided / to resolve during implementation

- Color ramp specifics (exact hex steps) - to be picked and validated with the `dataviz` skill's
  palette validator before shipping, not eyeballed.

### Testing checklist (once built)

- [x] Real run against a real closed segment - confirm candidate BFS actually spreads across
  multiple branches near a real intersection, not just one road. (0 failed pairs out of 100,
  suggesting good reachability from BFS-selected candidates on both sides.)
- [x] Confirm the reported `totalPairsFailed` count is accurate - 0/100 in the real test.
- [ ] Confirm the heatmap coloring is genuinely proportional to `count`, not just "some edges
  darker" - check the actual min/max range against a few real edge counts.
- [ ] Confirm mode switching (single ↔ density) doesn't leave stale layers from the other mode
  visible on the map.
- [x] Measure real timing - 7.9s for 10x10/100 pairs (cold graph load excluded, that's a one-time
  ~80s server-boot cost already accounted for elsewhere).

### Frontend - IN PROGRESS (2026-08-20)

Starting with the mode switch in `internalPanel.jsx` (Legend panel, below "Display default
legend" per the user's screenshot), then `comp.jsx` branching, then the new hooks/panel.

### Live bugs found and fixed - 2026-08-21

Three real bugs surfaced testing the built density mode against a live segment (analyzed via a
screenshot, not assumed from "it compiles"):

- **Count labels weren't showing at all.** The label symbol layer had no `text-font` set - this
  style's glyph stack only resolves specific font names (confirmed by
  `../routing/hooks/usePointPicker.js` already using `["Open Sans Bold", "Arial Unicode MS Bold"]`
  successfully), and without a matching font MapLibre silently renders nothing. A second,
  compounding bug: the label layer was only ever created inside the "source doesn't exist yet"
  branch, so a second analysis run (or a dev-server hot-reload that kept the map instance alive
  across an edit) would skip straight to the `setData`-only branch and never add it. Fixed:
  explicit font, `text-allow-overlap`/`text-ignore-placement` set true (every analyzed segment
  should show its count, not just whichever survive MapLibre's collision pass), and each
  source/layer now ensured independently rather than gated behind one existence check.
- **Color range read as "not good."** Switched from a 5-bucket `step` expression to a continuous
  `interpolate` across the same validated sequential ramp, and added `line-width` as a second,
  data-driven encoding (not just color) - the palest ramp step was reading as near-invisible
  against the dark basemap on its own.
- **The grey pickable network wasn't disappearing after "Analyze coverage."** Root cause: a real
  race in `useEdgeLayer.js`'s `refreshEdges` - it only checked `isActive` *before* its `await`. If
  a fetch was still in flight when the user pressed "Analyze coverage" (which flips `isActive`
  false and removes the network layer), the stale fetch would resolve afterward and
  unconditionally re-add it, undoing the removal. Fixed with an `isActiveRef` re-checked after the
  fetch resolves and again after the style-ready wait - this fix is IN PLACE and correct.

### Two-directions-visible line rendering - explored, reverted, deferred as its own task (2026-08-21)

Separate from the three bugs above: user noticed the grey pickable network (and, by extension, the
density heatmap) only ever shows ONE line for a two-way road, even though the underlying data has
two directed edge rows (`osm_fwd` 0/1, swapped `from_node`/`to_node`). Root cause confirmed: the
two directional rows share the *exact same* line geometry (direction is a topology attribute, not
a separately-drawn polyline), so two overlapping features render as what looks like a single line.
**Confirmed this is a real, established expectation** - the data source's own default "Map" view
(`devtny.org/datasources/source/2125/map/3702`) already renders two-way roads as two distinct
lines (visually confirmed on Manning Boulevard).

Built a `withDirectionalOffsets` helper (groups edge features by undirected node pair, assigns a
small opposite `line-offset` per direction, `0` for a genuine one-way road) and wired it into the
grey pickable network, its selection/hover highlights, AND the density heatmap (which needed
`from_node`/`to_node` added to the backend's `edgeFrequencies` response to support it). Iterated
once on offset/width size per feedback ("make width small").

**Reverted in full per explicit instruction ("keep this as a task and revert all... this 2
direction geom mapping change")** - not abandoned, deferred pending root-cause confirmation.

**Root cause confirmed against the real database, then re-implemented - 2026-08-21.** Queried
`temp.osm_conflation_1_2024_edges` directly (`neptune.availabs.org:5758/npmrds2`, reachable from
this dev environment) rather than continuing to guess. Real schema: `osm` (the physical way id,
NOT `osm_fwd`) and a `reversed` boolean - a bidirectional road is two rows sharing the same `osm`
id, one `reversed=true` with its coordinates in the opposite order. Example (`osm = 5563799`):

```
ogc_fid 221  reversed=f  LINESTRING(A -> B)
ogc_fid 224  reversed=t  LINESTRING(B -> A)   -- same road, opposite direction
```

Confirmed the reversed coordinate order alone does NOT change the rendered path - a plain MapLibre
line layer draws the same visual shape regardless of array start point (order only matters for
direction-sensitive symbols like arrows). So the two-line look in the data source's own default
"Map" view (`devtny.org/datasources/source/2125/map/3702`, visually confirmed on Manning
Boulevard) must come from that view's own symbology doing something extra - still not inspected
directly (no CLI credentials configured for `devtny.org` in this dev environment) - not from the
data itself carrying two distinct paths.

**First re-implementation attempt (`withDirectionalOffsets` grouping by `osm`/`reversed`) was
unnecessary - superseded below.** Built it, wired it into all three layers, syntax-checked it -
but the user then pointed at the ACTUAL view 3699 (not 3702) live in the browser and asked "are we
using 3702 or 3699?" This prompted checking view 3699's own real symbology directly instead of
continuing to assume:

```sql
SELECT metadata->'tiles'->'layers' FROM data_manager.views WHERE view_id = 3699;
-- [{"id": "2125_v3699_polygons", "type": "line", "paint": {"line-offset": 1.25}, ...}]
```

**The real mechanism: a flat, non-data-driven `"line-offset": 1.25` constant** - no filter, no
per-feature expression, no `reversed`/direction logic at all. This works because MapLibre's
`line-offset` is defined RELATIVE TO EACH FEATURE'S OWN VERTEX DIRECTION, not a fixed compass
side - see MapLibre style spec ("a positive value offsets the line to the right, relative to the
direction of travel of the line"). Since a bidirectional road's two rows store their coordinates
in opposite order (confirmed above: `reversed=false` is A->B, `reversed=true` is B->A), applying
the IDENTICAL flat value to both automatically pushes them to opposite physical sides. A one-way
road (only one row, no counterpart) just gets a small constant nudge, indistinguishable from
centered. **No grouping, no `osm`/`reversed` columns needed anywhere** - this is what makes the
fix so much simpler than the two prior attempts.

**Final implementation** - `directionalOffset.js` deleted, all `osm`/`reversed` backend additions
(`data-types/routing/index.js`'s `getEdgesInBbox`, `data-types/routing/memoryGraph.js`'s
`computeClosureDensity`) reverted back to their original queries. Just a flat
`"line-offset": 1.25` added to the paint of: the grey pickable network (`EDGES_LAYER_ID`), its
selection/hover highlights (`SELECTED_SEGMENT_LAYER_ID`/`HOVER_SEGMENT_LAYER_ID`), and the density
heatmap (`DENSITY_LAYER_ID`) - matching view 3699's own real value exactly. No backend restart
needed this time (no query changes survived into the final version).

**Not yet live-verified** - built and compiles, needs a real browser check that both directions of
a known bidirectional road (e.g. `osm = 5563799` from the schema check above) now render as two
visible parallel lines in both the pickable network and the density heatmap, and that a genuine
one-way road still renders as a single, near-centered line.

## Candidate point picking - PROPOSED, NOT STARTED (2026-08-21) - a real redesign, important

User flagged that the current candidate-picking logic (`bfsCandidateNodes` - pure hop-count BFS
outward from the segment's two endpoints, undirected, nearest-first, no relationship to whether the
segment was actually relevant to that trip) doesn't match what this feature is supposed to measure.
User's own framing, preserved close to verbatim since precision matters here:

> let's think like its Origin destination locations and one selected segment is not working... we
> are more focusing the same road of the selected segment... and then will go farthest ways may be
> on that road or some other nearby road... the purpose of this is to understand how this segment
> was important before so want those stats of those also... but sometimes what happens is for some
> start and end point that segment is not coming on the route/trip - in that case remove both start
> and end points and go to find the points where it's coming from either start or end... we are
> going to take the 10-10 here but will expand... first pick points mostly on the same road both
> side and then understand the route and if for those 100 routes any route is there where that
> segment is not coming in the trip/route then remove those points and find another points that fit
> our test case, it might be longer than previous but it's not an issue.

**Reframing, in my own words, to confirm the intent before building:** the candidates aren't just
"nearby points" - they're meant to represent **real origin/destination pairs whose ACTUAL (pre-
closure) trip genuinely passed through this segment.** A pair only counts as valid for the density
tally if the segment was really part of that trip when the road was still open. This is a
fundamentally different validation step than what's built today - today's `computeClosureDensity`
never checks whether the OPEN route between a candidate pair used the segment at all; it just
excludes the segment and tallies whatever detour comes out, for every BFS-nearest pair regardless
of relevance.

### Validation rule - CONFIRMED with the user (2026-08-21)

Resolved the one open ambiguity from the first draft (point-level vs. pair-level invalidation) by
asking directly. User's answer, verbatim: "pick one point let say its a start point and check with
all end point and see if this segment the selected one is coming in actual route or not so if this
happen with >50% then remove that point and pick another one."

**So validation is PER-POINT, against the WHOLE opposite set, majority-rule** - not per-pairing:

- For a candidate start point `S`, compute the OPEN (no exclusion) route from `S` to EVERY current
  end candidate (all 10, or however many exist at that moment) and check whether the closed
  segment appears in each of those routes.
- If the segment fails to appear in **more than 50%** of those pairings (i.e. it was NOT a real
  detour-relevant point for the majority of its potential trips), `S` is unrepresentative -
  discard it and pick a replacement (same-road-first, farther out if needed).
- Same rule applies symmetrically to end candidates against the whole start set.
- This is inherently iterative: replacing a point changes what every point on the OTHER side is
  being validated against, so the check needs to re-run until every remaining point in both sets
  clears the >50% bar (or a fault-tolerance search-attempt cap is hit - see below).

### Proposed algorithm (updated with the confirmed rule)

1. **Candidate generation, real distance not hop count - BUILT 2026-08-21.** First attempt used
   BFS hop-count (same-road-preferring, but still hop-based) - live-tested and rejected: in a dense
   area, 10 hops covers almost no real distance, so all 10 candidates landed within a few hundred
   meters of the segment (visually confirmed - a tight cluster right on top of the closure).
   User: "it's not like nearby points... the radius can be of 5-20 miles, i want that much
   coverage." Replaced entirely with `distanceCandidateNodes` - a real single-source Dijkstra by
   network distance (meters, undirected, excluding the closed segment), matched against 10 target
   distances evenly spaced, nearest to farthest (`candidateTargetDistancesM`), with same-`highway`
   continuation as a tie-breaker only (not the primary criterion anymore - real distance is).
   `bfsCandidateNodes` deleted (no longer used anywhere). Range narrowed same day per follow-up
   ("make it max 7-10 miles... start form nearest to farthest") to **1-10 miles** - the exact max
   was ambiguous between 7 and 10 in the user's wording, went with 10 as the cap, flagged for
   confirmation.
2. **Initial pool**: 10 start candidates, 10 end candidates, generated as above.
3. **Iterative per-point majority validation** (see confirmed rule above):
   - For each start candidate, compute open routes to all current end candidates; tally the
     pass/fail (segment-appears-or-not) rate. Any start point failing on >50% of its pairings is
     replaced.
   - Same for end candidates against all start candidates.
   - Repeat until a full pass finds nothing left to replace, or the search-attempt cap (below) is
     hit.
4. **Record open-route stats per surviving pair** - the user explicitly wants "those stats of
   those also," i.e. a before/after (open vs. closed) comparison per pair, not just the closed-
   network tally. These open routes are already being computed during validation (step 3) - reuse
   them rather than recomputing.
5. **Then compute the CLOSED (excluded) route for every surviving pair** and tally edge frequency,
   same as today's `computeClosureDensity` - just over the now-validated 10x10 grid instead of the
   raw BFS grid.
6. Target count stays 10x10 = 100 pairs for now ("we are going to take the 10-10 here but will
   expand" - room to raise later, see performance note below).

### Not yet decided / to resolve during implementation

- **Performance - the real open question now.** Step 3 alone is up to 10x10 = 100 OPEN route
  computations just for the FIRST validation pass, before any replacement/re-validation cycles or
  the existing 100 CLOSED route computations even start. A single replacement can require
  re-validating against the whole opposite set again. Given the current (no-validation) 10x10 pass
  already measured ~7.9s, this could multiply total request time well past the 30s timeout that
  already ruled out 20x20 once in this task. **Must be measured for real once built.**
  - User asked (2026-08-21) to "keep this process faster, maybe run all routing in parallel" -
    same answer as the earlier perf discussion in this task applies again: `Promise.all`/
    `allSettled` around `dijkstraEdgeExpansion` calls does NOT give real concurrency, since that
    function is synchronous CPU-bound work on Node's single main thread - wrapping it in promises
    only changes scheduling order, not actual parallelism. The only way to genuinely run these
    searches in parallel is **`worker_threads`** (real OS threads) - technically feasible since
    the graph is typed arrays (shareable via `SharedArrayBuffer`), previously scoped as "a bigger
    lift, not attempted" when 10x10 alone was fast enough without it. With this validation step
    adding real additional load on top of the existing 100 searches, worker_threads is now the
    more relevant option to actually pursue if the measured time is too slow, rather than
    reducing candidate count further (this feature's whole point depends on having enough
    candidates) or a `Promise.all` illusion that wouldn't help at all.
- **Search-attempt cap** - "might be longer than previous but it's not an issue" confirms search
  DISTANCE isn't a constraint, but an implementation still needs a hard cap on replacement attempts
  per point (a fault-tolerance backstop only, not a design goal) so a point with no valid same-road
  or nearby-road candidate anywhere doesn't hang the request. Report a count of "gave up finding a
  replacement for N points" rather than silently truncating.
- ~~Exact `highway`-type matching / same-road continuation search radius reuse from
  `findSameRoadNode.js`~~ - superseded: candidate generation is now real-distance-based
  (`distanceCandidateNodes`), with same-`highway` used only as a tie-breaker between otherwise
  equally-good candidates, not the primary search strategy. User separately flagged that a plain
  `highway`-label match "isn't really the same direction of the selected segment" (e.g. two
  unrelated residential streets sharing the label) - `findSameRoadNode.js`'s bearing-based
  continuation check would be the more correct tie-breaker, not yet swapped in (still using the
  plain label-equality tie-break for now, since real distance is doing the main work and this is a
  secondary refinement).

### Superseded same day: fixed evenly-spaced target distances - REJECTED

First distance-based implementation picked 10 candidates matched to evenly-spaced target
distances (1-10mi) via `candidateTargetDistancesM`/`distanceCandidateNodes`, with per-slot
replacement on validation failure. User rejected the "evenly spaced, fixed count" framing outright:
"it's not like evenly you can pick max 6 or 4 or anything it's like we want the best points to
understand the value of the segment" - followed by the real priority ordering: **"it's not like
for distance it's for the OD pairs, the valuable pairs - i want a bit distance so that i can
understand the affect of that segment."** Validity (does the OD pair actually use the segment) is
the PRIMARY filter; distance is only the search order plus a soft outer cap, not a target to hit
or a fixed count to fill. Both `candidateTargetDistancesM` and `distanceCandidateNodes` (and their
slot-replacement logic) were deleted in favor of the simpler design below.

### Built - 2026-08-21 (point-selection logic; performance/worker_threads NOT done, on purpose)

Implemented in `data-types/routing/memoryGraph.js`:
- `MAX_CANDIDATE_DISTANCE_M` (10 miles) - an outer cap on the search, not a target.
- `dijkstraReachableNodes(graph, startNodeIdx, excludedEdgeSet, preVisited, maxDistanceM,
  edgeFilter)` - single-source Dijkstra by real network distance (not hop count), returns EVERY
  reachable node within the cap, sorted nearest to farthest. `edgeFilter` (optional) hard-blocks
  traversal through edges that fail it - the mechanism the same-road-first search below uses.
- `nearestToFarthestNodes(graph, startNodeIdx, excludedEdgeSet, preVisited, maxDistanceM,
  preferredHighway)` - same-road-first search (SEE FIX BELOW), replaces the deleted
  `bfsCandidateNodes` AND `distanceCandidateNodes` entirely.
- `computeClosureDensity` rewritten to walk `startPool`/`endPool` (from `nearestToFarthestNodes`)
  nearest to farthest, greedily ACCEPTING a candidate only if its open route to a MAJORITY of
  whatever's already accepted on the OTHER side passes through the closed segment (bootstraps
  with the very first point on each side accepted unconditionally, since there's nothing yet to
  validate against). A rejected candidate is simply skipped, not replaced - the walk just
  continues outward. Stops at `numCandidates` (10) accepted per side, or when a pool is exhausted
  within the 10mi cap - so the final count can genuinely be less than 10 per side ("max 6 or 4 or
  anything") if that's all the network offers valid pairs for. `candidatesRejected` is a new
  diagnostic field - how many candidates were walked past and rejected for failing the majority
  check. Final tally (closed-route edge frequency) runs over the accepted set, same as before.

### Fix same day: same-road-first dropped, then restored properly

The first `nearestToFarthestNodes` had NO road preference at all - the earlier `preferredHighway`
logic got dropped during the distance-spread rewrite above (a real regression, not an intentional
re-design). Live-tested and caught by the user: "you pick some out of another road too... those
points are invalid... that is why i told you on same road." Confirmed the fallback IS still
wanted, just not as the default: "sometimes it happens on a small road that we can pick from all
directions, that can happen" - a short/dead-end road legitimately needing the fallback is
expected, not an error.

**Fixed as a genuine two-phase search, not a soft tie-break:**
1. Phase 1: `dijkstraReachableNodes` with `edgeFilter = (e) => graph.edgeHighway[e] ===
   closedHighway` - the traversal is HARD-BLOCKED from ever stepping onto a different highway
   type, so it can't wander off the same road while that road still has reach.
2. Phase 2 (fallback): only runs to fill in nodes phase 1 didn't reach - a full unrestricted
   search, minus nodes phase 1 already found.
3. Same-road nodes always sort ahead of fallback nodes in the returned list, regardless of raw
   distance - matches "first pick points mostly on the same road... and then farthest ways... on
   that road OR some other nearby road."

**Known remaining gap, not yet fixed:** this still matches by `highway` LABEL equality
(`"residential" === "residential"`), not true bearing-based "continues in the same direction" -
two unrelated residential streets sharing the label could still pass phase 1's filter. The correct
fix (flagged earlier in this task, still not built) is swapping in `findSameRoadNode.js`'s
bearing-based continuation check instead of a label match - deferred again, asked the user
whether this round's label-match is good enough or whether to fix it now too.

**Backend restart required** to pick this up (query/graph-loading module, not hot-reloaded).
**Not yet live-verified** - needs a real "Analyze coverage" run to confirm: candidates land at a
real, non-trivial distance (not clustered right on the closure) while still being genuinely valid
OD pairs and genuinely on the same road first, and that the accepted counts per side make sense
for a real closure (not routinely collapsing to near-zero, which would suggest the >50% bar is too
strict for typical grid topology).
**Performance not yet measured** - the majority check for a candidate against a growing opposite
set of up to 10 is still up to ~100 open-route searches worst case, on top of the existing 100
closed-route searches; explicitly deferred per the user's own scoping ("keep this now just the
logic is important") - `worker_threads` remains the real option to pursue next if measured time is
too slow, not a `Promise.all` illusion (see the performance note above).

### Split into two API calls + two real perf fixes - 2026-08-21

User: "it's taking a lot of time now" (confirming the performance risk flagged above was real,
not hypothetical) + "can you make 2 api call here first to get points and then route the segment
dense thing?" Addressed with a genuine API split plus two real fixes, not just a deferral:

1. **API split** - `computeClosureDensity` split into `selectClosureDensityCandidates` (point
   selection only, sync) and `computeClosureDensityFromPoints` (route tallying only, given
   already-selected points). Backend routes: new `POST .../trsp-memory-density-points` (step 1,
   returns `{startPoints, endPoints, candidatesRejected}` with `osm_id` per point) and the
   existing `POST .../trsp-memory-density` (step 2) now takes `start_node_ids`/`end_node_ids`
   (osm ids from step 1) instead of deriving its own points - resolved back to internal graph
   indices via `graph.nodeIdToIndex`. `closureContext()` factors out the shared
   edgeIdx/reverseIdx/excludedEdgeSet/costArray/routeUsesClosedSegment setup both steps need.
   Frontend (`resolveClosureDensity.js`, `useClosureDensity.js`) chains the two calls
   automatically - candidate markers can render as soon as step 1 resolves, before the slower
   step 2 tally finishes; `density` state builds up progressively (`{startPoints,endPoints,...}`
   after step 1, `{...,edgeFrequencies,maxCount,...}` after step 2) so no downstream consumer
   (`useDensityCandidatesLayer`, `useClosureDensityLayer`, `ClosureDensityPanel`) needed changes.
2. **Real perf fix #1 - lazy fallback.** `nearestToFarthestNodes` previously ran BOTH the same-
   road phase AND the expensive unrestricted fallback phase unconditionally on every call, even
   when the same road alone already had plenty of reach. Added a `minCount` param (called with
   `numCandidates * 2`) - the fallback search only runs if the same-road phase falls short of it.
3. **Real perf fix #2 - smaller radius.** `MAX_CANDIDATE_DISTANCE_M` narrowed from 10mi to a flat
   **5mi cap** per direct follow-up ("keep max range or radius of 5 miles") - a smaller radius
   means far fewer nodes for every Dijkstra pass (4 of them: same-road + fallback, per side) to
   settle before returning.

**Backend restart required.** **Not yet live-verified** - needs a real timing comparison against
the pre-split numbers (35.5s@20x20 rejected, 7.9s@10x10 pre-validation) to see whether the split +
lazy fallback + 5mi cap actually brought this back into a comfortable range, and whether step 1
alone is now fast enough that showing candidate points immediately feels responsive even if step 2
is still slow.

### Real perf fix #3 same day - the actual root cause of "minutes, not ms"

User tried it live: "taking a lot of time to find the points... need in ms but taking in mins."
The three fixes above (API split, lazy fallback, 5mi cap) all helped but missed the actual root
cause: **the validation loop ran over the ENTIRE raw same-road pool**, not a bounded sample. A
long, continuous same-highway-type road within the 5mi cap can have hundreds of intersections -
every single one was getting up to 3 full open-route searches (`getOpenRoute`, a genuine
edge-expansion Dijkstra, not distance-capped) before validation even got to decide whether to
keep it. Validation cost was scaling with however large the same-road network happened to be, not
with `numCandidates`.

**Fixed**: `spreadSelect` (previously only used for the FINAL selection) now also caps the RAW
pool to `numCandidates * 4` (40) via the same evenly-spaced-by-index sampling, BEFORE validation
runs at all. Validation cost is now bounded to a small, predictable multiple of `numCandidates`
regardless of how long the same road stretches - matches the original intent (spread across near/
mid/far) while keeping the search space small enough to actually finish in a reasonable time.

**Backend restart required.** **Still not live-verified with real timing** - this is now the
fourth attempt at getting step 1's timing into a reasonable range; needs an actual measured number
this time, not another assumption that it's fixed.

### Live-tested with real data - collapsed to 3 valid points per side, then fixed - 2026-08-21

First real "Analyze coverage" run (after all perf fixes above) came back with only **9 of 100
possible routes analyzed** (3 valid start x 3 valid end) - the fixed `CANDIDATE_POOL_CAP =
numCandidates*4` (40) batch was validated ONCE and never expanded further, so whatever fraction
passed the >50% bar in that one batch was final. This is a REAL, expected consequence of the
validation rule in dense grid topology - most OD pairs within a 5mi radius genuinely have
alternate routes that don't need this one local segment - not a bug in the rule itself. Also
surfaced a related real issue in the picked-pair testing feature: a validated-but-very-close pair
produced a 0.8mi/72-edge route that loops all the way around a city block - a legitimate closed-
route result (the only way to avoid the segment from that pair really is that loop), but a weak
"value of the segment" data point.

User's call, offered three options (loosen the bar / keep it and accept fewer points / something
else): **"no i mean if <50% then skip that point but you have to pick the 10 point both side
anyway... expands more if not match i want 10-10 at any how."** Keep the >50% rejection rule
exactly as-is; the search must keep walking the pool until it finds 10 valid points per side (or
genuinely exhausts the whole 5mi pool trying).

**Fixed**: replaced the one-shot capped-then-validate approach with `validateUntilEnough` -
validates the raw pool in `BATCH_SIZE` (`numCandidates*4`) chunks, only pulling the NEXT batch if
still short of `numCandidates` valid points, stopping as soon as enough are found (so the common
case - the first batch already has enough - stays exactly as cheap as before) or the raw pool
(everything within 5mi) is exhausted. `candidatesRejected` now counts across all batches actually
tried, not just the first one.

**Not yet addressed / flagged for later:** the "unnaturally long loop route for a too-close pair"
issue from the live test - not yet decided whether pairs that are geometrically very close to the
segment (needing an implausible detour to avoid it) should be excluded from candidate selection
entirely, or whether that's legitimately part of "understanding the value of the segment" (a
segment whose only alternative is a long loop is arguably MORE valuable, not a bad data point).
Not raised as a problem by the user yet - noted here so it isn't lost if it comes up again.

**Backend restart required.** **Not yet re-tested live** with the batch-expansion fix - need to
confirm a real closure now reaches something closer to 10x10 (or a real, informative reason why it
still can't, reported via `candidatesRejected` and the final accepted counts).

### Live-tested again - batch-expansion re-clustered everything, fixed by reversing walk direction

The batch-expansion fix above (`validateUntilEnough`) immediately regressed back to the exact
class of bug the seed+spreadSelect design was originally built to fix: it stops as soon as it
accumulates `numCandidates` valid points, and points near the closure reliably pass validation, so
walking the pool NEAREST-first refilled the target from the near end before ever reaching farther
out. Live-tested, user: "woahhhhhhh no, why this close? i told you to start from the max and pick
the closer ones." Confirmed the rest of the design ("the logic and thing was good") - just the
walk direction was wrong.

**Fixed**: `nearestToFarthestNodes` renamed to `farthestToNearestNodes` and reversed (each group -
same-road, then fallback - reversed internally, same-road group still tried first). **Real bug
caught while making this change**: the seed/bootstrap reference set was `pool.slice(0,
SEED_COUNT)` - correct when the pool was nearest-first (seed = nearest, reliable), but now would
have silently seeded with the FARTHEST (least reliable) points instead. Fixed by always pulling
the seed from the near end (`pool.slice(pool.length - SEED_COUNT)`) regardless of which direction
the main walk goes, with a separate `restStart`/`restEnd` (the pool minus that near-end seed) for
`validateUntilEnough` to walk farthest-first over.

**Also confirmed, not new work - just reaffirmed by the user mid-fix:**
- "it's not like 100-100 thing, it's like again a great points so that we can understand the
  detour for segment" - quality over hitting the exact count is already how `validateUntilEnough`
  works: it stops once enough VALID points are found, or gives up with fewer if the pool
  genuinely runs out - never pads with weak points just to reach 10.
- "farthest is depend on the road things... it's not kind of fixed length for the farthest, but
  the algorithm must be dynamic" - `MAX_CANDIDATE_DISTANCE_M` (5mi) is already only an outer CAP,
  not a target - `farthestToNearestNodes` returns whatever the actual network offers up to that
  cap (could be 3mi if a road dead-ends there), never artificially reaching for the cap itself.

**Backend restart required.** **Not yet re-tested live** with the farthest-first + seed fix -
this is the fifth live iteration on point selection; needs an actual screenshot/measurement this
time confirming candidates spread from far to near (not clustered), with the seed still anchored
near the closure as the validation reference.

### Rewritten as ONE search, not two - 2026-08-21 (sixth iteration)

User asked to revert the last few edits and re-described the intended shape from scratch, more
precisely: "need to expand from the broken segment only but need to go further in directional
more priority and then if end then expand on both side of roads... a general algorithm." The
same-road-then-fallback design (two separate Dijkstra passes, concatenated) had been accumulating
real bugs at the seam between the two passes across several live-test rounds - time to replace it
with something structurally simpler instead of patching further.

**Rewritten**: `farthestToNearestNodes` is now ONE unrestricted Dijkstra per side (no highway
filter on the traversal itself, so it can never get stuck at a "same road" dead end the way the
hard-filtered pass could) that also records, per node, WHICH edge reached it. Same-road priority
is applied only when building the final candidate list: nodes reached via an edge matching the
closed segment's own `highway` type are surfaced first (farthest-first within that group), then
everything else (also farthest-first) - directly matching "go further in directional priority,
then if that ends, expand on both sides," implemented as a single continuous search rather than
two disjoint ones stitched together. `dijkstraReachableNodes` (the old two-pass primitive) and the
`minCount` lazy-fallback param are both gone - no longer needed now that there's only one search
to run per side instead of up to two.

**Backend restart required.** **Not yet live-verified** - sixth iteration on point selection;
needs a real screenshot confirming: candidates prioritize the same road first, still spread far-
to-near, and don't regress on the "grey network taking minutes" perf concern now that same-road
hard-filtering (the thing `minCount` was protecting) is gone - a single unrestricted 5mi Dijkstra
per side should still be cheap on its own; the earlier slowness was from validating too many
candidates, not from running the search itself, so this should be fine, but should be confirmed
with a real number, not assumed.

### Live-tested, root-caused "Failed to fetch" - real timing measured, real fix applied

First real run of the unified single-search design came back with a hard number:

```
startPoints: 10, endPoints: 10, candidatesRejected: 95, searchMs: 35345
```

35.3s - PAST this server's 30s default request timeout (the same limit that rejected 20x20 for
the heatmap itself, earlier in this task). The connection gets killed before the response can be
sent, so the frontend never receives a valid reply - `useClosureDensity.js`'s fetch throws "Failed
to fetch," exactly what the user saw live, and the chain to step 2 never starts.

**Root cause, precisely**: walking farthest-first means most candidates tried are far-out points
that genuinely don't route through this local segment (confirmed earlier - real, expected grid
topology behavior) - `candidatesRejected: 95` means ~105 candidates had to be tried to find 20
valid ones, each needing up to 3 open-route searches (`SEED_COUNT`) to validate. Up to ~315 route
searches at the ~80ms/search rate measured much earlier in this task lines up almost exactly with
the observed 35s.

**Fixed**: `getOpenRoute` (the validation-only route lookup) switched from `dijkstraEdgeExpansion`
to `bidirectionalDijkstra` - same exact correctness (both are exact edge-expansion Dijkstra, no
heuristic), already used elsewhere in this file for long routes, explores roughly two half-radius
circles instead of one full-radius circle. User's choice among three offered options (fewer
validation checks per candidate / faster search / cap total attempts) - picked "faster route
search (bidirectional)," so the validation THOROUGHNESS (3 checks per candidate, no attempt cap)
is unchanged, only the per-search cost drops.

**Backend restart required.** **Not yet re-measured** - needs the actual new `searchMs` number,
not an assumption that bidirectional search alone closes a 5s-over-budget gap. If still too slow
after this, the two declined options (fewer checks per candidate, or a hard attempt cap) are the
next real levers, not `Promise.all`/worker_threads (unrelated to this specific bottleneck - the
cost here is NUMBER of searches needed, not lack of parallelism).

### Bidirectional alone wasn't enough - applied both remaining levers

User: "still a lot of time" (no new number given, but the direction was clear enough to act on
the two previously-declined levers together rather than wait for another measurement round):

1. `SEED_COUNT` reduced from 3 to 1 - each candidate now costs exactly 1 open-route search to
   validate, not up to 3.
2. `MAX_ATTEMPTS` (new, `numCandidates * 4` = 40 per side) - a hard cap on total candidates tried
   per side, real trade-off against "10-10 at any how": walking farthest-first means most
   attempts are far-out points that don't route through this local segment, so without a bound
   the search can burn through nearly the entire pool (measured: 105 attempts for 20 valid). Caps
   worst case at `MAX_ATTEMPTS * 2` (80) open-route searches total per request, accepting fewer
   than `numCandidates` valid points if the budget runs out rather than the request failing past
   the 30s server timeout with nothing at all - bounded-but-possibly-fewer over unbounded-but-
   often-failing.

**Backend restart required.** **Not yet re-measured** - needs the actual new `searchMs` and final
accepted counts (may legitimately be less than 10 per side now, on closures where genuinely
segment-dependent points are sparse - that's the MAX_ATTEMPTS trade-off working as intended, not
a bug).

### Farthest-first overcorrected into a bimodal near+far split - fixed by reversing again, properly

User: "first ones are good but another one[s] are too far... try [first] on the same road, it not
expand but go a bit by bit slow, i mean take .5 miles then 1 mile and etc... it can be varied, not
like one point is near and all are 4 miles." Root cause: farthest-first walking, COMBINED with the
stop-as-soon-as-target-reached logic, meant the walk grabbed the near-end seed (1 point) then
jumped straight to validating far-out candidates near the 4mi cap - since those either passed or
got skipped, there was nothing in between. Stopping early at the target was the actual bug both
times (this time AND the original "why this close" complaint) - the walk DIRECTION alone was
never the real fix.

**Fixed properly this time:**
- `farthestToNearestNodes` gained a `farthestFirst` param (default `true`, called with `false`
  here) - controls walk direction without duplicating the function.
- Walk direction is nearest-first again for point selection (`farthestFirst: false`).
- **The real fix**: validation no longer stops once `numCandidates` valid points are found. It
  validates the ENTIRE `MAX_ATTEMPTS` budget every time, collecting every point that passes
  regardless of how many that ends up being, THEN uses `spreadSelect` (evenly-spaced-by-index) to
  choose the final `numCandidates` from that full validated list - which, since the list stays in
  nearest-to-farthest order, produces genuine gradual coverage (near, then progressively farther)
  instead of clustering at whichever end the walk happened to reach first.
- Seed extraction flipped back to the first few elements (nearest) since the pool is nearest-first
  again; `restStart`/`restEnd` skip that seed head instead of a seed tail.
- Worst-case cost is unchanged (`MAX_ATTEMPTS * 2` = 80 open-route searches per request) - this
  fix changes WHICH candidates get tried and picked, not how many.

**Backend restart required.** **Not yet live-verified** - eighth iteration on point selection;
needs a real screenshot confirming smooth near-to-far coverage (not bimodal, not clustered) within
the same timing budget as the previous (unverified) bidirectional+cap fix.

### Widened again once the direction was confirmed good

User: "the expansion is good dir but expand it more... keep more points and length, like expand
for 5 miles." `MAX_CANDIDATE_DISTANCE_M` moved back to 5mi (was narrowed to 4mi one message
earlier), and `MAX_ATTEMPTS` bumped from `numCandidates*4` to `numCandidates*6` alongside it - a
wider radius without a wider validation budget wouldn't actually get sampled before the attempt
cap kicks in. **Real cost trade-off to watch**: worst case goes from 80 to 120 open-route searches
per request (`MAX_ATTEMPTS*2`) - still bounded, but higher than the last (already unverified)
timing. Needs a real number after this restart, not carried-forward assumptions from the
still-unmeasured previous fix.

**Backend restart required.** **Not yet live-verified.**

### Real minimum-gap enforcement, not just index-spacing - 2026-08-21

Live-tested (screenshot): coverage direction and radius were good, but several picked points on
the same road were bunched within a couple hundred meters of each other - `spreadSelect`'s
evenly-spaced-BY-INDEX approach only approximates real distance spacing, and a validated list
that's locally dense in one stretch can still produce close-together picks even when spaced
evenly by index. User: "expand more... do not take points nearby, take one far apart, like let's
take a barrier of 0.25 to 0.5 miles minimum distance between 2 start and 2 end points."

**Fixed at the source, not just at selection**: `farthestToNearestNodes` now returns `{node,
dist}` pairs instead of bare node indices - `dist` (real network distance from the segment
endpoint) wasn't being tracked before because nothing needed it; enforcing a real-world minimum
gap requires it. `spreadSelect` replaced with `pickWithMinGap(sortedValid, count, minGapM)` -
walks the nearest-to-farthest validated list and only accepts a candidate if it's at least
`MIN_GAP_M` (0.25mi, the lower end of the user's stated 0.25-0.5mi range) past the last accepted
pick's distance, skipping anything closer. All downstream code (`seedStart`/`seedEnd`,
`restStart`/`restEnd`, `validateBudget`, `passesValidation`, `toPoint`) updated to carry `{node,
dist}` objects through instead of bare indices, using `.node` wherever an actual graph index is
needed (route searches, osm id/lon/lat lookup).

**Backend restart required.** **Not yet live-verified** - needs a real screenshot confirming
picks are genuinely ≥0.25mi apart along the same road, not just evenly spaced by list position.

### 10-10 made a hard requirement, gap increased to 0.5mi

Live test with the min-gap fix came back with only 2 valid points per side - the `*6` attempt
budget ran out before finding 10 that also cleared the 0.25mi gap. User: "pick more points...
pick minimum 10-10 each side... or else must be 10, let fix number 10" - count is now a hard
requirement, not a best-effort target. Then: "keep min gap of 0.5 miles" - widened from 0.25mi.

**Fixed:**
- `MAX_ATTEMPTS` widened from `numCandidates*6` to `numCandidates*15` - gives the gap-fallback
  below a much bigger validated pool to pick 10 spaced-out points from.
- `MIN_GAP_M` raised to 0.5mi (was 0.25mi).
- New `pickWithBestEffortGap` - tries the full gap first, and if that can't reach `count`, halves
  the gap and retries (repeating down toward 0) until `count` is reached. Relaxes the GAP, never
  the COUNT - guarantees 10 per side as long as the validated pool has at least 10 points at all,
  preferring the widest spacing that still allows hitting exactly 10.
- Worth noting: 10 points at a strict 0.5mi minimum gap needs at least 5mi of spaced-out valid
  road to fit without any relaxation - right at the edge of the current 5mi radius cap, so the
  gap-relaxation fallback may kick in fairly often on shorter roads. That's expected, not a bug -
  it's exactly the trade the fallback exists for.

**Backend restart required.** **Not yet live-verified.**

### "Failed to fetch" again - radius widened, timeout question still OPEN

Live test with the *15 attempt budget hit "Failed to fetch" again (almost certainly the same 30s
timeout, given the widened search). Offered three options (scope a longer timeout / relax the
hard 10-10 requirement / something else) - user's answer didn't pick one of those directly, and
instead refined the actual requirement further: "each points are like 0.5 to 0.75 miles apart...
there is not miles limit i mean the radius wise but i want 10-10 points."

**Changed**: `MAX_CANDIDATE_DISTANCE_M` widened from 5mi to a flat 20mi - NOT literally unbounded
(an actually-infinite Dijkstra would traverse the whole 5.3M-node graph), but generous headroom
past the ~7mi minimum span 10 points need at up to 0.75mi apart. `MIN_GAP_M` raised to 0.75mi (top
of the stated range) - `pickWithBestEffortGap` only relaxes DOWNWARD from here, so the effective
gap used naturally lands at or under 0.75mi, never above it.

**Still explicitly UNRESOLVED**: this does NOT by itself fix the 30s timeout risk - `MAX_ATTEMPTS`
(the actual validation-cost driver, `numCandidates*15` = 150 per side) is unchanged, and a wider
radius means the pool-generation Dijkstra itself covers more ground too, even though that part
was cheap in earlier measurements. The three-way tension from the last "how should this be
resolved" question - hard 10-10 count + real spacing vs. the 30s default timeout - is still live.
**Next step if "Failed to fetch" recurs**: come back to that unanswered choice (scope a longer
timeout for this route specifically, vs. relaxing the count requirement) rather than continuing to
tune search parameters, since parameter-tuning alone hasn't resolved it across several rounds now.

**Backend restart required.** **Not yet live-verified.**

### Timeout question finally resolved + count halved

User picked the offered option directly this time: "yes - scope a 90s timeout for this route." Also
separately asked to cut the target count from 10 to 5 per side.

**Timeout scoped** in `src/dms/packages/dms-server/src/index.js` (the shared DMS server, not
this app's own code - same file/pattern already used for `/graph`'s 120s override): added a
`DENSITY_POINTS_TIMEOUT = 90_000` branch matched on `req.path.includes('trsp-memory-density-
points')`, checked before the generic 30s default. First real per-route timeout override in this
codebase (the earlier `/trsp-memory` slowness was always resolved by reducing work instead - see
above - not by touching this middleware).

**Count halved**: `DENSITY_NUM_CANDIDATES` (frontend constant) and both backend defaults
(`data-types/routing/index.js`'s `num_candidates || 5`, `memoryGraph.js`'s `numCandidates = 5`)
changed from 10 to 5. Combined with the 90s timeout, this should comfortably resolve the "Failed
to fetch" issue - halving the count roughly halves `MAX_ATTEMPTS` (`numCandidates*15`) too, so
total worst-case search cost drops by ~4x (half the attempts, half as many needed) on top of 3x
more wall-clock budget.

**Backend restart required.** **Not yet live-verified** - this is the point to actually confirm
with a real `searchMs` number and a real screenshot, given how many rounds of unverified changes
have accumulated.

### Live-tested with count=5 - gap still not held for every pair, count raised back to 10

Live screenshot with the 90s timeout + count=5 showed the gap-relaxation fallback engaging (some
points visibly closer together than 0.75mi). Confirmed via code read-through (not guessing) that
the gap enforcement itself IS real - `candidate.dist` is genuine cumulative network distance from
Dijkstra, `pickWithMinGap` genuinely compares it - but `pickWithBestEffortGap` will relax the gap
for a side that can't find enough validated, spread-out points within `MAX_ATTEMPTS`, which is
exactly what happened for at least one side.

User's math check, confirmed correct: 10 points at a 0.75mi gap needs ~7.5mi of spread PER SIDE
(~15mi round-trip across both sides) - well inside the existing 20mi radius, so the radius was
never the bottleneck. Also confirmed the existing "skip a failing candidate and try the next
(farther) one" behavior is exactly right and already how `validateBudget` works.

**Changed:**
- `DENSITY_NUM_CANDIDATES`/`num_candidates`/`numCandidates` defaults back to 10 (from the
  temporary drop to 5) - affordable again now that the 90s timeout is scoped.
- `MAX_ATTEMPTS` widened again, `numCandidates*15` -> `numCandidates*30` (300 attempts per side) -
  gives the gap-relaxation fallback a much bigger validated pool to find 10 genuinely 0.75mi-apart
  points from before it needs to relax anything.

**Backend restart required.** **Not yet live-verified** - needs to confirm 10-10 at (close to)
the full 0.75mi gap, within the 90s budget, with real numbers from the server log.

### Gap-relaxation is real but was INVISIBLE - added a diagnostic field

User: "it was not behaving like that, the distance total also not 0.75 miles" - re-confirmed via
code read-through that the relaxation logic itself is correct (real `dist` in meters from a real
`ST_Length(geography)` SQL column, real halving fallback), but there was NO way to tell from the
response how far it had actually backed off - "the gap silently collapsed" and "the gap logic is
broken" looked identical from the outside, which is a real observability gap, not something to
keep guessing about from screenshots.

**Fixed**: `pickWithBestEffortGap` now returns `{ picked, gapUsedM }` instead of just the picked
list. `selectClosureDensityCandidates`'s response gained `startGapUsedM`/`endGapUsedM` - the
ACTUAL gap (meters) used per side after any relaxation (equal to `MIN_GAP_M` if full spacing was
achieved, smaller if relaxed, `null` if even an ungapped selection couldn't reach `numCandidates`
at all). Also logged server-side in `data-types/routing/index.js`'s
`[routing/trsp-memory-density-points]` line, so the achieved gap is visible without inspecting the
frontend response at all.

**Backend restart required.** **Not yet live-verified** - this diagnostic is what should finally
let "is the gap actually ~0.75mi" be answered with a real number instead of eyeballing a
screenshot, next time this is tested.

### 10 still timed out even with the 90s window - dropped to 7

User: "Could not analyze this closure: Failed to fetch" (again) + "keep 7-7 points." Count dropped
from 10 to 7 (`DENSITY_NUM_CANDIDATES`, `num_candidates || 7`, `numCandidates = 7` defaults) -
`MAX_ATTEMPTS` scales down proportionally with it (`numCandidates*30`: 300 -> 210 attempts/side).

Flagged honestly (not assumed fixed): 10 timing out even inside the 90s window means this is a
~30% reduction in search volume, not a guaranteed fix - the achieved-gap diagnostic fields added
above are what should actually confirm whether 7 fits the time budget and what real gap it lands
on, rather than moving to another guess.

**Backend restart required.** **Not yet live-verified.**

### Real bug found and fixed: same-road loop could starve the "escape and expand" phase

Live screenshot at 7-7: "Analyzed 21 of 49 possible routes" (21 = 3x7) - the END side found its
full 7, spread nicely along a long through street; the START side found only 3, tightly clustered
right at a short LOOPED road ("Campus Access Road (inner)," visible in the screenshot). User
confirmed the roads personally ("i know the roads, it's near my home... it was not behaving like
that") - not a guess, ground truth that the gap was nowhere near 0.75mi on that side.

**Root cause**: a short loop road can have MANY closely-spaced same-highway-type nodes despite
covering very little real distance. `restStart`/`restEnd` walk same-road nodes BEFORE "other"
(escape-onto-a-different-road) nodes, sharing ONE `MAX_ATTEMPTS` budget - so a loop with enough
nodes could consume the ENTIRE budget re-validating itself, never reaching the roads that
actually expand farther out. User's framing once this was surfaced: "explore both direction for
start and end... if dead end go to both direction and expand... it's kind of traversal finding."

**Fixed**: `farthestToNearestNodes` now returns `{ nodes, sameRoadCount }` instead of a bare
array - callers need the same-road/other boundary to budget them separately.
`selectClosureDensityCandidates`'s `validateBudget` rewritten as two phases: same-road capped at
`Math.ceil(MAX_ATTEMPTS/2)`, then "other" GUARANTEED the remaining half of the budget regardless
of how much the same-road phase actually used - a small loop can no longer starve the escape
phase. Also fixed a correctness issue this surfaced: concatenating the two phases doesn't
guarantee global ascending-distance order (an "other" node can be geometrically nearer than a
same-road node that validated first), which the gap logic requires - added an explicit
`valid.sort((a,b) => a.dist - b.dist)` before returning from `validateBudget`.

**Backend restart required.** **Not yet live-verified** - needs a real re-test on the SAME
segment that produced the 3-vs-7 asymmetry, to confirm the start side now reaches (closer to) 7
by actually escaping the loop, using the new `startGapUsedM`/`candidatesRejected` diagnostics to
check with real numbers.

### Same-road priority also needed at SELECTION time, not just validation-budget time

Live-tested the split-budget fix: count now hits 49/49, but on a genuinely LONG road (Western
Avenue in the screenshot) with clearly enough room for all 7 points, a couple of picks still
landed on the branched-off loop. User: "give priority to the direction, if dead end then only
expand the last branch, but here this is [a] long road so all points must be on the same road."

**Root cause**: the split-budget fix only protected the SEARCH from being starved by a small
loop - it still merged same-road and "other" validated points into ONE list before final
selection, with no preference for staying on the same road when the same road didn't actually
need to branch at all.

**Fixed**: `validateBudget` now returns `{ sameRoadValid, otherValid }` separately instead of one
merged/sorted list. New `selectPreferSameRoad(sameValid, otherValid)` tries the same-road-only set
FIRST (full `pickWithBestEffortGap`, gap relaxation included); only merges in the "other" set as
a fallback if same-road alone can't reach `numCandidates` even fully relaxed. So a long road with
enough of its own spread-out valid points never touches the branch; a short/looped road still
gets the branch-expansion safety net from the previous fix.

**Backend restart required.** **Not yet live-verified** - needs a re-test on the same long-road
segment to confirm all 7 (or as many as the road can support) now stay on that one road, with the
branch only appearing on sides that genuinely need it (like the short loop from the prior test).

### Real bug found via screenshot: start-side search was crossing to the end side

Live screenshot showed it plainly: green (start) points clustered near the closure on one side
AND scattered far out on the OTHER side, past the red closed segment, overlapping where end
points belong. User: "some start are going to the dir of the end points lol... if you expand the
road or dir, start go in that line and same for the end as well."

**Root cause**: `preVisited=[toNode]` (for the start-side search) only excluded the segment's
OTHER endpoint from being counted as a candidate - it never stopped the Dijkstra from traveling
THROUGH that node to reach the far side of the closure. Since the search is undirected and the
network is fully connected, nothing prevented "start" candidates from wrapping around through the
end endpoint and landing in what should be exclusively end-side territory.

**Fixed**: `farthestToNearestNodes` gained a `blockedNode` parameter - any edge relaxation
targeting that node is skipped entirely, effectively removing it from the graph for this search
(not just excluding it from the output list). Start-side search now blocks `toNode`; end-side
search blocks `fromNode`. Each side's expansion is now confined to its own side of the closure.

**Backend restart required.** **Not yet live-verified** - needs a re-test on the same segment
from the screenshot to confirm start points no longer appear past the closure on the end side.

### Timeout removed entirely for both density routes

User: "remove timeout from apis, i mean this apis only." Scoped timeouts had been tried at 30s
(default), then explicitly overridden to 90s for `/trsp-memory-density-points`, and still hit
"Failed to fetch" repeatedly even at count=10 with the real algorithmic bugs since fixed. Rather
than guess at yet another number, removed the app-level timeout entirely for BOTH density routes.

**Changed** in `src/dms/packages/dms-server/src/index.js` (the shared DMS server): the timeout
middleware now checks `req.path.includes('trsp-memory-density')` FIRST and calls `next()`
immediately, skipping `req.setTimeout(...)` entirely for both `/trsp-memory-density-points` and
`/trsp-memory-density` - every other route (including `/graph`) is unaffected. `DENSITY_POINTS_TIMEOUT`
removed (no longer needed).

**Caveat, not yet checked**: this only removes the Node/Express-level timeout. If there's a
reverse proxy (nginx, a Vite dev-server proxy, etc.) in front of this server in the actual
deployment, it could still impose its own timeout independently - not something this file
controls. If "Failed to fetch" persists after this restart with no `[timeout]` log line printed
server-side, that's the next thing to check, not another change to this file.

**Backend restart required.**

### CONFIRMED WORKING - 2026-08-21

Live screenshot: "Analyzed 100 of 100 possible routes" (10x10, full count both sides), no timeout
failure, green (start) and red (end) points cleanly separated on their own sides of the closure.
User: "so good, great work on this."

This closes out the point-selection saga for now - the combination that got it there: timeout
removed entirely for both density routes, `blockedNode` crossing-prevention (start/end can no
longer wander onto each other's side), split validation budget (same-road phase can't starve the
escape-onto-other-roads phase), same-road-priority at SELECTION time (not just validation), 1mi
minimum gap, count=10, `MAX_ATTEMPTS = numCandidates*30`.

**Still open / deferred, not blocking**: per-pair open-vs-closed stats in the response (mentioned
early in the original design, never revisited), the testing-only pick-a-pair route feature's own
polish, and general performance characterization now that there's no timeout ceiling forcing the
issue (worth knowing the real `searchMs` even though it's no longer a hard constraint).

### Point-selection rules extracted to a standalone reference doc

User: "keep those rules in a md file, these rules to pick the points are so important." Created
`documentation/closure-density-point-selection.md` - the CURRENT, settled rules (crossing
prevention, same-road priority at both budget and selection time, real minimum-gap enforcement,
hard count requirement, radius-as-cap not target, no timeout) in one clean reference, separate
from this task file's chronological blow-by-blow. Read that file before touching this logic
again; keep it in sync if the rules change.

### Cleanup + commit (2026-08-24)

User: "before that first can you clean the code i mean remove unnecessory code and make ready or
commit in the branch." Reviewed `memoryGraph.js` for dead code left over from the iterative
redesigns above - confirmed via grep that no references remain to any deleted function
(`computeClosureDensity`, `bfsCandidateNodes`, `distanceCandidateNodes`,
`candidateTargetDistancesM`, `dijkstraReachableNodes`, old `nearestToFarthestNodes` name); the
iterative work had already self-cleaned. ESLint findings on the touched files were all either
pre-existing/out-of-scope or established codebase convention (confirmed by diffing against sibling
`routing/comp.jsx`) - no real cleanup needed.

Found `src/dms` submodule in a detached-HEAD state carrying the timeout-bypass edit from the
"Timeout removed entirely" fix above. User's instruction: "for dms just remove that line of code
and make it clean and pull latest submodule" - discarded that edit and updated the submodule to
latest `origin/master` instead of committing the change. **This reintroduces the plain 30s
Express request timeout for both density routes** (`REQUEST_TIMEOUT=30_000` in
`src/dms/packages/dms-server/src/index.js`) - the "no timeout" rule (#8) in
`documentation/closure-density-point-selection.md` is now stale until timing work below lands or
a scoped timeout is reinstated. Flagged to the user as a direct trade-off, not silently absorbed.

Committed to `routing-plugin` (`145c816`): `data-types/routing/index.js`,
`data-types/routing/memoryGraph.js`, this task file, `documentation/closure-density-point-selection.md`,
the entire `src/themes/transportny/components/detour/` plugin directory, and the `src/dms`
submodule pointer bump. Excluded `AGENTS.md` and `src/themes/transportny/theme.js` - both
pre-existing/unrelated, confirmed via `git log`/`git diff` predating this session's work.

### Next: response-timing improvements (tracked separately)

Point selection now works correctly but can be slow per-request (CPU-bound Dijkstra search on the
Node event loop). Broken out into its own task file so it doesn't get lost in this one's history:
[Closure-density point-selection performance](./closure-density-performance.md).

### 2025 conflation data: removed all hardcoded conflation_view_id, server resolves by source+version (2026-09-01)

The whole system moved from 2024 conflation data (view_id 3699) to 2025. Investigation (read-only
SQL, per the user's standing "never update delete or anything - always use SELECT" constraint)
found 2025's edges/nodes/relations tables don't share a single view_id's naming convention the way
2023/2024 did - each of the three followed a different table-naming pattern, so no one hardcoded
id could resolve all three tables. The user added the missing 2025 relations table themselves
(not by me).

User's final instruction, superseding an earlier "leave it as-is" retraction: **"no all will be
2025 verion so what you have to do is no hard coaded view id s here you have to find the source
and then version in it of 2025 so no hard coaded for all theree here."** Then simplified further:
**"just remove the version sendign from the frontend this must be shifted to backend only... only
frontend do not know anythng here it just know the server where to call and backend will manage it
all."** And: **"and cehck all must be same i mean all 3"** - routing's default, detour's default,
and the warm-load constant all had to reference ONE shared source of truth, not three
independently drifting hardcoded values.

**Backend (`data-types/routing/memoryGraph.js`, `data-types/routing/index.js`)**:
- Added `MAIN_CONFLATION_SOURCE_ID = 2125`, `NODES_SOURCE_ID = 2096`, `EDGES_SOURCE_ID = 2097`,
  `RELATIONS_SOURCE_ID = 2098`, `CURRENT_CONFLATION_VERSION = "2025"` - the single source of
  truth, exported for `index.js`'s warm-load log line.
- `resolveConflationTables(db)` now takes NO params (previously took a `conflationViewId` and
  derived `version` from `data_manager.views`) - resolves all four tables by `source_id` +
  `CURRENT_CONFLATION_VERSION` directly.
- `loadGraph`, `getOrLoadGraph`, `invalidateGraph` all dropped their `conflationViewId` params;
  cache key is now `` `${pgEnv}:${CURRENT_CONFLATION_VERSION}` ``.
- `index.js`: removed `WARM_LOAD_CONFLATION_VIEW_ID` entirely; every route handler
  (`/trsp`, `/trsp-memory`, `/nodes`, `/edges`, `/trsp-memory-detour-endpoints`,
  `/trsp-memory-density-points`, `/trsp-memory-density`) stopped reading `conflation_view_id`
  from the request body/query.

**Frontend (`src/themes/transportny/components/routing/`, `.../detour/`)**: removed
`DEFAULT_CONFLATION_VIEW_ID` from both plugins' `constants.js`, and stripped the
`conflationViewId`/`conflation_view_id` param from every hook and fetch boundary that used to pass
it through (`comp.jsx`, `hooks/useTrspRoute.js`, `hooks/resolveTrspRoute.js`, and detour's
`hooks/useClosureDensity.js`, `hooks/resolveClosureDensity.js`, `hooks/usePickedPairRoute.js`,
`hooks/resolveDetourEndpoints.js`, `hooks/resolveNodesInBbox.js` - the last one dead code, fixed
anyway for consistency since it shares the same API contract). The frontend now sends only
`{source, destination, ...}` - no version/view knowledge at all, per "frontend do not know
anythng here."

**Not yet done**: backend changes require a server restart and have NOT been live-tested against
real 2025 data yet - this was interrupted before that step. Verify (post-restart): warm-load log
line resolves all four 2025 tables successfully, a real point-to-point route and a real detour
both return results, and closure-density mode still finds candidates, before considering this
closed.

### REVERTED - back to 2024 (view_id 3699) hardcoding (2026-09-01, same day)

After a server restart, live testing against real 2025 data showed candidate points and route
lines not rendering on the map, then the user reported the API "taking a lot of time" on every
request (not just the expected first-request cold-load). Rather than debug 2025-data performance
mid-session, the user said: **"revert back to the 2024 version i mean revert all code that you
u[pdated] to make it 2025 version."**

Reverted, file by file, back to the pre-refactor state (hardcoded `conflation_view_id`/
`DEFAULT_CONFLATION_VIEW_ID = 3699` everywhere, threaded from frontend constants through every
hook/fetch boundary to the backend, `resolveConflationTables(db, view_id)` back to its original
by-view_id + table-name-suffix form, `getDataTable(db, view_id)` restored, `getOrLoadGraph`/
`invalidateGraph`/`loadGraph` all take `conflationViewId` again, `WARM_LOAD_CONFLATION_VIEW_ID =
3699` restored in `data-types/routing/index.js`, every route handler back to requiring
`conflation_view_id` in its body/query). Confirmed via `node --check` (backend) and `npx eslint`
(frontend, no parsing errors, no `conflation` findings) that the revert is complete and clean.
Only unrelated work from earlier in this same session (theming conversions, the base-network-layer
picker, etc.) was left in place - this revert touched exclusively the files changed by the 2025
refactor above.

**Status: back to the known-good, previously-live-tested 2024 view_id 3699 configuration.** The
2025 data-source naming-convention problem (three different table-naming schemes across the main/
nodes/edges/relations sources) documented above is real and still unsolved if a 2025 migration is
attempted again - but any future attempt should investigate the "taking a lot of time" / invisible-
layers symptom BEFORE re-landing this refactor, since neither was root-caused before the revert
(candidates: 2025 dataset genuinely larger -> slower per-request search; the reinstated 30s Express
timeout on density routes, see "Timeout removed entirely for both density routes" above; or the
candidate/route coordinates landing far outside the zoomed-in test viewport, never actually
confirmed either way).

Backend requires a restart to pick this revert up (same as any `data-types/routing/` change).

### 2025 conflation data, take 2: hardcoded table names + start/end-endpoint segment resolution (2026-09-02)

Same day, redone per explicit correction: **"manage this along the backend only can take the hard
code version or table names we are not going to use the db to find the table name it will take
few sec and this process is not for that."** `data-types/routing/memoryGraph.js`'s
`resolveConflationTables()` is now a plain synchronous function returning four hardcoded string
literals (`CONFLATION_TABLE`/`NODES_TABLE`/`EDGES_TABLE`/`RELATIONS_TABLE`) - no DB query at all.
Confirmed live, read-only, against `data_manager.views` for source_id/version pairs
(2125/2096/2097/2098 x version='2025'):

| source_id | role | data_table |
|---|---|---|
| 2125 | main | `temp.s2125_v3772_osm_conflation_2025` |
| 2096 | nodes | `temp.s2096_v3773_osm_conflation_nodes_2025` |
| 2097 | edges | `temp.s2097_v3774_osm_conflation_edges_2025` |
| 2098 | relations | `temp.osm_conflation_1_2025_relations` |

Confirmed columns and real row counts (5,416,201 nodes / 10,042,759 edges / 16,643 resolved
relations) match. `loadGraph`/`getOrLoadGraph`/`invalidateGraph` cache key is just `pgEnv` now.
Frontend `DEFAULT_CONFLATION_VIEW_ID` removed from both plugins' `constants.js` again; every hook
that passed it stopped sending it.

**Segment-identity resolution** (same "ogc_fid isn't stable across conflation years" bug as
before, since the base network layer is author-selected to any year): `resolveEdgeBetweenPoints(db,
edgesTable, nodesTable, {start, end})` in `data-types/routing/index.js` - snaps the clicked
segment's own START/END coordinates (`comp.jsx`'s `endpointsOf`, the segment's real first/last
LineString coordinates) to nodes via `snapToNearestNode`, looks for a direct edge connecting them
(`exactMatch: true`), and falls back to nearest-by-distance against the segment's midpoint
(`exactMatch: false`) when no such edge exists. New route `POST /trsp-memory-resolve-edge` exposes
this; new frontend fetch boundary `resolveEdgeAtPoint.js`. `comp.jsx` resolves `resolvedOgcFid`
via a `useEffect` on `selectedSegment` and passes it (not the raw picked-layer `ogc_fid`) to every
downstream call (`resolveDetourEndpoints`, `analyze`, `getRoute`'s `excluded_edge_ids`,
`usePickedPairRoute`); `segmentResolveError` surfaces a warning when `exactMatch` is false instead
of silently guessing.

**A multi-edge-chain version was attempted and explicitly reverted same day.** User's next report:
"still overlap... allow user to pick segment and you for that year pick the lat and long of that
selected segment here and then understand the segment for 2025 may be 2 segment comes unders that
lat long break those 2 or take those 2 as a single" - confirmed via a follow-up choice ("treat all
matched 2025 edges as one closed set") to build a graph-path-search version that resolved a picked
segment to a whole CHAIN of edges (new `resolveEdgeChainBetweenPoints` in `memoryGraph.js`,
`closureContext` generalized to arrays, the `densitySearchPool.js`/`graphSearchWorker.js` worker
protocol changed from a fixed edge pair to an array). While testing that version live, the user hit
a stuck "Finding nearby candidate points…" state with no "Analyze coverage" button ever appearing,
said **"lol" / "revert this"**, then clarified after an over-correction (a full revert to the last
commit, `99f02b1`, discarding the 2025-hardcoded-tables work too) with **"noo i mean keep the last
[c]hange i said rever[t] last to last change only"** - i.e. keep the hardcoded-2025-tables +
single-edge start/end resolution, drop only the multi-edge chain redesign. That is the state
documented in this section and currently in the working tree.

**Also confirmed by the user mid-thread, worth remembering going forward: "i told you clearly that
this is only a backend task front must have to behave as before i mean user actions"** - future
work in this area must keep the frontend's user-facing behavior (buttons, panels, click flow)
exactly as before; only the backend's data-source resolution should change.

Verified via `node --check` (all touched backend files) and `npx eslint` (frontend - no new
errors, no leftover `conflation_view_id`/multi-edge-chain references confirmed via grep).
**Not yet live-tested** - needs a backend restart to pick up the current `/trsp-memory-resolve-edge`
contract and hardcoded table names.

### Closure-density candidate search: directional bias to reduce U-turn candidates (2026-09-02, PENDING LIVE VERIFICATION)

Live testing on the 2025 layer (candidates now correctly resolving, no more year mismatch) surfaced
a separate, real problem: candidate points clustering right at/behind the closed segment - a visible
U-turn in the candidate search's own exploration. User's diagnosis and requested fix, verbatim:
**"it took u turn i told you to not take u turn rather expand the route in that dir... you can take
one node in u turn route and stop and expand more on the same direction if found the nodes in that
dir can pick those and it dead end then only expand other ways there."**

**Important history**: a hard no-U-turn rule (`predecessorNode` tracking, fully blocking the reverse
edge in `farthestToNearestNodes`) was already tried once and reverted - "it is not doing the u turn
but the gap between the nodes is too less which is not useful at all." Confirmed with the user
before implementing again which approach to use this time (asked directly, since a repeat of the
same failure mode was a real risk): **chose a SOFT directional-bias penalty over a hard block.**

**Implementation** (`data-types/routing/memoryGraph.js`'s `farthestToNearestNodes`, used by
`selectClosureDensityCandidates` for the closure-density candidate search):
- The search's Dijkstra now tracks TWO values per node: `dist[]` (real, unpenalized cumulative
  network distance - unchanged, still what `MIN_GAP_M` spacing enforcement reads) and a separate
  `priority[]` (direction-penalized cumulative cost, used ONLY as the heap key that controls
  exploration/settling order).
- `directionPenalty(inBearing, outBearing)`: an edge continuing roughly the same bearing as the
  edge that just reached this node costs its real length (penalty = 1x); an edge reversing back
  the way it came costs up to `DIRECTION_PENALTY_MAX` (4x) its real length, linearly interpolated
  by the bearing difference (0deg = straight = 1x, 180deg = full reversal = 4x). The first hop out
  of the seed has no prior bearing to compare against, so it's unpenalized (1x), same as before.
- Backward/branching directions are never excluded - they're still fully reachable, just explored
  and settled LATER, which in practice means only once the straight-ahead direction has nothing
  cheaper left to offer (i.e. dead-ended or exhausted within budget). This is the soft version of
  "take one node in u turn route and stop... if it dead end then only expand other ways."
  Directly addresses why the hard-block version failed: a full block forced the search into
  whatever's next-nearest by any means, producing tight clustering; a soft penalty still allows
  the straight direction ample room to be exhausted before backward nodes compete for candidate
  slots, without ever making backward nodes literally unreachable.
- `reached` (the search's output list) is explicitly re-sorted by real `dist` before being handed
  back to the caller, since the pop order is now by `priority` (direction-biased), not real
  distance - preserves the existing "nearest-first, real-distance-ordered" contract that
  `MIN_GAP_M` spacing enforcement and the same-road/other split both depend on. Only WHICH nodes
  get discovered/pass the `maxDistanceM` cap changes; the final ordering contract is unchanged.
- The search-radius cap (`maxDistanceM`, still `MAX_CANDIDATE_DISTANCE_M` = 8mi) is still enforced
  in real distance (`dist[nodeIdx] > maxDistanceM` skips a node from the candidate list), not the
  inflated priority scale - the priority-scale early-break (`priorityBreakM = maxDistanceM *
  DIRECTION_PENALTY_MAX`) is a generous safety bound only, so real-distance-valid nodes reached via
  a penalized path are never cut off prematurely.

Verified via `node --check` and `npx eslint` (only a pre-existing, unrelated `edgeSource` unused-var
finding elsewhere in the file, confirmed via `git stash` diff - not introduced by this change).

**PENDING LIVE VERIFICATION per explicit user instruction ("make sure we will check the result and
if its good then only will use this")** - this has NOT been tested against a real closure yet.
Needs: backend restart, then a live closure-density run on a segment that previously showed the
U-turn clustering artifact, checking (a) candidates no longer bunch immediately behind the closed
segment, (b) the 10/10 count and real spacing (`MIN_GAP_M`) requirements from
`documentation/closure-density-point-selection.md` still hold, (c) no new regression in analysis
timing. If the result isn't good, this whole section's change should be reverted rather than kept
half-working - same discipline as the two prior candidate-selection attempts in this file.

### Follow-up, same day: real-junction detection by OSM way identity (also PENDING LIVE VERIFICATION)

First live test of the directional-bias change above surfaced a genuine, more serious problem:
**"Analyzed 100 of 100 possible routes (100 had no route)"** on a highway interchange (South Mall
Arterial ramps) - every single candidate pair failed to find a route. Asked the user whether to
revert the directional-bias change first before investigating further; their answer identified the
real root cause directly: **"the routing is working the issue is all points are there is not
reachable because it is in a opposit one way direction... expand first start and end point until
any junction of road so that we can traverse in the tree/roads."**

Root cause: `walkToFirstBranchSimple`/`walkToFirstBranchDensity` (used to derive both the simple-
mode detour endpoints and the closure-density seed points) stopped at the FIRST node offering more
than one next-edge option, **pure topology (edge count)** - on a highway interchange, this is
almost every node, since a ramp forking into "continue" vs. "exit" is technically 2+ candidates
even though both are the SAME physical one-way ramp, not a real cross-connected road. The walk was
stopping at these fake forks far too early, seeding candidates onto one-way-isolated ramp geometry
that structurally can't route back to the opposite side - explaining both the earlier U-turn
clustering AND this new 100%-no-route failure.

**Fix**: added `edgeOsm` (the OSM way id per edge, same "ground truth for is this the same road"
column `getEdgesInBbox` already selects per-request - now loaded into the in-memory graph once at
graph-load time instead) to `loadGraph`'s edges query and the graph object. `isBranch` in BOTH walk
functions (confirmed in scope by the user: **"i thisnk this is also used in a simple detour too...
if junction is there just take the next node in that dir not junction dir but the expansion dir"**
- i.e. keep the existing straightest-continuation pick for WHICH node to walk to, only change WHEN
the walk is allowed to stop) now requires that at least one candidate edge belongs to a genuinely
DIFFERENT OSM way than the one just traveled - a real joining road, not a lane/ramp fork within the
same way. Falls back to the old any-fork rule when `osm` data is missing (`-1`) on the just-
traveled edge, so this degrades safely rather than never stopping.

Verified via `node --check` and `npx eslint` (same 3 pre-existing findings as before this change,
confirmed unrelated via `git stash` diff - no new errors).

**PENDING LIVE VERIFICATION, same discipline as above** - backend restart needed (graph reload
required to pick up `edgeOsm`), then re-test the SAME interchange closure that produced "100 had no
route": candidates should now sit past a real cross-street, not on isolated ramp geometry, and
route-finding between them should succeed for at least most pairs. If it doesn't, this needs
further investigation before being trusted - not kept half-working.

### REVERTED - the OSM-way real-junction fix, same day

Live test with both today's changes (direction-bias search + OSM-way branch detection) still
showed a bad result: **"Analyzed 100 of 100 possible routes (46 had no route)"**, average detour
+39.30mi/+3265s, with candidate points spread wildly asymmetric (green/start candidates strung out
~40mi north, red/end candidates clustered tightly together) - visibly still wrong, not just
"improved but imperfect." User's explicit verdict: **"still the start and end points are not valid
here."**

Asked whether to revert both changes back to the plain-topology baseline given the two-changes-in-
one-session risk (debugging compounded, unproven changes at once); user confirmed reverting both,
then immediately corrected to **"i mean just revert h[t]e last"** - keep the direction-bias search
change (still itself unverified, but not implicated by this specific new failure mode), revert only
the OSM-way real-junction fix.

**Reverted**: `edgeOsm` removed from `loadGraph`'s edges query/typed-array/graph object; both
`walkToFirstBranchSimple` and `walkToFirstBranchDensity`'s `isBranch` back to plain
`candidates.length > 1` (pure topology, pre-2026-09-02 state). The direction-bias search change
(`DIRECTION_PENALTY_MAX`/`directionPenalty` in `farthestToNearestNodes`) is UNCHANGED/kept from the
earlier entry in this file. Verified via `node --check` and `npx eslint` (same 3 pre-existing,
unrelated findings, no new errors) and `grep` (confirmed zero remaining `edgeOsm`/`currentOsm`
references).

**Current state**: direction-bias search kept (still pending its own live verification - never
cleanly confirmed working on its own, since the OSM-way fix landed in the same session before a
clean isolated test could happen), OSM-way real-junction detection fully reverted. The underlying
"walk stops at fake one-way ramp forks" problem this was meant to fix is UNRESOLVED and will
recur on interchange-heavy closures until revisited - flagged here rather than silently dropped.

### Direction-bias search ALSO reverted, same day - back to the fully plain-topology baseline

A clean isolated test of the direction-bias-only state (2025 layer, confirmed exact match) still
came back bad: "Analyzed 100 of 100 possible routes (20 had no route)," avg +30.26mi/+2525s -
user's verdict: **"still see the point picker is not following the rules."** Asked whether this
was a stale/segment-mismatch artifact; user confirmed **"layer is 2025 yeah same result because
the points that you pick is same and not that good"** - a clean, valid test showing the direction-
bias search itself was the problem (every test today with it active had come back with large
30-40mi average detours, vs. sane small-scale results in tests earlier in the session before any
of today's changes).

**Reverted**: `DIRECTION_PENALTY_MAX`/`directionPenalty`/the priority-vs-real-distance split in
`farthestToNearestNodes` - back to the plain, single-real-distance Dijkstra flood, byte-identical
to commit `99f02b1`'s version (confirmed via `diff` against that commit). This closes out EVERY
candidate-picking experiment tried on 2026-09-02 - direction bias, OSM-way real-junction detection
- all reverted. The plain pre-2026-09-02 topology-based rules (documented in
`documentation/closure-density-point-selection.md`, unchanged all day) are what's live.

**Confirmed working** on the next live test (2025 layer, real interchange-free residential road):
100/100 routes found, avg +0.32mi/+41sec - sane, small-scale, real. User: **"this looks good for
me for now."** Two genuine, still-open problems were separately diagnosed and left UNFIXED
(deliberately, not forgotten) rather than patched with another unproven change:
- Interchange/one-way-ramp fake-branch stopping (the walk problem the reverted OSM-way fix
  targeted).
- Trivially-local candidates on small dead-end-heavy networks (a user-observed case: "i know this
  is total 3-4 mile road and here it has to be min 15-20 mile" - the search settles for nearby
  dead-end streets instead of being forced out to the arterial network). A blanket radius raise
  (`MAX_CANDIDATE_DISTANCE_M` 8mi->15mi) was already tried once (2026-08-25 era) and reverted for
  being slower without being better - an adaptive approach wasn't attempted.

Both are documented in `documentation/detour-plugin-pipeline.md`'s "Known limitations" section and
the new skill `planning/transportny/skills/detour-and-routing-plugins.md`.

### Documentation written (2026-09-02, once the baseline was confirmed good)

- `documentation/detour-plugin-pipeline.md` - full pipeline + "Known limitations."
- `documentation/mapeditor-authoring-guide.md` - general "how to create a map" UI guide (two
  entry points, adding a layer, adding a plugin as author/developer, the `state.symbology` vs
  `state.symbologies` gotcha).
- `planning/transportny/skills/` (new folder, mirrors `planning/mitigateny/skills/`) -
  `README.md` + `detour-and-routing-plugins.md`, the plugin-specific skill covering attachment,
  methodology, and - per explicit follow-up instruction - an IMPORTANT callout that only the 2025
  base network layer should ever be used, plus a worked example documenting the actual live test
  map's real layer/source/table setup (`localhost:5173/mapeditor/edit/2216051`, source_id 2097,
  `temp.s2097_v3774_osm_conflation_edges_2025`).

### Conflation table resolution refined again, same day: source_id+version, resolved ONCE and cached (not hardcoded literals, not per-request)

Final correction to the backend's table-resolution approach, per explicit instruction: **"do not
hardcode table name just hardcode th[e] view_id... keep sourrce and find version so first
understan[d] that in backend and make sure it will not impact on the speed of response."** The
hardcoded-literal-table-name approach (earlier same day) has a real staleness problem identical to
the old per-plugin `DEFAULT_CONFLATION_VIEW_ID`'s history (3608->3689->3692->3699 across
reprocesses) - a literal table name string breaks the moment the conflation pipeline reprocesses
and mints a new physical table.

**Fix**: `resolveConflationTables` in `data-types/routing/memoryGraph.js` resolves by
`source_id` (permanent, hardcoded: 2125/2096/2097/2098) + `CURRENT_CONFLATION_VERSION` ("2025",
hardcoded) via `data_manager.views`, same as the FIRST 2025 migration attempt earlier this
session - but this time the resolution is wrapped in a **module-level memoized promise**
(`cachedTablesPromise`): the actual DB query runs exactly ONCE per server process lifetime,
whichever caller happens to trigger it first (in practice, the warm-load, ~20s after boot - "the
memory store on restart"). Every call after that - including every real per-request call site
(`/nodes`, `/edges`, `/trsp-memory-resolve-edge`, `computeTrspRoutes`) - returns the cached result
synchronously with zero DB cost, so real user traffic never pays for this resolution at all. A
failed resolution clears the cache so the next caller can retry rather than caching a permanent
failure.

All 5 call sites (`loadGraph` + 4 in `index.js`) updated to `await` the now-async
`resolveConflationTables(db)`. `CURRENT_CONFLATION_VERSION` exported for the warm-load log line.
Verified via `node --check` and `npx eslint` (same pre-existing findings only, no new errors) and
`grep` (confirmed zero remaining hardcoded literal table-name strings).

**Not yet live-tested** - needs a backend restart to confirm the warm-load resolves all four
tables correctly and that a real request afterward is fast (no DB round trip beyond the one-time
warm-load cost).
