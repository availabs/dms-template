/**
 * Unit tests for work_zone chain collapse.
 *
 * The behaviours that matter: a recurring series becomes ONE work zone, a long
 * silence starts a new one, an unknown lane count never reads as zero, and the
 * consecutive-day run that significance depends on is counted over closure days
 * only.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MAX_GAP_DAYS, stemDescription, chainKey, longestConsecutiveRun, collapseChains,
} from '../lib/dedupe.js';

/** One nightly occurrence on 2024-03-<day>. */
const occ = (id, day, over = {}) => ({
  event_id: id,
  facility: 'I-81',
  direction: 'SOUTHBOUND',
  county_name: 'ONONDAGA',
  region_name: 'Region 03 - Syracuse',
  description: 'Construction, milling on I-81 southbound between Exit 24 and Exit 25',
  start_date_time: `2024-03-${String(day).padStart(2, '0')}T21:00:00Z`,
  close_date: `2024-03-${String(day).padStart(2, '0')}T05:00:00Z`,
  lanes_total_count: 3,
  lanes_affected_count: 1,
  estimated_duration_mins: 480,
  ...over,
});

describe('longestConsecutiveRun', () => {
  it('counts the longest run of consecutive days', () => {
    expect(longestConsecutiveRun([1, 2, 3, 7, 8])).toBe(3);
    expect(longestConsecutiveRun([5])).toBe(1);
    expect(longestConsecutiveRun([])).toBe(0);
  });
  it('is insensitive to order and duplicates', () => {
    expect(longestConsecutiveRun([8, 7, 2, 1, 3, 3, 2])).toBe(3);
  });
});

describe('chainKey', () => {
  it('is the same for two occurrences of one series', () => {
    expect(chainKey(occ('a', 1))).toBe(chainKey(occ('b', 2)));
  });
  it('separates different facilities, directions, counties and descriptions', () => {
    const base = chainKey(occ('a', 1));
    expect(chainKey(occ('a', 1, { facility: 'I-690' }))).not.toBe(base);
    expect(chainKey(occ('a', 1, { direction: 'NORTHBOUND' }))).not.toBe(base);
    expect(chainKey(occ('a', 1, { county_name: 'ERIE' }))).not.toBe(base);
    expect(chainKey(occ('a', 1, { description: 'different work' }))).not.toBe(base);
  });
  it('normalises case and whitespace but keeps exit numbers apart', () => {
    expect(chainKey(occ('a', 1, { facility: ' i-81  ' }))).toBe(chainKey(occ('b', 2)));
    expect(chainKey(occ('a', 1, { description: 'work between Exit 24 and 25' })))
      .not.toBe(chainKey(occ('b', 2, { description: 'work between Exit 30 and 31' })));
  });
  it('falls back to primary_direction when direction is absent', () => {
    const a = chainKey({ facility: 'I-81', primary_direction: 'SB', county_name: 'X', description: 'd' });
    const b = chainKey({ facility: 'I-81', direction: 'SB', county_name: 'X', description: 'd' });
    expect(a).toBe(b);
  });
});

describe('stemDescription (opt-in)', () => {
  it('removes embedded dates and clock times', () => {
    expect(stemDescription('Paving 3/15 from 9 PM to 5 AM')).toBe('PAVING FROM TO');
    expect(stemDescription('Work Mar 15, 2024 overnight')).toBe('WORK OVERNIGHT');
  });
  it('keeps exit and route numbers, which distinguish work zones', () => {
    expect(stemDescription('milling on I-81 between Exit 24 and Exit 25'))
      .toContain('EXIT 24');
    expect(stemDescription('milling on I-81 between Exit 24 and Exit 25'))
      .toContain('I-81');
  });
  it('is not used by chainKey unless asked for', () => {
    const withDate = occ('a', 1, { description: 'Paving on 3/15' });
    const withOther = occ('b', 2, { description: 'Paving on 3/16' });
    expect(chainKey(withDate)).not.toBe(chainKey(withOther));
    expect(chainKey(withDate, { stemDescription: true })).toBe(chainKey(withOther, { stemDescription: true }));
  });
});

