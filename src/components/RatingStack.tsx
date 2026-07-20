'use client';
// The album-batch rating flow (rating-flow revamp), rendered as an OVERLAY on top
// of the Taste AI page so the drag-and-rate glass shows the live section blurred
// behind it (the page beneath stays mounted — the parent just conditionally renders
// this). You multi-select a roll; it becomes a flick STACK → the "watch your Taste AI
// learn" screen (reward + light review MERGED; the standalone review screen skipped).
//
// FLOW: pick → flick stack → the growth/refine screen.
//
// REAL WIRING (phase 1): a flicked card kicks off the REAL pipeline — create the dish
// from its photo (vision), then SEAL, then record the held flick score, then enrich —
// and streams each dish's real state into TasteGrowth. Nothing is simulated here.
//
// THE SEALED-BET CONTRACT (do not break): a sealed prediction must be written BEFORE
// the rating is recorded. The user flicks fast, so we CREATE the dish → POST /api/seals
// → and only THEN POST /api/ratings (the flick score is held until the seal is written).
// The prediction is thus sealed before the rating lands server-side — the honest
// reading of "written before the user rates". The client never sees a pending
// prediction; /api/seals returns only { sealed } and /api/ratings reveals on rating.
import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { toDisplayableAll } from '@/lib/heic';
import SnapRating from '@/components/SnapRating';
import TasteGrowth, { type GrowDish } from '@/components/TasteGrowth';

type Phase = 'flick' | 'grow';
type Prepared = { file: File; url: string };

const freshDish = (url: string, score: number): GrowDish => ({
  photoUrl: url, score, status: 'creating', dishId: null, isDish: true,
  name: '', name_zh: null, cuisine: null, ingredients: [], diet: [], heaviness: null, enriched: false,
});

export default function RatingStack({ photos, onExit }: { photos: File[]; onExit: () => void }) {
  const { t } = useLang();
  // Convert any HEIC (iPhone default) to JPEG up front — Chrome can't render HEIC in an
  // <img>, and vision needs a readable type too. We keep BOTH the converted File (to
  // upload) and its object URL (to preview). null = still decoding.
  const [prepared, setPrepared] = useState<Prepared[] | null>(null);
  useEffect(() => {
    let alive = true; let made: string[] = [];
    toDisplayableAll(photos).then(fs => {
      if (!alive) return;
      made = fs.map(f => URL.createObjectURL(f));
      setPrepared(fs.map((file, i) => ({ file, url: made[i] })));
    });
    return () => { alive = false; made.forEach(u => URL.revokeObjectURL(u)); };
  }, [photos]);

  const [idx, setIdx] = useState(0);
  const [dishes, setDishes] = useState<GrowDish[]>([]); // one per RATED card (skips omitted)
  const [phase, setPhase] = useState<Phase>('flick');
  const countRef = useRef(0); // stable index into `dishes` for out-of-order pipeline patches

  const patch = (i: number, upd: Partial<GrowDish>) =>
    setDishes(prev => prev.map((d, j) => (j === i ? { ...d, ...upd } : d)));

  // The REAL pipeline for one rated card. Runs detached (the user has already moved on
  // to the next card); each step patches this dish's row in place as it lands.
  async function runPipeline(file: File, score: number, i: number) {
    try {
      const form = new FormData();
      form.append('photo', file);
      form.append('source', 'album');
      const res = await fetch('/api/dishes', { method: 'POST', body: form });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.dish) { patch(i, { status: 'failed' }); return; }
      const d = json.dish;
      patch(i, {
        status: 'ready', dishId: d.id, isDish: d.is_dish !== false,
        name: d.name, name_zh: d.name_zh, cuisine: d.cuisine ?? null,
        diet: d.diet ?? [], heaviness: d.heaviness ?? null,
      });

      // Seal BEFORE the rating — awaited so the ordering is guaranteed. Below the seal
      // gate this is a clean no-op; either way the rating is recorded only after it.
      await fetch('/api/seals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dish_id: d.id }),
      }).catch(() => {});

      // Now the held flick score becomes the rating (which reveals any seal).
      await fetch('/api/ratings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dish_id: d.id, score }),
      }).catch(() => {});

      // Enrich in the background — ingredients / diet / cooking / heaviness. The route
      // re-runs taste replay if the dish was already rated (it was), so nothing learns
      // from empty attributes.
      fetch('/api/dishes/enrich', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: d.id }),
      })
        .then(r => (r.ok ? r.json() : null))
        .then(j => {
          if (j?.dish) patch(i, {
            ingredients: j.dish.ingredients ?? [], diet: j.dish.diet ?? [],
            heaviness: j.dish.heaviness ?? null, name_zh: j.dish.name_zh ?? undefined, enriched: true,
          });
        })
        .catch(() => {});
    } catch { patch(i, { status: 'failed' }); }
  }

  // Still decoding (e.g. HEIC → JPEG) — a brief loading sheet.
  if (!prepared) return (
    <div className="rate-sheet"><div className="rate-sheet-inner rate-loading">{t('rate.preparing')}</div></div>
  );
  if (!prepared.length) return null;
  const pv = prepared;

  const gotoNextOrGrow = (ratedAnything: boolean) => {
    if (idx + 1 >= pv.length) { if (ratedAnything) setPhase('grow'); else onExit(); }
    else setIdx(i => i + 1);
  };
  const onRate = (score: number) => {
    const i = countRef.current++;
    setDishes(prev => [...prev, freshDish(pv[idx].url, score)]);
    runPipeline(pv[idx].file, score, i); // detached — don't block advancing
    gotoNextOrGrow(true);
  };
  const onSkip = () => gotoNextOrGrow(countRef.current > 0);

  if (phase === 'flick') {
    return (
      <SnapRating
        key={idx}
        photoUrl={pv[idx].url}
        showHint={idx === 0}
        onClose={onExit}
        onRate={onRate}
        onSkip={onSkip}
      />
    );
  }

  return (
    <div className="rate-sheet">
      <div className="rate-sheet-inner">
        <TasteGrowth live={dishes} onExit={onExit} />
      </div>
    </div>
  );
}
