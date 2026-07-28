'use client';
// The SHARED side-anatomy of a two-dish comparison card — extracted from the
// 對決 card so the identity-confirm card (係咪同一味？) mounts the SAME photo /
// name / location content instead of a lookalike (the repo's "reuse, don't
// imitate" rule). What each card wraps AROUND a side stays its own: duels wrap
// it in a tappable button (tapping means "I prefer this"); the identity card
// deliberately wraps it in a static div — identical tap affordances there
// would let duel muscle memory merge two dishes by accident.
import { useEffect, useRef } from 'react';
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

// Two comparison cards side by side leaves each name column narrow, so a long
// primary name (中文, per ZH_PRIMARY_PAIR) can wrap to 3+ lines — measured live,
// 三文魚卵及海膽軍艦壽司 (11 characters) hits 3 at the base --fs-title-a size.
// Clamped to 2 lines by SHRINKING the font (never truncating — the whole name
// must still read), stepping down 1px at a time from the CSS default until the
// rendered height fits, or a floor is hit. Content-length-aware, so it can't be
// done with pure CSS (clamp() only reacts to viewport, not string length).
function useShrinkPrimaryToFit(ref: React.RefObject<HTMLElement>, maxLines: number, dep: unknown) {
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('.dishname-primary');
    if (!el) return;
    el.style.fontSize = ''; // reset to the CSS default before re-measuring
    const cs = getComputedStyle(el);
    const lineHeight = parseFloat(cs.lineHeight);
    if (!lineHeight) return; // 'normal' or unparseable — skip rather than guess
    const maxHeight = lineHeight * maxLines + 1; // +1px rounding slack
    let size = parseFloat(cs.fontSize);
    let guard = 0; // hard stop — never spin on a layout that won't settle
    while (el.scrollHeight > maxHeight && size > 14 && guard < 10) {
      size -= 1;
      el.style.fontSize = `${size}px`;
      guard++;
    }
  }, [dep, maxLines]);
}

/** The inner content of one side: photo (or blank block), the dish-name
 * treatment, and the location line.
 *
 * `pair` defaults to the duel's own forced zh-primary (ZH_PRIMARY_PAIR) — that
 * pinning is specific to SIDE-BY-SIDE comparison (per DuelSide's own header
 * comment) and every existing caller (DuelOverlay, IdentityConfirmCard) relies
 * on it, so the default is unchanged. A single-dish card with no comparison to
 * anchor (a feed post, a public-page anchor) has no reason to override the
 * viewer's own language pair, so those callers pass the chrome pair through. */
export default function DuelSide({ dish, pair = ZH_PRIMARY_PAIR, afterPhoto }: {
  dish: DuelDish; pair?: LangPair;
  /** Optional content between the photo and the dish name — the feed post
   * card's author row (chop + dishi.username + verdict) is the only current
   * user. Duel/identity-confirm callers pass nothing, so their anatomy is
   * byte-for-byte unchanged. */
  afterPhoto?: React.ReactNode;
}) {
  const { lang } = useLang();
  const location = duelLocation(dish, lang);
  const titleRef = useRef<HTMLDivElement>(null);
  useShrinkPrimaryToFit(titleRef, 2, dish.name_zh ?? dish.name);
  return (
    <>
      {dish.photo_url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={dish.photo_url} alt="" className="duel-photo" />
        : <div className="duel-photo duel-photo-blank" aria-hidden />}
      {afterPhoto}
      {/* card-title: the exact journal/scan dish-name treatment (serif primary +
          small secondary). */}
      <div className="card-title" ref={titleRef}><DishName name={dish.name} name_zh={dish.name_zh} pair={pair} /></div>
      {location && <div className="duel-option-rest">{location}</div>}
    </>
  );
}
