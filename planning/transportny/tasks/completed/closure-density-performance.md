# Closure-density point-selection performance

**Project:** TransportNY · **Topic:** themes · **Status:** DONE - verified live (worker_threads pool, both APIs fast) · **Started:** 2026-08-24 · **Completed:** 2026-08-24

## Outcome

Implemented `data-types/routing/densitySearchPool.js` + `graphSearchWorker.js` - a worker_threads
pool (`min(cpus-1, 8)` workers) sharing the graph's topology/cost arrays via `SharedArrayBuffer`,
copied once per `(graph, costObjective)` pair, reused across requests. Both
`selectClosureDensityCandidates` (point-selection validation) and `computeClosureDensityFromPoints`
(the route tally) dispatch their independent per-pair searches to the pool in one combined batch
instead of running them sequentially on the main thread - same exact `bidirectionalDijkstra`
algorithm (exported from `memoryGraph.js` specifically so the worker calls the identical function,
not a reimplementation), just parallelized.

Verified live on the same reference closure used throughout this investigation:
- Point selection: ~60s+ (serial) -> ~18s (pool).
- Route tally: ~60s+ estimated serial -> ~3-5s (pool), even after later also doubling its search
  count for the route-comparison tab (open + closed route per pair, not just closed).

The app-level request timeout bypass for both density routes
(`src/dms/packages/dms-server/src/index.js`) is kept as an uncommitted, local-only working-tree
change in the `src/dms` submodule - re-apply it after any fresh submodule pull/checkout.

A cheap geometric pre-filter (skip validation searches whose direction makes them geometrically
impossible) was tried and measured only a partial win before the pool made it unnecessary - not
carried into the final version (see `documentation/closure-density-point-selection.md`).
`computeClosureDensityFromPoints` also picked up the `bidirectionalDijkstra` swap (from
`dijkstraEdgeExpansion`) along the way, via the same worker path.

## Objective

`selectClosureDensityCandidates` (`data-types/routing/memoryGraph.js`) now produces correct
results (see [Detour / avoid-segment routing plugin](./detour-avoid-segment-routing-plugin.md) and
`documentation/closure-density-point-selection.md`), but the request can be slow, and the
app-level request timeout that was removed to work around this has since been reverted (submodule
pulled back to latest `origin/master`, plain 30s default restored) - so slow requests can fail
again with "Failed to fetch". This task is about making the search itself fast enough that the
default timeout is no longer a problem, rather than special-casing the timeout again.

## Root cause

`selectClosureDensityCandidates` and `computeClosureDensityFromPoints` run synchronous, CPU-bound
Dijkstra-family searches directly on the Node event loop. Nothing else - including other requests
- can proceed while one of these runs, and the start-side/end-side searches within a single
request also can't overlap.

## Proposed work, in priority order

1. **Move the search to `worker_threads`.** The graph's typed-array CSR adjacency
   (`data-types/routing/memoryGraph.js`) is already `SharedArrayBuffer`-compatible, so it can be
   shared into a worker without copying. This is the only real lever for letting concurrent
   closure requests (or the start-side/end-side searches within one request) actually run in
   parallel instead of queueing behind each other on the event loop.
2. **Switch `computeClosureDensityFromPoints`'s tally search to `bidirectionalDijkstra`.** Step 1
   (`selectClosureDensityCandidates`) already switched its `getOpenRoute` helper to
   `bidirectionalDijkstra` for speed; step 2 still uses the slower `dijkstraEdgeExpansion` for
   every start×end route pair.
3. **Cheap geometric pre-filter before validation.** Many raw candidates are spatially implausible
   (wrong side of the closure, etc.) and could be discarded by a straight-line distance/bearing
   check before spending a full `bidirectionalDijkstra` validation call on them - cuts the number
   of expensive searches per request.
4. **Confirm/parallelize start-side vs. end-side work** where it doesn't depend on
   `worker_threads` - e.g. any I/O-bound portions - as a stepping stone toward (1).
5. **Cache raw candidate pools per closure.** `rawStartPool`/`rawEndPool` don't depend on
   `numCandidates`/`MIN_GAP_M`, only the selection/validation step does - if a user re-runs the
   analysis on the same segment with different count/gap, the pools could be reused.

## Open question

Once the search is fast enough, decide whether to leave the plain 30s default timeout in place
(and rely on the speed fix) or reinstate a scoped timeout override for the two density routes in
`src/dms/packages/dms-server/src/index.js` as a safety net. Revisit rule #8 in
`documentation/closure-density-point-selection.md` (currently stale - claims "no timeout") once
this is decided.

## Testing checklist

- [ ] Re-measure `searchMs` for a representative closure before/after each change.
- [ ] Confirm concurrent closure requests no longer block each other (if worker_threads lands).
- [ ] Re-verify point-selection correctness is unchanged (same-road priority, crossing prevention,
      gap enforcement) after the algorithmic swaps - performance work must not regress rules in
      `documentation/closure-density-point-selection.md`.
- [ ] Update `documentation/closure-density-point-selection.md` rule #8 (timeout) to match
      whatever the final decision is.
