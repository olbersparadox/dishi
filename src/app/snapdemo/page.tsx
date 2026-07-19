'use client';
// PUBLIC, no-login FEEL DEMO of the whole album rating ARC (rating-flow revamp):
// pick photos → magnetic-snap flick each (or fling sideways to skip) → end-of-stack
// CONSENT/review → the "growing your Taste AI" level-up reward. Lets the owner feel +
// design-tune the full flow on their phone WITHOUT the preview auth wall. Nothing is
// saved or sent anywhere; growth numbers are mocked. Throwaway harness — the real
// flow is RatingStack, opened as an overlay from the Taste AI tab. Removable once
// the feel is dialled in.
import { useState } from 'react';
import { useLang } from '@/lib/i18n';
import { toDisplayableAll } from '@/lib/heic';
import SnapRating from '@/components/SnapRating';
import RatingReview, { type ReviewItem } from '@/components/RatingReview';
import TasteGrowth from '@/components/TasteGrowth';

type Phase = 'flick' | 'review' | 'grow';

export default function SnapDemo() {
  const { t } = useLang();
  const [previews, setPreviews] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [rated, setRated] = useState<ReviewItem[]>([]); // only RATED cards (skips omitted) — held, NOT committed
  const [phase, setPhase] = useState<Phase>('flick');
  const [taught, setTaught] = useState(0);

  function reset(urls: string[] = []) {
    previews.forEach(u => URL.revokeObjectURL(u));
    setPreviews(urls); setIdx(0); setRated([]); setPhase('flick'); setTaught(0);
  }
  async function pick(files: FileList | null) {
    const fs = Array.from(files ?? []);
    if (!fs.length) return;
    const disp = await toDisplayableAll(fs); // HEIC → JPEG so Chrome can render it
    reset(disp.map(f => URL.createObjectURL(f)));
  }

  // Rate pushes a card; skip drops it. Both advance; the last one opens review
  // (unless everything was skipped, in which case there's nothing to review).
  function advance(next: ReviewItem[]) {
    setRated(next);
    if (idx + 1 >= previews.length) { if (next.length) setPhase('review'); else reset(); }
    else setIdx(i => i + 1);
  }
  const onRate = (score: number) => advance([...rated, { photoUrl: previews[idx], score }]);
  const onSkip = () => advance(rated);

  const pickButton = (
    <label className="btn primary" style={{ display: 'inline-flex', cursor: 'pointer' }}>
      {previews.length ? t('snapdemo.again') : t('snapdemo.pick')}
      <input type="file" accept="image/*" multiple hidden onChange={e => { pick(e.target.files); e.target.value = ''; }} />
    </label>
  );

  // FLICK phase renders the full-screen overlay itself; other phases sit in the column.
  if (previews.length && phase === 'flick' && idx < previews.length) {
    return (
      <SnapRating
        key={idx}
        photoUrl={previews[idx]}
        showHint={idx === 0}
        onClose={() => reset()}
        onRate={onRate}
        onSkip={onSkip}
      />
    );
  }

  // Mocked engine growth so the reward is feelable: a base confidence that each
  // taught dish nudges up. Real numbers come from the taste engine in RatingStack.
  const fromPct = 46;
  const toPct = Math.min(100, fromPct + taught * 9);

  return (
    <div style={{ maxWidth: 460, margin: '0 auto', padding: '28px 16px 96px' }}>
      {phase === 'review' ? (
        <RatingReview
          items={rated}
          onConfirm={(kept) => { setTaught(kept.length); setPhase('grow'); }}
          onDiscard={() => reset()}
        />
      ) : phase === 'grow' ? (
        <TasteGrowth taught={taught} fromPct={fromPct} toPct={toPct} level={3} onDone={() => reset()} />
      ) : (
        <>
          <h1 style={{ marginBottom: 6 }}>{t('snapdemo.title')}</h1>
          <p className="card-meta" style={{ marginBottom: 18 }}>{t('snapdemo.blurb')}</p>
          {pickButton}
        </>
      )}
    </div>
  );
}
