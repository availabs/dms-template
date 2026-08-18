

# Routing initiative — task plan

A new, separate effort from the conflation pipeline itself: turn the conflated OSM network into
something that can actually answer "what's the route between point A and point B," respecting
turn restrictions, one-way streets, and road-attribute restrictions (truck access, weight limits,
etc.) — not just the internal shortest-path search the conflation matcher already does for its own
purposes. End goal: a routing **service** (server/process), registered as its own DAMA source, that
takes a conflation view as input and returns a shortest path between two points on request.

**Main goal, restated plainly (confirmed with user 2026-08-03):** generate a new DAMA data type,
`routing`, where the user picks an existing conflation **source and view** as input (single year,
for now — not a multi-year framework yet). Given two points from the user (source and destination,
e.g. clicked on a map), the backend finds the best/optimal route between them using the full
conflated network — nodes, ways, relations (turn restrictions), and whatever other constraints
apply (one-way, road-class, attribute costing) — not just physical shortest-path-by-length like the
conflation matcher's internal pathfinder does today.

**v1 scope: point-to-point only.** The three use cases from the "Decisions" section below (turn-
by-turn, bulk OD-pair analysis, feeding a traffic-assignment process) are still the full long-term
vision — bulk/assignment support isn't being dropped — but v1 builds and validates single
point-to-point routing first, rather than designing/building all three at once. Bulk/assignment
support gets designed in once point-to-point actually works well.

See [TASKS.md](../TASKS.md) / [COMPLETED.md](../COMPLETED.md) for the conflation-matching work this
builds on top of — this is intentionally a separate concern (routing consumes the conflated
network; it doesn't change how conflation itself matches TMC/RIS to OSM).

See [ROUTING_LOG.md](ROUTING_LOG.md) for a detailed, chronological log of every step/result/problem
hit while working this plan — this file (ROUTING_TASKS.md) is the current plan/status, that one is
the narrative history. Read the log if you need to understand *how* a conclusion below was reached
or what was already tried and ruled out.

---

## Why this matters (the core problem)

Today, "shortest path" only exists inside the conflation matcher
(`TheConflationator/processSegments.mjs`), and it's a narrow tool built for a narrow job: given two
already-known endpoint edges close to a TMC/RIS segment, find *a* connecting path, weighted purely
by physical length. It is **not** a general routing engine:

- It has no concept of turn restrictions.
- Both directions of a two-way road are separate directed edges sharing the same two nodes — but
  nothing currently prevents an illegal U-turn or a banned left turn through an intersection node,
  because turn legality isn't graph data at all today, it's missing entirely.
- It costs every edge purely by length — no preference for primary roads, no penalty for turns, no
  awareness of truck/weight/height restrictions.

A real routing product needs all of that: the path isn't just "a sequence of edges," it's a
sequence of edges **traversed through specific nodes in a specific order**, where some
node-to-node transitions (turns) are illegal regardless of what the edges themselves allow.

---

## Confirmed current state (verified against the live DB and code, 2026-07-30)

**OSM relations (turn restrictions) already exist as a real, populated source table — completely
unused today.** `osm_datasets.s2074_v3553_osm_v2_relations` (the 2023 OSM view's companion
relations table, same naming convention as `..._nodes`) has **20,107 rows**, schema
`(ogc_fid, osm_id, members jsonb, tags jsonb)`. Every single row in this extract is
`tags.type = "restriction"`. Subtype breakdown:

| restriction | count |
|---|---|
| no_u_turn | 9,053 |
| no_left_turn | 6,576 |
| no_right_turn | 1,858 |
| only_straight_on | 1,252 |
| only_right_turn | 712 |
| (null/other) | 302 |
| only_left_turn | 181 |
| no_straight_on | 164 |
| only_u_turn | 7 |
| no_entry | 2 |

`members` is the standard OSM restriction shape: `[{id, type: "way", role: "from"}, {id, type:
"node", role: "via"}, {id, type: "way", role: "to"}]` (a `via` member can also be a way, for
multi-way restrictions — not confirmed yet whether any exist in this extract, see task 1). Every
other OSM year/view in this DB follows the same `<ways_table>_relations` naming convention (2024's
`s2074_v3554_osm_v2_relations` also exists), so this generalizes across years.

Grep confirms **zero** references to "relation" anywhere in this repo's code or README — this is
entirely new ground, not a partially-done feature.

**OSM way tags: far more is available in the source than is kept.** `loadWays.mjs` reads the full
`tags` JSONB blob per way from Postgres but only ever extracts `highway` (persisted to
`edges.highway`) and `oneway` (consumed transiently to decide edge directionality, then discarded
— never stored). Everything else in the tag blob is thrown away before it reaches SQLite. Real
presence among 2023's 417,671 ways: `oneway` 95,260, `hgv` 47,115, `access` 6,707, `turn:lanes`
8,028, `maxheight` 1,152, `maxweight` 978. All discarded today.

**`oneway` handling that DOES exist is narrower than it looks.** `loadWays.mjs`'s
`getWayTransform`:
```js
const needsForward = tags.oneway !== "-1";
const needsReverse = (tags.oneway === "-1") || ((tags.oneway !== "yes") && (tags.highway !== "motorway"));
```
Only `oneway === "yes"` (or being a `motorway`) suppresses the reverse edge; only `"-1"` suppresses
forward. Anything else — unset, `"no"`, or nonstandard values (`"reversible"`, `"alternating"`,
conditional tags like `oneway:conditional`) — falls through to bidirectional. So the "two-way road,
single shared node, undecided route" problem described in the prompt is real, but it's really two
separate gaps: (a) turn restrictions aren't modeled at all (the bigger one), and (b) oneway
handling itself has edge cases it doesn't cover.

**A pgRouting-shaped export already exists (`load_pgRouter.mjs`) but is a dead end, not a
foundation.** It copies SQLite's `nodes`/`edges` into `osm_datasets.nodes` /
`osm_datasets.edges` with pgRouting's conventional column names (`source`, `target`, `cost`,
`reverse_cost`) — but `reverse_cost` is created with `DEFAULT -1` and **never populated** by the
copy step, no `CREATE EXTENSION pgrouting` exists anywhere, no `pgr_*` function is ever called
against it, and its own DAMA-registration call for the edges table is commented out
(`load_pgRouter.mjs:219`). It reads from `TheConflationator/saved_checkpoints/checkpoint-1.sqlite`
— a path that doesn't match the pipeline's actual checkpoint directories, another sign this was a
one-off export/QGIS-inspection tool, not active infrastructure. Treat pgRouting as **unexplored**,
not partially built.

