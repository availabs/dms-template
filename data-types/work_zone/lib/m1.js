/**
 * M1 — the measure as the rule and the recommendation report define it.
 *
 * > **Percent of active work-zone hours in which the average speed within the
 * > work zone falls below the threshold.**
 *
 * That sentence contains three decisions that `wz_speed` does NOT make, which
 * is why this module exists separately from it:
 *
 *  1. **The unit of time is an HOUR, not a five-minute epoch.** M1 classifies
 *     each active zone-hour once — below threshold or not — and reports the
 *     share of hours. An epoch-weighted share of five-minute periods answers a
 *     different question and gives a different number: a zone slow for twenty
 *     minutes of every hour reads 33% as a share of epochs and 0% or 100% as a
 *     share of hours depending on where the hourly average lands.
 *  2. **The unit of space is the ZONE, not the segment.** "Average speed within
 *     the work zone" is one speed for the whole extent, so it is the
 *     space-mean speed — total distance travelled over total travel time across
 *     every segment of the zone — not a mean of per-segment speeds. Averaging
 *     per-segment speeds over-weights short segments; the space-mean does not.
 *  3. **The threshold applies to the zone**, so a zone spanning segments with
 *     different posted limits gets one length-weighted limit.
 *
 * `wz_speed` is the evidence table underneath this: (zone x segment x hour of
 * day) with epoch counts, which is the grain phase 6's differential needs and
 * the grain that shows WHERE and WHEN inside a zone the slow time was. M1 is
 * the published measure computed from the same observations at a coarser grain.
 * Both are true; only one is M1.
 *
 * ── Why hours are counted, not assumed ────────────────────────────────────
 * An hour counts as measured only when at least `minEpochsPerHour` of its
 * twelve five-minute slots carried an observation on some segment of the zone.
 * Without that floor, an hour seen for five minutes would be classified as
 * confidently as one seen for sixty, and NPMRDS coverage gaps would silently
 * become measurement. The count of hours that fail the floor is reported.
 *
 * Pure: builds strings, runs nothing.
 */

const EPOCHS_PER_HOUR = 12;
/** Half an hour's worth of five-minute slots. */
const DEFAULT_MIN_EPOCHS_PER_HOUR = 6;

/**
 * Space-mean speed for a group of (segment x epoch) observations.
 *
 * Total distance over total travel time. NPMRDS stores travel time in seconds,
 * so the 3600 converts to mph. Every epoch contributes its segment's full
 * length, which is what makes this a distance-weighted average rather than a
 * mean of speeds.
 */
function zoneSpeedExpr({ milesExpr = 'm.miles', travelTimeExpr = 'n.travel_time_all_vehicles' } = {}) {
  return `if(sum(${travelTimeExpr}) > 0, sum(${milesExpr}) * 3600 / sum(${travelTimeExpr}), NULL)`;
}

/**
 * One row per work zone: active hours measured, and how many fell below each
 * threshold construction.
 *
 * Three thresholds are classified side by side so they can be compared AS
 * MEASURES rather than as columns:
 *
 *   posted    max(20, zone posted limit - `postedDropMph`)   — NYSDOT's choice
 *   absolute  `absoluteMph`                                  — Ohio's 35 mph
 *   relative  `referencePct`% of the zone's 85th-pctl speed   — the
 *             pre-construction reference the literature prefers
 *
 * The zone's posted limit and reference speed are length-weighted across its
 * segments, then the threshold is derived — not the other way round, because
 * averaging thresholds that have already been floored would smear the floor.
 */
