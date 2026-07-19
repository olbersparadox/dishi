'use client';
// PUBLIC, no-login FEEL DEMO of the album rating ARC (rating-flow revamp):
// pick photos → magnetic-snap flick each (or fling sideways to skip) → straight to
// the "watch your Taste AI learn" screen (reward + light review MERGED; the old
// standalone review screen is skipped). Lets the owner feel + design-tune the flow
// WITHOUT the preview auth wall. Nothing is saved; enrichment is simulated. Throwaway
// harness — the real flow is RatingStack, opened as an overlay from the Taste AI tab.
import { useState } from 'react';
import { useLang } from '@/lib/i18n';
import { toDisplayableAll } from '@/lib/heic';
import SnapRating from '@/components/SnapRating';
import TasteGrowth, { type GrowItem } from '@/components/TasteGrowth';

type Phase = 'flick' | 'grow';

export default function SnapDemo() {
  const { t } = useLang();
  const [previews, setPreviews] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [rated, setRated] = useState<GrowItem[]>([]); // only RATED cards (skips omitted)
  const [phase, setPhase] = useState<Phase>('flick');

  function reset(urls: string[] = []) {
    previews.forEach(u => URL.revokeObjectURL(u));
    setPreviews(urls); setIdx(0); setRated([]); setPhase('flick');
  }
  async function pick(files: FileList | null) {
    const fs = Array.from(files ?? []);
    if (!fs.length) return;
    const disp = await toDisplayableAll(fs); // HEIC → JPEG so Chrome can render it
    reset(disp.map(f => URL.createObjectURL(f)));
  }

  // Rate pushes a card; skip drops it. Both advance; the last one lands on the growth
  // screen (unless everything was skipped — then there's nothing to grow from).
  function advance(next: GrowItem[]) {
    setRated(next);
    if (idx + 1 >= previews.length) { if (next.length) setPhase('grow'); else reset(); }
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

  // FLICK phase renders the full-screen overlay itself; the growth phase sits in the column.
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

  return (
    <div style={{ maxWidth: 460, margin: '0 auto', padding: '28px 16px 96px' }}>
      {phase === 'grow' ? (
        <TasteGrowth items={rated} onExit={() => reset()} />
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
