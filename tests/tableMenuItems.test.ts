import { describe, it, expect } from 'vitest';
import { shapeTableMenuItems } from '../src/lib/tableMenuItems';

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
