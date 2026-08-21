import { useCallback, useEffect, useRef, useState } from 'react';
import {
  parseTmcArray,
  getDateValue,
  formatDateShort,
} from './utils';
import { ROUTE_COLOR_PALETTE } from './useReportRow';
import { resolveRelativeDateFormula, inferExactSpan } from './relativeDateResolution';
import {
  SPAN_OPTIONS,
  MONTH_OPTIONS,
  PATTERN_OPTIONS,
  DIRECTION_OPTIONS,
  DEFAULT_PRESET,
  buildFormula,
  parseFormula,
  isValidFormula,
} from './relativeDatePresets';

// One route's row: expand/collapse, name/date inline editing, remove. Every mutation
// ultimately calls back into the parent's `useReportRow`-backed handlers (this
// component owns no persistence logic itself), but the two editable facets differ in
// where their edit-buffer state lives:
// - Name: still a parent-owned single-flight buffer (`isEditingName`/`editNameValue`) —
//   only one row's name can be mid-rename at a time across the whole list.
// - Dates (2026-08-19, item 4A — removed the pencil/Save/Cancel gate): this row owns
//   its OWN local buffer + debounced auto-save (`dateMode`/`localStart`/`localEnd`/
//   `deriveFrom`/`deriveFormula` below), since dates are now always live whenever the
//   row is expanded — several rows can be mid-edit simultaneously.
// It also owns a purely-local disclosure toggle (dependents list) — not meaningful
// outside this one row's own render, so it never needed to live in the parent either.
//
// Design push #2 (2026-08-06): weekday mask / time-of-day / graph assignment moved
// off the route entirely (they're properties of the QUESTION a graph asks, not of
// the route — see QuickControls/index.jsx and useGraphPublish.js's per-graph
// transformReportRoutes). A route is now name · colour · TMCs · date span, full
// stop — this file used to also own the "Days"/"Time of day" facets and the
// per-graph assignment chips; both blocks (and the "N of M days" masked count,
// which required knowing a weekday mask this component no longer has) are gone,
// not just hidden.
export default function RouteRow({
  route,
  miles,
  graphCount,
  theme: t,
  Icon,
  ColorPicker,
  Popup,
  onChangeColor,
  isEdit,
  saving,
  isExpanded,
  onToggleExpand,
  isEditingName,
  editNameValue,
  onEditNameValueChange,
  onStartEditName,
  onSaveEditName,
  onCancelEditName,
  derivedFromRouteName,
  baseForNames,
  derivableSiblings,
  onUpdateDates,
  onCopyWindow,
  onPasteWindow,
  clipboard,
  canMoveUp,
  canMoveDown,
  onReorderUp,
  onReorderDown,
  onRemove,
}) {
  const [depsOpen, setDepsOpen] = useState(false);
  const r = route;

  // ColorPicker's own effect fires onChange whenever onChange's IDENTITY changes
  // (not just when the picked color changes) — see Colorpicker.jsx's
  // `useEffect(..., [selfColor, onChange])`. The parent recreates onChangeColor as a
  // fresh inline arrow function every render, so passing it straight through would
  // re-fire onChange on every render -> updateRoute -> re-render -> new onChangeColor
  // -> infinite loop (confirmed live: DevTools network tab showed a runaway request
  // storm). Route the callback through a ref so the function identity handed to
  // ColorPicker never changes, while always invoking the latest onChangeColor.
  const onChangeColorRef = useRef(onChangeColor);
  onChangeColorRef.current = onChangeColor;
  const stableOnChangeColor = useCallback((c) => onChangeColorRef.current?.(c), []);

  // ── Date editing (2026-08-19, item 4A) ──────────────────────────────────────────
  // No more pencil/Save/Cancel: the date fields are always live whenever the row is
  // expanded, auto-saving (debounced) through the one `onUpdateDates(updates)` callback
  // the parent wraps around `updateRoute`. This buffer now lives PER ROW (it used to be
  // a single-flight buffer owned by the parent, since only one row could be "in edit
  // mode" at a time) — several rows can be mid-edit simultaneously now.
  //
  // `lastFlushedRef` distinguishes an EXTERNAL change to this route (a sibling
  // recomputing this derived row's dates, a clipboard paste from ReportRouteList, another
  // session's edit landing) from an ECHO of this row's own just-sent write — only the
  // former should overwrite whatever's in the local buffer.
  const lastFlushedRef = useRef({ startDate: r.startDate, endDate: r.endDate, dateFormula: r.dateFormula, derivedFromRoute: r.derivedFromRoute });
  const [dateMode, setDateMode] = useState(r.dateFormula ? 'derived' : 'fixed');
  const [localStart, setLocalStart] = useState(r.startDate);
  const [localEnd, setLocalEnd] = useState(r.endDate);
  const [deriveFrom, setDeriveFrom] = useState(r.derivedFromRoute || '');
  const [deriveFormula, setDeriveFormula] = useState(r.dateFormula || '');

  useEffect(() => {
    const last = lastFlushedRef.current;
    if (r.startDate === last.startDate && r.endDate === last.endDate
      && r.dateFormula === last.dateFormula && r.derivedFromRoute === last.derivedFromRoute) return;
    lastFlushedRef.current = { startDate: r.startDate, endDate: r.endDate, dateFormula: r.dateFormula, derivedFromRoute: r.derivedFromRoute };
    setLocalStart(r.startDate);
    setLocalEnd(r.endDate);
    setDateMode(r.dateFormula ? 'derived' : 'fixed');
    setDeriveFrom(r.derivedFromRoute || '');
    if (r.dateFormula) setDeriveFormula(r.dateFormula);
  }, [r.startDate, r.endDate, r.dateFormula, r.derivedFromRoute]);

  const pendingRef = useRef({});
  const timerRef = useRef(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const flushDates = (extra) => {
    const merged = { ...pendingRef.current, ...extra };
    pendingRef.current = {};
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    lastFlushedRef.current = { ...lastFlushedRef.current, ...merged };
    onUpdateDates?.(merged);
  };
  // Debounced AND merged (not replaced) — two fields changed within the same window (e.g.
  // "From" then "To" in quick succession) land in ONE `updateRoute` call instead of two
  // racing writes each built off a stale `routes` snapshot, which would otherwise silently
  // drop the first field's change.
  const scheduleFlush = (patch) => {
    pendingRef.current = { ...pendingRef.current, ...patch };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => flushDates({}), 400);
  };
  const cancelPendingFlush = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    pendingRef.current = {};
  };

  const handleStartChange = (e) => {
    const v = e.target.value;
    setLocalStart(v);
    scheduleFlush({ startDate: v });
  };
  const handleEndChange = (e) => {
    const v = e.target.value;
    setLocalEnd(v);
    scheduleFlush({ endDate: v });
  };

  // Moves both dates by exactly one year, preserving the span's length — plain
  // string year substitution (not a Date object) so it never silently rolls Feb 29
  // into Mar 1 in a non-leap target year.
  const shiftYear = (delta) => {
    const shiftOne = (val) => {
      if (!val) return val;
      const [y, m, d] = val.split('-');
      return `${Number(y) + delta}-${m}-${d}`;
    };
    const ns = shiftOne(localStart);
    const ne = shiftOne(localEnd);
    setLocalStart(ns);
    setLocalEnd(ne);
    scheduleFlush({ startDate: ns, endDate: ne });
  };

  // Mechanism B (relativeDate/isRelativeDateBase, see relativeDateResolution.js) — a row's
  // startDate/endDate is LIVE-COMPUTED from another route's own date, not an independent literal,
  // whenever `dateMode === 'derived'`; the Fixed/Derived switch below lets an author create,
  // change, or remove that relationship, live.
  // Single-hop only (relativeDateResolution.js never resolves a chain) — `derivableSiblings`
  // (computed by the parent from the whole report's routes) already excludes any row that's
  // itself derived; this just also excludes the row itself.
  const eligibleBases = (derivableSiblings || []).filter((s) => s.route_comp_id !== r.route_comp_id);
  const derivePreset = parseFormula(deriveFormula);
  // Debounced (not immediate) — covers the free-typed "How many"/day-of-month/Advanced-formula
  // inputs, which fire per keystroke; a harmless extra ~400ms on the plain dropdowns too.
  const setDerivePresetField = (patch) => {
    const nextFormula = buildFormula({ ...derivePreset, ...patch });
    setDeriveFormula(nextFormula);
    if (deriveFrom && isValidFormula(nextFormula)) scheduleFlush({ dateFormula: nextFormula, derivedFromRoute: deriveFrom });
  };
  const handleAdvancedFormulaChange = (e) => {
    const v = e.target.value;
    setDeriveFormula(v);
    if (deriveFrom && isValidFormula(v)) scheduleFlush({ dateFormula: v, derivedFromRoute: deriveFrom });
  };
  const handleDeriveFromChange = (e) => {
    const v = e.target.value;
    setDeriveFrom(v);
    // report-authoring-ux-overhaul.md Tier 6C (2026-08-20), Ryan's own flagged idea: for "Same
    // period, aligned" (`snap`) specifically, default the Span picker to match the newly-picked
    // base route's own date range exactly, every time the base changes — recomputed unconditionally
    // (even over a span the author already set by hand; Ryan's call: simpler, no new "was this
    // touched" state needed) and left untouched when the base's range doesn't exactly match any
    // span option (e.g. 37 days) — no closest-match guessing.
    let nextFormula = deriveFormula;
    if (derivePreset.pattern === 'snap' && v) {
      const base = eligibleBases.find((s) => s.route_comp_id === v);
      const inferred = base && inferExactSpan(base.startDate, base.endDate);
      if (inferred && inferred !== derivePreset.span) {
        nextFormula = buildFormula({ ...derivePreset, span: inferred });
        setDeriveFormula(nextFormula);
      }
    }
    // A discrete pick, not continuous typing — commit right away rather than debouncing.
    if (v && isValidFormula(nextFormula)) flushDates({ dateFormula: nextFormula, derivedFromRoute: v });
  };
  // Both of these are deliberate, discrete mode switches — commit immediately, same
  // "happens right away" feel the old Save button gave them, rather than debouncing.
  const useFixedInstead = () => {
    cancelPendingFlush();
    setDateMode('fixed');
    flushDates({ startDate: localStart, endDate: localEnd, dateFormula: undefined, derivedFromRoute: undefined });
  };
  const startDeriveMode = () => {
    cancelPendingFlush();
    setDateMode('derived');
    const formula = deriveFormula || buildFormula(DEFAULT_PRESET);
    if (!deriveFormula) setDeriveFormula(formula);
    // Already has a complete, valid pick from before (e.g. flipped to Fixed and back) —
    // recommit right away instead of making the author re-pick to get back where they were.
    if (deriveFrom && isValidFormula(formula)) flushDates({ dateFormula: formula, derivedFromRoute: deriveFrom });
  };
  const derivePreviewBase = eligibleBases.find((s) => s.route_comp_id === deriveFrom);
  const derivePreview = derivePreviewBase
    ? resolveRelativeDateFormula(deriveFormula, derivePreviewBase.startDate, derivePreviewBase.endDate)
    : null;
  const tmcCount = parseTmcArray(r.tmc_array).length;

  // One-line meta ("9 TMC · 2.0 mi · 2025-01-06 → 2025-02-28 · 3 graphs") — the count/range the
  // engine will really enumerate, not four disabled inputs' worth of the same information.
  // `miles` is computed by the parent's useRouteMileage (a live TMC->miles lookup, not a stored
  // field) and arrives as undefined for the one render before that fetch resolves — omit the
  // segment rather than show a misleading "0.0 mi" while loading. `graphCount` is likewise
  // computed live by the parent from `useGraphPublish`'s self-bound-graph discovery (each
  // graph's own `_measurePick.routeIds`) — NOT from this route's stored `graphIds` field, which
  // is write-once at conversion time and goes stale the moment a graph's Routes pill reassigns
  // anything. "0 graphs" is a real, useful signal (a route sitting in the list feeding nothing),
  // so it's never omitted the way a still-loading `miles` is.
  const metaText = [
    `${tmcCount} TMC${tmcCount === 1 ? '' : 's'}`,
    miles != null ? `${miles.toFixed(1)} mi` : null,
    (formatDateShort(r.startDate) || formatDateShort(r.endDate))
      ? `${formatDateShort(r.startDate) || '?'} → ${formatDateShort(r.endDate) || '?'}`
      : 'No dates set',
    `${graphCount ?? 0} graph${(graphCount ?? 0) === 1 ? '' : 's'}`,
  ].filter(Boolean).join(' · ');

  const canMutateRow = isEdit;

  const rowClass = isEditingName ? t.rowRenaming : (isExpanded ? t.rowOpen : t.row);

  if (isEditingName) {
    return (
      <div className={rowClass} data-row={r.route_comp_id}>
        <div className={t.editContainer}>
          <span className={t.colorDot} style={{ backgroundColor: r.color }} />
          <input
            autoFocus
            value={editNameValue}
            onChange={(e) => onEditNameValueChange(e.target.value)}
            className={t.renameInput}
          />
          <button type="button" className={t.saveBtn} title="Save" onClick={onSaveEditName}>
            <Icon icon="FloppyDisk" />
          </button>
          <button type="button" className={t.cancelBtn} title="Cancel" onClick={onCancelEditName}>
            <Icon icon="CancelCircle" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={rowClass} data-row={r.route_comp_id}>
      <div className={t.rowHeaderWrapper}>
        {canMutateRow && (
          <span className={t.reorderButtons}>
            <button type="button" className={t.reorderBtn} disabled={!canMoveUp || saving} onClick={onReorderUp} title="Move up">
              <Icon icon="CaretUp" />
            </button>
            <button type="button" className={t.reorderBtn} disabled={!canMoveDown || saving} onClick={onReorderDown} title="Move down">
              <Icon icon="CaretDown" />
            </button>
          </span>
        )}
        <button type="button" className={isExpanded ? t.expanderOpen : t.expander} onClick={onToggleExpand} title={isExpanded ? 'Collapse' : 'Expand'}>
          {isExpanded ? '−' : '+'}
        </button>
        {canMutateRow && ColorPicker && Popup ? (
          <Popup
            button={<button type="button" className={t.colorDotButton} style={{ backgroundColor: r.color }} title={`Identity colour ${r.color} — click to change`} />}
            preferredPosition="bottom"
          >
            {() => (
              <div className={t.colorPopoverBody}>
                <div className={t.colorPopoverHead}>
                  <span className={t.colorPopoverLabel}>identity colour</span>
                  <span className={t.colorPopoverHex}>{r.color}</span>
                </div>
                <div className={t.colorSwatchGrid}>
                  {ROUTE_COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={c.toLowerCase() === (r.color || '').toLowerCase() ? t.colorSwatchActive : t.colorSwatch}
                      style={{ backgroundColor: c }}
                      title={c}
                      onClick={() => stableOnChangeColor(c)}
                    />
                  ))}
                </div>
                <div className={t.colorPopoverFooter}>Used by every graph this route feeds, so a reader learns the key once.</div>
              </div>
            )}
          </Popup>
        ) : (
          <span className={t.colorDot} style={{ backgroundColor: r.color }} title={r.color} />
        )}
        <div className={t.iconContainer}>
          <span className={t.routeTitle} title={r.name}>{r.name}</span>
          {canMutateRow && (
            <>
              <button type="button" className={t.iconBtn} title="Edit name" onClick={onStartEditName}>
                <Icon icon="PencilSquare" />
              </button>
              <button type="button" className={t.dangerBtn} title="Remove route from report" onClick={onRemove} disabled={saving}>
                <Icon icon="Trash" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className={`${t.metaIndent} ${t.meta}`}>{metaText}</div>

      {isExpanded && (
        <div className={t.expandedContainer}>
          {/* ── DATE SPAN: the one window facet a route still owns — weekday mask and
              time-of-day moved to the graph (see QuickControls). ── */}
          <div>
            <div className={t.windowHead}>
              <div className={t.facetLabel}>dates</div>
              {/* Copy/paste is a LITERAL span, which would silently conflict with a derived
                  row's live-computed value — Fixed-only, same as before. No pencil anymore
                  (2026-08-19, item 4A): the fields below are always live, and "Derive from
                  another route instead" / "Use fixed dates instead" ARE the mode switches. */}
              {canMutateRow && dateMode === 'fixed' && (
                <div className={t.windowActionsRow}>
                  <button type="button" className={t.iconBtn} title="Copy this date span" onClick={onCopyWindow}>
                    <Icon icon="Copy" />
                  </button>
                  <button
                    type="button"
                    className={t.iconBtn}
                    title={clipboard && clipboard.from !== r.route_comp_id ? `Paste the date span copied from ${clipboard.fromName}` : 'Copy a date span from another route first'}
                    disabled={!clipboard || clipboard.from === r.route_comp_id}
                    onClick={onPasteWindow}
                  >
                    <Icon icon="Paste" />
                  </button>
                </div>
              )}
              {dateMode === 'derived' && canMutateRow && <span className={t.facetLabel}>derived</span>}
            </div>

            {dateMode === 'derived' && (
              <div className={t.derivedNote}>Derived from {derivedFromRouteName || 'another route'} — recalculates automatically whenever that route's own dates change.</div>
            )}

            {!canMutateRow ? (
              <div className={t.windowReadWrapper}>
                <div className={t.windowReadRow}>
                  <span className={t.windowReadRowValue}>
                    {formatDateShort(r.startDate) ? `${formatDateShort(r.startDate)} → ${formatDateShort(r.endDate)}` : 'No dates set'}
                  </span>
                </div>
              </div>
            ) : dateMode === 'derived' ? (
              <div className={t.deriveControlsWrapper}>
                <div className={t.dateModeWrapper}>
                  <label className={t.dateModeLabel}>Derive From:</label>
                  <select className={t.dateFieldInput} value={deriveFrom || ''} onChange={handleDeriveFromChange}>
                    <option value="" disabled>Pick a route…</option>
                    {eligibleBases.map((s) => <option key={s.route_comp_id} value={s.route_comp_id}>{s.name}</option>)}
                  </select>
                </div>
                <div className={t.dateModeWrapper}>
                  <label className={t.dateModeLabel}>Pattern:</label>
                  <select className={t.dateFieldInput} value={derivePreset.pattern} onChange={(e) => setDerivePresetField({ pattern: e.target.value })}>
                    {PATTERN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                {(derivePreset.pattern === 'offset' || derivePreset.pattern === 'snap') && (
                  <div className={t.dateModeWrapper}>
                    <label className={t.dateModeLabel}>Span:</label>
                    <select className={t.dateFieldInput} value={derivePreset.span} onChange={(e) => setDerivePresetField({ span: e.target.value })}>
                      {SPAN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                )}
                {derivePreset.pattern === 'offset' && (
                  <div className={t.dateModeWrapper}>
                    <label className={t.dateModeLabel}>Direction:</label>
                    <select className={t.dateFieldInput} value={derivePreset.direction} onChange={(e) => setDerivePresetField({ direction: e.target.value })}>
                      {DIRECTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                )}
                {derivePreset.pattern === 'offset' && (
                  <div className={t.dateModeWrapper}>
                    <label className={t.dateModeLabel}>How many:</label>
                    <input type="number" min="0" className={t.dateFieldInput} value={derivePreset.amount} onChange={(e) => setDerivePresetField({ amount: e.target.value })} />
                  </div>
                )}
                {derivePreset.pattern === 'calendarMonth' && (
                  <div className={t.dateModeWrapper}>
                    <label className={t.dateModeLabel}>Month:</label>
                    <select className={t.dateFieldInput} value={derivePreset.calMonth} onChange={(e) => setDerivePresetField({ calMonth: e.target.value })}>
                      {MONTH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                )}
                {derivePreset.pattern === 'calendarRange' && (
                  <>
                    <div className={t.dateModeWrapper}>
                      <label className={t.dateModeLabel}>From:</label>
                      <select className={t.dateFieldInput} value={derivePreset.calMonth1} onChange={(e) => setDerivePresetField({ calMonth1: e.target.value })}>
                        {MONTH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <input type="number" min="1" max="31" className={t.dateFieldInput} value={derivePreset.calDay1} onChange={(e) => setDerivePresetField({ calDay1: e.target.value })} />
                    </div>
                    <div className={t.dateModeWrapper}>
                      <label className={t.dateModeLabel}>To:</label>
                      <select className={t.dateFieldInput} value={derivePreset.calMonth2} onChange={(e) => setDerivePresetField({ calMonth2: e.target.value })}>
                        {MONTH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <input className={t.dateFieldInput} placeholder="day or L" value={derivePreset.calDay2} onChange={(e) => setDerivePresetField({ calDay2: e.target.value })} />
                    </div>
                  </>
                )}
                {derivePreset.pattern === 'advanced' && (
                  <div className={t.dateModeWrapper}>
                    <label className={t.dateModeLabel}>Formula:</label>
                    <input className={t.dateFieldInput} value={deriveFormula || ''} onChange={handleAdvancedFormulaChange} />
                  </div>
                )}
                {!deriveFrom ? (
                  <div className={t.dowSummary}>Pick a route to derive from.</div>
                ) : !isValidFormula(deriveFormula) ? (
                  <div className={t.deriveFormulaError}>Not a recognized date formula.</div>
                ) : derivePreview ? (
                  <div className={t.dowSummary}>Resolves to {derivePreview.start} → {derivePreview.end} (based on {derivePreviewBase?.name}'s current dates)</div>
                ) : (
                  <div className={t.deriveFormulaError}>Can't resolve yet — {derivePreviewBase?.name} needs its own dates set first.</div>
                )}
                <button type="button" className={t.pill} onClick={useFixedInstead}>Use fixed dates instead</button>
              </div>
            ) : (
              <div className={t.facetBlockFirst}>
                <div className={t.dateFieldRow}>
                  <div className={t.dateFieldWrapper}>
                    <label className={t.dateFieldLabel}>From</label>
                    <input type="date" className={t.dateFieldInput} value={getDateValue(localStart)} onChange={handleStartChange} />
                  </div>
                  <span className={t.dateFieldArrow}>→</span>
                  <div className={t.dateFieldWrapper}>
                    <label className={t.dateFieldLabel}>To</label>
                    <input type="date" className={t.dateFieldInput} value={getDateValue(localEnd)} onChange={handleEndChange} />
                  </div>
                </div>
                <div className={t.shiftRow}>
                  <span className={t.shiftLabel}>shift</span>
                  <button type="button" className={t.pill} title="Same span, one year earlier" onClick={() => shiftYear(-1)}>− 1 year</button>
                  <button type="button" className={t.pill} title="Same span, one year later" onClick={() => shiftYear(1)}>+ 1 year</button>
                  <span className={t.shiftKeepsLength}>keeps the length</span>
                </div>
                {eligibleBases.length > 0 && (
                  <button type="button" className={`${t.pill} mt-1.5`} onClick={startDeriveMode}>Derive from another route instead</button>
                )}
              </div>
            )}
          </div>

          {/* "Base for N routes" — a standing fact, independent of window edit state. */}
          {canMutateRow && baseForNames?.length > 0 && (
            <div className={t.dependentsRow}>
              <button type="button" className={t.dependentsToggle} onClick={() => setDepsOpen((o) => !o)}>
                base for {baseForNames.length} route{baseForNames.length === 1 ? '' : 's'}
                <Icon icon={depsOpen ? 'ChevronUp' : 'ChevronDown'} className={t.sectionToggleChevron} />
              </button>
              {depsOpen && (
                <div className={t.dependentsPillList}>
                  {baseForNames.map((name) => <span key={name} className={t.miniPill}>{name}</span>)}
                </div>
              )}
            </div>
          )}

          {canMutateRow && (
            <div className={t.openOutRemoveRow}>
              <button type="button" className={t.openOutRemoveBtn} onClick={onRemove} disabled={saving}>
                <Icon icon="Trash" /><span className={t.openOutRemoveLabel}>Remove route from report</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
