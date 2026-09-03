import React from "react";
import { ThemeContext, getComponentTheme } from "../../../../../dms/packages/dms/src/ui/useTheme";
import { routeComparisonBarChartTheme } from "./RouteComparisonBarChart.theme";

// Closure-density route comparison tabs (see
// planning/transportny/tasks/current/closure-density-route-comparison-tab.md) - for every
// start/end pair used in the density analysis, shows how much longer that pair's route becomes
// once the segment closes - by DISTANCE (miles) and, in a separate tab, by TIME (minutes).
//
// Binned into 5 equal-width ranges: a raw one-bar-per-pair list of up to 100 pairs reads as noise,
// not a distribution a user could actually take something from. 5 buckets matches the SAME
// bucket-count convention as the heatmap legend just above these tabs (ClosureDensityPanel.jsx's
// DENSITY_STEP_FRACTIONS) - bar height/width is the COUNT of pairs whose detour cost falls in that
// range, not one bar per pair.
//
// Plain divs, not a chart library - this panel already renders its heatmap legend the same way
// (see ClosureDensityPanel.jsx's DENSITY_COLOR_RAMP swatches), and no chart dependency is in
// package.json yet.
const NUM_BUCKETS = 5;

// `metric` picks which per-pair field drives the buckets - kept as a small config object (not two
// near-duplicate components) so the miles and minutes tabs can never drift out of sync in bucket
// logic, only in which field/label/unit they read.
const METRICS = {
  distance: { valueOf: (p) => p.deltaMiles, unit: "mi", decimals: 2, label: "added detour distance" },
  time: { valueOf: (p) => p.deltaDurationS, unit: "sec", decimals: 0, label: "added detour time" },
};

const buildBuckets = (pairComparisons, valueOf) => {
  const values = pairComparisons.map(valueOf);
  const minValue = Math.min(...values, 0); // normally >=0 (closing a segment can't make the shortest route shorter/faster) - min(...,0) just guards a pathological negative case rather than assuming it
  const maxValue = Math.max(...values, 0);
  const width = (maxValue - minValue) / NUM_BUCKETS || 1; // ||1 avoids a 0-width bucket when every pair has the identical value

  const buckets = Array.from({ length: NUM_BUCKETS }, (_, i) => ({
    lo: minValue + i * width,
    hi: i === NUM_BUCKETS - 1 ? maxValue : minValue + (i + 1) * width,
    count: 0,
  }));
  for (const v of values) {
    const idx = width > 0 ? Math.min(NUM_BUCKETS - 1, Math.floor((v - minValue) / width)) : 0;
    buckets[idx].count += 1;
  }
  return buckets;
};

const RouteComparisonBarChart = ({ pairComparisons, metric = "distance" }) => {
  const { theme: themeFromContext = {} } = React.useContext(ThemeContext) || {};
  const t = { ...routeComparisonBarChartTheme, ...getComponentTheme(themeFromContext, "routeComparisonBarChart") };

  if (!pairComparisons || pairComparisons.length === 0) {
    return <div className={t.emptyText}>No route comparisons available.</div>;
  }

  const { valueOf, unit, decimals, label } = METRICS[metric];
  // Shows only the metric this chart is actually for, as the visual hero number - avoid reverting
  // to showing BOTH the miles and minutes average under every section (identical text repeated
  // under Distance and under Time reads as a bug, not a summary).
  const avgValue = pairComparisons.reduce((sum, p) => sum + valueOf(p), 0) / pairComparisons.length;
  const buckets = buildBuckets(pairComparisons, valueOf);
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div>
      <div className={t.headerRow}>
        <span className={t.avgValue} style={{ color: t.colors.primary }}>
          +{avgValue.toFixed(decimals)}
        </span>
        <span className={t.avgUnit}>{unit} avg</span>
      </div>
      <div className={t.sectionLabel}>
        Pairs by {label} ({pairComparisons.length} total)
      </div>
      <div className={t.bucketList}>
        {buckets.map((b, i) => {
          const widthPct = b.count === 0 ? 0 : Math.max(3, (b.count / maxCount) * 100);
          return (
            <div
              key={i}
              className={t.bucketRow}
              title={`${b.count} pair${b.count === 1 ? "" : "s"} add +${b.lo.toFixed(decimals)}-${b.hi.toFixed(decimals)} ${unit}`}
            >
              <div className={t.bucketRangeLabel}>
                +{b.lo.toFixed(decimals)}-{b.hi.toFixed(decimals)} {unit}
              </div>
              <div className={t.bucketBarTrack}>
                <div className={t.bucketBarFill} style={{ width: `${widthPct}%`, background: t.colors.primary }} />
              </div>
              <div className={t.bucketCountLabel}>
                {b.count} pair{b.count === 1 ? "" : "s"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export { RouteComparisonBarChart };
