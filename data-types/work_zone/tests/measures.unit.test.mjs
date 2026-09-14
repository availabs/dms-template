/**
 * Unit tests for the M1 measure, including a golden test against REAL NPMRDS
 * travel times recorded from ClickHouse (tests/fixtures/npmrds_speed_cells.json).
 *
 * Two recorded cases, on purpose: an I-81 significant candidate with no
 * measurable speed impact (59–73 mph throughout its own active window), and an
 * I-495 zone with a large one (11–61 mph, mean 31.6). A measure that cannot
 * report zero honestly is as broken as one that cannot report a large value.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEFAULT_MIN_EPOCHS, m1ForZone, groupCellsByZone, rollupM1 } from '../lib/measures.js';
import { fhwaThresholdSpeed, epochToHour, postedDropThresholdSpeed } from '../lib/baseline.js';

const FIXTURE = JSON.parse(readFileSync(new URL('./fixtures/npmrds_speed_cells.json', import.meta.url)));

/**
 * Reproduce what the ClickHouse query returns, from the recorded travel times:
 * one cell per hour-of-day with epochs observed and epochs below each threshold.
 */
function cellsFromFixture(c, { absolute = 35, relativePct = 60, postedDrop = 10 } = {}) {
  const relative = c.reference_speed * (relativePct / 100);
  const fhwa = fhwaThresholdSpeed(c.avg_speedlimit);
  const posted = postedDropThresholdSpeed(c.avg_speedlimit, postedDrop);
  const byHour = new Map();
  for (const e of c.epochs) {
    const speed = (c.miles * 3600) / e.travel_time_all_vehicles;
    const hour = epochToHour(e.epoch);
    if (!byHour.has(hour)) {
      byHour.set(hour, {
        wz_event_id: c.wz_event_id, tmc: c.tmc, hour,
        epochs_observed: 0, epochs_below_posted: 0,
        epochs_below_absolute: 0, epochs_below_relative: 0, epochs_below_fhwa: 0,
        _speeds: [], density_a: 0, density_b: 0, density_c: 0,
        reference_speed: c.reference_speed, phed_threshold_speed: c.phed_threshold_speed,
        fhwa_threshold_speed: fhwa, posted_threshold_speed: posted,
      });
    }
    const cell = byHour.get(hour);
    cell.epochs_observed += 1;
    if (posted > 0 && speed < posted) cell.epochs_below_posted += 1;
    if (speed < absolute) cell.epochs_below_absolute += 1;
    if (speed < relative) cell.epochs_below_relative += 1;
    if (speed < fhwa) cell.epochs_below_fhwa += 1;
    cell._speeds.push(speed);
    cell[`density_${String(e.density).toLowerCase()}`] += 1;
  }
  return [...byHour.values()].map((cell) => {
    const s = cell._speeds;
    const sorted = [...s].sort((a, b) => a - b);
    return {
      ...cell,
      speed_mean: s.reduce((a, b) => a + b, 0) / s.length,
      speed_median: sorted[Math.floor(sorted.length / 2)],
      speed_min: sorted[0],
      baseline_speed: null, baseline_p85: null,
    };
  });
}

describe('golden: a significant work zone with NO speed impact (I-81)', () => {
  const c = FIXTURE.no_impact;
  const zone = m1ForZone(cellsFromFixture(c));

  it('observed the whole recorded window', () => {
    expect(c.epochs.length).toBe(73);
    expect(zone.epochs_observed).toBe(73);
    expect(zone.is_measurable).toBe(true);
  });
  it('reports zero exceedance at all three thresholds', () => {
    expect(zone.epochs_below_absolute).toBe(0);
    expect(zone.epochs_below_relative).toBe(0);
    expect(zone.epochs_below_fhwa).toBe(0);
    expect(zone.m1_absolute).toBe(0);
    expect(zone.m1_relative).toBe(0);
    expect(zone.m1_fhwa).toBe(0);
  });
  it('reports the real free-flow speed it saw', () => {
    // 0.321709 mi over 15.9-19.6 s ≈ 59-73 mph
    expect(zone.speed_mean).toBeGreaterThan(60);
    expect(zone.speed_mean).toBeLessThan(70);
    expect(zone.speed_min).toBeGreaterThan(55);
  });
  it('keeps the density mix, density C included', () => {
    expect(zone.density_a + zone.density_b + zone.density_c).toBe(73);
    expect(zone.density_c).toBe(12);
    expect(zone.pct_density_c).toBeCloseTo(16.4, 1);
  });
  it('distinguishes zero exceedance from unmeasurable', () => {
    expect(zone.m1_absolute).toBe(0);
    expect(zone.m1_absolute).not.toBeNull();
  });
});

