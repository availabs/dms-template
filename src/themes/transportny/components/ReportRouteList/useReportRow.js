import { useEffect, useRef, useState } from 'react';
import { cloneDeep } from 'lodash-es';
import { buildUdaConfig } from '../../../../dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/buildUdaConfig';
import { nameToSlug } from '../../../../dms/packages/dms/src/utils/type-utils';
import { getColorRange } from '../../../../dms/packages/dms/src/ui/components/graph_new/colorSchemeUnifier';

// Same palette a graph's own default series colors come from
// (ComponentRegistry/graph_new/config.jsx's `DefaultPalette`) — reused here so a route's
// auto-assigned identity color visually matches the picker's own swatch options and the
// graph's "no explicit color set" default state.
export const ROUTE_COLOR_PALETTE = getColorRange(20, "div7");

function roundToFiveMinutes(dateStr) {
  if (!dateStr || !dateStr.includes('T')) return dateStr;

  const [datePart, timePart] = dateStr.split('T');
  if (!timePart) return dateStr;

  const [hours, minutes] = timePart.split(':').map(Number);
  const roundedMinutes = Math.round(minutes / 5) * 5;

  let finalHours = hours;
  let finalMinutes = roundedMinutes;
  if (finalMinutes >= 60) {
    finalMinutes = 0;
    finalHours = (hours + 1) % 24;
  }

  return `${datePart}T${String(finalHours).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}`;
}

// Stable reference for "no routes yet" — `reportRow?.routes || []` would otherwise
// produce a brand-new array every render, which would re-trigger effects that depend
// on `routes` (the graph-publish effect in useGraphPublish) on every render.
const EMPTY_ROUTES = [];

