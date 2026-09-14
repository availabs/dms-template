# `nysdot_estip` — NYSDOT capital-program harvester

Fetches the NYSDOT capital program from three public sources and combines them into **one
project-grain GeoPackage** — one row per project, geometry where it exists, `NULL` where it does not —
so the program is a single dataset instead of three that have to be re-joined every time.

Built for phase 1a of the `work_zone` pipeline
(`planning/transportny/tasks/current/workzone-performance-data-type-pipeline.md`), which needs project
identity and location to decide which work zones belong to *significant projects*.

## Why this is not a data-type plugin

Data-type plugins run inside `dms-server` and write DAMA sources. This is a **one-off harvester**: it
reaches out to third-party services, needs GDAL on the PATH, and produces a file. The file is then loaded
into `npmrds2` through the platform's own CSV/GIS uploader, which is the simple path and keeps `data-types/`
free of an xls/MVT dependency. Re-run it when the STIP refreshes (monthly), then re-load.

## Usage

```bash
cd dms-template/data-types/external-fetchers/nysdot_estip
npm install                     # once
node fetch.js                   # harvest + combine into ./out   (no database)
node resolve_ris.js             # add location tiers from RIS     (reads npmrds2)

node fetch.js --out /tmp/estip     # somewhere else
node fetch.js --steps combine      # re-combine without re-fetching
node fetch.js --keep-going         # tolerate a failed workbook download
node resolve_ris.js --dry-run      # report tiers, write nothing
node resolve_ris.js --ris-view 3637  # a different RIS vintage (3637 = 2025)
```

**Two scripts, deliberately.** `fetch.js` talks only to the internet and produces a file; `resolve_ris.js`
is the only part that touches a database, read-only, and it is what turns text citations into geometry and
tiers. Run them in that order.

Requires **node ≥ 18** (global `fetch`) and **GDAL's `ogr2ogr`** on the PATH (`xls` → csv,
GeoJSON → GeoPackage). Nothing here touches a database.

## What it produces in `out/`

