# MNY County Template — explicit Data Fetch Mode on every data component (T6-001)

**Project:** MitigateNY · **Topic:** content · **Status:** IN PROGRESS · **Started:** 2026-08-28

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

## Deliverables built 2026-08-28

`src/themes/mny/design/reports/county-template-qa-t6-fetchmode.{csv,xlsx,html}` — one row per data
component with `Draft section ID`, `Page URL`, `Page`, `Section title`, component kind, the source and
its class, the stored fetch mode, the resolved behaviour, and a per-row `Recommended fix`. The
`.xlsx` is the working document (two sheets, auto-filter, empty `Status` / `Assigned to` /
`Date fixed` / `Notes` columns); the `.html` is a filterable read-only view.

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

## The numbers (pattern 1300890, rescan 2026-08-28 after the natural-hazards run, 59 of 59 pages)

| | Count |
|---|---|
| data components (bind an `externalSource`) | **519** |
| **in scope after the narrowing** | **99** on **20** pages |
| deferred out of scope | 409 |
| no `Data Fetch Mode` control — Filter 10, `Header: MNY Data` 1 | 11 |
| **writes outstanding** | **0** |
| already correct | **99** |

```
whole pattern, stored : not set 395 · smart 12 · force 112
```

**The narrowing cut the work from 457 outstanding writes to 63, and all 63 are now applied** across
three runs — 14 on the planning-process pages and 49 on the natural-hazards pages (plus the 8 written
before the narrowing, which fall outside it and were left as-is). **`county_template` is complete
under the narrowed scope.**

**Nothing in scope is actively broken.** All 7 components that resolve to `cache` — the mode that
never re-queries — are Filters or the Header, none of which has a settable control. So this sweep
makes the template's intent explicit and corrects wrong-but-deliberate `smart` values; it is not a
list of broken components.

## Progress

- [x] **Read `T6-001` and the superseded inventory** — 2026-08-28. The old CSV addresses *published*
      section ids, which go stale on every publish, so it cannot drive a fix loop (see the fix-loop
      skill's "the report must address DRAFT sections").
- [x] **Established where the setting lives and how it resolves** — 2026-08-28.
      `data.element['element-data'].display.fetchMode`, with
      `fetchMode ?? (readyToLoad === true ? 'smart' : 'cache')` as the fallback
      (`dataWrapper/useDataLoader.js:245-247`). Only `Card.config.jsx`, `spreadsheet/config.jsx`,
      `graph/config.jsx` and `graph_new/config.jsx` register the control.
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
      other 16 pages were already flagged. **This closes `county_template`: 99 in scope, 99 correct,
      0 outstanding.**
- [x] **Shared sections checked before baselining** — 2026-08-28. Four `Fix ID`s span two hazard
      pages each (the `wind`/`lightning`/`tornado` sharing the T5 task tracks). All are `LHMP_IA`, so
      the narrowing excluded them and the run had 81 rows over 81 distinct section ids. Had one been
      in scope, the second page's row would have tripped the loop's drift refusal. **Re-check this
      every run** — it was luck, not design.
- [ ] **Confirm a `force` component actually re-queries in the browser.** The last thing outstanding
      on `county_template`, and now testable on any of 20 written pages. A setting that writes
      cleanly but changes nothing is not a fix — see Verification standard.
- [ ] **Scan + match + apply the three duplicates**, one pattern at a time. Recompute each row's
      recommended fix against the duplicate's own stored value, and apply the **same narrowed scope**
      — six sources, T5-`Relevant` pages — not the original whole-pattern rule.

## The three county duplicates

Same registry as the T5 task — `suffolk_draft` 2249247, `schenectady_draft` 2304223,
`delaware_draft` 2323808. Not scanned yet: the owner wants `county_template` confirmed first.

When they are, `scan_fetchmode.mjs` runs per pattern and `build_fetchmode_report.py` takes several
`--scan` arguments, so all four patterns land in one document keyed by `Pattern ID` — the same shape
the T5 tab uses. **Each duplicate's recommended fix must be recomputed against its own stored
value**, not copied: an internal component may already be `force` there. That is the same trap the
propagation skill documents for `Notes`.

## Open items

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
5. ~~**23 in-scope components sit on prototype / duplicate pages.**~~ **Settled 2026-08-28 — out.**
   The owner's instruction was to skip duplicates and stay on the pages already under review, so
   `crit_infra_form_prototype`, `ho_c_form_prototype`, `hurricane_dup` and `actions_edit_list_dup`
   are deferred. They keep their `Fix ID`s, so admitting them later is a rebuild, not a renumbering.
6. ~~**`apply.mjs` cannot write this setting.**~~ **Solved 2026-08-28** — see Progress.
   `apply_element_data_key.mjs`. Keeping the reasoning on record because the two obvious shortcuts are
   both destructive and will look tempting again: `--set element.element-data.display.fetchMode=force`
   lodash-merges an **object over a JSON string**, and `--set element.element-data=<json>` is
   `JSON.parse`d by `parseSetPairs` so the attribute's **type** silently becomes an object.

7. **The parent finding's count differs: `T6-001` says 609, this scan says 497.** Not a
   contradiction to resolve silently — the 2026-08-19 count used published ids and a wider
   element-type net, and the template has been edited since, including 61 removals from the T5 sweep.
   Both numbers are stated in the report.

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

## Related

- [`mny-county-template-requirement-tags.md`](./mny-county-template-requirement-tags.md) — the T5
  sweep, PAUSED while other staff edit the templates. **The same pause applies here**: this task's
  writes go to the same patterns.
