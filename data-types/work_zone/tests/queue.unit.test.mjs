/**
 * Unit tests for M3 — the queue walk as lib/queue.js defines it.
 *
 * The walk has four decisions that a reader would otherwise have to take on
 * faith: upstream is LOWER road_order; the anchor must itself be slow; an
 * unobserved segment ends the walk and marks the length a lower bound; and a
 * single slow five-minute sample is not a queue. Each is pinned here on a
 * synthetic corridor whose right answers are known by construction, and the
 * SQL builders are checked for the shapes that keep ClickHouse fast and the
 * semantics identical to the JavaScript reference.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_QUEUE_MAX_REACH_MI, DEFAULT_QUEUE_MAX_UPSTREAM_TMCS, DEFAULT_QUEUE_MAX_GAP_MI,
  DEFAULT_MIN_CONSECUTIVE_EPOCHS,
  haversineMi, buildCorridor, queueForEpoch, applyConsecutiveRule, longestRun, monthChunks,
  corridorActiveDDL, queueEpochDDL, queueEpochInsertSQL, queueHourSQL, queueZoneSQL, queueRunsSQL,
  rollupM3, rollupM3ByTier,
} from '../lib/queue.js';

// ── a synthetic westbound corridor ─────────────────────────────────────────
// Six segments on one latitude, laid end to start going west (longitude
// decreasing), each 0.5 mi long (≈ 0.00953° of longitude at 40.75°N). Order
// ascends with travel, so the anchor at order 10 is the DOWNSTREAM end and
// orders 9..5 are upstream of it.
const LAT = 40.75;
const DLON = 0.5 / (69.172 * Math.cos((LAT * Math.PI) / 180));   // ≈ degrees per 0.5 mi
function seg(tmc, order, eastLon, { miles = 0.5, limit = 55, lat = LAT } = {}) {
  // westbound: start at the eastern end, finish 0.5 mi further west
  return {
    tmc, road_order: order, miles, avg_speedlimit: limit,
    start_latitude: lat, start_longitude: eastLon,
    end_latitude: lat, end_longitude: eastLon - DLON * (miles / 0.5),
  };
}
const E0 = -73.70;
// anchor (order 10) starts at E0; order 9 ends where order 10 starts; and so on
const CORRIDOR = [
  seg('A10', 10, E0),
  seg('U09', 9, E0 + DLON),
  seg('U08', 8, E0 + 2 * DLON),
  seg('U07', 7, E0 + 3 * DLON),
  seg('U06', 6, E0 + 4 * DLON),
  seg('U05', 5, E0 + 5 * DLON),
];

describe('haversineMi', () => {
  it('knows Albany to New York is about 135 miles', () => {
    // great-circle: 134.6 mi
    expect(haversineMi(42.6526, -73.7562, 40.7128, -74.0060)).toBeCloseTo(134.6, 0);
  });
  it('is null when a coordinate is missing', () => {
    expect(haversineMi(null, -73, 40, -74)).toBeNull();
  });
  it('measures the synthetic segments at half a mile', () => {
    const s = CORRIDOR[0];
    expect(haversineMi(s.start_latitude, s.start_longitude, s.end_latitude, s.end_longitude)).toBeCloseTo(0.5, 2);
  });
});

describe('buildCorridor walks UPSTREAM, which is LOWER road_order', () => {
  const c = buildCorridor({ anchorTmc: 'A10', rows: CORRIDOR });

  it('puts the anchor at rank 0 and the next-lower order at rank 1', () => {
    expect(c.tmcs.map((t) => t.tmc)).toEqual(['A10', 'U09', 'U08', 'U07', 'U06', 'U05']);
    expect(c.tmcs.map((t) => t.rank)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(c.n_upstream_tmcs).toBe(5);
    expect(c.reach_mi).toBeCloseTo(2.5, 3);
    expect(c.end_reason).toBe('end_of_linear');
  });

  it('never walks to a HIGHER order than the anchor', () => {
    const rows = [...CORRIDOR, seg('D11', 11, E0 - DLON)];   // downstream of the anchor
    const c2 = buildCorridor({ anchorTmc: 'A10', rows });
    expect(c2.tmcs.map((t) => t.tmc)).not.toContain('D11');
  });

  it('measures the gap between each upstream segment and the one it feeds', () => {
    // contiguous by construction: every gap is ~0
    for (const t of c.tmcs.slice(1)) expect(t.gap_mi).toBeLessThan(0.01);
    expect(c.tmcs[0].gap_mi).toBe(0);
  });

  it('derives the PHED comparator threshold from the posted limit, floored at 20', () => {
    const rows = [seg('A10', 10, E0, { limit: 55 }), seg('U09', 9, E0 + DLON, { limit: 30 }), seg('U08', 8, E0 + 2 * DLON, { limit: null })];
    const c2 = buildCorridor({ anchorTmc: 'A10', rows });
    expect(c2.tmcs[0].phed_threshold_speed).toBeCloseTo(33, 5);
    expect(c2.tmcs[1].phed_threshold_speed).toBe(20);
    expect(c2.tmcs[2].phed_threshold_speed).toBe(0);   // unknown limit: the walk cannot call it slow
  });
});

describe('buildCorridor handles the inventory as it actually is', () => {
  it('keeps the LONGEST segment where two share a road_order (parallel ramp)', () => {
    const ramp = { ...seg('R08', 8, E0 + 2 * DLON, { miles: 0.05 }) };
    const c = buildCorridor({ anchorTmc: 'A10', rows: [...CORRIDOR, ramp] });
    expect(c.tmcs.map((t) => t.tmc)).toContain('U08');
    expect(c.tmcs.map((t) => t.tmc)).not.toContain('R08');
    expect(c.n_upstream_tmcs).toBe(5);
  });

  it('ignores a segment sharing the ANCHOR\'s own order', () => {
    const twin = seg('T10', 10, E0, { miles: 0.9 });   // longer, but not upstream
    const c = buildCorridor({ anchorTmc: 'A10', rows: [...CORRIDOR, twin] });
    expect(c.tmcs[0].tmc).toBe('A10');
    expect(c.tmcs.map((t) => t.tmc)).not.toContain('T10');
  });

  it('stops at a jump in the linear longer than the gap limit', () => {
    // move orders 6 and 5 two miles further east: the linear jumped
    const rows = CORRIDOR.map((s) => (s.road_order <= 6 ? seg(s.tmc, s.road_order, s.start_longitude + 4 * DLON) : s));
    const c = buildCorridor({ anchorTmc: 'A10', rows });
    expect(c.tmcs.map((t) => t.tmc)).toEqual(['A10', 'U09', 'U08', 'U07']);
    expect(c.end_reason).toBe('gap');
    expect(DEFAULT_QUEUE_MAX_GAP_MI).toBe(0.5);
  });

  it('cannot break the chain on UNKNOWN coordinates', () => {
    const rows = CORRIDOR.map((s) => ({ ...s, start_latitude: null, end_latitude: null }));
    const c = buildCorridor({ anchorTmc: 'A10', rows });
    expect(c.n_upstream_tmcs).toBe(5);
    expect(c.tmcs[1].gap_mi).toBeNull();
  });

  it('stops at the reach limit', () => {
    const c = buildCorridor({ anchorTmc: 'A10', rows: CORRIDOR, maxReachMi: 1.0 });
    expect(c.tmcs.map((t) => t.tmc)).toEqual(['A10', 'U09', 'U08']);
    expect(c.end_reason).toBe('reach');
    expect(DEFAULT_QUEUE_MAX_REACH_MI).toBe(10);
  });

  it('stops at the segment limit', () => {
    const c = buildCorridor({ anchorTmc: 'A10', rows: CORRIDOR, maxUpstreamTmcs: 2 });
    expect(c.n_upstream_tmcs).toBe(2);
    expect(c.end_reason).toBe('tmcs');
    expect(DEFAULT_QUEUE_MAX_UPSTREAM_TMCS).toBe(20);
  });

  it('reports no_meta when the anchor is not in the inventory', () => {
    const c = buildCorridor({ anchorTmc: 'ZZZ', rows: CORRIDOR });
    expect(c.tmcs).toEqual([]);
    expect(c.end_reason).toBe('no_meta');
  });

  it('is case-insensitive on the anchor id', () => {
    const c = buildCorridor({ anchorTmc: 'a10', rows: CORRIDOR });
    expect(c.tmcs[0].tmc).toBe('A10');
  });
});

describe('queueForEpoch — a moving queue on the six-segment corridor', () => {
  // Observations are (rank, speed, miles). Threshold 35 mph.
  const obs = (list) => list.map(([rank, speed, miles = 0.5]) => ({ rank, speed, miles, tmc: `R${rank}` }));
  const T = 35;

  it('has no queue when the anchor is free-flowing, whatever happens upstream', () => {
    const r = queueForEpoch(obs([[0, 52], [1, 20], [2, 18]]), T);
    expect(r.anchor_observed).toBe(true);
    expect(r.raw_present).toBe(false);
    expect(r.upstream_len_mi).toBe(0);
    expect(r.break_reason).toBe('anchor_free');
  });

  it('measures one slow upstream segment as half a mile', () => {
    const r = queueForEpoch(obs([[0, 20], [1, 25], [2, 60]]), T);
    expect(r.raw_present).toBe(true);
    expect(r.upstream_len_mi).toBeCloseTo(0.5, 4);
    expect(r.n_queued_upstream).toBe(1);
    expect(r.tmcs).toEqual(['R1']);
    expect(r.break_reason).toBe('fast');
    expect(r.lower_bound).toBe(false);
  });

  it('grows as the queue backs up', () => {
    const r = queueForEpoch(obs([[0, 20], [1, 25], [2, 30, 0.7], [3, 55]]), T);
    expect(r.upstream_len_mi).toBeCloseTo(1.2, 4);
    expect(r.tmcs).toEqual(['R1', 'R2']);
  });

  it('does NOT count the anchor\'s own length', () => {
    const r = queueForEpoch(obs([[0, 20, 2.9], [1, 25, 0.5], [2, 60]]), T);
    expect(r.upstream_len_mi).toBeCloseTo(0.5, 4);
  });

  it('stops at an UNOBSERVED segment and marks the length a lower bound', () => {
    // rank 2 missing; rank 3 slow but unreachable
    const r = queueForEpoch(obs([[0, 20], [1, 25], [3, 20]]), T);
    expect(r.upstream_len_mi).toBeCloseTo(0.5, 4);
    expect(r.break_reason).toBe('gap');
    expect(r.lower_bound).toBe(true);
  });

  it('marks a queue that reaches the end of the corridor a lower bound too', () => {
    const r = queueForEpoch(obs([[0, 20], [1, 25], [2, 22], [3, 19], [4, 24], [5, 30]]), T);
    expect(r.upstream_len_mi).toBeCloseTo(2.5, 4);
    expect(r.break_reason).toBe('end');
    expect(r.lower_bound).toBe(true);
  });

  it('is unobserved when the anchor has no sample, even if upstream is slow', () => {
    const r = queueForEpoch(obs([[1, 20], [2, 18]]), T);
    expect(r.anchor_observed).toBe(false);
    expect(r.raw_present).toBe(false);
    expect(r.break_reason).toBe('unobserved');
  });

  it('treats a speed EQUAL to the threshold as not slow', () => {
    expect(queueForEpoch(obs([[0, 35]]), T).raw_present).toBe(false);
    expect(queueForEpoch(obs([[0, 34.9]]), T).raw_present).toBe(true);
  });

  it('accepts a per-segment threshold, for the PHED comparator', () => {
    const rows = [
      { rank: 0, speed: 30, miles: 0.5, tmc: 'R0', phed: 33 },   // 55 mph road: slow
      { rank: 1, speed: 30, miles: 0.5, tmc: 'R1', phed: 20 },   // 30 mph street: not slow
    ];
    const r = queueForEpoch(rows, (o) => o.phed);
    expect(r.raw_present).toBe(true);
    expect(r.upstream_len_mi).toBe(0);
    expect(r.break_reason).toBe('fast');
  });

  it('refuses to call a segment slow when its threshold is unknown (0)', () => {
    const rows = [{ rank: 0, speed: 10, miles: 0.5, tmc: 'R0', phed: 0 }];
    expect(queueForEpoch(rows, (o) => o.phed).raw_present).toBe(false);
  });

  it('sorts observations by rank however they arrive', () => {
    const r = queueForEpoch(obs([[2, 60], [0, 20], [1, 25]]), T);
    expect(r.upstream_len_mi).toBeCloseTo(0.5, 4);
  });
});

describe('the consecutive-epoch rule', () => {
  const rows = [
    { epoch: 10, raw_present: true },
    { epoch: 11, raw_present: false },
    { epoch: 12, raw_present: true },
    { epoch: 13, raw_present: true },
    { epoch: 20, raw_present: true },
  ];

  it('drops an isolated slow epoch and keeps a pair', () => {
    expect(DEFAULT_MIN_CONSECUTIVE_EPOCHS).toBe(2);
    const p = applyConsecutiveRule(rows);
    expect(p.get(10)).toBe(false);
    expect(p.get(11)).toBe(false);
    expect(p.get(12)).toBe(true);
    expect(p.get(13)).toBe(true);
    expect(p.get(20)).toBe(false);
  });

  it('is the identity at one, and stricter at three', () => {
    const one = applyConsecutiveRule(rows, { minConsecutive: 1 });
    expect([...one.values()].filter(Boolean).length).toBe(4);
    const three = applyConsecutiveRule(rows, { minConsecutive: 3 });
    expect([...three.values()].some(Boolean)).toBe(false);
  });

  it('longestRun counts consecutive epochs', () => {
    expect(longestRun([1, 2, 3, 7, 8, 20, 21, 22, 23])).toBe(4);
    expect(longestRun([])).toBe(0);
    expect(longestRun([5])).toBe(1);
    expect(longestRun([3, 3, 4])).toBe(2);
  });
});

describe('monthChunks', () => {
  it('splits a window on calendar months and keeps the ends', () => {
    expect(monthChunks('2024-01-15', '2024-03-02')).toEqual([
      { start: '2024-01-15', end: '2024-01-31' },
      { start: '2024-02-01', end: '2024-02-29' },
      { start: '2024-03-01', end: '2024-03-02' },
    ]);
  });
  it('is one chunk for one day', () => {
    expect(monthChunks('2024-07-13', '2024-07-13')).toEqual([{ start: '2024-07-13', end: '2024-07-13' }]);
  });
  it('rejects a reversed or malformed window', () => {
    expect(() => monthChunks('2024-02-01', '2024-01-01')).toThrow(/after/);
    expect(() => monthChunks('2024/02/01', '2024-03-01')).toThrow(/YYYY-MM-DD/);
  });
});

describe('the ClickHouse walk mirrors the reference', () => {
  const args = {
    epochTable: 'npmrds._wz_qepoch_x', speedTable: 'npmrds.speeds', corridorTable: 'npmrds._wz_qcorr_x',
    windowStart: '2024-07-01', windowEnd: '2024-07-31', queueSpeedMph: 35,
  };
  const q = queueEpochInsertSQL(args);

  it('keeps the huge speed table on the LEFT of the join and prefilters by primary key', () => {
    expect(q).toMatch(/FROM npmrds\.speeds n\s*\n\s*INNER JOIN npmrds\._wz_qcorr_x ca ON ca\.tmc = n\.tmc AND ca\.date = n\.date/);
    expect(q).toContain('n.tmc IN (SELECT DISTINCT tmc FROM npmrds._wz_qcorr_x)');
  });

  it('bounds the date and treats the epoch window as half-open', () => {
    expect(q).toContain("n.date >= toDate('2024-07-01') AND n.date <= toDate('2024-07-31')");
    expect(q).toContain('n.epoch >= ca.epoch_from AND n.epoch < ca.epoch_to');
  });

  it('breaks the chain on a missing rank OR a segment at/above threshold', () => {
    expect(q).toContain('arrayFirstIndex((r, s, i) -> (toInt64(r) != toInt64(i) - 1) OR NOT (s < 35), ranks, speeds, arrayEnumerate(ranks))');
    // the PHED walk uses each segment's own threshold, and 0 means unknown
    expect(q).toContain('NOT (p > 0 AND s < p)');
  });

  it('sums UPSTREAM length only — array positions from 2', () => {
    expect(q).toContain('arraySlice(miles, 2, pre_abs - 1)');
    expect(q).toContain('arraySlice(tmcs, 2, pre_abs - 1)');
  });

  it('requires the anchor to be observed and marks lower bounds', () => {
    expect(q).toContain('(length(ranks) > 0 AND toInt64(ranks[1]) = 0) AS anchor_observed');
    expect(q).toContain('WHERE anchor_observed');
    expect(q).toContain('toInt64(ranks[pre_abs + 1]) != pre_abs');
  });

  it('applies the two-consecutive-epoch rule with a one-epoch frame either side', () => {
    expect(q).toContain('WINDOW w AS (PARTITION BY wz_event_id, date ORDER BY epoch ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING)');
    expect(q).toContain('(prev_abs AND prev_epoch = epoch - 1) OR (next_abs AND next_epoch = epoch + 1)');
  });

  it('collapses duplicate observations from same-day double shifts', () => {
    expect(q).toContain('groupUniqArray(');
  });

  it('takes the threshold as a parameter and validates it', () => {
    expect(queueEpochInsertSQL({ ...args, queueSpeedMph: 45 })).toContain('NOT (s < 45)');
    expect(() => queueEpochInsertSQL({ ...args, queueSpeedMph: 0 })).toThrow(/positive/);
    expect(() => queueEpochInsertSQL({ ...args, windowStart: null })).toThrow(/windowStart/);
    expect(() => queueEpochInsertSQL({ ...args, minConsecutive: 3 })).toThrow(/two-consecutive/);
  });

  it('stages corridor days keyed (tmc, date) in Memory, and a per-epoch table', () => {
    const ddl = corridorActiveDDL({ database: 'npmrds', table: '_wz_qcorr_x' });
    expect(ddl).toContain('ENGINE = Memory');
    for (const c of ['wz_event_id', 'tmc', 'rank', 'n_ranks', 'miles', 'phed_threshold_speed', 'date', 'epoch_from', 'epoch_to', 'window_source']) {
      expect(ddl).toContain(c);
    }
    const e = queueEpochDDL({ database: 'npmrds', table: '_wz_qepoch_x' });
    for (const c of ['queued_abs', 'queued_phed', 'len_abs', 'len_phed', 'tmcs_abs', 'lower_abs', 'corridor_end_abs']) {
      expect(e).toContain(c);
    }
  });

  it('aggregates per clock hour and per zone, with the 95th percentile and the max-queue extent', () => {
    const h = queueHourSQL({ epochTable: 'e' });
    expect(h).toContain('intDiv(epoch, 12) AS hour');
    expect(h).toContain('GROUP BY wz_event_id, date, hour');
    const z = queueZoneSQL({ epochTable: 'e' });
    expect(z).toContain('quantileExactIf(0.95)(len_abs, queued_abs)');
    expect(z).toContain('argMax(tmcs_abs, len_abs) AS max_queue_tmcs');
    expect(z).toContain('uniqExactIf((date, intDiv(epoch, 12)), queued_abs) AS hours_with_queue');
    expect(z).toContain('GROUP BY wz_event_id');
  });

  it('finds the longest run by splitting the sorted epoch list where the step is not 1', () => {
    const r = queueRunsSQL({ epochTable: 'e' });
    expect(r).toContain('arraySplit((x, y) -> y != 1, ep, arrayDifference(ep))');
    expect(r).toContain('arraySort(groupArrayIf(epoch, queued_abs)) AS ep');
    expect(r).toContain('max(run_abs) AS longest_run_epochs');
  });
});

describe('rollupM3', () => {
  const rows = [
    { wz_event_id: 'A', epochs_observed: 100, epochs_queued: 50, max_queue_len_mi: 1.2, max_queue_len_phed_mi: 0.5,
      epochs_queued_phed: 20, queue_mile_hours: 3, epochs_lower_bound: 4, longest_queue_run_min: 45 },
    { wz_event_id: 'B', epochs_observed: 200, epochs_queued: 0, max_queue_len_mi: 0, max_queue_len_phed_mi: 0,
      epochs_queued_phed: 0, queue_mile_hours: 0, epochs_lower_bound: 0, longest_queue_run_min: 0 },
    { wz_event_id: 'C', epochs_observed: 0, epochs_queued: null, max_queue_len_mi: null },
  ];
  const r = rollupM3(rows);

  it('aggregates measured zones only and counts the rest', () => {
    expect(r.zones).toBe(2);
    expect(r.zones_unmeasured).toBe(1);
    expect(r.epochs_observed).toBe(300);
  });

  it('hour-weights the share of time queued and also reports the zone mean', () => {
    expect(r.pct_time_queued).toBeCloseTo(50 / 300, 4);
    expect(r.mean_pct_time_queued).toBeCloseTo(0.25, 4);
  });

  it('reports the rule\'s own shape: percent of zones over the threshold', () => {
    expect(r.zones_exceeding).toBe(1);
    expect(r.pct_zones_exceeding).toBeCloseTo(0.5, 4);
    expect(r.queue_threshold_mi).toBe(0.75);
    expect(r.zones_with_queue).toBe(1);
  });

  it('buckets each zone\'s maximum queue', () => {
    expect(r.max_len_dist.zero).toBe(1);
    expect(r.max_len_dist.to_1_5).toBe(1);
    expect(r.max_len_dist.median_with_queue).toBeCloseTo(1.2, 4);
  });

  it('carries the comparator and the lower-bound count', () => {
    expect(r.zones_exceeding_phed).toBe(0);
    expect(r.pct_time_queued_phed).toBeCloseTo(20 / 300, 4);
    expect(r.epochs_lower_bound).toBe(4);
    expect(r.queue_mile_hours).toBe(3);
    expect(r.longest_run_min_max).toBe(45);
  });

  it('takes the threshold as a parameter', () => {
    expect(rollupM3(rows, { queueThresholdMi: 1.5 }).zones_exceeding).toBe(0);
  });

  it('rolls up per tier with each tier\'s own zone count', () => {
    const meta = new Map([
      ['A', { is_significant_candidate: true, is_interstate: true, span_hours: 200 }],
      ['B', { is_significant_candidate: false, is_interstate: false, span_hours: 6 }],
      ['C', { is_significant_candidate: false, is_interstate: true, span_hours: 6 }],
    ]);
    const t = rollupM3ByTier(rows, meta);
    expect(t.all.zones).toBe(2);
    expect(t.significant.zones).toBe(1);
    expect(t.significant.pct_zones_exceeding).toBe(1);
    expect(t.week_plus.zones).toBe(1);
    expect(t.not_interstate.zones).toBe(1);
    expect(t.not_interstate.pct_zones_exceeding).toBe(0);
    expect(t.week_hours).toBe(168);
  });
});
