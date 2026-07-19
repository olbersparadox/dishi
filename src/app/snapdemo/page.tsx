'use client';
// PUBLIC, no-login FEEL DEMO of the magnetic-snap rating (rating-flow revamp).
// Purpose: let the owner feel the SnapRating interaction on their phone WITHOUT the
// preview deployment's auth wall — pick photos from the roll, flick each, see the
// value it snapped to. Nothing is saved or sent anywhere; it's a throwaway harness
// on the branch, removable once the feel is dialled in.
import { useState } from 'react';
import { useLang } from '@/lib/i18n';
import SnapRating from '@/components/SnapRating';
import { WORD_KEYS } from '@/lib/flickWords';

function wordFor(score: number): string {
  for (const [min, key] of WORD_KEYS) if (score >= min) return key;
  return 'flick.never';
}

export default function SnapDemo() {
  const { t } = useLang();
  const [previews, setPreviews] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [rating, setRating] = useState<number | null>(null); // set on release; NOT committed

  function pick(files: FileList | null) {
    const fs = Array.from(files ?? []);
    if (!fs.length) return;
    previews.forEach(u => URL.revokeObjectURL(u));
    setPreviews(fs.map(f => URL.createObjectURL(f)));
    setIdx(0);
    setRating(null);
  }

  function next() { setRating(null); setIdx(i => i + 1); }

  const pickButton = (
    <label className="btn primary" style={{ display: 'inline-flex', cursor: 'pointer' }}>
      {t('snapdemo.pick')}
      <input type="file" accept="image/*" multiple hidden onChange={e => { pick(e.target.files); e.target.value = ''; }} />
    </label>
  );

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '28px 16px 96px' }}>
      <h1 style={{ marginBottom: 6 }}>{t('snapdemo.title')}</h1>
      <p className="card-meta" style={{ marginBottom: 18 }}>{t('snapdemo.blurb')}</p>

      {previews.length === 0 ? (
        pickButton
      ) : idx >= previews.length ? (
        <div style={{ textAlign: 'center', paddingTop: 24 }}>
          <p className="label" style={{ justifyContent: 'center' }}>{t('snapdemo.done', { n: previews.length })}</p>
          <div style={{ marginTop: 14 }}>{pickButton}</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span className="card-meta">{t('rate.stack.progress', { i: idx + 1, n: previews.length })}</span>
            {rating !== null && <span className="card-meta" style={{ color: 'var(--ink)', fontWeight: 700 }}>{t(wordFor(rating))} · {rating}</span>}
          </div>
          <SnapRating
            key={idx}
            photoUrl={previews[idx]}
            onRate={(score) => setRating(score)}
          />
          {/* Release only SETS the rating — advance is a deliberate tap, so a slip
              never commits + skips. Re-drag the card to change it. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
            <span className="card-meta">{rating !== null ? t('rate.adjust') : t('flick.hint')}</span>
            <button className="btn primary" onClick={next} disabled={rating === null}>{t('rate.next')}</button>
          </div>
        </>
      )}
    </div>
  );
}
