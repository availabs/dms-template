/**
 * worker_threads pool for the closure-density point-selection validation searches AND the
 * closure-density route-tally searches. Each search runs on a real OS thread instead of the event
 * loop. One pool per (graph, costObjective), reused across requests - NOT per closure.
 *
 * Shared by every concurrent request (no per-request pool) - see "Concurrency/scalability
 * hardening" in planning/transportny/tasks/current/detour-avoid-segment-routing-plugin.md for why
 * that's safe: per-task `taskId` correlation (not "whichever call is still listening on this
 * worker" - a confirmed live cross-wiring/hang bug), a shared FIFO task queue for fair
 * interleaving, and an admission gate (MAX_ACTIVE_REQUESTS) so a traffic burst queues instead of
 * flooding the pool all at once.
 */

const { Worker } = require("worker_threads");
const os = require("os");
const path = require("path");

// Leaves at least one core free for the event loop / DB I/O / everything else the server does;
// capped at 8 so a huge box doesn't spawn an excessive number of long-lived workers holding a
// full graph-topology copy each.
const NUM_WORKERS = Math.max(1, Math.min(os.cpus().length - 1, 8));

// How many runBatch/runTallyBatch calls (i.e. distinct in-flight analyses) may feed the shared
// task queue at once. Not a hard cap on concurrent USERS - it's a cap on how many heavy analyses
// compete for the fixed worker budget at the same instant; extra calls queue and run as soon as a
// slot frees, rather than every simultaneous request flooding the queue together.
const MAX_ACTIVE_REQUESTS = 6;

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

// One shared FIFO task queue + worker dispatch loop for the whole pool. Individual searches (not
// per-request chunks) are the unit of scheduling, so workers interleave fairly across whatever
// concurrent requests currently have tasks outstanding.
const createTaskQueue = (workers) => {
  const queue = []; // FIFO of { taskId, message }
  const pending = new Map(); // taskId -> { resolve, reject }
  const idle = [...workers];
  let nextTaskId = 0;

  const dispatch = () => {
    while (idle.length > 0 && queue.length > 0) {
      const worker = idle.pop();
      const { taskId, message } = queue.shift();
      worker.postMessage({ ...message, taskId });
    }
  };

  for (const worker of workers) {
    worker.on("message", (msg) => {
      if (msg.taskId === undefined) return; // 'ready' (init) or any other non-task message
      const entry = pending.get(msg.taskId);
      if (!entry) return; // no longer awaited (shouldn't happen - defensive, not a silent-drop risk since nothing is still waiting on it)
      pending.delete(msg.taskId);
      idle.push(worker);
      entry.resolve(msg);
      dispatch();
    });
    worker.on("error", (err) => {
      // A worker crash must not hang every request that had a task in flight on it - fail them
      // all so callers see an error instead of waiting forever. The pool itself keeps the other
      // workers; a crashed worker simply stops receiving new tasks (idle.push never re-adds it).
      for (const [taskId, entry] of pending) {
        pending.delete(taskId);
        entry.reject(err);
      }
    });
  }

  const submit = (message, requestTag) =>
    new Promise((resolve, reject) => {
      const taskId = nextTaskId++;
      pending.set(taskId, { resolve, reject, requestTag });
      queue.push({ taskId, message, requestTag });
      dispatch();
    });

  // Drops requestTag's still-queued (not yet dispatched) tasks, resolving them as `cancelled`
  // instead of hanging. In-flight tasks on a worker can't be interrupted - they finish and their
  // reply is discarded. Returns the drop count for logging.
  const cancelTag = (requestTag) => {
    let dropped = 0;
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i].requestTag !== requestTag) continue;
      const { taskId } = queue[i];
      queue.splice(i, 1);
      const entry = pending.get(taskId);
      if (entry) { pending.delete(taskId); entry.resolve({ cancelled: true }); dropped++; }
    }
    return dropped;
  };

  return { submit, cancelTag };
};

// Admission gate: bounds how many runBatch/runTallyBatch calls are actively submitting to the
// shared queue at once. FIFO wait list, one slot handed directly to the next waiter on release
// (never re-decrements activeCount on handoff) so a burst of requests drains in arrival order.
const createAdmissionGate = (maxActive) => {
  let active = 0;
  const waiting = [];
  const acquire = () => {
    if (active < maxActive) { active++; return Promise.resolve(); }
    return new Promise((resolve) => waiting.push(resolve));
  };
  const release = () => {
    const next = waiting.shift();
    if (next) next();
    else active--;
  };
  return { acquire, release };
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
  return { workers, taskQueue: createTaskQueue(workers), admissionGate: createAdmissionGate(MAX_ACTIVE_REQUESTS) };
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

// tasks: [{ id, sourceNodeIdx, destNodeIdx }] -> Map<id, { usesClosedSegment, reachable }>.
// `reachable: false` means no open-network route at all - kept distinct from usesClosedSegment so
// an unreachable candidate never scores like a genuine off-closure route. `requestTag` (optional)
// tags this call's tasks so a caller can later drop just its own via taskQueue.cancelTag(...).
// `excludedEdgeIndices` is the FULL widened closed-edge set (matched edge + reverse twin + any
// whole-bridge sibling edges, see closureContext/loadGraph's bridgeSiblingEdges) - not just the
// two indices of the one matched segment, so validation/tally correctly treats the whole physical
// structure as closed, not just the one directional piece a user happened to click.
const runBatch = async (pool, excludedEdgeIndices, tasks, requestTag) => {
  if (tasks.length === 0) return new Map();
  await pool.admissionGate.acquire();
  try {
    const replies = await Promise.all(
      tasks.map((t) =>
        pool.taskQueue.submit({ type: "batch", excludedEdgeIndices, s: t.sourceNodeIdx, d: t.destNodeIdx }, requestTag)
      )
    );
    const resultsMap = new Map();
    tasks.forEach((t, i) => {
      const reply = replies[i];
      if (reply.cancelled) return; // dropped via cancelTag - just absent from the result, not an error
      resultsMap.set(t.id, { usesClosedSegment: reply.usesClosedSegment, reachable: reply.reachable });
    });
    return resultsMap;
  } finally {
    pool.admissionGate.release();
  }
};

// Closure-density STEP 2/2 - same queue/gate as runBatch, dispatches 'tallyBatch' (closed-network
// search, full edgePath) instead of 'batch'. Map<id, edgePath | null>. `mode: 'closed'` (default)
// vs `mode: 'open'` (route-comparison tab's baseline) may mix in one call.
const runTallyBatch = async (pool, excludedEdgeIndices, tasks, requestTag) => {
  if (tasks.length === 0) return new Map();
  await pool.admissionGate.acquire();
  try {
    const replies = await Promise.all(
      tasks.map((t) =>
        pool.taskQueue.submit({
          type: "tallyBatch", excludedEdgeIndices,
          s: t.sourceNodeIdx, d: t.destNodeIdx, mode: t.mode || "closed",
        }, requestTag)
      )
    );
    const resultsMap = new Map();
    tasks.forEach((t, i) => {
      if (replies[i].cancelled) return; // dropped via cancelTag - absent from the result, not an error
      resultsMap.set(t.id, replies[i].edgePath);
    });
    return resultsMap;
  } finally {
    pool.admissionGate.release();
  }
};

module.exports = { getPool, runBatch, runTallyBatch, NUM_WORKERS };
