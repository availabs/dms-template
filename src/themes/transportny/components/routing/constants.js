// v1 has no multi-year/multi-source picker (see planning/transportny/tasks/current/
// point-to-point-routing-plugin.md, Scope) - hardcode the conflation view this plugin routes
// against, mirroring routecreation/constants.js's DEFAULT_ROUTING_YEAR placeholder pattern.
// view_id=3608 (verified 2026-08-12) went stale when the conflation pipeline was reprocessed on
// 2026-08-17; that reprocess also had a real data gap (zero nodes near Albany - see the task
// file's "conflation reprocess" note). view_id=3689 (the first replacement) inherited that gap.
// 3692 (verified 2026-08-17) was confirmed fixed and used throughout Stage A's build/verification.
// 3699 (source_id 2125, current, given by the user 2026-08-18 via
// https://www.devtny.org/datasources/source/2125/map/3699) is confirmed healthy - live-verified:
// 5,308,351 nodes, 218,934 near Albany. This id WILL go stale again on the next reprocess; no
// mechanism yet survives that automatically - re-verify node count + Albany coverage before
// trusting a future replacement id.
//
// 2026-09-01: a "no hardcoded view id, resolve by source+version server-side" refactor was tried
// and then explicitly reverted by the user ("api taking a lot of time" after switching to 2025
// data - reverted back to the known-good 2024 view/id below rather than debug 2025 performance
// mid-session). If a future 2025 migration is attempted again, see git history around this date
// for the resolveConflationTables approach that was reverted.
const DEFAULT_CONFLATION_VIEW_ID = 3699;

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
  DEFAULT_CONFLATION_VIEW_ID,
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
