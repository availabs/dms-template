/**
 * work_zone baselines — what "normal" speed means on a segment.
 *
 * M1 asks what share of a work zone's active time ran below a threshold. The
 * absolute threshold (35 mph) needs no baseline; the relative one — below a
 * percentage of the segment's reference speed — needs a defensible definition
 * of that reference. This module holds those definitions and the SQL that
 * expresses them. Pure: builds strings and computes windows, runs nothing.
 *
 * ── Where the reference speed comes from ──────────────────────────────────
 * Not from here. AVAIL's PM3 dataset already holds per-TMC, per-year speed
 * percentiles computed on the FHWA PM3 methodology — `speed_pctl_85` and its
 * siblings, plus FHWA's own PHED threshold speeds — and it covers **8,164 of
 * our 8,165 anchor TMCs**. (PM3 is AVAIL's own computation; the federally
 * submitted product is the separate map21 dataset, built the same way.)
 *
 * Using it instead of deriving a percentile here has a consequence worth
 * stating: **M1 does not depend on the contaminated-baseline question at all.**
 * The relative threshold is `speed_pctl_85 × reference_speed_pct`, and the
 * absolute threshold is a constant, so neither can be biased by whether the
 * baseline excluded other work zones. That removes the circularity risk this
 * phase was most exposed to.
 *
 * ── What the baseline here is still for ───────────────────────────────────
 * Context and phase 6. For each TMC: the same hour-of-day and the same
 * day-type (weekday vs weekend) over the twelve months before the measurement
 * window, with whole days removed where that TMC carried any work zone. Median
 * plus the 15th and 85th percentiles are kept. That answers "what was normal
 * at this hour" — which is what a during-vs-baseline speed drop (M4) needs,
 * and what makes an M1 number interpretable — but it is not what defines M1.
 *
 * ── Why whole days, not epochs ────────────────────────────────────────────
 * Contamination could be removed epoch-precisely, since view 2799 gives each
 * event's epoch bounds. It is removed at the (tmc, date) level instead: a work
 * zone's effect spills past its reported window through setup, teardown and
 * residual queueing, so dropping the whole day over-excludes in the safe
 * direction. Measured cost on CY2024 anchors: 9.43% of TMC-days. Skipping
 * exclusion altogether would leave the baseline slightly slow and make M1
 * conservative — fewer exceedances, not more.
 *
 * ── Speed from travel time ────────────────────────────────────────────────
 * The NPMRDS table stores travel time in seconds, so every speed is derived:
 * `miles × 3600 / travel_time`. That makes each speed depend on the TMC's
 * length, and therefore on the right YEAR's metadata — the meta view is one
 * row per (tmc, year).
 */

const DEFAULT_BASELINE_MONTHS = 12;
/** The reference speed's percentile within the off-peak baseline distribution. */
const DEFAULT_REFERENCE_PERCENTILE = 0.85;
/**
 * Off-peak hours for the reference speed: overnight and midday, excluding the
 * commute peaks that would drag a "free flow" reference down on a busy urban
 * segment.
 */
const DEFAULT_OFF_PEAK_HOURS = [0, 1, 2, 3, 4, 5, 10, 11, 12, 13, 20, 21, 22, 23];
/** Percentiles kept for every (tmc, hour, day-type) cell. */
const BASELINE_PERCENTILES = [0.15, 0.5, 0.85];

const EPOCHS_PER_DAY = 288;
const EPOCHS_PER_HOUR = 12;

