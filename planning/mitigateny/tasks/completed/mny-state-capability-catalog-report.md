# MNY — State Capability Catalog data report

**Project:** MitigateNY · **Topic:** themes · **Status:** DONE — report built and cross-linked;
only a true desktop-width screenshot and mobile layout remain unverified (see checklist).
(Header block added 2026-08-05 when this file was indexed; the original file recorded no dates.)

## Objective

Add a third linked data-report page to the MNY design system's `reports/` series analyzing
`capcat.csv` — the NY HMP 2.0 system's statewide capability *catalog* (distinct from the county-level
capability *self-reports* analyzed in `capability-inventory.html` / `capabilities-vs-capacity.html`).
The user described this as "mostly state level capabilities"; analysis confirmed that framing for the
real programs but surfaced a bigger, unrequested finding: over a third of the rows aren't programs at
all.

## Scope

- One new static HTML + Tailwind CDN report: `src/themes/mny/design/reports/state-capability-catalog.html`, matching sibling report structure.
- Update the floating "Data Reports" nav-widget list on all 6 existing report pages to add this 7th entry; cross-link with the two existing capability reports.
- No live pattern/page work — design-system mockup layer only.

## Data source & analysis

- `C:\Users\AT521549\Downloads\capcat.csv` — 649 rows, 135 columns. `Import-Csv` fails on this file
  (duplicate `Administering Agency/Organization` header — the schema literally repeats the column),
  so analysis uses `Microsoft.VisualBasic.FileIO.TextFieldParser` directly (handles the duplicate
  header via a dedupe pass, and correctly parses embedded-newline quoted cells, e.g. multi-line Web
  URL values). Script: `scratchpad/mny-capabilities/analyze_capcat.ps1`.
- Key findings feeding the copy:
  - **402 of 649 rows (62%) are real programs** (have an Administering Agency + Description) — FEMA
    grants, EFC water-infrastructure funds, Red Cross services, DHSES mitigation programs, etc.
  - **245 of 649 rows (38%) are bare placeholder rows**: no agency, no description, and (verified)
    zero hazard flags / funding info / Web URL / anything else. Their `Capability Name` values are
    drawn from the *same* local-capability vocabulary already documented in the county-level
    `capability-inventory.html` report (Floodplain Administrator, Building Code, Mutual Aid
    Agreements, Stormwater Management Program, etc.) — 49 distinct names duplicated 5–14× each with
    no distinguishing data (top offenders: "Authority to Levy Taxes for Specific Purposes" ×14,
    "Incur Debt Through General Obligation Bonds and/or Special Tax Bonds" ×14, "Chief Building
    Official" ×13, "Floodplain Administrator" ×13, "Mutual Aid Agreements" ×13, "Stormwater
    Management Program" ×13, "Flood Insurance Rate Map (FIRM)" ×13).
  - **3 literal test/junk rows still live**: "Aaaadams 2 Test3", "AVAIL TEST ROW", and one row with
    `Administering Agency/Organization = "TEST"` and a blank name.
  - Every operational flag (`Program`, `MOST or ALL formal hazards`, `Included in Last HMP Update`,
    `Discontinued/No Longer Relevant`, `Web URL`, `Case Study Available`) is populated on 0 of the 245
    bare rows and only on the 402 real-program rows — confirmed by an explicit real-vs-bare split, not
    assumed.
  - Agency type mix **within the 402 real programs**: State 248, Federal 64, Local-NYC 24, Non-profit
    15, Local 15, Organization 6, Academic 3, Private Sector 3 (multi-type rows count toward more than
    one bucket) — confirms the user's "mostly state level" framing for the real-program subset.
    Top administering agencies: DEC 62, DHSES 38, NYSERDA 25, NYCEM 24, DOT 21, DOS 16, EFC 15, PANYNJ
    14, DOH 11, NOAA 11.
  - **2.0 taxonomy migration is mid-stream, same pattern as the county dataset**: 28 legacy
    `(Delete)`/`(Deprecated)` flag-columns still carry 2,081 non-blank cells across 615/649 rows, while
    the new consolidated `Capability Category`/`Capability Type` fields are populated on only 69 rows
    total (68 of which are real programs — 17% of the 402). The *next* tier of new fields (`Primary/
    Secondary/Tertiary Capability Type`, `Primary/Secondary/Tertiary Hazard Type`, `County Text`,
    `Jurisdiction Text`) are **100% empty across all 649 rows** — columns that exist in the schema but
    have not been touched at all yet.
  - `Date verified or updated` filled on 340/649 rows (52%); of those, 213 are dated 2023, 126 in 2024,
    only 1 in 2025 — the catalog is due for a refresh pass.

## Files requiring changes — DONE

- [x] `src/themes/mny/design/reports/state-capability-catalog.html` (new)
- [x] `src/themes/mny/design/reports/actions-qa.html` — nav widget: added link
- [x] `src/themes/mny/design/reports/duplicate-actions.html` — nav widget: added link
- [x] `src/themes/mny/design/reports/boilerplate-actions.html` — nav widget: added link
- [x] `src/themes/mny/design/reports/location-from-text.html` — nav widget: added link
- [x] `src/themes/mny/design/reports/capability-inventory.html` — nav widget: added link (inline body cross-links to the new report also added in the verdict + recommendation sections)
- [x] `src/themes/mny/design/reports/capabilities-vs-capacity.html` — nav widget: added link

## Testing checklist

- [x] New page opens correctly relative to `../theme/index.css.additions` and `../assets/mny/...`.
- [x] Floating nav widget lists all 7 reports, consistently — verified on the new page itself (all 7 present, itself highlighted).
- [x] Verified visually in the in-app browser at narrow width (stat strip stacks to 2 columns cleanly) — full desktop-width screenshot not captured this pass, but layout uses the same responsive classes as the other 6 verified reports.
- [ ] Not verified: true desktop-width screenshot and mobile (<640px) layout.
