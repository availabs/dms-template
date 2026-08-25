# Nassau County HMP → MitigateNY 2.0 annex transcription

**Project:** MitigateNY · **Topic:** data · **Status:** IN PROGRESS · **Started:** 2026-08-20

## Objective

Transcribe the Nassau County Multi-Jurisdictional Hazard Mitigation Plan (Hagerty Consulting, dated
2020-12-16) and its 52 jurisdictional annexes into the MitigateNY 2.0 Nassau county plan
(**pattern `2407262`**, county geoid **`36059`**) — specifically into the internally-sourced MNY
"forms" datasets: **Actions, Roles, Participation, Hazards of Concern, Capabilities**, plus the
**Jurisdictions** lexical columns.

Secondary objective, and the reason this is worth doing carefully: **generalise the consultant-plan
transcription skill to a second consultant.** Hagerty is the second firm after Tetra Tech, so this is
the first real test of whether the Layer-1 / Layer-2 skill split holds.

## Scope

**In scope**
- The jurisdictional annexes → the five forms datasets + Jurisdictions lexical columns.
- The base plan's planning-process tables (the only source for Roles and Participation).
- A Hagerty consultant profile under `planning/mitigateny/skills/profiles/`.

**Out of scope (for now)**
- The base plan's countywide narrative → the 2.0 pattern's Annotation slots. That is the
  `loading-a-plan-into-a-2.0-pattern.md` path and a separate task.
- `NassauCountyHMP_AppendixA_PlanningProcess_Revised.pdf` (49 MB, PDF-only) — not yet examined.
- Appendix B (Risk Assessment) and Appendix C (Mitigation Strategy) beyond spot checks.

## Reference material

| What | Where |
|---|---|
| Consultant profile (Hagerty) | [`../../skills/profiles/hagerty.md`](../../skills/profiles/hagerty.md) |
| Crosswalk report | [`../../skills/worked-examples/nassau-annex-crosswalk-report.md`](../../skills/worked-examples/nassau-annex-crosswalk-report.md) |
| Crosswalk CSV (185 mappings) | `references/mny-transcribe/Nassau/context/nassau-annex-crosswalk.csv` *(git-ignored)* |
| Working folder | `references/mny-transcribe/Nassau/context/` — see its `README.md` |
| Punch-list dispositions | `references/mny-transcribe/Nassau/context/qa-resolutions.csv` — check → owner ruling; joined into the punch-list on every run |
| Freeport hazard map | `references/mny-transcribe/Nassau/context/freeport-hazard-map.csv` — 7 named / 6 `Other` / 10 set to No |
| Omissions register | `references/mny-transcribe/Nassau/context/omissions-register.csv` — **generated** from the crosswalk, 5 entries |
| File manifest | `references/mny-transcribe/Nassau/context/file-manifest.csv` — 52 folders → authoritative annex + worksheet files + reason |
| Jurisdiction aliases | `references/mny-transcribe/Nassau/context/nassau-jurisdiction-aliases.csv` — **70 jurisdictions** → 70 geoids, no collisions |
| Action Type tiers | [`../../skills/action-type-tiers.csv`](../../skills/action-type-tiers.csv) |
| Pre-flight scanner | [`../../skills/scripts/nassau/preflight.py`](../../skills/scripts/nassau/preflight.py) |
| Target schema | **the live sources** — Actions `1029065`, Roles `1473295`, Participation `1473468`, HOC `1473470`/`1473471`, Capabilities_Catalogue `1068273`. The workbook is **illustrative only** (owner, 2026-08-21). |
| Method (Layer 1) | [`../../skills/transcribing-a-consultant-plan.md`](../../skills/transcribing-a-consultant-plan.md) |

## Phase 1 — Classify the source — DONE (2026-08-20)

- [x] Confirmed the consultant is **Hagerty Consulting**, not Tetra Tech. The base plan states *"The
  County contracted with Hagerty Consulting to support the County in updating the Plan."*
  `profiles/tetratech.md` previously listed Nassau as a Tetra Tech county; corrected in-file.
- [x] Classified the source as **brief / mixed** — 9 tables and ~17 KB per annex, with real authored
  prose in three places. Added this third category to the Layer-1 skill's Phase 0.
- [x] Confirmed **no consultant-delivered actions workbook exists.** Everything is ours to extract.
- [x] Resolved the hazard taxonomy: 11 Hagerty hazards → **14 of MNY's 17 named types** (3 splits), and
  the base plan explicitly names Avalanche / Tsunami-Seiche / **Wildfire** as not profiled →
  `hazard_of_concern = No` with a sourced reason. **No `Other` rows needed** — unlike Suffolk.
  *(This line was briefly marked corrected on 2026-08-21 when a `Not Reported` variant was adopted;
  that variant was reverted the same day, so the original statement stands. See Phase 4.)*

**Design note.** Suffolk's taxonomy *over*-ran MNY's; Nassau's *under*-ran it and closed cleanly.
Both cases are now recorded in Layer 1 because they need different HOC row math and different
insert-vs-update logic.

## Phase 2 — Crosswalk one annex — DONE (2026-08-20)

Reference annex: `01_CityofGlenCove` (annex docx + `MAW1` + `MAW2`).

- [x] Extracted the annex spine and full text → `context/extracted/glencove_{headings,full}.txt`
- [x] Extracted both MAW worksheets → `context/extracted/glencove_maws.txt`
- [x] Dumped the workbook's five dictionary tabs, the Validations tab (select vocabularies) and the
  138 Nassau rows of `geoid-crosswalk` → `context/extracted/`
- [x] Read the live Jurisdictions attribute list (42 attributes, 30 of them `lexical`) from the
  Suffolk context's `extracted_source.json`
- [x] Produced **`nassau-annex-crosswalk.csv` — 163 field-level mappings**, every section and every
  table cell of the annex + MAW + the three base-plan tables *(grew to 165 in Phase 4)*

Distribution: Actions 60 · Capabilities 25 · Roles 22 · Hazards of Concern 20 · Participation 8 ·
Jurisdictions 6 · no-target 22.
Dispositions: `dataset-fill` 77 · `gap-empty` 19 · `constant` 17 · `derived` 16 · `boilerplate` 10 ·
`gap-no-target` 9 · `auto-populated` 5 · `filter` 4 · `lossy` 3 · `gap-partial`/`gap-weak` 3.

## Phase 3 — Corpus pre-flight — DONE (2026-08-20)

All 52 annex folders scanned (`preflight.py` → `context/extracted/preflight.json`).

- [x] Spine confirmed **uniform**: the same 12 headings in all 51 readable annexes; only four
  paragraph styles corpus-wide; the first seven tables are a fixed shape sequence
  (`2x2, 8x4, 12x2, 24x3, 12x3, 11x3, 5x2`); Table 2's 11-hazard list byte-identical in all 50 that
  have one.
- [x] Volumes measured: **234 proposed actions**, **284 prior/completed actions** (135 transposed +
  147 in two non-transposed variants + 2 completed), ~~**139 MAW `.docx`**~~ **[CORRECTED 2026-08-21:
  142 worksheet `.docx` + 1 worksheet PDF = 143 — see Phase 5]**, 20 jurisdictions with no
  prior actions.
- [x] Nine corpus variances documented in the profile (PDF-only Freeport; the county annex's missing
  Table 2; two inverted-orientation prior-action tables holding 147 of 284 records; Woodsburgh's
  unique *Completed* section; trailing empty rows; the doubled heading sentence; Malverne's
  `SectionTitle`; row-label variants; merged-cell column inflation).

## Phase 4 — Owner decisions — DONE (2026-08-21)

All resolved. **No schema additions**; where content had no column the owner accepted the loss. Full
detail in the crosswalk report §5; the crosswalk CSV carries the per-row consequences.

- [x] **`Hazards of Concern.general_vulnerability`** — **fill it** from Table 2's impact categories as a
  derived sentence that declares its own derivation. Supersedes this doc's earlier recommendation to
  leave it empty.
- [x] **`Capabilities.Mitigation Connection`** — **skip.** Left empty deliberately, recorded as
  `accepted-loss` so it reads as decided rather than missed.
- [x] **`Actions` primary/secondary/tertiary action type** — **inference approved**, via a
  tier-and-guardrail algorithm. Promoted to a standing, consultant-invariant rule in Layer 1 with
  scores in [`../../skills/action-type-tiers.csv`](../../skills/action-type-tiers.csv).
- [x] **Per-hazard ranking** — closed. The owner ruled `hazard_of_concern` addresses it;
  no ranking column needed.
- [x] **`Carried Forward to 2020 Plan`** — **direct field map**: `Yes` ⇒ `Included in Last HMP = Yes`.
  No matching, no text preservation, no review flagging. *(Revised 2026-08-21 — the first pass proposed
  a fuzzy prior→proposed match; the owner cut it, correctly.)*
- [x] **MAW alternatives** — alternative 1 to `Alternative Action 1` / `…Evaluation`; alternative 2 and
  both alternative costs appended verbatim and labelled to `Cost Benefit Notes` *(revised — first pass
  dropped them)*.
- [x] **The small items — shoehorn verbatim where a relevant column exists, register the rest.**
  Everything homed except five items. `Level of Protection` + `Useful Life` → `Cost Benefit Notes`;
  `Desired Timeframe` → `action_status_details`; Hempstead's `Hamlet` → `Address (if available)`;
  POC street addresses → **`Roles.address_optional`**; the Coastal Protection / Dam Rehab true type →
  **`Actions.action_type_specific_if_applicable`**; adoption status → `lhmp_planning_process`;
  `Required Changes` → `action_status_details` (labelled, so no longer lossy); `Economy` folded with the
  verbatim string kept in `other_comments`.
- [x] **Omissions register created** — `context/omissions-register.csv`, **generated from the
  crosswalk** so it cannot drift. Five entries, four of which are the same shape: the plan names a
  *role* or a *placeholder* where the schema needs an *identity*.

### `hazard_of_concern` — the Suffolk silence = No rule, confirmed

| Source | `hazard_of_concern` |
|---|---|
| Table 2, any impact category | Yes |
| Table 2, `No Impact` | No |
| Not in Table 2 at all — Avalanche, Tsunami/Seiche, Wildfire | **No**, from the base plan |

