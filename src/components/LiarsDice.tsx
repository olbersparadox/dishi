'use client';
// 大話骰, as the table plays it. Mounted INSIDE TableSettle's own chassis — the
// bill card, the chops, this block — because every state of the game is still
// the settle screen. It is the third way the bill gets carried, not a place you
// go instead of the bill.
//
// One component for every state (sit down, open, bid, wait, reveal) rather than
// five screens: the parts that stay put — your own five dice, the chops above,
// the total above them — are the point. A player watching someone else decide is
// looking at the SAME screen they will act on, with their own controls faded out
// but still occupying their space, so nothing jumps when the turn comes round.
//
// It holds no dice of its own. Everything here comes from the server's
// viewForUser (see tableDice.ts), which before 開 gives this player their own
// hand and nobody else's.
import { useEffect, useState } from 'react';
import Chop from '@/components/Chop';
import SansNum from '@/components/SansNum';
import { CheckIcon, DieFaceIcon, ArrowLeftIcon, ArrowRightIcon } from '@/components/icons';
import { useLang } from '@/lib/i18n';
import { DICE_PER_PLAYER, type Die, type Direction } from '@/lib/liarsDice';
import {
  standingBidOf, minimumRaise, openingQuantity, favouriteFace, type DiceGameView,
} from '@/lib/tableDice';
import type { Member } from '@/lib/useTableSession';

const FACES: Die[] = [1, 2, 3, 4, 5, 6];

