'use client';
import { useCallback, useEffect, useState } from 'react';
import Buddy from './Buddy';
import { SPECIES, SPECIES_INFO, type Species } from '@/lib/buddy';

type BuddyState = {
  xp: number;
  level: { name: string; level: number; size: number; progress: number; next: { name: string; remaining: number } | null };
  strength: number;
  elements: { kind: string; id: string; label: string }[];
  hint: string;
  stats: { ratings: number; cuisines: number; dims_explored: number; dims_total: number };
};

export default function BuddyCard() {
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
        <h3 style={{ marginBottom: 4 }}>{switching ? 'Switch your buddy' : 'Adopt a taste buddy'}</h3>
        <p className="card-meta" style={{ marginBottom: 12 }}>
          It grows as the taste engine learns you — every flick feeds it.
          {switching && ' Progress carries over: growth lives in your data, not the animal.'}
        </p>
        <div className="buddy-picker">
          {SPECIES.map(s => (
            <button key={s} className="buddy-pick" onClick={() => adopt(s)}>
              <Buddy species={s} sizeStage={2} elements={[]} size={88} />
              <strong>{SPECIES_INFO[s].name}</strong>
              <span>{SPECIES_INFO[s].blurb}</span>
            </button>
          ))}
        </div>
        {switching && <button className="btn ghost small" onClick={() => setSwitching(false)}>Never mind</button>}
      </div></div>
    );
  }

  if (!state) return null;

  // ---- grown buddy ----
  return (
    <div className="card"><div className="card-body" style={{ textAlign: 'center' }}>
      <Buddy species={species} sizeStage={state.level.size} elements={state.elements} size={190} />
      <h3 style={{ marginTop: 4 }}>
        {SPECIES_INFO[species].name} · <span style={{ color: 'var(--jade)' }}>{state.level.name}</span>
      </h3>

      <div className="xp-bar" role="progressbar" aria-valuenow={Math.round(state.level.progress * 100)}
        aria-valuemin={0} aria-valuemax={100}
        aria-label={state.level.next ? `Progress to ${state.level.next.name}` : 'Max level'}>
        <div className="xp-fill" style={{ width: `${state.level.progress * 100}%` }} />
      </div>
      <p className="card-meta" style={{ marginTop: 4 }}>
        {state.level.next
          ? `${state.level.next.remaining} XP to ${state.level.next.name}`
          : 'Fully evolved. A legend at every table.'}
      </p>

      <p className="buddy-hint">{state.hint}</p>

      {state.elements.length > 0 && (
        <div className="chips" style={{ justifyContent: 'center', marginTop: 10 }}>
          {state.elements.map(e => <span className="chip on" key={e.id}>{e.label}</span>)}
        </div>
      )}

      <div className="stat-row" style={{ marginTop: 14, marginBottom: 4 }}>
        <div className="stat"><div className="stat-num">{state.strength}%</div><div className="stat-label">engine strength</div></div>
        <div className="stat"><div className="stat-num">{state.stats.ratings}</div><div className="stat-label">flicks</div></div>
        <div className="stat"><div className="stat-num">{state.stats.cuisines}</div><div className="stat-label">cuisines</div></div>
        <div className="stat"><div className="stat-num">{state.stats.dims_explored}/{state.stats.dims_total}</div><div className="stat-label">senses tuned</div></div>
      </div>
      <p className="card-meta" style={{ fontSize: 11.5 }}>
        Engine strength is real: it measures how much varied signal your recommendations are built on.
        New cuisines are worth 3× a repeat — that's the actual math, not a game rule.
      </p>

      <button className="btn ghost small" style={{ marginTop: 8 }} onClick={() => setSwitching(true)}>
        Switch buddy
      </button>
    </div></div>
  );
}
