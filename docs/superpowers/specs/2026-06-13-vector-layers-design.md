# Vector Layers (Landmass + Biomes) → DuckDB → MVT — Design

**Date:** 2026-06-13
**Location:** `references/osan/`
**Status:** Design — approved, ready for implementation plan

## Purpose

Generate high-fidelity **landmass** and **biome** vector polygons for a generated planet, store them
in a per-planet DuckDB database, and serve them as **MVT vector tiles** from the tileserver, drawn
over the raster layers with transparency.

## Decisions (locked with the user)

- **Chunked generation** (the perf/fidelity win): a cheap global pass *finds* the landmasses
  (coastlines are non-local), then each landmass is re-rendered at high zoom *individually* for both
  its coastline and biomes (biomes are local + deterministic, so per-chunk renders match a global
  render exactly — verified via Planet's zoom consistency). Skips the ~78% ocean and lets small
  islands render at far higher zoom than a single global render could afford.
- **Budget-driven with flags:** default `--budget 10` (minutes) → ~1.0–1.3 km/px global-equivalent
  (≈ z7); overridable with `--global-res`, `--chunk-gsd`, `--max-chunk-px`.
- **Storage:** per-planet `planets/<id>/vectors.duckdb`, full-resolution geometry (the MVT query
  simplifies by zoom at serve time).
- **Serving:** DuckDB v1.4+ native MVT (verified: 1.5.3). Tileserver gains an MVT route; the page
  draws the vectors over the rasters with transparency.

## Verified facts

- `-z` biome render rate ≈ **2.2 µs/px** (74 s @ 8192×4096). classify + polygonize are ~free.
- Biome model (temp/rain/rain-shadow) is per-point/deterministic → chunkable; only the coastline is
  non-local (needs the global mask).
- DuckDB 1.5.3 + `spatial`: MVT pipeline works with the DuckDB-specific form —
  `bounds = ST_Extent(ST_TileEnvelope(z,x,y))` (BOX_2D); filter `wkb_geometry && ST_Transform(ST_TileEnvelope(...),'EPSG:3857','EPSG:4326')`;
  `ST_AsMVTGeom(ST_Transform(geom,'EPSG:4326','EPSG:3857'), bounds, 4096, 64, true)`;
  `ST_AsMVT(m, 'layer', 4096, 'geom', 'ogc_fid')` (row alias as struct).

## Part A — Generation

New tool `vectors.mjs --from planets/<id>` → `lib/vectors.mjs` → `py/vectors.py` (`.venv-hydro`:
pysheds-era venv + numpy, rasterio, duckdb).

**Phase 1 — discover landmasses (cheap, global):** render a plain land/sea field
(`planet -H -pq -N` with the planet's `regen`, at `--global-res`, default ~8192×4096) → `alt>0`
mask → `scipy.ndimage.label` (8-connectivity) → for each component above a minimum size: its lon/lat
bbox (in the planet's display frame, i.e. rendered with `-l regen.longitude`). Small components below
the floor (≈ discovery-pixel size) are dropped (noted limitation: islands smaller than the discovery
resolution aren't found).

**Phase 2 — per-landmass high-res `-z` chunk (the fidelity):** for each landmass bbox
`[lonMin,lonMax]×[latMin,latMax]`:
- chunk size `chunkW = round(Δlon/gsdDeg)`, `chunkH = round(Δlat/gsdDeg)`, capped at `--max-chunk-px`
  (step gsd down for that chunk if over cap); magnification `m = 360/Δlon`; center = bbox centre.
- render `planet -pq -z -C 2col.col -N -l (cLon+regen.longitude) -L cLat -m m -w chunkW -h chunkH`.
- classify pixels by the 11 `default.bio` RGBs → class raster (0 = ocean/non-land).
- polygonize **in-process** with `rasterio.features.shapes` using the chunk's geotransform
  (`from_origin(lonMin, latMax, gsdLon, gsdLat)`), so coords come out in display lon/lat:
  - land = `class>0` → landmass polygons; biome classes 1–11 → biome polygons (ocean = class 0 is
    skipped, so biomes never bleed into the sea — no clipping needed).
- accumulate features across all chunks.

**Budget → gsd:** with the measured `-z` rate `R≈2.2 µs/px` and land-bbox coverage `cov` (measured
from Phase 1), pick `gsdDeg` so `cov × (360/gsdDeg)×(180/gsdDeg) × R ≈ budget − overhead`.
`--chunk-gsd`/`--global-res` override the auto-derivation.

**Load into DuckDB** (`planets/<id>/vectors.duckdb`), via `duckdb` python + `ST_Read` of the two
accumulated GeoJSON files:
- `landmass(ogc_fid INTEGER, wkb_geometry GEOMETRY)`
- `biomes(ogc_fid INTEGER, biome_class INTEGER, biome_name VARCHAR, wkb_geometry GEOMETRY)`
Geometry in EPSG:4326. Record `meta.json.vectors = { budget, globalRes, chunkGsd, landmasses, ... }`.

## Part B — Serving + display

**Tileserver MVT route** (`server.mjs`): `GET /tiles/:planet/vector/:layer/:z/:x/:y.mvt`
- opens `planets/:planet/vectors.duckdb` (node `@duckdb/node-api`, `LOAD spatial`; connection pooled
  per planet), runs the verified MVT query against the `:layer` table, returns the MVT BLOB with
  `Content-Type: application/vnd.mapbox-vector-tile`. Disk-cache like raster tiles
  (`.tilecache/:planet/vector/:layer/z/x/y.mvt`). 204 for empty tiles.
- zoom-based simplify in the query: `ST_Simplify(wkb_geometry, 0.0001 * 2^(14−z))` for `z<14`, else raw.

**Page** (`public/index.html`): add a `vector` source per layer
(`/tiles/<planet>/vector/<layer>/{z}/{x}/{y}.mvt`) and layers **above** the raster/hillshade:
- `biomes`: `fill`, color by `biome_class` (a match/step expression → the 11 biome colors),
  `fill-opacity` ~0.35 (transparency so the raster shows through).
- `landmass`: `line`, thin semi-opaque coastline stroke.

**Node DuckDB:** install `@duckdb/node-api` in `tileserver/` (must read the 1.5.3 file the generator
writes — pin a compatible version; verified at implementation).

## Flags

`vectors.mjs --from <dir> [--budget 10] [--global-res 8192] [--chunk-gsd <km>] [--max-chunk-px 4096]
[--min-landmass-cells N] [--out <dir>]`.

## Error handling
- Missing `.venv-hydro`/duckdb/`planet`/meta → fail fast with setup hint.
- A chunk that fails to render → log + skip that landmass (don't abort the batch).
- MVT route: missing `vectors.duckdb` → 404 with "run vectors.mjs first".

## Testing
- **Unit (py):** chunk-geometry math (`bbox → center/magnification/chunkW/H`) for known bboxes;
  biome RGB→class mapping is exact for the 11 colors. terrarium-style pure checks.
- **Integration (py):** run the generator on a tiny planet at a small budget → assert
  `vectors.duckdb` has `landmass` and `biomes` tables with > 0 rows and valid geometry.
- **Tileserver:** request an `.mvt` tile over land → 200, non-empty protobuf; a second request is
  cache-served. (node:test against an ephemeral server, like the raster integration test.)

## Out of scope (future)
- Endorheic/other layers; coastline cleanup/smoothing; islands smaller than the discovery resolution;
  reprojecting vectors (stored in 4326, transformed at serve time); multi-planet shared DB.
