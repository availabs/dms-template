// Plain helper (no React) - given a target [lon, lat] and a node id to exclude (the segment's own
// endpoint), finds the geometrically nearest OTHER node. Squared-degree distance is fine at this
// scale (small bbox, comparison only, no real-world distance needed).
export function findNearestOtherNode(nodes, [lon, lat], excludeId) {
  let best = null;
  let bestDist = Infinity;
  for (const n of nodes) {
    if (String(n.id) === String(excludeId)) continue;
    const dLon = n.lon - lon, dLat = n.lat - lat;
    const d = dLon * dLon + dLat * dLat;
    if (d < bestDist) { bestDist = d; best = n; }
  }
  return best;
}
