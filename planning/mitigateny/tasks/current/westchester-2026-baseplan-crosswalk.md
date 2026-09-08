# Westchester 2026 HMP Base Plan → pattern 2448336 crosswalk

**Project:** MitigateNY · **Topic:** content · **Status:** **LOADED 2026-09-08** — 177 / 177 Annotation slots written to `draft_sections`, 334,761 ch, read-back verified, nothing published. All decisions closed (C1, C2, D1-SO, D3, D4, D7). · **Started:** 2026-09-03

## Objective

Crosswalk the **2026 Westchester County HMP Base Plan Draft** (IEM, August 2026) onto the Annotation
("Local Context" grey box) slots of the **Westchester-2026** pattern — a duplicate of
`county_template` — so the county-level narrative can be loaded via the CLI in a following pass.

This is the **first plan authored against the MitigateNY 2.0 information architecture.** The
consultant built the Word document's heading tree to mirror the platform's pages and components, and
that mirroring holds up: **183 of the document's 197 content-bearing sections land on a named slot**,
and **173 of 183 mappings are exact title-and-position matches.**

## Scope

**In scope (this pass):** county-level prose → Annotation components (`element-type: "lexical"`,
`element-data.isCard === "Annotation"`) in `draft_sections`.

**Out of scope:**
- Workbook data → internally-sourced tables, cards and graphs — **a colleague is loading this separately.**
- Jurisdictional annexes (45 `Westchester_Jurisdictional_Annex_*.docx`) → the Jurisdictions dataset —
  a later pass, per [`loading-annexes-into-jurisdictions-dataset.md`](../../skills/loading-annexes-into-jurisdictions-dataset.md).
- Shared statewide narrative Cards (`LHMP_IA`), Data components, Inline Guidance — never touched.
- Publishing. Everything goes to `draft_sections`; the owner reviews and publishes.

## Target

| | |
|---|---|
| App / type | `mitigat-ny-prod` / `prod` |
| Pattern | **2448336** — `Westchester-2026` |
| Instance | `mitigateny_county_template_v3_copy_2` |
| Subdomain | `westchester-2026` → **https://westchester-2026.mitigateny.org/** (verified 200) |
| Duplicated from | `county_template` = pattern **1300890** (`MitigateNY_County_Template_V3`) |
| Created | 2026-09-03 17:49 UTC |
| Pages | 49 (40 with content, 9 return `no-access`) |
| Annotation slots | **256** (8 pre-filled with template nav/cross-reference text, 248 empty) |

**Source:** `references/mny-transcribe/westchester/Final Plan/2026 Westchester County HMP Base Plan Draft.docx`
— 1,965 blocks, 10 tables, 722 headings (`Heading 1`–`Heading 5`), **197 content-bearing sections**.
Consultant: **IEM** (`www.iem.com` in the document footer) — a **new consultant profile**, not Tetra
Tech (Suffolk) or Hagerty (Nassau).

## Results at a glance

| | Count |
|---|--:|
| Crosswalk rows | 271 |
| Doc sections with a target | **183** |
| Distinct slots receiving content | **174** of 256 |
| Characters to transcribe | ~327,600 |
| High confidence | 173 |
| Medium confidence | 9 |
| Low confidence | 1 |
| **GAP** — county content with no slot | 5 |
| **Partial** — mixed county content / boilerplate | 1 |
| Skip — boilerplate or platform-rendered | 8 |
| Slots to leave empty | 73 |
| Pre-filled, do not overwrite | 1 (+7 on Home / The Risk) |

Generated artifacts (git-ignored working folder
`references/mny-transcribe/westchester/final-plan-work/`):

