import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { inferDish } from '@/lib/vision';
import { resolveOrCreateRestaurant } from '@/lib/restaurant';

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
 * multipart/form-data: photo (file), restaurant_id? (uuid), new_restaurant? (JSON {name, lat, lng})
 * Uploads the photo, runs vision inference, creates the dish row.
 * Returns the dish including its inferred name + attributes so the client can show
 * a one-tap confirm chip ("Tonkotsu ramen? ✓ / ✗") before rating.
 */
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to log dishes.' }, { status: 401 });

  const form = await req.formData();
  const photo = form.get('photo') as File | null;
  if (!photo) return NextResponse.json({ error: 'A photo is required.' }, { status: 400 });

  // Resolve restaurant: existing id, or create one from the quick-pick "add" path.
  let restaurantId = (form.get('restaurant_id') as string) || null;
  const newRestaurantRaw = form.get('new_restaurant') as string | null;
  if (!restaurantId && newRestaurantRaw) {
    let parsed: { name?: unknown; lat?: unknown; lng?: unknown; area?: unknown; address?: unknown };
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
    })
    .select()
    .single();
  if (dishErr) return NextResponse.json({ error: dishErr.message }, { status: 500 });

  return NextResponse.json({ dish });
}
