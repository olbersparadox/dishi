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

type Dish = { id: string; name: string; name_zh?: string | null; cuisine: string; photo_url: string; vision_confidence: number };

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
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [finishing, setFinishing] = useState(false);

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

  /** Upload photo + restaurant, get vision result back. */
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

  /** Done tapped: submit rating + voice transcript, THEN navigate. */
  async function finishLogging() {
    if (!dish || rating === null || finishing) return;
    setFinishing(true);
    try {
      await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dish_id: dish.id, score: rating, voice_transcript: transcript || undefined }),
      });
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

  // --- Step 2: confirm + rate ---
  const shownName = nameOverride ?? dish.name;
  return (
    <div>
      <h1 style={{ marginBottom: 4 }}><DishName name={shownName} name_zh={nameOverride ? undefined : dish.name_zh} size="lg" /></h1>
      <p className="card-meta" style={{ marginBottom: 4 }}>
        {dish.cuisine !== 'unknown' ? t('log.looks', { cuisine: cuisineLabel(dish.cuisine, lang) || dish.cuisine }) : ''}
        {dish.vision_confidence < 0.5 ? t('log.lowconf') : ''}
        {t('log.notright')}{' '}
        <button className="btn ghost small" onClick={() => setEditingName(true)}>{t('log.fixname')}</button>
      </p>
      {editingName && (
        <input
          className="field"
          style={{ margin: '8px 0' }}
          defaultValue={shownName}
          onBlur={e => { setNameOverride(e.target.value); setEditingName(false); }}
          autoFocus
        />
      )}

      <label className="label">{t('log.how')}</label>
      {/* Optimistic rendering: the photo the user just took is ALREADY in memory
          (the object URL from step 1) — reuse it instantly instead of waiting on
          dish.photo_url, a fresh network fetch of the exact same image the user
          just looked at one screen ago. The server URL is only a fallback for the
          (normally unreachable) case where the local preview isn't available. */}
      <FlickRating photoUrl={preview ?? dish.photo_url} onRate={onRate} />

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
        </>
      )}
    </div>
  );
}
