/**
 * Unit tests for the shared class-weighted value-of-time helper
 * (data-types/_shared/vot_rates.js). Lives under excessive_delay/tests because
 * run-tests.js skips `_`-prefixed dirs when discovering vitest files; this
 * plugin is the helper's primary consumer.
 *
 * Methodology: per-vehicle VOT (occupancy already bundled), class-weighted by
 * the per-TMC AADT split. See planning/transportny/tasks/current/class-weighted-vot-cost.md.
 */
import { describe, it, expect } from 'vitest';
import * as vot from '../../_shared/vot_rates.js';

describe('VOT_RATES v1 constants', () => {
  it('codifies the adopted 2024-25 dated rates', () => {
    expect(vot.CURRENT).toBe('v1');
    const r = vot.VOT_RATES.v1;
    expect(r.passenger).toBe(52);
    expect(r.single_unit).toBe(42);
    expect(r.combination).toBe(77);
    expect(r.year).toBe('2024-25');
    // network-blend fallback sits in the documented $50–55 band
    expect(r.network_blend).toBeGreaterThanOrEqual(50);
    expect(r.network_blend).toBeLessThanOrEqual(55);
  });
});

describe('votEff (class-weighted $/veh-hr per TMC)', () => {
  it('all-passenger TMC → passenger rate', () => {
    expect(vot.votEff({ aadt: 1000, aadt_singl: 0, aadt_combi: 0 })).toBeCloseTo(52, 6);
  });

  it('all-combination TMC → combination rate', () => {
    expect(vot.votEff({ aadt: 1000, aadt_singl: 0, aadt_combi: 1000 })).toBeCloseTo(77, 6);
  });

  it('blends classes by AADT share', () => {
    // 800 pass, 100 singl, 100 combi of 1000
    // 0.8*52 + 0.1*42 + 0.1*77 = 41.6 + 4.2 + 7.7 = 53.5
    expect(vot.votEff({ aadt: 1000, aadt_singl: 100, aadt_combi: 100 })).toBeCloseTo(53.5, 6);
  });

  it('a freight corridor (15% combi, 5% singl) lands in the $58–62 band', () => {
    const v = vot.votEff({ aadt: 1000, aadt_singl: 50, aadt_combi: 150 });
    // 0.8*52 + 0.05*42 + 0.15*77 = 41.6 + 2.1 + 11.55 = 55.25  → still > flat $20
    expect(v).toBeGreaterThan(50);
    expect(v).toBeLessThan(62);
  });

  it('falls back to the network blend when aadt is 0/NULL/invalid (never drops)', () => {
    const blend = vot.VOT_RATES.v1.network_blend;
    expect(vot.votEff({ aadt: 0, aadt_singl: 0, aadt_combi: 0 })).toBe(blend);
    expect(vot.votEff({ aadt: null, aadt_singl: 10, aadt_combi: 10 })).toBe(blend);
    expect(vot.votEff({ aadt: undefined })).toBe(blend);
    expect(vot.votEff({ aadt: 'not-a-number', aadt_singl: 1, aadt_combi: 1 })).toBe(blend);
    expect(vot.votEff({})).toBe(blend);
  });

  it('treats missing/NULL class columns as zero trucks (all-passenger)', () => {
    expect(vot.votEff({ aadt: 1000 })).toBeCloseTo(52, 6);
    expect(vot.votEff({ aadt: 1000, aadt_singl: null, aadt_combi: null })).toBeCloseTo(52, 6);
  });

  it('clamps a malformed split (trucks > total) to the network blend rather than emitting nonsense', () => {
    // negative passenger share would push VOT below any class rate — refuse it
    const v = vot.votEff({ aadt: 100, aadt_singl: 80, aadt_combi: 80 });
    expect(v).toBe(vot.VOT_RATES.v1.network_blend);
  });
});
