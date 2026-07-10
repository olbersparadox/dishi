import { describe, it, expect } from 'vitest';
import { wordKeyFor, WORD_MIN, WORD_KEYS } from '../src/lib/flickWords';

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
