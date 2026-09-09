/**
 * work_zone exposure — E1, E2, E3: the denominators.
 *
 * Every later measure is a rate. M5's crash rate is per 100M vehicle-miles
 * through work zones; M2's delay per vehicle divides by vehicles through the
 * zone. This module computes those denominators from what phase 1 placed on
 * the network.
 *
 * ── Reusing the MAP-21 volume machinery ────────────────────────────────────
 * Turning a daily AADT into an hourly volume needs a traffic distribution
 * profile, and the repo already has the set AVAIL uses for the federal MAP-21
 * submission: `map21/static/CATTLabTrafficDistributionProfiles.js` — 20
 * profiles of 24 hourly shares each, summing to 1.0 — selected by
 * `dayType_congestionLevel_directionality_functionalClass`, with day-of-week
 * and month adjustment factors. The npmrds meta view drives that selector
 * directly: its `congestion_level` and `directionality` values are verbatim
 * the enum strings the profile names are built from, and `functionalClass` is
 * `f_system <= 2 → FREEWAY`. Nothing new is fetched or fitted here.
 *
 * ── Anchor TMCs only ──────────────────────────────────────────────────────
 * `wz_event_tmc` roles each TMC `anchor` (where the work is) or `impact`
 * (congestion-derived, downstream, with the queue). Exposure counts anchors
 * only. Summing over impact TMCs would inflate lane-mile-hours and VMT by the
 * length of the queue — median 2 extra TMCs, but 638 CY2024 events carry more
 * than 200.
 *
 * ── The duration problem ──────────────────────────────────────────────────
 * E2 is literally hours × lanes × length, and phase 1 established that
 * TRANSCOM's `estimated_duration_mins` is dominated by records that were never
 * closed: 40–53% of all recorded hours in 2018–2024 and 77–81% in 2025–2026
 * come from events longer than 30 days, one of them 1,051,059 minutes (about
 * two years), while the median duration holds at 420–480 minutes. So the
 * duration basis is a parameter with a capped default, and the nominal-shift
 * variant is computed alongside so the sensitivity is always visible.
 *
 * Pure module: no DB, no network.
 */
const PROFILES = require('../../map21/static/CATTLabTrafficDistributionProfiles.js');
const DOW_FACTORS = require('../../map21/static/TrafficDistributionDowAdjustmentFactors.js');
const MONTH_FACTORS = require('../../map21/static/TrafficDistributionMonthAdjustmentFactors.js');
const { getTrafficDistributionProfileName } = require('../../map21/helpers.js');

/** How `active_hours` is derived. */
const DURATION_BASES = ['reported_capped', 'reported', 'nominal_shift'];
const DEFAULT_DURATION_BASIS = 'reported_capped';
/** Events longer than this are never-closed records, not work. */
const DEFAULT_DURATION_CAP_DAYS = 30;
/** A work shift, for the basis that ignores reported duration entirely. */
const DEFAULT_NOMINAL_SHIFT_HOURS = 8;

const WEEKDAY = 'WEEKDAY';
const WEEKEND = 'WEEKEND';

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** `f_system <= 2 → FREEWAY`, as map21/helpers.js does it. */
function functionalClassOf(fSystem) {
  const f = num(fSystem);
  if (f === null) return null;
  return f <= 2 ? 'FREEWAY' : 'NONFREEWAY';
}

/**
 * The profile for one TMC on one day.
 *
 * Weekend profiles are keyed by facility class alone — congestion level and
 * peak orientation only apply on weekdays, which is why the selector drops
 * them (see map21/helpers.js).
 *
 * @returns {{ name: string, hourly: number[] }|null} null when the TMC lacks
 *   the attributes to choose one — the caller records that as incompleteness
 *   rather than substituting a default profile.
 */
function selectProfile({ dayType, congestionLevel, directionality, fSystem }) {
  const functionalClass = functionalClassOf(fSystem);
  if (!functionalClass) return null;
  if (dayType === WEEKDAY && !(congestionLevel && directionality)) return null;
  const name = getTrafficDistributionProfileName({
    dayType, congestionLevel, directionality, functionalClass,
  });
  const hourly = PROFILES[name];
  return hourly ? { name, hourly } : null;
}

const isWeekend = (date) => {
  const d = date.getUTCDay();
  return d === 0 || d === 6;
};

/**
 * Vehicles past one point on one day, hour by hour.
 *
 * AADT is an annual average, so it is adjusted for the month and the day of
 * week before the hourly profile is applied — the same order map21 uses.
 *
 * @param {object} args
 * @param {number} args.aadt
 * @param {Date} args.date
 * @param {number[]} args.hourly     24 shares summing to 1
 * @param {number[]} [args.hours]    which hours of the day are active (default all 24)
 * @returns {number} vehicles
 */
