'use client';
// The floating 對決 card. Three outcomes: pick a dish (win/loss), 揀唔落 (a TIE — a
// real "these two are equal for me" signal), or ✕ dismiss ("not now" — teaches
// nothing, the duel stays available). On a pick the loser fades so the choice reads
// (the winner is NOT enlarged); the sealed 印 result and what was learned then STAY
// on screen until the user taps OK. First-pass visual — refine in Claude Design.
import { useState } from 'react';
import { useLang, type LangPair } from '@/lib/i18n';
import DishName from './DishName';
import { CloseIcon } from './icons';
import { pickDistrict, type DistrictMap } from '@/lib/district';

export type DuelDish = {
  id: string; name: string; name_zh: string | null; photo_url: string | null;
  restaurant: string | null; restaurant_district?: DistrictMap | null; district?: DistrictMap | null;
};
export type Duel = { id: string; a: DuelDish; b: DuelDish };
type Reveal = { predicted_correct?: boolean; tie?: boolean; predicted_p: number | null; learned: { dim: string; dir: number }[] };

// The duel card always reads 中文 primary / English secondary, regardless of the
// person's global language-pair setting elsewhere in the app — a deliberate,
// stable pairing for this specific comparison UI (per design direction), not the
// user's general display preference.
const ZH_PRIMARY_PAIR: LangPair = { primary: 'zh', secondary: 'en' };

// Same "restaurant • district" convention as the Eat Journal (MyDishes.locationLabel):
// the restaurant's own district when there's a restaurant, else the dish's own logged
// district. Returns null when there's nothing to show — the caller renders nothing.
function duelLocation(d: DuelDish, lang: 'zh' | 'en'): string | null {
  if (d.restaurant) {
    const area = pickDistrict(d.restaurant_district, lang);
    return d.restaurant + (area ? ` • ${area}` : '');
  }
  return pickDistrict(d.district, lang);
}

/** onClose(resolved): resolved=true when the duel was answered (pick/tie) and the
 *  user tapped OK — the caller drops it from the list; false on a ✕/backdrop
 *  dismiss, where the duel stays available. */
export default function DuelOverlay({ duel, onClose }: { duel: Duel; onClose: (resolved: boolean) => void }) {
  const { t, lang } = useLang();
  const [chosen, setChosen] = useState<string | null>(null); // a dish id, or 'tie'
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const [sealExplain, setSealExplain] = useState(false); // tap 印 -> what the seal means

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
              <button type="button" className="seal-stamp duel-seal-btn" onClick={() => setSealExplain(v => !v)}
                aria-label={t('seal.stamp.title')} aria-expanded={sealExplain} title={t('seal.stamp.title')}>印</button>
            </div>
            {!reveal && <button className="duel-x" onClick={() => close(false)} aria-label={t('home.cancel')}><CloseIcon /></button>}
            {sealExplain && (
              <div className="duel-seal-explain" role="dialog" aria-label={t('seal.explain.title')}>
                <p className="duel-seal-explain-title">{t('seal.explain.title')}</p>
                <p className="duel-seal-explain-body">{t('seal.explain.body')}</p>
                <button className="btn ghost small" onClick={() => setSealExplain(false)}>{t('seal.explain.close')}</button>
              </div>
            )}
          </div>

          <div className={`duel-pair ${resolving ? 'resolving' : ''}`}>
            {[duel.a, duel.b].map(dish => {
              const location = duelLocation(dish, lang);
              return (
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
                    primary + small secondary), but PINNED to 中文/English regardless
                    of the person's global pair — this comparison always reads zh
                    over en. Tighter gap between the two lines here (see CSS). */}
                <div className="card-title"><DishName name={dish.name} name_zh={dish.name_zh} pair={ZH_PRIMARY_PAIR} /></div>
                {location && <div className="duel-option-rest">{location}</div>}
              </button>
              );
            })}
          </div>

          {!reveal ? (
            <>
              <p className="duel-q">{t('duel.q')}</p>
              <button className="duel-tie" onClick={() => resolve('tie', { tie: true })}>{t('duel.tie')}</button>
            </>
          ) : (
            <div className="duel-reveal" role="status">
              {/* The sealed result — stays put so it's actually readable. 開 ("opened")
                  reads as the seal being broken; plain text, no icon chrome, at this
                  size it doesn't need it. */}
              <div className="duel-verdict">
                <span>開</span>
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
