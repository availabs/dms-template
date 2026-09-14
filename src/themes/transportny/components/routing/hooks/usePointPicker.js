import { useEffect, useRef, useCallback, useState } from "react";
import { MARKER_COLORS, POINTS_SOURCE_ID, POINTS_LAYER_ID, POINTS_LABEL_LAYER_ID } from "../constants";

const API_HOST = import.meta.env.VITE_API_HOST || "https://dmsserver.availabs.org";

// ~11km at NY's latitudes. A tight box (originally 0.005, ~500m) false-rejected real clicks in
// sparse areas - the Adirondack interior can be 10+km from the nearest road, and rural NY roads
// generally run several km apart. Verified against a real deep-wilderness point: 0.05 (~5.5km)
// still found zero nodes; 0.1 found the network. Widening the box risks accepting a click just
// over a nearby state border (their nodes fall inside the box too) - an acceptable trade-off, the
// same one a coarser boundary check would also make, and far better than rejecting real NY clicks.
const COVERAGE_BBOX_DEGREES = 0.1;

// Reuses the existing viewport-node-lookup route (already used elsewhere for map-viewport queries)
// instead of a new dedicated endpoint or a bundled administrative-boundary dataset - "is there a
// real graph node near this click" is a more direct question than "is this point inside NY's
// polygon," and this route already answers it.
const checkCoverage = async (lng, lat, pgEnv) => {
  const bbox = [
    lng - COVERAGE_BBOX_DEGREES, lat - COVERAGE_BBOX_DEGREES,
    lng + COVERAGE_BBOX_DEGREES, lat + COVERAGE_BBOX_DEGREES,
  ].join(",");
  const res = await fetch(`${API_HOST}/dama-admin/${pgEnv}/routing/nodes?bbox=${bbox}`);
  const { ok, result } = await res.json();
  return Boolean(ok && result?.nodes?.length);
};

// Click-anywhere-on-the-map point picker. The user never sees or picks a raw graph node - they
// drop a pin the way they'd expect (same mental model as Google Maps), and the backend silently
// snaps it to the nearest graph node server-side (see resolveTrspRoute.js - the /trsp route
// already supports raw {source,destination} lon/lat). 1st click places a source point, 2nd places
// destination, 3rd restarts from a fresh source.
//
// Renders points as a plain GeoJSON circle+label layer (the same proven-working primitive
// useRouteLayer.js already uses for the route line itself) instead of a DOM-based
// mapboxgl.Marker: a Marker's DOM element mounts but never renders visibly in this specific
// MapEditor host page for reasons not fully root-caused (likely a CSS conflict specific to this
// page's styles, not something the plugin's own code controls). A canvas-rendered layer
// sidesteps that class of bug entirely and is the same primitive already proven to work here.
export const usePointPicker = (map, isActive, pgEnv) => {
  const [source, setSource] = useState(null); // { lng, lat } | null
  const [destination, setDestination] = useState(null);
  const [outOfBounds, setOutOfBounds] = useState(false);

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

  // Each click bumps this so a slow/stale coverage-check response can't land after a newer
  // click or a reset has already been handled.
  const pickTokenRef = useRef(0);

  const pick = useCallback(async (lngLat) => {
    const token = ++pickTokenRef.current;
    const inCoverage = await checkCoverage(lngLat.lng, lngLat.lat, pgEnv);
    if (token !== pickTokenRef.current) return; // superseded

    if (!inCoverage) {
      setOutOfBounds(true);
      return;
    }
    setOutOfBounds(false);

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
  }, [renderPoints, pgEnv]);

  const reset = useCallback(() => {
    pickTokenRef.current++;
    sourceRef.current = null;
    destinationRef.current = null;
    setSource(null);
    setDestination(null);
    setOutOfBounds(false);
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

  return { source, destination, outOfBounds, reset };
};
