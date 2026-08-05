# Scoping: `__series` column header shows raw key instead of a friendly label

Scoping doc for Ryan's ask: on `converted_reports/floating_car_average_day` (page id 2208008),
the two "Route Compare Component" (Spreadsheet) sections toward the bottom of the page render
their route-name column header as the literal string `__series`. Scope a **going-forward** fix
(no retroactive patch to already-built reports/templates). Verified live against the dev DB
(schema `dms_npmrdsv5`) and the real render code on 2026-08-05.

---

## 1. Root cause — confirmed against the real stored data

Page 2208008 (`npmrds_sub|page`, app `npmrdsv5`) has 10 published sections
(`data->'sections'`). The two matching "toward the bottom" are ids **2208050** and **2208051**,
both titled `"Route Compare Component, Speed"`, both `element['element-type'] === "Spreadsheet"`.

Decoded `element['element-data']` (a **stringified** JSON — see
`npmrds-report-data-shapes.md` §1) for section 2208050:

```json
"columns": [
  {"name": "__series", "alias": "__series", "type": "text", "show": true, "group": true,
   "target": "categorize", "isCalculatedColumn": false, "origin": "comparison-series"},
  {"type": "calculated", "show": true, "name": "... as speed", "fn": "exempt",
   "customName": "Speed"},
  {"type": "delta", ... "name": "... as speed_delta", "customName": "% vs Main"}
],
"comparisonSeries": {"enabled": true, "seriesKey": "__series", "seriesLabel": "Routes", "variants": []}
```

Section 2208051 has the identical `__series` column shape.

**The literal stored column has `name: "__series"` and no `customName`/`display_name`.** Its two
sibling columns in the *same table* DO carry a `customName` ("Speed", "% vs Main") — proving the
override mechanism is already in active use on this exact section, just never applied to the
series-discriminator column. `comparisonSeries.seriesLabel` is present and set to `"Routes"`, but
(per §2) nothing reads it.

## 2. Render path — confirmed, `seriesLabel` is read nowhere

`src/dms/packages/dms/src/patterns/page/components/sections/components/ComponentRegistry/spreadsheet/`
is the Spreadsheet element (`config.jsx` default-exports `{ name: 'Spreadsheet', type: 'table', ... }`,
`EditComp`/`ViewComp` both point at `RenderTable` in `index.jsx`). This is the actual element type
in play — "Route Compare Component"/"Info Box" are old-tool vocabulary, not a DMS element-type string.

Header text is produced in
`src/dms/packages/dms/src/ui/components/table/components/TableHeaderCell.jsx:229-232`:

```jsx
const colIdName = getColIdName(attribute);   // attribute.normalName || attribute.name  (line 10, 171)
...
<span ... title={attribute.customName || attribute.display_name || colIdName}>
    {attribute.customName || attribute.display_name || colIdName}
</span>
```

For the `__series` column: no `customName`, no `display_name`, no `normalName` → falls through to
`attribute.name`, i.e. the literal string `"__series"`. **`TableHeaderCell.jsx` never references
`comparisonSeries` or `seriesLabel` in any form** — confirmed by reading the full file; the prop list
(`isEdit, attribute, columns, display, controls, activeStyle, setState`) has no `comparisonSeries` at
all. Grepping the whole repo for `seriesLabel` (see §4) turns up exactly 4 call sites and **zero**
render-time consumers.

