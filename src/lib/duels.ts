// Server-side pair selection for 對決 (taste duels). Kept as a pure function so
// the exclusion rules and the uncertainty scoring are testable without a DB —
// the route feeds it the candidate dishes, the user's profile, and their
// existing duel rows, and gets back the single best pair to serve (or null).
//
// The whole point is ACTIVE selection: never a filler duel. QUALIFICATION IS
// THE ENGINE'S OWN UNRESOLVED BET (2026-07-28 redesign, docs/rnd/
// comparison-frequency.md): every duel seals a predicted winner + confidence,
// and a pair qualifies when that prediction is genuinely uncertain — the
// engine duels precisely where it cannot call the outcome, and serves the
// LEAST certain pair first. Classic uncertainty sampling, no new state.
//
// The previous gate ("a contrasting dim with evidence <= 2") is GONE, and must
// not come back: evidence counters only grow, so it permanently shut the duel
// engine off for exactly the heaviest users (measured live: at 49 ratings the
// lowest dim sat at 3 and all 374 strongly-contrasting pairs were killed —
// while the model's own bets were coin flips on 306 of them; the counter was
// manufacturing certainty the model did not have).

import {
  contentScore, sigmoid, duelContrast, DUEL_K,
  type DishVector, type EvidenceMap, type TasteVector,
} from './taste';

/** How many lifetime duels a single dish may appear in before it's retired from
 * selection — stops one photogenic dish from dominating every duel. */
export const DUEL_LIFETIME_CAP = 3;
/** A pair served (or skipped) within this many days won't be served again — after
 * it, an unanswered pair may return. Answered pairs are excluded forever. */
export const DUEL_RECENT_DAYS = 30;
/** A dim must contrast by at least this to "genuinely" separate the two dishes. */
export const DUEL_CONTRAST_FLOOR = 0.3;
/**
 * The band edge: a pair qualifies only while the sealed bet sits under this.
 * "No rec is better than an irrelevant one," applied to duels — if the model
 * ever becomes genuinely confident about every pair, the card honestly stops
 * appearing rather than asking questions it can already answer. (Measured
 * today everything sits under it; the edge exists for the model this becomes.)
 */
export const DUEL_UNCERTAIN_P = 0.65;
/** Pairs whose sealed confidence is within this of the least-certain pair are
 * treated as equally uncertain, and the info score breaks the tie. */
const P_EPSILON = 0.02;

export type DuelCandidate = {
  id: string;
  cuisine: string | null;
  attributes: DishVector;
  identityId: string | null;
  /** Cross-venue identity (canonical dish catalog). Two instances of the same
   * canonical dish are an EXECUTION comparison, never a 對決. */
  canonicalId?: string | null;
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

export type SelectedPair = {
  a: DuelCandidate; b: DuelCandidate;
  info: number;
  /** The sealed-bet confidence selection qualified this pair on — the route
   * reuses it as predicted_p so the seal and the selection cannot disagree. */
  p: number;
  /** True when this pair was chosen to re-probe the dims of a recent WRONG
   * prediction — the client may say so ("上次估錯了"). */
  rematch: boolean;
};

const pairKey = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);

/**
 * Pick the least-certain qualifying pair, or null if none qualifies.
 *
 * Exclusions: different cuisine; same dish identity OR same canonical dish on
 * both sides; a pair already answered (ever) or served within DUEL_RECENT_DAYS;
 * any dish already in DUEL_LIFETIME_CAP+ duels; no dim contrasted by >=
 * DUEL_CONTRAST_FLOOR (two indistinguishable dishes make a bad question
 * however unsure the model is).
 *
 * Qualification: sealed-bet confidence p < DUEL_UNCERTAIN_P.
 * Ranking: lowest p first; among pairs within P_EPSILON of the minimum, the
 * highest info score (evidence-weighted contrast) wins — evidence survives as
 * a TIEBREAK, where thin dims deserve priority, never as a gate.
 *
 * `rematchDims`: dims contrasted by a recent duel the engine predicted WRONG.
 * When any qualifying pair re-probes one of them, selection is restricted to
 * those pairs and the result is flagged — a visible "the model just learned
 * something and wants to check" beat.
 */
export function selectDuelPair(
  candidates: DuelCandidate[],
  vector: TasteVector,
  evidence: EvidenceMap,
  existing: ExistingDuelRow[],
  opts: { rematchDims?: string[]; now?: number } = {},
): SelectedPair | null {
  const now = opts.now ?? Date.now();
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

  const rematchDims = new Set(opts.rematchDims ?? []);
  const qualifying: SelectedPair[] = [];
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i], b = candidates[j];

      const cuisine = a.cuisine?.toLowerCase();
      if (!cuisine || cuisine === 'unknown' || cuisine !== b.cuisine?.toLowerCase()) continue;
      if ((lifetimeCount.get(a.id) ?? 0) >= DUEL_LIFETIME_CAP) continue;
      if ((lifetimeCount.get(b.id) ?? 0) >= DUEL_LIFETIME_CAP) continue;
      if (a.identityId && b.identityId && a.identityId === b.identityId) continue;
      // Same canonical dish = same real-world dish at two venues. "Which do you
      // prefer?" is the execution slider's question there, not 對決's.
      if (a.canonicalId && b.canonicalId && a.canonicalId === b.canonicalId) continue;
      const key = pairKey(a.id, b.id);
      if (answered.has(key) || recent.has(key)) continue;

      const contrast = duelContrast(a.attributes, b.attributes);
      const strong = contrast.filter(c => Math.abs(c.x) >= DUEL_CONTRAST_FLOOR);
      if (strong.length === 0) continue;

      // The sealed bet, exactly as the route stakes it (empty affinity — a
      // same-cuisine pair cancels affinity, so the bet is pure content).
      const p = sigmoid(DUEL_K * Math.abs(contentScore(vector, a.attributes, {}) - contentScore(vector, b.attributes, {})));
      if (p >= DUEL_UNCERTAIN_P) continue;

      let info = 0;
      for (const c of contrast) info += (1 / (1 + (evidence[c.dim] ?? 0))) * Math.abs(c.x);
      const rematch = strong.some(c => rematchDims.has(c.dim));
      qualifying.push({ a, b, info, p, rematch });
    }
  }
  if (qualifying.length === 0) return null;

  // A wrong bet earns a follow-up: when any qualifying pair re-probes a dim the
  // engine just got wrong, those pairs take priority.
  const pool = qualifying.some(q => q.rematch) && rematchDims.size > 0
    ? qualifying.filter(q => q.rematch)
    : qualifying;

  const minP = Math.min(...pool.map(q => q.p));
  let best: SelectedPair | null = null;
  for (const q of pool) {
    if (q.p > minP + P_EPSILON) continue;
    if (!best || q.info > best.info) best = q;
  }
  return best;
}
