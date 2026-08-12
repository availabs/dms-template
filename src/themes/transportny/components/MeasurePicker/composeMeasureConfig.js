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
    'summary': 'Summary (one bar per route)',
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
    if (xAxis.type === 'series') {
        // "Summary" resolution — no time bucket at all; the x-axis IS the
        // comparisonSeries discriminator (one bar per route, a whole-range
        // aggregate each), the exact shape convert_old_reports_lib/
        // template_specs.py's old "Bar Graph Summary" templates hand-built
        // (`"xAxis": "__series", "categorize": False`). Deliberately tagged
        // `origin: 'comparison-series'`, NOT MEASURE_PICKER_COLUMN_ORIGIN —
        // reconcileComparisonSeriesColumn(OnState) looks up an existing
        // column by `c.origin === 'comparison-series'` and, when found, only
        // ever touches `.name`/`.alias`, never `.target` (see
        // useDataWrapperAPI.js/report_build.mjs's shared reconcile body) —
        // giving this column that origin up front means reconcile treats it
        // as "already exists" and leaves `target: 'xAxis'` alone, instead of
        // ALSO pushing a second, separate `target: 'categorize'` column for
        // the same `__series` name (which — per template_specs.py's own
        // comment on `"categorize": False` — would collide in every
        // name-keyed column map downstream; the same column can't be both
        // axes). No `sort` — omitting it (rather than `'asc'`) keeps bars in
        // comparisonSeries' own arm order instead of being re-sorted
        // alphabetically by whatever `__series` label text each arm has.
        return { name: '__series', alias: '__series', type: 'text', show: true, target: 'xAxis', group: !!xAxis.group, origin: 'comparison-series' };
    }
    // Calculated grouping (15-minutes/hour/weekday/month) — vocabulary's
    // `expr` field becomes the column's `name` (TEMPLATE_SPECS' own
    // convention: the SQL string, including its own "as <alias>", lives in
    // the column dict's `name` key).
    return { type: 'calculated', show: true, name: xAxis.expr, target: 'xAxis', group: !!xAxis.group, sort: xAxis.sort, origin: MEASURE_PICKER_COLUMN_ORIGIN };
}

// GridGraph's per-row dimension. GridGraphWrapper (graph_new/components/GridGraph.jsx)
// builds grid rows from a column targeted "yAxis" — never "categorize" (that's
// BarGraph's per-TMC convention) — and silently renders a single collapsed
// row when no such column exists. convert_old_reports_lib/template_specs.py
// hit exactly this live (round 42, report 914's "Winter Average Day" TMC Grid
// Graph): a first fix attempt used `categorize: "tmc"` and still rendered one
// aggregate strip; only supplying the tmc column pre-targeted "yAxis" worked.
// This picker had no equivalent at all — every GridGraph it composed set only
// xAxis (time) + color (value), so every GridGraph built through it (the live
// Measure Picker AND report_build.mjs, which calls the same applyMeasurePick)
// collapsed all of a route's TMCs into one row. SPEED_EXPR/TRAVEL_TIME_EXPR/etc.
// are self-aggregating map combinators that already degrade to the correct
// per-TMC value once grouped by (epoch, tmc) — round 35/42's own proof — so no
// measure-level change is needed, only this missing column. "TMC Grid Graph"
// is a per-TMC space-time diagram by definition, so this is unconditional for
// every GridGraph pick, not an author-facing toggle (matches GRAPH_TEMPLATE_MAP
// being fully repointed to the `_tmc`-breakdown templates, not left optional).
function buildGridBreakdownColumn(externalSourceColumns) {
    const src = (externalSourceColumns || []).find(c => c.name === 'tmc' && c.source_id === 583)
        || (externalSourceColumns || []).find(c => c.name === 'tmc');
    return { ...(src || { name: 'tmc', type: 'string', source_id: 583 }), show: true, target: 'yAxis', group: true, sort: 'asc', origin: MEASURE_PICKER_COLUMN_ORIGIN };
}

