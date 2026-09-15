# NYSDOT PPDAF final report — project file

**Project:** TransportNY · **Deliverable:** Task 7 of Task Assignment SP-20-03 · **Status:** first
HTML pass drafted 2026-09-15, awaiting user feedback; final HTML and `.docx` to follow.

Working file: `src/themes/transportny/TransportNY Design System/dms_design_system_v2/reports/nysdot-ppdaf-final-report.html`

Method: [`README.md`](./README.md) in this folder.

---

## 1 · The assignment, verified

| Field | Value | Source |
|---|---|---|
| Task Assignment | **SP-20-03** | all three TARs |
| Contract | NYSDOT **C000799**, Rutgers CAIT Region 2 UTC Consortium | 2021 TAR; confirmed in minutes 2026-07-29 |
| Federal Aid Project | **SP20(038)** · CFDA **20.205** (FHWA) | 2021 TAR |
| Quarterly-report project ID | **SR-21-07** *(appears only in the 2021 Attachment B template — confirm with NYSDOT before the final)* | 2021 TAR Attachment B |
| NTP | 2021-06-26 | 2021 TAR Attachment B |
| Original end / budget | 2023-09-30 · **$906,500** (Y1 capped $450,000) | 2021 TAR §5 |
| Extended end / budget | 2026-09-30 · **$1,693,500** (Y1 capped $556,796) | 2023 Extension V4 §5 |
| PI | Dr. Catherine T. Lawson | all TARs |
| Co-PI | Dr. Patrick Szary (Rutgers CAIT) | 2021 TAR |
| NYSDOT PM | **Mark Grainer** (2021) → **Richard Batchelder** (2023 ext. onward) | TAR diff |
| NYSDOT technical co-PM | Alan Warde, throughout | TARs + minutes |
| AVAIL leads | Alex Muro (lead programmer), Eric Krans (program manager), Adam Tobey | TAR qualifications section |

**The title change is the story of the extension.** The 2021 TAR is *Technical Support for Use of the
National Performance Management Research Data Set (NPMRDS)*. The 2023 extension (dated 2023-09-13)
is *Research, Development and Support of an Integrated Planning and Performance Data and Analytics
Framework (PPDAF)*. A full diff of the two documents shows the task text is otherwise **nearly
identical** — only the title, the PM, the budget/dates, and the Gantt note changed. The 2026
extension keeps the same seven tasks and adds *Integrated* → IPPDAF.

Attachment A of the TAR specifies the required final-report organization. Attachment B is the
quarterly-report template.

---

## 2 · Source inventory

All in `references/NYSDOT Final Report/`:

| File | What it gave the report |
|---|---|
| `NPMRDS-Final-Report-12-31-2021.docx` | The prior phase. §1.2 of the new report is built from it. Its unfinished-business list (incidents interface incomplete, bottleneck ranking in progress, counts/transit prototyping) is the starting point for §4. Its MHV/SMTC congestion-management case studies gave TED and the per-mile normalisation. |
| `TAR SP.20-NYSDOT-AVAIL-2021-07192021-V2.docx` | Task structure, budget, Attachment A (report format), Attachment B. |
| `TAR SP.20-NYSDOT-AVAIL-PPDAF-2023-Extension-V4.docx` | The extension. Diff against 2021 for what changed. |
| `TAR SP.20-NYSDOT-AVAIL-PPDAF-2026-Extension-shortened.docx` | §6 of the report is built almost entirely from this. |
| `NYSDOT  Weekly Meeting Minutes  (1).docx` | **The richest source.** 2020-02-12 → 2026-09-09, ~185 meetings, 289 KB of text. Chronology, decisions, failures, adoption evidence, every number as first reported. |
| `CAIT-Webinar-NYSDOT-NPRMDS.pptx` (2021-10-07) | Prior-phase framing; the PHED/TED/freeflow/per-mile explanation in language the client accepted. |
| `MAP Forum Presentation-NYSDOT-NPRMDS-v4.pptx` (2022-01) | Same, condensed. |

Live platform, app `npmrdsv5`, type `dev2`, host `https://dmsserver.availabs.org`:

| Pattern | ID | Note |
|---|---|---|
| NPMRDS (`npmrds_sub`) | 2100394 | auth-restricted — pattern row readable, pages not listable |
| TSMO (`tsmo2`) | 1431209 | auth-restricted |
| Freight Atlas (`freightatlas2_copy`) | 2175436 | 4 pages |
| **Docs (`platform_docs`)** | **2218952** | **95 pages — the single most valuable source** |
| Map Editor (`map_editor_test`) | 2100006 | |
| Site Management (`sitemgmt`) | 2184885 | auth-restricted |
| Datasources (`datasets`) | 1700711 | |
| Freight datasources (`freight_data`) | 2186526 | |

Also used: `reports/npmrds-data-quality-report.html` in the design system (the CY 2025 probe-thinness
study, measured 2026-08-13).

