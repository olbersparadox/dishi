// Which restaurant a scan-shared table session belongs to, decided ONCE at
// session create instead of per-pick.
//
// Why this exists at all: a table session's restaurant used to be nobody's job.
// POST /api/table never set `restaurant_id`, and the only place a restaurant got
// attached was the SCANNER's own confirm sheet on the scan screen — so every
// dish a JOINER picked was written with restaurant_id null. Confirmed live
// 2026-07-30: all 5 most recent sessions had restaurant_id null, and both picks
// in the two-account field test logged null. Dish-level demand data with no
// restaurant on it is the one thing this product cannot afford to lose, since
// restaurant x dish IS the moat.
//
// The decision is deliberately CONSERVATIVE. Attributing a table to the wrong
// restaurant is worse than attributing it to none: a null is a gap the owner can
// still fill, while a confident wrong answer silently poisons the demand data and
// nobody ever goes looking for it. So this gate adopts a nearby place only when
// the answer is genuinely unambiguous, and returns `ambiguous` otherwise — the
// caller then shows the restaurant line seeded with the runners-up as one-tap
// chips, rather than guessing.
//
// Hong Kong density is the reason the gate is shaped this way and not around a
// "nearest wins" rule: several restaurants routinely share one street number on
// different floors, well inside GPS's own ~10-30m wobble, so distance ALONE
// cannot separate them. Nearest-wins would be confidently wrong exactly where
// this app is used most.

/** A nearby candidate, from either source the picker already merges (see
 * /api/restaurants/nearby): Dishi's own restaurants, which may already carry
 * dish history, and Google Places for real-world spots Dishi hasn't met yet. */
export type NearbyCandidate = {
  source: 'dishi' | 'google';
  /** Present for source 'dishi'. */
  id?: string;
  /** Present for source 'google'. Canonical dedupe key on adoption. */
  place_id?: string;
  name: string;
  name_zh?: string | null;
  address?: string | null;
  lat: number;
  lng: number;
  /** Metres from the session's coords. Null when the source didn't supply one
   * (Google Nearby Search doesn't) — the caller computes it before calling. */
  distance_m: number | null;
};

/** Only a place we could plausibly be standing INSIDE. Beyond this a "nearest"
 * result is just the neighbourhood, not the restaurant. */
export const AUTO_RADIUS_M = 60;

/** How much closer the winner must be than the runner-up to count as separated
 * rather than as two guesses. Set above GPS's own wobble on purpose: below this
 * the ordering is noise, not signal. */
export const AUTO_MARGIN_M = 35;

export type RestaurantVerdict =
  /** Confident enough to attach with no interaction at all. */
  | { kind: 'confident'; candidate: NearbyCandidate }
  /** Real candidates, none separable — offer these, attach nothing yet. */
  | { kind: 'ambiguous'; candidates: NearbyCandidate[] }
  /** Nothing close enough to be worth offering. */
  | { kind: 'none' };

/**
 * Decide whether a table session can silently adopt a restaurant.
 *
 * Confident only when, inside AUTO_RADIUS_M, either there is exactly one
 * candidate, or the nearest beats the runner-up by more than AUTO_MARGIN_M.
 * A Dishi-sourced candidate does NOT get preference here: preferring it would
 * mean the answer changes depending on whether Dishi happens to already know
 * one of two adjacent shops, which is an artefact of Dishi's own coverage
 * rather than anything about where the person is sitting. Distance decides;
 * source only matters at adoption time (a Dishi row is reused, a Google one is
 * created via the normal place_id path).
 *
 * Candidates with no distance are dropped rather than assumed near — the caller
 * is responsible for computing distance, and a missing one is a bug upstream,
 * not a licence to guess.
 */
export function decideSessionRestaurant(candidates: NearbyCandidate[]): RestaurantVerdict {
  const inRange = candidates
    .filter(c => c.distance_m !== null && Number.isFinite(c.distance_m) && c.distance_m <= AUTO_RADIUS_M)
    .sort((a, b) => (a.distance_m as number) - (b.distance_m as number));

  if (inRange.length === 0) return { kind: 'none' };
  if (inRange.length === 1) return { kind: 'confident', candidate: inRange[0] };

  const gap = (inRange[1].distance_m as number) - (inRange[0].distance_m as number);
  if (gap > AUTO_MARGIN_M) return { kind: 'confident', candidate: inRange[0] };

  // Cap what we offer: a chip row, not a directory. Already distance-sorted, so
  // these are the nearest few.
  return { kind: 'ambiguous', candidates: inRange.slice(0, 5) };
}
