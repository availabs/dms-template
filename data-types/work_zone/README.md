# `work_zone` — NYSDOT work-zone safety & mobility measures

A DMS data-type plugin that builds the measure set NYSDOT needs for the FHWA
**Work Zone Safety and Mobility Rule** (23 CFR 630 Subpart J) out of data AVAIL
already holds, plus a small number of public datasets.

- **Driver:** `dms-template/src/themes/transportny/TransportNY Design System/dms_design_system_v2/reports/workzone_safety/05_recommendation_report.md`
- **Task doc / phase gates:** `planning/transportny/tasks/current/workzone-performance-data-type-pipeline.md`
- **Deadlines:** NYSDOT must name its measures by **2026-12-31**; annual monitoring from CY2025;
  programmatic review by **2030-12-31**.

The measures:

| id | measure | stage that computes it |
|---|---|---|
| M1 | speed-threshold exceedance | `speed` |
| M2 | delay (veh-hrs, per vehicle, share of total) | `delay` |
| M3 | queue length / duration / presence | `queue` |
| M4 | speed differential (approach vs zone, during vs baseline) | `differential` |
| M5 | work-zone crashes and crash rate | `crashes_open`, `crashes_clear`, `crash_join` |
| M6 | intrusions / worker injuries | `intrusions` |
| E1–E3 | exposure: lane closures, lane-mile-hours, VMT through zone | `exposure` |
| F1 | field-observation (WZTC QA) ratings | `qa_ratings` |

## Architecture

```
                  ┌── 1947 transcom events ──┐
                  │   2799 event×TMC delay    │        984 npmrds_meta (AADT, length, region, tmclinear, road_order)
                  └────────────┬──────────────┘                 │
   Phase 1  spine          ──┴─► wz_event (1 row / deduped WZ event)          ┌── CH 982 NPMRDS 5-min speeds
                                 wz_event_tmc (event × tmc × window)          │
   Phase 2  exposure       ─────► E1–E3 per event + Region×month ◄─ AADT × hourly profile (map21 static)
   Phase 3  speed          ─────► event×tmc×hour: speed, baseline, %epochs<thr ◄┘  → M1
   Phase 4  delay          ─────► M2 veh-hrs / per-veh / share of total (2799 + 2633)
   Phase 5  queue          ─────► event × 5-min epoch queue length/presence → M3
   Phase 6  differential   ─────► M4 approach vs zone; during vs baseline
   Phase 7  crashes_open   ─────► WZ-flag series; ref-marker geocode
            crashes_clear  ─────► CLEAR adapter (same schema)
            crash_join     ─────► crash ∩ spine → M5 counts + rates
   Phase 8  intrusions / qa_ratings (file_upload-driven) → M6, F1
   Phase 1a stip           ─────► nysdot_stip (PIN × phase × FFY) ─┐ project identity
   Phase 9  sample         ─────► the 2030 programmatic-review sample frame ◄┘
   Phase 10 measures       ─────► Region × facility class × period × measure — what the pages bind
```

## Layout

```
data-types/work_zone/
├── index.js            routes (POST /publish · GET /status · GET /stages) + the workers map
├── stages.js           the stage registry: phase, worker, output source type, inputs
├── sql.js              shared SQL pieces; per-table DDLs + *_TABLE_COLUMNS land per phase
├── ch.js               ClickHouse seam (injected client, table-name resolution)
├── run-stage.js        run a stage in-process, for a phase gate's live validation
├── lib/
│   ├── thresholds.js   threshold defaults, coercion and validation          [phase 0]
│   ├── classify.js     what counts as a work zone, by event_type            [phase 1]
│   ├── dedupe.js       recurring-chain collapse, gap splitting              [phase 1]
│   ├── extents.js      anchor vs congestion-impact TMCs                     [phase 1]
│   └── tma.js          Interstate test, TMA membership, significance        [phase 1]
├── workers/
│   └── spine.js        wz_event + wz_event_tmc                              [phase 1]
├── pages/
│   ├── index.jsx       defaultPages ['table','runs'] + the Create page
│   └── create.jsx      stage-selector publish form, generated from GET /stages
├── tests/
│   ├── thresholds.unit.test.mjs   vitest, pure
│   └── route.integration.js       node/sqlite harness
└── README.md           this file — written phase by phase
```

## Routes

Mounted at `/dama-admin/:pgEnv/work_zone/`.

| route | what it does |
|---|---|
| `POST /publish` | Validates a `{ stage, … }` request, creates the stage's output source if no `source_id` is given, queues the stage's worker. → `{ etl_context_id, source_id, stage, source_type }` |
| `GET /status?etl_context_id=…` | Task status; add `&events=1` for the run's events. |
| `GET /stages` | The stage registry with a `runnable` flag per stage, plus the threshold defaults and specs. The Create page renders its form from this, so a stage landing on the server needs no client edit. |

`stages.js` **declares** the pipeline; the `workers` map in `index.js` decides what is
**runnable**. A stage whose worker has not landed 400s naming the phase that delivers it,
rather than queueing a task nothing can pick up.

Run a stage against the dev server:

```bash
curl -s localhost:3001/dama-admin/npmrds2/work_zone/stages | jq '.stages[] | {stage, phase, runnable}'

curl -s -X POST localhost:3001/dama-admin/npmrds2/work_zone/publish \
  -H 'Content-Type: application/json' -H "Authorization: $DMS_TOKEN" \
  -d '{"stage":"spine","name":"wz_event_2024","start_date":"2024-01-01","end_date":"2024-01-31",
       "transcom_source_id":956,"npmrds_meta_source_id":582}'

curl -s "localhost:3001/dama-admin/npmrds2/work_zone/status?etl_context_id=…&events=1" | jq .
```

## Design rules

1. **Upstream data is addressed by source id, never by view id.** Descriptor params carry
   source ids; each worker resolves the right view at run time. (The legacy pipeline's
   hardcoded conflation ids 237/236/238 are the cautionary tale.)
2. **Every stage is idempotent and windowed.** `start_date`/`end_date` in the descriptor;
   re-running a month **replaces** that month (`sql.deleteWindowSQL` inside the insert's
   transaction). This is what a monthly `schedulables` fire needs, and it is asserted by
   an idempotency test per phase.
3. **Thresholds are parameters, not constants.** `lib/thresholds.js` holds the defaults
   from the recommendation report; overrides arrive in the descriptor and the *resolved*
   set is stamped on the output view's metadata, so a report can always say which
   thresholds produced which numbers. NYSDOT has not committed to values yet.
4. **One output table per source, `metadata.columns` on every one.** All views of a source
   must carry the same columns — a column-list change means a NEW source, never an ALTER
   (see `data-types/CLAUDE.md`). Column lists are derived from code, not from
   `information_schema`.
5. **Physical-table rules:** everything in schema `work_zone`; `ogc_fid SERIAL PRIMARY KEY`
   on every table (DAMA tiles carry only `ogc_fid`); geometry values wrapped in
   `ST_SetSRID(…, 4326)` — an SRID-0 *value* in a `geometry(…,4326)` column yields silently
   empty tiles.
6. **No live calls to TRANSCOM or RITIS anywhere** — we read the stores. Socrata is called
   only by the crash ingest, and its downloads are saved as `file_upload` views so tests
   replay them instead of re-downloading.

## Thresholds

Defaults from the recommendation report; all six are descriptor parameters.

| parameter | default | measure | meaning |
|---|---|---|---|
| `speed_threshold_mph` | 35 mph | M1 | absolute exceedance threshold |
| `reference_speed_pct` | 60 % | M1 | relative threshold, as % of TMC reference speed |
| `queue_speed_mph` | 35 mph | M3 | a TMC is "in queue" below this |
| `queue_threshold_mi` | 0.75 mi | M3 | queue length that flags a zone |
| `delay_per_veh_min` | 10 min/veh | M2 | delay per vehicle that flags a zone |
| `differential_mph` | 15 mph | M4 | speed drop that flags a zone |

Unknown keys and out-of-range values are rejected at queue time (a `speed_threshhold_mph`
typo that silently kept its default would publish a view whose metadata claims a threshold
that never applied).

## Output sources

