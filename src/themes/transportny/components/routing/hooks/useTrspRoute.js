import { useCallback, useRef, useState } from "react";
import { resolveTrspRoute } from "./resolveTrspRoute";

// Owns the backend call + both route variants (shortest/fastest), fired explicitly by the "Get
// Route" button (not automatically on point selection - see comp.jsx). `selectedVariant` is
// which one is currently "primary" (bold on the map, shown first in the panel) - the user can
// swap it by clicking either card, same as picking between Google Maps' route options.
export const useTrspRoute = (conflationViewId, pgEnv) => {
  const [routes, setRoutes] = useState(null); // { shortest, fastest } | null
  const [selectedVariant, setSelectedVariant] = useState("shortest");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // A slower in-flight request finishing after a newer one must not clobber it.
  const requestIdRef = useRef(0);

  const getRoute = useCallback((source, destination) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    resolveTrspRoute(source, destination, conflationViewId, pgEnv)
      .then((r) => {
        if (requestIdRef.current !== requestId) return;
        setRoutes(r);
        setSelectedVariant("shortest");
        setLoading(false);
      })
      .catch((err) => {
        if (requestIdRef.current !== requestId) return;
        setError(err.message || String(err));
        setRoutes(null);
        setLoading(false);
      });
  }, [conflationViewId, pgEnv]);

  const reset = useCallback(() => {
    requestIdRef.current++; // invalidate any in-flight request
    setRoutes(null);
    setSelectedVariant("shortest");
    setError(null);
    setLoading(false);
  }, []);

  return { routes, selectedVariant, setSelectedVariant, loading, error, getRoute, reset };
};
