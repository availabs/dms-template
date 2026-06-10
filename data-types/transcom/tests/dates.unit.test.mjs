/**
 * Unit tests for transcom pure date/window helpers.
 * No DB / no TRANSCOM API — pure functions only.
 *
 * Ported behaviors:
 *  - partitionTimestampsByMonth   (legacy dates.js — the event-id fetch windows)
 *  - getMonthlyIntervals          (legacy transcom.worker — congestion bookkeeping)
 *  - getYearAndMonthDateRanges    (legacy processIncidents — congestion year/month loop)
 *  - getMergedDateRange           (legacy transcom_add.worker — view start/end merge)
 *  - reconstructCongestionWithMergeRange (legacy transcom_add.worker)
 *  - markCongestionTrue           (legacy processIncidents)
 *  - computeNextWindow            (legacy transcom_schedule.worker — 'yesterday', as a pure seam)
 */
import { describe, it, expect } from 'vitest';
import * as dates from '../dates.js';

describe('validateTranscomTimestamp', () => {
  it('accepts the TRANSCOM "YYYY-MM-DD HH:MM:SS" format', () => {
    expect(() => dates.validateTranscomTimestamp('2024-03-01 00:00:00')).not.toThrow();
  });
  it('rejects anything else', () => {
    expect(() => dates.validateTranscomTimestamp('03/01/2024 00:00:00')).toThrow(/format/i);
    expect(() => dates.validateTranscomTimestamp('2024-03-01')).toThrow(/format/i);
  });
});

describe('partitionTimestampsByMonth', () => {
  it('clips the first and last month to the requested bounds, full months in between', () => {
    expect(dates.partitionTimestampsByMonth('2024-11-15 06:30:00', '2025-01-10 12:00:00')).toEqual([
      ['2024-11-15 06:30:00', '2024-11-30 23:59:59'],
      ['2024-12-01 00:00:00', '2024-12-31 23:59:59'],
      ['2025-01-01 00:00:00', '2025-01-10 12:00:00'],
    ]);
  });
  it('returns a single partition for a same-month range', () => {
    expect(dates.partitionTimestampsByMonth('2024-02-03 00:00:00', '2024-02-10 23:59:59')).toEqual([
      ['2024-02-03 00:00:00', '2024-02-10 23:59:59'],
    ]);
  });
  it('handles leap-year February month ends', () => {
    const parts = dates.partitionTimestampsByMonth('2024-01-15 00:00:00', '2024-03-15 00:00:00');
    expect(parts[1]).toEqual(['2024-02-01 00:00:00', '2024-02-29 23:59:59']);
  });
});

describe('getMonthlyIntervals', () => {
  it('produces month chunks clipped to the range, all initially unavailable', () => {
    expect(dates.getMonthlyIntervals('2024-01-15 00:00:00', '2024-03-10 23:59:59')).toEqual([
      { start_date: '2024-01-15', end_date: '2024-01-31', is_congestion_data_available: false },
      { start_date: '2024-02-01', end_date: '2024-02-29', is_congestion_data_available: false },
      { start_date: '2024-03-01', end_date: '2024-03-10', is_congestion_data_available: false },
    ]);
  });
});

describe('getYearAndMonthDateRanges', () => {
  it('splits a cross-year range into per-year ranges with month chunks', () => {
    const r = dates.getYearAndMonthDateRanges('2023-12-15', '2024-01-20');
    expect(Object.keys(r)).toEqual(['2023', '2024']);
    expect(r[2023].start_date).toBe('2023-12-15');
    expect(r[2023].end_date).toBe('2023-12-31');
    expect(r[2023].months).toEqual([
      { month: 12, start_date: '2023-12-15', end_date: '2023-12-31' },
    ]);
    expect(r[2024].months).toEqual([
      { month: 1, start_date: '2024-01-01', end_date: '2024-01-20' },
    ]);
  });
});

