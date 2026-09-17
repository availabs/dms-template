/**
 * M4 — speed differential: the safety surrogate.
 *
 * The recommendation report defines M4 as **approach-segment speed minus
 * in-zone speed**, and the **during-versus-baseline speed drop**, per active
 * hour, with differentials above `differential_mph` (15 mph) flagged as
 * rear-end risk. FHWA's 2024 rule names speed differentials as a data source
 * States shall use for the safety side, and the literature review found they
 * satisfy the surrogate clause without buying connected-vehicle hard-braking
 * data.
 *
 * ── Two differentials, one sign convention ────────────────────────────────
 *   approach   speed on the 1–2 segments immediately upstream of the work
 *              minus the speed within the work extent, over the SAME epochs.
 *              Positive = traffic arriving faster than it moves through the
 *              zone — the taper where rear-end crashes concentrate.
 *   baseline   the segment's normal speed at that hour and day-type (phase
 *              3's contamination-cleaned 12-month median) minus the speed
 *              during the work. Positive = slower than normal.
 * Both are in mph, both positive means "the work zone slowed traffic", and
 * `exceeds_differential` is the APPROACH differential over the line — the
 * surrogate the report asks for. The baseline drop is reported beside it.
 *
 * ── Two grains, as in phase 3 ─────────────────────────────────────────────
 * The measure is defined per active HOUR of the ZONE: each (zone, date, hour)
 * gets one in-zone space-mean speed and one approach space-mean speed, and M4
 * is the share of measured hours whose differential exceeds the line — rolled
 * up per tier onto the view as metadata.m4. The evidence lands on the wz_speed
 * cells (zone x anchor segment x hour of day, pooling every active day): the
 * five columns phase 3 created for this purpose, filled in place. No new
 * source, no new columns — all views of a source share one column list.
 *
 * ── What the approach differential cannot see ─────────────────────────────
 * When a queue reaches past the approach segments — the I-495 validation zone
 * had the whole 5.7-mile corridor below 25 mph — the approach is as slow as
 * the zone and the differential reads near zero. The rear-end risk then sits
 * at the back of the queue, which M3 measures the length of; the differential
 * at the queue tail is a refinement for a later phase, recorded not built.
 *
 * Pure: shapes rows and builds strings, runs nothing.
 */

const EPOCHS_PER_HOUR = 12;
/** How many segments immediately upstream form the approach. */
const DEFAULT_APPROACH_TMCS = 2;
/** Minimum five-minute observations in an hour before it is classified (phase 3's rule). */
const DEFAULT_MIN_EPOCHS_PER_HOUR = 6;

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const round = (v, p = 4) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10 ** p) / 10 ** p);

/**
 * The differentials for one (zone, hour) — the pure arithmetic the SQL and
 * the cell update both follow. Null, never 0, when a side is unknown.
 */
function differential({ zoneSpeed, approachSpeed, baselineSpeed, thresholdMph }) {
  const z = num(zoneSpeed); const a = num(approachSpeed); const b = num(baselineSpeed); const t = num(thresholdMph);
  const approach = z !== null && a !== null ? round(a - z, 2) : null;
  const baseline = z !== null && b !== null ? round(b - z, 2) : null;
  return {
    differential_approach: approach,
    differential_baseline: baseline,
    exceeds_differential: approach === null || t === null ? null : approach > t,
    exceeds_baseline_drop: baseline === null || t === null ? null : baseline > t,
  };
}

// ── ClickHouse ───────────────────────────────────────────────────────────────

/** The staged corridor x active-day rows: rank 0 = the anchor, 1..N = the approach. */
function approachCorridorDDL({ database, table }) {
  return `CREATE TABLE IF NOT EXISTS ${database}.${table} (
       wz_event_id String,
       tmc String,
       rank UInt16,
       miles Float64,
       date Date,
       epoch_from Int32,
       epoch_to Int32
     ) ENGINE = Memory`;
}

/** Per-TMC lengths for the baseline CTE (lib/baseline.js baselineSQL joins on this). */
function approachTmcDDL({ database, table }) {
  return `CREATE TABLE IF NOT EXISTS ${database}.${table} (
       tmc String,
       miles Float64
     ) ENGINE = Memory`;
}

