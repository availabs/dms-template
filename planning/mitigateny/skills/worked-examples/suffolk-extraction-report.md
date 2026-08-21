# Suffolk annex extraction — all 38 jurisdictions

**Run:** 2026-08-14 · `context/scripts/extract_annexes.py`
**Output:** `context/extracted/annexes/` — 38 JSON files + `_manifest.json`, 9.8 MB
**Result:** **38/38 extracted, 0 failures.** Faithful dump; no crosswalk mapping applied.

---

## 1. What came out

| Content | Total | Matches pre-flight? |
|---|---:|---|
| Tables (captured verbatim) | 2,008 | — |
| **Prior-cycle actions** | **471** | pre-flight said 450 — **extraction found 21 more** |
| Proposed actions | 522 | ✅ |
| Identified Issues | 854 | ✅ |
| Checked checkboxes | 8,715 | ✅ |

Every jurisdiction resolved through `suffolk-jurisdiction-aliases.csv` — **38 files, 38 distinct
geoids, no collisions**, including the two non-census entities (Shinnecock `3610367059`, SCWA
synthetic `3610390001`).

**The 21-action discrepancy was the pre-flight undercounting, not the extractor over-counting.**
Suffolk County carries prior actions numbered `SBU-###` (Stony Brook University) and `SBSH-###`
(Stony Brook Southampton Hospital) alongside the usual `2020-<Juris>-###`. The pre-flight's
`^\d{4}-` pattern skipped them. They are genuine 12-field action tables. **471 is the correct
figure**, and it grows the largest undelivered dataset further.

Action-ID coverage after fixes: **471/471 prior IDs parsed (100%)**, **521/522 proposed (99.8%)** —
the single miss is in Southampton and is a source defect, described below.

---

## 2. File shape

One JSON per jurisdiction, named `<geoid>_<slug>.json`:

```
jurisdiction        the alias-table row (geoid, names, type, census_type)
provenance          chapter_file, checked_boxes
title               document H1
headings            every heading with level + raw (numbered prefixes preserved)
tables[]            EVERY table verbatim: shape, section/subsection, caption,
                    table_label ("F"), table_name, and full rows[][]
prior_actions[]     action_id, action_name, raw_header, fields{}
proposed_actions[]  action_id, action_name, caption, id_source, fields{}
identified_issues[] text, depth (nesting), style
n_hazards_table_f   per-jurisdiction, never assumed
n_prioritization_rows
warnings[]
```

Checkbox state is preserved inline as `[x]` / `[ ]`, so selections stay recoverable:

```
"Priority": "[x] High              [ ] Medium              [ ] Low"
"FEMA Mitigation Category": "[ ] LPR  [x] SIP  [x] NSP  [ ] EAP"
```

Every table is kept verbatim *in addition to* the parsed instruments, so a changed owner decision
costs a re-map, not a re-extract.

---

## 3. Fixes made during the run

Four issues surfaced and were fixed against Islip before the batch:

1. **Prior actions came out 0.** "Status of Previous Mitigation Actions" is an `Heading 4` in some
   chapters and `Heading 3` in others. Now tests both levels *and* keeps the action-ID fallback.
2. **Action IDs truncated** — `2020-Islip-001` parsed as `2020-Islip`. IDs contain hyphens, so the
   id/name separator must be the **em/en dash only**.
3. **Non-year ID prefixes unparsed** — `SBU-001`, `SBSH-001` (21 actions). Pattern generalised.
4. **26 proposed actions had no caption**, hence no ID. Recovered positionally from the
   prioritization table, tagged `id_source: "prioritization-table (positional…)"` — and **only
   where the two counts agree**, so it refuses to guess when alignment is unsafe. That refusal is
   why Southampton still has one unidentified action; correct behaviour.

A fifth was a false alarm of my own: Westhampton Beach was flagged as inconsistent because I
counted prioritization rows as `n_rows - 2`, and its header band isn't 2 rows. Now counts rows that
actually carry a project number. The warning is gone and the chapter is clean.

---

## 4. Source defects — need a human, not code

| Jurisdiction | Defect |
|---|---|
| **Brookhaven (T)** | **Duplicate prior action ID `2020-Brookhaven-006`** on two different actions — *Compile Comprehensive Emergency Management Plan* and *Coastal Erosion Monitoring*. Both extracted; neither deduped. |
| **Brookhaven (T)** | Table F has **13 hazards** (no *Groundwater Contamination*). Expected; HOC row math is per-jurisdiction. |
| **Southampton (T)** | **22 detail tables but only 21 scored actions.** Root cause: two different actions are both captioned `2026-Town of Southampton-21` (*Southern Pine Beetle Infestation* and *Expansion of Sewer Districts…*), and one table has no caption at all. `-01` appears in the prioritization table with no matching detail ID. |

Duplicates are **flagged, never silently merged** — the rows are genuinely different actions, and
collapsing them would lose one.

---

## 5. Where this leaves us

Extraction is done and complete. Nothing downstream is blocked by it.

**Next:** the Islip vertical slice — map its extracted JSON through the crosswalk, generate every
artifact type, load to a draft, read back and diff. That exercises each mapping rule once before
they run 38 times.

Still outstanding, all downstream of extraction:
- **Flat-dataset import path** — determines output format for Capabilities, Roles, HOC scalars
- **`hazard = "Other"` validation** — the live select has no `Other` option (report §4)
- **Shinnecock / SCWA scope** — with the contractor; both handled as in-scope
- **§4 schema gaps** — adaptive capacity, prioritization scores, three-level hazard ranking
- **Three source defects above** — and the 3 jurisdictions where docx and workbook action counts differ
