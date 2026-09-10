/**
 * Unit tests for work_zone baselines, thresholds and the ClickHouse builders.
 *
 * The behaviours worth locking down: speed is DERIVED from travel time and
 * guards the divide; the baseline window never overlaps the measurement window;
 * the FHWA threshold matches the definition AVAIL's congestion work uses; and
 * the measure query takes its reference speed from the staged PM3 table rather
 * than deriving one, so M1 cannot be biased by baseline contamination.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_BASELINE_MONTHS, DEFAULT_REFERENCE_PERCENTILE, DEFAULT_OFF_PEAK_HOURS,
  EPOCHS_PER_DAY, EPOCHS_PER_HOUR,
  epochToHour, hourToEpoch, epochToClock, baselineWindow,
  fhwaThresholdSpeed, speedExpr, baselineSQL, measureSQL,
  postedDropThresholdSpeed,
  POSTED_THRESHOLD_FLOOR_MPH,
  DEFAULT_POSTED_SPEED_DROP,
} from '../lib/baseline.js';

describe('epoch arithmetic', () => {
  it('is a 288-bin, five-minute day', () => {
    expect(EPOCHS_PER_DAY).toBe(288);
    expect(EPOCHS_PER_HOUR).toBe(12);
  });
  it('maps epochs to hours and back', () => {
    expect(epochToHour(0)).toBe(0);
    expect(epochToHour(156)).toBe(13);      // the verified I-81 window start
    expect(epochToHour(287)).toBe(23);
    expect(hourToEpoch(13)).toBe(156);
  });
  it('renders a clock time on the five-minute grid', () => {
    expect(epochToClock(0)).toBe('00:00');
    expect(epochToClock(156)).toBe('13:00');
    expect(epochToClock(228)).toBe('19:00');  // the verified window end
    expect(epochToClock(287)).toBe('23:55');
  });
});

describe('baselineWindow', () => {
  it('defaults to twelve months and ends the day before the window opens', () => {
    expect(DEFAULT_BASELINE_MONTHS).toBe(12);
    expect(baselineWindow({ startDate: '2024-01-01' })).toEqual({
      baseline_start: '2023-01-01', baseline_end: '2023-12-31', baseline_months: 12,
    });
  });
  it('never overlaps the measurement window, so a zone is not compared to itself', () => {
    const w = baselineWindow({ startDate: '2024-06-15' });
    expect(w.baseline_end).toBe('2024-06-14');
    expect(w.baseline_end < '2024-06-15').toBe(true);
  });
  it('honours a different window length', () => {
    expect(baselineWindow({ startDate: '2024-01-01', months: 24 }).baseline_start).toBe('2022-01-01');
    expect(baselineWindow({ startDate: '2024-01-01', months: 3 }).baseline_start).toBe('2023-10-01');
  });
  it('rejects a bad date rather than silently producing an epoch window', () => {
    expect(() => baselineWindow({ startDate: 'last summer' })).toThrow(/bad startDate/);
  });
});

describe('fhwaThresholdSpeed', () => {
  it('is 60% of the posted limit, floored at 20 mph', () => {
    expect(fhwaThresholdSpeed(65)).toBe(39);
    expect(fhwaThresholdSpeed(55)).toBe(33);
    expect(fhwaThresholdSpeed(30)).toBe(20);   // 18 → floored
    expect(fhwaThresholdSpeed(25)).toBe(20);
  });
  it('is null without a limit, never a default', () => {
    // The congestion methodology note records that an EMPTY speed limit silently
    // collapsed this to a uniform 20 mph statewide. Null keeps that visible.
    expect(fhwaThresholdSpeed(null)).toBeNull();
    expect(fhwaThresholdSpeed(0)).toBeNull();
    expect(fhwaThresholdSpeed('')).toBeNull();
  });
});

describe('speedExpr', () => {
  it('derives speed from travel time and length, because the table has no speed', () => {
    const e = speedExpr();
    expect(e).toContain('m.miles * 3600 / n.travel_time_all_vehicles');
  });
  it('guards the divide — a zero travel time is no observation, not infinite speed', () => {
    const e = speedExpr();
    expect(e).toContain('travel_time_all_vehicles > 0');
    expect(e).toContain('m.miles > 0');
    expect(e).toContain('NULL');
  });
  it('uses the all-vehicles series', () => {
    expect(speedExpr()).toContain('travel_time_all_vehicles');
    expect(speedExpr()).not.toContain('freight');
  });
});

describe('baselineSQL', () => {
  const q = baselineSQL({
    speedTable: 'npmrds.speeds', tmcTable: 'npmrds._wz_tmc', excludeTable: 'npmrds._wz_ex',
    baselineStart: '2023-01-01', baselineEnd: '2023-12-31',
  });
  it('groups by tmc, hour and day-type', () => {
    expect(q).toMatch(/GROUP BY tmc, hour, is_weekend/);
    expect(q).toContain('toDayOfWeek(n.date) IN (6, 7)');
  });
  it('keeps the median and the 15th/85th percentiles', () => {
    expect(q).toContain('quantile(0.15)');
    expect(q).toContain('quantile(0.5)');
    expect(q).toContain('quantile(0.85)');
  });
  it('excludes contaminated (tmc, date) pairs with an anti join', () => {
    expect(q).toMatch(/LEFT ANTI JOIN npmrds\._wz_ex x ON x\.tmc = n\.tmc AND x\.date = n\.date/);
  });
  it('bounds the baseline window', () => {
    expect(q).toContain("toDate('2023-01-01')");
    expect(q).toContain("toDate('2023-12-31')");
  });
});

describe('measureSQL', () => {
  const baselineCte = baselineSQL({
    speedTable: 'npmrds.speeds', tmcTable: 'npmrds._wz_tmc', excludeTable: 'npmrds._wz_ex',
    baselineStart: '2023-01-01', baselineEnd: '2023-12-31',
  });
  const q = measureSQL({
    speedTable: 'npmrds.speeds', tmcTable: 'npmrds._wz_tmc', activeTable: 'npmrds._wz_active',
    baselineCte, speedThresholdMph: 35, referencePct: 60,
    windowStart: '2024-01-01', windowEnd: '2024-12-31',
  });

  it('bounds the speed-table scan by the measurement window', () => {
    // Without this the join alone cannot prune partitions and ClickHouse scans
    // every year for every anchor TMC — measured at 44 GiB and still running.
    expect(q).toContain("n.date >= toDate('2024-01-01')");
    expect(q).toContain("n.date <= toDate('2024-12-31')");
  });

  it('refuses to build without a window, rather than scanning everything', () => {
    expect(() => measureSQL({
      speedTable: 'x', tmcTable: 'y', activeTable: 'z', baselineCte, speedThresholdMph: 35, referencePct: 60,
    })).toThrow(/windowStart and windowEnd are required/);
  });

  it('counts epochs below all three thresholds', () => {
    expect(q).toContain('epochs_below_absolute');
    expect(q).toContain('epochs_below_relative');
    expect(q).toContain('epochs_below_fhwa');
  });
  it('takes the reference speed from the staged PM3 table, not from the baseline', () => {
    expect(q).toContain('m.reference_speed');
    // no derived-reference CTE: M1 must not depend on the contaminated-baseline question
    expect(q).not.toMatch(/reference AS \(/);
  });
  it('applies the relative threshold as a percentage of the reference', () => {
    expect(q).toContain('m.reference_speed * 60 / 100');
  });
  it('applies the absolute threshold as given', () => {
    expect(q).toMatch(/< 35\)/);
  });
  it('joins active epochs by tmc and date, filtering the 2799 epoch range in WHERE', () => {
    // ClickHouse refuses a cross-table inequality inside a JOIN condition, so
    // the range must land in WHERE — asserted here so a refactor cannot move it
    // back and fail only against the live cluster.
    expect(q).toMatch(/INNER JOIN [\w.]+ a ON a\.tmc = n\.tmc AND a\.date = n\.date/);
    expect(q).toMatch(/WHERE[\s\S]*n\.epoch >= a\.epoch_from AND n\.epoch < a\.epoch_to/);
  });

  it('treats the active epoch range as half-open', () => {
    // 2799's bound_end_time reaches 288 — one past the last epoch of the day —
    // so the end is exclusive. An inclusive `<=` would add a phantom epoch to
    // every window that ends mid-day and count a whole extra day nowhere.
    expect(q).toContain('n.epoch < a.epoch_to');
    expect(q).not.toContain('n.epoch <= a.epoch_to');
  });

  it('puts the huge speed table on the LEFT of every join', () => {
    // ClickHouse hashes the RIGHT side. With the 14.6-billion-row speed table on
    // the right this query hit 44 GiB and never finished — so the FROM must be
    // the speed table and the staged tables must be the joined ones.
    expect(q).toMatch(/FROM npmrds\.speeds n\s*\n\s*INNER JOIN npmrds\._wz_active a/);
    expect(q).not.toMatch(/FROM npmrds\._wz_active[\s\S]*INNER JOIN npmrds\.speeds/);
  });
  it('counts observations rather than assuming 288 epochs a day', () => {
    expect(q).toContain('count() AS epochs_observed');
  });
  it('keeps the density mix, since density C is included by decision', () => {
    expect(q).toContain("data_density_all_vehicles = 'A'");
    expect(q).toContain("data_density_all_vehicles = 'C'");
    // and does NOT filter on it
    expect(q).not.toMatch(/WHERE[^)]*data_density_all_vehicles\s*=/);
  });
  it('joins the baseline on hour AND day-type', () => {
    expect(q).toContain('b.hour = intDiv(n.epoch, 12)');
    expect(q).toContain('b.is_weekend = (toDayOfWeek(n.date) IN (6, 7))');
  });
  it('groups to the (zone × tmc × hour) cell', () => {
    expect(q).toMatch(/GROUP BY wz_event_id, tmc, hour/);
  });
});

describe('reference-speed defaults', () => {
  it('documents the 85th percentile and an off-peak hour set', () => {
    expect(DEFAULT_REFERENCE_PERCENTILE).toBe(0.85);
    expect(DEFAULT_OFF_PEAK_HOURS).toContain(2);
    expect(DEFAULT_OFF_PEAK_HOURS).not.toContain(8);   // AM peak excluded
    expect(DEFAULT_OFF_PEAK_HOURS).not.toContain(17);  // PM peak excluded
  });
});

describe('postedDropThresholdSpeed — the PRIMARY M1 threshold', () => {
  it('is the posted limit less the drop', () => {
    expect(postedDropThresholdSpeed(65)).toBe(55);
    expect(postedDropThresholdSpeed(50)).toBe(40);
    expect(postedDropThresholdSpeed(45)).toBe(35);
  });

  it('floors at 20 mph, matching the FHWA PHED convention', () => {
    // Owner decision. Without it a 25 mph street reports exceedances against
    // 15 mph — a speed at which traffic is stopped, not delayed — and the
    // measure goes quiet exactly where local work is most disruptive.
    expect(POSTED_THRESHOLD_FLOOR_MPH).toBe(20);
    expect(postedDropThresholdSpeed(30)).toBe(20);
    expect(postedDropThresholdSpeed(25)).toBe(20);
    expect(postedDropThresholdSpeed(28)).toBe(20);
  });

  it('never returns a threshold above the posted limit itself', () => {
    // A segment posted below the floor would otherwise flag 100% of its
    // observations as exceedances. 4 of 8,165 CY2024 anchors are posted <= 10.
    expect(postedDropThresholdSpeed(15)).toBe(15);
    expect(postedDropThresholdSpeed(10)).toBe(10);
    expect(postedDropThresholdSpeed(5)).toBe(5);
  });

  it('takes a configurable drop, because the threshold stays parametric', () => {
    expect(postedDropThresholdSpeed(65, 15)).toBe(50);
    expect(postedDropThresholdSpeed(65, 5)).toBe(60);
    expect(DEFAULT_POSTED_SPEED_DROP).toBe(10);
  });

  it('is null only when the posted limit is missing or nonsense', () => {
    // avg_speedlimit is populated on 100% of CY2024 anchors, so this guards a
    // metadata gap rather than a routine branch.
    expect(postedDropThresholdSpeed(null)).toBeNull();
    expect(postedDropThresholdSpeed(undefined)).toBeNull();
    expect(postedDropThresholdSpeed('')).toBeNull();
    expect(postedDropThresholdSpeed(0)).toBeNull();
    expect(postedDropThresholdSpeed(-5)).toBeNull();
    expect(postedDropThresholdSpeed('abc')).toBeNull();
  });

  it('handles the fractional limits the meta view actually carries', () => {
    // avg_speedlimit is an average over the TMC's sub-segments, so it is not
    // a round number: 56.706 is a real CY2024 value.
    expect(postedDropThresholdSpeed(56.706)).toBeCloseTo(46.706, 6);
    expect(postedDropThresholdSpeed(69.7)).toBeCloseTo(59.7, 6);
  });
});

describe('measureSQL counts the primary threshold', () => {
  const q = measureSQL({
    speedTable: 'npmrds.speeds', tmcTable: 'npmrds._wz_tmc', activeTable: 'npmrds._wz_active',
    baselineCte: 'SELECT 1', speedThresholdMph: 35, referencePct: 60,
    windowStart: '2024-01-01', windowEnd: '2024-12-31',
  });

  it('counts epochs below the staged per-segment posted threshold', () => {
    expect(q).toContain('AS epochs_below_posted');
    expect(q).toMatch(/m\.posted_threshold_speed > 0/);
  });

  it('applies the threshold from the staged table, not inline arithmetic', () => {
    // The drop and the floor are applied once, per TMC, at staging time. If the
    // measure recomputed them it would need the posted limit in ClickHouse —
    // where avg_speedlimit is empty.
    expect(q).not.toMatch(/avg_speedlimit/);
    expect(q).toContain('any(m.posted_threshold_speed) AS posted_threshold_speed');
  });
});
