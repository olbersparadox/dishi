import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { resolveOrCreateRestaurant } from '@/lib/restaurant';
import { sanitizeDietFlags, sanitizeCookingMethod, sanitizeHeaviness } from '@/lib/menuScan';

/**
 * POST /api/dishes/pick
 * body: { restaurant_id?: string, new_restaurant?: {name,lat,lng,area?,address?},
 *         table_session_id?: string, items: [{ name, name_zh?, cuisine?, attributes? }] }
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
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .slice(0, 30); // sane upper bound — this is a batch pick, not a data import

  if (rows.length === 0) return NextResponse.json({ error: 'None of those dishes had a usable name.' }, { status: 400 });

  const { data, error } = await supabase.from('dishes').insert(rows).select('id, name, name_zh');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ picked: data });
}
