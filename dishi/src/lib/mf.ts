// Collaborative-filtering engine #2: learned latent factors (a small "FunkSVD"-style
// matrix factorization with bias terms), the technique behind Netflix's original
// recommender. Unlike taste.ts's hand-designed 18 dimensions, this LEARNS whatever
// hidden factors best explain the pattern of who-rated-what — factors that may have
// no human name at all.
//
// WHY THIS LIVES SEPARATELY FROM taste.ts, NOT REPLACING IT:
// Learned factors are only as good as the ratings matrix is dense. With a handful of
// users and a few hundred ratings, there's no real cross-user pattern to find — the
// model would fit noise and recommend worse than the hand-designed vectors. The
// hand-designed system is the *correct* choice at low data volumes, not a placeholder.
// This module is built now, trained on whatever data exists, but the recommendations
// route (see api/recommendations) only blends it in once the data actually supports it,
// and the blend weight ramps up continuously rather than flipping a switch.

export type Rating = { user_id: string; dish_id: string; score: number };

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type MFModel = {
  userFactors: Record<string, number[]>;
  dishFactors: Record<string, number[]>;
  userBias: Record<string, number>;
  dishBias: Record<string, number>;
  globalBias: number;
  numFactors: number;
  ratingCount: number;
  distinctUsers: number;
  distinctDishes: number;
};

/**
 * Train via stochastic gradient descent. Cheap enough to run in a serverless function
 * at MVP scale (thousands of ratings) — no separate ML infra needed yet.
 */
export function trainMF(
  ratings: Rating[],
  opts: { numFactors?: number; epochs?: number; learningRate?: number; regularization?: number; seed?: number } = {},
): MFModel {
  const numFactors = opts.numFactors ?? 12;
  const epochs = opts.epochs ?? 40;
  const lr = opts.learningRate ?? 0.01;
  const reg = opts.regularization ?? 0.05;
  // Seedable PRNG (mulberry32): with a seed, training is fully deterministic —
  // reproducible nightly retrains, debuggable regressions, non-flaky tests. Without
  // one, Math.random keeps the old behavior.
  const rand = opts.seed !== undefined ? mulberry32(opts.seed) : Math.random;

  const users = Array.from(new Set(ratings.map(r => r.user_id)));
  const dishes = Array.from(new Set(ratings.map(r => r.dish_id)));
  const globalBias = ratings.reduce((s, r) => s + r.score, 0) / Math.max(1, ratings.length);

  const userFactors: Record<string, number[]> = {};
  const dishFactors: Record<string, number[]> = {};
  const userBias: Record<string, number> = {};
  const dishBias: Record<string, number> = {};
  const initVec = () => Array.from({ length: numFactors }, () => (rand() - 0.5) * 0.1);
  for (const u of users) { userFactors[u] = initVec(); userBias[u] = 0; }
  for (const d of dishes) { dishFactors[d] = initVec(); dishBias[d] = 0; }

  for (let epoch = 0; epoch < epochs; epoch++) {
    // Fisher-Yates shuffle each epoch so SGD doesn't learn the row order.
    // (sort(() => random - 0.5) is also a biased shuffle — replaced while here.)
    const shuffled = [...ratings];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    for (const r of shuffled) {
      const uf = userFactors[r.user_id];
      const df = dishFactors[r.dish_id];
      let dot = 0;
      for (let k = 0; k < numFactors; k++) dot += uf[k] * df[k];
      const pred = globalBias + userBias[r.user_id] + dishBias[r.dish_id] + dot;
      const err = r.score - pred;

      userBias[r.user_id] += lr * (err - reg * userBias[r.user_id]);
      dishBias[r.dish_id] += lr * (err - reg * dishBias[r.dish_id]);
      for (let k = 0; k < numFactors; k++) {
        const ufk = uf[k], dfk = df[k];
        uf[k] += lr * (err * dfk - reg * ufk);
        df[k] += lr * (err * ufk - reg * dfk);
      }
    }
  }

  return {
    userFactors, dishFactors, userBias, dishBias, globalBias, numFactors,
    ratingCount: ratings.length, distinctUsers: users.length, distinctDishes: dishes.length,
  };
}

/** Predict a score for a user/dish pair the model has seen. Null if either is unseen (cold node). */
export function predictMF(model: MFModel, userId: string, dishId: string): number | null {
  const uf = model.userFactors[userId];
  const df = model.dishFactors[dishId];
  if (!uf || !df) return null;
  let dot = 0;
  for (let k = 0; k < model.numFactors; k++) dot += uf[k] * df[k];
  return model.globalBias + (model.userBias[userId] ?? 0) + (model.dishBias[dishId] ?? 0) + dot;
}

// ---------------------------------------------------------------------------
// Activation thresholds — the "automatic dial," not a manual switch.
// Tune these once you have real users; they're guesses calibrated to "a few hundred
// ratings across a few dozen people" being the point where learned factors start
// beating hand-designed ones, based on typical collaborative-filtering literature.
// ---------------------------------------------------------------------------
export const MF_ACTIVATION = {
  minRatings: 200,       // below this, weight is always 0 — not enough signal to trust
  minUsers: 20,          // and below this many distinct raters
  fullWeightRatings: 1000, // weight reaches its ceiling at this volume
  maxWeight: 0.7,        // even at full data volume, never fully replace the content model —
                         // it stays as a floor/explainability layer
  staleTolerance: 0.4,   // if live ratings have grown >40% past the last training run,
                         // discount the model's confidence until it's retrained
};

/**
 * The dial itself: 0 = pure content/neighbor blend (current system), up to maxWeight =
 * mostly learned factors. Continuous ramp, not a boolean flip, and it discounts itself
 * automatically if the model has gone stale relative to current data volume.
 */
export function mfBlendWeight(state: { ratingCount: number; distinctUsers: number } | null, liveRatingCount: number): number {
  if (!state) return 0;
  const { minRatings, minUsers, fullWeightRatings, maxWeight, staleTolerance } = MF_ACTIVATION;
  if (state.ratingCount < minRatings || state.distinctUsers < minUsers) return 0;

  const volumeRamp = Math.min(1, (state.ratingCount - minRatings) / (fullWeightRatings - minRatings));
  const staleness = (liveRatingCount - state.ratingCount) / Math.max(1, state.ratingCount);
  const freshness = staleness <= 0 ? 1 : Math.max(0, 1 - staleness / staleTolerance);

  return maxWeight * volumeRamp * freshness;
}
