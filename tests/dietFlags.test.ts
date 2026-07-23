import { describe, it, expect } from 'vitest';
import { DIET_FLAGS, dietSuspicion, sanitizeDietFlags } from '../src/lib/menuScan';
import { dict } from '../src/lib/i18n-dict';

// The 雞扎 problem: a dish named 雞 (chicken) shipped tagged 豬肉+牛肉 and no
// chicken, because the OLD schema couldn't even express poultry and string→flag
// leakage was never re-checked. These tests pin the tripwire that catches that
// class of inconsistency — WITHOUT regressing on figurative names (田雞 = frog),
// which is the whole reason strings may never author a flag.

describe('DIET_FLAGS taxonomy', () => {
  it('carries the 6 雞扎-era flags plus the two 2026-07 allergen axes', () => {
    for (const f of ['chicken', 'duck_goose', 'lamb', 'egg', 'dairy', 'offal', 'tree_nut', 'soy']) {
      expect(DIET_FLAGS as readonly string[]).toContain(f);
    }
    expect(DIET_FLAGS.length).toBe(15);
  });

  it('gluten stays deliberately OUT of the vocabulary', () => {
    // Decided 2026-07-23: trace gluten (soy sauce, oyster sauce) is near-universal
    // in Cantonese food, so an honest gluten flag would mark everything (noise) and
    // an absent one would read as a safety claim (harm). Structural gluten is
    // already visible via carb/ingredient chips. Revisit only on a real user need.
    expect(DIET_FLAGS as readonly string[]).not.toContain('gluten');
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

describe('dietSuspicion — tree_nut axis (2026-07-23)', () => {
  it('FIRES on 腰果雞丁 with no tree_nut flag or nut ingredient', () => {
    expect(dietSuspicion('Cashew chicken', '腰果雞丁', ['chicken'], ['chicken', 'bell pepper'])).toBe(true);
  });

  it('does NOT fire on a correctly-tagged 腰果雞丁', () => {
    expect(dietSuspicion('Cashew chicken', '腰果雞丁', ['chicken', 'tree_nut'], ['chicken', 'cashew'])).toBe(false);
  });

  it('does NOT demand tree_nut of 蝦仁 — 仁 alone is never a nut morpheme', () => {
    expect(dietSuspicion('Shrimp fried rice', '蝦仁炒飯', ['shellfish', 'egg'], ['shrimp', 'rice', 'egg'])).toBe(false);
  });

  it('does NOT demand tree_nut of 栗子雞 — chestnut is excluded from the flag', () => {
    expect(dietSuspicion('Chestnut chicken', '栗子炆雞', ['chicken'], ['chicken', 'chestnut'])).toBe(false);
  });

  it('杏仁豆腐: stripped as a trap, tree_nut flag supported by apricot kernel', () => {
    // The dessert has no soybean (agar/milk) — the trap stops the 豆腐 morpheme from
    // demanding soy on every enrichment, while its genuine tree_nut flag stays
    // consistent through the ingredient keys.
    expect(dietSuspicion('Almond tofu', '杏仁豆腐', ['tree_nut', 'dairy'], ['apricot kernel', 'milk', 'agar'])).toBe(false);
  });

  it('FIRES when tree_nut is flagged with nothing backing it', () => {
    expect(dietSuspicion('Steamed fish', '清蒸魚', ['seafood', 'tree_nut'], ['fish', 'ginger', 'scallion'])).toBe(true);
  });
});

describe('dietSuspicion — soy axis, structural-only (2026-07-23)', () => {
  it('FIRES on 麻婆豆腐 with no soy flag or soy-food ingredient', () => {
    expect(dietSuspicion('Mapo tofu', '麻婆豆腐', ['pork', 'spicy'], ['pork', 'chili', 'sichuan pepper'])).toBe(true);
  });

  it('does NOT fire on a correctly-tagged 麻婆豆腐', () => {
    expect(dietSuspicion('Mapo tofu', '麻婆豆腐', ['soy', 'pork', 'spicy'], ['tofu', 'pork', 'chili'])).toBe(false);
  });

  it('does NOT demand soy of 豉油雞 — soy sauce as seasoning is outside the flag', () => {
    // Neither 'soy' (EN) nor bare 豉油 is a morpheme: the structural framing means a
    // soy-sauce dish name carries no soy expectation at all.
    expect(dietSuspicion('Soy sauce chicken', '豉油雞', ['chicken'], ['chicken', 'soy sauce', 'ginger'])).toBe(false);
  });

  it('FIRES when soy is flagged on soy-sauce-trace evidence only', () => {
    // 'soy sauce' deliberately does not satisfy the soy ingredient keys — a
    // trace-based flag earns its one recipe re-check.
    expect(dietSuspicion('Fried rice', '炒飯', ['soy', 'egg'], ['rice', 'egg', 'soy sauce'])).toBe(true);
  });

  it('does NOT demand soy of 紅豆沙 — bare 豆 is never a soy morpheme', () => {
    expect(dietSuspicion('Red bean soup', '紅豆沙', ['veg'], ['red bean', 'sugar', 'dried tangerine peel'])).toBe(false);
  });
});
