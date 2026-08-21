# Nassau jurisdictional annex → MitigateNY 2.0 forms datasets

**Consultant:** Hagerty Consulting · **Plan:** Nassau County Multi-Jurisdictional HMP, dated 2020-12-16
**Reference annex analyzed:** `Nassau/All Annexes/01_CityofGlenCove/1_City of Glen Cove_Jurisdictional Annex.docx` + its two MAWs (git-ignored)
**Structure verified against:** all 51 readable annexes (corpus pre-flight, §7)
**Target workbook:** `planning/mitigateny/files/MNY Workbook - 08142026.xlsb` (Actions, Roles, Participation, Hazards of Concern, Capabilities)
**Crosswalk:** `references/mny-transcribe/Nassau/context/nassau-annex-crosswalk.csv` — 175 field-level mappings
**Profile written:** [`profiles/hagerty.md`](../profiles/hagerty.md)
**Date:** 2026-08-20 · **owner decisions resolved 2026-08-21, revised same day (§5)**

---

## 1. The headline finding

**A Hagerty annex is a short, table-light document — and its per-hazard vulnerability content does
not exist.**

Where a Tetra Tech annex is ~30 tables and 200 KB of extracted text, a Hagerty annex is **9 tables
and 17 KB**. The whole Glen Cove annex is 55 content blocks. That brevity is the defining fact of
this consultant, and it cuts two ways:

**What Hagerty does better than Tetra Tech.** There is genuine authored *prose*: a development-trends
paragraph, four capability-summary paragraphs, and a four-paragraph NFIP narrative. Tetra Tech had
none of that — its `lhmp_municipality_profile` had no source at all. Hagerty fills five Jurisdictions
lexical columns from real sentences.

**What Hagerty does far worse.** Hazard vulnerability is a **checklist, not a narrative**. Table 2 is
11 hazards × a comma-separated list of impact categories, and that is the *entire* per-hazard content
in the annex. Consequently:

| Hazards of Concern column | Required? | Tetra Tech source | Hagerty source |
|---|---|---|---|
| `general_vulnerability` | **yes** | Table F, one authored paragraph per hazard | **none** |
| `likelihood` | yes | none (probability bands absent there too) | **none** (county-level only) |
| `future_occurrence_assessment` | yes | Table I | **none** |
| `climate_change` | no | Table I | **none** |
| `secondary_hazards` | no | — | **none** |

`general_vulnerability` is the single most valuable HOC column and a **required** field, and there is
nothing in a Hagerty annex to put in it.

> **Resolved 2026-08-21.** The owner ruled that `general_vulnerability` is filled from Table 2's
> impact categories as a **derived sentence that states its own derivation**, so the required field is
> populated and no reader mistakes it for authored prose. `Mitigation Connection` is **skipped**
> outright. `future_occurrence_assessment`, `climate_change` and `secondary_hazards` stay empty. See
> §5 for the full set of decisions.
>
> **The county row is the exception.** County-level HOC comes from the base plan, whose per-hazard
> `9x2` profile boxes carry a real authored `Impact` narrative — so Nassau County gets a genuine
> transcription where its 51 jurisdictions get a derived sentence. See §5g.

### Where the 175 mappings land

| Target dataset | Mappings | What lands there |
|---|---:|---|
| **Actions** | 62 | Proposed (14-field transposed tables) + prior-cycle + the MAW worksheets |
| **Capabilities** | 26 | Tables 3–6 — regulatory, staffing, fiscal, classifications |
| **Roles** | 24 | Annex POC table (2/jurisdiction) + **base-plan roster (190 people)**, one row per person **per role** |
| **Hazards of Concern** | 25 | Jurisdictions from Table 2; **the county row entirely from the base plan**, where the prose is real |
| **Participation** | 8 | **Base plan only** — 9 meetings → 11 rows |
| **Jurisdictions** (lexical) | 7 | Development trends, capability summary, NFIP, problem areas, risk overview, planning process |
| *(no target)* | 22 | boilerplate, auto-populated, the five remaining omissions, and Freeport |

