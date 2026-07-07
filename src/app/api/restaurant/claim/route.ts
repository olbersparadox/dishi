import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';

/**
 * GET  /api/restaurant/claim  -> restaurants (with activity counts) + caller's claims
 * POST /api/restaurant/claim  { restaurant_id } -> claim it
 *
 * Honesty note, by design: MVP claims are instant and stored as status='unverified'.
 * Real ownership verification (business documents, phone-at-premises, registry match)
 * is a genuine production problem deliberately NOT faked here — the status column and
 * the "unverified" label in the UI are the seams where it slots in later.
 */
export async function GET() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const admin = supabaseAdmin();
  const [{ data: restaurants }, { data: claims }, { data: dishes }] = await Promise.all([
    admin.from('restaurants').select('id, name, address').order('created_at', { ascending: false }).limit(100),
    supabase.from('restaurant_claims').select('restaurant_id, status'),
    admin.from('dishes').select('id, restaurant_id').not('restaurant_id', 'is', null),
  ]);

  const dishCounts = new Map<string, number>();
  for (const d of dishes ?? []) {
    dishCounts.set(d.restaurant_id, (dishCounts.get(d.restaurant_id) ?? 0) + 1);
  }
  const mine = new Map((claims ?? []).map(c => [c.restaurant_id, c.status]));

  return NextResponse.json({
    restaurants: (restaurants ?? []).map(r => ({
      ...r,
      dish_count: dishCounts.get(r.id) ?? 0,
      claim_status: mine.get(r.id) ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const { restaurant_id } = await req.json();
  if (!restaurant_id) return NextResponse.json({ error: 'restaurant_id is required.' }, { status: 400 });

  const { error } = await supabase.from('restaurant_claims')
    .insert({ restaurant_id, user_id: user.id });
  if (error && error.code !== '23505') { // 23505 = already claimed -> idempotent
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, status: 'unverified' });
}
