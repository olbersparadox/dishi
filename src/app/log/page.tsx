'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGate from '@/components/AuthGate';
import RestaurantPicker, { RestaurantChoice } from '@/components/RestaurantPicker';
import FlickRating from '@/components/FlickRating';
import { normalizePhoto } from '@/lib/image';
import DishName from '@/components/DishName';
import PhotoPicker from '@/components/PhotoPicker';
import { CloseIcon, CameraIcon, RateIcon, TrashIcon, EditIcon, CheckIcon } from '@/components/icons';
import { useLang, cuisineLabel } from '@/lib/i18n';
import { takePendingPhoto } from '@/lib/pendingPhoto';

type Dish = { id: string; name: string; name_zh?: string | null; cuisine: string; photo_url: string | null; vision_confidence?: number; is_dish?: boolean; vision_failed?: boolean };
type Pick = { id: string; name: string; name_zh: string | null; cuisine: string; source: string; restaurant: string | null };

export default function LogPage() {
  return (
    <AuthGate>
      <LogFlow />
    </AuthGate>
  );
}

function LogFlow() {
  const { t, lang } = useLang();
  const router = useRouter();
  // Which entry chip on the Taste tab brought us here. Each mode strips what its
  // path doesn't need: 'home' has no restaurant step at all (home cooking has no
  // restaurant); 'album' is photo-library-first (no typed-only pill — an album
  // log IS a photo) with the restaurant question demoted to skip-first, since an
  // old shot probably wasn't taken where the user is standing now. 'restaurant'
  // is the classic flow unchanged, and any unrecognized/absent value falls back
  // to it so old links keep working. Read once at mount — the mode is fixed for
  // the life of the flow.
  const [mode] = useState<'restaurant' | 'home' | 'album'>(() => {
    if (typeof window === 'undefined') return 'restaurant';
    const s = new URLSearchParams(window.location.search).get('source');
    return s === 'home' || s === 'album' ? s : 'restaurant';
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState<RestaurantChoice>(null);
  // No-photo path: type what you ate instead of photographing it.
  const [noPhotoMode, setNoPhotoMode] = useState(false);
  const [typedEn, setTypedEn] = useState('');
  const [typedZh, setTypedZh] = useState('');
  const [creatingNoPhoto, setCreatingNoPhoto] = useState(false);
  const [noPhotoError, setNoPhotoError] = useState('');
  // The typed name must be explicitly CONFIRMED (the ✓ button) before the shared
  // 繼續 button below the card activates — editing either field un-confirms it.
  const [noPhotoConfirmed, setNoPhotoConfirmed] = useState(false);
  // Which language field the user actually typed in. Mirrors the Eat-Journal edit
  // (MyDishes): typing in one language clears the OTHER unless it was hand-edited,
  // so a name is authored in one language and the other is derived.
  const [typedEnEdited, setTypedEnEdited] = useState(false);
  const [typedZhEdited, setTypedZhEdited] = useState(false);
  const [dish, setDish] = useState<Dish | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftNameZh, setDraftNameZh] = useState('');
  const [editedEn, setEditedEn] = useState(false);
  const [editedZh, setEditedZh] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [nameSaveError, setNameSaveError] = useState<string | null>(null);
  const [relearned, setRelearned] = useState(false);
  const [learnedDims, setLearnedDims] = useState<{ dim: string; dir: number }[] | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [sealedIds, setSealedIds] = useState<Set<string>>(new Set());
  const [ratingExistingPick, setRatingExistingPick] = useState(false);
  const [addingPhoto, setAddingPhoto] = useState(false);
  const [confirmedAnyway, setConfirmedAnyway] = useState(false);
  const [sameDish, setSameDish] = useState<{ dish_id: string; name: string; name_zh: string | null } | null>(null);
  const [sameDishBusy, setSameDishBusy] = useState(false);

  function onPickPhoto(f: File | null) {
    setPhoto(f);
    setPreview(prev => {
      if (prev) URL.revokeObjectURL(prev); // release the old blob before making a new one
      return f ? URL.createObjectURL(f) : null;
    });
    setDish(null);
  }

  // Album entry (Taste tab "+相簿舊菜") opens the OS photo picker itself and hands
  // the chosen file here, so an album log lands straight on this screen with its
  // photo already loaded — no redundant "tap to pick" step. Consumed once; a
  // refresh wipes the hand-off and just shows the normal photo-first picker.
  useEffect(() => {
    if (mode !== 'album') return;
    const handed = takePendingPhoto();
    if (handed) onPickPhoto(handed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Creates a dish from a typed name (no photo) and drops straight into rating it.
   * Same dishes table, same rating pipeline, same taste engine — the ONLY thing
   * missing is the photo, which was never what the engine learned from. */
  // ✓ confirm: just mark the typed name ready — instant. Translation of the other
  // language is DEFERRED to the background enrich after Continue (fix B), so this no
  // longer blocks on a ~20s qwen call; the other name fills in on the rating screen.
  function confirmName() {
    if (typedZh.trim() || typedEn.trim()) setNoPhotoConfirmed(true);
  }

  async function createWithoutPhoto() {
    if (creatingNoPhoto) return;
    setCreatingNoPhoto(true); setNoPhotoError('');
    try {
      const res = await fetch('/api/dishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: typedEn.trim() || undefined,
          name_zh: typedZh.trim() || undefined,
          restaurant_id: mode !== 'home' && restaurant?.kind === 'existing' ? restaurant.id : undefined,
          new_restaurant: mode !== 'home' && restaurant?.kind === 'new' ? restaurant : undefined,
          source: mode === 'home' ? 'home' : undefined, // typed entries default to 'manual' server-side
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not save that dish.');
      setDish(json.dish);
      setRating(null);
      setConfirmedAnyway(false);
      // Fix B: the dish was created name-only for speed. Fill cuisine/attributes/
      // diet + the missing-language name in the background, and let the server heal
      // taste learning if it gets rated first. Fire-and-forget — this survives
      // client-side tab navigation (SPA), and patches the on-screen dish when it
      // lands (translated name, chips). A hard refresh mid-enrich is the only gap,
      // and it self-heals on any later re-rate via replay.
      const newId = json.dish.id as string;
      fetch('/api/dishes/enrich', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: newId }),
      })
        .then(r => (r.ok ? r.json() : null))
        .then(j => { if (j?.dish) setDish(prev => (prev && prev.id === newId ? { ...prev, ...j.dish } : prev)); })
        .catch(() => {});
    } catch (e: any) {
      setNoPhotoError(e.message || 'Could not save that dish.');
    } finally {
      setCreatingNoPhoto(false);
    }
  }

  // Release the object URL when the whole flow unmounts (e.g. navigating away).
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  // Dishes picked off a scanned menu or during a Table Mode session, still waiting
  // to be rated — same rating pipeline as a photographed dish, just entered a
  // different way. Only relevant on the idle (pre-photo) screen.
  useEffect(() => {
    fetch('/api/my/dishes?unrated=1').then(r => r.json()).then(async j => {
      const list = j.dishes ?? [];
      setPicks(list);
      // Deep link from the Taste tab's "dishes to be rated" placeholders: jump
      // straight into rating that specific one, same as tapping "Rate now" here.
      const targetId = new URLSearchParams(window.location.search).get('rate');
      if (targetId) {
        const target = list.find((p: Pick) => p.id === targetId);
        if (target) rateExistingPick(target);
        window.history.replaceState({}, '', '/log'); // don't re-trigger on refresh
      }
      const sealed = new Set<string>();
      await Promise.all(list.map(async (p: Pick) => {
        try {
          const res = await fetch('/api/seals', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dish_id: p.id }),
          });
          const out = await res.json().catch(() => ({}));
          if (out.sealed) sealed.add(p.id);
        } catch { /* non-critical */ }
      }));
      setSealedIds(sealed);
    }).catch(() => setPicks([]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Jump straight into rating an already-picked dish — no photo step needed. */
  function rateExistingPick(pick: Pick) {
    setRatingExistingPick(true);
    setDish({ id: pick.id, name: pick.name, name_zh: pick.name_zh, cuisine: pick.cuisine, photo_url: null });
    setRating(null); setConfirmedAnyway(false);
    setNameSaveError(null);
  }

  /** Back to the upload screen for a fresh photo — used when the person agrees this
   * one probably isn't a dish and wants to try again rather than rate it anyway.
   * Deletes the dish row /api/dishes already created for this photo: without it, a
   * rejected not-a-dish (e.g. a candle photo) stays behind in 待評嘅菜 as "蠟燭"
   * even though the person explicitly declined it. Fire-and-forget — a lingering
   * row is a cosmetic leak, not worth blocking the retake. Never deletes an
   * existing pick (retake is only reachable from the fresh-photo not-a-dish gate,
   * but the guard makes that explicit). */
  function retakePhoto() {
    if (dish && !ratingExistingPick) {
      fetch('/api/my/dishes', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dish_id: dish.id }),
      }).catch(() => {});
    }
    setDish(null); setPhoto(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setConfirmedAnyway(false);
  }

  /** The photo was fine — the READ failed (vision timeout/garbled response after
   * retries). So the retry re-submits the SAME photo, still in memory, rather
   * than making the person re-take anything. The failed row is removed first:
   * without that, every retry would stack another "Unknown dish" into the
   * to-rate queue. Fire-and-forget — a lingering row is a cosmetic leak, not
   * worth blocking the retry the person actually asked for. */
  async function retryRead() {
    if (!dish) return;
    const failedId = dish.id;
    setDish(null);
    fetch('/api/my/dishes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dish_id: failedId }),
    }).catch(() => {});
    await logDish();
  }

  async function deletePick(id: string) {
    setPicks(prev => prev?.filter(p => p.id !== id) ?? null);
    await fetch('/api/my/dishes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dish_id: id }),
    });
  }

  /**
   * Attaches a photo to a dish that doesn't have one yet — specifically for a pick
   * (from a menu scan or Table Mode) being rated here for the first time. Entirely
   * optional: rating with no photo at all keeps working exactly as before, this
   * just closes the gap where there was previously no way to add one afterward.
   */
  async function addPhotoToPick(file: File | null) {
    if (!file || !dish) return;
    setAddingPhoto(true); setError('');
    try {
      const form = new FormData();
      form.append('dish_id', dish.id);
      form.append('photo', await normalizePhoto(file, 1024));
      const res = await fetch('/api/dishes/photo', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not save that photo.');
      setDish(prev => prev ? { ...prev, photo_url: json.dish.photo_url } : prev);
    } catch (e: any) {
      setError(e.message || 'Something went wrong saving that photo.');
    } finally {
      setAddingPhoto(false);
    }
  }

  // Seed the editable name fields from the dish whenever it changes (fresh vision
  // result, or switching to rate an existing pick), and reset the edited-this-
  // session tracking that tells the server which language the PERSON actually typed.
  useEffect(() => {
    if (!dish) return;
    setDraftName(dish.name);
    setDraftNameZh(dish.name_zh ?? '');
    setEditedEn(false); setEditedZh(false);
    setNameSaveError(null); setRelearned(false);
  }, [dish?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dish identity: ask the server whether this dish is one the restaurant's menu
  // already knows under a different name (蝦餃 vs 水晶鮮蝦餃). The server only ever
  // answers when it's genuinely confident (string prefilter -> LLM adjudication,
  // both must pass), so most of the time this quietly returns nothing and the
  // person is never interrupted. Best-effort: a failure just means no prompt.
  useEffect(() => {
    setSameDish(null);
    if (!dish) return;
    let cancelled = false;
    fetch(`/api/dishes/identity?dish_id=${dish.id}`)
      .then(r => r.json())
      .then(j => { if (!cancelled && j.suggestion) setSameDish(j.suggestion); })
      .catch(() => { /* no suggestion is always an acceptable outcome */ });
    return () => { cancelled = true; };
  }, [dish?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * The person answered the "same dish?" question. YES links this dish to the other
   * one's shared identity; NO records nothing and simply stops asking. Either way the
   * prompt disappears and rating continues uninterrupted — this is never a blocker.
   *
   * Linking is purely additive: this dish keeps its own name, photo, attributes and
   * ratings. It gains only a pointer saying "this is the same real thing as that",
   * which is what lets dish locking and the owner dashboard stop treating one
   * dumpling as two.
   */
  async function answerSameDish(same: boolean) {
    if (!dish || !sameDish) return;
    setSameDishBusy(true);
    try {
      await fetch('/api/dishes/identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dish_id: dish.id,
          same_as_dish_id: same ? sameDish.dish_id : undefined,
          not_same_as_dish_id: same ? undefined : sameDish.dish_id,
        }),
      });
    } catch { /* a failed link is not worth blocking the rating over */ }
    setSameDish(null);
    setSameDishBusy(false);
  }

  /**
   * Confirm tapped: saves the corrected name(s) BEFORE rating, via the same endpoint
   * as the home rename form, which runs the full correction cascade server-side —
   * translation of the blanked/untouched language, cuisine re-derivation, attribute
   * re-derivation from the photo anchored on the corrected name, and a profile
   * replay when this dish was already rated (relearned: true comes back so we can
   * tell the person their taste was re-learned from the correction). This replaces
   * the old blur-to-commit override, which never reached the server at all: the
   * correction vanished the moment you rated, and the attributes vision bundled
   * with its WRONG guess stayed to quietly teach the profile bad data.
   */
  async function saveName(): Promise<boolean> {
    if (!dish) return true;
    const name = draftName.trim();
    const name_zh = draftNameZh.trim();
    if (!name && !name_zh) return true; // nothing typed — nothing to commit
    setSavingName(true); setNameSaveError(null);
    try {
      const res = await fetch('/api/my/dishes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dish_id: dish.id, name: name || undefined, name_zh: name_zh || null,
          edited_en: editedEn, edited_zh: editedZh,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not save that name.');
      setDish(prev => prev ? { ...prev, name: json.dish.name, name_zh: json.dish.name_zh, cuisine: json.dish.cuisine } : prev);
      setDraftName(json.dish.name);
      setDraftNameZh(json.dish.name_zh ?? '');
      setEditedEn(false); setEditedZh(false);
      setRelearned(!!json.relearned);
      return true;
    } catch (e: any) {
      setNameSaveError(e.message || 'Something went wrong saving that name.');
      return false;
    } finally {
      setSavingName(false);
    }
  }

  async function logDish() {
    if (!photo) return;
    setBusy(true); setError('');
    const form = new FormData();
    // 1024px is plenty for dish identification (1600 is only needed for menu TEXT)
    // — roughly halves the upload, and converts iPhone HEIC to JPEG.
    form.append('photo', await normalizePhoto(photo, 1024));
    if (mode !== 'home' && restaurant?.kind === 'existing') form.append('restaurant_id', restaurant.id);
    if (mode !== 'home' && restaurant?.kind === 'new') form.append('new_restaurant', JSON.stringify(restaurant));
    // Entry context: 'home' and 'album' record their path; the classic flow's
    // fresh-photo default ('photo') is applied server-side.
    if (mode !== 'restaurant') form.append('source', mode);
    try {
      const res = await fetch('/api/dishes', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setDish(json.dish);
    } catch (e: any) {
      setError(e.message || t('log.uploadfail'));
    } finally {
      setBusy(false);
    }
  }

  /**
   * A swipe (or tap chip) landed on a value. This does NOT submit or navigate —
   * it just records the current rating and reveals the Done button, so the user
   * has room to add a note before anything is final. Swiping again before Done is
   * tapped simply revises this value; Done always applies whatever it currently is.
   */
  function onRate(score: number) {
    setRating(score);
  }

  /** Done tapped: this is now the ONE commit point for the whole screen, not just
   * the rating. If the name fields were touched, that correction is saved FIRST
   * (same server cascade as before: translation, cuisine, attributes, replay if
   * already rated) — no separate inline confirm step exists anymore. A failure
   * there stops here, with the error visible, rather than silently rating against
   * a name that never actually got corrected.
   * Then: submit the rating, show what it actually taught
   * (drawn from the engine's own taughtDims output, so it can never claim
   * learning that didn't happen), then navigate. The brief pause is the cheapest
   * trust mechanic in the app: every single rating visibly does something. */
  async function finishLogging() {
    if (!dish || rating === null || finishing) return;
    setFinishing(true);
    try {
      if (editedEn || editedZh) {
        const ok = await saveName();
        if (!ok) return; // error is already visible; stay here so Done can be retried
      }
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dish_id: dish.id, score: rating }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(json.taught) && json.taught.length > 0) {
        setLearnedDims(json.taught.slice(0, 4));
        await new Promise(r => setTimeout(r, 1400));
      }
      // What this rating actually taught, AND the seal reveal if one existed:
      // both stashed for the Taste tab to show once, right after landing.
      // sessionStorage (not query params) since both are small objects, not flags.
      if (res.ok && Array.isArray(json.taught) && json.taught.length > 0) {
        try { sessionStorage.setItem('dishi_just_learned', JSON.stringify(json.taught.slice(0, 4))); } catch { /* storage may be unavailable */ }
      }
      if (res.ok && json.seal) {
        try { sessionStorage.setItem('dishi_seal_reveal', JSON.stringify(json.seal)); } catch { /* storage may be unavailable */ }
      }
      // Lands on Taste, not Home — this is where "what did I just teach Dishi"
      // and "rate another?" actually belong, and it's the same destination the
      // Taste tab's own to-be-rated placeholders point back into, so the loop
      // (rate -> see what changed -> rate the next one) stays on one screen.
      router.push('/profile?rated=1');
    } finally {
      setFinishing(false);
    }
  }

  // --- Step 1: photo ---
  if (!dish) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 22 }}>
          <h1 style={{ margin: 0 }}>
            {mode === 'home' ? t('log.title.home') : mode === 'album' ? t('log.title.album') : t('log.title')}
          </h1>
          <button className="icon-btn" onClick={() => router.push('/profile')} aria-label={t('log.cancelflow')} title={t('log.cancelflow')}>
            <CloseIcon />
          </button>
        </div>

        {preview ? (
          // Small camera icon overlaid bottom-right on the photo itself — real
          // feedback was that a separate "已揀好 · 撳一下換相" text bar under the
          // photo was extra visual noise for something that reads perfectly well
          // as a small edit affordance ON the photo, the way profile-photo
          // pickers usually work.
          <div style={{ position: 'relative', marginBottom: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Dish preview" className="card-photo card" style={{ marginBottom: 0 }} />
            <RetakePhotoButton onPick={onPickPhoto} />
          </div>
        ) : (
          <div style={{ marginBottom: 14 }}>
            {mode === 'album' && <p className="card-meta" style={{ marginBottom: 8 }}>{t('log.album.hint')}</p>}
            <PhotoPicker onPick={f => onPickPhoto(f)} icon={<CameraIcon size={38} strokeWidth={1.1} />} hideLabel />
          </div>
        )}

        {/* A photo is OPTIONAL, not required. The engine learns from a dish's
            attributes, and a typed name yields real attributes — so a no-photo dish
            teaches it exactly as much. (Menu-scan picks have always worked this way;
            there was simply no way to start one by hand.) Except in album mode:
            an "old photo" log without a photo is a contradiction, so the typed-only
            pill is one of the things that path takes away. */}
        {!preview && !noPhotoMode && mode !== 'album' && (
          <button className="nophoto-pill" style={{ width: '100%', marginBottom: 28 }} onClick={() => setNoPhotoMode(true)}>
            <EditIcon size={17} />
            {t('log.nophoto')}
          </button>
        )}
        {!preview && noPhotoMode && (() => {
          const hasName = !!typedEn.trim() || !!typedZh.trim();
          return (
          <div className="card" style={{ marginBottom: 28 }}><div className="card-body">
            {/* Translate hint sits right after the first label — one line, not a footnote. */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <label className="label" style={{ fontSize: 11.5 }}>{t('home.name.zh')}</label>
              <span className="card-meta" style={{ fontSize: 11 }}>({t('home.translateOnSave')})</span>
            </div>
            {/* Sample placeholders only while both are blank — once you author in one
                language the other reads as empty/pending (not a sample that looks like
                stale content) until ✓ translates it. */}
            <input className="field" style={{ marginBottom: 6 }} value={typedZh} autoFocus
              onChange={e => { setTypedZh(e.target.value); setTypedZhEdited(true); if (!typedEnEdited) setTypedEn(''); setNoPhotoConfirmed(false); }}
              placeholder={typedEn.trim() ? '' : '叉燒飯'} />
            <label className="label" style={{ fontSize: 11.5 }}>{t('home.name.en')}</label>
            <input className="field" value={typedEn}
              onChange={e => { setTypedEn(e.target.value); setTypedEnEdited(true); if (!typedZhEdited) setTypedZh(''); setNoPhotoConfirmed(false); }}
              placeholder={typedZh.trim() ? '' : 'BBQ pork rice'} />

            {/* Restaurant lives in the shared "where" step below — not duplicated here. */}
            {noPhotoError && <p style={{ color: 'var(--lacquer)', fontSize: 12.5, marginTop: 6 }}>{noPhotoError}</p>}

            {/* Confirm (✓) / cancel (✕) as circles, bottom-right. Confirm just marks
                the name ready — the actual proceed is the shared 繼續 below, which
                activates only once confirmed. */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button className="icon-btn" aria-label={t('home.cancel')} title={t('home.cancel')}
                onClick={() => { setNoPhotoMode(false); setNoPhotoError(''); setNoPhotoConfirmed(false); setTypedEnEdited(false); setTypedZhEdited(false); }}>
                <CloseIcon />
              </button>
              <button className="icon-btn" aria-label={t('home.confirm')} title={t('home.confirm')}
                disabled={!hasName}
                style={noPhotoConfirmed
                  ? { background: 'var(--ink)', color: 'var(--paper-raised)' }
                  : !hasName ? { opacity: 0.4 } : undefined}
                onClick={confirmName}>
                <CheckIcon />
              </button>
            </div>
          </div></div>
          );
        })()}

        {/* The "dishes to rate" shortcut is a landing-only prompt. The moment the
            user has picked a photo (or switched to typing a name), they're
            committed to logging THIS dish — showing other pending picks here just
            invites them to wander off and rate something else instead. */}
        {/* Hidden on the home-cooking path: those pending picks are all
            restaurant/menu-scan dishes, so dangling them on the 屋企煮 screen only
            invites wandering off to rate something unrelated to tonight's cooking. */}
        {mode !== 'home' && !preview && !noPhotoMode && picks !== null && picks.length > 0 && (
          <div style={{ margin: '16px 0' }}>
            <label className="label">{t('log.toRate')}</label>
            {picks.map(p => (
              <div className="pick-card" key={p.id}>
                <div style={{ minWidth: 0 }}>
                  <div className="pick-card-name">
                  <DishName name={p.name} name_zh={p.name_zh}
                    suffix={sealedIds.has(p.id) && <span className="seal-stamp" title={t('seal.stamp.title')} aria-label={t('seal.stamp.title')}>印</span>} />
                </div>
                  <div className="pick-card-meta">{p.restaurant ?? t('home.homecooking')}</div>
                </div>
                <div className="pick-card-actions">
                  <button className="icon-btn lg rate" onClick={() => rateExistingPick(p)}
                    aria-label={t('log.rateNow')} title={t('log.rateNow')}>
                    <RateIcon size={20} />
                  </button>
                  <button className="icon-btn lg delete" onClick={() => deletePick(p.id)}
                    aria-label={t('home.delete')} title={t('home.delete')}>
                    <TrashIcon size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Home-cooked: no restaurant step at all. Album: the question survives
            but demoted — skip leads, and the label acknowledges memory is fuzzy. */}
        {mode !== 'home' && (
          <>
            <label className="label">{mode === 'album' ? t('log.album.where') : t('log.where')}</label>
            <RestaurantPicker onChange={setRestaurant} skipFirst={mode === 'album'} />
          </>
        )}

        {error && <p style={{ color: 'var(--lacquer)', marginTop: 12 }}>{error}</p>}
        {/* Shared continue: the photo flow needs a photo; the no-photo flow needs a
            CONFIRMED typed name (the ✓ in the card above). Darkens/enables only when
            its path is ready. */}
        <button
          className="btn primary"
          style={{ width: '100%', marginTop: 28 }}
          disabled={noPhotoMode ? (!noPhotoConfirmed || creatingNoPhoto) : (!photo || busy)}
          onClick={noPhotoMode ? createWithoutPhoto : logDish}
        >
          {noPhotoMode
            ? (creatingNoPhoto ? <span className="icon-spinner" aria-label={t('log.saving')} /> : t('log.continue'))
            : (busy ? t('log.reading') : t('log.continue'))}
        </button>
      </div>
    );
  }

  // dish.name/dish.cuisine are now always the source of truth — saveName() updates
  // them for real (server-side, including cuisine re-derivation) rather than a
  // client-only override that vanished on navigation and never touched cuisine.

  // Vision NEVER RAN (timeout / garbled response even after retries) — different
  // in kind from is_dish:false below, where a model looked and judged. Here
  // nobody looked, so silently proceeding would smuggle an unverified photo past
  // the not-a-dish guard — the one silent path left after the retry fix, and the
  // reason this card exists. Same card pattern as notdish; the honest choice is
  // the person's: re-read the same photo (the photo was never the problem), or
  // keep it and name the dish themselves (typed names carry human authority and
  // re-derive everything downstream anyway).
  if (dish.vision_failed && !confirmedAnyway && !ratingExistingPick) {
    return (
      <div>
        <div className="card" style={{ borderColor: 'var(--lacquer)' }}><div className="card-body">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="card-photo" style={{ marginBottom: 12, opacity: 0.85 }} />
          )}
          <p style={{ fontWeight: 800, fontSize: 17, marginBottom: 6 }}>{t('log.visionfail.title')}</p>
          <p className="card-meta" style={{ marginBottom: 14 }}>{t('log.visionfail.blurb')}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost" style={{ flex: 1 }} onClick={() => setConfirmedAnyway(true)}>{t('log.visionfail.keep')}</button>
            <button className="btn primary" style={{ flex: 1 }} onClick={retryRead}>{t('log.visionfail.retry')}</button>
          </div>
        </div></div>
      </div>
    );
  }

  // A genuine, explicit "this doesn't look like food at all" signal from vision —
  // distinct from ordinary low-confidence identification (a blurry-but-real dish
  // still has is_dish: true). Gate rating behind an actual tap, not just a caption
  // easy to skim past: the taste engine genuinely can't learn anything real from a
  // photo of, say, a receipt, so this is worth a deliberate speed bump, not a
  // silent shrug.
  if (dish.is_dish === false && !confirmedAnyway) {
    return (
      <div>
        <div className="card" style={{ borderColor: 'var(--lacquer)' }}><div className="card-body">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="card-photo" style={{ marginBottom: 12, opacity: 0.85 }} />
          )}
          <p style={{ fontWeight: 800, fontSize: 17, marginBottom: 6 }}>{t('log.notdish.title')}</p>
          <p className="card-meta" style={{ marginBottom: 14 }}>{t('log.notdish.blurb')}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost" style={{ flex: 1 }} onClick={retakePhoto}>{t('log.notdish.retake')}</button>
            <button className="btn primary" style={{ flex: 1 }} onClick={() => setConfirmedAnyway(true)}>{t('log.notdish.anyway')}</button>
          </div>
        </div></div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label className="label" style={{ margin: 0 }}>{t('log.how')}</label>
        <button className="icon-btn" onClick={() => router.push('/profile')} aria-label={t('log.cancelflow')} title={t('log.cancelflow')}>
          <CloseIcon />
        </button>
      </div>
      {/* Optimistic rendering: the photo the user just took is ALREADY in memory
          (the object URL from step 1) — reuse it instantly instead of waiting on
          dish.photo_url, a fresh network fetch of the exact same image the user
          just looked at one screen ago. The server URL is only a fallback for the
          (normally unreachable) case where the local preview isn't available. */}
      <FlickRating photoUrl={preview ?? dish.photo_url} dishName={dish.name} dishNameZh={dish.name_zh} onRate={onRate} />

      {/* The AI's name guess lives BELOW the photo, in visibly editable fields —
          presented as a suggestion inviting correction, not a settled headline.
          Editing one language blanks the other (if untouched): the blank is a
          visible promise that the translation will be rebuilt from YOUR words on
          confirm, rather than a stale machine name silently surviving your fix.
          Chinese first, matching the app's default display language and the same
          order MyDishes' rename editor uses, so the two don't disagree.
          No separate confirm/cancel here anymore — the single Done button below
          is the one commit point for the whole screen (name AND rating together),
          running the full cascade server-side: translation, cuisine re-derivation,
          attribute re-derivation from the photo anchored on your name — and a
          profile replay if this dish was already rated. */}
      <div style={{ margin: '10px 0' }}>
        <label className="label" style={{ fontSize: 11.5 }}>{t('home.name.zh')}</label>
        <input className="field" style={{ marginBottom: 6 }} value={draftNameZh}
          placeholder={editedEn && !editedZh ? t('log.willTranslate') : undefined}
          onChange={e => {
            setDraftNameZh(e.target.value); setEditedZh(true);
            if (!editedEn) setDraftName('');
          }} />
        <label className="label" style={{ fontSize: 11.5 }}>{t('home.name.en')}</label>
        <input className="field" value={draftName} placeholder={editedZh && !editedEn ? t('log.willTranslate') : undefined}
          onChange={e => {
            setDraftName(e.target.value); setEditedEn(true);
            if (!editedZh) setDraftNameZh('');
          }} />
        {(editedEn || editedZh) && (
          <p className="card-meta" style={{ marginTop: 4 }}>{t('home.translateOnSave')}</p>
        )}
        {nameSaveError && <p style={{ color: 'var(--lacquer)', fontSize: 12.5, marginTop: 4 }}>{nameSaveError}</p>}
        {relearned && <p className="card-meta" style={{ marginTop: 4, color: 'var(--ink)' }}>{t('log.relearned')}</p>}

        {/* Dish identity confirm. Only ever appears when the server is genuinely
            confident this is a dish the restaurant already has under another name —
            it stays silent otherwise, by design. Answering is optional: rating works
            perfectly well whether or not this is ever touched. */}
        {sameDish && !editedEn && !editedZh && (
          <div className="card" style={{ marginTop: 10 }}><div className="card-body">
            <p className="card-meta" style={{ marginBottom: 4 }}>
              {t('log.samedish.title', { restaurant: restaurant?.name ?? '' })}
            </p>
            <p style={{ fontWeight: 700, fontSize: 17, marginBottom: 10 }}>
              {t('log.samedish.pair', {
                a: lang === 'zh' ? (dish.name_zh ?? dish.name) : dish.name,
                b: lang === 'zh' ? (sameDish.name_zh ?? sameDish.name) : sameDish.name,
              })}
            </p>
            <p style={{ fontWeight: 650, fontSize: 14.5, marginBottom: 12 }}>{t('log.samedish.q')}</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn primary large" disabled={sameDishBusy}
                onClick={() => answerSameDish(true)}>
                {t('log.samedish.yes')}
              </button>
              <button className="btn ghost large" disabled={sameDishBusy}
                onClick={() => answerSameDish(false)}>
                {t('log.samedish.no')}
              </button>
            </div>
          </div></div>
        )}
        {!ratingExistingPick && dish.cuisine !== 'unknown' && (
          <p className="card-meta" style={{ marginTop: 4 }}>
            {t('log.looks', { cuisine: cuisineLabel(dish.cuisine, lang) || dish.cuisine })}
            {(dish.vision_confidence ?? 1) < 0.5 ? t('log.lowconf') : ''}
          </p>
        )}
      </div>

      {/* Only offered when there's genuinely no photo yet (a pick rated without one)
          — a normal photographed dish already has its photo from Step 1 and never
          sees this. Purely optional: rating with no photo continues to work. */}
      {!preview && !dish.photo_url && (
        <div style={{ marginTop: 10 }}>
          <PhotoPicker onPick={addPhotoToPick} disabled={addingPhoto} />
          <p className="card-meta" style={{ marginTop: 4 }}>{t('log.addphotohint')}</p>
        </div>
      )}

      {/* No Done button before a rating exists — nothing to finish yet. It appears
          the moment a swipe lands, and navigation only ever happens on tap: never
          automatically, and never mid-swipe. */}
      {rating !== null && (
        <>
          <button
            className="btn primary"
            style={{ width: '100%', marginTop: 16 }}
            disabled={finishing}
            onClick={finishLogging}
          >
            {finishing ? t('log.saving') : t('log.done')}
          </button>
          {/* What this rating just taught — from the engine's own taughtDims output,
              never a fabricated claim. Shown briefly before navigating home, so
              every single rating visibly does something. */}
          {learnedDims && learnedDims.length > 0 && (
            <p className="card-meta" role="status" style={{ marginTop: 8, color: 'var(--ink)' }}>
              {t('log.learned')}{'\uFF1A'}
              {learnedDims.map(x => `${t(`dim.${x.dim}`)} ${x.dir > 0 ? '\u2191' : '\u2193'}`).join(' \u00B7 ')}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** Small circular camera-icon button overlaid bottom-right on an already-picked
 * photo — tapping it re-opens the file picker to swap the photo, same mechanism
 * as PhotoPicker's own hidden input, just without a separate "picked · tap to
 * change" text bar underneath. */
function RetakePhotoButton({ onPick }: { onPick: (f: File | null) => void }) {
  const { t } = useLang();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        className="retake-photo-btn"
        onClick={() => inputRef.current?.click()}
        aria-label={t('upload.change')}
        title={t('upload.change')}
      >
        <CameraIcon />
      </button>
      <input
        ref={inputRef} type="file" accept="image/*" hidden
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = '';
        }}
      />
    </>
  );
}
