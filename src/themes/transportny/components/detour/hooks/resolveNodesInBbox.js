// Used to find the nearest OTHER node to each of the selected segment's endpoints (see
// comp.jsx's "nearest node that isn't the segment's own endpoint" logic, confirmed with the user
// 2026-08-19) - reuses the routing plugin's backend GET /nodes bbox route (Phase 6 leftover,
// still live) via this plugin's own fetch boundary, not a shared import.
//
// Contract: GET {API_HOST}/dama-admin/{pgEnv}/routing/nodes?conflation_view_id=&bbox=minLon,minLat,maxLon,maxLat
//   -> { ok, result: { nodes: [{id,lon,lat}] } } | { ok: false, error }
const API_HOST = import.meta.env.VITE_API_HOST || "https://dmsserver.availabs.org";

export async function resolveNodesInBbox(bbox, conflation_view_id, pgEnv) {
  const params = new URLSearchParams({ conflation_view_id, bbox: bbox.join(",") });
  const res = await fetch(`${API_HOST}/dama-admin/${pgEnv}/routing/nodes?${params}`);
  const { ok, result, error } = await res.json();
  if (!ok) throw new Error(error || "Failed to load nodes");
  return result.nodes;
}
