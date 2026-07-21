import { describe, it, expect } from 'vitest';
import { chopGlyph } from '../src/lib/chop';

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
