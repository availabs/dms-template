# Recommendation — how NYSDOT should meet the 2024 Work Zone Safety & Mobility rule with the data we have

**For:** NYSDOT Office of Traffic Safety & Mobility / TSMO Bureau · **From:** AVAIL · **Date:** 2026-09-08 · **Status:** draft for discussion
**Supporting docs:** [`01_regulation_23cfr630J.md`](./01_regulation_23cfr630J.md) ·
[`02_literature_review.md`](./02_literature_review.md) · [`03_state_practice.md`](./03_state_practice.md) ·
[`04_datasets.md`](./04_datasets.md) · sources in [`references/`](./references/_INDEX.md)

---

## 1. The ask, and the proposal under evaluation

FHWA rewrote 23 CFR 630 Subpart J on Nov 1 2024 (89 FR 87293). By **Dec 31 2026** NYSDOT's work-zone policy must
**name the safety and mobility performance measures it will manage with**; from 2025 onward it must **monitor those
measures annually** using crash, safety-surrogate, operational and exposure data; and by **Dec 31 2030** it must
deliver a **data-driven programmatic review** of a documented, representative sample of its significant work zones
covering 2025–2029. NYSDOT asked AVAIL to evaluate solutions for meeting these requirements.

**The proposal under evaluation.** NYSDOT has suggested meeting the mobility-measure requirement by **reporting the
change in vehicle speeds at work zones**. Concretely, as we understand it:

- **Measure** — how much, and how often, speeds on the road segments inside a work zone fall while the zone is
  active, relative to speeds on the same segments when no work zone is present (a *before/during* speed comparison).
- **Speed data** — **NPMRDS** probe speeds and travel times (5-minute, TMC segments, National Highway System),
  which NYSDOT receives free from FHWA and AVAIL already holds in `npmrds2` (view 982, 2017 → present).
- **Work-zone data (when / where a zone was active)** — **TRANSCOM** construction and maintenance events, the
  event store behind 511NY, held as source 956 / view 1947 — with the explicit option to substitute or combine
  better work-zone sources if any exist.
- **Output** — an annual (and, where useful, weekly) series by Region / facility / project that can be named in
  the Subpart J policy and used in the 2030 programmatic review.

This report asks four things of that proposal: is it compliant with the rule as written; is it what peer states
do; what does it leave uncovered (safety, exposure, project identity); and what data should be added, in what order.

## 2. Verdict on the proposal

**Adopt it — it is not a proxy, it is one of the rule's own example measures.** §630.1006(b) lists *"percent of
time when speeds in a work zone drop below a predefined threshold"*, and §630.1008(c) lists *speeds* (operational)
and *speed differentials* (safety surrogate) as data States shall use. FHWA has separately published guidance
endorsing NPMRDS for exactly this purpose (HOP-20-028/-029). The preamble confirms FHWA is **not** requiring States
to buy data beyond what they already have access to. So an NPMRDS × TRANSCOM speed-based mobility measure is
squarely compliant, cheap, and already ~80% built in the TSMO work-zones dashboard pipeline.

Three refinements the literature insists on:
1. **Express it as an exceedance share, with a declared threshold and a pre-construction baseline** — "% of active
   work-zone hours with in-zone speed below X", not "average speed change". Ohio uses 35 mph; the TxDOT/FHWA case
   uses travel time > 1.25 × baseline. Comparing against the *posted limit* alone is confounded by work-zone speed
   reductions (NCHRP Synthesis 482).
2. **Pair it with the other rule-listed mobility quantities that fall out of the same computation** — delay
   (already computed), queue length/duration (contiguous upstream TMCs below threshold), and the *speed differential*
   between the approach and the zone, which doubles as the rule's **safety surrogate**.
3. **It only satisfies half the clause.** The policy also needs at least one **safety** measure; NYSDOT already
   produces work-zone crash and intrusion counts for the AWZSE legislative report — declare those.

## 3. Recommended measure set (policy language ready)

