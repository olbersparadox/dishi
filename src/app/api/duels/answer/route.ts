import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import {
  updateTasteFromDuel, updateTasteFromDuelTie, bumpEvidenceFromDuel, emptyTaste, DIMS, type TasteVector,
} from '@/lib/taste';

/**
 * POST /api/duels/answer { duel_id, winner_dish_id } | { duel_id, tie: true }
 *
 * Two RESOLUTIONS, both set answered_at and both teach (vector + evidence only — a
 * duel is not a rating, so rating_count / leveling are untouched):
 *  - a WIN records the winner and applies updateTasteFromDuel;
 *  - a TIE (揀唔落) records tied_at and applies updateTasteFromDuelTie — the honest
 *    "these two are equal for me" signal, which pulls the contrast toward neutral.
 * A plain dismiss ("not now") is client-only and never reaches this route, so the
 * duel simply stays open.
 *
 * All dish_duels I/O via admin (RLS-locked); the prediction fields are read here
 * for the reveal but were never sent to the client before now. A resolution applies
 * incrementally on top of the current vector — unlike a re-rate, it's a NEW event,
 * not a correction, so no replay is needed. (Replay still folds resolved duels back
 * in when a rename forces a full rebuild.)
 */
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const admin = supabaseAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const duelId = body.duel_id;
  if (!duelId) return NextResponse.json({ error: 'duel_id is required.' }, { status: 400 });

  const { data: duel } = await admin
    .from('dish_duels')
    .select('id, dish_a, dish_b, predicted_winner, predicted_p, answered_at')
    .eq('id', duelId).eq('user_id', user.id).maybeSingle();
  if (!duel) return NextResponse.json({ error: 'Duel not found.' }, { status: 404 });
  if (duel.answered_at) return NextResponse.json({ error: 'This duel is already closed.' }, { status: 409 });

  const isTie = body.tie === true;
  const winnerId = body.winner_dish_id;
  if (!isTie && winnerId !== duel.dish_a && winnerId !== duel.dish_b) {
    return NextResponse.json({ error: 'winner_dish_id must be one of the two dishes, or set tie: true.' }, { status: 400 });
  }

  const [{ data: dishRows }, { data: profile }] = await Promise.all([
    supabase.from('dishes').select('id, attributes').in('id', [duel.dish_a, duel.dish_b]),
    supabase.from('taste_profiles').select('vector, evidence').eq('user_id', user.id).maybeSingle(),
  ]);
  const attrOf = (id: string) => (dishRows ?? []).find((d: any) => d.id === id)?.attributes ?? {};

  const currentVector: TasteVector = profile?.vector ?? emptyTaste();
  const evidence = profile?.evidence ?? {};

  let nextVector: TasteVector;
  const now = new Date().toISOString();
  if (isTie) {
    nextVector = updateTasteFromDuelTie(currentVector, evidence, attrOf(duel.dish_a), attrOf(duel.dish_b));
    await admin.from('dish_duels').update({ tied_at: now, answered_at: now }).eq('id', duel.id);
  } else {
    const loserId = winnerId === duel.dish_a ? duel.dish_b : duel.dish_a;
    nextVector = updateTasteFromDuel(currentVector, evidence, attrOf(winnerId), attrOf(loserId));
    await admin.from('dish_duels').update({ winner: winnerId, answered_at: now }).eq('id', duel.id);
  }
  // Evidence bump uses the contrast, which is order-independent for the bump.
  const nextEvidence = bumpEvidenceFromDuel(evidence, attrOf(duel.dish_a), attrOf(duel.dish_b));
  const { error: tasteErr } = await supabase
    .from('taste_profiles')
    .update({ vector: nextVector, evidence: nextEvidence, updated_at: new Date().toISOString() })
    .eq('user_id', user.id);
  if (tasteErr) return NextResponse.json({ error: tasteErr.message }, { status: 500 });

  // What this duel actually moved — the true before/after diff, so the reveal can
  // never claim learning that didn't land (a dim already clamped at ±1 moves 0 and
  // is honestly omitted). Same {dim, dir} shape the rating reveal uses.
  const learned = DIMS
    .map(dim => ({ dim, delta: (nextVector[dim] ?? 0) - (currentVector[dim] ?? 0) }))
    .filter(x => Math.abs(x.delta) > 1e-9)
    .map(x => ({ dim: x.dim, dir: Math.sign(x.delta) as -1 | 1 }));

  // A tie has no "correct winner" to reveal — the engine HAD predicted a winner, so
  // surface how confident it had been (that's the honest "it thought it knew, you
  // said they're equal" moment); a win reveals whether that prediction hit.
  return NextResponse.json(isTie
    ? { tie: true, predicted_p: duel.predicted_p, learned }
    : { predicted_correct: duel.predicted_winner === winnerId, predicted_p: duel.predicted_p, learned });
}
