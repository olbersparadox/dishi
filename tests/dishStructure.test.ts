// The structural-veto half of canonical dish resolution (docs/rnd/
// dish-decomposition.md). The pairs here are the R&D's own measured cases,
// encoded as structures — these tests pin the absent/unspecified enum fix:
// the one WRONG veto the old single-`none` enum produced must stay gone, and
// the correct vetoes the naive fix ("none never conflicts") would have killed
// must stay alive.
import { describe, expect, it } from 'vitest';
import {
  slotConflicts, structureVetoes, zhNameIsGenericCategory, sanitizeStructure,
  type DishStructure,
} from '../src/lib/dishStructure';
import { CATALOG, isCategoryEntry } from '../src/lib/hkDishCatalog';
import { isStringAnchored } from '../src/lib/dishCanonical';

const s = (protein: string, method: string, base: string, parseable = true): DishStructure =>
  ({ protein, method, base, parseable });

describe('slotConflicts — absent is specified, unspecified is silence', () => {
  it('absent genuinely conflicts with a concrete value (no-carb vs rice)', () => {
    expect(slotConflicts('absent', 'rice')).toBe(true);
  });
  it('unspecified never conflicts with anything', () => {
    expect(slotConflicts('unspecified', 'rice')).toBe(false);
    expect(slotConflicts('beef', 'unspecified')).toBe(false);
    expect(slotConflicts('unspecified', 'unspecified')).toBe(false);
    expect(slotConflicts('unspecified', 'absent')).toBe(false);
  });
  it('two concrete values conflict iff they differ', () => {
    expect(slotConflicts('beef', 'pork')).toBe(true);
    expect(slotConflicts('rice', 'rice')).toBe(false);
    expect(slotConflicts('absent', 'absent')).toBe(false);
  });
});

describe('structureVetoes — the R&D pairs', () => {
  it('蝦仁炒蛋 vs 蝦仁炒飯: base absent vs rice VETOES (the veto the naive fix killed)', () => {
    expect(structureVetoes(
      s('shellfish', 'stir_fried', 'absent'),   // 蝦仁炒蛋 — genuinely no carb
      s('shellfish', 'stir_fried', 'rice'),     // 蝦仁炒飯
    )).toBe(true);
  });

  it('生滾魚片粥 vs 魚片粥: method silence does NOT veto (the old enum’s one wrong veto)', () => {
    expect(structureVetoes(
      s('fish', 'boiled_soup', 'congee'),       // 生滾魚片粥 — 生滾 names the method
      s('fish', 'unspecified', 'congee'),       // 魚片粥 — the name is just silent
    )).toBe(false);
  });

  it('白灼蝦 vs 椒鹽蝦: two specified methods that differ VETO', () => {
    expect(structureVetoes(
      s('shellfish', 'boiled_soup', 'absent'),
      s('shellfish', 'deep_fried', 'absent'),
    )).toBe(true);
  });

  it('滑蛋蝦仁 vs 滑蛋牛肉: protein conflict VETOES', () => {
    expect(structureVetoes(
      s('shellfish', 'stir_fried', 'absent'),
      s('beef', 'stir_fried', 'absent'),
    )).toBe(true);
  });

  it('stays silent when either side does not parse — structure cannot judge 絲襪奶茶', () => {
    expect(structureVetoes(
      s('beef', 'stir_fried', 'rice'),
      s('fish', 'steamed', 'noodle', false),
    )).toBe(false);
    expect(structureVetoes(
      s('beef', 'stir_fried', 'rice', false),
      s('fish', 'steamed', 'noodle'),
    )).toBe(false);
  });

  it('identical structures never veto', () => {
    const a = s('pork', 'roasted', 'rice');
    expect(structureVetoes(a, { ...a })).toBe(false);
  });
});

