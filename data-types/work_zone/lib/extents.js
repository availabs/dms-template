/**
 * work_zone extents — where on the network a work zone is.
 *
 * ── What the data actually offers ──────────────────────────────────────────
 * The task plan assumed `tmclist` holds a TMC *set*. It does not: on view 1947
 * every populated value is exactly one 9-character TMC (all 82,116 of NY 2024's
 * construction events — no separators of any kind). It is the TMC the event
 * point matched to: an anchor, not an extent.
 *
 * Multi-TMC extents come from the event×TMC expansion (view 2799), which covers
 * 76,790 of those 86,658 events (88.6% — far better than the 18.5%
 * `congestion_data` fill rate the research phase projected). But 2799 is built
 * FROM congestion data, so its TMC set is the **impact** extent — it runs
 * downstream of the work with the queue. Median 2 TMCs, 95th percentile 30, and
 * 638 events carry more than 200; those are corridor-wide attributions, not
 * work footprints.
 *
 * Every event present in 2799 also has a `tmclist` anchor (the union is exactly
 * the anchor count), so coverage is 94.8% and 4,542 events have no extent.
 *
 * ── So the two are kept apart ─────────────────────────────────────────────
 * `wz_event_tmc` rows carry a `tmc_role`:
 *   'anchor'  the tmclist TMC — where the work is
 *   'impact'  a 2799 TMC that is not the anchor — where the effect is felt
 * Phase 2 uses anchors for lane-mile-hours and the impact set for delay;
 * conflating them would inflate exposure by the length of the queue.
 *
 * Pure module: the worker fetches rows, this shapes them.
 */

/**
 * Above this, a 2799 TMC set is a corridor-wide congestion attribution rather
 * than a work zone's impact — 95th percentile is 30 TMCs. Flagged, not dropped:
 * the count stays on the row so a later phase can decide.
 */
const MAX_PLAUSIBLE_IMPACT_TMCS = 50;

const text = (v) => (v === null || v === undefined ? '' : String(v));

/** The single anchor TMC, or null. Tolerates a separated list if TRANSCOM ever emits one. */
function parseAnchorTmc(row) {
  const raw = text(row.tmclist).trim();
  if (!raw) return null;
  const first = raw.split(/[,;|\s]+/).filter(Boolean)[0];
  return first ? first.toUpperCase() : null;
}

/** All TMCs in a `tmclist`, for the day TRANSCOM starts emitting more than one. */
function parseTmcList(row) {
  return [...new Set(
    text(row.tmclist).trim().split(/[,;|\s]+/).filter(Boolean).map((t) => t.toUpperCase())
  )];
}

/**
 * NPMRDS `tmclinear` is unique only WITHIN a region, and the first three
 * characters of a TMC are its region. Corridor walks must key on both or two
 * regions' linears collide.
 */
function linearKey(tmc, meta) {
  if (!meta || meta.tmclinear === null || meta.tmclinear === undefined) return null;
  return `${text(tmc).slice(0, 3)}:${meta.tmclinear}`;
}

/**
 * Build a work zone's extent.
 *
 * @param {object} args
 * @param {string|null} args.anchorTmc
 * @param {string[]} [args.impactTmcs]     distinct TMCs from view 2799
 * @param {Map<string,object>} args.metaByTmc  tmc → { length, aadt, f_system, tmclinear, road_order, direction, road_name }
 * @param {string|null} [args.eventDirection]
 * @returns {{
 *   tmcs: object[], extent_source: string, extent_confidence: string,
 *   n_tmcs_anchor: number, n_tmcs_impact: number, length_mi: number|null,
 *   direction: string|null, impact_extent_implausible: boolean,
 * }}
 */
function buildExtent({ anchorTmc, impactTmcs = [], metaByTmc, eventDirection = null }) {
  const meta = metaByTmc || new Map();
  const anchor = anchorTmc ? anchorTmc.toUpperCase() : null;
  const impact = [...new Set(impactTmcs.map((t) => text(t).toUpperCase()).filter(Boolean))]
    .filter((t) => t !== anchor);

  const rowFor = (tmc, role) => {
    const m = meta.get(tmc) || {};
    return {
      tmc,
      tmc_role: role,
      length: m.length ?? null,
      aadt: m.aadt ?? null,
      f_system: m.f_system ?? null,
      tmclinear: m.tmclinear ?? null,
      road_order: m.road_order ?? null,
      road_name: m.road_name ?? null,
      linear_key: linearKey(tmc, m),
      has_meta: Boolean(meta.get(tmc)),
    };
  };

  const tmcs = [];
  if (anchor) tmcs.push(rowFor(anchor, 'anchor'));
  for (const t of impact) tmcs.push(rowFor(t, 'impact'));

  // Direction: the event's own value wins; otherwise the anchor TMC's.
  const anchorMeta = anchor ? meta.get(anchor) : null;
  const direction = text(eventDirection).trim()
    || (anchorMeta && text(anchorMeta.direction).trim())
    || null;

  let extent_source = 'none';
  if (anchor && impact.length) extent_source = 'anchor+impact';
  else if (anchor) extent_source = 'anchor';
  else if (impact.length) extent_source = 'impact';

  // Confidence describes the WORK extent, which only the anchor speaks to.
  // A large impact set adds delay information, not locational certainty.
  let extent_confidence = 'none';
  if (anchor && anchorMeta) extent_confidence = 'high';
  else if (anchor) extent_confidence = 'medium';        // anchor with no meta row
  else if (impact.length) extent_confidence = 'low';    // impact only — inferred from congestion

  // Length of the WORK extent (the anchor), not of the impact corridor.
  const anchorLength = anchor && anchorMeta && anchorMeta.length !== null && anchorMeta.length !== undefined
    ? Number(anchorMeta.length)
    : null;

  return {
    tmcs,
    extent_source,
    extent_confidence,
    n_tmcs_anchor: anchor ? 1 : 0,
    n_tmcs_impact: impact.length,
    length_mi: Number.isFinite(anchorLength) ? anchorLength : null,
    direction,
    impact_extent_implausible: impact.length > MAX_PLAUSIBLE_IMPACT_TMCS,
  };
}

module.exports = {
  MAX_PLAUSIBLE_IMPACT_TMCS,
  parseAnchorTmc,
  parseTmcList,
  linearKey,
  buildExtent,
};
