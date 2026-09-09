/**
 * Unit tests for work_zone exposure (E1–E3).
 *
 * The arithmetic is checkable by hand on purpose: a 2-TMC, 6-hour zone whose
 * lane-mile-hours and VMT can be verified with a calculator. The behaviours
 * that matter beyond the maths: a missing input yields NULL and not zero, the
 * duration cap actually bites, the nominal variant is always available, and
 * unidirectional AADT is preferred but not required.
 */
import { describe, it, expect } from 'vitest';
import {
  DURATION_BASES, DEFAULT_DURATION_BASIS, DEFAULT_DURATION_CAP_DAYS, DEFAULT_NOMINAL_SHIFT_HOURS,
  functionalClassOf, selectProfile, vehiclesOnDay, activeHours, computeExposure,
} from '../lib/exposure.js';
import DOW from '../../map21/static/TrafficDistributionDowAdjustmentFactors.js';
import MONTH from '../../map21/static/TrafficDistributionMonthAdjustmentFactors.js';
import PROFILES from '../../map21/static/CATTLabTrafficDistributionProfiles.js';

/** A weekday-only zone: 2024-06-03 is a Monday, so days 1-3 are Mon/Tue/Wed. */
const zone = (over = {}) => ({
  wz_event_id: 'Z1',
  first_start: '2024-06-03T21:00:00Z',
  active_days: 3,
  active_hours: 18,          // 6 hours per active day
  n_occurrences: 3,
  lanes_affected: 2,
  lanes_affected_known: true,
  ...over,
});

const tmc = (over = {}) => ({
  tmc: 'T1', length: 0.5, aadt: 40000, aadt_unidir: 20000, f_system: 1,
  congestion_level: 'MODERATE_CONGESTION', directionality: 'EVEN_DIST', ...over,
});

describe('functionalClassOf', () => {
  it('is FREEWAY for f_system 1 and 2, NONFREEWAY above', () => {
    expect(functionalClassOf(1)).toBe('FREEWAY');
    expect(functionalClassOf(2)).toBe('FREEWAY');
    expect(functionalClassOf(3)).toBe('NONFREEWAY');
    expect(functionalClassOf(7)).toBe('NONFREEWAY');
  });
  it('is null when unknown, so a profile is never guessed', () => {
    expect(functionalClassOf(null)).toBeNull();
    expect(functionalClassOf('')).toBeNull();
  });
});

