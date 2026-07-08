import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';

/**
 * The caller's own logged dishes, for the feed's "my dishes" section.
 * GET    -> own dishes + heart (helpful_marks) counts + own rating score
 * PATCH  { dish_id, name }  -> rename (RLS: own rows only)
 * DELETE { dish_id }        -> delete; cascades the rating rows via FK.
 *          Note: the taste vector is NOT rewound — it's a running summary, not a
 *          replayable ledger. Deleting hides the dish; it doesn't unlearn it.
 */
export async function GET() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const { data: dishes } = await supabase
    .from('dishes')
    .select('id, name, name_zh, cuisine, photo_url, created_at, restaurants(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(12);

  const ids = (dishes ?? []).map(d => d.id);
  let hearts = new Map<string, number>();
  let myScores = new Map<string, number>();
  if (ids.length) {
    const admin = supabaseAdmin(); // hearts come from OTHER users' rows
    const [{ data: marks }, { data: ratings }] = await Promise.all([
      admin.from('helpful_marks').select('dish_id').in('dish_id', ids),
      supabase.from('ratings').select('dish_id, score').eq('user_id', user.id).in('dish_id', ids),
    ]);
    for (const m of marks ?? []) hearts.set(m.dish_id, (hearts.get(m.dish_id) ?? 0) + 1);
    for (const r of ratings ?? []) myScores.set(r.dish_id, r.score);
  }

  return NextResponse.json({
    dishes: (dishes ?? []).map((d: any) => ({
      id: d.id, name: d.name, name_zh: d.name_zh, cuisine: d.cuisine,
      photo_url: d.photo_url, restaurant: d.restaurants?.name ?? null,
      hearts: hearts.get(d.id) ?? 0,
      my_score: myScores.get(d.id) ?? null,
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const { dish_id, name } = await req.json().catch(() => ({}));
  const clean = String(name ?? '').trim().slice(0, 120);
  if (!dish_id || !clean) return NextResponse.json({ error: 'dish_id and a name are required.' }, { status: 400 });

  const { data, error } = await supabase
    .from('dishes').update({ name: clean }).eq('id', dish_id).select('id, name').single();
  if (error || !data) return NextResponse.json({ error: 'Not found or not yours.' }, { status: 403 });
  return NextResponse.json({ dish: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const { dish_id } = await req.json().catch(() => ({}));
  if (!dish_id) return NextResponse.json({ error: 'dish_id is required.' }, { status: 400 });

  const { error } = await supabase.from('dishes').delete().eq('id', dish_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
