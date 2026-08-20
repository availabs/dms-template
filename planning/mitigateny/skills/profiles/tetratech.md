# Consultant profile: Tetra Tech

Layer-2 profile for [`transcribing-a-consultant-plan.md`](../transcribing-a-consultant-plan.md).
Everything here is Tetra Tech-specific. The MNY target side and the method live in the parent skill.

**Counties seen:** Suffolk (2026, analyzed in depth), Nassau (source present, not yet analyzed).
**Reference annex:** `references/mny-transcribe/suffolk/Volume-II-Jurisdictional-Annexes/Chapter 15 - Islip (T).docx` (git-ignored)
**Crosswalk produced:** `references/mny-transcribe/suffolk/suffolk-annex-crosswalk.csv` (git-ignored) (109 mappings) +
[`worked-examples/suffolk-annex-crosswalk-report.md`](../worked-examples/suffolk-annex-crosswalk-report.md)

---

## Classification: survey-shaped

A Tetra Tech annex is **a structured survey instrument, not a prose document** — roughly 30 tables
and almost no free narrative. Authored content lives in specific table *columns*, not in sections.

Consequence for targeting (Suffolk, 109 mappings): Actions 28, Capabilities 22, **Jurisdictions 15**,
Roles 9, Hazards of Concern 9, Participation 1. The Jurisdictions lexical columns — the primary
target for 1.0-site plans — are a minority here.

Identifying marks: `Tt*` paragraph styles (`Tt List Bullet`, `Tt List Bullet 2`, `Table Note`),
tables labelled `Table A` … `Table V` in a fixed order, Word content-control checkboxes throughout.

## Section spine

Six `Heading 2` sections, same order in every chapter. Sections are **omitted** for some
jurisdiction types but never renamed or reordered — one parser handles all chapters.

1. **Introduction** — boilerplate, identical across all chapters
2. **Hazard Mitigation Planning Team** — Table A
3. **Community Profile** — Table B + census/building-stock tables
4. **Jurisdictional Risk Assessment** — Tables C–I, Figures 1–3
5. **Growth/Development Trends** — Tables J–M
6. **National Flood Insurance Program Compliance** — Tables N–O
7. **Jurisdictional Capability Inventory and Assessment** — Tables P–U
8. **Mitigation Strategy and Prioritization** — prior actions, Identified Issues, proposed actions, Table V

## Table inventory

Shapes are from Islip; row counts vary by jurisdiction, column counts do not.

| Table | Shape | Content | Disposition |
|---|---|---|---|
| A | 18x2 | Planning team: primary/alternate POC, FPA, contributors | → **Roles** |
| B | 9x4 | Community classifications (BCEGS, CRS, Firewise, StormReady, ISO, CSC, CEC) | → **Capabilities** |
| — | 3x3, 3x4, 4x10, 4x10 | Land area, population, vulnerable populations, building stock RCV | `auto-populated` |
| Figs 1–3 | — | Flood/coastal, geologic/wildfire, SLR/SLOSH maps | `auto-populated` |
| C | 7x4 | Presidential disaster declarations | `auto-populated` **except** the "Summary of Damage and Losses in \<Jurisdiction\>" column → `lhmp_declared_disasters` |
| D | 17x5 | Events below disaster threshold | same pattern → `lhmp_historic_occurances`; most rows are boilerplate |
| E | 66x7 | Critical facilities × flood exposure | `auto-populated`; "Already Protected" column has no target |
| **F** | 15x2 | **Local hazard impacts, per hazard** | → **HOC** `general_vulnerability` — *highest-value prose in the annex* |
| G | 11x4 | Vulnerable community assets (20 types × impacts) | **gap** — no natural home |
| H | 4x7 + 1x1 | Dams table + authored grey box | table `auto-populated`; grey box → `lhmp_dams` |
| **I** | 15x7 | **Hazard risk ranking** | → **HOC** `likelihood`, `future_occurrence_assessment`, `other_comments` |
| J | 5x2 | Development and permitting Q&A | → Capabilities |
| K | 20x5 | Building permits by year, SFHA split | `auto-populated` |
| L / M | 7x7 / 8x6 | Recent + anticipated major development | → `growth_and_development_trends` (combine both) |
| N | 6x2 | NFIP policy/claim statistics | `auto-populated` |
| **O** | 22x2 | **NFIP topic Q&A (21 rows)** | → `nfip` — clean fit, high value |
| P | 20x5 | Ordinances | → **Capabilities**, `plan_guidance=TRUE` |
| Q | 28x5 | Plans | → **Capabilities**, `plan_guidance=TRUE`; **row 1 is a literal "Example:" row — skip it** |
| R | 25x4 | Administrative & technical capability | → **Capabilities**, `tool=TRUE`; `# of Staff` has no target |
| S | 16x2 | Fiscal capability | → **Capabilities**, `funding_source=TRUE` |
| T | 10x2 | Education & outreach | → **Capabilities**, `program=TRUE` |
| U | 16x6 | Adaptive capacity (14 hazards × 5 ratings, checkboxes) | **gap** — extractable, no target column |
| — | 13x2 each | **Status of previous mitigation actions** | → **Actions** — *not in the consultant workbook* |
| — | bullets | Additional Mitigation Efforts | → `lhmp_completed_actions`; often "None" |
| — | bullets | **Identified Issues** | → `lhmp_problem_areas` — clean fit, high value (Islip: 19 bullets) |
| — | 22x3 each | **Proposed mitigation actions** | → **Actions** — `already-delivered` |
| V | 24x18 | Prioritization: 14 criteria scores + total + H/M/L | scores are a **gap**; H/M/L → `priority` |

