import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { stakeSeal } from '@/lib/sealStake';

/**
 * GET /api/seals?dish_id=... -> { sealed: boolean }
 * Existence only. Never returns the prediction itself — that would defeat
 * the point of sealing it. The client shows the 印 stamp purely from this
 * boolean; content is only ever returned by /api/ratings on reveal.
 *
 * POST /api/seals { dish_id } -> creates a seal if the engine is mature
 * enough (>= SEAL_GATE ratings) and one doesn't already exist for this dish.
 * Idempotent: calling twice for the same dish is a no-op the second time.
 *
 * sealed_predictions is deliberately RLS-locked so a pending prediction is
 * invisible to the client (that IS the seal). So every read/write of that table
 * here goes through the admin client — the user is already authenticated above,
 * and the row is always scoped to their own user_id. (The user client would be
 * silently blocked: there is no INSERT/UPDATE policy, and the SELECT policy hides
 * unrevealed rows — which is exactly why no seal was ever being created.)
 */
export async function GET(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const dishId = req.nextUrl.searchParams.get('dish_id');
  if (!dishId) return NextResponse.json({ error: 'dish_id is required.' }, { status: 400 });

  const { data } = await supabaseAdmin()
    .from('sealed_predictions').select('id').eq('user_id', user.id).eq('dish_id', dishId).maybeSingle();
  return NextResponse.json({ sealed: !!data });
}

export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const admin = supabaseAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const { dish_id } = await req.json();
  if (!dish_id) return NextResponse.json({ error: 'dish_id is required.' }, { status: 400 });

  const [{ data: existing }, { data: profile }, { data: dish }] = await Promise.all([
    admin.from('sealed_predictions').select('id').eq('user_id', user.id).eq('dish_id', dish_id).maybeSingle(),
    supabase.from('taste_profiles').select('vector, cuisine_affinity, evidence, rating_count, profile_version').eq('user_id', user.id).maybeSingle(),
    supabase.from('dishes').select('attributes, cuisine').eq('id', dish_id).maybeSingle(),
  ]);
  if (existing) return NextResponse.json({ sealed: true, already: true });
  if (!dish) return NextResponse.json({ error: 'Dish not found.' }, { status: 404 });

  // The staking core (prediction + bilingual sealed reason + maturity gate +
  // idempotency) lives in sealStake.ts, shared with the version-unlock auto-seal.
  const result = await stakeSeal(admin, user.id, { id: dish_id, ...dish }, profile);
  if (result === 'below_gate') return NextResponse.json({ sealed: false, reason: 'below_gate' });
  if (result === 'error') return NextResponse.json({ error: 'Could not seal.' }, { status: 500 });
  return NextResponse.json({ sealed: true, ...(result === 'already' ? { already: true } : {}) });
}
