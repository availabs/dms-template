/**
 * Unit tests for M2 — work-zone delay.
 *
 * The one that matters most is the anchor/impact rule. Phases 2 and 3 filter a
 * zone's TMCs to `anchor`; M2 must not, because 91.4% of a work zone's delay
 * accrues on the `impact` segments downstream. Copying the earlier phases'
 * filter forward produces a number 11x too small and entirely plausible-looking,
 * so it is pinned here.
 *
 * Pure module: no DB, no CH, no network.
 */
import { describe, it, expect } from 'vitest';
import { MINUTES_PER_HOUR, delayForZone, rollupDelay, delayShare } from '../lib/delay.js';

const ROWS = [
  { tmc: 'A', tmc_role: 'anchor', delay: 2.0, raw_delay: 2.0 },
  { tmc: 'B', tmc_role: 'impact', delay: 12.0, raw_delay: 9.0 },
  { tmc: 'C', tmc_role: 'impact', delay: 6.0, raw_delay: 5.0 },
];

describe('delayForZone counts ALL roles, not anchors only', () => {
  const z = delayForZone(ROWS);

  it('totals every role', () => {
    // 2 + 12 + 6. An anchors-only rollup would give 2.
    expect(z.delay_vehicle_hours).toBe(20);
  });

  it('keeps the anchor/impact split visible on the row', () => {
    expect(z.delay_anchor).toBe(2);
    expect(z.delay_impact).toBe(18);
    expect(z.delay_anchor + z.delay_impact).toBe(z.delay_vehicle_hours);
  });

  it('reports the impact share, because it is normally ~91%', () => {
    expect(z.delay_impact_share).toBeCloseTo(0.9, 4);
  });

  it('counts anchor TMCs separately from all TMCs', () => {
    expect(z.n_delay_tmcs).toBe(3);
    expect(z.n_delay_tmcs_anchor).toBe(1);
  });
});

describe('the two delay columns', () => {
  it('rolls up both', () => {
    const z = delayForZone(ROWS);
    expect(z.delay_vehicle_hours).toBe(20);
    expect(z.raw_delay_vehicle_hours).toBe(16);
  });

  it('treats a missing delay as a GAP, not a zero', () => {
    // 2,705 CY2024 rows have delay NULL with raw_delay present. Counting those
    // as 0 would understate the total and hide the gap.
    const z = delayForZone([
      { tmc: 'A', tmc_role: 'anchor', delay: null, raw_delay: 3.0 },
      { tmc: 'B', tmc_role: 'impact', delay: 5.0, raw_delay: 4.0 },
    ]);
    expect(z.delay_vehicle_hours).toBe(5);
    expect(z.raw_delay_vehicle_hours).toBe(7);
    expect(z.rows_delay_missing).toBe(1);
    expect(z.delay_complete).toBe(false);
  });

  it('is complete only when every row had a delay', () => {
    expect(delayForZone(ROWS).delay_complete).toBe(true);
    expect(delayForZone([]).delay_complete).toBe(false);
  });
});

describe('delay per vehicle', () => {
  it('converts vehicle-hours to minutes per vehicle', () => {
    // 20 veh-hrs over 1,200 vehicles = 1 minute each.
    const z = delayForZone(ROWS, { veh_through_wz: 1200, delay_per_veh_min: 10 });
    expect(MINUTES_PER_HOUR).toBe(60);
    expect(z.delay_per_vehicle_min).toBeCloseTo(1.0, 3);
    expect(z.exceeds_delay_per_vehicle).toBe(false);
  });

  it('flags a zone over the threshold', () => {
    const z = delayForZone(ROWS, { veh_through_wz: 60, delay_per_veh_min: 10 });
    expect(z.delay_per_vehicle_min).toBeCloseTo(20, 3);
    expect(z.exceeds_delay_per_vehicle).toBe(true);
  });

  it('is NULL, not zero, when the vehicle count is unknown', () => {
    // Phase 2 cannot compute a vehicle count for every zone. Publishing 0 would
    // read as "no delay per vehicle" rather than "not known".
    for (const v of [null, undefined, 0, '']) {
      const z = delayForZone(ROWS, { veh_through_wz: v, delay_per_veh_min: 10 });
      expect(z.delay_per_vehicle_min).toBeNull();
      expect(z.exceeds_delay_per_vehicle).toBeNull();
    }
  });

  it('does not flag when no threshold was supplied', () => {
    const z = delayForZone(ROWS, { veh_through_wz: 60 });
    expect(z.delay_per_vehicle_min).toBeCloseTo(20, 3);
    expect(z.exceeds_delay_per_vehicle).toBeNull();
  });
});

