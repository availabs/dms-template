// 2026-09-02: conflation table resolution moved to a single hardcoded set of 2025 table names in
// data-types/routing/memoryGraph.js (CONFLATION_TABLE/NODES_TABLE/EDGES_TABLE/RELATIONS_TABLE) -
// per explicit user instruction to manage this backend-only, without a `data_manager.views` DB
// lookup at all. This plugin no longer knows or sends a view id; see
// data-types/routing/memoryGraph.js for the current table names.

// Two independently-computed route variants (shortest-by-distance, fastest-by-time), each its
// own separate map source/layer so both can render at once - the selected one bold, the other
// dimmed, swappable by clicking either card in the details panel.
const ROUTE_SOURCE_ID = "trsp-routing-line";
const ROUTE_LAYER_ID = "trsp-routing-line";
const ROUTE_GLOW_LAYER_ID = "trsp-routing-line-glow";
const ROUTE_SECONDARY_SOURCE_ID = "trsp-routing-line-secondary";
const ROUTE_SECONDARY_LAYER_ID = "trsp-routing-line-secondary";

const ROUTE_VARIANT_COLORS = {
  primary: "#e8a33d",
  secondary: "#6b93b0",
};

const MARKER_COLORS = {
  source: "#5fd68a",
  destination: "#e8546a",
  unselected: "#93a4b8",
};

// Phase 8 source/destination pins - a plain GeoJSON circle+label layer, not a DOM-based
// mapboxgl.Marker (tried first; its DOM element existed and was confirmed in the document, but
// never rendered visibly in this MapEditor host page - not fully root-caused, likely a host-page
// CSS conflict. A canvas-rendered layer is the same primitive useRouteLayer.js already proves
// works in this exact context, so it sidesteps that whole class of bug).
const POINTS_SOURCE_ID = "trsp-point-picker";
const POINTS_LAYER_ID = "trsp-point-picker";
const POINTS_LABEL_LAYER_ID = "trsp-point-picker-label";

export {
  ROUTE_SOURCE_ID,
  ROUTE_LAYER_ID,
  ROUTE_GLOW_LAYER_ID,
  ROUTE_SECONDARY_SOURCE_ID,
  ROUTE_SECONDARY_LAYER_ID,
  ROUTE_VARIANT_COLORS,
  MARKER_COLORS,
  POINTS_SOURCE_ID,
  POINTS_LAYER_ID,
  POINTS_LABEL_LAYER_ID,
};
