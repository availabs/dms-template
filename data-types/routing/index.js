/**
 * Point-to-point, turn-restriction-aware routing via pgr_trsp.
 *
 * Ported from the avail-falcor sibling repo's dama/routes/data_types/pgr/trsp.routing.js
 * (that repo/route is deprecated as the live backend - kept only as reference while porting).
 * See dms-template's research/routing/validated-queries.sql for the validated queries this
 * mirrors (nearest-node snapping, single-node-via restriction build, pgr_trsp call/shape) and
 * planning/transportny/tasks/current/point-to-point-routing-plugin.md for the full task history,
 * including two real bugs found+fixed while verifying the avail-falcor version (pgr_trsp's
 * restrictions_sql needing a real temp table, not a CTE; and node-postgres needing explicit
 * type casts against pgr_trsp's overloaded signature) - both carried forward into this port.
 *
 * Known limitation carried over from validation: only single-node `via` restrictions are
 * captured (multi-way via chains are not yet solved - see the conflation repo's
 * ROUTING_API_TASKS.md Task A3).
 */

const memoryGraph = require("./memoryGraph");

const METERS_PER_MILE = 1609.344;

// mph, matching the deprecated avail-falcor reference's HIGHWAY_TO_SPEED_MAP - reused here for
// the "fastest" route variant's time cost (Phase 7-adjacent: two objectives - shortest distance
// vs. fastest time - not true k-shortest-path alternates, see the task file).
const HIGHWAY_SPEED_MPH_SQL = `CASE highway
  WHEN 'motorway' THEN 65.0
  WHEN 'motorway_link' THEN 45.0
  WHEN 'trunk' THEN 65.0
  WHEN 'trunk_link' THEN 45.0
  WHEN 'primary' THEN 55.0
  WHEN 'primary_link' THEN 35.0
  WHEN 'secondary' THEN 45.0
  WHEN 'secondary_link' THEN 25.0
  WHEN 'tertiary' THEN 45.0
  WHEN 'tertiary_link' THEN 25.0
  WHEN 'unclassified' THEN 45.0
  WHEN 'residential' THEN 30.0
  WHEN 'living_street' THEN 15.0
  ELSE 45.0
END`;
const MPH_TO_MPS = 0.44704;

// Real per-edge speed, preferring actual data over the highway-class guess above. tmc_avg_speedlimit
// (real observed speed, NPMRDS probe data) and ris_posted_speed (real posted limit, RIS inventory)
// live on the MAIN conflation table, keyed by the tmc/ris codes each edge carries in its own
// tmc[]/ris[] array columns - `edgesAlias` must be a table/alias in scope with those columns.
// Requires btree indexes on the main table's tmc/ris columns (added 2026-08-14 - confirmed via
// direct testing this join is a ~100s-for-300-edges full-table-scan disaster without them, ~0.1s
// with them - do not remove those indexes without re-verifying this stays fast).
const speedMphSql = (conflationTable, edgesAlias) => `COALESCE(
  (SELECT avg(m.tmc_avg_speedlimit) FROM ${conflationTable} m WHERE m.tmc = ANY(${edgesAlias}.tmc) AND m.tmc_avg_speedlimit IS NOT NULL),
  (SELECT avg(m.ris_posted_speed::numeric) FROM ${conflationTable} m WHERE m.ris = ANY(${edgesAlias}.ris) AND m.ris_posted_speed IS NOT NULL),
  (${HIGHWAY_SPEED_MPH_SQL.replaceAll("highway", `${edgesAlias}.highway`)})
)`;

const getDataTable = async (db, view_id) => {
  const { rows } = await db.query(
    `SELECT data_table FROM data_manager.views WHERE view_id = $1;`,
    [view_id]
  );
  if (!rows.length) throw new Error(`No view found for view_id ${view_id}`);
  return rows[0].data_table;
};

const snapToNearestNode = async (db, nodesTable, { lon, lat }) => {
  const { rows } = await db.query(
    `SELECT osm_id
       FROM ${nodesTable}
       ORDER BY wkb_geometry <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
       LIMIT 1;`,
    [lon, lat]
  );
  if (!rows.length) throw new Error(`No node found near [${lon}, ${lat}] in ${nodesTable}`);
  return rows[0].osm_id;
};

