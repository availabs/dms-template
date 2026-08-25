import { useContext, useEffect, useMemo, useState } from 'react';
import { ThemeContext, getComponentTheme } from '../../../../dms/packages/dms/src/ui/useTheme';
import { addGraphModalTheme } from './AddGraphModal.theme';
import {
  GRAPH_TYPE_OPTIONS,
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
import { MEASURE_DESCRIPTIONS, GRAPH_TYPE_DESCRIPTIONS } from './graphGuidanceCopy';
import { DOW_DEFS, WEEKDAY_KEYS, WEEKEND_KEYS, isDayOn, summarizeWeekdays, PEAK_PRESETS, timeOfDayToken } from '../ReportRouteList/utils';

// Small decorative glyphs for the static preview (Workstream 2 of the plan — a real
// per-pick /graph fetch was explicitly rejected in favor of a cheap illustration). The shared
// Icon set (ui/icons/icon_defs.jsx) has no chart iconography, so these are drawn inline rather
// than stretching that registry for a one-off decorative need.
function BarGraphGlyph(props) {
  return (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <rect x="4" y="20" width="6" height="16" rx="1" fill="currentColor" opacity="0.5" />
      <rect x="14" y="10" width="6" height="26" rx="1" fill="currentColor" />
      <rect x="24" y="16" width="6" height="20" rx="1" fill="currentColor" opacity="0.7" />
      <rect x="34" y="4" width="2" height="32" fill="currentColor" opacity="0.15" />
    </svg>
  );
}
function LineGraphGlyph(props) {
  return (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <polyline points="4,30 14,14 24,22 36,6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="14" cy="14" r="2" fill="currentColor" />
      <circle cx="24" cy="22" r="2" fill="currentColor" />
      <circle cx="36" cy="6" r="2" fill="currentColor" />
    </svg>
  );
}
function GridGraphGlyph(props) {
  const cells = [0.9, 0.3, 0.6, 0.4, 0.95, 0.2, 0.15, 0.55, 0.8];
  return (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      {cells.map((v, i) => (
        <rect key={i} x={4 + (i % 3) * 12} y={4 + Math.floor(i / 3) * 12} width="9" height="9" rx="1" fill="currentColor" opacity={v} />
      ))}
    </svg>
  );
}
function TableGlyph(props) {
  return (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <rect x="4" y="6" width="32" height="28" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <line x1="4" y1="16" x2="36" y2="16" stroke="currentColor" strokeWidth="2" opacity="0.7" />
      <line x1="4" y1="25" x2="36" y2="25" stroke="currentColor" strokeWidth="2" opacity="0.7" />
      <line x1="17" y1="6" x2="17" y2="34" stroke="currentColor" strokeWidth="2" opacity="0.4" />
    </svg>
  );
}
function MapGlyph(props) {
  return (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <path d="M6 10 L15 6 L25 10 L34 6 V30 L25 34 L15 30 L6 34 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <line x1="15" y1="6" x2="15" y2="30" stroke="currentColor" strokeWidth="2" opacity="0.4" />
      <line x1="25" y1="10" x2="25" y2="34" stroke="currentColor" strokeWidth="2" opacity="0.4" />
    </svg>
  );
}
const GRAPH_TYPE_GLYPHS = {
  BarGraph: BarGraphGlyph,
  LineGraph: LineGraphGlyph,
  GridGraph: GridGraphGlyph,
  Table: TableGlyph,
  Map: MapGlyph,
};

// This modal creates a brand-new section, so — unlike the shared chart-only
// GRAPH_TYPE_OPTIONS (also used by the older in-place edit-bar surface, which re-composes an
// already-created AVL Graph section and has no business offering "Table"/"Map" as a display
// type) — it can offer Table/Map as real, distinct shapes to create.
const SHAPE_OPTIONS = [...GRAPH_TYPE_OPTIONS, { value: 'Table', label: 'Table' }, { value: 'Map', label: 'Map' }];
// No shapes disabled today — kept as a real mechanism (not deleted) since Map WAS disabled here
// until Tier 5C (report-authoring-ux-overhaul.md, 2026-08-20) shipped a real compose path for it;
// a future shape addition may need the same "show the roadmap, don't hide it" treatment.
const DISABLED_SHAPES = {};

// Guided "add a graph" flow — collapses the old two-step author path (+Add Component -> blank
// AVL Graph -> open sectionMenu -> Measure Picker -> configure) into one modal. This component
// only gathers the author's picks (which routes to assign, Graph Type/Measure/Resolution/
// Comparison Mode) and hands them to `onConfirm` — it does not itself create the section or
// touch PageContext, mirroring RouteTagBrowserModal's own contract (a picker component, not a
// persistence layer). See planning/transportny/tasks/current/dynamic-reports-and-route-tags.md's Add-Graph
// modal implementation plan for the full design record and why each piece looks the way it does.
export default function AddGraphModal({ open, setOpen, routes, allRoutesResolved, onConfirm }) {
  const { UI, theme: themeFromContext = {} } = useContext(ThemeContext) || {};
  const { Button, Select, Modal } = UI || {};
  const t = { ...addGraphModalTheme, ...getComponentTheme(themeFromContext, 'addGraphModal') };

  const [pick, setPick] = useState(DEFAULT_PICK);
  const [selectedRouteIds, setSelectedRouteIds] = useState(new Set());

  // Route selection resets on open — a stale selection from a previous, unrelated add-graph
  // session shouldn't carry over (same convention as RouteTagBrowserModal). `pick` deliberately
  // does NOT reset: an author picking the same shape/measure for graph after graph is the common
  // case, and re-defaulting to Line/Travel Time/Hour every single open just made them re-pick it
  // every time.
  useEffect(() => {
    if (!open) return;
    setSelectedRouteIds(new Set());
  }, [open]);

  // report-authoring-ux-overhaul.md Tier 6B (2026-08-20): Map used to draw one route at a time
  // (mirroring the reference mockup's `m2SelectMode`) — confirmed via direct research that this was
  // a pure UI-gate choice, not a technical constraint: `materializeSeriesLayer`
  // (useComparisonSeriesLayers.js) already clones a template layer once per assigned route with no
  // route-count-specific logic, per-route coloring is already automatic, and the choropleth join
  // operates per-TMC, not per-route. Map now uses the exact same add/remove selection every other
  // shape already uses below.
  const toggleRoute = (id) => {
    setSelectedRouteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setWeekday = (key, on) => {
    setPick((p) => {
      const next = { ...(p.weekdays || {}) };
      if (on) delete next[key]; else next[key] = false;
      return { ...p, weekdays: next };
    });
  };
  const applyDowPreset = (onKeys) => {
    setPick((p) => {
      const next = {};
      DOW_DEFS.forEach(({ key }) => { if (!onKeys.includes(key)) next[key] = false; });
      return { ...p, weekdays: next };
    });
  };
  const applyTodPreset = (preset) => setPick((p) => ({ ...p, start: preset.startTime, end: preset.endTime }));
  const toggleMeasure = (m) => {
    setPick((p) => {
      const has = (p.measures || []).includes(m);
      const nextMeasures = has ? p.measures.filter((x) => x !== m) : [...(p.measures || []), m];
      return { ...p, measures: nextMeasures };
    });
  };

  // Difference graphs color `anchor - other` (see report-spec.md's "Difference graphs: anchor
  // and sign") — only meaningful once exactly 2 routes are checked. Order mirrors how
  // useGraphPublish will actually resolve variants once assigned: the report's own existing
  // `routes` array order (first-selected-in-array-order = variant[0]/baseline), not modal
  // selection order — same convention `getAnchorRouteOptions` (MeasurePicker/index.js) uses for
  // an already-published graph.
  const selectedInReportOrder = useMemo(
    () => routes.filter((r) => selectedRouteIds.has(r.route_comp_id)),
    [routes, selectedRouteIds]
  );
  // Matches QuickControls' own `hasMode` (npmrds-report.js:1020) — Map/Table don't offer a
  // comparison-mode concept, so hide the field here too rather than let an author set it at
  // creation and have it vanish the moment QuickControls takes over post-creation.
  const hasModeField = pick.graphType !== 'Map' && pick.graphType !== 'Table';
  const showAnchor = hasModeField && pick.comparisonMode === 'difference' && selectedInReportOrder.length === 2;
  const anchorOptions = showAnchor
    ? [
        { value: 'first', label: selectedInReportOrder[0].name },
        { value: 'second', label: selectedInReportOrder[1].name },
      ]
    : [];

  const Glyph = GRAPH_TYPE_GLYPHS[pick.graphType] || BarGraphGlyph;
  const isTable = pick.graphType === 'Table';
  // Map has no Resolution/Comparison-Mode/When concept at all — it's the assigned route's
  // geometry (optionally colored by a measure), not a time-bucketed data query — so those fields
  // hide below. Map DOES have its OWN, much shorter measure list (Tier 5I, 2026-08-20:
  // MAP_MEASURE_OPTIONS, not MEASURE_OPTIONS) — "none" (plain geometry) or one of the few measures
  // with an authored choropleth default.
  const isMap = pick.graphType === 'Map';
  // Gap #16 (2026-08-21): same bin/year gates QuickControls' own Reliability pill uses, computed
  // from this modal's pre-confirm selection state (selectedRouteIds + the flat weekdays/start/end
  // fields, not yet the per-route `routeWindows` shape `handleConfirmAddGraph` builds at confirm
  // time) rather than duplicating the resolution logic.
  const previewRouteIds = useMemo(() => Array.from(selectedRouteIds), [selectedRouteIds]);
  const previewRouteWindows = useMemo(
    () => Object.fromEntries(previewRouteIds.map((id) => [id, [{ weekdays: pick.weekdays, start: pick.start, end: pick.end }]])),
    [previewRouteIds, pick.weekdays, pick.start, pick.end]
  );
  const reliabilityBin = isTable ? resolveReliabilityBin(previewRouteIds, previewRouteWindows) : null;
  const reliabilityYear = isTable && reliabilityBin ? resolveReliabilityYear(previewRouteIds, allRoutesResolved) : null;
  const reliabilityAvailable = isTable && pick.resolution === 'summary' && !!reliabilityBin && !!PM3_VIEW_BY_YEAR[reliabilityYear];
  const reliabilityDisabledReason = !isTable ? null
    : pick.resolution !== 'summary' ? 'Reliability needs Summary resolution (one row per route).'
    : !reliabilityBin ? 'Reliability needs the When window set to exactly AM Peak, Midday, PM Peak, or an all-weekend day mask — no other window has a precomputed value.'
    : !PM3_VIEW_BY_YEAR[reliabilityYear] ? `No 1410 reliability data published for ${reliabilityYear ?? 'these routes’ dates'} yet.`
    : null;
  const measureLabel = isTable
    ? ((pick.measures || []).length
        ? `${pick.measures.length} measure${pick.measures.length === 1 ? '' : 's'}${pick.routeCompare && pick.resolution === 'summary' ? ' + compare' : ''}${reliabilityAvailable && pick.includeReliability ? ' + reliability' : ''}`
        : (reliabilityAvailable && pick.includeReliability ? 'reliability only' : 'no measures selected'))
    : isMap
      ? (MAP_MEASURE_OPTIONS.find((o) => o.value === pick.measure)?.label || pick.measure)
      : (MEASURE_OPTIONS.find((o) => o.value === pick.measure)?.label || pick.measure);
  const resolutionLabel = resolutionOptionsFor(pick.graphType).find((o) => o.value === pick.resolution)?.label || pick.resolution;
  const comparisonLabel = COMPARISON_MODE_OPTIONS.find((o) => o.value === pick.comparisonMode)?.label || pick.comparisonMode;

  const canConfirm = selectedRouteIds.size >= 1 && !DISABLED_SHAPES[pick.graphType]
    && (!isTable || (pick.measures || []).length >= 1 || (reliabilityAvailable && pick.includeReliability));

  const handleConfirm = () => {
    onConfirm?.({ pick, selectedRouteIds: Array.from(selectedRouteIds) });
    setOpen?.(false);
  };

  return (
    <Modal open={open} setOpen={setOpen} activeStyle="wide">
      <div className={t.wrapper}>
        <div className={t.header}>Add Graph</div>
        <div className={t.subheader}>Pick what the new graph should show, and which routes feed it.</div>

        <div className={t.body}>
          <div>
            <div className={t.sectionLabel}>Routes for this graph</div>
            <div className={t.routeChecklist}>
              {routes.map((r, i) => {
                const checked = selectedRouteIds.has(r.route_comp_id);
                return (
                  <button
                    key={r.route_comp_id ?? i}
                    type="button"
                    className={checked ? t.routeItemSelected : t.routeItem}
                    onClick={() => toggleRoute(r.route_comp_id)}
                  >
                    <input type="checkbox" className={t.routeCheckbox} checked={checked} readOnly />
                    <span className={t.routeColorSwatch} style={{ backgroundColor: r.color }} />
                    <span className={t.routeName}>{r.name}</span>
                  </button>
                );
              })}
              {!routes.length ? (
                <div className={t.empty}>No routes on this report yet — add a route first, then assign it here.</div>
              ) : null}
            </div>
            {routes.length > 0 ? (
              <div className={t.routesNote}>
                Each route keeps its identity colour, so the new card reads against the ones already on the report. A route can feed any number of cards.
              </div>
            ) : null}
          </div>

          <div>
            <div className={t.sectionLabel}>What to show</div>
            <div className={t.shapeCardGrid}>
              {SHAPE_OPTIONS.map((o) => {
                const ShapeGlyph = GRAPH_TYPE_GLYPHS[o.value] || BarGraphGlyph;
                const disabledReason = DISABLED_SHAPES[o.value];
                return (
                  <button
                    key={o.value}
                    type="button"
                    className={pick.graphType === o.value ? t.shapeCardSelected : t.shapeCard}
                    disabled={!!disabledReason}
                    title={disabledReason}
                    onClick={() => {
                      setPick((p) => {
                        const next = { ...p, graphType: o.value };
                        // Seed the Table multi-select from whatever single measure was already
                        // picked, so it never opens looking empty — but only the FIRST time (if
                        // the author already built up a `measures` set, re-clicking Table after
                        // browsing another shape shouldn't reset it back to one).
                        if (o.value === 'Table' && !(p.measures || []).length) {
                          next.measures = [p.measure];
                        }
                        // Map and every chart type read `measure` from two DIFFERENT, only
                        // coincidentally-overlapping option lists (MAP_MEASURE_OPTIONS vs
                        // MEASURE_OPTIONS) — reset whenever the current value isn't valid in the
                        // list the NEW shape actually uses, so switching shapes never leaves a
                        // stale/meaningless measure silently selected underneath.
                        if (o.value === 'Map' && !MAP_MEASURE_OPTIONS.some((m) => m.value === p.measure)) {
                          next.measure = 'none';
                        } else if (p.graphType === 'Map' && o.value !== 'Map' && !MEASURE_OPTIONS.some((m) => m.value === p.measure)) {
                          next.measure = DEFAULT_PICK.measure;
                        }
                        return next;
                      });
                    }}
                  >
                    <ShapeGlyph className={t.shapeCardGlyph} />
                    <span className={t.shapeCardLabel}>{o.label}</span>
                  </button>
                );
              })}
            </div>
            {/* report-authoring-ux-overhaul.md Tier 5D (2026-08-20): Table is the one shape that
                can hold more than one measure (one column each) — every chart type still draws
                exactly one measure's worth of yAxis, so they keep the plain single select below.
                Rendered full-width, above the 2-col pickerGrid, rather than squeezed into one of
                its cells — a checklist needs more room than a `<select>` ever did. */}
            {pick.graphType === 'Table' ? (
              <div className={`${t.pickerField} mb-3`}>
                <label className={t.pickerLabel}>Measures (pick any)</label>
                <div className={t.measureChecklist}>
                  {MEASURE_CATEGORIES.map((cat) => (
                    <div key={cat.label}>
                      <div className={t.measureGroupLabel}>{cat.label}</div>
                      {cat.measures.map((m) => {
                        const opt = MEASURE_OPTIONS.find((o) => o.value === m);
                        if (!opt) return null;
                        const checked = (pick.measures || []).includes(m);
                        return (
                          <button
                            key={m}
                            type="button"
                            className={checked ? t.routeItemSelected : t.routeItem}
                            onClick={() => toggleMeasure(m)}
                          >
                            <input type="checkbox" className={t.routeCheckbox} checked={checked} readOnly />
                            <span className={t.routeName}>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
                {!(pick.measures || []).length && !(reliabilityAvailable && pick.includeReliability) ? (
                  <div className={t.warningNote}>Pick at least one measure, or turn on Reliability below — a table with neither has no columns to show.</div>
                ) : null}
                {(pick.measures || []).length ? (
                  <>
                    {/* report-authoring-ux-overhaul.md gap #16 (2026-08-21): Route Compare's "% vs
                        Main" delta only ever computes a real route-vs-route difference at Summary
                        resolution — __ANCHOR__ collapses the anchor route's ENTIRE range into one
                        scalar with no per-bucket grouping of its own, so at any time-bucketed
                        resolution the delta compares each bucket against the anchor's overall
                        average instead of another route's value at that same bucket. Disabled
                        (not hidden) outside Summary, matching the Difference-mode-count gate's own
                        "show but disable" precedent elsewhere in this file. */}
                    <button
                      type="button"
                      disabled={pick.resolution !== 'summary'}
                      title={pick.resolution !== 'summary' ? 'Route Compare only works at Summary resolution — it compares each route\'s overall value, not a single time bucket.' : undefined}
                      className={pick.routeCompare ? t.routeItemSelected : t.routeItem}
                      onClick={() => setPick((p) => ({ ...p, routeCompare: !p.routeCompare }))}
                    >
                      <input type="checkbox" className={t.routeCheckbox} checked={!!pick.routeCompare} readOnly />
                      <span className={t.routeName}>Route Compare — add a "% vs Main" column per measure</span>
                    </button>
                    {pick.resolution !== 'summary' ? (
                      <div className={t.routesNote}>Only available at Summary resolution — set Resolution to "Summary (one row per route)" below to compare routes against each other.</div>
                    ) : pick.routeCompare ? (
                      <div className={t.routesNote}>
                        Each measure gets an extra column showing this row's % difference from whichever route is first in this report's list (the anchor) — the server resolves this live, so reordering routes later changes which one is "Main."
                      </div>
                    ) : null}
                  </>
                ) : null}
                {/* Gap #16 (2026-08-21): source 1410's LOTTR/TTTR/Freeflow. Rendered regardless of
                    whether any other measure is checked — Info Box's own real shape had no
                    "other measure" concept at all, reliability could always stand alone. */}
                <button
                  type="button"
                  disabled={!reliabilityAvailable}
                  title={reliabilityDisabledReason || undefined}
                  className={pick.includeReliability ? t.routeItemSelected : t.routeItem}
                  onClick={() => setPick((p) => ({ ...p, includeReliability: !p.includeReliability }))}
                >
                  <input type="checkbox" className={t.routeCheckbox} checked={!!pick.includeReliability} readOnly />
                  <span className={t.routeName}>Reliability — add LOTTR/TTTR/Freeflow columns</span>
                </button>
                {reliabilityDisabledReason ? (
                  <div className={t.routesNote}>{reliabilityDisabledReason}</div>
                ) : reliabilityAvailable && pick.includeReliability ? (
                  <div className={t.routesNote}>Adds LOTTR/TTTR ({RELIABILITY_BIN_LABELS[reliabilityBin]}) and Freeflow Speed columns, joined live from source 1410's year-{reliabilityYear} view.</div>
                ) : null}
              </div>
            ) : null}

            <div className={t.pickerGrid}>
              {!isTable && !isMap ? (
                <div className={t.pickerField}>
                  <label className={t.pickerLabel}>Measure</label>
                  {/* Native <select>/<optgroup> — the shared Select/MultiSelect primitive has no
                      grouped-option support, and adding one there is a bigger, separate change
                      than this one field needs. */}
                  <select
                    className={t.measureNativeSelect}
                    value={pick.measure}
                    onChange={(e) => setPick((p) => ({ ...p, measure: e.target.value }))}
                  >
                    {MEASURE_CATEGORIES.map((cat) => (
                      <optgroup key={cat.label} label={cat.label}>
                        {cat.measures.map((m) => {
                          const opt = MEASURE_OPTIONS.find((o) => o.value === m);
                          return opt ? <option key={m} value={m}>{opt.label}</option> : null;
                        })}
                      </optgroup>
                    ))}
                  </select>
                </div>
              ) : null}
              {/* Map's own, much shorter measure list (Tier 5I, 2026-08-20) — a novice pick, not
                  the full chart vocabulary: "just show the route" or color it by one of the few
                  measures with an authored choropleth default (composeMapConfig.js). */}
              {isMap ? (
                <div className={t.pickerField}>
                  <label className={t.pickerLabel}>Color by</label>
                  <Select
                    options={MAP_MEASURE_OPTIONS}
                    value={pick.measure}
                    onChange={(v) => setPick((p) => ({ ...p, measure: v }))}
                  />
                </div>
              ) : null}
              {!isMap ? (
                <div className={t.pickerField}>
                  <label className={t.pickerLabel}>Resolution</label>
                  <Select options={resolutionOptionsFor(pick.graphType)} value={pick.resolution} onChange={(v) => setPick((p) => ({ ...p, resolution: v }))} />
                </div>
              ) : null}
              {hasModeField ? (
                <div className={t.pickerField}>
                  <label className={t.pickerLabel}>Comparison Mode</label>
                  <Select options={COMPARISON_MODE_OPTIONS} value={pick.comparisonMode} onChange={(v) => setPick((p) => ({ ...p, comparisonMode: v }))} />
                </div>
              ) : null}
              {showAnchor ? (
                <div className={t.pickerField}>
                  <label className={t.pickerLabel}>Anchor Route</label>
                  <Select
                    options={anchorOptions}
                    value={pick.anchorInvert ? 'second' : 'first'}
                    onChange={(v) => setPick((p) => ({ ...p, anchorInvert: v === 'second' }))}
                  />
                </div>
              ) : null}
            </div>

            {/* report-authoring-ux-overhaul.md Tier 5E (2026-08-20): Difference picked with the
                wrong route count — this modal can't disable the Select option itself (see the
                theme file's own note on `warningNote`), so a warning is the equivalent signal. */}
            {hasModeField && pick.comparisonMode === 'difference' && selectedRouteIds.size !== 2 ? (
              <div className={t.warningNote}>
                Difference mode compares exactly two routes; {selectedRouteIds.size} selected right now.
              </div>
            ) : null}

            {/* When — time-of-day + day-of-week, the exact facets that moved off the route onto
                the graph (design push #2, 2026-08-06). Not offered for Map (routeSelect is the
                only per-card facet Map's own read-only Quick Controls exposes; a Map card is
                colored by the measure at a point in time, not a window average). */}
            {pick.graphType !== 'Map' && (
              <div className="mt-3">
                <div className={t.sectionLabel}>When</div>
                <div className={t.whenPresetRow}>
                  {PEAK_PRESETS.map((preset) => {
                    const on = pick.start === preset.startTime && pick.end === preset.endTime;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        className={on ? t.whenPresetSelected : t.whenPreset}
                        onClick={() => applyTodPreset(preset)}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                <div className={t.dowRow}>
                  {DOW_DEFS.map(({ key, label }) => {
                    const on = isDayOn(pick.weekdays, key);
                    return (
                      <button key={key} type="button" className={on ? t.dayToggleSelected : t.dayToggle} onClick={() => setWeekday(key, !on)}>
                        {label}
                      </button>
                    );
                  })}
                  <span className="w-1" />
                  <button type="button" className={t.daySetBtn} onClick={() => applyDowPreset(WEEKDAY_KEYS)}>Weekdays</button>
                  <button type="button" className={t.daySetBtn} onClick={() => applyDowPreset(WEEKEND_KEYS)}>Weekends</button>
                  <button type="button" className={t.daySetBtn} onClick={() => applyDowPreset(DOW_DEFS.map((d) => d.key))}>All</button>
                </div>
              </div>
            )}

            <div className={t.preview}>
              <Glyph className={t.previewGlyph} />
              <div className={t.previewTextWrap}>
                {/* Map, when its measure is 'none', has no measure at all — "None — just show
                    the route — Map" would be redundant, so the title drops the measure prefix
                    only in that one case. */}
                <div className={t.previewTitle}>
                  {isMap && pick.measure === 'none'
                    ? SHAPE_OPTIONS.find((o) => o.value === pick.graphType)?.label
                    : `${measureLabel} — ${SHAPE_OPTIONS.find((o) => o.value === pick.graphType)?.label}`}
                </div>
                {/* A single measure's description reads fine standing alone; once a table has
                    2+, no ONE measure's blurb represents the whole card, so it's dropped rather
                    than arbitrarily showing whichever measure `pick.measure` happens to still
                    hold from before the shape switched to Table. Map's own MEASURE_DESCRIPTIONS
                    lookup is keyed the same way charts already are (both read vocabulary.json's
                    measure keys) — 'none' simply has no entry, so nothing renders for it. */}
                {(!isTable || (pick.measures || []).length === 1) ? (
                  <div className={t.previewDescription}>
                    {MEASURE_DESCRIPTIONS[isTable ? pick.measures[0] : pick.measure]}
                  </div>
                ) : null}
                <div className={t.previewDescription}>{GRAPH_TYPE_DESCRIPTIONS[pick.graphType]}</div>
                <div className={t.previewSummary}>
                  {isMap
                    ? 'Shows the selected route(s)’ geometry on a map — style and layers are editable afterward via the map’s own settings.'
                    : <>Shown at {resolutionLabel} resolution, {timeOfDayToken(pick.start, pick.end)} · {(summarizeWeekdays(pick.weekdays) || 'all days').toLowerCase()}{hasModeField ? `, ${comparisonLabel.toLowerCase()} mode` : ''}.</>}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={t.footer}>
          <div className={t.footerCount}>{selectedRouteIds.size} route{selectedRouteIds.size === 1 ? '' : 's'} selected</div>
          <div className={t.footerButtons}>
            <Button themeOptions={{ size: 'sm', color: 'transparent' }} onClick={() => setOpen?.(false)}>Cancel</Button>
            <Button themeOptions={{ size: 'sm', color: 'primary' }} disabled={!canConfirm} onClick={handleConfirm}>
              Add Graph
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
