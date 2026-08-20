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
const { getBinnedYearNpmrdsDataForTmc } = require('./calcTtrMeasure.js');

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
    tt_15_pct = ff.tt_15_pct;
  } else {
    baseThresholdSpeed = tmcMeta.avg_speedlimit;
  }
  const threshold_speed = Math.max(0.6 * baseThresholdSpeed, 20);

  // 2. EDTTT — excessive-delay threshold travel time (seconds)
  const segmentLength = tmcMeta.miles;
  const edttt = precisionRound((precisionRound(segmentLength, 3) / threshold_speed) * 3600);

  const TIME_BINS = timeBins.map((binName) => REPORTING_BINS.find((b) => b.name === binName));
  const percentAadtByMonthByDowByHour = await calcHourlyPercentTraffic({ ...tmcMeta });

  const phedResult = { tmc, all_xdelay_phrs: 0, all_xdelay_vhrs: 0, xdelay_hrs: 0 };

  for (const tBin of TIME_BINS) {
    const binnedData = await getBinnedYearNpmrdsDataForTmc({
      db, chDb,
      year, dates,
      hours: tBin.hours, dow: tBin.dow,
      schema_name: NPMRDS_CH_SCHEMA_NAME,
      dataTableName,
      timeBinSize: 15,
      tmc,
      npmrdsDataKeys,
      secondaryDataKey,
    });

    const merged = binnedData.rows.length
      ? binnedData.rows.map((row) => ({ ...row, tt: row.tt ? row.tt : row.tt2 }))
      : [];

    // 3 + 4. Travel-time segment delay → excessive delay (clamped at 15 min/3600s = 0.25h)
    const rsdData = merged.map((row) => {
      const tt = precisionRound(row.tt);
      const xds = precisionRound(tt - edttt);
      const xdelaySec = Math.min(xds, SEC_PER_MINUTE * 15);
      const xdh = xdelaySec / 3600;
      const xdelayHrs = precisionRound(xdh, 3);
      return { ...row, xds, ed: Math.max(xdelayHrs, 0) };
    });

    // 6. Total delay
    const tdData = [];
    for (const row of rsdData) {
      const { month, dow, timeBinNum } = row;
      const adjustedMonth = month - 1;
      const hourlyPercentTraffic = percentAadtByMonthByDowByHour[adjustedMonth][dow][timeBinNum];
      const volume15 = precisionRound(directionalaadt * hourlyPercentTraffic, 1);
      const xdelay_vhrs = row.ed * volume15;
      tdData.push({
        ...row,
        xdelay_hrs: row.ed,
        xdelay_vhrs,
        xdelay_phrs: avg_vehicle_occupancy * xdelay_vhrs * nhsPercentage,
      });
    }

    // 7. PHED — sum across the bin
    const xdelay_phrs = precisionRound(tdData.reduce((s, r) => s + r.xdelay_phrs, 0), 3);
    const xdelay_vhrs = precisionRound(tdData.reduce((s, r) => s + r.xdelay_vhrs, 0), 3);
    const xdelay_hrs  = tdData.reduce((s, r) => s + r.xdelay_hrs, 0);

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
    tt_15_pct,
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

async function calcFreeflowBaseThresholdSpeed(props) {
  const { db, chDb, tmcMeta, year, dataTableName, curTmcId: tmc, referenceWindow,
          freeflowP15Cache } = props;

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
  const binnedData = await getBinnedYearNpmrdsDataForTmc({
    db, chDb,
    year,
    dates: referenceWindow || undefined,
    hours: allHourBin.hours, dow: allHourBin.dow,
    schema_name: NPMRDS_CH_SCHEMA_NAME,
    dataTableName,
    timeBinSize: 15,
    tmc,
    npmrdsDataKeys: ALL_VEHICLES,
  });
  const ttData = binnedData.rows.map((r) => r.tt);
  const fifteenthTt = quantile(ttData, FIFTEENTH_PCTL);
  // R3: the p15 itself is returned, not just the speed derived from it. Four separate analyses
  // (H3, H5, H7, H12) each had to re-derive this from 1.7 billion raw rows to answer a question a
  // stored column answers with a join, and R2 cannot be audited after the fact without it.
  // Note the p15 is taken over 15-minute BIN MEANS across all hours and days, and because speed is
  // monotone-decreasing in travel time this is the 85th percentile of speed — the FHWA/ODOT
  // convention, which is not obvious from the code and is worth stating for auditors.
  const derived = { baseThresholdSpeed: (tmcMeta.miles / fifteenthTt) * 3600, tt_15_pct: fifteenthTt };
  if (freeflowP15Cache) freeflowP15Cache.set(cacheKey, derived);
  return derived;
}

module.exports = { calcPhed };
