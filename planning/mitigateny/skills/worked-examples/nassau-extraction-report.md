# Nassau extraction run (Phase 6)

**Consultant:** Hagerty Consulting · **Plan:** Nassau County Multi-Jurisdictional HMP, 2020-12-16
**Crosswalk:** 185 mappings — [`nassau-annex-crosswalk-report.md`](./nassau-annex-crosswalk-report.md)
**Scripts:** [`scripts/nassau/`](../scripts/nassau/) — `annex_lib.py`, `extract_annexes.py`, `extract_maws.py`, `extract_baseplan.py`, `extract_independent_plan.py`, `align_independent_plan.py`, `verify_group.py`, `qa_assertions.py`
**Output:** `references/mny-transcribe/Nassau/context/extracted/` (git-ignored)
**Date:** 2026-08-21

---

## 1. What came out

Every measured total matches the Phase-3 pre-flight prediction, which is the main thing this run
had to prove.

| Output | Count | Pre-flight said |
|---|---:|---|
| Jurisdictions extracted | **51** | 51 readable annexes ✓ |
| Points of contact | **102** | 51 × 2 ✓ |
| Hazard-impact rows | **550** | 50 × 11 (the county has no Table 2) ✓ |
| Capabilities | **894** | — |
| Prior-cycle actions | **282** | 282 ✓ |
| Completed actions | **2** | 2 (Woodsburgh only) ✓ |
| Proposed actions | **234** | 234 ✓ |
| Worksheets parsed | **142** | 142 ✓ |
| Participation rows | **11** | 9 meetings → 11 rows ✓ |
| Attendance marks | **243** | 243 ✓ |
| Roster people | **190** | 190 ✓ |

Capabilities break down as Legal and Regulatory 425 · Administrative and Technical 270 · Fiscal 172
· Community Classification 27.

## 2. The single most valuable finding: 27 ordinances nearly went missing

The owner's rule is *prefer the answer carrying more information*. I implemented it **only within a
table row** — a `No` answer with a non-empty detail cell creates the capability anyway. The QA pass
then flagged **29 of 51 jurisdictions** with an NFIP-ordinance conflict, which was far too many to be
a coincidence, so I checked three by hand rather than softening the check:

> *"The Flood Damage Prevention Ordinance was last amended 07/28/2009 and can be referenced in
> Chapter 154, City Code, L.L. No. 6-2009."* — Glen Cove, whose Table 3 answers **No**.

The detail was real; it just wasn't in the table. **Hagerty puts the ordinance citation in the NFIP
Summary prose, not in Table 3's citation column** — so applying the rule row-locally loses the
flood-damage-prevention ordinance for more than half the corpus.

The extractor now reads the NFIP prose as detail too, requiring an actual citation (a date, `Chapter`,
`§`, or `L.L.`) rather than a bare mention. That recovered **27 new capability rows** and enriched 3
existing ones — Capabilities went 867 → **894**.

**Two jurisdictions correctly still fail.** Lattingtown and Woodsburgh say only *"The Flood Damage
Prevention Ordinance … meets minimum requirements"* — no date, no citation. There is nothing to
override the checkbox with, so they stay HIGH for a human.

## 3. Three parser bugs the corpus found

Each was silent — the run succeeded and the payload was quietly short.

**Five annexes fuse a footnote marker into the header cell.** `"1Primary Point of Contact"` — a
superscript reference lands in the same run. Exact-match classification dropped the *entire contact
table* for Roslyn Harbor, Russell Gardens, Sands Point, Sea Cliff and South Floral Park: 92 contacts
instead of 102, with no error. `delabel()` now strips leading and trailing footnote digits before
classification. *(Tetra Tech does the same thing with trailing digits on hazard names — `Flood1` — so
the helper handles both ends.)*

**The POC cell is one paragraph with `<w:br/>` line breaks, not several paragraphs.** `para_text()`
walks `w:t` nodes and joins with `''`, so the breaks vanish and the cell reads
`Mayor Timothy Tenke, MayorCity of Glen Cove9 Glen Street…`. `cell_lines()` honours both breaks and
paragraph boundaries; without it, name/title/agency/address cannot be separated at all.

