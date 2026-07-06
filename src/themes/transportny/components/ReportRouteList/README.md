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
[History](#history-what-this-replaced) for the old picker-based model this replaced.)

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

Every mutation (`persistRoutes`, the orphan-cleanup effect, the add-route fetch) and every mutating
control (reorder, rename, remove, the graph-assignment chips) is gated on `PageContext`'s
`editPageMode` — not this component's own `props.isEdit`, which means "this section's own settings
editor is open," not "the page is in edit mode" (see Gotchas). Outside edit mode the panel renders
read-only. This matters: before the gate existed, merely *viewing* a published report could silently
strip a route's graph assignments (the orphan-cleanup effect compared draft-captured ids against the
published id set and concluded they were stale).

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

## History: what this replaced

Earlier versions modeled a report as a **separate data row** (`reports_snap_2`, selected via a
`report_id` picker across many report rows) carrying both `routes` and a `graph_comps` array of
section-shaped graph objects, injected into the live page via a `setItem` escape hatch added to
`view.jsx`/`edit/index.jsx` specifically for this component. That leaked: any generic section
operation (e.g. reorder) would materialize the injected graphs into real, persisted component rows,
double-storing them (confirmed live on page `2180280`, ids `2186931`/`2186932` — cleanup still
pending). The current model (report = page, graphs = normal sections, dynamic binding via the
`comparison_series` subscriber) eliminates the injection path entirely.
