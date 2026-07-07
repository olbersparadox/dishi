import { describe, it, expect } from 'vitest';
import { trainMF, predictMF, mfBlendWeight, MF_ACTIVATION, type Rating } from '../src/lib/mf';

/**
 * Synthetic factorizable world: two latent taste groups (spice-lovers, comfort-lovers)
 * and two dish clusters. Group members love their cluster (+0.8) and dislike the
 * other (-0.6). If training works, the model must recover this structure far better
 * than the global-average baseline.
 */
function syntheticRatings(): Rating[] {
  const ratings: Rating[] = [];
  for (let u = 0; u < 12; u++) {
    const group = u % 2; // 0 = spice, 1 = comfort
    for (let d = 0; d < 10; d++) {
      const cluster = d % 2;
      const base = group === cluster ? 0.8 : -0.6;
      const noise = ((u * 7 + d * 13) % 10 - 5) / 100; // deterministic tiny noise
      ratings.push({ user_id: `u${u}`, dish_id: `d${d}`, score: base + noise });
    }
  }
  return ratings;
}

describe('trainMF', () => {
  it('learns latent structure: beats the global-mean baseline by a wide margin', () => {
    const ratings = syntheticRatings();
    const model = trainMF(ratings, { epochs: 60, seed: 7 });

    const globalMean = ratings.reduce((s, r) => s + r.score, 0) / ratings.length;
    let mfErr = 0, baseErr = 0;
    for (const r of ratings) {
      const pred = predictMF(model, r.user_id, r.dish_id)!;
      mfErr += (pred - r.score) ** 2;
      baseErr += (globalMean - r.score) ** 2;
    }
    expect(mfErr).toBeLessThan(baseErr * 0.2); // >80% error reduction on structured data
  });

  it('predicts the right SIGN for every user-dish pair in the structured world', () => {
    const ratings = syntheticRatings();
    const model = trainMF(ratings, { epochs: 60, seed: 7 });
    for (const r of ratings) {
      const pred = predictMF(model, r.user_id, r.dish_id)!;
      expect(Math.sign(pred)).toBe(Math.sign(r.score));
    }
  });

  it('records honest metadata about what it trained on', () => {
    const model = trainMF(syntheticRatings(), { seed: 7 });
    expect(model.ratingCount).toBe(120);
    expect(model.distinctUsers).toBe(12);
    expect(model.distinctDishes).toBe(10);
  });
});

describe('predictMF', () => {
  it('returns null for users or dishes the model has never seen (cold nodes)', () => {
    const model = trainMF(syntheticRatings(), { seed: 7 });
    expect(predictMF(model, 'stranger', 'd0')).toBeNull();
    expect(predictMF(model, 'u0', 'brand-new-dish')).toBeNull();
  });
});

describe('mfBlendWeight — the automatic dial', () => {
  const { minRatings, minUsers, fullWeightRatings, maxWeight } = MF_ACTIVATION;

  it('is exactly 0 with no trained model', () => {
    expect(mfBlendWeight(null, 500)).toBe(0);
  });

  it('is exactly 0 below the data thresholds — the simple system runs alone', () => {
    expect(mfBlendWeight({ ratingCount: minRatings - 1, distinctUsers: 100 }, minRatings - 1)).toBe(0);
    expect(mfBlendWeight({ ratingCount: 10000, distinctUsers: minUsers - 1 }, 10000)).toBe(0);
  });

  it('ramps up continuously as data grows, never past the ceiling', () => {
    const early = mfBlendWeight({ ratingCount: minRatings + 50, distinctUsers: 50 }, minRatings + 50);
    const late = mfBlendWeight({ ratingCount: fullWeightRatings, distinctUsers: 50 }, fullWeightRatings);
    expect(early).toBeGreaterThan(0);
    expect(late).toBeGreaterThan(early);
    expect(late).toBeLessThanOrEqual(maxWeight);
    expect(mfBlendWeight({ ratingCount: 1e6, distinctUsers: 1e4 }, 1e6)).toBeLessThanOrEqual(maxWeight);
  });

  it('discounts a stale model as live data outgrows the training snapshot', () => {
    const state = { ratingCount: fullWeightRatings, distinctUsers: 100 };
    const fresh = mfBlendWeight(state, fullWeightRatings);
    const stale = mfBlendWeight(state, fullWeightRatings * 1.3);
    const veryStale = mfBlendWeight(state, fullWeightRatings * 2);
    expect(stale).toBeLessThan(fresh);
    expect(veryStale).toBe(0); // fully distrusted once far past tolerance
  });

  it('never goes negative', () => {
    expect(mfBlendWeight({ ratingCount: 300, distinctUsers: 30 }, 10_000_000)).toBeGreaterThanOrEqual(0);
  });
});
