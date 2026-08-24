/**
 * FORKED FROM map21 on 2026-08-14 — see
 * planning/transportny/tasks/current/pm3-fork-and-measure-implementation.md (Phase 0).
 *
 * pm3 and map21 are deliberately allowed to diverge from here: map21 is frozen for
 * calculation (federal submittal, backward compatibility), pm3 is not. Do NOT
 * "resync" this file with ../../map21/calcPhed.js — divergence is the point.
 * pm3/tests/no-map21-import.unit.test.mjs enforces that pm3 never imports map21 again.
 */
/**
 * PHED (Peak-Hour Excessive Delay) calculator.
 *
 * Ported from references/avail-falcor/.../map21/calcPhed.js. Same dropped
 * code paths as calcTtrMeasure (METRIC_WRITES_DB write-back, historic
 * comparison). Required tmcMeta fields are unchanged: avg_speedlimit, miles,
 * avg_vehicle_occupancy, functionalclass, congestion_level, directionality,
 * nhs_pct, directionalaadt.
 */

const { chain, fill, mapValues, range, sum } = require('lodash');

// simple-statistics quantile (R type-7), inlined.
function quantile(arr, p) {
  if (!arr.length) return NaN;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
}

const {
  ALL_VEHICLES,
  BIN_NAMES,
  REPORTING_BINS,
  MINUTES_PER_EPOCH,
  NUM_MONTHS_IN_YEAR,
  NUM_DAYS_IN_WEEK,
  SEC_PER_MINUTE,
  NPMRDS_CH_SCHEMA_NAME,
  FIFTEENTH_PCTL,
} = require('./constants.js');
const { WEEKDAY, WEEKEND } = require('./enums/dayTypes.js');
const { getTrafficDistributionProfileName, getNumBinsInDayForTimeBinSize } = require('./helpers.js');
const { FREEFLOW_REFERENCE_WINDOW } = require('./eras.js');
const { cartesianProduct } = require('./SetUtils.js');
const { getBinnedStatsForTmc, getDelayGroupsForTmc } = require('./calcTtrMeasure.js');

const CATTLabTrafficDistributionProfiles = require('./static/CATTLabTrafficDistributionProfiles.js');
const TrafficDistributionDOWAdjustmentFactors = require('./static/TrafficDistributionDowAdjustmentFactors.js');
const TrafficDistributionMonthAdjustmentFactors = require('./static/TrafficDistributionMonthAdjustmentFactors.js');
const CATTLAB = 'CATTLAB';

// Defensive variant: legacy code intentionally returns 0 (instead of null/NaN)
// so downstream sums don't propagate NaN. Behavior preserved verbatim.
function precisionRound(number, precision = 0) {
  if (number === null) return 0;
  if (!Number.isFinite(+number)) return 0;
  const factor = 10 ** precision;
  return Math.round(+number * factor) / factor;
}

