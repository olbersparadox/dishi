import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { buildBookmarkRow } from '@/lib/feed';

/**
 * POST /api/bookmarks { dish_id } — 收藏 a feed card into 待評.
 *
 * Every card carries this affordance whatever its author (binding amendment:
 * a feed without it is pure consumption and generates nothing), which is why
 * it takes a DISH and not a post — a persona pick has no post behind it, but
 * every card in the feed points at a real dishes row.
 *
 * It creates a normal unrated dishes row for the CALLER — see buildBookmarkRow
 * for the two fields that make a bookmark honestly different from a menu pick.
 *
 * Idempotent: the (user_id, from_dish_id) unique index is the authority, so a
 * second tap reports success instead of minting a duplicate queue entry.
 */
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const dishId = typeof body?.dish_id === 'string' ? body.dish_id : null;
  if (!dishId) return NextResponse.json({ error: 'No dish.' }, { status: 400 });

  // Admin read: the source dish belongs to someone else. Nothing personal to
  // that person travels out of here — only the dish's own facts, which they
  // published by posting it (or which a persona pick already surfaced).
  const admin = supabaseAdmin();
  const { data: dish } = await admin
    .from('dishes')
    .select('id, user_id, name, name_zh, cuisine, attributes, restaurant_id, cooking_method, heaviness, diet, ingredients')
    .eq('id', dishId)
    .maybeSingle();
  if (!dish) return NextResponse.json({ error: 'That dish is gone.' }, { status: 404 });
  if (dish.user_id === user.id) {
    return NextResponse.json({ error: 'That is your own dish.' }, { status: 400 });
  }

  const row = buildBookmarkRow({
    dishId,
    userId: user.id,
    dish: dish as unknown as Parameters<typeof buildBookmarkRow>[0]['dish'],
  });
  if (!row.name && !row.name_zh) {
    return NextResponse.json({ error: 'That dish has no name.' }, { status: 400 });
  }

  const { data, error } = await supabase.from('dishes').insert(row).select('id').maybeSingle();
  if (error) {
    // 23505 = the unique index doing its job. Already queued IS the desired
    // end state, so this is a success, not a failure to report.
    if (error.code === '23505') return NextResponse.json({ ok: true, already: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, dish_id: data?.id ?? null });
}
