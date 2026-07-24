import { describe, it, expect } from 'vitest';
import { chopGlyph, chopColorFor, chopColorMap } from '../src/lib/chop';

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

describe('chop color = f(user_id) — 2026-07-24 field-test fix', () => {
  // Two members at a real table both rendered the SAME green on every screen:
  // the seed was the display NAME (two names can collide; renaming changed your
  // color) and nothing guarded the 1-in-6 hash collision. Color now derives
  // from user_id, and within a known member set collisions are resolved.
  const A = '4d1c3ae0-47d9-4cba-b35e-179c134271bf';
  const B = 'b7e2f9d1-1234-4abc-9def-0123456789ab';

  it('chopColorFor is deterministic for the same user_id', () => {
    expect(chopColorFor(A)).toBe(chopColorFor(A));
  });

  it('never lands in the seal/vermillion hue (never returns the seal hex)', () => {
    for (const id of [A, B, 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      expect(chopColorFor(id)).not.toBe('#c73e1d');
      expect(chopColorFor(id)).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('chopColorMap gives ANY two members of a set different colors, even hash-colliding ids', () => {
    // Find two ids whose solo colors collide, to prove the map de-collides them.
    let collider = '';
    for (let i = 0; i < 500; i++) {
      const cand = `probe-${i}`;
      if (cand !== A && chopColorFor(cand) === chopColorFor(A)) { collider = cand; break; }
    }
    expect(collider).not.toBe(''); // 6 colors — a collision must exist in 500 probes
    const map = chopColorMap([A, collider]);
    expect(map.get(A)).not.toBe(map.get(collider));
  });

  it('the assignment depends only on the id SET, not order — same colors on every client', () => {
    const forward = chopColorMap([A, B, 'u-third']);
    const shuffled = chopColorMap(['u-third', A, B]);
    expect(Object.fromEntries(forward)).toEqual(Object.fromEntries(shuffled));
  });

  it('a non-colliding member keeps their own solo color inside a set (same color on every screen)', () => {
    const map = chopColorMap([A, B]);
    // At least one of the two must hold their solo color; when they do not
    // collide, BOTH do.
    if (chopColorFor(A) !== chopColorFor(B)) {
      expect(map.get(A)).toBe(chopColorFor(A));
      expect(map.get(B)).toBe(chopColorFor(B));
    }
  });

  it('a 6-member table is fully distinct; a 7th wraps rather than throwing', () => {
    const six = Array.from({ length: 6 }, (_, i) => `member-${i}`);
    const sixColors = new Set(chopColorMap(six).values());
    expect(sixColors.size).toBe(6);
    const seven = chopColorMap([...six, 'member-6']);
    expect(seven.size).toBe(7); // everyone still gets a color
  });

  it('is stable across repeated calls (stable across renders)', () => {
    const a = chopColorMap([A, B]);
    const b = chopColorMap([A, B]);
    expect(Object.fromEntries(a)).toEqual(Object.fromEntries(b));
  });
});
