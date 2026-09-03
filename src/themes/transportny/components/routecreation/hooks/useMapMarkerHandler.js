import { useEffect, useRef, useCallback, useState } from "react";
import { scaleLinear } from "d3-scale";
import { set } from "lodash-es";
import mapboxgl from "maplibre-gl";
import { normalizeMarkerElement } from "../../../../../dms/packages/dms/src/ui/components/map/utils";
import { resolveRouteFromPoints } from "./resolveRoute";
import { MARKER_GRADIENT_COLORS } from "../constants";

// Marker-drop / auto-route mode: drop waypoints, drag to reposition, resolve to a TMC
// path via resolveRouteFromPoints. Ports RouteCreationLayer.jsx:304-430 (old tool) onto
// maplibre + plugin state instead of the old class-component/avl-map LayerContainer.
export const useMapMarkerHandler = (map, setState, pluginDataPath, isActive, year) => {
  const pointsRef = useRef([]); // [{ lng, lat }, ...] - source of truth for marker positions
  const markersRef = useRef([]); // parallel array of live mapboxgl.Marker instances
  const [markerCount, setMarkerCount] = useState(0);
  // The RouteEditor's TMC list goes blank while a route resolves (routing2.availabs.org
  // is a real network round-trip, and Marker mode's tmc_array only ever appears/changes
  // once it resolves) - surfaces that as an explicit loading state instead of the panel
  // looking frozen/empty (2026-09-03 user report).
  const [isResolving, setIsResolving] = useState(false);

  const resolve = useCallback(async (points) => {
    if (points.length < 2) {
      setIsResolving(false);
      setState((draft) => set(draft, `${pluginDataPath}['tmc_array']`, []));
      return;
    }
    setIsResolving(true);
    try {
      const locations = points.map((p) => ({ lon: p.lng, lat: p.lat }));
      const tmc_array = await resolveRouteFromPoints(locations, year);
      setState((draft) => set(draft, `${pluginDataPath}['tmc_array']`, tmc_array));
    } finally {
      setIsResolving(false);
    }
  }, [setState, pluginDataPath, year]);

  // dragend handlers are bound once per marker (see rebuildMarkers) - route through a ref
  // so a `year` change doesn't require re-binding every existing marker's listener.
  const resolveRef = useRef(resolve);
  useEffect(() => {
    resolveRef.current = resolve;
  }, [resolve]);

  const rebuildMarkers = useCallback(() => {
    markersRef.current.forEach((marker) => marker.remove());

    const points = pointsRef.current;
    const num = Math.max(points.length - 1, 1);
    const scale = scaleLinear().domain([0, num * 0.5, num]).range(MARKER_GRADIENT_COLORS);

    markersRef.current = points.map((point, i) => {
      // normalizeMarkerElement works around the app not loading maplibre-gl's own
      // stylesheet - without it the marker wrapper has no `position` rule and renders
      // as an invisible, full-width static block instead of a pin at the click point.
      const marker = normalizeMarkerElement(
        new mapboxgl.Marker({ draggable: true, color: scale(i) })
          .setLngLat(point)
          .addTo(map)
      );
      marker.on("dragend", () => {
        const { lng, lat } = marker.getLngLat();
        pointsRef.current = pointsRef.current.map((p, pi) => (pi === i ? { lng, lat } : p));
        resolveRef.current(pointsRef.current);
      });
      return marker;
    });
    setMarkerCount(points.length);
  }, [map]);

  const addPoint = useCallback((lngLat) => {
    pointsRef.current = [...pointsRef.current, { lng: lngLat.lng, lat: lngLat.lat }];
    rebuildMarkers();
    resolveRef.current(pointsRef.current);
  }, [rebuildMarkers]);

  const removeLastMarker = useCallback(() => {
    if (!pointsRef.current.length) return;
    pointsRef.current = pointsRef.current.slice(0, -1);
    rebuildMarkers();
    resolveRef.current(pointsRef.current);
  }, [rebuildMarkers]);

  const clearAllMarkers = useCallback(() => {
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    pointsRef.current = [];
    setMarkerCount(0);
    setIsResolving(false);
    setState((draft) => set(draft, `${pluginDataPath}['tmc_array']`, []));
  }, [setState, pluginDataPath]);

  useEffect(() => {
    if (!map || !isActive) return;

    const MAP_CLICK = (e) => addPoint(e.lngLat);
    map.on("click", MAP_CLICK);
    return () => map.off("click", MAP_CLICK);
  }, [map, isActive, addPoint]);

  return { markerCount, removeLastMarker, clearAllMarkers, isResolving };
};
