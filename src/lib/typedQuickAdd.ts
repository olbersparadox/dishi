// Pure request-body builder for the 打字 typed-quick-add commit (backlog
// 2026-07-22, item 3): turns the collected name + restaurant choice into the
// POST /api/dishes JSON body. Structurally compatible with RestaurantPicker's
// RestaurantChoice (not imported, to keep this file dependency-free of a
// component) — the picker's onChange value can be passed straight through.

export type TypedRestaurantChoice =
  | { kind: 'existing'; id: string; name: string }
  | { kind: 'new'; name: string; lat: number; lng: number; area?: string; address?: string; place_id?: string }
  | { kind: 'home' }
  | null;

export type TypedDishBody = {
  name: string;
  name_zh: string;
  source: 'home' | 'manual';
  restaurant_id?: string;
  new_restaurant?: { name: string; lat: number; lng: number; area?: string; address?: string; place_id?: string };
  lat?: number;
  lng?: number;
};

/**
 * name/name_zh come pre-trimmed from the caller's input state; this only
 * decides how the restaurant step's outcome maps onto the body. The 住家菜
 * chip sets source:'home' (matches the dishes.source check constraint and
 * createFromName's existing 'home'-vs-'manual' rule); an actual restaurant or
 * an outright skip is source:'manual'. A skip that still has live coords
 * (e.g. current GPS) carries them through so the server can reverse-geocode
 * a district for a no-restaurant dish.
 */
export function buildTypedDishBody(
  name: string, nameZh: string,
  restaurant: TypedRestaurantChoice,
  coords: { lat: number; lng: number } | null,
): TypedDishBody {
  const body: TypedDishBody = {
    name, name_zh: nameZh,
    source: restaurant?.kind === 'home' ? 'home' : 'manual',
  };
  if (restaurant?.kind === 'existing') {
    body.restaurant_id = restaurant.id;
  } else if (restaurant?.kind === 'new') {
    body.new_restaurant = {
      name: restaurant.name, lat: restaurant.lat, lng: restaurant.lng,
      area: restaurant.area, address: restaurant.address, place_id: restaurant.place_id,
    };
  }
  if (!body.restaurant_id && !body.new_restaurant && coords) {
    body.lat = coords.lat;
    body.lng = coords.lng;
  }
  return body;
}
