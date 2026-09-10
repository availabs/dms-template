/**
 * M2 — work-zone delay in vehicle-hours, and delay per vehicle.
 *
 * > **Vehicle-hours of delay attributed to work zones; delay per vehicle
 * > through the zone; and work-zone delay as a share of all delay.**
 *
 * Delay is not computed here. TRANSCOM's event-to-TMC conflation (view 2799)
 * already attributes delay to each (event, TMC) pair in vehicle-hours; this
 * module rolls those rows up to the work zone and derives the per-vehicle
 * measure. What it contributes is the aggregation rules, and one of them is
 * the opposite of every other phase's.
 *
 * ── ⚠ M2 uses ALL TMCs. Phases 2 and 3 use anchors only. ──────────────────
 * A work zone's TMC list carries two roles: `anchor` (the segments being
 * worked on) and `impact` (the segments downstream where congestion was
 * attributed to it). Exposure and M1 filter to anchors on purpose — counting
 * the queue as part of the work zone would inflate lane-mile-hours, and M1 is
 * a statement about speed where the work is.
 *
 * **Delay is the queue.** Measured on CY2024, a work zone's delay divides
 * anchor 3.52 M vehicle-hours (8.6%) against impact 37.22 M (91.4%). Filtering
 * to anchors would report 3.5 M where the true figure is 40.7 M — an 11-fold
 * understatement, and one that would look plausible. The split is kept on every
 * row (`delay_anchor` / `delay_impact`) so the division stays visible rather
 * than becoming folklore.
 *
 * ── Two delay columns, one of them unexplained ────────────────────────────
 * 2799 carries `delay` and `raw_delay`. On CY2024 construction and maintenance
 * rows `delay >= raw_delay` always: equal on 51% of rows, larger on 49%, median
 * ratio 1.28 and mean 5.44 — a heavy tail. **Nothing in the references explains
 * how one is derived from the other.** Both are rolled up. `delay` is primary
 * because it is what the prior TSMO build's 40.7 M figure reconciles to, and
 * the choice is stamped on the view rather than assumed.
 *
 * ── Delay per vehicle ─────────────────────────────────────────────────────
 * `delay_per_vehicle_min = delay_vehicle_hours * 60 / veh_through_wz`, using
 * phase 2's vehicle count. It is null, never zero, where exposure could not
 * compute a vehicle count — a zone with unknown traffic has an unknown
 * per-vehicle delay, and publishing 0 would read as "no delay". Flagged against
 * `delay_per_veh_min` (default 10, from lib/thresholds.js).
 *
 * Pure: no DB, no CH, no network.
 */

/** Vehicle-hours to minutes. */
const MINUTES_PER_HOUR = 60;

/**
 * Roll (event x tmc) delay rows up to one work zone.
 *
 * `rows` are 2799 rows already restricted to this zone's member events and its
 * TMCs, each carrying `{ tmc, tmc_role, delay, raw_delay }`. Missing `delay`
 * with a present `raw_delay` (2,705 CY2024 rows) is counted into
 * `rows_delay_missing` and contributes nothing to the `delay` totals — it is a
 * gap, not a zero.
 */
function delayForZone(rows, opts = {}) {
  const list = rows || [];
  const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
  const fin = (v) => (Number.isFinite(v) ? v : null);

  let delay = 0, raw = 0, anchor = 0, impact = 0;
  let missing = 0, rawMissing = 0;
  const tmcs = new Set();
  const anchorTmcs = new Set();

  for (const r of list) {
    const d = fin(num(r.delay));
    const rd = fin(num(r.raw_delay));
    if (d === null) missing += 1; else delay += d;
    if (rd === null) rawMissing += 1; else raw += rd;
    if (r.tmc) tmcs.add(String(r.tmc));
    if (String(r.tmc_role) === 'anchor') {
      if (d !== null) anchor += d;
      if (r.tmc) anchorTmcs.add(String(r.tmc));
    } else if (d !== null) {
      impact += d;
    }
  }

  const round = (v, p = 4) => (v === null ? null : Math.round(v * 10 ** p) / 10 ** p);
  // A zone with no delay row, or whose every row had a null delay, has UNKNOWN
  // delay — not zero. This pipeline's rule since phase 2 is that a measure with
  // a missing input is published as unknown; 17,616 of CY2024's 42,688 zones
  // have no 2799 conflation at all, and reporting them as 0 would let a sum
  // over them read as a measurement. It also matters at the vintage level:
  // CY2019 and CY2020 have no 2799 rows whatsoever.
  const measured = list.length > 0 && list.length > missing;
  const vehicles = fin(num(opts.veh_through_wz));
  // Null, not zero: an unknown vehicle count means an unknown per-vehicle delay.
  const perVeh = measured && vehicles && vehicles > 0
    ? (delay * MINUTES_PER_HOUR) / vehicles : null;
  const threshold = num(opts.delay_per_veh_min);

  return {
    delay_vehicle_hours: measured ? round(delay) : null,
    raw_delay_vehicle_hours: list.length > rawMissing ? round(raw) : null,
    delay_anchor: measured ? round(anchor) : null,
    delay_impact: measured ? round(impact) : null,
    // The share of this zone's delay that fell downstream of the work extent.
    delay_impact_share: measured && delay > 0 ? round(impact / delay) : null,
    delay_per_vehicle_min: round(perVeh, 3),
    exceeds_delay_per_vehicle:
      perVeh === null || threshold === null ? null : perVeh > threshold,
    delay_measured: measured,
    n_delay_rows: list.length,
    n_delay_tmcs: tmcs.size,
    n_delay_tmcs_anchor: anchorTmcs.size,
    rows_delay_missing: missing,
    rows_raw_delay_missing: rawMissing,
    delay_complete: list.length > 0 && missing === 0,
  };
}

