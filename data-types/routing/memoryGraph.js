
/**
 * Stage A (Phase 11) - in-memory routing graph, replacing per-request SQL for the pathfinding
 * itself. Loaded once per conflation view, cached in a module-level singleton, reused across
 * requests. See planning/transportny/tasks/current/point-to-point-routing-plugin.md's Phase 11
 * for the full design writeup and why this is a NEW, additive route (trsp.routing.js /
 * index.js's existing /trsp SQL path is untouched).
 *
 * Deliberately does NOT use graphology or any object/Map-based graph library - the conflation
 * repo's own ROUTING_LOG.md documents graphology crashing at full network scale (a hard V8 `Map`
 * size limit building an edge-expansion graph). This uses flat typed arrays instead, which don't
 * have that ceiling and are far more memory-efficient.
 *
 * Turn restrictions require edge-expansion (the search state is "arrived via edge E", not just
 * "at node N") for the same reason pgr_trsp needs it - a two-way road's both directions share the
 * same two node ids, so plain node-based Dijkstra can't distinguish "continuing straight" from
 * "illegally reversing." Every dist/prev/settled array here is sized by EDGE count, not node
 * count.
 */

const densitySearchPool = require("./densitySearchPool");

const METERS_PER_MILE = 1609.344;
const MPH_TO_MPS = 0.44704;

const HIGHWAY_SPEED_MPH = {
  motorway: 65.0, motorway_link: 45.0,
  trunk: 65.0, trunk_link: 45.0,
  primary: 55.0, primary_link: 35.0,
  secondary: 45.0, secondary_link: 25.0,
  tertiary: 45.0, tertiary_link: 25.0,
  unclassified: 45.0,
  residential: 30.0,
  living_street: 15.0,
};
const DEFAULT_SPEED_MPH = 45.0;

// module-level singleton cache: pgEnv -> Promise<Graph> (one hardcoded 2025 table set, see
// resolveConflationTables - no per-version key needed anymore)
const graphCache = new Map();

// Closure-density RESULTS caches - same two tricks as graphCache/getOrLoadGraph below and
// densitySearchPool.js's poolsByGraph: WeakMap keyed by the graph object (auto-GC'd on
// invalidateGraph(), no manual clearing) storing the in-flight PROMISE (concurrent callers for the
// same segment share one computation). One cache per pipeline step. Full design + live-test
// results: planning/transportny/tasks/current/detour-avoid-segment-routing-plugin.md.
const pointsResultCache = new WeakMap(); // graph -> Map<"ogcFid:numCandidates:costObjective", entry>
const tallyResultCache = new WeakMap(); // graph -> Map<"ogcFid:costObjective:startIds:endIds", entry>

// Memoize + refcounted cancellation. `compute(requestTag, onPool)` must call onPool(pool) once
// resolved and thread requestTag into runBatch/runTallyBatch. If `signal` aborts, only once every
// caller sharing this entry has aborted (refCount hits 0) do the still-queued tasks get dropped -
// see the task doc's "plain-language version" for a worked example.
const memoizeByGraph = (weakMap, graph, key, compute, signal) => {
  let byKey = weakMap.get(graph);
  if (!byKey) { byKey = new Map(); weakMap.set(graph, byKey); }
  let entry = byKey.get(key);
  if (!entry) {
    entry = { refCount: 0, requestTag: `${key}#${Date.now()}#${Math.random().toString(36).slice(2)}`, pool: null };
    entry.promise = compute(entry.requestTag, (pool) => { entry.pool = pool; }).catch((err) => {
      byKey.delete(key); // don't cache a failed computation
      throw err;
    });
    byKey.set(key, entry);
  }
  entry.refCount++;
  if (signal) {
    const onAbort = () => {
      entry.refCount--;
      if (entry.refCount > 0 || !entry.pool) return; // still has interested callers, or pool not resolved yet - nothing to drop
      const dropped = entry.pool.taskQueue.cancelTag(entry.requestTag);
      if (dropped > 0) console.log(`[closure-density cache] cancelled ${dropped} queued tasks for ${entry.requestTag} (last subscriber aborted)`);
    };
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  return entry.promise;
};

// edgeOgcFid is loaded ORDER BY ogc_fid, so it's sorted ascending - binary search stands in for
// the Map<ogc_fid, index> that blew V8's map capacity at ~8.2M entries (see file header).
const findEdgeIndexByOgcFid = (edgeOgcFid, targetOgcFid) => {
  let lo = 0, hi = edgeOgcFid.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const v = edgeOgcFid[mid];
    if (v === targetOgcFid) return mid;
    if (v < targetOgcFid) lo = mid + 1; else hi = mid - 1;
  }
  return -1;
};

// Conflation source ids + target version. SOURCE ids are PERMANENT - they never change across a
// conflation reprocess, only which VIEW under each source is "current" does (a fresh reprocess
// mints a brand-new view_id AND a brand-new physical table name). Hardcoding the literal table
// name goes stale the moment the pipeline reprocesses, exactly like the old per-plugin
// `DEFAULT_CONFLATION_VIEW_ID` did across 3608->3689->3692->3699. Hardcoding source_id + a target
// version string instead and resolving the CURRENT view/table for that pair survives a reprocess
// automatically, as long as the reprocess re-publishes under the SAME version string.
const MAIN_CONFLATION_SOURCE_ID = 2125;
const NODES_SOURCE_ID = 2096;
const EDGES_SOURCE_ID = 2097;
const RELATIONS_SOURCE_ID = 2098;
const CURRENT_CONFLATION_VERSION = "2025";

// Raw OSM-with-tags source ("OSM v2", source 2074) - used to detect bridge edges (tags ? 'bridge')
// for the whole-bridge-closure widening in closureContext() below. Version string is that
// source's own dated-snapshot format (YYMMDD), NOT the conflation version string above - confirmed
// via a live join test (planning/transportny/tasks/current/detour-avoid-segment-routing-plugin.md,
// "bridge identification" section): "250101" gives a 100% osm-id match rate against the 2025
// conflation edges (the exact vintage it was conflated against), vs. 99.05% for the newer "260831"
// snapshot - confirming this is the correct paired version, not just "the latest."
const OSM_V2_SOURCE_ID = 2074;
const OSM_V2_VERSION = "250101";

// Bridge candidate points (source 2137) - the standalone bridge-detour-process tool's own
// verified bridge->edge matches (NYSDOT's 258-bridge inventory, each already snapped to the
// correct conflation edge by that tool's two-pass matching, including its overpass-mismatch
// fix - see /home/sarang/Documents/avail/bridge-detour-process/FINDINGS.md). Used here as a
// SECOND bridge-identification signal alongside the OSM `bridge` tag: a real bridge (e.g. US6/
// BIN 1003090) can be a legitimate bridge with no `bridge` tag in OSM at all, which silently
// under-widens the tag-only closure and lets a route bypass through the untagged remainder of
// the same physical structure. This table has no version string (each reprocess just mints a
// new sequential view_id), so it resolves by "latest view_id" rather than a pinned version.
const BRIDGE_CANDIDATE_SOURCE_ID = 2137;

const findViewTableBySourceAndVersion = async (db, sourceId, version) => {
  const { rows } = await db.query(
    `SELECT data_table FROM data_manager.views WHERE source_id = $1 AND version = $2;`,
    [sourceId, version]
  );
  if (!rows.length) throw new Error(`No view found for source_id ${sourceId}, version "${version}"`);
  return rows[0].data_table;
};

const findLatestViewTable = async (db, sourceId) => {
  const { rows } = await db.query(
    `SELECT data_table FROM data_manager.views WHERE source_id = $1 ORDER BY view_id DESC LIMIT 1;`,
    [sourceId]
  );
  if (!rows.length) throw new Error(`No view found for source_id ${sourceId}`);
  return rows[0].data_table;
};

// Resolved ONCE per server process and cached forever after (module-level memoized promise) -
// this is what keeps table-name resolution from costing anything at request time. Every caller
// (loadGraph, and every per-request route below that still calls this directly) shares the SAME
// resolution: the first caller pays the four-query DB round trip (fast in practice - four indexed
// lookups against `data_manager.views`); every caller after that, including every real user
// request for the rest of the process's uptime, gets the cached result synchronously with zero DB
// cost. In practice the FIRST caller is the warm-load (`data-types/routing/index.js`, ~20s after
// boot), so real user traffic essentially never pays this cost at all, only the warm-load does,
// once, at startup.
let cachedTablesPromise = null;
const resolveConflationTables = (db) => {
  if (!cachedTablesPromise) {
    cachedTablesPromise = Promise.all([
      findViewTableBySourceAndVersion(db, MAIN_CONFLATION_SOURCE_ID, CURRENT_CONFLATION_VERSION),
      findViewTableBySourceAndVersion(db, NODES_SOURCE_ID, CURRENT_CONFLATION_VERSION),
      findViewTableBySourceAndVersion(db, EDGES_SOURCE_ID, CURRENT_CONFLATION_VERSION),
      findViewTableBySourceAndVersion(db, RELATIONS_SOURCE_ID, CURRENT_CONFLATION_VERSION),
      findViewTableBySourceAndVersion(db, OSM_V2_SOURCE_ID, OSM_V2_VERSION),
      findLatestViewTable(db, BRIDGE_CANDIDATE_SOURCE_ID),
    ]).then(([conflationTable, nodesTable, edgesTable, relationsTable, osmWaysTable, bridgeCandidateTable]) => ({
      conflationTable, nodesTable, edgesTable, relationsTable, osmWaysTable, bridgeCandidateTable,
    })).catch((err) => {
      cachedTablesPromise = null; // don't cache a failed resolution - let the next caller retry
      throw err;
    });
  }
  return cachedTablesPromise;
};

// Simple uniform grid spatial index over node coordinates, for nearest-node snapping without a
// per-request SQL/GIST lookup. Not as precise as a real k-d tree, but simple, correct, and fast
// enough for point queries against a real-world node distribution.
class NodeGrid {
  constructor(lons, lats, cellSizeDeg) {
    this.lons = lons;
    this.lats = lats;
    this.cellSize = cellSizeDeg;
    this.buckets = new Map(); // "cx,cy" -> array of node indices
    for (let i = 0; i < lons.length; i++) {
      const key = this._cellKey(lons[i], lats[i]);
      let bucket = this.buckets.get(key);
      if (!bucket) { bucket = []; this.buckets.set(key, bucket); }
      bucket.push(i);
    }
  }

  _cellKey(lon, lat) {
    const cx = Math.floor(lon / this.cellSize);
    const cy = Math.floor(lat / this.cellSize);
    return `${cx},${cy}`;
  }

  nearest(lon, lat) {
    const cx = Math.floor(lon / this.cellSize);
    const cy = Math.floor(lat / this.cellSize);
    let best = -1;
    let bestDist = Infinity;
    let foundAtRing = -1;
    for (let ring = 0; ring < 50; ring++) {
      for (let dx = -ring; dx <= ring; dx++) {
        for (let dy = -ring; dy <= ring; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue; // only the new ring's perimeter
          const bucket = this.buckets.get(`${cx + dx},${cy + dy}`);
          if (!bucket) continue;
          for (const nodeIdx of bucket) {
            const dlon = this.lons[nodeIdx] - lon;
            const dlat = this.lats[nodeIdx] - lat;
            const d = dlon * dlon + dlat * dlat; // squared degrees, fine for comparison
            if (d < bestDist) { bestDist = d; best = nodeIdx; }
          }
        }
      }
      if (best !== -1 && foundAtRing === -1) foundAtRing = ring;
      // one extra ring past the first hit, since a closer point could sit just across a cell
      // boundary in a ring we haven't checked yet
      if (foundAtRing !== -1 && ring > foundAtRing) break;
    }
    return best;
  }
}

// Binary min-heap over (edgeIdx, dist) pairs, via parallel arrays - avoids per-node object
// allocation during the search.
class MinHeap {
  constructor(capacityHint) {
    this.edgeIdx = new Int32Array(capacityHint);
    this.dist = new Float64Array(capacityHint);
    this.size = 0;
  }

  _ensureCapacity() {
    if (this.size < this.edgeIdx.length) return;
    const newEdgeIdx = new Int32Array(this.edgeIdx.length * 2);
    const newDist = new Float64Array(this.dist.length * 2);
    newEdgeIdx.set(this.edgeIdx);
    newDist.set(this.dist);
    this.edgeIdx = newEdgeIdx;
    this.dist = newDist;
  }

