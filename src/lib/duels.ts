// Server-side pair selection for 對決 (taste duels). Kept as a pure function so
// the exclusion rules and the information-gain scoring are testable without a DB —
// the route feeds it the candidate dishes, the user's evidence map, and their
// existing duel rows, and gets back the single best pair to serve (or null).
//
// The whole point is ACTIVE selection: never a filler duel. A pair only qualifies
// if it genuinely contrasts a dimension the engine is still unsure about, and among
// qualifying pairs we serve the most informative one. If nothing qualifies, the
// card simply doesn't appear. See docs/specs/dish-duels.md.

import { duelContrast, type DishVector, type EvidenceMap } from './taste';

/** How many lifetime duels a single dish may appear in before it's retired from
 * selection — stops one photogenic dish from dominating every duel. */
export const DUEL_LIFETIME_CAP = 3;
/** A pair served (or skipped) within this many days won't be served again — after
 * it, an unanswered pair may return. Answered pairs are excluded forever. */
export const DUEL_RECENT_DAYS = 30;
/** A dim must contrast by at least this to "genuinely" separate the two dishes. */
export const DUEL_CONTRAST_FLOOR = 0.3;
/** Evidence at or below this counts the dim as still-uncertain (the 摸緊 set). */
export const DUEL_UNCERTAIN_EVIDENCE = 2;

export type DuelCandidate = {
  id: string;
  cuisine: string | null;
  attributes: DishVector;
  identityId: string | null;
};

/** The subset of a dish_duels row selection needs. `resolved` is true once the duel
 * was answered EITHER way — a win or a tie (揀唔落); both retire the pair forever, so
 * selection treats them the same. Timestamps are ISO strings (as Supabase returns
 * them); `now` is injectable so tests are deterministic. */
export type ExistingDuelRow = {
  dish_a: string;
  dish_b: string;
  resolved: boolean;
  served_at: string;
};

export type SelectedPair = { a: DuelCandidate; b: DuelCandidate; info: number };

const pairKey = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);

/**
 * Pick the highest-information qualifying pair, or null if none qualifies.
 * Exclusions (all per spec): different cuisine; same dish identity on both sides;
 * a pair already answered (ever) or served within DUEL_RECENT_DAYS; any dish
 * already in DUEL_LIFETIME_CAP+ duels. Qualification: at least one dim contrasted
 * by >= DUEL_CONTRAST_FLOOR that is still uncertain (evidence <= threshold).
 */
export function selectDuelPair(
  candidates: DuelCandidate[],
  evidence: EvidenceMap,
  existing: ExistingDuelRow[],
  now: number = Date.now(),
): SelectedPair | null {
  const recentCutoff = now - DUEL_RECENT_DAYS * 24 * 60 * 60 * 1000;

  const lifetimeCount = new Map<string, number>();
  const answered = new Set<string>();
  const recent = new Set<string>();
  for (const d of existing) {
    lifetimeCount.set(d.dish_a, (lifetimeCount.get(d.dish_a) ?? 0) + 1);
    lifetimeCount.set(d.dish_b, (lifetimeCount.get(d.dish_b) ?? 0) + 1);
    const key = pairKey(d.dish_a, d.dish_b);
    if (d.resolved) answered.add(key);
    if (new Date(d.served_at).getTime() >= recentCutoff) recent.add(key);
  }

  let best: SelectedPair | null = null;
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i], b = candidates[j];

      const cuisine = a.cuisine?.toLowerCase();
      if (!cuisine || cuisine === 'unknown' || cuisine !== b.cuisine?.toLowerCase()) continue;
      if ((lifetimeCount.get(a.id) ?? 0) >= DUEL_LIFETIME_CAP) continue;
      if ((lifetimeCount.get(b.id) ?? 0) >= DUEL_LIFETIME_CAP) continue;
      if (a.identityId && b.identityId && a.identityId === b.identityId) continue;
      const key = pairKey(a.id, b.id);
      if (answered.has(key) || recent.has(key)) continue;

      const contrast = duelContrast(a.attributes, b.attributes);
      const qualifies = contrast.some(
        c => Math.abs(c.x) >= DUEL_CONTRAST_FLOOR && (evidence[c.dim] ?? 0) <= DUEL_UNCERTAIN_EVIDENCE,
      );
      if (!qualifies) continue;

      let info = 0;
      for (const c of contrast) info += (1 / (1 + (evidence[c.dim] ?? 0))) * Math.abs(c.x);
      if (!best || info > best.info) best = { a, b, info };
    }
  }
  return best;
}
