import React from "react";
import { ThemeContext, getComponentTheme } from "../../../../../dms/packages/dms/src/ui/useTheme";
import { DENSITY_COLOR_RAMP, DENSITY_NUM_CANDIDATES, computeDensityStops } from "../constants";
import { RouteComparisonBarChart } from "./RouteComparisonBarChart";
import { closureDensityPanelTheme } from "./ClosureDensityPanel.theme";

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
  const { UI, theme: themeFromContext = {} } = React.useContext(ThemeContext) || {};
  const { Button } = UI || {};
  const t = { ...closureDensityPanelTheme, ...getComponentTheme(themeFromContext, "closureDensityPanel") };

  const hasResult = Boolean(density) || Boolean(error);
  const totalPairs = DENSITY_NUM_CANDIDATES * DENSITY_NUM_CANDIDATES;

  // Route comparison (planning/transportny/tasks/current/
  // closure-density-route-comparison-tab.md) - heatmap legend + both bar graphs all visible at
  // once, not tab-switched. The comparison charts live in their own panel, stacked above the main
  // results panel below (both bottom-left) so the results panel doesn't get overcrowded - see the
  // second panel below.
  const hasComparisons = Boolean(density?.pairComparisons?.length);

  return (
    // Both panels stacked in ONE bottom-left region: scattering panels across all 4 corners kept
    // colliding with something else already claimed there (Legend at top-right, the plugin
    // control panel at top-left, native map controls at bottom-right) - staying in the one region
    // nothing else uses sidesteps every collision. `flex-col-reverse` puts the FIRST child
    // (density results) at the bottom and stacks later children (the comparison panel) above it,
    // so the visual order matches "comparison above density" without hardcoded offsets. No
    // internal scroll/height cap on either panel - each just stretches to fit its own content;
    // gap-3 on the wrapper keeps them visually separated as they grow.
    <div className={t.wrapper}>
    <div className={t.panel}>
      <div className={t.title}>Closure coverage / density</div>

      {!selectedSegment && !loading && (
        <div className={t.instructionText}>
          Click a road segment on the map to see which surrounding roads absorb the most rerouted
          traffic if it were closed.
        </div>
      )}

      {selectedSegment && !hasResult && !resolveError && (
        <div className={t.selectedBanner}>
          <span className={t.selectedBannerText}>
            Segment {selectedSegment.ogcFid} selected. {canAnalyze ? "Click \"Analyze coverage\" below." : "Finding nearby candidate points…"}
          </span>
        </div>
      )}

      {selectedSegment && resolveError && (
        <div className={t.selectedBanner}>
          <span className={t.selectedBannerText}>{resolveError}</span>
        </div>
      )}

      {/* Two-phase status - points can already be visible on the map here while the route tally
          is still running, so the message should say which step is actually happening, not one
          generic "Analyzing" for both. */}
      {loading && phase === "points" && (
        <div className={t.statusText}>Finding candidate points near this segment…</div>
      )}
      {loading && phase === "routes" && (
        <div className={t.statusText}>
          Points found - computing routes across up to {totalPairs} candidate pairs…
        </div>
      )}

      {error && (
        <div className={t.errorText}>Could not analyze this closure: {error}</div>
      )}

      {density && !loading && !error && (
        <>
          <div className={t.summaryText}>
            Analyzed {density.totalPairsComputed} of {totalPairs} possible routes
            {density.totalPairsFailed > 0 && ` (${density.totalPairsFailed} had no route)`}.
          </div>

          <div className={t.legendWrapper}>
            <div className={t.legendHeader}>
              Times a road segment is used (0 – {density.maxCount})
            </div>
            <div className={t.legendSwatches}>
              {DENSITY_COLOR_RAMP.map((hex) => (
                <div key={hex} className={t.legendSwatch} style={{ background: hex }} />
              ))}
            </div>
            {/* Numeric range under each swatch, computed from the SAME computeDensityStops the
                map layer's own `step` paint expression uses (constants.js - fixes a real bug
                where a low maxCount produced duplicate/non-increasing stops), so the legend never
                drifts out of sync with what's actually drawn. */}
            <div className={t.legendRangeRow}>
              {[0, ...computeDensityStops(density.maxCount)].map((lo, i, stops) => {
                const hi = i < stops.length - 1 ? stops[i + 1] - 1 : density.maxCount;
                return (
                  <span key={lo} className={t.legendRangeLabel}>
                    {lo}{hi > lo ? `-${hi}` : ""}
                  </span>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Testing-only pair picker - pick any start + any end candidate point, highlight the
          route between them, spot-check an individual OD pair rather than only seeing the
          aggregated heatmap. Only shown once there ARE candidate points to click. */}
      {pickPairTesting && density?.startPoints?.length > 0 && (
        <div className={t.pairPickerBox}>
          <div className={t.pairPickerTitle}>Pick a pair</div>
          {!pickedStart && !pickedEnd && <div className={t.pairPickerHint}>Click a green (start) or red (end) point.</div>}
          {(pickedStart || pickedEnd) && (
            <div className={t.pairPickerStatus}>
              Start: {pickedStart ? "picked" : "not picked"} · End: {pickedEnd ? "picked" : "not picked"}
            </div>
          )}
          {pickedRouteLoading && <div className={t.pairPickerLoading}>Computing route…</div>}
          {pickedRouteError && <div className={t.pairPickerError}>{pickedRouteError}</div>}
          {pickedRoute?.shortest && (
            <div className={t.pairPickerResult}>
              {pickedRoute.shortest.feature.properties.length.toFixed(1)} mi · {pickedRoute.shortest.feature.properties.edge_count} edges
            </div>
          )}
          {(pickedStart || pickedEnd) && (
            <button type="button" className={t.pairPickerClearButton} onClick={onClearPickedPair}>
              Clear picked pair
            </button>
          )}
        </div>
      )}

      {Button && canAnalyze && !loading && (
        <Button className={t.analyzeButton} onClick={onAnalyze}>
          Analyze coverage
        </Button>
      )}

      {Button && (selectedSegment || hasResult) && (
        <Button className={t.clearButton} onClick={onReset}>
          {hasResult ? "Clear analysis" : "Clear selection"}
        </Button>
      )}
    </div>

    {/* Route comparison - stacked ABOVE the density results panel via flex-col-reverse (see the
        wrapper's comment above), same bottom-left region, no separate corner. Same card treatment
        (bg-white/95, border, shadow) so the two still read as a matched pair, distance/time each
        always visible, no tab click needed. */}
    {hasComparisons && !loading && !error && (
      <div className={t.panel}>
        <div className={t.comparisonTitle}>Detour cost distribution</div>
        <div className={t.comparisonMetricLabel}>Distance</div>
        <RouteComparisonBarChart pairComparisons={density.pairComparisons} metric="distance" />
        <div className={t.comparisonMetricLabelSecond}>Time</div>
        <RouteComparisonBarChart pairComparisons={density.pairComparisons} metric="time" />
      </div>
    )}
    </div>
  );
};

export { ClosureDensityPanel };
