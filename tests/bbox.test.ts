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
});
