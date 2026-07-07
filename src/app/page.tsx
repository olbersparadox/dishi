'use client';
import { useEffect, useState } from 'react';
import AuthGate from '@/components/AuthGate';
<<<<<<< HEAD
import DishName from '@/components/DishName';
import { useLang } from '@/lib/i18n';

type Rec = {
  dish_id: string; name: string; name_zh?: string | null; cuisine: string; photo_url: string | null;
=======

type Rec = {
  dish_id: string; name: string; cuisine: string; photo_url: string | null;
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
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
<<<<<<< HEAD
  const { t } = useLang();
=======
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
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

<<<<<<< HEAD
  if (recs === null) return <p className="card-meta">{t('home.setting')}</p>;
=======
  if (recs === null) return <p className="card-meta">Setting the table…</p>;
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c

  return (
    <div>
      {justRated && (
        <div className="rated-banner" role="status">
          <span>🍜</span>
<<<<<<< HEAD
          <span>{t('home.rated')} <a href="/profile">{t('home.rated.see')}</a></span>
        </div>
      )}
      <h1 style={{ marginBottom: 4 }}>{t('home.title')}</h1>
      <p className="card-meta" style={{ marginBottom: 16 }}>
        {stage === 'seed' && t('home.stage.seed')}
        {stage === 'content' && t('home.stage.content')}
        {stage === 'collab' && t('home.stage.collab')}
        {stage === 'learned' && t('home.stage.learned')}
=======
          <span>Nice flick — your buddy grew a little. <a href="/profile">See it</a></span>
        </div>
      )}
      <h1 style={{ marginBottom: 4 }}>For you</h1>
      <p className="card-meta" style={{ marginBottom: 16 }}>
        {stage === 'seed' && 'Rate a few dishes and this feed becomes yours.'}
        {stage === 'content' && 'Picked from what you already loved. More raters, better picks.'}
        {stage === 'collab' && 'Chosen by people whose taste matches yours.'}
        {stage === 'learned' && 'Dishi has enough community data to learn hidden taste patterns for you.'}
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
      </p>

      {recs.length === 0 && (
        <div className="card"><div className="card-body">
<<<<<<< HEAD
          <p><strong>{t('home.empty.title')}</strong></p>
          <p className="card-meta">{t('home.empty.blurb')}</p>
=======
          <p><strong>Nothing on the menu yet.</strong></p>
          <p className="card-meta">Log your first dish — every flick sharpens your recommendations.</p>
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
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
<<<<<<< HEAD
            <div className="card-title"><DishName name={r.name} name_zh={r.name_zh} /></div>
            <div className="card-meta">
              {r.restaurant ?? (r.is_synthetic ? t('home.around') : t('home.homecooking'))}
=======
            <div className="card-title">{r.name}</div>
            <div className="card-meta">
              {r.restaurant ?? (r.is_synthetic ? 'Around the city' : 'Home cooking')}
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
              {r.cuisine && r.cuisine !== 'unknown' ? ` · ${r.cuisine}` : ''}
            </div>
            <div style={{ marginTop: 10 }}>
              <button
                className={`chip ${marked.has(r.dish_id) ? 'on' : ''}`}
                onClick={() => markHelpful(r.dish_id)}
                disabled={marked.has(r.dish_id)}
              >
<<<<<<< HEAD
                {marked.has(r.dish_id) ? t('home.helped.done') : t('home.helped')}
=======
                {marked.has(r.dish_id) ? '✓ Helped me decide' : 'This helped me decide'}
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
