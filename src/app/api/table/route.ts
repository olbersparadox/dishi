import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { generateTableCode } from '@/lib/group';
import { shapeTableMenuItems } from '@/lib/tableMenuItems';
import { resolveSessionRestaurant } from '@/lib/tableRestaurantResolve';

/**
 * POST /api/table
 * application/json: { items: [...] } — a menu ALREADY scanned by /scan. Reuses
 * those exact items rather than re-scanning the same photo a second time through
 * a different pipeline, which could plausibly read a different set of dishes
 * than the ones already on screen. This is how Scan's "share with friends"
 * action turns an already-in-progress solo scan into a table session.
 *
 * (The standalone Table page used to also accept a multipart/form-data photo
 * upload here, scanning it itself with no Stage-2 enrichment — that page and
 * its front door were removed 2026-07-21, starting a table now only ever
 * happens from a scan, so that path is gone too.)
 *
 * Creates a table session and auto-joins the host. With menu items, those
 * become the candidate set; with none, the session ranks the community dish
 * pool instead (still fun, less situational). Returns the join code and
 * session id (the latter needed to attach picks to this session).
 */
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to start a table.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const items = Array.isArray(body?.items) ? body.items : [];
  const menuItems = shapeTableMenuItems(items);
  if (menuItems.length === 0) {
    return NextResponse.json({ error: 'No scanned dishes to share.' }, { status: 400 });
  }

  // The session's restaurant, decided once, here — so every member's picks
  // inherit ONE attribution (see /api/dishes/pick, which reads it back
  // server-side). Before this, a scan-shared session never had a restaurant at
  // all and joiners' picks all wrote null (found live 2026-07-30).
  //
  // Silent by design: the scanner is standing in the restaurant holding its
  // menu, and asking them to name it before anyone can even look at the dishes
  // gets the common case wrong — the same reasoning that made the table code
  // itself automatic (see scan/page.tsx's createTableSession). But silence only
  // extends as far as certainty does: the gate in tableRestaurant.ts refuses to
  // guess between neighbours it can't separate, and a `verdict` of anything but
  // `confident` leaves restaurant_id null for the table bar's restaurant line to
  // resolve with one tap. Never fails the session — a table with no restaurant
  // yet is fully usable, and a wrong guess would be worse than a blank.
  const lat = Number(body?.lat), lng = Number(body?.lng);
  // The menu's printed name, read by the scan (restaurant_guess). Length-capped
  // because it goes into name comparisons, not because anything downstream
  // stores it — it is used for this one decision and dropped.
  const printedName = typeof body?.restaurant_guess === 'string'
    ? body.restaurant_guess.trim().slice(0, 120) || null
    : null;
  let restaurantId: string | null = null;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    try {
      const resolved = await resolveSessionRestaurant(
        supabase, user.id, lat, lng, body?.lang === 'en' ? 'en' : 'zh-HK', printedName,
      );
      restaurantId = resolved.restaurantId;
    } catch (e) {
      console.error('table restaurant: auto-attribution failed', e);
    }
  }

  // Generate a code, retrying on the (rare) collision.
  let session = null;
  for (let attempt = 0; attempt < 5 && !session; attempt++) {
    const code = generateTableCode();
    const { data, error } = await supabase
      .from('table_sessions')
      .insert({ code, host_id: user.id, menu_items: menuItems, restaurant_id: restaurantId })
      .select()
      .single();
    if (!error) session = data;
    else if (error.code !== '23505') { // 23505 = unique violation -> code collision, retry
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  if (!session) return NextResponse.json({ error: 'Could not create a session. Try again.' }, { status: 500 });

  await supabase.from('table_members').insert({ session_id: session.id, user_id: user.id });

  return NextResponse.json({ code: session.code, session_id: session.id });
}
