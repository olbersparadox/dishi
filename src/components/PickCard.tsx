'use client';
// One row of 待評菜式 — a dish picked off a menu scan or during a shared table,
// waiting to be rated.
//
// Extracted from profile/page.tsx when a shared table's dishes started reaching
// everyone who ate them (owner decision, field session 2026-08-03): the row grew
// three separate "is this row mine?" conditionals, and three-way conditional
// markup buried inside a 700-line page is where quiet regressions live. It also
// makes the row mountable on its own, so the table-mate case can be verified as
// pixels and pinned by tests instead of asserted.
import DishName from '@/components/DishName';
import PickCardThumb from '@/components/PickCardThumb';
import SealStamp from '@/components/SealStamp';
import { RateIcon, TrashIcon } from '@/components/icons';
import { useLang } from '@/lib/i18n';

export type PickCardDish = {
  id: string;
  name: string; name_zh: string | null;
  source: string;
  restaurant: string | null;
  photo_url: string | null;
  /** False when a TABLE-MATE owns this dish row and we only ate the food. */
  mine?: boolean;
  /** Their name, when the row isn't ours. */
  picked_by?: string | null;
};

export default function PickCard({ dish, sealed, uploading, onAddPhoto, onRate, onDelete }: {
  dish: PickCardDish;
  sealed: boolean;
  uploading: boolean;
  onAddPhoto: (file: File | null) => void;
  onRate: () => void;
  onDelete: () => void;
}) {
  const { t } = useLang();
  // One reading of ownership for the whole row. Undefined means "mine" — every
  // caller that predates shared tables sends rows without the flag.
  const theirs = dish.mine === false;

  return (
    <div className="pick-card">
      {/* A photo attaches to the DISH ROW, which a table-mate owns — the dishes
          update policy is auth.uid() = user_id, so the slot must not invite a
          write the database refuses. */}
      <PickCardThumb photoUrl={dish.photo_url} uploading={uploading}
        onPick={theirs ? undefined : onAddPhoto} />

      <div className="pick-card-info">
        <div className="pick-card-name">
          <DishName id={dish.id} name={dish.name} name_zh={dish.name_zh}
            suffix={sealed && <SealStamp />} />
        </div>
        {/* 住家菜 is a claim about how a dish was COOKED, and it was standing in
            for every dish whose restaurant never resolved — including menu picks,
            where the table gate deliberately refuses to guess between neighbours
            (field-caught 2026-08-03). Unknown is now said as unknown, in the words
            the table bar already uses for it. */}
        <div className="pick-card-meta">
          {dish.restaurant ?? t(dish.source === 'home' ? 'home.homecooking' : 'table.restaurant.unset')}
          {dish.picked_by && ` · ${t('log.pickedby', { name: dish.picked_by })}`}
        </div>
      </div>

      <div className="pick-card-actions">
        {/* Same flick → growth flow as an album batch (it used to bounce out to the
            old single-dish /log page). Nothing is created here, so the session can
            never delete this pick — see RatingStack.picksMode. */}
        <button className="icon-btn lg rate" onClick={onRate}
          aria-label={t('log.rateNow')} title={t('log.rateNow')}>
          <RateIcon size={20} />
        </button>
        {/* Delete exists because a pick you no longer want was once stuck in this
            queue forever with no way out but rating it — which would have taught
            the engine from a dish you never ate. Never on a table-mate's row
            though: that would be deleting THEIR logged dish. Skipping a dish you
            didn't order is simply not rating it. */}
        {!theirs && (
          <button className="icon-btn lg delete" onClick={onDelete}
            aria-label={t('home.delete')} title={t('home.delete')}>
            <TrashIcon size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
