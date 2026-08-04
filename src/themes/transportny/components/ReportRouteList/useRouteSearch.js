import { useEffect, useRef, useState } from 'react';
import { buildUdaConfig } from '../../../../dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/buildUdaConfig';

const RECENT_LIMIT = 8;
const SEARCH_LIMIT = 20;
const SEARCH_MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

// Fetches route-catalog rows for the inline "Add a route" box: either the most
// recently created routes (empty search term) or a name-match search (>= 2
// chars). Modeled on `ReportRouteList.jsx`'s existing `fetchDynamicRoute` —
// explicit `attributes` + `columnsToFetch`-keyed unwrap — NOT on
// `RouteComparison.jsx`'s `buildCatalogRequest`, which uses the bare-`data`
// fallback shape and never gets a row's real `id` back. This hook's results
// feed straight into `addRoute`/`sameRoute` (ReportRouteList.jsx), which key
// off `id`, not the legacy `route_id`.
async function fetchCatalogRows({ apiLoad, routeSourceInfo, isSearch, term, limit }) {
  const columns = [
    ...routeSourceInfo.columns.map((c) =>
      !isSearch && c.name === 'created_at' ? { ...c, show: true, sort: 'desc' } : { ...c, show: true }
    ),
    { name: 'id', systemCol: true, show: true },
  ];

  const udaConfig = buildUdaConfig({
    externalSource: routeSourceInfo,
    columns,
    filters: isSearch
      ? { op: 'AND', groups: [{ col: 'name', op: 'like', value: term }] }
      // A small number of legacy catalog rows (~26 of 64.8k, confirmed live via dbq) have no
      // `created_at` at all. Postgres sorts NULLs FIRST on a plain `ORDER BY ... DESC`, which
      // would otherwise bubble those undated legacy rows to the top of "recently created" —
      // confirmed live (the recent list showed obviously-old test routes before this filter was
      // added). Excluding them is correct, not a workaround: a route with no creation timestamp
      // genuinely isn't orderable by recency.
      : { op: 'AND', groups: [{ col: 'created_at', op: 'notempty' }] },
  });

  const config = {
    format: { ...routeSourceInfo },
    children: [
      {
        action: 'uda',
        path: '/',
        filter: {
          fromIndex: 0,
          toIndex: Math.max(0, limit - 1),
          options: JSON.stringify(udaConfig.options),
          attributes: udaConfig.attributes,
        },
        params: {},
      },
    ],
  };

  const data = await apiLoad(config, '/');
  return (data || [])
    .map((rawRow) =>
      udaConfig.columnsToFetch.reduce((acc, col) => {
        const v = rawRow[col.reqName];
        acc[col.name] = v && typeof v === 'object' && '$type' in v ? v.value : v;
        return acc;
      }, {})
    )
    .filter((row) => row.id != null);
}

// Debounced fetcher backing the inline "Add a route" box. An empty
// `searchTerm` loads the catalog's most-recently-created routes (no debounce —
// runs once whenever the source becomes ready or the term is cleared); a term
// of >= SEARCH_MIN_CHARS debounces DEBOUNCE_MS then does a server-side name
// search. A 1-character term shows nothing (not enough to search, but not
// "empty" either) rather than flashing the recent list under a half-typed query.
export function useRouteSearch({ apiLoad, routeSourceInfo, enabled, searchTerm }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestIdRef = useRef(0);
  const sourceId = routeSourceInfo?.source_id;
  const viewId = routeSourceInfo?.view_id;

  useEffect(() => {
    if (!enabled || !apiLoad || !routeSourceInfo?.columns) return;
    const term = (searchTerm || '').trim();
    const isSearch = term.length >= SEARCH_MIN_CHARS;

    if (term.length > 0 && !isSearch) {
      setResults([]);
      setLoading(false);
      setError('');
      return;
    }

    const requestId = ++requestIdRef.current;
    const handle = setTimeout(
      async () => {
        setLoading(true);
        setError('');
        try {
          const rows = await fetchCatalogRows({
            apiLoad,
            routeSourceInfo,
            isSearch,
            term,
            limit: isSearch ? SEARCH_LIMIT : RECENT_LIMIT,
          });
          if (requestIdRef.current !== requestId) return; // superseded by a newer request
          setResults(rows);
        } catch (e) {
          if (requestIdRef.current !== requestId) return;
          console.error('<ReportRouteList:useRouteSearch>', e);
          setError('Could not load routes.');
          setResults([]);
        } finally {
          if (requestIdRef.current === requestId) setLoading(false);
        }
      },
      isSearch ? DEBOUNCE_MS : 0
    );
    return () => clearTimeout(handle);
    // routeSourceInfo itself isn't a dep — it's read via closure inside the timeout, and its
    // reference changes every render; only its stable identity (source/view id) should
    // retrigger this effect, matching useReportRow.js's own load-effect dependency convention.
  }, [enabled, apiLoad, sourceId, viewId, searchTerm]);

  return { results, loading, error };
}
