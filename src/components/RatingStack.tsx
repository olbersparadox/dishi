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
import { readPhotoMeta, type PhotoMeta } from '@/lib/photoMeta';
import SnapRating from '@/components/SnapRating';
import TasteGrowth, { type GrowDish, type GrowPlace } from '@/components/TasteGrowth';

type Phase = 'flick' | 'grow';
type Prepared = { file: File; url: string; meta: PhotoMeta };

const freshDish = (url: string, score: number): GrowDish => ({
  photoUrl: url, score, status: 'creating', dishId: null, isDish: true,
  name: '', name_zh: null, cuisine: null, ingredients: [], diet: [], heaviness: null, enriched: false,
  coords: null, nearby: [], placeLoading: false, hasLocation: false, choice: null,
});

export default function RatingStack({ photos, onExit }: { photos: File[]; onExit: () => void }) {
  const { t, lang } = useLang();
  // Convert any HEIC (iPhone default) to JPEG up front — Chrome can't render HEIC in an
  // <img>, and vision needs a readable type too. We keep BOTH the converted File (to
  // upload) and its object URL (to preview). EXIF (GPS + taken-at) is read from the
  // ORIGINAL file BEFORE conversion — the canvas re-encode strips it. null = still decoding.
  const [prepared, setPrepared] = useState<Prepared[] | null>(null);
  useEffect(() => {
    let alive = true; let made: string[] = [];
    Promise.all([toDisplayableAll(photos), Promise.all(photos.map(readPhotoMeta))]).then(([fs, metas]) => {
      if (!alive) return;
      made = fs.map(f => URL.createObjectURL(f));
      setPrepared(fs.map((file, i) => ({ file, url: made[i], meta: metas[i] })));
    });
    return () => { alive = false; made.forEach(u => URL.revokeObjectURL(u)); };
  }, [photos]);

  const [idx, setIdx] = useState(0);
  const [dishes, setDishes] = useState<GrowDish[]>([]); // one per RATED card (skips omitted)
  const [phase, setPhase] = useState<Phase>('flick');
  const countRef = useRef(0); // stable index into `dishes` for out-of-order pipeline patches

  const patch = (i: number, upd: Partial<GrowDish>) =>
    setDishes(prev => prev.map((d, j) => (j === i ? { ...d, ...upd } : d)));

  // Persist (or clear) a dish's restaurant — same resolution the log flow uses.
  const persistPlace = (dishId: string, place: GrowPlace | null) => {
    const body = !place
      ? { dish_id: dishId, clear: true }
      : place.source === 'dishi'
        ? { dish_id: dishId, restaurant_id: place.restaurant_id }
        : { dish_id: dishId, new_restaurant: { name: place.label, lat: place.lat, lng: place.lng, place_id: place.place_id } };
    return fetch('/api/dishes/restaurant', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).catch(() => {});
  };

  // The REAL pipeline for one rated card. Runs detached (the user has already moved on
  // to the next card); each step patches this dish's row in place as it lands.
  async function runPipeline(file: File, score: number, i: number, meta: PhotoMeta) {
    try {
      const form = new FormData();
      form.append('photo', file);
      form.append('source', 'album');
      // EXIF: where + when it was eaten (best-effort; absent on stripped photos).
      if (meta.coords) { form.append('lat', String(meta.coords.lat)); form.append('lng', String(meta.coords.lng)); }
      if (meta.takenAt) form.append('eaten_at', meta.takenAt.toISOString());
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

      // Location: EXIF coords → the real nearby list (distance-ranked fixed-10) → auto-
      // confirm the nearest as an optimistic guess (persisted) that the user can change.
      if (meta.coords) {
        patch(i, { coords: meta.coords, hasLocation: true, placeLoading: true });
        try {
          const nr = await fetch(`/api/restaurants/nearby?lat=${meta.coords.lat}&lng=${meta.coords.lng}&lang=${lang === 'zh' ? 'zh' : 'en'}`);
          const nj = await nr.json().catch(() => null);
          const list: any[] = nj?.restaurants ?? [];
          const rich: GrowPlace[] = list.map((r: any) => ({
            label: String(lang === 'zh' ? (r.name_zh ?? r.name) : r.name),
            lat: r.lat, lng: r.lng, source: r.source,
            restaurant_id: r.source === 'dishi' ? r.id : undefined,
            place_id: r.source === 'google' ? r.place_id : undefined,
          })).filter(p => p.label);
          const top = rich[0] ?? null;
          patch(i, { nearby: rich, placeLoading: false, choice: top ? top.label : null });
          if (top) persistPlace(d.id, top); // optimistic-commit the nearest; correctable
        } catch { patch(i, { placeLoading: false }); }
      }
    } catch { patch(i, { status: 'failed' }); }
  }

  // A pick on the growth screen (live mode): persist it. Home / skip clear the
  // restaurant; a manual "add" is a later-phase stub (kept as a local label for now).
  const onPickPlace = (i: number, label: string) => {
    patch(i, { choice: label }); // optimistic display
    const gd = dishes[i];
    if (!gd?.dishId) return;
    if (label === t('place.home') || label === t('grow.skip')) { persistPlace(gd.dishId, null); return; }
    if (label === t('grow.addplace')) return;
    const place = (gd.nearby ?? []).find(p => p.label === label);
    if (place) persistPlace(gd.dishId, place);
  };

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
    runPipeline(pv[idx].file, score, i, pv[idx].meta); // detached — don't block advancing
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
        <TasteGrowth live={dishes} onExit={onExit} onPickPlace={onPickPlace} />
      </div>
    </div>
  );
}