// The report's routes live in exactly one row of a `reports_snap_2`-shaped dataset —
// one row per report page, keyed by `report_id` = the page's own id. This is a
// genuine DMS `:data` row (the same split-table storage Card/Spreadsheet write
// through via `updateItem`/`addItem`), which is the only truly schema-free
// persistence layer in this system: page/component rows go through a declared
// attribute schema (`page.format.js`/`cmsSection`) that a client-side allowlist can
// silently strip unknown keys from (this is exactly what happened when routes lived
// in this section's own `element-data` — dataWrapper's save effect round-trips
// `element-data` through a fixed set of known fields whenever it fires, dropping
// anything else). A `:data` row has no such allowlist.
//
// Which dataset this is is an author decision, not a hardcoded one: `externalSource`
// is this section's normal sectionMenu "Dataset" binding (the one every
// `useDataWrapper` component gets). The Report Page template pre-wires it to
// `reports_snap_2`, but nothing in this hook hardcodes that source/view id.
//
// Owns this report's one storage row (load + every mutation that persists to it).
// `addRoute` takes the new route data as an argument rather than reading it from a
// closure — the "pending route to add" state belongs to the add-flow UI, not to
// this row-storage concern.
export function useReportRow({ apiLoad, apiUpdate, item, externalSource, isEdit }) {
  const [reportRow, setReportRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Synchronous mirror of reportRow.id — persistRoutes reads/writes this
  // instead of the closed-over `reportRow` state so a create's id is never
  // lost to a stale closure (e.g. two persistRoutes calls overlapping before
  // a re-render lands). React state updates are async and batched; a ref is
  // not, so it can't go stale between "row created" and "next edit persisted".
  const reportRowIdRef = useRef(null);
  const routes = reportRow?.routes || EMPTY_ROUTES;

  // The report STORAGE binding — this section's normal sectionMenu "Dataset" pick.
  // The Report Page template pre-wires this to `reports_snap_2`, but nothing here
  // hardcodes that source/view id; an author could point it anywhere with the same
  // shape (a `report_id` + `routes` column).
  const sourceType = externalSource?.type || (externalSource?.name ? nameToSlug(externalSource.name) : undefined);
  const storageDataFormat = externalSource?.view_id && sourceType
    ? { ...externalSource, type: `${sourceType}|${externalSource.view_id}:data` }
    : externalSource;

  // Load this report's one row from the storage dataset (`externalSource`), keyed by
  // `report_id` = the page's own id (a real column filter, same `data->>'col'` UDA
  // query shape the add-flow's catalog lookup uses — just against a different
  // dataset). No row yet is a normal, expected state for a freshly created report
  // page, not an error.
  //
  // Two things are required to get the row's own `id` back — both silently missing
  // before this fix, and together the actual root cause of routes/graphIds never
  // surviving a refresh:
  // 1. `id` isn't one of `externalSource.columns` (those are just the `data` JSONB
  //    keys) — it must be pushed as its own `systemCol` column, mirroring the
  //    convention `getData.js` uses for every other editable dataset row (Card/
  //    Spreadsheet). `sort: 'desc'` also makes a real read deterministic (prefer the
  //    newest row) if duplicate rows exist from before this fix.
  // 2. `createRequest.js`'s `uda` case reads its actual SELECT attribute list from
  //    `wrapperConfig.filter.attributes` — NOT from anything embedded in
  //    `udaConfig.options`. Omitting it (as this code did) makes the request fall
  //    back to fetching bare `data` only, so `id` (and any other explicitly-added
  //    column) never reaches the response regardless of what's in `options`. Must
  //    pass `udaConfig.attributes` (the same `columnsToFetch.map(c => c.reqName)`
  //    list `getData.js` sends) explicitly.
  // 3. Once `attributes` is a real list (rather than the `['data']` fallback), each
  //    fetched value comes back keyed by its own full SQL expression string (e.g.
  //    `"id as id"`, `"data->>'routes' as routes"`), not by a clean alias — `getData.js`
  //    (`getData.js:557-559`) remaps `row[column.reqName]` into `row[column.name]`
  //    after every fetch for exactly this reason. `row.id`/`row.routes` must go
  //    through the same remap or they're reading a key that was never set.
  // Without all three, `row.id` was always `undefined` on every read — `persistRoutes`
  // could never find an existing row to update and fell back to inserting a new one
  // on every single edit.
  //
  // `forItemId` is the page id this specific call was issued for, captured by the
  // effect below at the moment `item.id` changed — never re-read from the `item`
  // closure once the async fetch is in flight. Two different report pages share
  // this ONE mounted component instance (every report's `/edit/...` route matches
  // the same wildcard React Router route, so switching reports never remounts
  // `ReportRouteList` — only `item` changes, one render after the URL does, via
  // EditWrapper's own effect). Without `forItemId`, a page switch mid-fetch left
  // `reportRow`/`reportRowIdRef` holding the PREVIOUS report's row while `item.id`
  // already pointed at the new one — and `useGraphPublish`'s orphan-cleanup effect
  // (which strips any route's `graphIds` not found in the CURRENT page's own
  // sections) would then see the old report's routes against the new report's
  // section ids, find every graphId "orphaned," and auto-persist the wipe under the
  // new report's `report_id` using the old row's id — corrupting a second page with
  // zero user interaction. Confirmed live 2026-07-21 (see
  // reportroutelist-graphids-wiped-on-refresh.md's follow-up). The `forItemId`
  // check after the await re-verifies this load is still the current one before
  // committing anything, so a slow, now-superseded fetch can't clobber state a
  // newer navigation already moved past.
  const loadReportRow = async (forItemId) => {
    if (!apiLoad || !forItemId || !externalSource?.columns) return;
    const udaConfig = buildUdaConfig({
      externalSource,
      columns: [
        ...externalSource.columns.map(c => ({ ...c, show: true })),
        { name: 'id', systemCol: true, show: true, sort: 'desc' },
      ],
      filters: { op: "AND", groups: [{ col: "data->>'report_id'", op: "filter", value: String(forItemId) }] }
    });
    const config = {
      format: { ...externalSource },
      children: [{ action: "uda", path: "/", filter: { options: JSON.stringify(udaConfig.options), attributes: udaConfig.attributes }, params: {} }]
    };
    try {
      const data = await apiLoad(config, "/");
      if (loadTargetIdRef.current !== forItemId) return; // superseded by a newer navigation
      // A `uda` fetch with an explicit `attributes` list returns each row as a flat
      // object keyed by the request's own attribute strings directly (`data[0]`) —
      // there's no `{data:{value}}` wrapper to unwrap here; that shape only occurs
      // for the single-bare-`'data'`-attribute fallback this code used before the
      // `attributes` fix above. A null value comes back Falcor-atom-wrapped
      // (`{$type:'atom', value:null}`) — unwrap it the same way `getData.js`'s
      // `cleanValue` does.
      const rawRow = data?.[0];
      const row = rawRow
        ? udaConfig.columnsToFetch.reduce((acc, col) => {
            const v = rawRow[col.reqName];
            acc[col.name] = (v && typeof v === 'object' && '$type' in v) ? v.value : v;
            return acc;
          }, {})
        : null;
      if (row) {
        let parsedRoutes = [];
        try {
          parsedRoutes = JSON.parse(row.routes || '[]') || [];
        } catch (e) {
          parsedRoutes = [];
        }
        reportRowIdRef.current = row.id;
        setReportRow({ id: row.id, routes: parsedRoutes });
      } else {
        reportRowIdRef.current = null;
        setReportRow({ id: null, routes: [] });
      }
    } catch (e) {
      if (loadTargetIdRef.current !== forItemId) return;
      console.error('<ReportRouteList:loadReportRow>', e);
      reportRowIdRef.current = null;
      setReportRow({ id: null, routes: [] });
    }
  };

  // Which page id the most recently issued load is for — set synchronously below,
  // before the async fetch even starts, so `loadReportRow`'s post-await checks have
  // a ground truth to compare against regardless of resolution order.
  const loadTargetIdRef = useRef(null);

  useEffect(() => {
    loadTargetIdRef.current = item?.id ?? null;
    // Drop the previous report's row synchronously, in the same tick `item.id`
    // changes — every write path (persistRoutes, useGraphPublish's effects) already
    // bails out on `!reportRow`, so this alone closes the cross-report write window
    // described above, before `loadReportRow`'s own fetch has even started.
    reportRowIdRef.current = null;
    setReportRow(null);
    loadReportRow(item?.id);
  }, [item?.id, externalSource?.source_id, externalSource?.view_id]);

  // Persist a route mutation to this report's row in the storage dataset — creating
  // it on the first-ever route add (no row yet → `apiUpdate` with no `id` inserts
  // one, same as dataWrapper's own `addItem` elsewhere), updating it on every
  // mutation after. This is a genuine DMS data row (split-table, schema-free), not a
  // page attribute and not this section's own `element-data`.
  const persistRoutes = async (nextRoutes) => {
    // Page-level edit-mode gate: mirrors the convention every other dataWrapper
    // component follows (mutations only happen while the page is open on /edit/...).
    // This is a single choke point — every mutating handler and the orphan-cleanup
    // effect (see useGraphPublish) both funnel through here, so gating here is
    // sufficient on its own to guarantee no write ever fires while a report is merely
    // being viewed.
    if (!isEdit || !apiUpdate || !item?.id || !reportRow || !storageDataFormat) return;
    const currentId = reportRowIdRef.current;
    const payload = { report_id: String(item.id), routes: JSON.stringify(nextRoutes) };
    if (currentId) payload.id = currentId;
    const res = await apiUpdate({ data: payload, config: { format: storageDataFormat } });
    const nextId = currentId || res?.id;
    reportRowIdRef.current = nextId;
    setReportRow({ id: nextId, routes: nextRoutes });
  };

  // `newRouteData` is the route object resolved by the add-flow's own catalog
  // lookup — this hook only owns assigning it a local `route_comp_id` and
  // persisting it, not resolving/fetching it.
  const addRoute = async (newRouteData) => {
    if (!apiUpdate || !item?.id || !newRouteData || saving || !reportRow) return;
    setSaving(true);
    setError('');
    try {
      let maxId = -1;
      routes.forEach(r => {
        if (r.route_comp_id && r.route_comp_id.startsWith('comp-')) {
          const id = parseInt(r.route_comp_id.replace('comp-', ''), 10);
          if (!isNaN(id) && id > maxId) {
            maxId = id;
          }
        }
      });

      // Auto-assign an identity color from the shared palette, cycling by the route's
      // position — mirrors the old tool's `getRouteColor()`. `routes.length` (the count
      // BEFORE this route is appended) is the right index: first route gets palette[0], etc.
      const newRoute = {
        color: ROUTE_COLOR_PALETTE[routes.length % ROUTE_COLOR_PALETTE.length],
        ...newRouteData,
        route_comp_id: `comp-${maxId + 1}`
      };

      await persistRoutes([...routes, newRoute]);
    } catch (e) {
      console.error('<ReportRouteList:add>', e);
      setError('Could not add route.');
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const removeRoute = async (indexToRemove) => {
    if (!apiUpdate || !item?.id || saving || !reportRow) return;
    setSaving(true);
    setError('');
    try {
      await persistRoutes(routes.filter((_, i) => i !== indexToRemove));
    } catch (e) {
      console.error('<ReportRouteList:remove>', e);
      setError('Could not remove route.');
    } finally {
      setSaving(false);
    }
  };

  const reorderRoutes = async (index, direction) => {
    if (!apiUpdate || !item?.id || saving || !reportRow) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= routes.length) return;

    setSaving(true);
    setError('');
    try {
      const updatedRoutes = [...routes];
      const temp = updatedRoutes[index];
      updatedRoutes[index] = updatedRoutes[newIndex];
      updatedRoutes[newIndex] = temp;

      await persistRoutes(updatedRoutes);
    } catch (e) {
      console.error('<ReportRouteList:reorder>', e);
      setError('Could not reorder route.');
    } finally {
      setSaving(false);
    }
  };

  const updateRoute = async ({ index, updates }) => {
    if (!apiUpdate || !item?.id || saving || !updates || !reportRow) return;
    setSaving(true);
    setError('');
    try {
      const newRoutes = cloneDeep(routes)
      Object.entries(updates).forEach(([field, value]) => {
        let finalValue = value;
        if ((field === 'startDate' || field === 'endDate') && typeof finalValue === 'string' && finalValue.includes('T')) {
          finalValue = roundToFiveMinutes(finalValue);
        }
        newRoutes[index][field] = finalValue;
      });
      await persistRoutes(newRoutes);
    } catch (e) {
      console.error('<ReportRouteList:update>', e);
      setError('Could not update route.');
    } finally {
      setSaving(false);
    }
  };

  // Toggle whether a route feeds a given graph's route list. `graphIds` is a hidden
  // per-route field (section ids of the graphs this route has been clicked onto) —
  // never surfaced as an abstract "group"; the UI is just "this route is on Graph N."
  // A route feeds no graph until explicitly toggled onto one (no implicit sharing).
  const toggleRouteGraph = async (index, sectionId) => {
    if (!apiUpdate || !item?.id || saving || !reportRow) return;
    setSaving(true);
    setError('');
    try {
      const newRoutes = cloneDeep(routes);
      const current = new Set(newRoutes[index].graphIds || []);
      if (current.has(sectionId)) current.delete(sectionId); else current.add(sectionId);
      newRoutes[index].graphIds = Array.from(current);
      await persistRoutes(newRoutes);
    } catch (e) {
      console.error('<ReportRouteList:toggleGraph>', e);
      setError('Could not update route.');
    } finally {
      setSaving(false);
    }
  };

  return {
    reportRow,
    routes,
    saving,
    error,
    setError,
    persistRoutes,
    addRoute,
    removeRoute,
    reorderRoutes,
    updateRoute,
    toggleRouteGraph,
  };
}
