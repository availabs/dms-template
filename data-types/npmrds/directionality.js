/**
 * Directionality + congestion-level calculation for npmrds metadata.
 *
 * Pure math ported from legacy avail-falcor npmrds/addWorker/helpers.js
 * (calcDirectionality). The CH queries that feed it live in ch-sql.js; the
 * worker drives them and calls computeTmcDirectionality per TMC.
 *
 * Method (FHWA):
 *  - average AM peak (weekday 6-10am) and PM peak (weekday 4-8pm) speeds;
 *    the lower speed marks the peak direction; a difference of <= 6 mph
 *    (or a missing peak) means the even volume distribution (EVEN_DIST).
 *  - congestion level from speedReductionFactor = combinedPeakAvgSpeed /
 *    freeflowAvgSpeed (freeflow = 10pm-5am), thresholds per
 *    HPMS Field Manual Dec2016 Table 3.16 (freeway vs non-freeway).
 */

const FREEWAY = 'FREEWAY';
const NONFREEWAY = 'NONFREEWAY';

// The three reporting windows used here (subset of the map21 REPORTING_BINS).
const BINS = {
  AMP: { hours: [6, 7, 8, 9], dow: [1, 2, 3, 4, 5] },
  PMP: { hours: [16, 17, 18, 19], dow: [1, 2, 3, 4, 5] },
  FREEFLOW: { hours: [22, 23, 0, 1, 2, 3, 4], dow: [0, 1, 2, 3, 4, 5, 6] },
};

// Legacy reduce semantics: empty window → 0 (falsy → treated as "no data").
function avgTravelTime(rows) {
  if (!rows || !rows.length) return 0;
  return rows.reduce((acc, r) => acc + r.tt, 0) / rows.length;
}

/**
 * @param {number} miles            TMC length
 * @param {string} functionalClass  FREEWAY | NONFREEWAY (f_system <= 2 ⇒ FREEWAY)
 * @param {Array}  ampRows/pmpRows/freeflowRows  binned rows [{ tt }] (seconds)
 */
function computeTmcDirectionality({ miles, functionalClass, ampRows, pmpRows, freeflowRows }) {
  const ampAvgTT = avgTravelTime(ampRows);
  const pmpAvgTT = avgTravelTime(pmpRows);
  const freeflowAvgTT = avgTravelTime(freeflowRows);

  const ampAvgSpeed = (miles / ampAvgTT) * 3600;
  const pmpAvgSpeed = (miles / pmpAvgTT) * 3600;
  const peakSpeedDifferential = Math.abs(ampAvgSpeed - pmpAvgSpeed);

  // Combined peak pools every am + pm bin (legacy accumulated both reduces).
  const combined = [...(ampRows || []), ...(pmpRows || [])];
  const combinedPeakAvgTT = combined.length
    ? combined.reduce((a, r) => a + r.tt, 0) / combined.length
    : NaN;
  const combinedPeakAvgSpeed = (miles / combinedPeakAvgTT) * 3600;
  const freeflowAvgSpeed = (miles / freeflowAvgTT) * 3600;
  const speedReductionFactor = combinedPeakAvgSpeed / freeflowAvgSpeed;

  let congestionLevel;
  if (functionalClass === FREEWAY) {
    if (!speedReductionFactor || speedReductionFactor >= 0.9) congestionLevel = 'NO2LOW_CONGESTION';
    else if (speedReductionFactor >= 0.75) congestionLevel = 'MODERATE_CONGESTION';
    else congestionLevel = 'SEVERE_CONGESTION';
  } else if (!speedReductionFactor || speedReductionFactor >= 0.8) {
    congestionLevel = 'NO2LOW_CONGESTION';
  } else if (speedReductionFactor >= 0.65) {
    congestionLevel = 'MODERATE_CONGESTION';
  } else {
    congestionLevel = 'SEVERE_CONGESTION';
  }

  let directionality;
  if (!ampAvgTT || !pmpAvgTT || peakSpeedDifferential <= 6) {
    directionality = 'EVEN_DIST';
  } else {
    directionality = ampAvgSpeed < pmpAvgSpeed ? 'AM_PEAK' : 'PM_PEAK';
  }

  return {
    directionality,
    congestionLevel,
    ampAvgTT,
    pmpAvgTT,
    combinedPeakAvgTT,
    combinedPeakAvgSpeed,
    freeflowAvgSpeed,
    speedReductionFactor,
    tmcMiles: miles,
  };
}

module.exports = {
  FREEWAY,
  NONFREEWAY,
  BINS,
  avgTravelTime,
  computeTmcDirectionality,
};