  push(edgeIdx, dist) {
    this._ensureCapacity();
    let i = this.size++;
    this.edgeIdx[i] = edgeIdx;
    this.dist[i] = dist;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.dist[parent] <= this.dist[i]) break;
      this._swap(parent, i);
      i = parent;
    }
  }

  pop() {
    if (this.size === 0) return null;
    const topEdge = this.edgeIdx[0];
    const topDist = this.dist[0];
    this.size--;
    this.edgeIdx[0] = this.edgeIdx[this.size];
    this.dist[0] = this.dist[this.size];
    let i = 0;
    while (true) {
      const left = 2 * i + 1, right = 2 * i + 2;
      let smallest = i;
      if (left < this.size && this.dist[left] < this.dist[smallest]) smallest = left;
      if (right < this.size && this.dist[right] < this.dist[smallest]) smallest = right;
      if (smallest === i) break;
      this._swap(i, smallest);
      i = smallest;
    }
    return { edgeIdx: topEdge, dist: topDist };
  }

  _swap(a, b) {
    const ei = this.edgeIdx[a]; this.edgeIdx[a] = this.edgeIdx[b]; this.edgeIdx[b] = ei;
    const d = this.dist[a]; this.dist[a] = this.dist[b]; this.dist[b] = d;
  }

  get isEmpty() { return this.size === 0; }

  // top dist without removing - lets the bidirectional search compare both frontiers' next cost
  // before deciding which side to step, without popping-and-pushing-back.
  peek() { return this.size === 0 ? Infinity : this.dist[0]; }
}

const loadGraph = async (db) => {
  const { conflationTable, nodesTable, edgesTable, relationsTable, osmWaysTable, bridgeCandidateTable } = await resolveConflationTables(db);

  console.log(`[memoryGraph] loading nodes from ${nodesTable}...`);
  const { rows: nodeRows } = await db.query(`SELECT osm_id, lon, lat FROM ${nodesTable};`);
  const numNodes = nodeRows.length;
  const nodeOsmId = new Float64Array(numNodes);
  const nodeLon = new Float64Array(numNodes);
  const nodeLat = new Float64Array(numNodes);
  const nodeIdToIndex = new Map();
  for (let i = 0; i < numNodes; i++) {
    const r = nodeRows[i];
    nodeOsmId[i] = +r.osm_id;
    nodeLon[i] = +r.lon;
    nodeLat[i] = +r.lat;
    nodeIdToIndex.set(String(r.osm_id), i);
  }
  console.log(`[memoryGraph] loaded ${numNodes} nodes`);

  // Real-speed lookup, set-based instead of a per-edge correlated subquery: the correlated-
  // subquery form was proven fast (~0.14s) only against a small bbox-scoped edge set (Phase 9's
  // benchmark) - run against the FULL ~9.6M-edge table it never finished in a reasonable time
  // (confirmed live: still running after 30s+, no per-row index lookup at this row count is
  // cheap enough to repeat 9.6M times). Two small aggregate queries (one row per distinct
  // tmc/ris code, not per edge) plus a plain-JS lookup per edge instead.
  console.log(`[memoryGraph] loading tmc/ris speed lookups...`);
  const { rows: tmcSpeedRows } = await db.query(
    `SELECT tmc, avg(tmc_avg_speedlimit) AS speed FROM ${conflationTable} WHERE tmc IS NOT NULL AND tmc_avg_speedlimit IS NOT NULL GROUP BY tmc;`
  );
  const tmcSpeedByCode = new Map(tmcSpeedRows.map((r) => [r.tmc, +r.speed]));
  const { rows: risSpeedRows } = await db.query(
    `SELECT ris, avg(ris_posted_speed::numeric) AS speed FROM ${conflationTable} WHERE ris IS NOT NULL AND ris_posted_speed IS NOT NULL GROUP BY ris;`
  );
  const risSpeedByCode = new Map(risSpeedRows.map((r) => [r.ris, +r.speed]));
  console.log(`[memoryGraph] ${tmcSpeedByCode.size} tmc + ${risSpeedByCode.size} ris speed codes loaded`);

  console.log(`[memoryGraph] counting edges in ${edgesTable}...`);
  const { rows: countRows } = await db.query(`SELECT count(*) AS n FROM ${edgesTable};`);
  const numEdges = +countRows[0].n;
  const edgeSource = new Int32Array(numEdges);
  const edgeTarget = new Int32Array(numEdges);
  const edgeLengthM = new Float32Array(numEdges);
  const edgeDurationS = new Float32Array(numEdges);
  const edgeOgcFid = new Float64Array(numEdges);
  const edgeHighway = new Array(numEdges);
  // NOT a Map<ogc_fid, index> - a Map that size (~9.6M string keys) blew V8's map capacity
  // ("Map maximum size exceeded", confirmed live at ~8.2M entries loaded). Edges are loaded
  // ORDER BY ogc_fid, so edgeOgcFid is sorted ascending; binary search below replaces the Map
  // for restrictions' occasional from_edge/to_edge lookups (small volume, not a hot loop).

  // Batched, keyset-paginated load (ORDER BY ogc_fid > lastId LIMIT batchSize) instead of one
  // SELECT for all ~9.6M rows - materializing every row as a JS object simultaneously (node-postgres
  // holds the full result set in memory before returning) OOM-crashed the whole server process
  // (confirmed live: "JavaScript heap out of memory", process aborted). Each batch's rows are
  // consumed straight into the typed arrays and dropped, so peak memory is one batch, not all rows.
  console.log(`[memoryGraph] loading ${numEdges} edges from ${edgesTable} in batches...`);
  const EDGE_BATCH_SIZE = 200000;
  let skippedUnresolvedNode = 0;
  let lastId = -1;
  let i = 0;
  while (true) {
    const { rows: batch } = await db.query(
      `SELECT ogc_fid, from_node, to_node, highway, tmc, ris,
              ST_Length(wkb_geometry::geography) AS length_m
         FROM ${edgesTable}
        WHERE ogc_fid > $1
        ORDER BY ogc_fid
        LIMIT $2;`,
      [lastId, EDGE_BATCH_SIZE]
    );
    if (batch.length === 0) break;
    for (const r of batch) {
      const srcIdx = nodeIdToIndex.get(String(r.from_node));
      const tgtIdx = nodeIdToIndex.get(String(r.to_node));
      if (srcIdx === undefined || tgtIdx === undefined) {
        skippedUnresolvedNode++;
        edgeSource[i] = -1; edgeTarget[i] = -1;
        edgeOgcFid[i] = +r.ogc_fid; // keep edgeOgcFid monotonic (rows arrive ORDER BY ogc_fid) for binary search
        i++;
        continue;
      }
      edgeSource[i] = srcIdx;
      edgeTarget[i] = tgtIdx;
      const lengthM = +r.length_m;
      edgeLengthM[i] = lengthM;
      // Must match the SQL path's COALESCE(avg(tmc matches), avg(ris matches)) exactly - averaging
      // across ALL matching codes on the edge, not just the first. Taking only the first match
      // (an earlier version of this loop) produced a real ~0.07% cost discrepancy on a live
      // comparison against /trsp, caught by re-running real OD pairs post-hoc, not by inspection.
      const tmcCodes = r.tmc || [];
      const risCodes = r.ris || [];
      let tmcSum = 0, tmcN = 0;
      for (const t of tmcCodes) { if (tmcSpeedByCode.has(t)) { tmcSum += tmcSpeedByCode.get(t); tmcN++; } }
      let matchedSpeed = tmcN > 0 ? tmcSum / tmcN : null;
      if (matchedSpeed === null) {
        let risSum = 0, risN = 0;
        for (const rc of risCodes) { if (risSpeedByCode.has(rc)) { risSum += risSpeedByCode.get(rc); risN++; } }
        matchedSpeed = risN > 0 ? risSum / risN : null;
      }
      const speedMph = matchedSpeed !== null ? matchedSpeed : (HIGHWAY_SPEED_MPH[r.highway] || DEFAULT_SPEED_MPH);
      edgeDurationS[i] = lengthM / (speedMph * MPH_TO_MPS);
      edgeOgcFid[i] = +r.ogc_fid;
      edgeHighway[i] = r.highway;
      i++;
    }
    lastId = +batch[batch.length - 1].ogc_fid;
    console.log(`[memoryGraph] ...${i}/${numEdges} edges loaded`);
    if (batch.length < EDGE_BATCH_SIZE) break;
  }
  if (skippedUnresolvedNode > 0) {
    console.log(`[memoryGraph] WARNING: ${skippedUnresolvedNode} edges reference a node not in ${nodesTable}, excluded`);
  }
  console.log(`[memoryGraph] loaded ${i} edges`);

  // CSR adjacency: for each node, the list of outgoing edge indices, sorted by source node.
  console.log(`[memoryGraph] building adjacency index...`);
  const outDegree = new Int32Array(numNodes);
  for (let i = 0; i < numEdges; i++) {
    if (edgeSource[i] >= 0) outDegree[edgeSource[i]]++;
  }
  const adjHead = new Int32Array(numNodes + 1);
  for (let i = 0; i < numNodes; i++) adjHead[i + 1] = adjHead[i] + outDegree[i];
  const adjEdgeIndex = new Int32Array(adjHead[numNodes]);
  const fillPos = adjHead.slice(0, numNodes);
  for (let i = 0; i < numEdges; i++) {
    const src = edgeSource[i];
    if (src < 0) continue;
    adjEdgeIndex[fillPos[src]++] = i;
  }

  // Restrictions: same validated single-node-via query as the SQL path, run once here instead of
  // per-request. Encoded as fromEdgeIdx * (numEdges+1) + toEdgeIdx - a unique integer per pair,
  // safely within Number.MAX_SAFE_INTEGER for realistic edge counts (numEdges^2 << 2^53).
  console.log(`[memoryGraph] building restrictions...`);
  const { rows: restrictionRows } = await db.query(`
    WITH rel AS (
      SELECT osm_id,
        (SELECT (m->>'id')::bigint FROM jsonb_array_elements(members) m WHERE m->>'role'='from' LIMIT 1) AS from_way,
        (SELECT (m->>'id')::bigint FROM jsonb_array_elements(members) m WHERE m->>'role'='to' LIMIT 1) AS to_way,
        (SELECT (m->>'id')::bigint FROM jsonb_array_elements(members) m WHERE m->>'role'='via' AND m->>'type'='node' LIMIT 1) AS via_node,
        (SELECT count(*) FROM jsonb_array_elements(members) m WHERE m->>'role'='via') AS via_count
      FROM ${relationsTable} WHERE resolved = true
    ), sv AS (SELECT * FROM rel WHERE via_node IS NOT NULL AND via_count = 1)
    SELECT DISTINCT fe.ogc_fid AS from_edge, te.ogc_fid AS to_edge
      FROM sv r JOIN ${edgesTable} fe ON fe.osm = r.from_way AND fe.to_node = r.via_node
      JOIN ${edgesTable} te ON te.osm = r.to_way AND te.from_node = r.via_node;
  `);
  const restrictionSet = new Set();
  const edgeCountForEncoding = numEdges + 1;
  for (const r of restrictionRows) {
    const fromIdx = findEdgeIndexByOgcFid(edgeOgcFid, +r.from_edge);
    const toIdx = findEdgeIndexByOgcFid(edgeOgcFid, +r.to_edge);
    if (fromIdx === -1 || toIdx === -1) continue;
    restrictionSet.add(fromIdx * edgeCountForEncoding + toIdx);
  }
  console.log(`[memoryGraph] ${restrictionSet.size} restrictions loaded`);

  // Reverse CSR adjacency (incoming edges per node), needed for the bidirectional search to walk
  // backward from the destination - built the same way as the forward index, just keyed by
  // edgeTarget instead of edgeSource.
  console.log(`[memoryGraph] building reverse adjacency index...`);
  const inDegree = new Int32Array(numNodes);
  for (let i = 0; i < numEdges; i++) {
    if (edgeTarget[i] >= 0) inDegree[edgeTarget[i]]++;
  }
  const inAdjHead = new Int32Array(numNodes + 1);
  for (let i = 0; i < numNodes; i++) inAdjHead[i + 1] = inAdjHead[i] + inDegree[i];
  const inAdjEdgeIndex = new Int32Array(inAdjHead[numNodes]);
  const inFillPos = inAdjHead.slice(0, numNodes);
  for (let i = 0; i < numEdges; i++) {
    const tgt = edgeTarget[i];
    if (tgt < 0) continue;
    inAdjEdgeIndex[inFillPos[tgt]++] = i;
  }

  const nodeGrid = new NodeGrid(nodeLon, nodeLat, 0.02); // ~1.5mi cells at these latitudes

  // Whole-bridge closure widening (generalized from the standalone bridge-detour-process tool -
  // see planning/transportny/tasks/current/detour-avoid-segment-routing-plugin.md's "bridge
  // identification" section): a bridge's OSM way can be split into several one-directional
  // conflation edges with no same-osm reverse twin on any of them (a forward/backward pair is the
  // two-way-road norm; these form a small one-directional triangle/loop instead). Closing only the
  // matched edge + its own reverse twin leaves the rest of the same physical structure open to
  // route around through. Two independent signals feed this, unioned by OSM way:
  //   1. OSM's own `bridge` tag (~70k of 10M edges) - the general, statewide signal.
  //   2. Bridge candidate points (source 2137) - the standalone bridge-detour-process tool's own
  //      verified 258-bridge inventory, snapped to its correct edge already. Catches real bridges
  //      with no OSM tag at all (e.g. US6/BIN 1003090, confirmed missing the `bridge` tag on its
  //      own way - tag-only widening left it under-closed and a route bypassed through the
  //      untagged remainder of the same structure).
  console.log(`[memoryGraph] finding bridge edges via ${osmWaysTable} and ${bridgeCandidateTable}...`);
  const { rows: bridgeEdgeRows } = await db.query(`
    SELECT e.ogc_fid, e.osm, e.from_node, e.to_node
      FROM ${edgesTable} e
      JOIN ${osmWaysTable} o ON o.osm_id = e.osm
     WHERE o.tags ? 'bridge';
  `);
  const bridgeWayGroups = new Map(); // osm -> [{ogcFid, fromNode, toNode}]
  const addWayEdges = (rows) => {
    for (const r of rows) {
      const list = bridgeWayGroups.get(r.osm) || [];
      list.push({ ogcFid: +r.ogc_fid, fromNode: +r.from_node, toNode: +r.to_node });
      bridgeWayGroups.set(r.osm, list);
    }
  };
  addWayEdges(bridgeEdgeRows);

  // Overpass-mismatch fix (ported from bridge-detour-process's own matchBridgeToEdge, OSM-only
  // version - the original NYSDOT FUNCTIONAL_CLASSIFICATION/FEATURE_CODE_1 codes were never
  // published into bridgeCandidateTable, so this uses OSM's own highway class instead, live-
  // verified at 81% overlap with the NBI-code-driven version): at an overpass, the bridge deck and
  // the road it crosses sit directly on top of each other in 2D, so a plain nearest-edge match can
  // grab the road UNDERNEATH (often a motorway/trunk) instead of the bridge's own local-class deck.
  // Prefer the nearest LOCAL-class edge first (excluding motorway/motorway_link/trunk/trunk_link);
  // only fall back to the unrestricted nearest edge if literally no local-class edge exists at all
  // (a genuine highway bridge, or extremely sparse local network). UNION ALL + LIMIT 1 picks the
  // first branch that returns a row without a second round-trip.
  const { rows: candidateMatchRows } = await db.query(`
    SELECT DISTINCT ON (b.ogc_fid) b.ogc_fid AS candidate_ogc_fid, e.osm
      FROM ${bridgeCandidateTable} b
      JOIN LATERAL (
        (SELECT e2.osm
           FROM ${edgesTable} e2
          WHERE e2.highway IS NULL OR NOT (e2.highway = ANY(ARRAY['motorway','motorway_link','trunk','trunk_link']))
          ORDER BY e2.wkb_geometry <-> b.wkb_geometry
          LIMIT 1)
        UNION ALL
        (SELECT e2.osm
           FROM ${edgesTable} e2
          ORDER BY e2.wkb_geometry <-> b.wkb_geometry
          LIMIT 1)
        LIMIT 1
      ) e ON true;
  `);
  const candidateWays = new Set(candidateMatchRows.map((r) => r.osm));
  const newWays = [...candidateWays].filter((osm) => !bridgeWayGroups.has(osm));
  if (newWays.length) {
    const { rows: candidateEdgeRows } = await db.query(
      `SELECT ogc_fid, osm, from_node, to_node FROM ${edgesTable} WHERE osm = ANY($1);`,
      [newWays]
    );
    addWayEdges(candidateEdgeRows);
  }

  // Branch-bounded local clustering (ported from bridge-detour-process's own
  // localUnpairedClusterOgcFids - see that tool's FINDINGS.md, 4 rounds of fixing an over-reach):
  // closing every unpaired edge in the WHOLE way over-reaches on a long corridor (US6's own way is
  // 274 edges/13.8km - only a short span of it is the actual bridge). Bound each cluster at real
  // forks (degree > 2 within the way's own unpaired subgraph) and cap its size. Seeded
  // independently from EVERY unpaired edge in the way (not just one "matched" edge), since this
  // runs once at load time for the whole graph, before any particular request names an edgeIdx.
  const MAX_CLOSURE_CLUSTER_EDGES = 30; // backstop for a pure-chain way with no forks (BIN 1051220, 159 edges/8.36km)
  const bridgeSiblingEdges = new Map(); // edgeIdx -> edgeIdx[] (only for edges needing widening)
  for (const wayEdges of bridgeWayGroups.values()) {
    const byDirectedPair = new Set(wayEdges.map((e) => `${e.fromNode}->${e.toNode}`));
    const unpaired = wayEdges.filter((e) => !byDirectedPair.has(`${e.toNode}->${e.fromNode}`));
    if (unpaired.length <= 1) continue; // 0 or 1 unpaired edge - nothing extra to fold in

    const nodeToEdges = new Map();
    for (const e of unpaired) {
      for (const n of [e.fromNode, e.toNode]) {
        if (!nodeToEdges.has(n)) nodeToEdges.set(n, []);
        nodeToEdges.get(n).push(e);
      }
    }
    const degree = new Map();
    for (const e of unpaired) for (const n of [e.fromNode, e.toNode]) degree.set(n, (degree.get(n) ?? 0) + 1);
    const isBranchNode = (n) => (degree.get(n) ?? 0) > 2;

    for (const seed of unpaired) {
      const visited = new Set([seed.ogcFid]);
      const queue = [seed];
      while (queue.length) {
        if (visited.size >= MAX_CLOSURE_CLUSTER_EDGES) break;
        const current = queue.shift();
        for (const n of [current.fromNode, current.toNode]) {
          if (isBranchNode(n)) continue;
          for (const neighbor of nodeToEdges.get(n) ?? []) {
            if (visited.has(neighbor.ogcFid)) continue;
            if (visited.size >= MAX_CLOSURE_CLUSTER_EDGES) break;
            visited.add(neighbor.ogcFid);
            queue.push(neighbor);
          }
        }
      }
      if (visited.size <= 1) continue;
      const clusterIdxs = [...visited].map((fid) => findEdgeIndexByOgcFid(edgeOgcFid, fid)).filter((i) => i !== -1);
      if (clusterIdxs.length <= 1) continue;
      const seedIdx = findEdgeIndexByOgcFid(edgeOgcFid, seed.ogcFid);
      if (seedIdx !== -1) bridgeSiblingEdges.set(seedIdx, clusterIdxs);
    }
  }
  console.log(`[memoryGraph] ${bridgeEdgeRows.length} tag-based bridge edges + ${candidateWays.size} candidate-point ways (${newWays.length} untagged), ${bridgeSiblingEdges.size} edges need whole-bridge widening`);

  return {
    conflationTable, edgesTable, nodesTable,
    numNodes, numEdges,
    nodeOsmId, nodeLon, nodeLat, nodeIdToIndex,
    edgeSource, edgeTarget, edgeLengthM, edgeDurationS, edgeOgcFid, edgeHighway,
    adjHead, adjEdgeIndex, inAdjHead, inAdjEdgeIndex,
    restrictionSet, edgeCountForEncoding,
    nodeGrid, bridgeSiblingEdges,
    restrictionsConsidered: restrictionSet.size,
  };
};

