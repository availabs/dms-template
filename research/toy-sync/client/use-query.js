import { useState, useEffect, useRef, useCallback } from 'react';
import { exec } from './db-client.js';
import { onInvalidate } from './sync-manager.js';

export function useQuery(sql, params = [], deps = []) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const sqlRef = useRef(sql);
  const paramsRef = useRef(params);

  sqlRef.current = sql;
  paramsRef.current = params;

  const runQuery = useCallback(async () => {
    try {
      const result = await exec(sqlRef.current, paramsRef.current);
      if (mountedRef.current) {
        setData(result.rows);
        setLoading(false);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message);
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    runQuery();

    // Subscribe to invalidations
    const unsub = onInvalidate((scope) => {
      // For the toy, always re-query on any invalidation
      runQuery();
    });

    return () => {
      mountedRef.current = false;
      unsub();
    };
  }, deps);

  return { data, loading, error, refetch: runQuery };
}