**TMC/RIS attributes already available on the conflation output** (from `enrichWithSourceAttributes`,
`TheConflationator/loadConflation.mjs`): `ris_functional_class`, `ris_direction`, `ris_divided`,
`ris_one_way`, `ris_aadt_current`, `ris_posted_speed`, `ris_region`, `ris_county_name`,
`tmc_f_system`, `tmc_direction`, `tmc_isprimary`, `tmc_nhs`, `tmc_aadt`, `tmc_avg_speedlimit`,
`tmc_road`, `tmc_county_name`. Useful for road-class-based costing/preference (e.g. prefer
`tmc_isprimary`/higher `tmc_f_system`) — but nothing here covers truck/weight/height restrictions;
that data (if it's to be used) has to come from OSM's own `access`/`hgv`/`maxweight`/`maxheight`
tags, which — see above — are read from source but currently discarded.

**No server, no general-purpose shortest-path function, no existing DAMA "service" pattern.**
Zero web-framework dependencies in `package.json` (no express/fastify/etc.), zero HTTP server code
anywhere in the repo. Every existing shortest-path call
(`processSegments.mjs`, `buildCorridorGraph.mjs`, `combineTmcSegments/`, `combineRisSegments/`) uses
`graphology-shortest-path`'s **bidirectional** Dijkstra, weighted purely by `"length"` — built for
one-shot internal matching, not for serving repeated point-to-point queries. A routing service is
genuinely new infrastructure, not an extension of an existing pattern.

---

## Decisions (2026-07-30, from the user)

- **Build-vs-buy gate first:** before writing custom routing code, evaluate whether an existing
  dedicated router (OSRM, Valhalla, GraphHopper) can just consume the conflated network directly —
  don't assume in-house is the right call. See new Task 0 below.
- **Prototype both, not either/or:** build small prototypes of both the pgRouting approach and a
  graphology/custom-JS approach and compare them directly (task 4/5), rather than picking one up
  front on paper.
- **All three use cases matter:** turn-by-turn navigation, bulk OD-pair distance/accessibility
  analysis, *and* feeding a traffic-assignment-style process. The design needs to support both
  single-query latency and bulk throughput — this rules out an architecture that only works well
  for one pattern (e.g. a pure per-request server with no batch path, or a batch-only offline job
  with no low-latency single-query path).

## Task breakdown

Status key: `[ ]` upcoming/not started, `[~]` in progress, `[x]` done.

- [ ] Task 0 — Build-vs-buy spike (leaning pgRouting-first, see Task 4)
- [x] Task 1 — Load and inspect OSM relations (done 2026-07-31, see findings below)
- [ ] Task 2 — Capture discarded way tags
- [ ] Task 3 — Design the routing graph model
- [ ] Task 4 — Prototype pgRouting AND graphology side by side
- [ ] Task 5 — Build the routing service
- [ ] Task 6 — Validation
- [ ] Task 7 — Keep every routing artifact source-swappable (year/view_id parameterized)
- [x] TASKS.md #14 — Persist relations as a real, DAMA-registered table (done 2026-08-03 — `temp.osm_conflation_1_2023_relations`/`_2024_relations`, source 2098, views 3612/3611)

**Not started yet — holding routing work until conflation data quality clears the bar (2023's
length-error and bad-nodes gaps, per [TASKS.md](../TASKS.md) #1/#5). These entries are the plan for
when that's ready, not in-progress work.**

---

### 0. Build-vs-buy: evaluate existing dedicated routers first
- Spike whether OSRM, Valhalla, or GraphHopper could ingest the conflated network (or plain OSM
  + the conflation attribute overlay) directly and handle turn restrictions + attribute costing
  out of the box — all three already solve exactly this problem.
- Compare against custom build on: how well each ingests a non-standard/enriched network (our
  conflation output isn't raw OSM — it carries TMC/RIS attribute enrichment (task 2/§ enrichment
  columns) that a stock OSRM/Valhalla import wouldn't natively understand), support for all three
  use cases above (some of these tools are tuned mainly for turn-by-turn, less for bulk OD-matrix
  or assignment-style output), operational fit (running/maintaining an external routing engine
  process vs. staying inside the existing Postgres/Node.js/DAMA stack), and how it'd surface as a
  DAMA-registered source (task 5) if the routing computation lives outside our own code entirely.
- Outcome of this task should be a clear go/no-go before sinking further effort into tasks 3-5's
  custom-build path — if one of these tools is a good fit, it may replace most of that work.

### 1. Load and inspect OSM relations properly — [x] DONE (2026-07-31)
- Add a new load step (parallel to `loadNodesAndWays`) that pulls
  `<ways_table>_relations` (`ogc_fid, osm_id, members, tags`) the same way ways/nodes are pulled
  today (resolve the table name via the existing `data_manager.views` lookup, don't hardcode it).
- Filter to `tags.type = 'restriction'` initially (100% of this extract) but keep the raw `tags`
  around — confirm whether other relation types (route relations, e.g. bus/bike routes,
  multipolygons) exist in other years/regions before assuming restriction-only is safe long-term.
- Resolve `members[].role` (`from`/`via`/`to`) against `members[].id`/`members[].type` to real
  OSM way/node ids already loaded into the `edges`/`nodes` SQLite tables — confirm how many of the
  20,107 restrictions' referenced ways/nodes actually survive into the loaded network (some
  restrictions may reference filtered-out or unmatched ways).
- Check whether any restriction's `via` member is itself a `way` (multi-way restriction) rather
  than a single node — this changes how the restriction gets applied in task 3.

**Findings (2026-07-31):** Implemented as [loadRelations.mjs](../loadRelations.mjs) (top-level
script, `npm run load-relations <year>`) +
[TheConflationator/loadNodesAndWays/loadRelations.mjs](../TheConflationator/loadNodesAndWays/loadRelations.mjs)
(loader, mirrors `loadWays.mjs`'s COPY-stream pattern). Resolves the relations table name via
`data_manager.views` (no hardcoding), filters to `tags.type = 'restriction'` in the SQL itself,
and cross-checks every relation's `from`/`via`/`to` members against an existing checkpoint-0
SQLite for the same year (attached read-only, never mutated — kept separate from the
conflation-matcher's own graph per the task-3 decision below; **not** wired into
`loadNodesAndWays`/checkpoint-0 itself).

- All 12 source-2074 OSM views (2014–2025) confirmed to have a companion `_relations` table,
  100% `tags.type = 'restriction'` in every single year (row counts range from 599 in 2014 up to
  21,963 in 2025 — tracks OSM's own increasing tag density over time, not a data gap).
- **Confirmed against 2024 (view 3554, 21,018 restrictions, checkpoint-0_2024.sqlite):**
  - **15,914 / 21,018 (75.7%) fully resolve** — every `from`/`to` way and `via` node/way survived
    into checkpoint-0's `edges`/`nodes`.
  - 4,695 reference a `from`/`to` way that didn't survive into checkpoint-0 (filtered out
    upstream somewhere — worth understanding why before task 3, since these restrictions are
    currently unusable). **Dug deeper (2026-07-31) and moved to [TASKS.md](../TASKS.md) #11 — this
    is a conflation-extract completeness question (3,201 of the 4,695 don't exist in the source
    ways table at all, in any year), not something a routing search can work around.** Same dig
    also turned up two more conflation-side correctness bugs unrelated to relations directly —
    [TASKS.md](../TASKS.md) #9 (roundabouts loaded bidirectionally when untagged) and #10 (`edges`
    PK collisions silently overwrite one way's data with another's) — both filed there since
    they affect the conflation matcher's own graph too, not just future routing.
  - 1,118 have an unresolvable `via`.
  - 239 have a malformed `role` string (free text bled in, e.g. `"from Lincoln Street"` instead
    of `"from"` — an OSM tagging quality issue, not a resolution failure; needs a lenient parse,
    not a hard requirement of an exact `role` match).
  - **Multi-way `via` restrictions are real, not hypothetical: 1,540 relations** have a `via`
    member that's a `way` rather than a single node (1,632 individual via-way *members* map to
    1,540 *relations* — a few relations chain 2+ via-ways). This resolves the open question this
    task originally posed — task 3's edge-expansion design must handle chained via-ways, not just
    the single-via-node case.
  - **Follow-up gap found (2026-08-03), filed as [TASKS.md](../TASKS.md) #14:** this task's loader
    was deliberately built as a one-off inspection tool (in-memory SQLite, discarded on exit) —
    relations have no persistent, DAMA-registered home in the conflation output the way
    nodes/edges now do. Needed before task 5 (routing service) can point at real relation data
    instead of re-running the inspection script each time.

### 2. Capture the currently-discarded way tags
- Extend `loadWays.mjs`/the `edges` SQLite schema to persist `access`, `hgv`, `maxweight`,
  `maxheight`, `turn:lanes` (and confirm which others are worth keeping) instead of extracting only
  `highway`/`oneway` and discarding the rest of the tag blob.
- Decide the storage shape: raw tag strings passed through as-is (simplest, most faithful) vs.
  normalized/typed columns (e.g. `maxweight` parsed to a numeric ton value) — normalization makes
  routing-time filtering cheaper but is lossy/brittle against OSM's inconsistent tag value
  formatting (`"3.5"` vs `"3.5 t"` vs `"3500"`).
- Re-examine the narrow `oneway` logic (`needsForward`/`needsReverse`) for the edge cases already
  found (`oneway:conditional`, `"reversible"`/`"alternating"`) — decide whether to handle them or
  explicitly document them as out of scope for v1.

### 3. Design the routing graph model (deliberately separate from the conflation-matching graph)
- The conflation matcher's graph (nodes + directed edges, weighted by length) optimizes for a
  different job (find *a* short path near a known source geometry) than routing needs (find *the*
  correct/legal path respecting turn restrictions and attribute filters). Decide: build a genuinely
  separate graph representation for routing, or a shared loader with routing-specific
  augmentation? Recommend separate — the conflation matcher's graph shouldn't grow turn-restriction
  complexity it doesn't need, and vice versa.
- Turn restrictions in a plain node/edge graph require either (a) an edge-expansion technique
  (duplicate nodes per incoming-edge to make "arrived via edge X" part of the graph state, so a
  restriction becomes "this expanded node has no outgoing edge to Y") or (b) a graph search that
  carries the previous edge as search state and checks it against a restriction table at each step.
  (a) works with off-the-shelf Dijkstra libraries at the cost of a larger graph; (b) keeps the graph
  small but needs custom search code (`graphology-shortest-path` doesn't support this out of the
  box). Build both as prototypes (per the decision above) rather than picking one on paper —
  compare them empirically in task 4.
- Attribute-based costing/filtering (truck access, weight/height limits, preference for
  `tmc_isprimary`/higher functional class): decide whether these are **hard filters** (edge doesn't
  exist for a truck-mode query) vs. **soft costs** (penalize but don't exclude) — probably both,
  depending on the attribute (weight/height limits should hard-filter; road-class preference should
  soft-cost).

### 4. Prototype pgRouting AND graphology side by side, compare directly

**Re-confirmed with user (2026-08-03): build BOTH — pgRouting and a custom Dijkstra/graphology
approach — and pick one based on the actual comparison results, not a paper decision.** Same
conclusion as the original "Decisions" section above, restated explicitly for this v1 point-to-
point build specifically.

- ~~Confirm the Postgres instance actually has the `pgrouting` extension available/installed~~ —
  **confirmed (2026-08-03): installed, v3.8.0** (`extversion` in `pg_extension`). Prototype can
  proceed without an install step.
- **pgRouting prototype:** `pgr_dijkstra`/`pgr_trsp` (pgRouting's turn-restriction-shortest-path
  function, built for exactly this problem) against a real `source`/`target`/`cost`/`reverse_cost`
  table correctly populated from the conflated network (unlike `load_pgRouter.mjs`'s dead
  `reverse_cost`), using pgRouting's own restriction-table format for the turn restrictions loaded
  in task 1.
- **graphology prototype:** edge-expansion (or custom search) per task 3, in-process JS.

**Dry-run finding (2026-08-03, not a full prototype yet — just proving the mechanism, using temp
tables only, nothing persisted):** tested three candidate functions against a synthetic case
specifically built to force a turn restriction to matter (a shortcut path whose last hop is
banned, so a correct implementation *must* reroute to a longer legal path) plus the real 2024
data (real persisted relation `3896860`, real `edges`/`relations` tables from Task 14).

- **`pgr_turnRestrictedPath`** (the newer function, looks like the "recommended" modern choice) —
  **broken in this pgRouting 3.8.0 install.** On the synthetic case it returned the banned
  shortcut anyway, with a corrupted `Infinity` mid-path cost instead of rerouting. **Ruled out —
  do not use this function.**
- **`pgr_trsp`** (older, deprecated upstream but still present here) — **correct.** Synthetic
  case: reroutes as expected (cost 7 → 25 once the shortcut is banned). Real data: clean run,
  matches graphology's result exactly.
- **graphology (custom Dijkstra, edge-expansion)** — **correct**, and matches `pgr_trsp`'s answer
  exactly on both the synthetic and real-data cases.

**Conclusion: two viable candidates going forward — `pgr_trsp` and graphology/custom
edge-expansion — `pgr_turnRestrictedPath` is disqualified.** Both remaining candidates still need
the full side-by-side comparison this task calls for (latency, bulk throughput, deployment shape)
before picking one; this dry run only proved both compute the *correct* answer, not which is
better operationally.
- Compare on: query latency for a single point-to-point request, bulk-query throughput (an OD
  matrix of many pairs — relevant given all three use cases matter), ease of expressing turn
  restrictions and attribute filters, deployment shape (Postgres extension vs. an in-process graph
  held in memory, similar in scale to the ~8GB+ graphs already seen in the conflation matcher), and
  how well each fits serving all three use cases (turn-by-turn, bulk OD/accessibility, feeding a
  traffic-assignment process) rather than just one.

### 5. Build the routing service
- Design the API surface to cover all three use cases: a single point-to-point request (path +
  distance/cost), AND a bulk/batch mode (many OD pairs at once, e.g. for accessibility analysis or
  as input to a traffic-assignment process) — not just a single-query API.
- Decide process shape: long-running server (keeps the graph/connection warm, lowest per-query
  latency, needs its own deployment/lifecycle) vs. on-demand script (simpler, pays graph-load cost
  every invocation) vs. pgRouting-backed (mostly stateless, cost lives in the DB) — informed by
  task 4's comparison and whichever approach (or hybrid) it points to.
- Register it as its own DAMA source (per the `setDamaTables` "one source" pattern from
  [TASKS.md](../TASKS.md) #8) that references the conflation view it was built from as input, so it's
  traceable which conflation year/version a given routing graph corresponds to.

### 6. Validation
- No ground truth exists yet for "is this route correct" — need a validation approach (e.g. spot
  checks against a known-good router like OSRM/Google for the same OD pairs, or manually verified
  turn-restriction cases from the 20,107-row set) before trusting results.

---

## Open questions (still need your input)

1. **Query volume/scale expectations** — occasional manual queries, or a production API serving
   real-time requests? Affects the "long-running server vs. on-demand script vs. pgRouting" choice
   in task 5, and how much task 0/4's benchmarking needs to stress-test.
2. **Which restriction types matter for v1** — all of turn restrictions + truck/weight/height +
   road-class preference, or start with just turn restrictions (the biggest correctness gap) and
   layer in attribute costing later?
3. ~~Should this target only the OSM-centric main conflation table, or does it need the
   still-unregistered nodes/edges tables (TASKS.md #8, item 3) finished first as a
   prerequisite?~~ — **resolved (2026-08-03): nodes/edges are now registered** (confirmed live —
   `Temp OSM Conflation Nodes`/`Edges`, versioned views for 2023/2024/2025 all exist in
   `data_manager.views`). No longer a blocker; relations still need the same treatment though
   (TASKS.md #14).
