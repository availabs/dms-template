/**
 * Unit tests for M1 as the rule defines it.
 *
 * The measure is "percent of active work-zone HOURS in which the AVERAGE SPEED
 * WITHIN THE WORK ZONE falls below the threshold". The first implementation of
 * this phase reported the share of five-minute epochs on individual segments
 * instead — a different numerator and a different spatial unit, which is a
 * different number. These tests pin the definition so that cannot recur.
 */
import { describe, it, expect } from 'vitest';
import {
  EPOCHS_PER_HOUR,
  DEFAULT_MIN_EPOCHS_PER_HOUR,
  zoneSpeedExpr,
  zoneHourM1SQL,
  rollupZoneM1,
  rollupZoneM1ByTier,
} from '../lib/m1.js';

const args = {
  speedTable: 'npmrds.speeds', tmcTable: 'npmrds._wz_tmc', activeTable: 'npmrds._wz_active',
  windowStart: '2024-01-01', windowEnd: '2024-12-31',
};

describe('the zone speed is a space-mean, not a mean of speeds', () => {
  it('is total distance over total travel time', () => {
    const e = zoneSpeedExpr();
    expect(e).toContain('sum(m.miles) * 3600 / sum(n.travel_time_all_vehicles)');
  });

  it('guards a zero total travel time rather than dividing by it', () => {
    expect(zoneSpeedExpr()).toContain('if(sum(n.travel_time_all_vehicles) > 0');
  });

  it('does NOT average per-segment speeds', () => {
    // avg(miles*3600/tt) over segments would over-weight short segments: a
    // 0.05-mile segment crawling at 5 mph would count as much as a 2-mile
    // segment at free flow. The space-mean weights by distance travelled.
    const e = zoneSpeedExpr();
    expect(e).not.toMatch(/avg\(/);
  });
});

describe('zoneHourM1SQL groups by the hour, not the epoch', () => {
  const q = zoneHourM1SQL(args);

  it('classifies one row per (zone, date, hour)', () => {
    expect(q).toContain('GROUP BY wz_event_id, date, hour');
    expect(q).toContain(`intDiv(n.epoch, ${EPOCHS_PER_HOUR}) AS hour`);
  });

  it('counts hours, not epochs, in every measure', () => {
    for (const col of ['active_hours_measured', 'hours_below_posted',
                       'hours_below_absolute', 'hours_below_relative']) {
      expect(q).toContain(col);
    }
    // The giveaway of the old, wrong shape:
    expect(q).not.toContain('epochs_below_posted');
  });

  it('requires half an hour of observation before classifying it', () => {
    expect(DEFAULT_MIN_EPOCHS_PER_HOUR).toBe(6);
    expect(q).toContain('uniqExact(n.epoch) AS epochs_in_hour');
    expect(q).toMatch(/epochs_in_hour >= 6/);
    // and reports what it refused to classify
    expect(q).toContain('hours_too_sparse');
  });

  it('length-weights the zone threshold across its segments', () => {
    expect(q).toContain('sum(m.miles * m.posted_speed_limit) / nullIf(sum(m.miles), 0)');
    expect(q).toContain('sum(m.miles * m.reference_speed) / nullIf(sum(m.miles), 0)');
  });

  it('applies the floor AFTER the length weighting', () => {
    // Averaging thresholds that were already floored would smear the floor
    // across the zone. The limit is averaged, then floored.
    expect(q).toMatch(/greatest\(20, any\(t\.zone_posted_limit\) - 10\)/);
    expect(q).toMatch(/least\(any\(t\.zone_posted_limit\)/);
  });

  it('keeps the huge speed table on the LEFT of every join', () => {
    expect(q).toMatch(/FROM npmrds\.speeds n\s*\n\s*INNER JOIN npmrds\._wz_active a/);
  });

  it('bounds the date range and treats the epoch window as half-open', () => {
    expect(q).toContain("n.date >= toDate('2024-01-01')");
    expect(q).toContain('n.epoch >= a.epoch_from AND n.epoch < a.epoch_to');
  });

  it('requires a window', () => {
    expect(() => zoneHourM1SQL({ ...args, windowStart: null })).toThrow(/windowStart/);
  });

  it('takes the thresholds as parameters', () => {
    const q2 = zoneHourM1SQL({ ...args, postedDropMph: 15, absoluteMph: 45, referencePct: 70 });
    expect(q2).toMatch(/zone_posted_limit - 15/);
    expect(q2).toContain('zone_speed < 45');
    expect(q2).toMatch(/zone_reference \* 70 \/ 100/);
  });
});

describe('rollupZoneM1', () => {
  // Two zones: one slow for 5 of 10 hours, one never slow.
  const rows = [
    { wz_event_id: 'A', active_hours_measured: 10, hours_too_sparse: 2,
      hours_below_posted: 5, hours_below_absolute: 2, hours_below_relative: 1 },
    { wz_event_id: 'B', active_hours_measured: 30, hours_too_sparse: 0,
      hours_below_posted: 0, hours_below_absolute: 0, hours_below_relative: 0 },
  ];
  const r = rollupZoneM1(rows);

  it('hour-weights the programmatic figure', () => {
    // 5 of 40 hours, not the mean of 50% and 0%.
    expect(r.active_hours_measured).toBe(40);
    expect(r.m1_posted_hour_weighted).toBeCloseTo(5 / 40, 4);
  });

  it('also reports the zone mean, which answers a different question', () => {
    // (50% + 0%) / 2 — what the typical zone did, which a project review reads.
    expect(r.m1_posted_zone_mean).toBeCloseTo(0.25, 4);
  });

  it('counts zones with ANY exceedance hour — the "percent of projects" shape', () => {
    // The rule's own examples are "percent of projects…", and this is the shape
    // Ohio reports on its key projects.
    expect(r.zones_any_hour_below_posted).toBe(1);
    expect(r.zones_majority_below_posted).toBe(0);
  });

  it('flags zones over the majority share', () => {
    const r2 = rollupZoneM1([
      { active_hours_measured: 10, hours_below_posted: 6, hours_below_absolute: 0, hours_below_relative: 0 },
    ]);
    expect(r2.zones_majority_below_posted).toBe(1);
  });

  it('excludes zones with no measured hour, and says how many', () => {
    const r3 = rollupZoneM1([
      ...rows,
      { active_hours_measured: 0, hours_too_sparse: 4, hours_below_posted: 0,
        hours_below_absolute: 0, hours_below_relative: 0 },
    ]);
    expect(r3.zones).toBe(2);
    expect(r3.zones_unmeasurable).toBe(1);
    expect(r3.hours_too_sparse).toBe(2);
  });

  it('returns nulls, not zeros, when nothing was measured', () => {
    const r4 = rollupZoneM1([]);
    expect(r4.zones).toBe(0);
    expect(r4.m1_posted_hour_weighted).toBeNull();
  });

  it('never lets the two aggregations be confused', () => {
    // A long slow zone and a short fine one: hour-weighted and zone-mean must
    // disagree, which is exactly why both are published.
    const r5 = rollupZoneM1([
      { active_hours_measured: 100, hours_below_posted: 90, hours_below_absolute: 0, hours_below_relative: 0 },
      { active_hours_measured: 2, hours_below_posted: 0, hours_below_absolute: 0, hours_below_relative: 0 },
    ]);
    expect(r5.m1_posted_hour_weighted).toBeCloseTo(90 / 102, 4);
    expect(r5.m1_posted_zone_mean).toBeCloseTo(0.45, 4);
    expect(r5.m1_posted_hour_weighted).not.toBeCloseTo(r5.m1_posted_zone_mean, 2);
  });
});

describe('the M1 distribution buckets', () => {
  const r = rollupZoneM1([
    { active_hours_measured: 10, hours_below_posted: 0, hours_below_absolute: 0, hours_below_relative: 0, mean_zone_speed: 60 },
    { active_hours_measured: 10, hours_below_posted: 1, hours_below_absolute: 0, hours_below_relative: 0, mean_zone_speed: 50 },
    { active_hours_measured: 10, hours_below_posted: 2, hours_below_absolute: 0, hours_below_relative: 0, mean_zone_speed: 45 },
    { active_hours_measured: 10, hours_below_posted: 3, hours_below_absolute: 0, hours_below_relative: 0, mean_zone_speed: 40 },
    { active_hours_measured: 10, hours_below_posted: 9, hours_below_absolute: 0, hours_below_relative: 0, mean_zone_speed: 20 },
  ]);

  it('buckets zones by their own share of hours below threshold', () => {
    expect(r.dist_posted.zero).toBe(1);      // 0/10
    expect(r.dist_posted.to_10).toBe(1);     // 1/10 = 10%
    expect(r.dist_posted.to_25).toBe(1);     // 2/10 = 20%
    expect(r.dist_posted.to_50).toBe(1);     // 3/10 = 30%
    expect(r.dist_posted.over_50).toBe(1);   // 9/10 = 90%
  });

  it('buckets sum to the measured zone count', () => {
    const d = r.dist_posted;
    expect(d.zero + d.to_10 + d.to_25 + d.to_50 + d.over_50).toBe(r.zones);
  });

  it('hour-weights the mean zone speed', () => {
    // Equal hours here, so the plain mean: (60+50+45+40+20)/5.
    expect(r.mean_zone_speed).toBeCloseTo(43, 3);
  });

  it('reports a median and p90 per threshold', () => {
    expect(r.dist_posted.median).not.toBeNull();
    expect(r.dist_posted.p90).toBeGreaterThanOrEqual(r.dist_posted.median);
  });
});

describe('rollupZoneM1ByTier — M1 on comparable universes', () => {
  // The reason this exists: our 42,688 CY2024 zones are TRANSCOM events, 77% of
  // them under twelve hours. Illinois counts 1,673 projects a year; Ohio
  // monitors 25-30. A statewide share over our universe is comparable to
  // nothing anyone else publishes, so every figure must name its universe.
  const rows = [
    { wz_event_id: 'SHIFT', active_hours_measured: 6, hours_below_posted: 6,
      hours_below_absolute: 6, hours_below_relative: 0 },
    { wz_event_id: 'PROJECT', active_hours_measured: 200, hours_below_posted: 20,
      hours_below_absolute: 10, hours_below_relative: 5 },
    { wz_event_id: 'SIGNIF', active_hours_measured: 100, hours_below_posted: 5,
      hours_below_absolute: 2, hours_below_relative: 1 },
  ];
  const zoneById = new Map([
    ['SHIFT', { span_hours: 6, is_significant_candidate: false, is_interstate: false }],
    ['PROJECT', { span_hours: 24 * 30, is_significant_candidate: false, is_interstate: true }],
    ['SIGNIF', { span_hours: 24 * 40, is_significant_candidate: true, is_interstate: true }],
  ]);
  const t = rollupZoneM1ByTier(rows, zoneById);

  it('reports every tier with its own zone count', () => {
    expect(t.all.zones).toBe(3);
    expect(t.week_plus.zones).toBe(2);
    expect(t.significant.zones).toBe(1);
    expect(t.interstate.zones).toBe(2);
    expect(t.not_interstate.zones).toBe(1);
  });

  it('gives materially different answers per tier — which is the point', () => {
    // all: 31 of 306 hours; week_plus: 25 of 300; significant: 5 of 100.
    expect(t.all.m1_posted_hour_weighted).toBeCloseTo(31 / 306, 4);
    expect(t.week_plus.m1_posted_hour_weighted).toBeCloseTo(25 / 300, 4);
    expect(t.significant.m1_posted_hour_weighted).toBeCloseTo(5 / 100, 4);
  });

  it('shows how a six-hour shift distorts the zone mean but not the hour weight', () => {
    // The 6-hour shift was slow for all 6 of its hours. As one zone among
    // three it drags the zone mean to 39%; as 6 hours among 306 it barely
    // moves the hour-weighted figure.
    expect(t.all.m1_posted_zone_mean).toBeCloseTo((1 + 0.1 + 0.05) / 3, 4);
    expect(t.all.m1_posted_hour_weighted).toBeLessThan(0.11);
  });

  it('records the week threshold it used', () => {
    expect(t.week_hours).toBe(168);
    // SHIFT spans 6 h, so a 24-hour cut still excludes it; a 6-hour cut includes all three.
    expect(rollupZoneM1ByTier(rows, zoneById, { weekHours: 24 }).week_plus.zones).toBe(2);
    expect(rollupZoneM1ByTier(rows, zoneById, { weekHours: 6 }).week_plus.zones).toBe(3);
  });

  it('survives a missing zone-meta entry rather than throwing', () => {
    const t2 = rollupZoneM1ByTier(rows, new Map());
    expect(t2.all.zones).toBe(3);
    expect(t2.significant.zones).toBe(0);
    expect(t2.week_plus.zones).toBe(0);
  });
});
