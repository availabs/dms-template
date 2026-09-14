# Bridge candidates — batch detour analysis + GeoPackage export

**Project:** TransportNY · **Topic:** data-types · **Status:** NOT STARTED · **Started:** 2026-08-26

## Objective

Given a list of 395 candidate NY State bridges (`Potential_Bridge_Candidates.gdb.zip`, repo root),
each bridge represents a road segment that could be closed. For each one, run the detour plugin's
existing **simple/normal detour mode** logic (not closure-density mode — the segment is already
known, one specific location per bridge) to compute the detour route in both directions, then
package everything into a single GeoPackage (`.gpkg`) with two layers:

1. A **base layer** — the bridge candidate points themselves (enriched with the road-network
   segment each one resolves to).
2. A **detour routes layer**, drawn on top of the base layer, showing the computed detour route
   geometry for both directions (Start→End and End→Start) per bridge.

This reuses the routing plugin's existing server-side logic
(`data-types/routing/memoryGraph.js`'s `walkToFirstBranchSimple`/`resolveDetourEndpoints`/
`findRoute`) as a **batch script**, not as new API surface — the UI-facing simple detour mode
already does exactly this one segment at a time; this is the same computation run 395 times and
written to a file instead of rendered on a map.

## Source data (already inspected, 2026-08-26)

`Potential_Bridge_Candidates.gdb.zip` at the repo root — an Esri File Geodatabase. Extracted with
`unzip` + read with `ogrinfo`/GDAL's `OpenFileGDB` driver (both installed at `/usr/bin/ogrinfo`,
`/usr/bin/gdalinfo`).

- **One layer**: `Potential_Bridge_Candidates_FC_Limited`, geometry type Point, **395 features**.
- **CRS**: WGS 84 (EPSG:4326) — same as the conflation network's own SRID, no reprojection needed.
- **Extent**: roughly all of NY State (-79.76, 40.60) to (-72.77, 44.97).
- Key fields (full list captured via `ogrinfo -al -so`):
  - `BIN` (Integer) — Bridge Identification Number, the real-world bridge ID. **Not unique per
    row** — a small number of BINs repeat (e.g. `1005020` appeared twice in a 3-row sample), most
    likely one row per crossing-feature record (see `FEATURE_NUMBER`/`OVER_UNDER_ON_CODE`), not
    duplicate bridges. Needs a real dedup pass before treating BIN as a primary key.
  - `LATITUDE`, `LONGITUDE` (Real) — also mirrored in the point geometry itself.
  - `COUNTY`, `REGION` — NYSDOT region/county.
  - `CARRIED` (String) — the road the bridge carries (e.g. `"US6"`, `"WARREN RD"`).
  - `CROSSED` (String) — what's underneath (stream, another road, etc.) — not always a road name
    (e.g. `"TRIBUTARY INDIGOT CREEK"`), so not usable for segment matching on its own.
  - `FHWA_CONDITION_STATUS` (String, e.g. `"Fair"`), `ConditionRating` (Float),
    `GENERAL_RECOMMENDATION` (Integer) — bridge condition.
  - `YEAR_BUILT`, `AADT`, `YEAR_OF_AADT`, `DAILY_TRUCK_TRAFFIC____` — traffic/age context.
  - **`LinkLength`** (Real), alias **"Approx. Detour Miles"** — a pre-existing rough detour-distance
    estimate already in the source data. Worth comparing our computed result against this as a
    sanity check once we have real numbers (values seen so far: `16`, `0`, `0` — a `0` likely means
    "not computed"/"no detour needed", not an actual zero-mile detour; needs checking against more
    rows before trusting that assumption).

## Process

### Phase 1 — Segment matching (bridge point → conflation network edge)

For each bridge (deduped by `BIN` first — see Open Questions), resolve which edge (`ogc_fid`) in
the conflation network (`data-types/routing`'s conflation view, e.g. view 3699 — same one the
detour plugin already uses, see `DEFAULT_CONFLATION_VIEW_ID` in
`src/themes/transportny/components/detour/constants.js`) the bridge actually sits on.

Proposed approach: a direct SQL nearest-edge query against the conflation view's edges table,
mirroring the existing `snapToNearestNode` pattern in `data-types/routing/index.js` but for edges
instead of nodes:

```sql
SELECT ogc_fid, highway, from_node, to_node,
       ST_Distance(wkb_geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326)) AS dist_deg
  FROM {edgesTable}
  ORDER BY wkb_geometry <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
  LIMIT 5;
```

Take the nearest match within a distance threshold (needs deciding — see Open Questions), and
where multiple close candidates exist, prefer the one whose `highway`/name context is consistent
with `CARRIED` if that's feasible to check cheaply. Flag/report bridges with no edge within the
threshold as **unmatched** rather than silently guessing.

Output of this phase: a mapping `BIN -> { ogc_fid, matchDistanceM, ...bridge fields }`, plus a
separate list of unmatched bridges to report back.

### Phase 2 — Batch detour computation (reusing existing "normal mode" logic)

For each matched `ogc_fid`, run the exact same sequence the simple detour mode's UI already
triggers per segment, as a batch script that requires `data-types/routing/memoryGraph.js` directly
(no HTTP round trip needed — same process, load the graph once via `getOrLoadGraph`, then loop):

