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
import { resolveNodesInBbox } from "./hooks/resolveNodesInBbox";
import { resolveEdgesInBbox } from "./hooks/resolveEdgesInBbox";
import { findNearestOtherNode } from "./hooks/findNearestOtherNode";
import { findSameRoadNode } from "./hooks/findSameRoadNode";
import { DEFAULT_CONFLATION_VIEW_ID } from "./constants";
import { DetourDetailsPanel } from "./components/DetourDetailsPanel";
import { ClosureDensityPanel } from "./components/ClosureDensityPanel";

const bearing = ([lon1, lat1], [lon2, lat2]) => Math.atan2(lon2 - lon1, lat2 - lat1);

// Picks the trip start/end point at a segment's endpoint. 2026-08-20 correction: a plain nearest-
// any-node search (the original build) can grab a point on a PARALLEL road that happens to be
// geometrically closer than the real continuation of the SAME road - wrong for detour purposes,
// since the point is "where would this trip have to be to actually use this road." Priority order:
//   1. The nearest OTHER node reachable via an edge that continues the SAME road (same `highway`
//      type, straightest bearing continuation - see findSameRoadNode.js) - progressively widens
//      its search bbox up to 5x, same as the original nearest-any-node search did.
//   2. Falls back to the plain nearest-any-node search ONLY if step 1 finds nothing at all within
//      that widened search - a real, flagged case (a genuine dead-end/disconnected node), not a
//      silent substitution. `usedFallback: true` on the result lets the UI say so.
const resolveEndpointNode = async (coord, neighborCoord, nodeId, excludeOgcFid, highway, conflationViewId, pgEnv) => {
  const incomingBearing = bearing(neighborCoord, coord);
  let delta = 0.0015; // ~150m at these latitudes
  for (let attempt = 0; attempt < 5; attempt++) {
    const bbox = [coord[0] - delta, coord[1] - delta, coord[0] + delta, coord[1] + delta];
    const edges = await resolveEdgesInBbox(bbox, conflationViewId, pgEnv);
    const found = findSameRoadNode(edges, nodeId, excludeOgcFid, highway, incomingBearing);
    if (found) return { lon: found.lon, lat: found.lat, sameHighway: found.sameHighway, usedFallback: false };
    delta *= 2;
  }

  // Nothing connected at all within the widened search - genuinely disconnected/dead-end case
  // (see the task file's "disconnected segment" note) - fall back to plain nearest-any-node.
  delta = 0.0015;
  for (let attempt = 0; attempt < 5; attempt++) {
    const bbox = [coord[0] - delta, coord[1] - delta, coord[0] + delta, coord[1] + delta];
    const nodes = await resolveNodesInBbox(bbox, conflationViewId, pgEnv);
    const found = findNearestOtherNode(nodes, coord, nodeId);
    if (found) return { lon: found.lon, lat: found.lat, sameHighway: false, usedFallback: true };
    delta *= 2;
  }
  return null;
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
  // shared with the "Display default legend" toggle via the same
  // state.symbology.pluginData.detour store. Segment picking (useEdgeLayer below) is reused as-is
  // in both modes - only what happens after selection differs.
  const isDensityMode = Boolean(get(state, "symbology.pluginData.detour['density-mode']", false));
  // "Show candidate points" Legend-panel toggle (2026-08-21) - independent of density mode itself.
  const showCandidatePoints = Boolean(get(state, "symbology.pluginData.detour['show-candidates']", false));
  // Testing-only pair picker toggle - only takes effect when density mode + show-candidates are
  // ALSO on, per the user's own framing ("it is depended on the point switch it must be on").
  const pickPairTesting = Boolean(get(state, "symbology.pluginData.detour['pick-pair-testing']", false));

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
  // direction-toggle and "show all routes" ideas): AtoB is primary (bold), BtoA is secondary
  // (dimmed/dashed) - or just whichever one direction actually has a route, if only one does.
  // Only the SELECTED cost objective (shortest/fastest) shows for each direction, not all 4 at
  // once - keeps the map readable while still surfacing the directional asymmetry this feature
  // exists to show.
  const primaryFeature = routes?.AtoB
    ? routes.AtoB[selectedVariant]?.feature
    : routes?.BtoA?.[selectedVariant]?.feature;
  const secondaryFeatures = React.useMemo(() => {
    if (!routes?.AtoB || !routes?.BtoA) return []; // only one direction has a route - nothing to dim
    const f = routes.BtoA[selectedVariant]?.feature;
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
  useRouteLayer(
    map,
    isDensityMode ? (pickedRoute?.shortest?.feature || null) : primaryFeature,
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
    const coords = selectedSegment.geometry.coordinates;
    const startCoord = coords[0], endCoord = coords.at(-1);
    const startNeighbor = coords[1] || coords[0];
    const endNeighbor = coords.at(-2) || coords.at(-1);
    const { highway } = selectedSegment;

    setResolving(true);
    setResolveError(null);
    Promise.all([
      resolveEndpointNode(startCoord, startNeighbor, selectedSegment.fromNode, selectedSegment.ogcFid, highway, DEFAULT_CONFLATION_VIEW_ID, pgEnv),
      resolveEndpointNode(endCoord, endNeighbor, selectedSegment.toNode, selectedSegment.ogcFid, highway, DEFAULT_CONFLATION_VIEW_ID, pgEnv),
    ]).then(([startNode, endNode]) => {
      if (cancelled) return;
      setResolving(false);
      if (startNode && endNode) {
        setStartEnd({ start: startNode, end: endNode });
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
