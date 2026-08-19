/**
 * Unit tests: the pm3 metric registry.
 *
 * pm3-vs-map21 difference encoded here:
 *   - map21 computes 3 metrics (lottr, tttr, phed);
 *   - pm3 computes 11: speed_pctl + lottr/tttr + the full phed/ted family
 *     (speed-limit and freeflow thresholds, all-vehicles and truck).
 */
import { describe, it, expect } from 'vitest';
import worker from '../worker.js';

const { METRIC_NAMES, buildMetricConfigs } = worker;

// map21/worker.js's metric list (read-only dependency — re-encoded here as the
// reference value; see METRIC_CONFIGS in data-types/map21/worker.js).
const MAP21_METRIC_NAMES = ['lottr', 'tttr', 'phed'];

// The 11 metrics pm3 published before the 2026-08-14 fork. Kept as a named list because
// backward compatibility for existing consumers is asserted against it below: post-fork
// additions must EXTEND this set, never reorder or drop from it.
const LEGACY_PM3_METRIC_NAMES = [
  'speed_pctl',
  'lottr',
  'tttr',
  'phed',
  'phed_freeflow',
  'phed_truck',
  'phed_truck_freeflow',
  'ted',
  'ted_freeflow',
  'ted_truck',
  'ted_truck_freeflow',
];

// Metrics added after the fork, in the order they were introduced.
// R1: a truck p80/p50 alongside the federally-required p95/p50 TTTR.
// R2: the four delay measures recomputed against a FIXED single-era free-flow reference, published
//     alongside the own-year versions for a transition period (worth +6.69% on network delay).
const POST_FORK_METRIC_NAMES = [
  'tttr_p80',
  'phed_freeflow_anchored', 'phed_truck_freeflow_anchored',
  'ted_freeflow_anchored', 'ted_truck_freeflow_anchored',
];

