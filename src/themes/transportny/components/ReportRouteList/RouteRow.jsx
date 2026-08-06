import { useCallback, useRef, useState } from 'react';
import {
  parseTmcArray,
  generateDateRange,
  getDateValue,
  formatDateShort,
  DOW_DEFS,
  WEEKDAY_KEYS,
  WEEKEND_KEYS,
  isDayOn,
  summarizeWeekdays,
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

const getTimeValue = (val) => (val || '').split('T')[1] || '';
const onDateChange = (e, currentValue, setter) => {
  const time = currentValue?.split('T')[1] || '';
  setter(time ? `${e.target.value}T${time}` : e.target.value);
};
const onTimeChange = (e, currentValue, setter) => {
  const date = currentValue?.split('T')[0] || '';
  setter(e.target.value ? `${date}T${e.target.value}` : date);
};

// Time-of-day presets an author can apply in one click instead of typing "HH:mm"
// into both time inputs from memory. Mirrors the non-wrapping windows in
// REPORTING_BINS (data-types/map21/constants.js, the FHWA time-of-day periods used
// by the map21 HPMS plugin) as plain HH:mm bounds — duplicated rather than imported,
// since that file is a server-side CommonJS module for an unrelated plugin, not a
// client dependency of this theme. OVN (20:00-06:00) and FREEFLOW (22:00-05:00) are
// deliberately omitted: both wrap past midnight, which the epoch-range mechanism
// these times feed (useGraphPublish.js's generateEpochRange, a plain start<=end
// loop) can't express — it would silently produce an empty epoch filter.
const PEAK_PRESETS = [
  { label: 'AM Peak', startTime: '06:00', endTime: '10:00' },
  { label: 'PM Peak', startTime: '16:00', endTime: '20:00' },
  { label: 'PM Peak (alt)', startTime: '15:00', endTime: '19:00' },
  { label: 'Midday', startTime: '10:00', endTime: '16:00' },
  { label: 'All Day', startTime: '', endTime: '' },
];

// One route's row: expand/collapse, name/date inline editing, per-graph assignment
// chips, remove. Purely presentational — every mutation is a callback prop into the
// parent's `useReportRow`/`useGraphPublish`-backed handlers; this component owns no
// persistence logic and no "which row is being edited" state (that stays in the
// parent, since only one row can be in name/date edit mode at a time across the
// whole list). It DOES own a handful of purely-local disclosure toggles (dependents
// list, overflow menu) — none of that is meaningful outside this one row's own
// render, so it never needed to live in the parent.
export default function RouteRow({
  route,
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
  editWeekdaysValue,
  onEditWeekdaysValueChange,
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
  graphs,
  onToggleGraph,
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

  // Presets only touch the time-of-day portion, keeping whatever date is already
  // picked — same combined "YYYY-MM-DDTHH:mm" shape the raw time <input>s write via
  // onTimeChange above. Requires both dates set first (buttons disabled otherwise)
  // rather than writing a dateless "THH:mm" string.
  const canApplyPreset = !!getDateValue(editStartDateValue) && !!getDateValue(editEndDateValue);
  const applyPeakPreset = (preset) => {
    const startDate = getDateValue(editStartDateValue);
    const endDate = getDateValue(editEndDateValue);
    onEditStartDateValueChange(preset.startTime ? `${startDate}T${preset.startTime}` : startDate);
    onEditEndDateValueChange(preset.endTime ? `${endDate}T${preset.endTime}` : endDate);
  };

  const toggleDow = (key) => onEditWeekdaysValueChange({ ...editWeekdaysValue, [key]: !isDayOn(editWeekdaysValue, key) });
  const applyDowPreset = (onKeys) => {
    const next = {};
    DOW_DEFS.forEach(({ key }) => { next[key] = onKeys.includes(key); });
    onEditWeekdaysValueChange(next);
  };

  // "N of M days" — the count the engine will actually enumerate (weekday mask
  // applied) out of the calendar span, using the exact same day-loop as
  // useGraphPublish.js's real query-building path (generateDateRange), not a
  // separate diff calculation that could drift from it.
  const enumeratedDayCount = (() => {
    const start = getDateValue(editStartDateValue);
    const end = getDateValue(editEndDateValue);
    if (!start || !end) return null;
    const total = generateDateRange(start, end, null).length;
    const masked = generateDateRange(start, end, editWeekdaysValue).length;
    return { masked, total };
  })();

  // Moves both dates by exactly one year, preserving the span's length and any
  // time-of-day already set — plain string year substitution (not a Date object)
  // so it never silently rolls Feb 29 into Mar 1 in a non-leap target year.
  const shiftYear = (delta) => {
    const shiftOne = (val) => {
      if (!val) return val;
      const [datePart, timePart] = val.split('T');
      const [y, m, d] = datePart.split('-');
      const shifted = `${Number(y) + delta}-${m}-${d}`;
      return timePart ? `${shifted}T${timePart}` : shifted;
    };
    onEditStartDateValueChange(shiftOne(editStartDateValue));
    onEditEndDateValueChange(shiftOne(editEndDateValue));
  };

  // "AM Peak" alone doesn't say what hours it means — print them on the pill
  // itself rather than leaving it to a hover title.
  const formatHour = (hhmm) => {
    if (!hhmm) return null;
    const [h] = hhmm.split(':').map(Number);
    return h;
  };
  const presetHoursLabel = (preset) => (preset.startTime && preset.endTime)
    ? `${formatHour(preset.startTime)}–${formatHour(preset.endTime)}`
    : null;

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
  const isUnassigned = graphs.length > 0 && !(r.graphIds || []).length;

  // One-line meta ("9 TMC · 2025-01-06 → 2025-02-28") — the count/range the engine
  // will really enumerate, not four disabled inputs' worth of the same information.
  const metaText = [
    `${tmcCount} TMC${tmcCount === 1 ? '' : 's'}`,
    (formatDateShort(r.startDate) || formatDateShort(r.endDate))
      ? `${formatDateShort(r.startDate) || '?'} → ${formatDateShort(r.endDate) || '?'}`
      : 'No dates set',
  ].join(' · ');

  const assignedGraphs = graphs.filter((g) => (r.graphIds || []).includes(g.sectionId));
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
          {isUnassigned && <span className={t.unassignedBadge}>unused</span>}
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

      {!isExpanded && (
        <div className={`${t.metaIndent} ${t.chipsWrapper}`}>
          {graphs.length === 0 ? null : isUnassigned ? (
            <span className={t.notOnAnyGraph}>Not on any graph yet.</span>
          ) : (
            <>
              <span className={t.chipsLabel}>on</span>
              {assignedGraphs.map((g) => (
                <span key={g.sectionId} className={t.chipOffRead}>{g.label.toLowerCase()}</span>
              ))}
            </>
          )}
        </div>
      )}

      {isExpanded && (
        <div className={t.expandedContainer}>
          {/* ── WINDOW: three facets in the engine's own order — dates (which days) →
              days (which of those count) → time of day (which hours of each). ── */}
          <div>
            <div className={t.windowHead}>
              <div className={t.facetLabel}>window</div>
              {canMutateRow && !isDerivedDate && (
                <div className={t.windowActionsRow}>
                  {isEditingDates ? (
                    <>
                      <button
                        type="button"
                        className={t.saveBtn}
                        title="Save window"
                        disabled={editDateMode === 'derived' && (!editDeriveFromValue || !isValidFormula(editDeriveFormulaValue))}
                        onClick={onSaveEditDates}
                      >
                        <Icon icon="FloppyDisk" />
                      </button>
                      <button type="button" className={t.cancelBtn} title="Cancel" onClick={onCancelEditDates}>
                        <Icon icon="CancelCircle" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className={t.iconBtn} title="Copy this window" onClick={onCopyWindow}>
                        <Icon icon="Copy" />
                      </button>
                      <button
                        type="button"
                        className={t.iconBtn}
                        title={clipboard && clipboard.from !== r.route_comp_id ? `Paste the window copied from ${clipboard.fromName}` : 'Copy a window from another route first'}
                        disabled={!clipboard || clipboard.from === r.route_comp_id}
                        onClick={onPasteWindow}
                      >
                        <Icon icon="Paste" />
                      </button>
                      <button type="button" className={t.iconBtn} title="Edit window" onClick={onStartEditDates}>
                        <Icon icon="PencilSquare" />
                      </button>
                    </>
                  )}
                </div>
              )}
              {isDerivedDate && canMutateRow && <span className={t.facetLabel}>derived</span>}
            </div>

            {isDerivedDate && !isEditingDates && (
              <div className={t.derivedNote}>Derived from {derivedFromRouteName || 'another route'} — edit that route's window instead.</div>
            )}

            {!isEditingDates ? (
              (() => {
                const rows = [
                  ['dates', formatDateShort(r.startDate) ? `${formatDateShort(r.startDate)} → ${formatDateShort(r.endDate)}` : 'No dates set',
                    enumeratedDayCountFor(r) ? `${enumeratedDayCountFor(r).masked} of ${enumeratedDayCountFor(r).total} days` : null],
                  ['days', summarizeWeekdays(r.weekdays) || 'All days', null],
                  ['time', timeOfDayLabel(r), getTimeValue(r.startDate) && getTimeValue(r.endDate) ? 'each day' : 'no filter'],
                ];
                const opener = canMutateRow && !isDerivedDate;
                return (
                  <div
                    className={opener ? t.windowReadWrapperOpener : t.windowReadWrapper}
                    onClick={opener ? onStartEditDates : undefined}
                    title={opener ? 'Edit this window' : undefined}
                  >
                    {rows.map(([label, value, sub]) => (
                      <div key={label} className={t.windowReadRow}>
                        <span className={t.windowReadRowLabel}>{label}</span>
                        <span className={t.windowReadRowValue}>{value}{sub ? <span className={t.windowReadRowSub}> · {sub}</span> : null}</span>
                      </div>
                    ))}
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
              <>
                {/* 1 · DATES */}
                <div className={t.facetBlockFirst}>
                  <div className={t.facetHeadRow}>
                    <span className={t.facetLabel}>dates</span>
                    <span className={t.facetHeadHint}>which days</span>
                    {enumeratedDayCount && <span className={t.facetHeadCount}>{enumeratedDayCount.masked} of {enumeratedDayCount.total} days</span>}
                  </div>
                  <div className={t.dateFieldRow}>
                    <div className={t.dateFieldWrapper}>
                      <label className={t.dateFieldLabel}>From</label>
                      <input type="date" className={t.dateFieldInput} value={getDateValue(editStartDateValue)} onChange={(e) => onDateChange(e, editStartDateValue, onEditStartDateValueChange)} />
                    </div>
                    <span className={t.dateFieldArrow}>→</span>
                    <div className={t.dateFieldWrapper}>
                      <label className={t.dateFieldLabel}>To</label>
                      <input type="date" className={t.dateFieldInput} value={getDateValue(editEndDateValue)} onChange={(e) => onDateChange(e, editEndDateValue, onEditEndDateValueChange)} />
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

                {/* 2 · DAYS */}
                <div className={t.facetBlock}>
                  <div className={t.facetHeadRow}>
                    <span className={t.facetLabel}>days</span>
                    <span className={t.facetHeadHint}>which of those count</span>
                  </div>
                  <div className={t.dowRow}>
                    {DOW_DEFS.map(({ key, label }) => {
                      const on = isDayOn(editWeekdaysValue, key);
                      return (
                        <button key={key} type="button" className={on ? t.dayOn : t.dayOff} title={on ? `${key} included — click to exclude` : `${key} excluded — click to include`} onClick={() => toggleDow(key)}>
                          {label}
                        </button>
                      );
                    })}
                    <span className={t.daySpacer} />
                    <button type="button" className={t.pill} onClick={() => applyDowPreset(WEEKDAY_KEYS)}>Weekdays</button>
                    <button type="button" className={t.pill} onClick={() => applyDowPreset(WEEKEND_KEYS)}>Weekends</button>
                    <button type="button" className={t.pill} onClick={() => applyDowPreset(DOW_DEFS.map((d) => d.key))}>All</button>
                  </div>
                </div>

                {/* 3 · TIME OF DAY */}
                <div className={t.facetBlockTimeOfDay}>
                  <div className={t.facetHeadRow}>
                    <span className={t.facetLabel}>time of day</span>
                    <span className={t.facetHeadHint}>which hours of each day</span>
                  </div>
                  <div className={t.dateFieldRow}>
                    <div className={t.dateFieldWrapper}>
                      <label className={t.dateFieldLabel}>From</label>
                      <input type="time" className={t.dateFieldInput} value={getTimeValue(editStartDateValue)} onChange={(e) => onTimeChange(e, editStartDateValue, onEditStartDateValueChange)} />
                    </div>
                    <span className={t.dateFieldArrow}>→</span>
                    <div className={t.dateFieldWrapper}>
                      <label className={t.dateFieldLabel}>To</label>
                      <input type="time" className={t.dateFieldInput} value={getTimeValue(editEndDateValue)} onChange={(e) => onTimeChange(e, editEndDateValue, onEditEndDateValueChange)} />
                    </div>
                  </div>
                  <div className={t.peakRow}>
                    {PEAK_PRESETS.map((preset) => {
                      const on = canApplyPreset && getTimeValue(editStartDateValue) === preset.startTime && getTimeValue(editEndDateValue) === preset.endTime;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          className={on ? t.pillOn : t.pill}
                          disabled={!canApplyPreset}
                          title={canApplyPreset ? undefined : 'Set a start and end date first'}
                          onClick={() => applyPeakPreset(preset)}
                        >
                          {preset.label}
                          {presetHoursLabel(preset) ? <span className={t.peakHours}> {presetHoursLabel(preset)}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                  <div className={t.timeAveragedNote}>
                    {getTimeValue(editStartDateValue) && getTimeValue(editEndDateValue)
                      ? 'Applied to every day in the range and averaged together — not one continuous stretch from the first day to the last.'
                      : 'No time filter: every hour of every day in the range is included.'}
                  </div>
                </div>
              </>
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

          {graphs.length > 0 && (
            <div className={t.openOutChipsRow}>
              <span className={t.chipsLabel}>on</span>
              {graphs.map((g) => {
                const on = (r.graphIds || []).includes(g.sectionId);
                const cls = on ? t.chipOn : (canMutateRow ? t.chipOff : t.chipOffRead);
                return (
                  <button
                    key={g.sectionId}
                    type="button"
                    className={cls}
                    disabled={!canMutateRow}
                    title={canMutateRow ? (on ? `Remove from ${g.label}` : `Add to ${g.label}`) : (on ? `On ${g.label}` : `${g.label} — not assigned`)}
                    onClick={() => canMutateRow && !saving && onToggleGraph(g.sectionId)}
                  >
                    {g.label.toLowerCase()}
                  </button>
                );
              })}
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

// Day-count preview for the READ-ONLY summary — same day-loop as the editing facet's
// own enumeratedDayCount above, just against the route's persisted (not draft) dates.
function enumeratedDayCountFor(r) {
  const start = getDateValue(r.startDate);
  const end = getDateValue(r.endDate);
  if (!start || !end) return null;
  return { masked: generateDateRange(start, end, r.weekdays).length, total: generateDateRange(start, end, null).length };
}

function timeOfDayLabel(r) {
  const st = getTimeValue(r.startDate);
  const et = getTimeValue(r.endDate);
  if (!st || !et) return 'All hours';
  return `${st}–${et}`;
}
