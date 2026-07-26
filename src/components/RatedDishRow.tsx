'use client';
// One row of 已評嘅菜 (the flat, no-photo reference list under the 味 AI export
// card): the dish's canonical name, where it was eaten, the verdict — and, when
// the engine called this dish in advance, the broken seal stamped on the name.
//
// Extracted from profile/page.tsx so the row is one thing that can be mounted
// (and screenshotted) as itself rather than re-created wherever it's needed.
import DishName from '@/components/DishName';
import SealRevealBadge, { type SealResult } from '@/components/SealRevealBadge';

export default function RatedDishRow({ id, name, name_zh, restaurant, verdict, seal }: {
  id: string;
  /** Already resolved by the caller to the IDENTITY name when the dish has one —
   * a dish rated twice under linked names shows once, under its canonical name. */
  name: string;
  name_zh: string | null;
  restaurant: string | null;
  verdict: string;
  /** Always a DECIDED verdict: /api/my/dishes filters on revealed_at, so a
   * pending prediction can't reach this row. */
  seal?: SealResult | null;
}) {
  return (
    <div className="rated-flat-row">
      <div style={{ minWidth: 0 }}>
        <div className="card-title">
          {/* The broken seal rides the NAME (DishName's suffix slot) — the same
              slot the pending 印 uses on a 待評 pick — so one dish reads as one
              object through the whole arc: sealed, then opened. No streak: it's
              a running count that ended at whatever the newest rating was, and
              restating it on an old dish would claim a run that isn't this row's. */}
          <DishName id={id} name={name} name_zh={name_zh}
            suffix={seal ? <SealRevealBadge seal={seal} size="inline" showStreak={false} /> : undefined} />
        </div>
        {restaurant && <div className="rated-flat-meta">{restaurant}</div>}
      </div>
      <div className="rated-flat-verdict">{verdict}</div>
    </div>
  );
}
