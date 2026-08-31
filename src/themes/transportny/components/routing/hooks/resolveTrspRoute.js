// Single boundary for calling the turn-restriction-aware routing backend - mirrors
// routecreation/hooks/resolveRoute.js's isolation pattern (one function owns the URL/request/
// response contract, so a future change to the backend is a one-function edit here, not a
// scattered refactor). Backed by the dms-template-native data-types/routing plugin
// (data_manager-role dama-admin route, mounted on dms-server itself - NOT the deprecated
// avail-falcor sibling repo, which only holds the reference implementation this was ported from).
//
// Contract: POST {API_HOST}/dama-admin/{pgEnv}/routing/trsp
//   body { conflation_view_id, source: {lon,lat}, destination: {lon,lat} }
//   -> { ok, result: { routes: { shortest: {feature,segments}, fastest: {feature,segments} } } }
//      | { ok: false, error }
//
// TEMPORARY (Phase 11 Stage A live check, 2026-08-18): pointed at /routing/trsp-memory instead of
// /routing/trsp so the in-memory-graph path can be seen on the actual map, not just curl. Revert
// to /trsp (or make this switchable) once Stage A's UI check is done - see
// planning/transportny/tasks/current/point-to-point-routing-plugin.md Phase 11.
//
// ALT ("algorithm: alt") was tried live here 2026-08-19 and reverted immediately - it got the UI
// stuck on a long route (cold landmark precompute is too slow for a live click, see
// planning/transportny/tasks/current/alt-landmark-heuristic-routing.md). Back to no algorithm
// override (defaults to plain dijkstra on the backend).
//
// Location-picking UX (Phase 8): the user drops pins at real-world points (usePointPicker.js) -
// this sends raw lon/lat and lets the backend snap server-side to the nearest graph node
// (data-types/routing/index.js's snapToNearestNode). The backend also still accepts
// {source_node_id, dest_node_id} directly (Phase 6's now-unused path) but this plugin no longer
// exercises that - the node-picker UI it was built for was removed.
//
// Two objectives, not true alternates (Phase 7): "shortest" optimizes distance, "fastest"
// optimizes a road-class-speed-weighted time estimate - both independently turn-restriction-aware.
const API_HOST = import.meta.env.VITE_API_HOST || "https://dmsserver.availabs.org";

export async function resolveTrspRoute(source, destination, conflation_view_id, pgEnv) {
  const res = await fetch(`${API_HOST}/dama-admin/${pgEnv}/routing/trsp-memory`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conflation_view_id, source, destination }),
  });
  const { ok, result, error } = await res.json();
  if (!ok) throw new Error(error || "Routing request failed");
  return result.routes;
}
