import React, { useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cloneDeep } from 'lodash-es';
import { ThemeContext, getComponentTheme } from '../../../../dms/packages/dms/src/ui/useTheme';
import { PageContext, CMSContext } from '../../../../dms/packages/dms/src/patterns/page/context';
import { quickControlsTheme } from './QuickControls.theme';
import { applyMeasurePick, isReportPage } from '../MeasurePicker';
import {
  MEASURE_OPTIONS,
  MEASURE_CATEGORIES,
  resolutionOptionsFor,
  COMPARISON_MODE_OPTIONS,
  DEFAULT_PICK,
  resolveReliabilityBin,
  resolveReliabilityYear,
  RELIABILITY_BIN_LABELS,
  PM3_VIEW_BY_YEAR,
} from '../MeasurePicker/composeMeasureConfig';
import { MAP_MEASURE_OPTIONS } from '../MeasurePicker/composeMapConfig';
import { ROUTE_CATALOG_PARAM_KEY } from '../ReportRouteList/useGraphPublish';
import { resolveRouteDates } from '../ReportRouteList/relativeDateResolution';
import { SELF_PARAM_KEY_SENTINEL } from '../../../../dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/buildUdaConfig';
import { DOW_DEFS, WEEKDAY_KEYS, WEEKEND_KEYS, isDayOn, summarizeWeekdays, PEAK_PRESETS, timeOfDayToken, formatDateShort } from '../ReportRouteList/utils';

/**
 * NPMRDS "Quick Controls" — sectionHeaderExtensions builder for "AVL Graph"/"Spreadsheet"/"Map".
 *
 * Design push #2 (2026-08-06): grows from 2 pills (Measure, Comparison Mode) to 5 (Routes,
 * Measure, When, Aggregate, Mode) — the exact facets that moved OFF the route (weekday mask,
 * time-of-day, route assignment) now live here, on the graph's own `display._measurePick`
 * (see MeasurePicker/composeMeasureConfig.js's DEFAULT_PICK and useGraphPublish.js's per-graph
 * transformReportRoutes, which reads these same fields back out). Every pill still writes
 * through the shared `applyMeasurePick` so this row and the older Settings-drawer item-group
 * (MeasurePicker/index.js) can never silently drift.
 *
 * report-authoring-ux-overhaul.md Tier 5 (2026-08-20): added a left-aligned "layout" group —
 * Move Up/Down buttons (via `actions.moveItem`, the same array-splice `sectionArray.jsx` already
 * exposes in its own Settings-drawer toolbar) plus a Width pill (reads/writes the section's own
 * `size` attribute — same field/mechanism as sectionMenu.jsx's Settings-drawer Width control) —
 * pinned to this row's own left edge, deliberately separate from the right-aligned DATA pill
 * cluster below (routes/measure/when/aggregate/mode). Both simply expose an already-working,
 * already-persisting capability one click closer, matching every other pill in this row.
 *
 * Two design decisions kept from the mockup (npmrds-report.js:929-1073):
 *   1. WHEN IS ONE PILL, not two — time-of-day and day-of-week are one thought ("weekday PM
 *      peak"), splitting them would double the pill count for no gain.
 *   2. THE ROW COMPRESSES. Not every card is wide enough for every DATA pill — below a certain
 *      width the row measures itself and folds the lowest-priority pills into one "⋯" pill that
 *      opens the same popover contents, in this drop order: mode → aggregate → when → measure.
 *      Routes never drops — it's the reason this row exists. The left-aligned layout group
 *      (Move Up/Down, Width) is outside this whole mechanism entirely — see the row's own JSX
 *      comment.
 *
 * 2026-08-19 (report-authoring-ux-overhaul.md item 4): this row now mounts and stays interactive
 * for the whole time a PAGE is open at /edit/... — no longer gated on this section's own
 * SectionEdit pencil being clicked first (see QuickControlsRow's `editPageMode` check). Picks
 * persist via `actions.updateAttribute`, the same channel drag-reorder already uses under
 * SectionView, not `dwAPI.setState` alone (dead for persistence there).
 */
