import { describe, it, expect } from 'vitest';
import { directionOf, outcomeOf, SEAL_GATE } from '../src/lib/seal';

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
