# MNY County Template — explicit Data Fetch Mode on every data component (T6-001)

**Project:** MitigateNY · **Topic:** content · **Status:** AWAITING OWNER DECISIONS · **Started:** 2026-08-28

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

## The numbers (pattern 1300890, scanned 2026-08-28, 58 of 58 pages)

| | Count |
|---|---|
| data components (bind an `externalSource`) | **497** |
| in scope — Card 347, Spreadsheet 102, Graph 37 | **486** |
| no `Data Fetch Mode` control — Filter 10, `Header: MNY Data` 1 | 11 |
| external → Smart | 142 |
| internal → Force | 344 |
| **writes needed** | **445** — 399 where nothing is stored, **46** changing a stored `smart` to `force` |
| already correct | 41 (39 internal `force`, 2 external `smart`) |
| hidden from view (`data.hideInView`) | 61, all internal |

```
stored   : not set 410 · smart 48 · force 39     (of 497, incl. the 11 with no control)
resolved : smart  451 · force 39 · cache  7
```

**Nothing in scope is actively broken.** All 7 components that resolve to `cache` — the mode that
never re-queries — are Filters or the Header, none of which has a settable control. So this sweep is
about making the template's intent explicit and correcting 46 wrong-but-deliberate values; it is not
445 broken components.

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
- [ ] **Owner decisions** — Open items 1–4 below. Nothing is written until these are settled.
- [ ] **Agree the write path** — Open items 5. The existing `apply.mjs` cannot set a nested key.
- [ ] **Apply to `county_template`**, a page or two first, then widen.
- [ ] **Scan + match + apply the three duplicates**, one pattern at a time.

## The three county duplicates

Same registry as the T5 task — `suffolk_draft` 2249247, `schenectady_draft` 2304223,
`delaware_draft` 2323808. Not scanned yet: the owner wants `county_template` confirmed first.

When they are, `scan_fetchmode.mjs` runs per pattern and `build_fetchmode_report.py` takes several
`--scan` arguments, so all four patterns land in one document keyed by `Pattern ID` — the same shape
the T5 tab uses. **Each duplicate's recommended fix must be recomputed against its own stored
value**, not copied: an internal component may already be `force` there. That is the same trap the
propagation skill documents for `Notes`.

## Open items

1. **The picker does not say `[internal]`.** The bracketed suffix is composed as
   `srcEnv.includes('+') ? srcEnv.split('+')[1] : envs[srcEnv].label`
   (`useDataSource.js:438-443`). External sources really do read `… [external]`, but internal ones
   read the **instance slug** — on this pattern `[test_meta_forms]` (273 components),
   `[test-meta-forms]` (71) or `[prod]` (10). Anyone scanning the UI for the word `[internal]` will
   find none. The report classifies on `isDms` and prints the composed label beside it, so both views
   agree; **worth confirming the owner is looking at the same thing.**
2. **Three env strings for the same datasets.** `test_meta_forms`, `test-meta-forms` and `prod` all
   resolve to internal sources. Harmless for this fix, but an inconsistency in the template that may
   deserve its own task.
3. **61 in-scope components are `hidden from view`** and never render, so the setting has no runtime
   effect today. Set them anyway for template consistency, or defer them? Not derivable — owner call.
4. **23 in-scope components sit on prototype / duplicate pages** —
   `the_plan/jurisdictional_annexes/crit_infra_form_prototype` (20),
   `the_plan/jurisdictional_annexes/ho_c_form_prototype` (2),
   `track_progress/actions_database/actions_index/actions_edit_list_dup` (1). In or out of scope?
5. **`apply.mjs` cannot write this setting, and the obvious workaround is dangerous.**
   `dms section update --set` merges into the **top level** of `data`; `fetchMode` is nested inside
   the `element-data` JSON string. Setting `element-data` wholesale would re-serialise every Card
   config and lexical body in the payload — the exact failure the T5 loop was built to prove did not
   happen (165 of 165 payloads byte-identical). The fix needs a **targeted nested-key update**: parse,
   set one key, re-serialise, and assert the only moved leaf is
   `data.element.element-data.display.fetchMode`. `validate.mjs` can already express that assertion
   (`fix_lib.diffLeaves` parses `element-data` before diffing); the gap is on the apply side only.
   Either extend the scripts or have the owner set these in the admin UI and use the scan as
   verification — **decide before writing.**
6. **The parent finding's count differs: `T6-001` says 609, this scan says 497.** Not a
   contradiction to resolve silently — the 2026-08-19 count used published ids and a wider
   element-type net, and the template has been edited since, including 61 removals from the T5 sweep.
   Both numbers are stated in the report.

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
