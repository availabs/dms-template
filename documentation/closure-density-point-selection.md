# Closure coverage / density: candidate point selection rules

Reference for how `selectClosureDensityCandidates` (`data-types/routing/memoryGraph.js`) picks
the start/end origin-destination points for the `detour` plugin's closure coverage/density
analysis. This is the CURRENT, settled design - for the chronological story of how it got here
(the bugs found, the live tests, the user's own words at each step), see
`planning/transportny/tasks/current/detour-avoid-segment-routing-plugin.md`. Keep this file in
sync whenever the rules below change; it is the file to read before touching this logic again.

## The goal

Given a closed road segment, find realistic origin/destination pairs whose trip genuinely used
that segment before it closed - not just "nearby points," and not an arbitrary fixed grid. The
resulting pairs are what the closed-route tally (`computeClosureDensityFromPoints`) runs over to
build the "which surrounding roads absorb the rerouted traffic" heatmap.

## The rules, in order

1. **Search from the segment's own two endpoints only**, one search per side (start side from
   `fromNode`, end side from `toNode`).

2. **Each side's search is blocked from crossing to the other side.** The opposite endpoint is
   removed from the graph entirely for that side's search (`blockedNode` in
   `farthestToNearestNodes`) - not just excluded from the results. Without this, an undirected
   search can wrap around through the other endpoint and produce "start" candidates that sit on
   the end side's own territory (and vice versa).

3. **Same road first, other roads only once that runs out.** Within a side's search, nodes
   reached via an edge matching the closed segment's own `highway` type are treated as the
   primary pool; nodes reached via a different road type are the fallback pool, used only when
   the same road can't supply enough. This is a genuine two-way split maintained through the
   whole pipeline:
   - **Search classification**: `farthestToNearestNodes` tags every reached node with whether the
     edge that reached it matched the closed segment's own highway type, and returns the two
     groups separately (`sameRoadCount` marks the boundary).
   - **Validation budget**: `MAX_ATTEMPTS` (`numCandidates * 30`) is split so the same-road phase
     is capped at half, GUARANTEEING the "other" phase gets the remaining half regardless of how
     large the same-road pool is. A short looped road can have many closely-spaced same-type
     nodes; without this split, validating that loop alone could burn the entire budget and never
     reach the roads that actually expand farther out.
   - **Final selection**: the same-road-validated set is tried ALONE first
     (`selectPreferSameRoad`). The "other" (branched) set is only merged in as a fallback if the
     same road genuinely can't reach `numCandidates` even after fully relaxing the minimum gap. A
     long road with enough of its own spread-out valid points never touches the branch at all.

4. **A candidate only counts if it's genuinely relevant.** For each candidate, compute the OPEN
   (non-excluded) route to a reference seed point on the opposite side (`passesValidation`). The
   candidate is accepted only if that route actually passes through the closed segment. The seed
   itself (the single nearest node on each side) is accepted unconditionally as the bootstrap
   reference, since being immediately adjacent to the closure makes it reliably relevant.

5. **Real minimum spacing between picks, not index spacing.** `MIN_GAP_M` (currently 1 mile) is
   enforced as actual real-world network distance (`candidate.dist`, accumulated in the search)
   between consecutive accepted picks on the SAME side - not "every Nth item in a list," which can
   still land two picks close together if the validated pool happens to be dense in one stretch.

6. **Count is a hard requirement; the gap is what gives way if needed.** `numCandidates` (10 per
   side) must be reached as long as at least that many valid points exist anywhere in the search
   budget. `pickWithBestEffortGap` tries the full `MIN_GAP_M` first, and only halves the gap
   (repeating until the count is reached, or the gap bottoms out) if the pool can't support both
   the full spacing and the full count. It is never the other way around - the count doesn't give
   way to preserve spacing. (A hard-floor variant of this rule - gap never relaxed, count gives way
   instead - was tried twice on 2026-08-24 and reverted both times: once when it collapsed to ~1
   point per side on a small-pool segment, and again shortly after being reinstated a second time.)

7. **Search radius is a cap, not a target.** `MAX_CANDIDATE_DISTANCE_M` (20 miles) only bounds how
   far the search is allowed to look - it's generous headroom past the ~9-10mi a side realistically
   needs at 10 points and a 1mi gap, not a distance the search tries to reach. A short road that
   dead-ends at 3 miles just returns whatever it found up to that point.

8. **App-level request timeout is bypassed for both density routes.** Guaranteeing real spacing
   (rule 6) is inherently variable in cost per closure - `/trsp-memory-density-points` and
   `/trsp-memory-density` skip the app-level timeout entirely in
   `src/dms/packages/dms-server/src/index.js`, rather than tuned to another arbitrary number. As of
   2026-08-24 this is uncommitted, local-only working-tree state in the `src/dms` submodule (see
   `closure-density-performance.md`) - re-apply it after any fresh submodule pull/checkout if it's
   gone missing.

9. **Validation searches run in parallel across a worker_threads pool.** Point selection used to
   run every validation search sequentially on the main thread; `densitySearchPool.js` +
   `graphSearchWorker.js` now dispatch the whole request's searches (both sides, all attempts) in
   one combined batch across a pool of workers sharing the graph via `SharedArrayBuffer`. Same
   exact `bidirectionalDijkstra` algorithm, just parallelized - see
   `closure-density-performance.md` for the full design and measured speedup (~60s+ -> ~18s on a
   real closure at the time it was built).

## Current tunable values

| Constant | Value | Where |
|---|---|---|
| `numCandidates` (target count per side) | 10 | `selectClosureDensityCandidates` default / `DENSITY_NUM_CANDIDATES` (frontend) |
| `MIN_GAP_M` (minimum real-world spacing) | 1 mile | `selectClosureDensityCandidates` |
| `MAX_CANDIDATE_DISTANCE_M` (search radius cap) | 20 miles | module-level constant |
| `MAX_ATTEMPTS` (validation budget per side) | `numCandidates * 30` | `selectClosureDensityCandidates` |
| `SEED_COUNT` (bootstrap reference points) | 1 | `selectClosureDensityCandidates` |
| Request timeout | bypassed (uncommitted, see rule 8) | `src/dms/packages/dms-server/src/index.js` |
| Worker pool size | `min(cpus-1, 8)` | `densitySearchPool.js` |

## Diagnostics available in the response

`selectClosureDensityCandidates`'s result includes:
- `candidatesRejected` - how many candidates were tried and failed validation.
- `startGapUsedM` / `endGapUsedM` - the ACTUAL gap (meters) used per side after any relaxation.
  Equal to `MIN_GAP_M` when full spacing was achieved; smaller if relaxed; `null` if even an
  ungapped selection couldn't reach `numCandidates` at all (fewer than `numCandidates` valid
  points exist in the whole searched area).

A cheap geometric pre-filter (skip a validation search when the candidate's direction makes it
geometrically impossible to pass through the closure) was tried alongside an earlier version of the
worker_threads work - it measured only a partial win on its own (223 of 226 rejections skipped, but
377 real searches still ran at ~164ms each) and was reverted along with that attempt, not carried
forward into the current pool-based version. Worth reconsidering only if a future profiling pass
shows the pool itself isn't enough on some segment's validation budget.

These exist specifically so "is the gap/count actually what it's supposed to be" can be answered
from a real number in the response or server log, not by eyeballing a map screenshot.
