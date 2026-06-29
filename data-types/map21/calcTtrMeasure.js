/**
 * LOTTR / TTTR (travel-time reliability) calculator.
 *
 * Ported from references/avail-falcor/.../map21/calcTtrMeasure.js. Three
 * legacy code paths were dropped because they were either unused or
 * gated off:
 *   - `pm3Config.METRIC_WRITES_DB` — wrote per-TMC rows from inside the
 *     metric calculator. The new worker writes from the orchestrator, not
 *     from each calculator. Always false in production usage.
 *   - `pm3Config.COMPARE_AGAINST_HISTORIC` — pulled rows from a hardcoded
 *     legacy "npmrds" pgEnv that no longer exists.
 *   - `pm3_output/` directory + per-TMC dump files — diagnostic only.
 *
 * `query`/`chQuery` swapped for `db`/`chDb` adapters passed in via the
 * caller. `logger.info` swapped for `console.log`.
 */

// simple-statistics quantile (R type-7, linear interpolation), inlined to
// avoid the dependency for a single function.
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
  REPORTING_BINS,
  NPMRDS_CH_SCHEMA_NAME,
  MINUTES_PER_EPOCH,
  EPOCHS_IN_HOUR,
  PERCENTILES_FOR_MEASURES,
} = require('./constants.js');

const SHOULD_ROUND = true;

function precisionRound(number, precision = 0) {
  if (number === null) return null;
  if (!Number.isFinite(+number)) return NaN;
  const factor = 10 ** precision;
  return Math.round(+number * factor) / factor;
}

const toInteger = (n) => precisionRound(n, 0);

async function calcTtrMeasure({
  db,
  chDb,
  metricName,
  curTmcId,
  year,
  dates,
  npmrdsDataKeys,
  dataTableName,
  timeBins,
  secondaryDataKey,
}) {
  let ttr_result = { tmc: curTmcId };

  const ttrBins = timeBins.map((binName) => REPORTING_BINS.find((b) => b.name === binName));
  for (const bin of ttrBins) {
    const { hours, dow, name } = bin;
    const { rows: tmcData } = await getBinnedYearNpmrdsDataForTmc({
      db, chDb,
      hours, dow, year, dates,
      timeBinSize: 15,
      npmrdsDataKeys,
      dataTableName,
      schema_name: NPMRDS_CH_SCHEMA_NAME,
      tmc: curTmcId,
      secondaryDataKey,
    });

    const averagedTmcData = tmcData.length ? tmcData.map((row) => row['tt'] || row['tt2']) : [];
    if (!averagedTmcData.length) {
      console.log(`[map21] no data rows: metric=${metricName} bin=${name} tmc=${curTmcId} — defaulting to 1`);
    }

    const { upperPercentile, lowerPercentile } = PERCENTILES_FOR_MEASURES[metricName];
    ttr_result = {
      ...ttr_result,
      ...calculateTtr({
        rowKey: name,
        shouldRound: SHOULD_ROUND,
        metricName,
        data: averagedTmcData,
        upperPercentile,
        lowerPercentile,
      }),
    };
  }

  return ttr_result;
}

/**
 * Pull binned travel-time data for a single TMC from the NPMRDS prod source.
 *
 * Routes to ClickHouse by default (schema_name = 'npmrds'). The legacy
 * "schema_name === 'public'" testing fallback that hits PG is preserved
 * unchanged — kept for one-off diagnostics, not used by the worker.
 */
async function getBinnedYearNpmrdsDataForTmc({
  db, chDb,
  year, dates, schema_name, dataTableName, timeBinSize, tmc,
  npmrdsDataKeys, hours, dow, secondaryDataKey,
}) {
  const epochsPerBin = Math.floor(timeBinSize / MINUTES_PER_EPOCH);
  const dayOfWeekSelectClause = `toDayOfWeek(date, 2)`;
  const dayOfWeekClause = `toDayOfWeek(date, 2) in (${dow})`;
  const avgClause = `AVG(CASE WHEN ${npmrdsDataKeys} > 0 THEN ${npmrdsDataKeys} ELSE NULL END)`;
  const secondaryAvgClause = secondaryDataKey
    ? `, round(AVG(CASE WHEN ${secondaryDataKey} > 0 THEN ${secondaryDataKey} ELSE NULL END), 3) as tt2`
    : '';
  const dateFilterClause = dates?.length === 2
    ? `date >= '${dates[0]}' AND date <= '${dates[1]}'`
    : `EXTRACT(YEAR from date) = ${year}`;

  const sql = `
    SELECT
      tmc,
      date,
      (${dayOfWeekSelectClause}) as dow,
      EXTRACT(MONTH from date) as month,
      FLOOR(epoch::NUMERIC / ${epochsPerBin}::NUMERIC)::SMALLINT AS "timeBinNum",
      round(${avgClause}, 3) as tt
      ${secondaryAvgClause}
    FROM ${schema_name}.${dataTableName}
    WHERE
      tmc = '${tmc}'
      AND ${dateFilterClause}
      AND FLOOR(epoch::NUMERIC / ${EPOCHS_IN_HOUR}::NUMERIC)::SMALLINT in (${hours})
      AND ${dayOfWeekClause}
    GROUP BY tmc, date, FLOOR(epoch::NUMERIC / ${epochsPerBin}::NUMERIC)::SMALLINT
    ORDER BY date, tmc, FLOOR(epoch::NUMERIC / ${epochsPerBin}::NUMERIC)::SMALLINT;
  `;

  if (schema_name === 'public') {
    const { rowCount, rows } = await db.query(sql);
    return { rowCount, rows };
  }
  const result = await chDb.query({ query: sql, format: 'JSON' });
  const json = await result.json();
  const { rows, data } = json;
  return { rowCount: rows, rows: data };
}

function calculateTtr({ rowKey, data, upperPercentile, lowerPercentile, metricName, shouldRound }) {
  const ttr_result = {};
  const upper = data.length ? quantile(data, upperPercentile) : 1;
  const lower = data.length ? quantile(data, lowerPercentile) : 1;
  const upperLabel = `${(upperPercentile * 100).toString()}_PCT`;
  const lowerLabel = `${(lowerPercentile * 100).toString()}_PCT`;

  ttr_result[`${rowKey}_${metricName}`] = shouldRound ? precisionRound(upper / lower, 2) : (upper / lower);
  ttr_result[`${rowKey}_${metricName}_${upperLabel}`] = shouldRound ? toInteger(upper) : upper;
  ttr_result[`${rowKey}_${metricName}_${lowerLabel}`] = shouldRound ? toInteger(lower) : lower;
  return ttr_result;
}

module.exports = { calcTtrMeasure, getBinnedYearNpmrdsDataForTmc };
