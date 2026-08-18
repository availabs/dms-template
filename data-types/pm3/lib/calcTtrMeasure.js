/**
 * FORKED FROM map21 on 2026-08-14 — see
 * planning/transportny/tasks/current/pm3-fork-and-measure-implementation.md (Phase 0).
 *
 * pm3 and map21 are deliberately allowed to diverge from here: map21 is frozen for
 * calculation (federal submittal, backward compatibility), pm3 is not. Do NOT
 * "resync" this file with ../../map21/calcTtrMeasure.js — divergence is the point.
 * pm3/tests/no-map21-import.unit.test.mjs enforces that pm3 never imports map21 again.
 */
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
const { getExpectedBinsForYear } = require('./helpers.js');
const { expectedSdForN, minNBar } = require('./precision.js');

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

    // R4 — per-bin-group completeness, carried per TIME BIN rather than once per row. The diurnal
    // coverage swing is ~5x (data-quality-atlas.html), so an AM-peak LOTTR and an overnight TTTR on
    // the same segment rest on very different sample sizes and a single per-row figure would
    // misdescribe both. n_bins is the observation count the percentiles were taken over;
    // mean_epochs_per_bin is the probe depth behind each of those observations, which is the term the
    // sparsity bias actually tracks.
    const epochCounts = tmcData.map((row) => Number(row['n_epochs']) || 0);
    const nBins = averagedTmcData.length;
    const meanEpochsPerBin = nBins
      ? precisionRound(epochCounts.reduce((a, b) => a + b, 0) / nBins, 3)
      : 0;
    ttr_result[`${name}_n_bins`] = nBins;
    ttr_result[`${name}_mean_epochs_per_bin`] = meanEpochsPerBin;

    // R4 — completeness as a percentage of what this bin COULD have contained. Reinstates the
    // legacy pct_bins_reporting column. The denominator is derived from the bin's own hours x
    // day-of-week mask (see getExpectedBinsForYear), because AMP could hold 4,176 bins in 2025
    // while OVN could hold 14,600 -- a single network-wide denominator would misstate both.
    const expectedBins = getExpectedBinsForYear({ hours, dow, year, timeBinSize: 15 });
    ttr_result[`${name}_pct_bins_reporting`] = expectedBins
      ? precisionRound((100 * nBins) / expectedBins, 2)
      : null;

    // R4 (H9) — of the epochs behind those bins, the share that rested on 1-4 probe vehicles.
    // H6 found density weighting adds nothing over a plain count for the all-vehicle stream, so
    // this is published for the TRUCK metrics only; it is computed here for whichever stream the
    // metric reads and selectively published by metricColumnDescriptors.
    const totalEpochs = epochCounts.reduce((a, b) => a + b, 0);
    const densityAEpochs = tmcData.reduce((a, row) => a + (Number(row['n_epochs_density_a']) || 0), 0);
    ttr_result[`${name}_pct_epochs_density_a`] = totalEpochs
      ? precisionRound((100 * densityAEpochs) / totalEpochs, 2)
      : null;

    // R6 — precision band and the minimum-n flag, from H1b's measured down-sampling curves.
    // Advisory only: this FLAGS a thin sample, it never suppresses the value. H1b measured that
    // only 0.16% of directional VMT sits below LOTTR's bar, so gating would buy almost nothing and
    // would remove the short-segment population for the wrong reason (H2).
    const sd = expectedSdForN(metricName, nBins);
    ttr_result[`${name}_precision_band`] = sd === null ? null : precisionRound(sd, 5);
    // DEVIATION FROM THE PLAN, deliberate: R6 asked for a boolean `below_min_n`. That column is not
    // implementable here. getDataRowInsertSql filters on `!!value` -- legacy behaviour kept on
    // purpose so null/NaN metrics simply are not written -- so `false` and `0` are silently dropped
    // and the column would be NULL-for-false, which is ambiguous. `true` is worse: it would emit a
    // boolean literal into a column the ALTER types NUMERIC.
    //
    // So the BAR is published instead of the comparison. `n_bins < min_n_bar` is the flag, computed
    // by the consumer, and the row is self-describing: you can see both how much sample there is and
    // how much there should be. For TTTR the bar is 57,832 against the 14,600 bins an overnight year
    // contains, so the comparison is always true -- which is the honest reading, not a defect.
    ttr_result[`${name}_min_n_bar`] = minNBar(metricName);
    if (!averagedTmcData.length) {
      console.log(`[pm3] no data rows: metric=${metricName} bin=${name} tmc=${curTmcId} — defaulting to 1`);
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
  // travel_time_freight_trucks -> data_density_freight_trucks, etc.
  const densityKey = String(npmrdsDataKeys).replace(/^travel_time_/, 'data_density_');
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
      round(${avgClause}, 3) as tt,
      -- R4: how many 5-minute epochs actually backed this bin mean. H1b showed the sparsity bias
      -- tracks probes-per-bin, NOT bin count -- and in opposite directions -- so a completeness
      -- column reporting bin count alone lets a consumer reason about sparsity with the sign
      -- inverted. The CASE mirrors avgClause's own > 0 filter so the two always agree, and is
      -- portable: this query has a schema_name='public' Postgres fallback, where countIf does not exist.
      count(CASE WHEN ${npmrdsDataKeys} > 0 THEN 1 END) as n_epochs,
      -- R4 (H9): of the epochs that contributed, how many rested on only 1-4 probe vehicles.
      -- The density column name is derived from the travel-time key, so this follows whichever
      -- stream the metric reads without a second parameter to keep in sync.
      count(CASE WHEN ${npmrdsDataKeys} > 0 AND ${densityKey} = 'A' THEN 1 END) as n_epochs_density_a
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
