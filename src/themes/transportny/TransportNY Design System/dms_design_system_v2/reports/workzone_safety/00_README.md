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
