// Segment-identity resolver (2026-09-02 fix - see data-types/routing/index.js's
// resolveEdgeBetweenPoints for the full writeup): the author-selected base network layer can be
// ANY year's tiled layer, but the backend always routes against ONE hardcoded conflation table
// set. `ogc_fid` is a per-import serial PK, not stable across years, so the raw feature id from
// whatever layer is currently displayed cannot be trusted as an identifier into the backend's
// live table - it silently landed on a totally unrelated segment.
//
// Snaps the clicked segment's own START and END coordinates to nodes in the backend's live table
// and requires a real edge connecting them. That validates actual network topology, not just
// proximity, and cleanly detects the case where the segment doesn't exist in the same shape in
// the live conflation table at all (`exactMatch: false`).
//
// Contract: POST {API_HOST}/dama-admin/{pgEnv}/routing/trsp-memory-resolve-edge
//   body { start: {lon,lat}, end: {lon,lat} } (the clicked segment's own first/last coordinates)
//   -> { ok, result: { ogc_fid, exactMatch, startNode, endNode, distanceM? } } | { ok: false, error }
const API_HOST = import.meta.env.VITE_API_HOST || "https://dmsserver.availabs.org";

export async function resolveEdgeAtPoint({ start, end }, pgEnv) {
  const res = await fetch(`${API_HOST}/dama-admin/${pgEnv}/routing/trsp-memory-resolve-edge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start, end }),
  });
  const { ok, result, error } = await res.json();
  if (!ok) throw new Error(error || "Failed to resolve this segment against the current routing data");
  return result;
}
