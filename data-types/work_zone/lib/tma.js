/**
 * work_zone significance — which work zones are "significant projects".
 *
 * 23 CFR 630.1010 asks each agency to identify significant projects; the
 * rule's own floor is an Interstate project inside a TMA that occupies a
 * location more than three days with intermittent or continuous lane closures.
 * Phase 1a established that this TRANSCOM-derived rule is the DEFINITION, not a
 * fallback: the capital-project join enriches work zones but cannot define
 * significance (only 27.8% of events tie to a project, and a 2024 window
 * matches the 2026-29 STIP better than 2026 does, so a spatial match carries no
 * schedule information).
 *
 * ── Resolving the TMA question ─────────────────────────────────────────────
 * The task plan left open whether to take TMA boundaries from Census
 * urbanized areas or the HDM Appendix 16B maps. Neither is needed: the NPMRDS
 * metadata (view 984) carries `ua_code`/`ua_name` per TMC, so the test is
 * urbanized-area accurate rather than whole-county approximate — and its NY
 * areas over the 200,000 TMA threshold are exactly the six HDM §16.5.2.1 names.
 * A county fallback is kept for the ~5% of events whose anchor TMC has no meta
 * row, and is flagged as approximate because a county is only partly urban.
 *
 * ── Interstate test ───────────────────────────────────────────────────────
 * From the `facility` name, NOT from `f_system`. For NY 2024's construction
 * events, `f_system = 1` covers 30,013 events but its facilities include
 * "43RD ST", "6TH AVE" and "111TH AVE" — the value is inherited from whichever
 * TMC the event matched, so an event on a city street beside an interstate
 * inherits f_system 1. The facility pattern gives 26,818, of which 24,942 also
 * have f_system 1; the 5,071 f_system-only events are the false positives.
 * Both signals are recorded so the difference stays visible.
 *
 * Pure module: no DB, no network.
 */

/**
 * NY urbanized areas above the 200,000 TMA threshold, keyed by NPMRDS
 * `ua_code`. Matches HDM §16.5.2.1's six NY TMAs.
 */
const NY_TMA_UA_CODES = {
  63217: 'New York--Jersey City--Newark, NY--NJ',
  11350: 'Buffalo, NY',
  970: 'Albany--Schenectady, NY',
  75664: 'Rochester, NY',
  86302: 'Syracuse, NY',
  71803: 'Poughkeepsie--Newburgh, NY',
};

/**
 * County fallback, used only when the anchor TMC has no meta row. APPROXIMATE
 * by construction: a TMA is an urbanized area, and these counties are only
 * partly inside one, so this over-includes rural parts of a TMA county.
 */
const TMA_COUNTIES_APPROX = {
  // New York--Jersey City--Newark
  BRONX: 'New York--Jersey City--Newark, NY--NJ',
  KINGS: 'New York--Jersey City--Newark, NY--NJ',
  'NEW YORK': 'New York--Jersey City--Newark, NY--NJ',
  QUEENS: 'New York--Jersey City--Newark, NY--NJ',
  RICHMOND: 'New York--Jersey City--Newark, NY--NJ',
  NASSAU: 'New York--Jersey City--Newark, NY--NJ',
  SUFFOLK: 'New York--Jersey City--Newark, NY--NJ',
  WESTCHESTER: 'New York--Jersey City--Newark, NY--NJ',
  ROCKLAND: 'New York--Jersey City--Newark, NY--NJ',
  PUTNAM: 'New York--Jersey City--Newark, NY--NJ',
  // Buffalo
  ERIE: 'Buffalo, NY',
  NIAGARA: 'Buffalo, NY',
  // Albany--Schenectady
  ALBANY: 'Albany--Schenectady, NY',
  SCHENECTADY: 'Albany--Schenectady, NY',
  RENSSELAER: 'Albany--Schenectady, NY',
  SARATOGA: 'Albany--Schenectady, NY',
  // Rochester
  MONROE: 'Rochester, NY',
  // Syracuse
  ONONDAGA: 'Syracuse, NY',
  // Poughkeepsie--Newburgh
  DUTCHESS: 'Poughkeepsie--Newburgh, NY',
  ORANGE: 'Poughkeepsie--Newburgh, NY',
};