async function calcPhed(props) {
  const {
    db, chDb,
    curTmcId: tmc,
    year,
    dates,
    dataTableName,
    tmcMeta,
    thresholdSpeedVersion,
    thresholdFloorMph,
    binnedDataCache,
    metricName,
    npmrdsDataKeys,
    secondaryDataKey,
    avoKey = 'avg_vehicle_occupancy',
    dirAadtKey = 'directionalaadt',
    timeBins = [BIN_NAMES.AMP, BIN_NAMES.ALT_PMP],
  } = props;

  console.log(`[pm3] PHED tmc=${tmc} year=${year}`);

  const avg_vehicle_occupancy = tmcMeta?.[avoKey];
  const directionalaadt = tmcMeta?.[dirAadtKey];

  if (
    !tmcMeta || !directionalaadt || !tmcMeta.avg_speedlimit || !tmcMeta.miles ||
    !avg_vehicle_occupancy || !tmcMeta.functionalclass || !tmcMeta.congestion_level ||
    !tmcMeta.directionality || tmcMeta.nhs_pct === undefined
  ) {
    console.log(`[pm3] missing metadata for PHED tmc=${tmc}`);
    return undefined;
  }

  const { directionality, congestion_level, nhs_pct } = tmcMeta;
  const nhsPercentage = nhs_pct * 0.01;

  // 1. Threshold speed
  // tt_15_pct exists only for the freeflow variants; the speed_limit variants derive their
  // threshold from posted speed and have no percentile behind it.
  let tt_15_pct = null;
  let anchorFellBack = null;
  let baseThresholdSpeed;
  if (thresholdSpeedVersion === 'freeflow' || thresholdSpeedVersion === 'freeflow_anchored') {
    // 'freeflow'          -> p15 of the publish year (legacy behaviour, kept for the dual-publish
    //                        transition so consumers can see both series side by side)
    // 'freeflow_anchored' -> p15 of FREEFLOW_REFERENCE_WINDOW, a fixed single-era window (R2)
    const ff = await calcFreeflowBaseThresholdSpeed({
      ...props,
      referenceWindow: thresholdSpeedVersion === 'freeflow_anchored'
        ? FREEFLOW_REFERENCE_WINDOW.dates
        : undefined,
    });
    baseThresholdSpeed = ff.baseThresholdSpeed;
    anchorFellBack = ff.anchor_fallback ? 1 : null;
    tt_15_pct = ff.tt_15_pct;
  } else {
    baseThresholdSpeed = tmcMeta.avg_speedlimit;
  }
  // R13 — the floor is configurable, and defaults to the federal 20 mph.
  //
  // RQ18 measured that this constant, not the reference, is the dominant term for every non-freeway
  // class: removing it moves network delay -41.4%, and -59.9% on principal arterials, which alone
  // carry two thirds of the state total. It is inert on Interstates (-1.3%).
  //
  // `thresholdFloorMph: 0` gives the pure relative measure, 0.6 x achievable speed. That is the only
  // form in which delay is comparable ACROSS functional classes, because with the floor in place an
  // arterial figure is ~90% floored and a freeway figure ~3% floored -- comparing them compares the
  // floor, not congestion.
  //
  // Offered ONLY for the freeflow base. For the speed_limit variant the base is a posted limit -- a
  // policy number rather than a measurement -- so 0.6 x posted unfloored is not an alternative reading
  // of anything, and that formula is the federally defined one (23 CFR 490).
  const floorMph = thresholdFloorMph === undefined ? 20 : thresholdFloorMph;
  const threshold_speed = Math.max(0.6 * baseThresholdSpeed, floorMph);

  // 2. EDTTT — excessive-delay threshold travel time (seconds)
  const segmentLength = tmcMeta.miles;
  const edttt = precisionRound((precisionRound(segmentLength, 3) / threshold_speed) * 3600);

  const TIME_BINS = timeBins.map((binName) => REPORTING_BINS.find((b) => b.name === binName));
  const percentAadtByMonthByDowByHour = await calcHourlyPercentTraffic({ ...tmcMeta });

  const phedResult = { tmc, all_xdelay_phrs: 0, all_xdelay_vhrs: 0, xdelay_hrs: 0 };

  // PERF (P-B) — steps 3+4 (per-bin clamped excess delay) now run in ClickHouse, grouped by the
  // three fields the volume weight depends on. Step 6's weighting stays here, reading the same JS
  // traffic-distribution array as before. See getDelayGroupsForTmc for why this is the same
  // arithmetic and not an approximation.
  const thresholdSet = await getTmcThresholdSet(props);
  const sharedIdx = thresholdSet.indexOf(edttt);
  // If this variant's threshold somehow is not in the shared set, query for it alone rather than
  // read a neighbouring variant's column — silently reporting the wrong threshold's delay would be
  // far worse than one extra query.
  const thresholds = sharedIdx >= 0 ? thresholdSet : [edttt];
  const edIdx = sharedIdx >= 0 ? sharedIdx : 0;
  const thresholdUsable = Number.isFinite(edttt);

  for (const tBin of TIME_BINS) {
    // A non-finite threshold (no usable travel times for the reference window) produced NaN sums in
    // the JS path, and NaN is what getDataRowInsertSql's truthy filter drops. Reproduced without
    // sending NaN to ClickHouse.
    const groups = thresholdUsable ? await getDelayGroupsForTmc({
      db, chDb, binnedDataCache,
      year, dates,
      hours: tBin.hours, dow: tBin.dow,
      schema_name: NPMRDS_CH_SCHEMA_NAME,
      dataTableName,
      timeBinSize: 15,
      tmc,
      npmrdsDataKeys,
      secondaryDataKey,
      thresholds,
    }) : [];

    // 6 + 7. Volume-weight each (month, dow, bin) group and sum across the bin.
    let hrsAcc = thresholdUsable ? 0 : NaN;
    let vhrsAcc = thresholdUsable ? 0 : NaN;
    for (const g of groups) {
      const ed = Number(g[`ed${edIdx}`]) || 0;
      const hourlyPercentTraffic = percentAadtByMonthByDowByHour[g.month - 1][g.dow][g.timeBinNum];
      const volume15 = precisionRound(directionalaadt * hourlyPercentTraffic, 1);
      hrsAcc += ed;
      vhrsAcc += ed * volume15;
    }

    const xdelay_hrs  = hrsAcc;
    const xdelay_vhrs = precisionRound(vhrsAcc, 3);
    // Linear in vhrs, so factoring avo and the NHS share out of the per-row product and applying
    // them to the total is exact.
    const xdelay_phrs = precisionRound(avg_vehicle_occupancy * vhrsAcc * nhsPercentage, 3);

    // ALT_PMP timeframe is reported as PMP downstream — preserve legacy mapping
    const binName = tBin.name === BIN_NAMES.ALT_PMP ? BIN_NAMES.PMP : tBin.name;
    phedResult[`${binName}_all_xdelay_phrs`] = xdelay_phrs;
    phedResult[`${binName}_all_xdelay_vhrs`] = xdelay_vhrs;
    phedResult[`${binName}_xdelay_hrs`]     = xdelay_hrs;
    phedResult.xdelay_hrs       += xdelay_hrs;
    phedResult.all_xdelay_phrs  += xdelay_phrs;
    phedResult.all_xdelay_vhrs  += xdelay_vhrs;
  }

  return {
    // R3 — persisted diagnostics. These sit at the TOP level deliberately: pm3's toMetricDbRow
    // skips any object-valued key, so everything under `meta` below is computed and then thrown
    // away. Keeping them flat is what turns a future PHED audit into a join.
    threshold_speed,
    threshold_travel_time_sec: edttt,
    // Only present for the freeflow variants, matching where it is DECLARED. The speed_limit variants
    // have no percentile behind the threshold, and emitting a null key created an undeclared physical
    // column that was never populated.
    ...(tt_15_pct === null ? {} : { tt_15_pct }),
    // Emitted ONLY when the fallback fired. getDataRowInsertSql filters on !!value, so a 0 would be
    // dropped anyway — emitting the key conditionally makes NULL mean "anchored normally" without
    // relying on that, and keeps the column out of the speed_limit variants entirely.
    ...(anchorFellBack === null ? {} : { anchor_fallback: anchorFellBack }),
    meta: {
      threshold_speed,
      directionality,
      congestion_level,
      avg_vehicle_occupancy,
      nhsPercentage,
      threshold_travel_time_sec: edttt,
      avoKey,
      dirAadtKey,
      npmrdsDataKeys,
      secondaryDataKey,
    },
    ...phedResult,
  };
}

