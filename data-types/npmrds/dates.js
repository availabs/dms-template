/**
 * Pure date helpers for the npmrds plugin — the scheduling seam for the
 * weekly raw→prod add. No I/O, plain UTC date math, trivially unit-testable.
 *
 *  - lastCompleteWeek: legacy weekly cadence — the last complete Mon–Sun
 *    window strictly before "now" (a week ending today does not count).
 *  - isNextDay: the legacy statistics.worker gap check (the prod view's
 *    end_date must abut the next window's start). Failing this BLOCKS the
 *    scheduled fire loudly via preflight instead of the legacy silent
 *    ERROR event.
 */

// UTC Date -> 'YYYY-MM-DD'.
function fmt(date) {
  return date.toISOString().split('T')[0];
}

// 'YYYY-MM-DD' (timestamp tails tolerated) -> UTC Date at midnight.
function parseDay(str) {
  const datePart = String(str).slice(0, 10);
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) throw new Error(`Unrecognized date: ${str}`);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Last complete Mon–Sun week strictly before `now` (UTC calendar):
 * endDate = the most recent Sunday before today, startDate = its Monday.
 */
function lastCompleteWeek({ now = new Date() } = {}) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // getUTCDay: Sunday=0 … Saturday=6. Days back to the most recent Sunday
  // strictly before today (a Sunday today is still running → go back 7).
  const daysBack = today.getUTCDay() === 0 ? 7 : today.getUTCDay();
  const sunday = new Date(today);
  sunday.setUTCDate(today.getUTCDate() - daysBack);
  const monday = new Date(sunday);
  monday.setUTCDate(sunday.getUTCDate() - 6);
  return { startDate: fmt(monday), endDate: fmt(sunday) };
}

/** True when startDate is exactly the day after prevEndDate. */
function isNextDay(prevEndDate, startDate) {
  const next = parseDay(prevEndDate);
  next.setUTCDate(next.getUTCDate() + 1);
  return fmt(next) === fmt(parseDay(startDate));
}

module.exports = { lastCompleteWeek, isNextDay };
