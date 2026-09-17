/**
 * M5 — work-zone crashes and crash rate, from the NYSDOT CLEAR extract.
 *
 * ── Two ways a crash becomes a work-zone crash ────────────────────────────
 *  1. **Coded.** The MV-104A traffic-control field carries three work-area
 *     values — HIGHWAY / MAINTENANCE / UTILITY WORK AREA (codes 12/13/14) —
 *     and CLEAR publishes them as `TrafficControl`. This is the statewide
 *     series NYSDOT already reports from, and it is the ONLY work-zone
 *     attribution CLEAR has: the field catalogue (59 fields across crash,
 *     vehicle and person levels) carries one contributing-factor field,
 *     `ApparentFactors`, whose 61-value vocabulary has no work-zone entry
 *     (verified 2026-09-16: 0 of 377,778 CY2024 factor strings mention work
 *     or construction). `OFFICER/FLAGMAN/GUARD` (code 6) is carried beside it
 *     as a weaker indicator — a flagger is usually a work zone, not always.
 *  2. **Located.** The crash point falls within `bufferM` of a work zone's
 *     extent — the anchor segment, or the anchor plus the upstream queue
 *     segments phase 5 wrote onto every wz_queue row — during one of the
 *     zone's active windows (the same expansion phases 3 and 5 use). This is
 *     the join the rule's project-level review needs, and it is what lets
 *     the two attributions check each other: coded crashes with no zone in
 *     the inventory measure the inventory's coverage; located crashes with
 *     no code measure the under-coding NYSDOT's own research has raised.
 *
 * ── CLEAR's functional class is not FHWA's ────────────────────────────────
 * `FUNCTIONAL_CLASS` holds CLEAR's own 1–14 code, mapped to the FHWA class
 * by the app's lookup table (`luts.json` → FunctionalClass). Code 7 is Urban
 * Interstate, code 1 Rural Interstate; read raw, code 10 (Urban Minor
 * Arterial) is the commonest and looks like nonsense. Both codes are kept.
 *
 * ── Time ─────────────────────────────────────────────────────────────────
 * `CrashTimeFormatted` is 'h:mm AM/PM'. Midnight ('12:00 AM') occurs about
 * twice as often as any other clock minute (1.03 % of CY2024 against 0.55 %
 * for noon), so roughly half of those are an unknown-time default. They are
 * kept at epoch 0 and flagged `time_uncertain`, and the join reports how many
 * matches rest on them.
 *
 * Pure: shapes rows and builds strings, runs nothing.
 */

const EPOCHS_PER_HOUR = 12;

/** Default distance from a work zone's segment centreline for a crash to count as in it. */
const DEFAULT_CRASH_BUFFER_M = 50;

/** MV-104A traffic-control values that code a crash as in a work area (codes 12, 13, 14). */
const WZ_TRAFFIC_CONTROL = Object.freeze({
  'HIGHWAY WORK AREA': 'highway',
  'MAINTENANCE WORK AREA': 'maintenance',
  'UTILITY WORK AREA': 'utility',
});
/** Code 6 — a flagger, usually but not always a work zone. */
const FLAGGER_TRAFFIC_CONTROL = 'OFFICER/FLAGMAN/GUARD';

/**
 * CLEAR's FunctionalClass lookup (luts.json, 2026-09-16): CLEAR code → FHWA
 * functional class code and description.
 */
const CLEAR_FUNCTIONAL_CLASS = Object.freeze({
  1: { fhwa: 1, desc: 'Rural Principal Arterial Interstate', interstate: true, urban: false },
  2: { fhwa: 2, desc: 'Rural PA Other Freeway or Expressway', interstate: false, urban: false },
  3: { fhwa: 6, desc: 'Rural Minor Arterial', interstate: false, urban: false },
  4: { fhwa: 7, desc: 'Rural Major Collector', interstate: false, urban: false },
  5: { fhwa: 8, desc: 'Rural Minor Collector', interstate: false, urban: false },
  6: { fhwa: 9, desc: 'Rural Local', interstate: false, urban: false },
  7: { fhwa: 11, desc: 'Urban Principal Arterial Interstate', interstate: true, urban: true },
  8: { fhwa: 12, desc: 'Urban PA Other Freeway or Expressway', interstate: false, urban: true },
  9: { fhwa: 14, desc: 'Urban Principal Arterial Other', interstate: false, urban: true },
  10: { fhwa: 16, desc: 'Urban Minor Arterial', interstate: false, urban: true },
  11: { fhwa: 17, desc: 'Urban Major Collector', interstate: false, urban: true },
  12: { fhwa: 19, desc: 'Urban Local', interstate: false, urban: true },
  13: { fhwa: 4, desc: 'Rural Principal Arterial Other', interstate: false, urban: false },
  14: { fhwa: 18, desc: 'Urban Minor Collector', interstate: false, urban: true },
});