Extraction scratch lives in the session scratchpad and in `scratchpad/nysdot-final-report/`
(gitignored): `extract.py`, `extractppt.py`, `lex.py`, `fetch_pages.sh`, `docs/*.txt`.

---

## 3 · The verified findings

These are the substantive research results. Every figure below is sourced.

### 3.1 Probe thinness (from the data-quality study, measured 2026-08-13, CY 2025)

- 1,695,358,623 NY probe records; 52,127 TMCs in the PM3 table.
- **88.1 %** band A (≤4 probes) · 8.8 % band B (5–9) · **3.1 %** band C (10+).
- **59.6 %** of records carry no truck data.
- AM-peak LOTTR > 1.50 on **38.2 %** of segments with 50–249 obs vs **11.1 %** with 2,000+ → **3.4×**.
- **56.0 %** of segments <0.1 mi flagged unreliable vs **7.3 %** of segments >1 mi → **7.7×**.
  Segments <0.1 mi are ~⅓ of the count, ~1.5 % of the mileage.
- Coverage moves in **nine eras**; all-vehicle bins reporting 36.3–51.5 %, truck bins 8.0–23.5 %.
  Nothing below 2 mph reaches the platform (filtered upstream).

### 3.2 The June 2026 excessive-delay revision

- **2026-06-10 (Methodology).** Threshold = greater of 20 mph or 60 % of the *posted* limit, live per
  segment. Baseline → **median**. Attribution **capped** so an event can't claim more delay than
  exists. Series restarted and refilled backwards. **Figures before and after do not compare.**
- Series extent: **2018 and 2021–2025 computed; 2019–2020 not; 2017 no rows.**
- **2026-06-13 (Data release).** CY 2025 statewide, all vehicles: **310.86M** vehicle-hours,
  **157.07M non-recurrent (51 %)**, construction **46.84M**, accidents **4.82M**. Cost $6.2B at the
  then-current $20/veh-hr basis.
- **Value of time.** 2026-06-19 adopted class-weighted, occupancy double-count removed; 2026-06-22
  confirmed as v1: **$52** passenger / **$42** single-unit truck / **$77** combination truck, applied
  from each segment's AADT split. Network blend **$50–55**, ≈**2.5×** the flat $20. Backfill was
  still pending, so pages declare which basis they show.
- **Anchored free-flow reference.** Published 2026-08-18 beside the own-year variant. Window moved
  2026-08-21 and again 2026-08-23, settling at **June 2023 – July 2024**. On identical CY 2025 data
  the anchored variant yields **+1.18 %** network delay, floor included.

### 3.3 The federal/analytical fork — **2026-08-14**

The analytical series forked from the MAP-21 code; the federal computation is frozen. No number moved
on the day. Every later Methodology entry applies to the analytical series only. Immediately after,
the analytical side gained TTTR₈₀, delay-threshold diagnostics, per-row quality columns, precision
bands, per-stream era tags, and the anchored variant.

Consequence: two measure families share names, so the platform declares at every point of use which
is which — MAP-21 PM3 pages are the *only* federal pages.

**Related display-parameter bug, 2026-08-18:** Macro View TTTR threshold was 1.50 when the Interstate
target is 2.00. Correcting it moved the share above threshold from **74.1 % → 44.7 %** with no change
to the computation.

### 3.4 Network and volume vintages

- TMC map reissued annually, data retroactively re-referenced. **~36,000** segments (2017) →
  **~46,000** (2019) → **52,029** (2024) → **52,157** (2025) → **52,473** (2026-07-19).
- **Two correct counts:** TSMO methodology page says **54,249** (every segment ever seen);
  the 2026 map says **52,473** (one year). Always say which basis.
- AADT lags travel times by ~2 years, so a delay *trend* is partly an AADT revision history.

### 3.5 TRANSCOM timestamp completeness (measured 2026-06-22, 3.7M events)

| Timestamp | Present |
|---|---|
| All lanes reopened | **42.7 %** |
| Incident verified | **20.1 %** |
| Incident reported | **10.6 %** |
| Response on scene | **0.3 %** |

Clearance time exists for ~1 event in 5. Delay footprint on **18.5 %** of events. Secondary crashes
not tracked. **The blocker is field data entry, not analysis** — this is the framing that makes it
actionable.

**Incidents/Work Zones de-overlap, 2026-07-28:** events with NYSDOT sub-category Construction,
Maintenance or Emergency Operations now belong to Work Zones only. Counts changed; store did not.

### 3.6 Freight

