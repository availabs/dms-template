import { useEffect, useRef, useState } from 'react';
import { fetchCatalogRows } from './fetchCatalogRows';

// Shared debounced-fetch-with-stale-request-cancellation hook behind BOTH picker modals' data
// loading — RouteTagBrowserModal's useTagBrowser.js and ReportPickerModal's useReportSearch.js
// are thin wrappers that compute a `buildQuery()` from their own domain-specific search/facet
// state and hand it to this hook. Extracted 2026-08-25 (npmrds-picker-modals work) so the
// debounce/cancellation mechanics — previously useTagBrowser.js-only — aren't hand-duplicated
// for the new report picker; behavior/shape is unchanged from the original useTagBrowser.js.
//
// `buildQuery()` returns `{ filterGroups, sort, limit, debounce? }` to fetch, or `null` to skip
// fetching entirely (e.g. a free-text view with too few characters typed) — in which case
// `results` is cleared and `loading`/`error` reset.
export function useCatalogFetch({ apiLoad, sourceInfo, enabled, buildQuery, deps = [] }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestIdRef = useRef(0);
  const sourceId = sourceInfo?.source_id;
  const viewId = sourceInfo?.view_id;

  useEffect(() => {
    if (!enabled || !apiLoad || !sourceInfo?.columns) return;
    const query = buildQuery();
    if (!query) {
      setResults([]);
      setLoading(false);
      setError('');
      return;
    }
    const { filterGroups, sort, limit, debounce = 0, extraColumns } = query;
    const requestId = ++requestIdRef.current;
    const handle = setTimeout(
      async () => {
        setLoading(true);
        setError('');
        try {
          const rows = await fetchCatalogRows({ apiLoad, routeSourceInfo: sourceInfo, filterGroups, sort, limit, extraColumns });
          if (requestIdRef.current !== requestId) return; // superseded by a newer request
          setResults(rows);
        } catch (e) {
          if (requestIdRef.current !== requestId) return;
          console.error('<PickerModal:useCatalogFetch>', e);
          setError('Could not load results.');
          setResults([]);
        } finally {
          if (requestIdRef.current === requestId) setLoading(false);
        }
      },
      debounce
    );
    return () => clearTimeout(handle);
    // sourceInfo itself isn't a dep (same convention the original useTagBrowser.js documented)
    // — only its stable identity (source/view id) plus the caller's own `deps` should retrigger
    // this effect; buildQuery is read fresh via closure when the effect actually fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, apiLoad, sourceId, viewId, ...deps]);

  return { results, loading, error };
}
