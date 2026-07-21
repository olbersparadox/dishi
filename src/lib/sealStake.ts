// Server-side seal staking — the ONE implementation of "write a sealed prediction",
// shared by POST /api/seals (seal a specific to-rate dish) and the version-unlock
// auto-seal in GET /api/buddy (the engine stakes its strongest call each time a new
// dishi version unlocks). Extracted so the two paths can never drift on the contract:
// prediction + bilingual reason composed from the engine AS IT IS at stake time,
// written via the admin client (sealed_predictions is RLS-locked — a pending row
// being invisible IS the seal), and the caller only ever learns that a seal exists.

import type { supabaseAdmin } from './supabase/server';
import { contentScore, emptyTaste, type TasteVector } from './taste';
import { directionOf, SEAL_GATE } from './seal';
import { composeReason } from './menuScoring';

export type SealableDish = { id: string; attributes: Record<string, number>; cuisine: string | null };
export type SealProfile = {
  vector?: TasteVector | null;
  cuisine_affinity?: Record<string, number> | null;
  evidence?: Record<string, number> | null;
  rating_count?: number | null;
  profile_version?: number | null;
} | null;

export type StakeResult = 'sealed' | 'already' | 'below_gate' | 'error';

/**
 * Stake one sealed prediction for `dish`, honoring the maturity gate and the
 * unique(user_id, dish_id) idempotency. Never returns the prediction content.
 */
export async function stakeSeal(
  admin: ReturnType<typeof supabaseAdmin>,
  userId: string,
  dish: SealableDish,
  profile: SealProfile,
): Promise<StakeResult> {
  const ratingCount = profile?.rating_count ?? 0;
  if (ratingCount < SEAL_GATE) return 'below_gate';

  const vector = profile?.vector ?? emptyTaste();
  const affinity = profile?.cuisine_affinity ?? {};
  const evidence = profile?.evidence ?? {};
  const raw = contentScore(vector, dish.attributes, affinity, dish.cuisine ?? undefined);
  const direction = directionOf(raw);

  // The honest reason, sealed alongside the prediction — composed from the SAME real
  // matched dimensions the scan reasons use, in BOTH languages, at stake time, so the
  // reveal reflects the engine AS IT WAS, not as it is after the rating moves it.
  // (Every insert path writes a cuisine — 'unknown' at worst — so null only means a
  // legacy row; normalize to the same fallback.)
  const scorable = { attributes: dish.attributes, cuisine: dish.cuisine ?? 'unknown' };
  const reasonZh = composeReason(scorable, vector, affinity, evidence, 'zh');
  const reasonEn = composeReason(scorable, vector, affinity, evidence, 'en');

  const { error } = await admin.from('sealed_predictions').insert({
    user_id: userId,
    dish_id: dish.id,
    predicted_raw: raw,
    predicted_direction: direction,
    predicted_reason_zh: reasonZh,
    predicted_reason_en: reasonEn,
    engine_rating_count: ratingCount,
    profile_version: profile?.profile_version ?? 1,
  });
  if (error) {
    // Unique(user_id, dish_id) racing a concurrent request — already sealed, not an error.
    if (error.code === '23505') return 'already';
    return 'error';
  }
  return 'sealed';
}