async function calcHourlyPercentTraffic({ functionalclass, directionality, congestion_level }) {
  return getFractionOfDailyAadtByMonthByDowByTimeBin({
    functionalClass: functionalclass,
    congestionLevel: congestion_level,
    directionality,
    trafficDistributionProfilesVersion: CATTLAB,
    trafficDistributionTimeBinSize: 60,
    timeBinSize: 15,
  });
}

function getFractionOfDailyAadtByMonthByDowByTimeBin({
  functionalClass, congestionLevel, directionality,
  trafficDistributionProfilesVersion, trafficDistributionTimeBinSize, timeBinSize,
}) {
  const profiles = [WEEKEND, WEEKDAY].reduce((acc, dayType) => {
    const trafficDistributionProfileName = getTrafficDistributionProfileName({
      dayType, congestionLevel, directionality, functionalClass,
    });
    acc[dayType] = getTimeBinnedTrafficDistributionProfile({
      trafficDistributionProfilesVersion, trafficDistributionProfileName, trafficDistributionTimeBinSize,
    });
    return acc;
  }, {});

  const numBinsInDay = getNumBinsInDayForTimeBinSize(timeBinSize);

  return cartesianProduct(
    range(NUM_MONTHS_IN_YEAR),
    range(NUM_DAYS_IN_WEEK),
    range(numBinsInDay)
  ).reduce((acc, [month, dow, timeBinNum]) => {
    const monthAdjust = TrafficDistributionMonthAdjustmentFactors[month];
    const dowAdjust   = TrafficDistributionDOWAdjustmentFactors[dow];
    const profile     = profiles[dow % 6 ? WEEKDAY : WEEKEND];
    const fractionOfDailyAadt = getFractionOfDailyAadtForNpmrdsDataTimeBin({
      trafficDistributionProfile: profile,
      trafficDistributionTimeBinSize,
      timeBinSize,
      timeBinNum,
    });
    acc[month] = acc[month] || [];
    acc[month][dow] = acc[month][dow] || [];
    acc[month][dow][timeBinNum] = fractionOfDailyAadt * monthAdjust * dowAdjust;
    return acc;
  }, []);
}

