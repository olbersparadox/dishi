// 迎新 onboarding — the album-first cold start (owner design session 2026-07-29).
// The walkthrough is a thin guided path over shipped machinery: this module only
// decides WHETHER it shows. Everything it opens — the album picker, RatingStack,
// TasteGrowth — is the exact flow the merged pill already runs.

/** Per-user, per-device "walkthrough dealt with" flag. localStorage, not the DB:
 * freshness below is derived from server data anyway, so this flag only stops
 * re-showing on this device — skipping here and signing in elsewhere costs one
 * extra (skippable) sheet, never data. */
export const onboardSeenKey = (userId: string) => `dishi-onboard-seen:${userId}`;

export type OnboardGate = {
  seen: boolean;
  /** null while the unrated-picks fetch is still in flight. */
  toRateCount: number | null;
  /** True only once the rated-dishes fetch actually resolved. */
  ratedLoaded: boolean;
  ratedCount: number;
  ratingCount: number;
};

/** Fresh means the account has NOTHING yet: no ratings, no rated rows, no queued
 * picks. Every input must have genuinely loaded — a returning user's data
 * arriving a beat late, or a failed fetch, must never flash the walkthrough
 * (absent signal ⇒ today's behaviour). */
export function shouldShowOnboarding(g: OnboardGate): boolean {
  return !g.seen && g.ratedLoaded && g.toRateCount === 0
    && g.ratedCount === 0 && g.ratingCount === 0;
}
