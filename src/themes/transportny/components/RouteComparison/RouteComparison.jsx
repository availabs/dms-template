import { useContext, useEffect, useRef, useState } from 'react';
import { isEqual } from 'lodash-es';
import { ComponentContext, PageContext } from '../../../../dms/packages/dms/src/patterns/page/context';
import { ThemeContext, getComponentTheme } from '../../../../dms/packages/dms/src/ui/useTheme';
import { buildUdaConfig } from '../../../../dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/buildUdaConfig';
import { routeComparisonTheme } from './RouteComparison.theme';
import { collectRouteTmcs, DOW_LABELS, WEEKDAYS, ALL_DAYS, summarizeDow } from './parseTmcArray';

// ── module-local constants (non-exported keeps this a component-only module →
//    Fast-Refresh-clean; see dms packages/dms CLAUDE.md) ──────────────────────

// Stable empty ref so `pageState?.filters || EMPTY` doesn't mint a new array each
// render (which would re-trigger the isEqual-guarded publish effects forever).
const EMPTY = [];

// How many catalog rows a name-search request returns. The Routes Data catalog is
// ~30k+ rows, so the picker NEVER fetches the whole table — it does a server-side
// `data->>'name' LIKE %term%` query (min 2 chars) capped to this many rows.
const SEARCH_LIMIT = 50;

// dow uses JS getDay() order (0=Sun…6=Sat) — see parseTmcArray.js.
const DEFAULT_SCOPE = { todStart: '06:00', todEnd: '20:00', dow: [...WEEKDAYS], vehicleClass: 'all' };

const VEHICLE_CLASSES = [
  { key: 'all', label: 'All vehicles' },
  { key: 'passenger', label: 'Passenger' },
  { key: 'freight', label: 'Freight' },
];

const DOW_HINT = { Weekdays: 'Mon–Fri', 'All days': 'Sun–Sat', Weekends: 'Sat/Sun', 'No days': '—', Custom: '' };

// Metrics UI defs (TODO 3.5 — not yet published; the shell is interactive locally).
const METRIC_DEFS = [
  { key: 'speed', label: 'Speed', unit: 'mph' },
  { key: 'travel_time', label: 'Travel time', unit: 'min' },
  { key: 'delay', label: 'Hours of delay', unit: 'k vh' },
  { key: 'pti', label: 'Planning-time index', unit: 'ratio', disabled: true },
];
const DEFAULT_METRICS = {
  metrics: ['speed', 'travel_time', 'delay'],
  pct: { speed: true, travel_time: true, delay: true },
  overrides: { aadt: 'auto', threshold: '45 mph', speed: 'posted' },
};

// Build the apiLoad config for a UDA read against the route-catalog sourceInfo —
// same shape ReportRouteList uses (format + a single `uda` child carrying the
// buildUdaConfig options), with a fromIndex/toIndex window to cap rows. `groups`
// is the filter-group list; `limit` caps returned rows.
const buildCatalogRequest = (sourceInfo, groups, limit) => {
  const udaConfig = buildUdaConfig({
    externalSource: sourceInfo,
    columns: (sourceInfo.columns || []).map((c) => ({ ...c, show: true })),
    filters: { op: 'AND', groups },
  });
  return {
    format: { ...sourceInfo },
    children: [
      {
        action: 'uda',
        path: '/',
        filter: {
          fromIndex: 0,
          toIndex: Math.max(0, limit - 1),
          options: JSON.stringify(udaConfig.options),
        },
        params: {},
      },
    ],
  };
};

