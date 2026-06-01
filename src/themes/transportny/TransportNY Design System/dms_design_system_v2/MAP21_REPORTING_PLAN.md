# MAP-21 PM3 reporting — page architecture & content plan

**Purpose.** A build-ready spec for the MAP-21 PM3 section of the TransportNY
DMS site, grounded in (a) what the target work taught us about *which targets
exist at which geography*, (b) the real constraints of the data source we're
bound to, and (c) how FHWA and peer agencies communicate these measures.
Each page section below names the LayoutGroup, element type, data binding, and
`textSettings` tokens so a single page can be implemented in one pass.

> **Read alongside:**
> - Mockups: [`pages/map-21.html`](./pages/map-21.html) (per-year snapshot) and [`pages/map-21-trend.html`](./pages/map-21-trend.html) (multi-year trend) — the visual vocabulary this plan reuses.
> - Design system: [`design-system/layouts.html`](./design-system/layouts.html) (LayoutGroups), [`design-system/components.html`](./design-system/components.html), [`design-system/grid.html`](./design-system/grid.html), [`theme/`](./theme/) (`textSettings` tokens).
> - Data + targets: `references/hpms/FHWA-2023-0014-0003_attachment_1.pdf` (HPMS Field Manual, Ch. 8 *Travel Time Metrics* — the authoritative definition of the columns we filter on), and `references/hpms/measure_targets/README.md` (the target CSVs + join recipe).
> - Authoring recipes: `src/dms/skills/using-a-datawrapper-card.md`, `card-layout.md`, `creating-pages-from-a-design-pattern.md`.

---

## 1. What we learned: targets are set at only two geographies

The PM3 rule (23 CFR 490) defines five measures across **three programs**, but
**federal targets exist at only two geographies — State and Urbanized Area
(UZA).** This is the single most important fact for organizing the reports.

| Measure | Program | Computed on | **Target geography** | NY targets (P2, 2022–25) |
|---|---|---|---|---|
| LOTTR Interstate (% person-miles reliable) | NHPP reliability | Interstate NHS | **Statewide** | 75.0% |
| LOTTR Non-Interstate NHS | NHPP reliability | Non-Interstate NHS | **Statewide** | 70.0% |
| TTTR Index (truck) | Freight | Interstate | **Statewide** | 2.0 |
| PHED per capita (annual hrs) | CMAQ congestion | **UZA** ≥200k in nonattainment/maintenance | **Per UZA** | NY-Newark 21.0 · Poughkeepsie-Newburgh 6.5 |
| Non-SOV travel % | CMAQ congestion | **UZA** (same applicability) | **Per UZA** | NY-Newark 52.5% · Poughkeepsie-Newburgh 26.5% |

**Consequences that drive the page structure:**

- **County has no federal target.** The HPMS Travel Time Metrics file carries
  only `StateID` and `UrbanID` as geography (HPMS Field Manual Ch. 8); our
  source's `county_name`/`mpo_name` are *pipeline enrichments*, not federal
  reporting units. County views are **diagnostic drill-downs** — value + trend,
  never a "meets/below target" verdict.
- **MPO has no *separate* target.** Within 180 days of the State setting a
  target, each MPO either **adopts (supports) the State target** or sets its own.
  NY's MPOs support the statewide targets, so an MPO view compares the MPO's
  value against the **State target** — the reference line is the same as
  statewide; only the filtered data changes.
- **UZA is genuinely different.** Only **two NY UZAs report** (New York-Newark;
  Poughkeepsie-Newburgh), only for the **CMAQ congestion** measures, against
  **per-UZA targets**. Different measure, different applicability, different
  target — this is the one geography that earns its own treatment.

So the answer to "do we need separate UZA / MPO / County pages?" is:
**MPO and County do not** (they share the State target reference, or have
none) — fold them into one drill-down page. **UZA does** — the congestion
measures are a separate concern with their own targets.

---

## 2. How the requirements work — and what the interface must communicate

The interface should *teach* the rule, because "below target" alone is
misleading. FHWA's **Significant Progress** determination has a **two-prong
test** (FHWA *Procedure for Determining Significant Progress*, hif21030):

> A target is met if **actual is equal to or better than the target**, **OR**
> actual is **better than the baseline** (for TTTR, "better" = improvement of
> at least 0.01).

- **Performance periods are 4 years** with a **2-year midpoint check** and a
  **4-year final check** (e.g. P2 = 2022–2025: 2-yr target year 2023, 4-yr
  target year 2025). Targets are set at the start of each period; the
  in-between years have no *official* target but carry the period's applicable
  target forward (our `applicable_target` column already back/forward-fills —
  see `measure_targets/README.md`).