const NODES_QUERY_LIMIT = 500;

const getNodesInBbox = async (db, nodesTable, [minLon, minLat, maxLon, maxLat]) => {
  const { rows } = await db.query(
    `SELECT osm_id AS id, lon, lat
       FROM ${nodesTable}
       WHERE wkb_geometry && ST_MakeEnvelope($1, $2, $3, $4, 4326)
       LIMIT $5;`,
    [minLon, minLat, maxLon, maxLat, NODES_QUERY_LIMIT]
  );
  return rows;
};

// Viewport-scoped edge lookup for the detour/avoid-segment plugin's segment-picker layer
// (planning/transportny/tasks/current/detour-avoid-segment-routing-plugin.md) - same
// never-return-the-whole-network discipline as getNodesInBbox above. Returns each edge as a
// GeoJSON LineString feature (ogc_fid as the feature id) so the frontend can render + click it
// directly, no client-side geometry assembly needed.
const EDGES_QUERY_LIMIT = 2000;

const getEdgesInBbox = async (db, edgesTable, [minLon, minLat, maxLon, maxLat]) => {
  const { rows } = await db.query(
    `SELECT ogc_fid, highway, from_node, to_node, ST_AsGeoJSON(wkb_geometry) AS geojson
       FROM ${edgesTable}
       WHERE wkb_geometry && ST_MakeEnvelope($1, $2, $3, $4, 4326)
       LIMIT $5;`,
    [minLon, minLat, maxLon, maxLat, EDGES_QUERY_LIMIT]
  );
  return rows.map((r) => ({
    type: "Feature",
    id: +r.ogc_fid,
    properties: { ogc_fid: +r.ogc_fid, highway: r.highway, from_node: r.from_node, to_node: r.to_node },
    geometry: JSON.parse(r.geojson),
  }));
};

// Runs one pgr_trsp call against a given edge cost expression, then assembles the feature +
// segment list from the returned path. `costSql` must select (id, source, target, cost,
// reverse_cost) - the two callers below only differ in what "cost" means (distance vs. time).
const runTrspVariant = async (db, { conflationTable, edgesTable, costSql, restrictionsTable, sourceNodeId, destNodeId }) => {
  const { rows: path } = await db.query(
    `SELECT * FROM pgr_trsp(
       $1::text,
       'SELECT 1000000::float AS cost, ARRAY[from_edge, to_edge] AS path FROM ${restrictionsTable}',
       $2::bigint, $3::bigint, true
     );`,
    [costSql, sourceNodeId, destNodeId]
  );

  if (!path.length) {
    throw new Error(`No route found between node ${sourceNodeId} and ${destNodeId}`);
  }

  const edgeIds = path.slice(0, -1).map((p) => +p.edge);

  const { rows: edgeRows } = await db.query(
    `SELECT e.ogc_fid, e.osm, e.highway, e.from_node, e.to_node,
            ST_Length(e.wkb_geometry::geography) AS length_m,
            ST_Length(e.wkb_geometry::geography) / (${speedMphSql(conflationTable, "e")} * ${MPH_TO_MPS}) AS duration_s,
            ST_AsGeoJSON(e.wkb_geometry) AS geojson
       FROM ${edgesTable} e WHERE e.ogc_fid = ANY($1);`,
    [edgeIds]
  );
  const edgeById = new Map(edgeRows.map((r) => [+r.ogc_fid, r]));

  const coordinates = [];
  const segments = [];
  let totalLengthM = 0;
  let totalDurationS = 0;
  for (const edgeId of edgeIds) {
    const edgeRow = edgeById.get(edgeId);
    if (!edgeRow) continue;
    const geom = JSON.parse(edgeRow.geojson);
    const coords = geom.coordinates;
    if (coordinates.length && coordinates.at(-1)[0] === coords[0][0] && coordinates.at(-1)[1] === coords[0][1]) {
      coordinates.push(...coords.slice(1));
    } else {
      coordinates.push(...coords);
    }
    totalLengthM += +edgeRow.length_m;
    totalDurationS += +edgeRow.duration_s;
    segments.push({
      edge_id: edgeId,
      osm: edgeRow.osm,
      highway: edgeRow.highway,
      from_node: edgeRow.from_node,
      to_node: edgeRow.to_node,
      length_m: +edgeRow.length_m,
    });
  }

  const feature = {
    type: "Feature",
    properties: {
      cost: +path.at(-1).agg_cost,
      length: totalLengthM / METERS_PER_MILE,
      duration_s: totalDurationS,
      edge_count: edgeIds.length,
    },
    geometry: { type: "LineString", coordinates },
  };

  return { feature, segments };
};

