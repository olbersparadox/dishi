'use client';
// The album-batch rating flow (rating-flow revamp), rendered as an OVERLAY on top
// of the Taste AI page so the drag-and-rate glass shows the live section blurred
// behind it (the page beneath stays mounted — the parent just conditionally renders
// this). You multi-select a roll; it becomes a flick STACK → end-of-stack consent →
// the "growing your Taste AI" reward.
//
// FLOW: pick → flick stack → straight to the "watch your Taste AI learn" screen
// (reward + light review MERGED; the standalone review screen is skipped).
//
// STATE OF PLAY: nothing is committed yet and the growth/enrichment is SIMULATED in
// TasteGrowth — real persistence (create · seal · EXIF · enrich) + real engine
// confidence from buddy.ts are the next slice.
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { toDisplayableAll } from '@/lib/heic';
import SnapRating from '@/components/SnapRating';
import TasteGrowth, { type GrowItem } from '@/components/TasteGrowth';

type Phase = 'flick' | 'grow';

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
  const [rated, setRated] = useState<GrowItem[]>([]); // only RATED cards (skips omitted)
  const [phase, setPhase] = useState<Phase>('flick');

  // Still decoding (e.g. HEIC → JPEG) — a brief loading sheet.
  if (!previews) return (
    <div className="rate-sheet"><div className="rate-sheet-inner rate-loading">{t('rate.preparing')}</div></div>
  );
  if (!previews.length) return null;
  const pv = previews;

  // Rate pushes a card; skip drops it. Both advance; the last one lands on the growth
  // screen (unless everything was skipped — then there's nothing to grow from, close).
  const advance = (next: GrowItem[]) => {
    setRated(next);
    if (idx + 1 >= pv.length) { if (next.length) setPhase('grow'); else onExit(); }
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

  // The "watch your Taste AI learn" screen rides in a full-screen sheet over the page.
  return (
    <div className="rate-sheet">
      <div className="rate-sheet-inner">
        <TasteGrowth items={rated} onExit={onExit} />
      </div>
    </div>
  );
}
