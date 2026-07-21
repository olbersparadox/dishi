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
import type { FormInputs } from '@/lib/blobForm';

type Phase = 'flick' | 'grow';
type Prepared = { file: File; url: string; meta: PhotoMeta };

/** A dish that ALREADY EXISTS and is waiting to be rated (待評菜式 — a menu-scan or
 *  shared-table pick). Rated through the same flick → growth flow as an album batch,
 *  but nothing is created and nothing may ever be deleted: see `picksMode` below. */
export type ExistingPick = {
  dishId: string;
  photoUrl: string | null;
  name: string;
  name_zh: string | null;
  coords: { lat: number; lng: number } | null;
};

const freshDish = (url: string | null, score: number): GrowDish => ({
  photoUrl: url, score, status: 'creating', dishId: null, isDish: true,
  name: '', name_zh: null, cuisine: null, ingredients: [], diet: [], heaviness: null, enriched: false,
  coords: null, nearby: [], placeLoading: false, hasLocation: false, choice: null,
});

export default function RatingStack({ photos, picks, userId, onExit }: {
  /** Album/camera batch: brand-new dishes get CREATED from these files. */
  photos?: File[];
  /** Queued picks: dishes that already exist and only need sealing + rating. */
  picks?: ExistingPick[];
  userId: string;
  onExit: () => void;
}) {
  const { t, lang } = useLang();
  // Normalize every photo up front with the SAME util the /log flow uses (image.ts):
  // HEIC → JPEG (Chrome can't render HEIC, vision can't read it) AND downscale to
  // ≤1600px. The downscale is what prevents the 413: a modern phone photo is 8-10MB
  // and Vercel's edge rejects bodies over ~4.5MB before our route ever runs — observed
  // live (first photo of a field session bounced, silently). EXIF (GPS + taken-at) is
  // read from the ORIGINAL file BEFORE conversion — the canvas re-encode strips it.
  // null = still decoding.
  const [prepared, setPrepared] = useState<Prepared[] | null>(null);
  // picksMode: rating dishes that ALREADY EXIST. Nothing is uploaded or created, and
  // — the load-bearing part — nothing this session may ever be deleted, because these
  // dishes were not ours to make. See cancelSession + the ✕ handling at the bottom.
  const picksMode = !!picks?.length;
  useEffect(() => {
    if (picksMode) return;                 // no files to decode
    const files = photos ?? [];
    let alive = true; let made: string[] = [];
    Promise.all([Promise.all(files.map(f => normalizePhoto(f))), Promise.all(files.map(readPhotoMeta))]).then(([fs, metas]) => {
      if (!alive) return;
      made = fs.map(f => URL.createObjectURL(f));
      setPrepared(fs.map((file, i) => ({ file, url: made[i], meta: metas[i] })));
    });
    return () => { alive = false; made.forEach(u => URL.revokeObjectURL(u)); };
  }, [photos, picksMode]);

  const [idx, setIdx] = useState(0);
  const [dishes, setDishes] = useState<GrowDish[]>([]); // one per RATED card (skips omitted)
  const [phase, setPhase] = useState<Phase>('flick');
  // The REAL engine state (from /api/buddy) that drives the growth bar — the dishi
  // version ladder: progress toward the NEXT version (toward v1 while locked), and
  // the ratcheted version number for the unlocked line. Refreshed as ratings +
  // enrichment land (both move the profile).
  const [engine, setEngine] = useState<{ fill: number; ready: boolean; v: number; hintKey: string; hintParams?: Record<string, number>; justUnlocked?: boolean } | null>(null);
  // The REAL profile inputs behind the growth screen's header blob — the same
  // vector/evidence/ratingCount/seed blobForm.ts consumes everywhere else, so the
  // shape growing in front of the user IS their actual identity, not a mock. Same
  // response as `engine` above; refreshed together so the bar and the blob can never
  // show two different moments of the profile.
  const [blobInputs, setBlobInputs] = useState<FormInputs | null>(null);
  const baselineV = useRef<number | null>(null); // version at session start (see justUnlocked)
  // While any rating session is open, hide the Taste-AI page's own blob behind the
  // glass (body class → .taste-blob-anchor). The overlays here are deliberately
  // translucent — the page glows through — but two blobs reading at once looked like
  // a mistake; the only blob on screen should be the growth header's.
  useEffect(() => {
    document.body.classList.add('rating-open');
    return () => document.body.classList.remove('rating-open');
  }, []);
  const refreshBuddy = async () => {
    try {
      const j = await fetch('/api/buddy').then(r => (r.ok ? r.json() : null));
      const s = j?.state;
      const vz = s?.version;
      if (!vz || typeof vz.progress !== 'number') return;
      // Remember the version the session STARTED at, so 「已經解鎖」 fires only when
      // the ladder actually moves in front of the user — not on every visit forever.
      if (baselineV.current === null) baselineV.current = vz.v;
      setEngine({
        fill: Math.min(100, vz.progress * 100),
        ready: vz.v >= 1,          // v1 ≡ the export unlock, by construction
        v: vz.v,
        hintKey: s.hint?.key ?? 'buddy.hint.tune',
        hintParams: s.hint?.params,
        justUnlocked: vz.v > (baselineV.current ?? vz.v),
      });
      setBlobInputs({
        vector: s.vector ?? {}, evidence: s.evidence ?? {},
        ratingCount: s.stats?.ratings ?? 0, seed: `${userId}:v${s.profile_version ?? 1}`,
      });
    } catch { /* keep the last good reading */ }
  };
  // Read the engine ONCE ON MOUNT, before anything is rated. Without this the growth
  // screen opened with no reading at all and fell back to a synthetic bar that started
  // at a fixed BASE and then snapped to the truth — so the bar appeared to begin at an
  // earlier level than the person is actually at, and the locked line guessed "v1" even
  // for someone long past it. Seeding the real pre-session value means the bar starts
  // where they genuinely are and only ever moves on real learning.
  useEffect(() => { refreshBuddy(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
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
  // AWAITED, deliberately: these used to be fired off and abandoned while onExit() ran
  // immediately, so the Taste-AI page refetched its lists BEFORE the deletes landed and
  // the discarded dishes were still sitting in 已評菜式 until a manual page refresh.
  // allSettled (not all) so one failed delete can't strand the user in the sheet.
  const cancelSession = async () => {
    // picksMode NEVER deletes: those dishes existed before this screen opened (a
    // menu-scan pick, already sealed) and discarding them would destroy something the
    // person deliberately queued. Their ✕ is a plain close — a flicked rating stands,
    // correctable through 重新評分 in 食記, which replays the whole history honestly.
    if (picksMode) { onExit(); return; }
    const ids = sessionDishIds.current;
    sessionDishIds.current = [];
    await Promise.allSettled(ids.map(id =>
      fetch('/api/my/dishes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dish_id: id }) })));
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
    }).then(r => (r.ok ? r.json() : null)).catch(() => null);
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
  // Live GPS, resolved at most once per session and shared by every card that needs it.
  // Photos taken with the phone camera through a file input usually carry NO EXIF GPS
  // (iOS strips it), so those dishes previously got no location offer at all. For a shot
  // taken moments ago the device's CURRENT position is the honest answer.
  const liveCoords = useRef<Promise<{ lat: number; lng: number } | null> | null>(null);
  const getLiveCoords = () => {
    if (!liveCoords.current) {
      liveCoords.current = new Promise(resolve => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => resolve(null),                       // denied / unavailable: stay silent
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
        );
      });
    }
    return liveCoords.current;
  };
  // Only for photos plausibly taken JUST NOW — otherwise "where the phone is" is a lie
  // about where an old album shot was eaten. EXIF time when present, else the file's own
  // mtime (a fresh capture is written now; an album pick keeps its original date).
  const RECENT_MS = 60 * 60 * 1000;
  const looksJustTaken = (p: Prepared) => {
    const stamp = p.meta.takenAt?.getTime() ?? p.file.lastModified;
    return typeof stamp === 'number' && Date.now() - stamp < RECENT_MS;
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
      // EXIF coords win (they say where it was actually eaten). Failing that, a photo
      // taken moments ago gets the device's live position — the camera path had no
      // location offer at all before this.
      if (meta.coords) loadNearby(i, d.id, meta.coords);
      else if (looksJustTaken({ file, url: '', meta })) {
        const live = await getLiveCoords();
        if (live) loadNearby(i, d.id, live);
      }
    } catch { patch(i, { status: 'failed' }); }
  }

  // The pipeline for a QUEUED PICK. The dish already exists, so there is no upload and
  // no create — but the sealed-bet ordering is identical and non-negotiable: seal (the
  // route is idempotent, so a pick sealed at scan time just no-ops) strictly BEFORE the
  // rating. The dish id is never pushed to sessionDishIds: nothing here is ours to delete.
  async function runPickPipeline(pick: ExistingPick, score: number, i: number) {
    try {
      patch(i, {
        status: 'ready', dishId: pick.dishId, isDish: true,
        name: pick.name, name_zh: pick.name_zh, coords: pick.coords,
      });
      await seal(pick.dishId);
      await rate(pick.dishId, score);
      refreshBuddy();
      enrich(i, pick.dishId);   // fills in ingredients/diet chips if it never got them
      if (pick.coords) loadNearby(i, pick.dishId, pick.coords);
    } catch { patch(i, { status: 'failed' }); }
  }

  // A pick on the growth screen (live mode): persist it. Home / skip clear the restaurant.
  const onPickPlace = (i: number, label: string) => {
    patch(i, { choice: label }); // optimistic display
    const gd = dishes[i];
    if (!gd?.dishId) return;
    if (label === t('place.home') || label === t('grow.skip')) { persistPlace(gd.dishId, null); return; }
    const place = (gd.nearby ?? []).find(p => p.label === label);
    if (place) persistPlace(gd.dishId, place);
  };

  // A TYPED restaurant name ("+ 加間舖"). resolveOrCreateRestaurant REQUIRES finite
  // coords ("a new restaurant needs a name and location"), so a manual add with no
  // location would 400 and vanish — which is exactly how this read as "nothing
  // happens". Use the dish's own coords, else ask for live GPS, and if there is
  // genuinely no position, roll the optimistic label back instead of pretending.
  const onAddPlace = async (i: number, name: string) => {
    const gd = dishes[i];
    if (!gd?.dishId) return;
    const prev = gd.choice ?? null;
    patch(i, { choice: name, placeError: false }); // optimistic; clears any prior failure
    const coords = gd.coords ?? (await getLiveCoords());
    if (!coords) { patch(i, { choice: prev, placeError: true }); return; }
    const res = await persistPlace(gd.dishId, { label: name, source: 'manual', lat: coords.lat, lng: coords.lng });
    if (!res || !('ok' in res)) patch(i, { choice: prev, placeError: true });
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

  // Still decoding (e.g. HEIC → JPEG) — a brief loading sheet. Picks have nothing to
  // decode, so they skip straight past it.
  if (!picksMode && !prepared) return (
    <div className="rate-sheet"><div className="rate-sheet-inner rate-loading">{t('rate.preparing')}</div></div>
  );
  const pv = prepared ?? [];
  const pk = picks ?? [];
  const cardCount = picksMode ? pk.length : pv.length;
  if (!cardCount) return null;

  const gotoNextOrGrow = (ratedAnything: boolean) => {
    if (idx + 1 >= cardCount) { if (ratedAnything) setPhase('grow'); else onExit(); }
    else setIdx(i => i + 1);
  };
  const onRate = (score: number) => {
    const i = countRef.current++;
    if (picksMode) {
      const pick = pk[idx];
      setDishes(prev => [...prev, freshDish(pick.photoUrl, score)]);
      runPickPipeline(pick, score, i);
    } else {
      ratedSrc.current[i] = pv[idx]; // keep the source so a failed upload can retry in place
      setDishes(prev => [...prev, freshDish(pv[idx].url, score)]);
      runPipeline(pv[idx].file, score, i, pv[idx].meta); // detached — don't block advancing
    }
    gotoNextOrGrow(true);
  };
  // Retry a failed card (upload bounced — 413/network/5xx). The File is still in
  // memory; re-run the whole pipeline for that index with the same held score.
  const onRetry = (i: number) => {
    const gd = dishes[i];
    if (!gd) return;
    patch(i, { status: 'creating' });
    if (picksMode) {
      const pick = pk.find(p => p.dishId === gd.dishId);
      if (pick) runPickPipeline(pick, gd.score, i);
      return;
    }
    const src = ratedSrc.current[i];
    if (!src) return;
    runPipeline(src.file, gd.score, i, src.meta);
  };
  const onSkip = () => gotoNextOrGrow(countRef.current > 0);

  if (phase === 'flick') {
    const card = picksMode ? pk[idx] : null;
    return (
      <SnapRating
        key={idx}
        photoUrl={picksMode ? card!.photoUrl : pv[idx].url}
        // A queued pick usually has no photo (it came off a menu), so the card leads
        // with its NAME instead — otherwise there'd be nothing to rate against.
        dishName={card?.name}
        dishNameZh={card?.name_zh ?? undefined}
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
        {/* No onCancel in picksMode: TasteGrowth falls back to onExit, so its ✕ is a
            plain close-and-keep rather than a discard that would delete dishes we
            never created. */}
        <TasteGrowth live={dishes} engine={engine} blobInputs={blobInputs} onExit={onExit} onCancel={picksMode ? undefined : cancelSession} onPickPlace={onPickPlace} onAddPlace={onAddPlace} onEditName={onEditName} onReclassify={onReclassify} onRetry={onRetry} />
      </div>
    </div>
  );
}
