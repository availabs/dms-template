// Detour plugin's endpoint-picker, resolved server-side (2026-08-25 perf) - replaces the old
// per-hop client-side walk (comp.jsx's walkForward, which made one HTTP request per hop and could
// mean hundreds of sequential round trips on a long road) with ONE call to the in-memory graph's
// walkToFirstBranch (data-types/routing/memoryGraph.js), shared with
// selectClosureDensityCandidates's own seeding.
//
// Contract: POST {API_HOST}/dama-admin/{pgEnv}/routing/trsp-memory-detour-endpoints
//   body { conflation_view_id, ogc_fid }
//   -> { ok, result: { start: {lon,lat,osm_id}, end: {lon,lat,osm_id}, timing } } | { ok: false, error }
const API_HOST = import.meta.env.VITE_API_HOST || "https://dmsserver.availabs.org";

export async function resolveDetourEndpoints(ogcFid, conflationViewId, pgEnv) {
  const res = await fetch(`${API_HOST}/dama-admin/${pgEnv}/routing/trsp-memory-detour-endpoints`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conflation_view_id: conflationViewId, ogc_fid: ogcFid }),
  });
  const { ok, result, error } = await res.json();
  if (!ok) throw new Error(error || "Failed to resolve detour endpoints");
  return result;
}
