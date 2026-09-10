/**
 * NPMRDS "Add Graph → Map" composition — Tier 5C/5I of report-authoring-ux-overhaul.md.
 *
 * Map has no `columns`/`join`/measure shape at all (unlike composeMeasureConfig.js /
 * composeTableMeasuresConfig), so it needs a genuinely different compose function — this file's
 * whole reason to exist.
 *
 * Two layer shapes, one per `MAP_MEASURE_OPTIONS` entry:
 * - `'none'` — plain route geometry, flat line color, no data join. Ported verbatim (source id,
 *   tile-URL pattern, sub-layer structure, `series-template` flag) from
 *   `ensure_route_map_none_template` in convert_old_reports_lib/route_map.py.
 * - a real measure key (any `MAP_MEASURE_OPTIONS` entry with a `CHOROPLETH_DEFAULTS` entry) — a
 *   choropleth layer colored by that measure's value, shape ported from route_map.py's
 *   `ensure_route_map_*_template` functions (`speed`/`travelTime`/`hoursOfDelay`/
 *   `avgHoursOfDelay`) or authored fresh with no Python precedent (`co2Emissions_passenger`/
 *   `avgCo2Emissions_passenger`/`co2Emissions_truck`/`avgCo2Emissions_truck` — route_map.py never
 *   built a CO2 choropleth). Needs a data join (built via the real `buildJoin` from
 *   buildUdaConfig.js — the exact function every chart's own join already goes
 *   through, NOT a hand-rolled wire format — confirmed generic enough for 2-source joins too,
 *   since chart measures like hoursOfDelay already use it in production) and a paint/legend
 *   (built via the real `choroplethPaint` from Map's own `ComponentRegistry/map/utils.js` —
 *   confirmed via route_map.py's own docstring that its Python `choropleth_paint` is "ported
 *   index-arithmetic-for-index-arithmetic" from this exact JS function, so calling it directly
 *   guarantees byte-identical shape to what Map's own live re-break mechanism would produce). Any
 *   OTHER vocabulary.json measure (currently just `length`/`aadt`) is likewise not offered here —
 *   adding a `CHOROPLETH_DEFAULTS` entry is what it takes.
 *
 * Breaks/colors are FIXED, author-chosen constants, not live-computed from real data — same
 * design already proven in this codebase's own MacroView plugin (components/macroview/breaks.js):
 * a per-report live quantile query produces an unstable, hard-to-read legend (one color
 * swallowing most of the network; edges that re-label every time the underlying data shifts,
 * making year-over-year comparison impossible). A fixed, round-number scale is more legible and
 * never moves — refinable later via Map's own existing color/legend settings UI, same "smart
 * default, editable after" contract as every other composed field in this file.
 *
 * Round 80 (2026-08-27): this used to be an inline `CHOROPLETH_DEFAULTS` const AND `bin-method:
 * 'quantile'` — meaning the "fixed" intent above was aspirational, not real: the live Map runtime
 * (ComponentRegistry/map/index.jsx) still called the live `colorDomain` UDA endpoint on every
 * render whenever bin-method isn't `'custom'`, silently overriding these defaults with a fresh
 * per-render quantile computation (confirmed via live network capture). Both the values AND the
 * "actually stay fixed" behavior now come from the shared `colorBreaks.json` (also read by
 * `route_map.py`, so the converter and the live-authoring UI can never independently drift —
 * same principle vocabulary.json already established for measure expressions) and `bin-method:
 * 'custom'` (the Map runtime's own pre-existing escape hatch — already implemented, just unused
 * by anything until now). Ryan's explicit direction: ship colorBreaks.json's existing
 * placeholder-quality numbers now (same ones this file used inline before), not blocked on a real
 * distribution analysis — see that file's own header for the tracked follow-up.
 *
 * Semi-reverted 2026-09-02 (Ryan): same walk-back as composeMeasureConfig.js's
 * `APPLY_STATIC_BREAKS_TO_CHARTS` (see that file's comment) — Ryan reverted maps too, off the same
 * "every chart/map gets its own dynamic scale, not colorBreaks.json's placeholder numbers"
 * decision, but wants it just as easy to flip back. `APPLY_STATIC_BREAKS_TO_MAP` below is that
 * switch: false sends `bin-method: 'quantile'` (pre-round-80 behavior — the live Map runtime
 * recomputes breaks from real data on every render, colorBreaks.json's `breaks`/`maxValue` for
 * this measure go unused, only `colors` still comes from here); true restores round 80's
 * `bin-method: 'custom'` (fixed breaks, no live recompute — see the round-80 paragraph above).
 * colorBreaks.json/choroplethPaint/route_map.py are untouched either way; route_map.py (the
 * Python-side converter, not this live-authoring path) has its own matching
 * `APPLY_STATIC_BREAKS_TO_MAP` flag in convert_old_reports_lib/config.py — flip both together or a
 * re-converted page's map won't match a freshly-authored one.
 */

