import { useEffect } from "react";
import {
  ROUTE_SOURCE_ID, ROUTE_LAYER_ID, ROUTE_GLOW_LAYER_ID,
  ROUTE_SECONDARY_SOURCE_ID, ROUTE_SECONDARY_LAYER_ID,
  ROUTE_VARIANT_COLORS,
} from "../constants";

// Adds/updates/removes the plain geojson source+layer for both route variants (primary bold with
// a glow, secondary dimmed/thin) - unlike routecreation (which colors an existing
// symbology-driven TMC tile layer), the backend already returns one complete LineString per
// variant, so this is a straight MapLibre source/layer add, no tile/symbology plumbing needed.
export const useRouteLayer = (map, primaryFeature, secondaryFeature) => {
  useEffect(() => {
    if (!map) return;

    const addLayers = () => {
      if (!map.getSource(ROUTE_SECONDARY_SOURCE_ID)) {
        map.addSource(ROUTE_SECONDARY_SOURCE_ID, { type: "geojson", data: secondaryFeature || { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: ROUTE_SECONDARY_LAYER_ID,
          type: "line",
          source: ROUTE_SECONDARY_SOURCE_ID,
          paint: { "line-color": ROUTE_VARIANT_COLORS.secondary, "line-width": 3, "line-opacity": 0.7, "line-dasharray": [2, 1.5] },
        });
      } else {
        map.getSource(ROUTE_SECONDARY_SOURCE_ID).setData(secondaryFeature || { type: "FeatureCollection", features: [] });
      }

      if (!map.getSource(ROUTE_SOURCE_ID)) {
        map.addSource(ROUTE_SOURCE_ID, { type: "geojson", data: primaryFeature || { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: ROUTE_GLOW_LAYER_ID,
          type: "line",
          source: ROUTE_SOURCE_ID,
          paint: { "line-color": ROUTE_VARIANT_COLORS.primary, "line-width": 9, "line-opacity": 0.25, "line-blur": 3 },
        });
        map.addLayer({
          id: ROUTE_LAYER_ID,
          type: "line",
          source: ROUTE_SOURCE_ID,
          paint: { "line-color": ROUTE_VARIANT_COLORS.primary, "line-width": 3.5 },
        });
      } else {
        map.getSource(ROUTE_SOURCE_ID).setData(primaryFeature || { type: "FeatureCollection", features: [] });
      }
    };

    if (!primaryFeature && !secondaryFeature) {
      if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID);
      if (map.getLayer(ROUTE_GLOW_LAYER_ID)) map.removeLayer(ROUTE_GLOW_LAYER_ID);
      if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
      if (map.getLayer(ROUTE_SECONDARY_LAYER_ID)) map.removeLayer(ROUTE_SECONDARY_LAYER_ID);
      if (map.getSource(ROUTE_SECONDARY_SOURCE_ID)) map.removeSource(ROUTE_SECONDARY_SOURCE_ID);
      return;
    }

    // Same load-race guard as useViewportNodes: "load" may have already fired before this
    // effect subscribed (plugin added well after the map's initial load), so also try
    // immediately and on "idle", not just "load".
    if (map.isStyleLoaded()) addLayers();
    else map.once("load", addLayers);
  }, [map, primaryFeature, secondaryFeature]);

  // full teardown on unmount (plugin cleanup) - see routing.plugin.jsx's `cleanup`
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
