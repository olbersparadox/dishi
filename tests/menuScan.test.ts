import { describe, it, expect } from 'vitest';
import {
  sanitizeItem, sanitizeSkeletonItem, sanitizeDietFlags, sanitizeCookingMethod,
  sanitizeHeaviness, sanitizeIngredients, DIET_FLAGS, COOKING_METHODS, HEAVINESS,
} from '../src/lib/menuScan';

describe('sanitizeDietFlags — closed vocabulary, never free text', () => {
  it('keeps only flags from the fixed vocabulary', () => {
    expect(sanitizeDietFlags(['pork', 'spicy', 'made-up-flag', 'gluten-free'])).toEqual(['pork', 'spicy']);
  });
  it('lowercases and dedupes', () => {
    expect(sanitizeDietFlags(['PORK', 'pork', 'Spicy'])).toEqual(['pork', 'spicy']);
  });
  it('non-array or missing input -> empty, never throws', () => {
    expect(sanitizeDietFlags(undefined)).toEqual([]);
    expect(sanitizeDietFlags('pork')).toEqual([]);
    expect(sanitizeDietFlags(null)).toEqual([]);
  });
  it('every value in the exported vocabulary round-trips', () => {
    for (const flag of DIET_FLAGS) expect(sanitizeDietFlags([flag])).toEqual([flag]);
  });
});

describe('sanitizeCookingMethod / sanitizeHeaviness — closed enums', () => {
  it('accepts only vocabulary values, case-insensitive', () => {
    expect(sanitizeCookingMethod('Grilled')).toBe('grilled');
    expect(sanitizeCookingMethod('deep-fried-twice')).toBeNull();
    expect(sanitizeCookingMethod(undefined)).toBeNull();
  });
  it('every cooking method in the exported vocabulary round-trips', () => {
    for (const m of COOKING_METHODS) expect(sanitizeCookingMethod(m)).toBe(m);
  });
  it('heaviness accepts only light/medium/heavy', () => {
    expect(sanitizeHeaviness('Heavy')).toBe('heavy');
    expect(sanitizeHeaviness('extremely heavy')).toBeNull();
    for (const h of HEAVINESS) expect(sanitizeHeaviness(h)).toBe(h);
  });
});

describe('sanitizeIngredients', () => {
  it('caps at 4, lowercases, drops empties', () => {
    expect(sanitizeIngredients(['Tofu', 'Chili', 'Garlic', 'Scallion', 'Ginger'])).toEqual(['tofu', 'chili', 'garlic', 'scallion']);
    expect(sanitizeIngredients(['', 'salt'])).toEqual(['salt']);
  });
  it('non-array -> empty', () => { expect(sanitizeIngredients('tofu')).toEqual([]); });
});

describe('sanitizeSkeletonItem — Stage 1, identity fields only', () => {
  it('parses the light schema: name/price/cuisine, nothing else populated', () => {
    const item = sanitizeSkeletonItem({ n: 'Mapo tofu', z: '麻婆豆腐', o: '麻婆豆腐', p: '$78', c: 'sichuan', f: 0.9 });
    expect(item?.name).toBe('Mapo tofu');
    expect(item?.price).toBe('$78');
    expect(item?.cuisine).toBe('sichuan');
  });
  it('every enrichment-stage field starts at an honest empty, not a guess', () => {
    // '' / [] / null are distinguishable from "enriched and genuinely has none" via
    // the client-side `enriched` flag — this function must never fabricate a hook
    // or diet flag just because the fast pass has no way to know them yet.
    const item = sanitizeSkeletonItem({ n: 'X', c: 'x', f: 0.5 });
    expect(item?.hook).toBe('');
    expect(item?.hook_zh).toBe('');
    expect(item?.diet).toEqual([]);
    expect(item?.cooking_method).toBeNull();
    expect(item?.heaviness).toBeNull();
    expect(item?.ingredients).toEqual([]);
    expect(item?.attributes).toEqual({});
  });
  it('missing name -> null, never a fabricated dish', () => {
    expect(sanitizeSkeletonItem({ c: 'x', f: 0.5 })).toBeNull();
  });
});

describe('sanitizeItem — full item assembly (owner-upload path + Stage 2 merge shape)', () => {
  it('parses a fully-populated real-shaped response', () => {
    const item = sanitizeItem({
      n: 'Mapo tofu', z: '麻婆豆腐', o: '麻婆豆腐', p: '$78', c: 'sichuan', h: 'numbing heat', f: 0.9,
      d: ['veg', 'spicy'], m: 'braised', w: 'medium', i: ['tofu', 'chili'],
    });
    expect(item?.diet).toEqual(['veg', 'spicy']);
    expect(item?.cooking_method).toBe('braised');
    expect(item?.heaviness).toBe('medium');
    expect(item?.ingredients).toEqual(['tofu', 'chili']);
  });

  it('REGRESSION: an item from the OLDER prompt schema (no new fields) still parses cleanly', () => {
    // The single-call owner-menu-upload path (scanMenu/SYSTEM) never got these
    // fields added — sanitizeItem is shared, so it must degrade gracefully rather
    // than crash or fabricate values for a response that simply omits them.
    const item = sanitizeItem({ n: 'Char siu', c: 'cantonese', h: 'lacquered char', f: 0.8 });
    expect(item).not.toBeNull();
    expect(item?.diet).toEqual([]);
    expect(item?.cooking_method).toBeNull();
    expect(item?.heaviness).toBeNull();
    expect(item?.ingredients).toEqual([]);
  });

  it('a garbage diet flag or cooking method from the model never leaks into the item', () => {
    const item = sanitizeItem({ n: 'X', c: 'x', h: 'x', d: ['nonsense'], m: 'deep-fried-in-lava' });
    expect(item?.diet).toEqual([]);
    expect(item?.cooking_method).toBeNull();
  });

  it('parses the bilingual hook (hz), matching the name/name_zh pattern used elsewhere', () => {
    const item = sanitizeItem({ n: 'Mapo tofu', c: 'sichuan', h: 'Numbing Heat', hz: '麻辣鮮香' });
    expect(item?.hook).toBe('Numbing Heat');
    expect(item?.hook_zh).toBe('麻辣鮮香');
  });

  it('missing hz -> empty string, not a fabricated translation', () => {
    const item = sanitizeItem({ n: 'X', c: 'x', h: 'English only' });
    expect(item?.hook).toBe('English only');
    expect(item?.hook_zh).toBe('');
  });
});

