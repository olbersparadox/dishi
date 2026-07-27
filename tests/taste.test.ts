import { describe, it, expect } from 'vitest';
import {
  DIMS, emptyTaste, updateTaste, updateCuisineAffinity, bumpEvidence,
  thresholdVisionAttrs, LEARN_CUTOFF,
  similarity, contentScore, blendScores, toMatchPercent, toRelativeMatchPercent,
  MIN_SCORED_DIMS, neutralCenter, calibratedScore, PRIOR_CENTER, CENTER_PRIOR_K,
  isExecutionConfounded, isExecutionSibling, executionRangeFor, EXECUTION_PASS,
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
  it('converges on the AVERAGE feeling, and never saturates (2026-07-24)', () => {
    // The bug this replaces: affinity was an accumulator (prev + 0.2*score,
    // clamped), so a run of ordinary-good meals pinned it at the +1 ceiling and
    // it stopped learning. Observed live — cantonese and japanese both sat at
    // exactly 1.0 across 78% of one person's ratings, so the cuisine term was a
    // constant that told the engine nothing and drowned out the dish's own
    // attributes. Rating a cuisine "pretty good" forever must settle at
    // "pretty good", NOT at "the most I could possibly love anything".
    let a: Record<string, number> = {};
    for (let i = 0; i < 40; i++) a = updateCuisineAffinity(a, 'cantonese', 0.35);
    expect(a.cantonese).toBeCloseTo(0.35, 2);
    expect(a.cantonese).toBeLessThan(0.5);   // the old accumulator would be 1.0 here
  });

  it('cuisines rated the same end up the same — no first-mover saturation', () => {
    // Under the accumulator whichever cuisine got there first pinned at 1.0 and
    // the other could only tie, never differ; both then contributed an identical
    // maximal bonus. Equal treatment must produce equal affinity, so any real
    // discrimination has to come from the dish's attributes.
    let a: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      a = updateCuisineAffinity(a, 'cantonese', 0.6);
      a = updateCuisineAffinity(a, 'japanese', 0.6);
    }
    expect(a.cantonese).toBeCloseTo(a.japanese, 6);
    expect(a.cantonese).toBeCloseTo(0.6, 2);
  });

  it('a genuinely disliked cuisine goes negative, and stays bounded', () => {
    let a: Record<string, number> = {};
    for (let i = 0; i < 40; i++) a = updateCuisineAffinity(a, 'indian', -0.9);
    expect(a.indian).toBeCloseTo(-0.9, 2);
    expect(a.indian).toBeGreaterThanOrEqual(-1);
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

/**
 * RE-RATING must replay, never re-apply incrementally.
 *
 * updateTaste is an EMA nudge applied ON TOP of the current vector. When a user
 * CHANGES an existing rating, the current vector still contains the effect of the
 * OLD rating for that same dish — and nothing removes it. Applying the new rating
 * incrementally therefore leaves the profile reflecting a rating history that
 * never happened: the same phantom-learning failure as the original missing-
 * attribute bug, arriving by a different door.
 *
 * Found while adding a "Re-rate" button (which made this path, previously almost
 * unreachable, a normal user action). Verified against the real engine before the
 * fix: flipping a spicy dish from loved to hated left spicy at +0.13 — still
 * POSITIVE, insisting the user likes spicy when their only rating is a hate.
 */
describe('re-rating: incremental re-application is wrong; replay is correct', () => {
  const spicyDish = { spicy: 0.9 };

  it('the incremental path leaves a flipped rating pointing the WRONG WAY', () => {
    let vec = emptyTaste();
    let ev = {};
    vec = updateTaste(vec, ev, spicyDish, 1.0, null);   // loved it
    ev = bumpEvidence(ev, spicyDish, null);

    // What the old code did on a re-rate: nudge again from the already-loved vector.
    const incremental = updateTaste(vec, ev, spicyDish, -1.0, null);

    // The user's ONLY rating of this dish is now "hated" — yet spicy stays positive.
    expect(incremental.spicy).toBeGreaterThan(0); // <- the bug, asserted explicitly
  });

  it('replaying the CORRECTED history gives the honest answer', () => {
    // Replay = rebuild from scratch over the ratings table, which by then holds only
    // the corrected rating. One rating, "hated", on a spicy dish.
    let replayed = emptyTaste();
    replayed = updateTaste(replayed, {}, spicyDish, -1.0, null);

    expect(replayed.spicy).toBeLessThan(0);
  });

  it('replay of an unchanged history reproduces the incremental result exactly', () => {
    // Sanity: replay isn't a different engine, so on a history with no correction it
    // must agree with the cheap incremental path — otherwise switching a re-rate to
    // replay would silently shift everyone's numbers.
    const dishA = { spicy: 0.8, umami: 0.4 };
    const dishB = { sweet: 0.7 };

    let inc = emptyTaste();
    let ev = {};
    inc = updateTaste(inc, ev, dishA, 0.8, null);
    ev = bumpEvidence(ev, dishA, null);
    inc = updateTaste(inc, ev, dishB, -0.5, null);

    let rep = emptyTaste();
    let rev = {};
    rep = updateTaste(rep, rev, dishA, 0.8, null);
    rev = bumpEvidence(rev, dishA, null);
    rep = updateTaste(rep, rev, dishB, -0.5, null);

    for (const d of DIMS) expect(rep[d]).toBeCloseTo(inc[d], 10);
  });
});

describe('contentScore divisor — the seal-band root cause (2026-07-24)', () => {
  // The bug: the loop summed over only the dims a dish REPORTS (~8.7 on real
  // data) but always divided by DIMS.length = 18, scaling the taste term down
  // ~2x more than the evidence supports. Live consequence: predicted_raw
  // collapsed to roughly 0.3 * cuisineAffinity, and the seal's `love` band
  // (>= 0.5) became unreachable — 0 of 11 genuinely loved dishes ever called.
  // See docs/rnd/seal-band-calibration.md + scripts/simulate-seal-bands.ts.
  const taste = { umami: 0.9, tender: 0.9, salty: 0.8, rich: 0.6, fresh: 0.5, steamed: 0.7 };

  it('divides by the dims actually scored, not by all 18', () => {
    // Six well-matched dims. Under the old /18 the taste term was ~1/3 of what
    // the evidence supports; MIN_SCORED_DIMS is the floor it divides by instead.
    const dish = { umami: 0.9, tender: 0.9, salty: 0.9, rich: 0.9, fresh: 0.9, steamed: 0.9 };
    let sum = 0;
    for (const [d, v] of Object.entries(dish)) sum += (taste as Record<string, number>)[d] * (v - 0.5) * 2;
    expect(contentScore(taste, dish, {})).toBeCloseTo(sum / Math.max(MIN_SCORED_DIMS, 6), 10);
    // ...and strictly bigger than the old formula would have produced.
    expect(contentScore(taste, dish, {})).toBeGreaterThan(sum / 18);
  });

  it('floors the divisor so a SPARSE dish cannot be amplified into false confidence', () => {
    // One perfectly-matched attribute must not outscore a dish that matches the
    // same way across many — dividing by a raw count (1) would invert exactly that.
    const sparse = { umami: 1 };
    const broad = { umami: 1, tender: 1, salty: 1, rich: 1, fresh: 1, steamed: 1 };
    expect(contentScore(taste, broad, {})).toBeGreaterThan(contentScore(taste, sparse, {}));
  });

  it('a dish matching MORE dims than the floor is not penalised for it', () => {
    // Guards the other direction: past the floor the divisor tracks the real
    // count, so breadth of match neither inflates nor deflates the score.
    const dish: Record<string, number> = {};
    for (const d of DIMS) dish[d] = 1;
    const all = contentScore({ ...Object.fromEntries(DIMS.map(d => [d, 1])) }, dish, {});
    expect(all).toBeCloseTo(1, 10); // perfect match on every dim = 1.0, not 18/18-scaled noise
  });

  it('the cuisine bonus no longer dwarfs the taste term', () => {
    // The live failure: 0.3 * affinity decided almost every verdict because the
    // taste term averaged 0.068. A strongly-matched dish must now be able to
    // out-signal the cuisine bonus on its own.
    const dish = { umami: 0.9, tender: 0.9, salty: 0.9, rich: 0.9, fresh: 0.9, steamed: 0.9 };
    expect(contentScore(taste, dish, {})).toBeGreaterThan(0.3);
  });
});

/**
 * Self-calibrating rating scale (2026-07-25). The engine scores each flick
 * relative to the person's OWN neutral point instead of taking the raw value, so
 * "一般般" is negative for someone whose normal is 幾好食 without anyone hardcoding
 * what 一般般 is worth. Evidence: docs/rnd/seal-band-calibration.md §10.
 */
describe('neutralCenter — the learned neutral point', () => {
  it('is the prior when the person has told us nothing', () => {
    // Cold start must behave EXACTLY as the engine did before calibration existed.
    expect(neutralCenter([])).toBe(PRIOR_CENTER);
    expect(calibratedScore(0.35, [])).toBe(0.35);
  });

  it('uses the MEDIAN, so one furious rating cannot move where "ordinary" sits', () => {
    // The whole point of median-not-mean: this person's every meal was 0.35 except
    // one disaster. Their normal is still 0.35.
    const steady = [0.35, 0.35, 0.35, 0.35, 0.35, 0.35, 0.35, 0.35, 0.35];
    const withDisaster = [...steady, -0.9];
    // Compare like with like: the same shrinkage applied to a MEAN instead of the
    // median. The single -0.9 drags a mean-based centre down by ~0.08; the real
    // (median) centre barely notices it.
    const raw = withDisaster.reduce((a, b) => a + b, 0) / withDisaster.length;
    const meanBased = (CENTER_PRIOR_K * PRIOR_CENTER + withDisaster.length * raw) / (CENTER_PRIOR_K + withDisaster.length);
    expect(neutralCenter(withDisaster)).toBeGreaterThan(meanBased + 0.05);
    expect(neutralCenter(withDisaster)).toBeCloseTo(neutralCenter(steady), 1);
  });

  it('shrinks toward the prior, so a thin history earns only a weak centre', () => {
    const one = neutralCenter([0.35]);
    const many = neutralCenter(Array(50).fill(0.35));
    expect(Math.abs(one - PRIOR_CENTER)).toBeLessThan(Math.abs(many - PRIOR_CENTER));
    // Exact shrinkage: k prior-weights against n observations.
    expect(one).toBeCloseTo((CENTER_PRIOR_K * PRIOR_CENTER + 1 * 0.35) / (CENTER_PRIOR_K + 1), 10);
    expect(many).toBeCloseTo(0.35 * (50 / (CENTER_PRIOR_K + 50)), 10);
  });

  it('makes 一般般 teach NEGATIVELY for someone whose normal is 幾好食', () => {
    // The behaviour the owner asked for, and the one the raw-score engine got
    // wrong: pre-change this was +0.1 and taught "you like this dish's attributes".
    const historyOf幾好食 = Array(20).fill(0.35);
    expect(calibratedScore(0.1, historyOf幾好食)).toBeLessThan(0);
    // ...while their normal flick teaches ~nothing, being exactly normal.
    expect(Math.abs(calibratedScore(0.35, historyOf幾好食))).toBeLessThan(0.1);
    // ...and a rave still teaches strongly positive.
    expect(calibratedScore(1.0, historyOf幾好食)).toBeGreaterThan(0.5);
  });

  it('adapts to a HARSH rater the opposite way — nothing here is hardcoded', () => {
    // Someone whose normal flick is 一般般: for them 幾好食 is genuinely a good meal.
    const harsh = Array(20).fill(0.1);
    expect(calibratedScore(0.35, harsh)).toBeGreaterThan(0);
    expect(calibratedScore(0.1, harsh)).toBeLessThan(0.05); // their normal teaches ~nothing
  });

  it('never lets a flick help set the centre it is then measured against', () => {
    // Order matters: the centre is derived from PRIOR scores only. If the rating
    // being learned were included, a lone first rating would self-cancel to ~0.
    const first = calibratedScore(0.9, []);
    expect(first).toBe(0.9);
    expect(first).not.toBeCloseTo(0, 1);
  });
});

describe('calibration: the incremental path and replay must not diverge', () => {
  // The failure this guards is the seal-bug class: /api/ratings updates the
  // profile incrementally, replay.ts rebuilds it from full history, and if the two
  // derive the centre differently then re-rating a dish silently produces a
  // different profile than rating it first time. Both must consume prior scores
  // from the same table through this same function.
  const dishA = { umami: 0.9 }, dishB = { sweet: 0.8 }, dishC = { crispy: 0.7 };
  const history: { dish: Record<string, number>; score: number }[] = [
    { dish: dishA, score: 0.35 }, { dish: dishB, score: 0.35 },
    { dish: dishC, score: 0.1 }, { dish: dishA, score: 0.6 },
  ];

  it('produces an identical vector whether applied one-by-one or replayed', () => {
    // Incremental: each rating centred on the scores that preceded it, exactly as
    // the route does with its `.neq(dish_id)` query over prior rows.
    let inc = emptyTaste(); let incEv = {}; const seen: number[] = [];
    for (const r of history) {
      inc = updateTaste(inc, incEv, r.dish, calibratedScore(r.score, seen), null);
      incEv = bumpEvidence(incEv, r.dish, null);
      seen.push(r.score);
    }
    // Replay: same stream rebuilt from scratch, accumulating its own prior scores.
    let rep = emptyTaste(); let repEv = {}; const prior: number[] = [];
    for (const r of history) {
      rep = updateTaste(rep, repEv, r.dish, calibratedScore(r.score, prior), null);
      repEv = bumpEvidence(repEv, r.dish, null);
      prior.push(r.score);
    }
    for (const d of DIMS) expect(rep[d]).toBeCloseTo(inc[d], 10);
  });

  it('a lagged centre would NOT match — the agreement above is a real constraint', () => {
    // Proves the test above can fail: option (c) from the backlog (let the
    // incremental path lag by one rating) is detected, not tolerated.
    let lagged = emptyTaste(); let ev = {}; const seen: number[] = [];
    for (const r of history) {
      const stale = seen.slice(0, -1); // one rating behind
      lagged = updateTaste(lagged, ev, r.dish, calibratedScore(r.score, stale), null);
      ev = bumpEvidence(ev, r.dish, null);
      seen.push(r.score);
    }
    let rep = emptyTaste(); let repEv = {}; const prior: number[] = [];
    for (const r of history) {
      rep = updateTaste(rep, repEv, r.dish, calibratedScore(r.score, prior), null);
      repEv = bumpEvidence(repEv, r.dish, null);
      prior.push(r.score);
    }
    expect(DIMS.some(d => Math.abs(rep[d] - lagged[d]) > 1e-9)).toBe(true);
  });

  it('centres cuisine affinity too, so it means "versus your own average"', () => {
    // Affinity is an EMA toward the score; feeding it the raw score is what made
    // every regularly-eaten cuisine drift positive regardless of relative feeling.
    const normal = Array(20).fill(0.35);
    const meh = updateCuisineAffinity({}, 'cantonese', calibratedScore(0.1, normal));
    expect(meh.cantonese).toBeLessThan(0);
  });
});

/**
 * 佢哋整得點？ — execution quality (2026-07-26). A flick says how the MEAL went;
 * it cannot say whether a bad meal was the dish or the kitchen. Rather than ask,
 * the engine measures each instance 1-10 and lets comparison answer it.
 * See docs/DECISIONS.md "Direction: comparison is the core product DNA".
 */
describe('isExecutionConfounded — when a bad plate stops being about taste', () => {
  it('one bad plate on its own is AMBIGUOUS and keeps teaching', () => {
    // The honest default. A single 火腿通粉 scored 2 might mean a lazy kitchen —
    // or that this person genuinely dislikes macaroni soup. With nothing to
    // compare against, discarding their opinion would be a guess.
    expect(isExecutionConfounded(2, [])).toBe(false);
    expect(isExecutionConfounded(1, [undefined, null])).toBe(false);
  });

  it('a PASSING sibling exonerates the dish and pulls the rating out', () => {
    // 火腿通粉 at A = 2, later at B = 8. The dish is plainly fine; A is the
    // problem, so A's furious flick is no longer evidence about this palate.
    expect(isExecutionConfounded(2, [8])).toBe(true);
    expect(isExecutionConfounded(4, [EXECUTION_PASS])).toBe(true);
  });

  it('two BAD instances do not exonerate anything', () => {
    // Meeting two bad kitchens is not evidence the dish is good. Only a plate
    // that actually passed can vouch for it.
    expect(isExecutionConfounded(2, [3])).toBe(false);
    expect(isExecutionConfounded(1, [4, 2, 3])).toBe(false);
  });

  it('a passing plate is never confounded, however good its siblings', () => {
    // If the kitchen did the dish justice, the flick IS about taste.
    expect(isExecutionConfounded(EXECUTION_PASS, [10])).toBe(false);
    expect(isExecutionConfounded(9, [10])).toBe(false);
  });

  it('an unscored rating always teaches — skipping the slider costs nothing', () => {
    expect(isExecutionConfounded(null, [9])).toBe(false);
    expect(isExecutionConfounded(undefined, [9])).toBe(false);
  });
});

describe('isExecutionSibling — the one shared "same dish" rule', () => {
  // canonical_dish_id (cross-venue, from the catalog) is the primary link;
  // dish_identity_id (per-venue) is the fallback. This rule is consumed by
  // BOTH replay.ts and the /api/ratings offer path — a second copy of it is
  // how the two learning paths start disagreeing.
  const k = (dish_id: string, canonical: string | null, identity: string | null) =>
    ({ dish_id, canonical_dish_id: canonical, dish_identity_id: identity });

  it('same canonical id at two venues ARE siblings — the flagship comparison', () => {
    expect(isExecutionSibling(k('a', 'beef-chow-fun', 'ident-A'), k('b', 'beef-chow-fun', 'ident-B'))).toBe(true);
    expect(isExecutionSibling(k('a', 'beef-chow-fun', null), k('b', 'beef-chow-fun', null))).toBe(true);
  });

  it('same per-venue identity still works with no canonical id — the fallback', () => {
    expect(isExecutionSibling(k('a', null, 'ident-1'), k('b', null, 'ident-1'))).toBe(true);
  });

  it('different canonical ids are not siblings, whatever the identities say nothing about', () => {
    expect(isExecutionSibling(k('a', 'beef-chow-fun', null), k('b', 'wet-chow-fun', null))).toBe(false);
  });

  it('two dishes with NO links are never siblings — null must not match null', () => {
    expect(isExecutionSibling(k('a', null, null), k('b', null, null))).toBe(false);
  });

  it('a dish is never its own sibling, even sharing both links', () => {
    expect(isExecutionSibling(k('a', 'milk-tea', 'ident-1'), k('a', 'milk-tea', 'ident-1'))).toBe(false);
  });

  it('either link alone suffices — canonical on one side of a mixed pair', () => {
    // Dish A resolved to the catalog, dish B did not but shares A's per-venue
    // identity: still the same dish via the fallback.
    expect(isExecutionSibling(k('a', 'milk-tea', 'ident-1'), k('b', null, 'ident-1'))).toBe(true);
  });
});

describe('executionRangeFor — the slider cannot contradict the flick', () => {
  it('a flick well BELOW your normal caps the slider under the passing line', () => {
    // You cannot flick 唔會再食 and then call the plate a 9.
    const r = executionRangeFor(-0.5);
    expect(r.min).toBe(1);
    expect(r.max).toBe(EXECUTION_PASS - 1);
  });

  it('a flick well ABOVE your normal floors the slider at passing', () => {
    // ...nor rave about a dish and call the cooking a failure.
    const r = executionRangeFor(0.5);
    expect(r.min).toBe(EXECUTION_PASS);
    expect(r.max).toBe(10);
  });

  it('an ordinary flick leaves the whole scale open', () => {
    expect(executionRangeFor(0)).toEqual({ min: 1, max: 10 });
  });

  it('keys off the CENTRED score, so a harsh rater is not misread', () => {
    // The same raw flick means different things to different people, so the
    // bound has to read the centred value — the input here IS already centred.
    // A harsh rater whose normal is 一般般: 一般般 centres near 0 for them, so
    // it must NOT be treated as a complaint the way it would for a generous one.
    const harshNormal = calibratedScore(0.1, Array(50).fill(0.1));   // ~0, their ordinary meal
    const generousMeh = calibratedScore(0.1, Array(50).fill(0.35));  // clearly below theirs
    expect(harshNormal).toBeGreaterThan(-0.2);   // not a complaint for them
    expect(generousMeh).toBeLessThanOrEqual(-0.2);
    expect(executionRangeFor(harshNormal).max).toBe(10);
    expect(executionRangeFor(generousMeh).max).toBe(EXECUTION_PASS - 1);
  });
});
