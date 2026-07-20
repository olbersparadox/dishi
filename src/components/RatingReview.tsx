'use client';
// End-of-stack CONSENT + review — the trust gate of the album rating flow.
//
// THE TRUST RULE (owner, load-bearing): background prep may create/seal/enrich in
// the background, but a rating is never USED (never counts toward the engine, never
// moves the level bar) until the person sees this screen and confirms. Here they can
// nudge any rating up/down or drop it entirely; Confirm commits the kept set and the
// growth reward follows. Discard throws the drafts away — nothing saved, no surprise.
//
// Reusable across the /snapdemo feel harness and the real RatingStack. It owns only
// the working edits (scores + dropped); the parent owns commit vs discard.
import { useState } from 'react';
import { useLang } from '@/lib/i18n';
import { CHIPS, wordKeyFor } from '@/lib/flickWords';

export type ReviewItem = { photoUrl: string | null; name?: string; score: number };

// Step among the 6 discrete levels (CHIPS is the single source, low→high).
function levelIndex(score: number): number {
  let best = 0, bestD = Infinity;
  CHIPS.forEach((c, i) => { const d = Math.abs(c.value - score); if (d < bestD) { bestD = d; best = i; } });
  return best;
}

export default function RatingReview({ items, onConfirm, onDiscard }: {
  items: ReviewItem[];
  onConfirm: (kept: ReviewItem[]) => void;
  onDiscard: () => void;
}) {
  const { t } = useLang();
  const [scores, setScores] = useState<number[]>(items.map(i => i.score));
  const [dropped, setDropped] = useState<Set<number>>(new Set());
  const keptCount = items.length - dropped.size;

  function step(i: number, dir: 1 | -1) {
    setScores(prev => {
      const ni = Math.max(0, Math.min(CHIPS.length - 1, levelIndex(prev[i]) + dir));
      const next = [...prev]; next[i] = CHIPS[ni].value; return next;
    });
  }
  function toggleDrop(i: number) {
    setDropped(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  }

  return (
    <div className="review">
      <h2 className="review-title">{t('rate.review.title')}</h2>
      <p className="card-meta review-blurb">{t('rate.review.blurb')}</p>

      <ul className="review-list">
        {items.map((it, i) => {
          const dead = dropped.has(i);
          return (
            <li key={i} className={`review-row ${dead ? 'is-dropped' : ''}`}>
              <div className="review-thumb">
                {it.photoUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={it.photoUrl} alt="" />
                  : <span>🍽️</span>}
              </div>
              <div className="review-main">
                <span className="review-name">{it.name || t('rate.review.dish', { n: i + 1 })}</span>
                <span className="review-word">{t(wordKeyFor(scores[i]))}</span>
              </div>
              {dead ? (
                <button className="btn ghost small" onClick={() => toggleDrop(i)}>{t('rate.review.keep')}</button>
              ) : (
                <div className="review-step">
                  <button className="review-nudge" onClick={() => step(i, -1)}
                    disabled={levelIndex(scores[i]) === 0} aria-label={t('rate.review.lower')}>−</button>
                  <button className="review-nudge" onClick={() => step(i, 1)}
                    disabled={levelIndex(scores[i]) === CHIPS.length - 1} aria-label={t('rate.review.higher')}>+</button>
                  <button className="review-drop" onClick={() => toggleDrop(i)}>{t('rate.review.drop')}</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="review-actions">
        <button className="btn ghost" onClick={onDiscard}>{t('rate.review.discard')}</button>
        <button className="btn primary" disabled={keptCount === 0}
          onClick={() => onConfirm(items.map((it, i) => ({ ...it, score: scores[i] })).filter((_, i) => !dropped.has(i)))}>
          {t('rate.review.confirm', { n: keptCount })}
        </button>
      </div>
    </div>
  );
}
