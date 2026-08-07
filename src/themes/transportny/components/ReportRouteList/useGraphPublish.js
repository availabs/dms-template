import { useEffect, useMemo } from 'react';
import { isEqual } from 'lodash-es';
import { SELF_PARAM_KEY_SENTINEL, selfParamKey } from '../../../../dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/buildUdaConfig';
import { generateDateRange, generateEpochRange } from './utils';

// Page-wide pageState key RRL broadcasts its route catalog to (see the effect at the bottom of
// this file) — any graph's own QuickControls reads this directly, no second fetch. Exported so
// QuickControls/index.jsx reads the identical key rather than a second, driftable copy.
export const ROUTE_CATALOG_PARAM_KEY = '__report_routes_catalog__';

// Design push #2 (2026-08-06): a route's weekday mask / time-of-day window and its graph
// assignment both moved OFF the route and onto each GRAPH's own `display._measurePick`
// (`weekdays`/`start`/`end`/`routeIds` — see MeasurePicker/composeMeasureConfig.js's
// DEFAULT_PICK and QuickControls/index.jsx). This crosses a graph's own window against each of
// ITS selected routes' own date-span/TMCs, instead of each route supplying an unconditional
// window to every graph it feeds — the same route can now answer two different questions for
// two different cards (e.g. AM Peak weekdays on one graph, PM Peak weekends on another).
function transformReportRoutes(routes, graphWindow) {
  if (!routes || routes.length < 1) {
    return;
  }
  const { weekdays, start, end } = graphWindow || {};

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
      // Generates the range based on the route's own date span, masked by the GRAPH's own
      // weekday selection (not the route's — routes no longer carry one).
      const dateArray = route.startDate && route.endDate ? generateDateRange(route.startDate, route.endDate, weekdays) : [];
      // The GRAPH's own time-of-day window (plain "HH:mm" strings, no date prefix) — independent
      // of the route's date span entirely, unlike the old per-route combined-string mechanism.
      const epochArray = (start && end) ? generateEpochRange(start, end) : [];

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
//
// Design push #2: also pulls `routeIds`/`weekdays`/`start`/`end` out of the SAME parsed
// `display._measurePick` blob already read below for the subscriber check — free, not a
// second parse. An orphaned `routeIds` entry (its route removed from the report) is left
// exactly as-is here; `transformReportRoutes`'s caller below silently drops any id that no
// longer resolves to a real route rather than crashing or rewriting the graph's own stored
// pick — per Ryan, 2026-08-06, a stale id sitting unused in a graph's own state forever is
// not worth building cleanup for.
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
      const pick = parsed?.display?._measurePick || {};
      // Prefer trackingId (stable across publish) over the DB row id (reminted on
      // every publish — see the draft/published section-identity task notes) —
      // must match usePageFilterSync's own trackingId-first resolution exactly, or
      // this discovery and the graph's own self-key diverge.
      return {
        sectionId: String(section.trackingId || section.id),
        kind,
        routeIds: Array.isArray(pick.routeIds) ? pick.routeIds : [],
        weekdays: pick.weekdays || {},
        start: pick.start || '',
        end: pick.end || '',
      };
    })
    .filter(Boolean)
    .map((g) => {
      counts[g.kind] = (counts[g.kind] || 0) + 1;
      return { ...g, paramKey: selfParamKey(g.sectionId), label: `${g.kind} ${counts[g.kind]}` };
    });
}

// Discovers sibling graph sections, publishes each one's own selected+transformed route
// subset to its own self-derived action-param key, and broadcasts the full route catalog to
// one fixed page-wide key every graph's QuickControls reads from. `isEdit` here means only "is
// the page open at /edit/..." (drives `sectionsKey` — which sections array sibling graphs
// actually render from right now).
export function useGraphPublish({ item, isEdit, routes, pageState, setActionParam, clearActionParam }) {
  const sectionsKey = isEdit ? 'draft_sections' : 'sections';
  const sectionList = item?.[sectionsKey] || EMPTY_SECTIONS;
  const graphs = useMemo(() => findSelfBoundGraphs(sectionList), [sectionList]);

  // Publish each discovered graph's own selected+transformed route subset to its own
  // self-derived key (see findSelfBoundGraphs/selfParamKey). Each graph's `comparison_series`
  // subscriber reads back the identical key, so no author-typed param key is ever needed. The
  // isEqual guard is load-bearing per key: setActionParam unconditionally writes pageState,
  // which re-renders this component and recomputes `routes`/`graphs` — without the guard that
  // write→re-render cycle never settles (mirrors the same guard in usePageFilterSync's
  // comparison-series resolver).
  useEffect(() => {
    if (!setActionParam) return;
    // A merged route entry (converter-route-comp-redesign.md — several old comps sharing the
    // same routeId+calendar dates collapsed into one entry) carries `route_comp_ids`, the FULL
    // list of every comp id it absorbed — each graph's own `_measurePick.routeIds` was frozen at
    // conversion time against the ORIGINAL per-comp ids, so a graph fed by a since-merged-away
    // comp must still resolve to the one entry that now represents it. Falls back to the single
    // `route_comp_id` for any entry with no `route_comp_ids` (every entry from before this fix,
    // and every never-merged entry) — same result as before, not a behavior change there.
    const routesByCompId = new Map();
    routes.forEach((r) => {
      const ids = Array.isArray(r.route_comp_ids) && r.route_comp_ids.length ? r.route_comp_ids : [r.route_comp_id];
      ids.forEach((id) => { if (id != null) routesByCompId.set(id, r); });
    });
    graphs.forEach(({ sectionId, paramKey, routeIds, weekdays, start, end }) => {
      // A `routeIds` entry whose route was removed from the report simply resolves to nothing
      // here and is silently dropped — no cleanup effect, no rewrite of the graph's own stored
      // pick (see findSelfBoundGraphs's comment above).
      const selectedRoutes = (routeIds || []).map((id) => routesByCompId.get(id)).filter(Boolean);
      const next = transformReportRoutes(selectedRoutes, { weekdays, start, end }) || [];
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

  // RRL is the only reader of `reports_snap_2` — every graph's own QuickControls Routes pill
  // needs the same catalog (id/name/colour/TMCs/date-span) to offer a picker, without a second
  // fetch. Broadcasts via the same generic setActionParam mechanism used per-graph above
  // (confirmed generic, not filter-specific — view.jsx/edit/index.jsx). Runs unconditionally
  // (same as the per-graph publish effect above), not gated on edit mode — harmless to publish
  // in view mode too, and simpler than adding a second gate.
  useEffect(() => {
    if (!setActionParam) return;
    const catalog = routes.map((r) => ({
      route_comp_id: r.route_comp_id,
      name: r.name,
      color: r.color,
      startDate: r.startDate,
      endDate: r.endDate,
      tmc_array: r.tmc_array,
    }));
    const current = pageState?.filters?.find(f => f.searchKey === ROUTE_CATALOG_PARAM_KEY && f.type === 'action')?.values;
    if (isEqual(current, catalog)) return;
    setActionParam(ROUTE_CATALOG_PARAM_KEY, catalog);
  }, [routes, pageState?.filters, setActionParam]);

  return { graphs };
}