export function npmrdsQuickControls({ state, dwAPI, currentComponent, canEditSection, siblingSections = [], pageState, actions, sectionState, auth }) {
  // Gate on the actual self-binding mechanism (an enabled `$self` comparison_series subscriber —
  // the same test `useGraphPublish.js`'s `findSelfBoundGraphs` uses to decide whether a section
  // receives a published route list at all) rather than `state?.comparisonSeries?.enabled`, a
  // Graph/Spreadsheet-only convenience flag `route_map.py`'s Map template builders never set
  // (Map has its own `symbologies`/series-template layer mechanism — see
  // `dynamic-report-nongraph-section-binding.md` item 1). Checking `comparisonSeries.enabled`
  // meant the "Routes" pill structurally could never render for a Map section in edit mode, even
  // though `_measurePick`/`routeIds` resolve and publish correctly for Map exactly like any other
  // self-bound section. Still correctly excludes an incidental Spreadsheet with no self-binding at
  // all (e.g. this report's own "Add a Route to Your Report" search grid — found live 2026-08-06,
  // Quick Controls was rendering a meaningless "no routes / travel time / all day" pill row on it
  // before this check was added) since that section carries no such subscriber either.
  const isSelfBound = (state?.display?._functions?.subscribers || []).some(
    (s) => s?.functionId === 'comparison_series' && s?.enabled && s?.paramKey === SELF_PARAM_KEY_SENTINEL
  );
  if (!(canEditSection && currentComponent?.useDataSource && isSelfBound && isReportPage(siblingSections))) return null;
  return (
    <QuickControlsRow
      state={state}
      dwAPI={dwAPI}
      currentComponent={currentComponent}
      pageState={pageState}
      actions={actions}
      sectionValue={sectionState?.value}
      sectionIndex={sectionState?.i}
      // Reordering is a page-LAYOUT operation, same as sectionMenu.jsx's own Move
      // Up/Down toolbar buttons (`!isEdit && canEditPageLayout && canEditSection`) —
      // gated on the 'edit-page'/'edit-page-layout' permission (here named
      // `canEditPageContent`, section.jsx's own name for the identical
      // isUserAuthed(['edit-page','edit-page-layout'], ...) check), not just
      // `canEditSection` alone. Width has no such extra gate below, matching
      // sectionMenu.jsx's own Width control, which only checks `canEditSection`.
      canReorder={!!auth?.canEditPageContent}
    />
  );
}

// "AM Peak"/"PM Peak"/... token map — mirrors the mockup's RES_TOKEN, short enough to survive a
// narrow pill.
const RES_TOKEN = { '5-minutes': '5m', '15-minutes': '15m', hour: '1h', day: '1d', weekday: 'wk', month: '1mo' };

// The unit/qualifier is in the popover; the pill just needs the bare measure name — "Speed (mph)"
// and "CO2 Emissions (tonnes) — Passenger" both truncate badly in a header this compact.
function qcMeasureLabel(label) {
  return (label || 'measure').replace(/\s*\([^)]*\)/, '').replace(/\s*—.*$/, '');
}

function qcDaysToken(weekdays) {
  const summary = summarizeWeekdays(weekdays);
  if (!summary) return 'all';
  if (summary === 'Weekdays only') return 'Wd';
  if (summary === 'Weekends only') return 'We';
  const on = DOW_DEFS.filter(({ key }) => isDayOn(weekdays, key)).length;
  return `${on}d`;
}

