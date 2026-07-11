'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import AuthGate from '@/components/AuthGate';
import DishName from '@/components/DishName';
import Buddy from '@/components/Buddy';
import { useLang, cuisineLabel } from '@/lib/i18n';
import type { Species } from '@/lib/buddy';

type Rec = {
  dish_id: string; name: string; name_zh?: string | null; cuisine: string; photo_url: string | null;
  restaurant: string | null; reason: string; is_synthetic: boolean;
};

export default function Home() {
  return (
    <AuthGate>
      <Feed />
    </AuthGate>
  );
}

function Feed() {
  const { t, lang } = useLang();
  const [trainingCount, setTrainingCount] = useState(0);
  const [browse, setBrowse] = useState<Rec[]>([]);
  const [trainingNeeded, setTrainingNeeded] = useState(5);
  const [buddy, setBuddy] = useState<{ species: Species; size: number; elements: { kind: string; id: string; label: string }[] } | null>(null);
  const [justRated, setJustRated] = useState(false);
  const [recs, setRecs] = useState<Rec[] | null>(null);
  const [stage, setStage] = useState<string>('seed');
  const [marked, setMarked] = useState<Set<string>>(new Set());

  useEffect(() => {
    // The log flow redirects here with ?rated=1 — the moment the buddy earns XP.
    if (new URLSearchParams(window.location.search).get('rated') === '1') {
      setJustRated(true);
      window.history.replaceState({}, '', '/'); // don't re-celebrate on refresh
    }
    fetch('/api/recommendations')
      .then(r => r.json())
      .then(j => {
        setRecs(j.recommendations ?? []);
        setStage(j.stage ?? 'seed');
        if (j.stage === 'training') { setTrainingCount(j.rating_count ?? 0); setTrainingNeeded(j.needed ?? 5); setBrowse(j.browse ?? []); }
      })
      .catch(() => setRecs([]));
    // The buddy fronts the feed once adopted, presenting the engine's top pick.
    fetch('/api/buddy')
      .then(r => r.json())
      .then(j => {
        if (j.species) setBuddy({ species: j.species, size: j.state.level.size, elements: j.state.elements });
      })
      .catch(() => {});
  }, []);

  async function markHelpful(dishId: string) {
    setMarked(prev => new Set(prev).add(dishId));
    await fetch('/api/helpful', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dish_id: dishId }),
    });
  }

  if (recs === null) return <p className="card-meta">{t('home.setting')}</p>;

  return (
    <div>
      {justRated && (
        <div className="rated-banner" role="status">
          <span>🍜</span>
          <span>{t('home.rated')} <a href="/profile">{t('home.rated.see')}</a></span>
        </div>
      )}
      <h1 style={{ marginBottom: 4 }}>{t('home.title')}</h1>

      {stage === 'training' && (
        <div className="card"><div className="card-body">
          <h3 style={{ marginBottom: 6 }}>{t('home.training.title')}</h3>
          <div className="xp-bar" role="progressbar" aria-valuenow={trainingCount} aria-valuemin={0} aria-valuemax={trainingNeeded}>
            <div className="xp-fill greens" style={{ width: `${(trainingCount / trainingNeeded) * 100}%` }} />
          </div>
          <p className="card-meta training-blurb" style={{ margin: '6px 0 10px' }}>
            {trainingCount} / {trainingNeeded} · {t('home.training.blurb', { n: trainingNeeded - trainingCount })}
          </p>
          <p className="card-meta" style={{ marginBottom: 12 }}>{t('home.training.how')}</p>
          <a className="btn primary" href="/log" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
            {t('home.training.cta')}
          </a>
        </div></div>
      )}

      <p className="card-meta" style={{ marginBottom: 16 }}>
        {stage === 'seed' && t('home.stage.seed')}
        {stage === 'content' && t('home.stage.content')}
        {stage === 'collab' && t('home.stage.collab')}
        {stage === 'learned' && t('home.stage.learned')}
      </p>

      {/* Buddy's pick: the #1 result from the SAME ranked list below — the real
          content/collab/MF blend, not a separate heuristic. Hidden during the seed
          stage, where rankings aren't personalized yet and the buddy would be
          taking credit for generic popularity. */}
      {buddy && stage !== 'seed' && recs.length > 0 && (
        <div className="card buddy-rec"><div className="card-body">
          <Buddy species={buddy.species} sizeStage={buddy.size} elements={buddy.elements} size={84} />
          <div className="buddy-rec-bubble">
            <p className="card-meta" style={{ marginBottom: 2 }}>{t('buddy.rec')}</p>
            <div className="card-title"><DishName name={recs[0].name} name_zh={recs[0].name_zh} /></div>
            <p className="dish-meta">
              {recs[0].restaurant ?? (recs[0].is_synthetic ? t('home.around') : t('home.homecooking'))}
              {cuisineLabel(recs[0].cuisine, lang) ? ` · ${cuisineLabel(recs[0].cuisine, lang)}` : ''}
            </p>
          </div>
        </div></div>
      )}

      {recs.length === 0 && stage !== 'training' && (
        <div className="card"><div className="card-body">
          <p><strong>{t('home.empty.title')}</strong></p>
          <p className="card-meta">{t('home.empty.blurb')}</p>
        </div></div>
      )}

      {stage === 'training' && browse.length > 0 && (
        <>
          <h3 style={{ margin: '18px 0 2px' }}>{t('home.fromothers')}</h3>
          <p className="card-meta" style={{ marginBottom: 10 }}>{t('home.heart.note')}</p>
          {browse.map(r => (
            <article className="card" key={r.dish_id}>
              <div className="card-body scan-row">
                {/* Neutral 50: honest "no ranking yet", matching the scan treatment */}
                <div className="group-ring" style={{ background: `conic-gradient(var(--egg-tart) 180deg, var(--line) 0deg)` }}>
                  <span>50</span>
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="card-title"><DishName name={r.name} name_zh={r.name_zh} /></div>
                  <div className="dish-meta">
                    {r.restaurant ?? (r.is_synthetic ? t('home.around') : t('home.homecooking'))}
                    {cuisineLabel(r.cuisine, lang) ? ` · ${cuisineLabel(r.cuisine, lang)}` : ''}
                  </div>
                </div>
                <HeartButton marked={marked.has(r.dish_id)} onMark={() => markHelpful(r.dish_id)} t={t} />
              </div>
            </article>
          ))}
        </>
      )}

      {recs.map(r => (
        <article className="card" key={r.dish_id}>
          {r.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.photo_url} alt={r.name} className="card-photo" />
          ) : null}
          <div className="card-body">
            <span className={`reason ${r.reason.includes('your taste') || r.reason.includes('community') ? 'collab' : ''}`}>{r.reason}</span>
            <div className="card-title"><DishName name={r.name} name_zh={r.name_zh} /></div>
            <div className="dish-meta">
              {r.restaurant ?? (r.is_synthetic ? t('home.around') : t('home.homecooking'))}
              {cuisineLabel(r.cuisine, lang) ? ` · ${cuisineLabel(r.cuisine, lang)}` : ''}
            </div>
            <div style={{ marginTop: 6 }}>
              <HeartButton marked={marked.has(r.dish_id)} onMark={() => markHelpful(r.dish_id)} t={t} />
            </div>
          </div>
        </article>
      ))}

      <MyDishes t={t} lang={lang} />
    </div>
  );
}

