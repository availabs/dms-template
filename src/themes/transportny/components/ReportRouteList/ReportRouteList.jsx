import { useContext, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { ComponentContext, PageContext } from "../../../../dms/packages/dms/src/patterns/page/context";
import { ThemeContext, getComponentTheme } from '../../../../dms/packages/dms/src/ui/useTheme'
import { convertToUrlParams } from "../../../../dms/packages/dms/src/patterns/page/pages/_utils";
import { reportRouteListTheme } from './ReportRouteList.theme';
import { useReportRow } from './useReportRow';
import { useGraphPublish } from './useGraphPublish';
import { useAddGraphSection } from './useAddGraphSection';
import { useDynamicReportRoutes, distinctRouteSlotGroups } from './useDynamicReportRoutes';
import { resolveRouteDates } from './relativeDateResolution';
import RouteRow from './RouteRow';
import RouteTagBrowserModal from '../RouteTagBrowserModal/RouteTagBrowserModal';
import AddGraphModal from '../AddGraphModal/AddGraphModal';

export default function ReportRouteList({ isEdit: sectionEditorOpen }) {
  const { apiLoad, apiUpdate, updateAttribute, pageState, setActionParam, clearActionParam, item, editPageMode } = useContext(PageContext) || {};
  const { state: { join, externalSource } } = useContext(ComponentContext) || {};
  // Two independent flags, not one — conflating them is what let every RRL mutation
  // fire the instant the PAGE opened at /edit/..., without this section ever being
  // individually put into its own edit mode (see planning/tasks/current/reportroutelist.md,
  // "Section edit-mode gating").
  // `editPageMode` (from PageContext) is whichever sections array (`draft_sections` vs
  // `sections`) sibling components are ACTUALLY rendering from right now — that's what
  // useGraphPublish's sectionsKey tracks, and what decides whether an author sees raw
  // Dynamic Report slot placeholders vs a viewer's resolved routes. It says nothing
  // about whether THIS section has been opened for editing.
  // `props.isEdit` (destructured above as `sectionEditorOpen`) IS that per-section signal
  // — dataWrapper's Edit path (mounted only for the one section a user clicked the
  // section's own "Edit" pencil on, sectionArray.jsx's `edit.index === i`) always sets it
  // true; the View path (every other section, even on an /edit/... page) always sets it
  // false. See dataWrapper/index.jsx lines 197/457.
  const isEdit = Boolean(editPageMode);
  // Gates every actual mutation (route add/remove/reorder/rename/date-edit,
  // graph-chip toggling, the Dynamic Report switch, +Add Route/Route Slot/Graph) —
  // requires BOTH being on the page's /edit/... route AND having this section's own
  // pencil open, matching how Card/Spreadsheet gate row CRUD via SectionEdit vs
  // SectionView. `isEdit &&` is redundant given dataWrapper's own invariant (the Edit
  // path only exists inside the page's edit route to begin with) but kept explicit —
  // see useReportRow.js's persistRoutes for why a single, obvious choke point matters.
  const canMutate = isEdit && Boolean(sectionEditorOpen);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { UI, theme: themeFromContext = {} } = useContext(ThemeContext) || {};
  const { Button, Input, Icon, ColorPicker, Switch } = UI || {};
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

  // Dynamic Reports: a `page.filters` entry tagged `type: 'routeSlots'` marks this page as a
  // shared, reused report — routes are filled at view time from its URL param, never persisted
  // per-viewer. Absence means a normal report; every dynamic-only branch below gates on
  // `isDynamicReport` so a normal report is completely unaffected. See
  // dynamic-reports-and-route-tags.md item 3.
  const routeSlotFilter = pageState?.filters?.find(f => f.type === 'routeSlots');
  const isDynamicReport = !!routeSlotFilter;
  const routeIds = isDynamicReport
    ? (Array.isArray(routeSlotFilter.values) ? routeSlotFilter.values : [routeSlotFilter.values]).filter(Boolean)
    : [];

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
  } = useReportRow({ apiLoad, apiUpdate, item, externalSource, isEdit: canMutate });

  // `routes` above are this Dynamic Report's persisted SLOT PLACEHOLDERS (route_comp_id/graphIds/
  // color assigned once at authoring time, no concrete tmc_array/dates yet) — resolve them against
  // the real route ids the viewer's URL supplies. Never persisted; a pure in-memory overlay.
  const { resolvedRoutes, resolvedGroupRoutes } = useDynamicReportRoutes({
    apiLoad,
    routeSourceInfo,
    slots: routes,
    routeIds,
    enabled: isDynamicReport && !isEdit && routeIds.length > 0,
  });
  // Grouped, not raw route count (2026-08-03): several slot rows can share one `route_slot_group`
  // when they're different date/settings VIEWS of the same one real route a viewer picks once (see
  // useDynamicReportRoutes.js) — the required/expected URL id count is the number of DISTINCT
  // groups, not the number of persisted route rows. Falls back to one group per row (identical to
  // `routes.length`) for every Dynamic Report authored before this field existed.
  const routeSlotGroups = distinctRouteSlotGroups(routes);
  const needsRouteSelection = isDynamicReport && !isEdit && routeIds.length !== routeSlotGroups.length;

  // A viewer sees the resolved real routes (both in this panel and in every self-bound graph);
  // an author always authors against the raw placeholders. Identical to `routes` for every normal
  // (non-dynamic) report.
  //
  // Wrapped through resolveRouteDates (Mechanism B — relativeDate/isRelativeDateBase, see
  // dynamic-reports-and-route-tags.md item 3): a route/slot converted from an old relativeDate
  // comp carries a `dateFormula`/`derivedFromRoute` pair instead of (or alongside, as a frozen
  // conversion-time fallback) a plain literal date — this recomputes it live against whichever
  // sibling entry currently holds that `route_comp_id`, so editing a base route's date (in edit
  // mode, via RouteRow's normal date editor) recomputes every derived row immediately, same
  // "never persist a stale value" architecture as applyDerivedPageVariables. A no-op, identity-
  // stable pass-through for every route/slot without a formula.
  const effectiveRoutes = resolveRouteDates((isDynamicReport && !isEdit) ? resolvedRoutes : routes);

  const { addGraphSection } = useAddGraphSection({ item, apiUpdate, updateAttribute, isEdit: canMutate });

  const { graphs } = useGraphPublish({
    item,
    isEdit,
    canMutate,
    apiUpdate,
    routes: effectiveRoutes,
    reportRow,
    persistRoutes,
    pageState,
    setActionParam,
    clearActionParam,
  });

  // Toggling Dynamic Report mode adds/removes the `routeSlots`-typed page-filter registration —
  // the same optimistic-patch-then-persist pattern useAddGraphSection.js already uses for
  // draft_sections. Does NOT retroactively convert any already-added concrete routes into slots —
  // build a Dynamic Report starting from a blank routes list.
  const toggleDynamicReport = async (enabled) => {
    if (!canMutate || !apiUpdate || !item?.id) return;
    const withoutRouteSlots = (item.filters || []).filter(f => f.type !== 'routeSlots');
    const nextFilters = enabled
      ? [...withoutRouteSlots, { id: 'dyn-report-routes', searchKey: 'routes', useSearchParams: true, values: '', type: 'routeSlots' }]
      : withoutRouteSlots;
    updateAttribute?.('', '', { filters: nextFilters });
    await apiUpdate({ data: { id: item.id, filters: nextFilters }, skipNavigate: true });
  };

  // "+ Add Route Slot" reuses addRoutes verbatim (already assigns route_comp_id/color/deduped
  // name to an arbitrary object) — a slot isn't a specific route, so there's no catalog to browse.
  // `isPlaceholderName: true` marks this generated name as meaningless (see
  // useDynamicReportRoutes.js's resolvedRoutes merge) — the ONE spot in this file that creates a
  // name with nothing real behind it yet; cleared the moment a human renames it (onSaveEditName).
  const handleAddRouteSlot = () => addRoutes([{ name: `Route Slot ${routes.length + 1}`, isPlaceholderName: true }]);

  const toggleRoute = (index) => {
    setExpandedRoutes(prev => ({ ...prev, [index]: !prev[index] }));
  };

  // Pairs each visible route with its real index in `effectiveRoutes` — every mutation handler
  // (reorder/rename/remove/toggle-graph) keys off that real index, not the filtered list's
  // position, so filtering never disturbs them. `effectiveRoutes === routes` for every normal
  // report and for a Dynamic Report in edit mode; mutation controls are inert in view mode
  // anyway (RouteRow gates every one of them on `isEdit`), so a Dynamic Report viewer rendering
  // off the resolved array is safe even though its indices don't correspond to the persisted one.
  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return effectiveRoutes
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => !q || (r.name || '').toLowerCase().includes(q));
  }, [effectiveRoutes, searchQuery]);

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
      {reportRow && needsRouteSelection && (
        <RouteTagBrowserModal
          open={true}
          setOpen={() => {}}
          dismissible={false}
          apiLoad={apiLoad}
          routeSourceInfo={routeSourceInfo}
          selectionMode="exact"
          requiredCount={routeSlotGroups.length}
          initialSelectedRoutes={resolvedGroupRoutes}
          onConfirm={(selectedRoutes) => {
            // Rebuild by GROUP POSITION rather than trusting the modal's Map insertion order —
            // `selectedRoutes` mixes routes pre-populated from the URL (already resolved) with
            // newly-picked ones for whichever group(s) were still missing, and a missing group
            // isn't always the last one. Keep every already-resolved id in its original slot,
            // fill the gaps with the newly-picked ids in the order they were selected.
            const stillNeededIds = selectedRoutes.map((r) => r.id).filter((id) => !routeIds.includes(id));
            let cursor = 0;
            const fullIds = routeSlotGroups.map((_, j) => routeIds[j] ?? stillNeededIds[cursor++]);
            const params = convertToUrlParams({ [routeSlotFilter.searchKey]: fullIds });
            navigate(`${pathname}?${params}`);
          }}
        />
      )}
      <div className={t.title}>{item?.title}</div>
      <div className={t.titleWrapper}>
        <div>Routes{reportRow ? <span className={t.routeCount}>({effectiveRoutes.length})</span> : null}</div>
        <Button themeOptions={{ size: "xs", color: "transparent" }} onClick={() => setIsRoutesExpanded(!isRoutesExpanded)}>
          {isRoutesExpanded ? <Icon icon="ChevronUp" /> : <Icon icon="ChevronDown" />}
        </Button>
      </div>
      {isRoutesExpanded && (
        <>
          {canMutate && (
            <div className={t.dynamicToggleWrapper}>
              <Switch enabled={isDynamicReport} setEnabled={toggleDynamicReport} label="Dynamic Report" size="small" />
              <span className={t.dynamicToggleLabel}>
                Dynamic Report — routes are filled at view time from the URL, not stored on this page.
              </span>
            </div>
          )}
          {canMutate && (
            <div className={t.addRouteWrapper}>
              {isDynamicReport ? (
                <Button themeOptions={{ size: 'sm', color: 'transparent' }} onClick={handleAddRouteSlot}>
                  <Icon icon="Plus" className={t.addRouteSearchIcon} /> Add Route Slot
                </Button>
              ) : (
                <>
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
                </>
              )}
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
          {reportRow && effectiveRoutes.length > 0 && (
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
                isEdit={canMutate}
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
                  // A deliberate rename — even to something generic — is a real editorial
                  // decision from here on; clears isPlaceholderName so a future Dynamic Report
                  // resolution never overwrites it with the resolved route's own name again.
                  updateRoute({ index: i, updates: { name: editNameValue, isPlaceholderName: false } });
                  setEditingRouteNameIndex(null);
                }}
                onCancelEditName={() => setEditingRouteNameIndex(null)}
                derivedFromRouteName={r.dateFormula ? effectiveRoutes.find((rt) => rt.route_comp_id === r.derivedFromRoute)?.name : null}
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
                canMoveDown={i < effectiveRoutes.length - 1}
                onReorderUp={() => reorderRoutes(i, 'up')}
                onReorderDown={() => reorderRoutes(i, 'down')}
                onRemove={() => removeRoute(i)}
              />
            ))}
            {reportRow && effectiveRoutes.length === 0 ? (
              <div className={t.empty}>
                {isDynamicReport && !isEdit ? 'Select routes to view this report.' : 'No routes added — add one above.'}
              </div>
            ) : null}
            {reportRow && effectiveRoutes.length > 0 && filteredEntries.length === 0 ? (
              <div className={t.empty}>No routes match “{searchQuery}”.</div>
            ) : null}
          </div>
        </>
      )}
      {error ? <div className={t.error}>{error}</div> : null}
    </div>
  );
}
