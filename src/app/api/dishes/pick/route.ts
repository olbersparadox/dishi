import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { resolveOrCreateRestaurant } from '@/lib/restaurant';
import { sanitizeDietFlags, sanitizeCookingMethod, sanitizeHeaviness } from '@/lib/menuScan';
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
  const source = tableSessionId ? 'table' : 'scan';

  const rows = items
    .map((raw: any) => {
      const name = typeof raw?.name === 'string' ? raw.name.trim().slice(0, 120) : '';
      if (!name) return null;
      return {
        user_id: user.id,
        restaurant_id: restaurantId,
        table_session_id: tableSessionId,
        name,
        name_zh: typeof raw?.name_zh === 'string' ? raw.name_zh.trim().slice(0, 120) || null : null,
        cuisine: typeof raw?.cuisine === 'string' ? raw.cuisine.toLowerCase().slice(0, 40) : 'unknown',
        attributes: raw?.attributes && typeof raw.attributes === 'object' ? raw.attributes : {},
        // Re-sanitized, not trusted verbatim — the client echoes back what the scan
        // showed on screen, but it's still client input, and these are closed
        // vocabularies exactly like `cuisine` above should be too.
        cooking_method: sanitizeCookingMethod(raw?.cooking_method),
        heaviness: sanitizeHeaviness(raw?.heaviness),
        diet: sanitizeDietFlags(raw?.diet),
        photo_url: null,
        source,
        // Which ranked candidate this came from — lets table-mode "who picked
        // this" stamps match unambiguously when two candidates share a printed
        // name (see dishes.table_item_key's migration comment).
        table_item_key: typeof raw?.table_item_key === 'string' ? raw.table_item_key.slice(0, 60) : null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .slice(0, 30); // sane upper bound — this is a batch pick, not a data import

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
      const { data: members } = await admin
        .from('table_members').select('user_id').eq('session_id', tableSessionId);
      const edgeRows = edgeRowsForPick(
        (members ?? []).map(m => m.user_id),
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