// Cache key is just pgEnv now - one hardcoded 2025 table set (see resolveConflationTables above),
// so there is only ever one graph "version" live per env.
const getOrLoadGraph = (db, pgEnv) => {
  const key = pgEnv;
  if (!graphCache.has(key)) {
    graphCache.set(key, loadGraph(db).catch((err) => {
      graphCache.delete(key); // don't cache a failed load
      throw err;
    }));
  }
  return graphCache.get(key);
};

const invalidateGraph = (pgEnv) => {
  graphCache.delete(pgEnv);
};

// Edge-expansion Dijkstra: search state is "arrived via edge E" (dist/prev/settled sized by
// EDGE count), not "at node N" - required for turn-restriction correctness, same reason
// pgr_trsp needs it. costArray is edgeLengthM (shortest) or edgeDurationS (fastest).
// excludedEdgeSet (optional Set<edgeIndex>) - per-REQUEST edge exclusion for the detour/avoid-
// segment plugin (planning/transportny/tasks/current/detour-avoid-segment-routing-plugin.md).
// Deliberately just a plain runtime check, not a graph mutation - the shared cached graph object
// is never touched, so excluding an edge for one request has zero effect on any other concurrent
// or later request.
const dijkstraEdgeExpansion = (graph, sourceNodeIdx, destNodeIdx, costArray, excludedEdgeSet = null) => {
  const { numEdges, edgeSource, edgeTarget, adjHead, adjEdgeIndex, restrictionSet, edgeCountForEncoding } = graph;

  const dist = new Float64Array(numEdges).fill(Infinity);
  const prevEdge = new Int32Array(numEdges).fill(-1);
  const settled = new Uint8Array(numEdges);
  const heap = new MinHeap(1024);

  // virtual start: every edge leaving the source node is a valid first move, cost = that edge's own cost
  for (let i = adjHead[sourceNodeIdx]; i < adjHead[sourceNodeIdx + 1]; i++) {
    const edgeIdx = adjEdgeIndex[i];
    if (excludedEdgeSet && excludedEdgeSet.has(edgeIdx)) continue;
    if (dist[edgeIdx] > costArray[edgeIdx]) {
      dist[edgeIdx] = costArray[edgeIdx];
      heap.push(edgeIdx, costArray[edgeIdx]);
    }
  }

  let answerEdge = -1;
  while (!heap.isEmpty) {
    const { edgeIdx: curEdge, dist: curDist } = heap.pop();
    if (settled[curEdge]) continue;
    settled[curEdge] = 1;

    if (edgeTarget[curEdge] === destNodeIdx) {
      answerEdge = curEdge;
      break;
    }

    const curNode = edgeTarget[curEdge];
    for (let i = adjHead[curNode]; i < adjHead[curNode + 1]; i++) {
      const nextEdge = adjEdgeIndex[i];
      if (settled[nextEdge]) continue;
      if (excludedEdgeSet && excludedEdgeSet.has(nextEdge)) continue;
      const transitionKey = curEdge * edgeCountForEncoding + nextEdge;
      if (restrictionSet.has(transitionKey)) continue; // banned turn
      const candidateDist = curDist + costArray[nextEdge];
      if (candidateDist < dist[nextEdge]) {
        dist[nextEdge] = candidateDist;
        prevEdge[nextEdge] = curEdge;
        heap.push(nextEdge, candidateDist);
      }
    }
  }

  if (answerEdge === -1) return null;

  // backtrack
  const edgePath = [];
  let cur = answerEdge;
  while (cur !== -1) {
    edgePath.push(cur);
    cur = prevEdge[cur];
  }
  edgePath.reverse();
  return { edgePath, totalCost: dist[answerEdge] };
};

