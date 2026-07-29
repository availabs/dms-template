import { useEffect, useCallback } from "react";
import { get, set } from "lodash-es";
import { SHAPEFILE_LAYER_KEY } from "../constants";

export const useMapTmcHandler = (map, state, setState, pluginDataPath, symbPath, isActive) => {
  const shapefileLayerId = get(
    state,
    `${pluginDataPath}['active-layers'][${SHAPEFILE_LAYER_KEY}]`
  );

  const toggleTmc = useCallback((featId) => {
    setState((draft) => {
      set(draft, `${symbPath}.zoomToFilterBounds`, []); //resets zoom filter, so when loading existing route, it doesnt repeatedly re-zoom back to original bounds

      const currentTmcArray = get(draft, `${pluginDataPath}['tmc_array']`, []);
      if (currentTmcArray.includes(featId)) {
        set(
          draft,
          `${pluginDataPath}['tmc_array']`,
          currentTmcArray.filter((d) => d !== featId)
        );
      } else {
        set(draft, `${pluginDataPath}['tmc_array']`, [...currentTmcArray, featId]);
      }
    });
  }, [pluginDataPath, setState]);

  // Parity with useMapMarkerHandler's removeLastMarker/clearAllMarkers - the old tool
  // (RouteCreationInfoBox.jsx) has both for whichever mode is active; the new prototype
  // only had them for Marker mode until now.
  const removeLastTmc = useCallback(() => {
    setState((draft) => {
      const currentTmcArray = get(draft, `${pluginDataPath}['tmc_array']`, []);
      set(draft, `${pluginDataPath}['tmc_array']`, currentTmcArray.slice(0, -1));
    });
  }, [pluginDataPath, setState]);

  const clearAllTmc = useCallback(() => {
    setState((draft) => {
      set(draft, `${pluginDataPath}['tmc_array']`, []);
    });
  }, [pluginDataPath, setState]);

  useEffect(() => {
    if (!map || !shapefileLayerId || !isActive) return;

    const MAP_CLICK = (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: [shapefileLayerId],
      });
      const featId = features?.[0]?.properties?.tmc;

      if (featId) {
        toggleTmc(featId);
      }
    };

    map.on("click", MAP_CLICK);

    return () => {
      map.off("click", MAP_CLICK);
    };
  }, [map, shapefileLayerId, toggleTmc, isActive]);

  return { toggleTmc, removeLastTmc, clearAllTmc };
};
