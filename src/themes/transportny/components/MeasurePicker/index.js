/**
 * NPMRDS "Measure" picker — sectionMenu item-group builder.
 *
 * Registered for the "AVL Graph" component via theme.sectionMenuExtensions
 * (see theme.js / themev2.js) and the generic dms-side extension point in
 * sectionMenu.jsx / sectionMenuExtensions.js. Only offered when the page has
 * a ReportRouteList sibling section (isReportPage below) — this is a
 * report-building tool, not a generic AVL Graph feature. Lets an author pick
 * Graph Type + Measure + Resolution + Comparison Mode and generates the
 * underlying columns/join/comparisonSeries(.combine + the $self-bound
 * ReportRouteList subscriber)/display config live, writing through
 * dwAPI.setState the same way the built-in join/comparisonSeries/pivot menus
 * do — the result stays editable afterward via those same generic controls
 * (author-empowerment principle, root CLAUDE.md). The goal is that applying
 * a pick leaves the graph exactly as report-ready as the Report Page
 * template's own pre-wired starter graph — immediately assignable via
 * ReportRouteList, not just "has the right columns."
 *
 * v1 is a "smart default generator": every apply fully re-composes and
 * overwrites the fields it owns (columns/join/comparisonSeries.combine/
 * display.colors) rather than tracking drift against a saved spec — see the
 * task file's "Workstream 2" section for the design record.
 */

import {
    composeMeasureConfig,
    GRAPH_TYPE_OPTIONS,
    MEASURE_OPTIONS,
    RESOLUTION_OPTIONS,
    COMPARISON_MODE_OPTIONS,
    DEFAULT_PICK,
    BASE_SOURCE,
} from './composeMeasureConfig';
import { selfParamKey } from '../../../../dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/buildUdaConfig';
import { reconcileComparisonSeriesColumnOnState } from '../../../../dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/useDataWrapperAPI';

// Every target this picker can ever assign to a column (xAxis always;
// yAxis/color depending on graph type). Any existing column carrying one of
// these targets is replaced on apply, tagged origin or not — confirmed
// live-necessary against report section 2189959 (a Python-converter-built
// "Route Line Graph, Speed"): its pre-existing yAxis/xAxis columns predate
// this picker and carry no origin tag, so an origin-only filter left them in
// place and produced duplicate yAxis/xAxis columns (5 total instead of 2)
// the first time the picker ran on it. "categorize" (the comparison-series
// discriminator, or any author-added grouping dimension) is deliberately
// excluded — never owned by this picker, see the comment above
// MEASURE_PICKER_COLUMN_ORIGIN.
const MANAGED_TARGETS = ['xAxis', 'yAxis', 'color'];

// The exact shape ReportRouteList's own $self-binding recipe uses — confirmed
// live against a Report Page template's pre-wired starter graph (section
// 2195009): `display._functions.subscribers` carries a `comparison_series`
// entry with paramKey "$self" (the reserved sentinel usePageFilterSync
// resolves to this graph's own stable identity — see ReportRouteList's
// README, "Publishing routes to graphs"), and `comparisonSeries.enabled`
// must be on (the master switch) for ReportRouteList's assigned routes to
// render as series at all.
const REPORT_SUBSCRIBER_ARGS = { labelKey: 'label', valueKey: 'filters' };

function selectItem({ id, name, options, value, onPick }) {
    const current = options.find(o => o.value === value);
    return {
        id, name,
        value: current?.label || '', showValue: true,
        items: options.map(opt => ({
            id: `${id}_${opt.value}`,
            icon: opt.value === value ? 'CircleCheck' : 'Blank',
            name: opt.label,
            onClickGoBack: true,
            onClick: () => onPick(opt.value),
        })),
    };
}

// NPMRDS-specific: only offer the Measure picker (menu or quick-controls) on
// a "report" (a page built from the Report Page template — ReportRouteList +
// one-or-more AVL Graph sections), never on an arbitrary page that happens to
// have an AVL Graph section for some unrelated purpose. `element-type` is a
// plain field on each raw section row, no JSON.parse needed. Exported so
// QuickControls (the new header-row entry point) gates on the exact same
// condition instead of re-deriving it.
export function isReportPage(siblingSections = []) {
    return siblingSections.some(s => s?.element?.['element-type'] === 'ReportRouteList');
}

