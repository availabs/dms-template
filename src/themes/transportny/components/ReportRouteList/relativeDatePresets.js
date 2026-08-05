// Curated, author-facing presets for Mechanism B's relative-date formula grammar (see
// relativeDateResolution.js) — mirrors derived-page-variable.md's own precedent of "a small named
// registry, not expressions" rather than exposing the raw formula string as the primary control.
// Only the two formula shapes actually verified against real corpus data get a curated control
// (research/npmrds-reports/relative-dates-authoring-ui-scoping.md, Q2):
//   - the "of" snap form:      startDate=>{span}of
//   - the whole-period shift:  {startDate|endDate}=>{span}{+-}{amount}{span}->1{span}  (duration
//     fixed at 1 — a multi-span rolling window has no verified real example, so it isn't offered
//     as a preset; the "Advanced" pattern below still accepts one by hand).
// Direction ("before"/"after") maps directly onto the resolver's own documented, symmetric anchor
// behavior (relativeDateResolution.js: startDate anchor subtracts, endDate anchor adds) — this is
// exercising real resolver behavior, not inventing new semantics, even though the real old-tool
// corpus only ever used "before".

import { RELATIVE_DATE_REGEX } from './relativeDateResolution';

export const SPAN_OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

export const PATTERN_OPTIONS = [
  { value: 'offset', label: 'Offset by whole periods' },
  { value: 'snap', label: 'Same period, aligned' },
  { value: 'advanced', label: 'Advanced (custom formula)' },
];

export const DIRECTION_OPTIONS = [
  { value: 'before', label: 'Before' },
  { value: 'after', label: 'After' },
];

export const DEFAULT_PRESET = { pattern: 'offset', span: 'year', direction: 'before', amount: 1 };

// Builds the stored formula string from the curated controls' current values. `advanced` pattern
// is a no-op here — its raw text is edited directly, not composed from span/direction/amount.
export function buildFormula({ pattern, span, direction, amount, advancedFormula }) {
  if (pattern === 'advanced') return advancedFormula ?? '';
  if (pattern === 'snap') return `startDate=>${span}of`;
  const n = Math.max(0, parseInt(amount, 10) || 0);
  return direction === 'after'
    ? `endDate=>${span}+${n}${span}->1${span}`
    : `startDate=>${span}-${n}${span}->1${span}`;
}

// Reverse of buildFormula, so re-opening an already-set formula re-populates the curated controls
// instead of dropping the author into raw text every time. Falls back to the `advanced` pattern
// (raw text, pre-filled with the real formula) for anything outside the two curated shapes —
// including every real formula convert_old_reports.py ever wrote with `duration !== 1` (verified:
// every real corpus example this UI doesn't curate still parses and resolves correctly via
// relativeDateResolution.js — it just isn't re-editable through the preset controls).
export function parseFormula(formula) {
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
  return RELATIVE_DATE_REGEX.test(formula || '');
}
