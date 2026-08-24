
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
const dijkstraEdgeExpansion = (graph, sourceNodeIdx, destNodeIdx, costArray) => {
  const { numEdges, edgeSource, edgeTarget, adjHead, adjEdgeIndex, restrictionSet, edgeCountForEncoding } = graph;

  const dist = new Float64Array(numEdges).fill(Infinity);
  const prevEdge = new Int32Array(numEdges).fill(-1);
  const settled = new Uint8Array(numEdges);
  const heap = new MinHeap(1024);

  // virtual start: every edge leaving the source node is a valid first move, cost = that edge's own cost
  for (let i = adjHead[sourceNodeIdx]; i < adjHead[sourceNodeIdx + 1]; i++) {
    const edgeIdx = adjEdgeIndex[i];
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
const bidirectionalDijkstra = (graph, sourceNodeIdx, destNodeIdx, costArray) => {
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
    if (costArray[e] < distF[e]) { distF[e] = costArray[e]; heapF.push(e, costArray[e]); }
  }
  for (let i = inAdjHead[destNodeIdx]; i < inAdjHead[destNodeIdx + 1]; i++) {
    const e = inAdjEdgeIndex[i];
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
        if (distB[eb] === Infinity) continue;
        if (restrictionSet.has(cur * edgeCountForEncoding + eb)) continue; // banned turn
        const total = distF[cur] + distB[eb];
        if (total < bestCost) { bestCost = total; bestForwardEdge = cur; bestBackwardEdge = eb; }
      }
      for (let i = adjHead[node]; i < adjHead[node + 1]; i++) {
        const nxt = adjEdgeIndex[i];
        if (settledF[nxt]) continue;
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
        if (distF[ef] === Infinity) continue;
        if (restrictionSet.has(ef * edgeCountForEncoding + cur)) continue; // banned turn
        const total = distF[ef] + distB[cur];
        if (total < bestCost) { bestCost = total; bestForwardEdge = ef; bestBackwardEdge = cur; }
      }
      for (let i = inAdjHead[node]; i < inAdjHead[node + 1]; i++) {
        const prv = inAdjEdgeIndex[i];
        if (settledB[prv]) continue;
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
const findRoute = async (db, graph, { lon: srcLon, lat: srcLat }, { lon: dstLon, lat: dstLat }, costObjective, algorithm = "dijkstra") => {
  const sourceNodeIdx = graph.nodeGrid.nearest(srcLon, srcLat);
  const destNodeIdx = graph.nodeGrid.nearest(dstLon, dstLat);
  if (sourceNodeIdx === -1 || destNodeIdx === -1) {
    throw new Error("Could not snap source/destination to the in-memory node grid");
  }

  const costArray = costObjective === "time" ? graph.edgeDurationS : graph.edgeLengthM;
  const result = algorithm === "bidirectional"
    ? bidirectionalDijkstra(graph, sourceNodeIdx, destNodeIdx, costArray)
    : dijkstraEdgeExpansion(graph, sourceNodeIdx, destNodeIdx, costArray);
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

module.exports = { getOrLoadGraph, invalidateGraph, findRoute };
