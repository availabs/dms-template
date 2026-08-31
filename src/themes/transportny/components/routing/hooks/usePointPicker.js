import { useEffect, useRef, useCallback, useState } from "react";
import { MARKER_COLORS, POINTS_SOURCE_ID, POINTS_LAYER_ID, POINTS_LABEL_LAYER_ID } from "../constants";

// Phase 8: click-anywhere-on-the-map point picker, replacing Phase 6's node-dot layer. The user
// never sees or picks a raw graph node - they drop a pin the way they'd expect (same mental model
// as Google Maps), and the backend silently snaps it to the nearest graph node server-side (see
// resolveTrspRoute.js - the /trsp route already supports raw {source,destination} lon/lat).
// 1st click places a source point, 2nd places destination, 3rd restarts from a fresh source -
// same felt behavior as the deleted pre-Phase-6 useTwoPointHandler.js and Phase 6's
// useNodeSelection.js this replaces.
//
// Renders points as a plain GeoJSON circle+label layer (the same proven-working primitive
// useRouteLayer.js already uses for the route line itself) instead of a DOM-based
// mapboxgl.Marker - a real mapboxgl.Marker was tried first and its DOM element existed and was
// confirmed in the document (verified live, 2026-08-14), but never rendered visibly in this
// specific MapEditor host page for reasons not fully root-caused (likely a CSS conflict specific
// to this page's styles, not something the plugin's own code controls). A canvas-rendered layer
// sidesteps that class of bug entirely and is the same primitive already proven to work here.
export const usePointPicker = (map, isActive) => {
  const [source, setSource] = useState(null); // { lng, lat } | null
  const [destination, setDestination] = useState(null);

  const sourceRef = useRef(null);
  const destinationRef = useRef(null);

  const renderPoints = useCallback((src, dest) => {
    if (!map) return;
    const features = [];
    if (src) features.push({ type: "Feature", properties: { label: "Start", kind: "source" }, geometry: { type: "Point", coordinates: [src.lng, src.lat] } });
    if (dest) features.push({ type: "Feature", properties: { label: "Destination", kind: "destination" }, geometry: { type: "Point", coordinates: [dest.lng, dest.lat] } });
    const data = { type: "FeatureCollection", features };

    const ensureLayers = () => {
      if (!map.getSource(POINTS_SOURCE_ID)) {
        map.addSource(POINTS_SOURCE_ID, { type: "geojson", data });
        map.addLayer({
          id: POINTS_LAYER_ID,
          type: "circle",
          source: POINTS_SOURCE_ID,
          paint: {
            "circle-radius": 9,
            "circle-color": ["match", ["get", "kind"], "source", MARKER_COLORS.source, "destination", MARKER_COLORS.destination, MARKER_COLORS.unselected],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });
        map.addLayer({
          id: POINTS_LABEL_LAYER_ID,
          type: "symbol",
          source: POINTS_SOURCE_ID,
          layout: {
            "text-field": ["get", "label"],
            "text-offset": [0, -1.6],
            "text-size": 12,
            "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          },
          paint: {
            "text-color": "#1f2937",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.5,
          },
        });
      } else {
        map.getSource(POINTS_SOURCE_ID).setData(data);
      }
    };

    if (map.isStyleLoaded()) ensureLayers();
    else map.once("load", ensureLayers);
  }, [map]);

  const pick = useCallback((lngLat) => {
    if (!sourceRef.current) {
      sourceRef.current = { lng: lngLat.lng, lat: lngLat.lat };
      setSource(sourceRef.current);
    } else if (!destinationRef.current) {
      destinationRef.current = { lng: lngLat.lng, lat: lngLat.lat };
      setDestination(destinationRef.current);
    } else {
      // both already placed - a 3rd click starts a fresh pick, same felt behavior as
      // re-dropping a pin rather than accumulating an unbounded trail.
      sourceRef.current = { lng: lngLat.lng, lat: lngLat.lat };
      destinationRef.current = null;
      setSource(sourceRef.current);
      setDestination(null);
    }
    renderPoints(sourceRef.current, destinationRef.current);
  }, [renderPoints]);

  const reset = useCallback(() => {
    sourceRef.current = null;
    destinationRef.current = null;
    setSource(null);
    setDestination(null);
    renderPoints(null, null);
  }, [renderPoints]);

  useEffect(() => {
    if (!map || !isActive) return;
    const onMapClick = (e) => pick(e.lngLat);
    map.on("click", onMapClick);
    return () => map.off("click", onMapClick);
  }, [map, isActive, pick]);

  useEffect(() => {
    if (!isActive) reset();
  }, [isActive, reset]);

  // Teardown on unmount (plugin cleanup) - mirrors useRouteLayer.js's own cleanup pattern.
  useEffect(() => {
    return () => {
      if (!map) return;
      if (map.getLayer(POINTS_LABEL_LAYER_ID)) map.removeLayer(POINTS_LABEL_LAYER_ID);
      if (map.getLayer(POINTS_LAYER_ID)) map.removeLayer(POINTS_LAYER_ID);
      if (map.getSource(POINTS_SOURCE_ID)) map.removeSource(POINTS_SOURCE_ID);
    };
  }, [map]);

  return { source, destination, reset };
};
