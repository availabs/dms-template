/**
 * Unit tests for npmrds pure date helpers (the scheduling seam for the
 * weekly raw→prod add). No DB / no ClickHouse — pure functions only.
 *
 *  - lastCompleteWeek — the legacy weekly cadence: last complete Mon–Sun
 *    window strictly before "now".
 *  - isNextDay — the legacy statistics.worker date-gap check (prod view
 *    end_date must abut the next window's start), now failing LOUDLY via
 *    the schedule preflight instead of a silent ERROR event.
 */
import { describe, it, expect } from 'vitest';
import * as dates from '../dates.js';

describe('lastCompleteWeek', () => {
  it('mid-week: returns the Mon–Sun week that ended last Sunday', () => {
    // Wednesday 2026-06-10
    expect(dates.lastCompleteWeek({ now: new Date('2026-06-10T12:00:00Z') }))
      .toEqual({ startDate: '2026-06-01', endDate: '2026-06-07' });
  });

  it('Monday: the week that just ended yesterday is complete', () => {
    expect(dates.lastCompleteWeek({ now: new Date('2026-06-08T00:30:00Z') }))
      .toEqual({ startDate: '2026-06-01', endDate: '2026-06-07' });
  });

  it('Sunday: the running week is NOT complete — returns the prior one', () => {
    expect(dates.lastCompleteWeek({ now: new Date('2026-06-07T23:00:00Z') }))
      .toEqual({ startDate: '2026-05-25', endDate: '2026-05-31' });
  });

  it('crosses month and year boundaries', () => {
    // Friday 2026-01-02 → last complete week is Mon 2025-12-22 .. Sun 2025-12-28
    expect(dates.lastCompleteWeek({ now: new Date('2026-01-02T08:00:00Z') }))
      .toEqual({ startDate: '2025-12-22', endDate: '2025-12-28' });
  });
});

describe('isNextDay', () => {
  it('true when start is exactly the day after the previous end', () => {
    expect(dates.isNextDay('2026-05-31', '2026-06-01')).toBe(true);
    expect(dates.isNextDay('2026-12-31', '2027-01-01')).toBe(true);
  });

  it('false on gaps and overlaps', () => {
    expect(dates.isNextDay('2026-05-30', '2026-06-01')).toBe(false); // gap
    expect(dates.isNextDay('2026-06-01', '2026-06-01')).toBe(false); // same day
    expect(dates.isNextDay('2026-06-02', '2026-06-01')).toBe(false); // backwards
  });

  it('tolerates timestamp-ish inputs (date part wins)', () => {
    expect(dates.isNextDay('2026-05-31 23:59:59', '2026-06-01')).toBe(true);
  });
});