describe('pm3 metric registry', () => {
  it('still computes every legacy metric, and none was reordered', () => {
    // Additions may appear anywhere; removals and reorderings are breaking changes for
    // anyone reading the published columns, so the legacy list is checked as an ordered
    // subsequence rather than by equality.
    const legacyInOrder = METRIC_NAMES.filter((m) => LEGACY_PM3_METRIC_NAMES.includes(m));
    expect(legacyInOrder).toEqual(LEGACY_PM3_METRIC_NAMES);
  });

  it('adds exactly the post-fork metrics and nothing unaccounted for', () => {
    const added = METRIC_NAMES.filter((m) => !LEGACY_PM3_METRIC_NAMES.includes(m));
    // If this fails, a metric was added without being recorded above — say what it is and why.
    expect(added).toEqual(POST_FORK_METRIC_NAMES);
  });

  it('is a strict superset of map21', () => {
    for (const m of MAP21_METRIC_NAMES) expect(METRIC_NAMES).toContain(m);
    const pm3Only = METRIC_NAMES.filter((m) => !MAP21_METRIC_NAMES.includes(m));
    expect(pm3Only).toEqual([
      'speed_pctl',
      'tttr_p80',
      'phed_freeflow', 'phed_truck', 'phed_truck_freeflow',
      'ted', 'ted_freeflow', 'ted_truck', 'ted_truck_freeflow',
      'phed_freeflow_anchored', 'phed_truck_freeflow_anchored',
      'ted_freeflow_anchored', 'ted_truck_freeflow_anchored',
    ]);
  });

  it('R1: tttr_p80 reads the truck stream at p80/p50, leaving TTTR at p95/p50', () => {
    const cfg = buildMetricConfigs({ chMetaTableName: 'x.y' });
    // Same stream, same bins, same calculator as TTTR — only the quantile pair differs.
    expect(cfg.tttr_p80.npmrdsDataKeys).toBe(cfg.tttr.npmrdsDataKeys);
    expect(cfg.tttr_p80.secondaryDataKey).toBe(cfg.tttr.secondaryDataKey);
    expect(cfg.tttr_p80.timeBins).toEqual(cfg.tttr.timeBins);
    expect(cfg.tttr_p80.calculator).toBe(cfg.tttr.calculator);
    expect(cfg.tttr_p80.kind).toBe('ttr');
  });

  it('configures speed_pctl over the ALL bin with the CH meta table injected at runtime', () => {
    const cfg = buildMetricConfigs({ chMetaTableName: 'npmrds_meta.tbl_2023' });
    expect(cfg.speed_pctl.timeBins).toEqual(['ALL']);
    expect(cfg.speed_pctl.metadataTable).toBe('npmrds_meta.tbl_2023');
    expect(typeof cfg.speed_pctl.calculator).toBe('function');
  });

  it('uses truck AVO/AADT keys for the *_truck metrics and all-vehicle keys otherwise', () => {
    const cfg = buildMetricConfigs({ chMetaTableName: 'x.y' });
    for (const m of ['phed_truck', 'phed_truck_freeflow', 'ted_truck', 'ted_truck_freeflow']) {
      expect(cfg[m].avoKey).toBe('avgvehicleoccupancytruck');
      expect(cfg[m].dirAadtKey).toBe('directionalaadttruck');
      expect(cfg[m].npmrdsDataKeys).toBe('travel_time_freight_trucks');
      expect(cfg[m].secondaryDataKey).toBe('travel_time_all_vehicles');
    }
    for (const m of ['phed', 'phed_freeflow', 'ted', 'ted_freeflow']) {
      expect(cfg[m].avoKey).toBe('avg_vehicle_occupancy');
      expect(cfg[m].dirAadtKey).toBe('directionalaadt');
      expect(cfg[m].npmrdsDataKeys).toBe('travel_time_all_vehicles');
    }
  });

  it('uses freeflow threshold speed for *_freeflow variants and speed_limit otherwise', () => {
    const cfg = buildMetricConfigs({ chMetaTableName: 'x.y' });
    for (const m of ['phed_freeflow', 'phed_truck_freeflow', 'ted_freeflow', 'ted_truck_freeflow']) {
      expect(cfg[m].thresholdSpeedVersion).toBe('freeflow');
    }
    for (const m of ['phed', 'phed_truck', 'ted', 'ted_truck']) {
      expect(cfg[m].thresholdSpeedVersion).toBe('speed_limit');
    }
  });

  it('ted* metrics run over the ALL bin; phed* over AMP + ALT_PMP (legacy peak windows)', () => {
    const cfg = buildMetricConfigs({ chMetaTableName: 'x.y' });
    for (const m of ['ted', 'ted_freeflow', 'ted_truck', 'ted_truck_freeflow']) {
      expect(cfg[m].timeBins).toEqual(['ALL']);
    }
    for (const m of ['phed', 'phed_freeflow', 'phed_truck', 'phed_truck_freeflow']) {
      expect(cfg[m].timeBins).toEqual(['AMP', 'ALT_PMP']);
    }
  });

  it('wires the forked lib calculators (lottr/tttr → calcTtrMeasure, phed family → calcPhed)', async () => {
    // require() through the same CJS loader the worker uses, so identity
    // (===) proves reuse rather than a copied implementation.
    const { createRequire } = await import('node:module');
    const req = createRequire(import.meta.url);
    const { calcTtrMeasure } = req('../lib/calcTtrMeasure.js');
    const { calcPhed } = req('../lib/calcPhed.js');
    const cfg = buildMetricConfigs({ chMetaTableName: 'x.y' });
    expect(cfg.lottr.calculator).toBe(calcTtrMeasure);
    expect(cfg.tttr.calculator).toBe(calcTtrMeasure);
    for (const m of ['phed', 'phed_freeflow', 'phed_truck', 'phed_truck_freeflow',
                     'ted', 'ted_freeflow', 'ted_truck', 'ted_truck_freeflow']) {
      expect(cfg[m].calculator).toBe(calcPhed);
    }
  });
});

