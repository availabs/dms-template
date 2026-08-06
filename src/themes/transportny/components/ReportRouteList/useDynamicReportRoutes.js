import { useEffect, useRef, useState } from 'react';
import { fetchCatalogRows } from '../RouteTagBrowserModal/fetchCatalogRows';

// A Dynamic Report's persisted `routes` (from useReportRow) are SLOT PLACEHOLDERS — each carries
// a stable route_comp_id/color (assigned once, at authoring time, via the same addRoutes flow a
// normal report uses) but no concrete tmc_array/dates. This hook
// resolves those slots against the REAL route ids supplied via the page's `routeSlots`-typed URL
// param, at VIEW TIME ONLY — never persisted, a pure in-memory overlay recomputed on every
// navigation.
//
// Grouped, not raw-positional (2026-08-03): a slot may carry `route_slot_group` when several slot
// ROWS represent different date/settings VIEWS of the same one real route the viewer picks once —
// the old tool's own "1 route, N time windows" shape (e.g. template 244 "Year Over Year": 11 date-
// range comps, all one conceptual route). `routeIds[j]` fills every slot whose group is the j-th
// DISTINCT group value, in first-appearance order among `slots`. A slot with no `route_slot_group`
// falls back to grouping by its own `route_comp_id` (always unique per slot), which reproduces the
// original positional behavior byte-for-byte for every already-shipped single-view Dynamic Report —
// this is a pure extension, not a behavior change, for anything that predates this field.
//
// `id`-filtering against the catalog works because fetchCatalogRows.js already declares `id` as a
// systemCol column on every call — buildUdaConfig.js's attributeAccessorStr returns the bare
// column name (not a `data->>` accessor) for a systemCol, and mapFilterGroupCols resolves a filter
// leaf's `col` against exactly that columns list — confirmed by reading, not assumed.
// A slot's grouping key — exported so ReportRouteList.jsx's requiredCount/needsRouteSelection
// checks use the exact same grouping this hook resolves against, rather than a second, driftable
// copy of the same fallback rule.
export function routeSlotGroupKey(slot) {
  return slot?.route_slot_group ?? slot?.route_comp_id;
}

// Distinct group keys among `slots`, in first-appearance order — the canonical ordering both the
// entry-gate's `?routes=` URL builder and this hook's resolution must agree on.
export function distinctRouteSlotGroups(slots) {
  const seen = [];
  (slots || []).forEach((s) => {
    const key = routeSlotGroupKey(s);
    if (key != null && !seen.includes(key)) seen.push(key);
  });
  return seen;
}

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

  // Concrete fields (tmc_array/dates/...) come from the resolved catalog row; identity and
  // authoring fields (route_comp_id/color) stay from the slot regardless of which real route
  // fills it. Every slot in the same group resolves against the SAME real route (one URL id can
  // fill many date/settings-view rows). Graph assignment is no longer a route-side field at all
  // (design push #2, 2026-08-06 — see useGraphPublish.js) so there's nothing to carry over here
  // anymore.
  //
  // `name` is the one field that does NOT simply take the catalog row's value — only a genuinely
  // meaningless placeholder name should ever be replaced by the resolved route's real name.
  // `isPlaceholderName` (set only by handleAddRouteSlot's auto-generated "Route Slot N" default,
  // cleared the moment a human renames it) marks that one case; everything else — a ported
  // template's descriptive per-comp name (e.g. "2024 - AM Peak - Rochester Inner Loop 2"), or any
  // deliberate rename — is authoritative and must never be silently overwritten by a resolved
  // route's own name, same as a route's name is authoritative everywhere else in this component
  // (see useReportRow.js's rename-collision guard). Found live 2026-08-04: every row of a
  // multi-comp route_slot_group was showing the identical bare catalog name in view mode, erasing
  // the very per-row distinction (date window / peak label) the group's rows exist to carry.
  const groups = distinctRouteSlotGroups(slots);
  const resolvedRoutes = !enabled ? [] : (slots || [])
    .map((slot) => {
      const groupIndex = groups.indexOf(routeSlotGroupKey(slot));
      const id = groupIndex >= 0 ? routeIds?.[groupIndex] : null;
      const catalogRow = id != null ? catalogRowsById.get(String(id)) : null;
      if (!catalogRow || !slot) return null;
      return {
        ...slot,
        ...catalogRow,
        route_comp_id: slot.route_comp_id,
        color: slot.color,
        name: slot.isPlaceholderName ? (catalogRow.name ?? slot.name) : slot.name,
      };
    })
    .filter(Boolean);

  // One catalog row per DISTINCT group that already has a resolved URL id, in group order —
  // deliberately not deduped from `resolvedRoutes` above (which repeats a group's row once per
  // slot sharing it). Used to pre-populate the entry-gate picker when the URL supplies fewer ids
  // than groups require, so the author only picks the still-missing slot(s) instead of the gate
  // discarding what already resolved (dynamic-reports-and-route-tags.md item 3, open question 2b).
  const resolvedGroupRoutes = !enabled ? [] : groups
    .map((_, groupIndex) => {
      const id = routeIds?.[groupIndex];
      return id != null ? catalogRowsById.get(String(id)) : null;
    })
    .filter(Boolean);

  return { resolvedRoutes, isResolving, resolvedGroupRoutes };
}