| # | Family | Measure (draft policy wording) | Threshold to declare | Computed from | Status |
|---|---|---|---|---|---|
| M1 | Mobility (operational) | **Percent of active work-zone hours in which the average speed within the work zone falls below the threshold** | 35 mph on freeways/expressways (Ohio); or 60% of pre-construction reference speed on other roads — choose one per facility class | NPMRDS 5-min speeds on the zone's TMCs × TRANSCOM active window | build (M1 is the proposed measure) |
| M2 | Mobility | **Work-zone delay** (vehicle-hours, and per vehicle) vs pre-construction baseline; share of total NY delay attributable to work zones | report; flag projects > 10 min/veh (Michigan) | event×TMC delay (view 2799) / excessive_delay `construction` | **exists** (TSMO work-zones dashboard) |
| M3 | Mobility | **Percent of significant projects with a queue exceeding the threshold**; queue length (max, 95th pct) and duration | 0.75 mi (Ohio) or 1.5 mi beyond pre-existing (Illinois) | contiguous upstream TMCs with speed < threshold (MD "connected queue" / HOP-13-043) | build |
| M4 | Safety surrogate | **Speed differential**: approach-segment speed minus in-zone speed, and during-vs-baseline speed drop, per active hour | flag differentials > 15–20 mph (rear-end risk); calibrate against M5 | NPMRDS | build |
| M5 | Safety (crash) | **Work-zone crashes by severity** (fatal / injury / PDO) statewide and on the sampled projects; **work-zone crash rate per 100M VMT through work zones** | report + % of projects exceeding the statewide WZ rate | CLEAR WZ-flagged extract (preferred) or NYS open crash data TCD codes; exposure from E3 | data request |
| M6 | Safety (workers) | **Work-zone intrusions and worker injuries** (counts) | report | NYSDOT/NYSTA intrusion records (already in AWZSE report) | exists |
| E1–E3 | Exposure | number of work-zone events/projects; number and length of lane closures (lane-mile-hours); **VMT through work zones** | denominators | TRANSCOM `lanes_affected_count` × `tmclist` length × duration; NPMRDS-meta AADT | build |
| F1 | Field observations | WZTC quality-assurance rating distribution | existing goals | NYSDOT QA program (Bryden & Andrew) | exists |

Minimum compliance is M1 + M5 (one mobility, one safety). The set above is what peers actually report and what the
2030 review will need.

## 4. Recommended approach — three tiers

### Tier 1 (now → Dec 2026): compliance on data we hold — *no new data purchases*

1. **Work-zone activity spine from TRANSCOM (source 956/1947)**, NY-filtered, `nysdot_sub_category ∈
   {Construction, Maintenance, Emergency Operations}`, deduplicated across recurring "next-occurrence" chains;
   attach TMC extents (`tmclist`, else map start/end points to the TMC network), direction, `lanes_affected_count`,
   active windows. Flag **significant-project candidates**: Interstate ∩ TMA counties ∩ ≥3 consecutive days with a
   lane closure (§630.1010(c); HDM §16.5.2.1).
2. **NPMRDS mobility engine** (ClickHouse view 982): for each event × TMC × 5-min epoch in the active window compute
   speed, travel time, and the **baseline** (same TMC, same hour-of-day/day-type, 12 months before the zone,
   excluding other events). Derive M1 (exceedance share), M2 (delay), M3 (queue via contiguous-TMC method), M4
   (speed differential). Follow HOP-20-029's ten steps and document thresholds.
3. **Exposure** (E1–E3) from the same spine plus NPMRDS-meta AADT.
4. **Safety series** from NYS open crash data (TCD codes 12/13/14) for the statewide trend now — 1,289 → 1,384
   crashes/yr 2021–24, 10 fatal in four years — geocoded via DOT reference markers where present (56%).
5. **Publish** as a DMS **Work Zone Performance** surface: extend the TSMO work-zones (mobility) page and un-block
   the planned **Work-Zone Safety** page with the open crash series; add a **methodology page** that *is* the
   "documented performance-management approach" the preamble requires (sampling rule, thresholds, baselines,
   data lineage).
6. **Policy text**: supply NYSDOT with draft §630.1006(b) language for HDM Chapter 16 (or a standalone Work Zone
   Safety and Mobility Policy, as Iowa did in Dec 2025) naming M1–M6/E1–E3 and the thresholds.

### Tier 2 (2027): close the data gaps with NYSDOT-held data — *requests, not purchases*

- **CLEAR/ALIS extract** of MV-104 work-zone-coded crashes with coordinates and KABCO (NYSDOT already uses it for
  the AWZSE report) → spatial-temporal join to the TRANSCOM spine (USU misclassification caveat) → M5 rates.
- **PIN geometry** (the token-gated ActiveProjects service) or a PIN↔contract↔TRANSCOM crosswalk → deterministic
  project identity for the review sample; STIP `SW.xls` supplies Region/MPO/phase/funding.
- **Intrusion / worker-injury records** (M6) and **WZTC QA ratings** (F1) as annual feeds.
- **AWZSE speed distributions** as a speed-behaviour measure for enforced zones.
- **Highway Work Permit / lane-closure permit** records for the permitting leg of §630.1008(e)(4).
- Ask TRANSCOM/Arcadis to enrich the **511NY WZDx feed**: direction, `vehicle_impact`, lane records, verified dates,
  LineString geometry, and plan a **CWZ** upgrade. Today the public feed is points-only with every impact field
  "unknown"; our internal copy is richer, but the public feed is what navigation apps use for driver warnings.

### Tier 3 (2027–2029, optional): higher-resolution and surrogate data — *purchases, justified by Tier 1 findings*

- **Connected-vehicle hard braking** (INRIX/StreetLight/Arity, or a TETC/pooled-fund buy) for the sampled
  significant projects, following Purdue's −0.25 g / weekly-change method; only if M4 speed differentials prove
  insufficient as the surrogate.
