/**
 * work_zone measure rollups — M1 first.
 *
 * The ClickHouse query returns one row per (work zone × TMC × hour-of-day)
 * with epochs observed and epochs below each threshold. This module turns
 * those into the measure: per zone, and then per Region × period.
 *
 * ── Two thresholds, always both ───────────────────────────────────────────
 * §630.1006(b) lists "percent of time when speeds in a work zone drop below a
 * predefined threshold" without fixing the threshold, and NYSDOT has not
 * chosen one. So every zone reports:
 *   - the ABSOLUTE measure: epochs below `speed_threshold_mph`
 *   - the RELATIVE measure: epochs below `reference_speed_pct` of the TMC's
 *     reference speed (AVAIL's PM3 `speed_pctl_85`)
 *   - the FHWA measure: epochs below max(20, 0.6 × posted limit), the PHED
 *     anchor AVAIL's own congestion work uses (see lib/baseline.js)
 * None is presented as the answer. Reporting one alone would bake in a policy
 * decision that is still open — and the three anchors agree in aggregate but
 * not per segment.
 *
 * ── The denominator is what was OBSERVED ──────────────────────────────────
 * NPMRDS has gaps — a sampled work-zone TMC-day had 254 of 288 epochs. The
 * denominator is therefore epochs observed while the zone was active, never
 * the epochs it *could* have had. `epoch_coverage` reports the difference so a
 * sparse zone cannot masquerade as a zone with no exceedances.
 *
 * Pure module: no DB, no network.
 */

/** A zone with fewer observed epochs than this is reported but not aggregated. */
const DEFAULT_MIN_EPOCHS = 12;   // one hour of five-minute observations

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const sum = (rows, k) => rows.reduce((a, r) => a + (num(r[k]) || 0), 0);
const round = (v, p = 4) => (v === null ? null : Math.round(v * 10 ** p) / 10 ** p);

/**
 * Collapse the (zone × tmc × hour) cells of ONE work zone into its M1 row.
 *
 * @param {object[]} cells    rows from the ClickHouse measure query
 * @param {object} [opts]     minEpochs
 * @returns {object} the wz_speed fields for that zone
 */
function m1ForZone(cells, opts = {}) {
  const minEpochs = opts.minEpochs ?? DEFAULT_MIN_EPOCHS;
  const rows = (cells || []).filter(Boolean);
  if (!rows.length) {
    return {
      epochs_observed: 0, epochs_below_absolute: null, epochs_below_relative: null,
      epochs_below_fhwa: null,
      m1_absolute: null, m1_relative: null, m1_fhwa: null, speed_mean: null, speed_min: null,
      baseline_speed: null, reference_speed: null, phed_threshold_speed: null,
      fhwa_threshold_speed: null,
      density_a: 0, density_b: 0, density_c: 0, pct_density_c: null,
      n_tmc_hours: 0, hours_covered: 0, is_measurable: false,
    };
  }

  const observed = sum(rows, 'epochs_observed');
  const below = sum(rows, 'epochs_below_absolute');
  const belowRel = sum(rows, 'epochs_below_relative');
  const belowFhwa = sum(rows, 'epochs_below_fhwa');
  const a = sum(rows, 'density_a');
  const b = sum(rows, 'density_b');
  const c = sum(rows, 'density_c');

  // Speeds are averaged across cells weighted by the epochs behind each — an
  // unweighted mean of cell means would let a one-epoch hour count as much as
  // a full one.
  const weighted = (k) => {
    let n = 0; let d = 0;
    for (const r of rows) {
      const v = num(r[k]); const w = num(r.epochs_observed) || 0;
      if (v !== null && w > 0) { n += v * w; d += w; }
    }
    return d > 0 ? n / d : null;
  };
  const firstOf = (k) => {
    for (const r of rows) { const v = num(r[k]); if (v !== null) return v; }
    return null;
  };
  const minOf = (k) => {
    const vs = rows.map((r) => num(r[k])).filter((v) => v !== null);
    return vs.length ? Math.min(...vs) : null;
  };

  return {
    epochs_observed: observed,
    epochs_below_absolute: below,
    epochs_below_relative: belowRel,
    epochs_below_fhwa: belowFhwa,
    // The measure itself: the share of observed active time below threshold.
    m1_absolute: observed > 0 ? round(below / observed) : null,
    m1_relative: observed > 0 ? round(belowRel / observed) : null,
    m1_fhwa: observed > 0 ? round(belowFhwa / observed) : null,
    speed_mean: round(weighted('speed_mean'), 2),
    speed_median: round(weighted('speed_median'), 2),
    speed_min: round(minOf('speed_min'), 2),
    baseline_speed: round(weighted('baseline_speed'), 2),
    baseline_p85: round(weighted('baseline_p85'), 2),
    reference_speed: round(firstOf('reference_speed'), 2),
    phed_threshold_speed: round(firstOf('phed_threshold_speed'), 2),
    fhwa_threshold_speed: round(firstOf('fhwa_threshold_speed'), 2),
    density_a: a, density_b: b, density_c: c,
    pct_density_c: observed > 0 ? round((100 * c) / observed, 1) : null,
    n_tmc_hours: rows.length,
    hours_covered: new Set(rows.map((r) => r.hour)).size,
    // Small samples are kept, flagged, and left out of aggregates.
    is_measurable: observed >= minEpochs,
  };
}

