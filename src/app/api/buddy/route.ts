import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { emptyTaste } from '@/lib/taste';
import {
  engineConfidence, levelForConfidence,
  buddyElements, growthHint, exploredDims,
} from '@/lib/buddy';

/**
 * GET  /api/buddy -> { species | null, state } — state computed fresh from the user's
 *                    real ratings/profile every call, so the buddy can never drift
 *                    out of sync with the engine it visualizes.
 * POST /api/buddy  { species } -> adopt (or switch) a buddy. Cosmetic only: all
 *                    growth state derives from data, so switching species never
 *                    resets progress.
 */
export async function GET() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const [{ data: buddy }, { data: profile }, { data: myRatings }] = await Promise.all([
    supabase.from('buddies').select('species').eq('user_id', user.id).maybeSingle(),
    supabase.from('taste_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('ratings').select('dish_id').eq('user_id', user.id),
  ]);

  // Distinct real cuisines the user has rated.
  const dishIds = (myRatings ?? []).map(r => r.dish_id);
  let distinctCuisines = 0;
  if (dishIds.length) {
    const { data: dishes } = await supabase.from('dishes').select('cuisine').in('id', dishIds);
    distinctCuisines = new Set(
      (dishes ?? []).map(d => d.cuisine).filter(c => c && c !== 'unknown'),
    ).size;
  }

  const inputs = {
    ratingCount: profile?.rating_count ?? 0,
    distinctCuisines,
    vector: profile?.vector ?? emptyTaste(),
    cuisineAffinity: profile?.cuisine_affinity ?? {},
  };

  // ONE confidence number drives the bar, the % readout, and (via the shared
  // scale) the export unlock — rebased off the old flick-count XP (spec §2).
  const confidence = engineConfidence(inputs);
  return NextResponse.json({
    species: buddy?.species ?? null,
    state: {
      level: levelForConfidence(confidence),
      strength: Math.round(confidence * 100),
      elements: buddyElements(inputs),
      hint: growthHint(inputs),
      // Capability honesty: which dimensions the engine genuinely knows (>= 3
      // ratings taught them) vs is still learning. Lets the Buddy speak in terms
      // of what it CAN and CAN'T do yet — under-promise, visibly grow — instead of
      // implying an accuracy it doesn't have.
      knows: Object.entries((profile?.evidence ?? {}) as Record<string, number>)
        .filter(([, n]) => n >= 3).map(([d]) => d),
      learning: Object.entries((profile?.evidence ?? {}) as Record<string, number>)
        .filter(([, n]) => n > 0 && n < 3).map(([d]) => d),
      stats: {
        ratings: inputs.ratingCount,
        cuisines: distinctCuisines,
        dims_explored: exploredDims(inputs.vector).length,
        dims_total: 18,
      },
      // Raw materials for the deterministic taste form (blobForm.ts) — the
      // SAME vector/evidence/count the rest of this response is computed
      // from, so the form can never show something the buddy stats disagree
      // with. profile_version seeds the form's identity and bumps on export.
      vector: inputs.vector,
      evidence: profile?.evidence ?? {},
      profile_version: profile?.profile_version ?? 1,
    },
  });
}

// POST (adopt/switch a species) is retired: the species picker UI is gone —
// the taste form IS the companion now (Session A §3, option (a)). GET still
// returns the stored species so the one-time "your buddy evolved" migration
// card can fire for users who had one; the buddies table itself stays for that
// read until the migration moment has been seen broadly, then can be dropped.
