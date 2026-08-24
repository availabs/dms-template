// Plain helper (no React) - given the edges touching a segment's endpoint node, finds the best
// "continue the same road" candidate instead of picking whatever node is merely nearest by raw
// distance (2026-08-20: "one point is near the start/end of selected segment in parallel road...
// high priority must be on the same road point"). Scoring, cheapest-first:
//   1. Same `highway` type as the closed segment (a real, if imperfect, signal it's the same road
//      continuing, not a different street that happens to cross nearby).
//   2. Among same-highway candidates (or if none, among all candidates), the one whose outgoing
//      bearing from the node is closest to the segment's own approach bearing - i.e. the
//      straightest continuation, not a turn onto a cross street of the same road class.
// Returns null if the node has no other connected edges at all (see comp.jsx's fallback for the
// genuinely-disconnected case - a dead-end spur, or an isolated segment).
const bearing = ([lon1, lat1], [lon2, lat2]) => Math.atan2(lon2 - lon1, lat2 - lat1);
const angleDiff = (a, b) => {
  const d = Math.abs(a - b) % (2 * Math.PI);
  return d > Math.PI ? 2 * Math.PI - d : d;
};

export function findSameRoadNode(edges, nodeId, excludeOgcFid, highway, incomingBearing) {
  let best = null;
  let bestScore = Infinity;
  for (const edge of edges) {
    if (String(edge.properties.ogc_fid) === String(excludeOgcFid)) continue;
    const { from_node, to_node } = edge.properties;
    let otherCoord, otherNodeId, outFrom;
    if (String(from_node) === String(nodeId)) {
      outFrom = edge.geometry.coordinates[0];
      otherCoord = edge.geometry.coordinates.at(-1);
      otherNodeId = to_node;
    } else if (String(to_node) === String(nodeId)) {
      outFrom = edge.geometry.coordinates.at(-1);
      otherCoord = edge.geometry.coordinates[0];
      otherNodeId = from_node;
    } else {
      continue; // this edge doesn't touch nodeId
    }

    const sameHighway = edge.properties.highway === highway;
    const outBearing = bearing(outFrom, otherCoord);
    const straightness = angleDiff(outBearing, incomingBearing);
    const score = (sameHighway ? 0 : 1000) + straightness;
    if (score < bestScore) {
      bestScore = score;
      best = { id: otherNodeId, lon: otherCoord[0], lat: otherCoord[1], sameHighway };
    }
  }
  return best;
}
