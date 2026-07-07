'use client';
import { useEffect, useState } from 'react';
import AuthGate from '@/components/AuthGate';
import DishName from '@/components/DishName';
import { useLang } from '@/lib/i18n';

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
  const { t } = useLang();
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
            <div className="card-meta">
              {r.restaurant ?? (r.is_synthetic ? t('home.around') : t('home.homecooking'))}
              {r.cuisine && r.cuisine !== 'unknown' ? ` · ${r.cuisine}` : ''}
            </div>
            <div style={{ marginTop: 10 }}>
              <button
                className={`chip ${marked.has(r.dish_id) ? 'on' : ''}`}
                onClick={() => markHelpful(r.dish_id)}
                disabled={marked.has(r.dish_id)}
              >
                {marked.has(r.dish_id) ? t('home.helped.done') : t('home.helped')}
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