**`endswith` matched the parent heading first.** `"Legal and Regulatory Capability Assessment"`
ends with `"Capability Assessment"`, so a shortest-first scan filed all four capability subsections
under their parent and **every `capability_summaries` value came out empty** — silently losing the
one authored capability narrative in the annex. Match exact-first, then longest-suffix-first.

A fourth, in the base-plan extractor: the per-hazard `9x2` profile boxes have a **merged banner row**,
so after merged-cell de-duplication row 0 has *one* cell, not two. A `len(row0) >= 2` guard found zero
boxes. And the six not-profiled hazard names are separate paragraphs inside two merged cells, so
`cell_text`'s single-space join destroyed the boundaries — `'Avalanches Geomagnetism Ice Jams'` as one
string.

## 4. The punch-list — 115 findings, **0 open** after adjudication

`context/qa-punchlist.csv`. Every check is designed to localise a **document** defect; the HIGH rows
are ones a human should read before loading.

**The punch-list carries its own dispositions.** `qa-resolutions.csv` maps each check to the owner's
ruling, and `qa_assertions.py` joins it on every run — so a regenerated punch-list shows what was
decided rather than re-presenting settled findings as open. After adjudication on 2026-08-21:
**115 findings, all resolved, none open.**

| Severity | n | Check |
|---|---:|---|
| high | 5 | `maw-cost-mismatch` |
| high | 4 | `maw-orphan-project` |
| high | 2 | `nfip-ordinance-conflict` |
| high | 1 | `systematic-checkbox-defect` |
| medium | 28 | `nfip-ordinance-conflict` (override applied; verify the citation) |
| low | 40 | `checkbox-detail-override` |
| low | 23 | `maw-name-mismatch` |
| low | 9 | `cost-not-comparable` |
| low | 2 | `missing-top-hazards-sentence` |
| info | 2 | `independent-plan-taxonomy` · `independent-plan-shape` (Freeport — expected differences, not defects) |

### Adjudicated 2026-08-21

| Ruling | Effect |
|---|---|
| **The WORKSHEET wins whenever an annex and a worksheet disagree** — reversed on review; the worksheets are more detailed and intentional | closes 5 HIGH cost mismatches and 23 LOW name mismatches with no per-finding review |
| **Lattingtown / Woodsburgh NFIP: no action** — the prose says only *"meets minimum requirements"*, with no date and no citation, so there is nothing to support creating a capability | closes 2 HIGH |
| **Muttontown's checkboxes are unreliable wholesale** — the override already applied to all 10 rows, so the extract is correct as-is | closes 1 HIGH |
| **The 28 MEDIUM NFIP overrides stand** — the county reviews this document later, so citation spot-checking is not a blocker here | closes 28 MEDIUM |
| **The LOWs are non-issues or already answered** | closes 74 LOW |

### The four orphan worksheets, and why each needed a different answer

These were the last open items, and none of them yielded to a precedence rule — precedence needs two
statements about the *same thing*, and an orphan by definition has only one side. Each was resolved on
its own evidence:

| Jurisdiction | Finding | Resolution | The evidence |
|---|---|---|---|
| **Muttontown** | worksheets `VMP_1/2`, annex `VMTT_1/2` | correct the **worksheet** to `VMTT_*` | Responsible Organization reads *"Village of Muttontown"*; project names match; problem narratives match near-verbatim |
| **Cove Neck** | worksheet `VCN-1`, annex `VCN_1` | correct the **annex** to `VCN-1` — use the hyphen | consistent with worksheet-precedence |
| **Oyster Bay (T)** | `TOB_14` has no annex row | **keep it** as a worksheet-only action | the annex table stops at `TOB_13`; the worksheet carries every field an action needs |
| **Village of Hempstead** | one worksheet numbered `"VOH_1, … VOH_8"` | **programme-level roll-up** — precedence deliberately *not* applied | its `$1,005,000.00` is **exactly** the sum of the eight annex costs |

