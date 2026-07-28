# RouteComparison

`RouteComparison` is a custom **page section component** for the `transportny` (v2) theme. It
renders the **left builder rail** of the *Route Comparison* page — the DMS replacement for the
legacy npmrds *Batch Reports* tool. The rail is a control/filter surface (**Scope · Routes ·
Periods · Metrics**) that drives a **sibling native pivoted Spreadsheet** (routes = rows, periods
= column groups, metrics = leaves). The Spreadsheet is a separate section and is **not** this
component's concern — this component only *publishes selection state* the Spreadsheet consumes.

See the mockup
`TransportNY Design System/dms_design_system_v2/pages/route-comparison.html` (left rail) and the
task doc `planning/transportny/tasks/current/build-route-comparison-page.md` (Task 3).

## Where it lives

```
src/themes/transportny/components/RouteComparison/
├── RouteComparison.jsx        ← the component (exports RouteComparisonEdit + RouteComparisonView only)
├── RouteComparison.theme.js   ← Tailwind class map (the `t` object)
├── parseTmcArray.js           ← pure helpers (tmc_array parser, TMC flatten/dedupe, dow vocab)
├── index.jsx                  ← ComponentRegistry entry (name/type/EditComp/ViewComp/controls/defaultState)
└── README.md                  ← you are here
```

Registered as a theme page component (`theme.pageComponents.RouteComparison`) in
`src/themes/transportny/themev2.js`, right next to `ReportRouteList`. It's a
`useDataSource`/`useDataWrapper` component, so it mounts inside the standard **dataWrapper** — but
`state.data` (the dataWrapper's own row binding) is unused; the component reads the route catalog
itself and publishes selection over page state.

### File split (Vite Fast Refresh)

Per the `@availabs/dms` Fast-Refresh rules (`src/dms/packages/dms/CLAUDE.md`): the `.jsx` exports
**only** React components (`RouteComparisonEdit`, `RouteComparisonView`, both delegating to an
internal `RouteComparisonPanel`); the Tailwind class map lives in `RouteComparison.theme.js`; all
pure helpers live in `parseTmcArray.js`; the registry metadata/`defaultState` lives in `index.jsx`.
No inline Tailwind in the component body — every class is a `t.*` theme key.

## What it publishes (the contract the sibling Spreadsheet consumes)

On selection change, gated on `PageContext.editPageMode` being **false** (view/interact mode — the
control must never navigate while the page is being *edited*) and guarded with lodash `isEqual`
(so the write → pageState reload → re-render cycle settles instead of looping):

- **`updatePageStateFilters([{ searchKey:'routes', values:<route_id string[]> }, { searchKey:'route_tmcs', values:<flattened, de-duped TMC string[]> }])`.**
  BOTH keys are **URL-synced page variables** (registered by the page build in `page.data.filters`
  with `useSearchParams:true`) so a shared URL reproduces the whole view. `route_tmcs` is the
  flattened, order-stable de-dupe of every selected route's `tmc_array` — it is what prunes the
  ~9.8B-row ClickHouse speed scan, so it **must** ride alongside `routes`.
- **`setActionParam('rc_scope', { todStart, todEnd, dow:<int[]>, vehicleClass })`** from the Scope
  block. Transient (not URL-synced). `dow` is JS `getDay()` order (`0`=Sun … `6`=Sat) — the same
  convention `ReportRouteList`'s date enumerator uses. `setActionParam` wraps a non-array value as
  `[value]`, so the scope object is stored at `.values[0]`; the isEqual guard reads it back the
  same way (comparing the array against the object would never match → infinite loop).

### Deferred (clearly-marked `// TODO` stubs — UI shells only, not yet publishing)

- **Periods** (`rc_periods`) — Task 3.4. The builder (Fixed / Each-route's-own / Relative-to-Base
  modes, BASE badge, and a `resolvePeriods()` util) is not built yet; the block is a shell.
- **Metrics** (`rc_metrics`) — Task 3.5. The checkboxes + per-metric "Δ vs Base" toggle + delay
  overrides are interactive **locally** but do not publish yet.
- **Saved comparisons** — Task 3.6. `externalSource` is pre-wired for a report-row dataset (keyed
  by page id, ReportRouteList `reports_snap_2` style) but no `apiLoad`/`apiUpdate` persistence is
  wired. Respect the dataWrapper `toSave` allowlist when adding element-data keys (see Gotchas).

## The route catalog binding

The catalog (which routes are selectable) is read from **`state.join.sources.<alias>.sourceInfo`**
— the sectionMenu's **"Add Join Source"** slot, deliberately left *incomplete* (source + view
picked, **no join columns**). `buildUdaConfig.js`'s `isJoinComplete()` requires non-empty
`joinColumns` before an alias is sent to the query engine, so this is a real, author-configurable
source pointer that **never fires a SQL join** — exactly the `ReportRouteList` idiom. The component
reads the *first* join source (`Object.values(join.sources)[0].sourceInfo`) rather than hardcoding
an alias.

