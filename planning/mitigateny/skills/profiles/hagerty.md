# Consultant profile: Hagerty Consulting

Layer-2 profile for [`transcribing-a-consultant-plan.md`](../transcribing-a-consultant-plan.md).
Everything here is Hagerty-specific. The MNY target side and the method live in the parent skill.

**Counties seen:** Nassau (2020 plan, dated 2020-12-16, analyzed in depth 2026-08-20).
**Attribution:** confirmed in the base plan — *"The County contracted with Hagerty Consulting to
support the County in updating the Plan."* (An earlier note in
[`tetratech.md`](./tetratech.md) listed Nassau as Tetra Tech; that was wrong and has been corrected.)
**Reference annex:** `references/mny-transcribe/Nassau/All Annexes/01_CityofGlenCove/1_City of Glen Cove_Jurisdictional Annex.docx` (git-ignored)
**Crosswalk produced:** `references/mny-transcribe/Nassau/context/nassau-annex-crosswalk.csv` (git-ignored) — 185 mappings +
[`worked-examples/nassau-annex-crosswalk-report.md`](../worked-examples/nassau-annex-crosswalk-report.md)

---

## Classification: brief-and-prose-bearing

A Hagerty annex is **a short document with real prose and a thin data spine** — 9 tables and ~17 KB
of extracted text per jurisdiction, against Tetra Tech's ~30 tables and ~200 KB.

Consequence for targeting (Nassau, 185 mappings): Actions 64, Capabilities 29,
Hazards of Concern 26, Roles 24, Participation 9, **Jurisdictions 7**, no-target 23.

The trade against Tetra Tech, and the thing to internalise before planning a load:

| | Tetra Tech | Hagerty |
|---|---|---|
| Per-hazard vulnerability prose | Table F — one paragraph per hazard, the richest content in the annex | **none** — an impact-category checklist only |
| Municipality-profile prose | none | a real authored development-trends paragraph |
| Capability narrative | per-capability assessment columns | a per-*section* summary paragraph (4 per annex) |
| NFIP | Table O, 21 topic rows | 4 authored paragraphs |
| Prior-cycle actions | 13 fields each | 6 fields each (2 annexes: 7–8) |
| Consultant actions workbook | delivered | **not delivered — extract everything** |
| Word content-control checkboxes | ~1,150 per annex | **none** (plain-text `X` in one MAW cell) |

Identifying marks: only four paragraph styles corpus-wide (`Normal`, `Caption`, `Heading 1/2/3`);
tables are **transposed** (field labels in column 0); mitigation action worksheets ship as separate
`MAW<n>_<Jurisdiction>_FINAL.docx` files rather than inline; no `Tt*` styles and no `w:sdt`
checkboxes anywhere.

## Section spine

Twelve headings, identical in all 51 readable Nassau annexes. No numbering, no reordering,
no omissions by jurisdiction type — the most uniform corpus of the four counties handled so far.

1. `H1` **\<Jurisdiction\> Annex** — boilerplate intro sentence
2. `H2` **Hazard Mitigation Plan Points of Contact** — POC table
3. `H2` **Profile** — demographics table + authored development paragraph
4. `H2` **Hazard Vulnerability** — hazard-impacts table *(the heading itself carries content — see quirks)*
5. `H2` **Capability Assessment**
   - `H3` Legal and Regulatory Capability Assessment
   - `H3` Administrative and Technical Capability Assessment
   - `H3` Fiscal Capability Assessment
   - `H3` Community Classification Assessment
   - `H3` National Flood Insurance Program Summary *(prose only, no table)*
6. `H2` **Mitigation Strategy**
   - `H3` Previous Mitigation Actions
   - `H3` Proposed Mitigation Actions
   - `H3` Mitigation Action Worksheets *(pointer to the separate MAW files)*

## Table inventory

**Every table is transposed** except two named exceptions. Field labels live in **column 0**; each
*additional column* is one record. A `14x4` proposed-actions table holds **3** actions. Corpus counts
are `sum(cols - 1)`, never `sum(rows)`. Get this backwards and every count inverts.

The first seven tables are a fixed sequence of fixed shapes in all 51 annexes:

| # | Shape | Content | Disposition |
|---|---|---|---|
| — | 2x2 | Primary / Alternate Point of Contact, as labelless blobs | → **Roles** |
| 1 | 8x4 | Demographics — 7 vulnerability + 7 race/ethnicity percentages, **two label/value pairs side by side** | `auto-populated` |
| 2 | 12x2 | **Hazard impacts** — 11 hazards × comma-separated impact categories | → **HOC** booleans + `hazard_of_concern` + a derived `general_vulnerability` |
| 3 | 24x3 | Legal & regulatory tools (23 rows) — Tool / Yes-No / Citation | → **Capabilities**, `Plan-Guidance=TRUE` |
| 4 | 12x3 | Staff & technical resources (11 rows) — Resource / Yes-No / Details | → **Capabilities**, `Tool=TRUE` |
| 5 | 11x3 | Fiscal resources (10 rows) — Resource / Yes-No / Additional Details | → **Capabilities**, `Funding Source=TRUE` |
| 6 | 5x2 | Community classifications (4 rows: BCEGS, PPC, CRS, Other) | → **Capabilities**, `Program=TRUE` |

