# Detour plugin: segment matching, endpoint picking, and route measurement

Step-by-step reference for how the `detour` plugin (`src/themes/transportny/components/detour/`)
turns a user's map click into a computed route/closure-density result, backend included. For the
chronological story (bugs found, live tests, exact user wording) see
`planning/transportny/tasks/current/detour-avoid-segment-routing-plugin.md`. For the closure-
density candidate-point selection rules specifically, see
`documentation/closure-density-point-selection.md` (referenced, not repeated, in step 4 below).

## The conflation data itself

The backend's routing graph is loaded from tables resolved by **source_id + version**, both
hardcoded, in `data-types/routing/memoryGraph.js`:

```js
const MAIN_CONFLATION_SOURCE_ID = 2125;
const NODES_SOURCE_ID = 2096;
const EDGES_SOURCE_ID = 2097;
const RELATIONS_SOURCE_ID = 2098;
const CURRENT_CONFLATION_VERSION = "2025";
```

`resolveConflationTables(db)` looks up the current `data_table` for each source_id/version pair
via `data_manager.views` - NOT a hardcoded literal table name (that broke on every conflation
reprocess, the same staleness problem the old per-plugin `DEFAULT_CONFLATION_VIEW_ID` had across
several years' worth of reprocesses). This lookup is **memoized in a module-level cache**: it runs
the actual DB query exactly ONCE per server process lifetime (whichever caller triggers it first -
in practice the warm-load, ~20s after boot), then every later call - including every real
per-request call site - returns the cached result synchronously with zero DB cost. Real user
traffic never pays for this resolution; only the one-time warm-load does. The in-memory graph
itself (`loadGraph`) is built once per process and cached separately (`getOrLoadGraph`).

The frontend's "Base network layer" picker (any DMS symbology layer, any year) is used ONLY to
render the clickable network and to identify which real-world segment was clicked - it has no
bearing on which table the backend computes against. See step 1.

## Step 1 - Picking a segment and matching it into the live table

1. User clicks a road on whatever "Base network layer" is currently selected
   (`hooks/useEdgeLayer.js`) - this can be ANY year's tiled DMS layer, not necessarily 2025's.
   `queryNearbyEdge` does a small screen-pixel tolerance-box hit test
   (`map.queryRenderedFeatures`) against that layer, so exact-pixel clicking isn't required.
2. The clicked feature's `id` (the vector tile's MVT feature id, which IS `ogc_fid` - see
   `useEdgeLayer.js`'s own comment on why `feature.properties.ogc_fid` is `undefined`) and its
   `geometry` (a real LineString, actual lon/lat coordinates) are captured as `selectedSegment`.
3. `comp.jsx`'s `endpointsOf(geometry)` takes that LineString's **first and last coordinate** -
   the segment's real-world start/end points. This, not the picked layer's `ogc_fid`, is what gets
   sent to the backend - `ogc_fid` is a per-import serial PK, not stable across conflation years,
   so a raw id from a 2024 layer means nothing in the 2025 table.
4. `resolveEdgeAtPoint.js` POSTs `{start, end}` to `/dama-admin/:pgEnv/routing/trsp-memory-resolve-edge`.
5. Backend (`resolveEdgeBetweenPoints`, `data-types/routing/index.js`):
   - Snaps `start` and `end` **independently** to the nearest node in the live 2025 nodes table
     (`snapToNearestNode` - plain `ORDER BY wkb_geometry <-> ST_MakePoint(...) LIMIT 1`).
   - Looks for a real edge in the live 2025 edges table connecting those two snapped nodes
     (`WHERE (from_node=$1 AND to_node=$2) OR (from_node=$2 AND to_node=$1)`).
   - **Found** -> `{ogc_fid, exactMatch: true}` - a validated, real-topology match: the 2025
     network genuinely has an edge between where this segment starts and ends.
   - **Not found** (the road was split differently by the 2025 reconflation, or a node moved) ->
     falls back to a plain nearest-edge-by-distance query against the segment's own midpoint,
     `{ogc_fid, exactMatch: false}` - a best-effort guess, not a validated match. Only ONE edge is
     returned in this case (multi-edge-chain resolution was tried and reverted - see the task
     file's "revert this" entry) - if the real road spans more than one 2025 edge, only the
     guessed piece gets excluded, which can leave the rest of the road still routable.
6. The frontend stores `resolvedOgcFid` and shows a visible warning
   ("This segment doesn't match a connected road in the current routing data - results may be
   inaccurate") when `exactMatch` is `false`, rather than silently treating the guess as normal.
   Every later step uses `resolvedOgcFid`, never the raw picked-layer id.

**Practical implication**: picking a "Base network layer" that's actually the 2025 edges source
(`temp.s2097_v3774_osm_conflation_edges_2025`) means the clicked geometry and the backend's live
table are the identical source, so step 5 always finds a direct edge - no guessing, no warning.
Any other year usually still works (most roads didn't change shape) but is a real, silent risk on
whichever roads did get re-split.

## Step 2 - Deriving the detour's start/end points (single-trip mode)

Once `resolvedOgcFid` is known, `resolveDetourEndpoints` (`memoryGraph.js`) finds where "the trip"
actually starts and ends around the closed segment - not the segment's own two endpoints (which,
per OSM's own way-splitting convention, usually sit exactly at an intersection - a real trip's
start/end should be one step further out, at the first place the traveler actually had another
option).

For EACH side (segment's `fromNode`, and separately `toNode`), `walkToFirstBranchSimple` walks
outward along the connected road:
- Capped at 2000 hops or 10 miles (`MAX_SEED_WALK_HOPS`/`MAX_SEED_WALK_DISTANCE_M`), per side.
- At each hop, picks whichever next edge is STRAIGHTEST relative to a bearing captured once on the
  very first hop (not re-measured every hop - an earlier per-hop version visibly deflected at real
  intersections it shouldn't have turned at, see `walkToFirstBranchSimple`'s own comment).
- Stops the moment it passes a real branch (a node with more than one viable next edge) - takes
  exactly one hop past the branch, then stops that direction.
- The closed segment (and its reverse-direction pair) is excluded from the walk so it can't walk
  back onto itself.

Result: `{ start: {lon, lat, osm_id}, end: {lon, lat, osm_id} }` - the two points "Get detour"
actually routes between.

## Step 3 - Computing and measuring the route

`getRoute(start, end, [resolvedOgcFid])` (`hooks/useTrspRoute.js`) fires **4 backend requests** in
parallel - both directions (A->B, B->A - a river-crossing analogy: turn restrictions can make the
two directions genuinely different routes) x both closed (segment excluded, "after") and open (no
exclusion, "before" baseline, for the delta shown in the panel).

Each request hits `POST /trsp-memory` (`data-types/routing/index.js`):

1. **Algorithm choice** (`hooks/haversineMiles.js`'s `chooseAlgorithm`): straight-line distance
   between start/end > 80 miles -> `bidirectional` (grows a search from both ends at once);
   otherwise plain `dijkstra`. The 80mi threshold is the exact one already validated for the
   sibling `routing` plugin's own 20-pair benchmark (see `point-to-point-routing-plugin.md`) -
   bidirectional was measurably slower under ~3mi and only a real (if noisy) win past ~80mi.
2. **Search** (`memoryGraph.js`'s `findRoute`): snaps `source`/`destination` to nearest nodes via
   the in-memory `NodeGrid` (no DB round trip), then runs an EDGE-EXPANSION Dijkstra or
   bidirectional-Dijkstra (`dijkstraEdgeExpansion`/`bidirectionalDijkstra`) - state is "arrived via
   edge E," not "at node N," because a two-way road's both directions share the same two node ids,
   so plain node-based search can't tell "continuing straight" from "illegally reversing" (the
   same reason `pgr_trsp` needs edge-expansion). Turn restrictions (from the relations table) are
   checked as banned `(fromEdge, toEdge)` transitions during the search.
3. **Cost**: two independent searches per request - `distance` (cost = `edgeLengthM`) and `time`
   (cost = `edgeDurationS`, computed once at graph-load time per edge from real speed data - see
   below) - "shortest" and "fastest" are NOT the same path in general.
4. **Excluded edges**: `excluded_edge_ids: [resolvedOgcFid]` (plus that edge's own reverse-
   direction pair, resolved server-side via `findReverseEdge`) is removed from the search entirely
   for this request only - the shared cached graph is never mutated, so this has zero effect on
   any other concurrent or later request.
5. **Real speed, not just road class**: `edgeDurationS` is computed at graph-load time as
   `edgeLengthM / (speedMph * 0.44704)`, where `speedMph` prefers real observed data over a
   highway-class guess - `tmc_avg_speedlimit` (NPMRDS probe data) first, then `ris_posted_speed`
   (RIS posted limit), then a per-highway-type table (`motorway`: 65mph, `residential`: 30mph,
   etc.) only as the last resort.
6. **Response**: `{feature, segments}` - a merged LineString geometry plus a per-edge segment list,
   with `properties.length` (miles) and `properties.duration_s` (seconds) summed across every edge
   in the winning path.

The panel shows the closed-route stats alongside the open-route baseline and the delta between
them (added distance/time from the closure) for each direction.

## Step 4 - Closure-density / coverage mode

A second "view" of the same picked segment: instead of one traveler's route, this asks "which
surrounding roads absorb rerouted traffic if this segment closes," across up to 10x10 = 100
origin/destination pairs.

1. `analyze(resolvedOgcFid)` -> `POST /trsp-memory-density-points` -> `selectClosureDensityCandidates`
   picks up to 10 start-side and 10 end-side candidate points. **Full selection rules (same-road
   priority, minimum real-world spacing, validation-budget split, etc.) are documented separately
   in `documentation/closure-density-point-selection.md` - read that file before touching this
   logic.**
2. `POST /trsp-memory-density` -> `computeClosureDensityFromPoints` runs up to 100 closed-route
   searches (start x end pairs) - and, for the route-comparison tab, their open-baseline
   counterparts too - across a `worker_threads` pool (`densitySearchPool.js` +
   `graphSearchWorker.js`, sharing the graph via `SharedArrayBuffer`) rather than sequentially on
   the main thread. This pool is SHARED across every concurrent request (not per-request) - see
   `closure-density-point-selection.md` rules 9-10 for the correlation/queue/admission-gate design
   that makes that safe under real concurrent load, plus the results cache and cancellation on top.
3. Every edge that appears in at least one computed route is tallied by how many of the pairs used
   it - this frequency count IS the heatmap (`edgeFrequencies`, rendered as a `step`-colored line
   layer, darkest = most-used).
4. The app-level request timeout is bypassed entirely for both density routes (variable, sometimes
   large cost per closure - see rule 8 in `closure-density-point-selection.md`), not tuned to
   another arbitrary number.

## Known limitations (as of 2026-09-04)

Several fixes to the rules above were tried live on 2026-09-02 and reverted after real testing
showed they made results worse, not better - both problems below are real and still open, just
without a working fix yet. See `planning/transportny/tasks/current/detour-avoid-segment-routing-plugin.md`
for the full blow-by-blow (what was tried, what broke, exact user wording at each step).

- **Highway interchanges / one-way ramp clusters**: `walkToFirstBranchSimple`/`Density` (step 2)
  stops at the FIRST node offering more than one next-edge option, PURE TOPOLOGY (edge count) -
  on an interchange, a ramp forking into "continue" vs. "exit" counts as a branch even though both
  options are the SAME physical one-way ramp, not a real cross-connected road. This stops the walk
  far too early, seeding candidates onto structurally one-way-isolated ramp geometry that can't
  route back to the opposite side - producing both visible "U-turn" candidate clustering and, in
  the worst case, 100% route-finding failure. A fix using the edge's OSM way id (a genuinely
  different way = a real junction, not just a fork) was built and reverted the same day after a
  live test still showed a large asymmetric failure (46/100 no-route on a real interchange) -
  inconclusive whether the fix itself was wrong or whether a compounding change (see next bullet)
  masked its effect. **Retried in isolation on 2026-09-09** (no other change active), on the exact
  same interchange closure (`ogc_fid 9249029`, Albany South Mall Arterial): 100/100 pairs failed to
  find a route - same total-failure signature as the original attempt, this time with nothing else
  that could be masking or compounding it. Reverted again. Read as confirmation the OSM-way-id
  approach itself is wrong, not an artifact of the earlier compounding change: on a cloverleaf, OSM
  doesn't always split the way at every ramp junction, so requiring a genuinely different way id
  makes the walk stop LATER, not more correctly - it walks past real forks deeper into one-way
  ramp geometry before finally stopping, landing candidates somewhere structurally worse than the
  plain-topology baseline. A real fix needs a different signal for "is this a real junction" than
  OSM way identity - e.g. node degree in the untraveled-direction subgraph, not the traveled way.
- **Small/dead-end-heavy local road networks**: `MAX_CANDIDATE_DISTANCE_M` (8 miles) combined with
  the "accept the first `numCandidates` valid points found" selection can settle for trivially
  local candidates (nearby dead-end streets in a small subdivision) when the real network there is
  small, producing a technically-successful but practically-meaningless result (e.g. +0.32mi
  average added detour on a closure that should force real traffic out onto the arterial network).
  Raising the radius (8mi -> 15mi) was tried once already (2026-08-25 era) and reverted for being
  measurably slower without being better - a blanket raise isn't the right fix; an adaptive
  approach (raise the radius only when the local network is genuinely small) hasn't been tried.
- **Dense urban grids can confine validated candidates too close to the closure** (found
  2026-09-04, not yet fixed): `MAX_ATTEMPTS` (`numCandidates * 30` = 300) is a flat count of
  pooled candidates tested, regardless of local node density. On a dense grid (e.g. an urban
  bridge crossing with an 80k+ node raw pool), the nearest 300 pooled nodes can span only a short
  physical distance, confining every validated candidate right next to the closure (gap-relaxation
  collapses to its floor) - the corridor least likely to have a real detour, producing 100%-failed
  tallies live-tested on a real Albany bridge (`ogc_fid 9506168`). Structural fix would stride the
  tested window by distance/index instead of raw pool order - flagged, not implemented. (The
  unreachable-candidate scoring bug that was ALSO present on this same test is fixed - see rule 4
  above - this is a separate, still-open issue.)

## Quick reference: the four backend routes this plugin calls

| Route | Purpose | Key params |
|---|---|---|
| `POST /trsp-memory-resolve-edge` | Match a clicked segment (any year's layer) into the live 2025 table | `{start, end}` -> `{ogc_fid, exactMatch}` |
| `POST /trsp-memory-detour-endpoints` | Derive the "real trip" start/end around the closed segment | `{ogc_fid}` -> `{start, end}` |
| `POST /trsp-memory` | Compute a route (shortest + fastest), used both for single-trip mode and the testing-only pair-picker | `{source, destination, excluded_edge_ids?, algorithm?}` |
| `POST /trsp-memory-density-points` / `POST /trsp-memory-density` | Closure-density candidate selection (step 1/2) and route tally (step 2/2) | `{ogc_fid, num_candidates?}` / `{ogc_fid, start_node_ids, end_node_ids}` |
