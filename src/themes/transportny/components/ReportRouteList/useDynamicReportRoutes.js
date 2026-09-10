import { useEffect, useRef, useState } from 'react';
import { fetchCatalogRows } from '../PickerModal/fetchCatalogRows';

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

// Merges one slot with its resolved real catalog row — the exact `{...slot, ...catalogRow, ...}`
// shape `resolvedRoutes` below needs. Exported so ReportRouteList.jsx's static<->dynamic
// conversion (dynamic-reports-authoring-gaps.md sub-item 4) can build this same shape itself, off
// catalog rows it already has in hand (from `RouteTagBrowserModal`'s own onConfirm, or from this
// hook's own `resolvedGroupRoutes`), instead of round-tripping through a URL navigation + a second
// fetchCatalogRows call just to get back to a shape it could've built directly.
export function mergeSlotWithCatalogRow(slot, catalogRow) {
  if (!slot || !catalogRow) return null;
  return {
    ...slot,
    ...catalogRow,
    route_comp_id: slot.route_comp_id,
    color: slot.color,
    name: slot.name,
    // The resolved catalog row's OWN name — see resolvedRoutes' own comment below for why this
    // stays a separate field from `name`.
    catalogRouteName: catalogRow.name,
  };
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
  // `name` is always the slot's own authored name, verbatim — never overwritten here. A slot whose
  // name contains the `%n`/`%y` template tokens (handleAddRouteSlot's default, or any deliberate
  // authoring choice) gets those substituted for the resolved route's real name/year downstream, in
  // `resolvedRouteLabel` (relativeDateResolution.js) — the one place both the header's routes
  // disclosure and the chart legend read a slot's display name from, so they can't disagree.
  // Retired 2026-09-05: this used to special-case an `isPlaceholderName` flag to fully replace a
  // never-renamed slot's name with the bare catalog name; the `%n`/`%y` mechanism is strictly more
  // general (an author can mix template tokens with literal text, e.g. "%n (%y)") and needs no
  // separate boolean — the tokens' presence in the string is the whole signal.
  const groups = distinctRouteSlotGroups(slots);
  const resolvedRoutes = !enabled ? [] : (slots || [])
    .map((slot) => {
      const groupIndex = groups.indexOf(routeSlotGroupKey(slot));
      const id = groupIndex >= 0 ? routeIds?.[groupIndex] : null;
      const catalogRow = id != null ? catalogRowsById.get(String(id)) : null;
      return mergeSlotWithCatalogRow(slot, catalogRow);
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
