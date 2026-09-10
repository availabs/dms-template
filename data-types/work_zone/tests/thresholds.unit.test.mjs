/**
 * Unit tests for work_zone threshold resolution.
 *
 * Thresholds are the one piece of config that changes what every published
 * number MEANS, and they arrive from an HTML form or a schedule descriptor —
 * so the contract under test is: defaults when unset, coercion of form
 * strings, and a loud failure (never a silent fallback) on anything wrong.
 *
 * Pure module: no DB, no CH, no network.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_THRESHOLDS,
  THRESHOLD_SPECS,
  THRESHOLD_NAMES,
  resolveThresholds,
  isDefaultThresholds,
} from '../lib/thresholds.js';

describe('defaults', () => {
  it('are the values recommended in the report', () => {
    expect(DEFAULT_THRESHOLDS).toEqual({
      speed_threshold_mph: 35,
      reference_speed_pct: 60,
      queue_speed_mph: 35,
      queue_threshold_mi: 0.75,
      delay_per_veh_min: 10,
      differential_mph: 15,
    });
  });

  it('apply when nothing is passed', () => {
    expect(resolveThresholds()).toEqual(DEFAULT_THRESHOLDS);
    expect(resolveThresholds(null)).toEqual(DEFAULT_THRESHOLDS);
    expect(resolveThresholds({})).toEqual(DEFAULT_THRESHOLDS);
  });

  it('every spec names a measure, a unit and a range', () => {
    for (const s of THRESHOLD_SPECS) {
      expect(typeof s.name).toBe('string');
      expect(typeof s.measure).toBe('string');
      expect(typeof s.unit).toBe('string');
      expect(s.min).toBeLessThan(s.max);
      expect(s.default).toBeGreaterThanOrEqual(s.min);
      expect(s.default).toBeLessThanOrEqual(s.max);
      expect(s.desc.length).toBeGreaterThan(20);
    }
    expect(THRESHOLD_NAMES).toEqual(Object.keys(DEFAULT_THRESHOLDS));
  });
});

describe('overrides', () => {
  it('merge over the defaults, leaving the rest alone', () => {
    expect(resolveThresholds({ speed_threshold_mph: 45 })).toEqual({
      ...DEFAULT_THRESHOLDS,
      speed_threshold_mph: 45,
    });
  });

  it('coerce numeric strings from a form body', () => {
    const t = resolveThresholds({ speed_threshold_mph: '45', queue_threshold_mi: ' 1.5 ' });
    expect(t.speed_threshold_mph).toBe(45);
    expect(t.queue_threshold_mi).toBe(1.5);
  });

  it('treat an empty string as "not set" (an untouched form field)', () => {
    expect(resolveThresholds({ speed_threshold_mph: '', differential_mph: null }))
      .toEqual(DEFAULT_THRESHOLDS);
  });

  it('accept the two ends of each documented range', () => {
    for (const s of THRESHOLD_SPECS) {
      expect(resolveThresholds({ [s.name]: s.min })[s.name]).toBe(s.min);
      expect(resolveThresholds({ [s.name]: s.max })[s.name]).toBe(s.max);
    }
  });

  it('do not mutate or alias the defaults', () => {
    const t = resolveThresholds({ speed_threshold_mph: 45 });
    expect(DEFAULT_THRESHOLDS.speed_threshold_mph).toBe(35);
    expect(() => { t.speed_threshold_mph = 1; }).toThrow();
  });
});

describe('rejections', () => {
  it('rejects an unknown threshold rather than silently ignoring it', () => {
    // A typo that fell through to the default would publish a view whose
    // metadata claims a threshold that never applied.
    expect(() => resolveThresholds({ speed_threshhold_mph: 45 })).toThrow(/unknown threshold/);
  });

  it('rejects a non-numeric value', () => {
    expect(() => resolveThresholds({ speed_threshold_mph: 'fast' })).toThrow(/finite number/);
    expect(() => resolveThresholds({ speed_threshold_mph: NaN })).toThrow(/finite number/);
    expect(() => resolveThresholds({ speed_threshold_mph: Infinity })).toThrow(/finite number/);
    expect(() => resolveThresholds({ speed_threshold_mph: true })).toThrow(/finite number/);
  });

  it('rejects an out-of-range value (the 350-for-35 typo)', () => {
    expect(() => resolveThresholds({ speed_threshold_mph: 350 })).toThrow(/between 1 and 85 mph/);
    expect(() => resolveThresholds({ reference_speed_pct: 0 })).toThrow(/between 1 and 100/);
    expect(() => resolveThresholds({ queue_threshold_mi: -1 })).toThrow(/between/);
  });

  it('rejects a non-object', () => {
    expect(() => resolveThresholds('35')).toThrow(/expected an object/);
    expect(() => resolveThresholds([35])).toThrow(/expected an object/);
  });

  it('reports every problem at once, not just the first', () => {
    try {
      resolveThresholds({ speed_threshold_mph: 350, queue_speed_mph: 'x', nope: 1 });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.message).toMatch(/speed_threshold_mph/);
      expect(err.message).toMatch(/queue_speed_mph/);
      expect(err.message).toMatch(/nope/);
    }
  });
});

describe('isDefaultThresholds', () => {
  it('is true for the resolved defaults and false once anything is overridden', () => {
    expect(isDefaultThresholds(resolveThresholds())).toBe(true);
    expect(isDefaultThresholds(resolveThresholds({ differential_mph: 20 }))).toBe(false);
  });
});
