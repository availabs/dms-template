# Detour / avoid-segment routing plugin

**Project:** TransportNY · **Topic:** themes · **Status:** NOT STARTED · **Started:** 2026-08-19

## Objective

A new map plugin, carrying forward from the point-to-point routing plugin
(`planning/transportny/tasks/current/point-to-point-routing-plugin.md`), that lets a user pick a
specific road segment shown on the conflation map and get a route between their existing
source/destination that is forced to **detour around** that segment — i.e. compute the route with
that segment excluded from the graph entirely, not just deprioritized.

Confirmed with the user (2026-08-19): the flow is:
1. User has already picked a source and destination (same as the existing point-to-point plugin).
2. User clicks a road segment on the map (the conflation data already rendered there).
3. That segment highlights, and its start/end nodes are shown.
4. The plugin computes a new route between the same source/destination, constrained to not use
   that segment - a detour.

## Scope

**In scope:**
- Map interaction to select a single segment (edge) from the rendered conflation layer and
  highlight it + its endpoints.
- A routing query that excludes the selected segment (edge) from the search entirely.
- Displaying the detour route, presumably alongside or in place of the original route.

**Not yet decided / to scope before implementation:**
- Which backend this hits - the existing SQL `/trsp` route, the in-memory `/trsp-memory` route
  (Stage A, see the point-to-point task file's Phase 11), or a new route. Excluding a single edge
  from the SQL path likely means adding it as a banned node/edge in the `pgr_trsp` restrictions
  temp table for that one request; excluding it from the in-memory path means a per-request
  "skip this edge index" check in the search loop (cheap - the in-memory graph doesn't require
  reloading, unlike a shared restriction Set that's currently load-time/permanent).
- Whether "exclude a segment" should exclude just the one directional edge the user clicked, or
  both directions of that road (if it's represented as two edges).
- What happens if excluding the segment makes the destination unreachable - explicit "no route"
  UI state, not a silent failure.
- Whether this reuses `RouteDetailsPanel.jsx`/the existing route-line layers, or needs its own.

## Current State

Not started. No code written. This file exists to track the idea per the user's explicit request
("create new task for this") so it isn't lost - implementation has not begun and no approach has
been chosen yet.

## Proposed Changes

TBD - write the real plan (map interaction design, backend approach, UI for showing the excluded
segment vs. the resulting detour) before starting implementation, per this project's planning
rules (write the plan into this file, then get explicit go-ahead).

## Files Requiring Changes

TBD - likely additions to `src/themes/transportny/components/routing/` (new hooks for segment
selection + highlight) and either `data-types/routing/index.js`/`memoryGraph.js` (if reusing Stage
A) or a new backend route.

## Testing Checklist

TBD - at minimum: selecting a segment on a real route, confirming the detour genuinely avoids that
segment (not just deprioritizes it), and confirming the "no route possible" case is handled
visibly rather than silently.
