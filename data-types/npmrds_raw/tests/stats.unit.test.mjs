/**
 * Unit tests for npmrds_raw coverage-statistics math. Pure function.
 */
import { describe, it, expect } from 'vitest';
import { coverageStatistics } from '../stats.js';

describe('coverageStatistics', () => {
  it('computes 100% when every 5-min epoch is present for one TMC over one day', () => {
    const s = coverageStatistics({
      averagingWindowSize: 0, days: 1,
      totalCount: 288, totalTmcs: 1,
      interstateCount: 288, interstateTmcs: 1,
      nonInterstateCount: 0, nonInterstateTmcs: 0,
      extendedCount: 0, extendedTmcs: 0,
    });
    expect(s.averagingWindowSize).toBe(0);
    expect(s.total).toBeCloseTo(100, 6);
    expect(s.interstate_percentage).toBeCloseTo(100, 6);
  });

  it('computes 50% when half the epochs are present', () => {
    const s = coverageStatistics({
      averagingWindowSize: 0, days: 1, totalCount: 144, totalTmcs: 1,
      interstateCount: 0, interstateTmcs: 0, nonInterstateCount: 0, nonInterstateTmcs: 0,
      extendedCount: 0, extendedTmcs: 0,
    });
    expect(s.total).toBeCloseTo(50, 6);
  });

  it('uses 24 epochs/day for hourly (averagingWindowSize 60)', () => {
    const s = coverageStatistics({
      averagingWindowSize: 60, days: 1, totalCount: 24, totalTmcs: 1,
      interstateCount: 0, interstateTmcs: 0, nonInterstateCount: 0, nonInterstateTmcs: 0,
      extendedCount: 0, extendedTmcs: 0,
    });
    expect(s.total).toBeCloseTo(100, 6);
  });

  it('guards against divide-by-zero (group with no TMCs -> 0%, not NaN)', () => {
    const s = coverageStatistics({
      averagingWindowSize: 0, days: 1, totalCount: 0, totalTmcs: 0,
      interstateCount: 0, interstateTmcs: 0, nonInterstateCount: 0, nonInterstateTmcs: 0,
      extendedCount: 0, extendedTmcs: 0,
    });
    expect(s.total).toBe(0);
    expect(s.interstate_percentage).toBe(0);
    expect(Number.isNaN(s.total)).toBe(false);
  });
});