function HeartButton({ marked, onMark, t }: { marked: boolean; onMark: () => void; t: (k: string, p?: Record<string, string | number>) => string }) {
  return (
    <button
      className={`heart-btn ${marked ? 'on' : ''}`}
      onClick={onMark}
      disabled={marked}
      aria-pressed={marked}
      aria-label={marked ? t('home.helped.done') : t('home.helped')}
      title={marked ? t('home.helped.done') : t('home.helped')}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    </button>
  );
}

type MyDish = {
  id: string; name: string; name_zh: string | null; cuisine: string | null;
  photo_url: string | null; restaurant: string | null; hearts: number; my_score: number | null;
  locked: boolean; created_at: string;
};

/** The user's own logged dishes: photo, hearts received, inline rename, delete. */
function MyDishes({ t, lang }: { t: (k: string, p?: Record<string, string | number>) => string; lang: 'zh' | 'en' }) {
  const [dishes, setDishes] = useState<MyDish[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftNameZh, setDraftNameZh] = useState('');
  // Which field the person actually typed into THIS edit session, as opposed to
  // text just sitting there from the original vision guess. Sent to the server so
  // it knows which language is "corrected" (re-translate + re-derive cuisine from
  // it) versus untouched (safe to overwrite with a fresh translation).
  const [editedEn, setEditedEn] = useState(false);
  const [editedZh, setEditedZh] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [relearnedId, setRelearnedId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch('/api/my/dishes')
      .then(r => r.json())
      .then(j => { setDishes(j.dishes ?? []); setHasMore(!!j.has_more); })
      .catch(() => setDishes([]));
  }, []);

  /**
   * Infinite scroll, Instagram/Facebook-style: a sentinel div sits just past the
   * last card. IntersectionObserver (not a scroll listener) fires once it enters
   * the viewport, fetches the next page keyed off the last dish's created_at, and
   * appends. Cheap — the browser handles the "is this near the bottom" check
   * natively, no per-scroll-event JS running.
   */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !dishes || dishes.length === 0) return;
    setLoadingMore(true);
    try {
      const cursor = dishes[dishes.length - 1].created_at;
      const res = await fetch(`/api/my/dishes?before=${encodeURIComponent(cursor)}`);
      const json = await res.json();
      setDishes(prev => [...(prev ?? []), ...(json.dishes ?? [])]);
      setHasMore(!!json.has_more);
    } finally {
      setLoadingMore(false);
    }
  }, [dishes, hasMore, loadingMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: '400px' }); // start loading a bit before it's actually visible
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  function startEdit(d: MyDish) {
    setEditing(d.id);
    setDraftName(d.name);
    setDraftNameZh(d.name_zh ?? '');
    setEditedEn(false); setEditedZh(false);
    setSaveError(null);
  }

  // Two explicit fields, not one "smart" field: renaming used to silently patch
  // only the English name, which was invisible whenever the app happened to be
  // displaying the Chinese name as primary. Editing exactly what's on screen,
  // labeled by language, removes that whole class of "my edit didn't show up" bug.
  //
  // Translation and cuisine re-derivation now happen server-side, atomically with
  // the save (see the PATCH handler) rather than on blur: a blur-triggered call
  // used to race the save itself, and only ever filled a field that was already
  // empty — so correcting an existing wrong name never re-translated the other
  // language or revisited the cuisine vision guessed alongside the wrong name.
  async function rename(id: string) {
    const name = draftName.trim();
    const name_zh = draftNameZh.trim();
    if (!name) { setEditing(null); return; }
    setSaving(true); setSaveError(null);
    const res = await fetch('/api/my/dishes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dish_id: id, name, name_zh: name_zh || null, edited_en: editedEn, edited_zh: editedZh }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setSaveError(json.error ?? 'Could not save.');
      return;
    }
    // Applied from the server's response, not optimistically — the server may have
    // filled in a translation or re-derived cuisine, so its answer is the real one.
    const { dish, relearned } = await res.json();
    setDishes(prev => prev?.map(d => d.id === id ? { ...d, name: dish.name, name_zh: dish.name_zh, cuisine: dish.cuisine } : d) ?? null);
    setEditing(null);
    if (relearned) {
      // The correction changed this dish's attributes AND the profile was rebuilt
      // from the full rating history against them. Saying so is part of the
      // visible-learning mechanic: corrections visibly matter.
      setRelearnedId(id);
      setTimeout(() => setRelearnedId(null), 4000);
    }
  }

  async function remove(id: string) {
    if (!confirm(t('home.delete.confirm'))) return;
    const prevDishes = dishes;
    setDishes(prev => prev?.filter(d => d.id !== id) ?? null);
    const res = await fetch('/api/my/dishes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dish_id: id }),
    });
    if (!res.ok) setDishes(prevDishes); // server refused (e.g. became locked mid-air) — restore it
  }

  if (dishes === null || dishes.length === 0) return null;

  return (
    <>
      <h3 style={{ margin: '22px 0 10px' }}>{t('home.mydishes')}</h3>
      {dishes.map(d => (
        <article className="card" key={d.id}>
          <div className="card-body" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {d.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.photo_url} alt={d.name} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 12, flexShrink: 0 }} />
            ) : null}
            <div style={{ minWidth: 0, flex: 1 }}>
              {editing === d.id ? (
                <div>
                  <label className="label" style={{ fontSize: 11.5 }}>{t('home.name.en')}</label>
                  <input className="field" style={{ marginBottom: 6 }} value={draftName} autoFocus
                    onChange={e => { setDraftName(e.target.value); setEditedEn(true); if (!editedZh) setDraftNameZh(''); }} />
                  <label className="label" style={{ fontSize: 11.5 }}>{t('home.name.zh')}</label>
                  <input className="field" value={draftNameZh} placeholder={editedEn && !editedZh ? t('log.willTranslate') : undefined}
                    onChange={e => { setDraftNameZh(e.target.value); setEditedZh(true); if (!editedEn) setDraftName(''); }} />
                  <p className="card-meta" style={{ marginTop: 4 }}>{t('home.translateOnSave')}</p>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button className="btn primary small" disabled={saving} onClick={() => rename(d.id)}>
                      {saving ? t('home.saving') : t('home.save')}
                    </button>
                    <button className="btn ghost small" disabled={saving} onClick={() => setEditing(null)}>{t('home.cancel')}</button>
                  </div>
                </div>
              ) : (
                <div className="card-title"><DishName name={d.name} name_zh={d.name_zh} /></div>
              )}
              <div className="dish-meta">
                {d.restaurant ?? t('home.homecooking')}
                {cuisineLabel(d.cuisine, lang) ? ` · ${cuisineLabel(d.cuisine, lang)}` : ''}
                {` · ♥ ${t('home.hearts', { n: d.hearts })}`}
              </div>
              {editing !== d.id && (
                d.locked ? (
                  <p className="card-meta" style={{ marginTop: 6, fontSize: 12.5 }}>{t('home.locked')}</p>
                ) : (
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button className="btn ghost small" onClick={() => startEdit(d)}>{t('home.edit')}</button>
                    <button className="btn ghost small" onClick={() => remove(d.id)}>{t('home.delete')}</button>
                  </div>
                )
              )}
              {relearnedId === d.id && (
                <p className="card-meta" style={{ color: 'var(--jade)', fontSize: 12.5, marginTop: 4 }}>{t('log.relearned')}</p>
              )}
              {editing === d.id && saveError && (
                <p style={{ color: 'var(--lacquer)', fontSize: 12.5, marginTop: 4 }}>{saveError}</p>
              )}
            </div>
          </div>
        </article>
      ))}
      {/* Invisible trigger for the next page — IntersectionObserver above watches
          this, not the scroll position, so nothing runs per-scroll-event. */}
      <div ref={sentinelRef} style={{ height: 1 }} aria-hidden />
      {loadingMore && <p className="card-meta" style={{ textAlign: 'center', padding: '8px 0' }}>{t('home.loadingmore')}</p>}
    </>
  );
}
