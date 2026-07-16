import { describe, it, expect } from 'vitest';
import { dict, pickNames, cuisineLabel } from '../src/lib/i18n-dict';

describe('translation dictionary', () => {
  it('every key has non-empty zh AND en — no half-translated UI', () => {
    const entries = Object.entries(dict);
    expect(entries.length).toBeGreaterThan(100);
    for (const [key, v] of entries) {
      expect(typeof v.zh, `${key}.zh`).toBe('string');
      expect(typeof v.en, `${key}.en`).toBe('string');
      expect(v.zh.length, `${key}.zh empty`).toBeGreaterThan(0);
      expect(v.en.length, `${key}.en empty`).toBeGreaterThan(0);
    }
  });

  it('interpolation params match across languages — a {n} in en exists in zh too', () => {
    const paramRe = /\{(\w+)\}/g;
    for (const [key, v] of Object.entries(dict)) {
      const en = [...v.en.matchAll(paramRe)].map(m => m[1]).sort();
      const zh = [...v.zh.matchAll(paramRe)].map(m => m[1]).sort();
      expect(zh, `param mismatch in ${key}`).toEqual(en);
    }
  });

  it('zh strings are actually Chinese where they should be (spot check)', () => {
    expect(dict['nav.scan'].zh).toBe('掃餐牌');
    expect(dict['flick.inhaled'].zh).toBe('一掃而空');
    expect(/[\u4e00-\u9fff]/.test(dict['scan.results'].zh)).toBe(true);
  });
});

describe('pickNames — bilingual name resolution', () => {
  it('uses explicit name_zh when present', () => {
    expect(pickNames({ name: 'Mapo tofu', name_zh: '麻婆豆腐' }))
      .toEqual({ en: 'Mapo tofu', zh: '麻婆豆腐' });
  });

  it('falls back to a CJK name_original for the Chinese slot', () => {
    expect(pickNames({ name: 'Char siu', name_original: '蜜汁叉燒' }))
      .toEqual({ en: 'Char siu', zh: '蜜汁叉燒' });
  });

  it('does NOT put an English name_original in the Chinese slot', () => {
    const r = pickNames({ name: 'Fish and chips', name_original: 'Fish & Chips (large)' });
    expect(r.zh).toBe(undefined);
    expect(r.en).toBe('Fish and chips');
  });

  it('handles a CJK primary name with an English original (Chinese-first menus)', () => {
    const r = pickNames({ name: '雲吞麵', name_original: 'Wonton noodles' });
    expect(r.zh).toBe('雲吞麵');
    expect(r.en).toBe('Wonton noodles');
  });

  it('single-language dishes yield exactly one slot', () => {
    expect(pickNames({ name: 'Carbonara' })).toEqual({ en: 'Carbonara', zh: undefined });
    expect(pickNames({ name: '蛋撻' })).toEqual({ en: undefined, zh: '蛋撻' });
  });

  it('Japanese kana counts as the CJK slot (ramen shops)', () => {
    expect(pickNames({ name: 'Tonkotsu ramen', name_original: 'とんこつラーメン' }).zh)
      .toBe('とんこつラーメン');
  });
});

describe('cuisineLabel', () => {
  it('translates known cuisines to natural HK Chinese', () => {
    expect(cuisineLabel('japanese', 'zh')).toBe('日本菜');
    expect(cuisineLabel('cantonese', 'zh')).toBe('粵菜');
    expect(cuisineLabel('Thai', 'zh')).toBe('泰國菜'); // case-insensitive
  });

  it('capitalizes in English mode', () => {
    expect(cuisineLabel('japanese', 'en')).toBe('Japanese');
    expect(cuisineLabel('middle eastern', 'en')).toBe('Middle eastern');
  });

  it('returns empty for unknown/null — never renders the vision fallback value', () => {
    expect(cuisineLabel('unknown', 'zh')).toBe('');
    expect(cuisineLabel(null, 'en')).toBe('');
    expect(cuisineLabel(undefined, 'zh')).toBe('');
  });

  it('falls back to the raw value for unmapped cuisines in zh — no invented translations', () => {
    expect(cuisineLabel('ethiopian', 'zh')).toBe('ethiopian');
  });
});
