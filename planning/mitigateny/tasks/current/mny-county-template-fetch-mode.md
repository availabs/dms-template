# MNY County Template — explicit Data Fetch Mode on every data component (T6-001)

**Project:** MitigateNY · **Topic:** content · **Status:** IN PROGRESS · **Started:** 2026-08-28 · **`county_template` complete 2026-09-01** (141/141 over both shapes) · **duplicate inventory built 2026-09-01** (319 writes across three patterns, awaiting owner review)

## Objective

Give every Card, Spreadsheet and Graph in the county template (`county_template.devmny.org`, app
`mitigat-ny-prod`, type `prod`) an **explicit** `Section Settings > Data Fetch Mode`, instead of
leaving it unset and letting the loader infer one from `readyToLoad`. Then apply the same fixes
retroactively to the three county drafts duplicated off the template.

The owner's rule:

| Source class | Target |
|---|---|
| **external** (DAMA source via a pgEnv, `[external]` in the picker) | `Smart (fetch on change)` |
| **internal** (DMS-managed dataset in this app) | `Force (always re-fetch)` |

This is the per-component expansion of **`T6-001` — "Null data fetch mode"** in
`src/themes/mny/design/reports/County Template QA - with orphans.xlsx` (tab **All findings**), which
recorded the finding pattern-wide and pointed at a now-superseded inventory
(`county-template-qa-fetchmode.csv`, 2026-08-19, published section ids).

## Deliverables built 2026-08-28, rebuilt 2026-09-01 over both config shapes

`src/themes/mny/design/reports/county-template-qa-t6-fetchmode.{csv,xlsx,html}` — one row per data
component with `Draft section ID`, `Page URL`, `Page`, `Section title`, component kind, the source and
its class, the stored fetch mode, the resolved behaviour, and a per-row `Recommended fix`. The
`.xlsx` is the working document (two sheets, auto-filter, empty `Status` / `Assigned to` /
`Date fixed` / `Notes` columns); the `.html` is a filterable read-only view.

Since 2026-09-01 every row also carries **`Config shape`** (v1 / v2) and **`Source snapshot key`**
(`sourceInfo` / `externalSource`), the HTML opens with the scope correction that forced the rebuild,
and its filter bar can isolate either shape. The superseded v2-only artefacts are kept beside them as
`county-template-qa-t6-fetchmode.BACKUP-20260901-v2only.{csv,xlsx,html}`.

