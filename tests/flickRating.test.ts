import { describe, it, expect } from 'vitest';
import { wordKeyFor } from '../src/lib/flickWords';

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
});
