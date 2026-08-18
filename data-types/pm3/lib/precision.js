/**
 * R6 — precision bands for the reliability ratios. Flag, never suppress.
 *
 * pm3 publishes a per-segment LOTTR and TTTR to four decimal places with, until now, no indication
 * of how much sample was behind it. H1b measured that directly: it down-sampled each segment's real
 * bin series to a target n, 100 replicates per rung, and recorded the spread of the resulting ratio
 * against that segment's own full-sample value. The tables below are those measurements, verbatim
 * (references/npmrds pm3/npmrds_analysis/data/h01b-downsampling-curves.tsv, ALL length band,
 * 15-minute bins, FPC-corrected).
 *
 * Why a lookup rather than a formula: the curves are steeper than 1/sqrt(n) — LOTTR's SD falls
 * 0.0793 -> 0.0074 across a 40x increase in n, an exponent near 0.64 — because a finite-population
 * correction bites once n approaches the ~1,385 bins an AM peak year actually contains. A sqrt model
 * would overstate the band at high n by roughly a third.
 *
 * **Flag, never gate.** H1b also measured that only 0.16% of directional VMT sits below LOTTR's
 * 707-bin bar, so gating would buy almost nothing while removing the short-segment population for
 * the wrong reason (H2). The band and the flag are advisory columns.
 */

// Measured (n, SD-of-error) points. Keys are pm3 metric names.
const PRECISION_CURVES = {
  // 'LOTTR p80/p50 · all-veh AM · 15-min bins'
  lottr: [[25, 0.07925], [50, 0.05640], [100, 0.04006], [250, 0.02426], [500, 0.01550], [1000, 0.00742]],
  // 'TTTR p95/p50 · truck OVN · 15-min bins'
  tttr: [[25, 0.30389], [50, 0.21262], [100, 0.15369], [250, 0.09550], [500, 0.06669], [1000, 0.04475], [2000, 0.02720]],
  // 'p80/p50 · truck OVN · 15-min bins' — R1's cheaper truck ratio
  tttr_p80: [[25, 0.05705], [50, 0.03973], [100, 0.02789], [250, 0.01759], [500, 0.01229], [1000, 0.00844], [2000, 0.00528]],
};

/**
 * Sample sizes at which 90% of segments land within a stated tolerance of their own full-sample
 * value (FPC-corrected). `reach` is the share of CY2025 TMCs that actually clear the bar.
 *
 * The TTTR row is the finding, not a typo: **57,832 bins where an overnight year contains 14,600**.
 * The absolute criterion is arithmetically unreachable for every segment on the network, forever, so
 * TTTR's below_min_n flag is expected to be true everywhere. That is the honest signal — a
 * per-segment TTTR never meets the absolute precision bar — and it is the entire argument for R1's
 * `tttr_p80`, which reaches the same bar at 195 bins: **297x cheaper**, 68.8% of TMCs instead of 1.15%.
 */
const MIN_N = {
  lottr:    { absolute: 707,   relative: 357,  absoluteReachPct: 85.03, relativeReachPct: 91.06 },
  tttr:     { absolute: 57832, relative: 6297, absoluteReachPct: 1.15,  relativeReachPct: 7.60 },
  tttr_p80: { absolute: 195,   relative: 145,  absoluteReachPct: 68.80, relativeReachPct: 73.36 },
};

/**
 * Expected SD of the ratio at a given observation count, by log-log interpolation between measured
 * points. Below the first measured n the first value is returned and above the last the last, both
 * clamped rather than extrapolated — an extrapolated precision claim is worse than a blunt one.
 *
 * Returns null for a metric with no measured curve, and for n = 0 (no observations means the ratio
 * defaulted to 1 and has no meaningful precision at all).
 */
function expectedSdForN(metricName, n) {
  const curve = PRECISION_CURVES[metricName];
  if (!curve || !n || n <= 0) return null;
  if (n <= curve[0][0]) return curve[0][1];
  if (n >= curve[curve.length - 1][0]) return curve[curve.length - 1][1];
  for (let i = 1; i < curve.length; i += 1) {
    const [n0, s0] = curve[i - 1];
    const [n1, s1] = curve[i];
    if (n <= n1) {
      const t = (Math.log(n) - Math.log(n0)) / (Math.log(n1) - Math.log(n0));
      return Math.exp(Math.log(s0) + t * (Math.log(s1) - Math.log(s0)));
    }
  }
  return curve[curve.length - 1][1];
}

/**
 * The metric's absolute precision bar, published per row so `n_bins < min_n_bar` is a comparison the
 * consumer can make and the row explains itself. Published as the bar rather than as a boolean
 * because pm3's row writer drops falsy values (see the note in calcTtrMeasure).
 */
const minNBar = (metricName) => (MIN_N[metricName] ? MIN_N[metricName].absolute : null);

/** True when this row's observation count is below the metric's absolute precision bar. */
function belowMinN(metricName, n) {
  const bar = MIN_N[metricName];
  if (!bar) return null;
  return (n || 0) < bar.absolute;
}

const hasPrecisionCurve = (metricName) => Boolean(PRECISION_CURVES[metricName]);

module.exports = { PRECISION_CURVES, MIN_N, expectedSdForN, belowMinN, minNBar, hasPrecisionCurve };