**One artefact is stale as of the 2026-09-01 remainder run:** the `.xlsx` and `.html` are rebuilt and
read `0 outstanding`, but **`county-template-qa-t6-fetchmode.csv` could not be written — Excel holds
an exclusive write lock on an open `.csv`** — so the committed CSV still shows the 41 as outstanding.
The rebuilt copy is staged in the scratchpad (path in the run folder's `.tmpdir`); copy it over once
the file is closed. Note for the next rebuild: build into a **copy** of the existing trio, never an
empty directory — `build_fetchmode_report.py` reads the previous CSV in `--out-dir` for both the
`Assigned to` / `Notes` carry-forward and the Fix-ID stability check, and silently loses them without it.

Method and every gotcha:
[`planning/mitigateny/skills/cataloguing-and-fixing-data-fetch-mode.md`](../../skills/cataloguing-and-fixing-data-fetch-mode.md).
Tooling: `scan_fetchmode.mjs` + `build_fetchmode_report.py` in
`planning/mitigateny/skills/scripts/report_fixes/`.

## Scope (narrowed by the owner 2026-08-28)

`Force` re-queries on **every mount**, so every component set to it is page-load cost. The sweep is
therefore not "every internal component" but only the datasets an author actually edits and expects
to see change. A component is in scope when **both** hold:

| | |
|---|---|
| source is one of | `Actions_Revised` · `Hazards_of_Concern` · `Jurisdictions` · `Roles` · `Participation` · `Capabilities_Catalogue` |
| page is one of | the **26** labelled `Relevant` in `county-template-qa-t5-requirements-v2.xlsx` (sheet `T5 fixes (draft IDs)`) |

Everything else is **deferred, not dropped** — it keeps its `Fix ID` and carries the reason, so
widening the scope later is a rebuild rather than a renumbering. Explicitly out:

- **`LHMP_IA`** (149 components) — the largest internal dataset and effectively static. Named by the
  owner as the specific thing to skip.
- **External sources** (150) — parked since 2026-08-28; see Open items 1.
- `NYS_Dams` (10), `R_and_V_Matrix` (3), `DHSES_County_Database` (1).
- Every page outside the T5 `Relevant` list — the 16 it labels otherwise, **and the 15 it never
  assessed**: the `track_progress/actions_*` tree, `jurisdictional_annex_form`, the two form
  prototypes, `hurricane_dup`, `actions_edit_list_dup`. The owner's instruction was to stay on the
  pages already under review, so silence in the allow-list means out, not in.

The two filters are opt-in flags on `build_fetchmode_report.py` (`--source-allow`,
`--page-allow-from`); with neither, an old command line still reproduces the old whole-pattern
document.

## The numbers (pattern 1300890, rescan **2026-09-01 18:5x** *after* the remainder run, 58 of 58 pages)

| | Count | pre-run same day (59 pages) | 2026-08-28, v2 only |
|---|---|---|---|
| data components (bind `externalSource` **or** `sourceInfo`) | **1,082** — v1 550 · v2 532 | 1,125 — v1 584 · v2 541 | 519 |
| **in scope after the narrowing** | **141** on **21** pages | 141 | 99 |
| deferred out of scope | 874 | 915 | 409 |
| no `Data Fetch Mode` control — Header 35, Footer 21, Filter 11 | 67 | 69 | 11 |
| **writes outstanding** | **0** | 41 | 0 (v2 only) |
| already correct | **141** | 100 | 99 |

```
whole pattern, stored : not set 919 · smart 11 · force 152   (v1/force 38, v2/force 114)
in scope,      stored : force 141 — 0 unset
```

The pattern shrank 1,125 → 1,082 because other staff **deleted `the_risk/natural_hazards/hurricane_dup`**
between the 16:21 report build and the run (59 pages → 58). All 43 lost rows were already
`Deferred - out of narrowed scope` (41) or no-control (2) — Open item 5 had ruled that page out — so
nothing in scope was lost, and the rebuild absorbed it with **1,119 prior rows matched, Fix IDs
stable**.

**The three earlier runs were always correct — the catalog they ran against was not.** All 63 of their
writes verified, and re-reads confirm every in-scope component they set to `force` still holds it. What
was wrong was the denominator: `scan_fetchmode.mjs` selected components on `element-data.externalSource`
(the v2 key), so the 584 components still stored in the **v1** shape — source snapshot under
`sourceInfo` — never entered the catalog. "99 in scope, 99 correct, 0 outstanding" was true of the v2
half and silent about the other. That reopened **41 writes** on `select_jurisdiction` (34),
`capabilities_assessment` (5), `jurisdictional_annexes` (1) and `hurricane` (1) — **all 41 applied and
verified 2026-09-01**, run `2026-09-01-t6-v1-remainder`. `county_template` is now complete over both
shapes, with the browser behaviour check the one thing still qualified (Progress, item 2 from the end).

The parallel QA read of 2026-08-31 (`county-template-qa-draft.html`, Tier 1 finding 1) put the
in-scope total at the same **143** (141 fixable + 2 with no control) but split it 99 force / 42 unset;
the pre-run build read 100 / 41. The difference was authoring churn, not method: **22 in-scope sections
were edited on 31 Aug–1 Sep**, and three of the unset rows (2418307, 2418422, 2418453,
`Local Capabilities Table`) were new **v2** components added on 31 Aug that did not exist when the
earlier catalog was built. Expect the number to keep moving while other staff are editing — see Open
items 8, and note the pattern moved *again* mid-run (`hurricane_dup` deleted, above).

**Nothing in scope is actively broken.** All 7 components that resolve to `cache` — the mode that
never re-queries — are Filters or the Header, none of which has a settable control. So this sweep
makes the template's intent explicit and corrects wrong-but-deliberate `smart` values; it is not a
list of broken components.

## Progress

- [x] **Read `T6-001` and the superseded inventory** — 2026-08-28. The old CSV addresses *published*
      section ids, which go stale on every publish, so it cannot drive a fix loop (see the fix-loop
      skill's "the report must address DRAFT sections").
- [x] **Established where the setting lives and how it resolves** — 2026-08-28, **corrected
      2026-09-01**. `data.element['element-data'].display.fetchMode`, with
      `fetchMode ?? (readyToLoad === true ? 'smart' : 'cache')` as the fallback
      (`dataWrapper/useDataLoader.js:245-249`). Only `Card.config.jsx`, `spreadsheet/config.jsx`,
      `graph/config.jsx` and `graph_new/config.jsx` register the control.
      **The correction: the `isEditMode ? 'smart'` short-circuit this task originally quoted is
      COMMENTED OUT** (`:246`). Edit mode honours the stored `fetchMode` like any other mode — which
      *strengthens* the owner's rule, since the authors who edit these six datasets work in edit mode
      and that is exactly where they must see their own change. Two follow-ons: `readyToLoad` is now
      derived (`:248`), not read raw, so `cache` no longer suppresses loading when `allowEditInView`
      is set; and `force`'s only behavioural difference from `smart` is `bypassDedup` (`:249`).
- [x] **Established the external/internal discriminator** — 2026-08-28. `externalSource.isDms`.
      See Open items 1: the picker's label does **not** say `[internal]`.
- [x] **Scanned pattern 1300890 and built the report** — 2026-08-28. `scan_fetchmode.mjs` +
      `build_fetchmode_report.py`, 497 components, verified in the browser.
- [x] **Wrote the skill and registered it** in the county-template fix family — 2026-08-28.
- [x] **Owner scoped the work to internally sourced components** — 2026-08-28. External components
      are parked; see Open items 1.
- [x] **Write path built and proven** — 2026-08-28. `apply_element_data_key.mjs` (in
      `scripts/report_fixes/`, **nothing added to `src/dms`**): parse `element-data`, set one key,
      re-serialise, write the full `data` object via `dms section update --data <file>`. It asserts the
      payload is **stringify-canonical** before writing and refuses otherwise, then proves minimality
      by stripping the key back out and requiring the original byte-for-byte. `validate.mjs` needed no
      change — `--attr element.element-data.display.fetchMode` addresses the nested leaf directly.
- [x] **First page applied: `the_local_environment/built_environment`** — 2026-08-28, run
      `2026-08-28-t6-built-env`. The owner named `T6-C002`…`T6-C010`; **8 written to `force`, 8/8
      verified, 0 unexpected leaf changes**, each payload exactly +20 chars
      (`,"fetchMode":"force"`). Independent audit: **9 of 9 correct**. `T6-C009` held — see Open
      items 1. `T6-C002` was applied and validated alone first in a `proof/` sub-run, so the main run
      correctly `REFUSED` it as (self-inflicted) drift.
- [x] **Report refreshed from a post-write rescan, and made rebuild-safe** — 2026-08-28. See Open
      items 8: the pattern grew mid-session and a naive rebuild would have renumbered 193 rows.
- [x] **Owner narrowed the scope, and the report now enforces it** — 2026-08-28. Six in-scope
      sources, T5-`Relevant` pages only; see Scope above. `build_fetchmode_report.py` grew
      `--source-allow` and `--page-allow-from/--page-allow-sheet/--page-allow-column/
      --page-allow-value`, both opt-in. Deferred rows keep their `Fix ID` and carry a
      `Scope reason`, in a new `Deferred - out of scope` XLSX sheet and an HTML appendix grouped by
      reason. Rebuild confirmed **515 prior rows matched, Fix IDs stable**. **457 writes → 63.**
- [x] **Second batch applied: the three planning-process pages** — 2026-08-28, run
      `2026-08-28-t6-plan-process`. `the_plan/about_the_process`, `the_plan/capabilities_assessment`,
      `the_plan/jurisdictional_annexes/select_jurisdiction`: **14 written to `force` (10 set, 4
      changed from `smart`), 14/14 PASS, 0 unexpected leaf changes**; 4 rows held as already correct.
      Independent audit **18 of 18**. A whole-pattern rescan diffed against the pre-run scan shows
      **exactly those 14 sections moved, none added or removed**. `mark_page_changed.mjs` set
      `has_changes` on 1348541; the other two were already true.
- [x] **`audit.mjs` generalised beyond `absent → force`** — 2026-08-28. The built-env audit reported
      8 of 18 WRONG here; all 8 were its own bugs, both from hard-coding that run's single shape.
      It expected a held row to read `null` (these were held *because already `force`*) and proved
      minimality by **deleting** the key (correct for a SET, impossible for `smart → force`, where
      the baseline *has* the key). Both now read the pre-run state from `baseline/<id>.json`.
      Corrected copy: `fix-runs/2026-08-28-t6-plan-process/audit.mjs` — **copy that one forward.**
- [x] **Third batch applied: the 17 natural-hazards pages** — 2026-08-28, run
      `2026-08-28-t6-natural-hazards`. 81 in-scope components, **49 written to `force` (16 set, 33
      changed from `smart`), 49/49 PASS, 0 unexpected leaf changes**; 32 held as already correct.
      Independent audit **81 of 81**. Whole-pattern rescan: **exactly the 49 targeted sections
      moved**, and the moved set is identical to the target set. `has_changes` set on 1300806; the
      other 16 pages were already flagged. ~~**This closes `county_template`: 99 in scope, 99 correct,
      0 outstanding.**~~ — **true of the v2 half only; superseded two entries down.** Kept as written
      because the run itself was correct and its doctrine holds; the *claim of completeness* was not.
- [x] **Shared sections checked before baselining** — 2026-08-28. Four `Fix ID`s span two hazard
      pages each (the `wind`/`lightning`/`tornado` sharing the T5 task tracks). All are `LHMP_IA`, so
      the narrowing excluded them and the run had 81 rows over 81 distinct section ids. Had one been
      in scope, the second page's row would have tripped the loop's drift refusal. **Re-check this
      every run** — it was luck, not design.
- [x] **Scanner widened to both config shapes, and the report rebuilt** — 2026-09-01. Raised by a
      parallel QA pass (`src/themes/mny/design/reports/county-template-qa-draft.html`, Tier 1
      finding 1, 31 Aug): *"Friday's task closed with '99 in scope, 99 correct, 0 outstanding'. That
      number reproduces exactly — and it is complete only over components stored in the v2 config
      shape. Components still stored in v1 were invisible to the scanner, because it selects rows
      that bind an `externalSource`, and a v1 row keeps its snapshot under `sourceInfo` instead."*
      Confirmed against `migrateToV2.js:203-226`, which is the authority on the shapes: v2 =
      `externalSource`, v1 = `sourceInfo` / `dataRequest`, v0 = `attributes` / `format`.
      `scan_fetchmode.mjs` now selects on `externalSource || sourceInfo`, prefers `externalSource`
      when a row has both (as `getData.js:226` does), and emits `configShape` on every record;
      `build_fetchmode_report.py` carries `Config shape` and `Source snapshot key` as columns, tiles
      the split, filters on it, and opens with the finding quoted. Rebuild: **515 prior rows matched,
      Fix IDs stable**, ledger grown 515 → 1,120 assignments. **The rule and the write path are
      unchanged** — `migrateV1ToV2` copies `display` across verbatim (stripping only
      `filteredLength` / `invalidState` / `hideSection`), so a v1 component honours a stored
      `fetchMode` exactly as a v2 one does and `apply_element_data_key.mjs` needs no change.
      Prior artefacts kept as `county-template-qa-t6-fetchmode.BACKUP-20260901-v2only.{csv,xlsx,html}`.
- [x] **Applied the 41 outstanding writes on `county_template`** — 2026-09-01, run
      `2026-09-01-t6-v1-remainder`. **41 writes (all SET), 41/41 PASS, 0 unexpected leaf changes**,
      every payload +20 chars; 19 rows held as already correct. Independent audit **59/60 in the main
      run + 1/1 in `proof/` = 60 of 60** (the one `WRONG` is the proof row, held in the main run, so
      the audit's `target || baseline` expectation is its pre-proof `null` — left un-special-cased on
      purpose). Whole-pattern rescan: **exactly the 41 targeted sections moved, none added or
      removed**; `v1/force` **0 → 38**. `mark_page_changed.mjs` set `has_changes` on 1425510 and
      1300933; 1348541 and 1545403 were already true. Report rebuilt: **141 in scope / 141 correct /
      0 outstanding.** **The v1 write path needed no code change** — proven first on 2380934 alone
      (`sourceInfo` + `dataRequest`, no `externalSource`, 8,342 chars) through the full canonical /
      byte-identical / minimality gates, exactly as `migrateV1ToV2` copying `display` verbatim
      predicted. All 8 hidden-from-view rows were written; see Open items 4.
- [~] **Confirm a `force` component actually re-queries in the browser** — **partly done
      2026-09-01, and the check turned out to be weaker than the standard assumed.** Measured on
      `/edit/the_plan/jurisdictional_annexes` (falcor `POST /graph`, XHR — instrumenting `fetch`
      catches only analytics beacons): **0 calls idle for 10 s**, 30 on navigating to
      `capabilities_assessment`, **11 on remounting the force page**. So the components query and
      render, and `force` is *not* a re-query storm — one query per mount, which is the cost the
      narrowing already priced in.
      **What it does not prove:** `force`'s only difference from `smart` is
      `bypassDedup` (`useDataLoader.js:249`) skipping `fetchKey === lastFetchKeyRef.current`
      (`:265`), and `lastFetchKeyRef` is a **per-mount ref** — so every fresh mount fetches under
      either mode and *no amount of navigating separates them*. Isolating it needs a controlled A/B
      (flip one component `force → smart`, re-measure, flip back — reversible via `rollback.mjs`) or
      a harness that re-runs the effect with a fixed `fetchKey`. **Owner decision: worth the two test
      writes on the live template, or accept the mechanism as read from source?**
- [x] **Scanned + matched the three duplicates; the consolidated inventory is built** — 2026-09-01.
      All four patterns now live in one document keyed by `Pattern ID`: **4,326 rows, 319 writes
      outstanding** (`suffolk_draft` 105, `schenectady_draft` 106, `delaware_draft` 108,
      `county_template` 0), **114 distinct fixes of which 99 apply to all three duplicates**. New
      tooling: `match_fetchmode_patterns.py` (skill §6c) pairs each duplicate's components to the
      template's and emits an id-ledger fragment, so a duplicate's row reuses the template's
      `Fix ID`. Per-pattern identity closes: `139 = 141 - 5 + 3`, `139 = 141 - 4 + 2`,
      `140 = 141 - 4 + 3`. Every recommended fix is computed from the duplicate's **own** stored
      value, so `already correct` differs per pattern (34 / 33 / 32) as it should.
- [ ] **Apply the 319 writes, one pattern at a time**, after owner review of the inventory. Notes for
      whoever runs it: **107 of the 319 are `smart → force` CHANGEs** (+0 chars, not +20 — derive the
      audit's expectation from `baseline/<id>.json`); **197 are v1**, now a proven path; 23 are hidden
      from view; and all three duplicates carry their own shared `lightning`/`wind`/`tornado`
      sections, so **assert rows == distinct section ids before baselining**.

## The three county duplicates

Same registry as the T5 task — `suffolk_draft` 2249247, `schenectady_draft` 2304223,
`delaware_draft` 2323808. **Cleared to start 2026-09-01**: `county_template` is complete over both
shapes (141/141), and the owner's next step is one consolidated spreadsheet covering all three
duplicates for review *before* any write goes to them.

Done 2026-09-01: `scan_fetchmode.mjs` per pattern, `match_fetchmode_patterns.py` to pair components,
and `build_fetchmode_report.py` with four `--scan` arguments — all four patterns in one document keyed
by `Pattern ID`, the same shape the T5 tab uses. Each duplicate's recommended fix **is** computed from
its own stored value, which is why `already correct` reads 34 / 33 / 32 rather than one number.

| | suffolk_draft 2249247 | schenectady_draft 2304223 | delaware_draft 2323808 |
|---|---|---|---|
| data components | 1,057 | 1,093 | 1,094 |
| in narrowed scope | 139 | 139 | 140 |
| already `force` | 34 | 33 | 32 |
| **writes** (SET / CHANGE) | **105** (69 / 36) | **106** (70 / 36) | **108** (73 / 35) |

**A duplicate is not simply "behind by the template's writes".** Each needs ~105 where the template
took 41. They were forked when the template held ~35 `force` / ~36 `smart` and carry that snapshot —
and **every stored value in all three is v2, while every v1 component is unset** (suffolk: 913 of 913
v1 rows unset). The v1 blind spot of Open items 0 was never template-specific; it is the shape most of
the fleet is stored in.

### A fourth duplicate exists and is not in the report

`MitigateNY_Nassau_V2` **2407262** (subdomain `nassau`, type
`mitigateny_county_template_v3_copy`) is another fork off this template, created after the registry
above was written. Scanned for a count only: **1,055 data components, 141 in narrowed scope, 36
already `force`, 105 writes** (68 SET / 37 CHANGE; v1 65 / v2 40). **Left out deliberately** — the
owner scoped this to three — but the number is on record so admitting it is a decision rather than a
later discovery. **Owner call: fold Nassau in, or leave it?**

## Open items

11. **`trackingId` is not unique within a page, and the propagation skill's tier A is weaker than it
   says.** Measured on `county_template` 2026-09-01: **208 data components across 25 pages share a
   `trackingId` with a sibling on the same page** — `the_plan/about_the_process` has five Cards
   (`Overview`, `The Planning Process`, `Local Resources`, `Adoption`, `Maintenance`) all on
   `bc9f47b0-63f2-46ac-b1d0-5e6b361942b4`, verified against the live rows. Duplicating a section in
   the admin UI copies it. `match_fetchmode_patterns.py` handles this by scoping the lookup to the
   page and disambiguating on `(elementType, title, sourceId)`.
   **The open question is T5:** its propagation matched 874 rows on `trackingId`, and if that used a
   page-wide or pattern-wide map without a tie-break, some of those pairings may be wrong. Not
   verified — worth an hour before the T5 hazard half (471 tag writes) runs against three live sites.

12. **Matching a *fix* is not matching an *identity*, and the difference cost three rows.** The T5
   ladder's tiers B and C accept a candidate on `elementType` alone. For a fetch-mode report the
   bound **source** decides both the recommended value and whether the row is in scope — so on
   `the_risk/natural_hazards/hurricane`, where page order had diverged, the ladder paired the
   template's `Hazards_of_Concern` Card with the duplicates' `AVAIL - Fusion Events V2` Card and made
   one `Fix ID` mean two different fixes (T6-C289 / T6-C290). Fixed by requiring `sourceId` in both
   tiers. **It was 3 of 1,037 pairings — the audit found it, not the symptom.** Group the built CSV by
   `Fix ID` and assert one source name and one component kind per group, every rebuild.



0. **The catalog was built on a scanner that could only see half the pattern — fixed 2026-09-01,
   and worth reading before trusting any other count in this family.** Selecting data components on
   `element-data.externalSource` silently excluded every component still stored in the **v1** shape
   (`sourceInfo`), which is **584 of 1,125** here — a little over half. Nothing rendered wrong and
   nothing was mis-written; the failure was a *census* that reported completeness over a target it
   could not see all of. Three consequences that outlive the fix:

   - **A count that does not name the shapes it covered is not a count.** The report now carries
     `Config shape` on every row and every sheet, and the provenance block flags a scan taken with
     the old scanner.
   - **The same assumption may sit in the sibling scripts.** `scan_pattern.mjs` (the T5 alignment
     ladder) reads identity and order only, so it is unaffected; `remove_from_page.mjs`,
     `validate.mjs` and `apply_element_data_key.mjs` address `element-data` by key path and do not
     branch on shape. Checked 2026-09-01 — but re-check anything new before relying on it.
   - **`Header: MNY Data` and `Footer: MNY Footer` bind sources too, and mostly in v1.** The
     no-control appendix grew 11 → 69 (Header 36, Footer 22, Filter 11) purely because 58 of them are
     v1. Still un-settable by an author; still out of scope; now visible.

1. **External components are out of scope, and one named row was held because of it.** The owner
   scoped this to internally sourced components (2026-08-28), and the later narrowing removed them
   again via `--source-allow`. `T6-C009` / section 2011202
   (`Historic Buildings`, Spreadsheet, `the_local_environment/built_environment`) was named in the
   built-environment list but its source is `BILD 2026 Simplified Draft V1 **[external]**`, so both
   the rule (external → Smart) and the scope exclude it. **Not written**; the reason is in its `Notes`
   cell in the report. Still open: whether the 147 external components get `smart` at all, or stay
   on the implicit fallback.

2. **The picker does not say `[internal]`.** The bracketed suffix is composed as
   `srcEnv.includes('+') ? srcEnv.split('+')[1] : envs[srcEnv].label`
   (`useDataSource.js:438-443`). External sources really do read `… [external]`, but internal ones
   read the **instance slug** — on this pattern `[test_meta_forms]` (273 components),
   `[test-meta-forms]` (71) or `[prod]` (10). Anyone scanning the UI for the word `[internal]` will
   find none. The report classifies on `isDms` and prints the composed label beside it, so both views
   agree; **worth confirming the owner is looking at the same thing.**
3. **Three env strings for the same datasets.** `test_meta_forms`, `test-meta-forms` and `prod` all
   resolve to internal sources. Harmless for this fix, but an inconsistency in the template that may
   deserve its own task.
4. ~~**61 in-scope components are `hidden from view`.**~~ **Mostly moot 2026-08-28** — the narrowing
   leaves **1** hidden component in scope. It is flagged in the report's `Notes` and will be set with
   its page; one row is not worth an owner decision.
   **Reopened by the v1 correction, then closed by decision 2026-09-01: it was 8, not 1**, and all 8
   were written with their pages in `2026-09-01-t6-v1-remainder` on the same reasoning. Their report
   `Notes` still read "Owner decision", which is now stale. Worth flagging as a habit rather than a
   problem: the dismissal *"one row is not worth an owner decision"* was made about a number the
   census later multiplied by eight. **When a correction reopens a census, re-check the items that
   were moot-ed because they were small.**
5. ~~**23 in-scope components sit on prototype / duplicate pages.**~~ **Settled 2026-08-28 — out.**
   The owner's instruction was to skip duplicates and stay on the pages already under review, so
   `crit_infra_form_prototype`, `ho_c_form_prototype`, `hurricane_dup` and `actions_edit_list_dup`
   are deferred. They keep their `Fix ID`s, so admitting them later is a rebuild, not a renumbering.
6. ~~**`apply.mjs` cannot write this setting.**~~ **Solved 2026-08-28** — see Progress.
   `apply_element_data_key.mjs`. Keeping the reasoning on record because the two obvious shortcuts are
   both destructive and will look tempting again: `--set element.element-data.display.fetchMode=force`
   lodash-merges an **object over a JSON string**, and `--set element.element-data=<json>` is
   `JSON.parse`d by `parseSetPairs` so the attribute's **type** silently becomes an object.

7. **Three counts of "how many data components", and all three are defensible.** `T6-001` (2026-08-19)
   says **609**, counted over *published* section ids with a wider element-type net. The first T6 scan
   (2026-08-28) says **497/519**, draft ids, **v2 only**. The 2026-09-01 rescan says **1,125**, draft
   ids, **both shapes**. The jump from 519 to 1,125 is the v1 blind spot (Open items 0), not growth;
   the 609 is a different population again. State which one a number comes from rather than replacing
   one with another — the report's provenance block does.

8. **The pattern is moving under the report, and `Fix ID`s are positional.** A rescan two hours after
   the first found **59 pages / 519 data components** where the first found 58 / 497 — other staff
   added a page and 22 components mid-session. Rebuilding would have **renumbered 193 of 497 rows**,
   after the owner had already started working from those ids. Fixed three ways in
   `build_fetchmode_report.py`: a persistent **`--id-ledger`**
   (`scripts/report_fixes/ledgers/t6-fetchmode-ids.json`, seeded from the report already in the
   owner's hands, so `T6-C002`…`T6-C010` keep their meaning), a **refusal** to overwrite when any
   `Fix ID` would move to a different component, and **carry-forward** of the human-owned
   `Assigned to` / `Notes` columns. Two subtleties are written up in the skill's §6b — reserve ids
   from the report as well as the ledger, and a component shared between two pages legitimately
   yields one `Fix ID` on two rows (4 of them here, all `lightning`/`wind`).

9. **8 components written before the narrowing are now out of scope, and stay written.** The
   built-environment run set 7 `LHMP_IA` Cards and 1 `R_and_V_Matrix` Spreadsheet to `force`; the
   narrowing excludes both sources. The owner's call (2026-08-28) is to **leave them as they are** —
   reverting is not required. The report shows them as `Deferred` with the reason and a note that
   they are already stored as `Force`. Worth knowing if page-load timing on
   `the_local_environment/built_environment` is ever measured: those 8 re-query on every mount and
   the narrowed rule would not have asked for it.

10. **Pages the T5 report never assessed are treated as out of scope.** `--page-allow-from` reads
   only the 42 pages T5 covers; the pattern has 59. The allow-list's silence is read as "out",
   which matches the owner's instruction but is a *policy*, not a fact about those pages — the
   `track_progress/actions_*` tree in particular holds 39 `Actions_Revised` components that no one
   has ruled on. If Actions staleness is ever reported on the actions dashboard, that is the first
   place to look.

## Verification standard

Same as the T5 task, with one addition. A row is done when the stored `fetchMode` equals the
recommended value, `updated_at` is the only other leaf that moved, `element-data`'s every other node
is byte-identical, and placement is unchanged. **Plus:** because this setting changes runtime
behaviour rather than metadata, at least one `Force` component should be confirmed in the browser to
actually re-query on mount before the sweep widens. A setting that writes cleanly but changes nothing
is not a fix.

**That addition was under-specified, and the 2026-09-01 check is what showed it.** "Re-query on
mount" is not the discriminating behaviour: `lastFetchKeyRef` is a **per-mount ref**, so a fresh
mount fetches under `smart` exactly as under `force`, and every navigation-based observation confirms
only that the component works. `force`'s sole difference is `bypassDedup` skipping
`fetchKey === lastFetchKeyRef.current` when the load effect **re-runs inside one mount**. So the
standard should read: *a controlled A/B on one component (`force` → `smart` → `force`, reversible via
`rollback.mjs`), or the mechanism accepted as read from source.* Reporting a remount count as proof
would satisfy the letter of the old wording and prove nothing.

## Related

- [`mny-county-template-requirement-tags.md`](./mny-county-template-requirement-tags.md) — the T5
  sweep, PAUSED while other staff edit the templates. **The same pause applies here**: this task's
  writes go to the same patterns.
