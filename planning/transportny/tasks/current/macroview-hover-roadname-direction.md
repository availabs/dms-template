# MacroView hover popup — roadname + direction via a tile join

**Project:** TransportNY · **Topic:** themes / macroview plugin · **Status: BUILT, hover-only
design, awaiting in-browser confirmation.** · **Started:** 2026-09-18

## Objective

Give MacroView's map hover the same human-readable segment identity `route_creation` got (gap #3,
`report-route-ui-parity-gaps.md`): show **roadname and direction** instead of only a bare TMC code.

The difference from `route_creation`: that plugin's layer is backed by the TMC network shapefile,
which already carries `road`/`direction`, so the fix was one `data-column` string. MacroView's PM3
layer is backed by the **pm3 metrics source**, which has neither — so the columns have to be joined
in at tile-build time.

## What was actually true (investigation, 2026-09-18)

- **The pm3 source genuinely lacks the columns.** Verified against
  `pm3.s2135_v3740_pm3_v6_2025`: no `road`/`roadname`/`direction`. `directionality` exists but
  holds `EVEN_DIST` — an AADT-distribution flag, not a compass heading.
- **The capability already existed and predates the "can't do this" note.** `dataUpdate.jsx` line
  ~157 said road name "needs a network join — pm3-runner task" (written 2026-08-18, commit
  `af056099`). The map tile join landed **2026-06-04** (`8c9bb1c75`, `buildJoinParam`/`tileCols` in
  `SymbologyViewLayer.jsx`) — 2.5 months earlier. The note also named source 1410, but macroview
  moved to source 2135 on 2026-08-24 (`1ec53e3e`), so its source number was stale too.
- **⚠ The stored symbology rows are stale and misled this investigation.** Catalog symbology
  `2100236` and section `2101933` both say source 1410 / view 3425 on `https://graph.availabs.org`.
  The **live** page requests `https://dmsserver.availabs.org/.../tiles/3740/...` (source 2135).
  This matters: avail-falcor's tiles route reads only `cols`/`filter`, silently ignores `join=`,
  and memoizes on a cache key that excludes it — so reasoning from the stored row produces a wrong
  "joins are impossible here" conclusion. dms-server's `tiles.rest.js` does implement the join.
  Always read the real network request first.

## Implementation

> ⚠ **Superseded** by **FINAL DESIGN** at the foot of this file — the
> `tileColumns` / tile-join approach described here was reverted. The join *config* and the
> all-years-view + year-filter reasoning below still apply; only the tile bake is gone.


Both changes are in the plugin, written as **runtime layer props** (not into any stored symbology),
so they track the Year control exactly the way `sources`/`view_id`/`data-column` already do:

- `macroview/constants.js` — new `NETWORK_*` constants (source 582, **all-years** view 984,
  `npmrds2`, join attributes, tile columns) plus the rationale and the fan-out warning.
- `macroview/dataUpdate.jsx` — attaches `layer.join` (guarded on a real 4-digit year) and prepends
  `Road` / `Direction` to `hover-columns`.

**Why the all-years view (984) rather than a year→view map:** one view id serves every year the
Year control offers, and the year travels as a join filter, so there is no second per-year mapping
to keep in lockstep with the pm3 views. Byte-identical output to the per-year view (1312).

### ⚠ The year filter is load-bearing

The tile join supports exactly ONE join key (`normalizeSingleJoinColumn` takes the first of a comma
list), so `tmc` alone against an all-years table matches every year of that TMC. The tile URL's own
`filter=` param does **not** help — it is applied only to the base geometry table's WHERE clause,
never to the joined subquery (see the `tile_geo` CTE in `tiles.rest.js`).

Measured on tile `12/1208/1510`:

| join config | features | verdict |
|---|---|---|
| per-year view 1312, no filter | 503 | correct |
| all-years 984, **no** filter | **4299** | 8.5× fan-out, emitted silently |
| all-years 984, `options.filterGroups` | 503 | correct |
| all-years 984, top-level `year` key | **4299** | silent fan-out |

The constraint this imposes on the code: the year must go through `query.filterRows`, because
`buildJoinFilterOptions` turns filterRows into `options.filterGroups` (applied inside the subquery)
whereas a plain `query.filters` object is spread to the **top level** of the options bag, where the
subquery ignores it. That is the last row of the table — a wrong shape fails with no error.

## Verified (of the original tile-join build — kept for the fan-out evidence)

App-equivalent tile URL (the exact serialization `buildJoinParam` will emit) returns:

```
LAYER view_3740: 503 features, 3 property keys
  KEYS: ['lottr_amp_lottr', 'road', 'direction']
    {'lottr_amp_lottr': '1.21', 'road': 'NY-335', 'direction': 'NORTHBOUND'}
    {'lottr_amp_lottr': '1.02', 'road': 'I-87',   'direction': 'NORTHBOUND'}
```

