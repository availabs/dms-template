# Routing API & plugin — task plan

Companion to [ROUTING_TASKS.md](ROUTING_TASKS.md) (the original routing-initiative plan/status)
and [ROUTING_LOG.md](ROUTING_LOG.md) (the chronological narrative). This doc is one level more
concrete: it's specifically about building the **routing server/service + DAMA source + map
plugin**, now that the underlying data (persisted relations, confirmed pgRouting approach) exists.
Read ROUTING_LOG.md first if anything here references a result without re-explaining it.

**This work will eventually live outside this conflation repo** (per the user, 2026-08-03) — the
server-side piece belongs with `avail-falcor` (the DAMA API server), the UI piece belongs with
`dms-template` (the map/frontend). This doc stays here for now as the planning artifact until
that move happens; treat it as ready to relocate wholesale.

---

## The core problem, restated plainly

Routing is not just "a path between 2 points" — the conflation matcher's existing pathfinder
already does that, weighted only by physical length, and it isn't enough:

1. **The shared-node ambiguity.** A two-way road's both directions share the same two OSM node
   ids (just `from_node`/`to_node` swapped). A plain node-to-node search has no memory of which
   directed edge it arrived on, so it can't tell "continue straight" from "illegally reverse
   course" — turn legality is a property of the **pair** of edges, not the node. **This is solved**
   — traced end-to-end this session (see ROUTING_LOG.md's "shared node" entry): both directions
   are already distinct rows in the `edges` table, so an edge-expansion search (or any search that
   carries the previous edge as state) resolves it correctly. The **relations table** (persisted,
   TASKS.md #14) is what supplies the actual `from`/`via`/`to` restriction data this search needs
   to know *which* transitions are illegal.
2. **Attribute-level routing.** A real route has to respect one-way streets, truck/weight/height
   restrictions, and prefer higher-functional-class roads where sensible — not just find *any*
   physically-connected path. This is ROUTING_TASKS.md Task 2 (way tags: `access`/`hgv`/
   `maxweight`/`maxheight`/`turn:lanes` — **still not captured anywhere**, discarded at load time)
   plus the already-available TMC/RIS enrichment columns (`tmc_isprimary`, `tmc_f_system`,
   `ris_functional_class`, etc. — confirmed present on the published conflation table). Some of
   these should be **hard filters** (a weight limit either allows or excludes a truck-mode query),
   others **soft costs** (prefer primary roads, don't forbid others) — per ROUTING_TASKS.md Task 3.

**Main goal:** a server/process, registered as its own DAMA source, that takes an existing
conflation source+view as input (single source/view for v1 — **2024**, confirmed 2026-08-03) and
returns the shortest/best path between two user-supplied points.

---

## Decisions confirmed 2026-08-03

- **Input contract: coordinates, not IDs.** The user drops points anywhere on a map — they don't
  necessarily correspond to a pre-rendered, clickable feature with a known id. Send
  `{ source: {lat,lon}, dest: {lat,lon} }` (or equivalently a GeoJSON `Point` pair). This also
  matches the existing external routing convention already live in this org
  (`routing2.availabs.org`'s `{ locations: [{lat,lon}, ...] }`), not just our own preference.
- **Transport: a dedicated API endpoint, not a tile server.** A tile server serves identical
  precomputed data per z/x/y tile; a route between two arbitrary points is unique per request and
  can't be pre-tiled. Response should be a GeoJSON `LineString` feature (matches
  `avail-falcor`'s existing `osm.routing.js` response shape: `{ ok, result: { feature } }`), which
  the map plugin adds directly as a MapLibre `geojson` source — no tiling needed for a single
  route's geometry.
- **pgRouting vs. custom JS — leaning pgRouting (`pgr_trsp`), not settled.** Full-scale test
  results (ROUTING_LOG.md): `pgr_trsp` completed a real 150mi query (9.66M edges, 13,964 real
  restrictions) in 62s. The `graphology` **library** crashed at the same scale — a hard V8 `Map`
  size limit while building the edge-expansion graph, not a tuning problem. `pgr_turnRestrictedPath`
  (the newer-looking pgRouting function) is separately confirmed **broken** (doesn't reroute
  around a forced restriction in a synthetic test). **Not fully settled**: a hand-rolled
  (non-`graphology`) adjacency-list Dijkstra — plain arrays/typed arrays instead of `graphology`'s
  object-based `Map` structure — has not been tried and could still be viable; `graphology`
  specifically (the library) is disqualified, not "custom JS" as a category.
- **New, separate map plugin — not extending `routecreation`.** `dms-template` already has a
  `routecreation` plugin (waypoint markers → auto-resolve path via the external routing service),
  but its job is authoring/saving named multi-point TMC routes — a different feature than a
  focused "shortest path between 2 points" query. Build a new, separate plugin;
  `routecreation` can point at the same backend later if useful, but isn't being extended now.

---

## Task breakdown

### A1. Decide where the server-side routing computation actually lives
`avail-falcor` already has `dama/routes/data_types/pgr/` — real, wired-in Express routes
(`POST /dama-admin/:pgEnv/pgr/routing`, `/osm/routing`, `/osm/isochrone`, `/osm/rerouter`) using
the exact "conflation view → `_nodes`/`_edges`" convention we already produce. But it has real,
specific problems (ROUTING_LOG.md-adjacent findings, recorded here since they're from the same
dig): the batch/DAMA-worker route (`pgr.worker.js`) is broken (references a nonexistent
`pgr.worker.mjs`, invalid CJS/ESM-mixed syntax), nearest-edge snapping hardcodes one global table
(`osm_datasets.edges`) instead of the per-view table it just resolved, and heavy geoprocessing
runs synchronously inline in the request handler instead of via the task queue.
**Decision needed:** fix/extend this existing data type, or build fresh elsewhere. Fixing reuses
a real, if flawed, foundation; building fresh avoids inheriting its specific bugs and the
three-different-routing-engines history in that repo (pgRouting SQL-pushdown, `graphology`,
`ngraph`, accumulated over time — see ROUTING_LOG.md for the full history).

### A2. Implement the point-to-point route endpoint
Using `pgr_trsp` (confirmed correct, see Decisions above) against 2024's published
`temp.osm_conflation_1_2024_edges`/`_nodes`/`_relations`:
- Reuse the validated nearest-node snapping query (GIST index, `ORDER BY wkb_geometry <-> ...`,
  confirmed 41ms/44m-11m accuracy this session).
- Reuse the validated restriction-building query (single-node-`via` relations → edge-id pairs,
  confirmed 13,964 real restrictions, 8.9s to build for 2024).
- Return a GeoJSON `LineString` feature, per the Decisions section above.
- **Fix, don't repeat**, the per-view snapping bug found in `avail-falcor`'s existing code (A1) —
  snap against the SAME year/view's edges table the request is scoped to, not a hardcoded global.

### A3. Multi-way `via` chain restrictions — not yet handled
1,540 of 2024's 21,018 relations have a multi-way `via` (a chain of ways, not a single node) —
excluded from every restriction-building query run so far (dry run and full-scale test alike).
Needs its own query shape (chain of edge ids, not a single from/to pair) before real routing can
claim full restriction coverage.

### A4. Attribute-based costing/filtering — depends on ROUTING_TASKS.md Task 2
Can't hard-filter truck/weight/height until `access`/`hgv`/`maxweight`/`maxheight` are actually
captured at load time (Task 2, not started). Soft-cost preference for `tmc_isprimary`/
`tmc_f_system`/`ris_functional_class` could start sooner since those columns already exist on the
published conflation table today.

### A5. Register the routing output as its own DAMA source
Per the original end-goal (ROUTING_TASKS.md) — register whatever the routing service produces
(or at minimum, the service's existence/config) as a DAMA source that references the conflation
view it was built from as input, so it's traceable which year/version a routing query used.

### B1. Fix the `dms-template` submodule before any plugin work
`src/dms` is stuck ~10 days behind the committed pointer in the current working tree — the
`theme.mapPlugins` auto-registration wiring isn't present until `git submodule update` is run.
Nothing registers without this; do it first, not as an afterthought.

### B2. Build the new map plugin
Following the existing `PluginLibrary`/`RegisterPlugin` contract (object shape:
`mapRegister`/`dataUpdate`/`comp`/`internalPanel`/`externalPanel`/`cleanup`) and mirroring
`routecreation`'s file structure as the closest working example (`<name>.plugin.jsx`, `comp.jsx`,
`internalPanel.jsx`, `dataUpdate.jsx`, `hooks/`) — but as a new, separate plugin per the Decisions
section, not an extension of `routecreation` itself. Two points in (source/dest), call the A2
endpoint, render the returned GeoJSON `LineString` as a map layer.

### C1. Validation
No ground-truth check exists yet for "is this route correct." At minimum: spot-check a handful of
real routes against a known-good router (Google/OSRM) for the same OD pairs, and specifically
verify a few of the real turn-restriction cases already identified this session (way `44705074`'s
U-turn, one of the 1,540 multi-way `via` chains once A3 is done) produce the legally-correct
route, not just *a* route.

---

## Open questions (still need input)

1. **A1's fix-vs-build-fresh decision** — not yet made; both viable, tradeoffs listed above.
2. **Does the routing endpoint need to work against year-agnostic input**, or is hardcoding to
   2024 (today's decision) acceptable until the "stable conflation source" the user referenced
   actually exists? Affects how much A1/A2 should generalize now vs. later.
3. **Auth/access model** for the new endpoint — `avail-falcor`'s existing `pgRouterRouting/`
   routes have no visible per-route auth beyond a global JWT check; is that the right model for a
   real routing feature, or does it need something tighter?
