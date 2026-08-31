import { useCatalogFetch } from '../PickerModal/useCatalogFetch';

const DEFAULT_LIMIT = 60; // an unscoped candidate pool for the client-side score+sort, same
// rationale as RouteTagBrowserModal's DEFAULT_LIMIT — big enough that prominence ranking has a
// real pool to choose from, far short of "the whole catalog."
const SEARCH_LIMIT = 40;
const SEARCH_MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

// Debounced fetcher backing the report picker: a name/description search (like RouteTagBrowser's
// name search) plus whatever facet leaves the caller adds (`extraFilterGroups` — the "mine" and
// "hide incomplete-looking" facet chips). No tag/category drill-down here — the report catalog
// doesn't have the routes catalog's county/region/agency taxonomy, so this is a single flat view,
// simpler than useTagBrowser.js. Thin wrapper over the shared `useCatalogFetch`
// (PickerModal/useCatalogFetch.js) — same mechanics as RouteTagBrowserModal's useTagBrowser.js.
export function useReportSearch({ apiLoad, reportSourceInfo, enabled, searchTerm, extraFilterGroups }) {
  const term = (searchTerm || '').trim();
  const isSearch = term.length >= SEARCH_MIN_CHARS;

  const buildQuery = () => {
    if (term.length > 0 && !isSearch) return null; // 1 char typed — not enough yet

    const filterGroups = [{ col: 'name', op: 'notempty' }];
    if (isSearch) {
      filterGroups.push({
        op: 'OR',
        groups: [
          { col: 'name', op: 'like', value: term },
          { col: 'description', op: 'like', value: term },
        ],
      });
    }
    filterGroups.push(...(extraFilterGroups || []));

    const sort = !isSearch ? { col: 'updated_at', dir: 'desc' } : null;
    const limit = isSearch ? SEARCH_LIMIT : DEFAULT_LIMIT;

    return { filterGroups, sort, limit, debounce: isSearch ? DEBOUNCE_MS : 0 };
  };

  return useCatalogFetch({
    apiLoad,
    sourceInfo: reportSourceInfo,
    enabled,
    buildQuery,
    deps: [searchTerm, JSON.stringify(extraFilterGroups || [])],
  });
}
