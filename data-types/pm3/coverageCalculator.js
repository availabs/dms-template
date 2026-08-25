/**
 * pm3-only: data coverage as a first-class measure.
 *
 * Completeness is a property of a (STREAM, TIME BIN) pair, not of a performance measure. Publishing it
 * per measure — as `lottr_amp_pct_bins_reporting`, `tttr_amp_...`, `tttr_p80_amp_...` — got that wrong
 * twice over: `tttr` and `tttr_p80` read the same truck data over the same bins, so their completeness
 * columns were byte-identical duplicates, while `lottr`'s measured a different stream entirely under a
 * confusingly parallel name. And the delay family got none at all, despite reading the same streams.
 *
 * So coverage is computed once per stream per bin and published under its own prefix. Any measure's
 * completeness is then a lookup: LOTTR's AM-peak sample is `coverage_all_vehicles_amp_*`, TTTR's and
 * tttr_p80's alike is `coverage_freight_trucks_ovn_*`, TED's is `coverage_*_all_*`.
 *
 * Two percentages, same 0-100 scale, answering different questions:
 *
 *   pct_bins_reporting    how much of a bin-based measure's OWN INPUT arrived. Percentiles are taken
 *                         over 15-minute bin means, so this is the sample size the estimate rests on.
 *   pct_epochs_reporting  how much of the RAW 5-minute feed arrived. Lower by construction, since a bin
 *                         counts as present when any one of its three epochs did.
 *
 * Both are needed. Their ratio recovers probe depth (`pct_epochs / pct_bins x 3` = mean epochs per bin),
 * which H1b showed is the term the sparsity bias actually tracks — and publishing only the bin figure
 * would let a consumer reason about sparsity with the SIGN INVERTED, because removing bins deflates
 * LOTTR while thinning the probes behind each surviving bin inflates it.
 */

const { REPORTING_BINS, ALL_VEHICLES, FREIGHT_TRUCKS, NPMRDS_CH_SCHEMA_NAME } = require('./lib/constants.js');
const { getExpectedBinsForYear, precisionRound } = require('./lib/helpers.js');
const { getBinnedStatsForTmc } = require('./lib/calcTtrMeasure.js');

const EPOCHS_PER_BIN = 3; // 15-minute bins over 5-minute epochs

// Short, stable stream labels for column names.
const STREAM_LABELS = { [ALL_VEHICLES]: 'all_vehicles', [FREIGHT_TRUCKS]: 'freight_trucks' };

/**
 * The bins each stream is asked about — the union of what the measures reading that stream use.
 * ALT_PMP is kept distinct from PMP rather than collapsed: they are different windows (15-18 vs 16-19)
 * and therefore different denominators, so collapsing them would misreport one of the two.
 */
const COVERAGE_BINS = {
  all_vehicles: ['AMP', 'MIDD', 'PMP', 'ALT_PMP', 'WE', 'ALL'],
  freight_trucks: ['AMP', 'MIDD', 'PMP', 'ALT_PMP', 'WE', 'OVN', 'ALL'],
};

/**
 * The keys this calculator RETURNS — deliberately unprefixed. pm3's row writer prefixes every key with
 * the metric name (`${metricName}_${key}`), the same way calcTtrMeasure's `AMP_lottr` becomes
 * `lottr_amp_lottr`. Returning `coverage_...` here produced `coverage_coverage_...` on write while the
 * ALTER created `coverage_...`, so nothing landed — task 7132, abandoned 2026-08-21.
 */
const coverageResultKeys = () => {
  const out = [];
  for (const [stream, bins] of Object.entries(COVERAGE_BINS)) {
    for (const bin of bins) {
      const b = bin.toLowerCase();
      out.push(`${stream}_${b}_pct_bins_reporting`);
      out.push(`${stream}_${b}_pct_epochs_reporting`);
    }
  }
  return out;
};

/** The published column names: the metric prefix plus each result key. */
const coverageColumnNames = () => coverageResultKeys().map((k) => `coverage_${k}`);

async function coverageCalculator(props) {
  const { db, chDb, year, dates, dataTableName, curTmcId: tmc, binnedDataCache } = props;
  const result = { tmc };

  for (const [streamKey, label] of Object.entries(STREAM_LABELS)) {
    for (const binName of COVERAGE_BINS[label]) {
      const bin = REPORTING_BINS.find((b) => b.name === binName);
      // With the per-TMC memo in place this metric issues almost NO queries of its own: every
      // (stream, bin) it reports is one a performance measure already fetched. Before the memo it
      // added 13 redundant fetches per TMC — a regression introduced when completeness was decoupled.
      const stats = await getBinnedStatsForTmc({
        db, chDb, binnedDataCache,
        year, dates,
        hours: bin.hours, dow: bin.dow,
        schema_name: NPMRDS_CH_SCHEMA_NAME,
        dataTableName,
        timeBinSize: 15,
        tmc,
        npmrdsDataKeys: streamKey,
      });
      const nBins = stats.n_bins;
      const nEpochs = stats.n_epochs;
      const expected = getExpectedBinsForYear({ hours: bin.hours, dow: bin.dow, year, timeBinSize: 15 });
      const b = binName.toLowerCase();
      result[`${label}_${b}_pct_bins_reporting`] =
        expected ? precisionRound((100 * nBins) / expected, 2) : null;
      result[`${label}_${b}_pct_epochs_reporting`] =
        expected ? precisionRound((100 * nEpochs) / (expected * EPOCHS_PER_BIN), 2) : null;
    }
  }
  return result;
}

module.exports = { coverageCalculator, coverageColumnNames, coverageResultKeys, COVERAGE_BINS, STREAM_LABELS };
