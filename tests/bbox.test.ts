import { describe, it, expect } from 'vitest';
import { normalizeBox, analyzeGrounding, groundingUsable } from '../src/lib/bbox';

describe('normalizeBox — coordinate convention traps', () => {
  it('accepts 0-1000 integers (the convention we prompt for)', () => {
    const r = normalizeBox([100, 200, 400, 260]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.box.x).toBeCloseTo(0.1);
      expect(r.box.y).toBeCloseTo(0.2);
      expect(r.box.w).toBeCloseTo(0.3);
      expect(r.box.h).toBeCloseTo(0.06);
    }
  });

  it('accepts already-normalized 0-1 floats', () => {
    const r = normalizeBox([0.1, 0.2, 0.4, 0.26]);
    expect(r.ok && r.box.w > 0.29 && r.box.w < 0.31).toBe(true);
  });

  it('accepts pixel coordinates only when image dimensions are known', () => {
    const withDims = normalizeBox([300, 600, 1200, 780], { w: 3000, h: 3000 });
    expect(withDims.ok).toBe(true);
    const withoutDims = normalizeBox([300, 600, 1200, 3780]);
    expect(withoutDims.ok).toBe(false);
    if (!withoutDims.ok) expect(withoutDims.reason).toBe('out_of_range');
  });

  it('repairs inverted corners instead of rejecting', () => {
    const r = normalizeBox([400, 260, 100, 200]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.box.x).toBeCloseTo(0.1);
  });

  it('clamps the constant 1001/1000-style overshoot', () => {
    const r = normalizeBox([980, 950, 1004, 1002]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.box.x + r.box.w).toBeLessThanOrEqual(1);
  });

  it('rejects degenerate, implausible, and malformed boxes with reasons', () => {
    expect(normalizeBox([100, 200, 100, 260])).toMatchObject({ ok: false, reason: 'degenerate' });
    expect(normalizeBox([0, 0, 1000, 1000])).toMatchObject({ ok: false, reason: 'implausible' }); // whole image
    expect(normalizeBox([5, 5, 6, 6])).toMatchObject({ ok: false, reason: 'implausible' }); // dust
    expect(normalizeBox('not a box')).toMatchObject({ ok: false, reason: 'malformed' });
    expect(normalizeBox([1, 2, 3])).toMatchObject({ ok: false, reason: 'malformed' });
    expect(normalizeBox(undefined)).toMatchObject({ ok: false, reason: 'missing' });
  });
});

describe('analyzeGrounding / groundingUsable — the overlay go/no-go', () => {
  const goodRow = (i: number) => [100, 50 + i * 60, 900, 100 + i * 60]; // clean stacked rows

  it('healthy scan: high validity, no heavy overlap -> usable', () => {
    const { stats } = analyzeGrounding(Array.from({ length: 10 }, (_, i) => goodRow(i)));
    expect(stats.valid).toBe(10);
    expect(stats.heavyOverlapShare).toBe(0);
    expect(groundingUsable(stats)).toBe(true);
  });

  it('column confusion (boxes stacked on each other) -> NOT usable', () => {
    const same = [100, 100, 900, 400];
    const { stats } = analyzeGrounding([same, same, same, same, goodRow(8), goodRow(9)]);
    expect(groundingUsable(stats)).toBe(false);
  });

  it('too many rejects -> NOT usable, falls back to list', () => {
    const { stats } = analyzeGrounding([goodRow(0), 'x', undefined, [1,2,3], goodRow(4)] as unknown[]);
    expect(stats.valid).toBe(2);
    expect(groundingUsable(stats)).toBe(false);
  });

  it('empty scan is never usable', () => {
    expect(groundingUsable(analyzeGrounding([]).stats)).toBe(false);
  });

  it('REGRESSION: cumulative drift is detected even when no single overlap is heavy', () => {
    // From real-photo validation (menu 2): the model's boxes progressively slid up
    // a 12-dish column until neighbors crowded together and the last dish had no
    // box on it — yet heavyOverlapShare read 0% and the old gate said usable.
    // crowdedPairShare exists to catch exactly this: each neighbor overlap is
    // small, but the SEQUENCE has lost correspondence with the dishes.
    const drifted = Array.from({ length: 12 }, (_, i) => {
      const trueY = 50 + i * 75;
      const y = Math.max(0, trueY - i * 26); // compounding upward drift
      return [100, y, 900, y + 70];
    });
    const { stats } = analyzeGrounding(drifted);
    expect(stats.heavyOverlapShare).toBeLessThan(0.15); // the old gate's blind spot
    expect(stats.crowdedPairShare).toBeGreaterThan(0.5); // the new detector fires
    expect(groundingUsable(stats)).toBe(false);
  });

  it('REGRESSION: menu-2-magnitude GRADUAL compression is caught (redeploy-confirmed miss)', () => {
    // The first gate required 25%-deep pairwise overlap and real gradual drift
    // (~1 row of cumulative offset across 12 rows, 3-18% per-pair overlap) slid
    // under it — confirmed live after redeploy. Any-overlap share catches it.
    const gentle = Array.from({ length: 12 }, (_, i) => {
      const y = Math.max(0, 50 + i * 75 - i * i * 0.52);
      return [100, y, 900, y + 70];
    });
    const { stats } = analyzeGrounding(gentle);
    expect(stats.crowdedPairShare).toBeGreaterThan(0.3);
    expect(groundingUsable(stats)).toBe(false);
  });

  it('REGRESSION: menu-1 STRETCHING drift (boxes sliding down, gaps growing) is caught', () => {
    // The opposite direction: no overlap ever forms, so crowding stays silent —
    // the gap-trend detector fires on the accumulating spacing instead.
    const onset = Array.from({ length: 20 }, (_, i) => {
      const y = 30 + i * 45 + (i > 14 ? (i - 14) * (i - 14) * 4 : 0);
      return [100, y, 900, y + 40];
    });
    const { stats } = analyzeGrounding(onset);
    expect(stats.gapTrendMax).toBeGreaterThan(0.5);
    expect(groundingUsable(stats)).toBe(false);
  });

  it('REGRESSION: exactly-constant gaps (integer-coordinate ties) are NOT a trend', () => {
    // Spearman without midranks ranks tied values in insertion order, scoring a
    // false perfect trend on perfectly regular menus — every healthy
    // integer-coordinate synthetic failed the gate until midranks were added.
    const regular = Array.from({ length: 15 }, (_, i) => [100, 50 + i * 61, 900, 110 + i * 61]);
    const { stats } = analyzeGrounding(regular);
    expect(stats.gapTrendMax).toBeLessThan(0.1);
    expect(groundingUsable(stats)).toBe(true);
  });

  it('density is NOT drift: tight-but-clean and multi-line boxes stay usable', () => {
    const tight = Array.from({ length: 15 }, (_, i) => [100, 50 + i * 61, 900, 110 + i * 61]);
    expect(groundingUsable(analyzeGrounding(tight).stats)).toBe(true);
    const tall = Array.from({ length: 8 }, (_, i) => [100, 50 + i * 115, 900, 160 + i * 115]);
    expect(groundingUsable(analyzeGrounding(tall).stats)).toBe(true);
  });
});
