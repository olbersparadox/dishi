import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { translateDishName, inferCuisineFromName } from '@/lib/translate';
import { reanalyzeAnchored } from '@/lib/vision';
import { scoreOneDish } from '@/lib/menuScan';
import { replayProfile } from '@/lib/replay';
import { resolveOrCreateRestaurant } from '@/lib/restaurant';
import { directionOf } from '@/lib/seal';
import { resolveAndStoreCanonicalDish } from '@/lib/dishCanonical';
import { memberName } from '@/lib/memberName';

// The PATCH rename cascade runs reanalyzeAnchored (a vision call, ~15-20s) BEFORE it
// writes the row, so the default ~10s window killed the function before the update
// landed — the rename silently didn't persist. Match the other vision routes.
export const maxDuration = 60;

/** How long a table-mate's dish stays on offer in your rating queue.
 *
 * ONE DAY, and the tightness is deliberate. Your own picks are a debt you keep
 * however long they sit; a table-mate's dish is an invitation about the meal you
 * just ate, and an invitation that piles up is a chore list. Measured against
 * live data while wiring this: a week-long window pulled in 44 dishes from ~20
 * past sessions and buried the two-dish meal that prompted the whole fix. A day
 * covers the real rating moment — the couch, that evening, which is the same
 * EXIF-first thesis the album flow rests on — and nothing beyond it.
 *
 * The cost, stated because it is real: two shared meals more than a day apart
 * means the earlier table's dishes are gone from the queue before you rate them.
 * Widen this, or key it to the most recent session instead, if that bites. */
