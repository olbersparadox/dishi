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

  // An array, because the comparison card writes BOTH plates at once: putting
  // two renderings side by side legitimately revises the earlier judgement
  // ("that one was better than I remembered"), and the revision is as much a
  // judgement as the new score. One entry on the anchor shape.
  const body = await req.json();
  const scores: { dish_id?: string; execution_score?: number }[] =
    Array.isArray(body?.scores) ? body.scores : [body];
  if (!scores.length || scores.length > 2) {
    return NextResponse.json({ error: 'Send one or two scores.' }, { status: 400 });
  }
  for (const s of scores) {
    if (!s?.dish_id || !Number.isInteger(s.execution_score) || s.execution_score! < 1 || s.execution_score! > 10) {
      return NextResponse.json({ error: 'Each entry needs dish_id and execution_score (1-10).' }, { status: 400 });
    }
  }

  // Every dish must already be rated by this person — this scores meals that
  // happened, and each one's own flick is what bounds its permitted range.
  const dishIds = scores.map(s => s.dish_id!);
  const { data: ratings } = await supabase
    .from('ratings').select('id, dish_id, score').eq('user_id', user.id).in('dish_id', dishIds);
  if (!ratings || ratings.length !== scores.length) {
    return NextResponse.json({ error: 'Rate the dish first.' }, { status: 404 });
  }

  // Re-derive every permitted range SERVER-SIDE rather than trusting what the
  // client was told. The bound exists so the two answers cannot contradict each
  // other — flicking 唔會再食 and calling that plate a 9 — and a bound only the
  // client enforces is not a bound. Each row is bounded by ITS OWN flick, so
  // revising the reference can never contradict how that meal was rated.
  const { data: allRows } = await supabase
    .from('ratings').select('dish_id, score').eq('user_id', user.id);
  for (const s of scores) {
    const rating = ratings.find(r => r.dish_id === s.dish_id)!;
    const prior = (allRows ?? []).filter(r => r.dish_id !== s.dish_id).map(r => r.score as number);
    const { min, max } = executionRangeFor(calibratedScore(rating.score as number, prior));
    if (s.execution_score! < min || s.execution_score! > max) {
      return NextResponse.json(
        { error: `That doesn't match how you rated it — pick ${min}-${max}.`, dish_id: s.dish_id, min, max },
        { status: 400 },
      );
    }
  }

  for (const s of scores) {
    const rating = ratings.find(r => r.dish_id === s.dish_id)!;
    const { error: updErr } = await supabase
      .from('ratings').update({ execution_score: s.execution_score }).eq('id', rating.id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  const rebuilt = await replayProfile(supabase, user.id);
  if (!rebuilt) return NextResponse.json({ error: 'Could not rebuild your taste profile.' }, { status: 500 });

  const { error: tasteErr } = await supabase.from('taste_profiles').upsert({
    user_id: user.id,
    vector: rebuilt.vector,
    cuisine_affinity: rebuilt.cuisine_affinity,
          domain_evidence: rebuilt.domain_evidence,
    evidence: rebuilt.evidence,
    rating_count: rebuilt.replayed,
    updated_at: new Date().toISOString(),
  });
  if (tasteErr) return NextResponse.json({ error: tasteErr.message }, { status: 500 });

  // `confounded` is how many ratings the engine can now attribute to a kitchen
  // rather than to taste. Surfaced so the client can say something true when a
  // score has just rescued an earlier meal from the palate.
  return NextResponse.json({ ok: true, scored: scores.length, confounded: rebuilt.confounded, passing: EXECUTION_PASS });
}