import { GRAPH_VOCAB, ensureSelfBoundSubscriber } from './composeMeasureConfig';
import colorBreaks from './colorBreaks.json';
import { choroplethPaint } from '../../../../dms/packages/dms/src/patterns/page/components/sections/components/ComponentRegistry/map/utils';
import { buildJoin } from '../../../../dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/buildUdaConfig';

const APPLY_STATIC_BREAKS_TO_MAP = false;

// Per-year TMC geometry tile views (DAMA source 582, npmrds2 pgEnv) — same mapping
// route_map.py's GEOMETRY_TILE_VIEWS uses. The year filter is baked into each view's tile URL, so
// picking the right view keeps old-network TMCs rendering on the network they actually belonged
// to. Update this alongside the Python copy if a new network year is ever added.
export const GEOMETRY_TILE_VIEWS = {
    2017: 985, 2018: 1015, 2019: 1027, 2020: 1033,
    2021: 1035, 2022: 1041, 2023: 1052, 2024: 1232,
    2025: 1312, 2026: 3058,
};

// The already-shipped, join-less public tile host (confirmed live in a real report,
// build_tsmo2_corridor_view.mjs's "Selected corridor" symbology) — simpler than the join-capable
// host below, and fine for the plain-geometry layer, which never sets `join.enabled`.
const PLAIN_TILE_HOST = 'https://graph.availabs.org';

// The Map's own author-facing "what should this card show" choice — mirrors MEASURE_OPTIONS'
// shape ({value,label}) so AddGraphModal/QuickControls can render it with the exact same list UI
// chart measures already use. Deliberately a SEPARATE, much shorter list — most chart measures
// have no choropleth defaults authored yet (see CHOROPLETH_DEFAULTS below); adding one there is
// what it takes to add it here too.
export const MAP_MEASURE_OPTIONS = [
    { value: 'none', label: 'None — just show the route' },
    { value: 'speed', label: 'Speed (mph)' },
    { value: 'travelTime', label: 'Travel Time (min)' },
    { value: 'hoursOfDelay', label: 'Hours of Delay' },
    { value: 'avgHoursOfDelay', label: 'Avg. Hours of Delay' },
    { value: 'co2Emissions_passenger', label: 'CO2 Emissions (tonnes) — Passenger' },
    { value: 'avgCo2Emissions_passenger', label: 'Avg. CO2 Emissions (tonnes) — Passenger' },
    { value: 'co2Emissions_truck', label: 'CO2 Emissions (tonnes) — Truck' },
    { value: 'avgCo2Emissions_truck', label: 'Avg. CO2 Emissions (tonnes) — Truck' },
];

// Fixed choropleth breaks/colors per measure — see this file's header for the round-80 shared-file
// migration and why these are authored constants, not a live query. `maxValue` only affects the
// top bin's open-ended reading in the legend (choroplethPaint's own `max_value` param), never
// clamps real data. Per-measure provenance (placeholder vs. real-distribution-derived) lives in
// colorBreaks.json itself now, not here.
const CHOROPLETH_DEFAULTS = colorBreaks.measures;