For Tables P–T the pattern is uniform: `Capability Type` → `capability_name`, the assessment column
→ `mitigation_connection`, the name/year column → `description`, `Responsible Department` →
`administering_agency_organization`, and `In Place? = No` is a **filter** (create no row).

## Where the authored content is

Ranked by value:

1. **Table F** — per-hazard local impacts. Substantive, jurisdiction-specific, one paragraph per hazard.
2. **Identified Issues** — problem statements, 1–2 paragraphs each. The narrative source for the proposed actions.
3. **Table O** — 21 NFIP topic answers.
4. **Table I** "Description of frequency and impacts" — per-hazard, distinct from Table F. Keep both.
5. **Tables P–T** assessment columns — authored per capability.
6. **Tables L/M** — development descriptions.
7. **Table C** damage/loss summaries — the only authored column in an otherwise federal table.
8. **Per-action impact prose** — five fields per proposed action, dropped by the workbook conversion.

**There is no authored municipality-profile prose.** `lhmp_municipality_profile` — the main fill
target for 1.0-site plans — has no source here. Leave it empty unless the owner wants one synthesized.

## Extraction quirks

**Checkboxes are Word content controls** (`w:sdt` / `w14:checkbox`), used for: hazards addressed,
current status, include/discontinue, FEMA and CRS mitigation categories, priority, and Table U
adaptive capacity. Islip alone has **387 checked / 760 unchecked**. `python-docx` drops them
silently — use `scripts/suffolk/docx_outline2.py`. See the parent skill's extraction traps.

**Encoding:** annexes use `’ — – ‑` (incl. U+2011 non-breaking hyphen). Set `PYTHONIOENCODING=utf-8`
or Windows `cp1252` will crash the extractor mid-run.

**"Hazard(s) Addressed" on prior actions is often entirely checked** — every box ticked. Treat an
all-checked row as *unranked* rather than inventing a top-3 ordering.

**File sizes** are 3–30 MB per chapter (embedded maps). Extract to text once and work from that.

## Taxonomy deviation

Suffolk's 14 hazards include five with no MNY equivalent: **Nor'easter, Cyber Security, Disease
Outbreak, Groundwater Contamination, Infestation & Invasive Species**. Also combined profiles:
*Flood* includes shallow groundwater flooding; *Geologic Hazards* includes earthquake, expansive
soils and landslide; *Extreme Temperature* covers both cold and heat.

**Resolved (owner, 2026-08-14):** map all five to `Hazard = Other` and carry the verbatim name in
**`Hazard Name, If Other`**, in both Actions and Hazards of Concern. Apply the same rule to the next
Tetra Tech county unless told otherwise.

The HOC column already exists — it is **column 7 of the Hazards of Concern data tab**, but is
**missing from the HOC Dictionary tab**. Read the data tab, not the dictionary, when checking
whether a column exists; the dictionaries in this workbook are not exhaustive. (Confirm against the
live source before loading, since that omission hints the workbook and live schema may have
drifted.)

