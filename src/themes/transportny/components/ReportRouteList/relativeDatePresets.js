// Curated, author-facing presets for Mechanism B's relative-date formula grammar (see
// relativeDateResolution.js) — mirrors derived-page-variable.md's own precedent of "a small named
// registry, not expressions" rather than exposing the raw formula string as the primary control.
// Four formula shapes get a curated control:
//   - the "of" snap form:      startDate=>{span}of
//   - the whole-period shift:  {startDate|endDate}=>{span}{+-}{amount}{span}->1{span}  (duration
//     fixed at 1 — a multi-span rolling window has no verified real example, so it isn't offered
//     as a preset; the "Advanced" pattern below still accepts one by hand).
//   - a fixed calendar month:  startDate=>calendar:{month}-1..{month}-L
//   - a fixed calendar range:  startDate=>calendar:{month1}-{day1}..{month2}-{day2}  (2026-08-10,
//     see relativeDateResolution.js's CALENDAR_POSITION_REGEX — the "Nth calendar position inside
//     whatever year is current" enrichment, replacing Monthly Congestion's/Seasonality's static dates)
// Direction ("before"/"after") maps directly onto the resolver's own documented, symmetric anchor
// behavior (relativeDateResolution.js: startDate anchor subtracts, endDate anchor adds) — this is
// exercising real resolver behavior, not inventing new semantics, even though the real old-tool
// corpus only ever used "before".

import { RELATIVE_DATE_REGEX, CALENDAR_POSITION_REGEX } from './relativeDateResolution';

export const SPAN_OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

export const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export const PATTERN_OPTIONS = [
  { value: 'offset', label: 'Offset by whole periods' },
  { value: 'snap', label: 'Same period, aligned' },
  { value: 'calendarMonth', label: 'Fixed calendar month' },
  { value: 'calendarRange', label: 'Fixed calendar range (e.g. a season)' },
  { value: 'advanced', label: 'Advanced (custom formula)' },
];

export const DIRECTION_OPTIONS = [
  { value: 'before', label: 'Before' },
  { value: 'after', label: 'After' },
];

export const DEFAULT_PRESET = {
  pattern: 'offset',
  span: 'year',
  direction: 'before',
  amount: 1,
  calMonth: 1,
  calMonth1: 1,
  calDay1: 1,
  calMonth2: 1,
  calDay2: 'L',
};

// Builds the stored formula string from the curated controls' current values. `advanced` pattern
// is a no-op here — its raw text is edited directly, not composed from the other fields.
export function buildFormula({ pattern, span, direction, amount, advancedFormula, calMonth, calMonth1, calDay1, calMonth2, calDay2 }) {
  if (pattern === 'advanced') return advancedFormula ?? '';
  if (pattern === 'snap') return `startDate=>${span}of`;
  if (pattern === 'calendarMonth') {
    const m = Math.min(12, Math.max(1, parseInt(calMonth, 10) || 1));
    return `startDate=>calendar:${m}-1..${m}-L`;
  }
  if (pattern === 'calendarRange') {
    const m1 = Math.min(12, Math.max(1, parseInt(calMonth1, 10) || 1));
    const d1 = Math.min(31, Math.max(1, parseInt(calDay1, 10) || 1));
    const m2 = Math.min(12, Math.max(1, parseInt(calMonth2, 10) || 1));
    const d2 = calDay2 === 'L' || calDay2 == null || calDay2 === '' ? 'L' : Math.min(31, Math.max(1, parseInt(calDay2, 10) || 1));
    return `startDate=>calendar:${m1}-${d1}..${m2}-${d2}`;
  }
  const n = Math.max(0, parseInt(amount, 10) || 0);
  return direction === 'after'
    ? `endDate=>${span}+${n}${span}->1${span}`
    : `startDate=>${span}-${n}${span}->1${span}`;
}

// Reverse of buildFormula, so re-opening an already-set formula re-populates the curated controls
// instead of dropping the author into raw text every time. Falls back to the `advanced` pattern
// (raw text, pre-filled with the real formula) for anything outside the curated shapes —
// including every real formula convert_old_reports.py ever wrote with `duration !== 1` (verified:
// every real corpus example this UI doesn't curate still parses and resolves correctly via
// relativeDateResolution.js — it just isn't re-editable through the preset controls).
export function parseFormula(formula) {
  const cal = CALENDAR_POSITION_REGEX.exec(formula || '');
  if (cal) {
    const { month1, day1, month2, day2 } = cal.groups;
    if (month1 === month2 && day1 === '1' && day2 === 'L') {
      return { ...DEFAULT_PRESET, pattern: 'calendarMonth', calMonth: Number(month1), advancedFormula: formula };
    }
    return {
      ...DEFAULT_PRESET,
      pattern: 'calendarRange',
      calMonth1: Number(month1),
      calDay1: Number(day1),
      calMonth2: Number(month2),
      calDay2: day2 === 'L' ? 'L' : Number(day2),
      advancedFormula: formula,
    };
  }
  const m = RELATIVE_DATE_REGEX.exec(formula || '');
  if (!m) return { ...DEFAULT_PRESET, pattern: 'advanced', advancedFormula: formula || '' };
  const { anchor, span, isof, amount, duration } = m.groups;
  if (isof) return { ...DEFAULT_PRESET, pattern: 'snap', span, advancedFormula: formula };
  if (Number(duration) !== 1) return { ...DEFAULT_PRESET, pattern: 'advanced', advancedFormula: formula };
  return {
    pattern: 'offset',
    span,
    direction: anchor === 'endDate' ? 'after' : 'before',
    amount: Number(amount),
    advancedFormula: formula,
  };
}

export function isValidFormula(formula) {
  return RELATIVE_DATE_REGEX.test(formula || '') || CALENDAR_POSITION_REGEX.test(formula || '');
}