// ── R4: per-time-bin completeness from the TTR calculator ───────────────────
describe('R4 — calcTtrMeasure reports completeness per time bin', () => {
  // Same idiom the metric-registry test above uses: this file is ESM and the calculators are CJS.
  async function lib() {
    const { createRequire } = await import('node:module');
    const req2 = createRequire(import.meta.url);
    return {
      calcTtrMeasure: req2('../lib/calcTtrMeasure.js').calcTtrMeasure,
      ...req2('../lib/constants.js'),
    };
  }

  // Bin means with a KNOWN epoch depth each: 3,3,3,2,1 -> mean 2.4 epochs per bin over 5 bins.
  const BINS = [
    { tt: 100, n_epochs: 3 }, { tt: 110, n_epochs: 3 }, { tt: 120, n_epochs: 3 },
    { tt: 130, n_epochs: 2 }, { tt: 400, n_epochs: 1 },
  ];
  const chDb = {
    query: async () => ({ json: async () => ({ rows: BINS.length, data: BINS }) }),
  };

  it('returns n_bins and mean_epochs_per_bin alongside the ratio', async () => {
    const { calcTtrMeasure, BIN_NAMES, ALL_VEHICLES } = await lib();
    const r = await calcTtrMeasure({
      db: null, chDb, metricName: 'lottr', curTmcId: 'x', year: 2025,
      npmrdsDataKeys: ALL_VEHICLES, dataTableName: 't', timeBins: [BIN_NAMES.AMP],
    });
    expect(r.AMP_n_bins).toBe(5);
    expect(r.AMP_mean_epochs_per_bin).toBe(2.4);
    // the ratio itself must be unaffected by the new bookkeeping
    expect(r.AMP_lottr).toBeGreaterThan(1);
  });

  it('reports completeness independently for each time bin', async () => {
    const { calcTtrMeasure, BIN_NAMES, ALL_VEHICLES } = await lib();
    const r = await calcTtrMeasure({
      db: null, chDb, metricName: 'lottr', curTmcId: 'x', year: 2025,
      npmrdsDataKeys: ALL_VEHICLES, dataTableName: 't',
      timeBins: [BIN_NAMES.AMP, BIN_NAMES.MIDD],
    });
    // Per-bin, not once per row: the ~5x diurnal coverage swing means one figure per row would
    // misdescribe an AM-peak LOTTR and an overnight TTTR on the same segment.
    for (const b of ['AMP', 'MIDD']) {
      expect(r[`${b}_n_bins`]).toBe(5);
      expect(r[`${b}_mean_epochs_per_bin`]).toBe(2.4);
    }
  });

  it('degrades safely to zero when the feed omits the epoch count', async () => {
    const { calcTtrMeasure, BIN_NAMES, ALL_VEHICLES } = await lib();
    const bare = { query: async () => ({ json: async () => ({ rows: 2, data: [{ tt: 100 }, { tt: 200 }] }) }) };
    const r = await calcTtrMeasure({
      db: null, chDb: bare, metricName: 'lottr', curTmcId: 'x', year: 2025,
      npmrdsDataKeys: ALL_VEHICLES, dataTableName: 't', timeBins: [BIN_NAMES.AMP],
    });
    expect(r.AMP_n_bins).toBe(2);
    expect(r.AMP_mean_epochs_per_bin).toBe(0);
  });

  it('an empty bin reports zero rather than NaN', async () => {
    const { calcTtrMeasure, BIN_NAMES, ALL_VEHICLES } = await lib();
    const empty = { query: async () => ({ json: async () => ({ rows: 0, data: [] }) }) };
    const r = await calcTtrMeasure({
      db: null, chDb: empty, metricName: 'lottr', curTmcId: 'x', year: 2025,
      npmrdsDataKeys: ALL_VEHICLES, dataTableName: 't', timeBins: [BIN_NAMES.AMP],
    });
    expect(r.AMP_n_bins).toBe(0);
    expect(r.AMP_mean_epochs_per_bin).toBe(0);
  });
});

