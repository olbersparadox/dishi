import { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabase/server';
import {
  emptyTaste, updateTaste, updateCuisineAffinity, bumpEvidence,
  updateTasteFromDuel, updateTasteFromDuelTie, bumpEvidenceFromDuel,
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
 *
 * At personal scale (tens to hundreds of events) this is a handful of milliseconds
 * of pure computation; there is no approximation involved.
 */
export async function replayProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ vector: TasteVector; evidence: EvidenceMap; cuisine_affinity: Record<string, number>; replayed: number } | null> {
  const [{ data: rows, error }, { data: duelRows }] = await Promise.all([
    supabase
      .from('ratings')
      .select('score, voice_attributes, created_at, dishes(attributes, cuisine)')
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
    | { t: number; kind: 'rating'; attrs: Record<string, number>; cuisine: string | null; score: number; voice: Record<string, number> | null }
    | { t: number; kind: 'duel'; winner: Record<string, number>; loser: Record<string, number> }
    | { t: number; kind: 'tie'; a: Record<string, number>; b: Record<string, number> };

  const events: Event[] = [];

  for (const r of rows as any[]) {
    const dish = r.dishes;
    if (!dish) continue; // defensive: rating without a joinable dish teaches nothing
    const voice = r.voice_attributes && Object.keys(r.voice_attributes).length ? r.voice_attributes : null;
    events.push({ t: new Date(r.created_at).getTime(), kind: 'rating', attrs: dish.attributes ?? {}, cuisine: dish.cuisine, score: r.score, voice });
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

  for (const e of events) {
    if (e.kind === 'rating') {
      vector = updateTaste(vector, evidence, e.attrs, e.score, e.voice);
      evidence = bumpEvidence(evidence, e.attrs, e.voice);
      affinity = updateCuisineAffinity(affinity, e.cuisine, e.score);
      replayed++;
    } else if (e.kind === 'duel') {
      vector = updateTasteFromDuel(vector, evidence, e.winner, e.loser);
      evidence = bumpEvidenceFromDuel(evidence, e.winner, e.loser);
    } else {
      vector = updateTasteFromDuelTie(vector, evidence, e.a, e.b);
      evidence = bumpEvidenceFromDuel(evidence, e.a, e.b);
    }
  }

  return { vector, evidence, cuisine_affinity: affinity, replayed };
}
