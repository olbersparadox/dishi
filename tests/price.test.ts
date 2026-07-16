import { describe, it, expect } from 'vitest';
import { parsePrice, detectCurrencySymbol, sumPrices } from '../src/lib/price';

describe('parsePrice', () => {
  it('reads a simple printed price', () => {
    expect(parsePrice('$78')).toBe(78);
    expect(parsePrice('HK$168')).toBe(168);
  });
  it('takes the FIRST number in a range \u2014 a defensible "starting from" reading', () => {
    expect(parsePrice('$88-98')).toBe(88);
  });
  it('handles thousands separators', () => {
    expect(parsePrice('$1,280')).toBe(1280);
  });
  it('returns null for prices with no digits at all, rather than guessing', () => {
    expect(parsePrice('時價')).toBeNull();
    expect(parsePrice('Market price')).toBeNull();
  });
  it('returns null for missing input', () => {
    expect(parsePrice(null)).toBeNull();
    expect(parsePrice(undefined)).toBeNull();
    expect(parsePrice('')).toBeNull();
  });
});

describe('detectCurrencySymbol', () => {
  it('reads whatever precedes the first digit', () => {
    expect(detectCurrencySymbol('$78')).toBe('$');
    expect(detectCurrencySymbol('HK$168')).toBe('HK$');
    expect(detectCurrencySymbol('NT$500')).toBe('NT$');
  });
  it('empty for a price with no leading symbol or no input', () => {
    expect(detectCurrencySymbol('78')).toBe('');
    expect(detectCurrencySymbol(null)).toBe('');
  });
});

describe('sumPrices \u2014 the picked-dishes total on "Rate these"', () => {
  it('sums every parseable price and reports complete when all of them parsed', () => {
    const s = sumPrices(['$78', '$92', '$168']);
    expect(s.total).toBe(338);
    expect(s.currency).toBe('$');
    expect(s.parsedCount).toBe(3);
    expect(s.complete).toBe(true);
  });

  it('sums what it CAN when some prices are missing, and flags it incomplete', () => {
    const s = sumPrices(['$78', null, '時價']);
    expect(s.total).toBe(78);
    expect(s.parsedCount).toBe(1);
    expect(s.totalCount).toBe(3);
    expect(s.complete).toBe(false); // caller must show a "+", never a bare total
  });

  it('parsedCount: 0 when NOTHING parses \u2014 caller must show no total, not "$0"', () => {
    const s = sumPrices([null, '時價', undefined]);
    expect(s.parsedCount).toBe(0);
    expect(s.total).toBe(0);
  });

  it('empty input is not "complete" \u2014 there is nothing to be complete about', () => {
    expect(sumPrices([]).complete).toBe(false);
  });

  it('uses the first available currency symbol, defaulting to "$" (Dishi is HK-centric)', () => {
    expect(sumPrices(['HK$50', '$30']).currency).toBe('HK$');
    expect(sumPrices(['78', '92']).currency).toBe('$'); // no symbol on either -> HK-centric default
  });
});
