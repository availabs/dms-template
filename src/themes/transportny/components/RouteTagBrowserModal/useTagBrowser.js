import { useCatalogFetch } from '../PickerModal/useCatalogFetch';
import { FRAGMENT_RANK_SORT_COLUMN, ROAD_CLASS_RANK_SORT_COLUMN } from './routeScore';

const DEFAULT_LIMIT = 60; // raised from the old RECENT_LIMIT=8 (2026-08-25, prominence-sort work):
// a client-side score re-sort (see routeScore.js) needs a real candidate pool to choose from —
// the 8 most-recently-created routes were never guaranteed to include the most PROMINENT ones
// (an old curated I-87 pair, for instance). Still far short of TAG_BROWSE_LIMIT's 200; the
// unscoped root view stays a "recent-ish sample," not a full catalog scan.
const SEARCH_LIMIT = 40; // was 20 — same rationale, a name search now re-sorts its matches by
// score too, so it needs more than just the first 20 server-order rows to choose from.
const TAG_BROWSE_LIMIT = 200;
const SEARCH_MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

// Debounced fetcher backing the tag-browser modal's route list, across its four views:
//   - root, no search term: a same-DEFAULT_LIMIT-sized sample, re-ranked client-side by
//     prominence (routeScore.js) rather than shown in raw created_at order
//   - root, name search (>= 2 chars): name-match search, unscoped, also re-ranked by score
//   - a tag folder selected (`tagValue`), no search term: every route carrying that exact tag
//     (`array_contains` — the proven, indexed-filter WHERE clause), re-ranked by score
//   - a tag folder selected + name search: both combined (AND), re-ranked by score
//   - the free-text "Other tags" view (`tagLikeTerm`): a substring `like` match against the raw
//     `tags` JSON text — a heuristic (matches within the serialized array, not an exact tag-value
//     match), acceptable for `project:`/custom tags which have no fixed enumerable vocabulary
//
// `extraFilterGroups` (2026-08-25): additional AND-composed filter leaves layered onto every
// view — the "mine" / "curated" / "auto-generated" facet chips (RouteTagBrowserModal.jsx builds
// these from its own facet-toggle state and CMSContext's current user; this hook stays generic
// about what they are). Client-side-sourced only where ownership is involved (the id comes from
// CMSContext, not a server-verified auth token — see RouteTagBrowserModal.jsx's own comment).
//
// Thin wrapper over the shared `useCatalogFetch` (PickerModal/useCatalogFetch.js) — this file
// used to own the debounce/stale-request-cancellation logic itself; that mechanics moved to the
// shared hook 2026-08-25 so ReportPickerModal's useReportSearch.js doesn't hand-duplicate it.
// Public signature/behavior here is unchanged except for the added `extraFilterGroups` param.
export function useTagBrowser({ apiLoad, routeSourceInfo, enabled, searchTerm, tagValue, tagLikeTerm, extraFilterGroups }) {
  const term = (searchTerm || '').trim();
  const isSearch = term.length >= SEARCH_MIN_CHARS;

  const buildQuery = () => {
    if (term.length > 0 && !isSearch) return null; // 1 char typed — not enough yet

    const filterGroups = [];
    if (tagValue) filterGroups.push({ col: 'tags', op: 'filter', value: [tagValue] });
    else if (tagLikeTerm) filterGroups.push({ col: 'tags', op: 'like', value: tagLikeTerm });
    else if (!isSearch) filterGroups.push({ col: 'created_at', op: 'notempty' });
    if (isSearch) filterGroups.push({ col: 'name', op: 'like', value: term });
    filterGroups.push(...(extraFilterGroups || []));

    // Plain unscoped search (no tagValue/tagLikeTerm) deliberately does NOT sort by `name` at
    // the SQL level — see the extraColumns comment just below: frag_rank/road_rank need to be
    // the columns actually controlling which rows make the LIMIT cut, and a `name` sort ahead of
    // them in the ORDER BY would fully alphabetize first and reduce them to a same-name tiebreak
    // (almost never reached). The FINAL on-screen order is routeScore()'s job either way (see
    // visibleResults in RouteTagBrowserModal.jsx) — SQL ordering here only has to get the right
    // candidates PAST the limit, not present them in their final order.
    const sort = tagValue || tagLikeTerm
      ? { col: 'name', dir: 'asc' }
      : (!isSearch ? { col: 'created_at', dir: 'desc' } : null);

    const limit = tagValue || tagLikeTerm ? TAG_BROWSE_LIMIT : (isSearch ? SEARCH_LIMIT : DEFAULT_LIMIT);

    // A name search ranks non-fragments, then recognizable-road-class names, first at the SQL
    // level (FRAGMENT_RANK_SORT_COLUMN / ROAD_CLASS_RANK_SORT_COLUMN) — without this, a query
    // that happens to substring-match thousands of raw-id-named legacy rows (two separate real
    // populations found live, see each column's own comment) can fill the whole LIMIT before a
    // real, prominent match ever gets fetched, and no client-side re-sort can recover a
    // candidate that was never fetched at all.
    const extraColumns = isSearch ? [FRAGMENT_RANK_SORT_COLUMN, ROAD_CLASS_RANK_SORT_COLUMN] : [];

    return { filterGroups, sort, limit, debounce: isSearch ? DEBOUNCE_MS : 0, extraColumns };
  };

  return useCatalogFetch({
    apiLoad,
    sourceInfo: routeSourceInfo,
    enabled,
    buildQuery,
    deps: [searchTerm, tagValue, tagLikeTerm, JSON.stringify(extraFilterGroups || [])],
  });
}
