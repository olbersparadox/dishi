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
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Chop from '@/components/Chop';
import DishName from '@/components/DishName';
import LiarsDice from '@/components/LiarsDice';
import { useLang } from '@/lib/i18n';
import { sumPrices } from '@/lib/price';
import { equalSplit } from '@/lib/tableSettle';
import { buildSpin, spinIndexAt, revealLineKey, SPIN_MS } from '@/lib/spinReveal';
import { ArrowRightIcon, DieIcon } from '@/components/icons';
import type { Die, Direction } from '@/lib/liarsDice';
import type { DiceGameView } from '@/lib/tableDice';
import type { Member } from '@/lib/useTableSession';
import { memberName } from '@/lib/memberName';

/** Only what a bill line needs. Structural on purpose: /scan and /table both
 *  feed this from the SESSION's item list (never a screen's own local one), so
 *  the two screens can't print different bills for the same table. */
export type SettleDish = {
  key: string; name: string; name_zh?: string | null;
  name_original?: string; price?: string | null;
};

export default function TableSettle({
  dishes, members, you, colorFor, payMethod, payerId, onChoose, sessionId = null,
  payDrawCount = 0, game = null, onStartGame, onPickDirection, onCallBid, onOpenCups,
  dicePending = false,
}: {
  /** The dishes with at least one stamp — the same live-merged list the cart bar
   *  counted, so the bill can never disagree with the bar that led to it. */
  dishes: SettleDish[];
  members: Member[];
  you: string | null;
  colorFor: (userId: string) => string;
  payMethod: 'equal' | 'random' | 'game' | null;
  payerId: string | null;
  /** Which draw this is, from the session — so the reveal line is the same one on
   *  every phone at the table. */
  payDrawCount?: number;
  onChoose: (method: 'equal' | 'random') => void;
  /** Seeds the 隨機一人 spin so every phone at the table runs the identical one.
   *  Null only where a screen genuinely has no session yet — the ring then just
   *  appears on the payer, which is the pre-animation behaviour. */
  sessionId?: string | null;
  /** 大話骰, as this member may see it. Null until someone shakes the dice. */
  game?: DiceGameView | null;
  onStartGame?: () => void;
  onPickDirection?: (direction: Direction) => void;
  onCallBid?: (quantity: number, face: Die) => void;
  onOpenCups?: () => void;
  /** A 大話骰 move is in flight — the circle that started it says so. */
  dicePending?: boolean;
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

  // Non-null only while the draw is being revealed, and it outranks the settled
  // ring below so the two can never both show.
  const spinUserId = useSpinReveal(members, payMethod, payerId, payDrawCount, sessionId);
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
            {/* The caveat is a flex sibling of the number, not a paragraph trailing
                under it, so it top-aligns with the figure it qualifies instead of
                reading as a footnote to the whole card.

                EVERY total carries one (owner, 2026-08-01), not just the ones missing
                a price. A fully-priced bill is still short the 10% and whatever else
                the shop adds, and a bare figure on a bill nobody has seen yet reads as
                exact. Which caveat depends on what is actually wrong with it: missing
                prices make the total a FLOOR, complete ones make it an ESTIMATE. */}
            <p className="card-meta settle-note">
              {t(price.complete ? 'table.settle.estimate' : 'table.settle.partial')}
            </p>
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
          const ringed = spinUserId
            ? spinUserId === m.user_id
            : playing && !game?.reveal
              ? game?.currentTurnUserId === m.user_id
              : payMethod === 'random' && payerId === m.user_id;
          return (
            <div key={m.user_id} className="settle-chop">
              <span className={ringed ? 'is-ringed' : undefined}
                style={ringed ? { '--chop-ring': colorFor(m.user_id) } as React.CSSProperties : undefined}>
                <Chop name={memberName(m)} color={colorFor(m.user_id)} size={36} />
              </span>
            </div>
          );
        })}
      </div>

      {/* The draw's answer, under the chops it just travelled (owner, 2026-07-31).
          Held back while the ring is still moving — printing the line mid-spin
          would answer the question the spin is in the middle of asking.

          ONE line, and always the profile name rather than a you-form (owner,
          2026-08-01): the late rungs stop naming a payer altogether, so the line
          has to be free to be about the table or about the app. See revealLineKey.

          The slot is ALWAYS here while the three ways are on screen, empty or not,
          and it is sized to sit inside the gap that was already above 邊個埋單 —
          so the question and its three buttons hold their position whatever this
          says (owner, 2026-07-31). Otherwise they were shoved down when the ring
          stopped. Same reasoning as the blank line reserved under every chop. */}
      {!playing && (
        <div className="settle-reveal">
          {payMethod === 'random' && payer && !spinUserId && (
            <FitLine>
              {t(revealLineKey(payDrawCount), { name: memberName(payer) })}
            </FitLine>
          )}
          {/* 大話骰's answer, in the same slot as the other two (owner, 2026-08-01).
              It used to sit BELOW the three circles, which left a hole in this slot
              and an orphan sentence under the buttons — it read as residue from a
              screen that had moved on, because that is what it was. The game names
              its loser inside 開盅; this is the line that outlives the reveal, so the
              table can still see who is carrying it after the cups are cleared. */}
          {payMethod === 'game' && payer && payer.user_id === game?.reveal?.loserId && (
            <FitLine>
              {payer.user_id === you
                ? t('table.settle.payeryou')
                : t('table.settle.payer', { name: memberName(payer) })}
            </FitLine>
          )}
          {/* An equal split's answer belongs in the SAME slot, not under each chop
              where it used to sit (owner, 2026-08-01) — so the two methods answer in
              one place and switching between them moves nothing. Silent without a
              total: there is no per-head figure to state, and inventing one from a
              partial bill would be the one number here someone actually pays on. */}
          {payMethod === 'equal' && hasTotal && (
            <FitLine>
              {/* One face for the whole line (owner, 2026-08-01). The figure briefly
                  wore the menu's lighter price face, which was solving a problem this
                  rule dissolves: it read wrong because the line was SERIF, and the line
                  is not serif any more. With no span to wrap there is no sentinel split
                  either — the dict places the figure, the sentence is interpolated.

                  The "+" is the one the total above carries: a bill with unpriced
                  dishes divides into a per-head FLOOR, and this is the figure people
                  actually hand money over on. */}
              {t('table.settle.eachhead', {
                amount: `${money(split.each)}${price.complete ? '' : '+'}`,
              })}
            </FitLine>
          )}
        </div>
      )}

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
          dicePending={dicePending}
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
              // Only until the game appears: once LiarsDice is mounted its own
              // buttons carry the waiting, and this circle is just the indicator.
              busy={dicePending && !playing}
              onClick={() => onStartGame?.()}
            >
              <DieIcon size={26} />
            </MethodCircle>
          </div>
        </>
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

