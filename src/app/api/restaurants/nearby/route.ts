import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { cachedNearbyPlaces } from '@/lib/placesCache';
import { dedupeAgainstDishi } from '@/lib/places';

/**
 * GET /api/restaurants/nearby?lat=..&lng=..
 * Two sources, merged:
 *  1. Dishi's own restaurant table — always queried first, always shown first, since
 *     these may already carry real dish history from other users.
 *  2. Google Places Nearby Search — fills in real-world restaurants Dishi doesn't
 *     know about yet, so a brand-new city or a never-logged spot still shows real
 *     names instead of an empty "add manually" state. Cached per ~111m area (see
 *     placesCache.ts) and field-masked to the cheapest billing tier (see places.ts) —
 *     both deliberate cost controls, not incidental.
 * Google results carry no restaurant id yet — picking one on the client reuses the
 * same "new restaurant" creation path as manually typing a name, which means the
 * first person to select it creates Dishi's own record, and it's a pure Dishi lookup
 * (no Google call at all) for everyone after that.
 */
export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get('lat'));
  const lng = Number(req.nextUrl.searchParams.get('lng'));
  // Which language to ask Google for — no bilingual fetch/merge anymore (see
  // places.ts for why that was dropped). Dishi's OWN restaurants still carry
  // whatever name_zh they happen to have on file; only the Google half of the
  // list is genuinely single-language by request.
  const googleLang = req.nextUrl.searchParams.get('lang') === 'zh' ? 'zh-HK' : 'en';
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat and lng are required.' }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data: dishiResults, error } = await supabase.rpc('nearby_restaurants', {
    user_lat: lat,
    user_lng: lng,
    radius_m: 300,
    max_results: 8,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const dishi = (dishiResults ?? []).map((r: any) => ({ ...r, source: 'dishi' as const }));

  let google: any[] = [];
  try {
    const places = await cachedNearbyPlaces(lat, lng, googleLang);
    const deduped = dedupeAgainstDishi(places, dishi);
    google = deduped.slice(0, 8 - dishi.length).map(p => ({
      place_id: p.place_id, name: p.name, lat: p.lat, lng: p.lng, address: p.address,
      distance_m: null, source: 'google' as const,
    }));
  } catch (e) {
    // A Places hiccup should never block logging a dish — just fewer suggestions.
    console.error('Places lookup failed', e);
  }

  return NextResponse.json({ restaurants: [...dishi, ...google] });
}
