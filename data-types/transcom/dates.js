/**
 * Pure date / window helpers for the transcom plugin.
 * No I/O, no moment/luxon — plain date math so everything is unit-testable.
 *
 * Ported from the legacy avail-falcor transcom helpers:
 *   - dates.js (partitionTranscomRequestTimestampsByMonth, validation)
 *   - transcom.worker.mjs (getMonthlyIntervals)
 *   - transcom_add.worker.mjs (getMergedDateRange, reconstructCongestionWithMergeRange,
 *     getYearsBetween)
 *   - processIncidents.js (getYearAndMonthDateRanges, markCongestionTrue)
 *   - transcom_schedule.worker.mjs ('yesterday' — exposed as the pure
 *     computeNextWindow scheduling seam; the new runner has no cron wiring yet)
 */

const TS_RE = /^\d{4}-\d{1,2}-\d{1,2} \d{2}:\d{2}:\d{2}$/;

const pad2 = (n) => String(n).padStart(2, '0');

/** Throw unless the timestamp is in the TRANSCOM 'YYYY-MM-DD HH:MM:SS' format. */
function validateTranscomTimestamp(timestamp) {
  if (!TS_RE.test(String(timestamp || ''))) {
    throw new Error('Timestamps must be in "yyyy-mm-dd HH:MM:SS" format.');
  }
}

/** Parse 'YYYY-MM-DD' or 'YYYY-MM-DD HH:MM:SS' into { y, m, d, time } (wall clock). */
function parseParts(str) {
  const [datePart, timePart] = String(str).trim().split(/[T ]/);
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) throw new Error(`Unrecognized date: ${str}`);
  return { y, m, d, time: timePart || '00:00:00' };
}

const lastDayOfMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const fmtDate = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
const dayMs = (y, m, d) => Date.UTC(y, m - 1, d);

/**
 * Partition a TRANSCOM request range into per-month [start_ts, end_ts] windows.
 * First/last months are clipped to the requested bounds; interior months run
 * from the 1st 00:00:00 to the last day 23:59:59.
 */
function partitionTimestampsByMonth(start_timestamp, end_timestamp) {
  validateTranscomTimestamp(start_timestamp);
  validateTranscomTimestamp(end_timestamp);

  const s = parseParts(start_timestamp);
  const e = parseParts(end_timestamp);

  const out = [];
  for (let year = s.y; year <= e.y; year++) {
    const mFrom = year === s.y ? s.m : 1;
    const mTo = year === e.y ? e.m : 12;
    for (let m = mFrom; m <= mTo; m++) {
      const isStart = year === s.y && m === s.m;
      const isEnd = year === e.y && m === e.m;
      const sd = isStart ? s.d : 1;
      const st = isStart ? s.time : '00:00:00';
      const ed = isEnd ? e.d : lastDayOfMonth(year, m);
      const et = isEnd ? e.time : '23:59:59';
      out.push([`${fmtDate(year, m, sd)} ${st}`, `${fmtDate(year, m, ed)} ${et}`]);
    }
  }
  return out;
}

/**
 * Month chunks over [start, end] for the view-metadata congestion bookkeeping:
 * [{ start_date, end_date, is_congestion_data_available: false }, …]
 */
