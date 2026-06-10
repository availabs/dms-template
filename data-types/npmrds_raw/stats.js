/**
 * Coverage statistics for an npmrds_raw view. Pure function.
 *
 * Coverage % = present rows / expected rows, where expected = epochsPerDay * TMCs * days.
 * epochsPerDay is 24 for hourly data (averagingWindowSize 60) else 288 (5-min).
 */
function coverageStatistics({
  averagingWindowSize = 0,
  days,
  totalCount, totalTmcs,
  interstateCount, interstateTmcs,
  nonInterstateCount, nonInterstateTmcs,
  extendedCount, extendedTmcs,
}) {
  const rowsPerHour = averagingWindowSize === 60 ? 1 : 12;
  const epochsPerDay = rowsPerHour * 24;

  const pct = (count, tmcs) => {
    const expected = epochsPerDay * tmcs * days;
    if (!expected) return 0; // guard divide-by-zero (empty group)
    return (count / expected) * 100;
  };

  return {
    averagingWindowSize,
    total: pct(totalCount, totalTmcs),
    interstate_percentage: pct(interstateCount, interstateTmcs),
    non_interstate_percentage: pct(nonInterstateCount, nonInterstateTmcs),
    extended_tmc_percentage: pct(extendedCount, extendedTmcs),
  };
}

module.exports = { coverageStatistics };
