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
      .then(j => { setRecs(j.recommendations ?? []); setStage(j.stage ?? 'seed'); })
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

      {recs.length === 0 && (
        <div className="card"><div className="card-body">
          <p><strong>{t('home.empty.title')}</strong></p>
          <p className="card-meta">{t('home.empty.blurb')}</p>
        </div></div>
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
              <button
                className={`heart-btn ${marked.has(r.dish_id) ? 'on' : ''}`}
                onClick={() => markHelpful(r.dish_id)}
                disabled={marked.has(r.dish_id)}
                aria-pressed={marked.has(r.dish_id)}
                aria-label={marked.has(r.dish_id) ? t('home.helped.done') : t('home.helped')}
                title={marked.has(r.dish_id) ? t('home.helped.done') : t('home.helped')}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
