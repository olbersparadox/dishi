// A district in the viewer's language, English-falling-back (works for any country:
// a place with no zh name stored zh=en, so zh viewers see English). Shared by the
// Eat Journal (MyDishes) and the duel card — both show "where the food is" the
// same way: restaurant's own district when there's a restaurant, else the dish's
// own logged district.
export type DistrictMap = { zh?: string | null; en?: string | null };

export function pickDistrict(m: DistrictMap | null | undefined, lang: 'zh' | 'en'): string | null {
  if (!m) return null;
  return m[lang] || m.en || m.zh || null;
}
