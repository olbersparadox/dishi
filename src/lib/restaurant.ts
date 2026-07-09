export type NewRestaurantInput = { name?: unknown; lat?: unknown; lng?: unknown; area?: unknown; address?: unknown };

/**
 * Resolves a restaurant reference for a dish/pick: an existing id passed straight
 * through, or a "new restaurant" payload that gets deduped against nearby restaurants
 * (same name, within ~50m) before creating a fresh row — so two people tapping the
 * same Google-sourced chip, or typing the same name at the same spot, share one
 * restaurant record instead of fragmenting its dish history across duplicates.
 *
 * Shared between /api/dishes (photo logging) and /api/dishes/pick (menu-scan/table
 * picks) so both paths dedupe identically rather than drifting into two slightly
 * different implementations over time.
 */
// Typed loosely on purpose: supabaseServer()/supabaseAdmin() return slightly
// different wrapped client types (via @supabase/ssr) that aren't worth pinning
// exactly here — both support the handful of calls this function actually makes.
export async function resolveOrCreateRestaurant(
  supabase: any,
  userId: string,
  restaurantId: string | null,
  newRestaurant: NewRestaurantInput | null,
): Promise<{ id: string | null; error?: string }> {
  if (restaurantId) return { id: restaurantId };
  if (!newRestaurant) return { id: null };

  const name = String(newRestaurant.name ?? '').trim();
  const lat = Number(newRestaurant.lat), lng = Number(newRestaurant.lng);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { id: null, error: 'A new restaurant needs a name and location.' };
  }
  // Optional, user-supplied (possibly reverse-geocode-prefilled, always editable) —
  // never required, never invented if absent.
  const area = typeof newRestaurant.area === 'string' ? newRestaurant.area.trim().slice(0, 80) || null : null;
  const address = typeof newRestaurant.address === 'string' ? newRestaurant.address.trim().slice(0, 200) || null : null;

  const { data: nearbySame } = await supabase.rpc('nearby_restaurants', {
    user_lat: lat, user_lng: lng, radius_m: 50, max_results: 8,
  });
  const existing = (nearbySame ?? []).find(
    (r: { id: string; name: string }) => r.name.trim().toLowerCase() === name.toLowerCase(),
  );
  if (existing) return { id: existing.id };

  const { data: r, error } = await supabase
    .from('restaurants')
    .insert({ name, lat, lng, area, address, created_by: userId })
    .select('id')
    .single();
  if (error) return { id: null, error: error.message };
  return { id: r.id };
}
