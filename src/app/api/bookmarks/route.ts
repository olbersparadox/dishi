import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { buildBookmarkRow, buildEditorialBookmarkRow } from '@/lib/feed';

/**
 * POST /api/bookmarks { dish_id } | { persona_post_id } — 收藏 a feed card
 * into 待評.
 *
 * Every card carries this affordance whatever its author (binding amendment:
 * a feed without it is pure consumption and generates nothing). Most cards
 * point at a real dishes row and send dish_id; a persona EDITORIAL card is
 * about a dish-of-the-world with no dishes row behind it, so it sends the
 * post id and the 待評 row is built from the post's own fields instead
 * (buildEditorialBookmarkRow — same two NULLs, same reasons).
 *
 * Idempotent: the (user_id, from_dish_id) / (user_id, from_persona_post_id)
 * unique indexes are the authority, so a second tap reports success instead
 * of minting a duplicate queue entry.
 */
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const dishId = typeof body?.dish_id === 'string' ? body.dish_id : null;
  const personaPostId = typeof body?.persona_post_id === 'string' ? body.persona_post_id : null;
  if (!dishId && !personaPostId) return NextResponse.json({ error: 'No dish.' }, { status: 400 });

  if (personaPostId) {
    // PUBLISHED only — a pending draft hasn't been offered to anyone yet,
    // editor included; approving it is one tap away if they want it.
    const { data: post } = await supabaseAdmin()
      .from('persona_posts')
      .select('id, name, name_zh, cuisine, status')
      .eq('id', personaPostId)
      .maybeSingle();
    if (!post || post.status !== 'published') {
      return NextResponse.json({ error: 'That post is gone.' }, { status: 404 });
    }
    const row = buildEditorialBookmarkRow({ postId: post.id, userId: user.id, post });
    if (!row.name && !row.name_zh) {
      return NextResponse.json({ error: 'That dish has no name.' }, { status: 400 });
    }
    const { data, error } = await supabase.from('dishes').insert(row).select('id').maybeSingle();
    if (error) {
      if (error.code === '23505') return NextResponse.json({ ok: true, already: true });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, dish_id: data?.id ?? null });
  }
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

  // The dish must actually have been PUBLISHED by its owner. Until the share
  // batch this check was absent and safe only by accident: every dish id a
  // client could obtain came from the feed, which serves published material
  // only. The per-dish permalink ends that — ids now travel in URLs — so
  // without this, knowing any dish's id would be enough to copy a stranger's
  // unpublished dish into your own queue.
  //
  // EXISTENCE, not tier: a link-only post is a real publication whose
  // intended audience is exactly the person holding the link, and bookmarking
  // is the thing that link exists to invite.
  const { data: post } = await admin
    .from('dish_posts').select('dish_id').eq('dish_id', dishId).maybeSingle();
  if (!post) {
    return NextResponse.json({ error: 'That dish is not published.' }, { status: 403 });
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
