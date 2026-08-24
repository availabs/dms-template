# Nassau extraction run (Phase 6)

**Consultant:** Hagerty Consulting · **Plan:** Nassau County Multi-Jurisdictional HMP, 2020-12-16
**Crosswalk:** 180 mappings — [`nassau-annex-crosswalk-report.md`](./nassau-annex-crosswalk-report.md)
**Scripts:** [`scripts/nassau/`](../scripts/nassau/) — `annex_lib.py`, `extract_annexes.py`, `extract_maws.py`, `extract_baseplan.py`, `qa_assertions.py`
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

## 4. The punch-list — 115 findings, 12 at HIGH

`context/qa-punchlist.csv`. Every check is designed to localise a **document** defect; the HIGH rows
are ones a human should read before loading.

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
| info | 1 | `annex-not-extracted` (Freeport — the standalone plan, on its own track) |

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

## 5. Corpus facts worth carrying forward

- **66 of 142 worksheets have a file index that disagrees with the project number.** Empirical
  confirmation of the join-on-project-number rule: nearly half would be mis-filed by filename.
- **132 instruction-template tables skipped** across 142 files — every worksheet carries one, and
  loading it would import DHSES's own guidance text as authored content.
- **The base plan's `9x2` banner is not a unique hazard key** — 12 boxes for 11 hazards, with
  *Severe Storm* used three times (for the severe-storm, lightning and wind profiles).
- **Nassau County's own annex has 52 prior actions and 14 proposed** — by far the largest, and its
  prior actions are row-wise rather than transposed, as is Town of Hempstead's 95.

## 6. What Phase 6 did not do

- **Freeport** (the standalone 177-page village plan) is extracted to text only, not structured.
- **Garden City's fourth worksheet** is a one-page PDF (`VGC_4 …pdf`); the two `.docx` worksheets in
  its `archive/` folder were parsed, the PDF was not.
- **No transformation.** Everything above is *source-shaped* JSON — verbatim cell values keyed by the
  annex's own labels. Taxonomy mapping, vocabulary translation, the Action Type tiering and lexical
  compilation all belong to Phase 7.
- **Nothing was written to `mitigat-ny-prod`.**