- **MPO adoption (180 days):** show whether the MPO supports the State target.
- **UZA applicability:** PHED/Non-SOV apply only to the two reporting UZAs;
  every other geography should say so rather than render an empty congestion card.

**Interface implications (carry into every status element):**

1. Status is **three-state, not binary**: `Met target` · `Significant progress`
   (better than baseline, short of target) · `Not meeting` (below both). The
   binary "Meets/Below target" we shipped on the KPI cards is the v1; the
   trends page (where all years — hence the baseline — are in scope) is where
   the full three-state determination belongs.
2. Always show **value, target, baseline, and period** together so the user can
   see the determination logic, not just a verdict.
3. Label the **performance period and target horizon** (2-yr vs 4-yr) on the
   reference line.

**How peers present it (for visual/UX precedent):** FHWA's *Approaches for
Communicating PM3 Measures* (fhwahop22069) profiles **MDOT, NJTPA, and Virginia**;
**WSDOT's Gray Notebook** PM3 section and **CTDOT's** performance pages are good
public examples. Common conventions worth adopting: a single headline number per
measure, a target reference line on every trend, an explicit baseline marker, and
plain-language "what this means / are we on track" copy next to each chart.

---

## 3. Data & system constraints (the source we're bound to)

**Source:** `Map 21 Extended` — DAMA source **2001**, view **3394**
("all_years 2016-2025"), pgEnv **npmrds2**, `baseUrl /datasources`, `isDms:false`.
This is NY's **HPMS Travel Time Metrics submission**: one row per TMC reporting
segment per year, both directions.

**Columns we rely on** (HPMS Field Manual Ch. 8): `year_record` (INTEGER),
`state_code`, `travel_time_code`, `f_system` (1–7), `nhs` (1–9), `facility_type`
(1–6), `urban_code` (Census UrbanID), `segment_length`, `dir_aadt`, `occ_fac`,
`lottr_amp/midd/pmp/we`, `tttr_amp/midd/pmp/we/ovn`, `phed`, plus pipeline
enrichments `county_name`, `ua_name`, `mpo_name`.

**Measure SQL (already proven on the cards) — reuse verbatim:**
- *Reliability %* = reliable person-miles ÷ total person-miles, where a segment
  is reliable when `greatest(lottr_*) < 1.5`, person-miles =
  `segment_length * round(dir_aadt) * occ_fac`, scoped to
  `f_system = 1` (Interstate) or `> 1` (Non-Interstate) `and nhs in (1..9) and
  urban_code is not null and facility_type in (1,2,6)`.
- *TTTR index* = length-weighted `greatest(tttr_*)` ÷ total length on Interstate.
- *PHED* = `sum(phed)` (raw annual hours).

**Constraints that shape the build:**

1. **Single-year filter + `includePriorPeriod`.** A single `year_record` control
   drives every card; the leaf carries `includePriorPeriod:true` so it expands to
   `IN(Y, Y-1)`, enabling the **year-over-year Δ** via `GROUP BY year_record` +
   `lag()` + a formula column. (See the working KPI cards on the per-year page
   and `using-a-datawrapper-card.md`.)
2. **Trends need GROUP BY year, no year filter.** A trend chart shows all years;
   it must *not* inherit the single-year page filter. Bind it group-by-year and
   leave `year_record` out of its filter (or set it to "all").
3. **Joins key on `year_record` only** for State targets (source 2027/view 3460);
   **`year_record` + `urban_code`** for UZA targets (file not yet uploaded). Under
   a join, qualify the shared `year_record` as `ds.year_record` in the filter
   leaf (`col:'ds.year_record'`, `searchParamKey` stays bare) and in the `lag()`
   `over (order by ds.year_record)`. The server's `handleOrderBy` now preserves
   DAMA aliases.
4. **No county target → no status.** County drill-downs show value + trend only.
5. **PHED per-capita gap.** The source has **total** PHED hours; the federal
   measure and the targets are **per-capita**. UZA population is **not** in this
   source. To compare against the 21.0 / 6.5 targets we must either (a) join a
   UZA-population table, or (b) carry the actual per-capita value in the uploaded
   UZA targets file. Flag this before building the UZA page.
6. **Two UZAs only.** Any UZA selector should be limited to New York-Newark and
   Poughkeepsie-Newburgh; all other areas show "not a CMAQ reporting UZA."
7. **Annual download** = a `Spreadsheet`/`Card` section bound to the source,
   filtered by the page's year, with download enabled — no new capability needed.

