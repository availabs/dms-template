# Westchester 2026 (IEM) — plan-vs-site gap analysis

**Project:** MitigateNY · **Topic:** content / QA · **Status:** **REPORT DELIVERED 2026-09-10** — findings verified live; no fixes applied yet · **Started:** 2026-09-10

## Objective

IEM reported that sections of the Westchester 2.0 site they expected to be filled were still empty
(naming the Local Context rich-text boxes), and that the Capabilities and Hazards-of-Concern tables
were not drawing the data they supplied in the workbook. Compare the delivered plan — base plan,
45 jurisdictional annexes, and the workbook — against the live state of pattern **2448336**, and
say precisely why each gap exists and whose gap it is.

## Deliverables

| File | What |
|---|---|
| [`src/themes/mny/design/reports/westchester-iem-gap-analysis.html`](../../../../src/themes/mny/design/reports/westchester-iem-gap-analysis.html) | The report. House-style HTML; open in a browser. |
| [`src/themes/mny/design/reports/westchester-iem-gap-analysis.csv`](../../../../src/themes/mny/design/reports/westchester-iem-gap-analysis.csv) | 364 rows, 16 `row_type`s, sorted by severity. Every section-level row carries `page_url`, `draft_section_id`, `section_order`, `anchor_url`, `edit_url`, and where relevant `expected_rows` / `observed_rows`. |

Working folder (git-ignored): `references/mny-transcribe/westchester/iem-gap-work/`
— `scripts/` (audit, source probes, CSV builders) and `out/` (`pattern_audit.json`,
`page_filters.json`, `empty_slots.json`, `hazard_counts.json`, `component_eval.json`).

## The finding that matters

**Nothing in this pattern has ever been published.** 256 Annotation slots; **185 hold text in
`draft_sections`; 8 hold text in the published `sections`**, and those 8 are county-template
pre-fills. So **177 sections and 334,761 characters of IEM's base plan — loaded and read-back
verified on 2026-09-08 — are invisible to every visitor.** Draft and published are separate
component rows, so the 8 September load changed nothing on screen.

Confirmed live: `/the_local_environment/people_and_communities` renders an empty grey LOCAL CONTEXT
box while draft section `2454034` behind it holds 4,402 characters.

**Publishing the 30 affected pages is one action and answers the majority of IEM's complaint.**

### Also: the subdomain changed

The pattern's `subdomain` is now `westchester`, not `westchester-2026`.
`https://westchester-2026.mitigateny.org/` returns **404**; the live site is
`https://westchester.mitigateny.org/`. Every prior task doc and the earlier status report point at
the dead URL. Worth checking which one IEM was looking at.

## What is IEM's gap, not ours

| Gap | Evidence |
|---|---|
| **Local Capabilities / Local Actions / Featured Strategy** carry no prose under **any** of their 48 headings in the base plan (Local Actions 0/16, Featured Strategy 0/16, Local Capabilities 1/16) | 68 of the 71 genuinely-empty boxes trace to a heading IEM left empty. Across the document **525 of 722 headings have zero characters**. |
| The **whole Avalanche profile** is empty — 14 headings, 0 characters each | all 11 Annotation boxes on that page are blank |
| **Four of the five Hazards-of-Concern vulnerability columns are blank in the workbook** — General Vulnerability & Impact 0/678, Buildings 0/678, Infrastructure 0/678, Natural Environment 0/678. Only People and Communities (434/678) was filled | the header for General Vulnerability reads *"get from community insights summary"* + a SharePoint link that never reached the file |
| **Nine hazards carry no capability tagging** in the workbook (Avalanche, Extreme Cold, Hurricane, Ice Storm, Landslide, Snowstorm, and 2-record Lightning/Wildfire/Wind) | those per-hazard capability tables are correctly empty |
| **Mount Pleasant has no annex** (44 municipal annexes for 45 participating municipalities) | Jurisdictions row 1347655 untouched |
| **Jurisdictional Profile** and **Growth and Development Trends** are empty on all 45 annexes | the second is a 44 CFR element |
| The transmittal letter is still a placeholder, so **Home still reads as the county template** | live text: *"This is a county template for local hazard mitigation plans…"* |

## What is ours

1. **Publish.** 30 pages, 177 sections. See above.
2. **The four Local Capabilities Tables on `/the_plan/capabilities_assessment` are scoped to the
   county government only.** They filter `geoid_juris = <page geoid>` AND
   `geoid_county = <page geoid>`; passing the county geoid `36119` into `geoid_juris` keeps the 43
   records whose jurisdiction *is* the county and drops **1,996 municipal capability records**.
   Verified live: all four render nothing, while the four *State* Mitigation Capabilities tables
   beside them show 6,885 / 631 / 1,033 / 7,956 statewide rows.

   | Table | `draft_section` | ord | reachable as configured | reachable without the clause | rendered |
   |---|---|--:|--:|--:|--:|
   | Planning and Regulatory | `2469050` | 7 | 39 | **1,219** | 0 |
   | Administrative and Technical | `2463313` | 13 | 0 | **24** | 0 |
   | Financial | `2450074` | 19 | 43 | **2,039** | 0 |
   | Education / Outreach | `2463317` | 25 | 1 | **151** | 0 |

