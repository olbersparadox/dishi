import { describe, it, expect } from 'vitest';
import { sameDishInSession, richerNamed, partitionScannedPage, restaurantKeptNote } from '../src/lib/menuMerge';

const d = (name: string, name_zh: string | null = null, name_original = name) => ({ name, name_zh, name_original });

describe('sameDishInSession', () => {
  it('folds cosmetic variation in either language', () => {
    expect(sameDishInSession(d('Har Gow', '蝦餃'), d('har gow', '蝦餃'))).toBe(true);
    expect(sameDishInSession(d('Egg Tart', '蛋撻'), d('EGG  TART'))).toBe(true);
  });

  it('folds a more-specific name that contains the shorter one (page 2 case)', () => {
    // 蝦餃 printed on page 1, 水晶鮮蝦餃 on page 2 — the same dumpling.
    expect(sameDishInSession(d('Shrimp dumpling', '蝦餃'), d('Crystal shrimp dumpling', '水晶鮮蝦餃'))).toBe(true);
  });

  it('does not fold two genuinely different dishes', () => {
    expect(sameDishInSession(d('Har gow', '蝦餃'), d('Siu mai', '燒賣'))).toBe(false);
  });

  it('respects a script-aware floor so a 1-char fragment cannot swallow the menu', () => {
    expect(sameDishInSession(d('', '飯'), d('', '揚州炒飯'))).toBe(false); // 飯 is 1 CJK char < floor 2
  });
});

describe('richerNamed', () => {
  it('prefers the occurrence carrying both languages / the longer name', () => {
    const short = d('Dumpling', '蝦餃');
    const long = d('Crystal shrimp dumpling', '水晶鮮蝦餃');
    expect(richerNamed(short, long)).toBe(long);
    expect(richerNamed(d('X', null), d('X', '蝦餃'))).toEqual(d('X', '蝦餃'));
  });
});

describe('partitionScannedPage', () => {
  it('splits an incoming page into folds vs genuinely-new dishes', () => {
    const existing = [d('Har gow', '蝦餃'), d('Siu mai', '燒賣')];
    const incoming = [
      d('Crystal shrimp dumpling', '水晶鮮蝦餃'), // folds into 蝦餃
      d('Char siu bao', '叉燒包'),                // new
    ];
    const { duplicates, fresh } = partitionScannedPage(existing, incoming);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].index).toBe(0);
    expect(fresh).toHaveLength(1);
    expect(fresh[0].name_zh).toBe('叉燒包');
  });

  it('collapses a dish listed twice within the same incoming page', () => {
    const { fresh } = partitionScannedPage([], [d('Wonton noodle', '雲吞麵'), d('wonton  noodle', '雲吞麵')]);
    expect(fresh).toHaveLength(1);
  });
});

describe('restaurantKeptNote', () => {
  it('adopts the incoming guess when nothing is locked yet', () => {
    expect(restaurantKeptNote(null, 'Tim Ho Wan')).toBeNull();
  });
  it('keeps the locked restaurant silently when the new page matches', () => {
    const r = restaurantKeptNote('Tim Ho Wan', 'Tim Ho Wan (Central)');
    expect(r).toEqual({ keep: 'Tim Ho Wan', noteMismatch: false });
  });
  it('flags a mismatch when the new page looks like a different place', () => {
    const r = restaurantKeptNote('Tim Ho Wan', 'McDonald\u2019s');
    expect(r).toEqual({ keep: 'Tim Ho Wan', noteMismatch: true });
  });
});