function zoneHourM1SQL({
  speedTable, tmcTable, activeTable,
  windowStart, windowEnd,
  postedDropMph = 10, postedFloorMph = 20,
  absoluteMph = 35, referencePct = 60,
  minEpochsPerHour = DEFAULT_MIN_EPOCHS_PER_HOUR,
}) {
  if (!windowStart || !windowEnd) throw new Error('zoneHourM1SQL: windowStart and windowEnd are required');
  const zoneSpeed = zoneSpeedExpr();
  return `
WITH zone_threshold AS (
  SELECT z.wz_event_id AS wz_event_id,
         sum(m.miles) AS zone_miles,
         sum(m.miles * m.posted_speed_limit) / nullIf(sum(m.miles), 0) AS zone_posted_limit,
         sum(m.miles * m.reference_speed) / nullIf(sum(m.miles), 0) AS zone_reference
    FROM (SELECT DISTINCT wz_event_id, tmc FROM ${activeTable}) z
   INNER JOIN ${tmcTable} m ON m.tmc = z.tmc
   GROUP BY wz_event_id
),
zone_hour AS (
 -- The speed table stays on the LEFT of every join: ClickHouse builds its hash
 -- table from the RIGHT side, and this one has 14.6 billion rows.
  SELECT a.wz_event_id AS wz_event_id,
         n.date AS date,
         intDiv(n.epoch, ${EPOCHS_PER_HOUR}) AS hour,
         uniqExact(n.epoch) AS epochs_in_hour,
         count() AS observations,
         ${zoneSpeed} AS zone_speed
    FROM ${speedTable} n
   INNER JOIN ${activeTable} a ON a.tmc = n.tmc AND a.date = n.date
   INNER JOIN ${tmcTable} m ON m.tmc = n.tmc
   WHERE n.date >= toDate('${windowStart}') AND n.date <= toDate('${windowEnd}')
     AND n.travel_time_all_vehicles > 0
     AND n.epoch >= a.epoch_from AND n.epoch < a.epoch_to
   GROUP BY wz_event_id, date, hour
)
SELECT h.wz_event_id AS wz_event_id,
       countIf(h.epochs_in_hour >= ${minEpochsPerHour}) AS active_hours_measured,
       countIf(h.epochs_in_hour < ${minEpochsPerHour}) AS hours_too_sparse,
       any(t.zone_miles) AS zone_miles,
       any(t.zone_posted_limit) AS zone_posted_limit,
       any(t.zone_reference) AS zone_reference,
       -- The zone threshold: floor applied AFTER the length-weighted limit, and
       -- never above the limit itself (a segment posted below the floor cannot
       -- be measured against a threshold above its own limit).
       least(any(t.zone_posted_limit),
             greatest(${postedFloorMph}, any(t.zone_posted_limit) - ${postedDropMph})) AS zone_posted_threshold,
       any(t.zone_reference) * ${referencePct} / 100 AS zone_relative_threshold,
       countIf(h.epochs_in_hour >= ${minEpochsPerHour}
               AND h.zone_speed < least(t.zone_posted_limit,
                     greatest(${postedFloorMph}, t.zone_posted_limit - ${postedDropMph}))) AS hours_below_posted,
       countIf(h.epochs_in_hour >= ${minEpochsPerHour}
               AND h.zone_speed < ${absoluteMph}) AS hours_below_absolute,
       countIf(h.epochs_in_hour >= ${minEpochsPerHour}
               AND t.zone_reference > 0
               AND h.zone_speed < t.zone_reference * ${referencePct} / 100) AS hours_below_relative,
       avgIf(h.zone_speed, h.epochs_in_hour >= ${minEpochsPerHour}) AS mean_zone_speed,
       minIf(h.zone_speed, h.epochs_in_hour >= ${minEpochsPerHour}) AS min_zone_speed
  FROM zone_hour h
  LEFT JOIN zone_threshold t ON t.wz_event_id = h.wz_event_id
 GROUP BY wz_event_id`;
}

/**
 * Statewide M1 from the per-zone rows.
 *
 * Two ways to aggregate, and they answer different questions, so both are
 * returned rather than one being picked:
 *
 *   hour_weighted  every active hour counts once, so long zones dominate. This
 *                  is "what share of the state's work-zone hours were slow" and
 *                  is the reportable programmatic figure.
 *   zone_mean      every zone counts once. This is "how did the typical work
 *                  zone do" and is what a per-project review reads.
 *
 * Also returned: the share of ZONES with at least one hour below threshold, and
 * with more than half their hours below — the "percent of projects" shape the
 * rule's own examples use, and the shape Ohio reports on key projects.
 */
