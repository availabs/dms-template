import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { DENSITY_SOURCE_ID, DENSITY_LAYER_ID, DENSITY_LABEL_LAYER_ID, DENSITY_COLOR_RAMP, DENSITY_STEP_FRACTIONS } from "../constants";
import { runWhenStyleReady } from "./runWhenStyleReady";

// Renders the closure-density heatmap: one line feature per edge that appeared in at least one
// candidate route, colored by `count` via a MapLibre `step` expression over the validated
// sequential ramp (constants.js's DENSITY_COLOR_RAMP - dataviz skill reference, not eyeballed).
// A symbol layer on the same source labels each segment's count at its midpoint
// (`symbol-placement: "line-center"` - one label per line, not repeated along it), and a hover
// popup shows the same count + road name - both requested by the user once the base heatmap was
// visible ("show the numbers here" / "allow hover tooltip for those segments too"). Same
// runWhenStyleReady guard as every other map-writing hook in this plugin.
export const useClosureDensityLayer = (map, edgeFrequencies, maxCount) => {
  useEffect(() => {
    if (!map) return;

    const features = (edgeFrequencies || []).map((e) => ({
      type: "Feature",
      geometry: e.geometry,
      properties: { ogc_fid: e.ogc_fid, highway: e.highway, count: e.count },
    }));
    const data = { type: "FeatureCollection", features };

    const addLayer = () => {
      // Discrete `step` buckets (not a continuous interpolation) - 2026-08-21 follow-up: a smooth
      // gradient made two consecutive counts nearly indistinguishable ("hard to understand the 2
      // consecutive range"). Clear bucket boundaries read easier at a glance; width is ALSO
      // data-driven by count (double encoding, not just color) - the lightest ramp step reads as
      // near-invisible against the dark basemap on its own, so the heaviest-used segments need to
      // be visibly thicker too. Breakpoints (20/40/60/80% of maxCount) match
      // DENSITY_STEP_FRACTIONS in constants.js, which the panel legend also reads from so the
      // legend's numeric ranges always match what's actually drawn.
      const lineColor = maxCount > 0
        ? [
            "step", ["get", "count"],
            DENSITY_COLOR_RAMP[0],
            Math.max(1, Math.round(maxCount * DENSITY_STEP_FRACTIONS[1])), DENSITY_COLOR_RAMP[1],
            Math.max(1, Math.round(maxCount * DENSITY_STEP_FRACTIONS[2])), DENSITY_COLOR_RAMP[2],
            Math.max(1, Math.round(maxCount * DENSITY_STEP_FRACTIONS[3])), DENSITY_COLOR_RAMP[3],
            Math.max(1, Math.round(maxCount * DENSITY_STEP_FRACTIONS[4])), DENSITY_COLOR_RAMP[4],
          ]
        : DENSITY_COLOR_RAMP[0];
      // Narrower range (was 2.5-9) so a bidirectional road's two offset direction-lines don't
      // re-overlap at typical zoom - "make width small" (2026-08-21).
      const lineWidth = maxCount > 0
        ? ["interpolate", ["linear"], ["get", "count"], 0, 1.5, maxCount, 5]
        : 2;

      // Ensure source and layers independently (not gated behind "does the source already
      // exist") - 2026-08-21 bug fix: re-running analysis after the source was created on an
      // earlier pass (e.g. a prior segment, or a dev-server hot-reload that preserved the map
      // instance across an edit to this file) skipped straight to the `setData`-only branch and
      // could leave the label layer never added at all, since it was only ever created inside the
      // "source doesn't exist yet" branch.
      if (!map.getSource(DENSITY_SOURCE_ID)) {
        map.addSource(DENSITY_SOURCE_ID, { type: "geojson", data });
      } else {
        map.getSource(DENSITY_SOURCE_ID).setData(data);
      }

      if (!map.getLayer(DENSITY_LAYER_ID)) {
        map.addLayer({
          id: DENSITY_LAYER_ID,
          type: "line",
          source: DENSITY_SOURCE_ID,
          paint: {
            // Flat line-offset (not data-driven) - see useEdgeLayer.js's comment for why a
            // constant works: MapLibre's line-offset is relative to each feature's own vertex
            // direction, and a bidirectional road's two rows store reversed coordinate order.
            "line-width": lineWidth, "line-opacity": 0.95, "line-color": lineColor,
            "line-offset": 1.25,
          },
        });
      } else {
        map.setPaintProperty(DENSITY_LAYER_ID, "line-color", lineColor);
        map.setPaintProperty(DENSITY_LAYER_ID, "line-width", lineWidth);
      }

      if (!map.getLayer(DENSITY_LABEL_LAYER_ID)) {
        map.addLayer({
          id: DENSITY_LABEL_LAYER_ID,
          type: "symbol",
          source: DENSITY_SOURCE_ID,
          layout: {
            "symbol-placement": "line-center",
            "text-field": ["to-string", ["get", "count"]],
            "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
            "text-size": 12,
            "text-rotation-alignment": "viewport",
            "text-pitch-alignment": "viewport",
            // Every analyzed segment should show its count, not just whichever ones survive
            // MapLibre's collision-declutter pass (2026-08-21: labels weren't appearing at all
            // without a text-font match, and would have still been dropped under default
            // collision rules once fixed - these are analysis labels, not basemap street names).
            "text-allow-overlap": true,
            "text-ignore-placement": true,
          },
          paint: {
            "text-color": "#ffffff",
            "text-halo-color": "#0f172a",
            "text-halo-width": 1.5,
            "text-halo-blur": 0.5,
          },
        });
      }
    };

    if (!features.length) {
      if (map.getLayer(DENSITY_LABEL_LAYER_ID)) map.removeLayer(DENSITY_LABEL_LAYER_ID);
      if (map.getLayer(DENSITY_LAYER_ID)) map.removeLayer(DENSITY_LAYER_ID);
      if (map.getSource(DENSITY_SOURCE_ID)) map.removeSource(DENSITY_SOURCE_ID);
      return;
    }

    runWhenStyleReady(map, addLayer);
  }, [map, edgeFrequencies, maxCount]);

  // Hover tooltip - a plain maplibregl.Popup following the cursor over DENSITY_LAYER_ID, showing
  // the same count + road type the label layer already renders (redundant with the always-on
  // label at high zoom, but the popup stays readable when segments are small/overlapping at low
  // zoom, and it's what the user asked for specifically).
  const popupRef = useRef(null);
  useEffect(() => {
    if (!map) return;
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });
    popupRef.current = popup;
    const canvas = map.getCanvas();

    const onMouseMove = (e) => {
      if (!map.getLayer(DENSITY_LAYER_ID)) return;
      const features = map.queryRenderedFeatures(e.point, { layers: [DENSITY_LAYER_ID] });
      if (!features.length) {
        popup.remove();
        canvas.style.cursor = "";
        return;
      }
      const { count, highway } = features[0].properties;
      canvas.style.cursor = "pointer";
      popup
        .setLngLat(e.lngLat)
        .setHTML(`<div style="font-size:12px"><strong>${count}</strong> route${count === 1 ? "" : "s"} use this segment<br/>${highway || "unknown road type"}</div>`)
        .addTo(map);
    };
    const onMouseLeave = () => {
      popup.remove();
      canvas.style.cursor = "";
    };

    map.on("mousemove", onMouseMove);
    map.on("mouseout", onMouseLeave);
    return () => {
      map.off("mousemove", onMouseMove);
      map.off("mouseout", onMouseLeave);
      popup.remove();
    };
  }, [map]);

  useEffect(() => {
    return () => {
      if (!map) return;
      popupRef.current?.remove();
      if (map.getLayer(DENSITY_LABEL_LAYER_ID)) map.removeLayer(DENSITY_LABEL_LAYER_ID);
      if (map.getLayer(DENSITY_LAYER_ID)) map.removeLayer(DENSITY_LAYER_ID);
      if (map.getSource(DENSITY_SOURCE_ID)) map.removeSource(DENSITY_SOURCE_ID);
    };
  }, [map]);
};
