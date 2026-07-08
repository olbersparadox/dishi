'use client';
import { useEffect, useState } from 'react';
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
};

/** The user's own logged dishes: photo, hearts received, inline rename, delete. */
function MyDishes({ t, lang }: { t: (k: string, p?: Record<string, string | number>) => string; lang: 'zh' | 'en' }) {
  const [dishes, setDishes] = useState<MyDish[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    fetch('/api/my/dishes').then(r => r.json()).then(j => setDishes(j.dishes ?? [])).catch(() => setDishes([]));
  }, []);

  async function rename(id: string) {
    const name = draft.trim();
    if (!name) { setEditing(null); return; }
    setDishes(prev => prev?.map(d => d.id === id ? { ...d, name } : d) ?? null);
    setEditing(null);
    await fetch('/api/my/dishes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dish_id: id, name }),
    });
  }

  async function remove(id: string) {
    if (!confirm(t('home.delete.confirm'))) return;
    setDishes(prev => prev?.filter(d => d.id !== id) ?? null);
    await fetch('/api/my/dishes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dish_id: id }),
    });
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
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="field" value={draft} onChange={e => setDraft(e.target.value)} autoFocus />
                  <button className="btn primary small" onClick={() => rename(d.id)}>✓</button>
                </div>
              ) : (
                <div className="card-title"><DishName name={d.name} name_zh={d.name_zh} /></div>
              )}
              <div className="dish-meta">
                {d.restaurant ?? t('home.homecooking')}
                {cuisineLabel(d.cuisine, lang) ? ` · ${cuisineLabel(d.cuisine, lang)}` : ''}
                {` · ♥ ${t('home.hearts', { n: d.hearts })}`}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button className="btn ghost small" onClick={() => { setEditing(d.id); setDraft(d.name); }}>{t('home.edit')}</button>
                <button className="btn ghost small" onClick={() => remove(d.id)}>{t('home.delete')}</button>
              </div>
            </div>
          </div>
        </article>
      ))}
    </>
  );
}
