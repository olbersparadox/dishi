'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGate from '@/components/AuthGate';
import RestaurantPicker, { RestaurantChoice } from '@/components/RestaurantPicker';
import FlickRating from '@/components/FlickRating';
import VoiceNote from '@/components/VoiceNote';
import { normalizePhoto } from '@/lib/image';
import DishName from '@/components/DishName';
import PhotoPicker from '@/components/PhotoPicker';
import { useLang, cuisineLabel } from '@/lib/i18n';

type Dish = { id: string; name: string; name_zh?: string | null; cuisine: string; photo_url: string | null; vision_confidence?: number; is_dish?: boolean };
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
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState<RestaurantChoice>(null);
  const [dish, setDish] = useState<Dish | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftNameZh, setDraftNameZh] = useState('');
  const [editedEn, setEditedEn] = useState(false);
  const [editedZh, setEditedZh] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [nameSaveError, setNameSaveError] = useState<string | null>(null);
  const [relearned, setRelearned] = useState(false);
  const [learnedDims, setLearnedDims] = useState<{ dim: string; dir: number }[] | null>(null);
  const [transcript, setTranscript] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [ratingExistingPick, setRatingExistingPick] = useState(false);
  const [addingPhoto, setAddingPhoto] = useState(false);
  const [confirmedAnyway, setConfirmedAnyway] = useState(false);

  function onPickPhoto(f: File | null) {
    setPhoto(f);
    setPreview(prev => {
      if (prev) URL.revokeObjectURL(prev); // release the old blob before making a new one
      return f ? URL.createObjectURL(f) : null;
    });
    setDish(null);
  }

  // Release the object URL when the whole flow unmounts (e.g. navigating away).
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  // Dishes picked off a scanned menu or during a Table Mode session, still waiting
  // to be rated — same rating pipeline as a photographed dish, just entered a
  // different way. Only relevant on the idle (pre-photo) screen.
  useEffect(() => {
    fetch('/api/my/dishes?unrated=1').then(r => r.json()).then(j => setPicks(j.dishes ?? [])).catch(() => setPicks([]));
  }, []);

  /** Jump straight into rating an already-picked dish — no photo step needed. */
  function rateExistingPick(pick: Pick) {
    setRatingExistingPick(true);
    setDish({ id: pick.id, name: pick.name, name_zh: pick.name_zh, cuisine: pick.cuisine, photo_url: null });
    setRating(null); setTranscript(''); setConfirmedAnyway(false);
    setNameSaveError(null);
  }

  /** Back to the upload screen for a fresh photo — used when the person agrees this
   * one probably isn't a dish and wants to try again rather than rate it anyway. */
  function retakePhoto() {
    setDish(null); setPhoto(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setConfirmedAnyway(false);
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
  async function saveName() {
    if (!dish) return;
    const name = draftName.trim();
    const name_zh = draftNameZh.trim();
    if (!name && !name_zh) return; // need at least one language to work from
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
    } catch (e: any) {
      setNameSaveError(e.message || 'Something went wrong saving that name.');
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
    if (restaurant?.kind === 'existing') form.append('restaurant_id', restaurant.id);
    if (restaurant?.kind === 'new') form.append('new_restaurant', JSON.stringify(restaurant));
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

  /** Done tapped: submit rating + voice transcript, show what the rating actually
   * taught (drawn from the engine's own taughtDims output, so it can never claim
   * learning that didn't happen), then navigate. The brief pause is the cheapest
   * trust mechanic in the app: every single rating visibly does something. */
  async function finishLogging() {
    if (!dish || rating === null || finishing) return;
    setFinishing(true);
    try {
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dish_id: dish.id, score: rating, voice_transcript: transcript || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(json.taught) && json.taught.length > 0) {
        setLearnedDims(json.taught.slice(0, 4));
        await new Promise(r => setTimeout(r, 1400));
      }
    } finally {
      router.push('/?rated=1');
    }
  }

  // --- Step 1: photo ---
  if (!dish) {
    return (
      <div>
        <h1 style={{ marginBottom: 12 }}>{t('log.title')}</h1>

        <label className="label">{t('log.photo')}</label>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Dish preview" className="card-photo card" />
        ) : null}
        <PhotoPicker onPick={f => onPickPhoto(f)} />

        {picks !== null && picks.length > 0 && (
          <div style={{ margin: '16px 0' }}>
            <label className="label">{t('log.toRate')}</label>
            {picks.map(p => (
              <div className="pick-card" key={p.id}>
                <div style={{ minWidth: 0 }}>
                  <div className="pick-card-name"><DishName name={p.name} name_zh={p.name_zh} /></div>
                  <div className="pick-card-meta">{p.restaurant ?? t('home.homecooking')}</div>
                </div>
                <div className="pick-card-actions">
                  <button className="btn primary small" onClick={() => rateExistingPick(p)}>{t('log.rateNow')}</button>
                  <button className="btn ghost small" onClick={() => deletePick(p.id)}>{t('home.delete')}</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <label className="label">{t('log.where')}</label>
        <RestaurantPicker onChange={setRestaurant} />

        {error && <p style={{ color: 'var(--lacquer)', marginTop: 12 }}>{error}</p>}
        <button
          className="btn primary"
          style={{ width: '100%', marginTop: 20 }}
          disabled={!photo || busy}
          onClick={logDish}
        >
          {busy ? t('log.reading') : t('log.continue')}
        </button>
      </div>
    );
  }

  // dish.name/dish.cuisine are now always the source of truth — saveName() updates
  // them for real (server-side, including cuisine re-derivation) rather than a
  // client-only override that vanished on navigation and never touched cuisine.

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
      <label className="label">{t('log.how')}</label>
      {/* Optimistic rendering: the photo the user just took is ALREADY in memory
          (the object URL from step 1) — reuse it instantly instead of waiting on
          dish.photo_url, a fresh network fetch of the exact same image the user
          just looked at one screen ago. The server URL is only a fallback for the
          (normally unreachable) case where the local preview isn't available. */}
      <FlickRating photoUrl={preview ?? dish.photo_url} dishName={dish.name} onRate={onRate} />

      {/* The AI's name guess lives BELOW the photo, in visibly editable fields —
          presented as a suggestion inviting correction, not a settled headline.
          Editing one language blanks the other (if untouched): the blank is a
          visible promise that the translation will be rebuilt from YOUR words on
          confirm, rather than a stale machine name silently surviving your fix.
          Confirming runs the full cascade server-side: translation, cuisine
          re-derivation, attribute re-derivation from the photo anchored on your
          name — and a profile replay if this dish was already rated. */}
      <div style={{ margin: '10px 0' }}>
        <label className="label" style={{ fontSize: 11.5 }}>{t('home.name.en')}</label>
        <input className="field" style={{ marginBottom: 6 }} value={draftName}
          onChange={e => {
            setDraftName(e.target.value); setEditedEn(true);
            if (!editedZh) setDraftNameZh('');
          }} />
        <label className="label" style={{ fontSize: 11.5 }}>{t('home.name.zh')}</label>
        <input className="field" value={draftNameZh} placeholder={editedEn && !editedZh ? t('log.willTranslate') : undefined}
          onChange={e => {
            setDraftNameZh(e.target.value); setEditedZh(true);
            if (!editedEn) setDraftName('');
          }} />
        {(editedEn || editedZh) && (
          <>
            <p className="card-meta" style={{ marginTop: 4 }}>{t('home.translateOnSave')}</p>
            {nameSaveError && <p style={{ color: 'var(--lacquer)', fontSize: 12.5, marginTop: 4 }}>{nameSaveError}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn primary" style={{ flex: 1 }} disabled={savingName || (!draftName.trim() && !draftNameZh.trim())} onClick={saveName}>
                {savingName ? t('home.saving') : t('log.confirmName')}
              </button>
              <button className="btn ghost" style={{ flex: 1 }} disabled={savingName}
                onClick={() => { setDraftName(dish.name); setDraftNameZh(dish.name_zh ?? ''); setEditedEn(false); setEditedZh(false); setNameSaveError(null); }}>
                {t('home.cancel')}
              </button>
            </div>
          </>
        )}
        {relearned && <p className="card-meta" style={{ marginTop: 4, color: 'var(--jade)' }}>{t('log.relearned')}</p>}
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
          <label className="label">{t('log.anything')}</label>
          <VoiceNote onTranscript={setTranscript} />
          <p className="card-meta" style={{ marginTop: 8 }}>
            {t('log.note')}
          </p>
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
            <p className="card-meta" role="status" style={{ marginTop: 8, color: 'var(--jade)' }}>
              {t('log.learned')}{'\uFF1A'}
              {learnedDims.map(x => `${t(`dim.${x.dim}`)} ${x.dir > 0 ? '\u2191' : '\u2193'}`).join(' \u00B7 ')}
            </p>
          )}
        </>
      )}
    </div>
  );
}