// Pure mutation body shared by `applyMeasurePick` (below, runs against a live section's immer
// draft via dwAPI) and NPMRDS's Add-Graph modal (composes a brand-new section's state before any
// dataWrapper/dwAPI exists for it — see
// planning/transportny/tasks/current/dynamic-reports-and-route-tags.md's "Workstream 0"). No immer-specific
// API is used here, only plain mutation syntax, so the identical body works against a plain
// mutable object just as well as an immer draft — this is what lets a from-scratch composed
// section and a live-edited one produce byte-identical shape. `pick` is the FULL resolved pick
// (already merged with DEFAULT_PICK/any partial), not a partial. Returns whether composeMeasureConfig
// actually produced something (an unknown measureKey composes nothing, and callers should skip
// downstream bookkeeping — e.g. the reconcile call — in that case).
export function applyMeasurePickToState(state, pick, { externalSourceColumns, defaultColors } = {}) {
    const composed = composeMeasureConfig({
        graphType: pick.graphType,
        measureKey: pick.measure,
        resolutionKey: pick.resolution,
        comparisonModeKey: pick.comparisonMode,
        anchorInvert: pick.anchorInvert,
        externalSourceColumns,
        defaultColors,
        // A caller (report_build.mjs, which knows its spec's true route→graph
        // assignment up front) may pass `seriesCount` straight through
        // `partial`; otherwise best-effort from whatever route assignment
        // already made it into `_measurePick.routeIds` via ReportRouteList
        // BEFORE this measure pick — the common live-authoring order, but not
        // guaranteed (picking a measure before any route is assigned leaves
        // this undefined, so composeMeasureConfig falls back to its BC
        // categorical default; re-opening the picker after routes exist
        // recomposes with the real count). Stripped back out of `pick` below
        // before it's persisted — it's a compose-time hint, not stored state.
        seriesCount: pick.seriesCount ?? (pick.routeIds?.length || undefined),
    });
    if (!composed) return false;

    // Default the primary Dataset to the canonical NPMRDS source when
    // none is set yet — the whole point of this picker is that an
    // author shouldn't need to separately know to do this via the
    // generic "Dataset" menu first (reported live 2026-07-20: a
    // freshly-added AVL Graph section had routes assignable via
    // ReportRouteList but rendered nothing, because no Dataset was
    // ever picked). Never overwrites an author's own different pick
    // (see vocabulary README's "baseSource" composition contract).
    if (!state.externalSource?.source_id) {
        state.externalSource = { ...BASE_SOURCE.sourceInfo };
    }

    // Replace any existing xAxis/yAxis/color column — never a
    // categorize column (comparison-series or otherwise). join
    // itself stays a full replace, same contract as
    // ensure_graph_templates' own drift-fix branch (see vocabulary
    // README's "joins" section) — a measure either owns a join or it
    // doesn't, no partial merge.
    state.columns = [
        ...(state.columns || []).filter(c => !MANAGED_TARGETS.includes(c.target)),
        ...composed.columns,
    ];
    if (composed.join) state.join = composed.join;
    else delete state.join;

    if (!state.display) state.display = {};
    state.display.graphType = composed.displayPatch.graphType;
    state.display.fetchMode = composed.displayPatch.fetchMode;
    if (composed.displayPatch.xAxis) {
        state.display.xAxis = { ...(state.display.xAxis || {}), ...composed.displayPatch.xAxis };
    }
    if (composed.displayPatch.yAxis) {
        state.display.yAxis = { ...(state.display.yAxis || {}), ...composed.displayPatch.yAxis };
    }
    if (composed.displayPatch.colors) state.display.colors = composed.displayPatch.colors;
    if (composed.displayPatch.tooltip) {
        state.display.tooltip = { ...(state.display.tooltip || {}), ...composed.displayPatch.tooltip };
    }
    if (composed.displayPatch.legend) {
        state.display.legend = { ...(state.display.legend || {}), ...composed.displayPatch.legend };
    }

    if (composed.comparisonSeriesCombine) {
        state.comparisonSeries = { ...(state.comparisonSeries || {}), combine: composed.comparisonSeriesCombine };
    } else if (state.comparisonSeries?.combine) {
        delete state.comparisonSeries.combine;
    }

    // Report-page wiring: every caller is isReportPage-gated (see
    // above), so every apply here should leave the graph immediately
    // assignable via ReportRouteList — matching the Report Page
    // template's own pre-wired starter graph, not a bare "generate
    // columns" tool. Idempotent upsert: re-picking never duplicates
    // the subscriber entry or clobbers an unrelated one (e.g.
    // hover_highlight).
    if (!state.comparisonSeries) state.comparisonSeries = {};
    state.comparisonSeries.enabled = true;
    state.comparisonSeries.seriesKey = state.comparisonSeries.seriesKey || '__series';
    state.comparisonSeries.seriesLabel = state.comparisonSeries.seriesLabel || 'Routes';

    if (!state.display._functions) state.display._functions = { providers: [], subscribers: [] };
    if (!state.display._functions.subscribers) state.display._functions.subscribers = [];
    const subscribers = state.display._functions.subscribers;
    const existingSubscriber = subscribers.find(s => s.functionId === 'comparison_series');
    if (existingSubscriber) {
        existingSubscriber.enabled = true;
        existingSubscriber.paramKey = '$self';
        existingSubscriber.args = { ...existingSubscriber.args, ...REPORT_SUBSCRIBER_ARGS };
    } else {
        subscribers.push({ functionId: 'comparison_series', enabled: true, paramKey: '$self', args: { ...REPORT_SUBSCRIBER_ARGS } });
    }

    // Remembers the full pick so reopening the menu/Quick Controls shows the right checkmarks/
    // summary. `graphType`/`measure`/`resolution`/`comparisonMode`/`anchorInvert` are pure
    // bookkeeping (already reflected in the composed columns/display above) — but
    // `weekdays`/`start`/`end`/`routeIds` (design push #2, 2026-08-06) are NOT: those are read
    // straight back out of this same field by useGraphPublish.js's per-graph transformReportRoutes
    // to build the actual query filters, making this object functionally load-bearing for those
    // three fields, not just cosmetic. `seriesCount` (if a caller passed one in `partial`) is
    // NOT persisted here — it's only a compose-time hint for the colors block above.
    const { seriesCount: _seriesCountHint, ...pickToStore } = pick;
    state.display._measurePick = pickToStore;
    return true;
}

