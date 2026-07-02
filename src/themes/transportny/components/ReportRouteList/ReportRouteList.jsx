import { useContext, useEffect, useMemo, useState } from 'react';
import { cloneDeep, get, isEqual } from 'lodash-es';
import { ComponentContext, PageContext, CMSContext } from "../../../../dms/packages/dms/src/patterns/page/context";
import { ThemeContext, getComponentTheme } from '../../../../dms/packages/dms/src/ui/useTheme'
import { reportRouteListTheme } from './ReportRouteList.theme';
import { buildUdaConfig, SELF_PARAM_KEY_SENTINEL, selfParamKey } from '../../../../dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/buildUdaConfig';
import { nameToSlug } from '../../../../dms/packages/dms/src/utils/type-utils';

// Helper functions based on useDataSource.js
const getSources = async (falcor, envs) => {
  const sources = await Promise.all(
    Object.keys(envs).map(async (e) => {
      const lenRes = await falcor.get(["uda", e, "sources", "length"]);
      const len = get(lenRes, ["json", "uda", e, "sources", "length"]);
      if (!len) return [];
      const r = await falcor.get(["uda", e, "sources", "byIndex", { from: 0, to: len - 1 }, envs[e].srcAttributes]);
      return Array.from({ length: len }, (_, i) => i).map((i) => {
        const metadata = get(r, ["json", "uda", e, "sources", "byIndex", i, "metadata"]);
        return {
          source_id: get(r, ["json", "uda", e, "sources", "byIndex", i, "$__path", 4]),
          name: get(r, ["json", "uda", e, "sources", "byIndex", i, "name"]),
          srcEnv: e,
          columns: metadata?.columns || [],
        };
      });
    })
  );
  return sources.flat();
};

const getViews = async (falcor, sourceId, srcEnv, viewAttributes) => {
  const lenRes = await falcor.get(["uda", srcEnv, "sources", "byId", sourceId, "views", "length"]);
  const len = get(lenRes, ["json", "uda", srcEnv, "sources", "byId", sourceId, "views", "length"]);
  if (!len) return [];
  const byIndexRes = await falcor.get(["uda", srcEnv, "sources", "byId", sourceId, "views", "byIndex", { from: 0, to: len - 1 }, viewAttributes]);
  return Array.from({ length: len }, (_, i) => i).map((i) =>  ({
    view_id: get(byIndexRes, ["json", "uda", srcEnv, "sources", "byId", sourceId, "views", "byIndex", i, "view_id"]),
    name: get(byIndexRes, ["json", "uda", srcEnv, "sources", "byId", sourceId, "views", "byIndex", i, "name"]),
  }));
};

function transformReportRoutes(routes) {
  if(!routes || routes.length < 1){
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

  // Helper function to generate an array of 'YYYY-MM-DD' dates
  function generateDateRange(startStr, endStr) {
    const startDate = parseYMD(startStr);
    const endDate = parseYMD(endStr);
    const dates = [];

    // Loop day-by-day from start to end
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
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
      console.error(`Failed to parse tmc_array for route ${route.route_id}:`, e);
    }

    // Generates the range based on your MM-DD-YYYY inputs
    const dateArray = route.startDate && route.endDate ? generateDateRange(route.startDate, route.endDate) : [];
    const epochArray = (route.startDate && route.endDate && route.startDate.includes('T') && route.endDate.includes('T')) ? generateEpochRange(route.startDate, route.endDate) : [];

    const groups = [
      {
        op: "filter",
        col: "tmc",
        value: parsedTmcArray
      },
      {
        op: "filter",
        col: "date",
        value: dateArray
      }
    ];

    if (epochArray.length > 0) {
      groups.push({
        op: "filter",
        col: "epoch",
        value: epochArray
      });
    }

    return {
      label: route.name,
      filters: {
        op: "AND",
        groups: groups
      }
    };
  });
}

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
// produce a brand-new array every render, which would re-trigger the publish effect
// below on every render (it depends on `routes`) and loop forever.
const EMPTY_ROUTES = [];
const EMPTY_SECTIONS = [];

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
// `reports_snap_2`, but nothing in this file hardcodes that source/view id anymore.

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
      return { sectionId: String(section.id) };
    })
    .filter(Boolean)
    .map((g, i) => ({ ...g, paramKey: selfParamKey(g.sectionId), label: `Graph ${i + 1}` }));
}