// Computes both route variants (shortest-by-distance, fastest-by-time) sharing one endpoint
// resolution + restriction-table build, since those are the expensive shared setup. Each variant
// is its own independent, fully turn-restriction-aware pgr_trsp call - not true k-shortest-path
// alternates (see the task file's Phase 7 for why that's a separate, harder problem).
const computeTrspRoutes = async (db, pgEnv, { conflation_view_id, source, destination, source_node_id, dest_node_id }) => {
  const conflationTable = await getDataTable(db, conflation_view_id);
  const nodesTable = `${conflationTable}_nodes`;
  const edgesTable = `${conflationTable}_edges`;
  const relationsTable = `${conflationTable}_relations`;

  // Caller already picked exact nodes (the node-picker UX) -> skip the snap query entirely.
  // Otherwise fall back to snapping raw lon/lat (the original free-form-click UX).
  const [sourceNodeId, destNodeId] = source_node_id && dest_node_id
    ? [source_node_id, dest_node_id]
    : await Promise.all([
        snapToNearestNode(db, nodesTable, source),
        snapToNearestNode(db, nodesTable, destination),
      ]);

  // pgr_trsp evaluates restrictions_sql as its own independent statement - it cannot see a CTE
  // wrapped around the outer pgr_trsp call, so the restrictions have to be a real, materialized
  // temp table restrictions_sql can reference by name (confirmed by direct testing 2026-08-12).
  const restrictionsTable = `temp_trsp_restrictions_${pgEnv}_${sourceNodeId}_${destNodeId}`;

  // An unbounded pgr_trsp search over the full ~9.6M-edge network takes ~60-70s (confirmed by
  // direct testing) - too slow for dms-server's 30s non-/graph request timeout. Bound the
  // routing graph to a buffered box around the two endpoints instead, mirroring the deprecated
  // avail-falcor reference version's approach. Buffer is generous (endpoint span x2, floor
  // ~15mi) so a real detour route isn't clipped, not a tight/minimal box.
  const { rows: endpointRows } = await db.query(
    `SELECT osm_id AS id, lon, lat FROM ${nodesTable} WHERE osm_id = ANY($1);`,
    [[sourceNodeId, destNodeId]]
  );
  const endpointById = new Map(endpointRows.map((r) => [String(r.id), r]));
  const a = endpointById.get(String(sourceNodeId));
  const b = endpointById.get(String(destNodeId));
  if (!a || !b) throw new Error(`Could not resolve endpoint node(s) ${sourceNodeId}, ${destNodeId} in ${nodesTable}`);

  const MIN_BUFFER_DEG = 0.22; // ~15 miles at these latitudes
  const bufferDeg = Math.max(MIN_BUFFER_DEG, Math.abs(a.lon - b.lon), Math.abs(a.lat - b.lat));
  const minLon = Math.min(a.lon, b.lon) - bufferDeg;
  const maxLon = Math.max(a.lon, b.lon) + bufferDeg;
  const minLat = Math.min(a.lat, b.lat) - bufferDeg;
  const maxLat = Math.max(a.lat, b.lat) + bufferDeg;

  const bboxFilter = `WHERE wkb_geometry && ST_MakeEnvelope(${minLon}, ${minLat}, ${maxLon}, ${maxLat}, 4326)`;

  const distanceCostSql = `SELECT ogc_fid AS id, from_node AS source, to_node AS target,
                                   ST_Length(wkb_geometry::geography) AS cost, -1::float AS reverse_cost
                              FROM ${edgesTable} ${bboxFilter}`;
  const timeCostSql = `SELECT e.ogc_fid AS id, e.from_node AS source, e.to_node AS target,
                               ST_Length(e.wkb_geometry::geography) / (${speedMphSql(conflationTable, "e")} * ${MPH_TO_MPS}) AS cost,
                               -1::float AS reverse_cost
                          FROM ${edgesTable} e ${bboxFilter}`;

  let shortest;
  let fastest;
  let restrictionsConsidered = 0;

  // A pool-backed db.query() checks out a (possibly different) connection on every call - a
  // TEMP TABLE only exists within the session/connection that created it, so building the
  // restrictions table and then querying it via separate db.query() calls is a real race, not
  // just theoretical (confirmed live: "relation ... does not exist" once a second concurrent
  // variant landed on a different pooled connection). Check out one client and hold it for the
  // whole temp-table lifetime instead.
  const client = await db.getPool().connect();
  try {
    await client.query(`
      CREATE TEMP TABLE ${restrictionsTable} AS
      WITH rel AS (
        SELECT osm_id,
          (SELECT (m->>'id')::bigint FROM jsonb_array_elements(members) m WHERE m->>'role'='from' LIMIT 1) AS from_way,
          (SELECT (m->>'id')::bigint FROM jsonb_array_elements(members) m WHERE m->>'role'='to' LIMIT 1) AS to_way,
          (SELECT (m->>'id')::bigint FROM jsonb_array_elements(members) m WHERE m->>'role'='via' AND m->>'type'='node' LIMIT 1) AS via_node,
          (SELECT count(*) FROM jsonb_array_elements(members) m WHERE m->>'role'='via') AS via_count
        FROM ${relationsTable}
        WHERE resolved = true
      ),
      single_via AS (
        SELECT * FROM rel WHERE via_node IS NOT NULL AND via_count = 1
      )
      SELECT DISTINCT fe.ogc_fid AS from_edge, te.ogc_fid AS to_edge
        FROM single_via r
        JOIN ${edgesTable} fe ON fe.osm = r.from_way AND fe.to_node = r.via_node
        JOIN ${edgesTable} te ON te.osm = r.to_way AND te.from_node = r.via_node;
    `);

    const { rows: [{ count }] } = await client.query(`SELECT count(*) FROM ${restrictionsTable};`);
    restrictionsConsidered = +count;

    // Sequential, not Promise.all - a single client processes one query at a time regardless,
    // and sequential is explicit about that instead of relying on node-postgres to queue it.
    // explicit casts required: node-postgres sends untyped params, which pgr_trsp's overloaded
    // signatures can't resolve on their own (confirmed via "function pgr_trsp(...) is not
    // unique" without them).
    shortest = await runTrspVariant(client, { conflationTable, edgesTable, costSql: distanceCostSql, restrictionsTable, sourceNodeId, destNodeId });
    fastest = await runTrspVariant(client, { conflationTable, edgesTable, costSql: timeCostSql, restrictionsTable, sourceNodeId, destNodeId });
  } finally {
    await client.query(`DROP TABLE IF EXISTS ${restrictionsTable};`).catch(() => {});
    client.release();
  }

  shortest.feature.properties.restrictions_considered = restrictionsConsidered;
  fastest.feature.properties.restrictions_considered = restrictionsConsidered;

  return { shortest, fastest };
};