function QuickControlsRow({ state, dwAPI, currentComponent, pageState, actions, sectionValue, sectionIndex, canReorder }) {
  // `canEditSection` (checked by the caller) is true for any logged-in author, even one just
  // browsing the real published site — `editPageMode` is the only signal that actually means
  // "this page is open at /edit/...". Checked here (inside a real mounted component) rather than
  // in the outer `npmrdsQuickControls`, which is a plain function and can't call hooks. First line,
  // before any other hook below, so this component's hook count never varies across renders (this
  // page's edit/view route never toggles without a full remount — see
  // report-authoring-ux-overhaul.md item 4).
  const { editPageMode } = useContext(PageContext) || {};
  if (!editPageMode) return null;
  const { UI, theme: themeFromContext = {} } = useContext(ThemeContext) || {};
  const { Popup, Icon } = UI || {};
  // Only a Map's own Measure pill reads this (its choropleth layer's tile join needs the
  // join-capable host — see composeMapConfig.js's header); every chart/table pill is unaffected.
  const { API_HOST, fileUploadInfo } = useContext(CMSContext) || {};
  const apiHost = fileUploadInfo?.DAMA_HOST || API_HOST;
  const t = { ...quickControlsTheme, ...getComponentTheme(themeFromContext, 'quickControls') };
  const pick = { ...DEFAULT_PICK, ...(state?.display?._measurePick || {}) };

  // Width — reads/writes the exact same top-level section attribute (`value.size`,
  // a col-span-out-of-12 key) sectionMenu.jsx's own "Width" Settings-drawer item
  // already does via `updateAttribute('size', name)` (see sectionMenu.jsx's Width
  // menu entry) — this pill is a discoverability shortcut for a capability that
  // already exists and already persists, not a new mechanism.
  const sectionArrayTheme = getComponentTheme(themeFromContext, 'pages.sectionArray');
  const sizeMap = sectionArrayTheme?.sizes || {};
  const sizeKeys = Object.keys(sizeMap).sort(
    (a, b) => (+sizeMap[a]?.iconSize || 100) - (+sizeMap[b]?.iconSize || 100)
  );
  const currentSize = sectionValue?.size || sectionArrayTheme?.defaultSize || '1';
  const applyWidth = (name) => actions?.updateAttribute?.('size', name);
  // currentComponent?.type (the ComponentRegistry's own identity), not state.display.graphType /
  // pick.graphType — a Map section's stored state never carries either field (confirmed live
  // 2026-08-07: _measurePick only ever has weekdays/start/end/routeIds), so both would silently
  // fall back to DEFAULT_PICK's 'LineGraph'. See dynamic-report-nongraph-section-binding.md item 9.
  const isMapCard = currentComponent?.type === 'Map';
  const graphType = isMapCard ? 'Map' : (state?.display?.graphType || pick.graphType);
  const hasMode = graphType !== 'Map' && graphType !== 'Table';
  // Tier 5I (2026-08-20): Map has its OWN measure concept now (MAP_MEASURE_OPTIONS — "none" or a
  // choropleth measure), so it gets a Measure pill too — just not Aggregate (no resolution/
  // time-bucket concept for a Map at all, unlike Table/every chart type).
  const hasMeasure = true;
  const hasAggregate = !isMapCard;

  const routeCatalog = useMemo(() => {
    const values = pageState?.filters?.find((f) => f.searchKey === ROUTE_CATALOG_PARAM_KEY && f.type === 'action')?.values;
    return Array.isArray(values) ? values : [];
  }, [pageState?.filters]);
  const routeIds = pick.routeIds || [];
  const routesById = useMemo(() => new Map(routeCatalog.map((r) => [r.route_comp_id, r])), [routeCatalog]);
  // Gap #16 (2026-08-21): reliability's year resolution needs every route's REAL resolved date
  // range — `routeCatalog` carries a derived route's raw (blank) startDate/endDate plus its
  // `derivedFromRoute` pointer, so running it through `resolveRouteDates` once here (not per
  // measure-pick) gives `resolveReliabilityYear` a routes array it can actually read dates from.
  const allRoutesResolved = useMemo(() => resolveRouteDates(routeCatalog), [routeCatalog]);

  // `pick.weekdays`/`pick.start`/`pick.end` (the bare scalar) is dead — report_build.mjs stopped
  // writing it and useGraphPublish.js stopped reading it the moment `routeWindows` shipped
  // (2026-08-14). This pill's "one window for the whole graph" model still applies for now (a real
  // per-route control is a separate, larger gap — report-route-ui-parity-gaps.md #18); it just
  // needs to read/write `routeWindows` instead. Shown/edited value is the FIRST assigned route's
  // own window (routeWindows[id][0]) — representative, not necessarily true of every route if one
  // was set to something different outside this pill (e.g. by report_build.mjs), same "first
  // assigned route" convention the difference-graph anchor already uses elsewhere in this file.
  const currentWindow = pick.routeWindows?.[routeIds[0]]?.[0] || {};

  // Persists through `actions.updateAttribute` — the channel `section.jsx`'s `SectionView` threads
  // all the way to `sectionArray.jsx`'s debounced `onChange`, which demonstrably already persists
  // today with zero pencil-click (drag-reorder uses the same channel). `dwAPI.setState` alone (the
  // only channel this used to write through) is dead for persistence under `SectionView` — its
  // Save-effect is hardcoded `if (!isEdit) return` there, regardless of what `onChange` prop was
  // passed in from above (see report-authoring-ux-overhaul.md item 4).
  //
  // Runs the exact shared `applyMeasurePick` (the same function the older Settings-drawer picker
  // uses) TWICE rather than re-deriving its compose/reconcile logic here — once against a `dwAPI`
  // shim that mutates a plain clone of `state` so the full next-state can be persisted, once
  // (when a real `dwAPI` is mounted, i.e. under `SectionEdit`) against the live state for instant
  // visual feedback. This is deliberate: `applyMeasurePick` is the one place that must never drift
  // between this row and MeasurePicker/index.js — duplicating its Map-vs-AVL-Graph branching and
  // reconcile step here instead would reintroduce exactly that drift risk.
  const applyPick = (partial) => {
    const nextState = cloneDeep(state);
    applyMeasurePick({ state: nextState, dwAPI: { setState: (updater) => updater(nextState) }, currentComponent, apiHost, allRoutes: allRoutesResolved }, partial);
    actions?.updateAttribute?.('element', { ...sectionValue?.element, 'element-data': JSON.stringify(nextState) });
    // Harmless no-op-for-persistence nicety under SectionView (see above); real instant feedback
    // under SectionEdit. Either way, the round-trip once draft_sections/sections comes back down
    // as a fresh `state` prop is what actually reflects the change.
    if (dwAPI?.setState) applyMeasurePick({ state, dwAPI, currentComponent, apiHost, allRoutes: allRoutesResolved }, partial);
  };

  // Writes ONE window to every currently-assigned route's routeWindows entry (index 0 only —
  // this pill has no concept of a route with 2+ variants), merging onto whichever facets
  // (weekdays vs. time-of-day) this particular call isn't changing so the two stay independent,
  // matching the old scalar's behavior exactly.
  const applyWindowToAllRoutes = (partial) => {
    const nextWindow = { ...currentWindow, ...partial };
    const nextRouteWindows = { ...(pick.routeWindows || {}) };
    routeIds.forEach((id) => { nextRouteWindows[id] = [nextWindow]; });
    applyPick({ routeWindows: nextRouteWindows });
  };

  const toggleRoute = (routeCompId) => {
    const adding = !routeIds.includes(routeCompId);
    const nextRouteIds = adding ? [...routeIds, routeCompId] : routeIds.filter((id) => id !== routeCompId);
    // A newly-added route inherits the graph's current window (the same one every other route on
    // this card already shows) rather than starting unrestricted — otherwise it would silently
    // diverge from what the "When" pill displays, the exact inconsistency this pill exists to
    // prevent.
    const nextRouteWindows = adding
      ? { ...(pick.routeWindows || {}), [routeCompId]: [currentWindow] }
      : pick.routeWindows;
    applyPick({ routeIds: nextRouteIds, ...(nextRouteWindows ? { routeWindows: nextRouteWindows } : {}) });
  };
  const setWeekday = (key, on) => {
    const next = { ...(currentWindow.weekdays || {}) };
    // Only an explicit `false` is meaningful (see utils.js's generateDateRange) — matches the
    // route-side convention this replaces, so storage never carries a same-meaning-but-verbose
    // all-true object.
    if (on) delete next[key]; else next[key] = false;
    applyWindowToAllRoutes({ weekdays: next });
  };
  const applyDowPreset = (onKeys) => {
    const next = {};
    DOW_DEFS.forEach(({ key }) => { if (!onKeys.includes(key)) next[key] = false; });
    applyWindowToAllRoutes({ weekdays: next });
  };
  const applyTodPreset = (preset) => applyWindowToAllRoutes({ start: preset.startTime, end: preset.endTime });
  // Tier 5D (2026-08-20): a Table's Measure pill toggles membership in `pick.measures` (one
  // column per entry) instead of replacing `pick.measure` outright — the same distinction
  // AddGraphModal's own creation-time checklist makes, for the same reason (a table has no
  // one-measure ceiling the way every chart type still does).
  const toggleTableMeasure = (m) => {
    const has = (pick.measures || []).includes(m);
    const nextMeasures = has ? pick.measures.filter((x) => x !== m) : [...(pick.measures || []), m];
    applyPick({ measures: nextMeasures });
  };

  const isTable = graphType === 'Table';
  // Gap #16 (2026-08-21): same "UI checks the identical gate compose uses" pattern routeCompare's
  // Summary-only gate established — resolveReliabilityBin/resolveReliabilityYear are the EXACT
  // functions composeTableMeasuresConfig itself calls, so this can never drift from what actually
  // gets applied.
  const reliabilityBin = isTable ? resolveReliabilityBin(pick.routeIds, pick.routeWindows) : null;
  const reliabilityYear = isTable && reliabilityBin ? resolveReliabilityYear(pick.routeIds, allRoutesResolved) : null;
  const reliabilityAvailable = isTable && pick.resolution === 'summary' && !!reliabilityBin && !!PM3_VIEW_BY_YEAR[reliabilityYear];
  const reliabilityActive = reliabilityAvailable && !!pick.includeReliability;
  const reliabilityDisabledReason = !isTable ? null
    : pick.resolution !== 'summary' ? 'Reliability needs Summary resolution (one row per route).'
    : !reliabilityBin ? 'Reliability needs the When window set to exactly AM Peak, Midday, PM Peak, or an all-weekend day mask — no other window has a precomputed value.'
    : !PM3_VIEW_BY_YEAR[reliabilityYear] ? `No 1410 reliability data published for ${reliabilityYear ?? 'these routes’ dates'} yet.`
    : null;
  const measureLabel = isTable
    ? (() => {
        const base = (pick.measures || []).length
          ? `${pick.measures.length} measure${pick.measures.length === 1 ? '' : 's'}`
          : (reliabilityActive ? 'reliability' : 'no measures');
        const extras = [];
        if ((pick.measures || []).length && pick.routeCompare && pick.resolution === 'summary') extras.push('compare');
        if ((pick.measures || []).length && reliabilityActive) extras.push('reliability');
        return extras.length ? `${base} + ${extras.join(' + ')}` : base;
      })()
    : isMapCard
      ? qcMeasureLabel(MAP_MEASURE_OPTIONS.find((o) => o.value === pick.measure)?.label || 'None')
      : qcMeasureLabel(MEASURE_OPTIONS.find((o) => o.value === pick.measure)?.label);
  const routeLabel = routeIds.length === 0
    ? 'no routes'
    : routeIds.length === 1
      ? (routesById.get(routeIds[0])?.name || '1 route')
      : `${routeIds.length} routes`;
  const whenToken = `${timeOfDayToken(currentWindow.start, currentWindow.end)} · ${qcDaysToken(currentWindow.weekdays)}`;
  const whenTitle = `When · ${(currentWindow.start && currentWindow.end) ? `${currentWindow.start}–${currentWindow.end}` : 'all day'} · ${(summarizeWeekdays(currentWindow.weekdays) || 'all days').toLowerCase()}`;
  const aggregateLabel = RES_TOKEN[pick.resolution] || pick.resolution;
  const modeIsDifference = pick.comparisonMode === 'difference';

  // Ordered lowest-priority-last — this IS the drop order (a prefix of this array is kept).
  const pillDefs = useMemo(() => {
    const defs = [
      { kind: 'routes', label: routeLabel, title: 'Routes on this card', strong: routeIds.length === 0 },
    ];
    // Aggregate is an AVL-Graph/Table-only concept — a Map card has no resolution/time-bucket
    // pick at all. Measure applies to every graph type now, Map included (Tier 5I, 2026-08-20) —
    // just against MAP_MEASURE_OPTIONS's own, much shorter list instead of the chart vocabulary.
    if (hasMeasure) defs.push({ kind: 'measure', label: measureLabel, title: isTable ? 'Measures on this table' : isMapCard ? `Color by · ${MAP_MEASURE_OPTIONS.find((o) => o.value === pick.measure)?.label || ''}` : `Measure · ${MEASURE_OPTIONS.find((o) => o.value === pick.measure)?.label || ''}` });
    defs.push({ kind: 'when', label: whenToken, title: whenTitle });
    if (hasAggregate) defs.push({ kind: 'aggregate', label: aggregateLabel, title: `Aggregate · ${resolutionOptionsFor(graphType).find((o) => o.value === pick.resolution)?.label || ''}` });
    // Short text, not the mockup's own glyph — building/maintaining a plain-vs-difference SVG
    // pair for one pill wasn't worth it next to the existing short-token convention every other
    // pill already uses (found live 2026-08-06: an earlier icon-only-sized version of this pill
    // rendered "Overlay"/"Difference" as text inside a 24px square, overflowing it).
    if (hasMode) defs.push({ kind: 'mode', label: modeIsDifference ? 'Diff' : 'Overlay', title: `Comparison mode · ${modeIsDifference ? 'difference' : 'overlay'}`, strong: modeIsDifference });
    return defs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeLabel, measureLabel, whenToken, whenTitle, aggregateLabel, modeIsDifference, hasMode, hasMeasure, hasAggregate, isMapCard, routeIds.length, pick.measure, pick.resolution, isTable]);

  // Width — a layout pill, not a data pill (see the left-aligned `layoutGroup` in the JSX below,
  // alongside Move Up/Down). Deliberately NOT part of `pillDefs`/the responsive fit-and-overflow
  // system above: that system exists to protect the DATA pills' visibility on a narrow card, and
  // this section's Settings-drawer already offers Width unconditionally, so there's no "must
  // always be reachable from this row" pressure the way there is for e.g. Routes.
  const widthPillDef = { kind: 'width', label: currentSize === '12' ? 'Full' : `${currentSize}/12`, title: `Width · ${currentSize} of 12 columns` };

  // ── Row-fit: measure the real rendered width of every pill (in an off-screen shadow copy,
  // so widths stay accurate for pills currently trimmed from the visible row) against the
  // row's own available width, then greedily keep as many as fit, reserving the "⋯" pill's own
  // width up front. See npmrds-report.js:1035-1069's identical algorithm and reasoning — this is
  // a much simpler port of it since the live header band renders this row on its OWN full-width
  // line below the title (theme.headerExtensionsRow), unlike the mockup's assumption that the
  // title/kebab share the same row and eat into this row's budget.
  const wrapperRef = useRef(null);
  const shadowRefs = useRef([]);
  const shadowMoreRef = useRef(null);
  const [keepCount, setKeepCount] = useState(pillDefs.length);
  const GAP = 6;

  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const measure = () => {
      const budget = el.clientWidth;
      const widths = shadowRefs.current.slice(0, pillDefs.length).map((n) => n?.offsetWidth || 0);
      const moreWidth = shadowMoreRef.current?.offsetWidth || 0;
      const totalAll = widths.reduce((a, w) => a + w, 0) + GAP * Math.max(0, widths.length - 1);
      if (totalAll <= budget) { setKeepCount(pillDefs.length); return; }
      let used = moreWidth;
      let keep = 0;
      for (let i = 0; i < widths.length; i++) {
        if (used + widths[i] + GAP > budget) break;
        used += widths[i] + GAP;
        keep++;
      }
      setKeepCount(Math.max(1, keep)); // Routes always survives — it's why the row exists.
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pillDefs]);

  const visiblePills = pillDefs.slice(0, keepCount);
  const overflowKinds = pillDefs.slice(keepCount).map((p) => p.kind);

  // ── Popover section bodies — shared by a single pill's own popover and the "⋯" pill's
  // combined one (kind === 'all' renders every applicable section). ──
  const renderRoutesSection = () => (
    <div className={t.popSection}>
      <div className={t.popSectionLabel}>routes · pick any</div>
      {routeCatalog.length === 0 ? (
        <div className={t.popEmpty}>No routes on this report yet.</div>
      ) : (
        <div className={t.popRouteList}>
          {routeCatalog.map((r) => {
            const on = routeIds.includes(r.route_comp_id);
            return (
              <button key={r.route_comp_id} type="button" className={on ? t.popRouteRowOn : t.popRouteRow} onClick={() => toggleRoute(r.route_comp_id)}>
                <span className={on ? t.popRouteCheckOn : t.popRouteCheck}>{on ? <Icon icon="Check" /> : null}</span>
                <span className={t.popRouteDot} style={{ backgroundColor: r.color }} />
                <span className={t.popRouteName}>{r.name}</span>
                <span className={t.popRouteMeta}>{formatDateShort(r.startDate) ? `${formatDateShort(r.startDate)}–${formatDateShort(r.endDate)}` : ''}</span>
              </button>
            );
          })}
        </div>
      )}
      {modeIsDifference && routeIds.length !== 2 && (
        <div className={t.popWarning}>Difference mode compares exactly two routes; this card has {routeIds.length}.</div>
      )}
    </div>
  );

  // Map (Tier 5I, 2026-08-20): its own, much shorter, flat MAP_MEASURE_OPTIONS list — "none" or
  // one of the few measures with an authored choropleth default — never the full chart-vocabulary
  // MEASURE_CATEGORIES grid below, which has no Map-shaped meaning.
  const renderMeasureSection = () => (
    <div className={t.popSection}>
      <div className={t.popSectionLabel}>{isTable ? 'measures · pick any' : isMapCard ? 'color by' : 'measure'}</div>
      {isMapCard ? (
        <div className={t.popMeasureList}>
          {MAP_MEASURE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={opt.value === pick.measure ? t.popMeasureItemOn : t.popMeasureItem}
              onClick={() => applyPick({ measure: opt.value })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : (
        <div className={t.popMeasureList}>
          {MEASURE_CATEGORIES.map((cat) => (
            <div key={cat.label}>
              <div className={t.popGroupLabel}>{cat.label}</div>
              {cat.measures.map((m) => {
                const opt = MEASURE_OPTIONS.find((o) => o.value === m);
                if (!opt) return null;
                // Table: multi-select (toggles membership in `pick.measures`, one column each).
                // Every other graph type: single-select (replaces `pick.measure` outright) — the
                // same distinction AddGraphModal's own creation-time fields make.
                const on = isTable ? (pick.measures || []).includes(m) : m === pick.measure;
                return (
                  <button
                    key={m}
                    type="button"
                    className={on ? t.popMeasureItemOn : t.popMeasureItem}
                    onClick={() => (isTable ? toggleTableMeasure(m) : applyPick({ measure: m }))}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
      {isTable && !(pick.measures || []).length && !reliabilityActive && (
        <div className={t.popWarning}>No measures selected — this table has no columns to show.</div>
      )}
      {isTable && (pick.measures || []).length ? (
        <div className={t.popPillRow}>
          {/* report-authoring-ux-overhaul.md gap #16 (2026-08-21): only a real route-vs-route
              comparison at Summary resolution — see composeTableMeasuresConfig's own doc comment
              for why __ANCHOR__ can't produce a meaningful per-bucket delta at any other
              resolution. Disabled (not hidden), matching the Mode pill's own Difference-count gate. */}
          <button
            type="button"
            disabled={pick.resolution !== 'summary'}
            title={pick.resolution !== 'summary' ? 'Route Compare only works at Summary resolution.' : undefined}
            className={pick.resolution !== 'summary' ? t.pillDisabled : (pick.routeCompare ? t.pillOn : t.pill)}
            onClick={() => applyPick({ routeCompare: !pick.routeCompare })}
          >
            Route Compare · % vs Main
          </button>
        </div>
      ) : null}
      {isTable && pick.resolution !== 'summary' ? (
        <div className={t.popNote}>Route Compare needs Summary resolution (one row per route) to compare routes against each other.</div>
      ) : isTable && pick.routeCompare ? (
        <div className={t.popNote}>Adds a "% vs Main" column per measure, compared against whichever route is first in this report's list (the anchor).</div>
      ) : null}
      {isTable ? (
        <div className={t.popPillRow}>
          {/* Gap #16 (2026-08-21): source 1410's LOTTR/TTTR/Freeflow, joined live to whichever
              Postgres view matches these routes' own year — see resolveReliabilityBin/Year's own
              doc comments for exactly what has to line up before this can turn on. */}
          <button
            type="button"
            disabled={!reliabilityAvailable}
            title={reliabilityDisabledReason || undefined}
            className={!reliabilityAvailable ? t.pillDisabled : (pick.includeReliability ? t.pillOn : t.pill)}
            onClick={() => applyPick({ includeReliability: !pick.includeReliability })}
          >
            Reliability (LOTTR/TTTR/Freeflow)
          </button>
        </div>
      ) : null}
      {isTable && reliabilityDisabledReason ? (
        <div className={t.popNote}>{reliabilityDisabledReason}</div>
      ) : isTable && reliabilityActive ? (
        <div className={t.popNote}>Adds LOTTR/TTTR ({RELIABILITY_BIN_LABELS[reliabilityBin]}) and Freeflow Speed columns from source 1410, year {reliabilityYear}.</div>
      ) : null}
    </div>
  );

  const renderWhenSection = () => (
    <>
      <div className={t.popSection}>
        <div className={t.popSectionLabel}>time of day · which hours of each day</div>
        <div className={t.popPillRow}>
          {PEAK_PRESETS.map((preset) => {
            const on = currentWindow.start === preset.startTime && currentWindow.end === preset.endTime;
            return (
              <button key={preset.label} type="button" className={on ? t.pillOn : t.pill} onClick={() => applyTodPreset(preset)}>
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className={t.popSection}>
        <div className={t.popSectionLabel}>days of week</div>
        <div className={t.popPillRow}>
          {DOW_DEFS.map(({ key, label }) => {
            const on = isDayOn(currentWindow.weekdays, key);
            return (
              <button key={key} type="button" className={on ? t.dayOn : t.dayOff} onClick={() => setWeekday(key, !on)}>
                {label}
              </button>
            );
          })}
        </div>
        <div className={t.popPillRow}>
          <button type="button" className={t.pill} onClick={() => applyDowPreset(WEEKDAY_KEYS)}>Weekdays</button>
          <button type="button" className={t.pill} onClick={() => applyDowPreset(WEEKEND_KEYS)}>Weekends</button>
          <button type="button" className={t.pill} onClick={() => applyDowPreset(DOW_DEFS.map((d) => d.key))}>All</button>
        </div>
      </div>
    </>
  );

  const renderAggregateSection = () => (
    <div className={t.popSection}>
      <div className={t.popSectionLabel}>aggregate</div>
      <div className={t.popPillRow}>
        {resolutionOptionsFor(graphType).map((o) => (
          <button key={o.value} type="button" className={o.value === pick.resolution ? t.pillOn : t.pill} onClick={() => applyPick({ resolution: o.value })}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );

  const renderModeSection = () => (
    <div className={t.popSection}>
      <div className={t.popSectionLabel}>comparison mode</div>
      <div className={t.popPillRow}>
        {COMPARISON_MODE_OPTIONS.map((o) => {
          // report-authoring-ux-overhaul.md Tier 5E (2026-08-20, Ryan's call via
          // AskUserQuestion: "show but disable"): Difference only makes sense with
          // exactly 2 routes — stays visible/discoverable, but isn't pickable outside
          // that count. Deliberately does NOT also disable it while it's already the
          // active selection and the count later drifted away from 2 (e.g. a route
          // removed after the fact) — an author must be able to switch back to Plain
          // in that state, which disabling the CURRENT selection would block.
          const blocked = o.value === 'difference' && routeIds.length !== 2 && pick.comparisonMode !== 'difference';
          return (
            <button
              key={o.value}
              type="button"
              disabled={blocked}
              title={blocked ? `Difference mode needs exactly 2 routes; this card has ${routeIds.length}.` : undefined}
              className={blocked ? t.pillDisabled : (o.value === pick.comparisonMode ? t.pillOn : t.pill)}
              onClick={() => applyPick({ comparisonMode: o.value })}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {modeIsDifference && <div className={t.popNote}>Drawn as main − other; the anchor is the first route in the list.</div>}
      {modeIsDifference && routeIds.length !== 2 && (
        <div className={t.popWarning}>Difference mode compares exactly two routes; this card has {routeIds.length}. Fix the Routes pill, or switch back to Overlay.</div>
      )}
    </div>
  );

  const renderWidthSection = () => (
    <div className={t.popSection}>
      <div className={t.popSectionLabel}>width · columns out of 12</div>
      <div className={t.popPillRow}>
        {sizeKeys.map((key) => (
          <button key={key} type="button" className={key === currentSize ? t.pillOn : t.pill} onClick={() => applyWidth(key)}>
            {key}
          </button>
        ))}
      </div>
    </div>
  );

  // `width` is deliberately not here — it's rendered directly in the left-aligned layout group
  // below, not through the pillDefs/overflow ("⋯") system this map serves.
  const sectionRenderers = { routes: renderRoutesSection, measure: renderMeasureSection, when: renderWhenSection, aggregate: renderAggregateSection, mode: renderModeSection };

  const pillButton = (def, ref) => (
    <button
      ref={ref}
      type="button"
      className={def.strong ? t.pillStrong : t.pillDefault}
      title={def.title}
    >
      {def.label}
    </button>
  );

  return (
    <div className={t.rowWrapper}>
      {/* Layout group — Move Up/Down + Width — pinned to the row's own left edge, entirely
          separate from the right-aligned data-pill cluster below (both in placement and in the
          responsive fit/overflow logic, which only ever measures that cluster). */}
      <div className={t.reorderGroup}>
        {canReorder && Number.isInteger(sectionIndex) ? (
          <>
            <button type="button" className={t.reorderBtn} title="Move section up" onClick={() => actions?.moveItem?.(sectionIndex, -1)}>
              <Icon icon="ChevronUpSquare" />
            </button>
            <button type="button" className={t.reorderBtn} title="Move section down" onClick={() => actions?.moveItem?.(sectionIndex, 1)}>
              <Icon icon="ChevronDownSquare" />
            </button>
          </>
        ) : null}
        <Popup button={pillButton(widthPillDef)} preferredPosition="bottom">
          {() => <div className={t.popBody}>{renderWidthSection()}</div>}
        </Popup>
      </div>
      {/* Own flex-1 sibling (not part of rowWrapper's own flow) so the layout group
          above stays pinned left while this cluster stays right-justified — and so
          the row-fit measurement below sees only ITS OWN available width, not the
          layout group's. */}
      <div className={t.wrapper} ref={wrapperRef}>
        {visiblePills.map((def) => (
          <Popup key={def.kind} button={pillButton(def)} preferredPosition="bottom">
            {() => <div className={t.popBody}>{sectionRenderers[def.kind]()}</div>}
          </Popup>
        ))}
        {overflowKinds.length > 0 && (
          <Popup
            button={
              <button type="button" className={t.morePill} title="The rest of this card's controls">
                <Icon icon="More" />
              </button>
            }
            preferredPosition="bottom"
          >
            {() => <div className={t.popBody}>{overflowKinds.map((kind) => <React.Fragment key={kind}>{sectionRenderers[kind]()}</React.Fragment>)}</div>}
          </Popup>
        )}

        {/* Off-screen shadow copy of every pill, always fully rendered regardless of the visible
            trim state above — this is what keeps widths accurate for a pill currently folded into
            "⋯" once the row grows wide enough to show it again. */}
        <div aria-hidden="true" style={{ position: 'absolute', visibility: 'hidden', top: -9999, left: -9999, display: 'flex', gap: GAP, pointerEvents: 'none' }}>
          {pillDefs.map((def, i) => (
            <React.Fragment key={def.kind}>{pillButton(def, (el) => { shadowRefs.current[i] = el; })}</React.Fragment>
          ))}
          <button ref={shadowMoreRef} type="button" className={t.morePill}><Icon icon="More" /></button>
        </div>
      </div>
    </div>
  );
}
