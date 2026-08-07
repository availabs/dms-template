import React, { useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ThemeContext, getComponentTheme } from '../../../../dms/packages/dms/src/ui/useTheme';
import { quickControlsTheme } from './QuickControls.theme';
import { applyMeasurePick, isReportPage } from '../MeasurePicker';
import {
  MEASURE_OPTIONS,
  MEASURE_CATEGORIES,
  RESOLUTION_OPTIONS,
  COMPARISON_MODE_OPTIONS,
  DEFAULT_PICK,
} from '../MeasurePicker/composeMeasureConfig';
import { ROUTE_CATALOG_PARAM_KEY } from '../ReportRouteList/useGraphPublish';
import { SELF_PARAM_KEY_SENTINEL } from '../../../../dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/buildUdaConfig';
import { DOW_DEFS, WEEKDAY_KEYS, WEEKEND_KEYS, isDayOn, summarizeWeekdays, PEAK_PRESETS, timeOfDayToken, formatDateShort } from '../ReportRouteList/utils';

/**
 * NPMRDS "Quick Controls" — sectionHeaderExtensions builder for "AVL Graph"/"Spreadsheet"/"Map".
 *
 * Design push #2 (2026-08-06): grows from 2 pills (Measure, Comparison Mode) to 5 (Routes,
 * Measure, When, Aggregate, Mode) — the exact facets that moved OFF the route (weekday mask,
 * time-of-day, route assignment) now live here, on the graph's own `display._measurePick`
 * (see MeasurePicker/composeMeasureConfig.js's DEFAULT_PICK and useGraphPublish.js's per-graph
 * transformReportRoutes, which reads these same fields back out). Every pill still writes
 * through the shared `applyMeasurePick` so this row and the older Settings-drawer item-group
 * (MeasurePicker/index.js) can never silently drift.
 *
 * Two design decisions kept from the mockup (npmrds-report.js:929-1073):
 *   1. WHEN IS ONE PILL, not two — time-of-day and day-of-week are one thought ("weekday PM
 *      peak"), splitting them would double the pill count for no gain.
 *   2. THE ROW COMPRESSES. Not every card is wide enough for 5 pills — below a certain width
 *      the row measures itself and folds the lowest-priority pills into one "⋯" pill that opens
 *      the same popover contents, in this drop order: mode → aggregate → when → measure. Routes
 *      never drops — it's the reason this row exists.
 */
export function npmrdsQuickControls({ state, dwAPI, currentComponent, isEdit, canEditSection, siblingSections = [], pageState }) {
  // Gate on the actual self-binding mechanism (an enabled `$self` comparison_series subscriber —
  // the same test `useGraphPublish.js`'s `findSelfBoundGraphs` uses to decide whether a section
  // receives a published route list at all) rather than `state?.comparisonSeries?.enabled`, a
  // Graph/Spreadsheet-only convenience flag `route_map.py`'s Map template builders never set
  // (Map has its own `symbologies`/series-template layer mechanism — see
  // `dynamic-report-nongraph-section-binding.md` item 1). Checking `comparisonSeries.enabled`
  // meant the "Routes" pill structurally could never render for a Map section in edit mode, even
  // though `_measurePick`/`routeIds` resolve and publish correctly for Map exactly like any other
  // self-bound section. Still correctly excludes an incidental Spreadsheet with no self-binding at
  // all (e.g. this report's own "Add a Route to Your Report" search grid — found live 2026-08-06,
  // Quick Controls was rendering a meaningless "no routes / travel time / all day" pill row on it
  // before this check was added) since that section carries no such subscriber either.
  const isSelfBound = (state?.display?._functions?.subscribers || []).some(
    (s) => s?.functionId === 'comparison_series' && s?.enabled && s?.paramKey === SELF_PARAM_KEY_SENTINEL
  );
  if (!(isEdit && canEditSection && currentComponent?.useDataSource && isSelfBound && isReportPage(siblingSections))) return null;
  return <QuickControlsRow state={state} dwAPI={dwAPI} currentComponent={currentComponent} pageState={pageState} />;
}

// "AM Peak"/"PM Peak"/... token map — mirrors the mockup's RES_TOKEN, short enough to survive a
// narrow pill.
const RES_TOKEN = { '5-minutes': '5m', '15-minutes': '15m', hour: '1h', day: '1d', weekday: 'wk', month: '1mo' };

// The unit/qualifier is in the popover; the pill just needs the bare measure name — "Speed (mph)"
// and "CO2 Emissions (tonnes) — Passenger" both truncate badly in a header this compact.
function qcMeasureLabel(label) {
  return (label || 'measure').replace(/\s*\([^)]*\)/, '').replace(/\s*—.*$/, '');
}