function vehiclesOnDay({ aadt, date, hourly, hours = null }) {
  const month = MONTH_FACTORS[date.getUTCMonth()];
  const dow = DOW_FACTORS[date.getUTCDay()];
  const dailyVolume = aadt * (month ?? 1) * (dow ?? 1);
  const active = hours || Array.from({ length: 24 }, (_, h) => h);
  let share = 0;
  for (const h of active) share += hourly[h] ?? 0;
  return dailyVolume * share;
}

/**
 * Active hours for a work zone under a given basis.
 *
 * `reported_capped` — the reported duration, with any single occurrence capped;
 *   the default, because the uncapped field is dominated by never-closed records.
 * `reported`        — the field as TRANSCOM gives it, for comparison only.
 * `nominal_shift`   — reported duration ignored: one shift per active day. The
 *   most robust basis when duration cannot be trusted at all.
 *
 * @returns {{ hours: number|null, basis: string, capped_occurrences: number }}
 */
function activeHours(wz, opts = {}) {
  const basis = opts.durationBasis || DEFAULT_DURATION_BASIS;
  if (!DURATION_BASES.includes(basis)) {
    throw new Error(`work_zone exposure: unknown duration basis '${basis}' (known: ${DURATION_BASES.join(', ')})`);
  }
  const capHours = (opts.durationCapDays ?? DEFAULT_DURATION_CAP_DAYS) * 24;
  const shift = opts.nominalShiftHours ?? DEFAULT_NOMINAL_SHIFT_HOURS;
  const activeDays = num(wz.active_days) ?? 0;

  if (basis === 'nominal_shift') {
    return { hours: activeDays * shift, basis, capped_occurrences: 0 };
  }

  // Per-occurrence durations when the caller has them; otherwise the chain's sum.
  const durations = Array.isArray(wz.occurrence_hours) ? wz.occurrence_hours.map(num).filter((v) => v !== null) : null;
  if (durations && durations.length) {
    let capped = 0;
    let total = 0;
    for (const h of durations) {
      if (basis === 'reported_capped' && h > capHours) { capped++; total += capHours; } else total += h;
    }
    return { hours: total, basis, capped_occurrences: capped };
  }

  const reported = num(wz.active_hours);
  if (reported === null) return { hours: null, basis, capped_occurrences: 0 };
  if (basis === 'reported_capped') {
    // Without per-occurrence detail the cap applies to the chain's mean
    // occurrence, so one runaway record cannot carry the whole chain.
    const occurrences = Math.max(1, num(wz.n_occurrences) ?? 1);
    const perOccurrence = reported / occurrences;
    if (perOccurrence > capHours) {
      return { hours: capHours * occurrences, basis, capped_occurrences: occurrences };
    }
  }
  return { hours: reported, basis, capped_occurrences: 0 };
}

/**
 * Exposure for one work zone.
 *
 * @param {object} wz            a wz_event row (active_days, active_hours, n_occurrences,
 *                               lanes_affected, lanes_affected_known, first_start, last_end)
 * @param {object[]} anchorTmcs  its anchor rows: { tmc, length, aadt, aadt_unidir, f_system,
 *                               congestion_level, directionality }
 * @param {object} [opts]        durationBasis, durationCapDays, nominalShiftHours, preferUnidirectionalAadt
 * @returns {object} the wz_exposure fields
 */
