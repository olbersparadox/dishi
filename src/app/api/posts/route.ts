import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { normalizeReason } from '@/lib/posts';

/**
 * 貼文 — per-dish opt-in publishing (stream 2).
 *
 * GET    -> { posts: [{ dish_id, reason }] } for the caller (what 食記 marks
 *            as already public)
 * POST   { dish_id, reason? } -> publish, or update the reason of an existing
 *            post. Idempotent by (user_id, dish_id) — the unique index is the
 *            authority, so a double-tap can't mint two posts of one dish.
 * DELETE ?dish_id=... -> unpublish. A real DELETE: revoking consent leaves no
 *            row behind.
 *
 * User-scoped client throughout — dish_posts is NOT one of the deliberately
 * RLS-locked-against-its-owner tables (that pattern is sealed_predictions);
 * every write here is the owner acting on their own row, which is exactly what
 * RLS should be enforcing. No admin client, on purpose.
 *
 * PUBLISHABLE = RATED. A post asserts a verdict, so a dish with no rating has
 * nothing to publish; the flow can only reach this from the rated list anyway,
 * and the check keeps that true server-side. The verdict itself is NOT stored —
 * it is read live from ratings wherever a post renders, because re-rating
 * replays history and a snapshot would let a page state a verdict the person
 * has since abandoned.
 */
export async function GET() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const { data, error } = await supabase
    .from('dish_posts')
    .select('dish_id, reason')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const dishId = typeof body?.dish_id === 'string' ? body.dish_id : null;
  if (!dishId) return NextResponse.json({ error: 'No dish.' }, { status: 400 });

  // Ownership + rated-ness, checked before the write rather than left to the
  // RLS policy alone: a blocked insert is this repo's known silent-failure
  // class, and "you haven't rated this yet" is a real answer the UI can show.
  const { data: dish } = await supabase
    .from('dishes').select('id, user_id').eq('id', dishId).maybeSingle();
  if (!dish || dish.user_id !== user.id) {
    return NextResponse.json({ error: 'Not your dish.' }, { status: 404 });
  }
  const { data: rating } = await supabase
    .from('ratings').select('id').eq('dish_id', dishId).eq('user_id', user.id).maybeSingle();
  if (!rating) return NextResponse.json({ error: 'Rate it first.' }, { status: 400 });

  const reason = normalizeReason(body?.reason);
  const { data, error } = await supabase
    .from('dish_posts')
    .upsert({ user_id: user.id, dish_id: dishId, reason }, { onConflict: 'user_id,dish_id' })
    .select('dish_id, reason')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const dishId = req.nextUrl.searchParams.get('dish_id');
  if (!dishId) return NextResponse.json({ error: 'No dish.' }, { status: 400 });

  const { error } = await supabase
    .from('dish_posts').delete().eq('user_id', user.id).eq('dish_id', dishId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
