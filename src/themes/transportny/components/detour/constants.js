// Detour/avoid-segment plugin - a SEPARATE plugin from ../routing, kept independent by design.
// Own map source/layer ids so both plugins can be active on the same map simultaneously without
// colliding. See planning/transportny/tasks/current/detour-avoid-segment-routing-plugin.md.
//
// No manual point-picking at all - the user clicks ONE segment, and start/end are derived
// automatically from that segment's own two endpoints (this answers "what happens to any trip
// through this corridor if it's closed," not "a route for one traveler"). So there is no
// POINTS_* here, unlike ../routing/constants.js.
//
// Conflation table resolution is a single hardcoded set of 2025 table names, managed entirely
// server-side (data-types/routing/memoryGraph.js) - no `data_manager.views` DB lookup at
// request/load time. This plugin no longer knows or sends a view id at all; see
// ../routing/constants.js for the sibling plugin's identical note.

// The resulting detour route line.
const ROUTE_SOURCE_ID = "detour-route-line";
const ROUTE_LAYER_ID = "detour-route-line";
const ROUTE_GLOW_LAYER_ID = "detour-route-line-glow";
const ROUTE_COLOR = "#e8a33d";

// "Show all routes" toggle - shows every computed direction/variant at once, dimmed, while the
// currently selected one still renders bold via ROUTE_*_ID above. Same primary/dimmed-secondary
// convention as ../routing/constants.js's ROUTE_VARIANT_COLORS.
const ROUTE_SECONDARY_SOURCE_ID = "detour-route-line-secondary";
const ROUTE_SECONDARY_LAYER_ID = "detour-route-line-secondary";
const ROUTE_SECONDARY_COLOR = "#6b93b0";

// Base network layer, author-selected via internalPanel.jsx (replaces the plugin's own
// bbox-fetched layer, see the task file's "Base layer: author-selected DMS layer" section).
// The plugin no longer owns a source/layer for the pickable network - EDGES_LAYER_KEY is the
// plugin-data key the chosen symbology layerKey is stored under, mirroring
// ../routecreation/constants.js's SHAPEFILE_LAYER_KEY.
const EDGES_LAYER_KEY = "conflation_edges";
const BLANK_OPTION = { value: "", name: "" };

const SELECTED_SEGMENT_SOURCE_ID = "detour-selected-segment";
const SELECTED_SEGMENT_LAYER_ID = "detour-selected-segment";

// Hover preview - the nearest pickable segment within CLICK_TOLERANCE_PX of the cursor, shown
// distinct from the SELECTED (red) segment so the user can see what a click would pick before
// committing - picking does not require an exact, fully-zoomed-in click on the thin line.
const HOVER_SEGMENT_SOURCE_ID = "detour-hover-segment";
const HOVER_SEGMENT_LAYER_ID = "detour-hover-segment";

// Screen-pixel tolerance (not a map-distance/zoom-dependent tolerance) for both hover and click -
// queries a small box around the cursor via queryRenderedFeatures instead of relying on exact
// hit-testing against the rendered line's own (thin) stroke width.
const CLICK_TOLERANCE_PX = 8;

const SEGMENT_COLORS = {
  pickable: "#94a3b8",
  hover: "#f59e0b",
  selected: "#dc2626",
};

// The DERIVED trip start/end markers - these are NOT the segment's own endpoints, they're the
// nearest OTHER node to each of the segment's endpoints, excluding the segment's own
// from_node/to_node (see comp.jsx's findNearestOtherNode usage). Plain green/red dots, no text
// labels.
const START_END_SOURCE_ID = "detour-start-end-points";
const START_END_LAYER_ID = "detour-start-end-points";

const MARKER_COLORS = {
  start: "#22c55e",
  end: "#ef4444",
};

// Closure coverage / density analysis mode - second "view" within this same plugin,
// toggled via internalPanel.jsx's "Closure density mode" switch. Renders every edge that showed
// up in any of the candidate start x end routes, colored by how many times it was used - a
// congestion-footprint heatmap rather than one trip's detour line.
const DENSITY_SOURCE_ID = "detour-density-heatmap";
const DENSITY_LAYER_ID = "detour-density-heatmap";
const DENSITY_LABEL_LAYER_ID = "detour-density-heatmap-labels";
// Matches the server default (data-types/routing/index.js). 10 previously timed out even inside
// the 90s window, but several real bugs since fixed (same-road budget starvation, start/end
// crossing to the wrong side of the closure) may have reduced wasted work enough to fit now - not
// yet re-verified at this count.
const DENSITY_NUM_CANDIDATES = 10;

