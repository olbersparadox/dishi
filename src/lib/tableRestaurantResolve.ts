// Server-side half of table-session restaurant attribution: gather the nearby
// candidates, run them past the pure confidence gate in tableRestaurant.ts, and
// adopt the winner as a real restaurant row.
//
// Kept OUT of tableRestaurant.ts on purpose — that file is pure (its only
// imports are the pure name matchers), so its unit test needs no Supabase
// client, no Places key, and no env at all. Everything that needs the network
// lives here.
import { cachedNearbyPlaces } from './placesCache';
import { haversineMeters } from './places';
import { resolveOrCreateRestaurant } from './restaurant';
import { decideSessionRestaurant, NearbyCandidate, RestaurantVerdict, AUTO_RADIUS_M } from './tableRestaurant';

/**
 * The same two-source merge the picker's chip row already shows (see
 * /api/restaurants/nearby), but distance-complete: Google Nearby Search returns
 * prominence order and no distance, and the confidence gate drops anything it
 * can't measure, so the distance is computed here rather than left null.
 *
 * A Places failure degrades to Dishi's own rows instead of throwing — the same
 * rule the nearby route already applies. Attribution is worth attempting, never
 * worth failing a scan over.
 */
export async function gatherNearbyCandidates(
  supabase: any,
  lat: number,
  lng: number,
  googleLang = 'zh-HK',
): Promise<NearbyCandidate[]> {
  const { data: dishiRows } = await supabase.rpc('nearby_restaurants', {
    user_lat: lat, user_lng: lng, radius_m: AUTO_RADIUS_M, max_results: 8,
  });
  const dishi: NearbyCandidate[] = (dishiRows ?? []).map((r: any) => ({
    source: 'dishi' as const,
    id: r.id, name: r.name, name_zh: r.name_zh ?? null, address: r.address ?? null,
    lat: r.lat, lng: r.lng, distance_m: r.distance_m,
  }));

  let google: NearbyCandidate[] = [];
  try {
    const places = await cachedNearbyPlaces(lat, lng, googleLang);
    google = places
      // Same-physical-place suppression as dedupeAgainstDishi's 40m rule, but
      // reusing the distance we already need here rather than a second pass.
      .filter(p => !dishi.some(d => haversineMeters(p.lat, p.lng, d.lat, d.lng) < 40))
      .map(p => ({
        source: 'google' as const,
        place_id: p.place_id, name: p.name, address: p.address ?? null,
        lat: p.lat, lng: p.lng,
        distance_m: haversineMeters(lat, lng, p.lat, p.lng),
      }));
  } catch (e) {
    console.error('table restaurant: Places lookup failed', e);
  }

  return [...dishi, ...google];
}

/**
 * Turn a candidate into a real `restaurants.id`. A Dishi-sourced candidate
 * already IS one; a Google one goes through the SAME place_id-canonical
 * creation path tapping its chip in the picker would take, so the first table
 * to sit down at a place caches it for everyone after that — no separate
 * "auto-created" flavour of restaurant record exists.
 */
export async function adoptCandidate(
  supabase: any,
  userId: string,
  candidate: NearbyCandidate,
): Promise<string | null> {
  if (candidate.source === 'dishi' && candidate.id) return candidate.id;
  const resolved = await resolveOrCreateRestaurant(supabase, userId, null, {
    name: candidate.name,
    lat: candidate.lat,
    lng: candidate.lng,
    place_id: candidate.place_id,
    address: candidate.address ?? undefined,
  });
  return resolved.id;
}

/**
 * Gather -> decide -> adopt, in one call. Returns the adopted restaurant id (or
 * null) alongside the verdict, so a caller can tell "attached it" apart from
 * "there were real options but none of them was safe to guess" and offer those
 * options as one-tap chips instead of inventing an answer.
 */
export async function resolveSessionRestaurant(
  supabase: any,
  userId: string,
  lat: number,
  lng: number,
  googleLang = 'zh-HK',
  /** The menu's own printed name (the scan's restaurant_guess) — refines an
   * ambiguous verdict inside the gate; see decideSessionRestaurant. */
  printedName: string | null = null,
): Promise<{ restaurantId: string | null; verdict: RestaurantVerdict }> {
  const candidates = await gatherNearbyCandidates(supabase, lat, lng, googleLang);
  const verdict = decideSessionRestaurant(candidates, printedName);
  if (verdict.kind !== 'confident') return { restaurantId: null, verdict };
  return { restaurantId: await adoptCandidate(supabase, userId, verdict.candidate), verdict };
}
