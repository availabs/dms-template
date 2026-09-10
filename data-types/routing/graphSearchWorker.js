/**
 * worker_threads worker for the closure-density point-selection validation and route-tally
 * searches. Runs bidirectionalDijkstra against a graph rebuilt from SharedArrayBuffers sent once
 * at pool startup (never copied per search). See densitySearchPool.js for the pool manager and
 * planning/transportny/tasks/current/detour-avoid-segment-routing-plugin.md for why the protocol
 * is one search per message (not a chunk) with every reply echoing its `taskId` back.
 *
 * Message protocol:
 *   'init'      -> graph SharedArrayBuffers -> { type: 'ready' }
 *   'batch'     -> { taskId, excludedEdgeIndices, s, d } - OPEN search, checks if the path uses
 *                  ANY of excludedEdgeIndices (the widened whole-bridge closed set, not just one
 *                  matched edge) -> { taskId, type: 'batchResult', usesClosedSegment, reachable }
 *                  (reachable: false only when no route exists at all)
 *   'tallyBatch'-> { taskId, excludedEdgeIndices, s, d, mode: 'closed'|'open' } -> { taskId,
 *                  type: 'tallyBatchResult', edgePath | null }
 */

const { parentPort } = require("worker_threads");
const memoryGraph = require("./memoryGraph");

let sharedGraph = null;

// Binary search over a sorted Float64Array standing in for the main thread's restrictionSet
// (a Set<number>, not directly shareable across threads) - same lookup contract
// (`.has(key) -> boolean`) that bidirectionalDijkstra already expects from graph.restrictionSet.
const makeRestrictionLookup = (sorted) => ({
  has(key) {
    let lo = 0, hi = sorted.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const v = sorted[mid];
      if (v === key) return true;
      if (v < key) lo = mid + 1; else hi = mid - 1;
    }
    return false;
  },
});

parentPort.on("message", (msg) => {
  if (msg.type === "init") {
    sharedGraph = {
      numEdges: msg.numEdges,
      edgeSource: new Int32Array(msg.edgeSource),
      edgeTarget: new Int32Array(msg.edgeTarget),
      adjHead: new Int32Array(msg.adjHead),
      adjEdgeIndex: new Int32Array(msg.adjEdgeIndex),
      inAdjHead: new Int32Array(msg.inAdjHead),
      inAdjEdgeIndex: new Int32Array(msg.inAdjEdgeIndex),
      restrictionSet: makeRestrictionLookup(new Float64Array(msg.restrictionSorted)),
      edgeCountForEncoding: msg.edgeCountForEncoding,
      costArray: new Float64Array(msg.costArray),
    };
    parentPort.postMessage({ type: "ready" });
    return;
  }

  if (msg.type === "batch") {
    const { taskId, excludedEdgeIndices, s, d } = msg;
    const result = memoryGraph.bidirectionalDijkstra(sharedGraph, s, d, sharedGraph.costArray, null);
    const path = result ? result.edgePath : [];
    const excludedSet = new Set(excludedEdgeIndices);
    const usesClosedSegment = path.some((e) => excludedSet.has(e));
    parentPort.postMessage({ taskId, type: "batchResult", usesClosedSegment, reachable: result !== null });
    return;
  }

  if (msg.type === "tallyBatch") {
    const { taskId, excludedEdgeIndices, s, d, mode } = msg;
    const excludedEdgeSet = mode === "open" ? null : new Set(excludedEdgeIndices);
    const result = memoryGraph.bidirectionalDijkstra(sharedGraph, s, d, sharedGraph.costArray, excludedEdgeSet);
    parentPort.postMessage({ taskId, type: "tallyBatchResult", edgePath: result ? Array.from(result.edgePath) : null });
  }
});
