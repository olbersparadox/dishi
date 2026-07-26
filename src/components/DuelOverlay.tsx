'use client';
// The floating 對決 card. Three outcomes: pick a dish (win/loss), 揀唔落 (a TIE — a
// real "these two are equal for me" signal), or ✕ dismiss ("not now" — teaches
// nothing, the duel stays available). On a pick the loser fades so the choice reads
// (the winner is NOT enlarged); the sealed 印 result and what was learned then STAY
// on screen until the user taps OK. First-pass visual — refine in Claude Design.
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
 *  dismiss, where the duel stays available. */
export default function DuelOverlay({ duel, onClose }: { duel: Duel; onClose: (resolved: boolean) => void }) {
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

  return (
    <div className={`duel-overlay ${closing ? 'closing' : ''}`} role="dialog" aria-modal="true" aria-label={t('duel.title')}>
      <div className="duel-backdrop" onClick={resolving ? undefined : () => close(false)} />
      <div className="card duel-card duel-floating">
        <div className="card-body">
          <div className="duel-head">
            {/* Title + 印 centered as a unit; the ✕ is pulled out of flow (absolute,
                see CSS) so it doesn't skew that centering. */}
            <div className="duel-head-center">
              <span className="duel-title">{t('duel.title')}</span>
              <SealStamp />
            </div>
            {!reveal && <button className="duel-x" onClick={() => close(false)} aria-label={t('home.cancel')}><CloseIcon /></button>}
          </div>

          <div className={`duel-pair ${resolving ? 'resolving' : ''}`}>
            {[duel.a, duel.b].map(dish => (
              <button
                key={dish.id}
                className={`duel-option ${chosen === dish.id ? 'won' : ''} ${resolving && chosen !== dish.id ? 'faded' : ''}`}
                disabled={busy || resolving}
                onClick={() => resolve(dish.id, { winner_dish_id: dish.id })}
              >
                <DuelSide dish={dish} />
              </button>
            ))}
          </div>

          {!reveal ? (
            <>
              <p className="duel-q">{t('duel.q')}</p>
              <button className="duel-tie" onClick={() => resolve('tie', { tie: true })}>{t('duel.tie')}</button>
            </>
          ) : (
            <div className="duel-reveal" role="status">
              {/* The sealed result — stays put so it's actually readable. The FACE
                  leads, exactly as it does on a rating's reveal: same three faces,
                  same meaning, so a duel hit and a rating hit read identically.
                  A tie takes the middle face — the engine was neither right nor
                  wrong, which is precisely what 😉 says there. */}
              <span className="seal-modal-face" aria-hidden>
                {FACE[reveal.tie ? 'near' : reveal.predicted_correct ? 'hit' : 'miss']}
              </span>
              <div className="duel-verdict">
                <span>{reveal.tie ? t('duel.tieresult') : reveal.predicted_correct ? t('duel.hit') : t('duel.miss')}</span>
              </div>
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
