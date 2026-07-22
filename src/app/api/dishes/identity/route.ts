import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { candidateMatches, nameAuthority, preferredName, dismissalBlocks, type DishLike, type PairVerdict } from '@/lib/dishIdentity';
import { adjudicateSameDish } from '@/lib/dishMatch';
import { applyOwnerMenuAuthority, propagateIdentityNameToDishes } from '@/lib/ownerMenuReconcile';

export const maxDuration = 60;

/**
 * GET /api/dishes/identity?dish_id=...
 * "Is this the same dish as one we already know about here?"
 *
 * Runs gate 1 (cheap string prefilter, dishIdentity.ts) then gate 2 (LLM
 * adjudication, dishMatch.ts) and returns at most ONE suggestion — which the client
 * shows as a confirm, never as an accomplished fact. Gate 3 is the human.
 *
 * Returns { suggestion: null } for every uninteresting case (no restaurant, nothing
 * similar, model unsure, model unavailable). Silence is the correct default: the
 * whole point of the pipeline is that a wrong "same dish?" prompt is worse than no
 * prompt at all.
 */
export async function GET(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const dishId = req.nextUrl.searchParams.get('dish_id');
  if (!dishId) return NextResponse.json({ error: 'dish_id is required.' }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: dish } = await admin
    .from('dishes')
    .select('id, name, name_zh, restaurant_id, dish_identity_id, user_id, source, name_edited_at')
    .eq('id', dishId)
    .maybeSingle();

  if (!dish || dish.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found or not yours.' }, { status: 403 });
  }
  // Home-cooked dishes have no restaurant, so there is no shared menu to resolve
  // against — identity is meaningless for them. Already-linked dishes are settled.
  if (!dish.restaurant_id || dish.dish_identity_id) {
    return NextResponse.json({ suggestion: null });
  }

  // Stamped on every "checked, nothing to report" exit below — a genuine
  // singleton dish (nothing else at that restaurant looks like it) would
  // otherwise get re-probed, and re-billed for LLM adjudication, on every
  // single Taste-tab visit forever. Doesn't block this dish from being FOUND
  // as a candidate by someone else's check later — only stops it from being
  // the one that re-initiates a check on itself.
  async function noSuggestion() {
    await admin.from('dishes').update({ dish_identity_checked_at: new Date().toISOString() }).eq('id', dishId!);
    return NextResponse.json({ suggestion: null });
  }

  // The pool is every OTHER dish at this restaurant — across all users, since the
  // whole point is recognising someone else's row as the same real dish.
  const [{ data: pool }, { data: restaurant }, { data: dismissals }] = await Promise.all([
    admin.from('dishes')
      .select('id, name, name_zh, dish_identity_id, source, name_edited_at, photo_url')
      .eq('restaurant_id', dish.restaurant_id)
      .neq('id', dish.id)
      .limit(200),
    admin.from('restaurants').select('name').eq('id', dish.restaurant_id).maybeSingle(),
    // Pairs this person already ANSWERED about. Filtered out BEFORE adjudication —
    // both to avoid re-asking a settled question and to avoid paying for an LLM
    // call whose answer would be discarded anyway. Checked symmetrically: "A is
    // not B" means "B is not A". Verdict-aware (identity-confirm card): a real
    // 'different' blocks forever; an 'unsure' (唔肯定) blocks only within its
    // cooldown window — see dismissalBlocks in dishIdentity.ts.
    admin.from('dish_identity_dismissals')
      .select('dish_id, other_dish_id, verdict, created_at')
      .eq('user_id', user.id)
      .or(`dish_id.eq.${dishId},other_dish_id.eq.${dishId}`),
  ]);

  const dismissed = new Set<string>();
  for (const d of dismissals ?? []) {
    if (dismissalBlocks((d.verdict ?? 'different') as PairVerdict, d.created_at)) {
      dismissed.add(d.dish_id === dishId ? d.other_dish_id : d.dish_id);
    }
  }

  const candidates = candidateMatches(dish as DishLike, (pool ?? []) as DishLike[])
    .filter(c => !dismissed.has(c.id));
  if (candidates.length === 0) return await noSuggestion();

  const [winner] = await adjudicateSameDish(dish as DishLike, candidates, restaurant?.name);
  if (!winner) return await noSuggestion();

  // Resolve to the identity's canonical names when the winner is already part of a
  // group, so the person is asked about the name the dish is actually known by.
  let canonical = { name: winner.name, name_zh: winner.name_zh ?? null };
  if (winner.dish_identity_id) {
    const { data: ident } = await admin
      .from('dish_identities').select('name, name_zh').eq('id', winner.dish_identity_id).maybeSingle();
    if (ident) canonical = { name: ident.name, name_zh: ident.name_zh };
  }

  return NextResponse.json({
    suggestion: {
      dish_id: winner.id,
      identity_id: winner.dish_identity_id ?? null,
      name: canonical.name,
      name_zh: canonical.name_zh,
      // For the identity-confirm card's chassis side: the candidate's photo and
      // the shared restaurant (both dishes are at it, by construction).
      photo_url: (winner as DishLike & { photo_url?: string | null }).photo_url ?? null,
      restaurant: restaurant?.name ?? null,
    },
  });
}

