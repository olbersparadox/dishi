// Identity-constrained vision naming (BACKLOG item 3b), pure half.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FIXES — the field miss, 2026-08-02, 一起食堂
// ─────────────────────────────────────────────────────────────────────────────
// The owner scanned a menu (31 items, 和風牛肉烏龍麵 among them), photographed
// that very dish, and the album flow's vision guessed 豚骨拉麵 from pixels
// alone. They then retyped the correct name BY COPYING IT OFF THE MENU THEY HAD
// ALREADY SCANNED. The right name was in the database, ~100m and ~2h away from
// the photo. Nothing joined them.
//
// So: when a photo carries EXIF coords, collect the dish names that were
// printed on menus scanned nearby and recently, and let vision MATCH before it
// GUESSES. Measured before building (docs/rnd/vision-naming-context.md,
// 54-photo album backlog, live model): where the truth was on the shortlist,
// 5/5 completed calls adopted the menu's verbatim name — including the miss
// above, picked correctly past four adversarial 烏龍麵 neighbours on the same
// list. Where it wasn't, 8/10 correctly refused to force a match.
//
// TWO constraints the live data settled, both load-bearing:
//
//  1. THE SHORTLIST CANNOT BE RESTAURANT-SCOPED. The obvious design — fetch the
//     restaurant's dish_identities — fails at exactly the moment it is needed:
//     一起食堂 had no restaurant row when its menu was scanned. On the day of
//     the miss, dish_identities held 3 rows in total while ONE session's
//     menu_items held 31. Recent nearby SCAN SESSIONS are the vocabulary;
//     identities are a bonus source, not the source.
//
//  2. MATCH ON THE CHINESE, NEVER THE ENGLISH. The same menu printed
//     "Pork Belly Noodles" against 和風牛肉烏龍麵 and "Spicy Beef Noodles"
//     against 麻辣牛腱牛丸烏龍麵 — loose printed English or a scan
//     mistranslation, unverified which, and it does not matter: menu English is
//     not reliable as a match key. The zh name is the menu's verbatim truth.
//     (An English-only menu still contributes its English — the hazard is the
//     zh/en PAIRING inside one item, not English itself.)
import { compactDishName } from './dishIdentity';

/** Same spatial scale as the field miss (~100m from photo to scan) with slack
 * for urban GPS wobble. Deliberately looser than tableRestaurant's
 * AUTO_RADIUS_M (60m): that gate PICKS one restaurant and must not confuse
 * neighbours, whereas this only proposes vocabulary to a model that is free to
 * ignore all of it. A neighbour's menu in the list costs a longer prompt; a
 * missing menu costs the whole feature. */
export const SHORTLIST_RADIUS_M = 250;

/** A scanned menu stays true for days. The window exists to bound shortlist
 * size and to keep a photo from inheriting a shop's menu from months ago, not
 * to model menu churn. Standing identities do NOT expire — they are a
 * restaurant's settled vocabulary, not one sitting's snapshot. */
export const SHORTLIST_RECENCY_DAYS = 7;

/** Prompt-size ceiling. One session already carries up to 40 items
 * (shapeTableMenuItems' own cap), so in the common single-shop case nothing is
 * dropped; the cap bites only where several shops' menus overlap in range. */
export const SHORTLIST_CAP = 40;

/** A place whose printed dish names are candidates, with where and when they
 * were read. `at` is null for a restaurant's standing identities (no expiry). */
export type ShortlistSource = {
  lat: number;
  lng: number;
  at: string | null;
  /** Verbatim printed names, best-language-first per item (see constraint 2). */
  names: (string | null | undefined)[];
};

export type ShortlistOrigin = { lat: number; lng: number };

const distanceM = (a: ShortlistOrigin, b: { lat: number; lng: number }): number => {
  // Equirectangular, matching places.ts's haversineMeters to within centimetres
  // at these distances — inlined rather than imported because places.ts pulls
  // the Google client, and this runs on a path that must stay cheap.
  const dLat = (a.lat - b.lat) * 111_320;
  const dLng = (a.lng - b.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
};

/**
 * The verbatim names worth showing vision, from every source in range and in
 * date. Order is source order — callers pass identities before sessions so a
 * restaurant's settled vocabulary survives the cap first.
 *
 * `when` is when the PHOTO was taken (eaten_at, else now), not when it was
 * uploaded: an album backlog is rated weeks late by design, and dating the
 * window from upload time would mean the older the photo, the less likely its
 * own menu is in range — backwards.
 */
export function buildShortlist(
  sources: ShortlistSource[],
  origin: ShortlistOrigin,
  when: string | number | Date,
): string[] {
  const t = new Date(when).getTime();
  const windowMs = SHORTLIST_RECENCY_DAYS * 24 * 60 * 60 * 1000;

  const out: string[] = [];
  const seen = new Set<string>();

  for (const src of sources) {
    if (!Number.isFinite(src.lat) || !Number.isFinite(src.lng)) continue;
    if (distanceM(origin, src) > SHORTLIST_RADIUS_M) continue;
    if (src.at !== null) {
      const st = new Date(src.at).getTime();
      // An unparseable stamp fails CLOSED (drop the source) — the whole feature
      // degrades to today's behaviour rather than reaching for a stale menu.
      if (!Number.isFinite(st) || !Number.isFinite(t)) continue;
      if (Math.abs(t - st) > windowMs) continue;
    }
    for (const raw of src.names) {
      const name = typeof raw === 'string' ? raw.trim() : '';
      if (!name) continue;
      const key = compactDishName(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(name);
      if (out.length >= SHORTLIST_CAP) return out;
    }
  }
  return out;
}

/**
 * Did vision answer with one of the menu's own dishes? Returns that item's name
 * AS PRINTED, so cosmetic drift in the model's echo (a dropped 、, half-width
 * parens, stray spacing) still lands on the menu's exact words.
 *
 * EXACT-modulo-cosmetic only, never fuzzy. Fuzzy adoption is the failure this
 * whole area is most afraid of: a wrong name that arrived by matching wears the
 * menu's authority and reads as verified. The measured run produced one such
 * event out of 16 shortlisted cases (土魷蒸肉餅 → a neighbour's
 * 冬菇馬蹄蒸肉餅) even under strict matching, which is why the caller stamps
 * the adoption and the item's kill criterion stays armed. The same
 * exact-only reasoning is written out at length in ownerMenuExactMatch
 * (dishIdentity.ts) — this is that rule applied to a vision answer.
 */
export function findAdoptedName(visionZh: string | null | undefined, shortlist: string[]): string | null {
  const key = visionZh ? compactDishName(visionZh) : '';
  if (!key) return null;
  return shortlist.find(s => compactDishName(s) === key) ?? null;
}
