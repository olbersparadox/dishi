'use client';
// The floating 對決 card. Three outcomes: pick a dish (win/loss), 揀唔落 (a TIE — a
// real "these two are equal for me" signal), or ✕ dismiss ("not now" — teaches
// nothing, the duel stays available). On a pick the loser fades so the choice reads
// (the winner is NOT enlarged); the sealed 印 result and what was learned then STAY
// on screen until the user taps OK. First-pass visual — refine in Claude Design.
import { useState } from 'react';
import { useLang } from '@/lib/i18n';
import DishName from './DishName';
import { CloseIcon } from './icons';

export type DuelDish = { id: string; name: string; name_zh: string | null; photo_url: string | null; restaurant: string | null };
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
            <span className="duel-title">{t('duel.title')}</span>
            <span className="seal-stamp" title={t('seal.stamp.title')} aria-label={t('seal.stamp.title')}>印</span>
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
                {dish.photo_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={dish.photo_url} alt="" className="duel-photo" />
                  : <div className="duel-photo duel-photo-blank" aria-hidden />}
                {/* card-title: the exact journal/scan dish-name treatment (serif
                    primary + small secondary, standard spacing) — not a bespoke size. */}
                <div className="card-title"><DishName name={dish.name} name_zh={dish.name_zh} /></div>
                {dish.restaurant && <div className="duel-option-rest">{dish.restaurant}</div>}
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
              {/* The sealed 印 result — stays put so it's actually readable. */}
              <div className="duel-verdict">
                <span className="seal-stamp" aria-hidden>印</span>
                <span>{reveal.tie ? t('duel.tieresult') : reveal.predicted_correct ? `${t('duel.hit')} 🎯` : t('duel.miss')}</span>
              </div>
              {reveal.learned.length > 0 && (
                <span className="duel-learned">
                  {t('duel.learned', { dims: reveal.learned.map(x => `${t(`dim.${x.dim}`)} ${x.dir > 0 ? '↑' : '↓'}`).join(' · ') })}
                </span>
              )}
              <button className="btn primary duel-ok" onClick={() => close(true)}>{t('duel.ok')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