// ── the panel — the whole builder rail. Rendered by both the Edit and View
//    registry comps below; interactivity is gated on PageContext.editPageMode
//    (NOT props.isEdit — that's dataWrapper's own settings-editor flag), exactly
//    like ReportRouteList. ────────────────────────────────────────────────────
function RouteComparisonPanel() {
  const {
    apiLoad,
    pageState,
    updatePageStateFilters,
    setActionParam,
  } = useContext(PageContext) || {};
  const { state: { join } = {} } = useContext(ComponentContext) || {};
  // NOTE on edit vs view: the platform supplies `updatePageStateFilters` in BOTH
  // /edit and /view (edit/index.jsx + view.jsx) and its edit-mode form is a soft,
  // change-guarded React-Router nav within the same /edit route — so a filter
  // control publishing there is safe and, crucially, drives the sibling Spreadsheet
  // live while authoring/previewing a draft (a draft can't be reached in true view
  // mode until it's published). We therefore publish regardless of `editPageMode`;
  // the `ready` + isEqual + hydratedRef guards below prevent any write→read loop.
  const { UI, theme: themeFromContext = {} } = useContext(ThemeContext) || {};
  // Only the Icon primitive is needed from the shared UI (className is one of its
  // first-class props — used for sizing, not a passthrough we're adding). Every
  // form control is a raw element styled through this component's own theme block
  // (RouteComparison.theme.js) — the UI Input/Button primitives carry fixed chrome
  // (h-11 etc.) that can't be shrunk to the compact rail sizing without a className
  // passthrough, which the theme rules forbid.
  const { Icon } = UI || {};
  const t = { ...routeComparisonTheme, ...getComponentTheme(themeFromContext, 'routeComparison') };

  // The route CATALOG binding — read-only, sourced from the section's first (only)
  // join source. Bound via the sectionMenu "Add Join Source" slot and left
  // deliberately INCOMPLETE (source + view picked, no join columns), so
  // buildUdaConfig's isJoinComplete() never promotes it to a real SQL join — while
  // still populating full sourceInfo. Read the first join source rather than
  // hardcoding an alias (ReportRouteList idiom); the page build wires Routes Data
  // 2107426/2107427 into it (default alias `route_catalog`, see index.jsx).
  const routeSourceInfo = Object.values(join?.sources || {})[0]?.sourceInfo;
  const catalogReady = Boolean(apiLoad && routeSourceInfo && Array.isArray(routeSourceInfo.columns) && routeSourceInfo.columns.length);

  const filters = pageState?.filters || EMPTY;

  // selectedRoutes: full catalog row objects ({ route_id, name, tmc_array, … }) —
  // keeping the whole row (not just the id) is what lets us derive each route's
  // tmc_array for the `route_tmcs` publish without a second fetch.
  const [selectedRoutes, setSelectedRoutes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [scope, setScope] = useState({ ...DEFAULT_SCOPE });
  const [scopeOpen, setScopeOpen] = useState(null); // 'tod' | 'days' | 'veh' | null

  // TODO (Task 3.5) — Metrics are interactive locally but not yet published as
  // `rc_metrics`; wire the setActionParam publish here once the Spreadsheet leaves
  // are finalized in Task 4.
  const [metrics, setMetrics] = useState({ ...DEFAULT_METRICS });

  // `ready` gates the routes publish so we never clobber a shared URL's `routes`
  // list with an empty publish before the hydrate-from-URL pass below has run.
  const [ready, setReady] = useState(false);
  const hydratedRef = useRef(false);

  const selectedTmcs = collectRouteTmcs(selectedRoutes);
  const isSelected = (routeId) => selectedRoutes.some((r) => String(r.route_id) === String(routeId));

  // ── hydrate selection from the URL (once) ──────────────────────────────────
  // A shared/bookmarked URL carries `routes`; restore the chips by fetching those
  // rows so their names + TMC counts render. Runs at most once, after the catalog
  // source is available. Sets `ready` when done (or immediately if nothing to
  // restore) so the publish effect can safely take over.
  useEffect(() => {
    if (hydratedRef.current) return;
    if (!catalogReady) return; // wait until the catalog source is resolvable
    const initial = filters.find((f) => f.searchKey === 'routes')?.values;
    hydratedRef.current = true;
    if (!Array.isArray(initial) || !initial.length) {
      setReady(true);
      return;
    }
    (async () => {
      try {
        const config = buildCatalogRequest(
          routeSourceInfo,
          // Plain column name (not a raw `data->>` ref): buildUdaConfig maps it to the
          // isDms accessor via getColumn/attributeAccessorStr. Passing the raw ref
          // bypasses getColumn (col not found → node returned unmapped), which for a
          // `like` op also skips the %term% wrapping — the search-match bug.
          [{ col: 'route_id', op: 'filter', value: initial }],
          initial.length,
        );
        const data = await apiLoad(config, '/');
        const rows = (data || []).map((d) => d?.data?.value).filter(Boolean);
        const byId = new Map(rows.map((r) => [String(r.route_id), r]));
        const ordered = initial.map((id) => byId.get(String(id))).filter(Boolean); // preserve URL order
        if (ordered.length) setSelectedRoutes(ordered);
      } catch (e) {
        console.error('<RouteComparison:hydrate>', e);
      } finally {
        setReady(true);
      }
    })();
  }, [catalogReady, filters, routeSourceInfo, apiLoad]);

  // ── name-search the catalog (debounced, server-side, capped) ───────────────
  useEffect(() => {
    if (!catalogReady) return;
    const term = searchTerm.trim();
    if (term.length < 2) {
      setCatalog([]);
      return;
    }
    const handle = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const config = buildCatalogRequest(
          routeSourceInfo,
          // Plain column name so buildUdaConfig maps to the isDms accessor AND wraps
          // the value as %term% for the LIKE (a raw `data->>'name'` ref bypasses both).
          [{ col: 'name', op: 'like', value: term }],
          SEARCH_LIMIT,
        );
        const data = await apiLoad(config, '/');
        const rows = (data || []).map((d) => d?.data?.value).filter(Boolean);
        // De-dupe by route_id — the catalog read can surface the same route more
        // than once (duplicate rows in the source and/or repeated dataByIndex
        // slots), which otherwise renders duplicate result items with colliding
        // React keys. First occurrence wins.
        const seen = new Set();
        const deduped = rows.filter((r) => {
          const k = String(r?.route_id ?? '');
          if (!k || seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        setCatalog(deduped);
      } catch (e) {
        console.error('<RouteComparison:search>', e);
        setError('Could not load routes.');
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [searchTerm, catalogReady, routeSourceInfo, apiLoad]);

  // ── publish routes + route_tmcs (the sibling Spreadsheet consumes both) ─────
  // BOTH keys are URL-synced page variables so a shared URL reproduces the view;
  // `route_tmcs` is what prunes the ~9.8B-row ClickHouse scan, so it MUST ride
  // alongside `routes`. Gated on `ready` (never clobber the URL before hydration).
  // isEqual guards the write→read→write loop (updatePageStateFilters navigates →
  // pageState reloads → this re-runs → equal → stops).
  useEffect(() => {
    if (!ready || !updatePageStateFilters) return;
    const routeIds = selectedRoutes.map((r) => String(r.route_id)).filter(Boolean);
    const tmcs = collectRouteTmcs(selectedRoutes);
    const currentRoutes = filters.find((f) => f.searchKey === 'routes')?.values;
    const currentTmcs = filters.find((f) => f.searchKey === 'route_tmcs')?.values;
    // Treat an unset filter (undefined) and an empty list as equal so an empty
    // selection on a fresh page doesn't fire a spurious empty-param navigation.
    if (isEqual(currentRoutes || [], routeIds) && isEqual(currentTmcs || [], tmcs)) return;
    updatePageStateFilters([
      { searchKey: 'routes', values: routeIds },
      { searchKey: 'route_tmcs', values: tmcs },
    ]);
  }, [selectedRoutes, ready, filters, updatePageStateFilters]);

  // ── publish rc_scope (transient action param — not URL) ────────────────────
  // setActionParam wraps a non-array value as [value], so the stored scope object
  // is at .values[0]; read it back the same way for the isEqual guard, or the
  // array-vs-object compare never matches and this loops.
  useEffect(() => {
    if (!setActionParam) return;
    const current = filters.find((f) => f.searchKey === 'rc_scope' && f.type === 'action')?.values?.[0];
    if (isEqual(current, scope)) return;
    setActionParam('rc_scope', scope);
  }, [scope, filters, setActionParam]);

  // ── selection handlers ─────────────────────────────────────────────────────
  const addRoute = (row) => {
    if (!row || isSelected(row.route_id)) return;
    setSelectedRoutes((prev) => [...prev, row]);
  };
  const removeRoute = (routeId) => {
    setSelectedRoutes((prev) => prev.filter((r) => String(r.route_id) !== String(routeId)));
  };
  const clearRoutes = () => setSelectedRoutes([]);
  const resetAll = () => {
    setSelectedRoutes([]);
    setScope({ ...DEFAULT_SCOPE });
    setMetrics({ ...DEFAULT_METRICS });
    setSearchTerm('');
    setScopeOpen(null);
    setCatalog([]);
  };

  // ── scope handlers ─────────────────────────────────────────────────────────
  const toggleScope = (key) => setScopeOpen((prev) => (prev === key ? null : key));
  const setTod = (field, value) => setScope((prev) => ({ ...prev, [field]: value }));
  const toggleDow = (day) =>
    setScope((prev) => {
      const has = prev.dow.includes(day);
      const next = has ? prev.dow.filter((d) => d !== day) : [...prev.dow, day];
      return { ...prev, dow: next.sort((a, b) => a - b) };
    });
  const setVehicleClass = (vc) => setScope((prev) => ({ ...prev, vehicleClass: vc }));

  // ── metrics handlers (TODO 3.5 — local only) ───────────────────────────────
  const toggleMetric = (key) =>
    setMetrics((prev) => {
      const has = prev.metrics.includes(key);
      return { ...prev, metrics: has ? prev.metrics.filter((m) => m !== key) : [...prev.metrics, key] };
    });
  const toggleMetricPct = (key) =>
    setMetrics((prev) => ({ ...prev, pct: { ...prev.pct, [key]: !prev.pct[key] } }));
  const setOverride = (field, value) =>
    setMetrics((prev) => ({ ...prev, overrides: { ...prev.overrides, [field]: value } }));

  const dowSummary = summarizeDow(scope.dow);
  const vehLabel = (VEHICLE_CLASSES.find((v) => v.key === scope.vehicleClass) || {}).label || 'All vehicles';
  const searchResults = catalog.filter((r) => !isSelected(r.route_id));

  return (
    <div className={t.wrapper}>
      <div className={t.card}>

        {/* header — Reset action only. The "Build comparison" title was removed: the
            rail's own step labels (Scope · Routes · Periods · Metrics) already identify
            the panel, and a title band here is redundant. */}
        <div className={t.cardHeader}>
          <button type="button" className={t.resetBtn} onClick={resetAll}>Reset</button>
        </div>

        {/* ── SCOPE · global filters (apply to every cell) ── */}
        <div className={t.block}>
          <div className={t.blockHead}>
            <Icon icon="Activity" className={t.blockIcon} />
            <span className={t.blockTitle}>Scope</span>
            <span className={t.blockHint}>every cell</span>
          </div>
          <div className={t.scopeGrid}>

            {/* Time of day */}
            <button type="button" className={scopeOpen === 'tod' ? t.scopeBtnActive : t.scopeBtn} onClick={() => toggleScope('tod')}>
              <span className={t.scopeBtnIconWrap}><Icon icon="History" className={t.scopeBtnIcon} /></span>
              <span className={t.scopeBtnBody}>
                <span className={t.scopeBtnLabel}>Time of day</span>
                <span className={t.scopeBtnValue}>{scope.todStart}–{scope.todEnd}</span>
              </span>
              <Icon icon="CaretDown" className={t.scopeCaret} />
            </button>
            {scopeOpen === 'tod' && (
              <div className={t.scopeEditor}>
                <div className={t.scopeEditorRow}>
                  <span className={t.scopeEditorLabel}>Start</span>
                  <div className={t.scopeTimeInputs}>
                    <input type="time" className={t.scopeTimeInput} value={scope.todStart} onChange={(e) => setTod('todStart', e.target.value)} />
                  </div>
                </div>
                <div className={t.scopeEditorRow}>
                  <span className={t.scopeEditorLabel}>End</span>
                  <div className={t.scopeTimeInputs}>
                    <input type="time" className={t.scopeTimeInput} value={scope.todEnd} onChange={(e) => setTod('todEnd', e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {/* Days of week */}
            <button type="button" className={scopeOpen === 'days' ? t.scopeBtnActive : t.scopeBtn} onClick={() => toggleScope('days')}>
              <span className={t.scopeBtnIconWrap}><Icon icon="Grid" className={t.scopeBtnIcon} /></span>
              <span className={t.scopeBtnBody}>
                <span className={t.scopeBtnLabel}>Days</span>
                <span className={t.scopeBtnValue}>{dowSummary} <span className={t.scopeBtnValueHint}>{DOW_HINT[dowSummary] || ''}</span></span>
              </span>
              <Icon icon="CaretDown" className={t.scopeCaret} />
            </button>
            {scopeOpen === 'days' && (
              <div className={t.scopeEditor}>
                <div className={t.dowRow}>
                  {ALL_DAYS.map((day) => (
                    <span
                      key={day}
                      className={scope.dow.includes(day) ? t.dowChipActive : t.dowChip}
                      onClick={() => toggleDow(day)}
                      title={DOW_LABELS[day]}
                    >
                      {DOW_LABELS[day]}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Vehicle class */}
            <button type="button" className={scopeOpen === 'veh' ? t.scopeBtnActive : t.scopeBtn} onClick={() => toggleScope('veh')}>
              <span className={t.scopeBtnIconWrap}><Icon icon="Road" className={t.scopeBtnIcon} /></span>
              <span className={t.scopeBtnBody}>
                <span className={t.scopeBtnLabel}>Vehicle class</span>
                <span className={t.scopeBtnValue}>{vehLabel}</span>
              </span>
              <Icon icon="CaretDown" className={t.scopeCaret} />
            </button>
            {scopeOpen === 'veh' && (
              <div className={t.scopeEditor}>
                <div className={t.vehRow}>
                  {VEHICLE_CLASSES.map((vc) => (
                    <span
                      key={vc.key}
                      className={scope.vehicleClass === vc.key ? t.vehChipActive : t.vehChip}
                      onClick={() => setVehicleClass(vc.key)}
                    >
                      {vc.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className={t.scopeNote}>Applies to every route and period. A period can override the time window individually.</div>
        </div>

        {/* ── STEP 1 · Routes (the rows) ── */}
        <div className={t.block}>
          <div className={t.blockHead}>
            <span className={t.stepBadge}>1</span>
            <span className={t.blockTitle}>Routes</span>
            <span className={t.blockHint}>the rows</span>
          </div>
          <div className={t.searchWrap}>
            <Icon icon="Search" className={t.searchIcon} />
            <input
              type="text"
              className={t.searchInput}
              placeholder="Search routes or folders…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className={t.routesMeta}>
            <span>{selectedRoutes.length} routes · {selectedTmcs.length} TMCs</span>
            {selectedRoutes.length > 0 && (
              <button type="button" className={t.clearAll} onClick={clearRoutes}>Clear all</button>
            )}
          </div>

          {/* selected route chips */}
          {selectedRoutes.length > 0 && (
            <div className={t.chipsList}>
              {selectedRoutes.map((r) => {
                const tmcCount = collectRouteTmcs([r]).length;
                return (
                  <div key={r.route_id} className={t.chip}>
                    <span className={t.chipDot} />
                    <div className={t.chipBody}>
                      <div className={t.chipName}>{r.name || r.route_id}</div>
                      <div className={t.chipMeta}>{tmcCount} TMCs</div>
                    </div>
                    <button type="button" className={t.chipRemove} title="Remove route" onClick={() => removeRoute(r.route_id)}>
                      <Icon icon="XMark" className={t.chipRemoveIcon} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* search results */}
          {!catalogReady ? (
            <div className={t.empty}>Bind a route catalog to enable the picker.</div>
          ) : loading ? (
            <div className={t.loading}>Searching…</div>
          ) : searchTerm.trim().length >= 2 ? (
            searchResults.length > 0 ? (
              <div className={t.results}>
                {searchResults.map((r) => (
                  <button key={r.route_id} type="button" className={t.resultItem} onClick={() => addRoute(r)}>
                    <div className={t.resultBody}>
                      <div className={t.resultName}>{r.name || r.route_id}</div>
                      <div className={t.resultMeta}>{collectRouteTmcs([r]).length} TMCs</div>
                    </div>
                    <Icon icon="Plus" className={t.resultAddIcon} />
                  </button>
                ))}
              </div>
            ) : (
              <div className={t.empty}>No matching routes.</div>
            )
          ) : null}

          {error ? <div className={t.error}>{error}</div> : null}
        </div>

        {/* ── STEP 2 · Periods (the column groups) — TODO (Task 3.4) ── */}
        {/* Shell only: the period builder (Fixed / Each-route's-own / Relative-to-Base
            modes, BASE badge, resolvePeriods util) and its `rc_periods` publish land
            in Task 3.4. */}
        <div className={t.block}>
          <div className={t.blockHead}>
            <span className={t.stepBadge}>2</span>
            <span className={t.blockTitle}>Periods</span>
            <span className={t.blockHint}>the columns</span>
          </div>
          <div className={t.periodsEmpty}>No periods yet.</div>
          <button type="button" className={t.addBtn}>
            <Icon icon="Plus" className={t.addBtnIcon} />Add period
          </button>
          <div className={t.periodsNote}>
            Date modes: <span className={t.periodsNoteStrong}>Fixed</span> · <span className={t.periodsNoteStrong}>Each route&apos;s own dates</span> · <span className={t.periodsNoteStrong}>Relative to Base</span>.
          </div>
        </div>

        {/* ── STEP 3 · Metrics (the leaves) — TODO (Task 3.5) ── */}
        {/* Shell is interactive locally; `rc_metrics` publish is deferred to Task 3.5. */}
        <div className={t.blockLast}>
          <div className={t.blockHead}>
            <span className={t.stepBadge}>3</span>
            <span className={t.blockTitle}>Metrics</span>
            <span className={t.blockHint}>per cell</span>
          </div>
          <div className={t.metricsGrid}>
            {METRIC_DEFS.map((m) => {
              const on = metrics.metrics.includes(m.key);
              const pctOn = Boolean(metrics.pct[m.key]);
              return (
                <div key={m.key}>
                  <div
                    className={m.disabled ? t.metricRowDisabled : t.metricRow}
                    onClick={() => !m.disabled && toggleMetric(m.key)}
                  >
                    <span className={on && !m.disabled ? t.metricCheck : t.metricCheckOff}>
                      {on && !m.disabled ? <Icon icon="Check" className={t.metricCheckIcon} /> : null}
                    </span>
                    <span className={m.disabled ? t.metricLabelDisabled : t.metricLabel}>
                      {m.label} <span className={t.metricUnit}>{m.unit}</span>
                    </span>
                    {on && !m.disabled && (
                      <span
                        className={t.metricDelta}
                        onClick={(e) => { e.stopPropagation(); toggleMetricPct(m.key); }}
                        title="Toggle Δ vs Base"
                      >
                        <span className={pctOn ? t.metricDeltaTrack : t.metricDeltaTrackOff}>
                          <span className={pctOn ? t.metricDeltaKnob : t.metricDeltaKnobOff} />
                        </span>
                        Δ vs Base
                      </span>
                    )}
                  </div>
                  {/* delay overrides revealed under an active delay metric */}
                  {m.key === 'delay' && on && (
                    <div className={t.metricOverrides}>
                      <label className={t.metricOverrideField}>
                        <span className={t.metricOverrideLabel}>AADT</span>
                        <input className={t.metricOverrideInput} value={metrics.overrides.aadt} onChange={(e) => setOverride('aadt', e.target.value)} />
                      </label>
                      <label className={t.metricOverrideField}>
                        <span className={t.metricOverrideLabel}>Threshold</span>
                        <input className={t.metricOverrideInput} value={metrics.overrides.threshold} onChange={(e) => setOverride('threshold', e.target.value)} />
                      </label>
                      <label className={t.metricOverrideField}>
                        <span className={t.metricOverrideLabel}>Speed lim</span>
                        <input className={t.metricOverrideInput} value={metrics.overrides.speed} onChange={(e) => setOverride('speed', e.target.value)} />
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* rail footer note (shareable) */}
      <div className={t.footNote}>
        <div className={t.footKicker}>{"// shareable"}</div>
        <p className={t.footText}>
          This whole comparison — routes, periods, metrics — lives in the page URL. Copy <span className={t.footMono}>Share link</span> to send it, or <span className={t.footMono}>Save report</span> to keep it in a folder.
        </p>
      </div>
    </div>
  );
}

// Registry EditComp / ViewComp. Behaviour is identical — the panel gates itself on
// PageContext.editPageMode internally — but they're distinct named component
// exports so React DevTools / error stacks stay readable and the file remains
// Fast-Refresh-clean (component-only exports).
export function RouteComparisonEdit() {
  return <RouteComparisonPanel />;
}

export function RouteComparisonView() {
  return <RouteComparisonPanel />;
}
