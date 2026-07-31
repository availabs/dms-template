import { useEffect, useRef, useState } from 'react';
import { buildUdaConfig } from '../../../../dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/buildUdaConfig';

const RECENT_LIMIT = 8;
const SEARCH_LIMIT = 20;
const TAG_BROWSE_LIMIT = 200;
const SEARCH_MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

// Same shape as ReportRouteList/useRouteSearch.js's fetchCatalogRows (explicit `attributes` +
// `columnsToFetch`-keyed unwrap, so a row's real `id` comes back) — generalized to accept
// arbitrary AND-composed filterGroups, since this hook serves four views (recent, name search,
// browse-by-tag, name-search-within-tag) instead of just two.
async function fetchCatalogRows({ apiLoad, routeSourceInfo, filterGroups, sort, limit }) {
  const columns = [
    // The routes catalog join-source binding (`routeSourceInfo`, see ReportRouteList.jsx's
    // comment on it) snapshots its column list at author-configure time and never refreshes —
    // the Report Page template (and every report already created from it) was last configured
    // before the `tags` column existed on the source, so `routeSourceInfo.columns` doesn't
    // include it even though the live source does (confirmed live: a stale 11-column snapshot
    // vs. the source's real 12). Force the correct definition in explicitly rather than trusting
    // the snapshot, so tag filtering works on every report regardless of when its join was last
    // configured — dropping any stale/absent `tags` entry from the snapshot first.
    ...routeSourceInfo.columns
      .filter((c) => c.name !== 'tags')
      .map((c) => (sort && c.name === sort.col ? { ...c, show: true, sort: sort.dir } : { ...c, show: true })),
    { name: 'tags', type: 'multiselect', options: null, show: true },
    { name: 'id', systemCol: true, show: true },
  ];

  const udaConfig = buildUdaConfig({
    externalSource: routeSourceInfo,
    columns,
    filters: { op: 'AND', groups: filterGroups },
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

// Debounced fetcher backing the tag-browser modal's route list, across its four views:
//   - root, no search term: most-recently-created routes (mirrors the old inline "Add a route" box)
//   - root, name search (>= 2 chars): name-match search, unscoped
//   - a tag folder selected (`tagValue`), no search term: every route carrying that exact tag
//     (`array_contains` — the proven, indexed-filter WHERE clause), sorted by name for stable browsing
//   - a tag folder selected + name search: both combined (AND)
//   - the free-text "Other tags" view (`tagLikeTerm`): a substring `like` match against the raw
//     `tags` JSON text — a heuristic (matches within the serialized array, not an exact tag-value
//     match), acceptable for `project:`/custom tags which have no fixed enumerable vocabulary
export function useTagBrowser({ apiLoad, routeSourceInfo, enabled, searchTerm, tagValue, tagLikeTerm }) {
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

    const filterGroups = [];
    if (tagValue) filterGroups.push({ col: 'tags', op: 'filter', value: [tagValue] });
    else if (tagLikeTerm) filterGroups.push({ col: 'tags', op: 'like', value: tagLikeTerm });
    else if (!isSearch) filterGroups.push({ col: 'created_at', op: 'notempty' });
    if (isSearch) filterGroups.push({ col: 'name', op: 'like', value: term });

    const sort = tagValue || tagLikeTerm
      ? { col: 'name', dir: 'asc' }
      : (!isSearch ? { col: 'created_at', dir: 'desc' } : null);

    const limit = tagValue || tagLikeTerm ? TAG_BROWSE_LIMIT : (isSearch ? SEARCH_LIMIT : RECENT_LIMIT);

    const requestId = ++requestIdRef.current;
    const handle = setTimeout(
      async () => {
        setLoading(true);
        setError('');
        try {
          const rows = await fetchCatalogRows({ apiLoad, routeSourceInfo, filterGroups, sort, limit });
          if (requestIdRef.current !== requestId) return; // superseded by a newer request
          setResults(rows);
        } catch (e) {
          if (requestIdRef.current !== requestId) return;
          console.error('<RouteTagBrowserModal:useTagBrowser>', e);
          setError('Could not load routes.');
          setResults([]);
        } finally {
          if (requestIdRef.current === requestId) setLoading(false);
        }
      },
      isSearch ? DEBOUNCE_MS : 0
    );
    return () => clearTimeout(handle);
    // routeSourceInfo itself isn't a dep — same convention as useRouteSearch.js: only its stable
    // identity (source/view id) should retrigger this effect, read via closure inside the timeout.
  }, [enabled, apiLoad, sourceId, viewId, searchTerm, tagValue, tagLikeTerm]);

  return { results, loading, error };
}