const text = (v) => (v === null || v === undefined ? '' : String(v).trim());
const num = (v) => {
  const t = text(v);
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
const round = (v, p = 4) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10 ** p) / 10 ** p);

/**
 * 'h:mm AM/PM' → minutes since midnight, the five-minute epoch and the hour.
 * Midnight is flagged uncertain (see module note). Anything unparseable is
 * null throughout, never 0.
 */
function parseCrashTime(s) {
  const m = /^\s*(\d{1,2}):(\d{2})\s*([AP])\.?M\.?\s*$/i.exec(text(s));
  if (!m) return { minutes: null, epoch: null, hour: null, time_known: false, time_uncertain: false };
  let h = Number(m[1]); const mi = Number(m[2]); const pm = m[3].toUpperCase() === 'P';
  if (h < 1 || h > 12 || mi < 0 || mi > 59) return { minutes: null, epoch: null, hour: null, time_known: false, time_uncertain: false };
  if (h === 12) h = 0;
  if (pm) h += 12;
  const minutes = h * 60 + mi;
  return {
    minutes, epoch: Math.floor(minutes / 5), hour: h, time_known: true,
    time_uncertain: minutes === 0,
  };
}

/** 'YYYY-MM-DDT00:00:00' (or any ISO-ish prefix) → 'YYYY-MM-DD', or null. */
function isoDate(s) {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(text(s));
  return m ? m[1] : null;
}

/**
 * KABCO from the crash-level fields. `MaxInjurySeverity` carries K/A/B/C/U
 * when anyone was hurt and is blank on a property-damage crash, so the blank
 * is resolved from `CrashSeverity`.
 */
function kabco(maxInjurySeverity, crashSeverity) {
  const mi = text(maxInjurySeverity).toUpperCase();
  if (mi.startsWith('K')) return 'K';
  if (mi.startsWith('A')) return 'A';
  if (mi.startsWith('B')) return 'B';
  if (mi.startsWith('C')) return 'C';
  if (mi.startsWith('U')) return 'U';
  const cs = text(crashSeverity).toUpperCase();
  if (cs === 'PROPERTY DAMAGE') return 'O';
  if (cs === 'FATAL') return 'K';
  return cs ? 'U' : null;
}

/** fatal | injury | pdo | unknown, from CrashSeverity. */
function severityClass(crashSeverity) {
  const cs = text(crashSeverity).toUpperCase();
  if (cs === 'FATAL') return 'fatal';
  if (cs === 'INJURY' || cs === 'PROPERTY DAMAGE AND INJURY') return 'injury';
  if (cs === 'PROPERTY DAMAGE') return 'pdo';
  return 'unknown';
}

/** The work-zone code for a TrafficControl value, or null. */
function workZoneCode(trafficControl) {
  return WZ_TRAFFIC_CONTROL[text(trafficControl).toUpperCase()] || null;
}

/**
 * One raw CLEAR row (the CSV's column names) → one `nys_crashes_clear` row.
 * Unknowns are null, never zero — a crash with no `NumberOfInjuries` did not
 * have zero injuries, it has an unknown count.
 */
