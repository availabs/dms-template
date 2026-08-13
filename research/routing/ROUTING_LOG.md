# Routing initiative — working log

Chronological log of every step, result, and problem hit while working on the routing initiative
— written so a different LLM session (or a human) picking this up cold can understand what was
tried, what worked, what broke, and why, without reconstructing it from git history or terse
status lines. **This is a narrative log, not the plan** — see [ROUTING_TASKS.md](ROUTING_TASKS.md)
for the current task list/plan and [TASKS.md](../TASKS.md) for conflation-pipeline-side work (some
of which was discovered *while* doing this routing work, see below).

Conventions: entries are dated, most-recent at the bottom. Each entry says what was done, the
exact result (numbers, not vague summaries), and — where relevant — what was tried and didn't
work, since that's the easiest context to lose.

---

## 2026-07-31 — Confirmed OSM relations (turn restrictions) exist for source 2074

Checked whether OSM turn-restriction data actually exists for the OSM source this conflation
pipeline uses (`source_id = 2074`, https://npmrds.transportny.org/datasources/source/2074).

Queried `data_manager.views` for all views under `source_id = 2074` (12 found, years 2014–2025),
then checked each for a companion `<data_table>_relations` table. **All 12 have one**, and in
every single year, **100% of rows are `tags.type = 'restriction'`**. Row counts grow with OSM's
own tagging density over time: 599 (2014) → 20,107 (2023) → 21,018 (2024) → 21,963 (2025).

## 2026-07-31 — Task 1: built the relations loader/inspector

Built [loadRelations.mjs](../loadRelations.mjs) (top-level script, `npm run load-relations <year>`)
+ [TheConflationator/loadNodesAndWays/loadRelations.mjs](../TheConflationator/loadNodesAndWays/loadRelations.mjs)
(the loader, mirrors `loadWays.mjs`'s Postgres COPY-stream pattern). It resolves the relations
table name via `data_manager.views` (no hardcoding), filters to `tags.type = 'restriction'` in the
SQL itself, and cross-checks every relation's `from`/`via`/`to` members against an existing
checkpoint-0 SQLite for the same year (attached read-only — **deliberately not wired into
`loadNodesAndWays`/checkpoint-0 itself**, kept as a separate one-off inspection tool).

Ran against 2024 (`checkpoint-0_2024.sqlite`, 21,018 restrictions):
- **15,914 / 21,018 (75.7%) fully resolve** (every `from`/`to` way and `via` node/way survives
  into checkpoint-0's `edges`/`nodes`).
- 4,695 reference a `from`/`to` way missing from checkpoint-0.
- 1,118 have an unresolvable `via`.
- 239 have a malformed `role` string (free text like `"from Lincoln Street"` instead of `"from"`
  — OSM tagging quality issue).
- **1,540 relations have a multi-way `via`** (a `way`, not a single node) — real, not
  hypothetical; 1,632 individual via-way *members* across those 1,540 relations (some chain 2+
  via-ways). This matters for Task 3's graph-model design — edge-expansion must handle chained
  via-ways, not just the single-node case.

## 2026-07-31 — Dug into the "shared node, both directions" question — confirmed NOT a bug

User's question: since a two-way road's both directions share the same two node ids (just
`from_node`/`to_node` swapped), is a turn-restriction relation's resolution against that shared
node actually correct, or does reusing the same node break it?

Traced one real example end-to-end: relation `3896860` (`no_u_turn`, `from=way 44705074,
via=node 41307298, to=way 44705074` — a literal "don't reverse on this same road" case, which
turns out to be **the majority shape of `no_u_turn` restrictions**: 7,133 of 9,216 in 2024 have
`from` way == `to` way).

Way `44705074`'s `refs = [567239532, 1234971659, 41307298]`. Both directions load as separate rows
in `checkpoint-0_2024.sqlite`'s `edges` table, sharing the same node ids and `way_id` but with
`from_node`/`to_node` swapped and opposite bearing (exactly 180° apart):
```
way_id=44705074  from=1234971659  to=41307298   reversed=0   (arriving at the via node)
way_id=44705074  from=41307298    to=1234971659 reversed=1   (leaving, same way, opposite dir)
```
**Conclusion: the data is not wrong.** Both directions are distinct rows even though they share
node ids — a restriction resolves correctly as long as the routing *search* tracks which specific
edge was just traversed (edge-expansion, or carrying the previous edge as search state) rather
than just "which node am I at," which is exactly what Task 3's design already calls for. The gap
is in the search algorithm (not built yet), not the loaded data.

## 2026-07-31 — Found 3 conflation bugs while digging into the above (filed as TASKS.md #9/#10/#11)

Not routing-specific — these corrupt the same `edges` table the TMC/RIS conflation matcher already
searches over. Full detail in TASKS.md; summary:

- **#9 — roundabouts loaded bidirectionally when untagged.** `loadWays.mjs`'s oneway logic didn't
  special-case `junction=roundabout` (which implies oneway per OSM convention even untagged).
  290/1,319 (22%) of 2024's roundabout ways had no `oneway` tag and loaded as bidirectional —
  verified one example (way `5669386`) loaded as 30 edges, both directions. **Fixed** in
  `loadWays.mjs`: added `effectiveOneway` that fills the gap only when `oneway` is unset AND it's
  a roundabout, never overriding an explicit tag.
- **#10 — `edges` PK is `(from_node, to_node)` only, not `(way_id, from_node, to_node)`.**
  `INSERT OR REPLACE` silently drops one way's segment when two different ways share an identical
  directed node-pair. Confirmed 23 colliding pairs / 46 way-refs in 2024. **Fixed with detection
  only** (not a schema change — grepped ~8 files that all assume one edge per node-pair; a full PK
  redesign would need auditing all of them, out of scope for now). Added `reportEdgeCollisions` to
  `loadNodesAndWays/index.mjs`, querying the **source** Postgres ways table (not the already-
  collapsed SQLite `edges` table, which can't see the loser of a collision anymore).
- **#11 — ~15% of restriction relations reference a way missing from the network entirely.**
  Traced 3,201 of 4,695 unresolved-from/to relations to ways that don't exist in the source ways
  table in ANY year. **Root-caused, not a bug:** found the actual filter in a sibling repo,
  `avail-falcor/dama/routes/data_types/osm/processors/utils/OSMObjectHandler.mjs` (lines 25-40,
  146) — a hardcoded `HIGHWAY_TYPES` whitelist (motorway/trunk/primary/secondary/tertiary/
  unclassified/residential/*_link/living_street) with **`service` explicitly commented out**.
  Service roads/driveways — exactly where a lot of restrictions get tagged — are excluded by
  design at OSM import time. No fix needed in this repo; changing the whitelist would be an
  org-wide `avail-falcor` decision, out of scope here.

## 2026-07-31 — Rebuilt the full pipeline for 2023 with #9/#10 live

Deleted the 7 numbered 2023 checkpoint files (`checkpoint-0_2023.sqlite` through
`checkpoint-6_2023.sqlite`, ~19GB), kept `checkpoint-6_2023_badcorridorfix.sqlite` (an
intentionally-preserved pre-corridor-fix baseline) and an unsuffixed `checkpoint-6.sqlite`
(apparent stray duplicate) untouched. Ran `node --expose-gc --max-old-space-size=49152 ./main.mjs
"" 2023` fresh.

**Problem hit mid-run:** a *pre-existing* `node main.mjs RIS 2023` process (unrelated — it was
Task #5's bad-nodes-investigation Step 1 test, already running since before this session touched
anything) shares the exact same hardcoded `TheConflationator/working_directory/` path with any
other `main.mjs` run. Starting the fresh 2023 run wiped that directory out from under the other
process. **Verified no data was lost**: `/proc/<pid>/fd/` showed the other process's
`active_db.sqlite`/`-wal`/`-shm` marked `(deleted)` but still held open (Linux keeps a file's data
alive for any process still holding an fd open, even after its directory entry is removed) — its
CPU time kept climbing, confirmed still healthy. User chose to stop that pre-existing process
rather than wait for it, then the fresh 2023 rebuild ran clean. **Lesson saved as a memory:**
`main.mjs` runs cannot run concurrently with each other (only `loadConflation.mjs` got its own
separate working directory fixed previously, per the README's existing note about that lesson).

2023 rebuild completed in ~1h39m. Results: 4,717,456 nodes, 9,249,351 edges, 69,173 intersections,
**22 edge PK collisions logged** (visible now vs. previously silent), 189,482 total problem RIS
roadways in the final combine stage.

## 2026-08-03 — User decision: hold routing until conflation data quality is good enough

User: "holding on the routing task until we don't have enough quality in the conflation." At this
point TASKS.md #5 (bad-nodes) was independently being worked (outside this session's direct
actions in real time) and eventually closed as "mostly not a bug" (~91% of bad-nodes failures are
the matcher correctly rejecting zero-length source records, not a real defect — see TASKS.md #5
for the full write-up). TASKS.md #12 (reusable QA tool) and #13 (one-fix-at-a-time rollout
process) were added as process improvements around the same time.

## 2026-08-03 — Audited what routing actually needs against what's really in the conflation source

Checked the real Postgres schema (not just the SQLite checkpoint or the raw OSM source) against
every data-completeness item ROUTING_TASKS.md assumed:

| Needed | Status |
|---|---|
| pgRouting extension | **Confirmed installed, v3.8.0** (was "not yet checked") |
| Nodes/edges DAMA-registered | **Confirmed live** — `Temp OSM Conflation Nodes`/`Edges`, versioned views for 2023/2024/2025 |
| TMC/RIS attribute enrichment on main table | **Confirmed present** (`ris_functional_class`, `tmc_isprimary`, etc.) |
| Way tags (access/hgv/maxweight/maxheight/turn:lanes) | **Confirmed still missing** — already tracked as ROUTING_TASKS.md Task 2, no new task needed |
| Turn-restriction relations, persistent/queryable | **Gap found** — filed as TASKS.md #14 (see below) |

Also confirmed the published `edges` table doesn't retain `bearing`/`length` (only
`wkb_geometry`) — both derivable via `ST_Azimuth`/`ST_Length` if ever needed precomputed; noted,
not urgent.

## 2026-08-03 — Main goal restated plainly, v1 scope confirmed

User confirmed the concrete goal: a new DAMA data type `routing`, where the user picks a
conflation **source and view** as input (single year for now). Given two points (source,
destination), the backend finds the optimal route using nodes/ways/relations/etc. **v1 scope:
point-to-point only** — bulk OD-pair analysis and traffic-assignment feed remain the long-term
vision (per the original "all three use cases matter" decision) but aren't being built yet.
**Also confirmed:** every routing artifact should be year/view_id-parameterized (mirroring
`resolveYearConfig.mjs`'s pattern), so pointing at a better/different conflation source later is a
config change, not a rewrite — this is why `persistRelations.mjs` (below) takes `year` as an
argument rather than hardcoding one.

**Re-confirmed the build-both decision** for Task 4: build pgRouting AND a custom
Dijkstra/graphology approach, pick one from the actual comparison results, not on paper.

## 2026-08-03 — TASKS.md #14: persisted relations as a real, queryable table

Built [persistRelations.mjs](../persistRelations.mjs) — resolves relations against the
**already-published** `_edges`/`_nodes` tables for a given year (no fresh checkpoint rebuild
needed) and writes `temp.osm_conflation_1_<year>_relations`
(`osm_id, restriction, members, tags, resolved`), registered via `setDamaTables` the same way
nodes/edges are. `members`/`tags` stored as raw `jsonb` (un-normalized) so Task 3's eventual
graph-model decision can still shape a *derived* structure later without re-resolving from
source.

Ran for both years currently published:
- **2024**: 15,680 / 21,018 resolved (74.6%). Source `2098` ("Temp OSM Conflation Relations"),
  view `3611`.
- **2023**: 14,928 / 20,107 resolved (74.3%). Same source `2098` (correctly reused — the "one
  source, many views" pattern worked as designed), view `3612`.

**Caveat:** resolved against whatever's *currently* published — for 2023 that's still the
pre-#9/#10-fix data, since that rebuild's `checkpoint-6` was never republished via
`load-conflation`. Re-run this script after any future republish to pick up improved numbers.

## 2026-08-03 — pgRouting dry run: comparing 3 candidate functions

**Explicitly scoped as a dry run only** — user asked not to log this as a tracked task, use
session-scoped Postgres temp tables only (auto-dropped on disconnect, nothing persisted), and
delete any scratch script files afterward. This log entry is the exception — recording the
*result* here since it's genuinely useful, without treating it as a completed task deliverable.

**Why a dry run first:** ROUTING_TASKS.md assumed `pgr_trsp` was pgRouting's turn-restriction
function, but pgRouting 3.8.0 also has a newer `pgr_turnRestrictedPath` that looks like the
"current, recommended" choice (its own doc string still says **EXPERIMENTAL**). Needed to check
both actually work before trusting either.

**Test setup:** a synthetic 5-node diamond graph specifically built so a restriction *must* change
the answer to prove itself: node 1→4, a cheap shortcut via node 5 (cost 2 total) whose last hop
is banned, vs. a longer legal route (cost 25). Plus a real-data test using the actual persisted
relation `3896860` (the same one from the U-turn dig above) and the real 2024 `edges` table
(subgraph within ~2km of the via node, 9,966 edges, `567239532 → 8065730579`).

**Results:**
- **`pgr_turnRestrictedPath`** — **broken**. On the synthetic case (which a correct
  implementation *must* reroute on), it returned the banned shortcut anyway, with a corrupted
  `Infinity` value appearing mid-path instead of the expected cost. **Ruled out — do not use.**
- **`pgr_trsp`** (one-to-one signature: `pgr_trsp(edges_sql, restrictions_sql, from_vid, to_vid,
  directed)`, restrictions need columns `cost, path` — note: NOT the same signature shape as
  `pgr_turnRestrictedPath`, which also wants an `id` column) — **correct**. Synthetic: reroutes,
  cost 7→25 exactly as expected. Real data: clean run, `567239532 → 1234971659 → 41307298 →
  8065730579`, cost 165.3.
- **graphology (custom Dijkstra via edge-expansion)** — **correct**, and matches `pgr_trsp`'s
  answer exactly on both tests (same path, same cost, both cases). Implementation: each physical
  directed edge becomes a graph node; two edge-nodes connect iff `edgeA.target === edgeB.source`
  AND the transition isn't in the banned-pair set; virtual `START`/`END` nodes bridge to/from the
  requested vertices. ~30 lines, no library beyond `graphology`/`graphology-shortest-path`
  (already project dependencies).

**Conclusion:** two viable candidates going forward — `pgr_trsp` and graphology/custom
edge-expansion. `pgr_turnRestrictedPath` is disqualified. Neither candidate's operational
tradeoffs (latency, bulk-query throughput, deployment shape) have been tested yet — this dry run
only proved both compute the *correct* answer.

## 2026-08-03 — First real end-to-end point-to-point test, full network scale

User asked directly: "is the source ready to take two points and give the route?" Answer at the
time: not quite — proven correct at small scale (dry run above), but untested at full scale, no
point-snapping (lat/lon → nearest graph node) existed yet, and no callable entry point. Built both
gaps and ran a real test, **not scoped as a throwaway dry run this time** — this result is real
progress, logged in full.

**Point snapping:** the published `_nodes` table already has a GIST spatial index
(`osm_conflation_1_2024_nodes_geom_idx` on `wkb_geometry`), so nearest-node lookup is just
`ORDER BY wkb_geometry <-> ST_SetSRID(ST_MakePoint(lon,lat),4326) LIMIT 1`. Tested with two real,
arbitrary points — near Albany (`-73.75, 42.65`) and near Buffalo (`-78.85, 42.88`), picked to be
genuinely far apart (~150mi straight-line) rather than another trivial local test. **Both snapped
in 41.8ms total**, landing 44m and 11m from the requested coordinates respectively — fast and
accurate.

**Full-scale restrictions:** built a `full_restrictions` table joining ALL `resolved=true`,
single-node-`via` relations from `temp.osm_conflation_1_2024_relations` against the real
`_edges` table (matching `from_way`'s edge ending at the via node, `to_way`'s edge starting there)
— **13,964 restriction edge-pairs**, built in 8.9s. (Multi-way `via` chains excluded from this
run — still out of scope per the dry run's stated limits.)

**Full-scale query:** ran `pgr_trsp` with NO bounding box this time — the entire 2024 network,
9,657,306 edges, 5,080,761 nodes, all 13,964 real restrictions active — from the snapped Albany
node (`552584553`) to the snapped Buffalo node (`111502659`).

**Result: completed in 1 minute 2 seconds.** Returned a 6,713-hop path, **277.80 miles** total
(a sane real-world number — actual Albany–Buffalo driving distance via I-90 is in that range,
well above the ~150mi straight-line distance, exactly as real road distance should be).

**This is the first real proof the whole chain works end-to-end**: raw lat/lon in → snapped to
real graph nodes → shortest path computed against the full real network with real turn
restrictions applied → a sane real-world route back out. Not yet a "service" (still an ad-hoc
script, no API), and `graphology` hasn't been tested at this same full scale yet (only `pgr_trsp`
was, this run) — but the core mechanism is now demonstrated at real scale, not just a toy/small
subgraph.

---

## Open, as of this entry

- **Graphology at full scale — not yet tested.** Only `pgr_trsp` has been proven at full network
  scale; the operational comparison (latency/throughput) between the two candidates is still
  outstanding, now with a real full-scale number to compare against for `pgr_trsp` (~62s for one
  point-to-point query, unindexed/no caching).
- Multi-way `via` chain restrictions still excluded from both the dry run and this full-scale
  test — real gap (1,540 of the 21,018 2024 relations), not yet incorporated into either
  candidate's restriction-building logic.
- No callable entry point yet — this is still an ad-hoc script per query, not a function/endpoint.
- Task 2 (capture discarded way tags: access/hgv/maxweight/maxheight/turn:lanes) — not started,
  independent of the above, can run in parallel any time.
- Task 3 (formal graph-model design doc) — informally validated via the dry run and this full-scale
  test (edge-expansion / restriction-as-edge-pair both work), but no written design doc yet.
- Whether/when to resume routing work at all is still gated on conflation data quality per the
  2026-08-03 holding decision — check TASKS.md's open items (#1 round-road length error is the
  main one left) before treating routing as unblocked.

## 2026-08-03 — Explored the two sibling repos this will actually move into

User confirmed this routing work will eventually live outside the conflation repo — server-side in
`avail-falcor`, UI in `dms-template`. Ran two Explore agents in parallel to map both before
deciding anything, rather than guessing at conventions. New companion doc created:
[routing/ROUTING_API_TASKS.md](ROUTING_API_TASKS.md) — the routing-service/plugin-specific task
plan, one level more concrete than this log; a mirrored, dms-template-convention-following task
file was also created there: `planning/tasks/current/point-to-point-routing-plugin.md`.

**`avail-falcor` findings:** three separate, mostly-abandoned routing subsystems accumulated over
time (oldest osm2pgrouting layer being phased out; an in-memory `ngraph`/A* layer deliberately
disconnected via a `.route.deprecated.js` filename trick, though its graph still loads into memory
at boot behind an env flag; the pgRouting layer, `dama/routes/data_types/pgr/`, real and partially
working). The pgRouting layer's `osm.routing.js` already uses the exact schema convention we
produce (DAMA conflation view → `<table>_nodes`/`<table>_edges`, edges tagged with `osm`/`tmc`/
`ris` ids) — reusable. Real bugs found there worth NOT repeating: the batch/DAMA-worker route
(`pgr.worker.js`) is broken (references a nonexistent `.mjs` file, invalid mixed CJS/ESM syntax);
nearest-edge snapping hardcodes one global table instead of the per-view table it just resolved;
heavy geoprocessing runs synchronously inline in the request handler instead of via the task
queue; string-interpolated SQL throughout (injection risk). No documentation anywhere explaining
any of this history — all reverse-engineered from code/table naming (`.deprecated.js`, a Postgres
schema literally named `deprecated`, commented-out schema lists in an environment-rebuild script).

**`dms-template` findings:** a real, live, conflation-aware routing service already exists in
production — `https://routing2.availabs.org/route?conflation_map_version={year}_{version}`,
called by the existing `routecreation` map plugin's waypoint/auto-route feature. Confirmed only
years 2020-2022 actually resolve (not the full 2016-2026 assumed from DB metadata) — almost
certainly built on the old v0.6.0 conflation network, not `TheConflationator`'s output; whatever
powers that URL isn't in either repo explored. The map plugin system itself
(`PluginLibrary`/`RegisterPlugin`, theme-registered via `theme.mapPlugins`) is currently **broken
in the checked-out working tree** — `src/dms` submodule is ~10 days stale, missing the commit that
wires up plugin auto-registration; `git submodule update` fixes it, and this is a hard prerequisite
before any new plugin work. `routecreation` is the closest existing example to mirror (file shape,
the `data-column` click-identity workaround, the `resolveRoute.js` external-call isolation
pattern) but solves a different problem (named-route authoring) — decided **not** to extend it,
build a new separate plugin instead.

**Decisions made (2026-08-03):** input contract is coordinates/GeoJSON, not pre-resolved ids
(matches both our validated point-snapping approach and the existing external service's own
convention); transport is a dedicated API endpoint returning GeoJSON, not a tile server (a
point-to-point route is unique per request, can't be pre-tiled); new/separate plugin, not
`routecreation` extension; target source/view for v1 is **2024**. `pgr_trsp` is now the leaning
default (not just "one of two candidates") given `graphology`-the-library's full-scale crash
earlier this session — though a hand-rolled non-`graphology` adjacency-list Dijkstra remains a
theoretically valid, untested fallback. Full detail and the actual task breakdown live in the two
new docs referenced above, not repeated here.
