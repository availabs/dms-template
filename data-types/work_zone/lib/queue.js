/**
 * M3 — queues: how far back, how long, how often.
 *
 * The recommendation report defines M3 as the percent of significant projects
 * whose queue exceeds a threshold, with queue length (max, 95th percentile) and
 * duration alongside; the method is the "connected queue" of Maryland's WZPMA
 * and FHWA HOP-13-043 — contiguous upstream TMCs below a speed threshold.
 *
 * ── The walk, as this module defines it ──────────────────────────────────
 * For every five-minute epoch a zone was active:
 *
 *   1. The ANCHOR TMC (where the work is) must be observed AND below the
 *      threshold. A queue is measured from the bottleneck backwards; if the
 *      bottleneck itself is not slow there is no queue to measure, and slow
 *      traffic somewhere upstream belongs to a different bottleneck.
 *   2. Walk UPSTREAM one TMC at a time along the same corridor while each
 *      segment is observed and below the threshold. Queue length is the sum of
 *      those upstream segments' lengths — the anchor's own length is carried
 *      on the row but NOT counted, so the number answers "how far beyond the
 *      work did the queue reach". An unobserved segment ends the walk and marks
 *      the length a LOWER BOUND; so does running off the end of the corridor.
 *   3. A queue counts as PRESENT only when the anchor was below threshold in
 *      at least two consecutive observed epochs (ten minutes). One slow
 *      five-minute sample is noise, and the Boston MPO / Maryland connected-
 *      queue rule filters it the same way.
 *
 * Two thresholds are walked on every epoch:
 *   absolute  speed < queue_speed_mph (35 mph default — Ohio's in-zone line)   PRIMARY
 *   phed      speed < max(20, 0.6 x posted limit) per segment — FHWA's PHED
 *             anchor, the road-scaled comparator AVAIL's congestion series uses
 * Phase 3 found that a fixed speed line measures the road as much as the work;
 * carrying the PHED variant lets the report show how much of any facility
 * contrast is the threshold.
 *
 * ── Upstream is LOWER road_order ──────────────────────────────────────────
 * Measured on the 2024 NPMRDS inventory (42,779 consecutive pairs within one
 * region x tmclinear x direction): the end point of a TMC meets the start
 * point of the NEXT-HIGHER road_order within 30 m in 69% of pairs and the
 * reverse in 13% (the reversals cluster on interchange-internal P/N segments).
 * road_order therefore ascends in the direction of travel, and a queue backs
 * into segments of lower order. The I-495 validation zone shows it directly:
 * on its active Sunday the anchor (order 104) held 17-32 mph while orders
 * 90-103 fell to 12-25 mph and orders 105-110 recovered into the 40s.
 *
 * ── The corridor ──────────────────────────────────────────────────────────
 * NPMRDS tmclinear is unique only within a region and carries BOTH directions
 * of a road, so a corridor is (first three characters of the TMC, tmclinear,
 * direction string). road_order repeats for ~4% of (corridor, order) groups —
 * parallel interchange internals and ramps — and the walk keeps the longest
 * segment at each order. The walk stops at a gap longer than
 * DEFAULT_QUEUE_MAX_GAP_MI between one segment's end and the next one's start
 * (the linear jumped; there is nothing to measure in between), after
 * DEFAULT_QUEUE_MAX_REACH_MI of upstream length, or after
 * DEFAULT_QUEUE_MAX_UPSTREAM_TMCS segments. All three are descriptor options
 * and are stamped on the view.
 *
 * ── What is deliberately NOT here ─────────────────────────────────────────
 * The walk stays on the mainline. TRANSCOM's own impact extent (view 2799)
 * follows an OSM graph onto ramps and cross streets — 83% of its impact TMCs
 * sit on a different linear from the anchor — so a queue spilling onto a ramp
 * is not counted here. That is a limitation to report, not a bug to fix in
 * phase 5.
 *
 * Pure: shapes rows and builds strings, runs nothing.
 */

