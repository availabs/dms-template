import { useCallback, useRef, useState } from "react";
import { resolveClosureDensityPoints, resolveClosureDensityRoutes } from "./resolveClosureDensity";
import { DENSITY_NUM_CANDIDATES } from "../constants";

// Session-scoped cache for a finished analysis's full result (points + tally, the GeoJSON-bearing
// shape) - re-analyzing the SAME segment (e.g. the author switches modes and comes back, or
// re-clicks "Analyze coverage" without an intervening "Clear analysis") skips both backend calls
// entirely instead of re-paying the full search cost. Keyed by ogcFid + costObjective so the two
// objectives never collide. sessionStorage (not localStorage) - survives a reload within the same
// tab, cleared with the rest of the session, never leaks across tabs/devices as a stale copy.
const CACHE_PREFIX = "detour-density-cache:";
const cacheKey = (ogcFid, costObjective) => `${CACHE_PREFIX}${ogcFid}:${costObjective}`;
const readCache = (key) => {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // storage unavailable/corrupt - just skip the cache, don't fail analysis over it
  }
};
const writeCache = (key, value) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota exceeded or storage unavailable - the analysis still succeeded, only the cache is lost
  }
};
const clearCache = (key) => {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // no-op
  }
};

// Fetch lifecycle for the closure coverage / density analysis mode - own state, mirrors
// useTrspRoute.js's shape but for the two-step aggregated backend calls (points first, then route
// tallying - see resolveClosureDensity.js) instead of a per-direction route pair. `density` is
// built up progressively so consumers (useDensityCandidatesLayer,
// useClosureDensityLayer, ClosureDensityPanel) don't need to know which step is done - after step
// 1 it's `{ startPoints, endPoints, candidatesRejected }`, after step 2 it also has
// `{ edgeFrequencies, maxCount, totalPairsComputed, totalPairsFailed }`.
export const useClosureDensity = (pgEnv) => {
  const [density, setDensity] = useState(null);
  const [loading, setLoading] = useState(false);
  // Two-phase status: candidate points can already be visible on the map while the route tally is
  // still running, so a single generic "Analyzing" message wouldn't reflect what's actually
  // happening. "points" | "routes" | null.
  const [phase, setPhase] = useState(null);
  const [error, setError] = useState(null);

  const requestIdRef = useRef(0);
  // The segment (+ cost objective) the currently-shown `density` belongs to - reset() needs this
  // to know which cache entry to purge, since it only receives no arguments from the caller.
  const activeCacheKeyRef = useRef(null);
  // Aborts the PREVIOUS request's actual connection (requestIdRef above only stops the client
  // from acting on a stale reply, not the server from computing it) - see task doc's
  // "Concurrency/scalability hardening" for why that mattered under real load.
  const abortControllerRef = useRef(null);

  const analyze = useCallback((ogcFid, costObjective = "distance") => {
    const key = cacheKey(ogcFid, costObjective);
    activeCacheKeyRef.current = key;

    abortControllerRef.current?.abort();

    const cached = readCache(key);
    if (cached) {
      requestIdRef.current++; // invalidate any in-flight request from a previous analyze() call
      setDensity(cached);
      setLoading(false);
      setPhase(null);
      setError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLoading(true);
    setPhase("points");
    setError(null);
    setDensity(null);

    resolveClosureDensityPoints(ogcFid, pgEnv, DENSITY_NUM_CANDIDATES, costObjective, controller.signal)
      .then((pointsResult) => {
        if (requestIdRef.current !== requestId) return;
        setDensity(pointsResult); // candidate markers can render now, before the tally finishes
        setPhase("routes");
        const startNodeIds = pointsResult.startPoints.map((p) => p.osm_id);
        const endNodeIds = pointsResult.endPoints.map((p) => p.osm_id);
        if (!startNodeIds.length || !endNodeIds.length) {
          throw new Error("No valid candidate points found for this segment.");
        }
        return resolveClosureDensityRoutes(ogcFid, pgEnv, startNodeIds, endNodeIds, costObjective, controller.signal).then((tallyResult) => {
          if (requestIdRef.current !== requestId) return;
          const full = { ...pointsResult, ...tallyResult };
          setDensity(full);
          setPhase(null);
          setLoading(false);
          writeCache(key, full); // only cache a genuinely completed analysis, never a partial one
        });
      })
      .catch((err) => {
        if (err.name === "AbortError") return; // superseded by a newer analyze()/reset() - not a real failure
        if (requestIdRef.current !== requestId) return;
        setError(err.message || "Failed to analyze closure coverage.");
        setDensity(null);
        setPhase(null);
        setLoading(false);
      });
  }, [pgEnv]);

  const reset = useCallback(() => {
    requestIdRef.current++;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    if (activeCacheKeyRef.current) clearCache(activeCacheKeyRef.current);
    activeCacheKeyRef.current = null;
    setDensity(null);
    setPhase(null);
    setError(null);
    setLoading(false);
  }, []);

  return { density, loading, phase, error, analyze, reset };
};
