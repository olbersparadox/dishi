import { describe, it, expect } from 'vitest';
import { shapeTableMenuItems, mergeFinalScanItems, scanCandidateKey } from '../src/lib/tableMenuItems';

describe('shapeTableMenuItems', () => {
  it('carries through name/price/cuisine and Stage-2 fields', () => {
    const out = shapeTableMenuItems([{
      name: 'Char Siu', name_zh: '叉燒', name_original: '叉燒', price: '$128', cuisine: 'cantonese',
      hook: 'Sweet Sticky Glazed', diet: ['pork'], cooking_method: 'grilled', heaviness: 'medium',
      ingredients: ['pork', 'maltose'], attributes: { salt: 0.5 },
    }]);
    expect(out).toEqual([{
      name: 'Char Siu', name_zh: '叉燒', name_original: '叉燒', price: '$128', cuisine: 'cantonese',
      hook: 'Sweet Sticky Glazed', diet: ['pork'], cooking_method: 'grilled', heaviness: 'medium',
      ingredients: ['pork', 'maltose'], attributes: { salt: 0.5 },
    }]);
  });

  it('drops an item with no usable name', () => {
    expect(shapeTableMenuItems([{ name: '', price: '$10' }])).toEqual([]);
    expect(shapeTableMenuItems([{ price: '$10' }])).toEqual([]);
  });

  it('never trusts match/reason/fire/raw_score fields (a scanner-personal signal, not a table one)', () => {
    const out = shapeTableMenuItems([{ name: 'Dish', match: 92, reason: 'x', fire: true, raw_score: 0.5 }]);
    expect(out[0]).not.toHaveProperty('match');
    expect(out[0]).not.toHaveProperty('reason');
    expect(out[0]).not.toHaveProperty('fire');
    expect(out[0]).not.toHaveProperty('raw_score');
  });

  it('falls back name_original to name, cuisine to "unknown", hook to "" when absent', () => {
    const out = shapeTableMenuItems([{ name: 'Dish' }]);
    expect(out[0]).toMatchObject({ name_original: 'Dish', cuisine: 'unknown', hook: '', name_zh: null, price: null });
  });

  it('re-sanitizes diet/cooking_method/heaviness rather than trusting the client verbatim', () => {
    const out = shapeTableMenuItems([{ name: 'Dish', diet: ['not-a-real-flag'], cooking_method: 'nonsense', heaviness: 'nonsense' }]);
    expect(out[0].diet).toEqual([]);
    expect(out[0].cooking_method).toBeNull();
    expect(out[0].heaviness).toBeNull();
  });

  it('caps ingredients at 4, trimmed', () => {
    const out = shapeTableMenuItems([{ name: 'Dish', ingredients: ['  a  ', 'b', 'c', 'd', 'e'] }]);
    expect(out[0].ingredients).toEqual(['a', 'b', 'c', 'd']);
  });

  it('respects the cap parameter, keeping the first N', () => {
    const items = Array.from({ length: 5 }, (_, i) => ({ name: `Dish ${i}` }));
    const out = shapeTableMenuItems(items, 3);
    expect(out.map(i => i.name)).toEqual(['Dish 0', 'Dish 1', 'Dish 2']);
  });

  it('defaults the cap to 40', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ name: `Dish ${i}` }));
    expect(shapeTableMenuItems(items)).toHaveLength(40);
  });
});

// Table Mode two-account field test (2026-07-24): the shared session received
// items ONCE at creation, so the namefix/enrich/score passes only ever updated
// the scanner's local view — a joiner saw untranslated Japanese all meal. These
// pin the ONE shared builder every sync path (fresh-scan reauthor, scan append,
// /table add-a-page) now folds its finished stages through.
describe('mergeFinalScanItems', () => {
  const item = {
    name: 'Sun-dried Horse Mackerel Set', name_zh: '天日干しアジの開き定食',
    name_original: '天日干しアジの開き定食', price: '¥1200', hook: '', cuisine: 'japanese',
    attributes: {} as Record<string, number>, diet: [] as string[],
    cooking_method: null as string | null, heaviness: null as string | null, ingredients: [] as string[],
  };

  it('folds the namefix map into name_zh — the stale-closure leak that shipped untranslated names', () => {
    const out = mergeFinalScanItems([item], null, null, { '天日干しアジの開き定食': '天日干竹筴魚一夜乾定食' });
    expect(out[0].name_zh).toBe('天日干竹筴魚一夜乾定食');
    expect(out[0].name_original).toBe('天日干しアジの開き定食'); // verbatim always — standing rule
  });

  it('takes hook/diet/cooking/heaviness/ingredients from enrich and attributes from score, positionally', () => {
    const enriched = [{ ...item, hook: 'charcoal-grilled', diet: ['seafood'], cooking_method: 'grilled', heaviness: 'light', ingredients: ['horse mackerel'] }];
    const scored = [{ ...item, attributes: { umami: 0.9 } }];
    const out = mergeFinalScanItems([item], enriched, scored, {});
    expect(out[0]).toMatchObject({
      hook: 'charcoal-grilled', diet: ['seafood'], cooking_method: 'grilled',
      heaviness: 'light', ingredients: ['horse mackerel'], attributes: { umami: 0.9 },
    });
  });

  it('a failed stage (null slot) falls back to the item own fields instead of dropping them', () => {
    const withOwn = { ...item, hook: 'own hook', attributes: { salt: 0.2 } };
    const out = mergeFinalScanItems([withOwn], [null], [null], {});
    expect(out[0].hook).toBe('own hook');
    expect(out[0].attributes).toEqual({ salt: 0.2 });
  });

  it('leaves name_zh alone for items the namefix did not touch', () => {
    const out = mergeFinalScanItems([{ ...item, name_zh: '叉燒' }], null, null, { somethingelse: 'x' });
    expect(out[0].name_zh).toBe('叉燒');
  });
});

describe('scanCandidateKey', () => {
  it('keys a scan-shared candidate by name_original — the same key the scan screen picks with', () => {
    expect(scanCandidateKey({ name_original: '天日干しアジの開き定食', name: 'Mackerel Set' }, 3)).toBe('天日干しアジの開き定食');
  });

  it('survives re-authoring: the key is the one field translation/enrich never touch', () => {
    // Before and after a namefix pass, the same stored item yields the same key.
    const before = { name_original: 'トロホッケ炭火燒定食', name: 'Toro Hocke Set', name_zh: 'トロホッケ炭火燒定食' };
    const after = { ...before, name_zh: '肥壕炭火燒定食' };
    expect(scanCandidateKey(after, 5)).toBe(scanCandidateKey(before, 5));
  });

  it('falls back to name, then the index, only for degenerate stored items', () => {
    expect(scanCandidateKey({ name: 'Only Name' }, 2)).toBe('Only Name');
    expect(scanCandidateKey({}, 7)).toBe('menu-7');
  });
});