// The apply sequence shared by every entry point onto the Measure/Comparison
// Mode picker (today: the Settings-drawer item-group below; soon: the new
// header quick-controls pills) — composeMeasureConfig() -> dwAPI.setState()
// -> dwAPI.reconcileComparisonSeriesColumn(), byte-identical regardless of
// caller so the two entry points can never silently drift (see
// avl-graph-quick-controls.md's "Non-obvious risk to design around").
// `partial` is merged onto the current pick read from
// state.display._measurePick — callers only need to pass the field(s)
// they're changing.
// The 4 fields every self-bound section type reads back out of `_measurePick` at publish time
// (useGraphPublish.js's transformReportRoutes) — the only ones a Map card's Routes/When pills
// are allowed to write. `graphType`/`measure`/`resolution`/`comparisonMode`/`anchorInvert` are
// AVL-Graph-only bookkeeping for fields composeMeasureConfig produced; Map has no such fields to
// bookkeep (see the Map short-circuit below), so DEFAULT_PICK's AVL-Graph defaults for them must
// never be merged onto a Map section's stored state.
const MAP_MEASURE_PICK_FIELDS = ['weekdays', 'start', 'end', 'routeIds'];

export function applyMeasurePick({ state, dwAPI, currentComponent }, partial) {
    // Map has no compose path at all: composeMeasureConfig's own GRAPH_TYPE_OPTIONS comment
    // documents graph-shaped output (columns/join/display.graphType/comparisonSeries.combine) as
    // "nonsensical" for Map, which renders from `symbologies`, not from any of that. Short-circuit
    // to a plain field-level merge onto `_measurePick` instead of running the AVL-Graph compose
    // pipeline. Gated on `currentComponent?.type` (the ComponentRegistry's own reliable identity)
    // rather than `state.display.graphType` / `_measurePick.graphType` — neither field exists on a
    // Map section's stored state (confirmed live 2026-08-07: a Map's `_measurePick` only ever
    // carries weekdays/start/end/routeIds, per section_builders.py's write), so a graphType-based
    // check would silently misfire and fall through to the AVL-Graph path below. See
    // dynamic-report-nongraph-section-binding.md item 9.
    if (currentComponent?.type === 'Map') {
        const existing = state?.display?._measurePick || {};
        const nextPick = { ...existing };
        for (const key of MAP_MEASURE_PICK_FIELDS) {
            if (key in partial) nextPick[key] = partial[key];
            else if (!(key in nextPick)) nextPick[key] = DEFAULT_PICK[key];
        }
        dwAPI.setState(draft => {
            if (!draft.display) draft.display = {};
            draft.display._measurePick = nextPick;
        });
        return;
    }

    const pick = { ...DEFAULT_PICK, ...(state?.display?._measurePick || {}) };
    const nextPick = { ...pick, ...partial };
    const hasDataset = !!state?.externalSource?.source_id;
    let applied = false;
    dwAPI.setState(draft => {
        applied = applyMeasurePickToState(draft, nextPick, {
            // Fall back to the canonical NPMRDS base source's own column list
            // when no Dataset is picked yet, so the plain-resolution xAxis
            // column (epoch/date) composes as the real physical column, not
            // the generic stub — see buildXAxisColumn. Safe because every
            // caller is isReportPage-gated: a report graph's Dataset IS this
            // source (see below), there's no other candidate it could be.
            externalSourceColumns: hasDataset ? state.externalSource.columns : BASE_SOURCE.sourceInfo.columns,
            defaultColors: currentComponent?.defaultState?.display?.colors,
        });
    });
    if (!applied) return;
    // Separate imperative call, same two-call pattern the built-in
    // Comparison Series "Enabled" toggle already uses elsewhere in
    // sectionMenu.jsx — adds the synthetic `__series` categorize column
    // now that comparisonSeries.enabled + the dynamic subscriber are
    // both in place (reconcileComparisonSeriesColumn's own hasVariants
    // check treats an enabled comparison_series subscriber as "variants
    // pending," so the column is added even before any route is
    // actually assigned yet). Calls the shared mint function directly
    // (not dwAPI.reconcileComparisonSeriesColumn(), which forwards no
    // extra args) so this NPMRDS-specific label stays entirely in this
    // file, not in core `src/dms/` code.
    dwAPI.setState(draft => {
        reconcileComparisonSeriesColumnOnState(draft);
        const col = draft.columns.find(c => c.origin === 'comparison-series');
        if (col && !col.customName) col.customName = 'Route';
    });
}

