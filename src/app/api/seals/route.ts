import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { contentScore, emptyTaste } from '@/lib/taste';
import { directionOf, SEAL_GATE } from '@/lib/seal';
import { composeReason } from '@/lib/menuScoring';

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

  const ratingCount = profile?.rating_count ?? 0;
  if (ratingCount < SEAL_GATE) return NextResponse.json({ sealed: false, reason: 'below_gate' });
  if (!dish) return NextResponse.json({ error: 'Dish not found.' }, { status: 404 });

  const vector = profile?.vector ?? emptyTaste();
  const affinity = profile?.cuisine_affinity ?? {};
  const evidence = profile?.evidence ?? {};
  const raw = contentScore(vector, dish.attributes, affinity, dish.cuisine);
  const direction = directionOf(raw);

  // The honest reason, sealed alongside the prediction — composed from the SAME
  // real matched dimensions the scan reasons use, in BOTH languages so the reveal
  // reads correctly whichever the user is in. This is what makes the reveal say
  // "the engine committed to 'melting tenderness' before you rated," not just a bare
  // direction. Composed at seal time so it reflects the engine AS IT WAS, not as it
  // is after the rating moves it.
  const scorable = { attributes: dish.attributes, cuisine: dish.cuisine };
  const reasonZh = composeReason(scorable, vector, affinity, evidence, 'zh');
  const reasonEn = composeReason(scorable, vector, affinity, evidence, 'en');

  const { error } = await admin.from('sealed_predictions').insert({
    user_id: user.id,
    dish_id,
    predicted_raw: raw,
    predicted_direction: direction,
    predicted_reason_zh: reasonZh,
    predicted_reason_en: reasonEn,
    engine_rating_count: ratingCount,
    profile_version: profile?.profile_version ?? 1,
  });
  if (error) {
    // Unique(user_id, dish_id) racing with a concurrent request is fine —
    // treat as already-sealed rather than surfacing a false error.
    if (error.code === '23505') return NextResponse.json({ sealed: true, already: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ sealed: true });
}