// ── R4 (cont): pct_bins_reporting and truck probe-depth ─────────────────────
describe('R4 — completeness percentage and truck probe depth', () => {
  async function lib() {
    const { createRequire } = await import('node:module');
    const r = createRequire(import.meta.url);
    return {
      calcTtrMeasure: r('../lib/calcTtrMeasure.js').calcTtrMeasure,
      getExpectedBinsForYear: r('../lib/helpers.js').getExpectedBinsForYear,
      ...r('../lib/constants.js'),
    };
  }

  it('derives each bin group its OWN denominator, not a shared one', async () => {
    const { getExpectedBinsForYear, REPORTING_BINS } = await lib();
    const exp = (name, year) => {
      const b = REPORTING_BINS.find((x) => x.name === name);
      return getExpectedBinsForYear({ hours: b.hours, dow: b.dow, year });
    };
    // AMP is 4 hours x Mon-Fri; OVN is 10 hours x every day. A single network denominator would
    // misstate both. These two figures are cross-checked against the campaign's own numbers:
    // H1b independently derived "a year contains 14,600" overnight bins, and measured an AM-peak
    // p90 of 4,152 against this 4,176 ceiling.
    expect(exp('AMP', 2025)).toBe(4176);
    expect(exp('OVN', 2025)).toBe(14600);
    expect(exp('ALL', 2025)).toBe(35040);
    // leap year adds exactly one day's worth of bins
    expect(exp('ALL', 2024) - exp('ALL', 2025)).toBe(96);
  });

  it('pct_bins_reporting is the observed count over that denominator', async () => {
    const { calcTtrMeasure, BIN_NAMES, ALL_VEHICLES } = await lib();
    // 1,044 bins observed against AMP's 4,176 possible = exactly 25%
    const rows = Array.from({ length: 1044 }, (_, i) => ({ tt: 100 + (i % 50), n_epochs: 3 }));
    const chDb = { query: async () => ({ json: async () => ({ rows: rows.length, data: rows }) }) };
    const r = await calcTtrMeasure({
      db: null, chDb, metricName: 'lottr', curTmcId: 'x', year: 2025,
      npmrdsDataKeys: ALL_VEHICLES, dataTableName: 't', timeBins: [BIN_NAMES.AMP],
    });
    expect(r.AMP_n_bins).toBe(1044);
    expect(r.AMP_pct_bins_reporting).toBe(25);
  });

  it('pct_epochs_density_a is the share of contributing epochs on 1-4 probes', async () => {
    const { calcTtrMeasure, BIN_NAMES, FREIGHT_TRUCKS } = await lib();
    // 10 epochs total, 4 of them density A -> 40%
    const rows = [
      { tt: 100, n_epochs: 3, n_epochs_density_a: 1 },
      { tt: 120, n_epochs: 3, n_epochs_density_a: 1 },
      { tt: 140, n_epochs: 4, n_epochs_density_a: 2 },
    ];
    const chDb = { query: async () => ({ json: async () => ({ rows: rows.length, data: rows }) }) };
    const r = await calcTtrMeasure({
      db: null, chDb, metricName: 'tttr', curTmcId: 'x', year: 2025,
      npmrdsDataKeys: FREIGHT_TRUCKS, dataTableName: 't', timeBins: [BIN_NAMES.OVN],
    });
    expect(r.OVN_pct_epochs_density_a).toBe(40);
  });

  it('both degrade to null rather than NaN on an empty bin', async () => {
    const { calcTtrMeasure, BIN_NAMES, ALL_VEHICLES } = await lib();
    const chDb = { query: async () => ({ json: async () => ({ rows: 0, data: [] }) }) };
    const r = await calcTtrMeasure({
      db: null, chDb, metricName: 'lottr', curTmcId: 'x', year: 2025,
      npmrdsDataKeys: ALL_VEHICLES, dataTableName: 't', timeBins: [BIN_NAMES.AMP],
    });
    expect(r.AMP_pct_bins_reporting).toBe(0);       // 0 of 4,176 is a real 0%, not unknown
    expect(r.AMP_pct_epochs_density_a).toBe(null);  // no epochs contributed -> share undefined
  });
});