// Sequential ramp (one hue, light->dark) from the dataviz skill's reference palette -
// `references/palette.md`'s "Sequential hue" table, not eyeballed. Used as a MapLibre `step`
// expression keyed on each edge's `count` property. Widened from an earlier, closer-together set
// of steps (100/200/350/500/650) to bigger perceptual jumps between adjacent buckets
// (100/300/450/600/700) - same validated table, further-apart rows picked deliberately for
// bucket-to-bucket contrast (consecutive close-together steps read as visually indistinguishable).
const DENSITY_COLOR_RAMP = [
  "#cde2fb", // 100 - lightest, lowest count
  "#6da7ec", // 300
  "#2a78d6", // 450
  "#184f95", // 600
  "#0d366b", // 700 - darkest, highest count
];

// Fraction of maxCount at which each DENSITY_COLOR_RAMP bucket starts (index 0 is implicitly "0").
// Shared between useClosureDensityLayer.js's `step` paint expression and ClosureDensityPanel.jsx's
// legend so the legend's printed numeric ranges always match what's actually drawn on the map.
const DENSITY_STEP_FRACTIONS = [0, 0.2, 0.4, 0.6, 0.8];

// Turns DENSITY_STEP_FRACTIONS into the 4 non-zero bucket-boundary counts actually used by BOTH
// the map layer's `step` paint expression and the panel's legend. A plain
// `Math.round(maxCount * fraction)` can collapse several fractions to the SAME integer at a
// low maxCount (a real case: maxCount=2 produced [1,1,1,2]) - MapLibre's `step` expression
// requires STRICTLY increasing stops and silently drops the whole paint update if they aren't
// (no thrown error, so the map just quietly stopped coloring the heatmap). Forcing each stop to be
// at least 1 more than the previous one fixes both the map paint AND keeps the legend's printed
// ranges honestly matching what's drawn, since both read this same function.
const computeDensityStops = (maxCount) => {
  let lastStop = 0;
  return DENSITY_STEP_FRACTIONS.slice(1).map((frac) => {
    lastStop = Math.max(lastStop + 1, Math.round(maxCount * frac));
    return lastStop;
  });
};

// Candidate start/end points BFS-picked for the density analysis - small toggleable dots,
// separate from the heatmap lines. Reuses MARKER_COLORS' green/red start/end convention.
const DENSITY_CANDIDATES_SOURCE_ID = "detour-density-candidates";
const DENSITY_CANDIDATES_LAYER_ID = "detour-density-candidates";

export {
  ROUTE_SOURCE_ID,
  ROUTE_LAYER_ID,
  ROUTE_GLOW_LAYER_ID,
  ROUTE_COLOR,
  ROUTE_SECONDARY_SOURCE_ID,
  ROUTE_SECONDARY_LAYER_ID,
  ROUTE_SECONDARY_COLOR,
  EDGES_LAYER_KEY,
  BLANK_OPTION,
  SELECTED_SEGMENT_SOURCE_ID,
  SELECTED_SEGMENT_LAYER_ID,
  HOVER_SEGMENT_SOURCE_ID,
  HOVER_SEGMENT_LAYER_ID,
  CLICK_TOLERANCE_PX,
  SEGMENT_COLORS,
  START_END_SOURCE_ID,
  START_END_LAYER_ID,
  MARKER_COLORS,
  DENSITY_SOURCE_ID,
  DENSITY_LAYER_ID,
  DENSITY_LABEL_LAYER_ID,
  DENSITY_NUM_CANDIDATES,
  DENSITY_COLOR_RAMP,
  DENSITY_STEP_FRACTIONS,
  computeDensityStops,
  DENSITY_CANDIDATES_SOURCE_ID,
  DENSITY_CANDIDATES_LAYER_ID,
};
