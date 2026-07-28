import { NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { emptyTaste, type TasteVector } from '@/lib/taste';
import { wordKeyFor } from '@/lib/flickWords';
import { rankFeed, FEED_TRAINING_THRESHOLD, type FeedItem } from '@/lib/feed';

/**
 * GET /api/feed — the 食記 feed's second tab.
 *
 * One card type, author always a dishi.X (lib/feed.ts). Today the pool is
 * other people's opt-in posts; persona items join the SAME pool and the same
 * ranking when they ship — this route is where they merge, not a second one.
 *
 * Taste-rank IS the distribution (no social graph, decision 2), so this route
 * is the whole reach mechanism for a post. No LLM anywhere in it.
 *
 * Returns `stage`:
 *  - 'training' — the viewer has too few ratings for a match to be honest.
 *    Personas still show (they claim no match); user posts do not.
 *  - 'ranked'   — ranked by contentScore, weak matches dropped rather than
 *    padded out.
 */
export async function GET() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: me } = await admin
    .from('taste_profiles').select('vector, cuisine_affinity, rating_count')
    .eq('user_id', user.id).maybeSingle();
  const taste: TasteVector = (me?.vector as TasteVector) ?? emptyTaste();
  const affinity = (me?.cuisine_affinity ?? {}) as Record<string, number>;
  const ratingCount = (me?.rating_count as number) ?? 0;
  const training = ratingCount < FEED_TRAINING_THRESHOLD;

  // Other people's posts. Own posts are excluded on principle, not for tidiness:
  // this tab exists to carry a palate to someone ELSE, and your own journal is
  // already the first tab.
  const { data: rows } = await admin
    .from('dish_posts')
    .select('id, reason, created_at, user_id, dish_id, profiles!inner(handle, username_set_at), dishes!inner(id, name, name_zh, cuisine, attributes, restaurant_id, restaurants(name))')
    .neq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(120);

  type Row = {
    id: string; reason: string | null; user_id: string; dish_id: string;
    profiles: { handle: string | null; username_set_at: string | null };
    dishes: {
      id: string; name: string | null; name_zh: string | null; cuisine: string | null;
      attributes: Record<string, number> | null; restaurants: { name: string | null } | null;
    };
  };
  // CLAIMED usernames only, the same gate the public page gets right: every
  // legacy profile has an email-derived handle, and surfacing those would put
  // address local parts on a card as an identity.
  const posts = ((rows ?? []) as unknown as Row[]).filter(r => !!r.profiles?.username_set_at);

  // Current verdicts, batched — read live, never snapshotted (see lib/posts.ts).
  const scores = new Map<string, number>();
  if (posts.length > 0) {
    const { data: rated } = await admin
      .from('ratings').select('dish_id, score, user_id')
      .in('dish_id', posts.map(p => p.dish_id));
    for (const r of rated ?? []) {
      const post = posts.find(p => p.dish_id === r.dish_id && p.user_id === r.user_id);
      if (post) scores.set(post.id, Number(r.score));
    }
  }

  // Which of these the viewer has already bookmarked into 待評 — exact, via
  // from_post_id, so a card can show its state instead of re-queueing on a
  // second tap.
  const { data: mine } = await admin
    .from('dishes').select('from_post_id').eq('user_id', user.id).not('from_post_id', 'is', null);
  const bookmarked = new Set((mine ?? []).map(d => d.from_post_id as string));

  const items: FeedItem[] = posts
    // A post whose rating vanished has no verdict to show. Dropped rather than
    // rendered verdictless — the same rule the public page applies.
    .filter(p => scores.has(p.id))
    .map(p => ({
      id: p.id,
      author: { kind: 'user' as const, username: p.profiles.handle as string },
      dish: {
        id: p.dishes.id,
        name: p.dishes.name, name_zh: p.dishes.name_zh,
        restaurant: p.dishes.restaurants?.name ?? null,
        cuisine: p.dishes.cuisine,
        photo_url: null, // the author's photo stays theirs — see /api/bookmarks
        attributes: (p.dishes.attributes ?? {}) as Record<string, number>,
      },
      verdict: wordKeyFor(scores.get(p.id)!),
      reason: p.reason,
    }));

  // Under the training bar a match claim would be a guess with a number on it.
  // Personas (which claim no match) will still be served here when they exist.
  const ranked = training ? [] : rankFeed(taste, affinity, items).slice(0, 30);

  return NextResponse.json({
    stage: training ? 'training' : 'ranked',
    rating_count: ratingCount,
    needed: FEED_TRAINING_THRESHOLD,
    items: ranked.map(i => ({ ...i, bookmarked: bookmarked.has(i.id) })),
  });
}
