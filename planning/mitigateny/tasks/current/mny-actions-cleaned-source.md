# MNY actions — cleaned + located derived source (`actions_cleaned`)

**Project:** MitigateNY

**Status:** BUILT + PUBLISHED (2026-08-14) — **source `12453` / view `13192`**
(`gis_datasets.s12453_v13192_actions_cleaned`, 16,948 rows). Remaining: owner deploys dms-server +
frontend so the plugin's publish route / Create page exist in the deployed apps, and the two
follow-ups in the log. · **Type:** new data-type plugin + derived external data source
**Touches:** `data-types/mny/actions_cleaned/` (new), `data-types/register-datatypes.js`,
`src/data-types.js`. Reads (never writes): the actions internal dataset in `dms-mercury-3` and
Actions Location 1.0 in `hazmit_dama`.

## Objective

Materialize every **currently recommended** transform and cleaning operation from the actions
data-quality report series into a single new **external (DAMA) source in `hazmit_dama`** — one row
per distinct action, cleaned, deduplicated, flagged, priority-normalized, and carrying the
**`wkb_geometry`** and **`precision`** columns from Actions Location 1.0 (upgraded with the staged
recovered-from-text coordinates).

**Non-destructive by design: every current dataset stays exactly as it is.**
- Actions source `1029065` / view `1074456` (`dms-mercury-3`) — untouched. The production
  backfill (`15_apply_location_updates.mjs --apply`) is **not** run; the recovered coordinates land
  in the new source instead.
- Actions Location `11725` / views `12462`+`12463` (`hazmit_dama`) — untouched, remains the
  locations input.

## Why a data-type plugin (not a one-off script)

Same reasoning as `actions_location`: the transform must be re-runnable when the actions data
changes (each re-publish = a new view on the same source), authors trigger it from the datasets
pattern UI, and the source needs `metadata.columns` + tiles metadata to be usable by
DataWrapper/Table/Map pages. Follow the `data-types/mny/actions_location/` skeleton (worker streams
actions out of `dms-mercury-3` via COPY, writes the output table in the `pgEnv` DB via
`createDamaView`). See `data-types/CLAUDE.md` for the plugin contract.

## Inputs

| Input | Where | Notes |
|---|---|---|
| Actions | `dms-mercury-3`, source `1029065` / view `1074456`, `dms_mitigat_ny_prod.data_items__s1029065_v1074456_actions_revised`, `type='actions_revised\|1074456:data'` | 18,378 rows (2026-07 baseline) |
| Actions Location 1.0 **v2** | `hazmit_dama`, source `11725` / **view `12463`**, `gis_datasets.s11725_v12463_actions_location_10` | `action_id`, `precision`, `wkb_geometry`. Same DB as the output → plain SQL/in-memory join |
| Recovered coordinates | `references/actions/data/location_updates.csv` (2,528 rows: 2,399 `apply=yes` + 129 `review`) | **Gitignored** — the whole `references/actions/` tree is untracked. Copy the CSV into `data-types/mny/actions_cleaned/static/location_updates.csv` so the deployed server can read it. No live geocoding in the worker — all coordinates are precomputed. |

Report provenance (the "currently recommended" set this task implements):
- `references/actions/report/actions-data-quality.md` — §3 completeness/schema-hygiene, §6 data recs
  (location recs 1–6 already shipped as view 12463)
- `src/themes/mny/design/reports/duplicate-actions.html` (+ `data/dup_analysis.json`)
- `src/themes/mny/design/reports/boilerplate-actions.html` (+ `data/boilerplate_analysis.json`)
- `src/themes/mny/design/reports/location-from-text.html` (+ `data/location_updates.csv`)
- `src/themes/mny/design/reports/priority-coverage.html` (+ `data/priority_analysis.json`)
- `src/themes/mny/design/reports/actions-qa.html` — "What's Left" punch list

All numbers below are the reports' point-in-time counts (July–Aug 2026). The worker **recomputes
everything live** except the geocoded coordinates (static CSV) — if actions changed since, counts
shift and new rows simply have no recovered coordinate. Log actuals vs. these baselines.

## The transforms (in worker order)