---

## 3a. Shared navigation across the three pages

The three pages must read as **one report with three lenses**, not three
unrelated pages. Two reinforcing affordances, identical on every page:

1. **Sticky "on this page" TOC rail (single page).** The report is **one page**,
   so navigation is a **sticky TOC** in a right rail — the getting-started
   pattern (`<aside class="… sticky top-4 self-start">` + `.tny-toc-item` /
   `.active` from `_shared.css`). The content sections sit in a `flex-1` column
   with the aside beside them; it's `hidden xl:block` (content goes full-width
   below xl). Items anchor to `#snapshot`, `#trends`, `#how-targets`,
   `#regional`, `#urban-congestion`, `#download`. (A scroll-spy active-state
   update is a future JS nicety; the mockup marks the first item active.) See the worked markup in
   [`pages/map-21-system-performance.html`](./pages/map-21-system-performance.html)
   (`data-dms-section="view-switcher"`). Filenames:
   `map-21-system-performance.html`, `map-21-regional.html`,
   `map-21-urban-congestion.html`. (An earlier large tile-strip version was
   rejected as too heavy — keep it compact.)
2. **SideNav = one entry for the whole section.** The left nav shows a single
   "MAP-21 PM3" item (no sub-menu, no expand chevron) linking to the landing.
   Inter-view navigation is the header switcher's job only — this keeps the
   global nav uncluttered and gives one unambiguous way to switch views.

Breadcrumb stays `NPMRDS / MAP-21 PM3 / <view>`. Cross-links between cards
(e.g. the PHED context card → Urban congestion) use the same filenames.

In the live DMS build, the switcher is a small `lexical`/`Card`-chrome section
pinned at the bottom of each page's header band; the active state is per-page.

## 4. Recommended architecture — three pages

```
MAP-21 PM3   (ONE page — `map-21-system-performance.html` — the whole report)
  §01 Snapshot · §02 Trends · §03 How targets work · §04 Regional (MPO·County
  matrix, +PHED total & per-cap diagnostics) · §05 Urban congestion (UZA tables)
  · §06 Annual download.  In-page jump-nav (Snapshot · Trends · Regional · Urban
  · Data) replaces the old cross-page switcher; the standalone Regional and Urban
  pages were merged in and deleted.
```

This replaces the two current mockups by role: **page 1 absorbs and extends
`map-21-trend.html`** (the over-time view the user prefers, now the landing) and
**carries the per-year KPI band from `map-21.html`** as its snapshot section.

---

## 5. Page 1 — Statewide System Performance (landing)

**Goal:** the one-screen answer to "Is New York's NHS reliable, and are we
meeting our federal targets — now and over time?" Trends-first, with a latest-year
snapshot and an annual download.

LayoutGroups in order (`data-dms-group`): `header` → `content` → `content_tint`
(explainer) → `content` (download) → `footer`.

| # | Section | LayoutGroup | Element | Binding / content | Tokens |
|---|---|---|---|---|---|
| Header | Page header | `header` | `lexical` | Breadcrumb `NPMRDS / MAP-21 PM3`; kicker `// federal reporting`; H1 "MAP-21 PM3 System Performance"; `prose` subtitle; right-aligned **Year** scrubber (MultiSelect.compact, drives the snapshot band + download) + last-refresh `metaSM`. | `kicker`, `displayLG`, `prose`, `metaSM` |
| §01 | Compliance snapshot (selected year) | `content` | **4 × `Card`** (col-span-3) | The KPI cards already built: Interstate, Non-Interstate, Truck — each value (`displayHero`) + Δ vs prior yr + 4-yr target + **status** (joined to source 2027/view 3460 on `ds.year_record`). 4th card = **PHED (statewide total hrs)** as context, with a note "per-capita targets are UZA-level → see Urban Congestion." | `kicker`, `displaySM`, `displayHero`, `metaSM`, `metaMD` |
| §02 | Reliability over time | `content` | **2–3 `Graph`** (line) | One trend per measure, x=`year_record` (GROUP BY year, **no year filter**), series1 = measure, series2 = `max(t.applicable_target)` rendered as a **stepped target reference line** (same join, grouped by year). Mark P1/P2/P3 period boundaries. | `displaySM`, `metaSM` |
| §03 | How MAP-21 targets work | `content_tint` | `lexical` | Plain-language explainer: 4-year periods + 2-yr/4-yr checks; the **significant-progress two-prong test** (meets target OR better than baseline); MPO 180-day adoption; UZA applicability. Use a 3-chip legend matching the three-state status. | `displaySM`, `prose`, `metaSM`, `kicker` |
| §04 | **Urban congestion (CMAQ · UZA)** | `content` | `Card`/`Spreadsheet` | Folded in from the former standalone page (`#urban-congestion` anchor; the §01 PHED card links here). Applicability line + `2/13` stat, a **Reporting-UZAs table** (NY-Newark, Poughkeepsie-Newburgh × `PHED /cap ≤tgt` · `Non-SOV ≥tgt` + `Met X/2` + MPO, joined to UZA targets source 2028/upload 6822 on `ds.year_record`+`urban_code`), and a compact **non-reporting** note (the other 11 NY UZAs + why). | `displaySM`, `prose`, `metaSM` |
| §05 | Annual data download | `content` | `Spreadsheet` (download on) | Bound to source 2001/view 3394, filtered to the header's selected **Year**; columns = the published measure set; `allowDownload:true`. Lead `lexical` line explains the file is the HPMS Travel Time Metrics submission. | `displaySM`, `metaSM` |
| Footer | Source & methodology | `footer` | `lexical` | Cite NPMRDS / HPMS Travel Time Metrics (23 CFR 490, June 15 annual), source/view, target provenance (NYSDOT TMP Appendix C + Warde table). | `metaSM`, `proseSM` |

