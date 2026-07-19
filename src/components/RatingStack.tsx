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
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { toDisplayableAll } from '@/lib/heic';
import SnapRating from '@/components/SnapRating';
import RatingReview, { type ReviewItem } from '@/components/RatingReview';
import TasteGrowth from '@/components/TasteGrowth';

type Phase = 'flick' | 'review' | 'grow';

export default function RatingStack({ photos, onExit }: { photos: File[]; onExit: () => void }) {
  const { t } = useLang();
  // Convert any HEIC (iPhone default) to JPEG before previewing — Chrome can't
  // render HEIC in an <img>. null = still decoding.
  const [previews, setPreviews] = useState<string[] | null>(null);
  useEffect(() => {
    let alive = true; let urls: string[] = [];
    toDisplayableAll(photos).then(fs => {
      if (!alive) return;
      urls = fs.map(f => URL.createObjectURL(f));
      setPreviews(urls);
    });
    return () => { alive = false; urls.forEach(u => URL.revokeObjectURL(u)); };
  }, [photos]);

  const [idx, setIdx] = useState(0);
  const [rated, setRated] = useState<ReviewItem[]>([]); // only RATED cards (skips omitted) — held, NOT committed
  const [phase, setPhase] = useState<Phase>('flick');
  const [taught, setTaught] = useState(0);

  // Still decoding (e.g. HEIC → JPEG) — a brief loading sheet.
  if (!previews) return (
    <div className="rate-sheet"><div className="rate-sheet-inner rate-loading">{t('rate.preparing')}</div></div>
  );
  if (!previews.length) return null;
  const pv = previews;

  // Rate pushes a card; skip drops it. Both advance; the last one opens review
  // (unless everything was skipped — then there's nothing to review, so close).
  const advance = (next: ReviewItem[]) => {
    setRated(next);
    if (idx + 1 >= pv.length) { if (next.length) setPhase('review'); else onExit(); }
    else setIdx(i => i + 1);
  };
  const onRate = (score: number) => advance([...rated, { photoUrl: pv[idx], score }]);
  const onSkip = () => advance(rated);

  if (phase === 'flick') {
    // Full-screen glass overlay over the Taste AI page.
    return (
      <SnapRating
        key={idx}
        photoUrl={pv[idx]}
        showHint={idx === 0}
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
