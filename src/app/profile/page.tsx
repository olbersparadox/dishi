'use client';
import { useEffect, useState } from 'react';
import AuthGate from '@/components/AuthGate';
import { supabaseBrowser } from '@/lib/supabase/client';
import { DIMS } from '@/lib/taste';
import BuddyCard from '@/components/BuddyCard';
<<<<<<< HEAD
import { useLang } from '@/lib/i18n';
=======
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c

export default function ProfilePage() {
  return (
    <AuthGate>
      <TasteProfile />
    </AuthGate>
  );
}

function TasteProfile() {
<<<<<<< HEAD
  const { t } = useLang();
=======
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
  const [vector, setVector] = useState<Record<string, number>>({});
  const [affinity, setAffinity] = useState<Record<string, number>>({});
  const [count, setCount] = useState(0);
  const [points, setPoints] = useState(0);

  useEffect(() => {
    const supabase = supabaseBrowser();
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      const [{ data: taste }, { data: prof }] = await Promise.all([
        supabase.from('taste_profiles').select('*').eq('user_id', uid).maybeSingle(),
        supabase.from('profiles').select('points').eq('id', uid).maybeSingle(),
      ]);
      if (taste) {
        setVector(taste.vector ?? {});
        setAffinity(taste.cuisine_affinity ?? {});
        setCount(taste.rating_count ?? 0);
      }
      setPoints(prof?.points ?? 0);
    });
  }, []);

  const topCuisines = Object.entries(affinity).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div>
<<<<<<< HEAD
      <h1 style={{ marginBottom: 4 }}>{t('profile.title')}</h1>
      <p className="card-meta" style={{ marginBottom: 16 }}>
        {t('profile.flicks', { n: count, p: points })}
        {points > 0 ? t('profile.helped') : ''}
=======
      <h1 style={{ marginBottom: 4 }}>My taste</h1>
      <p className="card-meta" style={{ marginBottom: 16 }}>
        {count} {count === 1 ? 'flick' : 'flicks'} · {points} usefulness points
        {points > 0 ? ' — your logs helped other people decide' : ''}
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
      </p>

      <BuddyCard />

      <div className="card"><div className="card-body">
<<<<<<< HEAD
        <h3 style={{ marginBottom: 12 }}>{t('profile.learned')}</h3>
        {count === 0 ? (
          <p className="card-meta">{t('profile.blank')}</p>
=======
        <h3 style={{ marginBottom: 12 }}>What Dishi has learned</h3>
        {count === 0 ? (
          <p className="card-meta">A blank palate. Log and flick a dish to start the profile.</p>
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
        ) : (
          <div className="bars">
            {DIMS.map(dim => {
              const v = vector[dim] ?? 0;
              const width = Math.abs(v) * 50;
              return (
                <div className="bar-row" key={dim}>
                  <span style={{ textTransform: 'capitalize' }}>{dim}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        left: v >= 0 ? '50%' : `${50 - width}%`,
                        width: `${width}%`,
                        background: v >= 0 ? 'var(--jade)' : 'var(--ink-soft)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div></div>

      {topCuisines.length > 0 && (
        <div className="card"><div className="card-body">
<<<<<<< HEAD
          <h3 style={{ marginBottom: 10 }}>{t('profile.cuisines')}</h3>
=======
          <h3 style={{ marginBottom: 10 }}>Cuisines</h3>
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
          <div className="chips">
            {topCuisines.map(([c, v]) => (
              <span className={`chip ${v > 0 ? 'on' : ''}`} key={c} style={{ textTransform: 'capitalize' }}>
                {c} {v > 0 ? '↑' : '↓'}
              </span>
            ))}
          </div>
        </div></div>
      )}

      <p className="card-meta" style={{ marginTop: 20 }}>
<<<<<<< HEAD
        {t('profile.owner')} <a href="/owner" style={{ color: 'var(--jade)', fontWeight: 650 }}>{t('profile.owner.link')}</a> {t('profile.owner.blurb')}
=======
        Own a restaurant? <a href="/owner" style={{ color: 'var(--jade)', fontWeight: 650 }}>Open the dashboard</a> to see how diners' palates respond to your menu.
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
      </p>
    </div>
  );
}
