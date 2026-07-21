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
import { normalizePhoto } from '@/lib/image';
import { readPhotoMeta, type PhotoMeta } from '@/lib/photoMeta';
import SnapRating from '@/components/SnapRating';
import TasteGrowth, { type GrowDish, type GrowPlace, type NameEdit } from '@/components/TasteGrowth';

type Phase = 'flick' | 'grow';
type Prepared = { file: File; url: string; meta: PhotoMeta };

const freshDish = (url: string, score: number): GrowDish => ({
  photoUrl: url, score, status: 'creating', dishId: null, isDish: true,
  name: '', name_zh: null, cuisine: null, ingredients: [], diet: [], heaviness: null, enriched: false,
  coords: null, nearby: [], placeLoading: false, hasLocation: false, choice: null,
});

export default function RatingStack({ photos, onExit }: { photos: File[]; onExit: () => void }) {
  const { t, lang } = useLang();
  // Normalize every photo up front with the SAME util the /log flow uses (image.ts):
  // HEIC → JPEG (Chrome can't render HEIC, vision can't read it) AND downscale to
  // ≤1600px. The downscale is what prevents the 413: a modern phone photo is 8-10MB
  // and Vercel's edge rejects bodies over ~4.5MB before our route ever runs — observed
  // live (first photo of a field session bounced, silently). EXIF (GPS + taken-at) is
  // read from the ORIGINAL file BEFORE conversion — the canvas re-encode strips it.
  // null = still decoding.
  const [prepared, setPrepared] = useState<Prepared[] | null>(null);
  useEffect(() => {
    let alive = true; let made: string[] = [];
    Promise.all([Promise.all(photos.map(f => normalizePhoto(f))), Promise.all(photos.map(readPhotoMeta))]).then(([fs, metas]) => {
      if (!alive) return;
      made = fs.map(f => URL.createObjectURL(f));
      setPrepared(fs.map((file, i) => ({ file, url: made[i], meta: metas[i] })));
    });
    return () => { alive = false; made.forEach(u => URL.revokeObjectURL(u)); };
  }, [photos]);

  const [idx, setIdx] = useState(0);
  const [dishes, setDishes] = useState<GrowDish[]>([]); // one per RATED card (skips omitted)
  const [phase, setPhase] = useState<Phase>('flick');
  // The REAL engine state (from /api/buddy) that drives the growth bar — the dishi
  // version ladder: progress toward the NEXT version (toward v1 while locked), and
  // the ratcheted version number for the unlocked line. Refreshed as ratings +
  // enrichment land (both move the profile).
  const [engine, setEngine] = useState<{ fill: number; ready: boolean; v: number; hintKey: string; hintParams?: Record<string, number> } | null>(null);
  const refreshBuddy = async () => {
    try {
      const j = await fetch('/api/buddy').then(r => (r.ok ? r.json() : null));
      const s = j?.state;
      const vz = s?.version;
      if (!vz || typeof vz.progress !== 'number') return;
      setEngine({
        fill: Math.min(100, vz.progress * 100),
        ready: vz.v >= 1,          // v1 ≡ the export unlock, by construction
        v: vz.v,
        hintKey: s.hint?.key ?? 'buddy.hint.tune',
        hintParams: s.hint?.params,
      });
    } catch { /* keep the last good reading */ }
  };
  const countRef = useRef(0); // stable index into `dishes` for out-of-order pipeline patches
  const sessionDishIds = useRef<string[]>([]); // every dish this session created (for cancel)
  // The source (file + EXIF) behind each RATED card, kept so a failed upload can be
  // retried in place — the File is still in memory, no re-pick needed.
  const ratedSrc = useRef<Record<number, Prepared>>({});
  // Per-dish rename generation: guards force-enrich responses against staleness (two
  // quick renames — only the latest response may land) and lets TasteGrowth know when
  // a REAL post-rename derivation arrived (GrowDish.enrichGen).
  const renameGen = useRef<Record<number, number>>({});

  const patch = (i: number, upd: Partial<GrowDish>) =>
    setDishes(prev => prev.map((d, j) => (j === i ? { ...d, ...upd } : d)));

  // Cancel (the ✕): the whole session was optimistically committed as it was flicked,
  // so bailing out must DELETE what it created. The DELETE route cascades each rating
  // away AND replays the taste profile, so the engine honestly rewinds (nothing learned
  // from a discarded session). "Done" (the ✓) keeps everything — that's onExit.
  const cancelSession = () => {
    sessionDishIds.current.forEach(id =>
      fetch('/api/my/dishes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dish_id: id }) }).catch(() => {}));
    sessionDishIds.current = [];
    onExit();
  };

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

  // ── Shared pipeline steps (reused by the first run AND a not-a-dish reclassify) ──
  const seal = (dishId: string) =>
    fetch('/api/seals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dish_id: dishId }) }).catch(() => {});
  const rate = (dishId: string, score: number) =>
    fetch('/api/ratings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dish_id: dishId, score }) }).catch(() => {});
  const enrich = (i: number, dishId: string) =>
    fetch('/api/dishes/enrich', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: dishId }) })
      .then(r => (r.ok ? r.json() : null))
      // Only overwrite ingredients when enrich actually produced some (the typed-name /
      // reclassify slow path) — never clobber vision's create-time list back to [] on the
      // photo fast-path (which returns the stored dish, no ingredients).
      .then(j => { if (j?.dish) patch(i, { ...(Array.isArray(j.dish.ingredients) && j.dish.ingredients.length ? { ingredients: j.dish.ingredients } : {}), diet: j.dish.diet ?? [], heaviness: j.dish.heaviness ?? null, name_zh: j.dish.name_zh ?? undefined, enriched: true }); refreshBuddy(); })
      .catch(() => {});
  // Post-rename RE-derivation — the REAL one (the 720ms chip animation used to be a
  // simulation restoring the OLD chips; see TasteGrowth). force:true makes the enrich
  // route re-reason from the CURRENT (just-renamed) name and overwrite attributes/
  // diet/method/heaviness — the typed name is the derivation seed, per the authority
  // ladder (HUMAN > VISION); the photo never overrides it. enrichGen tells TasteGrowth
  // "the real result landed" so the chips re-animate on DATA, not a timer. Always
  // bumped — even on failure — so the re-analysing state can never stick forever
  // (a failed re-derive honestly falls back to the current server state).
  const reDerive = (i: number, dishId: string) => {
    const gen = (renameGen.current[i] ?? 0) + 1;
    renameGen.current[i] = gen;
    return fetch('/api/dishes/enrich', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: dishId, force: true }) })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (renameGen.current[i] !== gen) return; // a newer rename superseded this response
        if (j?.dish) patch(i, { ingredients: j.dish.ingredients ?? [], diet: j.dish.diet ?? [], heaviness: j.dish.heaviness ?? null, name_zh: j.dish.name_zh ?? undefined, enriched: true, enrichGen: gen });
        else patch(i, { enrichGen: gen });
        refreshBuddy(); // force mode replays the profile server-side — reflect it
      })
      .catch(() => { if (renameGen.current[i] === gen) patch(i, { enrichGen: gen }); });
  };
  // EXIF coords → real nearby list → auto-confirm + persist the nearest (correctable).
  const loadNearby = async (i: number, dishId: string, coords: { lat: number; lng: number }) => {
    patch(i, { coords, hasLocation: true, placeLoading: true });
    try {
      const nr = await fetch(`/api/restaurants/nearby?lat=${coords.lat}&lng=${coords.lng}&lang=${lang === 'zh' ? 'zh' : 'en'}`);
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
      if (top) persistPlace(dishId, top); // optimistic-commit the nearest; correctable
    } catch { patch(i, { placeLoading: false }); }
  };
  // The full rename cascade (name_edited_at + translate the cleared field + reanalyzeAnchored).
  const renamePatch = (dishId: string, e: NameEdit) =>
    fetch('/api/my/dishes', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dish_id: dishId, name: e.en || undefined, name_zh: e.zh || null, edited_en: e.edEn, edited_zh: e.edZh }),
    }).then(r => (r.ok ? r.json() : null)).catch(() => null);

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
      sessionDishIds.current.push(d.id); // track for cancel-discard
      const isDish = d.is_dish !== false;
      patch(i, {
        status: 'ready', dishId: d.id, isDish,
        name: d.name, name_zh: d.name_zh, cuisine: d.cuisine ?? null,
        // Vision already read off the ingredients + diet at create — show them NOW
        // (the enrich fast-path returns none for photo dishes, which already carry
        // attributes). This is what makes the chips appear and the taste blob absorb.
        ingredients: d.ingredients ?? [], diet: d.diet ?? [], heaviness: d.heaviness ?? null, coords: meta.coords ?? null,
      });

      // NOT FOOD: never sealed, rated, or enriched — a non-dish must never move the taste
      // engine. (Reclassifying via "係嘢食嚟" starts the real pipeline; see onReclassify.)
      if (!isDish) return;

      await seal(d.id);   // seal BEFORE the rating (honesty contract), awaited for ordering
      await rate(d.id, score); // the held flick score becomes the rating (reveals any seal)
      refreshBuddy();     // real engine confidence just moved → update the bar
      enrich(i, d.id);    // background: ingredients / diet / cooking / heaviness
      if (meta.coords) loadNearby(i, d.id, meta.coords);
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

  // Rename on the growth screen → persist the full cascade, then RE-derive for real:
  // the PATCH's own reanalyzeAnchored (photo-anchored) resolves first, and reDerive
  // (name-seeded) runs after and overwrites — so when the two disagree (the observed
  // 鴨-beats-油雞 case), the typed name wins. Sequenced, so there is no race.
  const onEditName = (i: number, e: NameEdit) => {
    const gd = dishes[i];
    if (!gd?.dishId) return;
    const dishId = gd.dishId;
    patch(i, { name: e.en || gd.name, name_zh: e.zh || gd.name_zh }); // optimistic
    renamePatch(dishId, e).then(j => {
      if (j?.dish) patch(i, { name: j.dish.name, name_zh: j.dish.name_zh ?? gd.name_zh, diet: j.dish.diet ?? gd.diet });
      reDerive(i, dishId); // the identity changed → re-derive from the NEW name
    });
  };

  // "It IS food" on a mis-flagged non-dish → name it, then run the REAL pipeline (now it
  // teaches): rename cascade → seal → rate the held flick score → enrich → nearby.
  const onReclassify = (i: number, e: NameEdit) => {
    const gd = dishes[i];
    if (!gd?.dishId) return;
    const dishId = gd.dishId;
    patch(i, { isDish: true, name: e.en || gd.name, name_zh: e.zh || gd.name_zh });
    (async () => {
      await renamePatch(dishId, e);
      await seal(dishId);
      await rate(dishId, gd.score);
      refreshBuddy();
      // Name-seeded, forced: a reclassified non-dish may already carry photo-derived
      // attributes (from the PATCH cascade), which would no-op a plain enrich.
      reDerive(i, dishId);
      if (gd.coords) loadNearby(i, dishId, gd.coords);
    })();
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
    ratedSrc.current[i] = pv[idx]; // keep the source so a failed upload can retry in place
    setDishes(prev => [...prev, freshDish(pv[idx].url, score)]);
    runPipeline(pv[idx].file, score, i, pv[idx].meta); // detached — don't block advancing
    gotoNextOrGrow(true);
  };
  // Retry a failed card (upload bounced — 413/network/5xx). The File is still in
  // memory; re-run the whole pipeline for that index with the same held score.
  const onRetry = (i: number) => {
    const src = ratedSrc.current[i];
    const gd = dishes[i];
    if (!src || !gd) return;
    patch(i, { status: 'creating' });
    runPipeline(src.file, gd.score, i, src.meta);
  };
  const onSkip = () => gotoNextOrGrow(countRef.current > 0);

  if (phase === 'flick') {
    return (
      <SnapRating
        key={idx}
        photoUrl={pv[idx].url}
        showHint={idx === 0}
        onClose={cancelSession}
        onRate={onRate}
        onSkip={onSkip}
      />
    );
  }

  return (
    <div className="rate-sheet">
      <div className="rate-sheet-inner">
        <TasteGrowth live={dishes} engine={engine} onExit={onExit} onCancel={cancelSession} onPickPlace={onPickPlace} onEditName={onEditName} onReclassify={onReclassify} onRetry={onRetry} />
      </div>
    </div>
  );
}