const tdpsVersions5minBin = {
  [CATTLAB]: mapValues(CATTLabTrafficDistributionProfiles, (tdp) =>
    chain(tdp).map((hrCt) => fill(Array(12), hrCt / 12)).flatten().value()
  ),
};

function getTimeBinnedTrafficDistributionProfile({
  trafficDistributionProfilesVersion, trafficDistributionProfileName, trafficDistributionTimeBinSize,
}) {
  const tdp5min = tdpsVersions5minBin[trafficDistributionProfilesVersion][trafficDistributionProfileName];
  return chain(tdp5min)
    .chunk(trafficDistributionTimeBinSize / MINUTES_PER_EPOCH)
    .map(sum)
    .value();
}

function getFractionOfDailyAadtForNpmrdsDataTimeBin({
  trafficDistributionProfile, trafficDistributionTimeBinSize, timeBinSize, timeBinNum,
}) {
  if (trafficDistributionTimeBinSize >= timeBinSize) {
    const tdpBin = Math.floor((timeBinSize / trafficDistributionTimeBinSize) * timeBinNum);
    const tdpFractionForBin = trafficDistributionProfile[tdpBin];
    const binSizeRatio = timeBinSize / trafficDistributionTimeBinSize;
    return tdpFractionForBin * binSizeRatio;
  }
  const tdpStart = Math.floor((timeBinSize / trafficDistributionTimeBinSize) * timeBinNum);
  const tdpEnd   = tdpStart + Math.floor(timeBinSize / trafficDistributionTimeBinSize);
  return sum(trafficDistributionProfile.slice(tdpStart, tdpEnd));
}

/**
 * Every distinct excessive-delay threshold travel time this TMC needs, across all 16 delay variants.
 *
 * There are only four, because edttt is a function of `tmcMeta.miles` and the threshold speed and
 * NEVER of the stream: posted-limit floored, own-year free-flow floored, E5-anchored floored, and
 * E5-anchored unfloored. Computing them together is what lets getDelayGroupsForTmc answer all 16
 * variants from ~6 queries per TMC instead of 24.
 *
 * Non-finite values are filtered out rather than passed to SQL: a NULL p15 yields NaN here (see the
 * note in calcFreeflowBaseThresholdSpeed), NaN has no place in a query, and the caller falls back to
 * leaving its sums NaN so the columns go unwritten — the pre-existing behaviour for a TMC with no
 * usable travel times.
 */
async function getTmcThresholdSet(props) {
  const { binnedDataCache, tmcMeta } = props;
  const CACHE_KEY = '__thresholdSet';
  if (binnedDataCache && binnedDataCache.has(CACHE_KEY)) return binnedDataCache.get(CACHE_KEY);
  const toEdttt = (base, floorMph) => {
    const ts = Math.max(0.6 * base, floorMph);
    return precisionRound((precisionRound(tmcMeta.miles, 3) / ts) * 3600);
  };
  const own = await calcFreeflowBaseThresholdSpeed({ ...props, referenceWindow: undefined });
  const anchored = await calcFreeflowBaseThresholdSpeed({
    ...props, referenceWindow: FREEFLOW_REFERENCE_WINDOW.dates,
  });
  const set = [...new Set([
    toEdttt(tmcMeta.avg_speedlimit, 20),
    toEdttt(own.baseThresholdSpeed, 20),
    toEdttt(anchored.baseThresholdSpeed, 20),
    toEdttt(anchored.baseThresholdSpeed, 0),
  ])].filter((v) => Number.isFinite(v));
  if (binnedDataCache) binnedDataCache.set(CACHE_KEY, set);
  return set;
}

