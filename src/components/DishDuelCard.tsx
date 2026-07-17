'use client';
// 對決 card on the Taste tab. Fetches its own duel (so the profile page stays
// agnostic) and renders nothing when there isn't one — the card only appears when
// the engine has a genuinely informative same-cuisine pair to ask about. Answering
// reveals whether the SEALED prediction was right (估中咗/估錯咗) plus the dims the
// choice just taught, reusing the rating reveal's dim-chip treatment.
//
// NOTE: this is a first-pass visual built from existing tokens/classes — the layout
// is meant to be refined in Claude Design, not treated as final.
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/i18n';
import DishName from './DishName';

type DuelDish = { id: string; name: string; name_zh: string | null; photo_url: string | null; restaurant: string | null };
type Duel = { id: string; a: DuelDish; b: DuelDish };
type Reveal = { predicted_correct: boolean; predicted_p: number | null; learned: { dim: string; dir: number }[] };

export default function DishDuelCard() {
  const { t } = useLang();
  const [duel, setDuel] = useState<Duel | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    fetch('/api/duels/next')
      .then(r => r.json())
      .then(j => { if (j.duel) setDuel(j.duel); })
      .catch(() => { /* no duel is a normal, silent state */ });
  }, []);

  async function answer(winnerId: string) {
    if (!duel || busy || reveal) return;
    setBusy(true); setChosen(winnerId);
    try {
      const res = await fetch('/api/duels/answer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duel_id: duel.id, winner_dish_id: winnerId }),
      });
      const j = await res.json();
      if (res.ok) setReveal(j); else setChosen(null);
    } catch { setChosen(null); } finally { setBusy(false); }
  }

  function skip() {
    if (!duel) return;
    setGone(true); // optimistic — a skip never fails in a way worth blocking on
    fetch('/api/duels/answer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duel_id: duel.id, skip: true }),
    }).catch(() => {});
  }

  if (!duel || gone) return null;

  return (
    <div className="card duel-card"><div className="card-body">
      <div className="duel-head">
        <span className="duel-title">{t('duel.title')}</span>
        <span className="seal-stamp" title={t('seal.stamp.title')} aria-label={t('seal.stamp.title')}>印</span>
      </div>

      <div className="duel-pair">
        {[duel.a, duel.b].map(dish => (
          <button
            key={dish.id}
            className={`duel-option ${reveal ? 'revealed' : ''} ${chosen === dish.id ? 'chosen' : ''}`}
            disabled={busy || !!reveal}
            onClick={() => answer(dish.id)}
          >
            {dish.photo_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={dish.photo_url} alt="" className="duel-photo" />
              : <div className="duel-photo duel-photo-blank" aria-hidden />}
            <div className="duel-option-name"><DishName name={dish.name} name_zh={dish.name_zh} /></div>
            {dish.restaurant && <div className="duel-option-rest">{dish.restaurant}</div>}
          </button>
        ))}
      </div>

      {!reveal ? (
        <>
          <p className="duel-q">{t('duel.q')}</p>
          <button className="duel-skip" onClick={skip}>{t('duel.skip')}</button>
        </>
      ) : (
        <div className="duel-reveal" role="status">
          <span className="duel-verdict">{reveal.predicted_correct ? `${t('duel.hit')} 🎯` : t('duel.miss')}</span>
          {reveal.learned.length > 0 && (
            <span className="duel-learned">
              {t('duel.learned', { dims: reveal.learned.map(x => `${t(`dim.${x.dim}`)} ${x.dir > 0 ? '↑' : '↓'}`).join(' · ') })}
            </span>
          )}
        </div>
      )}
    </div></div>
  );
}