function computeExposure(wz, anchorTmcs, opts = {}) {
  const preferUnidir = opts.preferUnidirectionalAadt !== false;
  const tmcs = (anchorTmcs || []).filter(Boolean);

  const duration = activeHours(wz, opts);
  const nominal = activeHours(wz, { ...opts, durationBasis: 'nominal_shift' });

  // ── E1: lane closures ──
  const lanesAffected = num(wz.lanes_affected);
  const laneCountKnown = wz.lanes_affected_known === true && lanesAffected !== null && lanesAffected > 0;
  const lane_closure_count = laneCountKnown ? lanesAffected : null;

  // ── geometry of the work extent ──
  let length_mi = 0;
  let tmcsWithLength = 0;
  for (const t of tmcs) {
    const l = num(t.length);
    if (l !== null) { length_mi += l; tmcsWithLength++; }
  }
  const hasLength = tmcsWithLength > 0;

  // ── E2: lane-mile-hours ──
  // Needs all three of lanes, length and hours; anything missing makes it
  // unknown, not zero.
  const lane_mile_hours = laneCountKnown && hasLength && duration.hours !== null
    ? lanesAffected * length_mi * duration.hours
    : null;
  const lane_mile_hours_nominal = laneCountKnown && hasLength && nominal.hours !== null
    ? lanesAffected * length_mi * nominal.hours
    : null;

  // ── E3: vehicles and VMT through the zone ──
  // Walk the zone's active days, and on each day apply the hours-of-day share
  // the zone was active for. Without per-day detail the chain's mean daily
  // active hours decide which share of the day counts.
  const start = wz.first_start ? new Date(wz.first_start) : null;
  const activeDays = num(wz.active_days) ?? 0;
  const hoursPerDay = duration.hours !== null && activeDays > 0
    ? Math.min(24, duration.hours / activeDays)
    : null;

  let veh_through_wz = null;
  let vmt_through_wz = null;
  let profileName = null;
  let tmcsWithAadt = 0;
  let unidirUsed = 0;
  // Counts days that actually resolved a profile. Without this, a TMC that has
  // AADT but cannot choose a profile reports 0 vehicles rather than "unknown".
  let daysContributing = 0;

  if (start && activeDays > 0 && hoursPerDay !== null) {
    let veh = 0;
    let vmt = 0;
    for (const t of tmcs) {
      const aadtUnidir = num(t.aadt_unidir);
      const aadtBoth = num(t.aadt);
      const aadt = preferUnidir && aadtUnidir !== null ? aadtUnidir : aadtBoth;
      if (aadt === null) continue;
      if (preferUnidir && aadtUnidir !== null) unidirUsed++;
      tmcsWithAadt++;

      const length = num(t.length);
      // Walk each active day so the month and day-of-week factors, and the
      // weekday/weekend profile split, apply per day rather than once.
      for (let i = 0; i < activeDays; i++) {
        const day = new Date(start.getTime() + i * 86400000);
        const profile = selectProfile({
          dayType: isWeekend(day) ? WEEKEND : WEEKDAY,
          congestionLevel: t.congestion_level,
          directionality: t.directionality,
          fSystem: t.f_system,
        });
        if (!profile) continue;
        profileName = profileName || profile.name;
        daysContributing++;
        // The share of the day the zone was active. Hour-of-day detail is not
        // in the spine, so the busiest hours are not assumed: the mean daily
        // active hours are taken as a proportion of the day's total volume.
        const dayVeh = vehiclesOnDay({ aadt, date: day, hourly: profile.hourly }) * (hoursPerDay / 24);
        veh += dayVeh;
        if (length !== null) vmt += dayVeh * length;
      }
    }
    if (tmcsWithAadt > 0 && daysContributing > 0) {
      veh_through_wz = veh;
      vmt_through_wz = vmt;
    }
  }

  const round = (v, p = 2) => (v === null ? null : Math.round(v * 10 ** p) / 10 ** p);

  return {
    // E1
    lane_closure_count,
    lanes_affected: lanesAffected,
    lane_count_known: laneCountKnown,
    // E2
    lane_mile_hours: round(lane_mile_hours),
    lane_mile_hours_nominal: round(lane_mile_hours_nominal),
    // E3
    veh_through_wz: round(veh_through_wz, 0),
    vmt_through_wz: round(vmt_through_wz),
    // the work extent and the duration that produced them
    n_anchor_tmcs: tmcs.length,
    length_mi: round(length_mi, 4),
    active_hours_used: round(duration.hours),
    active_hours_nominal: round(nominal.hours),
    duration_basis: duration.basis,
    capped_occurrences: duration.capped_occurrences,
    hours_per_active_day: round(hoursPerDay, 3),
    profile_name: profileName,
    aadt_source: tmcsWithAadt === 0 ? null : (unidirUsed === tmcsWithAadt ? 'unidirectional' : (unidirUsed > 0 ? 'mixed' : 'bidirectional')),
    // completeness — an exposure row is only as good as its inputs, and a
    // consumer must be able to filter on that rather than trusting a null
    n_tmcs_with_aadt: tmcsWithAadt,
    n_tmcs_with_length: tmcsWithLength,
    exposure_complete: lane_mile_hours !== null && vmt_through_wz !== null,
  };
}

module.exports = {
  DURATION_BASES,
  DEFAULT_DURATION_BASIS,
  DEFAULT_DURATION_CAP_DAYS,
  DEFAULT_NOMINAL_SHIFT_HOURS,
  functionalClassOf,
  selectProfile,
  vehiclesOnDay,
  activeHours,
  computeExposure,
};