// Bidirectional edge-expansion Dijkstra - grows a forward search from the source and a backward
// search from the destination simultaneously, meeting somewhere in the middle. For long routes
// this explores roughly two half-radius circles instead of one full-radius circle, which is why
// it exists: plain dijkstraEdgeExpansion() above has no sense of direction and has to explore
// outward until it happens to reach the destination - measured at 7s for a ~280km route even
// fully in memory. This is still exact (no heuristic, no approximation) - same restriction-checked
// edge-expansion semantics as the forward-only version, just run from both ends.
//
// distF[e] = best known cost from source to edgeTarget[e], inclusive of edge e (mirrors
// dijkstraEdgeExpansion's dist[]). distB[e] = best known cost from edgeSource[e] to destination,
// inclusive of edge e (the backward-search mirror). When the same edge e is reachable from both
// sides, the full path cost is distF[e] + distB[e] - costArray[e] (edge e's cost would otherwise
// be double-counted). Standard bidirectional-Dijkstra stopping rule: once the best meeting cost
// found so far is <= the sum of both frontiers' next-cheapest candidate, neither side can find a
// cheaper meeting point, so it's safe to stop.
const bidirectionalDijkstra = (graph, sourceNodeIdx, destNodeIdx, costArray, excludedEdgeSet = null) => {
  const { numEdges, edgeSource, edgeTarget, adjHead, adjEdgeIndex, inAdjHead, inAdjEdgeIndex, restrictionSet, edgeCountForEncoding } = graph;

  const distF = new Float64Array(numEdges).fill(Infinity);
  const prevF = new Int32Array(numEdges).fill(-1);
  const settledF = new Uint8Array(numEdges);
  const heapF = new MinHeap(1024);

  const distB = new Float64Array(numEdges).fill(Infinity);
  const nextB = new Int32Array(numEdges).fill(-1);
  const settledB = new Uint8Array(numEdges);
  const heapB = new MinHeap(1024);

  for (let i = adjHead[sourceNodeIdx]; i < adjHead[sourceNodeIdx + 1]; i++) {
    const e = adjEdgeIndex[i];
    if (excludedEdgeSet && excludedEdgeSet.has(e)) continue;
    if (costArray[e] < distF[e]) { distF[e] = costArray[e]; heapF.push(e, costArray[e]); }
  }
  for (let i = inAdjHead[destNodeIdx]; i < inAdjHead[destNodeIdx + 1]; i++) {
    const e = inAdjEdgeIndex[i];
    if (excludedEdgeSet && excludedEdgeSet.has(e)) continue;
    if (costArray[e] < distB[e]) { distB[e] = costArray[e]; heapB.push(e, costArray[e]); }
  }

  // Meeting point: a forward search arrives AT a node via one edge; a backward search leaves
  // THAT SAME NODE via a generally DIFFERENT edge - they don't have to be the same edge. An
  // earlier version of this required distF[e] and distB[e] on the identical edge, which under-
  // counts valid meeting points and was caught live: it returned a real but non-optimal route
  // (313.00 vs the correct 312.96) on one of the four verification pairs. The fix checks, at
  // every settle, ALL edges on the other side that touch the same node.
  let bestCost = Infinity;
  let bestForwardEdge = -1;
  let bestBackwardEdge = -1;

  while (!heapF.isEmpty || !heapB.isEmpty) {
    const topF = heapF.peek();
    const topB = heapB.peek();
    if (bestForwardEdge !== -1 && topF + topB >= bestCost) break;

    if (!heapF.isEmpty && topF <= topB) {
      const { edgeIdx: cur, dist: curDist } = heapF.pop();
      if (settledF[cur]) continue;
      settledF[cur] = 1;
      const node = edgeTarget[cur];
      // meeting check: node is where forward arrival (cur) meets a backward departure (eb)
      for (let i = adjHead[node]; i < adjHead[node + 1]; i++) {
        const eb = adjEdgeIndex[i];
        if (excludedEdgeSet && excludedEdgeSet.has(eb)) continue;
        if (distB[eb] === Infinity) continue;
        if (restrictionSet.has(cur * edgeCountForEncoding + eb)) continue; // banned turn
        const total = distF[cur] + distB[eb];
        if (total < bestCost) { bestCost = total; bestForwardEdge = cur; bestBackwardEdge = eb; }
      }
      for (let i = adjHead[node]; i < adjHead[node + 1]; i++) {
        const nxt = adjEdgeIndex[i];
        if (settledF[nxt]) continue;
        if (excludedEdgeSet && excludedEdgeSet.has(nxt)) continue;
        if (restrictionSet.has(cur * edgeCountForEncoding + nxt)) continue; // banned turn
        const cand = curDist + costArray[nxt];
        if (cand < distF[nxt]) { distF[nxt] = cand; prevF[nxt] = cur; heapF.push(nxt, cand); }
      }
    } else {
      const { edgeIdx: cur, dist: curDist } = heapB.pop();
      if (settledB[cur]) continue;
      settledB[cur] = 1;
      const node = edgeSource[cur];
      // meeting check: node is where a forward arrival (ef) meets backward departure (cur)
      for (let i = inAdjHead[node]; i < inAdjHead[node + 1]; i++) {
        const ef = inAdjEdgeIndex[i];
        if (excludedEdgeSet && excludedEdgeSet.has(ef)) continue;
        if (distF[ef] === Infinity) continue;
        if (restrictionSet.has(ef * edgeCountForEncoding + cur)) continue; // banned turn
        const total = distF[ef] + distB[cur];
        if (total < bestCost) { bestCost = total; bestForwardEdge = ef; bestBackwardEdge = cur; }
      }
      for (let i = inAdjHead[node]; i < inAdjHead[node + 1]; i++) {
        const prv = inAdjEdgeIndex[i];
        if (settledB[prv]) continue;
        if (excludedEdgeSet && excludedEdgeSet.has(prv)) continue;
        if (restrictionSet.has(prv * edgeCountForEncoding + cur)) continue; // banned turn (prv -> cur, forward order)
        const cand = curDist + costArray[prv];
        if (cand < distB[prv]) { distB[prv] = cand; nextB[prv] = cur; heapB.push(prv, cand); }
      }
    }
  }

  if (bestForwardEdge === -1) return null;

  const forwardPart = [];
  let cur = bestForwardEdge;
  while (cur !== -1) { forwardPart.push(cur); cur = prevF[cur]; }
  forwardPart.reverse();

  const backwardPart = [];
  cur = bestBackwardEdge;
  while (cur !== -1) { backwardPart.push(cur); cur = nextB[cur]; }

  return { edgePath: forwardPart.concat(backwardPart), totalCost: bestCost };
};

// Finds a route for one cost objective ("distance" or "time"). Geometry for the final path is
// fetched via a small SQL lookup (same as the existing SQL path) - only for the few hundred to
// low-thousand edges actually used, not the full network; this query was never the bottleneck,
// moving pathfinding + restrictions off SQL is what mattered.
// Finds the reverse-direction edge for the same physical road as `edgeIdx` - an edge going from
// edgeTarget[edgeIdx] back to edgeSource[edgeIdx]. Used by the detour/avoid-segment feature to
// exclude BOTH directions of a road the user picked, not just the one directional edge they
// clicked. Returns -1 if no such edge exists (e.g. a genuinely one-way road).
const findReverseEdge = (graph, edgeIdx) => {
  const { adjHead, adjEdgeIndex, edgeSource, edgeTarget } = graph;
  const fromNode = edgeTarget[edgeIdx], toNode = edgeSource[edgeIdx];
  for (let i = adjHead[fromNode]; i < adjHead[fromNode + 1]; i++) {
    const candidate = adjEdgeIndex[i];
    if (edgeTarget[candidate] === toNode) return candidate;
  }
  return -1;
};

// excludedEdgeOgcFids (optional array of ogc_fid values, from the detour/avoid-segment plugin) -
// each is resolved to its internal edge index PLUS its reverse-direction counterpart (both
// directions of the physical road get excluded, not just the one the user clicked).
const findRoute = async (db, graph, { lon: srcLon, lat: srcLat }, { lon: dstLon, lat: dstLat }, costObjective, algorithm = "dijkstra", excludedEdgeOgcFids = null) => {
  const sourceNodeIdx = graph.nodeGrid.nearest(srcLon, srcLat);
  const destNodeIdx = graph.nodeGrid.nearest(dstLon, dstLat);
  if (sourceNodeIdx === -1 || destNodeIdx === -1) {
    throw new Error("Could not snap source/destination to the in-memory node grid");
  }

  let excludedEdgeSet = null;
  if (excludedEdgeOgcFids && excludedEdgeOgcFids.length) {
    excludedEdgeSet = new Set();
    for (const ogcFid of excludedEdgeOgcFids) {
      const idx = findEdgeIndexByOgcFid(graph.edgeOgcFid, +ogcFid);
      if (idx === -1) continue; // unknown ogc_fid - ignore rather than fail the whole request
      excludedEdgeSet.add(idx);
      const reverseIdx = findReverseEdge(graph, idx);
      if (reverseIdx !== -1) excludedEdgeSet.add(reverseIdx);
      // Whole-bridge closure widening (see closureContext/loadGraph's bridgeSiblingEdges) - a
      // bridge picked via the simple detour mode must also close its unpaired sibling edges, not
      // just this one directional segment + its own reverse twin.
      const siblings = graph.bridgeSiblingEdges?.get(idx);
      if (siblings) for (const s of siblings) excludedEdgeSet.add(s);
    }
  }

  const costArray = costObjective === "time" ? graph.edgeDurationS : graph.edgeLengthM;
  const result = algorithm === "bidirectional"
    ? bidirectionalDijkstra(graph, sourceNodeIdx, destNodeIdx, costArray, excludedEdgeSet)
    : dijkstraEdgeExpansion(graph, sourceNodeIdx, destNodeIdx, costArray, excludedEdgeSet);
  if (!result) {
    throw new Error(`No route found between node ${graph.nodeOsmId[sourceNodeIdx]} and ${graph.nodeOsmId[destNodeIdx]}`);
  }

  const edgeOgcFids = result.edgePath.map((idx) => graph.edgeOgcFid[idx]);
  const { rows: geomRows } = await db.query(
    `SELECT ogc_fid, ST_AsGeoJSON(wkb_geometry) AS geojson FROM ${graph.edgesTable} WHERE ogc_fid = ANY($1);`,
    [edgeOgcFids]
  );
  const geomByOgcFid = new Map(geomRows.map((r) => [String(r.ogc_fid), JSON.parse(r.geojson)]));

  const coordinates = [];
  const segments = [];
  let totalLengthM = 0;
  let totalDurationS = 0;
  for (const edgeIdx of result.edgePath) {
    const ogcFid = graph.edgeOgcFid[edgeIdx];
    const geom = geomByOgcFid.get(String(ogcFid));
    if (!geom) continue;
    const coords = geom.coordinates;
    if (coordinates.length && coordinates.at(-1)[0] === coords[0][0] && coordinates.at(-1)[1] === coords[0][1]) {
      coordinates.push(...coords.slice(1));
    } else {
      coordinates.push(...coords);
    }
    totalLengthM += graph.edgeLengthM[edgeIdx];
    totalDurationS += graph.edgeDurationS[edgeIdx];
    segments.push({
      edge_id: ogcFid,
      highway: graph.edgeHighway[edgeIdx],
      length_m: graph.edgeLengthM[edgeIdx],
    });
  }

  const feature = {
    type: "Feature",
    properties: {
      cost: result.totalCost,
      length: totalLengthM / METERS_PER_MILE,
      duration_s: totalDurationS,
      edge_count: result.edgePath.length,
      restrictions_considered: graph.restrictionsConsidered,
    },
    geometry: { type: "LineString", coordinates },
  };

  return { feature, segments };
};

// Closure coverage/density analysis (planning/transportny/tasks/current/
// detour-avoid-segment-routing-plugin.md) - answers which surrounding roads absorb the most
// rerouted traffic from all plausible trips that would have used this segment, not one trip's
// detour.
const MILE_M = 1609.34;
// Max search radius for candidate points, MEASURED FROM THE SEED POINT (walkToFirstBranch's
// result), not the segment's own endpoint. The 20mi figure was sized back when candidates started
// right at the segment's own endpoint, to guarantee enough spread for 10 points at 0.5-0.75mi
// apart. Now that seeding (walkToFirstBranch) already pushes the search origin out to a real
// branch - sometimes itself up to 10mi out on a segment with no nearby cross-road - stacking a
// full 20mi candidate radius ON TOP of that seed distance means every validation/tally search may
// need to traverse a much longer route than before, which is real Dijkstra work no amount of
// worker-pool parallelism shrinks. 8mi still comfortably covers the ~7mi of spread 10 points at
// that spacing needs, without compounding the seed distance into a combined 20-30mi search radius
// on already-far-seeded sides.
const MAX_CANDIDATE_DISTANCE_M = 8 * MILE_M;

