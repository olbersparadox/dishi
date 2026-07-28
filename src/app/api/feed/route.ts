import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { emptyTaste, type TasteVector } from '@/lib/taste';
import { wordKeyFor } from '@/lib/flickWords';
import { rankFeed, FEED_TRAINING_THRESHOLD, type FeedItem } from '@/lib/feed';
import { PERSONA_META, isPersona } from '@/lib/persona';

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
export async function GET(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  // The reader's language, for the persona line's stored zh/en pair. A user's
  // post is never translated — those are their own words.
  const lang = req.nextUrl.searchParams.get('lang') === 'en' ? 'en' : 'zh';

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

  // Which dishes the viewer has already bookmarked into 待評 — exact, via
  // from_dish_id, so a card can show its state instead of re-queueing on a
  // second tap. Keyed by DISH so it covers persona cards too.
  const { data: mine } = await admin
    .from('dishes').select('from_dish_id').eq('user_id', user.id).not('from_dish_id', 'is', null);
  const bookmarked = new Set((mine ?? []).map(d => d.from_dish_id as string));

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

  // Persona picks — the SAME pool, not a second feed. This is what keeps the
  // tab non-empty before enough people post, which is the whole reason the
  // three author types share one card.
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: personaRows }, { data: runRow }] = await Promise.all([
    admin.from('persona_items')
      // dishes!inner(user_id): a persona telling you about your own dinner is
      // not content, so the viewer's own dishes are excluded here the same way
      // their own posts are above.
      .select('id, persona, dish_id, name, name_zh, cuisine, attributes, line_zh, line_en, dishes!inner(user_id), restaurants(name)')
      .eq('day', today)
      .neq('dishes.user_id', user.id),
    admin.from('persona_runs').select('status, item_count').eq('day', today).maybeSingle(),
  ]);

  const personaItems: FeedItem[] = ((personaRows ?? []) as any[])
    .filter(r => isPersona(r.persona))
    .map(r => ({
      id: r.id as string,
      author: { kind: 'persona' as const, username: PERSONA_META[r.persona as 'spoon' | 'ck' | 'kiki'][lang] },
      dish: {
        id: r.dish_id as string,
        name: r.name ?? null, name_zh: r.name_zh ?? null,
        restaurant: r.restaurants?.name ?? null,
        cuisine: r.cuisine ?? null,
        photo_url: null,
        attributes: (r.attributes ?? {}) as Record<string, number>,
      },
      // A persona asserts no verdict — it did not eat anything. The slot stays
      // empty rather than being filled with the rating it was sourced from,
      // which belongs to the person who gave it.
      verdict: null,
      reason: (lang === 'en' ? r.line_en : r.line_zh) ?? null,
    }));

  // Under the training bar a match claim would be a guess with a number on it,
  // so user posts wait — but persona items claim no match, and showing them
  // unranked (newest first) is honest and keeps the tab alive on day one.
  const ranked = training
    ? personaItems
    : rankFeed(taste, affinity, [...items, ...personaItems]).slice(0, 30);

  return NextResponse.json({
    stage: training ? 'training' : 'ranked',
    rating_count: ratingCount,
    needed: FEED_TRAINING_THRESHOLD,
    // Told apart deliberately: 'empty' is a legitimate quiet day, 'failed' is
    // the job breaking, and a missing row means it never ran today. The UI must
    // never render the last two as silence.
    persona_status: (runRow?.status as string | undefined) ?? 'missing',
    items: ranked.map(i => ({ ...i, bookmarked: !!i.dish.id && bookmarked.has(i.dish.id) })),
  });
}