function qcDaysToken(weekdays) {
  const summary = summarizeWeekdays(weekdays);
  if (!summary) return 'all';
  if (summary === 'Weekdays only') return 'Wd';
  if (summary === 'Weekends only') return 'We';
  const on = DOW_DEFS.filter(({ key }) => isDayOn(weekdays, key)).length;
  return `${on}d`;
}

function QuickControlsRow({ state, dwAPI, currentComponent, pageState }) {
  const { UI, theme: themeFromContext = {} } = useContext(ThemeContext) || {};
  const { Popup, Icon } = UI || {};
  const t = { ...quickControlsTheme, ...getComponentTheme(themeFromContext, 'quickControls') };
  const pick = { ...DEFAULT_PICK, ...(state?.display?._measurePick || {}) };
  // currentComponent?.type (the ComponentRegistry's own identity), not state.display.graphType /
  // pick.graphType — a Map section's stored state never carries either field (confirmed live
  // 2026-08-07: _measurePick only ever has weekdays/start/end/routeIds), so both would silently
  // fall back to DEFAULT_PICK's 'LineGraph' and show AVL-Graph-only pills (Measure/Aggregate/Mode)
  // on a Map card — one of which (Measure) would corrupt the Map's real `symbologies` config if
  // clicked, via applyMeasurePick's now-Map-aware short-circuit. See
  // dynamic-report-nongraph-section-binding.md item 9.
  const isMapCard = currentComponent?.type === 'Map';
  const graphType = isMapCard ? 'Map' : (state?.display?.graphType || pick.graphType);
  const hasMode = graphType !== 'Map' && graphType !== 'Table';
  const hasMeasureAggregate = !isMapCard;
  const single = graphType === 'Map';

  const routeCatalog = useMemo(() => {
    const values = pageState?.filters?.find((f) => f.searchKey === ROUTE_CATALOG_PARAM_KEY && f.type === 'action')?.values;
    return Array.isArray(values) ? values : [];
  }, [pageState?.filters]);
  const routeIds = pick.routeIds || [];
  const routesById = useMemo(() => new Map(routeCatalog.map((r) => [r.route_comp_id, r])), [routeCatalog]);

  const applyPick = (partial) => applyMeasurePick({ state, dwAPI, currentComponent }, partial);

  const toggleRoute = (routeCompId) => {
    if (single) {
      applyPick({ routeIds: routeIds[0] === routeCompId ? [] : [routeCompId] });
      return;
    }
    applyPick({ routeIds: routeIds.includes(routeCompId) ? routeIds.filter((id) => id !== routeCompId) : [...routeIds, routeCompId] });
  };
  const setWeekday = (key, on) => {
    const next = { ...(pick.weekdays || {}) };
    // Only an explicit `false` is meaningful (see utils.js's generateDateRange) — matches the
    // route-side convention this replaces, so storage never carries a same-meaning-but-verbose
    // all-true object.
    if (on) delete next[key]; else next[key] = false;
    applyPick({ weekdays: next });
  };
  const applyDowPreset = (onKeys) => {
    const next = {};
    DOW_DEFS.forEach(({ key }) => { if (!onKeys.includes(key)) next[key] = false; });
    applyPick({ weekdays: next });
  };
  const applyTodPreset = (preset) => applyPick({ start: preset.startTime, end: preset.endTime });

  const measureLabel = qcMeasureLabel(MEASURE_OPTIONS.find((o) => o.value === pick.measure)?.label);
  const routeLabel = routeIds.length === 0
    ? 'no routes'
    : routeIds.length === 1
      ? (routesById.get(routeIds[0])?.name || '1 route')
      : `${routeIds.length} routes`;
  const whenToken = `${timeOfDayToken(pick.start, pick.end)} · ${qcDaysToken(pick.weekdays)}`;
  const whenTitle = `When · ${(pick.start && pick.end) ? `${pick.start}–${pick.end}` : 'all day'} · ${(summarizeWeekdays(pick.weekdays) || 'all days').toLowerCase()}`;
  const aggregateLabel = RES_TOKEN[pick.resolution] || pick.resolution;
  const modeIsDifference = pick.comparisonMode === 'difference';

  // Ordered lowest-priority-last — this IS the drop order (a prefix of this array is kept).
  const pillDefs = useMemo(() => {
    const defs = [
      { kind: 'routes', label: routeLabel, title: single ? 'This card draws one route' : 'Routes on this card', strong: routeIds.length === 0 },
    ];
    // Measure/Aggregate are AVL-Graph-only concepts — a Map card has no measure/resolution pick of
    // its own (its choropleth measure is fixed at conversion/build time, not author-editable via
    // this row), and composeMeasureConfig has no Map-shaped output for either to compose anyway.
    if (hasMeasureAggregate) defs.push({ kind: 'measure', label: measureLabel, title: `Measure · ${MEASURE_OPTIONS.find((o) => o.value === pick.measure)?.label || ''}` });
    defs.push({ kind: 'when', label: whenToken, title: whenTitle });
    if (hasMeasureAggregate) defs.push({ kind: 'aggregate', label: aggregateLabel, title: `Aggregate · ${RESOLUTION_OPTIONS.find((o) => o.value === pick.resolution)?.label || ''}` });
    // Short text, not the mockup's own glyph — building/maintaining a plain-vs-difference SVG
    // pair for one pill wasn't worth it next to the existing short-token convention every other
    // pill already uses (found live 2026-08-06: an earlier icon-only-sized version of this pill
    // rendered "Overlay"/"Difference" as text inside a 24px square, overflowing it).
    if (hasMode) defs.push({ kind: 'mode', label: modeIsDifference ? 'Diff' : 'Overlay', title: `Comparison mode · ${modeIsDifference ? 'difference' : 'overlay'}`, strong: modeIsDifference });
    return defs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeLabel, measureLabel, whenToken, whenTitle, aggregateLabel, modeIsDifference, hasMode, hasMeasureAggregate, single, routeIds.length, pick.measure, pick.resolution]);

  // ── Row-fit: measure the real rendered width of every pill (in an off-screen shadow copy,
  // so widths stay accurate for pills currently trimmed from the visible row) against the
  // row's own available width, then greedily keep as many as fit, reserving the "⋯" pill's own
  // width up front. See npmrds-report.js:1035-1069's identical algorithm and reasoning — this is
  // a much simpler port of it since the live header band renders this row on its OWN full-width
  // line below the title (theme.headerExtensionsRow), unlike the mockup's assumption that the
  // title/kebab share the same row and eat into this row's budget.
  const wrapperRef = useRef(null);
  const shadowRefs = useRef([]);
  const shadowMoreRef = useRef(null);
  const [keepCount, setKeepCount] = useState(pillDefs.length);
  const GAP = 6;

  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const measure = () => {
      const budget = el.clientWidth;
      const widths = shadowRefs.current.slice(0, pillDefs.length).map((n) => n?.offsetWidth || 0);
      const moreWidth = shadowMoreRef.current?.offsetWidth || 0;
      const totalAll = widths.reduce((a, w) => a + w, 0) + GAP * Math.max(0, widths.length - 1);
      if (totalAll <= budget) { setKeepCount(pillDefs.length); return; }
      let used = moreWidth;
      let keep = 0;
      for (let i = 0; i < widths.length; i++) {
        if (used + widths[i] + GAP > budget) break;
        used += widths[i] + GAP;
        keep++;
      }
      setKeepCount(Math.max(1, keep)); // Routes always survives — it's why the row exists.
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pillDefs]);

  const visiblePills = pillDefs.slice(0, keepCount);
  const overflowKinds = pillDefs.slice(keepCount).map((p) => p.kind);

  // ── Popover section bodies — shared by a single pill's own popover and the "⋯" pill's
  // combined one (kind === 'all' renders every applicable section). ──
  const renderRoutesSection = () => (
    <div className={t.popSection}>
      <div className={t.popSectionLabel}>{single ? 'route · pick one' : 'routes · pick any'}</div>
      {routeCatalog.length === 0 ? (
        <div className={t.popEmpty}>No routes on this report yet.</div>
      ) : (
        <div className={t.popRouteList}>
          {routeCatalog.map((r) => {
            const on = routeIds.includes(r.route_comp_id);
            return (
              <button key={r.route_comp_id} type="button" className={on ? t.popRouteRowOn : t.popRouteRow} onClick={() => toggleRoute(r.route_comp_id)}>
                <span className={on ? t.popRouteCheckOn : t.popRouteCheck}>{on ? <Icon icon="Check" /> : null}</span>
                <span className={t.popRouteDot} style={{ backgroundColor: r.color }} />
                <span className={t.popRouteName}>{r.name}</span>
                <span className={t.popRouteMeta}>{formatDateShort(r.startDate) ? `${formatDateShort(r.startDate)}–${formatDateShort(r.endDate)}` : ''}</span>
              </button>
            );
          })}
        </div>
      )}
      {single && <div className={t.popNote}>A map draws one route at a time — picking another replaces it.</div>}
      {!single && modeIsDifference && routeIds.length !== 2 && (
        <div className={t.popWarning}>Difference mode compares exactly two routes; this card has {routeIds.length}.</div>
      )}
    </div>
  );

  const renderMeasureSection = () => (
    <div className={t.popSection}>
      <div className={t.popSectionLabel}>measure</div>
      <div className={t.popMeasureList}>
        {MEASURE_CATEGORIES.map((cat) => (
          <div key={cat.label}>
            <div className={t.popGroupLabel}>{cat.label}</div>
            {cat.measures.map((m) => {
              const opt = MEASURE_OPTIONS.find((o) => o.value === m);
              if (!opt) return null;
              const on = m === pick.measure;
              return (
                <button key={m} type="button" className={on ? t.popMeasureItemOn : t.popMeasureItem} onClick={() => applyPick({ measure: m })}>
                  {opt.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  const renderWhenSection = () => (
    <>
      <div className={t.popSection}>
        <div className={t.popSectionLabel}>time of day · which hours of each day</div>
        <div className={t.popPillRow}>
          {PEAK_PRESETS.map((preset) => {
            const on = pick.start === preset.startTime && pick.end === preset.endTime;
            return (
              <button key={preset.label} type="button" className={on ? t.pillOn : t.pill} onClick={() => applyTodPreset(preset)}>
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className={t.popSection}>
        <div className={t.popSectionLabel}>days of week</div>
        <div className={t.popPillRow}>
          {DOW_DEFS.map(({ key, label }) => {
            const on = isDayOn(pick.weekdays, key);
            return (
              <button key={key} type="button" className={on ? t.dayOn : t.dayOff} onClick={() => setWeekday(key, !on)}>
                {label}
              </button>
            );
          })}
        </div>
        <div className={t.popPillRow}>
          <button type="button" className={t.pill} onClick={() => applyDowPreset(WEEKDAY_KEYS)}>Weekdays</button>
          <button type="button" className={t.pill} onClick={() => applyDowPreset(WEEKEND_KEYS)}>Weekends</button>
          <button type="button" className={t.pill} onClick={() => applyDowPreset(DOW_DEFS.map((d) => d.key))}>All</button>
        </div>
      </div>
    </>
  );

  const renderAggregateSection = () => (
    <div className={t.popSection}>
      <div className={t.popSectionLabel}>aggregate</div>
      <div className={t.popPillRow}>
        {RESOLUTION_OPTIONS.map((o) => (
          <button key={o.value} type="button" className={o.value === pick.resolution ? t.pillOn : t.pill} onClick={() => applyPick({ resolution: o.value })}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );

  const renderModeSection = () => (
    <div className={t.popSection}>
      <div className={t.popSectionLabel}>comparison mode</div>
      <div className={t.popPillRow}>
        {COMPARISON_MODE_OPTIONS.map((o) => (
          <button key={o.value} type="button" className={o.value === pick.comparisonMode ? t.pillOn : t.pill} onClick={() => applyPick({ comparisonMode: o.value })}>
            {o.label}
          </button>
        ))}
      </div>
      {modeIsDifference && <div className={t.popNote}>Drawn as main − other; the anchor is the first route in the list.</div>}
    </div>
  );

  const sectionRenderers = { routes: renderRoutesSection, measure: renderMeasureSection, when: renderWhenSection, aggregate: renderAggregateSection, mode: renderModeSection };

  const pillButton = (def, ref) => (
    <button
      ref={ref}
      type="button"
      className={def.strong ? t.pillStrong : t.pillDefault}
      title={def.title}
    >
      {def.label}
    </button>
  );

  return (
    <div className={t.wrapper} ref={wrapperRef}>
      {visiblePills.map((def) => (
        <Popup key={def.kind} button={pillButton(def)} preferredPosition="bottom">
          {() => <div className={t.popBody}>{sectionRenderers[def.kind]()}</div>}
        </Popup>
      ))}
      {overflowKinds.length > 0 && (
        <Popup
          button={
            <button type="button" className={t.morePill} title="The rest of this card's controls">
              <Icon icon="More" />
            </button>
          }
          preferredPosition="bottom"
        >
          {() => <div className={t.popBody}>{overflowKinds.map((kind) => <React.Fragment key={kind}>{sectionRenderers[kind]()}</React.Fragment>)}</div>}
        </Popup>
      )}

      {/* Off-screen shadow copy of every pill, always fully rendered regardless of the visible
          trim state above — this is what keeps widths accurate for a pill currently folded into
          "⋯" once the row grows wide enough to show it again. */}
      <div aria-hidden="true" style={{ position: 'absolute', visibility: 'hidden', top: -9999, left: -9999, display: 'flex', gap: GAP, pointerEvents: 'none' }}>
        {pillDefs.map((def, i) => (
          <React.Fragment key={def.kind}>{pillButton(def, (el) => { shadowRefs.current[i] = el; })}</React.Fragment>
        ))}
        <button ref={shadowMoreRef} type="button" className={t.morePill}><Icon icon="More" /></button>
      </div>
    </div>
  );
}
