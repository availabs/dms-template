# ReportRouteList

> **Status: living document / actively-changing feature.** This describes the component as it
> exists today, including known rough edges and at least one unresolved architectural question
> (see [Open problem: persisting edits to injected graphs](#open-problem-persisting-edits-to-injected-graphs)).
> Update this file as the feature evolves.

## What it is

`ReportRouteList` is a custom **page section component** for the `transportny` theme. It renders a
side-panel UI for managing a single **report** — a report being a data row that holds a list of
**routes** (named groups of NPMRDS TMC segments + a date range) and a list of **graphs** that
visualize those routes.

It is intentionally *not* a generic DMS section. It does several things that no other section does,
and it deliberately steps outside the normal DMS add-component flow. Those deviations are the most
important thing to understand before working on it, so they get their own section below.

## Where it lives / how it's registered

```
src/themes/transportny/components/ReportRouteList/
├── ReportRouteList.jsx        ← the component (this is where the logic lives)
├── ReportRouteList.theme.js   ← Tailwind class map (the `t` object)
├── index.jsx                  ← ComponentRegistry-style entry (name/type/EditComp/ViewComp/controls/defaultState)
└── README.md                  ← you are here
```

It is registered into the theme as a page component:

- `src/themes/transportny/theme.js` → `theme.pageComponents.ReportRouteList`
- `src/themes/transportny/themev2.js` → likewise

Because it's a `useDataSource` / `useDataWrapper` component (see `index.jsx`), it is mounted inside
the standard **dataWrapper** (`src/dms/.../sections/components/dataWrapper/index.jsx`). The
dataWrapper is what gives it `state`/`setState` via `ComponentContext`, and the
`updateItem` / `addItem` / `removeItem` CRUD helpers. Note the dataWrapper explicitly
allow-lists this component by name for those CRUD props:

```js
// dataWrapper/index.jsx
['Spreadsheet', 'Card', 'ReportRouteList'].includes(component.name) ? { updateItem, ... } : {}
```

So `ReportRouteList` is a member of a small club (with `Spreadsheet` and `Card`) of sections that
edit their backing data row directly.

## Data model

The component operates on **one report row at a time**. The report is the single row the dataWrapper
loaded into `state.data[0]`:

```js
const currentReport = state?.data?.[0];
```

Relevant fields on the report row:

| Field          | Shape                                                                 | Meaning |
|----------------|-----------------------------------------------------------------------|---------|
| `routes`       | `[{ route_comp_id, name, tmc_array, startDate, endDate, ... }]`        | The routes in this report. `route_comp_id` (`"comp-<n>"`) is a stable local id the component assigns on add. |
| `graph_comps`  | `[{ id, trackingId, createdBy:'reports', element, comparisonSeries, route_comp_ids, ...layout }]` | The graphs in this report. Each entry is a **section-shaped object** (see below). |

### Which report is "current"

The current report is selected by a URL parameter surfaced through `pageState.filters`:

```js
const reportId = pageState?.filters?.find(f => f.searchKey === 'report_id')?.values?.[0];
```

If `reportId` is missing or `-1`, the component renders a "Select a report to get started" empty
state. A second action-type filter, `add_route_id`, drives the "add a route" flow.

## The two flows

### 1. Routes (relatively normal)

Adding / removing / renaming / re-dating / reordering routes all mutate `currentReport.routes` and
persist via the dataWrapper's `updateItem`:

```js
updateItem(updatedRoutes, { name: 'routes' }, currentReport);
```

`updateItem(value, { name }, row)` writes a single named attribute (`routes`) back onto the report
data row through `apiUpdate`, and also patches the dataWrapper's local `state.data`. This is the
**normal, well-behaved** persistence path — the data the component edits *is* the row the dataWrapper
owns, so writing to it is exactly what `updateItem` is for.

The "add route" flow is the one wrinkle: `add_route_id` (a page action param) triggers
`fetchDynamicRoute()`, which builds a UDA config via `buildUdaConfig` and `apiLoad`s the route's
detail, stages it in `pendingRoute`, and only commits to `routes` when the user confirms.

### 2. Graphs (the unusual flow)

This is where the component deliberately departs from how DMS normally adds components to a page.
**Four differences, all intentional:**

| # | Normal DMS add-component flow | ReportRouteList graph flow |
|---|-------------------------------|----------------------------|
| 1 | Happens in **edit** mode | Happens in **view** mode |
| 2 | Starts from a **blank** component | Initializes from a **template** row in the DB (`npmrdsv5` / `npmrds_sub\|avl_graph_template`) |
| 3 | Saved into its **own** `data_item` row | Saved into the **`graph_comps` field of the current report row** |
| 4 | New row → `item` prop changes upstream → re-render | Bypassed: graphs are injected into `item` via `setItem` (local state) |

#### Adding a graph (`addGraph`)

1. The user picks a **graph template** from the `Select`. Templates are loaded by `loadTemplates()`
   from `app: "npmrdsv5", type: "npmrds_sub|avl_graph_template"`.
2. `addGraph` parses the template's `stateJson` / `layoutJson`, injects a `__series` column and a
   `comparisonSeries` config (so the graph draws one series per route), records which routes belong
   to the graph in `route_comp_ids`, and assembles a **section-shaped** object:
   ```js
   {
     id, trackingId,
     createdBy: 'reports',                       // ← the tag that marks report-owned graphs
     element: { 'element-type': elementType, 'element-data': JSON.stringify(parsedState) },
     comparisonSeries, route_comp_ids,
     ...layout
   }
   ```
3. It appends that object to `currentReport.graph_comps` and persists with
   `updateItem(updatedGraphComps, { name: 'graph_comps' }, currentReport)`.

#### Rendering graphs onto the page (`setItem` injection)

A `useEffect` projects `graph_comps` into the live page item so the graphs actually appear:

```js
// "Sync graph_comps to page item -- RENDERS GRAPHS TO PAGE"
setItem(draft => {
  draft.sections        = draft.sections.filter(c => c.createdBy !== 'reports');
  draft.draft_sections  = draft.draft_sections.filter(c => c.createdBy !== 'reports');
  const injected = currentReport.graph_comps.map(comp => ({ ...comp, config: { ...comparisonSeries, routes } }));
  draft.sections.push(...injected);
  draft.draft_sections.push(...injected);
});
```

`setItem` here is `setNewItem`. To expose it, the page was changed to keep a **local immer fork** of
`item` in *both* render paths — `view.jsx` and `edit/index.jsx` each now do
`const [newItem, setNewItem] = useImmer({...item})`, switch every `getSectionGroups` read to
`newItem`, and put `{ item: newItem, setItem: setNewItem }` on the `PageContext`. **This is the only
place in the codebase that injects sections into `item` directly rather than going through the
add-component flow, and the fork is a far-reaching change to shared page rendering made for this one
component.** The injected sections are tagged `createdBy: 'reports'` so this effect can find and
replace them idempotently.

Two sharp edges live in that fork:

- **The resync effect's immer recipe.** As committed (`84cf0ee2`) it is
  `setNewItem(draft => { draft = ({...draft, ...item}) })`. Reassigning the `draft` *parameter*
  (rather than mutating it) with no `return` is a **no-op** in immer — so `newItem` is seeded once at
  mount and never resyncs from upstream `item`. Adding `return ({...draft, ...item})` (or mutating:
  `Object.assign(draft, item)`) makes it actually resync. Note that *fixing* it cuts the other way:
  a working resync shallow-merges `item` over `newItem`, dropping the injected graphs — which is why
  the injection effect has to keep re-adding them. The mechanism fights itself.
- **The leak (confirmed — see below).** Injected sections are not inert. Any generic section
  operation snapshots the rendered list and persists it, sweeping the graphs into the page.

> #### ⚠️ Confirmed bug: injected graphs leak into the page's section store
>
> The page stores `sections`/`draft_sections` as **references** to separate `npmrds_sub|component`
> rows (`{ id, ref }`), not as inline section objects; the manager resolves the refs into full
> objects on `item`. When a user runs any generic section op — e.g. reorder — `moveItem`
> (`sectionArray.jsx`) does `cloneDeep(value)` over the rendered `sectionSource` (which **includes**
> the injected graphs), and `updateSections` (`sectionGroup.jsx`) persists
> `draft_sections: update.filter(d => d)` via `apiUpdate`. That filter only drops *falsy* entries —
> **not** `createdBy` — so the injected graphs get **materialized into real component rows and
> referenced by the page's `draft_sections`**.
>
> Verified live on page `2180280`: a reorder left two `createdBy:'reports'` graph rows
> (`2186882` "Comparison Series", `2186883` "Tmc Speed Grid") referenced by `draft_sections`. Each
> graph is now **double-stored** — once in the report's `graph_comps` (intended) and once as a page
> component row (leaked). Consequences: a publish would push them into the live `sections` for
> everyone; `graph_comps` and the orphaned rows drift independently; on-screen duplicates are masked
> only by the `createdBy !== 'reports'` filter in the injection effect; rows accumulate per reorder.
>
> Root cause is **injecting into the shared `item.sections` array at all** — see
> [Open problem](#open-problem-persisting-edits-to-injected-graphs).

#### Keeping graphs in sync with routes

Another `useEffect` (commented *"UPDATES THE PERSISTED DB DATA WITHIN CURRENT ROUTE"*) recomputes
each graph's `comparisonSeries.variants` from the current `routes` (via `transformReportRoutes`)
whenever routes change, and writes the updated `graph_comps` back with `updateItem`. This is what
makes a graph's series follow edits to the routes it's associated with. `route_comp_ids` on each
graph is the join key between a graph and the routes it draws.

### `transformReportRoutes`

Pure helper that turns `routes` into the graph's `comparisonSeries.variants`: it parses each route's
`tmc_array`, expands `startDate`/`endDate` into a `date` array (and, when times are present, an
`epoch` array at 5-minute resolution), and emits `{ label, filters: { op:'AND', groups:[...] } }`
per route. The matching graph-side contract is the **Comparison Series** binding in
`graph_new/config.jsx` (one chart series per variant).

## Mental model in one paragraph

`graph_comps` on the report row is the **source of truth** for the report's graphs. The component
*projects* that array into the live page (`item.sections`) via `setItem` so the graphs render in
view mode, and it *derives* each graph's per-route series from `routes` on the same report. Every
mutation the side panel exposes (add/remove/rename/reorder graph, add/remove route association)
writes back to `graph_comps` (or `routes`) through the dataWrapper's `updateItem`. The projection is
*meant* to be disposable and the report row durable — but in practice the projection leaks into the
page's persisted section store (see the open problem below).

## Open problem: the injection mechanism (rendering) and where edits persist

There are really **two coupled problems** here, and the `setItem` projection conflates them:

### 1. Rendering — a present, confirmed bug (not forward-looking)

Graphs are put on the page by injecting them into the shared `item.sections` array. Because that
array is the same one the generic section machinery reorders/saves/publishes — and the page stores
sections as **refs to component rows** — any generic section op materializes the injected graphs
into real page component rows. This is **happening now** (verified: page `2180280` has
`createdBy:'reports'` graph rows `2186882`/`2186883` in its `draft_sections`). Full mechanism and
evidence in
[⚠️ Confirmed bug: injected graphs leak into the page's section store](#️-confirmed-bug-injected-graphs-leak-into-the-page-section-store).

The structural fix is to **stop injecting into `item.sections`** and render graphs from `graph_comps`
some other way. Two candidates:

- **Report renders its own graphs.** Map over `graph_comps` and render each through the section
  renderer directly (the commented modal block in `sectionGroup.jsx` shows the
  `<SectionArrayComp value={...} />` entry point). No page-item mutation; lets you **delete the
  `newItem`/`setItem` fork** from `view.jsx` and `edit/index.jsx` entirely.
- **Functional merge in `view.jsx`.** Keep `item` canonical and compute the merged section list at
  render time from `item` + a context value the report publishes. Contained, no fork, no stale copy.

### 2. Persistence — where in-place graph edits should go (still forward-looking)

In-place graph editing is **not built yet**. A normal DMS section persists edits by saving its **own
component row**; report graphs are supposed to live in the report's `graph_comps`. Candidate models:

- **Read-only on the page; edit only via the side panel** → panel writes `graph_comps`. Lowest risk;
  dissolves the problem by not introducing in-place editing.
- **A general "section owns its persistence" hook** in DMS core (host-supplied save sink, not a
  `createdBy:'reports'` special-case) → enables in-place editing that writes `graph_comps`.
- **`graph_refs` as component rows.** Now that we know the page already stores sections as refs to
  component rows, the report row could hold `graph_refs` (ids) the same way, and editing would use
  the entirely normal component-row path. This is **closer to the existing grain than it first
  appeared** — at the cost of report portability (copying a report means copying N rows + rewriting
  refs).

Resolve #1 first (it's an active bug); #1's choice strongly shapes which #2 model is cleanest.

## Gotchas for the next developer

- **`createdBy: 'reports'` is load-bearing.** It's how injected sections are identified, replaced,
  and (would be) routed for persistence. Don't drop it when constructing or copying a graph.
- **`route_comp_id` / `route_comp_ids` are the join keys** between routes and graphs. They are
  local ids the component assigns (`comp-<n>`), not DB ids.
- **`element-data` is double-stored.** Graph config lives both as a parsed object on the graph entry
  (`comparisonSeries`, `route_comp_ids`) *and* serialized inside `element['element-data']`. Several
  handlers update both to keep them in sync — keep that invariant if you add fields.
- **`updateItem` only works because the report is the dataWrapper's row.** It writes to
  `state.data` and `apiUpdate`s the report row. It is *not* a general-purpose page save.
- **The page stores sections as refs (`{id, ref}`) to separate `npmrds_sub|component` rows**, not
  inline objects. The manager resolves refs into full objects on `item`. This is why anything you
  inject into `item.sections` that gets saved becomes a *new component row*.
- **Injected sections are NOT actually disposable today.** They're meant to be a disposable
  projection of `graph_comps`, but they leak into the page's persisted `draft_sections` (see the
  confirmed bug above). Treat `graph_comps` as the source of truth, and be aware leaked graph rows
  may exist on pages that have been reordered/edited — they need cleanup once the injection
  mechanism is fixed.
- This component reads `falcor` directly (`getSources`/`getViews`) — a pattern the DMS guidelines
  discourage outside the `api/` layer. It predates / sidesteps that rule; flag it if you refactor.
```
