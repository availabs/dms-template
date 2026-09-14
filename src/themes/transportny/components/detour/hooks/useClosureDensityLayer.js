import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { DENSITY_SOURCE_ID, DENSITY_LAYER_ID, DENSITY_LABEL_LAYER_ID, DENSITY_COLOR_RAMP, computeDensityStops } from "../constants";
import { runWhenStyleReady } from "./runWhenStyleReady";

// Renders the closure-density heatmap: one line feature per edge that appeared in at least one
// candidate route, colored by `count` via a MapLibre `step` expression over the validated
// sequential ramp (constants.js's DENSITY_COLOR_RAMP - dataviz skill reference, not eyeballed).
// A symbol layer on the same source labels each segment's count at its midpoint
// (`symbol-placement: "line-center"` - one label per line, not repeated along it), and a hover
// popup shows the same count + road name. Same runWhenStyleReady guard as every other map-writing
// hook in this plugin.
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
      // Discrete `step` buckets, not a continuous interpolation - a smooth gradient makes two
      // consecutive counts nearly indistinguishable, while clear bucket boundaries read easier at
      // a glance. Width is ALSO data-driven by count (double encoding, not just color) - the
      // lightest ramp step reads as near-invisible against the dark basemap on its own, so the
      // heaviest-used segments need to be visibly thicker too. Breakpoints (20/40/60/80% of
      // maxCount) match DENSITY_STEP_FRACTIONS in constants.js, which the panel legend also reads
      // from so the legend's numeric ranges always match what's actually drawn.
      // Breakpoints MUST be strictly increasing - MapLibre's `step` expression rejects (silently,
      // via setPaintProperty - no thrown error) a stop sequence that isn't. computeDensityStops
      // (constants.js) forces each stop to be at least 1 more than the previous one to guard
      // against degenerate cases like maxCount=2 producing raw stops [1,1,1,2], which would leave
      // the line-color paint update silently dropped (labels would still render from source data,
      // masking the bug) - and is shared with the panel's legend so both stay in sync.
      const stops = computeDensityStops(maxCount);
      const lineColor = maxCount > 0
        ? [
            "step", ["get", "count"],
            DENSITY_COLOR_RAMP[0],
            stops[0], DENSITY_COLOR_RAMP[1],
            stops[1], DENSITY_COLOR_RAMP[2],
            stops[2], DENSITY_COLOR_RAMP[3],
            stops[3], DENSITY_COLOR_RAMP[4],
          ]
        : DENSITY_COLOR_RAMP[0];
      // Narrower range (was 2.5-9) so a bidirectional road's two offset direction-lines don't
      // re-overlap at typical zoom.
      const lineWidth = maxCount > 0
        ? ["interpolate", ["linear"], ["get", "count"], 0, 1.5, maxCount, 5]
        : 2;

      // Ensure source and layers independently (not gated behind "does the source already
      // exist"): re-running analysis after the source was created on an earlier pass (e.g. a
      // prior segment, or a dev-server hot-reload that preserved the map instance across an edit
      // to this file) would otherwise skip straight to the `setData`-only branch and could leave
      // the label layer never added at all, since it was only ever created inside the "source
      // doesn't exist yet" branch.
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
            // MapLibre's collision-declutter pass - these are analysis labels, not basemap street
            // names, so they must all render regardless of density.
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
  // zoom).
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
      // `.loaded()`, not just truthiness: by unmount time the underlying maplibre instance can
      // already have been torn down (map.remove() called elsewhere) while `map` itself is still a
      // truthy reference - maplibre's own getLayer() throws internally once its style is gone.
      // Same guard AvlLayer's own cleanup already uses (avl-layer.jsx) for exactly this reason.
      if (!map || !map.loaded()) return;
      popupRef.current?.remove();
      if (map.getLayer(DENSITY_LABEL_LAYER_ID)) map.removeLayer(DENSITY_LABEL_LAYER_ID);
      if (map.getLayer(DENSITY_LAYER_ID)) map.removeLayer(DENSITY_LAYER_ID);
      if (map.getSource(DENSITY_SOURCE_ID)) map.removeSource(DENSITY_SOURCE_ID);
    };
  }, [map]);
};
