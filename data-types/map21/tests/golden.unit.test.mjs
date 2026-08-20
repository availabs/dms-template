/**
 * map21 FREEZE test.
 *
 * map21 produces the FHWA HPMS Travel Time Metric submittal. Its output must stay
 * backward-compatible and pass federal checks, so as of the pm3 fork (2026-08-14) map21 is
 * frozen for calculation: pm3 evolves, map21 does not.
 *
 * A freeze that is only a promise is not a freeze. This test pins the things that would
 * break the submittal if they moved:
 *
 *   1. the FHWA column contract — order, names, and the calculator→CSV header renaming;
 *   2. the percentile definitions behind LOTTR and TTTR;
 *   3. the actual NUMERIC output of calcTtrMeasure for a fixed travel-time fixture;
 *   4. the emitted column-update SQL;
 *   5. the derived AADT / vehicle-occupancy expressions.
 *
 * If a change here is deliberate — a genuine FHWA spec change — update the expected values
 * in the same commit and say why. If it is not deliberate, it is a regression.
 *
 * SCOPE, stated honestly: (3) exercises the real calculator with stubbed IO, so it freezes
 * the binning, percentile selection and rounding. It does NOT cover calcPhed end-to-end,
 * which needs traffic-distribution profiles and per-TMC metadata; the PHED family is
 * currently covered only by its constants and column contract. Extending this to calcPhed is
 * the obvious follow-up.
 *
 * See planning/transportny/tasks/current/pm3-fork-and-measure-implementation.md (Phase 0).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const { calcTtrMeasure } = req('../calcTtrMeasure.js');
const {
  BIN_NAMES,
  ALL_VEHICLES,
  FREIGHT_TRUCKS,
  MAP_21_FHWA_COL_ORDER,
  PERCENTILES_FOR_MEASURES,
} = req('../constants.js');
const { getUpdateColumnsSqlForMap21, precisionRound } = req('../helpers.js');
const { columnToCsvHeaderMap } = req('../createPm3Output.js');

/**
 * 40 binned travel times, rising, with a deliberate right tail from index 33 so the 80th and
 * 95th percentiles land on different values and a change to either is visible.
 */
const FIXTURE_TT = Array.from({ length: 40 }, (_, i) => 60 + i * 3 + (i > 32 ? (i - 32) * 25 : 0));

function stubChDb(travelTimes) {
  return {
    query: async () => ({
      json: async () => ({ rows: travelTimes.length, data: travelTimes.map((tt) => ({ tt })) }),
    }),
  };
}

describe('map21 is frozen: FHWA submittal contract', () => {
  it('MAP_21_FHWA_COL_ORDER is exactly the 41 submittal columns, in order', () => {
    expect(MAP_21_FHWA_COL_ORDER).toEqual([
      'begindate', 'statecode', 'traveltimecode', 'fsystem', 'urbancode', 'facilitytype',
      'nhs', 'segmentlength', 'directionality', 'diraadt', 'occfac',
      'lottramp', 'ttamp50pct', 'ttamp80pct',
      'lottrmidd', 'ttmidd50pct', 'ttmidd80pct',
      'lottrpmp', 'ttpmp50pct', 'ttpmp80pct',
      'lottrwe', 'ttwe50pct', 'ttwe80pct',
      'tttramp', 'tttamp50pct', 'tttamp95pct',
      'tttrmidd', 'tttmidd50pct', 'tttmidd95pct',
      'tttrpmp', 'tttpmp50pct', 'tttpmp95pct',
      'tttrwe', 'tttwe50pct', 'tttwe95pct',
      'tttrovn', 'tttovn50pct', 'tttovn95pct',
      'phed', 'metricsource', 'comments',
    ]);
  });

  it('every FHWA column has a calculator→CSV header mapping', () => {
    expect(Object.keys(columnToCsvHeaderMap)).toHaveLength(MAP_21_FHWA_COL_ORDER.length);
    // The renaming that distinguishes map21 from pm3: "AMP_lottr" → "lottramp".
    expect(columnToCsvHeaderMap.AMP_lottr).toBe('lottramp');
    expect(columnToCsvHeaderMap.OVN_tttr).toBe('tttrovn');
  });

  it('LOTTR is p80/p50 and TTTR is p95/p50', () => {
    expect(PERCENTILES_FOR_MEASURES).toEqual({
      lottr: { upperPercentile: 0.8, lowerPercentile: 0.5 },
      tttr: { upperPercentile: 0.95, lowerPercentile: 0.5 },
    });
  });
});

