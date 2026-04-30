# data-types/

App-owned DMS dataType plugins for `dms-template`. Each subdirectory is one
plugin; each plugin contributes a server side (worker + Express routes
mounted into `dms-server`) and, optionally, a client side (page components
plugged into the DMS `datasets` pattern).

## Layout

```
data-types/
├── package.json                    # {"type": "commonjs"} — overrides root ESM
├── register-datatypes.js           # bootstrap entry (loaded via DMS_EXTRA_DATATYPES)
├── _example-hello-world/           # skeleton; underscore-prefixed = NOT registered
├── map21/                          # FHWA HPMS Travel Time Metric
│   ├── index.js                    # server: routes + workers map
│   ├── worker.js                   # server: long-running publish worker
│   ├── helpers.js, calc*.js, ...   # server: SQL/calculation helpers
│   ├── enums/, static/             # server: lookup tables
│   └── pages/                      # client: React pages plugged into datasets pattern
│       ├── index.jsx               # exports { sourceCreate: { name, component } }
│       └── create.jsx              # Create page
├── mny/
│   └── enhance_nfip_claims_v2/     # FEMA NFIP claims enhancement
│       ├── index.js                # server
│       └── pages/                  # client (same shape as map21/pages)
│           ├── index.jsx
│           └── create.jsx
└── now_playing/                    # ACRCloud webhook receiver (server only)
    ├── index.js, routes.js, schema.js, normalize.js
    └── README.md
```

## Server side

### Bootstrap

`register-datatypes.js` is the single entry point read by `dms-server` at
boot via the `DMS_EXTRA_DATATYPES` env var. The Dockerfile sets it to
`/app/data-types/register-datatypes.js`. It exports a function that
receives `{ registerDatatype }` from the server and adds one entry per
plugin:

```js
module.exports = function registerExtra({ registerDatatype }) {
  registerDatatype('map21', require('./map21'));
  registerDatatype('now_playing', require('./now_playing'));
  registerDatatype('enhance_nfip_claims_v2', require('./mny/enhance_nfip_claims_v2'));
};
```

Plugin names should use underscores (`now_playing`, `enhance_nfip_claims_v2`)
per the project naming convention — they become both the URL prefix and the
DAMA source `type`.

### CommonJS subtree

The repo root is `"type": "module"`, so the `data-types/package.json` shim
declares `"type": "commonjs"` to keep this whole subtree CJS. `dms-server`
loads it via `require()`, so all server `.js` files must use `require` /
`module.exports`. Client `.jsx` files are bundled by Vite and use ESM
syntax — the `type` field doesn't affect them.

### Plugin shape

Each plugin's `index.js` exports an object with two optional keys:

```js
module.exports = {
  workers: {
    // workerPath → async (ctx) => result
    // ctx: { task, pgEnv, db, dispatchEvent, updateProgress }
    'map21/publish': require('./worker'),
  },
  routes: (router, helpers) => {
    // mounted at /dama-admin/:pgEnv/<plugin-name>/
    // helpers: { queueTask, createDamaSource, createDamaView,
    //            getDb, ensureSchema, dispatchEvent, ... }
    router.post('/publish', async (req, res) => { /* ... */ });
  },
};
```

See `_example-hello-world/index.js` for an annotated reference of the full
contract (worker `ctx` shape, route `helpers` shape, response contract).

### Response contract

Routes that queue a task should return `{ etl_context_id, source_id }`.
`etl_context_id` IS the new task_id — the legacy client polls events via
`/events/query?etl_context_id=…` and that path still works.

### Source `metadata.columns` contract

**Whenever a plugin creates a per-view physical table, it must also write
a column descriptor list to `data_manager.sources.metadata.columns`.**
Without it DataWrapper, the built-in Table page, the column-aware filter
UI, and any UDA-driven page section render an empty grid against the
source. This is the most-forgotten step in a new plugin.

Shape (the cross-DAMA contract — see also
`dms-server/src/dama/CLAUDE.md#metadata.columns contract`):

```js
metadata.columns = [
  { name: 'received_at', display_name: 'Received At', type: 'TIMESTAMPTZ', desc: null },
  { name: 'title',       display_name: 'Title',       type: 'TEXT',        desc: null },
  { name: 'raw',         display_name: 'Raw',         type: 'JSONB',       desc: null },
  // …
];
```

| Field | Required | Notes |
|---|---|---|
| `name` | yes | Must match the physical column name exactly. |
| `display_name` | yes | Header text in the Table page. |
| `type` | yes | Bare Postgres type — `TEXT`, `TIMESTAMPTZ`, `INTEGER`, `JSONB`, etc. No constraints. |
| `desc` | optional | Tooltip / metadata-page description. |

Write it via JSONB merge so other top-level metadata keys aren't clobbered:

```js
await db.query(
  `UPDATE data_manager.sources
   SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
   WHERE source_id = $2 AND (metadata IS NULL OR NOT (metadata ? 'columns'))`,
  [JSON.stringify({ columns, schema: 'my_schema_tag_v1' }), source_id]
);
```

The `AND … NOT (metadata ? 'columns')` guard makes re-provisioning safe
without overwriting a hand-edited column list. Drop the guard if you
want re-runs to be authoritative.

**Curated default vs. all columns.** Plugins with many physical columns
(e.g. `now_playing` has ~50) typically write a curated subset (10-20)
to `metadata.columns` and keep a `JSONB raw` column for the full
payload. The physical table still has every column; `metadata.columns`
only controls what's visible by default. See
`data-types/now_playing/schema.js` for `COLUMN_METADATA` (curated) vs.
`ALL_COLUMN_METADATA` (full) as a worked example.

## Client side