/** The rule's floor: more than three days of lane closures. */
const DEFAULT_MIN_CONSECUTIVE_DAYS = 3;

const text = (v) => (v === null || v === undefined ? '' : String(v));

/** 'I-81', 'I 495', 'I-90 - NYS Thruway' — but not '43RD ST'. */
const INTERSTATE_FACILITY = /^\s*I[- ]?\d{1,3}\b/i;

function isInterstateFacility(facility) {
  return INTERSTATE_FACILITY.test(text(facility));
}

/** TMA by NPMRDS ua_code — the authoritative test. */
function tmaForUaCode(uaCode) {
  if (uaCode === null || uaCode === undefined || uaCode === '') return null;
  return NY_TMA_UA_CODES[Number(uaCode)] || null;
}

/** TMA by county — approximate, fallback only. */
function tmaForCounty(county) {
  const key = text(county).trim().toUpperCase();
  return TMA_COUNTIES_APPROX[key] || null;
}

/**
 * Resolve TMA membership, preferring the urbanized area.
 *
 * @param {object} args
 * @param {number|string|null} [args.uaCode]  the anchor TMC's ua_code
 * @param {string|null} [args.county]
 * @returns {{ in_tma: boolean, tma_name: string|null, tma_basis: string }}
 */
function resolveTma({ uaCode = null, county = null } = {}) {
  const byUa = tmaForUaCode(uaCode);
  if (byUa) return { in_tma: true, tma_name: byUa, tma_basis: 'ua_code' };
  // A TMC with a ua_code that is not a TMA is a decided negative, not a gap.
  if (uaCode !== null && uaCode !== undefined && uaCode !== '' && Number(uaCode) !== 0) {
    return { in_tma: false, tma_name: null, tma_basis: 'ua_code' };
  }
  const byCounty = tmaForCounty(county);
  if (byCounty) return { in_tma: true, tma_name: byCounty, tma_basis: 'county_approx' };
  return { in_tma: false, tma_name: null, tma_basis: county ? 'county_approx' : 'none' };
}

/**
 * Decide significance for one collapsed work zone.
 *
 * @param {object} wz              a lib/dedupe.js record, plus uaCode/f_system
 * @param {object} [opts]
 * @param {number} [opts.minConsecutiveDays=3]
 * @returns {object} the significance fields for wz_event
 */
function assessSignificance(wz, opts = {}) {
  const minDays = opts.minConsecutiveDays ?? DEFAULT_MIN_CONSECUTIVE_DAYS;

  const is_interstate = isInterstateFacility(wz.facility);
  const f_system_says_interstate = Number(wz.f_system) === 1;
  const { in_tma, tma_name, tma_basis } = resolveTma({ uaCode: wz.ua_code, county: wz.county_name });

  const closureDays = Number(wz.consecutive_closure_days) || 0;
  const activeDays = Number(wz.consecutive_active_days) || 0;

  // The rule's test, run as written: closures on ≥ minDays consecutive days.
  const meets_closure_duration = closureDays >= minDays;
  // Only 40% of events report lanes_affected_count at all, so a zone can meet
  // the rule and fail this test purely for want of a lane count. The
  // any-activity variant is reported alongside so the gap is measurable
  // rather than invisible.
  const meets_activity_duration = activeDays >= minDays;

  return {
    is_interstate,
    f_system_says_interstate,
    interstate_signals_disagree: is_interstate !== f_system_says_interstate,
    in_tma,
    tma_name,
    tma_basis,
    consecutive_closure_days: closureDays,
    consecutive_active_days: activeDays,
    meets_closure_duration,
    meets_activity_duration,
    is_significant_candidate: is_interstate && in_tma && meets_closure_duration,
    // The same rule with duration measured on any activity — an upper bound on
    // what the lane-count gap could be hiding.
    is_significant_candidate_any_activity: is_interstate && in_tma && meets_activity_duration,
    significance_rule: `interstate AND tma AND consecutive_closure_days >= ${minDays}`,
  };
}

module.exports = {
  NY_TMA_UA_CODES,
  TMA_COUNTIES_APPROX,
  DEFAULT_MIN_CONSECUTIVE_DAYS,
  isInterstateFacility,
  tmaForUaCode,
  tmaForCounty,
  resolveTma,
  assessSignificance,
};
