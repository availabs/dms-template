# Suffolk annex pre-flight — structural scan of all 39 chapters

**Run:** 2026-08-14 · `context/scripts/preflight.py` → `context/extracted/preflight.json`
**Scope:** shapes and counts only. No content mapping.
**Result:** 39/39 chapters parsed, **0 failures**. The spine holds. Five variances found that the
batch extractor must handle.

---

## 1. What it confirmed

**The section spine is stable.** All 38 jurisdiction chapters carry the same 8 `Heading 2` sections
in the same order. No chapter reorders or renames them. One parser can handle all 38.

**Checkbox extraction works at scale** — 8,715 checked boxes recovered across the corpus.

**Chapter 1 is the Introduction, not an annex** (its H2s are *Background*, *Planning Partner
Involvement*, …). Exclude it: 39 chapters = 1 intro + 38 jurisdictions.

---

## 2. Variances the batch extractor must handle

| # | Variance | Where | Handling |
|---|---|---|---|
| 1 | **Table F has 13 hazards, not 14** — *Groundwater Contamination* is absent | Brookhaven (T) | **Compute HOC row math per jurisdiction. Never assume 14.** |
| 2 | **Numbered H2 headings** — `34.4 Jurisdictional Risk Assessment` | Southampton (T) | Match headings on a `^\d+(\.\d+)?\s*` -tolerant regex, not string equality |
| 3 | **Identified Issues use two bullet styles** — `Tt List Bullet` *and* `List Paragraph` | 9 of 38 chapters | Accept both. Style-only matching undercounted by **113 issues (741 → 854)** |
| 4 | **Action tables vary their first cell's wording** | ≥1 chapter | Classify by **section + shape**, not header text. Header matching missed one action outright |
| 5 | **Two chapters are internally inconsistent** — action-table count ≠ prioritization-table rows | Southampton (22 vs 21), Westhampton Beach (10 vs 11) | Needs a human eyeball; one action is detailed but unscored, or scored but undetailed |

Variances 3 and 4 were **my parser's bugs, caught by the scan** — exactly what the pre-flight was
for. Variances 1, 2 and 5 are real properties of the documents.

---

## 3. Volume — the actual work, not an extrapolation

| Content | Total | Range per jurisdiction | Note |
|---|---:|---|---|
| **Prior-cycle actions** | **450** | 3–65 | **Not in the consultant workbook.** The single largest undelivered body of work |
| Proposed actions | 522 | 3–66 | Already delivered; cross-check only |
| **Identified Issues** (problem statements) | **854** | 0–79 | → `lhmp_problem_areas` |
| Hazards-of-Concern rows (Table F) | 531 | 13–14 | 37 chapters × 14 + Brookhaven × 13 |
| Planning & regulatory capabilities (Tables P+Q, "Yes" only) | ~729 | 0–33 | P/Q split unreliable in this scan — treat as combined |
| Administrative & technical capabilities ("Yes" only) | 628 | 8–23 | Table R |
| Roles (Table A rows) | 228 | 4–18 | Includes contributors |

Two figures reset expectations. **450 prior-cycle actions** is a substantial dataset that no existing
deliverable covers. And **854 identified issues** is the richest authored prose in the corpus.

---

## 4. Reconciliation against the consultant workbook

Docx totals **522** proposed actions; the workbook holds **523**. All 38 jurisdictions match by
name. Three disagree:

| Jurisdiction | docx | workbook | |
|---|---:|---:|---|
| Asharoken (Village) | 12 | 13 | workbook has one extra |
| East Hampton (Village) | 9 | 10 | workbook has one extra |
| Southold (Town) | 13 | 12 | **docx has one extra** |

For Asharoken and Southold the docx is internally self-consistent (action tables = prioritization
rows), so these look like genuine divergences between the two deliverables rather than parse errors.
The workbook is titled *reconciled v2*, so its extras may be deliberate reconciliations against the
live system. **Worth one question to Tetra Tech before treating either as authoritative.**

---

## 5. Verdict

**Cleared for batch extraction**, with the five variances above encoded first. The corpus is
uniform enough that one extractor will work, and every failure mode found here is cheap to handle
in code.

Recommended order unchanged: fold variances 1–4 into the extractor → resolve variance 5 and the
workbook discrepancies with the owner → run the Islip vertical slice end-to-end → owner review →
batch.

The remaining blocker is still the one outside this scan: **the import path for the flat datasets**,
which determines the output format for Capabilities, Roles and the scalar half of HOC.