DMS sites consume datatype client code through `damaDataTypes` (see
`src/data-types.js`). The DMS `datasets` pattern provides a `DatasetsContext`
to plugged-in components. The contract:

- Each plugin's `pages/index.jsx` exports an object keyed by **page slot**
  (currently `sourceCreate`); each entry is `{ name, component }`.
- `src/data-types.js` builds the `damaDataTypes` map keyed by **DAMA source
  type** (e.g. `fima_nfip_claims_v2_enhanced`, `map21`).
- The datasets pattern's `CreatePage` looks up
  `damaDataTypes[type]?.sourceCreate?.component` and renders it as
  `<ExternalComp context={DatasetsContext} source={data} />`.

### `defaultPages` shorthand

A plugin's `pages/index.jsx` can opt into built-in source-view pages
(Table, Map, Metadata) without deep-importing them from the
`patterns/datasets` tree:

```jsx
// data-types/<name>/pages/index.jsx
const pages = {
  defaultPages: ['table'],         // ← short names from the registry
  sourceCreate: { name: 'Create', component: Create },
};
export default pages;
```

The datasets pattern's `siteConfig.jsx` expands each entry of
`damaDataTypes` against the registry at
`src/dms/packages/dms/src/patterns/datasets/pages/dataTypes/defaultPages.js`,
filling in any `defaultPages: [...]` listed names with the matching
built-in page configs. Plugin's own page entries always win on
conflict, so a plugin can ship its own custom Table while still
inheriting Map+Metadata.

Currently registered short names: `'table'`, `'map'`, `'metadata'`.
To add another, edit `defaultPages.js` (and document it here so plugin
authors know about it).

The Table page reads `source.metadata.columns` — see the metadata
contract above. Without it, "table" inflates to an empty grid.

### Page-component contract

Components receive props `{ source, newVersion, baseUrl, context }`. They
read shared state from `useContext(context)`:

```jsx
function Create({ source, newVersion, baseUrl, context }) {
  const ctx = React.useContext(context);
  const { user, falcor, datasources, API_HOST } = ctx || {};
  const pgEnv = (datasources || []).find(d => d.type === 'external')?.env || '';
  const rtPfx = `${API_HOST || ''}/dama-admin/${pgEnv}`;
  // ...
  await fetch(`${rtPfx}/<plugin-name>/publish`, { ... });
}
```

`DatasetsContext` provides: `UI, datasources, dmsEnv, baseUrl, falcor,
useFalcor, user, apiLoad, apiUpdate, theme, app, type, parent, API_HOST,
DAMA_HOST, authPermissions, damaDataTypes, isUserAuthed`. It does **not**
provide `pgEnv` or `falcorCache` — derive `pgEnv` from `datasources` and use
`falcor.getCache()` if you need cache access.

### Falcor routes

Use the `uda` route prefix (not the legacy `dama` prefix) and read
attributes flat — `uda` does not nest under `attributes`:

```js
// list sources
await falcor.get(['uda', pgEnv, 'sources', 'length']);
await falcor.get([
  'uda', pgEnv, 'sources', 'byIndex',
  { from: 0, to: length - 1 },
  ['source_id', 'name', 'type', 'metadata'],
]);

// views grouped by source category (= source type)
await falcor.get(['uda', pgEnv, 'views', 'bySourceCategory', 'npmrds']);
```

`etlContexts`, `events`, and dataset row data still use the `dama` prefix.

### Vite Fast Refresh

Pages are `.jsx` and only export React components, per
`src/dms/packages/dms/CLAUDE.md`. Helpers and constants go in `.js` files
(not `.jsx`). Use named-default exports (`function Foo(...)`, not anonymous
arrows) so HMR can track them.

### Registration

`src/data-types.js` imports each plugin's `pages/index.jsx` and exposes them
to the DMS site via `damaDataTypes` (see `src/App.jsx`). The map key is the
DAMA source `type`, not the plugin name (those usually match but can
differ — `enhance_nfip_claims_v2` plugin produces sources of type
`fima_nfip_claims_v2_enhanced`).

### Auth headers

Routes that call `requireAuth()` (`POST /streams`, `/backfill`, etc.)
need the JWT in the `Authorization` header. The auth context exposes
the token at `user.token`; read `user` from `DatasetsContext` at the
call site, never thread it through props. Idiomatic helper:

```jsx
function useApi(context) {
  const ctx = React.useContext(context) || {};
  const { user, datasources, API_HOST } = ctx;
  const pgEnv = (datasources || []).find(d => d.type === 'external')?.env || '';
  const rtPfx = pgEnv ? `${API_HOST || ''}/dama-admin/${pgEnv}` : '';
  // returns postJson/getJson with the Authorization header pre-bound
}
```

The dms-server JWT middleware (`dms-server/src/auth/jwt.js`) reads the
header verbatim — no `Bearer ` prefix is stripped. Pass `user.token`
directly.

## Adding a new plugin

1. `mkdir data-types/<name>` and copy from `_example-hello-world/` or an
   existing plugin.
2. Implement server side: `index.js` exporting `{ workers, routes }`.
3. **Write `metadata.columns`** at provision/publish time (see contract
   above). This is the most-forgotten step.
4. (Optional) Implement client side: `pages/index.jsx` + `pages/create.jsx`.
   Add `defaultPages: ['table']` to inherit the built-in Table page if the
   dataset is column-shaped.
5. Add one line to `register-datatypes.js`:
   `registerDatatype('<name>', require('./<name>'));`
6. (If client side) Add an import + entry to `src/data-types.js` keyed by
   the DAMA source type the plugin produces, under the right app key.
7. Rebuild the server (`./deploy.sh` or `docker build`) so the bootstrap
   picks up the new plugin. Frontend changes need a fresh `npm run build`
   or a dev server restart.
