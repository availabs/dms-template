# Attaching and configuring the `routing`/`detour` map plugins

How-to guide for authors attaching the point-to-point `routing` plugin or the avoid-segment
`detour` plugin to a MapEditor map, plus the settled methodology both use to pick start/end
points and compute a route. For the full technical pipeline (backend requests, segment matching
across conflation years, route measurement) see
[`documentation/detour-plugin-pipeline.md`](../../../documentation/detour-plugin-pipeline.md). For
closure-density candidate-point selection specifically, see
[`documentation/closure-density-point-selection.md`](../../../documentation/closure-density-point-selection.md).

## What each plugin is for

- **`routing`** (`src/themes/transportny/components/routing/`) — "get me from point A to point B."
  The user drops two free-form pins anywhere on the map; the plugin snaps them to the nearest road
  and computes a turn-restriction-aware shortest AND fastest route.
- **`detour`** (`src/themes/transportny/components/detour/`) — "what happens if THIS road closes."
  The user clicks one existing road segment, not two free points. Two modes, one plugin:
  - **Simple detour mode**: derives a realistic start/end pair automatically from the segment's own
    two ends, then computes the detour route around the closure vs. the open-road baseline.
  - **Closure density / coverage mode**: instead of one traveler, tests up to 100 realistic
    origin-destination pairs and shows a heatmap of which surrounding roads absorb the rerouted
    traffic.

Both plugins compute against ONE hardcoded backend conflation dataset (currently the 2025
conflation tables, `data-types/routing/memoryGraph.js`) - see the pipeline doc's "The conflation
data itself" section for why, and for what happens if the map's displayed layer is a different
year.

> **IMPORTANT - only use the 2025 layer as the Base network layer.** The backend resolves its
> tables by source_id + a hardcoded target version (`data-types/routing/memoryGraph.js`'s
> `CURRENT_CONFLATION_VERSION = "2025"`) and will stay on 2025 until that one constant is bumped
> for a future year. A different year's layer (2024, etc.) MOSTLY still works via the cross-year
> segment-matching fallback ("Segment identity across conflation years" below) - most roads didn't
> change shape between years, so a direct edge is still found (`exactMatch: true`) and the result
> is identical to using the 2025 layer. The real, silent risk is any road that WAS re-split or
> moved by the 2025 reconflation: no direct edge connects the two snapped points anymore, so the
> backend falls back to a nearest-edge-by-distance GUESS (`exactMatch: false`, a visible warning
> shown) - and that guess is only ONE edge, so if the real road now spans more than one 2025 edge,
> only the guessed piece gets excluded and the rest of the road stays routable - an incomplete
> closure, not just an inaccurate one. Live testing this session hit exactly this failure mode
> (candidates landing on the wrong road, and in one case 100% route-finding failure on a re-split
> interchange). **Always pick the 2025 edges layer** - see the worked example
> below for exactly which one.

## Worked example - the live test map

The map used for all of this session's live testing:
`http://localhost:5173/mapeditor/edit/2216051` (page name "test osm detour" in the mapeditor
pattern's catalog). Its setup, for reference:

- **Layers tab**: two candidate base layers are present - "OSM Conflation Edges 2024" and
  "OSM Conflation Edges 2025" (both sourced from the conflation edges data, one per year). Only
  the 2025 one should ever be selected as the plugin's Base network layer, per the callout above.
- **"OSM Conflation Edges 2025"** is sourced from source_id `2097` (the edges companion source),
  view/table `temp.s2097_v3774_osm_conflation_edges_2025` - the exact same table
  `data-types/routing/memoryGraph.js`'s `EDGES_TABLE` constant hardcodes on the backend. Picking
  this layer means every segment click resolves with `exactMatch: true` - no guessing, no warning,
  ever - because the picked layer's geometry and the backend's live table are the literal same
  source.
- **Plugins tab**: `detour` is attached, with **Base network layer** set to "OSM Conflation Edges
  2025" (NOT the 2024 one - a mistake made repeatedly during this session's live testing before
  this rule was settled).
- **Closure density mode**, **Show candidate points**, and **Pick point pair** are all toggled on
  for testing visibility - a normal author wouldn't necessarily need "Pick point pair" on
  day-to-day, it's a testing/debugging aid.

## Attaching `detour` to a map (author steps)