**Status logic (three-state) for §01 cards** — extend the shipped binary CASE:
`Met target` when value beats target (≥ for LOTTR, ≤ for TTTR); else
`Significant progress` when value beats the **baseline-year** value; else
`Not meeting`. (Baseline value needs the baseline year in scope — easiest in a
small companion calc that joins the baseline or reads it from the trend series.)

---

## 6. §04 Regional (MPO · County) — a section on the single page

**Goal:** "Where in New York is reliability strong or weak?" Same three
reliability measures, GROUP BY MPO/County, compared to the **State target**
(MPOs support it; County has none). **Now a section (`#regional`) on the single
report page**, not a standalone page.

**All-regions overview — no single-region hero.** An `MPO ⇄ County` toggle +
the compliance matrix. The matrix carries **two PHED diagnostic columns** —
`PHED total` (annual hrs) and `PHED /cap` — both neutral/no-verdict (PHED has no
MPO target; it's a UZA measure surfaced here for context).

| # | Section | LayoutGroup | Element | Binding / content | Notes |
|---|---|---|---|---|---|
| Header | Page header | `header` | `lexical` | Title "Regional Reliability"; subtitle clarifying MPOs adopt the State target and County is diagnostic (no federal target). Year scrubber only — no single-region selector. | |
| §01 | Geography control | `content` | toggle | `MPO ⇄ County` segmented toggle + `year_record`. | Switches the matrix's GROUP BY column. |
| §02 | Compliance matrix | `content` | `Card`/`Spreadsheet` (GROUP BY `mpo_name` or `county_name`) | **One row per region × all three measures** (Interstate / Non-Int / TTTR), each cell = value + meets/below dot vs that measure's state target, plus a `Met X/3` column. Sortable. MPO rows get the verdict; County rows show the value against the state line as a reference only (no pass/fail). | GROUP BY the geography column instead of year; join targets per measure. |
| Footer | — | `footer` | `lexical` | Note county/MPO are enrichment geographies, not federal reporting units. | |

> **No single-region hero cards and no per-region trend.** Both were built and
> removed: this page is an *all-regions overview* (the matrix is the page).
> Single-region detail + a region trend belong behind a **row click** ("region
> detail") later, not as fixed sections. Over-time trends are the Statewide
> page's job (Page 1 §02).

---

## 7. Urban Congestion (UZA: PHED · Non-SOV) — **folded into Page 1 §04**

> **No longer a standalone page.** It was built as Page 3, then judged too spare
> (two tables) and **merged into the Statewide page as §04** (`#urban-congestion`),
> reached from the §01 PHED card. The switcher is now two tabs. The spec below
> still describes the content — it just lives as a section on Page 1 now.

**Goal:** the CMAQ congestion story for the two reporting UZAs, against per-UZA
targets — but **list every NY UZA** so the reader sees the full universe and why
most don't report. Table-centric like the Regional page; no single-UZA hero/trends.

**Pre-requisites before build (see §3.5):** (a) ✅ UZA targets uploaded — DAMA
source **2028 / upload 6822** (npmrds2); (b) still open: resolve **per-capita** —
either join UZA population or carry actual per-capita in the file.

| # | Section | LayoutGroup | Element | Binding / content | Notes |
|---|---|---|---|---|---|
| Header | Page header | `header` | `lexical` | Title "Urban Congestion"; subtitle: only NY-Newark & Poughkeepsie-Newburgh report, but all UZAs are listed. Year scrubber only — no single-UZA selector. | |
| §01 | Applicability band | `content` | `lexical` | The CMAQ rule (≥200k **and** nonattainment/maintenance) + a summary stat (`2 / 13 report`). | Teaches the eligibility test. |
| §02 | Reporting UZAs table | `content` | `Card`/`Spreadsheet` | The **two** reporting UZAs × `PHED /cap (≤ target)` · `Non-SOV (≥ target)` + `Met X/2` + MPO column, joined to UZA targets on `ds.year_record` + `urban_code`. | Per-capita needs population join. MPO folded in (no separate context band). |
| §03 | Non-reporting UZAs table | `content` | `Card`/`Spreadsheet` | **All other** NY UZAs × 2020 population · ≥200k? · air-quality status · "not required · <reason>". Muted styling. | Sourced from a UZA reference table (population + AQ status), not the travel-time source. |
| Footer | — | `footer` | `lexical` | CMAQ provenance (TMP App. C Tables 9 & 10) + per-capita / population note. | |

> **No single-UZA hero cards or trends** (same decision as the Regional page) —
> the two tables *are* the page. A UZA's PHED/Non-SOV trajectory belongs behind a
> reporting-row click later.
| Footer | — | `footer` | `lexical` | Cite CMAQ measures (23 CFR 490 subpart H) + target provenance. | |

---

## 8. Reusable patterns (already built — lift these)

- **KPI card** = `Card` with: hidden grouped `year_record` (sort desc) · metric
  calc (`displayHero`) · hidden `lag()` prior calc · `round`-wrapped formula Δ ·
  `pageSize 1`. Single-year control + `includePriorPeriod` → value + YoY Δ.
- **Target join** = `join.sources.t` → view 3460, `LEFT JOIN ds.year_record =
  t.year_record`; target column `max(t.<measure>_applicable_target)`; status
  `CASE WHEN <metric> <cmp> max(t.<target>) THEN 'Meets target' ELSE 'Below
  target' END`. (`>=` for LOTTR, `<=` for TTTR/PHED.)
- **Trend + target reference line** = same join, GROUP BY year, two series
  (measure + stepped `applicable_target`), no year filter.
- **Annual download** = `Spreadsheet` bound to the source, year-filtered,
  `allowDownload:true`.

---

## 9. Open items to resolve before/while building

1. ✅ **UZA targets uploaded** — DAMA source 2028 / upload 6822 (npmrds2).
2. **PHED per-capita**: decide population join vs. file-carried actuals (still open — Page 3 mock uses illustrative per-capita actuals; live build needs the population source wired).
3. **Three-state status**: add the baseline-prong to the status CASE (Page 1 §01).
4. **Δ arrow/color** (`↑ +1.3` green / `↓` red): a small delta column-type would
   match the mockup; today it renders a signed number.
5. **`applyTableAliasToJoin` client fix** (optional hardening): default an
   unattributed filter leaf to the base `ds.` prefix so future join+page-filter
   cards don't need the manual `col:'ds.year_record'`.

---

## 10. Sources

- HPMS Field Manual (Ch. 8 Travel Time Metrics): `references/hpms/FHWA-2023-0014-0003_attachment_1.pdf`
- Target CSVs + join recipe: `references/hpms/measure_targets/README.md`
- FHWA TPM — significant progress procedure: <https://www.fhwa.dot.gov/tpm/guidance/hif21030.pdf>
- FHWA TPM — national measures guidance (hif18040): <https://www.fhwa.dot.gov/tpm/guidance/hif18040.pdf>
- FHWA — *Approaches for Communicating PM3 Measures* (MDOT/NJTPA/Virginia): <https://ops.fhwa.dot.gov/publications/fhwahop22069/chap4.htm>
- FHWA TPM FAQ (periods, MPO 180-day, applicability): <https://www.fhwa.dot.gov/tpm/faq.cfm>
- FHWA NY State Reliability Report: <https://www.fhwa.dot.gov/tpm/reporting/state/reliability.cfm?state=New+York>
- WSDOT Gray Notebook PM3 (peer example): <https://wsdot.wa.gov/about/data/gray-notebook/gnbhome/executive/tpm/pm3.htm>
- NYSDOT TMP Appendix C (state targets + PHED/Non-SOV UZA targets): <https://www.dot.ny.gov/divisions/policy-and-strategy/planning-bureau/masterplan/repository/NYS%20TMP_Appendix%20C_System%20Performance%20Report%20(1).pdf>