Then the two variable tables:

| Shape | Content | Disposition |
|---|---|---|
| `12x3` | **Completed actions**, transposed — **Woodsburgh only.** Same field set as the proposed table minus `Project Number` and `Priority Ranking`. Owner confirmed 2026-08-21: pull it and set `Implementation Status = Completed`; `Action Number` and `Local Priority` stay empty. | → **Actions** |
| `6xN` | **Prior-cycle actions**, transposed. Fields: `Action` (a sentence, no name or number), `Risk Category`, `Project Status`, `Project Status Description`, `Carried Forward to 2020 Plan`, `Required Changes` | → **Actions** |
| `14xN` | **Proposed actions**, transposed. Fields: `Project Number`, `Project Name`, `Goal being met`, `Hazards to be mitigated`, `Priority Ranking`, `Description of the Problem`, `Description of the Solution`, `Critical Facility`, `EHP Issues`, `Estimated Timeline`, `Lead Agency`, `Estimated Costs`, `Estimated Benefits`, `Potential Funding Sources` | → **Actions** |

The prior and proposed tables are **chunked** — a jurisdiction with 14 proposed actions gets three
`14xN` tables, not one. Sum across all of them.

For Tables 3–6 the pattern is uniform: row label → `Capability Name`, the Details/Citation column →
`Description`. Administering agency is always the jurisdiction itself, type `Local`.

**`No` is a filter only when the detail cell is empty** (owner, 2026-08-21 — the more detailed answer
wins):

```
No  + empty detail      => create no row
No  + non-empty detail  => CREATE the row, and log the override
Yes                     => create the row
```

Glen Cove hits this twice in one annex: Table 3 answers `No` for *NFIP Flood Damage Prevention
Ordinance* while the NFIP section cites *Chapter 154, L.L. No. 6-2009*; Table 4 answers `No` for
*Personnel trained in construction practices* while filling in *Director of Building Department*.
Both create capabilities. Test whether the answer **begins** with `No` — the values are not clean
Yes/No.

### The Mitigation Action Worksheet (MAW) files

One `MAW<n>_<Jurisdiction>_FINAL.docx` per worksheet, alongside the annex. The base plan requires
*"at least two"* per jurisdiction; the Nassau corpus has **142 `.docx` plus one PDF = 143** worksheets.

⚠ **Three counting traps, all found on 2026-08-21 and all silent:**

