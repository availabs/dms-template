import { useContext, useMemo, useState } from 'react';
import { ComponentContext, PageContext } from "../../../../dms/packages/dms/src/patterns/page/context";
import { ThemeContext, getComponentTheme } from '../../../../dms/packages/dms/src/ui/useTheme'
import { reportRouteListTheme } from './ReportRouteList.theme';
import { useReportRow } from './useReportRow';
import { useGraphPublish } from './useGraphPublish';
import { useAddGraphSection } from './useAddGraphSection';
import RouteRow from './RouteRow';
import RouteTagBrowserModal from '../RouteTagBrowserModal/RouteTagBrowserModal';
import AddGraphModal from '../AddGraphModal/AddGraphModal';

export default function ReportRouteList() {
  const { apiLoad, apiUpdate, updateAttribute, pageState, setActionParam, clearActionParam, item, editPageMode } = useContext(PageContext) || {};
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
  const { Button, Input, Icon, ColorPicker } = UI || {};
  const t = { ...reportRouteListTheme, ...getComponentTheme(themeFromContext, 'reportRouteList') };
  const [expandedRoutes, setExpandedRoutes] = useState({});
  const [isRoutesExpanded, setIsRoutesExpanded] = useState(true);
  const [editingRouteNameIndex, setEditingRouteNameIndex] = useState(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [editingRouteDatesIndex, setEditingRouteDatesIndex] = useState(null);
  const [editStartDateValue, setEditStartDateValue] = useState('');
  const [editEndDateValue, setEditEndDateValue] = useState('');
  const [editWeekdaysValue, setEditWeekdaysValue] = useState({});
  // Rendering-only — filters which already-added routes are displayed, never the
  // underlying `routes` array that persistence/graph publishing operate on.
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddGraphModalOpen, setIsAddGraphModalOpen] = useState(false);

  // The route CATALOG binding — read-only, backs the "Add Route" tag-browser modal
  // (see `RouteTagBrowserModal`). Bound via the sectionMenu's "Add Join Source" slot rather
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
    addRoutes,
    removeRoute,
    reorderRoutes,
    updateRoute,
    toggleRouteGraph,
    assignRoutesToGraph,
  } = useReportRow({ apiLoad, apiUpdate, item, externalSource, isEdit });

  const { addGraphSection } = useAddGraphSection({ item, apiUpdate, updateAttribute, isEdit });

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

  // `id` (the row's own DMS id) is the universal identity — every catalog row has one
  // regardless of provenance. `route_id` only ever existed on legacy-imported rows, kept as a
  // fallback purely to still catch dupes among routes added to a report BEFORE this fix shipped
  // (their stored copy predates fetching `id` at all) — never load-bearing for anything added
  // going forward. Never clutter the modal's default/browse views with routes already on this
  // report — re-adding one is still allowed (a different date range is a legitimate use case),
  // just not surfaced as a default suggestion.
  const excludeRouteIds = useMemo(
    () => routes.flatMap((r) => [r.id, r.route_id]).filter((v) => v != null),
    [routes]
  );

  const handleConfirmAddRoutes = async (selectedRoutes) => {
    try {
      await addRoutes(selectedRoutes);
    } catch (e) {
      // addRoutes already records the error in useReportRow's `error` state.
    }
  };

  const handleConfirmAddGraph = async ({ pick, selectedRouteIds }) => {
    const trackingId = await addGraphSection(pick);
    if (!trackingId || !selectedRouteIds?.length) return;
    const indexes = routes
      .map((r, i) => (selectedRouteIds.includes(r.route_comp_id) ? i : -1))
      .filter((i) => i !== -1);
    await assignRoutesToGraph(indexes, trackingId);
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
            <div className={t.addRouteWrapper}>
              <Button themeOptions={{ size: 'sm', color: 'transparent' }} onClick={() => setIsAddModalOpen(true)}>
                <Icon icon="Plus" className={t.addRouteSearchIcon} /> Add Route
              </Button>
              <RouteTagBrowserModal
                open={isAddModalOpen}
                setOpen={setIsAddModalOpen}
                apiLoad={apiLoad}
                routeSourceInfo={routeSourceInfo}
                selectionMode="any"
                excludeRouteIds={excludeRouteIds}
                onConfirm={handleConfirmAddRoutes}
              />
              <Button themeOptions={{ size: 'sm', color: 'transparent' }} onClick={() => setIsAddGraphModalOpen(true)}>
                <Icon icon="Plus" className={t.addRouteSearchIcon} /> Add Graph
              </Button>
              <AddGraphModal
                open={isAddGraphModalOpen}
                setOpen={setIsAddGraphModalOpen}
                routes={routes}
                onConfirm={handleConfirmAddGraph}
              />
            </div>
          )}
          {!reportRow ? (
            <div className={t.skeletonWrapper}>
              <div className={t.skeletonRow} />
              <div className={t.skeletonRow} />
            </div>
          ) : null}
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
                ColorPicker={ColorPicker}
                onChangeColor={(c) => updateRoute({ index: i, updates: { color: c } })}
                isEdit={isEdit}
                saving={saving}
                isExpanded={!!expandedRoutes[i]}
                onToggleExpand={() => toggleRoute(i)}
                isEditingName={editingRouteNameIndex === i}
                editNameValue={editNameValue}
                onEditNameValueChange={setEditNameValue}
                onStartEditName={() => { setEditingRouteNameIndex(i); setEditNameValue(r.name); }}
                onSaveEditName={() => {
                  // Unlike addRoute's auto-suffix (the name came from the catalog, not
                  // typed by the user), a rename is an explicit user choice — block it
                  // instead of silently rewriting what they typed. See the dedupeRouteName
                  // comment in useReportRow.js for why names must stay unique at all.
                  const collision = routes.some((rt, idx) => idx !== i && rt.name === editNameValue);
                  if (collision) {
                    setError(`A route named "${editNameValue}" already exists.`);
                    return;
                  }
                  updateRoute({ index: i, updates: { name: editNameValue } });
                  setEditingRouteNameIndex(null);
                }}
                onCancelEditName={() => setEditingRouteNameIndex(null)}
                isEditingDates={editingRouteDatesIndex === i}
                editStartDateValue={editStartDateValue}
                editEndDateValue={editEndDateValue}
                onEditStartDateValueChange={setEditStartDateValue}
                onEditEndDateValueChange={setEditEndDateValue}
                editWeekdaysValue={editWeekdaysValue}
                onEditWeekdaysValueChange={setEditWeekdaysValue}
                onStartEditDates={() => { setEditingRouteDatesIndex(i); setEditStartDateValue(r.startDate); setEditEndDateValue(r.endDate); setEditWeekdaysValue(r.weekdays || {}); }}
                onSaveEditDates={() => {
                  // Only explicit `false` entries are meaningful (see useGraphPublish.js's
                  // generateDateRange) — stripping `true`/absent keys keeps storage matching
                  // the existing convention (e.g. converted old reports' `{saturday:false,
                  // sunday:false}`) and collapses back to `undefined` (all days) when every
                  // toggle is back on, instead of persisting a same-meaning-but-verbose object.
                  const excluded = Object.fromEntries(Object.entries(editWeekdaysValue).filter(([, v]) => v === false));
                  updateRoute({
                    index: i,
                    updates: {
                      startDate: editStartDateValue,
                      endDate: editEndDateValue,
                      weekdays: Object.keys(excluded).length ? excluded : undefined,
                    },
                  });
                  setEditingRouteDatesIndex(null);
                }}
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
            {reportRow && routes.length === 0 ? (
              <div className={t.empty}>No routes added — add one above.</div>
            ) : null}
            {reportRow && routes.length > 0 && filteredEntries.length === 0 ? (
              <div className={t.empty}>No routes match “{searchQuery}”.</div>
            ) : null}
          </div>
        </>
      )}
      {error ? <div className={t.error}>{error}</div> : null}
    </div>
  );
}
