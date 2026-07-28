import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { wordKeyFor } from '@/lib/flickWords';
import { type FeedItem } from '@/lib/feed';
import { PERSONA_META, isPersona } from '@/lib/persona';

/**
 * GET /api/feed — the 食記 feed's second tab.
 *
 * One card type, author always a dishi.X (lib/feed.ts). Posts and persona items
 * merge into ONE pool here — not two lists that happen to render alike.
 *
 * NEWEST FIRST, WHOLE POOL (owner, 2026-07-28 — replacing the contentScore
 * ranking this shipped with). Rationale in lib/feed.ts: while almost nobody has
 * both rated and published a dish, a taste filter over a near-empty pool hides
 * rather than selects. Taste-rank remains the intended distribution and comes
 * back when the pool can support it.
 *
 * Two consequences of that, both deliberate:
 *  - the viewer's OWN posts are in the pool. They were excluded while ranking
 *    was on (your own dishes would rank top and mirror your journal back at
 *    you); with one claimed user in the database that exclusion made the tab
 *    permanently empty for the only person who could see it.
 *  - there is no training stage. It existed because claiming a match under ~5
 *    ratings is dishonest; nothing here claims a match now, so a new account
 *    sees the pool from its first visit instead of an explanation.
 *
 * No LLM anywhere in it.
 */