function shapeCrashRow(raw) {
  const r = raw || {};
  const t = parseCrashTime(r.CrashTimeFormatted);
  const date = isoDate(r.CrashDate);
  const fcCode = num(r.FUNCTIONAL_CLASS);
  const fc = fcCode !== null ? CLEAR_FUNCTIONAL_CLASS[fcCode] : null;
  const wzCode = workZoneCode(r.TrafficControl);
  const lon = num(r.lon); const lat = num(r.lat);
  const boolInd = (v) => { const s = text(v); return s === '' ? null : (s === '1' || s.toUpperCase() === 'TRUE' || s.toUpperCase() === 'Y'); };
  return {
    crash_id: text(r.CaseNumber) || null,
    case_year: num(r.CaseYear),
    crash_date: date,
    crash_time: text(r.CrashTimeFormatted) || null,
    crash_ts: date && t.minutes !== null
      ? `${date} ${String(Math.floor(t.minutes / 60)).padStart(2, '0')}:${String(t.minutes % 60).padStart(2, '0')}:00`
      : null,
    epoch: t.epoch, hour: t.hour, time_known: t.time_known, time_uncertain: t.time_uncertain,
    severity_class: severityClass(r.CrashSeverity),
    severity_kabco: kabco(r.MaxInjurySeverity, r.CrashSeverity),
    crash_severity: text(r.CrashSeverity) || null,
    max_injury_severity: text(r.MaxInjurySeverity) || null,
    n_fatalities: num(r.NumberOfFatalities), n_injuries: num(r.NumberOfInjuries),
    n_serious_injuries: num(r.NumberOfSeriousInjuries), n_other_injuries: num(r.NumberOfOtherInjuries),
    n_vehicles: num(r.NumberOfVehicles),
    collision_type: text(r.CollisionType) || null, crash_type: text(r.CrashType) || null,
    light_condition: text(r.LightCondition) || null, roadway_characteristic: text(r.RoadwayCharacteristic) || null,
    road_surface: text(r.RoadSurfaceCondition) || null, weather: text(r.WeatherCondition) || null,
    traffic_control: text(r.TrafficControl) || null,
    wz_coded: wzCode !== null, wz_code: wzCode,
    flagger_coded: text(r.TrafficControl).toUpperCase() === FLAGGER_TRAFFIC_CONTROL,
    commercial_vehicle: boolInd(r.CommercialVehicleCrashInd),
    non_reportable: boolInd(r.NonReportable),
    police_dept: text(r.PoliceDept) || null, reporting_agency: text(r.ReportingAgency) || null,
    county_name: text(r.CountyName) || null, municipality: text(r.CityTownName) || null,
    on_street: text(r.OnStreet) || null, cross_street: text(r.ClosestCrossStreet) || null,
    intersection_ind: boolInd(r.IntersectionIndicator),
    distance_from_int_m: num(r.DistanceFromIntersection), direction_from_int: text(r.DirectionFromIntersection) || null,
    master_intersection_id: text(r.MasterIntersectionId) || null,
    reference_marker: text(r.ReferenceMarker) || null,
    functional_class_clear: fcCode, functional_class_fhwa: fc ? fc.fhwa : null,
    functional_class_desc: fc ? fc.desc : (fcCode === null ? null : 'Unknown'),
    fc_interstate: fc ? fc.interstate : null, fc_urban: fc ? fc.urban : null,
    access_control: text(r.ACCESS_CONTROL) || null, divided: text(r.DIVIDED) || null,
    posted_speed: num(r.POSTED_SPEED), road_name: text(r.NAME) || null,
    maint_jurisdiction: text(r.MAINT_JURISDICTION_TYPE_ID) || null, owning_jurisdiction: text(r.OWNING_JURISDICTION_TYPE_ID) || null,
    apparent_factors: text(r.ApparentFactors) || null,
    dmv_insert_date: isoDate(r.DMVInsertDate),
    utm_easting: num(r.UTMEasting), utm_northing: num(r.UTMNorthing),
    lon, lat,
    has_point: lon !== null && lat !== null,
  };
}

/** Crashes per 100 million vehicle-miles. null — never 0 — when the denominator is unknown. */
function ratePer100mVmt(crashes, vmt) {
  const c = num(crashes); const v = num(vmt);
  if (c === null || v === null || v <= 0) return null;
  return round((c / v) * 1e8);
}

// ── Postgres / PostGIS ───────────────────────────────────────────────────────

