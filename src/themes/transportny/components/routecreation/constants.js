const INTERNAL_ROUTES_VIEW_ID = 2107427;
const INTERNAL_ROUTES_SOURCE_ID = 2107426;
const INTERNAL_ROUTES_TYPE = 'routes_data';
const srcAttr = ["app", "name", "config", "default_columns"];
const SHAPEFILE_LAYER_KEY = "npmrds_shapefile";
const BLANK_OPTION = { value: "", name: "" };

const PAGE_FILTER_KEY = 'route_id';

const CREATION_MODES = {
  TMC_CLICKS: "tmc-clicks",
  MARKERS: "markers",
};
const DEFAULT_CREATION_MODE = CREATION_MODES.TMC_CLICKS;

// Waypoint marker gradient, first -> last, mirrors the old tool
// (RouteCreationLayer.jsx COLORS: green -> yellow -> red by sequence position).
const MARKER_GRADIENT_COLORS = ["#1a9641", "#ffffbf", "#d7191c"];

// Placeholder until Phase 3's year selector lands (routecreation-marker-placement-autorouting.md).
// NOT 2026 - directly tested 2026-07-23 against routing2.availabs.org and it returns {err:{}}
// for real points. Only 2020-2022 actually resolved in that test; 2016, 2018, 2023-2026 all
// failed. The "2016-2026, no gaps" claim in findings.md Part 6 was based on a DB metadata table
// having a row per year, not on the live routing service actually working for each year - that
// claim is wrong. 2022 is doubly-confirmed (this test + the original findings.md Part 5 replay
// of route 268046), so it's the safest placeholder until Phase 3 does a real per-year check.
const DEFAULT_ROUTING_YEAR = 2022;

export {
  SHAPEFILE_LAYER_KEY,
  BLANK_OPTION,
  INTERNAL_ROUTES_VIEW_ID,
  INTERNAL_ROUTES_SOURCE_ID,
  INTERNAL_ROUTES_TYPE,
  srcAttr,
  PAGE_FILTER_KEY,
  CREATION_MODES,
  DEFAULT_CREATION_MODE,
  MARKER_GRADIENT_COLORS,
  DEFAULT_ROUTING_YEAR,
}