| File | What |
|---|---|
| `out/westchester-baseplan-crosswalk.csv` | the 271-row crosswalk, one row per mapping |
| `out/crosswalk.json` | same, machine-readable (the load spec's input) |
| `out/crosswalk_tables.md` | the per-page tables reproduced below |
| `out/inventory.json` / `inventory.md` | all 256 Annotation slots with their Inline Guidance |
| `out/pages.json` | the 49 pages (id, slug, parent, component counts) |
| `out/all_components.json` | every component on every page, in draft order |
| `out/baseplan/{blocks,sections,hazard_matrix}.json`, `outline.txt`, `section_map.txt` | the document extraction |
| `scripts/` | `enumerate.mjs`, `build_inventory.mjs`, `docx_dump.py`, `section_map.py`, `build_crosswalk.py`, `gen_report.py`, `pattern_diff.mjs`, `probe_comps.mjs` |

## Why the alignment is this good

The document's heading tree *is* the platform component order. On a hazard page, for example:

| Doc heading | Platform component (Coastal Hazards, page 2448355) |
|---|---|
| H4 `Overview` | order 5 — Card "Overview" (**shared data**) |
| — | order 9 — **Annotation "Local Hazard Summary"** |
| H4 `General Vulnerability` | order 10 — Card "General Vulnerability" (**data**) |
| H4 `Potential Impacts (Table)` … `Presidential Disaster Declarations` | orders 12–27 (**data**) |
| H5 `Declarations and Their Effects on the County` | order 29 — **Annotation**, same title |
| H5 `Featured Event` | order 34 — **Annotation**, same title |
| H4 `Local Risk Assessment` | order 35 — lexical header |
| H4 `County Assessment` | order 37 — **Annotation**, same title |
| H4 `Jurisdictional Assessment` | order 40 — **Annotation**, same title |
| H4 `Modeled Risk` / `Total EAL (Map)` | orders 42–44 (**data**) |
| H5 `Built Environment: Local Risk Summary` | order 47 — **Annotation** (colon vs dash) |
| H5 `People and Communities: Local Risk Summary` | order 50 — **Annotation** |
| H5 `Natural Environment: Local Risk Summary` | order 53 — **Annotation** |
| H5 `Local Capabilities` | order 58 — **Annotation**, same title |
| H5 `Local Actions` | order 63 — **Annotation**, same title |
| H5 `Featured Strategy` | order 68 — **Annotation**, same title |

The same pattern holds on the county pages: the document uses a literal **`Local Context`** H4/H5
heading wherever the platform has an Annotation titled "Local Context". Built Environment is the
cleanest case — the doc's 8 `Local Context` sections and the page's 8 `Local Context` Annotations
appear in the **same order**, 1:1.

**Hazard taxonomy is 1:1.** All 16 doc hazard profiles map to the 16 platform hazard pages with no
splits, merges or drops — unlike Suffolk (hybrid) or Schenectady (renames + two dropped hazards).
This is the first county where the taxonomy needed no owner decision.

## Where the document and the template have drifted apart

The template moved after the consultant started, and the consultant added structure the template
doesn't have. Nine things need an owner decision or a template fix:

### D1 — County content with no Annotation to put it in (5 GAPs + 1 Partial)

> **Resolved as recommended in [Orphan-content disposition](#orphan-content-disposition--recommended-pending-owner-sign-off) (D1-SO-1 … D1-SO-7) — awaiting sign-off.**

| Doc block | Section | chars | Nearest slot | Recommendation |
|---|---|--:|---|---|
| [562] | Executive Summary (plan-wide) | 3,983 | none | No plan-wide exec-summary Annotation exists; the Home page's 6 Annotations are nav cards. **Owner decision:** The Plan Executive Summary `2449721`, or a new Home component. |
| [572] | Formal Adoption by Westchester County and Participating Jurisdictions | 609 | About the Process `2463655` | `2463655` is already claimed by doc [1919] (Adoption > Local Context). **Owner decision:** merge the two, or a new component. |
| [580] | Letter from the Director | 2,150 | none | County-specific, no slot anywhere. **Owner decision:** new component on Home or The Plan. |
| [589] | Background | 4,298 | none | **Partial.** Paras 590–593 + 598 are county-specific (45 jurisdictions, 430.8 sq mi, the three coterminous town-villages, what changed since the last plan); 594 + 599–602 and Table 1 are 44 CFR boilerplate → skip. **Owner decision** on target: `2449721` or `2449737`. |
| [842] | Risk Assessment Terms | 888 | The Risk `2465617` | Generic glossary (hazard / exposure / vulnerability / consequence / risk). Recommend **skip**, or append to `2465617`. |
| [1843] | Capabilities Assessment > Overview | 1,317 | Capabilities Assessment `2450060` | Page order 1 is a data Card "Overview"; the first Annotation is order 5 (Planning and Regulatory). Recommend **prepend to `2450060`**, or add a page-overview Annotation to `county_template`. |

### D2 — Three hazard pages are missing a slot the others have

Present in **both** the Westchester copy and `county_template`, so this is a **template defect**, not
a duplication error:

| Page | Page id | Missing Annotation |
|---|---|---|
| Extreme Cold | `2448347` | `Local Actions` |
| Snowstorm | `2448346` | `Local Hazard Summary` |
| Wind | `2448391` | `Local Hazard Summary` |

**Does not block this pass** — the document carries no prose for any of the three. Worth fixing on
`county_template` and propagating (see
[`propagating-county-template-changes-to-duplicates.md`](../../skills/propagating-county-template-changes-to-duplicates.md)).

### D3 — Climate Change has one Annotation for two large doc sections

> **Sign-off item in [Orphan-content disposition](#sign-off).**

Doc [1725] `Local Context` (3,382 ch) **and** [1730] `Shared Socioeconomic Pathways` (9,999 ch, 14
paragraphs) both have to land in `2449756`, the page's only Annotation. Recommend merging under an SSP
sub-heading. **Do not write to component `2449734`** (page 2448369, order 12) — that is the shared
21,347-character statewide **CLIMATE IMPACTS MATRIX** block.

### D4 — Five doc sections narrate a data table with no adjacent Annotation

Each is folded into the nearest slot (Medium/Low confidence):

| Doc block | Section | chars | Folded into |
|---|---|--:|---|
| [609] | Demographic Statistics | 2,432 | **`2449856` — Local Populations at Highest Risk (order 8). DECIDED 2026-09-08, owner override.** Prepended before [620]. ~~`2454034`~~ |
| [643] | Future Population Projections | 1,318 | **`2453621` — Population Change (order 18). CONFIRMED 2026-09-08.** Appended after [638]; its guidance explicitly asks for projections |
| [757] | Open Space Parcel Statistics | 979 | **`2449784` — Natural Environment > Overview > Local Context (order 3). DECIDED 2026-09-08.** Appended after [751]; narration only ([758]+[761]), not table 760. ~~`2464950`~~ |
| [1825] | Local Funding Capabilities | 675 | **`2450067` — Capabilities Assessment > Financial Capabilities > Local Context (order 23). DECIDED 2026-09-08, owner override.** Appended after [1869]. ~~`2450073`~~ (which is on **Strategies**, not Capabilities Assessment) |
| [1783] | Goals and Objectives | 499 | **SPLIT across `2450098` + `2450104`. DECIDED 2026-09-08.** Sentence 1 of [1784] → `2450098` (Overview LC, ord 3); sentence 2 + [1785] + [1786] → `2450104`, prepended before [1788] |

#### D4 · [757] Open Space Parcel Statistics — decided 2026-09-08, and the statistics card investigated

**Mapping: → `2449784`** (Natural Environment > Overview > Local Context, order 3), appended after
[751]. Transcribe the narration only — **[758]** (what counts as open space; the ~70,000-acre /
>24%-of-land-area figure) and **[761]** (what private recreation and public parkway lands include).
**Table 760 is data and is not transcribed.** This closes the last `LOW`-confidence row in the
crosswalk (**LOW 1 → 0**).

**Two disagreeing open-space inventories in the document.** Worth an owner/IEM note:

| Source | Where | Total | Scheme |
|---|---|--:|---|
| Earlier County land-use summary | table 760, under **[757]** | ~70,000 ac, >24% of land area | 7 land-use classes (Public Parks and Parkway Lands 33,099.26; Water Supply Lands 11,406.68; Private Recreation 8,688.00; Nature Preserves 7,319.28; Agricultural 4,808.86; Common Land HOA 2,658.36; Cemeteries 1,888.09) |
| Westchester 2033 GIS inventory | table 768, under **[762]** | **82,490.5 ac / 6,734 parcels** | 11 open-space categories (County Parklands 17,357.0; State Parklands 9,866.6; Local Parks 9,372.9; Private Institution 8,820.5; Private Recreation 8,589.9; Public Institution 6,935.1; Farms/Stables/Nurseries 6,583.5; Nature Preserves 6,581.9; HOA/Common Lands 4,558.7; Public Non-Parklands 1,873.7; Cemeteries 1,950.7) |

### The `2449792` "Open Space Statistics" card — investigated, recommend NOT filling

The owner offered this as an optional extra. **Tried it; recommend against, and here is exactly why.**

**What the component actually is.** `2449792` is `element-type: lexical` with **`isCard: true`** —
a statistics *Card*, **not** `isCard: "Annotation"`. It therefore sits **outside the 256-slot
Annotation set** that this entire load targets, so writing to it is a new class of write, not the
established and verified path. It already holds 22 children: seven `[#]` placeholders plus a
`(REF109, 111)` source line, i.e. a **fill-in-the-numbers template**.

**Only 2 of its 7 placeholders can be filled faithfully from the plan:**

| Card placeholder | Available in the plan? |
|---|---|
| `[#] acres of protected land` | **No.** Table 768's 82,490.5 ac total is *not* all protected — [765] explicitly defines a second class, *"Areas of Open Space Character — parcels **not** permanently protected from development"*, and the table does not split the two. |
| `[#] acres of privately owned forestland` | **No.** Nothing in the plan. |
| `[#] acres of conservation easements` | **No.** Nothing in the plan. |
| `[#] acres of state-owned forests` | **No.** *State Parklands* is parkland, not forest. |
| `[#] acres of state parks` | **Approximately** — *State Parklands* **9,866.6 ac** (category-name approximation) |
| `[#] acres municipal parks` | **Approximately** — *Local Parks* **9,372.9 ac** (County Parklands correctly excluded) |
| `[#] miles of trails` | **No.** [766] mentions the map shows trail *locations*; no mileage anywhere. |

**Why not relabel the card to Westchester's own categories instead?** Because the platform
**already renders open-space parcel statistics** immediately below it: `2449794` "Open Space Parcel
Statistics" is a live **Spreadsheet bound to the NYS Tax Parcels Map**, with its own property-class
scheme (Vacant Land, Urban Renewal, Public Use Open Space, Flood Control, Wild/Forested, …),
currently returning 4 rows for the geoid. Transcribing table 768 into the lexical card would put
**two conflicting sets of open-space acreage on one page, from two different sources with two
different category schemes** — worse than one unfilled card. It would also violate the
*don't transcribe data tables* convention.

Also note `2449787` "Open Space Summary" (order 4) is a Card bound to the shared statewide
**`LHMP_IA`** source — **C2 no-touch.**

**Recommendation:** leave `2449792` as-is. The right fix is either (a) a county GIS source that
actually carries those seven measures, entered by hand, or (b) changing the card's seven labels to
measures Westchester publishes — and (b) is a **`county_template`** decision, which **C1** puts out
of scope. Filling 2 of 7 and leaving 5 as `[#]` would make the card read as broken.

#### D4 · [1783] Goals and Objectives — SPLIT, decided 2026-09-08

Split at **the sentence boundary the author already wrote** — not mid-clause, which is why this split
is legitimate where the [1825] one was not. The paragraph does two different jobs in two sentences.

| Part | Text | → | Why |
|---|---|---|---|
| **[1784] sentence 1** | *"Mitigation goals and objectives provide the policy framework for selecting, prioritizing, and implementing actions that reduce long-term risk to people, property, infrastructure, and natural systems."* | **`2450098`** — Strategies > Overview > Local Context, **order 3** | Its guidance asks for *"a concise overview of the County's mitigation strategy … communicate the overall intent of what the county aims to achieve and serve as an introduction to the sections that follow."* This is **the only chapter-level sentence in the whole Strategies chapter that does that job.** The slot was **previously unmapped** — it had no crosswalk row at all. |
| **[1784] sentence 2 + [1785] + [1786]** | *"For this plan, goals and objectives are defined as follows:"* / *"Goals: Broad, long-term policy statements…"* / *"Objectives: Specific supporting statements…"* | **`2450104`**, **prepended before [1788]** | These three define the two terms and hinge straight into the list. Define, then list. `2450104`'s guidance says ***"List** the county's goals and objectives"* — which [1787] satisfies with 26 paragraphs (Goal 1, 1.1–1.5, Goal 2, 2.1–2.2, …). The definitions are its **lead-in, not its content** — exactly the distinction the owner drew. |

Emission order on `2450104` verified: **[1783] then [1787]**, so the definitions sit above the list.

**Forward note:** if **D1-SO-2** lands as recommended, [567] (*"Mitigation strategy, goals, action
evaluation"*) also goes to `2450098`, and its guidance is an exact match for that paragraph. The two
complement each other — [1784]S1 states what goals *are for*, [567] states what this county's
strategy *does*. No conflict.

**Stats caveat.** The split makes [1783] appear on two rows, so the generated totals now
double-count its 499 characters: the CSV/JSON report reads **272 rows / 175 slots / 328,129 ch**, but
the true character total is still **327,630**. Only [1783] is affected.

#### D4 · [1825] Local Funding Capabilities — the fold that needed correcting

**Two corrections to the original D4 row.**

1. It named `2450073` and said *"page order 22 is a Spreadsheet of the same name"* — true, but that
   page is **Strategies** (`2448362`), **not** Capabilities Assessment. The row read as though the
   fold stayed on the capabilities page. It did not.
2. There **is** a component titled exactly *Local Funding Capabilities* — **`2450079`, Strategies
   order 22** — but it is an `element-type: Spreadsheet`, not an Annotation, so it is not writable.
   That is precisely what makes [1825] a D4 case: the doc heading matches a **data** component and
   the prose narrates it.

**Where the document puts it:** `H3 Strategies` → `H4 [1822] Capacity to Implement` →
`H5 [1823] Funding Sources Local Context` + `H5 [1825] Local Funding Capabilities`. So it is *not*
in the document's Capabilities Assessment chapter at all. Moving it there is a deliberate owner
override of document placement.

**DECIDED 2026-09-08 → `2450067`** (Capabilities Assessment, Financial Capabilities > Local Context,
order 23), appended after [1869]/[1871] under a bold *Local Funding Capabilities* lead-in. The M-list
entry was moved below [1869] so emission order gives append, not prepend.

**Why Financial and not a split, and not Administrative and Technical:**

| Option | Verdict |
|---|---|
| **All &rarr; `2450067` Financial** | **Chosen.** Every sentence is about money, and the section title says *Funding*. `2450067`'s guidance asks for *"the types of resources the county can access … the county's general approach to securing funding … established relationships with state and federal funding programs"* **and** *"if there are any gaps in financial capabilities, you may want to give a brief summary"* — the larger-vs-smaller-municipality contrast **is** a gaps statement. Direct guidance hit. |
| Split across capability types | **Rejected.** The admin/technical-sounding items — *dedicated engineering or planning staff*, *consultant support*, *intermunicipal partnerships*, *established infrastructure maintenance programs* — all sit inside **one sentence** whose subject is what larger vs smaller municipalities can *afford*. Splitting means cutting a single sentence mid-clause; both halves read worse. 675 ch across three boxes yields ~200-ch fragments. |
| All &rarr; `2450058` Administrative and Technical | **Rejected.** Only about a third of one sentence is administrative/technical, and it is subordinate to a financial point. `2450058` already receives 2,702 ch of genuine admin/technical content from [1857] — there is no gap there to fill. |

**Caveat the owner should see: roughly 80% of [1826] is already stated, at greater length, in prose
the platform will render nearby.**

| [1826] says | Already said in |
|---|---|
| *"Local funding capabilities vary among participating jurisdictions"* | **[1871]** &rarr; `2450067`: *"Financial capability varies by jurisdiction based on staffing, project scale, local revenue structure, and experience with grants"* |
| larger vs smaller municipalities; capital programs, grant administration, county coordination | **[1871]** &rarr; `2450067`: *"financial capacity generally includes municipal budgets, capital improvement planning, bonding authority … leverage county coordination, state guidance, and federal mitigation funding"* |
| *"maintaining updated project scopes, local match strategies, cost estimates … documentation of past damages"* | **[1824]** &rarr; `2450073`: *"identify shovel-ready or scoping-ready projects, maintain documentation of hazard impacts, and integrate mitigation priorities into local capital improvement planning"* |

The genuinely additive material is about one clause — *preliminary engineering information*, and the
explicit *consultant support / intermunicipal partnerships* framing. Loaded whole and faithfully, so
a reviewer can see the duplication and trim it in the box; **say the word to trim to the additive
clause, or to skip [1826] entirely** as covered (the same treatment [564]/[565] get under D1-SO-2).

#### D4 decisions applied so far (working through easiest &rarr; hardest)

| Doc | Decision | Date | Effect |
|---|---|---|---|
| **[609]** Demographic Statistics | &rarr; **`2449856` Local Populations at Highest Risk** | 2026-09-08 | **Owner override of the recommendation.** Better fit: `2449856`'s guidance asks to *"describe the populations at highest risk in your county, which would include those who are at increased vulnerability to natural hazards due to social, economic, and/or physical factors"* — and doc **[610] is literally the topic sentence for [620]'s enumeration** (older adults, disability, low income, race/ethnicity, homelessness, limited English proficiency, transportation access). Prepended before [620] under a bold *Demographic Statistics* lead-in; M-list order in `build_crosswalk.py` controls the sequence. `2454034` now receives [605] only. |
| **[643]** Future Population Projections | &rarr; **`2453621` Population Change** | 2026-09-08 | Confirmed as recommended. Appended after [638]. |

Both re-run through `build_crosswalk.py` &rarr; `gen_report.py` &rarr; `gen_html.py`. Crosswalk totals
unchanged (271 rows, 174 slots, 183 doc sections, 327,630 ch) since both are retargets, not additions;
**HIGH 173 &rarr; 175, MEDIUM 9 &rarr; 7.**

**One open sub-question on [609].** The section is six paragraphs and only some of it is about
at-risk populations:

| Para | Content | Fits |
|---|---|---|
| [610] | age / disability / income / language / housing tenure / transport access / health status affect exposure, sensitivity, ability to act | **`2449856`** — it is [620]'s topic sentence |
| [613] | racially, ethnically, linguistically diverse; why language data matters for translated materials, interpretation, trusted messengers | **`2449856`** |
| [611] | 2020 Census 1,004,457 vs 2024 ACS 1,006,447 vs 2025 estimate 1,015,743, and why the three differ | `2454034` — its guidance asks for *"total population"* |
| [612] | density patterns, southern/central vs northern Westchester | `2454034` |
| [614] | 398,706 housing units, median household income $118,596, 54.0% bachelor's or higher | `2454034` |
| [615] | sources line | follows whichever |

As instructed, **all six went to `2449856`.** Say the word and [611]/[612]/[614]/[615] move back to
`2454034` — a one-line change in `build_crosswalk.py`.

### D5 — Lightning has no `County Assessment` heading

The county-level assessment prose (3,292 ch) sits under H4 `Local Risk Assessment` [1497] instead —
which on the platform is a plain lexical header (order 35), not an Annotation. Target is the
`County Assessment` Annotation `2451746`. This is the **only** hazard subsection in the whole document
that doesn't match a slot title. High confidence on the intent.

### D6 — The doc's hazard `Overview` has no slot of its own

Doc H4 `Overview` per hazard (Location / Extent / Probability / Data Limitations) corresponds to
platform order 5, a **shared data Card**. Content exists for only three hazards — Drought (1,498 ch),
Wildfire (350 ch), Ice Storm (219 ch) — and is folded into `Local Hazard Summary` along
`General Vulnerability`. Medium confidence.

### D7 — Six slots the plan leaves empty that arguably shouldn't be

> **Sign-off item in [Orphan-content disposition](#sign-off).**

The document has the heading but no prose. Worth raising with IEM before load:

| Slot | Page | Note |
|---|---|---|
| `2449738` | About the Process | **Organizational Structure – Planning Teams** — doc [1888] heading only. Steering-committee / working-group structure belongs here. |
| `2449743` | About the Process | **Technical Data and Existing Resources** — doc [1915] heading only. |
| `2449745` | About the Process | **Continued Public Engagement** — nothing in the doc. Relevant to 44 CFR 201.6(c)(4)(iii). |
| `2449870` | People and Communities | **Special Districts** — doc [657]/[658] empty. |
| `2449796` | Natural Environment | **Buyouts/Acquisitions Local Context** — doc [770]/[772] empty. |
| `2450116` | Track Progress | **Executive Summary** — the doc has no Track Progress chapter at all. |

### D8 — Three pattern-level fields did not survive duplication

`pattern_diff.mjs` against `county_template` (1300890):

| Field | Westchester-2026 | county_template | Action |
|---|---|---|---|
| `filters` | `[{"searchKey":"geoid","values":["36105"]}]` | same | **BLOCKER for data components.** `36105` is **Sullivan**; Westchester is **36119**. Must be set before the workbook load renders correctly. Same value on the template, so it's the template's placeholder — a required post-duplication step, not template drift. |
| `additionalSectionAttributes` | **absent** | defines the `status` select (`new_component`, `shmp_sourced_content`, `local_input_needed`, `refinement_needed`, …) | Copy from 1300890. Without it, the `status: shmp_sourced_content` this load writes won't render in the admin UI. |
| `authPermissions` | **absent** | `{"users":{"656":["*"]},"groups":{"public":["view-page"],"AVAIL":["*"],"DHSES":["*"],"LHMP Template Editor":["*"]}}` | Copy from 1300890. Almost certainly why **9 of the 58 page rows read back `no-access`** — one of which is `2448361`, the annex page that holds 86 of the Jurisdictional Annex components, so this **blocks** annex-page edits (see annex D-A7). |

### D9 — Two stale references carried over from the template

- **Page `2448340`** (`the_plan/strategies/capacity_to_implement/response`, "Response") has
  `parent = 1300884` — a **`county_template` page id**, not a page in this pattern. Its parent pointer
  needs re-pointing at the Westchester Strategies subtree.
- **Slot `2450153`** (NFIP page, order 10) sits directly under the "Floodplain Administrators" Card,
  but its Inline Guidance still reads *"Provide information on your latest Flood Insurance Rate Map."*
  Stale guidance on `county_template`; doesn't change the mapping (doc [810] → `2450153`, High), but
  it will mislead the next author.
- **Slot `2449901`** (Built Environment, order 28 = Buildings) carries guidance copy-pasted from
  `2449882` (order 8 = Critical Buildings and Infrastructure). Same class of defect.
- **The Jurisdictional Annex page has the same defect at scale.** Of the 91 components listed in page
  `2448345`'s `draft_sections`, 86 claim `parent = 2448361` (the canonical annex page), 2 claim
  `2448345`, 1 claims `2448353` (the NFIP page), and **two claim `county_template` page ids —
  `1438697` and `1592682`**. Fix in the same pass; details as
  [annex D-A9](./westchester-annex-crosswalk.md#d-a9--the-annex-pages-component-parentage-is-inconsistent--new-finding-not-blocking).

### What did *not* drift

The Westchester copy is otherwise **structurally identical** to `county_template`: same 256 Annotation
slots, same slot titles, same per-page component counts, on all 49 shared pages.

> **Corrected 2026-09-04.** This section previously said the template had one extra page the copy
> lacks — `the_plan/jurisdictional_annexes/select_jurisdiction`. That was an artifact of the **D8**
> auth gate: the page was unreadable anonymously, so the enumeration missed it. Once
> `authPermissions` was set, it read back as page **`2448361` "Select Jurisdiction"**, 92 components,
> published. **The copy has it.** See
> [annex D-A9](./westchester-annex-crosswalk.md#d-a9--two-independent-annex-pages-and-86-mispointed-parents)
> — it turns out to be one of *two* independent annex pages in the pattern.

## Owner constraints — set 2026-09-08

> **Status report for review:**
> [`src/themes/mny/design/reports/westchester-migration-status.html`](../../../../src/themes/mny/design/reports/westchester-migration-status.html)
> — house-style HTML covering both halves of the migration, the live-verified D8 state, C1/C2 and
> their consequences, D3/D4/D7, and the five decisions still open. Open it in a browser.


These override every recommendation below that predates them.

### C1 · No `county_template` changes in response to Westchester

**Fit content into the grey Annotation boxes that already exist.** Where a recommendation below asks
for a new slot on `county_template` **1300890**, it is void — take the fallback, or skip.

What C1 retires:

| Item | Was | Now |
|---|---|---|
| Template change list #1 (Capabilities page opener) | new Annotation at order 2 on `1425510` | **void** — see D1-SO-1 revised |
| Template change list #2 (Home `County Message`) | new Annotation on Home | **void** — see D1-SO-5 revised |
| Template change list #3 (The Plan guidance) | write `2449721`'s blank Inline Guidance | **void** — guidance is template-level |
| Template change list #4 (**D2**) | add the 3 missing hazard Annotations | **void** — moot, the doc has no prose for any of them |
| Template change list #5 (**D9** stale guidance) | replace 2 guidance blocks | **void** — guidance is template-level; the `2448340` parent-pointer fix is *not* a template change and still stands |
| Template change list #6 ([annex D-A7](./westchester-annex-crosswalk.md#d-a7--surface-the-three-orphan-columns--unblocked-2026-09-04-pending-the-d-a9-page-question)) | Cards for `nfip` / `lhmp_dams` / `demographics_description` | **void** — those three columns stay unsurfaced; the annex prose in them will not render |

D2, D9's guidance defects and D-A7 remain **recorded as template findings** for whoever owns
`county_template` — they are simply not this task's work.

### C2 · Never write into SHMP-sourced-content sections

Confirmed and already structurally guaranteed: this load writes **only** Annotation components
(`element-type: "lexical"`, `element-data.isCard === "Annotation"`). The statewide shared material
lives in data-bound **Cards** fed by the `LHMP_IA` source (**1441680**) — a different component type
the load never targets. The two named do-not-touch blocks stay named: `2449734` (Climate Impacts
Matrix, 21,347 ch) and the four `LHMP_IA` annex Cards.

**Consequence for the `status` field.** Prior loads (Schenectady, Delaware) tagged their fills
`status: "shmp_sourced_content"`. That label is wrong here *and* reads as a direct violation of C2:
this content comes from the **county** HMP, not the State plan. Tag Westchester's fills
**`local_review_needed`** instead — it is what the boxes actually need. See the revised D8 item.

## Orphan-content disposition — recommended, pending owner sign-off

**Sign off in this file.** Tick a box (or edit the row) and the load spec follows it.

### The structural finding that drives all of it

Every page in the pattern opens the same way:

```
Header → Inline Guidance (Page Guidance) → Card "Overview" → [Card "Requirements"] → Annotation → …
```

That page-opening Annotation is titled **"Executive Summary"** on chapter landing pages and
**"Local Context"** on sub-pages:

| Page-opening Annotation | Page | Title |
|---|---|---|
| `2449714` | The Local Environment | Executive Summary |
| `2465617` | The Risk | Executive Summary |
| `2449721` | The Plan | Executive Summary |
| `2450116` | Track Progress | Executive Summary |
| `2465395` | Natural Hazards | Executive Summary |
| `2450055` | Disasters | Executive Summary |
| `2454034` | People and Communities | Local Context |
| `2449884` | Built Environment | Local Context |
| `2449784` | Natural Environment | Local Context |
| `2450098` | Strategies | Local Context |
| `2449737` | About the Process | Local Context |
| `2449756` | Climate Change | Local Context |
| **— none —** | **Capabilities Assessment** | **missing** |

**Capabilities Assessment (`2448392`, template `1425510`) is the only page in the pattern with no
page-opening Annotation** — order 1 is Card "Overview", order 2 jumps straight into Card "Planning
and Regulatory". The same gap exists on `county_template`, so this is a **template defect of the
same family as D2**, not a Westchester-specific judgment call.

With that slot added, and one more on Home, **all six orphans have a home and nothing is invented.**

### D1-SO-1 · Capabilities Assessment Overview — doc [1843], 1,317 ch

- [x] ~~**Was recommended:** add an Annotation at order 2 on `county_template` `1425510`~~ —
      **void under C1.**
- [ ] **Recommended under C1 — split the section and take the fallback for the half that survives.**
      The five paragraphs are not one thing:

| Para | What it is | Disposition |
|---|---|---|
| [1844] | 1,317 ch of genuine framing — *how* the partners assessed capability, and why | → **prepend to `2450060`** (Capabilities Assessment, order 5, Planning and Regulatory LC) under an h3 lead-in such as *About this Assessment*, ahead of [1851] |
| [1845]–[1848] | one sentence each naming Planning and Regulatory / Administrative and Technical / Financial / Education and Outreach | **Skip — pure navigation.** The page *renders* those four as its own four Cards, each with its own Local Context box already receiving [1851]/[1857]/[1863]/[1869]. Transcribing them duplicates the page's own structure in prose. |

      This is why the original fallback "reads wrong" and now doesn't: the objection was that [1845]
      announces "Planning and Regulatory Capabilities" from inside the Planning-and-Regulatory slot.
      Dropping [1845]–[1848] removes exactly that problem, and [1844] alone reads as page framing.
- [ ] Skip [1843] entirely.

### D1-SO-2 · Plan-wide Executive Summary — doc [562], 3,983 ch, 6 paragraphs

The paragraphs are chapter-shaped, so they distribute onto the landing-page Executive Summary slots
the template already provides. But read against the prose the document *already* places in those
chapters, **only three of six add anything** — the rest are generic restatements of richer,
county-specific text that already has a slot.

- [ ] **Recommended — distribute, skipping the redundant three:**

| Para | Topic | Disposition |
|---|---|---|
| [563] | What mitigation is; what the Plan is | → **The Plan `2449721`** (empty) |
| [564] | Collaborative process, Planning Committee | **Skip** — [1881] → `2449737` covers it, county-specific, 1,854 ch |
| [565] | What the risk assessment does | **Skip** — [838] → `2465617` covers it, county-specific, 2,146 ch |
| [566] | What the capability assessment evaluates | ~~new Capabilities slot~~ **void under C1** → **`2450060`**, immediately before [1844] (see D1-SO-1 revised), or **Skip** — [1844] covers the same ground more concretely |
| [567] | Mitigation strategy, goals, action evaluation | → **Strategies `2450098`** (empty) |
| [568] | Adoption, five-year cycle, FEMA eligibility | → **About the Process `2463655`**, after [1919], with [572] |

`2450098`'s guidance is an exact match for [567]: *"Provide a concise overview of the County's
mitigation strategy… serve as an introduction to the sections that follow."*

- [ ] **Alternative — keep [562] whole on `2449721`.** Needs no judgment, but leaves four empty
      landing-page slots that were designed for this content and duplicates [838]/[1881] verbatim
      on the site.

### D1-SO-3 · Background — doc [589], 4,298 ch (the Partial)

- [ ] **Recommended — split by paragraph:**

| Para | Content | Disposition |
|---|---|---|
| [590]+[591] | 430.8 sq mi; 45 jurisdictions (6 cities / 19 towns / 23 villages); the three coterminous town-villages; source line | → **The Local Environment `2449714`** — its guidance asks for *"who and what defines your community"* |
| [592] | How the Plan is organized | → **The Plan `2449721`**, with [563] |
| [593]+[598] | What changed since the last plan; update history | → **About the Process `2449737`**, appended to [1881] |
| [594], [599]–[602], Table 1 | Stafford Act / DMA 2000 / 44 CFR framing | **Skip** — boilerplate |

This is what fills The Local Environment's Executive Summary; the exec-summary distribution alone
does not reach it.

### D1-SO-4 · Formal Adoption — doc [572], 609 ch

- [ ] **Recommended:** merge into `2463655` after [1919], together with [568]. [573]–[574] largely
      restate [1920]–[1922]; the non-duplicative part is the resolution-content detail (plan title
      and date, where executed resolutions are held).
- [ ] Skip as fully covered by [1919].

### D1-SO-5 · Letter from the Director — doc [580], 2,150 ch

- [x] ~~**Was recommended:** add a `County Message` Annotation to `county_template` Home~~ —
      **void under C1.**
- [ ] **Recommended under C1 — skip, at no cost.** [588] reads *"The County Executive's transmittal
      letter and signature will be inserted in the final Plan"* — it is a **drafting placeholder**,
      so there was never final content to load. C1 costs nothing here: the slot would have been
      added to hold text that does not yet exist. Punch-list it for whenever IEM supplies the signed
      letter, and let the owner decide then where it goes.
- [ ] Force it into an existing Home Annotation (not recommended — Home's boxes are nav/intro copy).

### D1-SO-6 · Risk Assessment Terms — doc [842], 888 ch

- [ ] **Recommended — skip per county, raise as statewide.** The five definitions (hazard /
      exposure / vulnerability / consequence / risk) are identical for all 62 counties. Loading them
      into a county slot puts platform-wide content in county-owned space. Raise with AVAIL as a
      shared `LHMP_IA` glossary card on The Risk, authored once.
- [ ] Append to `2465617`.

### D1-SO-7 · Track Progress `2450116`

Stays empty. The document has no Track Progress chapter, and [568] belongs with adoption. Remains on
the **D7** list to send back to IEM.

### D1-SO — ALL DECIDED 2026-09-08

Owner: *"distribute across for both D1-SO-2 and D1-SO-3, merge D1-SO-4, skip D1-SO-6."* All as
recommended. With **D1-SO-1** and **D1-SO-5** already settled by **C1**, the whole orphan register
is closed and **`GAP` and `PARTIAL` are now 0** — every content-bearing section of the document
either has a target or is deliberately skipped with a reason.

| Item | Decision | Target(s) |
|---|---|---|
| **D1-SO-1** Capabilities Overview | C1-revised | **[1844]** → `2450060`; **[1845]–[1848] skipped as navigation** |
| **D1-SO-2** Plan-wide Exec Summary | **DISTRIBUTE** | **[563]** → `2449721` · **[566]** → `2450060` · **[567]** → `2450098` · **[568]** → `2463655` · **[564]/[565] skipped as duplicative** |
| **D1-SO-3** Background | **DISTRIBUTE** | **[590]+[591]** → `2449714` · **[592]** → `2449721` · **[593]+[598]** → `2449737` · **[594], [599]–[602], Table 1 skipped as 44 CFR boilerplate** |
| **D1-SO-4** Formal Adoption | **MERGE** | **[572]** → `2463655`, after [1919] and [568]; non-duplicative resolution detail only |
| **D1-SO-5** Letter from the Director | C1-revised | **SKIP** — [588] is a drafting placeholder. Punch-listed for the signed letter |
| **D1-SO-6** Risk Assessment Terms | **SKIP** | Per county; **raise with AVAIL** as a shared `LHMP_IA` glossary card on The Risk |
| **D1-SO-7** Track Progress `2450116` | unchanged | stays empty |

**Emission order verified on every multi-fill slot** (M-list order in `build_crosswalk.py` controls it):

| Slot | Order |
|---|---|
| `2449721` The Plan > Exec Summary | [563] → [592] |
| `2450060` Capabilities > Planning & Regulatory LC | [566] → [1844] → [1851] |
| `2450098` Strategies > Overview LC | [567] → [1783]S1 |
| `2463655` About the Process > Adoption LC | [1919] → [568] → [572] |
| `2449737` About the Process > Overview LC | [1881] → [593]+[598] |
| `2449714` The Local Environment > Exec Summary | [590]+[591] |

Three previously-empty chapter landing slots now receive content: **`2449714`**, **`2449721`**,
**`2450098`**.

**Crosswalk after all decisions:** 275 rows · **HIGH 180 · MEDIUM 13 · SKIP 10 · EMPTY 71 ·
GAP 0 · PARTIAL 0 · LOW 0** · **177 slots** receive content · **187 doc sections** mapped.

**Character accounting.** The generated total (358,881) **double-counts** the paragraph-level splits,
because a doc section mapped to *n* slots contributes its full length *n* times ([562] ×4, [589] ×3,
[1783] ×2). Distinct-section total is **337,837**, and even that is an **upper bound** — it counts
all of [562] and [589] although paragraphs are skipped from both. The fill spec carries the exact
per-paragraph text; treat these numbers as routing metadata, not a byte ledger.

### Resulting template change list

All on `county_template` (**1300890**); propagate per
[`propagating-county-template-changes-to-duplicates.md`](../../skills/propagating-county-template-changes-to-duplicates.md).

| # | Page | Change | Driven by |
|--:|---|---|---|
| 1 | Capabilities Assessment `1425510` | Add page-opening `Local Context` Annotation + Inline Guidance at order 2 | D1-SO-1 |
| 2 | Home | Add a `County Message` Annotation after order 2 | D1-SO-5 |
| 3 | The Plan `2449721` | Its Inline Guidance is blank (literally just "Local Guidance") while every peer landing page carries 900+ chars. Write it: this is the plan-wide executive summary. | D1-SO-2 |
| 4 | Extreme Cold / Snowstorm / Wind | The three missing hazard Annotations | D2 |
| 5 | NFIP `2450153`, Built Environment `2449901` | Replace the two stale / copy-pasted guidance blocks | D9 |
| 6 | Jurisdictional Annex page | Add Cards for the three orphan Jurisdictions lexical columns — `nfip` after the Risk Card, `lhmp_dams` after Critical Infrastructure, `demographics_description` after Jurisdictional Profile | [annex D-A7](./westchester-annex-crosswalk.md#d-a7--surface-the-three-orphan-columns--specified-blocked-on-d8) |

### Sign-off

- [x] **C1** — **no `county_template` changes.** Fit into existing grey boxes. Set 2026-09-08.
- [x] **C2** — **never write into SHMP-sourced-content sections.** Set 2026-09-08.
- [x] **D1-SO** — **ALL DECIDED 2026-09-08.** SO-2 distribute, SO-3 distribute, SO-4 merge,
      SO-6 skip; SO-1 and SO-5 settled by C1. **`GAP` 5 → 0, `PARTIAL` 1 → 0.**
- [x] ~~Template changes 1–3 approved for `county_template`~~ — **withdrawn by C1.**
- [x] **D3** — **decided 2026-09-08:** both [1725] and [1730] into **`2449756`**, the Local Context
      Annotation on Climate Change page `2448369`, [1730] under an SSP sub-heading. Matches the
      recommendation. `2449734` untouched.
- [x] **D4** — **all 5 decided 2026-09-08.** [609] → `2449856`, [643] → `2453621`,
      [1825] → `2450067`, [1783] → **split** `2450098` + `2450104`, [757] → `2449784`.
      **`LOW` confidence rows: 1 → 0.** The `2449792` statistics card was investigated and
      **deliberately left unfilled** — 5 of its 7 measures do not exist in the plan.
- [x] **D7** — **dropped 2026-09-08.** Not a concern; the six slots stay empty. No IEM referral.

## Fill spec — BUILT 2026-09-08

`scripts/build_fill_spec.py` → `out/fill_spec.json` (machine) + `out/fill_spec.md` (reviewable).

| | |
|---|--:|
| Slots in spec | **177** |
| Characters | **334,761** |
| Blocks | **621** |
| Slots with >1 source | 13 |
| h3 lead-ins | 13 |
| `<ul>` blocks | 6 |
| Unresolved | **0** |
| Lead-in check | **clean** |

### How blocks are produced

Verbatim from `sections.json`; nothing reworded. Block shape matches `lexical.mjs`
`buildRootBlocks2` — `{t:"p"|"h"|"ul"}`. Page components take the **`{text:{root}}`** wrapper (dataset
columns take a bare root — that difference is why the annex path and this one are not interchangeable).

- **The document's own styling decides list markup.** `Bullet 1` and `List Paragraph` become `<ul>`
  items; every other style stays a paragraph. Verified across all 187 mapped sections: 641 paragraphs,
  styles `Body Text` 561 / `Normal` 50 / `Bullet 1` 15 / `List Paragraph` 13 / `Normal (Web)` 2 — no
  captions, no tables. **We never invent list structure the document doesn't have** (which is why
  [844]'s probability/severity scales stay as paragraphs, as the doc writes them).
- **`PARA_RULES`** restricts a (section → slot) pair to named paragraphs — the D1-SO-2/-3 and D4
  distributions.
- **`SENT_RULES`** splits [1784] at its first sentence boundary for the [1783] split; both halves
  verified non-empty and correctly assigned.
- **`LEAD_INS`** adds an h3 where sources merge.

### The lead-in defect the build caught

First run emitted 9 lead-ins and produced a real bug: on four slots a heading sat above one source
while the **next** source followed unheaded, so the heading mislabelled it — e.g. "Demographic
Statistics" would have appeared to head [620]'s at-risk-population enumeration, and "Goals and
Objectives Defined" to head [1787]'s goals list.

**Rule now enforced by `check_lead_ins()`:** headed sources must form a **contiguous suffix** — once
one source carries an h3, every later source in that box must too. That admits the three intended
shapes and rejects only the mislabelling case:

| Shape | Example |
|---|---|
| none headed — continuous prose | `2449856` ([610] *is* [620]'s topic sentence), `2450104`, `2449721`, `2450098` |
| only the last headed | `2453621`, `2449784`, `2449756`, `2450067`, `2449737`, `2463655` |
| unheaded intro, then all headed | `2450060` — [566] intro, then *About this Assessment* + *Planning and Regulatory Capabilities* |

Lead-ins added where a box genuinely merges distinct topics: `2449748` (three subsections, headed with
the document's own headings) and `2466023` Drought (the only hazard page where both *Overview* and
*General Vulnerability* merge into Local Hazard Summary).

### Pre-edit backup — `out/backups/slots_PRE.json`

`node backup_slots.mjs` (read-only). Three facts worth having on the record:

| Check | Result |
|---|---|
| Slots snapshotted | **177 / 177**, none unreadable |
| Already non-empty | **0** — the load overwrites nothing |
| `isCard === "Annotation"` | **177 / 177** — **C2 structurally satisfied**; not one shared Card or data component is in the target set |

## Load result — 2026-09-08

| | |
|---|--:|
| Slots written | **177 / 177** |
| Failed | **0** |
| Skipped | **0** |
| Characters live | **334,761** — exact match to the spec |
| Heading nodes | **13** — match |
| List nodes | **6** — match |
| Read-back clean | **177 / 177** |
| Target components in published `sections` | **0** |

Pipeline: `python build_crosswalk.py && python build_fill_spec.py && node backup_slots.mjs &&
node fill_slots.mjs --apply && node verify_slots.mjs`. Results in `out/fill_results.json`,
`out/verify_results.json`; pre-edit snapshot in `out/backups/slots_PRE.json`.

`verify_slots.mjs` is an **independent** re-fetch — it checks `element-type`, `isCard`, `status`,
`text.root` nesting, per-slot character count, block count, and heading/list node counts against the
spec. All matched.

**Nothing is published.** Verified structurally rather than assumed: across the 30 affected pages, all
177 written components appear in `draft_sections` and **none** appears in a page's published
`sections` list. Draft and published are separate component rows, so the public site is unchanged.
`status = local_review_needed` on every slot (per **C2**).

### The bug the canary caught — `{text:{root}}` vs `{root}`

Worth carrying into the skill. `lexical.mjs`'s `buildRootBlocks2()` returns the **bare root node**.

| Target | Shape |
|---|---|
| **Page component** `element-data` | **`{text: {root: <node>}}`** |
| **Dataset column** value (the annex path) | **`{root: <node>}`** |

Assigning the node straight to `ed.text` — which is what the annex-path habit produces — writes it
**one level too shallow**. The write returns success, `status` and `isCard` are set correctly, every
character is present, and the box still renders **empty**, because nothing resolves `text.root`.

Caught by writing **one** slot first and reading it back (`2449714`: `ed.text.type === 'root'`,
`chars: 0`, `children: undefined`). Re-written correctly and re-verified before the other 176 went.
**Canary one slot and read it back before any bulk component write** — a dry run cannot catch this,
because the dry run measures the node it built, not the shape it would store.

## Load conventions (unchanged from Schenectady / Delaware)

Per [`loading-a-plan-into-a-2.0-pattern.md`](../../skills/loading-a-plan-into-a-2.0-pattern.md):

- Write to **`draft_sections`** only, **`status: "local_review_needed"`** (changed 2026-09-08 per **C2** — *not* `shmp_sourced_content`, which mislabels county prose as State-plan content), **do not publish**.
- Faithful and verbatim — **invent nothing**. Where the doc has a placeholder, carry it and punch-list it.
- **Do not transcribe** data tables (the platform renders them from geoid-filtered sources) or generic
  FEMA / 44 CFR / methodology framing (shared `LHMP_IA` cards cover it).
- **Leave a slot empty rather than forcing a fit.**
- Rich-text formatting via `scripts/lexical.mjs` `mdToRoot`: leading and trailing empty paragraph;
  blank line between blocks except a heading hugs the block after it; lists carry `indent: 1`;
  markdown links become real `link` nodes; bold defined terms and lead-in labels.
- Back up every target component's pre-edit `element-data` before writing; dry-run first.

## Next steps

- [ ] **Owner sign-off on D1-SO, D3, D4 and D7** — see
      [Orphan-content disposition](#orphan-content-disposition--recommended-pending-owner-sign-off).
      Recommendations are written; the load spec follows whatever is ticked there.
- [~] **Fix D8 before the workbook load** — **partly done, verified live 2026-09-08:**
      - [x] `filters` now `{"*":[{"searchKey":"geoid","values":"36119"}]}` — the Sullivan `36105`
            placeholder is gone.
      - [x] `authPermissions` present, but **not** the template's value: it reads
            `{"*":"{\"users\":{\"16\":[\"*\"]},\"groups\":{\"public\":[\"view-page\"],\"AVAIL\":[\"*\"]}}"}`,
            i.e. **missing the `DHSES` and `LHMP Template Editor` groups** that 1300890 grants `*`.
            All 49 pages read back fine now, so it unblocks the load — but DHSES editors have no
            access until those two groups are added.
      - [ ] `additionalSectionAttributes` **still absent.** Copy from 1300890 before the load, or the
            `status: shmp_sourced_content` this pass writes won't render in the admin UI.
- [ ] **Author the fill spec** — `{id, md, status}` per slot, from `out/crosswalk.json`.
- [ ] **Back up, dry-run, apply** to `draft_sections` on the ~174 target slots.
- [ ] **Re-run `build_inventory.mjs`** to verify filled counts against the crosswalk.
- [ ] Then: jurisdictional annexes → Jurisdictions dataset (45 annex docx files, separate pass).
- [ ] Report D2 and D9 as `county_template` findings for propagation to all duplicates.
- [ ] Write `skills/profiles/iem.md` — third consultant profile, and the first "authored against 2.0" one.

---

## The crosswalk, page by page

`doc_block` = the paragraph/heading index in `out/baseplan/blocks.json` (use
`python scripts/sec.py <n>` to print that section's text). `draft_section` = the Annotation component
id to write. `ord` = its index in the page's `draft_sections`.

<!-- BEGIN GENERATED: out/crosswalk_tables.md -->
### front matter / no target

| Doc block | Doc heading | chars | → draft_section | Slot title | ord | Conf. | Notes |
|---|---|--:|---|---|--:|---|---|
| [562] | H2 Executive Summary | 3983 | — | — | — | **GAP** | Plan-wide Executive Summary. No plan-wide Annotation exists; the Home page Annotations are nav cards. Owner decision: nearest homes are The Plan Executive Summary 2449721, or a new Home component. |
| [569] | H1 Formal Approval by FEMA | 230 | — | — | — | Skip | FEMA approval placeholder ("will be completed following review by DHSES and FEMA Region 2"). No content yet. |
| [572] | H2 Formal Adoption by Westchester County and Participating Jurisdictions | 609 | — | — | — | **GAP** | Formal Adoption narrative. Closest slot is About the Process 2463655 (adoption Local Context), already claimed by doc [1919]. Owner decision: merge with [1919], or a new component. |
| [575] | H2 Assurances of Continued Compliance with Federal Regulations | 1834 | — | — | — | Skip | Assurances of Continued Compliance - generic Stafford Act / DMA 2000 / 44 CFR 201 framing. Shared LHMP_IA cards cover this; do not transcribe. |
| [580] | H2 Letter from the Director | 2150 | — | — | — | **GAP** | Letter from the Director - county-specific, no platform slot. Owner decision: new component on Home or The Plan. |
| [589] | H2 Background | 4298 | — | — | — | **Partial** | Background. Paras 590-593 and 598 are county-specific (45 jurisdictions, 430.8 sq mi, coterminous town-villages, what changed since the last plan). Paras 594 and 599-602 plus Table 1 are 44 CFR boilerplate - skip. Owner decision on target: The Plan Executive Summary 2449721, or About the Process 2449737. |
| [842] | H4 Risk Assessment Terms | 888 | — | — | — | **GAP** | Risk Assessment Terms (hazard / exposure / vulnerability / consequence / risk definitions). Generic glossary, no slot. Recommend SKIP, or append to 2465617. |
| [878] | H4 Countywide Hazard Summary Matrix | 284 | — | — | — | Skip | Countywide Hazard Summary Matrix - a source-citation line for a table the platform renders itself. Do not transcribe. |
| [1843] | H4 Overview | 1317 | — | — | — | **GAP** | Capabilities Assessment > Overview (the four-capability framing). Page order 1 is a data Card "Overview"; the first Annotation is order 5 (Planning and Regulatory). No page-level Annotation exists. Recommend PREPEND to 2450060, or request a page-overview Annotation. |
| [1956] | H1 Appendix A: Plan Adoption Documentation | 157 | — | — | — | Skip | Appendix A placeholder (one sentence, "as those materials are completed"). Appendices are document artifacts, not pattern content. |
| [1958] | H2 Adoption Resolutions | 100 | — | — | — | Skip | Appendix A > Adoption Resolutions placeholder. |
| [1960] | H3 Participating-Jurisdiction Adoption Status | 138 | — | — | — | Skip | Appendix A > Participating-Jurisdiction Adoption Status placeholder. |
| [1962] | H4 FEMA Approval Documentation | 122 | — | — | — | Skip | Appendix A > FEMA Approval Documentation placeholder. |
| [1964] | H1 Appendix B: Public Comment Log and Response | 140 | — | — | — | Skip | Appendix B placeholder. |

### The Local Environment  ·  page `2448368`  ·  [/the_local_environment](https://westchester-2026.mitigateny.org/the_local_environment)

**Slots to leave empty**

| draft_section | Slot title | ord | Why |
|---|---|--:|---|
| `2449714` | Executive Summary | 4 | The Local Environment > Executive Summary: the doc has no chapter-level exec summary for The Local Environment. Leave empty, or take it from doc [562]. |

### People and Communities  ·  page `2448360`  ·  [/the_local_environment/people_and_communities](https://westchester-2026.mitigateny.org/the_local_environment/people_and_communities)

| Doc block | Doc heading | chars | → draft_section | Slot title | ord | Conf. | Notes |
|---|---|--:|---|---|--:|---|---|
| [605] | H4 Local Context | 1970 | `2454034` | Local Context | 3 | High | People and Communities Overview > Local Context -> page Local Context (order 3). Title, position and guidance all agree. |
| [609] | H4 Demographic Statistics | 2432 | `2454034` | Local Context | 3 | Medium | Demographic Statistics prose. Platform order 4 is a data Card with no adjacent Annotation. Recommend APPEND to 2454034 under a bold "Demographic Statistics" lead-in. |
| [620] | H5 Local Populations at Highest Risk | 6470 | `2449856` | Local Populations at Highest Risk | 8 | High | Exact title match, order 8. |
| [630] | H5 Transient and Seasonal Populations at Risk | 2103 | `2449861` | Transient and Seasonal Populations at Risk | 10 | High | Exact title match, order 10. |
| [638] | H4 Population Change | 1951 | `2453621` | Population Change | 18 | High | Exact title match, order 18. |
| [643] | H4 Future Population Projections | 1318 | `2453621` | Population Change | 18 | Medium | Future Population Projections. No own slot; 2453621 guidance explicitly asks to "Consider future/projected population growth". Recommend APPEND to 2453621. |
| [648] | H4 Local Context | 2231 | `2449862` | Local Context | 20 | High | Economic and Development Trends > Local Context -> Local Context order 20 (guidance = economic / development). |
| [654] | H3 Governance Structure | 431 | `2449864` | Governance Structure  | 22 | High | Governance Structure -> "Governance Structure " order 22. |
| [660] | H4 Local Context | 1124 | `2449877` | Local Context | 29 | High | Neighboring Communities > Local Context -> Local Context order 29 (guidance = neighboring communities). |

**Slots to leave empty**

| draft_section | Slot title | ord | Why |
|---|---|--:|---|
| `2449870` | Special Districts | 25 | Special Districts (order 25): doc [657]/[658] carry no prose. Leave empty or hide. |

### Built Environment  ·  page `2448363`  ·  [/the_local_environment/built_environment](https://westchester-2026.mitigateny.org/the_local_environment/built_environment)

| Doc block | Doc heading | chars | → draft_section | Slot title | ord | Conf. | Notes |
|---|---|--:|---|---|--:|---|---|
| [665] | H4 Local Context | 2616 | `2449884` | Local Context | 4 | High | Overview > Local Context -> Local Context order 4 (big-picture built environment). |
| [671] | H4 Local Context | 3599 | `2449882` | Local Context | 8 | High | Critical Buildings and Infrastructure > Local Context -> Local Context order 8. |
| [685] | H5 Local Context | 910 | `2458839` | Local Context | 12 | High | Infrastructure > Local Context -> Local Context order 12 (guidance = broad infrastructure overview). |
| [689] | H5 Local Context | 2211 | `2449888` | Local Context | 15 | High | Water Infrastructure > Local Context -> Local Context order 15 (guidance = water conveyance / supply). |
| [695] | H5 Local Context | 2210 | `2449895` | Local Context | 19 | High | Transportation > Local Context -> Local Context order 19 (guidance = transportation). |
| [700] | H5 Local Context | 2391 | `2449905` | Local Context | 22 | High | Energy > Local Context -> Local Context order 22 (guidance = energy). |
| [706] | H5 Local Context | 1791 | `2449899` | Local Context | 25 | High | Communications > Local Context -> Local Context order 25 (guidance = communications). |
| [710] | H4 Local Context | 1633 | `2449901` | Local Context | 28 | High | Buildings > Local Context -> Local Context order 28. NOTE: 2449901 guidance text is a duplicate of 2449882 (template defect), but its position on the page is Buildings. |
| [716] | H4 Historic Properties | 1684 | `2449908` | Historic Properties | 32 | High | Historic Properties -> "Historic Properties" order 32. |
| [721] | H5 What Has Changed | 1556 | `2449913` | What's Changed | 37 | High | Changes in Development > What Has Changed -> "What's Changed" order 37. |
| [735] | H5 Codes Enforcement | 1670 | `2449918` | Codes Enforcement | 43 | High | Codes Enforcement -> "Codes Enforcement" order 43. The two source tables (Code-Enforcement Responsibilities, Countywide and Local Planning Capabilities) are platform data - narrate, do not transcribe. |
| [743] | H5 National Flood Insurance Program (NFIP) | 1132 | `2449915` | National Flood Insurance Program (NFIP) | 45 | High | Codes and Enforcement > National Flood Insurance Program (NFIP) -> "National Flood Insurance Program (NFIP)" order 45. |

### Natural Environment  ·  page `2448342`  ·  [/the_local_environment/natural_environment](https://westchester-2026.mitigateny.org/the_local_environment/natural_environment)

| Doc block | Doc heading | chars | → draft_section | Slot title | ord | Conf. | Notes |
|---|---|--:|---|---|--:|---|---|
| [751] | H4 Local Context | 1844 | `2449784` | Local Context | 3 | High | Overview > Local Context -> Local Context order 3. |
| [757] | H4 Open Space Parcel Statistics | 979 | `2464950` | County Open Space Plan | 10 | Low | Open Space Parcel Statistics narrates a source table. No matching slot. Recommend PREPEND to 2464950 (County Open Space Plan), or drop as data narration. Owner decision. |
| [762] | H5 County Open Space Plan | 1434 | `2464950` | County Open Space Plan | 10 | High | County Open Space Plan -> "County Open Space Plan" order 10. |
| [773] | H4 Firewise Communities | 500 | `2449798` | Firewise Communities  | 17 | High | Firewise Communities -> "Firewise Communities " order 17. |
| [776] | H4 Local Context | 1162 | `2449802` | Local Context | 21 | High | Water and Air > Local Context -> Local Context order 21 (guidance = water and air). |
| [781] | H4 Water Quality | 1448 | `2449807` | Water Quality | 24 | High | Water Quality -> "Water Quality" order 24. |
| [784] | H4 Air Quality | 2403 | `2449810` | Air Quality | 25 | High | Air Quality -> "Air Quality" order 25. |
| [790] | H4 Local Context | 1625 | `2449814` | Local Context | 28 | High | Wildlife > Local Context -> Local Context order 28 (guidance = wildlife). |
| [794] | H4 Forestry Local Context | 1959 | `2449809` | Forestry Local Context | 31 | High | Forestry Local Context -> "Forestry Local Context" order 31. |

**Slots to leave empty**

| draft_section | Slot title | ord | Why |
|---|---|--:|---|
| `2449796` | Local Context | 15 | Buyouts/Acquisitions Local Context (order 15): doc [770]/[772] empty. Leave empty or hide. |

### NFIP - Floodplain Management  ·  page `2448353`  ·  [/the_local_environment/nfip_floodplain_management](https://westchester-2026.mitigateny.org/the_local_environment/nfip_floodplain_management)

| Doc block | Doc heading | chars | → draft_section | Slot title | ord | Conf. | Notes |
|---|---|--:|---|---|--:|---|---|
| [802] | H4 NFIP Participation Summary | 1650 | `2450152` | NFIP Participation Summary | 3 | High | NFIP Participation Summary -> exact title match, order 3. |
| [810] | H5 Local Context | 1790 | `2450153` | Local Context | 10 | High | Floodplain Administrators > Local Context -> Local Context order 10, which sits directly after the "Floodplain Administrators" Card (order 7). NOTE: 2450153 guidance still reads "latest Flood Insurance Rate Map" - stale guidance, a template defect, not a mapping problem. |
| [817] | H3 Community Rating System | 1264 | `2450162` | Community Rating System | 16 | High | Community Rating System -> exact title match, order 16. |

### High Hazard Dams  ·  page `2448352`  ·  [/the_local_environment/high_hazard_dams](https://westchester-2026.mitigateny.org/the_local_environment/high_hazard_dams)

| Doc block | Doc heading | chars | → draft_section | Slot title | ord | Conf. | Notes |
|---|---|--:|---|---|--:|---|---|
| [825] | H4 Local Context | 3153 | `2449750` | Local Context | 5 | High | Overview > Local Context -> the page's single Local Context, order 5. |

### The Risk  ·  page `2448388`  ·  [/the_risk](https://westchester-2026.mitigateny.org/the_risk)

| Doc block | Doc heading | chars | → draft_section | Slot title | ord | Conf. | Notes |
|---|---|--:|---|---|--:|---|---|
| [838] | H3 Executive Summary | 2146 | `2465617` | Executive Summary | 3 | High | The Risk > Executive Summary -> "Executive Summary" order 3. |
| [844] | H4 Risk Analysis Process Summary | 2908 | `2450266` | Risk Analysis Process Summary | 5 | High | Risk Analysis Process Summary -> exact title match, order 5. |

### Natural Hazards  ·  page `2448389`  ·  [/the_risk/natural_hazards](https://westchester-2026.mitigateny.org/the_risk/natural_hazards)

| Doc block | Doc heading | chars | → draft_section | Slot title | ord | Conf. | Notes |
|---|---|--:|---|---|--:|---|---|
| [873] | H4 Data Sources and Limitations | 2151 | `2465369` | Local Context | 9 | Medium | Data Sources and Limitations. Best fit is the Natural Hazards page Local Context order 9, whose guidance asks for "overall methodology ... outside data sources used in the methodology". Alternative: append to 2450266 on The Risk. |
| [884] | H4 Executive Summary | 1939 | `2465395` | Executive Summary | 2 | High | Natural Hazards > Overview > Executive Summary -> "Executive Summary" order 2. |

### Non-natural Hazards  ·  page `2448351`  ·  [/the_risk/non_natural_hazards](https://westchester-2026.mitigateny.org/the_risk/non_natural_hazards)

| Doc block | Doc heading | chars | → draft_section | Slot title | ord | Conf. | Notes |
|---|---|--:|---|---|--:|---|---|
| [1721] | H4 Local Context | 67 | `2450125` | Local Context | 4 | High | Single sentence: "Non-natural hazards were not evaluated as part of this Plan update." -> Local Context order 4. |

### Climate Change  ·  page `2448369`  ·  [/the_risk/climate_change](https://westchester-2026.mitigateny.org/the_risk/climate_change)

| Doc block | Doc heading | chars | → draft_section | Slot title | ord | Conf. | Notes |
|---|---|--:|---|---|--:|---|---|
| [1725] | H4 Local Context | 3382 | `2449756` | Local Context | 5 | High | Climate Change > Overview > Local Context -> the page's single Local Context, order 5. |
| [1730] | H3 Shared Socioeconomic Pathways | 9999 | `2449756` | Local Context | 5 | Medium | Shared Socioeconomic Pathways (9,999 ch / 14 paras). The page has only ONE Annotation. Recommend APPEND to 2449756 after [1725] under an SSP sub-heading. NOTE: order 12 on this page is a 21k-char shared "CLIMATE IMPACTS MATRIX" block (component 2449734) - do NOT write there. Owner decision: merge, or request a second Annotation. |

### Disasters  ·  page `2448338`  ·  [/the_risk/disasters](https://westchester-2026.mitigateny.org/the_risk/disasters)

| Doc block | Doc heading | chars | → draft_section | Slot title | ord | Conf. | Notes |
|---|---|--:|---|---|--:|---|---|
| [1751] | H4 Executive Summary | 7790 | `2450055` | Executive Summary | 3 | High | Presidential Disasters > Executive Summary -> "Executive Summary" order 3 (guidance = presidential disaster declarations). |
| [1762] | H4 Local Context | 5192 | `2450057` | Local Context | 7 | High | State Emergency Declarations > Local Context -> Local Context order 7 (guidance = state emergency declarations). |
| [1770] | H4 Local Context | 5363 | `2450061` | Local Context | 10 | High | Local Emergency Declarations > Local Context -> Local Context order 10 (guidance = local emergency declarations). |

### Avalanche (not profiled)  ·  page `2448386`  ·  [/the_risk/natural_hazards/avalanche](https://westchester-2026.mitigateny.org/the_risk/natural_hazards/avalanche)

_Leave empty (no source prose):_ Local Hazard Summary `2466021`, Declarations and Their Effects on the County `2454748`, Featured Event `2454749`, County Assessment `2454754`, Jurisdictional Assessment `2454758`, Built Environment - Local Risk Summary `2466037`, People and Communities - Local Risk Summary `2466039`, Natural Environment - Local Risk Summary `2454777`, Local Capabilities `2454784`, Local Actions `2454797`, Featured Strategy `2454811`

### Coastal Hazards  ·  page `2448355`  ·  [/the_risk/natural_hazards/coastal_hazards](https://westchester-2026.mitigateny.org/the_risk/natural_hazards/coastal_hazards)

| Doc block | Doc heading | chars | → draft_section | Slot title | ord | Conf. | Notes |
|---|---|--:|---|---|--:|---|---|
| [927] | H4 General Vulnerability | 5722 | `2466032` | Local Hazard Summary | 9 | High | Doc "General Vulnerability" and slot "Local Hazard Summary" carry the same 44 CFR tags (B2-a, B2-b) and the same position (before the historic-occurrence data block). Platform order 10 Card "General Vulnerability" is data, not prose. |
| [947] | H5 Declarations and Their Effects on the County | 2479 | `2450488` | Declarations and Their Effects on the County | 29 | High | Exact title match. |
| [955] | H5 Featured Event | 1024 | `2450492` | Featured Event | 34 | High | Exact title match. |
| [960] | H4 County Assessment | 1528 | `2450496` | County Assessment | 37 | High | Exact title match. |
| [964] | H4 Jurisdictional Assessment | 2182 | `2450502` | Jurisdictional Assessment | 40 | High | Exact title match. |
| [972] | H5 Built Environment: Local Risk Summary | 1359 | `2466041` | Built Environment - Local Risk Summary | 47 | High | Title match (colon vs dash). |
| [976] | H5 People and Communities: Local Risk Summary | 2021 | `2466034` | People and Communities - Local Risk Summary | 50 | High | Title match (colon vs dash). |
| [981] | H5 Natural Environment: Local Risk Summary | 1213 | `2450514` | Natural Environment - Local Risk Summary | 53 | High | Title match (colon vs dash). |

_Leave empty (no source prose):_ Local Capabilities `2450531`, Local Actions `2450547`, Featured Strategy `2450566`

### Drought  ·  page `2448356`  ·  [/the_risk/natural_hazards/drought](https://westchester-2026.mitigateny.org/the_risk/natural_hazards/drought)

| Doc block | Doc heading | chars | → draft_section | Slot title | ord | Conf. | Notes |
|---|---|--:|---|---|--:|---|---|
| [993] | H4 Overview | 1498 | `2466023` | Local Hazard Summary | 9 | Medium | Doc "Overview" (Location / Extent / Probability / Data Limitations). Platform order 5 is a shared data Card of the same name; the nearest Annotation is "Local Hazard Summary" (order 9). Merge with "General Vulnerability" there. |
| [999] | H4 General Vulnerability | 2381 | `2466023` | Local Hazard Summary | 9 | High | Doc "General Vulnerability" and slot "Local Hazard Summary" carry the same 44 CFR tags (B2-a, B2-b) and the same position (before the historic-occurrence data block). Platform order 10 Card "General Vulnerability" is data, not prose. |
| [1011] | H5 Declarations and Their Effects on the County | 675 | `2451400` | Declarations and Their Effects on the County | 28 | High | Exact title match. |
| [1014] | H5 Featured Event | 520 | `2451415` | Featured Event | 33 | High | Exact title match. |
| [1017] | H4 County Assessment | 844 | `2451412` | County Assessment | 36 | High | Exact title match. |
| [1019] | H4 Jurisdictional Assessment | 1651 | `2451418` | Jurisdictional Assessment | 39 | High | Exact title match. |
| [1026] | H5 Built Environment: Local Risk Summary | 1413 | `2466018` | Built Environment - Local Risk Summary | 46 | High | Title match (colon vs dash). |
| [1030] | H5 People and Communities: Local Risk Summary | 1386 | `2451428` | People and Communities - Local Risk Summary | 49 | High | Title match (colon vs dash). |
| [1034] | H5 Natural Environment: Local Risk Summary | 829 | `2466020` | Natural Environment - Local Risk Summary | 52 | High | Title match (colon vs dash). |

_Leave empty (no source prose):_ Local Capabilities `2451438`, Local Actions `2451434`, Featured Strategy `2451444`

### Earthquake  ·  page `2448343`  ·  [/the_risk/natural_hazards/earthquake](https://westchester-2026.mitigateny.org/the_risk/natural_hazards/earthquake)

| Doc block | Doc heading | chars | → draft_section | Slot title | ord | Conf. | Notes |
|---|---|--:|---|---|--:|---|---|
| [1046] | H4 General Vulnerability | 1591 | `2466031` | Local Hazard Summary | 9 | High | Doc "General Vulnerability" and slot "Local Hazard Summary" carry the same 44 CFR tags (B2-a, B2-b) and the same position (before the historic-occurrence data block). Platform order 10 Card "General Vulnerability" is data, not prose. |
| [1059] | H5 Declarations and Their Effects on the County | 673 | `2450915` | Declarations and Their Effects on the County | 28 | High | Exact title match. |
| [1062] | H5 Featured Event | 1346 | `2450917` | Featured Event | 33 | High | Exact title match. |
| [1068] | H4 County Assessment | 3590 | `2450929` | County Assessment | 36 | High | Exact title match. |
| [1076] | H4 Jurisdictional Assessment | 1635 | `2450922` | Jurisdictional Assessment | 39 | High | Exact title match. |
| [1083] | H5 Built Environment: Local Risk Summary | 1576 | `2466035` | Built Environment - Local Risk Summary | 46 | High | Title match (colon vs dash). |
| [1087] | H5 People and Communities: Local Risk Summary | 1065 | `2450935` | People and Communities - Local Risk Summary | 49 | High | Title match (colon vs dash). |
| [1092] | H5 Natural Environment: Local Risk Summary | 976 | `2466036` | Natural Environment - Local Risk Summary | 52 | High | Title match (colon vs dash). |

_Leave empty (no source prose):_ Local Capabilities `2450932`, Local Actions `2451110`, Featured Strategy `2450939`

### Extreme Cold  ·  page `2448347`  ·  [/the_risk/natural_hazards/extreme_cold](https://westchester-2026.mitigateny.org/the_risk/natural_hazards/extreme_cold)

| Doc block | Doc heading | chars | → draft_section | Slot title | ord | Conf. | Notes |
|---|---|--:|---|---|--:|---|---|
| [1105] | H4 General Vulnerability | 1490 | `2466027` | Local Hazard Summary | 9 | High | Doc "General Vulnerability" and slot "Local Hazard Summary" carry the same 44 CFR tags (B2-a, B2-b) and the same position (before the historic-occurrence data block). Platform order 10 Card "General Vulnerability" is data, not prose. |
| [1118] | H5 Declarations and Their Effects on the County | 627 | `2450968` | Declarations and Their Effects on the County | 28 | High | Exact title match. |
| [1121] | H5 Featured Event | 1185 | `2450965` | Featured Event | 33 | High | Exact title match. |
| [1125] | H4 County Assessment | 3941 | `2450974` | County Assessment | 36 | High | Exact title match. |
| [1132] | H4 Jurisdictional Assessment | 1657 | `2450976` | Jurisdictional Assessment | 39 | High | Exact title match. |
| [1138] | H5 Built Environment: Local Risk Summary | 1560 | `2466038` | Built Environment - Local Risk Summary | 46 | High | Title match (colon vs dash). |
| [1143] | H5 People and Communities: Local Risk Summary | 1507 | `2450983` | People and Communities - Local Risk Summary | 49 | High | Title match (colon vs dash). |
| [1147] | H5 Natural Environment: Local Risk Summary | 819 | `2450979` | Natural Environment - Local Risk Summary | 52 | High | Title match (colon vs dash). |
| [1152] | H5 Local Capabilities | 610 | `2450989` | Local Capabilities | 57 | High | Exact title match. |

_Leave empty (no source prose):_ Featured Strategy `2450992`

### Extreme Heat  ·  page `2448393`  ·  [/the_risk/natural_hazards/extreme_heat](https://westchester-2026.mitigateny.org/the_risk/natural_hazards/extreme_heat)

| Doc block | Doc heading | chars | → draft_section | Slot title | ord | Conf. | Notes |
|---|---|--:|---|---|--:|---|---|
| [1160] | H4 General Vulnerability | 1617 | `2466030` | Local Hazard Summary | 9 | High | Doc "General Vulnerability" and slot "Local Hazard Summary" carry the same 44 CFR tags (B2-a, B2-b) and the same position (before the historic-occurrence data block). Platform order 10 Card "General Vulnerability" is data, not prose. |
| [1173] | H5 Declarations and Their Effects on the County | 620 | `2451014` | Declarations and Their Effects on the County | 28 | High | Exact title match. |
| [1177] | H5 Featured Event | 1070 | `2451026` | Featured Event | 33 | High | Exact title match. |
| [1180] | H4 County Assessment | 3732 | `2451021` | County Assessment | 36 | High | Exact title match. |
| [1190] | H4 Jurisdictional Assessment | 1411 | `2451023` | Jurisdictional Assessment | 39 | High | Exact title match. |
| [1196] | H5 Built Environment: Local Risk Summary | 1241 | `2466042` | Built Environment - Local Risk Summary | 46 | High | Title match (colon vs dash). |
| [1200] | H5 People and Communities: Local Risk Summary | 1208 | `2466043` | People and Communities - Local Risk Summary | 49 | High | Title match (colon vs dash). |
| [1204] | H5 Natural Environment: Local Risk Summary | 728 | `2451316` | Natural Environment - Local Risk Summary | 52 | High | Title match (colon vs dash). |

_Leave empty (no source prose):_ Local Capabilities `2451330`, Local Actions `2451326`, Featured Strategy `2451327`

### Flooding  ·  page `2448350`  ·  [/the_risk/natural_hazards/flooding](https://westchester-2026.mitigateny.org/the_risk/natural_hazards/flooding)

| Doc block | Doc heading | chars | → draft_section | Slot title | ord | Conf. | Notes |
|---|---|--:|---|---|--:|---|---|
| [1216] | H4 General Vulnerability | 2379 | `2465969` | Local Hazard Summary | 9 | High | Doc "General Vulnerability" and slot "Local Hazard Summary" carry the same 44 CFR tags (B2-a, B2-b) and the same position (before the historic-occurrence data block). Platform order 10 Card "General Vulnerability" is data, not prose. |
| [1229] | H5 Declarations and Their Effects on the County | 3113 | `2450681` | Declarations and Their Effects on the County | 29 | High | Exact title match. |
| [1236] | H5 Featured Event | 2044 | `2450687` | Featured Event | 34 | High | Exact title match. |
| [1241] | H4 County Assessment | 4813 | `2450688` | County Assessment | 37 | High | Exact title match. |
| [1249] | H4 Jurisdictional Assessment | 1567 | `2450684` | Jurisdictional Assessment | 40 | High | Exact title match. |
| [1256] | H5 Built Environment: Local Risk Summary | 2435 | `2450695` | Built Environment - Local Risk Summary | 51 | High | Title match (colon vs dash). |
| [1262] | H5 People and Communities: Local Risk Summary | 765 | `2466058` | People and Communities - Local Risk Summary | 54 | High | Title match (colon vs dash). |
| [1265] | H5 Natural Environment: Local Risk Summary | 759 | `2450696` | Natural Environment - Local Risk Summary | 57 | High | Title match (colon vs dash). |

_Leave empty (no source prose):_ (untitled) `2450692` **[pre-filled - do not overwrite]**, Local Capabilities `2450699`, Local Actions `2450750`, Featured Strategy `2450707`

### Hail  ·  page `2448348`  ·  [/the_risk/natural_hazards/hail](https://westchester-2026.mitigateny.org/the_risk/natural_hazards/hail)

| Doc block | Doc heading | chars | → draft_section | Slot title | ord | Conf. | Notes |
|---|---|--:|---|---|--:|---|---|
| [1285] | H5 Declarations and Their Effects on the County | 557 | `2451354` | Declarations and Their Effects on the County | 28 | High | Exact title match. |
| [1288] | H5 Featured Event | 578 | `2451358` | Featured Event | 33 | High | Exact title match. |
| [1291] | H4 County Assessment | 2007 | `2451361` | County Assessment | 36 | High | Exact title match. |
| [1296] | H4 Jurisdictional Assessment | 1367 | `2451364` | Jurisdictional Assessment | 39 | High | Exact title match. |
| [1303] | H5 Built Environment: Local Risk Summary | 884 | `2466051` | Built Environment - Local Risk Summary | 46 | High | Title match (colon vs dash). |
| [1306] | H5 People and Communities: Local Risk Summary | 926 | `2451371` | People and Communities - Local Risk Summary | 49 | High | Title match (colon vs dash). |
| [1310] | H5 Natural Environment: Local Risk Summary | 757 | `2451372` | Natural Environment - Local Risk Summary | 52 | High | Title match (colon vs dash). |

_Leave empty (no source prose):_ Local Hazard Summary `2466040`, Local Capabilities `2451377`, Local Actions `2451522`, Featured Strategy `2451375`

### Hurricane/Tropical Storm  ·  page `2448394`  ·  [/the_risk/natural_hazards/hurricane](https://westchester-2026.mitigateny.org/the_risk/natural_hazards/hurricane)

| Doc block | Doc heading | chars | → draft_section | Slot title | ord | Conf. | Notes |
|---|---|--:|---|---|--:|---|---|
| [1331] | H5 Declarations and Their Effects on the County | 3900 | `2451472` | Declarations and Their Effects on the County | 29 | High | Exact title match. |
| [1339] | H5 Featured Event | 473 | `2451482` | Featured Event | 34 | High | Exact title match. |
| [1342] | H4 County Assessment | 4278 | `2451478` | County Assessment | 37 | High | Exact title match. |
| [1351] | H4 Jurisdictional Assessment | 1932 | `2451481` | Jurisdictional Assessment | 40 | High | Exact title match. |
| [1359] | H5 Built Environment: Local Risk Summary | 2083 | `2466049` | Built Environment - Local Risk Summary | 47 | High | Title match (colon vs dash). |
| [1365] | H5 People and Communities: Local Risk Summary | 1459 | `2451490` | People and Communities - Local Risk Summary | 50 | High | Title match (colon vs dash). |
| [1369] | H5 Natural Environment: Local Risk Summary | 1002 | `2466052` | Natural Environment - Local Risk Summary | 53 | High | Title match (colon vs dash). |

_Leave empty (no source prose):_ Local Hazard Summary `2466048`, Local Capabilities `2451498`, Local Actions `2451524`, Featured Strategy `2451507`

### Ice Storm  ·  page `2448357`  ·  [/the_risk/natural_hazards/ice_storm](https://westchester-2026.mitigateny.org/the_risk/natural_hazards/ice_storm)

| Doc block | Doc heading | chars | → draft_section | Slot title | ord | Conf. | Notes |
|---|---|--:|---|---|--:|---|---|
| [1381] | H4 Overview | 219 | `2466047` | Local Hazard Summary | 9 | Medium | Doc "Overview" (Location / Extent / Probability / Data Limitations). Platform order 5 is a shared data Card of the same name; the nearest Annotation is "Local Hazard Summary" (order 9). Merge with "General Vulnerability" there. |
| [1391] | H5 Declarations and Their Effects on the County | 1069 | `2451826` | Declarations and Their Effects on the County | 28 | High | Exact title match. |
| [1395] | H5 Featured Event | 1266 | `2451822` | Featured Event | 33 | High | Exact title match. |
| [1400] | H4 County Assessment | 2561 | `2451825` | County Assessment | 36 | High | Exact title match. |
| [1406] | H4 Jurisdictional Assessment | 1393 | `2451833` | Jurisdictional Assessment | 39 | High | Exact title match. |
| [1414] | H5 Built Environment: Local Risk Summary | 2369 | `2466056` | Built Environment - Local Risk Summary | 46 | High | Title match (colon vs dash). |
| [1419] | H5 People and Communities: Local Risk Summary | 962 | `2451832` | People and Communities - Local Risk Summary | 49 | High | Title match (colon vs dash). |
| [1422] | H5 Natural Environment: Local Risk Summary | 528 | `2451841` | Natural Environment - Local Risk Summary | 52 | High | Title match (colon vs dash). |

_Leave empty (no source prose):_ Local Capabilities `2451837`, Local Actions `2451845`, Featured Strategy `2451852`

### Landslide  ·  page `2448358`  ·  [/the_risk/natural_hazards/landslide](https://westchester-2026.mitigateny.org/the_risk/natural_hazards/landslide)

| Doc block | Doc heading | chars | → draft_section | Slot title | ord | Conf. | Notes |
|---|---|--:|---|---|--:|---|---|
| [1442] | H5 Declarations and Their Effects on the County | 414 | `2451695` | Declarations and Their Effects on the County | 28 | High | Exact title match. |
| [1446] | H5 Featured Event | 1045 | `2451700` | Featured Event | 33 | High | Exact title match. |
| [1450] | H4 County Assessment | 3837 | `2451697` | County Assessment | 36 | High | Exact title match. |
| [1458] | H4 Jurisdictional Assessment | 2267 | `2451704` | Jurisdictional Assessment | 39 | High | Exact title match. |
| [1466] | H5 Built Environment: Local Risk Summary | 1137 | `2466054` | Built Environment - Local Risk Summary | 46 | High | Title match (colon vs dash). |
| [1469] | H5 People and Communities: Local Risk Summary | 832 | `2451714` | People and Communities - Local Risk Summary | 49 | High | Title match (colon vs dash). |
| [1472] | H5 Natural Environment: Local Risk Summary | 906 | `2451709` | Natural Environment - Local Risk Summary | 52 | High | Title match (colon vs dash). |

_Leave empty (no source prose):_ Local Hazard Summary `2466055`, Local Capabilities `2451720`, Local Actions `2451717`, Featured Strategy `2451725`

### Lightning  ·  page `2448349`  ·  [/the_risk/natural_hazards/lightning](https://westchester-2026.mitigateny.org/the_risk/natural_hazards/lightning)

| Doc block | Doc heading | chars | → draft_section | Slot title | ord | Conf. | Notes |
|---|---|--:|---|---|--:|---|---|
| [1492] | H5 Declarations and Their Effects on the County | 568 | `2451755` | Declarations and Their Effects on the County | 28 | High | Exact title match. |
| [1495] | H5 Featured Event | 508 | `2451751` | Featured Event | 33 | High | Exact title match. |
| [1497] | H4 Local Risk Assessment | 3292 | `2451746` | County Assessment | 36 | High | LIGHTNING ONLY: the doc has no "County Assessment" heading; the county-level assessment prose sits under H4 "Local Risk Assessment" instead. Platform order 35 is a plain lexical header of that name, so the target is the "County Assessment" Annotation. |
| [1503] | H4 Jurisdictional Assessment | 2823 | `2451760` | Jurisdictional Assessment | 39 | High | Exact title match. |
| [1510] | H5 Built Environment: Local Risk Summary | 1140 | `2466064` | Built Environment - Local Risk Summary | 46 | High | Title match (colon vs dash). |
| [1513] | H5 People and Communities: Local Risk Summary | 1271 | `2466065` | People and Communities - Local Risk Summary | 49 | High | Title match (colon vs dash). |
| [1516] | H5 Natural Environment: Local Risk Summary | 1015 | `2451767` | Natural Environment - Local Risk Summary | 52 | High | Title match (colon vs dash). |

_Leave empty (no source prose):_ Local Hazard Summary `2466050`, Local Capabilities `2451765`, Local Actions `2451771`, Featured Strategy `2451773`

### Snowstorm  ·  page `2448346`  ·  [/the_risk/natural_hazards/snowstorm](https://westchester-2026.mitigateny.org/the_risk/natural_hazards/snowstorm)

| Doc block | Doc heading | chars | → draft_section | Slot title | ord | Conf. | Notes |
|---|---|--:|---|---|--:|---|---|
| [1536] | H5 Declarations and Their Effects on the County | 916 | `2452202` | Declarations and Their Effects on the County | 27 | High | Exact title match. |
| [1541] | H5 Featured Event | 1104 | `2452200` | Featured Event | 32 | High | Exact title match. |
| [1545] | H4 County Assessment | 3945 | `2452212` | County Assessment | 35 | High | Exact title match. |
| [1553] | H4 Jurisdictional Assessment | 2776 | `2452207` | Jurisdictional Assessment | 38 | High | Exact title match. |
| [1560] | H5 Built Environment: Local Risk Summary | 1043 | `2466062` | Built Environment - Local Risk Summary | 45 | High | Title match (colon vs dash). |
| [1563] | H5 People and Communities: Local Risk Summary | 855 | `2466071` | People and Communities - Local Risk Summary | 48 | High | Title match (colon vs dash). |
| [1566] | H5 Natural Environment: Local Risk Summary | 757 | `2452216` | Natural Environment - Local Risk Summary | 51 | High | Title match (colon vs dash). |

_Leave empty (no source prose):_ Local Capabilities `2452229`, Local Actions `2452225`, Featured Strategy `2452227`

### Tornado  ·  page `2448387`  ·  [/the_risk/natural_hazards/tornado](https://westchester-2026.mitigateny.org/the_risk/natural_hazards/tornado)

| Doc block | Doc heading | chars | → draft_section | Slot title | ord | Conf. | Notes |
|---|---|--:|---|---|--:|---|---|
| [1590] | H4 County Assessment | 4191 | `2452055` | County Assessment | 36 | High | Exact title match. |
| [1598] | H4 Jurisdictional Assessment | 2159 | `2452053` | Jurisdictional Assessment | 39 | High | Exact title match. |
| [1605] | H5 Built Environment: Local Risk Summary | 1546 | `2466072` | Built Environment - Local Risk Summary | 46 | High | Title match (colon vs dash). |
| [1609] | H5 People and Communities: Local Risk Summary | 1528 | `2452057` | People and Communities - Local Risk Summary | 49 | High | Title match (colon vs dash). |
| [1613] | H5 Natural Environment: Local Risk Summary | 1172 | `2452068` | Natural Environment - Local Risk Summary | 52 | High | Title match (colon vs dash). |

_Leave empty (no source prose):_ Local Hazard Summary `2466059`, Declarations and Their Effects on the County `2451800`, Featured Event `2452047`, Local Capabilities `2452066`, Local Actions `2452071`, Featured Strategy `2452073`

### Wildfire  ·  page `2448390`  ·  [/the_risk/natural_hazards/wildfire](https://westchester-2026.mitigateny.org/the_risk/natural_hazards/wildfire)

| Doc block | Doc heading | chars | → draft_section | Slot title | ord | Conf. | Notes |
|---|---|--:|---|---|--:|---|---|
| [1625] | H4 Overview | 350 | `2466061` | Local Hazard Summary | 9 | Medium | Doc "Overview" (Location / Extent / Probability / Data Limitations). Platform order 5 is a shared data Card of the same name; the nearest Annotation is "Local Hazard Summary" (order 9). Merge with "General Vulnerability" there. |
| [1635] | H5 Declarations and Their Effects on the County | 598 | `2452101` | Declarations and Their Effects on the County | 28 | High | Exact title match. |
| [1640] | H4 County Assessment | 4484 | `2452111` | County Assessment | 36 | High | Exact title match. |
| [1649] | H4 Jurisdictional Assessment | 1714 | `2452112` | Jurisdictional Assessment | 39 | High | Exact title match. |
| [1655] | H5 Built Environment: Local Risk Summary | 1308 | `2466073` | Built Environment - Local Risk Summary | 46 | High | Title match (colon vs dash). |
| [1659] | H5 People and Communities: Local Risk Summary | 1367 | `2452113` | People and Communities - Local Risk Summary | 49 | High | Title match (colon vs dash). |
| [1663] | H5 Natural Environment: Local Risk Summary | 1415 | `2452115` | Natural Environment - Local Risk Summary | 52 | High | Title match (colon vs dash). |

_Leave empty (no source prose):_ Featured Event `2452108`, Local Capabilities `2452121`, Local Actions `2452124`, Featured Strategy `2452132`

### Wind  ·  page `2448391`  ·  [/the_risk/natural_hazards/wind](https://westchester-2026.mitigateny.org/the_risk/natural_hazards/wind)

| Doc block | Doc heading | chars | → draft_section | Slot title | ord | Conf. | Notes |
|---|---|--:|---|---|--:|---|---|
| [1688] | H4 County Assessment | 3664 | `2452155` | County Assessment | 33 | High | Exact title match. |
| [1693] | H4 Jurisdictional Assessment | 1711 | `2452159` | Jurisdictional Assessment | 36 | High | Exact title match. |
| [1700] | H5 Built Environment: Local Risk Summary | 1613 | `2466063` | Built Environment - Local Risk Summary | 43 | High | Title match (colon vs dash). |
| [1704] | H5 People and Communities: Local Risk Summary | 1456 | `2452162` | People and Communities - Local Risk Summary | 46 | High | Title match (colon vs dash). |
| [1708] | H5 Natural Environment: Local Risk Summary | 1338 | `2452158` | Natural Environment - Local Risk Summary | 49 | High | Title match (colon vs dash). |

_Leave empty (no source prose):_ Declarations and Their Effects on the County `2452150`, Featured Event `2452152`, Local Capabilities `2452164`, Local Actions `2452174`, Featured Strategy `2452168`

### The Plan  ·  page `2448344`  ·  [/the_plan](https://westchester-2026.mitigateny.org/the_plan)

**Slots to leave empty**

| draft_section | Slot title | ord | Why |
|---|---|--:|---|
| `2449721` | Executive Summary | 5 | The Plan > Executive Summary: candidate target for doc [562] and/or [589] - see those rows. |

### Strategies  ·  page `2448362`  ·  [/the_plan/strategies](https://westchester-2026.mitigateny.org/the_plan/strategies)

| Doc block | Doc heading | chars | → draft_section | Slot title | ord | Conf. | Notes |
|---|---|--:|---|---|--:|---|---|
| [1783] | H4 Goals and Objectives | 499 | `2450104` | County Goals and Objectives | 7 | Medium | Goals and Objectives - definitional lead-in to the goals list. Recommend PREPEND to 2450104 (County Goals and Objectives). Alternative: 2450098 (Strategies overview Local Context, order 3), which the doc leaves empty at [1782]. |
| [1787] | H4 County Goals and Objectives | 3973 | `2450104` | County Goals and Objectives | 7 | High | County Goals and Objectives -> exact title match, order 7. 26 paragraphs (goals plus objectives) - preserve the list structure. |
| [1815] | H5 Local Context | 2014 | `2450077` | Local Context | 10 | High | Action Development > Local Context -> Local Context order 10 (guidance = how strategies and actions were identified and prioritized). |
| [1818] | H4 Problem Area Identification | 810 | `2450179` | Problem Area Identification | 13 | High | Problem Area Identification -> exact title match, order 13. |
| [1820] | H4 Prioritization and Cost Evaluation | 775 | `2450072` | Prioritization & Cost Evaluation | 15 | High | Prioritization and Cost Evaluation -> "Prioritization & Cost Evaluation" order 15. |
| [1823] | H5 Funding Sources Local Context | 862 | `2450073` | Funding Sources Local context | 20 | High | Funding Sources Local Context -> exact title match, order 20. |
| [1825] | H5 Local Funding Capabilities | 675 | `2450073` | Funding Sources Local context | 20 | Medium | Local Funding Capabilities. Platform order 22 is a Spreadsheet of the same name with no adjacent Annotation. Recommend APPEND to 2450073. |
| [1827] | H4 Capabilities Highlights | 862 | `2450076` | Capabilities Highlights | 24 | High | Capabilities Highlights -> exact title match, order 24. |
| [1830] | H5 Local Context | 725 | `2450075` | Local Context | 27 | High | Implementation and Integration > Local Context -> Local Context order 27 (guidance = implementation over the last five years, plus forward intent). |
| [1832] | H5 Plan for Displaced Residents | 731 | `2450167` | Plan for Displaced Residents | 30 | High | Exact title match, order 30. |
| [1834] | H5 Temporary Housing and Relocation | 942 | `2450165` | Temporary Housing and Relocation | 32 | High | Exact title match, order 32. |
| [1836] | H5 Evacuation Procedures | 739 | `2450166` | Evacuation Procedures | 34 | High | Exact title match, order 34. |
| [1838] | H5 Shelters | 2407 | `2450169` | Shelters | 36 | High | Exact title match, order 36. |

### Capabilities Assessment  ·  page `2448392`  ·  [/the_plan/capabilities_assessment](https://westchester-2026.mitigateny.org/the_plan/capabilities_assessment)

| Doc block | Doc heading | chars | → draft_section | Slot title | ord | Conf. | Notes |
|---|---|--:|---|---|--:|---|---|
| [1851] | H5 Local Context | 2687 | `2450060` | Local Context | 5 | High | Planning and Regulatory Capabilities > Local Context -> Local Context order 5 (guidance = planning and regulatory). |
| [1857] | H5 Local Context | 2702 | `2450058` | Local Context | 11 | High | Administrative and Technical Capabilities > Local Context -> Local Context order 11 (guidance = administrative and technical). |
| [1863] | H5 Local Context | 2537 | `2450069` | Local Context | 17 | High | Education and Outreach > Local Context -> Local Context order 17 (guidance = education and outreach). |
| [1869] | H5 Local Context | 2453 | `2450067` | Local Context | 23 | High | Financial Capabilities > Local Context -> Local Context order 23 (guidance = financial). |

### About the Process  ·  page `2448364`  ·  [/the_plan/about_the_process](https://westchester-2026.mitigateny.org/the_plan/about_the_process)

| Doc block | Doc heading | chars | → draft_section | Slot title | ord | Conf. | Notes |
|---|---|--:|---|---|--:|---|---|
| [1881] | H4 Local Context | 1854 | `2449737` | Local Context | 3 | High | About the Process > Overview > Local Context -> Local Context order 3. |
| [1885] | H3 Other Related Planning Processes | 630 | `2449754` | Other Related Planning Processes | 5 | High | Other Related Planning Processes -> exact title match, order 5. |
| [1889] | H5 Jurisdictional Representation | 365 | `2465735` | Jurisdictional Representation | 10 | High | Jurisdictional Representation -> exact title match, order 10. Only 365 ch - thin against the guidance ask (representation statistics, gaps, who is and is not participating). |
| [1891] | H4 Jurisdictional Engagement Process | 1940 | `2449733` | Jurisdictional Engagement Process | 13 | High | Jurisdictional Engagement Process -> exact title match, order 13. |
| [1898] | H3 Stakeholder Outreach and Engagement | 1032 | `2449735` | Stakeholder Outreach and Engagement | 15 | High | Stakeholder Outreach and Engagement -> exact title match, order 15. |
| [1904] | H3 Public Participation | 1619 | `2449757` | Public Participation | 20 | High | Public Participation -> exact title match, order 20. |
| [1911] | H4 Public Comment | 403 | `2449758` | Public Comment | 22 | High | Public Comment -> exact title match, order 22. |
| [1919] | H3 Local Context | 1496 | `2463655` | Local Context | 32 | High | Adoption > Local Context -> Local Context order 32, whose guidance is explicitly the jurisdictional adoption process. |
| [1926] | H4 Monitoring and Progress Tracking | 788 | `2449748` | Monitoring, Evaluating, and Updating the Plan | 35 | High | Monitoring and Progress Tracking -> part of "Monitoring, Evaluating, and Updating the Plan" order 35. THREE doc subsections merge into this one slot (1 of 3). |
| [1929] | H4 Evaluating Method and Schedule | 891 | `2449748` | Monitoring, Evaluating, and Updating the Plan | 35 | High | Evaluating Method and Schedule -> same slot 2449748 (2 of 3). |
| [1936] | H4 Plan Updating Approach | 1111 | `2449748` | Monitoring, Evaluating, and Updating the Plan | 35 | High | Plan Updating Approach -> same slot 2449748 (3 of 3). |
| [1944] | H3 Plan for Integration with Other Plans | 2817 | `2449747` | Plan for Integration with Other Plans | 37 | High | Plan for Integration with Other Plans -> exact title match, order 37. |

**Slots to leave empty**

| draft_section | Slot title | ord | Why |
|---|---|--:|---|
| `2449738` | Organizational Structure - Planning Teams | 8 | Organizational Structure - Planning Teams (order 8): doc [1888] has the heading but no prose. Leave empty; flag to the consultant - planning-team structure belongs here. |
| `2449743` | Technical Data and Existing Resources | 25 | Technical Data and Existing Resources (order 25): doc [1915] empty. Leave empty; flag to the consultant. |
| `2449745` | Continued Public Engagement | 39 | Continued Public Engagement (order 39): the doc carries no matching prose. Leave empty; flag to the consultant (44 CFR 201.6(c)(4)(iii)). |

### Track Progress  ·  page `2448385`  ·  [/track_progress](https://westchester-2026.mitigateny.org/track_progress)

**Slots to leave empty**

| draft_section | Slot title | ord | Why |
|---|---|--:|---|
| `2450116` | Executive Summary | 3 | Track Progress > Executive Summary: the doc has no Track Progress chapter. Leave empty. |

### Annual Maintenance  ·  page `2448341`  ·  [/track_progress/annual_maintenance](https://westchester-2026.mitigateny.org/track_progress/annual_maintenance)

**Slots to leave empty**

| draft_section | Slot title | ord | Why |
|---|---|--:|---|
| `2452231` | Change Log | 4 | Annual Maintenance > Change Log: no doc source. Leave empty. |

<!-- END GENERATED -->
