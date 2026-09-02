import { useEffect, useState, useCallback } from "react";
import { nearestFeatureToPoint } from "./nearestFeatureToPoint";
import {
  SELECTED_SEGMENT_SOURCE_ID, SELECTED_SEGMENT_LAYER_ID,
  HOVER_SEGMENT_SOURCE_ID, HOVER_SEGMENT_LAYER_ID,
  CLICK_TOLERANCE_PX,
  SEGMENT_COLORS,
} from "../constants";
import { runWhenStyleReady } from "./runWhenStyleReady";

// Base network layer, author-selected via internalPanel.jsx (2026-08-31 rewrite - replaces the
// plugin's own bbox-chunked fetch, see the task file's "Base layer: author-selected DMS layer"
// section). This hook no longer owns/fetches the pickable network's data at all - `edgesLayerId`
// is the maplibre layer id of an ALREADY-RENDERED, author-added DMS layer (same convention as
// ../routecreation/hooks/useMapTmcHandler.js: the symbology layerKey IS the maplibre layer id).
// Only the click/hover selection machinery and the plugin's own selection/hover overlay layers
// stay here.
//
// Picking uses a screen-pixel TOLERANCE BOX around the cursor (queryRenderedFeatures over a small
// rect, not exact hit-testing against the rendered line's thin stroke) - 2026-08-20 follow-up:
// "on hover closeby it will allow to pick the segment," since exact-pixel clicking required
// fully zooming in. The same tolerance drives a hover preview (amber) shown before the click, so
// the user can see what they're about to pick.
//
// `isActive` gates click/hover handling AND the author-selected layer's visibility - comp.jsx
// passes `!hasResult` (once "Get detour" is pressed, the pickable network hides entirely).
// "Clear detour" flips isActive back on to resume picking.
export const useEdgeLayer = (map, edgesLayerId, isActive) => {
  const [selectedSegment, setSelectedSegment] = useState(null); // { ogcFid, geometry } | null

  // Toggle the author-selected layer's visibility instead of adding/removing a plugin-owned
  // source - the plugin doesn't own this layer, only reads from it.
  //
  // Re-asserted on a short interval while hidden, not applied once and not just on 'styledata'
  // (2026-08-31, two fix attempts) - the layer's own author-side rendering pipeline
  // (SymbologyViewLayer's layerProps-driven re-sync) keeps reasserting the layer's own default
  // visibility on symbology state changes this plugin fires constantly while a result is showing
  // (density progress, candidate-point updates). A single 'styledata' listener still lost that
  // fight live (confirmed - the network stayed fully visible through the "Points found..."
  // density phase). Polling every 300ms while `!isActive` guarantees this plugin's intent
  // converges within one tick of whatever the other side just did, regardless of whether that
  // reassert happens via a maplibre style event, a React re-render, or something else this
  // plugin has no visibility into - without touching any shared layer/map code.
  useEffect(() => {
    if (!map || !edgesLayerId) return;
    // A line-type DMS layer renders as TWO maplibre layers sharing one symbology config: the
    // unsuffixed id (fill) and `${id}_case` (the casing/outline, its own paint - color, width,
    // opacity - independent of the fill's). Toggling only `edgesLayerId` left the casing (grey,
    // full opacity) visible no matter what, which is exactly the "still showing" streets live-
    // debugged 2026-08-31 - the fill was correctly invisible (0% opacity in this test layer's own
    // style), but its casing sub-layer was never touched. Both ids need the same visibility.
    const caseLayerId = `${edgesLayerId}_case`;
    const applyVisibility = () => {
      const visibility = isActive ? "visible" : "none";
      if (map.getLayer(edgesLayerId)) map.setLayoutProperty(edgesLayerId, "visibility", visibility);
      if (map.getLayer(caseLayerId)) map.setLayoutProperty(caseLayerId, "visibility", visibility);
    };
    runWhenStyleReady(map, applyVisibility);
    if (isActive) return; // no fight to win while the layer is supposed to be visible anyway
    const intervalId = setInterval(applyVisibility, 300);
    return () => clearInterval(intervalId);
  }, [map, edgesLayerId, isActive]);

  // Highlights the selected/excluded segment itself (the "what's closed" reference line) - the
  // derived start/end markers are a separate concern, rendered by useStartEndMarkers.js.
  const renderSelection = useCallback((segment) => {
    if (!map) return;
    const segFeatures = segment ? [{ type: "Feature", geometry: segment.geometry, properties: {} }] : [];

    const ensureLayers = () => {
      if (!map.getSource(SELECTED_SEGMENT_SOURCE_ID)) {
        map.addSource(SELECTED_SEGMENT_SOURCE_ID, { type: "geojson", data: { type: "FeatureCollection", features: segFeatures } });
        map.addLayer({
          id: SELECTED_SEGMENT_LAYER_ID,
          type: "line",
          source: SELECTED_SEGMENT_SOURCE_ID,
          paint: {
            "line-color": SEGMENT_COLORS.selected, "line-width": 4, "line-opacity": 0.85,
            "line-offset": 1.25,
          },
        });
      } else {
        map.getSource(SELECTED_SEGMENT_SOURCE_ID).setData({ type: "FeatureCollection", features: segFeatures });
      }
    };
    runWhenStyleReady(map, ensureLayers);
  }, [map]);

  // Hover preview - a candidate segment within CLICK_TOLERANCE_PX of the cursor, before any click.
  const renderHover = useCallback((feature) => {
    if (!map) return;
    const features = feature ? [{ type: "Feature", geometry: feature.geometry, properties: {} }] : [];
    const ensureLayer = () => {
      if (!map.getSource(HOVER_SEGMENT_SOURCE_ID)) {
        map.addSource(HOVER_SEGMENT_SOURCE_ID, { type: "geojson", data: { type: "FeatureCollection", features } });
        map.addLayer({
          id: HOVER_SEGMENT_LAYER_ID,
          type: "line",
          source: HOVER_SEGMENT_SOURCE_ID,
          paint: {
            "line-color": SEGMENT_COLORS.hover, "line-width": 4, "line-opacity": 0.7,
            "line-offset": 1.25,
          },
        });
      } else {
        map.getSource(HOVER_SEGMENT_SOURCE_ID).setData({ type: "FeatureCollection", features });
      }
    };
    runWhenStyleReady(map, ensureLayer);
  }, [map]);

  const clearSegment = useCallback(() => {
    setSelectedSegment(null);
    renderSelection(null);
  }, [renderSelection]);

  // Finds the nearest pickable edge within CLICK_TOLERANCE_PX screen pixels of `point`
  // ({x,y} in the map container, e.g. from a mouse event) - shared by both hover and click.
  const queryNearbyEdge = useCallback((point) => {
    if (!edgesLayerId || !map.getLayer(edgesLayerId)) return null;
    const box = [
      [point.x - CLICK_TOLERANCE_PX, point.y - CLICK_TOLERANCE_PX],
      [point.x + CLICK_TOLERANCE_PX, point.y + CLICK_TOLERANCE_PX],
    ];
    const candidates = map.queryRenderedFeatures(box, { layers: [edgesLayerId] });
    if (!candidates.length) return null;
    return nearestFeatureToPoint(candidates, point, (coord) => map.project(coord));
  }, [map, edgesLayerId]);

  // Hover preview + pointer cursor - map-wide (not layer-scoped), since the whole point is to
  // pick up nearby clicks the exact line geometry itself wouldn't register.
  useEffect(() => {
    if (!map || !isActive || !edgesLayerId) return;
    const canvas = map.getCanvas();
    const onMouseMove = (e) => {
      const nearby = queryNearbyEdge(e.point);
      renderHover(nearby);
      canvas.style.cursor = nearby ? "pointer" : "";
    };
    const onMouseLeave = () => {
      renderHover(null);
      canvas.style.cursor = "";
    };
    map.on("mousemove", onMouseMove);
    map.on("mouseout", onMouseLeave);
    return () => {
      map.off("mousemove", onMouseMove);
      map.off("mouseout", onMouseLeave);
      canvas.style.cursor = "";
    };
  }, [map, isActive, edgesLayerId, queryNearbyEdge, renderHover]);

  // Click near a segment to select it (same tolerance as hover); click near the SAME segment
  // again to deselect. Clicking near a DIFFERENT segment replaces the selection outright -
  // single-segment only for this pass, see the task file.
  useEffect(() => {
    if (!map || !isActive || !edgesLayerId) return;
    const onClick = (e) => {
      const feature = queryNearbyEdge(e.point);
      if (!feature) return;
      // ogc_fid comes back as the vector tile's FEATURE ID (`feature.id`), not a `properties`
      // key - confirmed live-debugging 2026-08-31 (click fired, found a feature, but
      // `feature.properties.ogc_fid` was undefined). PostGIS's `ST_AsMVT` keeps ogc_fid as the
      // MVT feature id specifically - ../routecreation never hit this because it only reads a
      // real property (`tmc`, via its `data-column` trick), never `ogc_fid`.
      const ogcFid = feature.id;
      setSelectedSegment((prev) => {
        if (prev?.ogcFid === ogcFid) {
          renderSelection(null);
          return null;
        }
        const next = { ogcFid, geometry: feature.geometry };
        renderSelection(next);
        return next;
      });
    };
    map.on("click", onClick);
    return () => map.off("click", onClick);
  }, [map, isActive, edgesLayerId, queryNearbyEdge, renderSelection]);

  useEffect(() => {
    return () => {
      // `.loaded()`, not just truthiness (2026-08-31, on a live DMS page's Map component - "Cannot
      // read properties of undefined (reading 'getLayer')"): by unmount time the underlying
      // maplibre instance can already have been torn down (map.remove() called elsewhere) while
      // `map` itself is still a truthy reference - maplibre's own getLayer() throws internally
      // once its style is gone. Same guard useClosureDensityLayer.js's cleanup already established
      // in this plugin (2026-08-26) for exactly this reason - applying it here too.
      if (!map || !map.loaded()) return;
      if (map.getLayer(SELECTED_SEGMENT_LAYER_ID)) map.removeLayer(SELECTED_SEGMENT_LAYER_ID);
      if (map.getSource(SELECTED_SEGMENT_SOURCE_ID)) map.removeSource(SELECTED_SEGMENT_SOURCE_ID);
      if (map.getLayer(HOVER_SEGMENT_LAYER_ID)) map.removeLayer(HOVER_SEGMENT_LAYER_ID);
      if (map.getSource(HOVER_SEGMENT_SOURCE_ID)) map.removeSource(HOVER_SEGMENT_SOURCE_ID);
    };
  }, [map]);

  return { selectedSegment, clearSegment };
};