function rollupZoneM1(rows, { flagShare = 0.5 } = {}) {
  const measured = (rows || []).filter((r) => Number(r.active_hours_measured) > 0);
  const sum = (k) => measured.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const hours = sum('active_hours_measured');
  const round = (v) => (v === null || !Number.isFinite(v) ? null : Math.round(v * 1e4) / 1e4);
  const share = (k) => (hours > 0 ? round(sum(k) / hours) : null);
  const zoneMean = (k) => {
    const vals = measured
      .map((r) => Number(r[k]) / Number(r.active_hours_measured))
      .filter((v) => Number.isFinite(v));
    return vals.length ? round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };
  const zonesWith = (k, min) => measured.filter((r) => Number(r[k]) > 0
    && (min === undefined || Number(r[k]) / Number(r.active_hours_measured) > min)).length;

  // Per-zone M1 distribution. Phase 3 found the epoch-level distribution to be
  // bimodal rather than bell-shaped, so a mean describes almost no zone; the
  // buckets are what a reader can actually act on.
  const bucket = (k) => {
    const shares = measured
      .map((r) => Number(r[k]) / Number(r.active_hours_measured))
      .filter((v) => Number.isFinite(v));
    const at = (p) => {
      if (!shares.length) return null;
      const sorted = [...shares].sort((a, b) => a - b);
      return round(sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]);
    };
    return {
      zero: shares.filter((v) => v === 0).length,
      to_10: shares.filter((v) => v > 0 && v <= 0.10).length,
      to_25: shares.filter((v) => v > 0.10 && v <= 0.25).length,
      to_50: shares.filter((v) => v > 0.25 && v <= 0.50).length,
      over_50: shares.filter((v) => v > 0.50).length,
      median: at(0.5),
      p90: at(0.9),
    };
  };

  return {
    zones: measured.length,
    zones_unmeasurable: (rows || []).length - measured.length,
    active_hours_measured: hours,
    hours_too_sparse: sum('hours_too_sparse'),
    m1_posted_hour_weighted: share('hours_below_posted'),
    m1_absolute_hour_weighted: share('hours_below_absolute'),
    m1_relative_hour_weighted: share('hours_below_relative'),
    m1_posted_zone_mean: zoneMean('hours_below_posted'),
    m1_absolute_zone_mean: zoneMean('hours_below_absolute'),
    m1_relative_zone_mean: zoneMean('hours_below_relative'),
    zones_any_hour_below_posted: zonesWith('hours_below_posted'),
    zones_any_hour_below_absolute: zonesWith('hours_below_absolute'),
    zones_any_hour_below_relative: zonesWith('hours_below_relative'),
    zones_majority_below_posted: zonesWith('hours_below_posted', flagShare),
    zones_majority_below_absolute: zonesWith('hours_below_absolute', flagShare),
    zones_majority_below_relative: zonesWith('hours_below_relative', flagShare),
    flag_share: flagShare,
    dist_posted: bucket('hours_below_posted'),
    dist_absolute: bucket('hours_below_absolute'),
    dist_relative: bucket('hours_below_relative'),
    // Hour-weighted mean zone speed, for context beside the shares.
    mean_zone_speed: hours > 0
      ? round(measured.reduce((a, r) => a + (Number(r.mean_zone_speed) || 0) * Number(r.active_hours_measured), 0) / hours)
      : null,
  };
}

/**
 * The SAME measure over the pre-construction period — M1 as a difference.
 *
 * Both Ohio and FHWA's own NPMRDS guidance report this measure against the
 * segment's own history, not as a level:
 *
 *  - Ohio charts "the number of hours that vehicles travelled less than 35 mph
 *    through one typical work zone during each month", with "historic lines
 *    representing the same number of hours to that point in the two years
 *    prior to construction" (HOP-19-034).
 *  - FHWA's case study reports a baseline row computed the same way on the
 *    pre-construction year, normalised to a per-month rate so periods of
 *    different length compare (HOP-20-029, tables 3-4).
 *
 * Without it, M1 is a statement about the road as much as about the work: a
 * corridor that is congested every weekday afternoon will report a high M1
 * whether or not anyone is working on it. The difference is the work zone's
 * contribution.
 *
 * Restricted to the same HOURS OF DAY the zone was actually active, because a
 * night-work zone compared against a full-day baseline would flatter itself —
 * FHWA's case study hit the reverse of this and noted that winter work-zone
 * travel times came in below an annual baseline. Same hours, same segments,
 * different year.
 *
 * `activeHoursTable` is a run-scoped (wz_event_id, hour) table of the hours of
 * day each zone was active; `zoneTmcTable` is (wz_event_id, tmc).
 */
