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
  their own editable rows. The same row also carries `graph_count`/`counts_label` (2026-09-04,
  `npmrds-all-reports-list-page.md`'s "routes/graphs" column) — a spec-built report gets these once
  at build time (`report_build.mjs`/the Python converter); a hand-authored report gets them kept live
  by `ReportRouteList.jsx`'s own count-sync effect + `persistCounts`, which recomputes them from this
  report's real route count and `useGraphPublish`'s live self-bound-graph discovery on every route/
  graph add or remove.
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

Each graph on the page gets its **own** route list, weekday mask, and time-of-day window — a route is
assigned to a graph (and that graph's own window set) via its **Quick Controls** row
(`components/QuickControls/`), not through this panel. The mechanism:

- A graph's `comparison_series` subscriber carries the reserved sentinel `paramKey: '$self'` instead of
  an author-typed literal. `usePageFilterSync` resolves `'$self'` to a key derived from the graph's own
  stable identity (`selfParamKey(trackingId || sectionId)`) — every graph is automatically, uniquely
  addressable the moment it's added, no author configuration needed. (`trackingId`, not the section's
  row id, because draft and published copies of a section have different ids — see Gotchas.)
- `ReportRouteList` never writes into a graph's row (a cross-section write was considered and rejected
  — the same class of coupling that caused the original `graph_comps` leak). It only *reads* sibling
  sections to discover which ones carry an enabled `$self` subscriber (`findSelfBoundGraphs`), labeling
  them ordinally ("Graph 1", "Graph 2", ...) for the UI, and — since design push #2, 2026-08-06 — also
  reads each one's own `routeIds`/`weekdays`/`start`/`end` straight out of the same parsed
  `display._measurePick` blob (see `MeasurePicker/composeMeasureConfig.js`'s `DEFAULT_PICK`).
- **A route itself carries none of that.** A route (this panel's own storage row) is name · colour ·
  TMCs · date span, full stop — no weekday mask, no time-of-day, no graph assignment. Those three moved
  to the **graph's own** `display._measurePick.{weekdays,start,end,routeIds}`, written by that graph's
  own Quick Controls via the same `applyMeasurePick` the older Settings-drawer Measure picker already
  used — this panel never writes them. `routeIds` is the *inverse* of the old per-route `graphIds`: a
  graph now holds the list of routes it draws, not a route holding the list of graphs it feeds.
- Since a graph needs the report's full route catalog to offer a "Routes" picker without its own fetch,
  this panel broadcasts it (id/name/colour/TMCs/date-span per route) to one fixed, page-wide `pageState`
  key (`ROUTE_CATALOG_PARAM_KEY`, `useGraphPublish.js`) via the same generic `setActionParam` mechanism
  used per-graph below — any graph's Quick Controls reads it straight off `pageState`.
- The publish effect loops over discovered graphs, crosses each one's own weekday/time-of-day window
  against its own `routeIds` (looked up against this panel's routes), and publishes the result to its
  own key via `setActionParam` (guarded with `isEqual` per key to avoid a write→re-render→write loop). A
  `routeIds` entry whose route was since removed from the report simply resolves to nothing and is
  silently dropped — no cleanup effect rewrites the graph's own stored pick to strip it (Ryan,
  2026-08-06: a stale id sitting unused forever isn't worth building cleanup for).

A graph that wants a **frozen snapshot** instead can carry a baked `comparisonSeries.variants` (e.g. a
one-time `transformReportRoutes(routes, window)` capture) instead of a subscriber — `buildUdaConfig`
prefers the dynamic `config` when present, falls back to `variants`, so both binding modes coexist with
no special-casing. Hand-typed literal `paramKey`s also still work; `'$self'` is additive.

## Edit-mode gating

`canMutate = editPageMode` — RRL mutates unconditionally the moment the page is open at
`/edit/...`, with no requirement to also open this section's own settings-editor pencil first. This
is a **deliberate break from DMS's normal per-section view/edit gating**, made in service of
authoring ease (`report-authoring-ux-overhaul.md` item 3, 2026-08-19) — not an oversight to fix.

- `PageContext`'s `editPageMode` — is the page open at `/edit/...` at all. This decides which
  sections array (`draft_sections` vs `sections`) is currently on screen (`useGraphPublish`'s
  `sectionsKey`) and whether an author sees raw Dynamic Report slot placeholders vs a viewer's
  resolved routes, in addition to gating every mutating control below.

**History**: from 2026-08-03 to 2026-08-19, `canMutate` also required this component's own
`props.isEdit` (dataWrapper's per-section signal, true only while *this* section's own settings
editor pencil was open) — added to suppress an orphan-cleanup effect that used to strip a route's
`graphIds` on every render while `editPageMode` was true, mount included. Design Push #2
(2026-08-06) deleted that effect entirely (route→graph assignment moved to QuickControls' own
`_measurePick.routeIds`, see below) — every remaining `persistRoutes`/`apiUpdate` call in this
component fires only from an explicit `onClick`/modal-confirm handler, never a `useEffect`, so the
extra pencil-click stopped protecting anything and was removed 2026-08-19. **No safety net was
added for the Remove Route control in its place** — Ryan's explicit call: zero added friction over
guarding the one control that became more reachable, since it wasn't already gated on anything else
either.

`canMutate` gates every mutation (`persistRoutes`, the add-route fetch, the Dynamic Report toggle)
and every mutating control (reorder, rename, remove, date-edit, +Add Route/Route Slot/Graph).
Outside `editPageMode`, the panel renders read-only (or hides entirely — see View-mode visibility
below).

**Publish/Discard still don't apply to route content, and that's not a gap this fix addresses.**
RRL's routes live in the separate `reports_snap_2` dataset row (see Storage above), which the page's
`sections`/`draft_sections`/Publish/Discard machinery (`editFunctions.jsx`'s `publish`/
`discardChanges`) never touches — same as Card/Spreadsheet row CRUD (`dataWrapper/index.jsx`'s
`updateItem`/`addItem`/`removeItem`, always an immediate `apiUpdate` straight to the bound dataset,
no staging). Extending Publish/Discard to RRL's own changes is tracked as item 9 in
`report-authoring-ux-overhaul.md`, deferred entirely as of 2026-08-19.

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

## Route row: one combined expand/edit toggle (`RouteRow.jsx`)

This section has been redesigned several times since an original 2026-08-05 disclosure-based pass
(a `menuOpen`/`colorOpen`/`dateDetailsOpen` overflow-menu design, since fully superseded — Design
Push #2 on 2026-08-06 moved graph assignment off the route entirely, and item 4A on 2026-08-19
removed the pencil/Save/Cancel gate for dates). Current state (2026-09-04):

- **Collapsed**: title + a prominent `"N TMCs · X.X mi"` line right under it, and a separate muted
  date-range line below that. No per-route graph-count is shown anywhere (tried 2026-08-07, removed
  again 2026-09-04 — Ryan's call; the underlying live self-bound-graph discovery still exists, feeding
  the `reports_snap_2` write-path instead, see Storage above).
- **One combined toggle** (an author only — a real viewer keeps a plain +/− expand for the read-only
  date span) both expands the row AND enters live editing — no separate "Edit name" pencil anymore.
  Toggling it in **replaces** the two collapsed summary lines with the editable name input + the
  Fixed/Derived date editor, in the same visual slot, rather than appending a panel below them.
- **Name and dates share one architecture**: each row owns its own local live buffer (no parent-owned
  single-flight edit slot for either field anymore) — dates auto-save debounced (since 2026-08-19,
  item 4A), name commits on blur/Enter with an inline uniqueness error (since 2026-09-04 — this also
  fixed `report-route-ui-parity-gaps.md` gap #7's old rename input-commit bug, by construction: the
  bug lived in the old parent-owned shared-slot buffer this replaced, not in this local-buffer
  design).
- **Remove** lives in exactly one place: the trash icon in the header row, next to the title —
  the old SECOND remove button at the bottom of the expanded panel was deleted 2026-09-04 (it
  duplicated the header one for no reason).
- **"Base for N routes"** stays a standing, always-visible one-liner inside the edit-mode body that
  expands into a pill list of dependent names.
- **Appearance** stays a color swatch + label; the real `ColorPicker` only mounts once clicked open
  (a `Popup`, unrelated to the expand/edit toggle).

See `npmrds-reports-routes-feedback-triage.md`'s Phase 2 (in `planning/transportny/tasks/current/`)
for the full plan this redesign was built from.

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
