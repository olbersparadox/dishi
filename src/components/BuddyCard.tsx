'use client';
import { useCallback, useEffect, useState } from 'react';
import Buddy from './Buddy';
import { SPECIES, type Species } from '@/lib/buddy';
import { useLang } from '@/lib/i18n';

type BuddyState = {
  xp: number;
  level: { name: string; level: number; size: number; progress: number; next: { name: string; remaining: number } | null };
  strength: number;
  elements: { kind: string; id: string; label: string }[];
  hint: { key: string; params?: Record<string, number> };
  knows: string[];
  learning: string[];
  stats: { ratings: number; cuisines: number; dims_explored: number; dims_total: number };
};

export default function BuddyCard() {
  const { t } = useLang();
  const [species, setSpecies] = useState<Species | null | 'loading'>('loading');
  const [state, setState] = useState<BuddyState | null>(null);
  const [switching, setSwitching] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/buddy');
    if (!res.ok) return;
    const json = await res.json();
    setSpecies(json.species);
    setState(json.state);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function adopt(s: Species) {
    setSpecies(s);
    setSwitching(false);
    await fetch('/api/buddy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ species: s }),
    });
  }

  if (species === 'loading') return null;

  // ---- picker ----
  if (!species || switching) {
    return (
      <div className="card"><div className="card-body">
        <h3 style={{ marginBottom: 4 }}>{switching ? t('buddy.switch') : t('buddy.adopt')}</h3>
        <p className="card-meta" style={{ marginBottom: 12 }}>
          {t('buddy.adopt.blurb')}
          {switching && ` ${t('buddy.switch.blurb')}`}
        </p>
        <div className="buddy-picker">
          {SPECIES.map(s => (
            <button key={s} className="buddy-pick" onClick={() => adopt(s)}>
              <Buddy species={s} sizeStage={2} elements={[]} size={88} />
              <strong>{t(`buddy.${s}`)}</strong>
              <span>{t(`buddy.${s}.blurb`)}</span>
            </button>
          ))}
        </div>
        {switching && <button className="btn ghost small" onClick={() => setSwitching(false)}>{t('buddy.nevermind')}</button>}
      </div></div>
    );
  }

  if (!state) return null;

  // ---- grown buddy ----
  return (
    <div className="card"><div className="card-body" style={{ textAlign: 'center' }}>
      <Buddy species={species} sizeStage={state.level.size} elements={state.elements} size={190} />
      <h3 style={{ marginTop: 4 }}>
        {t(`buddy.${species}`)} · <span style={{ color: 'var(--jade)' }}>{t(`buddy.level.${state.level.name}`)}</span>
      </h3>

      <div className="xp-bar" role="progressbar" aria-valuenow={Math.round(state.level.progress * 100)}
        aria-valuemin={0} aria-valuemax={100}
        aria-label={state.level.next ? `Progress to ${state.level.next.name}` : 'Max level'}>
        <div className="xp-fill" style={{ width: `${state.level.progress * 100}%` }} />
      </div>
      <p className="card-meta" style={{ marginTop: 4 }}>
        {state.level.next
          ? t('buddy.xpto', { n: state.level.next.remaining, name: t(`buddy.level.${state.level.next.name}`) })
          : t('buddy.max')}
      </p>

      <p className="buddy-hint">{t(state.hint.key, state.hint.params)}</p>

      {/* Capability honesty, in the Buddy's voice: what it can genuinely read about
          this person's taste already (dims taught by 3+ ratings) and what it's
          still figuring out. Derived entirely from real per-dim evidence — the
          Buddy under-promises and visibly grows, instead of implying an accuracy
          it doesn't have. Shown only once there's something real to say. */}
      {state.knows.length > 0 && (
        <p className="card-meta" style={{ marginTop: 6 }}>
          {t('buddy.knows')}{state.knows.slice(0, 4).map(d => t(`dim.${d}`)).join('\u3001')}
          {state.learning.length > 0 && <>{' \u00B7 '}{t('buddy.learning')}{state.learning.slice(0, 3).map(d => t(`dim.${d}`)).join('\u3001')}</>}
        </p>
      )}

      {state.elements.length > 0 && (
        <div className="chips" style={{ justifyContent: 'center', marginTop: 10 }}>
          {state.elements.map(e => <span className="chip on" key={e.id}>{e.label}</span>)}
        </div>
      )}

      <div className="stat-row" style={{ marginTop: 14, marginBottom: 4 }}>
        <div className="stat"><div className="stat-num">{state.strength}%</div><div className="stat-label">{t('buddy.strength')}</div></div>
        <div className="stat"><div className="stat-num">{state.stats.ratings}</div><div className="stat-label">{t('buddy.flicks')}</div></div>
        <div className="stat"><div className="stat-num">{state.stats.cuisines}</div><div className="stat-label">{t('buddy.cuisines')}</div></div>
        <div className="stat"><div className="stat-num">{state.stats.dims_explored}/{state.stats.dims_total}</div><div className="stat-label">{t('buddy.senses')}</div></div>
      </div>
      <p className="card-meta" style={{ fontSize: 11.5 }}>
        {t('buddy.honest')}
      </p>

      <button className="btn ghost small" style={{ marginTop: 8 }} onClick={() => setSwitching(true)}>
        {t('buddy.switchbtn')}
      </button>
    </div></div>
  );
}
