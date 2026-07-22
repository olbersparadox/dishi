import { NextRequest, NextResponse } from 'next/server';
import { searchPlacesText } from '@/lib/places';

/**
 * GET /api/restaurants/search?q=..&lat=..&lng=..&lang=..
 *
 * Search-on-add, not typeahead: the picker calls this ONCE, when the user taps
 * 加入 on a manually-typed name that the local (already-loaded) nearby chip
 * list didn't already resolve — never per keystroke. A keystroke-debounced
 * live search was considered and rejected: every query is a billed call with
 * no cache locality, whereas search-on-add is exactly one call per add
 * attempt and slots into the existing same-place nudge UX. See places.ts's
 * searchPlacesText for the billing tier this lands in (Text Search Pro, NOT
 * the cheaper Essentials tier Nearby Search uses).
 *
 * No cache here (unlike /api/restaurants/nearby's placesCache.ts) — a typed
 * name + coords bucket has poor hit locality (every add attempt is a
 * different query string), so a cache would mostly just add complexity for
 * near-zero savings on volume that's already naturally bounded to one call
 * per confirmed add.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const lat = Number(req.nextUrl.searchParams.get('lat'));
  const lng = Number(req.nextUrl.searchParams.get('lng'));
  const googleLang = req.nextUrl.searchParams.get('lang') === 'zh' ? 'zh-HK' : 'en';

  if (!q) return NextResponse.json({ error: 'q is required.' }, { status: 400 });
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat and lng are required.' }, { status: 400 });
  }

  try {
    const places = await searchPlacesText(q, lat, lng, 1000, googleLang, 5);
    return NextResponse.json({
      restaurants: places.map(p => ({
        place_id: p.place_id, name: p.name, lat: p.lat, lng: p.lng, address: p.address,
        distance_m: null, source: 'google' as const,
      })),
    });
  } catch (e) {
    // A Places hiccup should never block a manual add — the picker falls
    // through to createNew() on an empty result, same as places.ts's own
    // fail-soft discipline.
    console.error('Restaurant text search failed', e);
    return NextResponse.json({ restaurants: [] });
  }
}
