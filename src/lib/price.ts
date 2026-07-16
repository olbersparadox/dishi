// Prices are stored "as printed, currency and all" (see MenuItem.price in
// menuScan.ts) — deliberately not parsed/normalized at scan time, since a menu's
// printed price is exactly what it says and shouldn't be reinterpreted. This file
// is the ONE place that reads meaning out of those strings, and only for a single
// purpose: a running total on the "Rate these" button once someone's picked more
// than one dish. It never writes back a "cleaned" price anywhere.

/** Extracts the first numeric value from a printed price string ("$78" -> 78,
 * "HK$88-98" -> 88 (a defensible "starting from" reading of a range), "時價"
 * (market price, no digits) -> null). Returns null for anything with no number
 * to find, rather than guessing. */
export function parsePrice(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const match = raw.replace(/,/g, '').match(/\d+(\.\d+)?/);
  if (!match) return null;
  const n = parseFloat(match[0]);
  return Number.isFinite(n) ? n : null;
}

/** Whatever currency marker precedes the first digit ("$", "HK$", "NT$"), so the
 * total is labelled in the menu's own printed currency rather than an assumed
 * one. Falls back to "$" (Dishi is HK-centric, and that's the convention used
 * everywhere else in this app, e.g. the demo menu) when no items have one. */
export function detectCurrencySymbol(raw: string | null | undefined): string {
  if (!raw) return '';
  const match = raw.match(/^[^\d]*/);
  return match ? match[0].trim() : '';
}

export type PriceSummary = {
  total: number;
  currency: string;
  /** How many of the input prices actually had a parseable number. */
  parsedCount: number;
  totalCount: number;
  /** True only when EVERY picked item's price was parseable — the total is the
   * real total, not a partial one. When false, the total undercounts and the
   * caller should say so (e.g. a trailing "+") rather than presenting it as final. */
  complete: boolean;
};

/**
 * Sums whatever prices can honestly be read from a set of printed price strings.
 * Returns parsedCount: 0 (and total: 0) when NONE parse — the caller's job is to
 * not display a total at all in that case, rather than showing a misleading "$0".
 */
export function sumPrices(prices: Array<string | null | undefined>): PriceSummary {
  let total = 0;
  let parsedCount = 0;
  let currency = '';
  for (const raw of prices) {
    const value = parsePrice(raw);
    if (value === null) continue;
    total += value;
    parsedCount++;
    if (!currency) currency = detectCurrencySymbol(raw);
  }
  return {
    total,
    currency: currency || '$',
    parsedCount,
    totalCount: prices.length,
    complete: prices.length > 0 && parsedCount === prices.length,
  };
}
