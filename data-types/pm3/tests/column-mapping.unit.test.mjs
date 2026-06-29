/**
 * Unit tests: pm3's per-metric DB column writers.
 *
 * pm3-vs-map21 differences encoded here:
 *   - map21 renames calculator outputs to FHWA CSV headers via
 *     columnToCsvHeaderMap ("AMP_lottr" → "lottramp") and writes ONE row per
 *     TMC across all metrics;
 *   - pm3 lowercases the calculator's intermediate keys and prefixes them with
 *     the metric name ("AMP_lottr" → "lottr_amp_lottr"), writing per-metric
 *     upserts against a named UNIQUE(tmc, year) constraint
 *     (METRIC_WRITES_DB=true semantics).
 */
import { describe, it, expect } from 'vitest';
import helpers from '../helpers.js';
import map21Helpers from '../../map21/helpers.js';

const { toMetricDbRow, generateUpdateColumnsSql, getDataRowInsertSql } = helpers;
const { getUpdateColumnsSqlForMap21 } = map21Helpers;

// A calculator output as map21's ported calcTtrMeasure actually returns it.
const TTR_RESULT = {
  tmc: '104+04107',
  AMP_lottr: 1.25,
  AMP_lottr_80_PCT: 300,
  AMP_lottr_50_PCT: 240,
};

describe('toMetricDbRow — lowercase column mapping (LOWER_CASE_COLUMNS=true)', () => {
  it('lowercases every calculator output key', () => {
    expect(toMetricDbRow(TTR_RESULT)).toEqual({
      tmc: '104+04107',
      amp_lottr: 1.25,
      amp_lottr_80_pct: 300,
      amp_lottr_50_pct: 240,
    });
  });

  it('drops non-scalar entries (calcPhed returns a nested meta object that is never a column)', () => {
    const phedResult = { tmc: 't', meta: { threshold_speed: 33 }, all_xdelay_phrs: 1.5 };
    expect(toMetricDbRow(phedResult)).toEqual({ tmc: 't', all_xdelay_phrs: 1.5 });
  });
});

describe('generateUpdateColumnsSql — metric-prefixed lowercase columns', () => {
  it('prefixes every column with the metric name, except tmc/year', () => {
    const sql = generateUpdateColumnsSql({
      tmcRow: { ...toMetricDbRow(TTR_RESULT), year: 2023 },
      metricName: 'lottr',
      table_schema: 'pm3',
      table_name: 't1',
    });
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "lottr_amp_lottr" NUMERIC');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "lottr_amp_lottr_80_pct" NUMERIC');
    expect(sql).not.toContain('"lottr_tmc"');
    expect(sql).not.toContain('"lottr_year"');
  });

  it('speed percentile keys become speed_pctl_<n> columns', () => {
    const sql = generateUpdateColumnsSql({
      tmcRow: { tmc: 't', year: 2023, 5: 22.25, 95: 62.75 },
      metricName: 'speed_pctl',
      table_schema: 'pm3',
      table_name: 't1',
    });
    expect(sql).toContain('"speed_pctl_5" NUMERIC');
    expect(sql).toContain('"speed_pctl_95" NUMERIC');
  });
});

describe('getDataRowInsertSql — per-metric upsert (METRIC_WRITES_DB=true semantics)', () => {
  const sql = getDataRowInsertSql({
    result: { ...toMetricDbRow(TTR_RESULT), year: 2023 },
    table_schema: 'pm3',
    table_name: 't1',
    prefix: 'lottr',
    constraint: 'ON CONSTRAINT tmc_year_42_constraint',
  });

  it('inserts metric-prefixed columns but leaves tmc/year unprefixed', () => {
    expect(sql).toContain('"lottr_amp_lottr"');
    expect(sql).toContain('"tmc"');
    expect(sql).toContain('"year"');
    expect(sql).not.toContain('"lottr_tmc"');
    expect(sql).not.toContain('"lottr_year"');
  });

  it('upserts against the named UNIQUE(tmc, year) constraint', () => {
    expect(sql).toMatch(/ON CONFLICT ON CONSTRAINT tmc_year_42_constraint/);
    expect(sql).toMatch(/DO UPDATE/);
    expect(sql).toContain('"lottr_amp_lottr"=EXCLUDED."lottr_amp_lottr"');
  });

  it('quotes strings and skips null-ish values (legacy truthy filter, verbatim)', () => {
    const s = getDataRowInsertSql({
      result: { tmc: 'abc', year: 2023, foo: null, bar: 1.5 },
      table_schema: 'pm3', table_name: 't1', prefix: 'm',
      constraint: 'ON CONSTRAINT c',
    });
    expect(s).toContain(`'abc'`);
    expect(s).not.toContain('"m_foo"');
    expect(s).toContain('"m_bar"');
  });

  it('defaults the conflict target to ("tmc") when no constraint is given (legacy default)', () => {
    const s = getDataRowInsertSql({
      result: { tmc: 'abc', year: 2023 },
      table_schema: 'pm3', table_name: 't1', prefix: 'm',
    });
    expect(s).toMatch(/ON CONFLICT \("tmc"\)/);
  });
});

describe('pm3 vs map21: same calculator output, different physical columns', () => {
  it('map21 writes FHWA headers ("lottramp"); pm3 writes prefixed lowercase ("lottr_amp_lottr")', () => {
    // map21 path — the FHWA-renamed single-row writer
    const map21Sql = getUpdateColumnsSqlForMap21({
      result: { lottr: TTR_RESULT },
      table_schema: 's', table_name: 't',
      METRIC_NAMES: ['lottr'],
    });
    expect(map21Sql).toContain('"lottramp"');
    expect(map21Sql).not.toContain('"lottr_amp_lottr"');

    // pm3 path — lowercase + metric prefix, no FHWA renaming
    const pm3Sql = generateUpdateColumnsSql({
      tmcRow: { ...toMetricDbRow(TTR_RESULT), year: 2023 },
      metricName: 'lottr',
      table_schema: 's', table_name: 't',
    });
    expect(pm3Sql).toContain('"lottr_amp_lottr"');
    expect(pm3Sql).not.toContain('"lottramp"');
  });
});
