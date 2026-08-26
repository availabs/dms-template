
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

// module-level singleton cache: "pgEnv:viewId" -> Promise<Graph>
const graphCache = new Map();

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

const getDataTable = async (db, view_id) => {
  const { rows } = await db.query(`SELECT data_table FROM data_manager.views WHERE view_id = $1;`, [view_id]);
  if (!rows.length) throw new Error(`No view found for view_id ${view_id}`);
  return rows[0].data_table;
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

const loadGraph = async (db, conflationViewId) => {
  const conflationTable = await getDataTable(db, conflationViewId);
  const nodesTable = `${conflationTable}_nodes`;
  const edgesTable = `${conflationTable}_edges`;
  const relationsTable = `${conflationTable}_relations`;

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

  return {
    conflationTable, edgesTable, nodesTable,
    numNodes, numEdges,
    nodeOsmId, nodeLon, nodeLat, nodeIdToIndex,
    edgeSource, edgeTarget, edgeLengthM, edgeDurationS, edgeOgcFid, edgeHighway,
    adjHead, adjEdgeIndex, inAdjHead, inAdjEdgeIndex,
    restrictionSet, edgeCountForEncoding,
    nodeGrid,
    restrictionsConsidered: restrictionSet.size,
  };
};

const getOrLoadGraph = (db, pgEnv, conflationViewId) => {
  const key = `${pgEnv}:${conflationViewId}`;
  if (!graphCache.has(key)) {
    graphCache.set(key, loadGraph(db, conflationViewId).catch((err) => {
      graphCache.delete(key); // don't cache a failed load
      throw err;
    }));
  }
  return graphCache.get(key);
};

const invalidateGraph = (pgEnv, conflationViewId) => {
  graphCache.delete(`${pgEnv}:${conflationViewId}`);
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
// low-thousand edges actually used, not the full network. This one small query was never the
// bottleneck (confirmed by the earlier EXPLAIN/timing work); moving pathfinding + restrictions
// off SQL is what actually mattered.
// Finds the reverse-direction edge for the same physical road as `edgeIdx` - an edge going from
// edgeTarget[edgeIdx] back to edgeSource[edgeIdx]. Used by the detour/avoid-segment feature to
// exclude BOTH directions of a road the user picked, not just the one directional edge feature
// they clicked (see detour-avoid-segment-routing-plugin.md - "exclude both directions" decision).
// Returns -1 if no such edge exists (e.g. a genuinely one-way road).
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
// detour-avoid-segment-routing-plugin.md, "Closure coverage / density analysis") - answers "of
// all the plausible trips that would have used this segment, which surrounding roads absorb the
// most rerouted traffic," not one trip's detour.
const MILE_M = 1609.34;
// Max search radius for candidate points, MEASURED FROM THE SEED POINT (walkToFirstBranch's
// result), not the segment's own endpoint. Shrunk 20mi -> 8mi (2026-08-25 perf - "why is it still
// taking a lot of time": the 20mi figure was sized back when candidates started right at the
// segment's own endpoint, to guarantee enough spread for 10 points at 0.5-0.75mi apart. Now that
// seeding (walkToFirstBranch) already pushes the search origin out to a real branch - sometimes
// itself up to 10mi out on a segment with no nearby cross-road - stacking a full 20mi candidate
// radius ON TOP of that seed distance means every validation/tally search may need to traverse a
// much longer route than before, which is real Dijkstra work no amount of worker-pool parallelism
// shrinks. 8mi still comfortably covers the ~7mi of spread 10 points at that spacing needs, without
// compounding the seed distance into a combined 20-30mi search radius on already-far-seeded sides.
const MAX_CANDIDATE_DISTANCE_M = 8 * MILE_M;

// Candidate search - ONE continuous search from the closed segment's own endpoint, not two
// separate searches stitched together (2026-08-21 rewrite, replacing an earlier same-road-then-
// fallback two-pass design after live testing kept surfacing bugs at the seam between the two
// passes). User's own framing for the correct shape: "need to expand from the broken segment
// only but need to go further in directional more priority and then if end then expand on both
// side of roads... a general algorithm."
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

    // `blockedNode` (2026-08-21 - live-tested real bug: "some start are going to the dir of the
    // end points") - `preVisited` only excluded the OTHER endpoint from being counted as a
    // candidate, it never stopped the search from traveling THROUGH it to reach the far side of
    // the closure. Blocking it here treats it as removed from the graph for this search, so the
    // start side's expansion stays confined to its own side of the closure (and symmetrically
    // for the end side) - "if you expand the road/dir, start go in that line and same for end."
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

  // `farthestFirst` (2026-08-21 follow-up - "first ones are good but the others are too far... go
  // a bit by bit slow, take .5 miles then 1 mile and etc... not like one point is near and all
  // are 4 miles"): farthest-first walking (the previous default) produced a bimodal near+far
  // split with nothing in between, once combined with the caller's stop-at-target validation
  // logic. Nearest-first gives smooth, gradual outward coverage instead - each group (same-road,
  // then fallback) stays in its natural ascending-distance order when `farthestFirst` is false.
  // Each entry is `{node, dist}` - `dist` is real network distance from the origin, needed by
  // the caller to enforce a minimum real-world gap between chosen candidates (2026-08-21 - "do
  // not take points nearby, take one far apart... a barrier of 0.25 to 0.5 miles minimum
  // distance between 2 start and 2 end points").
  // Return shape: `{ nodes, sameRoadCount }` - `sameRoadCount` (2026-08-21) lets the caller
  // budget the same-road and "escape onto other roads" phases SEPARATELY. Without this, a small
  // looped same-road network with many closely-spaced nodes (a real case hit live - "Campus
  // Access Road (inner)," a short loop) could consume the ENTIRE validation attempt budget
  // re-checking that one small loop, never reaching the roads that actually expand farther out -
  // "if dead end go to both direction and expand... it's kind of traversal finding."
  if (preferredHighway == null) return { nodes: farthestFirst ? reached.reverse() : reached, sameRoadCount: reached.length };
  const sameRoad = [], other = [];
  for (const r of reached) {
    (edgeHighway[reachedVia[r.node]] === preferredHighway ? sameRoad : other).push(r);
  }
  // Same-road nodes first (the search's own priority direction) - matches "go further in
  // directional priority, then if [that] ends expand on both sides."
  const nodes = farthestFirst ? [...sameRoad.reverse(), ...other.reverse()] : [...sameRoad, ...other];
  return { nodes, sameRoadCount: sameRoad.length };
};

// Walks from `startNode` along the network (both edge directions, since a real intersection can be
// reached via either) until it finds a REAL BRANCH - a node with more than one viable next edge,
// pure topology (edge count), same rule as the simple detour mode's endpoint picker
// (comp.jsx/findSameRoadNode.js) - then takes exactly ONE more hop and stops there. 2026-08-25,
// "the same kind of first expansion I need in the closure density mode - this must be the first
// point, then expand network after that point": ported server-side (not reusing the client's
// bbox-fetch version) because the in-memory CSR graph already has full adjacency in memory, so
// this is a fast synchronous walk, not a per-hop network round trip. Excludes `excludedEdgeSet`
// (the closed segment itself) and never crosses through `blockedNode` (the segment's OTHER
// endpoint - same crossing-prevention rule `farthestToNearestNodes` uses), so the seed point for
// each side stays confined to its own side of the closure. Falls back to whatever node the walk
// dead-ended at (or the start node itself, if nothing connects at all) rather than failing -
// "if dead end keep it there, it's okay."
const MAX_SEED_WALK_HOPS = 2000;
const MAX_SEED_WALK_DISTANCE_M = 10 * MILE_M; // per side - "10 miles in a single dir"
// Returns `{ node, path }` - `path` is every node visited along the way (including `startNode` and
// the final `node`), not just the destination. 2026-08-25 fix: once each side's search starts from
// a SEED further out (not the segment's own endpoint), blocking only the opposite side's final
// seed node isn't enough to keep the two sides from crossing - the search can still reach into the
// other side's territory via a path that never touches that one blocked node, especially along a
// shared road (live-tested: start/end candidate points interleaving on the same street). Blocking
// the WHOLE corridor each seed-walk traveled closes that gap.
// Bearing in degrees [0,360) from node `a` to node `b`, using nodeLon/nodeLat - same formula as
// the old client-side walk (comp.jsx's bearing(), now unused there since this replaced it), needed
// here so `walkToFirstBranch` can tell "the road continuing straight ahead" apart from "a cross
// street that happens to touch this same node."
const bearingDeg = (graph, a, b) => {
  const lat1 = (graph.nodeLat[a] * Math.PI) / 180;
  const lat2 = (graph.nodeLat[b] * Math.PI) / 180;
  const dLon = ((graph.nodeLon[b] - graph.nodeLon[a]) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};
const bearingDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

// Two independent copies (2026-08-26, "make search for both separate" - simple mode and density
// mode were sharing one function via a `stopAtBranch` flag; kept identical logic today, but now
// each mode can be tuned on its own without any risk of the other regressing). Both walk from
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
  let incomingBearing = null; // direction just travelled TO `current`, null on the very first hop
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

    // Pick the STRAIGHTEST-continuing edge, not just the first one adjacency happens to list -
    // no incoming bearing yet on the very first hop, so candidates[0] there is fine (just leaving
    // the closed segment's own endpoint, before any branch could have been seen).
    const next = incomingBearing === null || candidates.length === 1
      ? candidates[0]
      : candidates.reduce((best, c) => {
          const diff = bearingDiff(incomingBearing, bearingDeg(graph, current, c.node));
          return diff < best._diff ? { ...c, _diff: diff } : best;
        }, { ...candidates[0], _diff: bearingDiff(incomingBearing, bearingDeg(graph, current, candidates[0].node)) });
    prevNode = current;
    prevEdge = next.edge;
    incomingBearing = bearingDeg(graph, current, next.node);
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
  let incomingBearing = null; // direction just travelled TO `current`, null on the very first hop
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

    // Pick the STRAIGHTEST-continuing edge, not just the first one adjacency happens to list -
    // no incoming bearing yet on the very first hop, so candidates[0] there is fine (just leaving
    // the closed segment's own endpoint, before any branch could have been seen).
    const next = incomingBearing === null || candidates.length === 1
      ? candidates[0]
      : candidates.reduce((best, c) => {
          const diff = bearingDiff(incomingBearing, bearingDeg(graph, current, c.node));
          return diff < best._diff ? { ...c, _diff: diff } : best;
        }, { ...candidates[0], _diff: bearingDiff(incomingBearing, bearingDeg(graph, current, candidates[0].node)) });
    prevNode = current;
    prevEdge = next.edge;
    incomingBearing = bearingDeg(graph, current, next.node);
    current = next.node;
    travelledM += next.lengthM;
    path.push(current);

    if (isBranch && hop > 0) return { node: current, path, reason: "branch" }; // took the one hop past the branch - stop this direction here
  }
  return { node: current, path, reason: "hop_cap" };
};

