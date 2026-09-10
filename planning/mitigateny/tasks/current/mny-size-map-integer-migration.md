# Bring the mny sectionArray size map onto the 1–12 integer convention

**Project:** MitigateNY · **Topic:** themes · **Status:** SCOPED, not started · **Started:** 2026-09-09

Split out of [`mny-lhmp-home-live-build.md`](./mny-lhmp-home-live-build.md) **work item B**, on the
recommendation recorded there: this is a theme-and-content migration across every mny pattern with a
live-render blast radius, and it should not be the tail of a page build. That build took the
**4 + 8 interim** and needs nothing from this task.

## Objective

Replace mny's fractional `sizes` map with the plain-integer `"1"`–`"12"` convention already shipping
in the two newest themes, and rewrite every stored section `size` in every mny pattern to match, in
one coordinated change.

## Why

Three different `sizes` conventions are live in this repo:

| Where | Convention |
|---|---|
| **`wcdb`** (`wcdb_theme.js:36-51`) and **`transportny` themev2** (`themev2.js:2438-2452`) | Plain integers `"1"`–`"12"` → `md:col-span-1` … `md:col-span-12`, with `_replace: ["sizes"]`, `gridSize: 12`, `defaultSize: "12"`. Every column width available. **The current convention.** |
| **library default** (`sectionArray.theme.jsx:32-37`) | An older, narrower set on a **6-column** basis — only `1/3`→`md:col-span-2`, `1/2`→3, `2/3`→4, `1`→6. |
| **`mny`** (`theme.js:499-510`) | A fractional hybrid on a 12-col grid: `1/12`, `1/6`, `1/4`, `1/3`, `1/2`, `2/3`, `1`(=**9**), `2`(=**12**). |

mny is the outlier. It has **no 5-step and no 7-step**, which is what forced the LHMP plan home's
hazard band onto 4 + 8 instead of the design's 5 + 7. It also reads differently from every other
theme: an mny `"1"` is 75% and an mny `"2"` is full width.

mny already runs a 12-column grid (`container: "w-full grid grid-cols-6 md:grid-cols-12"`,
`gridSize: 12`), so the grid needs no change — only the size vocabulary.

## ⚠ This is a breaking data migration, not an additive theme edit

The keys **collide with opposite meanings**. In the integer convention `"1"` is `col-span-1` and
`"2"` is `col-span-2`; in mny they are 9 and 12. Flipping the map without rewriting stored data
re-renders every existing section catastrophically: **everything currently full-width (`"2"`) becomes
17% wide, and everything at 75% (`"1"`) becomes 8%.** That is exactly why wcdb and transportny carry
`_replace: ["sizes"]` — they replace the map rather than merge into it.

The stored-`size` rewrite required, applied before or atomically with the theme change:

| Stored now | Becomes | Renders |
|---|---|---|
| `"1/12"` | `"1"` | col-span-1 |
| `"1/6"` | `"2"` | col-span-2 |
| `"1/4"` | `"3"` | col-span-3 |
| `"1/3"` | `"4"` | col-span-4 |
| `"1/2"` | `"6"` | col-span-6 |
| `"2/3"` | `"8"` | col-span-8 |
| `"1"` | `"9"` | col-span-9 |
| `"2"` | `"12"` | col-span-12 |

**Blast radius is every pattern using the mny theme:** `county_template` (1300890) and its four
duplicates — `suffolk_draft` 2249247, `schenectady_draft` 2304223, `delaware_draft` 2323808,
`MitigateNY_Nassau_V2` 2407262 — plus the statewide `MitigateNY_2025` (985070), the `/admin` pattern,
and anything else on the mny theme.

`size` lives on the **section row** (`data.size`), not inside `element-data`, so the write is simpler
than the fetch-mode sweep — but there are far more rows, and both `sections` and `draft_sections`
snapshots reference them.

## Sequencing

The two conventions cannot coexist in one map, so this is **not** a two-step migration like the
`mnyHeader` move. It is one coordinated change:

1. **Census first — the existing reports cannot answer this.** Neither
   `src/themes/mny/design/reports/pattern-component-catalog.csv` nor
   `county-template-qa-t6-fetchmode.csv` carries a `size` column. Scan every mny pattern for the
   distinct stored `size` values and their counts, exactly as the fetch-mode sweep did for its
   setting. Expect the census itself to surface surprises — that sweep found 584 of 1,125 components
   invisible to its first scan.
2. Rewrite all stored sizes to integers per the table above.
3. Flip the theme: `_replace: ["sizes"]`, the `"1"`–`"12"` map, `defaultSize: "12"`.
4. Verify with a before/after render diff over a sample of pages **in every mny pattern**.

## Do not forget

- `sectionMenu.jsx:1234-1238` builds the size picker from `Object.keys(theme.sizes)` ordered by
  `iconSize`, so the picker follows automatically — but the `iconSize` values must be set (wcdb uses
  8.3 … 100).
- `sectionArray.jsx:319,463` resolves `theme?.sizes?.[size] || theme?.sizes?.[defaultSize]`, so **any
  row the rewrite misses silently falls back to `defaultSize` rather than erroring** — a missed row
  looks like a layout bug, not a failure. **Validate by count, not by eyeball.**
- Sections written by the LHMP plan-home build (`scratchpad/mitigat-ny-prod-prod/build_lhmp_home_new.mjs`)
  use `1/3`, `1/4`, `2/3` and `2`; the script's `size` values must be updated in the same pass, or a
  re-run will reintroduce fractional values after the migration.
- The related question — whether the **library default** should also move to 1–12 — is settled in
  direction and out of scope here: the owner confirmed 2026-09-09 that it probably should, but not as
  part of this work. It is recorded under `## patterns/page — sections` in
  [`src/dms/planning/todo.md`](../../../../src/dms/planning/todo.md).

## Testing Checklist

- [ ] Census taken: every mny pattern scanned, distinct stored `size` values and counts recorded
- [ ] Every stored `size` rewritten per the mapping table — verified **by count**, not by eyeball
- [ ] Theme flipped with `_replace: ["sizes"]` + `defaultSize: "12"` + `iconSize` on every step
- [ ] Before/after render diff clean on a sample of pages in **every** mny pattern
- [ ] `build_lhmp_home_new.mjs` size values updated
- [ ] The LHMP plan home's hazard band re-checked — it can now take the design's 5 + 7
