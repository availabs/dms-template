/**
 * NPMRDS "Callout Stat" picker — sectionMenu item-group builder for `Card`
 * sections on report pages.
 *
 * Registered for the "Card" component via theme.sectionMenuExtensions (see
 * themev2.js), the same generic extension point `MeasurePicker` uses for
 * "AVL Graph" — see sectionMenu.jsx / sectionMenuExtensions.js. Gated on
 * isReportPage (a ReportRouteList sibling section), same as MeasurePicker:
 * this is a report-building tool, not a generic Card feature, and a Card
 * elsewhere on the site (unrelated to reports) never sees this item.
 *
 * Deliberately much smaller than MeasurePicker: a Card has no xAxis/yAxis/
 * graphType/resolution — it renders one card per row, so a single measure
 * pick (reusing the exact yAxis/color column composeMeasureConfig already
 * builds for Graph, with its `target` stripped) is the whole surface. Once
 * ReportRouteList assigns routes to this section (found via the same
 * `$self`-bound comparison_series subscriber Graph uses — the discovery/
 * dispatch mechanism is component-agnostic, verified against
 * usePageFilterSync.js/useDataWrapperAPI.js/buildUdaConfig.js before writing
 * this), each assigned route becomes its own card, exactly the way each
 * becomes its own series on a graph.
 *
 * No comparison-mode/anchor support (v1) — a callout stat is a single number
 * per route, not a difference; add if a real report needs it later.
 */

import { composeMeasureConfig, MEASURE_OPTIONS, BASE_SOURCE } from '../MeasurePicker/composeMeasureConfig';
import { isReportPage } from '../MeasurePicker';

const REPORT_SUBSCRIBER_ARGS = { labelKey: 'label', valueKey: 'filters' };

const DEFAULT_PICK = { measure: 'speed' };

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

// Same apply shape as applyMeasurePick (composeMeasureConfig -> dwAPI.setState
// -> dwAPI.reconcileComparisonSeriesColumn), reusing composeMeasureConfig's
// yAxis/color column + join output rather than re-deriving the SQL — the
// graphType/resolution/comparisonMode args below are fixed inputs whose
// xAxis/display output this function never reads, not real picks.
export function applyCalloutStatPick({ state, dwAPI }, partial) {
    const pick = { ...DEFAULT_PICK, ...(state?.display?._calloutStatPick || {}) };
    const nextPick = { ...pick, ...partial };
    const hasDataset = !!state?.externalSource?.source_id;
    const composed = composeMeasureConfig({
        graphType: 'BarGraph',
        measureKey: nextPick.measure,
        resolutionKey: '5-minutes',
        comparisonModeKey: 'plain',
        externalSourceColumns: hasDataset ? state.externalSource.columns : BASE_SOURCE.sourceInfo.columns,
    });
    if (!composed) return;
    const statColumn = composed.columns.find(c => c.target === 'yAxis' || c.target === 'color');
    if (!statColumn) return;

    dwAPI.setState(draft => {
        if (!draft.externalSource?.source_id) {
            draft.externalSource = { ...BASE_SOURCE.sourceInfo };
        }

        const { target, ...rest } = statColumn;
        draft.columns = [{ ...rest, valueFontStyle: 'statXL', headerFontStyle: 'metaSM' }];
        if (composed.join) draft.join = composed.join;
        else delete draft.join;

        if (!draft.display) draft.display = {};
        // Bypasses the readyToLoad gate the same way the graph's own starter
        // section needs it (useDataLoader.js falls back to 'cache' — never
        // fetches live — without this). Safe: with zero routes assigned, the
        // shared comparisonSeries dispatch resolves to zero variants and
        // issues no query regardless of fetchMode — verified live against the
        // existing bare AVL Graph section, and re-verified here before
        // shipping (see the task file).
        draft.display.fetchMode = 'force';

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

        draft.display._calloutStatPick = nextPick;
    });
    dwAPI.reconcileComparisonSeriesColumn();
}

export function calloutStatMenu({ state, dwAPI, currentComponent, isEdit, canEditSection, siblingSections = [] }) {
    const pick = { ...DEFAULT_PICK, ...(state?.display?._calloutStatPick || {}) };
    const reportPage = isReportPage(siblingSections);
    const applyPick = (partial) => applyCalloutStatPick({ state, dwAPI }, partial);
    const summary = MEASURE_OPTIONS.find(o => o.value === pick.measure)?.label || '';

    return [{
        name: 'Callout Stat', icon: 'AdjustmentsHorizontal',
        cdn: () => isEdit && canEditSection && currentComponent?.useDataSource && reportPage,
        value: summary, showValue: true,
        items: [
            selectItem({ id: 'callout_stat_measure', name: 'Measure', options: MEASURE_OPTIONS, value: pick.measure, onPick: v => applyPick({ measure: v }) }),
        ],
    }];
}