// Difference graphs return `anchor - other`; the server treats
// seriesVariants[0] (whichever route was assigned to this graph first,
// ReportRouteList's own array order) as the anchor with no UI indication at
// all — see report-spec.md's "Difference graphs: anchor and sign". Reads the
// SAME resolved, ordered route list the query itself will use: RRL publishes
// each graph's assigned+transformed routes to its own self-derived action
// param (useGraphPublish.js's transformReportRoutes), so this doesn't
// re-derive route order independently and can't drift from what actually
// gets queried. Only meaningful for exactly two arms — the server hard-errors
// past that (report-spec.md), so a third+ route assigned to a difference
// graph intentionally hides this control rather than offer a broken picker.
function getAnchorRouteOptions({ sectionState, pageState }) {
    const sectionId = String(sectionState?.value?.trackingId ?? sectionState?.value?.id ?? '');
    if (!sectionId) return null;
    const paramKey = selfParamKey(sectionId);
    const variants = pageState?.filters?.find(f => f.searchKey === paramKey && f.type === 'action')?.values;
    if (!Array.isArray(variants) || variants.length !== 2) return null;
    return variants.map((v, idx) => ({ value: idx === 1, label: v?.label || `Route ${idx + 1}` }));
}

export function npmrdsMeasureMenu({ state, dwAPI, currentComponent, isEdit, canEditSection, siblingSections = [], sectionState, pageState }) {
    const pick = { ...DEFAULT_PICK, ...(state?.display?._measurePick || {}) };
    const reportPage = isReportPage(siblingSections);

    const applyPick = (partial) => applyMeasurePick({ state, dwAPI, currentComponent }, partial);

    const summary = [
        MEASURE_OPTIONS.find(o => o.value === pick.measure)?.label,
        RESOLUTION_OPTIONS.find(o => o.value === pick.resolution)?.label,
        COMPARISON_MODE_OPTIONS.find(o => o.value === pick.comparisonMode)?.label,
    ].filter(Boolean).join(' · ');

    const anchorOptions = pick.comparisonMode === 'difference'
        ? getAnchorRouteOptions({ sectionState, pageState })
        : null;

    return [{
        name: 'Measure', icon: 'AdjustmentsHorizontal',
        // Deliberately NOT gated on dataSource?.activeSource (unlike the
        // built-in "Join Dataset" submenu) — an author should be able to pick
        // Graph Type/Measure/Resolution/Comparison Mode before ever touching
        // the generic Dataset menu; applyPick defaults the Dataset itself to
        // BASE_SOURCE the first time it runs (see below). Gated instead on
        // isReportPage — this picker is NPMRDS-report-specific, not a
        // generic AVL Graph feature.
        cdn: () => isEdit && canEditSection && currentComponent?.useDataSource && reportPage,
        value: summary, showValue: true,
        items: [
            selectItem({ id: 'measure_graph_type', name: 'Graph Type', options: GRAPH_TYPE_OPTIONS, value: pick.graphType, onPick: v => applyPick({ graphType: v }) }),
            selectItem({ id: 'measure_measure', name: 'Measure', options: MEASURE_OPTIONS, value: pick.measure, onPick: v => applyPick({ measure: v }) }),
            selectItem({ id: 'measure_resolution', name: 'Resolution', options: RESOLUTION_OPTIONS, value: pick.resolution, onPick: v => applyPick({ resolution: v }) }),
            selectItem({ id: 'measure_comparison_mode', name: 'Comparison Mode', options: COMPARISON_MODE_OPTIONS, value: pick.comparisonMode, onPick: v => applyPick({ comparisonMode: v }) }),
            ...(anchorOptions ? [selectItem({ id: 'measure_anchor_route', name: 'Anchor Route', options: anchorOptions, value: pick.anchorInvert, onPick: v => applyPick({ anchorInvert: v }) })] : []),
        ],
    }];
}
