import { useCallback, useRef, useState } from "react";
import { resolveClosureDensityPoints, resolveClosureDensityRoutes } from "./resolveClosureDensity";
import { DENSITY_NUM_CANDIDATES } from "../constants";

// Fetch lifecycle for the closure coverage / density analysis mode - own state, mirrors
// useTrspRoute.js's shape but for the two-step aggregated backend calls (2026-08-21: points
// first, then route tallying - see resolveClosureDensity.js) instead of a per-direction route
// pair. `density` is built up progressively so consumers (useDensityCandidatesLayer,
// useClosureDensityLayer, ClosureDensityPanel) don't need to know which step is done - after step
// 1 it's `{ startPoints, endPoints, candidatesRejected }`, after step 2 it also has
// `{ edgeFrequencies, maxCount, totalPairsComputed, totalPairsFailed }`.
export const useClosureDensity = (conflationViewId, pgEnv) => {
  const [density, setDensity] = useState(null);
  const [loading, setLoading] = useState(false);
  // Two-phase status (2026-08-21: "let route mapping in process" - candidate points can already
  // be visible on the map while the route tally is still running, so a single generic "Analyzing"
  // message no longer reflects what's actually happening). "points" | "routes" | null.
  const [phase, setPhase] = useState(null);
  const [error, setError] = useState(null);

  const requestIdRef = useRef(0);

  const analyze = useCallback((ogcFid) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setPhase("points");
    setError(null);
    setDensity(null);

    resolveClosureDensityPoints(ogcFid, conflationViewId, pgEnv, DENSITY_NUM_CANDIDATES)
      .then((pointsResult) => {
        if (requestIdRef.current !== requestId) return;
        setDensity(pointsResult); // candidate markers can render now, before the tally finishes
        setPhase("routes");
        const startNodeIds = pointsResult.startPoints.map((p) => p.osm_id);
        const endNodeIds = pointsResult.endPoints.map((p) => p.osm_id);
        if (!startNodeIds.length || !endNodeIds.length) {
          throw new Error("No valid candidate points found for this segment.");
        }
        return resolveClosureDensityRoutes(ogcFid, conflationViewId, pgEnv, startNodeIds, endNodeIds).then((tallyResult) => {
          if (requestIdRef.current !== requestId) return;
          setDensity((prev) => ({ ...prev, ...tallyResult }));
          setPhase(null);
          setLoading(false);
        });
      })
      .catch((err) => {
        if (requestIdRef.current !== requestId) return;
        setError(err.message || "Failed to analyze closure coverage.");
        setDensity(null);
        setPhase(null);
        setLoading(false);
      });
  }, [conflationViewId, pgEnv]);

  const reset = useCallback(() => {
    requestIdRef.current++;
    setDensity(null);
    setPhase(null);
    setError(null);
    setLoading(false);
  }, []);

  return { density, loading, phase, error, analyze, reset };
};
