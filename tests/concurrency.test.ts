import { describe, it, expect } from 'vitest';
import { createTaskPool } from '../src/lib/concurrency';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

describe('createTaskPool', () => {
  it('never runs more than `limit` tasks at once', async () => {
    let active = 0, maxActive = 0;
    const pool = createTaskPool<number>(3);
    for (let i = 0; i < 10; i++) {
      pool.push(i, async () => {
        active++; maxActive = Math.max(maxActive, active);
        await delay(15);
        active--;
        return 1;
      });
    }
    await pool.drain();
    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it('returns results keyed by push index regardless of completion order', async () => {
    // index 0 is slowest, index 4 is fastest — results must still be index-ordered.
    const pool = createTaskPool<number>(5);
    [50, 5, 20, 5, 1].forEach((ms, i) => pool.push(i, async () => { await delay(ms); return ms; }));
    expect(await pool.drain()).toEqual([50, 5, 20, 5, 1]);
  });

  it('reports each result via onEach as it lands, not after the whole batch', async () => {
    const arrival: number[] = [];
    const pool = createTaskPool<number>(3, (r) => { if (r !== null) arrival.push(r); });
    [50, 5, 20].forEach((ms, i) => pool.push(i, async () => { await delay(ms); return i; }));
    await pool.drain();
    // fastest (index 1, 5ms) should be reported before the slowest (index 0, 50ms)
    expect(arrival[0]).toBe(1);
    expect(arrival[arrival.length - 1]).toBe(0);
  });

  it('accepts pushes WHILE earlier tasks are already running — the pipelining contract', async () => {
    // The whole reason this exists: work arrives over time (dishes streaming in).
    // Task 0 starts immediately; task 1 is pushed only after task 0 has begun,
    // and both must complete under one drain.
    const started: number[] = [];
    const pool = createTaskPool<number>(2);
    pool.push(0, async () => { started.push(0); await delay(20); return 0; });
    await delay(5); // task 0 is now in flight
    expect(started).toEqual([0]);
    pool.push(1, async () => { started.push(1); return 1; });
    expect(await pool.drain()).toEqual([0, 1]);
    expect(started).toEqual([0, 1]);
  });

  it('one task failing does not stop or corrupt the others', async () => {
    const pool = createTaskPool<number>(4);
    [1, 2, 3, 4].forEach((n, i) => pool.push(i, async () => {
      if (n === 2) throw new Error('boom');
      return n * 10;
    }));
    expect(await pool.drain()).toEqual([10, null, 30, 40]);
  });

  it('calls onEach with the error for a failed task, and null for its result', async () => {
    const errors: unknown[] = [];
    const pool = createTaskPool<number>(2, (r, i, err) => { if (err) errors.push(err); });
    [1, 2].forEach((n, i) => pool.push(i, async () => {
      if (n === 2) throw new Error('boom');
      return n;
    }));
    await pool.drain();
    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toBe('boom');
  });

  it('drain with nothing ever pushed resolves immediately with []', async () => {
    expect(await createTaskPool<number>(5).drain()).toEqual([]);
  });

  it('fills index holes with null (sparse pushes stay merge-safe)', async () => {
    // A caller may push only some indices (e.g. appended duplicates skipped) —
    // consumers index the results array positionally, so gaps must read null,
    // never undefined.
    const pool = createTaskPool<number>(2);
    pool.push(0, async () => 10);
    pool.push(2, async () => 30);
    expect(await pool.drain()).toEqual([10, null, 30]);
  });

  it('a push after drain() is dropped, never resurrecting the pool', async () => {
    const pool = createTaskPool<number>(2);
    pool.push(0, async () => 1);
    const results = await pool.drain();
    let ran = false;
    pool.push(1, async () => { ran = true; return 2; });
    await delay(10);
    expect(ran).toBe(false);
    expect(results).toEqual([1]);
  });
});
