import { useCallback, useRef, useState } from 'react';
import {
  parseTmcArray,
  getDateValue,
  formatDateShort,
} from './utils';
import { ROUTE_COLOR_PALETTE } from './useReportRow';
import { resolveRelativeDateFormula } from './relativeDateResolution';
import {
  SPAN_OPTIONS,
  PATTERN_OPTIONS,
  DIRECTION_OPTIONS,
  DEFAULT_PRESET,
  buildFormula,
  parseFormula,
  isValidFormula,
} from './relativeDatePresets';

// One route's row: expand/collapse, name/date inline editing, remove. Purely
// presentational — every mutation is a callback prop into the parent's
// `useReportRow`-backed handlers; this component owns no persistence logic and no
// "which row is being edited" state (that stays in the parent, since only one row
// can be in name/date edit mode at a time across the whole list). It DOES own a
// handful of purely-local disclosure toggles (dependents list) — none of that is
// meaningful outside this one row's own render, so it never needed to live in
// the parent.
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
  isEditingDates,
  editStartDateValue,
  editEndDateValue,
  onEditStartDateValueChange,
  onEditEndDateValueChange,
  editDateMode,
  onEditDateModeChange,
  editDeriveFromValue,
  onEditDeriveFromValueChange,
  editDeriveFormulaValue,
  onEditDeriveFormulaValueChange,
  onStartEditDates,
  onSaveEditDates,
  onCancelEditDates,
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

  // Moves both dates by exactly one year, preserving the span's length — plain
  // string year substitution (not a Date object) so it never silently rolls Feb 29
  // into Mar 1 in a non-leap target year.
  const shiftYear = (delta) => {
    const shiftOne = (val) => {
      if (!val) return val;
      const [y, m, d] = val.split('-');
      return `${Number(y) + delta}-${m}-${d}`;
    };
    onEditStartDateValueChange(shiftOne(editStartDateValue));
    onEditEndDateValueChange(shiftOne(editEndDateValue));
  };

  const r = route;
  // Mechanism B (relativeDate/isRelativeDateBase, see relativeDateResolution.js) — a row's
  // startDate/endDate is LIVE-COMPUTED from another route's own date, not an independent literal.
  // At rest (not editing) the date section renders read-only with a note instead of the usual
  // pencil, since a literal edit here would just get silently overwritten on the next render;
  // while editing, the Fixed/Derived mode switch below lets an author actually create, change, or
  // remove the relationship.
  const isDerivedDate = !!r.dateFormula;
  // Single-hop only (relativeDateResolution.js never resolves a chain) — `derivableSiblings`
  // (computed by the parent from the whole report's routes) already excludes any row that's
  // itself derived; this just also excludes the row itself.
  const eligibleBases = (derivableSiblings || []).filter((s) => s.route_comp_id !== r.route_comp_id);
  const derivePreset = parseFormula(editDeriveFormulaValue);
  const setDerivePresetField = (patch) => onEditDeriveFormulaValueChange(buildFormula({ ...derivePreset, ...patch }));
  const startDeriveMode = () => {
    onEditDateModeChange('derived');
    if (!editDeriveFormulaValue) onEditDeriveFormulaValueChange(buildFormula(DEFAULT_PRESET));
  };
  const derivePreviewBase = eligibleBases.find((s) => s.route_comp_id === editDeriveFromValue);
  const derivePreview = derivePreviewBase
    ? resolveRelativeDateFormula(editDeriveFormulaValue, derivePreviewBase.startDate, derivePreviewBase.endDate)
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
              {canMutateRow && (
                <div className={t.windowActionsRow}>
                  {isEditingDates ? (
                    <>
                      <button
                        type="button"
                        className={t.saveBtn}
                        title="Save dates"
                        disabled={editDateMode === 'derived' && (!editDeriveFromValue || !isValidFormula(editDeriveFormulaValue))}
                        onClick={onSaveEditDates}
                      >
                        <Icon icon="FloppyDisk" />
                      </button>
                      <button type="button" className={t.cancelBtn} title="Cancel" onClick={onCancelEditDates}>
                        <Icon icon="CancelCircle" />
                      </button>
                    </>
                  ) : isDerivedDate ? (
                    // A derived row's own copy/paste (a LITERAL span) would silently conflict with
                    // its live-computed value — only the pencil is offered, which opens straight
                    // into Derived mode (seeded below) so an author can change the formula/base or
                    // switch back to Fixed. Copy/paste stays Fixed-only, same as before.
                    <button type="button" className={t.iconBtn} title="Edit derived-date relationship" onClick={onStartEditDates}>
                      <Icon icon="PencilSquare" />
                    </button>
                  ) : (
                    <>
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
                      <button type="button" className={t.iconBtn} title="Edit dates" onClick={onStartEditDates}>
                        <Icon icon="PencilSquare" />
                      </button>
                    </>
                  )}
                </div>
              )}
              {isDerivedDate && canMutateRow && <span className={t.facetLabel}>derived</span>}
            </div>

            {isDerivedDate && !isEditingDates && (
              <div className={t.derivedNote}>Derived from {derivedFromRouteName || 'another route'} — click the pencil to change the formula, switch to fixed dates, or edit the base route's own dates instead.</div>
            )}

            {!isEditingDates ? (
              (() => {
                // A derived row's read-only value is no longer a dead-end (the pencil above now
                // opens it), but the CLICK-ANYWHERE-TO-OPEN convenience stays Fixed-only — clicking
                // the value text on a derived row would be an easy miss-click straight into
                // Derived mode with no visual cue it was about to happen, unlike the pencil.
                const opener = canMutateRow && !isDerivedDate;
                const value = formatDateShort(r.startDate)
                  ? `${formatDateShort(r.startDate)} → ${formatDateShort(r.endDate)}`
                  : 'No dates set';
                return (
                  <div
                    className={opener ? t.windowReadWrapperOpener : t.windowReadWrapper}
                    onClick={opener ? onStartEditDates : undefined}
                    title={opener ? 'Edit these dates' : undefined}
                  >
                    <div className={t.windowReadRow}>
                      <span className={t.windowReadRowValue}>{value}</span>
                    </div>
                  </div>
                );
              })()
            ) : editDateMode === 'derived' ? (
              <div className={t.deriveControlsWrapper}>
                <div className={t.dateModeWrapper}>
                  <label className={t.dateModeLabel}>Derive From:</label>
                  <select className={t.dateFieldInput} value={editDeriveFromValue || ''} onChange={(e) => onEditDeriveFromValueChange(e.target.value)}>
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
                {derivePreset.pattern !== 'advanced' && (
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
                {derivePreset.pattern === 'advanced' && (
                  <div className={t.dateModeWrapper}>
                    <label className={t.dateModeLabel}>Formula:</label>
                    <input className={t.dateFieldInput} value={editDeriveFormulaValue || ''} onChange={(e) => onEditDeriveFormulaValueChange(e.target.value)} />
                  </div>
                )}
                {!editDeriveFromValue ? (
                  <div className={t.dowSummary}>Pick a route to derive from.</div>
                ) : !isValidFormula(editDeriveFormulaValue) ? (
                  <div className={t.deriveFormulaError}>Not a recognized date formula.</div>
                ) : derivePreview ? (
                  <div className={t.dowSummary}>Resolves to {derivePreview.start} → {derivePreview.end} (based on {derivePreviewBase?.name}'s current dates)</div>
                ) : (
                  <div className={t.deriveFormulaError}>Can't resolve yet — {derivePreviewBase?.name} needs its own dates set first.</div>
                )}
                <button type="button" className={t.pill} onClick={() => onEditDateModeChange('fixed')}>Use fixed dates instead</button>
              </div>
            ) : (
              <div className={t.facetBlockFirst}>
                <div className={t.dateFieldRow}>
                  <div className={t.dateFieldWrapper}>
                    <label className={t.dateFieldLabel}>From</label>
                    <input type="date" className={t.dateFieldInput} value={getDateValue(editStartDateValue)} onChange={(e) => onEditStartDateValueChange(e.target.value)} />
                  </div>
                  <span className={t.dateFieldArrow}>→</span>
                  <div className={t.dateFieldWrapper}>
                    <label className={t.dateFieldLabel}>To</label>
                    <input type="date" className={t.dateFieldInput} value={getDateValue(editEndDateValue)} onChange={(e) => onEditEndDateValueChange(e.target.value)} />
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
