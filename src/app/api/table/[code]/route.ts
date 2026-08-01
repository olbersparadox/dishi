import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { rankForGroup, GroupMember } from '@/lib/group';
import { DishVector } from '@/lib/taste';
import { shapeTableMenuItems, scanCandidateKey } from '@/lib/tableMenuItems';
import { hasClaimedUsername } from '@/lib/username';
import { resolveOrCreateRestaurant } from '@/lib/restaurant';
import { viewForUser, type DiceRound } from '@/lib/tableDice';
import type { Die } from '@/lib/liarsDice';

// Total menu_items a session can ever hold — matches the cap POST /api/table's
// own initial create already uses, so appending pages can't grow a session
// unbounded (rankForGroup recomputes over the full candidate list every poll).
const MAX_MENU_ITEMS = 40;

/**
 * GET /api/table/[code]
 * Full session state: members and the group-ranked candidate list, recomputed fresh
 * on every call. The client polls this every few seconds while the session is open —
 * at a dinner table's scale (a handful of members, <=40 items) recomputing per poll
 * is far simpler than realtime channels and plenty fast.
 *
 * Privacy note: member taste vectors are read server-side (admin client) and NEVER
 * returned raw — only each member's 0-100 match per dish, which is the entire point
 * of sitting down at a shared table.
 */
