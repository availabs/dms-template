# ReportRouteList

> **Status (2026-07-02): the routes-storage mechanism described below is implemented but NOT
> live-verified.** Round 3 (see the task doc's "Storage rework round 3") flagged the previous
> implementation's dataset binding as hardcoded (a repo-convention violation) and paused for a
> redesign; round 4 fixes the binding to be sectionMenu-configurable (see
> [Storage](#storage-two-sectionmenu-bindings-one-row-per-report) below) without changing the
> underlying one-row-per-report shape. Confirm live before relying on it.

`ReportRouteList` is a custom **page section component** for the `transportny` theme. It renders a
side-panel UI for managing the **routes** (named groups of NPMRDS TMC segments + a date range) of a
**report**.

## The model: a report is a page

A "report" is no longer a separate data row selected via a picker. **A report is a page**, created
from the `npmrds_sub` pattern's **Report Page** template (a DB-backed page template — see
[Where the template lives](#where-the-template-lives) below). The routes themselves live in **one
dedicated row of a dataset chosen via this section's own sectionMenu "Dataset" picker** (the Report
Page template pre-wires this to `reports_snap_2`), keyed 1:1 to the page (`report_id` = the page's own
id) — see [Storage: two sectionMenu bindings, one row per
report](#storage-two-sectionmenu-bindings-one-row-per-report) for why that's the right home for it and
what else was tried first.

Graphs (or any other section) that want to visualize the report's routes are added through the
**normal Add Component flow** and bind to the panel via a page action param. There is no `graph_comps`
field, no injected sections, no `setItem` fork — see [History](#history-what-this-replaced) if you're
looking for the old picker-based model.

## Where it lives / how it's registered

```
src/themes/transportny/components/ReportRouteList/
├── ReportRouteList.jsx        ← the component (this is where the logic lives)
├── ReportRouteList.theme.js   ← Tailwind class map (the `t` object)
├── index.jsx                  ← ComponentRegistry-style entry (name/type/EditComp/ViewComp/controls/defaultState)
└── README.md                  ← you are here
```

Registered as a theme page component (`theme.pageComponents.ReportRouteList`) in
`src/themes/transportny/theme.js` and `themev2.js`. Because it's a `useDataSource` / `useDataWrapper`
component (see `index.jsx`), it mounts inside the standard **dataWrapper** — but that binding is used
for exactly one thing now (see below), not for "the report row."

## The route catalog binding: the sectionMenu "Add Join Source" slot, deliberately incomplete

`ReportRouteList` reads its **routes catalog** binding (on `npmrds_sub`, the "Routes Data" source) from
`state.join.sources.<alias>.sourceInfo` — specifically `Object.values(join?.sources || {})[0]?.sourceInfo`
(the first, and only, join source; the code doesn't hardcode an alias name). This is deliberate, not a
historical accident (an earlier draft of this doc, and an earlier implementation round, used
`externalSource` for this — see [Storage](#storage-two-sectionmenu-bindings-one-row-per-report) for
why that changed):

- `useDataSource.js`'s `onJoinSourceChange` populates a join alias's `sourceInfo` (source_id, view_id,
  columns, baseUrl) the instant an author picks a source — independent of merge strategy or join
  columns being configured.
- `buildUdaConfig.js`'s `isJoinComplete()` requires non-empty `joinColumns` (for the default `"join"`
  merge strategy) before a join alias is ever sent to the query engine
  (`buildUdaConfig.js:1102-1107` filters incomplete aliases out entirely). `DEFAULT_SOURCE_JOIN` ships
  with `joinColumns: []`, so an author who picks a join source and stops there — never touches "Add
  join columns" — gets a **permanently incomplete, never-fired** join by default.

So an author uses the sectionMenu's "Add Join Source" UI to pick `routes_data` as a join source +
view, and never configures join columns. `ReportRouteList` then has full `sourceInfo` for that
dataset (to build its own independent catalog queries) with **zero risk of an actual SQL join ever
firing** — `fetchDynamicRoute()` builds a `buildUdaConfig` query against this `sourceInfo` to resolve
a route by id when the page's `add_route_id` action param fires (the "Add a Route" flow elsewhere on
the page).

`state.data` (the dataWrapper's own row data) is **not** "the report" — it's unused. The report's
routes are loaded/persisted directly by `ReportRouteList` itself via `apiLoad`/`apiUpdate` against
`state.externalSource` (see below) — a separate, self-contained data access path that doesn't go
through `state.data` at all.

## Storage: two sectionMenu bindings, one row per report

This went through several designs before landing on the current one — all worth knowing about because
the failure modes generalize beyond this component.

**Attempt 1 — a bespoke page attribute.** Routes lived on `routes`/`draft_routes`, added directly to
`page.format.js` and promoted in `editFunctions.jsx`'s `publish()`/`discardChanges()`. This is exactly
the kind of one-off, non-generalizable property DMS-core is supposed to stay free of — a concept only
this one theme component needed, baked into a shared library file. Removed.

**Attempt 2 — this section's own `element-data`.** Since a page section is itself an ordinary,
already-generic entity with its own draft/publish semantics, storing `routes` inside
`element['element-data']` (alongside `join`/`externalSource`/`comparisonSeries`, the same JSON blob
every `dataWrapper` component already persists its own settings in) looked like the right move: no
new page attribute, no new promotion logic, just one more key in a blob that already exists. **This
looked schema-free but wasn't.** `dataWrapper`'s own settings-editor save effect
(`components/dataWrapper/index.jsx`'s `Edit`, the "Save effect" `useEffect`) rebuilds `element-data`
from a **hardcoded allowlist** of known v2 fields (`externalSource, columns, filters, display, data,
join`, plus `dataSourceId`/`pivot`/`comparisonSeries` if present) every time it fires — and it can fire
from state changes unrelated to routes (e.g. this component's own `routesViewId`-resolution effect).
`routes` isn't in that allowlist, so any time the save effect fired, it silently stripped routes back
out moments after they were correctly written — routes would "flash and disappear." `schema.js`'s own
docstring already flagged this exact failure mode once before, for `join`. Reverted.

**Attempt 3 — a dedicated row in `reports_snap_2`, bound via a hardcoded constant.** A genuine DMS
`:data` row is the *only* truly schema-free persistence layer in this system: split-table rows are
documented as flexible/auto-created, with no declared-attribute allowlist on either the client
(unlike `element-data`) or the page/component row schema (unlike attempt 1). This part was correct and
is still true today (see attempt 4). What wasn't right: a `REPORTS_SOURCE` constant in
`ReportRouteList.jsx` hardcoded the dataset's `app`/`source_id`/`view_id`/`columns` in code. Flagged as
a repo-convention violation — dataset choice is an author/sectionMenu decision (see root `CLAUDE.md`'s
"author empowerment" principle), not something baked into component code. `ReportRouteList` also had
no clean second sectionMenu slot at the time to give the route-catalog binding an author-configurable
home either (a `useDataWrapper` component only gets one `externalSource` slot) — see attempt 4 for how
that got resolved.

**Attempt 4 (current) — the same `reports_snap_2`-shaped row, both bindings now sectionMenu-configurable.**
The one-row-per-report shape from attempt 3 is unchanged (still found/created by `report_id = <page
id>`, still a `routes` JSON-array column, still `report_id` a straight 1:1 mapping, not the old
multi-report `report_id` **picker**). What changed is *where the component gets its dataset pointers
from*:
- **Storage** now reads `state.externalSource` — this section's normal sectionMenu "Dataset" pick.
  The Report Page template pre-wires it to `reports_snap_2`, but nothing in `ReportRouteList.jsx`
  hardcodes that source/view id anymore.
- **Route catalog** now reads `state.join.sources.<alias>.sourceInfo` (see above) instead of
  `externalSource` — freeing up `externalSource` for storage. This "incomplete join as a second
  read-only source pointer" is what makes both bindings sectionMenu-configurable at once, without any
  DMS-core change (a real second non-join source slot was considered and rejected as unnecessary once
  this was found).

```js
// loadReportRow (ReportRouteList.jsx) — same buildUdaConfig/apiLoad pattern fetchDynamicRoute
// uses for the route catalog, just against `externalSource` and filtered by this page's own report_id
apiLoad({ format: externalSource, children: [{ action: "uda", ... filter: report_id = item.id ... }] }, "/")

// persistRoutes — create (no id) or update (existing id) the one row
apiUpdate({ data: { id?, report_id: String(item.id), routes: JSON.stringify(nextRoutes) },
            config: { format: storageDataFormat } })  // storageDataFormat derives its `type` from externalSource
```

This needed **zero DMS-core changes** — `apiLoad`/`apiUpdate` against an arbitrary dataset row are
already fully generic, exactly the mechanism Card/Spreadsheet already use for their own editable data.

**Not yet live-verified.** The next session should confirm live: adding/removing/reordering/toggling
routes on a report page persists correctly and doesn't disappear (across a reload, not just
in-session), for both a brand-new report page (no row yet, exercises the create path) and an existing
one — and confirm no actual SQL join fires for the catalog binding (network tab / server logs on the
`fetchDynamicRoute` request).

The "add route" flow is the one wrinkle: `add_route_id` (a page action param set elsewhere on the
page) triggers `fetchDynamicRoute()`, which stages the resolved route in `pendingRoute` and only
commits to `routes` (via `persistRoutes`) when the user confirms.

## Publishing routes to graphs — per-graph, via a self-resolving key (2026-07-01)

Each graph on the page gets **its own** route list — a route is added to a graph one click at a
time, exactly like the pre-refactor UX, but without reintroducing `graph_comps`/`setItem`. The
mechanism (see `reportroutelist-page-templates.md`'s "Per-graph routes" section for the full design
history):

- A graph's `comparison_series` subscriber carries the reserved sentinel `paramKey: '$self'`
  (`SELF_PARAM_KEY_SENTINEL`, `buildUdaConfig.js`) instead of an author-typed literal. At read time,
  `usePageFilterSync` resolves `'$self'` to a key derived from **that graph's own section id**
  (`selfParamKey(sectionId)` → `` `__self__${sectionId}` ``) — every graph is automatically,
  uniquely addressable the moment it's added from the template, with no author configuration step.
  `sectionId` reaches a `dataWrapper` component via `ComponentContext` (threaded from `section.jsx`
  through `components/index.jsx`).
- `ReportRouteList` never writes into a graph's row (that cross-section-write path was considered and
  rejected — see the design doc; it's the same class of coupling that caused the original
  `graph_comps` leak). It only **reads** sibling sections (`item.draft_sections`/`item.sections` —
  confirmed to arrive already fully resolved on the client, not `{id,ref}` stubs) to discover which
  ones carry an enabled `'$self'`-bound subscriber (`findSelfBoundGraphs`), and labels them ordinally
  ("Graph 1", "Graph 2", ...) for the UI.
- Each route carries a hidden `graphIds: string[]` field (section ids it's been clicked onto) — never
  surfaced as an abstract "group"; the UI is a small chip row per route ("On: Graph 1  Graph 2") that
  toggles membership on click. A route feeds no graph until explicitly assigned (no implicit sharing).
- The publish effect loops over discovered graphs, publishing each one's filtered route subset to its
  own `selfParamKey` via `setActionParam` (same `isEqual`-per-key guard as the original single-key
  version needed — see the infinite-render bug in the task doc). A second effect prunes dangling
  `graphIds` entries when a section is actually removed from the page (not merely disabled).

`transformReportRoutes` (unchanged) still turns each route into a **Comparison Series variant**
(`{ label, filters }`) exactly as before; only the *targeting* — which graph(s) get which subset — is
new. **Hand-typed literal `paramKey`s (the old shared model) still work** — `'$self'` is additive, not
a replacement of the general subscriber/pub-sub mechanism; a graph can still be pointed at any
author-chosen shared key if that's what's wanted.

A graph that instead wants a **frozen snapshot** (not affected by later route edits) can carry a baked
`comparisonSeries.variants` (e.g. `transformReportRoutes(routes)` captured once) instead of any
subscriber. `buildUdaConfig` prefers `config` (dynamic) when present, falls back to `variants`
(static) — both binding modes coexist with no special-casing.

## Where the template lives

The **Report Page** template — the ReportRouteList panel + one starter "AVL Graph" pre-wired with a
`comparison_series` subscriber whose `paramKey` is the `'$self'` sentinel (see above) — is a
**DB-backed page template**
(`npmrds_sub|page_template` row, "Report Page"), not code. Authors create a new report via the page
editor's **+ Add Page → Your Templates → Report Page**. See `page-templates.md` for how page
templates work generally; this one was built and verified through the DMS CLI (real captured
`comparisonSeries`/`_functions.subscribers` element-data, not hand-authored) rather than shipped as a
theme `page_templates` entry, since it's specific to the `npmrds_sub` pattern's NPMRDS source. The
template also pre-wires **both** of the panel's dataset bindings (`externalSource` → `reports_snap_2`
storage, `join.sources.table1` → the `routes_data` catalog, join columns deliberately left empty) so
an author creating a new report never has to configure either manually.

## Gotchas for the next developer

- **`route_comp_id` is a join key only between routes and whatever a graph's variant labels resolve
  to** — it's a local id the component assigns (`comp-<n>`), not a DB id. (The old per-graph
  `route_comp_ids` bookkeeping is gone along with `graph_comps`; a normal section has no concept of
  "which routes it covers" beyond what its subscriber/variants resolve.)
- **`apiUpdate`/`apiLoad` here target the storage dataset's row directly** (via a format derived from
  `state.externalSource`), not the page row and not this section's own `element-data`. There's no
  dataWrapper `updateItem`/`addItem` call for routes — those are coupled to `state.columns`/
  `externalSource.isDms` in ways that would need extra settings-editor configuration; `ReportRouteList`
  manages this load/save entirely itself, the same way `fetchDynamicRoute` manages the route-catalog
  query itself (against `state.join.sources.*.sourceInfo`, not `externalSource` — see
  [Storage](#storage-two-sectionmenu-bindings-one-row-per-report) for why the two are split this way).
- **This component reads `falcor` directly** (`getSources`/`getViews`) — a pattern the DMS guidelines
  discourage outside the `api/` layer. It predates / sidesteps that rule; flag it if you refactor, but
  it's out of scope here.
- **A page's `draft_sections` and `sections` are separately materialized row sets, not the same rows
  at different lifecycle stages.** Discovered live-verifying the per-graph mechanism: patching a
  page's *draft* AVL Graph row to `'$self'` did nothing for the *published* view, because publishing
  had already cloned the graph into a different row with its own id. Migrating an existing graph off
  a literal `paramKey` means patching both copies if the page has been published at all.

## History: what this replaced

Earlier versions of this component modeled a report as a **separate data row** (`reports_snap_2`,
selected via a `report_id` page filter acting as a **picker** across many report rows) carrying both
`routes` and a `graph_comps` array of section-shaped graph objects. Graphs were **injected into the
live page** via a `setItem` escape hatch added to `view.jsx`/`edit/index.jsx` specifically for this
component — the only place in the codebase that bypassed the normal add-component flow. That
mechanism had a confirmed bug: any generic section operation (e.g. reorder) would materialize the
injected graphs into real, persisted component rows, double-storing them and leaking
`createdBy:'reports'` rows into the page's `draft_sections` (seen live on page `2180280`, ids
`2186931`/`2186932` — cleanup still pending as of this writing). The current model (report = page,
graphs = normal sections, dynamic binding via the `comparison_series` subscriber) eliminates the
injection path entirely; `setItem` was removed from `PageContext`.

`reports_snap_2` itself came back (see [Storage](#storage-two-sectionmenu-bindings-one-row-per-report)
above) — but as a **1:1-per-page row**, not a picker, and without `graph_comps`. Migrating any
pre-existing `graph_comps`-based reports (page `2180280`'s old multi-report rows) into report pages is
a separate, not-yet-scheduled task.