// Resolves the closed segment + a same/open-route helper shared by both split steps below.
const closureContext = (graph, ogcFid, costObjective) => {
  const edgeIdx = findEdgeIndexByOgcFid(graph.edgeOgcFid, +ogcFid);
  if (edgeIdx === -1) throw new Error(`Unknown segment ogc_fid ${ogcFid}`);
  const reverseIdx = findReverseEdge(graph, edgeIdx);
  const excludedEdgeSet = new Set([edgeIdx]);
  if (reverseIdx !== -1) excludedEdgeSet.add(reverseIdx);
  const costArray = costObjective === "time" ? graph.edgeDurationS : graph.edgeLengthM;
  const routeUsesClosedSegment = (edgePath) => edgePath.includes(edgeIdx) || (reverseIdx !== -1 && edgePath.includes(reverseIdx));
  return { edgeIdx, reverseIdx, excludedEdgeSet, costArray, routeUsesClosedSegment };
};

// Simple detour mode's endpoint picker, moved server-side (2026-08-25 perf) - the client-side
// version (comp.jsx's walkForward) made ONE HTTP request per hop of the walk, which on a highway
// with short edges over a 10-mile budget could mean hundreds of sequential network round trips
// just to pick the start/end points, before "Get detour" even ran the real route search. This is
// the exact same walk-to-first-branch rule (`walkToFirstBranch` above, already used by
// selectClosureDensityCandidates), just exposed as one fast in-memory call instead of many.
const resolveDetourEndpoints = (graph, ogcFid) => {
  const { edgeIdx, excludedEdgeSet } = closureContext(graph, ogcFid, "distance"); // costObjective is irrelevant here - only used for excludedEdgeSet/edgeIdx
  const fromNode = graph.edgeSource[edgeIdx];
  const toNode = graph.edgeTarget[edgeIdx];
  const startWalk = walkToFirstBranchSimple(graph, fromNode, toNode, excludedEdgeSet);
  const endWalk = walkToFirstBranchSimple(graph, toNode, fromNode, excludedEdgeSet);
  const toPoint = (n, walk) => ({
    lon: graph.nodeLon[n], lat: graph.nodeLat[n], osm_id: String(graph.nodeOsmId[n]),
    hitDistanceCap: walk.reason === "distance_cap",
  });
  return { start: toPoint(startWalk.node, startWalk), end: toPoint(endWalk.node, endWalk) };
};

