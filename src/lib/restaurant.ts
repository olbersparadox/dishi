import { districtI18n } from './geocode';

export type NewRestaurantInput = {
  name?: unknown; lat?: unknown; lng?: unknown; area?: unknown; address?: unknown;
  place_id?: unknown; // Google Places id — present when the user tapped a Google chip
};

/**
 * Normalizes a restaurant name for identity comparison — NOT for display.
 * Folds the differences that make the same real-world place look like two strings:
 * case, surrounding/internal whitespace, full-width vs half-width characters
 * (ＭcＤonald's vs McDonald's), and punctuation (Kam's Roast Goose vs Kams Roast
 * Goose, 一風堂・銅鑼灣 vs 一風堂銅鑼灣). CJK characters pass through untouched.
 * Deliberately conservative: it only folds cosmetic variation, it does NOT try to
 * decide that two genuinely different names mean the same place — that judgement
 * is left to the human "same place?" nudge in the picker.
 */
const PUNCT_AND_SYMBOLS = /['’‘"“”.,!?…、。，！？：；:;()（）\[\]{}「」『』・\-–—~＿_/\\@#$%^&*+=|<>`]/g;

export function normalizeRestaurantName(raw: string): string {
  return raw
    .normalize('NFKC')          // full-width → half-width, compatibility folds
    .toLowerCase()
    .replace(PUNCT_AND_SYMBOLS, '') // punctuation & symbols (incl. ・、。'&-)
    .replace(/\s+/g, '');
}

type NearbyRow = { id: string; name: string; name_zh?: string | null; place_id?: string | null };

/** True when a typed/derived name cosmetically matches an existing row's name in either language. */
export function namesMatch(candidate: string, row: { name: string; name_zh?: string | null }): boolean {
  const n = normalizeRestaurantName(candidate);
  if (!n) return false;
  return n === normalizeRestaurantName(row.name)
    || (!!row.name_zh && n === normalizeRestaurantName(row.name_zh));
}

/**
 * True when one normalised name CONTAINS the other, in either language — the common
 * "same place, extra branch/area suffix" shape that exact matching misses:
 *   "元氣壽司" ⊂ "元氣壽司 (銅鑼灣)",  "McDonald's" ⊂ "McDonald's Times Square".
 *
 * Guarded, because containment is a weaker signal than equality:
 *  - a length floor (script-aware: CJK packs a word into 2 chars, Latin needs more)
 *    stops a short generic name ("Cafe", "壽司") from being contained in half the block;
 *  - it is only ever USED within a tight radius AND only when EXACTLY ONE nearby row
 *    matches (the caller enforces both) — a restaurant false-merge fuses a whole
 *    place's dish history, so ambiguity must fall through to "create + let a human
 *    merge later", never an automatic guess.
 */
export function namesContainmentRelated(candidate: string, row: { name: string; name_zh?: string | null }): boolean {
  const c = normalizeRestaurantName(candidate);
  if (!c) return false;
  const test = (other: string | null | undefined): boolean => {
    const o = other ? normalizeRestaurantName(other) : '';
    if (!o || c === o) return false; // equality is namesMatch's job, not this
    const [shorter, longer] = c.length <= o.length ? [c, o] : [o, c];
    const hasCjk = /[\u3400-\u9FFF\uF900-\uFAFF]/.test(shorter);
    // CJK packs a word into 2 chars; Latin fragments ("cafe", "bar") are generic
    // and would be contained all over a block, so they need a higher floor.
    const floor = hasCjk ? 2 : 5;
    if (shorter.length < floor) return false;
    return longer.includes(shorter);
  };
  return test(row.name) || test(row.name_zh);
}

/**
 * Resolves a restaurant reference for a dish/pick: an existing id passed straight
 * through, or a "new restaurant" payload that gets deduped before creating a fresh
 * row — so two people tapping the same Google chip, or typing the same name at the
 * same spot, share one restaurant record instead of fragmenting its dish history.
 *
 * Dedup order (strongest identity signal first):
 *  1. place_id exact match — Google's canonical id, immune to name/language variation.
 *     (Merging pre-existing duplicate rows is a separate, human-confirmed pass —
 *      this function never merges, it only picks which row new dishes attach to.)
 *  2. Normalized-name match within ~50m — covers legacy rows created before place_id
 *     existed, and manually-typed names. Checks BOTH name and name_zh, with cosmetic
 *     folding (case/width/punctuation/whitespace), so "Kam's Roast" and "kams roast"
 *     don't fork. If this hit has no place_id but the payload carries one, the row is
 *     healed in place — future lookups then resolve via the stronger path 1.
 *  3. Create, storing place_id when present. A unique-violation race (two people
 *     tapping the same Google chip simultaneously) is resolved by re-reading the
 *     winner's row rather than failing the log.
 *
 * Shared between /api/dishes (photo logging) and /api/dishes/pick (menu-scan/table
 * picks) so both paths dedupe identically rather than drifting apart over time.
 */
// Typed loosely on purpose: supabaseServer()/supabaseAdmin() return slightly
// different wrapped client types (via @supabase/ssr) that aren't worth pinning
// exactly here — both support the handful of calls this function actually makes.
export async function resolveOrCreateRestaurant(
  supabase: any,
  userId: string,
  restaurantId: string | null,
  newRestaurant: NewRestaurantInput | null,
): Promise<{ id: string | null; error?: string }> {
  if (restaurantId) return { id: restaurantId };
  if (!newRestaurant) return { id: null };

  const name = String(newRestaurant.name ?? '').trim();
  const lat = Number(newRestaurant.lat), lng = Number(newRestaurant.lng);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { id: null, error: 'A new restaurant needs a name and location.' };
  }
  const placeId = typeof newRestaurant.place_id === 'string' && newRestaurant.place_id.trim()
    ? newRestaurant.place_id.trim().slice(0, 300)
    : null;
  // Optional, user-supplied (possibly reverse-geocode-prefilled, always editable) —
  // never required, never invented if absent.
  const area = typeof newRestaurant.area === 'string' ? newRestaurant.area.trim().slice(0, 80) || null : null;
  const address = typeof newRestaurant.address === 'string' ? newRestaurant.address.trim().slice(0, 200) || null : null;

  // 1. Canonical: Google place_id.
  if (placeId) {
    const { data: byPlace } = await supabase
      .from('restaurants').select('id').eq('place_id', placeId).limit(1).maybeSingle();
    if (byPlace?.id) return { id: byPlace.id };
  }

  // 2. Legacy/manual: normalized name within ~50m, either language.
  const { data: nearbySame } = await supabase.rpc('nearby_restaurants', {
    user_lat: lat, user_lng: lng, radius_m: 50, max_results: 8,
  });
  const nearby = (nearbySame ?? []) as NearbyRow[];
  const existing = nearby.find(r => namesMatch(name, r));
  if (existing) {
    // Heal: this pre-place_id row IS this Google place — record that so the next
    // resolution takes path 1 regardless of what language its name is shown in.
    if (placeId && !existing.place_id) {
      await supabase.from('restaurants')
        .update({ place_id: placeId }).eq('id', existing.id).is('place_id', null);
    }
    return { id: existing.id };
  }

  // 2b. Containment fallback: "元氣壽司" vs "元氣壽司 (銅鑼灣)" — same place, extra
  // branch/area suffix. Only accepted when EXACTLY ONE nearby row is containment-
  // related: two candidates means the name is ambiguous at this spot, and a wrong
  // restaurant merge is far more destructive than a duplicate row a human can later
  // merge. nearby is already the ~50m set; containment is a stronger name signal
  // than proximity, so the same radius is safe here without a distinct RPC call.
  const contained = nearby.filter(r => namesContainmentRelated(name, r));
  if (contained.length === 1) {
    const only = contained[0];
    if (placeId && !only.place_id) {
      await supabase.from('restaurants')
        .update({ place_id: placeId }).eq('id', only.id).is('place_id', null);
    }
    return { id: only.id };
  }

  // 3. Create. Reverse-geocode a BILINGUAL district from the coords so restaurant
  // dishes can show "name • 香港仔" in whichever language, with an English fallback
  // (and it works in any country). `area` (text) stays as the legacy/manual field;
  // `district` (jsonb) is the display source. Fail-soft — district just stays null.
  const district = await districtI18n(lat, lng).catch(() => null);
  const { data: r, error } = await supabase
    .from('restaurants')
    .insert({ name, lat, lng, area, address, place_id: placeId, district, created_by: userId })
    .select('id')
    .single();
  if (error) {
    // Unique violation on place_id: someone else created this exact place between
    // our check and our insert — their row is the canonical one, use it.
    if (placeId && (error.code === '23505' || /place_id/.test(error.message ?? ''))) {
      const { data: winner } = await supabase
        .from('restaurants').select('id').eq('place_id', placeId).limit(1).maybeSingle();
      if (winner?.id) return { id: winner.id };
    }
    return { id: null, error: error.message };
  }
  return { id: r.id };
}