const { fhwaThresholdSpeed } = require('./baseline.js');

const EPOCHS_PER_HOUR = 12;
const EPOCHS_PER_DAY = 288;

/** Upstream reach after which the walk stops, in miles of upstream length. */
const DEFAULT_QUEUE_MAX_REACH_MI = 10;
/** Upstream segments after which the walk stops. */
const DEFAULT_QUEUE_MAX_UPSTREAM_TMCS = 20;
/** A break in the linear longer than this ends the corridor. TRANSCOM's graph walk uses the same half mile. */
const DEFAULT_QUEUE_MAX_GAP_MI = 0.5;
/** Consecutive slow epochs at the anchor before a queue counts as present. */
const DEFAULT_MIN_CONSECUTIVE_EPOCHS = 2;

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const round = (v, p = 4) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10 ** p) / 10 ** p);

/** Great-circle distance in miles between two (lat, lon) points. */
function haversineMi(lat1, lon1, lat2, lon2) {
  const a = [lat1, lon1, lat2, lon2].map(num);
  if (a.some((v) => v === null)) return null;
  const R = 3958.7613;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(a[2] - a[0]);
  const dLon = toRad(a[3] - a[1]);
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a[0])) * Math.cos(toRad(a[2])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(Math.min(1, s)));
}

/**
 * Build one anchor's upstream corridor from the meta rows on its
 * (region, tmclinear, direction).
 *
 * @param {object} args
 * @param {string} args.anchorTmc
 * @param {object[]} args.rows  meta rows on the anchor's corridor with
 *        road_order <= the anchor's: { tmc, road_order, miles, avg_speedlimit,
 *        start_latitude, start_longitude, end_latitude, end_longitude }
 * @param {number} [args.maxReachMi]
 * @param {number} [args.maxUpstreamTmcs]
 * @param {number} [args.maxGapMi]
 * @returns {{ tmcs: object[], n_upstream_tmcs: number, reach_mi: number, end_reason: string }}
 *   tmcs: [{ tmc, rank, road_order, miles, phed_threshold_speed, gap_mi }], rank 0 = the anchor
 *   end_reason: 'no_meta' | 'end_of_linear' | 'gap' | 'reach' | 'tmcs'
 */
function buildCorridor({
  anchorTmc, rows,
  maxReachMi = DEFAULT_QUEUE_MAX_REACH_MI,
  maxUpstreamTmcs = DEFAULT_QUEUE_MAX_UPSTREAM_TMCS,
  maxGapMi = DEFAULT_QUEUE_MAX_GAP_MI,
}) {
  const anchor = String(anchorTmc || '').toUpperCase();
  const all = (rows || []).filter((r) => r && r.tmc);
  const anchorRow = all.find((r) => String(r.tmc).toUpperCase() === anchor);
  if (!anchorRow || num(anchorRow.road_order) === null) {
    return { tmcs: [], n_upstream_tmcs: 0, reach_mi: 0, end_reason: 'no_meta' };
  }
  const shape = (r, rank, gap) => ({
    tmc: String(r.tmc).toUpperCase(),
    rank,
    road_order: num(r.road_order),
    miles: num(r.miles) || 0,
    phed_threshold_speed: fhwaThresholdSpeed(r.avg_speedlimit) || 0,
    gap_mi: gap,
  });
  const tmcs = [shape(anchorRow, 0, 0)];
  const anchorOrder = num(anchorRow.road_order);

  // Strictly lower order only: a segment sharing the anchor's own order is a
  // parallel internal or ramp, not something upstream of it.
  const byOrder = new Map();
  for (const r of all) {
    const o = num(r.road_order);
    if (o === null || o >= anchorOrder) continue;
    if (!byOrder.has(o)) byOrder.set(o, []);
    byOrder.get(o).push(r);
  }
  // Descending order = walking upstream. Ties: the longest segment is the
  // mainline; the short ones are the ramps that share its order.
  const orders = [...byOrder.keys()].sort((a, b) => b - a);
  let prev = anchorRow;
  let reach = 0;
  let endReason = 'end_of_linear';
  for (const o of orders) {
    if (tmcs.length - 1 >= maxUpstreamTmcs) { endReason = 'tmcs'; break; }
    if (reach >= maxReachMi) { endReason = 'reach'; break; }
    const cands = byOrder.get(o).slice().sort((a, b) => (num(b.miles) || 0) - (num(a.miles) || 0)
      || String(a.tmc).localeCompare(String(b.tmc)));
    const c = cands[0];
    // The upstream segment's END should meet the downstream segment's START.
    // Unknown coordinates cannot break the chain; a measured jump can.
    const gap = haversineMi(c.end_latitude, c.end_longitude, prev.start_latitude, prev.start_longitude);
    if (gap !== null && gap > maxGapMi) { endReason = 'gap'; break; }
    tmcs.push(shape(c, tmcs.length, gap === null ? null : round(gap, 4)));
    reach += num(c.miles) || 0;
    prev = c;
  }
  return { tmcs, n_upstream_tmcs: tmcs.length - 1, reach_mi: round(reach, 4), end_reason: endReason };
}

