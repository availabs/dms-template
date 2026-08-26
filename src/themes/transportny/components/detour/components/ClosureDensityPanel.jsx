import React from "react";
import { ThemeContext } from "../../../../../dms/packages/dms/src/ui/useTheme";
import { DENSITY_COLOR_RAMP, DENSITY_NUM_CANDIDATES, computeDensityStops } from "../constants";
import { RouteComparisonBarChart } from "./RouteComparisonBarChart";

// Closure coverage / density analysis panel - the density-mode sibling of DetourDetailsPanel.
// Same segment-picking flow (shared with single-trip mode), different action button and result
// summary: "how many of this closure's plausible trips get absorbed by which surrounding roads,"
// not one trip's detour.
const ClosureDensityPanel = ({
  selectedSegment,
  canAnalyze,
  loading,
  phase,
  error,
  resolveError,
  density,
  onAnalyze,
  onReset,
  pickPairTesting,
  pickedStart,
  pickedEnd,
  pickedRoute,
  pickedRouteLoading,
  pickedRouteError,
  onClearPickedPair,
}) => {
  const { UI } = React.useContext(ThemeContext) || {};
  const { Button } = UI || {};

  const hasResult = Boolean(density) || Boolean(error);
  const totalPairs = DENSITY_NUM_CANDIDATES * DENSITY_NUM_CANDIDATES;

  // Route comparison (2026-08-24, planning/transportny/tasks/current/
  // closure-density-route-comparison-tab.md) - heatmap legend + both bar graphs all visible at
  // once now (2026-08-25 - "keep all visible on window, no tabs for that"), not tab-switched. The
  // comparison charts live in their own panel, stacked above the main results panel below (both
  // bottom-left) so the results panel doesn't get overcrowded - see the second panel below.
  const hasComparisons = Boolean(density?.pairComparisons?.length);

  return (
    // Both panels stacked in ONE bottom-left region (2026-08-26 - "just above the closure
    // coverage density so both will manage... both need to be working accordingly not overlap"):
    // scattering panels across all 4 corners kept colliding with something else already claimed
    // there (Legend at top-right, the plugin control panel at top-left, native map controls at
    // bottom-right) - staying in the one region nothing else uses sidesteps every collision.
    // `flex-col-reverse` puts the FIRST child (density results) at the bottom and stacks later
    // children (the comparison panel) above it, so the visual order matches "comparison above
    // density" without hardcoded offsets. No internal scroll/height cap on either panel
    // (2026-08-26 - "no scroll also full stretch") - each just stretches to fit its own content;
    // gap-3 on the wrapper keeps them visually separated as they grow.
    <div className="absolute bottom-4 left-4 right-4 sm:right-auto z-10 flex flex-col-reverse gap-3 pointer-events-none">
    <div className="w-auto sm:w-80 bg-white/95 border rounded-md shadow-md p-3 text-sm pointer-events-auto">
      <div className="font-bold mb-1">Closure coverage / density</div>

      {!selectedSegment && !loading && (
        <div className="text-gray-600 mb-2">
          Click a road segment on the map to see which surrounding roads absorb the most rerouted
          traffic if it were closed.
        </div>
      )}

      {selectedSegment && !hasResult && !resolveError && (
        <div className="mb-2 text-xs bg-red-50 border border-red-200 rounded px-2 py-1.5">
          <span className="text-red-700">
            Segment {selectedSegment.ogcFid} selected. {canAnalyze ? "Click \"Analyze coverage\" below." : "Finding nearby candidate points…"}
          </span>
        </div>
      )}

      {selectedSegment && resolveError && (
        <div className="mb-2 text-xs bg-red-50 border border-red-200 rounded px-2 py-1.5">
          <span className="text-red-700">{resolveError}</span>
        </div>
      )}

      {/* Two-phase status (2026-08-21: "let route mapping in process" - points can already be
          visible on the map here while the route tally is still running, so the message should
          say which step is actually happening, not one generic "Analyzing" for both). */}
      {loading && phase === "points" && (
        <div className="text-gray-600 mb-2">Finding candidate points near this segment…</div>
      )}
      {loading && phase === "routes" && (
        <div className="text-gray-600 mb-2">
          Points found - computing routes across up to {totalPairs} candidate pairs…
        </div>
      )}

      {error && (
        <div className="text-red-600 mb-2">Could not analyze this closure: {error}</div>
      )}

      {density && !loading && !error && (
        <>
          <div className="text-xs text-gray-600 mb-2">
            Analyzed {density.totalPairsComputed} of {totalPairs} possible routes
            {density.totalPairsFailed > 0 && ` (${density.totalPairsFailed} had no route)`}.
          </div>

          <div className="mb-2">
            <div className="text-gray-500 text-xs uppercase tracking-wide mb-1">
              Times a road segment is used (0 – {density.maxCount})
            </div>
            <div className="flex h-3 rounded overflow-hidden">
              {DENSITY_COLOR_RAMP.map((hex, i) => (
                <div key={hex} className="flex-1" style={{ background: hex }} />
              ))}
            </div>
            {/* Numeric range under each swatch, computed from the SAME computeDensityStops the
                map layer's own `step` paint expression uses (constants.js, 2026-08-24 - fixes a
                real bug where a low maxCount produced duplicate/non-increasing stops), so the
                legend never drifts out of sync with what's actually drawn (2026-08-21: "show
                numbers in left bottom range of color" - replaces plain "fewer"/"more" labels). */}
            <div className="flex text-[10px] text-gray-500 mt-0.5 font-mono">
              {[0, ...computeDensityStops(density.maxCount)].map((lo, i, stops) => {
                const hi = i < stops.length - 1 ? stops[i + 1] - 1 : density.maxCount;
                return (
                  <span key={lo} className="flex-1 text-center">
                    {lo}{hi > lo ? `-${hi}` : ""}
                  </span>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Testing-only pair picker (2026-08-21) - pick any start + any end candidate point,
          highlight the route between them, spot-check an individual OD pair rather than only
          seeing the aggregated heatmap. Only shown once there ARE candidate points to click. */}
      {pickPairTesting && density?.startPoints?.length > 0 && (
        <div className="mb-2 text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1.5">
          <div className="font-semibold text-slate-700 mb-1">Pick a pair (beta)</div>
          {!pickedStart && !pickedEnd && <div className="text-slate-500">Click a green (start) or red (end) point.</div>}
          {(pickedStart || pickedEnd) && (
            <div className="text-slate-600">
              Start: {pickedStart ? "picked" : "not picked"} · End: {pickedEnd ? "picked" : "not picked"}
            </div>
          )}
          {pickedRouteLoading && <div className="text-slate-500 mt-0.5">Computing route…</div>}
          {pickedRouteError && <div className="text-red-600 mt-0.5">{pickedRouteError}</div>}
          {pickedRoute?.shortest && (
            <div className="text-slate-600 mt-0.5 font-mono">
              {pickedRoute.shortest.feature.properties.length.toFixed(1)} mi · {pickedRoute.shortest.feature.properties.edge_count} edges
            </div>
          )}
          {(pickedStart || pickedEnd) && (
            <button type="button" className="text-slate-500 underline mt-1" onClick={onClearPickedPair}>
              Clear picked pair
            </button>
          )}
        </div>
      )}

      {Button && canAnalyze && !loading && (
        <Button className="mt-1 w-full" onClick={onAnalyze}>
          Analyze coverage
        </Button>
      )}

      {Button && (selectedSegment || hasResult) && (
        <Button className="mt-2 w-full" onClick={onReset}>
          {hasResult ? "Clear analysis" : "Clear selection"}
        </Button>
      )}
    </div>

    {/* Route comparison - stacked ABOVE the density results panel via flex-col-reverse (see the
        wrapper's comment above), same bottom-left region, no separate corner. Same card treatment
        (bg-white/95, border, shadow) so the two still read as a matched pair, distance/time each
        always visible, no tab click needed. */}
    {hasComparisons && !loading && !error && (
      <div className="w-auto sm:w-80 bg-white/95 border rounded-md shadow-md p-3 text-sm pointer-events-auto">
        <div className="font-bold mb-3">Detour cost distribution</div>
        <div className="text-slate-700 text-xs font-semibold mb-1.5">Distance</div>
        <RouteComparisonBarChart pairComparisons={density.pairComparisons} metric="distance" />
        <div className="text-slate-700 text-xs font-semibold mt-4 mb-1.5 pt-3 border-t border-gray-200">Time</div>
        <RouteComparisonBarChart pairComparisons={density.pairComparisons} metric="time" />
      </div>
    )}
    </div>
  );
};

export { ClosureDensityPanel };