export default function LiarsDice({ game, you, members, colorFor, onPickDirection, onCallBid, onOpenCups, onDone }: {
  game: DiceGameView;
  you: string | null;
  members: Member[];
  colorFor: (userId: string) => string;
  onPickDirection: (direction: Direction) => void;
  onCallBid: (quantity: number, face: Die) => void;
  onOpenCups: () => void;
  /** The reveal's continue — back to the bill, now with a name on it. */
  onDone: () => void;
}) {
  const { t } = useLang();
  const nameOf = (userId: string) => {
    const m = members.find(x => x.user_id === userId);
    return m?.display_name ?? m?.handle ?? '…';
  };
  const faceWord = (face: Die) => t(`table.dice.face.${face}`);
  const callText = (quantity: number, face: Die) =>
    t('table.dice.call', { n: quantity, face: faceWord(face) });

  const standing = standingBidOf(game.bids);
  const totalDice = game.order.length * DICE_PER_PLAYER;
  const myTurn = !!you && game.currentTurnUserId === you;

  // The composer's own state. Seeded at the smallest legal raise (or, opening,
  // at the count you'd expect a face to hit across the table and the face you
  // actually hold most of — your own dice, so nothing private moves anywhere).
  const [quantity, setQuantity] = useState(1);
  const [face, setFace] = useState<Die>(4);
  const standingKey = standing ? `${standing.quantity}-${standing.face}` : '';
  useEffect(() => {
    if (standing) {
      const next = minimumRaise(standing);
      setQuantity(next.quantity);
      setFace(next.face);
    } else {
      setQuantity(openingQuantity(totalDice));
      setFace(favouriteFace(game.yourDice));
    }
    // Re-seeded when the bid to beat changes, so a stale (now illegal) call is
    // never sitting under the confirm button waiting to be tapped.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standingKey, totalDice]);

  const legal = !standing
    ? quantity >= 1 && quantity <= totalDice
    : quantity > standing.quantity || (quantity === standing.quantity && face > standing.face);
  // 開 is open to anyone at the table, in turn or not — except whoever made the
  // call being challenged. Mirrors canChallenge() on the server, which is what
  // actually decides; this only governs whether the button is offered.
  const canOpen = !!standing && !!you && standing.user_id !== you;

  const yourColor = you ? colorFor(you) : 'var(--line)';

  // ---- 開盅 ----
  if (game.reveal) {
    const r = game.reveal;
    // Named only when 開 cut in on someone else's turn — which is allowed, and
    // is the part of the story people argue about afterwards.
    const interrupted = game.currentTurnUserId
      && game.currentTurnUserId !== r.challengerId
      && game.currentTurnUserId !== r.bidderId;
    return (
      <>
        <div className="reveal-grid">
          {game.order.map(userId => (
            <div key={userId} className="my-dice reveal-box" style={{ borderColor: colorFor(userId) }}>
              <div className="my-dice-row">
                {(r.rolls[userId] ?? []).map((value, i) => (
                  <DieFaceIcon key={i} value={value} size={56} filled
                    dimmed={!(r.masks[userId] ?? [])[i]} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="reveal-count">
          <p className="reveal-count-line">
            {interrupted
              ? t('table.dice.revealcut', {
                bidder: nameOf(r.bidderId), call: callText(r.bid.quantity, r.bid.face),
                waiting: nameOf(game.currentTurnUserId!), challenger: nameOf(r.challengerId),
              })
              : t('table.dice.revealline', {
                bidder: nameOf(r.bidderId), call: callText(r.bid.quantity, r.bid.face),
                challenger: nameOf(r.challengerId),
              })}
          </p>
          <div className="reveal-count-num-row">
            <span className="reveal-count-num">
              {t('table.dice.total', { n: r.actual, face: faceWord(r.bid.face) })}
            </span>
            <span className="reveal-count-chop">
              <Chop name={nameOf(r.loserId)} color={colorFor(r.loserId)} size={36} />
              <span className="reveal-count-chop-label">{t('table.dice.pays')}</span>
            </span>
          </div>
          <div className="ok-circle-wrap" style={{ marginTop: 26, marginBottom: 0 }}>
            <button className="ok-circle" onClick={onDone} aria-label={t('table.dice.result')}>
              <CheckIcon size={26} />
            </button>
          </div>
        </div>
      </>
    );
  }

  // ---- your own five, on every pre-reveal state ----
  const myDice = (
    <div className="my-dice" style={{ borderColor: yourColor }}>
      <div className="my-dice-row">
        {game.yourDice.map((value, i) => <DieFaceIcon key={i} value={value} size={56} filled />)}
      </div>
    </div>
  );

  // ---- 入局: the opener picks which way the bidding travels ----
  if (!game.direction) {
    const opener = game.firstPlayerId === you;
    return (
      <>
        {myDice}
        <div className="turn-dir">
          <span className="dice-turn-label">
            {opener ? t('table.dice.pickdir') : t('table.dice.waitdir', { name: nameOf(game.firstPlayerId) })}
          </span>
          {opener ? (
            <div className="turn-dir-row">
              {(['left', 'right'] as Direction[]).map(dir => (
                <div key={dir} className="turn-dir-opt">
                  <button className="turn-dir-btn" onClick={() => onPickDirection(dir)}
                    aria-label={t(`table.dice.${dir}`)}>
                    {dir === 'left' ? <ArrowLeftIcon size={24} /> : <ArrowRightIcon size={24} />}
                  </button>
                  <span className="turn-dir-cap">{t(`table.dice.${dir}`)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="my-dice other-turn-box" style={{ borderColor: colorFor(game.firstPlayerId) }}>
              <ThinkingDots color={colorFor(game.firstPlayerId)} />
            </div>
          )}
        </div>
      </>
    );
  }

  // ---- 叫骰: the round proper ----
  // Past calls, then the live one. On your own turn the composer takes this
  // slot instead — the history is what the strip is FOR when you are waiting.
  const history = [
    ...game.bids.map(b => ({ userId: b.user_id, text: callText(b.quantity, b.face) })),
    ...(game.currentTurnUserId ? [{ userId: game.currentTurnUserId, text: null }] : []),
  ];

  return (
    <>
      {myDice}
      <div className="first-call">
        <span className="dice-turn-label">
          {myTurn
            ? t(standing ? 'table.dice.yourturn' : 'table.dice.youfirst')
            : t('table.dice.theirturn', { name: nameOf(game.currentTurnUserId ?? '') })}
        </span>

        {myTurn ? (
          <div className="first-call-chips">
            {FACES.map(f => (
              <button key={f} className={`first-call-chip ${f === face ? 'is-chosen' : ''}`}
                onClick={() => setFace(f)} aria-label={faceWord(f)}>
                <DieFaceIcon value={f} size={28} />
              </button>
            ))}
          </div>
        ) : (
          <CallHistory items={history} colorFor={colorFor} />
        )}

        {/* Hidden, not removed, when it isn't your turn: the row keeps its space
            so the button below does not jump the moment the turn reaches you. */}
        <div className="first-call-stepper" style={myTurn ? undefined : { visibility: 'hidden' }}>
          <button className="icon-btn first-call-step-btn" aria-label={t('table.dice.minus')}
            onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
          <span className="first-call-num">{quantity}</span>
          <button className="icon-btn first-call-step-btn" aria-label={t('table.dice.plus')}
            onClick={() => setQuantity(q => Math.min(totalDice, q + 1))}>+</button>
        </div>
        <p className="first-call-say" style={myTurn ? undefined : { visibility: 'hidden' }}>
          {t('table.dice.say', { n: quantity, face: faceWord(face) })}
        </p>

        <div className="ok-circle-wrap" style={{ marginTop: -1, marginBottom: 0 }}>
          {myTurn ? (
            <button className="ok-circle" disabled={!legal} onClick={() => onCallBid(quantity, face)}
              aria-label={t('table.dice.say', { n: quantity, face: faceWord(face) })}>
              <CheckIcon size={26} />
            </button>
          ) : (
            <button className="ok-circle" onClick={onOpenCups} aria-label={t('table.dice.open')}
              style={canOpen ? undefined : { visibility: 'hidden' }}>
              <span className="ok-circle-glyph">開</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/** Three pulsing outline dots in one player's colour: "still deciding". */
function ThinkingDots({ color }: { color: string }) {
  return (
    <span className="other-turn-dots" style={{ '--dot-color': color } as React.CSSProperties}>
      <span /><span /><span />
    </span>
  );
}

/**
 * The trail of calls that led here, each box in its caller's own colour, packed
 * to the right so the live one sits directly under the turn label. Scrolled to
 * its end on every change for the same reason.
 */
function CallHistory({ items, colorFor }: {
  items: { userId: string; text: string | null }[];
  colorFor: (userId: string) => string;
}) {
  const [strip, setStrip] = useState<HTMLDivElement | null>(null);
  useEffect(() => { if (strip) strip.scrollLeft = strip.scrollWidth; }, [strip, items.length]);
  return (
    <div className="call-history-strip" ref={setStrip}>
      <span className="call-history-pad" aria-hidden />
      {items.map((item, i) => (
        <div key={i} className="my-dice other-turn-box call-history-item"
          style={{ borderColor: colorFor(item.userId) }}>
          {item.text === null
            ? <ThinkingDots color={colorFor(item.userId)} />
            : <CallText text={item.text} />}
        </div>
      ))}
    </div>
  );
}

/** A made call, as it is said out loud. The count's sans-inside-serif correction
 *  is SansNum's — extracted from here when the cart bar needed the same thing. */
function CallText({ text }: { text: string }) {
  return <span className="other-call-text"><SansNum>{text}</SansNum></span>;
}