describe('golden: a work zone with a large speed impact (I-495)', () => {
  const c = FIXTURE.impact;
  const zone = m1ForZone(cellsFromFixture(c));

  it('reproduces the counts computed from the recorded travel times', () => {
    expect(zone.epochs_observed).toBe(65);
    expect(zone.epochs_below_absolute).toBe(49);
    expect(zone.epochs_below_relative).toBe(48);
    expect(zone.epochs_below_fhwa).toBe(38);
  });
  it('turns those into the measure', () => {
    expect(zone.m1_absolute).toBeCloseTo(49 / 65, 4);   // 0.7538
    expect(zone.m1_relative).toBeCloseTo(48 / 65, 4);
    expect(zone.m1_fhwa).toBeCloseTo(38 / 65, 4);
  });
  it('orders the three thresholds as their speeds do', () => {
    // absolute 35.0 > relative 32.80 > FHWA 30.0, so exceedance falls in step
    expect(zone.m1_absolute).toBeGreaterThan(zone.m1_relative);
    expect(zone.m1_relative).toBeGreaterThan(zone.m1_fhwa);
  });
  it('reports the observed speeds', () => {
    expect(zone.speed_mean).toBeCloseTo(31.6, 0);
    expect(zone.speed_min).toBeLessThan(15);
  });
  it('carries the thresholds it was measured against', () => {
    expect(zone.reference_speed).toBeCloseTo(54.67, 1);
    expect(zone.fhwa_threshold_speed).toBe(30);
    expect(zone.phed_threshold_speed).toBe(30);
  });
});

describe('the two cases together', () => {
  it('separate zones roll up to a share between them', () => {
    const a = m1ForZone(cellsFromFixture(FIXTURE.no_impact));
    const b = m1ForZone(cellsFromFixture(FIXTURE.impact));
    const r = rollupM1([a, b]);
    expect(r.zones).toBe(2);
    // epoch-weighted: 49 of (73 + 65) epochs
    expect(r.m1_absolute_epoch_weighted).toBeCloseTo(49 / 138, 4);
    // zone-mean: the average of 0 and 0.7538
    expect(r.m1_absolute_zone_mean).toBeCloseTo((0 + 49 / 65) / 2, 4);
    // and the two answers differ — which is why both are published
    expect(r.m1_absolute_epoch_weighted).not.toBeCloseTo(r.m1_absolute_zone_mean, 3);
  });
  it('converts observed epochs to hours at five minutes each', () => {
    const r = rollupM1([m1ForZone(cellsFromFixture(FIXTURE.impact))]);
    expect(r.active_hours).toBeCloseTo((65 * 5) / 60, 1);
  });
});

describe('thresholds are dynamic', () => {
  it('a different absolute threshold changes the measure', () => {
    const c = FIXTURE.impact;
    const at35 = m1ForZone(cellsFromFixture(c, { absolute: 35 }));
    const at25 = m1ForZone(cellsFromFixture(c, { absolute: 25 }));
    const at45 = m1ForZone(cellsFromFixture(c, { absolute: 45 }));
    expect(at25.m1_absolute).toBeLessThan(at35.m1_absolute);
    expect(at45.m1_absolute).toBeGreaterThan(at35.m1_absolute);
  });
  it('a different relative percentage changes the measure', () => {
    const c = FIXTURE.impact;
    const at60 = m1ForZone(cellsFromFixture(c, { relativePct: 60 }));
    const at80 = m1ForZone(cellsFromFixture(c, { relativePct: 80 }));
    expect(at80.m1_relative).toBeGreaterThan(at60.m1_relative);
  });
});