describe('collapseChains', () => {
  it('collapses a nightly series into one work zone', () => {
    const out = collapseChains([occ('a', 1), occ('b', 2), occ('c', 3)]);
    expect(out).toHaveLength(1);
    expect(out[0].wz_event_id).toBe('a');            // earliest member, traceable
    expect(out[0].n_occurrences).toBe(3);
    expect(out[0].member_event_ids).toEqual(['a', 'b', 'c']);
    expect(out[0].active_days).toBe(3);
    expect(out[0].consecutive_closure_days).toBe(3);
  });

  it('splits when the chain goes quiet for longer than maxGapDays', () => {
    expect(DEFAULT_MAX_GAP_DAYS).toBe(14);
    const out = collapseChains([occ('a', 1), occ('b', 2), occ('z', 25)]);
    expect(out).toHaveLength(2);
    expect(out.map((w) => w.n_occurrences)).toEqual([2, 1]);
  });

  it('does not split inside the gap threshold', () => {
    expect(collapseChains([occ('a', 1), occ('b', 14)])).toHaveLength(1);
    expect(collapseChains([occ('a', 1), occ('b', 16)])).toHaveLength(2);
  });

  it('honours a caller-supplied gap', () => {
    expect(collapseChains([occ('a', 1), occ('b', 5)], { maxGapDays: 2 })).toHaveLength(2);
    expect(collapseChains([occ('a', 1), occ('b', 5)], { maxGapDays: 10 })).toHaveLength(1);
  });

  it('keeps separate series separate', () => {
    const out = collapseChains([occ('a', 1), occ('b', 2), occ('x', 1, { facility: 'I-690' })]);
    expect(out).toHaveLength(2);
  });

  it('treats an absent lane count as unknown, never as zero', () => {
    const out = collapseChains([
      occ('a', 1, { lanes_affected_count: null }),
      occ('b', 2, { lanes_affected_count: null }),
    ]);
    expect(out[0].lanes_affected).toBeNull();
    expect(out[0].lanes_affected_known).toBe(false);
    // no known closure day → no consecutive closure run, but activity is still counted
    expect(out[0].consecutive_closure_days).toBe(0);
    expect(out[0].consecutive_active_days).toBe(2);
  });

  it('counts consecutive CLOSURE days only over days that closed a lane', () => {
    const out = collapseChains([
      occ('a', 1, { lanes_affected_count: 1 }),
      occ('b', 2, { lanes_affected_count: null }),
      occ('c', 3, { lanes_affected_count: 1 }),
      occ('d', 4, { lanes_affected_count: 1 }),
    ]);
    expect(out[0].consecutive_active_days).toBe(4);
    expect(out[0].consecutive_closure_days).toBe(2);   // days 3-4
  });

  it('unions the window and sums the members hours', () => {
    const out = collapseChains([occ('a', 1), occ('b', 2), occ('c', 3)]);
    expect(out[0].first_start).toBe('2024-03-01 21:00:00');
    expect(out[0].active_hours).toBe(24);              // 3 × 480 min
    expect(out[0].lanes_total).toBe(3);
  });

  it('is deterministic regardless of input order', () => {
    const a = collapseChains([occ('a', 1), occ('b', 2), occ('c', 3)]);
    const b = collapseChains([occ('c', 3), occ('a', 1), occ('b', 2)]);
    expect(b).toEqual(a);
  });

  it('handles a single event and an empty batch', () => {
    expect(collapseChains([occ('a', 1)])).toHaveLength(1);
    expect(collapseChains([])).toEqual([]);
  });
});

describe('timestamps stay in the source\'s own clock', () => {
  // Regression: TRANSCOM timestamps are naive local times, and the pg driver
  // hands them back as Dates in the process timezone. An earlier version called
  // .toISOString() on those, storing every work zone 4–5 hours late — a zone
  // starting 2024-12-31 23:39 was written as 2025-01-01 04:39, which pushed it
  // out of its own year and would have corrupted phase 3's hour-of-day work.
  const naive = (id, ts) => ({
    event_id: id, facility: 'I-81', direction: 'SB', county_name: 'ONONDAGA',
    description: 'work', work_activity_class: 'construction',
    start_date_time: ts, close_date: ts,
    lanes_affected_count: 1, estimated_duration_mins: 60,
  });

  it('emits the wall-clock time it was given, unshifted', () => {
    const out = collapseChains([naive('a', '2024-12-31 23:39:25')]);
    expect(out[0].first_start).toBe('2024-12-31 23:39:25');
    expect(out[0].last_end).toBe('2024-12-31 23:39:25');
  });

  it('keeps a late-night event inside its own calendar day', () => {
    const out = collapseChains([naive('a', '2024-12-31 23:00:00'), naive('b', '2024-12-31 23:30:00')]);
    expect(out).toHaveLength(1);
    expect(out[0].first_start.slice(0, 10)).toBe('2024-12-31');
    expect(out[0].active_days).toBe(1);
  });

  it('counts consecutive days on the source clock, not a shifted one', () => {
    // 22:00 on three consecutive nights is a 3-day run; under a +5h shift the
    // first two would land on the following days and the run would still be 3,
    // but the DAYS would be wrong — assert the dates themselves.
    const out = collapseChains([
      naive('a', '2024-03-01 22:00:00'), naive('b', '2024-03-02 22:00:00'), naive('c', '2024-03-03 22:00:00'),
    ]);
    expect(out[0].consecutive_closure_days).toBe(3);
    expect(out[0].first_start).toBe('2024-03-01 22:00:00');
  });
});

describe('activity class is part of chain identity', () => {
  it('does not merge two activities that share a templated description', () => {
    // TRANSCOM descriptions are templated, so this collision is real, not contrived.
    const construction = occ('a', 1, { work_activity_class: 'construction' });
    const plowing = occ('p', 1, { work_activity_class: 'winter_operations' });
    expect(chainKey(construction)).not.toBe(chainKey(plowing));
    expect(collapseChains([construction, plowing])).toHaveLength(2);
  });
  it('still merges occurrences of the same activity', () => {
    const a = occ('a', 1, { work_activity_class: 'construction' });
    const b = occ('b', 2, { work_activity_class: 'construction' });
    expect(collapseChains([a, b])).toHaveLength(1);
  });
});
