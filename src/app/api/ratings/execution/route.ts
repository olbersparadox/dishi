import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { replayProfile } from '@/lib/replay';
import { calibratedScore, executionRangeFor, EXECUTION_PASS } from '@/lib/taste';

/**
 * POST /api/ratings/execution
 * JSON: { dish_id, execution_score (1..10) }
 *
 * 佢哋整得點？ — how well THIS kitchen made the dish, recorded per instance. The
 * dish-vs-execution question is never asked; it is answered by comparing
 * instances of the same dish identity (see isExecutionConfounded).
 *
 * ALWAYS replays the profile afterwards, and not only for the rating being
 * scored. A passing score here can retroactively exonerate a DIFFERENT rating —
 * the moment 火腿通粉 at B scores 8, the 2 at A stops being evidence that this
 * person dislikes macaroni soup and has to leave the learning stream. Only a
 * full replay can see that; an incremental nudge cannot un-teach.
 */
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to rate.' }, { status: 401 });

  const { dish_id, execution_score } = await req.json();
  if (!dish_id || !Number.isInteger(execution_score) || execution_score < 1 || execution_score > 10) {
    return NextResponse.json({ error: 'dish_id and execution_score (1-10) are required.' }, { status: 400 });
  }

  // The rating must already exist — this scores a meal that happened, and the
  // flick is what bounds the permitted range below.
  const { data: rating } = await supabase
    .from('ratings').select('id, score').eq('user_id', user.id).eq('dish_id', dish_id).maybeSingle();
  if (!rating) return NextResponse.json({ error: 'Rate the dish first.' }, { status: 404 });

  // Re-derive the permitted range SERVER-SIDE rather than trusting what the
  // client was told. The bound exists so the two answers cannot contradict each
  // other — flicking 唔會再食 and calling the plate a 9 — and a bound only the
  // client enforces is not a bound.
  const { data: priorRows } = await supabase
    .from('ratings').select('score').eq('user_id', user.id).neq('dish_id', dish_id);
  const learned = calibratedScore(rating.score as number, (priorRows ?? []).map(r => r.score as number));
  const { min, max } = executionRangeFor(learned);
  if (execution_score < min || execution_score > max) {
    return NextResponse.json(
      { error: `That doesn't match how you rated it — pick ${min}-${max}.`, min, max },
      { status: 400 },
    );
  }

  const { error: updErr } = await supabase
    .from('ratings').update({ execution_score }).eq('id', rating.id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  const rebuilt = await replayProfile(supabase, user.id);
  if (!rebuilt) return NextResponse.json({ error: 'Could not rebuild your taste profile.' }, { status: 500 });

  const { error: tasteErr } = await supabase.from('taste_profiles').upsert({
    user_id: user.id,
    vector: rebuilt.vector,
    cuisine_affinity: rebuilt.cuisine_affinity,
    evidence: rebuilt.evidence,
    rating_count: rebuilt.replayed,
    updated_at: new Date().toISOString(),
  });
  if (tasteErr) return NextResponse.json({ error: tasteErr.message }, { status: 500 });

  // `confounded` is how many ratings the engine can now attribute to a kitchen
  // rather than to taste. Surfaced so the client can say something true when a
  // score has just rescued an earlier meal from the palate.
  return NextResponse.json({ ok: true, execution_score, confounded: rebuilt.confounded, passing: EXECUTION_PASS });
}
