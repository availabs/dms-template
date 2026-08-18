// macroview — THE WORST-N POINT OVERLAY.
//
// When "Worst 25 segments" is turned on, one point is drawn at the centre of each
// returned segment, its RADIUS scaled by the measure value and its FILL the colour of the
// legend bin that value falls in. Turning the list off removes it.
//
// WHY THIS IS NOT A TILE LAYER. The map draws its network only from tiles
// (project_mapeditor_renders_only_from_tiles) and side-queries feed panels — that rule
// exists because the network is 52,127 segments and the joins belong server-side. Twenty
// five points are the opposite case: a tile route for them would mean a second published
// view and a second symbology layer for data that changes on every filter change. They
// are a plain maplibre GeoJSON source + circle layer, added through the handle the plugin
// already has (comp.jsx's `map` prop, i.e. AvlMap's maplibreMap).
//
// THE TWO THINGS THAT MAKE THAT HARD, both handled here:
//
//   1. A BASEMAP CHANGE DESTROYS IT. Core's basemap picker calls
//      `maplibreMap.setStyle(...)` (avl-map.jsx → MapActions.setMapStyle), and setStyle
//      replaces the whole style — every source and layer that is not in the new style
//      document is gone. Core re-adds ITS layers from AvlLayer's "CHECK FOR STYLE CHANGE"
//      effect; nothing re-adds ours. So comp.jsx keeps a `styledata` listener and calls
//      draw() again: the source is missing after a reload, so draw() re-adds it.
//   2. CORE RE-ADDS THE PM3 LINES *AFTER* THAT. Its re-add runs off a React dispatch that
//      fires from the same `styledata`, so the freshly re-added tile layers would sit ON
//      TOP of our points. Every draw() therefore also re-asserts z-order by moving the
//      circle layer to the top of the stack (cheaply: `getLayersOrder()` is a copy of the
//      id array, and moveLayer is skipped when it is already last).
//
// draw() is idempotent — the re-assert pass adds nothing, sets no paint property
// (maplibre's setPaintProperty deep-compares and no-ops) and moves no layer, so the
// styledata → mutate → styledata loop terminates immediately.
//
// Non-component module (no JSX, no hooks) so the .jsx files stay Fast-Refresh clean.

import {
  WORST_POINTS_SOURCE_ID,
  WORST_POINTS_LAYER_ID,
  WORST_POINT_RADIUS,
} from "./constants";

// Is there a style to mutate at all? During a basemap switch `map.style` is replaced
// immediately, and every call below throws while the new style document is still parsing.
//
// ⚠ THIS DELIBERATELY DOES NOT USE `map.isStyleLoaded()`, and that is not a shortcut —
// using it was a real bug, measured: maplibre's `Style.loaded()` returns false unless
// EVERY tile manager has finished loading, but `addSource`/`addLayer` only require
// `style._loaded` (`_checkLoaded` throws "Style is not done loading."). After a basemap
// change the tiles are loading for the whole window in which `styledata` fires, so an
// isStyleLoaded() gate rejected every re-add attempt — and once the tiles finished,
// `sourcedata` fires, not `styledata`, so no attempt ever came back. The overlay simply
// never returned (probe run v1: `source=false layer=false` after switching to Satellite).
// The honest guard is "is there a style object", plus the try/catch in drawWorstPoints
// for the narrow window where it exists but has not parsed.
const styleReady = (map) => Boolean(map && map.style);

// Which legend bin a value falls in — i.e. which colour the CHOROPLETH paints it.
//
// This is not an approximation of the map's rule, it IS the map's rule. `choroplethPaint`
// (dms/…/LayerEditor/datamaps) builds
//     ['step', ['to-number', ['get', column]], colors[0], breaks[0], colors[0], … ]
// so the colour is `colors[i]` for the LAST i whose break the value reaches, and anything
// below breaks[0] takes the default, which is also colors[0]. comp.jsx's `legend` is that
// same pair of arrays zipped into {from, to, color}, and the legend strip in
// contextPanel.jsx renders exactly those colours — so one lookup here keeps the point,
// the line under it and the legend swatch in agreement by construction.
export const worstBinIndex = (value, legend) => {
  if (!Array.isArray(legend) || !legend.length || !Number.isFinite(value)) return -1;
  let idx = 0;
  for (let i = 0; i < legend.length; i += 1) {
    if (value >= legend[i].from) idx = i;
  }
  return idx;
};

