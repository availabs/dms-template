import { useEffect, useRef, useState } from 'react';
import { useCatalogFetch } from '../PickerModal/useCatalogFetch';
import { checkIdsExist } from '../../../../dms/packages/dms/src/api';

const DEFAULT_LIMIT = 60; // an unscoped candidate pool for the client-side score+sort, same
// rationale as RouteTagBrowserModal's DEFAULT_LIMIT — big enough that prominence ranking has a
// real pool to choose from, far short of "the whole catalog."
const SEARCH_LIMIT = 40;
const TAG_BROWSE_LIMIT = 200; // matches RouteTagBrowserModal's useTagBrowser.js — a tag-scoped
// view can safely fetch every match (indexed array_contains filter), no client-side re-rank cap
// needed the way the unscoped/search views have.
const SEARCH_MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

// Debounced fetcher backing the report picker: a name/description search (like RouteTagBrowser's
// name search) plus whatever facet leaves the caller adds (`extraFilterGroups` — the "mine" and
// "hide incomplete-looking" facet chips). Round 82 (old-reports-conversion.md, "Round B") added
// `tagValue`/`tagLikeTerm` — the report catalog now shares the SAME agency/county/region tag
// vocabulary routes use (`RouteTagBrowserModal/tagCategories.js`'s `TAG_CATEGORIES`), so this
// hook grew the same category/value-drill-down branches `useTagBrowser.js` already has, rather
// than becoming a second near-duplicate hook (see fetchCatalogRows.js's own comment on why a
// third near-identical copy was avoided there — same reasoning applies here). Both new params
// default to falsy, so every existing caller (the plain flat search view) is unaffected. Thin
// wrapper over the shared `useCatalogFetch` (PickerModal/useCatalogFetch.js) — same mechanics as
// RouteTagBrowserModal's useTagBrowser.js.
export function useReportSearch({ apiLoad, falcor, app, reportSourceInfo, enabled, searchTerm, tagValue, tagLikeTerm, extraFilterGroups }) {
  const term = (searchTerm || '').trim();
  const isSearch = term.length >= SEARCH_MIN_CHARS;

  const buildQuery = () => {
    if (term.length > 0 && !isSearch) return null; // 1 char typed — not enough yet

    // `page_path` op:'notempty' — 2026-08-31 user correction: a legacy `admin2.reports` row
    // that was never rebuilt into a real DMS page is dead weight here (unopenable, and was
    // showing up disguised as a real result — see the root-cause bug this same round fixed in
    // the Python converter's `snap` dict, which never wrote `page_path` on a real conversion
    // either, making a rebuilt report indistinguishable from a legacy one). This REVERSES this
    // modal's original "superset — searches everything, legacy rows shown greyed-out" design
    // (see this file's header comment / ReportPickerModal.jsx's) per explicit direction: legacy
    // rows are excluded everywhere in this modal, not just de-prioritized.
    const filterGroups = [{ col: 'name', op: 'notempty' }, { col: 'page_path', op: 'notempty' }];
    if (tagValue) filterGroups.push({ col: 'tags', op: 'filter', value: [tagValue] });
    else if (tagLikeTerm) filterGroups.push({ col: 'tags', op: 'like', value: tagLikeTerm });
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

    const sort = tagValue || tagLikeTerm
      ? { col: 'name', dir: 'asc' }
      : (!isSearch ? { col: 'updated_at', dir: 'desc' } : null);
    const limit = tagValue || tagLikeTerm ? TAG_BROWSE_LIMIT : (isSearch ? SEARCH_LIMIT : DEFAULT_LIMIT);

    return { filterGroups, sort, limit, debounce: isSearch ? DEBOUNCE_MS : 0 };
  };

  const { results: catalogResults, loading: catalogLoading, error: catalogError } = useCatalogFetch({
    apiLoad,
    sourceInfo: reportSourceInfo,
    enabled,
    buildQuery,
    deps: [searchTerm, tagValue, tagLikeTerm, JSON.stringify(extraFilterGroups || [])],
  });

  // Band-aid safety net (routes-reports-users-mesh.md, 2026-09-01): `reports_snap_2` catalog rows
  // can outlive the page they point at — the generic "Delete Page" admin action doesn't (yet)
  // cascade to this dataset, and past --replace reconversions/dev-DB resets have left similar
  // debris. Rather than trust the catalog alone, batch-check (one extra request per search, not
  // per-row — see checkIdsExist's own comment) which of THIS search's `report_id`s still resolve
  // to a live page, and drop any that don't. Catches an orphan regardless of how it was created —
  // durable even if the `deletePage` cascade hook (tracked separately, not yet built) has a gap.
  const [liveResults, setLiveResults] = useState([]);
  const [checking, setChecking] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (catalogLoading) return; // wait for the underlying catalog fetch to settle first
    const requestId = ++requestIdRef.current;
    const reportIds = [...new Set(catalogResults.map((r) => r.report_id).filter(Boolean))];
    if (!reportIds.length) {
      setLiveResults(catalogResults);
      setChecking(false);
      return;
    }
    setChecking(true);
    checkIdsExist(falcor, app, reportIds)
      .then((existingIds) => {
        if (requestIdRef.current !== requestId) return; // superseded by a newer search
        setLiveResults(catalogResults.filter((r) => existingIds.has(String(r.report_id))));
      })
      .catch((e) => {
        if (requestIdRef.current !== requestId) return;
        console.error('<useReportSearch:liveFilter>', e);
        setLiveResults(catalogResults); // fail open — a transient error shouldn't hide everything
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setChecking(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogResults, catalogLoading, falcor, app]);

  return { results: liveResults, loading: catalogLoading || checking, error: catalogError };
}
