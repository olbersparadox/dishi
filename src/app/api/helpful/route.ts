import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';

/**
 * POST /api/helpful  { dish_id }
 * "This helped me decide" — the browsing user credits the dish log that sold them.
 * Points design: simple + abuse-resistant.
 *   - one mark per user per dish (unique constraint)
 *   - no self-marks
 *   - diminishing returns per dish: 10, 8, 6, 5, 4, 3, then 2 — a single viral log
 *     shouldn't dominate the leaderboard forever; consistently useful logging should.
 *   - synthetic seed dishes award nothing.
 */
const POINTS_SCHEDULE = [10, 8, 6, 5, 4, 3];

export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const { dish_id } = await req.json();
  if (!dish_id) return NextResponse.json({ error: 'dish_id is required.' }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: dish } = await admin.from('dishes')
    .select('id, user_id, is_synthetic').eq('id', dish_id).single();
  if (!dish) return NextResponse.json({ error: 'Dish not found.' }, { status: 404 });
  if (dish.user_id === user.id) return NextResponse.json({ error: "You can't mark your own dish." }, { status: 400 });

  const { error: markErr } = await admin.from('helpful_marks')
    .insert({ dish_id, marked_by: user.id });
  if (markErr) {
    if (markErr.code === '23505') {
      // unique violation = already marked; idempotent success
      return NextResponse.json({ ok: true, already_marked: true });
    }
    return NextResponse.json({ error: markErr.message }, { status: 500 });
  }

  if (dish.is_synthetic) return NextResponse.json({ ok: true, points_awarded: 0 });

  const { count } = await admin.from('helpful_marks')
    .select('id', { count: 'exact', head: true }).eq('dish_id', dish_id);
  const nth = (count ?? 1) - 1;
  const points = POINTS_SCHEDULE[nth] ?? 2;

  await admin.from('points_ledger').insert({
    user_id: dish.user_id, dish_id, points, reason: 'dish log helped another user decide',
  });
  // Keep the denormalized total in sync.
  const { data: prof } = await admin.from('profiles').select('points').eq('id', dish.user_id).single();
  await admin.from('profiles').update({ points: (prof?.points ?? 0) + points }).eq('id', dish.user_id);

  return NextResponse.json({ ok: true, points_awarded: points });
}
