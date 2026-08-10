/**
 * NPMRDS "Measure" picker — composition layer.
 *
 * Reads the shared, plain-data vocabulary (./vocabulary.json — see the sibling
 * README.md for the field reference and the Python-side consumer) and composes
 * a live Graph/AVL Graph section's
 * `columns`/`join`/`comparisonSeries.combine`/`display` color config from an
 * author's Graph Type + Measure + Resolution + Comparison Mode picks.
 *
 * This mirrors scripts/npmrds-reports/convert_old_reports.py's TEMPLATE_SPECS +
 * ensure_graph_templates composition (same ingredients, same shapes) but has
 * no base template to clone from — every field this picker cares about is
 * built from scratch here. See
 * src/dms/planning/tasks/current/report-graph-vocabulary-picker.md
 * (Workstream 2) for the full design record.
 */

// Lives HERE, inside the theme folder, deliberately: the theme folder is the unit that gets synced
// into transportNY (see planning/skills/sync-transportnyv2-theme). While this sat in
// dms-template/data-types/npmrds_graph_vocabulary/ the reference climbed five levels out of src/,
// which no downstream project can resolve — it broke transportNY's build on first sync. Keep it a
// sibling; do not move it back out of the synced tree.
import vocab from './vocabulary.json';

export const GRAPH_VOCAB = vocab;

// The single DAMA source every measure expression's `ds.*` columns assume
// (epoch/date/tmc/travel_time_*). A from-scratch picker has no template to
// clone `externalSource` from (see vocabulary README's "baseSource" section),
// so this is embedded verbatim from a real working report section rather
// than resolved live — see composeMeasureConfig's caller for the "only fill
// in when no Dataset is set yet" contract.
export const BASE_SOURCE = vocab.baseSource;

// Only the graph types the vocabulary's measures/resolutions actually target
// (Pie/Sunburst/Treemap have no xAxis/yAxis semantics defined here). Deliberately chart-only —
// this list is ALSO used by the older in-place edit-bar surface (MeasurePicker/index.js's
// `measure_graph_type` selectItem, which re-composes an ALREADY-CREATED AVL Graph section's own
// display.graphType) where a value like 'Table'/'Map' would be nonsensical: graph_new's renderer
// has no such graphType. AddGraphModal.jsx (which creates a brand-new section, and can create a
// Spreadsheet/Map instead of an AVL Graph) keeps its own separate shape-card list layered on top
// of this one, specifically for that reason.
export const GRAPH_TYPE_OPTIONS = [
    { value: 'BarGraph', label: 'Bar Graph' },
    { value: 'LineGraph', label: 'Line Graph' },
    { value: 'GridGraph', label: 'Grid Graph' },
];

export const MEASURE_OPTIONS = Object.entries(vocab.measures).map(([value, m]) => ({
    value, label: m.label,
}));

