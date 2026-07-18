// Reverse geocoding: turns GPS coordinates into a human district/area name + a
// formatted address. Used ONLY as a prefill for the "add more details" fields when
// manually adding a restaurant — always editable, never silently overwritten, so a
// wrong guess (or a deliberately different location — logging a dish from a past
// trip abroad) is one tap away from being corrected.
//
// NOTE FOR SETUP: this uses Google's classic Geocoding API, a different API surface
// from Places (New) used elsewhere in this file's sibling (places.ts). It must be
// enabled separately in the same Google Cloud project as GOOGLE_PLACES_API_KEY, or
// every call below fails soft (returns nulls) rather than breaking the form.

export type ReverseGeocodeResult = { area: string | null; address: string | null };

export type AddressComponent = { long_name: string; types: string[] };

/**
 * "Area" prefers a neighborhood-level component (sublocality) over the whole city,
 * since "Causeway Bay" is a far more useful prefill than "Hong Kong". Falls back to
 * locality, then null (never a wrong guess dressed up as a real answer).
 */
export function pickAreaFromComponents(components: AddressComponent[]): string | null {
  return components.find(c => c.types.includes('sublocality') || c.types.includes('sublocality_level_1'))?.long_name
    ?? components.find(c => c.types.includes('locality'))?.long_name
    ?? null;
}

export async function reverseGeocode(lat: number, lng: number, languageCode = 'en'): Promise<ReverseGeocodeResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return { area: null, address: null };

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('latlng', `${lat},${lng}`);
  url.searchParams.set('language', languageCode);
  url.searchParams.set('key', apiKey);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) { console.error('Reverse geocode HTTP', res.status); return { area: null, address: null }; }
    const json = await res.json();
    // The Geocoding API answers 200 even on auth failure, putting the real reason in
    // `status` (e.g. REQUEST_DENIED when the Geocoding API isn't enabled for the key).
    // Surface it — silently returning null here is exactly what hid the misconfig.
    if (json?.status && json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
      console.error('Reverse geocode status', json.status, json.error_message ?? '');
      return { area: null, address: null };
    }
    const result = json?.results?.[0];
    if (!result) return { area: null, address: null };

    const area = pickAreaFromComponents(result.address_components ?? []);
    return { area, address: result.formatted_address ?? null };
  } catch (e) {
    console.error('Reverse geocode failed', e);
    return { area: null, address: null };
  }
}