// Warm-load the default conflation view's in-memory graph shortly after the server boots, so the
// FIRST real request doesn't pay the ~80s cold-load cost (2026-08-20 user ask: "auto load cache
// for this graph so that it will response fast from the first api call itself").
//
// Kept in sync manually with the frontend plugins' own DEFAULT_CONFLATION_VIEW_ID
// (src/themes/transportny/components/routing/constants.js and .../detour/constants.js) - both
// point at this same view/pgEnv, so one warm-load benefits both plugins.
//
// DELIBERATELY DEFERRED, not fired immediately at registration: an earlier attempt (2026-08-19)
// called helpers.getDb(...) + the graph load synchronously at plugin-registration time, which
// raced the server's own DAMA-env init sequence for the SAME pgEnv and hung the entire server
// boot (confirmed live - the process never reached "DMS Server running"). A fixed delay is not
// a fully deterministic fix (there's no confirmed "server fully ready" hook to listen for
// instead), but 20s is comfortably past every boot sequence observed live in this task so far.
//
// Fire-and-forget: never blocks route registration, and any failure here just logs - the existing
// lazy load (getOrLoadGraph, called normally by /trsp-memory on the first real request) is the
// real fallback and is completely unaffected either way.
const WARM_LOAD_PG_ENV = "npmrds2";
const WARM_LOAD_CONFLATION_VIEW_ID = 3699;
const WARM_LOAD_DELAY_MS = 20_000;

