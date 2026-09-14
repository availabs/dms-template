# Work Zone Safety & Mobility (23 CFR 630 Subpart J, 2024 rule) — report + reference notes

Lives in the TransportNY design system `reports/` folder; the raw source files (PDFs, HTML captures, data
snapshots, text extracts) remain in [`dms-template/references/workzone_saftey/`](../../../../../../../references/workzone_saftey/).

Research base for NYSDOT's request that AVAIL evaluate solutions to the **new FHWA work-zone safety and mobility
reporting requirements**. Task doc:
[`planning/transportny/tasks/current/workzone-safety-mobility-reporting-research.md`](../../../../../../../../planning/transportny/tasks/current/workzone-safety-mobility-reporting-research.md).
Related: [`../tsmo/`](../../../../../../../references/tsmo/) (TSMO research base) and the TSMO work-zones dashboard tasks.

| Doc | What |
|---|---|
| [01_regulation_23cfr630J.md](./01_regulation_23cfr630J.md) | What the rule requires — clause by clause, with the preamble/Q&A rulings, NY significant-project frame, compliance calendar |
| [02_literature_review.md](./02_literature_review.md) | FHWA measurement canon, NCHRP/TRB, SWZDI pooled fund, connected-vehicle research, crash-data methods, data standards |
| [03_state_practice.md](./03_state_practice.md) | How 15+ states measure work-zone mobility and safety; thresholds; where New York stands |
| [04_datasets.md](./04_datasets.md) | Inventory of data AVAIL holds + public datasets (WZDx, 511NY, STIP/TIP, NYS crash open data, permits, CV vendors), graded against the rule's four data families |
| [05_recommendation_report.md](./05_recommendation_report.md) · [**05_recommendation_report.html**](./05_recommendation_report.html) | **The recommendation** (markdown + TransportNY design-system HTML rendering, same convention as the CMP `overview.html`): adopt NYSDOT's proposed speed measure as the rule-listed "% of time speed below threshold", build the NPMRDS × TRANSCOM program in three tiers, declared measure set, limitations, sequencing, questions for NYSDOT |
| [**06_work_zone_universe.html**](./06_work_zone_universe.html) | **The New York work-zone universe** — the executive view of the `wz_event` dataset built in phase 1 of the pipeline: totals, the eight-year series of work zones / events / event-hours, seasonality, composition by activity and Region, the significant-candidate population, and how the dataset was constructed (with its data-quality limits). Built from DAMA source 2193 on `npmrds2`. |
| [**08_work_zone_exposure.html**](./08_work_zone_exposure.html) | **Work-zone exposure (E1–E3)** — the executive view of the `wz_exposure` dataset built in phase 2: lane closures, lane-mile-hours, and vehicles and VMT through work zones; the duration-basis sensitivity; coverage and its limits; validation against HPMS. Built from DAMA source 2197 on `npmrds2`. |
| [**09_work_zone_speed.html**](./09_work_zone_speed.html) | **Work-zone speed impact (M1)** — the rule's named example mobility measure, computed as defined: **percent of active work-zone _hours_ in which the _zone's average speed_ (space-mean, distance ÷ travel time) falls below threshold**. NYSDOT's threshold is 10 mph below the posted limit, floored at 20; three comparators sit on every row. **CY2024 significant candidates: 20.4% of 11,619 active hours below threshold, against 7.0% on the same segments in the same hours a year earlier.** **Central finding — M1 must be reported as a difference on a named universe, never as a level.** On our week-plus universe a fixed 35 mph threshold reads 34.6% during and 34.5% before: the level ranks those zones worst, the difference says the impact is nil, because the level was reporting chronic congestion on slow roads. Reported as a difference, the threshold choice barely matters (ratios 2.9×/3.2×/3.5×). Also: our universe is 42,688 zones with a 6.0-hour median against Illinois's 1,673 projects/year and Ohio's 25-30 monitored projects; and 112 of 216 significant projects came in *better* than their own baseline while the aggregate tripled. Includes the peer-practice review (Ohio HOP-19-034, FHWA HOP-20-029, Illinois) and the NCHRP 482 posted-limit caution. Built from DAMA source 2206 on `npmrds2`; generated from a live query. |
| [references/](./references/) | One companion `.md` note per source (the PDF/HTML/JSON/CSV files themselves stay in [`dms-template/references/workzone_saftey/references/`](../../../../../../../references/workzone_saftey/references/) — 119 files, 190 MB, kept out of the theme tree); [`_INDEX.md`](./references/_INDEX.md) lists them by group; [`_DOWNLOAD_LINKS.md`](./references/_DOWNLOAD_LINKS.md) lists the few that could not be downloaded |
| [_text/](../../../../../../../references/workzone_saftey/_text/) | Plain-text extracts of all PDFs (pdftotext -layout) for grep/quoting |

## Headline findings (2026-09-08)

1. **NYSDOT's proposed "speed change at work zones" measure is a rule-listed example measure** (§630.1006(b): "percent of time
   when speeds in a work zone drop below a predefined threshold") and FHWA publishes guidance endorsing NPMRDS for
   it (HOP-20-028/-029). Compliance floor = one mobility + one safety measure + a documented approach.
2. **Deadlines:** policy measures by **Dec 31 2026**; annual monitoring; programmatic review of a documented sample
   of significant work zones due **Dec 31 2030** (covering 2025–2029).
3. **The 511NY WZDx feed is TRANSCOM** (publisher Arcadis, `data_source_id: TRANSCOM`) — the same store AVAIL holds
   as source 956/1947 — and the public feed is points-only with direction/lanes/impact "unknown" on all 6,232
   features. Our internal copy is richer.
4. **NYS open crash data carries a work-zone flag** (`traffic_control_device` = Construction/Maintenance/Utility
   Work Area): ~1,300–1,400 work-zone crashes per year statewide 2021–2024, 56% with a DOT reference marker. NYSDOT's
   CLEAR system (used for the AWZSE reports) is the source of record for the precise crash-to-zone join.
5. **Peers converge on threshold-exceedance measures** (Ohio 35 mph / 0.75 mi; Illinois 1.5 mi; Michigan 10 min;
   Montana 15 min; Iowa 4 min/veh) computed from probe speeds against a pre-construction baseline, with crash counts
   validated spatially. No NCHRP project targets the 2024 rule's measurement directly; the closest products are the
   FHWA Iowa/Illinois data-driven review case studies and SWZDI's 2025 WZPERFOMAT tool.
6. **Connected-vehicle hard braking is the gold-standard safety surrogate (Purdue/INDOT) but is paid data; the
   preamble says "available" data does not oblige purchases** — NPMRDS speed differentials satisfy the surrogate
   clause for a first program.