/**
 * POST /api/dishes/identity
 * body: { dish_id, same_as_dish_id }  -> the person said YES, same dish
 *       { dish_id, same: false }      -> the person said NO; recorded as a no-op
 *
 * Linking is additive and never destructive: the dish keeps its own name, photo,
 * attributes, ratings and owner. All it gains is a pointer saying "this is the same
 * real-world thing as that." Nothing is overwritten, so a mistaken confirm costs a
 * pointer, not a rating history.
 */
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const dishId = typeof body?.dish_id === 'string' ? body.dish_id : null;
  const sameAsDishId = typeof body?.same_as_dish_id === 'string' ? body.same_as_dish_id : null;
  const notSameAsDishId = typeof body?.not_same_as_dish_id === 'string' ? body.not_same_as_dish_id : null;
  const unsureAboutDishId = typeof body?.unsure_about_dish_id === 'string' ? body.unsure_about_dish_id : null;
  if (!dishId) return NextResponse.json({ error: 'dish_id is required.' }, { status: 400 });
  if (!sameAsDishId) {
    // A non-merge verdict on the pair, persisted so the question isn't re-asked:
    //  - 唔同嘅 ('different'): PERMANENT. Re-asking a settled no reads as the app
    //    not listening. MERGED upsert (not ignoreDuplicates): a real denial must
    //    overwrite an earlier expiring 唔肯定 on the same pair, and refresh is
    //    harmless when the row was already a denial.
    //  - 唔肯定 ('unsure'): skip-with-cooldown (identity-confirm card). The row's
    //    created_at is the cooldown clock — re-answering unsure refreshes it.
    const verdictRow = notSameAsDishId
      ? { other: notSameAsDishId, verdict: 'different' as const }
      : unsureAboutDishId
        ? { other: unsureAboutDishId, verdict: 'unsure' as const }
        : null;
    if (verdictRow) {
      const admin = supabaseAdmin();
      await admin.from('dish_identity_dismissals').upsert(
        {
          user_id: user.id, dish_id: dishId, other_dish_id: verdictRow.other,
          verdict: verdictRow.verdict, created_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,dish_id,other_dish_id' },
      );
    }
    return NextResponse.json({ linked: false, verdict: verdictRow?.verdict ?? null });
  }

  const admin = supabaseAdmin();
  const { data: rows } = await admin
    .from('dishes')
    .select('id, name, name_zh, restaurant_id, dish_identity_id, user_id, source, name_edited_at')
    .in('id', [dishId, sameAsDishId]);

  const mine = (rows ?? []).find(r => r.id === dishId);
  const target = (rows ?? []).find(r => r.id === sameAsDishId);
  if (!mine || !target) return NextResponse.json({ error: 'Dish not found.' }, { status: 404 });
  if (mine.user_id !== user.id) return NextResponse.json({ error: 'Not yours.' }, { status: 403 });
  // Guard against a client sending an arbitrary dish id from another restaurant —
  // an identity is only ever meaningful within one restaurant's menu.
  if (!mine.restaurant_id || mine.restaurant_id !== target.restaurant_id) {
    return NextResponse.json({ error: 'Those dishes are not at the same restaurant.' }, { status: 400 });
  }

  // Join the target's existing identity, or mint one. Either way, the canonical name
  // is decided by AUTHORITY, not by arrival order: the restaurant's own printed menu
  // (an unedited scan) outranks a human rename, which outranks a vision guess. See
  // nameAuthority() in dishIdentity.ts.
  //
  // Note this only ever sets the IDENTITY's canonical name. Every dish row keeps its
  // own name, photo, attributes and ratings exactly as they were — nobody's dish gets
  // silently renamed under them; the shared dish just becomes known by its real name.
  let identityId = target.dish_identity_id;

  if (!identityId) {
    const { winner, authority } = preferredName(target, mine);
    const { data: created, error } = await admin
      .from('dish_identities')
      .insert({
        restaurant_id: mine.restaurant_id,
        name: winner.name,
        name_zh: winner.name_zh,
        name_authority: authority,
      })
      .select('id')
      .single();
    if (error || !created) {
      return NextResponse.json({ error: error?.message ?? 'Could not link.' }, { status: 500 });
    }
    identityId = created.id;
    await admin.from('dishes').update({ dish_identity_id: identityId }).eq('id', target.id);
  } else {
    // Joining an established identity: upgrade its canonical name only if THIS dish
    // has a strictly stronger claim (e.g. the first real menu scan of a dish the
    // group has so far only known by a photo guess). An equal or weaker claim never
    // renames a dish other diners already know by a settled name.
    const { data: ident } = await admin
      .from('dish_identities')
      .select('name, name_zh, name_authority')
      .eq('id', identityId)
      .maybeSingle();

    if (ident && nameAuthority(mine) > (ident.name_authority ?? 0)) {
      await admin
        .from('dish_identities')
        .update({ name: mine.name, name_zh: mine.name_zh, name_authority: nameAuthority(mine) })
        .eq('id', identityId);
    }
  }

  const { error: linkErr } = await admin
    .from('dishes').update({ dish_identity_id: identityId }).eq('id', mine.id);
  if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 });

  // Owner authority (see ownerMenuReconcile.ts): if the restaurant owner has
  // published a menu and this identity is EXACTLY one of their items, adopt the
  // owner's canonical name now. Exact-only + scoped to this one identity — cheap,
  // no LLM in the diner's request path. Fuzzy owner matches are resolved when the
  // owner publishes their menu, not here.
  await applyOwnerMenuAuthority(admin, mine.restaurant_id, { useLLM: false, onlyIdentityId: identityId });

  // Now that the identity's canonical name is settled, push it onto EVERY member
  // dish row so the weaker occurrence's stored name is overwritten to match — one
  // real name across the journal, exports, and aggregation, no per-row divergence.
  // (The per-row name is no longer independently editable once linked; see MyDishes.)
  const { data: identFinal } = await admin
    .from('dish_identities').select('name, name_zh').eq('id', identityId).maybeSingle();
  if (identFinal) {
    await propagateIdentityNameToDishes(admin, identityId, identFinal.name, identFinal.name_zh ?? null);
  }

  return NextResponse.json({ linked: true, identity_id: identityId });
}
