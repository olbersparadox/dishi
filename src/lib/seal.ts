// 封印預測 (sealed predictions) — pure logic. The engine commits a prediction
// using the SAME contentScore function that ranks menu items, so the seal is
// never a separate, friendlier-looking guess bolted on for show — it's the
// real ranking signal, just written down before the person rates.
//
// Renamed from "sealed bet" per Jerry's direction: gambling framing was the
// wrong message. A seal (印) is stamped and later broken — no wager framing.

export type Direction = 'love' | 'like' | 'meh' | 'dislike';

/**
 * Band a score on the FLICK scale (exactly -1..1). This is what the person
 * actually did, so it stays absolute and is the sole judge of `actual_direction`
 * — the seal is a claim about the flick they made.
 *
 * It is NO LONGER used to band a prediction. `contentScore` output is not on the
 * flick scale and never really was; see predictedDirectionOf.
 */
export function directionOf(score: number): Direction {
  if (score >= 0.5) return 'love';
  if (score >= 0.15) return 'like';
  if (score >= -0.15) return 'meh';
  return 'dislike';
}

/**
 * Band a PREDICTION, by mapping it onto the person's own flick scale first.
 *
 * Why this is not just `directionOf(raw)` any more. Those edges are 0.35 apart,
 * but `contentScore`'s entire spread across a real palate's 36 seals is ~0.26 —
 * narrower than a single band. Fixed edges cannot carve a distribution thinner
 * than one band, so every prediction collapsed into whichever band the range
 * happened to overlap: measured 5/36 hits, only 2 of 4 bands ever used, `love`
 * and `dislike` unreachable. The self-calibrating rating scale made this
 * undeniable by shrinking the spread further, but the mismatch predates it —
 * the two scales were never commensurable.
 *
 * QUANTILE MAPPING, not refitted edges. Take where `raw` sits within what the
 * engine predicts across dishes this person HAS rated, then read the flick value
 * at that same position in what they ACTUALLY flick. Band that with directionOf.
 * Nothing is fitted to seal outcomes — the mapping falls out of the two
 * distributions — so it cannot overfit the way a hand-picked edge would (the
 * objection that has kept `dislike` parked; see docs/rnd/seal-band-calibration.md
 * §9c, §11, §12).
 *
 * Two properties worth keeping:
 * - The predicted band distribution matches the person's real one BY
 *   CONSTRUCTION, so the seal can never be systematically miscalibrated. Its
 *   accuracy reduces to whether the engine RANKS dishes correctly, which is the
 *   thing worth measuring.
 * - It degrades honestly. Someone who has only ever flicked 幾好食 has a flat
 *   actual distribution, so every prediction maps back to 幾好食 — the truthful
 *   call, not manufactured variety.
 *
 * Measured (scripts/simulate-seal-percentile-bands.ts, 36 real seals): hits
 * 5 → 20, misses 8 → 0, bands used 2 → 4, `dislike` 2/2 for the first time.
 * Beats or ties a constant predictor across generous / harsh / discriminating /
 * one-note rating styles, and beats the shipped fixed edges at every history
 * size from the seal gate upward.
 */
export function predictedDirectionOf(
  raw: number,
  /** contentScore across the dishes this person has rated. */
  predictedDist: number[],
  /** The flick scores this person has actually given. */
  actualScores: number[],
): Direction {
  // No history to calibrate against — nothing honest to map onto, so fall back
  // to the absolute reading rather than inventing a distribution.
  if (!predictedDist.length || !actualScores.length) return directionOf(raw);

  // Where `raw` sits in the predicted distribution. Ties count as half, so a
  // value equal to several others lands among them instead of at one end.
  let below = 0, equal = 0;
  for (const v of predictedDist) { if (v < raw) below++; else if (v === raw) equal++; }
  const p = (below + equal / 2) / predictedDist.length;

  // The flick at that same position, linearly interpolated.
  const sorted = [...actualScores].sort((a, b) => a - b);
  const i = Math.min(sorted.length - 1, Math.max(0, p * (sorted.length - 1)));
  const lo = Math.floor(i), hi = Math.ceil(i);
  return directionOf(lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo));
}

const ORDER: Direction[] = ['dislike', 'meh', 'like', 'love'];

export type Outcome = 'hit' | 'near' | 'miss';

export function outcomeOf(predicted: Direction, actual: Direction): Outcome {
  const gap = Math.abs(ORDER.indexOf(predicted) - ORDER.indexOf(actual));
  if (gap === 0) return 'hit';
  if (gap === 1) return 'near';
  return 'miss';
}

/** Minimum profile maturity before the engine is allowed to seal a
 * prediction at all — matches the training gate elsewhere in the app. */
export const SEAL_GATE = 5;
