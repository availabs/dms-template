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
| `wz_event` | one deduped work-zone event | `spine` (source **2193**, live) |
| `wz_event_tmc` | event × tmc × active window | `spine` (source **2194**, live) |
| `wz_exposure` | event (+ Region×month rollup) | `exposure` (source **2197**, live) |
| `wz_speed` | event × tmc × hour-of-day | `speed` (source **2206**, live), `differential` |
| `wz_queue` | event × 5-min epoch | `queue` |
| `nys_crashes_open` / `nys_crashes_clear` | crash case | `crashes_open` / `crashes_clear` |
| `wz_crash` | crash ∩ wz_event | `crash_join` |
| `wz_intrusions`, `wz_qa_ratings` | as delivered | `intrusions`, `qa_ratings` |
| `nysdot_stip` | PIN × phase × fund year | `stip` (phase 1a) |
| `wz_significant_sample` | candidate project | `sample` |
| `wz_delay` | one work zone (delay, per-vehicle) | `delay` (source **2213**, live) |
| `work_zone_measures` | Region × facility class × period × measure | `measures` (phase 10) |

All under app `npmrdsv5`, pgEnv `npmrds2`.

## Tests

```bash
node data-types/run-tests.js work_zone              # both layers
node data-types/run-tests.js work_zone --unit       # vitest, pure
node data-types/run-tests.js work_zone --integration
```

Two layers, per the `run-tests.js` convention: `tests/*.unit.test.mjs` are pure vitest
files (no DB, CH, or network); `tests/*.integration.js` are node scripts against the
dms-server sqlite harness. No test contacts TRANSCOM, RITIS, Socrata, ArcGIS **or ClickHouse** —
recorded extracts live in `tests/fixtures/`.

Green through phase 4: **256 unit + 80 integration**.

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

## Phase 3 — NPMRDS speeds (ClickHouse) → M1 exceedance — ✅ COMPLETE 2026-09-09

**Purpose.** How much of a work zone's active time ran below an acceptable speed — the core
mobility measure, and the one 23 CFR 630.1006(b) names as an example.

**Owner decisions.** The **primary reported threshold is 10 mph below the posted speed limit, floored at
20 mph** (`m1_posted`). Vehicle class = **all vehicles**. Observation density **C included**, with the
A/B/C mix recorded per cell so a C-heavy zone stays identifiable. Baseline window **12 months**. All four
thresholds are computed on every row and every run stamps the values that produced its figures, so a
different drop or floor is a re-run rather than a redesign.

**Inputs.** `wz_event` (2193) + `wz_event_tmc` (2194) from phase 1 · `npmrds` CH view 982 (source 583,
14.6 B rows, 5-minute) · `npmrds_geometry` meta view 984 (source 582 — `miles`, `avg_speedlimit`) ·
`pm3` source **2135**, per-year views (`speed_pctl_85`, `phed_threshold_speed`) · TRANSCOM event×TMC
view **2799** for the active epoch windows.

**Output.** `wz_speed` — DAMA source **2206**, one row per (work zone × TMC × hour-of-day), nine
vintages CY2018–CY2026. Created **with phase 6's differential columns** (nullable), so phase 6 needs
no new source. 38 columns: `m1_posted` first among the measures, `posted_threshold_speed` and
`posted_speed_drop_mph` making every row self-describing.

### The primary measure: posted limit minus 10 mph

**Owner decision 2026-09-09.** The reported threshold is
`max(20, avg_speedlimit - posted_speed_drop_mph)` with `posted_speed_drop_mph` = 10, capped at the posted
limit itself. `m1_posted` is the primary column; the other three thresholds stay on every row as
comparators so the choice can be revisited without rebuilding the dataset.

| column | below what |
|---|---|
| **`m1_posted`** | **`max(20, posted limit - 10)`** -- PRIMARY |
| `m1_absolute` | `speed_threshold_mph` (35 mph default) |
| `m1_relative` | `reference_speed_pct` x PM3 `speed_pctl_85` |
| `m1_fhwa` | `max(20, 0.6 x avg_speedlimit)` -- FHWA's PHED anchor |

**Why it is the right primary -- measured, CY2024 conflated windows.** A fixed threshold cannot be
compared across facility types, because it interacts with the speed limit rather than with the work:

| | zones | segment-hrs | mean speed | mean threshold | < posted-10 | < 35 mph | < 60 % FF |
|---|---|---|---|---|---|---|---|
| not Interstate | 22,464 | 250,782 | 37.8 | 35.3 | **38.4 %** | 46.6 % | 18.5 % |
| Interstate | 15,929 | 162,354 | 56.8 | 49.2 | **17.3 %** | 10.3 % | 9.4 % |
| ratio | | | 0.67x | 0.72x | **2.21x** | 4.54x | 1.97x |

The fixed 35 mph threshold turns a 0.67x difference in observed speed into a **4.53x** difference in
measured performance. `posted - 10` turns it into **2.21x** -- it halves the distortion.

**The 20 mph floor does most of that work, and it is not a rounding detail.** On cells where it binds
(segments posted <= 30 mph):

