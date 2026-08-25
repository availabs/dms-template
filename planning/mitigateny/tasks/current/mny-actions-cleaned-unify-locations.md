# `actions_cleaned` — absorb the location waterfall (one unified actions source)

## Status: SHIPPED 2026-08-24 — view `13272` published + verified; owner decisions pending
(11725 delete-vs-freeze · publish cadence · server/frontend deploy carries the descriptor change)

Make **`actions_cleaned` (source `12453`) the single actions source** — geometry included — by
computing the geolocation waterfall **in-process** in its own worker, instead of joining a
snapshot from the separately-published **Actions Location** source (`11725`).

**Why (owner direction, 2026-08-24):** the actions/locations split only ever existed because the
production actions dataset is a DMS-**internal** source (`1029065`, `dms-mercury-3`) and internal
sources can't hold geometry — so locations had to live in their own external `gis_dataset`. Now
that `actions_cleaned` is an external (DAMA) source, geometry can live in the one source. There is
no longer a reason for the split, and the split has real costs (see Current state).

- **Parent task (the plugin this modifies):**
  [`mny-actions-cleaned-source.md`](./mny-actions-cleaned-source.md) — T1–T7 transform ledger,
  output schema, verified baselines against view `13192`.
- **The waterfall being absorbed:** `data-types/mny/actions_location/`
  (doc: `actions_location/actions_location_datatype.md`; spec:
  `planning/mitigateny/tasks/current/actions_location_datatype.md` in the root workspace hub).
- **Downstream dependency:** the **Actions Dashboard live build**
  (`planning/mitigateny/tasks/current/actions-dashboard-live-build.md`, root workspace hub) binds
  to the view this task produces — its Phase 0 is blocked on this task.

## Objective

One publish run of `actions_cleaned` produces a complete, current source: every transform T1–T6
**plus** freshly computed `precision` / `wkb_geometry` for every row — including rows added since
the last Actions Location publish. No consumer needs source `11725` afterwards.

## Scope

**In:**
- Rework the plugin's location stage (`utils/locations.js` + `worker.js` T6) to run the waterfall
  in-process on the worker's own flattened rows.
- Close the **530-row NULL-precision gap** (actions added after view `12463`) as a consequence.
- Keep the recovered-coordinates CSV overlay exactly as shipped.
- Re-publish (new view on source `12453`) + full verification.
- Audit what still consumes source `11725` and write the retirement recommendation.

**Out:**
- Actually deleting/hiding source `11725` or the `actions_location` plugin — owner decision after
  the audit (default: leave untouched, stop consuming — non-destructive precedent).
- Mutating production actions (`15_apply --apply` stays parked, as before).
- The dashboard build itself (separate task, depends on this one).
- Any git commit / deploy — user owns those.

## Current state

- `actions_cleaned` **already carries** `precision`, `wkb_geometry`, `location_method`,
  `location_confidence`, `dist_from_centroid_km` — but its T6 gets them by **joining the static
  table `gis_datasets.s11725_v12463_actions_location_10`** (Actions Location v2, published
  2026-07-14) and then overlaying 671 recovered coordinates from `static/location_updates.csv`.
- **The snapshot skew this causes:** 530 actions added after view `12463` have `precision NULL` /
  no geometry in view `13192`. Fixing that today needs a two-step chain — re-run
  `actions_location` (new view), repoint `actions_cleaned`'s input, re-publish — two workers, two
  COPY exports of the same internal dataset, and a stale-input failure mode in between.
- The waterfall lives in `data-types/mny/actions_location/` (`worker.js` + `utils/`):
  - Rung 1 — action's own coordinates (free-text `geometry_lat_long_polygon_etc`), precision 1.
  - Rung 2 — **Census batch geocoder** on `address_if_available`, precision 2, with a
    `cacheGeocodes` pre-caching step (`utils/geocode.js`) — live network calls, cached.
  - Rung 3/4 — jurisdiction / county centroid (views `2297` NFIP communities / `2157` TIGER),
    precisions 3/4; `utils/GeometryTableCache.js` (string-key coercion — the v1 bug class) +
    `utils/geoids.js` (array `county_geoid`, numeric `geoid_juris`, NYC borough resolution).
  - Precision 5 = statewide **terminal** classifier (not a bypass); 0 = unresolved. NULL geometry
    for 0/5 by design.
- `actions_cleaned`'s worker already streams the same actions rows out of `dms-mercury-3` via COPY
  and flattens them id-last (T1) — i.e. the waterfall's input already exists in-process.

## Proposed changes

### Phase 1 — Absorb the waterfall — DONE 2026-08-24
- [x] Code-sharing shape decided: the four utils moved to
      **`data-types/mny/_shared/location/`** (underscore = clearly not a plugin), plus a new
      **`waterfall.js`** exposing the rung logic as a synchronous per-row resolver
      (`resolveLevel`), the funnel shape (`makeFunnel`), and the centroid-cache builder
      (`buildCentroidCaches`, incl. the NYC ST_Collect synthetic). Chosen over a cross-plugin
      import so `actions_cleaned` never depends on a folder slated for retirement.
      **`actions_location/worker.js` was refactored to call the same resolver** (its six rung
      generators collapsed into one `resolveItems` stage) — one waterfall, zero forks; its
      logging/funnel contract is unchanged.