**Combined profiles are SPLIT** (owner, 2026-08-14), matching the Volume I hazard-page precedent:
Extreme Temperature → Extreme Cold + Extreme Heat; Geologic Hazards → Earthquake + Landslide;
Severe Winter Storm → Ice storm + Snowstorm; Severe Storm → Wind. The single source prose block is
duplicated to both child rows and marked `derived`. Expansive Soils has no MNY type and is dropped.

Clean 1:1: Coastal Erosion → Coastal Hazards, Drought, Flood → Flooding, Hurricane, Wildfire.

MNY hazards the plan never assessed (Avalanche, Hail, Lightning, Tornado, Tsunami/Seiche) get an
explicit `hazard_of_concern = No`, not *not-reported* — DHSES tracks confirmed omissions statewide.

## Consultant-delivered workbook

Tetra Tech ships a separate actions workbook. For Suffolk:
`references/mny-transcribe/suffolk/Suffolk_County_Actions_2.0_reconciled v2.xlsx` (git-ignored) — 523 rows, 38 jurisdictions, 76 columns, with
`README`, `Conversion Notes`, and `ID Matches` tabs documenting its own mapping decisions. **Read
those tabs**; they record judgement calls you would otherwise repeat.

Coverage verified for Islip: 22 docx action tables → 22 workbook rows.

**What it omits:** every prior-cycle action (Islip: 21; several hundred across the county), and
eight fields of per-action authored prose reduced to booleans or dropped — impact on socially
vulnerable populations / future development / critical facilities & lifelines / capabilities,
climate change considerations, FEMA and CRS categories, and alternatives 2+ (annex lists 3–4, the
workbook has one slot).

Its format is slightly older than the current MNY workbook; reconcile column-by-column against
`Actions Dictionary - New` before merging.

## Corpus variances (found by pre-flight across all 38 Suffolk annexes)

Encode these before batch-extracting; each one silently corrupts counts otherwise.

- **The hazard list is not fixed.** Brookhaven's Table F has 13 hazards, not 14 (no *Groundwater
  Contamination*). **Compute HOC row math per jurisdiction.**
- **Headings are sometimes numbered** — `34.4 Jurisdictional Risk Assessment` in Southampton. Match
  with a `^\d+(\.\d+)?\s*`-tolerant regex, never string equality.
- **Identified Issues use two bullet styles** — `Tt List Bullet` in most chapters, `List Paragraph`
  in 9 of 38 (some mix both, plus `Tt List Bullet 2`/`3` for nesting). Matching one style
  undercounted by 113 issues out of 854.
- **Action tables vary their first cell's wording.** Classify action tables by **section + shape**
  (cols 2–3, rows ≥ 15 under *Proposed Hazard Mitigation Actions*), not by a `Lead Agency` header
  match — header matching drops actions silently.
- **Some chapters are internally inconsistent**: action-table count ≠ prioritization-table rows
  (Southampton 22 vs 21, Westhampton Beach 10 vs 11). Cross-check the two per chapter; a mismatch
  is a document defect needing a human, not a parser bug.

Cross-checking action tables against the prioritization table is a cheap, high-value QA signal —
it held for 37 of 38 chapters and localized the one real defect immediately. Count prioritization
rows that **carry a project number**, not `n_rows - 2`; the header band isn't always 2 rows and the
subtraction invents mismatches.

## Action-table gotchas (all hit during the Suffolk extraction)

- **"Status of Previous Mitigation Actions" is `Heading 4` in some chapters, `Heading 3` in others.**
  Test both levels, and keep an action-ID fallback.
- **Action IDs contain hyphens** (`2020-Islip-001`), and the id/name separator is an **em/en dash**.
  Splitting on a plain hyphen truncates the ID.
- **ID prefixes are not always the plan year.** Suffolk County carries `SBU-###` (Stony Brook
  University) and `SBSH-###` (Stony Brook Southampton Hospital). A `^\d{4}-` pattern silently drops
  21 real actions.
