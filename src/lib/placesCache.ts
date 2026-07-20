import { supabaseAdmin } from './supabase/server';
import { GooglePlace, searchNearbyRestaurants } from './places';

const CACHE_TTL_HOURS = 12;

/** Round to ~111m grid cells so nearby lookups share a cache entry. Language is
 * part of the bucket now — English and Chinese results are genuinely different
 * data, not the same data displayed differently. The `:v2` suffix namespaces the
 * bucket AFTER the switch to DISTANCE ranking (see places.ts): without it, up to
 * 12h of pre-change prominence-ranked results would keep serving post-deploy,
 * hiding the very fix. Bump the suffix again on any future change to what Google
 * is asked for. */
function bucketFor(lat: number, lng: number, lang: string): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)},${lang}:v2`;
}

/**
 * Cached wrapper around the Google Places call. Most repeat visits to the same
 * restaurant, or multiple people at the same food court, hit this cache instead of
 * billing Google again — this is the main cost control, more impactful than the field
 * mask alone once usage grows.
 */
export async function cachedNearbyPlaces(lat: number, lng: number, languageCode = 'en'): Promise<GooglePlace[]> {
  const admin = supabaseAdmin();
  const bucket = bucketFor(lat, lng, languageCode);

  const { data: cached } = await admin.from('places_cache').select('*').eq('bucket', bucket).maybeSingle();
  if (cached) {
    const ageHours = (Date.now() - new Date(cached.fetched_at).getTime()) / 36e5;
    if (ageHours < CACHE_TTL_HOURS) return cached.results as GooglePlace[];
  }

  const results = await searchNearbyRestaurants(lat, lng, 300, languageCode);
  // Cache even empty results (e.g. no key configured, or genuinely nothing nearby) —
  // still saves a wasted round trip next time, and a missing key won't call Google anyway.
  await admin.from('places_cache').upsert({ bucket, results, fetched_at: new Date().toISOString() });
  return results;
}