- [x] `utils/locations.js`: view-`12463` join (`loadLocations`) deleted; new
      `locationFromWaterfall` converts each row's `{level, point}` into the same Map-entry shape,
      so `resolveLocation` (dedup best-of-members + overlay idempotency) is byte-identical.
- [x] Waterfall runs on the **RAW row** inside pass B (before any cleaning — the rungs own the raw
      quirks), populating the `locations` Map as rows stream; geocode pre-cache + centroid caches
      built up front under `actions_cleaned:*` event names. Bonus hardening: `cacheGeocodes` now
      clears its module-level caches per run (the module is shared by two workers in a long-lived
      server).
- [x] CSV overlay unchanged (verified: 671 applied, tier counts exact, 1 already-p1 skip).
- [x] T3-dedup interaction preserved: every input row gets a Map entry, survivors take best
      member precision — same mechanism as before.
- [x] Output schema unchanged; only the `precision` column *description* updated (NULL now
      documented as a pre-2026-08 views artifact). Funnel gained `waterfallByLevel` (per input
      row) + per-rung candidates/misses; `missingFromView` → `missingEntry` (wiring-bug tell,
      must stay 0).
- [x] Descriptor: `locationsView` → `jurisdictionsView` + `countiesView` (+ dry-run-only
      `skipGeocode`); updated `index.js` route validation + source description, `test.js`
      (views 2297/2157, `--skip-geocode` refused on real runs), and `pages/create.jsx` (locations
      picker → the same jurisdictions/counties pickers `actions_location`'s Create page uses).

### Phase 2 — Re-publish + verify — DONE 2026-08-24
- [x] `--dry --skip-geocode` wiring check, then full `--dry` with real geocoding. **The full dry
      run reconciles perfectly against 13192:** p1 159 / p2 586 / p5 236 **exact** (pipeline
      splits 46+113 and 28+558 both exact — Census returned identical matches to July); the 530
      previously-NULL rows redistributed +501 p3, +15 p4, +14 p0 (sums to 530 exactly); dedup
      1,945 groups (767/1,178, 1,960 dropped), boilerplate 836/3,242, priority and overlay all
      baseline-exact; `missingEntry` 0. One drift: 396 inner-id keys dropped (was 395) — a live
      edit to the actions dataset since 2026-08-14, not a code diff.
- [x] **Published: view `13272`** (`gis_datasets.s12453_v13272_actions_cleaned`, 16,948 rows,
      funnel identical to the dry run). SQL verification
      (`scratchpad/mitigat-ny-prod-prod/verify_13272.cjs`, read-only) all green:
      - action_id sets identical to 13192 (0 only-in-either); precision transition matrix is
        **diagonal-only** except old-NULL → 501 p3 / 15 p4 / 14 p0.
      - Content diff on rows 13192 had coded: **0** diffs in precision / method / confidence /
        geometry-nullness, and **0 points moved > 1 m** (re-geocoding reproduced July's points).
      - Invariants: 0 p1–4 rows missing geometry, 0 p0/p5 rows with geometry, 0 NULL precision,
        0 bad SRID, 0 points outside NY.
      - Indexes (pkey / GIST / action_id), tiles metadata, 37 source columns, auth unchanged.
      - Inputs untouched: source 11725 still exactly views 12462+12463; 12453 now 13192+13272.
      - **Live tiles verified**: `/dama-admin/hazmit_dama/tiles/13272/7/37/47/t.pbf` → 200
        (71 KB); Sullivan z9 tile → 200 (6 KB) — no server deploy needed for tiles.
      - Sullivan (36105) for the dashboard build: **474 actions / 23 jurisdictions**, all with
        geometry (48 p2 · 351 p3 · 75 p4); status Proposed 390 · In-Progress 22 · Completed 40 ·
        Discontinued/Paused 4 · blank 17 + literal "NA" 1. (Handed off to the dashboard task.)

### Phase 3 — Consumer audit + retirement recommendation — DONE 2026-08-24
- [x] **DB audit: ZERO live consumers.** Swept every `data_items` schema on `dms-mercury-3`
      (84 schemas) for `11725`/`12462`/`12463`: matches only in `dms_mitigat_ny_prod` (97 rows),
      **all numeric coincidences** — EAL dollar values (`"swnd_ealt":11725.72…`) in baked
      component data and legend-domain numbers in `map_editor_test|symbology` rows. A decisive
      scan for the strings a real binding must contain (`s11725_v…` table names, `tiles/12462|3`
      URLs, `view_12462|3` source-layers, `source_id: 11725`) returned **0 rows**. Audit scripts:
      `scratchpad/mitigat-ny-prod-prod/audit_*.cjs`.
- [x] **Repo audit:** only the historical analysis scripts (`references/actions/scripts/01–04`,
      which study those specific views — leave pointed at them), the `actions_location` plugin's
      own harness, and baked mockup/QA assets (`actions-location-overview.html`, `actions-qa.html`
      — static numbers, regenerate only if ever rebuilt). No frontend/theme code binds 11725.
      Migration column: **no action needed anywhere.**
- [x] **Recommendation: freeze, don't delete (yet).** Source `11725` has no consumers, so it can
      simply stop being maintained: leave it and views 12462+12463 in place as the historical
      record (they cost nothing), keep the `actions_location` plugin registered as diagnostic-only
      (its worker now calls the same shared resolver, so it can't drift), and revisit deletion
      after the dashboard ships on 13272. Deprecation banner added to
      `actions_location/actions_location_datatype.md`. **Deleting the source row + views is the
      owner's call; nothing was deleted.**
- [x] Handed off to the dashboard task: source `12453` / **view `13272`** written into its
      bindings table, with re-derived Sullivan reference figures.

## Files requiring changes

- `dms-template/data-types/mny/actions_cleaned/utils/locations.js` — the join → waterfall rewrite.
- `dms-template/data-types/mny/actions_cleaned/worker.js` — T6 stage wiring + geocode pre-cache +
  event names.
- `dms-template/data-types/mny/actions_location/utils/*.js` — imported or relocated (no behavior
  change); deprecation note in that plugin if the owner retires it.
- `dms-template/data-types/mny/actions_cleaned/test.js` — only if the harness needs a flag for the
  geocoder (e.g. `--skip-geocode` for offline dry runs; decide during Phase 1).
- This doc, the parent task doc (T6 section gets a pointer here), `planning/todo.md` (this repo),
  and the root-hub dashboard task's bindings table.

## Testing checklist

- [ ] **Precision distribution vs the `13192` baseline** — the previously-NULL 530 now carry real
      precisions; all other rows' precision/geometry byte-compare to `13192` except deliberate
      diffs (fresh geocoder answers, newer centroid membership). **Diff CONTENT, not counts** —
      count parity has masked real regressions before.
- [ ] Every precision-1–4 row has geometry; every 0/5 row has NULL geometry; 0 mismatches (same
      invariant as the parent checklist).
- [ ] Overlay count reconciles: 671 ± the skip rule + CSV ids lost to dedup merges (parent doc has
      the exact reconciliation: 108 intersection + 248 route…).
- [ ] Regression guards for the v1 bug class re-verified in the new home: array `county_geoid`,
      numeric `geoid_juris`, literal `"New York City"`, id-key shadowing (flatten id-last),
      `ST_Centroid(ST_Collect(...))` for NYC (not `ST_Union`).
- [ ] Geocoder resilience: worker completes (with logged degradation, precision falls through to
      rung 3) if the Census geocoder is down; cache hit-rate logged.
- [ ] New view serves tiles (no 204s on a known-geometry area); `auth_permissions` matches the
      source's existing setting (new DAMA **views** inherit, but re-check — new sources default
      PRIVATE).
- [ ] Row count still 1-per-distinct-action; dedup groups unchanged (1,945) unless the 530 newer
      rows introduce new groups — log if so.
- [ ] Sullivan (`36105`) spot-check for the dashboard: county rows all carry precision + geometry
      consistent with the mockup's map story (centroid-clustered, 21 NY jurisdictions).
- [ ] Sources `1029065` and `11725` byte-untouched (non-destructive rule).

## Open questions — resolutions

1. **Code-sharing shape — RESOLVED:** promoted to `data-types/mny/_shared/location/` (the four
   utils + new `waterfall.js`); BOTH plugins call the one resolver, so the waterfall cannot fork.
2. **Fate of source `11725` — RECOMMENDED (freeze, keep plugin diagnostic-only), owner decides**
   — see Phase 3. Zero consumers found, so there is no migration pressure either way.
3. **Publish cadence — STILL OPEN (owner), blocks dashboard launch not this task.** Facts for the
   decision: a full publish takes ~4 minutes end-to-end; the plugin has no `schedulables` entry
   yet (adding one is a small follow-up if a cron cadence is wanted — see `data-types/CLAUDE.md`);
   the datasets-UI publish route/Create page still await the owner's server+frontend deploy
   (parent task Open 1) — until then the path is the local `test.js` harness.
4. **Geocoder budget — RESOLVED, no concern:** of 18,908 rows only ~230 carry a usable address;
   after regex filtering the worker POSTs **206 addresses in ONE Census batch call** (limit 10k),
   returning in seconds with 28 matches. Two full runs today (dry + publish) drew identical
   results. Per-publish geocoding is negligible load.

## Log

- 2026-08-24: task created (owner direction: one unified source; the internal/external split's
  reason — internal sources can't hold geometry — no longer applies).
- 2026-08-24: **implemented, published (view `13272`), verified, audited — all three phases DONE
  in one session.** Full dry run reconciled byte-perfect against 13192 before publishing; SQL
  verification confirmed diagonal-only precision transitions and 0 content diffs on
  previously-coded rows; consumer audit found zero live bindings to source 11725. Remaining for
  the owner: 11725 delete-vs-freeze, publish cadence, and the still-pending server/frontend
  deploy (which now also carries the descriptor change: `locationsView` →
  `jurisdictionsView`+`countiesView` in route, worker, and Create page).
