# Document-class profile: independent jurisdictional plan

Layer-2 profile for [`transcribing-a-consultant-plan.md`](../transcribing-a-consultant-plan.md).

> **⚠ This is not a consultant profile, and it cannot work like one.**
>
> Every other file in `profiles/` answers *"how does this firm structure a plan?"* — and because a
> firm is consistent, [`tetratech.md`](./tetratech.md) genuinely **predicts** the next Tetra Tech
> county. An independent jurisdictional plan has **no shared author**, so nothing here predicts the
> next instance's structure. Two independent plans from neighbouring villages may share nothing but
> the FEMA requirements they were both written to satisfy.
>
> So this profile's value is different: **a triage checklist, an inventory of what always transfers,
> and the recurring primitives** — not a spine to parse against. Read it to size the work fast and
> avoid the traps; expect to write a fresh parser each time.

**Instances seen:** Village of Freeport, Nassau County — *2020 All Hazard Mitigation Plan*, 177 pages,
PDF-only (analyzed 2026-08-21).
**Script:** [`scripts/nassau/extract_independent_plan.py`](../scripts/nassau/extract_independent_plan.py) — validated on Freeport.
**Output:** `references/mny-transcribe/Nassau/context/extracted/independent_3627485.json` (git-ignored)

---

## 1. Recognising one — the filename is not evidence

Freeport's file is named **`51_Village of Freeport_Jurisdictional Annex.pdf`** and sits in the
county's `All Annexes/` folder alongside 51 real annexes. It is not an annex. It is the Village's own
standalone plan, and **none of the consultant's 12 spine headings appear in it.**

The test is structural, and it costs one extraction:

```
consultant annex   -> the firm's fixed heading set, in the firm's fixed order
independent plan   -> its own numbered chapters, its own ToC, a References section
```

