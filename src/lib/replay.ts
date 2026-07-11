import { SupabaseClient } from '@supabase/supabase-js';
import { emptyTaste, updateTaste, updateCuisineAffinity, bumpEvidence, type TasteVector, type EvidenceMap } from './taste';

/**
 * Rebuilds a user's ENTIRE taste profile from scratch by re-running every one of
 * their ratings, in original order, through the real learning functions — exactly
 * as if each rating had just happened, but against the dishes' CURRENT attributes.
 *
 * Why this exists: a dish record is a bundle (name, cuisine, attributes) derived
 * from one vision guess. When the person corrects the name, the attributes get
 * re-derived — but any rating made BEFORE the correction already taught the profile
 * from the wrong attributes. Replay makes a correction retroactively heal the
 * learning itself, not just future scoring: the profile always reflects what the
 * person actually ate, as currently best understood.
 *
 * Fidelity notes:
 * - ratings.voice_attributes is persisted, so spoken testimony replays exactly.
 * - ratings are upserted one-row-per-dish, so replay naturally applies each dish's
 *   FINAL score once — mirroring how a re-rate corrects rather than duplicates
 *   (rating_count semantics are preserved by simply not touching rating_count).
 * - Deleted dishes' ratings are cascade-deleted, so replay only ever sees dishes
 *   that still exist — same information the live profile would have after deletes.
 *
 * At personal scale (tens to hundreds of ratings) this is a handful of milliseconds
 * of pure computation; there is no approximation involved.
 */
export async function replayProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ vector: TasteVector; evidence: EvidenceMap; cuisine_affinity: Record<string, number>; replayed: number } | null> {
  const { data: rows, error } = await supabase
    .from('ratings')
    .select('score, voice_attributes, created_at, dishes(attributes, cuisine)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error || !rows) return null;

  let vector = emptyTaste();
  let evidence: EvidenceMap = {};
  let affinity: Record<string, number> = {};
  let replayed = 0;

  for (const r of rows as any[]) {
    const dish = r.dishes;
    if (!dish) continue; // defensive: rating without a joinable dish teaches nothing
    const voiceAttrs = r.voice_attributes && Object.keys(r.voice_attributes).length ? r.voice_attributes : null;
    vector = updateTaste(vector, evidence, dish.attributes ?? {}, r.score, voiceAttrs);
    evidence = bumpEvidence(evidence, dish.attributes ?? {}, voiceAttrs);
    affinity = updateCuisineAffinity(affinity, dish.cuisine, r.score);
    replayed++;
  }

  return { vector, evidence, cuisine_affinity: affinity, replayed };
}
