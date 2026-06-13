# WorldEngine Planet Generator — Design

**Date:** 2026-06-13
**Location:** `references/osan/`
**Status:** Design — approved, ready for implementation plan

## Purpose

Add a second plausible-planet generator driven by **WorldEngine** (plate-tectonics simulation)
alongside the existing fractal **Planet** generator. WorldEngine produces coherent continents and
linear mountain belts (the realism the fractal generator structurally cannot), and already includes
erosion, rain-shadow, rivers, and biomes.

The existing Planet code stays **intact**. The plausibility gates are **shared**, not duplicated.

## Background: WorldEngine (verified locally)

Installed via `uv` into `references/osan/.venv-we` (managed CPython 3.12; deps numpy, protobuf,
pyplatec, noise, pypng). HDF5 is unavailable, so worlds save as **protobuf** `.world`.

- **CLI:** `worldengine world -s <int> -x W -y H -q <plates> --ocean_level L -o DIR -n NAME -r --sat --ice`
  emits PNG maps (elevation, grayscale, biome, ocean, satellite, icecaps, precipitation,
  temperature, rivers) plus a `.world` protobuf. ~3.5s at 256×128; cost scales with W×H·plates.
- **Seeds are integers** (not 0–1 floats).
- **Raw data:** `from worldengine.model.world import World; World.open_protobuf(path)` exposes
  `layers['elevation'].data` (float64 grid), `layers['ocean'].data` (bool), `layers['biome']`,
  rivers/precip/temp, and the sea-level threshold `layers['elevation'].thresholds[0]` (`('sea', L)`).
- **Output is equirectangular** (plate carrée) — identical framing to the Planet path's square
  projection, so `analyze.mjs` gates and the DEM map over directly.
- **Resolution-dependent simulation:** a different `-x/-y` yields a different world, so analysis and
  final output must use the **same size** (cannot gate at small size then render large).

## Architecture

Node orchestrates; a two-script Python bridge runs WorldEngine in the venv.

```
generate-we.mjs ── batch loop, gates, meta  (Node)
  ├─ imports analyze.mjs            ← SHARED gates (polar, continents, concentration, seam)
  ├─ imports parseWaterBand         ← SHARED (pure) from generate.mjs
  └─ lib/worldengine.mjs            ← wraps the venv python + the two helpers
        ├─ py/we_generate.py        ← simulate → <seed>.world + landmask.txt + meta JSON
        └─ py/we_render.py          ← load .world, np.roll by seam, draw PNGs + heightfield.txt
```

### Flow per seed (one simulation per attempt)
1. **Phase 1** `we_generate.py --seed N --width W --height H --plates Q --ocean-level L
   --out-world <path> --landmask <path>`: simulate, save `<path>.world`, write `landmask.txt`
   (row-major 0/1 from `~ocean`), print JSON `{width,height,waterPct}` to stdout.
2. **Node gates** on the mask (all from `analyze.mjs` + the water band):
   - water band (gate-only): reject if `waterPct` outside `--water`.
   - polar land: `polarLandFraction` > `--polar-max` within `--polar-lat` → reject.
   - continent count: `countContinents().count` outside `[--min-continents, --max-continents]` → reject.
   - land concentration: `countContinents().concentration` < `--land-concentration` → reject.
   Rejections delete the `.world` and are logged; the loop continues.
3. **Accept:** `bestSeamColumn(mask)` → roll offset (columns). **Phase 2**
   `we_render.py --world <path> --roll <cols> --out-dir <dir>`: load `.world`, `np.roll` every layer
   on axis=1 by the offset (longitude shift is latitude-invariant, so all layers stay correct),
   draw the map PNGs, and dump the rolled elevation as `heightfield.txt`. Node writes `meta.json`.

### Outputs per world — `out/we_<seed>/`
`satellite.png`, `elevation.png`, `biome.png`, `ocean.png`, `grayscale.png` (heightmap),
`rivers.png`, `heightfield.txt` (rolled elevation, the DEM substrate), `meta.json`
(seed, plates, oceanLevel, waterPct, longitude/roll, the shared analysis block —
polarNorth/South, continents, concentration, continentSizes — width/height, projection
`equirectangular`, and both Python command lines).

## CLI

```
node generate-we.mjs --count 5 --size 512 --plates 10 --ocean-level 1.0 \
  --water 60-75 --polar-lat 20 --polar-max 0.12 \
  --min-continents 4 --max-continents 7 --land-concentration 0.85 \
  --seed-start 1000 --out ./planets-we
```

- WorldEngine-specific: `--plates` (default 10), `--ocean-level` (default 1.0; raise → more ocean,
  the lever for the water distribution since water is gate-only), `--size` (width; height = W/2;
  keep modest — sim cost scales with size²·plates), `--seed-start` (integer seeds; reproducible).
- Shared gate flags identical to the Planet path: `--water`, `--polar-lat/-max`,
  `--min/max-continents`, `--continent-min`, `--land-concentration`.
- Random mode (no `--seed-start`): random integer seeds.

## Shared / new / untouched

- **Shared:** `analyze.mjs` (verbatim — gates are generator-agnostic), `parseWaterBand` imported
  from `generate.mjs` (importing is side-effect-free; its `main()` runs only under the `isMain` guard).
- **New:** `generate-we.mjs`, `lib/worldengine.mjs`, `py/we_generate.py`, `py/we_render.py`.
- **Untouched:** `generate.mjs`, `lib/planet-cli.mjs`, `lib/water-search.mjs`, `lib/render.mjs`.

## Design decisions (locked)

- **Architecture A** (Node + thin Python bridge, shared gates) over a Python-native port — keeps
  one source of truth for plausibility and leaves the Planet generator intact.
- **Water is a gate, not a search** — WorldEngine derives ocean/biomes from sea level at generation
  time, and re-simulating per probe is too slow; `--ocean-level` shifts the distribution, out-of-band
  worlds are rejected.
- **Seam optimization included now** — reuse `bestSeamColumn`; the roll is applied in Python via
  `np.roll` before drawing (two-phase generate→render).
- **DEM via text grid** — dump elevation as `heightfield.txt` (like the Planet path), georeference to
  GeoTIFF later with system GDAL; consistent with the planned GIS step.

## Error handling
- Missing `.venv-we` or `worldengine` → fail fast with the uv setup command.
- Phase-1 non-zero exit or no `.world` produced → surface stderr, skip that seed.
- Output folder collision → skip (don't overwrite an existing world).

## Testing
- Gates already covered by `analyze.test.mjs` (shared, unchanged).
- `lib/worldengine.mjs`: one integration test — generate a tiny world (64×32, few plates), assert the
  returned `landmask` grid has the right length and `waterPct` is 0–100.
- `generate-we.mjs`: one smoke test — relaxed gates, tiny size, `--count 1`; assert the world folder,
  `meta.json`, `heightfield.txt`, and at least `satellite.png` + `biome.png` exist.
- No Python test framework added; the Python helpers are exercised through the Node integration tests.

## Out of scope (future)
- Georeferencing `heightfield.txt` → GeoTIFF; vector boundaries; using WorldEngine's own erosion
  outputs (rivers/precip) downstream. WorldEngine already simulates erosion/rivers, so the separate
  erosion milestone may be reduced to consuming its outputs.
