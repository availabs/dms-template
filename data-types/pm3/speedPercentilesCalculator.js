/**
 * Speed-percentile calculator — the pm3-only `speed_pctl` metric.
 *
 * Ported to CJS from legacy
 * avail-falcor/dama/routes/data_types/pm3/speedPercentilesCalculator.js with
 * the same structural changes as the map21 calculator ports:
 *   - `chQuery({query}, pgEnv)` → injected `chDb.query({ query, format: 'JSON' })`
 *   - simple-statistics `quantile` → the same inlined linear-interpolation
 *     (R type-7) quantile the map21 port standardized on (no new deps)
 *   - the METRIC_WRITES_DB write-back was dropped: like the other ported
 *     calculators this one is PURE; the pm3 worker orchestrates the
 *     per-metric DB write.
 *
 * Computes avg all-vehicle speed (attr.miles / travel_time * 3600) per
 * 15-minute bin over the requested REPORTING_BIN (pm3 uses ALL), then the
 * [5,20,25,50,75,80,85,95] percentiles of those speeds.
 */

const {
  REPORTING_BINS,
  NPMRDS_CH_SCHEMA_NAME,
  MINUTES_PER_EPOCH,
  EPOCHS_IN_HOUR,
} = require('../map21/constants.js');

const PERCENTILES = [5, 20, 25, 50, 75, 80, 85, 95];

// Inlined quantile (linear interpolation, R type-7) — same implementation as
// the map21 calculator ports.
function quantile(arr, p) {
  if (!arr.length) return NaN;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
}

function precisionRound(number, precision = 0) {
  if (number === null) return null;
  if (!Number.isFinite(+number)) return NaN;
  const factor = 10 ** precision;
  return Math.round(+number * factor) / factor;
}

const generateAvgVehicleSpeedQuery = ({ tmc, metadataTable, dataTableName, year, dates, hours, dow, epochsPerBin }) => {
  const dateFilterClause = dates?.length === 2
    ? `${NPMRDS_CH_SCHEMA_NAME}.${dataTableName}.date >= '${dates[0]}' AND ${NPMRDS_CH_SCHEMA_NAME}.${dataTableName}.date <= '${dates[1]}'`
    : `EXTRACT(YEAR from ${NPMRDS_CH_SCHEMA_NAME}.${dataTableName}.date) = ${year}`;

  return `
    SELECT
      tmc,
      date,
      FLOOR(epoch::NUMERIC / ${epochsPerBin}::NUMERIC)::SMALLINT AS "timeBinNum",
      AVG((attr.miles / NULLIF(travel_time_all_vehicles, 0) * 3600)) AS avg_speed_all_vehicles
    FROM
      ${NPMRDS_CH_SCHEMA_NAME}.${dataTableName}
    LEFT OUTER JOIN
      ${metadataTable} AS attr USING (tmc)
    WHERE
      (tmc = '${tmc}')
    AND
      ${dateFilterClause}
    AND
      ${metadataTable}.year = ${year}
    AND
      FLOOR(epoch::NUMERIC / ${EPOCHS_IN_HOUR}::NUMERIC)::SMALLINT in (${hours})
    AND
      toDayOfWeek(date, 2) in (${dow})
    GROUP BY
        tmc, date, FLOOR(epoch::NUMERIC / ${epochsPerBin}::NUMERIC)::SMALLINT;
  `;
};

const speedPercentilesCalculator = async (props) => {
  const {
    chDb,
    curTmcId: tmc,
    year,
    dates,
    dataTableName,
    metadataTable,
    timeBins,
    timeBinSize = 15,
  } = props;

  const TIME_BIN = timeBins.map((binName) => REPORTING_BINS.find((bin) => bin.name === binName))[0];
  const epochsPerBin = Math.floor(timeBinSize / MINUTES_PER_EPOCH);
  const speedQuery = generateAvgVehicleSpeedQuery({
    tmc,
    metadataTable,
    dataTableName,
    year,
    dates,
    hours: TIME_BIN.hours,
    dow: TIME_BIN.dow,
    epochsPerBin,
  });

  const chResp = await (await chDb.query({ query: speedQuery, format: 'JSON' })).json();
  const { data } = chResp;

  const speeds = (data || []).map((row) => row.avg_speed_all_vehicles);
  const speedPercentiles = PERCENTILES.reduce((acc2, pctl) => {
    acc2[pctl] = quantile(speeds, precisionRound(pctl / 100, 2));
    return acc2;
  }, {});

  speedPercentiles.tmc = tmc;
  return speedPercentiles;
};

module.exports = {
  speedPercentilesCalculator,
  generateAvgVehicleSpeedQuery,
  PERCENTILES,
};