describe('zhNameIsGenericCategory — the residue rule', () => {
  // Why not the empty-protein-slot signal the spec first proposed: measured
  // over the full catalog (2026-07-28), 揚州炒飯 and 炒飯 decompose to the
  // IDENTICAL structure, so slots cannot tell a named style from a bare
  // category — that signal flagged 雲吞麵/星洲炒米/揚州炒飯 as categories,
  // which would have excluded them from cross-venue comparison entirely.
  it('names that are nothing but generic food words ARE categories', () => {
    expect(zhNameIsGenericCategory('炒飯')).toBe(true);   // fry + rice
    expect(zhNameIsGenericCategory('燉湯')).toBe(true);   // double-boil + soup
    expect(zhNameIsGenericCategory('烏冬')).toBe(true);   // the bare base word
    expect(zhNameIsGenericCategory('烤串')).toBe(true);   // grill + skewer
  });

  it('a distinguishing token makes a name specific — the false flags the slot signal raised', () => {
    expect(zhNameIsGenericCategory('揚州炒飯')).toBe(false); // 揚州 remains
    expect(zhNameIsGenericCategory('雲吞麵')).toBe(false);   // 雲吞 remains
    expect(zhNameIsGenericCategory('星洲炒米')).toBe(false); // 星洲 remains
    expect(zhNameIsGenericCategory('港式奶茶')).toBe(false); // the flagship merge target
    expect(zhNameIsGenericCategory('醬油拉麵')).toBe(false); // 醬油 remains
    expect(zhNameIsGenericCategory('燒肉')).toBe(false);     // 肉 is an ingredient word, deliberately not stripped
    expect(zhNameIsGenericCategory('車仔麵')).toBe(false);   // the owner's own "a set is a dish" example
  });

  it('empty input is not a category', () => {
    expect(zhNameIsGenericCategory('')).toBe(false);
    expect(zhNameIsGenericCategory('  ')).toBe(false);
  });

  it('PINS the exact derived set over the live catalog — drift must be a conscious edit here', () => {
    const derived = CATALOG.filter(e => isCategoryEntry(e.id)).map(e => e.id).sort();
    expect(derived).toEqual(['double-boiled-soup', 'fried-rice-generic', 'grilled-skewers', 'udon']);
  });
});

describe('isStringAnchored — landings the veto must not touch', () => {
  // The first live backfill's two wrong "none"s (2026-07-28): near-identical
  // names give decomposition noise room to manufacture conflicts, so a
  // landing already anchored by the entry's full zh string skips the veto.
  it('an exact-name landing is anchored — 烤豬肉串 must reach its own entry', () => {
    expect(isStringAnchored('烤豬肉串 / grilled pork skewers', '烤豬肉串')).toBe(true);
  });
  it('a qualifier on the underlying dish is anchored — 日式舒芙蕾鬆餅, 生滾魚片粥', () => {
    expect(isStringAnchored('日式舒芙蕾鬆餅 / Japanese soufflé pancakes', '舒芙蕾鬆餅')).toBe(true);
    expect(isStringAnchored('生滾魚片粥', '魚片粥')).toBe(true);
  });
  it('a fuzzy landing is NOT anchored — the veto stays armed where it belongs', () => {
    // 絲襪奶茶 -> 港式奶茶 shares zero characters: exactly the semantic-leap
    // class the veto exists to guard (it stays silent there only because the
    // name is unparseable, which is a different, deliberate gate).
    expect(isStringAnchored('絲襪奶茶', '港式奶茶')).toBe(false);
    expect(isStringAnchored('椒鹽蝦', '白灼蝦')).toBe(false);
  });
});

describe('sanitizeStructure — LLM junk degrades to silence, never to a veto', () => {
  it('the OLD enum’s `none` is not a value any more — it degrades to unspecified', () => {
    const cleaned = sanitizeStructure({ protein: 'none', method: 'none', base: 'none', parseable: true });
    expect(cleaned).toEqual({ protein: 'unspecified', method: 'unspecified', base: 'unspecified', parseable: true });
    // …and therefore can never conflict with anything:
    expect(structureVetoes(cleaned, sanitizeStructure({ protein: 'beef', method: 'stir_fried', base: 'rice', parseable: true }))).toBe(false);
  });
  it('unknown values and a missing parseable flag fail safe', () => {
    expect(sanitizeStructure({ protein: 'wagyu?!', method: 42, base: null }))
      .toEqual({ protein: 'unspecified', method: 'unspecified', base: 'unspecified', parseable: false });
    expect(sanitizeStructure(null).parseable).toBe(false);
  });
});
