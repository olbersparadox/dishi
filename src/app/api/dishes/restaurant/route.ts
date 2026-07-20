import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { resolveOrCreateRestaurant } from '@/lib/restaurant';

/**
 * POST /api/dishes/restaurant
 * JSON: { dish_id, restaurant_id? | new_restaurant? | clear? }
 *
 * Sets (or clears) a logged dish's restaurant AFTER creation. The album rating flow
 * creates the dish first (fast, from the photo), then tags WHERE it was eaten once the
 * person confirms the EXIF-seeded nearby pick — or clears it for 住家菜 / 略過.
 *
 *  - restaurant_id → an existing Dishi restaurant (a "dishi" nearby chip).
 *  - new_restaurant → a Google chip (or manual add): resolved/created the same way
 *    POST /api/dishes does, so the same real-world place stays one record.
 *  - clear → home-cooked or skipped: restaurant_id set to null.
 *
 * Owning-user only: the update is scoped to the caller's own dish (RLS + explicit
 * user_id guard), so it can't retag someone else's row.
 */
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const dishId = typeof body?.dish_id === 'string' ? body.dish_id : null;
  if (!dishId) return NextResponse.json({ error: 'dish_id is required.' }, { status: 400 });

  let restaurantId: string | null = null;
  if (!body?.clear) {
    if (typeof body?.restaurant_id === 'string') {
      restaurantId = body.restaurant_id;
    } else if (body?.new_restaurant) {
      // Same resolution path as POST /api/dishes — dedups to an existing record when
      // it's really the same place, else creates one.
      const resolved = await resolveOrCreateRestaurant(supabase, user.id, null, body.new_restaurant);
      if (resolved.error) return NextResponse.json({ error: resolved.error }, { status: 400 });
      restaurantId = resolved.id;
    }
  }

  const { data, error } = await supabase
    .from('dishes')
    .update({ restaurant_id: restaurantId })
    .eq('id', dishId)
    .eq('user_id', user.id)
    .select('id, restaurant_id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Dish not found.' }, { status: 404 });
  return NextResponse.json({ ok: true, restaurant_id: data.restaurant_id });
}