/**
 * The walk for ONE epoch, in JavaScript — the reference the SQL is checked
 * against and the definition the unit tests pin.
 *
 * @param {object[]} obs   observed segments this epoch: { rank, speed, miles, tmc }
 * @param {number|function} threshold  mph, or (obs) => mph for a per-segment threshold
 * @returns {{ anchor_observed, anchor_speed, raw_present, upstream_len_mi,
 *             n_queued_upstream, tmcs, lower_bound, break_reason, ranks_observed }}
 *   break_reason: 'anchor_free' (anchor above threshold) | 'fast' (an upstream
 *   segment above threshold) | 'gap' (next rank unobserved) | 'end' (all
 *   observed segments were slow) | 'unobserved' (no anchor observation)
 */
function queueForEpoch(obs, threshold) {
  const rows = (obs || []).filter((o) => o && num(o.rank) !== null && num(o.speed) !== null)
    .map((o) => ({ ...o, rank: num(o.rank), speed: num(o.speed), miles: num(o.miles) || 0 }))
    .sort((a, b) => a.rank - b.rank);
  const thr = (o) => (typeof threshold === 'function' ? num(threshold(o)) : num(threshold));
  const slow = (o) => { const t = thr(o); return t !== null && t > 0 && o.speed < t; };
  const empty = {
    anchor_observed: false, anchor_speed: null, raw_present: false, upstream_len_mi: 0,
    n_queued_upstream: 0, tmcs: [], lower_bound: false, break_reason: 'unobserved', ranks_observed: rows.length,
  };
  if (!rows.length || rows[0].rank !== 0) return empty;
  const anchor = rows[0];
  if (!slow(anchor)) {
    return { ...empty, anchor_observed: true, anchor_speed: anchor.speed, break_reason: 'anchor_free' };
  }
  let len = 0; const tmcs = [];
  let breakReason = 'end';
  let i = 1;
  for (; i < rows.length; i++) {
    if (rows[i].rank !== i) { breakReason = 'gap'; break; }
    if (!slow(rows[i])) { breakReason = 'fast'; break; }
    len += rows[i].miles;
    tmcs.push(rows[i].tmc);
  }
  return {
    anchor_observed: true, anchor_speed: anchor.speed, raw_present: true,
    upstream_len_mi: round(len, 4), n_queued_upstream: tmcs.length, tmcs,
    lower_bound: breakReason !== 'fast', break_reason: breakReason, ranks_observed: rows.length,
  };
}

/**
 * The consecutive-epoch rule: a raw slow epoch counts as a queue only inside a
 * run of at least `minConsecutive` consecutive raw epochs. Pure; one
 * (zone, date) at a time.
 *
 * @param {object[]} epochs  [{ epoch, raw_present }]
 * @returns {Map<number, boolean>} epoch -> present
 */
