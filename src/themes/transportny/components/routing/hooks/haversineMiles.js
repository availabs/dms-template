// Straight-line distance in miles between two {lon,lat} points - used to pick which search
// algorithm to send the backend (see resolveTrspRoute.js), not for anything routing-accuracy-related.
const EARTH_RADIUS_MI = 3958.8;
const toRad = (deg) => (deg * Math.PI) / 180;

export const haversineMiles = (a, b) => {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(h));
};

// Validated in planning/transportny/tasks/current/point-to-point-routing-plugin.md's 20-pair
// benchmark: bidirectional Dijkstra was consistently SLOWER under ~3mi, and only became a real (if
// noisy, modest) win past ~80mi. resolveTrspRoute.js never sent an `algorithm` param at all, so
// every request here silently defaulted to the backend's plain "dijkstra" - fine for short routes,
// slow (~10s+) for long ones. Auto-selecting instead of leaving it manual, same as the sibling
// ../../detour plugin's own copy of this file.
const BIDIRECTIONAL_DISTANCE_THRESHOLD_MI = 80;
export const chooseAlgorithm = (start, end) =>
  haversineMiles(start, end) > BIDIRECTIONAL_DISTANCE_THRESHOLD_MI ? "bidirectional" : "dijkstra";
