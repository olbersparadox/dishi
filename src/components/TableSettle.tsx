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
// options are a decision, not a checkout: no amounts are collected and no
// payment method is stored — including 大話骰, which decides a person, not a
// transfer.
//
// The game mounts INSIDE this chassis (see LiarsDice), never beside it: every
// state of 大話骰 is still this screen, with the bill collapsed to its total and
// the same chops above it. A separate game screen would have meant maintaining a
// second copy of the bill for people to argue with.
import { useState } from 'react';
import Link from 'next/link';
import Chop from '@/components/Chop';
import DishName from '@/components/DishName';
import LiarsDice from '@/components/LiarsDice';
import { useLang } from '@/lib/i18n';
import { sumPrices } from '@/lib/price';
import { equalSplit } from '@/lib/tableSettle';
import { ArrowRightIcon, DieIcon } from '@/components/icons';
import type { Die, Direction } from '@/lib/liarsDice';
import type { DiceGameView } from '@/lib/tableDice';
import type { Member } from '@/lib/useTableSession';

/** Only what a bill line needs. Structural on purpose: /scan and /table both
 *  feed this from the SESSION's item list (never a screen's own local one), so
 *  the two screens can't print different bills for the same table. */
export type SettleDish = {
  key: string; name: string; name_zh?: string | null;
  name_original?: string; price?: string | null;
};