function zoneBaselineM1SQL({
  speedTable, tmcTable, zoneTmcTable, activeHoursTable,
  baselineStart, baselineEnd, excludeTable,
  postedDropMph = 10, postedFloorMph = 20,
  absoluteMph = 35, referencePct = 60,
  minEpochsPerHour = DEFAULT_MIN_EPOCHS_PER_HOUR,
}) {
  if (!baselineStart || !baselineEnd) {
    throw new Error('zoneBaselineM1SQL: baselineStart and baselineEnd are required');
  }
  const zoneSpeed = zoneSpeedExpr();
  const antiJoin = excludeTable
    ? `  LEFT ANTI JOIN ${excludeTable} x ON x.tmc = n.tmc AND x.date = n.date
`
    : '';
  return `
WITH zone_threshold AS (
  SELECT z.wz_event_id AS wz_event_id,
         sum(m.miles) AS zone_miles,
         sum(m.miles * m.posted_speed_limit) / nullIf(sum(m.miles), 0) AS zone_posted_limit,
         sum(m.miles * m.reference_speed) / nullIf(sum(m.miles), 0) AS zone_reference
    FROM ${zoneTmcTable} z
   INNER JOIN ${tmcTable} m ON m.tmc = z.tmc
   GROUP BY wz_event_id
),
zone_hour AS (
 -- Speed table on the LEFT: ClickHouse hashes the right side.
  SELECT zt.wz_event_id AS wz_event_id,
         n.date AS date,
         intDiv(n.epoch, ${EPOCHS_PER_HOUR}) AS hour,
         uniqExact(n.epoch) AS epochs_in_hour,
         ${zoneSpeed} AS zone_speed
    FROM ${speedTable} n
   INNER JOIN ${zoneTmcTable} zt ON zt.tmc = n.tmc
   INNER JOIN ${tmcTable} m ON m.tmc = n.tmc
 -- Only the hours of day this zone actually worked.
   INNER JOIN ${activeHoursTable} ah
      ON ah.wz_event_id = zt.wz_event_id AND ah.hour = intDiv(n.epoch, ${EPOCHS_PER_HOUR})
${antiJoin}   WHERE n.date >= toDate('${baselineStart}') AND n.date <= toDate('${baselineEnd}')
     AND n.travel_time_all_vehicles > 0
   GROUP BY wz_event_id, date, hour
)
SELECT h.wz_event_id AS wz_event_id,
       countIf(h.epochs_in_hour >= ${minEpochsPerHour}) AS baseline_hours_measured,
       countIf(h.epochs_in_hour >= ${minEpochsPerHour}
               AND h.zone_speed < least(t.zone_posted_limit,
                     greatest(${postedFloorMph}, t.zone_posted_limit - ${postedDropMph}))) AS baseline_hours_below_posted,
       countIf(h.epochs_in_hour >= ${minEpochsPerHour}
               AND h.zone_speed < ${absoluteMph}) AS baseline_hours_below_absolute,
       countIf(h.epochs_in_hour >= ${minEpochsPerHour}
               AND t.zone_reference > 0
               AND h.zone_speed < t.zone_reference * ${referencePct} / 100) AS baseline_hours_below_relative,
       avgIf(h.zone_speed, h.epochs_in_hour >= ${minEpochsPerHour}) AS baseline_mean_zone_speed
  FROM zone_hour h
  LEFT JOIN zone_threshold t ON t.wz_event_id = h.wz_event_id
 GROUP BY wz_event_id`;
}

