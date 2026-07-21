import { describe, it, expect } from 'vitest';
import { chopGlyph, chopColor } from '../src/lib/chop';

describe('chopGlyph', () => {
  it('uppercases a Latin first letter for a single word', () => {
    expect(chopGlyph('jerry')).toBe('J');
    expect(chopGlyph('mosuko-i47v')).toBe('M');
  });

  it('takes both initials for a two-word Latin name', () => {
    expect(chopGlyph('Jerry Chu')).toBe('JC');
    expect(chopGlyph('jerry chu')).toBe('JC'); // uppercased regardless of input case
  });

  it('takes first + last initial for 3+ words, not the middle ones', () => {
    expect(chopGlyph('Jerry Middle Chu')).toBe('JC');
  });

  it('keeps a CJK first character as-is (no case to change, no initials to draw)', () => {
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

describe('chopColor', () => {
  it('is deterministic for the same name', () => {
    expect(chopColor('mosuko')).toBe(chopColor('mosuko'));
  });

  it('never lands in the seal/vermillion hue (never returns the seal hex)', () => {
    for (const name of ['mosuko', 'wool.hk', 'Jerry Chu', '陳大文', 'a', 'b', 'c', 'd', 'e', 'f']) {
      expect(chopColor(name)).not.toBe('#c73e1d');
    }
  });

  it('returns a valid hex color', () => {
    expect(chopColor('anyone')).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});
