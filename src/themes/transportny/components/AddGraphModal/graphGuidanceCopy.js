// Guidance-layer prose for the Add-Graph modal's static preview (see
// research/npmrds-reports/guidance-layer-findings.md — the reports/routes tools have no
// "what is this for" copy anywhere else today). Deliberately NOT added to
// data-types/npmrds_graph_vocabulary/vocabulary.json — that file is a cross-language SQL/
// composition contract shared with the Python converter (convert_old_reports.py), not a UI-copy
// store; these descriptions are only ever read here.

// One sentence per composeMeasureConfig.js MEASURE_OPTIONS key.
export const MEASURE_DESCRIPTIONS = {
  speed: 'Average travel speed across the route, in miles per hour.',
  speedTruck: 'Average truck travel speed across the route, in miles per hour.',
  travelTime: 'Average time to traverse the route, in minutes.',
  hoursOfDelay: 'Total vehicle-hours lost to congestion below free-flow speed.',
  avgHoursOfDelay: 'Average per-day vehicle-hours lost to congestion below free-flow speed.',
  co2Emissions_passenger: 'Total CO2 emitted by passenger vehicles on the route, in tonnes.',
  avgCo2Emissions_passenger: 'Average per-day CO2 emitted by passenger vehicles on the route, in tonnes.',
  co2Emissions_truck: 'Total CO2 emitted by trucks on the route, in tonnes.',
  avgCo2Emissions_truck: 'Average per-day CO2 emitted by trucks on the route, in tonnes.',
};

// One sentence per composeMeasureConfig.js GRAPH_TYPE_OPTIONS key.
export const GRAPH_TYPE_DESCRIPTIONS = {
  BarGraph: 'One bar per time bucket — good for comparing values across routes at a glance.',
  LineGraph: 'A continuous line per route — good for seeing trends over time.',
  GridGraph: 'A heatmap of value by time-of-day and route — good for spotting patterns across many time buckets at once.',
};