// ── R2: anchored free-flow reference ────────────────────────────────────────
describe('R2 — the anchored free-flow reference reads a fixed window', () => {
  async function lib() {
    const { createRequire } = await import('node:module');
    const r = createRequire(import.meta.url);
    return {
      calcPhed: r('../lib/calcPhed.js').calcPhed,
      FREEFLOW_REFERENCE_WINDOW: r('../lib/eras.js').FREEFLOW_REFERENCE_WINDOW,
      ALL_VEHICLE_ERAS: r('../lib/eras.js').ALL_VEHICLE_ERAS,
      ...r('../lib/constants.js'),
    };
  }

  // Records every SQL string calcPhed issues so the date predicate can be inspected. The p15 query
  // is the only one that reads the reference window.
  function recordingChDb(sqls) {
    return {
      query: async ({ query }) => {
        sqls.push(query);
        // month/dow/timeBinNum are required: calcPhed indexes the hourly traffic-distribution
        // profile as percentAadt[month - 1][dow][timeBinNum], so a row without them throws.
        return {
          json: async () => ({
            rows: 2,
            data: [
              { tmc: 'x', date: '2025-03-03', month: 3, dow: 1, timeBinNum: 28, tt: 100, n_epochs: 3 },
              { tmc: 'x', date: '2025-03-03', month: 3, dow: 1, timeBinNum: 29, tt: 400, n_epochs: 3 },
            ],
          }),
        };
      },
    };
  }

  const META = {
    tmc: 'x', miles: 1.0, avg_speedlimit: 55, directionalaadt: 5000, directionalaadttruck: 300,
    avg_vehicle_occupancy: 1.7, avgvehicleoccupancytruck: 10.7, functionalclass: 'FREEWAY',
    congestion_level: 'NO2LOW_CONGESTION', directionality: 'AM_PEAK', nhs_pct: 100, nhs: '0',
    faciltype: 1, f_system: 1, state_code: 36, urban_code: 1, isprimary: '1', year: 2025,
  };

  async function run(thresholdSpeedVersion) {
    const { calcPhed, BIN_NAMES, ALL_VEHICLES } = await lib();
    const sqls = [];
    const res = await calcPhed({
      db: null, chDb: recordingChDb(sqls), tmcMeta: META, curTmcId: 'x', year: 2025,
      dataTableName: 't', npmrdsDataKeys: ALL_VEHICLES, avoKey: 'avg_vehicle_occupancy',
      dirAadtKey: 'directionalaadt', thresholdSpeedVersion, timeBins: [BIN_NAMES.AMP],
    });
    return { res, sqls };
  }

  it('the anchored variant filters on the fixed window, the own-year variant on the year', async () => {
    const { FREEFLOW_REFERENCE_WINDOW: W } = await lib();
    const anchored = await run('freeflow_anchored');
    const ownYear = await run('freeflow');

    // The whole point of R2: the p15 comes from a fixed window while the travel times being
    // measured still come from the publish year.
    const anchoredP15 = anchored.sqls.find((q) => q.includes(W.dates[0]));
    expect(anchoredP15, 'anchored variant must query the reference window').toBeTruthy();
    expect(anchoredP15).toContain(`date >= '${W.dates[0]}'`);
    expect(anchoredP15).toContain(`date <= '${W.dates[1]}'`);

    // The own-year variant must NOT reach for the window — it is the legacy behaviour, kept
    // unchanged for the dual-publish overlap.
    expect(ownYear.sqls.some((q) => q.includes(W.dates[0]))).toBe(false);
    expect(ownYear.sqls.some((q) => /EXTRACT\(YEAR from date\) = 2025/.test(q))).toBe(true);
  });

  it('both variants still publish a tt_15_pct and a threshold', async () => {
    for (const v of ['freeflow', 'freeflow_anchored']) {
      const { res } = await run(v);
      expect(res.tt_15_pct, v).toBeGreaterThan(0);
      expect(res.threshold_speed, v).toBeGreaterThan(0);
      expect(res.threshold_travel_time_sec, v).toBeGreaterThan(0);
    }
  });

  it('the speed_limit variant reads no percentile at all', async () => {
    const { res, sqls } = await run('speed_limit');
    expect(res.tt_15_pct).toBe(null);
    // threshold = max(0.6 * 55, 20) = 33 mph, straight off posted speed
    expect(res.threshold_speed).toBe(33);
    const { FREEFLOW_REFERENCE_WINDOW: W } = await lib();
    expect(sqls.some((q) => q.includes(W.dates[0]))).toBe(false);
  });

  it('the reference window lies inside a single coverage era', async () => {
    const { FREEFLOW_REFERENCE_WINDOW: W, ALL_VEHICLE_ERAS } = await lib();
    const era = ALL_VEHICLE_ERAS.find((e) => e.era === W.era);
    expect(era, `${W.era} must exist in the era table`).toBeTruthy();
    // A window straddling a boundary would pool two coverage regimes into one percentile — which is
    // exactly the defect that made H5's original CY2023 anchor unsuitable.
    expect(W.dates[0].startsWith(era.start)).toBe(true);
    expect(W.dates[1].startsWith(era.end)).toBe(true);
  });
});