| file | what |
|---|---|
| **`nysdot_capital_projects.gpkg`** | **the deliverable** — one layer, one row per project, mixed geometry (`-nlt GEOMETRY`), EPSG:4326, `ogc_fid` PK, `wkb_geometry`. Rewritten in place by `resolve_ris.js` with tiers and BIN geometry |
| `nysdot_capital_projects.geojson` | the same rows before GDAL — handy for diffing a re-run |
| `grid.json`, `grid_export.xlsx` | the eSTIP project list as fetched (JSON + the portal's own XLSX export) |
| `tiles_Production-NYSDOT-*.ndjson` | one line per decoded tile feature, before de-duplication |
| `workbooks/*.xls`, `workbooks_csv/*.csv` | the 12 region STIP workbooks and their `Project List` sheets |
| `combine_stats.json` | row counts and coverage for the run |
| `credentials.json` | the discovered public keys (cached; delete to re-discover) |

## The four steps

1. **credentials** — both keys are the portal's own *public* values and rotate, so they are discovered at
   harvest time: the `x-system-key` from `…/static/tenants/…/tenantConfig.json` (`systemToken`), and the
   Mapbox `pk.` token from `REACT_APP_GL_MAP_KEY` in the site's JS bundle. The bundle hash changed between
   two fetches on 2026-09-08 alone, which is why nothing is hardcoded.
2. **grid** — `POST /ProjectRevisions/grid` with `{}` returns the whole current STIP unpaged (~3,239 rows),
   one row per project, plus the same table as XLSX.
3. **tiles** — the three Mapbox layers named by `/configurations`, harvested across each tileset's own
   TileJSON bounds at its own `maxzoom` (10 for points, 11 for lines and polygons), decoded MVT → NDJSON.
   Concurrency 6; `404` means an empty tile and is normal; `429`/`5xx` back off and retry.
4. **workbooks** — `R1.xls`…`R11.xls` plus `SW.xls` from `dot.ny.gov/programs/stip/files`, each converted
   with `ogr2ogr` from its `Project List` sheet.
5. **combine** — union of all three key spaces → one row per PIN.

## The join

All three sources key on the **NYSDOT PIN**:

| source | key field | also carries |
|---|---|---|
| eSTIP grid | `actionLink.clientProjectId` | `projectId`, `resourceId` |
| Mapbox tiles | `PROJECT_ID` | `INT_ID` (= `projectId`), `INT_REV_ID` (= `resourceId`), `PROJECT_CA` |
| STIP workbooks | `ID` | `Region`, `County` |

No normalization is needed — the PINs are already zero-padded consistently across all three (verified:
stripping leading zeros and upper-casing gains zero additional matches).

## Notable behaviours

- **Tiles clip geometry at their edges**, so one project arrives as several pieces. Pieces are
  de-duplicated on coordinates rounded to 6 decimal places (features repeat in neighbouring tiles'
  buffers) and merged: same-kind pieces become a `Multi*`, mixed kinds a `GeometryCollection`.
  `geom_pieces` records how many survived, `geom_source` records the tileset and zoom.
- **Geometry is a project footprint, not a lane-closure extent**, and it is simplified to the tile grid
  (≈3.5 m at z11 in NY). Fine for a buffered join to TMCs; not a survey.
- **The workbook sheet repeats its header row** — once for the ogr field names, again as data, and again
  at page breaks — so every row whose first cell is literally `Region` is dropped.
- **A project can appear in only some sources.** `in_estip_grid`, `in_stip_workbook` and `has_geometry`
  say which, per row, and no row is dropped for missing from one of them.
- **`pbf` ≥ 5 exports `PbfReader`**, not a default constructor. `new (require('pbf').PbfReader)(buf)`.

## Output columns

*Identity* `pin` · `project_title` · `estip_project_id` · `estip_resource_id` · `region` ·
`region_from_pin`

*Provenance* `in_estip_grid` · `in_stip_workbook` · `has_geometry` · `stip_cycle` · `region_file` ·
`harvested_at`

*Classification* `mpo` · `lead_agency` · `project_type` · `project_type_id` ·
`project_type_category_id` · `project_category` · `county` · `air_quality` · `plan_revision` ·
`description` · `funding_source` · `fund_types_all` · `tip_year_funding` · `plan_revision`

*Money* `total_cost` · `ffy_2026`…`ffy_2029` · `fund_fhwa` · `fund_fta` · `fund_fa_costs` ·
`fund_state` · `fund_local` · `fund_mta` · `fund_nfa_rollup` · `phase_scoping` · `phase_preldes` ·
`phase_detldes` · `phase_rowincd` · `phase_rowacqu` · `phase_coninsp` · `phase_const` ·
`phase_desconst` · `phase_misc` · `phase_oper` · `phase_vehequip`

*Derived* `construction_amount` (CONST + DESCONST + CONINSP) · `is_construction_funded` ·
`bins` · `bin_count` · `locator_routes` · `locator_county_routes` · `geom_type` · `geom_pieces` ·
`geom_source`

*Location* `location_tier` · `location_method` · `location_resolved_against` — written by
`resolve_ris.js`; see **Location tiers**. `location_tier` is NULL until the resolver runs, which is
distinguishable from `0` ("resolved, and unlocatable").

`locator_routes` tokens are `<signing><number>` — `NY27`, `I495`, or `?145` when the text gave a number
with no signing ('ROUTE 145'), which the resolver then matches on route number alone within the county.

`region` prefers the PIN's own first character (`0` → 10, `X` → 11, letters → statewide/other agency) and
falls back to the workbook's `Region` column; `region_from_pin` is kept separately so the two can be
compared.

## Bridge BINs — the second locator

Only ~31 % of projects carry public eSTIP geometry, but a quarter of construction projects name their
bridges in the description. `bins` (space-separated, never comma — commas are awkward in DMS filter chips
and falcor path keys) and `bin_count` capture those, and a BIN resolves to real roadway geometry through
**RIS Legacy v2** (`gis_datasets.s2105_v3638_ris_legacy_v2`, source 2105 / view 3638 = the 2026 vintage),
whose `bin_number` column holds 17,774 distinct BINs over 27,790 segments at SRID 4326.

Measured on the 2026-09-09 harvest: 608 projects cite a BIN, 869 tokens, **857 resolve (98.6 %)** — the
6 unresolvable projects are railroad-owned bridges (`7…` BINs, not on the state roadway inventory).
That lifts locatable construction-funded projects from 437 (25.2 %) to **779 (45.0 %)**.

The extraction lives here; **the BIN → geometry join belongs in the database**, where RIS lives — this
harvester never queries a DB. A BIN can map to many RIS segments (a long bridge like the Robert Moses
Causeway has 23), so union them per BIN.

Two things the regex earns its keep on: `\bBINS?\b` needs the trailing word boundary or *BINGHAMTON*
yields a phantom BIN of `GHAMTON` (9 false positives before the fix), and a candidate token must carry at
least four digits.

## Location tiers

`resolve_ris.js` assigns every project a `location_tier` and a `location_method`, checking its text
citations against **RIS Legacy v2 2026** (source 2105 / view 3638, overridable with `--ris-view`):

| tier | method | what it is | geometry written? |
|---|---|---|---|
| 1 | `estip_footprint` | the eSTIP map layer's own point/line/polygon for the project | yes |
| 1 | `bin_bridge` | RIS segments carrying a BIN the description cites, unioned per project | yes |
| 2 | `route_county` | RIS has the cited signed route in the project's county | **no** |
| 2 | `county_route` | RIS has the cited county route in the project's county | **no** |
| 0 | *(null)* | nothing resolved | no |

Measured on the 2026-09-09 harvest — all 3,766 projects: tier 1 **1,578 (41.9 %)** · tier 2 289 (7.7 %) ·
tier 0 1,899 (50.4 %). Of the 1,733 **construction-funded** projects: tier 1 **779 (45.0 %)**,
tier 1 or 2 **1,025 (59.1 %)**. By method: `estip_footprint` 1,180 · `bin_bridge` 398 ·
`route_county` 261 · `county_route` 28.

**Tier 2 geometry is deliberately not materialised.** A signed route within a county can be tens of miles
and thousands of RIS segments; writing that onto a project row would read as "this is where the work zone
is" when it only means "this is the corridor it is on". Tier-2 rows keep `locator_routes` /
`locator_county_routes` so the corridor can be joined from RIS on demand — use tier 2 to *confirm or rank*
a candidate project, never to draw an extent.

**Tier 3 (road-name matching) is intentionally not implemented.** It would add ~7 points of coverage, but
spot-checking showed most road-name hits are the project's **endpoint cross street** ("on NY27 *from* the
county line *to* Harrison Ave"), not its own alignment.

Two geometry traps, both hit for real and now guarded:
- `ST_Collect` over MultiLineStrings returns a **GEOMETRYCOLLECTION**, and `ST_Multi` will not flatten it —
  `ST_CollectionHomogenize` is what yields a MultiLineString.
- flat-mapping `.coordinates` across geometries that may not be line-typed silently produced
  `coordinates: [null, null]` for 53 projects. `mergeLines()` now throws on an unexpected type, and
  `validate()` refuses to write if any geometry is empty or contains a null.

## Loading into `npmrds2`

The GeoPackage goes in through the platform's GIS uploader (`.gpkg` is in the accepted
`GIS_EXTS`, and `gdal-async` is installed in `dms-server`). After loading, check the two things that
silently break DAMA layers: geometry values must carry **SRID 4326** (the harvester writes
`-a_srs EPSG:4326`), and the table must have **`ogc_fid`** (written via `-lco FID=ogc_fid`) — then probe a
tile before trusting the layer.