**Every one of the 17 MNY hazards resolves to Yes or No; nothing is left `Not Reported`.** Row math per
jurisdiction: 17 rows.

*History, so nobody works from a stale draft:* a narrower variant (silence ⇒ `Not Reported`) was
adopted earlier on 2026-08-21 and **reverted the same day**. The rule above is standing and is now the
same rule for every county — Layer 1 states it once rather than as a two-county comparison.

**A factual correction made while implementing this.** An earlier draft cited base-plan **Table 10** as
the `reason_for_exclusion` source. That was wrong: Table 10 is captioned *Reason for
**Identification*** and covers the 11 hazards that **were** profiled. Table 11 — the real exclusion
list — is a bare `1x2` cell pair of six names with no reasons, and the rationale is the sentence
immediately above it: *"The following natural hazards are not included in this Plan based on State and
Federal guidance and history of hazard occurrences that indicate these hazards are unlikely to occur or
cause damage:"* One shared county-wide quote on all three rows.

Table 10 earns a mapping anyway: its **`Connection to 2014 Plan`** column maps 2020 hazard names to
2014 ones, flags the five *New Hazard* entries, and is the authority for what *Ground Failure Hazards*
contains (Earthquakes, Expansive Soils, Land Slides, Land Subsidence — the last two have no MNY type).

Also found: **base-plan and annex hazard labels disagree** — *Ground Failure **Hazards*** vs *Ground
Failure*, *Straight-line Wind* vs *Wind*, *Hurricane**s** and Tropical Storms* vs *Hurricane and
Tropical Storms*. Normalise and assert both sets reconcile to 11 before joining. Geomagnetism, Ice Jams
and Volcanoes (also in Table 11) have no MNY type and are dropped.

### Action Type — three things had to be settled to make the spec executable

**Design note 1 — two vocabularies.** The live Actions source (`1029065`) carries *two* action-type
vocabularies: **16 boolean `action_type_*` columns** feeding the calculated `Action Type` multiselect,
and **`primary_/secondary_/tertiary_action_type`**, three `select` columns. The 16 types the owner
tiered are the **booleans**. Decision: **set both** — booleans for truth, the three selects for the
ranked top three.

**Design note 2 — the owner fixed the P/S/T columns mid-session.** Verified live before and after: at
first read `primary_action_type` had 16 options and was missing
`Large Flood Control - Dams, Levees, Floodwalls; Safe Rooms` (which secondary/tertiary had), and
`tertiary_action_type` carried a typo duplicate `Risk/Vulberability Assessment`. After the owner's fix
all three are identical at **17 options**. `Coastal Protection` and `Dam Rehabilitation/Removal` are
still absent, so two Tier-1 substitutions are required and every one is logged:

| Ranked type | Written to P/S/T as | Boolean also set |
|---|---|---|
| Coastal Protection | `Infrastructure Projects` | `coastal_protection` |
| Dam Rehabilitation/Removal | `Large Flood Control - Dams, Levees, Floodwalls; Safe Rooms` | `dam_rehabilitation_removal` |

This is not hypothetical: Glen Cove's CGC_2 (seawall study) and CGC_1 (tide gates) are both Tier 1 and
neither is writable as a Primary select value.

**Design note 3 — three select options had no tier**, existing only in the P/S/T vocabulary.
Assigned: `Infrastructure Projects` → Tier 1 ranked last (structural so the guardrails fire, but it
loses to any more specific Tier-1 type); `Risk/Vulnerability Assessment` → Tier 6 after
`Studies and/or Risk Assessment`; `Prevention/Mitigation Projects` → Tier 8 but ahead of `Other`, so
guardrail 5.6 (Other strictly last) still holds.

