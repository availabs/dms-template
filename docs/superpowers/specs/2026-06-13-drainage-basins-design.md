# Drainage Basins — Design

**Date:** 2026-06-13
**Location:** `references/osan/`
**Status:** Design — approved, ready for implementation plan

## Purpose

Delineate drainage basins (and a river network) from a generated planet's heightfield DEM. This is
the foundation for the later erosion/hydrography work and for drilling into "basins of interest" at
higher zoom. Computed on demand for a chosen planet, not as part of every generate run.

## Decisions (locked with the user)

- **Exorheic only:** fill all depressions so every land cell drains to the ocean (no endorheic
  interior basins in v1).
- **Outputs: basins + rivers.**
- **Resolution: DEM-native 4096×2048** (operate on the planet's `heightfield.txt`).
- **Tooling: pysheds** (richdem — the original pick — has no wheels and its C++ won't build against
  modern compilers/CPython here; pysheds is the purpose-built pure-Python equivalent and installs
  cleanly). Basin labeling in numpy; `gdal` CLI for polygonize/GeoTIFF.

## Architecture

A separate on-demand tool, mirroring `regen.mjs` and the WorldEngine Python-bridge pattern:

```
basins.mjs (Node CLI: --from planets/<id> [--out DIR] [--river-threshold N] [--min-basin-cells N])
  └─ lib/hydrology.mjs   ← wraps the .venv-hydro python + the helper
        └─ py/basins.py  ← pysheds + numpy + gdal
```

Operates on an existing planet's `heightfield.txt` (the 4096×2048 DEM) read alongside its
`meta.json` (width/height). No regeneration needed.

Setup (once): `uv venv references/osan/.venv-hydro --python 3.12 --managed-python` then
`uv pip install --python references/osan/.venv-hydro pysheds`.

## Pipeline (`py/basins.py`)

1. **Load** the heightfield grid (row-major ints, width×height from meta). Sea level = 0;
   ocean = `alt ≤ 0` (base level / drainage target).
2. **Condition (exorheic):** pysheds `fill_pits` → `fill_depressions` → `resolve_flats`, with ocean
   as the spill target, so all land drains to the sea.
3. **Flow direction** (D8, pysheds `flowdir`) + **flow accumulation** (pysheds `accumulation`).
4. **Basin labeling (numpy):** convert the D8 dirmap to a receiver grid (each land cell → its
   downstream neighbor index; ocean = terminal). Pointer-jump (path-doubling) each land cell to its
   terminal coastal outlet, then compact-relabel → one basin id per outlet. Large rivers aggregate
   to large basins; direct coastal runoff forms small basins.
5. **Rivers:** cells with accumulation ≥ `--river-threshold` (default: a small fraction of the map,
   e.g. cells draining ≥ 1000 upstream cells; exact default set during implementation and logged).

## Outputs (into the planet folder)

| File | How | Purpose |
|------|-----|---------|
| `basins.png` | hashed color per basin id, ocean dark | visual basin map |
| `basins.tif` | labeled raster (basin ids), EPSG:4326 plate-carrée geotransform | GIS-ready basin data |
| `basins.geojson` | `gdal_polygonize` on `basins.tif`, optional `--min-basin-cells` filter | basin boundary polygons |
| `rivers.png` | accumulation ≥ threshold, drawn over a land/ocean backdrop | river network preview |
| `flowacc.tif` | flow accumulation raster, EPSG:4326 | data for the later erosion step |
| `meta.json` | updated with `{ basins: {count, riverThreshold, minBasinCells, tool:'pysheds'} }` | provenance |

## Sphere handling (v1 approximation)

- **Longitude seam not wrapped:** the generator places the seam in open ocean (the `bestSeamColumn`
  optimization), so negligible land crosses it; treating columns as non-wrapping introduces minimal
  error. Noted as a refinement.
- **Uniform cells:** no cos(latitude) distance weighting in the D8 slope. Acceptable at low/mid
  latitudes and with minimal polar land; noted as a refinement.

## Georeferencing

GeoTIFFs (`basins.tif`, `flowacc.tif`) are written with the plate-carrée → EPSG:4326 geotransform
(extent [-180,180]×[-90,90]), so they drop straight into GIS and the planned DEM→GeoTIFF pipeline.

## Error handling

- Missing `.venv-hydro` / pysheds → fail fast with the uv setup command.
- Missing `--from` folder or its `heightfield.txt`/`meta.json` → clear error.
- Helper non-zero exit → surface stderr.

## Testing

- **Unit (numpy basin labeling):** a synthetic small DEM with two clear catchments separated by a
  ridge → assert exactly 2 basins and the correct cell partition; a single-outlet DEM → 1 basin.
- **Integration:** generate a tiny planet heightfield, run the full helper, assert `basins.png`,
  `basins.tif`, `basins.geojson`, `rivers.png`, `flowacc.tif` exist and basin count > 0.
- Pure numpy labeling logic is unit-tested without invoking pysheds; the pysheds path is covered by
  the integration test.

## Out of scope (future)

- Endorheic basins / interior lakes.
- Full spherical correctness (seam wrap, cos-lat weighting).
- High-resolution per-basin refinement (drill-down at higher zoom).
- Erosion/hydrography simulation (consumes `flowacc.tif` + the DEM).
