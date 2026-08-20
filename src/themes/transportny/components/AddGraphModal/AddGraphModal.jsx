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
} from '../MeasurePicker/composeMeasureConfig';
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
// type) — it can offer Table/Map as real, distinct shapes to create. Map is included but
// disabled: its compose path doesn't exist yet (see useAddGraphSection.js's note), so selecting
// it would silently do nothing; better to show the roadmap than hide it.
const SHAPE_OPTIONS = [...GRAPH_TYPE_OPTIONS, { value: 'Table', label: 'Table' }, { value: 'Map', label: 'Map' }];
const DISABLED_SHAPES = { Map: "Map graphs aren't built yet." };

// Guided "add a graph" flow — collapses the old two-step author path (+Add Component -> blank
// AVL Graph -> open sectionMenu -> Measure Picker -> configure) into one modal. This component
// only gathers the author's picks (which routes to assign, Graph Type/Measure/Resolution/
// Comparison Mode) and hands them to `onConfirm` — it does not itself create the section or
// touch PageContext, mirroring RouteTagBrowserModal's own contract (a picker component, not a
// persistence layer). See planning/transportny/tasks/current/dynamic-reports-and-route-tags.md's Add-Graph
// modal implementation plan for the full design record and why each piece looks the way it does.
export default function AddGraphModal({ open, setOpen, routes, onConfirm }) {
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

  // A Map card draws one route at a time (m2SelectMode in the reference file) — clicking the
  // already-selected route deselects it, clicking a different one REPLACES the selection rather
  // than adding to it. Verified against the reference's own `m2-pick` handler: no toast/refusal
  // for this per-row click (a toast only guards a "select all" affordance, which this modal
  // doesn't have).
  const toggleRoute = (id) => {
    if (pick.graphType === 'Map') {
      setSelectedRouteIds((prev) => (prev.has(id) && prev.size === 1 ? new Set() : new Set([id])));
      return;
    }
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
  const measureLabel = isTable
    ? ((pick.measures || []).length
        ? `${pick.measures.length} measure${pick.measures.length === 1 ? '' : 's'}`
        : 'no measures selected')
    : (MEASURE_OPTIONS.find((o) => o.value === pick.measure)?.label || pick.measure);
  const resolutionLabel = resolutionOptionsFor(pick.graphType).find((o) => o.value === pick.resolution)?.label || pick.resolution;
  const comparisonLabel = COMPARISON_MODE_OPTIONS.find((o) => o.value === pick.comparisonMode)?.label || pick.comparisonMode;

  const canConfirm = selectedRouteIds.size >= 1 && !DISABLED_SHAPES[pick.graphType]
    && (!isTable || (pick.measures || []).length >= 1);

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
                {pick.graphType === 'Map'
                  ? 'A map draws one route at a time — picking another replaces it.'
                  : 'Each route keeps its identity colour, so the new card reads against the ones already on the report. A route can feed any number of cards.'}
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
                        return next;
                      });
                      // Switching TO Map collapses an existing multi-selection to just its first
                      // entry (mirrors the reference file's own graph-type-switch behavior) — a
                      // Map card can only ever draw one route.
                      if (o.value === 'Map') {
                        setSelectedRouteIds((prev) => (prev.size > 1 ? new Set([Array.from(prev)[0]]) : prev));
                      }
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
                {!(pick.measures || []).length ? (
                  <div className={t.warningNote}>Pick at least one measure — a table with none has no columns to show.</div>
                ) : null}
              </div>
            ) : null}

            <div className={t.pickerGrid}>
              {pick.graphType !== 'Table' ? (
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
              <div className={t.pickerField}>
                <label className={t.pickerLabel}>Resolution</label>
                <Select options={resolutionOptionsFor(pick.graphType)} value={pick.resolution} onChange={(v) => setPick((p) => ({ ...p, resolution: v }))} />
              </div>
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
                <div className={t.previewTitle}>{measureLabel} — {SHAPE_OPTIONS.find((o) => o.value === pick.graphType)?.label}</div>
                {/* A single measure's description reads fine standing alone; once a table has
                    2+, no ONE measure's blurb represents the whole card, so it's dropped rather
                    than arbitrarily showing whichever measure `pick.measure` happens to still
                    hold from before the shape switched to Table. */}
                {!isTable || (pick.measures || []).length === 1 ? (
                  <div className={t.previewDescription}>
                    {MEASURE_DESCRIPTIONS[isTable ? pick.measures[0] : pick.measure]}
                  </div>
                ) : null}
                <div className={t.previewDescription}>{GRAPH_TYPE_DESCRIPTIONS[pick.graphType]}</div>
                <div className={t.previewSummary}>
                  Shown at {resolutionLabel} resolution{pick.graphType !== 'Map' ? `, ${timeOfDayToken(pick.start, pick.end)} · ${(summarizeWeekdays(pick.weekdays) || 'all days').toLowerCase()}` : ''}{hasModeField ? `, ${comparisonLabel.toLowerCase()} mode` : ''}.
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
