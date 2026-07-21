import { describe, it, expect } from 'vitest';
import { chopGlyph, deriveChopStyle } from '../src/lib/chop';

describe('chopGlyph', () => {
  it('uppercases a Latin first letter', () => {
    expect(chopGlyph('jerry')).toBe('J');
    expect(chopGlyph('mosuko-i47v')).toBe('M');
  });

  it('keeps a CJK first character as-is (no case to change)', () => {
    expect(chopGlyph('陳大文')).toBe('陳');
  });

  it('handles surrogate-pair codepoints without mangling them', () => {
    // A char outside the BMP (e.g. an emoji) is TWO UTF-16 code units; naive
    // string[0] slicing would return a lone unpaired surrogate.
    const name = '\u{1F600}smile';
    expect(chopGlyph(name)).toBe('\u{1F600}');
  });

  it('falls back to "?" for empty or whitespace-only input', () => {
    expect(chopGlyph('')).toBe('?');
    expect(chopGlyph('   ')).toBe('?');
  });

  it('trims surrounding whitespace before reading the first character', () => {
    expect(chopGlyph('  jerry')).toBe('J');
  });
});

describe('deriveChopStyle', () => {
  it('is deterministic: the same user id always yields the same style', () => {
    const id = 'a1b2c3d4-user-id';
    expect(deriveChopStyle(id)).toEqual(deriveChopStyle(id));
  });

  it('varies across different user ids', () => {
    const a = deriveChopStyle('user-one');
    const b = deriveChopStyle('user-two');
    expect(a).not.toEqual(b);
  });

  it('keeps every output field inside its documented range', () => {
    for (const id of ['x', 'y', 'z', 'a-longer-uuid-like-string-1234']) {
      const s = deriveChopStyle(id);
      expect(s.radius).toBeGreaterThanOrEqual(4);
      expect(s.radius).toBeLessThanOrEqual(15);
      expect(s.rotate).toBeGreaterThanOrEqual(-7);
      expect(s.rotate).toBeLessThanOrEqual(7);
      expect([1.5, 2]).toContain(s.borderWidth);
      expect([600, 700, 800]).toContain(s.weight);
    }
  });

  it('never throws on an empty id (falls back to a fixed seed)', () => {
    expect(() => deriveChopStyle('')).not.toThrow();
  });
});
