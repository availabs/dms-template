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
// Round 80 (2026-08-27, old-reports-conversion.md): the same shared static-breaks table
// composeMapConfig.js's Route Map choropleth reads — see that file's header comment and
// colorBreaks.json's own `_provenance` for the full "why static, why shared" rationale. Used below
// to give GridGraph/BarGraph's rdylgn magnitude scale a fixed [min,max] domain instead of computing
// one from whatever's currently loaded, the same "very similar charts, different color scales"
// problem Ryan flagged for Route Map applying equally here.
import colorBreaks from './colorBreaks.json';
// Semi-reverted 2026-09-02 (Ryan): round 80 (above) wired colorBreaks.json's
// static [min,max] into every GridGraph/single-series-BarGraph's color scale,
// same as Route Map's choropleth. Ryan walked that back for charts only —
// maps keep the static scale (queried/built differently, can have load
// issues that make a consistent legend worth more there); non-map charts go
// back to a per-section, data-computed domain. This flag is the switch — see
// its use in composeMeasureConfig's `displayPatch.colors` below.
// colorBreaks.json/composeMapConfig.js are untouched; flip this back to true
// to re-apply static breaks to charts without re-deriving any of that wiring.
const APPLY_STATIC_BREAKS_TO_CHARTS = false;
// report-authoring-ux-overhaul.md Tier 6A (2026-08-20): the same time-of-day/day-of-week helpers
// QuickControls'/AddGraphModal's own "When" pill already use, reused here (not re-derived) so the
// auto-title's phrasing of a window never drifts from what the pill itself shows for it.
import { PEAK_PRESETS, timeOfDayToken, summarizeWeekdays, isDayOn, WEEKDAY_KEYS, WEEKEND_KEYS } from '../ReportRouteList/utils';
// Gap #16 (2026-08-21): reliability measures (LOTTR/TTTR/Freeflow) need each assigned route's
// REAL resolved date range (a derived route's raw stored startDate/endDate are blank — see that
// file's own header comment) to pick the correct year-matched pgFederated join.
import { resolveRouteDates } from '../ReportRouteList/relativeDateResolution';

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

// Per-graph-type default `display.legend.position` for a FRESHLY-CREATED NPMRDS graph — Ryan's
// call, 2026-09-01: bottom for now, may change, and may want to differ per graph type later (e.g.
// bottom for Line, right for Bar) — this map is the one place to make that call, not a scattered
// literal. GridGraph gets its own key/value: its legend is a linear color-scale gradient, not a
// per-series swatch list, so it uses the corner-based position vocabulary
// (`LEGEND_POSITION_OPTIONS_GRID` below) instead of plain top/bottom — 'bottom' isn't one of its
// valid positions (see `ComponentRegistry/graph_new/config.jsx`'s `legendForGridGraph` control
// group), so it defaults to the closest analog, 'bottom-right'.
//
// Deliberately NOT read by `composeMeasureConfig()` itself — see
// `planning/transportny/tasks/current/graph-legend-position-quickcontrol.md`'s design note: this
// function's own convention is to fully re-compose/overwrite every field it owns (colors/tooltip/
// legend.show) on EVERY apply, which is right for those fields but would be wrong for `position` —
// it would silently stomp a manual override (Settings drawer, or the QuickControls Legend pill)
// the next time an author touched any other pill on the same card. `applyDefaultLegendPosition`
// below is called once, only at genuine section-creation time, by each of this app's 3 independent
// "mint a brand-new graph section" call sites (`useAddGraphSection.js`, `compose_bridge.mjs`,
// `report_build.mjs`) — never on a re-pick of an existing section.
export const DEFAULT_LEGEND_POSITION_BY_GRAPH_TYPE = {
    // Flipped bottom → top(-right) 2026-09-04 (Ryan) — the `bottom` build shipped 2026-09-01 and
    // was live-verified working, but Ryan changed his mind on the default once he saw it live:
    // top reads better paired with the graph-native title (see the title/legend inline-alignment
    // work landing alongside this in the same pass). Still just an author-overridable default —
    // the per-graph Legend Position control (LEGEND_POSITION_OPTIONS(_GRID) below) is unaffected.
    BarGraph: 'top',
    LineGraph: 'top',
    GridGraph: 'top-right',
};

// Seeds `state.display.legend.position` with this app's own default for `graphType`, once, for a
// brand-new section — see the map above for the full "why here, why not composeMeasureConfig"
// reasoning. No-op for Table (no chart legend concept) or a state with no `display` at all (Map's
// own compose branch, which never calls this). Safe to call unconditionally; callers don't need
// their own Table/Map gate.
export function applyDefaultLegendPosition(state, graphType) {
    if (!state?.display || graphType === 'Table') return;
    const position = DEFAULT_LEGEND_POSITION_BY_GRAPH_TYPE[graphType] || 'bottom';
    state.display.legend = { ...(state.display.legend || {}), position };
}

// The author-facing option set for a "Legend Position" control — same split as the DMS Settings
// drawer's own `legend`/`legendForGridGraph` control groups (`ComponentRegistry/graph_new/
// config.jsx`), reused here so QuickControls' own Legend pill never drifts from what the Settings
// drawer offers.
export const LEGEND_POSITION_OPTIONS = [
    { value: 'right', label: 'Right' },
    { value: 'left', label: 'Left' },
    { value: 'top', label: 'Top' },
    { value: 'bottom', label: 'Bottom' },
];
export const LEGEND_POSITION_OPTIONS_GRID = [
    { value: 'right', label: 'Right' },
    { value: 'left', label: 'Left' },
    { value: 'top-right', label: 'Top Right' },
    { value: 'top-left', label: 'Top Left' },
    { value: 'bottom-right', label: 'Bottom Right' },
    { value: 'bottom-left', label: 'Bottom Left' },
];
export function legendPositionOptionsFor(graphType) {
    return graphType === 'GridGraph' ? LEGEND_POSITION_OPTIONS_GRID : LEGEND_POSITION_OPTIONS;
}

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
    // gap #16 (report-authoring-ux-overhaul.md, 2026-08-24): info_box_templates.py's static
    // (no year/bin dependency) length/aadt Info Box measures, ported to vocabulary.json.
    { label: 'Route attributes', measures: ['length', 'aadt'] },
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

