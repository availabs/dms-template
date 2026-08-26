import { useEffect, useRef, useState, useCallback } from "react";
import { resolveEdgesInBbox } from "./resolveEdgesInBbox";
import { nearestFeatureToPoint } from "./nearestFeatureToPoint";
import {
  EDGES_SOURCE_ID, EDGES_LAYER_ID,
  SELECTED_SEGMENT_SOURCE_ID, SELECTED_SEGMENT_LAYER_ID,
  HOVER_SEGMENT_SOURCE_ID, HOVER_SEGMENT_LAYER_ID,
  CLICK_TOLERANCE_PX,
  SEGMENT_COLORS,
} from "../constants";
import { runWhenStyleReady } from "./runWhenStyleReady";

// Bbox chunking (2026-08-26, "it is taking a lot of time and got timeout, divided full state into
// multiple like how the layer is calling apis" - the /routing/edges query has no row cap anymore
// [it must return everything in view, not an arbitrary subset], so a single huge bbox at a wide
// zoom could mean one enormous, slow query). Same idea as vector-tile loading: split the current
// viewport into fixed-size cells and fetch each one separately (in parallel) instead of one
// request for the whole thing - bounds any single request's cost regardless of how far zoomed out
// the map is.
const EDGE_CHUNK_SIZE_DEG = 0.1; // ~10km cells - keeps a single chunk's row count in the range already confirmed fast
const MAX_EDGE_CHUNKS = 128; // safety ceiling - beyond this the viewport is too large to load the pickable network at all; zoom in instead of firing hundreds of parallel requests

const splitBboxIntoChunks = ([minLon, minLat, maxLon, maxLat], chunkSize) => {
  const chunks = [];
  for (let lon = minLon; lon < maxLon; lon += chunkSize) {
    for (let lat = minLat; lat < maxLat; lat += chunkSize) {
      chunks.push([lon, lat, Math.min(lon + chunkSize, maxLon), Math.min(lat + chunkSize, maxLat)]);
    }
  }
  return chunks;
};

