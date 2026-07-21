/**
 * NPMRDS "Measure" picker — composition layer.
 *
 * Reads the shared, plain-data vocabulary (data-types/npmrds_graph_vocabulary/
 * vocabulary.json — see that directory's README for the field reference and
 * the Python-side consumer) and composes a live Graph/AVL Graph section's
 * `columns`/`join`/`comparisonSeries.combine`/`display` color config from an
 * author's Graph Type + Measure + Resolution + Comparison Mode picks.
 *
 * This mirrors scripts/convert_old_reports.py's TEMPLATE_SPECS +
 * ensure_graph_templates composition (same ingredients, same shapes) but has
 * no base template to clone from — every field this picker cares about is
 * built from scratch here. See
 * src/dms/planning/tasks/current/report-graph-vocabulary-picker.md
 * (Workstream 2) for the full design record.
 */

import vocab from '../../../../../data-types/npmrds_graph_vocabulary/vocabulary.json';

export const GRAPH_VOCAB = vocab;

// The single DAMA source every measure expression's `ds.*` columns assume
// (epoch/date/tmc/travel_time_*). A from-scratch picker has no template to
// clone `externalSource` from (see vocabulary README's "baseSource" section),
// so this is embedded verbatim from a real working report section rather
// than resolved live — see composeMeasureConfig's caller for the "only fill
// in when no Dataset is set yet" contract.
export const BASE_SOURCE = vocab.baseSource;

// Only the graph types the vocabulary's measures/resolutions actually target
// (Pie/Sunburst/Treemap have no xAxis/yAxis semantics defined here).
export const GRAPH_TYPE_OPTIONS = [
    { value: 'BarGraph', label: 'Bar Graph' },
    { value: 'LineGraph', label: 'Line Graph' },
    { value: 'GridGraph', label: 'Grid Graph' },
];

export const MEASURE_OPTIONS = Object.entries(vocab.measures).map(([value, m]) => ({
    value, label: m.label,
}));

const RESOLUTION_LABELS = {
    '5-minutes': '5 Minutes',
    '15-minutes': '15 Minutes',
    'hour': 'Hour',
    'day': 'Day',
    'weekday': 'Weekday',
    'month': 'Month',
};
export const RESOLUTION_OPTIONS = Object.keys(vocab.resolutions).map(value => ({
    value, label: RESOLUTION_LABELS[value] || value,
}));

export const COMPARISON_MODE_OPTIONS = [
    { value: 'plain', label: 'Plain' },
    { value: 'difference', label: 'Difference' },
];

// Author-empowerment: no cartesian-product gating here. Unlike TEMPLATE_SPECS
// (which only has the combos old reports actually needed), this picker
// composes every combo mechanically from the same ingredients, so any
// graphType x measure x resolution x comparisonMode is offered — see the
// "Resolution/axis investigation findings" note in the task file confirming
// GridGraph/BarGraph are already axis-target-agnostic.
export const DEFAULT_PICK = {
    graphType: 'BarGraph',
    measure: 'speed',
    resolution: '5-minutes',
    comparisonMode: 'plain',
};

// Tags every column this picker generates as metadata (documents provenance
// for anyone reading saved state later). The actual replace-on-re-pick rule
// in index.js is target-based (xAxis/yAxis/color), not origin-based — see
// MANAGED_TARGETS there for why: a pre-existing, picker-untagged column
// (e.g. from a Python-converter-built report) still needs to be replaced,
// which an origin-only check would miss.
export const MEASURE_PICKER_COLUMN_ORIGIN = 'measure-picker';

function buildXAxisColumn(resolutionKey, externalSourceColumns) {
    const resolution = vocab.resolutions[resolutionKey];
    if (!resolution) return null;
    const { xAxis } = resolution;
    if (xAxis.type === 'plain') {
        // Swap in the existing physical column (epoch/date) from the active
        // data source, same as ensure_graph_templates' mint branch does when
        // cloning from a base template — except we have no base template, so
        // the physical column comes straight from externalSource.columns.
        const src = (externalSourceColumns || []).find(c => c.name === xAxis.column);
        return { ...(src || { name: xAxis.column, type: 'string' }), show: true, target: 'xAxis', group: true, sort: 'asc', origin: MEASURE_PICKER_COLUMN_ORIGIN };
    }
    // Calculated grouping (15-minutes/hour/weekday/month) — vocabulary's
    // `expr` field becomes the column's `name` (TEMPLATE_SPECS' own
    // convention: the SQL string, including its own "as <alias>", lives in
    // the column dict's `name` key).
    return { type: 'calculated', show: true, name: xAxis.expr, target: 'xAxis', group: !!xAxis.group, sort: xAxis.sort, origin: MEASURE_PICKER_COLUMN_ORIGIN };
}