/**
 * The spatial-temporal match, as SQL.
 *
 * The spatial index does the work: every zone's probe geometry (the queue
 * extent where phase 5 measured one — it already contains the anchor — else
 * the anchor alone) is tested against the crash points with ST_DWithin on
 * geography, and the candidates are then restricted to the zone's own span
 * of dates and tested against its active windows. Written the other way
 * round — active windows joined to crashes on date first — it is ~95 k
 * windows × ~1,000 crashes a day of geography distance checks.
 *
 * One row per (crash, zone): the role (work extent if within the buffer of
 * the anchor, else queue), the distances, whether the crash fell inside an
 * active window, and if not how many five-minute periods outside the
 * nearest one.
 *
 * @param {object} a
 * @param {string} a.crashTable    nys_crashes_clear (qualified)
 * @param {string} a.zoneTable     run-scoped temp: wz_event_id, first_start, last_end, anchor_geog, queue_geog, probe_geog
 * @param {string} a.activeTable   run-scoped temp: wz_event_id, date, epoch_from, epoch_to, window_source
 * @param {number} a.bufferM
 */
function crashMatchSQL({ crashTable, zoneTable, activeTable, bufferM = DEFAULT_CRASH_BUFFER_M }) {
  if (!crashTable || !zoneTable || !activeTable) throw new Error('crashMatchSQL: crashTable, zoneTable and activeTable are required');
  const b = Number(bufferM);
  if (!Number.isFinite(b) || b <= 0) throw new Error('crashMatchSQL: bufferM must be a positive number of metres');
  return `
WITH near AS (
  SELECT z.wz_event_id, c.crash_id, c.crash_date, c.epoch, c.time_known, c.time_uncertain,
         c.severity_class, c.severity_kabco, c.wz_coded, c.wz_code, c.flagger_coded, c.on_street,
         c.n_fatalities, c.n_injuries,
         ST_Distance(c.geog, z.anchor_geog) AS dist_anchor_m,
         CASE WHEN z.queue_geog IS NULL THEN NULL ELSE ST_Distance(c.geog, z.queue_geog) END AS dist_queue_m
    FROM ${zoneTable} z
    JOIN ${crashTable} c
      ON ST_DWithin(c.geog, z.probe_geog, ${b})
     AND c.crash_date >= z.first_start::date AND c.crash_date <= z.last_end::date
),
windows AS (
  SELECT n.wz_event_id, n.crash_id,
         bool_or(n.epoch IS NOT NULL AND n.epoch >= a.epoch_from AND n.epoch < a.epoch_to) AS in_window,
         -- a day with no window leaves a.epoch_from NULL, and a comparison
         -- against NULL is unknown, not false: without this guard the ELSE
         -- branch fired and every inactive-day match reported a gap of 0
         min(CASE WHEN n.epoch IS NULL OR a.epoch_from IS NULL THEN NULL
                  WHEN n.epoch < a.epoch_from THEN a.epoch_from - n.epoch
                  WHEN n.epoch >= a.epoch_to THEN n.epoch - a.epoch_to + 1
                  ELSE 0 END) AS epoch_gap,
         min(a.window_source) AS window_source,
         count(a.wz_event_id) AS windows_that_day
    FROM near n
    LEFT JOIN ${activeTable} a ON a.wz_event_id = n.wz_event_id AND a.date = n.crash_date
   GROUP BY n.wz_event_id, n.crash_id
)
SELECT n.wz_event_id, n.crash_id, to_char(n.crash_date, 'YYYY-MM-DD') AS crash_date, n.epoch, n.time_known, n.time_uncertain,
       n.severity_class, n.severity_kabco, n.wz_coded, n.wz_code, n.flagger_coded, n.on_street, n.n_fatalities, n.n_injuries,
       CASE WHEN n.dist_anchor_m <= ${b} THEN 'work_extent' ELSE 'queue' END AS role,
       LEAST(n.dist_anchor_m, COALESCE(n.dist_queue_m, n.dist_anchor_m)) AS distance_m,
       n.dist_anchor_m, n.dist_queue_m,
       COALESCE(w.in_window, FALSE) AS in_window,
       w.epoch_gap, w.window_source,
       COALESCE(w.windows_that_day, 0) > 0 AS active_that_day
  FROM near n
  LEFT JOIN windows w ON w.wz_event_id = n.wz_event_id AND w.crash_id = n.crash_id`;
}

