import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { extractVoiceSignal } from '@/lib/voice';
import { updateTaste, updateCuisineAffinity, bumpEvidence, emptyTaste, taughtDims, calibratedScore, executionRangeFor, type TasteVector } from '@/lib/taste';
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
    .from('dishes')
    .select('id, attributes, cuisine, dish_identity_id, name, name_zh, photo_url, restaurants(name)')
    .eq('id', dish_id).single();
  if (dishErr || !dish) return NextResponse.json({ error: 'Dish not found.' }, { status: 404 });

  // Re-rating the same dish replaces the rating row (upsert below) — it must not
  // ALSO inflate rating_count, which controls the EMA learning-rate decay. A user
  // correcting a slip-flick shouldn't age their profile.
  const { data: priorRating } = await supabase
    .from('ratings').select('id, execution_score').eq('user_id', user.id).eq('dish_id', dish_id).maybeSingle();
  const isRerate = !!priorRating;
  const rating0 = priorRating; // any execution score this dish already carries

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
  // What this flick actually taught, after centring on the person's own neutral
  // point. Set by whichever branch runs; the "you just taught me" feedback below
  // reads it, so the arrows can never disagree with the learning that happened.
  let learnedScore: number;

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
    // Replay scored this dish against the centre AS IT STOOD at the dish's own
    // position in history — not at the end of it, which is where a re-rate sits
    // in wall-clock time but not in the event stream. Taking the centre replay
    // actually used is the only way the feedback below matches the learning.
    learnedScore = effectiveScore - (rebuilt.centers[dish_id] ?? 0);
  } else {
    // The person's neutral point from every rating that came BEFORE this one.
    // The row above was already upserted, so it must be excluded — with it in,
    // a flick would help set the centre it is then measured against.
    //
    // Derived by query rather than cached: replay.ts rebuilds this same centre
    // from the same table, and the two paths MUST agree exactly or re-rating a
    // dish would silently produce a different profile than rating it first time.
    // A stored running value can't be made provably equal (a median has no
    // running-scalar form), and this is strictly cheaper than the full replay
    // the re-rate branch above already runs.
    const { data: priorRows } = await supabase
      .from('ratings').select('score').eq('user_id', user.id).neq('dish_id', dish_id);
    learnedScore = calibratedScore(effectiveScore, (priorRows ?? []).map(r => r.score as number));

    nextVector = updateTaste(currentVector, evidence, dish.attributes, learnedScore, voiceAttrs);
    nextAffinity = updateCuisineAffinity(profile?.cuisine_affinity ?? {}, dish.cuisine, learnedScore);
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
  // didn't happen. dir is the direction the preference moved: the CENTRED score's
  // sign times the attribute's centered presence. It must be the centred score,
  // not the raw flick: for someone whose normal is 幾好食, a 一般般 moves their
  // preferences DOWN, and showing ↑ because the raw value is positive would be
  // the feedback lying about the learning.
  const taught = taughtDims(dish.attributes, voiceAttrs).map(({ dim, presence }) => ({
    dim,
    dir: Math.sign(learnedScore * (presence - 0.5)) as -1 | 0 | 1,
  })).filter(x => x.dir !== 0);

  // 佢哋整得點？ — whether to offer the execution slider, and what range this
  // flick permits. Decided SERVER-SIDE and handed to the client whole: the
  // threshold, the warm-up and the bounds all key off the person's learned
  // neutral point, and a client recomputing any of them would drift from the
  // engine the moment either changes.
  //
  // Asked when the flick is clearly off their normal (so the plate is worth a
  // question at all), OR when this dish identity already has another rating —
  // because a comparison needs the GOOD instance recorded too, not just the bad
  // one. Answering is always optional; skipping costs nothing.
  // Two shapes. A REPEAT of the same dish identity always asks, with no
  // threshold — that comparison IS the measurement, the only moment that
  // separates a bad kitchen from a disliked dish, and repeats are rare enough
  // to be self-limiting. Otherwise an ANCHOR is offered only on a genuinely
  // strong opinion, which on real data means 唔會再食/唔啱我/好鍾意/掃晒 and never
  // the ordinary 幾好食/一般般 (measured: 19% of ratings at this bar, against 45%
  // at 0.2 — past which it becomes a ritual people click through).
  //
  // Both directions deliberately: exonerating a dish requires a PASSING sibling
  // score, so a negatives-only rule could never record one and nothing would
  // ever be exonerated.
  const WARMUP = 10;
  const ANCHOR_THRESHOLD = 0.35;
  type ExecRow = {
    dish: { id: string; name: string; name_zh: string | null; photo_url: string | null; restaurant: string | null };
    min: number; max: number; value: number | null;
  };
  let execution: { rows: ExecRow[] } | null = null;
  {
    const anyDish = dish as any;
    const range = executionRangeFor(learnedScore);
    const mine: ExecRow = {
      dish: {
        id: dish_id, name: anyDish.name, name_zh: anyDish.name_zh ?? null,
        photo_url: anyDish.photo_url ?? null, restaurant: anyDish.restaurants?.name ?? null,
      },
      ...range,
      value: (rating0?.execution_score ?? null) as number | null,
    };

    // The most recent OTHER instance of the same dish the person has rated —
    // the reference side of the comparison. Its own flick bounds its own scale,
    // so revising it can never contradict how THAT meal was rated.
    let reference: ExecRow | null = null;
    if (dish.dish_identity_id) {
      const { data: sib } = await supabase
        .from('ratings')
        .select('dish_id, score, execution_score, created_at, dishes!inner(dish_identity_id, name, name_zh, photo_url, restaurants(name))')
        .eq('user_id', user.id)
        .eq('dishes.dish_identity_id', dish.dish_identity_id)
        .neq('dish_id', dish_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sib) {
        const sd = (sib as any).dishes;
        const sibPrior = (await supabase.from('ratings').select('score')
          .eq('user_id', user.id).neq('dish_id', sib.dish_id)).data ?? [];
        const sibRange = executionRangeFor(calibratedScore(sib.score as number, sibPrior.map(r => r.score as number)));
        reference = {
          dish: {
            id: sib.dish_id as string, name: sd?.name, name_zh: sd?.name_zh ?? null,
            photo_url: sd?.photo_url ?? null, restaurant: sd?.restaurants?.name ?? null,
          },
          ...sibRange,
          value: (sib.execution_score ?? null) as number | null,
        };
      }
    }

    const strongOpinion = nextCount >= WARMUP && Math.abs(learnedScore) >= ANCHOR_THRESHOLD;
    // Reference FIRST — it is the thing being compared against.
    if (reference) execution = { rows: [reference, mine] };
    else if (strongOpinion) execution = { rows: [mine] };
  }

  // 封印預測 reveal: if a seal exists and hasn't been broken yet, break it now
  // using the ACTUAL rating just committed. This is the only place a seal is
  // ever revealed — never before the rating lands, and never client-side.
  // sealed_predictions is RLS-locked (pending rows are invisible even to their
  // owner — that's the seal), so all of its reads/writes go through admin here,
  // exactly as the seal-creation route does.
  const sealDb = supabaseAdmin();
  let seal: {
    id: string;
    predicted_direction: string; actual_direction: string; outcome: string;
    reason_zh: string | null; reason_en: string | null; streak: number; revealed: true;
  } | null = null;
  const { data: pending } = await sealDb
    .from('sealed_predictions').select('id, predicted_direction, predicted_reason_zh, predicted_reason_en')
    .eq('user_id', user.id).eq('dish_id', dish_id).is('revealed_at', null).maybeSingle();
  if (pending) {
    // RAW score, deliberately — not the centred one the vector learned from. The
    // seal is a claim about the flick the person actually made, and its bands were
    // calibrated against raw flicks (docs/rnd/seal-band-calibration.md); centring
    // here would silently redefine all four band edges.
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

    // `id` rides along so the client can ACKNOWLEDGE the render (POST
    // /api/seals/displayed). Until that ack lands the row stays recoverable —
    // revealed_at alone no longer means "the person saw it".
    seal = {
      id: pending.id,
      predicted_direction: pending.predicted_direction, actual_direction: actualDirection, outcome,
      reason_zh: pending.predicted_reason_zh ?? null, reason_en: pending.predicted_reason_en ?? null,
      streak, revealed: true,
    };
  }

  return NextResponse.json({ ok: true, taste: nextVector, rating_count: nextCount, taught, seal, execution });
}
