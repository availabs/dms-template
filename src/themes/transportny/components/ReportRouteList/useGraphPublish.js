import { useEffect, useMemo } from 'react';
import { isEqual } from 'lodash-es';
import { SELF_PARAM_KEY_SENTINEL, selfParamKey } from '../../../../dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/buildUdaConfig';

function transformReportRoutes(routes) {
  if (!routes || routes.length < 1) {
    return;
  }
  // Helper function to handle YYYY-MM-DD or YYYY-MM-DDTHH:mm strings safely
  function parseYMD(dateStr) {
    if (dateStr.includes('T')) {
      return new Date(dateStr);
    }
    const [year, month, day] = dateStr.split('-');
    // Month is 0-indexed in JS Dates (0 = January)
    return new Date(year, month - 1, day);
  }

  const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  // Helper function to generate an array of 'YYYY-MM-DD' dates. `weekdays` is an
  // optional per-route mask ({monday: true, ..., sunday: false}) — only an explicit
  // `false` excludes a day, so routes without the field keep every day (the shape
  // converted old reports carry; see scripts/convert_old_reports.py). The date
  // filter is already a literal IN-list, so day-of-week exclusion needs no new
  // filter op — masked days are simply never enumerated.
  function generateDateRange(startStr, endStr, weekdays) {
    const startDate = parseYMD(startStr);
    const endDate = parseYMD(endStr);
    const dates = [];

    // Loop day-by-day from start to end
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      if (weekdays && weekdays[DAY_NAMES[d.getDay()]] === false) continue;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
    }
    return dates;
  }

  function timeToEpoch(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 12 + Math.floor(minutes / 5);
  }

  function generateEpochRange(startStr, endStr) {
    const startTime = startStr.includes('T') ? startStr.split('T')[1] : startStr;
    const endTime = endStr.includes('T') ? endStr.split('T')[1] : endStr;

    const startEpoch = timeToEpoch(startTime);
    const endEpoch = timeToEpoch(endTime);

    const epochs = [];
    for (let e = startEpoch; e <= endEpoch; e++) {
      epochs.push(e);
    }
    return epochs;
  }

  return routes.map(route => {
    let parsedTmcArray = [];
    try {
      parsedTmcArray = JSON.parse(route.tmc_array);
    } catch (e) {
      console.error(`Failed to parse tmc_array for route ${route.id ?? route.route_id}:`, e);
    }

    // Generates the range based on your MM-DD-YYYY inputs
    const dateArray = route.startDate && route.endDate ? generateDateRange(route.startDate, route.endDate, route.weekdays) : [];
    const epochArray = (route.startDate && route.endDate && route.startDate.includes('T') && route.endDate.includes('T')) ? generateEpochRange(route.startDate, route.endDate) : [];

    const groups = [
      { op: "filter", col: "tmc", value: parsedTmcArray },
      { op: "filter", col: "date", value: dateArray },
    ];

    if (epochArray.length > 0) {
      groups.push({ op: "filter", col: "epoch", value: epochArray });
    }

    return {
      label: route.name,
      filters: { op: "AND", groups: groups },
      // Rides through resolveComparisonVariants (buildUdaConfig.js) into every assigned
      // graph's state.comparisonSeries.config, consumed there to build colorsByKey — see
      // comparison-series-explicit-color.md.
      ...(route.color ? { color: route.color } : {}),
    };
  });
}

const EMPTY_SECTIONS = [];

// Finds sibling page sections carrying an enabled `comparison_series` subscriber
// wired to the `$self` sentinel (see `buildUdaConfig.js`) — i.e. graphs ready to
// receive a per-instance route list. Each match's own key is derived from its own
// section id via `selfParamKey`, so publishing needs no author-typed param key.
// Ordinal labels number only the discovered graphs, not their position among all
// sections, so interleaved non-graph sections don't create label gaps.
function findSelfBoundGraphs(sectionList) {
  return (sectionList || [])
    .map((section) => {
      if (section?.id == null) return null;
      const elementData = section?.element?.['element-data'];
      if (typeof elementData !== 'string') return null;
      let parsed;
      try {
        parsed = JSON.parse(elementData);
      } catch (e) {
        return null;
      }
      const subscribers = parsed?.display?._functions?.subscribers;
      const sub = Array.isArray(subscribers)
        ? subscribers.find((s) => s?.functionId === 'comparison_series' && s?.enabled && s?.paramKey === SELF_PARAM_KEY_SENTINEL)
        : null;
      if (!sub) return null;
      // Prefer trackingId (stable across publish) over the DB row id (reminted on
      // every publish — see the draft/published section-identity task notes) —
      // must match usePageFilterSync's own trackingId-first resolution exactly, or
      // this discovery and the graph's own self-key diverge.
      return { sectionId: String(section.trackingId || section.id) };
    })
    .filter(Boolean)
    .map((g, i) => ({ ...g, paramKey: selfParamKey(g.sectionId), label: `Graph ${i + 1}` }));
}

