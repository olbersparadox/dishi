'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGate from '@/components/AuthGate';
import RestaurantPicker, { RestaurantChoice } from '@/components/RestaurantPicker';
import FlickRating from '@/components/FlickRating';
import VoiceNote from '@/components/VoiceNote';
import { normalizePhoto } from '@/lib/image';
import DishName from '@/components/DishName';
import { useLang } from '@/lib/i18n';

type Dish = { id: string; name: string; name_zh?: string | null; cuisine: string; photo_url: string; vision_confidence: number };

export default function LogPage() {
  return (
    <AuthGate>
      <LogFlow />
    </AuthGate>
  );
}

function LogFlow() {
  const { t } = useLang();
  const router = useRouter();
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState<RestaurantChoice>(null);
  const [dish, setDish] = useState<Dish | null>(null);
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function onPickPhoto(f: File | null) {
    setPhoto(f);
    setPreview(f ? URL.createObjectURL(f) : null);
    setDish(null);
  }

  /** Upload photo + restaurant, get vision result back. */
  async function logDish() {
    if (!photo) return;
    setBusy(true); setError('');
    const form = new FormData();
    // Downscale + convert to JPEG on-device: keeps uploads under serverless body
    // limits and converts iPhone HEIC into a format the vision model accepts.
    form.append('photo', await normalizePhoto(photo));
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

  /** Flick committed: submit rating + voice transcript, taste profile updates server-side. */
  async function commitRating(score: number) {
    if (!dish) return;
    try {
      await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dish_id: dish.id, score, voice_transcript: transcript || undefined }),
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
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={e => onPickPhoto(e.target.files?.[0] ?? null)}
          className="field"
        />

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
        {dish.cuisine !== 'unknown' ? t('log.looks', { cuisine: dish.cuisine }) : ''}
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
      <FlickRating photoUrl={dish.photo_url} onCommit={commitRating} />

      <label className="label">{t('log.anything')}</label>
      <VoiceNote onTranscript={setTranscript} />
      <p className="card-meta" style={{ marginTop: 8 }}>
        {t('log.note')}
      </p>
    </div>
  );
}
