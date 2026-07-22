import { useCallback, useRef, useState } from 'react';
import { parseTmcArray } from './utils';
import { ROUTE_COLOR_PALETTE } from './useReportRow';

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
  isEditingDates,
  editStartDateValue,
  editEndDateValue,
  onEditStartDateValueChange,
  onEditEndDateValueChange,
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

  const r = route;
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
                <div className={t.routeTitle}>{r.name}</div>
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
                    <Button themeOptions={{ size: "xs" }} title="save" onClick={onSaveEditDates}>
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