**The Village of Hempstead case is the one worth remembering.** Applying worksheet-precedence
naively would have replaced eight specific firehouse projects — East End `$100,000`, Kennedy Memorial
Park `$180,000`, Victory `$120,000`, Weir Street `$70,000`, West End `$95,000`, Jerusalem Ave
`$155,000`, Headquarters `$155,000`, Southside `$130,000` — with one generic *"Emergency Generator
Installation"* and **inflated the cost eightfold**.

The arithmetic is what proves it: `100+180+120+70+95+155+155+130 = 1,005,000`, exactly the worksheet
figure. So the worksheet is a *different granularity*, not a competing claim, and precedence does not
apply between granularities. Keep the eight; attach the worksheet's worksheet-only fields (Level of
Protection, Useful Life, Local Planning Mechanisms, alternatives) to all eight as shared context.

**A cheap general test falls out of this:** when one worksheet claims several project numbers, sum the
component costs. If the sum equals the worksheet's cost, it is a roll-up.

### ⚠ Project numbers are unique only WITHIN a jurisdiction

Found while resolving Muttontown, and it is the most portable lesson here. **`VMP_1` and `VMP_2` are
genuine project numbers in two *other* annexes** — Massapequa Park and Munsey Park — because Munsey
Park, Muttontown and Massapequa Park all abbreviate to `VMP`. 285 distinct numbers cover 287 actions.

- **Join worksheets on `(geoid, project_number)`.** A global join would silently file one village's
  worksheet detail under another village's action.
- **Key correction tables on `(folder, wrong_number)`.** Correcting `VMP_1 → VMTT_1` by number alone
  would have rewritten Massapequa Park's and Munsey Park's real actions.

The extractor already joined per-geoid, so nothing was contaminated — but that was luck, not design.
It is now a Layer-1 rule.

### Precedence: the worksheet overrides the annex

Set annex-first on 2026-08-21, then **reversed the same day on review** — the worksheets are more
detailed and more intentional. Two things this rule needs, both measured rather than assumed:

**It governs 59% of the actions, not all of them.** Only **137 of 234** Hagerty proposed actions have
a matching worksheet; the other **97 take the annex value unchanged**. So the loader needs both paths,
and "the worksheet wins" is not a licence to ignore the annex.

**Muttontown receives no worksheet detail at all.** It is the one jurisdiction where *zero* actions
match — its worksheets are numbered `VMP_*` against annex `VMTT_*`. Until that prefix mismatch is
resolved the precedence rule simply cannot reach it, which is a second reason its punch-list entry
stays open.

**Cost is the one field where the rule needs a mechanical split.** `Estimated Cost ($)` is *numeric*
live, and **72 of 142 worksheet cost cells are not parseable numbers**:

> ranges — `$10,000-$25,000` · rates — `$250/year`, `$42,000 per year` · bounds —
> `Less than $1,000,000` · qualitative — `TBD`, `To be determined`, `Unknown (Low)`,
> `Several million dollars`

So the worksheet text goes verbatim to `Cost Notes` (always), and the *numeric* slot takes the
worksheet figure when it parses, else the annex figure, else stays empty. That is a mechanical
necessity of a numeric column, not a softening of the rule.

### A parser bug the reversal exposed

Worth recording because the reversal is what made it matter. `VRG_1` leaves its **Level of
Protection**, **Useful Life** and **Estimated Cost** cells empty. My pair-walker took "the next
non-empty cell to the right" — which was the *adjacent label* — so its cost read
`"Estimated Benefits (losses avoided):"`. Under annex-precedence that value lost anyway; under
worksheet-precedence **it would have won and loaded**. The walker now stops at any cell ending in
`:`, and zero label-as-value cells remain corpus-wide.

**The four orphan worksheets are the most interesting**, because each is a different failure:

| Jurisdiction | Finding |
|---|---|
| Cove Neck | worksheet says `VCN-1`, annex says `VCN_1` — **hyphen vs underscore** in the project-number separator |
| Muttontown | worksheets say `VMP_1`/`VMP_2`, annex says `VMTT_1`/`VMTT_2` — **wrong jurisdiction prefix** |
| Village of Hempstead | one worksheet's Project Number is the string `"VOH_1, VOH_2, … VOH_8"` — **one worksheet covering eight projects** |
| Oyster Bay (T) | worksheet `TOB_14` has no matching annex action |

**`maw-cost-mismatch`** caught five real disagreements — Great Neck Estates has `VGNE_1` and `VGNE_2`
costs **transposed** (50,000↔10,000), Upper Brookville differs on both its actions, and Long Beach's
`CLB_15` is 32,332,175 vs a round 32,000,000.

**Muttontown is the one systematic case:** 10 capability rows answer `No` while naming a real
capability, a real person or a real ordinance. Its checkboxes are unreliable as a whole, not row by
row.

### One QA check was my bug, not a defect

`maw-cost-mismatch` initially reported 13. Four were my money parser grabbing a fragment out of prose
— `"~$30-$50 per linear foot"` → 30, `"approximately $3M"` → 3, `"1 Million"` → 1 — and comparing it
against a clean annex figure. It now refuses to parse a cell containing unit or hedge words and
reports `cost-not-comparable` instead, which is the honest finding. **A QA check that fires on half
the corpus is usually the check, not the corpus — but verify which before you soften it.** Here the
NFIP check firing 29 times was real and the cost check firing 13 times was not.

### Freeport's hazard mapping is settled

Owner rule: shoehorn into a comparable MNY hazard where one exists; otherwise create a **new row**
with `Hazard = Other` and `Hazard Name, If Other` set to the plan's own hazard name verbatim.
Committed as `context/freeport-hazard-map.csv` — 23 rows:

| Kind | n | Detail |
|---|---:|---|
| **named** | 7 | Hurricane · Wind · Flooding · Ice storm · Snowstorm · Earthquake · Tornado |
| **Other** (inserts) | 6 | Nor'easter · Terrorism · Hazardous Materials at Fixed Sites and in Transit · Cyber-Terrorism · Urban/Structural Fire · Epidemic/Pandemic |
| **not profiled** → `No` | 10 | Avalanche · Coastal Hazards · Drought · Extreme Cold · Extreme Heat · Hail · Landslide · Lightning · Tsunami/Seiche · Wildfire |

Two things worth stating explicitly:

**`Urban/Structural Fire` is deliberately NOT mapped to Wildfire.** They are different hazards, and
Freeport profiles no wildfire at all — shoehorning it would assert a wildfire assessment the plan
never made.

**Six `Other` rows, not five** — `NOR'EASTER/WINTER STORM/ICE STORM` is *three* hazards in one
heading. Winter Storm → Snowstorm and Ice Storm → Ice storm both shoehorn, but Nor'easter has no MNY
type and needs its own `Other` row. Easy to miss by counting headings instead of hazards.

### The Suffolk-era `Other` blocker is retired

The Suffolk crosswalk recorded that `hazard` "has no `Other` option", which would have blocked all six
inserts. Checked against all **27,791** stored HOC rows on 2026-08-21:

> `Other` — **271 rows** · `other` — 3 rows · `None` — 2 rows · and **275 rows already set
> `hazard_name_if_other`**

So it is not merely allowed, it is established practice. Use the **display label `Other`** (271 rows),
not the internal code `other` (3 rows).

**This makes Freeport the corpus's only HOC inserts.** The county math moves from *884 updates + 306
untouched + 0 inserts* to **884 updates + 306 untouched + 6 inserts** — Freeport's own 17 pre-seeded
rows are updated, and its 6 `Other` rows are new.

## 5. Corpus facts worth carrying forward

- **66 of 142 worksheets have a file index that disagrees with the project number.** Empirical
  confirmation of the join-on-project-number rule: nearly half would be mis-filed by filename.
- **132 instruction-template tables skipped** across 142 files — every worksheet carries one, and
  loading it would import DHSES's own guidance text as authored content.
