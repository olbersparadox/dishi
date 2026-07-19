'use client';
// The album-batch rating flow (rating-flow revamp). You multi-select a roll of
// food photos; they arrive here as a flick STACK to rate one after another, while
// the dish name / place / date / taste fill in silently in the background. Nothing
// is committed until the end-of-stack consent step (the trust rule).
//
// Slice 1 (this): receive the handed-off photos and stand up the screen. The flick
// stack, per-card background prep, and the consent + level-up summary come next.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { takePendingPhotos } from '@/lib/pendingPhoto';
import { useLang } from '@/lib/i18n';
import { CloseIcon } from '@/components/icons';

export default function RatingStack() {
  const router = useRouter();
  const { t } = useLang();
  const [photos, setPhotos] = useState<File[] | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    // The photos are a one-shot hand-off from the Taste-AI entry. A direct hit or a
    // refresh has nothing to consume, so bounce back rather than show an empty stack.
    const fs = takePendingPhotos();
    if (!fs.length) { router.replace('/profile'); return; }
    setPhotos(fs);
    const urls = fs.map(f => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach(u => URL.revokeObjectURL(u));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!photos) return null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <label className="label" style={{ margin: 0 }}>{t('rate.stack.title', { n: photos.length })}</label>
        <button className="icon-btn" onClick={() => router.push('/profile')} aria-label={t('log.cancelflow')} title={t('log.cancelflow')}>
          <CloseIcon size={20} />
        </button>
      </div>
      {/* Slice-1 scaffold: the picked roll. Becomes the flick stack in Slice 2. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {previews.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={p} alt="" style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 12, display: 'block' }} />
        ))}
      </div>
    </div>
  );
}
