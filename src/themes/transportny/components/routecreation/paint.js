import { NETWORK_COLOR } from "./constants";

// Network grey, from npmrds-route-creation.html (routes-reports-users-mesh.md, Workstream E) -
// dataUpdate.jsx's `case` expression overrides this per-feature once a route/hover exists;
// this is the base color a shapefile layer with no plugin state at all falls back to.
// Widened at the working zoom levels (13/18) so segments are easier to click, per
// the route-creation-tool findings ("thin lines are hard to hit" -
// guidance-layer-findings.md Tier 3 #13/paint.js gap). Left alone at zoom 0 - that's
// the whole-Northeast overview zoom, not a zoom level anyone clicks segments at.
const WIDTH_STOPS = [
  [0, { major: 0.5, minor: 0 }],
  [13, { major: 2.5, minor: 1.8 }],
  [18, { major: 11, minor: 7 }],
];

// Per-zoom-stop road-classification width, as a pure per-feature (zoom-free) data
// expression - safe to nest inside a zoom stop's value, or inside a `case` that's
// itself nested inside a zoom stop's value (see buildLineWidth below).
const widthAtStop = ({ major, minor }) => ["match", ["get", "n"], [1, 2], major, minor];

export const npmrdsLineWidth = [
  "interpolate", ["linear"], ["zoom"],
  ...WIDTH_STOPS.flatMap(([zoom, stop]) => [zoom, widthAtStop(stop)]),
];

// The brand blue used for a selected route (ROUTE_COLOR, #1F3F8F) reads as fairly dark
// against this dark basemap - barely more contrast than the network grey at the same
// width (user report, 2026-09-03: "the blue effect on the active TMCs was too
// subtle"). ROUTE_COLOR itself is shared with ~10 Tailwind arbitrary-value classes in
// routecreation.theme.js (the panel's brand-blue chrome, deliberately kept in sync per
// paint.js/constants.js's existing comment) so it isn't the thing to change here -
// widening the line instead makes a selected/hovered segment visually pop without
// touching what "route blue" means anywhere else.
export const SELECTED_LINE_WIDTH_MULTIPLIER = 1.6;

// Builds a full `line-width` expression that boosts every zoom stop's width for
// features matched by `isSelectedExpr` (a per-feature data expression - e.g.
// dataUpdate.jsx's tmc_array/hoveredTmc check - never a zoom expression itself).
//
// Mapbox/MapLibre style expressions allow only ONE zoom-based step/interpolate in a
// whole expression tree - wrapping a `case`/`*` AROUND `npmrdsLineWidth` (an earlier
// version of this code did exactly that) nests a SECOND one and MapLibre logs
// "Only one zoom-based step or interpolate subexpression may be used in an
// expression" and drops the paint update entirely (confirmed live 2026-09-03, firing
// on every hover). The fix is structural, not cosmetic: keep the single
// interpolate(zoom) as the OUTERMOST expression, exactly like npmrdsLineWidth already
// does for the `n` road-classification match, and nest the selection `case` inside
// each zoom stop's value instead of outside the whole interpolate.
export const buildLineWidth = (isSelectedExpr) => [
  "interpolate", ["linear"], ["zoom"],
  ...WIDTH_STOPS.flatMap(([zoom, stop]) => [
    zoom,
    ["case", isSelectedExpr, ["*", SELECTED_LINE_WIDTH_MULTIPLIER, widthAtStop(stop)], widthAtStop(stop)],
  ]),
];

export const npmrdsPaint = {
  'line-color': NETWORK_COLOR,
  'line-width': npmrdsLineWidth,
  'line-opacity': [
    "case",
    ["boolean", ["feature-state", "hover"], false],
    0.4,
    1
  ],
  'line-offset': {
    base: 1.5,
    stops: [[5, 0], [9, 1], [15, 3], [18, 7]]
  }
}
