// Pure logic extracted from FlickRating.tsx (which has real JSX and can't be
// imported into a plain-node test runner) — same split pattern as i18n-dict.ts.

// The single source of truth for "how much drag counts as a real rating, at all."
// Previously FlickRating had its own COMMIT_MIN (0.18) and the word-display check
// used a DIFFERENT number (0.1) — and the lowest word band ('flick.fine', the
// "一般般"/so-so rating) spans roughly 0 to 0.15. With COMMIT_MIN above that band's
// own ceiling, the ENTIRE so-so band was unreachable: the word could show while
// dragging, but releasing there was always discarded as tremor, so a genuinely
// deliberate light rating produced no result and no follow-up options. One shared
// constant means a band can never again be visible-but-uncommittable.
export const WORD_MIN = 0.1;

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