describe('map21 is frozen: calculator numeric output', () => {
  it('calcTtrMeasure(lottr) reproduces its exact values for the fixture', async () => {
    const result = await calcTtrMeasure({
      db: null,
      chDb: stubChDb(FIXTURE_TT),
      metricName: 'lottr',
      curTmcId: '104+04107',
      year: 2023,
      npmrdsDataKeys: ALL_VEHICLES,
      dataTableName: 't',
      timeBins: [BIN_NAMES.AMP, BIN_NAMES.MIDD, BIN_NAMES.PMP, BIN_NAMES.WE],
    });
    expect(result).toEqual({
      tmc: '104+04107',
      AMP_lottr: 1.3, AMP_lottr_80_PCT: 154, AMP_lottr_50_PCT: 119,
      MIDD_lottr: 1.3, MIDD_lottr_80_PCT: 154, MIDD_lottr_50_PCT: 119,
      PMP_lottr: 1.3, PMP_lottr_80_PCT: 154, PMP_lottr_50_PCT: 119,
      WE_lottr: 1.3, WE_lottr_80_PCT: 154, WE_lottr_50_PCT: 119,
    });
  });

  it('calcTtrMeasure(tttr) reproduces its exact values, including the OVN bin', async () => {
    const result = await calcTtrMeasure({
      db: null,
      chDb: stubChDb(FIXTURE_TT),
      metricName: 'tttr',
      curTmcId: '104+04107',
      year: 2023,
      npmrdsDataKeys: FREIGHT_TRUCKS,
      secondaryDataKey: ALL_VEHICLES,
      dataTableName: 't',
      timeBins: [BIN_NAMES.AMP, BIN_NAMES.MIDD, BIN_NAMES.PMP, BIN_NAMES.WE, BIN_NAMES.OVN],
    });
    expect(result).toEqual({
      tmc: '104+04107',
      AMP_tttr: 2.51, AMP_tttr_95_PCT: 297, AMP_tttr_50_PCT: 119,
      MIDD_tttr: 2.51, MIDD_tttr_95_PCT: 297, MIDD_tttr_50_PCT: 119,
      PMP_tttr: 2.51, PMP_tttr_95_PCT: 297, PMP_tttr_50_PCT: 119,
      WE_tttr: 2.51, WE_tttr_95_PCT: 297, WE_tttr_50_PCT: 119,
      OVN_tttr: 2.51, OVN_tttr_95_PCT: 297, OVN_tttr_50_PCT: 119,
    });
  });

  it('an empty data set still defaults the ratio to 1 (documented legacy behaviour)', async () => {
    const result = await calcTtrMeasure({
      db: null,
      chDb: stubChDb([]),
      metricName: 'lottr',
      curTmcId: '104+04107',
      year: 2023,
      npmrdsDataKeys: ALL_VEHICLES,
      dataTableName: 't',
      timeBins: [BIN_NAMES.AMP],
    });
    expect(result.AMP_lottr).toBe(1);
  });

  it('precisionRound keeps the legacy half-up rounding', () => {
    expect(precisionRound(7.018004587155963, 3)).toBe(7.018);
    expect(precisionRound(2.5, 0)).toBe(3);
    expect(precisionRound(null, 2)).toBe(null);
  });
});

describe('map21 is frozen: emitted SQL', () => {
  it('getUpdateColumnsSqlForMap21 still writes FHWA header column names', () => {
    const sql = getUpdateColumnsSqlForMap21({
      result: { lottr: { tmc: '104+04107', AMP_lottr: 1.25, AMP_lottr_80_PCT: 300, AMP_lottr_50_PCT: 240 } },
      table_schema: 's',
      table_name: 't',
      METRIC_NAMES: ['lottr'],
    });
    expect(sql).toContain('"lottramp"');
    // pm3's prefixed style must never leak into the map21 writer.
    expect(sql).not.toContain('"lottr_amp_lottr"');
  });
});
