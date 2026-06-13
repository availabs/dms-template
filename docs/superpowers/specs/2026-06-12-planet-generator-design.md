# Plausible Planet Generator — Design

**Date:** 2026-06-12
**Location:** `references/osan/`
**Status:** Design — awaiting implementation

## Purpose

Generate batches of plausible, Earth-like planet maps for a game, driving Torben Mogensen's
`planet` generator (compiled at `references/osan/planet`). "Plausible" means: a good mix of
land and water area, an elevation field, and biomes.

This is **step one** of a longer pipeline. Future steps (explicitly out of scope here):
georeferencing the heightfield into a GeoTIFF DEM, vectorizing coastline/biome boundaries
into GIS layers, and running erosion + hydrography to carve rivers. The design keeps the
DEM-ready raster output so those steps can build on it without rework.

## Background: the generator

`planet` is a C program (compiled, manual at `references/osan/Manual.pdf`) that produces
bitmap maps from a recursive tetrahedron subdivision. Relevant facts established by testing:

- **Seed** (`-s`): float in `(0,1)`. Determines the world.
- **Water fraction** is governed by `-i` (initial altitude, default `-0.02`). Higher `-i` ⇒
  more land. There is no direct "set water %" flag — you tune `-i` and measure.
- **Water % readout**: the Peters projection (`-pp`) prints `water percentage: N` to **stderr**.
  This is the feedback signal for hitting a target water fraction.
- **Heightfield** (`-H`): prints raw integer altitudes (~±1.2e6), row-major, whitespace-separated.
  Points outside the planet = 0 (irrelevant for the square projection, which fills the grid).
- **Square projection** (`-pq`): equidistant cylindrical / plate carrée. Uniform lon/lat grid,
  full world is 2:1 (width 2× height). Correct basis for both a world preview and a future DEM.
- **Biomes** (`-z`): Whittaker-diagram biomes (ice, tundra, grasslands, taiga, desert, savanna,
  temperate/tropical forests and rainforests, xeric shrubland) from latitude, altitude, and
  approximated rain shadow. Sea uses the color map; land uses biome colors.
- **Color schemes**: `Olsson.col` (default), `greyscale.col`, etc. via `-C file`.
- **Shading**: `-B` bumpmap relief (forces 24-bit color).
- **Output**: uncompressed BMP (default), PPM (`-P`), XPM (`-x`). No PNG natively.

## Tooling on this machine

- C toolchain: `gcc` 13 — binary already compiled (`make` succeeds).
- **GDAL** CLI: `gdal_translate`, `gdal_polygonize.py`, `gdalinfo`. Used for BMP→PNG conversion
  now (`gdal_translate -of PNG`) and georeferencing later. This is the "GIS tool to convert
  the data."
- Node (`/usr/local/bin/node`), Python3 + numpy + Pillow. **No ImageMagick.**

Implementation language: **Node/JS (ESM)**. Standalone tool in `references/osan`, independent
of the dms-template React app. Shells out to `planet` and `gdal_translate`.

## What the script does

### Plausibility via water-percentage search

For each seed, before rendering, run a binary search on `-i` at low resolution using the Peters
readout, until the measured water % falls in the target band (default **60–75%**).

- Probe command: `./planet -pp -s <seed> -i <i> -w <probeW> -h <probeH> -o <tmp>` →
  parse `water percentage: N` from stderr.
- Search `-i` over a bounded interval (e.g. `[-0.10, 0.10]`); water % is monotonically
  **decreasing** in `-i` (higher `-i` ⇒ more land ⇒ less water), so binary search converges.
  Cap iterations (e.g. 12).
- If the band can't be reached within the interval/iterations, **reject** the seed (log it) and
  move on. Rejection rate is reported so the hit rate is visible.
- Probe resolution is small (e.g. 300×190) for speed; the found `-i` is reused at full size.

Elevation distribution and biomes are intrinsic to the generator and need no search — but the
metadata records the measured water % so each planet is auditable.

### Per-planet outputs

Each accepted planet gets its own folder (named by seed, sanitized) under `--out`, containing:

| File | How | Purpose |
|------|-----|---------|
| `topo.png` | Olsson colors, `-pq`, `-B` bumpmap | World preview with relief (like `osan.topo` sample) |
| `biome.png` | `-z`, `-pq` | Biome map preview |
| `height.png` | `greyscale.col`, `-pq` | Grayscale heightmap, directly usable as a DEM image |
| `heightfield.txt` | `-H -pq` | Lossless integer altitude grid — DEM substrate for future georeferencing/erosion |
| `meta.json` | — | seed, final `-i`, measured water %, width/height, projection, and the exact `planet` command lines used |

BMP→PNG conversion is done with `gdal_translate -of PNG <bmp> <png>`.

All renders use the **square projection** at `--size` width × `--size/2` height (full world, 2:1).

### Invocation

```
node generate.mjs --count 10 --size 1024 --water 60-75 --out ./planets [--seed-start <n>]
```

- `--count N` — number of *accepted* planets to produce.
- `--size W` — output width in px (height = W/2).
- `--water LO-HI` — target water % band (default `60-75`).
- `--out DIR` — output root (default `./planets`).
- `--seed-start N` — optional: derive sequential reproducible seeds from N instead of random.

Every emitted planet is reproducible: `meta.json` carries the seed and the exact commands.

## Module structure

Small, single-purpose modules so the tool can grow into the erosion pipeline:

- `planet-cli.mjs` — builds and executes `planet` invocations; captures stdout/stderr.
- `water-search.mjs` — binary search on `-i` against the Peters water-% readout.
- `render.mjs` — produces the per-planet artifacts (planet runs + `gdal_translate` conversions).
- `generate.mjs` — CLI entry: arg parsing, seed generation, batch loop, folder + metadata writing.

Each module has one clear responsibility, a small interface, and depends only on the layer
below it (`generate` → `render` → `planet-cli`; `water-search` → `planet-cli`).

## Error handling

- Missing `./planet` binary or `gdal_translate`: fail fast with a clear message at startup.
- Seed that can't reach the water band: rejected, logged, batch continues to the next seed.
- `planet` non-zero exit or unparseable stderr: surface the command + stderr, skip that planet.
- Output folder collisions: skip or error (don't silently overwrite existing planets).

## Testing

- **water-search**: monotonicity assumption holds — assert the search converges into the band
  for a known-good seed, and reports rejection for a degenerate interval. Mock `planet-cli` to
  avoid invoking the binary in unit tests.
- **planet-cli**: argument-building is pure and unit-testable; one integration test runs the
  real binary at tiny resolution and asserts a BMP is produced and water % parses.
- **render/generate**: integration smoke test — generate 1 small planet, assert all five output
  files exist and `meta.json` round-trips the seed.

## Out of scope (future steps)

- Georeferencing `heightfield.txt` → GeoTIFF (EPSG:4326 plate carrée) via GDAL.
- Vectorizing coastline and biome polygons (GeoJSON via `gdal_polygonize.py`).
- Erosion and hydrography (river carving) on the DEM.
