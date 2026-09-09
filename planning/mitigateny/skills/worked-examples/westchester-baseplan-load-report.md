# Worked example — Westchester 2026 base plan → pattern 2448336

**Consultant:** IEM ([profile](../profiles/iem.md)) · **Loaded:** 2026-09-08 ·
**Scripts:** [`../scripts/westchester/baseplan/`](../scripts/westchester/baseplan/)

The first plan authored against the MitigateNY **2.0** information architecture, and the first
county needing **no hazard-taxonomy decision**. Tracked in
`planning/mitigateny/tasks/current/westchester-2026-baseplan-crosswalk.md` (the full decision
register); this file is the reusable summary.

## Result

| | |
|---|--:|
| Annotation slots written | **177 / 177** |
| Failed / skipped | **0 / 0** |
| Characters live | **334,761** — exact match to the spec |
| Heading nodes / list nodes | 13 / 6 — both match |
| Read-back clean | **177 / 177** |
| Written components appearing in a published `sections` list | **0** |
| Slots left deliberately empty | 71 |

Target: pattern **2448336** `Westchester-2026`, instance
`mitigateny_county_template_v3_copy_2`, subdomain `westchester-2026`, geoid **36119**, duplicated
from `county_template` **1300890**. Source: `2026 Westchester County HMP Base Plan Draft.docx`
— 1,965 blocks, 722 headings, 197 content-bearing sections.

Everything went to `draft_sections` with `status = local_review_needed`. Nothing published; the
consultant reviews in-platform.

## Crosswalk, final

271 rows at first draft → **275** after the decision pass:

| | Start | End |
|---|--:|--:|
| HIGH | 173 | **180** |
| MEDIUM | 9 | 13 |
| SKIP | 8 | 10 |
| **LOW** | 1 | **0** |
| **GAP** | 5 | **0** |
| **PARTIAL** | 1 | **0** |
| Slots receiving content | 174 | **177** |
| Doc sections mapped | 183 | **187** |

Driving that to `GAP 0 / PARTIAL 0` is the goal: every content-bearing section either has a target
or carries a recorded reason for being skipped.

---

## The five lessons worth carrying forward

### 1. Canary one slot before any bulk component write

**`lexical.mjs`'s `buildRootBlocks2()` returns the bare root node.** Page components store
**`{text:{root:<node>}}`**; dataset columns store **`{root:<node>}`**. Assigning the node straight
to `ed.text` — which is exactly the habit the annex path teaches — writes it one level too shallow.

The write **returns success**. `status` and `isCard` are correct. Every character is present. The
box renders **empty**, because nothing resolves `text.root`.

**A dry run cannot catch this** — it measures the node it built, not the shape it would store. Only
a real write plus a read-back does. On this run the canary (`2449714`) read back
`ed.text.type === 'root'`, `chars: 0`, `children: undefined`; it was corrected and re-verified
before the other 176 went out.

### 2. Merge into `element-data`, never replace it

`fill_slots.mjs` reads the component, sets `ed.text`, and writes the whole `ed` back. Replacing
`element-data` wholesale drops `isCard` / `bgColor` / `showToolbar` and the grey Annotation stops
rendering as one. The writer also **refuses** anything whose `isCard !== 'Annotation'`, which is how
the shared-card constraint became structural rather than a promise.

### 3. Prove "nothing published" instead of asserting it

Component rows are shared objects, so "I only wrote drafts" deserves a check. Draft and published
are in fact **separate component rows**: across the 30 affected pages, all 177 written ids appear in
`draft_sections` and **none** in a published `sections` list. Two lines of script, and it converts a
claim into a fact.

### 4. A lead-in heading must not orphan the source after it

When two or more doc sections merge into one box, an h3 above source A followed by an **unheaded**
source B makes B read as part of A. The first spec run did this in four places — "Demographic
Statistics" would have appeared to head the at-risk-population enumeration, and "Goals and
Objectives Defined" to head the goals list.

**Rule, now enforced by `check_lead_ins()`:** headed sources must form a **contiguous suffix** —
once one source carries an h3, every later source in that box must too. That admits the three
correct shapes and rejects only the mislabelling case:

| Shape | When |
|---|---|
| none headed | the sources are continuous prose |
| only the last headed | native prose first, merged addition after |
| unheaded intro, then all headed | a bare framing paragraph, then headed subsections |

Worth noting the box where **no** heading was right: the demographic-factors paragraph is literally
the topic sentence for the at-risk-population list that follows it, which was the whole reason it
was mapped there. A heading would have broken exactly the continuity that justified the mapping.

### 5. Let the document's own styling decide list markup

Across all 187 mapped sections: 641 paragraphs — `Body Text` 561, `Normal` 50, `Bullet 1` 15,
`List Paragraph` 13, `Normal (Web)` 2. `Bullet 1` and `List Paragraph` become `<ul>` items;
everything else stays a paragraph. **Never invent list structure the document doesn't have** — which
is why the probability and severity scales stay as the separate paragraphs the author wrote, even
though a list would read better.

---

## Post-duplication repair the crosswalk surfaced

`pattern_diff.mjs` against `county_template` found **three pattern-level fields that did not survive
duplication**. Run it on every new county copy:

| Field | Symptom |
|---|---|
| `filters` | carried the template's **placeholder geoid `36105` (Sullivan)**. Every data component resolves to the wrong county until it is set. |
| `authPermissions` | absent → **9 of 58 page rows read back `no-access`**, which also made the slot enumeration miss a page and produce a false "the copy lacks this page" finding. |
| `additionalSectionAttributes` | absent → the `status` select has no definition, so the pattern has **no status control in the admin UI**. Consumed at `patterns/page/siteConfig.jsx:121`, editable via the pattern editor's format manager. |

The middle one is the instructive failure: an auth gap presented as a *structural* difference between
template and copy. **Fix permissions before drawing conclusions from an enumeration.**

## Character accounting is not a byte ledger

Once sections are distributed paragraph-wise, a section mapped to *n* slots contributes its full
length *n* times to any naive sum. Here the generated total read **358,881** against a
distinct-section total of **337,837** — and even that overcounts, because it counts all of two
sections whose boilerplate paragraphs are skipped. The spec's own measured total, **334,761**, is the
real figure and it matched the read-back exactly. Treat crosswalk char counts as routing metadata.

## Decisions this county needed

Recorded in full in the task doc; the shape is what transfers.

- **Two owner constraints set the frame:** no `county_template` changes (so orphan content is fitted
  into existing boxes or skipped, never given a new slot), and never write into SHMP-sourced
  sections. The second turned out to also mean **not tagging county prose
  `status: shmp_sourced_content`**, which prior loads did — that label asserts the content came from
  the State plan. `local_review_needed` is what these boxes actually need.
- **Six orphan sections** with no slot: distribute by paragraph, merge, or skip. Three of the six
  were answered by the no-template-change constraint alone, and one (the Director's letter) turned
  out to be a drafting placeholder with nothing to load.
- **Five sections narrating a data component** with no adjacent grey box — fold into the nearest one,
  or drop. Two of the five moved from the recommendation on the owner's call, and one of those
  exposed two errors in the original crosswalk row.
- **A statistics card left deliberately unfilled.** A `[#]`-placeholder card wanted seven measures;
  the plan supplied two, and relabelling it to the plan's own categories would have put a second,
  conflicting set of acreages beside a live spreadsheet already rendering them. Filling 2 of 7 makes
  a card look broken. Leaving it alone was the answer.
