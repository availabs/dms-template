import { useCallback, useRef, useState } from 'react';
import { parseTmcArray } from './utils';
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

const TMC_PREVIEW_COUNT = 6;

const getDateValue = (val) => (val || '').split('T')[0];
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

// Same day-key ordering/semantics as useGraphPublish.js's DAY_NAMES: only an
// explicit `false` excludes a day, an absent key means included.
const DOW_DEFS = [
  { key: 'sunday', label: 'Su' },
  { key: 'monday', label: 'Mo' },
  { key: 'tuesday', label: 'Tu' },
  { key: 'wednesday', label: 'We' },
  { key: 'thursday', label: 'Th' },
  { key: 'friday', label: 'Fr' },
  { key: 'saturday', label: 'Sa' },
];
const WEEKDAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
const WEEKEND_KEYS = ['sunday', 'saturday'];
const isDayOn = (weekdays, key) => weekdays?.[key] !== false;

// Renders as null (no summary line) when the mask has no exclusions, so an
// unrestricted route's date range block looks exactly as it did before this
// control existed.
function summarizeWeekdays(weekdays) {
  const offLabels = DOW_DEFS.filter(({ key }) => weekdays?.[key] === false).map((d) => d.label);
  if (offLabels.length === 0) return null;
  const onKeys = DOW_DEFS.filter(({ key }) => isDayOn(weekdays, key)).map((d) => d.key);
  if (onKeys.length === WEEKDAY_KEYS.length && WEEKDAY_KEYS.every((k) => onKeys.includes(k))) return 'Weekdays only';
  if (onKeys.length === WEEKEND_KEYS.length && WEEKEND_KEYS.every((k) => onKeys.includes(k))) return 'Weekends only';
  return `Excludes ${offLabels.join(', ')}`;
}