// Grouping for the Add-Graph modal's Measure <optgroup> — a flat 9-item list read top-to-bottom
// asked an author to already know which measure they wanted; grouped by what it's actually
// measuring makes the list scannable. Deliberately NOT added to vocabulary.json's own measure
// entries — that file is a cross-language SQL/composition contract shared with the Python
// converter (convert_old_reports.py), not UI-organization metadata (same reasoning
// graphGuidanceCopy.js's own header comment already gives for keeping guidance copy out of it).
export const MEASURE_CATEGORIES = [
    { label: 'Speed', measures: ['speed', 'speedTruck'] },
    { label: 'Travel time', measures: ['travelTime'] },
    { label: 'Delay', measures: ['hoursOfDelay', 'avgHoursOfDelay'] },
    { label: 'Emissions', measures: ['co2Emissions_passenger', 'avgCo2Emissions_passenger', 'co2Emissions_truck', 'avgCo2Emissions_truck'] },
];

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
    graphType: 'LineGraph',
    measure: 'travelTime',
    resolution: 'hour',
    comparisonMode: 'plain',
    // Difference-only: which of the two assigned routes is the anchor
    // ("Main") arm. false (default) = the first-assigned route, matching the
    // runtime's own implicit convention (seriesVariants[0]); true flips it via
    // comparisonSeries.combine.invert. See npmrdsMeasureMenu's "Anchor Route"
    // item and report-spec.md's "Difference graphs: anchor and sign".
    anchorInvert: false,
    // Design push #2 (2026-08-06): time-of-day/day-of-week/route-assignment moved from the
    // route to the graph. `weekdays`/`start`/`end` are the same shape RouteRow's old
    // per-route window facets used (an empty/missing day key means "on"; `start`/`end` are
    // plain "HH:mm" strings, empty = all day). `routeIds` is this graph's own list of
    // `route_comp_id`s (the inverse of the old per-route `graphIds`) — resolved against
    // ReportRouteList's route catalog (see useGraphPublish.js's per-graph transformReportRoutes).
    weekdays: {},
    start: '',
    end: '',
    routeIds: [],
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
    // measure.reverseColors is validated correct for RAW-VALUE coloring (e.g. GridGraph
    // cells by absolute travel time — round 51's fix, old dataTypes.js) but a difference
    // graph colors a before-minus-after DELTA, not a raw value. Going from "which raw
    // value is good" to "which delta sign is good" inverts the polarity for every measure
    // (e.g. travelTime: lower raw value is good, but a POSITIVE delta means time FELL —
    // also good — so the delta's good end is the opposite of the raw value's good end).
    // So diff-mode reversal is the negation of the raw flag, not the flag itself. See
    // "Finding: difference-graph color scale reads backwards" in report-spec-and-build-script.md.
    const value = measure.reverseColors ? [...defaultColorRange] : [...defaultColorRange].reverse();
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
export function composeMeasureConfig({ graphType, measureKey, resolutionKey, comparisonModeKey, anchorInvert, externalSourceColumns, defaultColors }) {
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
    // Clock-time x-axis for every epoch-derived resolution, not just raw
    // 5-minute epoch. `epochMinutesPerUnit` (vocabulary) is the width of one
    // bucket — 5 for `epoch`, 15 for `intDiv(epoch, 3)`, 60 for
    // `intDiv(epoch, 12)` — and the formatter needs it, because a tick index
    // means a different clock time at each width (see graph_new/utils.js's
    // makeEpochTimeFormat). Its presence is also the signal for "this
    // resolution is epoch-derived at all": date-based resolutions
    // (day/weekday/month) omit it and correctly get no epoch formatting.
    const epochMinutesPerUnit = resolution?.xAxis?.epochMinutesPerUnit;
    if (epochMinutesPerUnit) {
        displayPatch.xAxis = { format: 'epoch_time', epochMinutesPerUnit, label: 'Time of Day' };
    } else if (resolutionKey === 'weekday') {
        // "weekday" groups by a raw ISO 1-7 day-of-week integer (see
        // convert_old_reports.py's WEEKDAY_EXPR) — same "ticks render as a raw
        // integer without a named formatFn" gap epoch_time exists to fix above,
        // just for the day-bucket axis instead of the time-of-day one (live-reported
        // bug 2026-08-04: ticks showed "0 1 2" instead of day names).
        displayPatch.xAxis = { format: 'day_of_week', epochMinutesPerUnit: null, label: 'Day of Week' };
    } else {
        // Explicitly clear a stale epoch format when switching to a plain
        // date-based resolution — applyMeasurePick MERGES display.xAxis, so without
        // this a previously-picked 'epoch_time' would survive onto a day/month graph
        // and label date buckets as clock times.
        displayPatch.xAxis = { format: null, epochMinutesPerUnit: null };
    }
    if (yAxisTarget === 'yAxis' && measure.label) {
        displayPatch.yAxis = { label: measure.label };
    }
    displayPatch.colors = isDifference ? buildDiffColors(measure, graphType) : (defaultColors || null);

    return {
        columns: [yAxisColumn, xAxisColumn].filter(Boolean),
        join,
        comparisonSeriesCombine: isDifference ? { mode: 'difference', ...(anchorInvert ? { invert: true } : {}) } : null,
        displayPatch,
    };
}
