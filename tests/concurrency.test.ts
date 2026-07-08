import { describe, it, expect } from 'vitest';
import { mapWithConcurrency } from '../src/lib/concurrency';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

describe('mapWithConcurrency', () => {
  it('never runs more than `limit` workers at once', async () => {
    let active = 0, maxActive = 0;
    await mapWithConcurrency(Array.from({ length: 10 }), 3, async () => {
      active++; maxActive = Math.max(maxActive, active);
      await delay(15);
      active--;
      return 1;
    });
    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it('returns results in the ORIGINAL index order regardless of completion order', async () => {
    // item 0 is slowest, item 4 is fastest — results array must still be index-ordered.
    const items = [50, 5, 20, 5, 1];
    const results = await mapWithConcurrency(items, 5, async (ms) => { await delay(ms); return ms; });
    expect(results).toEqual([50, 5, 20, 5, 1]);
  });

  it('reports each result via onEach as it lands, not after the whole batch', async () => {
    const arrival: number[] = [];
    await mapWithConcurrency([50, 5, 20], 3, async (ms, i) => { await delay(ms); return i; }, (r) => {
      if (r !== null) arrival.push(r);
    });
    // fastest (index 1, 5ms) should be reported before the slowest (index 0, 50ms)
    expect(arrival[0]).toBe(1);
    expect(arrival[arrival.length - 1]).toBe(0);
  });

  it('one worker failing does not stop or corrupt the others', async () => {
    const results = await mapWithConcurrency([1, 2, 3, 4], 4, async (n) => {
      if (n === 2) throw new Error('boom');
      return n * 10;
    });
    expect(results).toEqual([10, null, 30, 40]);
  });

  it('calls onEach with the error for a failed item, and null for its result', async () => {
    const errors: unknown[] = [];
    await mapWithConcurrency([1, 2], 2, async (n) => {
      if (n === 2) throw new Error('boom');
      return n;
    }, (r, i, err) => { if (err) errors.push(err); });
    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toBe('boom');
  });

  it('handles an empty list', async () => {
    expect(await mapWithConcurrency([], 5, async () => 1)).toEqual([]);
  });

  it('handles limit larger than the item count', async () => {
    const results = await mapWithConcurrency([1, 2], 50, async (n) => n);
    expect(results).toEqual([1, 2]);
  });
});