// Hover-value formatFn per measure (shared `formatFunctions` registry — dataWrapper/utils/
// utils.jsx), mirroring route_map.py's `route_map_hover_columns` for the 4 measures Python also
// builds. The 4 CO2 variants have no Python precedent and no registry entry suited to their
// sub-0.01 magnitudes — `decimal_2` would round every real value to "0.00" (see colorBreaks.json's
// own note on those measures' domains) — so they fall through to raw passthrough (`' '`) below
// instead of a formatter that would actively lie.
const HOVER_VALUE_FORMAT = {
    speed: 'decimal_2',
    travelTime: 'minutes_clock',
    hoursOfDelay: 'decimal_2',
    avgHoursOfDelay: 'decimal_2',
};

// Hover-popup field list for a Route Map layer (`layer['hover-columns']`, read by the map
// runtime's HoverComp — ComponentRegistry/map/SymbologyViewLayer.jsx). `tmc`/`value` are the SAME
// property names every Route Map layer already carries on its rendered tile feature (geometry
// tiles: `cols=tmc`; choropleth `join.tileColumns`: `['value']`, server-baked into the tile via
// the tile URL's `join=` param) — the popup reads off the feature already under the cursor, no
// extra join fetch. Mirrors route_map.py's `route_map_hover_columns` so the live "Add Graph" /
// QuickControls authoring path and the old-report-conversion path behave identically.
function routeMapHoverColumns(measureKey) {
    const columns = [{ column_name: 'tmc', display_name: 'TMC', formatFn: ' ', justify: 'left' }];
    if (measureKey && measureKey !== 'none') {
        const measure = GRAPH_VOCAB.measures[measureKey];
        columns.push({
            column_name: 'value',
            display_name: measure?.label || measureKey,
            formatFn: HOVER_VALUE_FORMAT[measureKey] || ' ',
            justify: 'right',
        });
    }
    return columns;
}

// report-authoring-ux-overhaul.md Tier 6A (2026-08-20): Map had NO title auto-compose at all —
// confirmed by reading this whole file, zero references to `display.title` anywhere in it, unlike
// composeMeasureConfig.js's `composeAutoTitle`. This is Map's own equivalent, deliberately not a
// reuse of `composeAutoTitle` itself — that function keys off `vocab.measures`, which has no entry
// for Map's `'none'` sentinel, and branches on `pick.graphType`, which a Map section's own
// `_measurePick` never carries (see MAP_MEASURE_PICK_FIELDS in MeasurePicker/index.js). Mirrors the
// wording AddGraphModal's own Map preview-title already uses for the `'none'` case ("Map", not a
// redundant "None — just show the route"), but — unlike that preview text — never appends " — Map"
// for a real measure, matching every OTHER graph type's auto-title (bare measure label only, e.g.
// "Speed (mph)"), not a shape-suffixed variant.
export function composeMapAutoTitle(measureKey) {
    if (!measureKey || measureKey === 'none') return 'Map';
    return MAP_MEASURE_OPTIONS.find((o) => o.value === measureKey)?.label || 'Map';
}

// Same no-new-field pristine-check convention as composeMeasureConfig.js's `isTitleDirty` (see its
// own doc comment) — `priorMeasureKey` is whatever measure this Map's `_measurePick.measure` held
// BEFORE the apply in progress, not the new one about to be set.
export function isMapTitleDirty({ currentTitle, priorMeasureKey }) {
    if (!currentTitle) return false;
    return currentTitle !== composeMapAutoTitle(priorMeasureKey);
}

function latestAvailableYear() {
    const years = Object.keys(GEOMETRY_TILE_VIEWS).map(Number);
    const now = new Date().getFullYear();
    return years.includes(now) ? now : Math.max(...years);
}

const zoomWidth = (base) => ['interpolate', ['linear'], ['zoom'], 5, base, 10, base * 2, 14, base * 4];

