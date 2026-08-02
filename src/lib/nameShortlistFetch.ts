// The DB half of item 3b — collects the sources buildShortlist() ranks.
// Split pure/impure the same way tableRestaurant.ts and tableRestaurantResolve.ts
// are, so the decision logic stays unit-testable without a database.
import {
  buildShortlist, SHORTLIST_RADIUS_M, SHORTLIST_RECENCY_DAYS,
  type ShortlistSource,
} from './nameShortlist';

/**
 * Hard ceiling on the whole lookup. This runs BEFORE the vision call rather
 * than alongside it (vision has to be told the shortlist to use it), so it sits
 * directly in the user's wait. A healthy round trip here is tens of
 * milliseconds against a multi-second vision call; anything slower is a
 * degraded database, and the right answer then is today's context-free naming,
 * not a slower log. Fails to an empty shortlist, never an error.
 */
const LOOKUP_BUDGET_MS = 1500;

export type ShortlistLookup = {
  shortlist: string[];
  /** Nearest known district, for the locale hint (3a). Null when nothing is near. */
  district: { zh?: string | null; en?: string | null } | null;
};

const EMPTY: ShortlistLookup = { shortlist: [], district: null };

/**
 * Menu vocabulary near a photo, for constraining vision's naming.
 *
 * Two sources, in priority order (buildShortlist fills its cap in source order):
 *  1. `dish_identities` of restaurants in range — a shop's SETTLED vocabulary,
 *     with no expiry.
 *  2. `menu_items` of scan sessions in range and in date — the vocabulary that
 *     actually exists at this stage of the product, and the only source that
 *     works when the restaurant has no row at all (see nameShortlist.ts).
 *
 * Every failure mode returns EMPTY: no coords, a slow database, a query error,
 * an unparseable timestamp. The caller must not distinguish "nothing nearby"
 * from "lookup broke" — both mean send the request this route has always sent.
 */
export async function fetchNameShortlist(
  supabase: any,
  lat: number,
  lng: number,
  when: string | number | Date,
): Promise<ShortlistLookup> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return EMPTY;
  try {
    return await Promise.race([
      lookup(supabase, lat, lng, when),
      new Promise<ShortlistLookup>(resolve => setTimeout(() => resolve(EMPTY), LOOKUP_BUDGET_MS)),
    ]);
  } catch (e) {
    // Never surfaced to the user: a missing shortlist is indistinguishable from
    // an empty neighbourhood by design.
    console.error('name-shortlist: lookup failed', e);
    return EMPTY;
  }
}

async function lookup(
  supabase: any, lat: number, lng: number, when: string | number | Date,
): Promise<ShortlistLookup> {
  // Bounding box first so the database never scans the world; buildShortlist
  // applies the real circular distance to whatever survives. A box is slightly
  // generous at the corners, which is the harmless direction.
  const dLat = SHORTLIST_RADIUS_M / 111_320;
  const dLng = SHORTLIST_RADIUS_M / (111_320 * Math.cos((lat * Math.PI) / 180) || 1);
  const t = new Date(when).getTime();
  const windowMs = SHORTLIST_RECENCY_DAYS * 24 * 60 * 60 * 1000;
  const since = new Date((Number.isFinite(t) ? t : Date.now()) - windowMs).toISOString();
  const until = new Date((Number.isFinite(t) ? t : Date.now()) + windowMs).toISOString();

  const [restaurantsRes, sessionsRes] = await Promise.all([
    supabase.from('restaurants').select('id, lat, lng, district')
      .gte('lat', lat - dLat).lte('lat', lat + dLat)
      .gte('lng', lng - dLng).lte('lng', lng + dLng)
      .limit(20),
    supabase.from('table_sessions').select('scan_lat, scan_lng, created_at, menu_items')
      .not('scan_lat', 'is', null)
      .gte('scan_lat', lat - dLat).lte('scan_lat', lat + dLat)
      .gte('scan_lng', lng - dLng).lte('scan_lng', lng + dLng)
      .gte('created_at', since).lte('created_at', until)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const restaurants = (restaurantsRes?.data ?? []) as any[];
  const sessions = (sessionsRes?.data ?? []) as any[];

  let identities: any[] = [];
  if (restaurants.length > 0) {
    const { data } = await supabase.from('dish_identities')
      .select('restaurant_id, name, name_zh')
      .in('restaurant_id', restaurants.map(r => r.id))
      .limit(200);
    identities = data ?? [];
  }

  const sources: ShortlistSource[] = [];
  for (const r of restaurants) {
    const names = identities.filter(i => i.restaurant_id === r.id).map(i => i.name_zh ?? i.name);
    if (names.length > 0) sources.push({ lat: r.lat, lng: r.lng, at: null, names });
  }
  for (const s of sessions) {
    const names = (Array.isArray(s.menu_items) ? s.menu_items : [])
      // zh first, then the verbatim printed original, and English only as the
      // last resort — constraint 2 in nameShortlist.ts.
      .map((m: any) => m?.name_zh ?? m?.name_original ?? m?.name);
    if (names.length > 0) sources.push({ lat: s.scan_lat, lng: s.scan_lng, at: s.created_at, names });
  }

  // Nearest restaurant's district stands in for "where this photo was taken".
  // Free — the row was already fetched for its identities.
  const nearest = restaurants
    .filter(r => r.district && Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .sort((a, b) =>
      Math.hypot(a.lat - lat, a.lng - lng) - Math.hypot(b.lat - lat, b.lng - lng))[0];

  return {
    shortlist: buildShortlist(sources, { lat, lng }, when),
    district: nearest?.district ?? null,
  };
}
