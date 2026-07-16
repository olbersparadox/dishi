'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { namesMatch } from '@/lib/restaurant';

type Nearby = {
  source: 'dishi' | 'google';
  id?: string;          // present for source: 'dishi'
  place_id?: string;    // present for source: 'google'
  name: string;
  name_zh?: string | null;
  address?: string | null;
  lat: number;
  lng: number;
  distance_m: number | null;
};
export type RestaurantChoice =
  | { kind: 'existing'; id: string; name: string }
  | { kind: 'new'; name: string; lat: number; lng: number; area?: string; address?: string; place_id?: string }
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
 *
 * Chip names render bilingually (same primary/secondary treatment as dish names)
 * whenever Google or a prior Dishi record actually has both languages — never a
 * fabricated second line.
 */
export default function RestaurantPicker({ onChange }: { onChange: (c: RestaurantChoice) => void }) {
  const { t, lang } = useLang();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearby, setNearby] = useState<Nearby[]>([]);
  const [status, setStatus] = useState<'locating' | 'ready' | 'denied'>('locating');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [area, setArea] = useState('');
  const [address, setAddress] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [geocodedOnce, setGeocodedOnce] = useState(false);
  const [suggestion, setSuggestion] = useState<Nearby | null>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) { setStatus('denied'); return; }
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCoords({ lat, lng });
        try {
          const res = await fetch(`/api/restaurants/nearby?lat=${lat}&lng=${lng}&lang=${lang}`);
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
    setSuggestion(null);
    if (r.source === 'dishi') {
      onChange({ kind: 'existing', id: r.id!, name: r.name });
    } else {
      // Google-sourced: becomes a brand-new Dishi restaurant the moment it's used.
      // place_id travels with it — the server dedupes on it, so two people tapping
      // this same chip (even shown in different languages) share ONE record.
      onChange({
        kind: 'new', name: r.name, lat: r.lat, lng: r.lng,
        place_id: r.place_id, address: r.address ?? undefined,
      });
    }
  }
  function confirmNew() {
    const typed = newName.trim();
    if (!typed || !coords) return;
    // Same-place nudge: if what they typed cosmetically matches a chip that's
    // already sitting right there (Dishi's or Google's), ask before forking a
    // duplicate. One question, human decides — never silently auto-merged, and
    // "no, it's new" is always available and always respected.
    if (!suggestionDismissed) {
      const match = nearby.find(r => namesMatch(typed, r));
      if (match) { setSuggestion(match); return; }
    }
    createNew(typed);
  }
  function createNew(typed: string) {
    setSuggestion(null);
    setSelectedKey('manual-new');
    onChange({
      kind: 'new', name: typed, ...coords!,
      area: area.trim() || undefined,
      address: address.trim() || undefined,
    });
  }
  function skip() {
    setSelectedKey('skip');
    setAdding(false);
    onChange(null);
  }

  // Prefill area/address once, the first time "add more details" opens — a
  // starting point, not a fact. Always freely editable afterward, and never
  // re-fetched/overwritten if the person already typed something themselves.
  async function openDetails() {
    setShowDetails(true);
    if (geocodedOnce || !coords) return;
    setGeocodedOnce(true);
    setGeocoding(true);
    try {
      const res = await fetch(`/api/geocode/reverse?lat=${coords.lat}&lng=${coords.lng}&lang=${lang === 'zh' ? 'zh-HK' : 'en'}`);
      const json = await res.json();
      if (json.area) setArea(prev => prev || json.area);
      if (json.address) setAddress(prev => prev || json.address);
    } catch { /* prefill is best-effort; empty fields are fine */ }
    setGeocoding(false);
  }

  return (
    <div>
      {status === 'locating' && <p className="card-meta">{t('picker.finding')}</p>}
      {status === 'denied' && <p className="card-meta">{t('picker.denied')}</p>}

      <div className="chips" style={{ marginTop: 8 }}>
        {nearby.map(r => {
          const key = r.source === 'dishi' ? r.id! : r.place_id!;
          // Single name, in whichever language the app currently displays. Google
          // results already come back in that language (requested server-side);
          // Dishi's own restaurants fall back to the English name if no Chinese
          // name happens to be on file for it — never a fabricated second line.
          const label = lang === 'zh' ? (r.name_zh ?? r.name) : r.name;
          return (
            <button key={key} className={`chip ${selectedKey === key ? 'on' : ''}`} onClick={() => pick(r)}>
              {label}
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
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="field"
              placeholder={t('picker.name')}
              value={newName}
              onChange={e => {
                setNewName(e.target.value);
                // A different name is a different question — the earlier
                // "no, it's new" answer shouldn't suppress a fresh nudge.
                setSuggestionDismissed(false);
                setSuggestion(null);
              }}
            />
            <button className="btn small" onClick={confirmNew} disabled={!coords || !newName.trim()}>
              {t('picker.confirm')}
            </button>
          </div>

          {suggestion && (
            <div style={{ marginTop: 8 }}>
              <p className="card-meta" style={{ marginBottom: 6 }}>
                {t('picker.sameas', {
                  name: lang === 'zh' ? (suggestion.name_zh ?? suggestion.name) : suggestion.name,
                })}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn small" onClick={() => pick(suggestion)}>
                  {t('picker.samesame')}
                </button>
                <button
                  className="btn ghost small"
                  onClick={() => { setSuggestionDismissed(true); createNew(newName.trim()); }}
                >
                  {t('picker.notsame')}
                </button>
              </div>
            </div>
          )}

          {!showDetails ? (
            <button className="btn ghost small" style={{ marginTop: 8 }} onClick={openDetails}>
              {t('picker.moredetails')}
            </button>
          ) : (
            <div style={{ marginTop: 8 }}>
              <input
                className="field" style={{ marginBottom: 6 }}
                placeholder={t('picker.area')}
                value={area}
                onChange={e => setArea(e.target.value)}
              />
              <input
                className="field"
                placeholder={t('picker.address')}
                value={address}
                onChange={e => setAddress(e.target.value)}
              />
              {geocoding && <p className="card-meta" style={{ marginTop: 4 }}>{t('picker.locating')}</p>}
              <p className="card-meta" style={{ marginTop: 4 }}>{t('picker.detailshint')}</p>
            </div>
          )}
        </div>
      )}
      {adding && !coords && <p className="card-meta" style={{ marginTop: 6 }}>{t('picker.needloc')}</p>}
    </div>
  );
}
