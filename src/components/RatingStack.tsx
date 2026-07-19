'use client';
// The album-batch rating flow (rating-flow revamp). You multi-select a roll of food
// photos; they arrive here as a flick STACK — one magnetic-snap card at a time.
//
// THIS PASS: the feel prototype — real photos, the SnapRating card, advance on each
// rating. Nothing is created or committed yet (the trust rule): background prep
// (create · seal · EXIF · enrich) and the end-of-stack CONSENT + level-up summary
// are the next slice. Ratings are just held locally so we can feel the rhythm.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { takePendingPhotos } from '@/lib/pendingPhoto';
import { useLang } from '@/lib/i18n';
import { CloseIcon } from '@/components/icons';
import SnapRating from '@/components/SnapRating';

export default function RatingStack() {
  const router = useRouter();
  const { t } = useLang();
  const [photos, setPhotos] = useState<File[] | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [ratings, setRatings] = useState<number[]>([]); // held locally — NOT committed yet
  const [rating, setRating] = useState<number | null>(null); // current card, set on release

  useEffect(() => {
    // One-shot hand-off from the Taste-AI entry; a direct hit / refresh has nothing
    // to consume, so bounce back rather than show an empty stack.
    const fs = takePendingPhotos();
    if (!fs.length) { router.replace('/profile'); return; }
    setPhotos(fs);
    const urls = fs.map(f => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach(u => URL.revokeObjectURL(u));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!photos) return null;

  // End of stack — placeholder for the consent + level-up summary (next slice).
  if (idx >= previews.length) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 40 }}>
        <p className="label" style={{ justifyContent: 'center' }}>{t('rate.stack.doneproto', { n: ratings.length })}</p>
        <button className="btn primary" style={{ marginTop: 16 }} onClick={() => router.push('/profile')}>{t('log.done')}</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <label className="label" style={{ margin: 0 }}>{t('rate.stack.progress', { i: idx + 1, n: previews.length })}</label>
        <button className="icon-btn" onClick={() => router.push('/profile')} aria-label={t('log.cancelflow')} title={t('log.cancelflow')}>
          <CloseIcon size={20} />
        </button>
      </div>
      <SnapRating key={idx} photoUrl={previews[idx]} onRate={setRating} />
      {/* Release SETS the rating; a deliberate Next advances (a slip never commits +
          skips). Re-drag to change. Real commit is the end-of-stack consent. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
        <span className="card-meta">{rating !== null ? t('rate.adjust') : t('flick.hint')}</span>
        <button className="btn primary" disabled={rating === null}
          onClick={() => { setRatings(r => [...r, rating as number]); setRating(null); setIdx(i => i + 1); }}>
          {t('rate.next')}
        </button>
      </div>
    </div>
  );
}
