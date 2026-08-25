import { uaCodeToUaName as UA_CODE_TO_NAME} from "./ua_code_to_name";
const REGION_CODE_TO_NAME = {
  1: "Region 1 - Capital District",
  2: "Region 2 - Mohawk Valley",
  3: "Region 3 - Central New York",
  4: "Region 4 - Genesee Valley",
  5: "Region 5 - Western New York",
  6: "Region 6 - Southern Tier/Central New York",
  7: "Region 7 - North Country",
  8: "Region 8 - Hudson Valley",
  9: "Region 9 - Southern Tier",
  10: "Region 10 - Long Island",
  11: "Region 11 - New York City",
};

const PM3_LAYER_KEY = "pm3";
const MPO_LAYER_KEY = "mpo";
const COUNTY_LAYER_KEY = "county";
const REGION_LAYER_KEY = 'region'
const UA_LAYER_KEY = 'ua'

const BLANK_OPTION = { value: "", name: "" };

// ── the worst-N segments overlay (2026-08-17) ────────────────────────────────
// ONE limit for the list AND the map points, because they are ONE query
// (stats.js → fetchWorstSegments): N points on the canvas is N rows in the panel
// by construction, not by two numbers happening to agree. It matters here — the
// worst-N ordering has ties (statewide, ranks 24/25 are both 4.000 on view 3425),
// so two separate round trips would not even return the same 25 segments.
const WORST_SEGMENT_LIMIT = 25;

// The client-side maplibre source/layer the plugin adds for those points. This is
// deliberately NOT a symbology layer: the map draws its network from tiles
// (project_mapeditor_renders_only_from_tiles) and these 25 points are a plain GeoJSON
// overlay added through the plugin's own map handle. The ids are prefixed so they can
// never collide with a symbology layer id.
const WORST_POINTS_SOURCE_ID = "macroview-worst-points";
const WORST_POINTS_LAYER_ID = "macroview-worst-points-circle";

// Circle radius in px at the smallest / largest value in the RETURNED set (not the
// statewide domain) — the worst-N values are always a narrow band, so anchoring the
// ramp to the set is what makes the size difference legible.
const WORST_POINT_RADIUS = { min: 4, max: 16 };

// The four geography families the Geography control offers, in the order they are
// rendered. SMALLEST FAMILY FIRST (measured on view 3425: 11 regions · 21 MPOs ·
// 16 urban areas · 72 counties) so the long county list can't push the other three
// out of sight — which is exactly what happened while the list was flat and capped
// at 60 rows: NY has 62+ counties, so no MPO, urban area or region was EVER visible
// without typing a search term (Alex, 2026-08-17).
const GEOM_FAMILIES = [
  { type: "region_code", label: "Regions" },
  { type: "mpo_name", label: "MPOs" },
  { type: "urban_code", label: "Urban areas" },
  { type: "county", label: "Counties" },
];


// ── URL STATE · the macro view's share contract (2026-08-18) ─────────────────
// The plugin persists its viewer state as PAGE VARIABLES, never by touching
// `useSearchParams` itself (see the warning in ComponentRegistry/map/index.jsx: writing
// the URL from inside the map fights the page's URL ownership and, under React Compiler,
// ping-pongs into a reload loop). These are the searchKeys page 2101931 registers in its
// `filters` array; the plugin READS them off `pageState.filters` and WRITES them through
// `updatePageStateFilters`. Keys are deliberately SHORT and deliberately DISJOINT from
// every column the PM3 layer filters on (`county` · `mpo_name` · `region_code` ·
// `urban_code`) — a collision would make core's own `dataPageFilters` effect try to
// consume them as a map dynamic-filter.
const URL_KEYS = {
  measure: "measure",
  peak: "peak",
  pctl: "pctl",
  thresh: "thresh",
  unit: "unit",
  traffic: "traffic",
  year: "year",
  geo: "geo",
  worst: "worst",
};

// measureFilters key → URL key. Only the controls a viewer can actually reach today are
// here: `fueltype`/`pollutant`/`attributes` belong to measures the pm3 data does not
// compute (emissions, network attributes — MEASURES[...].available === false), so they
// can never be `active` and persisting them would put dead vocabulary in the contract.
// `perMiles` ("sum by") and `risAADT` ("AADT source") do not exist in the code at all.
const URL_CONTROL_KEYS = {
  peakSelector: URL_KEYS.peak,
  percentiles: URL_KEYS.pctl,
  freeflow: URL_KEYS.thresh,
  vehicleHours: URL_KEYS.unit,
  trafficType: URL_KEYS.traffic,
};

// Two controls carry internal values that must NOT go in a URL: `freeflow` is a boolean
// and `vehicleHours` holds the raw column fragments `getMeasure()` composes with. Both get
// a stable readable vocabulary instead, so a shared link never depends on a column name.
const URL_CONTROL_VALUES = {
  freeflow: { true: "freeflow", false: "speed_limit" },
  vehicleHours: {
    all_xdelay_vhrs: "vehicle_hours",
    all_xdelay_phrs: "person_hours",
    xdelay_hrs: "hours",
  },
};

// Geography chips are `{name, value, type}` where `type` is the SOURCE COLUMN. The URL
// carries a short family token instead — `geo=county:ALBANY|||region:8` — and the chip's
// `name` is re-derived from `geomControlOptions` on read, never stored (a stored label
// would go stale the moment the display rule changes, cf. the 2026-08-17 title-casing).
const URL_GEO_TYPES = {
  region_code: "region",
  mpo_name: "mpo",
  urban_code: "ua",
  county: "county",
};

// The only non-default value `worst` can take, so the param reads as a switch.
const URL_WORST_ON = "on";

export {
  REGION_CODE_TO_NAME,
  UA_CODE_TO_NAME,
  GEOM_FAMILIES,
  URL_KEYS,
  URL_CONTROL_KEYS,
  URL_CONTROL_VALUES,
  URL_GEO_TYPES,
  URL_WORST_ON,
  PM3_LAYER_KEY,
  MPO_LAYER_KEY,
  COUNTY_LAYER_KEY,
  REGION_LAYER_KEY,
  UA_LAYER_KEY,
  BLANK_OPTION,
  WORST_SEGMENT_LIMIT,
  WORST_POINTS_SOURCE_ID,
  WORST_POINTS_LAYER_ID,
  WORST_POINT_RADIUS
};

/**
 * The SINGLE-YEAR views a source offers, newest first.
 *
 * The macroview is built for one view per year — that is the shape it reads, with the year carried as
 * the view's `version`. It deliberately does NOT support multi-year views: the map would paint every
 * year's geometry for the same TMC on top of itself, and the plumbing to make that mean something
 * buys nothing.
 *
 * So non-numeric versions are FILTERED OUT, not merely sorted last. Source 2135 carries a union view
 * whose version is "all_years", published for cross-year SQL analysis; it is a legitimate view of the
 * source and must stay one, but it has no place in a year picker. Excluding it also removes a lexical
 * trap — "all_years" > "2025" as strings, so a plain sort would have made it the default year.
 *
 * Ordering matters twice and both consumers must agree, or the label and the loaded view diverge: the
 * Year control renders this list, and `dataUpdate` defaults to the FIRST entry when nothing is
 * selected. That default is therefore always the most recent year.
 */
export const singleYearViewsNewestFirst = (views) =>
  (views || [])
    .map((v) => ({ v, year: Number(String(v?.version ?? v?.label ?? v?.name ?? "").trim()) }))
    .filter(({ year }) => Number.isInteger(year) && year >= 1900 && year <= 2999)
    .sort((a, b) => b.year - a.year)
    .map(({ v }) => v);
