import { ROUTE_COLOR } from "../constants";

// Closure-density route comparison tabs (2026-08-24,
// planning/transportny/tasks/current/closure-density-route-comparison-tab.md) - for every
// start/end pair used in the density analysis, shows how much longer that pair's route becomes
// once the segment closes - by DISTANCE (miles) and, in a separate tab, by TIME (minutes) - "this
// detour cost is in distance cost, what about time cost, add new tab."
//
// Binned into 5 equal-width ranges (2026-08-24 - "make range of 5 so that user understand from
// those data": a raw one-bar-per-pair list of up to 100 pairs read as noise, not a distribution a
// user could actually take something from). 5 buckets matches the SAME bucket-count convention as
// the heatmap legend just above these tabs (ClosureDensityPanel.jsx's DENSITY_STEP_FRACTIONS) -
// bar height/width is the COUNT of pairs whose detour cost falls in that range, not one bar per
// pair.
//
// Plain divs, not a chart library (2026-08-24) - this panel already renders its heatmap legend the
// same way (see ClosureDensityPanel.jsx's DENSITY_COLOR_RAMP swatches), and no chart dependency is
// in package.json yet.
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
  if (!pairComparisons || pairComparisons.length === 0) {
    return <div className="text-gray-500 text-xs">No route comparisons available.</div>;
  }

  const { valueOf, unit, decimals, label } = METRICS[metric];
  // 2026-08-25 fix - this used to always show BOTH the miles and minutes average under EVERY
  // section (identical text repeated under Distance and under Time), which read as a bug, not a
  // summary. Now shows only the metric this chart is actually for, as the visual hero number
  // ("highlight those main avg numbers... those were the important ones").
  const avgValue = pairComparisons.reduce((sum, p) => sum + valueOf(p), 0) / pairComparisons.length;
  const buckets = buildBuckets(pairComparisons, valueOf);
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div>
      <div className="flex items-baseline gap-1.5 mb-2">
        <span className="text-2xl font-bold tabular-nums" style={{ color: ROUTE_COLOR }}>
          +{avgValue.toFixed(decimals)}
        </span>
        <span className="text-sm font-medium text-gray-500">{unit} avg</span>
      </div>
      <div className="text-gray-500 text-[11px] uppercase tracking-wide mb-1.5 pt-1.5 border-t">
        Pairs by {label} ({pairComparisons.length} total)
      </div>
      <div className="space-y-1.5">
        {buckets.map((b, i) => {
          const widthPct = b.count === 0 ? 0 : Math.max(3, (b.count / maxCount) * 100);
          return (
            <div
              key={i}
              className="flex items-center gap-1.5"
              title={`${b.count} pair${b.count === 1 ? "" : "s"} add +${b.lo.toFixed(decimals)}-${b.hi.toFixed(decimals)} ${unit}`}
            >
              <div className="w-20 text-right text-[10px] font-mono text-gray-500 shrink-0">
                +{b.lo.toFixed(decimals)}-{b.hi.toFixed(decimals)} {unit}
              </div>
              <div className="flex-1 h-3 bg-gray-100 rounded-sm overflow-hidden">
                <div className="h-full rounded-sm" style={{ width: `${widthPct}%`, background: ROUTE_COLOR }} />
              </div>
              <div className="w-16 text-[10px] font-mono text-gray-600 shrink-0">
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
