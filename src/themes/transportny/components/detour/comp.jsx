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
import { resolveEdgeAtPoint } from "./hooks/resolveEdgeAtPoint";
import { EDGES_LAYER_KEY } from "./constants";
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
//
// Takes a resolved ogc_fid (see resolveEdgeAtPoint's own comment for why this can no longer be
// the raw picked-layer feature id), not a segment object.
const resolveVerifiedEndpoints = async (ogcFid, pgEnv) => {
  const result = await resolveDetourEndpoints(ogcFid, pgEnv);
  if (!result?.start || !result?.end) return null; // genuinely isolated end, no candidate at all
  return { start: result.start, end: result.end };
};

// Returns the clicked segment's own first/last coordinates (2026-09-02 - "take the start and end
// lat long and find which segment is disconnected in 2025"). Two real endpoints let the backend
// validate actual network topology (a real edge connecting two snapped nodes), not just proximity
// to one point.
const endpointsOf = (geometry) => {
  if (!geometry) return null;
  const coords = geometry.type === "LineString" ? geometry.coordinates
    : geometry.type === "MultiLineString" ? geometry.coordinates[0]
    : null;
  if (!coords?.length) return null;
  const [startLon, startLat] = coords[0];
  const [endLon, endLat] = coords[coords.length - 1];
  return { start: { lon: startLon, lat: startLat }, end: { lon: endLon, lat: endLat } };
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
  } = useTrspRoute(pgEnv);

  const {
    density, loading: densityLoading, phase: densityPhase, error: densityError, analyze, reset: resetDensity,
  } = useClosureDensity(pgEnv);

  const hasResult = isDensityMode
    ? Boolean(density) || Boolean(densityError)
    : Boolean(routes) || Boolean(error);
  // Base network layer (2026-08-31): author-selected via internalPanel.jsx instead of the plugin
  // fetching its own data - see the task file's "Base layer" section. `edgesLayerId` is the
  // maplibre layer id of an already-added, already-tiled DMS layer (source 2097 "Temp OSM
  // Conflation Edges" or equivalent - must be the `_edges` table, not the main conflation table).
  const edgesLayerId = get(state, `${pluginDataPath}['active-layers'][${EDGES_LAYER_KEY}]`);

  // Once a result (or a failed attempt) is showing, the pickable network hides and further
  // segment clicks are ignored until "Clear detour"/"Clear analysis" - see useEdgeLayer's isActive
  // contract.
  const { selectedSegment, clearSegment } = useEdgeLayer(map, edgesLayerId, !hasResult);

  // Segment-identity fix (2026-09-02, "the layer showing here is 2024 and the backend using data
  // is of 2025... ogc_fid... is not consistant across the years it just the int PK"): the base
  // network layer (`edgesLayerId` above) is author-selected and can be ANY year's tiled layer,
  // but every /trsp-memory-* backend call routes against ONE hardcoded conflation table set. The
  // raw `selectedSegment.ogcFid` (that layer's own feature id) is therefore NOT a safe identifier
  // into the backend's table - it silently matched an unrelated segment, which is why candidate
  // points were landing "way too far ahead" of the segment actually clicked. `resolvedOgcFid` is
  // the backend's OWN ogc_fid for whatever real-world segment the author clicked, snapped
  // server-side from the clicked geometry's start/end coordinates (resolveEdgeAtPoint.js) - this
  // is the only ogc_fid ever passed to resolveDetourEndpoints/analyze/getRoute/usePickedPairRoute
  // below.
  const [resolvedOgcFid, setResolvedOgcFid] = React.useState(null);
  const [segmentResolveError, setSegmentResolveError] = React.useState(null);
  React.useEffect(() => {
    if (!selectedSegment) {
      setResolvedOgcFid(null);
      setSegmentResolveError(null);
      return;
    }
    const endpoints = endpointsOf(selectedSegment.geometry);
    if (!endpoints) {
      setResolvedOgcFid(null);
      setSegmentResolveError("Could not read this segment's geometry.");
      return;
    }
    let cancelled = false;
    setResolvedOgcFid(null);
    setSegmentResolveError(null);
    resolveEdgeAtPoint(endpoints, pgEnv).then(({ ogc_fid, exactMatch }) => {
      if (cancelled) return;
      setResolvedOgcFid(ogc_fid);
      // No real edge connects the two snapped nodes in the live table - the clicked segment
      // doesn't exist in this shape in the current routing data (a real, name-the-cause
      // condition per the user's own framing - "find which segment is disconnected in 2025" -
      // not something to silently paper over with a best-effort nearest-edge guess).
      if (!exactMatch) {
        setSegmentResolveError("This segment doesn't match a connected road in the current routing data - results may be inaccurate.");
      }
    }).catch((err) => {
      if (cancelled) return;
      setSegmentResolveError(err.message || "Failed to resolve this segment against the current routing data.");
    });
    return () => { cancelled = true; };
  }, [selectedSegment, pgEnv]);

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
  } = usePickedPairRoute(pgEnv, resolvedOgcFid);
  const pickerActive = isDensityMode && showCandidatePoints && pickPairTesting;
  useDensityPointPicker(map, pickerActive, pickCandidatePoint);
  // A picked pair belongs to the segment it was picked under - clear it whenever the selected
  // segment changes (including to null), so a stale test route from a PREVIOUS closure doesn't
  // linger or get silently recomputed against a new, unrelated exclusion.
  React.useEffect(() => {
    clearPickedPair();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSegment]);

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

  // Auto-zoom to whatever result just came in (2026-09-02 - "the points are not visible and
  // routes too" reported with no console/server errors and confirmed-correct backend data:
  // nothing anywhere ever moved the map to the result, so a result several miles from wherever
  // the map happened to be panned/zoomed when the segment was picked would render correctly but
  // simply be off-screen). Fits to the closure-density heatmap's edge geometries (falls back to
  // candidate points if the tally hasn't finished yet) in density mode, or the primary/secondary
  // route features in single-trip mode - whichever is the actual visual result for the current
  // mode.
  React.useEffect(() => {
    if (!map) return;
    const coords = [];
    const collectFromGeometry = (geometry) => {
      if (!geometry) return;
      if (geometry.type === "LineString") coords.push(...geometry.coordinates);
      else if (geometry.type === "MultiLineString") geometry.coordinates.forEach((line) => coords.push(...line));
    };

    if (isDensityMode) {
      if (density?.edgeFrequencies?.length) {
        density.edgeFrequencies.forEach((e) => collectFromGeometry(e.geometry));
      } else {
        (density?.startPoints || []).forEach((p) => coords.push([p.lon, p.lat]));
        (density?.endPoints || []).forEach((p) => coords.push([p.lon, p.lat]));
      }
    } else {
      collectFromGeometry(primaryFeature?.geometry);
      secondaryFeatures.forEach((f) => collectFromGeometry(f?.geometry));
    }

    if (!coords.length) return;
    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
    for (const [lon, lat] of coords) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    map.fitBounds([[minLon, minLat], [maxLon, maxLat]], { padding: 80, maxZoom: 16, duration: 500 });
  }, [map, isDensityMode, density?.edgeFrequencies, density?.startPoints, density?.endPoints, primaryFeature, secondaryFeatures]);

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
    if (!resolvedOgcFid) return; // still waiting on the segment-identity resolve above

    let cancelled = false;
    setResolving(true);
    setResolveError(null);
    resolveVerifiedEndpoints(resolvedOgcFid, pgEnv).then((result) => {
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
  }, [selectedSegment, resolvedOgcFid]);

  const handleGetDetour = () => {
    if (!startEnd || !resolvedOgcFid) return;
    getRoute(startEnd.start, startEnd.end, [resolvedOgcFid]);
  };

  const handleAnalyze = () => {
    if (!resolvedOgcFid) return;
    analyze(resolvedOgcFid);
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
        canAnalyze={Boolean(resolvedOgcFid) && !hasResult}
        loading={densityLoading}
        phase={densityPhase}
        error={densityError}
        resolveError={segmentResolveError}
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
      canGetDetour={Boolean(startEnd) && Boolean(resolvedOgcFid) && !hasResult}
      loading={loading || resolving}
      error={error}
      resolveError={resolveError || segmentResolveError}
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