export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const code = params.code.toUpperCase();
  const admin = supabaseAdmin();

  const { data: session } = await admin
    .from('table_sessions').select('*').eq('code', code).maybeSingle();
  if (!session) return NextResponse.json({ error: 'No table with that code.' }, { status: 404 });

  // Members + their profiles (cross-user read, server-side only).
  const { data: memberRows } = await admin
    .from('table_members').select('user_id, ready_at').eq('session_id', session.id);
  const memberIds = (memberRows ?? []).map(m => m.user_id);
  // "I'm done picking" rides this same poll rather than getting a channel of its
  // own — the handshake is exactly the kind of shared state the 5s poll already
  // exists to keep identical on every screen.
  const readyAtById = new Map((memberRows ?? []).map(m => [m.user_id, m.ready_at as string | null]));
  if (!memberIds.includes(user.id)) {
    return NextResponse.json({ error: 'Join this table first.' }, { status: 403 });
  }

  const [{ data: profiles }, { data: tastes }] = await Promise.all([
    // display_name kept OUT of GroupMember below (rankForGroup has no use for it,
    // and the type is the group-consensus engine's own contract) — carried
    // separately and attached only to the response members[].
    admin.from('profiles').select('id, handle, display_name, username_display, username_set_at').in('id', memberIds),
    admin.from('taste_profiles').select('user_id, vector, cuisine_affinity, rating_count').in('user_id', memberIds),
  ]);
  const tasteById = new Map((tastes ?? []).map(t => [t.user_id, t]));
  const displayNameById = new Map((profiles ?? []).map(p => [p.id, p.display_name as string | null]));
  // The as-typed casing ("Jerry"), carried alongside the canonical lowercase handle
  // so the table can show a name the way its owner wrote it. See memberName().
  const usernameDisplayById = new Map(
    (profiles ?? []).map(p => [p.id, p.username_display as string | null]));
  // Claimed-username flag, keyed the same way as the display-name map above —
  // the chop card must suppress off THIS, never off handle non-emptiness
  // (see hasClaimedUsername's own comment: every legacy profile has a handle).
  const usernameClaimedById = new Map(
    (profiles ?? []).map(p => [p.id, hasClaimedUsername(p.username_set_at as string | null)]),
  );
  const members: GroupMember[] = (profiles ?? []).map(p => {
    const t = tasteById.get(p.id);
    return {
      user_id: p.id,
      handle: p.handle ?? 'someone',
      vector: t?.vector ?? null,
      cuisine_affinity: t?.cuisine_affinity ?? {},
      rating_count: t?.rating_count ?? 0,
    };
  });

  // Candidate items: the scanned menu if the host attached one, else community dishes.
  type Candidate = {
    key: string; name: string; name_zh?: string | null; name_original?: string; price?: string | null;
    hook?: string; cuisine: string | null; attributes: DishVector; photo_url?: string | null;
    menu_item_id?: string; // present only for orderable restaurant-menu candidates
    // Stage-2 enrichment's day-0 utility fields — present on session.menu_items
    // (a real /scan share) once that dish was enriched; absent (never populated,
    // by design) on a restaurant's own typed menu or the community-dish pool.
    // DishListRow renders whatever it's given and nothing when it's missing —
    // no fabricated chips.
    diet?: string[] | null; cooking_method?: string | null; heaviness?: string | null;
    ingredients?: string[] | null;
  };
  let candidates: Candidate[] = [];
  let tableInfo: { table_label: string; restaurant_name: string } | null = null;
  if (session.table_id) {
    // QR table session: candidates are the restaurant's LIVE curated menu (available
    // items only), so 86'd dishes vanish from every diner's ranking in real time.
    const [{ data: menuItems }, { data: tableRow }] = await Promise.all([
      admin.from('restaurant_menu_items')
        .select('id, name, name_zh, name_original, description, price, cuisine, attributes')
        .eq('restaurant_id', session.restaurant_id)
        .eq('available', true)
        .order('position', { ascending: true }),
      admin.from('restaurant_tables')
        .select('label, restaurants(name)')
        .eq('id', session.table_id).maybeSingle(),
    ]);
    candidates = (menuItems ?? []).map(m => ({
      key: m.id, menu_item_id: m.id, name: m.name, name_zh: m.name_zh,
      name_original: m.name_original ?? undefined, price: m.price,
      hook: m.description ?? undefined, cuisine: m.cuisine, attributes: m.attributes,
    }));
    tableInfo = tableRow ? {
      table_label: tableRow.label,
      restaurant_name: (tableRow as any).restaurants?.name ?? 'this restaurant',
    } : null;
  } else if (session.menu_items) {
    // Keyed by name_original (scanCandidateKey), matching the scan screen's own
    // pick keys — index keys here made cross-view stamps invisible both ways.
    candidates = (session.menu_items as any[]).map((m, i) => ({
      key: scanCandidateKey(m, i), name: m.name, name_zh: m.name_zh ?? null, name_original: m.name_original, price: m.price,
      hook: m.hook, cuisine: m.cuisine, attributes: m.attributes, photo_url: null,
      diet: m.diet ?? [], cooking_method: m.cooking_method ?? null, heaviness: m.heaviness ?? null,
      ingredients: m.ingredients ?? [],
    }));
  } else {
    const { data: dishes } = await admin
      .from('dishes').select('id, name, name_zh, cuisine, photo_url, attributes')
      .order('created_at', { ascending: false }).limit(100);
    candidates = (dishes ?? []).map(d => ({
      key: d.id, name: d.name, name_zh: d.name_zh, cuisine: d.cuisine, attributes: d.attributes, photo_url: d.photo_url,
    }));
  }

  // A real restaurant menu must never be truncated — diners need every option.
  // The 15-cap only applies to the open-ended community pool.
  //
  // This tested `session.table_id`, which is set ONLY for QR/registered tables — so
  // every SCAN-SHARED session (table_id null, menu_items set) was silently cut to
  // its top 15 despite having a real menu, contradicting the line above. Found by a
  // two-account test of "add a page" (owner, 2026-07-30): the joiner never saw the
  // appended dishes, because the enlarged menu still returned 15 ranked candidates
  // and the new page mostly ranked below the cut. Re-joining showed 15 items mixed
  // from both scans, which is the same truncation seen from the other end. The
  // scanner saw everything throughout because /scan renders its own local scan
  // result, not the session — so the cap was invisible from the host's side.
  const isCommunityPool = !session.table_id && !session.menu_items;
  const ranked = isCommunityPool
    ? rankForGroup(candidates, members).slice(0, 15)
    : rankForGroup(candidates, members);

  // The session's own restaurant, by name — what the table bar's restaurant line
  // displays. Separate from `tableInfo` above, which only exists for QR/registered
  // table sessions; a scan-shared session has a restaurant too now (resolved at
  // create, correctable from that line) and had no way to show it.
  let restaurant: { id: string; name: string; name_zh: string | null } | null = null;
  if (session.restaurant_id) {
    const { data: r } = await admin
      .from('restaurants').select('id, name, name_zh').eq('id', session.restaurant_id).maybeSingle();
    restaurant = r ?? null;
  }

  const { data: tablePicks } = await admin
    .from('dishes')
    // dish_identities join: a pick that's been renamed or linked to a canonical
    // identity still matches the menu's printed name via these alias names —
    // name-only matching fragments the moment 蝦餃 gets linked to 水晶鮮蝦餃.
    // user_id + display_name: item 3 (realtime pick stamps) needs a stable id to
    // seed each picker's chop from, and their own chosen name over the auto-handle.
    // table_item_key: exact disambiguation when candidates share a printed name —
    // see dishes.table_item_key's migration comment. id: so a client can find its
    // OWN pick's row to DELETE on unpick without caching one locally (2026-07-21 —
    // "picked" must be exactly "my stamp is present," never a separate local flag).
    .select('id, user_id, name, name_zh, table_item_key, profiles(handle, display_name, username_display), dish_identities(name, name_zh)')
    .eq('table_session_id', session.id)
    .order('created_at', { ascending: false });

  // 大話骰 rides this same poll, the way readiness does — the turn engine is the
  // 5s cycle plus the realtime nudge, not a second transport. Only loaded once a
  // table has actually started a game, so an ordinary table pays nothing for it.
  // viewForUser is the ONE gate on the dice: it hands this caller their own five
  // and, until 開, nobody else's (see tableDice.ts).
  let game = null;
  if (session.pay_method === 'game') {
    const { data: roundRow } = await admin
      .from('table_dice_rounds').select('*')
      .eq('session_id', session.id).order('round', { ascending: false }).limit(1).maybeSingle();
    if (roundRow) {
      const { data: rollRows } = await admin
        .from('table_dice_rolls').select('user_id, dice').eq('round_id', roundRow.id);
      const rolls = Object.fromEntries(
        (rollRows ?? []).map(r => [r.user_id as string, (r.dice ?? []) as Die[]]));
      game = viewForUser(roundRow as DiceRound, rolls, user.id);
    }
  }

  return NextResponse.json({
    code,
    session_id: session.id,
    restaurant_id: session.restaurant_id ?? null,
    restaurant,
    status: session.status,
    is_host: session.host_id === user.id,
    has_menu: !!session.menu_items || !!session.table_id,
    orderable: !!session.table_id,
    table: tableInfo,
    // Own user id — so the client can pick itself out of members[] (a chop's
    // one-time setup prompt only ever targets the viewer's own row) without
    // relying on handle/display_name matching, which isn't guaranteed unique.
    you: user.id,
    members: members.map(m => ({
      user_id: m.user_id,
      handle: m.handle,
      display_name: displayNameById.get(m.user_id) ?? null,
      username_display: usernameDisplayById.get(m.user_id) ?? null,
      username_claimed: usernameClaimedById.get(m.user_id) ?? false,
      has_profile: !!m.vector && m.rating_count > 0,
      rating_count: m.rating_count,
      ready_at: readyAtById.get(m.user_id) ?? null,
    })),
    // The settle phase. settled_at is STICKY: once the last member has tapped,
    // a late joiner (or someone un-tapping) can never pull the table back into
    // picking — the bill has already been put on screen for everyone.
    settled_at: session.settled_at ?? null,
    pay_method: session.pay_method ?? null,
    pay_payer_id: session.pay_payer_id ?? null,
    // Which draw this is. Shared state on purpose: the reveal line under the chops
    // is chosen by it, so every phone at the table reads the same remark rather
    // than each counting its own taps.
    pay_draw_count: session.pay_draw_count ?? 0,
    game,
    // Visible to everyone at the table: what's been picked so far, and by whom —
    // shared awareness, not a shared cart. Each pick is still an individual dish
    // row the picker rates on their own.
    table_picks: (tablePicks ?? []).map((p: any) => ({
      id: p.id,
      user_id: p.user_id,
      name: p.name, name_zh: p.name_zh, handle: p.profiles?.handle ?? 'someone',
      display_name: p.profiles?.display_name ?? null,
      username_display: p.profiles?.username_display ?? null,
      identity_name: p.dish_identities?.name ?? null,
      identity_name_zh: p.dish_identities?.name_zh ?? null,
      table_item_key: p.table_item_key ?? null,
    })),
    items: ranked.map(r => ({
      ...r.item,
      // Table candidates are always fully resolved server-side — there's no
      // streaming/scoring wait the way a live scan has — so DishListRow should
      // never show its shimmer placeholder here, only real chips or none.
      enriched: true,
      group_match: r.group_match,
      member_matches: r.member_matches,
      unanimous: r.unanimous,
      protected_by_fairness: r.protected_by_fairness,
    })),
  });
}