// Table has no "bar" — it's a row-per-route grid, not a chart. Rather than fork the whole
// RESOLUTION_OPTIONS list per graph type (every OTHER label reads fine regardless of shape),
// both AddGraphModal's Resolution field and QuickControls' Aggregate pill call this instead of
// reading RESOLUTION_OPTIONS directly whenever they know the current graphType.
export function resolutionOptionsFor(graphType) {
    if (graphType !== 'Table') return RESOLUTION_OPTIONS;
    return RESOLUTION_OPTIONS.map((o) => (o.value === 'summary' ? { ...o, label: 'Summary (one row per route)' } : o));
}

export const COMPARISON_MODE_OPTIONS = [
    { value: 'plain', label: 'Plain' },
    { value: 'difference', label: 'Difference' },
];

// The exact shape ReportRouteList's own $self-binding recipe uses — confirmed
// live against a Report Page template's pre-wired starter graph (section
// 2195009): `display._functions.subscribers` carries a `comparison_series`
// entry with paramKey "$self" (the reserved sentinel usePageFilterSync
// resolves to this graph's own stable identity — see ReportRouteList's
// README, "Publishing routes to graphs"), and `comparisonSeries.enabled`
// must be on (the master switch) for ReportRouteList's assigned routes to
// render as series at all.
const REPORT_SUBSCRIBER_ARGS = { labelKey: 'label', valueKey: 'filters' };

// Report-authoring-ux-overhaul.md Tier 5C (2026-08-20): the ONLY piece of the report-wiring block
// this picker owns that's genuinely element-type-agnostic — `findSelfBoundGraphs`
// (useGraphPublish.js) reads this same subscriber shape off ANY section type, Map included, to
// decide whether to publish routes to it. Lives here (not MeasurePicker/index.js, where it was
// first extracted) specifically so composeMapConfig.js can import it too without a circular
// dependency (index.js -> composeMapConfig.js -> index.js) — this file is a leaf every other
// MeasurePicker module already depends on, never the reverse.
// `state.comparisonSeries.*` is NOT part of this — that's the chart/table "categorize column"
// master switch, meaningless for Map (its runtime never reads `state.comparisonSeries` at all; see
// useComparisonSeriesLayers.js), so it stays in MeasurePicker/index.js, chart/table-only.
export function ensureSelfBoundSubscriber(state) {
    if (!state.display) state.display = {};
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
}

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
    // report-authoring-ux-overhaul.md Tier 5D (2026-08-20): Table only. Every OTHER graph type
    // still uses the single `measure` field above — a chart draws exactly one measure's worth of
    // yAxis per pick, always has. A table has no such ceiling, so it gets its own array field
    // rather than overloading `measure` into a sometimes-string-sometimes-array shape. Empty by
    // default; AddGraphModal seeds it from the current single `measure` the moment the author
    // switches the shape card to Table (see that file), so the multi-select never opens blank.
    measures: [],
    // Gap #16 (report-authoring-ux-overhaul.md, 2026-08-21): Table only. Appends one "% vs Main"
    // delta column per measure — see buildRouteCompareDeltaColumn below.
    routeCompare: false,
    // Gap #16 (2026-08-21): Table only. Appends LOTTR/TTTR/Freeflow columns from source 1410's
    // year-matched pgFederated join — see composeReliabilityColumns below.
    includeReliability: false,
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

// Table's per-TMC row dimension (round 79, old-reports-conversion.md — Info
// Box's `grain: 'tmc'` shape). Same tmc-column lookup as
// buildGridBreakdownColumn above, but targeted "categorize" (Table's own
// row-grouping convention, per `info_box_templates.py`'s `tmc_col`) rather
// than GridGraph's "yAxis" — two different shapes' own conventions, not
// interchangeable, hence the separate small function rather than a shared
// one with a target param.
function buildTmcCategorizeColumn(externalSourceColumns) {
    const src = (externalSourceColumns || []).find(c => c.name === 'tmc' && c.source_id === 583)
        || (externalSourceColumns || []).find(c => c.name === 'tmc');
    return { ...(src || { name: 'tmc', type: 'string', source_id: 583 }), show: true, target: 'categorize', group: true, origin: MEASURE_PICKER_COLUMN_ORIGIN };
}

// Info Box's TMC-grain shape needs a genuinely different SQL form for
// length/aadt specifically, not just a different grouping column. Their
// route-grain vocab.json expr is a self-aggregating map-combinator (`fn:
// "exempt"`) — correct grouped by route/__series, but ClickHouse rejects
// wrapping an already-self-aggregating expression in an outer `fn: "avg"`
// (a nested aggregate, `ILLEGAL_AGGREGATION`, live-caught in the Python
// converter 2026-07-14 — see info_box_templates.py's own comment). Every
// TMC-grain CH group is already scoped to one TMC, so the plain per-tmc
// join-column read (`avg`'d, since one route can carry >1 raw row per tmc)
// is the correct form instead. Ported verbatim from
// convert_old_reports_lib/vocab.py's LENGTH_TMC_EXPR/AADT_TMC_EXPR. speed/
// travelTime/hoursOfDelay all degrade correctly to their route-grain
// self-aggregating form at TMC grain (round 35/42's own proof, reused by
// info_box_templates.py's own comments too), so only these two measures
// need an override.
const TMC_GRAIN_MEASURE_OVERRIDE = {
    length: { expr: 'table1.miles as length', fn: 'avg' },
    aadt: { expr: 'table1.aadt as aadt', fn: 'avg' },
};

// Row-height source for a per-TMC GridGraph ("1 row = 1 tmc") — TMC segment length
// (`table1.miles`, the same META_JOIN column speed/length/aadt/etc. already read for their own
// math). `max()` not `avg()`: every row in a GridGraph's yAxis group is already scoped to exactly
// one TMC (buildGridBreakdownColumn, above), so `miles` is constant within the group — `max` just
// reads it out without ClickHouse's nested-aggregate rejection (same rationale as
// TMC_GRAIN_MEASURE_OVERRIDE above). Unconditional for every per-TMC GridGraph pick, same
// "not an author-facing toggle" rule buildGridBreakdownColumn's own comment states for the row
// dimension itself. Verified live on DMS page tsmo2/corridor_view (build_tsmo2_corridor_view.mjs),
// whose main time-space grid carries the identical `round(max(meta.miles),3) as rowmiles` column
// targeted "height" — see planning/transportny/tasks/current/gridgraph-row-height-scaling.md.
const GRID_ROW_HEIGHT_MEASURE = { expr: 'round(max(table1.miles),3) as tmc_miles', fn: 'exempt' };

