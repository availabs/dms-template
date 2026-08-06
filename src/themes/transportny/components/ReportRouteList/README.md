# ReportRouteList

`ReportRouteList` is a custom **page section component** for the `transportny` theme. It renders a
side-panel UI for managing the **routes** (named groups of NPMRDS TMC segments + a date range) of a
**report**.

## The model: a report is a page

A "report" is not a separate data row selected via a picker — **a report is a page**, created from the
`npmrds_sub` pattern's **Report Page** template (a DB-backed page template — see
[Where the template lives](#where-the-template-lives)). Graphs that want to visualize the report's
routes are added through the normal **Add Component** flow and bind to the panel via a page action
param — there is no `graph_comps` field, no injected sections, no `setItem` fork. (See
[Design iterations during development](#design-iterations-during-development) for earlier approaches
tried and rejected before landing here — none of these ever shipped to `master`.)

## Where it lives

```
src/themes/transportny/components/ReportRouteList/
├── ReportRouteList.jsx        ← the component
├── ReportRouteList.theme.js   ← Tailwind class map (the `t` object)
├── index.jsx                  ← ComponentRegistry entry (name/type/EditComp/ViewComp/controls/defaultState)
└── README.md                  ← you are here
```

Registered as a theme page component (`theme.pageComponents.ReportRouteList`) in
`src/themes/transportny/theme.js` and `themev2.js`. It's a `useDataSource`/`useDataWrapper` component,
so it mounts inside the standard **dataWrapper** — but `state.data` (the dataWrapper's own row binding)
is unused; routes are loaded/persisted by the component itself (see Storage below).

## Storage: two independent sectionMenu bindings, one row per report

`ReportRouteList` needs two independent dataset pointers, and gets both from this section's own
sectionMenu — no page attribute, no hardcoded source, no DMS-core changes:

- **Storage** (this report's own routes) reads `state.externalSource` — the normal sectionMenu
  "Dataset" pick. The Report Page template pre-wires this to `reports_snap_2`, one row per report
  (`report_id = <page id>`, a `routes` JSON-array column). `loadReportRow`/`persistRoutes` read/write
  this row directly via `apiLoad`/`apiUpdate` — the same generic mechanism Card/Spreadsheet use for
  their own editable rows.
- **Route catalog** (which routes are addable) reads `state.join.sources.<alias>.sourceInfo` — the
  sectionMenu's **"Add Join Source"** slot, deliberately left *incomplete* (source + view picked, no
  join columns). `buildUdaConfig.js`'s `isJoinComplete()` requires non-empty join columns before a
  join alias is ever sent to the query engine, so this is a real, author-configurable source pointer
  that never actually fires a SQL join. `fetchDynamicRoute()` builds its own independent query against
  this `sourceInfo` to resolve a route by id.

Both bindings are pre-wired on the Report Page template, so an author never configures either
manually. Two other designs were tried and rejected before landing here — worth knowing if this needs
to change again:
- **A bespoke page attribute** (`routes`/`draft_routes` on `Page`) — a one-off concept only this
  component needed, baked into shared `page.format.js`. Reverted.
- **This section's own `element-data`** — looked schema-free but wasn't: `dataWrapper`'s
  settings-editor save effect rebuilds `element-data` from a hardcoded field allowlist, and `routes`
  wasn't in it, so routes were silently stripped moments after being written whenever the save effect
  fired for an unrelated reason. Reverted (see Gotchas).
- **A hardcoded dataset constant** in `ReportRouteList.jsx` (an earlier version of today's
  `reports_snap_2` row) — worked, but hardcoded a specific `app`/`source_id`/`view_id` in code, which
  is a repo-convention violation (dataset choice is an author decision). Replaced by the sectionMenu
  binding above.

## Publishing routes to graphs: per-graph, via a self-resolving key

Each graph on the page gets its **own** route list — a route is added to a graph one click at a time.
The mechanism:

- A graph's `comparison_series` subscriber carries the reserved sentinel `paramKey: '$self'` instead of
  an author-typed literal. `usePageFilterSync` resolves `'$self'` to a key derived from the graph's own
  stable identity (`selfParamKey(trackingId || sectionId)`) — every graph is automatically, uniquely
  addressable the moment it's added, no author configuration needed. (`trackingId`, not the section's
  row id, because draft and published copies of a section have different ids — see Gotchas.)
- `ReportRouteList` never writes into a graph's row (a cross-section write was considered and rejected
  — the same class of coupling that caused the original `graph_comps` leak). It only *reads* sibling
  sections to discover which ones carry an enabled `$self` subscriber (`findSelfBoundGraphs`), labeling
  them ordinally ("Graph 1", "Graph 2", ...) for the UI.
- Each route carries a hidden `graphIds: string[]` (section identities it's been clicked onto) — never
  surfaced as an abstract "group"; the UI is a chip per discovered graph, toggled on click. A route
  feeds no graph until explicitly assigned. Removing a graph section strips its id from every route's
  `graphIds` and clears its stale action param.
- The publish effect loops over discovered graphs, publishing each one's filtered route subset to its
  own key via `setActionParam` (guarded with `isEqual` per key to avoid a write→re-render→write loop).

A graph that wants a **frozen snapshot** instead can carry a baked `comparisonSeries.variants` (e.g. a
one-time `transformReportRoutes(routes)` capture) instead of a subscriber — `buildUdaConfig` prefers
the dynamic `config` when present, falls back to `variants`, so both binding modes coexist with no
special-casing. Hand-typed literal `paramKey`s also still work; `'$self'` is additive.

## Edit-mode gating

Two independent flags, both required before any mutation fires — conflating them (or dropping
either) was a real bug, fixed 2026-08-03 (see `planning/transportny/tasks/current/reportroutelist.md`):

- `PageContext`'s `editPageMode` — is the page open at `/edit/...` at all. This alone decides which
  sections array (`draft_sections` vs `sections`) is currently on screen (`useGraphPublish`'s
  `sectionsKey`) and whether an author sees raw Dynamic Report slot placeholders vs a viewer's
  resolved routes. It says nothing about whether *this* section has been individually opened for
  editing — before the fix, RRL used this flag alone, so every mutating control went live the
  instant the page opened at `/edit/...`, without the user ever entering this section's own edit
  mode, unlike every other content-bearing section (Card, Spreadsheet) on the same page.
- This component's own `props.isEdit` — dataWrapper's per-section signal, true only while *this*
  section's own settings editor is open (the "Edit" pencil in its Settings menu, same mechanism
  every section gets — `sectionArray.jsx`'s `edit.index === i` toggle). Destructured in
  `ReportRouteList.jsx` as `sectionEditorOpen`.

`canMutate = editPageMode && sectionEditorOpen` gates every mutation (`persistRoutes`, the
orphan-cleanup effect, the add-route fetch, the Dynamic Report toggle) and every mutating control
(reorder, rename, remove, date-edit, the graph-assignment chips, +Add Route/Route Slot/Graph) — the
user must click this section's own "Edit" pencil before any of it is even reachable, matching how
Card/Spreadsheet gate row CRUD via `SectionEdit` vs `SectionView`. Outside that, the panel renders
read-only. `editPageMode` alone still gates the read-only/display-only decisions listed above (it
matters that those keep working regardless of whether this section's own pencil is open — sibling
graphs still need to discover draft sections, and Dynamic Report authors still need to see raw
placeholders, without first clicking into RRL specifically). This distinction also fixed the
original bug this gate was built for: before *any* gate existed, merely *viewing* a published report
could silently strip a route's graph assignments (the orphan-cleanup effect compared draft-captured
ids against the published id set and concluded they were stale).

**Publish/Discard still don't apply to route content, and that's not a gap this fix addresses.**
RRL's routes live in the separate `reports_snap_2` dataset row (see Storage above), which the page's
`sections`/`draft_sections`/Publish/Discard machinery (`editFunctions.jsx`'s `publish`/
`discardChanges`) never touches — same as Card/Spreadsheet row CRUD (`dataWrapper/index.jsx`'s
`updateItem`/`addItem`/`removeItem`, always an immediate `apiUpdate` straight to the bound dataset,
no staging). This gate gets RRL to require entering the section's own edit mode before mutating, the
same as every other content-bearing section; it does not add undo/publish for route content, because
no dataset-content edit anywhere in DMS has that today.

## View-mode visibility: hidden from real viewers, always shown to authors

`ReportRouteList` renders **nothing** to a real viewer (`editPageMode` false) — mirroring the old
tool, whose route sidebar never appeared outside authoring either. The one exception: a Dynamic Report
with no (or a mismatched) `?routes=` still needs to show its blocking route-selection modal
(`RouteTagBrowserModal`), or a first-time viewer would hit a permanently blank page with no way to ever
pick routes.

```jsx
if (!isEdit) {
  return routeSelectionModal; // null for a normal report, or the blocking picker for an unresolved Dynamic Report
}
```

**Deliberately NOT implemented via the generic `hideInView` section flag** (`sectionMenu.jsx`'s "Hide
Component" toggle, checked by `sectionArray.jsx`'s `hideSectionCondition`) — that flag filters the
*entire* section out of the tree before it ever mounts, which would also silently swallow the
entry-gate modal above. Confirmed live, 2026-08-05: a Dynamic Report with `hideInView` on and no
`?routes=` rendered nothing, forever, with no UI path to ever pick routes. Self-hiding inside the
component instead keeps that one exception alive, and is unconditional — no per-report author toggle
to remember, unlike `hideInView`. **Never set `hideInView` on this component's section** — see
Gotchas below.

## Expanded route row: collapsed-by-default subsections (`RouteRow.jsx`)

Redesigned 2026-08-05 from a real design critique (a screenshot of a route acting as the base for 8
date-derived siblings). The old expanded row rendered every control open all the time — TMCs, a full
disabled date-range block plus an italic run-on sentence naming every dependent, an always-open
`ColorPicker` (swatch grid + gradient + hue bar), a flat wrap of every graph chip, and a full-width red
"Remove Route from Report" button — all visible at once regardless of whether the author needed any of
it right now.

`RouteRow.jsx` now keeps each of those as its own local disclosure (`dateDetailsOpen`, `depsOpen`,
`colorOpen`, `menuOpen` — plain `useState`, ephemeral, never lifted to the parent, same convention as
the pre-existing `showAllTmcs`):

- **Date Range** collapses to a one-line summary (`"1/1/2024 – 12/31/2024 · Weekdays only"`, or
  `"· Derived from {base name}"`) — the full read-only detail, or the Fixed/Derived edit controls,
  only mount once expanded or once actively editing.
- **"Base for N routes"** is a standing, always-visible one-liner (independent of the Date Range
  disclosure above) that expands into a pill list of dependent names — replaces the old italic
  run-on sentence, the worst offender in the original critique.
- **Appearance** collapses to a color swatch + label; the real `ColorPicker` only mounts once clicked
  open.
- **Graphs** are grouped into "On"/"Off" with a `"N of M graphs"` summary line, instead of one flat
  alphabetical wrap of every chip.
- **Remove** (and **Rename**, moved here as a same-arc follow-up) live in a "⋮" overflow menu next to
  the reorder arrows, instead of a full-width danger button competing with routine controls on every
  expanded row.

The kebab trigger's wrapper needs `relative flex items-center`, not just `relative` — a plain block
wrapper around an inline-block `Button` doesn't center the button inside it, landing it a few px off
from the reorder arrows beside it (real bug, caught live, fixed same day).

Live-verified against `converted_reports/year_over_year_beginner_0` (Dynamic Report, slot placeholders)
and `converted_reports/claude_scratch_tag_browser` (real TMC data — confirms the redesign didn't
regress TMC rendering; it was only ever absent on Dynamic Report slot placeholders, unrelated to this
pass).

## Where the template lives

The **Report Page** template — the `ReportRouteList` panel + one starter "AVL Graph" pre-wired with a
`$self`-bound `comparison_series` subscriber — is a **DB-backed page template**
(`npmrds_sub|page_template` row `2187021`, "Report Page"), not code, since it's specific to the
`npmrds_sub` pattern. Authors create a new report via **+ Add Page → Your Templates → Report Page**.
See `page-templates.md` for how page templates work generally.

## Gotchas for the next developer

- **`dataWrapper`'s settings-editor save effect (`toSave`) rebuilds `element-data` from a hardcoded
  field allowlist.** Any new per-section state key must be added there explicitly or it's silently
  stripped the next time the effect fires for an unrelated reason (bit `join` once, and `routes` once
  when routes briefly lived in `element-data` — see Storage above).
- **`props.isEdit` ≠ "the page is in edit mode."** It's `Boolean(onChange)` — true only while *this
  section's own* settings editor is open. Use `PageContext`'s `editPageMode` for page-level checks.
- **Draft and published sections are separately materialized row sets**, not the same rows at
  different lifecycle stages — a section's identity that needs to survive a publish cycle must use
  `trackingId` (assigned once at creation), not the row id.
- **`route_comp_id` is a local join key only** (`comp-<n>`, assigned by this component) — not a DB id.
- **Never set the generic `hideInView` section flag on this component.** It filters the whole section
  — including the Dynamic Report entry-gate modal — out of the view-mode tree before mount. The
  component already hides itself correctly (see View-mode visibility above); `hideInView` only
  reintroduces the exact bug that section fixed.

## Design iterations during development

Reports didn't exist in `master` before this component — everything below describes iterations tried
and rejected during this branch's own development, not a predecessor that ever shipped.

An early iteration modeled a report as a **separate data row** (`reports_snap_2`, selected via a
`report_id` picker across many report rows) carrying both `routes` and a `graph_comps` array of
section-shaped graph objects, injected into the live page via a `setItem` escape hatch added to
`view.jsx`/`edit/index.jsx` specifically for this component. That leaked: any generic section
operation (e.g. reorder) would materialize the injected graphs into real, persisted component rows,
double-storing them (observed on a dev-only page during that iteration, ids `2186931`/`2186932` —
that page/data lives only in the dev DB from this branch's own in-progress work and isn't a `master`
migration concern, though the leaked rows themselves are still dev-DB cleanup debt). The current model
(report = page, graphs = normal sections, dynamic binding via the `comparison_series` subscriber)
eliminates the injection path entirely.
