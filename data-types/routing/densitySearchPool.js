/**
 * worker_threads pool for the closure-density point-selection validation searches AND the
 * closure-density route-tally searches (planning/transportny/tasks/current/
 * closure-density-performance.md). Each search (point-selection's open-route validation, or the
 * tally's closed-route search) is fully independent, so they parallelize across real OS threads
 * instead of running one after another on the single event loop.
 *
 * One pool per (graph, costObjective) pair, cached and reused across requests - NOT per closure
 * (ogc_fid), so switching which segment is closed never respawns workers. The graph's topology
 * (edgeSource/edgeTarget/adjacency/restrictions) and cost array are copied ONCE into
 * SharedArrayBuffers at pool creation; which segment is "closed" (edgeIdx/reverseIdx) is passed
 * per-batch instead, since that's the only thing that varies per request.
 */

const { Worker } = require("worker_threads");
const os = require("os");
const path = require("path");

// Leaves at least one core free for the event loop / DB I/O / everything else the server does;
// capped at 8 so a huge box doesn't spawn an excessive number of long-lived workers holding a
// full graph-topology copy each.
const NUM_WORKERS = Math.max(1, Math.min(os.cpus().length - 1, 8));

// graph -> Map<costObjective, Promise<pool>> - a WeakMap keyed by the graph object itself (the
// same singleton memoryGraph.js already caches per pgEnv:viewId) so pools are garbage-collected
// automatically if that graph is ever evicted/reloaded, with no separate invalidation needed.
const poolsByGraph = new WeakMap();

const toSharedInt32 = (arr) => {
  const buf = new SharedArrayBuffer(arr.length * 4);
  new Int32Array(buf).set(arr);
  return buf;
};

const toSharedFloat64 = (arr) => {
  const buf = new SharedArrayBuffer(arr.length * 8);
  new Float64Array(buf).set(arr);
  return buf;
};

const createPool = async (graph, costObjective) => {
  const costSourceArray = costObjective === "time" ? graph.edgeDurationS : graph.edgeLengthM;
  // Sorted once here (not per request) - workers binary-search it the same way
  // findEdgeIndexByOgcFid does on the main thread, standing in for the Set a worker can't share.
  const restrictionSorted = Float64Array.from([...graph.restrictionSet].sort((a, b) => a - b));

  const initMsg = {
    type: "init",
    numEdges: graph.numEdges,
    edgeSource: toSharedInt32(graph.edgeSource),
    edgeTarget: toSharedInt32(graph.edgeTarget),
    adjHead: toSharedInt32(graph.adjHead),
    adjEdgeIndex: toSharedInt32(graph.adjEdgeIndex),
    inAdjHead: toSharedInt32(graph.inAdjHead),
    inAdjEdgeIndex: toSharedInt32(graph.inAdjEdgeIndex),
    restrictionSorted: toSharedFloat64(restrictionSorted),
    edgeCountForEncoding: graph.edgeCountForEncoding,
    costArray: toSharedFloat64(costSourceArray),
  };

  const workerPath = path.join(__dirname, "graphSearchWorker.js");
  const workers = [];
  const t0 = Date.now();
  for (let i = 0; i < NUM_WORKERS; i++) {
    const worker = new Worker(workerPath);
    await new Promise((resolve, reject) => {
      const onMessage = (msg) => { if (msg.type === "ready") { worker.off("error", onError); resolve(); } };
      const onError = (err) => { worker.off("message", onMessage); reject(err); };
      worker.once("message", onMessage);
      worker.once("error", onError);
      worker.postMessage(initMsg);
    });
    workers.push(worker);
  }
  console.log(`[densitySearchPool] spawned ${workers.length} workers for costObjective=${costObjective} in ${Date.now() - t0}ms`);
  return { workers };
};

