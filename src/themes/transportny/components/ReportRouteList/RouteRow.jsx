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

// One route's row: a single combined toggle (2026-09-04, RRL feedback batch item 1) puts the row
// into edit mode — collapsed, it shows a bold, prominent date-range line + a muted TMC/mileage
// line (2026-09-05: swapped and reweighted per feedback — dates are the thing an author scans
// for, not TMC count); expanded/editing, that summary is REPLACED (not appended below) by name +
// date editing.
//
// Explicit Save/Discard (2026-09-05, reversing the 2026-09-04 auto-save-on-blur/debounce design,
// itself an extension of the 2026-08-19 item-4A "always live, no Save/Cancel" decision for
// dates): Ryan's call — a single ambiguous "X + Done" toggle wasn't enough, and autosave-on-blur
// wasn't what he wanted here. Every field (name, dates, derive-mode picks) now lives in a pure
// local buffer that persists nothing until Save is clicked; Discard reverts the buffer to the
// last-persisted values. Both actions live in the header row itself (Discard=X, Save=floppy
// disk, side by side) — a same-day follow-up (also 2026-09-05) consolidated them there and
// removed a separate bottom action row once it turned out redundant with the header's own X.
// This still directly resolves report-route-ui-parity-gaps.md gap #7 (the old rename control's
// input-commit bug) — that bug lived in a parent-owned, single-flight buffer swapped by list
// index; this row's buffer is fully local and only ever read at an explicit Save click, never
// raced by a debounce timer or an index reshuffle.
//
// Design push #2 (2026-08-06): weekday mask / time-of-day / graph assignment moved off the route
// entirely (they're properties of the QUESTION a graph asks, not of the route — see
// QuickControls/index.jsx and useGraphPublish.js's per-graph transformReportRoutes). A route is
// now name · colour · TMCs · date span, full stop.
//
// Per-route graph-count display was tried (2026-08-07) and removed again (2026-09-04, Ryan's
// explicit call) — dropped entirely, not relocated. The underlying discovery
// (`useGraphPublish`'s self-bound-graph count) still exists in `ReportRouteList.jsx`, just
// feeding the `reports_snap_2` write-path (Item 5) instead of a per-row display.
export default function RouteRow({
  route,
  miles,
  theme: t,
  Icon,
  ColorPicker,
  Popup,
  onChangeColor,
  isEdit,
  saving,
  isExpanded,
  onToggleExpand,
  siblingNames,
  derivedFromRouteName,
  baseForNames,
  derivableSiblings,
  onUpdateRoute,
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
  // ColorPicker never changes, while always invoking the latest onChangeColor. Color is a
  // standalone, always-on quick action (works even when this row isn't in edit mode at all) —
  // deliberately NOT part of the Save/Discard buffer below.
  const onChangeColorRef = useRef(onChangeColor);
  onChangeColorRef.current = onChangeColor;
  const stableOnChangeColor = useCallback((c) => onChangeColorRef.current?.(c), []);

  // ── Edit buffer: name + dates, Save/Discard-gated (2026-09-05) ──────────────────────
  // Initialized from the persisted route once at mount; re-initialized on the RISING EDGE of
  // `isExpanded` (collapsed -> editing), not on every render or on every upstream prop change —
  // while the row is collapsed, its collapsed-line summary reads `r` directly (see below), so a
  // stale buffer while collapsed is harmless; while actively editing, an external change to the
  // same route (a sibling's derive recompute, another session) deliberately does NOT clobber
  // whatever's in the buffer — only re-entering edit mode (or a Discard) refreshes it.
  const [localName, setLocalName] = useState(r.name);
  const [dateMode, setDateMode] = useState(r.dateFormula ? 'derived' : 'fixed');
  const [localStart, setLocalStart] = useState(r.startDate);
  const [localEnd, setLocalEnd] = useState(r.endDate);
  const [deriveFrom, setDeriveFrom] = useState(r.derivedFromRoute || '');
  const [deriveFormula, setDeriveFormula] = useState(r.dateFormula || '');

  const resetBufferFromRoute = () => {
    setLocalName(r.name);
    setLocalStart(r.startDate);
    setLocalEnd(r.endDate);
    setDateMode(r.dateFormula ? 'derived' : 'fixed');
    setDeriveFrom(r.derivedFromRoute || '');
    setDeriveFormula(r.dateFormula || '');
  };

  const wasExpandedRef = useRef(isExpanded);
  useEffect(() => {
    if (isExpanded && !wasExpandedRef.current) resetBufferFromRoute();
    wasExpandedRef.current = isExpanded;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded]);

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
    if (e.key === 'Escape') { e.preventDefault(); handleDiscard(); }
  };

  const handleStartChange = (e) => setLocalStart(e.target.value);
  const handleEndChange = (e) => setLocalEnd(e.target.value);

  // Moves both dates by exactly one year, preserving the span's length — plain
  // string year substitution (not a Date object) so it never silently rolls Feb 29
  // into Mar 1 in a non-leap target year. Buffer-only, like every other field here.
  const shiftYear = (delta) => {
    const shiftOne = (val) => {
      if (!val) return val;
      const [y, m, d] = val.split('-');
      return `${Number(y) + delta}-${m}-${d}`;
    };
    setLocalStart((s) => shiftOne(s));
    setLocalEnd((en) => shiftOne(en));
  };

  // Mechanism B (relativeDate/isRelativeDateBase, see relativeDateResolution.js) — a row's
  // startDate/endDate is LIVE-COMPUTED from another route's own date, not an independent literal,
  // whenever `dateMode === 'derived'`; the Fixed/Derived switch below lets an author create,
  // change, or remove that relationship — buffered until Save, same as every other field.
  // Single-hop only (relativeDateResolution.js never resolves a chain) — `derivableSiblings`
  // (computed by the parent from the whole report's routes) already excludes any row that's
  // itself derived; this just also excludes the row itself.
  const eligibleBases = (derivableSiblings || []).filter((s) => s.route_comp_id !== r.route_comp_id);
  const derivePreset = parseFormula(deriveFormula);
  const setDerivePresetField = (patch) => setDeriveFormula(buildFormula({ ...derivePreset, ...patch }));
  const handleAdvancedFormulaChange = (e) => setDeriveFormula(e.target.value);
  const handleDeriveFromChange = (e) => {
    const v = e.target.value;
    setDeriveFrom(v);
    // report-authoring-ux-overhaul.md Tier 6C (2026-08-20), Ryan's own flagged idea: for "Same
    // period, aligned" (`snap`) specifically, default the Span picker to match the newly-picked
    // base route's own date range exactly, every time the base changes — recomputed unconditionally
    // (even over a span the author already set by hand; Ryan's call: simpler, no new "was this
    // touched" state needed) and left untouched when the base's range doesn't exactly match any
    // span option (e.g. 37 days) — no closest-match guessing.
    if (derivePreset.pattern === 'snap' && v) {
      const base = eligibleBases.find((s) => s.route_comp_id === v);
      const inferred = base && inferExactSpan(base.startDate, base.endDate);
      if (inferred && inferred !== derivePreset.span) {
        setDeriveFormula(buildFormula({ ...derivePreset, span: inferred }));
      }
    }
  };
  const useFixedInstead = () => setDateMode('fixed');
  const startDeriveMode = () => {
    setDateMode('derived');
    if (!deriveFormula) setDeriveFormula(buildFormula(DEFAULT_PRESET));
  };
  const derivePreviewBase = eligibleBases.find((s) => s.route_comp_id === deriveFrom);
  const derivePreview = derivePreviewBase
    ? resolveRelativeDateFormula(deriveFormula, derivePreviewBase.startDate, derivePreviewBase.endDate)
    : null;

  // Per-row Copy/Paste (2026-09-05): reads/writes the BUFFER, not the persisted route — copying
  // mid-edit shares what's currently on screen, not a stale persisted value, and pasting lands in
  // the buffer for the author to Save or Discard like everything else here. The separate
  // "paste into all" clipboard-strip bulk action (ReportRouteList.jsx) is UNCHANGED — it applies
  // to routes regardless of edit-mode state and still persists immediately; it's a distinct bulk
  // tool, not part of this per-row edit session.
  const handleCopyWindow = () => onCopyWindow?.(localStart, localEnd);
  const handlePasteWindow = () => {
    const pasted = onPasteWindow?.();
    if (!pasted) return;
    setLocalStart(pasted.startDate);
    setLocalEnd(pasted.endDate);
  };

  // ── Validation, computed live (not stateful) so Save's enabled-state and any inline message
  // are always in sync with the current buffer — no stale-error risk. ──
  const trimmedName = localName.trim();
  const nameError = !trimmedName
    ? 'Route needs a name.'
    : (trimmedName !== r.name && (siblingNames || []).includes(trimmedName))
      ? `A route named "${trimmedName}" already exists.`
      : '';
  // Mirrors the exact three-way condition the derive UI below already displays inline — "ready"
  // only in the branch that shows a real resolved preview, not just "a base is picked."
  const dateReady = dateMode === 'fixed' || (!!deriveFrom && isValidFormula(deriveFormula) && !!derivePreview);
  const canSave = !nameError && dateReady;

  const handleSave = () => {
    if (!canSave) return;
    const dateUpdates = dateMode === 'derived'
      ? { dateFormula: deriveFormula, derivedFromRoute: deriveFrom }
      : { startDate: localStart, endDate: localEnd, dateFormula: undefined, derivedFromRoute: undefined };
    const updates = { ...dateUpdates };
    if (trimmedName !== r.name) {
      // A deliberate rename — even to something generic — is a real editorial decision from
      // here on; clears isPlaceholderName so a future Dynamic Report resolution never
      // overwrites it with the resolved route's own name again.
      updates.name = trimmedName;
      updates.isPlaceholderName = false;
    }
    onUpdateRoute?.(updates);
    onToggleExpand?.();
  };
  const handleDiscard = () => {
    resetBufferFromRoute();
    onToggleExpand?.();
  };

  const tmcCount = parseTmcArray(r.tmc_array).length;

  // Collapsed-row summary (2026-09-04 restructure, reweighted 2026-09-05 per feedback): the
  // date-range line is now the bold/prominent one — it's the thing an author scans for — with
  // the TMC/mileage line muted underneath. `miles` is computed by the parent's useRouteMileage
  // (a live TMC->miles lookup, not a stored field) and arrives as undefined for the one render
  // before that fetch resolves — omit the segment rather than show a misleading "0.0 mi" while
  // loading. Graph-count (previously a third segment here) was removed entirely 2026-09-04 —
  // the discovery it was reading still exists, feeding the reports_snap_2 write-path in
  // ReportRouteList.jsx instead of a per-row display.
  const dateMeta = (formatDateShort(r.startDate) || formatDateShort(r.endDate))
    ? `${formatDateShort(r.startDate) || '?'} → ${formatDateShort(r.endDate) || '?'}`
    : 'No dates set';
  const tmcMileageMeta = `${tmcCount} TMC${tmcCount === 1 ? '' : 's'}${miles != null ? ` · ${miles.toFixed(1)} mi` : ''}`;

  const canMutateRow = isEdit;

  const rowClass = isExpanded ? t.rowOpen : t.row;

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
        {/* Entering edit mode: one Pencil toggle, same as before. While editing (2026-09-05,
            consolidated per feedback — the bottom Save/Discard row was redundant with a header
            control): the header itself carries BOTH actions side by side — Discard (X) and Save
            — instead of a single ambiguous toggle plus a separate bottom action row. A read-only
            viewer keeps the plain expand/collapse affordance (no edit concept to merge with). */}
        {canMutateRow && isExpanded ? (
          <>
            <button type="button" className={t.expanderOpen} onClick={handleDiscard} title="Discard changes">
              <Icon icon="XMark" />
            </button>
            <button type="button" className={t.saveIconBtn} onClick={handleSave} disabled={!canSave} title="Save changes">
              <Icon icon="FloppyDisk" />
            </button>
          </>
        ) : (
          <button
            type="button"
            className={isExpanded ? t.expanderOpen : t.expander}
            onClick={onToggleExpand}
            title={canMutateRow ? 'Edit route' : (isExpanded ? 'Collapse' : 'Expand')}
          >
            {canMutateRow ? <Icon icon="PencilSquare" /> : (isExpanded ? '−' : '+')}
          </button>
        )}
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
          {canMutateRow && isExpanded ? (
            <input
              autoFocus
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onKeyDown={handleNameKeyDown}
              className={t.titleInput}
            />
          ) : (
            <span className={t.routeTitle} title={r.name}>{r.name}</span>
          )}
          {canMutateRow && (
            <button type="button" className={t.dangerBtn} title="Remove route from report" onClick={onRemove} disabled={saving}>
              <Icon icon="Trash" />
            </button>
          )}
        </div>
      </div>

      {canMutateRow && isExpanded && nameError && trimmedName && (
        <div className={`${t.metaIndent} ${t.deriveFormulaError}`}>{nameError}</div>
      )}

      {!isExpanded ? (
        <div className={t.metaIndent}>
          <div className={t.metaProminent}>{dateMeta}</div>
          <div className={t.meta}>{tmcMileageMeta}</div>
        </div>
      ) : (
        <div className={t.expandedContainer}>
          {/* ── DATE SPAN: the one window facet a route still owns — weekday mask and
              time-of-day moved to the graph (see QuickControls). ── */}
          <div>
            <div className={t.windowHead}>
              <div className={t.facetLabel}>dates</div>
              {/* Copy/paste is a LITERAL span, which would silently conflict with a derived
                  row's live-computed value — Fixed-only, same as before. "Use relative dates
                  instead" / "Use fixed dates instead" ARE the mode switches. */}
              {canMutateRow && dateMode === 'fixed' && (
                <div className={t.windowActionsRow}>
                  <button type="button" className={t.iconBtn} title="Copy this date span" onClick={handleCopyWindow}>
                    <Icon icon="Copy" />
                  </button>
                  <button
                    type="button"
                    className={t.iconBtn}
                    title={clipboard && clipboard.from !== r.route_comp_id ? `Paste the date span copied from ${clipboard.fromName}` : 'Copy a date span from another route first'}
                    disabled={!clipboard || clipboard.from === r.route_comp_id}
                    onClick={handlePasteWindow}
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
                  <button type="button" className={`${t.pill} mt-1.5`} onClick={startDeriveMode}>Use relative dates instead</button>
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
        </div>
      )}
    </div>
  );
}
