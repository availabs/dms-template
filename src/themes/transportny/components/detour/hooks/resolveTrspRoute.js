// Detour plugin's own boundary for the routing backend - kept as its own copy, not shared with
// ../../routing/hooks/resolveTrspRoute.js (explicit user instruction: keep the two plugins fully
// independent).
//
// Contract: POST {API_HOST}/dama-admin/{pgEnv}/routing/trsp-memory
//   body { source: {lon,lat}, destination: {lon,lat}, excluded_edge_ids?, algorithm? }
//   (conflation table is a hardcoded server-side constant, 2026-09-02 - see
//   data-types/routing/memoryGraph.js)
//   -> { ok, result: { routes: { shortest: {feature,segments}, fastest: {feature,segments} } } }
//      | { ok: false, error }
// excluded_edge_ids (ogc_fid values) forces the search to route around those edges AND their
// reverse-direction counterpart (handled server-side, see data-types/routing/memoryGraph.js's
// findRoute) - the whole reason this plugin exists.
// algorithm ("dijkstra" | "bidirectional", optional, server defaults to "dijkstra" if omitted) -
// see useTrspRoute.js for the distance-based choice; this file just passes whatever it's given.
const API_HOST = import.meta.env.VITE_API_HOST || "https://dmsserver.availabs.org";

export async function resolveTrspRoute(source, destination, pgEnv, excludedEdgeIds, algorithm) {
  const res = await fetch(`${API_HOST}/dama-admin/${pgEnv}/routing/trsp-memory`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source, destination,
      ...(excludedEdgeIds?.length ? { excluded_edge_ids: excludedEdgeIds } : {}),
      ...(algorithm ? { algorithm } : {}),
    }),
  });
  const { ok, result, error } = await res.json();
  if (!ok) throw new Error(error || "Routing request failed");
  return result.routes;
}