- **XD-resolution probe data** for project-tier queue measurement where TMCs are long (rural Interstates), per
  VDOT's finding; or CATT's PDA Work Zone Performance Reporting tool as a benchmark/alternative.
- **Smart-work-zone device logs** (queue warning systems) on TMPs for significant projects.

## 5. Why this and not the alternatives

| Option | Assessment |
|---|---|
| **A. NPMRDS × TRANSCOM in AVAIL/DMS (recommended)** | Rule-listed measures; FHWA-endorsed data; we hold both datasets and the join; extends dashboards already built; zero data cost; annual and weekly cadence possible; methodology page doubles as the documented approach. Weakness: TMC granularity for project queues; TRANSCOM activity-data fidelity. |
| **B. Buy CATT RITIS PDA Work Zone Performance Reporting** | Mature, target-based, presentation-ready; but requires NYSDOT's own INRIX/HERE contract, sits outside NYSDOT's DMS reporting, and still needs the same work-zone spine. Keep as benchmark. |
| **C. Connected-vehicle-first (Purdue model)** | Best safety surrogate; but paid data, ~5% penetration, thin overnight, vendor churn; the preamble says it is not required. Tier 3. |
| **D. Field sensors / smart work zones only** | Project-level only; cannot produce statewide annual series. Complement, not core. |
| **E. Rely on WZTC quality ratings (status quo)** | Satisfies "field observations" but not §630.1006(b)'s outcome measures. Insufficient. |

## 6. Known limitations to state up front (and how we handle them)

1. **TRANSCOM is closures, not projects, and includes permit/utility work.** → Dedupe recurring chains; classify by
   `nysdot_sub_category`; reconcile to PINs for the review sample; report utility/permit work separately (it is a
   permitting finding the review must make anyway).
2. **Work-zone extents.** `tmclist` exists on ~50% of events; others have only start/end points. → Snap points to
   the TMC network along the facility; flag extent confidence; expect measured impact to grow as extents improve
   (Illinois observed this).
3. **TMC resolution.** Programmatic reporting is fine; project-level queue lengths are estimates (all sources).
   → Report queue as a range/95th pct; use XD or devices for a few flagship projects if NYSDOT wants enforcement-
   grade numbers.
4. **NHS-only speeds.** Work zones off the NHS get exposure and crash measures but no speed measures. → State this
   coverage in the methodology; it matches every peer using NPMRDS/INRIX TMC.
5. **Crash location.** Open data has no coordinates (56% ref-marker). → Tier 2 CLEAR extract; until then report
   statewide/county series and ref-marker-geocoded subset.
6. **Latency.** NPMRDS ~2 weeks, event×TMC delay batch. → Annual/monthly reporting, not real-time; weekly snapshots
   feasible from raw NPMRDS.
7. **Baseline contamination.** Prior work zones, incidents and weather in the baseline period. → Exclude epochs
   overlapping other TRANSCOM events; use 12-month same-hour/day-type medians (HOP-20-029).

## 7. Deliverables and rough sequencing

| When | Deliverable |
|---|---|
| Sep–Oct 2026 | Task doc + method spec; TRANSCOM work-zone spine (dedupe, extents, significant-candidate flag); baseline engine on NPMRDS |
| Oct–Nov 2026 | M1–M4, E1–E3 computed for 2024–2026; open-crash M5 series; draft thresholds with NYSDOT WZ program staff |
| Nov–Dec 2026 | DMS Work Zone Performance surface (mobility page extension + safety page + methodology page); draft policy measure language for HDM Ch. 16 → **Dec 31 2026 compliance** |
| 2027 | CLEAR extract + PIN geometry requests; crash join; intrusion/QA feeds; WZDx enrichment with TRANSCOM; first annual monitoring report (CY2025–2026) |
| 2028–2029 | Annual reports; Tier 3 decision on CV/XD data; project-tier deep dives on the sampled significant projects |
| 2030 | Programmatic review data package (2025–2029) with FHWA by **Dec 31 2030** |

## 8. Questions for NYSDOT

1. Which office owns the Subpart J policy update (HDM Ch. 16 vs a standalone policy), and who is FHWA NY Division's
   counterpart?
2. Can we get the CLEAR work-zone-coded crash extract (with coordinates) and the intrusion series that feed the
   AWZSE report?
3. Can we get PIN geometry (ActiveProjects) or a PIN↔TRANSCOM/contract crosswalk?
4. Preferred thresholds: 35 mph in-zone? 10-min delay? 0.75-mi queue? — we will calibrate against 2024–2026 data
   and show the exceedance shares each implies.
5. Does NYSDOT want the 511NY WZDx feed enriched (direction, lanes, verified dates) as part of this, and is there an
   appetite for a CWZ upgrade with TRANSCOM/Arcadis?
6. Is NYSDOT already in Purdue's multi-state CV work-zone program or in TETC's probe-data purchasing, which would
   change the Tier 3 economics?