/**
 * Group the ClickHouse cells by work zone.
 * @returns {Map<string, object[]>}
 */
function groupCellsByZone(cells) {
  const byZone = new Map();
  for (const r of cells || []) {
    const id = String(r.wz_event_id);
    if (!byZone.has(id)) byZone.set(id, []);
    byZone.get(id).push(r);
  }
  return byZone;
}

/**
 * Roll zone-level M1 up to a group (Region, period, whatever the caller keys).
 *
 * Reported two ways on purpose:
 *   - `m1_epoch_weighted`  — the share of all observed epochs below threshold.
 *     The honest aggregate: a long zone counts more than a short one.
 *   - `m1_zone_mean`       — the mean of the zones' own shares. Answers a
 *     different question ("how bad is a typical work zone") and is the one a
 *     reader usually assumes. Publishing only one invites the wrong reading.
 *
 * Only measurable zones are aggregated; the rest are counted so the exclusion
 * is visible.
 */
function rollupM1(zoneRows, opts = {}) {
  const rows = (zoneRows || []).filter((r) => r && r.is_measurable);
  const skipped = (zoneRows || []).length - rows.length;
  if (!rows.length) {
    return {
      zones: 0, zones_skipped: skipped, epochs_observed: 0,
      m1_absolute_epoch_weighted: null, m1_relative_epoch_weighted: null,
      m1_fhwa_epoch_weighted: null,
      m1_absolute_zone_mean: null, m1_relative_zone_mean: null, m1_fhwa_zone_mean: null,
      active_hours: null,
    };
  }
  const observed = sum(rows, 'epochs_observed');
  const mean = (k) => {
    const vs = rows.map((r) => num(r[k])).filter((v) => v !== null);
    return vs.length ? round(vs.reduce((x, y) => x + y, 0) / vs.length) : null;
  };
  return {
    zones: rows.length,
    zones_skipped: skipped,
    epochs_observed: observed,
    m1_absolute_epoch_weighted: observed > 0 ? round(sum(rows, 'epochs_below_absolute') / observed) : null,
    m1_relative_epoch_weighted: observed > 0 ? round(sum(rows, 'epochs_below_relative') / observed) : null,
    m1_fhwa_epoch_weighted: observed > 0 ? round(sum(rows, 'epochs_below_fhwa') / observed) : null,
    m1_absolute_zone_mean: mean('m1_absolute'),
    m1_relative_zone_mean: mean('m1_relative'),
    m1_fhwa_zone_mean: mean('m1_fhwa'),
    // Observed epochs are five minutes each.
    active_hours: round((observed * 5) / 60, 1),
    ...(opts.extra || {}),
  };
}

module.exports = {
  DEFAULT_MIN_EPOCHS,
  m1ForZone,
  groupCellsByZone,
  rollupM1,
};