// ── R6: precision bands ─────────────────────────────────────────────────────
describe('R6 — precision bands from H1b\'s measured curves', () => {
  async function lib() {
    const { createRequire } = await import('node:module');
    const r = createRequire(import.meta.url);
    return { ...r('../lib/precision.js'), ...r('../lib/constants.js'),
             calcTtrMeasure: r('../lib/calcTtrMeasure.js').calcTtrMeasure };
  }

  it('returns the measured SD exactly at a measured n', async () => {
    const { expectedSdForN, PRECISION_CURVES } = await lib();
    // Not a fitted model — the published band at a measured sample size must BE the measurement.
    for (const [metric, curve] of Object.entries(PRECISION_CURVES)) {
      for (const [n, sd] of curve) {
        expect(expectedSdForN(metric, n), `${metric} @ n=${n}`).toBeCloseTo(sd, 10);
      }
    }
  });

  it('interpolates between measured points and clamps outside them', async () => {
    const { expectedSdForN } = await lib();
    // between 100 (0.04006) and 250 (0.02426)
    const mid = expectedSdForN('lottr', 150);
    expect(mid).toBeLessThan(0.04006);
    expect(mid).toBeGreaterThan(0.02426);
    // Clamped, not extrapolated: an extrapolated precision claim is worse than a blunt one.
    expect(expectedSdForN('lottr', 5)).toBe(0.07925);
    expect(expectedSdForN('lottr', 99999)).toBe(0.00742);
  });

  it('is monotone decreasing in n, and steeper than 1/sqrt(n)', async () => {
    const { expectedSdForN } = await lib();
    const ns = [25, 50, 100, 250, 500, 1000];
    const sds = ns.map((n) => expectedSdForN('lottr', n));
    for (let i = 1; i < sds.length; i += 1) expect(sds[i]).toBeLessThan(sds[i - 1]);
    // 40x the sample cuts the SD by more than sqrt(40) = 6.3x, because a finite-population
    // correction bites as n approaches the ~1,385 bins an AM-peak year contains. This is why the
    // curves are a lookup and not a formula.
    expect(sds[0] / sds[sds.length - 1]).toBeGreaterThan(Math.sqrt(40));
  });

  it('has no curve, and therefore makes no claim, for metrics H1b did not measure', async () => {
    const { expectedSdForN, hasPrecisionCurve, minNBar } = await lib();
    expect(hasPrecisionCurve('phed_freeflow')).toBe(false);
    expect(expectedSdForN('phed_freeflow', 500)).toBe(null);
    expect(minNBar('phed_freeflow')).toBe(null);
    // and no precision at all when nothing was observed
    expect(expectedSdForN('lottr', 0)).toBe(null);
  });

  it('TTTR\'s bar is unreachable by construction — the finding, not a typo', async () => {
    const { MIN_N, belowMinN } = await lib();
    // A truck-overnight year contains 14,600 bins. TTTR needs 57,832 for +/-0.05 on 90% of
    // segments, so no segment can ever clear it.
    expect(MIN_N.tttr.absolute).toBeGreaterThan(14600);
    expect(belowMinN('tttr', 14600)).toBe(true);
    // R1's p80/p50 on the SAME truck data clears the same bar at 195 bins — 297x cheaper, which is
    // the entire argument for publishing it.
    expect(MIN_N.tttr_p80.absolute).toBe(195);
    expect(Math.round(MIN_N.tttr.absolute / MIN_N.tttr_p80.absolute)).toBe(297);
  });

  it('the calculator publishes a band and a bar, both writable', async () => {
    const { calcTtrMeasure, BIN_NAMES, ALL_VEHICLES } = await lib();
    const rows = Array.from({ length: 100 }, (_, i) => ({ tt: 100 + (i % 40), n_epochs: 3 }));
    const chDb = { query: async () => ({ json: async () => ({ rows: rows.length, data: rows }) }) };
    const r = await calcTtrMeasure({
      db: null, chDb, metricName: 'lottr', curTmcId: 'x', year: 2025,
      npmrdsDataKeys: ALL_VEHICLES, dataTableName: 't', timeBins: [BIN_NAMES.AMP],
    });
    expect(r.AMP_precision_band).toBe(0.04006);   // n=100, a measured point
    expect(r.AMP_min_n_bar).toBe(707);
    // Both must be truthy, or pm3's row writer drops them: it filters on !!value, which is why the
    // bar is published rather than a boolean below/above flag.
    expect(Boolean(r.AMP_precision_band)).toBe(true);
    expect(Boolean(r.AMP_min_n_bar)).toBe(true);
  });
});