- **`^MAW\d+` is the wrong regex.** Williston Park's third worksheet is `MAW_3 NEW Williston
  Park.docx` — underscore after the prefix — so a strict match misses it *and* classifies it as an
  annex candidate. Use `^MAW[\d_]`, then reconcile against a loose `maw` substring count. Nassau:
  141 strict, 142 loose.
- **Garden City's two worksheets live in `archive/` only.** A top-level `os.listdir` reports zero
  worksheets for that jurisdiction.
- **Garden City's fourth worksheet is a PDF named after its project** —
  `VGC_4 Cedar Valley Sanitary Lift Station.pdf`, one page, text extracts fine. Nothing in the
  filename says "MAW".

Each file holds a `26x{8..12}` transposed NYS DHSES worksheet: Project Name/Number, Hazard of
Concern, Problem, Solution, Critical Facility, Level of Protection, Useful Life, Estimated Cost,
Estimated Benefits, Prioritization, Desired Timeframe, Estimated Time Required, Potential Funding
Sources, Responsible Organization, Local Planning Mechanisms, three Alternatives (action/cost/
evaluation), and an empty Progress Report block.

The MAW is the **only** source for `Existing Planning Mechanisms to be Used in Implementation` — a
field FEMA cares about — and its Problem/Solution narratives are consistently longer and more
specific than the annex table's. Prefer the MAW text where a MAW exists.

## Where the authored content is

Ranked by value:

1. **NFIP Summary** (4 paragraphs) — FPA responsibility, administration method, barriers, map
   accuracy, RiskMAP, substantial damage, NFIP standing, CAC/CAV dates, ordinance citation.
   → `nfip`. Clean fit, high value.
2. **Capability-summary paragraphs** (4 per annex, one per capability subsection) — what the
   jurisdiction has, what it lacks, why it matters. → `lhmp_capacity_to_implement`.
3. **Development-trends paragraph** (Profile, paragraph 2) — named projects, unit counts, floodplain
   overlap, 5-year retrospect and prospect. → `growth_and_development_trends`.
4. **MAW Problem/Solution narratives** — the richest action prose in the plan.
5. **Proposed-action Problem/Solution** in the `14xN` table — for the majority of actions with no MAW.
6. **Flood-prone-areas sentence** (NFIP paragraph 1) — specific named places. → `lhmp_problem_areas`.
7. **The "hazards that most impact" sentence**, hidden inside the Hazard Vulnerability heading.
   → `lhmp_risk_overview`.

**There is no per-hazard vulnerability prose and no per-capability mitigation narrative.** Two
required MNY fields — `Hazards of Concern.general_vulnerability` and
`Capabilities.Mitigation Connection` — have **no Hagerty source at all**. This is the inverse of Tetra
Tech, whose Table F was the single richest thing in an annex. Do not plan a load that assumes HOC
prose exists.

**Resolved (owner, 2026-08-21).** The two required fields are handled differently, and the reasoning
generalises to the next Hagerty county:

- `general_vulnerability` is **filled from Table 2's impact categories** as a derived sentence that
  declares its own derivation — *"\<Jurisdiction\> identified impacts from \<Hazard\> to: \<categories\>.
  (Derived from Table 2 of the 2020 annex; no narrative was authored.)"* Table 2 **is** a per-hazard
  vulnerability statement, just a structured one, so restating it is reporting rather than invention.
  The parenthetical is load-bearing: without it a synthesized field reads as authored prose.
- `Mitigation Connection` is **skipped**. The capability tables carry no mitigation-connection
  statement in any form, so there is nothing to restate and nothing will be composed.

## Extraction quirks

**No checkboxes.** Nothing in a Hagerty annex uses Word content controls, so plain `python-docx`
would work — but keep using `docx_outline2.py` anyway for its merged-cell handling. The one
checkbox-shaped field, the MAW's *"Is this project related to a Critical Facility?"*, is a **plain
text `X`** placed in one cell of a merged Yes/No grid. Find which cell holds the `X`.

**The Hazard Vulnerability heading carries content, doubled.** In 46 of 51 annexes the `Heading 2`
text is literally:

```
The hazards that most impact the City of Glen Cove include: Coastal Hazards, Flooding, and Wind.The hazards that most impact the City of Glen Cove include: Coastal Hazards, Flooding, and Wind.Hazard Vulnerability
```

The top-hazards sentence is emitted **twice**, then the real heading text. Five annexes (including
the county's own) have the clean heading and no sentence. The sentence's grammar also varies —
Massapequa Park reads *"The hazard that impacts the Village of Massapequa Park most is Flooding."*
De-duplicate the repeated sentence, strip the trailing `Hazard Vulnerability`, then parse.

**Match headings by suffix, not equality.** Because of the above, `== "Hazard Vulnerability"` matches
5 of 51 annexes. Use `endswith`.

**Every MAW `.docx` contains TWO tables.** Table 0 is the filled worksheet; table 1 is the blank NYS
DHSES **instructions template** whose cells read *"Provide a detailed narrative of the problem…"*.
Take table 0 only, or you load instruction text as authored content.

**MAW file numbering does not match project numbering.** Glen Cove's `MAW1` is project `CGC_3` and
`MAW2` is `CGC_2`. Join on the worksheet's `Project Number:` row, never on the filename.

**MAW and annex disagree constantly, and the WORKSHEET WINS** (owner, 2026-08-21 — set annex-first,
then reversed the same day on review: the worksheets are more detailed and more intentional).
Measured: **23 name disagreements** across 17 jurisdictions and **5 cost disagreements**, including
Great Neck Estates with `VGNE_1`/`VGNE_2` transposed. Glen Cove alone: *"Sea Cliff Ave Flood
Correction"* (worksheet) vs *"Sea Cliff Ave. Flood Mitigation"* (annex), *"Morgan Park Seawall"* vs
*"Morgan Park Sea Wall"*, and `Flood` vs `Flooding`.

**But it only governs 59% of the actions.** Only **137 of 234** proposed actions have a matching
worksheet; the other **97 take the annex value unchanged**. Worksheet fill rates where one exists are
near-total — 142/142 for Project Name, Hazard of Concern, Prioritization and Potential Funding
Sources; 141/142 for both narratives, Responsible Organization and Estimated Time Required; and only
59/142 for Local Planning Mechanisms.

**Cost needs a mechanical split.** `Estimated Cost ($)` is numeric live, and **72 of 142** worksheet
cost cells are not parseable numbers — ranges (`$10,000-$25,000`), rates (`$250/year`), bounds
(`Less than $1,000,000`), qualitative (`TBD`, `Unknown (Low)`, `Several million dollars`). Load the
worksheet text verbatim to `Cost Notes` and let the numeric slot fall back to the annex figure.

**A value cell that is empty must read empty, not borrow the next label.** `VRG_1` leaves Level of
Protection, Useful Life and Estimated Cost blank; walking right for "the next non-empty cell" returns
the *adjacent label*, so its cost read `"Estimated Benefits (losses avoided):"`. Harmless under
annex-precedence, load-affecting under worksheet-precedence. Stop the pair-walker at any cell ending
in `:`.

**The orphan cases are the ones the rule cannot touch.** Where a worksheet's project number has no
annex counterpart there is nothing to prefer. Four found, one since resolved:

| Jurisdiction | Failure | Status |
|---|---|---|
| Muttontown | worksheets `VMP_1/2` against an annex using `VMTT_1/2` | **resolved** — corrected to `VMTT_*` |
| Cove Neck | `VCN-1` vs `VCN_1` — hyphen for underscore | **resolved** — annex adopts the hyphen |
| Village of Hempstead | one worksheet numbered `"VOH_1, … VOH_8"` | **resolved** — a programme-level **roll-up**; its cost is exactly the sum of the eight, so precedence must NOT be applied |
| Oyster Bay (T) | `TOB_14` with no matching annex action | **resolved** — kept as a worksheet-only action; the annex stops at TOB_13 |

**A cheap test for roll-ups:** when one worksheet claims several project numbers, sum the component
costs. If the sum matches the worksheet cost it is a programme roll-up, and worksheet-precedence must
not overwrite the components — that would replace N specific projects with one generic description and
inflate the cost N-fold. Village of Hempstead: 100+180+120+70+95+155+155+130 = 1,005,000, exactly the
worksheet figure.

⚠ **Project numbers are unique only within a jurisdiction.** `VMP_1` and `VMP_2` are *genuine*
numbers in **Massapequa Park** and **Munsey Park** — all three of Munsey Park, Muttontown and
Massapequa Park abbreviate to `VMP`. So join worksheets on `(geoid, project_number)`, and key any
correction table on `(folder, wrong_number)`; a global fix would rewrite two other jurisdictions'
real actions. Muttontown's correction was verified three ways before applying — Responsible
Organization reads *"Village of Muttontown"*, project names match the annex, and the problem
narratives match near-verbatim.

**POC cells are labelless blobs.** One cell is
`Mayor Timothy Tenke, Mayor` + agency + street + city/state/ZIP + email + phone, newline-joined with
no field labels — unlike Tetra Tech, which at least labelled `Name/Title:` / `Phone Number:`. Parse
positionally: `<Name>, <Title>` on line 1, then agency, then address lines, then email and phone by
regex. The name frequently carries an honorific that duplicates the title.

**Merged cells inflate column counts.** Lynbrook's Table 4 reports `12x4` with a duplicated `Details`
header. De-duplicate horizontally merged cells by comparing the underlying `w:tc` element identity,
not the text.

**Trailing empty rows.** Long Beach's proposed-actions table is `15x8`, not `14x8`. Classify action
tables by their **column-0 label prefix** (`Project Number`, `Project Name`, …), never by row count.

**Action FIELD labels vary too, not just table shapes.** Two jurisdictions rename the priority field:
Bayville calls it **`Hazard Ranking`** and Sea Cliff **`PriorityRanking`** (no space). Both hold
`High`/`Medium`/`Low` — check the values before aliasing, since *Hazard* Ranking could plausibly have
held hazard names. Keying action records on the raw label drops `Local Priority` for those 7 actions
**silently**. Canonicalise labels whitespace-insensitively, keep an alias map, and record the original
label for provenance. A group-cohesion check that counts distinct key sets is what surfaces this.

**Footnote markers fuse into header cells.** Five annexes render the POC header as
`"1Primary Point of Contact"` — a superscript reference lands in the same run. Exact-match
classification drops the **entire contact table** with no error (92 contacts instead of 102). Strip
leading *and* trailing footnote digits before comparing any label.

**POC cells use `<w:br/>` line breaks, not paragraphs.** `python-docx`'s text join drops them, so the
cell reads `Mayor Timothy Tenke, MayorCity of Glen Cove9 Glen Street…` and cannot be split into
fields. Read line breaks explicitly — `annex_lib.cell_lines()`.

**Heading suffix-matching collapses the capability subsections.** `"Legal and Regulatory Capability
Assessment"` ends with `"Capability Assessment"`, so a shortest-first `endswith` scan files all four
under their parent and every capability-summary paragraph — the annex's only authored capability
narrative — comes out empty. Match exact-first, then longest-suffix-first.