Two cheap tells that it's standalone: a **table of contents** (an annex never has one) and a
**Plan Adoption / Plan Maintenance chapter** (an annex inherits the county's). Freeport has both.

**Assert the spine before you trust the folder.** The corpus pre-flight already reports heading sets
per file; one file whose heading set matches nothing is the signal.

## 2. The structural insight: it's a county plan scoped to one municipality

This is the most useful thing in this profile. An independent jurisdictional plan is **not a big
annex** — it is a **small county plan**. Compare spines:

| Nassau County base plan | Freeport standalone plan |
|---|---|
| Introduction · Planning Process · Community Profile | 1 Introduction · 1.5 Planning Process · 1.6 Community Profile · 1.7 Critical Facilities |
| Hazard identification, declarations, ranking | 2 Hazard Risk Analysis · 2.1 Identification · 2.2 Declarations · 2.3 Hazards Impacting |
| Per-hazard profiles with vulnerability | 3 Hazard Profiles and Vulnerability (3.1–3.10) |
| Capability assessment | 4 Summary of Existing Capabilities (4.1–4.20) |
| Mitigation strategy | 5 Mitigation Strategy · 5.1 Goals, Objectives, and Actions |
| Plan maintenance | 6 Monitoring, Evaluating, Updating · 6.2 Plan Adoption |

**So reach for the county-plan machinery, not the annex machinery** — the base-plan extractor and
[`loading-a-plan-into-a-2.0-pattern.md`](../loading-a-plan-into-a-2.0-pattern.md) are the closer
analogues. The one thing that changes is the geoid: everything is scoped to a municipality, so
content that would be county-level in a base plan is jurisdiction-level here.

## 3. What transfers, measured

| Layer | Reuse | Why |
|---|---|---|
| **Method** (Phase 0–7, crosswalk-then-extract, QA-as-defect-localiser, shoehorn-or-register) | **~100%** | Nothing about it depends on the source's shape |
| **Target side** (the six datasets, dispositions, geoid identity, insert-vs-update, the Action Type tier table, lexical compilation) | **~100%** | The MNY side does not care where content came from |
| **Parsing** (`annex_lib.py`, `extract_annexes.py`) | **~0%** | Different format, no table geometry, a prose instrument. `python-docx` + table-shape classification is inapplicable |
| **Identity / manifest discipline** | **100%** | Still keyed on geoid; the manifest just records a different `pipeline` |

The honest summary: **the thinking transfers, the code does not.** Budget a new parser per instance —
for Freeport it was ~150 lines, an afternoon, not a rewrite of the pipeline.

## 4. The transferable primitive: in a PDF, prose beats tables

Counter-intuitive and worth internalising, because it inverts the consultant-annex instinct.

A PDF text layer **destroys table geometry** — Freeport's 360 KB of extracted text contains **zero**
tab-separated lines and six accidental multi-column lines. Its action summary table on page 121 comes
out as one run-on string:

> `2.3.3 Investigate new regulations for mitigation Moderate Trustees, attorney Administrative Village operating budget Unknown New Floodplain Management Code…`

Unparseable without column geometry. But the **same data appears again** in §5.1 as labelled prose,
and labels survive extraction perfectly:

```
Action 1.1.1: Install an additional siren on the southern end of Guy Lombardo Avenue.
   Priority/timetable:  High
   Responsible Party:   Emergency Management
   Estimated Cost:      $20,000
   Source of Funds:     NYS DOS Community Grant program
   Financial and Political Feasibility: Installing an additional siren can be accomplished…
   Hazards Addressed:   Tornados, Severe Storms, Flooding
   Progress Since 2014: The Village has an Emergency Siren Warning System…
```

**Target the labelled prose and treat the summary table as the lossy duplicate.** Split on the record
delimiter (`Action N.N.N:`), then walk the labelled fields inside each block. Measured coverage on
Freeport's 53 actions:

| Field | Coverage |
|---|---|
| `Priority/timetable` · `Responsible Party` · `Estimated Cost` · `Source of Funds` · `Hazards Addressed` | **53 / 53** |
| `Financial and Political Feasibility` | 52 / 53 |
| `Progress Since 2014` | 51 / 53 |

That is **better per-action field coverage than any Hagerty annex**, from a PDF.

## 5. Freeport's content inventory (the worked instance)

| What | Count | Target |
|---|---:|---|
| Goals | 3 | `LHMP Goals/Objectives` |
| Objectives | 10 | `LHMP Goals/Objectives` |
| **Actions** | **53** | **Actions** |
| Committee members (name · organization · title) | 22 | **Roles** |
| Capability sections (numbered prose) | 20 | **Capabilities** |
| Hazard profiles | 10 | **Hazards of Concern** |
| ToC entries (the spine) | 123 | — |

**The Goal → Objective → Action hierarchy is encoded in the action number.** `Action 1.1.1` means
goal 1, objective 1, action 1 — so `LHMP Goals/Objectives` has a real structured source here, better
than Hagerty's bare digits. The three local goals still need mapping onto the six SHMP goal booleans,
which is a judgement call.

### Action field map

| Freeport field | MNY Actions column |
|---|---|
| `Action N.N.N` | `action_number` |
| the text after the number | `action_name` |
| `Priority/timetable` | `Local Priority` — note the vocabulary is **High / Moderate / Low**, not Medium |
| `Responsible Party` | `Lead Agency/ Department*:` |
| `Estimated Cost` | `Estimated Cost ($)` + a derived `Cost Range`. Often prose (`No additional costs`, `Administrative`) |
| `Source of Funds` | `Potential Primary Funding Sources*:` |
| `Hazards Addressed` | `Primary/Secondary/Tertiary Hazard Type`. Comma list; sometimes just `All` |
| `Financial and Political Feasibility` | `Cost Benefit Notes` — authored, and has no better home |
| `Progress Since 2014` | `Action Status Details`, and **derive `Implementation Status`** from it (*"Project has been completed"* ⇒ Completed, *"None"* ⇒ Proposed) |

`Included in Last HMP = TRUE` for all of them, per the standing rule — this *is* a plan we are
transcribing.

### Taxonomy: it OVER-runs MNY (the Suffolk case, not the Nassau one)

Five of Freeport's ten hazards have **no MNY type**: **Terrorism · Hazardous Materials · Cyber-Terrorism
· Urban/Structural Fire · Epidemic/Pandemic**. Per the standing rule these become `Hazard = Other`
with the verbatim name in `hazard_name_if_other`. `Nor'easter/Winter Storm/Ice Storm` is a combined
profile needing the split treatment.

Note the contrast worth carrying: **the county's consultant plan under-ran MNY's taxonomy and closed
cleanly; one village's own plan over-ran it.** Do not infer a county's taxonomy shape onto an
independent jurisdiction inside it.

### Capability sections are problem-oriented, and several are not capabilities

Freeport's §4 headings are named for *problems*, not capabilities — `4.3 FLOODING ON ROADS`,
`4.4 FLOOD DAMAGE FROM TIDAL WATERS BACKING UP THROUGH STORM DRAINS`,
`4.5 IMPACT OF FLOODING ON RESIDENTIAL AND COMMERCIAL PROPERTIES`. Others are genuine capabilities
(`4.15 FLOODPLAIN MANAGEMENT CODE`, `4.16 MUTUAL AID AGREEMENT`, `4.18 PUBLIC SAFETY COMMITTEE`).

**Triage §4 section by section** — some rows belong in Capabilities and some are problem statements
belonging to `lhmp_problem_areas`. There is no Yes/No column to filter on, so the detail-beats-checkbox
rule has nothing to act on either.

## 6. Extraction traps

**Read the spine from the TABLE OF CONTENTS, not the body.** Heading detection over body text matched
critical-facility address lines — `14 ROUTE ROAD`, `2810 MERRICK RD EAS`, `700 SOUTH OF S` — as
numbered headings, and running heads repeat on every page. The ToC's `N.N TITLE ..... page` rows are
unambiguous. This took the spine from 51 noisy entries to 123 clean ones.

**ToC titles can contain periods.** Two of Freeport's twenty capability titles end with one, so a
title pattern of `[^\n.]+` before the dot-leader silently dropped them (18 of 20). Match non-greedily
up to a run of **three or more** dots instead.

**One document needs TWO normalisations.** The action instrument reads best from *flattened* text —
PDF line breaks are meaningless mid-sentence. But the committee roster is **one member per line**
(`Ray Horton, Freeport Police Department, Chief of Police`), and flattening destroys the only
delimiter it has. Parse actions flattened and the roster line-anchored, in the same run. Getting this
wrong returns 0 committee members with no error.

**Strip running heads before flattening**, or `Village of Freeport All Hazard Mitigation Plan` appears
177 times mid-sentence.

**Check the text layer is real before planning anything.** Freeport extracted 356,988 characters from
177 pages — genuinely text-bearing, no OCR needed. A scanned plan is a different and much larger
problem; probe first (`pypdf`, chars-per-page) rather than discovering it mid-extraction.

## 7. Triage checklist for the next one

1. **Confirm the class.** Does it have a ToC and a Plan Adoption chapter? Does its heading set match
   the county consultant's? If it fails the spine check, it's independent.
2. **Probe the text layer** — chars per page. Below ~500/page, suspect a scan.
3. **Read the ToC** and record the chapter spine. That is your map and your parse target.
4. **Find the action instrument and its record delimiter.** Look for a repeated labelled block
   (`Action N:` … `Priority:` …). Prefer it over any summary table.
5. **Find the roster**, and note whether it is line-per-member or prose.
6. **Diff its hazard list against MNY's 17** — expect over-run, and expect combined profiles.
7. **Triage the capability chapter** section by section; some entries will be problem statements.
8. **Register it in the manifest and alias table** with its own `pipeline` value so it never enters
   the annex batch. Nassau uses `pipeline = freeport-standalone`; a generic value would be
   `independent-plan`.
9. **Write the crosswalk before the parser.** Same rule as everywhere else.
