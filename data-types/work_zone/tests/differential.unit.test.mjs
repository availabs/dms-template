/**
 * Unit tests for M4 — the speed differential as lib/differential.js defines it.
 *
 * Pinned: the sign convention (positive = the work zone slowed traffic), null
 * not zero when a side is unknown, the flag on the APPROACH differential only,
 * the hour grain (space-mean in-zone and approach speeds over the same active
 * epochs, half an hour of observation required), the cell grain pooled the
 * way wz_speed's speed_mean is, the rollup's two weightings, and the update
 * statements that fill wz_speed in place without touching another window.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_APPROACH_TMCS, DEFAULT_MIN_EPOCHS_PER_HOUR, differential,
  approachCorridorDDL, approachTmcDDL, approachExcludeDDL, approachHourSQL, approachCellSQL,
  rollupM4, rollupM4ByTier,
} from '../lib/differential.js';
import sql from '../sql.js';

describe('differential', () => {
  it('is approach minus in-zone and baseline minus during, positive when the zone slowed traffic', () => {
    const d = differential({ zoneSpeed: 30, approachSpeed: 52, baselineSpeed: 48, thresholdMph: 15 });
    expect(d).toEqual({ differential_approach: 22, differential_baseline: 18, exceeds_differential: true, exceeds_baseline_drop: true });
  });
  it('flags on the approach differential only', () => {
    const d = differential({ zoneSpeed: 40, approachSpeed: 45, baselineSpeed: 60, thresholdMph: 15 });
    expect(d.exceeds_differential).toBe(false); expect(d.exceeds_baseline_drop).toBe(true);
  });
  it('is negative when the queue reached past the approach', () => {
    expect(differential({ zoneSpeed: 25, approachSpeed: 12, baselineSpeed: 55, thresholdMph: 15 }).differential_approach).toBe(-13);
  });
  it('is null — never 0 — when a side is unknown', () => {
    const d = differential({ zoneSpeed: 30, approachSpeed: null, baselineSpeed: '', thresholdMph: 15 });
    expect(d.differential_approach).toBeNull(); expect(d.differential_baseline).toBeNull(); expect(d.exceeds_differential).toBeNull();
    expect(differential({ zoneSpeed: null, approachSpeed: 50, baselineSpeed: 50, thresholdMph: 15 }).differential_approach).toBeNull();
  });
  it('treats a difference equal to the threshold as not exceeding', () => {
    expect(differential({ zoneSpeed: 30, approachSpeed: 45, baselineSpeed: 30, thresholdMph: 15 }).exceeds_differential).toBe(false);
  });
});

describe('the ClickHouse queries', () => {
  const args = { speedTable: 'npmrds.speeds', corridorTable: 'npmrds._wz_dcorr_x', windowStart: '2024-01-01', windowEnd: '2024-12-31' };
  const h = approachHourSQL({ ...args, baselineCte: 'SELECT 1 AS tmc, 1 AS hour, 0 AS is_weekend, 50 AS speed_median' });

  it('stages rank 0 = anchor, 1..N = approach, and the anchors and exclusions for the baseline', () => {
    expect(DEFAULT_APPROACH_TMCS).toBe(2);
    expect(approachCorridorDDL({ database: 'npmrds', table: 't' })).toMatch(/rank UInt16/);
    expect(approachTmcDDL({ database: 'npmrds', table: 't' })).toMatch(/miles Float64/);
    expect(approachExcludeDDL({ database: 'npmrds', table: 't' })).toMatch(/date Date/);
  });
  it('keeps the speed table on the LEFT, prefilters by primary key, bounds the date, half-open epochs', () => {
    expect(h).toMatch(/FROM npmrds\.speeds n\s*\n\s*INNER JOIN npmrds\._wz_dcorr_x c ON c\.tmc = n\.tmc AND c\.date = n\.date/);
    expect(h).toContain('n.tmc IN (SELECT DISTINCT tmc FROM npmrds._wz_dcorr_x)');
    expect(h).toContain("n.date >= toDate('2024-01-01') AND n.date <= toDate('2024-12-31')");
    expect(h).toContain('n.epoch >= c.epoch_from AND n.epoch < c.epoch_to');
  });
  it('measures the hour grain with space-mean speeds on each side over the same epochs', () => {
    expect(h).toContain('sumIf(c.miles, c.rank = 0) * 3600 / sumIf(n.travel_time_all_vehicles, c.rank = 0)');
    expect(h).toContain('sumIf(c.miles, c.rank > 0) * 3600 / sumIf(n.travel_time_all_vehicles, c.rank > 0)');
    expect(h).toContain('GROUP BY wz_event_id, date, hour');
  });
  it('requires half an hour of in-zone observation before classifying an hour', () => {
    expect(DEFAULT_MIN_EPOCHS_PER_HOUR).toBe(6);
    expect(h).toContain('HAVING epochs_in_hour >= 6');
    expect(approachHourSQL({ ...args, minEpochsPerHour: 9 })).toContain('HAVING epochs_in_hour >= 9');
  });
  it('joins the baseline on the anchor at the same hour and day-type', () => {
    expect(h).toContain('WITH baseline AS (SELECT 1 AS tmc');
    expect(h).toContain('b.is_weekend = (toDayOfWeek(n.date) IN (6, 7))');
    expect(h).toContain('anyIf(b.speed_median, c.rank = 0) AS baseline_speed');
    expect(approachHourSQL(args)).toContain('NULL AS baseline_speed');
  });
  it('pools the cell grain over approach observations only, like speed_mean', () => {
    const c = approachCellSQL(args);
    expect(c).toContain('AND c.rank > 0');
    expect(c).toContain('avg(c.miles * 3600 / n.travel_time_all_vehicles) AS approach_speed');
    expect(c).toContain("arrayStringConcat(arraySort(groupUniqArray(c.tmc)), ' ') AS approach_tmcs");
    expect(c).toContain('GROUP BY wz_event_id, hour');
  });
  it('requires a window', () => {
    expect(() => approachHourSQL({ ...args, windowStart: null })).toThrow(/windowStart/);
    expect(() => approachCellSQL({ ...args, windowEnd: null })).toThrow(/windowStart/);
  });
});

describe('rollupM4', () => {
  const rows = [
    // zone A: 3 hours; approach drop 20, 10, unknown; baseline drop 25, 5, 30
    { wz_event_id: 'A', zone_speed: 30, approach_speed: 50, baseline_speed: 55 },
    { wz_event_id: 'A', zone_speed: 40, approach_speed: 50, baseline_speed: 45 },
    { wz_event_id: 'A', zone_speed: 25, approach_speed: null, baseline_speed: 55 },
    // zone B: queue reached past the approach (approach slower than the zone)
    { wz_event_id: 'B', zone_speed: 25, approach_speed: 8, baseline_speed: 60 },
    // zone C: no in-zone speed — not measured at all
    { wz_event_id: 'C', zone_speed: null, approach_speed: 50, baseline_speed: 50 },
  ];
  const r = rollupM4(rows, { thresholdMph: 15 });

  it('counts hours on each side separately', () => {
    expect(r.hours_measured).toBe(4); expect(r.hours_with_approach).toBe(3); expect(r.hours_with_baseline).toBe(4);
  });
  it('hour-weights the shares over hours with both sides observed', () => {
    expect(r.hours_approach_over).toBe(1); expect(r.m4_approach_hour_weighted).toBeCloseTo(1 / 3, 4);
    expect(r.hours_baseline_over).toBe(3); expect(r.m4_baseline_hour_weighted).toBeCloseTo(3 / 4, 4);
  });
  it('reports the zone shape and the zone mean', () => {
    expect(r.zones_with_approach).toBe(2); expect(r.zones_any_hour_over).toBe(1); expect(r.zones_majority_over).toBe(0);
    // A: 1 of 2 hours over = 0.5; B: 0 of 1 = 0 → mean 0.25
    expect(r.m4_approach_zone_mean).toBeCloseTo(0.25, 4);
  });
  it('counts hours where the approach was slower than the zone by more than the line', () => {
    expect(r.hours_approach_slower_than_zone).toBe(1);
    expect(r.mean_differential_approach).toBeCloseTo((20 + 10 - 17) / 3, 2);
  });
  it('is null, not zero, with nothing measured', () => {
    const e = rollupM4([{ wz_event_id: 'X', zone_speed: 30, approach_speed: null, baseline_speed: null }]);
    expect(e.m4_approach_hour_weighted).toBeNull(); expect(e.m4_baseline_hour_weighted).toBeNull(); expect(e.hours_measured).toBe(1);
  });
  it('rolls up per tier', () => {
    const meta = new Map([
      ['A', { is_significant_candidate: true, is_interstate: true, span_hours: 200 }],
      ['B', { is_significant_candidate: false, is_interstate: false, span_hours: 6 }],
      ['C', { is_significant_candidate: false, is_interstate: true, span_hours: 6 }],
    ]);
    const t = rollupM4ByTier(rows, meta, { thresholdMph: 15 });
    expect(t.significant.hours_measured).toBe(3); expect(t.significant.m4_approach_hour_weighted).toBeCloseTo(0.5, 4);
    expect(t.not_interstate.hours_approach_slower_than_zone).toBe(1); expect(t.week_plus.zones_with_approach).toBe(1);
  });
});

describe('the wz_speed updates', () => {
  const rows = [
    { wz_event_id: 'Z1', hour: 5, approach_tmc: '120+04940 120P04939', approach_speed: 48.25 },
    { wz_event_id: 'Z1', hour: 6, approach_tmc: '120+04940 120P04939', approach_speed: null },
  ];
  const u = sql.wzSpeedApproachUpdateSQL({ table: 's2206_v3884_wz_speed', rows, thresholdMph: 15, startDate: '2024-01-01', endDate: '2024-12-31' });

  it('joins the cells on (zone, hour) through a VALUES list and derives the differential from the row itself', () => {
    expect(u).toContain("FROM (VALUES ('Z1', 5, '120+04940 120P04939', 48.25),\n('Z1', 6, '120+04940 120P04939', NULL)) AS v(wz_event_id, hour, approach_tmc, approach_speed)");
    expect(u).toContain('t.wz_event_id = v.wz_event_id AND t.hour = v.hour::smallint');
    expect(u).toContain('differential_approach = round((v.approach_speed::double precision - t.speed_mean)::numeric, 2)');
  });
  it('flags above the threshold and leaves the flag NULL when a side is unknown', () => {
    expect(u).toContain('CASE WHEN v.approach_speed IS NULL OR t.speed_mean IS NULL THEN NULL');
    expect(u).toContain('> 15 END');
    expect(sql.wzSpeedApproachUpdateSQL({ table: 't', rows, thresholdMph: 20, startDate: '2024-01-01', endDate: '2024-12-31' })).toContain('> 20 END');
  });
  it('stays inside the window, half-open', () => {
    expect(u).toContain("t.first_start >= '2024-01-01'::date");
    expect(u).toContain("t.first_start < ('2024-12-31'::date + INTERVAL '1 day')");
  });
  it('validates its arguments', () => {
    expect(() => sql.wzSpeedApproachUpdateSQL({ table: 't', rows, thresholdMph: 0, startDate: 'a', endDate: 'b' })).toThrow(/positive/);
    expect(() => sql.wzSpeedApproachUpdateSQL({ table: 't', rows, thresholdMph: 15 })).toThrow(/startDate/);
    expect(sql.wzSpeedApproachUpdateSQL({ table: 't', rows: [], thresholdMph: 15, startDate: 'a', endDate: 'b' })).toBeNull();
  });
  it('fills the baseline drop from the cell\'s own columns and clears the approach side for the window first', () => {
    const b = sql.wzSpeedBaselineDropUpdateSQL({ table: 's2206_v3884_wz_speed', startDate: '2024-01-01', endDate: '2024-12-31' });
    expect(b).toContain('differential_baseline = CASE WHEN baseline_speed IS NULL OR speed_mean IS NULL THEN NULL');
    expect(b).toContain('round((baseline_speed - speed_mean)::numeric, 2)');
    expect(b).toContain('approach_tmc = NULL, approach_speed = NULL, differential_approach = NULL, exceeds_differential = NULL');
    expect(b).toContain("first_start < ('2024-12-31'::date + INTERVAL '1 day')");
  });
  it('the source descriptors now describe M4 rather than a placeholder', () => {
    const d = Object.fromEntries(sql.WZ_SPEED_TABLE_COLUMNS.map((c) => [c.name, c.desc]));
    for (const c of ['approach_tmc', 'approach_speed', 'differential_approach', 'differential_baseline', 'exceeds_differential']) {
      expect(d[c]).not.toBe('Phase 6 (M4)'); expect(d[c]).toMatch(/M4|approach|baseline/);
    }
  });
});
