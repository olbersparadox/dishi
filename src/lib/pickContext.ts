// Pick context integrity (field-session batch 2026-07-23, item 2): a dish picked
// off a scanned menu KNOWS its restaurant at creation — that context must ride
// with the dish to the growth confirm card, and must never be re-guessed. The
// field failure: the card showed no restaurant and offered the full picker, and
// the nearby lookup's optimistic persist could silently OVERWRITE the correct
// scan-time restaurant with whatever was geographically nearest.
//
// This is the one decision point: given what the pick already knows, what does
// the growth card show, and is the nearby-restaurant guess allowed to run at
// all? Pure so the rule is testable without mounting the rating flow.

/** The restaurant a queued pick already carries (from dishes.restaurant_id at
 * pick creation), as ?unrated=1 returns it. */
export type PickRestaurant = { id: string; name: string; name_zh: string | null };

export type PickPlaceContext = {
  /** Display label for the card, in the chrome language (zh falls back to en —
   * a restaurant may predate name_zh). Null when the pick has no restaurant. */
  choice: string | null;
  /** True = render the restaurant as settled fact: no picker chips, no refine
   * affordance. Correction lives in 食記's 轉餐廳, not on the confirm card. */
  fixed: boolean;
  /** May the nearby-restaurant guess run? NEVER for a restaurant-bearing pick —
   * its optimistic persist is exactly the overwrite path being killed. */
  loadNearby: boolean;
};

export function pickPlaceContext(
  restaurant: PickRestaurant | null | undefined,
  hasCoords: boolean,
  lang: 'zh' | 'en',
): PickPlaceContext {
  if (restaurant) {
    return {
      choice: lang === 'zh' ? (restaurant.name_zh ?? restaurant.name) : restaurant.name,
      fixed: true,
      loadNearby: false,
    };
  }
  // No restaurant on the pick (略過 at pick time): the current picker behaviour
  // stands unchanged — nearby guessing is the best offer we have.
  return { choice: null, fixed: false, loadNearby: hasCoords };
}