export default function TableSettle({
  dishes, members, you, colorFor, payMethod, payerId, onChoose,
  game = null, onStartGame, onPickDirection, onCallBid, onOpenCups,
}: {
  /** The dishes with at least one stamp — the same live-merged list the cart bar
   *  counted, so the bill can never disagree with the bar that led to it. */
  dishes: SettleDish[];
  members: Member[];
  you: string | null;
  colorFor: (userId: string) => string;
  payMethod: 'equal' | 'random' | 'game' | null;
  payerId: string | null;
  onChoose: (method: 'equal' | 'random') => void;
  /** 大話骰, as this member may see it. Null until someone shakes the dice. */
  game?: DiceGameView | null;
  onStartGame?: () => void;
  onPickDirection?: (direction: Direction) => void;
  onCallBid?: (quantity: number, face: Die) => void;
  onOpenCups?: () => void;
}) {
  const { t } = useLang();
  // The reveal is dismissed per player, not per table: everyone lifts their cups
  // at the same moment but they read the result at their own pace, and the one
  // who taps first must not clear it off anybody else's screen.
  const [revealRead, setRevealRead] = useState(false);
  const price = sumPrices(dishes.map(d => d.price ?? null));
  const hasTotal = price.parsedCount > 0;
  const split = equalSplit(price.total, members.length);
  const payer = members.find(m => m.user_id === payerId);
  const money = (n: number) => `${price.currency}${Number.isInteger(n) ? n : n.toFixed(2)}`;

  const playing = payMethod === 'game' && !!game && !(game.reveal && revealRead);
  // Sitting down (dice shaken, direction not yet picked) still shows the three
  // ways — the table can see what it just chose. Once the bidding actually
  // starts there is no choice left to make, so they come off the screen.
  const started = playing && !!game?.direction;

  return (
    <div className="settle">
      <h1 style={{ margin: 0 }}>{t('table.settle.title')}</h1>
      <p className="card-meta" style={{ marginTop: 13, marginBottom: 14 }}>
        {t('table.settle.dishcount', { n: dishes.length })}
      </p>

      {/* The dishes, as a bill reads: name on the left, printed price hard right.
          Not DishListRow — that row is a MENU row (rank, pick target, stamps),
          and reusing it here would offer taps that no longer do anything.
          During the game the itemization collapses to the total alone: the
          stake is the only part of the bill anyone is looking at. */}
      <div className="card"><div className="card-body">
        {!playing && dishes.map(d => (
          <div key={d.key} className="settle-line">
            <DishName name={d.name} name_zh={d.name_zh} name_original={d.name_original} />
            <span className="settle-price">{d.price ?? '—'}</span>
          </div>
        ))}
        {hasTotal && (
          <div className="settle-total" style={playing ? { paddingTop: 0 } : undefined}>
            {/* The floor note is a flex sibling of the number, not a paragraph
                trailing under it, so the caveat top-aligns with the figure it
                qualifies instead of reading as a footnote to the whole card. */}
            {!price.complete && <p className="card-meta settle-note">{t('table.settle.partial')}</p>}
            <span className="settle-total-num">
              {price.currency}{price.total}{price.complete ? '' : '+'}
            </span>
          </div>
        )}
      </div></div>

      {/* Who is at the table. The same chop colours the stamps used on the menu,
          from the same one-assignment-per-session map, so nobody changes colour
          on the way to the bill. No names underneath: the colour and glyph ARE
          the identity here, and the label only repeated the roster.
          The halo ring means "this person, right now" — the random draw landing
          on someone, or whose turn it is in the game. */}
      <div className="settle-chops">
        {members.map(m => {
          const ringed = playing && !game?.reveal
            ? game?.currentTurnUserId === m.user_id
            : payMethod === 'random' && payerId === m.user_id;
          return (
            <div key={m.user_id} className="settle-chop">
              <span className={ringed ? 'is-ringed' : undefined}
                style={ringed ? { '--chop-ring': colorFor(m.user_id) } as React.CSSProperties : undefined}>
                <Chop name={m.display_name ?? m.handle} color={colorFor(m.user_id)} size={36} />
              </span>
            </div>
          );
        })}
      </div>

      {playing && game && (
        <LiarsDice
          game={game}
          you={you}
          members={members}
          colorFor={colorFor}
          onPickDirection={d => onPickDirection?.(d)}
          onCallBid={(q, f) => onCallBid?.(q, f)}
          onOpenCups={() => onOpenCups?.()}
          onDone={() => setRevealRead(true)}
        />
      )}

      {!started && (
        <>
          <p className="settle-how">{t('table.settle.how')}</p>
          <div className="settle-methods">
            <MethodCircle
              label={t('table.settle.equal')} chosen={payMethod === 'equal'}
              onClick={() => onChoose('equal')}
            >
              <span className="settle-method-sym">%</span>
            </MethodCircle>
            <MethodCircle
              label={t('table.settle.random')} chosen={payMethod === 'random'}
              onClick={() => onChoose('random')}
            >
              <span className="settle-method-sym">?</span>
            </MethodCircle>
            {/* Live now, not "coming soon": the ink halo says the game is running,
                which is a state of the table rather than of any one player. */}
            <MethodCircle
              label={t('table.settle.game')} chosen={payMethod === 'game'} live={playing}
              onClick={() => onStartGame?.()}
            >
              <DieIcon size={26} />
            </MethodCircle>
          </div>
        </>
      )}

      {!playing && payMethod === 'equal' && hasTotal && (
        <p className="settle-verdict">
          {t('table.settle.each', { amount: money(split.each) })}
        </p>
      )}
      {/* One line for both ways a single person ends up carrying it — drawn at
          random, or having lost the round. The bill says who pays; it never says
          how they were chosen, because the screen it came from already did. */}
      {!playing && (payMethod === 'random' || payMethod === 'game') && payer && (
        <p className="settle-verdict">
          {payer.user_id === you
            ? t('table.settle.payeryou')
            : t('table.settle.payer', { name: payer.display_name ?? payer.handle })}
        </p>
      )}

      {/* The way onward is still the rating queue: the bill is the end of the
          meal, not the end of the point of the app. Held back mid-game — there
          is nothing to rate until the table knows who is paying. */}
      {!started && (
        <div className="cart-bar">
          <Link href="/profile#to-rate" className="btn primary cart-btn">
            <span>{t('table.settle.torate')}</span>
            <span className="cart-bar-end"><ArrowRightIcon /></span>
          </Link>
        </div>
      )}
    </div>
  );
}

/** One of the three ways to carry the bill: a 60px ink disc with a glyph, the
 *  word underneath. All three stay ink — the chosen one gains a paper ring
 *  rather than a colour, since colour here belongs to people. */
function MethodCircle({ label, chosen, live, onClick, children }: {
  label: string; chosen: boolean; live?: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <div className="settle-method-wrap">
      <button
        className={`settle-method ${chosen ? 'is-chosen' : ''} ${live ? 'is-live' : ''}`}
        onClick={onClick} aria-label={label} title={label}
      >
        <span className="settle-method-glyph">{children}</span>
      </button>
      <span className="settle-method-cap">{label}</span>
    </div>
  );
}
