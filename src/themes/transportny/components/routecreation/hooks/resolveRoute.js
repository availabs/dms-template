// Single boundary for map-matching a sequence of waypoints to a TMC path.
//
// TEMPORARY (see transportNY repo's planning/tasks/current/
// routecreation-marker-placement-autorouting.md, "Sequencing" section, option b): calls
// routing2.availabs.org directly from the client until a dms-server proxy (Phase 1) lands.
// This is the ONLY place in the plugin allowed to know that contract, so swapping to the
// proxy later is a one-function edit here, not a scattered refactor.
//
// Contract confirmed live 2026-07-23 (dms-template research/route-creation/findings.md, Part 5):
// POST https://routing2.availabs.org/route?conflation_map_version={year}_{version}&return_tmcs=1
// body { locations: [{ lat, lon }, ...] } -> { ways: ["<tmc_id>", ...] } or { err: {...} }
const CONFLATION_VERSION = "v0_6_0";

export async function resolveRouteFromPoints(locations, year) {
  if (!Array.isArray(locations) || locations.length < 2) return [];

  const url = `https://routing2.availabs.org/route?conflation_map_version=${year}_${CONFLATION_VERSION}&return_tmcs=1`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locations }),
    });
    const data = await res.json();
    if (data?.err) return [];
    return data?.ways || [];
  } catch (err) {
    console.error("resolveRouteFromPoints failed:", err);
    return [];
  }
}