/** Epoch (0-287) → hour of day (0-23). */
const epochToHour = (epoch) => Math.floor(Number(epoch) / EPOCHS_PER_HOUR);
/** Hour of day → its first epoch. */
const hourToEpoch = (hour) => Number(hour) * EPOCHS_PER_HOUR;
/** Epoch → 'HH:MM' on a 5-minute grid, for reports and fixtures. */
function epochToClock(epoch) {
  const e = Number(epoch);
  const h = Math.floor((e * 5) / 60);
  const m = (e * 5) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * The baseline date window for a measurement window.
 *
 * Ends the day before the measurement window opens, so a zone is never
 * compared against itself.
 */
function baselineWindow({ startDate, months = DEFAULT_BASELINE_MONTHS }) {
  const start = new Date(`${String(startDate).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) throw new Error(`baselineWindow: bad startDate '${startDate}'`);
  const end = new Date(start.getTime() - 86400000);              // the day before
  const from = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - Number(months), start.getUTCDate()));
  const iso = (d) => d.toISOString().slice(0, 10);
  return { baseline_start: iso(from), baseline_end: iso(end), baseline_months: Number(months) };
}

/** ClickHouse expression for speed in mph, given a joined `miles` column. */
function speedExpr({ milesExpr = 'm.miles', travelTimeExpr = 'n.travel_time_all_vehicles' } = {}) {
  // Guard the divide: a zero or null travel time is no observation, not infinite speed.
  return `if(${travelTimeExpr} > 0 AND ${milesExpr} > 0, ${milesExpr} * 3600 / ${travelTimeExpr}, NULL)`;
}

/**
 * Per (tmc, hour, day-type) baseline percentiles, excluding contaminated days.
 *
 * `speedTable` is the NPMRDS ClickHouse table, `tmcTable` the run-scoped
 * tmc→miles table, `excludeTable` the run-scoped (tmc, date) exclusions.
 */
function baselineSQL({ speedTable, tmcTable, excludeTable, baselineStart, baselineEnd }) {
  const speed = speedExpr();
  const q = BASELINE_PERCENTILES;
  return `
SELECT n.tmc AS tmc,
       intDiv(n.epoch, ${EPOCHS_PER_HOUR}) AS hour,
       toDayOfWeek(n.date) IN (6, 7) AS is_weekend,
       count() AS epochs,
       quantile(${q[0]})(${speed}) AS speed_p15,
       quantile(${q[1]})(${speed}) AS speed_median,
       quantile(${q[2]})(${speed}) AS speed_p85
  FROM ${speedTable} n
 INNER JOIN ${tmcTable} m ON m.tmc = n.tmc
  WHERE n.date >= toDate('${baselineStart}') AND n.date <= toDate('${baselineEnd}')
    AND n.travel_time_all_vehicles > 0
    -- whole-day contamination exclusion; see the module note
    AND (n.tmc, n.date) NOT IN (SELECT tmc, date FROM ${excludeTable})
 GROUP BY tmc, hour, is_weekend`;
}

/**
 * The in-window measure, computed entirely in ClickHouse.
 *
 * One row per (work zone × tmc × hour-of-day): epochs observed while the zone
 * was active, how many fell below each threshold, the observed speeds, and the
 * baseline and reference speeds for that cell. `epochs` is what was OBSERVED,
 * never 288 — NPMRDS has gaps, and a sparse cell must not read as a cell with
 * no exceedances.
 *
 * Density is not filtered: the owner's decision is to include density C. The
 * mix is returned so a C-heavy zone stays identifiable.
 */
function measureSQL({ speedTable, tmcTable, activeTable, baselineCte, speedThresholdMph, referencePct }) {
  const speed = speedExpr();
  return `
WITH baseline AS (${baselineCte})
SELECT a.wz_event_id AS wz_event_id,
       n.tmc AS tmc,
       intDiv(n.epoch, ${EPOCHS_PER_HOUR}) AS hour,
       count() AS epochs_observed,
       countIf(${speed} < ${speedThresholdMph}) AS epochs_below_absolute,
       countIf(m.reference_speed > 0
               AND ${speed} < m.reference_speed * ${referencePct} / 100) AS epochs_below_relative,
       avg(${speed}) AS speed_mean,
       quantile(0.5)(${speed}) AS speed_median,
       min(${speed}) AS speed_min,
       any(b.speed_median) AS baseline_speed,
       any(b.speed_p85) AS baseline_p85,
       any(m.reference_speed) AS reference_speed,
       any(m.phed_threshold_speed) AS phed_threshold_speed,
       countIf(n.data_density_all_vehicles = 'A') AS density_a,
       countIf(n.data_density_all_vehicles = 'B') AS density_b,
       countIf(n.data_density_all_vehicles = 'C') AS density_c
  FROM ${activeTable} a
 INNER JOIN ${speedTable} n
    ON n.tmc = a.tmc AND n.date = a.date AND n.epoch >= a.epoch_from AND n.epoch <= a.epoch_to
 INNER JOIN ${tmcTable} m ON m.tmc = n.tmc
  LEFT JOIN baseline b
    ON b.tmc = n.tmc AND b.hour = intDiv(n.epoch, ${EPOCHS_PER_HOUR})
   AND b.is_weekend = (toDayOfWeek(n.date) IN (6, 7))
 WHERE n.travel_time_all_vehicles > 0
 GROUP BY wz_event_id, tmc, hour`;
}

module.exports = {
  DEFAULT_BASELINE_MONTHS,
  DEFAULT_REFERENCE_PERCENTILE,
  DEFAULT_OFF_PEAK_HOURS,
  BASELINE_PERCENTILES,
  EPOCHS_PER_DAY,
  EPOCHS_PER_HOUR,
  epochToHour,
  hourToEpoch,
  epochToClock,
  baselineWindow,
  speedExpr,
  baselineSQL,
  measureSQL,
};
