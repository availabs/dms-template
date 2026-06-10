/**
 * Unit tests for the npmrds directionality / congestion-level calculation.
 *
 * Pure math ported from legacy avail-falcor npmrds/addWorker/helpers.js
 * (calcDirectionality) — peaks, speed conversion, the 6 mph EVEN_DIST band,
 * and the HPMS Table 3.16 speed-reduction-factor congestion thresholds.
 */
import { describe, it, expect } from 'vitest';
import {
  avgTravelTime,
  computeTmcDirectionality,
  FREEWAY,
  NONFREEWAY,
  BINS,
} from '../directionality.js';

describe('BINS (the three reporting windows used for directionality)', () => {
  it('AMP is weekday 6-10am', () => {
    expect(BINS.AMP.hours).toEqual([6, 7, 8, 9]);
    expect(BINS.AMP.dow).toEqual([1, 2, 3, 4, 5]);
  });
  it('PMP is weekday 4-8pm', () => {
    expect(BINS.PMP.hours).toEqual([16, 17, 18, 19]);
    expect(BINS.PMP.dow).toEqual([1, 2, 3, 4, 5]);
  });
  it('FREEFLOW is every day 10pm-5am', () => {
    expect(BINS.FREEFLOW.hours).toEqual([22, 23, 0, 1, 2, 3, 4]);
    expect(BINS.FREEFLOW.dow).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe('avgTravelTime', () => {
  it('averages tt values', () => {
    expect(avgTravelTime([{ tt: 30 }, { tt: 60 }])).toBe(45);
  });
  it('returns 0 for an empty window (legacy reduce semantics → falsy → EVEN_DIST)', () => {
    expect(avgTravelTime([])).toBe(0);
  });
});

describe('computeTmcDirectionality — directionality', () => {
  // 1 mile TMC. tt seconds. speed = miles/tt*3600.
  it('EVEN_DIST when there is no AM data', () => {
    const r = computeTmcDirectionality({
      miles: 1, functionalClass: FREEWAY,
      ampRows: [], pmpRows: [{ tt: 60 }], freeflowRows: [{ tt: 60 }],
    });
    expect(r.directionality).toBe('EVEN_DIST');
  });
  it('EVEN_DIST when AM/PM speeds differ by <= 6 mph', () => {
    // 1 mile: 60s → 60 mph; 66.3s → ~54.3 mph (diff ~5.7)
    const r = computeTmcDirectionality({
      miles: 1, functionalClass: FREEWAY,
      ampRows: [{ tt: 60 }], pmpRows: [{ tt: 66.3 }], freeflowRows: [{ tt: 60 }],
    });
    expect(r.directionality).toBe('EVEN_DIST');
  });
  it('AM_PEAK when the AM speed is slower (congested) by > 6 mph', () => {
    // AM 80s → 45 mph, PM 60s → 60 mph
    const r = computeTmcDirectionality({
      miles: 1, functionalClass: FREEWAY,
      ampRows: [{ tt: 80 }], pmpRows: [{ tt: 60 }], freeflowRows: [{ tt: 55 }],
    });
    expect(r.directionality).toBe('AM_PEAK');
  });
  it('PM_PEAK when the PM speed is slower by > 6 mph', () => {
    const r = computeTmcDirectionality({
      miles: 1, functionalClass: FREEWAY,
      ampRows: [{ tt: 60 }], pmpRows: [{ tt: 80 }], freeflowRows: [{ tt: 55 }],
    });
    expect(r.directionality).toBe('PM_PEAK');
  });
});

describe('computeTmcDirectionality — congestion level (HPMS Table 3.16)', () => {
  // freeflow 36s → 100 mph baseline on a 1-mile TMC; combined peak from am+pm rows.
  const mk = (fc, peakTt) => computeTmcDirectionality({
    miles: 1, functionalClass: fc,
    ampRows: [{ tt: peakTt }], pmpRows: [{ tt: peakTt }], freeflowRows: [{ tt: 36 }],
  });
  it('freeway: srf >= 0.9 → NO2LOW', () => {
    expect(mk(FREEWAY, 40).congestionLevel).toBe('NO2LOW_CONGESTION');   // 90 mph / 100 = .9
  });
  it('freeway: 0.75 <= srf < 0.9 → MODERATE', () => {
    expect(mk(FREEWAY, 45).congestionLevel).toBe('MODERATE_CONGESTION'); // 80/100 = .8
  });
  it('freeway: srf < 0.75 → SEVERE', () => {
    expect(mk(FREEWAY, 72).congestionLevel).toBe('SEVERE_CONGESTION');   // 50/100 = .5
  });
  it('non-freeway: srf >= 0.8 → NO2LOW', () => {
    expect(mk(NONFREEWAY, 45).congestionLevel).toBe('NO2LOW_CONGESTION');  // .8
  });
  it('non-freeway: 0.65 <= srf < 0.8 → MODERATE', () => {
    expect(mk(NONFREEWAY, 51).congestionLevel).toBe('MODERATE_CONGESTION'); // ~.706
  });
  it('non-freeway: srf < 0.65 → SEVERE', () => {
    expect(mk(NONFREEWAY, 72).congestionLevel).toBe('SEVERE_CONGESTION');  // .5
  });
  it('falsy srf (no peak data at all) → NO2LOW', () => {
    const r = computeTmcDirectionality({
      miles: 1, functionalClass: FREEWAY,
      ampRows: [], pmpRows: [], freeflowRows: [{ tt: 36 }],
    });
    expect(r.congestionLevel).toBe('NO2LOW_CONGESTION');
    expect(r.directionality).toBe('EVEN_DIST');
  });
});
