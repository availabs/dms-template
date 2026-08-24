import { useCallback, useRef, useState } from "react";
import { resolveTrspRoute } from "./resolveTrspRoute";

// Detour plugin's own copy of the route-fetch lifecycle - own state, not shared with
// ../../routing/hooks/useTrspRoute.js.
//
// Computes BOTH travel directions through the closed segment (2026-08-19, user's own framing:
// "it can be different for the both ways... explore those all" - a river-crossing analogy for how
// turn restrictions can make the two directions genuinely different routes, not just the same
// route reversed). `routes` shape: { AtoB: {shortest,fastest}|null, BtoA: {shortest,fastest}|null,
// AtoBError, BtoAError } | null, where A=start, B=end as derived in comp.jsx.
//
// 2026-08-20: also fetches the BASELINE ("open," no exclusion) route for the same two directions,
// alongside the closed/detour one - the "closure impact" comparison the panel now shows (distance/
// time/edges, open vs. closed, with the delta). Same shape as `routes`, stored separately as
// `baselineRoutes` so the panel can show both without conflating them.
//
// Direction SELECTION (which of AtoB/BtoA is currently shown) does NOT live here - comp.jsx reads
// it from the shared plugin state (`state.symbology.pluginData.detour.direction`), the same store
// backing this plugin's internalPanel.jsx controls (2026-08-19 follow-up: "use this window to put
// the button for the last both direction stuff"). Keeping one source of truth for that selection.
export const useTrspRoute = (conflationViewId, pgEnv) => {
  const [routes, setRoutes] = useState(null);
  const [baselineRoutes, setBaselineRoutes] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState("shortest"); // "shortest" | "fastest"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const requestIdRef = useRef(0);

  // allSettled, not all() - a real, informative case: one direction can have no viable route
  // (e.g. a one-way restriction makes only one direction routable) while the other does. Losing
  // the working direction because the other failed would hide exactly the asymmetry this feature
  // exists to surface. Used for both the closed (excluded) and open (baseline) fetches below.
  const fetchBothDirections = (start, end, excludedEdgeIds) =>
    Promise.allSettled([
      resolveTrspRoute(start, end, conflationViewId, pgEnv, excludedEdgeIds),
      resolveTrspRoute(end, start, conflationViewId, pgEnv, excludedEdgeIds),
    ]).then(([AtoBResult, BtoAResult]) => ({
      AtoB: AtoBResult.status === "fulfilled" ? AtoBResult.value : null,
      BtoA: BtoAResult.status === "fulfilled" ? BtoAResult.value : null,
      AtoBError: AtoBResult.status === "rejected" ? AtoBResult.reason?.message : null,
      BtoAError: BtoAResult.status === "rejected" ? BtoAResult.reason?.message : null,
    }));

  const getRoute = useCallback((start, end, excludedEdgeIds) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchBothDirections(start, end, excludedEdgeIds), // closed - segment excluded
      fetchBothDirections(start, end, undefined),       // open - baseline, no exclusion
    ]).then(([closed, open]) => {
      if (requestIdRef.current !== requestId) return;
      if (!closed.AtoB && !closed.BtoA) {
        setError(closed.AtoBError || closed.BtoAError || "No route found in either direction");
        setRoutes(null);
        setBaselineRoutes(null);
      } else {
        setRoutes(closed);
        setBaselineRoutes(open);
        setSelectedVariant("shortest");
      }
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conflationViewId, pgEnv]);

  const reset = useCallback(() => {
    requestIdRef.current++;
    setRoutes(null);
    setBaselineRoutes(null);
    setSelectedVariant("shortest");
    setError(null);
    setLoading(false);
  }, []);

  return { routes, baselineRoutes, selectedVariant, setSelectedVariant, loading, error, getRoute, reset };
};
