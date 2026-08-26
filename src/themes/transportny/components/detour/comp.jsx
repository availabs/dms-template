import React from "react";
import { get } from "lodash-es";
import { MapEditorContext } from "../../../../dms/packages/dms/src/patterns/mapeditor/context";
import { CMSContext } from "../../../../dms/packages/dms/src";

import { useTrspRoute } from "./hooks/useTrspRoute";
import { useRouteLayer } from "./hooks/useRouteLayer";
import { useEdgeLayer } from "./hooks/useEdgeLayer";
import { useStartEndMarkers } from "./hooks/useStartEndMarkers";
import { useClosureDensity } from "./hooks/useClosureDensity";
import { useClosureDensityLayer } from "./hooks/useClosureDensityLayer";
import { useDensityCandidatesLayer } from "./hooks/useDensityCandidatesLayer";
import { useDensityPointPicker } from "./hooks/useDensityPointPicker";
import { usePickedPairRoute } from "./hooks/usePickedPairRoute";
import { resolveDetourEndpoints } from "./hooks/resolveDetourEndpoints";
import { DEFAULT_CONFLATION_VIEW_ID } from "./constants";
import { DetourDetailsPanel } from "./components/DetourDetailsPanel";
import { ClosureDensityPanel } from "./components/ClosureDensityPanel";

// Simple detour mode's endpoint picker (2026-08-25 perf) - moved server-side entirely
// (resolveDetourEndpoints.js -> POST .../trsp-memory-detour-endpoints ->
// memoryGraph.js's walkToFirstBranch). The old client-side walk made one HTTP request PER HOP
// (resolveEdgesInBbox), which on a highway with short edges over a multi-mile budget could mean
// hundreds of sequential network round trips just to pick the start/end points, before "Get
// detour" even ran the real route search. Same walk-to-first-branch rule either way (pure
// topology - a node with more than one viable next edge is a real branch, take exactly one more
// hop past it and stop that direction), just one fast in-memory call now instead of many.
const resolveVerifiedEndpoints = async (segment, conflationViewId, pgEnv) => {
  const result = await resolveDetourEndpoints(segment.ogcFid, conflationViewId, pgEnv);
  if (!result?.start || !result?.end) return null; // genuinely isolated end, no candidate at all
  return { start: result.start, end: result.end };
};