export async function GET(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  // The reader's language, for the persona line's stored zh/en pair. A user's
  // post is never translated — those are their own words.
  const lang = req.nextUrl.searchParams.get('lang') === 'en' ? 'en' : 'zh';

  const admin = supabaseAdmin();

  // NOTE: the viewer's taste vector is deliberately not read here any more.
  // Nothing in this route consumes it while the order is chronological, and
  // fetching it "just in case" would imply a personalization that isn't
  // happening. It comes back with the ranking.

  // Everyone's posts, the viewer's included.
  //
  // The author is NOT joined in this select. dish_posts.user_id references
  // auth.users, not public.profiles, so there is no foreign key for PostgREST
  // to embed `profiles!inner(...)` through — it errors, and an ignored error
  // here reads as "nobody has posted", which is how this tab shipped unable to
  // render a single user post. Two queries, and the error is surfaced.
  const { data: rows, error: postsError } = await admin
    .from('dish_posts')
    .select('id, reason, created_at, user_id, dish_id, dishes!inner(id, name, name_zh, cuisine, attributes, restaurant_id, photo_url, diet, heaviness, ingredients, restaurants(name))')
    // PUBLIC TIER ONLY. A link-only post is consented publishing, but its
    // consent was to one recipient — surfacing it here would hand it to
    // everyone, which is the whole thing the tier exists to prevent.
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(120);
  if (postsError) {
    return NextResponse.json({ error: postsError.message }, { status: 500 });
  }

  type Row = {
    id: string; reason: string | null; created_at: string; user_id: string; dish_id: string;
    dishes: {
      id: string; name: string | null; name_zh: string | null; cuisine: string | null;
      attributes: Record<string, number> | null; photo_url: string | null;
      diet: string[] | null; heaviness: string | null; ingredients: string[] | null;
      restaurants: { name: string | null } | null;
    };
  };
  const rawPosts = (rows ?? []) as unknown as Row[];

  // CLAIMED usernames only, the same gate the public page gets right: every
  // legacy profile has an email-derived handle, and surfacing those would put
  // address local parts on a card as an identity. A post by someone who hasn't
  // claimed a name has no author to print, so it does not appear.
  const handles = new Map<string, { handle: string; display: string }>();
  if (rawPosts.length > 0) {
    const { data: authors } = await admin
      .from('profiles').select('id, handle, username_display, username_set_at')
      .in('id', Array.from(new Set(rawPosts.map(r => r.user_id))));
    for (const a of authors ?? []) {
      if (a.username_set_at && a.handle) {
        handles.set(a.id as string, {
          handle: a.handle as string,
          display: (a.username_display as string | null) || (a.handle as string),
        });
      }
    }
  }
  const posts = rawPosts.filter(r => handles.has(r.user_id));

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

  // `at` orders the merged pool and is stripped before the response — a card
  // shows no timestamp, the same way the public page publishes no dates.
  type Timed = FeedItem & { at: string };

  const items: Timed[] = posts
    // A post whose rating vanished has no verdict to show. Dropped rather than
    // rendered verdictless — the same rule the public page applies.
    .filter(p => scores.has(p.id))
    .map(p => ({
      id: p.id,
      at: p.created_at,
      author: {
        kind: 'user' as const,
        username: handles.get(p.user_id)!.handle,
        usernameDisplay: handles.get(p.user_id)!.display,
      },
      dish: {
        id: p.dishes.id,
        name: p.dishes.name, name_zh: p.dishes.name_zh,
        restaurant: p.dishes.restaurants?.name ?? null,
        cuisine: p.dishes.cuisine,
        // The dish photo IS part of what was published (owner call
        // 2026-07-28 — the photo-forward card format). This is a different
        // question from buildBookmarkRow's photo_url:null, which is about the
        // BOOKMARKER's own copy of a dish they didn't cook or photograph —
        // that stays null; browsing the feed and seeing the original is fine.
        photo_url: p.dishes.photo_url ?? null,
        attributes: (p.dishes.attributes ?? {}) as Record<string, number>,
        diet: p.dishes.diet ?? [],
        heaviness: p.dishes.heaviness ?? null,
        ingredients: p.dishes.ingredients ?? [],
      },
      verdict: wordKeyFor(scores.get(p.id)!),
      reason: p.reason,
      own: p.user_id === user.id,
    }));

  // Persona picks — the SAME pool, not a second feed. This is what keeps the
  // tab non-empty before enough people post, which is the whole reason the
  // three author types share one card.
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: personaRows }, { data: runRow }] = await Promise.all([
    admin.from('persona_items')
      // dishes!inner(user_id): a persona telling you about your own dinner is
      // not content — it reads as the app quoting you back to yourself. Own
      // POSTS are in the pool now (they are yours, deliberately published);
      // a persona repeating one is not the same thing, so this stays excluded.
      .select('id, persona, dish_id, name, name_zh, cuisine, attributes, line_zh, line_en, created_at, dishes!inner(user_id, photo_url, diet, heaviness, ingredients), restaurants(name)')
      .eq('day', today)
      .neq('dishes.user_id', user.id),
    admin.from('persona_runs').select('status, item_count').eq('day', today).maybeSingle(),
  ]);

  const personaItems: Timed[] = ((personaRows ?? []) as any[])
    .filter(r => isPersona(r.persona))
    .map(r => ({
      id: r.id as string,
      at: r.created_at as string,
      author: { kind: 'persona' as const, username: PERSONA_META[r.persona as 'spoon' | 'ck' | 'kiki'][lang] },
      dish: {
        id: r.dish_id as string,
        name: r.name ?? null, name_zh: r.name_zh ?? null,
        restaurant: r.restaurants?.name ?? null,
        cuisine: r.cuisine ?? null,
        // Sourced from the same posted (consent-clean) dish the persona
        // picked — its photo carries the same publication as its name.
        photo_url: r.dishes?.photo_url ?? null,
        attributes: (r.attributes ?? {}) as Record<string, number>,
        diet: r.dishes?.diet ?? [],
        heaviness: r.dishes?.heaviness ?? null,
        ingredients: r.dishes?.ingredients ?? [],
      },
      // A persona asserts no verdict — it did not eat anything. The slot stays
      // empty rather than being filled with the rating it was sourced from,
      // which belongs to the person who gave it.
      verdict: null,
      reason: (lang === 'en' ? r.line_en : r.line_zh) ?? null,
    }));

  // Persona EDITORIAL — columnist posts (BACKLOG batch 2026-07-29). Same
  // pool, same card; the author line is a persona exactly like a daily pick,
  // but the content is a dish-of-the-world with its own licensed photo and no
  // dishes row behind it (dish.id null; bookmarking keys on the post).
  //
  // PENDING rows travel ONLY to the editor — the in-feed review IS the
  // approval surface, so the editor sees drafts rendered as the real card
  // with an approve/discard bar; everyone else gets published rows only.
  const { data: editorProfile } = await admin
    .from('profiles').select('is_persona_editor').eq('id', user.id).maybeSingle();
  const isEditor = !!editorProfile?.is_persona_editor;

  let editorialQuery = admin
    .from('persona_posts')
    .select('id, persona, name, name_zh, cuisine, body_zh, body_en, image_url, image_credit, status, created_at, published_at')
    .order('created_at', { ascending: false })
    .limit(30);
  editorialQuery = isEditor
    ? editorialQuery.in('status', ['pending', 'published'])
    : editorialQuery.eq('status', 'published');
  const { data: editorialRows } = await editorialQuery;

  const editorialItems: Timed[] = ((editorialRows ?? []) as any[])
    .filter(r => isPersona(r.persona))
    .map(r => ({
      id: r.id as string,
      // Publication time is the feed clock where it exists — a draft approved
      // days after seeding should surface as new, not buried at its authoring
      // date. Pending rows (editor-only) ride on created_at.
      at: (r.published_at ?? r.created_at) as string,
      author: { kind: 'persona' as const, username: PERSONA_META[r.persona as 'spoon' | 'ck' | 'kiki'][lang] },
      dish: {
        id: null,
        name: r.name ?? null, name_zh: r.name_zh ?? null,
        restaurant: null,
        cuisine: r.cuisine ?? null,
        photo_url: r.image_url as string,
        attributes: {},
        diet: [], heaviness: null, ingredients: [],
      },
      // A columnist asserts no verdict — nobody ate anything.
      verdict: null,
      reason: (lang === 'en' ? r.body_en : r.body_zh) ?? null,
      editorial: {
        credit: r.image_credit as string,
        ...(r.status === 'pending' ? { pending: true } : {}),
      },
    }));

  // One pool, newest first. All author types sort on the same clock, so a
  // fresh post appears above the morning's persona picks rather than in a
  // block behind them.
  const pool = [...items, ...personaItems, ...editorialItems]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 30);

  // Bookmark counts, EVERYONE's — the count on a card is "how many people
  // want to eat this", not just the viewer's own state, so it's a separate
  // query over the same from_dish_id column with no user_id filter, scoped to
  // just the dishes actually rendered. Editorial cards mirror the whole
  // pattern on from_persona_post_id — same affordance, different key.
  const poolDishIds = Array.from(new Set(pool.map(i => i.dish.id).filter((id): id is string => !!id)));
  const bookmarkCounts = new Map<string, number>();
  if (poolDishIds.length > 0) {
    const { data: allBookmarks } = await admin
      .from('dishes').select('from_dish_id').in('from_dish_id', poolDishIds);
    for (const b of allBookmarks ?? []) {
      const id = b.from_dish_id as string;
      bookmarkCounts.set(id, (bookmarkCounts.get(id) ?? 0) + 1);
    }
  }

  const editorialIds = pool.filter(i => i.editorial).map(i => i.id);
  const editorialBookmarked = new Set<string>();
  const editorialCounts = new Map<string, number>();
  if (editorialIds.length > 0) {
    const { data: eb } = await admin
      .from('dishes').select('from_persona_post_id, user_id').in('from_persona_post_id', editorialIds);
    for (const b of eb ?? []) {
      const id = b.from_persona_post_id as string;
      editorialCounts.set(id, (editorialCounts.get(id) ?? 0) + 1);
      if (b.user_id === user.id) editorialBookmarked.add(id);
    }
  }

  return NextResponse.json({
    // Told apart deliberately: 'empty' is a legitimate quiet day, 'failed' is
    // the job breaking, and a missing row means it never ran today. The UI must
    // never render the last two as silence.
    persona_status: (runRow?.status as string | undefined) ?? 'missing',
    items: pool.map(({ at: _at, ...i }) => ({
      ...i,
      bookmarked: i.editorial
        ? editorialBookmarked.has(i.id)
        : !!i.dish.id && bookmarked.has(i.dish.id),
      bookmarkCount: i.editorial
        ? (editorialCounts.get(i.id) ?? 0)
        : i.dish.id ? (bookmarkCounts.get(i.dish.id) ?? 0) : 0,
    })),
  });
}
