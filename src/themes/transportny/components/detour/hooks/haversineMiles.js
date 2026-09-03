// Straight-line distance in miles between two {lon,lat} points - used to pick which search
// algorithm to send the backend (see useTrspRoute.js), not for anything routing-accuracy-related.
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

// Reuses the threshold already validated in
// planning/transportny/tasks/current/point-to-point-routing-plugin.md's 20-pair benchmark for the
// sibling ../../routing plugin: bidirectional Dijkstra was consistently SLOWER under ~3mi, and only
// became a real (if noisy, modest) win past ~80mi. That plugin keeps algorithm choice manual, but a
// single "Get detour" press here fires up to 4 backend requests (AtoB/BtoA x closed/open) each
// computing shortest+fastest, so a bad default algorithm choice is felt 8x per press - worth
// auto-selecting rather than leaving manual.
const BIDIRECTIONAL_DISTANCE_THRESHOLD_MI = 80;
export const chooseAlgorithm = (start, end) =>
  haversineMiles(start, end) > BIDIRECTIONAL_DISTANCE_THRESHOLD_MI ? "bidirectional" : "dijkstra";
