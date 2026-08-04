import { useContext, useEffect, useMemo, useState } from 'react';
import { ThemeContext, getComponentTheme } from '../../../../dms/packages/dms/src/ui/useTheme';
import { addGraphModalTheme } from './AddGraphModal.theme';
import {
  GRAPH_TYPE_OPTIONS,
  MEASURE_OPTIONS,
  RESOLUTION_OPTIONS,
  COMPARISON_MODE_OPTIONS,
  DEFAULT_PICK,
} from '../MeasurePicker/composeMeasureConfig';
import { MEASURE_DESCRIPTIONS, GRAPH_TYPE_DESCRIPTIONS } from './graphGuidanceCopy';

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
const GRAPH_TYPE_GLYPHS = {
  BarGraph: BarGraphGlyph,
  LineGraph: LineGraphGlyph,
  GridGraph: GridGraphGlyph,
};

// Guided "add a graph" flow — collapses the old two-step author path (+Add Component -> blank
// AVL Graph -> open sectionMenu -> Measure Picker -> configure) into one modal. This component
// only gathers the author's picks (which routes to assign, Graph Type/Measure/Resolution/
// Comparison Mode) and hands them to `onConfirm` — it does not itself create the section or
// touch PageContext, mirroring RouteTagBrowserModal's own contract (a picker component, not a
// persistence layer). See planning/tasks/current/dynamic-reports-and-route-tags.md's Add-Graph
// modal implementation plan for the full design record and why each piece looks the way it does.
export default function AddGraphModal({ open, setOpen, routes, onConfirm }) {
  const { UI, theme: themeFromContext = {} } = useContext(ThemeContext) || {};
  const { Button, Select, Modal } = UI || {};
  const t = { ...addGraphModalTheme, ...getComponentTheme(themeFromContext, 'addGraphModal') };

  const [pick, setPick] = useState(DEFAULT_PICK);
  const [selectedRouteIds, setSelectedRouteIds] = useState(new Set());

  // Reset on open — a stale pick/selection from a previous open shouldn't persist across
  // unrelated add-graph sessions (same convention as RouteTagBrowserModal).
  useEffect(() => {
    if (!open) return;
    setPick(DEFAULT_PICK);
    setSelectedRouteIds(new Set());
  }, [open]);

  const toggleRoute = (id) => {
    setSelectedRouteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
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
  const showAnchor = pick.comparisonMode === 'difference' && selectedInReportOrder.length === 2;
  const anchorOptions = showAnchor
    ? [
        { value: 'first', label: selectedInReportOrder[0].name },
        { value: 'second', label: selectedInReportOrder[1].name },
      ]
    : [];

  const Glyph = GRAPH_TYPE_GLYPHS[pick.graphType] || BarGraphGlyph;
  const measureLabel = MEASURE_OPTIONS.find((o) => o.value === pick.measure)?.label || pick.measure;
  const resolutionLabel = RESOLUTION_OPTIONS.find((o) => o.value === pick.resolution)?.label || pick.resolution;
  const comparisonLabel = COMPARISON_MODE_OPTIONS.find((o) => o.value === pick.comparisonMode)?.label || pick.comparisonMode;

  const canConfirm = selectedRouteIds.size >= 1;

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
          </div>

          <div>
            <div className={t.sectionLabel}>What to show</div>
            <div className={t.pickerGrid}>
              <div className={t.pickerField}>
                <label className={t.pickerLabel}>Graph Type</label>
                <Select options={GRAPH_TYPE_OPTIONS} value={pick.graphType} onChange={(v) => setPick((p) => ({ ...p, graphType: v }))} />
              </div>
              <div className={t.pickerField}>
                <label className={t.pickerLabel}>Measure</label>
                <Select options={MEASURE_OPTIONS} value={pick.measure} onChange={(v) => setPick((p) => ({ ...p, measure: v }))} />
              </div>
              <div className={t.pickerField}>
                <label className={t.pickerLabel}>Resolution</label>
                <Select options={RESOLUTION_OPTIONS} value={pick.resolution} onChange={(v) => setPick((p) => ({ ...p, resolution: v }))} />
              </div>
              <div className={t.pickerField}>
                <label className={t.pickerLabel}>Comparison Mode</label>
                <Select options={COMPARISON_MODE_OPTIONS} value={pick.comparisonMode} onChange={(v) => setPick((p) => ({ ...p, comparisonMode: v }))} />
              </div>
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

            <div className={t.preview}>
              <Glyph className={t.previewGlyph} />
              <div className={t.previewTextWrap}>
                <div className={t.previewTitle}>{measureLabel} — {GRAPH_TYPE_OPTIONS.find((o) => o.value === pick.graphType)?.label}</div>
                <div className={t.previewDescription}>{MEASURE_DESCRIPTIONS[pick.measure]}</div>
                <div className={t.previewDescription}>{GRAPH_TYPE_DESCRIPTIONS[pick.graphType]}</div>
                <div className={t.previewSummary}>
                  Shown at {resolutionLabel} resolution, {comparisonLabel.toLowerCase()} mode.
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