Dispositions after the 2026-08-21 decisions (the pre-decision counts are in the task doc's history):

| Disposition | Count | Meaning |
|---|---:|---|
| `dataset-fill` | 92 | Transcribe into a forms dataset |
| `derived` | 23 | Must be inferred — flag, never present as a direct read |
| `constant` | 17 | Fixed value per source table (`Included in Last HMP=TRUE`, `State or Local=Local`) |
| `gap-empty` | 17 | The column exists; the plan has no source; left empty |
| `boilerplate` | 10 | Identical across all 51 annexes; transcribe nothing |
| `auto-populated` | 5 | MNY 2.0 generates it (census, NFIP claims, Hazus, declarations) |
| `filter` | 4 | Include/exclude — but see §5g, `No` filters only when the detail cell is empty |
| `gap-partial` | 2 | Source exists but the fit is poor |
| `superseded` | 1 | A mapping this report proposed that a later decision retired |
| `lossy` / `gap-weak` / `accepted-loss` | 3 | One each |
| `separate-track` | 1 | Freeport — a different document class entirely |

**`gap-no-target` is zero, and only five items have no home at all** — see the omissions register in
§5f. No schema additions were made; the reduction came from reading the *live* sources instead of the
workbook, which turned three declared gaps into real columns.

---

## 2. The annex spine (Hagerty, 12 headings, uniform across 51 of 51)

```
H1  <Jurisdiction> Annex                                  boilerplate
H2  Hazard Mitigation Plan Points of Contact              → Roles              [table 2x2]
H2  Profile                                               → Jurisdictions      [table 8x4 = auto-populated]
H2  Hazard Vulnerability                                  → Hazards of Concern [table 12x2]
H2  Capability Assessment
    H3  Legal and Regulatory Capability Assessment        → Capabilities       [table 24x3]
    H3  Administrative and Technical Capability Assessment→ Capabilities       [table 12x3]
    H3  Fiscal Capability Assessment                      → Capabilities       [table 11x3]
    H3  Community Classification Assessment               → Capabilities       [table  5x2]
    H3  National Flood Insurance Program Summary          → Jurisdictions.nfip [prose only]
H2  Mitigation Strategy
    H3  Previous Mitigation Actions                       → Actions            [table 6xN transposed]
    H3  Proposed Mitigation Actions                       → Actions            [table 14xN transposed]
    H3  Mitigation Action Worksheets                      → Actions            [separate MAW*.docx]
```

The first **seven tables are a fixed sequence of fixed shapes** — `2x2, 8x4, 12x2, 24x3, 12x3, 11x3,
5x2` — in every one of the 51 readable annexes. Only the two action tables vary. This is the most
uniform corpus of the four counties transcribed so far, and it means a single positional parser
works, with three named exceptions (§7).

**Action tables are transposed.** Field labels are in **column 0**; each *additional column* is one
action. So a `14x4` proposed-actions table holds **3** actions, and the corpus count is
`sum(cols - 1)`, not `sum(rows)`. Getting this backwards inverts every count.

---

## 3. The clean fits

Five mappings are better than anything the previous three counties offered:

1. **`Goal being met` → the six SHMP goal booleans.** Hagerty records goals as bare digits
   (`3`, `"3, 5"`, `"1, 3"`) and MNY's Actions tab carries exactly six numbered goal booleans
   `1: Protect & improve…` … `6: Build stronger`. The numbering matches. Split on comma, set the
   booleans. No mapping table needed.

2. **NFIP Summary → `nfip`.** Four authored paragraphs covering FPA responsibility, administration
   method, barriers, map accuracy, RiskMAP status, substantial damage, NFIP standing, CAC/CAV dates,
   and the flood-damage-prevention ordinance citation. One lexical column, one clean fill.

3. **Capability-summary paragraphs → `lhmp_capacity_to_implement`.** Each of the four capability
   subsections opens with an authored paragraph naming what the jurisdiction has, what it lacks, and
   why that matters. Concatenated in order they are exactly what "Capacity To Implement" is for.

4. **`Local Planning Mechanisms to be Used in Implementation` (MAW) → the identically-named Actions
   column.** The only source anywhere in the plan for a field FEMA cares about (plan-integration).

5. **Hazard taxonomy closes completely — no `Other` rows.** Nassau's 11 hazards expand to **14 of
   MNY's 17 named types**, and the base plan explicitly names the other three as not profiled. So
   17 = 14 assessed + 3 confirmed-No, and unlike Suffolk there is no `Other` row to insert and no
   `Hazard Name, If Other` to populate. The live-schema blocker Suffolk hit (`hazard` has no `Other`
   option) simply does not arise here.

| Nassau hazard (Table 2) | MNY hazard type(s) | Kind |
|---|---|---|
| Coastal Hazards | Coastal Hazards | 1:1 |
| Drought | Drought | 1:1 |
| Flooding | Flooding | 1:1 |
| Hail | Hail | 1:1 |
| Lightning | Lightning | 1:1 |
| Tornados | Tornado | 1:1 |
| Wind | Wind | 1:1 |
| Hurricane and Tropical Storms | Hurricane | 1:1 |
| Extreme Temperatures | **Extreme Cold + Extreme Heat** | split |
| Ground Failure | **Earthquake + Landslide** | split |
| Severe Winter Weather | **Ice storm + Snowstorm** | split |
| *(not profiled — base plan)* | Avalanche, Tsunami/Seiche, **Wildfire** | `hazard_of_concern = No` |

The three splits follow the precedent already set for Suffolk (and for the Volume I hazard pages):
the parent row's values duplicate to both children, marked `derived`. Because Table 2 carries only
booleans, splitting is loss-free here — there is no single prose block being copied to two homes.

**Wildfire being an explicit No is worth noting** — it is a real hazard type that Nassau County
consciously excluded, so it gets `hazard_of_concern = No` and a sourced `reason_for_exclusion`, not an
omission. The source is the **sentence immediately above base-plan Table 11**, not Table 10 — see the
correction in §5b.

---

## 4. Participation and Roles come from the base plan, not the annexes

This is the same shape as Suffolk — but Nassau's source is much better.

**The annexes contain no dated meetings at all.** They contain a boilerplate sentence saying the POCs
"are members of the Planning Committee that met regularly." That sentence is the authority for
`HMP Committee Membership`, and nothing more.

The base plan (`Nassau County_HMP_Base_Plan_12.16.20.docx`) carries three tables that together cover
both datasets properly:

| Table | Shape | Content | Target |
|---|---|---|---|
| 7 | 10x4 | **9 dated meetings** — Name, Date, Description, Participation | **Participation** (the whole dataset) |
| 0 | 71x9 | **jurisdiction × meeting attendance matrix** + adoption status | `Roles.HMP Process Participation` |
| 1 | 191x5 | **190-person roster** — Organization, First, Last, Job Title, Core Planning Group? | **Roles** |

The nine meetings, verbatim:

| Meeting | Date | Participation |
|---|---|---|
| Core Planning Group Kick-Off Meeting | February 3, 2020 | Core Planning Group |
| Planning Committee Pre-Workshop Webinar | February 19 **and 20**, 2020 | Planning Committee |
| Planning Committee Workshop | March 5, 2020 | Planning Committee |
| Risk Review and Mitigation Strategy Webinar | June 11, 2020 | Planning Committee |
| Stakeholder Webinar | June 12, 2020 | Stakeholder Group |
| Jurisdictional Consultation Calls | June 25 – July 16, 2020 | Planning Committee |
| Planning Committee Mitigation Strategy Review Webinar | August 20, 2020 | Planning Committee |
| Planning Committee Review Webinar | September 16, 2020 | Planning Committee |
| Public Meeting/Webinar | October 8, 2020 | Planning Committee, Stakeholder Group, Public |

Three things to encode before loading:

- **Two of the nine dates are not single dates** — one is two consecutive days, one is a three-week
  range. Decide the convention (start date + a note, or two rows) before generating Participation.
- **Table 0 and Table 7 name the same meetings differently.** *Risk Review and Mitigation Webinar* vs
  *Risk Review and Mitigation Strategy Webinar*; *Jurisdiction* vs *Jurisdictional Consultation
  Calls*; *Planning Committee Plan Review Webinar* vs *Planning Committee Review Webinar*. Fuzzy-join
  the two, don't string-match. Table 0 covers **7 of the 9** — the Stakeholder Webinar and the Public
  Meeting have no per-jurisdiction attendance column.
- **Attendance is recorded per jurisdiction, not per person.** Suffolk's Appendix B matrix was
  person × meeting; Nassau's is jurisdiction × meeting. So a person-level
  `HMP Process Participation` value is *inferred* from their jurisdiction's row, and should be marked
  `derived` rather than presented as recorded fact.

**The matrix covers 70 jurisdictions, the annexes 52** — and the 18-row difference is settled: all
are incorporated Villages marked `Withdrawn`, **zero CDPs**, with real Place geoids. They get Roles and
Participation and nothing else. See §5h.

`Invitation Method`, `Hours`, and `Meeting Notes and Documentation` have no source in the base-plan
text. `NassauCountyHMP_AppendixA_PlanningProcess_Revised.pdf` (49 MB, PDF-only) is the likely home
for agendas and sign-in sheets and has **not** been examined.

---

## 5. Owner decisions — RESOLVED 2026-08-21

Every gap below is now closed. **No schema additions were made**; where content had no column the
owner chose to accept the loss rather than widen the model.

### 5a. The two required fields with no source

| Field | Decision | How it's implemented |
|---|---|---|
| **`Hazards of Concern.general_vulnerability`** (required) | **Fill it, from Table 2's impact categories** | A derived sentence that declares its own derivation, e.g. *"The City of Glen Cove identified impacts from Coastal Hazards to: Community; Natural and Cultural Resources. (Derived from Table 2 of the 2020 annex; no narrative was authored.)"* The parenthetical is not optional — it is what keeps a synthesized field from reading as authored prose. |
| **`Capabilities.Mitigation Connection`** (required, C1/D3-b) | **Skip** | Left empty deliberately. No prose will be synthesized. Recorded as `accepted-loss`, not as an oversight, so a later reviewer knows it was decided rather than missed. |

This overrides the recommendation in this report's first draft, which was to leave *both* empty. The
distinction the owner drew is worth keeping: Table 2 **is** a per-hazard vulnerability statement, just
a structured one, so restating it is reporting rather than invention. The capability tables carry no
mitigation-connection statement in any form, so there is nothing to restate.

### 5b. `hazard_of_concern` — the Suffolk silence = No rule, confirmed

| Source | `hazard_of_concern` |
|---|---|
| Table 2, any impact category | **Yes** |
| Table 2, `No Impact` | **No** |
| Not in Table 2 at all — Avalanche, Tsunami/Seiche, Wildfire | **No**, from the base plan |

*(A narrower variant — silence ⇒ `Not Reported` — was adopted earlier on 2026-08-21 and reverted the
same day. The rule above is the standing one, and it is now the same rule for every county.)*

**Every one of the 17 MNY hazards resolves to `Yes` or `No`.** Nothing is left `Not Reported`, which is
the point: DHSES tracks *confirmed* omissions statewide, so a hazard the county chose not to profile is
information rather than absence.

`reason_for_exclusion` has two cases:

- **`No Impact` rows → empty.** "No Impact" is itself the recorded reason.
- **The three county-wide exclusions → a verbatim quote**, attributed to the base plan: *"The following
  natural hazards are not included in this Plan based on State and Federal guidance and history of
  hazard occurrences that indicate these hazards are unlikely to occur or cause damage:"* — one shared
  rationale on all three rows.

> **A correction to §3 of this report.** It said base-plan "table 10 gives per-hazard reasons" for the
> excluded hazards. That was wrong. **Table 10 is captioned *Reason for Identification*** and covers the
> 11 hazards that **were** profiled. Table 11 — the actual exclusion list — is a bare `1x2` cell pair of
> six names with no reasons at all, and the rationale is the sentence above it. Two hazard tables that
> look interchangeable and aren't; check the caption.

Table 10 does earn its place, just differently: its **`Connection to 2014 Plan`** column maps 2020
hazard names to their 2014 equivalents, flags the five entries marked *New Hazard*, and is the authority
for what *Ground Failure Hazards* contains (Earthquakes, Expansive Soils, Land Slides, Land Subsidence
— the last two have no MNY type). That column now maps to `other_comments` on the county rows.

Also new from this pass: **the base plan and the annexes label hazards differently** — *Ground Failure
**Hazards*** vs *Ground Failure*, *Straight-line Wind* vs *Wind*, *Hurricane**s** and Tropical Storms*
vs *Hurricane and Tropical Storms*. Normalise, then assert both sets reconcile to the same 11 before
joining. Three of Table 11's six names (Geomagnetism, Ice Jams, Volcanoes) have no MNY type and are
dropped.

Per-hazard **ranking** is closed by this rule too: the owner ruled `hazard_of_concern` addresses it, so
no ranking column is needed and the "hazards that most impact" sentence keeps its single target,
`lhmp_risk_overview`.

**Row math per jurisdiction:** 17 rows, all `Yes` or `No`. No `Other` rows.

### 5c. Action Type is inferred — see the tier table

Approved. The algorithm is now a **standing, consultant-invariant rule** in
[`transcribing-a-consultant-plan.md`](../transcribing-a-consultant-plan.md), with the scores in
[`action-type-tiers.csv`](../action-type-tiers.csv). Three things had to be settled to make the
owner's spec executable against the live schema:

**1. The vocabulary the owner listed is the boolean set, not the P/S/T set.** The live Actions source
(`1029065`) has *two* action-type vocabularies: 16 boolean `action_type_*` columns feeding a
calculated multiselect, and three `select` columns sharing 17 options. The owner's 16 tiered types are
the **booleans**. Ruling: **set both** — booleans for truth, selects for the ranked top three.

**2. Two Tier-1 types have no select option.** The owner fixed the P/S/T columns on 2026-08-21
(`Large Flood Control` added to primary, the `Risk/Vulberability Assessment` typo removed from
tertiary, all three now identical at 17 options) and directed that the 17 be used as the ranked
vocabulary. `Coastal Protection` and `Dam Rehabilitation/Removal` remain absent, so:

| Ranked type | Written to primary/secondary/tertiary as | Boolean also set |
|---|---|---|
| Coastal Protection | `Infrastructure Projects` | `coastal_protection` |
| Dam Rehabilitation/Removal | `Large Flood Control - Dams, Levees, Floodwalls; Safe Rooms` | `dam_rehabilitation_removal` |

Every substitution is logged. This hits the reference annex immediately — Glen Cove's CGC_2 is a
seawall study and CGC_1 a tide-gate repair, both Tier 1, neither writable as a Primary select value.

**3. Three select options had no tier**, because they exist only in the P/S/T vocabulary:
`Infrastructure Projects` → Tier 1 ranked last (structural, so the guardrails fire, but it loses to
any more specific Tier-1 type); `Risk/Vulnerability Assessment` → Tier 6 after
`Studies and/or Risk Assessment`; `Prevention/Mitigation Projects` → Tier 8 but ahead of `Other`, so
guardrail 5.6 still holds.

**One clause of the spec is inert, by design.** Guardrails 5.2 ("no type may move up more than 2
positions") and 5.4 ("unless it has Boost = −2") both reference a score-adjustment step that was never
defined. With `Final Score = Tier Score`, 5.2 can never trigger and 5.4 collapses into the same shape
as 5.3. That is a coherent, conservative reading and it produces deterministic output. Flagged rather
than silently patched — defining a boost rule later would activate two dormant guardrails at once.

### 5d. `Carried Forward to 2020 Plan` — what it is, and the default taken

You asked what this is. It's a row in Hagerty's prior-cycle action table (`6xN`, transposed), answered
Yes or No per 2014-cycle action. It means: *this action was not finished, so it reappears in the 2020
plan as a proposed action.* Glen Cove has one of each — a completed tide-gate study (`No`) and an
unbuilt improvement (`Yes. We need to complete the repairs.`).

**Decision (2026-08-21): a direct field map.** `Carried Forward = Yes` ⇒ `Included in Last HMP = Yes`.
Nothing else — no prior-to-proposed matching, no text preservation, no review flagging. All three were
dropped as unnecessary complexity, and this is much the better answer: the matching step would have
produced a few hundred machine-guessed links for a human to audit, in exchange for a field that is
already directly stated.

One consequence worth stating, because it reverses something earlier in this crosswalk: **the blanket
`Included in Last HMP = TRUE` constant on every prior-action row is retired** (marked `superseded`, not
deleted). That constant was defensible on its own terms — every prior-cycle action *was* in the 2014
plan — but if it stands alongside this rule, every prior action reads as carried forward and the field
stops distinguishing anything.

### 5e. MAW alternatives — first only

Each worksheet lists *No Action* (boilerplate, always `$0`) plus **two** real alternatives. Actions has
one `Alternative Action 1` / `Alternative Action 1 Evaluation` pair. Decision: **take the first real
alternative** — the row after No Action — and drop the second. Its per-alternative cost is dropped too,
there being no column for it.

Worth noting for the schema backlog even though it isn't being fixed now: **two independent
consultants both exceed this single slot.** Tetra Tech's annexes list 3–4 alternatives per action;
Hagerty's worksheets list 2. The one-slot design has never once been sufficient.

### 5f. The remaining small items — shoehorn verbatim, or register the omission

The rule (owner, 2026-08-21): **if a relevant column exists, put the value there unaltered; if not,
keep a record of the omission.** Applied to the "minor, but real" list, that homed everything except
five items — and three of the homes turned out to be real columns that the *workbook* simply doesn't
list.

| Item | Volume | Home |
|---|---:|---|
| MAW **`Level of Protection`** (*"10 year flood"*) | 139 | `Cost Benefit Notes`, appended labelled |
| MAW **`Useful Life`** (*"30 years"*) | 139 | `Cost Benefit Notes`, appended labelled |
| MAW **`Desired Timeframe`** (*"Six months"*) | 139 | `action_status_details`, appended labelled — a weak fit (it's the desired *start*, in a status field) but the only relevant free-text column, and the value is unaltered |
| MAW **alternative 2** + both alternative costs | 139 | `Cost Benefit Notes`, appended labelled — alternatives analysis *is* a benefit-cost input |
| Town of Hempstead **`Hamlet`** | 95 | `Address (if available)` |
| POC **street addresses** | ~102 | **`Roles.address_optional`** — a real column, absent from the workbook's Roles tab |
| Coastal Protection / Dam Rehab **specific type** | — | **`Actions.action_type_specific_if_applicable`** — a purpose-built column, absent from the workbook |
| Jurisdiction **adoption status** | 70 | `Jurisdictions.lhmp_planning_process`, appended labelled |
| Prior-action **`Required Changes`** | 284 | `action_status_details` — not lossy once each field keeps its own label |
| Table 2's **`Economy`** category | all | folded into `population_vulnerability`; verbatim string already preserved in `other_comments` |

**Three declared gaps were never gaps.** `Roles.address_optional`,
`Actions.action_type_specific_if_applicable`, and (on Suffolk) `Hazard Name, If Other` all exist in the
live sources and are missing from the workbook tab being mapped against. The lesson is now in Layer 1:
**read the live source before writing `gap-no-target`.** `dms raw get <source-id>` works anonymously and
takes seconds.

**Caution found while doing this:** `Actions.alternative_action_1` and
`alternative_action_1_evaluation` are both labelled **`(dep)`** — deprecated — in the live source. They
still accept writes, which is why alternative 1 still maps there, but the `Cost Benefit Notes` copy is
the durable record. Don't build anything that assumes those two columns survive.

### The omissions register

`references/mny-transcribe/Nassau/context/omissions-register.csv` — **generated from the crosswalk**,
never hand-maintained, so it cannot drift. Five entries:

| # | What | Why it has no home |
|---|---|---|
| 1 | **`Capabilities.Mitigation Connection`** | Required (C1/D3-b), skipped by decision — Hagerty states no per-capability mitigation narrative in any form |
| 2 | Table 2's **`Economy`** category | A structural fold into `population_vulnerability`; the verbatim string survives in `other_comments`, so this is a loss of *structure*, not of data |
| 3 | Table 6's **`Other Classifications`** row | A placeholder row label, not a capability. Needs a name to become a row, and the plan gives none |
| 4 | The **floodplain administrator's title with no name** (*"The City's Building Director is responsible for floodplain management"*) | A Roles row needs a person. The sentence is preserved in `nfip`, but no row can be created without inventing a name |
| 5 | **Per-action point of contact** | Not stated per action. The jurisdiction's Primary POC would be a substitution, not a source |

Items 3–5 are all the same shape: the plan names a *role* or *placeholder* where the schema needs an
*identity*. That is the one category where shoehorning would require inventing data, so it stays a
recorded omission.

---

### 5g. Second round of decisions (2026-08-21)

Six more, applied after the first pass.

**`Included in Last HMP` is a blanket TRUE, and it is authoritative.** Any action drawn from a plan we
are transcribing was in that plan — prior-cycle, completed and 2020 proposed alike. This reinstates the
constant that §5d had retired, and it means **`Carried Forward to 2020 Plan` does not drive this
column**. That field answers a different question (does the action continue *into* the next plan), MNY
has no column for it, so it is kept verbatim and labelled in `action_status_details` under the
shoehorn-or-register rule. No prior-to-proposed matching. This is now a Layer-1 standing rule, because
the trap is general: a consultant field that looks like it should drive this column usually shouldn't.

**Woodsburgh's Completed Mitigation Actions table is pulled**, with `Implementation Status = Completed`.
One annex of 51, two actions. Its 12-field set lacks `Project Number` and `Priority Ranking`, so
`Action Number` and `Local Priority` stay empty for those two rows.

**`No` is a filter only when the detail cell is empty.** The general conflict rule — *prefer the answer
carrying more information* — has a specific and slightly counter-intuitive consequence for the four
capability tables:

```
No  + empty detail      => create no row      (a genuine absence)
No  + non-empty detail  => CREATE the row     (a mis-ticked checkbox)
Yes                     => create the row
```

Glen Cove's NFIP ordinance is the worked example: Table 3 answers `No`, the NFIP section cites *Chapter
154, City Code, L.L. No. 6-2009* with an amendment date, so the capability is created. Its Table 4 does
the same thing for *Personnel trained in construction practices* / *Director of Building Department*.
**The §8 cross-check stays** — the rule says which value to load, not that the disagreement is
uninteresting. Log every override.

**County-level Hazards of Concern comes from the base plan, always.** Not a Nassau quirk — expect it
every county. And the base plan is *richer* than an annex here: tables 15–44 carry a `9x2` profile box
per hazard (*Rank · Potential Impact · Cascade Effects · Frequency · Onset · Hazard Duration · Recovery
Time · Impact*) plus the full ranked list in table 13.

| Base-plan field | Target |
|---|---|
| `Impact` (long narrative) | `general_vulnerability` — **real prose, county rows only** |
| `Frequency` (*"A Frequent Event"*) | `likelihood` — needs a qualitative→band mapping, owner sign-off before load |
| `Cascade Effects` (*"Yes, Highly Likely"*) | names no specific hazard, so it cannot fill `secondary_hazards`; verbatim to `other_comments` |
| `Rank`, `Potential Impact`, `Onset`, `Hazard Duration`, `Recovery Time` | verbatim, labelled, to `other_comments` |

So the county's `general_vulnerability` is a genuine transcription while its jurisdictions' is a derived
sentence. One builder cannot assume a single source.

**Identity is resolved.** Glen Cove takes **`3629113`** (the Place row, not the `3605929113` cousub
row); *Rockville **Centre*** is the correct spelling against the folder's *Center*. With those two
settled, `nassau-jurisdiction-aliases.csv` is built: **52 folders → 52 distinct geoids, zero
collisions** — 1 county, 2 cities, 3 towns, 46 villages.

**⚠ Four hazard vocabularies, not two.** Beyond the annex-vs-base-plan spelling differences already
noted, base-plan **table 13 re-partitions** the hazards rather than re-spelling them — it has
`Coastal Flooding/Wave Action` *and* `Flooding /Inland` where the annex has a single `Flooding`, plus
`Hurricane/ Coastal Storm` and `Winter Storm (Severe)`. Build one normalisation table across all four
and assert every label resolves before any join. Nothing here joins by name.
---

### 5h. Third round (2026-08-21) — and the answer on the 18 orphan jurisdictions

**The 18 are not CDPs.** The reconciliation is exact, and it changes the shape of the load:

| | Count | |
|---|---:|---|
| Attendance-matrix rows | **70** | base-plan table 0 |
| → `Adopting` | **52** | maps **1:1** onto the 52 annex folders |
| → `Withdrawn` | **18** | **all incorporated Villages**, real `Place` geoids, **zero CDPs** |

They are municipalities that engaged with the process and then withdrew before adoption — which is
exactly *why* they have no annex. And there is real content for them: **14 of the 18 have documented
meeting attendance** (25 marks; avg 1.39 of 7, against 4.19 for the adopting jurisdictions) and **34 of
the 190 roster people belong to them**, with names and titles.

Decision: **load Roles and Participation for all 70; everything else for the 52.** Nothing else exists
for the 18 — no annex means no Actions, Capabilities or HOC — so there is no risk of implying plan
coverage they don't have.

This promotes two things that were previously marginal:

- **`nassau-jurisdiction-aliases.csv` is now 70 rows, not 52**, keyed on geoid, carrying `has_annex`,
  `adoption_status`, `meetings_attended`, `pipeline` and `in_scope_for`. Zero collisions, zero CDPs, and
  every row appears in the attendance matrix (both asserted in code).
- **Adoption status stops being decorative.** §5f had it as a nice-to-have appended to
  `lhmp_planning_process`. It is now the *only* field distinguishing a jurisdiction that adopted the
  plan from one that engaged and withdrew — without it, 18 villages read as plan participants.

**The roster is where required-stakeholder evidence lives.** §5f listed `Required Stakeholder?` and the
non-municipal `Role` values as gaps. They aren't: **20 of the 190 roster people belong to 13
non-municipal organisations** — FEMA, NYS DHSES, NYSDEC, NYC Emergency Management, Suffolk County, the
Long Island Regional Planning Council, the NYS Floodplain & Stormwater Managers Association, the county
Soil & Water Conservation District, the Village Officials Association, and Hagerty itself (5 people).
Those rows are exactly the FEMA A2-a categories. Normalise the org strings first — *FEMA* and *Federal
Emergency Management Agency (FEMA)* are one entity, as are *NYS DHSES* and *New York State Department of
Homeland Security and Emergency Services*; there is also a stray plural *Villages of Woodsburgh*.

### The other five decisions

**Participation: two rows for a multi-date meeting.** 9 meetings → **11 rows**. The two cases are not
the same thing and should be labelled differently: *"February 19 and 20, 2020"* is genuinely two
webinars; *"June 25 – July 16, 2020"* is a three-week window of individual consultation calls the plan
never enumerates, so its two rows mark the window bounds.

**`likelihood` stays empty everywhere — county rows included.** The base plan's `Frequency` row gives a
qualitative phrase (*"A Frequent Event"*), not the percentage band MNY wants, so mapping it would be
invention. Kept verbatim in `other_comments` instead. Note this reverses §5g's proposal to map it with
sign-off; the answer is simply not to.

**`Roles.role` is a single select, so a role is the row entity.** A person with two roles becomes **two
Roles rows**, identical but for `role`. Row math is *people × roles*. The workbook's "Multi-Select" is
wrong — another entry for §6's list.

**Roles dedupe confirmed:** prefer the annex POC row (the only source with email and phone), enrich from
the roster, key on `(jurisdiction geoid, normalised name)`.

**`Action Point of Contact` stays empty** when no contact is associated with the action. Substituting
the jurisdiction's Primary POC would be a fabrication, not a source.

### Two bugs in my own alias builder, both caught by assertions

Worth recording because the failure mode was silent-looking:

- `seen` was keyed on the **annex folder's** spelling, so *Rockville Cent**er*** never matched the
  matrix's *Rockville Cent**re***, and the jurisdiction was emitted **twice** with the same geoid.
- The second pass **assumed** every leftover matrix row was a non-participant, which labelled that
  duplicate `Withdrawn` when its real status was `Adopting`.

Same mistake twice: trusting a derived key and an assumed category. The builder now keys on the
resolved crosswalk name and asserts that geoids are unique, that every jurisdiction appears in the
matrix, and that the leftovers really are all `Withdrawn`. The uniqueness assertion is the only reason
either bug surfaced.
---

## 6. The workbook is not the schema — seven divergences found

This section started as two findings and grew to seven as the mapping progressed. Taken together they
are the most portable lesson in this report: **the workbook is a mapping aid, and the live source is
the schema.** Three of the "no column exists" conclusions in an earlier draft were simply wrong,
because the column existed in the database and was missing from the tab being mapped against.

| # | Divergence | Which side is right |
|---|---|---|
| 1 | Capabilities *dictionary* ~110 columns vs *data* tab 86 — in **both** directions | Neither alone; read both |
| 2 | `Roles.address_optional` exists live, absent from the workbook Roles tab | **live** |
| 3 | `Actions.action_type_specific_if_applicable` exists live, absent from the workbook | **live** |
| 4 | `Hazard Name, If Other` on the HOC *data* tab, absent from the HOC *dictionary* (found on Suffolk) | **data tab** |
| 5 | `primary_action_type` had 16 options where secondary/tertiary had 17; `tertiary` carried a `Risk/Vulberability Assessment` typo | **neither** — a real defect, fixed by the owner 2026-08-21 |
| 6 | `Roles.role` is a single `select` live; the workbook says **Multi-Select** | **live** — and it changes the row math (one row per person *per role*) |
| 7 | `Roles.comments` is `lexical` live; the workbook says Text | **live** |

Reading the live attribute list costs seconds, needs no token, and would have prevented three wrong
conclusions:

```bash
dms raw get 1029065 | jq -r '.data.config | fromjson | .attributes[] | "\(.name)\t\(.type)\t\(.display_name)"'
```

Also grep the display names for **`(dep)`** before building on a column — `Actions.alternative_action_1`
and `alternative_action_1_evaluation` are both marked deprecated.

### 6a. The Capabilities dictionary/data split

**The Capabilities *Dictionary* tab and the Capabilities *data* tab disagree, and the dictionary is
the one with the columns you need.** The data tab has 86 columns; the dictionary describes ~110. Four
of the dictionary-only columns are exactly the FEMA capability categories that Hagerty's four
capability tables map onto 1:1:

| Hagerty table | FEMA category column (dictionary only) |
|---|---|
| Legal and Regulatory | `Planning & Regulatory` |
| Administrative and Technical | `Administrative & Technical` |
| Fiscal | `Financial` |
| *(none — Hagerty has no outreach table)* | `Education/ Outreach` |

Also dictionary-only: `Case Study Available`, `Buildings - Public` / `Buildings - Private`, `RL/SRL`,
the infrastructure booleans, `Climate Change Considerations`. Conversely the data tab has `Control #`,
`Trainings`, and `MOST or ALL formal hazards`, which the dictionary lacks.

This is the **mirror image of the Suffolk finding**, where the HOC data tab had a column
(`Hazard Name, If Other`) that the HOC dictionary omitted. Neither tab is authoritative on its own —
and as the table above shows, neither is the workbook.

### 6b. Glen Cove has two geoids

**Glen Cove has two geoids.** The workbook's `geoid-crosswalk` tab carries Nassau's reference
jurisdiction identities (138 rows), and Glen Cove appears twice:

| GeoID | Census Type | Jurisdiction Title |
|---|---|---|
| `3605929113` | `cousub` (lowercase) | Glen Cove (**city**) |
| `3629113` | `Place` | Glen Cove (**City**) |

Long Beach — the other city — has only one row (`3643335`, Place). *Hempstead* and *Oyster Bay* also
appear twice, but those are legitimately distinct entities (Town vs Village, Town vs CDP). Glen Cove
is a genuine duplicate that must be resolved before any load, or its content splits across two rows.

One name variant also needs an alias: the annex folder is **Rockville Cent*er***, the crosswalk row is
**Rockville Cent*re*** — 50 of 52 annexes match a geoid by name, and this is the one that doesn't
(the other is Glen Cove's ambiguity). As with Suffolk: **build the alias table first and key
everything on geoid.**

---

## 7. Corpus pre-flight (all 52 annex folders scanned)

Run with `references/mny-transcribe/Nassau/context/scripts/preflight.py`; output in
`extracted/preflight.json`.

**Uniformity is exceptional.** 51 of 51 readable annexes carry the same 12 headings, only four
paragraph styles exist corpus-wide (`Normal`, `Caption`, `Heading 1/2/3`), and Table 2's 11-hazard
list is byte-identical in all 50 annexes that have one.

**Measured volumes:**

| | Count |
|---|---:|
| Annex folders | 52 |
| Readable annex `.docx` | 51 |
| **Proposed actions** (14-field transposed tables) | **234** |
| **Prior-cycle actions** — transposed `6xN` | 135 |
| **Prior-cycle actions** — non-transposed variants | 147 |
| Completed actions (Woodsburgh only) | 2 |
| MAW `.docx` files | 139 |
| Jurisdictions with no prior actions at all | 20 |

**The nine variances to encode before batch-extracting.** Each one silently corrupts counts.

1. **Freeport is not a Hagerty annex at all.** Its file *is* PDF-only, but the document is the
   Village's own standalone **177-page "2020 All Hazard Mitigation Plan"** — 7 chapters, 10 hazard
   profiles with their own *Probability of Future Occurrences* and *Vulnerability/Impact* subsections,
   20 prose capability sections, and five hazards with no MNY type (Terrorism, Hazardous Materials,
   Cyber-Terrorism, Urban/Structural Fire, Epidemic/Pandemic). **None of the 12 spine headings appear.**
   Text extracts cleanly (356,988 chars via `pypdf`). The owner directed it be used; it needs its own
   crosswalk and is tracked as `pipeline = freeport-standalone`. Do not feed it to the annex parser.
2. **Nassau County's own annex has no Table 2.** It has the *Hazard Vulnerability* heading with no
   hazard-impacts table underneath, so the county gets no HOC rows from its annex. Its ranking comes
   from base-plan Tables 12/13 instead. *(The same "the county's own chapter uses a different
   instrument" pattern as Suffolk.)*
3. **Two annexes use non-transposed prior-action tables**: Nassau County `53x7` (adds
   *Primary Agency Responsible*) and Town of Hempstead `96x8` (adds *Reference Number* and *Hamlet*).
   These are row-per-action, not column-per-action — **the opposite orientation from everywhere
   else**. 147 of 284 prior actions live in these two tables.
4. **Woodsburgh has a "Completed Mitigation Actions" section** nobody else has, with a *third* field
   set (`12x3` — the proposed-action fields minus Project Number and Priority Ranking).
5. **Table row counts are not exact.** Long Beach's proposed-actions table is `15x8`, not `14x8` — a
   trailing empty row. Classify by the **column-0 label prefix** (`Project Number`, `Project Name`, …),
   never by row count.
6. **The Hazard Vulnerability heading contains authored content, doubled.** In 46 of 51 annexes the
   `Heading 2` text is `"<sentence><sentence>Hazard Vulnerability"` — the top-hazards sentence
   emitted twice, then the real heading. Five annexes (including Nassau County) have the clean
   heading with no sentence. The sentence's grammar also varies: Massapequa Park reads *"The hazard
   that impacts the Village of Massapequa Park most is Flooding."* Strip the duplicate, then parse.
7. **Malverne's title is styled `SectionTitle`, not `Heading 1`** — the only such case, and the
   reason the corpus has 50 `Heading 1`s for 51 annexes. Lattingtown has no *Previous Mitigation
   Actions* heading at all.
8. **File selection needed a review — now settled.** All 52 folders were reviewed file by file on
   2026-08-21 and the result is committed as `context/file-manifest.csv`. 47 are unambiguous; five
   needed a call, and **every mtime in the corpus is identical** (single delivery date) so authority had
   to come from content — same heading/table signature + more characters ⇒ later revision. Three
   worksheet-counting traps corrected the corpus total from 139 to **143**: `^MAW\d+` misses
   `MAW_3 NEW Williston Park.docx`; Garden City's two worksheets are in `archive/` only (a top-level
   scan reports zero); and its fourth is a PDF named after its project. **Use the manifest — don't
   glob and don't re-derive.**
9. **Lynbrook's Table 4 reports as `12x4`** (a duplicated *Details* header) — a horizontally merged
   cell. De-duplicate merged cells by `w:tc` element identity, not by comparing text.

Two label variants inside otherwise-fixed tables: Woodsburgh's Table 3 says *NFIP Flood Damage
Prevention **Law**(s)* and *Post Disaster Recovery **Law**(s)* where every other annex says
*Ordinance(s)*. Normalise before keying capability names.

---

## 8. A QA cross-check worth running on every annex

Glen Cove's **Table 3 row 11 says `NFIP Flood Damage Prevention Ordinance(s) = No`**, while its
**NFIP Summary paragraph 4 cites the ordinance by chapter and local law**: *"The Flood Damage
Prevention Ordinance was last amended 07/28/2009 and can be referenced in Chapter 154, City Code,
L.L. No. 6-2009."* Those cannot both be true, and a naive load creates a jurisdiction with no
flood-damage-prevention ordinance and a paragraph describing one.

A second instance of the same class: Glen Cove's **Table 4 row 7** answers `No` for *Personnel trained
in construction practices* yet fills in `Director of Building Department` as the Details.

Both are cheap to detect and localize a real document defect immediately — the Nassau analogue of
Suffolk's action-table-vs-prioritization-table cross-check. Assert:

- Table 3's NFIP-ordinance answer agrees with the NFIP Summary's ordinance citation.
- No capability row answers `No` while carrying a non-empty Details/Citation value.
- Proposed-action `Project Number` sets are contiguous within a jurisdiction, and the union across a
  jurisdiction's action tables matches its MAW `Project Number` set.
- MAW `Estimated Cost` equals the annex table's `Estimated Costs` for the same project number.

Glen Cove already fails the last one benignly (costs agree) but fails on names: MAW1 is
*"Sea Cliff Ave Flood Correction"*, the annex table calls the same project *"Sea Cliff Ave. Flood
Mitigation"*; MAW2 says *"Morgan Park Seawall"*, the annex *"Morgan Park Sea Wall"*. Prefer the annex
table's name, keep the MAW's, and flag the pair.

---

## 9. Recommendation: what to produce next

Same split that worked for Suffolk, with one change of emphasis.

| Artifact | Covers | Format | Rationale |
|---|---|---|---|
| **Crosswalk CSV** ✅ done | everything | CSV | The spec. Every downstream script cites a row of it. |
| **Jurisdiction alias table** | 52 folders → geoid | CSV | Do this **first**. Two identity problems already known (Glen Cove ×2, Rockville Center/Centre) and 70 base-plan jurisdictions vs 52 annexes to reconcile. |
| **Explicit file manifest** | 52 folders → 1 annex file + N MAW files | CSV | Nine folders need a human decision (§7.8). Committing the manifest makes the extraction reproducible. |
| **Workbook tabs** | Roles, Capabilities, Hazards of Concern, Participation | `.xlsx` copy | Native shape for flat data; matches how DHSES reviews. |
| **Actions tab** | 234 proposed + 284 prior + MAW enrichment | `.xlsx` | No consultant-delivered actions workbook exists for Nassau — **all of it is ours to build.** |
| **Per-jurisdiction markdown** | the 6 Jurisdictions lexical columns | `.md` | Owner-review surface for the prose. |
| **Lexical JSON payloads** | same 6 columns | `.json` | Compiled from the markdown; feeds `dms dataset update`. |

**The one structural difference from Suffolk: there is no consultant actions workbook.** Tetra Tech
delivered `Suffolk_County_Actions_2.0_reconciled v2.xlsx` (523 rows), so Suffolk's proposed actions
were `already-delivered`. For Nassau, all 234 proposed actions and all 284 prior actions must be
extracted from the docx. That makes Actions the largest single piece of work — but also the cleanest,
because the transposed 14-field table is completely regular.

### Sequencing

1. ~~**Owner decisions on §5**~~ ✅ **DONE 2026-08-21.** All resolved; §5 rewritten as decisions. Every
   `gap-no-target` is closed and no schema additions were made. The one live schema change was the
   owner's own fix to the three `*_action_type` columns.
2. **Resolve identity** — alias table + the Glen Cove duplicate geoid + reconcile the 70 base-plan
   jurisdictions against the 52 annexes.
3. **Commit the file manifest** (§7.8), including a decision on Freeport.
4. **Batch-extract the 51 Hagerty annexes + 143 worksheets** per `file-manifest.csv`, with the nine
   variances encoded first. Freeport runs separately.
5. **Extract the three base-plan tables** for Roles and Participation.
6. **Generate the flat tabs + per-jurisdiction markdown**; run the §8 QA assertions and produce a
   punch-list.
7. **Owner review**, then compile and load.

Step 7's flat-dataset import path is the same unknown flagged in the Suffolk report and is still not
established.
