import { describe, it, expect } from 'vitest';
import {
  DIMS, emptyTaste, updateTaste, updateCuisineAffinity,
  similarity, contentScore, blendScores, toMatchPercent,
} from '../src/lib/taste';

describe('updateTaste', () => {
  it('moves preference toward attributes of loved dishes', () => {
    const t = updateTaste(emptyTaste(), 0, { spicy: 1, sweet: 0 }, 1);
    expect(t.spicy).toBeGreaterThan(0);
    expect(t.sweet).toBeLessThan(0); // loved a dish that ISN'T sweet -> mild negative evidence
  });

  it('moves preference away from attributes of hated dishes', () => {
    const t = updateTaste(emptyTaste(), 0, { spicy: 1 }, -1);
    expect(t.spicy).toBeLessThan(0);
  });

  it('never escapes [-1, 1] no matter how many extreme ratings', () => {
    let t = emptyTaste();
    for (let i = 0; i < 500; i++) t = updateTaste(t, i, { umami: 1 }, 1);
    expect(t.umami).toBeLessThanOrEqual(1);
    expect(t.umami).toBeGreaterThan(0.5);
    for (const d of DIMS) {
      expect(t[d]).toBeGreaterThanOrEqual(-1);
      expect(t[d]).toBeLessThanOrEqual(1);
    }
  });

  it('learning rate decays: rating #1 moves the profile more than rating #100', () => {
    const early = updateTaste(emptyTaste(), 0, { spicy: 1 }, 1).spicy;
    const late = updateTaste(emptyTaste(), 100, { spicy: 1 }, 1).spicy;
    expect(early).toBeGreaterThan(late);
    expect(late).toBeGreaterThan(0); // but never fully stops learning
  });

  it('voice-extracted attributes override the photo guess', () => {
    // Photo said not-salty; the eater said very salty. Eater wins.
    const noVoice = updateTaste(emptyTaste(), 0, { salty: 0.1 }, 1);
    const withVoice = updateTaste(emptyTaste(), 0, { salty: 0.1 }, 1, { salty: 0.9 });
    expect(withVoice.salty).toBeGreaterThan(noVoice.salty);
  });

  it('a neutral rating (0) leaves the profile untouched', () => {
    const t = updateTaste(emptyTaste(), 0, { spicy: 1, crispy: 1 }, 0);
    for (const d of DIMS) expect(t[d]).toBe(0);
  });
});

describe('updateCuisineAffinity', () => {
  it('accumulates and clamps', () => {
    let a: Record<string, number> = {};
    for (let i = 0; i < 20; i++) a = updateCuisineAffinity(a, 'japanese', 1);
    expect(a.japanese).toBeLessThanOrEqual(1);
    expect(a.japanese).toBeGreaterThan(0.5);
  });

  it('normalizes case', () => {
    const a = updateCuisineAffinity({}, 'Japanese', 1);
    expect(a.japanese).toBeGreaterThan(0);
  });

  it("ignores 'unknown' — the vision fallback is not a cuisine signal", () => {
    const a = updateCuisineAffinity({}, 'unknown', 1);
    expect(a.unknown).toBe(undefined);
  });

  it('ignores null/undefined cuisine', () => {
    expect(updateCuisineAffinity({}, null, 1)).toEqual({});
    expect(updateCuisineAffinity({}, undefined, 1)).toEqual({});
  });
});

describe('similarity', () => {
  it('is 1 for identical non-zero vectors', () => {
    const a = { ...emptyTaste(), spicy: 0.8, umami: 0.5 };
    expect(similarity(a, { ...a })).toBeCloseTo(1, 5);
  });

  it('is -1 for opposite palates', () => {
    const a = { ...emptyTaste(), spicy: 0.8 };
    const b = { ...emptyTaste(), spicy: -0.8 };
    expect(similarity(a, b)).toBeCloseTo(-1, 5);
  });

  it('is 0 when either vector is all zeros (no fake affinity for blank profiles)', () => {
    const a = { ...emptyTaste(), spicy: 0.8 };
    expect(similarity(a, emptyTaste())).toBe(0);
    expect(similarity(emptyTaste(), emptyTaste())).toBe(0);
  });

  it('handles missing keys as zeros', () => {
    expect(similarity({ spicy: 1 }, { spicy: 1 })).toBeCloseTo(1, 5);
  });
});

describe('contentScore', () => {
  it('scores aligned dishes above misaligned ones', () => {
    const taste = { ...emptyTaste(), spicy: 0.9, fresh: -0.5 };
    const spicyDish = { spicy: 0.9, fresh: 0.1 };
    const freshDish = { spicy: 0.05, fresh: 0.95 };
    expect(contentScore(taste, spicyDish, {})).toBeGreaterThan(contentScore(taste, freshDish, {}));
  });

  it('cuisine affinity shifts the score', () => {
    const taste = emptyTaste();
    const dish = { umami: 0.5 };
    const withLove = contentScore(taste, dish, { thai: 0.8 }, 'thai');
    const without = contentScore(taste, dish, {}, 'thai');
    expect(withLove).toBeGreaterThan(without);
  });
});

describe('blendScores', () => {
  it('is pure content with no collaborative signal', () => {
    expect(blendScores(0.4, null, 0)).toEqual({ score: 0.4, source: 'content' });
    expect(blendScores(0.4, 0.9, 0)).toEqual({ score: 0.4, source: 'content' });
  });

  it('shifts toward collaborative as cross-user signal grows', () => {
    const light = blendScores(0, 1, 2).score;
    const heavy = blendScores(0, 1, 10).score;
    expect(heavy).toBeGreaterThan(light);
    expect(heavy).toBe(1); // weight saturates at 10 signals
  });

  it('labels the source collab only past the visibility threshold', () => {
    expect(blendScores(0, 1, 2).source).toBe('content');
    expect(blendScores(0, 1, 10).source).toBe('collab');
  });
});

describe('toMatchPercent', () => {
  it('centers at 50 for a neutral score and stays within [0, 100]', () => {
    expect(toMatchPercent(0)).toBe(50);
    expect(toMatchPercent(10)).toBe(100);
    expect(toMatchPercent(-10)).toBe(0);
  });

  it('spreads realistic single-attribute alignments into a legible band', () => {
    // spicy-lover (0.9) meets spicy dish (0.95): raw ≈ 0.045 over 18 dims
    expect(toMatchPercent(0.045)).toBeGreaterThanOrEqual(60);
    expect(toMatchPercent(-0.045)).toBeLessThanOrEqual(40);
  });

  it('is monotonic', () => {
    let prev = -1;
    for (let raw = -0.3; raw <= 0.3; raw += 0.05) {
      const v = toMatchPercent(raw);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});