function buildGridHeightColumn() {
    return buildMeasureYAxisColumn(GRID_ROW_HEIGHT_MEASURE, 'height');
}

// travelTime is normally the ONLY measure with requiresJoin: [] (see the note near
// composeTableMeasuresConfig below) — its vocabulary.json expression is deliberately written
// with bare, unqualified column names, correct only when NO join exists at all (the base table
// stays unaliased in that case). ANY join forced in for a query travelTime is part of breaks that
// invariant: the base table gets aliased `ds`, and META_JOIN carries its own `tmc` column too, so
// travelTime's bare `tmc` becomes an ambiguous reference between `ds.tmc` and `table1.tmc`. One
// `ds.`-qualified twin of the expression, reused at every call site that can force such a join —
// today that's `composeTableMeasuresConfig`'s multi-measure union join (`QUALIFIED_EXPR_WHEN_
// TABLE_HAS_JOIN`, further down) and, as of this round, a per-TMC GridGraph's forced-in height
// column (`GRID_HEIGHT_FORCED_JOIN_MEASURE_OVERRIDE`, right below) — kept as ONE literal so the
// two can never independently drift.
const TRAVELTIME_JOIN_QUALIFIED_EXPR =
    "arraySum(mapValues(avgMapIf(map(ds.tmc, toFloat64(ds.travel_time_all_vehicles)), ds.travel_time_all_vehicles != 0))) / 60 as travel_time_all_vehicles";

// Building a GridGraph row-height column (above) forces META_JOIN in regardless of which measure
// was picked — see TRAVELTIME_JOIN_QUALIFIED_EXPR's comment for why that needs travelTime's
// expression qualified. Same "explicit override for the one measure this affects" pattern as
// TMC_GRAIN_MEASURE_OVERRIDE above — used ONLY when the join is being forced in for the
// row-height column, never for a plain travelTime pick with no GridGraph breakdown.
const GRID_HEIGHT_FORCED_JOIN_MEASURE_OVERRIDE = {
    travelTime: { expr: TRAVELTIME_JOIN_QUALIFIED_EXPR, fn: 'exempt' },
};

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
// Round 77 (2026-08-27, old-reports-conversion.md): ported from
// convert_old_reports_lib/expressions.py's `_avg_delay_summary_expr` so the
// Python converter's 3 `tmc_avg_delay_summary_bar_graph_*` templates could
// move onto this same bridge-composed path (see BRIDGE_GRAPH_SPECS' own
// comment) instead of staying hand-built Python forever. Same two-level fold
// as the Python original: per-(tmc, bucket) delay sum ÷ per-(tmc, bucket)
// distinct-date count, then a plain mean across buckets — `bucketExpr` is
// the one thing that varies per grain (epoch/date/day-of-week), so ONE
// parameterized expression covers all three, exactly like the Python
// version. Reuses `vocab.measures.hoursOfDelay.expr` (stripping its own
// trailing " as hours_of_delay" alias) rather than a second hardcoded copy
// of the delay formula, so the two can never independently drift.
const SUMMARY_DELAY_BUCKET_EXPR = {
    '5-minutes': 'ds.epoch',
    day: 'ds.date',
    weekday: 'toDayOfWeek(ds.date)',
};

function avgDelaySummaryExpr(bucketExpr) {
    const key = `concat(ds.tmc, '|', toString(${bucketExpr}))`;
    const delayExpr = vocab.measures.hoursOfDelay.expr;
    const inner = delayExpr.slice(0, delayExpr.lastIndexOf(' as '));
    return `arrayAvg(arrayMap((s, d) -> s / d, `
        + `mapValues(sumMap(map(${key}, coalesce(${inner}, 0)))), `
        + `mapValues(uniqExactMap(map(${key}, ds.date))))) `
        + `as avg_hours_of_delay`;
}

// `summaryDelayGrainKey` is NOT a live-authoring-UI field — the Resolution
// picker only ever sends 'summary' here, with no secondary grain dimension,
// so this stays unsupported (returns true = "nothing to apply", same as
// before this round) for every live Measure Picker / QuickControls call.
// Only the Python converter's bridge requests (compose_bridge.mjs, forwarded
// from BRIDGE_GRAPH_SPECS' own `summaryDelayGrainKey`) ever pass one, for
// the 3 old-report buckets that need it (round-36 corpus survey: 63x5-min,
// 12xday, 1xweekday).
function isUnsupportedSummaryMeasure(resolutionKey, measureKey, summaryDelayGrainKey) {
    if (resolutionKey !== 'summary' || measureKey !== 'avgHoursOfDelay') return false;
    return !SUMMARY_DELAY_BUCKET_EXPR[summaryDelayGrainKey];
}

// Positional: first join key -> table1, second -> table2 (see vocabulary README's "joins"
// section). Factored out from `buildJoin` (below) so the Table multi-measure path
// (`composeTableMeasuresConfig`) can build ONE union join across several measures' own
// `requiresJoin` lists — a table's `state.join` is a single shared structure, not per-column, so
// mixing e.g. `speed` (META_JOIN only) with `hoursOfDelay` (META_JOIN + AADT_DIST_JOIN) needs the
// union, deduped, not just whichever measure composed last.
function buildJoinFromKeys(joinKeys) {
    if (!joinKeys?.length) return null;
    const sources = {};
    joinKeys.forEach((joinKey, idx) => {
        sources[`table${idx + 1}`] = vocab.joins[joinKey];
    });
    return { sources };
}

function buildJoin(measure) {
    return buildJoinFromKeys(measure.requiresJoin);
}