// Renders the conflation network for the current viewport as a clickable line layer, lets the
// user pick ONE segment (corrected flow, 2026-08-19 - see the task file's "Flow correction":
// single-segment only for this pass, multi-select deferred).
//
// Picking uses a screen-pixel TOLERANCE BOX around the cursor (queryRenderedFeatures over a small
// rect, not exact hit-testing against the rendered line's thin stroke) - 2026-08-20 follow-up:
// "on hover closeby it will allow to pick the segment," since exact-pixel clicking required
// fully zooming in. The same tolerance drives a hover preview (amber) shown before the click, so
// the user can see what they're about to pick.
//
// `isActive` gates BOTH the pickable network's visibility and its click/hover handling -
// comp.jsx passes `!hasResult` (once "Get detour" is pressed, the pickable network hides
// entirely). "Clear detour" flips isActive back on to resume picking.
export const useEdgeLayer = (map, conflationViewId, pgEnv, isActive) => {
  const [selectedSegment, setSelectedSegment] = useState(null); // { ogcFid, osm, fromNode, toNode, geometry } | null
  const edgesRef = useRef([]);

  // Mirrors `isActive` in a ref so the async continuation below can re-check the CURRENT value,
  // not the one captured when the fetch started - 2026-08-21 bug fix. `refreshEdges` only checked
  // `isActive` before its `await`; if a fetch was still in flight when the user pressed "Analyze
  // coverage" (isActive flips to false, the pickable network gets removed), the stale fetch would
  // resolve afterward and unconditionally re-add the network layer, undoing the removal - the
  // "grey network doesn't go away" report.
  const isActiveRef = useRef(isActive);
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

  const refreshEdges = useCallback(async () => {
    if (!map || !isActive) return;
    const b = map.getBounds();
    const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    try {
      const chunks = splitBboxIntoChunks(bbox, EDGE_CHUNK_SIZE_DEG);
      if (chunks.length > MAX_EDGE_CHUNKS) return; // viewport too large - zoom in to load the pickable network (avoids firing hundreds of parallel requests)
      const chunkResults = await Promise.all(chunks.map((c) => resolveEdgesInBbox(c, conflationViewId, pgEnv)));
      // Dedupe by ogc_fid (2026-08-26, "divided full state into multiple like how the layer is
      // calling apis" - the &&-bbox-intersection query in a neighboring chunk can also match an
      // edge whose geometry spans the chunk boundary, so the same edge can come back from more
      // than one chunk).
      const edgeById = new Map();
      for (const chunkEdges of chunkResults) for (const e of chunkEdges) edgeById.set(e.id, e);
      const edges = [...edgeById.values()];
      if (!isActiveRef.current) return; // went inactive while this fetch was in flight - don't re-add
      edgesRef.current = edges;
      const data = { type: "FeatureCollection", features: edges };
      const ensureLayer = () => {
        if (!isActiveRef.current) return; // re-check once more - style-ready wait can also span the flip
        if (!map.getSource(EDGES_SOURCE_ID)) {
          map.addSource(EDGES_SOURCE_ID, { type: "geojson", data });
          map.addLayer({
            id: EDGES_LAYER_ID,
            type: "line",
            source: EDGES_SOURCE_ID,
            paint: {
              // Flat line-offset (not data-driven) - matches the convention confirmed live in
              // the data source's own default Map view (view 3699's tile symbology is just
              // {"line-offset": 1.25}, no direction expression). MapLibre's line-offset is
              // relative to each FEATURE's own vertex direction, and a bidirectional road's two
              // rows store their coordinates in opposite order (confirmed via a direct query -
              // `reversed=false` is A->B, `reversed=true` is B->A) - so the identical flat value
              // pushes the two directions to opposite physical sides automatically. A one-way
              // road (only one row) just gets a small, barely visible constant nudge.
              // 2026-08-21: bumped to 1.5 for testing (view 3699 itself uses 1.25) - not yet
              // confirmed as the final value, just easier to eyeball while verifying live.
              "line-color": SEGMENT_COLORS.pickable, "line-width": 2, "line-opacity": 0.5,
              "line-offset": 1.5,
            },
          });
        } else {
          map.getSource(EDGES_SOURCE_ID).setData(data);
        }
      };
      runWhenStyleReady(map, ensureLayer);
    } catch (err) {
      console.error("[detour useEdgeLayer] failed to load edges:", err);
    }
  }, [map, conflationViewId, pgEnv, isActive]);

  // Highlights the selected/excluded segment itself (the "what's closed" reference line) - the
  // derived start/end markers are a separate concern, rendered by useStartEndMarkers.js.
  const renderSelection = useCallback((segment) => {
    if (!map) return;
    const segFeatures = segment ? [{ type: "Feature", geometry: segment.geometry, properties: {} }] : [];

    const ensureLayers = () => {
      if (!map.getSource(SELECTED_SEGMENT_SOURCE_ID)) {
        map.addSource(SELECTED_SEGMENT_SOURCE_ID, { type: "geojson", data: { type: "FeatureCollection", features: segFeatures } });
        map.addLayer({
          id: SELECTED_SEGMENT_LAYER_ID,
          type: "line",
          source: SELECTED_SEGMENT_SOURCE_ID,
          paint: {
            "line-color": SEGMENT_COLORS.selected, "line-width": 4, "line-opacity": 0.85,
            "line-offset": 1.25,
          },
        });
      } else {
        map.getSource(SELECTED_SEGMENT_SOURCE_ID).setData({ type: "FeatureCollection", features: segFeatures });
      }
    };
    runWhenStyleReady(map, ensureLayers);
  }, [map]);

  // Hover preview - a candidate segment within CLICK_TOLERANCE_PX of the cursor, before any click.
  const renderHover = useCallback((feature) => {
    if (!map) return;
    const features = feature ? [{ type: "Feature", geometry: feature.geometry, properties: {} }] : [];
    const ensureLayer = () => {
      if (!map.getSource(HOVER_SEGMENT_SOURCE_ID)) {
        map.addSource(HOVER_SEGMENT_SOURCE_ID, { type: "geojson", data: { type: "FeatureCollection", features } });
        map.addLayer({
          id: HOVER_SEGMENT_LAYER_ID,
          type: "line",
          source: HOVER_SEGMENT_SOURCE_ID,
          paint: {
            "line-color": SEGMENT_COLORS.hover, "line-width": 4, "line-opacity": 0.7,
            "line-offset": 1.25,
          },
        });
      } else {
        map.getSource(HOVER_SEGMENT_SOURCE_ID).setData({ type: "FeatureCollection", features });
      }
    };
    runWhenStyleReady(map, ensureLayer);
  }, [map]);

  const clearSegment = useCallback(() => {
    setSelectedSegment(null);
    renderSelection(null);
  }, [renderSelection]);

  // Finds the nearest pickable edge within CLICK_TOLERANCE_PX screen pixels of `point`
  // ({x,y} in the map container, e.g. from a mouse event) - shared by both hover and click.
  const queryNearbyEdge = useCallback((point) => {
    // Guard against a race (2026-08-26 - "layer does not exist in the map's style"): the
    // mousemove/click listeners attach as soon as `isActive` is true, but the layer itself is
    // only added once the bbox-chunked fetch actually resolves and runWhenStyleReady's callback
    // runs - a mousemove/click during that window queried a layer id that isn't in the style yet.
    if (!map.getLayer(EDGES_LAYER_ID)) return null;
    const box = [
      [point.x - CLICK_TOLERANCE_PX, point.y - CLICK_TOLERANCE_PX],
      [point.x + CLICK_TOLERANCE_PX, point.y + CLICK_TOLERANCE_PX],
    ];
    const candidates = map.queryRenderedFeatures(box, { layers: [EDGES_LAYER_ID] });
    if (!candidates.length) return null;
    return nearestFeatureToPoint(candidates, point, (coord) => map.project(coord));
  }, [map]);

  useEffect(() => {
    if (!map || !isActive) return;
    refreshEdges();
    map.on("moveend", refreshEdges);
    return () => map.off("moveend", refreshEdges);
  }, [map, isActive, refreshEdges]);

  // Hides the pickable network layer whenever this phase is inactive (either before any
  // selection completes its round-trip, or - the new case - once a detour result is showing).
  useEffect(() => {
    if (!map) return;
    if (isActive) return;
    if (map.getLayer(EDGES_LAYER_ID)) map.removeLayer(EDGES_LAYER_ID);
    if (map.getSource(EDGES_SOURCE_ID)) map.removeSource(EDGES_SOURCE_ID);
    renderHover(null);
  }, [map, isActive, renderHover]);

  // Hover preview + pointer cursor - map-wide (not layer-scoped), since the whole point is to
  // pick up nearby clicks the exact line geometry itself wouldn't register.
  useEffect(() => {
    if (!map || !isActive) return;
    const canvas = map.getCanvas();
    const onMouseMove = (e) => {
      const nearby = queryNearbyEdge(e.point);
      renderHover(nearby);
      canvas.style.cursor = nearby ? "pointer" : "";
    };
    const onMouseLeave = () => {
      renderHover(null);
      canvas.style.cursor = "";
    };
    map.on("mousemove", onMouseMove);
    map.on("mouseout", onMouseLeave);
    return () => {
      map.off("mousemove", onMouseMove);
      map.off("mouseout", onMouseLeave);
      canvas.style.cursor = "";
    };
  }, [map, isActive, queryNearbyEdge, renderHover]);

  // Click near a segment to select it (same tolerance as hover); click near the SAME segment
  // again to deselect. Clicking near a DIFFERENT segment replaces the selection outright -
  // single-segment only for this pass, see the task file.
  useEffect(() => {
    if (!map || !isActive) return;
    const onClick = (e) => {
      const feature = queryNearbyEdge(e.point);
      if (!feature) return;
      const ogcFid = feature.properties.ogc_fid;
      setSelectedSegment((prev) => {
        if (prev?.ogcFid === ogcFid) {
          renderSelection(null);
          return null;
        }
        const next = { ogcFid, osm: feature.properties.osm, fromNode: feature.properties.from_node, toNode: feature.properties.to_node, highway: feature.properties.highway, geometry: feature.geometry };
        renderSelection(next);
        return next;
      });
    };
    map.on("click", onClick);
    return () => map.off("click", onClick);
  }, [map, isActive, queryNearbyEdge, renderSelection]);

  useEffect(() => {
    return () => {
      if (!map) return;
      if (map.getLayer(EDGES_LAYER_ID)) map.removeLayer(EDGES_LAYER_ID);
      if (map.getSource(EDGES_SOURCE_ID)) map.removeSource(EDGES_SOURCE_ID);
      if (map.getLayer(SELECTED_SEGMENT_LAYER_ID)) map.removeLayer(SELECTED_SEGMENT_LAYER_ID);
      if (map.getSource(SELECTED_SEGMENT_SOURCE_ID)) map.removeSource(SELECTED_SEGMENT_SOURCE_ID);
      if (map.getLayer(HOVER_SEGMENT_LAYER_ID)) map.removeLayer(HOVER_SEGMENT_LAYER_ID);
      if (map.getSource(HOVER_SEGMENT_SOURCE_ID)) map.removeSource(HOVER_SEGMENT_SOURCE_ID);
    };
  }, [map]);

  return { selectedSegment, clearSegment };
};
