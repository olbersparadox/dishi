'use client';
// 打字 typed quick-add (backlog 2026-07-22, item 3) — the floor of the core
// action: no photo, just name it and rate it. Collection order is decided:
// dish name FIRST (what the person remembers), restaurant SECOND (context,
// skippable — an unattached dish beats an abandoned flow). Enrichment runs
// immediately on commit (not the usual deferred fix-B background call) so the
// blank rating card already carries real ingredient/diet chips — the whole
// point of enriching at all is that the rating context sees it.
import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';
import RestaurantPicker from '@/components/RestaurantPicker';
import { buildTypedDishBody, type TypedRestaurantChoice } from '@/lib/typedQuickAdd';
import RatingStack, { type TypedEntry } from '@/components/RatingStack';
import { CloseIcon } from '@/components/icons';
import type { SuggestRow } from '@/lib/dishSuggest';

type Step = 'name' | 'restaurant';

export default function TypedQuickAdd({ userId, onExit }: { userId: string; onExit: () => void }) {
  const { t } = useLang();
  const [step, setStep] = useState<Step>('name');
  const [nameZh, setNameZh] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [editedZh, setEditedZh] = useState(false);
  const [editedEn, setEditedEn] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestRow[]>([]);
  const [restaurant, setRestaurant] = useState<TypedRestaurantChoice>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entry, setEntry] = useState<TypedEntry | null>(null);

  // Best-effort, silent — biases dish-name suggestions toward nearby restaurants
  // and seeds the restaurant step's picker so it doesn't ask twice.
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      p => setCoords(c => c ?? { lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {}, { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, []);

  // Debounced predictive suggestions off whichever field the person is actively
  // typing in — nearby-restaurant dish_identities first, own history second
  // (see dishSuggest.ts). Cleared once a restaurant is skipped past.
  const suggestGen = useRef(0);
  const skipNextSuggest = useRef(false); // set by pickSuggestion — picking a chip shouldn't re-suggest itself
  useEffect(() => {
    if (step !== 'name') return;
    if (skipNextSuggest.current) { skipNextSuggest.current = false; return; }
    const q = (nameZh || nameEn).trim();
    if (q.length < 1) { setSuggestions([]); return; }
    const gen = ++suggestGen.current;
    const h = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q });
        if (coords) { params.set('lat', String(coords.lat)); params.set('lng', String(coords.lng)); }
        const res = await fetch(`/api/dishes/suggest?${params}`);
        const json = await res.json().catch(() => null);
        if (suggestGen.current === gen) setSuggestions(json?.suggestions ?? []);
      } catch { if (suggestGen.current === gen) setSuggestions([]); }
    }, 250);
    return () => clearTimeout(h);
  }, [nameZh, nameEn, step, coords]);

  const pickSuggestion = (s: SuggestRow) => {
    skipNextSuggest.current = true;
    setNameZh(s.name_zh ?? '');
    setNameEn(s.name);
    setEditedZh(true);
    setEditedEn(true);
    setSuggestions([]);
  };

  const canContinueName = nameZh.trim().length > 0 || nameEn.trim().length > 0;

  async function commit() {
    setCommitting(true);
    setError(null);
    try {
      const body = buildTypedDishBody(nameEn.trim(), nameZh.trim(), restaurant, coords);
      const res = await fetch('/api/dishes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.dish) throw new Error(json?.error ?? 'failed');
      const d = json.dish;
      // Enrich BEFORE the rating moment (decided — see file header): the whole
      // point of enriching here is that the blank card already has chips.
      const enr = await fetch('/api/dishes/enrich', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: d.id }),
      }).then(r => (r.ok ? r.json() : null)).catch(() => null);
      const ed = enr?.dish ?? d;
      setEntry({
        dishId: d.id, name: ed.name ?? d.name, name_zh: ed.name_zh ?? d.name_zh,
        cuisine: ed.cuisine ?? null, ingredients: Array.isArray(ed.ingredients) ? ed.ingredients : [],
        diet: ed.diet ?? [], heaviness: ed.heaviness ?? null,
        coords: body.lat != null && body.lng != null ? { lat: body.lat, lng: body.lng } : null,
      });
    } catch {
      setError(t('typed.error.noname')); // generic-enough fallback; the field validation covers the common case
    } finally {
      setCommitting(false);
    }
  }

  if (entry) return <RatingStack typed={[entry]} userId={userId} onExit={onExit} />;

  return (
    <div className="rate-sheet">
      <div className="rate-sheet-inner">
        <div className="grow2">
          <button className="grow-close" onClick={onExit} aria-label={t('grow.close')}><CloseIcon size={18} /></button>
          <div className="card">
            <div className="card-body">
              {step === 'name' ? (
                <>
                  <h3 style={{ marginTop: 0 }}>{t('typed.name.title')}</h3>
                  <label className="label" style={{ fontSize: 11.5 }}>{t('home.name.zh')}</label>
                  <input className="field" style={{ marginBottom: 6 }} value={nameZh} autoFocus
                    placeholder={editedEn && !editedZh ? t('log.willTranslate') : undefined}
                    onChange={e => { setNameZh(e.target.value); setEditedZh(true); if (!editedEn) setNameEn(''); }} />
                  <label className="label" style={{ fontSize: 11.5 }}>{t('home.name.en')}</label>
                  <input className="field" value={nameEn}
                    placeholder={editedZh && !editedEn ? t('log.willTranslate') : undefined}
                    onChange={e => { setNameEn(e.target.value); setEditedEn(true); if (!editedZh) setNameZh(''); }} />
                  {suggestions.length > 0 && (
                    <div className="chips" style={{ marginTop: 10 }}>
                      {suggestions.map((s, i) => (
                        <button key={`${s.name}|${s.name_zh}|${i}`} className="chip" onClick={() => pickSuggestion(s)}>
                          {s.name_zh || s.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <button className="btn primary" style={{ marginTop: 16, width: '100%' }}
                    disabled={!canContinueName} onClick={() => setStep('restaurant')}>
                    {t('typed.name.continue')}
                  </button>
                </>
              ) : (
                <>
                  <h3 style={{ marginTop: 0 }}>{t('typed.restaurant.title')}</h3>
                  <RestaurantPicker onChange={setRestaurant} onCoords={setCoords} seedCoords={coords} />
                  {error && <p className="card-meta" style={{ color: 'var(--seal)' }}>{error}</p>}
                  <button className="btn primary" style={{ marginTop: 16, width: '100%' }}
                    disabled={committing} onClick={commit}>
                    {committing ? t('typed.enriching') : t('log.rateNow')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
