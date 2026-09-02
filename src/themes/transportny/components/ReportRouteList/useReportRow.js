import { useEffect, useRef, useState } from 'react';
import { cloneDeep } from 'lodash-es';
import { buildUdaConfig } from '../../../../dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/buildUdaConfig';
import { nameToSlug } from '../../../../dms/packages/dms/src/utils/type-utils';
import { getColorRange } from '../../../../dms/packages/dms/src/ui/components/graph_new/colorSchemeUnifier';
import { defaultRouteDateRange } from './relativeDateResolution';
import { parseTags, defaultTagsForUser } from '../RouteTagBrowserModal/tagCategories';

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
const EMPTY_TAGS = [];

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
export function useReportRow({ apiLoad, apiUpdate, item, externalSource, isEdit, user }) {
  const [rawReportRow, setReportRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Synchronous mirror of reportRow.id — persistRoutes reads/writes this
  // instead of the closed-over `reportRow` state so a create's id is never
  // lost to a stale closure (e.g. two persistRoutes calls overlapping before
  // a re-render lands). React state updates are async and batched; a ref is
  // not, so it can't go stale between "row created" and "next edit persisted".
  const reportRowIdRef = useRef(null);

  // `rawReportRow` can still belong to the PREVIOUSLY viewed report for one render
  // after `item.id` changes — this component never remounts across report
  // navigation (every report's /edit/... route matches the same wildcard route),
  // only `item` changes, one render after the URL does. Every write to
  // `rawReportRow` is tagged with the item id it was loaded/persisted for; deriving
  // `reportRow` by comparing that tag against the CURRENT `item.id` (at render
  // time, not inside an effect) means every consumer sees `null` the instant
  // `item.id` changes, regardless of effect-ordering between this hook's own reset
  // effect and any other hook's effects in the same commit. This guard was
  // originally built to stop a since-deleted orphan-cleanup effect (removed by
  // Design Push #2, 2026-08-06) from seeing the previous report's routes (with real
  // graphIds) alongside the new report's own (different) section ids, treating
  // every route as orphaned, and persisting a corrupted copy of the OLD report's
  // routes under the NEW report's own id — confirmed live 2026-07-22 (a fresh page
  // created via "+ Add Page" showed another report's routes, and the new page's own
  // storage row in the DB contained a byte-for-byte copy of that other report's
  // routes with graphIds zeroed out). Kept regardless of that effect's removal — any
  // consumer of `reportRow` benefits from not acting on stale cross-report state.
  const reportRow = rawReportRow?.forItemId === (item?.id ?? null) ? rawReportRow : null;
  const routes = reportRow?.routes || EMPTY_ROUTES;
  const tags = reportRow?.tags || EMPTY_TAGS;

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
  // already pointed at the new one — and a since-deleted orphan-cleanup effect
  // (removed by Design Push #2, 2026-08-06; it used to strip any route's
  // `graphIds` not found in the CURRENT page's own sections) would then see the
  // old report's routes against the new report's section ids, find every graphId
  // "orphaned," and auto-persist the wipe under the new report's `report_id` using
  // the old row's id — corrupting a second page with zero user interaction.
  // Confirmed live 2026-07-21 (see reportroutelist-graphids-wiped-on-refresh.md's
  // follow-up). The `forItemId` check after the await re-verifies this load is
  // still the current one before committing anything, so a slow, now-superseded
  // fetch can't clobber state a newer navigation already moved past — a general
  // cross-report race guard, not specific to that deleted effect.
  const loadReportRow = async (forItemId) => {
    if (!apiLoad || !forItemId || !externalSource?.columns) return;
    const udaConfig = buildUdaConfig({
      externalSource,
      // `tags` is force-included the same way PickerModal/fetchCatalogRows.js does, for the
      // identical reason (round 82, old-reports-conversion.md): `externalSource.columns` is a
      // snapshot taken when this section's Dataset binding was last configured, which predates
      // `tags` existing on the source for every report created before this round — trusting the
      // stale snapshot would silently never fetch it. Dropping any stale/absent `tags` entry
      // first, same as that file.
      columns: [
        ...externalSource.columns.filter(c => c.name !== 'tags').map(c => ({ ...c, show: true })),
        { name: 'tags', type: 'multiselect', options: null, show: true },
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
      const extracted = rawRow
        ? udaConfig.columnsToFetch.reduce((acc, col) => {
            const v = rawRow[col.reqName];
            acc[col.name] = (v && typeof v === 'object' && '$type' in v) ? v.value : v;
            return acc;
          }, {})
        : null;
      // A UDA query with ZERO matching rows still returns one placeholder entry at
      // `data[0]` — every attribute a bare `{$type:'atom'}` with no `value` key, which
      // unwraps to `undefined` for every field including `id` — rather than an empty
      // array. `rawRow` alone is truthy in both this case and a real match, so it can't
      // tell them apart (confirmed live 2026-09-01: a report with zero `reports_snap_2`
      // rows still produced a truthy `extracted` object, every field `undefined`, which
      // fell into the "found" branch below with `row.id === undefined` instead of the
      // real "not found" `id: null` state the rest of this file expects). `id` is the one
      // column every genuine row always has — an id-less extraction means no row.
      const row = extracted && extracted.id != null ? extracted : null;
      if (row) {
        let parsedRoutes = [];
        try {
          parsedRoutes = JSON.parse(row.routes || '[]') || [];
        } catch (e) {
          parsedRoutes = [];
        }
        reportRowIdRef.current = row.id;
        setReportRow({ id: row.id, routes: parsedRoutes, tags: parseTags(row.tags), forItemId });
      } else {
        reportRowIdRef.current = null;
        setReportRow({ id: null, routes: [], tags: [], forItemId });
      }
    } catch (e) {
      if (loadTargetIdRef.current !== forItemId) return;
      console.error('<ReportRouteList:loadReportRow>', e);
      reportRowIdRef.current = null;
      setReportRow({ id: null, routes: [], tags: [], forItemId });
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
  // `name`/`page_path` mirrored onto every write below (2026-09-01 fix): the
  // `reports_snap_2` catalog row is what `ReportPickerModal`'s "Choose a report" search
  // actually reads (`useReportSearch.js`'s unconditional `name notempty` + `page_path
  // notempty` base filter), but until this fix NOTHING ever wrote either field for a
  // live-authored report — `persistRoutes`/`persistTags` only ever sent `{report_id,
  // routes}`/`{report_id, tags}`. Confirmed live: 968 `reports_snap_2` rows in the dev DB,
  // the vast majority blank on both fields (most point at pages long since superseded/
  // deleted — pre-existing DB churn, not this bug — but 6 pointed at real live pages,
  // e.g. "Page 19"/"Page 22"/"Page 25", each invisible in the picker under every facet).
  // Re-sending both on every persist (not just once at create) is deliberate self-healing:
  // it also keeps the catalog in sync if the page is ever retitled/re-slugged, with no
  // separate rename-sync path needed. Cheap: the underlying `dms.data.edit` write is a
  // JSONB merge, not a replace (see the pre-existing `tags`-carryover comment below).
  const catalogName = item?.title || '';
  const catalogPagePath = item?.url_slug ? `/${item.url_slug}` : '';

  const persistRoutes = async (nextRoutes) => {
    // `isEdit` here is ReportRouteList.jsx's `canMutate` — simply `editPageMode`,
    // the page open at /edit/... (report-authoring-ux-overhaul.md item 3, 2026-08-19:
    // RRL deliberately mutates unconditionally in page-edit-mode, no separate
    // per-section pencil-click required first, unlike Card/Spreadsheet's SectionEdit
    // vs SectionView gating). This is a single choke point — every mutating handler
    // funnels through here, so gating here is sufficient on its own to guarantee no
    // write ever fires outside page-edit-mode.
    if (!isEdit || !apiUpdate || !item?.id || !reportRow || !storageDataFormat) return;
    const currentId = reportRowIdRef.current;
    const payload = { report_id: String(item.id), routes: JSON.stringify(nextRoutes), name: catalogName, page_path: catalogPagePath };
    if (currentId) payload.id = currentId;
    const res = await apiUpdate({ data: payload, config: { format: storageDataFormat } });
    const nextId = currentId || res?.id;
    reportRowIdRef.current = nextId;
    // `tags` carried over from current state, not touched by this write — the underlying
    // `dms.data.edit` update is a JSONB merge (confirmed: dms.controller.js's `setDataById` does
    // `data = data || $1`, not a replace), so omitting `tags` from the payload above already left
    // it untouched in the DB; this just keeps local state in sync with that same reality instead
    // of dropping it from the UI until the next reload.
    setReportRow({ id: nextId, routes: nextRoutes, tags, forItemId: item.id });
  };

  // Persist a tags mutation — same shape/guards as persistRoutes, `routes` carried over from
  // current state for the identical reason (a JSONB-merge write, but local state is a full
  // object so it must be re-supplied on every set).
  const persistTags = async (nextTags) => {
    if (!isEdit || !apiUpdate || !item?.id || !reportRow || !storageDataFormat) return;
    const currentId = reportRowIdRef.current;
    const payload = { report_id: String(item.id), tags: JSON.stringify(nextTags), name: catalogName, page_path: catalogPagePath };
    if (currentId) payload.id = currentId;
    const res = await apiUpdate({ data: payload, config: { format: storageDataFormat } });
    const nextId = currentId || res?.id;
    reportRowIdRef.current = nextId;
    setReportRow({ id: nextId, routes, tags: nextTags, forItemId: item.id });
  };

  // Ensures a report gets its `reports_snap_2` catalog row the moment its edit page is
  // opened, rather than waiting for the first route add. Without this, a report published
  // with zero routes (e.g. straight off "Create Report") has NO catalog row at all and is
  // invisible in "Choose a report" under every facet, not just "Mine" — confirmed live
  // 2026-09-01 on a freshly created, published report with zero `reports_snap_2` rows for
  // it anywhere in the DB. `ensuringForRef` blocks a second concurrent fire for the same
  // report while the first `persistRoutes` create is still in flight (component-instance
  // scoped, so a same-report re-render can't double-create, but two independent mounts
  // racing — e.g. dev double-effects — could still both slip through; acceptable, same
  // "no server sequence" caveat `add-item-create-defaults.md` already documents for
  // create-time collisions).
  // Also seeds default tags (routes-reports-users-mesh.md, Workstream D, 2026-09-01) the moment
  // this row is FIRST created — `reportRow.id === null` here means no row exists yet, so `tags`
  // is necessarily still `[]`, there's nothing to clobber. `defaultTagsForUser` returns `[]` for a
  // missing/incomplete `user` (harmless — same as the pre-existing "no tags yet" state).
  // `persistTags` runs after `persistRoutes` resolves rather than in parallel: `persistTags`'s
  // guard reads `reportRowIdRef.current` as the row id to update, which `persistRoutes` only sets
  // (via `reportRowIdRef.current = nextId`) at the tail of its own async call — running them
  // concurrently would race persistTags against a still-null id ref.
  const ensuringForRef = useRef(null);
  useEffect(() => {
    if (!isEdit || !reportRow || reportRow.id !== null) return;
    if (ensuringForRef.current === reportRow.forItemId) return;
    ensuringForRef.current = reportRow.forItemId;
    persistRoutes(reportRow.routes)
      .then(() => persistTags(defaultTagsForUser(user)))
      .catch((e) => console.error('<ReportRouteList:ensureCatalogRow>', e))
      .finally(() => {
        if (ensuringForRef.current === reportRow.forItemId) ensuringForRef.current = null;
      });
  }, [isEdit, reportRow]);

  // Comparison-series graphs (see buildUdaConfig.js) use each route's `name` as the
  // ONLY series discriminator (both the server's SQL alias and the client's
  // grouping/legend/color key) — two routes sharing a name collapse into one
  // series. Rather than threading a separate stable key through the whole
  // fan-out/grouping/legend pipeline, the restriction is enforced here at the
  // authoring boundary instead: names are kept unique across a report's own
  // routes. On ADD (this function) a colliding name is silently disambiguated
  // (catalog names aren't something the user typed, so there's nothing to
  // "reject"); on RENAME (ReportRouteList.jsx's onSaveEditName) a collision is
  // blocked instead, since there the user explicitly chose the new name.
  //
  // `newRoutesData` are the route objects resolved by the tag-browser modal's own catalog
  // lookup — this hook only owns assigning each a local `route_comp_id`/color/deduped name and
  // persisting the batch, not resolving/fetching it. Always takes an array (even a single
  // selection) and does one `persistRoutes` call for the whole batch: looping a single-item add
  // would race, since each call would close over `routes` at the render it was created, and
  // several calls fired before a re-render lands would each persist `[...staleRoutes, oneNewRoute]`,
  // silently dropping all but the last.
  const addRoutes = async (newRoutesData) => {
    if (!apiUpdate || !item?.id || !newRoutesData?.length || saving || !reportRow) return;
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

      const existingNames = new Set(routes.map(r => r.name));
      const dedupeAgainst = (name) => {
        if (!name || !existingNames.has(name)) return name;
        let n = 2;
        while (existingNames.has(`${name} (${n})`)) n++;
        return `${name} (${n})`;
      };

      const newRoutes = newRoutesData.map((newRouteData, i) => {
        const name = dedupeAgainst(newRouteData.name);
        existingNames.add(name);
        // Ryan's call, 2026-08-20: every route should get a real date range the moment it's
        // added, not "NO DATES SET" — an unbounded (all-history) query is silently wrong for
        // almost every real use case, and this is already what happens today for any dateless
        // route's Graph/Table/Map queries (transformReportRoutes' empty-date-array leaf gets
        // dropped by buildUdaConfig.js as "no constraint", not "no rows"). Only applies when
        // the incoming data carries NEITHER a fixed range NOR a derived-date formula — the
        // catalog/tag-browser path never supplies either today, but this guard keeps the
        // default from ever clobbering a real one if that changes.
        const hasDateInfo = (newRouteData.startDate && newRouteData.endDate) || newRouteData.dateFormula;
        return {
          color: ROUTE_COLOR_PALETTE[(routes.length + i) % ROUTE_COLOR_PALETTE.length],
          ...(hasDateInfo ? {} : defaultRouteDateRange()),
          ...newRouteData,
          name,
          route_comp_id: `comp-${maxId + 1 + i}`,
        };
      });

      await persistRoutes([...routes, ...newRoutes]);
    } catch (e) {
      console.error('<ReportRouteList:addRoutes>', e);
      setError('Could not add routes.');
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

  // Batched "paste into all" for the copy/paste-a-date-span feature: one persistRoutes call for
  // every target route, same reasoning as addRoutes (looping updateRoute per route would race a
  // stale `routes` closure and drop all but the last write). Callers are responsible for
  // excluding derived-date routes and the copy source from `routeIndexes` — this function just
  // applies the span uniformly to whatever indexes it's given.
  //
  // Design push #2 (2026-08-06): shrunk to date-span only — weekday mask moved off the route
  // entirely (see useGraphPublish.js/QuickControls), so there's nothing else left to paste.
  const pasteWindowToRoutes = async (routeIndexes, { startDate, endDate }) => {
    if (!apiUpdate || !item?.id || saving || !reportRow || !routeIndexes?.length) return;
    setSaving(true);
    setError('');
    try {
      const newRoutes = cloneDeep(routes);
      routeIndexes.forEach((i) => {
        if (!newRoutes[i]) return;
        newRoutes[i].startDate = startDate;
        newRoutes[i].endDate = endDate;
      });
      await persistRoutes(newRoutes);
    } catch (e) {
      console.error('<ReportRouteList:pasteWindowToRoutes>', e);
      setError('Could not paste the date span.');
    } finally {
      setSaving(false);
    }
  };

  return {
    reportRow,
    routes,
    tags,
    saving,
    error,
    setError,
    persistRoutes,
    persistTags,
    addRoutes,
    removeRoute,
    reorderRoutes,
    updateRoute,
    pasteWindowToRoutes,
  };
}