export default function ReportRouteList() {
  const { apiLoad, apiUpdate, pageState, setActionParam, clearActionParam, item, editPageMode } = useContext(PageContext) || {};
  const { falcor, datasources } = useContext(CMSContext) || {};
  const { setState, state, state:{join, externalSource} } = useContext(ComponentContext) || {};
  // NOT `props.isEdit` — that's dataWrapper's per-section "is THIS component's own
  // settings editor open" flag (almost always false in normal interactive use, since
  // this panel renders via SectionView even on an /edit/... page). `editPageMode`
  // (from PageContext, set only on the /edit/... route) is whichever sections array
  // (`draft_sections` vs `sections`) sibling components are ACTUALLY rendering from
  // right now — that's what sectionsKey below must track, since graphIds stored on a
  // route only mean anything if they reference the ids of the sections actually on
  // screen.
  const isEdit = Boolean(editPageMode);
  const { UI, theme: themeFromContext = {} } = useContext(ThemeContext) || {};
  const { Button, Input, Icon } = UI || {};
  const t = { ...reportRouteListTheme, ...getComponentTheme(themeFromContext, 'reportRouteList') };
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sources, setSources] = useState([]);
  const [views, setViews] = useState([]);
  const [pendingRoute, setPendingRoute] = useState(null);
  const [expandedRoutes, setExpandedRoutes] = useState({});
  const [isRoutesExpanded, setIsRoutesExpanded] = useState(true);
  const [editingRouteNameIndex, setEditingRouteNameIndex] = useState(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [editingRouteDatesIndex, setEditingRouteDatesIndex] = useState(null);
  const [editStartDateValue, setEditStartDateValue] = useState('');
  const [editEndDateValue, setEditEndDateValue] = useState('');
  // The route CATALOG binding — read-only, used only to resolve `add_route_id` into
  // a route to copy from. Bound via the sectionMenu's "Add Join Source" slot rather
  // than `externalSource` (which is this component's STORAGE binding, see below):
  // an author picks a join source + view and stops there (never configures join
  // columns), which leaves `isJoinComplete()` false and keeps this from ever being
  // sent to the query engine as a real SQL join (`buildUdaConfig.js`'s per-alias
  // `isJoinComplete` filter) — while still populating full `sourceInfo` the moment
  // the source is picked (`useDataSource.js`'s `onJoinSourceChange`). Read the first
  // (only) join source rather than hardcoding an alias name — there's only ever one
  // for this component, so no ambiguity, and it's robust to whatever alias ends up
  // assigned.
  const routeSourceInfo = Object.values(join?.sources || {})[0]?.sourceInfo;
  // The report STORAGE binding — this section's normal sectionMenu "Dataset" pick.
  // The Report Page template pre-wires this to `reports_snap_2`, but nothing here
  // hardcodes that source/view id; an author could point it anywhere with the same
  // shape (a `report_id` + `routes` column).
  const sourceType = externalSource?.type || (externalSource?.name ? nameToSlug(externalSource.name) : undefined);
  const storageDataFormat = externalSource?.view_id && sourceType
    ? { ...externalSource, type: `${sourceType}|${externalSource.view_id}:data` }
    : externalSource;
  // `reportRow` is this report's one dedicated row in the storage dataset — `null`
  // while loading, `{id: null, routes: []}` once loaded if no row exists yet (first
  // route add creates it), `{id, routes}` once one exists. Loaded/persisted directly
  // via apiLoad/apiUpdate below — independent of this section's own `element-data`
  // and of the page's routes/draft_routes (removed; see the README's "Storage"
  // section for why).
  const [reportRow, setReportRow] = useState(null);
  const routes = reportRow?.routes || EMPTY_ROUTES;

  // Sibling graphs on this same page that are ready to receive a per-instance route
  // list (see findSelfBoundGraphs above). Read-only — never written to; each graph
  // resolves its own key from its own section id. Unrelated to routes storage
  // (see storageDataFormat/persistRoutes below) — this is purely for discovering
  // which graphs are on the page right now.
  const sectionsKey = isEdit ? 'draft_sections' : 'sections';
  const sectionList = item?.[sectionsKey] || EMPTY_SECTIONS;
  const graphs = useMemo(() => findSelfBoundGraphs(sectionList), [sectionList]);
  const knownSectionIds = useMemo(() => new Set(sectionList.map((s) => s?.id != null ? String(s.id) : null).filter(Boolean)), [sectionList]);

  const getDateValue = (val) => (val || '').split('T')[0];
  const getTimeValue = (val) => (val || '').split('T')[1] || '';
  const onDateChange = (e, currentValue, setter) => {
    const time = currentValue?.split('T')[1] || '';
    setter(time ? `${e.target.value}T${time}` : e.target.value);
  };
  const onTimeChange = (e, currentValue, setter) => {
    const date = currentValue?.split('T')[0] || '';
    setter(e.target.value ? `${date}T${e.target.value}` : date);
  };

  const toggleRoute = (index) => {
    setExpandedRoutes(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const addRouteId = pageState?.filters?.find(f => f.searchKey === 'add_route_id' && f.type === 'action')?.values?.[0];
  console.log({addRouteId})
  useEffect(() => {
    if (!falcor || !datasources?.length) return;
    const envs = datasources.reduce((acc, ds) => {
      acc[ds.env] = { srcAttributes: ds.srcAttributes, viewAttributes: ds.viewAttributes };
      return acc;
    }, {});

    getSources(falcor, envs).then(setSources);
  }, [falcor, datasources]);

  useEffect(() => {
    if (!falcor || !routeSourceInfo) return;
    const srcEnv = routeSourceInfo?.srcEnv;
    if (!srcEnv) return;
    const viewAttrs = datasources.find(ds => ds.env === srcEnv)?.viewAttributes || ['view_id', 'name'];

    getViews(falcor, routeSourceInfo, srcEnv, [...viewAttrs, "view_id"]).then((v) => {
      if(v.length === 1) {
        setState(draft =>{
          draft.routesViewId = v[0]?.view_id;
        })
      }
      setViews(v)
    });
  }, [falcor, routeSourceInfo, sources, datasources]);

  const getTmcArray = (tmcArray) => {
    if (!tmcArray) return [];
    if (Array.isArray(tmcArray)) return tmcArray;
    try {
      return JSON.parse(tmcArray);
    } catch (e) {
      console.error('Failed to parse tmc_array', e);
      return [];
    }
  };

  const fetchDynamicRoute = async () => {
    console.log({addRouteId, apiLoad, routeSourceInfo})
    if (!addRouteId || !apiLoad || !routeSourceInfo) return;
    setLoading(true);
    console.log("fetching dynamic route")

    const udaConfig = buildUdaConfig({
      externalSource: routeSourceInfo,
      columns: routeSourceInfo.columns.map(c => ({...c, show: true})),
      filters: { op: "AND", groups: [{ col: "data->>'route_id'", op: "filter", value: addRouteId.value }] }
    });

    const config = {
      format: { ...routeSourceInfo },
      children: [{ action: "uda", path: "/", filter: { options: JSON.stringify(udaConfig.options) }, params: {} }]
    };

    try {
      const data = await apiLoad(config, "/");
      if (data && data[0]) setPendingRoute(data[0].data.value);
    } catch (e) {
      console.error('<ReportRouteList:fetchDynamic>', e);
      setError('Could not fetch route details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if(addRouteId) {
      fetchDynamicRoute();
    }
  },[addRouteId]);

  // Load this report's one row from the storage dataset (`externalSource`), keyed by
  // `report_id` = the page's own id (a real column filter, same `data->>'col'` UDA
  // query shape fetchDynamicRoute uses above — just against a different dataset). No
  // row yet is a normal, expected state for a freshly created report page, not an
  // error.
  const loadReportRow = async () => {
    if (!apiLoad || !item?.id || !externalSource?.columns) return;
    const udaConfig = buildUdaConfig({
      externalSource,
      columns: externalSource.columns.map(c => ({ ...c, show: true })),
      filters: { op: "AND", groups: [{ col: "data->>'report_id'", op: "filter", value: String(item.id) }] }
    });
    const config = {
      format: { ...externalSource },
      children: [{ action: "uda", path: "/", filter: { options: JSON.stringify(udaConfig.options) }, params: {} }]
    };
    try {
      const data = await apiLoad(config, "/");
      const row = data?.[0]?.data?.value;
      if (row) {
        let parsedRoutes = [];
        try {
          parsedRoutes = JSON.parse(row.routes || '[]') || [];
        } catch (e) {
          parsedRoutes = [];
        }
        setReportRow({ id: row.id, routes: parsedRoutes });
      } else {
        setReportRow({ id: null, routes: [] });
      }
    } catch (e) {
      console.error('<ReportRouteList:loadReportRow>', e);
      setReportRow({ id: null, routes: [] });
    }
  };

  useEffect(() => {
    loadReportRow();
  }, [item?.id, externalSource?.source_id, externalSource?.view_id]);

  // Persist a route mutation to this report's row in the storage dataset — creating
  // it on the first-ever route add (no row yet → `apiUpdate` with no `id` inserts
  // one, same as dataWrapper's own `addItem` elsewhere), updating it on every
  // mutation after. This is a genuine DMS data row (split-table, schema-free), not a
  // page attribute and not this section's own `element-data` — see the README's
  // "Storage" section for why those two were both dead ends.
  const persistRoutes = async (nextRoutes) => {
    if (!apiUpdate || !item?.id || !reportRow || !storageDataFormat) return;
    const payload = { report_id: String(item.id), routes: JSON.stringify(nextRoutes) };
    if (reportRow.id) payload.id = reportRow.id;
    const res = await apiUpdate({ data: payload, config: { format: storageDataFormat } });
    setReportRow({ id: reportRow.id || res?.id, routes: nextRoutes });
  };

  const addRoute = async () => {
    if (!apiUpdate || !item?.id || !pendingRoute || saving || !reportRow) return;
    setSaving(true);
    setError('');
    try {
      // Find max ID
      let maxId = -1;
      routes.forEach(r => {
        if (r.route_comp_id && r.route_comp_id.startsWith('comp-')) {
          const id = parseInt(r.route_comp_id.replace('comp-', ''), 10);
          if (!isNaN(id) && id > maxId) {
            maxId = id;
          }
        }
      });

      const newRoute = {
        ...pendingRoute,
        route_comp_id: `comp-${maxId + 1}`
      };

      await persistRoutes([...routes, newRoute]);

      setPendingRoute(null);
      clearActionParam('add_route_id');
    } catch (e) {
      console.error('<ReportRouteList:add>', e);
      setError('Could not add route.');
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

  const updateRoute = async ({index, updates}) => {
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
    if (!apiUpdate || !item?.id || !sectionList.length || !reportRow) return;
    const needsCleanup = routes.some(r => (r.graphIds || []).some(id => !knownSectionIds.has(id)));
    if (!needsCleanup) return;
    const cleaned = routes.map(r => {
      if (!r.graphIds?.length) return r;
      const filtered = r.graphIds.filter(id => knownSectionIds.has(id));
      return filtered.length === r.graphIds.length ? r : { ...r, graphIds: filtered };
    });
    persistRoutes(cleaned);
  }, [routes, knownSectionIds, sectionList.length, reportRow]);

  const cancelAdd = () => {
    setPendingRoute(null);
    clearActionParam('add_route_id');
  };
  return (
    <div className={t.wrapper}>
      <div className={t.title}>{item?.title}</div>
      <div className={t.titleWrapper}>
        <div>Routes</div>
        <Button themeOptions={{ size: "xs", color:"transparent" }} onClick={() => setIsRoutesExpanded(!isRoutesExpanded)}>
          {isRoutesExpanded ? <Icon icon="ChevronUp" /> : <Icon icon="ChevronDown" />}
        </Button>
      </div>
      {isRoutesExpanded && (
        <>
          {(loading || !reportRow) ? <div className={t.loading}>Loading…</div> : null}
          <div className={t.list}>
            {routes.map((r, i) => {
              const tmcArray = getTmcArray(r.tmc_array);
              const isExpanded = expandedRoutes[i];
              return (
                <div key={`${r.id}-${i}`} className={t.row}>
                  <div className={t.rowContainer}>
                    <div className={t.rowHeader}>
                      <div className={t.iconContainer}>
                        <Icon icon={'Drag'} />
                        <Button disabled={editingRouteNameIndex === i} themeOptions={{ size: "xs" }} onClick={() => toggleRoute(i)}>
                          {isExpanded ? '-' : '+'}
                        </Button>
                        {editingRouteNameIndex === i ? (
                          <div className={t.editContainer}>
                            <div className={t.editInputWrapper}>
                              <Input value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} />
                            </div>
                            <Button themeOptions={{ size: "xs" }} title="save" onClick={() => {
                              updateRoute({ index: i, updates: { name: editNameValue } });
                              setEditingRouteNameIndex(null);
                            }}>
                              <Icon icon={"FloppyDisk"} />
                            </Button>
                            <Button themeOptions={{ size: "xs", color: "danger" }} title="cancel" onClick={() => setEditingRouteNameIndex(null)}>
                              <Icon icon={"CancelCircle"} />
                            </Button>
                          </div>

                        ) : (
                          <div className={t.editContainer}>
                            <div className={t.routeTitle}>{r.name}</div>
                            {isExpanded && (
                              <Button themeOptions={{ size: "xs" }} title="Edit Name" onClick={() => {
                                setEditingRouteNameIndex(i);
                                setEditNameValue(r.name);
                              }}>
                                <Icon icon={'PencilSquare'} />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className={t.reorderButtons}>
                        <Button themeOptions={{ size: "xs" }} disabled={i === 0 || saving} onClick={() => reorderRoutes(i, 'up')}>
                          <Icon icon={'ChevronUp'} />
                        </Button>
                        <Button themeOptions={{ size: "xs" }} disabled={i === routes.length - 1 || saving} onClick={() => reorderRoutes(i, 'down')}>
                          <Icon icon={'ChevronDown'} />
                        </Button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className={t.expandedContainer}>
                        {tmcArray.length > 0 && (
                          <div className={t.tmcWrapper}>
                            <div className={t.tmcLabel}>TMCs:</div>
                            <div className={t.tmcList}>
                              {tmcArray.join(", ")}
                            </div>
                          </div>
                        )}
                        <div className={t.dateInputsContainer}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className={t.dateRangeLabel}>Date Range</div>
                            {editingRouteDatesIndex === i ? (
                              <div className={t.editContainer}>
                                <Button themeOptions={{ size: "xs" }} title="save" onClick={() => {
                                  updateRoute({ index: i, updates: { startDate: editStartDateValue, endDate: editEndDateValue } });
                                  setEditingRouteDatesIndex(null);
                                }}>
                                  <Icon icon={"FloppyDisk"} />
                                </Button>
                                <Button themeOptions={{ size: "xs", color: "danger" }} title="cancel" onClick={() => setEditingRouteDatesIndex(null)}>
                                  <Icon icon={"CancelCircle"} />
                                </Button>
                              </div>
                            ) : (
                              <Button themeOptions={{ size: "xs" }} title="Edit Dates" onClick={() => {
                                setEditingRouteDatesIndex(i);
                                setEditStartDateValue(r.startDate);
                                setEditEndDateValue(r.endDate);
                              }}>
                                <Icon icon={'PencilSquare'} />
                              </Button>
                            )}
                          </div>
                          <div className={t.dateInputWrapper}>
                            <label className={t.dateLabel}>Start Date:</label>
                            <div className={t.dateInputFlex}>
                              <Input type="date" value={getDateValue(editingRouteDatesIndex === i ? editStartDateValue : r.startDate)} disabled={editingRouteDatesIndex !== i} onChange={(e) => onDateChange(e, editingRouteDatesIndex === i ? editStartDateValue : r.startDate || '', setEditStartDateValue)} />
                              <Input type="time" value={getTimeValue(editingRouteDatesIndex === i ? editStartDateValue : r.startDate)} disabled={editingRouteDatesIndex !== i} onChange={(e) => onTimeChange(e, editingRouteDatesIndex === i ? editStartDateValue : r.startDate || '', setEditStartDateValue)} />
                            </div>
                          </div>
                          <div className={t.dateInputWrapper}>
                            <label className={t.dateLabel}>End Date:</label>
                            <div className={t.dateInputFlex}>
                              <Input type="date" value={getDateValue(editingRouteDatesIndex === i ? editEndDateValue : r.endDate)} disabled={editingRouteDatesIndex !== i} onChange={(e) => onDateChange(e, editingRouteDatesIndex === i ? editEndDateValue : r.endDate || '', setEditEndDateValue)} />
                              <Input type="time" value={getTimeValue(editingRouteDatesIndex === i ? editEndDateValue : r.endDate)} disabled={editingRouteDatesIndex !== i} onChange={(e) => onTimeChange(e, editingRouteDatesIndex === i ? editEndDateValue : r.endDate || '', setEditEndDateValue)} />
                            </div>
                          </div>
                        </div>
                        {graphs.length > 0 && (
                          <div className={t.graphChipsWrapper}>
                            <span className={t.graphChipsLabel}>On:</span>
                            {graphs.map((g) => {
                              const isOn = (r.graphIds || []).includes(g.sectionId);
                              return (
                                <span
                                  key={g.sectionId}
                                  className={isOn ? t.graphChipActive : t.graphChip}
                                  onClick={() => !saving && toggleRouteGraph(i, g.sectionId)}
                                  title={isOn ? `Remove from ${g.label}` : `Add to ${g.label}`}
                                >
                                  {g.label}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        <div className={t.removeButtonWrapper}>
                          <Button
                            themeOptions={{ size: "xs", color: "danger" }}
                            disabled={saving}
                            onClick={() => removeRoute(i)}
                            className="bg-red-100 text-red-700 hover:bg-red-200"
                          >
                            <Icon icon="Trash" /> Remove Route from Report
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {!loading && reportRow && routes.length === 0 ? <div className={t.empty}>No routes added.</div> : null}
          </div>
          {pendingRoute && (
            <div className={t.addForm}>
              <div>Add “{pendingRoute.name}”?</div>
              <Button disabled={saving} onClick={addRoute}>
                {saving ? "Adding…" : "Confirm"}
              </Button>
              <Button disabled={saving} onClick={cancelAdd}>
                Cancel
              </Button>
            </div>
          )}
        </>
      )}
      {error ? <div className={t.error}>{error}</div> : null}
    </div>
  );
}