module.exports = {
  routes: (router, helpers) => {
    setTimeout(() => {
      (async () => {
        try {
          const db = helpers.getDb(WARM_LOAD_PG_ENV);
          console.log(`[routing] warm-load starting for conflation_view_id=${WARM_LOAD_CONFLATION_VIEW_ID}...`);
          const t0 = Date.now();
          await memoryGraph.getOrLoadGraph(db, WARM_LOAD_PG_ENV, WARM_LOAD_CONFLATION_VIEW_ID);
          console.log(`[routing] warm-load done in ${Date.now() - t0}ms - /trsp-memory (routing + detour) is warm for view ${WARM_LOAD_CONFLATION_VIEW_ID}`);
        } catch (err) {
          console.error("[routing] warm-load failed (harmless - the first real request will load it lazily instead):", err.message);
        }
      })();
    }, WARM_LOAD_DELAY_MS);

    // Mounts as POST /dama-admin/:pgEnv/routing/trsp
    router.post("/trsp", async (req, res) => {
      try {
        const { conflation_view_id, source, destination, source_node_id, dest_node_id } = req.body || {};
        const hasNodeIds = source_node_id && dest_node_id;
        if (!conflation_view_id || (!hasNodeIds && (!source || !destination))) {
          return res.status(400).json({
            ok: false,
            error: "conflation_view_id is required, plus either {source_node_id, dest_node_id} or {source, destination}",
          });
        }

        console.log("[routing/trsp] request:", { conflation_view_id, source, destination, source_node_id, dest_node_id });
        const db = helpers.getDb(req.params.pgEnv);
        const { shortest, fastest } = await computeTrspRoutes(db, req.params.pgEnv, {
          conflation_view_id, source, destination, source_node_id, dest_node_id,
        });
        res.json({ ok: true, result: { routes: { shortest, fastest } } });
      } catch (err) {
        console.error("[routing/trsp] failed:", err);
        res.json({ ok: false, error: err.message });
      }
    });

    // Mounts as POST /dama-admin/:pgEnv/routing/trsp-memory
    // Phase 11 Stage A: same {shortest, fastest} contract as /trsp, computed via an in-memory
    // typed-array graph instead of per-request SQL. NEW, ADDITIVE route - /trsp above is
    // completely untouched. First request for a given conflation_view_id pays a one-time graph
    // load cost (logged); every request after that reuses the cached in-memory graph.
    //
    // Optional body field `algorithm`: "dijkstra" (default, unchanged) or "bidirectional" - a
    // second exact search that grows from both source and destination at once, meant to cut the
    // long-route case (plain Dijkstra with no destination-awareness explores outward until it
    // happens to reach the destination - measured at ~7s for a ~280km route). Defaulting to
    // "dijkstra" means existing callers see no behavior change; this is a param, not a new route,
    // specifically so the already-verified default path stays exactly as it was.
    //
    // Optional body field `excluded_edge_ids` (array of ogc_fid values) - the detour/avoid-segment
    // plugin (planning/transportny/tasks/current/detour-avoid-segment-routing-plugin.md): forces
    // the search to route around those edges (and their reverse-direction counterparts, so both
    // directions of the physical road are excluded) for THIS request only. The shared cached
    // in-memory graph is never mutated - see findRoute()'s excludedEdgeOgcFids handling.
    router.post("/trsp-memory", async (req, res) => {
      try {
        const { conflation_view_id, source, destination, algorithm, excluded_edge_ids } = req.body || {};
        if (!conflation_view_id || !source || !destination) {
          return res.status(400).json({ ok: false, error: "conflation_view_id, source, and destination are required" });
        }

        // Default is plain dijkstra, unchanged. Smart auto-dispatch (choosing bidirectional by
        // straight-line distance) was tried 2026-08-19, then explicitly reverted per user request
        // ("keep it here the stuff for the dijkstra only but keep code for bi directional also") -
        // bidirectionalDijkstra() stays available as an explicit `algorithm: "bidirectional"`
        // override (see the 20-pair verification in point-to-point-routing-plugin.md for why the
        // auto-dispatch threshold wasn't a clean win worth keeping as the default behavior).
        const resolvedAlgorithm = algorithm || "dijkstra";

        const db = helpers.getDb(req.params.pgEnv);
        const t0 = Date.now();
        const graph = await memoryGraph.getOrLoadGraph(db, req.params.pgEnv, conflation_view_id);
        const loadMs = Date.now() - t0;

        const t1 = Date.now();
        const [shortest, fastest] = await Promise.all([
          memoryGraph.findRoute(db, graph, source, destination, "distance", resolvedAlgorithm, excluded_edge_ids),
          memoryGraph.findRoute(db, graph, source, destination, "time", resolvedAlgorithm, excluded_edge_ids),
        ]);
        const searchMs = Date.now() - t1;
        console.log("[routing/trsp-memory]", { conflation_view_id, algorithm: resolvedAlgorithm, excludedCount: excluded_edge_ids?.length || 0, loadMs, searchMs });

        res.json({ ok: true, result: { routes: { shortest, fastest }, timing: { loadMs, searchMs } } });
      } catch (err) {
        console.error("[routing/trsp-memory] failed:", err);
        res.json({ ok: false, error: err.message });
      }
    });

    // Mounts as GET /dama-admin/:pgEnv/routing/nodes?conflation_view_id=&bbox=minLon,minLat,maxLon,maxLat
    // Viewport-scoped node lookup for the node-picker UX (Phase 6) - the _nodes table has ~5M
    // rows for the view currently in use, so this deliberately never returns "all nodes", only
    // whatever's in the requested bbox, capped at NODES_QUERY_LIMIT.
    router.get("/nodes", async (req, res) => {
      try {
        const { conflation_view_id, bbox } = req.query;
        const bboxParts = (bbox || "").split(",").map(Number);
        if (!conflation_view_id || bboxParts.length !== 4 || bboxParts.some(Number.isNaN)) {
          return res.status(400).json({ ok: false, error: "conflation_view_id and bbox=minLon,minLat,maxLon,maxLat are required" });
        }

        const db = helpers.getDb(req.params.pgEnv);
        const conflationTable = await getDataTable(db, conflation_view_id);
        const nodes = await getNodesInBbox(db, `${conflationTable}_nodes`, bboxParts);
        res.json({ ok: true, result: { nodes } });
      } catch (err) {
        console.error("[routing/nodes] failed:", err);
        res.json({ ok: false, error: err.message });
      }
    });

    // Mounts as GET /dama-admin/:pgEnv/routing/edges?conflation_view_id=&bbox=minLon,minLat,maxLon,maxLat
    // Viewport-scoped edge lookup for the detour/avoid-segment plugin's segment-picker layer -
    // NEW route, added alongside the existing /nodes route above (same bbox-scoped,
    // never-return-the-whole-network discipline - see getEdgesInBbox).
    router.get("/edges", async (req, res) => {
      try {
        const { conflation_view_id, bbox } = req.query;
        const bboxParts = (bbox || "").split(",").map(Number);
        if (!conflation_view_id || bboxParts.length !== 4 || bboxParts.some(Number.isNaN)) {
          return res.status(400).json({ ok: false, error: "conflation_view_id and bbox=minLon,minLat,maxLon,maxLat are required" });
        }

        const db = helpers.getDb(req.params.pgEnv);
        const conflationTable = await getDataTable(db, conflation_view_id);
        const edges = await getEdgesInBbox(db, `${conflationTable}_edges`, bboxParts);
        res.json({ ok: true, result: { edges } });
      } catch (err) {
        console.error("[routing/edges] failed:", err);
        res.json({ ok: false, error: err.message });
      }
    });

    // Mounts as POST /dama-admin/:pgEnv/routing/trsp-memory-density-points
    // Closure coverage/density analysis, STEP 1/2 (2026-08-21 - split into two calls so the
    // frontend can show/confirm candidate points before committing to the expensive full
    // analysis; also lets the timing of point-selection vs. route-tallying be measured
    // separately). Returns candidate start/end points only, no route tallying yet.
    router.post("/trsp-memory-density-points", async (req, res) => {
      try {
        const { conflation_view_id, ogc_fid, num_candidates, cost_objective } = req.body || {};
        if (!conflation_view_id || !ogc_fid) {
          return res.status(400).json({ ok: false, error: "conflation_view_id and ogc_fid are required" });
        }

        const db = helpers.getDb(req.params.pgEnv);
        const t0 = Date.now();
        const graph = await memoryGraph.getOrLoadGraph(db, req.params.pgEnv, conflation_view_id);
        const loadMs = Date.now() - t0;

        const t1 = Date.now();
        const result = await memoryGraph.selectClosureDensityCandidates(graph, ogc_fid, num_candidates || 10, cost_objective || "distance");
        const searchMs = Date.now() - t1;
        console.log("[routing/trsp-memory-density-points]", {
          conflation_view_id, ogc_fid,
          startPoints: result.startPoints.length, endPoints: result.endPoints.length,
          candidatesRejected: result.candidatesRejected,
          // Real achieved gap (meters), after any relaxation - see selectClosureDensityCandidates.
          startGapUsedM: result.startGapUsedM, endGapUsedM: result.endGapUsedM,
          loadMs, searchMs,
        });

        res.json({ ok: true, result: { ...result, timing: { loadMs, searchMs } } });
      } catch (err) {
        console.error("[routing/trsp-memory-density-points] failed:", err);
        res.json({ ok: false, error: err.message });
      }
    });

    // Mounts as POST /dama-admin/:pgEnv/routing/trsp-memory-density
    // Closure coverage/density analysis, STEP 2/2 - runs the actual closed-route tally over
    // ALREADY-SELECTED points (osm ids, from the /trsp-memory-density-points call above). Runs
    // up to start_node_ids.length * end_node_ids.length searches server-side, in-memory, in one
    // request - see memoryGraph.js's computeClosureDensityFromPoints for why this isn't N*M
    // separate frontend calls.
    router.post("/trsp-memory-density", async (req, res) => {
      try {
        const { conflation_view_id, ogc_fid, start_node_ids, end_node_ids, cost_objective } = req.body || {};
        if (!conflation_view_id || !ogc_fid || !start_node_ids?.length || !end_node_ids?.length) {
          return res.status(400).json({ ok: false, error: "conflation_view_id, ogc_fid, start_node_ids, and end_node_ids are required" });
        }

        const db = helpers.getDb(req.params.pgEnv);
        const t0 = Date.now();
        const graph = await memoryGraph.getOrLoadGraph(db, req.params.pgEnv, conflation_view_id);
        const loadMs = Date.now() - t0;

        const t1 = Date.now();
        const result = await memoryGraph.computeClosureDensityFromPoints(db, graph, ogc_fid, start_node_ids, end_node_ids, cost_objective || "distance");
        const searchMs = Date.now() - t1;
        console.log("[routing/trsp-memory-density]", {
          conflation_view_id, ogc_fid,
          totalPairsComputed: result.totalPairsComputed, totalPairsFailed: result.totalPairsFailed,
          loadMs, searchMs,
        });

        res.json({ ok: true, result: { ...result, timing: { loadMs, searchMs } } });
      } catch (err) {
        console.error("[routing/trsp-memory-density] failed:", err);
        res.json({ ok: false, error: err.message });
      }
    });
  },
};
