'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
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
export default function RestaurantPicker({ onChange, skipFirst = false, seedCoords = null, onCoords }: {
  onChange: (c: RestaurantChoice) => void;
  /** Reports the coords the picker resolved to (photo seed or live GPS), so the log
   * page can reverse-geocode a district when the user skips (no restaurant chosen).
   * Only the coords — the reverse-geocode itself is done at submit, and only for a
   * no-restaurant dish, to keep the Geocoding cost off every log. */
  onCoords?: (c: { lat: number; lng: number } | null) => void;
  /** Album mode (old camera-roll photos): the photo probably wasn't taken near
   * where the user is standing NOW, so "skip" leads the chip row instead of
   * trailing it — nearby suggestions become the fallback, not the assumption. */
  skipFirst?: boolean;
  /** Photo EXIF coords: WHERE the photo was taken, which beats live GPS (where the
   * phone is now) for a retrospective log. When present, the nearby list is seeded
   * from here instead of geolocation — so a couch-logged restaurant dish still gets
   * the right shortlist. null → fall back to live GPS. */
  seedCoords?: { lat: number; lng: number } | null;
}) {
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
  // Search-on-add candidates (Places Text Search), shown when the typed name
  // didn't cosmetically match anything already in the local `nearby` chip list
  // — that list is capped at ~10 prominence-ranked results, so a real place can
  // be entirely absent from it (the 新容記 Tin Wan miss). One call per confirmed
  // 加入 tap, never per keystroke.
  const [searchMatches, setSearchMatches] = useState<Nearby[]>([]);
  const [searching, setSearching] = useState(false);
  // Brief attention shake on the needloc caption when confirm is tapped with no
  // coords yet — the caption text was already always shown in that state, but a
  // passively-present line reads as "nothing happened" on tap; this makes the tap
  // register visibly. Session-local only, never persisted.
  const [needlocFlash, setNeedlocFlash] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const searchMatchesRef = useRef<HTMLDivElement>(null);

  const loadNearby = useCallback(async (lat: number, lng: number) => {
    setCoords({ lat, lng });
    onCoords?.({ lat, lng });
    try {
      const res = await fetch(`/api/restaurants/nearby?lat=${lat}&lng=${lng}&lang=${lang}`);
      const json = await res.json();
      setNearby(json.restaurants ?? []);
    } catch { /* empty list is handled below */ }
    setStatus('ready');
  }, [lang, onCoords]);

  useEffect(() => {
    // Photo location wins: it's where the dish was actually eaten, not where the
    // phone is now. Fall back to live GPS only when there's no photo GPS to seed from.
    if (seedCoords) { loadNearby(seedCoords.lat, seedCoords.lng); return; }
    if (!navigator.geolocation) { setStatus('denied'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => loadNearby(pos.coords.latitude, pos.coords.longitude),
      () => setStatus('denied'),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [seedCoords, loadNearby]);

  function pick(r: Nearby) {
    const key = r.source === 'dishi' ? r.id! : r.place_id!;
    setSelectedKey(key);
    setAdding(false);
    setSuggestion(null);
    setSearchMatches([]);
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
  async function confirmNew() {
    const typed = newName.trim();
    if (!typed) return;
    if (!coords) {
      // Genuinely-silent path (field-tested): the tap must speak, not just have
      // a passively-present caption below it.
      setNeedlocFlash(true);
      setTimeout(() => setNeedlocFlash(false), 500);
      return;
    }
    // Same-place nudge: if what they typed cosmetically matches a chip that's
    // already sitting right there (Dishi's or Google's), ask before forking a
    // duplicate. One question, human decides — never silently auto-merged, and
    // "no, it's new" is always available and always respected.
    if (!suggestionDismissed) {
      const match = nearby.find(r => namesMatch(typed, r));
      if (match) { setSuggestion(match); return; }
    }
    // Search-on-add: the local chip list missed it, but that list is capped —
    // broaden to Places Text Search before assuming it's genuinely new. One
    // call, only on this confirmed tap, never while typing.
    setSearching(true);
    let matches: Nearby[] = [];
    try {
      const res = await fetch(`/api/restaurants/search?q=${encodeURIComponent(typed)}&lat=${coords.lat}&lng=${coords.lng}&lang=${lang}`);
      const json = await res.json();
      matches = json.restaurants ?? [];
    } catch { /* fail soft — a Places hiccup never blocks the add, just treat as no match */ }
    setSearching(false);
    if (matches.length > 0) { setSearchMatches(matches); return; }
    createNew(typed);
  }
  function createNew(typed: string) {
    setSuggestion(null);
    setSelectedKey('manual-new');
    // Collapse the form: selectedKey now maps to a real chip below, so the
    // open input is no longer needed to show the choice took. Tapping that
    // chip (reopenManual) brings the form back, pre-filled for editing.
    setAdding(false);
    onChange({
      kind: 'new', name: typed, ...coords!,
      area: area.trim() || undefined,
      address: address.trim() || undefined,
    });
  }
  // Re-opens the add form on the already-confirmed manual entry, without
  // clearing newName/selectedKey — an edit, not a re-type.
  function reopenManual() {
    setSuggestion(null);
    setSearchMatches([]);
    setAdding(true);
  }
  // "No restaurant" — split into 住家菜 (home) and 略過 (skip) to match the album rating
  // flow's wording. Both mean the same to the caller (no restaurant → onChange(null));
  // the two labels just let the person say WHY. Toggle: tapping the picked one un-picks it.
  function noRestaurant(key: 'home' | 'skip') {
    if (selectedKey === key) { setSelectedKey(null); onChange(null); return; }
    setSelectedKey(key);
    setAdding(false);
    onChange(null);
  }
  // Single-select: opening "+ 加間舖" clears any picked chip (skip / a nearby
  // place) and its pending choice — you can't have two picked at once. Tapping it
  // again closes the form.
  function toggleAdd() {
    if (adding) { setAdding(false); return; }
    setAdding(true);
    setSelectedKey(null);
    setSuggestion(null);
    setSearchMatches([]);
    onChange(null);
  }

  // The same-place nudge can render below the iOS keyboard when the input is
  // near the bottom of a short viewport — scroll it into view the moment it
  // appears, rather than leaving it silently offscreen.
  useEffect(() => {
    if (suggestion) suggestionRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [suggestion]);
  useEffect(() => {
    if (searchMatches.length > 0) searchMatchesRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [searchMatches]);

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
      {/* Transparent, not magic: say the list is seeded from the photo's location. */}
      {seedCoords && status === 'ready' && <p className="card-meta">{t('picker.fromphoto')}</p>}

      <div className="chips" style={{ marginTop: 8 }}>
        {skipFirst && (<>
          <button className={`chip chip-util ${selectedKey === 'skip' ? 'on' : ''}`} onClick={() => noRestaurant('skip')}>{t('grow.skip')}</button>
          <button className={`chip chip-util ${selectedKey === 'home' ? 'on' : ''}`} onClick={() => noRestaurant('home')}>{t('place.home')}</button>
        </>)}
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
        {!adding && selectedKey === 'manual-new' && (
          <button className="chip on" onClick={reopenManual}>
            {newName.trim()}
          </button>
        )}
        <button className={`chip chip-util ${adding ? 'on' : ''}`} onClick={toggleAdd}>
          {t('picker.add')}
        </button>
        {!skipFirst && (<>
          <button className={`chip chip-util ${selectedKey === 'skip' ? 'on' : ''}`} onClick={() => noRestaurant('skip')}>{t('grow.skip')}</button>
          <button className={`chip chip-util ${selectedKey === 'home' ? 'on' : ''}`} onClick={() => noRestaurant('home')}>{t('place.home')}</button>
        </>)}
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
                setSearchMatches([]);
              }}
            />
            <button className="btn small" onClick={confirmNew} disabled={!newName.trim() || searching}>
              {t('picker.confirm')}
            </button>
          </div>

          {searching && <p className="card-meta" style={{ marginTop: 6 }}>{t('picker.searching')}</p>}

          {searchMatches.length > 0 && (
            <div ref={searchMatchesRef} style={{ marginTop: 8 }}>
              <p className="card-meta" style={{ marginBottom: 6 }}>{t('picker.searchmatch')}</p>
              <div className="chips">
                {searchMatches.map(m => (
                  <button key={m.place_id} className="chip" onClick={() => pick(m)}>
                    {lang === 'zh' ? (m.name_zh ?? m.name) : m.name}
                  </button>
                ))}
              </div>
              <button
                className="btn ghost small" style={{ marginTop: 8 }}
                onClick={() => { setSearchMatches([]); createNew(newName.trim()); }}
              >
                {t('picker.notsame')}
              </button>
            </div>
          )}

          {suggestion && (
            <div ref={suggestionRef} style={{ marginTop: 8 }}>
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
      {adding && !coords && (
        <p className={`card-meta ${needlocFlash ? 'needloc-flash' : ''}`} style={{ marginTop: 6 }}>
          {t('picker.needloc')}
        </p>
      )}
    </div>
  );
}
