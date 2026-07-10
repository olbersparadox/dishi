import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { emptyTaste } from '@/lib/taste';
import {
  SPECIES, type Species, computeXP, levelFor, engineStrength,
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

  const xp = computeXP(inputs);
  return NextResponse.json({
    species: buddy?.species ?? null,
    state: {
      xp,
      level: levelFor(xp),
      strength: engineStrength(inputs),
      elements: buddyElements(inputs),
      hint: growthHint(inputs),
      stats: {
        ratings: inputs.ratingCount,
        cuisines: distinctCuisines,
        dims_explored: exploredDims(inputs.vector).length,
        dims_total: 18,
      },
    },
  });
}

export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const { species } = await req.json();
  if (!SPECIES.includes(species as Species)) {
    return NextResponse.json({ error: 'Pick a real buddy.' }, { status: 400 });
  }

  const { error } = await supabase.from('buddies')
    .upsert({ user_id: user.id, species });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, species });
}
