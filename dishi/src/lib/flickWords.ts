// Pure logic extracted from FlickRating.tsx (which has real JSX and can't be
// imported into a plain-node test runner) — same split pattern as i18n-dict.ts.

export const WORD_KEYS: [number, string][] = [
  [0.85, 'flick.inhaled'],
  [0.5, 'flick.loved'],
  [0.15, 'flick.good'],
  [-0.15, 'flick.fine'],
  [-0.5, 'flick.notforme'],
  [-1.01, 'flick.never'],
];

export const CHIPS: { key: string; value: number }[] = [
  { key: 'flick.never', value: -0.9 },
  { key: 'flick.notforme', value: -0.5 },
  { key: 'flick.fine', value: 0.1 },
  { key: 'flick.loved', value: 0.6 },
  { key: 'flick.inhaled', value: 1 },
];

export function wordKeyFor(score: number): string {
  for (const [min, key] of WORD_KEYS) if (score >= min) return key;
  return 'flick.never';
}