describe('m1ForZone edge cases', () => {
  it('returns nulls and not-measurable for no cells', () => {
    const z = m1ForZone([]);
    expect(z.epochs_observed).toBe(0);
    expect(z.m1_absolute).toBeNull();
    expect(z.is_measurable).toBe(false);
  });
  it('flags a sample below the minimum rather than dropping it', () => {
    expect(DEFAULT_MIN_EPOCHS).toBe(12);
    const thin = [{
      wz_event_id: 'Z', hour: 3, epochs_observed: 4, epochs_below_absolute: 4,
      epochs_below_relative: 4, epochs_below_fhwa: 4, speed_mean: 10,
      density_a: 4, density_b: 0, density_c: 0,
    }];
    const z = m1ForZone(thin);
    expect(z.m1_absolute).toBe(1);          // reported
    expect(z.is_measurable).toBe(false);    // but not aggregated
    expect(rollupM1([z]).zones).toBe(0);
    expect(rollupM1([z]).zones_skipped).toBe(1);
  });
  it('weights cell speeds by the epochs behind them', () => {
    const cells = [
      { wz_event_id: 'Z', hour: 1, epochs_observed: 1, epochs_below_absolute: 0, epochs_below_relative: 0, epochs_below_fhwa: 0, speed_mean: 10, density_a: 1, density_b: 0, density_c: 0 },
      { wz_event_id: 'Z', hour: 2, epochs_observed: 11, epochs_below_absolute: 0, epochs_below_relative: 0, epochs_below_fhwa: 0, speed_mean: 60, density_a: 11, density_b: 0, density_c: 0 },
    ];
    // an unweighted mean would be 35; weighted is (10 + 660)/12 = 55.83
    expect(m1ForZone(cells).speed_mean).toBeCloseTo(55.83, 1);
  });
  it('groups cells by zone', () => {
    const g = groupCellsByZone([{ wz_event_id: 'A' }, { wz_event_id: 'B' }, { wz_event_id: 'A' }]);
    expect(g.size).toBe(2);
    expect(g.get('A')).toHaveLength(2);
  });
});

describe('golden: the PRIMARY threshold (posted limit − 10, floored at 20)', () => {
  // Counts computed by hand from the recorded travel times and frozen into the
  // fixture as expected_below_posted, so this checks the implementation against
  // an independent number rather than against itself.
  for (const key of ['no_impact', 'impact']) {
    const c = FIXTURE[key];

    it(`${key}: the segment threshold is min(limit, max(20, limit − 10))`, () => {
      expect(postedDropThresholdSpeed(c.avg_speedlimit))
        .toBeCloseTo(c.posted_threshold_speed, 6);
    });

    it(`${key}: counts the frozen number of epochs below it`, () => {
      const z = m1ForZone(cellsFromFixture(c));
      expect(z.epochs_below_posted).toBe(c.expected_below_posted);
      expect(z.m1_posted).toBeCloseTo(c.expected_below_posted / z.epochs_observed, 4);
    });
  }

  it('is the most sensitive of the four thresholds on the I-495 case', () => {
    // Posted 50 mph gives a 40 mph threshold, above the absolute 35, the
    // relative 32.80 and the PHED 30 — so it flags the most time. That ordering
    // is the point of the measure: it catches material slowdown, not only
    // severe congestion.
    const z = m1ForZone(cellsFromFixture(FIXTURE.impact));
    expect(z.epochs_below_posted).toBe(51);
    expect(z.epochs_below_absolute).toBe(49);
    expect(z.epochs_below_relative).toBe(48);
    expect(z.epochs_below_fhwa).toBe(38);
    expect(z.m1_posted).toBeGreaterThan(z.m1_absolute);
  });

  it('still reports zero where there is no impact', () => {
    // A looser threshold must not manufacture an exceedance: I-81 ran 59–73 mph
    // against a 46.71 threshold.
    const z = m1ForZone(cellsFromFixture(FIXTURE.no_impact));
    expect(z.epochs_below_posted).toBe(0);
    expect(z.m1_posted).toBe(0);
  });

  it('a different drop moves the primary measure and nothing else', () => {
    const base = m1ForZone(cellsFromFixture(FIXTURE.impact));
    const tight = m1ForZone(cellsFromFixture(FIXTURE.impact, { postedDrop: 25 }));
    expect(tight.m1_posted).toBeLessThan(base.m1_posted);
    expect(tight.m1_absolute).toBe(base.m1_absolute);
    expect(tight.m1_relative).toBe(base.m1_relative);
  });

  it('rolls up epoch-weighted and as a zone mean', () => {
    const r = rollupM1([
      m1ForZone(cellsFromFixture(FIXTURE.impact)),
      m1ForZone(cellsFromFixture(FIXTURE.no_impact)),
    ]);
    // 51 of (65 + 73) epochs.
    expect(r.m1_posted_epoch_weighted).toBeCloseTo(51 / 138, 4);
    expect(r.m1_posted_zone_mean).toBeCloseTo((51 / 65 + 0) / 2, 4);
  });
});