// "Summary" (one bar per route, no time bucket) reuses every measure's
// existing `expr`/`fn` verbatim EXCEPT avgHoursOfDelay — confirmed by reading
// convert_old_reports_lib/expressions.py: SPEED_SUMMARY_EXPR/TRAVEL_TIME_EXPR/
// DELAY_EXPR are literal aliases of the SAME vocabulary.json expressions
// every time-bucketed chart already uses (they're map/array ClickHouse
// aggregates that fold correctly at any grain, from a 5-minute bucket up to
// the whole date range) — so no measure-level change was needed for those.
// avgHoursOfDelay is the one real exception: its summary value is
// bucket-grain-dependent (a weighted average of daily averages isn't the
// same number as a weighted average of 5-minute averages), needing a
// dedicated per-grain expression (`_avg_delay_summary_expr` in
// expressions.py) the live picker has no equivalent for — already flagged
// out of scope in MeasurePicker/README.md's "Explicitly NOT in this file"
// section before this resolution existed. Guarded here (not silently wrong)
// rather than gated from the picker entirely, matching this file's own
// "any combo is offered" author-empowerment stance for every OTHER combo.
function isUnsupportedSummaryMeasure(resolutionKey, measureKey) {
    return resolutionKey === 'summary' && measureKey === 'avgHoursOfDelay';
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
 * `seriesCount` (optional) is how many routes/arms will feed this graph —
 * only used to decide BarGraph's plain-mode color treatment (see the colors
 * block below); omit when unknown, which keeps the existing categorical
 * default (BC).
 */
