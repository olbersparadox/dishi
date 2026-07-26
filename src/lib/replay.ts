import { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabase/server';
import {
  emptyTaste, updateTaste, updateCuisineAffinity, bumpEvidence,
  updateTasteFromDuel, updateTasteFromDuelTie, bumpEvidenceFromDuel,
  calibratedScore, isExecutionConfounded,
  type TasteVector, type EvidenceMap,
} from './taste';

/**
 * Rebuilds a user's ENTIRE taste profile from scratch by re-running every one of
 * their learning events — ratings AND answered duels — in original order through
 * the real learning functions, exactly as if each had just happened, but against
 * the dishes' CURRENT attributes.
 *
 * Why this exists: a dish record is a bundle (name, cuisine, attributes) derived
 * from one vision guess. When the person corrects the name, the attributes get
 * re-derived — but any event made BEFORE the correction already taught the profile
 * from the wrong attributes. Replay makes a correction retroactively heal the
 * learning itself, not just future scoring: the profile always reflects what the
 * person actually ate/chose, as currently best understood.
 *
 * Fidelity notes:
 * - ratings.voice_attributes is persisted, so spoken testimony replays exactly.
 * - ratings are upserted one-row-per-dish, so replay naturally applies each dish's
 *   FINAL score once — mirroring how a re-rate corrects rather than duplicates.
 * - Resolved duels replay using both dishes' CURRENT attributes, so a rename heals
 *   duel learning exactly as it heals ratings: a win through updateTasteFromDuel, a
 *   tie (揀唔落) through updateTasteFromDuelTie. Open/dismissed duels (answered_at
 *   null) are not learning events and are skipped.
 * - Deleted dishes cascade-delete both their ratings and their duels, so replay
 *   only ever sees events whose dishes still exist — same information the live
 *   profile would have after deletes.
 * - dish_duels is RLS-locked (a pending prediction must be invisible), so its rows
 *   are read via the admin client, scoped to this userId — never the user client,
 *   which no policy would let through.
 * - Each rating learns from its distance to the person's neutral point AS IT STOOD
 *   at that moment (see calibratedScore), rebuilt here from the scores of the
 *   ratings that preceded it. Duels don't move the centre — only flicks do — so
 *   they're skipped when accumulating it.
 *
 * At personal scale (tens to hundreds of events) this is a handful of milliseconds
 * of pure computation; there is no approximation involved.
 */
export async function replayProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<{
  vector: TasteVector; evidence: EvidenceMap; cuisine_affinity: Record<string, number>;
  replayed: number;
  /** Per dish_id, the neutral point that dish's rating was scored against. */
  centers: Record<string, number>;
  /** How many ratings were dropped from learning as kitchen-attributable. */
  confounded: number;
} | null> {
  const [{ data: rows, error }, { data: duelRows }] = await Promise.all([
    supabase
      .from('ratings')
      .select('dish_id, score, execution_score, voice_attributes, created_at, dishes(attributes, cuisine, dish_identity_id)')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    supabaseAdmin()
      .from('dish_duels')
      .select('winner, tied_at, answered_at, a:dishes!dish_a(id, attributes), b:dishes!dish_b(id, attributes)')
      .eq('user_id', userId)
      .not('answered_at', 'is', null),
  ]);
  if (error || !rows) return null;

  // One merged, time-ordered event stream so a duel answered between two ratings
  // learns in the position it actually happened — the vector's evidence-decayed
  // learning rate is order-sensitive, so interleaving must be faithful.
  type Event =
    | { t: number; kind: 'rating'; dishId: string; attrs: Record<string, number>; cuisine: string | null; score: number; voice: Record<string, number> | null }
    | { t: number; kind: 'duel'; winner: Record<string, number>; loser: Record<string, number> }
    | { t: number; kind: 'tie'; a: Record<string, number>; b: Record<string, number> };

  const events: Event[] = [];
  let confounded = 0; // ratings the engine can now blame on the kitchen

  // Execution scores grouped by dish identity, so each rating can be tested
  // against its SIBLINGS — the same dish rendered by another kitchen (or the
  // same kitchen on another day). This is the whole basis of the confound rule:
  // one bad plate is ambiguous, one bad plate next to a good one is a verdict.
  const scoresByIdentity = new Map<string, number[]>();
  for (const r of rows as any[]) {
    const id = r.dishes?.dish_identity_id;
    if (!id || r.execution_score == null) continue;
    const list = scoresByIdentity.get(id) ?? [];
    list.push(r.execution_score);
    scoresByIdentity.set(id, list);
  }

  for (const r of rows as any[]) {
    const dish = r.dishes;
    if (!dish) continue; // defensive: rating without a joinable dish teaches nothing

    // A rating the engine can now attribute to the kitchen is not evidence about
    // this person's taste, so it leaves the learning stream ENTIRELY — no
    // vector, no evidence, no affinity, and (below) no contribution to the
    // neutral point either. A flick that wasn't about taste must not calibrate
    // how taste flicks are read. It still counts as a rating; see `replayed`.
    const identityId = dish.dish_identity_id;
    const siblings = identityId
      // Its own score is in the group too — drop one copy of it, not every equal
      // value, or two instances that both scored 7 would cancel each other out.
      ? dropOne(scoresByIdentity.get(identityId) ?? [], r.execution_score)
      : [];
    if (isExecutionConfounded(r.execution_score, siblings)) { confounded++; continue; }

    const voice = r.voice_attributes && Object.keys(r.voice_attributes).length ? r.voice_attributes : null;
    events.push({ t: new Date(r.created_at).getTime(), kind: 'rating', dishId: r.dish_id, attrs: dish.attributes ?? {}, cuisine: dish.cuisine, score: r.score, voice });
  }

  for (const d of (duelRows ?? []) as any[]) {
    if (!d.a || !d.b || !d.answered_at) continue; // defensive
    const t = new Date(d.answered_at).getTime();
    if (d.tied_at) {
      // 揀唔落 — a tie. Symmetric; a/b order only sets the sign of the contrast.
      events.push({ t, kind: 'tie', a: d.a.attributes ?? {}, b: d.b.attributes ?? {} });
    } else if (d.winner) {
      const winnerDish = d.a.id === d.winner ? d.a : d.b.id === d.winner ? d.b : null;
      const loserDish = winnerDish === d.a ? d.b : d.a;
      if (!winnerDish || !loserDish) continue;
      events.push({ t, kind: 'duel', winner: winnerDish.attributes ?? {}, loser: loserDish.attributes ?? {} });
    }
  }

  events.sort((x, y) => x.t - y.t);

  let vector = emptyTaste();
  let evidence: EvidenceMap = {};
  let affinity: Record<string, number> = {};
  let replayed = 0; // ratings only — preserves rating_count-mirroring semantics
  const priorScores: number[] = []; // raw scores of ratings already applied
  // The centre each dish's rating actually learned from, so a caller can report
  // what a rating taught without re-deriving (and possibly disagreeing with) it.
  const centers: Record<string, number> = {};

  for (const e of events) {
    if (e.kind === 'rating') {
      const learned = calibratedScore(e.score, priorScores);
      centers[e.dishId] = e.score - learned;
      vector = updateTaste(vector, evidence, e.attrs, learned, e.voice);
      evidence = bumpEvidence(evidence, e.attrs, e.voice);
      affinity = updateCuisineAffinity(affinity, e.cuisine, learned);
      priorScores.push(e.score);
      replayed++;
    } else if (e.kind === 'duel') {
      vector = updateTasteFromDuel(vector, evidence, e.winner, e.loser);
      evidence = bumpEvidenceFromDuel(evidence, e.winner, e.loser);
    } else {
      vector = updateTasteFromDuelTie(vector, evidence, e.a, e.b);
      evidence = bumpEvidenceFromDuel(evidence, e.a, e.b);
    }
  }

  // `replayed` counts ratings that TAUGHT, mirroring rating_count's meaning for
  // the learning rate. Execution-confounded ones are added back: the person did
  // rate the dish, so gates built on rating_count (the seal gate, export
  // confidence) must still see it — only the palate ignores it.
  return { vector, evidence, cuisine_affinity: affinity, replayed: replayed + confounded, centers, confounded };
}

/** Remove a single occurrence of `value`, leaving other equal values in place. */
function dropOne(list: number[], value: number | null | undefined): number[] {
  if (value == null) return list;
  const i = list.indexOf(value);
  return i < 0 ? list : [...list.slice(0, i), ...list.slice(i + 1)];
}
