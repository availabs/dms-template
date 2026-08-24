import { useEffect } from "react";
import {
  ROUTE_SOURCE_ID, ROUTE_LAYER_ID, ROUTE_GLOW_LAYER_ID, ROUTE_COLOR,
  ROUTE_SECONDARY_SOURCE_ID, ROUTE_SECONDARY_LAYER_ID, ROUTE_SECONDARY_COLOR,
} from "../constants";
import { runWhenStyleReady } from "./runWhenStyleReady";

// Detour plugin's own route-line renderer - own ids, primary (bold, currently-selected
// direction+variant) + secondary (dimmed, everything else - the "show all routes" test toggle,
// 2026-08-19: "just for test... always highlight the route like this one"). Same plain geojson
// source/layer primitive as ../../routing/hooks/useRouteLayer.js.
export const useRouteLayer = (map, primaryFeature, secondaryFeatures = []) => {
  useEffect(() => {
    if (!map) return;

    const addLayers = () => {
      const secondaryCollection = { type: "FeatureCollection", features: secondaryFeatures };
      if (!map.getSource(ROUTE_SECONDARY_SOURCE_ID)) {
        map.addSource(ROUTE_SECONDARY_SOURCE_ID, { type: "geojson", data: secondaryCollection });
        map.addLayer({
          id: ROUTE_SECONDARY_LAYER_ID,
          type: "line",
          source: ROUTE_SECONDARY_SOURCE_ID,
          paint: { "line-color": ROUTE_SECONDARY_COLOR, "line-width": 3, "line-opacity": 0.6, "line-dasharray": [2, 1.5] },
        });
      } else {
        map.getSource(ROUTE_SECONDARY_SOURCE_ID).setData(secondaryCollection);
      }

      if (!map.getSource(ROUTE_SOURCE_ID)) {
        map.addSource(ROUTE_SOURCE_ID, { type: "geojson", data: primaryFeature || { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: ROUTE_GLOW_LAYER_ID,
          type: "line",
          source: ROUTE_SOURCE_ID,
          paint: { "line-color": ROUTE_COLOR, "line-width": 9, "line-opacity": 0.25, "line-blur": 3 },
        });
        map.addLayer({
          id: ROUTE_LAYER_ID,
          type: "line",
          source: ROUTE_SOURCE_ID,
          paint: { "line-color": ROUTE_COLOR, "line-width": 3.5 },
        });
      } else {
        map.getSource(ROUTE_SOURCE_ID).setData(primaryFeature || { type: "FeatureCollection", features: [] });
      }
    };

    if (!primaryFeature && secondaryFeatures.length === 0) {
      if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID);
      if (map.getLayer(ROUTE_GLOW_LAYER_ID)) map.removeLayer(ROUTE_GLOW_LAYER_ID);
      if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
      if (map.getLayer(ROUTE_SECONDARY_LAYER_ID)) map.removeLayer(ROUTE_SECONDARY_LAYER_ID);
      if (map.getSource(ROUTE_SECONDARY_SOURCE_ID)) map.removeSource(ROUTE_SECONDARY_SOURCE_ID);
      return;
    }

    runWhenStyleReady(map, addLayers);
  }, [map, primaryFeature, secondaryFeatures]);

  useEffect(() => {
    return () => {
      if (!map) return;
      if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID);
      if (map.getLayer(ROUTE_GLOW_LAYER_ID)) map.removeLayer(ROUTE_GLOW_LAYER_ID);
      if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
      if (map.getLayer(ROUTE_SECONDARY_LAYER_ID)) map.removeLayer(ROUTE_SECONDARY_LAYER_ID);
      if (map.getSource(ROUTE_SECONDARY_SOURCE_ID)) map.removeSource(ROUTE_SECONDARY_SOURCE_ID);
    };
  }, [map]);
};