Measure column and joined identity coexist; tile 26,475 → 29,530 bytes (+11.5%).

## ⚠ TEMPORARY — PM3 tile host override (added 2026-09-18, MUST be reverted)

`dmsserver.availabs.org` was not reliably reachable from the dev machine, and the PM3 tile URL is
an **absolute** url baked into the stored symbology — `getLayerTileUrl` rebuilds only the query
string, never the origin — so the map fetched tiles from that host regardless of the app's own
`API_HOST`, and the network silently failed to draw.

`TILE_HOST_OVERRIDE` in `constants.js` redirects **only the PM3 layer's** tiles (the boundary layers
keep their own hosts). It reads `VITE_TILE_HOST`, falling back to `http://localhost:3001` **in dev
only**, so a production build can never ship pointing at a localhost that does not exist.

**To revert:** set `TILE_HOST_OVERRIDE` to `""`, or delete the const and its single use in
`dataUpdate.jsx`.

Verified before handing over, so a failure now is not the redirect's fault:

- local dms-server serves the PM3 tile at all (`200`, 0.14s — faster than the remote's 0.23s);
- local join output is **byte-identical** to the remote's (29,530b on 12/1208/1510, 91,298b on
  10/302/377) and decodes to correct `road`/`direction` (`CR-55 EASTBOUND`/`WESTBOUND`);
- the origin rewrite preserves the `{z}/{x}/{y}` placeholders and query string and leaves the
  source `id` untouched, and does not match non-dama urls;
- CORS is clean from a `localhost:5173` origin (`Access-Control-Allow-Origin` reflected).

The z10 tile is *slower* locally (13.7s vs 8.45s remote) — same nested-loop pathology below, plus
this machine's own DB latency.

## Next

1. Confirm the popup in the browser: hover a segment, expect **Road** and **Direction** above TMC.
   A brief "Fetching Attributes" flash is expected and pre-existing — the popup already waited on
   that round trip for its base columns.
2. Revert `TILE_HOST_OVERRIDE` once `dmsserver.availabs.org` is reachable again (see above).
3. 2017 note: view 984 covers 2018–2026 while pm3 covers 2017–2025, so a 2017 selection resolves no
   road/direction (blank, not wrong). Per-year view 985 would cover it if that matters.

## FINAL DESIGN (2026-09-18) — hover-only join, no tile join

The first build baked `road`/`direction` into every tile via `join.tileColumns`, following
`routecreation.plugin.jsx`'s "they must be IN THE TILE" reasoning. **That premise did not hold for
this layer, and checking it would have been cheaper than optimizing around it.** Macroview's popup
ALREADY performs an attribute round trip for its own base columns (`tmc`/`county`/`region_code`) on
every hover — visible in the network tab as a `uda/.../dataById/<id>` call. So the tile bake bought
no responsiveness at all; it only made every tile more expensive.

Everything that followed from that premise has been reverted: the `MATERIALIZED` tile-query fix, the
`didJoinChange` rebuild trigger, and the `JOIN_MIN_ZOOM` zoom gate (all of which existed only to
make a tile join affordable). The two library findings are preserved in
`src/dms/planning/tasks/current/joined-tile-nested-loop-fix.md` — both are real bugs with no consumer
today.

**What ships instead:**

- macroview sets `join.hoverOnly: true` and **no `tileColumns`**. The interaction path resolves
  `road`/`direction` from view 984 by `tmc`, riding along with the round trip the popup was making
  anyway. Measured at **51ms** for a single segment.
- One 3-line guard in `SymbologyViewLayer.jsx`'s `buildJoinParam`: `if (joinConfig.hoverOnly) return ""`.
  `layer.join` feeds both the tile-url builder and the interaction path, and a layer wanting only the
  second had no way to say so.

**Why the flag is explicit rather than inferred from an empty `tileColumns`:** a layer may carry no
tile columns and still need the tile join, because `collectActiveJoinFilterGroups` pushes filters on
joined columns into the tile query. Inferring would silently break those.

**Why the guard is needed at all** (an empty `tileColumns` is not free — Postgres cannot plan away an
unused LEFT JOIN over a CTE):

| tile | no join param | `tileCols: []` | `tileCols: [road,direction]` |
|---|---|---|---|
| 12/1208/1510 | 0.122s | 0.133s | 0.134s |
| **6/18/23** | **1.41s** | **30.0s / 0b** | **30.0s / 0b** |

**Tile timings after the revert** (no join param at any zoom): 6/18/23 **1.47s**, 10/302/377
**0.091s**, 12/1208/1510 **0.046s** — versus 30s, 8.45s and 2.13s when the join was in the tile.

**Library footprint: 1 file, 3 lines of logic, purely additive.** `mapChrome.test.js` passes;
`updateFilters.test.js`'s failure is a missing `colorbrewer` package, verified pre-existing by
stashing all changes and reproducing it.