function buildJoin(measure) {
    const joinKeys = measure.requiresJoin || [];
    if (!joinKeys.length) return null;
    const sources = {};
    // Positional: first requiresJoin entry -> table1, second -> table2 (see
    // vocabulary README's "joins" section).
    joinKeys.forEach((joinKey, idx) => {
        sources[`table${idx + 1}`] = vocab.joins[joinKey];
    });
    return { sources };
}

function buildDiffColors(measure, graphType) {
    const { defaultColorRange } = vocab.comparisonModes.difference;
    const value = measure.reverseColors ? [...defaultColorRange].reverse() : [...defaultColorRange];
    const colors = { type: 'palette', value, byValueSymmetric: true };
    // GridGraph is inherently colored by value already; only BarGraph needs
    // the explicit byValue flag (see vocabulary README's comparisonModes
    // section / old _diff_colors()).
    if (graphType === 'BarGraph') colors.byValue = true;
    return colors;
}

/**
 * Compose the full section-state patch for one Graph Type + Measure +
 * Resolution + Comparison Mode pick. Returns null if measureKey is unknown.
 * `defaultColors` should be the component's own defaultState.display.colors,
 * used to restore a sane palette when comparisonMode is 'plain'.
 */
export function composeMeasureConfig({ graphType, measureKey, resolutionKey, comparisonModeKey, externalSourceColumns, defaultColors }) {
    const measure = vocab.measures[measureKey];
    if (!measure) return null;

    // GridGraph's value column targets "color" (per-cell heat), every other
    // graph type targets "yAxis" — same rule TEMPLATE_SPECS' own entries use.
    const yAxisTarget = graphType === 'GridGraph' ? 'color' : 'yAxis';
    const yAxisColumn = {
        type: 'calculated', show: true, name: measure.expr,
        target: yAxisTarget, fn: measure.fn, customName: measure.label,
        origin: MEASURE_PICKER_COLUMN_ORIGIN,
    };
    const xAxisColumn = buildXAxisColumn(resolutionKey, externalSourceColumns);
    const join = buildJoin(measure);
    const isDifference = comparisonModeKey === 'difference';

    const resolution = vocab.resolutions[resolutionKey];
    // A freshly-added "AVL Graph" section's own defaultState never sets
    // display.fetchMode — useDataLoader.js then falls back to 'cache' (only
    // shows preloaded/cached data, never fetches live). The Report Page
    // template's pre-wired starter graph has "fetchMode": "force" baked in by
    // hand; a from-scratch section has no template to inherit that from, so
    // (same class of gap as BASE_SOURCE/TMC_IDENTIFICATION_JOIN) it must be
    // set explicitly here. Without it, a report graph never issues a single
    // /graph request, no matter how correctly everything else is composed —
    // confirmed live 2026-07-20: the network tab showed only the
    // reports_snap_2 route-persist call, zero graph-data requests, on a
    // section built via this picker before this fix.
    const displayPatch = { graphType, fetchMode: 'force' };
    if (resolution?.xAxis?.type === 'plain' && resolution.xAxis.column === 'epoch') {
        displayPatch.xAxis = { format: 'epoch_time', label: 'Time of Day' };
    }
    if (yAxisTarget === 'yAxis' && measure.label) {
        displayPatch.yAxis = { label: measure.label };
    }
    displayPatch.colors = isDifference ? buildDiffColors(measure, graphType) : (defaultColors || null);

    return {
        columns: [yAxisColumn, xAxisColumn].filter(Boolean),
        join,
        comparisonSeriesCombine: isDifference ? { mode: 'difference' } : null,
        displayPatch,
    };
}
