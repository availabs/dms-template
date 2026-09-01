import { NETWORK_COLOR } from "./constants";

// Network grey, from npmrds-route-creation.html (routes-reports-users-mesh.md, Workstream E) -
// dataUpdate.jsx's `case` expression overrides this per-feature once a route/hover exists;
// this is the base color a shapefile layer with no plugin state at all falls back to.
export const npmrdsPaint = {
  'line-color': NETWORK_COLOR,
  'line-width': [
    "interpolate",
    ["linear"],
    ["zoom"],
    0,
    [
      "match",
      ["get", "n"],
      [1, 2],
      0.5,
      0
    ],
    13,
    [
      "match",
      ["get", "n"],
      [1, 2],
      1.5,
      1
    ],
    18,
    [
      "match",
      ["get", "n"],
      [1, 2],
      8,
      5
    ]
  ],
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
