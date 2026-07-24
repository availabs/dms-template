# Route creation tool — findings

**Status:** map-properties bug (Part 1) is now **fixed, live-verified, and committed** — option (a),
plugin-local workaround, implemented and committed 2026-07-23 in transportNY, user confirmed
working by testing it live the same day. Feature gap catalogued, with deferrals decided. Arc step 3
(design research) for the next priority (Marker Placement / auto-routing) is **complete** — the
endpoint is found/traced/confirmed live (Part 5), and all four architecture/UX forks are decided
(Part 6). Arc step 4 (scope/plan) is **done**, tracked in **two** repos' planning systems: this
repo's `src/dms/planning/tasks/current/routecreation-marker-placement-autorouting.md` (umbrella
plan + Phase 1 dms-server proxy, todo entry under `patterns/mapeditor`) and transportNY's own
`planning/tasks/current/routecreation-marker-placement-autorouting.md` (Phase 2-3 plugin work,
todo entry under `maps`) — added 2026-07-23 per user request so transportNY has proper local
tracking too, not just a cross-repo pointer. This doc remains the research/evidence
record; the task file is the implementation source of truth going forward. This doc captures the
2026-07-23 investigation plus three same-day follow-up rounds so a later session doesn't have to
re-derive it.

## Objective

Route Creation is the tool that feeds `Route`s (named, saved collections of TMCs — road segments)
into the NPMRDS Reports feature. It's a separate arc from the report-page-redesign work
(`research/report-page-redesign/`), but part of the same overall "NPMRDS Reports" effort. A
prototype rebuild exists but is currently broken; this investigation covers debugging that
prototype, and cataloguing the feature gap between it and the tool it's meant to replace.