/**
 * Statewide / per-cut rollup over per-zone delay rows.
 *
 * Vehicle-hours sum, so the total is the total. Delay PER VEHICLE does not: the
 * meaningful aggregate is total delay over total vehicles, not a mean of
 * per-zone rates, which would weight a two-vehicle zone like a two-million-
 * vehicle one. Both are returned, and the exposure-weighted one is the
 * reportable figure.
 */
function rollupDelay(zoneRows, opts = {}) {
  const rows = (zoneRows || []).filter(Boolean);
  const sum = (k) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const round = (v, p = 4) => (Number.isFinite(v) ? Math.round(v * 10 ** p) / 10 ** p : null);

  // Only zones that actually had a delay measurement contribute to the totals,
  // and if none did the totals are null rather than 0.
  const measuredRows = rows.filter((r) => r.delay_measured === true
    || (r.delay_measured === undefined && r.delay_vehicle_hours !== null
        && r.delay_vehicle_hours !== undefined));
  const anyMeasured = measuredRows.length > 0;
  const delay = sum('delay_vehicle_hours');
  const vehicles = measuredRows.reduce((a, r) => a + (Number(r.veh_through_wz) || 0), 0);
  // `Number(null)` is 0 and 0 is finite, so a null rate would pass a naive
  // isFinite filter and drag the mean toward zero. Reject null/undefined/''
  // explicitly before coercing.
  const rated = rows.filter((r) => {
    const v = r.delay_per_vehicle_min;
    return v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
  });
  const meanRate = rated.length
    ? rated.reduce((a, r) => a + Number(r.delay_per_vehicle_min), 0) / rated.length
    : null;

  return {
    zones: rows.length,
    zones_measured: measuredRows.length,
    // Zones with no 2799 conflation at all: a coverage gap, not zero delay.
    zones_delay_unknown: rows.length - measuredRows.length,
    zones_with_delay: rows.filter((r) => Number(r.delay_vehicle_hours) > 0).length,
    delay_vehicle_hours: anyMeasured ? round(delay) : null,
    raw_delay_vehicle_hours: anyMeasured ? round(sum('raw_delay_vehicle_hours')) : null,
    delay_anchor: anyMeasured ? round(sum('delay_anchor')) : null,
    delay_impact: anyMeasured ? round(sum('delay_impact')) : null,
    delay_impact_share: anyMeasured && delay > 0 ? round(sum('delay_impact') / delay) : null,
    veh_through_wz: vehicles || null,
    // The reportable per-vehicle figure: total delay over total vehicles.
    delay_per_vehicle_min: anyMeasured && vehicles > 0
      ? round((delay * MINUTES_PER_HOUR) / vehicles, 3) : null,
    // The unweighted mean of per-zone rates, which answers "the typical zone"
    // and will differ sharply. Kept so the two cannot be confused.
    delay_per_vehicle_min_zone_mean: round(meanRate, 3),
    zones_exceeding_per_vehicle: rows.filter((r) => r.exceeds_delay_per_vehicle === true).length,
    zones_rate_unknown: rows.filter((r) => r.delay_per_vehicle_min === null
      || r.delay_per_vehicle_min === undefined).length,
    rows_delay_missing: sum('rows_delay_missing'),
  };
}

/**
 * Work-zone delay as a share of all delay.
 *
 * `total` and `construction` come from the excessive-delay series (source 2039
 * / view 3488 — NOT view 2633, which is missing 2020 and has a broken 2019).
 *
 * The construction ratio is a **consistency check, not a component share**: the
 * two datasets attribute delay independently, so a ratio near 1 says they
 * agree. Measured CY2024: 40.74 M against 40.31 M, i.e. 1.01.
 *
 * ⚠ The excessive-delay series was computed with FHWA's PHED threshold
 * collapsed to a uniform 20 mph, because the ClickHouse copy of
 * `avg_speedlimit` is empty (recorded in phase 3 / lib/baseline.js). It is a
 * magnitude check, not an authority.
 */
function delayShare({ wzDelay, total, construction }) {
  const n = (v) => (v === null || v === undefined || v === ''
    ? null : (Number.isFinite(Number(v)) ? Number(v) : null));
  const wz = n(wzDelay), t = n(total), c = n(construction);
  const round = (v) => (v === null ? null : Math.round(v * 1e4) / 1e4);
  // Shares get more precision than vehicle-hours do: 4 decimal places rounds a
  // small share to exactly 0, which reads as "no work-zone delay" rather than
  // "a small share". Vehicle-hour totals are in the millions and 4dp is ample.
  const roundShare = (v) => (v === null ? null : Math.round(v * 1e8) / 1e8);
  return {
    wz_delay_vehicle_hours: round(wz),
    all_delay_vehicle_hours: round(t),
    construction_delay_vehicle_hours: round(c),
    share_of_all_delay: wz !== null && t ? roundShare(wz / t) : null,
    ratio_to_construction_bucket: wz !== null && c ? roundShare(wz / c) : null,
  };
}

module.exports = {
  MINUTES_PER_HOUR,
  delayForZone,
  rollupDelay,
  delayShare,
};
