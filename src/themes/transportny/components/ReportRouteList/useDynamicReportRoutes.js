import { useEffect, useRef, useState } from 'react';
import { fetchCatalogRows } from '../RouteTagBrowserModal/fetchCatalogRows';

// A Dynamic Report's persisted `routes` (from useReportRow) are SLOT PLACEHOLDERS — each carries
// a stable route_comp_id/graphIds/color (assigned once, at authoring time, via the same
// addRoutes/toggleRouteGraph flow a normal report uses) but no concrete tmc_array/dates. This hook
// resolves those slots against the REAL route ids supplied via the page's `routeSlots`-typed URL
// param, at VIEW TIME ONLY — never persisted, a pure in-memory overlay recomputed on every
// navigation. Positional: routeIds[i] fills slots[i], mirroring the old tool's own comp-N ↔
// real-route-id resolution (see dynamic-reports-and-route-tags.md item 3).
//
// `id`-filtering against the catalog works because fetchCatalogRows.js already declares `id` as a
// systemCol column on every call — buildUdaConfig.js's attributeAccessorStr returns the bare
// column name (not a `data->>` accessor) for a systemCol, and mapFilterGroupCols resolves a filter
// leaf's `col` against exactly that columns list — confirmed by reading, not assumed.
export function useDynamicReportRoutes({ apiLoad, routeSourceInfo, slots, routeIds, enabled }) {
  const [catalogRowsById, setCatalogRowsById] = useState(new Map());
  const [isResolving, setIsResolving] = useState(false);
  const requestIdRef = useRef(0);
  const idsKey = (routeIds || []).join(',');

  useEffect(() => {
    if (!enabled || !apiLoad || !routeSourceInfo?.columns || !routeIds?.length) {
      setCatalogRowsById(new Map());
      return;
    }
    const requestId = ++requestIdRef.current;
    setIsResolving(true);
    fetchCatalogRows({
      apiLoad,
      routeSourceInfo,
      filterGroups: [{ col: 'id', op: 'filter', value: routeIds }],
      limit: routeIds.length,
    })
      .then((rows) => {
        if (requestIdRef.current !== requestId) return; // superseded by a newer navigation
        setCatalogRowsById(new Map(rows.map((r) => [String(r.id), r])));
      })
      .catch((e) => {
        if (requestIdRef.current !== requestId) return;
        console.error('<ReportRouteList:useDynamicReportRoutes>', e);
        setCatalogRowsById(new Map());
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setIsResolving(false);
      });
    // routeSourceInfo itself isn't a dep — same convention as useTagBrowser.js: only its stable
    // identity (source/view id) should retrigger this effect.
  }, [enabled, apiLoad, routeSourceInfo?.source_id, routeSourceInfo?.view_id, idsKey]);

  // Concrete fields (name/tmc_array/dates/...) come from the resolved catalog row; identity and
  // authoring fields (route_comp_id/graphIds/color) stay from the slot regardless of which real
  // route fills it, so graph assignments made once at authoring time keep working no matter who's
  // viewing or which route the URL currently supplies.
  const resolvedRoutes = !enabled ? [] : (routeIds || [])
    .map((id, i) => {
      const catalogRow = catalogRowsById.get(String(id));
      const slot = slots?.[i];
      if (!catalogRow || !slot) return null;
      return { ...slot, ...catalogRow, route_comp_id: slot.route_comp_id, graphIds: slot.graphIds, color: slot.color };
    })
    .filter(Boolean);

  return { resolvedRoutes, isResolving };
}
