import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { translateDishName, inferCuisineFromName } from '@/lib/translate';
import { reanalyzeAnchored } from '@/lib/vision';
import { scoreOneDish } from '@/lib/menuScan';
import { replayProfile } from '@/lib/replay';

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

  let query = supabase
    .from('dishes')
    .select('id, name, name_zh, cuisine, photo_url, created_at, restaurant_id, restaurants(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);
  // Cursor pagination (not offset): stays correct even if new dishes get added
  // between page loads, which a simple page-number/offset scheme would silently
  // skip or duplicate around.
  if (before) query = query.lt('created_at', before);
  const { data: dishes } = await query;

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
      created_at: d.created_at, // used as the next page's `before` cursor
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
  if (name === undefined && nameZh === undefined) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });

  const patch: Record<string, string | null> = {};
  if (name) patch.name = name;
  if (nameZh !== undefined) patch.name_zh = nameZh || null;

  if (editedEn && !editedZh && name) {
    const translated = await translateDishName(name);
    if (translated) patch.name_zh = translated;
  } else if (editedZh && !editedEn && nameZh) {
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
  const correctedName = editedEn ? name : editedZh ? nameZh : undefined;
  let relearned = false;
  if (correctedName) {
    const { data: current } = await supabase
      .from('dishes').select('photo_url').eq('id', dishId).eq('user_id', user.id).maybeSingle();
    if (!current) return NextResponse.json({ error: 'Not found or not yours.' }, { status: 403 });

    let rederived: { attributes: Record<string, number>; cuisine: string } | null = null;
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
      rederived = { attributes, cuisine: cuisine ?? 'unknown' };
    }
    if (rederived) {
      if (Object.keys(rederived.attributes).length) (patch as any).attributes = rederived.attributes;
      if (rederived.cuisine && rederived.cuisine !== 'unknown') patch.cuisine = rederived.cuisine;
    }
  }

  const { data, error } = await supabase
    .from('dishes').update(patch).eq('id', dishId).select('id, name, name_zh, cuisine, attributes').single();
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

  return NextResponse.json({ dish: data, relearned });
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