## Measuring the join to work-zone events

`join_transcom.sql` (read-only) measures how well these projects tie to TRANSCOM work-zone events, and
assigns each event a match confidence. Four reports plus an eyeball sample: recall/precision by distance
threshold, ambiguity (candidates per event), per-event confidence, and 20 sampled high-confidence pairs.

Result on Jan–Aug 2026 (68,177 NY work-zone events × 1,578 tier-1 projects): at 250 m, 33.9 % of events
match, precision 70.9 % over decidable pairs, mean 2.24 candidates; per-event confidence A 7.1 % + B 20.7 %
= **27.8 % usable**, with 44.3 % having no project within a kilometre.

Three things to know before trusting a number out of it:
- **Precision must be measured over *decidable* pairs** — those where the project's text cites a route at
  all, which is only 29.3 % of tier-1 projects. Measured over all pairs it is capped at ~29 % by
  construction (this produced a misleading 13 % on the first pass).
- **A spatial match is co-location, not attribution.** 2024 events match this STIP 26-29 dataset *better*
  than 2026 events do — proximity carries no schedule information.
- **Program/blanket PINs** ("INTERSTATE MOWING AND ROADSIDE CLEANUP", "BRIDGE PAINTING SFY 25") have one
  point and no extent, so they match anything nearby; and projects that name a cross street as an endpoint
  ("I-390 … to Rt 33A") match events on that cross street.

## Access notes

The `x-system-key` and the Mapbox `pk` token belong to NYSDOT's vendor, not to us. A full harvest is
~1,380 tile requests plus a handful of API calls — less than a few minutes of somebody panning the map —
but it is still their quota. Harvest once per refresh, never on a schedule tighter than the data changes,
and if this becomes a recurring need, ask NYSDOT for the feed directly. The portal's terms of use have not
been reviewed.
