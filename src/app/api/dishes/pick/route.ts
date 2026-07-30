import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { resolveOrCreateRestaurant } from '@/lib/restaurant';
import { buildPickRows } from '@/lib/pickRows';
import { edgeRowsForPick } from '@/lib/companions';

/**
 * POST /api/dishes/pick
 * body: { restaurant_id?: string, new_restaurant?: {name,lat,lng,area?,address?},
 *         table_session_id?: string,
 *         items: [{ name, name_zh?, cuisine?, attributes?, table_item_key? }] }
 *
 * Creates one dish row per item — no photo, no rating yet — using the SAME `dishes`
 * table real photo-logged dishes live in. This is deliberate: a "pick" made off a
 * scanned menu or during a Table Mode session should rate, delete, and feed the
 * taste engine through the EXACT same pipeline as a photographed dish, not a
 * parallel system. `source` just records how the row was born; `attributes` come
 * straight from the menu scan's own scoring step, so nothing is re-inferred.
 *
 * Each item independently trusted-but-verified: a malformed entry in the batch is
 * skipped, not allowed to fail the whole request.
 */
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const items: unknown[] = Array.isArray(body?.items) ? body.items : [];
  if (items.length === 0) return NextResponse.json({ error: 'No dishes to pick.' }, { status: 400 });

  let restaurantId: string | null = typeof body?.restaurant_id === 'string' ? body.restaurant_id : null;
  if (!restaurantId && body?.new_restaurant) {
    const resolved = await resolveOrCreateRestaurant(supabase, user.id, null, body.new_restaurant);
    if (resolved.error) return NextResponse.json({ error: resolved.error }, { status: 400 });
    restaurantId = resolved.id;
  }

  const tableSessionId = typeof body?.table_session_id === 'string' ? body.table_session_id : null;

  // A table session's restaurant is decided ONCE, at session level, and every
  // member's pick inherits it — the session WINS over whatever the client sent.
  //
  // This is the fix for a silent data-loss bug found live 2026-07-30: nothing on
  // the /table side ever had a restaurant to send (POST /api/table never set
  // restaurant_id), so every dish a joiner picked was written with
  // restaurant_id null while the scanner's own confirm sheet quietly captured
  // one. Two members at ONE table were producing differently-attributed rows.
  // Reading it server-side makes that structurally impossible rather than
  // relying on every client to pass the right thing: restaurant x dish is the
  // demand data this product is built on, so it cannot be the client's job.
  // Deliberately admin: the session row is readable by any member, and
  // membership is already what /api/table/[code] gates on.
  //
  // Fetched IN PARALLEL with the member list the companion-edge write below
  // needs, and both BEFORE the insert. A pick is a tap on a dish and it has to
  // feel like one, so nothing that isn't the insert itself gets to sit on the
  // response path in series: this turned four sequential round trips (auth ->
  // session -> insert -> members -> edges) into two, without making any write
  // fire-and-forget. Fire-and-forget was the obvious alternative and is
  // specifically wrong here — a serverless function can be frozen the moment it
  // responds, and "the write path never seems to run" is this repo's documented
  // failure class.
  const [sessionRow, memberRows] = tableSessionId
    ? await Promise.all([
        supabaseAdmin().from('table_sessions').select('restaurant_id').eq('id', tableSessionId).maybeSingle(),
        supabaseAdmin().from('table_members').select('user_id').eq('session_id', tableSessionId),
      ])
    : [null, null];
  const sessionRestaurantId: string | null = sessionRow?.data?.restaurant_id ?? null;

  // Row construction extracted to pickRows.ts (pure) so the eaten_at rule —
  // pick time IS the eaten time — is unit-tested, not just asserted here.
  const rows = buildPickRows(items, {
    userId: user.id,
    restaurantId: sessionRestaurantId ?? restaurantId,
    tableSessionId,
  });

  if (rows.length === 0) return NextResponse.json({ error: 'None of those dishes had a usable name.' }, { status: 400 });

  const { data, error } = await supabase.from('dishes').insert(rows).select('id, name, name_zh');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 同檯 companion edges (Table Mode item 4): a pick during a table session
  // links every consenting member pair present, per dish — the "who you ate
  // with" layer 食記 and the AI export read. Admin client on purpose:
  // companion_edges has NO client write policies (RLS proof in its migration
  // file); writes happen only here and in /api/table/join's backfill.
  // Best-effort with a logged failure — a missing edge must never fail the
  // pick itself, but a silently-dead write path is this repo's known failure
  // class, so it must at least leave a trace in the server logs.
  if (tableSessionId && data && data.length > 0) {
    try {
      const admin = supabaseAdmin();
      const edgeRows = edgeRowsForPick(
        (memberRows?.data ?? []).map(m => m.user_id),
        data.map(d => d.id),
        tableSessionId,
      );
      if (edgeRows.length > 0) {
        // upsert + ignoreDuplicates: a re-pick of the same dish key or an
        // overlapping join-backfill lands on the unique (dish, pair) index
        // and no-ops instead of erroring.
        const { error: edgeError } = await admin
          .from('companion_edges')
          .upsert(edgeRows, { onConflict: 'dish_id,user_a,user_b', ignoreDuplicates: true });
        if (edgeError) console.error('companion edges (pick) failed', edgeError);
      }
    } catch (e) {
      console.error('companion edges (pick) failed', e);
    }
  }

  return NextResponse.json({ picked: data });
}