`index.jsx`'s `defaultState.join.sources` pre-shapes an alias named **`route_catalog`** with
`source:"2107426"` / `view:"2107427"` (Routes Data, npmrds2) as a hint. The **page build (Task 4)
must fully populate `sourceInfo`** (columns, srcEnv, baseUrl, type, isDms) by binding the source
through the sectionMenu flow (`onJoinSourceChange`) — the ids alone are not enough; until
`sourceInfo.columns` is present the picker is disabled ("Bind a route catalog to enable the
picker.").

Reads mirror `ReportRouteList.fetchDynamicRoute`: a `buildUdaConfig` against `sourceInfo` wrapped
in a `{ format, children:[{ action:'uda', path:'/', filter:{ fromIndex, toIndex, options } }] }`
config, run through `apiLoad`; each returned row is unwrapped from the DMS envelope at
`row.data.value`. Two reads happen:

- **Search** — debounced (250ms), server-side `data->>'name' LIKE %term%`, min 2 chars, capped to
  `SEARCH_LIMIT` (50) rows. The catalog is ~30k+ rows so the picker never loads the whole table.
- **Hydrate-from-URL** — once, on mount: if the URL carries `routes`, fetch those rows
  (`data->>'route_id' IN (...)`) to restore the selected chips in URL order. Gated so it runs only
  after the catalog source resolves; a `ready` flag then unblocks the publish effect so it can
  never clobber the URL's `routes` with an empty publish before hydration completes.

`tmc_array` is parsed by `parseTmcArray()` (see `parseTmcArray.js`), which tolerates a JS array, a
JSON string (`["120-05445",…]`), a Postgres array literal (`{120-05445,…}`), or a bare
comma-separated string — degrading to `[]` rather than throwing, so one malformed row never blanks
`route_tmcs`.

## Edit-mode gating

Publishing (both `updatePageStateFilters` — which **navigates** — and `setActionParam`) is gated on
`PageContext`'s **`editPageMode` being false**. This is the *inverse* of `ReportRouteList`'s storage
gate: `RouteComparison` is an interactive **view-mode** tool, so it publishes while a user is
building a comparison and stays quiet while an author is arranging the page layout (where a
navigation would be disruptive). Note `props.isEdit` (dataWrapper's own "this section's settings
editor is open" flag) is **not** the same thing — use `editPageMode`.

## Gotchas for the next developer

- **`props.isEdit` ≠ "the page is in edit mode."** Use `PageContext.editPageMode` (this file's
  `isEdit`), like `ReportRouteList`.
- **The `route_tmcs` publish is load-bearing, not optional.** Publishing `routes` alone leaves the
  Spreadsheet to scan the full speed table. Always publish both together.
- **isEqual guards are per-key and load-bearing.** `updatePageStateFilters` navigates and
  `setActionParam` rewrites pageState; both re-render this component. Without the guards the
  write→re-render cycle never settles.
- **`route_tmcs` order must be stable.** `collectRouteTmcs` de-dupes in first-seen order so the
  isEqual guard doesn't churn on set re-ordering.
- **The publish effect must not out-run hydration.** The `ready` flag exists precisely so a shared
  URL's `routes` isn't wiped by the initial empty selection before the hydrate pass restores it.
- **dataWrapper's `toSave` allowlist** rebuilds `element-data` from a fixed field list — any new
  per-section state key added for saved-comparison storage (Task 3.6) must be added there or it's
  silently stripped (this bit `ReportRouteList` twice — see its README).
- **Publishing needs the page variables registered.** `routes`/`route_tmcs` must exist in
  `page.data.filters` (`useSearchParams:true`) or `updatePageStateFilters` silently no-ops for
  them. The page build (Task 4 Step 1) registers them.