function getMonthlyIntervals(startDateStr, endDateStr) {
  const s = parseParts(startDateStr);
  const e = parseParts(endDateStr);
  const out = [];
  let y = s.y, m = s.m;
  while (y < e.y || (y === e.y && m <= e.m)) {
    const fromD = (y === s.y && m === s.m) ? s.d : 1;
    const toD = (y === e.y && m === e.m) ? e.d : lastDayOfMonth(y, m);
    out.push({
      start_date: fmtDate(y, m, fromD),
      end_date: fmtDate(y, m, toD),
      is_congestion_data_available: false,
    });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

/**
 * Per-year ranges with month chunks for the congestion worker loop:
 * { [year]: { start_date, end_date, months: [{ month, start_date, end_date }] } }
 */
function getYearAndMonthDateRanges(startDate, endDate) {
  const s = parseParts(startDate);
  const e = parseParts(endDate);
  const result = {};
  for (let year = s.y; year <= e.y; year++) {
    const fromM = year === s.y ? s.m : 1;
    const fromD = year === s.y ? s.d : 1;
    const toM = year === e.y ? e.m : 12;
    const toD = year === e.y ? e.d : 31;
    result[year] = {
      start_date: fmtDate(year, fromM, fromD),
      end_date: fmtDate(year, toM, toD),
      months: getMonthlyIntervals(fmtDate(year, fromM, fromD), fmtDate(year, toM, toD))
        .map(({ start_date, end_date }) => ({
          month: Number(start_date.split('-')[1]),
          start_date,
          end_date,
        })),
    };
  }
  return result;
}

/**
 * Merge an existing view window with a newly ingested window
 * (legacy transcom_add.worker getMergedDateRange):
 *  - no current window -> adopt the new one
 *  - overlap or a gap   -> keep the current one untouched
 *  - contiguous (new range starts the day after the current end, or ends the
 *    day before the current start) -> extend
 * Output is day-resolved: start at 00:00:00, end at 23:59:59.
 */
function getMergedDateRange(currentStartDate, currentEndDate, startDate, endDate) {
  const dayOf = (str) => { const p = parseParts(str); return dayMs(p.y, p.m, p.d); };
  const fmtStart = (ms) => `${new Date(ms).toISOString().slice(0, 10)} 00:00:00`;
  const fmtEnd = (ms) => `${new Date(ms).toISOString().slice(0, 10)} 23:59:59`;
  const DAY = 24 * 60 * 60 * 1000;

  const newStart = dayOf(startDate);
  const newEnd = dayOf(endDate);

  if (!currentStartDate && !currentEndDate) {
    return { start_date: fmtStart(newStart), end_date: fmtEnd(newEnd) };
  }

  const curStart = dayOf(currentStartDate);
  const curEnd = dayOf(currentEndDate);
  const keepCurrent = { start_date: fmtStart(curStart), end_date: fmtEnd(curEnd) };

  if (newEnd < newStart) return keepCurrent;
  if (curEnd < curStart) return keepCurrent;

  // overlap (any containment either way)
  const overlaps = newStart <= curEnd && newEnd >= curStart;
  if (overlaps) return keepCurrent;

  const contiguousAtStart = newEnd === curStart - DAY;
  const contiguousAtEnd = newStart === curEnd + DAY;
  if (!contiguousAtStart && !contiguousAtEnd) return keepCurrent;

  return {
    start_date: fmtStart(contiguousAtStart ? newStart : curStart),
    end_date: fmtEnd(contiguousAtEnd ? newEnd : curEnd),
  };
}

/**
 * Rebuild the per-month congestion bookkeeping over a merged window, keeping
 * is_congestion_data_available only for month chunks whose bounds are unchanged.
 */
function reconstructCongestionWithMergeRange(congestion = [], newStart, newEnd) {
  const s = parseParts(newStart);
  // legacy: subtract 1ms so 'YYYY-MM-01 00:00:00' end bounds resolve to the prior day
  const eParts = parseParts(newEnd);
  let endMs = dayMs(eParts.y, eParts.m, eParts.d);
  if (eParts.time === '00:00:00') endMs -= 24 * 60 * 60 * 1000;
  const e = parseParts(new Date(endMs).toISOString().slice(0, 10));

  const oldMap = new Map();
  for (const entry of congestion || []) {
    oldMap.set(String(entry.start_date).slice(0, 7), entry);
  }

  return getMonthlyIntervals(fmtDate(s.y, s.m, s.d), fmtDate(e.y, e.m, e.d)).map((chunk) => {
    const old = oldMap.get(chunk.start_date.slice(0, 7));
    const unchanged = old
      && String(old.start_date).slice(0, 10) === chunk.start_date
      && String(old.end_date).slice(0, 10) === chunk.end_date;
    return {
      ...chunk,
      is_congestion_data_available: unchanged ? !!old.is_congestion_data_available : false,
    };
  });
}

/** Flip is_congestion_data_available for the interval exactly matching the window. */
function markCongestionTrue(congestion, availableStart, availableEnd) {
  const startStr = String(availableStart).slice(0, 10);
  const endStr = String(availableEnd).slice(0, 10);
  return (congestion || []).map((entry) => {
    const exact = String(entry.start_date).slice(0, 10) === startStr
      && String(entry.end_date).slice(0, 10) === endStr;
    return {
      ...entry,
      is_congestion_data_available: exact ? true : entry.is_congestion_data_available,
    };
  });
}

/** Every calendar year touched by [startDate, endDate]. */
function getYearsBetween(startDate, endDate) {
  const s = parseParts(startDate);
  const e = parseParts(endDate);
  const years = [];
  for (let y = s.y; y <= e.y; y++) years.push(y);
  return years;
}

/**
 * Scheduling seam (NOT wired to a cron yet — the new runner has no scheduler):
 * the legacy transcom_schedule.worker always ingested "yesterday". Pure given
 * a `now` Date (local wall clock, matching the legacy server behavior).
 */
function computeNextWindow({ now = new Date() } = {}) {
  const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const date = fmtDate(y.getFullYear(), y.getMonth() + 1, y.getDate());
  return {
    start_timestamp: `${date} 00:00:00`,
    end_timestamp: `${date} 23:59:59`,
  };
}

/** Route helpers: expand a date(ish) input to start/end-of-day timestamps. */
function toStartOfDayTimestamp(dateStr) {
  const p = parseParts(dateStr);
  return `${fmtDate(p.y, p.m, p.d)} 00:00:00`;
}
function toEndOfDayTimestamp(dateStr) {
  const p = parseParts(dateStr);
  return `${fmtDate(p.y, p.m, p.d)} 23:59:59`;
}

module.exports = {
  validateTranscomTimestamp,
  partitionTimestampsByMonth,
  getMonthlyIntervals,
  getYearAndMonthDateRanges,
  getMergedDateRange,
  reconstructCongestionWithMergeRange,
  markCongestionTrue,
  getYearsBetween,
  computeNextWindow,
  toStartOfDayTimestamp,
  toEndOfDayTimestamp,
};
