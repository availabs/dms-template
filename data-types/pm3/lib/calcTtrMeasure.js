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
  BIN_NAMES,
  REPORTING_BINS,
  NPMRDS_CH_SCHEMA_NAME,
  MINUTES_PER_EPOCH,
  EPOCHS_IN_HOUR,
  PERCENTILES_FOR_MEASURES,
  FREIGHT_TRUCKS,
  ALL_VEHICLES,
} = require('./constants.js');
const { expectedSdForN, minNBar } = require('./precision.js');

const SHOULD_ROUND = true;

// Every level any pm3 measure needs, always fetched together so one aggregate serves them all:
// p15 (calcPhed free-flow base), p50 (LOTTR/TTTR denominator), p80 (LOTTR, R1 tttr_p80), p95 (TTTR).
const QUANTILE_LEVELS = [0.15, 0.5, 0.8, 0.95];

/**
 * Per-query ClickHouse settings for every pm3 query.
 *
 * `max_threads` — the server has 36 physical cores, so ClickHouse's default resolves to
 * `auto(36)`. pm3 issues ~50 SMALL queries per second and each was fanning out across up to 36
 * threads, which is pure coordination overhead: `system.query_log` showed **979ms of summed thread
 * real-time per query against 114ms of actual CPU and 60ms of wall**, with OSCPUWait at 0.2ms and
 * OSIOWait at 0 — neither CPU-starved nor IO-bound. `max_threads=auto` is tuned for a few large
 * analytical queries; this worker is the opposite workload.
 *
 * Measured on the real merged stats query, 64 TMCs at concurrency 8:
 *
 *   auto(36)  111 q/s   mean 69.0ms   p95 131ms
 *   8         158 q/s   mean 47.8ms   p95  63ms
 *   4         169 q/s   mean 45.7ms   p95  57ms   <- chosen
 *   2         152 q/s   mean 51.4ms   p95  62ms
 *   1         159 q/s   mean 46.8ms   p95  66ms
 *
 * +52% throughput and p95 more than halved. The cliff is between auto(36) and anything bounded;
 * 1-8 are within noise, so 4 is a safe middle.
 *
 * Set per QUERY rather than on the shared adapter or the ClickHouse server, deliberately: this
 * scopes the change to pm3 and leaves every other consumer of the dms-server ClickHouse adapter,
 * and every other workload on that host, untouched.
 *
 * NOT set here: `use_uncompressed_cache`. pm3 re-reads each TMC's 6.33 MiB slice ~5.6 times, so it
 * would help — but the run churns 1.77 TiB through a server-wide 8 GiB cache, which would evict
 * other workloads' blocks. It needs `uncompressed_cache_size` raised on the server first.
 */
const CH_QUERY_SETTINGS = { max_threads: 4 };

