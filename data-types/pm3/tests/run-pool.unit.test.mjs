/**
 * runPool underpins the concurrent per-TMC phase. Its contract matters more
 * than usual because a bug here either (a) silently drops TMCs, producing a
 * quietly-incomplete published year, or (b) exceeds the pg pool and stalls.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { runPool, DEFAULT_CONCURRENCY, MAX_CONCURRENCY } = require('../worker.js');

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

describe('runPool', () => {
  it('processes every item exactly once, with the right index', async () => {
    const items = Array.from({ length: 50 }, (_, i) => `tmc-${i}`);
    const seen = [];
    await runPool(items, 8, async (item, idx) => {
      await tick(1);
      seen.push([item, idx]);
    });
    expect(seen).toHaveLength(items.length);
    expect(seen.map(([it]) => it).sort()).toEqual([...items].sort());
    for (const [item, idx] of seen) expect(items[idx]).toBe(item);
  });

  it('never exceeds the requested width', async () => {
    let inFlight = 0;
    let peak = 0;
    await runPool(Array.from({ length: 40 }), 5, async () => {
      peak = Math.max(peak, ++inFlight);
      await tick(2);
      inFlight--;
    });
    expect(peak).toBe(5);
  });

  it('keeps slots busy rather than waiting on a slow item (not chunked)', async () => {
    // One very slow item must not stop the other 3 workers from draining the
    // queue — the failure mode of a naive chunked Promise.all.
    const order = [];
    await runPool([0, 1, 2, 3, 4, 5, 6, 7], 4, async (n) => {
      await tick(n === 0 ? 60 : 2);
      order.push(n);
    });
    // the slow item finishes last despite being first in the list
    expect(order[order.length - 1]).toBe(0);
    expect(order).toHaveLength(8);
  });

  it('does not start more items after the first error, and rethrows it', async () => {
    const started = [];
    const boom = new Error('calculator exploded');
    await expect(runPool(Array.from({ length: 100 }, (_, i) => i), 4, async (n) => {
      started.push(n);
      await tick(1);
      if (n === 3) throw boom;
    })).rejects.toThrow('calculator exploded');
    // must abort early rather than grind through all 100
    expect(started.length).toBeLessThan(100);
  });

  it('waits for in-flight work to settle before rethrowing', async () => {
    let settled = 0;
    await runPool([1, 2, 3, 4], 4, async (n) => {
      await tick(5);
      settled++;
      if (n === 1) throw new Error('x');
    }).catch(() => {});
    // the other three finished rather than being orphaned mid-write
    expect(settled).toBe(4);
  });

  it('handles an empty list and a width larger than the list', async () => {
    let calls = 0;
    await runPool([], 8, async () => { calls++; });
    expect(calls).toBe(0);
    await runPool(['a'], 8, async () => { calls++; });
    expect(calls).toBe(1);
  });

  it('caps the default at the pg pool size', () => {
    // pg defaults to max 10 connections; above that, workers queue on
    // pool.connect() instead of doing work.
    expect(DEFAULT_CONCURRENCY).toBeLessThanOrEqual(MAX_CONCURRENCY);
    expect(MAX_CONCURRENCY).toBeLessThan(10);
  });
});
