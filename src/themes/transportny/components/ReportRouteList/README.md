# ReportRouteList

`ReportRouteList` is a custom **page section component** for the `transportny` theme. It renders a
side-panel UI for managing the **routes** (named groups of NPMRDS TMC segments + a date range) of a
**report**.

## The model: a report is a page

A "report" is no longer a separate data row. **A report is a page**, created from the `npmrds_sub`
pattern's **Report Page** template (a DB-backed page template — see
[Where the template lives](#where-the-template-lives) below). The page carries:

| Field          | Shape                                                            | Meaning |
|----------------|-------------------------------------------------------------------|---------|
| `routes` / `draft_routes` | `[{ route_comp_id, name, tmc_array, startDate, endDate, ... }]` | The report's routes — published / draft copy, same as `sections`/`draft_sections`. `route_comp_id` (`"comp-<n>"`) is a stable local id the component assigns on add. |

`ReportRouteList` reads/writes this attribute directly via the page's own `apiUpdate` — it is **not**
a `useDataWrapper` row edit. Graphs (or any other section) that want to visualize the report's routes
are added through the **normal Add Component flow** and bind to the panel via a page action param.
There is no `graph_comps` field, no injected sections, no `setItem` fork — see
[History](#history-what-this-replaced) if you're looking for the old model.

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

## The route catalog binding (the one thing the dataWrapper still does for this component)

`ReportRouteList` keeps a `join.sources.table1` config pointing at a **routes catalog** source (on
`npmrds_sub`, the "Routes Data" source) purely so it can look up addable routes:

- `routeSourceInfo = join?.sources?.table1?.sourceInfo` gives the route catalog's source/view.
- `fetchDynamicRoute()` builds a `buildUdaConfig` query against that source to resolve a route by id
  when the page's `add_route_id` action param fires (the "Add a Route" flow elsewhere on the page).

`state.data` (the dataWrapper's own row data) is **not** "the report" — it's unused. The report's
routes live on the page item (`item.routes` / `item.draft_routes`), read via `PageContext`.

## Editing routes

Add / remove / rename / re-date / reorder all mutate a local working copy of `routes` and persist with:

```js
apiUpdate({ data: { id: item.id, [routesKey]: nextRoutes }, config: { format } })
```

where `routesKey` is `'draft_routes'` when the page is open on `/edit/...`, `'routes'` in plain view.
This is a plain attribute write on the page row — the same shape every other page-level draft field
uses (`draft_dataSources`, `draft_section_groups`, …). Route edits made while editing therefore need
**Publish** to appear on the live page, same as every other draft field.

**Correction (2026-07-01):** this used to read `isEdit` off `ReportRouteList`'s own `props.isEdit`,
which is *not* "is the page on `/edit/...`" — it's `dataWrapper`'s per-section "is this section's own
settings editor currently open" flag, which is essentially never true for this panel in normal use
(an author clicks routes in the panel itself, never opens its settings editor to do so). That bug
meant `routesKey` silently always resolved to `'routes'` (live), regardless of page mode — the
`draft_routes` promotion machinery below was built but never actually exercised until this was found
and fixed. `routesKey`/`sectionsKey` now read `editPageMode` from `PageContext` (set only by
`edit/index.jsx`) instead. See `reportroutelist-page-templates.md`'s "Bug found post-implementation:
`isEdit` means the wrong thing" for the full story — this is the same bug that broke per-graph
routing in edit mode.

The "add route" flow is the one wrinkle: `add_route_id` (a page action param set elsewhere on the
page) triggers `fetchDynamicRoute()`, which stages the resolved route in `pendingRoute` and only
commits to `routes` when the user confirms.

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
theme `page_templates` entry, since it's specific to the `npmrds_sub` pattern's NPMRDS source.

## Gotchas for the next developer

- **`route_comp_id` is a join key only between routes and whatever a graph's variant labels resolve
  to** — it's a local id the component assigns (`comp-<n>`), not a DB id. (The old per-graph
  `route_comp_ids` bookkeeping is gone along with `graph_comps`; a normal section has no concept of
  "which routes it covers" beyond what its subscriber/variants resolve.)
- **`apiUpdate` here writes the page row**, not a report-row. There's no dataWrapper `updateItem` call
  for routes anymore — only `apiUpdate` straight from `PageContext`.
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
selected via a `report_id` page filter) carrying both `routes` and a `graph_comps` array of
section-shaped graph objects. Graphs were **injected into the live page** via a `setItem` escape
hatch added to `view.jsx`/`edit/index.jsx` specifically for this component — the only place in the
codebase that bypassed the normal add-component flow. That mechanism had a confirmed bug: any generic
section operation (e.g. reorder) would materialize the injected graphs into real, persisted component
rows, double-storing them and leaking `createdBy:'reports'` rows into the page's `draft_sections`
(seen live on page `2180280`, ids `2186931`/`2186932` — cleanup still pending as of this writing).
The current model (report = page, graphs = normal sections, dynamic binding via the
`comparison_series` subscriber) eliminates the injection path entirely; `setItem` was removed from
`PageContext`. Migrating any pre-existing `graph_comps`-based reports into report pages is a separate,
not-yet-scheduled task.