1. `resolveDetourEndpoints(graph, ogcFid)` → `{ start, end }` (uses `walkToFirstBranchSimple`
   under the hood — same one-hop-past-the-branch rule already tuned this session).
2. `findRoute(db, graph, start, end, "distance", "dijkstra", [ogcFid])` and the equivalent OPEN
   (unexcluded) search, for **both directions** (Start→End and End→Start) — same 4 searches
   `useTrspRoute.js` already does client-side per segment (open/closed × 2 directions).
3. Record: both directions' route geometries (closed/detour and open/baseline), `deltaMiles`,
   `deltaDurationS`, edge count, and whether either/both directions had **no route at all** (a
   real, valid outcome — an isolated bridge with no detour option, not an error to hide).

This is new code — a one-off script, not a new plugin feature — but it's a thin orchestration
layer over functions that already exist and are already tested live this session
(`resolveDetourEndpoints`, `findRoute`). No new routing algorithm work should be needed here.

### Phase 3 — GeoPackage assembly

Build two GeoJSON `FeatureCollection`s from Phase 1+2's output, then combine into one `.gpkg` with
GDAL (`ogrinfo`/`ogr2ogr` already confirmed installed):

1. **Base layer** (points) — one feature per matched bridge: the bridge's own point geometry, plus
   `BIN`, `CARRIED`, `CROSSED`, `COUNTY`, `ogc_fid` (the matched segment), `FHWA_CONDITION_STATUS`,
   `ConditionRating`, `AADT`, and the source's own `LinkLength` ("Approx. Detour Miles") for
   comparison against what we compute.
2. **Detour routes layer** (lines) — one feature per (bridge × direction) that had a real detour
   route, i.e. up to 2 rows per bridge (Start→End, End→Start): the closed/detour route geometry,
   `BIN` (foreign key back to the base layer), direction, `deltaMiles`, `deltaDurationS`, edge
   count. Bridges with no route in a given direction simply have no row for that direction (not a
   null-geometry row).

Combine via `ogr2ogr -f GPKG output.gpkg base.geojson -nln bridge_candidates` then
`ogr2ogr -f GPKG -update -append output.gpkg routes.geojson -nln detour_routes` (two-step append,
standard GDAL pattern for multi-layer GeoPackages from separate GeoJSON sources).

### Phase 4 — Spot-check / QA

Before treating the output as final: pick a handful of bridges (a mix of urban/rural, matched at
different distances, at least one where `LinkLength` in the source data is non-zero) and verify
live in the mapeditor detour plugin that the same segment, clicked manually, produces the same
route/numbers as the batch script computed for it.

## Open questions (need answers before/while implementing)

- **BIN dedup**: multiple rows can share a `BIN`. Confirm whether to (a) process every row as its
  own bridge-candidate regardless of BIN, or (b) dedup to one row per BIN first (and if so, which
  row wins when they differ — e.g. `MINIMUM_VC_UNDER__FT_` differed between the two BIN `1005020`
  rows in the sample).
- **Match distance threshold**: how close must the nearest conflation edge be to count as a real
  match? Needs a real number (meters), likely informed by looking at the actual distance
  distribution across all 395 points once computed, not guessed up front.
- **Match disambiguation**: is nearest-geometry alone good enough, or should `CARRIED` road-name
  text be cross-checked when multiple edges are within the threshold (e.g. an overpass with two
  nearby-but-different roads)?
- **Route selection**: batch-compute the `shortest` (distance) objective only, or also `fastest`
  (time)? The UI shows both; doubling the batch run is cheap either way (already 4 searches per
  bridge, this would make it 8).
- **Output location/naming**: where should the final `.gpkg` live — repo root next to the source
  zip, `scratchpad/`, or somewhere in `data-types/routing/` as a reusable artifact? Not yet decided.
- **`LinkLength` semantics**: confirm what `0` actually means in the source data (no detour
  computed vs. a genuine near-zero detour) before using it as a sanity-check baseline.

## Files likely involved

- **New**: a one-off Node script (working name `scripts/bridge-candidates/compute-detour-batch.js`
  or similar — exact location not yet decided) that `require`s `data-types/routing/memoryGraph.js`
  directly, does the SQL nearest-edge matching, loops the batch, and writes the two GeoJSON files.
- **Read-only, reused as-is**: `data-types/routing/memoryGraph.js` (`getOrLoadGraph`,
  `resolveDetourEndpoints`, `findRoute`), `data-types/routing/index.js` (`getDataTable` pattern for
  resolving the conflation view's table names).
- **Input**: `Potential_Bridge_Candidates.gdb.zip` (repo root, already extracted once to
  `/tmp/.../scratchpad/bridge_candidates/` for inspection this session — not committed anywhere).

## Testing checklist

- [ ] Segment-matching distance distribution reviewed across all 395 bridges (histogram/spot list)
      before locking in a threshold.
- [ ] Unmatched-bridge list reviewed — is the count reasonable, or does it suggest a bug in the
      matching query?
- [ ] Batch detour computation spot-checked against the live UI for >=3 bridges (Phase 4).
- [ ] Final `.gpkg` opens correctly in QGIS (or `ogrinfo -al -so`) with both layers present and the
      expected feature counts.
- [ ] `BIN` foreign-key linkage between the two layers verified (every route row's `BIN` exists in
      the base layer).
