# ALT (A* + Landmarks + Triangle inequality) routing heuristic — exploratory

**Project:** TransportNY · **Topic:** themes · **Status:** EXPLORING, NOT FINALIZED · **Started:** 2026-08-19

**Code removed 2026-08-19** (user: "remove the unnecessary and testing code") — `alt.js` and its
validation scripts were deleted since nothing was wired into a live route. Real results before
deletion (kept below for reference): correctness proven exact on 2 pairs, a genuine 6.3x search
speedup on the long-distance pair (531ms vs 3347ms), but a real 69s precompute cost per cost
objective. All recoverable from git history if this is picked back up.

## Objective

Try a cheaper alternative to Stage B's Contraction Hierarchies for speeding up long-distance
routes on the in-memory graph (`data-types/routing/memoryGraph.js`, Phase 11 Stage A - see
`point-to-point-routing-plugin.md`). This is explicitly **an experiment to try and check, not a
committed build** - the user wants to see real numbers before deciding whether to pursue it
further or scrap it, same discipline as everything else in this project.

## Why this instead of (or before) more CH work

Stage B's first Contraction Hierarchies attempt was tried and stopped
(`point-to-point-routing-plugin.md`, Phase 11 Stage B): it produced wrong route costs on a small
validation slice, and its shortcut count (146,728 shortcuts for just 29,022 contracted states -
roughly 5x) suggests a full-network build could multiply the graph's memory footprint several
times over, with build time also unmeasured at scale (infeasible with the prototype's queue,
unknown for a properly engineered version).

ALT avoids both of those specific risks:
- **No graph mutation, no shortcuts** - the existing edge/adjacency arrays stay exactly as they
  are. No shortcut-explosion memory risk.
- **Precompute cost is a small, known multiple of something already measured**: N full-graph
  Dijkstra runs (N = landmark count, e.g. ~20-50), and a single full-graph search is already
  measured at ~7s (the long-distance test pair, plain Dijkstra). That gives a real, boundable
  precompute estimate (order of minutes, not the unknown-and-possibly-days situation Stage B hit) -
  but this still needs to be measured for real, not just estimated from that one number, before
  treating it as fact.
- **Still exact** - it's a stronger admissible heuristic for the existing exact Dijkstra/A* search,
  not an approximation. No risk of a wrong-but-plausible route, the class of bug Stage A's
  bidirectional search and Stage B's CH prototype both actually hit.

## How it works (for reference)

1. Pick a small set of landmark nodes, spread across the network (naive: random selection;
   better: pick nodes that are geographically extreme/far apart, e.g. via a few iterations of
   "furthest node from current landmark set").
2. For each landmark L, run one plain edge-expansion Dijkstra from L to every other node/edge-state,
   recording the distance. This is the entire precompute step - N full-graph searches.
3. At query time, use the precomputed landmark distances as an A* heuristic: for a candidate state
   and the true destination, `|dist(L, state) - dist(L, dest)|` (over the landmark giving the
   tightest bound) is a valid lower bound on remaining distance (triangle inequality), which lets
   A* prune search in the wrong direction - similar effect to bidirectional search, generally
   stronger.

## Scope

**In scope for this exploration:**
- Landmark selection strategy (start naive/random, since correctness doesn't depend on landmark
  choice - it only affects HOW MUCH pruning benefit you get, not whether the answer is right).
- Precompute step: N full-graph Dijkstra runs from the chosen landmarks, real timing measured (not
  estimated) - both for distance and time cost objectives (may need separate landmark distance
  tables per objective, to be confirmed).
- A*-with-landmark-heuristic query implementation, as a new opt-in `algorithm` value (e.g.
  `"alt"`) alongside the existing `"dijkstra"`/`"bidirectional"` options on `/trsp-memory` - same
  additive pattern as before, default stays unchanged.
- Real correctness verification against the same known-good OD pairs used throughout this project
  (the standard 4-pair set, especially the long-distance one with no SQL baseline).
- Real timing measurement: precompute cost, per-query search time, and memory added by the
  landmark distance table - all measured, not assumed, per this project's standing discipline.

**Not in scope / explicitly deferred:**
- Sophisticated landmark-selection algorithms (e.g. proper farthest-point sampling, avoid-based
  selection) - only worth optimizing once the naive version's real numbers say it's worth pursuing
  further.
- Any decision to replace or retire the CH exploration - this is a parallel cheaper experiment,
  not a declared winner yet.

## Current State

Not started. No code written. Numbers discussed with the user so far (25 landmarks × ~7s per
landmark ≈ a couple minutes precompute, ~500MB for a 25 × 5.2M-node distance table) are back-of-
envelope estimates derived from Stage A's own measured numbers, not yet verified by actually
running this.

## Proposed Changes

TBD in detail - anticipated shape:
- New function(s) in `memoryGraph.js` (or a new sibling file, mirroring `ch.js`'s separation):
  landmark selection, per-landmark Dijkstra precompute, landmark-distance storage, and an
  A*-with-landmark-heuristic search function.
- Small-scale validation first (same discipline as Stage B: prove correctness and get a real
  per-landmark timing number on a bounded test before running the full 9.6M-edge precompute).

## Testing Checklist

- [ ] Small-scale validation: landmark precompute + ALT query on a bounded test region, correctness
  checked against known-good plain-Dijkstra costs for the same pairs.
- [ ] Real full-network precompute timing (not the ~couple-minutes estimate - the actual number).
- [ ] Real memory measurement for the landmark distance table at full scale.
- [ ] Per-query search time on the standard 4-pair set, especially the long-distance pair, compared
  against both plain Dijkstra (~7s) and bidirectional (~5.9s) for the same pair.
- [ ] Decision point: keep exploring, ship as opt-in, or drop - based on the real numbers above.