// The GeoJSON features for a worst-N result set. Rows without a finite coordinate pair or
// a finite value are DROPPED, never given a placeholder location.
export const buildWorstPointFeatures = (rows, legend) =>
  (Array.isArray(rows) ? rows : [])
    .filter(
      (r) => Number.isFinite(r?.x) && Number.isFinite(r?.y) && Number.isFinite(r?.value)
    )
    .map((r, i) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.x, r.y] },
      properties: {
        tmc: r.tmc,
        county: r.county,
        value: r.value,
        rank: i + 1,
        // PRECOMPUTED per-feature colour rather than a `step` paint expression. Both are
        // legal; this one is chosen because it reads the very same `legend` array the
        // legend strip renders from, so "the point's colour is its legend bin's colour"
        // is true by construction instead of by two expressions agreeing — and because it
        // is directly measurable: a probe reads properties.color and compares it to the
        // computed background-color of the legend swatch. At 25 features there is no
        // performance argument either way.
        color: legend?.[worstBinIndex(r.value, legend)]?.color || null,
      },
    }))
    .filter((f) => Boolean(f.properties.color));

// Radius interpolated across the values actually returned.
//
// THE DEGENERATE CASE IS THE POINT OF THIS FUNCTION: maplibre's `interpolate` requires a
// strictly ascending input domain, so when every returned segment shares one value (a
// one-segment geography, or a measure that saturates) `[…, v, min, v, max]` is invalid.
// MEASURED failure mode, because it is worse than a throw would be
// (scratchpad/npmrdsv5-dev2/macroview_worst/degen2.mjs): addLayer does NOT throw — it
// emits `layers.….paint.circle-radius[5]: Input/output pairs for "interpolate"
// expressions must be arranged with input values in strictly ascending order` as a
// console error and DOES NOT ADD THE LAYER AT ALL (`map.getLayer(...)` → undefined). The
// overlay would just silently not appear. Not hypothetical here either: the worst-N set
// is by definition the narrow top of the distribution.
// When the domain has no width the radius is a plain number — the midpoint of the range,
// so "all equal" reads as uniform medium dots rather than implying they are all the
// smallest or all the largest.
export const worstRadiusExpression = (features) => {
  const mid = (WORST_POINT_RADIUS.min + WORST_POINT_RADIUS.max) / 2;
  const values = (features || []).map((f) => f.properties.value).filter(Number.isFinite);
  if (!values.length) return mid;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (!(hi > lo)) return mid;
  return [
    "interpolate",
    ["linear"],
    ["get", "value"],
    lo,
    WORST_POINT_RADIUS.min,
    hi,
    WORST_POINT_RADIUS.max,
  ];
};

export const removeWorstPoints = (map) => {
  if (!styleReady(map)) return false;
  try {
    if (map.getLayer(WORST_POINTS_LAYER_ID)) map.removeLayer(WORST_POINTS_LAYER_ID);
    if (map.getSource(WORST_POINTS_SOURCE_ID)) map.removeSource(WORST_POINTS_SOURCE_ID);
  } catch {
    // the style was swapped out from under us — it took the overlay with it
    return false;
  }
  return true;
};

// Add/update the overlay and keep it on top. `setData: false` is the style-reload
// re-assert pass — it must not push data maplibre already holds, because `styledata` also
// fires for ordinary style churn (core writing paint properties as filters change).
export const drawWorstPoints = (map, features, { setData = true } = {}) => {
  if (!styleReady(map)) return false;
  if (!features?.length) return removeWorstPoints(map);

  const data = { type: "FeatureCollection", features };
  const radius = worstRadiusExpression(features);
  try {
    const source = map.getSource(WORST_POINTS_SOURCE_ID);
    if (!source) {
      map.addSource(WORST_POINTS_SOURCE_ID, { type: "geojson", data });
    } else if (setData) {
      source.setData(data);
    }

    if (!map.getLayer(WORST_POINTS_LAYER_ID)) {
      map.addLayer({
        id: WORST_POINTS_LAYER_ID,
        type: "circle",
        source: WORST_POINTS_SOURCE_ID,
        paint: {
          "circle-radius": radius,
          "circle-color": ["get", "color"],
          "circle-opacity": 0.9,
          // A white ring, not a zinc one: this page's basemap is Dark by default and the
          // low bins of the colorbrewer ramp are the pale ones, so a dark ring would be
          // the treatment that disappears.
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-opacity": 0.9,
        },
      });
    } else {
      map.setPaintProperty(WORST_POINTS_LAYER_ID, "circle-radius", radius);
    }

    // ABOVE THE PM3 LINE LAYER — re-asserted rather than assumed, because core re-adds
    // its own layers AFTER the styledata that tells us the style reloaded (see the
    // header). addLayer with no beforeId already lands on top; this is what keeps it
    // there on every pass after that.
    const order = typeof map.getLayersOrder === "function" ? map.getLayersOrder() : null;
    if (order && order.length && order[order.length - 1] !== WORST_POINTS_LAYER_ID) {
      map.moveLayer(WORST_POINTS_LAYER_ID);
    }
  } catch {
    // The one legitimate failure: `styledata` can fire in the sliver where the style
    // object exists but has not parsed, and addSource throws "Style is not done
    // loading." Swallow it — another styledata always follows, and that one succeeds.
    return false;
  }
  return true;
};
