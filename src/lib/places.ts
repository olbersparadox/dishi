// Google Places (New) Nearby Search client.
//
// COST DISCIPLINE, explained because it's easy to get wrong and expensive when you do:
// Google bills by which FIELDS you request, not which endpoint you call. Asking only
// for id/displayName/location/formattedAddress keeps every request in the cheapest
// "Essentials" tier (free up to 10,000/month, a few dollars per 1,000 after). Asking
// for photos, ratings, or opening hours — fields Dishi doesn't even use in the
// quick-pick — would silently upgrade EVERY request to a pricier tier. So the field
// mask below is deliberately minimal and should not be extended without checking the
// billing tier it lands in.
//
// The second cost lever is the cache in placesCache.ts — this module doesn't call
// Google at all if a recent cached result exists for the area.

export type GooglePlace = {
  place_id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
};

const FIELD_MASK = 'places.id,places.displayName,places.location,places.formattedAddress';

/**
 * Nearby restaurants, named in whichever ONE language is requested. Simpler and
 * cheaper than fetching both languages and merging by place id — that approach was
 * tried and dropped: two independent Nearby Search calls don't reliably return the
 * SAME set of places (each is capped at 10 results and ranked independently), so a
 * place could rank just inside the English top-10 and just outside the Chinese
 * top-10 — showing up as "no Chinese name" even when Google has one. Asking once,
 * in the app's current display language, sidesteps that entirely: whatever Google
 * returns is presented as-is, correctly, no fallback logic required.
 */
export async function searchNearbyRestaurants(
  lat: number, lng: number, radiusMeters = 300, languageCode = 'en',
): Promise<GooglePlace[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return []; // No key configured — Dishi's own restaurant list is used alone.

  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes: ['restaurant'],
      maxResultCount: 10,
      languageCode,
      locationRestriction: {
        circle: { center: { latitude: lat, longitude: lng }, radius: radiusMeters },
      },
    }),
  });

  if (!res.ok) {
    // Fail soft: a Places outage or quota error shouldn't break dish logging, just
    // means the quick-pick falls back to Dishi's own restaurant list.
    console.error('Places API error', res.status, await res.text().catch(() => ''));
    return [];
  }

  const json = await res.json();
  const places = (json.places ?? []) as any[];
  return places.map(p => ({
    place_id: p.id,
    name: p.displayName?.text ?? 'Unknown restaurant',
    lat: p.location?.latitude,
    lng: p.location?.longitude,
    address: p.formattedAddress ?? null,
  })).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Drop Google results that are basically the same physical place as one already in
 * Dishi's own table — Dishi's copy wins because it may already carry real dish
 * history. "Same place" = within 40m, since GPS + Places geocoding both wobble.
 */
export function dedupeAgainstDishi<T extends { lat: number; lng: number }>(
  googleResults: T[],
  dishiResults: { lat: number; lng: number }[],
): T[] {
  return googleResults.filter(g =>
    !dishiResults.some(d => haversineMeters(g.lat, g.lng, d.lat, d.lng) < 40));
}