/**
 * Statewide M5 from the per-zone rows.
 *
 * Counts are of crashes inside active work zones (in window). The rate is
 * computed only over zones whose exposure is complete, and the crashes in the
 * numerator are those zones' crashes — a rate over all crashes and some VMT
 * would be wrong in the direction that flatters no one.
 */
function rollupM5(zoneRows) {
  const rows = (zoneRows || []).filter(Boolean);
  const sum = (k, pred = () => true) => rows.filter(pred).reduce((a, r) => a + (num(r[k]) || 0), 0);
  const withExposure = (r) => r.rate_measured === true;
  const vmt = sum('vmt_through_wz', withExposure);
  const zonesWithCrash = rows.filter((r) => (num(r.crashes_total) || 0) > 0).length;
  return {
    zones: rows.length,
    zones_with_crash: zonesWithCrash,
    pct_zones_with_crash: rows.length ? round(zonesWithCrash / rows.length) : null,
    crashes_total: sum('crashes_total'),
    crashes_work_extent: sum('crashes_work_extent'),
    crashes_queue: sum('crashes_queue'),
    fatal: sum('crashes_fatal'), injury: sum('crashes_injury'), pdo: sum('crashes_pdo'), unknown: sum('crashes_unknown'),
    kabco_k: sum('kabco_k'), kabco_a: sum('kabco_a'), kabco_b: sum('kabco_b'), kabco_c: sum('kabco_c'), kabco_o: sum('kabco_o'),
    n_fatalities: sum('n_fatalities'), n_injuries: sum('n_injuries'),
    crashes_wz_coded: sum('crashes_wz_coded'),
    crashes_flagger: sum('crashes_flagger'),
    crashes_time_uncertain: sum('crashes_time_uncertain'),
    crashes_off_window: sum('crashes_off_window'),
    // how many located crashes carried the code — the under-coding measure
    pct_located_coded: sum('crashes_total') ? round(sum('crashes_wz_coded') / sum('crashes_total')) : null,
    zones_rate_measured: rows.filter(withExposure).length,
    vmt_through_wz: round(vmt, 0),
    crashes_in_rate: sum('crashes_total', withExposure),
    rate_per_100m_vmt: ratePer100mVmt(sum('crashes_total', withExposure), vmt),
    rate_work_extent_per_100m_vmt: ratePer100mVmt(sum('crashes_work_extent', withExposure), vmt),
    injury_rate_per_100m_vmt: ratePer100mVmt(sum('crashes_fatal', withExposure) + sum('crashes_injury', withExposure), vmt),
    active_hours: round(sum('active_hours'), 1),
    crashes_per_1000_active_hours: sum('active_hours') > 0 ? round(sum('crashes_total') / sum('active_hours') * 1000) : null,
  };
}

/** M5 per comparable universe — the tiers every phase uses. */
function rollupM5ByTier(rows, zoneById, opts = {}) {
  const weekHours = opts.weekHours ?? 24 * 7;
  const meta = (r) => (zoneById && zoneById.get(String(r.wz_event_id))) || {};
  const tiers = {
    all: () => true,
    week_plus: (r) => Number(meta(r).span_hours) >= weekHours,
    significant: (r) => !!meta(r).is_significant_candidate,
    interstate: (r) => !!meta(r).is_interstate,
    not_interstate: (r) => meta(r).is_interstate === false,
  };
  const out = { week_hours: weekHours };
  for (const [name, pred] of Object.entries(tiers)) out[name] = rollupM5((rows || []).filter(pred));
  return out;
}

module.exports = {
  EPOCHS_PER_HOUR,
  DEFAULT_CRASH_BUFFER_M,
  WZ_TRAFFIC_CONTROL,
  FLAGGER_TRAFFIC_CONTROL,
  CLEAR_FUNCTIONAL_CLASS,
  parseCrashTime,
  isoDate,
  kabco,
  severityClass,
  workZoneCode,
  shapeCrashRow,
  ratePer100mVmt,
  crashMatchSQL,
  rollupM5,
  rollupM5ByTier,
};
