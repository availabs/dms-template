# `actions_location` data-type — geolocate Mitigate-NY actions into a `gis_dataset`

## Status: NOT STARTED

## Audience

**This task is written for a developer, not for an agent.** It assumes you have
not built a DMS data-type plugin before, so the first half explains how
data-types work and are registered in `dms-template`. The second half is the
concrete spec for the new plugin. Read the whole thing before writing code, and
keep `data-types/CLAUDE.md` open alongside it — that file is the canonical
contract; this task does not duplicate all of it.

---

## Objective

Build a new DMS data-type plugin, **`actions_location`**, under
`dms-template/data-types/mny/actions_location/`. It takes the internal
Mitigate-NY **actions** dataset as input and produces a new **external**
(`gis_dataset`) dataset, "Actions Location", with one point per action:

| Output column        | Type                 | Notes |
|----------------------|----------------------|-------|
| `action_id`          | `TEXT`               | The source row id (stable key back to the action). |
| `action_name`        | `TEXT`               | From `action_name`. |
| `action_description` | `TEXT`               | From `action_description`. |
| `action_jurisdiction`| `TEXT`               | From `jurisdiction` / `municipality_name`. |
| `action_county`      | `TEXT`               | From `county`. |
| `location_precision` | `INTEGER`            | Code 1–4 (or 0) — see [Location resolution](#location-resolution-waterfall). |
| `location`           | `GEOMETRY(Point,4326)` | The resolved point. |

The point is resolved with a **fallback waterfall**: explicit coordinates →
geocoded address → jurisdiction centroid → county centroid. Each rung sets a
distinct `location_precision` code so downstream maps and reports can tell how
trustworthy each point is.

The output source's DAMA **`type` must be `gis_dataset`** so it plugs into the
standard map/tiles/Table pages with no extra client work.

---

## Part 1 — How data-types work in `dms-template`

A "data-type" (a.k.a. datatype plugin) is an app-owned DMS plugin living in
`dms-template/data-types/<name>/`. Each plugin contributes a **server side**
(a long-running worker plus Express routes mounted into `dms-server`) and,
optionally, a **client side** (React pages plugged into the DMS `datasets`
pattern). The canonical reference is `data-types/CLAUDE.md`; the annotated
skeleton is `data-types/_example-hello-world/index.js`; the closest working
analog to this task is `data-types/mny/enhance_nfip_claims_v2/index.js` — it
also turns an internal dataset into an external, map-ready one, so **copy its
structure**.

### 1.1 The CommonJS rule

The repo root is `"type": "module"` (ESM), but `data-types/package.json`
declares `"type": "commonjs"` so the whole `data-types/` subtree is CJS.
`dms-server` loads plugins with `require()`. **All server `.js` files in your
plugin must use `require` / `module.exports`**, not `import` / `export`. (Client
`.jsx` files are bundled separately by Vite and use ESM — but this plugin is
server-only; see [§3.7](#37-client-side-optional).)

### 1.2 Plugin shape

`index.js` exports an object with up to three keys:

```js
module.exports = {
  workers: {
    // workerPath → async (ctx) => result
    'actions_location/publish': async (ctx) => { /* the real work */ },
  },
  routes: (router, helpers) => {
    // mounted at /dama-admin/:pgEnv/actions_location/
    router.post('/publish', async (req, res) => { /* queue a task */ });
  },
  // schedulables: { ... }   // optional; cron support — out of scope here
};
```

- **`workers`** — a map of `workerPath` → async handler. The path string
  (convention `<name>/<action>`) is stored on `tasks.worker_path` when a route
  enqueues a task, and is how the task runner finds your handler.
- **`routes`** — a function `(router, helpers) => void`. The router is mounted
  at `/dama-admin/:pgEnv/<plugin-name>/` with `mergeParams: true`, so
  `req.params.pgEnv` is available inside handlers.

### 1.3 Worker `ctx` shape

The task runner calls your worker with:

| `ctx` field          | What it is |
|----------------------|------------|
| `ctx.task`           | The `data_manager.tasks` row. `ctx.task.descriptor` is the object the route passed to `queueTask`; `ctx.task.task_id` is the etl_context_id. |
| `ctx.pgEnv`          | DB config name (e.g. `dms-mercury-2`). |
| `ctx.db`             | DB adapter. Use `ctx.db.query(sql, params)`. Works for both postgres and sqlite, but this plugin is **postgres-only** (it needs PostGIS). |
| `ctx.dispatchEvent`  | `(type, message, payload?) => Promise`. Writes a row to `task_events`; `type` is the key clients poll. Use `<src_type>:<EVENT>` strings. |
| `ctx.updateProgress` | `(progress: 0..1) => Promise`. Drives the UI progress bar. |

### 1.4 Route `helpers` shape

The most-used helpers (full list in `_example-hello-world/index.js`):

- `helpers.queueTask({ workerPath, sourceId?, ...descriptor }, pgEnv)` → enqueues
  a task, returns `taskId`. Everything beyond `workerPath` becomes
  `ctx.task.descriptor.*`.
- `helpers.createDamaSource({ name, type, user_id }, pgEnv)` → creates a row in
  `data_manager.sources`, returns `{ source_id }`.
- `helpers.createDamaView({ source_id, user_id, etl_context_id, view_dependencies }, pgEnv)`
  → creates a `data_manager.views` row. **Also exported from
  `@availabs/dms-server/src/dama/upload/metadata`** and called directly inside
  the worker in the NFIP analog — do it the same way.
- `helpers.getDb(pgEnv)`, `helpers.ensureSchema(db, name)`.

### 1.5 Response contract

A route that queues a task must respond `{ etl_context_id, source_id }`.
`etl_context_id` **is** the new `task_id`; the legacy client polls
`/events/query?etl_context_id=…`.

### 1.6 The `metadata.columns` contract (most-forgotten step)

Whenever a plugin creates a per-view physical table, it **must** also write a
column descriptor list to `data_manager.sources.metadata.columns`, or the Table
page, DataWrapper, and the filter UI render an empty grid. Shape:

```js
metadata.columns = [
  { name: 'action_id',          display_name: 'Action ID',          type: 'TEXT',    desc: null },
  { name: 'action_name',        display_name: 'Action Name',        type: 'TEXT',    desc: null },
  { name: 'action_description', display_name: 'Action Description', type: 'TEXT',    desc: null },
  { name: 'action_jurisdiction',display_name: 'Jurisdiction',       type: 'TEXT',    desc: null },
  { name: 'action_county',      display_name: 'County',             type: 'TEXT',    desc: null },
  { name: 'location_precision', display_name: 'Location Precision', type: 'INTEGER', desc: 'See precision codes' },
  // `location` (geometry) is intentionally omitted — it renders via the map, not the grid.
];
```

Write it with a JSONB merge so you don't clobber sibling metadata keys (see the
exact `UPDATE … SET metadata = COALESCE(metadata,'{}') || $1` pattern in
`data-types/CLAUDE.md` → "Source `metadata.columns` contract").

### 1.7 Registration

A plugin only loads if it is registered. `data-types/register-datatypes.js` is
the single bootstrap entry (read by `dms-server` via the
`DMS_EXTRA_DATATYPES` env var). Add **one line**:

```js
registerDatatype('actions_location', require('./mny/actions_location'));
```

Plugin/registration names use **underscores**, per the project naming
convention. After registering, the server must be rebuilt (`./deploy.sh` or a
`docker build`) for the bootstrap to pick it up.

> Note on naming: the registration name (`actions_location`, also the URL
> prefix) is independent of the DAMA source `type` it produces. Here they
> differ on purpose — the plugin is `actions_location`, but the output `type`
> is `gis_dataset`.

---

## Part 2 — The input: the internal "actions" dataset

The commonly-used actions dataset on **`mitigat-ny-prod`** is **`Actions_Revised`**:

- DAMA `source_id` **`1029065`**, `view_id` **`1074456`**.
- Internal-dataset row `type` string: **`actions_revised|1074456:data`** (~18,366 rows).
- It is a DMS *internal* dataset: rows live in the per-app split table, **not**
  in a flat physical table. Each row has a top-level `id` and a **`data` JSONB**
  column holding the action's fields. You read a field with `data->>'field_name'`.

> **Confirm the physical table before writing SQL.** Internal-dataset rows are
> routed to split tables by `src/dms/packages/dms-server/src/db/table-resolver.js`
> (`resolveSchema` / `resolveTable`, keyed off the app + the `{name}-{viewId}`
> split type). For postgres the app `mitigat-ny-prod` lands under a
> `dms_{app}` schema. **Do not hardcode a guess** — either (a) call the
> table-resolver to get the schema/table for the actions type, or (b) follow the
> NFIP analog and accept the input `schema`/`table` (and view) as **descriptor
> params** chosen on the create page, so the worker just reads
> `${input_schema}.${input_table}`. Option (b) is simpler and matches
> `enhance_nfip_claims_v2`.

### Fields available on each action (`data->>'…'`)

Confirmed present in the live dataset (see the page exports under
`scratchpad/mitigat-ny-prod-prod/actions_db/`):

| Field (`data->>`)        | Use |
|--------------------------|-----|
| `action_name`            | → `action_name` |
| `action_description`     | → `action_description` |
| `jurisdiction` / `municipality_name` / `municipality_type` | → `action_jurisdiction`; jurisdiction-centroid lookup |
| `geoid_juris`            | jurisdiction GEOID — join key to the jurisdiction geometry table |
| `county`                 | → `action_county` |
| `county_geoid`           | county GEOID — join key to the county geometry table |
| `address_if_available`   | the street address to geocode (rung 2) |
| `action_status`, `action_status_details`, `action_status_date` | carried context, not required in output |

`action_id` → use the row's top-level **`id`** (the stable DMS row id).

> **Coordinates (rung 1):** there is **no** dedicated lat/lon field in the
> current schema. The waterfall must still check for one *if it exists* (e.g.
> `data->>'latitude'` / `data->>'longitude'`, or a `data->>'coordinates'` /
> `data->>'location'` value) and use it when present. Treat coordinates as
> "use if available, otherwise fall through." Confirm the exact field name with
> the Mitigate-NY data owner; do not assume one is populated.

---

## Part 3 — The build

### 3.1 Files

```
data-types/mny/actions_location/
├── index.js        # { workers, routes }  — the contract object
├── resolve.js      # the location waterfall SQL builder (keep SQL out of index.js)
└── geocode.js      # address → {lon,lat} helper (rung 2)
```

Mirror `enhance_nfip_claims_v2/index.js` for the worker/route skeleton, the
`createDamaView` call, the `views` table update, and the tiles metadata block.

### 3.2 Location resolution waterfall

For each action, resolve **one** point by trying rungs in order and stopping at
the first hit. Record which rung produced it in `location_precision`:

| `location_precision` | Rung | Source of the point |
|---|---|---|
| **1** | Explicit coordinates | The action's own lat/lon coordinates, when present and valid. Most precise. |
| **2** | Geocoded address | `address_if_available` geocoded to a point (see §3.3). |
| **3** | Jurisdiction centroid | `ST_Centroid` of the action's jurisdiction (municipality) polygon, matched on `geoid_juris`. |
| **4** | County centroid | `ST_Centroid` of the action's county polygon, matched on `county_geoid`. Least precise. |
| **0** *(or NULL)* | Unresolved | No coordinates, no geocodable address, no matching jurisdiction or county geometry. Emit the row with a NULL `location` and log a count. |

Implement this as a `COALESCE`-style cascade in SQL (build the point columns for
each rung, then pick the first non-null and set the code with a `CASE`). The
jurisdiction and county centroids come straight from PostGIS — no external
calls. Only rung 2 needs the geocoder, so geocode addresses in a **pre-pass**
(see §3.3) and feed the results in, rather than calling a network service from
inside one giant SQL statement.

### 3.3 Geocoding (rung 2)

There is **no existing geocoder** in `dms-template` (grep confirms it). You must
add one in `geocode.js`. Requirements:

- Input: `address_if_available` (a NY street address). Output: `{ lon, lat }` in
  EPSG:4326, or `null` on no-match.
- **Default service: the U.S. Census Bureau batch geocoder**
  (`geocoding.geo.census.gov`) — free, no key, supports batch CSV, appropriate
  for US street addresses. Confirm whether AVAIL already runs an internal
  geocoder you should use instead before wiring up an external dependency.
- **Batch, don't loop.** Only geocode actions that (a) have no rung-1
  coordinates and (b) have a non-empty `address_if_available`. Submit them as
  one batch; cache/store the result keyed by `action_id` for the SQL pass.
- Be resilient: a geocoder timeout or no-match must fall the action through to
  rung 3/4, not fail the whole task.

### 3.4 Geometry source tables (rungs 3 & 4)

Use the **same** jurisdiction and county geometry tables that
`enhance_nfip_claims_v2` uses — that plugin already takes
`jurisdiction_schema`/`jurisdiction_table` and `county_schema`/`county_table`
as params and joins on `geom` (jurisdictions filtered to
`census_type IN ('place','cousub')`). Pass them the same way and join:

- Jurisdiction centroid: `geoid_juris` = jurisdiction `geoid` →
  `ST_SetSRID(ST_Centroid(geom), 4326)`.
- County centroid: `county_geoid` = county `geoid` →
  `ST_SetSRID(ST_Centroid(geom), 4326)`.

Confirm the exact schema/table names with the existing NFIP create page (it is
already wired to the production geometry tables on the Mitigate-NY pgEnv).

### 3.5 Writing the output (worker body)

Follow the NFIP worker step-for-step:

1. `dispatchEvent('gis_dataset:WORKER_INIT', …)`, `updateProgress(0.05)`.
2. `createDamaView({ source_id, user_id, etl_context_id: task.task_id, view_dependencies })`
   → `{ view_id }`.
3. `CREATE SCHEMA IF NOT EXISTS gis_datasets` (the standard schema for
   `gis_dataset` outputs; `createDamaView` already defaults table naming to
   `gis_datasets.s{source_id}_v{view_id}`).
4. Geocode pre-pass (§3.3), then run the resolution SQL (§3.2) to
   `SELECT … INTO gis_datasets.<table>_<view_id>`. Output columns exactly as in
   the [Objective](#objective) table; `location` as `GEOMETRY(Point,4326)`. Add
   an `ogc_fid SERIAL PRIMARY KEY`.
5. Create a GiST index on `location` (tiles + map queries need it):
   `CREATE INDEX ON … USING GIST (location);`
6. Update the `data_manager.views` row's `table_schema` / `table_name` /
   `data_table`, and write the **tiles `metadata`** block (copy the NFIP
   worker's `tiles.sources` + `layers` — a `circle` layer over the point
   `t.pbf` tiles, `source-layer: view_<view_id>`).
7. Write **`metadata.columns`** on the source (§1.6).
8. `updateProgress(1)`, `dispatchEvent('gis_dataset:FINAL', 'complete', { view_id, source_id })`,
   `return { view_id, source_id }`. On error, `dispatchEvent('gis_dataset:ERROR', e.message, { error: e.stack })` and rethrow.

### 3.6 The route

`POST /dama-admin/:pgEnv/actions_location/publish`:

1. Read body params: output `source_name`/`table_name`, optional
   `existing_source_id`, `user_id`, `email`, the **input** dataset
   schema/table/view, and the jurisdiction/county geometry schema+table params.
2. If no `existing_source_id`, `createDamaSource({ name, type: 'gis_dataset', user_id })`.
3. `queueTask({ workerPath: 'actions_location/publish', sourceId: source_id, source_id, …allParams })`.
4. Respond `{ etl_context_id: taskId, source_id }`.

### 3.7 Client side (optional)

Server-only is acceptable for a first cut — an admin can trigger `/publish`
directly. Because the output `type` is `gis_dataset`, it already renders with
the **built-in** gis_dataset map/Table/metadata pages once `metadata.columns`
and the tiles metadata are written — you do **not** need a custom `pages/`
folder unless you want a bespoke Create form. If you add one, register it in
`src/data-types.js` keyed by the source `type` (`gis_dataset`) per
`data-types/CLAUDE.md` → "Client side". (Be careful: `gis_dataset` is a shared
type, so don't override the global gis_dataset Create page — prefer a dedicated
admin trigger or a parameterized form.)

---

## Part 4 — Registration & deploy checklist

1. `data-types/mny/actions_location/{index.js, resolve.js, geocode.js}` written.
2. `metadata.columns` written on the output source (§1.6).
3. Tiles metadata + GiST index written (so the map renders).
4. One line added to `data-types/register-datatypes.js`:
   `registerDatatype('actions_location', require('./mny/actions_location'));`
5. Rebuild the server (`./deploy.sh` / `docker build`) so the bootstrap loads it.

---

## Part 5 — Acceptance criteria

- Running `/publish` against the `mitigat-ny-prod` pgEnv with the
  `Actions_Revised` dataset as input creates a new `gis_dataset` source + view,
  with a `gis_datasets.<table>_<view_id>` point table.
- Every output row has the seven columns from the [Objective](#objective)
  table; `location_precision` is one of `1,2,3,4` (or `0`/NULL for unresolved),
  and the distribution is logged (counts per code).
- Spot-check: an action with coordinates → code 1; an address-only action →
  code 2 and a plausible point; a jurisdiction-only action → code 3 at the
  municipality centroid; a county-only action → code 4 at the county centroid.
- The new source opens on the built-in **map** page and shows points, and the
  **Table** page shows the six non-geometry columns (proves `metadata.columns`
  and tiles metadata are correct).
- No action is dropped: `output row count == input action count`.

## References

- `data-types/CLAUDE.md` — full plugin contract (read first).
- `data-types/mny/enhance_nfip_claims_v2/index.js` — the closest analog; copy its
  worker/route/tiles/`createDamaView` structure.
- `data-types/_example-hello-world/index.js` — annotated `ctx` / `helpers` reference.
- `data-types/register-datatypes.js` — where the one-line registration goes.
- `src/dms/packages/dms-server/src/db/table-resolver.js` — how to resolve the
  input internal-dataset's physical table.
- `scratchpad/mitigat-ny-prod-prod/actions_db/` — sample exports confirming the
  actions dataset id (`1029065`) and available fields.
