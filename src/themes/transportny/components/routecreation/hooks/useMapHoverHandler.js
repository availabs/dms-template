import { useEffect, useRef, useCallback } from "react";
import { get, set } from "lodash-es";
import { SHAPEFILE_LAYER_KEY } from "../constants";

// Two-way row <-> map highlight (npmrds-route-creation.html, routes-reports-users-mesh.md
// Workstream E). Parallel to useMapTmcHandler's click handler - same queryRenderedFeatures
// hit-test against the shapefile layer, but on mousemove/mouseout instead of click, and it only
// ever WRITES hovered_tmc (never touches tmc_array): dataUpdate.jsx reads it back out to paint
// the highlight, RouteEditor reads it back out to light the matching row. Active in BOTH
// creation modes - unlike click handling (gated by `isActive` in useMapTmcHandler/
// useMapMarkerHandler), hovering a segment should light its row regardless of which mode is
// selecting new segments.
export const useMapHoverHandler = (map, state, setState, pluginDataPath) => {
  const shapefileLayerId = get(
    state,
    `${pluginDataPath}['active-layers'][${SHAPEFILE_LAYER_KEY}]`
  );

  // Avoids a setState/re-render on every mousemove pixel - only writes when the hovered
  // TMC actually changes.
  const lastHoveredRef = useRef(null);

  const setHoveredTmc = useCallback((tmc) => {
    const next = tmc || null;
    if (lastHoveredRef.current === next) return;
    lastHoveredRef.current = next;
    setState((draft) => set(draft, `${pluginDataPath}['hovered_tmc']`, next));
  }, [pluginDataPath, setState]);

  useEffect(() => {
    if (!map || !shapefileLayerId) return;

    const MAP_MOUSEMOVE = (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: [shapefileLayerId],
      });
      setHoveredTmc(features?.[0]?.properties?.tmc);
    };
    // Generic (canvas-wide) event, not the layer-scoped 'mouseleave' - clears the highlight
    // when the cursor leaves the map entirely, as a backstop to the mousemove hit-test above
    // (which already clears it over any empty stretch of the canvas).
    const MAP_MOUSEOUT = () => setHoveredTmc(null);

    map.on("mousemove", MAP_MOUSEMOVE);
    map.on("mouseout", MAP_MOUSEOUT);
    return () => {
      map.off("mousemove", MAP_MOUSEMOVE);
      map.off("mouseout", MAP_MOUSEOUT);
      setHoveredTmc(null);
    };
  }, [map, shapefileLayerId, setHoveredTmc]);

  return { setHoveredTmc };
};