**Design note 4 — two guardrails are inert, deliberately.** Guardrails 5.2 ("no type may move up more
than 2 positions") and 5.4 ("unless it has Boost = −2") both reference a score-adjustment step the spec
never defined. Implemented as `Final Score = Tier Score`, which makes 5.2 unreachable and collapses 5.4
into the same shape as 5.3. Coherent, conservative, deterministic — and flagged rather than silently
patched, because defining a boost rule later would activate two dormant guardrails at once.

### Second round of decisions (2026-08-21)

- [x] **`Included in Last HMP` = blanket TRUE, authoritative** for every action row loaded from this
  plan. Reinstated after being briefly superseded. **`Carried Forward to 2020 Plan` does NOT drive it** —
  that field answers whether an action continues *into* the next plan, so it is kept verbatim and
  labelled in `action_status_details`. Now a Layer-1 standing rule.
- [x] **Woodsburgh's Completed Mitigation Actions table** is pulled with `Implementation Status =
  Completed`. `Action Number` and `Local Priority` stay empty (its 12-field set lacks them).
- [x] **`No` is a filter only when the detail cell is empty.** The general conflict rule — *prefer the
  answer carrying more information* — inverts the obvious reading of the four capability tables. Glen
  Cove's NFIP ordinance and its Table 4 construction-practices row are both created despite answering
  `No`. Overrides are logged; the §8 cross-check stays.
- [x] **County-level Hazards of Concern comes from the base plan, always** — and it is richer than an
  annex. Tables 15–44 carry a `9x2` profile box per hazard; the `Impact` cell is real prose, so the
  county's `general_vulnerability` is a transcription while its jurisdictions' is a derived sentence.
  `Frequency` → `likelihood` needs a qualitative→band mapping with owner sign-off.
- [x] **Identity resolved** — Glen Cove takes **`3629113`** (Place, not the `3605929113` cousub row);
  *Rockville **Centre*** is correct.
- [x] **Freeport: use the PDF** — but see the finding below; it is not an annex. **Fully extracted 2026-08-21, see Phase 6b.**

### ⚠ Finding: Freeport is not a Hagerty annex

`51_Village of Freeport_Jurisdictional Annex.pdf` is the Village's own standalone **"2020 All Hazard
Mitigation Plan"** — 177 pages, 7 chapters, 10 hazard profiles with their own *Probability of Future
Occurrences* and *Vulnerability/Impact* subsections, 20 prose capability sections, and five hazards
with no MNY type (Terrorism, Hazardous Materials, Cyber-Terrorism, Urban/Structural Fire,
Epidemic/Pandemic). **None of the 12 Hagerty spine headings appear.**

Text extracts cleanly (356,988 chars via `pypdf` → `context/extracted/freeport_pdf.txt`), so the
owner's direction to use the file is workable — but it **cannot** go through the annex parser. Tracked
as `pipeline = freeport-standalone` in the alias table and needs its own crosswalk. Ironically it is
the only Nassau jurisdiction that *does* carry per-hazard vulnerability prose and probability data.

### Third round of decisions (2026-08-21)

- [x] **Participation: two rows** for a multi-date meeting. 9 meetings → **11 rows**. *"February 19 and
  20"* is two events; *"June 25 – July 16"* is a window whose two rows mark its bounds — labelled so
  they don't read as two meetings.
- [x] **`likelihood` stays empty everywhere**, county rows included. The base plan gives a qualitative
  frequency phrase, not a probability band, so any mapping is invention. Verbatim to `other_comments`.
  *(Reverses the previous round's "map it with sign-off".)*
- [x] **`Roles.role` is a single select** → one Roles row per person **per role**. Row math is
  people × roles. The workbook's "Multi-Select" is wrong.
- [x] **Roles dedupe confirmed** — prefer the annex POC row (only source with email/phone), enrich from
  the roster, key on `(geoid, normalised name)`.
- [x] **`Action Point of Contact` stays empty** when the plan names none.
- [x] **`Required Stakeholder?` and non-municipal `Role` values are no longer gaps** — 20 of the 190
  roster people belong to 13 non-municipal organisations (FEMA, NYS DHSES, NYSDEC, NYC EM, Suffolk
  County, LI Regional Planning Council, NYSFSMA, Soil & Water CD, Village Officials Association,
  Hagerty ×5). Those are the FEMA A2-a categories. Normalise the org strings first — *FEMA* /
  *Federal Emergency Management Agency (FEMA)*, *NYS DHSES* / the full DHSES name, and a plural
  *Villages of Woodsburgh*.

### Design note: two bugs in my own alias builder

Both silent-looking, both caught only by assertions, and both the same mistake — trusting a derived key
and an assumed category:

1. `seen` was keyed on the **annex folder's** spelling, so *Rockville Cent**er*** never matched the
   matrix's *Rockville Cent**re***; the jurisdiction was emitted **twice** with one geoid.
2. The second pass **assumed** every leftover matrix row was a non-participant, mislabelling that
   duplicate `Withdrawn` when its real status was `Adopting`.

The builder now keys on the resolved crosswalk name and asserts geoid uniqueness, matrix membership for
every row, and that the leftovers really are all `Withdrawn`. The uniqueness assertion is the only
reason either surfaced. Recorded in Layer 1's Phase 3b.

### Design note: three "gaps" were never gaps

Reading the **live** sources instead of the workbook turned three declared gaps into real columns:
`Roles.address_optional`, `Actions.action_type_specific_if_applicable`, and (retrospectively, on
Suffolk) `Hazard Name, If Other`. The lesson is now in Layer 1 as its own subsection — *the workbook is
not the schema* — with the one-line `dms raw get` recipe. Also logged: `Actions.alternative_action_1`
and `alternative_action_1_evaluation` are both marked **`(dep)`** live, so the `Cost Benefit Notes`
copy of the alternatives is the durable record.

### Round 7 (2026-08-21) — policy, not just mappings

- [x] **Capabilities target confirmed** — `Capabilities_Catalogue`; Capacities on hold/deprecated.
- [x] **The workbook is ILLUSTRATIVE ONLY.** Always prefer the live schema; a workbook-only column is
  most likely *deprecated*, not missing, and must not be recorded as a gap. Promoted to a Layer-1
  standing rule, and it reframes report §6 from "divergences to reconcile" to "don't use the workbook
  as a schema".
- [x] **`geoid_juris` is never multi-valued**, and workbook Multi-Select declarations are unresolved
  relics. **Reverses last round's plan** to carry every attending jurisdiction in one meeting row:
  the attendance matrix becomes **254 Participation rows** (243 attendance marks + 11 county-level),
  not 11.
- [x] **HOC view trap resolved by the owner** — the test view erroneously marked current has been
  deleted; source `1473470` re-verified as having exactly one view.
- [x] **Roles row count corrected** — ~239, not the 250–350 previously estimated. Measured: 190 roster
  + 102 annex POC people, only 49 overlapping. The ×roles multiplier is ≈1 because the live
  vocabulary's 52 options are specific enough that most titles resolve to exactly one.

### Crosswalk after the decisions

180 rows (was 163). **`gap-no-target` is zero**, and only **five** items have no home at all.

| Disposition | Before | After |
|---|---:|---:|
| `dataset-fill` | 77 | **91** |
| `derived` | 16 | 21 |
| `constant` | 17 | 17 |
| `gap-empty` | 19 | 17 |
| `boilerplate` | 10 | 10 |
| `auto-populated` | 5 | 5 |
| `filter` | 4 | 4 |
| `gap-partial` | 2 | 3 |
| `superseded` | — | 1 |
| `lossy` | 3 | 1 |
| `gap-weak` | 1 | 1 |
| `accepted-loss` | — | 1 |
| `separate-track` | — | 1 |
| **`gap-no-target`** | **9** | **0** |

## Phase 5 — Identity and manifest — DONE (2026-08-21)

- [x] **Glen Cove's two geoids resolved** — takes **`3629113`** (the `Place` row); the `3605929113`
  cousub row is not used.
- [x] **Rockville Cent*re*** confirmed as the correct spelling against the folder's *Center*.
- [x] **`nassau-jurisdiction-aliases.csv` built** — 52 folders → **52 distinct geoids, zero
  collisions** (1 county, 2 cities, 3 towns, 46 villages). Carries `annex_file`, `pipeline`
  (`hagerty-annex` × 51 / `freeport-standalone` × 1), `n_maw` and a decision note per overridden row.
  *(Superseded later the same day — see the attendance-matrix item below: the table was rebuilt at
  **70 rows** to cover the 18 withdrawn villages. 70 is the current figure.)*
- [x] **`file-manifest.csv` built** — all 52 folders reviewed file by file. 47 unambiguous, 5 decided
  by content (every mtime is identical, so filenames and dates carry no authority). Corrected the
  worksheet total from 139 to **143**.
- [x] **`in_jurisdictions` / `in_hoc` flags added** to the alias table for all 70 jurisdictions —
  70/70 yes on both, 17 HOC rows each. See Phase 5b.
- [x] **Reconciled the 70 attendance-matrix jurisdictions against the 52 annexes** — the 52 `Adopting`
  rows map **1:1** onto the annex folders; the 18 without an annex are all incorporated Villages marked
  `Withdrawn`, **zero CDPs**, 14 with documented attendance, 34 named people in the roster. Owner rule
  2026-08-21: **Roles + Participation for all 70, everything else for the 52.** The alias table is
  rebuilt at **70 rows** with `has_annex` / `adoption_status` / `meetings_attended` / `in_scope_for`.
  Script: `reconcile_matrix.py`.
- [x] **All five remaining live schemas read** (Participation, HOC, Capabilities_Catalogue,
  Capacities, Capacities V2). See Phase 5b for the divergences and the pre-load census.

## Phase 5b — Live-schema reads — DONE (2026-08-21)

All five remaining forms sources read live. **The live schemas are authoritative** (owner,
2026-08-21); where the workbook disagrees, the workbook is wrong. Dumps in
`context/extracted/live_schemas.txt` and `live_<id>.json`.

### Pre-load census: no readiness problem at all

| Dataset | Source | Statewide rows | Nassau rows | Jurisdictions | Operation |
|---|---|---:|---:|---:|---|
| Hazards of Concern | `1473470` / view `1473471` | 27,791 | **1,190** | 70 | **UPDATE** |
| Jurisdictions | `1346449` | 2,346 | 138 | 70 | **UPDATE** |
| Roles | `1473295` | 144 | 0 | 0 | **INSERT** |
| Participation | `1473468` | 324 | 0 | 0 | **INSERT** |
| Capabilities_Catalogue | `1068273` | 269 | 0 | 0 | **INSERT** |
| Capacities | `1689772` | 2 | 0 | 0 | **INSERT** |

- [x] **`in_jurisdictions` / `in_hoc` flags written into the alias table** — **70/70 yes on both**,
  and `n_hoc_rows = 17` for every single jurisdiction. Nothing to create, no jurisdiction to drop.
  This is the clean case; Suffolk needed a synthetic geoid and 17 new rows for one entity.
- [x] **HOC verified as an update, exactly as expected.** 1,190 Nassau rows = 70 × 17, **every one
  `hazard_of_concern = "Not Reported"`**, every content column empty. So: **884 updates** (52 annex
  jurisdictions × 17) + **306 rows deliberately untouched** (the 18 withdrawn villages) + **0 inserts**.

> **⚠ Blast radius.** Roles has **144 rows statewide** and Participation **324**;
> Capabilities_Catalogue has **269**. Nassau will add roughly 250–350, 11 and ~900 respectively — so
> this load *more than doubles* Roles and roughly quadruples Capabilities_Catalogue. Dry-run and
> back up before the first insert; a bad batch here is a material fraction of the whole dataset.

### ⚠ The default HOC view is the wrong one

Source `1473470` has two views and they hold **different shapes**:

| | view `1473471` | view `1603024` (the default) |
|---|---|---|
| Rows | 27,791 statewide, **1,190 Nassau** | 119 statewide, **0 Nassau** |
| `hazard` | display labels (`Coastal Hazards`) | internal codes (`wildfire`) |
| `geoid_juris` | a real array `["3601000"]` | a **string** holding an array `"[3600116694]"` |
| `likelihood` | null | `"Likely"` — **not one of the declared options** |
| `county` | `Chemung` | `Chemung (County)` |

`dataset dump` with no `--view` picks `1603024`. **Always pass `--view 1473471` explicitly**, or the
load reads an empty, differently-shaped view and silently does nothing.

### Schema divergences found (the workbook is wrong in all of these)

**Hazards of Concern**
- `hazard`'s declared options are internal codes (19, including `other` and `volcano`) but **all 1,190
  stored Nassau rows use the 17 display labels.** Match on the stored labels.
- `hazard_of_concern` is a `radio` with `Yes | No | Not Reported` — the tri-state decision is directly
  expressible.
- `climate_change` is `radio` with **`Yes | No` only** — no `Not Reported`, so leave it empty.
- The four vulnerability columns are `checkbox` (`Yes|No`), not booleans.
- `hazard_name_if_other` **exists** — confirms the Suffolk finding.

**Participation** — five divergences, three of them useful:
- `narrative` and `agenda_minutes` are **`lexical`**, not Text. They need lexical payloads.
- **`participation` (text) exists and is absent from the workbook** — an exact home for base-plan
  Table 7's *Participation* column. Re-mapped off `milestones`.
- **`meeting_unique_id` (text) exists** — use it to pair the two rows of a split multi-date meeting.
- **`geoid_juris` is a `multiselect`** — so one county-level meeting row can carry every attending
  jurisdiction directly from the matrix. **This replaces the planned per-jurisdiction join** with a
  direct read.
- `format` has no `Multimedia` and `invite_method` no `Various Types`, both of which the workbook
  lists. `milestones` is text, not Multi-Select.

**Capabilities_Catalogue** — the significant one:
- **The four FEMA category columns are named `(Delete) FEMA - …` live.** The crosswalk mapped Tables
  3/4/5 onto three of them. **Re-mapped** to `primary_capability_type` (a 16-option select) plus the
  capability-type checkboxes, from which the live source *derives* its `… Category` columns.
- **~35 of its 136 columns are `(Delete)`-prefixed** — including every buildings / infrastructure /
  RL-SRL / climate column the workbook dictionary describes. The dictionary documents a schema that is
  being retired.
- `dam_rehabilitation_removal` is `(Deprecated)`; `floodproofing_other`'s display name has a typo
  (`PFloodproofing, other`); `administering_agency` and `administering_agency_organization` are two
  columns with the *same* display name; `tertiary_hazard_type` carries `Tsuname/Seiche` and `WIldfire`.
- Its `primary/secondary/tertiary_capability_type` vocabulary **does** include Coastal Protection and
  Dam Rehabilitation/Removal — the two the *Actions* P/S/T vocabulary lacks. The same two concepts,
  expressible in one dataset and not the other.

---

## Phase 6 — Batch extraction — DONE (2026-08-21)

Full write-up: [`../../skills/worked-examples/nassau-extraction-report.md`](../../skills/worked-examples/nassau-extraction-report.md).
Scripts committed to [`../../skills/scripts/nassau/`](../../skills/scripts/nassau/).

- [x] **Extracted the 51 Hagerty annexes** → `extracted/annexes/<geoid>.json`, driven by
  `file-manifest.csv` and keyed on the alias-table geoid. **Every total matches the Phase-3
  pre-flight**: 102 contacts (51×2), 550 hazard rows (50×11), 894 capabilities, 282 prior actions,
  2 completed, 234 proposed.
- [x] **Extracted the 142 worksheets** → `extracted/maws.json`. 132 instruction-template tables
  skipped; 142/142 carry a project number; **66 of 142 have a file index that disagrees with the
  project number**, confirming the join-on-project-number rule empirically.
- [x] **Extracted the base plan** → `extracted/baseplan.json`: 9 meetings → **11 Participation rows**
  (the two-row rule applied), 243 attendance marks, 52/18 adoption split, 190 roster people (49 CPG),
  11 hazards identified, 6 not profiled, 10 ranking rows, and the **12 per-hazard `9x2` profile
  boxes** that feed county HOC.
- [x] **QA assertions run** → `qa-punchlist.csv`, **115 findings; 115 resolved, 0 open** after adjudication. Four orphan
  worksheets, each a different failure (hyphen-vs-underscore separator, wrong jurisdiction prefix,
  one worksheet covering eight projects, one with no matching action); five real cost disagreements
  including a transposed pair; Muttontown systematically unreliable (10 rows).

### The Phase-6 headline: 27 ordinances nearly went missing

The detail-beats-checkbox rule was implemented **row-locally** — a `No` with a non-empty detail cell.
QA then flagged 29 of 51 jurisdictions with an NFIP-ordinance conflict, which was too many to be
coincidence, so I hand-checked three instead of softening the check. The detail was real but **in the
NFIP Summary prose, not Table 3's citation column** — Glen Cove: *"last amended 07/28/2009 … Chapter
154, City Code, L.L. No. 6-2009"* against a Table 3 `No`. The extractor now reads that prose as
detail (requiring an actual date/`Chapter`/`§`/`L.L.`, not a bare mention), recovering **27 new
capability rows**. Lattingtown and Woodsburgh correctly still fail — they say only *"meets minimum
requirements"*, with nothing to override the checkbox.

### Design note: four silent parser bugs the corpus found

1. **Footnote markers fused into header cells** — `"1Primary Point of Contact"` in five annexes.
   Exact-match classification dropped their *entire* contact table: 92 contacts instead of 102, no
   error. `delabel()` strips leading and trailing footnote digits.
2. **POC cells use `<w:br/>`, not paragraphs.** `para_text()` joins `w:t` with `''`, so the cell reads
   `Mayor Timothy Tenke, MayorCity of Glen Cove9 Glen Street…` and cannot be split. Added
   `cell_lines()`.
3. **`endswith` matched the parent heading.** `"Legal and Regulatory Capability Assessment"` ends with
   `"Capability Assessment"`, so all four subsections filed under the parent and **every
   `capability_summaries` value came out empty**. Match exact-first, then longest-suffix-first.
4. **Merged banner rows** — the base plan's `9x2` profile boxes have a one-cell row 0 after
   merged-cell dedupe, so a `len(row0) >= 2` guard found zero of 12; and the six not-profiled hazard
   names are separate paragraphs in two merged cells, which `cell_text`'s space-join destroyed.

### Design note: one QA check was mine, not the corpus

`maw-cost-mismatch` first reported 13; four were my money parser pulling a fragment out of prose
(`"~$30-$50 per linear foot"` → 30, `"approximately $3M"` → 3) and comparing it to a clean figure. It
now refuses prose and reports `cost-not-comparable` instead. **A check firing on half the corpus is
usually the check — but verify which.** Here the NFIP check firing 29× was real and the cost check
firing 13× was not.

## Phase 6b — Freeport, the independent plan — DONE (2026-08-21)

Investigated on the hypothesis that an independent jurisdictional plan warrants its own generalized
profile and that most extraction mechanics would transfer. **Half right**, and the half that's wrong
is the useful part.

- [x] **Structural analysis.** An independent jurisdictional plan is **not a big annex — it is a small
  county plan.** Freeport's spine maps chapter-for-chapter onto the Nassau *base plan*, not onto the
  annex spine. So the county-plan machinery is the closer analogue, scoped to a municipal geoid.
- [x] **Measured what transfers.** Method ~100%, MNY target side ~100%, **parsing ~0%** — different
  format, no table geometry, a prose instrument. `annex_lib.py` is inapplicable. The new parser was
  ~150 lines, not a pipeline rewrite.
- [x] **Extracted it** → `extracted/independent_3627485.json` via
  [`extract_independent_plan.py`](../../skills/scripts/nassau/extract_independent_plan.py):
  **53 actions** with 7 labelled fields (five at 53/53, feasibility 52/53, progress 51/53), 3 goals,
  10 objectives, 22 committee members, 20 capability sections, 10 hazard profiles, 123 ToC entries.
- [x] **Wrote [`profiles/independent-jurisdictional-plan.md`](../../skills/profiles/independent-jurisdictional-plan.md)**
  as a **document-class** profile, stating up front that it cannot predict the next instance the way a
  consultant profile does — there is no shared author.
- [x] **Added Phase-0 question 4** to Layer 1: *is every jurisdiction's content actually in the
  consultant's instrument?*

### The transferable finding: in a PDF, prose beats tables

Freeport's action summary table (p121) is destroyed by the text layer — 360 KB of extracted text
contains **zero** tab-separated lines. The *same data* appears as labelled prose in §5.1 and extracts
at 100%. So target the labelled prose and treat the summary table as the lossy duplicate — the
opposite instinct from a consultant annex, where tables are everything.

### Design note: one document needed two normalisations

The action instrument reads best from **flattened** text (PDF line breaks are meaningless
mid-sentence); the committee roster is **one member per line**, so flattening destroys its only
delimiter. My first pass flattened everything and returned **0 committee members with no error**.
Parse actions flattened and the roster line-anchored, in the same run.

Two smaller traps: the spine must come from the **ToC**, not the body (critical-facility address lines
like `2810 MERRICK RD EAS` match a numbered-heading pattern), and ToC titles can contain periods — a
`[^\n.]+` title pattern silently dropped 2 of 20 capability sections.

### Taxonomy contrast worth keeping

**Nassau's consultant plan under-ran MNY's taxonomy and closed cleanly; one village's own plan
over-ran it.** Freeport has five hazards with no MNY type (Terrorism, Hazardous Materials,
Cyber-Terrorism, Urban/Structural Fire, Epidemic/Pandemic) → `Other` + `hazard_name_if_other`, plus a
combined Nor'easter/Winter Storm/Ice Storm profile needing the split. Do not infer a county's taxonomy
shape onto an independent jurisdiction inside it.

### Aligned into the group (2026-08-21)

- [x] **Reshaped into the annex envelope** — `align_independent_plan.py` writes
  `extracted/annexes/3627485.json`, so all **52** jurisdictions live in one folder with one shape and
  a Phase-7 builder never special-cases Freeport. **Reshape only**: two assertions run every pass and
  both hold — *nothing altered* (700 values checked verbatim) and *nothing dropped*. Empty fields
  carry a reason in `_alignment`, so an empty field is never mistaken for a failed extraction.
- [x] **Four judgement calls recorded in the record, not in a commit message:** contacts come from the
  planning committee with `slot=committee` and the HM-representative flag **left blank rather than
  invented**; all 53 actions file as `proposed_actions` with completion status left verbatim in
  `Progress Since 2014` for Phase 7 to derive (bucketing here would be inference);
  `Financial and Political Feasibility` and `Progress Since 2014` keep their own keys because neither
  is `Estimated Benefits`; and `3.11 CATEGORIZATION OF HAZARDS` is excluded from `hazard_impacts` as a
  section, preserved under `non_hazard_sections`.
- [x] **`verify_group.py`** asserts one code path reads all 52 — same envelope, same list-element
  keys, counts matching list lengths, no geoid drift. **PASS.**

### The cohesion check found two Hagerty bugs immediately

Counting distinct `proposed_actions` key sets surfaced two label variants nobody had noticed:
**Bayville** labels the priority field `Hazard Ranking` and **Sea Cliff** `PriorityRanking` (no
space). Both hold `High`/`Medium`/`Low` — verified before aliasing, since *Hazard* Ranking could
plausibly have held hazard names. Left alone, **7 actions would have lost `Local Priority` silently.**
The extractor now canonicalises action labels whitespace-insensitively with one alias, warns per
variant, and keeps the original under `_source_labels`. After the fix **all 14 canonical action keys
are present in every one of the 287 actions** across both document classes.

**Group totals:** 123 contacts · 560 hazard rows · 914 capabilities · 282 prior · 2 completed ·
**287 proposed actions** · 52 records.

### Punch-list adjudicated (2026-08-21) — 115 resolved, 0 open

Rulings are recorded in `qa-resolutions.csv` and joined into the punch-list on every run, so a
regenerated list shows what was decided rather than re-presenting settled findings as open.

- [x] **The WORKSHEET wins whenever an annex and a worksheet disagree.** Set annex-first on
  2026-08-21 and **reversed the same day on review** — the worksheets are more detailed and
  intentional. Closes 5 HIGH cost mismatches and 23 LOW name mismatches with no per-finding review.
  Three measured caveats: it governs only **137 of 234** actions (the other 97 have no worksheet);
  **Muttontown receives none** because its worksheets are numbered `VMP_*` against annex `VMTT_*`;
  and **cost needs a split** because `Estimated Cost ($)` is numeric while 72 of 142 worksheet cost
  cells are not parseable numbers — worksheet text verbatim to `Cost Notes`, numeric slot falls back
  to the annex figure.
- [x] **Lattingtown / Woodsburgh NFIP: no action.** The prose says only *"meets minimum
  requirements"* — no date, no citation, nothing to support creating a capability. Closes 2 HIGH.
- [x] **Muttontown's checkboxes are unreliable wholesale.** The override already applied to all 10
  rows, so the extract is correct as-is. Closes 1 HIGH.
- [x] **The 28 MEDIUM NFIP overrides stand** — the county human-reviews this document later.
- [x] **The 74 LOWs are non-issues or already answered.**
- [x] **Muttontown's orphan worksheets RESOLVED (2026-08-21).** Owner judged `VMP_` a duplication
  error; corrected to `VMTT_` in `extract_maws.py`. Verified three ways before applying — Responsible
  Organization reads *"Village of Muttontown"*, project names match the annex, problem narratives
  match near-verbatim. **Keyed on `(folder, wrong_number)`**, because `VMP_1`/`VMP_2` are *genuine*
  numbers in Massapequa Park and Munsey Park — a number-only correction would have rewritten their
  real actions. Worksheet coverage rose 137 → **139 of 234**.
- [x] **All four orphan worksheets RESOLVED (2026-08-21).** None yielded to a precedence rule —
  precedence needs two statements about the same thing, and an orphan has one side. Each resolved on
  its own evidence:
  - **Cove Neck** — annex `VCN_1` corrected to **`VCN-1`**, adopting the worksheet's hyphen. Visible
    consequence recorded: `VCN-1` now sits alongside `VCN_2/3/4`.
  - **Oyster Bay `TOB_14`** — kept as a **worksheet-only action**; the annex table stops at `TOB_13`
    and the worksheet carries every field an action needs.
  - **Village of Hempstead** — the `"VOH_1, … VOH_8"` worksheet is a **programme-level roll-up**, and
    worksheet-precedence is deliberately **not** applied. Proof: its `$1,005,000.00` is *exactly* the
    sum of the eight annex costs. Naive precedence would have replaced eight specific firehouse
    projects with one generic description and inflated the cost eightfold.
  - **Muttontown** — worksheet `VMP_*` corrected to `VMTT_*` (see above).

  **The punch-list is now 115 findings, 0 open.** `qa_assertions.py` understands the three worksheet
  relationships (`one-to-one`, `rollup`, `orphan-action`), so a roll-up no longer reports as an
  orphan.

### Design note: project numbers are unique only WITHIN a jurisdiction

**`VMP_1` and `VMP_2` are genuine project numbers in two *other* annexes** — Massapequa Park and
Munsey Park — because all three of Munsey Park, Muttontown and Massapequa Park abbreviate to `VMP`.
285 distinct numbers cover 287 actions. So: **join on `(geoid, project_number)`** and **key correction
tables on `(folder, wrong_number)`**. A number-only correction of `VMP_1 → VMTT_1` would have
rewritten two other jurisdictions' real actions with no error raised. The extractor already joined
per-geoid, so nothing was contaminated — luck rather than design. Now a Layer-1 rule.

### Design note: a cheap test for roll-up worksheets

When one worksheet claims several project numbers, **sum the component costs**. If the sum equals the
worksheet's cost, it is a programme-level roll-up and precedence must not be applied to its name,
cost or narrative.

**Design note: the flag paid off.** I had applied annex-precedence as instructed but kept the
worksheet narratives in a companion field and flagged that annex-wins was the one rule that
*discarded* authored text rather than choosing between two statements of the same fact. On review the
owner reversed it. Because nothing had been dropped, the reversal cost one crosswalk pass and no
re-extraction.

**Design note: the reversal exposed a parser bug.** `VRG_1` leaves its Level of Protection, Useful
Life and Estimated Cost cells empty, and my pair-walker took "the next non-empty cell to the right" —
the *adjacent label* — so its cost read `"Estimated Benefits (losses avoided):"`. Under
annex-precedence that value lost anyway; under worksheet-precedence **it would have won and loaded**.
The walker now stops at any cell ending in `:`; zero label-as-value cells remain corpus-wide.

### Freeport hazard mapping settled (2026-08-21)

- [x] **Rule applied** — shoehorn where a comparable MNY hazard exists, else `Hazard = Other` with the
  plan's own name verbatim in `Hazard Name, If Other`. Committed as `freeport-hazard-map.csv`:
  **7 named · 6 `Other` inserts · 10 set to `No`.**
- [x] **`Other` verified storable** against all 27,791 live HOC rows — 271 already use the display
  label `Other`, 275 already set `hazard_name_if_other`. **Retires the Suffolk-era blocker** that
  `hazard` had no `Other` option. Use the label, not the code `other` (3 rows).
- [x] **Corpus HOC math updated: 884 updates + 306 untouched + 6 INSERTS** (previously 0). Freeport is
  the only jurisdiction needing inserts.

Two traps recorded in the profile: **count hazards, not headings** (`NOR'EASTER/WINTER STORM/ICE
STORM` is three hazards, giving six `Other` rows not five), and **do not shoehorn `Urban/Structural
Fire` into Wildfire** — Freeport profiles no wildfire, so mapping it would assert an assessment the
plan never made.

### Still open for Freeport

- Its §4 capability sections are **problem-oriented** (`FLOODING ON ROADS`) — some are capabilities,
  some are problem statements for `lhmp_problem_areas`. Needs a section-by-section triage, and there
  is no Yes/No column for the detail-beats-checkbox rule to act on.
- Its 3 local goals need mapping onto the 6 SHMP goal booleans — a judgement call.
- No crosswalk CSV of its own yet; the field map in the profile is the interim spec.

---

## Phase 7 — Transform, review, load — IN PROGRESS (7a started 2026-08-24)

Everything extracted so far is **source-shaped**: verbatim values keyed by each source's own labels.
Phase 7 is where the decided rules get applied to produce **MNY-shaped rows**, and then loads them.
**No new decisions are required to start** — the open judgement calls listed at the end are small and
none of them blocks 7a.

### What is in hand

| Input | Volume |
|---|---|
| `extracted/annexes/<geoid>.json` | **52 records**, one envelope, `verify_group.py` PASS |
| `extracted/maws.json` | **142 worksheets** — 140 one-to-one, 1 roll-up, 1 orphan-action |
| `extracted/baseplan.json` | 11 meetings · 243 attendance marks · 190 roster people · 12 county hazard boxes |
| `nassau-annex-crosswalk.csv` | **185 mappings**, 108 actionable |
| `nassau-jurisdiction-aliases.csv` | 70 jurisdictions, `in_hoc`/`in_jurisdictions` 70/70 |
| `freeport-hazard-map.csv` · `qa-resolutions.csv` · `file-manifest.csv` | decisions, committed |

### 7a — Transform: source-shaped → MNY-shaped  ⬅ **start here**

One builder per dataset, reading the 52 records + `maws.json` + `baseplan.json` and emitting
MNY-column-keyed rows. This is the bulk of the work and it is **pure code — every rule it applies is
already decided**:

- [ ] **`build_hoc.py`** — 11 Nassau hazards → 14 MNY named types (3 splits); `hazard_of_concern`
  tri-state (category ⇒ Yes, `No Impact` ⇒ No, silence ⇒ No); `general_vulnerability` as the
  self-declaring derived sentence; the 4 vulnerability checkboxes from the impact categories;
  `Economy` folded into `population_vulnerability` with the verbatim string to `other_comments`;
  `likelihood` left empty everywhere. County row from the base plan's `9x2` boxes instead. Freeport
  per `freeport-hazard-map.csv`. **Match on `(geoid_juris, hazard display label)`.**
- [ ] **`build_actions.py`** — the largest builder. Merge annex + worksheet under
  **worksheet-precedence** on the 139 matched pairs, annex-only on the other 95, with the two declared
  exceptions (the VOH roll-up must **not** overwrite its 8 components; `TOB_14` is worksheet-only).
  Apply the Action Type tier algorithm + guardrails 5.1–5.6 → the three selects **and** the 16
  booleans **and** `action_type_specific_if_applicable`; vocabulary maps for `Implementation Status`
  and `Estimated Time Required`; `Goal being met` digits → the six SHMP goal booleans; cost split
  (worksheet text → `Cost Notes`, numeric slot falls back to the annex); `Included in Last HMP = TRUE`
  throughout.
- [ ] **`build_capabilities.py`** — Tables 3–6 → `Capabilities_Catalogue` rows; `primary_capability_type`
  + the capability-type checkboxes (**not** the `(Delete) FEMA -` columns); `Local` administering
  agency; the detail-beats-checkbox overrides already resolved in the extract; `Mitigation Connection`
  deliberately empty.
- [ ] **`build_roles.py`** — annex POCs + the 190-person roster, deduped on
  `(geoid, normalised name)` preferring the POC row (it has email/phone); **one row per person per
  role**; `Required Stakeholder?` and the non-municipal `Role` values from the 13 non-municipal
  organisations; org-name normalisation (`FEMA` / `Federal Emergency Management Agency (FEMA)`, the
  two DHSES spellings, plural `Villages of Woodsburgh`).
- [ ] **`build_participation.py`** — 11 county-level meeting rows + **243 per-jurisdiction rows** from
  the attendance matrix (one geoid per row — `geoid_juris` is never multi-valued); `narrative` and
  `agenda_minutes` as lexical; `participation` text column; `meeting_unique_id` pairing the split
  multi-date rows.
- [ ] **`build_jurisdictions.py`** — the **7** lexical columns (`growth_and_development_trends`,
  `lhmp_municipality_profile`, `nfip`, `lhmp_problem_areas`, `lhmp_risk_overview`,
  `lhmp_capacity_to_implement`, `lhmp_planning_process`) as markdown, ready for the lexical compile.

**Dry-run every builder over the whole corpus before loading anything** (the standing Layer-1 rule),
and have each emit a per-jurisdiction row count so the totals can be reconciled against the extract.

### 7a COMPLETE — all six builders written, every one validating clean (2026-08-24)

| Builder | Operation | Rows | Errors |
|---|---|---|---|
| `mny_schema.py` | shared validator | — | — |
| `build_jurisdictions.py` | UPDATE | 52 × 7 lexical columns | 0 |
| `build_hoc.py` | UPDATE + INSERT | **884 + 6** | 0 |
| `build_capabilities.py` | INSERT | **896** | 0 |
| `build_roles.py` | INSERT | **262** | 0 |
| `build_participation.py` | INSERT | **245** | 0 |
| `build_actions.py` | INSERT | **571** (287 proposed + 282 prior + 2 completed) | 0 |
| | | **1,974 inserts + 890 updates + 52 lexical** | |

Every projected figure was hit exactly. Two projections were corrected on evidence:
Participation is **245, not 254** (the earlier figure added all 11 narrative meetings on top of
the 243 attendance marks, double-counting the nine the matrix already covers), and Capabilities
is **896, not 914** (18 source rows carry neither an answer nor a description, so there is
nothing to record).

**`mny_schema.py` is the safety net Phase 6 lacked.** Every row routes through `validate()`
against the live vocabularies, and it caught nine real defects that would otherwise have
loaded silently — listed below. It also records the **storage encodings, which are calibrated
rather than declared**: the declared column `type` is wrong in several places and the stored
form is what the UI reads back.

### ⚠ Actions had no load precedent — Suffolk explicitly scoped it out

Suffolk's load report says plainly *"Actions was out of scope for this slice"*; its actions came
through a reconciled `.xlsx` handled by another staff member. So five builders had a proven
Suffolk counterpart and **Actions had none**. It is also the one dataset whose checkbox encoding
could not be calibrated — no live Actions rows were available to measure, so
`CHECKBOX["actions"]` is a single constant to correct once they can be read. **This is the one
thing to verify before the Actions load.**

### ⚠ The Action Type algorithm existed only in the transcript

The owner's tier-and-guardrail specification had never been written to a file. A context summary
had preserved only the guardrail *names* — "5.1 Structural Dominance, 5.2 Max Jump Limit…" —
which cannot be implemented from. Recovered from the session transcript and written to
[`skills/action-type-algorithm.md`](../../skills/action-type-algorithm.md).

**Any rule an owner gives verbally belongs in a file the same day.** This one survived only
because the transcript was still on disk.

The implemented algorithm is visibly doing its job: structural types take Primary 358 times
(Power 138, Community Infrastructure 129, Large Flood Control 91) while Codes reaches Primary
only 5 times and Education 6 — guardrails 5.1, 5.3 and 5.5 respectively.

### ⚠ Goals are NOT a 1:1 mapping — the highest-risk finding in 7a

Nassau has six goals and MNY has six goal booleans, and **they are in different orders.** Read
from the base plan rather than assumed:

| Nassau | | MNY |
|---|---|---|
| 1 Build stronger | → | **6** `build_stronger6` |
| 2 Build/support local capacity to prepare, respond, recover | → | **1** health and safety *(nearest fit)* |
| 3 Protect existing property | → | 3 *(exact)* |
| 4 Increase awareness | → | 4 *(exact)* |
| 5 Preserve/restore natural systems | → | 5 *(exact)* |
| 6 Coordination of land use and redevelopment planning | → | **2** coordination *(nearest fit)* |

A naive 1→1 mapping would have mislabelled the two most-used goals on all 287 proposed actions
and never raised an error, because both source and target are valid values. **Goal 1 alone
appears on 55 actions before combinations.** The two nearest-fit rows are worth an owner's eye;
the other four are exact.

### The nine defects the validator caught

1. **The seeded HOC grid stores display labels, not the declared codes.** `hazard` declares 19
   lowercase codes (`riverine`, `icestorm`) but all 1,190 seeded rows store `"Flooding"`,
   `"Ice storm"`. Validating against the declared list rejects every correct value; the observed
   vocabulary is now written out in `STORED_VOCAB`.
2. **The deprecated `Hazards` multiselect has its OWN vocabulary** — `"Ice Storm"` with a capital
   S, and no `Most or All Hazards` member at all. Writing the canonical labels into it failed on
   both counts; it now goes through a translator that enumerates all 17 where the source says
   "all".
3. **The county hazard vocabulary is not the annex vocabulary** — `Flooding/Inland`, plural
   `Hurricanes and Tropical Storms`, and Ground Failure split into two boxes rather than
   combined. Left **7 of the county's 17 rows unaddressed**, caught by assertion.
4. **`Severe Storm` appears three times in the base plan and the three boxes are byte-identical**
   — one shared profile repeated inside the Hail, Lightning and Wind sections. So all three
   legitimately receive it and the assignment is order-independent; only knowable by diffing.
5. **`Natural Cultural Resources`** is a spelling variant in 24 rows (the source drops the
   "and"); without an alias those rows lose their natural-environment flag.
6. **Woodsburgh's 2 completed actions use the PROPOSED-action shape**, not the prior-action
   shape, so the prior-action code path silently dropped both — it keys on a field they do not
   have. Caught only because the total came out 569 instead of 571.
7. **`Villages of Woodsburgh`** — plural, and the roster→geoid normaliser only handled the
   singular, so one organisation matched nothing.
8. **The roster and the alias table use opposite naming conventions** — "Village of Atlantic
   Beach" vs "Atlantic Beach (Village)". A direct string join matched **0 of 82**.
9. **The attendance matrix's 7 column names match none of the 11 narrative meeting names**
   ("Core Planning Group Kickoff" vs "…Kick-Off Meeting", "Jurisdiction" vs "Jurisdictional
   Consultation Calls"). Explicit map, no fuzzy matching.

### ⚠ Finding: Freeport's section-4 extraction was reading the table of contents

The 20 section-4 capabilities came through as **bare headings with empty descriptions**.
`extract_independent_plan.py` located each heading with a plain `find()`, and in a 177-page PDF
the first occurrence of every heading is its **TOC line**
(`4.1 EMERGENCY WARNING SYSTEM` — TOC at char 13,624, body at 256,947). Same class as the four
silent Phase-6 parser bugs: the extractor succeeded and the output was simply empty.

Fixed in `fix_freeport_section4.py`; all 20 recovered, 159–2,394 chars each.

**This settles the open §4 triage question, and settles it opposite to the titles.** Section 4's
preamble calls the entries *"a summary of accomplishments"*, and every body describes something
the Village **did** — street grades elevated, check valves fitted, 4,500 linear feet of
utilities buried for $1,188,000, wind film on the EOC. Titles like `FLOODING ON ROADS` and
`REDUCE WIND DAMAGES` read as problem statements, so triaging from titles — all that was
possible while the bug stood — would have misfiled at least four of twenty. **All 20 are
capabilities**, and no `lhmp_problem_areas` content comes from section 4.

A second bug surfaced during the fix: section 4 ends at `5 MITIGATION STRATEGY`, a bare chapter
number with **no decimal**, so a `5\.\d+` boundary missed it and 4.20 swallowed ~9,000 chars of
the next chapter. Caught only because 4.20 came out five times longer than any sibling —
**length is the tell for a missed section boundary.**

### Two mapping tables, written down rather than buried in heuristics

- **[`capability-types.csv`](../../skills/capability-types.csv)** — 50 rows. The crosswalk marks
  `primary_capability_type` *derived* with no algorithm, and the 16-value vocabulary has **no
  "staff capacity" and no "funding" type**, so every Administrative and Fiscal capability is
  placed by judgement. 24 are marked `medium`/`low` and are the natural first owner review.
- **[`roles-title-map-report.csv`](../../skills/roles-title-map-report.csv)** — 114 free-text
  titles onto a 52-value vocabulary via ordered keyword rules, reviewed on its OUTPUT rather
  than on its regexes. Role assigned for **268 of 313** people; the 17 unmapped titles are pure
  seniority words (`Director`, `Commissioner`, `Managing Associate`) that genuinely do not say
  what the person does, so those rows load with `role` empty for review rather than guessed.

### Known gaps carried into 7b

- **Freeport's Jurisdictions prose — 1 of 7 columns, and CLOSED as a decision (owner,
  2026-08-24).** The gap is simply a village that did not use the same format. If content cannot
  be shoehorned into the right field *without altering their language*, the field **stays blank
  and the community fills it in later**. No section-mapped extractor is being written, and this
  is not carried as debt.
- `lhmp_problem_areas` fills only **19 of 52** — most jurisdictions genuinely report minimal
  flooding, but worth a spot-check.
- **Participation `duration`, `invite_method`, `agenda_minutes` are empty on all 245.** Not
  stated anywhere in the base plan; Appendix A (49 MB, PDF-only, still unexamined) is the likely
  source. `format` by contrast is **100% derived** (58 In-Person, 140 Virtual, 47 Phone Call) —
  an improvement on Suffolk, which left it null on 185 of 216.
- **35 of 571 actions (6%) fall through action-type detection** to `Prevention/Mitigation
  Projects`, down from 66 after a keyword pass driven by reading the fallthroughs.
- **21 action hazard strings unmapped**, now only junk or non-hazards (`"1"`, `"0"`,
  `Meadowmere Park`, `Continuity of Governmental Operations`, `Terrorism`).

### 7b-match — reconcile against rows that already exist — DONE (2026-08-24)

Owner-specified: before anything loads, each to-be-loaded row is compared against rows the
system **already holds** for the same county/jurisdiction. A row representing an action already
catalogued carries the existing row's id and becomes an **UPDATE**, not a duplicate INSERT.

| Dataset | Mode | Payload | Existing | → UPDATE | → INSERT |
|---|---|---|---|---|---|
| Actions | jaccard | 571 | 172 in scope (189 across all 70) | **131** | 440 |
| Capabilities | jaccard | 896 | 0 *(verified)* | 0 | 896 |
| Roles | key | 262 | 0 *(verified)* | 0 | 262 |
| Participation | key | 245 | 0 *(verified)* | 0 | 245 |

**Roles and Participation checked 2026-08-24 and confirmed empty** — the expected answer, but
confirmed rather than assumed, and confirmed the strong way: neither has a filterable geoid
column, so both were taken as a **full statewide fetch** (516 and 324 rows) and scoped
client-side by geoid. A full fetch that finds 0 Nassau geoids among 516 rows cannot be a silent
filter failure, which a filtered zero always could be.

**This step justified itself immediately.** Nassau already holds **189 Actions rows across 38 of
its 70 jurisdictions**. Without it the load would have built a parallel duplicate set for more
than half the county — Long Beach alone would have gained 14 duplicates.

### ⚠ The finding that nearly hid it: the `--filter` trap is driven by the DECLARED type

`--filter county=Nassau` on Actions returns **0 rows**, and for a few minutes that read as
"Nassau has no existing actions". It does not. The filter is compiled from the column's
*declared* type, and **any filter on a column declared `multiselect` returns 0 regardless of
what is stored**. Measured against view 1074456:

| Filter | Result | Declared type | |
|---|---|---|---|
| `geoid_juris=36025` | 80 | `select` | works |
| `action_name=…` | 1 | `text` | works |
| `county=Delaware` | **0** | `multiselect` | **broken — such rows demonstrably exist** |
| `county_geoid=36025` | **0** | `multiselect` | **broken** |

Actions stores `county` as a **bare string** and it still cannot be filtered. So Suffolk's rule —
"the filter fails on array-valued columns" — is not quite right: *"is the stored value an
array?"* is the wrong question. **Check the declared type.** Capabilities declares `county` as
`text`, and there `county=Suffolk` returns 1,943 quite happily.

Practical consequence: fetch per jurisdiction on `geoid_juris`. 70 cheap queries instead of an
18,908-row dump, and no silent zero.

### ⚠ The finding that made the matcher safe rather than nearly safe

Jaccard on token sets rates these pairs **above** the name-only match threshold:

| Score | Payload | Existing |
|---|---|---|
| 0.925 | Well **1** generator | Well **4** Generator |
| 0.886 | Generator Installation – **East** End Fire House | … **West** End Fire House |
| 0.867 | Generator Replacement – **Headquarters** Fire House | … **Southside** Fire House |

These are **different facilities**, and the Village of Hempstead alone has eight
near-identically-named fire-house generator projects. Two compounding bugs made it worse: the
tokeniser dropped tokens of ≤2 characters, so `1` and `4` vanished entirely and *"Well 1
generator"* and *"Well 4 Generator"* became the **same token set**.

The greedy one-to-one assignment did reject them — but only because the correct pair happened to
claim the slot first. **That is ordering luck, not correctness.**

Fixed with a **discriminator guard**: whatever tells two names apart must match. If the symmetric
difference of the two name token sets contains a number or a compass direction, the pair is
refused outright regardless of score. **148 pairs refused on this rule**, and — the check that
matters — **0 refusals where the two names are identical**, so it never rejects a real match.

### Method, and why the thresholds are visible rather than buried

Compared only within the same (county, jurisdiction); a geoid never matches across
jurisdictions. Weighted Jaccard on the three fields the owner named:

    action_name                                    0.40
    description_of_the_problem_problem_statement   0.30
    description_of_the_solution_action_description 0.30

Match at weighted **≥ 0.50**, or on name alone at **≥ 0.85**. Assignment is greedy and strictly
one-to-one — verified: **131 distinct existing ids, none claimed twice**, because two payload
rows carrying the same `_existing_id` would update one record twice and silently lose one.

Everything from **0.30** upward is written to `match-report-actions.csv` including pairs below
the match threshold, since a Jaccard cut-off is a judgement call and the near-misses are exactly
what a reviewer needs to see. Nothing below the threshold is applied.

Quality check at both extremes: the highest-scoring matches are byte-identical names; the
*lowest*-scoring applied matches also have **identical names** and scored low only because the
existing descriptions are shorter — caught by the name-only rule, which is what it is for.

Payload rows now carry `_op` (`insert`/`update`), `_existing_id` and `_match_score`. The `data`
is untouched.

### ⚠ Correction: scope by GEOID, never by the `county` name column

The first version of this step filtered Roles, Participation and HOC on **`county=Nassau`**. It
worked, and it was still wrong on two counts (owner, 2026-08-24):

- **`county` is expected to be deprecated.** Hanging the scoping query on a column that may
  vanish means the reconciliation silently starts returning 0 — and 0 here reads as *"this county
  has nothing loaded"*, which is exactly the wrong answer that causes a duplicate load. A
  scoping query that fails by returning 0 instead of erroring has to be built on something
  durable.
- **It contradicted this project's own rule.** Layer 1 already says *"join on `geoid_juris`,
  never on jurisdiction name"*, because names drift. I reached for the name column anyway,
  because for two datasets it was the only filter that worked.

Rewritten to choose from the **geoid columns only**:

| Dataset | `geoid_juris` | `geoid_county` | Strategy |
|---|---|---|---|
| Actions | `select` | `multiselect` | per-jurisdiction |
| Capabilities | `select` | `select` | per-jurisdiction |
| Hazards of Concern | `multiselect` | **`select`** | by county geoid |
| Roles | `multiselect` | `multiselect` | **full fetch** (516 statewide) |
| Participation | `multiselect` | `multiselect` | **full fetch** (324 statewide) |

**Roles and Participation have no filterable geoid column at all** — which is precisely what made
the name filter tempting. The honest answer is the full fetch; both are trivially small. The
script now sizes the dataset first and **refuses loudly above 20,000 rows** rather than falling
back to the name column, so the next county cannot quietly inherit the shortcut.

**Every figure reproduced after the rewrite:** HOC 1,190 across 70/70 (still matching the
independently-cached seeded grid), Actions 189 across 38/70, Capabilities/Roles/Participation 0 —
and the four match runs still give 131 / 0 / 0 / 0 updates. The change was to the *reasoning*,
not the result, which is the only way to be sure it was a safe refactor.

### Match mode is chosen from the field, not by habit

Running Jaccard on all four would have been wrong. It suits **Actions and Capabilities**, whose
identity lives in free text that gets reworded between cycles. It is actively bad for **Roles and
Participation**: *"Ann Smith"* against *"Ann Jones"* scores 0.33 on a two-token set, and any
threshold low enough to catch a real spelling variant would also merge two different people.
Those use an **exact normalised key** instead — Roles on `(name, role)`, which is the row entity
the owner defined, and Participation on `(meeting_name, date)`.

### The untested-path problem, and the self-test that closes it

Nassau has 0 existing Roles and Participation rows, so those runs exercised the key path against
nothing and **proved nothing about it** — it would have gone into the next county unverified.

`--selftest` feeds each payload back in as its own "existing" set: every row must match itself,
exactly once. It also surfaces empty keys and within-jurisdiction key collisions, both of which
silently guarantee a duplicate insert later. All four datasets pass — 262, 245, 571 and 896 rows
self-matchable, no empty keys, no collisions.

### Generalised for the next county

`fetch_live.mjs` replaces the actions-only fetcher and carries the per-dataset filter strategy as
a table with the reason for each choice, plus a `--verify` flag so a zero cannot be believed
without a control county. Re-fetching Actions through it reproduced the original 189 rows across
38 jurisdictions **byte-identically**, which is the check that the generalisation did not change
behaviour.

Cross-check worth keeping: fetching **Hazards of Concern** by county returned exactly **1,190
rows across 70/70 jurisdictions**, matching the independently-cached seeded grid. That validates
the whole by-county strategy against a known-correct number rather than just asserting it works.

All of this is now a standing requirement in Layer 1 — see
[`transcribing-a-consultant-plan.md`](../../skills/transcribing-a-consultant-plan.md)
**Phase 5a**, with eight new checklist items.

### 7b — Review surfaces — DONE (2026-08-24)

Built by `build_review.py` into `references/.../review/`. Three artifact kinds, because a
reviewer has three different questions:

| Artifact | Answers |
|---|---|
| `<dataset>.csv` | **what** gets written — one line per row with `op` and `existing_id` |
| `actions-changes.csv` | **what gets replaced** — one line per overwritten value, both sides shown |
| `_index.md` | totals, the policy, and what is worth knowing |

**1,849 inserts and 1,067 updates.** Actions is the only dataset that overwrites anything:
**982 values across its 131 matched rows.** HOC's 884 updates land on seeded rows that are
entirely blank, so nothing there is destroyed.

### Policy — uploaded fields overwrite existing fields (owner, 2026-08-24)

**No per-column exceptions.** The transcribed plan is the authority on every field it carries,
and **a shorter value is not evidence of a mistake** — removing detail is often a deliberate
editorial choice by the plan's authors, which this pipeline is not entitled to second-guess.

I had recommended three exceptions — leave `action_name` alone on matched rows, make
`cost_benefit_notes` append, skip the 34 case-only diffs — and the owner declined all three.
Recorded because the reasoning generalises: **classify diffs to help someone sample them, not to
gate them.** Now a standing rule in Layer 1.

No builder changes were needed; they already wrote straight overwrites. What changed was the
review index, which had been presenting my recommendation as if it were a decision.

### What the classification did buy

Triaging the 982 turned an unreviewable wall into a map: ~50% add detail or normalise a value
into a controlled vocabulary, 30 are the same digits reformatted, 34 are case-only, and **78 are
shorter than what they replace — of which only 5 are prose.** Useful for sampling. Two findings
worth keeping regardless of policy:

- **No curation fields are touched.** `county_priority`, `mitigation_action_readiness`,
  `application_readiness`, `project_maturity`, `dhses_comments`, `fema_comments` and the
  grant-submission flag are empty on all 131 matched rows, so no workflow state is lost. Confirmed
  rather than assumed — a county mid-review would have them populated, and those are not plan
  content.
- **The classifier had to be schema-aware to be honest.** A naive length test called 98 changes
  losses; 120 of those were free text being replaced by a *valid option of a select column*
  ("Within the next 5-10 years" → "More than 4 years") and 30 were `$1,000,000` → `1000000`.
  Neither loses anything. Without consulting the live schema the surface would have overstated
  the damage by a factor of four.



- [ ] **CSV per flat dataset** — Roles, Capabilities, Hazards of Concern, Participation, Actions.
  A review surface only; **nothing ingests a spreadsheet**, the load is scripted per row.
  **Must show `_op` and `_existing_id` per row** — whether a row inserts or updates, and which
  existing record it will overwrite, is the single most consequential thing a reviewer can check.
- [ ] **Per-jurisdiction markdown** for the 7 Jurisdictions lexical columns — the owner-review surface
  for the prose, diffable and correctable before anything touches the database.
- [ ] **Owner review gate.** Correct the markdown/CSVs, not the extract, then re-compile.

### 7c — Lexical compile — DONE (2026-08-24)

`compile_lexical.mjs` + `build_juris_payloads.py`. **70 row updates carrying 341 lexical column
values, 0 errors.** Reuses `scripts/suffolk/lexical.mjs`, the root builder proven on the
Schenectady and Delaware loads; only the markdown front end is new.

**Round-trip verified.** Every compiled root is flattened back to text and compared against its
source markdown with the markers stripped; a mismatch fails the run. That is what makes this a
compilation rather than a re-authoring — the prose in the database has to be the prose that was
reviewed.

**Scope is narrower than the plan assumed.** The plan warned that HOC's `general_vulnerability` /
`other_comments` / `reason_for_exclusion` and Participation's `narrative` / `agenda_minutes` are
"lexical too". They are *declared* lexical and *stored* as plain strings — measured over 20,000
live rows during the Suffolk load, re-confirmed on Nassau's 1,190 seeded HOC rows. Compiling them
would have produced a value the UI does not expect. Only the seven Jurisdictions columns are
genuinely lexical.

Markdown support is deliberately limited to what the generator emits — surveyed across all
records as 156 whole-line bolds (the capability-table labels, which become `h4`) and 70 inline
bolds, with zero lists. Anything else passes through as literal text rather than being silently
reinterpreted.

### ⚠ Finding: the 18 withdrawn villages were missing the one field that identifies them

`build_jurisdictions.py` iterated the **annex files**, so it covered 52 jurisdictions. But
`lhmp_planning_process` comes from the base plan's adoption-status table, not from an annex, and
the crosswalk is explicit about why it matters:

> *"It is the ONLY field distinguishing a jurisdiction that adopted the plan from one that
> engaged and withdrew — without it, 18 villages look like plan participants."*

Iterating annexes silently skipped **exactly the 18 jurisdictions the field exists to
distinguish.** Fixed: the builder now iterates all 70 from the alias table, and a withdrawn
village gets `lhmp_planning_process` and nothing else, because nothing else has a source.
`lhmp_planning_process` is now **70/70**; the other six stay at 51/51/48/19/51/51 from the annexes.

**Transferable shape of this bug:** the loop was over the wrong collection. Iterating the
*source documents* rather than the *target jurisdictions* is invisible when they coincide and
silently lossy when they do not — and here the divergence was the entire point of the field.

### Row-id resolution, and why every geoid must resolve to exactly one row

Nassau has **138** Jurisdictions rows for 70 municipalities. The other 68 break down as **67
CDPs** — not governments, nothing to transcribe into, excluded per the standing rule — and **one
duplicate `Glen Cove`** carrying `census_type = cousub` at geoid `3605929113`, the collision
already resolved in favour of `3629113`. Every one of the 70 resolved to exactly one row, and the
builder fails rather than guessing if any resolves to 0 or 2, since that would mean the
duplicate-geoid resolution has drifted.

Only columns with content are sent. An empty lexical root is not the same as an absent column —
it would replace whatever a jurisdiction had authored with a visually-blank document.



- [ ] markdown → lexical root JSON, one file per row. Reuse `scripts/delaware/lexical.mjs` —
  this is the path proven twice (Schenectady, Delaware), not new code.
- [ ] Remember the lexical columns are wider than the Jurisdictions set: HOC's
  `general_vulnerability` / `other_comments` / `reason_for_exclusion` and Participation's
  `narrative` / `agenda_minutes` are lexical too.

### 7d — Prove the write path on ONE throwaway row

Before generating the full set. All four steps, in order:

- [ ] `dms raw create <app> "<sourceInstance>|<viewId>:data"` → capture the new id
- [ ] `dms dataset update <source-id> <newId> --data <file.json>` → fill it
- [ ] read it back **through the filter the loader will use**
- [ ] `dms raw delete` it

### 7e — Load, in dependency order

Estimated volumes; 7a's dry run supersedes them.

| # | Dataset | Operation | Rows |
|---|---|---|---|
| 1 | **Jurisdictions** | UPDATE | 52 rows × 7 lexical columns |
| 2 | **Capabilities_Catalogue** | INSERT | ~914 |
| 3 | **Roles** | INSERT | ~260 (people × roles) |
| 4 | **Participation** | INSERT | 254 |
| 5 | **Actions** | INSERT | ~571 (287 proposed + 282 prior + 2 completed) |
| 6 | **Hazards of Concern** | **UPDATE** 884 + **INSERT** 6 | 890 |

Capabilities before HOC because `associated_capabilities` joins to it; Roles before Participation
because `roles` joins to it. HOC last — it is the only update-in-place set and the easiest to re-run.

**Three write-safety practices, all from the Suffolk load and all non-optional:**

- [ ] **Record every created id to a file BEFORE filling it.** A failure between create and fill
  leaves an orphan empty row with no record of it.
- [ ] **Build a double-insert guard that does NOT use `--filter` on an array-valued column** —
  it reports zero existing rows *always*, which is exactly when the guard matters.
- [ ] **Back up first, and note the blast radius.** Roles holds **144 rows statewide**; the
  Capabilities figure of 269 quoted earlier was **stale — it is 5,021** (measured 2026-08-24),
  so this load adds ~18% rather than quadrupling it. Actions holds **18,908**. `dms raw delete`
  makes any of it reversible only if the ids were recorded.

### 7f — Verify

- [ ] Re-read each dataset and reconcile counts against the 7a dry run.
- [ ] **Spot-check one jurisdiction end-to-end by hand against its annex** — Glen Cove, since it is
  the reference. The Suffolk load found 11 crosswalk errors this way.
- [ ] Confirm HOC shows 0 rows still `Not Reported` for the 52 in-scope jurisdictions, and that the
  18 withdrawn villages are untouched.
- [ ] Re-run `qa_assertions.py` and confirm still 0 open.

### Judgement calls still open — none block 7a

- **Village of Hempstead's roll-up**: confirm that keeping the 8 annex actions (rather than letting
  one worksheet overwrite them) is what you want. The cost arithmetic says roll-up; the instruction
  said worksheet-precedence.
- **MAW alternative 2**: "just use the first alternative" vs the later shoehorn rule. Currently
  alternative 1 → its own field, alternative 2 → appended to `Cost Benefit Notes`.
- **Prior-action names** (284 rows): derived by truncating the source sentence; the full sentence is
  kept in `Description of the Solution`.
- **`Action Creation Date`** = `2020-12-16` (the plan date) as a constant.
- **Freeport §4 triage** — which of its 20 prose capability sections are capabilities and which are
  problem statements for `lhmp_problem_areas`.
- **Freeport's 3 local goals** → the 6 SHMP goal booleans.
- **Freeport contacts** — 21 committee members, `slot=committee`, HM-representative flag blank.
- **Appendix A** (49 MB, PDF-only, unexamined) is the likely source for `Invitation Method`, `Hours`
  and meeting documentation, which currently have none.

### Resolved during Phase 7 scoping (kept for the record)

- [x] ~~**Unresolved (carried over from Suffolk):** the flat-dataset import path…~~ **NOT AN OPEN
  ITEM — my error.** Closed by the Suffolk load on 2026-08-17: `dms raw create` + `dms dataset update`,
  **no workbook needed**. I copied the wording from the Suffolk *crosswalk* report (2026-08-14) without
  checking the *load* report that superseded it, and repeated it in several status summaries. The
  skills README even warns that the load report is authoritative where the two disagree. Corrected
  2026-08-21.

  **Knock-on:** "workbook tabs" were never a real deliverable — nothing ingests an `.xlsx`, and the
  workbook is now illustrative only. Phase 7's flat-dataset review surface is **CSV per dataset**.

  What actually remains for Phase 7 is narrower: prove the write path with one throwaway row
  (create → fill → read back → delete); record created ids to a file **before** filling them; and
  build a double-insert guard that does not use `--filter` over an array-valued column.

- [x] **RESOLVED 2026-08-21 — capability tables load into `Capabilities_Catalogue` (`1068273`).**
  `Capacities` (`1689772`) and `Capacities V2` (`2142341`) are **on hold / deprecated until further
  notice**, despite Capacities being a near-exact vocabulary match for Hagerty Tables 3–6.


## Files created / changed this session

| File | Status |
|---|---|
| `planning/mitigateny/skills/profiles/hagerty.md` | **new** — Layer-2 consultant profile |
| `planning/mitigateny/skills/worked-examples/nassau-annex-crosswalk-report.md` | **new** — crosswalk + pre-flight report |
| `planning/mitigateny/skills/scripts/nassau/preflight.py` | **new** — corpus scanner |
| `planning/mitigateny/skills/action-type-tiers.csv` | **new** — the 17 live P/S/T options with tier + within-tier rank, the two Tier-1 substitutions, and which types have a matching boolean |
| `planning/mitigateny/skills/transcribing-a-consultant-plan.md` | edited — third source shape, negative workbook case, taxonomy over/under-run, **new Phase-0 question 4** (required fields with no source); **Phase 3 now carries the Suffolk-vs-Nassau `hazard_of_concern` rule split and the standing Action-Type inference rule** |
| `planning/mitigateny/skills/profiles/tetratech.md` | edited — retracted the incorrect Nassau attribution |
| `planning/mitigateny/skills/README.md` | edited — Hagerty profile, Nassau worked example, `scripts/nassau/` |
| `references/mny-transcribe/CLAUDE.md` | edited — Nassau row in the county table, folder layout *(git-ignored)* |
| `references/mny-transcribe/Nassau/context/**` | **new** — crosswalk CSV, scripts, extracted output *(git-ignored)* |

## Testing / verification

- [x] Crosswalk CSV parses as 167 well-formed 10-column rows (no ragged rows, no nulls); zero
  `gap-no-target` remaining.
- [x] `omissions-register.csv` regenerated from the crosswalk after every revision — it is derived, so
  it cannot disagree with the crosswalk.
- [x] `preflight.py` runs from its committed location (`skills/scripts/nassau/`) and resolves
  `docx_outline2.py` from `skills/scripts/suffolk/`.
- [x] Corpus claims in the profile are measured from `preflight.json`, not estimated.
- [x] **`Actions` source `1029065` read live (anonymously) twice** — before and after the owner's
  `*_action_type` fix. Confirmed: 16 boolean `action_type_*` columns, three selects now identical at
  17 options, `Large Flood Control` present in primary, `Risk/Vulberability Assessment` typo gone,
  `Coastal Protection` / `Dam Rehabilitation/Removal` still absent from all three.
- [x] Every entry in `action-type-tiers.csv` matches a live select option verbatim.
- [x] **Roles source `1473295` read live** — found `address_optional`, and three type divergences from
  the workbook worth carrying into Phase 5: `role` is a **single** `select` live (workbook says
  Multi-Select), `comments` is **`lexical`** (workbook says Text), and `hm_representative` /
  `required_stakeholder` are `radio`.
- [x] **Alias table asserted collision-free** — 52 geoids for 52 folders, checked in code, not by eye.
- [x] **All three PDFs probed for extractable text** (Freeport 177pp/356,988 chars; Garden City's
  `VGC_4` 1pp/2,544; Glen Cove's annex PDF 13pp/26,499). All text-bearing — no OCR needed. `pypdf`
  added to the venv.
- [x] **Worksheet count reconciled two ways** — 141 strict `^MAW\d+` vs 142 loose `maw` substring, the
  difference being `MAW_3 NEW Williston Park.docx`; plus 1 worksheet PDF = **143**.
- [x] Live-schema verification of all five forms sources — **done in Phase 5b**, see that section
  for the census and the divergences.
- [ ] Nothing has been written to `mitigat-ny-prod`. No database changes in this session.

### Resolved: the staged-CSV swap

The crosswalk CSV was locked (open in Excel) mid-session, so one revision was written to a
`.staged.csv`. **Promoted 2026-08-21** — `nassau-annex-crosswalk.csv` is current at 167 rows and no
staged file remains.
