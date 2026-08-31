import { useEffect } from "react";
import { DENSITY_CANDIDATES_SOURCE_ID, DENSITY_CANDIDATES_LAYER_ID, MARKER_COLORS } from "../constants";
import { runWhenStyleReady } from "./runWhenStyleReady";

// Small toggleable dots for the BFS-picked candidate start/end nodes used by the closure-density
// analysis (2026-08-21: "i want to know which can be the start and end points that you pick... a
// small points will be good as well") - a `circle` layer, not the plain-dot approach
// useStartEndMarkers.js uses for the single-trip mode's two markers, since there can be up to
// DENSITY_NUM_CANDIDATES*2 of these at once. Reuses MARKER_COLORS' green/start, red/end
// convention. `visible` is the "Show candidate points" Legend-panel toggle - independent of
// whether an analysis has actually run yet (no points = nothing rendered either way).
export const useDensityCandidatesLayer = (map, startPoints, endPoints, visible) => {
  useEffect(() => {
    if (!map) return;

    const features = visible
      ? [
          ...(startPoints || []).map((p) => ({ type: "Feature", geometry: { type: "Point", coordinates: [p.lon, p.lat] }, properties: { role: "start" } })),
          ...(endPoints || []).map((p) => ({ type: "Feature", geometry: { type: "Point", coordinates: [p.lon, p.lat] }, properties: { role: "end" } })),
        ]
      : [];
    const data = { type: "FeatureCollection", features };

    const ensureLayer = () => {
      if (!map.getSource(DENSITY_CANDIDATES_SOURCE_ID)) {
        map.addSource(DENSITY_CANDIDATES_SOURCE_ID, { type: "geojson", data });
        map.addLayer({
          id: DENSITY_CANDIDATES_LAYER_ID,
          type: "circle",
          source: DENSITY_CANDIDATES_SOURCE_ID,
          paint: {
            "circle-radius": 4,
            "circle-color": ["match", ["get", "role"], "start", MARKER_COLORS.start, "end", MARKER_COLORS.end, "#999"],
            "circle-stroke-width": 1,
            "circle-stroke-color": "#ffffff",
          },
        });
      } else {
        map.getSource(DENSITY_CANDIDATES_SOURCE_ID).setData(data);
      }
    };

    if (!features.length) {
      if (map.getLayer(DENSITY_CANDIDATES_LAYER_ID)) map.removeLayer(DENSITY_CANDIDATES_LAYER_ID);
      if (map.getSource(DENSITY_CANDIDATES_SOURCE_ID)) map.removeSource(DENSITY_CANDIDATES_SOURCE_ID);
      return;
    }

    runWhenStyleReady(map, ensureLayer);
  }, [map, startPoints, endPoints, visible]);

  useEffect(() => {
    return () => {
      if (!map) return;
      if (map.getLayer(DENSITY_CANDIDATES_LAYER_ID)) map.removeLayer(DENSITY_CANDIDATES_LAYER_ID);
      if (map.getSource(DENSITY_CANDIDATES_SOURCE_ID)) map.removeSource(DENSITY_CANDIDATES_SOURCE_ID);
    };
  }, [map]);
};
