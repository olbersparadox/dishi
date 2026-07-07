'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/i18n';

type Nearby = {
  source: 'dishi' | 'google';
  id?: string;          // present for source: 'dishi'
  place_id?: string;    // present for source: 'google'
  name: string;
  lat: number;
  lng: number;
  distance_m: number | null;
};
export type RestaurantChoice =
  | { kind: 'existing'; id: string; name: string }
  | { kind: 'new'; name: string; lat: number; lng: number }
  | null;

/**
 * GPS quick-pick: nearest known restaurants as one-tap chips; typing is the fallback,
 * never the default. Skippable — home cooking is a first-class log.
 *
 * Two sources feed the chip list, visually distinguished but functionally merged:
 *  - "dishi" chips are restaurants Dishi already knows (may have dish history)
 *  - "google" chips come from Google Places for real-world places Dishi hasn't seen yet
 * Tapping a Google chip creates a normal Dishi restaurant record on submit (same path
 * as manually typing a name) — so the FIRST tap "caches" it into Dishi's own table,
 * and it shows up as a fast, free "dishi" chip for everyone after that.
 */
export default function RestaurantPicker({ onChange }: { onChange: (c: RestaurantChoice) => void }) {
  const { t } = useLang();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearby, setNearby] = useState<Nearby[]>([]);
  const [status, setStatus] = useState<'locating' | 'ready' | 'denied'>('locating');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (!navigator.geolocation) { setStatus('denied'); return; }
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCoords({ lat, lng });
        try {
          const res = await fetch(`/api/restaurants/nearby?lat=${lat}&lng=${lng}`);
          const json = await res.json();
          setNearby(json.restaurants ?? []);
        } catch { /* empty list is handled below */ }
        setStatus('ready');
      },
      () => setStatus('denied'),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  function pick(r: Nearby) {
    const key = r.source === 'dishi' ? r.id! : r.place_id!;
    setSelectedKey(key);
    setAdding(false);
    if (r.source === 'dishi') {
      onChange({ kind: 'existing', id: r.id!, name: r.name });
    } else {
      // Google-sourced: becomes a brand-new Dishi restaurant the moment it's used.
      onChange({ kind: 'new', name: r.name, lat: r.lat, lng: r.lng });
    }
  }
  function confirmNew() {
    if (!newName.trim() || !coords) return;
    setSelectedKey('manual-new');
    onChange({ kind: 'new', name: newName.trim(), ...coords });
  }
  function skip() {
    setSelectedKey('skip');
    setAdding(false);
    onChange(null);
  }

  return (
    <div>
      {status === 'locating' && <p className="card-meta">{t('picker.finding')}</p>}
      {status === 'denied' && <p className="card-meta">{t('picker.denied')}</p>}

      <div className="chips" style={{ marginTop: 8 }}>
        {nearby.map(r => {
          const key = r.source === 'dishi' ? r.id! : r.place_id!;
          return (
            <button key={key} className={`chip ${selectedKey === key ? 'on' : ''}`} onClick={() => pick(r)}>
              {r.name}
              {r.distance_m !== null && <span style={{ opacity: 0.55 }}> · {Math.round(r.distance_m)}m</span>}
              {r.source === 'google' && <span style={{ opacity: 0.5 }}> · {t('picker.new')}</span>}
            </button>
          );
        })}
        <button className={`chip ${adding ? 'on' : ''}`} onClick={() => setAdding(a => !a)}>
          {t('picker.add')}
        </button>
        <button className={`chip ${selectedKey === 'skip' ? 'on' : ''}`} onClick={skip}>
          {t('picker.skip')}
        </button>
      </div>

      {adding && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input
            className="field"
            placeholder={t('picker.name')}
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <button className="btn small" onClick={confirmNew} disabled={!coords || !newName.trim()}>
            {t('picker.confirm')}
          </button>
        </div>
      )}
      {adding && !coords && <p className="card-meta" style={{ marginTop: 6 }}>{t('picker.needloc')}</p>}
    </div>
  );
}