describe('rollupDelay', () => {
  const zones = [
    { delay_vehicle_hours: 1000, raw_delay_vehicle_hours: 800, delay_anchor: 100,
      delay_impact: 900, veh_through_wz: 600000, delay_per_vehicle_min: 0.1,
      exceeds_delay_per_vehicle: false, rows_delay_missing: 0 },
    { delay_vehicle_hours: 20, raw_delay_vehicle_hours: 18, delay_anchor: 2,
      delay_impact: 18, veh_through_wz: 60, delay_per_vehicle_min: 20,
      exceeds_delay_per_vehicle: true, rows_delay_missing: 1 },
  ];
  const r = rollupDelay(zones);

  it('sums vehicle-hours', () => {
    expect(r.delay_vehicle_hours).toBe(1020);
    expect(r.delay_anchor).toBe(102);
    expect(r.delay_impact).toBe(918);
    expect(r.delay_impact_share).toBeCloseTo(0.9, 3);
  });

  it('weights the per-vehicle figure by exposure, not by zone', () => {
    // Total delay over total vehicles: 1020 veh-hrs * 60 / 600,060 vehicles.
    expect(r.delay_per_vehicle_min).toBeCloseTo(1020 * 60 / 600060, 3);
    // The unweighted mean of the two rates is 10.05 -- an order of magnitude
    // different, because it lets a 60-vehicle zone outvote a 600,000-vehicle one.
    expect(r.delay_per_vehicle_min_zone_mean).toBeCloseTo(10.05, 2);
    expect(r.delay_per_vehicle_min).toBeLessThan(r.delay_per_vehicle_min_zone_mean);
  });

  it('counts zones over the threshold and zones with no rate', () => {
    expect(r.zones_exceeding_per_vehicle).toBe(1);
    expect(r.zones).toBe(2);
    expect(r.zones_with_delay).toBe(2);
    expect(r.rows_delay_missing).toBe(1);
  });

  it('returns nulls on an empty set', () => {
    const e = rollupDelay([]);
    expect(e.zones).toBe(0);
    expect(e.delay_per_vehicle_min).toBeNull();
  });
});

describe('delayShare', () => {
  // Measured CY2024: WZ 40.74 M, all excessive delay 277.06 M, construction
  // bucket 40.31 M.
  const s = delayShare({ wzDelay: 40.74e6, total: 277.06e6, construction: 40.31e6 });

  it('reports work-zone delay as a share of all delay', () => {
    expect(s.share_of_all_delay).toBeCloseTo(0.147, 3);
  });

  it('reports the construction ratio as a consistency check near 1', () => {
    // Two datasets attributing delay independently; a ratio near 1 says they agree.
    expect(s.ratio_to_construction_bucket).toBeCloseTo(1.011, 3);
  });

  it('is null rather than infinite when a denominator is missing', () => {
    const z = delayShare({ wzDelay: 100, total: 0, construction: null });
    expect(z.share_of_all_delay).toBeNull();
    expect(z.ratio_to_construction_bucket).toBeNull();
  });
});

