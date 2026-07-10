import { describe, it, expect } from 'vitest';
import {
  DIMS, emptyTaste, updateTaste, updateCuisineAffinity, bumpEvidence,
  thresholdVisionAttrs, LEARN_CUTOFF,
  similarity, contentScore, blendScores, toMatchPercent, toRelativeMatchPercent,
} from '../src/lib/taste';

describe('updateTaste', () => {
  it('moves preference toward attributes the dish actually reports', () => {
    const t = updateTaste(emptyTaste(), {}, { spicy: 1 }, 1);
    expect(t.spicy).toBeGreaterThan(0);
  });

  it('REGRESSION: a dish omitting a dimension entirely must NOT move that dimension at all', () => {
    // The real production bug: rating a sparse dish (spicy present, everything else
    // simply never mentioned) used to silently manufacture a "dislike" on every one
    // of the ~14-16 unmentioned dims. No evidence about a dimension must mean
    // EXACTLY zero movement on it — not neutral-ish, not mildly negative, zero.
    const t = updateTaste(emptyTaste(), {}, { spicy: 1 }, 1);
    expect(t.sweet).toBe(0);
    expect(t.umami).toBe(0);
    expect(t.grilled).toBe(0);
    expect(t.bitter).toBe(0);
    for (const d of DIMS) {
      if (d === 'spicy') continue;
      expect(t[d]).toBe(0);
    }
  });

  it('REGRESSION: this holds over MANY ratings, not just one — no slow drift on unexplored dims', () => {
    // The original bug compounded: even a slow per-rating nudge adds up over several
    // ratings into a "deep dislike" of something never actually explored. Confirm a
    // dimension genuinely never mentioned across 10 ratings stays at exactly zero.
    let t = emptyTaste();
    let ev = {};
    for (let i = 0; i < 10; i++) { t = updateTaste(t, ev, { umami: 0.8 }, 1); ev = bumpEvidence(ev, { umami: 0.8 }); }
    expect(t.grilled).toBe(0);
    expect(t.fried).toBe(0);
    expect(t.bitter).toBe(0);
    expect(t.umami).toBeGreaterThan(0);
  });

  it('REGRESSION: below-cutoff VISION presence is model murmur and teaches nothing', () => {
    // This test previously asserted the opposite — that a low reported value was
    // "real signal." That was written believing vision only emits dims it actually
    // detected. Live production rows proved otherwise: the model reports murmur
    // values (0.05-0.15) for every dim it has no opinion on, and the centering
    // transform reads those as near-confirmed absence — so loving a dish pushed
    // every murmured dim negative. Same corruption class as the missing-key bug,
    // arriving through low values instead of absent keys. Ground-truth simulation:
    // murmur-learning COMPOUNDS phantom preferences as ratings accumulate
    // (0.26 -> 0.47); cutoff holds them near zero.
    const t = updateTaste(emptyTaste(), {}, { spicy: 0.1 }, 1);
    expect(t.spicy).toBe(0);
  });

  it('VOICE low presence is exempt from the cutoff — spoken words are testimony, not murmur', () => {
    // "It was barely spicy" from the eater's own mouth is genuinely confirmed
    // low presence, unlike a vision model's 0.1 shrug. Loving a dish confirmed
    // barely-spicy legitimately reads as "doesn't need much heat."
    const t = updateTaste(emptyTaste(), {}, {}, 1, { spicy: 0.1 });
    expect(t.spicy).toBeLessThan(0);
  });

  it('bumpEvidence counts exactly the dims that taught, and nothing else', () => {
    // Vision murmur (below cutoff) and omitted dims must not accrue evidence;
    // taught vision dims and ALL voice dims must. Evidence powers the per-dim
    // learning rate and gates written claims about the user's history, so it has
    // to agree exactly with what updateTaste actually learned from.
    const ev = bumpEvidence({}, { spicy: 0.9, sweet: 0.1 }, { salty: 0.2 });
    expect(ev.spicy).toBe(1);       // vision, above cutoff -> taught
    expect(ev.sweet).toBe(undefined); // vision murmur -> not evidence
    expect(ev.salty).toBe(1);       // voice, any value -> testimony
    expect(ev.umami).toBe(undefined); // never mentioned anywhere
  });

  it('thresholdVisionAttrs strips murmur but keeps genuine presence', () => {
    const cleaned = thresholdVisionAttrs({ spicy: 0.9, umami: 0.45, fried: 0.1, baked: 0.05 });
    expect(cleaned).toEqual({ spicy: 0.9, umami: 0.45 });
    expect(LEARN_CUTOFF).toBeGreaterThan(0.1); // murmur band stays below the cutoff
  });

  it('moves preference away from attributes of hated dishes', () => {
    const t = updateTaste(emptyTaste(), {}, { spicy: 1 }, -1);
    expect(t.spicy).toBeLessThan(0);
  });

  it('never escapes [-1, 1] no matter how many extreme ratings', () => {
    let t = emptyTaste();
    let ev = {};
    for (let i = 0; i < 500; i++) { t = updateTaste(t, ev, { umami: 1 }, 1); ev = bumpEvidence(ev, { umami: 1 }); }
    expect(t.umami).toBeLessThanOrEqual(1);
    expect(t.umami).toBeGreaterThan(0.5);
    for (const d of DIMS) {
      expect(t[d]).toBeGreaterThanOrEqual(-1);
      expect(t[d]).toBeLessThanOrEqual(1);
    }
  });

  it('learning rate decays PER DIMENSION as that dim accumulates evidence', () => {
    const early = updateTaste(emptyTaste(), {}, { spicy: 1 }, 1).spicy;
    const late = updateTaste(emptyTaste(), { spicy: 100 }, { spicy: 1 }, 1).spicy;
    expect(early).toBeGreaterThan(late);
    expect(late).toBeGreaterThan(0); // but never fully stops learning
  });

  it('REGRESSION: a preference first encountered LATE still learns fast', () => {
    // The old rate decayed with the user's TOTAL rating count, so a dimension first
    // taught at rating #30 (e.g. the first genuinely spicy dish a cautious eater
    // tries) learned at the floor rate forever. Per-dim decay means a fresh
    // dimension always starts at the fast cold-start rate, no matter how mature the
    // rest of the profile is. Ground-truth simulation: ~3.3x better recovery of
    // late-discovered preferences, no cold-start cost.
    const matureProfileEvidence = { umami: 30, tender: 30, rich: 30 }; // spicy: never taught
    const t = updateTaste(emptyTaste(), matureProfileEvidence, { spicy: 1 }, 1);
    const fresh = updateTaste(emptyTaste(), {}, { spicy: 1 }, 1);
    expect(t.spicy).toBeCloseTo(fresh.spicy, 10); // identical to a first-ever rating
  });

  it('voice-extracted attributes override the photo guess', () => {
    // Photo murmured barely-salty (teaches nothing, post-cutoff); the eater said
    // very salty. The eater's word wins outright.
    const noVoice = updateTaste(emptyTaste(), {}, { salty: 0.1 }, 1);
    const withVoice = updateTaste(emptyTaste(), {}, { salty: 0.1 }, 1, { salty: 0.9 });
    expect(noVoice.salty).toBe(0);
    expect(withVoice.salty).toBeGreaterThan(noVoice.salty);
  });

  it('voice notes can report a dim the photo omitted entirely — that still counts as evidence', () => {
    const t = updateTaste(emptyTaste(), {}, { spicy: 1 }, 1, { fresh: 0.8 });
    expect(t.fresh).toBeGreaterThan(0); // voice mentioned it -> real evidence, unlike a silent photo omission
  });

  it('a neutral rating (0) leaves the profile untouched', () => {
    const t = updateTaste(emptyTaste(), {}, { spicy: 1, crispy: 1 }, 0);
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

describe('contentScore — missing-attribute regression (the "everything scores 100%" bug)', () => {
  // A profile with several strong DISLIKES sitting near -1 is exactly the real
  // production case that exposed this: absent dims used to silently score as
  // "confirmed not present," which for a strong dislike manufactured a large FAKE
  // positive match on almost any dish — including one with zero real attributes.
  const heavyDislikes = {
    ...emptyTaste(),
    bitter: -1, grilled: -0.999, fried: -0.98, crispy: -0.98,
    sour: -0.98, spicy: -0.92, baked: -0.79, creamy: -0.85,
    tender: 0.71, umami: 0.63, rich: 0.4,
  };

  it('a dish with ZERO attributes scores neutral (50%), never a fake "perfect match"', () => {
    const raw = contentScore(heavyDislikes, {}, {});
    expect(raw).toBe(0);
    expect(toMatchPercent(raw)).toBe(50);
  });

  it('a dish matching the disliked attributes scores LOW, not saturated high', () => {
    const raw = contentScore(heavyDislikes, { fried: 0.9, crispy: 0.9, sweet: 0.8 }, {});
    expect(toMatchPercent(raw)).toBeLessThan(50);
  });

  it('a genuinely well-matched dish scores meaningfully higher than a badly-matched one', () => {
    const good = contentScore(heavyDislikes, { tender: 0.6, umami: 0.5, fresh: 0.6 }, {});
    const bad = contentScore(heavyDislikes, { fried: 0.8, crispy: 0.8 }, {});
    expect(toMatchPercent(good)).toBeGreaterThan(toMatchPercent(bad));
    // The critical assertion: they must NOT both be clamped to the same ceiling.
    expect(toMatchPercent(good)).toBeLessThan(100);
  });

  it('sparse dishes with only 1-2 attributes are not artificially inflated by 16+ silently-absent dims', () => {
    const raw = contentScore(heavyDislikes, { spicy: 0.7, umami: 0.6 }, {});
    // Should be a modest, plausible value, not near the extremes either direction.
    expect(Math.abs(raw)).toBeLessThan(0.3);
  });
});

describe('toRelativeMatchPercent — the fixed-ceiling saturation fix', () => {
  it('stretches a batch of scores that would ALL clamp to 100 under the fixed gain', () => {
    // Real production shape: every raw score well above the fixed formula's ceiling.
    const rawScores = [0.15, 0.22, 0.18, 0.30, 0.25];
    const percents = rawScores.map(r => toRelativeMatchPercent(r, rawScores));
    // Every fixed-gain equivalent would have been 100 — these must NOT all be equal.
    expect(new Set(percents).size).toBeGreaterThan(1);
    // The best dish in the batch should read meaningfully higher than the worst.
    expect(Math.max(...percents)).toBeGreaterThan(Math.min(...percents) + 20);
  });

  it('preserves relative ORDER exactly — never reorders what raw scores already decided', () => {
    const rawScores = [0.3, -0.1, 0.5, 0.05, -0.4];
    const percents = rawScores.map(r => toRelativeMatchPercent(r, rawScores));
    const orderByRaw = [...rawScores].sort((a, b) => b - a);
    const orderByPercent = [...percents].sort((a, b) => b - a);
    // Sorting either array gives the same relative sequence of original indices.
    const rawRanked = rawScores.map((r, i) => i).sort((a, b) => rawScores[b] - rawScores[a]);
    const pctRanked = rawScores.map((r, i) => i).sort((a, b) => percents[b] - percents[a]);
    expect(pctRanked).toEqual(rawRanked);
  });

  it('the best and worst in the batch land at (or very near) the floor/ceiling', () => {
    const rawScores = [0.1, 0.5, 0.9];
    expect(toRelativeMatchPercent(0.1, rawScores)).toBe(15);
    expect(toRelativeMatchPercent(0.9, rawScores)).toBe(95);
  });

  it('an identical batch (no real spread) shows an honest flat 50, not fake variance', () => {
    const rawScores = [0.4, 0.4, 0.4];
    expect(toRelativeMatchPercent(0.4, rawScores)).toBe(50);
  });

  it('handles a single-item batch as neutral (nothing to compare against)', () => {
    expect(toRelativeMatchPercent(0.7, [0.7])).toBe(50);
  });

  it('handles an empty batch without crashing', () => {
    expect(toRelativeMatchPercent(0.5, [])).toBe(50);
  });

  it('respects custom floor/ceiling bounds', () => {
    const rawScores = [0, 1];
    expect(toRelativeMatchPercent(0, rawScores, 20, 80)).toBe(20);
    expect(toRelativeMatchPercent(1, rawScores, 20, 80)).toBe(80);
  });
});