| | zones | segment-hrs | mean threshold | mean speed | < posted-10 | < 35 mph |
|---|---|---|---|---|---|---|
| threshold above the floor | 35,652 | 382,176 | 41.7 | 47.1 | 29.3 % | 28.0 % |
| held at the 20 mph floor | 2,741 | 30,960 | 20.0 | 23.6 | 39.6 % | **86.1 %** |

Those 2,741 work zones sit on streets whose **normal operating speed is
23.6 mph**. A fixed 35 mph threshold flags **86.1 %** of their
active time -- it is measuring the street, not the work zone. Where the floor does not bind the two
thresholds are close (29.3 % vs 28.0 %), so nearly all of the
statewide difference between the measures comes from this one band of slow roads.

Two guards, both recorded in `lib/baseline.js`:
- **The floor is capped at the posted limit.** Without it, the 4 anchors posted <= 10 mph would be
  measured against a threshold above their own limit and report 100 % exceedance.
- **The threshold is computed from the POSTGRES meta view.** The ClickHouse copy of `avg_speedlimit` is
  empty for every year -- the same trap that collapsed the existing 2021-2025 excessive-delay series to a
  uniform 20 mph floor. Ours is populated on 100 % of anchors (median 50 mph, p05 30, max 69.7).

**The reference speed for `m1_relative` still comes from PM3**, not from a baseline derived here, so no
threshold in this dataset can be biased by whether the baseline excluded other work zones. Missing epochs
are excluded, not interpolated: M1 is a share of time, and interpolating would invent it.

### M1 is a ZONE-HOUR measure, and `wz_speed` is the evidence underneath it

> **Percent of active work-zone HOURS in which the AVERAGE SPEED WITHIN THE ZONE falls below the
> threshold.**

The first implementation of this phase reported the share of five-minute **epochs** on **individual
segments** and called it M1. That is a different numerator and a different spatial unit, and it gives a
different number. `lib/m1.js` implements the measure as defined; `wz_speed` remains the evidence table.

Three decisions the definition forces, none of which `wz_speed` makes:

1. **The unit of time is an hour**, classified once — below threshold or not. An hour is counted only
   when at least `min_epochs_per_hour` (default **6**) of its twelve five-minute slots carried an
   observation; hours that fail the floor are reported as `hours_too_sparse`, not silently dropped.
2. **The unit of space is the zone.** "Average speed within the work zone" is the **space-mean** speed —
   total distance travelled over total travel time across the whole extent — not a mean of per-segment
   speeds, which would over-weight short segments. The space-mean is harmonic, so it is pulled toward
   the congested part of a zone. That is why M1 comes out **above** the epoch share (CY2024:
   31.8 % against 28.4 %) rather than below it.
3. **The threshold applies to the zone**, so a zone spanning segments with different posted limits gets
   one length-weighted limit, floored **after** the weighting.

Both rollups are published on every view: `metadata.m1` (the measure) and `metadata.statewide_m1` (the
epoch-level evidence). `tests/speed.integration.js` asserts they differ, because publishing one as the
other is the bug this section exists for.

### M1 must be reported as a difference, on a named universe

This is the phase's most consequential finding and it came out of comparing our practice to peers'.