/**
 * PATCH /api/table/[code]
 * body: { items: [...] } — an appended scan page's dishes (already Stage-2
 * enriched on the client, same shape POST /api/table accepts). Previously an
 * appended page only ever extended the SCANNER's own local view, never the
 * group's shared table (see docs/BACKLOG.md) — this is the write path that
 * closes that gap.
 * body: { reauthor: [...] } — the same item shape, but updating dishes the
 * session ALREADY holds: the scanner's post-creation passes (kana/hangul
 * namefix translation, enrichment, scoring) re-author their local items, and
 * without this the shared session kept the raw creation-time snapshot forever
 * — a joiner at a Japanese restaurant saw untranslated Japanese all meal
 * (two-account field test, 2026-07-24). Joiners seeing names update
 * mid-session as these passes land is the accepted, desired behavior.
 *
 * Any member, not just the host (Table Mode item 6, 2026-07-22, owner
 * decision): someone else at the table is often the one holding the drinks
 * menu or page 3 of a multi-page one — checks membership (a `table_members`
 * row for this session), not `host_id`. Trust model is deliberately open:
 * the append itself is race-safe (see below) and the Postgres function now
 * dedupes an incoming item against what's already on the shared menu, so an
 * overlapping photo from a second contributor can't duplicate a dish.
 *
 * Both verbs run via Postgres functions (append_table_menu_items /
 * reauthor_table_menu_items — see their migration comments), never a client
 * read-modify-write: the row is locked for the duration, so overlapping
 * writes to the same session serialize instead of silently clobbering each
 * other. Append can only add; reauthor can only update derived fields on
 * existing entries matched by name_original — neither can remove or reorder,
 * by construction, so an existing pick's table_item_key (name_original — see
 * scanCandidateKey) can never be invalidated out from under it.
 */