async function calcFreeflowBaseThresholdSpeed(props) {
  const { db, chDb, tmcMeta, year, dataTableName, curTmcId: tmc, referenceWindow,
          freeflowP15Cache, binnedDataCache } = props;

  // The percentile below is taken over ALL_VEHICLES whatever stream the calling metric measures,
  // so it is identical for every metric sharing a reference window. Memoized per TMC by the worker
  // (see freeflowP15Cache there); absent a cache this behaves exactly as before.
  const cacheKey = referenceWindow ? referenceWindow.join('..') : `year:${year}`;
  if (freeflowP15Cache && freeflowP15Cache.has(cacheKey)) return freeflowP15Cache.get(cacheKey);
  const allHourBin = REPORTING_BINS.find((b) => b.name === BIN_NAMES.ALL);
  // R2 — when a referenceWindow is supplied the p15 comes from that FIXED window while the travel
  // times being measured still come from the publish year. That separation is the whole point: an
  // own-year p15 tracks the median at r = +0.998, so the yardstick slows down as the network does
  // and multi-year deterioration cannot be seen. getBinnedYearNpmrdsDataForTmc already accepts a
  // `dates` pair, so no query change is needed — `dates` simply wins over `year` in its own filter.
  // PERF (P-B) — the p15 comes back as a single number instead of up to 35,040 bin rows. Same
  // estimator: quantilesExactInclusive is R type-7, which is what the inlined `quantile` was.
  const stats = await getBinnedStatsForTmc({
    db, chDb, binnedDataCache,
    year,
    dates: referenceWindow || undefined,
    hours: allHourBin.hours, dow: allHourBin.dow,
    schema_name: NPMRDS_CH_SCHEMA_NAME,
    dataTableName,
    timeBinSize: 15,
    tmc,
    npmrdsDataKeys: ALL_VEHICLES,
  });
  // NULL (no bin had a valid travel time) has to become NaN, not stay null: `miles / null` is
  // Infinity in JS, which would make threshold_speed Infinity and edttt 0 — counting every bin as
  // fully delayed. The JS path returned NaN from `quantile([])`, and NaN is what propagates to an
  // unwritten column. Preserved deliberately.
  const fifteenthTt = stats.quantiles[FIFTEENTH_PCTL] ?? NaN;
  // R3: the p15 itself is returned, not just the speed derived from it. Four separate analyses
  // (H3, H5, H7, H12) each had to re-derive this from 1.7 billion raw rows to answer a question a
  // stored column answers with a join, and R2 cannot be audited after the fact without it.
  // Note the p15 is taken over 15-minute BIN MEANS across all hours and days, and because speed is
  // monotone-decreasing in travel time this is the 85th percentile of speed — the FHWA/ODOT
  // convention, which is not obvious from the code and is worth stating for auditors.
  // FALLBACK — a TMC with no data in the reference window has no anchored p15. Retired segments are
  // the usual reason: against E6 that is 4.6% of the 2017 and 2018 networks (TMCs gone before
  // mid-2023) and under 0.3% of every other year. Rather than publish nothing for them, fall back to
  // the own-year percentile and SAY SO — `anchor_fallback` is published so a consumer can exclude
  // them from a trend, where they are exactly the rows whose yardstick moves with their traffic.
  // Flag never suppress, per PROVENANCE section 7.
  if (referenceWindow && !Number.isFinite(fifteenthTt)) {
    const ownYear = await calcFreeflowBaseThresholdSpeed({ ...props, referenceWindow: undefined });
    const fell = { ...ownYear, anchor_fallback: 1 };
    if (freeflowP15Cache) freeflowP15Cache.set(cacheKey, fell);
    return fell;
  }
  const derived = { baseThresholdSpeed: (tmcMeta.miles / fifteenthTt) * 3600, tt_15_pct: fifteenthTt };
  if (freeflowP15Cache) freeflowP15Cache.set(cacheKey, derived);
  return derived;
}

module.exports = { calcPhed };
