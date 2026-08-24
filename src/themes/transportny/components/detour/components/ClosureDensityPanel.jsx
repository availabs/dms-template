import React from "react";
import { ThemeContext } from "../../../../../dms/packages/dms/src/ui/useTheme";
import { DENSITY_COLOR_RAMP, DENSITY_NUM_CANDIDATES, DENSITY_STEP_FRACTIONS } from "../constants";
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

  // Route comparison tab (2026-08-24, planning/transportny/tasks/current/
  // closure-density-route-comparison-tab.md) - "heatmap" (the original view) vs. "comparison" (new
  // bar graph of per-pair open-vs-closed miles/time deltas). Only shown once pairComparisons has
  // actually arrived (step 2 done), same gating as the heatmap legend above it.
  const [resultTab, setResultTab] = React.useState("heatmap");
  const hasComparisons = Boolean(density?.pairComparisons?.length);

  return (
    <div className="absolute bottom-4 left-4 right-4 sm:right-auto z-10 w-auto sm:w-80 max-h-[calc(100vh-2rem)] overflow-y-auto bg-white/95 border rounded-md shadow-md p-3 text-sm pointer-events-auto">
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

          {hasComparisons && (
            <div className="flex text-xs border-b mb-2">
              {[
                ["heatmap", "Heatmap"],
                ["distance", "Distance cost"],
                ["time", "Time cost"],
              ].map(([key, tabLabel]) => (
                <button
                  key={key}
                  type="button"
                  className={`px-2 py-1 -mb-px border-b-2 ${resultTab === key ? "border-blue-600 text-blue-700 font-semibold" : "border-transparent text-gray-500"}`}
                  onClick={() => setResultTab(key)}
                >
                  {tabLabel}
                </button>
              ))}
            </div>
          )}

          {resultTab === "heatmap" && (
            <div className="mb-2">
              <div className="text-gray-500 text-xs uppercase tracking-wide mb-1">
                Times a road segment is used (0 – {density.maxCount})
              </div>
              <div className="flex h-3 rounded overflow-hidden">
                {DENSITY_COLOR_RAMP.map((hex, i) => (
                  <div key={hex} className="flex-1" style={{ background: hex }} />
                ))}
              </div>
              {/* Numeric range under each swatch, computed from the SAME DENSITY_STEP_FRACTIONS the
                  map layer's own `step` paint expression uses, so the legend never drifts out of
                  sync with what's actually drawn (2026-08-21: "show numbers in left bottom range of
                  color" - replaces the earlier plain "fewer"/"more" labels). */}
              <div className="flex text-[10px] text-gray-500 mt-0.5 font-mono">
                {DENSITY_STEP_FRACTIONS.map((frac, i) => {
                  const lo = Math.round(density.maxCount * frac);
                  const hi = i < DENSITY_STEP_FRACTIONS.length - 1
                    ? Math.max(lo, Math.round(density.maxCount * DENSITY_STEP_FRACTIONS[i + 1]) - 1)
                    : density.maxCount;
                  return (
                    <span key={frac} className="flex-1 text-center">
                      {lo}{hi > lo ? `-${hi}` : ""}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {resultTab === "distance" && hasComparisons && (
            <div className="mb-2">
              <RouteComparisonBarChart pairComparisons={density.pairComparisons} metric="distance" />
            </div>
          )}

          {resultTab === "time" && hasComparisons && (
            <div className="mb-2">
              <RouteComparisonBarChart pairComparisons={density.pairComparisons} metric="time" />
            </div>
          )}
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
  );
};

export { ClosureDensityPanel };