**The universe is not the one peers report on.** CY2024 holds **42,688** zones of which
**32,918 (77.1 %) last under twelve hours** — median
span **6.0 h**. They are work *shifts*. Illinois averages **1,673
work zones a year** from project records that explicitly include temporary maintenance; Ohio monitors
**25-30 key projects a season**. So M1 is rolled up per tier
(`metadata.m1_by_tier`): `all`, `week_plus`, `significant`, `interstate`, `not_interstate`. The
comparable sets are our **220 significant candidates** (~8x Ohio's monitored set) and
our **3,275 zones active a week or more** (~2x Illinois).

**A level reports the road; the difference reports the work.** Measured CY2024, M1 during the work
against the same segments in the same hours of day a year earlier:

| threshold | significant candidates (216 zones, 11,619 hrs) | | | week-plus (2,968 zones, 344,995 hrs) | | |
|---|---|---|---|---|---|---|
| | before | during | change | before | during | change |
| posted - 10 | 7.0 % | 20.4 % | **+13.4 pts** (2.9x) | 27.5 % | 31.3 % | +3.8 pts |
| 35 mph | 4.7 % | 15.2 % | **+10.5 pts** (3.2x) | 34.5 % | 34.6 % | **+0.1 pts** |
| 60 % of 85th pctl | 3.9 % | 13.7 % | **+9.8 pts** (3.5x) | 12.7 % | 13.9 % | +1.2 pts |

Read the 35 mph row on the week-plus universe: **34.6 % during against
34.5 % before — a change of +0.1
points.** As a level it is more than double the significant candidates'
15.2 % and would rank those zones the worse performers; as a difference the
impact is nil. **The level was reporting chronic congestion on slow roads.** Publishing a bare level
inverts the conclusion.

Read the significant-candidate columns across the three thresholds: ratios of
2.9x, 3.2x
and 3.5x. **Reported as a difference, the threshold
choice barely matters.** It only dominates when a level is published — which reframes the whole
threshold question.

**The aggregate and the typical project disagree.** The programme total rose
2.9x, yet **112 of
216 individual significant projects came in BETTER than their own baseline** against
99 worse; 101 never dropped below threshold at all and
the median project sits at 2.2 %. A few large impacts carry the total. Both
are true and they support opposite headlines.

**The during-vs-before finding replicates on an independent year.** The same computation on CY2023's
271 significant candidates: posted-10 24.1 % vs
9.1 % (2.6x), 35 mph 20.5 % vs
6.0 % (3.4x), relative 15.6 % vs
4.2 % (3.7x) — against CY2024's 2.9x/3.2x/3.5x
— and again slightly more than half the projects (142 of 271)
came in better than their own baseline. Two years, two largely different zone sets, the same answer.

`scratchpad/m1_baseline_analysis.js` resolves its spine/tmc/pm3 views from DAMA by vintage rather than
hardcoding them, so it runs for any year and tier: `node _m1b.js <significant|week_plus> <year>` from
`data-types/`.

**The significant-tier series is too small to be stable** — it moved between 7 % and 35 % across the
nine vintages on composition alone (14-307 zones per year). Report it per project and monthly, as Ohio
does, not as a statewide time series.

### Five rules for reporting M1

1. **Never publish a level alone.**
2. **Always name the universe and its zone count.**
3. **Pair the share with a count of hours** (2,376 of 11,619).
4. **Report the aggregate and the typical project together.**
5. **Report per project, monthly, for the significant tier** — Ohio's and FHWA HOP-20-029's form.

Peer practice is recorded in `scratchpad/peer_practice.md`; the during-vs-before analysis is
`scratchpad/m1_baseline_analysis.js` (its SQL builders live in `lib/m1.js` and belong in phase 10's
`work_zone_measures` when that lands).

### Left for phase 10, deliberately

**Per-zone M1 is not queryable from DAMA.** `metadata.m1` and `metadata.m1_by_tier` carry the rollups,
but the per-zone rows behind them are not persisted anywhere — so the per-project monthly report this
phase recommends cannot yet be built from the dataset, only from the analysis script. That is phase 10's
`work_zone_measures` (Region x facility class x period x measure), and `lib/m1.js`'s
`zoneHourM1SQL` / `zoneBaselineM1SQL` / `joinDuringAndBaseline` are the builders it should use.

**`zoneBaselineM1SQL` does not run in the worker.** The during-vs-before comparison is computed by
`scratchpad/m1_baseline_analysis.js` on demand, not stamped per vintage. It was left out of the speed
stage on purpose: the baseline scan is a second full year of ClickHouse reads and the reportable
universes are the significant and week-plus tiers, not all 38k zones, so it belongs with the measures
rollup rather than in the evidence build. Verified reproducible on CY2023 and CY2024.

### The posted-limit caution, on the record

**NCHRP Synthesis 482** warns that comparing observed speeds to the posted limit alone is confounded,
and the state-practice review found **no peer uses the posted limit as its sole reference** — all
compare against pre-construction conditions. The confound: work zones often carry a *reduced* posted
limit, so "below the posted limit" can measure compliance with a temporary restriction rather than
mobility impact. Our `avg_speedlimit` is the segment's **normal** limit from the roadway inventory, so
`posted - 10` measures "traffic ran more than 10 mph below what this road is normally posted for" — a
defensible impact measure, not a compliance one. **Reporting it against the pre-construction baseline
neutralises the confound**, because the same posted limit sits on both sides of the comparison.

### The active window is the hard part

M1's denominator is "epochs observed **while the zone was active**", and getting that window right
turned out to be most of the work. Three bugs, all found by measuring rather than by reading:

- **A 2799 row is a SPAN, not a day.** `bound_start_date/time` → `bound_end_date/time`. Keying on the
  start date measures only the first day, and applies to it an epoch range whose end belongs to a
  later day — usually an empty range. **12.8 % of CY2024 rows span multiple days** (up to 27).
- **Same-day rows whose end epoch precedes its start (0.8 %)** are night shifts crossing midnight. Read
  literally they are empty ranges and the shift disappears — and night is exactly when a work zone's
  speed impact is cheapest, so dropping it biases M1 *upward*.
- **Epoch bounds are half-open.** `bound_end_time` reaches **288**, one past the last epoch of the day,
  so a whole active day is `[0, 288)` and the measure joins with `< epoch_to`.

Expanding the spans onto the day grid recovered **+21.8 % of measurable active TMC-hours** on CY2024
(469,299 → 571,441) and 1,790 more zones. **The baseline's contamination exclusion had the identical
bug**, leaving the later days of every multi-day event inside the baseline it exists to clean
(677,567 → 697,499 excluded TMC-days).

### View 2799 has holes, so there are two window sources

2799 is the event→TMC conflation and it is **not complete**: no rows at all for **2019 and 2020**, only
9,070 events in 2018 against 134,337 in 2024, and ~10 % of zones missing even in a good year. On 2799
alone, M1 is simply blank for two of the nine vintages.

The anchor TMC does **not** come from 2799 — the spine reads it from the event's own `tmclist` — so for
those zones the segment is known and only the window is missing. It is recovered from the anchor row's
own `first_start`/`last_end`, converted to the epoch grid (floor for the start, ceil for the end),
which reproduces 2799's bounds exactly where both exist: an event 04:25–09:45 gives epochs 53–117
either way. Same measure on a coarser input, not a different measure.

Every row records which it used in **`window_source`** (`'2799'` | `'event'`) and the split is stamped
on the view, because the fallback is genuinely weaker: the anchor row's span is the **chain's** span,
so a recurring chain can claim days it was not working. Measured on CY2018, hours per zone are
median 3.0 / p90 18.6 on conflated windows against median 4.8 / **p90 54.2** on derived ones.
`MAX_SPAN_DAYS = 30` (matching phase 2's duration cap) bounds the damage; the flag makes those rows
filterable, and **the phase-3 report's headline series is the conflated windows only**, with the
derived series shown beside it rather than blended into it.

### Why the baseline still exists

Context and phase 6, not M1. Per TMC: same hour-of-day, same day-type (weekday vs weekend), over the
12 months before the window, with whole days removed where that TMC carried any work zone — median
plus 15th/85th percentiles. That answers "what was normal at this hour", which is what a
during-vs-baseline drop (M4) needs and what makes an M1 number interpretable. Contamination is removed
at the **(tmc, date)** level, not epoch-precisely, because a work zone's effect spills past its
reported window through setup, teardown and residual queueing — over-excluding in the safe direction.
Cost on CY2024 anchors: 9.7 % of TMC-days. Note that for **CY2021 nothing could be excluded at all**,
because the baseline year is 2020 and 2799 has no 2020 rows.

### ClickHouse: join order is load-bearing

The measure runs entirely in ClickHouse — three run-scoped `Memory` staging tables (tmc → miles and
thresholds, active epoch windows, baseline exclusions), one query, ~300 k (zone × tmc × hour) cells
back. Two things make it work at all:

- **ClickHouse builds its hash table from the RIGHT side of a join**, so the 14.6-billion-row speed
  table must be on the **left** and the small staged tables on the right. With them the other way
  round the query reached **44 GiB and ~3 billion rows read without finishing**. Correct order: a
  full CY2024 run in **45.6 s**.
- **The date bound is not optional.** Without `n.date BETWEEN …` ClickHouse cannot prune the speed
  table's partitions from the join alone and scans every year for every anchor TMC. `measureSQL`
  now *throws* if the window is missing.

Also: the exclusion is a `LEFT ANTI JOIN`, not a tuple `NOT IN` over ~700 k pairs; and the DAMA CH
adapter is a **passthrough** — `query({query, format})` with `.json()` on the result, `exec({query})`
for DDL, whose response stream must be destroyed or every statement logs a socket warning.

### Files

| file | what |
|---|---|
| `lib/baseline.js` | pure. Baseline window arithmetic, `fhwaThresholdSpeed`, `speedExpr`, and the two SQL builders (`baselineSQL`, `measureSQL`). The module note carries the threshold reasoning and the two divergences. |
| `lib/m1.js` | pure. **M1 as the rule defines it** — `zoneSpeedExpr` (space-mean), `zoneHourM1SQL` (zone x date x hour), `zoneBaselineM1SQL` (the same over the pre-construction year), `rollupZoneM1`, `rollupZoneM1ByTier`, `joinDuringAndBaseline`. |
| `lib/measures.js` | pure. Epoch-level evidence: `m1ForZone` (three shares, epoch-weighted speed means, `is_measurable` at `min_epochs` = 12), `groupCellsByZone`, `rollupM1` (epoch-weighted **and** zone-mean, plus `zones_skipped`). |
| `ch.js` | `stripChPrefix`, run-scoped staging names + DDL, `chExec` / `chQueryRows` / `insertRows`, and `sweepStaleStaging` (Memory-engine orphans from killed runs). |
| `workers/speed.js` | resolves spine / tmc / meta / CH speeds / PM3-by-version, reads the zones and the two window sources, stages three CH tables, runs the measure, **drops the staging in `finally`**, shapes rows, rolls up statewide. |
| `sql.js` | `wzSpeedTableDDL` (with `window_source` and phase 6's columns), insert builder, column metadata, and `vintageVersion`. |

**Speed is derived, not stored.** The NPMRDS table holds travel time in seconds:
`speed = miles × 3600 / travel_time_all_vehicles`. Every speed therefore depends on the TMC's length
and so on the right **year's** meta vintage — the meta view is one row per `(tmc, year)`, so the read
is `DISTINCT ON (tmc) … WHERE year <= metaYear ORDER BY tmc, year DESC`.

### Tests — 226 unit + 67 integration, none touching ClickHouse

- `tests/baseline.unit.test.mjs` (38) — `postedDropThresholdSpeed` (the drop, the 20 mph floor, the cap at
  the posted limit, the configurable drop, the fractional limits the meta view actually carries), plus
  SQL-builder shape including the assertions that pin the bugs above: the speed table on the LEFT of every
  join, the epoch range half-open, the required date bound, and the primary threshold read from the staged
  table rather than recomputed inline.
- `tests/measures.unit.test.mjs` (26) — golden exceedance arithmetic including the primary threshold,
  whose per-case counts are frozen in the fixture as `expected_below_posted` (computed by hand from the
  recorded travel times, so the test checks the code against an independent number). On the I-495 case the
  primary threshold flags 51 of 65 epochs against 49 absolute / 48 relative / 38 PHED, and on the I-81 case
  it still flags zero — the check that a looser threshold does not manufacture exceedances. Golden
  arithmetic over
  `tests/fixtures/npmrds_speed_cells.json`, two **recorded real** cases: I-81 `104N04116` 2024-09-10
  epochs 156–228 (73 recorded epochs, 59–73 mph, 0 exceedances) and I-495 `120+04939` 2024-02-07
  epochs 53–117 (65 recorded epochs, 11–61 mph, 49 below 35 / 48 below 32.80 / 38 below 30). The
  fixture was recorded with an inclusive end epoch, before the half-open decision above, so it holds
  one epoch past each zone's close; it tests the exceedance **arithmetic**, and the SQL's epoch
  convention is asserted separately in `baseline.unit.test.mjs`.
- `tests/m1.unit.test.mjs` (28) — the M1 definition: hours not epochs, space-mean not mean-of-speeds,
  the half-hour observation floor, the floor applied after length-weighting, the tier rollups (which give
  materially different answers, and must), and the hour-weighted vs zone-mean split that keeps the
  aggregate and the typical project from being confused.
- `tests/sql.unit.test.mjs` (18) — descriptor/insert-list parity for all four sources (the check that
  caught both `metadata.columns` omissions), `vintageVersion` (including the partial-year label that the phase-1
  report's seasonality filter missed) and `deleteWindowSQL`'s half-openness.
- `tests/speed.integration.js` (19) — the worker against a faked Postgres **and** a faked ClickHouse:
  staging created and dropped even when the measure throws, the window-expansion SQL shape, the
  fallback window source and its stamped counts, the FHWA threshold from metadata, phase-6 columns
  present, the window replaced before insert, and the statewide rollup.

### Gotchas earned in this phase

- A **backtick inside a JS template literal** breaks the SQL builders' parse. It happened twice. No
  backticks in comments inside `lib/baseline.js`'s query strings.
- **Do not edit a module while a run is in flight** — a mid-run edit to `lib/baseline.js` killed four
  vintages with a syntax error.
- The statewide rollup is built from the **shaped rows**, not the raw CH cells: the measure can return
  cells for zones outside the window (a TMC's active windows are not partitioned by our window), and
  rolling up the raw cells silently counts them.
- **PM3 lags the inventory.** PM3's newest vintage is 2025 while the inventory has CY2026, so
  `resolveVersionView` falls back to the newest numeric vintage and records `pm3_version_fallback`.
  A missing *older* year is still an error — that would mean PM3 is incomplete behind us.
- **The vintage label is stamped by the worker now**, in the same UPDATE as the table name. It used to
  be a hand-run SQL script, so a re-run published `version = NULL`.

### Results log — live on `npmrds2`, 2026-09-09

`wz_speed` source **2206**, nine vintages, rebuilt with the posted−10 primary measure. Runs 42–60 s each.

**The headline is a FIVE-year series** (CY2021–CY2025, conflated windows): 183,718 work zones,
15,401 segments, 23.1 M five-minute observations =
**1,925,088 segment-hours**. Mean observed speed 45.5 mph against a mean
threshold of 40.5 mph.

| measure | share of observed active time |
|---|---|
| **below posted − 10 (PRIMARY)** | **30.4 %** |
| below 35 mph | 32.4 % |
| below 60 % of PM3 free flow | 16.0 % |
| below the FHWA PHED anchor | 19.5 % |

**Per vintage** (conflated windows only; 2019–2020 have none, 2018 has 2.3 %):

| vintage | zones | segment-hrs | < posted−10 | < 35 mph | conflated share |
|---|---|---|---|---|---|
| CY2018 | 1,822 | 17,646 | **42.9 %** | 47.0 % | 2.3 % |
| CY2019 | — | — | — | — | **0 %** |
| CY2020 | — | — | — | — | **0 %** |
| CY2021 | 36,536 | 452,440 | **32.5 %** | 34.5 % | 68.0 % |
| CY2022 | 35,831 | 394,909 | **28.4 %** | 32.6 % | 63.9 % |
| CY2023 | 37,212 | 333,270 | **30.6 %** | 33.2 % | 69.3 % |
| CY2024 | 38,393 | 413,136 | **30.1 %** | 32.3 % | 72.9 % |
| CY2025 | 35,746 | 331,332 | **30.0 %** | 28.2 % | 77.7 % |
| CY2026 (to 08-31) | 18,583 | 142,943 | **27.9 %** | 28.3 % | 41.0 % |

**Cuts, CY2024 conflated.** Statewide 30.1 % on the primary measure.

| cut | zones | segment-hrs | < posted−10 | < 35 mph |
|---|---|---|---|---|
| all | 38,393 | 413,136 | 30.1 % | 32.3 % |
| Interstate | 15,929 | 162,354 | 17.3 % | 10.3 % |
| not Interstate | 22,464 | 250,782 | 38.4 % | 46.6 % |
| in a TMA | 29,612 | 302,922 | 33.2 % | 36.5 % |
| outside a TMA | 8,781 | 110,215 | 21.8 % | 21.0 % |
| significant candidates | 220 | 11,134 | 20.5 % | 13.7 % |

**Significant candidates still score better than average, but far less so.** On the absolute threshold
they read 13.7 % against a statewide 32.3 % — 0.42× —
because the rule makes them Interstate by construction. On the primary measure it is
20.5 % against 30.1 %, i.e. 0.68×.
The distortion is roughly halved but not removed: Interstates genuinely do have fewer slow periods, so
some of the residual is real. Measuring the rule's own sample still understates the programme.

**Night work is 2.3× cheaper.** Worst hour
08:00 at 36.4 %, quietest 04:00 at
16.0 % — but active hours peak at 15:00
(44,934 h) against 2,395 h at 23:00. Phase 2
could not see this; it spread each zone's hours evenly across the day, and flagged that as a known
over-statement for night work. This closes it.

**The distribution is bimodal, so no average describes a typical zone.** Of 35,460 measurable
CY2024 zones: 9,223 never below threshold, 9,931 below it more than half
the time, 16,306 in between. Median
13.2 %, p90 94.6 %. Argues for a count-over-a-line measure rather than a mean.

**CY2020 is still the sanity check that passed** — lowest year on the primary measure too
(22.3 % against 27.3 % in 2019 and
28.9 % in 2021) with nothing in the pipeline knowing about the pandemic.

**Validation — the three named CY2024 events, on the primary measure.**

| zone | segment-hrs | mean | threshold | min | < posted−10 | < 35 | significant? |
|---|---|---|---|---|---|---|---|
| I-495 Queens `ORI1237584671` | 55.7 | 41.3 | 49.0 | 6.0 | **38.9 %** | 35.5 % | **no** |
| I-87 Northway, Saratoga `ORI1237674447` | 124.3 | 60.9 | 55.0 | 3.0 | **8.6 %** | 4.4 % | **yes** |
| I-81 Oswego (rural) `ORI1237605713` | 314.5 | 71.9 | 55.0 | 22.0 | **0.2 %** | 0.05 % | no |

The zone with a real impact is still not flagged (no three-day closure reported — phase 1's lane-count
finding); the flagged one now reads 8.6 % rather than 4.4 %, which is a fairer account of a zone holding
60.9 mph against a 55 mph threshold.

**Report.** `reports/workzone_safety/09_work_zone_speed.html`, indexed in `00_README.md`.
**Generated, not hand-assembled** — `scratchpad/gen_report09.py` reads the queried JSON and formats every
figure through one rounding helper, so the report can be regenerated after any rebuild. The first
hand-assembled draft had a transcription error (a Region's share typed as 7.7 % where the data said
7.647 %); this removes that class of mistake.

## Phase 4 — TRANSCOM event×TMC delay → M2 — ✅ COMPLETE 2026-09-09

**Purpose.** Vehicle-hours of delay attributed to work zones, delay per vehicle through the zone, and
work-zone delay as a share of all delay.

**Output.** `wz_delay` — DAMA source **2213**, one row per work zone (the `wz_exposure` shape), nine
vintages CY2018–CY2026. Runs ~13 s per vintage. **256 unit + 79 integration tests green.**

### ⚠ M2 includes IMPACT TMCs. Phases 2 and 3 do not. This is the inverse.

`wz_event_tmc` roles each TMC `anchor` (being worked on) or `impact` (downstream, where the queue
formed). `workers/exposure.js` and `workers/speed.js` both filter to **anchors** on purpose — counting
the queue would inflate lane-mile-hours, and M1 is a statement about speed where the work is.

**Delay is the queue.** Measured CY2024: **anchor 3.52 M veh-hrs (8.6 %) / impact 37.22 M (91.4 %)**.
Filtering to anchors would report 3.5 M against a true 40.7 M — an **11× understatement that would look
entirely plausible**. The split is written to every row (`delay_anchor` / `delay_impact` /
`delay_impact_share`) and `tmc_roles_included: 'anchor+impact'` is stamped on every view, so the rule
cannot quietly become folklore.

**The impact share is stable at 87.5–93.8 % across every measurable vintage** — a structural property of
work-zone delay in New York, not an artefact of one year.

### Never join to 2799 on `region_name`

2799 stores `'Region 11 - New York City '` with a **trailing space** (26 chars); the phase-1 spine trims
it (25). A region-name join silently drops New York City — which is **83 % of the state's work-zone
delay**. The join is on `(event_id, tmc)`; region comes from the spine. An integration test asserts both.

### Delay is read, not computed

2799 already attributes delay per (event, TMC) in **vehicle-hours**
(`references/tsmo/01_data_universe.md`). This phase rolls it up. It carries two columns and
**`delay >= raw_delay` always** — equal on 51 % of CY2024 construction/maintenance rows, larger on 49 %
(median ratio 1.28, mean 5.44). **Nothing in the references explains the derivation**, so both are
published, `delay` primary because it is what the 40.7 M target reconciles to, and the choice is stamped
rather than assumed.

### Results log — live on `npmrds2`, 2026-09-09

| vintage | delay (veh-hrs) | zones measured | delay unknown | impact share | min/veh | zones > 10 min | share of all delay |
|---|---|---|---|---|---|---|---|
| CY2018 | 1,790,677 | 1,925 | 34,451 | 88.5 % | 6.921 | 169 | 0.69 % |
| CY2019 | — | 0 | 38,738 | — | — | 0 | — |
| CY2020 | — | 0 | 41,521 | — | — | 0 | — |
| CY2021 | 50,323,548 | 37,171 | 4,019 | 91.6 % | 4.950 | 3,376 | 18.06 % |
| CY2022 | 35,216,765 | 36,972 | 3,975 | 90.0 % | 3.170 | 2,919 | 15.95 % |
| CY2023 | 28,061,036 | 38,521 | 4,007 | 87.5 % | 3.396 | 2,848 | 10.68 % |
| CY2024 | 40,742,644 | 38,618 | 4,070 | 91.4 % | 4.725 | 3,697 | 14.71 % |
| CY2025 | 38,968,237 | 36,181 | 5,435 | 91.3 % | 3.618 | 2,680 | 12.54 % |
| CY2026 (to 08-31) | 27,224,116 | 18,845 | 11,294 | 93.8 % | 5.083 | 1,667 | 17.29 % |

**Validation — every target hit.**
- ✅ **CY2024 = 40,742,644 veh-hrs** against the tsmo build's **40.7 M**.
- ✅ **Cross-check against an independent dataset:** excessive-delay 2039's CY2024 `construction` bucket
  is 40.31 M; **ratio 1.011**. WZ delay is **14.71 %** of all CY2024 excessive delay (277.06 M).
  ⚠ That series used the PHED threshold collapsed to a uniform 20 mph (phase 3), so it is a magnitude
  check, not an authority. The ratio ranges 0.75–1.40 across vintages.
- ✅ **Region ranking R11 ≫ R10 > R8** — 33.97 / 2.96 / 2.54 M. The task doc's values (31.96 / 3.90 /
  3.34 M) do **not** reproduce; the three-region sum is close (39.47 vs 39.20 M), so it is a
  redistribution consistent with the tsmo build grouping on 2799's per-TMC region while this pipeline
  uses the spine's zone-level region. Recorded, not chased.
- **Region 11 averages 9.56 min per vehicle** — just under the 10-minute threshold — with 2,385 of its
  zones over it.

**CY2021 is the peak year at 50.3 M veh-hrs**, above CY2024, and 18.1 % of all excessive delay.

### Three bugs found while building

1. **`Number(null)` is 0 and 0 is finite**, so null per-vehicle rates passed an `isFinite` filter and
   averaged in as zeros, dragging the zone-mean rate down.
2. **Shares were rounded to 4 dp**, which collapses a small share to exactly 0 — reading as "no
   work-zone delay" rather than "a small share". Shares now round to 8 dp; vehicle-hour totals stay at 4.
3. **Unknown delay was published as zero**, violating the rule this pipeline set in phase 2 ("a measure
   with a missing input is published as unknown, never as zero"). 4,070 of CY2024's 42,688 zones have no
   2799 conflation row, and CY2019/CY2020 have none at all — those two vintages were reporting a
   confident **0 veh-hrs**. Now `NULL`, with `delay_measured` on every row and
   `zones_delay_unknown` on every rollup. **The fix moved real numbers:** unmeasured zones' vehicles were
   also diluting the per-vehicle denominator, so CY2024 went 4.497 → **4.725** min/veh and CY2018 went
   0.205 → **6.921** — a 34× correction, because only 2.3 % of 2018's zones had conflation at all.

### The 2019–2020 hole, again

2799 has no rows for those years, so **M2 is a 2021→ series** exactly as M1 is, and unlike M1 there is
no fallback — delay is only available where the conflation exists. CY2018 is thin (1,925 measured zones
of 36,376). Asking TRANSCOM for the 2019–2020 conflation would repair M1 and M2 together.

### Files

| file | what |
|---|---|
| `lib/delay.js` | pure. `delayForZone` (all roles, anchor/impact split, unknown-vs-zero), `rollupDelay` (exposure-weighted **and** zone-mean rates), `delayShare`. |
| `workers/delay.js` | resolves the spine/tmc/exposure views for the window, reads 2799 over all roles, rolls up, reads the excessive-delay denominator, publishes `wz_delay`. |
| `sql.js` | `wzDelayTableDDL`, `wzDelayInsertSQL`, `WZ_DELAY_*` column metadata. |

### Tests

- `tests/delay.unit.test.mjs` (28) — the all-roles rule, the per-vehicle conversion and its null
  handling, exposure-weighted vs zone-mean aggregation (which differ ~1.9× on the real data and must not
  be confused), the share arithmetic, and a regression per bug above.
- `tests/delay.integration.js` (12) — the worker against a faked Postgres: that the delay query does
  **not** filter to anchors, that it joins on `(event_id, tmc)` and never on `region_name`, that the rate
  comes from phase 2 and is null without it, the window replace, and the stamped role rule.

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
- **ClickHouse builds its hash table from the RIGHT side of a join.** Put the 14.6-billion-row
  speed table on the LEFT and the small staged tables on the right, or the query eats tens of
  gigabytes and never finishes (phase 3, measured: 44 GiB).
- **A view-2799 row is a SPAN, not a day.** Expand it onto the day grid before joining to NPMRDS,
  handle the same-day inverted range as a midnight crossing, and treat `bound_end_time` as
  EXCLUSIVE — it reaches 288 (phase 3).
- **View 2799 has no rows for 2019 or 2020**, and 2018 is thin (9,070 events vs 134,337 in 2024).
  Anything keyed on the conflation is a 2021→ series unless it carries a fallback.
- **Two lists describe every table** — the insert order and `metadata.columns`. They drift silently;
  `tests/sql.unit.test.mjs` now asserts parity (it caught three phase-1 columns with no descriptor).
- **No backticks inside a template literal** in the SQL builders. It broke `lib/baseline.js` and
  `sql.js` **four times** in this phase — a backtick in a `-- ...` SQL comment closes the literal and the
  module stops parsing, and it reads fine on review. `tests/sql.unit.test.mjs` now scans every SQL-builder
  module for it, so it is a test failure rather than a surprise.
- **Do not edit a module while a run is in flight.** A mid-run edit killed four phase-3 vintages, and
  `speed_rerun.sh` spawns a fresh node process per vintage, so an edit lands on the *next* one.
- **M1 is an HOUR measure on the ZONE's average speed.** Reporting the share of five-minute epochs on
  individual segments is a different measure; `lib/m1.js` has the definition and both rollups ship on
  every view so they cannot be confused.
- **CH staging tables are `Memory` engine on a SHARED server, and `finally` does not run on SIGKILL.**
  Two hard-killed phase-3 runs leaked six tables (~30 MB). `ch.js`'s `sweepStaleStaging` now drops
  `_wz_*` Memory tables older than 6 hours at the start of every staged run — aged by ClickHouse's
  `metadata_modification_time`, not by parsing our own names, and floored at 6 h so it can never touch a
  concurrent run. If a run is killed, check `system.tables` for `_wz_%` rather than assuming it cleaned up.
- **⚠ TMC ROLE FILTER FLIPS AT PHASE 4.** `exposure` and `speed` read `tmc_role = 'anchor'` only.
  `delay` (M2) reads **all** roles, because delay is the queue and ~91% of it accrues on the impact
  TMCs — an anchors-only rollup understates M2 by 11×. Check which you want before copying a query.
- **Never report M1 as a bare level.** On the week-plus universe a fixed 35 mph threshold reads 34.6 %
  during and 34.5 % before — the level ranks those zones worst, the difference says the impact is nil.

## Open questions

1. ~~Threshold defaults — confirm with NYSDOT work-zone program staff before phase 3.~~
   **Answered by phase 3's evidence, pending NYSDOT's decision:** all three thresholds are computed on
   every row and the absolute 35 mph is shown to measure the road rather than the work zone (4.5×
   between facility types on roads differing 0.72× in free flow). Recommendation is the relative
   measure for anything compared across facility types, Regions or years. The pipeline stays
   parametric regardless.
2. Baseline window: 12 months prior (default) vs 24 (FHWA HOP-20-029 used two years). **Lower stakes
   than expected** — the reference speed comes from PM3, so none of the three thresholds reads the
   baseline; it is context and phase 6's input only.
3. Hourly volume profile for E3: MAP-21 CATT profiles (by f_system / urbanized area) vs
   TMAS continuous counts. Starting with the MAP-21 statics; the swap is a phase-2 note.
4. TMA county boundaries — Census urbanized-area / TMA designations vs the HDM Appendix 16B
   maps. Record the choice in `lib/tma.js`.
5. STIP: an in-process `xlsx` dependency, or ask NYSDOT for the eSTIP CSV? (Phase 1a. `xlsx@0.18.5` is the
   last npm-published SheetJS and carries known advisories; SheetJS now ships from its own CDN, so a CSV or
   API feed from NYSDOT would remove the question.)
6. Does the CLEAR extract carry lat/long or reference markers only? The adapter handles
   both.
