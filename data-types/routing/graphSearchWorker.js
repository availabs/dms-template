/**
 * worker_threads worker for the closure-density point-selection validation searches
 * (planning/transportny/tasks/current/closure-density-performance.md). Runs
 * bidirectionalDijkstra (reused as-is from memoryGraph.js - no requires here pull in anything
 * DB-dependent, since this file only calls the pure search function) against a graph
 * reconstructed from SharedArrayBuffers received once at pool startup, not per task - the shared
 * memory is never copied per search, only read.
 *
 * Message protocol (see densitySearchPool.js, the pool manager that talks to this file):
 *   'init'      -> { numEdges, edgeSource, edgeTarget, adjHead, adjEdgeIndex, inAdjHead,
 *                    inAdjEdgeIndex, restrictionSorted, edgeCountForEncoding, costArray }
 *                  (SharedArrayBuffers, except numEdges/edgeCountForEncoding which are plain
 *                  numbers) -> replies { type: 'ready' } once the local graph view is built.
 *   'batch'     -> { edgeIdx, reverseIdx, items: [{ id, s, d }] } - point-selection validation:
 *                  runs an OPEN (unexcluded) bidirectionalDijkstra from node s to node d and
 *                  checks whether the resulting path uses edgeIdx or reverseIdx (the closed
 *                  segment's own two directions) -> replies
 *                  { type: 'batchResult', results: [{ id, usesClosedSegment }] }.
 *   'tallyBatch'-> { edgeIdx, reverseIdx, items: [{ id, s, d, mode }] } - closure-density tally
 *                  AND the open-vs-closed route comparison tab
 *                  (planning/transportny/tasks/current/closure-density-route-comparison-tab.md):
 *                  each item's `mode` is 'closed' (edgeIdx/reverseIdx excluded, for the heatmap
 *                  tally and the comparison's "after closure" side) or 'open' (no exclusion, the
 *                  comparison's "before closure" baseline) -> replies
 *                  { type: 'tallyBatchResult', results: [{ id, edgePath | null }] }.
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
    const { edgeIdx, reverseIdx, items } = msg;
    const results = items.map(({ id, s, d }) => {
      const result = memoryGraph.bidirectionalDijkstra(sharedGraph, s, d, sharedGraph.costArray, null);
      const path = result ? result.edgePath : [];
      const usesClosedSegment = path.includes(edgeIdx) || (reverseIdx !== -1 && path.includes(reverseIdx));
      return { id, usesClosedSegment };
    });
    parentPort.postMessage({ type: "batchResult", results });
    return;
  }

  if (msg.type === "tallyBatch") {
    const { edgeIdx, reverseIdx, items } = msg;
    const closedEdgeSet = new Set([edgeIdx]);
    if (reverseIdx !== -1) closedEdgeSet.add(reverseIdx);
    const results = items.map(({ id, s, d, mode }) => {
      const excludedEdgeSet = mode === "open" ? null : closedEdgeSet;
      const result = memoryGraph.bidirectionalDijkstra(sharedGraph, s, d, sharedGraph.costArray, excludedEdgeSet);
      return { id, edgePath: result ? Array.from(result.edgePath) : null };
    });
    parentPort.postMessage({ type: "tallyBatchResult", results });
  }
});