/** (tmc, date) pairs excluded from the baseline — days the segment carried any work zone. */
function approachExcludeDDL({ database, table }) {
  return `CREATE TABLE IF NOT EXISTS ${database}.${table} (
       tmc String,
       date Date
     ) ENGINE = Memory`;
}

/**
 * One row per (zone, date, hour): the in-zone space-mean speed (rank 0), the
 * approach space-mean speed (ranks 1..N) and the baseline for the anchor at
 * that hour and day-type — the grain M4 is defined at.
 *
 * Speed table on the LEFT (ClickHouse hashes the right side), the date bound
 * mandatory (partition pruning), the epoch range in WHERE (an inequality
 * between the two sides is refused inside ON). The baseline CTE is phase 3's
 * `baselineSQL`, passed in built.
 */
function approachHourSQL({ speedTable, corridorTable, baselineCte, windowStart, windowEnd, minEpochsPerHour = DEFAULT_MIN_EPOCHS_PER_HOUR }) {
  if (!windowStart || !windowEnd) throw new Error('approachHourSQL: windowStart and windowEnd are required');
  if (!speedTable || !corridorTable) throw new Error('approachHourSQL: speedTable and corridorTable are required');
  const baseline = baselineCte ? `WITH baseline AS (${baselineCte})\n` : '';
  const baselineJoin = baselineCte
    ? `  LEFT JOIN baseline b ON b.tmc = c.tmc AND b.hour = intDiv(n.epoch, ${EPOCHS_PER_HOUR}) AND b.is_weekend = (toDayOfWeek(n.date) IN (6, 7))\n`
    : '';
  const baselineCols = baselineCte
    ? `,\n       anyIf(b.speed_median, c.rank = 0) AS baseline_speed`
    : `,\n       NULL AS baseline_speed`;
  return `${baseline}SELECT c.wz_event_id AS wz_event_id,
       n.date AS date,
       intDiv(n.epoch, ${EPOCHS_PER_HOUR}) AS hour,
       -- in-zone: the anchor, space-mean (total distance over total travel time)
       uniqExactIf(n.epoch, c.rank = 0) AS epochs_in_hour,
       if(sumIf(n.travel_time_all_vehicles, c.rank = 0) > 0,
          sumIf(c.miles, c.rank = 0) * 3600 / sumIf(n.travel_time_all_vehicles, c.rank = 0), NULL) AS zone_speed,
       -- the approach: ranks 1..N, space-mean over the same epochs
       uniqExactIf(n.epoch, c.rank > 0) AS approach_epochs_in_hour,
       if(sumIf(n.travel_time_all_vehicles, c.rank > 0) > 0,
          sumIf(c.miles, c.rank > 0) * 3600 / sumIf(n.travel_time_all_vehicles, c.rank > 0), NULL) AS approach_speed${baselineCols}
  FROM ${speedTable} n
 INNER JOIN ${corridorTable} c ON c.tmc = n.tmc AND c.date = n.date
${baselineJoin} WHERE n.date >= toDate('${windowStart}') AND n.date <= toDate('${windowEnd}')
   AND n.tmc IN (SELECT DISTINCT tmc FROM ${corridorTable})
   AND n.travel_time_all_vehicles > 0
   AND n.epoch >= c.epoch_from AND n.epoch < c.epoch_to
 GROUP BY wz_event_id, date, hour
HAVING epochs_in_hour >= ${Number(minEpochsPerHour)}`;
}

/**
 * The cell grain: per (zone, hour of day), the approach speed averaged the
 * way wz_speed's speed_mean is — over every approach observation in the
 * zone's active epochs at that hour, pooling every active day — so the two
 * sides of the cell differential are like for like.
 */
function approachCellSQL({ speedTable, corridorTable, windowStart, windowEnd }) {
  if (!windowStart || !windowEnd) throw new Error('approachCellSQL: windowStart and windowEnd are required');
  return `SELECT c.wz_event_id AS wz_event_id,
       intDiv(n.epoch, ${EPOCHS_PER_HOUR}) AS hour,
       arrayStringConcat(arraySort(groupUniqArray(c.tmc)), ' ') AS approach_tmcs,
       count() AS approach_observations,
       avg(c.miles * 3600 / n.travel_time_all_vehicles) AS approach_speed
  FROM ${speedTable} n
 INNER JOIN ${corridorTable} c ON c.tmc = n.tmc AND c.date = n.date
 WHERE n.date >= toDate('${windowStart}') AND n.date <= toDate('${windowEnd}')
   AND n.tmc IN (SELECT DISTINCT tmc FROM ${corridorTable})
   AND n.travel_time_all_vehicles > 0
   AND n.epoch >= c.epoch_from AND n.epoch < c.epoch_to
   AND c.rank > 0
 GROUP BY wz_event_id, hour`;
}