1. Open the map in MapEditor and add the `detour` plugin from the **Plugins** tab (next to
   **Legend**/**Layers**) in the left panel.
2. Add (or confirm you already have) a symbology layer sourced from the conflation **edges**
   table, **2025 specifically** — "OSM Conflation Edges 2025" (source_id `2097`, table
   `temp.s2097_v3774_osm_conflation_edges_2025`) — via the normal **Layers** tab **+** flow, like
   any other DMS layer. This must be the `_edges`-shaped source specifically (columns `ogc_fid`,
   `from_node`, `to_node`, `highway`), not the main conflation table — the plugin validates this
   for you and shows a warning ("Not a conflation edges layer - missing column...") if you pick
   the wrong one.
3. Open the plugin's own settings panel and set **Base network layer** to that 2025 edges layer.
   **Do not pick a different year** (2024, etc.) even though the plugin will technically still run
   against one — see the IMPORTANT callout above for why this matters.
4. Toggle **Closure density mode** on/off to switch between the two modes described above.
5. **Show candidate points** — shows the closure-density search's picked start (green)/end (red)
   dots on the map. Independent of density mode itself, so it can be toggled without switching
   modes.
6. **Pick point pair** — testing-only: with candidate points visible, click any green + red dot to
   see the actual computed route between that specific pair, rather than only the aggregated
   heatmap. Only takes effect when "Show candidate points" is also on.

## Using the plugin (end-user flow)

**Simple detour mode:**
1. Click a road segment on the base network layer — it highlights (red).
2. The plugin resolves a start/end pair automatically (see "Methodology" below) and shows markers.
3. Press "Get detour" — computes both travel directions (the road you started on -> the other end,
   and back), each shown against its own open-road baseline, with the added distance/time called
   out.
4. "Clear detour" resumes picking.

**Closure density mode:**
1. Click a road segment, same as above.
2. Press "Analyze coverage" — the plugin finds up to 10 start-side and 10 end-side candidate
   points, tests all realistic pairs between them (up to 100), and renders a heatmap of which
   roads absorb the rerouted traffic, colored by how many of those pairs used each road.
3. "Clear analysis" resumes picking.

## Methodology: how start/end points get picked

### Simple detour mode

The segment's own two endpoints are NOT used directly as start/end — OSM splits ways at
intersections by convention, so the segment's endpoint usually already sits at a junction, not at
a place a real traveler would meaningfully start/end a trip. Instead, for each side:

1. Walk outward along the connected road, staying on the straightest continuation of the segment's
   own original direction (a fixed reference bearing, captured on the very first hop and never
   updated — this is what keeps the walk from visibly deflecting at a real intersection it
   shouldn't turn at).
2. Stop the moment a REAL BRANCH is reached — a node offering more than one viable next road,
   by pure topology (edge count).
3. Take exactly one more hop past that branch, and stop there. That's the start/end point for
   that side.

Capped at 2000 hops or 10 miles per side; falls back to wherever the walk dead-ended if nothing
connects at all.

### Closure density / coverage mode

Same seed-finding rule as above (steps 1-3), used as the search's own starting point on each side.
From there, a wider search runs outward (capped at 8 miles) to find up to 10 candidate points per
side. The full rule set — same-road priority, minimum 1-mile real-world spacing between picks
(relaxed only if the count of 10 genuinely can't be reached), OD-pair validation (a candidate only
counts if the OPEN route from it actually passes through the closed segment) — is documented in
full in [`closure-density-point-selection.md`](../../../documentation/closure-density-point-selection.md).
Read that file before changing any of this logic; it is the single settled reference, kept in
sync with the code.

### Known open problems

Both documented in the pipeline doc's "Known limitations" section, with links to the exact
attempted-and-reverted fixes so the same failure isn't blindly re-tried:

- **Highway interchanges**: the branch-detection rule (step 2 above) can stop too early at a
  one-way ramp fork (which is topologically "a branch" but not a genuinely different road),
  seeding candidates onto isolated ramp geometry that can't route back to the other side.
- **Small/dead-end-heavy local networks**: the search can settle for trivially local candidates
  (nearby dead-end streets) when the immediate network is small, producing a technically-valid but
  practically-meaningless result (a tiny added detour on a closure that should force a real
  reroute onto the arterial network).

## Route computation and measurement

Both plugins share the same backend route search (`POST /trsp-memory`,
`data-types/routing/memoryGraph.js`'s `findRoute`):

- Turn-restriction-aware edge-expansion Dijkstra (or bidirectional Dijkstra for long routes, > 80
  straight-line miles — reuses the exact threshold validated for the `routing` plugin's own
  20-pair benchmark).
- Two independent searches per request: **shortest** (cost = real road length) and **fastest**
  (cost = estimated travel time, computed once at graph-load from real speed data — NPMRDS probe
  speed first, then RIS posted speed, then a per-highway-class table as the last resort).
- `detour` additionally excludes the closed segment (and its reverse-direction pair) from the
  search for that one request only — the shared cached graph is never mutated, so this has zero
  effect on any other concurrent or later request.

## Segment identity across conflation years

Because the base network layer can be a different year than the backend's live table, a clicked
segment's own `ogc_fid` is never trusted directly — it's a per-import serial PK, not stable across
years. Instead the segment's real-world start/end coordinates are snapped into the backend's live
table server-side, and the plugin shows a clear warning if that snap can't find a genuinely
connected road. Full detail in the pipeline doc's "Step 1" section — this is worth understanding
before debugging any "results look wrong" report, since a failed/fallback match here can look
identical to a bug in the candidate-picking logic itself.
