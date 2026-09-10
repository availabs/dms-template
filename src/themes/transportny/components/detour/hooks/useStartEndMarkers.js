import { useEffect, useCallback } from "react";
import { START_END_SOURCE_ID, START_END_LAYER_ID, MARKER_COLORS } from "../constants";
import { runWhenStyleReady } from "./runWhenStyleReady";

// Renders the two DERIVED trip start/end points (see comp.jsx's findNearestOtherNode - these are
// NOT the selected segment's own endpoints, they're the nearest OTHER node to each) as plain
// green/red dots, no text labels. Display-only, no click handling - the user's only interaction in
// this plugin is selecting a segment.
//
// Also returns an imperative `clear()`: the prop-driven effect below alone was not reliably
// clearing the markers on reset, so `clear()` lets comp.jsx's handleReset wipe the markers
// directly and immediately, rather than relying solely on a `start`/`end` prop change reaching
// this effect.
export const useStartEndMarkers = (map, start, end) => {
  const render = useCallback((s, e) => {
    if (!map) return;
    const doRender = () => {
      const features = [];
      if (s) features.push({ type: "Feature", properties: { kind: "start" }, geometry: { type: "Point", coordinates: [s.lon, s.lat] } });
      if (e) features.push({ type: "Feature", properties: { kind: "end" }, geometry: { type: "Point", coordinates: [e.lon, e.lat] } });
      const data = { type: "FeatureCollection", features };

      if (!map.getSource(START_END_SOURCE_ID)) {
        map.addSource(START_END_SOURCE_ID, { type: "geojson", data });
        map.addLayer({
          id: START_END_LAYER_ID,
          type: "circle",
          source: START_END_SOURCE_ID,
          paint: {
            "circle-radius": 9,
            "circle-color": ["match", ["get", "kind"], "start", MARKER_COLORS.start, "end", MARKER_COLORS.end, "#93a4b8"],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });
      } else {
        map.getSource(START_END_SOURCE_ID).setData(data);
      }
    };
    runWhenStyleReady(map, doRender);
  }, [map]);

  useEffect(() => {
    render(start, end);
  }, [render, start, end]);

  const clear = useCallback(() => render(null, null), [render]);

  useEffect(() => {
    return () => {
      // `.loaded()`, not just truthiness - see useEdgeLayer.js's cleanup for why.
      if (!map || !map.loaded()) return;
      if (map.getLayer(START_END_LAYER_ID)) map.removeLayer(START_END_LAYER_ID);
      if (map.getSource(START_END_SOURCE_ID)) map.removeSource(START_END_SOURCE_ID);
    };
  }, [map]);

  return { clear };
};
