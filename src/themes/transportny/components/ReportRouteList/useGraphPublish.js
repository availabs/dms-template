import { useEffect, useMemo } from 'react';
import { isEqual } from 'lodash-es';
import { SELF_PARAM_KEY_SENTINEL, selfParamKey } from '../../../../dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/buildUdaConfig';
import { generateDateRange, generateEpochRange } from './utils';

function transformReportRoutes(routes) {
  if (!routes || routes.length < 1) {
    return;
  }

  return routes
    .map(route => {
      // `null` (not `[]`) distinguishes "no known TMCs yet" (an unfilled Dynamic Report
      // slot, or a genuinely malformed tmc_array) from "resolved to zero TMCs" — both are
      // filtered out below, before an empty-value `tmc` filter leaf can ever reach
      // buildUdaConfig.js. That guard (mapFilterGroupCols) drops any filter/exclude leaf
      // whose value list is empty *by design*, so the query WIDENS to "no constraint"
      // instead of matching nothing — exactly backwards for a route with no TMCs, which
      // must contribute no data at all. Publishing this route anyway used to run a full,
      // unfiltered, network-wide query mislabeled with the route's name/color — found live
      // 2026-08-03 while investigating a Dynamic Report slot with no resolved route.
      let parsedTmcArray = null;
      if (route.tmc_array) {
        try {
          parsedTmcArray = JSON.parse(route.tmc_array);
        } catch (e) {
          console.error(`Failed to parse tmc_array for route ${route.name ?? route.id ?? route.route_id}:`, e);
        }
      }
      return { route, parsedTmcArray };
    })
    .filter(({ parsedTmcArray }) => Array.isArray(parsedTmcArray) && parsedTmcArray.length > 0)
    .map(({ route, parsedTmcArray }) => {
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

// Sections whose `element-type` (the ComponentRegistry key — see section.jsx's
// RegisteredComponents lookup) identifies them as a hero-stat Card rather than a
// real data/graph section. Anything else self-bound (currently only "AVL Graph")
// gets the "Graph" label — the generic default so a future self-bindable section
// type reads as data unless it's specifically a Callout Stat.
const STAT_ELEMENT_TYPES = new Set(['Card']);

// Finds sibling page sections carrying an enabled `comparison_series` subscriber
// wired to the `$self` sentinel (see `buildUdaConfig.js`) — i.e. graphs (or hero
// stats) ready to receive a per-instance route list. Each match's own key is
// derived from its own section id via `selfParamKey`, so publishing needs no
// author-typed param key. Ordinal labels number only the discovered sections of
// the SAME kind, not their position among all sections, so a report mixing
// graphs and stats gets "Graph 1", "Stat 1", "Graph 2" rather than "Graph 1",
// "Graph 3" (gaps) or a single shared counter that conflates the two kinds.
function findSelfBoundGraphs(sectionList) {
  const counts = {};
  return (sectionList || [])
    .map((section) => {
      // NOT `section?.id == null` — a section optimistically pushed into `draft_sections`
      // (Add-Graph modal, useAddGraphSection.js) carries a real `trackingId` immediately but no
      // `id` until the create round-trip's later revalidate lands; gating discovery on `id`
      // makes a freshly-created graph briefly invisible here, which then races with
      // `knownSectionIds` below into a spurious "orphan" strip of the routes just assigned to it.
      // trackingId (this component's own stable identity, always minted client-side at creation —
      // see sectionArray.jsx's save()) is sufficient on its own.
      if (section?.trackingId == null && section?.id == null) return null;
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
      const kind = STAT_ELEMENT_TYPES.has(section?.element?.['element-type']) ? 'Stat' : 'Graph';
      // Prefer trackingId (stable across publish) over the DB row id (reminted on
      // every publish — see the draft/published section-identity task notes) —
      // must match usePageFilterSync's own trackingId-first resolution exactly, or
      // this discovery and the graph's own self-key diverge.
      return { sectionId: String(section.trackingId || section.id), kind };
    })
    .filter(Boolean)
    .map((g) => {
      counts[g.kind] = (counts[g.kind] || 0) + 1;
      return { ...g, paramKey: selfParamKey(g.sectionId), label: `${g.kind} ${counts[g.kind]}` };
    });
}

// Discovers sibling graph sections and publishes each one's assigned route subset to
// its own self-derived action-param key; also strips a route's `graphIds` entries
// once their graph section is genuinely removed from the page (not merely disabled).
// `persistRoutes` is passed in from `useReportRow` rather than owned here — this hook
// only decides WHAT the cleaned routes should look like, the row-storage hook still
// owns how a write actually happens.
// `isEdit` here means only "is the page open at /edit/..." (drives `sectionsKey` — which
// sections array sibling graphs actually render from right now). `canMutate` is the
// narrower "AND this section's own edit pencil is open" gate (see ReportRouteList.jsx) —
// used only for the orphan-cleanup effect's write, since discovering/publishing to sibling
// graphs must keep working regardless of whether RRL's own pencil has been clicked.
export function useGraphPublish({ item, isEdit, canMutate, apiUpdate, routes, reportRow, persistRoutes, pageState, setActionParam, clearActionParam }) {
  const sectionsKey = isEdit ? 'draft_sections' : 'sections';
  const sectionList = item?.[sectionsKey] || EMPTY_SECTIONS;
  const graphs = useMemo(() => findSelfBoundGraphs(sectionList), [sectionList]);
  // Must derive from the identical trackingId-first fallback findSelfBoundGraphs uses —
  // graphIds are stored using that same value (see toggleRouteGraph in useReportRow),
  // so comparing against plain DB ids here would treat every trackingId-identified
  // graph as unknown and immediately strip it right back out (this is what caused the
  // toggle-then-revert bug found live 2026-07-06). Same `trackingId ?? id` gate as
  // findSelfBoundGraphs above (not `id != null` alone) — see that function's comment for why a
  // freshly-created, not-yet-real-id section must still count as known.
  const knownSectionIds = useMemo(() => new Set(sectionList.map((s) => (s?.trackingId != null || s?.id != null) ? String(s.trackingId || s.id) : null).filter(Boolean)), [sectionList]);

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
    // canMutate guard (this section's own edit pencil must be open, not just the page
    // being on /edit/...) is redundant with persistRoutes' own guard (defense in depth) —
    // kept here too so this effect never even computes/attempts a cleanup write while
    // the panel isn't in its own edit mode, where knownSectionIds could reflect a
    // different id set than whatever graphIds were captured against during editing.
    if (!canMutate || !apiUpdate || !item?.id || !sectionList.length || !reportRow) return;
    const needsCleanup = routes.some(r => (r.graphIds || []).some(id => !knownSectionIds.has(id)));
    if (!needsCleanup) return;
    const cleaned = routes.map(r => {
      if (!r.graphIds?.length) return r;
      const filtered = r.graphIds.filter(id => knownSectionIds.has(id));
      return filtered.length === r.graphIds.length ? r : { ...r, graphIds: filtered };
    });
    persistRoutes(cleaned);
  }, [canMutate, routes, knownSectionIds, sectionList.length, reportRow]);

  return { graphs };
}