// vocabulary.json's own measure `expr` keeps that measure's own trailing alias (e.g. "... as
// speed") and, separately, a `fn` field a chart's own column-object path (buildMeasureYAxisColumn)
// applies via the query builder's own aggregate-wrapping (buildUdaConfig.js's `applyFn` —
// `fn:'exempt'`/unset means the expr is already a complete, self-aggregating value and gets no
// wrap; a real aggregate name like `hoursOfDelay`'s `'sum'` wraps the expr body in `sum(...)`).
// Map's `query.columns` here is a plain array of raw SQL strings, not column objects, so that
// wrapping has to happen here instead — same rule, just applied by hand. Every consumer of this
// field wants the measure's OWN alias; Map's join query wants "value" instead (materializeSeriesLayer
// and choroplethPaint both key off a fixed `data-column: "value"`) — the one thing that's genuinely
// Map-specific about this function.
function valueExprAsValue(measureKey) {
    const measure = GRAPH_VOCAB.measures[measureKey];
    if (!measure?.expr) return null;
    const body = measure.expr.replace(/\s+as\s+\S+\s*$/i, '');
    const fn = measure.fn;
    if (!fn || fn === 'exempt') return `${body} as value`;
    return `${fn}(${body}) as value`;
}

// Real `buildJoin` (buildUdaConfig.js) — the same function every chart's own query already goes
// through — not a hand-rolled wire format. `externalSource: {}` is correct here (not undefined):
// Map's base ('ds') side is a raw ClickHouse table, never DMS-JSONB-backed, matching
// `buildJoinOnClause`'s `externalSource?.isDms` falsy-default read.
function buildMeasureJoin(measureKey) {
    const joinKeys = GRAPH_VOCAB.measures[measureKey]?.requiresJoin || [];
    if (!joinKeys.length) return null;
    const sources = {};
    joinKeys.forEach((key, i) => { sources[`table${i + 1}`] = GRAPH_VOCAB.joins[key]; });
    return buildJoin({ join: { sources }, externalSource: {} });
}

// One layer: the assigned routes' TMC geometry, hidden itself (it's the `series-template`, never
// rendered directly — useComparisonSeriesLayers.js clones it once per route assigned via
// ReportRouteList/QuickControls' Routes pill, each clone visible and colored from the series
// palette). Case/main two-sublayer structure matches every other route-geometry layer in this
// codebase (route_map.py, build_tsmo2_corridor_view.mjs).
function buildRouteGeometryLayer(year) {
    const viewId = GEOMETRY_TILE_VIEWS[year];
    if (!viewId) throw new Error(`composeMapConfig: no geometry tile view for year ${year}`);
    const lid = `route_geometry_${year}`;
    const srcId = `npmrds2_s582_v${viewId}_${lid}`;
    const tilesUrl = `${PLAIN_TILE_HOST}/dama-admin/npmrds2/tiles/${viewId}/{z}/{x}/{y}/t.pbf?cols=tmc`;
    return {
        id: lid, name: `Routes (${year} network)`, type: 'line',
        order: 1, isVisible: true,
        'series-template': true,
        'series-feature-column': 'tmc',
        // The template itself renders nothing (hidden sub-layers below) — keep it out of the
        // legend; materialized per-route clones clear this key (useComparisonSeriesLayers.js).
        'legend-orientation': 'none',
        // TMC-only hover — no joined measure column on this layer (see routeMapHoverColumns).
        hover: 'hover',
        'hover-columns': routeMapHoverColumns(),
        view_id: viewId, source_id: 582,
        sources: [{ id: srcId, source: { type: 'vector', tiles: [tilesUrl], format: 'pbf' } }],
        layers: [
            {
                id: `${lid}_case`, type: 'line', source: srcId, 'source-layer': `view_${viewId}`,
                paint: { 'line-color': '#1e293b', 'line-width': zoomWidth(1.8) },
                layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
            },
            {
                id: lid, type: 'line', source: srcId, 'source-layer': `view_${viewId}`,
                paint: { 'line-color': '#6D96AE', 'line-width': zoomWidth(1.2) },
                layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
            },
        ],
        filter: {},
    };
}

