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
import { makeFakeCh } from './fakeCh.mjs';
import { createRequire } from 'node:module';

const createRequireSync = createRequire(import.meta.url);

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
  // Data coverage as its own measure — completeness is a property of (stream, bin), not of a measure.
  'coverage',
  'tttr_p80',
  'phed_freeflow_anchored', 'phed_truck_freeflow_anchored',
  'ted_freeflow_anchored', 'ted_truck_freeflow_anchored',
  // R13: the unfloored (relative) delay series — the only form comparable across functional classes.
  'phed_freeflow_relative', 'phed_truck_freeflow_relative',
  'ted_freeflow_relative', 'ted_truck_freeflow_relative',
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
      'coverage',
      'speed_pctl',
      'tttr_p80',
      'phed_freeflow', 'phed_truck', 'phed_truck_freeflow',
      'ted', 'ted_freeflow', 'ted_truck', 'ted_truck_freeflow',
      'phed_freeflow_anchored', 'phed_truck_freeflow_anchored',
      'ted_freeflow_anchored', 'ted_truck_freeflow_anchored',
      'phed_freeflow_relative', 'phed_truck_freeflow_relative',
      'ted_freeflow_relative', 'ted_truck_freeflow_relative',
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

// ── R4/coverage: completeness is its own measure ───────────────────────────
describe('coverage — completeness decoupled from the performance measures', () => {
  async function lib() {
    const { createRequire } = await import('node:module');
    const r = createRequire(import.meta.url);
    return { ...r('../coverageCalculator.js'),
             getExpectedBinsForYear: r('../lib/helpers.js').getExpectedBinsForYear,
             ...r('../lib/constants.js') };
  }

  it('publishes both percentages per (stream, bin) and nothing per measure', async () => {
    const { coverageColumnNames } = await lib();
    const names = coverageColumnNames();
    // Two streams x their bins x two percentages, with no measure name anywhere in the column.
    expect(names.length).toBe(26);
    for (const n of names) {
      expect(n.startsWith('coverage_')).toBe(true);
      expect(/lottr|tttr|phed|ted/.test(n)).toBe(false);
    }
    expect(names).toContain('coverage_all_vehicles_amp_pct_bins_reporting');
    expect(names).toContain('coverage_all_vehicles_amp_pct_epochs_reporting');
    expect(names).toContain('coverage_freight_trucks_ovn_pct_epochs_reporting');
  });

  it('keeps ALT_PMP distinct from PMP — different windows, different denominators', async () => {
    const { coverageColumnNames, getExpectedBinsForYear, REPORTING_BINS } = await lib();
    const names = coverageColumnNames();
    expect(names).toContain('coverage_all_vehicles_pmp_pct_bins_reporting');
    expect(names).toContain('coverage_all_vehicles_alt_pmp_pct_bins_reporting');
    // PMP is 16-19, ALT_PMP is 15-18 — collapsing them would misreport one of the two.
    const exp = (n) => {
      const b = REPORTING_BINS.find((x) => x.name === n);
      return getExpectedBinsForYear({ hours: b.hours, dow: b.dow, year: 2025 });
    };
    expect(exp('PMP')).toBe(exp('ALT_PMP'));      // same width...
    const pmp = REPORTING_BINS.find((x) => x.name === 'PMP');
    const alt = REPORTING_BINS.find((x) => x.name === 'ALT_PMP');
    expect(pmp.hours).not.toEqual(alt.hours);      // ...but not the same hours
  });

  it('computes both percentages, epochs never above bins', async () => {
    const { coverageCalculator } = await lib();
    // 1,000 bins present, each backed by 2 epochs. Large enough that rounding both percentages to
    // 2 dp does not dominate the ratio check below — at 2-bin scale the rounded values are 0.05 and
    // 0.03 and the identity looks broken when it is not.
    const rows = Array.from({ length: 1000 }, (_, i) => ({ tt: 100 + (i % 20), n_epochs: 2 }));
    const chDb = makeFakeCh(rows);
    const r = await coverageCalculator({ db: null, chDb, year: 2025, dataTableName: 't', curTmcId: 'x' });
    // Result keys are UNPREFIXED — the row writer adds the metric name.
    const bins = r.all_vehicles_amp_pct_bins_reporting;
    const eps  = r.all_vehicles_amp_pct_epochs_reporting;
    expect(bins).toBeGreaterThan(0);
    // epochs% must be BELOW bins%, since a bin counts as present when any one of its three
    // 5-minute epochs did.
    expect(eps).toBeLessThan(bins);
    // and the ratio recovers probe depth: 2,000 epochs / 1,000 bins = 2.0 per bin
    expect((eps / bins) * 3).toBeCloseTo(2.0, 2);
  });

  it('reports every stream and bin, including the delay measures\' ALL bin', async () => {
    const { coverageCalculator } = await lib();
    const rows = [{ tt: 100, n_epochs: 3 }];
    const chDb = makeFakeCh(rows);
    const r = await coverageCalculator({ db: null, chDb, year: 2025, dataTableName: 't', curTmcId: 'x' });
    // TED/PHED read the ALL and ALT_PMP bins and previously had NO completeness column at all.
    for (const k of ['all_vehicles_all_pct_bins_reporting',
                     'all_vehicles_alt_pmp_pct_bins_reporting',
                     'freight_trucks_all_pct_epochs_reporting']) {
      expect(r[k], k).not.toBeUndefined();
    }
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
  // Records every SQL string calcPhed issues so the date predicate can be inspected, and answers
  // the pushdown aggregates from the fixture via the JS oracle in fakeCh.mjs.
  function recordingChDb(sqls) {
    // month/dow/timeBinNum are required: calcPhed indexes the hourly traffic-distribution profile
    // as percentAadt[month - 1][dow][timeBinNum], so a row without them throws.
    const rows = [
      { month: 3, dow: 1, timeBinNum: 28, tt: 100, n_epochs: 3 },
      { month: 3, dow: 1, timeBinNum: 29, tt: 400, n_epochs: 3 },
    ];
    // The reference window returns DIFFERENT travel times, so a threshold sourced from the wrong
    // window is visible as a wrong number rather than only as a missing query.
    const windowRows = [
      { month: 3, dow: 1, timeBinNum: 28, tt: 200, n_epochs: 3 },
      { month: 3, dow: 1, timeBinNum: 29, tt: 800, n_epochs: 3 },
    ];
    return makeFakeCh(rows, {
      onQuery: (q) => sqls.push(q),
      rowsFor: (q) => (q.includes(WINDOW_START) ? windowRows : null),
    });
  }

  // Read once at module scope so recordingChDb can key on it without an async lib() call.
  const WINDOW_START = createRequireSync('../lib/eras.js').FREEFLOW_REFERENCE_WINDOW.dates[0];

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

    expect(ownYear.sqls.some((q) => /EXTRACT\(YEAR from date\) = 2025/.test(q))).toBe(true);

    // The assertion that matters: each variant's threshold comes from ITS OWN window. The fixture
    // gives the window doubled travel times, so p15 200 vs 100 separates them by value.
    //
    // Note this is deliberately no longer "the own-year variant never queries the window". Since the
    // delay pushdown, every delay variant warms BOTH p15s once per TMC to build the shared threshold
    // set that lets all 16 variants share one delay query per (stream, bin) — so the own-year variant
    // does now issue a window query, and asserting otherwise would test the fetch plan rather than
    // the measure. In production both p15s are needed and memoised regardless, so the shared set
    // costs nothing; see getTmcThresholdSet.
    // R type-7 interpolation over the two fixture bins: window [200, 800] -> 200*0.85 + 800*0.15
    // = 290; own year [100, 400] -> 145. Interpolated, not a picked element — which is itself the
    // estimator quantilesExactInclusive implements.
    expect(anchored.res.tt_15_pct).toBe(290);
    expect(ownYear.res.tt_15_pct).toBe(145);
    // Both then land on threshold_speed 20 — a 1-mile segment at a 290s or 145s p15 implies 12.4 or
    // 24.8 mph free-flow, so 0.6x that is 7.4 or 14.9 and the floor raises both. The threshold is
    // therefore the WRONG place to look for the window's effect at these speeds, which is RQ18's
    // finding in miniature: on slow facilities the floor, not the reference, decides the number.
    expect(anchored.res.threshold_speed).toBe(20);
    expect(ownYear.res.threshold_speed).toBe(20);
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
    // The key is now OMITTED rather than set to null: emitting a null key created an undeclared
    // physical column that was never populated (see the registry-wide invariant test).
    expect('tt_15_pct' in res).toBe(false);
    // threshold = max(0.6 * 55, 20) = 33 mph, straight off posted speed
    expect(res.threshold_speed).toBe(33);
    // The threshold is derived from posted speed and from nothing else — asserted on the VALUE
    // rather than on the absence of a percentile query, because the shared threshold set means this
    // variant does warm both p15s (see the note in the window test above). What must never happen is
    // a percentile leaking INTO the posted-speed threshold.
    expect(res.threshold_travel_time_sec).toBe(Math.round((1.0 / 33) * 3600));
    expect(sqls.length).toBeGreaterThan(0);
  });

  it('never CONTAINS a whole publish year, and its overlaps are declared', async () => {
    const { FREEFLOW_REFERENCE_WINDOW: W } = await lib();
    // Replaces an assertion that the window was disjoint from every publish year. That held while
    // CY2025 was the whole scope; across the 2017-2025 archive NO window can be disjoint from all of
    // them, so the invariant has to change rather than the anchor being forced to satisfy it.
    //
    // Two things still matter, and this pins both.
    const [start, end] = W.dates;
    const PUBLISH_YEARS = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

    // 1. HARD LINE: the window must never contain a whole publish year. That is the E8 case —
    //    E8 (2024-12..2026-01) contained all of CY2025, so the anchored figure came out 0.04% from
    //    own-year and the measure was a no-op. Partial overlap damps a year; total overlap erases it.
    const contained = PUBLISH_YEARS.filter((y) => start <= `${y}-01-01` && end >= `${y}-12-31`);
    expect(contained, `anchor ${start}..${end} CONTAINS ${contained.join(',')} — that year's anchored figure would be a no-op`).toEqual([]);

    // 2. The years it partially overlaps must be the ones declared on the window, so moving the
    //    anchor forces updating the caveat instead of silently changing which years are damped.
    const overlapping = PUBLISH_YEARS.filter((y) => !(end < `${y}-01-01` || start > `${y}-12-31`));
    expect(overlapping).toEqual(W.selfReferentialYears);
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
    const chDb = makeFakeCh(rows);
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
  // Counts every ClickHouse query. Deliberately NOT pattern-matching for "the p15 query": a
  // ted_* metric reads the ALL bin, so its measure query has the same all-hours/all-days shape as
  // the p15 query and no regex separates them. Totals are unambiguous.
  function countingChDb(counter) {
    return makeFakeCh(ROWS, { onQuery: () => { counter.all += 1; } });
  }
  async function runFamily({ withCache }) {
    const { calcPhed, BIN_NAMES, ALL_VEHICLES, FREIGHT_TRUCKS } = await lib();
    const counter = { all: 0 };
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
    // Each metric derives TWO p15s — its own reference window plus the other one, because the
    // shared threshold set needs both (getTmcThresholdSet) — and issues one delay query per time
    // bin, all four here having a single bin.
    //   uncached: 4 x (2 p15 + 1 delay)                       = 12 ... plus the anchored p15 each
    //             metric fetches for its own threshold before the set = 16
    //   cached:   2 p15 once + 4 delay                        = 6
    expect(without.all).toBe(16);
    expect(with_.all).toBe(6);
    // 10 of the 14 percentile derivations were redundant. The percentile is taken over ALL_VEHICLES
    // whichever stream the measure reads, so the truck metrics share the value.
    expect(without.all - with_.all).toBe(10);
  });

  it('keeps the own-year and anchored windows separate in the same cache', async () => {
    const { calcPhed, BIN_NAMES, ALL_VEHICLES, FREEFLOW_REFERENCE_WINDOW: W } = await lib();
    const seen = [];
    const chDb = makeFakeCh(ROWS, { onQuery: (q) => seen.push(q) });
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

// ── R13: the configurable delay-threshold floor ─────────────────────────────
describe('R13 — the delay-threshold floor is configurable and defaults to the federal 20 mph', () => {
  async function lib() {
    const { createRequire } = await import('node:module');
    const r = createRequire(import.meta.url);
    return { calcPhed: r('../lib/calcPhed.js').calcPhed, ...r('../lib/constants.js') };
  }
  // A deliberately SLOW segment: 0.4 mi covered in 60 s = 24 mph achievable. 0.6 x 24 = 14.4 mph,
  // which the 20 mph floor overrides — the arterial case RQ18 found dominates two thirds of state delay.
  const SLOW = {
    tmc: 'x', miles: 0.4, avg_speedlimit: 30, directionalaadt: 5000, directionalaadttruck: 300,
    avg_vehicle_occupancy: 1.7, avgvehicleoccupancytruck: 10.7, functionalclass: 'NONFREEWAY',
    congestion_level: 'NO2LOW_CONGESTION', directionality: 'AM_PEAK', nhs_pct: 100, nhs: '0',
  };
  const ROWS = [
    { tmc: 'x', date: '2025-03-03', month: 3, dow: 1, timeBinNum: 28, tt: 60, n_epochs: 3 },
    { tmc: 'x', date: '2025-03-03', month: 3, dow: 1, timeBinNum: 29, tt: 90, n_epochs: 3 },
  ];
  async function run(extra) {
    const { calcPhed, BIN_NAMES, ALL_VEHICLES } = await lib();
    const chDb = makeFakeCh(ROWS);
    return calcPhed({
      db: null, chDb, tmcMeta: SLOW, curTmcId: 'x', year: 2025, dataTableName: 't',
      npmrdsDataKeys: ALL_VEHICLES, avoKey: 'avg_vehicle_occupancy', dirAadtKey: 'directionalaadt',
      thresholdSpeedVersion: 'freeflow_anchored', timeBins: [BIN_NAMES.AMP], ...extra,
    });
  }

  it('defaults to 20 mph when no floor is configured — the federal formula, unchanged', async () => {
    const r = await run({});
    // achievable ~24 mph -> 0.6 x 24 = 14.4, floored up to 20
    expect(r.threshold_speed).toBe(20);
  });

  it('thresholdFloorMph: 0 gives the pure relative threshold', async () => {
    const r = await run({ thresholdFloorMph: 0 });
    // now 0.6 x achievable stands, well below the floor
    expect(r.threshold_speed).toBeLessThan(20);
    expect(r.threshold_speed).toBeGreaterThan(0);
  });

  it('a lower threshold means LESS delay counted — the direction RQ18 measured', async () => {
    const floored = await run({});
    const relative = await run({ thresholdFloorMph: 0 });
    // The floor raises the bar on slow facilities, so it manufactures delay relative to the
    // achievable-speed logic. Removing it must reduce delay, never increase it.
    expect(relative.all_xdelay_phrs).toBeLessThan(floored.all_xdelay_phrs);
  });

  it('the floor is inert where achievable speed is high — the Interstate case', async () => {
    const FAST = { ...SLOW, miles: 1.0, avg_speedlimit: 65, functionalclass: 'FREEWAY' };
    const { calcPhed, BIN_NAMES, ALL_VEHICLES } = await lib();
    // 1 mi in 55 s = 65 mph achievable -> 0.6 x 65 = 39 mph, far above any floor
    const fast = [{ tmc: 'x', date: '2025-03-03', month: 3, dow: 1, timeBinNum: 28, tt: 55, n_epochs: 3 }];
    const chDb = makeFakeCh(fast);
    const base = { db: null, chDb, tmcMeta: FAST, curTmcId: 'x', year: 2025, dataTableName: 't',
      npmrdsDataKeys: ALL_VEHICLES, avoKey: 'avg_vehicle_occupancy', dirAadtKey: 'directionalaadt',
      thresholdSpeedVersion: 'freeflow_anchored', timeBins: [BIN_NAMES.AMP] };
    const withFloor = await calcPhed({ ...base });
    const without  = await calcPhed({ ...base, thresholdFloorMph: 0 });
    expect(withFloor.threshold_speed).toBe(without.threshold_speed);
  });

  it('only the freeflow base gets an unfloored variant, never speed_limit', async () => {
    const { createRequire } = await import('node:module');
    const w = createRequire(import.meta.url)('../worker.js');
    const cfgs = w.buildMetricConfigs({ chMetaTableName: 'x' });
    for (const [name, c] of Object.entries(cfgs)) {
      if (c.kind !== 'phed') continue;
      if (c.thresholdFloorMph === 0) {
        // 0.6 x a POSTED LIMIT unfloored is not an alternative reading of anything — the base has to
        // be a measurement for the relative interpretation to mean something. And that formula is the
        // federally defined one (23 CFR 490).
        expect(c.thresholdSpeedVersion, name).not.toBe('speed_limit');
      }
    }
  });
});

// ── PERF: the per-TMC binned-data memo ──────────────────────────────────────
describe('perf — one binned-data fetch per (stream, bin) per TMC', () => {
  async function lib() {
    const { createRequire } = await import('node:module');
    return createRequire(import.meta.url)('../worker.js');
  }
  const META = {
    tmc: 'x', miles: 1.0, avg_speedlimit: 55, directionalaadt: 5000, directionalaadttruck: 300,
    avg_vehicle_occupancy: 1.7, avgvehicleoccupancytruck: 10.7, functionalclass: 'FREEWAY',
    congestion_level: 'NO2LOW_CONGESTION', directionality: 'AM_PEAK', nhs_pct: 100, nhs: '0', year: 2025,
  };
  const ROWS = [
    { tmc: 'x', date: '2025-03-03', month: 3, dow: 1, timeBinNum: 28, tt: 100, n_epochs: 3, avg_speed_all_vehicles: 55 },
    { tmc: 'x', date: '2025-03-03', month: 3, dow: 1, timeBinNum: 29, tt: 400, n_epochs: 2, avg_speed_all_vehicles: 40 },
  ];

  // Runs the whole registry for one TMC and returns (query count, every output value).
  async function runAllMetrics(useCache) {
    const w = await lib();
    const cfgs = w.buildMetricConfigs({ chMetaTableName: 'npmrds_meta.t' });
    let n = 0;
    const chDb = makeFakeCh(ROWS, { onQuery: () => { n += 1; } });
    const shared = useCache ? { binnedDataCache: new Map(), freeflowP15Cache: new Map() } : {};
    const out = {};
    for (const [name, cfg] of Object.entries(cfgs)) {
      const r = await cfg.calculator({
        db: null, chDb, pgEnv: 'x', curTmcId: 'x', year: 2025,
        dataTableName: 't', tmcMeta: META, metricName: name, ...shared, ...cfg,
      });
      if (r) for (const [k, v] of Object.entries(r)) out[`${name}|${k}`] = v;
    }
    return { n, out };
  }

  it('cuts queries per TMC by more than half', async () => {
    const without = await runAllMetrics(false);
    const withMemo = await runAllMetrics(true);
    // 64 -> 22 at the time of writing. Asserted as a ratio rather than a literal so the test survives
    // registry growth, which is exactly what made this optimisation necessary.
    expect(withMemo.n).toBeLessThan(without.n * 0.5);
  });

  it('produces byte-identical output — the acceptance test for any perf change', async () => {
    const without = await runAllMetrics(false);
    const withMemo = await runAllMetrics(true);
    // The memo returns the SAME rows to every caller; only the number of fetches changes. A
    // difference here means a caller mutated a shared row in place, which would silently corrupt
    // every later consumer for that TMC.
    expect(Object.keys(withMemo.out).length).toBe(Object.keys(without.out).length);
    expect(withMemo.out).toEqual(without.out);
  });

  it('shares fetches across metrics that read the same stream and bin', async () => {
    const w = await lib();
    const cfgs = w.buildMetricConfigs({ chMetaTableName: 'npmrds_meta.t' });
    let n = 0;
    const chDb = makeFakeCh(ROWS, { onQuery: () => { n += 1; } });
    const binnedDataCache = new Map();
    const base = { db: null, chDb, pgEnv: 'x', curTmcId: 'x', year: 2025, dataTableName: 't',
                   tmcMeta: META, binnedDataCache, freeflowP15Cache: new Map() };
    // tttr and tttr_p80 read the identical truck stream over identical bins — the second must be free.
    await cfgs.tttr.calculator({ ...base, metricName: 'tttr', ...cfgs.tttr });
    const afterFirst = n;
    await cfgs.tttr_p80.calculator({ ...base, metricName: 'tttr_p80', ...cfgs.tttr_p80 });
    expect(n).toBe(afterFirst);
  });
});
