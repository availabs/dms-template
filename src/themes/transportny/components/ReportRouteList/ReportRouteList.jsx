import { useContext, useEffect, useMemo, useState } from 'react';
import { ComponentContext, PageContext } from "../../../../dms/packages/dms/src/patterns/page/context";
import { ThemeContext, getComponentTheme } from '../../../../dms/packages/dms/src/ui/useTheme'
import { reportRouteListTheme } from './ReportRouteList.theme';
import { buildUdaConfig } from '../../../../dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/buildUdaConfig';
import { useReportRow } from './useReportRow';
import { useGraphPublish } from './useGraphPublish';
import RouteRow from './RouteRow';
import AddRouteBanner from './AddRouteBanner';

export default function ReportRouteList() {
  const { apiLoad, apiUpdate, pageState, setActionParam, clearActionParam, item, editPageMode } = useContext(PageContext) || {};
  const { state: { join, externalSource } } = useContext(ComponentContext) || {};
  // NOT `props.isEdit` — that's dataWrapper's per-section "is THIS component's own
  // settings editor open" flag (almost always false in normal interactive use, since
  // this panel renders via SectionView even on an /edit/... page). `editPageMode`
  // (from PageContext, set only on the /edit/... route) is whichever sections array
  // (`draft_sections` vs `sections`) sibling components are ACTUALLY rendering from
  // right now — that's what useGraphPublish's sectionsKey tracks, since graphIds
  // stored on a route only mean anything if they reference the ids of the sections
  // actually on screen.
  const isEdit = Boolean(editPageMode);
  const { UI, theme: themeFromContext = {} } = useContext(ThemeContext) || {};
  const { Button, Input, Icon } = UI || {};
  const t = { ...reportRouteListTheme, ...getComponentTheme(themeFromContext, 'reportRouteList') };
  const [loading, setLoading] = useState(false);
  const [pendingRoute, setPendingRoute] = useState(null);
  const [expandedRoutes, setExpandedRoutes] = useState({});
  const [isRoutesExpanded, setIsRoutesExpanded] = useState(true);
  const [editingRouteNameIndex, setEditingRouteNameIndex] = useState(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [editingRouteDatesIndex, setEditingRouteDatesIndex] = useState(null);
  const [editStartDateValue, setEditStartDateValue] = useState('');
  const [editEndDateValue, setEditEndDateValue] = useState('');
  // Rendering-only — filters which already-added routes are displayed, never the
  // underlying `routes` array that persistence/graph publishing operate on.
  const [searchQuery, setSearchQuery] = useState('');
  // The route CATALOG binding — read-only, used only to resolve `add_route_id` into
  // a route to copy from. Bound via the sectionMenu's "Add Join Source" slot rather
  // than `externalSource` (which is this component's STORAGE binding, see
  // useReportRow): an author picks a join source + view and stops there (never
  // configures join columns), which leaves `isJoinComplete()` false and keeps this
  // from ever being sent to the query engine as a real SQL join (`buildUdaConfig.js`'s
  // per-alias `isJoinComplete` filter) — while still populating full `sourceInfo` the
  // moment the source is picked (`useDataSource.js`'s `onJoinSourceChange`). Read the
  // first (only) join source rather than hardcoding an alias name — there's only ever
  // one for this component, so no ambiguity, and it's robust to whatever alias ends
  // up assigned.
  const routeSourceInfo = Object.values(join?.sources || {})[0]?.sourceInfo;

  const {
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
  } = useReportRow({ apiLoad, apiUpdate, item, externalSource, isEdit });

  const { graphs } = useGraphPublish({
    item,
    isEdit,
    apiUpdate,
    routes,
    reportRow,
    persistRoutes,
    pageState,
    setActionParam,
    clearActionParam,
  });

  const toggleRoute = (index) => {
    setExpandedRoutes(prev => ({ ...prev, [index]: !prev[index] }));
  };

  // Pairs each visible route with its real index in the full `routes` array —
  // every mutation handler (reorder/rename/remove/toggle-graph) keys off that real
  // index, not the filtered list's position, so filtering never disturbs them.
  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return routes
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => !q || (r.name || '').toLowerCase().includes(q));
  }, [routes, searchQuery]);

  const isDuplicateRoute = pendingRoute
    ? routes.some(r => String(r.route_id) === String(pendingRoute.route_id))
    : false;

  const addRouteId = pageState?.filters?.find(f => f.searchKey === 'add_route_id' && f.type === 'action')?.values?.[0];

  const fetchDynamicRoute = async () => {
    if (!isEdit || !addRouteId || !apiLoad || !routeSourceInfo) return;
    setLoading(true);

    const udaConfig = buildUdaConfig({
      externalSource: routeSourceInfo,
      columns: routeSourceInfo.columns.map(c => ({ ...c, show: true })),
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
    if (isEdit && addRouteId) {
      fetchDynamicRoute();
    }
  }, [isEdit, addRouteId]);

  const confirmAddRoute = async () => {
    if (!pendingRoute) return;
    try {
      await addRoute(pendingRoute);
      setPendingRoute(null);
      clearActionParam('add_route_id');
    } catch (e) {
      // addRoute already records the error in useReportRow's `error` state.
    }
  };

  const cancelAdd = () => {
    setPendingRoute(null);
    clearActionParam('add_route_id');
  };
  return (
    <div className={t.wrapper}>
      <div className={t.title}>{item?.title}</div>
      <div className={t.titleWrapper}>
        <div>Routes{reportRow ? <span className={t.routeCount}>({routes.length})</span> : null}</div>
        <Button themeOptions={{ size: "xs", color: "transparent" }} onClick={() => setIsRoutesExpanded(!isRoutesExpanded)}>
          {isRoutesExpanded ? <Icon icon="ChevronUp" /> : <Icon icon="ChevronDown" />}
        </Button>
      </div>
      {isRoutesExpanded && (
        <>
          {isEdit && (
            <AddRouteBanner
              theme={t}
              Button={Button}
              pendingRoute={pendingRoute}
              saving={saving}
              isDuplicate={isDuplicateRoute}
              onConfirm={confirmAddRoute}
              onCancel={cancelAdd}
            />
          )}
          {!reportRow ? (
            <div className={t.skeletonWrapper}>
              <div className={t.skeletonRow} />
              <div className={t.skeletonRow} />
            </div>
          ) : null}
          {loading ? <div className={t.loading}>Loading…</div> : null}
          {reportRow && routes.length > 0 && (
            <div className={t.searchWrapper}>
              <Input
                placeholder="Search routes…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery ? (
                <Button themeOptions={{ size: "xs", color: "transparent" }} title="Clear search" onClick={() => setSearchQuery('')}>
                  <Icon icon="CancelCircle" />
                </Button>
              ) : null}
            </div>
          )}
          <div className={t.list}>
            {filteredEntries.map(({ r, i }) => (
              <RouteRow
                key={r.route_comp_id ?? i}
                route={r}
                theme={t}
                Button={Button}
                Input={Input}
                Icon={Icon}
                isEdit={isEdit}
                saving={saving}
                isExpanded={!!expandedRoutes[i]}
                onToggleExpand={() => toggleRoute(i)}
                isEditingName={editingRouteNameIndex === i}
                editNameValue={editNameValue}
                onEditNameValueChange={setEditNameValue}
                onStartEditName={() => { setEditingRouteNameIndex(i); setEditNameValue(r.name); }}
                onSaveEditName={() => { updateRoute({ index: i, updates: { name: editNameValue } }); setEditingRouteNameIndex(null); }}
                onCancelEditName={() => setEditingRouteNameIndex(null)}
                isEditingDates={editingRouteDatesIndex === i}
                editStartDateValue={editStartDateValue}
                editEndDateValue={editEndDateValue}
                onEditStartDateValueChange={setEditStartDateValue}
                onEditEndDateValueChange={setEditEndDateValue}
                onStartEditDates={() => { setEditingRouteDatesIndex(i); setEditStartDateValue(r.startDate); setEditEndDateValue(r.endDate); }}
                onSaveEditDates={() => { updateRoute({ index: i, updates: { startDate: editStartDateValue, endDate: editEndDateValue } }); setEditingRouteDatesIndex(null); }}
                onCancelEditDates={() => setEditingRouteDatesIndex(null)}
                graphs={graphs}
                onToggleGraph={(sectionId) => toggleRouteGraph(i, sectionId)}
                canMoveUp={i > 0}
                canMoveDown={i < routes.length - 1}
                onReorderUp={() => reorderRoutes(i, 'up')}
                onReorderDown={() => reorderRoutes(i, 'down')}
                onRemove={() => removeRoute(i)}
              />
            ))}
            {!loading && reportRow && routes.length === 0 ? (
              <div className={t.empty}>No routes added — add one from the “Add a Route to Your Report” section.</div>
            ) : null}
            {!loading && reportRow && routes.length > 0 && filteredEntries.length === 0 ? (
              <div className={t.empty}>No routes match “{searchQuery}”.</div>
            ) : null}
          </div>
        </>
      )}
      {error ? <div className={t.error}>{error}</div> : null}
    </div>
  );
}