- **Some proposed-action tables have no Caption paragraph** (26 of 522 in Suffolk), so they have no
  id or name. Recover positionally from the prioritization table — but **only when the two counts
  agree**, and tag the result as positionally derived. Refusing to guess is what surfaces the
  genuine defects.
- **Duplicate action IDs occur** — Brookhaven reuses `2020-Brookhaven-006` and Southampton reuses
  `2026-Town of Southampton-21`, each across two genuinely different actions. **Flag; never dedupe.**

## Cell-shape traps (found while mapping the Islip slice, 2026-08-17)

Every one of these is silent — the extractor succeeds and the payload is quietly short.

**Table G (Vulnerable Community Assets) is TWO tables side by side.** It reports as 11×4, and the
header row repeats: `Community Asset | Hazard Impacts | Community Asset | Hazard Impacts`. Columns
0/1 and 2/3 are **unrelated** asset/impact pairs, laid out two-up to save page space. Read it as a
normal table and you drop columns 2–3 — half the content, and disproportionately the substantive
half, because the *Not Applicable* entries cluster in the left column. 10 data rows = **20 assets**.

**Table A cells are labelled blobs, not fields.** One cell reads
`Name/Title: … Address: … Phone Number: … Email: …`. Split on the label regexes, not on cells.

**The Alternate POC cell holds MORE THAN ONE PERSON**, concatenated with no delimiter beyond a
repeated `Name/Title:`. Islip has two people in that one cell. Parse per-cell and the second person
vanishes. Split records on repeated `Name/Title:`, then parse each.

**The FPA row in Table A often carries a name with no title.** Table O's *"Who is the Community
Floodplain Administrator?"* row has it (`Ela Dokonal- Commissioner of Planning and Development`).
Same person — join them into **one** Roles row, don't create two.

**Table F and Table I label the same hazards differently.** Three normalisations needed before the
two can be joined:

| Table F | Table I | Fix |
|---|---|---|
| `Flood (including Shallow Groundwater Flooding)` | `Flood` | drop a trailing parenthetical |
| `Flood`, `Geologic Hazards` | `Flood1`, `Geologic Hazards2` | strip trailing footnote digits |
| `Nor’easter` | `Nor’easter` | **curly apostrophe U+2019** — an ASCII `'` matches nothing |

The Nor'easter one is the dangerous case: it maps to an *inserted* `Other` row, so nothing fails —
the hazard is just absent. Assert the two hazard sets are identical before mapping.

**Identified Issues contains a nested sub-list.** Bullets carry two styles: `Tt List Bullet`
(depth 1, actual problem statements) and `Tt List Bullet 2` (depth 2). In Islip, one depth-1 bullet
reads *"The following critical facilities are located in the special flood hazard area:"* followed by
**19** depth-2 facility names. Flatten them and you get 42 equal-weight bullets, 19 of which are bare
facility names with no explanation. Preserve the nesting.

**Table D's authored column is mostly one repeated sentence.** Islip: 15 of 16 rows say *"This event
had minimal impact on the TOI and Town personnel were equipped to manage the event."* Keep only the
substantive rows — 1 for Islip.

**Answer columns are not clean Yes/No.** Table R row 1 reads `Yes/` with a stray slash. Table S mixes
bare `Yes`, bare `No`, prose, and `No, handled by the state` — a *negative* answer with an
explanation, which a naive "contains prose ⇒ in use" test counts as a use. Test whether the answer
*begins* with No.

**Table Q's first data row is a literal `Example: Comprehensive Plan`** — skip it, and note it is
answered `Yes`, so a plain Yes-filter includes it.

**Row counts from a manual crosswalk read drift from the extract.** For Islip the crosswalk estimated
10 plans (Table Q) and 8 fiscal capabilities (Table S); the extract yields **8** and **7**. Trust the
extract, and record the delta.

## Corpus-wide name variance (surveyed across Tables F+I of all 38 Suffolk annexes)

18 distinct normalised hazard names for a 14-hazard taxonomy. The extras are all noise, but
each one silently drops a record if unhandled:

| Name | Chapters | What it is |
|---|---|---|
| `Geologic Hazard` (singular) | Belle Terre, Riverhead | spelling variant of `Geologic Hazards` |
| `Geological Hazards` | East Hampton (V) | spelling variant |
| `Example: Flood` | Babylon | template example row — alias the `Example:` trap in Table Q |
| `Instructions` | Babylon | an instruction row that bled into the table; not a hazard |

