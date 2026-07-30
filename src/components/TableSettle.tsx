'use client';
// The bill. What the table picked, what it costs, who is at it, and how the
// money gets carried.
//
// This screen replaces the picking list rather than sitting on top of it: once
// everyone has tapped done, the menu is not the thing anyone is looking at any
// more. It is reached only through the handshake (settled_at), so there is no
// state here where one member sees a bill and another still sees dishes to tap.
//
// Nothing here moves money. Dishi decides WHO pays and prints the number; the
// paying happens at the counter the way it always has. That is also why the
// options are a decision, not a checkout: no amounts are collected, no payment
// method is stored, and the 大話骰 button says what it is rather than pretending.
import Link from 'next/link';
import Chop from '@/components/Chop';
import DishName from '@/components/DishName';
import { useLang } from '@/lib/i18n';
import { sumPrices } from '@/lib/price';
import { equalSplit } from '@/lib/tableSettle';
import { ArrowRightIcon } from '@/components/icons';
import type { Member } from '@/lib/useTableSession';

/** Only what a bill line needs. Structural on purpose: /scan and /table both
 *  feed this from the SESSION's item list (never a screen's own local one), so
 *  the two screens can't print different bills for the same table. */
export type SettleDish = {
  key: string; name: string; name_zh?: string | null;
  name_original?: string; price?: string | null;
};

export default function TableSettle({ dishes, members, you, colorFor, payMethod, payerId, onChoose }: {
  /** The dishes with at least one stamp — the same live-merged list the cart bar
   *  counted, so the bill can never disagree with the bar that led to it. */
  dishes: SettleDish[];
  members: Member[];
  you: string | null;
  colorFor: (userId: string) => string;
  payMethod: 'equal' | 'random' | 'game' | null;
  payerId: string | null;
  onChoose: (method: 'equal' | 'random') => void;
}) {
  const { t } = useLang();
  const price = sumPrices(dishes.map(d => d.price ?? null));
  const hasTotal = price.parsedCount > 0;
  const split = equalSplit(price.total, members.length);
  const payer = members.find(m => m.user_id === payerId);
  const money = (n: number) => `${price.currency}${Number.isInteger(n) ? n : n.toFixed(2)}`;

  return (
    <div className="settle">
      <h1 style={{ margin: 0 }}>{t('table.settle.title')}</h1>
      <p className="card-meta" style={{ marginTop: 13, marginBottom: 14 }}>
        {t('table.settle.dishcount', { n: dishes.length })}
      </p>

      {/* The dishes, as a bill reads: name on the left, printed price hard right.
          Not DishListRow — that row is a MENU row (rank, pick target, stamps),
          and reusing it here would offer taps that no longer do anything. */}
      <div className="card"><div className="card-body">
        {dishes.map(d => (
          <div key={d.key} className="settle-line">
            <DishName name={d.name} name_zh={d.name_zh} name_original={d.name_original} />
            <span className="settle-price">{d.price ?? '—'}</span>
          </div>
        ))}
        {hasTotal && (
          <div className="settle-total">
            <span>{t('table.settle.total')}</span>
            <span className="settle-total-num">
              {price.currency}{price.total}{price.complete ? '' : '+'}
            </span>
          </div>
        )}
        {hasTotal && !price.complete && (
          <p className="card-meta settle-note">{t('table.settle.partial')}</p>
        )}
      </div></div>

      {/* Who is at the table. The same chop colours the stamps used on the menu,
          from the same one-assignment-per-session map, so nobody changes colour
          on the way to the bill. */}
      <div className="settle-chops">
        {members.map(m => (
          <div key={m.user_id} className="settle-chop">
            <Chop name={m.display_name ?? m.handle} color={colorFor(m.user_id)} size={36} />
            <span className="settle-chop-name">{m.display_name ?? m.handle}</span>
          </div>
        ))}
      </div>

      <p className="settle-how">{t('table.settle.how')}</p>
      <div className="settle-methods">
        <button
          className={`btn ghost settle-method ${payMethod === 'equal' ? 'is-chosen' : ''}`}
          onClick={() => onChoose('equal')}
        >
          {t('table.settle.equal')}
        </button>
        <button
          className={`btn ghost settle-method ${payMethod === 'random' ? 'is-chosen' : ''}`}
          onClick={() => onChoose('random')}
        >
          {t('table.settle.random')}
        </button>
        {/* Named, not hidden: the table should know the game is the third way to
            settle this, and a button that lied about being ready would settle a
            real bill on a roll nobody saw. */}
        <button className="btn ghost settle-method is-disabled" disabled>
          <span>{t('table.settle.game')}</span>
          <span className="settle-method-sub">{t('table.settle.soon')}</span>
        </button>
      </div>

      {payMethod === 'equal' && hasTotal && (
        <p className="settle-verdict">
          {t('table.settle.each', { amount: money(split.each) })}
        </p>
      )}
      {payMethod === 'random' && payer && (
        <p className="settle-verdict">
          {payer.user_id === you
            ? t('table.settle.payeryou')
            : t('table.settle.payer', { name: payer.display_name ?? payer.handle })}
        </p>
      )}

      {/* The way onward is still the rating queue: the bill is the end of the
          meal, not the end of the point of the app. */}
      <div className="cart-bar">
        <Link href="/profile#to-rate" className="btn primary cart-btn">
          <span>{t('table.settle.torate')}</span>
          <span className="cart-bar-end"><ArrowRightIcon /></span>
        </Link>
      </div>
    </div>
  );
}