// Detour/avoid-segment plugin - answers "what happens to any trip through this segment if it's
// closed," not "a route for one traveler" (see planning/transportny/tasks/current/
// detour-avoid-segment-routing-plugin.md's "Flow correction"). No manual point-picking: the user
// clicks ONE segment, start/end are derived automatically as the nearest OTHER node to each of
// that segment's own endpoints, then an explicit "Get detour" press computes the route. Once
// shown, the pickable network hides so only the clean result remains - "Clear detour" resumes
// picking (2026-08-19 follow-up).
const Comp = ({ state, setState, map }) => {
  const mctx = React.useContext(MapEditorContext);
  const cctx = React.useContext(CMSContext);
  const ctx = mctx?.falcor ? mctx : cctx;
  const { pgEnv } = ctx || {};

  // Closure coverage / density analysis mode (2026-08-20) - a second "view" within this same
  // plugin, toggled from the Legend panel's "Closure density mode" switch (internalPanel.jsx),
  // shared with the "Display default legend" toggle via the same plugin-data store. Segment
  // picking (useEdgeLayer below) is reused as-is in both modes - only what happens after selection
  // differs.
  //
  // pluginDataPath branches on `state.symbologies` vs `state.symbology` (2026-08-25 fix, same
  // pattern as macroview/comp.jsx and macroview.plugin.jsx's mapRegister) - a hardcoded
  // `symbology.pluginData.detour` path only resolves inside the mapeditor test harness, where
  // `state.symbology` sits at the top level. A regular DMS page's Map section nests it instead
  // under `state.symbologies['<symbName>'].symbology.pluginData.detour`, so without this branch
  // every toggle here silently read/wrote nothing there and the plugin appeared inert.
  const pluginDataPath = state.symbologies
    ? `symbologies['${Object.keys(state.symbologies)[0]}'].symbology.pluginData.detour`
    : "symbology.pluginData.detour";
  const isDensityMode = Boolean(get(state, `${pluginDataPath}['density-mode']`, false));
  // "Show candidate points" Legend-panel toggle (2026-08-21) - independent of density mode itself.
  const showCandidatePoints = Boolean(get(state, `${pluginDataPath}['show-candidates']`, false));
  // Testing-only pair picker toggle - only takes effect when density mode + show-candidates are
  // ALSO on, per the user's own framing ("it is depended on the point switch it must be on").
  const pickPairTesting = Boolean(get(state, `${pluginDataPath}['pick-pair-testing']`, false));

  const {
    routes, baselineRoutes, selectedVariant, setSelectedVariant,
    loading, error, getRoute, reset: resetRoute,
  } = useTrspRoute(DEFAULT_CONFLATION_VIEW_ID, pgEnv);

  const {
    density, loading: densityLoading, phase: densityPhase, error: densityError, analyze, reset: resetDensity,
  } = useClosureDensity(DEFAULT_CONFLATION_VIEW_ID, pgEnv);

  const hasResult = isDensityMode
    ? Boolean(density) || Boolean(densityError)
    : Boolean(routes) || Boolean(error);
  // Once a result (or a failed attempt) is showing, the pickable network hides and further
  // segment clicks are ignored until "Clear detour"/"Clear analysis" - see useEdgeLayer's isActive
  // contract.
  const { selectedSegment, clearSegment } = useEdgeLayer(map, DEFAULT_CONFLATION_VIEW_ID, pgEnv, !hasResult);

  const [startEnd, setStartEnd] = React.useState(null); // { start: {lon,lat}, end: {lon,lat} } | null
  const [resolving, setResolving] = React.useState(false);
  // Fault tolerance: distinct from "still resolving" - covers (a) resolution finished but found
  // truly nothing at one/both endpoints (a fully isolated node - even the plain-nearest-node
  // fallback found no other node nearby), and (b) a network/backend error during resolution
  // (previously only console.error'd, leaving the panel stuck on "Finding..." forever with no
  // visible sign anything went wrong - 2026-08-20 fault-tolerance pass).
  const [resolveError, setResolveError] = React.useState(null);

  // Both travel directions render simultaneously, always (2026-08-20 - replaces the earlier
  // direction-toggle and "show all routes" ideas): AtoB is ALWAYS primary (bold/solid), BtoA is
  // ALWAYS secondary (dimmed/dashed) - a direction's line style is fixed, not reassigned based on
  // which direction(s) happen to have a route. Only the SELECTED cost objective (shortest/fastest)
  // shows for each direction, not all 4 at once - keeps the map readable while still surfacing the
  // directional asymmetry this feature exists to show.
  //
  // Fixed 2026-08-24 ("the route possible is end to start but still hard yellow is there, it has
  // to be dotted"): the old version PROMOTED BtoA to solid/primary styling whenever AtoB had no
  // route, so the only available route rendered bold even though DetourDetailsPanel's own "End ->
  // Start" swatch always shows dashed - a real mismatch between the panel's legend and the map.
  // AtoB no longer falls back to BtoA for primaryFeature, and secondaryFeatures no longer requires
  // BOTH directions to exist - BtoA renders dashed whenever it exists, period.
  const primaryFeature = routes?.AtoB?.[selectedVariant]?.feature || null;
  const secondaryFeatures = React.useMemo(() => {
    const f = routes?.BtoA?.[selectedVariant]?.feature;
    return f ? [f] : [];
  }, [routes, selectedVariant]);

  // Testing-only individual-pair route (2026-08-21) - pick any start + any end candidate point,
  // see the actual route between them highlighted. Reuses the existing single-trip resolver.
  const {
    pickedStart, pickedEnd, route: pickedRoute, loading: pickedRouteLoading,
    error: pickedRouteError, pick: pickCandidatePoint, clear: clearPickedPair,
  } = usePickedPairRoute(DEFAULT_CONFLATION_VIEW_ID, pgEnv, selectedSegment?.ogcFid);
  const pickerActive = isDensityMode && showCandidatePoints && pickPairTesting;
  useDensityPointPicker(map, pickerActive, pickCandidatePoint);
  // A picked pair belongs to the segment it was picked under - clear it whenever the selected
  // segment changes (including to null), so a stale test route from a PREVIOUS closure doesn't
  // linger or get silently recomputed against a new, unrelated exclusion.
  React.useEffect(() => {
    clearPickedPair();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSegment?.ogcFid]);

  // Single-trip mode: its own route (primaryFeature/secondaryFeatures). Density mode: the
  // heatmap has its own layer instead, EXCEPT when the testing pair-picker has a route to show -
  // that borrows this same layer since only one of the two is ever active at once.
  //
  // Gated on `pickerActive`, not just `isDensityMode` (2026-08-24 - "if last option [Pick point
  // pair] is turned off, that yellow route line is also get turned off"): `pickedRoute` state only
  // clears when the selected SEGMENT changes, not when the picker toggle itself is switched off -
  // so without this gate, a route picked earlier kept rendering after the toggle was turned off.
  useRouteLayer(
    map,
    isDensityMode ? (pickerActive ? pickedRoute?.shortest?.feature || null : null) : primaryFeature,
    isDensityMode ? [] : secondaryFeatures,
  );
  const { clear: clearStartEndMarkers } = useStartEndMarkers(
    map,
    isDensityMode ? null : startEnd?.start,
    isDensityMode ? null : startEnd?.end,
  );

  useClosureDensityLayer(map, isDensityMode ? density?.edgeFrequencies : null, density?.maxCount);
  useDensityCandidatesLayer(
    map,
    isDensityMode ? density?.startPoints : null,
    isDensityMode ? density?.endPoints : null,
    isDensityMode && showCandidatePoints,
  );

  // Switching modes clears whichever result the OTHER mode was showing, so no stale layer/panel
  // content survives the toggle (single <-> density).
  React.useEffect(() => {
    clearSegment();
    setStartEnd(null);
    setResolveError(null);
    clearStartEndMarkers();
    resetRoute();
    resetDensity();
    clearPickedPair();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDensityMode]);

  // Selecting a segment resolves its derived start/end and shows the markers immediately, but
  // does NOT compute the route yet - that's the explicit "Get detour" press below. Density mode
  // doesn't need this at all - its candidate points are derived server-side from the segment's own
  // endpoints (see computeClosureDensity), so start/end resolution is single-mode only.
  React.useEffect(() => {
    if (isDensityMode) return;
    if (!selectedSegment) {
      setStartEnd(null);
      setResolveError(null);
      return;
    }

    let cancelled = false;
    setResolving(true);
    setResolveError(null);
    resolveVerifiedEndpoints(selectedSegment, DEFAULT_CONFLATION_VIEW_ID, pgEnv).then((result) => {
      if (cancelled) return;
      setResolving(false);
      if (result) {
        setStartEnd(result);
      } else {
        // Genuinely isolated - even the plain-nearest-node fallback found nothing nearby at one
        // or both ends. A real, visible dead end, not a silent stuck state.
        setStartEnd(null);
        setResolveError("This segment has an isolated end with no other nearby road point - no detour can be computed.");
      }
    }).catch((err) => {
      if (cancelled) return;
      setResolving(false);
      setStartEnd(null);
      setResolveError(err.message || "Failed to find start/end points for this segment.");
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSegment?.ogcFid]);

  const handleGetDetour = () => {
    if (!startEnd || !selectedSegment) return;
    getRoute(startEnd.start, startEnd.end, [selectedSegment.ogcFid]);
  };

  const handleAnalyze = () => {
    if (!selectedSegment) return;
    analyze(selectedSegment.ogcFid);
  };

  const handleReset = () => {
    clearSegment();
    setStartEnd(null);
    setResolveError(null);
    clearStartEndMarkers();
    resetRoute();
    resetDensity();
    clearPickedPair();
  };

  if (isDensityMode) {
    return (
      <ClosureDensityPanel
        selectedSegment={selectedSegment}
        canAnalyze={Boolean(selectedSegment) && !hasResult}
        loading={densityLoading}
        phase={densityPhase}
        error={densityError}
        resolveError={null}
        density={density}
        onAnalyze={handleAnalyze}
        onReset={handleReset}
        pickPairTesting={pickerActive}
        pickedStart={pickedStart}
        pickedEnd={pickedEnd}
        pickedRoute={pickedRoute}
        pickedRouteLoading={pickedRouteLoading}
        pickedRouteError={pickedRouteError}
        onClearPickedPair={clearPickedPair}
      />
    );
  }

  return (
    <DetourDetailsPanel
      selectedSegment={selectedSegment}
      canGetDetour={Boolean(startEnd) && !hasResult}
      loading={loading || resolving}
      error={error}
      resolveError={resolveError}
      routes={routes}
      baselineRoutes={baselineRoutes}
      selectedVariant={selectedVariant}
      onSelectVariant={setSelectedVariant}
      onGetDetour={handleGetDetour}
      onReset={handleReset}
      startEnd={startEnd}
    />
  );
};

export { Comp };
