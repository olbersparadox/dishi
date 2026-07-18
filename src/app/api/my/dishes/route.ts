import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { translateDishName, inferCuisineFromName } from '@/lib/translate';
import { reanalyzeAnchored } from '@/lib/vision';
import { scoreOneDish } from '@/lib/menuScan';
import { replayProfile } from '@/lib/replay';
import { resolveOrCreateRestaurant } from '@/lib/restaurant';

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
    const { data: mine } = await supabase
      .from('dishes')
      .select('id, name, name_zh, cuisine, source, created_at, restaurants(name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    const ids = (mine ?? []).map(d => d.id);
    let rated = new Set<string>();
    if (ids.length) {
      const { data: myRatings } = await supabase
        .from('ratings').select('dish_id').eq('user_id', user.id).in('dish_id', ids);
      rated = new Set((myRatings ?? []).map(r => r.dish_id));
    }

    return NextResponse.json({
      dishes: (mine ?? [])
        .filter(d => !rated.has(d.id))
        .map((d: any) => ({
          id: d.id, name: d.name, name_zh: d.name_zh, cuisine: d.cuisine,
          source: d.source, restaurant: d.restaurants?.name ?? null,
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
    .select('id, name, name_zh, cuisine, photo_url, created_at, eaten_at, district, source, restaurant_id, dish_identity_id, dish_identity_checked_at, cooking_method, heaviness, diet, restaurants(name, area, district), dish_identities(name, name_zh)')
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

  if (ids.length) {
    // locked_dish_ids batches what used to be one is_dish_locked RPC PER dish (the
    // journal's main slowness) into a single query returning just the locked ids.
    const [{ data: marks }, { data: ratings }, { data: lockedRows }] = await Promise.all([
      admin.from('helpful_marks').select('dish_id').in('dish_id', ids),
      supabase.from('ratings').select('dish_id, score').eq('user_id', user.id).in('dish_id', ids),
      admin.rpc('locked_dish_ids', { p_dish_ids: ids }),
    ]);
    for (const m of marks ?? []) hearts.set(m.dish_id, (hearts.get(m.dish_id) ?? 0) + 1);
    for (const r of ratings ?? []) myScores.set(r.dish_id, r.score);
    for (const row of (lockedRows ?? []) as unknown[]) {
      lockedSet.add(typeof row === 'string' ? row : (row as { locked_dish_ids?: string }).locked_dish_ids ?? '');
    }
  }

  return NextResponse.json({
    dishes: (dishes ?? []).map((d: any) => ({
      id: d.id, name: d.name, name_zh: d.name_zh, cuisine: d.cuisine,
      photo_url: d.photo_url, restaurant: d.restaurants?.name ?? null,
      restaurant_area: d.restaurants?.area ?? null, restaurant_district: d.restaurants?.district ?? null,
      district: d.district ?? null, source: d.source ?? null,
      restaurant_id: d.restaurant_id ?? null, dish_identity_id: d.dish_identity_id ?? null,
      dish_identity_checked_at: d.dish_identity_checked_at ?? null,
      identity_name: d.dish_identities?.name ?? null, identity_name_zh: d.dish_identities?.name_zh ?? null,
      cooking_method: d.cooking_method, heaviness: d.heaviness, diet: d.diet ?? [],
      hearts: hearts.get(d.id) ?? 0,
      my_score: myScores.get(d.id) ?? null,
      locked: lockedSet.has(d.id),
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
  const wantsRestaurantChange = typeof body.restaurant_id === 'string' || !!body.new_restaurant;
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
    if (typeof body.restaurant_id === 'string') {
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
    }
  }

  const { data, error } = await supabase
    .from('dishes').update(patch).eq('id', dishId)
    .select('id, name, name_zh, cuisine, attributes, restaurant_id, cooking_method, heaviness, diet, restaurants(name)').single();
  if (error || !data) return NextResponse.json({ error: 'Not found or not yours.' }, { status: 403 });

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

  const { error } = await supabase.from('dishes').delete().eq('id', dish_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
