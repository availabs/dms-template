# MNY — Capability Inventory + Capabilities-vs-Capacity data reports

**Project:** MitigateNY · **Topic:** themes · **Status:** DONE — both reports built and visually
verified at desktop width; only narrow-viewport verification is outstanding (see checklist).
(Header block added 2026-08-05 when this file was indexed; the original file recorded no dates.)

## Objective

Add two linked data-report pages to the MNY design system's `reports/` series (alongside `actions-qa.html`, `duplicate-actions.html`, `boilerplate-actions.html`, `location-from-text.html`), analyzing the combined 7-county capability CSV (`combined_capa.csv` — Hamilton, Niagara, Schenectady, Sullivan, Allegany, Delaware, Fulton; 2,354 rows / 169 jurisdictions) that was built in a prior session.

1. **`capability-inventory.html`** — data audit of the capability dataset itself: coverage, breadth per jurisdiction, county comparison, vocabulary/normalization gaps.
2. **`capabilities-vs-capacity.html`** — conceptual + insight report: demonstrates (with real numbers from the same dataset) that capability existence rows almost never carry capacity context (utilization/integration narrative), and bridges to the planned ~30-item Availability/Adequacy/Interest-Need capacity-assessment framework discussed in a prior session.

## Scope

- Static HTML + Tailwind CDN mockups only, in `src/themes/mny/design/reports/`, matching the existing report pages' structure (header/topnav/stat-strip/content card/floating nav widget) — no JSX, no live DMS binding.
- Update the floating "Data Reports" nav-widget list on **all six** report pages (4 existing + 2 new) so the series stays cross-linked.
- No live pattern/page work — this stays in the design-system mockup layer.

## Data source & analysis

- `C:\Users\AT521549\Downloads\combined_capa.csv` (same 7-county combine as the prior chat).
- Analysis script: `scratchpad/mny-capabilities/analyze_capa.ps1` (PowerShell `Import-Csv` — no node available in this shell). Key findings feeding the copy:
  - 2,354 rows, 169 jurisdictions, 7 counties, 261 raw `Capability` labels (252 case-folded), 14 raw `Capability Type` combinations (5 main buckets: Planning and Regulatory 1,062 / Administrative and Technical 625 / Financial 533 / Education and Outreach 110 / Asset 3).
  - Breadth (# of 5 main types touched per jurisdiction): 1→21 jurisdictions, 2→22, 3→68, 4→57, 5→1 (Sullivan/Mamakating, the only full-breadth jurisdiction). Of the 21 single-type jurisdictions, 16 are Planning-and-Regulatory-only (i.e., their entire record is the county HMP adoption line).
  - County comparison: rows/jurisdiction and avg breadth vary a lot by county (Schenectady 38.9 rows/jurisdiction avg breadth 3.89 vs Allegany 8.9 rows/jurisdiction avg breadth 2.88) — likely a reporting-structure artifact (Schenectady has a 60-row "Countywide" entry), flagged as a comparability caveat rather than a real capability gap.
  - Field completeness: `Description of Status` 14.4%, `Utilization` 6.6%, `Integration` 4.0%, `Date of adoption` 10.1% (88% of those are Planning-and-Regulatory rows, since adoption dates apply to plans/ordinances, not staff roles or funding mechanisms). 82.1% of rows have none of Status/Utilization/Integration filled ("pure checkbox"); only 3.2% have both Utilization and Integration filled.
  - By capability type, Utilization/Integration fill rate: Planning and Regulatory 9.2%/5.4%, Administrative and Technical 5.1%/4.3%, Financial 3.2%/1.1%, Education and Outreach 3.6%/1.8%, Asset 0%/0%.
  - By county: Niagara and Allegany are 0%/0% (890 rows, 38% of the dataset, zero narrative capacity context); Delaware is the best-documented (17.7%/11.8%).
  - "Other" is the single most-used `Capability` label (107 rows: Administrative and Technical 50, Planning and Regulatory 47, Education and Outreach 10) — a normalization gap consistent with the ~104-value normalized list produced in the prior session.

## Files requiring changes — DONE

- [x] `src/themes/mny/design/reports/capability-inventory.html` (new)
- [x] `src/themes/mny/design/reports/capabilities-vs-capacity.html` (new)
- [x] `src/themes/mny/design/reports/actions-qa.html` — nav widget: added 2 links
- [x] `src/themes/mny/design/reports/duplicate-actions.html` — nav widget: added 2 links
- [x] `src/themes/mny/design/reports/boilerplate-actions.html` — nav widget: added 2 links
- [x] `src/themes/mny/design/reports/location-from-text.html` — nav widget: added 2 links

## Testing checklist

- [x] Both new pages open correctly relative to `../theme/index.css.additions` and `../assets/mny/...` (same relative depth as siblings).
- [x] Floating nav widget lists all 6 reports, consistently, on every report page — verified the widget on `capabilities-vs-capacity.html` shows all 6, with itself highlighted.
- [x] Verified visually in the in-app browser (light background, stat strip, content sections, tables, bars, and recommendation callouts all render as intended) — desktop width.
- [ ] Not verified: mobile/narrow-viewport layout (siblings also untested at narrow widths per this pass).