// Choropleth counterpart of buildRouteGeometryLayer — same case/main sub-layer skeleton, but the
// main sub-layer's color comes from a real data join instead of a flat constant, and the join
// itself needs the join-capable tile host (`apiHost`, threaded from CMSContext at the call site —
// this file has no context access of its own) since the plain host above doesn't implement the
// `join=` tile param (SymbologyViewLayer.jsx's buildJoinParam appends it client-side per request;
// the host on the tile URL has to actually honor it).
function buildChoroplethLayer({ measureKey, year, apiHost }) {
    const viewId = GEOMETRY_TILE_VIEWS[year];
    if (!viewId) throw new Error(`composeMapConfig: no geometry tile view for year ${year}`);
    const defaults = CHOROPLETH_DEFAULTS[measureKey];
    if (!defaults) throw new Error(`composeMapConfig: no choropleth defaults for measure ${measureKey}`);
    if (!apiHost) throw new Error('composeMapConfig: apiHost is required for a choropleth Map layer');
    const measure = GRAPH_VOCAB.measures[measureKey];
    const lid = `route_${measureKey}_${year}`;
    const srcId = `npmrds2_s582_v${viewId}_${lid}`;
    const tilesUrl = `${apiHost}/dama-admin/npmrds2/tiles/${viewId}/{z}/{x}/{y}/t.pbf?cols=tmc`;
    const painted = choroplethPaint(
        'value', defaults.maxValue, defaults.colors, defaults.colors.length,
        undefined, defaults.breaks, '#ccc', 'vertical'
    );
    const measureJoin = buildMeasureJoin(measureKey);
    // Same join/no-join duality this arc already hit and fixed once for the Table compose path
    // (report-authoring-ux-overhaul.md Tier 5F/5G): the query builder only aliases the base table
    // `AS ds` when the composed query has a JOIN — with none (travelTime's own `requiresJoin: []`),
    // the base table has no alias at all, and a hardcoded `ds.tmc` throws "Unknown expression
    // identifier 'ds.tmc'" (confirmed live via dms-server.log, not guessed). vocabulary.json's own
    // per-measure `expr` strings already get this right internally (every join-requiring measure's
    // expr is baked WITH `ds.`, travelTime's is baked WITHOUT) — this is the one place outside that
    // string that ALSO references the base table, so it needs the same conditional qualification.
    const tmcRef = measureJoin ? 'ds.tmc' : 'tmc';
    return {
        id: lid, name: `${measure.label} (${year} network)`, type: 'line',
        order: 1, isVisible: true,
        'series-template': true,
        'series-feature-column': 'tmc',
        'layer-type': 'choropleth',
        'data-column': 'value',
        'num-bins': defaults.colors.length,
        // Round 80: 'custom' (not 'quantile') — the Map runtime's own existing
        // escape hatch (ComponentRegistry/map/index.jsx) that skips the live
        // colorDomain refetch entirely and trusts this layer's own baked
        // paint/legend-data permanently. This is the one line that makes the
        // "fixed breaks" intent above actually real at render time, not just
        // at compose time — see this file's header comment. Semi-reverted
        // 2026-09-02: gated on APPLY_STATIC_BREAKS_TO_MAP (see header) —
        // 'quantile' is the pre-round-80 dynamic-scale default.
        'bin-method': APPLY_STATIC_BREAKS_TO_MAP ? 'custom' : 'quantile',
        'color-range': defaults.colors,
        'legend-data': painted.legend,
        // The runtime materializes one visible clone per comparison_series variant
        // (useComparisonSeriesLayers.js); the template layer itself must stay suppressed or it
        // renders an extra, un-labeled duplicate legend row.
        'legend-orientation': 'none',
        // See routeMapHoverColumns's own comment.
        hover: 'hover',
        'hover-columns': routeMapHoverColumns(measureKey),
        view_id: viewId, source_id: 582,
        join: {
            enabled: true, featureKeyColumn: 'tmc', joinColumn: 'tmc',
            source: { sourceId: 583, viewId: 982, env: 'npmrds2' },
            query: {
                columns: [valueExprAsValue(measureKey), `${tmcRef} as tmc`],
                groupBy: [tmcRef],
                join: measureJoin,
                filters: {}, filterRows: [], filterMode: 'all',
            },
            tileColumns: ['value'],
        },
        sources: [{ id: srcId, source: { type: 'vector', tiles: [tilesUrl], format: 'pbf' } }],
        layers: [
            {
                id: `${lid}_case`, type: 'line', source: srcId, 'source-layer': `view_${viewId}`,
                paint: { 'line-color': '#1e293b', 'line-width': zoomWidth(1.8) },
                layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
            },
            {
                id: lid, type: 'line', source: srcId, 'source-layer': `view_${viewId}`,
                paint: { 'line-color': painted.paint, 'line-width': zoomWidth(1.2) },
                layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
            },
        ],
        filter: {},
    };
}