`Card.jsx`/`Card.config.jsx` were also checked (per the task's Info-Box ambiguity) — Card has no
column-header-text rendering path at all (`grep customName|display_name` = 0 hits in `Card.jsx`); a
Card renders one record per card with per-field cells, not a table header row. **This bug is
Spreadsheet-specific**; Card is not a second place needing the same fix for this report page (both
of the actual Info-Box-style sections here are Spreadsheet, confirmed in §1).

An escape hatch already exists today, just undiscoverable: `ColumnManager.jsx:256-260` has a
generic "Name" input, wired to `dwAPI.updateColumn(column, 'customName', ...)`, available for
**any** column regardless of `origin` (unlike the Spreadsheet-only per-header-popup "Display Name"
control in `spreadsheet/config.jsx:245`, which is gated `attribute.origin === 'static'` and so never
shows for the comparison-series column). An author who knows to open Column Manager and rename the
synthetic `__series` row can already fix this per-section by hand. The ask is to make a *good*
label the default, not to add the capability.

## 3. Creation paths — both mint the column with no `customName`

### 3a. Single core mint point (shared `src/dms/`, NOT NPMRDS-specific)

`reconcileComparisonSeriesColumnOnState()` in
`src/dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/useDataWrapperAPI.js:41-80`
is **the one function** that mints/syncs the synthetic column, used by:
- `sectionMenu.jsx`'s built-in "Comparison Series → Enabled" toggle (`sectionMenu.jsx:817-820`)
- `dwAPI.reconcileComparisonSeriesColumn()` (`useDataWrapperAPI.js:179-182`), called by NPMRDS's
  `applyMeasurePick` (`MeasurePicker/index.js:215`) and `applyCalloutStatPick`
  (`CalloutStatPicker/index.js:108`)
- explicitly documented as reusable by the in-progress Add-Graph modal (comment, line 36-38)

Mint body (line 66-75):
```js
state.columns.push({
    name: seriesKey, alias: seriesKey, type: 'text', show: true, group: true,
    target: 'categorize', isCalculatedColumn: false, origin: 'comparison-series',
});
```
No `customName` field set, ever — matches the live DB shape in §1 exactly. This is genuinely core
platform code: any DMS site (not just NPMRDS) that turns on Comparison Series through the standard
`sectionMenu.jsx` UI mints the same bare column.

### 3b. Python conversion path (NPMRDS-specific, `scripts/npmrds-reports/`)

Every Info-Box/Route-Compare Python builder **copies** the `__series` column dict rather than
minting a new one — `next(c for c in base_state["columns"] if c.get("name") == "__series")` appears
in `info_box_templates.py:49,172,259,377,444`, `route_compare_template.py:111`, and
`graph_templates.py:178,199`. The common ancestor is `TEMPLATE_BASE_NAME = "tmc_travel_time_line_graph"`
(`template_specs.py:638`) — its stored `columns[]` entry for `__series` is the literal source every
later template clones. **Consequence:** fixing `TEMPLATE_BASE_NAME`'s own stored `__series` column
(a one-time content edit, not code) would cascade its `customName` into every *newly minted* Python
template going forward, for free, with zero script changes — because `ensure_*` functions
short-circuit (`if templates.get(name) is not None: return templates`) and only ever clone forward
from that one base entry. This is elegant but implicit/fragile: a future engineer editing
`info_box_templates.py` has no code-visible signal that a hand-set DB value is load-bearing for the
label. Recommend making the Python side explicit rather than relying on this (see §5).

### 3c. Live authoring path (NPMRDS-specific, `src/themes/transportny/`)

`MeasurePicker/index.js:158-159` and `CalloutStatPicker/index.js:91-92` both set
`comparisonSeries.seriesKey`/`seriesLabel` defaults, then call `dwAPI.reconcileComparisonSeriesColumn()`
— i.e. they rely entirely on 3a's mint function and never touch the column's `customName` themselves.

## 4. Plurality/naming nuance — confirmed concretely, not guessed

Full-repo grep for `seriesLabel` (all of `src/`, both `.js`/`.jsx`):

| File:line | What it does |
|---|---|
| `sectionMenu.jsx:800` | local default `seriesLabel: ''` in the generic Comparison Series menu's `csConfig` |
| `sectionMenu.jsx:842-846` | the one author-facing text input — writes `comparisonSeries.seriesLabel` |
| `MeasurePicker/index.js:159` | `state.comparisonSeries.seriesLabel = ... || 'Routes'` |
| `CalloutStatPicker/index.js:92` | `draft.comparisonSeries.seriesLabel = ... || 'Routes'` |

That is the **entire** set of references in the codebase. There is no fifth site that *reads*
`seriesLabel` anywhere in the query pipeline (`buildUdaConfig.js`, `getData.js`), the graph renderers
(`graph_new/components/*.jsx`), or the Spreadsheet/Card renderers. **`seriesLabel` is 100% write-only
today** — a config field with a UI to set it and two defaulters, but no consumer.

Checked what graph legends/axes actually use instead, to see whether reusing `seriesLabel` for the
table-header fix would collide with an established plural usage: `LineGraph.jsx:103` and
`BarGraph.jsx:251` both derive series/axis labels from `column.customName || column.display_name || key`
— the same `customName` mechanism, read off the relevant axis/categorize column, **not** from
`comparisonSeries.seriesLabel`. A chart's per-series legend entries are the discriminator column's
*values* (the actual route names/labels), not its column name, so a chart never needed `seriesLabel`
as column-header text in the first place. There is no live usage anywhere that depends on
"Routes" (plural) being the string that ends up rendered.

**Conclusion:** there's no real collision to resolve — `seriesLabel` isn't pulling double duty
today, it's pulling *zero* duty. But the plurality mismatch is still worth flagging: `'Routes'`
(plural, "the label for the whole set of arms") and `'Route'`/`'Route Name'` (singular, "what this
one column/row's value is") are different semantic slots that happen to share a field name and a
common author mental model ("the thing distinguishing my routes"). Recommend **not** wiring the
table-header fallback to read `seriesLabel` at all — give it its own hardcoded singular default
(e.g. `'Route'`) — so the two concepts stay independently editable via the two different UI
surfaces that already exist (`sectionMenu.jsx`'s Series Label input for whatever future plural use;
`ColumnManager.jsx`'s per-column Name input, already wired to `customName`, for the singular
column-header use).

## 5. Recommendation

**Do both, small each:**

1. **Render-level default fallback (shared `src/dms/`, Spreadsheet only).** In
   `TableHeaderCell.jsx`, when the column being rendered is the comparison-series discriminator
   (`attribute.name === comparisonSeries?.seriesKey` or check `attribute.origin === 'comparison-series'`,
   which is already stamped on the column — simpler, doesn't require threading `seriesKey` too) and
   it has no `customName`/`display_name`, fall back to a hardcoded `'Route'` instead of the raw key.
   This self-heals **every** existing and future `__series` column regardless of which creation path
   built it — Python converter, live Measure/Callout picker, the planned Add-Graph modal, or a hand-authored
   section via the generic toggle — with **one change in one place**. It also happens to improve
   already-converted reports' display with no data migration (a side effect of fixing the renderer, not
   scoped work to retroactively patch stored rows — flagging this explicitly since it brushes against
   the stated non-goal, even though no one has to do anything for it to happen).
   - **Requires plumbing `comparisonSeries` down two levels**: `spreadsheet/index.jsx`'s `RenderTable`
     already destructures `state` from `ComponentContext` (line 24) and so already has
     `state.comparisonSeries` in scope — it just isn't passed to `<Table .../>` (line 166-187) today.
     `Table`'s own `index.jsx` would need to forward it into `<TableHeaderCell comparisonSeries={...}/>`.
     Mechanical, not risky, but touches 3 files in core `src/dms/`.
   - This is a **shared-platform change** — `Table`/`TableHeaderCell` are used by every DMS site's
     Spreadsheet sections, not just NPMRDS. Per this repo's own convention, verify it in isolation
     (e.g. a non-NPMRDS Spreadsheet with comparisonSeries off) before/alongside the NPMRDS-specific work,
     not bundled into one NPMRDS PR.

2. **Creation-path explicit default (mixed: one shared, one NPMRDS-specific).** Set `customName`
   explicitly at mint time so the value is visible/editable in `ColumnManager.jsx` immediately,
   rather than only ever existing as an invisible runtime fallback:
   - `reconcileComparisonSeriesColumnOnState()` (`useDataWrapperAPI.js:66-75`, **shared `src/dms/`**) —
     add `customName: 'Route'` to the pushed object. This is the single mint point for every
     *live-authored* comparison series column platform-wide; changing it is also a shared-platform
     change needing isolated verification, same caveat as item 1.
   - Python side (**NPMRDS-specific**, `scripts/npmrds-reports/convert_old_reports_lib/`): make the
     dependency on `TEMPLATE_BASE_NAME`'s stored column explicit instead of implicit — e.g. every
     `next(c for c in ... if c.get("name") == "__series")` copy site could `.setdefault("customName", "Route")`
     defensively, or (cleaner) fix `TEMPLATE_BASE_NAME`'s own stored `__series` column once (content
     edit, via `dms raw update` on the template row, or by re-running the now-fixed live toggle
     against it) and add a one-line comment at each copy site noting that the label rides along from
     there. Either way is NPMRDS-only, no core-platform change.

Item 1 alone is sufficient to solve the literal complaint for every future report, including ones
built by tools not yet written (Add-Graph modal). Item 2 is not strictly load-bearing given item 1,
but makes the label a first-class, author-visible, individually-editable value instead of a silent
fallback — worth doing for the same reason the sibling "Speed"/"% vs Main" columns already carry
real `customName`s rather than relying on a fallback. If forced to pick one, do item 1 first.

## 6. Scope classification summary

| Change | Location | Shared or NPMRDS-only |
|---|---|---|
| `TableHeaderCell.jsx` fallback | `src/dms/packages/dms/src/ui/components/table/components/` | **Shared `src/dms/` submodule** |
| Prop-thread `comparisonSeries` through `Table`/`RenderTable` | `src/dms/packages/dms/src/ui/components/table/index.jsx`, `.../ComponentRegistry/spreadsheet/index.jsx` | **Shared `src/dms/` submodule** |
| `reconcileComparisonSeriesColumnOnState()` default | `src/dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/useDataWrapperAPI.js` | **Shared `src/dms/` submodule** |
| Python converter copy sites / base template content | `scripts/npmrds-reports/convert_old_reports_lib/*.py` | NPMRDS-only |
| `composeMeasureConfig.js`/`MeasurePicker`/`CalloutStatPicker` | `src/themes/transportny/components/` | NPMRDS-only (no change needed if §5 item 1 ships — they already just call `reconcileComparisonSeriesColumn()`) |

Every render-path and core-mint fix lives in the `@availabs/dms` git submodule, i.e. it changes
behavior for every downstream site (transportNY, wcdb, mitigateNY, etc.), not only NPMRDS. Per
`src/dms/planning/planning-rules.md`'s task-location convention, this work should be filed/tracked
under `src/dms/planning/`, not `planning/`, for the shared-code portion — the Python-side portion
stays a `planning/transportny/` (or wherever NPMRDS conversion-script tasks live) item.

## Open questions for Ryan

1. Exact fallback text — `'Route'` vs `'Route Name'` vs something else. This doc assumes `'Route'`
   (matches the singular-per-row semantics) but it's a one-line change either way.
2. Should item 2's Python-side fix be "fix the one base template row" (near-zero code, relies on an
   implicit copy chain) or "defensive `setdefault` at every copy site" (more code, self-documenting,
   survives someone minting a new base template later)? This doc leans defensive but both are cheap.