// Candidate search - ONE continuous search from the closed segment's own endpoint, not two
// separate searches stitched together; an earlier same-road-then-fallback two-pass design kept
// surfacing bugs at the seam between the two passes. The correct shape: expand from the broken
// segment with directional priority first, then branch onto both sides of other roads once that
// direction ends - a general algorithm, not a two-phase special case.
//
// Single unrestricted Dijkstra by real network distance (node-based - candidate picking only
// needs "how far is this node," not a turn-restriction-correct path), undirected, excluding the
// closed segment's own edges. Every node gets tagged with whether the ONE edge that reached it
// continued the closed segment's own `highway` type or not - this is what "directional priority,
// then branch once it ends" actually means at the level of a single search: the search reaches
// everywhere regardless (so it never gets stuck at a dead end the way the old hard-filtered same-
// road pass could), but same-road-reached nodes are surfaced first when building the candidate
// list, farthest first within each group.
const farthestToNearestNodes = (graph, startNodeIdx, excludedEdgeSet, preVisited, maxDistanceM, preferredHighway = null, farthestFirst = true, blockedNodes = null) => {
  // Accepts a single node id (legacy call shape) or an iterable of them - normalized to a Set once
  // up front rather than checked per-edge-relaxation.
  const blocked = blockedNodes instanceof Set ? blockedNodes
    : (blockedNodes === null || blockedNodes === undefined || blockedNodes === -1) ? new Set()
    : new Set(Array.isArray(blockedNodes) ? blockedNodes : [blockedNodes]);
  const { numNodes, adjHead, adjEdgeIndex, inAdjHead, inAdjEdgeIndex, edgeSource, edgeTarget, edgeLengthM, edgeHighway } = graph;
  const dist = new Float64Array(numNodes).fill(Infinity);
  const reachedVia = new Int32Array(numNodes).fill(-1); // the edge that reached this node, for the same-road tag below
  const settled = new Uint8Array(numNodes);
  const heap = new MinHeap(1024);
  const excluded = new Set(preVisited || []);

  dist[startNodeIdx] = 0;
  heap.push(startNodeIdx, 0);
  const reached = []; // settled order = ascending distance

  while (!heap.isEmpty) {
    const { edgeIdx: nodeIdx, dist: d } = heap.pop(); // field names are generic (id, priority) despite the edge-Dijkstra naming
    if (settled[nodeIdx]) continue;
    settled[nodeIdx] = 1;
    if (d > maxDistanceM) break; // Dijkstra pops in ascending distance order - once we're past the cap, nothing left can be closer
    if (nodeIdx !== startNodeIdx && !excluded.has(nodeIdx)) reached.push({ node: nodeIdx, dist: d });

    // `blockedNode` - `preVisited` only excluded the OTHER endpoint from being counted as a
    // candidate, it never stopped the search from traveling THROUGH it to reach the far side of
    // the closure. Blocking it here treats it as removed from the graph for this search, so the
    // start side's expansion stays confined to its own side of the closure (and symmetrically
    // for the end side).
    for (let i = adjHead[nodeIdx]; i < adjHead[nodeIdx + 1]; i++) {
      const e = adjEdgeIndex[i];
      if (excludedEdgeSet.has(e)) continue;
      const n = edgeTarget[e];
      if (blocked.has(n)) continue;
      const nd = d + edgeLengthM[e];
      if (nd < dist[n]) { dist[n] = nd; reachedVia[n] = e; heap.push(n, nd); }
    }
    for (let i = inAdjHead[nodeIdx]; i < inAdjHead[nodeIdx + 1]; i++) {
      const e = inAdjEdgeIndex[i];
      if (excludedEdgeSet.has(e)) continue;
      const n = edgeSource[e];
      if (blocked.has(n)) continue;
      const nd = d + edgeLengthM[e];
      if (nd < dist[n]) { dist[n] = nd; reachedVia[n] = e; heap.push(n, nd); }
    }
  }

  // `farthestFirst`: farthest-first walking (the previous default) produced a bimodal near+far
  // split with nothing in between, once combined with the caller's stop-at-target validation
  // logic. Nearest-first gives smooth, gradual outward coverage instead - each group (same-road,
  // then fallback) stays in its natural ascending-distance order when `farthestFirst` is false.
  // Each entry is `{node, dist}` - `dist` is real network distance from the origin, needed by
  // the caller to enforce a minimum real-world gap between chosen candidates.
  // Return shape: `{ nodes, sameRoadCount }` - `sameRoadCount` lets the caller budget the
  // same-road and escape-onto-other-roads phases SEPARATELY. Without this, a small looped
  // same-road network with many closely-spaced nodes (a real case: a short inner-loop service
  // road) could consume the ENTIRE validation attempt budget re-checking that one small loop,
  // never reaching the roads that actually expand farther out.
  if (preferredHighway == null) return { nodes: farthestFirst ? reached.reverse() : reached, sameRoadCount: reached.length };
  const sameRoad = [], other = [];
  for (const r of reached) {
    (edgeHighway[reachedVia[r.node]] === preferredHighway ? sameRoad : other).push(r);
  }
  // Same-road nodes first (the search's own priority direction) - stay on the current road
  // direction with priority, then expand onto both sides once that direction ends.
  const nodes = farthestFirst ? [...sameRoad.reverse(), ...other.reverse()] : [...sameRoad, ...other];
  return { nodes, sameRoadCount: sameRoad.length };
};

