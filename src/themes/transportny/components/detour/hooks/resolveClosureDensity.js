// Detour plugin's fetch boundary for the closure-density backend calls, mirroring
// resolveTrspRoute.js's pattern - own copy, not shared with ../../routing.
//
// Split into two calls (2026-08-21 - "can you make 2 api call here first to get points and then
// route the segment dense thing?"): point selection is its own step so candidate markers can show
// up before the (slower) route-tallying step finishes, and so each step's timing is visible
// separately server-side.
const API_HOST = import.meta.env.VITE_API_HOST || "https://dmsserver.availabs.org";

// Step 1/2 - contract: POST {API_HOST}/dama-admin/{pgEnv}/routing/trsp-memory-density-points
//   body { conflation_view_id, ogc_fid, num_candidates?, cost_objective? }
//   -> { ok, result: { startPoints: [{osm_id,lon,lat}], endPoints: [...], candidatesRejected } }
export async function resolveClosureDensityPoints(ogcFid, conflationViewId, pgEnv, numCandidates, costObjective = "distance") {
  const res = await fetch(`${API_HOST}/dama-admin/${pgEnv}/routing/trsp-memory-density-points`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      conflation_view_id: conflationViewId,
      ogc_fid: ogcFid,
      num_candidates: numCandidates,
      cost_objective: costObjective,
    }),
  });
  const { ok, result, error } = await res.json();
  if (!ok) throw new Error(error || "Closure density point-selection request failed");
  return result;
}

// Step 2/2 - contract: POST {API_HOST}/dama-admin/{pgEnv}/routing/trsp-memory-density
//   body { conflation_view_id, ogc_fid, start_node_ids, end_node_ids, cost_objective? }
//   -> { ok, result: { edgeFrequencies: [{ogc_fid,highway,count,geometry}], maxCount,
//        totalPairsComputed, totalPairsFailed } } | { ok: false, error }
export async function resolveClosureDensityRoutes(ogcFid, conflationViewId, pgEnv, startNodeIds, endNodeIds, costObjective = "distance") {
  const res = await fetch(`${API_HOST}/dama-admin/${pgEnv}/routing/trsp-memory-density`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      conflation_view_id: conflationViewId,
      ogc_fid: ogcFid,
      start_node_ids: startNodeIds,
      end_node_ids: endNodeIds,
      cost_objective: costObjective,
    }),
  });
  const { ok, result, error } = await res.json();
  if (!ok) throw new Error(error || "Closure density route-tally request failed");
  return result;
}