| source type | grain | stage |
|---|---|---|
| `wz_event` | one deduped work-zone event | `spine` |
| `wz_event_tmc` | event × tmc × active window | `spine` |
| `wz_exposure` | event (+ Region×month rollup) | `exposure` |
| `wz_speed` | event × tmc × hour-of-day | `speed`, `differential` |
| `wz_queue` | event × 5-min epoch | `queue` |
| `nys_crashes_open` / `nys_crashes_clear` | crash case | `crashes_open` / `crashes_clear` |
| `wz_crash` | crash ∩ wz_event | `crash_join` |
| `wz_intrusions`, `wz_qa_ratings` | as delivered | `intrusions`, `qa_ratings` |
| `nysdot_stip` | PIN × phase × fund year | `stip` (phase 1a) |
| `wz_significant_sample` | candidate project | `sample` |
| `work_zone_measures` | Region × facility class × period × measure | `delay`, `measures` |

All under app `npmrdsv5`, pgEnv `npmrds2`.

## Tests

```bash
node data-types/run-tests.js work_zone              # both layers
node data-types/run-tests.js work_zone --unit       # vitest, pure
node data-types/run-tests.js work_zone --integration
```

Two layers, per the `run-tests.js` convention: `tests/*.unit.test.mjs` are pure vitest
files (no DB, CH, or network); `tests/*.integration.js` are node scripts against the
dms-server sqlite harness. No test contacts TRANSCOM, RITIS, Socrata or ArcGIS — recorded
extracts live in `tests/fixtures/`.

---

# Phases

Each phase's gate: unit tests green → integration test green → a live bounded run on
`npmrds2` via the dev dms-server → validation against the numbers listed → this README
section written → the task doc updated. The next phase does not start before the last step.

## Phase 0 — Scaffold + documentation skeleton ✅ 2026-09-08

**Purpose.** Make the pipeline runnable stage-by-stage before any stage exists: one route
with a stage selector, a validated threshold contract, and the documentation frame the
later phases fill in.

**Inputs.** None.

**Algorithm.** `stages.js` declares 14 stages (phase, worker path, output source type,
required and optional upstream source ids, whether the stage is windowed).
`index.js` validates a `/publish` request against that registry — stage known, worker
landed, window well-formed, required inputs present, thresholds resolvable — creates the
output source when needed, and queues the worker with a fully self-contained descriptor.

**Config.** `lib/thresholds.js`: six thresholds, each with a default, a unit, the measure
it serves and sanity rails. `resolveThresholds()` merges a partial override set over the
defaults, coerces form strings, rejects unknown keys and out-of-range values, and reports
every problem at once.

**Output.** No data. `work_zone/spine` is registered as a scaffold: it validates its
descriptor (a scheduled fire never passes through the route) and then fails loudly rather
than publishing an empty spine.

