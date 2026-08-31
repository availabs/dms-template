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
const { toMetricDbRow } = require('../helpers.js');
const { omitPrefixColumns } = require('../lib/helpers.js');

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
      // INTEGER joined the set with ogc_fid, which must be declared so uda can resolve the view's
      // index column — a view has no PRIMARY KEY for resolvePrimaryKey to find.
      expect(['NUMERIC', 'TEXT', 'GEOMETRY', 'BOOLEAN', 'INTEGER']).toContain(c.type);
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
    // Scoped to the MEASURE columns. The `coverage` metric deliberately publishes pmp and alt_pmp
    // separately, because they are genuinely different windows (PMP 16-19, ALT_PMP 15-18) with
    // different denominators, and reporting one under the other's name would misstate it.
    //
    // ⚠ That exposes a PRE-EXISTING ambiguity in the measure columns, not one coverage introduced:
    // `lottr_pmp_*` is the PMP window (16-19) while `phed_pmp_*` is ALT_PMP (15-18). Two different
    // hour ranges published under the same bin label, distinguished only by measure prefix. Anyone
    // joining a LOTTR PM-peak figure to a PHED PM-peak figure is comparing different windows.
    // Left as-is here because renaming a published column is breaking; recorded in PROVENANCE.md.
    const measureCols = [...names].filter((n) => !n.startsWith('coverage_'));
    expect(measureCols.filter((n) => n.includes('alt_pmp'))).toEqual([]);
    // coverage names both, honestly
    expect(names).toContain('coverage_all_vehicles_pmp_pct_bins_reporting');
    expect(names).toContain('coverage_all_vehicles_alt_pmp_pct_bins_reporting');
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
    // 8 original + R2's 4 anchored + R13's 4 unfloored (relative) variants.
    expect(PHED_METRICS.length).toBe(16);
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

// ── Registry-wide invariant: what a calculator writes must be a declared column ──────────────
// Added after task 7132 was abandoned 18 minutes into a 5-hour publish: coverageCalculator returned
// keys already prefixed `coverage_`, the row writer prefixed with the metric name again, and the
// INSERT targeted `coverage_coverage_*` while the bulk ALTER had created `coverage_*`. Nothing landed
// and every unit test passed, because no test compared the two sides.
//
// This closes the class, not the instance: for every metric, run its calculator against a stub and
// assert each key it produces maps to a column metadata.columns actually declares.
describe('every calculator key maps to a declared column', () => {
  const cfgs = buildMetricConfigs({ chMetaTableName: 'npmrds_meta.t' });
  const declared = new Set(buildPm3SourceColumns(cfgs).map((c) => c.name));

  // Rich enough to satisfy calcPhed's metadata gate and to give every calculator rows to work with.
  const META = {
    tmc: 'x', miles: 1.0, avg_speedlimit: 55, directionalaadt: 5000, directionalaadttruck: 300,
    avg_vehicle_occupancy: 1.7, avgvehicleoccupancytruck: 10.7, functionalclass: 'FREEWAY',
    congestion_level: 'NO2LOW_CONGESTION', directionality: 'AM_PEAK', nhs_pct: 100, nhs: '0', year: 2025,
  };
  const ROWS = [
    { tmc: 'x', date: '2025-03-03', month: 3, dow: 1, timeBinNum: 28, tt: 100, n_epochs: 3, avg_speed_all_vehicles: 55 },
    { tmc: 'x', date: '2025-03-03', month: 3, dow: 1, timeBinNum: 29, tt: 400, n_epochs: 2, avg_speed_all_vehicles: 40 },
  ];
  const chDb = { query: async () => ({ json: async () => ({ rows: ROWS.length, data: ROWS }) }) };

  // Mirrors the worker's write path: toMetricDbRow lowercases and drops objects, then
  // generateUpdateColumnsSql prefixes every non-omitted key with the metric name.
  const writtenColumns = (metricName, result) =>
    Object.keys(toMetricDbRow(result))
      .filter((k) => !omitPrefixColumns.includes(k))
      .map((k) => `${metricName}_${k}`);

  for (const [metricName, cfg] of Object.entries(cfgs)) {
    it(`${metricName}: every written column is declared`, async () => {
      const result = await cfg.calculator({
        db: null, chDb, pgEnv: 'x', curTmcId: 'x', year: 2025, dataTableName: 't',
        tmcMeta: META, metricName, binnedDataCache: new Map(), freeflowP15Cache: new Map(), ...cfg,
      });
      expect(result, `${metricName} produced no result`).toBeTruthy();
      const undeclared = writtenColumns(metricName, result).filter((c) => !declared.has(c));
      // If this fails the publish would silently write nothing for those columns — the ALTER creates
      // the declared name while the INSERT targets a different one.
      expect(undeclared).toEqual([]);
    });
  }
});