/**
 * Join the during and baseline rows into a per-zone "added" view.
 *
 * Both sides are expressed as a SHARE of their own measured hours, because the
 * baseline window is a year and the active window is usually days — an absolute
 * count comparison would be meaningless. FHWA normalises to a per-month rate
 * for the same reason; a share is the same idea with a cleaner denominator.
 * `m1_added_*` is the work zone's contribution in percentage points.
 */
function joinDuringAndBaseline(duringRows, baselineRows) {
  const base = new Map((baselineRows || []).map((r) => [String(r.wz_event_id), r]));
  const round = (v) => (Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : null);
  return (duringRows || []).map((d) => {
    const b = base.get(String(d.wz_event_id)) || {};
    const dh = Number(d.active_hours_measured) || 0;
    const bh = Number(b.baseline_hours_measured) || 0;
    const shareD = (k) => (dh > 0 ? Number(d[k]) / dh : null);
    const shareB = (k) => (bh > 0 ? Number(b[k]) / bh : null);
    const added = (kd, kb) => {
      const a = shareD(kd); const c = shareB(kb);
      return a === null || c === null ? null : round(a - c);
    };
    return {
      wz_event_id: d.wz_event_id,
      active_hours_measured: dh,
      baseline_hours_measured: bh,
      m1_posted: round(shareD('hours_below_posted')),
      m1_posted_baseline: round(shareB('baseline_hours_below_posted')),
      m1_posted_added: added('hours_below_posted', 'baseline_hours_below_posted'),
      m1_absolute: round(shareD('hours_below_absolute')),
      m1_absolute_baseline: round(shareB('baseline_hours_below_absolute')),
      m1_absolute_added: added('hours_below_absolute', 'baseline_hours_below_absolute'),
      m1_relative: round(shareD('hours_below_relative')),
      m1_relative_baseline: round(shareB('baseline_hours_below_relative')),
      m1_relative_added: added('hours_below_relative', 'baseline_hours_below_relative'),
      mean_zone_speed: d.mean_zone_speed === undefined ? null : Number(d.mean_zone_speed),
      baseline_mean_zone_speed: b.baseline_mean_zone_speed === undefined ? null : Number(b.baseline_mean_zone_speed),
    };
  });
}

/**
 * M1 on comparable universes.
 *
 * This is not a convenience: it is the difference between a number that means
 * something and one that does not. New York's work-zone inventory is derived
 * from TRANSCOM *event* records, so CY2024 holds 42,688 zones of which 77% are
 * under twelve hours long and the median is six hours. Peers count *projects*:
 * Illinois averaged 1,673 work zones a year across all activity types, and Ohio
 * monitors 25-30 key projects a construction season against its 35 mph
 * threshold. A single statewide share over our universe is therefore dominated
 * by short maintenance shifts and is comparable to nothing anyone else
 * publishes.
 *
 * So M1 is rolled up per tier, and every tier is reported with its own zone
 * count so a reader can see which universe a number describes:
 *
 *   all          every measurable zone — the widest, least comparable figure
 *   week_plus     zones active a week or more — the closest analogue to a peer
 *                 state's project count
 *   significant   the Subpart J significant-project candidates — the tier the
 *                 rule's programmatic review actually covers, and the analogue
 *                 of Ohio's monitored projects
 *   interstate    Interstate-system zones, for facility comparability
 *
 * @param rows      per-zone rows from zoneHourM1SQL
 * @param zoneById  Map of wz_event_id -> { is_significant_candidate, is_interstate, span_hours }
 */
function rollupZoneM1ByTier(rows, zoneById, opts = {}) {
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
  for (const [name, pred] of Object.entries(tiers)) {
    out[name] = rollupZoneM1((rows || []).filter(pred), opts);
  }
  return out;
}

module.exports = {
  EPOCHS_PER_HOUR,
  DEFAULT_MIN_EPOCHS_PER_HOUR,
  zoneSpeedExpr,
  zoneHourM1SQL,
  rollupZoneM1,
  rollupZoneM1ByTier,
  zoneBaselineM1SQL,
  joinDuringAndBaseline,
};
