# Westchester 2026 jurisdictional annexes → Jurisdictions dataset crosswalk

**Project:** MitigateNY · **Topic:** content · **Status:** **LOADED 2026-09-04** — 45/45 rows, 675 column writes, read-back verified. Owner decisions D-A1…D-A8 applied. One item (D-A7) blocked on D8 auth. · **Started:** 2026-09-04

## Objective

Crosswalk the **45 IEM `Westchester_Jurisdictional_Annex_*.docx` files** onto lexical columns of the
statewide **Jurisdictions dataset** (internal source **1346449** / view **1346450**), so the
per-jurisdiction prose can be written with `dms dataset update` in a following pass — the
dataset-column fill path in
[`loading-annexes-into-jurisdictions-dataset.md`](../../skills/loading-annexes-into-jurisdictions-dataset.md),
as used for Schenectady, Delaware and Suffolk.

This is the **third annex source-model** we have seen, and the easiest by a wide margin.

## Scope

**In scope:** annex prose → Jurisdictions lexical columns, `draft` only.

**Out of scope:** the county base plan (see
[`westchester-2026-baseplan-crosswalk.md`](./westchester-2026-baseplan-crosswalk.md)); workbook data
→ internally-sourced tables (a colleague's parallel pass); Capabilities / Actions / Roles /
Participation / Hazards-of-Concern datasets (the annexes carry none of that as prose — the platform
renders it); publishing.

## Target

| | |
|---|---|
| App / type | `mitigat-ny-prod` / `prod` |
| Host | `https://dmsserver.availabs.org` |
| Jurisdictions source / view | **1346449** / **1346450** (`test_meta_forms_env\|jurisdictions:source`) |
| County geoid | **36119** — 81 rows, of which **27 are `census_type=CDP` artifacts to skip** |
| Annex page | **2448345** — `the_plan/jurisdictional_annexes/jurisdictional_annex_form`, 91 components |
| Pattern | 2448336 (`Westchester-2026`) |
| Source docs | `references/mny-transcribe/westchester/Final Plan/Draft Annexes/` (45 `.docx`) |

Working folder (git-ignored): `references/mny-transcribe/westchester/annex-work/`

| File | What |
|---|---|
| `out/crosswalk.csv` / `.json` | the 671-row crosswalk — one row per (jurisdiction, column) |
| `out/annex_sections.json` | every annex's section tree + verbatim text |
| `out/annex_page_components.json` | all 91 annex-page components with their column bindings |
| `out/juris_columns.json` | the source's 42 attributes (30 lexical) |
| `out/juris_rows_36119.json` | the 81 Westchester rows |
| `out/discrepancies.json` | everything in the review list below |
| `out/per_jurisdiction.md`, `out/per_column.md` | the tables reproduced below |
| `scripts/` | `discover.mjs`, `build_crosswalk.py`, `gen_report.py`, `fq.js` |

## Results at a glance

| | Count |
|---|--:|
| Annex files | 45 (44 municipal + the county) |
| Crosswalk rows | **674** |
| Jurisdictions resolved to a dataset row | **45** of 45 (6 by the D-A1 rule) |
| Columns receiving content | **15** of the annex page's 27 lexical boxes |
| Characters mapped | **588,381** |
| Boilerplate deliberately skipped | 85,457 ch |
| Local prose with no fill target | **48,049 ch** (see D-A5, D-A6) |
| Rows carrying prose the load would overwrite | 7 columns on 1 row (Bedford) |

### Load result (2026-09-04)

| | |
|---|--:|
| Rows written | **45 / 45** |
| Column writes | **675** — all 15 columns on every row |
| Characters live | 642,739 (675 writes + Bedford's 4 surviving prior-cycle columns) |
| Read-back verified | **45 / 45**, every column length matched |
| CDP rows touched | 0 (all 27 skipped) |
| Non-target rows | 9, all confirmed still empty |

Writes turned out **not to need a token** — `dms dataset update` on this source succeeds
anonymously, unlike pattern/page writes. Pre-edit snapshot of all 81 rows in
`out/backups/juris_rows_PRE.json`; post-load in `out/juris_rows_POST.json`; per-row outcome in
`out/write_results.json`.

Reproduce with `python build_crosswalk.py && python build_payloads.py && node write_annexes.mjs`
(add `--dry-run`, or a row id, to scope it).

## Why this one is easy: the annexes are authored against the page

The IEM annex `.docx` is a **verbatim walk of the v3 annex page's component order** — every heading
is a Card title, in page order, with the jurisdiction's prose underneath:

| Annex heading | Annex page component | Column |
|---|---|---|
| Executive Summary | ord 5 Card | `description` |
| Planning Process | ord 9 Card | `lhmp_planning_process` |
| Buildings → Local Context | ord 16 Card | `lhmp_buildings_local_context` |
| Critical Buildings | ord 18 Card | `lhmp_critical_buildings` |
| Historic Properties/District (if applicable) | ord 22 Card | `historic_prop_dist` |
| Critical Infrastructure | ord 25 Card | `lhmp_criticial_infrastructure` |
| Risk | ord 31 Card | `lhmp_risk_overview` |
| … | … | … |

So the mapping is **positional alignment, not judgment**: walk the doc's paragraph stream and the
page's ordered section titles together. All 671 mappings are High confidence. Contrast Schenectady
(chapter blue boxes → 8 columns) and Delaware (per-hazard boxes → 1 aggregated column) — the §3
mapping table in the skill has **zero applicable rows here**; a new one is below.

**Two parsing traps, both handled in `build_crosswalk.py`:**

1. **No heading styles.** Every paragraph in every annex is style `Normal` — python-docx gives you
   nothing to key on. Section detection is by title match in page order.
2. **Heading spellings drift from the page's Card titles.** The page slot is misspelled `Historic
   Occurances`; 11 annexes spell it `Historic Occurrences`, Port Chester `Historic Occurences` and
   Tarrytown `Historic OccurEnces`. Pound Ridge writes `BUILDINGS BY LAND USE` for
   `BUILDINGS BY LANDUSE`, and Westchester County `Historic Properties/Districts` for
   `Historic Properties/District`. Every such paragraph silently lands in the *preceding* section —
   this cost 16 mis-attributions before the aliases went in. The whole corpus was then swept with a
   normalized fuzzy match against the page titles; those **four** variants are the only ones that
   exist.

## Source → column mapping (Westchester / IEM)

| ord | Annex page Card | Column | Display name | Annexes | Chars |
|--:|---|---|---|--:|--:|
| 5 | Executive Summary | `description` | Executive Summary | 45/45 | 45,294 |
| 9 | Planning Process | `lhmp_planning_process` | Planning Process | 45/45 | 37,163 |
| 16 | Local Context | `lhmp_buildings_local_context` | Buildings Local Context | 45/45 | 34,731 |
| 18 | Critical Buildings | `lhmp_critical_buildings` | Critical Buildings | 45/45 | 38,219 |
| 22 | Historic Properties/District (if applicable) | `historic_prop_dist` | Historic Properties/District | 45/45 | 35,023 |
| 25 | Critical Infrastructure | `lhmp_criticial_infrastructure` | Critical Infrastructure | 45/45 | 49,749 |
| 31 | Risk | `lhmp_risk_overview` | Overview | 45/45 | 41,428 |
| 37 | Historic Occurances | `lhmp_historic_occurances` | Historic Occurances | 45/45 | 38,646 |
| 41 | Declared Disasters | `lhmp_declared_disasters` | Declared Disasters | 45/45 | 31,880 |
| 43 | Problem Areas | `lhmp_problem_areas` | Problem Areas | 45/45 | 50,713 |
| 56 | Evaluation of Previously Identified Actions | `lhmp_previous_actions_evaluation` | Previous Actions Evaluation | 45/45 | 25,244 |
| 59 | Action Development | `lhmp` | Strategy Development | 44/45 → 45/45 with D-A6 | 25,672 |
| 63 | Local Context | `lhmp_prioritization` | Prioritization Local Context | 45/45 | 43,181 |
| 70 | Capacity To Implement | `lhmp_capacity_to_implement` | Capacity To Implement | 45/45 | 48,798 |
| 72 | Integration | `lhmp_integration` | Integration | 45/45 | 42,640 |

**Skipped as boilerplate (85,457 ch).** Four annex sections sit under Cards fed by the shared
statewide **LHMP_IA** source (1441680), and IEM re-typed that shared text, lightly reworded per
jurisdiction — `Buildings` (ord 14, 45×), `Prioritization` (ord 60, 45×), `Actions Database`
(ord 64, 45×), `Progress` (ord 78, 45×). Per the boilerplate rule, keep the shared card and
transcribe nothing. Table/map placeholder lines ("Table from working copy", "EMBEDDED TABLE ALREADY
FILLED", "Table From MITIGATE NY", …) are dropped the same way.

---

## Discrepancies — owner decisions of 2026-09-04 and how each was applied

### D-A1 · Six annexes matched two dataset rows each — **RESOLVED: Census Place**

The statewide Jurisdictions dataset carries both a Census **Place** row and a Census **MCD**
(`cousub`) row for the same jurisdiction:

| Annex | → written to (Place) | left empty (MCD twin) |
|---|---|---|
| `CityOfRye` | **1679791** — Rye, Place/City, geoid 3664309 | 1348065 — cousub/city, 3611964309 |
| `MountVernon` | **1679799** — Place/City, 3649121 | 1347657 — cousub/city, 3611949121 |
| `NewRochelle` | **1679991** — Place/City, 3650617 | 1347713 — cousub/city, 3611950617 |
| `Peekskill` | **1680001** — Place/City, 3656979 | 1347875 — cousub/city, 3611956979 |
| `Yonkers` | **1679971** — Place/City, 3684000 | 1348530 — cousub/city, 3611984000 |
| `Harrison` | **1347244** — Place/Town, 3632402 | 1347243 — Cousub/Town, 3611932413 |

Owner rule was "Places, unless we have consistently used MCDs." **We have not** — checked against
every prior load:

| County | Rows with content | Where the ambiguous case went |
|---|---|---|
| Schenectady 36093 | 8 (5 Cousub towns, 3 Place) | **City of Schenectady → Place `1348106`**, and the dataset holds no MCD twin for it |
| Delaware 36025 | 27 (18 Cousub towns, 9 Place villages) | no cities |
| Suffolk 36103 | 38 (10 Cousub towns, 25 Place villages, + County + Authority) | no cities |

So the settled pattern is *"the row whose `census_type` matches the jurisdiction's real census
entity"* — Cousub for towns, Place for villages **and cities**. No county has ever been loaded to a
lowercase `cousub` city row. Applied as `ROW_OVERRIDE` in `build_crosswalk.py`.

Two data-quality notes for whoever owns the statewide dataset (not fixed here): those MCD rows carry
**lowercase** `census_type`/`municipality_type` (`cousub` / `city` / `town`) where every other row is
title-case, and because the annex page's jurisdiction picker is built from
`municipality_name (municipality_type)` they render as near-duplicate entries — "Yonkers (City)"
next to "Yonkers (city)".

### D-A2 · Mount Pleasant has no annex — **OPEN, to ask IEM**

| Row | Name | Type | geoid |
|---|---|---|---|
| `1347655` | Mount Pleasant | Town / Cousub | 3611949011 |

The base plan states **45 distinct municipal jurisdictions** (6 cities + 19 towns + 23 villages =
48, less the three coterminous town-villages counted once). The delivery is 44 municipal annexes +
1 county = 45 files, i.e. **44 of 45 municipalities**. Mount Pleasant is the gap.

**Question for IEM:** is Mount Pleasant a non-participating jurisdiction, or is its annex missing?
Its row is untouched and empty.

### D-A3 · Bedford's prior-cycle prose — **RESOLVED: overwritten**

Row `1346571` held 1.0-era content (*"The Town of Bedford evaluated each hazard of concern during
their community interviews…"*). All seven conflicting columns were overwritten with the IEM 2026
text.

Four prior-cycle columns had **no incoming content and therefore survive**, so Bedford now mixes
1.0 and 2026 prose:

| Column | Prior-cycle chars |
|---|--:|
| `lhmp_municipality_profile` | 1,508 |
| `growth_and_development_trends` | 239 |
| `lhmp_municipal_profile_additional` | 595 |
| `lhmp_capacity_to_implement_additional` | 847 |

Say the word and they get cleared; `out/backups/juris_rows_PRE.json` holds the pre-edit state either
way.

### D-A4 · Twelve of the annex page's 27 boxes get nothing — **RESOLVED: leave empty**

Owner call: don't worry about the empty boxes. Recorded for reference:

| ord | Card | Column |
|--:|---|---|
| 13 | Jurisdictional Profile | `lhmp_municipality_profile` |
| 27 | Growth and Development Trends | `growth_and_development_trends` |
| 49 | Cascading Impacts from Hazards | `lhmp_cascading_impacts` |
| 51 | Other Hazards | `lhmp_other_hazards` |
| 80 / 83 / 87 | Complete / In-Progress / Proposed Actions | `lhmp_completed_actions`, `lhmp_in_progress_actions`, `lhmp_proposed_actions` |
| 29 / 53 / 68 / 76 / 90 | Additional Context (Municipal / Risk / Strategy / Capacity / Progress) | `lhmp_*_additional` |

Note ord 13 and ord 27 are the two that carry weight — Jurisdictional Profile is the most prominent
box on the page, and *changes in development* is a 44 CFR element. Worth raising with IEM alongside
D-A2 if the annexes get another revision.

### D-A5 · "Disaster and Local Emergencies" local prose — **RESOLVED → `lhmp_historic_occurances`**

Page ord 38 is fed by a shared LHMP_IA card, so nothing there is writable. Its structure is
consistent across all 45 annexes:

| Paragraph | Distinct across 45 | What it is |
|---|--:|---|
| `[0]` | 12 | reworded shared text — *"…required to assess each of the hazards and declare whether it is a hazard of concern."* |
| `[1]` | 6 | reworded shared text — *"New York State has experienced a series of presidentially declared disasters…"* |
| `[2]`…`[4]` | 43 / 9 / 1 | **genuinely local** — the jurisdiction's own emergency-management arrangements and local declarations |

Paragraphs `[2]`+ (53 paragraphs, 29,394 ch) are **appended to `lhmp_historic_occurances`** under an
h3 *Local Emergency Management* lead-in; `[0]` and `[1]` are dropped as boilerplate. Chosen over
`lhmp_risk_overview` because ord 37 is the box immediately preceding ord 38, so the page still reads
in document order, and the local declarations are themselves historic occurrences.

**43 of 45 rows are merged** this way. The other two annexes have only the two boilerplate
paragraphs at ord 38, so nothing local to move.

### D-A6 · "Strategy" prose — **RESOLVED → `lhmp` (Action Development)**

Page ord 54 is a bare lexical header with no Card — the only chapter opener on the page without one.
28 annexes write a wholly unique strategy overview beneath it (18,655 ch), now **prepended to `lhmp`
/ Strategy Development** (ord 59) under an h3 *Strategy* lead-in, with the native Action Development
prose under its own heading below.

This also closes the one gap in that column: **White Plains** has Strategy but no Action Development
section, so `lhmp` went 44/45 → **45/45**.

Absent in 17 annexes: Bronxville, Dobbs Ferry, Harrison, Irvington, Larchmont, Mount Kisco, North
Castle, North Salem, Ossining (V), Pelham (V), Rye Brook, Scarsdale, Sleepy Hollow, Mamaroneck (T),
Ossining (T), Tuckahoe, Yorktown.

### D-A7 · The three orphan columns — **RESOLVED 2026-09-08: re-routed, not surfaced**

> **CORRECTION (2026-09-08).** An earlier status note said annex prose *"was already loaded into
> those columns, so that content will not render anywhere."* **That was wrong.** The three orphan
> columns received **zero** content: the annex crosswalk covers **15 columns**, and `nfip`,
> `lhmp_dams` and `demographics_description` are **not among them** (0 rows each). Nothing was
> loaded into them and nothing was lost.

**Why there was nothing to load.** The IEM annexes carry a heading for every component on the annex
page *including the data and shared ones*, with **no prose beneath**. Verified across all 45 files:
**14 of the 36 distinct section headings are 0 characters in every annex**, `21::NFIP Loss` among
them. There is **no NFIP, dams or demographics prose anywhere in this delivery** — those headings are
placeholders for content the platform renders itself.

| Section | kind | ord | chars, summed over 45 |
|---|---|--:|--:|
| `21::NFIP Loss` | shared | 44 | **0** |
| `22::Floodplain Map` | data | 45 | **0** |
| `23::Buildings in The Floodplain` | data | 46 | **0** |
| `24::Critical Buildings in The Floodplain` | data | 47 | **0** |
| + 10 more (`15`,`16`,`07`,`08`,`10`,`34`,`38`,`42`,`44`,`46`) | data/shared | — | **0** |

**Owner direction of 2026-09-08 — C1 stands, so no Cards are added. Route the content instead:**

| Column | Destination | Notes |
|---|---|---|
| **`demographics_description`** | annex page **Jurisdictional Profile** — `lhmp_municipality_profile` (ord 13) | Empty per D-A4; the most prominent box on the page |
| **`nfip`** | **by shape:** local flood-problem narrative → merge into **`lhmp_problem_areas`** (ord 43) under an h3 *NFIP* lead-in; a cross-jurisdiction roster → **bulleted list by jurisdiction** on NFIP page `2448353`, in **`2450152` NFIP Participation Summary** (ord 3) *or* its **Local Context** `2450153` (ord 10) | Choose by what the base-plan load already put there — don't write a second roster into a box that has one. `lhmp_problem_areas` is the **largest** loaded column (50,713 ch / 45 rows), so append, never replace |
| **`lhmp_dams`** | **not the Jurisdictions dataset** — `NYS_Dams` source **1459525** / view **1459528**, per dam, keyed by **`state_id`**, columns **`hhpd_1`–`hhpd_4`** | See below |

**Dams target, verified 2026-09-08.** `hhpd_1` = Risk Assessment Process, `hhpd_2` = Dam Risks and
Failure Impact, `hhpd_3` = Mitigation Plan Goal, `hhpd_4` = Planned Mitigation Actions / Projects.
Context page `/edit/the_local_environment/high_hazard_dams/high_hazard_dams_view_card?state_id=163-1597`.

**Rows already exist — update in place, never create.** Westchester (geoid 36119) has **225 dam
rows**: 36 `High Hazard Dam`, 41 Intermediate, 136 Low, 12 unassigned. **All four `hhpd_*` columns
are empty on all of them.**

**Open caveat — only `hhpd_2` currently renders.** On page `2448354` the two *Dam Risks and Failure
Impact* Cards (`2460892`, `2450717`) bind only `hhpd_1` and `hhpd_2`, and `hhpd_1` has
**`show: false`**; `hhpd_3` and `hhpd_4` are **bound by no component at all**. Filling all four would
repeat the orphan-column mistake one layer down. **Question for the owner:** should `hhpd_1`, `_3`
and `_4` be surfaced before anything is written to them?

Guidance folded into the skill as **§7** of
[`loading-annexes-into-jurisdictions-dataset.md`](../../skills/loading-annexes-into-jurisdictions-dataset.md)
— §7a the zero-char heading trap (with the inventory command), §7b orphan-column routing, §7c the
dams path.

### D-A8 · Small per-annex gaps — **RESOLVED by the D-A6 fold and the alias sweep**

The three apparent gaps and both stray sections dissolved once the heading aliases were in:

| Was | Now |
|---|---|
| `historic_prop_dist` missing on `WestchesterCounty` | its heading is `Historic Properties/Districts` — aliased, **45/45** |
| 878 ch stray under the ord-20 *table* heading (`WestchesterCounty`) | was the mis-parse of the above; no fold needed |
| `lhmp_historic_occurances` missing on `PortChester`, `Tarrytown` | `Historic Occurences` / `OccurEnces` — aliased, **45/45** |
| 2,005 ch stray under ord 35 "Hazards Excluded" | same mis-parse; no fold needed |
| `lhmp` missing on `WhitePlains` | closed by D-A6 |

Every one of the 15 mapped columns is now **45/45**. The `REASSIGN` entries for ord 20 and ord 35 in
`build_payloads.py` are retained but no longer fire.

### D-A9 · Two independent annex pages, and 86 mispointed parents — **updated 2026-09-04**

Once **D8**'s `authPermissions` was set, page `2448361` became readable and the picture changed.
There are **two independent annex pages in the pattern, sharing zero component ids**:

| Page | Slug | Components | Jurisdictions lexical Cards |
|---|---|--:|--:|
| `2448361` **Select Jurisdiction** | `the_plan/jurisdictional_annexes/select_jurisdiction` | 92 | **27** |
| `2448345` **Jurisdictional Annex Form** | `the_plan/jurisdictional_annexes/jurisdictional_annex_form` | 91 | **27** |

Both are published, and **both bind all 15 loaded columns**, so the annex prose renders either way —
the load is unaffected.

**The defect.** Of the 91 components listed in `2448345`'s `draft_sections`:

| Claimed parent | Components | Note |
|---|--:|---|
| `2448361` | 86 | **a different page, which lists none of them** — not a stale pointer to the right page |
| `2448345` | 2 | orders 22, 65 — look like post-duplication additions, so this is what a correct `parent` should be |
| `2448353` | 1 | order 44, the NFIP Loss card — that is the *NFIP – Floodplain Management* page |
| `1438697` | 1 | order 14 — **a `county_template` page id** |
| `1592682` | 1 | order 74 — **a `county_template` page id** |

The last two are the same class as the base plan's **D9** (page `2448340` parenting to
`county_template` page `1300884`); fix in one pass.

Also noted: the Cards' `filters` carry a hardcoded fallback geoid `3610506310` — a **Sullivan** MCD,
the same duplication residue as D8's `36105`. Harmless while `usePageFilters` is true, but it is the
value that shows if the page filter ever fails to resolve.

**Open question for the owner, and it gates D-A7:** *is having two near-identical annex pages
intended?* If one is vestigial, adding Cards to `2448345` may be work on the wrong page. Note also
that **D-A4 is only true of `2448345`** — on `2448361` all twelve of those boxes already exist
(`lhmp_municipality_profile`, `growth_and_development_trends`, `lhmp_cascading_impacts`,
`lhmp_other_hazards`, the three Actions boxes and all five `Additional Context` columns) and are
simply empty. `nfip`, `lhmp_dams` and `demographics_description` (D-A7) have no Card on **either**
page.

## Sign-off

- [x] **D-A1** — Census **Place** rows, confirmed against Schenectady/Delaware/Suffolk precedent.
- [ ] **D-A2** — Mount Pleasant: ask IEM whether it is non-participating or the annex is missing.
- [x] **D-A3** — Bedford overwritten. *Open sub-question:* clear the four surviving 1.0 columns?
- [x] **D-A4** — empty boxes left empty.
- [x] **D-A5** — local paragraphs → `lhmp_historic_occurances`.
- [x] **D-A6** — Strategy → `lhmp`.
- [x] **D-A7** — **RESOLVED 2026-09-08.** No Cards added (C1). Re-routed per owner direction; the
      earlier "already loaded" note **corrected** — the three columns got 0 content, and the annexes
      carry no NFIP/dams/demographics prose at all. Folded into the skill as §7. *Open sub-question:*
      surface `hhpd_1`/`_3`/`_4` before writing dams?
- [x] **D-A8** — dissolved by the alias sweep.
- [ ] **D-A9** — **owner question:** are two annex pages intended? Then fold the two `county_template` parent pointers into the base-plan D9 fix.

## Load conventions

Per [`loading-annexes-into-jurisdictions-dataset.md`](../../skills/loading-annexes-into-jurisdictions-dataset.md):

- Column value is a lexical **root** object, `{"root":{…}}` — *not* the `{text:{root}}` wrapper used
  by page components. Build with `lexical.mjs` `buildRootBlocks2`.
- Write with `dms dataset update 1346449 <row-id> --data <file>` (file path, not inline — the
  payloads blow the Windows arg limit). The server shallow-merges, so send only the filled columns.
- Back up every target row's pre-edit `data` first; dry-run; read-back verify after.
- Skip all 27 `census_type=CDP` rows.
- **Faithful and verbatim — invent nothing.** Draft only; the owner reviews and publishes.

## Next steps

- [x] ~~Back up all non-CDP rows~~ → `out/backups/juris_rows_PRE.json` (81 rows, pre-edit).
- [x] ~~Build payloads, dry-run, apply~~ — **45/45 rows, 675 column writes, read-back verified.**
- [x] ~~Read-back verify~~ — independent post-load pass in `out/juris_rows_POST.json`:
      679 filled columns on target rows (675 written + Bedford's 4 survivors), 27 CDP rows
      untouched, 9 non-target rows confirmed empty.
- [ ] **Ask IEM about Mount Pleasant** (D-A2), and — if there is another annex revision — about the
      empty `Jurisdictional Profile` and `Growth and Development Trends` boxes (D-A4).
- [ ] **Decide whether to clear Bedford's four surviving 1.0 columns** (D-A3).
- [ ] **After base-plan D8 restores `authPermissions`:** add the three orphan-column Cards (D-A7) to
      `county_template` **1300890** and propagate, and fix the parent pointers (D-A9) in the same
      pass as the base plan's D9.
- [ ] **Publish.** Everything is in the dataset, which the annex page reads directly — but the page
      itself still needs publishing for the loaded prose to render publicly, and that is gated on
      the base plan's D8 geoid fix (`filters` still carry `36105` Sullivan).
- [ ] Verify render in-app by selecting a jurisdiction on the annex page (the SPA needs the geoid
      filter picked; the read-back over the API is the authoritative content check and is done).
- [x] ~~Fold the IEM annex model into the skill~~ — added as §5c of
      [`loading-annexes-into-jurisdictions-dataset.md`](../../skills/loading-annexes-into-jurisdictions-dataset.md).
- [ ] Write `skills/profiles/iem.md` — the third consultant profile, and the first whose annexes are
      authored against the platform page order.
