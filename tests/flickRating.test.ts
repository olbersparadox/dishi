import { describe, it, expect } from 'vitest';
import { wordKeyFor, WORD_MIN, WORD_KEYS, CHIPS } from '../src/lib/flickWords';

describe('wordKeyFor', () => {
  it('maps the full range of scores to the right word key', () => {
    expect(wordKeyFor(1)).toBe('flick.inhaled');
    expect(wordKeyFor(0.9)).toBe('flick.inhaled');
    expect(wordKeyFor(0.6)).toBe('flick.loved');
    expect(wordKeyFor(0.2)).toBe('flick.good');
    expect(wordKeyFor(0)).toBe('flick.fine');
    expect(wordKeyFor(-0.3)).toBe('flick.notforme');
    expect(wordKeyFor(-1)).toBe('flick.never');
  });

  it('has no gaps across the boundary values', () => {
    for (let s = -1; s <= 1.001; s += 0.05) {
      expect(typeof wordKeyFor(s)).toBe('string');
    }
  });

  it('REGRESSION: WORD_MIN never sits above the lowest band\'s own ceiling', () => {
    // FlickRating's commit threshold MUST equal WORD_MIN (see flickWords.ts and
    // FlickRating.tsx — COMMIT_MIN = WORD_MIN). If a threshold ever drifts back to
    // sitting ABOVE the lowest word band's ceiling, that whole band becomes
    // visible-while-dragging but silently uncommittable on release: a genuinely
    // deliberate light rating (e.g. "一般般"/so-so) would show its word, then vanish
    // with no result and no follow-up options the moment the finger lifts — exactly
    // the reported bug this test pins against.
    const lowestBandCeiling = Math.min(...WORD_KEYS.map(([min]) => Math.abs(min)));
    expect(WORD_MIN).toBeLessThanOrEqual(lowestBandCeiling);
    // And the band must have genuine reachable room above WORD_MIN, not just
    // touch it at a single point.
    expect(lowestBandCeiling - WORD_MIN).toBeGreaterThan(0.01);
  });
});

/**
 * Every rating band must be reachable by TAP, not only by swipe.
 *
 * Real bug: 'flick.good' (幾好食 / "Pretty good") had no chip, so the 0.15..0.5 band
 * — the most-used part of the scale — was swipe-only. Someone rating by tap jumped
 * straight from 一般般 (0.1) to 超好味 (0.6), silently forced into a verdict they
 * didn't mean. A tap scale that can't say what the swipe scale can say isn't an
 * accessibility fallback, it's a different, lossier instrument.
 */
describe('tap chips cover the whole rating scale', () => {
  it('every word band has a chip', () => {
    const chipKeys = new Set(CHIPS.map(c => c.key));
    for (const [, band] of WORD_KEYS) expect(chipKeys.has(band)).toBe(true);
  });

  it('每個 chip 落返自己嗰個 band — a chip must mean what it says', () => {
    // A chip whose value resolves to a DIFFERENT word than its own label would show
    // one thing and record another. Catches an off-by-one on a band boundary.
    for (const c of CHIPS) expect(wordKeyFor(c.value)).toBe(c.key);
  });

  it('every chip is above the commit threshold — no chip can be silently discarded', () => {
    for (const c of CHIPS) expect(Math.abs(c.value)).toBeGreaterThanOrEqual(WORD_MIN);
  });
});