- **The base plan's `9x2` banner is not a unique hazard key** — 12 boxes for 11 hazards, with
  *Severe Storm* used three times (for the severe-storm, lightning and wind profiles).
- **Nassau County's own annex has 52 prior actions and 14 proposed** — by far the largest, and its
  prior actions are row-wise rather than transposed, as is Town of Hempstead's 95.

## 6. Aligning the 52nd record — one group, one code path

Freeport was extracted on its own schema (`independent_<geoid>.json`). Before Phase 7 it was
**reshaped into the annex envelope** so all 52 jurisdictions sit in `extracted/annexes/` and a
builder never special-cases it — `align_independent_plan.py`.

**A reshape, not a transformation.** No value is reworded, re-cased, normalised, bucketed or
inferred; only the *key* a value sits under changes. Two assertions run on every pass and both must
hold:

| Guarantee | Result |
|---|---|
| nothing **altered** — every source value appears verbatim in the output | PASS, 700 values checked |
| nothing **dropped** — every source leaf survives somewhere | PASS |

Where the document class has no analogue the field is present and **empty**, and `_alignment`
records *why* — so an empty field is never mistaken for a failed extraction. Four judgement calls,
all recorded in the record rather than in a commit message:

- **`contacts` ← the planning committee.** No primary/alternate designation exists in the source, so
  `slot` is `committee` and the HM-representative flag is **left blank rather than invented**.
- **All 53 actions are filed as `proposed_actions`.** The source lists them under one forward-looking
  strategy; completion status stays verbatim in `Progress Since 2014` for Phase 7 to derive from.
  Bucketing them here would be inference.
- **`Financial and Political Feasibility` and `Progress Since 2014` keep their own keys.** Feasibility
  is not `Estimated Benefits`, and progress is not a proposed-action field at all — forcing either
  into a column that means something else would corrupt the meaning while looking tidy.
- **`3.11 CATEGORIZATION OF HAZARDS` is a section, not a hazard**, so it is excluded from
  `hazard_impacts` and preserved under `non_hazard_sections`.

### The cohesion check earned its keep immediately

`verify_group.py` asserts one code path reads all 52: same envelope keys, same list-element keys, one
record per in-scope jurisdiction, counts matching list lengths, no geoid drift. It also reports how
many distinct `proposed_actions` key sets exist — and that number found **two Hagerty label variants
nobody had noticed**:

| Jurisdiction | Label in the source | Actions affected |
|---|---|---|
| Bayville | `Hazard Ranking` | 5 |
| Sea Cliff | `PriorityRanking` (no space) | 2 |

Both hold `High`/`Medium`/`Low` — verified before aliasing, since a label reading *Hazard* Ranking
could plausibly have held hazard names. Left alone, **7 actions would have lost `Local Priority`
silently** in Phase 7. The extractor now canonicalises action labels (whitespace-insensitive, plus one
alias), warns on each variant, and records the original under `_source_labels`.

After that fix, **all 14 canonical action keys are present in every one of the 287 actions** across
both document classes.

**Group totals:** 123 contacts · 560 hazard rows · 914 capabilities · 282 prior · 2 completed ·
**287 proposed actions** · 52 records.

QA is now `document_class`-aware: Freeport's legitimate differences report as **2 `info` findings**
instead of five false defects, and the HIGH count stays at 12.

## 7. What Phase 6 did not do

- **Freeport's capability section bodies and Community Profile prose** are not extracted — its
  `capabilities[].description`, `nfip_paragraphs` and `profile_paragraphs` are empty by design, and
  `_alignment` says so. The section text exists in the source if it is wanted.
- **Garden City's fourth worksheet** is a one-page PDF (`VGC_4 …pdf`); the two `.docx` worksheets in
  its `archive/` folder were parsed, the PDF was not.
- **No transformation.** Everything above is *source-shaped* JSON — verbatim cell values keyed by the
  annex's own labels. Taxonomy mapping, vocabulary translation, the Action Type tiering and lexical
  compilation all belong to Phase 7.
- **Nothing was written to `mitigat-ny-prod`.**
