import { describe, it, expect } from 'vitest';
import { composeReason, composeCaution, rankMenuItems } from '../src/lib/menuScoring';
import { mergeScoredAttributes } from '../src/lib/menuScan';
import { emptyTaste } from '../src/lib/taste';

describe('mergeScoredAttributes — trust nothing from the model', () => {
  it('maps a well-formed response by index', () => {
    const out = mergeScoredAttributes(2, [
      Array(18).fill(0).map((_, i) => (i === 0 ? 0.9 : 0)), // spicy-ish first dish
      Array(18).fill(0),
    ]);
    expect(out).toHaveLength(2);
    expect(Object.keys(out[0]).length).toBeGreaterThan(0);
    expect(out[1]).toEqual({});
  });

  it('returns all-empty when the model returns null or non-array', () => {
    expect(mergeScoredAttributes(3, null)).toEqual([{}, {}, {}]);
    expect(mergeScoredAttributes(2, 'not an array' as any)).toEqual([{}, {}]);
  });

  it('handles fewer scores than items — remainder stays empty, no crash', () => {
    const out = mergeScoredAttributes(3, [Array(18).fill(0.5)]);
    expect(out).toHaveLength(3);
    expect(Object.keys(out[0]).length).toBeGreaterThan(0);
    expect(out[1]).toEqual({});
    expect(out[2]).toEqual({});
  });

  it('handles MORE scores than items — extras are ignored, no overflow', () => {
    const out = mergeScoredAttributes(1, [Array(18).fill(0.5), Array(18).fill(0.9)]);
    expect(out).toHaveLength(1);
  });

  it('ignores malformed per-item entries (not an array, wrong types) without crashing', () => {
    const out = mergeScoredAttributes(3, ['garbage', null, Array(18).fill(2)] as any);
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({});
    expect(out[1]).toEqual({});
    // out-of-range values (2 > 1) get clamped, not dropped or crashed on
    for (const v of Object.values(out[2])) expect(v).toBeLessThanOrEqual(1);
  });

  it('clamps negative and NaN numbers rather than propagating them', () => {
    const arr = Array(18).fill(0);
    arr[0] = -5; arr[1] = NaN; arr[2] = 0.7;
    const out = mergeScoredAttributes(1, [arr]);
    // only the valid positive entry should survive; negative/NaN never enter the map
    const vals = Object.values(out[0]);
    for (const v of vals) { expect(v).toBeGreaterThan(0); expect(v).toBeLessThanOrEqual(1); }
  });
});

describe('composeReason / composeCaution', () => {
  const taste = { ...emptyTaste(), spicy: 0.8, umami: 0.6 };

  it('names the strongest matching dims when they exist', () => {
    const r = composeReason({ attributes: { spicy: 0.9, umami: 0.5 }, cuisine: 'sichuan' }, taste, {});
    expect(r.toLowerCase()).toContain('heat');
  });

  it('falls back to cuisine affinity when no dims line up', () => {
    const r = composeReason({ attributes: {}, cuisine: 'thai' }, taste, { thai: 0.5 });
    expect(r).toContain('thai');
  });

  it('calls out a genuine wildcard honestly', () => {
    const r = composeReason({ attributes: {}, cuisine: 'french' }, taste, {});
    expect(r.toLowerCase()).toContain('wildcard');
  });

  it('warns only when the dish clashes with a real dislike', () => {
    const dislikes = { ...emptyTaste(), sour: -0.7 };
    const warning = composeCaution({ attributes: { sour: 0.8 }, cuisine: 'x' }, dislikes);
    expect(warning).not.toBeNull();
    expect(warning!.toLowerCase()).toContain('acidity');
    expect(composeCaution({ attributes: {}, cuisine: 'x' }, dislikes)).toBeNull();
  });
});

describe('rankMenuItems', () => {
  const taste = { ...emptyTaste(), spicy: 0.9 };
  const items = [
    { name: 'Mild soup', cuisine: 'x', attributes: { spicy: 0.05 } },
    { name: 'Fire noodles', cuisine: 'x', attributes: { spicy: 0.95 } },
  ];

  it('sorts by match against the taste profile', () => {
    const ranked = rankMenuItems(items, taste, {}, true);
    expect(ranked[0].name).toBe('Fire noodles');
    expect(ranked[0].match).toBeGreaterThan(ranked[1].match);
  });

  it('gates reason/caution behind includeReasons, never fabricating explanations early', () => {
    const withReasons = rankMenuItems(items, taste, {}, true);
    const withoutReasons = rankMenuItems(items, taste, {}, false);
    expect(withReasons.every(i => i.reason !== null)).toBe(true);
    expect(withoutReasons.every(i => i.reason === null && i.caution === null)).toBe(true);
  });

  it('preserves all original fields on each item (spread, not replace)', () => {
    const ranked = rankMenuItems(items, taste, {}, true);
    expect(ranked.find(r => r.name === 'Mild soup')?.cuisine).toBe('x');
  });
});
