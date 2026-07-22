'use client';
// The SHARED side-anatomy of a two-dish comparison card — extracted from the
// 對決 card so the identity-confirm card (係咪同一味？) mounts the SAME photo /
// name / location content instead of a lookalike (the repo's "reuse, don't
// imitate" rule). What each card wraps AROUND a side stays its own: duels wrap
// it in a tappable button (tapping means "I prefer this"); the identity card
// deliberately wraps it in a static div — identical tap affordances there
// would let duel muscle memory merge two dishes by accident.
import { useLang, type LangPair } from '@/lib/i18n';
import DishName from './DishName';
import { pickDistrict, type DistrictMap } from '@/lib/district';

export type DuelDish = {
  id: string; name: string; name_zh: string | null; photo_url: string | null;
  restaurant: string | null; restaurant_district?: DistrictMap | null; district?: DistrictMap | null;
};

// Both comparison cards always read 中文 primary / English secondary, regardless
// of the person's global language-pair setting elsewhere in the app — a
// deliberate, stable pairing for side-by-side dish comparison (per design
// direction), not the user's general display preference.
export const ZH_PRIMARY_PAIR: LangPair = { primary: 'zh', secondary: 'en' };

// Same "restaurant • district" convention as the Eat Journal (MyDishes.locationLabel):
// the restaurant's own district when there's a restaurant, else the dish's own logged
// district. Returns null when there's nothing to show — the caller renders nothing.
export function duelLocation(d: DuelDish, lang: 'zh' | 'en'): string | null {
  if (d.restaurant) {
    const area = pickDistrict(d.restaurant_district, lang);
    return d.restaurant + (area ? ` • ${area}` : '');
  }
  return pickDistrict(d.district, lang);
}

/** The inner content of one side: photo (or blank block), the zh-pinned
 * dish-name treatment, and the location line. */
export default function DuelSide({ dish }: { dish: DuelDish }) {
  const { lang } = useLang();
  const location = duelLocation(dish, lang);
  return (
    <>
      {dish.photo_url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={dish.photo_url} alt="" className="duel-photo" />
        : <div className="duel-photo duel-photo-blank" aria-hidden />}
      {/* card-title: the exact journal/scan dish-name treatment (serif primary +
          small secondary), pinned to 中文/English regardless of the global pair. */}
      <div className="card-title"><DishName name={dish.name} name_zh={dish.name_zh} pair={ZH_PRIMARY_PAIR} /></div>
      {location && <div className="duel-option-rest">{location}</div>}
    </>
  );
}
