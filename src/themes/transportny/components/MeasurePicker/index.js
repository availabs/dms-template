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

// The apply sequence shared by every entry point onto the Measure/Comparison
// Mode picker (today: the Settings-drawer item-group below; soon: the new
// header quick-controls pills) — composeMeasureConfig() -> dwAPI.setState()
// -> dwAPI.reconcileComparisonSeriesColumn(), byte-identical regardless of
// caller so the two entry points can never silently drift (see
// avl-graph-quick-controls.md's "Non-obvious risk to design around").
// `partial` is merged onto the current pick read from
// state.display._measurePick — callers only need to pass the field(s)
// they're changing.
export function applyMeasurePick({ state, dwAPI, currentComponent }, partial) {
    const pick = { ...DEFAULT_PICK, ...(state?.display?._measurePick || {}) };
    const nextPick = { ...pick, ...partial };
    const hasDataset = !!state?.externalSource?.source_id;
    const composed = composeMeasureConfig({
        graphType: nextPick.graphType,
        measureKey: nextPick.measure,
        resolutionKey: nextPick.resolution,
        comparisonModeKey: nextPick.comparisonMode,
        // Fall back to the canonical NPMRDS base source's own column list
        // when no Dataset is picked yet, so the plain-resolution xAxis
        // column (epoch/date) composes as the real physical column, not
        // the generic stub — see buildXAxisColumn. Safe because every
        // caller is isReportPage-gated: a report graph's Dataset IS this
        // source (see below), there's no other candidate it could be.
        externalSourceColumns: hasDataset ? state.externalSource.columns : BASE_SOURCE.sourceInfo.columns,
        defaultColors: currentComponent?.defaultState?.display?.colors,
    });
    if (!composed) return;
    dwAPI.setState(draft => {
        // Default the primary Dataset to the canonical NPMRDS source when
        // none is set yet — the whole point of this picker is that an
        // author shouldn't need to separately know to do this via the
        // generic "Dataset" menu first (reported live 2026-07-20: a
        // freshly-added AVL Graph section had routes assignable via
        // ReportRouteList but rendered nothing, because no Dataset was
        // ever picked). Never overwrites an author's own different pick
        // (see vocabulary README's "baseSource" composition contract).
        if (!draft.externalSource?.source_id) {
            draft.externalSource = { ...BASE_SOURCE.sourceInfo };
        }

        // Replace any existing xAxis/yAxis/color column — never a
        // categorize column (comparison-series or otherwise). join
        // itself stays a full replace, same contract as
        // ensure_graph_templates' own drift-fix branch (see vocabulary
        // README's "joins" section) — a measure either owns a join or it
        // doesn't, no partial merge.
        draft.columns = [
            ...(draft.columns || []).filter(c => !MANAGED_TARGETS.includes(c.target)),
            ...composed.columns,
        ];
        if (composed.join) draft.join = composed.join;
        else delete draft.join;

        if (!draft.display) draft.display = {};
        draft.display.graphType = composed.displayPatch.graphType;
        draft.display.fetchMode = composed.displayPatch.fetchMode;
        if (composed.displayPatch.xAxis) {
            draft.display.xAxis = { ...(draft.display.xAxis || {}), ...composed.displayPatch.xAxis };
        }
        if (composed.displayPatch.yAxis) {
            draft.display.yAxis = { ...(draft.display.yAxis || {}), ...composed.displayPatch.yAxis };
        }
        if (composed.displayPatch.colors) draft.display.colors = composed.displayPatch.colors;

        if (composed.comparisonSeriesCombine) {
            draft.comparisonSeries = { ...(draft.comparisonSeries || {}), combine: composed.comparisonSeriesCombine };
        } else if (draft.comparisonSeries?.combine) {
            delete draft.comparisonSeries.combine;
        }

        // Report-page wiring: every caller is isReportPage-gated (see
        // above), so every apply here should leave the graph immediately
        // assignable via ReportRouteList — matching the Report Page
        // template's own pre-wired starter graph, not a bare "generate
        // columns" tool. Idempotent upsert: re-picking never duplicates
        // the subscriber entry or clobbers an unrelated one (e.g.
        // hover_highlight).
        if (!draft.comparisonSeries) draft.comparisonSeries = {};
        draft.comparisonSeries.enabled = true;
        draft.comparisonSeries.seriesKey = draft.comparisonSeries.seriesKey || '__series';
        draft.comparisonSeries.seriesLabel = draft.comparisonSeries.seriesLabel || 'Routes';

        if (!draft.display._functions) draft.display._functions = { providers: [], subscribers: [] };
        if (!draft.display._functions.subscribers) draft.display._functions.subscribers = [];
        const subscribers = draft.display._functions.subscribers;
        const existingSubscriber = subscribers.find(s => s.functionId === 'comparison_series');
        if (existingSubscriber) {
            existingSubscriber.enabled = true;
            existingSubscriber.paramKey = '$self';
            existingSubscriber.args = { ...existingSubscriber.args, ...REPORT_SUBSCRIBER_ARGS };
        } else {
            subscribers.push({ functionId: 'comparison_series', enabled: true, paramKey: '$self', args: { ...REPORT_SUBSCRIBER_ARGS } });
        }

        // Bookkeeping only (mirrors display._functions) — remembers the
        // last pick so reopening the menu shows the right checkmarks/
        // summary. Never read by the render/query pipeline.
        draft.display._measurePick = nextPick;
    });
    // Separate imperative call, same two-call pattern the built-in
    // Comparison Series "Enabled" toggle already uses elsewhere in
    // sectionMenu.jsx — adds the synthetic `__series` categorize column
    // now that comparisonSeries.enabled + the dynamic subscriber are
    // both in place (reconcileComparisonSeriesColumn's own hasVariants
    // check treats an enabled comparison_series subscriber as "variants
    // pending," so the column is added even before any route is
    // actually assigned yet).
    dwAPI.reconcileComparisonSeriesColumn();
}

export function npmrdsMeasureMenu({ state, dwAPI, currentComponent, isEdit, canEditSection, siblingSections = [] }) {
    const pick = { ...DEFAULT_PICK, ...(state?.display?._measurePick || {}) };
    const reportPage = isReportPage(siblingSections);

    const applyPick = (partial) => applyMeasurePick({ state, dwAPI, currentComponent }, partial);

    const summary = [
        MEASURE_OPTIONS.find(o => o.value === pick.measure)?.label,
        RESOLUTION_OPTIONS.find(o => o.value === pick.resolution)?.label,
        COMPARISON_MODE_OPTIONS.find(o => o.value === pick.comparisonMode)?.label,
    ].filter(Boolean).join(' · ');

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
        ],
    }];
}
