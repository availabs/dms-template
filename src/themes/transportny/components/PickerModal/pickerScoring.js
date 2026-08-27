// Shared "compute a prominence score per row, sort desc" primitives behind BOTH picker
// modals (RouteTagBrowserModal's route picker, ReportPickerModal's report picker) — see
// planning/transportny/tasks/current/... for the design record. The two domains weigh
// genuinely different fields (a route's road class vs a report's rebuilt/described state),
// so there is no one shared "score()" function — but the SHAPE of scoring ("a log-scaled
// magnitude boost, an ownership-match boost, a recency decay, a bad-name penalty, sum them,
// sort desc") is identical, and hand-duplicating that shape per modal is exactly the kind of
// drift this file exists to prevent. Each domain's own `*Score(row, {currentUserId})`
// function (RouteTagBrowserModal/routeScore.js, ReportPickerModal/reportScore.js) is built
// from these primitives; `rankByScore` is the one shared sort step both call.

// log2-scaled magnitude, capped — used for "bigger is better, but sub-linearly" boosts (a
// route's TMC count, etc.) so a 10x larger row doesn't dominate every other signal. This is
// the mechanism behind the finding that motivated prominence sort in the first place: a
// 34-TMC county road (NY-32) must NOT out-rank a 12-TMC interstate (I-87) just because it's
// bigger — logScale keeps size a minor tiebreaker, not the deciding factor.
export function logScale(n, cap = 20, multiplier = 4) {
  return Math.min(cap, Math.log2(1 + Math.max(0, n || 0)) * multiplier);
}

// Whether `ownerId` (a row's created_by) matches the current viewer. String-compared since
// ids arrive as a mix of numbers/strings depending on source/column type.
export function isOwnedByCurrentUser(ownerId, currentUserId) {
  return ownerId != null && ownerId !== '' && currentUserId != null && currentUserId !== ''
    && String(ownerId) === String(currentUserId);
}

// Days between an ISO-ish date string and now. Returns null (not 0) when the string doesn't
// parse, so callers can distinguish "no/garbage date" from "today".
export function daysAgo(dateStr) {
  if (!dateStr) return null;
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return null;
  return Math.max(0, (Date.now() - t) / 86400000);
}

// A decayed recency boost — recently-touched rows score higher, but log-scaled so "yesterday
// vs last week" matters far more than "3 years ago vs 4 years ago" (a plain linear decay would
// let ancient rows swamp the other signals once inverted). `cap` bounds the max boost, same
// convention as logScale.
export function recencyScore(dateStr, cap = 15) {
  const age = daysAgo(dateStr);
  if (age == null) return 0;
  return Math.max(0, cap - Math.log2(1 + age));
}

// Heuristic "this looks like a scratch/test/incomplete row, not a real one" name match —
// shared between the report picker's badge and its "hide incomplete-looking" facet chip.
// Deliberately narrow (whole-word test/testing/delete/bug/saving) — a false positive hides a
// real report from the default view, so this stays conservative rather than clever.
export const LOOKS_INCOMPLETE_RE = /\btest(ing)?\b|\bdelete\b|\bbug\b|\bsaving\b/i;

// Sort a COPY of `rows` by `scoreFn(row)` descending — the one shared "rank by score" step;
// never mutates the input (callers may still hold a reference to the unsorted fetch result).
export function rankByScore(rows, scoreFn) {
  return [...rows].sort((a, b) => scoreFn(b) - scoreFn(a));
}
