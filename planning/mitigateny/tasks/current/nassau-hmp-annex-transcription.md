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
| Crosswalk CSV (175 mappings) | `references/mny-transcribe/Nassau/context/nassau-annex-crosswalk.csv` *(git-ignored)* |
| Working folder | `references/mny-transcribe/Nassau/context/` — see its `README.md` |
| Omissions register | `references/mny-transcribe/Nassau/context/omissions-register.csv` — **generated** from the crosswalk, 5 entries |
| File manifest | `references/mny-transcribe/Nassau/context/file-manifest.csv` — 52 folders → authoritative annex + worksheet files + reason |
| Jurisdiction aliases | `references/mny-transcribe/Nassau/context/nassau-jurisdiction-aliases.csv` — **70 jurisdictions** → 70 geoids, no collisions |
| Action Type tiers | [`../../skills/action-type-tiers.csv`](../../skills/action-type-tiers.csv) |
| Pre-flight scanner | [`../../skills/scripts/nassau/preflight.py`](../../skills/scripts/nassau/preflight.py) |
| Target schema | `planning/mitigateny/files/MNY Workbook - 08142026.xlsb` |
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
- [x] **Freeport: use the PDF** — but see the finding below; it is not an annex.

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

### Crosswalk after the decisions

175 rows (was 163). **`gap-no-target` is zero**, and only **five** items have no home at all.

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

## Phase 5 — Identity and manifest — MOSTLY DONE (2026-08-21)

- [x] **Glen Cove's two geoids resolved** — takes **`3629113`** (the `Place` row); the `3605929113`
  cousub row is not used.
- [x] **Rockville Cent*re*** confirmed as the correct spelling against the folder's *Center*.
- [x] **`nassau-jurisdiction-aliases.csv` built** — 52 folders → **52 distinct geoids, zero
  collisions** (1 county, 2 cities, 3 towns, 46 villages). Carries `annex_file`, `pipeline`
  (`hagerty-annex` × 51 / `freeport-standalone` × 1), `n_maw` and a decision note per overridden row.
- [x] **`file-manifest.csv` built** — all 52 folders reviewed file by file. 47 unambiguous, 5 decided
  by content (every mtime is identical, so filenames and dates carry no authority). Corrected the
  worksheet total from 139 to **143**.
- [ ] Add `in_jurisdictions` / `in_hoc` flags to the alias table by reading the live sources — the
  pre-load checklist, per the Suffolk precedent. **Not done.** Now needs checking for all **70**
  jurisdictions, not 52.
- [x] **Reconciled the 70 attendance-matrix jurisdictions against the 52 annexes** — the 52 `Adopting`
  rows map **1:1** onto the annex folders; the 18 without an annex are all incorporated Villages marked
  `Withdrawn`, **zero CDPs**, 14 with documented attendance, 34 named people in the roster. Owner rule
  2026-08-21: **Roles + Participation for all 70, everything else for the 52.** The alias table is
  rebuilt at **70 rows** with `has_annex` / `adoption_status` / `meetings_attended` / `in_scope_for`.
  Script: `reconcile_matrix.py`.
- [ ] Verify the live Participation / Hazards_of_Concern / Capabilities schemas (Actions and Roles are
  done — see Testing). **Not done.**

## Phase 6 — Batch extraction — NOT STARTED

- [ ] Extract the 51 Hagerty annexes + 143 worksheets to structured JSON per `file-manifest.csv`,
  with the nine variances encoded first. **Freeport is a separate track.**
- [ ] Extract base-plan tables 0, 1 and 7 for Roles and Participation.
- [ ] Run the QA assertions (report §8 / profile) and produce a punch-list:
  Table 3's NFIP answer vs the NFIP Summary citation; no `No` answer carrying Details; contiguous
  `Project Number` sets; annex↔MAW cost and name agreement.

## Phase 7 — Generate, review, load — NOT STARTED

- [ ] Workbook tabs for Roles, Capabilities, Hazards of Concern, Participation.
- [ ] Actions tab — 234 proposed + 284 prior + MAW enrichment.
- [ ] Per-jurisdiction markdown for the 6 Jurisdictions lexical columns (owner-review surface).
- [ ] Compile markdown → lexical JSON payloads; load via `dms dataset update`.
- [ ] **Unresolved (carried over from Suffolk):** the flat-dataset import path DHSES uses for
  workbook tabs is still not established, and it may constrain the tab format. Settle it before
  generating tabs.

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
- [ ] Live-schema verification of the remaining three forms sources (Participation `1473468`,
  Hazards_of_Concern `1473470`, Capabilities) — **not done**, deferred to Phase 5.
- [ ] Nothing has been written to `mitigat-ny-prod`. No database changes in this session.

### Resolved: the staged-CSV swap

The crosswalk CSV was locked (open in Excel) mid-session, so one revision was written to a
`.staged.csv`. **Promoted 2026-08-21** — `nassau-annex-crosswalk.csv` is current at 167 rows and no
staged file remains.