**Tests.** `tests/thresholds.unit.test.mjs` (14 vitest cases: defaults, coercion,
range ends, no-mutation, unknown-key and out-of-range rejection, all-problems-at-once).
`tests/route.integration.js` (23 cases: registry shape, `GET /stages`, every refusal path,
the spine happy path, descriptor self-containment, threshold override coercion, source
reuse and source-type mismatch, `GET /status`, and the scaffolded worker's own validation).

**Validation.** `node data-types/run-tests.js work_zone` → 23 integration + 14 unit,
0 failing. Plugin registers at boot with no `[datatypes] SKIPPED` line.

**Results log.**
- 2026-09-08 — Scaffold landed. 14 stages declared, 1 runnable (`spine`, as a scaffold).
  Registered in `data-types/register-datatypes.js` and, client-side, in
  `dms-template/src/data-types.js` under app `npmrdsv5` (12 stage-output types get the
  stage-selector Create page; `wz_event_tmc` is table-only). 37 tests green.

## Phase 1 — TRANSCOM events → the work-zone spine — ✅ COMPLETE 2026-09-09

**Purpose.** One row per real work-zone event, with a TMC extent, so every later measure
has a spine to attach to.

**Inputs.** `transcom_source_id` (events, source 956 / view 1947),
`npmrds_meta_source_id` (582 / view 984 — AADT, length, region, `tmclinear`,
`road_order`), optionally `transcom_event_tmc_source_id` (1635 / 2799, for event bounds
used in contamination exclusion later).

**Algorithm (planned).**
- `lib/classify.js` — NY filter (`state`/`state_code`); work-zone family filter
  (`nysdot_sub_category IN ('Construction','Maintenance','Emergency Operations')`);
  category → {construction, maintenance, emergency}; tag `is_utility_or_permit` from
  description keywords. `event_class` is misleading — use the `nysdot_*` fields.
- `lib/dedupe.js` — collapse `related_road_events` / `next-occurrence` chains and repeated
  (facility, direction, description-stem) series into one event with a union of active
  windows; keep the member event ids.
- `lib/extents.js` — TMC set from `tmclist` (present on 49.7% of events); fallback snaps
  start/end points to the facility's TMCs along `tmclinear`; record `extent_source`
  (tmclist/snap/none) and a confidence.
- `lib/tma.js` — NY TMA county sets (HDM §16.5.2.1: NY–Newark, Buffalo, Rochester, Albany,
  Syracuse, Poughkeepsie–Newburgh); Interstate test; **significant candidate** = Interstate
  ∧ TMA ∧ ≥3 consecutive days with `lanes_affected_count > 0`.

**Output.** `wz_event`, `wz_event_tmc` (+ `metadata.columns` on both).

**Tests (planned).** Unit: classify / dedupe / extents / tma over synthetic rows including
a `next-occurrence` chain and a CT event. Integration: the worker over a 200-event fixture
extracted from view 1947 for one week of 2024 — row counts, no NJ/CT, chain collapsed.

**Validation (planned).** 2024 pre-dedupe family count ≈ **93,112** events; post-dedupe
count recorded; TMC coverage ≥ 50% direct plus the snap share; significant candidates per
Region (sanity: NYC / Long Island / Hudson Valley dominate).

**Results log.**
- 2026-09-09 — **Four libs, the worker and its tests built. Six of the plan's assumptions were wrong;
  each is recorded here because the plan is what a later reader will trust.**

  **1. There is no chain field.** The plan keys dedupe on `related_road_events`. That column does not
  exist, and every other association field is empty — of NY 2024's 93,112 work-zone events,
  `secondary_event_ids` is set on **3**, `associated_impact_ids` on **0**,
  `with_in_work_zone_associated_event_id` on 448, `secondary_event` true on **1**. Chains have to be
  inferred, so `lib/dedupe.js` keys on (activity class, facility, direction, county, description) and
  splits on a silence longer than `chain_gap_days` (default **14**; of NY 2024's within-chain day gaps,
  37,758 are next-day, 7,485 within a week, 1,077 at 8–14 days, 2,311 beyond).
  Description **stemming is off by default**: 22% of descriptions embed a slash date and 47% a clock
  time, but stripping them moves repeat-group coverage only from 61.9% to 62.4% — 0.5pp for a
  normalisation nobody can audit.

  **2. `nysdot_sub_category` is not unique across general categories**, so the legacy family filter is
  over-inclusive. `Maintenance` appears under Construction, Condition *and* Incident, and
  `Emergency Operations` sits under **Incident**. AVAIL's mapping table
  (`datasets.s479_v835_nysdot_transcom_event_classification`) keys on `event_type`, so
  `lib/classify.js` does too, with an exhaustive map over the **44** event types observed in NY since
  2023 and five activity classes. For NY 2024:

  | class | events | in legacy family |
  |---|---|---|
  | construction | 86,658 | 86,658 |
  | maintenance | 2,563 | 2,563 |
  | utility | 362 | 351 |
  | incident_response | 3,704 | 2,759 |
  | winter_operations | 765 | 765 |
  | operations | 16 | 16 |

  The legacy filter reproduces **93,112 exactly** (the phase-1 reconciliation target); Subpart J scope
  is **89,583** — it drops 3,540 incident-response, winter-operations and drawbridge events the old
  filter swept in (police activity, vehicle fires, debris spills, plowing) and adds 11 gas-main-break
  events it excluded. A keyword sweep of everything the family filter *excludes* finds only
  'Downed tree' and 'Gas main break', so its recall was never the problem — its precision was.
  Scope is a descriptor parameter (`scope_classes`), because whether sweeping and winter operations
  count is NYSDOT's call, and an unrecognised event type is classified `unclassified` and **reported**,
  never guessed into or out of scope.

  **3. `tmclist` is not a list.** Every populated value is exactly one 9-character TMC — all 82,116 of
  NY 2024's construction events, no separators of any kind. It is an anchor, not an extent.
  Multi-TMC extents come from view **2799**, which covers 76,790 of 86,658 events (**88.6%**, against
  the 18.5% `congestion_data` fill rate the research phase projected) — but 2799 is built *from*
  congestion data, so its set runs downstream with the queue: median 2 TMCs, p95 30, and **638 events
  carry more than 200**. So `wz_event_tmc` rows carry a `tmc_role` — `anchor` (where the work is) and
  `impact` (where the effect is felt) — and phase 2 must use anchors for lane-mile-hours, or exposure
  inflates by the length of the queue. Every 2799 event also has an anchor, so extent coverage is
  **94.8%** and 4,542 events have none.

  **4. `lanes_affected_count` is populated on only 40%** of events (37,445 of 93,112), and every
  populated value is > 0 — so NULL means unknown, not zero. `lanes_affected` is therefore NULL with a
  `lanes_affected_known` flag, and significance is reported twice: as the rule is written
  (`consecutive_closure_days >= 3`) and with duration measured on any activity, which bounds what the
  lane-count gap hides.

  **5. `f_system` cannot carry the Interstate test.** `f_system = 1` covers 30,013 NY 2024 construction
  events, but its facilities include "43RD ST", "6TH AVE" and "111TH AVE" — the value is inherited from
  whichever TMC the event matched. The facility name gives 26,818, of which 24,942 also have
  f_system 1; the **5,071 f_system-only events are false positives**. So the facility name is the test,
  f_system is recorded alongside, and `interstate_signals_disagree` keeps the difference visible.

  **6. Open question 4 (TMA boundaries) is resolved, and needed no external source.** The npmrds meta
  view carries `ua_code`/`ua_name` per TMC, so TMA membership is urbanized-area accurate rather than
  whole-county — and its NY areas above the 200,000 threshold are exactly the six HDM §16.5.2.1 TMAs
  (New York–Jersey City–Newark 63217, Buffalo 11350, Albany–Schenectady 970, Rochester 75664,
  Syracuse 86302, Poughkeepsie–Newburgh 71803; Utica, Binghamton, Kingston, Elmira and Glens Falls
  fall below it). A county map is kept as a fallback for the ~5% of zones with no anchor meta row and is
  labelled `county_approx`.

  **Bugs the tests and the live run caught, worth remembering:**
  - **The chain key must include the activity class.** TRANSCOM descriptions are templated, so a
    plowing run and a construction closure on the same segment share a description verbatim and were
    collapsing into one work zone. Found by the integration test's wider-scope case.
  - **The npmrds meta view is one row per (tmc, year)** — up to **9 rows per TMC** over 54,249 TMCs.
    A naive join fails the insert with *"ON CONFLICT DO UPDATE command cannot affect row a second
    time"*, and a naive read leaves length, AADT and `ua_code` non-deterministic between runs. Both now
    use `DISTINCT ON (tmc) … ORDER BY tmc, year DESC` with `year <= ` the window's year, which is also
    the right AADT vintage for phase 2.
  - **Every column of a `(VALUES …)` subquery is `text`**, so `first_start` needs an explicit
    `::timestamp` — the column list in `sql.js` carries a cast per column.
  - Meta column names are **`miles`** and **`road`**, not `length` and `road_name`.

  Tests: 82 unit (classify 19 · dedupe 21 · extents 14 · tma 14 · thresholds 14) + 12 spine integration
  + 22 route integration. The obsolete scaffold test asserting the worker was unimplemented was
  retired rather than left skipped.

- 2026-09-09 — **Live run on `npmrds2`, full year 2024. Gate met.**
  `node work_zone/run-stage.js spine 2024-01-01 2024-12-31` →
  **wz_event source 2193 / view 3843**, **wz_event_tmc source 2194 / view 3844**,
  tables `work_zone.s2193_v3843_wz_event` and `work_zone.s2194_v3844_wz_event_tmc`.

  | measure | value | gate |
  |---|---|---|
  | events read (plausible work zones) | 199,388 | |
  | **legacy family** | **93,112** | **≈ 93,112 ✓ exact** |
  | Subpart J in scope | 89,583 | |
  | **work zones** | **42,688** (mean 2.10 occurrences, max 262) | post-dedupe recorded ✓ |
  | wz_event_tmc rows | 668,544 | |
  | **with an extent** | **41,216 · 96.6 %**, all `extent_confidence = high` | **≥ 50 % ✓** |
  | lane count known | 25,621 · 60.0 % | |
  | Interstate | 16,950 · 39.7 % | |
  | in a TMA | 31,600 · 74.0 % | |
  | **significant candidates** | **220** (520 on the any-activity variant) | per Region ✓ |

  **Significant candidates by Region — and the gate's expectation was wrong.** The plan predicted
  NYC / Long Island / Hudson Valley would dominate. They do not:

  | Region | zones | significant | any-activity | lane count known |
  |---|---|---|---|---|
  | 3 · Central New York | 2,945 | **90** | 231 | 42.5 % |
  | 11 · New York City | 13,498 | 54 | 54 | 91.7 % |
  | 4 · Genesee Valley | 2,440 | 51 | 103 | 54.9 % |
  | 10 · Long Island | 5,662 | 14 | 18 | 54.8 % |
  | 1 · Capital District | 5,339 | 11 | 30 | 44.4 % |
  | 8 · Hudson Valley | 6,691 | **0** | 84 | **29.5 %** |
  | 5, 6, 7, 9, 2 | 4,641 | 0 | 0 | 27–84 % |

  Region 3 leading is right, not a bug — the I-81 viaduct reconstruction is exactly the sustained
  Interstate-in-a-TMA work the rule targets. But **Region 8 returning zero while showing 84 on the
  any-activity variant is a data-quality artefact, not an absence of work**: `lanes_affected_count`
  reporting ranges from **91.7 % in NYC to 27.1 % in Region 6** and 29.5 % in Region 8. The rule as
  written therefore produces a **regionally biased** significant population. This is the phase's most
  consequential finding for NYSDOT: the significant-project list cannot be defended from TRANSCOM lane
  counts until reporting is consistent. The `is_significant_candidate_any_activity` column exists to
  bound the bias, and the fix is a program ask, not a code change.

  **Why 220 and not thousands — checked two ways.** Mean longest consecutive run among
  Interstate ∧ TMA zones is 1.23 days, so few chains reach three. I suspected the templated
  descriptions were fragmenting campaigns and tested it: stemming dates and times out of the
  description changes chains with ≥3 consecutive days from **775 to 773** — no effect, so stemming
  stays off (the earlier 0.5pp measurement was on the wrong metric; this one is on the metric
  significance actually uses). Then measured the rule's *own* unit — consecutive days of any work-zone
  activity at a (facility, direction, county) location, since the rule says a project "occupies a
  location more than three days": **376** Interstate locations statewide, mean longest run 6.32 days,
  **180 with ≥3 consecutive days**, 58 with ≥7, 18 with ≥30 (max 187). Two independent units landing
  at 180–220 is what makes 220 credible.

  A caveat to carry into phase 9: the spine's unit is a **work-zone occurrence chain**, not a project.
  One campaign whose nightly activity varies ("milling", then "paving", then "shoulder work") is
  several chains under any keying, so chain counts understate project-level occupation.

  `wz_event.wkb_geometry` is the **anchor** TMC's geometry — the work extent, not the impact corridor,
  which would draw the queue as if it were the work. 41,167 of 42,688 zones (96.4%) carry it, SRID 4326,
  one geometry type, so the spine can back a map layer directly.

  Final objects: **wz_event source 2193 / view 3845** (`s2193_v3845_wz_event`) and **wz_event_tmc source
  2194 / view 3846** (`s2194_v3846_wz_event_tmc`), both stamped version `CY2024`, `metadata.columns` 35
  and 13. The year was run twice (the second adding the geometry step) and reproduced identically —
  42,688 / 668,544 / 220 — which is the idempotency evidence.

- 2026-09-09 — **Nine vintages published, and a report.** The spine was run for every year TRANSCOM
  supports: **CY2018–CY2025 complete plus CY2026 to 31 Aug** — one view per year on source 2193 (and 2194),
  versioned `CY20xx`. Pre-2018 is unusable: TMC coverage is ~4% (3,156 of 61,671 events in 2015) against ~96%
  from 2018.

  | vintage | work zones | events | located | lane count known | significant |
  |---|---|---|---|---|---|
  | CY2018 | 36,376 | 78,373 | 97.4 % | 8.0 % | 15 |
  | CY2019 | 38,738 | 82,399 | 97.7 % | 12.0 % | 40 |
  | CY2020 | 41,520 | 88,157 | 97.1 % | 19.2 % | 54 |
  | CY2021 | 41,190 | 95,377 | 97.6 % | 60.7 % | 218 |
  | CY2022 | 40,947 | 90,617 | 97.5 % | 61.2 % | 306 |
  | CY2023 | 42,528 | 90,770 | 96.9 % | 57.1 % | 273 |
  | CY2024 | 42,688 | 89,583 | 96.6 % | 60.0 % | 220 |
  | CY2025 | 41,613 | 90,929 | 96.6 % | 63.0 % | 211 |
  | CY2026 (to 31 Aug) | 30,132 | 66,079 | 96.7 % | 61.3 % | 165 |
  | **total** | **355,732** | **772,284** | **97.1 %** | — | **1,502** |

  Work-zone volume is flat at 36–43k a year; what changed is **reporting** — lane-closure counts went from
  8 % of zones in 2018 to 63 % in 2025, which is why significant candidates appear to jump after 2020.
  Seasonality (CY2018–CY2025, 325,600 zones): June peaks at 34,409, February floors at 15,992 — a **2.15×**
  swing, with April–October carrying **70.2 %**. Composition: construction 335,337 zones · maintenance 17,463 ·
  utility 2,932. 80.6 % of zones are a single occurrence; the 2,208 zones with 31+ occurrences (0.6 %) carry
  18 % of all event records.

  **New data-quality finding — `active_hours` is not yet reportable.** Hours are summed from TRANSCOM's
  `estimated_duration_mins`, and that field is dominated by never-closed records: single events of up to
  **1,051,059 minutes (~2 years)**. Events over 30 days supply **40–53 % of all recorded hours in 2018–2024
  and 77–81 % in 2025–2026**, while the median duration barely moves (420 → 480 min). Capped at 30 days the
  series is a stable 0.89–1.16 M hours/yr through 2024. **Phase 2 must settle a duration basis before
  publishing exposure** — lane-mile-hours built on the raw field would inherit this.

  **A second significance fragility, beside the lane-count bias.** The Thruway Authority carries ~41,000
  Interstate work zones on I-90 + I-87 with 88 % lane-closure reporting and produces **zero** significant
  candidates: each night is described differently, so no chain spans three consecutive days. The three-day
  test is measured on whatever unit the reporting produces — which is the argument for a project-level unit in
  phase 9.

  Also: view 2799 (impact extents) has **no 2019 or 2020 data at all** and only 9,070 events in 2018, so
  anything built on the impact extent (delay, queues) starts at 2021.

  **Report:** `src/themes/transportny/TransportNY Design System/dms_design_system_v2/reports/workzone_safety/06_work_zone_universe.html`
  — the executive view (totals, the nine-year series, the construction season, composition, where the work is,
  the significance funnel, the three things the dataset cannot yet tell you, and how it was built). Built on
  the TransportNY design system v2 tokens, plain HTML + Tailwind CDN, standalone; indexed in that folder's
  `00_README.md`.

  Housekeeping: the debugging runs left 4 sources, 12 views and 12 tables behind, and the geometry
  re-run left a superseded view pair; all were dropped, leaving exactly one view per source.
  `work_zone/run-stage.js` is the documented driver for a phase gate's live run, since `POST /publish`
  needs a dms-server restart to see the plugin — and it takes `WZ_VIEW_ID`/`WZ_TMC_VIEW_ID` so a re-run
  upserts into an existing view instead of spawning a new table.

## Phase 1a — NYSDOT capital projects → project identity — ✅ COMPLETE 2026-09-09

**Purpose.** Significance is a property of a *capital project*, not of a night of lane closures described in
prose. A PIN carries identity, scope, phase, funding year, region and county; the rule's programmatic review
asks for a representative sample of *significant projects*. So the project data is acquired and joined to
TRANSCOM **before** phase 1's significance rule is finalized, and the TRANSCOM-only heuristic becomes the
fallback for work zones no project can be matched to.

A feasibility spike with a data deliverable: acquire, land, and **measure** the join before committing it.
Runs against view 1947 directly, so it does not depend on the phase-1 spine.

**Inputs.**
- **The eSTIP public API** — `https://api-pwi-prod.ecointeractive.com/api/v1/public`, header `x-system-key`
  read from the portal's public `tenantConfig.json`. `POST /ProjectRevisions/grid` returns **3,238 STIP 26-29
  projects**, one row per PIN (Region, MPO, lead agency, project type, description, funding source, TIP year
  funding, total cost, internal `projectId`, revision `resourceId`), with an XLSX export.
- **Three Mapbox vector-tile layers** named by the API's `/configurations`:
  `digyman.Production-NYSDOT-{Point,LineString,Polygon}`. Every feature carries `PROJECT_ID` (the **PIN**),
  `INT_ID` (= grid `projectId`), `INT_REV_ID` (= grid `resourceId`) and `PROJECT_CA`
  (Highway / Bridge / Transit) — so **project geometry is publicly available, keyed to the PIN**.
- **The STIP workbooks** (`https://www.dot.ny.gov/programs/stip`) for funding and phase detail — one per
  Region, `R1.xls`…`R11.xls` plus `SW.xls`, refreshed monthly.

Full endpoint documentation, including the decoder gotcha (pbf ≥ 5 exports `PbfReader`, not a default
constructor) and the access caveats: `references/workzone_saftey/NYSDOT_eSTIP_API.md`.

> ⚠ The file already in `references/workzone_saftey/references/NYSDOT_STIP_Statewide_Project_List_SW.xls`
> (97 KB) is the **`SW` = Statewide-MPO subset**, not the statewide project list its filename suggests. Every
> Region workbook has to be downloaded separately.

**⚠ Loading rule.** Everything lands in the `npmrds2` pgEnv the simple way — **as a CSV or a GIS dataset
through the standard DAMA uploader**. Converting a downloaded workbook to CSV is a one-off prep step, not
pipeline code, so `data-types/` needs no `xlsx` dependency (open question 5, settled).

**Algorithm (planned).** Harvest the project grid to one CSV; harvest the three tile layers across the NY
bounds at their maxzoom and decode MVT to one GeoJSON per geometry type, deduplicating features that repeat
across tile boundaries on (`INT_REV_ID`, geometry); convert the Region workbooks to one PIN × phase × FFY CSV,
deriving Region from the PIN's first character (`0` → R10, `X` → R11, letters → statewide) and cross-checking
it against the `Region` column. Load all five into `npmrds2`. Then measure four join methods against 2024 NY
work-zone events in view 1947 — **spatial** (project geometry ∩ the event's TMC extent or point — expected to
be the primary method); explicit PIN / contract number in the event description; facility + county + an active
`CONST`-phase FFY window; description-token similarity — reporting yield, precision on a hand-checked sample of
20, method overlap, one-event-to-many-PIN conflicts, and the residual.

**Config.** None yet; the chosen method and its thresholds become descriptor params in phase 9.

**Output.** `nysdot_stip` (moved here from phase 9) plus the project and geometry sources, and a written
verdict: is the PIN join good enough to *define* significance, only to *enrich* it, or still short without
something from NYSDOT — and exactly what we would then ask them for.

**Known limits.** The workbooks carry no geometry and no closure dates, and the eSTIP geometry is a **project
footprint, not a lane-closure extent**. Neither replaces TRANSCOM for *when* lanes close. And `PROJECT_ID` is
not always a NYSDOT PIN — MTA and authority projects use their own numbering, so a PIN join will never cover
Thruway or Bridge Authority work zones, which do appear in TRANSCOM.

**Tests (planned).** Unit: PIN → Region, the PIN/contract-number extractor, the description normalizer.
Integration: the parser over a checked-in trimmed workbook fixture.

**Results log.**
- 2026-09-09 — **Harvested and combined into one project-grain dataset.** Harvester saved for re-use at
  `data-types/external-fetchers/nysdot_estip/` (`fetch.js` + README; four steps — credentials, grid, tiles,
  workbooks, combine). Output `out/nysdot_capital_projects.gpkg`: **3,766 projects**, one row each, mixed
  geometry, EPSG:4326, `ogc_fid` PK, `wkb_geometry`, extent (−79.72, 40.51)–(−71.86, 44.99).
  Sources merged: eSTIP grid 3,228 · STIP workbooks 2,626 · tile geometry 1,180.
  Money sanity-checks: 1,733 construction-funded projects, **$41.2 B total / $25.2 B construction phase**
  across STIP 26-29.
  Geometry shapes: 495 Point · 447 MultiPoint · 161 MultiLineString · 25 LineString · 46 GeometryCollection ·
  4 Polygon · 2 MultiPolygon · 2,586 no geometry.

  **Geometry coverage — the headline finding, and it is a limit:**

  | population | with geometry | of | share |
  |---|---|---|---|
  | construction-funded projects | 437 | 1,733 | **25.2 %** |
  | NYSDOT-agency + construction $ | 331 | 902 | **36.7 %** |
  | no construction funding | 94 | 893 | 10.5 % |
  | tile projects outside the current STIP tables | 649 | 1,140 | — |

  **This is the real ceiling, not a harvest gap** — verified by sampling the detail endpoint: 30/30 projects
  without tile geometry report `mapOptions.isMapped: false` with no bbox, and 10/10 with geometry report
  `isMapped: true`. The rest of the program simply is not mapped publicly.
  PIN keys need no normalization: stripping leading zeros and upper-casing gains **zero** extra matches
  across the three sources.
  Secondary locators found in workbook descriptions (for the ~63 % of construction projects with no
  geometry): route number **28.8 %**, bridge BIN **27.5 %**, interstate **6.7 %**, milepost 1.2 %,
  reference marker **0.7 %** — so reference markers are not the fallback we hoped for; BINs are.

- 2026-09-09 — **Bridge BINs resolve against RIS, and they are the biggest single lift.** The BINs cited in
  project descriptions match `bin_number` in **RIS Legacy v2 2026** (source 2105 / **view 3638**,
  `gis_datasets.s2105_v3638_ris_legacy_v2` — 583,591 segments, 27,790 with a BIN, **17,774 distinct**,
  SRID 4326). Measured: 608 projects cite a BIN, 869 tokens, **857 resolve (98.6 %)**; only 6 projects
  cite a BIN RIS cannot resolve, all railroad-owned (`7…`) bridges off the state roadway inventory.
  Spot-checked geometry for five matched BINs — SRID 4326, 14 m to 3.1 km, centroids landing on the right
  Long Island crossings.

  | population | eSTIP geometry | BIN → RIS | **either** |
  |---|---|---|---|
  | all projects (3,766) | 1,180 · 31.3 % | 602 · 16.0 % | **1,578 · 41.9 %** |
  | construction-funded (1,733) | 437 · 25.2 % | 501 · 28.9 % | **779 · 45.0 %** |
  | NYSDOT + construction $ (902) | 331 · 36.7 % | 175 · 19.4 % | **393 · 43.6 %** |

  **342 construction projects gain a location from a BIN alone** — locatable construction projects go from
  25.2 % to 45.0 %. `bins` (space-separated) and `bin_count` are now emitted by the harvester; the
  BIN → geometry join is done in the database, since a BIN can map to many RIS segments (23 for the Robert
  Moses Causeway) and RIS lives in `npmrds2`.
- 2026-09-09 — **Surveyed the rest of RIS for locators.** RIS 2026 has 152 columns; four more are useful,
  and together they take construction-project location coverage from 45.0 % to a realistic **59–66 %**.

  | tier | locator | RIS columns | adds | running coverage of the 1,733 construction projects |
  |---|---|---|---|---|
  | 1 | eSTIP geometry | — | 437 | 25.2 % |
  | 1 | bridge BIN | `bin_number` (17,774 distinct) | +342 | **45.0 %** |
  | 2 | signed route + county | `signing` + `route_number` (1,053 county×route pairs), `route_display_value` | +224 | 57.9 % |
  | 2 | county route + county | `county_road` (5,810 pairs) | +46 (22 new) | **59.1 %** |
  | 3 | road name + county | `road_name` (168,336 county×name pairs) | +125 new | **66.4 %** |

  Tier 2 and 3 locate a **corridor within a county, not a project extent** — usable to *confirm or rank* a
  candidate PIN alongside county and active construction year, not to draw the work zone. Tier 3 is the
  noisiest: spot-checking showed most road-name hits are the **endpoint cross street** ("on NY27 **from**
  county line **to** Harrison Ave"), not the project's own alignment — still the right neighbourhood, wrong
  centreline. Two matcher lessons: RIS stores routes compactly (`NY27`, `I495`, `US20`) and descriptions use
  that form constantly, so a keyword-only regex (`ROUTE|RT|RTE`) undercounts badly; and road names need
  `\b` anchors or "PARK ROAD" matches inside "NEW HYDE PARK ROAD".

- 2026-09-09 — **RIS is also a reference-marker geocoder — this de-risks phase 7.** `reference_marker` is
  populated on **176,219** segments in a fixed 12-character layout: route left-padded to 4 characters + a
  4-digit region-county code + a 4-digit marker (`"  5S16041044"` = NY5S, RC 1604, marker 1044, Rotterdam,
  Schenectady County). The STIP's own `RM 5S-1604-1048` notation normalizes onto it directly. Phase 7 had
  planned to geocode the NYS crash data's `DOT Reference Marker Location` (present on ~56 % of work-zone
  crashes, which carry **no lat/long**) through the NYSDOT `Ref_Marker` ArcGIS service; **RIS 2026 can do
  that in-database instead**, with no external service and no token. Markers are posted every ~0.1 mile, so
  the lookup is nearest-marker on (route, region-county), not exact equality.

- 2026-09-09 — **Tiers 1 and 2 implemented (owner decision); tier 3 dropped.** Every project now carries
  `location_tier` / `location_method` / `location_resolved_against`, assigned by a new
  `external-fetchers/nysdot_estip/resolve_ris.js` — the only script in the harvester that touches a database,
  read-only against RIS 2026 (view 3638, overridable).

  | tier | method | geometry written | all 3,766 | of 1,733 construction |
  |---|---|---|---|---|
  | 1 | `estip_footprint` | yes | 1,180 | — |
  | 1 | `bin_bridge` (RIS segments for cited BINs) | yes | 398 | — |
  | **1 total** | | | **1,578 · 41.9 %** | **779 · 45.0 %** |
  | 2 | `route_county` | no | 261 | — |
  | 2 | `county_route` | no | 28 | — |
  | **1 or 2** | | | 1,867 · 49.6 % | **1,025 · 59.1 %** |
  | 0 | unlocated | no | 1,899 · 50.4 % | 708 · 40.9 % |

  **Tier 2 geometry is not materialised** — a signed route in a county is tens of miles and thousands of RIS
  segments; writing it on a project row would read as the work-zone extent. Tier-2 rows keep
  `locator_routes` / `locator_county_routes` so the corridor is joinable from RIS on demand, and tier 2 is
  for *confirming or ranking* a candidate project, never for drawing one. Tier 3 dropped as agreed.

  Two geometry bugs found and fixed while building this, both worth remembering: `ST_Collect` over
  MultiLineStrings returns a **GEOMETRYCOLLECTION** that `ST_Multi` will not flatten (use
  `ST_CollectionHomogenize`), and flat-mapping `.coordinates` over possibly-non-line geometries silently
  wrote `coordinates: [null, null]` for **53 projects**. The resolver now throws on an unexpected geometry
  type and has a `validate()` gate that refuses to write if any geometry is empty or null. Verified after
  the fix: 398/398 `bin_bridge` rows are clean MultiLineStrings, and spot-checked centroids land correctly
  (Robert Moses Causeway at −73.27, 40.67 in Great South Bay; CR80 Montauk Hwy at −72.51, 40.88 in Hampton
  Bays).

- 2026-09-09 — **LOADED into `npmrds2`** (owner approval). DAMA **source 2185**, **view 3830**, table
  `gis_datasets.s2185_v3830_nysdot_capital_projects_estip__stip__ris`, version
  `STIP 26-29 (harvested 2026-09-09)`, type `gis_dataset`. Loaded through the platform's own GIS uploader
  (`/gis-dataset/upload` → `layerAnalysis` → `tableDescriptor` → `/gis-dataset/publish`).

  Verified after load: **3,766 rows** · 1,578 with geometry · **SRID 4326 in the values** (one variant) ·
  `ogc_fid` starts at **1**, not 0 · all **7** geometry types preserved · `metadata.columns` = **61** ·
  tile probe at z9/151/188 returns 940 bytes decoding to 22 points + 12 lines. Construction-funded: 1,733,
  tier 1 **779**, tier 1-or-2 **1,043**.

  Two fixes applied after the first publish:
  - **The publish analyzer returned `postGisGeometryType: null`** for the mixed-geometry layer, and the
    worker's fallback takes the type of the *first* non-null geometry — which would have created
    `geometry(POINT, 4326)` and rejected every line. Declared `postGisGeometryType: 'Geometry'` with
    `promoteToMulti: false` in the descriptor before publishing. **Do this for any mixed-geometry upload.**
  - **Auto-generated tile symbology was `fill`-only**, so a map of a mostly point/line layer would render
    nothing. Replaced with three geometry-type-filtered layers (fill / line / circle) on `view.metadata.tiles`.

  And one real bug caught only by inspecting the loaded data: **the STIP `County` column is a LIST for
  multi-county projects** — `'ERIE, NIAGARA'`, `'BRONX, KINGS, NEW YORK, QUEENS, RICHMOND'` — 129 of its 194
  distinct values, on **821 projects**. The resolver was matching the whole string against a single RIS
  `county_name`, so every multi-county project silently failed tier 2. Fixed to split and match any county;
  tier 2 rose 289 → **314** and construction tier-1-or-2 59.1 % → **60.2 %**. The loaded table was corrected
  in place and now matches the file exactly (0/1/2 = 1874/1578/314).

- 2026-09-09 — **Join measured. VERDICT: the project join ENRICHES work zones; it cannot DEFINE
  significance.** Script: `external-fetchers/nysdot_estip/join_transcom.sql` (read-only, four reports plus an
  eyeball sample). Window: NY work-zone family, Jan–Aug 2026 (68,177 events), against the 1,578 tier-1
  projects. The 2024 filter reproduces **93,112** events exactly — the phase-1 reconciliation number.

  **Method 2 (PIN in the event description) is dead:** 28 of 70,490 events carry a `PIN xxxxxx` keyword
  (0.04 %), 50 a PIN-shaped token, 185 a BIN. NYSDOT does not put project numbers in TRANSCOM.

  Spatial join, by threshold:

  | threshold | events matched | of all WZ events | projects hit | precision (decidable pairs) | mean candidates | unambiguous |
  |---|---|---|---|---|---|---|
  | 50 m | 15,336 | 22.5 % | 519 | 75.5 % | — | — |
  | 100 m | 17,825 | 26.1 % | 604 | 69.3 % | 1.81 | 53.8 % |
  | **250 m** | **23,101** | **33.9 %** | **775** | **70.9 %** | **2.24** | **46.7 %** |
  | 500 m | 29,313 | 43.0 % | 908 | 67.5 % | 2.83 | 40.5 % |
  | 1000 m | 37,943 | 55.7 % | 1,080 | 57.1 % | 3.94 | 35.0 % |

  Precision is measured only over **decidable** pairs — those where the project's text cites a route at all,
  which is just **29.3 %** of tier-1 projects. Measuring agreement over all pairs caps it at ~29 % by
  construction and produced a meaningless 13 % on the first pass; that trap is worth remembering.

  Per-event confidence (the practical output):

  | confidence | events | share |
  |---|---|---|
  | A · route agrees ≤250 m | 4,852 | 7.1 % |
  | B · ≤100 m, project states no route | 14,119 | 20.7 % |
  | C · nearby but route disagrees | 4,130 | 6.1 % |
  | D · only >250 m | 14,842 | 21.8 % |
  | E · no tier-1 project within 1 km | 30,234 | 44.3 % |

  **A + B = 27.8 % of work-zone events can be tied to a capital project.**

  **The decisive evidence that a match is co-location, not attribution:** running the same assignment on
  **2024** events against this **STIP 26-29** dataset gives A+B = **31.0 %** — *higher* than the
  vintage-aligned 2026 window. A spatial match carries no schedule information, so it cannot by itself say a
  work zone belongs to a project.

  Hand-check of 12 high-confidence matches — the road is usually right, and three failure classes recur:
  1. **endpoint cross-street citations** — PIN 439095 "I-390 from Canal Bridge to Rt 33A" matches NY 33A
     events because the project merely *names* 33A as its endpoint;
  2. **program / blanket PINs** — 3M2100 "INTERSTATE MOWING AND ROADSIDE CLEANUP", "BRIDGE PAINTING SFY 25":
     one point, no discrete extent, matches anything nearby;
  3. **most TRANSCOM work-zone events are routine maintenance** (sweeping, mowing, sign repair) that no
     capital project covers at all — which is why 44 % have no candidate within a kilometre.

  **Recommendation.** Phase 1's `lib/tma.js` proceeds as originally planned: significance stays
  TRANSCOM-derived (Interstate ∧ TMA ∧ ≥3 consecutive days with lanes affected). The project join becomes an
  **enrichment** — attach candidate PINs with confidence A/B and never gate significance on it. Phase 9's
  sample frame is built on TRANSCOM significance, enriched with PINs where confidence allows.

  **What we would need from NYSDOT to make this definitional** (concrete asks, in order of value):
  1. **PIN geometry for all projects** — the eSTIP portal publishes it for only ~20 % of the program, and
     `mapOptions.isMapped: false` for the rest confirms it is absent, not merely unharvested;
  2. a **project ↔ TRANSCOM event or contract-number link**, which would replace spatial guessing entirely;
  3. a flag distinguishing **discrete projects from program/blanket PINs**, which are unmatchable by design;
  4. **construction start/end dates per PIN** — the STIP gives funding years only, so nothing in the data
     constrains a match in time.

## Phase 2 — AADT + MAP-21 profiles → E1–E3 exposure — ✅ COMPLETE 2026-09-09

**Purpose.** The denominators. Every later measure is a rate — M5's crash rate is per 100 M
VMT-through-zone, M2's delay per vehicle divides by vehicles through the zone — so nothing downstream
is computable until this lands.

**Inputs.** `wz_event_source_id` and `npmrds_meta_source_id`. **Not** a `map21_source_id`: the plan
assumed the hourly volume profiles were a DAMA source, but they are static files in this repo
(`map21/static/CATTLabTrafficDistributionProfiles.js` — 20 profiles × 24 hourly shares summing to 1.0 —
plus the day-of-week and month adjustment factors), required directly by `lib/exposure.js`. The stage
registry was corrected accordingly.

**What made this cheap.** The npmrds meta view drives the MAP-21 profile selector *directly*: its
`congestion_level` and `directionality` values are verbatim the enum strings the profile names are built
from (`NO2LOW_CONGESTION`/`MODERATE_CONGESTION`/`SEVERE_CONGESTION` × `AM_PEAK`/`PM_PEAK`/`EVEN_DIST`),
`functionalClass` is `f_system <= 2 → FREEWAY`, and `map21/helpers.js`
`getTrafficDistributionProfileName()` already assembles the name. It also carries `aadt_unidir` and
`thrulanes_unidir` — directional values, which is what a one-direction closure needs. **No new data
source.**

**Algorithm.** `lib/exposure.js` (pure):
- **E1** `lane_closure_count` — the lanes affected, NULL when no occurrence reported a count.
- **E2** `lane_mile_hours = lanes_affected × Σ anchor length × active_hours(basis)`.
- **E3** `veh_through_wz = Σ_tmc Σ_active-days AADT × month_factor × dow_factor × profile-share`, with
  the day's active share applied; `vmt_through_wz = Σ veh × length`. Each active day is walked
  separately so the month, day-of-week and weekday/weekend profile split all apply per day.

**Three decisions, all recorded on every row:**
1. **Anchor TMCs only.** Impact TMCs are congestion-derived and run downstream with the queue; summing
   exposure over them would inflate it by the length of the queue. The worker filters `tmc_role =
   'anchor'` in SQL and the integration test asserts a 9.9-mile impact TMC never reaches an exposure row.
2. **The duration basis is a parameter.** Phase 1 established that `estimated_duration_mins` is
   dominated by never-closed records, and E2 is literally hours × lanes × length. `duration_basis` ∈
   {`reported_capped` (default, cap `duration_cap_days` = 30), `reported`, `nominal_shift`
   (`nominal_shift_hours` = 8)}. The cap applies **per occurrence**, so a 60-night chain of normal
   shifts is untouched while a single 2-year record is clipped. `lane_mile_hours_nominal` is computed on
   every row whatever the basis, so the sensitivity is always visible.
3. **Unidirectional AADT preferred, bidirectional fallback**, with `aadt_source` recording which was
   used per row (`unidirectional` / `mixed` / `bidirectional`).

**Missing inputs are NULL, never zero**, and `exposure_complete` says whether both E2 and E3 resolved —
consumers filter on that rather than trusting a null. `n_tmcs_with_aadt`, `n_tmcs_with_length` and
`capped_occurrences` expose the rest.

**Output.** `wz_exposure`, one row per work zone, with the zone's geometry taken from the spine so the
layer is mappable. **No Region × month rollup table**: phase 10's `work_zone_measures` is exactly that
source, and standing up a parallel rollup here would fork the rollup schema before phase 10 defines it.
Every dimension a rollup needs is on each row, so it is a GROUP BY away in the meantime. *(Deliberate
deviation from the plan, recorded here rather than silently dropped.)*

**Tests.** 31 unit cases (profile selection incl. the weekend split and the refusal to guess one; all three
duration bases incl. the 2-year record; a 2-TMC, 6-hour zone whose 36 lane-mile-hours are hand-checkable;
the AADT fallback; every missing-input path returning NULL) + 12 integration cases (year-matched spine
resolution, the anchor-only filter proven in SQL, window-replacement ordering, geometry taken from the
spine, `metadata.columns`, the basis switch changing totals).

**Results log.**
- 2026-09-09 — **Built, live-run for all nine vintages, gate met.** `wz_exposure` = **source 2197**, nine
  views CY2018–CY2026, one per year, geometry carried from the spine.

  | vintage | zones | lane-mile-hours | vehicles through | VMT through | computable |
  |---|---|---|---|---|---|
  | CY2018 | 36,376 | 193,544 | 524 M | 651 M | 6 % |
  | CY2019 | 38,738 | 246,532 | 551 M | 546 M | 11 % |
  | CY2020 | 41,521 | 387,305 | 611 M | 713 M | 16 % |
  | CY2021 | 41,190 | 1,151,270 | 651 M | 687 M | 51 % |
  | CY2022 | 40,947 | 1,145,437 | 712 M | 764 M | 52 % |
  | CY2023 | 42,528 | 1,051,745 | 524 M | 552 M | 47 % |
  | CY2024 | 42,688 | 958,264 | 544 M | 605 M | 52 % |
  | CY2025 | 41,616 | 1,434,652 | 684 M | 695 M | 54 % |
  | CY2026 (to 31 Aug) | 30,139 | 1,336,372 | 469 M | 496 M | 53 % |
  | **total** | **355,743** | **7,905,122** | **5.27 B** | **5.71 B** | **38 %** |

  **The phase's central finding: E3 is reportable, E2 is not — yet.** VMT through work zones is steady at
  **546–764 M a year** across eight complete years, because it needs only a traffic count and a length.
  Lane-mile-hours rises **seven-fold** (193,544 → 1.43 M) over the same period and almost none of that is
  more work: E2 needs a reported lane count, and lane-closure reporting went from 2,915 zones in 2018 to
  26,221 in 2025. **E2 is a reporting series wearing the clothes of an exposure series** — reliable within
  a year and between places, not across years.

  **The duration basis matters more than hoped.** Capped (30 days/occurrence) gives 7,905,122
  lane-mile-hours, nominal shift gives 3,527,843 — capped is **2.24×** nominal. Even at 30 days the cap is
  generous (720 h for a single occurrence), and the capped series still carries the artefact: 2025–26 sit
  ~40 % above 2021–24 on the capped basis while moving the *opposite* way on the nominal one.
  **Recommendation changed by the measurement:** prefer the **nominal shift** as the published basis — the
  only one insensitive to a field that cannot be trusted — with the capped variant beside it until closure
  reporting improves. The code default stays `reported_capped`; the basis is a descriptor parameter and the
  nominal figure is on every row regardless.

  **Coverage:** anchor/length 345,533 (97.1 %) · AADT 284,792 (80.1 %) · lane count 160,200 (45.0 %) · all
  three (`exposure_complete`) 136,447 (38.4 %). Pooled completeness is dragged down by 2018–2020, when lane
  counts were on 8–19 % of zones; from 2021 it is ~50 %, and **95.2 %** of significant candidates are
  complete. AADT source: directional 275,534 · bidirectional fallback 9,258 · none 70,951.

  **Validation gate — met, at the low end.** CY2024 VMT through work zones is **0.87 % of NY NHS VMT**
  (HPMS 2024, source 2130: 69.4 B NHS · 115.1 B all roads · 45.2 B freeway · 27.2 B Interstate) — 0.53 % of
  all reported travel, 2.22 % of Interstate travel. The plan expected single digits; the measured answer
  sits at the bottom of that, which the arithmetic demands. Cross-checked internally: 33,960 zones with a
  volume × 1.87 active days × 6.9 h/day ≈ 440,000 zone-hours, and 544 M vehicles across those is **~1,235
  vehicles per hour** of active work zone — right for a segment carrying ~20,000 vehicles a day
  directionally. Region 11 is **not** the largest by VMT — Region 8 (Hudson Valley) is, 1.42 B against
  1.20 B, on 51,218 work zones, though only 25 % of them are fully computable.

  **Known over-statement, to fix in phase 3.** Exposure spreads a zone's active hours evenly across the
  day, because the spine records how long a zone ran but not when. Most lane closures are night work, which
  sees materially less traffic than the daily average, so E3 is more likely high than low. Phase 3 reads
  speeds by five-minute epoch and will make an hour-of-day exposure possible.

  **A phase-1 bug found and fixed while building this.** Every spine timestamp was **4–5 hours late**: the
  pg driver reads `timestamp without time zone` as a Date in the process's timezone, and `.toISOString()`
  then renders it shifted — a zone starting 2024-12-31 23:39 was stored as 2025-01-01 04:39. Survivable for
  annual totals, fatal for phase 3's hour-of-day work. The spine now reads those columns as text and
  `lib/dedupe.js` keeps the source's own wall clock (`toDate` / `naiveString`), with three regression tests.
  **All nine spine vintages were rebuilt.** Also fixed: `deleteWindowSQL` used `<= end::date` — midnight on
  the end day — so rows later that day survived a delete and were missed by a read (50 of CY2024's zones
  start after midnight on 31 December). Windows are now half-open to end + 1 day.

  Report: `reports/workzone_safety/08_work_zone_exposure.html`.

## Phase 3 — NPMRDS speeds (ClickHouse) → M1 exceedance — NOT STARTED

**Purpose.** How much of a work zone's active time ran below an acceptable speed — the
core mobility measure.

**Inputs.** `wz_event_source_id`, `npmrds_source_id` (583 / CH view 982, 5-minute speeds),
`npmrds_meta_source_id` (reference speeds, length).

**Algorithm (planned).** `ch.js` gains two query builders: an in-window extract
(event × tmc × 5-min: speed, travel time) and a **baseline** extract — the same TMC, same
hour-of-day and day-type, 12 months prior (configurable), **excluding epochs that overlap
any other TRANSCOM event on that TMC** (bounds from 2799 / the spine) → median and
15th/85th percentiles. Reference speed = baseline 85th-percentile off-peak.
`lib/baseline.js` holds the (pure) SQL builders; `lib/measures.js` holds M1 =
`epochs_below / epochs_active` per event, then a Region×period share weighted by active
hours. **Both** thresholds are reported — absolute (35 mph) and relative (60% of
reference) — never one silently.

**Output.** `wz_speed` (event × tmc × hour-of-day), plus M1 rows in `work_zone_measures`.

> ⚠ **Create `wz_speed` with the phase-6 differential columns from the start** (nullable,
> filled by the `differential` stage). All views of a source must share one column list, so
> adding columns in phase 6 would force a new source and orphan the phase-3 views.

**Tests (planned).** Unit: SQL-builder snapshots; exceedance math over a recorded CH
extract for one real event in `tests/fixtures/` (the `map21/tests/golden.unit.test.mjs`
freeze pattern). Integration: the worker with a stubbed CH client returning that fixture.

**Validation (planned).** Three known 2024 events (an I-495 NYC, an I-87 Albany, a rural
I-81): M1 at 35 mph vs at 60% of reference, eyeballed against the incident-view speed
grid; both exceedance shares documented.

**Results log.** —

## Phase 4 — Event×TMC delay + excessive delay → M2 — NOT STARTED

**Purpose.** Work-zone delay in vehicle-hours, per vehicle, and as a share of all delay.

**Inputs.** `wz_event_source_id`, `transcom_event_tmc_source_id` (1635 / 2799 — `delay`,
`raw_delay`, `cost`), optionally `excessive_delay_source_id` (1469 / 2633) and
`wz_exposure_source_id`.

**Algorithm (planned).** Join `wz_event_tmc` to 2799 for per-event veh-hrs; divide by
`veh_through_wz` for delay per vehicle; flag above `delay_per_veh_min`. Region×year share =
WZ delay ÷ total (2633), and WZ ÷ the `construction` bucket as a consistency check.

**Output.** M2 rows in `work_zone_measures`. (If a per-event delay table proves necessary
it is a NEW source — `wz_delay` — not extra columns on an existing one.)

**Validation (planned).** 2024 statewide WZ delay reconciles to **40.7M veh-hrs** (the TSMO
work-zones build) within the dedupe delta; Region ranking R11 ≫ R10 > R8
(31.96 / 3.90 / 3.34M).

**Dependency.** `transcom-event-tmc-accumulating-view.md` — view 2799 ends 2025-11; note
the freshness gap in the output metadata.

**Results log.** —

## Phase 5 — Speeds + TMC ordering → M3 queue — NOT STARTED

**Purpose.** Queues are the impact the public and the rule both care about, and they are
not visible in a zone-only speed measure.

**Inputs.** `wz_event_source_id`, `npmrds_source_id`, `npmrds_meta_source_id`
(`tmclinear`, `road_order`).

**Algorithm (planned).** `lib/queue.js` (pure): per epoch, walk upstream from the zone's
first TMC along `tmclinear`/`road_order` while speed < `queue_speed_mph`, summing lengths →
`queue_len_mi`; require ≥ 2 consecutive epochs (the Boston MPO / Maryland connected-queue
rule) before counting a queue as present. M3 = share of significant candidates whose max
(and 95th-percentile) queue exceeds `queue_threshold_mi`, plus duration and % time present.

> `tmclinear` is unique only *within* an NPMRDS region — filter by `tmclinear` **and**
> `left(tmc,3)` when walking a corridor, or two regions' linears collide.

**Output.** `wz_queue` (event × 5-min epoch), plus M3 rows.

**Validation (planned).** The same three events as phase 3; max/95th queue plausible against
corridor length; one compared to the incident-view congestion-window bands.

**Results log.** —

## Phase 6 — M4 speed differential (no new dataset) — NOT STARTED

**Purpose.** A zone can meet an absolute speed threshold and still be dangerous if traffic
drops 30 mph at its taper.

**Inputs.** `wz_event_source_id`, `wz_speed_source_id`.

**Algorithm (planned).** Fill the differential columns on `wz_speed`: approach speed (1–2
TMCs upstream over the same epochs), `approach − in-zone`, `during − baseline`, and flags
above `differential_mph`. Adds no columns — see the phase-3 warning.

**Tests / validation (planned).** Unit on the phase-3 fixture; the same three events.

**Results log.** —

## Phase 7 — NYS open crash data (+ CLEAR adapter) → M5 — NOT STARTED

**Purpose.** The safety half of the rule.

**Inputs.** Socrata `e8ky-4vqe` (case) and `ir4y-sesj` (individual, KABCO), saved as
`file_upload` views first; optionally a NYSDOT CLEAR extract; `ref_marker_source_id` (the
cached NYSDOT reference-marker table); `wz_event_source_id` and `crash_source_id` for the
join.

**Algorithm (planned).** Work-zone flag = `traffic_control_device IN (Construction /
Maintenance / Utility Work Area)`. Geocode `DOT Reference Marker Location` via the NYSDOT
`Ref_Marker` service (cache the marker table as a source) → point + Region; the open data
carries **no lat/long**, and ~56% of work-zone crashes carry a usable marker.
`crash_join` does the spatial-temporal join to `wz_event_tmc` (buffer + active window,
including the upstream queue TMCs, per MMUCC), then rates per 100M VMT-through-zone.

**Output.** `nys_crashes_open`, `nys_crashes_clear`, `wz_crash`, M5 rows.

**Validation (planned).** Statewide work-zone-coded counts reproduce
**1,289 / 1,220 / 1,331 / 1,384** (2021–24) and severities **3,895 / 1,020 / 299 / 10**;
reference-marker geocode success ≈ 56%; the county top-6 matches the research probe.

**Results log.** —

## Phase 8 — Intrusions / worker injuries, WZTC QA ratings → M6, F1 — NOT STARTED

**Purpose.** The two measures that need NYSDOT-held data (Tier 2). Schemas and loaders are
built now so the pipeline is ready when the files land.

**Inputs.** `file_upload_view_id` per loader.

**Algorithm (planned).** Schemas designed from the AWZSE report glossary (intrusion,
work-zone crash) and the Bryden & Andrew QA form. Loaders no-op until a file exists.

**Gate.** Schema + unit tests only; live validation deferred to data delivery.

**Results log.** —

## Phase 9 — The significant-project sample frame — NOT STARTED

**Purpose.** The 2030 programmatic review needs a defensible sample of significant projects.
Acquisition, parsing and join feasibility live in **phase 1a**; what is left here is
productionizing the crosswalk on top of phase 1a's verdict.

**Inputs.** `wz_event_source_id`, `nysdot_stip_source_id`.

**Algorithm (planned).** `stip` becomes the windowed, idempotent monthly loader for all
Region workbooks. `sample` crosses the matched PIN universe (phase 1a's chosen method) with
phase-1 candidates, recording `match_method` and a confidence per row; unmatched significant
candidates are listed for NYSDOT's PIN-geometry request.

**Validation (planned).** The 2024 match rate reproduces phase 1a's measured rate;
10 hand-checked.

**Results log.** —

## Phase 10 — Measures rollup + methodology chapter — NOT STARTED

**Purpose.** One long-format source the DMS pages bind, and the written methodology the
rule actually requires.

**Algorithm (planned).** `work_zone_measures`: Region × facility class × year/month ×
measure, with `measure_id`, value, numerator, denominator, the thresholds that produced it
and `n_events` in every row; `metadata.columns` with a `measure_id` enum. A `schedulables`
entry (monthly, windowed) is **designed and not enabled**.

**Also delivers.** `reports/workzone_safety/07_pipeline_methodology.md` — what each measure
means, data lineage, thresholds, baselines and coverage caveats — linked from
`00_README.md` and the HTML report footer. And a `work_zone` page in the platform
documentation hub.

**Validation (planned).** A full 2024 + 2025 run end-to-end; numbers frozen in a golden
fixture; this README's results logs complete.

**Results log.** —

---

## Gotchas (carried in from elsewhere; add to this list as phases land)

- **`metadata.columns` is the most-forgotten step.** Without it the Table page, DataWrapper,
  the filter UI and every UDA page section render an empty grid.
- **DAMA tiles carry only `ogc_fid`.** No `ogc_fid`, no map layer.
- **SRID lives in the values.** A `geometry(...,4326)` column holding SRID-0 geometries
  produces empty tiles with no error.
- **DMS calc columns and falcor attribute keys cannot contain commas** — watch measure
  labels and any derived column name a page will bind.
- **Page-variable empty leaves** become `IN ('')` and blank a whole section; smoke-test any
  page bound to these sources before a deploy.
- **`tmclinear` is unique only within an NPMRDS region** (phase 5).
- **`round(double, int)` fails in Postgres** — cast to `::numeric` first.
- **Region values are formatted `Region NN - Name`** in the TRANSCOM-derived tables.

## Open questions

1. Threshold defaults — confirm with NYSDOT work-zone program staff before phase 3. The
   pipeline stays parametric regardless.
2. Baseline window: 12 months prior (default) vs 24 (FHWA HOP-20-029 used two years).
3. Hourly volume profile for E3: MAP-21 CATT profiles (by f_system / urbanized area) vs
   TMAS continuous counts. Starting with the MAP-21 statics; the swap is a phase-2 note.
4. TMA county boundaries — Census urbanized-area / TMA designations vs the HDM Appendix 16B
   maps. Record the choice in `lib/tma.js`.
5. STIP: an in-process `xlsx` dependency, or ask NYSDOT for the eSTIP CSV? (Phase 1a. `xlsx@0.18.5` is the
   last npm-published SheetJS and carries known advisories; SheetJS now ships from its own CDN, so a CSV or
   API feed from NYSDOT would remove the question.)
6. Does the CLEAR extract carry lat/long or reference markers only? The adapter handles
   both.