3. **Two capability-type values can never match** — the filters say
   `Codes/ Ordinance/ Zoning/ Policy/ Law/ Governance` and `Studies and/ or Risk Assessment` (spaces
   after the slashes), the data says them unspaced. **495 + 102 Westchester records** are unreachable.
   Statewide, not Westchester-specific.
4. **The Actions hazard rollup never happened.** The workbook flags each action against individual
   hazards (Wind 175, Snowstorm 135, Hurricane 128, Coastal Hazards 112, Extreme Heat 110,
   Ice storm 104, Extreme Cold 89, Wildfire 67, Lightning 60, Earthquake 57, Landslide 50,
   Tornado 49, Drought 43, Hail 16). Those flag columns are all but empty in the live source, and
   `primary_hazard_type` is **776 Flooding of 1,095**. The hazard pages filter on
   primary/secondary/tertiary hazard type only, so Local Actions is empty on Avalanche, Coastal
   Hazards, Drought, Hail, Ice Storm and Tornado. The Actions Dashboard shows **7 hazards across
   545 actions**. Cheapest fix: give the Actions filters the calculated hazards branch the
   Capabilities filters already have.
5. **Smaller filter defects**, each with an id in the CSV:
   - `2450157` Floodplain Administrators filters `geoid_county = "geoid"` — the NFIP page's `geoid`
     page filter has the literal string `"geoid"` as its value. 191 role records are loaded.
   - `2450079` Local Funding Capabilities filters `funding_source = "x"`, a placeholder. 116 records
     have a funding source.
   - `2454886` Local Actions by Progress Status: `county_geoid` is stored as `["36119"]` but the
     column is not typed `multiselect` on this component, so no `array_contains` and no match.
   - Every hazard page's Actions filter names `secondary_hazard_type`; the source column is spelled
     **`seondary_hazard_type`**, so that OR branch never contributes. Statewide.
   - Home and Actions Dashboard still seed `geoid` to **36105** (Sullivan). Latent — the rendered
     numbers are the correct county's today — but it overrides the pattern default.
   - **Earthquake anomaly:** 53 capability records are tagged Earthquake and the page's Capabilities
     table renders **0**, where Flooding (43) and Hail (31) with the same component shape render
     fine. Not yet explained; the OR group's raw-SQL calculated branch is the suspect.

## Method

- Enumerated pattern 2448336: **50 pages, 1,802 draft components, 1,801 published**, and compared
  the two lists row by row (`scripts/audit_pattern.mjs`).
- Read row counts from the **`uda`** route — the same one the app uses for dataset sections — with
  retries. *Two traps worth carrying forward:* paging without an `orderBy` returns an unstable
  slice, so client-side counting over a paged dump disagreed with itself; and several geoid columns
  are stored as **JSON arrays** (`["36119"]`), so a scalar `data->>'col'` filter returns 0 — which
  first read as "Actions has no Westchester rows" when it has 1,095. The components handle this
  correctly by typing those columns `multiselect`, which the server maps to `array_contains`.
- Read all five workbook sheets directly and fill-rated every column, so a blank on screen could be
  attributed to the source rather than the migration.
- Opened seven pages live: Home, People and Communities, Capabilities Assessment, Actions Dashboard,
  Flooding, Hail, Earthquake. Figures not seen on screen are labelled "not visited" in the report.

## Open item: `anchor_url`

The CSV carries `<page_url>#<draft_section_id>` as requested, but it will not jump: a DMS section
renders a DOM `id` only when `anchorId` (or `navLabel`) is set on it
(`section.jsx:273`), and **none of the 1,802 components in this pattern has either**. One CLI pass
can set `anchorId` = the section's own id on all 256 Annotation slots — draft-only, invisible in
view mode — which makes every `anchor_url` work. **Not run; awaiting the owner's go-ahead.**

## Next steps

- [ ] **Owner decision: publish the 30 pages.** Nothing else in this list changes what IEM sees as much.
- [ ] Remove the `geoid_juris` clause from `2469050`, `2463313`, `2450074`, `2463317`.
- [ ] Decide the Actions hazard-rollup fix (reload vs. calculated filter branch) — affects every county.
- [ ] Align the two capability-type spellings — statewide.
- [ ] Work the small filter defects (`2450157`, `2450079`, `2454886`, the `seondary_hazard_type` typo, the two 36105 seeds).
- [ ] Investigate the Earthquake Capabilities table returning 0 against 53 matching records.
- [ ] Send IEM the source-gap list (section 8 of the report).
- [ ] Confirm with IEM which URL they reviewed — `westchester-2026` 404s.
- [ ] Optional: set `anchorId` on the 256 Annotation slots so the CSV's `anchor_url` column works.
