// Single boundary for calling the turn-restriction-aware routing backend - mirrors
// routecreation/hooks/resolveRoute.js's isolation pattern (one function owns the URL/request/
// response contract, so a future change to the backend is a one-function edit here, not a
// scattered refactor). Backed by the dms-template-native data-types/routing plugin
// (data_manager-role dama-admin route, mounted on dms-server itself - NOT the deprecated
// avail-falcor sibling repo, which only holds the reference implementation this was ported from).
//
// Contract: POST {API_HOST}/dama-admin/{pgEnv}/routing/trsp
//   body { source: {lon,lat}, destination: {lon,lat} }
//   (conflation table is a hardcoded server-side constant - see data-types/routing/memoryGraph.js)
//   -> { ok, result: { routes: { shortest: {feature,segments}, fastest: {feature,segments} } } }
//      | { ok: false, error }
//
// Points at /routing/trsp-memory (in-memory-graph path) rather than /routing/trsp.
//
// No `algorithm: "alt"` override: the ALT/landmark heuristic's cold precompute is too slow for a
// live click and stalls the UI on long routes - see
// planning/transportny/tasks/current/alt-landmark-heuristic-routing.md.
//
// `algorithm` IS sent now (chooseAlgorithm/haversineMiles.js, same auto-select the sibling
// ../../detour plugin already does) - this call previously never sent it at all, silently
// defaulting to the backend's plain "dijkstra" for every request including genuinely long routes,
// which is what made long routes take ~10s+.
//
// The user drops pins at real-world points (usePointPicker.js) - this sends raw lon/lat and lets
// the backend snap server-side to the nearest graph node (data-types/routing/index.js's
// snapToNearestNode). The backend also still accepts {source_node_id, dest_node_id} directly but
// this plugin no longer exercises that path.
//
// "shortest" and "fastest" are two objectives, not true alternates: shortest optimizes distance,
// fastest optimizes a road-class-speed-weighted time estimate - both independently
// turn-restriction-aware.
const API_HOST = import.meta.env.VITE_API_HOST || "https://dmsserver.availabs.org";

export async function resolveTrspRoute(source, destination, pgEnv, algorithm) {
  const res = await fetch(`${API_HOST}/dama-admin/${pgEnv}/routing/trsp-memory`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source, destination, algorithm }),
  });
  const { ok, result, error } = await res.json();
  if (!ok) throw new Error(error || "Routing request failed");
  return result.routes;
}