// The single yAxis-target measure column, factored out of `composeMeasureConfig` so
// `composeTableMeasuresConfig` (multiple measures -> multiple columns, one table) can build each
// one identically to the single-measure chart path, rather than re-deriving this shape.
// `target` defaults to 'yAxis' — GridGraph's 'color' override doesn't apply to Table (no cell
// coloring), so callers needing that pass it explicitly.
function buildMeasureYAxisColumn(measure, target = 'yAxis') {
    return {
        type: 'calculated', show: true, name: measure.expr,
        target, fn: measure.fn, customName: measure.label,
        origin: MEASURE_PICKER_COLUMN_ORIGIN,
    };
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
export function composeMeasureConfig({ graphType, measureKey, resolutionKey, comparisonModeKey, anchorInvert, externalSourceColumns, defaultColors, seriesCount, summaryDelayGrainKey }) {
    const measure = vocab.measures[measureKey];
    if (!measure) return null;
    // See isUnsupportedSummaryMeasure's own comment — avgHoursOfDelay's summary value is
    // bucket-grain-dependent; composing it needs a `summaryDelayGrainKey` telling us WHICH
    // grain's fold to use (only the Python converter's bridge requests ever supply one — see
    // that function's own comment). Returning null here (rather than composing a
    // confidently-wrong number) reuses the exact same "nothing to apply" contract an
    // unknown measureKey already gets — callers already skip downstream bookkeeping
    // when this happens.
    if (isUnsupportedSummaryMeasure(resolutionKey, measureKey, summaryDelayGrainKey)) return null;
    const isAvgDelaySummary = resolutionKey === 'summary' && measureKey === 'avgHoursOfDelay';

    // Per-TMC row breakdown ("1 row = 1 tmc") is unconditional for every GridGraph pick (see
    // buildGridBreakdownColumn's own comment) — and so, as of this round, is the matching row
    // HEIGHT column scaling each row to the TMC's real length, so a GridGraph reads as a true
    // space-time diagram instead of uniform slivers. See buildGridHeightColumn and
    // GRID_HEIGHT_FORCED_JOIN_MEASURE_OVERRIDE above for why this needs its own forced join and
    // (for travelTime specifically) a re-qualified measure expression. Computed before
    // yAxisMeasure/join below because both need to know whether the join is being forced in.
    const gridBreakdownColumn = graphType === 'GridGraph' ? buildGridBreakdownColumn(externalSourceColumns) : null;
    const gridHeightColumn = gridBreakdownColumn ? buildGridHeightColumn() : null;
    const forcedJoinMeasureOverride = gridHeightColumn && !measure.requiresJoin?.length
        ? GRID_HEIGHT_FORCED_JOIN_MEASURE_OVERRIDE[measureKey]
        : null;

    const yAxisMeasure = isAvgDelaySummary
        ? { ...measure, expr: avgDelaySummaryExpr(SUMMARY_DELAY_BUCKET_EXPR[summaryDelayGrainKey]) }
        : forcedJoinMeasureOverride
        ? { ...measure, ...forcedJoinMeasureOverride }
        : measure;

    // GridGraph's value column targets "color" (per-cell heat), every other
    // graph type targets "yAxis" — same rule TEMPLATE_SPECS' own entries use.
    const yAxisTarget = graphType === 'GridGraph' ? 'color' : 'yAxis';
    const yAxisColumn = buildMeasureYAxisColumn(yAxisMeasure, yAxisTarget);
    const xAxisColumn = buildXAxisColumn(resolutionKey, externalSourceColumns);
    // gridHeightColumn forces META_JOIN into the join set even for a measure (only travelTime
    // today) that wouldn't otherwise need one — Set-dedup preserves table1/table2 ordering for
    // every measure that already lists META_JOIN, so this is a no-op there.
    const join = gridHeightColumn
        ? buildJoinFromKeys([...new Set([...(measure.requiresJoin || []), 'META_JOIN'])])
        : buildJoin(measure);
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
        //
        // `showGridLines: false` (2026-09-02, Ryan — reports only, this branch is
        // already GridGraph-gated): GridGraph's y-axis is the categorical tmc-row
        // breakdown, not a numeric scale — horizontal gridlines there just add
        // visual noise between cell rows, unlike a LineGraph/BarGraph's real
        // numeric axis where they're a useful reference. Overrides the shared
        // `defaultState`/`ChartDefaults` default of `true` (see graph_new/config.jsx
        // and graph_new/theme.js) for GridGraph specifically, without touching
        // that shared default for Line/BarGraph or for GridGraph sections created
        // outside the NPMRDS report picker/converter.
        displayPatch.yAxis = { format: null, showGridLines: false };
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
        // `domainMin`/`domainMax`: a static fixed domain from the shared
        // colorBreaks.json when this measure has one — GridGraph.jsx/
        // BarGraph.jsx (round 80) check these first and skip their own
        // data-computed range entirely when present. Same two-flat-key shape
        // as the existing `yAxis.domainMin`/`domainMax` fixed-axis override.
        // Measures with no entry (length/aadt/reliability aren't offered here
        // at all) silently keep today's per-section dynamic range — same
        // "compose nothing extra" contract every other optional field in this
        // file already follows.
        //
        // Semi-reverted 2026-09-02 — see APPLY_STATIC_BREAKS_TO_CHARTS's own
        // comment near the colorBreaks.json import above.
        const staticBreaks = colorBreaks.measures[measureKey];
        displayPatch.colors = {
            type: 'scheme', scheme: 'rdylgn', reverse: measure.reverseColors,
            ...(graphType === 'BarGraph' ? { byValue: true } : {}),
            ...(APPLY_STATIC_BREAKS_TO_CHARTS && staticBreaks ? { domainMin: staticBreaks.domain[0], domainMax: staticBreaks.domain[1] } : {}),
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
    displayPatch.tooltip = {
        showTotal: measure.fn === 'sum',
        // travelTime's own SQL expression is decimal MINUTES (vocabulary.json) — a 1-2 decimal
        // round of that ("0.3 min") is both hard to read as a duration and prone to two visibly
        // different bars/lines rounding to the identical tooltip value (reported live on a
        // Travel Time BarGraph, both series showing "0.3"). `duration_mmss` (graph_new/utils.js)
        // formats it as "M:SS" instead, which a viewer reads directly as a duration and which
        // keeps whole-second precision. `yFormat` covers LineGraph's own tooltip read (see
        // GraphComponent.jsx's hoverComp comment); `valueFormat` covers every other chart type.
        // Explicitly cleared to null (not omitted) for every OTHER measure — applyMeasurePickToState
        // MERGES display.tooltip onto the existing state rather than replacing it, so omitting
        // these keys here would leave a stale 'duration_mmss' from a PRIOR travelTime pick applied
        // to the newly-picked measure's own (non-duration) values. Live-reported 2026-09-02:
        // switching a GridGraph from Travel Time to Speed (Truck) kept the tooltip in M:SS. Same
        // "re-picking must fully determine every display field it touches" rule the xAxis/yAxis
        // format-clearing above and the legend `show` below already follow.
        valueFormat: measureKey === 'travelTime' ? 'duration_mmss' : null,
        yFormat: measureKey === 'travelTime' ? 'duration_mmss' : null,
    };
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
        columns: [yAxisColumn, xAxisColumn, gridBreakdownColumn, gridHeightColumn].filter(Boolean),
        join,
        comparisonSeriesCombine: isDifference ? { mode: 'difference', ...(anchorInvert ? { invert: true } : {}) } : null,
        displayPatch,
    };
}

// Live-caught 2026-08-20 building a Summary-resolution, 2-measure (Speed + Travel Time) table:
// the query builder only aliases the base table `AS ds` when the composed query has a JOIN —
// with no join, it's referenced bare (no alias at all), and the WHERE clause's own `tmc`/`date`
// are bare too. `travelTime` is the ONLY measure with `requiresJoin: []` (every other measure
// always triggers a join), so its `vocabulary.json` expression is correctly written with bare,
// unqualified `tmc`/`travel_time_all_vehicles` — exactly matching the no-join case, which is the
// ONLY case a single-measure pick (any chart, or a 1-measure table) ever produces.
//
// A multi-measure TABLE is the one place that can put travelTime's expression into a query that
// DOES end up with a join (because some OTHER selected measure needs one) — and once `AS ds`
// exists, `travelTime`'s bare `tmc` collides with the joined meta table's own `tmc` column
// ("ambiguous identifier"). Qualifying travelTime's `vocabulary.json` string instead (tried
// first, reverted) breaks it back in the OTHER direction the moment it's ever used alone or
// with no join — the exact "replacing one bug with another" risk to avoid. The join/no-join
// duality is real and belongs right here, at the one call site that can put a zero-join
// measure's expression into a joined query — not in the shared vocabulary string every
// single-measure path (and the Python converter) also reads verbatim.
//
// A literal lookup, not a regex rewrite: exactly one measure needs this today. Add another entry
// here, by measure key, if a future zero-`requiresJoin` measure ever needs the same treatment.
// Shares its one expression with GRID_HEIGHT_FORCED_JOIN_MEASURE_OVERRIDE above (both trace back
// to TRAVELTIME_JOIN_QUALIFIED_EXPR) — same fix, two call sites that can each force a join a
// zero-join measure wasn't written for.
const QUALIFIED_EXPR_WHEN_TABLE_HAS_JOIN = {
    travelTime: TRAVELTIME_JOIN_QUALIFIED_EXPR,
};

// Table-only: `TableCell.jsx` renders a column's raw value verbatim with NO formatting unless
// `formatFn` is set — confirmed live 2026-08-20, a fresh table showed full float precision (e.g.
// "3.5323034922285706"). A chart never hits this: its yAxis value is read through
// `display.tooltip`'s own `valueFormat`/`yFormat` (already set above, per measure, in
// `composeMeasureConfig`), never a column's `formatFn` — so this map is scoped to
// `composeTableMeasuresConfig` only, not added to the shared `buildMeasureYAxisColumn` helper
// both paths call, to avoid touching chart behavior at all. `travelTime` reuses the same
// `minutes_clock` convention its OWN chart tooltip already gets (`duration_mmss` there — same
// idea, Spreadsheet's own name for it, both from dataWrapper/utils/utils.jsx's `formatFunctions`)
// rather than the plain-decimal default, since a raw decimal-minutes value reads badly as a
// duration. Every other measure gets `decimal_2` (same fixed-precision formatter already used
// for Route Info Box's plain-decimal measures, per that formatter's own comment) — not `comma`,
// which floors to an integer below its K/M abbreviation threshold and would round every one of
// these sub-1000 rate-like values (mph, minutes, delay-hours) down to a whole number.
const TABLE_MEASURE_FORMAT_FN = {
    travelTime: 'minutes_clock',
};
const DEFAULT_TABLE_MEASURE_FORMAT_FN = 'decimal_2';

// Gap #16 (report-authoring-ux-overhaul.md, 2026-08-21): ports
// scripts/npmrds-reports/convert_old_reports_lib/route_compare_template.py's
// `ensure_route_compare_template` delta-column composition into the live authoring path, so an
// author can get the same per-row "% vs Main" column those Python-built Route Compare sections
// already carry, without going through the converter. `__ANCHOR__(<expr>)` (dms-server's
// uda/utils.js `substituteAnchorMarkers`) resolves live, per request, to whichever route is first
// in the page's comparisonSeries arm order — same "first-assigned route is Main" convention the
// existing Difference comparison mode already uses for its own anchor.
//
// `measure.reverseColors` already encodes exactly what the Python side's separate
// GOOD_DIRECTION_BY_MEASURE dict hand-maintains (reverseColors: true == higher-is-worse == a
// negative delta is the good direction) — confirmed measure-by-measure against vocab.py's dict —
// so this reuses it rather than hand-maintaining a second copy of the same fact.
function buildRouteCompareDeltaColumn(key, measure, tableHasJoin) {
    const overrideExpr = tableHasJoin ? QUALIFIED_EXPR_WHEN_TABLE_HAS_JOIN[key] : undefined;
    const exprWithAlias = overrideExpr || measure.expr;
    const aliasIdx = exprWithAlias.lastIndexOf(' as ');
    const rawExpr = aliasIdx === -1 ? exprWithAlias : exprWithAlias.slice(0, aliasIdx);
    const alias = `${aliasIdx === -1 ? key : exprWithAlias.slice(aliasIdx + 4)}_delta`;
    const anchor = `__ANCHOR__(${rawExpr})`;
    return {
        // target: 'delta' — not a real axis, but MUST be one of MeasurePicker/index.js's
        // MANAGED_TARGETS or this column is invisible to that file's "replace this picker's own
        // columns on re-pick" filter (which keys on `target`) and orphans pile up across re-picks
        // instead of being cleaned up — found live 2026-08-21 toggling a measure off/on with
        // Route Compare already on: the stale delta pair survived every subsequent re-pick.
        type: 'delta', display: 'calculated', show: true, target: 'delta',
        deltaGoodDirection: measure.reverseColors ? 'down' : 'up',
        // fn: "exempt" — same reason route_compare_template.py's identical delta_col sets it:
        // without it, getData.js's groupNoFnCondition heuristic marks the section invalidState and
        // the row-data fetch never fires at all.
        fn: 'exempt',
        // round(...) avoids a ~1e-14 floating-point residual on the anchor's own row (its
        // expression is evaluated twice — once inline, once inside __ANCHOR__'s subquery — and
        // ClickHouse's two evaluations aren't bit-identical), which DeltaView's exact `n === 0`
        // check would otherwise render as a random-sign colored arrow instead of a neutral "no
        // change" on the anchor's own row.
        name: `round((${rawExpr} - ${anchor}) / ${anchor} * 100, 2) as ${alias}`,
        customName: '% vs Main',
    };
}

// ── Reliability (LOTTR/TTTR/Freeflow) — source 1410's pgFederated join (gap #16, 2026-08-21) ──
// Ports scripts/npmrds-reports/convert_old_reports_lib/info_box_templates.py's
// `ensure_pm3_join_template` into the live authoring path. Unlike Route Compare, this is NOT a
// dms-core capability gap — `pgFederated` (a live Postgres table joined into a ClickHouse query
// via ClickHouse's own `postgresql()` table function) is already a fully generic, tested
// dms-server join type (`uda/utils.js`'s `buildJoin`, `buildUdaConfig.js`'s client-side
// counterpart) — nothing NPMRDS-specific about the mechanism itself. The gap was purely that this
// project's own `vocabulary.json`/composer never had an entry describing it.
//
// Two real constraints carried over verbatim from the Python converter, both explicit product
// decisions (vocab.py's own comments) — never approximated:
// 1. Source 1410 publishes one Postgres view PER YEAR — the join must target whichever view
//    matches the report's own route dates, never a different year's ("never substitute a
//    different year's data", round 17). `PM3_VIEW_BY_YEAR` below is copied from vocab.py's own
//    dict; only years actually confirmed to carry the full 121-column schema are included (a 2017
//    view exists but is missing every speed_pctl_* column — see vocab.py's own note).
// 2. LOTTR/TTTR are precomputed against exactly 4 FHWA time bins (AM Peak/Midday/PM Peak/
//    Weekend) — a graph whose "When" window doesn't land unambiguously on one of those four
//    (a custom window, "All Day", or a mixed weekday+weekend mask) has no real bin to read, and
//    never curve-fits to the "closest" one (vocab.py's `comp_reliability_bin`, ported verbatim
//    below as `reliabilityBinForWindow`). Freeflow (`speed_pctl_85`) has no bin dimension at all —
//    it rides along on the same join regardless of which bin resolves.
export const PM3_VIEW_BY_YEAR = {
    2018: 3563, 2019: 3559, 2020: 3555,
    2021: 2587, 2022: 2575, 2023: 2567, 2024: 2568, 2025: 3425,
};
const RELIABILITY_BIN_BY_PEAK_LABEL = { 'AM Peak': 'amp', 'Midday': 'midd', 'PM Peak': 'pmp' };
export const RELIABILITY_BIN_LABELS = { amp: 'AM Peak', midd: 'Midday', pmp: 'PM Peak', we: 'Weekend' };

// Ported from vocab.py's `comp_reliability_bin` — same two-shape-only rule, same weekday-key
// names as ReportRouteList's own WEEKDAY_KEYS/WEEKEND_KEYS (Design Push #2 moved this window onto
// the graph, but the day-name vocabulary itself didn't change).
function reliabilityBinForWindow(window) {
    const weekdays = window?.weekdays || {};
    const hasWeekday = WEEKDAY_KEYS.some((k) => isDayOn(weekdays, k));
    const hasWeekend = WEEKEND_KEYS.some((k) => isDayOn(weekdays, k));
    if (hasWeekend && !hasWeekday) return 'we';
    if (hasWeekend && hasWeekday) return null;
    if (!window?.start || !window?.end) return null;
    const preset = PEAK_PRESETS.find((p) => p.startTime === window.start && p.endTime === window.end);
    return preset ? (RELIABILITY_BIN_BY_PEAK_LABEL[preset.label] || null) : null;
}

// Ported from vocab.py's `graph_reliability_bin` — the single bin every assigned route's own
// window agrees on, or null if undetermined/mixed (never guesses when routes disagree). Exported
// so QuickControls/AddGraphModal can call it directly for disabled-state gating/messaging, the
// same "UI checks the identical gate compose uses" pattern routeCompare's Summary-only gate above
// already established.
export function resolveReliabilityBin(routeIds, routeWindows) {
    if (!routeIds?.length) return null;
    const bins = new Set(routeIds.map((id) => reliabilityBinForWindow(routeWindows?.[id]?.[0])));
    return bins.size === 1 ? [...bins][0] : null;
}

// Ported from vocab.py's `graph_max_year` — latest calendar year touched by any assigned route's
// REAL (resolved) date range. `allRoutes` must be the report's full routes array (not just the
// assigned subset, and not the route-catalog projection) — `resolveRouteDates` needs every
// route's `derivedFromRoute` sibling in scope to fill in a derived route's blank stored dates.
export function resolveReliabilityYear(routeIds, allRoutes) {
    if (!routeIds?.length || !allRoutes?.length) return null;
    const resolved = resolveRouteDates(allRoutes);
    const byId = new Map(resolved.map((r) => [r.route_comp_id, r]));
    const years = new Set();
    routeIds.forEach((id) => {
        const r = byId.get(id);
        [r?.startDate, r?.endDate].forEach((d) => {
            if (!d) return;
            const y = new Date(d).getFullYear();
            if (!Number.isNaN(y)) years.add(y);
        });
    });
    return years.size ? Math.max(...years) : null;
}

// Round 79 (old-reports-conversion.md): split out of composeReliabilityColumns
// so a caller that already knows its own (bin, year) — the Python converter's
// bridge, minting a static per-(grain,year,bin) Info Box template with no
// live route data to derive them from, the same way `ensure_pm3_join_template`
// takes `year`/`bin_` as plain params — can build the column/join shape
// directly, without needing routeIds/routeWindows/allRoutes at all.
// `composeReliabilityColumns` (below) is the live-authoring-path wrapper that
// derives bin/year from a graph's actual assigned routes first.
function buildReliabilityColumns(bin, year) {
    const viewId = year != null ? PM3_VIEW_BY_YEAR[year] : null;
    if (!bin || !viewId) return null;

    const joinSource = {
        pgFederated: { pgEnv: 'npmrds2', table: `s1410_v${viewId}_pm_3`, schema: 'gis_datasets' },
        joinColumns: [{ dsColumn: 'tmc', joinSourceColumn: 'tmc' }],
        mergeStrategy: 'join', type: 'left',
    };
    const binLabel = RELIABILITY_BIN_LABELS[bin];
    const columns = [
        { type: 'calculated', show: true, target: 'yAxis', fn: 'avg', formatFn: 'decimal_2',
          name: `pm3.lottr_${bin}_lottr as lottr_${bin}`, customName: `LOTTR (${binLabel})`,
          origin: MEASURE_PICKER_COLUMN_ORIGIN },
        { type: 'calculated', show: true, target: 'yAxis', fn: 'avg', formatFn: 'decimal_2',
          name: `pm3.tttr_${bin}_tttr as tttr_${bin}`, customName: `TTTR (${binLabel})`,
          origin: MEASURE_PICKER_COLUMN_ORIGIN },
        { type: 'calculated', show: true, target: 'yAxis', fn: 'avg', formatFn: 'decimal_2',
          name: 'pm3.speed_pctl_85 as freeflow', customName: 'Freeflow Speed (85th %ile)',
          origin: MEASURE_PICKER_COLUMN_ORIGIN },
    ];
    return { columns, joinSource, bin, year };
}

function composeReliabilityColumns({ routeIds, routeWindows, allRoutes }) {
    const bin = resolveReliabilityBin(routeIds, routeWindows);
    const year = resolveReliabilityYear(routeIds, allRoutes);
    return buildReliabilityColumns(bin, year);
}

/**
 * Compose the full section-state patch for a Table with N measures — one yAxis-target column
 * per measure, sharing a single xAxis (resolution) column and a single, unioned `join`. Table has
 * no comparison-mode/anchor/color/legend/tooltip concept (Spreadsheet ignores all of those —
 * confirmed by reading `ComponentRegistry/spreadsheet/index.jsx`'s own column selection, which
 * filters purely on `show`/`selectOnly`, never `target` or anything display-shaped), so this is
 * deliberately much smaller than `composeMeasureConfig` above rather than a Table-flavored branch
 * bolted onto it.
 *
 * The one piece that genuinely needs merge logic across measures: `join`. A table's `state.join`
 * is ONE shared structure, not per-column, so combining e.g. `speed` (needs only META_JOIN) with
 * `hoursOfDelay` (needs META_JOIN + AADT_DIST_JOIN) must union+dedupe both measures' own
 * `requiresJoin` lists — using only the last-composed measure's join would silently drop a table
 * whose OTHER columns' SQL expressions reference a join that was never applied. Whether that
 * union ends up non-empty ALSO decides which of a zero-join measure's two expression forms is
 * safe (see `QUALIFIED_EXPR_WHEN_TABLE_HAS_JOIN` above) — so the join is resolved once, up front,
 * and both the column-building and the returned `join` itself read from that one value.
 *
 * `routeCompare` (optional, default false) appends a `buildRouteCompareDeltaColumn` right after
 * each measure's own value column — deliberately not a template-level concept (nothing else about
 * a Route Compare table differs from an ordinary Summary table), just an extra column an author
 * can turn on for any Table.
 *
 * `routeCompare` only ever takes effect at `resolutionKey === 'summary'` — found live 2026-08-21:
 * `__ANCHOR__(<expr>)` (dms-server's `substituteAnchorMarkers`) substitutes to a scalar subquery
 * over the anchor arm's ENTIRE row set, with no GROUP BY of its own, regardless of what the outer
 * query groups by. At Summary resolution that's correct — every row is already one whole-range
 * aggregate per route, so the delta is a genuine route-vs-route comparison, exactly what the old
 * Route Compare Component always was (`ensure_route_compare_template` never time-buckets). At any
 * time-bucketed resolution (Hour/Day/Weekday/Month), the outer query groups per bucket while the
 * anchor subquery still collapses the whole range, so the delta becomes "this bucket vs the
 * anchor's OVERALL average" — on a single-route table that degenerates into "this hour vs this
 * same route's own average," which is not a route comparison at all. Silently ignored rather than
 * gated with an error, matching `isUnsupportedSummaryMeasure`'s own "nothing to apply" precedent
 * just above.
 *
 * `includeReliability` (optional, default false) appends LOTTR/TTTR/Freeflow columns from source
 * 1410's year-matched pgFederated join (`composeReliabilityColumns` above) — same "silently
 * ignored when it can't apply cleanly" contract as `routeCompare`, gated the same way (Summary
 * resolution only — 1410's PM3 data has no time-of-day dimension beyond its own 4 precomputed
 * bins, so a hurly/daily/monthly bucket would just repeat the identical value in every row) PLUS
 * only when the graph's own routes/window/year actually resolve a real bin+view
 * (`resolveReliabilityBin`/`resolveReliabilityYear`). `routeIds`/`routeWindows`/`allRoutes` are
 * only needed when `includeReliability` is set — every existing caller that never uses this flag
 * is unaffected by their absence. A Table may have reliability ON with zero other measures picked
 * (Info Box's own real shape had no "other measure" concept at all), so the early-return below no
 * longer requires `measures.length` alone.
 *
 * Returns null if no measureKey in `measureKeys` is recognized AND reliability doesn't apply
 * either (mirrors composeMeasureConfig's own "unknown measure -> nothing to apply" contract).
 *
 * `grain` (optional, default 'route' — round 79, old-reports-conversion.md): Info Box's other real
 * axis, alongside measure selection — 'route' groups by the comparisonSeries `__series`
 * discriminator (one row per route, the live Table checkbox's own only prior shape), 'tmc' groups
 * by a real per-TMC categorize column instead (`buildTmcCategorizeColumn`) — mirrors
 * info_box_templates.py's identical route-vs-tmc split on every one of its own builders. `length`/
 * `aadt` need a different SQL form at TMC grain too, not just a different grouping column — see
 * `TMC_GRAIN_MEASURE_OVERRIDE`'s own comment.
 *
 * `reliabilityBin`/`reliabilityYear` (optional — round 79): a caller that already knows its own
 * bin/year (the Python converter's bridge, minting a static per-(grain,year,bin) template with no
 * live route data to derive them from) can pass them directly instead of `routeIds`/`routeWindows`/
 * `allRoutes`; the live-authoring path (which has real route data but not a pre-resolved bin/year)
 * keeps using those three as before. Only meaningful together with `includeReliability`.
 */
export function composeTableMeasuresConfig({ measureKeys, resolutionKey, externalSourceColumns, routeCompare, includeReliability, routeIds, routeWindows, allRoutes, grain = 'route', reliabilityBin, reliabilityYear }) {
    const measures = (measureKeys || [])
        .map((k) => ({ key: k, measure: vocab.measures[k] }))
        .filter((entry) => entry.measure);

    const reliability = (includeReliability && resolutionKey === 'summary')
        ? (reliabilityBin != null || reliabilityYear != null
            ? buildReliabilityColumns(reliabilityBin, reliabilityYear)
            : composeReliabilityColumns({ routeIds, routeWindows, allRoutes }))
        : null;
    if (!measures.length && !reliability) return null;

    const applyRouteCompare = routeCompare && resolutionKey === 'summary';
    const unionJoinKeys = [...new Set(measures.flatMap(({ measure }) => measure.requiresJoin || []))];
    const tableHasJoin = unionJoinKeys.length > 0;

    const valueColumns = measures.flatMap(({ key, measure }) => {
        const tmcOverride = grain === 'tmc' ? TMC_GRAIN_MEASURE_OVERRIDE[key] : null;
        const overrideExpr = tmcOverride ? tmcOverride.expr
            : (tableHasJoin ? QUALIFIED_EXPR_WHEN_TABLE_HAS_JOIN[key] : undefined);
        const effectiveMeasure = (overrideExpr || tmcOverride)
            ? { ...measure, ...(overrideExpr ? { expr: overrideExpr } : {}), ...(tmcOverride ? { fn: tmcOverride.fn } : {}) }
            : measure;
        const column = buildMeasureYAxisColumn(effectiveMeasure);
        column.formatFn = TABLE_MEASURE_FORMAT_FN[key] || DEFAULT_TABLE_MEASURE_FORMAT_FN;
        return applyRouteCompare ? [column, buildRouteCompareDeltaColumn(key, measure, tableHasJoin)] : [column];
    });
    const groupColumn = grain === 'tmc'
        ? buildTmcCategorizeColumn(externalSourceColumns)
        : buildXAxisColumn(resolutionKey, externalSourceColumns);

    // Measure-required joins are keyed `table1`/`table2`/... positionally (buildJoinFromKeys) —
    // the reliability join keeps its literal `pm3` alias instead, since composeReliabilityColumns'
    // own column SQL hardcodes `pm3.<column>` references that must match whatever key names it.
    const measureJoin = buildJoinFromKeys(unionJoinKeys);
    const join = reliability
        ? { sources: { ...(measureJoin?.sources || {}), pm3: reliability.joinSource } }
        : measureJoin;

    return {
        columns: [...valueColumns, ...(reliability?.columns || []), groupColumn].filter(Boolean),
        join,
        comparisonSeriesCombine: null,
        displayPatch: { graphType: 'Table', fetchMode: 'force' },
    };
}

/**
 * Tier 5B (report-authoring-ux-overhaul.md, 2026-08-20) — title auto-population, WITHOUT a new
 * "is this still auto-generated" tracking field. `composeAutoTitle` is a pure function of a pick
 * (deterministic — same pick always yields the same title), so instead of storing a pristine
 * flag, `isTitleDirty` recomputes what THIS SAME function would have produced for the pick that
 * was active last time, and compares it to what's actually stored. Equal (or empty) => the title
 * is still exactly what auto-compose put there => safe to overwrite with the new pick's title.
 * Different => the author typed something of their own => never touched again. Ryan's explicit
 * call, 2026-08-20: no new field, keep the mechanism obvious at the call site instead.
 */
// report-authoring-ux-overhaul.md Tier 6A (2026-08-20): Ryan's own report — Peak Selector/DoW
// picks on the "When" pill didn't move the title, only Measure did. `composeAutoTitle` already
// receives the full resolved pick (routeWindows/routeIds included, see applyMeasurePickToState's
// call site) — it simply never read them. This reads the SAME "first assigned route's own window"
// convention QuickControls' own When pill already uses to compute ITS displayed token
// (`pick.routeWindows?.[routeIds[0]]?.[0]`, QuickControls/index.jsx) so the title's phrasing can
// never drift from what the pill shows for the same state. Renders nothing (same as before this
// fix) whenever the window is unrestricted (all day, every day) — an unrestricted graph's title
// looks exactly as it did before this change.
function windowTitleFragment(pick) {
    const routeIds = pick.routeIds || [];
    const window = pick.routeWindows?.[routeIds[0]]?.[0];
    if (!window) return '';
    const parts = [];
    if (window.start && window.end) {
        const preset = PEAK_PRESETS.find((p) => p.startTime === window.start && p.endTime === window.end);
        parts.push(preset ? preset.label : timeOfDayToken(window.start, window.end));
    }
    const daysSummary = summarizeWeekdays(window.weekdays);
    if (daysSummary) parts.push(daysSummary);
    return parts.join(', ');
}

export function composeAutoTitle(pick) {
    if (!pick) return '';
    // Reliability's own bin (not year — composeAutoTitle only ever receives `pick`, no route date
    // data) is enough to know whether it actually composed; only needed for the Table branch.
    const reliabilityBin = (pick.graphType === 'Table' && pick.includeReliability && pick.resolution === 'summary')
        ? resolveReliabilityBin(pick.routeIds, pick.routeWindows)
        : null;
    const measureLabel = pick.graphType === 'Table'
        ? [...(pick.measures || []).map((k) => vocab.measures[k]?.label), reliabilityBin ? `Reliability (${RELIABILITY_BIN_LABELS[reliabilityBin]})` : null].filter(Boolean).join(', ')
        : (vocab.measures[pick.measure]?.label || '');
    if (!measureLabel) return '';
    // Mirrors route_compare_template.py's own f"Route Compare, {title}" naming convention. Gated
    // the same as composeTableMeasuresConfig's own routeCompare check — the title shouldn't claim
    // "Route Compare" when the resolution means no delta column actually got composed.
    const prefix = (pick.graphType === 'Table' && pick.routeCompare && pick.resolution === 'summary') ? 'Route Compare, ' : '';
    const when = windowTitleFragment(pick);
    return when ? `${prefix}${measureLabel} — ${when}` : `${prefix}${measureLabel}`;
}

// `priorPick` is whatever `state.display._measurePick` held BEFORE this apply (undefined on a
// brand-new section) — the pick `currentTitle` was actually generated from, not the new one
// about to be applied. Compare against that, never against the new pick, or every re-pick would
// call itself dirty (the new title never equals the OLD stored one until after this check runs).
export function isTitleDirty({ currentTitle, priorPick }) {
    if (!currentTitle) return false;
    return currentTitle !== composeAutoTitle(priorPick);
}