describe('selectProfile', () => {
  it('builds the MAP-21 weekday profile name from the meta values verbatim', () => {
    expect(selectProfile({ dayType: 'WEEKDAY', congestionLevel: 'SEVERE_CONGESTION', directionality: 'PM_PEAK', fSystem: 1 }).name)
      .toBe('WEEKDAY_SEVERE_CONGESTION_PM_PEAK_FREEWAY');
    expect(selectProfile({ dayType: 'WEEKDAY', congestionLevel: 'NO2LOW_CONGESTION', directionality: 'EVEN_DIST', fSystem: 4 }).name)
      .toBe('WEEKDAY_NO2LOW_CONGESTION_EVEN_DIST_NONFREEWAY');
  });
  it('drops congestion and peak on weekends, as the MAP-21 selector does', () => {
    expect(selectProfile({ dayType: 'WEEKEND', fSystem: 1 }).name).toBe('WEEKEND_FREEWAY');
    expect(selectProfile({ dayType: 'WEEKEND', fSystem: 5 }).name).toBe('WEEKEND_NONFREEWAY');
  });
  it('returns 24 shares summing to 1', () => {
    const { hourly } = selectProfile({ dayType: 'WEEKEND', fSystem: 1 });
    expect(hourly).toHaveLength(24);
    expect(hourly.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
  });
  it('returns null rather than a default when the TMC cannot choose one', () => {
    expect(selectProfile({ dayType: 'WEEKDAY', fSystem: 1 })).toBeNull();               // no congestion/peak
    expect(selectProfile({ dayType: 'WEEKDAY', congestionLevel: 'MODERATE_CONGESTION', directionality: 'EVEN_DIST', fSystem: null })).toBeNull();
  });
});

describe('vehiclesOnDay', () => {
  it('applies the month and day-of-week factors before the hourly profile', () => {
    const date = new Date('2024-06-05T00:00:00Z');   // Wednesday, June
    const hourly = PROFILES.WEEKDAY_MODERATE_CONGESTION_EVEN_DIST_FREEWAY;
    const all = vehiclesOnDay({ aadt: 10000, date, hourly });
    expect(all).toBeCloseTo(10000 * MONTH[5] * DOW[3], 6);
  });
  it('counts only the hours asked for', () => {
    const date = new Date('2024-06-05T00:00:00Z');
    const hourly = PROFILES.WEEKDAY_MODERATE_CONGESTION_EVEN_DIST_FREEWAY;
    const two = vehiclesOnDay({ aadt: 10000, date, hourly, hours: [8, 9] });
    expect(two).toBeCloseTo(10000 * MONTH[5] * DOW[3] * (hourly[8] + hourly[9]), 6);
  });
});

describe('activeHours', () => {
  it('defaults to the capped basis', () => {
    expect(DEFAULT_DURATION_BASIS).toBe('reported_capped');
    expect(DURATION_BASES).toEqual(['reported_capped', 'reported', 'nominal_shift']);
    expect(DEFAULT_DURATION_CAP_DAYS).toBe(30);
    expect(DEFAULT_NOMINAL_SHIFT_HOURS).toBe(8);
  });
  it('passes a plausible reported duration through untouched', () => {
    expect(activeHours(zone())).toEqual({ hours: 18, basis: 'reported_capped', capped_occurrences: 0 });
  });
  it('caps a never-closed record — the 2-year single event phase 1 found', () => {
    const runaway = zone({ active_hours: 1051059 / 60, n_occurrences: 1, active_days: 1 });
    const capped = activeHours(runaway);
    expect(capped.hours).toBe(30 * 24);
    expect(capped.capped_occurrences).toBe(1);
    // and the uncapped basis still reports it, for comparison
    expect(activeHours(runaway, { durationBasis: 'reported' }).hours).toBeCloseTo(17517.65, 1);
  });
  it('caps per occurrence, so a long chain of normal nights is not penalised', () => {
    const long = zone({ n_occurrences: 60, active_days: 60, active_hours: 60 * 8 });
    expect(activeHours(long).hours).toBe(480);
    expect(activeHours(long).capped_occurrences).toBe(0);
  });
  it('uses per-occurrence durations when the caller has them', () => {
    const z = zone({ occurrence_hours: [8, 8, 1000000] });
    const r = activeHours(z);
    expect(r.hours).toBe(8 + 8 + 30 * 24);
    expect(r.capped_occurrences).toBe(1);
  });
  it('ignores reported duration entirely on the nominal basis', () => {
    expect(activeHours(zone({ active_hours: 999999 }), { durationBasis: 'nominal_shift' }).hours).toBe(24);
    expect(activeHours(zone({ active_hours: null }), { durationBasis: 'nominal_shift' }).hours).toBe(24);
  });
  it('honours a caller-supplied cap and shift', () => {
    expect(activeHours(zone({ active_hours: 100, n_occurrences: 1 }), { durationCapDays: 1 }).hours).toBe(24);
    expect(activeHours(zone(), { durationBasis: 'nominal_shift', nominalShiftHours: 12 }).hours).toBe(36);
  });
  it('reports unknown duration as null, not zero', () => {
    expect(activeHours(zone({ active_hours: null })).hours).toBeNull();
  });
  it('rejects an unknown basis', () => {
    expect(() => activeHours(zone(), { durationBasis: 'vibes' })).toThrow(/unknown duration basis/);
  });
});

describe('computeExposure — the hand-checkable case', () => {
  // 2 TMCs of 0.5 mi each = 1.0 mi extent; 2 lanes affected; 3 active days at
  // 6 hours each = 18 hours.  E2 = 2 × 1.0 × 18 = 36 lane-mile-hours.
  const tmcs = [tmc({ tmc: 'T1' }), tmc({ tmc: 'T2' })];

  it('computes lane-mile-hours as lanes × extent × hours', () => {
    const e = computeExposure(zone(), tmcs);
    expect(e.length_mi).toBe(1);
    expect(e.active_hours_used).toBe(18);
    expect(e.hours_per_active_day).toBe(6);
    expect(e.lane_mile_hours).toBe(36);
  });

  it('computes the nominal variant alongside, always', () => {
    const e = computeExposure(zone(), tmcs);
    expect(e.active_hours_nominal).toBe(24);          // 3 days × 8h
    expect(e.lane_mile_hours_nominal).toBe(48);       // 2 × 1.0 × 24
  });

  it('computes vehicles from AADT × factors × profile × the active share of each day', () => {
    const e = computeExposure(zone(), tmcs);
    const hourly = PROFILES.WEEKDAY_MODERATE_CONGESTION_EVEN_DIST_FREEWAY;
    // Mon 3rd, Tue 4th, Wed 5th June 2024; 20,000 unidirectional AADT; 6/24 of each day
    let expected = 0;
    for (const [dayOfMonth, dow] of [[3, 1], [4, 2], [5, 3]]) {
      void dayOfMonth;
      expected += 20000 * MONTH[5] * DOW[dow] * 1 * (6 / 24);
    }
    expected *= 2;   // two TMCs
    expect(e.veh_through_wz).toBeCloseTo(Math.round(expected), 0);
    void hourly;
  });

  it('computes VMT as vehicles × length', () => {
    const e = computeExposure(zone(), tmcs);
    expect(e.vmt_through_wz).toBeCloseTo(e.veh_through_wz * 0.5, 0);
  });

  it('prefers unidirectional AADT and says so', () => {
    const e = computeExposure(zone(), tmcs);
    expect(e.aadt_source).toBe('unidirectional');
    const bidir = computeExposure(zone(), [tmc({ aadt_unidir: null })]);
    expect(bidir.aadt_source).toBe('bidirectional');
    const mixed = computeExposure(zone(), [tmc({ tmc: 'A' }), tmc({ tmc: 'B', aadt_unidir: null })]);
    expect(mixed.aadt_source).toBe('mixed');
  });

  it('honours preferUnidirectionalAadt: false', () => {
    const uni = computeExposure(zone(), [tmc()]);
    const bi = computeExposure(zone(), [tmc()], { preferUnidirectionalAadt: false });
    expect(bi.veh_through_wz).toBeCloseTo(uni.veh_through_wz * 2, 0);
    expect(bi.aadt_source).toBe('bidirectional');
  });
});

describe('computeExposure — missing inputs are NULL, never zero', () => {
  it('has no E2 without a lane count', () => {
    const e = computeExposure(zone({ lanes_affected: null, lanes_affected_known: false }), [tmc()]);
    expect(e.lane_closure_count).toBeNull();
    expect(e.lane_count_known).toBe(false);
    expect(e.lane_mile_hours).toBeNull();
    expect(e.exposure_complete).toBe(false);
    // E3 does not depend on lanes, so it still computes
    expect(e.veh_through_wz).toBeGreaterThan(0);
  });

  it('has no E3 without AADT — the 20% of zones phase 2 measured', () => {
    // one TMC → a 0.5-mile extent, so E2 here is 2 lanes × 0.5 mi × 18 h = 18
    const e = computeExposure(zone(), [tmc({ aadt: null, aadt_unidir: null })]);
    expect(e.veh_through_wz).toBeNull();
    expect(e.vmt_through_wz).toBeNull();
    expect(e.n_tmcs_with_aadt).toBe(0);
    expect(e.aadt_source).toBeNull();
    expect(e.exposure_complete).toBe(false);
    // E2 does not depend on AADT, so it still computes
    expect(e.lane_mile_hours).toBe(18);
  });

  it('has neither without an anchor TMC', () => {
    const e = computeExposure(zone(), []);
    expect(e.n_anchor_tmcs).toBe(0);
    expect(e.lane_mile_hours).toBeNull();
    expect(e.vmt_through_wz).toBeNull();
    expect(e.exposure_complete).toBe(false);
  });

  it('has no E3 when the TMC cannot choose a volume profile', () => {
    const e = computeExposure(zone(), [tmc({ congestion_level: null, directionality: null })]);
    expect(e.veh_through_wz).toBeNull();
    expect(e.profile_name).toBeNull();
  });

  it('counts partial coverage honestly across TMCs', () => {
    const e = computeExposure(zone(), [tmc({ tmc: 'A' }), tmc({ tmc: 'B', aadt: null, aadt_unidir: null })]);
    expect(e.n_anchor_tmcs).toBe(2);
    expect(e.n_tmcs_with_aadt).toBe(1);
    expect(e.n_tmcs_with_length).toBe(2);
    expect(e.length_mi).toBe(1);      // extent uses both
    expect(e.veh_through_wz).toBeGreaterThan(0);   // volume uses one
  });

  it('never lets the active share of a day exceed the whole day', () => {
    const e = computeExposure(zone({ active_days: 1, active_hours: 100, n_occurrences: 1 }), [tmc()]);
    expect(e.hours_per_active_day).toBe(24);
  });
});

describe('computeExposure — weekend and month sensitivity', () => {
  it('uses the weekend profile on weekend days', () => {
    // 2024-06-08 is a Saturday
    const e = computeExposure(zone({ first_start: '2024-06-08T21:00:00Z', active_days: 1, active_hours: 6, n_occurrences: 1 }), [tmc()]);
    expect(e.profile_name).toBe('WEEKEND_FREEWAY');
  });
  it('yields less volume in a low-factor month than a high one', () => {
    const jan = computeExposure(zone({ first_start: '2024-01-08T21:00:00Z' }), [tmc()]);
    const jul = computeExposure(zone({ first_start: '2024-07-08T21:00:00Z' }), [tmc()]);
    expect(jul.veh_through_wz).toBeGreaterThan(jan.veh_through_wz);
  });
});