/**
 * Runs the 隨機一人 spin and reports which member should wear the ring right now,
 * or null when nothing is spinning.
 *
 * Starts only on the TRANSITION into a random payer, never on arriving at a table
 * that already has one: replaying a 5-second draw on every page load would be
 * tedious, and worse, would read as the answer being drawn again each time when it
 * is in fact fixed. So a fresh mount shows the ring outright and only a live
 * decision animates.
 *
 * Ends by returning null, at which point the caller's plain payer ring takes over.
 * That handoff is invisible because buildSpin's last tick has already arrived on
 * the payer — the override is dropped, not moved.
 */
function useSpinReveal(
  members: Member[], payMethod: string | null, payerId: string | null,
  drawCount: number, sessionId: string | null,
): string | null {
  const [spinUserId, setSpinUserId] = useState<string | null>(null);
  /** undefined = haven't looked yet. Distinguishes "arrived with a payer" (don't
   *  animate) from "a draw just happened" (animate).
   *
   *  Keyed on the DRAW, not on who won it. Keying on the payer meant a re-draw that
   *  happened to land on the same person animated nothing at all — the table tapped
   *  隨機 and the same name just sat there, which reads as broken and, worse, as
   *  rigged. That is a coin flip at a table of two. The payer is in the key as well,
   *  so the rare case of the server disagreeing with the optimistic draw restarts
   *  the spin rather than letting it land on the wrong chop. */
  const seenRef = useRef<string | null | undefined>(undefined);
  // The roster and session are read through refs, and are deliberately NOT effect
  // dependencies. The 5s poll hands down a fresh members array on every cycle, so
  // depending on it would let React tear this effect down mid-spin — cleanup would
  // cancel the frame loop and the ring would stall a second or two in. Freezing the
  // roster at the moment the spin starts is also correct on its own terms: someone
  // joining mid-spin must not renumber the seats the wheel is already travelling.
  const membersRef = useRef(members); membersRef.current = members;
  const sessionRef = useRef(sessionId); sessionRef.current = sessionId;

  useEffect(() => {
    const drawKey = payMethod === 'random' && payerId ? `${drawCount}:${payerId}` : null;
    if (seenRef.current === undefined) { seenRef.current = drawKey; return; }
    if (drawKey === seenRef.current) return;
    seenRef.current = drawKey;
    if (!drawKey || !payerId) { setSpinUserId(null); return; }

    const roster = membersRef.current;
    const sid = sessionRef.current;
    const target = roster.findIndex(m => m.user_id === payerId);
    const reduced = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!sid || reduced) { setSpinUserId(null); return; }

    // Seed carries the draw, so the same table never replays the same wheel — the
    // pixel-identical second spin is what made a re-roll look predetermined.
    const spin = buildSpin(roster.length, target, `${sid}:${drawCount}`);
    if (!spin.ticks.length) { setSpinUserId(null); return; }

    // The ring takes its starting seat SYNCHRONOUSLY, not on the first frame. Two
    // reasons: the tap should register instantly like every other control here, and
    // until spinUserId is non-null the previous draw's reveal is still on screen —
    // so waiting for a frame left the old name sitting under the chops while the
    // new draw was already under way (visibly so on a throttled or hidden page).
    const startedAt = performance.now();
    setSpinUserId(roster[spin.startIndex]?.user_id ?? null);
    let raf = 0;
    const frame = () => {
      const elapsed = performance.now() - startedAt;
      if (elapsed >= SPIN_MS) { setSpinUserId(null); return; }
      setSpinUserId(roster[spinIndexAt(spin, roster.length, elapsed)]?.user_id ?? null);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    // rAF is the animation, but it must not be the only way this ENDS. Browsers
    // throttle or pause frames on a hidden page, and while the spin is unfinished
    // the reveal underneath is suppressed — so a phone put face-down mid-draw could
    // come back to a ring that never resolved and a bill that never named anyone.
    // A plain timer guarantees the landing regardless of frames (it fires late on a
    // hidden page, which is harmless: the destination is fixed either way).
    const end = setTimeout(() => setSpinUserId(null), SPIN_MS + 40);
    return () => { cancelAnimationFrame(raf); clearTimeout(end); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payMethod, payerId, drawCount]);

  return spinUserId;
}

/** How far the answer may shrink: --fs-body over the line's own --fs-subtitle-b. Past
 *  that the type is smaller than the caption above it, and a wrap would have cost less
 *  than the type going quiet does. */
const MIN_FIT = 15 / 20;

/**
 * The bill's answer, held to ONE line (owner, 2026-08-01).
 *
 * The long rungs wrap at 23px once a real name is in them (不如算吧啦 Priya Raman
 * 請唔請呀 went to two), and a wrapped answer reads as a paragraph where every other
 * way of landing the bill reads as a statement. So the TYPE gives way rather than the
 * line breaking: it is scaled down only as far as it has to go, and never up past 1.
 *
 * Measured off the rendered box instead of a hidden clone, which means reading a width
 * that already has the previous scale baked in — hence dividing it back out. That also
 * makes it self-correcting: a shorter name next round measures narrower, and the line
 * grows back to full size on its own.
 */
function FitLine({ children }: { children: React.ReactNode }) {
  const [el, setEl] = useState<HTMLParagraphElement | null>(null);
  const [fit, setFit] = useState(1);
  useEffect(() => {
    if (!el) return;
    const measure = () => setFit(prev => {
      const avail = el.clientWidth;
      if (!avail) return prev;
      // scrollWidth is the text at `prev`; font-size scales it linearly.
      const atFull = el.scrollWidth / prev;
      const next = Math.round(Math.min(1, Math.max(MIN_FIT, avail / atFull)) * 1000) / 1000;
      // Settling exactly is what stops this from oscillating render to render.
      return next === prev ? prev : next;
    });
    measure();
    // Rotation and the keyboard change the card's width under a line already fitted.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el, children]);
  return (
    <p ref={setEl} className="settle-verdict settle-reveal-name"
      style={{ '--fit': fit } as React.CSSProperties}>{children}</p>
  );
}

/** One of the three ways to carry the bill: a 60px ink disc with a glyph, the
 *  word underneath. All three stay ink — the chosen one gains a paper ring
 *  rather than a colour, since colour here belongs to people. */
function MethodCircle({ label, chosen, live, busy, onClick, children }: {
  label: string; chosen: boolean; live?: boolean; busy?: boolean;
  onClick: () => void; children: React.ReactNode;
}) {
  return (
    <div className="settle-method-wrap">
      <button
        className={`settle-method ${chosen ? 'is-chosen' : ''} ${live ? 'is-live' : ''}`}
        onClick={onClick} aria-label={label} title={label} disabled={busy}
      >
        <span className="settle-method-glyph">
          {busy ? <span className="icon-btn-spinner dice-btn-spinner" aria-hidden /> : children}
        </span>
      </button>
      <span className="settle-method-cap">{label}</span>
    </div>
  );
}