function applyConsecutiveRule(epochs, { minConsecutive = DEFAULT_MIN_CONSECUTIVE_EPOCHS } = {}) {
  const raw = new Set((epochs || []).filter((e) => e && e.raw_present).map((e) => num(e.epoch)));
  const out = new Map();
  for (const e of epochs || []) {
    const ep = num(e.epoch);
    if (ep === null) continue;
    if (!raw.has(ep)) { out.set(ep, false); continue; }
    // Longest run of consecutive raw epochs containing this one.
    let lo = ep; while (raw.has(lo - 1)) lo--;
    let hi = ep; while (raw.has(hi + 1)) hi++;
    out.set(ep, hi - lo + 1 >= minConsecutive);
  }
  return out;
}

/** Longest run of consecutive integers in a set of epochs, in epochs. */
function longestRun(epochs) {
  const s = [...new Set((epochs || []).map(num).filter((v) => v !== null))].sort((a, b) => a - b);
  let best = 0; let run = 0;
  for (let i = 0; i < s.length; i++) {
    run = i > 0 && s[i] === s[i - 1] + 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

// ── ClickHouse ───────────────────────────────────────────────────────────────

/**
 * The corridor x active-day staging table: one row per (zone, corridor TMC,
 * active day) with the day's epoch window. Keyed (tmc, date) so the join from
 * the speed table touches only the rows that matter; this is what keeps the
 * join from exploding across every zone whose corridor shares a TMC.
 */
function corridorActiveDDL({ database, table }) {
  return `CREATE TABLE IF NOT EXISTS ${database}.${table} (
       wz_event_id String,
       tmc String,
       rank UInt16,
       n_ranks UInt16,
       miles Float64,
       phed_threshold_speed Float64,
       date Date,
       epoch_from Int32,
       epoch_to Int32,
       window_source LowCardinality(String)
     ) ENGINE = Memory`;
}

/**
 * The per-epoch result table: one row per (zone, date, epoch) the anchor was
 * observed, with both walks already applied. Filled month by month by
 * queueEpochInsertSQL so a year never sits in one GROUP BY.
 */
function queueEpochDDL({ database, table }) {
  return `CREATE TABLE IF NOT EXISTS ${database}.${table} (
       wz_event_id String,
       date Date,
       epoch Int32,
       window_source LowCardinality(String),
       n_ranks UInt16,
       ranks_observed UInt16,
       anchor_speed Float64,
       raw_abs UInt8,
       raw_phed UInt8,
       queued_abs UInt8,
       queued_phed UInt8,
       len_abs Float64,
       len_phed Float64,
       tmcs_abs String,
       lower_abs UInt8,
       lower_phed UInt8,
       corridor_end_abs UInt8
     ) ENGINE = Memory`;
}

/**
 * The walk, in ClickHouse, for one date range: reads the speed table joined to
 * the staged corridor days, groups each (zone, date, epoch) into rank-sorted
 * arrays, finds the first break in the chain, then applies the consecutive-
 * epoch rule with a window over each (zone, date).
 *
 * The speed table is on the LEFT of the join (ClickHouse hashes the right
 * side), the date bound is mandatory (partition pruning), the tmc IN prefilter
 * uses the table's primary key, and the epoch range is applied in WHERE
 * because ClickHouse refuses an inequality between the two sides inside ON.
 */
function queueEpochInsertSQL({
  epochTable, speedTable, corridorTable,
  windowStart, windowEnd, queueSpeedMph,
  minConsecutive = DEFAULT_MIN_CONSECUTIVE_EPOCHS,
}) {
  if (!windowStart || !windowEnd) throw new Error('queueEpochInsertSQL: windowStart and windowEnd are required');
  const T = Number(queueSpeedMph);
  if (!Number.isFinite(T) || T <= 0) throw new Error('queueEpochInsertSQL: queueSpeedMph must be a positive number');
  if (Number(minConsecutive) !== 2) {
    // The window frame below looks one epoch either side; a different rule
    // needs a different frame, and nothing asked for one yet.
    throw new Error('queueEpochInsertSQL: only a two-consecutive-epoch rule is implemented');
  }
  return `
INSERT INTO ${epochTable}
WITH per_epoch AS (
  SELECT ca.wz_event_id AS wz_event_id,
         n.date AS date,
         toInt32(n.epoch) AS epoch,
         any(ca.n_ranks) AS n_ranks,
         any(ca.window_source) AS window_source,
         -- rank-sorted (rank, speed, miles, tmc, phed threshold); groupUniqArray
         -- collapses the duplicate a zone with two same-day shifts would create
         arraySort(x -> x.1, groupUniqArray((toUInt16(ca.rank),
                    toFloat64(ca.miles * 3600 / n.travel_time_all_vehicles),
                    toFloat64(ca.miles), ca.tmc, toFloat64(ca.phed_threshold_speed)))) AS seq
    FROM ${speedTable} n
   INNER JOIN ${corridorTable} ca ON ca.tmc = n.tmc AND ca.date = n.date
   WHERE n.date >= toDate('${windowStart}') AND n.date <= toDate('${windowEnd}')
     AND n.tmc IN (SELECT DISTINCT tmc FROM ${corridorTable})
     AND n.travel_time_all_vehicles > 0
     AND n.epoch >= ca.epoch_from AND n.epoch < ca.epoch_to
   GROUP BY wz_event_id, date, epoch
),
walked AS (
  SELECT wz_event_id, date, epoch, n_ranks, window_source,
         arrayMap(x -> x.1, seq) AS ranks,
         arrayMap(x -> x.2, seq) AS speeds,
         arrayMap(x -> x.3, seq) AS miles,
         arrayMap(x -> x.4, seq) AS tmcs,
         arrayMap(x -> x.5, seq) AS pheds,
         (length(ranks) > 0 AND toInt64(ranks[1]) = 0) AS anchor_observed,
         if(anchor_observed, speeds[1], 0.) AS anchor_speed,
         -- first array position where the chain breaks: a missing rank, or a
         -- segment at or above the threshold. 0 = never broke.
         -- explicit Int64 throughout: ClickHouse refuses to unify the UInt64 that
         -- length() returns with the Int64 a subtraction produces
         toInt64(arrayFirstIndex((r, s, i) -> (toInt64(r) != toInt64(i) - 1) OR NOT (s < ${T}), ranks, speeds, arrayEnumerate(ranks))) AS brk_abs,
         if(brk_abs = 0, toInt64(length(ranks)), brk_abs - 1) AS pre_abs,
         toInt64(arrayFirstIndex((r, s, p, i) -> (toInt64(r) != toInt64(i) - 1) OR NOT (p > 0 AND s < p), ranks, speeds, pheds, arrayEnumerate(ranks))) AS brk_phed,
         if(brk_phed = 0, toInt64(length(ranks)), brk_phed - 1) AS pre_phed
    FROM per_epoch
),
scored AS (
  SELECT wz_event_id, date, epoch, n_ranks, window_source, anchor_speed,
         toUInt16(length(ranks)) AS ranks_observed,
         pre_abs >= 1 AS raw_abs,
         pre_phed >= 1 AS raw_phed,
         -- upstream length = ranks 1..pre-1 = array positions 2..pre
         if(pre_abs >= 2, arraySum(arraySlice(miles, 2, pre_abs - 1)), 0.) AS up_len_abs,
         if(pre_phed >= 2, arraySum(arraySlice(miles, 2, pre_phed - 1)), 0.) AS up_len_phed,
         if(pre_abs >= 2, arrayStringConcat(arraySlice(tmcs, 2, pre_abs - 1), ' '), '') AS up_tmcs_abs,
         -- still queued when the observed segments ran out, or when the next
         -- rank was unobserved: the length is a lower bound
         (raw_abs AND (pre_abs = toInt64(length(ranks)) OR toInt64(ranks[pre_abs + 1]) != pre_abs)) AS lower_abs,
         (raw_phed AND (pre_phed = toInt64(length(ranks)) OR toInt64(ranks[pre_phed + 1]) != pre_phed)) AS lower_phed,
         (raw_abs AND pre_abs = toInt64(length(ranks)) AND toInt64(length(ranks)) = toInt64(n_ranks)) AS corridor_end_abs
    FROM walked
   WHERE anchor_observed
),
neighbors AS (
  SELECT *,
         lagInFrame(raw_abs) OVER w AS prev_abs, leadInFrame(raw_abs) OVER w AS next_abs,
         lagInFrame(raw_phed) OVER w AS prev_phed, leadInFrame(raw_phed) OVER w AS next_phed,
         lagInFrame(epoch) OVER w AS prev_epoch, leadInFrame(epoch) OVER w AS next_epoch
    FROM scored
  WINDOW w AS (PARTITION BY wz_event_id, date ORDER BY epoch ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING)
),
ruled AS (
  SELECT *,
         -- present only inside a run of two or more consecutive slow epochs
         (raw_abs AND ((prev_abs AND prev_epoch = epoch - 1) OR (next_abs AND next_epoch = epoch + 1))) AS queued_abs,
         (raw_phed AND ((prev_phed AND prev_epoch = epoch - 1) OR (next_phed AND next_epoch = epoch + 1))) AS queued_phed
    FROM neighbors
)
SELECT wz_event_id, date, epoch, window_source, n_ranks, ranks_observed, anchor_speed,
       toUInt8(raw_abs) AS raw_abs, toUInt8(raw_phed) AS raw_phed,
       toUInt8(queued_abs) AS queued_abs, toUInt8(queued_phed) AS queued_phed,
       if(queued_abs, up_len_abs, 0.) AS len_abs,
       if(queued_phed, up_len_phed, 0.) AS len_phed,
       if(queued_abs, up_tmcs_abs, '') AS tmcs_abs,
       toUInt8(queued_abs AND lower_abs) AS lower_abs,
       toUInt8(queued_phed AND lower_phed) AS lower_phed,
       toUInt8(queued_abs AND corridor_end_abs) AS corridor_end_abs
  FROM ruled`;
}

/** One row per (zone, date, hour of the clock): the wz_queue_hour evidence. */
function queueHourSQL({ epochTable }) {
  return `
SELECT wz_event_id, date, intDiv(epoch, ${EPOCHS_PER_HOUR}) AS hour,
       any(window_source) AS window_source,
       count() AS epochs_observed,
       countIf(raw_abs) AS epochs_anchor_below,
       countIf(queued_abs) AS epochs_queued,
       max(len_abs) AS max_queue_len_mi,
       avgIf(len_abs, queued_abs) AS mean_queue_len_mi,
       sum(len_abs) AS queue_mile_epochs,
       countIf(lower_abs) AS epochs_lower_bound,
       countIf(queued_phed) AS epochs_queued_phed,
       max(len_phed) AS max_queue_len_phed_mi,
       avg(anchor_speed) AS anchor_speed_mean,
       min(anchor_speed) AS anchor_speed_min
  FROM ${epochTable}
 GROUP BY wz_event_id, date, hour`;
}

/** One row per zone: the M3 statistics, except the longest run (queueRunsSQL). */
function queueZoneSQL({ epochTable }) {
  return `
SELECT wz_event_id,
       count() AS epochs_observed,
       countIf(window_source = '2799') AS epochs_2799,
       any(n_ranks) AS n_ranks,
       max(ranks_observed) AS max_ranks_observed,
       countIf(raw_abs) AS epochs_anchor_below,
       countIf(queued_abs) AS epochs_queued,
       max(len_abs) AS max_queue_len_mi,
       quantileExactIf(0.95)(len_abs, queued_abs) AS p95_queue_len_mi,
       avgIf(len_abs, queued_abs) AS mean_queue_len_mi,
       sum(len_abs) AS queue_mile_epochs,
       uniqExactIf((date, intDiv(epoch, ${EPOCHS_PER_HOUR})), queued_abs) AS hours_with_queue,
       countIf(lower_abs) AS epochs_lower_bound,
       countIf(corridor_end_abs) AS epochs_corridor_end,
       argMax(tmcs_abs, len_abs) AS max_queue_tmcs,
       argMax(date, len_abs) AS max_queue_date,
       argMax(epoch, len_abs) AS max_queue_epoch,
       countIf(queued_phed) AS epochs_queued_phed,
       max(len_phed) AS max_queue_len_phed_mi,
       quantileExactIf(0.95)(len_phed, queued_phed) AS p95_queue_len_phed_mi,
       avg(anchor_speed) AS anchor_speed_mean,
       min(anchor_speed) AS anchor_speed_min
  FROM ${epochTable}
 GROUP BY wz_event_id`;
}

/**
 * Longest run of consecutive queued epochs per zone. arraySplit breaks the
 * sorted epoch list wherever the step is not 1; the longest piece is the
 * duration of the longest continuous queue, in epochs.
 */
function queueRunsSQL({ epochTable }) {
  return `
SELECT wz_event_id,
       max(run_abs) AS longest_run_epochs,
       max(run_phed) AS longest_run_phed_epochs
  FROM (
    SELECT wz_event_id, date,
           arrayMax(arrayMap(a -> length(a), arraySplit((x, y) -> y != 1, ep, arrayDifference(ep)))) AS run_abs,
           arrayMax(arrayMap(a -> length(a), arraySplit((x, y) -> y != 1, ep2, arrayDifference(ep2)))) AS run_phed
      FROM (
        SELECT wz_event_id, date,
               arraySort(groupArrayIf(epoch, queued_abs)) AS ep,
               arraySort(groupArrayIf(epoch, queued_phed)) AS ep2
          FROM ${epochTable}
         GROUP BY wz_event_id, date))
 GROUP BY wz_event_id`;
}

// ── rollups ──────────────────────────────────────────────────────────────────

/**
 * Statewide M3 from the per-zone rows.
 *
 * Reported three ways because they answer different questions:
 *   pct_zones_exceeding  the rule's own shape — "percent of projects with a
 *                        queue over the threshold" (max queue over the window)
 *   pct_time_queued      hour-weighted: what share of all observed active time
 *                        had a queue present. Long zones dominate.
 *   mean_pct_time_queued zone-mean: how the typical zone did.
 * Plus the distribution of each zone's maximum queue, because phase 3 found
 * these distributions bimodal and a mean describes almost no zone.
 */
function rollupM3(zoneRows, { queueThresholdMi = 0.75 } = {}) {
  const measured = (zoneRows || []).filter((r) => r && Number(r.epochs_observed) > 0);
  const sum = (k) => measured.reduce((a, r) => a + (num(r[k]) || 0), 0);
  const observed = sum('epochs_observed');
  const share = (n, d) => (d > 0 ? round(n / d) : null);
  const withQueue = measured.filter((r) => Number(r.epochs_queued) > 0);
  const exceeding = measured.filter((r) => (num(r.max_queue_len_mi) || 0) > queueThresholdMi);
  const exceedingPhed = measured.filter((r) => (num(r.max_queue_len_phed_mi) || 0) > queueThresholdMi);
  const maxLens = measured.map((r) => num(r.max_queue_len_mi) || 0);
  const at = (arr, p) => {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    return round(s[Math.min(s.length - 1, Math.floor(p * s.length))]);
  };
  const pctTimes = measured.map((r) => Number(r.epochs_queued) / Number(r.epochs_observed)).filter(Number.isFinite);
  return {
    zones: measured.length,
    zones_unmeasured: (zoneRows || []).length - measured.length,
    epochs_observed: observed,
    active_hours_observed: round(observed / EPOCHS_PER_HOUR, 1),
    epochs_queued: sum('epochs_queued'),
    pct_time_queued: share(sum('epochs_queued'), observed),
    mean_pct_time_queued: pctTimes.length ? round(pctTimes.reduce((a, b) => a + b, 0) / pctTimes.length) : null,
    zones_with_queue: withQueue.length,
    pct_zones_with_queue: share(withQueue.length, measured.length),
    zones_exceeding: exceeding.length,
    pct_zones_exceeding: share(exceeding.length, measured.length),
    queue_threshold_mi: queueThresholdMi,
    queue_mile_hours: round(sum('queue_mile_hours'), 1),
    queue_hours: round(sum('epochs_queued') / EPOCHS_PER_HOUR, 1),
    epochs_lower_bound: sum('epochs_lower_bound'),
    max_len_dist: {
      zero: maxLens.filter((v) => v === 0).length,
      to_threshold: maxLens.filter((v) => v > 0 && v <= queueThresholdMi).length,
      to_1_5: maxLens.filter((v) => v > queueThresholdMi && v <= 1.5).length,
      to_3: maxLens.filter((v) => v > 1.5 && v <= 3).length,
      over_3: maxLens.filter((v) => v > 3).length,
      median_with_queue: at(withQueue.map((r) => num(r.max_queue_len_mi) || 0), 0.5),
      p90_with_queue: at(withQueue.map((r) => num(r.max_queue_len_mi) || 0), 0.9),
    },
    longest_run_min_max: measured.reduce((a, r) => Math.max(a, num(r.longest_queue_run_min) || 0), 0),
    // the road-scaled comparator
    epochs_queued_phed: sum('epochs_queued_phed'),
    pct_time_queued_phed: share(sum('epochs_queued_phed'), observed),
    zones_exceeding_phed: exceedingPhed.length,
    pct_zones_exceeding_phed: share(exceedingPhed.length, measured.length),
  };
}

/**
 * M3 per comparable universe — the same tiers phase 3 established, so the two
 * measures are read on the same populations. See lib/m1.js for why a single
 * statewide figure over 42k six-hour shifts matches no peer's reporting scope.
 *
 * @param zoneById  Map of wz_event_id -> { is_significant_candidate, is_interstate, span_hours }
 */
function rollupM3ByTier(rows, zoneById, opts = {}) {
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
    out[name] = rollupM3((rows || []).filter(pred), opts);
  }
  return out;
}

/** Calendar-month chunks covering [start, end], each as { start, end } 'YYYY-MM-DD'. */
function monthChunks(start, end) {
  const s = String(start).slice(0, 10); const e = String(end).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !/^\d{4}-\d{2}-\d{2}$/.test(e)) throw new Error('monthChunks: dates must be YYYY-MM-DD');
  if (s > e) throw new Error('monthChunks: start is after end');
  const out = [];
  let cur = new Date(`${s}T00:00:00Z`);
  const last = new Date(`${e}T00:00:00Z`);
  while (cur <= last) {
    const y = cur.getUTCFullYear(); const m = cur.getUTCMonth();
    const monthEnd = new Date(Date.UTC(y, m + 1, 0));
    const chunkEnd = monthEnd < last ? monthEnd : last;
    out.push({ start: cur.toISOString().slice(0, 10), end: chunkEnd.toISOString().slice(0, 10) });
    cur = new Date(Date.UTC(y, m + 1, 1));
  }
  return out;
}

module.exports = {
  EPOCHS_PER_HOUR,
  EPOCHS_PER_DAY,
  DEFAULT_QUEUE_MAX_REACH_MI,
  DEFAULT_QUEUE_MAX_UPSTREAM_TMCS,
  DEFAULT_QUEUE_MAX_GAP_MI,
  DEFAULT_MIN_CONSECUTIVE_EPOCHS,
  haversineMi,
  buildCorridor,
  queueForEpoch,
  applyConsecutiveRule,
  longestRun,
  corridorActiveDDL,
  queueEpochDDL,
  queueEpochInsertSQL,
  queueHourSQL,
  queueZoneSQL,
  queueRunsSQL,
  rollupM3,
  rollupM3ByTier,
  monthChunks,
};