// ── R2 perf: the p15 memo ───────────────────────────────────────────────────
describe('R2 perf — one p15 derivation per (TMC, reference window)', () => {
  async function lib() {
    const { createRequire } = await import('node:module');
    const r = createRequire(import.meta.url);
    return { calcPhed: r('../lib/calcPhed.js').calcPhed,
             FREEFLOW_REFERENCE_WINDOW: r('../lib/eras.js').FREEFLOW_REFERENCE_WINDOW,
             ...r('../lib/constants.js') };
  }
  const META = {
    tmc: 'x', miles: 1.0, avg_speedlimit: 55, directionalaadt: 5000, directionalaadttruck: 300,
    avg_vehicle_occupancy: 1.7, avgvehicleoccupancytruck: 10.7, functionalclass: 'FREEWAY',
    congestion_level: 'NO2LOW_CONGESTION', directionality: 'AM_PEAK', nhs_pct: 100, nhs: '0',
  };
  const ROWS = [
    { tmc: 'x', date: '2025-03-03', month: 3, dow: 1, timeBinNum: 28, tt: 100, n_epochs: 3 },
    { tmc: 'x', date: '2025-03-03', month: 3, dow: 1, timeBinNum: 29, tt: 400, n_epochs: 3 },
  ];
  // Counts only the queries that derive a p15 — the ALL-bin, all-days scan.
  function countingChDb(counter) {
    return {
      query: async ({ query }) => {
        if (/in \(0,1,2,3,4,5,6\)/.test(query) && /in \(0,1,2,3,4,5,6,7,8,9,10,11,12/.test(query)) {
          counter.p15 += 1;
        }
        counter.all += 1;
        return { json: async () => ({ rows: ROWS.length, data: ROWS }) };
      },
    };
  }
  async function runFamily({ withCache }) {
    const { calcPhed, BIN_NAMES, ALL_VEHICLES, FREIGHT_TRUCKS } = await lib();
    const counter = { p15: 0, all: 0 };
    const chDb = countingChDb(counter);
    const cache = withCache ? new Map() : undefined;
    // The four metrics that share the anchored window — two all-vehicle, two truck.
    const family = [
      { npmrdsDataKeys: ALL_VEHICLES, timeBins: [BIN_NAMES.AMP] },
      { npmrdsDataKeys: FREIGHT_TRUCKS, timeBins: [BIN_NAMES.AMP] },
      { npmrdsDataKeys: ALL_VEHICLES, timeBins: [BIN_NAMES.ALL] },
      { npmrdsDataKeys: FREIGHT_TRUCKS, timeBins: [BIN_NAMES.ALL] },
    ];
    for (const m of family) {
      await calcPhed({
        db: null, chDb, tmcMeta: META, curTmcId: 'x', year: 2025, dataTableName: 't',
        avoKey: 'avg_vehicle_occupancy', dirAadtKey: 'directionalaadt',
        thresholdSpeedVersion: 'freeflow_anchored', freeflowP15Cache: cache, ...m,
      });
    }
    return counter;
  }

  it('derives the p15 once for a four-metric family instead of four times', async () => {
    const without = await runFamily({ withCache: false });
    const with_ = await runFamily({ withCache: true });
    expect(without.p15).toBe(4);
    expect(with_.p15).toBe(1);
    // The percentile is taken over ALL_VEHICLES whichever stream the measure reads, so the truck
    // metrics share the value rather than needing their own.
    expect(with_.all).toBeLessThan(without.all);
  });

  it('keeps the own-year and anchored windows separate in the same cache', async () => {
    const { calcPhed, BIN_NAMES, ALL_VEHICLES, FREEFLOW_REFERENCE_WINDOW: W } = await lib();
    const seen = [];
    const chDb = {
      query: async ({ query }) => {
        seen.push(query);
        return { json: async () => ({ rows: ROWS.length, data: ROWS }) };
      },
    };
    const cache = new Map();
    for (const v of ['freeflow', 'freeflow_anchored', 'freeflow', 'freeflow_anchored']) {
      await calcPhed({
        db: null, chDb, tmcMeta: META, curTmcId: 'x', year: 2025, dataTableName: 't',
        npmrdsDataKeys: ALL_VEHICLES, avoKey: 'avg_vehicle_occupancy',
        dirAadtKey: 'directionalaadt', thresholdSpeedVersion: v,
        freeflowP15Cache: cache, timeBins: [BIN_NAMES.AMP],
      });
    }
    // Two distinct windows -> exactly two cache entries, and both keys are represented.
    expect(cache.size).toBe(2);
    expect([...cache.keys()].some((k) => k === 'year:2025')).toBe(true);
    expect([...cache.keys()].some((k) => k === W.dates.join('..'))).toBe(true);
    // A cache that conflated them would silently give the anchored variant the own-year threshold,
    // which is the exact bug R2 exists to remove — so assert the window query really was issued.
    expect(seen.some((q) => q.includes(W.dates[0]))).toBe(true);
    expect(seen.some((q) => /EXTRACT\(YEAR from date\) = 2025/.test(q))).toBe(true);
  });
});
