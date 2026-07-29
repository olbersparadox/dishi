'use client';
// The floating 對決 card. Three outcomes: pick a dish (win/loss), 揀唔落 (a TIE — a
// real "these two are equal for me" signal), or ✕ dismiss ("not now" — teaches
// nothing, the duel stays available). On a win/loss the loser fades and the
// winner expands to fill the card; a TIE keeps BOTH dishes side by side exactly
// as in the pick state — neither reads as "the" answer. The header itself
// becomes the verdict on reveal (own FACE emoji + duel.hit/miss/tieresult, no
// more 印 stamp once resolved) and what was learned STAYS on screen until the
// user taps OK. First-pass visual — refine in Claude Design.
import { useState } from 'react';
import { useLang } from '@/lib/i18n';
import { CloseIcon, CheckIcon } from './icons';
import SealStamp from './SealStamp';
// The verdict FACE comes from the rating reveal, not a copy of it — one seal,
// one vocabulary, so a hit never looks like two different things.
import { FACE } from './SealRevealBadge';
// Side anatomy (photo / zh-pinned name / location) is the SHARED chassis — the
// identity-confirm card mounts the same component. See DuelSide.tsx.
import DuelSide, { type DuelDish } from './DuelSide';

export type { DuelDish } from './DuelSide';
export type Duel = { id: string; a: DuelDish; b: DuelDish };
type Reveal = { predicted_correct?: boolean; tie?: boolean; predicted_p: number | null; learned: { dim: string; dir: number }[] };

/** onClose(resolved): resolved=true when the duel was answered (pick/tie) and the
 *  user tapped OK — the caller drops it from the list; false on a ✕/backdrop
 *  dismiss, where the duel stays available.
 *  `rematch`: this pair was selected to re-probe the dims of a prediction the
 *  engine recently got WRONG — the card says so, because a model admitting a
 *  miss and visibly re-checking IS the taste-understanding claim made real. */
export default function DuelOverlay({ duel, rematch, onClose }: { duel: Duel; rematch?: boolean; onClose: (resolved: boolean) => void }) {
  const { t } = useLang();
  const [chosen, setChosen] = useState<string | null>(null); // a dish id, or 'tie'
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);

  function close(resolved: boolean) {
    if (closing) return;
    setClosing(true);
    setTimeout(() => onClose(resolved), 340); // let the fade-out play before unmounting
  }

  async function resolve(mark: string, body: object) {
    if (busy || reveal) return;
    setBusy(true); setChosen(mark);
    try {
      const res = await fetch('/api/duels/answer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duel_id: duel.id, ...body }),
      });
      const j = await res.json();
      if (res.ok) setReveal(j); else setChosen(null); // reveal STAYS until OK
    } catch { setChosen(null); } finally { setBusy(false); }
  }

  const resolving = !!reveal;
  // A tie keeps BOTH dishes visible, side by side, exactly like the pick state —
  // only a hit/miss enlarges the winner and fades the loser. "Resolving" as a
  // layout mode (the grid→centered-flex collapse) therefore excludes ties.
  const collapsing = resolving && !reveal?.tie;

  return (
    <div className={`duel-overlay ${closing ? 'closing' : ''}`} role="dialog" aria-modal="true" aria-label={t('duel.title')}>
      <div className="duel-backdrop" onClick={resolving ? undefined : () => close(false)} />
      <div className="card duel-card duel-floating">
        <div className="card-body">
          <div className="duel-head">
            {/* Pre-pick: title + 印 centered as a unit, ✕ pulled out of flow (absolute,
                see CSS) so it doesn't skew that centering. Post-reveal: the header
                itself BECOMES the verdict (moved up from a standalone line under the
                photo pair) — the FACE emoji leads for a tie, trails for a hit/miss,
                per the owner's exact wording for each. No more 印 once resolved. */}
            <div className="duel-head-center">
              {!reveal ? (
                <>
                  <span className="duel-title">{t('duel.title')}</span>
                  <SealStamp />
                </>
              ) : (
                <span className="duel-title">
                  {reveal.tie
                    ? <>{FACE.near} {t('duel.tieresult')}</>
                    : <>{t(reveal.predicted_correct ? 'duel.hit' : 'duel.miss')} {FACE[reveal.predicted_correct ? 'hit' : 'miss']}</>}
                </span>
              )}
            </div>
            {!reveal && <button className="duel-x" onClick={() => close(false)} aria-label={t('home.cancel')}><CloseIcon /></button>}
          </div>

          {rematch && !reveal && <p className="duel-q">{t('duel.rematch')}</p>}

          <div className={`duel-pair ${collapsing ? 'resolving' : ''}`}>
            {[duel.a, duel.b].map(dish => (
              <button
                key={dish.id}
                className={`duel-option ${chosen === dish.id ? 'won' : ''} ${collapsing && chosen !== dish.id ? 'faded' : ''}`}
                disabled={busy || resolving}
                onClick={() => resolve(dish.id, { winner_dish_id: dish.id })}
              >
                <DuelSide dish={dish} />
              </button>
            ))}
          </div>

          {!reveal ? (
            <button className="duel-tie" onClick={() => resolve('tie', { tie: true })}>{t('duel.tie')}</button>
          ) : (
            <div className="duel-reveal" role="status">
              {reveal.learned.length > 0 && (
                <span className="duel-learned">
                  {t('duel.learned', { dims: reveal.learned.map(x => `${t(`dim.${x.dim}`)} ${x.dir > 0 ? '↑' : '↓'}`).join(' · ') })}
                </span>
              )}
              {/* Circle-with-check — the shared "done / acknowledge" affordance (same as
                  the growth screen's ✓). */}
              <div className="ok-circle-wrap">
                <button className="ok-circle" onClick={() => close(true)} aria-label={t('duel.ok')}><CheckIcon size={26} /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
