import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';

/**
 * The caller's own logged dishes, for the feed's "my dishes" section.
 * GET    -> own dishes + heart counts + own rating score + a `locked` flag
 * PATCH  { dish_id, name?, name_zh? } -> rename (blocked server-side if locked)
 * DELETE { dish_id }                  -> delete (blocked server-side if locked)
 *
 * "Locked" (see is_dish_locked in the DB): true once someone OTHER than the owner
 * has rated this exact dish, or — for restaurant-attached dishes — rated ANY dish
 * sharing the same restaurant + same name (the same real-world dish, logged by
 * someone else). Editing or deleting at that point would retroactively change
 * something another person's taste profile already learned from. Hearts never
 * lock anything — only ratings feed someone else's profile, hearts don't.
 */
export async function GET() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const { data: dishes } = await supabase
    .from('dishes')
    .select('id, name, name_zh, cuisine, photo_url, created_at, restaurant_id, restaurants(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(12);

  const ids = (dishes ?? []).map(d => d.id);
  const admin = supabaseAdmin();
  let hearts = new Map<string, number>();
  let myScores = new Map<string, number>();
  let locked = new Map<string, boolean>();

  if (ids.length) {
    const [{ data: marks }, { data: ratings }, lockChecks] = await Promise.all([
      admin.from('helpful_marks').select('dish_id').in('dish_id', ids),
      supabase.from('ratings').select('dish_id, score').eq('user_id', user.id).in('dish_id', ids),
      Promise.all(ids.map(id => admin.rpc('is_dish_locked', { p_dish_id: id }))),
    ]);
    for (const m of marks ?? []) hearts.set(m.dish_id, (hearts.get(m.dish_id) ?? 0) + 1);
    for (const r of ratings ?? []) myScores.set(r.dish_id, r.score);
    ids.forEach((id, i) => locked.set(id, !!lockChecks[i].data));
  }

  return NextResponse.json({
    dishes: (dishes ?? []).map((d: any) => ({
      id: d.id, name: d.name, name_zh: d.name_zh, cuisine: d.cuisine,
      photo_url: d.photo_url, restaurant: d.restaurants?.name ?? null,
      hearts: hearts.get(d.id) ?? 0,
      my_score: myScores.get(d.id) ?? null,
      locked: locked.get(d.id) ?? false,
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const dishId = body.dish_id;
  if (!dishId) return NextResponse.json({ error: 'dish_id is required.' }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: lockedResult } = await admin.rpc('is_dish_locked', { p_dish_id: dishId });
  if (lockedResult) {
    return NextResponse.json({ error: 'Others have rated this dish — it\u2019s locked to protect their history.' }, { status: 409 });
  }

  const patch: Record<string, string | null> = {};
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim().slice(0, 120);
  if (typeof body.name_zh === 'string') patch.name_zh = body.name_zh.trim().slice(0, 120) || null;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });

  const { data, error } = await supabase
    .from('dishes').update(patch).eq('id', dishId).select('id, name, name_zh').single();
  if (error || !data) return NextResponse.json({ error: 'Not found or not yours.' }, { status: 403 });
  return NextResponse.json({ dish: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const { dish_id } = await req.json().catch(() => ({}));
  if (!dish_id) return NextResponse.json({ error: 'dish_id is required.' }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: lockedResult } = await admin.rpc('is_dish_locked', { p_dish_id: dish_id });
  if (lockedResult) {
    return NextResponse.json({ error: 'Others have rated this dish — it\u2019s locked to protect their history.' }, { status: 409 });
  }

  const { error } = await supabase.from('dishes').delete().eq('id', dish_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
