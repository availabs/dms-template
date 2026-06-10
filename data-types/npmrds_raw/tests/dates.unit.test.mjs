/**
 * Unit tests for npmrds_raw pure date/window helpers.
 * No DB / ClickHouse / RITIS — pure functions only.
 */
import { describe, it, expect } from 'vitest';
import * as dates from '../dates.js';

describe('generateDateRanges', () => {
  it('produces one per-day [00:00:00, next-day 00:00:00) interval, inclusive of the end day', () => {
    expect(dates.generateDateRanges('2024-03-01', '2024-03-02')).toEqual([
      { start_date: '2024-03-01 00:00:00', end_date: '2024-03-02 00:00:00' },
      { start_date: '2024-03-02 00:00:00', end_date: '2024-03-03 00:00:00' },
    ]);
  });

  it('returns a single interval when start === end', () => {
    expect(dates.generateDateRanges('2024-07-04', '2024-07-04')).toEqual([
      { start_date: '2024-07-04 00:00:00', end_date: '2024-07-05 00:00:00' },
    ]);
  });

  it('spans a month boundary correctly', () => {
    const r = dates.generateDateRanges('2024-01-31', '2024-02-01');
    expect(r).toHaveLength(2);
    expect(r[0].start_date).toBe('2024-01-31 00:00:00');
    expect(r[1].start_date).toBe('2024-02-01 00:00:00');
    expect(r[1].end_date).toBe('2024-02-02 00:00:00');
  });
});

describe('adjustDates', () => {
  it('clamps endDate to the latest available date when requested end is later', () => {
    const { newStartDate, newEndDate } = dates.adjustDates({
      latestAvailableDate: '03/15/2024', startDate: '2024-03-01', endDate: '2024-03-31',
    });
    expect(newEndDate).toBe('2024-03-15');
    expect(newStartDate).toBe('2024-03-01');
  });

  it('leaves dates untouched when the end date is available', () => {
    const { newStartDate, newEndDate } = dates.adjustDates({
      latestAvailableDate: '03/31/2024', startDate: '2024-03-01', endDate: '2024-03-15',
    });
    expect(newEndDate).toBe('2024-03-15');
    expect(newStartDate).toBe('2024-03-01');
  });

  it('pulls startDate back to endDate if clamping made start > end', () => {
    const { newStartDate, newEndDate } = dates.adjustDates({
      latestAvailableDate: '03/05/2024', startDate: '2024-03-20', endDate: '2024-03-31',
    });
    expect(newEndDate).toBe('2024-03-05');
    expect(newStartDate).toBe('2024-03-05');
  });
});

describe('enforceSingleCalendarYear', () => {
  it('passes when start and end are in the same year', () => {
    expect(() => dates.enforceSingleCalendarYear('2024-01-01', '2024-12-31')).not.toThrow();
  });
  it('throws when the range crosses a year boundary', () => {
    expect(() => dates.enforceSingleCalendarYear('2024-12-30', '2025-01-02')).toThrow(/single calendar year/i);
  });
});

describe('computeNextWindow (scheduling seam — not wired, but must be ready)', () => {
  it('starts the day after the last end date and spans one month', () => {
    expect(dates.computeNextWindow({ latestEndDate: '2024-06-01' })).toEqual({
      startDate: '2024-06-02', endDate: '2024-07-02',
    });
  });

  it('caps the end date at Dec 31 of the start year (no year crossing)', () => {
    expect(dates.computeNextWindow({ latestEndDate: '2024-12-10' })).toEqual({
      startDate: '2024-12-11', endDate: '2024-12-31',
    });
  });
});