describe('regressions found by the integration test', () => {
  it('a null per-vehicle rate does not drag the zone mean toward zero', () => {
    // `Number(null)` is 0 and 0 is finite, so a naive isFinite filter admitted
    // null rates and averaged them in as zeros.
    const r = rollupDelay([
      { delay_vehicle_hours: 100, veh_through_wz: null, delay_per_vehicle_min: null },
      { delay_vehicle_hours: 100, veh_through_wz: 600, delay_per_vehicle_min: 10 },
    ]);
    expect(r.delay_per_vehicle_min_zone_mean).toBeCloseTo(10, 6);
  });

  it('returns a null zone mean when NO zone has a rate', () => {
    const r = rollupDelay([
      { delay_vehicle_hours: 100, veh_through_wz: null, delay_per_vehicle_min: null },
    ]);
    expect(r.delay_per_vehicle_min_zone_mean).toBeNull();
  });

  it('keeps enough precision that a small share is not rounded to zero', () => {
    // Rounding shares to 4dp turned 1000/277,060,000 into exactly 0, which reads
    // as "no work-zone delay" rather than "a small share".
    const s = delayShare({ wzDelay: 1000, total: 277060000, construction: 40310000 });
    expect(s.share_of_all_delay).toBeGreaterThan(0);
    expect(s.share_of_all_delay).toBeCloseTo(1000 / 277060000, 8);
  });

  it('still rounds vehicle-hour totals to 4dp', () => {
    const s = delayShare({ wzDelay: 40.7412345678e6, total: 277.06e6, construction: 40.31e6 });
    expect(s.wz_delay_vehicle_hours).toBe(40741234.5678);
  });

  it('treats an empty-string denominator as missing, not as zero', () => {
    const s = delayShare({ wzDelay: 100, total: '', construction: undefined });
    expect(s.share_of_all_delay).toBeNull();
    expect(s.ratio_to_construction_bucket).toBeNull();
  });
});

describe('unknown delay is published as unknown, not as zero', () => {
  // The pipeline's rule since phase 2. It matters at two scales: 17,616 of
  // CY2024's 42,688 zones have no TRANSCOM conflation row, and CY2019/CY2020
  // have none at all -- those vintages were reporting a confident 0.
  it('a zone with no delay rows has NULL delay', () => {
    const z = delayForZone([]);
    expect(z.delay_vehicle_hours).toBeNull();
    expect(z.delay_anchor).toBeNull();
    expect(z.delay_impact).toBeNull();
    expect(z.delay_measured).toBe(false);
  });

  it('a zone whose every row had a null delay has NULL delay', () => {
    const z = delayForZone([{ tmc: 'A', tmc_role: 'anchor', delay: null, raw_delay: 2 }]);
    expect(z.delay_vehicle_hours).toBeNull();
    expect(z.delay_measured).toBe(false);
    // raw_delay was present, so it is still reported.
    expect(z.raw_delay_vehicle_hours).toBe(2);
  });

  it('a genuine zero stays zero', () => {
    // A conflated row that really recorded no delay is a measurement.
    const z = delayForZone([{ tmc: 'A', tmc_role: 'anchor', delay: 0, raw_delay: 0 }]);
    expect(z.delay_vehicle_hours).toBe(0);
    expect(z.delay_measured).toBe(true);
  });

  it('a rollup over only-unmeasured zones is NULL, not 0', () => {
    const r = rollupDelay([delayForZone([]), delayForZone([])]);
    expect(r.delay_vehicle_hours).toBeNull();
    expect(r.delay_per_vehicle_min).toBeNull();
    expect(r.zones_delay_unknown).toBe(2);
    expect(r.zones_measured).toBe(0);
  });

  it('unmeasured zones do not dilute the per-vehicle rate', () => {
    // Their vehicles must not enter the denominator, or a zone with traffic but
    // no delay data would understate the statewide rate.
    const r = rollupDelay([
      { delay_measured: true, delay_vehicle_hours: 100, veh_through_wz: 600, delay_per_vehicle_min: 10 },
      { delay_measured: false, delay_vehicle_hours: null, veh_through_wz: 999999, delay_per_vehicle_min: null },
    ]);
    expect(r.delay_per_vehicle_min).toBeCloseTo(100 * 60 / 600, 6);
    expect(r.zones_delay_unknown).toBe(1);
  });
});