// Walks from `startNode` along the network (both edge directions, since a real intersection can be
// reached via either) until it finds a REAL BRANCH - a node with more than one viable next edge,
// pure topology (edge count), same rule as the simple detour mode's endpoint picker
// (comp.jsx/findSameRoadNode.js) - then takes exactly ONE more hop and stops there. Ported
// server-side (not reusing the client's bbox-fetch version) because the in-memory CSR graph
// already has full adjacency in memory, so this is a fast synchronous walk, not a per-hop network
// round trip. Excludes `excludedEdgeSet` (the closed segment itself) and never crosses through
// `blockedNode` (the segment's OTHER endpoint - same crossing-prevention rule
// `farthestToNearestNodes` uses), so the seed point for each side stays confined to its own side
// of the closure. Falls back to whatever node the walk dead-ended at (or the start node itself, if
// nothing connects at all) rather than failing.
const MAX_SEED_WALK_HOPS = 2000;
const MAX_SEED_WALK_DISTANCE_M = 10 * MILE_M; // per side
// Returns `{ node, path }` - `path` is every node visited along the way (including `startNode` and
// the final `node`), not just the destination. Once each side's search starts from a SEED further
// out (not the segment's own endpoint), blocking only the opposite side's final seed node isn't
// enough to keep the two sides from crossing - the search can still reach into the other side's
// territory via a path that never touches that one blocked node, especially along a shared road
// (live-tested: start/end candidate points interleaving on the same street). Blocking the WHOLE
// corridor each seed-walk traveled closes that gap.
// Bearing in degrees [0,360) from node `a` to node `b`, using nodeLon/nodeLat - same formula as
// the old client-side walk (comp.jsx's bearing(), now unused there since this replaced it), needed
// here so `walkToFirstBranch` can tell the road continuing straight ahead apart from a cross
// street that happens to touch this same node.
const bearingDeg = (graph, a, b) => {
  const lat1 = (graph.nodeLat[a] * Math.PI) / 180;
  const lat2 = (graph.nodeLat[b] * Math.PI) / 180;
  const dLon = ((graph.nodeLon[b] - graph.nodeLon[a]) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};
const bearingDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

// Two independent copies - simple mode and density mode previously shared one function via a
// `stopAtBranch` flag; kept identical logic for now, but each mode can be tuned on its own
// without risk of the other regressing. Both walk from
// `startNode` (both edge directions - a real intersection can be reached via either) until a
// REAL BRANCH - a node with more than one viable next edge, pure topology - then take exactly one
// more hop past it and stop. `hop > 0` guards the closed segment's OWN endpoint, which OSM almost
// always splits ways at (so it's itself technically a "branch") - without the guard the walk would
// misfire on hop 0, before any real bearing-based continuation choice could apply. Falls back to
// wherever the walk dead-ended (or the start node, if nothing connects) rather than failing.
const walkToFirstBranchSimple = (graph, startNode, blockedNode, excludedEdgeSet) => {
  const { adjHead, adjEdgeIndex, inAdjHead, inAdjEdgeIndex, edgeSource, edgeTarget, edgeLengthM } = graph;
  let current = startNode;
  let prevNode = -1;
  let prevEdge = -1;
  // FIXED reference bearing, captured once on the first real hop and never updated after.
  // Comparing each hop against the bearing of the hop JUST taken (reset every iteration) is
  // locally-greedy: on a real street grid, small per-hop bearing drift compounds, and at a
  // junction the walk could pick whatever's straightest relative to the last hop rather than the
  // road's actual original direction - live-confirmed via a visible bend in the walked path at a
  // real intersection (osm 5593248) that had no business turning there. Comparing every hop
  // against the ORIGINAL direction instead keeps the walk locked onto the road it started on; it
  // still genuinely stops/deflects at a real junction once nothing continues that original
  // direction closely enough, per the branch-stop logic below.
  let referenceBearing = null;
  let travelledM = 0;
  const path = [startNode];

  for (let hop = 0; hop < MAX_SEED_WALK_HOPS; hop++) {
    if (travelledM >= MAX_SEED_WALK_DISTANCE_M) return { node: current, path, reason: "distance_cap" };

    const candidates = []; // { node, edge, lengthM }
    for (let i = adjHead[current]; i < adjHead[current + 1]; i++) {
      const e = adjEdgeIndex[i];
      if (e === prevEdge || excludedEdgeSet.has(e)) continue;
      const n = edgeTarget[e];
      if (n === blockedNode || n === prevNode) continue;
      candidates.push({ node: n, edge: e, lengthM: edgeLengthM[e] });
    }
    for (let i = inAdjHead[current]; i < inAdjHead[current + 1]; i++) {
      const e = inAdjEdgeIndex[i];
      if (e === prevEdge || excludedEdgeSet.has(e)) continue;
      const n = edgeSource[e];
      if (n === blockedNode || n === prevNode) continue;
      candidates.push({ node: n, edge: e, lengthM: edgeLengthM[e] });
    }
    if (!candidates.length) return { node: current, path, reason: "dead_end" };

    const isBranch = candidates.length > 1; // pure topology, matches comp.jsx's hasIncomingBranch

    // Pick the STRAIGHTEST-continuing edge relative to the FIXED reference bearing, not just the
    // first one adjacency happens to list - no reference bearing yet on the very first hop, so
    // candidates[0] there is fine (just leaving the closed segment's own endpoint, before any
    // branch could have been seen, and this hop also SETS the reference for every hop after it).
    const next = referenceBearing === null || candidates.length === 1
      ? candidates[0]
      : candidates.reduce((best, c) => {
          const diff = bearingDiff(referenceBearing, bearingDeg(graph, current, c.node));
          return diff < best._diff ? { ...c, _diff: diff } : best;
        }, { ...candidates[0], _diff: bearingDiff(referenceBearing, bearingDeg(graph, current, candidates[0].node)) });
    prevNode = current;
    prevEdge = next.edge;
    if (referenceBearing === null) referenceBearing = bearingDeg(graph, current, next.node);
    current = next.node;
    travelledM += next.lengthM;
    path.push(current);

    if (isBranch && hop > 0) return { node: current, path, reason: "branch" }; // took the one hop past the branch - stop this direction here
  }
  return { node: current, path, reason: "hop_cap" };
};

const walkToFirstBranchDensity = (graph, startNode, blockedNode, excludedEdgeSet) => {
  const { adjHead, adjEdgeIndex, inAdjHead, inAdjEdgeIndex, edgeSource, edgeTarget, edgeLengthM } = graph;
  let current = startNode;
  let prevNode = -1;
  let prevEdge = -1;
  // FIXED reference bearing, not updated per hop - same fix as walkToFirstBranchSimple above (see
  // its comment for the full reasoning/live-observed bug).
  let referenceBearing = null;
  let travelledM = 0;
  const path = [startNode];

  for (let hop = 0; hop < MAX_SEED_WALK_HOPS; hop++) {
    if (travelledM >= MAX_SEED_WALK_DISTANCE_M) return { node: current, path, reason: "distance_cap" };

    const candidates = []; // { node, edge, lengthM }
    for (let i = adjHead[current]; i < adjHead[current + 1]; i++) {
      const e = adjEdgeIndex[i];
      if (e === prevEdge || excludedEdgeSet.has(e)) continue;
      const n = edgeTarget[e];
      if (n === blockedNode || n === prevNode) continue;
      candidates.push({ node: n, edge: e, lengthM: edgeLengthM[e] });
    }
    for (let i = inAdjHead[current]; i < inAdjHead[current + 1]; i++) {
      const e = inAdjEdgeIndex[i];
      if (e === prevEdge || excludedEdgeSet.has(e)) continue;
      const n = edgeSource[e];
      if (n === blockedNode || n === prevNode) continue;
      candidates.push({ node: n, edge: e, lengthM: edgeLengthM[e] });
    }
    if (!candidates.length) return { node: current, path, reason: "dead_end" };

    const isBranch = candidates.length > 1; // pure topology, matches comp.jsx's hasIncomingBranch

    // Pick the STRAIGHTEST-continuing edge relative to the FIXED reference bearing - see
    // walkToFirstBranchSimple above for the full reasoning.
    const next = referenceBearing === null || candidates.length === 1
      ? candidates[0]
      : candidates.reduce((best, c) => {
          const diff = bearingDiff(referenceBearing, bearingDeg(graph, current, c.node));
          return diff < best._diff ? { ...c, _diff: diff } : best;
        }, { ...candidates[0], _diff: bearingDiff(referenceBearing, bearingDeg(graph, current, candidates[0].node)) });
    prevNode = current;
    prevEdge = next.edge;
    if (referenceBearing === null) referenceBearing = bearingDeg(graph, current, next.node);
    current = next.node;
    travelledM += next.lengthM;
    path.push(current);

    if (isBranch && hop > 0) return { node: current, path, reason: "branch" }; // took the one hop past the branch - stop this direction here
  }
  return { node: current, path, reason: "hop_cap" };
};

// Ported from the standalone bridge-detour-process tool's own fix (found live-testing Butts Rd -
// see detour-avoid-segment-routing-plugin.md): once a whole-bridge closure widens excludedEdgeSet
// beyond one edge + its reverse twin, the ORIGINALLY MATCHED edge's own fromNode/toNode can turn
// out to be the closed cluster's INTERIOR node (both its edges excluded, zero connections left)
// rather than one of the cluster's real exterior "gateway" nodes - walkToFirstBranch would then
// dead-end at hop 0 instead of ever reaching a real branch. This walks OUTWARD through only the
// excluded edges themselves until it finds a node with at least one non-excluded edge (the
// cluster's real boundary). A normal single-edge closure's own fromNode/toNode already sits on the
// boundary (a two-way road's endpoints keep plenty of other connections), so this returns
// startNode immediately for the vast majority of segments - it only matters for a widened,
// multi-edge closure whose matched edge happens to be an interior piece.
// `avoidNode` (optional): a boundary node ALREADY claimed by the other side - without this, both
// sides can independently walk to the SAME nearest boundary node, collapsing fromNode/toNode onto
// one point (a degenerate closure with no real start/end). Skipped as a stopping point so the two
// sides resolve to distinct boundary nodes when more than one exists; if the whole cluster only has
// ONE real boundary node, still returns it rather than the interior startNode.
const pushToClusterBoundary = (graph, startNode, excludedEdgeSet, avoidNode = null) => {
  const { adjHead, adjEdgeIndex, inAdjHead, inAdjEdgeIndex, edgeSource, edgeTarget } = graph;
  const hasExteriorEdge = (node) => {
    for (let i = adjHead[node]; i < adjHead[node + 1]; i++) if (!excludedEdgeSet.has(adjEdgeIndex[i])) return true;
    for (let i = inAdjHead[node]; i < inAdjHead[node + 1]; i++) if (!excludedEdgeSet.has(inAdjEdgeIndex[i])) return true;
    return false;
  };
  if (startNode !== avoidNode && hasExteriorEdge(startNode)) return startNode;

  const visited = new Set([startNode]);
  const queue = [startNode];
  let fallback = startNode === avoidNode && hasExteriorEdge(startNode) ? startNode : null;
  while (queue.length) {
    const current = queue.shift();
    for (let i = adjHead[current]; i < adjHead[current + 1]; i++) {
      const e = adjEdgeIndex[i];
      if (!excludedEdgeSet.has(e)) continue; // only traverse THROUGH the closed cluster itself
      const n = edgeTarget[e];
      if (visited.has(n)) continue;
      visited.add(n);
      if (hasExteriorEdge(n)) { if (n !== avoidNode) return n; fallback = fallback ?? n; continue; }
      queue.push(n);
    }
    for (let i = inAdjHead[current]; i < inAdjHead[current + 1]; i++) {
      const e = inAdjEdgeIndex[i];
      if (!excludedEdgeSet.has(e)) continue;
      const n = edgeSource[e];
      if (visited.has(n)) continue;
      visited.add(n);
      if (hasExteriorEdge(n)) { if (n !== avoidNode) return n; fallback = fallback ?? n; continue; }
      queue.push(n);
    }
  }
  // Every boundary node found was avoidNode (only one real boundary exists) - return it anyway
  // rather than the original interior startNode; falls back to startNode only if truly nothing
  // was ever reachable (a fully isolated cluster).
  return fallback ?? startNode;
};

// Resolves the closed segment + a same/open-route helper shared by both split steps below.
// `fromNode`/`toNode` are the segment's real endpoints, boundary-corrected via
// pushToClusterBoundary when a whole-bridge widening moved the matched edge's own endpoint inside
// the closed cluster - callers should use THESE, not graph.edgeSource[edgeIdx]/edgeTarget[edgeIdx]
// directly, so the widening actually takes effect downstream (endpoint-picking, seed-finding).
const closureContext = (graph, ogcFid, costObjective) => {
  const edgeIdx = findEdgeIndexByOgcFid(graph.edgeOgcFid, +ogcFid);
  if (edgeIdx === -1) throw new Error(`Unknown segment ogc_fid ${ogcFid}`);
  const reverseIdx = findReverseEdge(graph, edgeIdx);
  const excludedEdgeSet = new Set([edgeIdx]);
  if (reverseIdx !== -1) excludedEdgeSet.add(reverseIdx);
  // Whole-bridge closure widening - see the bridgeSiblingEdges build in loadGraph and
  // pushToClusterBoundary's comment above.
  const siblings = graph.bridgeSiblingEdges?.get(edgeIdx);
  if (siblings) for (const s of siblings) excludedEdgeSet.add(s);
  // toNode resolved first (usually already exterior, unchanged) so fromNode's push can avoid
  // collapsing onto whatever toNode already claimed.
  const toNode = pushToClusterBoundary(graph, graph.edgeTarget[edgeIdx], excludedEdgeSet);
  const fromNode = pushToClusterBoundary(graph, graph.edgeSource[edgeIdx], excludedEdgeSet, toNode);
  const costArray = costObjective === "time" ? graph.edgeDurationS : graph.edgeLengthM;
  const routeUsesClosedSegment = (edgePath) => edgePath.includes(edgeIdx) || (reverseIdx !== -1 && edgePath.includes(reverseIdx));
  return { edgeIdx, reverseIdx, excludedEdgeSet, fromNode, toNode, costArray, routeUsesClosedSegment };
};

// Simple detour mode's endpoint picker, moved server-side - the client-side version (comp.jsx's
// walkForward) made ONE HTTP request per hop of the walk, which on a highway with short edges
// over a 10-mile budget could mean hundreds of sequential network round trips just to pick the
// start/end points, before the real route search even ran. This is the exact same
// walk-to-first-branch rule (`walkToFirstBranch` above, already used by
// selectClosureDensityCandidates), just exposed as one fast in-memory call instead of many.
const resolveDetourEndpoints = (graph, ogcFid) => {
  const { excludedEdgeSet, fromNode, toNode } = closureContext(graph, ogcFid, "distance"); // costObjective is irrelevant here - only used for excludedEdgeSet
  const startWalk = walkToFirstBranchSimple(graph, fromNode, toNode, excludedEdgeSet);
  const endWalk = walkToFirstBranchSimple(graph, toNode, fromNode, excludedEdgeSet);
  const toPoint = (n, walk) => ({
    lon: graph.nodeLon[n], lat: graph.nodeLat[n], osm_id: String(graph.nodeOsmId[n]),
    hitDistanceCap: walk.reason === "distance_cap",
  });
  return { start: toPoint(startWalk.node, startWalk), end: toPoint(endWalk.node, endWalk) };
};

// Step 1/2 - split into two API calls so the frontend can show/confirm candidate points before
// committing to the expensive full analysis: point SELECTION only, no route tallying.
// Cached (see pointsResultCache above) - re-analyzing the SAME segment, even by a different user,
// skips the whole worker-pool run and returns the prior result immediately.
const selectClosureDensityCandidates = (graph, ogcFid, numCandidates = 10, costObjective = "distance", signal) =>
  memoizeByGraph(pointsResultCache, graph, `${ogcFid}:${numCandidates}:${costObjective}`, (requestTag, onPool) =>
    selectClosureDensityCandidatesUncached(graph, ogcFid, numCandidates, costObjective, requestTag, onPool),
  signal);

const selectClosureDensityCandidatesUncached = async (graph, ogcFid, numCandidates = 10, costObjective = "distance", requestTag, onPool) => {
  const { edgeIdx, reverseIdx, excludedEdgeSet, fromNode, toNode } = closureContext(graph, ogcFid, costObjective);
  const closedHighway = graph.edgeHighway[edgeIdx];

  // Seed each side from its FIRST REAL BRANCH past the closed segment - same walk-to-first-branch
  // rule as the simple detour mode's endpoint picker, so the expansion below starts from a genuine
  // junction (somewhere a detour actually has options) instead of the segment's own endpoint,
  // which by OSM's own way-splitting convention is usually already sitting exactly at an
  // intersection.
  const startWalk = walkToFirstBranchDensity(graph, fromNode, toNode, excludedEdgeSet);
  const endWalk = walkToFirstBranchDensity(graph, toNode, fromNode, excludedEdgeSet);
  const startSeed = startWalk.node;
  const endSeed = endWalk.node;

  // Point selection: validity (does the OD pair actually use the segment) is the primary filter,
  // not a fixed count/spacing. Greedily accepting the first N valid points is self-defeating,
  // since points immediately next to a closure are ALMOST ALWAYS valid (their open route
  // obviously used the segment - it's the most direct path), so the walk fills every slot with
  // near points before ever reaching farther out. Fixed by splitting validation from final
  // selection:
  //   1. Seed each side with its nearest few points, accepted unconditionally (bootstrap - close
  //      points reliably represent real segment usage, so they're a trustworthy reference set).
  //   2. Validate the REST of each pool (out to MAX_CANDIDATE_DISTANCE_M) against the OTHER
  //      side's seed - collect every point that passes, near or far, without stopping early.
  //   3. From the seed + all validated points (already sorted nearest-to-farthest), pick the
  //      final `numCandidates` spread EVENLY BY INDEX across that whole validated list - so the
  //      final set spans near, mid, and far distances among genuinely valid pairs, instead of
  //      clustering at whichever end was walked first.
  // `farthestFirst: false` (see the walk-direction note on farthestToNearestNodes above): walk
  // NEAREST-first so validation covers gradual, incremental distances rather than jumping
  // straight to the far end.
  // blockedNode = the OTHER endpoint - keeps the start side's search from crossing through it to
  // reach the end side's own territory, and vice versa (see farthestToNearestNodes' comment).
  // Block the OPPOSITE side's entire seed-walk corridor (every node it passed through, not just
  // its final seed point - see walkToFirstBranch's comment): fixes a bug where start/end candidate
  // points interleaved along the same shared road once each side's search started from a seed
  // farther out than the segment's own endpoint.
  const { nodes: rawStartPool, sameRoadCount: startSameRoadCount } = farthestToNearestNodes(graph, startSeed, excludedEdgeSet, endWalk.path, MAX_CANDIDATE_DISTANCE_M, closedHighway, false, endWalk.path);
  const { nodes: rawEndPool, sameRoadCount: endSameRoadCount } = farthestToNearestNodes(graph, endSeed, excludedEdgeSet, startWalk.path, MAX_CANDIDATE_DISTANCE_M, closedHighway, false, startWalk.path);

  // MIN_GAP_M: the earlier evenly-spaced-BY-INDEX selection could still land two picks close
  // together in real distance if the validated list happened to be dense in one stretch (points
  // bunched within a couple hundred meters near the top of one road). Enforcing an actual minimum
  // GAP IN METERS between consecutive picks (walking the already nearest-to-farthest validated
  // list and skipping anything too close to the last accepted pick) fixes this directly, rather
  // than index-spacing which only approximates it. pickWithBestEffortGap below only relaxes
  // DOWNWARD from this value if the count can't be reached at full spacing, so whatever gap
  // actually gets used naturally lands at or below 1mi.
  const MIN_GAP_M = 1 * MILE_M;
  const pickWithMinGap = (sortedValid, count, minGapM) => {
    const picked = [];
    let lastDist = -Infinity;
    for (const candidate of sortedValid) {
      if (picked.length >= count) break;
      if (candidate.dist - lastDist < minGapM) continue;
      picked.push(candidate);
      lastDist = candidate.dist;
    }
    return picked;
  };
  // Count is a hard requirement, spacing is the thing allowed to give way if the validated pool
  // genuinely can't support both. Halves the gap and retries until `count` is reached or the gap
  // bottoms out at 0 (accept any validated point, spacing no longer enforced) - only relaxes AFTER
  // exhausting room to keep the requested gap, so it still prefers well-spaced picks whenever
  // possible. A hard-floor variant (never relax below MIN_GAP_M, let count give way instead) was
  // tried and reverted: it collapsed to ~1 point per side on a small-pool segment.
  // Returns `{ picked, gapUsedM }` (not just `picked`) - the relaxation was real but INVISIBLE
  // without this: with no way to see how far it had backed off, a silently-collapsed gap and a
  // genuinely broken gap-selection bug looked identical from the outside. Reporting the actual
  // achieved gap lets that be checked with a real number instead of eyeballing a screenshot.
  const pickWithBestEffortGap = (sortedValid, count, minGapM) => {
    let gap = minGapM;
    let picked = pickWithMinGap(sortedValid, count, gap);
    while (picked.length < count && gap > 0) {
      gap = gap / 2;
      picked = pickWithMinGap(sortedValid, count, gap);
    }
    return { picked, gapUsedM: picked.length >= count ? gap : null }; // null = count not reached even ungapped
  };

  // The seed (bootstrap reference set) comes from the NEAREST end - close points reliably
  // represent real segment usage, which is exactly why they're trustworthy as a reference.
  // `rawStartPool`/`rawEndPool` are nearest-first now, so the seed is the FIRST few elements, and
  // the main walk below covers everything AFTER that seed head (so the seed is never
  // re-validated against itself). Reduced from 3 to 1 (each candidate costs 1 open-route search,
  // so this keeps the per-request cost down). Restoring to 3 (to make passedFromCells's ">50%
  // matched route" check a genuine majority vote again, not a degenerate single check) measured
  // 20s -> 52s on a real cold run and was reverted. The SEED_COUNT/">50%" gap stays open; fixing
  // it needs a real perf budget for the extra searches, not a free win.
  const SEED_COUNT = Math.min(1, numCandidates);
  const seedStart = rawStartPool.slice(0, SEED_COUNT);
  const seedEnd = rawEndPool.slice(0, SEED_COUNT);
  const restStart = rawStartPool.slice(SEED_COUNT); // nearest-first, near seed head excluded
  const restEnd = rawEndPool.slice(SEED_COUNT);
  // Same-road/"other" boundary within `restStart`/`restEnd` (shifted back by the seed head we
  // just sliced off) - see validateBudget's split-budget use of this below.
  const restStartSameRoadCount = Math.max(0, startSameRoadCount - SEED_COUNT);
  const restEndSameRoadCount = Math.max(0, endSameRoadCount - SEED_COUNT);

  // MAX_ATTEMPTS: caps total candidates tried per side, so cost stays bounded regardless of how
  // large the pool is or how many fail validation - a request that returns fewer than
  // `numCandidates` valid points beats one that fails outright past the server's 30s timeout.
  //
  // Validates the WHOLE attempt budget up front - does NOT stop as soon as `numCandidates` valid
  // points are found. Stopping early causes a bimodal near+far result: walking nearest-first AND
  // stopping at the target just fills the target from the near end again; walking farthest-first
  // AND stopping at the target jumps straight to the far end. Validating the FULL budget
  // nearest-first, THEN choosing the final spread via `spreadSelect` below, is what actually
  // produces smooth gradual coverage.
  // Count is a hard requirement (10-10 each side), not a best-effort target - see
  // DENSITY_POINTS_TIMEOUT in dms-server's index.js for the 90s scoped timeout this budget fits
  // inside. Wide budget so gap-relaxation has enough validated candidates to find `numCandidates`
  // genuinely valid points spread a full 0.75mi apart, rather than falling back to a tighter gap
  // for lack of pool.
  const MAX_ATTEMPTS = numCandidates * 30;
  // Split-budget fix: a short LOOPED same-road network can have many closely-spaced nodes (a real
  // case: a short inner-loop service road) and, walking same-road-first with one shared budget,
  // could consume the ENTIRE MAX_ATTEMPTS re-validating that one small loop before ever reaching
  // the "other" (escape-onto-a-different-road) group that actually expands farther out. Half the
  // budget is reserved for "other," guaranteed regardless of how large the same-road group is or
  // how much of its own half-budget it actually used.
  let candidatesRejected = 0;
  // Returns `{ sameRoadValid, otherValid }` SEPARATELY: a live test on a genuinely long road still
  // pulled in a few "other" (branched-off) points even though the same road alone had enough room
  // for the full count - because merging both phases into one list before selection gives no
  // preference for staying on the same road when it didn't actually need to branch. Keeping them
  // separate lets the caller try same-road-ONLY first and fall back to the branch only if that's
  // not enough - not just at validation time, at SELECTION time too.
  // Pure range computation, split out of validateBudget below so the SAME index ranges can be
  // used twice: once to decide which pairs need a search (before dispatch), once to apply the
  // results (after dispatch) - without duplicating the sameRoadCap/otherStart/otherEnd arithmetic.
  const budgetTestIndices = (restPool, sameRoadCount) => {
    const sameRoadCap = Math.min(sameRoadCount, Math.ceil(MAX_ATTEMPTS / 2));
    const otherStart = Math.max(sameRoadCap, sameRoadCount); // skip any untried same-road leftovers, jump straight to "other"
    const otherBudget = MAX_ATTEMPTS - sameRoadCap;
    const otherEnd = Math.min(restPool.length, otherStart + otherBudget);
    const indices = [];
    for (let i = 0; i < sameRoadCap; i++) indices.push(i);
    for (let j = otherStart; j < otherEnd; j++) indices.push(j);
    return { indices, sameRoadCap };
  };

  // worker_threads pool (see planning/transportny/tasks/current/closure-density-performance.md):
  // every (candidate, opposite-seed-point) pair is an independent OPEN-network search, so instead
  // of calling passesValidation live in the
  // validateBudget loop below (one search at a time on the main thread), every pair either side's
  // budget will check is dispatched to the pool in ONE combined batch up front - same exact
  // pass/fail semantics (fails/oppositeSet.length <= 0.5), just computed in parallel instead of
  // sequentially. No other selection logic changes - budget ranges, same-road split, gap
  // enforcement, and count-vs-gap tradeoff below are all untouched.
  const tasks = [];
  const buildCells = (restPool, testIndices, oppositeSet, candidateIsStart) => {
    const cells = testIndices.map(() => new Array(oppositeSet.length).fill(false));
    testIndices.forEach((idx, ti) => {
      const candidate = restPool[idx];
      oppositeSet.forEach((other, oi) => {
        tasks.push({
          id: tasks.length,
          sourceNodeIdx: candidateIsStart ? candidate.node : other.node,
          destNodeIdx: candidateIsStart ? other.node : candidate.node,
          _cells: cells, _ti: ti, _oi: oi,
        });
      });
    });
    return cells;
  };

  const startTest = budgetTestIndices(restStart, restStartSameRoadCount);
  const endTest = budgetTestIndices(restEnd, restEndSameRoadCount);
  const startCells = buildCells(restStart, startTest.indices, seedEnd, true);
  const endCells = buildCells(restEnd, endTest.indices, seedStart, false);

  if (tasks.length > 0) {
    const pool = await densitySearchPool.getPool(graph, costObjective);
    onPool?.(pool); // lets the memoize layer above cancel THIS request's own queued tasks if every caller sharing it aborts
    const resultsMap = await densitySearchPool.runBatch(pool, Array.from(excludedEdgeSet), tasks, requestTag);
    for (const t of tasks) {
      const r = resultsMap.get(t.id);
      t._cells[t._ti][t._oi] = r ? { usesClosedSegment: r.usesClosedSegment, reachable: r.reachable } : { usesClosedSegment: false, reachable: false };
    }
  }

  // Same fails/oppositeSet.length <= 0.5 aggregation passesValidation used to do live, now reading
  // the precomputed cells instead of calling out to a search.
  //
  // A closed-network BFS reachability check (to catch a candidate whose OPEN route passes
  // validation but is genuinely disconnected once actually closed) was tried and reverted - it
  // made point-selection noticeably slower (per-candidate BFS on the main thread), and this call
  // needs to stay fast. Revisit as a properly-parallelized version (worker pool, like the >50%
  // check below) rather than re-adding it inline here.
  //
  // Unreachable (no route at all) is a hard fail, separate from the usesClosedSegment>50% rule -
  // it used to score identically to a genuine off-closure route. See task doc's "Point-selection
  // validation bug" section for the live-tested river-crossing case this fixes.
  const passedFromCells = (testIndices, cells, oppositeCount) => {
    const passed = new Map(); // restPool index -> boolean
    testIndices.forEach((idx, ti) => {
      if (oppositeCount === 0) { passed.set(idx, true); return; } // bootstrap - shouldn't hit (seed excluded from testIndices)
      const unreachable = cells[ti].filter((c) => !c.reachable).length;
      if (unreachable / oppositeCount > 0.5) { passed.set(idx, false); return; }
      const fails = cells[ti].filter((c) => c.reachable && !c.usesClosedSegment).length;
      const reachableCount = oppositeCount - unreachable;
      passed.set(idx, reachableCount > 0 && fails / reachableCount <= 0.5);
    });
    return passed;
  };
  const startPassed = passedFromCells(startTest.indices, startCells, seedEnd.length);
  const endPassed = passedFromCells(endTest.indices, endCells, seedStart.length);

  const applyBudget = (restPool, seed, { indices, sameRoadCap }, passed) => {
    const sameRoadValid = [...seed]; // seed is always drawn from index 0 of the nearest-first pool, which is always same-road (see farthestToNearestNodes - same-road group comes first)
    const otherValid = [];
    for (const idx of indices) {
      if (!passed.get(idx)) { candidatesRejected++; continue; }
      const candidate = restPool[idx];
      (idx < sameRoadCap ? sameRoadValid : otherValid).push(candidate);
    }
    // Each phase is already internally ascending by distance (restPool is nearest-first within
    // each group, and `indices` was built same-road range first then other range), so no re-sort
    // needed here - only the CALLER's combined fallback list (below) needs sorting, since
    // same-road and other interleave once merged.
    return { sameRoadValid, otherValid };
  };

  const { sameRoadValid: startSameValid, otherValid: startOtherValid } = applyBudget(restStart, seedStart, startTest, startPassed);
  const { sameRoadValid: endSameValid, otherValid: endOtherValid } = applyBudget(restEnd, seedEnd, endTest, endPassed);

  // Min-gap-enforced selection over the validated (nearest-to-farthest) list - spread gradually
  // near to far among genuinely valid pairs, at least MIN_GAP_M apart, not farthest-possible,
  // first-N-found, or index-spacing alone. Falls back to a smaller gap (never a smaller count)
  // if the validated pool can't support both - see pickWithBestEffortGap above.
  //
  // SAME-ROAD PRIORITY AT SELECTION TIME (ACTIVE): try the same-road-validated set ALONE first.
  // Only fall back to the combined (same-road + branched-onto-other-roads) set if the same road
  // genuinely can't supply `numCandidates` even after fully relaxing the gap - directional
  // priority first, branch only once that direction dead-ends. A long road with plenty of its own
  // valid, spread-out points should never need to touch the branch at all. A "fall back sooner,
  // whenever same-road needed any relaxation" variant was tried alongside a hard gap floor and
  // reverted: it collapsed to too few points per side on a small-pool segment.
  const selectPreferSameRoad = (sameValid, otherValid) => {
    const sameRoadOnly = pickWithBestEffortGap(sameValid, numCandidates, MIN_GAP_M);
    if (sameRoadOnly.picked.length >= numCandidates) return sameRoadOnly;
    const combined = [...sameValid, ...otherValid].sort((a, b) => a.dist - b.dist);
    return pickWithBestEffortGap(combined, numCandidates, MIN_GAP_M);
  };

  // SPARE, NOT ACTIVE: only the seed point stays on the same road; the rest come from `otherValid`
  // (branches) first. Live-tested 2026-09-04, fixed a dense-urban clustering case - kept unused as
  // the deliberate next thing to try. See task doc's "Point-selection validation bug" section.
  // eslint-disable-next-line no-unused-vars
  const selectSeedThenBranch = (sameValid, otherValid) => {
    const seed = sameValid.slice(0, SEED_COUNT);
    const sameRest = sameValid.slice(SEED_COUNT);
    const remaining = numCandidates - seed.length;
    if (remaining <= 0) return { picked: seed, gapUsedM: null };

    const branchOnly = pickWithBestEffortGap(otherValid, remaining, MIN_GAP_M);
    if (branchOnly.picked.length >= remaining) {
      return { picked: [...seed, ...branchOnly.picked], gapUsedM: branchOnly.gapUsedM };
    }
    const combined = [...sameRest, ...otherValid].sort((a, b) => a.dist - b.dist);
    const combinedPicked = pickWithBestEffortGap(combined, remaining, MIN_GAP_M);
    return { picked: [...seed, ...combinedPicked.picked], gapUsedM: combinedPicked.gapUsedM };
  };

  const { picked: startCandidates, gapUsedM: startGapUsedM } = selectPreferSameRoad(startSameValid, startOtherValid);
  const { picked: endCandidates, gapUsedM: endGapUsedM } = selectPreferSameRoad(endSameValid, endOtherValid);

  // TEMP DIAGNOSTIC (remove once the 10-10 shortfall is actually root-caused): logs the count at
  // EVERY stage of the pipeline so a real shortfall can be traced to its actual cause (raw pool
  // too small = genuinely sparse network vs. validation rejecting too many = the >50% majority
  // rule being too strict vs. the gap-relaxation itself failing to reach numCandidates despite
  // enough valid points) instead of guessing and changing another parameter blind.
  console.log("[closure-density candidates] diagnostic", {
    ogcFid, numCandidates,
    rawStartPoolSize: rawStartPool.length, rawEndPoolSize: rawEndPool.length,
    startSameRoadCount, endSameRoadCount,
    candidatesRejected,
    startSameValidCount: startSameValid.length, startOtherValidCount: startOtherValid.length,
    endSameValidCount: endSameValid.length, endOtherValidCount: endOtherValid.length,
    startPickedCount: startCandidates.length, endPickedCount: endCandidates.length,
    startGapUsedM, endGapUsedM,
  });

  // osm ids (not internal indices - those aren't a stable public identifier across requests) so
  // the frontend can hand them straight back to computeClosureDensityFromPoints below.
  const toPoint = (c) => ({ osm_id: String(graph.nodeOsmId[c.node]), lon: graph.nodeLon[c.node], lat: graph.nodeLat[c.node] });
  return {
    startPoints: startCandidates.map(toPoint),
    endPoints: endCandidates.map(toPoint),
    candidatesRejected,
    // Real diagnostic - the ACTUAL gap (meters) used per side, after any relaxation.
    // Equal to MIN_GAP_M when full spacing was achieved; smaller if the validated pool couldn't
    // support both the requested gap and the full count; `null` if even ungapped selection
    // couldn't reach `numCandidates` (fewer than numCandidates valid points exist at all).
    startGapUsedM, endGapUsedM,
  };
};

// Step 2/2: route tallying only, given ALREADY-SELECTED points (osm ids, e.g. from
// selectClosureDensityCandidates above, possibly after the frontend let the user review them).
// This is the expensive part (up to numStart*numEnd closed-route searches) - kept separate so a
// slow analysis doesn't also re-pay for point selection, and so the frontend can show points
// immediately without waiting on the full tally.
// Cached (see tallyResultCache above), keyed by the ACTUAL start/end ids passed in (not just
// ogcFid) so the cache stays correct regardless of which points a given caller resolved - a
// second request with the exact same point set (the common case: re-analyzing the same segment,
// possibly by a different user) skips the whole tally run.
const computeClosureDensityFromPoints = (db, graph, ogcFid, startNodeOsmIds, endNodeOsmIds, costObjective = "distance", signal) => {
  const startKey = [...startNodeOsmIds].sort().join(",");
  const endKey = [...endNodeOsmIds].sort().join(",");
  return memoizeByGraph(tallyResultCache, graph, `${ogcFid}:${costObjective}:${startKey}:${endKey}`, (requestTag, onPool) =>
    computeClosureDensityFromPointsUncached(db, graph, ogcFid, startNodeOsmIds, endNodeOsmIds, costObjective, requestTag, onPool),
  signal);
};

const computeClosureDensityFromPointsUncached = async (db, graph, ogcFid, startNodeOsmIds, endNodeOsmIds, costObjective = "distance", requestTag, onPool) => {
  const { excludedEdgeSet } = closureContext(graph, ogcFid, costObjective);
  const resolve = (osmId) => graph.nodeIdToIndex.get(String(osmId));
  // Route-comparison tab (see planning/transportny/tasks/current/
  // closure-density-route-comparison-tab.md) - keep the original osm_id alongside each resolved
  // node index so the per-pair comparison result can be labeled without a second lookup pass.
  const startResolved = (startNodeOsmIds || []).map((osmId) => ({ osmId: String(osmId), node: resolve(osmId) })).filter((r) => r.node !== undefined);
  const endResolved = (endNodeOsmIds || []).map((osmId) => ({ osmId: String(osmId), node: resolve(osmId) })).filter((r) => r.node !== undefined);
  if (!startResolved.length || !endResolved.length) {
    throw new Error("No valid start/end points provided");
  }

  const frequency = new Map(); // edgeIdx -> count
  let totalPairsComputed = 0;
  let totalPairsFailed = 0;

  // worker_threads pool (see planning/transportny/tasks/current/closure-density-performance.md) -
  // every start/end pair needs TWO independent searches (open
  // baseline + closed/detour), so ALL of them - both modes, every pair - run in ONE combined batch
  // spread across the pool, not two sequential passes. Uses bidirectionalDijkstra (via the worker)
  // instead of dijkstraEdgeExpansion - same exact edge-expansion Dijkstra semantics, no heuristic,
  // already proven correct elsewhere in this file, just faster per search.
  const tasks = [];
  const pairs = [];
  for (const start of startResolved) {
    for (const end of endResolved) {
      totalPairsComputed++;
      const closedId = tasks.length;
      tasks.push({ id: closedId, sourceNodeIdx: start.node, destNodeIdx: end.node, mode: "closed" });
      const openId = tasks.length;
      tasks.push({ id: openId, sourceNodeIdx: start.node, destNodeIdx: end.node, mode: "open" });
      pairs.push({ start, end, closedId, openId });
    }
  }
  const pool = await densitySearchPool.getPool(graph, costObjective);
  onPool?.(pool); // lets the memoize layer above cancel THIS request's own queued tasks if every caller sharing it aborts
  const resultsMap = await densitySearchPool.runTallyBatch(pool, Array.from(excludedEdgeSet), tasks, requestTag);

  // Sums the edgePath's REAL miles/seconds regardless of costObjective - matches findRoute's own
  // totalLengthM/totalDurationS pattern (the search's cost objective only picks WHICH path wins,
  // not what gets reported about it).
  const pathStats = (edgePath) => {
    let lengthM = 0, durationS = 0;
    for (const e of edgePath) { lengthM += graph.edgeLengthM[e]; durationS += graph.edgeDurationS[e]; }
    return { miles: lengthM / METERS_PER_MILE, durationS };
  };

  const pairComparisons = [];
  for (const { start, end, closedId, openId } of pairs) {
    const closedEdgePath = resultsMap.get(closedId);
    if (!closedEdgePath) { totalPairsFailed++; continue; }
    for (const e of closedEdgePath) {
      frequency.set(e, (frequency.get(e) || 0) + 1);
    }

    const openEdgePath = resultsMap.get(openId);
    if (!openEdgePath) continue; // no open-network route at all (shouldn't happen on a connected graph) - skip the comparison entry, heatmap tally above is unaffected

    const openStats = pathStats(openEdgePath);
    const closedStats = pathStats(closedEdgePath);
    pairComparisons.push({
      startOsmId: start.osmId, endOsmId: end.osmId,
      openMiles: openStats.miles, openDurationS: openStats.durationS,
      closedMiles: closedStats.miles, closedDurationS: closedStats.durationS,
      deltaMiles: closedStats.miles - openStats.miles,
      deltaDurationS: closedStats.durationS - openStats.durationS,
    });
  }
  // Smallest to largest detour cost, per the task's chosen chart form - the frontend bar graph
  // renders in this order directly, no client-side sort needed.
  pairComparisons.sort((a, b) => a.deltaMiles - b.deltaMiles);

  const ogcFids = [...frequency.keys()].map((e) => graph.edgeOgcFid[e]);
  const { rows: geomRows } = await db.query(
    `SELECT ogc_fid, ST_AsGeoJSON(wkb_geometry) AS geojson FROM ${graph.edgesTable} WHERE ogc_fid = ANY($1);`,
    [ogcFids]
  );
  const geomByOgcFid = new Map(geomRows.map((r) => [String(r.ogc_fid), JSON.parse(r.geojson)]));

  const edgeFrequencies = [];
  let maxCount = 0;
  for (const [e, count] of frequency) {
    const fid = graph.edgeOgcFid[e];
    const geom = geomByOgcFid.get(String(fid));
    if (!geom) continue; // shouldn't happen, but don't fail the whole response over one row
    if (count > maxCount) maxCount = count;
    edgeFrequencies.push({ ogc_fid: fid, highway: graph.edgeHighway[e], count, geometry: geom });
  }

  return {
    edgeFrequencies, maxCount,
    totalPairsComputed, totalPairsFailed,
    startCandidateCount: startResolved.length, endCandidateCount: endResolved.length,
    pairComparisons,
  };
};

module.exports = {
  getOrLoadGraph, invalidateGraph, findRoute,
  selectClosureDensityCandidates, computeClosureDensityFromPoints,
  resolveDetourEndpoints,
  resolveConflationTables,
  // Exported for index.js's warm-load log line only - the single hardcoded target version every
  // resolveConflationTables() call resolves against (see that constant's own comment above).
  CURRENT_CONFLATION_VERSION,
  // Exported for the standalone bridge-detour-process tool
  // (/home/sarang/Documents/avail/bridge-detour-process) - it needs to keep walking a failed
  // direction's endpoint further out (past additional branches) when the initial one-hop-past-
  // first-branch point hits a turn restriction, rather than duplicating this already-tested walk
  // logic in a separate script. closureContext resolves the segment's own fromNode/toNode/
  // excludedEdgeSet, the same inputs resolveDetourEndpoints itself passes to
  // walkToFirstBranchSimple - needed so the standalone tool can call the walk again with a real
  // (not reconstructed) blockedNode/excludedEdgeSet.
  walkToFirstBranchSimple,
  closureContext,
  // Exported for graphSearchWorker.js (worker_threads pool, densitySearchPool.js) - the worker
  // reconstructs a lightweight graph-like object from SharedArrayBuffers and calls this exact same
  // pure search function directly, so the parallelized path is provably the same algorithm as the
  // single-threaded one, not a reimplementation that could silently drift.
  bidirectionalDijkstra,
  // Exported for the standalone bridge-detour-process tool's on-disk graph cache - loadGraph's
  // ~1min DB round-trip is fine once, but re-paid on every iteration while tuning the batch logic.
  // The tool serializes
  // the typed arrays straight to disk and, on a cache hit, rebuilds nodeGrid from the restored
  // nodeLon/nodeLat itself rather than duplicating this class's spatial-bucketing logic.
  NodeGrid,
};
