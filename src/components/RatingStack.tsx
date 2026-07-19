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
import SnapRating from '@/components/SnapRating';

export default function RatingStack() {
  const router = useRouter();
  const { t } = useLang();
  const [photos, setPhotos] = useState<File[] | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [ratings, setRatings] = useState<number[]>([]); // held locally — NOT committed yet

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

  // Full-screen magnetic-snap overlay. The lock IS the confirmation, so releasing
  // while locked rates + advances (no Next button). Ratings stay LOCAL — nothing is
  // committed until the end-of-stack consent step (next slice).
  return (
    <SnapRating
      key={idx}
      photoUrl={previews[idx]}
      progress={t('rate.stack.progress', { i: idx + 1, n: previews.length })}
      onClose={() => router.push('/profile')}
      onRate={(score) => { setRatings(r => [...r, score]); setIdx(i => i + 1); }}
      onSkip={() => setIdx(i => i + 1)}
    />
  );
}
