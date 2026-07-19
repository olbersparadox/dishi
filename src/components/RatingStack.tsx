'use client';
// The album-batch rating flow (rating-flow revamp), rendered as an OVERLAY on top
// of the Taste AI page so the drag-and-rate glass shows the live section blurred
// behind it (the page beneath stays mounted — the parent just conditionally renders
// this). You multi-select a roll; it becomes a flick STACK → end-of-stack consent →
// the "growing your Taste AI" reward.
//
// TRUST RULE / STATE OF PLAY: nothing is committed yet. Ratings are held locally and
// the growth numbers are placeholders — real persistence (create · seal · EXIF ·
// enrich) + real engine confidence from buddy.ts are the next slice. Confirm/Discard
// both just close for now.
import { useEffect, useMemo, useState } from 'react';
import { useLang } from '@/lib/i18n';
import SnapRating from '@/components/SnapRating';
import RatingReview, { type ReviewItem } from '@/components/RatingReview';
import TasteGrowth from '@/components/TasteGrowth';

type Phase = 'flick' | 'review' | 'grow';

export default function RatingStack({ photos, onExit }: { photos: File[]; onExit: () => void }) {
  const { t } = useLang();
  const previews = useMemo(() => photos.map(f => URL.createObjectURL(f)), [photos]);
  useEffect(() => () => previews.forEach(u => URL.revokeObjectURL(u)), [previews]);

  const [idx, setIdx] = useState(0);
  const [rated, setRated] = useState<ReviewItem[]>([]); // only RATED cards (skips omitted) — held, NOT committed
  const [phase, setPhase] = useState<Phase>('flick');
  const [taught, setTaught] = useState(0);

  // Rate pushes a card; skip drops it. Both advance; the last one opens review
  // (unless everything was skipped — then there's nothing to review, so close).
  function advance(next: ReviewItem[]) {
    setRated(next);
    if (idx + 1 >= previews.length) { if (next.length) setPhase('review'); else onExit(); }
    else setIdx(i => i + 1);
  }
  const onRate = (score: number) => advance([...rated, { photoUrl: previews[idx], score }]);
  const onSkip = () => advance(rated);

  if (!previews.length) return null;

  if (phase === 'flick') {
    // Full-screen glass overlay over the Taste AI page.
    return (
      <SnapRating
        key={idx}
        photoUrl={previews[idx]}
        progress={t('rate.stack.progress', { i: idx + 1, n: previews.length })}
        onClose={onExit}
        onRate={onRate}
        onSkip={onSkip}
      />
    );
  }

  // Consent + reward ride in a full-screen sheet over the page.
  // Mocked engine growth so the reward is feelable; real numbers come from buddy.ts.
  const fromPct = 46;
  const toPct = Math.min(100, fromPct + taught * 9);
  return (
    <div className="rate-sheet">
      <div className="rate-sheet-inner">
        {phase === 'review' ? (
          <RatingReview
            items={rated}
            onConfirm={(kept) => { setTaught(kept.length); setPhase('grow'); }}
            onDiscard={onExit}
          />
        ) : (
          <TasteGrowth taught={taught} fromPct={fromPct} toPct={toPct} level={3} onDone={onExit} />
        )}
      </div>
    </div>
  );
}