// Discovers sibling graph sections and publishes each one's assigned route subset to
// its own self-derived action-param key; also strips a route's `graphIds` entries
// once their graph section is genuinely removed from the page (not merely disabled).
// `persistRoutes` is passed in from `useReportRow` rather than owned here — this hook
// only decides WHAT the cleaned routes should look like, the row-storage hook still
// owns how a write actually happens.
export function useGraphPublish({ item, isEdit, apiUpdate, routes, reportRow, persistRoutes, pageState, setActionParam, clearActionParam }) {
  const sectionsKey = isEdit ? 'draft_sections' : 'sections';
  const sectionList = item?.[sectionsKey] || EMPTY_SECTIONS;
  const graphs = useMemo(() => findSelfBoundGraphs(sectionList), [sectionList]);
  // Must derive from the identical trackingId-first fallback findSelfBoundGraphs uses —
  // graphIds are stored using that same value (see toggleRouteGraph in useReportRow),
  // so comparing against plain DB ids here would treat every trackingId-identified
  // graph as unknown and immediately strip it right back out (this is what caused the
  // toggle-then-revert bug found live 2026-07-06).
  const knownSectionIds = useMemo(() => new Set(sectionList.map((s) => s?.id != null ? String(s.trackingId || s.id) : null).filter(Boolean)), [sectionList]);

  // Publish each discovered graph's filtered route subset to its own self-derived
  // key (see findSelfBoundGraphs/selfParamKey). Each graph's `comparison_series`
  // subscriber reads back the identical key, so no author-typed param key is ever
  // needed. The isEqual guard is load-bearing per key: setActionParam unconditionally
  // writes pageState, which re-renders this component and recomputes `routes`/`graphs`
  // — without the guard that write→re-render cycle never settles (mirrors the same
  // guard in usePageFilterSync's comparison-series resolver).
  useEffect(() => {
    if (!setActionParam) return;
    graphs.forEach(({ sectionId, paramKey }) => {
      const next = transformReportRoutes(routes.filter(r => r.graphIds?.includes(sectionId))) || [];
      // setActionParam stores an already-array value as-is (see its `Array.isArray(value)
      // ? value : [value]` check) — `values` IS the variants list here, not a 1-element
      // wrapper around it. Reading `.values?.[0]` (the single-scalar convention most other
      // providers use) would compare against the first variant instead of the whole list,
      // so isEqual would almost never match and this guard would never actually stop the
      // write→re-render cycle.
      const current = pageState?.filters?.find(f => f.searchKey === paramKey && f.type === 'action')?.values;
      if (isEqual(current, next)) return;
      setActionParam(paramKey, next);
    });

    // Clear any previously-published self-key whose graph is no longer on the page
    // (removed, or its subscriber disabled) — nothing reads it anymore.
    if (!clearActionParam) return;
    const liveParamKeys = new Set(graphs.map(g => g.paramKey));
    (pageState?.filters || [])
      .filter(f => f.type === 'action' && typeof f.searchKey === 'string' && f.searchKey.startsWith('__self__'))
      .forEach(f => {
        if (!liveParamKeys.has(f.searchKey)) clearActionParam(f.searchKey);
      });
  }, [routes, graphs, pageState?.filters, setActionParam, clearActionParam]);

  // Orphan cleanup (v1): once a graph section is actually removed from the page
  // (not merely disabled), strip its id from every route's graphIds so stale
  // membership doesn't silently linger. Guarded on sectionList being non-empty —
  // every report page always has at least this panel's own section, so an empty
  // list means "not loaded yet," not "everything was removed."
  useEffect(() => {
    // isEdit guard is redundant with persistRoutes' own guard (defense in depth) —
    // kept here too so this effect never even computes/attempts a cleanup write
    // while the page is merely being viewed, where knownSectionIds reflects the
    // published sections (a different id set than whatever graphIds were captured
    // against during editing).
    if (!isEdit || !apiUpdate || !item?.id || !sectionList.length || !reportRow) return;
    const needsCleanup = routes.some(r => (r.graphIds || []).some(id => !knownSectionIds.has(id)));
    if (!needsCleanup) return;
    const cleaned = routes.map(r => {
      if (!r.graphIds?.length) return r;
      const filtered = r.graphIds.filter(id => knownSectionIds.has(id));
      return filtered.length === r.graphIds.length ? r : { ...r, graphIds: filtered };
    });
    persistRoutes(cleaned);
  }, [isEdit, routes, knownSectionIds, sectionList.length, reportRow]);

  return { graphs };
}