3. Confirm no objection to the render-level fix (§5 item 1) incidentally improving already-converted
   reports' *display* — no data changes, just what gets painted — given the explicit non-goal was
   about not doing retroactive *patch work*, not about freezing old pages' rendered output.

---

## Implemented, 2026-08-05 — item 1 rejected; item 2 shipped with ZERO shared-code changes

**Ryan's call:** skip §5 item 1 entirely — baking the client-specific term `'Route'` into shared
`src/dms/` platform code (`TableHeaderCell.jsx`) is wrong regardless of the retroactive-display
question, since every downstream site (not just NPMRDS) would inherit an NPMRDS-flavored fallback.
**Did not implement item 1.**

**Correction (same day): the first cut of item 2 also touched shared `src/dms/` code, and Ryan
caught it — rightly.** The initial implementation added an optional `defaultCustomName` parameter
to the shared mint function (`reconcileComparisonSeriesColumnOnState()` in `useDataWrapperAPI.js`)
so NPMRDS callers could pass `'Route'` through it. Ryan's question cut through this immediately:
*why does this need any platform code at all?* `customName` is just a plain field the renderer
already reads — `useAddGraphSection.js` already imported the shared mint function **directly, with
no wrapper**, so nothing stopped NPMRDS's other two call sites from doing the same and setting
`customName` themselves, in their own file, in the same `setState`/plain-object pass. Reverted the
`src/dms/` change completely (confirmed `git diff` on that file is empty) and reimplemented purely
in NPMRDS-owned code:

- `MeasurePicker/index.js`'s `applyMeasurePick` and `CalloutStatPicker/index.js`'s
  `applyCalloutStatPick` now call the **unmodified, already-exported**
  `reconcileComparisonSeriesColumnOnState(draft)` directly inside their own `dwAPI.setState(draft =>
  {...})` callback (both already had direct `dwAPI.setState` access — confirmed by reading the
  existing call sites, not assumed), then find the freshly-minted `origin === 'comparison-series'`
  column in the same draft and set `col.customName = 'Route'` if it isn't already set. One atomic
  state update, zero calls into `src/dms/`'s hook wrapper needed.
- `ReportRouteList/useAddGraphSection.js` already called the pure function directly on a plain
  object (no live `dwAPI` exists yet for a section that doesn't exist) — same pattern, unmodified
  call, then a two-line customName patch on the returned `state.columns` array.
- Python side (`scripts/npmrds-reports/`, NPMRDS-only already, no shared-code question at all):
  `series_col.setdefault("customName", "Route")` (or `x_src`/`cat_col`, whichever variable holds the
  copied `__series` column dict) at every fresh-mint site — `info_box_templates.py` (5 sites),
  `route_compare_template.py` (1), `graph_templates.py` (2).

**Corrected scope on "don't touch old stuff," per Ryan, same day.** The first pass over-engineered
this: it specifically re-ordered one Python function (`ensure_pm3_join_template`) so its "upgrade an
existing template" branch could never pick up the new `customName`, and wrote a unit test asserting
an already-existing template's column stayed untouched. Ryan's correction: he never asked for that
guarantee — **every current DMS report/template in this arc is disposable demo data, not
production** (nothing built so far is client-facing), and the actual ask was narrower: don't spend
time patching/validating a pile of old data that doesn't matter, not "never let a code change
incidentally touch it." Reverted that special-casing — the `customName` default now sits at the
plain, uniform extraction site in every function, same shape everywhere, including
`ensure_pm3_join_template`'s existing-upgrade branch. Simpler code, and if that branch ever fires
again on an old reliability template, it now also gets the better label as a side effect — which is
fine, not a bug to guard against.

**Verify URL (going forward — new sections/conversions get the label; nothing was retroactively
patched, but nothing was specially protected from it either):** build any new Report Page
graph/Info-Box-style section via Measure Picker, Callout Stat, or the Add-Graph modal, enable
Comparison Series, and check the resulting column/legend header reads "Route" instead of "__series".
A fresh Python conversion of a not-yet-built template (e.g. one of the 22 remaining candidates) will
show the same fix in its Info Box/Route Compare Component sections once built.