- **The Atlas agrees with the plan by rule** (2026-08-25: mode-share chart switched from deriving
  shares live to reading the 2024 State Freight Plan's own figures).
- **Bottleneck reconciliation**, late 2024 → 2025: AVAIL's method vs NYSDOT's, run side by side;
  AVAIL typically produced more TMCs, urban/suburban close, divergence 1–2 TMCs per corridor; a
  three-year lookback to exclude construction closed the gap.
- Counts: **39 layers / 8 categories**, **52 datasets**, **22 of 33** plan maps live in the gallery
  (7 categories; 11 figures pending data), 1,145 mi PHFS, 263 parking sites, 37 bottlenecks,
  $304M NHFP 2024–28. TRANSEARCH base year **2021** (2023 release), under NDA.

### 3.7 Employment and establishments (2026)

Four sources compared at every geography — commercial Business Points (Data Axle), QCEW, LEHD LODES
WAC, County Business Patterns. **Totals can agree at county level while 2-digit NAICS diverge badly**
(Erie County was the worked example); sub-county spread can exceed 2:1. Product: a best-estimate
employment layer at MPO/county/tract/blockgroup/block with **confidence level and every raw source
exposed on hover**.

### 3.8 Road risk and resiliency (2025)

`Resiliency Score = Risk × Criticality`, normalised (scored out of 60 in the working draft).
- **Criticality** = normalised betweenness × normalised redundancy. Betweenness is a proxy for
  accessibility and for NYSDOT's corridor importance factor. Redundancy = travel-time difference when
  a segment is removed; × AADT = redundancy consequence.
- **Risk** out of 6: floodplain (100-yr = 2, 500-yr = 1), TRANSCOM flooding events (>1 = 2, =1 = 1),
  stream crossings (boolean), culverts (boolean). Sources: NHD stream crossings, NYSDOT large-culvert
  inventory (complete), regional small culverts (in progress), DEC culverts.
- **Bridge detour tool** (2026): per-bridge detour in each direction over the TMC graph, honouring
  turn restrictions and one-ways, speed limits for travel time, reporting added seconds and distance.
  Delivered as a geodatabase to the ODAM team plus an interactive prototype. **Explicitly not a
  diversion-volume model** — say so, because "why didn't you build a Replica-style estimator" was
  asked directly (minutes 2026-08-19).

### 3.9 Platform counts (from the docs set, Aug–Sep 2026)

14.47B five-minute records (Aug 2026 home spine) / 14.0B through May 2026 at the June 2026 revision ·
observations from 2017-01-01 · 869 legacy reports, 32 rebuilt · 12 report templates in 5 question
types · 7 published Macro View measures of 10 declared · 4 TSMO dashboards + 2 explorers ·
11 NYSDOT regions · 14 MPOs · 95 documentation pages written 2026-09-04 → 09-08 · subdomain
consolidation 2026-09-02 · ClickHouse migration for NPMRDS processing late 2024 · single Data Manager
merge 2025 · `devtny.org` dev environment established June 2025.

---

## 4 · Design decisions made in the first pass

- **Document shell, not app shell.** Existing model: `reports/npmrds-data-quality-report.html`.
  `_shared.css` subset inlined verbatim.
- **Order deviates from Attachment A in two places**, both commented in the HTML: a **Products**
  section (§3) sits before Findings, and **Findings (§4)** is split from **Conclusions (§7)**.
  Both deviations are argued in [`README.md`](./README.md) §0.
- **Twelve figures**, all existing captures from `assets/screens/` — no new capture was needed.
  Inventory and capture conventions: `assets/screens/README.md`.
- **Print/Word-first markup**: single column, real semantics, `@media print` with `.page-break` on
  each major section and `break-inside: avoid` on cards/tables/figures.
- The cover image is a **placeholder** (`macro-01-overview.png`); Attachment A requires cover art and
  the `.docx` should get a proper full-bleed treatment.
- The report ends with a **review-notes card** listing open questions, possible additions, possible
  cuts, missing figures and the conversion path.

---

## 5 · Open items for the final pass

**Needs NYSDOT input**
- Confirm the **SR number** (SR-21-07 is inferred from the 2021 Attachment B template).
- Author list, report date, and the exact performing-organization line for the title page and
  DOT F 1700.7.
- Whether to include a **budget/expenditure table by task**.

**Would materially strengthen the report**
- **Usage statistics from Site Management** — §5.2 currently argues adoption from anecdotes
  (MTA's 32 logins in three days, GBNRTC, Parsons, Stantec, Emily Dozier's Route 44 study) because no
  aggregate figure was to hand. A real user/session/download count would be the single best addition.
- Two or three **named MPO use cases** written up as short boxes.
- A **platform architecture schematic** for §2.1 and a **project timeline graphic** for §1.3. The
  2021 report had figures for both (Figures 5 and 6); they could be redrawn.
- Three more captures: **Corridor View** (time-space grid), an **incident page**, and the
  **Data Manager catalog**. None exists in the design-system asset set.

**Possible cuts for the Word version**
- Appendix D (change log) is long — could reduce to the six Methodology-labelled entries.
- §3.8 and §3.9 could merge.

**Facts deliberately not asserted**
- Exact user counts, exact download counts, exact quarterly-report count.
- Hours or cost by task.
- Whether the 2026 extension has been executed (it was still "passing around for approvals" at the
  2026-09-09 meeting) — §6 says so explicitly.
