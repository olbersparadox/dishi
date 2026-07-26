import { describe, it, expect } from 'vitest';
import { directionOf, predictedDirectionOf, outcomeOf, SEAL_GATE } from '../src/lib/seal';

describe('directionOf bands', () => {
  it('bands cover the full range in order', () => {
    expect(directionOf(0.9)).toBe('love');
    expect(directionOf(0.5)).toBe('love');
    expect(directionOf(0.3)).toBe('like');
    expect(directionOf(0.15)).toBe('like');
    expect(directionOf(0)).toBe('meh');
    expect(directionOf(-0.15)).toBe('meh');
    expect(directionOf(-0.4)).toBe('dislike');
    expect(directionOf(-1)).toBe('dislike');
  });
});

/**
 * Per-user prediction banding (2026-07-26). Fixed edges are 0.35 apart but
 * contentScore's whole spread on a real palate is ~0.26, so every prediction
 * used to collapse into one band — 5/36 hits, 2 of 4 bands ever used. See
 * docs/rnd/seal-band-calibration.md §11-12 and
 * scripts/simulate-seal-percentile-bands.ts.
 */
describe('predictedDirectionOf — banding a prediction on the person\'s own scale', () => {
  // A realistically NARROW predicted spread: every value sits inside the single
  // `meh` band under fixed edges, which is exactly the production failure.
  const narrow = [0.02, 0.05, 0.07, 0.09, 0.11, 0.13, 0.14];
  // A person who uses the whole flick range.
  const spread = [-0.9, -0.5, 0.1, 0.35, 0.35, 0.6, 1.0];

  it('REGRESSION: rescues a prediction that fixed edges collapse into one band', () => {
    // Top of this person's predicted range. The old code read 0.14 absolutely
    // and called `meh`; it is in fact the best dish the engine has ever scored
    // for them, and they do genuinely love things.
    expect(directionOf(0.14)).toBe('meh');          // <- the shipped bug, pinned
    expect(predictedDirectionOf(0.14, narrow, spread)).toBe('love');

    // ...and the bottom of the same range is not the same call, which is the
    // whole point — the band actually varies now.
    expect(predictedDirectionOf(0.02, narrow, spread)).toBe('dislike');
  });

  it('uses more than one band across a narrow predicted range', () => {
    const called = new Set(narrow.map(r => predictedDirectionOf(r, narrow, spread)));
    expect(called.size).toBeGreaterThan(1);
    // The old behaviour, for contrast: every one of them is the same band.
    expect(new Set(narrow.map(directionOf)).size).toBe(1);
  });

  it('adapts to the RATER, not just the dish — same score, different people', () => {
    // Identical engine output and identical predicted distribution; the only
    // difference is how these two people express themselves. A generous rater's
    // mid-range dish is ordinary; a harsh rater's mid-range dish is a highlight.
    const generous = [0.35, 0.35, 0.35, 0.6, 0.6, 1.0, 1.0];
    const harsh = [-0.9, -0.9, -0.5, -0.5, 0.1, 0.1, 0.35];
    const mid = 0.09;
    expect(predictedDirectionOf(mid, narrow, generous))
      .not.toBe(predictedDirectionOf(mid, narrow, harsh));
  });

  it('degrades honestly for a one-note rater instead of inventing variety', () => {
    // Someone who has only ever flicked 幾好食. There is no real spread to map
    // onto, so the only truthful prediction is 幾好食 — every time.
    const oneNote = [0.35, 0.35, 0.35, 0.35, 0.35];
    const calls = narrow.map(r => predictedDirectionOf(r, narrow, oneNote));
    expect(new Set(calls)).toEqual(new Set(['like'])); // directionOf(0.35) === 'like'
  });

  it('never bands a stronger prediction below a weaker one', () => {
    // Monotonicity: quantile mapping must preserve the engine's ordering, or the
    // seal would contradict the ranking it was derived from.
    const ORDER = ['dislike', 'meh', 'like', 'love'];
    const ranks = [...narrow].sort((a, b) => a - b)
      .map(r => ORDER.indexOf(predictedDirectionOf(r, narrow, spread)));
    for (let i = 1; i < ranks.length; i++) expect(ranks[i]).toBeGreaterThanOrEqual(ranks[i - 1]);
  });

  it('falls back to the absolute reading when there is no history to map onto', () => {
    // A brand-new profile has nothing to calibrate against; inventing a
    // distribution would be worse than reading the score at face value.
    expect(predictedDirectionOf(0.6, [], [])).toBe(directionOf(0.6));
    expect(predictedDirectionOf(0.6, narrow, [])).toBe(directionOf(0.6));
    expect(predictedDirectionOf(0.6, [], spread)).toBe(directionOf(0.6));
  });

  it('places an out-of-range prediction at the corresponding extreme', () => {
    // A dish scoring above anything the engine has seen for this person is
    // their new best; below anything, their new worst.
    expect(predictedDirectionOf(99, narrow, spread)).toBe(directionOf(Math.max(...spread)));
    expect(predictedDirectionOf(-99, narrow, spread)).toBe(directionOf(Math.min(...spread)));
  });
});

describe('outcomeOf', () => {
  it('exact match is a hit', () => {
    expect(outcomeOf('love', 'love')).toBe('hit');
    expect(outcomeOf('dislike', 'dislike')).toBe('hit');
  });
  it('adjacent band is near', () => {
    expect(outcomeOf('love', 'like')).toBe('near');
    expect(outcomeOf('meh', 'like')).toBe('near');
    expect(outcomeOf('meh', 'dislike')).toBe('near');
  });
  it('opposite ends are a miss', () => {
    expect(outcomeOf('love', 'dislike')).toBe('miss');
    expect(outcomeOf('love', 'meh')).toBe('miss');
  });
});

describe('SEAL_GATE', () => {
  it('matches the training-gate style threshold used elsewhere (>=5)', () => {
    expect(SEAL_GATE).toBe(5);
  });
});
