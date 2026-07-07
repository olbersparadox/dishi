import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { extractVoiceSignal } from '@/lib/voice';
import { updateTaste, updateCuisineAffinity, emptyTaste } from '@/lib/taste';

export const maxDuration = 30;

/**
 * POST /api/ratings
 * JSON: { dish_id, score (-1..1), voice_transcript? }
 * Writes the rating, extracts structured signal from any voice note, and updates
 * the user's taste vector in the same request so the profile is always current.
 */
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to rate.' }, { status: 401 });

  const { dish_id, score, voice_transcript } = await req.json();
  if (!dish_id || typeof score !== 'number' || score < -1 || score > 1) {
    return NextResponse.json({ error: 'dish_id and score (-1..1) are required.' }, { status: 400 });
  }

  const { data: dish, error: dishErr } = await supabase
    .from('dishes').select('id, attributes, cuisine').eq('id', dish_id).single();
  if (dishErr || !dish) return NextResponse.json({ error: 'Dish not found.' }, { status: 404 });

  // Re-rating the same dish replaces the rating row (upsert below) — it must not
  // ALSO inflate rating_count, which controls the EMA learning-rate decay. A user
  // correcting a slip-flick shouldn't age their profile.
  const { data: priorRating } = await supabase
    .from('ratings').select('id').eq('user_id', user.id).eq('dish_id', dish_id).maybeSingle();
  const isRerate = !!priorRating;

  // Voice note -> structured attributes (+ optional sentiment nudge on the score).
  const voice = voice_transcript ? await extractVoiceSignal(voice_transcript) : { attributes: {}, sentiment_hint: null };
  const effectiveScore = voice.sentiment_hint !== null
    ? 0.7 * score + 0.3 * voice.sentiment_hint
    : score;

  const { error: rateErr } = await supabase.from('ratings').upsert({
    user_id: user.id,
    dish_id,
    score: effectiveScore,
    voice_transcript: voice_transcript ?? null,
    voice_attributes: Object.keys(voice.attributes).length ? voice.attributes : null,
  }, { onConflict: 'user_id,dish_id' });
  if (rateErr) return NextResponse.json({ error: rateErr.message }, { status: 500 });

  // Update taste profile.
  const { data: profile } = await supabase
    .from('taste_profiles').select('*').eq('user_id', user.id).maybeSingle();
  const currentVector = profile?.vector ?? emptyTaste();
  const count = profile?.rating_count ?? 0;

  const nextVector = updateTaste(
    currentVector, count, dish.attributes, effectiveScore,
    Object.keys(voice.attributes).length ? { ...dish.attributes, ...voice.attributes } : null,
  );
  const nextAffinity = updateCuisineAffinity(profile?.cuisine_affinity ?? {}, dish.cuisine, effectiveScore);

  const nextCount = isRerate ? count : count + 1;
  const { error: tasteErr } = await supabase.from('taste_profiles').upsert({
    user_id: user.id,
    vector: nextVector,
    cuisine_affinity: nextAffinity,
    rating_count: nextCount,
    updated_at: new Date().toISOString(),
  });
  if (tasteErr) return NextResponse.json({ error: tasteErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, taste: nextVector, rating_count: nextCount });
}
