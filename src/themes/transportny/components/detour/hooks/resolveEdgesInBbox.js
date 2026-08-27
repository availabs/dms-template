// Detour plugin's segment-picker data source (see planning/transportny/tasks/current/
// detour-avoid-segment-routing-plugin.md).
//
// Contract: GET {API_HOST}/dama-admin/{pgEnv}/routing/edges?conflation_view_id=&bbox=minLon,minLat,maxLon,maxLat
//   -> { ok, result: { edges: GeoJSON.Feature[] } } | { ok: false, error }
// Viewport-scoped and capped server-side (EDGES_QUERY_LIMIT) - never the whole network. This is a
// shared backend route (data-types/routing/index.js) but the fetch boundary itself is this
// plugin's own, not imported from ../../routing.
const API_HOST = import.meta.env.VITE_API_HOST || "https://dmsserver.availabs.org";

export async function resolveEdgesInBbox(bbox, conflation_view_id, pgEnv) {
  const params = new URLSearchParams({ conflation_view_id, bbox: bbox.join(",") });
  const res = await fetch(`${API_HOST}/dama-admin/${pgEnv}/routing/edges?${params}`);
  const { ok, result, error } = await res.json();
  if (!ok) throw new Error(error || "Failed to load edges");
  return result.edges;
}