export async function PATCH(req: NextRequest, { params }: { params: { code: string } }) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const code = params.code.toUpperCase();
  const admin = supabaseAdmin();

  const { data: session } = await admin
    .from('table_sessions').select('id, menu_items, restaurant_id, table_id').eq('code', code).maybeSingle();
  if (!session) return NextResponse.json({ error: 'No table with that code.' }, { status: 404 });

  const { data: memberRow } = await admin
    .from('table_members').select('user_id').eq('session_id', session.id).eq('user_id', user.id).maybeSingle();
  if (!memberRow) {
    return NextResponse.json({ error: 'Join this table first.' }, { status: 403 });
  }

  const body0 = await req.clone().json().catch(() => null);

  /**
   * body: { restaurant: RestaurantChoice } — correct (or set) which restaurant this
   * table is at. The session's restaurant is resolved automatically at create, but
   * only when the answer was unambiguous (see tableRestaurant.ts) — this is the
   * one-tap path for everything else, and the correction path when the guess was
   * wrong.
   *
   * Any member, matching PATCH's existing open trust model above: whoever notices
   * the wrong shop name is whoever should be able to fix it.
   *
   * Re-attributes the picks ALREADY made, not just future ones — a correction that
   * left the existing rows wrong would be a worse trap than the blank it replaced,
   * since nobody would think to go looking. Scoped to rows still carrying the
   * session's PREVIOUS value (or null), so a deliberate per-dish restaurant edit
   * someone made by hand is never stomped by a table-level correction.
   */
  if (body0 && 'restaurant' in body0) {
    if (session.table_id) {
      // A QR session belongs to the restaurant whose table it is; that isn't a
      // diner's to reassign.
      return NextResponse.json({ error: "This table's restaurant is set by the restaurant itself." }, { status: 400 });
    }
    const choice = body0.restaurant;
    let nextId: string | null = null;
    if (choice && choice.kind === 'existing' && typeof choice.id === 'string') {
      nextId = choice.id;
    } else if (choice && choice.kind === 'new') {
      const resolved = await resolveOrCreateRestaurant(supabase, user.id, null, choice);
      if (resolved.error) return NextResponse.json({ error: resolved.error }, { status: 400 });
      nextId = resolved.id;
    }
    // choice null / {kind:'home'} clears it: "not a restaurant" is a real answer
    // (equal-weight logging — home cooking counts the same), not a failed pick.

    const previousId = session.restaurant_id ?? null;
    const { error: upErr } = await admin
      .from('table_sessions').update({ restaurant_id: nextId }).eq('id', session.id);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    let reattributed = 0;
    const scoped = admin.from('dishes').update({ restaurant_id: nextId }).eq('table_session_id', session.id);
    const { data: touched, error: dishErr } = previousId
      ? await scoped.eq('restaurant_id', previousId).select('id')
      : await scoped.is('restaurant_id', null).select('id');
    if (dishErr) console.error('table restaurant: re-attribution failed', dishErr);
    else reattributed = touched?.length ?? 0;

    return NextResponse.json({ restaurant_id: nextId, reattributed });
  }

  if (!session.menu_items) {
    // A QR/restaurant session or the bare community-pool fallback has no scanned
    // menu_items array to append to (or re-author) — both verbs are only
    // meaningful for a scan-shared session.
    return NextResponse.json({ error: 'This table has no scanned menu to add pages to.' }, { status: 400 });
  }

  const body = body0;

  const reauthor = Array.isArray(body?.reauthor) ? body.reauthor : null;
  if (reauthor) {
    const shaped = shapeTableMenuItems(reauthor, reauthor.length); // update-only: the RPC ignores anything not already on the menu
    if (shaped.length === 0) {
      return NextResponse.json({ error: 'No dishes to update.' }, { status: 400 });
    }
    const { data: menuItems, error } = await admin.rpc('reauthor_table_menu_items', {
      p_session_id: session.id, p_items: shaped,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ menu_item_count: Array.isArray(menuItems) ? menuItems.length : null });
  }

  const items = Array.isArray(body?.items) ? body.items : [];
  const shaped = shapeTableMenuItems(items, items.length); // no local cap here — the RPC enforces the TOTAL cap atomically
  if (shaped.length === 0) {
    return NextResponse.json({ error: 'No dishes to add.' }, { status: 400 });
  }

  const { data: menuItems, error } = await admin.rpc('append_table_menu_items', {
    p_session_id: session.id, p_items: shaped, p_max_total: MAX_MENU_ITEMS,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ menu_item_count: Array.isArray(menuItems) ? menuItems.length : null });
}