// ── rollups ──────────────────────────────────────────────────────────────────

/**
 * M4 from the per-(zone, date, hour) rows.
 *
 * `hours_measured` counts hours with an in-zone speed; the approach share
 * is over hours where BOTH sides were observed, and the baseline share over
 * hours with a baseline. Hour-weighted (the programmatic figure) and
 * zone-mean (the typical project) are both returned, as for M1, plus the
 * per-zone shape: zones with any hour over the line and zones over it for a
 * majority of their hours.
 */
function rollupM4(hourRows, { thresholdMph = 15, flagShare = 0.5 } = {}) {
  const rows = (hourRows || []).filter((r) => r && num(r.zone_speed) !== null);
  const withApproach = rows.filter((r) => num(r.approach_speed) !== null);
  const withBaseline = rows.filter((r) => num(r.baseline_speed) !== null);
  const dA = (r) => num(r.approach_speed) - num(r.zone_speed);
  const dB = (r) => num(r.baseline_speed) - num(r.zone_speed);
  const share = (n, d) => (d > 0 ? round(n / d) : null);
  const mean = (vals) => (vals.length ? round(vals.reduce((a, b) => a + b, 0) / vals.length, 2) : null);
  const pctile = (vals, p) => {
    if (!vals.length) return null;
    const s = [...vals].sort((a, b) => a - b);
    return round(s[Math.min(s.length - 1, Math.floor(p * s.length))], 2);
  };
  // per zone
  const byZone = new Map();
  for (const r of withApproach) {
    const k = String(r.wz_event_id);
    if (!byZone.has(k)) byZone.set(k, { hours: 0, over: 0, maxA: -Infinity });
    const z = byZone.get(k); z.hours += 1; const d = dA(r); if (d > thresholdMph) z.over += 1; if (d > z.maxA) z.maxA = d;
  }
  const zones = [...byZone.values()];
  const aVals = withApproach.map(dA); const bVals = withBaseline.map(dB);
  return {
    threshold_mph: thresholdMph,
    hours_measured: rows.length,
    hours_with_approach: withApproach.length,
    hours_with_baseline: withBaseline.length,
    hours_approach_over: aVals.filter((d) => d > thresholdMph).length,
    m4_approach_hour_weighted: share(aVals.filter((d) => d > thresholdMph).length, withApproach.length),
    hours_baseline_over: bVals.filter((d) => d > thresholdMph).length,
    m4_baseline_hour_weighted: share(bVals.filter((d) => d > thresholdMph).length, withBaseline.length),
    mean_differential_approach: mean(aVals),
    p90_differential_approach: pctile(aVals, 0.9),
    mean_differential_baseline: mean(bVals),
    p90_differential_baseline: pctile(bVals, 0.9),
    // the approach can also be SLOWER than the zone: the queue reached past it
    hours_approach_slower_than_zone: aVals.filter((d) => d < -thresholdMph).length,
    zones_with_approach: zones.length,
    zones_any_hour_over: zones.filter((z) => z.over > 0).length,
    zones_majority_over: zones.filter((z) => z.hours > 0 && z.over / z.hours > flagShare).length,
    m4_approach_zone_mean: zones.length ? round(zones.reduce((a, z) => a + z.over / z.hours, 0) / zones.length) : null,
    flag_share: flagShare,
  };
}

/** M4 per comparable universe — the same tiers every phase uses. */
function rollupM4ByTier(hourRows, zoneById, opts = {}) {
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
  for (const [name, pred] of Object.entries(tiers)) out[name] = rollupM4((hourRows || []).filter(pred), opts);
  return out;
}

module.exports = {
  EPOCHS_PER_HOUR,
  DEFAULT_APPROACH_TMCS,
  DEFAULT_MIN_EPOCHS_PER_HOUR,
  differential,
  approachCorridorDDL,
  approachTmcDDL,
  approachExcludeDDL,
  approachHourSQL,
  approachCellSQL,
  rollupM4,
  rollupM4ByTier,
};
