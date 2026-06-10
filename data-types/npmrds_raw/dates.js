/**
 * Pure date / window helpers for the npmrds_raw plugin.
 * No I/O, no moment — plain UTC date math so they're trivially unit-testable.
 *
 * Ported from the legacy avail-falcor npmrds_raw helpers + schedule worker, but
 * implemented fresh from the test spec.
 */

// Parse 'YYYY-MM-DD' (or 'MM/DD/YYYY') to a UTC Date at midnight.
function parseDate(str) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const [m, d, y] = str.split('/').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  throw new Error(`Unrecognized date format: ${str}`);
}

// UTC Date -> 'YYYY-MM-DD'.
function fmt(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Per-day intervals over [startDate, endDate] (inclusive of the end day), each
 * expressed as { start_date: 'YYYY-MM-DD 00:00:00', end_date: <next day> }.
 * Matches the RITIS export DATE_RANGES contract.
 */
function generateDateRanges(startDate, endDate) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const result = [];
  let current = start;
  while (current <= end) {
    const next = new Date(current);
    next.setUTCDate(current.getUTCDate() + 1);
    result.push({ start_date: `${fmt(current)} 00:00:00`, end_date: `${fmt(next)} 00:00:00` });
    current = next;
  }
  return result;
}

/**
 * Clamp the requested window to what RITIS actually has available.
 *  - endDate may not exceed latestAvailableDate (MM/DD/YYYY)
 *  - startDate may not exceed the (possibly clamped) endDate
 */
function adjustDates({ latestAvailableDate, startDate, endDate }) {
  const latest = parseDate(latestAvailableDate);
  let end = parseDate(endDate);
  let start = parseDate(startDate);

  if (latest < end) end = latest;        // requested end after latest available -> clamp
  if (end < start) start = end;          // start after clamped end -> pull start back

  return { newStartDate: fmt(start), newEndDate: fmt(end) };
}

/** Throw unless startDate and endDate fall in the same calendar year. */
function enforceSingleCalendarYear(startDate, endDate) {
  const sy = parseDate(startDate).getUTCFullYear();
  const ey = parseDate(endDate).getUTCFullYear();
  if (sy !== ey) {
    throw new Error(`npmrds_raw requires a single calendar year per run (got ${sy}..${ey})`);
  }
}

/**
 * Scheduling seam (NOT wired yet): given the last successfully-ingested end date,
 * compute the next window — the day after, spanning one month, never crossing the
 * year boundary (capped at Dec 31 of the start year).
 */
function computeNextWindow({ latestEndDate }) {
  const last = parseDate(latestEndDate);
  const start = new Date(last);
  start.setUTCDate(last.getUTCDate() + 1);

  const end = new Date(start);
  end.setUTCMonth(start.getUTCMonth() + 1);

  const yearEnd = new Date(Date.UTC(start.getUTCFullYear(), 11, 31));
  return {
    startDate: fmt(start),
    endDate: fmt(end > yearEnd ? yearEnd : end),
  };
}

module.exports = {
  parseDate,
  fmt,
  generateDateRanges,
  adjustDates,
  enforceSingleCalendarYear,
  computeNextWindow,
};
