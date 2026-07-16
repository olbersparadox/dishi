// 封印預測 (sealed predictions) — pure logic. The engine commits a prediction
// using the SAME contentScore function that ranks menu items, so the seal is
// never a separate, friendlier-looking guess bolted on for show — it's the
// real ranking signal, just written down before the person rates.
//
// Renamed from "sealed bet" per Jerry's direction: gambling framing was the
// wrong message. A seal (印) is stamped and later broken — no wager framing.

export type Direction = 'love' | 'like' | 'meh' | 'dislike';

/** Same band edges for predicted (raw contentScore, roughly -1..1-ish) and
 * actual (flick score, exactly -1..1) — one function, two callers. */
export function directionOf(score: number): Direction {
  if (score >= 0.5) return 'love';
  if (score >= 0.15) return 'like';
  if (score >= -0.15) return 'meh';
  return 'dislike';
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
