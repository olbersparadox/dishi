import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { extractVoiceSignal } from '@/lib/voice';
import { updateTaste, updateCuisineAffinity, bumpEvidence, emptyTaste, taughtDims, type TasteVector } from '@/lib/taste';
import { replayProfile } from '@/lib/replay';
import { directionOf, outcomeOf } from '@/lib/seal';

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
  const evidence = profile?.evidence ?? {};

  // Voice attributes are passed UNMERGED (updateTaste already falls back per-dim to
  // the dish's vision attributes). Merging them used to make the eater's words
  // indistinguishable from model output inside the engine — and the two are treated
  // differently now: a spoken "barely spicy" is genuine low-presence testimony and
  // teaches, while a vision murmur of the same value is noise and doesn't.
  const voiceAttrs = Object.keys(voice.attributes).length ? voice.attributes : null;

  let nextVector: TasteVector;
  let nextAffinity: Record<string, number>;
  let nextEvidence = evidence;
  const nextCount = isRerate ? count : count + 1;

  if (isRerate) {
    // A RE-RATE cannot be an incremental update. updateTaste is an EMA nudge applied
    // ON TOP of the current vector — but the current vector already contains the
    // effect of the OLD rating for this same dish, and nothing here removes it. So
    // flipping a dish from loved to hated would keep part of the original "loved"
    // push and then add a "hate" push, leaving the profile reflecting a rating
    // history that never happened. That's the same phantom-learning failure the
    // updateTaste missing-attribute bug caused, arriving by a different door.
    //
    // The ratings row was already upserted above, so the table now holds the
    // CORRECTED history — replaying it end-to-end through the real engine is the
    // only way the vector can honestly reflect what the person actually rated.
    // (Same mechanism the rename cascade uses to heal learning after a correction.)
    const rebuilt = await replayProfile(supabase, user.id);
    if (!rebuilt) return NextResponse.json({ error: 'Could not rebuild your taste profile.' }, { status: 500 });
    nextVector = rebuilt.vector;
    nextAffinity = rebuilt.cuisine_affinity;
    nextEvidence = rebuilt.evidence;
  } else {
    nextVector = updateTaste(currentVector, evidence, dish.attributes, effectiveScore, voiceAttrs);
    nextAffinity = updateCuisineAffinity(profile?.cuisine_affinity ?? {}, dish.cuisine, effectiveScore);
    // Evidence bumps mirror rating_count semantics exactly: a re-rate corrects the
    // vector but must not age the per-dim learning rate.
    nextEvidence = bumpEvidence(evidence, dish.attributes, voiceAttrs);
  }

  const { error: tasteErr } = await supabase.from('taste_profiles').upsert({
    user_id: user.id,
    vector: nextVector,
    cuisine_affinity: nextAffinity,
    rating_count: nextCount,
    evidence: nextEvidence,
    updated_at: new Date().toISOString(),
  });
  if (tasteErr) return NextResponse.json({ error: tasteErr.message }, { status: 500 });

  // What this specific rating actually taught — from the same taughtDims source of
  // truth the learning itself uses, so the feedback can never claim learning that
  // didn't happen. dir is the direction the preference moved: the rating's sign
  // times the attribute's centered presence.
  const taught = taughtDims(dish.attributes, voiceAttrs).map(({ dim, presence }) => ({
    dim,
    dir: Math.sign(effectiveScore * (presence - 0.5)) as -1 | 0 | 1,
  })).filter(x => x.dir !== 0);

  // 封印預測 reveal: if a seal exists and hasn't been broken yet, break it now
  // using the ACTUAL rating just committed. This is the only place a seal is
  // ever revealed — never before the rating lands, and never client-side.
  // sealed_predictions is RLS-locked (pending rows are invisible even to their
  // owner — that's the seal), so all of its reads/writes go through admin here,
  // exactly as the seal-creation route does.
  const sealDb = supabaseAdmin();
  let seal: {
    predicted_direction: string; actual_direction: string; outcome: string;
    reason_zh: string | null; reason_en: string | null; streak: number; revealed: true;
  } | null = null;
  const { data: pending } = await sealDb
    .from('sealed_predictions').select('id, predicted_direction, predicted_reason_zh, predicted_reason_en')
    .eq('user_id', user.id).eq('dish_id', dish_id).is('revealed_at', null).maybeSingle();
  if (pending) {
    const actualDirection = directionOf(effectiveScore);
    const outcome = outcomeOf(pending.predicted_direction as any, actualDirection);
    await sealDb.from('sealed_predictions').update({
      actual_score: effectiveScore, outcome, revealed_at: new Date().toISOString(),
    }).eq('id', pending.id);

    // Streak: consecutive hits ending at this reveal, counted from real revealed
    // history (not a stored counter that could drift). A 'near' or 'miss' breaks
    // it; the streak is only ever as long as the engine has actually earned.
    let streak = 0;
    const { data: recent } = await sealDb
      .from('sealed_predictions').select('outcome')
      .eq('user_id', user.id).not('revealed_at', 'is', null)
      .order('revealed_at', { ascending: false }).limit(50);
    for (const row of recent ?? []) {
      if (row.outcome === 'hit') streak++;
      else break;
    }

    seal = {
      predicted_direction: pending.predicted_direction, actual_direction: actualDirection, outcome,
      reason_zh: pending.predicted_reason_zh ?? null, reason_en: pending.predicted_reason_en ?? null,
      streak, revealed: true,
    };
  }

  return NextResponse.json({ ok: true, taste: nextVector, rating_count: nextCount, taught, seal });
}