// The one symbology slot this picker owns — a FIXED id, not keyed by measure/year, so switching
// measures replaces this one entry wholesale rather than accumulating a new symbology per pick.
// Any other symbology an author adds by hand (via the Symbology Library) lives under its own id
// and is never touched by this function.
const MANAGED_SYMBOLOGY_ID = 'mp_map_layer';

// Returns a full Map element-data state — the same shape `MapSection`'s `useImmer` initializer
// already tolerates from a blank `{}` (no defaultState exists for Map), pre-seeded with one
// route/measure symbology instead of nothing. Report-page wiring (self-bound `comparison_series`
// subscriber) is the SAME call every chart/table section gets via applyMeasurePickToState — reused
// directly, not re-derived. `apiHost` is only required when `measureKey` names a real measure.
export function composeMapSectionConfig({ measureKey = 'none', year, apiHost } = {}) {
    const resolvedYear = year || latestAvailableYear();
    const layer = (measureKey === 'none' || !CHOROPLETH_DEFAULTS[measureKey])
        ? buildRouteGeometryLayer(resolvedYear)
        : buildChoroplethLayer({ measureKey, year: resolvedYear, apiHost });
    const state = {
        symbologies: {
            [MANAGED_SYMBOLOGY_ID]: {
                id: MANAGED_SYMBOLOGY_ID,
                name: measureKey === 'none' ? 'Routes' : GRAPH_VOCAB.measures[measureKey]?.label || 'Routes',
                isVisible: true,
                symbology: { activeLayer: layer.id, layers: { [layer.id]: layer } },
            },
        },
    };
    ensureSelfBoundSubscriber(state);
    // Brand-new section, no prior title to preserve — always set (mirrors applyMeasurePickToState's
    // own "undefined priorPick" creation-time behavior, via isMapTitleDirty's `!currentTitle`
    // short-circuit).
    state.display.title = { ...state.display.title, title: composeMapAutoTitle(measureKey) };
    return state;
}

// Re-picking a Map's measure via QuickControls — mutates an EXISTING state's own managed slot in
// place (plain mutation syntax; works against an immer draft or a plain clone, same contract
// applyMeasurePickToState's own doc comment states) rather than replacing the whole state, so any
// other author-added symbology on this Map is left untouched. `priorMeasureKey` (the measure this
// Map's `_measurePick.measure` held before this apply) is threaded through from the call site
// (MeasurePicker/index.js) — same pristine-check purpose `applyMeasurePickToState`'s own
// `priorPick` capture serves, just Map-shaped.
export function applyMapMeasureToState(state, { measureKey = 'none', year, apiHost, priorMeasureKey } = {}) {
    const resolvedYear = year || latestAvailableYear();
    const layer = (measureKey === 'none' || !CHOROPLETH_DEFAULTS[measureKey])
        ? buildRouteGeometryLayer(resolvedYear)
        : buildChoroplethLayer({ measureKey, year: resolvedYear, apiHost });
    if (!state.symbologies) state.symbologies = {};
    state.symbologies[MANAGED_SYMBOLOGY_ID] = {
        id: MANAGED_SYMBOLOGY_ID,
        name: measureKey === 'none' ? 'Routes' : GRAPH_VOCAB.measures[measureKey]?.label || 'Routes',
        isVisible: true,
        symbology: { activeLayer: layer.id, layers: { [layer.id]: layer } },
    };
    ensureSelfBoundSubscriber(state);
    const currentTitle = state.display.title?.title;
    if (!isMapTitleDirty({ currentTitle, priorMeasureKey })) {
        state.display.title = { ...state.display.title, title: composeMapAutoTitle(measureKey) };
    }
}
