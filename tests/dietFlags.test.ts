import { describe, it, expect } from 'vitest';
import { DIET_FLAGS, dietSuspicion, sanitizeDietFlags } from '../src/lib/menuScan';
import { dict } from '../src/lib/i18n-dict';

// The 雞扎 problem: a dish named 雞 (chicken) shipped tagged 豬肉+牛肉 and no
// chicken, because the OLD schema couldn't even express poultry and string→flag
// leakage was never re-checked. These tests pin the tripwire that catches that
// class of inconsistency — WITHOUT regressing on figurative names (田雞 = frog),
// which is the whole reason strings may never author a flag.

describe('DIET_FLAGS taxonomy', () => {
  it('carries the 6 new flags on top of the original 7', () => {
    for (const f of ['chicken', 'duck_goose', 'lamb', 'egg', 'dairy', 'offal']) {
      expect(DIET_FLAGS as readonly string[]).toContain(f);
    }
    expect(DIET_FLAGS.length).toBe(13);
  });

  it('every flag has a zh + en i18n label (parity)', () => {
    for (const f of DIET_FLAGS) {
      const entry = dict[`scan.diet.${f}` as keyof typeof dict];
      expect(entry, `missing label for ${f}`).toBeTruthy();
      expect(entry.zh.length, `${f}.zh empty`).toBeGreaterThan(0);
      expect(entry.en.length, `${f}.en empty`).toBeGreaterThan(0);
    }
  });
});

describe('sanitizeDietFlags accepts the expanded vocabulary', () => {
  it('keeps all 6 new values', () => {
    expect(sanitizeDietFlags(['chicken', 'duck_goose', 'lamb', 'egg', 'dairy', 'offal']).sort())
      .toEqual(['chicken', 'dairy', 'duck_goose', 'egg', 'lamb', 'offal']);
  });
  it('still rejects free text outside the closed set', () => {
    expect(sanitizeDietFlags(['poultry', 'CHICKEN', 'gluten'])).toEqual(['chicken']);
  });
});

describe('dietSuspicion — the tripwire', () => {
  it('FIRES on 雞扎 tagged pork+beef with no chicken anywhere', () => {
    // The exact production bug: 雞 in the name, but flags are pork+beef and no
    // ingredient backs any of it. Both rules fire here; either is enough.
    expect(dietSuspicion('雞扎', '雞扎', ['pork', 'beef'], [])).toBe(true);
  });

  it('does NOT fire when flags and ingredients match the name (燒賣)', () => {
    expect(dietSuspicion('Siu mai', '燒賣', ['pork'], ['pork', 'shrimp'])).toBe(false);
  });

  it('does NOT fire on 菠蘿包 — no pineapple flag exists to contradict', () => {
    expect(dietSuspicion('Pineapple bun', '菠蘿包', [], ['flour', 'butter', 'sugar'])).toBe(false);
  });

  it('does NOT demand chicken of 田雞 (frog) — the key anti-regression case', () => {
    // 田雞 literally contains 雞, but it is frog. A string must NEVER author a
    // flag; the figurative name is stripped before morpheme scanning, so the
    // tripwire stays silent rather than "correcting" a correct dish.
    expect(dietSuspicion('Frog legs', '田雞', [], ['frog legs'])).toBe(false);
  });

  it('does NOT demand beef of 牛油 (butter)', () => {
    expect(dietSuspicion('Butter', '牛油', ['dairy'], ['butter'])).toBe(false);
  });

  it('does NOT fire on a correctly-tagged 雞扎 (chicken flag + supporting recipe)', () => {
    expect(dietSuspicion('Chicken roll', '雞扎', ['chicken'], ['chicken', 'ham', 'fish maw'])).toBe(false);
  });

  it('FIRES when a protein flag has no support in name or ingredients', () => {
    // Rule 2 in isolation: nothing named or cooked says beef, yet beef is flagged.
    expect(dietSuspicion('Tomato omelette', '番茄炒蛋', ['beef', 'egg'], ['egg', 'tomato'])).toBe(true);
  });

  it('FIRES when the name states a protein the flags/ingredients ignore', () => {
    // Rule 1 in isolation: 鴨 (duck) named, but nothing carries it.
    expect(dietSuspicion('Roast duck rice', '燒鴨飯', ['pork'], ['pork', 'rice'])).toBe(true);
  });

  it('accepts ingredient support even when the flag is absent (egg tart)', () => {
    // 蛋 named, no egg flag, but "egg" is in the ingredients — consistent, no re-ask.
    expect(dietSuspicion('Egg tart', '蛋撻', ['veg'], ['egg', 'butter', 'sugar'])).toBe(false);
  });
});
