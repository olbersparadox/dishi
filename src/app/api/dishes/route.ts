import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { inferDish } from '@/lib/vision';

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
    let parsed: { name?: unknown; lat?: unknown; lng?: unknown };
    try {
      parsed = JSON.parse(newRestaurantRaw);
    } catch {
      return NextResponse.json({ error: 'Malformed restaurant data.' }, { status: 400 });
    }
    const name = String(parsed.name ?? '').trim();
    const lat = Number(parsed.lat), lng = Number(parsed.lng);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: 'A new restaurant needs a name and location.' }, { status: 400 });
    }

    // Dedupe before creating: when two people tap the same Google-sourced chip (or
    // type the same name at the same spot), reuse the existing entity instead of
    // fragmenting the restaurant's dish history across duplicates. "Same place" =
    // same name (case-insensitive) within ~50m.
    const { data: nearbySame } = await supabase.rpc('nearby_restaurants', {
      user_lat: lat, user_lng: lng, radius_m: 50, max_results: 8,
    });
    const existing = (nearbySame ?? []).find(
      (r: { id: string; name: string }) => r.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      restaurantId = existing.id;
    } else {
      const { data: r, error } = await supabase
        .from('restaurants')
        .insert({ name, lat, lng, created_by: user.id })
        .select('id')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      restaurantId = r.id;
    }
  }

  // Upload photo to storage.
  const bytes = Buffer.from(await photo.arrayBuffer());
  const mediaType = safeMediaType(photo.type);
  const path = `${user.id}/${Date.now()}-${(photo.name || 'photo.jpg').replace(/[^\w.\-]/g, '_')}`;
  const { error: upErr } = await supabase.storage.from('dish-photos').upload(path, bytes, { contentType: mediaType });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  const { data: pub } = supabase.storage.from('dish-photos').getPublicUrl(path);

  // Vision inference (mocked if no API key).
  const vision = await inferDish(bytes.toString('base64'), mediaType);

  const { data: dish, error: dishErr } = await supabase
    .from('dishes')
    .insert({
      user_id: user.id,
      restaurant_id: restaurantId,
      name: vision.name,
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