describe('getMergedDateRange', () => {
  it('adopts the new range when there is no current range', () => {
    expect(dates.getMergedDateRange(null, null, '2024-03-01', '2024-03-31')).toEqual({
      start_date: '2024-03-01 00:00:00',
      end_date: '2024-03-31 23:59:59',
    });
  });
  it('keeps the current range when the new range overlaps it', () => {
    expect(dates.getMergedDateRange('2024-03-01 00:00:00', '2024-03-31 23:59:59', '2024-03-15', '2024-04-15')).toEqual({
      start_date: '2024-03-01 00:00:00',
      end_date: '2024-03-31 23:59:59',
    });
  });
  it('extends the end when the new range is contiguous after the current one', () => {
    expect(dates.getMergedDateRange('2024-03-01 00:00:00', '2024-03-31 23:59:59', '2024-04-01', '2024-04-30')).toEqual({
      start_date: '2024-03-01 00:00:00',
      end_date: '2024-04-30 23:59:59',
    });
  });
  it('extends the start when the new range is contiguous before the current one', () => {
    expect(dates.getMergedDateRange('2024-03-01 00:00:00', '2024-03-31 23:59:59', '2024-02-01', '2024-02-29')).toEqual({
      start_date: '2024-02-01 00:00:00',
      end_date: '2024-03-31 23:59:59',
    });
  });
  it('keeps the current range when the new range is disjoint and non-contiguous', () => {
    expect(dates.getMergedDateRange('2024-03-01 00:00:00', '2024-03-31 23:59:59', '2024-06-01', '2024-06-30')).toEqual({
      start_date: '2024-03-01 00:00:00',
      end_date: '2024-03-31 23:59:59',
    });
  });
});

describe('reconstructCongestionWithMergeRange', () => {
  it('rebuilds month chunks over the merged range, preserving availability for unchanged chunks', () => {
    const old = [
      { start_date: '2024-03-01', end_date: '2024-03-31', is_congestion_data_available: true },
    ];
    const next = dates.reconstructCongestionWithMergeRange(old, '2024-03-01 00:00:00', '2024-04-30 23:59:59');
    expect(next).toEqual([
      { start_date: '2024-03-01', end_date: '2024-03-31', is_congestion_data_available: true },
      { start_date: '2024-04-01', end_date: '2024-04-30', is_congestion_data_available: false },
    ]);
  });
  it('resets availability when the month chunk bounds changed', () => {
    const old = [
      { start_date: '2024-03-01', end_date: '2024-03-15', is_congestion_data_available: true },
    ];
    const next = dates.reconstructCongestionWithMergeRange(old, '2024-03-01 00:00:00', '2024-03-31 23:59:59');
    expect(next).toEqual([
      { start_date: '2024-03-01', end_date: '2024-03-31', is_congestion_data_available: false },
    ]);
  });
});

describe('markCongestionTrue', () => {
  it('flips only the interval that exactly matches the processed window', () => {
    const congestion = [
      { start_date: '2024-03-01', end_date: '2024-03-31', is_congestion_data_available: false },
      { start_date: '2024-04-01', end_date: '2024-04-30', is_congestion_data_available: false },
    ];
    const next = dates.markCongestionTrue(congestion, '2024-03-01', '2024-03-31');
    expect(next[0].is_congestion_data_available).toBe(true);
    expect(next[1].is_congestion_data_available).toBe(false);
  });
});

describe('computeNextWindow (scheduling seam — the legacy schedule worker did "yesterday")', () => {
  it('returns yesterday 00:00:00 .. 23:59:59 for a given "now"', () => {
    const now = new Date(2024, 2, 15, 9, 30, 0); // local 2024-03-15 09:30
    expect(dates.computeNextWindow({ now })).toEqual({
      start_timestamp: '2024-03-14 00:00:00',
      end_timestamp: '2024-03-14 23:59:59',
    });
  });
  it('crosses month boundaries', () => {
    const now = new Date(2024, 2, 1, 1, 0, 0); // local 2024-03-01
    expect(dates.computeNextWindow({ now })).toEqual({
      start_timestamp: '2024-02-29 00:00:00',
      end_timestamp: '2024-02-29 23:59:59',
    });
  });
});

describe('day bounds helpers (route start/end timestamp expansion)', () => {
  it('expands a date to start/end of day timestamps', () => {
    expect(dates.toStartOfDayTimestamp('2024-03-05')).toBe('2024-03-05 00:00:00');
    expect(dates.toEndOfDayTimestamp('2024-03-05')).toBe('2024-03-05 23:59:59');
  });
});

describe('getYearsBetween', () => {
  it('lists every calendar year touched by the range', () => {
    expect(dates.getYearsBetween('2023-11-01', '2025-02-01')).toEqual([2023, 2024, 2025]);
  });
});