// Step 1/2 (2026-08-21 - split into two API calls so the frontend can show/confirm candidate
// points before committing to the expensive full analysis): point SELECTION only, no route
// tallying. See the inline comments below for the full history of how this selection logic
// evolved same day (evenly-spaced targets -> rejected, greedy-accept-first-N -> rejected,
// same-road-first accidentally dropped then restored).
const selectClosureDensityCandidates = async (graph, ogcFid, numCandidates = 10, costObjective = "distance") => {
  const { edgeIdx, reverseIdx, excludedEdgeSet } = closureContext(graph, ogcFid, costObjective);
  const fromNode = graph.edgeSource[edgeIdx];
  const toNode = graph.edgeTarget[edgeIdx];
  const closedHighway = graph.edgeHighway[edgeIdx];

  // Seed each side from its FIRST REAL BRANCH past the closed segment (2026-08-25, "the same kind
  // of first expansion I need in the closure density mode - this must be the first point, then
  // expand network after that point") - same walk-to-first-branch rule as the simple detour mode's
  // endpoint picker, so the expansion below starts from a genuine junction (somewhere a detour
  // actually has options) instead of the segment's own endpoint, which by OSM's own way-splitting
  // convention is usually already sitting exactly at an intersection.
  const startWalk = walkToFirstBranchDensity(graph, fromNode, toNode, excludedEdgeSet);
  const endWalk = walkToFirstBranchDensity(graph, toNode, fromNode, excludedEdgeSet);
  const startSeed = startWalk.node;
  const endSeed = endWalk.node;

  // Point selection (2026-08-21, confirmed rule, refined twice same day). First refinement:
  // "it's not like evenly... it's like we want the BEST points to understand the value of the
  // segment" - no fixed count/spacing, validity (does the OD pair actually use the segment) is
  // the primary filter. Second refinement, after a live test showed every accepted point crammed
  // right next to the closure: "keep points those are few miles away also, why that nearest?" -
  // greedily accepting the first N valid points was self-defeating, since points immediately
  // next to a closure are ALMOST ALWAYS valid (their open route obviously used the segment - it's
  // the most direct path), so the walk filled every slot with near points before ever reaching
  // farther out. Fixed by splitting validation from final selection:
  //   1. Seed each side with its nearest few points, accepted unconditionally (bootstrap - close
  //      points reliably represent real segment usage, so they're a trustworthy reference set).
  //   2. Validate the REST of each pool (out to MAX_CANDIDATE_DISTANCE_M) against the OTHER
  //      side's seed - collect every point that passes, near or far, without stopping early.
  //   3. From the seed + all validated points (already sorted nearest-to-farthest), pick the
  //      final `numCandidates` spread EVENLY BY INDEX across that whole validated list - so the
  //      final set spans near, mid, and far distances among genuinely valid pairs, instead of
  //      clustering at whichever end was walked first.
  // `farthestFirst: false` (2026-08-21 follow-up - see the walk-direction note on
  // farthestToNearestNodes above): walk NEAREST-first so validation covers gradual, incremental
  // distances (roughly .5mi, 1mi, 1.5mi, etc., however the real road network actually spaces
  // out) rather than jumping straight to the far end.
  // blockedNode = the OTHER endpoint - keeps the start side's search from crossing through it to
  // reach the end side's own territory, and vice versa (see farthestToNearestNodes' comment).
  // Block the OPPOSITE side's entire seed-walk corridor (every node it passed through, not just
  // its final seed point - see walkToFirstBranch's comment) - 2026-08-25 fix for a live-tested bug
  // where start/end candidate points interleaved along the same shared road once each side's
  // search started from a seed farther out than the segment's own endpoint.
  const { nodes: rawStartPool, sameRoadCount: startSameRoadCount } = farthestToNearestNodes(graph, startSeed, excludedEdgeSet, endWalk.path, MAX_CANDIDATE_DISTANCE_M, closedHighway, false, endWalk.path);
  const { nodes: rawEndPool, sameRoadCount: endSameRoadCount } = farthestToNearestNodes(graph, endSeed, excludedEdgeSet, startWalk.path, MAX_CANDIDATE_DISTANCE_M, closedHighway, false, startWalk.path);

  // MIN_GAP_M (2026-08-21 - "do not take points nearby, take one far apart... a barrier of 0.25
  // to 0.5 miles minimum distance between 2 start and 2 end points"): the earlier evenly-spaced-
  // BY-INDEX selection could still land two picks close together in real distance if the
  // validated list happened to be dense in one stretch (exactly what the screenshot showed -
  // several points bunched within a couple hundred meters near the top of one road). Enforcing
  // an actual minimum GAP IN METERS between consecutive picks (walking the already nearest-to-
  // farthest validated list and skipping anything too close to the last accepted pick) fixes
  // this directly, rather than index-spacing which only approximates it.
  // Raised from 0.75mi to 1mi (2026-08-21) - pickWithBestEffortGap below only relaxes DOWNWARD
  // from here if the count can't be reached at full spacing, so whatever gap actually gets used
  // naturally lands at or below 1mi.
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
  // "pick minimum 10-10 each side... let fix number 10" (2026-08-21) - count is now a hard
  // requirement, spacing is the thing allowed to give way if the validated pool genuinely can't
  // support both. Halves the gap and retries until `count` is reached or the gap bottoms out at
  // 0 (accept any validated point, spacing no longer enforced) - only relaxes AFTER exhausting
  // room to keep the requested gap, so it still prefers well-spaced picks whenever possible.
  // (A hard-floor variant - never relax below MIN_GAP_M, let count give way instead - was tried
  // twice on 2026-08-24, each time reverted the same day: once when it collapsed to ~1 point per
  // side on a small-pool segment, and again shortly after being reinstated.)
  // Returns `{ picked, gapUsedM }` (not just `picked`) - 2026-08-21, "it was not behaving like
  // that, the distance total also not 0.75 miles" - the relaxation was real but INVISIBLE: with
  // no way to see how far it had backed off, "the gap silently collapsed" and "the gap logic is
  // broken" looked identical from the outside. Reporting the actual achieved gap lets that be
  // checked with a real number instead of eyeballing a screenshot.
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
  // re-validated against itself). Reduced from 3 to 1 (2026-08-21 - "still a lot of time" even
  // after switching to bidirectionalDijkstra) - each candidate now costs 1 open-route search.
  // Tried restoring to 3 on 2026-08-25 to make passedFromCells's ">50% matched route" check a
  // genuine majority vote again (not a degenerate single check) - measured 20s -> 52s on a real
  // cold run and reverted. The SEED_COUNT/">50%" gap stays open; fixing it needs a real perf
  // budget for the extra searches, not a free win.
  const SEED_COUNT = Math.min(1, numCandidates);
  const seedStart = rawStartPool.slice(0, SEED_COUNT);
  const seedEnd = rawEndPool.slice(0, SEED_COUNT);
  const restStart = rawStartPool.slice(SEED_COUNT); // nearest-first, near seed head excluded
  const restEnd = rawEndPool.slice(SEED_COUNT);
  // Same-road/"other" boundary within `restStart`/`restEnd` (shifted back by the seed head we
  // just sliced off) - see validateBudget's split-budget use of this below.
  const restStartSameRoadCount = Math.max(0, startSameRoadCount - SEED_COUNT);
  const restEndSameRoadCount = Math.max(0, endSameRoadCount - SEED_COUNT);

  // MAX_ATTEMPTS (2026-08-21 - "still a lot of time," a real hard bound): caps total candidates
  // tried per side, so cost stays bounded regardless of how large the pool is or how many fail
  // validation - a request that returns fewer than `numCandidates` valid points beats one that
  // fails outright past the server's 30s timeout.
  //
  // Validates the WHOLE attempt budget up front - does NOT stop as soon as `numCandidates` valid
  // points are found (2026-08-21 follow-up fix: stopping early was the actual cause of the
  // "first ones good, others too far" bimodal result - walking nearest-first AND stopping at the
  // target just filled the target from the near end again; walking farthest-first AND stopping
  // at the target jumped straight to the far end. Validating the FULL budget nearest-first, THEN
  // choosing the final spread via `spreadSelect` below, is what actually produces smooth gradual
  // coverage - "go a bit by bit slow, take .5 miles then 1 mile and etc").
  // Bumped from *4 to *6 to *15 to now *30 (2026-08-21 - "pick minimum 10-10 each side... let fix
  // number 10," a hard requirement, not a best-effort target; count went back from 5 to 10 the
  // same day once the 90s scoped timeout made the extra cost affordable - see
  // DENSITY_POINTS_TIMEOUT in dms-server's index.js). Each prior multiplier still wasn't enough
  // pool to find `numCandidates` genuinely valid points spread a full 0.75mi apart before the
  // gap-relaxation fallback kicked in. Widening the budget gives that fallback (which relaxes the
  // GAP, never the count) a much larger validated pool to actually pick spaced-out points from.
  const MAX_ATTEMPTS = numCandidates * 30;
  // Split-budget fix (2026-08-21 - live-tested real bug): a short LOOPED same-road network can
  // have many closely-spaced nodes (a real case - "Campus Access Road (inner)," a small loop)
  // and, walking same-road-first with one shared budget, could consume the ENTIRE MAX_ATTEMPTS
  // re-validating that one small loop before ever reaching the "other" (escape-onto-a-different-
  // road) group that actually expands farther out - "so explore both direction for start and
  // end... if dead end go to both direction and expand... it's kind of traversal finding." Half
  // the budget is reserved for "other," guaranteed regardless of how large the same-road group
  // is or how much of its own half-budget it actually used.
  let candidatesRejected = 0;
  // Returns `{ sameRoadValid, otherValid }` SEPARATELY (2026-08-21 follow-up - "give priority to
  // the direction, if dead end then only expand the last branch... this is [a] long road so all
  // points must be on the same road"): a live test on a genuinely long road still pulled in a few
  // "other" (branched-off) points even though the same road alone had enough room for the full
  // count - because the previous version merged both phases into one list before selection, with
  // no preference for staying on the same road when it didn't actually need to branch. Keeping
  // them separate lets the caller try same-road-ONLY first and fall back to the branch only if
  // that's not enough - not just at validation time, at SELECTION time too.
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

  // worker_threads pool (2026-08-24 perf, planning/transportny/tasks/current/
  // closure-density-performance.md): every (candidate, opposite-seed-point) pair is an
  // independent OPEN-network search, so instead of calling passesValidation live in the
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
    const resultsMap = await densitySearchPool.runBatch(pool, edgeIdx, reverseIdx, tasks);
    for (const t of tasks) t._cells[t._ti][t._oi] = !!resultsMap.get(t.id);
  }

  // Same fails/oppositeSet.length <= 0.5 aggregation passesValidation used to do live, now reading
  // the precomputed cells instead of calling out to a search.
  //
  // A closed-network BFS reachability check was added here 2026-08-25 (catch a candidate whose
  // OPEN route passes validation but is genuinely disconnected once actually closed) and reverted
  // 2026-08-26 - it made point-selection noticeably slower (per-candidate BFS on the main thread),
  // and this call needs to stay fast for the demo. Revisit as a properly-parallelized version
  // (worker pool, like the >50% check below) rather than re-adding it inline here.
  const passedFromCells = (testIndices, cells, oppositeCount) => {
    const passed = new Map(); // restPool index -> boolean
    testIndices.forEach((idx, ti) => {
      if (oppositeCount === 0) { passed.set(idx, true); return; } // bootstrap - shouldn't hit (seed excluded from testIndices)
      const fails = cells[ti].filter((usesClosedSegment) => !usesClosedSegment).length;
      passed.set(idx, fails / oppositeCount <= 0.5);
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

  // Min-gap-enforced selection over the validated (nearest-to-farthest) list - "spread gradually
  // near to far among genuinely valid pairs, at least MIN_GAP_M apart," not "farthest possible,"
  // "first N found," or index-spacing alone. Falls back to a smaller gap (never a smaller count)
  // if the validated pool can't support both - see pickWithBestEffortGap above.
  //
  // SAME-ROAD PRIORITY AT SELECTION TIME (2026-08-21): try the same-road-validated set ALONE
  // first. Only fall back to the combined (same-road + branched-onto-other-roads) set if the
  // same road genuinely can't supply `numCandidates` even after fully relaxing the gap - "give
  // priority to the direction, if dead end then only expand the last branch." A long road with
  // plenty of its own valid, spread-out points should never need to touch the branch at all.
  // (A "fall back sooner, whenever same-road needed any relaxation" variant was tried 2026-08-24
  // alongside the hard gap floor above and reverted together with it the same day.)
  const selectPreferSameRoad = (sameValid, otherValid) => {
    const sameRoadOnly = pickWithBestEffortGap(sameValid, numCandidates, MIN_GAP_M);
    if (sameRoadOnly.picked.length >= numCandidates) return sameRoadOnly;
    const combined = [...sameValid, ...otherValid].sort((a, b) => a.dist - b.dist);
    return pickWithBestEffortGap(combined, numCandidates, MIN_GAP_M);
  };

  const { picked: startCandidates, gapUsedM: startGapUsedM } = selectPreferSameRoad(startSameValid, startOtherValid);
  const { picked: endCandidates, gapUsedM: endGapUsedM } = selectPreferSameRoad(endSameValid, endOtherValid);

  // osm ids (not internal indices - those aren't a stable public identifier across requests) so
  // the frontend can hand them straight back to computeClosureDensityFromPoints below.
  const toPoint = (c) => ({ osm_id: String(graph.nodeOsmId[c.node]), lon: graph.nodeLon[c.node], lat: graph.nodeLat[c.node] });
  return {
    startPoints: startCandidates.map(toPoint),
    endPoints: endCandidates.map(toPoint),
    candidatesRejected,
    // Real diagnostic (2026-08-21) - the ACTUAL gap (meters) used per side, after any relaxation.
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
const computeClosureDensityFromPoints = async (db, graph, ogcFid, startNodeOsmIds, endNodeOsmIds, costObjective = "distance") => {
  const { edgeIdx, reverseIdx } = closureContext(graph, ogcFid, costObjective);
  const resolve = (osmId) => graph.nodeIdToIndex.get(String(osmId));
  // Route-comparison tab (2026-08-24, planning/transportny/tasks/current/
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

  // worker_threads pool (2026-08-24 perf, planning/transportny/tasks/current/
  // closure-density-performance.md) - every start/end pair needs TWO independent searches (open
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
  const resultsMap = await densitySearchPool.runTallyBatch(pool, edgeIdx, reverseIdx, tasks);

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
  // Smallest to largest detour cost (2026-08-24, per the task's chosen chart form) - the frontend
  // bar graph renders in this order directly, no client-side sort needed.
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
  // Exported for graphSearchWorker.js (worker_threads pool, densitySearchPool.js) - the worker
  // reconstructs a lightweight graph-like object from SharedArrayBuffers and calls this exact same
  // pure search function directly, so the parallelized path is provably the same algorithm as the
  // single-threaded one, not a reimplementation that could silently drift.
  bidirectionalDijkstra,
};
