import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import {
  updateTasteFromDuel, bumpEvidenceFromDuel, emptyTaste, DIMS, type TasteVector,
} from '@/lib/taste';

/**
 * POST /api/duels/answer { duel_id, winner_dish_id } | { duel_id, skip: true }
 *
 * Skip: records skipped_at, teaches nothing. Answer: records the winner, applies
 * the duel learning to the taste profile (vector + evidence only — a duel is NOT a
 * rating, so rating_count / leveling are untouched), and reveals the sealed
 * prediction. All dish_duels I/O via admin (RLS-locked); the prediction fields are
 * read here for the reveal but were never sent to the client before now.
 *
 * A duel applies incrementally on top of the current vector — unlike a re-rate, it
 * is a NEW event, not a correction of a prior one, so no replay is needed. (Replay
 * still folds answered duels back in when a rename forces a full rebuild.)
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
    .select('id, dish_a, dish_b, predicted_winner, predicted_p, answered_at, skipped_at')
    .eq('id', duelId).eq('user_id', user.id).maybeSingle();
  if (!duel) return NextResponse.json({ error: 'Duel not found.' }, { status: 404 });
  if (duel.answered_at || duel.skipped_at) return NextResponse.json({ error: 'This duel is already closed.' }, { status: 409 });

  // Skip path — no guilt, no learning.
  if (body.skip === true) {
    await admin.from('dish_duels').update({ skipped_at: new Date().toISOString() }).eq('id', duel.id);
    return NextResponse.json({ skipped: true });
  }

  const winnerId = body.winner_dish_id;
  if (winnerId !== duel.dish_a && winnerId !== duel.dish_b) {
    return NextResponse.json({ error: 'winner_dish_id must be one of the two dishes.' }, { status: 400 });
  }
  const loserId = winnerId === duel.dish_a ? duel.dish_b : duel.dish_a;

  const [{ data: dishRows }, { data: profile }] = await Promise.all([
    supabase.from('dishes').select('id, attributes').in('id', [winnerId, loserId]),
    supabase.from('taste_profiles').select('vector, evidence').eq('user_id', user.id).maybeSingle(),
  ]);
  const winnerAttrs = (dishRows ?? []).find((d: any) => d.id === winnerId)?.attributes ?? {};
  const loserAttrs = (dishRows ?? []).find((d: any) => d.id === loserId)?.attributes ?? {};

  const currentVector: TasteVector = profile?.vector ?? emptyTaste();
  const evidence = profile?.evidence ?? {};
  const nextVector = updateTasteFromDuel(currentVector, evidence, winnerAttrs, loserAttrs);
  const nextEvidence = bumpEvidenceFromDuel(evidence, winnerAttrs, loserAttrs);

  // Record the answer, then heal the profile. Only vector + evidence change — a
  // duel must never touch rating_count or cuisine_affinity.
  await admin.from('dish_duels').update({ winner: winnerId, answered_at: new Date().toISOString() }).eq('id', duel.id);
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

  return NextResponse.json({
    predicted_correct: duel.predicted_winner === winnerId,
    predicted_p: duel.predicted_p,
    learned,
  });
}