const TABLEMATE_WINDOW_HOURS = 24;

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
export async function GET(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  // Lightweight path for the Log page's "dishes to rate" placeholders: picks (or any
  // dish) the user hasn't rated yet. No hearts/lock computation needed here — an
  // unrated dish is never locked, and hearts on it aren't relevant to "rate this."
  if (req.nextUrl.searchParams.get('unrated') === '1') {
    // photo_url + coords: the queued pick is now rated through the SAME flick →
    // growth flow as an album batch, so its card needs the photo (when it has one)
    // and its coords need to seed the nearby-restaurant refine. restaurant_id +
    // both restaurant names: a scan/table pick KNOWS its restaurant — the growth
    // card renders it as fixed context instead of re-guessing (pickContext.ts).
    const COLS = 'id, user_id, name, name_zh, cuisine, photo_url, lat, lng, source, created_at, restaurant_id, restaurants(name, name_zh)';

    // A SHARED TABLE'S DISHES BELONG TO EVERYONE WHO ATE THEM (owner, field
    // session 2026-08-03). A table of two picked two dishes and each phone
    // showed one, because a pick creates a dish row owned by whoever tapped it.
    // But a HK table shares its food — the bill this screen just split divided
    // BOTH dishes evenly over BOTH people — so each member ate both, and
    // 去評分 ("rate what you ate") has to mean the table's food, not your
    // tapping history.
    //
    // The other members' dishes are surfaced as THE SAME ROWS, never copied
    // per-member. ratings is unique(user_id, dish_id) precisely so several
    // people can rate one dish, and is_dish_locked already reasons about
    // "someone OTHER than the owner has rated this". Fanning out a row per
    // member would instead fragment the dish-level demand data the whole
    // identity ladder exists to unify — one 魚湯海斑米線 with two ratings is
    // the asset; two near-identical rows with one each is the bug.
    const { data: memberships } = await supabase
      .from('table_members').select('session_id').eq('user_id', user.id);
    const sessionIds = Array.from(new Set((memberships ?? []).map((m: any) => m.session_id))).filter(Boolean);

    const [{ data: mine }, { data: tablemates }] = await Promise.all([
      supabase.from('dishes').select(COLS)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30),
      // profiles: whose pick it was, so the card can say so rather than
      // presenting a stranger's dish as one you logged and forgot.
      sessionIds.length
        ? supabase.from('dishes').select(`${COLS}, profiles(display_name, username_display, handle)`)
            .in('table_session_id', sessionIds)
            .neq('user_id', user.id)
            // Bounded, unlike your own picks — see TABLEMATE_WINDOW_HOURS for
            // why the asymmetry is the point. Without it this change back-fills
            // every table you have ever sat at.
            .gte('created_at', new Date(Date.now() - TABLEMATE_WINDOW_HOURS * 3_600_000).toISOString())
            .order('created_at', { ascending: false })
            .limit(30)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    // Newest first across BOTH sources — a table-mate's pick from ten minutes
    // ago belongs above your own from last week, not in a second section.
    const all = [...(mine ?? []), ...(tablemates ?? [])]
      .sort((a: any, b: any) => (a.created_at < b.created_at ? 1 : -1));

    const ids = all.map((d: any) => d.id);
    let rated = new Set<string>();
    if (ids.length) {
      const { data: myRatings } = await supabase
        .from('ratings').select('dish_id').eq('user_id', user.id).in('dish_id', ids);
      rated = new Set((myRatings ?? []).map(r => r.dish_id));
    }

    return NextResponse.json({
      dishes: all
        .filter((d: any) => !rated.has(d.id))
        .map((d: any) => ({
          id: d.id, name: d.name, name_zh: d.name_zh, cuisine: d.cuisine,
          photo_url: d.photo_url ?? null, lat: d.lat ?? null, lng: d.lng ?? null,
          source: d.source, restaurant: d.restaurants?.name ?? null,
          restaurant_id: d.restaurant_id ?? null,
          restaurant_name_zh: d.restaurants?.name_zh ?? null,
          // Everything the client must NOT offer on someone else's row hangs off
          // this one flag. The database already refuses the writes (dishes'
          // update/delete policies are auth.uid() = user_id); this exists so the
          // UI never offers a control that would silently do nothing.
          mine: d.user_id === user.id,
          // memberName's own ladder (display_name > username_display > handle),
          // not a second copy of it. Empty rather than its 'someone' fallback:
          // this route has no language, and a nameless table-mate is better left
          // unnamed than labelled in the wrong one.
          picked_by: d.user_id === user.id ? null : (memberName(d.profiles, '') || null),
        })),
    });
  }

  const PAGE_SIZE = 12;
  const before = req.nextUrl.searchParams.get('before');
  // rated=1 -> only dishes this user has actually RATED. The Taste tab shows
  // "dishes to rate" and "dishes you've rated" as two separate sections, and
  // without this filter an unrated pick appears in BOTH (the rated list used to
  // be an unfiltered "all my dishes" list, which was correct when it was the only
  // dish list in the app, and became a duplicate the moment it wasn't).
  const ratedOnly = req.nextUrl.searchParams.get('rated') === '1';

  let ratedIds: string[] | null = null;
  if (ratedOnly) {
    const { data: myRatings } = await supabase
      .from('ratings').select('dish_id').eq('user_id', user.id);
    ratedIds = (myRatings ?? []).map(r => r.dish_id);
    // No ratings at all -> nothing to show. Returning early avoids an `.in()` with
    // an empty array, whose behaviour is a footgun not worth relying on.
    if (ratedIds.length === 0) return NextResponse.json({ dishes: [], has_more: false });
  }

  let query = supabase
    .from('dishes')
    .select('id, name, name_zh, cuisine, photo_url, created_at, eaten_at, district, lat, lng, source, restaurant_id, dish_identity_id, dish_identity_checked_at, cooking_method, heaviness, diet, restaurants(name, area, district), dish_identities(name, name_zh)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);
  if (ratedIds) query = query.in('id', ratedIds);
  // Cursor pagination (not offset): stays correct even if new dishes get added
  // between page loads, which a simple page-number/offset scheme would silently
  // skip or duplicate around.
  if (before) query = query.lt('created_at', before);
  const { data: dishes } = await query;

  const ids = (dishes ?? []).map(d => d.id);
  const admin = supabaseAdmin();
  let hearts = new Map<string, number>();
  let myScores = new Map<string, number>();
  let lockedSet = new Set<string>();
  // 同檯 companions per dish (Table Mode item 4): who shared the table when
  // this dish was picked. display_name-first with the handle fallback — the
  // SAME identity chain the table's own chop stamps rendered live, so a
  // person doesn't change name between the meal and the diary of it.
  let companions = new Map<string, { user_id: string; name: string }[]>();
  // The BROKEN seal per dish — what the engine called before the person rated,
  // so the 已評嘅菜 list can stamp each dish with how that call went (the same
  // reveal the growth screen shows, now with a permanent home instead of a
  // once-only card).
  //
  // THE SEAL CONTRACT: this query is hard-filtered on `revealed_at IS NOT NULL`.
  // A pending prediction must never reach the client in any shape — it may only
  // ever learn that a seal EXISTS (the 印 stamp), never what it says. Read via
  // the admin client and scoped to this user, per the standing pattern for
  // sealed_predictions (RLS-locked against its own owner).
  let seals = new Map<string, unknown>();
  // 貼文 state per dish, so the journal row can say whether it is public and
  // reopen the sheet on the reason already written. Absent = not posted.
  // Carries the TIER as well: this row shows a globe for 'public' and a link
  // glyph for 'link', and they must not look alike — "the world can find
  // this" and "only people holding the link can" are different promises.
  let posts = new Map<string, { reason: string | null; visibility: string }>();

  if (ids.length) {
    // locked_dish_ids batches what used to be one is_dish_locked RPC PER dish (the
    // journal's main slowness) into a single query returning just the locked ids.
    const [{ data: marks }, { data: ratings }, { data: lockedRows }, { data: edges }, { data: sealRows }, { data: postRows }] = await Promise.all([
      admin.from('helpful_marks').select('dish_id').in('dish_id', ids),
      supabase.from('ratings').select('dish_id, score').eq('user_id', user.id).in('dish_id', ids),
      admin.rpc('locked_dish_ids', { p_dish_ids: ids }),
      // Only edges I'M a party to — a dish's (other,other) pairs belong to
      // those members' own journals, not mine. Admin client per the standing
      // RLS pattern (reads scoped to the authenticated user's own edges).
      admin.from('companion_edges')
        .select('dish_id, user_a, user_b')
        .in('dish_id', ids)
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`),
      admin.from('sealed_predictions')
        .select('id, dish_id, predicted_direction, outcome, actual_score, predicted_reason_zh, predicted_reason_en')
        .eq('user_id', user.id)
        .in('dish_id', ids)
        .not('revealed_at', 'is', null)   // decided only — never a pending seal
        .order('revealed_at', { ascending: false }),
      // User-scoped client: a post is the owner's own row and RLS is the right
      // fence for it (unlike sealed_predictions, which is locked against its
      // owner by design and must go through admin).
      // DELIBERATELY UNFILTERED by visibility, unlike /api/feed, the dossier
      // page and the persona cron: this is the owner looking at their OWN
      // posts, where a link-only post is not hidden material — it is theirs,
      // and hiding it here is how someone loses track of what they shared.
      supabase.from('dish_posts').select('dish_id, reason, visibility').eq('user_id', user.id).in('dish_id', ids),
    ]);
    for (const p of postRows ?? []) {
      posts.set(p.dish_id, {
        reason: (p.reason as string | null) ?? null,
        visibility: (p.visibility as string | null) ?? 'public',
      });
    }
    for (const m of marks ?? []) hearts.set(m.dish_id, (hearts.get(m.dish_id) ?? 0) + 1);
    for (const r of ratings ?? []) myScores.set(r.dish_id, r.score);
    for (const row of (lockedRows ?? []) as unknown[]) {
      lockedSet.add(typeof row === 'string' ? row : (row as { locked_dish_ids?: string }).locked_dish_ids ?? '');
    }
    // Newest revealed verdict wins per dish (rows arrive revealed-desc): a
    // re-rated dish is stamped with the call on the rating that stands, not an
    // older one it has since superseded.
    for (const s of (sealRows ?? []) as any[]) {
      if (seals.has(s.dish_id)) continue;
      seals.set(s.dish_id, {
        id: s.id,
        predicted_direction: s.predicted_direction,
        // Re-derived from the STORED actual_score with the same directionOf the
        // reveal itself used, so this route can never state a different verdict
        // than the one already computed. `outcome` is read, not recomputed.
        actual_direction: directionOf(s.actual_score ?? 0),
        outcome: s.outcome,
        reason_zh: s.predicted_reason_zh ?? null,
        reason_en: s.predicted_reason_en ?? null,
      });
    }

    if (edges && edges.length) {
      const otherIds = Array.from(new Set(edges.map(e => e.user_a === user.id ? e.user_b : e.user_a)));
      const { data: profiles } = await admin
        .from('profiles').select('id, display_name, handle').in('id', otherIds);
      const nameById = new Map((profiles ?? []).map(p => [p.id, (p.display_name as string | null) ?? (p.handle as string | null) ?? 'someone']));
      // No per-dish dedupe needed: unique (dish, pair) means each edge here
      // carries a DISTINCT counterpart for that dish.
      for (const e of edges) {
        const other = e.user_a === user.id ? e.user_b : e.user_a;
        const list = companions.get(e.dish_id) ?? [];
        // user_id rides along for the chop's color seed — color is f(user_id),
        // never f(name), so the same companion stays the same color everywhere.
        list.push({ user_id: other, name: nameById.get(other) ?? 'someone' });
        companions.set(e.dish_id, list);
      }
    }
  }

  return NextResponse.json({
    dishes: (dishes ?? []).map((d: any) => ({
      id: d.id, name: d.name, name_zh: d.name_zh, cuisine: d.cuisine,
      photo_url: d.photo_url, restaurant: d.restaurants?.name ?? null,
      restaurant_area: d.restaurants?.area ?? null, restaurant_district: d.restaurants?.district ?? null,
      district: d.district ?? null, source: d.source ?? null,
      lat: d.lat ?? null, lng: d.lng ?? null, // photo EXIF coords → seed the "switch restaurant" picker

      restaurant_id: d.restaurant_id ?? null, dish_identity_id: d.dish_identity_id ?? null,
      dish_identity_checked_at: d.dish_identity_checked_at ?? null,
      identity_name: d.dish_identities?.name ?? null, identity_name_zh: d.dish_identities?.name_zh ?? null,
      cooking_method: d.cooking_method, heaviness: d.heaviness, diet: d.diet ?? [],
      hearts: hearts.get(d.id) ?? 0,
      my_score: myScores.get(d.id) ?? null,
      locked: lockedSet.has(d.id),
      companions: companions.get(d.id) ?? [], // 同檯 chop names for shared-meal dishes
      seal: seals.get(d.id) ?? null, // the BROKEN seal only — see the query above
      posted: posts.has(d.id),
      post_visibility: posts.get(d.id)?.visibility ?? null,
      post_reason: posts.get(d.id)?.reason ?? null,

      created_at: d.created_at, // used as the next page's `before` cursor
      eaten_at: d.eaten_at ?? null, // photo-EXIF when-eaten; shown (not ordered by) on the card
    })),
    has_more: (dishes ?? []).length === PAGE_SIZE,
  });
}

/**
 * PATCH { dish_id, name?, name_zh?, edited_en?, edited_zh? }
 * -> rename, with the FULL correction cascade (blocked server-side if locked):
 *    translation of the untouched language, cuisine re-derivation, attribute
 *    re-derivation (photo-anchored when a photo exists), and — if the owner already
 *    rated this dish — a full profile replay so the learning heals retroactively.
 *    Returns { dish, relearned } so the client can tell the person their taste
 *    profile was re-learned from the correction.
 *
 * edited_en/edited_zh tell the server which field the PERSON actually typed this
 * session, as opposed to text that's just sitting there from the original vision
 * guess. This matters because the two must be treated differently:
 *   - edited exactly one language -> the untouched field is stale machine text
 *     (or empty); translate the edited value into it, overwriting freely.
 *   - edited both -> both are the person's own words; never auto-translate over
 *     either one.
 * Previously auto-translate only checked "is the other field currently empty,"
 * so correcting an already-named dish (the common case, since vision names BOTH
 * languages at creation) never re-translated anything, silently leaving a stale,
 * now-wrong name in whichever language wasn't touched.
 *
 * Cuisine is re-derived from whichever name the person actually corrected, since a
 * wrong vision name usually means the cuisine guessed alongside it is wrong too.
 * Best-effort throughout: any translate/infer failure keeps the existing value
 * rather than blocking the rename itself.
 */
/**
 * PATCH { dish_id, name?, name_zh?, edited_en?, edited_zh?, restaurant_id?, new_restaurant? }
 * -> rename (with the full correction cascade, as before) AND/OR change which
 *    restaurant a dish is attached to — independently of each other; either can
 *    be sent alone. Both are blocked server-side if locked, for the same reason:
 *    once someone else has rated this dish (or the same restaurant+name), both a
 *    name AND a restaurant change would retroactively alter what they learned
 *    from, or silently unlink this row from a group they're relying on.
 *
 * Restaurant resolution reuses resolveOrCreateRestaurant — the SAME dedup logic
 * (place_id, then normalized-name-within-50m, then create) that photo-logging and
 * menu-scan picks already use, so correcting a wrongly-attached restaurant here
 * can't silently fork a duplicate restaurant row either.
 */
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

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : undefined;
  const nameZh = typeof body.name_zh === 'string' ? body.name_zh.trim().slice(0, 120) : undefined;
  const editedEn = !!body.edited_en, editedZh = !!body.edited_zh;
  // clear_restaurant is 略過/住家菜 in 食記 saying "none of these" about a dish that
  // ALREADY has a restaurant. Before 2026-08-07 there was no way to express that:
  // both chips produced a null choice, the client read null as "nothing to save,"
  // and a wrong attribution was unremovable through the UI that offered to fix it.
  // Blank beats wrong — an empty restaurant is honest, a confidently wrong one
  // pollutes execution comparisons and the taste engine's per-restaurant read.
  const clearRestaurant = body.clear_restaurant === true;
  const wantsRestaurantChange = typeof body.restaurant_id === 'string' || !!body.new_restaurant || clearRestaurant;
  if (name === undefined && nameZh === undefined && !wantsRestaurantChange) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  // Current stored names, needed to tell a REAL rename from a resubmission of the
  // same text. Clients pre-fill their name inputs with the existing names, so a
  // request carrying a name proves nothing on its own — only a name that actually
  // DIFFERS is a human authoring a name.
  const { data: existing } = await supabase
    .from('dishes').select('name, name_zh, photo_url').eq('id', dishId).eq('user_id', user.id).maybeSingle();
  if (!existing) return NextResponse.json({ error: 'Not found or not yours.' }, { status: 403 });

  const nameChanged =
    (name !== undefined && name !== existing.name) ||
    (nameZh !== undefined && (nameZh || null) !== (existing.name_zh ?? null));

  const patch: Record<string, string | null> = {};
  if (name) patch.name = name;
  if (nameZh !== undefined) patch.name_zh = nameZh || null;
  if (nameChanged) {
    // A person just authored a name that differs from what was stored. That's a
    // STRONGER claim than a vision guess, but a WEAKER one than the restaurant's own
    // printed menu — and crucially, if this row came from a menu scan, its name is no
    // longer the menu's words and must stop claiming menu authority. See
    // nameAuthority() in dishIdentity.ts.
    //
    // Guarded on an ACTUAL difference, not merely on a name being present in the
    // request: an edit that only changes the restaurant re-sends the unchanged name
    // alongside it, and stamping on that would silently demote a menu-scan name from
    // AUTHORITY_MENU to AUTHORITY_HUMAN for a name nobody touched.
    (patch as any).name_edited_at = new Date().toISOString();
  }

  if (wantsRestaurantChange) {
    if (clearRestaurant) {
      // Detach only. The restaurant row itself is left alone — it may carry other
      // people's dishes, and this edit speaks for ONE dish.
      patch.restaurant_id = null;
    } else if (typeof body.restaurant_id === 'string') {
      patch.restaurant_id = body.restaurant_id;
    } else {
      const resolved = await resolveOrCreateRestaurant(supabase, user.id, null, body.new_restaurant);
      if (resolved.error) return NextResponse.json({ error: resolved.error }, { status: 400 });
      patch.restaurant_id = resolved.id;
    }
  }

  // Auto-translate only on a REAL rename. Without the nameChanged guard, a
  // restaurant-only edit that re-sends the untouched names would burn a
  // translation call and could overwrite the other language with a fresh machine
  // translation of a name the person never touched.
  if (nameChanged && editedEn && !editedZh && name) {
    const translated = await translateDishName(name);
    if (translated) patch.name_zh = translated;
  } else if (nameChanged && editedZh && !editedEn && nameZh) {
    const translated = await translateDishName(nameZh);
    if (translated) patch.name = translated;
  }

  // A corrected name invalidates the whole vision bundle that came with the wrong
  // guess — not just cuisine, but the ATTRIBUTES the taste engine learns from.
  // (Real case: vision misread a dish, its bundled attributes included braised:0.9,
  // the person corrected the name to "Lobster sashimi", and the wrong attributes
  // stayed — one loved rating then taught a phantom "loves braised" preference.)
  // Photo available -> re-analyze the photo anchored on the person's name (the
  // photo still carries preparation/sauce/portion information a name alone loses).
  // No photo -> text-only rescoring, same path menu scanning uses.
  const correctedName = nameChanged ? (editedEn ? name : editedZh ? nameZh : undefined) : undefined;
  let relearned = false;
  if (correctedName) {
    const current = existing; // already loaded above (name/name_zh/photo_url)

    let rederived: {
      attributes: Record<string, number>; cuisine: string;
      diet?: string[]; cooking_method?: string | null; heaviness?: string | null;
      ingredients?: string[];
    } | null = null;
    if (current.photo_url) {
      try {
        const imgRes = await fetch(current.photo_url);
        if (imgRes.ok) {
          const buf = Buffer.from(await imgRes.arrayBuffer());
          const mediaType = imgRes.headers.get('content-type') ?? 'image/jpeg';
          rederived = await reanalyzeAnchored(correctedName, buf.toString('base64'), mediaType);
        }
      } catch { /* fall through to text-only below */ }
    }
    if (!rederived) {
      const [attributes, cuisine] = await Promise.all([
        scoreOneDish({ name: correctedName, cuisine: patch.cuisine ?? 'unknown' }),
        inferCuisineFromName(correctedName),
      ]);
      // Text-only rescoring (menuScoring.ts) doesn't produce cooking_method/diet/
      // heaviness — those come from photo analysis. Leaving them untouched here is
      // deliberate: a rename with no photo shouldn't overwrite a real cooking-style
      // read with a guess this path can't actually make.
      rederived = { attributes, cuisine: cuisine ?? 'unknown' };
    }
    if (rederived) {
      if (Object.keys(rederived.attributes).length) (patch as any).attributes = rederived.attributes;
      if (rederived.cuisine && rederived.cuisine !== 'unknown') patch.cuisine = rederived.cuisine;
      if (rederived.cooking_method !== undefined) (patch as any).cooking_method = rederived.cooking_method;
      if (rederived.heaviness !== undefined) (patch as any).heaviness = rederived.heaviness;
      if (rederived.diet !== undefined) (patch as any).diet = rederived.diet;
      // Photo-anchored path only (the text-only fallback below can't read
      // ingredients off a name it never saw): a corrected name must not leave
      // the WRONG dish's ingredient chips on the row. Guarded on non-empty —
      // an empty list from a flaked call is a failed read, not a verdict, and
      // writing it would erase real chips (the lesson from the 2026-07-23
      // diet-flag wipe, see scripts/backfill-diet-flags.ts).
      if (rederived.ingredients?.length) (patch as any).ingredients = rederived.ingredients;
    }
  }

  const { data, error } = await supabase
    .from('dishes').update(patch).eq('id', dishId)
    .select('id, name, name_zh, cuisine, attributes, restaurant_id, cooking_method, heaviness, diet, restaurants(name)').single();
  if (error || !data) return NextResponse.json({ error: 'Not found or not yours.' }, { status: 403 });

  // A real rename invalidates the canonical (cross-venue) resolution the same
  // way it invalidates the vision bundle: resolution READS the name, and the
  // name just changed under it — an early misread must not stick after the
  // person corrects it. Re-resolve from the final stored names. This writes
  // only canonical_dish_id (resolution state); the name_edited_at stamp above
  // is name authority and was already decided independently.
  if (nameChanged) {
    await resolveAndStoreCanonicalDish(supabase, dishId, data.name, data.name_zh);
  }

  // If the person has RATED this dish, their profile learned from the old (wrong)
  // attributes — replay the whole rating history through the real engine against
  // current attributes so the correction retroactively heals the learning too.
  // Only the owner's profile can be stale here: the lock check above guarantees
  // nobody else has rated this dish, or we'd never have gotten this far.
  if (correctedName && (patch as any).attributes) {
    const { count } = await supabase
      .from('ratings').select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('dish_id', dishId);
    if ((count ?? 0) > 0) {
      const rebuilt = await replayProfile(supabase, user.id);
      if (rebuilt) {
        await supabase.from('taste_profiles').update({
          vector: rebuilt.vector,
          evidence: rebuilt.evidence,
          cuisine_affinity: rebuilt.cuisine_affinity,
          domain_evidence: rebuilt.domain_evidence,
          domain_evidence_t: rebuilt.domain_evidence_t,
          updated_at: new Date().toISOString(),
        }).eq('user_id', user.id);
        relearned = true;
      }
    }
  }

  return NextResponse.json({
    dish: { ...data, restaurant: (data as any).restaurants?.name ?? null },
    relearned,
  });
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

  // Did the owner rate this dish? The journal only lists rated dishes, but check
  // explicitly so the taste replay below only fires when a delete truly removes a
  // rating from history.
  const { count: ratedCount } = await supabase
    .from('ratings').select('*', { count: 'exact', head: true })
    .eq('user_id', user.id).eq('dish_id', dish_id);

  // Detach any points_ledger reference first: that FK is ON DELETE NO ACTION, so a
  // points row would otherwise block the whole delete. Points already earned stay in
  // the ledger, just no longer pointing at a dish that no longer exists. Everything
  // else referencing the dish (ratings, sealed_predictions, duels, helpful_marks…)
  // is ON DELETE CASCADE and clears itself.
  await admin.from('points_ledger').update({ dish_id: null }).eq('dish_id', dish_id);

  const { error } = await supabase.from('dishes').delete().eq('id', dish_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // The rating just cascaded away with the dish — but the taste profile is a stored
  // snapshot that still reflects it. Replay the remaining ratings so the profile
  // honestly rewinds to a world where this dish was never rated (the same heal
  // mechanism the rename cascade and re-rate use), and drop rating_count to match —
  // it gates the buddy/unlock threshold, so it must not count a rating that's gone.
  if ((ratedCount ?? 0) > 0) {
    const rebuilt = await replayProfile(supabase, user.id);
    if (rebuilt) {
      await supabase.from('taste_profiles').update({
        vector: rebuilt.vector,
        evidence: rebuilt.evidence,
        cuisine_affinity: rebuilt.cuisine_affinity,
        domain_evidence: rebuilt.domain_evidence,
        domain_evidence_t: rebuilt.domain_evidence_t,
        rating_count: rebuilt.replayed,
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id);
    }
  }

  return NextResponse.json({ ok: true });
}
