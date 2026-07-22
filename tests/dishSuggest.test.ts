import { describe, expect, it } from 'vitest';
import { mergeSuggestions } from '../src/lib/dishSuggest';

describe('mergeSuggestions', () => {
  it('keeps tier order — earlier tiers (nearby identities) outrank later ones (own history)', () => {
    const out = mergeSuggestions([
      [{ name: 'Roast Goose', name_zh: '燒鵝', restaurant_id: 'r1' }],
      [{ name: 'Roast Duck', name_zh: '燒鴨', restaurant_id: null }],
    ]);
    expect(out.map(s => s.name)).toEqual(['Roast Goose', 'Roast Duck']);
  });

  it('dedupes identical (name, name_zh) pairs across tiers, first occurrence wins', () => {
    const out = mergeSuggestions([
      [{ name: 'Roast Goose', name_zh: '燒鵝', restaurant_id: 'r1' }],
      [{ name: 'Roast Goose', name_zh: '燒鵝', restaurant_id: null }],
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].restaurant_id).toBe('r1'); // the first (higher-tier) row's restaurant_id sticks
  });

  it('drops rows with neither name nor name_zh', () => {
    const out = mergeSuggestions([[{ name: '', name_zh: null, restaurant_id: null }]]);
    expect(out).toHaveLength(0);
  });

  it('caps at the given limit across tiers', () => {
    const tierA = Array.from({ length: 5 }, (_, i) => ({ name: `A${i}`, name_zh: null, restaurant_id: null }));
    const tierB = Array.from({ length: 5 }, (_, i) => ({ name: `B${i}`, name_zh: null, restaurant_id: null }));
    const out = mergeSuggestions([tierA, tierB], 6);
    expect(out).toHaveLength(6);
    expect(out.map(s => s.name)).toEqual(['A0', 'A1', 'A2', 'A3', 'A4', 'B0']);
  });

  it('trims whitespace and treats a name-only row as having no name_zh', () => {
    const out = mergeSuggestions([[{ name: '  Char Siu  ', name_zh: '  ', restaurant_id: null }]]);
    expect(out[0]).toEqual({ name: 'Char Siu', name_zh: null, restaurant_id: null });
  });
});
