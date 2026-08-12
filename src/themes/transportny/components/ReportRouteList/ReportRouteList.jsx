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
import { useRouteMileage } from './useRouteMileage';
import { resolveRouteDates, TODAY_ANCHOR_COMP_ID, defaultAnchorDate } from './relativeDateResolution';
import { formatDateShort } from './utils';
import RouteRow from './RouteRow';
import RouteTagBrowserModal from '../RouteTagBrowserModal/RouteTagBrowserModal';
import AddGraphModal from '../AddGraphModal/AddGraphModal';

export default function ReportRouteList({ isEdit: sectionEditorOpen }) {
  const { apiLoad, apiUpdate, updateAttribute, pageState, setActionParam, clearActionParam, item, editPageMode } = useContext(PageContext) || {};
  const { state: { join, externalSource } } = useContext(ComponentContext) || {};
  // Two independent flags, not one — conflating them is what let every RRL mutation
  // fire the instant the PAGE opened at /edit/..., without this section ever being
  // individually put into its own edit mode (see planning/transportny/tasks/current/reportroutelist.md,
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
  const { Icon, ColorPicker, Switch, Popup } = UI || {};
  const t = { ...reportRouteListTheme, ...getComponentTheme(themeFromContext, 'reportRouteList') };
  const [expandedRoutes, setExpandedRoutes] = useState({});
  const [isRoutesExpanded, setIsRoutesExpanded] = useState(true);
  const [editingRouteNameIndex, setEditingRouteNameIndex] = useState(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [editingRouteDatesIndex, setEditingRouteDatesIndex] = useState(null);
  const [editStartDateValue, setEditStartDateValue] = useState('');
  const [editEndDateValue, setEditEndDateValue] = useState('');
  // Mechanism B authoring buffer (relativeDateResolution.js) — mirrors the editStartDateValue/
  // editEndDateValue pattern above: parent owns the edit-buffer state, RouteRow is presentational.
  // 'fixed' | 'derived'; editDeriveFromValue is the picked base's route_comp_id; editDeriveFormulaValue
  // is the composed (or hand-typed, via the Advanced pattern) formula string.
  const [editDateMode, setEditDateMode] = useState('fixed');
  const [editDeriveFromValue, setEditDeriveFromValue] = useState('');
  const [editDeriveFormulaValue, setEditDeriveFormulaValue] = useState('');
  // Rendering-only — filters which already-added routes are displayed, never the
  // underlying `routes` array that persistence/graph publishing operate on.
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddGraphModalOpen, setIsAddGraphModalOpen] = useState(false);
  // Copy/paste a route's date span across routes — `from` is a route_comp_id (survives
  // reordering, unlike index). Design push #2 (2026-08-06) shrunk this to date-span only:
  // weekday mask/time-of-day moved off the route entirely (see useGraphPublish.js).
  const [clipboard, setClipboard] = useState(null);

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
    pasteWindowToRoutes,
  } = useReportRow({ apiLoad, apiUpdate, item, externalSource, isEdit: canMutate });

  // `routes` above are this Dynamic Report's persisted SLOT PLACEHOLDERS (route_comp_id/color
  // assigned once at authoring time, no concrete tmc_array/dates yet) — resolve them against
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

  // "Relative dates relative to today" follow-up (dynamic-reports-and-route-tags.md item 3): a
  // route can derive its date from a synthetic "Today (view time)" base exactly like it would
  // derive from any other real route — no changes needed to relativeDateResolution.js's resolver,
  // just one extra entry in the array it resolves (see effectiveRoutes below). `usesTodayAnchor` is
  // checked against the raw (unresolved) `routes`/slots, since dateFormula/derivedFromRoute are
  // authored fields that persist regardless of which real route fills a slot.
  const usesTodayAnchor = routes.some((r) => r.derivedFromRoute === TODAY_ANCHOR_COMP_ID);
  // Dynamic Reports only: a viewer can override "today" via a `type: 'baseDate'` page filter
  // (searchKey 'asOf'), registered alongside `routeSlots` by toggleDynamicReport below — mirrors
  // the routes URL param exactly. A normal report, or an author in edit mode previewing a formula,
  // always sees the real wall-clock date; there's no URL-driven "open" flow to attach an override
  // to outside Dynamic Reports' own entry gate (Ryan's call: fold the override into that gate only,
  // not a persistent always-visible control).
  const baseDateFilter = pageState?.filters?.find(f => f.type === 'baseDate');
  // Same array-or-scalar normalization `routeIds` already applies to `routeSlotFilter.values`
  // above — a URL-bound filter's `values` arrives wrapped in an array (even for a single value),
  // so a bare truthiness check on the array itself would always pass, even when it only contains
  // an empty string (e.g. `['']`, the default before any viewer has picked a date).
  const baseDateRawValues = Array.isArray(baseDateFilter?.values) ? baseDateFilter.values : [baseDateFilter?.values];
  const asOfOverride = isDynamicReport && !isEdit ? (baseDateRawValues.filter(Boolean)[0] || null) : null;
  // defaultAnchorDate() is real wall-clock today MINUS NPMRDS_DATA_LAG_DAYS, not literal today —
  // NPMRDS's own ClickHouse speed table publishes on a ~15-21 day lag (confirmed live 2026-08-10,
  // see relativeDateResolution.js), so a literal-today anchor would silently query a date range
  // with zero real rows. A viewer's explicit `?asOf=` override is never adjusted this way — that's
  // their own deliberate pick, same as picking any other historical date.
  const anchorDateStr = asOfOverride || defaultAnchorDate();
  const todayAnchorEntry = useMemo(
    () => ({ route_comp_id: TODAY_ANCHOR_COMP_ID, name: 'Today (view time)', startDate: anchorDateStr, endDate: anchorDateStr }),
    [anchorDateStr]
  );

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
  //
  // `todayAnchorEntry` rides along in the SAME array passed to resolveRouteDates so a route
  // deriving from TODAY_ANCHOR_COMP_ID resolves through the exact same lookup-by-route_comp_id
  // path as deriving from any real sibling — then it's filtered back out, since it was never a
  // real persisted route to render as its own row.
  const effectiveRoutes = resolveRouteDates([...((isDynamicReport && !isEdit) ? resolvedRoutes : routes), todayAnchorEntry])
    .filter((rt) => rt.route_comp_id !== TODAY_ANCHOR_COMP_ID);

  const { mileageByRouteCompId } = useRouteMileage({ apiLoad, routes: effectiveRoutes });

  const { addGraphSection } = useAddGraphSection({ item, apiUpdate, updateAttribute, isEdit: canMutate });

  // Design push #2 (2026-08-06) removed the per-graph assignment CHIPS a route used to show
  // (see RouteRow.jsx) — that's still gone, graph assignment is a QuickControls-owned field on
  // each graph's own state, not a route-side toggle. But `graphs` (the discovered self-bound
  // sibling graphs, already computed here for the publish/broadcast effects below) is exactly
  // the live source of truth for a lighter ask: how many graphs does each route feed, right now
  // — found live 2026-08-07, Ryan: "I don't see the number of graphs each route feeds, it should
  // be in the RRL." `routes[].graphIds` (the old per-route field the Python converter still
  // writes) is NOT used for this — it's write-once at conversion time and never updated when an
  // author reassigns a route via QuickControls' Routes pill (which only ever writes the GRAPH's
  // own `_measurePick.routeIds`), so it goes stale the moment anyone touches Quick Controls.
  const { graphs } = useGraphPublish({
    item,
    isEdit,
    routes: effectiveRoutes,
    pageState,
    setActionParam,
    clearActionParam,
  });
  const graphCountByCompId = useMemo(() => {
    const counts = new Map();
    graphs.forEach((g) => (g.routeIds || []).forEach((id) => counts.set(id, (counts.get(id) || 0) + 1)));
    return counts;
  }, [graphs]);

  // Toggling Dynamic Report mode adds/removes the `routeSlots`-typed page-filter registration —
  // the same optimistic-patch-then-persist pattern useAddGraphSection.js already uses for
  // draft_sections. Does NOT retroactively convert any already-added concrete routes into slots —
  // build a Dynamic Report starting from a blank routes list. Also registers the `baseDate`-typed
  // filter (searchKey 'asOf') alongside `routeSlots` — inert unless some route is later wired to
  // derive from the Today anchor, but registered unconditionally here so that capability is always
  // available on a Dynamic Report without needing to re-toggle this switch off and on.
  const toggleDynamicReport = async (enabled) => {
    if (!canMutate || !apiUpdate || !item?.id) return;
    const withoutDynamicFilters = (item.filters || []).filter(f => f.type !== 'routeSlots' && f.type !== 'baseDate');
    const nextFilters = enabled
      ? [
          ...withoutDynamicFilters,
          { id: 'dyn-report-routes', searchKey: 'routes', useSearchParams: true, values: '', type: 'routeSlots' },
          { id: 'dyn-report-asof', searchKey: 'asOf', useSearchParams: true, values: '', type: 'baseDate' },
        ]
      : withoutDynamicFilters;
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

  // Mechanism B (relativeDateResolution.js) authoring support. Eligible "Derive From" bases are
  // every route that isn't itself already derived — single-hop only, matches the resolver's own
  // constraint (a base is never itself derived by construction). RouteRow further excludes the row
  // being edited from this same list (it can't derive from itself). Carries startDate/endDate too
  // so RouteRow can show a live "resolves to" preview without a second lookup. `todayAnchorEntry`
  // is always prepended — "Today (view time)" is an eligible base for any route on any report,
  // Dynamic or not (Ryan's call: available everywhere, not gated to Dynamic Reports).
  const derivableSiblings = useMemo(
    () => [
      todayAnchorEntry,
      ...effectiveRoutes
        .filter((rt) => !rt.dateFormula)
        .map((rt) => ({ route_comp_id: rt.route_comp_id, name: rt.name, startDate: rt.startDate, endDate: rt.endDate })),
    ],
    [effectiveRoutes, todayAnchorEntry]
  );
  // Per-row "used as a base for: ..." lookup — purely a render-time convenience so an author
  // editing a route can see it has dependents before switching it TO a derived row itself (the
  // eligibility filter above already prevents deriving FROM an already-derived row, but doesn't by
  // itself warn a would-be base about who's relying on it).
  const baseForNamesByCompId = useMemo(() => {
    const map = new Map();
    effectiveRoutes.forEach((rt) => {
      if (!rt.dateFormula || !rt.derivedFromRoute) return;
      const list = map.get(rt.derivedFromRoute) || [];
      list.push(rt.name);
      map.set(rt.derivedFromRoute, list);
    });
    return map;
  }, [effectiveRoutes]);

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

  // Design push #2 (2026-08-06): `routeIds` now rides in `pick` itself (composed straight into
  // the new section's own `display._measurePick` by useAddGraphSection.js/applyMeasurePickToState)
  // instead of a separate post-create route-side write — a graph owns its own route assignment
  // now, RRL's `routes` storage row is never touched by adding a graph at all.
  const handleConfirmAddGraph = async ({ pick, selectedRouteIds }) => {
    await addGraphSection({ ...pick, routeIds: selectedRouteIds || [] });
  };

  // A Dynamic Report with no (or a mismatched) `?routes=` still needs to show its
  // blocking route-selection gate to a real viewer, or they'd hit a permanently blank
  // page with no way to ever pick routes. Hoisted to a variable rather than inlined
  // twice below: it's needed both in the normal authenticated-author render and in the
  // viewer-only early return just past it.
  const routeSelectionModal = reportRow && needsRouteSelection ? (
    <RouteTagBrowserModal
      open={true}
      setOpen={() => {}}
      dismissible={false}
      apiLoad={apiLoad}
      routeSourceInfo={routeSourceInfo}
      selectionMode="exact"
      requiredCount={routeSlotGroups.length}
      initialSelectedRoutes={resolvedGroupRoutes}
      // Ryan's call: fold the "as of" override into this same blocking gate rather than a
      // persistent always-visible control — only shown when this report actually has a route
      // deriving from the Today anchor, so every Dynamic Report that doesn't use it is unaffected.
      showAsOfDate={usesTodayAnchor}
      asOfDateValue={asOfOverride || anchorDateStr}
      onConfirm={(selectedRoutes, asOfDate) => {
        // Rebuild by GROUP POSITION rather than trusting the modal's Map insertion order —
        // `selectedRoutes` mixes routes pre-populated from the URL (already resolved) with
        // newly-picked ones for whichever group(s) were still missing, and a missing group
        // isn't always the last one. Keep every already-resolved id in its original slot,
        // fill the gaps with the newly-picked ids in the order they were selected.
        const stillNeededIds = selectedRoutes.map((r) => r.id).filter((id) => !routeIds.includes(id));
        let cursor = 0;
        const fullIds = routeSlotGroups.map((_, j) => routeIds[j] ?? stillNeededIds[cursor++]);
        const paramsObj = { [routeSlotFilter.searchKey]: fullIds };
        // `baseDateFilter` may not be registered yet on a report authored before this feature
        // shipped (toggleDynamicReport only adds it going forward) — silently skip the URL param
        // in that case rather than writing an unbound one nothing will ever read.
        // convertToUrlParams silently drops any key whose value isn't itself an array
        // (`!Array.isArray(values)` check, _utils/index.js) — `fullIds` above already satisfies
        // this; a bare scalar date string here would too, and vanish from the URL with no error.
        if (usesTodayAnchor && baseDateFilter) paramsObj[baseDateFilter.searchKey] = [asOfDate || anchorDateStr];
        const params = convertToUrlParams(paramsObj);
        navigate(`${pathname}?${params}`);
      }}
    />
  ) : null;

  // A real viewer (not an author on the page's /edit/... route) never sees this panel
  // at all — mirrors the old tool, whose route sidebar never rendered outside
  // authoring either. Deliberately NOT implemented via the generic `hideInView` section
  // flag: that flag filters the whole section (this component included) out of the tree
  // before it ever mounts, which would also silently swallow `routeSelectionModal` above
  // — confirmed live, 2026-08-05, a Dynamic Report with `hideInView` on and no
  // `?routes=` rendered nothing, forever, with no way to pick routes. Self-hiding here
  // instead keeps that one exception alive; it's also unconditional (no per-report
  // author toggle to forget), which is what was actually wanted.
  if (!isEdit) {
    // Render an invisible marker instead of bare `null` when there's no modal either —
    // sectionGroup.jsx's rail wrapper looks for `.dms-rail-collapsed` via a CSS `:has()`
    // selector to collapse its own width/chrome (see its "collapseRailIfEmpty" comment).
    // A `:has(...:empty)` check was tried first and doesn't work: SectionArrayComp/
    // dataWrapper always emit real wrapper markup (grid + padding divs) around this
    // component regardless of what it returns, so the rail's DOM is never actually
    // `:empty` even when this returns bare `null` — `:has()` finding this explicit,
    // deliberately-rendered marker (at any depth) is what actually works.
    return routeSelectionModal || <span className="hidden dms-rail-collapsed" />;
  }

  return (
    <div className={t.wrapper}>
      {routeSelectionModal}
      <div className={t.panelHead}>
        <Icon icon="Road" className={t.panelHeadIcon} />
        <span className={t.title}>Routes</span>
        {reportRow ? <span className={t.routeCount}>{effectiveRoutes.length}</span> : null}
        <button type="button" className={t.panelCollapseBtn} title={isRoutesExpanded ? 'Collapse routes' : 'Expand routes'} onClick={() => setIsRoutesExpanded(!isRoutesExpanded)}>
          <Icon icon={isRoutesExpanded ? "ChevronUp" : "ChevronDown"} />
        </button>
      </div>
      {isRoutesExpanded && (
        <>
          {canMutate && (
            <div className={t.actionsRow}>
              {isDynamicReport ? (
                <button type="button" className={t.addRouteBtn} onClick={handleAddRouteSlot}>
                  <Icon icon="Plus" className={t.addBtnIcon} /><span className={t.addBtnLabel}>Add Route Slot</span>
                </button>
              ) : (
                <>
                  <button type="button" className={t.addRouteBtn} onClick={() => setIsAddModalOpen(true)}>
                    <Icon icon="Plus" className={t.addBtnIcon} /><span className={t.addBtnLabel}>Add Route</span>
                  </button>
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
              <button type="button" className={t.addGraphBtn} onClick={() => setIsAddGraphModalOpen(true)}>
                <Icon icon="Plus" className={t.addGraphBtnIcon} /><span className={t.addBtnLabel}>Add Graph</span>
              </button>
              <AddGraphModal
                open={isAddGraphModalOpen}
                setOpen={setIsAddGraphModalOpen}
                routes={routes}
                onConfirm={handleConfirmAddGraph}
              />
            </div>
          )}
          {canMutate && (
            <div className={t.dynamicToggleWrapper}>
              <Switch enabled={isDynamicReport} setEnabled={toggleDynamicReport} label="Dynamic Report" size="small" />
              <span className={t.dynamicToggleLabel}>Dynamic Report</span>
            </div>
          )}
          {canMutate && clipboard && (() => {
            // Every route except the copy source and any derived-date route (its dates come
            // from a sibling, not a span it can accept a paste onto).
            const pasteAllTargets = effectiveRoutes
              .map((r, i) => ({ r, i }))
              .filter(({ r }) => r.route_comp_id !== clipboard.from && !r.dateFormula);
            return (
              <div className={t.clipboardStrip}>
                <div className={t.clipboardStripHead}>
                  <Icon icon="Copy" className={t.clipboardStripIcon} />
                  <span className={t.clipboardStripLabel}>date span copied · {clipboard.fromName}</span>
                  <button type="button" className={t.clipboardStripClear} title="Forget the copied date span" onClick={() => setClipboard(null)}>
                    <Icon icon="XMark" />
                  </button>
                </div>
                <div className={t.clipboardStripPreview}>
                  {(formatDateShort(clipboard.start) || formatDateShort(clipboard.end))
                    ? `${formatDateShort(clipboard.start) || '?'} – ${formatDateShort(clipboard.end) || '?'}`
                    : 'No dates set'}
                </div>
                {pasteAllTargets.length > 0 && (
                  <button
                    type="button"
                    className={t.clipboardStripPasteAll}
                    onClick={() => pasteWindowToRoutes(pasteAllTargets.map(({ i }) => i), { startDate: clipboard.start, endDate: clipboard.end })}
                  >
                    <Icon icon="Paste" /> paste into all ({pasteAllTargets.length})
                  </button>
                )}
              </div>
            );
          })()}
          {!reportRow ? (
            <div className={t.skeletonWrapper}>
              <div className={t.skeletonRow} />
              <div className={t.skeletonRow} />
            </div>
          ) : null}
          {reportRow && effectiveRoutes.length > 0 && (
            <div className={t.searchOuterWrapper}>
              <div className={t.searchInnerBox}>
                <Icon icon="Search" className={t.searchIcon} />
                <input
                  type="text"
                  placeholder="Search routes…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 min-w-0 bg-transparent font-proxima text-[12.5px] text-slate-700 placeholder:text-slate-400 focus:outline-none"
                />
                {searchQuery ? (
                  <button type="button" className={t.searchClearBtn} title="Clear search" onClick={() => setSearchQuery('')}>
                    <Icon icon="CancelCircle" />
                  </button>
                ) : null}
              </div>
            </div>
          )}
          <div className={t.list}>
            {filteredEntries.map(({ r, i }) => (
              <RouteRow
                key={r.route_comp_id ?? i}
                route={r}
                miles={mileageByRouteCompId.get(r.route_comp_id)}
                graphCount={graphCountByCompId.get(r.route_comp_id) || 0}
                theme={t}
                Icon={Icon}
                ColorPicker={ColorPicker}
                Popup={Popup}
                onChangeColor={(c) => updateRoute({ index: i, updates: { color: c } })}
                onCopyWindow={() => setClipboard({
                  from: r.route_comp_id,
                  fromName: r.name,
                  start: r.startDate,
                  end: r.endDate,
                })}
                onPasteWindow={() => clipboard && updateRoute({
                  index: i,
                  updates: { startDate: clipboard.start, endDate: clipboard.end },
                })}
                clipboard={clipboard}
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
                derivedFromRouteName={r.dateFormula ? (r.derivedFromRoute === TODAY_ANCHOR_COMP_ID ? todayAnchorEntry.name : effectiveRoutes.find((rt) => rt.route_comp_id === r.derivedFromRoute)?.name) : null}
                baseForNames={baseForNamesByCompId.get(r.route_comp_id) || []}
                derivableSiblings={derivableSiblings}
                isEditingDates={editingRouteDatesIndex === i}
                editStartDateValue={editStartDateValue}
                editEndDateValue={editEndDateValue}
                onEditStartDateValueChange={setEditStartDateValue}
                onEditEndDateValueChange={setEditEndDateValue}
                editDateMode={editDateMode}
                onEditDateModeChange={setEditDateMode}
                editDeriveFromValue={editDeriveFromValue}
                onEditDeriveFromValueChange={setEditDeriveFromValue}
                editDeriveFormulaValue={editDeriveFormulaValue}
                onEditDeriveFormulaValueChange={setEditDeriveFormulaValue}
                onStartEditDates={() => {
                  setEditingRouteDatesIndex(i);
                  // Seeded from `r` (effectiveRoutes' already-resolved entry, see the
                  // resolveRouteDates wiring above) — a row currently deriving its dates shows the
                  // real current resolved value here, not a stale/frozen literal, so switching to
                  // Fixed mode starts from the right dates instead of blank or stale ones.
                  setEditStartDateValue(r.startDate);
                  setEditEndDateValue(r.endDate);
                  setEditDateMode(r.dateFormula ? 'derived' : 'fixed');
                  setEditDeriveFromValue(r.derivedFromRoute || '');
                  setEditDeriveFormulaValue(r.dateFormula || '');
                }}
                onSaveEditDates={() => {
                  if (editDateMode === 'derived') {
                    // Atomic: both fields together in one updateRoute call, matching the
                    // resolver's own requirement (relativeDateResolution.js only resolves when
                    // BOTH dateFormula and derivedFromRoute are present) — never persist one
                    // without the other. startDate/endDate are deliberately left as whatever's
                    // already stored: resolveRouteDates recomputes the displayed value live on
                    // every read, and the untouched literal becomes a safe frozen fallback if the
                    // base or formula is ever removed later — the same convention
                    // convert_old_reports.py's own resolver uses.
                    updateRoute({
                      index: i,
                      updates: { dateFormula: editDeriveFormulaValue, derivedFromRoute: editDeriveFromValue },
                    });
                  } else {
                    updateRoute({
                      index: i,
                      updates: {
                        startDate: editStartDateValue,
                        endDate: editEndDateValue,
                        // Switching back to Fixed removes the relationship — editStartDateValue/
                        // editEndDateValue above were seeded from the live-resolved value (see
                        // onStartEditDates), so nothing goes blank.
                        dateFormula: undefined,
                        derivedFromRoute: undefined,
                      },
                    });
                  }
                  setEditingRouteDatesIndex(null);
                }}
                onCancelEditDates={() => setEditingRouteDatesIndex(null)}
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
