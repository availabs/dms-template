import { useCallback, useEffect, useState } from "react";
import { resolveTrspRoute } from "./resolveTrspRoute";

// Testing-only (2026-08-21): once both a start and end candidate point are picked (via
// useDensityPointPicker), fetches the actual route between them - reuses the existing single-trip
// resolver (resolveTrspRoute) with the closed segment excluded, same as single-trip mode's own
// route computation. Lets someone spot-check an individual OD pair from the density analysis
// rather than only seeing the aggregated heatmap.
export const usePickedPairRoute = (conflationViewId, pgEnv, excludedOgcFid) => {
  const [pickedStart, setPickedStart] = useState(null);
  const [pickedEnd, setPickedEnd] = useState(null);
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const pick = useCallback((point, role) => {
    if (role === "start") setPickedStart(point);
    else if (role === "end") setPickedEnd(point);
  }, []);

  const clear = useCallback(() => {
    setPickedStart(null);
    setPickedEnd(null);
    setRoute(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!pickedStart || !pickedEnd || !excludedOgcFid) {
      setRoute(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    resolveTrspRoute(pickedStart, pickedEnd, conflationViewId, pgEnv, [excludedOgcFid])
      .then((routes) => {
        if (cancelled) return;
        setRoute(routes);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || "Failed to compute route for this pair.");
        setRoute(null);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [pickedStart, pickedEnd, conflationViewId, pgEnv, excludedOgcFid]);

  return { pickedStart, pickedEnd, route, loading, error, pick, clear };
};