// Kept as a SQL-side literal so the 15-minute clamp reads the same in both languages.
const SEC_PER_MINUTE_SQL = 60;

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
  binnedDataCache,
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
    // PERF (P-B) — pushdown. This used to fetch every bin row and compute the quantiles and the two
    // epoch sums in JS; ClickHouse now returns one row holding all of them.
    const stats = await getBinnedStatsForTmc({
      db, chDb, binnedDataCache,
      hours, dow, year, dates,
      timeBinSize: 15,
      npmrdsDataKeys,
      dataTableName,
      schema_name: NPMRDS_CH_SCHEMA_NAME,
      tmc: curTmcId,
      secondaryDataKey,
    });

    // R4 — per-bin-group completeness, carried per TIME BIN rather than once per row. The diurnal
    // coverage swing is ~5x (data-quality-atlas.html), so an AM-peak LOTTR and an overnight TTTR on
    // the same segment rest on very different sample sizes and a single per-row figure would
    // misdescribe both. n_bins is the observation count the percentiles were taken over;
    // mean_epochs_per_bin is the probe depth behind each of those observations, which is the term the
    // sparsity bias actually tracks.
    // n_bins stays here: it is this measure's own sample size, which the precision band below is a
    // function of. The COMPLETENESS percentages moved to the standalone `coverage` metric — they are a
    // property of (stream, bin) and were being duplicated across measures reading the same stream.
    const nBins = stats.n_bins;
    ttr_result[`${name}_n_bins`] = nBins;

    // R4 — completeness as a percentage of what this bin COULD have contained. Reinstates the
    // legacy pct_bins_reporting column. The denominator is derived from the bin's own hours x
    // day-of-week mask (see getExpectedBinsForYear), because AMP could hold 4,176 bins in 2025
    // while OVN could hold 14,600 -- a single network-wide denominator would misstate both.
    // R4 (H9) — of the epochs behind those bins, the share that rested on 1-4 probe vehicles.
    // H6 found density weighting adds nothing over a plain count for the all-vehicle stream, so
    // this is published for the TRUCK metrics only; it is computed here for whichever stream the
    // metric reads and selectively published by metricColumnDescriptors.
    const totalEpochs = stats.n_epochs;
    const densityAEpochs = stats.n_epochs_density_a;
    // Emitted only for the truck stream, matching where it is DECLARED. H6 found density adds nothing
    // over a plain count for all-vehicles, so publishing it there would be noise — and emitting a key
    // that no descriptor declares creates an undeclared physical column (caught by the registry-wide
    // invariant test in source-columns.unit.test.mjs).
    if (npmrdsDataKeys === FREIGHT_TRUCKS) {
      ttr_result[`${name}_pct_epochs_density_a`] = totalEpochs
        ? precisionRound((100 * densityAEpochs) / totalEpochs, 2)
        : null;
    }

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
    if (!nBins) {
      console.log(`[pm3] no data rows: metric=${metricName} bin=${name} tmc=${curTmcId} — defaulting to 1`);
    }

    const { upperPercentile, lowerPercentile } = PERCENTILES_FOR_MEASURES[metricName];
    // Guard rather than trust: a measure whose percentile is not in the shared fetch would otherwise
    // read `undefined` and silently publish 1 for every segment.
    for (const lv of [upperPercentile, lowerPercentile]) {
      if (!QUANTILE_LEVELS.includes(lv)) {
        throw new Error(`pm3: metric ${metricName} needs quantile ${lv}, which getBinnedStatsForTmc does not fetch`);
      }
    }
    ttr_result = {
      ...ttr_result,
      ...calculateTtr({
        rowKey: name,
        shouldRound: SHOULD_ROUND,
        metricName,
        nBins,
        upper: stats.quantiles[upperPercentile],
        lower: stats.quantiles[lowerPercentile],
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
/**
 * The per-(date, 15-minute-bin) mean travel time subquery — the single definition of "a bin",
 * shared by the row fetch below and by every pushdown aggregate. Extracted so an aggregate can
 * WRAP it rather than restate it: two copies of this SQL would be two definitions of the measure.
 */
function buildBinnedSql({
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

  // PERF (P-A) — `tmc` and `date` are in the GROUP BY, where they are load-bearing, but NOT in the
  // SELECT list. No calculator reads either field: the only ones consumed are tt, tt2, n_epochs,
  // month, dow and timeBinNum. They were 2 of 8 shipped columns on 7.35 BILLION rows per publish.
  // Verified by grep across calcPhed/calcTtrMeasure/coverageCalculator at the time of the change,
  // and `createPm3Output` only ever exported a CSV header map.
  const sql = `
    SELECT
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
  `;

  return sql;
}

/**
 * PERF (item 2) — ONE scan projecting BOTH travel-time streams.
 *
 * `travel_time_all_vehicles` and `travel_time_freight_trucks` are columns in the SAME rows, and the
 * WHERE clause (tmc, date window, hours, day-of-week) is stream-independent — the per-stream filter
 * lives INSIDE the aggregates, as `CASE WHEN key > 0`. So the two streams were being served by two
 * identical scans of identical rows. Since ClickHouse's cost here is dominated by fixed per-query
 * work rather than rows scanned (a 24-hour bin costs 43ms against a 4-hour bin's 37ms), that was
 * close to a doubling of the query count for nothing.
 *
 * Column names are suffixed per stream so the outer aggregate can address either.
 */
function buildBinnedSqlBothStreams({
  year, dates, schema_name, dataTableName, timeBinSize, tmc, hours, dow,
}) {
  const epochsPerBin = Math.floor(timeBinSize / MINUTES_PER_EPOCH);
  const dateFilterClause = dates?.length === 2
    ? `date >= '${dates[0]}' AND date <= '${dates[1]}'`
    : `EXTRACT(YEAR from date) = ${year}`;
  const perStream = STREAM_VARIANTS_SQL.map(({ suffix, ttKey }) => {
    const densityKey = String(ttKey).replace(/^travel_time_/, 'data_density_');
    return `
      round(AVG(CASE WHEN ${ttKey} > 0 THEN ${ttKey} ELSE NULL END), 3) AS tt_${suffix},
      count(CASE WHEN ${ttKey} > 0 THEN 1 END) AS n_epochs_${suffix},
      count(CASE WHEN ${ttKey} > 0 AND ${densityKey} = 'A' THEN 1 END) AS n_epochs_density_a_${suffix}`;
  }).join(',');

  return `
    SELECT
      (toDayOfWeek(date, 2)) as dow,
      EXTRACT(MONTH from date) as month,
      FLOOR(epoch::NUMERIC / ${epochsPerBin}::NUMERIC)::SMALLINT AS "timeBinNum",
      ${perStream}
    FROM ${schema_name}.${dataTableName}
    WHERE
      tmc = '${tmc}'
      AND ${dateFilterClause}
      AND FLOOR(epoch::NUMERIC / ${EPOCHS_IN_HOUR}::NUMERIC)::SMALLINT in (${hours})
      AND toDayOfWeek(date, 2) in (${dow})
    GROUP BY tmc, date, FLOOR(epoch::NUMERIC / ${epochsPerBin}::NUMERIC)::SMALLINT
  `;
}

/** The two physical streams, in the suffix order the merged projection uses. */
const STREAM_VARIANTS_SQL = [
  { suffix: 'av', ttKey: ALL_VEHICLES },
  { suffix: 'ft', ttKey: FREIGHT_TRUCKS },
];

/**
 * Every (stream, fallback) combination pm3 actually requests, and how each reads the merged
 * projection. Only three exist across the whole registry:
 *
 *   all-vehicle, no fallback          11 metrics (coverage, speed_pctl, lottr, the all-veh delays)
 *   truck, falling back to all-veh    10 metrics (tttr, tttr_p80, the truck delays)
 *   truck, no fallback                coverage's own truck pass
 *
 * The third is NOT redundant even though it differs from the second only in a column coverage never
 * reads: writing one cache entry under both keys would hand a later quantile reader the fallback
 * value under the no-fallback key. Both quantile sets are computed instead — cheap next to the scan
 * they share — so every cache entry is exactly right.
 *
 * `n_epochs` and the density count always follow the PRIMARY stream, matching the single-stream
 * builder where they were derived from `npmrdsDataKeys` and never from the secondary.
 */
const streamVariants = () => [
  { primary: ALL_VEHICLES,   secondary: null,         suffix: 'av', value: 'tt_av' },
  { primary: FREIGHT_TRUCKS, secondary: null,         suffix: 'ft', value: 'tt_ft' },
  // `tt || tt2` in SQL: the JS truthiness fallback means 0 and NULL both fall through.
  { primary: FREIGHT_TRUCKS, secondary: ALL_VEHICLES, suffix: 'ft', value: 'if(isNull(tt_ft) OR tt_ft = 0, tt_av, tt_ft)' },
];

/** Cache key for anything derived from one (stream, bin, window, tmc) fetch. */
const binnedCacheKey = (spec, tag) => JSON.stringify([
  tag, spec.npmrdsDataKeys, spec.secondaryDataKey || '', spec.hours, spec.dow, spec.timeBinSize,
  spec.tmc, spec.year, spec.dates || '', spec.schema_name, spec.dataTableName,
]);

/**
 * `tt || tt2` in SQL. calcTtrMeasure and calcPhed both fall back to the secondary stream with a JS
 * truthiness test, so 0 and NULL both fall through — reproduced exactly here.
 *
 * Conditional on the spec: `tt2` is only projected when a secondaryDataKey was requested, so
 * referencing it unconditionally is an UNKNOWN_IDENTIFIER for every all-vehicle metric. With no
 * secondary stream the bin mean is `AVG(CASE WHEN key > 0 ...)`, which is NULL or positive and never
 * 0, so a bare `tt` is the whole of the fallback.
 */
const valueExpr = ({ secondaryDataKey }) =>
  (secondaryDataKey ? 'if(isNull(tt) OR tt = 0, tt2, tt)' : 'tt');

/**
 * PUSHDOWN (P-B) — the per-(stream, bin) statistics every percentile measure needs, computed in
 * ClickHouse instead of by shipping up to 35,040 bin rows per fetch into JavaScript.
 *
 * ONE aggregate serves lottr, tttr, tttr_p80, coverage AND calcPhed's free-flow p15, because it
 * always returns the full quantile set rather than the pair its caller happens to want. That is
 * deliberate: keying the cache on the quantile pair would have un-shared `tttr` from `tttr_p80`
 * (identical data, different pair) and turned a saving into a regression.
 *
 * `quantilesExactInclusive` is the R type-7 / linear-interpolation estimator — the SAME one the
 * inlined JS `quantile` implements. Verified against it directly: for [1,2,3,4,5] both give
 * 1.6 / 3 / 4.2 / 4.8 at p15/p50/p80/p95.
 *
 * `n_bins` counts bins where THE REQUESTED VALUE IS NOT NULL, not bins where the feed had rows.
 * A bare `count()` over `GROUP BY tmc, date, timeBinNum` counts a group whenever the feed has any
 * row in that bin, because the per-stream filter lives INSIDE the aggregates as `CASE WHEN key > 0`
 * rather than in the WHERE. All-vehicle travel times are present in 100% of feed bins and truck
 * times in 50.26% (measured over 5,998,613 bins in 2025), so `count()` was right by accident for
 * all-vehicle and ~2x too high for the truck stream alone — which is why every
 * `coverage_freight_trucks_*_pct_bins_reporting` was byte-identical to its all-vehicle counterpart.
 *
 * Note this is correctly a per-VARIANT count, not per-stream: the truck-with-fallback variant's value
 * resolves to all-vehicle wherever truck data is missing, so its sample really is ~all feed bins.
 * Only the no-fallback truck variant — coverage's own pass — moves.
 *
 * ONE DELIBERATE BEHAVIOUR CHANGE: `quantilesExactInclusive` skips NULL values; the JS path sorted
 * them, where `null - null` coerces them to 0, so a bin with no valid travel time in EITHER stream
 * entered the percentile as a zero-second traversal — deflating p50 and inflating every ratio built
 * on it. Skipping is the correct reading. `n_bins` still counts every row, so the published sample
 * size is unchanged.
 */
const shapeStats = (r) => {
  const q = (r && r.q) || [];
  return {
    n_bins: Number(r && r.n_bins) || 0,
    n_epochs: Number(r && r.n_epochs) || 0,
    n_epochs_density_a: Number(r && r.n_epochs_density_a) || 0,
    quantiles: QUANTILE_LEVELS.reduce((acc, lv, i) => {
      acc[lv] = q[i] === null || q[i] === undefined ? null : Number(q[i]);
      return acc;
    }, {}),
  };
};

/**
 * Every reporting bin a measure or the coverage metric can ask for. FREEFLOW is excluded because
 * nothing reads it; an unrecognised bin falls through to its own single-bin query rather than
 * silently returning the wrong window.
 */
const BATCHED_BINS = () => REPORTING_BINS.filter((b) => b.name !== BIN_NAMES.FREEFLOW);

const sameBin = (spec, bin) =>
  String(spec.hours) === String(bin.hours) && String(spec.dow) === String(bin.dow);

/**
 * The bin predicate, expressed against the INNER query's own projections.
 *
 * The hour is `intDiv(timeBinNum, 4)`, not a re-derivation from `epoch`: `timeBinNum` is
 * `floor(epoch / 3)` and is a GROUP BY key, and `floor(floor(epoch/3) / 4) === floor(epoch / 12)`
 * exactly, which is the hour expression the inner WHERE uses. Re-projecting `epoch` would not even
 * parse — it is not in the GROUP BY.
 *
 * `dow` is the inner query's own `toDayOfWeek(date, 2)` column, so the weekday/weekend split is
 * whatever that mode means and cannot drift from the single-bin path.
 */
const binCondition = (bin) =>
  `(intDiv("timeBinNum", 4) IN (${bin.hours.join(',')}) AND dow IN (${bin.dow.join(',')}))`;

/**
 * PERF (P-C) — one ClickHouse scan per (stream, window, TMC) instead of one per bin.
 *
 * Measured on real data: ClickHouse's cost here is almost entirely FIXED per query, not scan volume
 * — a 24-hour bin (27,785 bins) costs 43ms against a 4-hour bin's (4,091 bins) 37ms. So the ten
 * per-bin queries were ten near-identical scans of the same TMC-year. Conditional aggregates collapse
 * them: six bins in one query measured 57ms against 147ms for just four issued separately.
 *
 * The signature is deliberately unchanged — callers still ask for one bin. The batch is an
 * implementation detail: the whole bin set is computed in one round trip and every bin's entry is
 * written into the shared per-TMC cache, so the first caller pays for all of them and the rest are
 * free. That keeps coverage (7 bins) and the measures (their own bins) sharing one scan.
 */
/** One (stream, bin, window) statistics query — the un-batched path. */
async function fetchStatsSingle(spec, key) {
  const { chDb, binnedDataCache } = spec;
  const sql = `
    SELECT
      countIf(${valueExpr(spec)} IS NOT NULL) AS n_bins,
      sum(n_epochs) AS n_epochs,
      sum(n_epochs_density_a) AS n_epochs_density_a,
      quantilesExactInclusive(${QUANTILE_LEVELS.join(', ')})(${valueExpr(spec)}) AS q
    FROM (${buildBinnedSql(spec)})
  `;
  const json = await (await chDb.query({ query: sql, format: 'JSON', clickhouse_settings: CH_QUERY_SETTINGS })).json();
  const out = shapeStats(json.data && json.data[0]);
  if (key && binnedDataCache) binnedDataCache.set(key, out);
  return out;
}

async function getBinnedStatsForTmc(spec) {
  const { chDb, binnedDataCache } = spec;
  const key = binnedDataCache && binnedCacheKey(spec, 'stats');
  if (key && binnedDataCache.has(key)) return binnedDataCache.get(key);

  const bins = BATCHED_BINS();
  const target = bins.find((b) => sameBin(spec, b));
  const all = REPORTING_BINS.find((b) => b.name === BIN_NAMES.ALL);

  // Unrecognised bin, or no cache to spread the batch across: answer just what was asked.
  if (!target || !binnedDataCache) return fetchStatsSingle(spec, key);

  // ALL is the superset of every other bin (hours 0-23, dow 0-6), so one scan over it answers all
  // of them by predicate — and the merged projection answers BOTH streams from the same scan.
  const scanSpec = { ...spec, hours: all.hours, dow: all.dow };
  const variants = streamVariants();
  const selects = [];
  bins.forEach((b, i) => {
    const cond = binCondition(b);
    for (const [vi, vr] of variants.entries()) {
      selects.push(
        // n_bins counts bins where THIS variant has a usable value, not bins where the feed had
        // rows. See the note on the aggregate below — a bare count() is the all-vehicle figure for
        // every stream, because the per-stream filter lives inside the aggregates.
        `countIf(${cond} AND ${vr.value} IS NOT NULL) AS n_bins_${i}_${vi}`,
        `sumIf(n_epochs_${vr.suffix}, ${cond}) AS n_epochs_${i}_${vi}`,
        `sumIf(n_epochs_density_a_${vr.suffix}, ${cond}) AS n_epochs_density_a_${i}_${vi}`,
        `quantilesExactInclusiveIf(${QUANTILE_LEVELS.join(', ')})(${vr.value}, ${cond}) AS q_${i}_${vi}`,
      );
    }
  });

  const sql = `
    SELECT
      ${selects.join(',\n      ')}
    FROM (${buildBinnedSqlBothStreams(scanSpec)})
  `;
  const json = await (await chDb.query({ query: sql, format: 'JSON', clickhouse_settings: CH_QUERY_SETTINGS })).json();
  const row = (json.data && json.data[0]) || {};

  let out = null;
  bins.forEach((b, i) => {
    for (const [vi, vr] of variants.entries()) {
      const stats = shapeStats({
        n_bins: row[`n_bins_${i}_${vi}`], n_epochs: row[`n_epochs_${i}_${vi}`],
        n_epochs_density_a: row[`n_epochs_density_a_${i}_${vi}`], q: row[`q_${i}_${vi}`],
      });
      const entrySpec = { ...spec, hours: b.hours, dow: b.dow,
                          npmrdsDataKeys: vr.primary, secondaryDataKey: vr.secondary };
      binnedDataCache.set(binnedCacheKey(entrySpec, 'stats'), stats);
      if (b === target
          && vr.primary === spec.npmrdsDataKeys
          && (vr.secondary || null) === (spec.secondaryDataKey || null)) out = stats;
    }
  });
  // The requested (stream, fallback) pair is not one of the three the registry uses — fall back to a
  // single-variant query rather than return a neighbouring stream's numbers.
  if (!out) return fetchStatsSingle(spec, key);
  return out;
}

/**
 * `precisionRound(x, p)` in SQL. The JS helper is `Math.round(x * 10^p) / 10^p`, and Math.round is
 * round-half-UP (toward +Infinity), which `floor(x + 0.5)` reproduces exactly — including for
 * negatives, where Math.round(-0.5) === -0 and floor(0) === 0. ClickHouse's own `round()` is
 * round-half-to-EVEN, so it is deliberately not used here.
 */
const sqlPrecisionRound = (expr, precision = 0) => {
  if (!precision) return `floor((${expr}) + 0.5)`;
  const f = 10 ** precision;
  return `floor((${expr}) * ${f} + 0.5) / ${f}`;
};

/**
 * Per-bin excessive delay in HOURS for one threshold, as SQL. Mirrors calcPhed step 3+4 line for
 * line: round the bin mean to whole seconds, subtract the threshold travel time, clamp the excess at
 * 15 minutes, convert to hours rounded to 3 decimals, floor at zero.
 *
 * A NULL bin mean (no valid travel time in EITHER stream) contributes 0, which is what the JS path
 * also produced — `null - edttt` coerces to `-edttt`, goes negative, and is floored away by the
 * final max(). `ifNull` makes that explicit rather than incidental.
 */
const sqlExcessiveDelayHours = (valueExpr, edttt) => {
  const ttSec = sqlPrecisionRound(valueExpr);
  const xds = sqlPrecisionRound(`${ttSec} - ${edttt}`);
  const clamped = `least(${xds}, ${SEC_PER_MINUTE_SQL} * 15)`;
  return `ifNull(greatest(${sqlPrecisionRound(`(${clamped}) / 3600`, 3)}, 0), 0)`;
};

/**
 * PUSHDOWN (P-B) — excessive delay summed in ClickHouse, grouped by the only three fields the
 * volume weighting depends on.
 *
 * calcPhed weights each bin by `percentAadt[month-1][dow][timeBinNum]`, a per-TMC JS array. That
 * array is NOT reproduced here — the grouping keys are returned and JS applies it unchanged, so the
 * traffic-distribution code stays the single definition of itself. Because the weight is constant
 * within a group and the sum is linear in it, `Σ ed·w` equals `Σ_groups w_g · Σ_g ed`: the same
 * arithmetic, one level up. The 15-minute clamp is applied per bin BEFORE the sum, exactly as before,
 * which is why it has to live in the SQL rather than being applied to a group total.
 *
 * ALL FOUR thresholds are computed in one pass. edttt depends only on `tmcMeta.miles` and the
 * threshold speed — never on the stream — so a TMC has exactly four distinct values across all 16
 * delay variants (posted-limit, own-year free-flow, E5-anchored, E5-anchored unfloored). Fetching
 * them together is what keeps this at ~6 queries per TMC; one query per variant would have been 24.
 */
/** The only bins the delay family reads: PHED's two peaks and TED's whole-day bin. */
const DELAY_BINS = () => [BIN_NAMES.AMP, BIN_NAMES.ALT_PMP, BIN_NAMES.ALL]
  .map((n) => REPORTING_BINS.find((b) => b.name === n));

/** One (stream, bin, window) delay query — the un-batched path. */
async function fetchDelaySingle(spec, key) {
  const { chDb, binnedDataCache, thresholds } = spec;
  const sums = thresholds
    .map((e, i) => `sum(${sqlExcessiveDelayHours(valueExpr(spec), e)}) AS ed${i} /* threshold_tt=${e} */`)
    .join(',\n      ');
  const sql = `
    SELECT
      month, dow, "timeBinNum",
      ${sums}
    FROM (${buildBinnedSql(spec)})
    GROUP BY month, dow, "timeBinNum"
  `;
  const json = await (await chDb.query({ query: sql, format: 'JSON', clickhouse_settings: CH_QUERY_SETTINGS })).json();
  const out = json.data || [];
  if (key && binnedDataCache) binnedDataCache.set(key, out);
  return out;
}

async function getDelayGroupsForTmc(spec) {
  const { chDb, binnedDataCache, thresholds } = spec;
  const tag = `delay:${thresholds.join(',')}`;
  const key = binnedDataCache && binnedCacheKey(spec, tag);
  if (key && binnedDataCache.has(key)) return binnedDataCache.get(key);

  // The threshold is echoed in a comment so the emitted SQL says which variant each column belongs
  // to — readable in a query log, and recoverable by the test double that cross-checks this
  // aggregate against the original JS formula.
  const echo = (e) => `/* threshold_tt=${e} */`;
  const bins = DELAY_BINS();
  const target = bins.find((b) => sameBin(spec, b));
  const all = REPORTING_BINS.find((b) => b.name === BIN_NAMES.ALL);

  if (!target || !binnedDataCache) return fetchDelaySingle(spec, key);

  // PERF (P-C + item 2) — one scan per WINDOW for all three delay bins AND both streams. Same
  // reasoning as getBinnedStatsForTmc: cost is per query, not per row scanned, and the two streams
  // are columns in the same rows.
  const scanSpec = { ...spec, hours: all.hours, dow: all.dow };
  // Only the two variants the delay family actually uses: all-vehicle plain, and truck falling back
  // to all-vehicle. Coverage's no-fallback truck variant reads no delay column.
  const variants = streamVariants().filter((vr) => vr.secondary || vr.primary === ALL_VEHICLES);
  const sums = variants.flatMap((vr, vi) => bins.flatMap((b, bi) => thresholds.map((e, i) =>
    `sumIf(${sqlExcessiveDelayHours(vr.value, e)}, ${binCondition(b)}) AS ed_${vi}_${bi}_${i} ${echo(e)}`
  ))).join(',\n      ');
  const sql = `
    SELECT
      month, dow, "timeBinNum",
      ${sums}
    FROM (${buildBinnedSqlBothStreams(scanSpec)})
    GROUP BY month, dow, "timeBinNum"
  `;
  const json = await (await chDb.query({ query: sql, format: 'JSON', clickhouse_settings: CH_QUERY_SETTINGS })).json();
  const rows = json.data || [];

  let out = null;
  variants.forEach((vr, vi) => bins.forEach((b, bi) => {
    // Groups outside this bin's hours sum to zero under sumIf, and they must NOT be handed to
    // calcPhed: it indexes percentAadt[month-1][dow][timeBinNum] and an out-of-window slot could be
    // undefined, which would turn the whole sum into NaN. Dropping all-zero groups restores exactly
    // the row set the per-bin query returned — a group with zero delay under every threshold
    // contributes zero to both accumulators either way.
    const binRows = rows
      .map((r) => {
        const o = { month: r.month, dow: r.dow, timeBinNum: r.timeBinNum };
        let any = false;
        thresholds.forEach((_, i) => {
          const val = Number(r[`ed_${vi}_${bi}_${i}`]) || 0;
          o[`ed${i}`] = val;
          if (val !== 0) any = true;
        });
        return any ? o : null;
      })
      .filter(Boolean);
    const entrySpec = { ...spec, hours: b.hours, dow: b.dow,
                        npmrdsDataKeys: vr.primary, secondaryDataKey: vr.secondary };
    binnedDataCache.set(binnedCacheKey(entrySpec, tag), binRows);
    if (b === target
        && vr.primary === spec.npmrdsDataKeys
        && (vr.secondary || null) === (spec.secondaryDataKey || null)) out = binRows;
  }));
  return out === null ? fetchDelaySingle(spec, key) : out;
}

/**
 * Row fetch — the original contract, unchanged. Retained for the `schema_name = 'public'` Postgres
 * diagnostic path and for the delay grouping's fallback, not used by the percentile measures.
 */
async function getBinnedYearNpmrdsDataForTmc(spec) {
  const { db, chDb, schema_name, binnedDataCache } = spec;
  const cacheKey = binnedDataCache && binnedCacheKey(spec, 'rows');
  if (cacheKey && binnedDataCache.has(cacheKey)) return binnedDataCache.get(cacheKey);
  const sql = buildBinnedSql(spec);
  let out;
  if (schema_name === 'public') {
    const { rowCount, rows } = await db.query(sql);
    out = { rowCount, rows };
  } else {
    const result = await chDb.query({ query: sql, format: 'JSON', clickhouse_settings: CH_QUERY_SETTINGS });
    const json = await result.json();
    const { rows, data } = json;
    out = { rowCount: rows, rows: data };
  }
  if (cacheKey) binnedDataCache.set(cacheKey, out);
  return out;
}

function calculateTtr({ rowKey, upper: upperIn, lower: lowerIn, nBins, upperPercentile, lowerPercentile, metricName, shouldRound }) {
  const ttr_result = {};
  // Two different empty cases, kept distinct because the legacy code treated them differently:
  //   nBins === 0        no bins at all -> both percentiles default to 1, ratio 1. Legacy behaviour,
  //                      load-bearing (the `data.length ? ... : 1` ternary).
  //   nBins > 0, q NULL  bins existed but no valid travel time in either stream -> the ratio is
  //                      undefined. NaN propagates and getDataRowInsertSql's truthy filter drops the
  //                      column, which is what the JS path did via 0/0. Publishing 1 here would
  //                      assert perfect reliability for a segment with no usable data.
  const empty = (v) => v === null || v === undefined;
  const isNoData = !nBins;
  const upper = empty(upperIn) ? (isNoData ? 1 : NaN) : upperIn;
  const lower = empty(lowerIn) ? (isNoData ? 1 : NaN) : lowerIn;
  const upperLabel = `${(upperPercentile * 100).toString()}_PCT`;
  const lowerLabel = `${(lowerPercentile * 100).toString()}_PCT`;

  ttr_result[`${rowKey}_${metricName}`] = shouldRound ? precisionRound(upper / lower, 2) : (upper / lower);
  ttr_result[`${rowKey}_${metricName}_${upperLabel}`] = shouldRound ? toInteger(upper) : upper;
  ttr_result[`${rowKey}_${metricName}_${lowerLabel}`] = shouldRound ? toInteger(lower) : lower;
  return ttr_result;
}

module.exports = { CH_QUERY_SETTINGS, calcTtrMeasure, getBinnedYearNpmrdsDataForTmc, getBinnedStatsForTmc,
                   getDelayGroupsForTmc, buildBinnedSql, buildBinnedSqlBothStreams, binnedCacheKey, valueExpr,
                   QUANTILE_LEVELS, quantile, sqlPrecisionRound, sqlExcessiveDelayHours };
