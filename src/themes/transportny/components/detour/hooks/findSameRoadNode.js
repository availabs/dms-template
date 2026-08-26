// Plain helper (no React) for comp.jsx's endpoint-picker walk - picks the next node to move to,
// and detects real intersections.
//
// Branch detection is PURE TOPOLOGY - just the count of distinct edges (by `ogc_fid`) touching a
// node - not `osm` way id, not `highway` type (2026-08-25, after both of those broke: highway-type
// matching failed on same-tagged interchange ramps; `osm` way id matching then failed too, once a
// live check of the actual data showed a single physical motorway can legitimately continue under
// a DIFFERENT `osm` way id with zero real intersection there - "you can only take the ogc_fid
// here"). A node with exactly one viable next edge is always just a pass-through, whatever tags or
// way ids are involved; two or more means a real fork exists, regardless of what any of them are
// tagged as. `osm` is still used (as a soft preference, not a branch signal) to choose WHICH edge
// to continue onto when there's no fork.
//
// Simplified 2026-08-25 ("expand the road from the end and start of the selected segment, in both
// dir - if for any dir you find the incoming branch or road, pick the next immediate node and stop
// that dir... it's simple, not that complex"): a single linear walk per side (no branching tree, no
// real-routing-API verification) that stops ONE hop past the first node with a real fork - not at
// the branch node itself, one step beyond it - or at a dead end if no branch is ever found.
// General-purpose, not highway-specific - nothing here special-cases any road class.
const bearing = ([lon1, lat1], [lon2, lat2]) => Math.atan2(lon2 - lon1, lat2 - lat1);
const angleDiff = (a, b) => {
  const d = Math.abs(a - b) % (2 * Math.PI);
  return d > Math.PI ? 2 * Math.PI - d : d;
};

const touchesNode = (edge, nodeId) =>
  String(edge.properties.from_node) === String(nodeId) || String(edge.properties.to_node) === String(nodeId);

// The node at the OTHER end of `edge` from `nodeId`, with its own coordinate.
const otherEnd = (edge, nodeId) => {
  const { from_node, to_node } = edge.properties;
  if (String(from_node) === String(nodeId)) {
    return { id: to_node, lon: edge.geometry.coordinates.at(-1)[0], lat: edge.geometry.coordinates.at(-1)[1] };
  }
  return { id: from_node, lon: edge.geometry.coordinates[0][0], lat: edge.geometry.coordinates[0][1] };
};

// Every edge at `nodeId` that's a real candidate to move onto next - touches the node, isn't the
// edge just arrived on, and doesn't lead straight back to `prevNodeId`. Shared by `pickNextNode`
// and `hasIncomingBranch` below so both read the exact same edge set.
function candidateEdges(edges, nodeId, prevNodeId, excludeEdgeOgcFid) {
  return edges.filter((e) =>
    touchesNode(e, nodeId) &&
    String(e.properties.ogc_fid) !== String(excludeEdgeOgcFid) &&
    String(otherEnd(e, nodeId).id) !== String(prevNodeId)
  );
}

// Picks the single best next node from `nodeId`: prefers an edge on the SAME `wayOsm` (the road
// currently being walked); if the way doesn't continue here (it ends, or splits onto a
// differently-numbered way at this node), falls back to the straightest-continuation edge among
// ALL other candidates - so the walk always makes forward progress. Returns null only when nothing
// at all continues forward (a genuine dead end).
function pickNextNode(touching, nodeId, incomingBearing, wayOsm) {
  if (!touching.length) return null;
  const sameWay = touching.filter((e) => String(e.properties.osm) === String(wayOsm));
  const pool = sameWay.length ? sameWay : touching;

  let best = null, bestDiff = Infinity;
  for (const e of pool) {
    const end = otherEnd(e, nodeId);
    const outFrom = String(e.properties.from_node) === String(nodeId) ? e.geometry.coordinates[0] : e.geometry.coordinates.at(-1);
    const diff = angleDiff(bearing(outFrom, [end.lon, end.lat]), incomingBearing);
    if (diff < bestDiff) { bestDiff = diff; best = { ...end, edgeOgcFid: e.properties.ogc_fid, osm: e.properties.osm }; }
  }
  return best;
}

// Does `nodeId` have a real fork - MORE THAN ONE viable next edge (`touching`, already excludes
// the arrival edge and the straight-back edge) - regardless of `osm`/`highway` tags. Exactly one
// viable edge is always just the road continuing, whatever it's tagged as; two or more is a
// genuine junction. The walk (comp.jsx) uses this to decide whether to stop after ONE more hop.
function hasIncomingBranch(touching) {
  return touching.length > 1;
}

export { candidateEdges, pickNextNode, hasIncomingBranch };
