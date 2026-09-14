# 23 CFR 630 Subpart J — what the 2024 rule actually requires

Read of the current eCFR text (point-in-time 2026-09-01; source 89 FR 87293, Nov 1 2024) plus the Federal
Register preamble and FHWA's Q&A (updated Apr 27 2026). Local copies:
[`references/23cfr630_subpartJ_ecfr_2026-09-01.txt`](../../../../../../../references/workzone_saftey/references/23cfr630_subpartJ_ecfr_2026-09-01.txt),
[`references/FR_2024-25065_WZ_final_rule.pdf`](../../../../../../../references/workzone_saftey/references/FR_2024-25065_WZ_final_rule.pdf),
[`references/FHWA_SubpartJ_Final_Rule_QA.pdf`](../../../../../../../references/workzone_saftey/references/FHWA_SubpartJ_Final_Rule_QA.pdf).

## 1. What changed in 2024 (vs the 2004 rule)

| Clause | 2004 rule | 2024 rule | Consequence for NYSDOT |
|---|---|---|---|
| §630.1006(b) policy content | policy addressed impacts generally | **"At a minimum, the policy shall identify safety and mobility performance measures that will be used to manage work zone performance."** | HDM Ch. 16 (NYSDOT's policy vehicle) has no quantitative measures today → must be amended by **Dec 31 2026** |
| §630.1008(b) assessment procedures | "should" | **"shall"** develop and implement systematic procedures; impacts to *all* highway workers and road users | procedures exist in HDM §16.5; wording check only |
| §630.1008(c) data | field observations, crash data, operational information | adds **safety surrogate data** and **exposure data**; data **shall** be used both for specific projects during implementation *and* for the programmatic review | four data families must be demonstrably in use |
| §630.1008(e) review | process review every **2** years, randomly selected projects | **programmatic review every 5 years**; **data-driven assessment** of a **documented representative sample of significant work zones**; **annual monitoring**; report contents prescribed; cross-office scope incl. **permitting** | a standing annual measurement program, not a one-off study |
| §630.1010(c) significant projects | Interstate in TMA, >3 days occupancy with lane closures | Interstate in TMA with intermittent or continuous lane closures for **3 or more consecutive days** (IIJA §11303(a)) | defines the sample frame |
| §630.1010(e) non-Interstate | — | <3 consecutive days of closures → TO/PIO components not required | clarifies TMP scope |
| §630.1016 | — | comply by **Dec 31 2026**; next review due **Dec 31 2030** | the calendar |
| §630.1018 | — | MUTCD 11th ed. (Dec 2023) incorporated by reference | — |

## 2. The performance-measure clause (§630.1006(b)) — verbatim

> At a minimum, the policy shall identify safety and mobility performance measures that will be used to manage
> work zone performance. Examples of such performance measures include number of fatal and injury crashes
> occurring in a work zone, percent of projects that exceed a preestablished crash rate in the work zone, number
> of highway worker fatalities and injuries experienced, highway worker fatality and injury rate per hours worked,
> **percent of projects that experience queues above a predefined threshold, and percent of time when speeds in a
> work zone drop below a predefined threshold.**

Preamble/Q&A rulings that matter:
- The examples are **not mandatory**; **at least one safety and one mobility measure** satisfies the clause, but
  the State must have **"a documented work zone performance management approach for selecting projects,
  identifying performance measures, and collecting performance data."**
- NYSDOT's proposal (speed change at work zones) is not a proxy for a required measure — **it is one of the
  listed examples** ("percent of time when speeds in a work zone drop below a predefined threshold").
- "Level of service" was rejected as an example because it is derivable from the others; the worker-injury rate per
  hours worked was dropped from the *Safety* definition because States said the denominator is unobtainable.

## 3. The data clause (§630.1008(c)) — verbatim, annotated

> States shall use field observations, available work zone crash data, available safety surrogate data, available
> operational information, and available exposure data to monitor and manage work zone impacts for specific
> projects during implementation and to perform its work zone programmatic reviews.

| Data family | Rule's examples | Preamble ruling | What NYSDOT / AVAIL holds today (see `04_datasets.md`) |
|---|---|---|---|
| Field observations | — | — | NYSDOT WZTC quality-assurance ratings (Bryden & Andrew program; NYSDOT/Oregon "quality ratings" noted in SWZDI 2013) |
| Crash data | fatalities, injuries, crashes | MMUCC 5th-ed work-zone crash definition incl. queue-related crashes | CLEAR/ALIS (internal; used in AWZSE reports); NYS open crash data with `Construction/Maintenance/Utility Work Area` traffic-control code |
| **Safety surrogate data** | **speed differentials**, hard braking, other CAV data | **"available" = accessible through existing sources; States are *not* required to acquire market data** | speed differentials are computable from **NPMRDS** now; hard braking needs a CV purchase (optional) |
| Operational information | speeds, travel times, queue length, duration | — | **NPMRDS** (5-min TMC, 2017→present) + TRANSCOM event timing |
| Exposure data | number of projects, number and length of lane closures, VMT through work zones | — | TRANSCOM `lanes_affected_count`/`tmclist`/durations; NPMRDS meta AADT; STIP PIN list |

## 4. The programmatic review (§630.1008(e)) — deliverable spec

Every 5 years (next: **Dec 31 2030**, covering **CY 2025–2029**), shared with FHWA:
1. **Data-driven assessment** of safety and mobility performance of the State's work zones — at minimum a
   **representative sample of significant work zones** over the period; **selection approach documented**
   (land use, roadway type, work-zone type, extent of impact).
2. Assessment of performance **since the last review**; **systematic identification of processes to improve**;
   **action items**; **responsible offices**; **timeline**.
3. Uses the crash, surrogate and operational data and **the measures named in the policy**; **performance monitored
   annually** ((e)(3)).
4. Examines efforts across offices: planning, design, implementation, maintenance, operations, **permitting
   (utilities, OS/OW, lane closures, sidewalk closures)**, training, PIO.
5. Cross-office + FHWA participation; other stakeholders as appropriate.

## 5. Significant projects (§630.1010) — the sample frame in New York terms

- **Automatic**: Interstate projects inside a TMA with intermittent or continuous lane closures on ≥3 consecutive
  days. New York TMAs (HDM §16.5.2.1): **New York–Newark (NY–NJ–CT), Buffalo, Rochester, Albany, Syracuse,
  Poughkeepsie–Newburgh**; HDM Appendix 16B maps Interstate limits within them.
- **Judgement**: Regions designate other projects as significant (large/urban/high-volume/design-build/special
  event/political attention/long detour/cumulative impacts) and record it in the IPP/FDR, PSR/FDR or DDR.
- **Exceptions**: §630.1010(d) lets NYSDOT ask FHWA to exempt Interstate projects or categories without sustained
  impacts from the TO/PIO components.

Implication: the review sample can be constructed mechanically from TRANSCOM (Interstate facility ∩ TMA counties ∩
construction/maintenance category ∩ ≥3 consecutive days with `lanes_affected_count>0`) and then reconciled to
NYSDOT PINs.

## 6. Definitions that drive measurement

- **Mobility** — "moving road users efficiently through or around a work zone area with minimum delay compared to
  **baseline travel when no work zone is present**"; common measures: **delay, speed, travel time, queue lengths**.
  → every mobility measure is a *before/during* comparison.
- **Safety** — number of crashes or their consequences (fatalities, injuries) at a location or along a section
  during a period; worker fatalities and injuries.
- **Work zone** — first warning sign to END ROAD WORK sign/last TTC device (MUTCD Part 6).
- **Work zone crash** — MMUCC 5th ed.: in or *related to* a construction, maintenance or utility work zone,
  workers present or not, **including vehicles slowed/stopped because of the zone even before the first sign**.
- **Work zone impacts** — may extend upstream/downstream, to other corridors and modes.
- **Work zone programmatic review** — "data-driven, systematic, and holistic analysis that uses quantitative and
  qualitative data from different sources".

## 7. Compliance calendar

| Date | Obligation |
|---|---|
| Dec 2 2024 | rule effective |
| **Dec 31 2026** | policy identifies safety + mobility measures; procedures, data use, training in place |
| annually from CY2025 | monitor performance (feeds the 2030 review, which covers 2025–2029) |
| **Dec 31 2030** | first programmatic review under the new rule shared with FHWA |
| Dec 31 2035 … | every 5 years |