### T1 — Flatten the JSONB safely
- One flat record per row from `data`, **id-last**: `{...row.data, action_id: row.id}` — 401
  actions carry their own `id` key *inside* `data` that would otherwise shadow the DMS row id (the
  join key for everything downstream).

### T2 — Schema hygiene *(report §3 / §6.10, actions-qa punch list)*
- Drop the **9 import-artifact keys** (literal SQL-expression strings used as keys — 184 rows —
  plus a raw UUID key and `[object Object]`).
- Merge `seondary_hazard_type` (misspelled, 352 rows) into `secondary_hazard_type` (real field
  wins when both present).
- Normalize sentinels to NULL: `TBD` / `N/A` / `unknown` / `-` etc. in `estimated_cost` (~1,178),
  `funding_sources` (~710), and the `#ERROR_#N/A` literal.
- Clean `county` (69 distinct labels → canonical): trim/case-fix the 61 clean names; `[object
  Object]` → NULL; the 8 comma-joined multi-county strings → primary county in `county`, full list
  preserved in a `counties` column (from the `county_geoid` array, which is already multi-valued);
  `New York City` kept as-is (borough resolution already handled by the location pass).
- Carry `is_valid` through as a column (583 rows are `isValid=false`); **keep** those rows.

### T3 — De-duplicate *(duplicate-actions.html: "keep-the-richer-copy")*
- Group key: **normalized `action_name` + `action_description` + locality** (jurisdiction, else
  county) — port the normalization from `references/actions/scripts/10_duplicates.mjs`.
- Baseline: 1,945 groups / 1,960 redundant rows (10.7%) → **16,418 survivors**.
- **Auto class** (767 groups — identical or blank-vs-filled): collapse mechanically; fill the
  survivor's blanks from the dropped copies (zero content lost).
- **Rule class** (1,178 groups — differ in a secondary field like timeline/status/hazard tags):
  survivor = valid (`isValid` true beats false) → most complete (most non-blank fields) → most
  recently updated; then fill survivor blanks from dropped copies.
- **Location rule for merged groups**: survivor takes the group's *best* location (lowest non-zero
  precision among members, after T6 inputs are known — implement as: compute survivor sets first,
  resolve location per group at T6).
- **Excluded**: the 20 groups (197 rows) with no county *and* no jurisdiction — can't be confirmed
  co-located; all kept (per the report).
- Traceability: survivor rows get `merged_action_ids` (JSONB array of dropped DMS ids, NULL for
  non-groups). Dropped rows do not appear in the output.

### T4 — Boilerplate flag *(boilerplate-actions.html move 4 — flag, do NOT delete)*
- Template = identical normalized name+description across **≥2 distinct localities** (port from
  `scripts/11_boilerplate.mjs`). Baseline: 827 templates / 3,467 rows (18.9%).
- New columns: `is_boilerplate` (bool), `template_key` (stable hash of the normalized text),
  `template_size` (localities sharing it).
- The report's moves 1–3 (shared-program entity, localizing site/cost, controlled catalog) are
  **editorial/content work — out of scope here**; this flag is what makes them workable later.

### T5 — Priority normalization *(priority-coverage.html: "migrate, don't overwrite")*
- Port the family classifier + mechanical mapping from `scripts/17_priority_coverage.mjs`
  (case-folding, abbreviations `H`/`M`/`L`, `Moderate`→Medium, stripping ranks/scores/narratives
  off a leading label). Baseline: 14,436 rows map mechanically → High 8,941 / Medium 3,919 /
  Low 1,576.
