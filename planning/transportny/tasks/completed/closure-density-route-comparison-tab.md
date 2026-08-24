# Closure-density route comparison tab (open vs. closed detour deltas)

**Project:** TransportNY · **Topic:** themes · **Status:** DONE - verified live · **Started:** 2026-08-24 · **Completed:** 2026-08-24

## Outcome

- **Backend**: `computeClosureDensityFromPoints` now dispatches BOTH the open (baseline) and
  closed (detour) route per pair to the worker_threads pool in one combined batch (extended
  `graphSearchWorker.js`'s `tallyBatch` message with a `mode: 'open'|'closed'` field, and
  `densitySearchPool.js`'s `runTallyBatch` to pass it through). Returns `pairComparisons` - per pair
  `{ startOsmId, endOsmId, openMiles, openDurationS, closedMiles, closedDurationS, deltaMiles,
  deltaDurationS }`, sorted smallest-to-largest `deltaMiles`. Verified live: 100/100 pairs with real
  deltas in ~5.5s (computing open+closed doubled the search count vs. the heatmap-only tally, but
  the pool absorbed it).
- **Frontend**: new `RouteComparisonBarChart.jsx` - binned into 5 equal-width buckets (not one bar
  per pair - "make range of 5 so that user understand from those data"), reused via a `metric` prop
  for two separate tabs: **Distance cost** (miles) and **Time cost** (minutes) - "this detour cost
  is in distance cost, what about time cost, add new tab." Wired into `ClosureDensityPanel.jsx`
  behind a 3-way tab toggle (Heatmap / Distance cost / Time cost) that only appears once
  `pairComparisons` has arrived. Plain divs, matching the panel's existing lightweight style - no
  chart library dependency added.

Along the way, also fixed two unrelated live-tested bugs surfaced while verifying this feature:
- The "Pick point pair" testing route stayed visible on the map after its toggle was switched off
  (`comp.jsx`'s `useRouteLayer` call wasn't gated on `pickerActive`, only on density mode).
- In simple (non-density) detour mode, when only ONE direction had a route, it rendered SOLID
  (primary) instead of DASHED (secondary) - `comp.jsx`'s `primaryFeature`/`secondaryFeatures` used
  to "promote" whichever direction existed to primary styling; now `AtoB` is always solid, `BtoA`
  is always dashed, regardless of which direction(s) actually resolved.
- Simple detour mode's start/end point derivation (`findSameRoadNode.js`/`comp.jsx`'s
  `resolveEndpointNode`) walked only ONE hop along the same road from the closed segment's own
  endpoint - on an interchange/ramp complex this could land right in the most tangled part of the
  network, producing nonsensical huge-loop routes. Now walks multiple hops (up to 15) until it's
  traveled at least 200m of real distance, falling back to the farthest point reached if it
  dead-ends first.
- Renamed the "(testing)" labels in the UI to "(beta)".

## Objective

For the closure coverage/density analysis (the `detour` plugin's density mode), add a new tab to
the results panel that compares, for every start/end pair used in the analysis, the OPEN route
(before the segment closes) against the CLOSED/detour route (after it closes) - specifically the
difference in **distance (miles)** and **difference in time**. Shown as a bar graph across all
pairs, not just a single-pair number, so the user can see the overall detour cost distribution
this closure imposes, not just which roads absorb traffic (which the existing heatmap already
shows).

User's framing: "add a task where we are comparing all of the stuff where for all of those route
we calculate the things of difference in miles and difference in time, so there will be tab and
will show the bar graph also of those informations."

## Context

- The density analysis already computes, for each selected start/end pair, a CLOSED-network route
  via `computeClosureDensityFromPoints` (`data-types/routing/memoryGraph.js`) - this is step 2,
  `/trsp-memory-density`. It currently only tallies per-edge usage frequency for the heatmap; it
  does not currently retain each individual pair's own route length/duration, or compare it
  against that pair's OPEN route.
- The OPEN route per pair isn't computed anywhere in step 2 today - point selection
  (`selectClosureDensityCandidates`) computes open routes only during VALIDATION (to check if a
  candidate's open route uses the closed segment), and doesn't keep the open route's own
  length/duration either.
- Both computations already run through the worker_threads pool
  (`data-types/routing/densitySearchPool.js`, `graphSearchWorker.js` -
  see [closure-density-performance.md](./closure-density-performance.md)) - extending the tally
  batch to also return the OPEN route's length/duration per pair (not just the closed one) is a
  natural extension of that same infrastructure, not a new search mechanism.
- Frontend: `src/themes/transportny/components/detour/components/ClosureDensityPanel.jsx` is the
  existing results panel (legend, candidate points, etc.) - the new tab would live alongside it.

## Proposed approach (not yet designed in detail)

1. **Backend**: extend `computeClosureDensityFromPoints` (or a sibling function) to, for each
   start/end pair, compute BOTH the open route and the closed route (worker pool batch, same
   pattern as today) and return per-pair `{ openMiles, openDurationS, closedMiles,
   closedDurationS, deltaMiles, deltaDurationS }` alongside the existing heatmap tally - needs a
   decision on whether this is a new response field on the existing `/trsp-memory-density` route or
   a separate endpoint (the existing route already does up to numStart*numEnd closed searches;
   adding an equal number of open searches roughly doubles that step's work, worth flagging back to
   the user given the whole reason this got parallelized was response time).
2. **Frontend**: new tab in `ClosureDensityPanel.jsx` (or a new sibling component) rendering a bar
   graph of per-pair distance delta and time delta - needs a decision on chart library/approach
   consistent with the rest of the codebase (see the `dataviz` skill's guidance on chart form,
   color, and interaction if this becomes a real chart component, not a one-off).
3. Open questions to resolve before implementation: bar-per-pair vs. a distribution/histogram view
   given there could be up to numStart*numEnd (e.g. 100) pairs; whether "difference" is shown as
   absolute (miles/minutes) or percentage; whether this needs its own loading state given the
   doubled search cost noted above.

## Testing checklist

- [ ] Backend returns correct per-pair open vs. closed deltas for a known test closure (spot-check
      a couple of pairs against manually-computed shortest-path miles/time).
- [ ] Bar graph renders correctly for both small (few pairs) and large (numStart*numEnd) result
      sets - no label collision, reasonable bar width, per `dataviz` skill guidance.
- [ ] Tab switches without re-running the analysis (reuses already-fetched data, doesn't refetch).
- [ ] Response-time impact of computing open routes alongside closed ones is measured and
      acceptable (see approach note above - this roughly doubles step 2's search count).