Babylon also carries `Groundwater Contamination` in Table I but **not** Table F — 13
narratives against 14 ranked hazards.

Normalise, then **assert Table F's and Table I's key sets are identical per chapter**. Five
of 38 chapters disagree; that assertion is the only thing that surfaces it.

## Table shape varies by chapter, including the county's own

Table F is uniform across all 38 (15x2). **Table I is not**: 37 jurisdiction chapters use a
7-column trend instrument, the county chapter (Ch 2) a 6-column ranking-validation
instrument. See the parent skill, "The county's own chapter may use a different instrument."

On Suffolk the county agreed with all 14 preliminary rankings, so Final == Preliminary
everywhere and every Justification cell is `-`. Use Final regardless — the justification path
matters only when a county disagrees.

## Sections omitted by jurisdiction type (measured, not assumed)

| Jurisdiction | Tables absent |
|---|---|
| Shinnecock (Reservation) | N, O |
| Suffolk County Water Authority | Q, R, S, T, U |
| Suffolk (County) | O |

Everything else has the full A–V spine.

## Meeting documentation lives in Volume III Appendix B

The **person × meeting attendance matrix** is `references/mny-transcribe/suffolk/Volume III - Suffolk Appendices_Public.docx` (git-ignored),
**table 0**, 144×13 — the only dated participation record in the whole plan. Columns 0–3 are
`Jurisdiction / Agency`, `First Name`, `Last Name`, `Title / Role`; columns 4–12 are one meeting each,
`X` marking attendance.

Nine Suffolk meetings, verbatim headers:

| Header | Expansion | Date |
|---|---|---|
| `CPT Kickoff (11.18.2025)` | **unresolved** — `CPT` is expanded nowhere in Volumes I or III | 2025-11-18 |
| `GIS Kickoff (11.18.2025)` | **unresolved** | 2025-11-18 |
| `PP Kickoff (12.1.2025)` | Planning Partnership Kick Off | 2025-12-01 |
| `SC Kickoff (12.1.2025)` | Steering Committee Kick Off | 2025-12-01 |
| `RA (4.9.26)` | Risk Assessment Meeting | 2026-04-09 |
| `MSW (4.15.26` | Mitigation Strategy Workshop | 2026-04-15 |
| `MSW (4.16.26)` | Mitigation Strategy Workshop | 2026-04-16 |
| `Draft Plan (5.4.26)` | Draft Plan Review | 2026-05-04 |
| `Draft Plan (5.6.26)` | Draft Plan Review | 2026-05-06 |

- `MSW` is confirmed by Volume I: *"A mitigation strategy workshop was conducted on April 15th and
  April 16th, 2026"* — the same two dates. `PP` / `SC` / `RA` are confirmed by Volume I line 1075.
- **The `MSW (4.15.26` header is missing its closing paren.** Parse the date tolerantly.
- Jurisdiction labels are `"<Name>, <Type> of"` (`Islip, Town of`) — a **third** naming form on top of
  the four already in the alias table. Add an `appendix_b_label` column to
  `references/mny-transcribe/suffolk/suffolk-jurisdiction-aliases.csv` (git-ignored) rather than transforming names; `Village of the Branch` and the
  non-census entities will not follow the pattern.
- Names here disagree with Table A: *Dominique*/*Dominick Mezzapesa*, *Hillebrand*/*Hillenbrand*, and
  **Michael Andre** appears here but not in Islip's Table A at all.
- There is also a **Confidential** variant of the appendices docx; the attendance matrix is in the
  **Public** one.

## Per-jurisdiction variation

- **Towns** — fullest annexes; all sections present.
- **Villages** — same spine, smaller tables; some omit Table J/K.
- **Special districts** (Suffolk County Water Authority) — no community-profile census tables, no
  NFIP statistics, no Ordinances table; Community Profile becomes `Heading 4` prose (*Land Area
  Served*, *Population*).
- **Tribal nations** (Shinnecock) — full spine minus NFIP statistics.

Suffolk = 38 chapters: Ch 1 introduction, Ch 2 county, Ch 3–39 jurisdictions (10 towns, 25 villages,
1 tribal nation, 1 water authority).