export function composeMeasureConfig({ graphType, measureKey, resolutionKey, comparisonModeKey, anchorInvert, externalSourceColumns, defaultColors, seriesCount }) {
    const measure = vocab.measures[measureKey];
    if (!measure) return null;
    // See isUnsupportedSummaryMeasure's own comment — avgHoursOfDelay's summary value is
    // bucket-grain-dependent and this picker has no equivalent of expressions.py's
    // per-grain `_avg_delay_summary_expr`. Returning null here (rather than composing a
    // confidently-wrong number) reuses the exact same "nothing to apply" contract an
    // unknown measureKey already gets — callers already skip downstream bookkeeping
    // when this happens.
    if (isUnsupportedSummaryMeasure(resolutionKey, measureKey)) return null;

    // GridGraph's value column targets "color" (per-cell heat), every other
    // graph type targets "yAxis" — same rule TEMPLATE_SPECS' own entries use.
    const yAxisTarget = graphType === 'GridGraph' ? 'color' : 'yAxis';
    const yAxisColumn = {
        type: 'calculated', show: true, name: measure.expr,
        target: yAxisTarget, fn: measure.fn, customName: measure.label,
        origin: MEASURE_PICKER_COLUMN_ORIGIN,
    };
    const xAxisColumn = buildXAxisColumn(resolutionKey, externalSourceColumns);
    const gridBreakdownColumn = graphType === 'GridGraph' ? buildGridBreakdownColumn(externalSourceColumns) : null;
    const join = buildJoin(measure);
    const isDifference = comparisonModeKey === 'difference';

    const resolution = vocab.resolutions[resolutionKey];
    // A freshly-added "AVL Graph" section's own defaultState never sets
    // display.fetchMode — useDataLoader.js then falls back to 'cache' (only
    // shows preloaded/cached data, never fetches live). The Report Page
    // template's pre-wired starter graph has "fetchMode": "force" baked in by
    // hand; a from-scratch section has no template to inherit that from, so
    // (same class of gap as BASE_SOURCE/META_JOIN) it must be
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
    } else if (graphType === 'GridGraph') {
        // Same "applyMeasurePick MERGES display, so a stale value survives a re-pick"
        // hazard the xAxis branch above already guards against — a fresh AVL Graph
        // section's inherited default display.yAxis carries a numeric `format`
        // (e.g. "integer", meant for a LineGraph/BarGraph's real numeric y-axis).
        // GridGraph's row axis now carries the tmc breakdown column (a string, see
        // buildGridBreakdownColumn) — applying that stale numeric format to it goes
        // through d3-format and renders every row label as the literal text "NaN"
        // (live-caught fixing the missing-breakdown bug above: the labels only
        // started rendering at all once a yColumn existed, surfacing this dormant
        // format for the first time). Explicit `format: null` is a no-op format
        // (GridGraph.jsx only calls d3format() when `format` is a truthy string),
        // so the tmc value renders as its own raw string.
        displayPatch.yAxis = { format: null };
    }
    // Plain-mode color scale. `defaultColors` is the base template's own
    // flat palette of distinct route-identity swatches — correct for a
    // LineGraph (each swatch marks a different route/year) but wrong for a
    // GridGraph, which always colors cells by raw measure VALUE regardless
    // of route count (GridGraphWrapper never reads the categorize/__series
    // column, see GridGraph.jsx) — a scaleLinear built across ~20 visually
    // unrelated hues turns ordinary epoch-to-epoch noise into "confetti"
    // (reported live 2026-08-12). A single-route BarGraph (a day/weekday/
    // month magnitude breakdown, no real second series) has the same root
    // cause: with only one category, it just picks one flat swatch instead
    // of a value scale. Multi-route BarGraphs (2+ series sharing an x-axis,
    // e.g. comparing years by weekday) and "summary" BarGraphs (one bar per
    // route arm — the categorize column IS the x-axis there) are genuinely
    // categorical and keep the inherited palette; `seriesCount` is how the
    // caller tells us which case this is (report_build.mjs knows it from
    // the spec's route→graph assignment; the live picker from the graph's
    // already-assigned `_measurePick.routeIds`, when a route was picked
    // before the measure).
    const isSingleSeriesBarGraph = graphType === 'BarGraph' && resolutionKey !== 'summary' && seriesCount === 1;
    if (isDifference) {
        displayPatch.colors = buildDiffColors(measure, graphType);
    } else if (graphType === 'GridGraph' || isSingleSeriesBarGraph) {
        // measure.reverseColors already encodes which raw-value direction is
        // "good" (see its use in buildDiffColors) — reuse it here to orient
        // the same red(bad)-yellow-green(good) scale for a raw (non-diff)
        // magnitude value.
        displayPatch.colors = {
            type: 'scheme', scheme: 'rdylgn', reverse: measure.reverseColors,
            ...(graphType === 'BarGraph' ? { byValue: true } : {}),
        };
    } else {
        displayPatch.colors = defaultColors || null;
    }
    // "(Line Total)" / per-series totals only make sense for a measure
    // that's genuinely additive across whatever's being summed here (time
    // buckets) — vocabulary.json already flags this via `fn: "sum"`
    // (hoursOfDelay, the co2 totals) vs "avg"/"exempt" for rate-like
    // measures (speed, travelTime, avgHoursOfDelay) where a raw sum is
    // meaningless. Reported live 2026-08-12: a Route Line Graph showed a
    // large, unitless "Line Total" next to each year's speed value.
    displayPatch.tooltip = { showTotal: measure.fn === 'sum' };
    // "summary" has no categorize-targeted column to key a legend off (the categorize
    // column IS the x-axis here — see buildXAxisColumn), so the legend would otherwise
    // fall back to the yAxis column's own raw SQL expression as its label — confirmed,
    // real, live-observed bug in the old converter's equivalent template (see
    // template_specs.py's "Bar Graph Summary" comment): BarGraph.jsx lays the legend out
    // as an unconstrained flex sibling of the chart, so a label that long squeezes the
    // chart to 0 width. Always set explicitly (never left to a stale merge) — same
    // "re-picking must fully determine every display field it touches" rule the xAxis
    // format clearing above already follows, so switching AWAY from "summary" back to a
    // normal resolution doesn't leave the legend stuck hidden.
    displayPatch.legend = { show: resolutionKey !== 'summary' };

    return {
        columns: [yAxisColumn, xAxisColumn, gridBreakdownColumn].filter(Boolean),
        join,
        comparisonSeriesCombine: isDifference ? { mode: 'difference', ...(anchorInvert ? { invert: true } : {}) } : null,
        displayPatch,
    };
}
