import { useEffect } from "react";
import { DENSITY_CANDIDATES_LAYER_ID } from "../constants";

// Testing-only click picker (2026-08-21) for the density-mode candidate points layer - click any
// start (green) or end (red) point, `onPick({lon,lat}, role)` fires so the caller can track which
// one was picked and compute the route between them. Gated by `isActive` - comp.jsx only turns
// this on when density mode + "show candidate points" + "pick point pair (testing)" are ALL on.
export const useDensityPointPicker = (map, isActive, onPick) => {
  useEffect(() => {
    if (!map || !isActive) return;
    const canvas = map.getCanvas();
    const onMouseMove = (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [DENSITY_CANDIDATES_LAYER_ID] });
      canvas.style.cursor = features.length ? "pointer" : "";
    };
    const onClick = (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [DENSITY_CANDIDATES_LAYER_ID] });
      if (!features.length) return;
      const feature = features[0];
      const [lon, lat] = feature.geometry.coordinates;
      onPick({ lon, lat }, feature.properties.role);
    };
    map.on("mousemove", onMouseMove);
    map.on("click", onClick);
    return () => {
      map.off("mousemove", onMouseMove);
      map.off("click", onClick);
      canvas.style.cursor = "";
    };
  }, [map, isActive, onPick]);
};
