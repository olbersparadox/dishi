import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { inferDish } from '@/lib/vision';
import { resolveOrCreateRestaurant } from '@/lib/restaurant';
import { scoreOneDish, enrichOneDish } from '@/lib/menuScan';
import { translateDishName, inferCuisineFromName } from '@/lib/translate';

export const maxDuration = 60;

// Vision API accepts exactly these; anything else (or a missing type from a quirky
// mobile browser) is coerced to jpeg — the client normalizes to JPEG anyway, so this
// is the server-side backstop, not the primary path.
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
function safeMediaType(t: string | undefined | null): string {
  return t && ALLOWED_IMAGE_TYPES.has(t) ? t : 'image/jpeg';
}

/**
 * POST /api/dishes
 *
 * TWO ways in, both producing the same kind of dish row:
 *  - multipart/form-data with a photo -> vision identifies it (the original path).
 *  - application/json { name, name_zh?, restaurant_id?, new_restaurant? } -> no photo,
 *    the person just types what they ate. Cuisine/attributes/cooking-info are
 *    inferred from the NAME using the exact same text-only path menu-scan picks and
 *    the rename cascade already use.
 *
 * A photo is genuinely optional, not a degraded mode. A dish rated without one
 * teaches the taste engine exactly as much as a photographed one (the engine learns
 * from ATTRIBUTES, and a name yields real attributes) — the photo adds preparation
 * detail and something to look at, not the learning itself. Menu picks have always
 * worked this way; there was simply no way to start a no-photo dish by hand.
 *
 * Returns the dish including its inferred name + attributes so the client can show
 * a one-tap confirm chip ("Tonkotsu ramen? ✓ / ✗") before rating.
 */
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to log dishes.' }, { status: 401 });

  const isJson = (req.headers.get('content-type') ?? '').includes('application/json');
  if (isJson) return createFromName(req, supabase, user.id);

  const form = await req.formData();
  const photo = form.get('photo') as File | null;
  if (!photo) return NextResponse.json({ error: 'A photo is required.' }, { status: 400 });

  // Entry context the user chose on the Taste tab (餐廳菜/屋企煮/相簿舊相).
  // Whitelisted — 'scan'/'table' are reserved for their own pipelines and can't
  // be claimed by this endpoint.
  const rawSource = (form.get('source') as string) || '';
  const source = ['photo', 'home', 'album'].includes(rawSource) ? rawSource : 'photo';

  // Resolve restaurant: existing id, or create one from the quick-pick "add" path.
  let restaurantId = (form.get('restaurant_id') as string) || null;
  const newRestaurantRaw = form.get('new_restaurant') as string | null;
  if (!restaurantId && newRestaurantRaw) {
    let parsed: import('@/lib/restaurant').NewRestaurantInput;
    try {
      parsed = JSON.parse(newRestaurantRaw);
    } catch {
      return NextResponse.json({ error: 'Malformed restaurant data.' }, { status: 400 });
    }
    const resolved = await resolveOrCreateRestaurant(supabase, user.id, null, parsed);
    if (resolved.error) return NextResponse.json({ error: resolved.error }, { status: 400 });
    restaurantId = resolved.id;
  }

  const bytes = Buffer.from(await photo.arrayBuffer());
  const mediaType = safeMediaType(photo.type);
  const path = `${user.id}/${Date.now()}-${(photo.name || 'photo.jpg').replace(/[^\w.\-]/g, '_')}`;

  // Storage upload and vision inference only need the bytes — run them in PARALLEL.
  // They were sequential before, which added the full storage round-trip to every
  // log's wait time for no reason.
  const [{ error: upErr }, vision] = await Promise.all([
    supabase.storage.from('dish-photos').upload(path, bytes, { contentType: mediaType }),
    inferDish(bytes.toString('base64'), mediaType),
  ]);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  const { data: pub } = supabase.storage.from('dish-photos').getPublicUrl(path);

  const { data: dish, error: dishErr } = await supabase
    .from('dishes')
    .insert({
      user_id: user.id,
      restaurant_id: restaurantId,
      name: vision.name,
      name_zh: vision.name_zh,
      cuisine: vision.cuisine,
      photo_url: pub.publicUrl,
      attributes: vision.attributes,
      vision_confidence: vision.confidence,
      cooking_method: vision.cooking_method,
      heaviness: vision.heaviness,
      diet: vision.diet,
      source,
    })
    .select()
    .single();
  if (dishErr) return NextResponse.json({ error: dishErr.message }, { status: 500 });

  return NextResponse.json({ dish: { ...dish, is_dish: vision.is_dish, vision_failed: vision.vision_failed ?? false } });
}

/**
 * No-photo path: the person types what they ate. Everything the taste engine needs
 * comes from the name — the same text-only inference used when a menu-scan pick is
 * created and when a rename invalidates a dish's old vision bundle. Runs the three
 * inferences in parallel; each fails soft, because a dish with a name is already
 * good enough to rate, and a missing cooking-style chip is far better than blocking
 * someone from logging their dinner.
 */
async function createFromName(req: NextRequest, supabase: any, userId: string) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 120) : '';
  const nameZh = typeof body?.name_zh === 'string' ? body.name_zh.trim().slice(0, 120) : '';
  if (!name && !nameZh) {
    return NextResponse.json({ error: 'Tell us what you ate.' }, { status: 400 });
  }

  let restaurantId: string | null = typeof body?.restaurant_id === 'string' ? body.restaurant_id : null;
  if (!restaurantId && body?.new_restaurant) {
    const resolved = await resolveOrCreateRestaurant(supabase, userId, null, body.new_restaurant);
    if (resolved.error) return NextResponse.json({ error: resolved.error }, { status: 400 });
    restaurantId = resolved.id;
  }

  // Whichever language was given is what we reason from; the other is filled by the
  // same translation path the rename flow uses, so a Chinese-only entry still ends
  // up with both names rather than a permanently half-filled row.
  const seed = name || nameZh;
  const cuisine = (await inferCuisineFromName(seed).catch(() => null)) ?? 'unknown';
  const [attributes, enrichment, translated] = await Promise.all([
    scoreOneDish({ name: seed, cuisine }).catch(() => ({})),
    enrichOneDish({ name: seed, name_zh: nameZh || null, cuisine }).catch(() => null),
    (name && !nameZh ? translateDishName(name) : !name && nameZh ? translateDishName(nameZh) : Promise.resolve(null))
      .catch(() => null),
  ]);

  const { data: dish, error } = await supabase
    .from('dishes')
    .insert({
      user_id: userId,
      restaurant_id: restaurantId,
      name: name || translated || nameZh,
      name_zh: nameZh || (name ? translated : null),
      cuisine,
      photo_url: null,
      attributes,
      // Typed by a human, so the name carries human authority from birth — it was
      // never a machine guess to be demoted from. See nameAuthority() in
      // dishIdentity.ts.
      name_edited_at: new Date().toISOString(),
      cooking_method: enrichment?.cooking_method ?? null,
      heaviness: enrichment?.heaviness ?? null,
      diet: enrichment?.diet ?? [],
      // 'home' when the person entered via the 屋企煮 path and typed the dish;
      // plain typed entries stay 'manual'. (Note: 'manual' was silently violating
      // the old check constraint — every no-photo log failed until the
      // dishes_source_expand_check migration widened it.)
      source: body?.source === 'home' ? 'home' : 'manual',
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // is_dish is meaningless here — the person told us what it is, so there's no
  // vision guess to second-guess. Always a real dish.
  return NextResponse.json({ dish: { ...dish, is_dish: true } });
}
