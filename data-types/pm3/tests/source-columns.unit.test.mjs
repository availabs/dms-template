/**
 * metadata.columns must describe EVERY column a pm3 view exposes.
 *
 * The macroview map builds its data-column by string construction
 * (themes/transportny/components/macroview/updateFilters.jsx `getMeasure`) and
 * reads tiles/colorDomain straight off the relation, so the map keeps working
 * even when metadata.columns is short — but the download-modal column picker
 * and the UDA table page read metadata.columns, so a short list shows up as
 * "the map renders a measure I cannot download". Live source 1410 lists 105 of
 * its 121 columns, and the pre-2026-08 generator emitted only 66.
 *
 * The authoritative cross-check against a real published table lives in
 * worker.integration.js; these tests pin the enumeration itself.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const worker = require('../worker.js');
const { META_COLUMNS } = require('../helpers.js');
const { PERCENTILES } = require('../speedPercentilesCalculator.js');

const { PM3_SOURCE_COLUMNS, buildPm3SourceColumns, buildMetricConfigs, metricColumnDescriptors } = worker;
const names = new Set(PM3_SOURCE_COLUMNS.map((c) => c.name));

describe('PM3_SOURCE_COLUMNS', () => {
  it('lists every meta column', () => {
    for (const c of META_COLUMNS) expect(names).toContain(c);
  });

  it('has no duplicates and every entry is fully described', () => {
    expect(PM3_SOURCE_COLUMNS.length).toBe(names.size);
    for (const c of PM3_SOURCE_COLUMNS) {
      expect(c.name, JSON.stringify(c)).toBeTruthy();
      expect(c.display_name, JSON.stringify(c)).toBeTruthy();
      // BOOLEAN joined the set with R9's era-boundary flags — the only non-numeric,
      // non-text published column type in pm3.
      expect(['NUMERIC', 'TEXT', 'GEOMETRY', 'BOOLEAN']).toContain(c.type);
    }
  });

  it('lists all 8 speed percentiles', () => {
    for (const p of PERCENTILES) expect(names).toContain(`speed_pctl_${p}`);
  });

  it('lists the LOTTR/TTTR percentile travel times the old generator dropped', () => {
    for (const bin of ['amp', 'midd', 'pmp', 'we']) {
      expect(names).toContain(`lottr_${bin}_lottr`);
      expect(names).toContain(`lottr_${bin}_lottr_80_pct`);
      expect(names).toContain(`lottr_${bin}_lottr_50_pct`);
    }
    for (const bin of ['amp', 'midd', 'pmp', 'we', 'ovn']) {
      expect(names).toContain(`tttr_${bin}_tttr`);
      expect(names).toContain(`tttr_${bin}_tttr_95_pct`);
      expect(names).toContain(`tttr_${bin}_tttr_50_pct`);
    }
  });

  it('lists the per-peak PHED columns the old generator dropped', () => {
    for (const m of ['phed', 'phed_freeflow', 'phed_truck', 'phed_truck_freeflow']) {
      for (const bin of ['amp', 'pmp']) {
        expect(names).toContain(`${m}_${bin}_all_xdelay_phrs`);
        expect(names).toContain(`${m}_${bin}_all_xdelay_vhrs`);
        expect(names).toContain(`${m}_${bin}_xdelay_hrs`);
      }
      // annual accumulators
      expect(names).toContain(`${m}_all_xdelay_phrs`);
      expect(names).toContain(`${m}_xdelay_hrs`);
    }
  });

  it('names the PHED PM-peak columns pmp, not alt_pmp (calcPhed relabels the bin)', () => {
    expect(names).toContain('phed_pmp_all_xdelay_phrs');
    expect([...names].filter((n) => n.includes('alt_pmp'))).toEqual([]);
  });

  it('covers every column the macroview getMeasure() can construct', () => {
    // Mirrors updateFilters.jsx getMeasure(): measure [_truck] [_freeflow]
    // [_peak] _unit for phed/ted, measure_peak_measure for lottr/tttr,
    // speed_pctl_N for percentile speed.
    const wanted = [];
    for (const bin of ['amp', 'midd', 'pmp', 'we']) wanted.push(`lottr_${bin}_lottr`);
    for (const bin of ['amp', 'midd', 'pmp', 'we', 'ovn']) wanted.push(`tttr_${bin}_tttr`);
    for (const p of PERCENTILES) wanted.push(`speed_pctl_${p}`);
    for (const measure of ['phed', 'ted']) {
      for (const truck of ['', '_truck']) {
        for (const ff of ['', '_freeflow']) {
          for (const unit of ['all_xdelay_phrs', 'all_xdelay_vhrs', 'xdelay_hrs']) {
            wanted.push(`${measure}${truck}${ff}_${unit}`);
            // peak variants exist for phed only (ted has a single ALL bin)
            if (measure === 'phed') {
              for (const peak of ['amp', 'pmp']) wanted.push(`${measure}${truck}${ff}_${peak}_${unit}`);
            }
          }
        }
      }
    }
    const missing = wanted.filter((w) => !names.has(w));
    expect(missing).toEqual([]);
  });

  it('skips speed_pctl entries when the metric is not in the registry', () => {
    const { speed_pctl, ...rest } = buildMetricConfigs({ chMetaTableName: '' });
    const cols = new Set(buildPm3SourceColumns(rest).map((c) => c.name));
    expect(cols.has('speed_pctl_5')).toBe(false);
    expect(cols.has('lottr_amp_lottr')).toBe(true);
  });

  it('refuses an unknown metric kind rather than silently emitting nothing', () => {
    expect(() => metricColumnDescriptors('mystery', { kind: 'nope', timeBins: [] }))
      .toThrow(/unknown metric kind/);
  });
});

// ── R3: persisted PHED threshold diagnostics ────────────────────────────────
// calcPhed always computed threshold_speed / threshold_travel_time_sec / the p15 and returned
// the first two only inside a `meta` object that toMetricDbRow discards, so they never reached
// the table. Four analyses (H3, H5, H7, H12) each had to re-derive them from raw ClickHouse to
// answer a question a stored column answers with a join, and R2 (the anchored reference) cannot
// be audited after the fact without them.
describe('R3 — PHED threshold diagnostics are published', () => {
  const cfgs = buildMetricConfigs({ chMetaTableName: 'x.y' });
  const PHED_METRICS = Object.keys(cfgs).filter((m) => cfgs[m].kind === 'phed');

  it('every phed/ted variant publishes threshold_speed and threshold_travel_time_sec', () => {
    // 8 original + R2's 4 anchored variants published alongside them.
    expect(PHED_METRICS.length).toBe(12);
    for (const m of PHED_METRICS) {
      const names = metricColumnDescriptors(m, cfgs[m]).map((c) => c.name);
      expect(names).toContain(`${m}_threshold_speed`);
      expect(names).toContain(`${m}_threshold_travel_time_sec`);
    }
  });

  it('tt_15_pct is published ONLY for variants with a percentile behind the threshold', () => {
    for (const m of PHED_METRICS) {
      const names = metricColumnDescriptors(m, cfgs[m]).map((c) => c.name);
      const hasP15 = names.includes(`${m}_tt_15_pct`);
      // Both freeflow flavours have one: 'freeflow' takes the p15 over the publish year,
      // 'freeflow_anchored' (R2) over a fixed single-era window. The speed_limit variants derive
      // their threshold from posted speed, so a tt_15_pct column there would be permanently null.
      const derivesFromPercentile = ['freeflow', 'freeflow_anchored']
        .includes(cfgs[m].thresholdSpeedVersion);
      expect(hasP15, `${m} (${cfgs[m].thresholdSpeedVersion})`).toBe(derivesFromPercentile);
    }
  });

  it('the diagnostics are NUMERIC, like every other metric column', () => {
    const ff = metricColumnDescriptors('phed_freeflow', cfgs.phed_freeflow);
    for (const n of ['phed_freeflow_threshold_speed', 'phed_freeflow_tt_15_pct']) {
      expect(ff.find((c) => c.name === n).type).toBe('NUMERIC');
    }
  });
});
