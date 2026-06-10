/**
 * Unit tests: the pm3-only speed_pctl metric (speedPercentilesCalculator).
 *
 * pm3-vs-map21 difference encoded here: map21 has no speed metric at all.
 * The calculator computes [5,20,25,50,75,80,85,95] percentiles of per-15-min
 * average all-vehicle speeds (miles / travel_time * 3600) over the ALL bin.
 *
 * ClickHouse is reached ONLY through the injected chDb stub.
 */
import { describe, it, expect } from 'vitest';
import calc from '../speedPercentilesCalculator.js';

const { speedPercentilesCalculator, generateAvgVehicleSpeedQuery, PERCENTILES } = calc;

// Fixture speed array (mph) + expected R-7 (linear-interpolation) quantiles,
// matching the quantile implementation map21's port standardized on.
const SPEEDS = [60, 55, 50, 45, 40, 35, 30, 25, 20, 65];
const EXPECTED = { 5: 22.25, 20: 29, 25: 31.25, 50: 42.5, 75: 53.75, 80: 56, 85: 58.25, 95: 62.75 };

function stubChDb() {
  const queries = [];
  return {
    queries,
    async query({ query }) {
      queries.push(query);
      return {
        json: async () => ({
          rows: SPEEDS.length,
          data: SPEEDS.map((s) => ({ avg_speed_all_vehicles: s })),
        }),
      };
    },
  };
}

describe('PERCENTILES', () => {
  it('is the legacy pm3 list', () => {
    expect(PERCENTILES).toEqual([5, 20, 25, 50, 75, 80, 85, 95]);
  });
});

describe('speedPercentilesCalculator', () => {
  it('computes all 8 percentiles from the fixture speed array', async () => {
    const chDb = stubChDb();
    const result = await speedPercentilesCalculator({
      chDb,
      curTmcId: '104+04107',
      year: 2023,
      dataTableName: 'raw_tbl',
      metadataTable: 'npmrds_meta.meta_tbl',
      timeBins: ['ALL'],
      metricName: 'speed_pctl',
    });
    for (const [pctl, expected] of Object.entries(EXPECTED)) {
      expect(result[pctl]).toBeCloseTo(expected, 6);
    }
    expect(result.tmc).toBe('104+04107');
    expect(chDb.queries.length).toBe(1);
  });

  it('is pure — returns the percentiles without writing to any DB itself', async () => {
    // No db adapter passed at all: would throw if the calculator tried to write.
    const result = await speedPercentilesCalculator({
      chDb: stubChDb(),
      curTmcId: 't', year: 2023,
      dataTableName: 'raw', metadataTable: 'm.t',
      timeBins: ['ALL'], metricName: 'speed_pctl',
    });
    expect(Object.keys(result).sort()).toEqual(
      [...PERCENTILES.map(String), 'tmc'].sort()
    );
  });
});

describe('generateAvgVehicleSpeedQuery', () => {
  const base = {
    tmc: '104+04107',
    metadataTable: 'npmrds_meta.meta_tbl',
    dataTableName: 'raw_tbl',
    year: 2023,
    hours: [0, 1, 2, 3],
    dow: [1, 2, 3, 4, 5],
    epochsPerBin: 3,
  };

  it('computes speed as miles / travel_time_all_vehicles * 3600 joined to the CH meta table', () => {
    const sql = generateAvgVehicleSpeedQuery(base);
    expect(sql).toMatch(/attr\.miles\s*\/\s*NULLIF\(travel_time_all_vehicles, 0\)\s*\*\s*3600/);
    expect(sql).toContain('npmrds_meta.meta_tbl AS attr USING (tmc)');
    expect(sql).toContain(`tmc = '104+04107'`);
    expect(sql).toContain('npmrds.raw_tbl');
  });

  it('filters by year when no dates given, by date range when given', () => {
    const byYear = generateAvgVehicleSpeedQuery(base);
    expect(byYear).toMatch(/EXTRACT\(YEAR from .*date\) = 2023/);

    const byDates = generateAvgVehicleSpeedQuery({ ...base, dates: ['2023-01-01', '2023-06-30'] });
    expect(byDates).toContain(`date >= '2023-01-01'`);
    expect(byDates).toContain(`date <= '2023-06-30'`);
    expect(byDates).not.toMatch(/EXTRACT\(YEAR from .*date\) = 2023/);
  });

  it('restricts to the bin hours and days-of-week and bins epochs', () => {
    const sql = generateAvgVehicleSpeedQuery(base);
    expect(sql).toContain('in (0,1,2,3)');
    expect(sql).toContain('toDayOfWeek(date, 2) in (1,2,3,4,5)');
    expect(sql).toMatch(/FLOOR\(epoch::NUMERIC \/ 3::NUMERIC\)/);
  });
});