// One route's row: expand/collapse, name/date inline editing, TMC list, per-graph
// assignment chips, remove. Purely presentational — every mutation is a callback
// prop into the parent's `useReportRow`/`useGraphPublish`-backed handlers; this
// component owns no persistence logic and no "which row is being edited" state
// (that stays in the parent, since only one row can be in name/date edit mode at a
// time across the whole list).
export default function RouteRow({
  route,
  theme: t,
  Button,
  Input,
  Select,
  Switch,
  Icon,
  ColorPicker,
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
  graphs,
  onToggleGraph,
  canMoveUp,
  canMoveDown,
  onReorderUp,
  onReorderDown,
  onRemove,
}) {
  const [showAllTmcs, setShowAllTmcs] = useState(false);

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
  // picked — same combined "YYYY-MM-DDTHH:mm" shape the raw time <Input>s write via
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
  const tmcArray = parseTmcArray(r.tmc_array);
  const isUnassigned = graphs.length > 0 && !(r.graphIds || []).length;
  const visibleTmcs = showAllTmcs ? tmcArray : tmcArray.slice(0, TMC_PREVIEW_COUNT);
  const hiddenTmcCount = tmcArray.length - visibleTmcs.length;

  return (
    <div className={t.row}>
      <div className={t.rowContainer}>
        <div className={t.rowHeader}>
          <div className={t.iconContainer}>
            <Button disabled={isEditingName} themeOptions={{ size: "xs" }} onClick={onToggleExpand}>
              {isExpanded ? '-' : '+'}
            </Button>
            {isEditingName ? (
              <div className={t.editContainer}>
                <div className={t.editInputWrapper}>
                  <Input value={editNameValue} onChange={(e) => onEditNameValueChange(e.target.value)} />
                </div>
                <Button themeOptions={{ size: "xs" }} title="save" onClick={onSaveEditName}>
                  <Icon icon={"FloppyDisk"} />
                </Button>
                <Button themeOptions={{ size: "xs", color: "danger" }} title="cancel" onClick={onCancelEditName}>
                  <Icon icon={"CancelCircle"} />
                </Button>
              </div>
            ) : (
              <div className={t.editContainer}>
                {r.color && <span className={t.colorDot} style={{ backgroundColor: r.color }} title={r.color} />}
                <div className={t.routeTitle} title={r.name}>{r.name}</div>
                {isUnassigned && <span className={t.unassignedBadge}>Unassigned</span>}
                {isEdit && isExpanded && (
                  <Button themeOptions={{ size: "xs" }} title="Edit Name" onClick={onStartEditName}>
                    <Icon icon={'PencilSquare'} />
                  </Button>
                )}
              </div>
            )}
          </div>
          {isEdit && (
            <div className={t.reorderButtons}>
              <Button themeOptions={{ size: "xs" }} disabled={!canMoveUp || saving} onClick={onReorderUp}>
                <Icon icon={'ChevronUp'} />
              </Button>
              <Button themeOptions={{ size: "xs" }} disabled={!canMoveDown || saving} onClick={onReorderDown}>
                <Icon icon={'ChevronDown'} />
              </Button>
            </div>
          )}
        </div>
        {isExpanded && (
          <div className={t.expandedContainer}>
            {tmcArray.length > 0 && (
              <div className={t.tmcWrapper}>
                <div className={t.tmcLabel}>TMCs ({tmcArray.length}):</div>
                <div className={t.tmcList}>
                  {visibleTmcs.join(", ")}
                  {hiddenTmcCount > 0 && (
                    <span className={t.tmcMoreToggle} onClick={() => setShowAllTmcs(true)}>+{hiddenTmcCount} more</span>
                  )}
                  {showAllTmcs && tmcArray.length > TMC_PREVIEW_COUNT && (
                    <span className={t.tmcMoreToggle} onClick={() => setShowAllTmcs(false)}>show less</span>
                  )}
                </div>
              </div>
            )}
            <div className={t.dateInputsContainer}>
              <div className={t.rowHeaderWrapper}>
                <div className={t.dateRangeLabel}>Date Range</div>
                {isEditingDates ? (
                  <div className={t.editContainer}>
                    <Button
                      themeOptions={{ size: "xs" }}
                      title="save"
                      disabled={editDateMode === 'derived' && (!editDeriveFromValue || !isValidFormula(editDeriveFormulaValue))}
                      onClick={onSaveEditDates}
                    >
                      <Icon icon={"FloppyDisk"} />
                    </Button>
                    <Button themeOptions={{ size: "xs", color: "danger" }} title="cancel" onClick={onCancelEditDates}>
                      <Icon icon={"CancelCircle"} />
                    </Button>
                  </div>
                ) : isEdit ? (
                  <Button themeOptions={{ size: "xs" }} title="Edit Dates" onClick={onStartEditDates}>
                    <Icon icon={'PencilSquare'} />
                  </Button>
                ) : null}
              </div>
              {/* Always visible, edit or not — a fixed row used to show nothing at rest, which
                  was the only way an author could tell this feature existed at all (found live,
                  2026-08-05: "it took me a while to find it, because I had to click the pencil"). */}
              {!isEditingDates && isEdit && (
                <div className={t.derivedDateNote}>
                  {isDerivedDate
                    ? <>Derived from {derivedFromRouteName || 'another route'} — edit to change.</>
                    : baseForNames?.length > 0
                      ? <>Fixed dates — base for {baseForNames.join(', ')}.</>
                      : 'Fixed dates.'}
                </div>
              )}
              {isEditingDates && (
                <div className={t.dateModeWrapper}>
                  <Switch
                    enabled={editDateMode === 'derived'}
                    setEnabled={(v) => (v ? startDeriveMode() : onEditDateModeChange('fixed'))}
                    label="Derive dates from another route"
                    size="small"
                    disabled={editDateMode !== 'derived' && eligibleBases.length === 0}
                  />
                  <span
                    className={t.dateModeLabel}
                    title={editDateMode !== 'derived' && eligibleBases.length === 0
                      ? "No other route is eligible to derive from yet (add another route, or note that an already-derived route can't itself be a base)"
                      : undefined}
                  >
                    {editDateMode === 'derived' ? 'Derived from another route' : 'Fixed dates'}
                  </span>
                </div>
              )}
              {isEditingDates && editDateMode === 'derived' ? (
                <div className={t.deriveControlsWrapper}>
                  <div className={t.dateInputWrapper}>
                    <label className={t.dateLabel}>Derive From:</label>
                    <Select
                      options={eligibleBases.map((s) => ({ value: s.route_comp_id, label: s.name }))}
                      value={editDeriveFromValue || ''}
                      onChange={onEditDeriveFromValueChange}
                    />
                  </div>
                  <div className={t.dateInputWrapper}>
                    <label className={t.dateLabel}>Pattern:</label>
                    <Select
                      options={PATTERN_OPTIONS}
                      value={derivePreset.pattern}
                      onChange={(v) => setDerivePresetField({ pattern: v })}
                    />
                  </div>
                  {derivePreset.pattern !== 'advanced' && (
                    <div className={t.dateInputWrapper}>
                      <label className={t.dateLabel}>Span:</label>
                      <Select options={SPAN_OPTIONS} value={derivePreset.span} onChange={(v) => setDerivePresetField({ span: v })} />
                    </div>
                  )}
                  {derivePreset.pattern === 'offset' && (
                    <div className={t.dateInputWrapper}>
                      <label className={t.dateLabel}>Direction:</label>
                      <Select
                        options={DIRECTION_OPTIONS}
                        value={derivePreset.direction}
                        onChange={(v) => setDerivePresetField({ direction: v })}
                      />
                    </div>
                  )}
                  {derivePreset.pattern === 'offset' && (
                    <div className={t.dateInputWrapper}>
                      <label className={t.dateLabel}>How many:</label>
                      <Input
                        type="number"
                        min="0"
                        value={derivePreset.amount}
                        onChange={(e) => setDerivePresetField({ amount: e.target.value })}
                      />
                    </div>
                  )}
                  {derivePreset.pattern === 'advanced' && (
                    <div className={t.dateInputWrapper}>
                      <label className={t.dateLabel}>Formula:</label>
                      <Input
                        value={editDeriveFormulaValue || ''}
                        onChange={(e) => onEditDeriveFormulaValueChange(e.target.value)}
                      />
                    </div>
                  )}
                  {!editDeriveFromValue ? (
                    <div className={t.dowSummary}>Pick a route to derive from.</div>
                  ) : !isValidFormula(editDeriveFormulaValue) ? (
                    <div className={t.deriveFormulaError}>Not a recognized date formula.</div>
                  ) : derivePreview ? (
                    <div className={t.dowSummary}>
                      Resolves to {derivePreview.start} → {derivePreview.end} (based on {derivePreviewBase?.name}'s current dates)
                    </div>
                  ) : (
                    <div className={t.deriveFormulaError}>Can't resolve yet — {derivePreviewBase?.name} needs its own dates set first.</div>
                  )}
                </div>
              ) : (
                <>
                  <div className={t.dateInputWrapper}>
                    <label className={t.dateLabel}>Start Date:</label>
                    <div className={t.dateInputFlex}>
                      <Input type="date" value={getDateValue(isEditingDates ? editStartDateValue : r.startDate)} disabled={!isEditingDates} onChange={(e) => onDateChange(e, isEditingDates ? editStartDateValue : r.startDate || '', onEditStartDateValueChange)} />
                      <Input type="time" value={getTimeValue(isEditingDates ? editStartDateValue : r.startDate)} disabled={!isEditingDates} onChange={(e) => onTimeChange(e, isEditingDates ? editStartDateValue : r.startDate || '', onEditStartDateValueChange)} />
                    </div>
                  </div>
                  <div className={t.dateInputWrapper}>
                    <label className={t.dateLabel}>End Date:</label>
                    <div className={t.dateInputFlex}>
                      <Input type="date" value={getDateValue(isEditingDates ? editEndDateValue : r.endDate)} disabled={!isEditingDates} onChange={(e) => onDateChange(e, isEditingDates ? editEndDateValue : r.endDate || '', onEditEndDateValueChange)} />
                      <Input type="time" value={getTimeValue(isEditingDates ? editEndDateValue : r.endDate)} disabled={!isEditingDates} onChange={(e) => onTimeChange(e, isEditingDates ? editEndDateValue : r.endDate || '', onEditEndDateValueChange)} />
                    </div>
                  </div>
                  {!isEditingDates && summarizeWeekdays(r.weekdays) && (
                    <div className={t.dowSummary}>{summarizeWeekdays(r.weekdays)}</div>
                  )}
                  {isEditingDates && (
                    <div className={t.peakPresetsWrapper}>
                      <span className={t.peakPresetLabel}>Time of Day:</span>
                      {PEAK_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          className={t.peakPresetPill}
                          disabled={!canApplyPreset}
                          title={canApplyPreset ? `${preset.startTime || 'start'}–${preset.endTime || 'end'}` : 'Set a start and end date first'}
                          onClick={() => applyPeakPreset(preset)}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {isEditingDates && (
                    <div className={t.dowWrapper}>
                      <span className={t.peakPresetLabel}>Days of Week:</span>
                      {DOW_DEFS.map(({ key, label }) => {
                        const on = isDayOn(editWeekdaysValue, key);
                        return (
                          <button
                            key={key}
                            type="button"
                            className={`${t.dowDayPill} ${on ? t.dowDayPillActive : t.dowDayPillIdle}`}
                            title={on ? `${key} included — click to exclude` : `${key} excluded — click to include`}
                            onClick={() => toggleDow(key)}
                          >
                            {label}
                          </button>
                        );
                      })}
                      <button type="button" className={t.peakPresetPill} onClick={() => applyDowPreset(WEEKDAY_KEYS)}>Weekdays</button>
                      <button type="button" className={t.peakPresetPill} onClick={() => applyDowPreset(WEEKEND_KEYS)}>Weekends</button>
                      <button type="button" className={t.peakPresetPill} onClick={() => applyDowPreset(DOW_DEFS.map((d) => d.key))}>All Days</button>
                    </div>
                  )}
                </>
              )}
            </div>
            {isEdit && ColorPicker && (
              <div className={t.colorSection}>
                <div className={t.colorSectionLabel}>Identity Color</div>
                <ColorPicker
                  color={r.color || '#000000'}
                  onChange={stableOnChangeColor}
                  colors={ROUTE_COLOR_PALETTE}
                  showColorPicker={true}
                />
              </div>
            )}
            {graphs.length > 0 && (
              <div className={t.graphChipsWrapper}>
                <span className={t.graphChipsLabel}>On:</span>
                {graphs.map((g) => {
                  const isOn = (r.graphIds || []).includes(g.sectionId);
                  return (
                    <span
                      key={g.sectionId}
                      className={`${isOn ? t.graphChipActive : t.graphChip} ${isEdit ? 'cursor-pointer' : 'cursor-default'}`}
                      onClick={() => isEdit && !saving && onToggleGraph(g.sectionId)}
                      title={isEdit ? (isOn ? `Remove from ${g.label}` : `Add to ${g.label}`) : (isOn ? `On ${g.label}` : undefined)}
                    >
                      {g.label}
                    </span>
                  );
                })}
              </div>
            )}
            {isEdit && (
              <div className={t.removeButtonWrapper}>
                <Button
                  themeOptions={{ size: "xs", color: "danger" }}
                  disabled={saving}
                  onClick={onRemove}
                >
                  <Icon icon="Trash" /> Remove Route from Report
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