**The NFIP ordinance citation is in the prose, not the table.** See the Phase-6 report: 29 of 51
annexes answer `No` in Table 3 while citing a real ordinance with a date and legal reference in the
NFIP Summary. Applying the detail-beats-checkbox rule row-locally loses the ordinance for over half
the corpus.

**Encoding:** curly apostrophes throughout. Set `PYTHONIOENCODING=utf-8` or Windows `cp1252` crashes
the extractor mid-run.

**File sizes** are small — 80–120 KB per annex or MAW. Whole-corpus extraction is cheap; unlike Tetra
Tech there is no need to stage to text first.

## Taxonomy — it closes completely, with no `Other` rows

Nassau's 11 hazards expand to **14 of MNY's 17 named types**, and the base plan explicitly names the
other three as not profiled. So `17 = 14 assessed + 3 confirmed-No`, and — unlike Tetra Tech —
**no `Other` row is needed and `Hazard Name, If Other` stays empty** — for the 51 Hagerty annexes.

*(Two later corrections, 2026-08-21: the Suffolk blocker was retired — `Other` **is** storable, with
271 live rows already using it. And Nassau does produce `Other` rows after all, just not from a Hagerty
annex: Freeport's independent plan needs **6**. See `independent-jurisdictional-plan.md`.)*

| Hagerty hazard | MNY type(s) | Kind |
|---|---|---|
| Coastal Hazards | Coastal Hazards | 1:1 |
| Drought | Drought | 1:1 |
| Flooding | Flooding | 1:1 |
| Hail | Hail | 1:1 |
| Lightning | Lightning | 1:1 |
| Tornados *(plural in source)* | Tornado | 1:1 |
| Wind | Wind | 1:1 |
| Hurricane and Tropical Storms | Hurricane | 1:1 |
| Extreme Temperatures | **Extreme Cold + Extreme Heat** | split |
| Ground Failure | **Earthquake + Landslide** | split |
| Severe Winter Weather | **Ice storm + Snowstorm** | split |
| *(base plan: not profiled)* | Avalanche, Tsunami/Seiche, **Wildfire** | `hazard_of_concern = No` |

The three splits follow the Suffolk precedent — duplicate the parent's values to both children and
mark them `derived`. Because Table 2 carries only booleans, splitting is **loss-free** here; there is
no single prose block being copied to two homes, which is what made Suffolk's splits uncomfortable.

**Wildfire is an explicit exclusion, not an omission** — base-plan Table 11 lists the six hazards
Nassau chose not to profile, and the sentence above it gives the shared rationale. Three of them map to
MNY types and are set `hazard_of_concern = No` with that sentence as their `reason_for_exclusion`. See
the impact-category section below for the full rule.

### Impact categories → the four HOC vulnerability booleans

Hagerty's Table 2 uses seven categories; MNY has four booleans. Mapping:

| Hagerty category | MNY boolean |
|---|---|
| Housing | `buildings_vulnerability` |
| Infrastructure | `infrastructure_vulnerability` |
| Community · Health and Social Services · **Economy** | `population_vulnerability` |
| Natural and **Cultural** Resources | `natural_env_vulnerability` |
| **No Impact** | all four No, and `hazard_of_concern = No` |

`Economy` has no MNY equivalent and the *Cultural* half of the fourth category is dropped. Mitigate
by carrying the verbatim category string into `other_comments` — cheap, and it makes the loss
recoverable later.

**`hazard_of_concern` resolves to Yes or No for all 17 types — never `Not Reported`** (owner,
2026-08-21, confirming the Suffolk rule):

| Source | `hazard_of_concern` |
|---|---|
| Table 2, any impact category | **Yes** |
| Table 2, `No Impact` | **No** |
| Not in Table 2 at all — Avalanche, Tsunami/Seiche, Wildfire | **No**, from the base plan |

The third row is why the base plan matters here: **Table 11** (a `1x2` cell pair, just six bare names —
*Avalanches, Geomagnetism, Ice Jams, Tsunamis, Volcanoes, Wildfires*) is the authority for the
county-wide omissions. Three of the six have MNY hazard types; Geomagnetism, Ice Jams and Volcanoes
have none and are dropped.

`reason_for_exclusion`:

- `No Impact` rows → **empty**. "No Impact" is itself the recorded reason; the section boilerplate is
  not to be reworked into a per-hazard sentence.
- The three county-wide exclusions → the **verbatim sentence immediately above Table 11**: *"The
  following natural hazards are not included in this Plan based on State and Federal guidance and
  history of hazard occurrences that indicate these hazards are unlikely to occur or cause damage:"*
  One shared rationale, quoted and attributed, on all three rows.

> ⚠ **Do not use Table 10 for this.** It is captioned *Reason for **Identification*** and covers the
> 11 hazards that **were** profiled — an earlier draft of the crosswalk cited it as the exclusion
> source and was wrong. Table 10's real value is its *Connection to 2014 Plan* column, which maps 2020
> names to 2014 ones, flags the five **New Hazard** entries, and is the authority for what *Ground
> Failure Hazards* contains (Earthquakes, Expansive Soils, Land Slides, Land Subsidence — the last two
> have no MNY type).

Per-hazard **ranking** needs no column: the owner ruled `hazard_of_concern` addresses it, so the
"hazards that most impact" sentence has one target only, `lhmp_risk_overview`.

Row math per jurisdiction: **17 rows, all Yes or No.** No `Other` rows, nothing `Not Reported`.

**There are FOUR hazard vocabularies in this plan.** Build one normalisation table before any join,
and assert every label resolves:

| Source | Sample labels |
|---|---|
| Annex Table 2 | `Ground Failure`, `Wind`, `Hurricane and Tropical Storms`, `Tornados` |
| Base plan tables 9 / 10 | `Ground Failure Hazards`, `Straight-line Wind`, `Hurricanes and Tropical Storms` |
| Base plan table 13 (ranking) | `Hurricane/ Coastal Storm`, `Coastal Flooding/Wave Action`, `Flooding /Inland`, `Winter Storm (Severe)`, `Severe Storm` |
| Base plan `9x2` box captions | `Coastal Flooding/Wave Action`, `Severe Winter Weather` |

Note the third row does not merely re-spell the others — it **re-partitions** them (`Coastal Flooding/
Wave Action` and `Flooding /Inland` where the annex has one `Flooding`). Assume nothing joins by name.

## No consultant-delivered actions workbook

Tetra Tech shipped Suffolk's actions as a reconciled `.xlsx`. **Hagerty shipped nothing of the kind
for Nassau** — all 234 proposed actions, all 284 prior-cycle actions and all 143 worksheets must be
extracted from Word. That makes Actions the largest single piece of the load, though also the
cleanest, because the transposed 14-field table is completely regular.

### Two fields that map unusually well

- **`Goal being met` → the six SHMP goal booleans.** Hagerty records goals as bare digits (`3`,
  `"3, 5"`) and the MNY Actions tab carries exactly six numbered goal booleans. The numbering
  matches. Split on comma, set the booleans — no mapping table needed.
- **MAW `Local Planning Mechanisms to be Used in Implementation` → the identically-named Actions
  column.** A rare exact-name match.

### Vocabulary translations required

| Field | Hagerty values | MNY target |
|---|---|---|
| `Project Status` (prior) | Completed / Not Started / In Progress | `Implementation Status`: Completed / **Proposed** / In-Progress |
| `Estimated Timeline` | free text — `1 Year`, `One year`, `One Year` | `Estimated Time Required…`: Ongoing / **Less than 2 years** / 2-4 years / More than 4 years |
| `EHP Issues` | `NA` or prose | boolean — `NA` ⇒ Not Reported, prose ⇒ Yes *(the explanation has no home)* |
| `Hazards to be mitigated` | free text — `Flooding and Erosion` | Primary/Secondary/Tertiary Hazard Type |
| `Estimated Costs` | `$5,000,000` | numeric + a derived `Cost Range` bucket |
| `Estimated Benefits` | **mixed** — prose, a dollar figure, or both | `Cost Benefit Notes` (text) |
| `Lead Agency` | may be `TBD` | Not Reported |
| `Potential Funding Sources` | sometimes an **agency**, not a funding source | carry verbatim; flag |

**Prior-cycle actions are structurally thin.** The standard 6-field table has no project number, no
lead agency, no cost, no funding, no priority — and its `Action` cell is a full sentence, not a name.
Deriving `Action Name` means truncating prose; do it explicitly and keep the sentence in
`Description of the Solution`.

**`Carried Forward to 2020 Plan`** is a prior-action row answered Yes/No, meaning *this action was not
finished and reappears as a 2020 proposed action*. Owner rule (2026-08-21): a **direct field map** —
`Carried Forward = Yes` ⇒ `Included in Last HMP = Yes`. No prior-to-proposed matching, no text
preservation, no review flagging.

⚠ **This replaces the blanket constant.** Do *not* also set `Included in Last HMP = TRUE` for every
prior-action row (which would be defensible on its own terms — they were all in the 2014 plan) or every
prior action reads as carried forward and the field stops distinguishing anything.

### Action Type is inferred, not read

No Hagerty field states it. Use the standing tier-and-guardrail rule in the parent skill with
[`../action-type-tiers.csv`](../action-type-tiers.csv), classifying from `Project Name` +
`Description of the Solution`.

Two Hagerty-specific notes. Nassau is coastal, so **Tier 1 fires constantly** — seawalls, bulkheads,
tide gates, sluiceways, pump stations — which means the substitutions matter here more than they would
inland: `Coastal Protection` has no P/S/T option and is written as `Infrastructure Projects`, with the
`coastal_protection` boolean and `action_type_specific_if_applicable` both carrying the true type.
Glen Cove hits it on both of its worksheet actions.
And `Hazards to be mitigated` is free text (`Flooding and Erosion`), so the hazard and the action type
must be classified independently — the hazard string is not a reliable type signal.

## Corpus variances (measured across all 52 Nassau annex folders)

Encode these before batch-extracting; each one silently corrupts counts.

1. **One annex is PDF-only** (Freeport). No `.docx` exists — convert it or exclude the jurisdiction
   explicitly. Do not let a file-glob swallow it.
2. **The county's own annex omits Table 2.** Nassau County has the *Hazard Vulnerability* heading with
   no hazard-impacts table, so it yields **no** HOC rows from its annex. Owner rule (2026-08-21):
   **county-level Hazards of Concern comes from the base plan, always.** And the base plan is richer —
   a `9x2` profile box per hazard (*Rank · Potential Impact · Cascade Effects · Frequency · Onset ·
   Hazard Duration · Recovery Time · Impact*, tables 15–44) plus the full ranked list in table 13. That
   `Impact` cell is real authored prose, so the **county's `general_vulnerability` is a genuine
   transcription while its jurisdictions' is a derived sentence** — one builder cannot assume one
   source. *(Same "county chapter uses a different instrument" pattern as Suffolk.)*
3. **Two annexes invert the prior-action table orientation.** Nassau County `53x7` (adds *Primary
   Agency Responsible*) and Town of Hempstead `96x8` (adds *Reference Number* and *Hamlet*) are
   **row-per-action**. 147 of 284 prior actions live in those two tables — over half the corpus, in
   the orientation your parser doesn't expect.
4. **One annex has a section nobody else has** — Woodsburgh's *Completed Mitigation Actions*, with a
   third field set (`12x3`: the proposed-action fields minus Project Number and Priority Ranking).
5. **Row counts drift** (Long Beach `15x8`). Classify by column-0 labels.
6. **The Hazard Vulnerability heading** — see quirks. 46 of 51 doubled, 5 clean, 1 grammatically
   different.
7. **One title is styled `SectionTitle`, not `Heading 1`** (Malverne) — hence 50 `Heading 1`s for 51
   annexes. Lattingtown has no *Previous Mitigation Actions* heading at all.
8. **Row-label variants inside fixed tables.** Woodsburgh's Table 3 reads *NFIP Flood Damage
   Prevention **Law**(s)* and *Post Disaster Recovery **Law**(s)* where all others read
   *Ordinance(s)*. Normalise before keying capability names.
9. **File selection needs a human in nine folders** — see below.

### File selection is a real hazard — the manifest is settled

**Reviewed file by file across all 52 folders, 2026-08-21.** The result is committed as
`references/mny-transcribe/Nassau/context/file-manifest.csv` (git-ignored) —
`folder → annex file + worksheet files + reason`. **Use the manifest; do not glob and do not re-derive.**

47 of 52 folders are unambiguous: one annex `.docx`, worksheets matching
`MAW<n>_<Jurisdiction>_FINAL.docx`, no subfolders. Five needed a judgement call, and **every mtime in
the corpus is identical** (all delivered 2026-07-24), so authority had to come from content:

| Folder | Decision and why |
|---|---|
| `04_TownofNorthHempstead` | **`4_TOWN~2.docx`.** Two candidates at the same 133 KB — a legacy `.DOC` and the `.docx`. The `.docx` reads (16 headings, 16 tables, 31,479 chars); the `.DOC` is a duplicate python-docx can't open. The 8.3 short name is the delivered name — quote it, don't rename it. |
| `17_VillageofGardenCity` | **root `…8-18-2021 FINAL EDITS.docx`** (14,649 chars) over `archive/…docx` (13,910). Same 14 headings / 9 tables ⇒ later revision of the same document. **Worksheets are in `archive/` only**, plus the `VGC_4` PDF. |
| `49_VillageofWillistonPark` | **one annex docx.** The apparent second candidate, `MAW_3 NEW Williston Park.docx`, is a *worksheet* (0 headings, 2 tables, 32,497 chars). |
| `50_VillageofWoodsburgh` | **`… - FINAL Revisions.docx`** (14,341 chars) over the plain docx (13,352). Identical 15-heading / 9-table structure ⇒ later revision. Corroborated by the later `JA052_…Updated FINAL.pdf`. |
| `51_VillageofFreeport` | **not a Hagerty annex at all** — see below. |

The general rule went into Layer 1: same structure + more characters ⇒ later revision, take it;
*different* structure ⇒ a different document, needs a human.

### ⚠ Freeport is not a Hagerty annex

`51_Village of Freeport_Jurisdictional Annex.pdf` is, despite its filename, the **Village of
Freeport's own standalone "2020 All Hazard Mitigation Plan"** — 177 pages, seven chapters, and **none
of the 12 Hagerty spine headings**. It has its own everything:

| | Freeport standalone | Hagerty annex |
|---|---|---|
| Structure | 7 numbered chapters + ToC | 12 fixed headings |
| Hazard profiles | 10, each with *Hazard Description · Geographic Location/Extent · Previous Occurrences · **Probability of Future Occurrences** · **Vulnerability/Impact*** | one `12x2` category checklist |
| Capabilities | 20 named prose sections (§4.1–4.20) | four Yes/No tables |
| Taxonomy | **Terrorism, Hazardous Materials, Cyber-Terrorism, Urban/Structural Fire, Epidemic/Pandemic** — none has an MNY type | the fixed 11 |
| Format | PDF, text extracts cleanly (356,988 chars via `pypdf`) | `.docx` |

The owner directed (2026-08-21) that the file be used. It **cannot** go through the annex parser and
needs its own crosswalk — tracked as `pipeline = freeport-standalone` in the alias table. Note the
irony: it is the only Nassau jurisdiction that *does* carry per-hazard vulnerability prose and
probability data, the two things every other jurisdiction lacks.

## Jurisdiction identity

**Build the alias table first and key everything on geoid** — the same rule as Tetra Tech, for
different reasons. Name-matching the 52 annex folders against the workbook's `geoid-crosswalk` tab
(138 Nassau rows) resolves 50; the two failures are both instructive:

- **Glen Cove has two geoids** — `3605929113` (`cousub`, *Glen Cove (city)*) and `3629113` (`Place`,
  *Glen Cove (City)*), differing only in census type and letter case. Long Beach, the other city, has
  one. **Resolve this before any load** or Glen Cove's content splits across two rows.
- **Rockville Cent*er*** (annex folder) vs **Rockville Cent*re*** (crosswalk) — a spelling variant.

*Hempstead* and *Oyster Bay* also appear twice each, but those are legitimately distinct entities
(Town vs Village, Town vs CDP) and resolve on `Municipality Type`.

The base plan's attendance matrix covers **70** Nassau jurisdictions against **52** annexes — that
gap needs reconciling before Roles and Participation are loaded.

## Roles and Participation come from the base plan

The annexes carry **no dated meetings** and only two people each. The base plan
(`Nassau County_HMP_Base_Plan_12.16.20.docx`) carries all three sources:

| Table | Shape | Content | Target |
|---|---|---|---|
| 7 | 10x4 | **9 dated meetings** — Name, Date, Description, Participation | **Participation** (the entire dataset) |
| 0 | 71x9 | **jurisdiction × meeting attendance** + `Status (Adopting, Withdrawn)` | `Roles.HMP Process Participation` |
| 1 | 191x5 | **190-person roster** — Organization, First, Last, Job Title, Core Planning Group? | **Roles** |

This is materially better than Suffolk, where Participation had no derivable source from the annexes
and the only attendance record was buried in a Volume III appendix. Four things to encode:

- **Two of the nine dates are not single dates** — *February 19 **and 20**, 2020* and
  *June 25 – July 16, 2020*. Decide the convention before generating rows.
- **Tables 0 and 7 name the same meetings differently** (*Risk Review and Mitigation Webinar* vs
  *…and Mitigation Strategy Webinar*; *Jurisdiction* vs *Jurisdictional Consultation Calls*;
  *Planning Committee Plan Review* vs *Planning Committee Review*). Fuzzy-join; table 0 covers 7 of
  the 9.
- **Attendance is per jurisdiction, not per person** (Suffolk's was per person). A person-level
  `HMP Process Participation` value is therefore *inferred* and must be marked `derived`.
- **The matrix has 70 rows, the annexes 52.** The difference is **18 incorporated Villages marked
  `Withdrawn`** — zero CDPs, real `Place` geoids, 14 with documented attendance and 34 named people in
  the roster. Owner rule 2026-08-21: **load Roles and Participation for all 70, everything else for the
  52.** The alias table is therefore 70 rows, and `adoption_status` is load-bearing — without it those
  18 read as plan participants.

The roster and the annex POC tables overlap. Prefer the annex POC row — it is the only source with
email and phone — and enrich from the roster. Dedupe on `(jurisdiction geoid, normalised name)`.
Normalise organisation names first: *FEMA* / *Federal Emergency Management Agency (FEMA)*, *NYS DHSES* /
*New York State Department of Homeland Security and Emergency Services*, and a stray plural *Villages of
Woodsburgh*.

**Measured row math (2026-08-21):** 190 roster people + 102 annex POC people, **only 49 overlapping**
⇒ **~239 distinct people**. The two sources are genuinely complementary, not redundant, which is why
both load. At ~1 role each that is ~239 Roles rows.

**The roster is also the only source for `Required Stakeholder?`.** 20 of its 190 people belong to 13
non-municipal organisations — FEMA, NYS DHSES, NYSDEC, NYC Emergency Management, Suffolk County, the
Long Island Regional Planning Council, the NYS Floodplain & Stormwater Managers Association, the county
Soil & Water Conservation District, the Village Officials Association and Hagerty itself (5). Those are
the FEMA A2-a categories, and the `Role` values that aren't *Government - Staff or Technical*.

**`role` is a single select, so one Roles row per person PER ROLE.** Glen Cove's Mayor plausibly holds
both *Government - Elected or Appointed Official* and *Emergency & Public Safety*; that is two rows, not
one row with two values. Row math is people × roles.

`Invitation Method`, `Hours` and `Meeting Notes and Documentation` have no source in the base-plan
text. `NassauCountyHMP_AppendixA_PlanningProcess_Revised.pdf` (49 MB, PDF-only) is the likely home
for agendas and sign-in sheets and has **not** been examined.

## The QA cross-checks that pay for themselves

Hagerty's annexes carry internal contradictions that a load will otherwise silently propagate. Assert
these per annex; a failure is a document defect needing a human, not a parser bug.

- **Table 3's NFIP-ordinance answer vs the NFIP Summary's ordinance citation.** Glen Cove's Table 3
  says `NFIP Flood Damage Prevention Ordinance(s) = No` while its NFIP paragraph cites *Chapter 154,
  City Code, L.L. No. 6-2009*. Both cannot be true.
- **No capability row answers `No` while carrying a non-empty Details/Citation.** Glen Cove's Table 4
  row 7 answers `No` and fills in *Director of Building Department*.
- **`Project Number` sets are contiguous within a jurisdiction**, and the union across a
  jurisdiction's chunked action tables matches its MAW `Project Number` set.
- **MAW `Estimated Cost` equals the annex table's `Estimated Costs`** for the same project number.
- **Table 2's hazard set is the canonical 11** — byte-identical in all 50 annexes that have one, so
  any deviation is a defect.

## Cell-shape traps

**Table 1 (Demographics) is two label/value pairs side by side.** It reports as `8x4` and the header
row repeats `Demographic | Demographic`. Columns 0/1 and 2/3 are unrelated pairs (vulnerability
indicators on the left, race/ethnicity on the right). Reading it as a normal 4-column table drops
half the content. It is `auto-populated` so nothing is lost here — but the same two-up layout is a
Hagerty habit worth watching for elsewhere. *(Tetra Tech does the same thing in its Table G.)*

**Answer columns are not clean Yes/No.** Table 6's header is literally `Yes/No (or Status)` — the cell
may hold a CRS class or other status string instead. Test whether the answer *begins* with `No`; do
not test for the presence of prose.

**Fiscal row labels contain a source typo** — *"Ability to incur **dept** through special tax bonds"*
— in all 51 annexes. Decide once whether to preserve or correct it, and apply it consistently, since
`Capability Name` is the join key.

## Per-jurisdiction variation

Almost none, which is the point. Towns, cities and villages all carry the identical 12-heading,
7-fixed-table spine; only the action-table dimensions differ. There are no special-district or tribal
annexes in Nassau, and no jurisdiction type omits a section.

Nassau = 52 annex folders: 1 county, 2 cities, 3 towns, 46 villages.