- Columns:
  - `priority` — `High` | `Medium` | `Low` | `Not Yet Prioritized` | NULL. The 434 explicit
    non-answers (`N/A`, `TBD`, …) and the 1,988 blanks → `Not Yet Prioritized` (visible, not
    silently blank). The ~1,954 non-mechanical rows (bare numbers needing a plan legend, ranges,
    tier vocabularies, misc) → **NULL** — they are the per-county review queue, not guesses.
  - `priority_original` — verbatim source string, always (no plan's language lost).
  - `priority_score` NUMERIC — extracted where present ("Low (14.5)" → 14.5).
  - `priority_rank` INTEGER — extracted where present ("High - 1" → 1).
  - `priority_notes` TEXT — trailing hedges/narratives ("dependent", "after flood events").
- `county_priority` (the existing 5-tier select) carries through **unchanged as its own column** —
  the report is explicit: two lenses, don't merge.
- The companion recommendation to retype the live intake field to a `select` is a change to the
  **actions form itself** — out of scope here.

### T6 — Location: join + recovered-coordinate overlay
- **Join** `precision` + `wkb_geometry` from view **12463** by `action_id`. Baseline v2
  distribution: p0 373 · p1 46 · p2 28 · p3 11,920 · p4 5,775 · p5 236 (96.7% geolocated).
- **Overlay** the `apply=yes` rows of `static/location_updates.csv` (2,399: tier A explicit-coords
  113 · B address 216 · C intersection 118 · D route 255 · D named-road 1,697; distance-gated
  ≤25 km p3 / ≤75 km p4). For each surviving action in the CSV:
  - `wkb_geometry` ← the recovered point (lon/lat columns; `ST_SetSRID(ST_MakePoint(...), 4326)`).
  - `precision` ← tier A → **1**, tiers B/C/D → **2** (see decision D2 below).
  - `address_if_available` ← CSV value **only where currently blank** (199 baseline).
  - Skip rule (mirrors `15_apply`): don't overlay a row already at precision 1.
- New provenance columns on **every** row:
  - `location_method` — `pipeline:coords` / `pipeline:address` / `pipeline:juris_centroid` /
    `pipeline:county_centroid` / `pipeline:statewide` / `recovered:coords` / `recovered:address` /
    `recovered:intersection` / `recovered:route` / `recovered:named_road` / NULL (unresolved).
  - `location_confidence` — high / medium / low (CSV `confidence` for recovered rows; pipeline
    rungs: 1–2 high, 3 medium, 4 low, 5/0 NULL).
  - `dist_from_centroid_km` NUMERIC — CSV value, recovered rows only (QA lever).
- The **129 `review` rows are ignored** (per the report — held for human review).
- Precision-0/5 rows keep NULL geometry (5 = statewide by design, not a failure — preserve the
  distinction; never count p5 as a coverage failure).

### T7 — Write the DAMA source/view *(the `actions_location` mechanics)*
- Route `POST /dama-admin/:pgEnv/actions_cleaned/publish` creates the source on first run
  (`type: 'gis_dataset'`, suggested name "Actions Cleaned"), queues the worker; worker calls
  `createDamaView`, creates the table, COPYs rows in, then:
  - `ogc_fid BIGSERIAL PRIMARY KEY` (tiles carry only ogc_fid), GIST index on `wkb_geometry`,
    typmod `GEOMETRY(POINT, 4326)` **and** verify value SRID = 4326 (SRID-0 values break tiles —
    see `reference_dama_srid0_breaks_tiles`).
  - **Write `metadata.columns`** on the source (the most-forgotten step — without it every
    UDA/Table/DataWrapper surface renders an empty grid). Give `precision`, `location_method`,
    `location_confidence`, `priority`, `is_boilerplate`, `merged_action_ids` real descriptions;
    write both `desc` and `description` keys so they show in the metadata page.
  - Write `tiles` metadata on the view (copy the `actions_location` block).
  - **Funnel logging** for every transform: rows in → dropped/changed → rows out per T2–T6
    (artifact keys dropped, sentinels nulled, dup groups auto/rule/excluded, boilerplate flagged,
    priority mapped/review/not-set, overlay applied/skipped-already-precise/dropped-by-dedup).
    Every actions_location v1 bug would have been visible on day one from a funnel log.

### Output schema (physical columns)

`ogc_fid`, `action_id`, `scope` (State/Local/Unknown from `source_id`), `county`, `counties`,
`county_geoid`, `jurisdiction`, `geoid_juris`, `action_name`, `action_description`,
`problem_statement`, `primary_hazard_type`, `secondary_hazard_type`, `primary_action_type`,
`action_status`, `implementation_status`, `estimated_cost`, `cost_range`, `lead_agency`,
`funding_sources`, `address_if_available`, `priority`, `priority_original`, `priority_score`,
`priority_rank`, `priority_notes`, `county_priority`, `is_boilerplate`, `template_key`,
`template_size`, `merged_action_ids`, `is_valid`, `precision`, `location_method`,
`location_confidence`, `dist_from_centroid_km`, `wkb_geometry`, `data` (JSONB — the full cleaned
remainder, artifact keys removed, for anything not promoted to a column).

Text fields pass through `norm()` (trim, blank→NULL) as in `scripts/02_build.mjs`, which also has
the canonical field-name mapping (`description_of_the_solution_action_description` →
`action_description`, `lead_agency_department` → `lead_agency`, etc.).

### Worker memory strategy
Two-pass, like the analysis scripts but bounded:
1. **Pass 1** (stream): collect per-row `{action_id, normalized name+desc key, locality,
   completeness score, updated_at, isValid}` → compute dup survivor sets + template groups in
   memory (small); stash **full data only for rows inside dup groups** (~3,905 rows) so survivor
   blank-filling works.
2. **Pass 2** (stream): drop non-survivors, apply T1–T6 per row, emit via COPY FROM.

## Plugin layout / files

```
data-types/mny/actions_cleaned/          # NEW
├── index.js                             # routes: POST /publish (createDamaSource + queueTask)
├── worker.js                            # two-pass transform (skeleton: ../actions_location/worker.js)
├── utils/
│   ├── normalize.js                     # name+desc+locality keys (port scripts/10 + 11)
│   ├── priority.js                      # family classifier + mapping (port scripts/17)
│   ├── hygiene.js                       # artifact keys, sentinel list, county labels, field renames
│   └── locations.js                     # 12463 join + CSV overlay
├── static/
│   └── location_updates.csv             # COPIED from references/actions/data/ (gitignored there)
└── pages/
    ├── index.jsx                        # { defaultPages: ['table','map','metadata'], sourceCreate }
    └── create.jsx                       # actions source/view + locations view pickers
                                         #   (skeleton: ../actions_location/pages/)
data-types/register-datatypes.js         # + registerDatatype('actions_cleaned', require('./mny/actions_cleaned'))
src/data-types.js                        # + client entry keyed by DAMA type 'actions_cleaned'
```

Server changes need a dms-server rebuild/redeploy to take effect — **owner deploys, never this
task** (workspace rule). Local verification runs against `localhost:3001` dms-server with
`DMS_EXTRA_DATATYPES` pointing at `data-types/register-datatypes.js`.

## Open decisions — ALL RESOLVED by owner 2026-08-14

- **D1 — RESOLVED: exclude the 1,697 low-confidence named-road recoveries.** Only the **702
  high/medium** rows overlay (tier A coords 113 · B address 216 · C intersection 118 · D route
  255): filter = `apply=yes AND confidence != 'low'`. The named-road rows stay on their centroid
  (they remain in the CSV if ever wanted).
- **D2 — RESOLVED: default.** Tier A → precision 1, B/C/D → precision 2, with
  `location_method`/`location_confidence` carrying the nuance.
- **D3 — RESOLVED: default.** Rule-class dedup automated (keep-richer rule); `merged_action_ids`
  is the audit trail.
- **D4 — RESOLVED:** source display name **"Actions Cleaned"**, plugin + DAMA type
  `actions_cleaned`.

## Out of scope (tracked elsewhere or deferred)

- **Mutating production actions** — `15_apply --apply` stays parked; see
  `mny-actions-location-recovery.md` (its Phase 3 is effectively redirected into this source).
- The 129 review-hold location rows; the tier-E named-facility gazetteer.
- Boilerplate moves 1–3 (shared-program entity, localization, controlled catalog) — editorial.
- The 1,954-row priority review queue (per-county plan legends) and the intake-form
  `priority`→select retype.
- Data fixes on the source itself: Saratoga/Warren unnamed-actions annex import, the 552
  unmatched `geoid_juris`, NYC borough assignment in the actions data.
- Surfacing precision/clustering on map UIs ("never let a user click a 2,022-action dot expecting
  a project") — UI task.
- Any git/deploy step.

## Testing checklist — all verified 2026-08-14 against view 13192

Note: the actions dataset grew since the July reports — **18,908 rows in** (was 18,378), so live
counts sit slightly above the report baselines. The dedup baselines reproduced *exactly*.

- [x] Row count: 18,908 − 1,960 = **16,948** rows out. Dedup groups **1,945** (auto **767** /
      rule **1,178**, dropped **1,960**) — the report's exact numbers.
- [x] `action_id` unique (16,948 distinct); `merged_action_ids` holds all 1,960 dropped ids, none
      of which appear as an output `action_id`.
- [x] Locality-less same-text rows never grouped (`exactKey` returns null without a locality).
- [x] `seondary_hazard_type` absent from every `data` JSONB (found a first-cut bug here: the key
      also appears with JSON-null values; fixed to remove whenever present); 119 values merged
      into `secondary_hazard_type` (the rest already had the real field populated); 0 artifact
      keys remain (224 dropped); 395 inner `id` keys dropped.
- [x] Sentinel scrub: 0 `TBD`/`N/A`/`unknown` left in `estimated_cost`/`funding_sources`
      (1,362 nulled).
- [x] Priority: High 8,631 / Medium 3,641 / Low 1,492 / Not Yet Prioritized 1,671 / review-NULL
      1,513 (post-dedup, so below input baselines — dedup blank-fill also fills priority).
      Spot-checked: "Low (14.5)" → Low + score 14.5; "Low (20)" → Low + rank 20 (integer
      parentheticals classify as label_rank — same behavior as the report's classifier);
      "Medium - DOF" → Medium + notes "DOF". Known cosmetic nit: notes from "Medium priority – …"
      keep the word "priority" ("priority – high success at moderate cost").
- [x] Boilerplate: 836 templates / 3,242 output rows flagged (3,467 baseline was pre-dedup);
      "Not Reported" placeholder names NOT flagged (0 rows).
- [x] Location: 702 eligible overlay rows → 671 output rows overlaid (113 coords + 202 address +
      108 intersection + 248 route; the gap is 1 already-precision-1 skip + CSV ids that merged
      into one surviving row); 185 blank addresses filled. Precision distribution: p0 372 ·
      p1 **159** (46 pipeline + 113 recovered) · p2 **586** (28 + 558) · p3 10,339 · p4 4,726 ·
      p5 236 · NULL 530. Every p1–4 row has geometry, every p0/p5/NULL row doesn't; 0 rows with
      SRID ≠ 4326; 0 points outside NY; GIST + action_id indexes present.
- [x] `precision` NULL = the **530 actions added since view 12463 was published** — they're not
      in the locations view (see follow-up below).
- [x] Source `metadata.columns` written (37 columns, desc + description); tiles metadata on the
      view; source description carries provenance; `auth_permissions` NULL to match source 11725's
      visibility; categories `[["Actions"]]`.
- [x] Funnel logged per stage (hygiene / dedup / boilerplate / priority / location / overlay).
- [x] Inputs untouched: actions view 1074456 still 18,908 rows; source 11725 still has exactly
      views 12462 + 12463 with their tiles metadata.

## Log
- 2026-08-14: task created from the full report sweep (duplicate/boilerplate/location-from-text/
  priority-coverage/actions-qa + the §3/§6 data recommendations); non-destructive derived-source
  approach chosen per owner directive to leave current data in place.
- 2026-08-14: owner resolved all open decisions (exclude low-confidence named roads; defaults
  otherwise; name "Actions Cleaned") and asked for implementation.
- 2026-08-14: **implemented + published.** Plugin `data-types/mny/actions_cleaned/` (index, worker,
  4 utils, static CSV, pages, test harness); registered in `register-datatypes.js` +
  `src/data-types.js`. Dry-run validated, then published **source 12453 / view 13192** on
  `hazmit_dama` via the local test harness (`node data-types/mny/actions_cleaned/test.js`).
  First view 13191 had the seondary-null-key bug — dropped and replaced by 13192; source has
  exactly one view. All testing-checklist items verified (above).
- **Follow-ups:**
  - The **530 precision-NULL rows** are actions added after locations view 12463 was published.
    Fix = re-run `actions_location/publish` (new view on 11725), then re-publish actions_cleaned
    against it — both are additive re-runs. Needs owner go-ahead (the locations pass hits the
    Census geocoder for rung 2).
  - Server plugin + frontend registration only exist in this repo until the owner deploys
    dms-server / the frontend. The published dataset itself is already live in `hazmit_dama`
    (tiles serve by view_id, UDA reads metadata.columns) — only the publish route / Create page
    need the deploy.
