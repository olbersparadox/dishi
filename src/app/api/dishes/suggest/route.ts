import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { mergeSuggestions, type SuggestRow } from '@/lib/dishSuggest';

export const maxDuration = 15;

/**
 * GET /api/dishes/suggest?q=<text>&restaurant_id=&lat=&lng=
 *
 * Predictive dish-name input for the 打字 typed-quick-add flow (backlog
 * 2026-07-22, item 3). See dishSuggest.ts for the tiering rule; this route is
 * just the two lookups that feed it — dish_identities at a known/nearby
 * restaurant, then the person's own dish history, most recent first.
 */
export async function GET(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 60);
  if (!q) return NextResponse.json({ suggestions: [] });
  const pattern = `%${q}%`;

  const restaurantIdParam = req.nextUrl.searchParams.get('restaurant_id');
  const lat = Number(req.nextUrl.searchParams.get('lat'));
  const lng = Number(req.nextUrl.searchParams.get('lng'));

  let restaurantIds: string[] | null = restaurantIdParam ? [restaurantIdParam] : null;
  if (!restaurantIds && Number.isFinite(lat) && Number.isFinite(lng)) {
    const { data: nearby } = await supabase.rpc('nearby_restaurants', {
      user_lat: lat, user_lng: lng, radius_m: 1000, max_results: 12,
    });
    restaurantIds = (nearby ?? []).map((r: { id: string }) => r.id);
  }

  const [identityByName, identityByNameZh, ownByName, ownByNameZh] = await Promise.all([
    restaurantIds?.length
      ? supabase.from('dish_identities').select('name, name_zh, restaurant_id').in('restaurant_id', restaurantIds).ilike('name', pattern).limit(6)
      : Promise.resolve({ data: [] as SuggestRow[] }),
    restaurantIds?.length
      ? supabase.from('dish_identities').select('name, name_zh, restaurant_id').in('restaurant_id', restaurantIds).ilike('name_zh', pattern).limit(6)
      : Promise.resolve({ data: [] as SuggestRow[] }),
    supabase.from('dishes').select('name, name_zh').eq('user_id', user.id).ilike('name', pattern).order('created_at', { ascending: false }).limit(6),
    supabase.from('dishes').select('name, name_zh').eq('user_id', user.id).ilike('name_zh', pattern).order('created_at', { ascending: false }).limit(6),
  ]);

  const suggestions = mergeSuggestions([
    identityByName.data ?? [], identityByNameZh.data ?? [],
    ownByName.data ?? [], ownByNameZh.data ?? [],
  ]);
  return NextResponse.json({ suggestions });
}
