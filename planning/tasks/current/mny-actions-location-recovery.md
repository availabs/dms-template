# MNY actions — recover site coordinates from text (backfill)

**Status:** IN PROGRESS (2026-07-16) · **Type:** data backfill + pipeline follow-up
**Implements:** the `reports/location-from-text.html` findings (scripts 12/13).
**Touches:** `references/actions/` (build + apply scripts, CSV), the **production** actions source
data in `dms-mercury-3` (`dms_mitigat_ny_prod.data_items__s1029065_v1074456_actions_revised`,
type `actions_revised|1074456:data`, source 1029065 / view 1074456).

## Goal

Turn the recoverable location signal the report found into an actual dataset improvement: extract /
geocode site coordinates from each action's text and write them into the field the
`actions_location` pass already reads, so the next run places those actions at **precision 1**
instead of a centroid.

The pass reads coordinates only from `geometry_lat_long_polygon_etc` (rung 1) and geocodes
`address_if_available` (rung 2) — see `data-types/mny/actions_location/utils/{checkForPoint,geocode}.js`.
So writing the recovered coordinate into `geometry_lat_long_polygon_etc` needs **no pipeline code
change** to take effect.

## Plan

### Phase 1 — Build the update CSV  *(this task)*
`references/actions/scripts/14_build_location_updates.mjs` → `data/location_updates.csv`.

Scope = actions **not already at precision 1** and whose `geometry_lat_long_polygon_etc` does not
already parse to a coordinate (don't clobber). For each, take the strongest **high-confidence** signal:

- **Tier A — explicit coordinates** in any text field (name / description / problem / geometry / address):
  parse, NY-bounds-check, no geocoding. (Includes the 16 the pipeline ignores today because rung 1
  only reads the geometry field.)
- **Tier B — street address**: extract, add the action's town, geocode via the **Census** service the
  pipeline uses; keep NY matches.
- **Tier C — intersection**: extract, attempt Census geocode; keep NY matches.

Deferred (need town-scoped road geocoding / a POI gazetteer — the report's tier D/E): numbered routes,
named roads, named facilities. **Not written** in this pass.

CSV columns: `action_id, tier, method, confidence, source_field, matched_text,
geometry_lat_long_polygon_etc (new), address_if_available (new), lon, lat, dist_from_centroid_km`.
- `geometry_lat_long_polygon_etc (new)` = `"<lat>, <lon>"` (preserving any existing non-coordinate
  text by appending it) — what the pass parses to a precision-1 point.
- `address_if_available (new)` = the extracted address string, **only when** the row's
  `address_if_available` is currently blank **and** the coordinate came from geocoding an address.

### Phase 2 — Apply script  *(this task, dry-run only until approved)*
`references/actions/scripts/15_apply_location_updates.mjs` — reads the CSV, patches each action row's
`data` JSONB in `dms-mercury-3` via `jsonb_set` (`geometry_lat_long_polygon_etc`, and
`address_if_available` when blank).
- **Dry-run by default**; `--apply` required to write; **backs up** the current values of affected
  rows to `data/location_updates_backup.json` first.
- Re-reads current values at write time; skips any row whose geometry field already parses to a
  coordinate (idempotent, no clobber).
- **Will not be run with `--apply` without explicit owner approval** — it mutates production actions data.

### Phase 3 — Re-run + verify  *(after approval)*
Re-run the `actions_location/publish` pass → new view; confirm precision-1 count jumps from 74 and
the backfilled actions moved off their centroid.

## Follow-ups (separate)
- Pipeline enhancement: have rung 1 (`checkForPoint`) also read name/description/problem for embedded
  coordinates, so *future* actions with coords in prose are placed without a backfill.
- Tier D/E resolvers (town-scoped road geocode + NYS GIS street/parcel/POI gazetteer) for the ~5,100
  medium/candidate actions.
- Long term: capture address/coordinates at intake (the only fix for the 11,360 no-signal actions).

## Results (2026-07-16)

**Phase 1 DONE** — `scripts/14_build_location_updates.mjs` → `data/location_updates.csv`.

Now uses the **NY State geocoding service** (gis.ny.gov) per the owner's request, which unlocked the
road tiers the Census geocoder can't do:
- Addresses → NYS `Street_and_Address_Composite` (great rural coverage), Census one-line fallback.
- Routes + named roads → NYS `Street_NoNum_and_ZipCode_Composite` (geocodes a street NAME, no house
  number needed), score ≥ 90.
- Intersections → Census (NYS locators don't return intersections).
- **Gate loosened** (owner: trade safety for coverage) to ≤25 km (p3) / ≤75 km (p4).

Scanned 18,068 non-precision-1 actions; geocoded 3,908 candidates + 116 explicit coords. Recovered
**2,528**; after the gate **2,399 apply-ready**, 129 review:

| Tier | Apply | Confidence | Geocoder |
|---|--:|---|---|
| A · explicit coords | 113 | high | parse |
| B · street address | 216 | high | NYS address (207) + Census (9) |
| C · intersection | 118 | medium | Census |
| D · numbered route | 255 | medium | NYS street-name |
| D · named road | 1,697 | **low** | NYS street-name |

`address_if_available` filled on **199** (was blank). Apply-set median move **3.93 km** (max 69.4).

**Caveat — the named-road tier (1,697) is the soft one.** Generic street names ("South Street",
"Richmond Avenue") match at score 100 even when it's the wrong same-named road in the county; the gate
keeps them in-county (p90 = 13 km) but the tail is uncertain. High+medium confidence = **702**
(A+B+C+D_route); low = 1,697 named roads. Geocoding cached in `data/geocode_cache.json`.

**Phase 2 DONE (script + dry-run only)** — `scripts/15_apply_location_updates.mjs`:
- Dry-run validated: connects to `dms-mercury-3`, matches all 382 rows, plans 382 updates (148 also
  set address), 0 already-coord, 0 not-found; backup of current values written to
  `data/location_updates_backup.json`.
- Reconstructs `geometry_lat_long_polygon_etc` from the coordinate + the **live** field text (not the
  July snapshot); idempotent; transactional.
- **NOT applied to production.** Awaiting owner go-ahead before `--apply` (and confirmation the
  configured `dms-mercury-3` user has UPDATE grant, or route via `dms raw update`).

**Phase 3 PENDING** — after `--apply`, re-run `actions_location/publish`; expect precision-1 to jump
from 74 to ~456.

## Log
- 2026-07-16: task created; Phase 1 + Phase 2 (dry-run) complete; awaiting approval to apply.
