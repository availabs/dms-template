import { useEffect, useRef, useState } from 'react';
import { fetchCatalogRows } from './fetchCatalogRows';

const RECENT_LIMIT = 8;
const SEARCH_LIMIT = 20;
const TAG_BROWSE_LIMIT = 200;
const SEARCH_MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

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