const getPool = (graph, costObjective) => {
  let byObjective = poolsByGraph.get(graph);
  if (!byObjective) { byObjective = new Map(); poolsByGraph.set(graph, byObjective); }
  if (!byObjective.has(costObjective)) {
    byObjective.set(costObjective, createPool(graph, costObjective).catch((err) => {
      byObjective.delete(costObjective); // don't cache a failed pool
      throw err;
    }));
  }
  return byObjective.get(costObjective);
};

// tasks: [{ id, sourceNodeIdx, destNodeIdx }] -> Map<id, usesClosedSegment>. Round-robin chunking
// (not contiguous slabs) so the tasks each worker gets are drawn evenly from across the whole
// list rather than one worker getting only the "easy" end - a reasonable balance given individual
// searches are roughly similar cost, without the complexity of a dynamic re-queueing scheduler.
const runBatch = async (pool, edgeIdx, reverseIdx, tasks) => {
  if (tasks.length === 0) return new Map();
  const { workers } = pool;
  const n = workers.length;
  const chunks = Array.from({ length: n }, () => []);
  tasks.forEach((t, i) => chunks[i % n].push(t));

  const promises = workers.map((worker, i) => {
    if (chunks[i].length === 0) return Promise.resolve([]);
    return new Promise((resolve, reject) => {
      const onMessage = (msg) => {
        if (msg.type !== "batchResult") return;
        worker.off("message", onMessage);
        worker.off("error", onError);
        resolve(msg.results);
      };
      const onError = (err) => { worker.off("message", onMessage); reject(err); };
      worker.on("message", onMessage);
      worker.once("error", onError);
      worker.postMessage({
        type: "batch", edgeIdx, reverseIdx,
        items: chunks[i].map((t) => ({ id: t.id, s: t.sourceNodeIdx, d: t.destNodeIdx })),
      });
    });
  });

  const resultsArrays = await Promise.all(promises);
  const resultsMap = new Map();
  for (const arr of resultsArrays) for (const item of arr) resultsMap.set(item.id, item.usesClosedSegment);
  return resultsMap;
};

// Closure-density STEP 2/2 (computeClosureDensityFromPoints's tally) - same pool, same round-robin
// chunking, but dispatches 'tallyBatch' (closed-network search, full edgePath returned) instead of
// 'batch' (open-network search, boolean-only). tasks: [{ id, sourceNodeIdx, destNodeIdx }] ->
// Map<id, edgePath | null> (null = no route found for that pair). tasks may mix `mode: 'closed'`
// (default, edgeIdx/reverseIdx excluded - the heatmap tally) and `mode: 'open'` (no exclusion -
// the route-comparison tab's "before closure" baseline,
// planning/transportny/tasks/current/closure-density-route-comparison-tab.md) in the SAME batch,
// so both sides of a comparison run across the whole pool together, not as two sequential passes.
const runTallyBatch = async (pool, edgeIdx, reverseIdx, tasks) => {
  if (tasks.length === 0) return new Map();
  const { workers } = pool;
  const n = workers.length;
  const chunks = Array.from({ length: n }, () => []);
  tasks.forEach((t, i) => chunks[i % n].push(t));

  const promises = workers.map((worker, i) => {
    if (chunks[i].length === 0) return Promise.resolve([]);
    return new Promise((resolve, reject) => {
      const onMessage = (msg) => {
        if (msg.type !== "tallyBatchResult") return;
        worker.off("message", onMessage);
        worker.off("error", onError);
        resolve(msg.results);
      };
      const onError = (err) => { worker.off("message", onMessage); reject(err); };
      worker.on("message", onMessage);
      worker.once("error", onError);
      worker.postMessage({
        type: "tallyBatch", edgeIdx, reverseIdx,
        items: chunks[i].map((t) => ({ id: t.id, s: t.sourceNodeIdx, d: t.destNodeIdx, mode: t.mode || "closed" })),
      });
    });
  });

  const resultsArrays = await Promise.all(promises);
  const resultsMap = new Map();
  for (const arr of resultsArrays) for (const item of arr) resultsMap.set(item.id, item.edgePath);
  return resultsMap;
};

module.exports = { getPool, runBatch, runTallyBatch, NUM_WORKERS };