Requested arc (user's own breakdown):
1. Debug the prototyped `routecreation.plugin.jsx` — **done, see Part 1**.
2. Determine the feature gap between old and new, triage — **done, see Parts 2-4**.
3. Design research, produce design artifacts — not started.
4. Scope and plan changes — not started.

## Repos and URLs

- **Old tool** (live, production, bespoke — *not* built on the DMS pattern system):
  `https://npmrds.devtny.org/folders/routes` (folder browser) and
  `https://npmrds.devtny.org/route/creation/folder/:id` (creation/editing UI). Source: transportNY
  repo, `src/sites/npmrds/pages/route_creation/` + `src/sites/npmrds/pages/Folders/`.
- **New tool** (prototype, a DMS `mapeditor` plugin, currently bugged):
  `http://sandbox.localhost:5174/edit/demo_reports` — port 5174 is just Vite's default
  auto-increment (5173 was already taken), not a separate config. Source: transportNY repo,
  `src/pages/TransportNYDataTypes/plugins/routecreation/`. The frontend points at a **local**
  dms-server instance running the current checkout — not a separately-deployed/stale backend, so
  there's no client/server version-mismatch to worry about.
- Both tools live in `/home/ryan/code/transportNY`, a separate repo from this one (`dms-template`).
- **Cross-repo wrinkle**: transportNY's `dms` git submodule and this repo's `src/dms` are the
  *same upstream* (`availabs/dms.git`) but currently checked out at diverged commits (transportNY:
  `dd0a7bee`, dms-template: `ef220c57`, as of 2026-07-23) — relevant because the actual bug (Part
  1) lives inside that shared library, in a pattern (`mapeditor`) that **both** repos register.
  transportNY's git status also shows `avl-components`, `avl-graph`, and `avl-map-2` submodules
  sitting at uncommitted/diverged pointers. The user is planning to move local
  dms-template/`dms` changes to a branch so transportNY can safely pull them, rather than mixing
  into master prematurely. Per this repo's CLAUDE.md, any eventual fix to the shared `@availabs/dms`
  library should be tracked as a task under **this repo's `src/dms/planning/`**, regardless of
  which consuming app (transportNY) found the bug.
- Three map-related git submodules exist in transportNY — `avl-map`, `avl-map-2`, `avl-maplibre`
  — but the `mapeditor` pattern's actual map instantiation
  (`dms/packages/dms/src/patterns/mapeditor/MapEditor/index.jsx:3`) imports `maplibre-gl` directly,
  not through any of the three. They're very likely unrelated to anything in this document —
  flagging so nobody chases them as a lead later.

## Bottom line up front

The map-properties bug is a **systemic gap in the shared `mapeditor` pattern**, not a mistake
specific to routecreation, and not caused by the map-library sprawl (avl-map/avl-map-2/avl-maplibre)
that looked like the obvious suspect at first glance. The actual mechanism (Part 1) is fully
traced end-to-end and independently verified by reading every cited line directly, not just taken
from agent say-so. Separately, the feature-gap pass (Parts 2-4) found the old tool has
substantially more surface area than the new prototype currently covers — most notably a second,
fundamentally different creation mode (draw points, auto-route the TMCs) that doesn't exist in the
new tool at all, plus CSV bulk import, plus several visual-feedback affordances that are architecturally
blocked by the very same bug in Part 1.

---

## Part 1 — The map properties bug (root cause, verified)

### Symptom

In `src/pages/TransportNYDataTypes/plugins/routecreation/hooks/useMapTmcHandler.js:33-37`, a map
click handler does:

```js
const features = map.queryRenderedFeatures(e.point, { layers: [shapefileLayerId] });
const featId = features?.[0]?.properties?.tmc;
```

A feature **is** found (hit-testing works, the layer ID resolves correctly) but
`features[0].properties` comes back a genuinely empty `{}` — so `featId` is always `undefined`,
and no TMC is ever added to the selection. This is the entire reason the new tool doesn't work:
without a TMC ID coming back from a click, nothing can be selected, and nothing can be saved.

### Mechanism (fully traced, independently verified)

1. **Publish time** — when a data view gets published, `dms-server` bakes its tile URL with **no
   querystring at all**: `dama/upload/workers/gis-publish.js:440` sets the tile source to
   `.../dama-admin/${pgEnv}/tiles/${view_id}/{z}/{x}/{y}/t.pbf` — bare, nothing appended. Verified
   by reading the file directly (lines 420-459).
2. **Client mount** — `SourceSelector/index.jsx:117-122` copies `view.metadata.tiles.sources`
   verbatim into a new map layer's config when an author adds the source; `ui/components/map/
   avl-layer.jsx:80-88` mounts it via `maplibreMap.addSource(id, source)` with no URL rewriting.
   So whatever was baked in at publish time (no cols) carries forward unchanged.
3. **The only place a `cols=` param is ever added** is
   `dms/packages/dms/src/patterns/mapeditor/MapEditor/components/SymbologyViewLayer.jsx`'s
   `getLayerTileUrl` function (line 533). Verified by reading it directly (lines 533-577): it
   builds `colsToAppend` from a layer's `data-column` / `filter-group` / `dynamic-filters`, and
   only touches the URL at all if one of those is set (`layerHasFilter` or non-empty
   `colsToAppend`). If none are set, the function returns the URL completely unchanged — stripped
   of any existing querystring, nothing added back.
4. That rewrite only even **runs** when a `useEffect` (same file, lines 44-104, verified directly)
   detects `didFilterGroupColumnsChange` / `didDataColumnChange` / `didFilterChange` /
   `didDynamicFilterChange` / a `view_id` change. Routecreation's shapefile layer sets **none** of
   these — `routecreation.plugin.jsx`'s `mapRegister` and `dataUpdate.jsx` only ever write
   `.paint` (styling), never `data-column`/`filter`/`filter-group`/`dynamic-filters`. So this
   rebuild never fires for this layer, *and* even if it somehow did, step 3's function would still
   leave the URL bare, because nothing populates the fields it looks for.
5. **Server side** — with no `cols` in the request, `dms-server/src/dama/tiles/tiles.rest.js:
   101-104`'s `colExpr` is `''` (verified directly). The actual PostGIS query
   (`tiles.rest.js:106-126`) becomes:
   ```sql
   WITH mvtgeom AS (
     SELECT ST_AsMVTGeom(...) AS geom, ogc_fid
     FROM <table> ...
   )
   SELECT ST_AsMVT(mvtgeom.*, 'view_<id>', 4096, 'geom', 'ogc_fid') AS mvt FROM mvtgeom
   ```
   i.e. the row selects **only** `geom` and `ogc_fid` — nothing else. PostGIS's 4-argument
   `ST_AsMVT(row, layer, extent, geom_column, feature_id_column)` uses the named
   `feature_id_column` (`ogc_fid` here) as the vector tile feature's `id`, and **excludes it from
   properties** by design (standard PostGIS behavior, not a bug in this code). Net result: a real,
   hit-testable feature whose `properties` is a genuinely empty `{}` — exactly the observed
   symptom.

### This is systemic, not a one-off mistake

The entire column-inclusion mechanism in `mapeditor` is built around "I'm filtering/coloring by
column X." There's no concept anywhere in it of "I just need to read this property on click, with
no filter/color binding to it." Routecreation appears to be the first consumer of this pattern
that only needs click-identity and colors by *selection state*, not by any data column at all — a
genuinely new use case for this shared code, not a regression in the traditional sense.

### Bonus finding: answers an open question from the original investigation

`dataUpdate.jsx:44-51` (per the agent that traced this) independently reads `["get", "tmc"]`
inside a maplibre paint `match` expression, to color selected TMCs red. That fails silently for
the **identical** reason — so yes, highlighting selected TMCs on the map was intended to work, and
it's broken by the same root cause, not a second, separate bug. (This directly answers "I can't
remember if the selected TMCs are supposed to be highlighted on the map" from the original
prompt — they are, and it's the same bug.)

### Likely explains the timing ("it worked when I built it, then broke")

There's a dms-server commit, `efbdb35b` ("dama and dockerfile"), that looks like it moved
shapefile-type views from a static PMTiles pipeline (tippecanoe-built tiles embed all properties
by default — no cols-filtering possible, ever) onto this dynamic, cols-gated tile route. That's
consistent with the plugin working when first built and silently breaking later, without any
change to routecreation's own code. **Not fully provable from git history alone** — confirming it
would mean checking the view's actual historical publish metadata, which isn't visible from the
submodule's commit log by itself.

### Ruled out (checked and eliminated, don't re-investigate)

- **Commit `ab143441` "NPMRDS Report Tool Conversion (#4)"** (2026-07-17) — this was the first
  lead, since it's a small, recent diff touching exactly `SymbologyViewLayer.jsx` and
  `MapEditor/index.jsx`, and its own sub-commit messages ("map comparison series", "ch tile join")
  match work from the adjacent reports arc. Confirmed via `git show` that its actual diff is
  strictly inside `buildJoinParam`/`buildJoinOptions`, gated behind `layerProps?.join` — only
  affects layers with an explicit cross-engine join config, which routecreation's plain
  click-selection layer doesn't have. The shared `getLayerTileUrl`/change-detection machinery this
  commit sits inside predates it by many commits (traced back to an early commit `f6c5e714`).
- **Wrong layer / layer-ID collision** — `SourceSelector.addLayer()`
  (`SourceSelector/index.jsx:100,108,122`) mints one `layerId` used both as the
  `state.symbology.layers` key and as the literal `.id` of the visible data sub-layer
  (`LayerManager/utils.jsx:65-90`). `routecreation.plugin.jsx`'s `mapRegister` targets that same
  `layers[1]`. So `shapefileLayerId` passed to `queryRenderedFeatures` is guaranteed to be the
  real data layer, not an overlay/highlight layer with an ID collision.
- **`promoteId`/`generateId`** — zero occurrences anywhere in `packages/dms/src` (grepped). The
  PostGIS `feature_id_name` mechanism (see step 5 above) is unconditional and unrelated to
  maplibre's `promoteId` concept.
- **avl-map / avl-map-2 / avl-maplibre confusion** — see "Three map-related git submodules" note
  above; the `mapeditor` pattern doesn't route through any of them for this.

### Not yet resolved / needs a live check when we're ready to act

Whether the *currently live* `npmrds_shapefile` view's stored `metadata.tiles` genuinely still has
no querystring today (as opposed to something having patched it already) is a live/DB fact, not a
static one. Quick to check whenever we're ready (`dms raw get <view_id>`, or inspect
`map.getStyle()` / the network tab live) — every code path found is consistent with the hypothesis,
this is just the one link not confirmable from source alone.

### Fix implemented: option (a), plugin-local workaround (2026-07-23)

User decision: go with (a), narrowest blast radius, not (b)/(c) — those remain available if a
future consumer needs the same click-identity-only capability and it's worth generalizing then.

Change (uncommitted, transportNY): `routecreation.plugin.jsx`'s `mapRegister` now sets
`symbologyLayerPath['${shapefileLayerId}']['data-column'] = 'tmc'` in the same `setState` draft
call that already sets `.layers[1].paint`, right next to it. Mechanism: `getLayerTileUrl`
(`SymbologyViewLayer.jsx:543-556`) reads `layerProps["data-column"]` as a single string (not an
array — that shape only takes a list of columns via `filter-group`, which requires
`filterGroupEnabled: true` and isn't needed here since only one column is required) and appends it
to the tile URL's `?cols=`. `data-column` (unlike `prevLayerProps` starting `undefined`) differing
from the previous render trips `didDataColumnChange` (`SymbologyViewLayer.jsx:57-59`), which is one
of the four triggers that makes the `useEffect` (lines 49-289) actually rebuild the maplibre
source/layers with the corrected URL — so the fix takes effect on mount, no extra plumbing needed.

Verified no side effect: `data-column` also feeds the shared map-editor's **legend** UI
(`LegendPanel.jsx`/`MapViewerLegend.jsx`), but legend rendering is gated on an explicit
`layer['layer-type']` field (`'categories'`/`'choropleth'`/`'circles'`), which routecreation's
layer never sets — so setting `data-column` alone doesn't cause a stray "colored by tmc" legend or
any other UI leakage into the shared author-facing panel.

**`miles` does *not* need to ride along in this fix.** Checked directly: the sidebar TMC-list's
mileage/total-miles display (`RouteEditor.jsx`, already-existing code) is fed by `useRouteData.js`
(`hooks/useRouteData.js:14-41`), which fetches `tmc`/`miles`/`intersection` via a **separate**
falcor call straight against the view's own rows (`uda/pgEnv/viewsById/{view_id}/options/.../
dataByIndex`) — a completely different code path from the map-tile pipeline Part 1's bug lives in.
That query already existed, wasn't blocked by the tile bug, and doesn't need any tile-property
change to work. Whether it actually returns non-zero miles today is a live-data question (does the
shapefile view's backing table have a populated `miles` column?), not a code gap — not checked
live as part of this round.

Cleanup done in the same pass: removed stray `console.log` debug statements
(`useMapTmcHandler.js`'s `MAP_CLICK`, `dataUpdate.jsx`'s top-of-function ones) that were added
earlier in the day purely to trace this bug — no longer needed now that it's root-caused and fixed.

### Corrected/sharpened timing mechanism (see "Likely explains the timing" above — refined 2026-07-23)

Directly checked, not inferred this time: the *entire* dynamic, cols-gated tile REST route
(`dama/tiles/tiles.rest.js`) was **added new** in commit `efbdb35b` ("dama and dockerfile",
2026-04-14) — it did not exist before that commit at all. The **old** `gis-publish.js` (pre-
`efbdb35b`, read via `git show efbdb35b^:...`) had **zero logic that wrote `view.metadata.tiles`**
— it only ran `ogr2ogr` to load the GIS data into Postgres and returned view/table identifiers, no
tile-URL baking of any kind. So there was never a version of *this* code path that defaulted to
"send all columns" — the cols-gated behavior has been consistent every day since `efbdb35b` landed,
which is itself a full month **before** `routecreation.plugin.jsx`'s first commit (`efca831`,
2026-05-14, confirmed via `git log`).

Also directly confirmed: `createDamaView` (`dms-server/src/dama/upload/metadata.js:121`) always
`INSERT`s a brand-new `data_manager.views` row — views are immutable/append-only, never updated in
place. So a view's baked `metadata.tiles` is frozen forever at whatever the *live* `gis-publish.js`
did at the moment that specific view was created.

Putting these together: nothing in routecreation's own client code ever changed, and the tile
route's cols-gating behavior itself hasn't changed since before the plugin existed — so "it worked
when I built it, then broke" is best explained by the **view** the layer points at changing under
it, not the code. The most likely mechanism: the `npmrds_shapefile` source got **republished**
(e.g. a new year's TMC network upload) at some point — each publish mints a brand-new `view_id` via
the current (bare-URL) worker, regardless of anything in the plugin. If the layer's config was
originally pointed at an older view that (for whatever reason — see below) had richer tile
properties, and something repointed it at a fresher view, that would silently reproduce exactly the
observed symptom with no client-side diff to find.

One genuinely different, and separate, tile-serving path does exist in the same server:
`dama/datatypes/pmtiles.js` (`generatePmtiles`, tippecanoe-based, unchanged by `efbdb35b` — it
predates it and was only file-moved) builds a fully self-contained PMTiles file with **all**
properties embedded, no `cols=` filtering possible even in principle. But it's an **opt-in,
manually-triggered task**, not something `gisPublishWorker` runs automatically — so it only enters
the picture if someone explicitly ran it for this (or an earlier) view and pointed the layer's
`metadata.tiles` at the resulting `.pmtiles` output.

**Still not resolvable from source alone** (same caveat as before, now sharpened): confirming which
of these actually happened for the *specific* `npmrds_shapefile` view(s) in play needs a live look
at `data_manager.views` rows for that source — `created_at` per view, and whether the metadata
differs across them (e.g., an older view with a `.pmtiles` URL vs. the current one with the bare
dynamic-tiles URL). Not checked live as part of this round.

---

## Part 2 — Old tool: capability inventory (ground truth)

Source: `src/sites/npmrds/pages/route_creation/**`, `src/sites/npmrds/pages/Folders/**`, and their
imports (`src/modules/avl-map/src/**`, `src/sites/npmrds/components/**`), all in transportNY.
Confirmed both by a background agent's source read and by live-browsing
`npmrds.devtny.org` directly (already-authenticated session, no credentials needed).

### Routing / auth

- Three route entries for the creation UI, all the same `RouteCreation` component: bare
  `/route/creation`, edit-existing `/route/creation/:routeId`, create-inside-folder
  `/route/creation/folder/:folderId` — all `auth: true`, `mainNav: false`
  (`route_creation/index.jsx:55-92`).
- Folder browser has 4 route entries: `/folders`, `/folders/:stuff`, `/folders/routes`,
  `/folders/reports` — the last two are nav-visible and are just `/folders/:stuff` with a
  client-side type filter applied (`Folders/index.jsx:114-130,155-217`). All wrapped in
  `withAuth(Folders)`.
- Asymmetry: `Folders` is wrapped in `withAuth(...)` and uses a `user` prop for permission checks
  throughout; `RouteCreation` is **not** wrapped in `withAuth` and never reads `user` — the
  creation page has no permission checks of its own beyond router-level `auth: true`.

### Route organization (folders)

- Single-pane drill-down browser with a breadcrumb path, not a multi-pane tree
  (`Folders/index.jsx:23-33`, breadcrumb at `StuffInFolder.jsx:739-760`).
- Folders nest arbitrarily deep; the tree comes from one `folders2 user tree` falcor call, walked
  recursively as needed.
- Three folder **types**: `user` (personal), `group` (shared to one of the user's groups), and
  `AVAIL` (system/default). Only `user`/`group` are creatable via the UI (`FolderModal.jsx:18`).
- Folder metadata: name, type, owner, icon (fixed 9-icon palette), color. **No `editable`/
  permission-level field in the create/edit form** even though it gates permissions elsewhere (§
  Sharing below) — must be backend-assigned.
- **Real inconsistency found**: two different "create folder" entry points create at *different
  levels*. The row-level "Sub Folder" option nests under whatever folder is open
  (`StuffInFolder.jsx:811-826`); the folder-switcher's own "+ Add New Folder" button always
  creates at the **root**, regardless of current location (`StuffInFolder.jsx:704-718`).
- "Last opened folder" persists in `localStorage`, but only the **root** breadcrumb element is
  saved — a deep drill-down doesn't survive reload, only the top-level folder does
  (`Folders/index.jsx:25-30`).
- Folder contents mix five "stuff" types — `folder`, `route`, `report`, `template`,
  `batch-report` — in one listing, folders-first (`StuffInFolder.jsx:39-58`, sort order in
  `Stuff.jsx:796-823`).
- **Search**: Fuse.js fuzzy search over the open folder's `name` + `description` only
  (`StuffInFolder.jsx:151-157`). **No tagging system anywhere** (checked `RouteSaveModal`,
  `FolderModal`, `StuffInfoModal`).

### TMC selection mechanics on the map

Two mutually-exclusive **creation modes**, toggled by one "Toggle Creation Mode" button
(`RouteCreationInfoBox.jsx:92-95,136-138` → `layer.setCreationMode`, `RouteCreationLayer.jsx:63-87`):

- **`tmc-clicks` mode (default)** — click a road segment → its `tmc` feature property toggles
  in/out of the selection (`RouteCreationLayer.jsx:103-121,388-401`). A click that spans several
  stacked features adds all of them. No lasso/drag-select in this mode.
- **`markers` mode** — clicking the bare map drops a **draggable** waypoint marker
  (`addMarker`, `RouteCreationLayer.jsx:304-333`). With ≥2 markers, the client calls a
  server-side routing/map-matching endpoint (`falcor.get(["routes2","get","route", request])`) to
  snap the waypoints onto the road network and resolve them to a TMC sequence
  (`getWays()`, `RouteCreationLayer.jsx:407-430`). Dragging an existing marker recomputes the
  path. **This is the "arbitrary points, auto-route the TMCs" mode — confirmed live and by the
  user directly — and it does not exist in the new prototype at all.**
- Switching modes swaps the active map layer/Network filter (`tmc` vs `con`) and clears all
  in-progress selection state.
- **TMC Search box** (`RouteCreationInfoBox.jsx:107-130,150-165`) validates against
  `TMC_REGEX = /^\d{3}[pnPN+-]\d{5}$/` and, if valid, **zooms to that TMC's bounding box only** —
  it does **not** add it to the selection. No paste-a-list bulk-add box exists on this page.
- "Remove Last" / "Clear All" act on whichever mode is active.
- The generic map framework (`LayerContainer`) supports shift-drag box/lasso select
  (`avl-map/src/LayerContainer.jsx:289-404`), but `RouteCreationLayer` never wires
  `onBoxSelect` — **not enabled** for Route Creation specifically, even though the underlying
  capability exists in the shared map framework.
- Loading a route for edit auto-restores the right mode: `points` present → rebuilds draggable
  markers (`markers` mode); else `tmc_array` present → restores `tmc-clicks` and fetches each
  TMC's bounding box (`RouteCreationLayer.jsx:194-236`).
- The TMC layer itself has **no persistent visual styling** at rest (confirmed live — even at
  street-level zoom, no distinct overlay color) — it's a hover-driven interaction model, not a
  rendering bug.

### Visual feedback for selection

- **Color coding** via a paint expression on every visible line layer
  (`RouteCreationLayer.jsx:481-496`): selected = blue `#000099`; hovered+selected = magenta
  `#990099`; hovered (unselected) = black; everything else = gray `#999999`.
- **Marker gradient**: waypoints colored green→yellow→red by sequence position
  (`RouteCreationLayer.jsx:29,213,307-308,346-347`).
- **Hover tooltip**: hovering a TMC shows a small popup listing the TMC code(s) under the cursor
  (`HoverComp`, `RouteCreationLayer.jsx:38-50`) — explicitly **not pinnable**
  (`pinnable: false`), unlike some other map layers in this codebase.
- **TMC List sidebar panel**: every selected TMC with mileage + roadname/direction, plus a running
  **total miles** figure (`RouteCreationInfoBox.jsx:97-101,179-203,227-250`).
- **Bidirectional highlight**: hovering a sidebar row highlights the map feature and vice versa
  (`RouteCreationLayer.jsx:175-187`) — both write to one shared `highlighted` array (a minor
  shared-state coupling worth knowing about if reproducing this exactly).
- Sidebar "Layers" tab: eye/eye-slash visibility toggle + Year/Network filter dropdowns
  (`avl-map/src/components/LayerPanel.jsx:25-43,219-236`). "Styles" tab swaps basemap
  (Terrain/Dark/streets), configured in `route_creation/index.jsx:16-26`.

### Metadata captured per route

Via `RouteSaveModal.jsx`:
- **Name** (required), **Description** (optional free text).
- **Folder** (required, single-select over the full folder tree) — because it's editable on an
  already-saved route, re-saving is also how a route gets **moved** between folders.
- **Start/End Date** and **Start/End Time** (all optional, but coupled: both dates required to
  store any date metadata at all; all four required to also store times) — persisted as
  `metadata: { dates: [...] }` or `null`.
- Geometry: **either** `points` (marker lat/lngs) **or** `tmc_array` (literal TMC ids), never
  both.
- `canSave` gates the button on: name + folder present, ≥1 point/TMC, and something actually
  changed vs. the loaded route (dirty-check via `isEqual`).
- Read-only-surfaced-elsewhere fields: `created_at`/`updated_at` (system), `conflation_version`
  and `confltion_array` (sic, typo in source) — never written by any frontend call; plausibly
  populated server-side when marker-mode waypoints resolve to a TMC array. A companion Postgres
  table for exactly this, `admin2.tmc_array_cache` keyed by `(route_id, year,
  conflation_version)`, exists as pure backend DDL
  (`route_creation/tmc_array_cache.sql`) — not referenced by any JS.
- **New-prototype comparison** (`routecreation/components/SaveRouteModal.jsx:26-75`): captures
  Name, Description, Start/End Date, Start/End Time — **no Folder field at all.**

### Save / versioning / overwrite / delete

- Single mutation, `falcor.call(["routes2","save"], [data])`. If `state.id` (the `routeId` from
  the URL) is set, this **overwrites the existing row in place**; otherwise it creates a new one.
  **No version history, no drafts, no autosave.**
- Delete always goes through a shared `ConfirmModal` (previews the item(s) about to be deleted).
  Triggered per-item or in bulk from the toolbar.
- Folder delete has **no cascade/child-count check** visible in the frontend.
- "Duplicate" isn't a distinct concept in the Save modal — done via the folder browser's "Copy to
  folder" instead, which operates on the stored record directly (not a map/save round-trip).

### Bulk operations

- Multi-select via per-row checkboxes + a Select All / Deselect All master checkbox.
- Bulk actions (types each action applies to, from `ActionBar.jsx`): **Move to folder**,
  **Copy to folder** (route/report/template/folder/batch-report), **Open in Template** (routes
  only — only templates whose configured route-slot count exactly matches the selection count are
  offered), **Delete** (all types).
- Per-item equivalents on each row's "..." dropdown: Copy/Move to folder, Delete, plus
  type-specific entries (Route: "Open in New Report", "Open in Template ▸" submenu, "Edit";
  Report/Template: View/Edit; Folder: Edit). Each row also has an "i" info icon.
- **Real inconsistency found**: the bulk Move/Copy folder-picker filters out folders the user
  isn't authorized to edit into; the **single-item** Move/Copy folder-picker applies **no such
  filter** — lists every non-`AVAIL` folder regardless of edit rights.
- **CSV bulk import** — a distinct bulk-*creation* path, reachable only from the Folder browser
  (not the map page): drag a `.csv` onto an open folder. No header row; columns are `name`, start
  `MM/DD/YYYY[ hh:mm:ss]`, end `MM/DD/YYYY[ hh:mm:ss]`, pipe-delimited TMC list. Valid rows post
  via `falcor.call(["routes2","batch","upload"], [folderId, rows])`; per-row pass/fail counts
  shown. **This whole capability doesn't exist in the new prototype.**
  - **Latent bug found in this path**: the date/time regex's time-of-day group is optional, but
    the date-composing code always appends it — a row with a bare date (which passes validation)
    produces a literal `"...Tundefined"` string.

### Sharing / permissions

- Entirely folder-`type` + `owner` based — no per-user ACL or "share with…" UI anywhere.
  `user` → private; `group` → gated by the user's `authLevel` for that group vs. the folder's
  `editable` threshold; `AVAIL` → system bucket, not creatable via UI.
- The `editable` threshold is never exposed as an input in `FolderModal` — backend-assigned only.
- As noted above, the single-item copy/move picker doesn't apply the same authorization filter
  the bulk picker does — a real gap between the two UI entry points.

### Export capability

- **None found**, on either the map page or the folder browser (grepped for
  export/download/`.csv`-writing). The generic map framework does have a `saveMapAsImage`
  capability, but Route Creation's `mapActions` only wires up the zoom-to-bounds "Home" button —
  no "save as PNG" appears here. The only data-transfer direction anywhere in this feature is the
  CSV **import** above — nothing exports.

### Dead code / quirks (don't copy forward as "intended")

- `WayCache.js` is fully orphaned (its only caller is a commented-out import) — marker-mode route
  resolution now goes through the `routes2 get route` falcor call instead.
- A stray `console.log("RENDERING:", ...)` sits in the live render path
  (`RouteCreationLayer.jsx:468`).
- Commented-out filter code references a `"geography"` filter that no longer exists in the current
  filters object (only `year`/`network` remain) — an abandoned feature attempt.
- `sidebarTabPosition="side"` passed to `<AvlMap>` is a no-op prop (never read) — also true
  elsewhere in the app, a pre-existing platform-wide quirk, not unique to Route Creation.
- Two structurally different `Modal` components are used inconsistently within this one feature
  area (`~/sites/npmrds/components` version takes `isOpen`; `~/modules/avl-components/src` version
  takes `open`) — each pairing is internally consistent, just a duplicated-implementation
  footnote.

---

## Part 3 — New tool (prototype): current state

Source: `src/pages/TransportNYDataTypes/plugins/routecreation/` in transportNY. Built as a DMS
`mapeditor` plugin (the same shared pattern discussed in Part 1), not a bespoke page like the old
tool.

- **Plugin shape** (`routecreation.plugin.jsx:13-60`): `id: "routecreation"`, `type: "plugin"`,
  and the standard plugin lifecycle hooks — `mapRegister` (resolves the active shapefile layer ID
  from state and sets its `.paint` to a shared `npmrdsPaint`), `dataUpdate` (re-applies
  `.paint['line-color']` based on the current `tmc_array`, via the `["get","tmc"]` match affected
  by Part 1's bug), `internalPanel`, `externalPanel` (a no-op stub), `comp: Comp` (the actual UI,
  rendered in the map's corner — this is what "comp in the top right" in the original prompt
  refers to), and `cleanup` (currently a no-op stub, `map.off` call commented out).
- **`Comp` component** (`components... comp.jsx`): wires up `MapEditorContext`/`CMSContext`/
  `PageContext`, derives `tmc_array`/`view_id`/`searchInputTmc` from app state, and composes
  `useRouteData` + `useMapTmcHandler` (Part 1's buggy hook) + `RouteEditor` (sidebar list UI) +
  `SaveRouteModal`.
  - **Save flow** (`addItem`): builds a payload (`tmc_array` JSON-stringified, `metadata` with
    optional `dates`, formatted timestamps), calls `apiUpdate`, and on success navigates to the
    new route's page-filter URL.
  - **Load-for-edit flow**: a `useEffect` keyed on the page's route-id filter value fetches the
    route's `tmc_array`/`metadata` via falcor, populates `tmc_array` + the save-modal state, and
    zooms to the loaded TMCs' bounds. This is the "page param" the original prompt flagged as
    unverified — **the code looks complete, but is untested**, and depends on the same broken TMC
    layer to render/select against once loaded, so even if the load itself works, visually
    confirming it renders correctly is currently blocked by Part 1's bug.
- **Only one creation mode exists** — the `tmc-clicks` equivalent. There's no `markers`/auto-route
  equivalent at all (see Part 4).
- **`SaveRouteModal`** (`components/SaveRouteModal.jsx:26-75`) captures Name, Description,
  Start/End Date, Start/End Time — **no Folder field**, unlike the old tool's save modal (see Part
  2 → Metadata). Given the new tool is DMS-pattern-based rather than folder-based, it's an open
  question (not yet answered) whether an equivalent organizational concept is needed at all, or
  whether DMS's own page/dataset structure already covers it — a design-pass question, not
  something to assume either way.

---

## Part 4 — Feature gap analysis

Ranked by how concrete/significant the gap is:

1. **Marker Placement / auto-routing mode** — the old tool lets an author drop arbitrary points
   and auto-computes the TMC path between them (server-side map-matching). The new prototype only
   implements manual per-segment click selection. This is a fundamentally different authoring
   experience for corridor-style routes, not a small feature — confirmed live and directly by the
   user as the mode they actually use. **Highest-confidence, most significant gap. User decision
   2026-07-23: tackle this SOON, as the very next follow-up after the Part 1 bugfix lands — not
   deferred long-term like items below.**
2. **TMC map vintage ("year") selection** — confirmed real and significant, added 2026-07-23 per
   user's direct recollection. The old tool threads a `year` filter (`RouteCreationLayer.jsx:404`,
   default `YEARS[0]`) through nearly everything: the TMC roadname/miles/direction meta lookup
   (`RouteCreationInfoBox.jsx:54,99,242` — `["tmc", tmcs, "meta", year, [...]]`), the zoom-to-TMC
   bounding-box lookup (`RouteCreationLayer.jsx:226-227,276-281,397-399`), **the marker-mode
   auto-routing request itself** (`RouteCreationLayer.jsx:412-422` — `[JSON.stringify(locations),
   year].join("|")`, i.e. which year's road network the auto-router snaps points onto is
   itself year-selectable), and even which map layer is visible
   (`RouteCreationLayer.jsx:464-471` — `id.includes(year) && id.includes(network)`). The new
   prototype has no equivalent at all — its shapefile layer is pinned to whatever single view a
   symbology layer happens to point at. Real gap: TMC network vintages do change over time (new
   roads, realignments, TMC code churn), so an author may legitimately want to build/edit a route
   against a non-current year's map. Not yet scoped how this should surface in the DMS-pattern
   world (a second "active-layer" per year? a year selector that swaps which view_id the shapefile
   layer resolves to?) — a design-pass question for arc step 3.
3. **CSV bulk import** of whole routes (folder-browser-only, not map-page). Nothing equivalent
   exists in the new tool or its surrounding DMS patterns, as far as this investigation went.
   **Deferred — user decision 2026-07-23: leave out, at least for now.**
4. **Click/selection feedback** — hover tooltip with TMC code, color-coded selection states
   (selected/hovered/hovered+selected/default), and a TMC-list sidebar with per-segment mileage +
   running total. The new prototype's paint-based highlight (`dataUpdate.jsx`) now works following
   the Part 1 fix; the TMC-list-with-mileage sidebar (`RouteEditor.jsx`) already exists in code and
   is independent of Part 1 (see the fix note above) — worth a live check that it actually renders
   real mileage now. The hover tooltip doesn't appear to exist at all yet.
5. **Folder field in save/move** — old tool's save modal doubles as a mover (folder is editable on
   re-save); new tool's `SaveRouteModal` has no folder-equivalent field. **Deferred — user decision
   2026-07-23: don't worry about folders for a bit.**
6. **Permissions model** — old tool's folder-type (personal/group/system) + `editable`-level
   checks are untouched territory for the new prototype. **Deferred — user decision 2026-07-23:
   DMS has its own permissions model, handle this later.**
7. **Not a gap**: export capability. The old tool doesn't have one either (checked directly) — no
   need to invent this requirement for the new tool.
8. **Don't copy forward**: several of the old tool's own latent bugs (asymmetric bulk vs.
   single-item folder-picker permission filtering; inconsistent root-vs-nested folder creation
   depending on which "new folder" button is used; the CSV date-parser `"Tundefined"` edge case) —
   these are bugs in the tool being replaced, not intended behavior worth preserving.

### Auto-routing follow-up — existing lead, found and confirmed 2026-07-23

User recalled that during the `old_reports_conversion` task, a prior session built tooling that hit
the **old routing API** to translate old routes' points into a TMC list. Initial grep missed it
(wrong search terms); user pointed at `scratchpad/` and `convert_old_reports.py` directly, and it's
in the latter:

- `scripts/convert_old_reports.py:3829`, `resolve_tmc_array(route_id, years, gaps)` — resolves a
  point-drawn old route (one with `points` but a null `tmc_array`) to actual TMCs, **per year**,
  by calling `old_falcor_get([["routes2", "id", [route_id], years, "tmc_array"]])`. Docstring:
  "the same server-side resolution the old client used." Ties directly into the Part 4 "year" gap
  above — this call is explicitly year-scoped, and the script itself logs a `gap` when a route's
  resolved TMC set differs across years (`tmc_array_varies_by_year`), i.e. this is empirically
  confirmed to actually happen, not just theoretical.
- `scripts/convert_old_reports.py:1611`, `old_falcor_get(paths)` — the transport for the above:
  a plain HTTP GET against `https://graph.availabs.org/graph?paths=...&method=get`, **no auth
  token, no VPN** (unlike the `dms()` helper right above it in the same file, which does attach
  `DMS_AUTH_TOKEN`). This is the live *old production* falcor API, publicly reachable.

**Caveat for reuse**: this specific call (`routes2 id [route_id] [years] tmc_array`) resolves an
**already-existing** old route by its old numeric ID — it's a read-back of a resolution the old
system already computed, not a general "here are raw points, map-match them" call. The actual
general-purpose endpoint the old tool's live map UI calls for a **brand-new** marker-placed route
(no pre-existing old route_id) is the different one already cited in Part 2:
`falcor.get(["routes2","get","route", request])` (`RouteCreationLayer.jsx:407-430`, the `getWays()`
call). Not yet confirmed whether that second endpoint is *also* reachable the same
no-auth/no-VPN way via `graph.availabs.org` — worth checking with the same `old_falcor_get` pattern
before assuming it needs different plumbing.

---

---

## Part 5 — Auto-routing endpoint, investigated and confirmed live (2026-07-23)

Goal: resolve the open question from Part 4's "Auto-routing follow-up" — is the old tool's
brand-new-route map-matching call reachable/reusable for the new prototype, and what does it
actually need.

### Where it lives (not in dms-server / dama at all)

The client call cited in Part 2 (`falcor.get(["routes2","get","route", request])`,
`RouteCreationLayer.jsx:407-430`) is served by **`avail-falcor`** (a third repo,
`/home/ryan/code/avail-falcor` — the falcor backend behind `npmrds.devtny.org`, wired to the *old*
`npmrds_production` Postgres DB, schema `admin2`/`conflation`). This is a completely separate
service from `dms-server` (which is what the new DMS-pattern prototype talks to). Route definition:
`routes/folders2.route.js:480`, `{ route: 'routes2.get.route[{keys:requests}]', get: ... }` — **no
`this.user` auth check** on this route (unlike `routes2.save`/`routes2.delete`/`routes2.batch.upload`
right next to it, which all throw `"No Authorization"` without one).

Handler chain: `Controller.processRouteRequests(requests)` (`services/folders2Controller.js:1057`)
parses each request string as `"<JSON locations>|<year>"`, calls `getRoute(locations, year)`
(`folders2Controller.js:565-588`), which does a plain HTTP POST straight through to an **external,
independently-hosted map-matching microservice**:

```
POST https://routing2.availabs.org/route?conflation_map_version={year}_{version}&return_tmcs=1
Content-Type: application/json
Body: { "locations": [ { "lat": <num>, "lon": <num> }, ... ] }
```

`version` defaults to `CONFLATION_VERSION = "v0_6_0"` (`folders2Controller.js:10`). Response is
`{ "ways": [ "<tmc_id>", ... ] }` (or `{"err":{...}}` if no match found for those points/that
year's network).

### Confirmed live, end-to-end, using real production data

Queried `admin2.routes` (via `dbq.py old`, VPN-gated) for a route whose `admin2.tmc_array_cache`
already had a resolved result — route `268046`, year 2022, cached `tmc_array =
["120N05838","120-05837","120N05837","120-05836"]`. Replayed its exact stored `points` directly
against `https://routing2.availabs.org/route?conflation_map_version=2022_v0_6_0&return_tmcs=1` from
this machine (no VPN active for this specific call, no auth header of any kind) and got back:

```json
{"ways":["120N05838","120-05837","120N05837","120-05836"]}
```

**Byte-for-byte identical to the cached resolution.** This confirms: the endpoint is reachable with
zero authentication and zero VPN requirement (VPN was only needed to *read the DB* for a realistic
test case, not to call the routing service itself), the request/response contract above is correct,
and the underlying map-matching logic itself is unchanged/still live.

**CORS is wide open**: sent the request with `Origin: http://sandbox.localhost:5174` (the new
prototype's actual dev origin) and got back `access-control-allow-origin:
http://sandbox.localhost:5174` (reflects whatever origin is sent) plus `vary: origin` — i.e. this
isn't just server-reachable, a **browser can call it directly** with no proxy needed, same as any
same-origin fetch. (Two arbitrary nearby-but-off-network points were tried first and correctly came
back `{"err":{}}` — not a request-format bug, just no matching road for those specific coordinates.)

### New architectural wrinkle this surfaces (not previously known)

The "which years/versions are valid" metadata (`conflation.conflation_map_versions_meta`,
`conflation.conflation_map_osm_version` — what `getLatestConflationVersion`/`getConflationYears`
query in `folders2Controller.js:590-613`) lives **only** in the old `npmrds_production` DB. Checked
directly: neither the new DMS content DB (`dbq new`, `dms3`/`dms_npmrdsv5`) nor the dama DB (`dbq
dama`, `npmrds2`) has a `conflation` schema at all. So if the new tool wants to *dynamically*
discover valid years the same way the old tool does, that's a brand-new cross-DB dependency
dms-server has never had — versus just hardcoding the known-stable `v0_6_0` + a year range (which
has been unchanged since before `routecreation.plugin.jsx` existed, per Part 1's timing analysis).
This is a real design fork, not a formality — flagging for arc step 3/4 rather than deciding here.

### What this means for scoping auto-routing (arc step 3 inputs, not yet decided)

- **No new server-side endpoint is strictly required.** The new prototype's `Comp`/map-click hook
  could call `routing2.availabs.org` directly from the browser, same contract as above. A thin
  dms-server proxy route is still an option (consistency with "client talks only to dms-server",
  room to add server-side caching like `admin2.tmc_array_cache` later) — but it's an *architectural
  choice* now, not a hard requirement discovered by this investigation.
- **Year selection is not a separate, deferrable concern from auto-routing** — it's a hard
  precondition. The routing call itself is `{year}_{version}`-scoped; there is no year-agnostic way
  to call it. Part 4 items 1 and 2 (auto-routing, TMC-vintage/year) are the same design problem, not
  two sequential ones — whatever UI/state answers "which year is this route being built against"
  has to exist before auto-routing can fire at all.
- **Version (`v0_6_0`) can likely be hardcoded** for now — stable across the entire time window
  Part 1's investigation covered, and not surfaced as a user-facing choice anywhere in the old tool
  either (it's an internal implementation constant there too, not a dropdown).
- Marker UI itself (drop pin, drag to reposition, gradient-by-sequence coloring, recompute on
  add/move/remove) is presentational work with a clear reference implementation already fully read
  in Part 2 (`RouteCreationLayer.jsx:304-430`) — no open questions there, it's a matter of porting the
  interaction pattern into the plugin's existing `useMapTmcHandler`-style hook structure.

---

## Part 6 — Arc step 3 design decisions (2026-07-23)

Two of Part 5's three open forks are now **decided** by the user, plus a follow-up investigation
that resolves a wrinkle in the second decision.

### Decision 1: dms-server proxy, built swappable

User: go with the dms-server proxy for now, but "build with that in mind" — the routing call is
very likely to move onto a new, not-yet-built in-house software stack later, replacing
`routing2.availabs.org` entirely. **Implication for implementation**: the proxy route's handler
should isolate the `routing2.availabs.org` call behind a single function boundary (e.g. one
`resolveRoute(locations, year)`-shaped module) that the falcor/REST route calls — so swapping the
backing implementation later is a one-function edit, not a scattered refactor across route
registration, request shaping, and response parsing. Don't spread knowledge of the external URL or
its request/response contract beyond that one module.

### Decision 2: year list sourced from the new system's own NPMRDS metadata, not old `conflation`

User: unsure the new toolset even has a "conflation" concept — it works off the official TMC
identification shapefiles instead — and the year range should be pulled dynamically from
already-tracked NPMRDS source metadata, pointing at `src/dms/documentation/npmrds-data-sources.md`.

That doc's "Per-year TMC geometry tile views" table (confirmed live 2026-07-14, reproduced there)
already lists a `view_id` for **every year 2016-2026** across source 582 (`npmrds_v6`,
shapefile-enhanced, current gen — missing only 2016) and source 215 (older gen — covers 2016 but
stops at 2024). Both live in `npmrds2`/dama, the DB the new stack already talks to — **no new
cross-DB dependency needed**, resolving Part 5's flagged wrinkle.

**Claimed verified live 2026-07-23, since found to be WRONG (corrected 2026-07-23, same-day
implementation round)**: this section originally claimed, based on querying the old prod DB's
`conflation.conflation_map_osm_version` for every year with a `v0_6_0` row, that all of
2016-2026 (11 years, no gaps) were usable. **That query only checked that a DB metadata row
exists per year — it never called the live routing service.** Directly testing
`routing2.availabs.org` with real coordinates (a two-point I-90 corridor near Albany, tested
against years 2016/2018/2020/2021/2022/2023/2024/2025/2026) found **only 2020, 2021, and 2022
actually resolve** — every other year tested, including the ones on both sides (2016/2018 *and*
2023-2026), returned `{"err":{}}` for the identical points. So the DB row's existence does not
mean the routing service can actually route against that year — a real, disproven assumption,
not just an update. **Implication for Phase 3**: the year list can't just be sourced from
source-582/215's per-year metadata as originally planned — it needs to be filtered down to (or
cross-checked against) years the routing service actually supports, which on this one data point
looks like a narrow 2020-2022 window, not the full shapefile-vintage range. Only one location was
tested; the true usable range needs verifying across multiple points before Phase 3 is designed
around it. Until then, `2022` is the safest placeholder (doubly-confirmed: this test, and the
original Part 5 replay of route 268046).

### New wrinkle surfaced while grounding this: "year" isn't an existing concept in the plugin today

Checked how the routecreation plugin currently resolves its map layer
(`routecreation/constants.js:5`, `SHAPEFILE_LAYER_KEY = "npmrds_shapefile"`; read in
`comp.jsx:70-73`, `routecreation.plugin.jsx:33-58`, `dataUpdate.jsx:30-34`,
`useMapTmcHandler.js:6`): the plugin looks up **one specific symbology layer by that fixed key**
in `state.symbology`, and reads whatever single `view_id` an author manually attached to it via the
generic `SourceSelector` UI when building the map page. There is **no year concept anywhere in the
plugin's own code** — the "year" of the network an author sees is implicitly whatever view an
admin happened to pick once, with no switching mechanism. This means auto-routing's year selector
is genuinely new state to add, not a retrofit of an existing year mechanism — but it also raises a
real UX question not yet answered: **should picking a year in the new auto-routing UI also swap
which `view_id` the visible shapefile layer points at** (so the map an author sees matches the
network year they're routing against), **or does it only affect the invisible routing-service call**
while the map keeps showing whichever static view an admin configured? This is Part 4 item 2's gap,
now concretely in scope of the auto-routing design rather than a separate later problem.

### Still open (Decision 3, unblocked but not yet asked)

Whether the proxy's version constant is hardcoded `v0_6_0` (Part 5's original recommendation) is
implicitly still the plan — the user's Decision 2 answer only addressed the *year* half of that
fork, not version. Nothing in Decision 2's answer contradicts hardcoding version; carrying that
forward unless corrected.

### Decision 4: year selection swaps the visible map layer too

User: yes — picking a year re-points the shapefile layer's `view_id` at that year's published view
(source 582, falling back to source 215 for years 582 lacks — currently only 2016, per the
`npmrds-data-sources.md` tile-view table), not just the invisible routing-service parameter. Author
clicks against the same TMC network the auto-router snaps to, always in sync. This means the year
selector's state has to drive **two** things on change, not one: (a) which `view_id` the
`npmrds_shapefile` symbology layer's `.view_id` resolves to (re-triggering the same
`getLayerTileUrl` rebuild machinery Part 1 traced), and (b) the `{year}` sent to the new
dms-server proxy route.

### Mechanism for Decision 4, found in existing docs — not a new invention

`src/dms/skills/editing-map-symbologies.md` (the headless symbology-editing reference — read
2026-07-23 at the user's pointer) §5 already documents the exact recipe: **"Repoint a layer to a
new view/source"** — fetch the target view's `metadata.tiles` from `data_manager.views`, then
replace `sources[]` (re-suffixed `_${layerId}`), `view_id`, `source_id`, and each sub-layer's
`source`/`source-layer`. Critically, that recipe does **not** touch `data-column`, `layers[].paint`,
or any of the other per-layer config — meaning the year-swap mechanism is fully orthogonal to
Part 1's fix (`data-column: 'tmc'`), which lives on the LAYER object untouched by a repoint. No
interaction risk between the two: swapping years mid-session should not require re-applying or
re-deriving the click-identity fix.

Also from that doc, confirmed **not applicable** here (so not extra work): `interactive-filters[]`
snapshot duplication and `legend-data` sync only matter for layers using those features —
routecreation's shapefile layer uses neither (no interactive filters, no `layer-type` set, so no
legend rows render for it per the "Legend rows are gated by `layer-type`" gotcha, consistent with
Part 1's "verified no side effect" note). The repoint is a plain single-layer `sources`/`view_id`
swap, nothing more elaborate.

One thing this doc surfaces that Part 6 hadn't considered: the doc's §1 "TWO homes" distinction
(catalog item vs. section's embedded copy — "rendering reads ONLY the copy"). The routecreation
plugin operates on `state.symbology` at runtime, which is the **embedded copy** on whatever page/
section it's mounted in — so the year-swap code path is a runtime `setState` on the embedded copy
(same shape Part 1's fix already uses, `symbologyLayerPath[...]`), not a catalog-item edit. No
open question here, just confirming which of the two homes applies (the runtime one) so a future
implementer doesn't second-guess it.

### Mechanism for Decision 4 is largely already built — "View Filter Group" (2026-07-23)

User flagged that a "View Filter Group" control might already let an author swap which DAMA view
backs a map layer, making Decision 4's mechanism close to free. Investigated — real, but with an
important nuance about *which* copy applies:

The runtime "pick a view from a pre-configured group, live-swap the tile source" mechanism
(`layer.viewGroupEnabled` + `filter-source-views` list, authored via
`mapeditor/MapEditor/components/LayerEditor/ViewGroupControl/index.jsx`) exists in **three
independent copies**, not one shared implementation:
1. The author-side editor control (`ViewGroupControl`) — lives in the shared `mapeditor` pattern,
   used to build the group regardless of where it's consumed.
2. `patterns/page/.../ComponentRegistry/map_dama/MapManager/MapManager.jsx` (~line 231-278) — the
   runtime `<select>` for the **legacy** `Map: Dama Map` page-section type. Swap logic: string-replace
   `layer.view_id` with the new value across the layer's `layers[]` and `sources[]` JSON, then set
   `view_id` — a plain in-place repoint, no re-fetch of `metadata.tiles` needed since only the
   `view_id` token changes inside an otherwise-identical tile URL template.
3. `patterns/mapeditor/MapEditor/components/MapViewerLegend.jsx` (~line 628-660) — a **separate,
   independent copy of the same runtime dropdown**, but this one belongs to the `mapeditor` pattern's
   own authoring page (the actual `/edit/...` route), not to either page-section type.

**Checked directly against `map-component-unification.md`** (2026-07-23, per the user's "we use
`map` only nowadays" concern): the current `map` page-section type genuinely does **not** have this
control — explicitly listed as deferred / "no current consumer" (lines 45-46, 82: "Unique-to-
map_dama/: ... view-group selector"). So for a *page-embedded* map, this really is a `map_dama`-only,
legacy-only feature today — a real gap, not something to build on for future `map`-section work.

**But that gap is irrelevant here.** Routecreation is a **mapeditor plugin**, not a `map`/`map_dama`
page-section — it runs inside the mapeditor pattern's own authoring page, which uses copy #3
(`MapViewerLegend.jsx`), independently of the `map`/`map_dama` split entirely. And copy #3 already
has a purpose-built escape hatch for exactly this scenario:

```js
if (layer.viewGroupEnabled && !isLayerControlledByPlugin) { /* render generic dropdown */ }
```

`isLayerControlledByPlugin` (`MapViewerLegend.jsx:427-428`) checks whether any plugin's
`state.symbology.pluginData[pluginName]['active-layers']` claims this layer id — which
routecreation's layer already does (it's how `SHAPEFILE_LAYER_KEY` resolution works today, Part 6).
So the platform was already built anticipating "a plugin wants to own this layer's view-switching
itself, instead of the generic picker" — routecreation doesn't need to fight or duplicate this
system, just reuse its swap primitive (`MapViewerLegend.jsx:645-659`, ~15 lines: JSON-stringify +
`replaceAll(oldViewId, newViewId)` across `layers[]` and `sources[]`, already proven in production)
from its own year-change handler instead of showing the generic dropdown. **This means implementing
the "swap the visible layer's view_id" half of Decision 4 is a matter of porting ~15 already-working
lines, not designing new mechanics.**

### Arc step 3 status: core architecture decisions complete

All four forks from Parts 5-6 are now resolved (proxy w/ swappable boundary; year sourced from new
stack's own metadata; version hardcoded; year selection swaps the visible layer). What remains
before arc step 4 (scope/plan) can start is mechanical, not decisional: picking the exact
proxy-route shape/name, the plugin-level state additions (selected year, marker list, mode toggle),
and porting the marker-UI interaction pattern from `RouteCreationLayer.jsx:304-430` — no more open
product questions identified as of 2026-07-23.

---

## Open questions / next steps

- **Done 2026-07-23**: Part 1 bug fixed via option (a), **user-confirmed live**, and **committed**
  in transportNY.
- Live-check candidate, downgraded from blocking to informational: whether the *specific*
  `npmrds_shapefile` view(s) in play have multiple published versions with differing tile metadata
  (see "Corrected/sharpened timing mechanism" in Part 1) — interesting for understanding the
  history, no longer needed to justify the fix itself, since option (a) works regardless of why it
  broke.
- **Done 2026-07-23**: auto-routing endpoint found, traced, and confirmed live end-to-end against
  real production data (Part 5) — reachable with no auth/VPN, CORS-open, contract fully documented.
- **Decided 2026-07-23 (Part 6)**: dms-server proxy (built as a swappable single-module boundary,
  anticipating a future in-house replacement for `routing2.availabs.org`); year list sourced from
  the new stack's own NPMRDS per-year source metadata (`npmrds-data-sources.md`'s source 582/215
  tile-view table), not the old `conflation` schema. Version (`v0_6_0`) hardcoded. Selecting a year
  also swaps the visible shapefile layer's `view_id`, via the already-built `MapViewerLegend.jsx`
  view-group swap primitive (its `isLayerControlledByPlugin` opt-out exists for exactly this case)
  — confirmed close to free, not a new mechanism, per the "View Filter Group" investigation.
  **The "this year range fully overlaps what the routing service covers" half of this decision was
  WRONG — see the correction inside Part 6 (under Decision 2) and the next bullet.**
- **Done 2026-07-23**: arc step 4 (scope/plan) complete —
  `src/dms/planning/tasks/current/routecreation-marker-placement-autorouting.md` has the phased plan
  (Phase 1 dms-server proxy, Phase 2 marker UI, Phase 3 year selector), files-likely-touched list,
  testing checklist, and flagged open implementation-time decisions.
- **Done 2026-07-23 (same-day, 4th round)**: user agreed Phase 1 (proxy) can wait since it's
  genuinely decoupled — started **Phase 2 (marker mode) in transportNY ahead of Phase 1**, using a
  temporary direct client call to `routing2.availabs.org` (isolated in `hooks/resolveRoute.js`,
  swappable to the real proxy later). Core mechanics (drop/drag/gradient/mode-toggle/remove/clear)
  implemented and live-verified. One real bug found+fixed: `setCreationMode` ran side effects
  inside a React state-updater callback (invalid — updaters must be pure), throwing "Cannot update
  a component while rendering a different component"; fixed by moving the side effects into the
  event handler.
- **Real bug found 2026-07-23, same round**: the year range claim above (2016-2026 "confirmed") was
  wrong — it was based on a DB metadata table having a row per year, never an actual call to the
  live routing service. Directly testing `routing2.availabs.org` with real coordinates (I-90 near
  Albany) across 2016/2018/2020/2021/2022/2023/2024/2025/2026 found **only 2020-2022 actually
  resolve** — every other year tested returns `{"err":{}}`. Fixed the immediate placeholder
  (`DEFAULT_ROUTING_YEAR`) to `2022`. After the fix, the full markers→resolve→TMC pipeline was
  verified live end-to-end: 2 markers near Albany/Schenectady resolved to a real path (CR-90/Vischer
  Ferry Rd, Moe Rd, I-87 — 11.653 total miles), rendered as a red highlighted line on the map, and
  listed with mileage in the sidebar, exactly like tmc-clicks mode. **Only one location has been
  tested** — the true usable year range needs checking across more points before Phase 3's year
  selector is designed; don't assume 2020-2022 is universal without more testing.
- **Next up**: Phase 1 (dms-server proxy) — still not started, and now the actual blocker before
  the temporary direct client call can be retired. Separately, Phase 3's year list design needs
  redoing given the year-range correction above.
- Reconcile the dms submodule divergence between transportNY and dms-template (user's own planned
  branch move) before landing any library-level fix from Part 1 — moot for now since option (a) is
  plugin-local, not a library change, but will matter again if (b)/(c) are ever revisited.

---

## Part 7 — "Routes Data" table shows new routes on one report page but not another (2026-07-24)

### Question

User noticed the "Routes Data" table section appears on both
`sandbox.localhost:5173/edit/demo_reports` (page id `2110490`) and
`npmrds.localhost:5173/edit/converted_reports/page_13` (page id `2195787`), both apparently reading
`view_id 2107427` per network requests — and asked whether they're really the same dataset, since a
route added via the routecreation tool only ever shows up in the sandbox table.

### Confirmed: yes, genuinely the same dataset, and the write lands in the right place

Read both pages' saved section JSON directly from `dms_npmrdsv5.data_items` (via `dbq.py new`).
Both "Routes Data" sections are `"element-type": "Spreadsheet"` with a byte-for-byte identical
`externalSource` block: `source_id: 2107426`, `view_id: 2107427`, `env: "npmrdsv5+routes_data"`,
same near-no-op filter (`description like " "`). Per `internal-datasets-overview.md` / the
submodule's split-table convention (`type.endsWith(':data')` → `data_items__{sanitized_type}`), the
actual row data for this view lives in one physical table:
`dms_npmrdsv5."data_items__s2107426_v2107427_routes_data"` (64,797 rows). Queried it directly,
sorted by `id desc`: the two routes created during this session's live marker-mode testing (Part
6's "2 markers near Albany/Schenectady" test) are right there —
`id 2195782 "marker_route"` (2026-07-24 08:55) and `id 2195795 "new_route_test"` (2026-07-24
09:07). **The routecreation tool's writes are correctly landing in the one shared table both pages
are configured to read.** This is not a write-target/dataset-divergence bug.

(Found two unrelated, harmless-looking orphaned split tables while searching —
`data_items__s2102215_v2103381_routes_data` (4,033 rows, source/view ids no longer exist in
`data_items`, an old deleted-and-recreated "Routes Data" source) and
`data_items__s2107426_vundefined_routes_data` (2 rows, `type = 'routes_data|undefined:data'`,
rows named "TestSave"/"TESTINGFOREAL" from May 2026) — the latter shows the routecreation save path
*has* historically resolved `view_id` to literal `undefined` at least once, but that's old data, not
implicated in today's symptom, and not investigated further.)

### Root cause of the actual symptom: page_13's Spreadsheet section is missing `fetchMode: "force"`

Dispatched an Explore agent to trace the Spreadsheet element's data-loading code
(`patterns/page/components/sections/components/ComponentRegistry/spreadsheet/`,
`dataWrapper/useDataLoader.js`). Confirmed:

- demo_reports' Spreadsheet section (`id 2172600`) has `display.fetchMode: "force"`.
- page_13's Spreadsheet section (`id 2195786`) has **no `fetchMode` key at all**, and no
  `readyToLoad: true` either.
- `useDataLoader.js:245-249`: `fetchMode = display?.fetchMode ?? (display?.readyToLoad === true ?
  'smart' : 'cache')`. With both absent, this resolves to `'cache'`.
- In `'cache'` mode, View-mode `readyToLoad` is `false`, and the load effect
  (`useDataLoader.js:253-254`) returns immediately without ever calling `getData`/`apiLoad`. The
  section just renders whatever `data` array was frozen into its saved JSON the last time an author
  had it open in Edit mode (Edit mode always force-fetches on its own, independent of this flag;
  View mode never does when `fetchMode` is absent/`'cache'`).
- `'force'` mode bypasses both the `readyToLoad` gate and fetch dedup, and `api/index.js:274-277`
  unconditionally invalidates the relevant `uda` Falcor path before every such fetch — so
  `'force'` sections always see live data, `'cache'` sections never do in View mode. No shared/stale
  Falcor cache is involved; it's purely this per-section config flag.

This fully explains the reported symptom, including "I refreshed the table by hand by clicking the
icon, no effect" — page_13's Spreadsheet never fetches at all in View mode regardless of any
refresh affordance, since the effect that would call `getData` returns before doing anything.

### Fix applied to the "Report Page" page template (2026-07-24)

User applied the `fetchMode: "force"` fix to page_13 directly (confirmed live in the DB), then asked
for two things to be carried into the **page template** used by "Add New Page" so future pages don't
need the same manual fix: (1) `fetchMode: "force"`, (2) an `updated_at` column on the Routes Data
table, sorted newest-first ("z-a").

Applied directly to `dms_npmrdsv5.data_items` id `2187021` (type `npmrds_sub|page_template`, name
"Report Page") via `dms raw update 2187021 --data <file>` (full replace of the `draft_sections` top-
level key only — shallow-merge at the top level leaves `name`/`slug`/`sidebar`/etc. untouched). The
template's 3rd embedded section (`element-type: Spreadsheet`, title "Add a Route to Your Report") now
has `display.fetchMode: "force"` and a `updated_at` column (`sort: "desc nulls last"`) appended to its
`columns` array. Verified by reading the row back from the DB directly. Templates apparently store a
fully self-contained deep copy of their sections (not `{id,ref}` pointers like a page does) — editing
the template doesn't touch any already-created page.

**Discrepancy found while doing this**: page_13 itself (both its draft section `2195786` and its
currently-published section `2195798`, re-checked live) has the `fetchMode: "force"` fix but **not**
the `updated_at` column/sort — despite the user describing both as already done on that page. Used
the already-proven `updated_at` column shape from the sandbox demo_reports table (same dataset,
already live there: `type: text, formatFn: date, sort: "desc nulls last", justify: left,
valueFontStyle/headerFontStyle: caption`) as the reference instead of page_13 itself. Worth the user
double-checking page_13 got saved/published with that column if they want it visibly there too — as
of this check it doesn't have it yet.

**Related artifact found, then also fixed same day**: a separate, reusable **section template**
`add_route_to_report` (`id 2187290`, type `npmrds_sub|spreadsheet_template`) is what this Spreadsheet
section was originally stamped from (per its embedded `_appliedTemplate` provenance metadata, dated
2026-07-01) — it had the identical two gaps (no `fetchMode`, no `updated_at` column). Different
storage shape from the page template: state lives in a `stateJson` string field (columns/display/
filters/customBuckets/externalSource), not an embedded `draft_sections` array. Patched the same way
(`dms raw update 2187290 --data <file>`, full replace of the `stateJson` key only) — verified
read-back from the DB, both `display.fetchMode: "force"` and the `updated_at` column (`sort: "desc
nulls last"`) are now present. User also confirmed the same day that page_13 itself now has the
`updated_at` column added directly (resolving the earlier discrepancy noted above).

**Status: both template artifacts (page template `2187021` and section template `2187290`) now carry
both fixes. No further known copies of this gap.**
