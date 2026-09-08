# Dataset inventory — what can feed a Subpart J work-zone program in New York

Compiled 2026-09-08. Each row is graded against the four §630.1008(c) data families (crash · surrogate ·
operational · exposure) plus the *indicator* need (when/where a zone was active) from HOP-13-011. "Held" = already
in AVAIL's `npmrds2` DataManager (see `../tsmo/01_data_universe.md`).

## 1. Data AVAIL already holds

| Dataset | Source/view | Coverage | Fields that matter | Feeds | Gaps |
|---|---|---|---|---|---|
| **NPMRDS v6** (INRIX-era, all vehicles + trucks) | source 583 / view 982 (ClickHouse `npmrds.s583_v982_NPMRDS_V6`) | 54k TMCs, 5-min, **2017-01 → 2026-05** (~2 wk lag), 14.0B rows | speed, travel time, TMC | **operational** (speed, TT, queue proxy, duration); **surrogate** (speed differential) | NHS only; TMC granularity (VDOT caveat); no volumes |
| **NPMRDS metadata / geometry** | source 582 / view 984 | TMC × year 2018–2026 | length, AADT (+single/combi), f_system, NYSDOT region, county, UA, MPO, geometry | **exposure** (VMT through zone = AADT × length × hours) | AADT is annual HPMS-derived |
| **TRANSCOM events** | source 956 / view 1947 (`transcom_main_v2`) | **3.73M events 2015 → live**, whole NY–NJ–CT region | `nysdot_sub_category` (Construction 1.77M · Maintenance 134k · Emergency Ops 85k), start/close, `lanes_total_count`, **`lanes_affected_count`**, direction, facility, county/state, point lat/long, **`tmclist`** (49.7%), `congestion_data` (18.5%), `within_work_zone` flag (54 — unusable) | **indicator** (when/where), **exposure** (# events, lane closures), delay | multi-state → NY filter; `event_class` misleading; schedules embedded in free text; no NYSDOT PIN; utility/permit work mixed in; `tmclist` on half |
| **TRANSCOM event × TMC delay** | source 1635 / view 2799 | 7.07M rows, 678k events, 2018-01 → 2025-11 | event_id, tmc, bound start/end, `delay`, `raw_delay`, category, region, f_system | **operational** (attributed WZ delay; Construction = 188.6M veh-hrs of 212M attributed) | batch lag; accumulating-view task pending |
| **Excessive delay v3** | source 1469 / view 2633 | TMC × year × month, 2018, 2021–2025 | `construction` bucket, AADT, region | programmatic WZ share of delay | 2019–2020 missing |
| **PM3** | view 3425 | TMC × year | LOTTR/TTTR | reliability context | annual |
| **HPMS / VMT series** | DAMA source 2130 (HPMS 2011–24) | statewide | AADT, f_system | exposure cross-check | — |

**Bottom line:** the operational and indicator families are already in hand at programmatic resolution, and the
TSMO work-zones dashboard build (`tsmo-workzones-page-build.md`) has verified the join: 2024 NY work-zone family =
**93,112 events · 40.7M veh-hrs delay**, ~97% of it Construction.

## 2. Public work-zone activity / indicator data

| Dataset | Access | What we learned (audited 2026-09-08) | Grade |
|---|---|---|---|
| **511NY WZDx feed** `https://511ny.org/api/wzdx` | open, GeoJSON, WZDx 4.1, 15-min, no key (USDOT registry since 2023-08-03) | **6,232 active features, publisher Arcadis, `data_source_id: TRANSCOM`** — i.e. the same store we hold. **All MultiPoint (start/end only); `direction`, `vehicle_impact`, `location_method` = unknown on 100%; `lanes`/`types_of_work`/reduced speed = 0; dates unverified**; schedules are free text in `description`; covers CT/NJ roads too | Indicator only; **our raw 1947 copy is richer** (lanes, direction, tmclist) |
| **511 NY Events: Beginning 2010** (data.ny.gov `ah74-pg4w`) | open, 3.07M rows, 2010 → 2025-12 | NYSDOT/NYCDOT/NYSTA/NITTEC + NJ/CT; construction 620k, roadwork 187k, maintenance 60k, bridge 20k, utility 14k; point lat/long, facility, direction, create/close | Historical mirror of TRANSCOM for validation/partners |
| **511NY Events API** (`/help/endpoint/event`) | key required | adds `LanesAffected`, `IsFullClosure`, `PlannedEndDate`, secondary lat/long, `LinkId` | Live source if we ever leave npmrds2 |
| **TRANSCOM OpenReach / DFE** (data.xcm.org) | free registration | the upstream of everything above | Provenance |
| **Waze for Cities (via 511NY Rideshare sandbox)** | NYSDOT partnership | construction/hazard/jam alerts, speeds | Supplementary indicator + crowdsourced surrogate |
| **NYC Street Construction Permits 2022→** (`tqtj-sjs8`) | open | permit type, # zones, linear feet, issued work start/end, on/from/to street, permittee | Region 11 *permitting* exposure (§630.1008(e)(4)); needs geocoding to network |
| **NYSDOT Highway Work Permits / lane-closure permits** | internal | not public | Ask NYSDOT — the utility/permit half of exposure |

## 3. Project (TIP/STIP/capital-program) data

| Dataset | Access | Content | Fit |
|---|---|---|---|
| **NYSDOT STIP project list** (`SW.xls`, monthly; HTR guide; 2026 STIP narrative) | open | one row per **PIN × phase × fund year**: Region (first PIN digit; 0 = R10, X = R11), MPO, County, air-quality flag, description, phase, fund source, $ | Project identity + construction funding year; **no geometry, no closure dates** |
| **NYSDOT ActiveProjects MapServer** (behind "Projects in Your Neighborhood") | **token-gated (HTTP 499)** | projects under construction / completed last 12 months with geometry | The PIN→geometry layer — **request from NYSDOT** |
| **NYMTC TIP 2023–27 & Plan 2050 web map** (ArcGIS Online item `3f47af5f…`) | open web map | TIP projects with locations for the NYMTC region | Region 10/11 + Mid-Hudson project geometry |
| Other MPO TIPs (CDTC, GBNRTC, GTC, SMTC …) | open, heterogeneous | project lists/maps | fill-in for upstate TMAs |
| **NYSDOT reference markers / milepoint services** (`gis.dot.ny.gov …/Ref_Marker`, `/Milepoint`) | open | reference-marker points, LRS | geocode crash ref-markers and STIP "from/to" descriptions to the network |

How TIP data helps: the programmatic review must sample **significant projects** and describe them; TRANSCOM events
are *closures*, not *projects*. STIP PINs give the project universe, construction years, Region and county; the
join to TRANSCOM is by facility + county + date window (and description text, which sometimes carries contract
numbers). NYSDOT's internal PIN geometry would make the join deterministic.

## 4. Crash data (safety family)

| Dataset | Access | Work-zone flag | Audit (2026-09-08) | Fit |
|---|---|---|---|---|
| **NYS Motor Vehicle Crashes — Case Information, Four-Year Window** (data.ny.gov `e8ky-4vqe`; companions `xe9x-a24f` vehicle, `ir4y-sesj` individual, `abfj-y7uq` violation) | open (Socrata API) | **`traffic_control_device` ∈ Construction Work Area / Maintenance Work Area / Utility Work Area** (MV-104A codes 12/13/14) | **1,289 (2021) · 1,220 (2022) · 1,331 (2023) · 1,384 (2024)** statewide; 4-yr 5,224 = 3,895 PDO · 1,020 PD+inj · 299 injury · **10 fatal**; **56% carry a DOT reference marker**; top counties Westchester 547, Onondaga 403, Queens 339, Bronx 332, Suffolk 307, Nassau 286 | Statewide count/severity trend **today**; ref-marker geocoding gives location for ~half |
| **NYSDOT CLEAR / ALIS** (crash location & engineering analysis repository) | internal (government users; FOIL otherwise) | same MV-104 codes, plus geolocation, EIC/RCSC supplements | used for the AWZSE report ("nearly 600 WZ crashes on NYSDOT+NYSTA roads in 2025"; 7,001 statewide 2021–25) | **The safety source of record — request a WZ-flagged extract with coordinates** |
| **NYSDOT construction-project crash & intrusion records** (EIC-reported; Bryden datasets; intrusions 1999–2025 in AWZSE Fig. 1) | internal | project-linked | 322 NYSDOT intrusions in 2024 (2 deaths, 138 injuries) | Worker-safety measure; project-level rates |
| **FARS** (NHTSA) | open | `WRK_ZONE` | 898 WZ fatalities nationally 2023 | Independent fatality series |
| **ITSMR TSSR** | open summaries | — | statewide summaries | Context |

Method caveat (USU study, FHWA HOP-13-011): coded work-zone flags misclassify >1 in 3 crashes in tests — validate
with a **spatial-temporal join to active zone extents**, and treat the coded series as the floor.

## 5. Safety-surrogate data

| Source | Access | Notes |
|---|---|---|
| **NPMRDS speed differentials** (in-zone vs upstream approach; during vs baseline) | held | Named in §630.1008(c); zero cost |
| **Connected-vehicle hard braking** (INRIX, StreetLight, Arity, HERE, TomTom; Wejo/Otonomo exited 2023) | purchase | Purdue −0.25 g method; ~5% penetration; pooled-fund/TETC purchasing possible; Purdue's 2025 program spans 9 states |
| **AWZSE camera speed/violation data** (NYSDOT/NYSTA) | internal | % vehicles >10 mph over in enforced zones — a direct speed-behaviour measure for the enforced subset |
| **Smart-work-zone device logs** (queue warning, speed feedback) | internal/contractor | CTDOT/Iowa practice; NCHRP 587 |
| **Waze alerts** | held via 511NY | crowdsourced hazard/jam reports |

## 6. Exposure data

| Measure | Derivation | Source |
|---|---|---|
| Number of projects / work-zone events | count PINs in construction phase; count TRANSCOM WZ events (dedupe recurring chains) | STIP; 1947 |
| Number and length of lane closures | events with `lanes_affected_count>0`; length = Σ TMC lengths in `tmclist` (or start–end points along LRS) | 1947 + 984 |
| Lane-mile-hours closed | `lanes_affected_count` × length × active hours | 1947 + 984 |
| **VMT through work zones** | Σ over active hours of AADT × hourly profile × TMC length | 984 (AADT) + 1947 |
| Permits issued (utilities, OS/OW, sidewalk) | permit systems | NYSDOT HWP (internal); NYC permits (open) |

## 7. Fit-to-rule matrix

| §630.1008(c) family | Free / held now | Needs a data request to NYSDOT | Needs a purchase |
|---|---|---|---|
| Field observations | — | WZTC QA ratings (NYSDOT) | — |
| Crash | NYS open crash data (TCD flag) | CLEAR extract w/ coordinates; intrusion/worker-injury records | — |
| Safety surrogate | NPMRDS speed differentials; Waze | AWZSE speed distributions | CV hard braking |
| Operational | NPMRDS × TRANSCOM (speed, TT, delay, queue proxy, duration) | — | XD-resolution probe for project tier (optional) |
| Exposure | TRANSCOM lanes/durations × AADT; STIP PINs | PIN geometry (ActiveProjects); HWP/lane-closure permits | — |
