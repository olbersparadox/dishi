'use client';
// Replaces BuddyCard (Session A spec §3, option (a) — clean replacement).
// The taste form IS the companion now: no separate mascot, no species picker.
// XP/level/knows/learning/stats all come from the SAME /api/buddy response as
// before — only the visual identity changed, so nothing about what the card
// honestly reports about the engine changed with it.
import { useCallback, useEffect, useState } from 'react';
import { TasteFormLive, TasteFormReveal } from './TasteForm';
import { topGlyphDims } from '@/lib/blobForm';
import { useLang } from '@/lib/i18n';
import TasteExport from './TasteExport';
import type { ExportDish } from '@/lib/tasteExport';

type BuddyState = {
  level: { name: string; level: number; size: number; progress: number; next: { name: string } | null };
  strength: number;
  elements: { kind: string; id: string; label: string }[];
  hint: { key: string; params?: Record<string, number> };
  knows: string[];
  learning: string[];
  stats: { ratings: number; cuisines: number; dims_explored: number; dims_total: number };
  vector: Record<string, number>;
  evidence: Record<string, number>;
  profile_version: number;
};

const MIGRATION_SEEN_KEY = 'dishi_form_migration_seen';

export default function TasteFormCard({ vector, affinity, count, dishes, userId }: {
  vector: Record<string, number>;
  affinity: Record<string, number>;
  count: number;
  dishes: ExportDish[];
  userId: string;
}) {
  const { t } = useLang();
  const [state, setState] = useState<BuddyState | null>(null);
  const [hadSpecies, setHadSpecies] = useState<string | null | 'loading'>('loading');
  const [showMigration, setShowMigration] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/buddy');
    if (!res.ok) return;
    const json = await res.json();
    setState(json.state);
    setHadSpecies(json.species);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (hadSpecies === 'loading') return;
    const seen = typeof window !== 'undefined' && localStorage.getItem(MIGRATION_SEEN_KEY);
    if (hadSpecies && !seen) setShowMigration(true);
  }, [hadSpecies]);

  function dismissMigration() {
    if (typeof window !== 'undefined') localStorage.setItem(MIGRATION_SEEN_KEY, '1');
    setShowMigration(false);
  }

  if (!state) return null;

  const formInputs = {
    vector: state.vector, evidence: state.evidence,
    ratingCount: state.stats.ratings, seed: `${userId}:v${state.profile_version}`,
  };
  const glyphDims = topGlyphDims(state.vector, state.evidence);
  const glyph = glyphDims.map(d => t(`dim.${d}`).charAt(0)).join(' ');

  if (showMigration) {
    return (
      <div className="card"><div className="card-body" style={{ textAlign: 'center' }}>
        <TasteFormLive inputs={formInputs} size={190} glyph={glyph} />
        <h3 style={{ marginTop: 12 }}>{t('form.migration.title')}</h3>
        <p className="card-meta" style={{ marginTop: 4 }}>{t('form.migration.blurb')}</p>
        <button className="btn primary" style={{ marginTop: 14 }} onClick={dismissMigration}>
          {t('form.migration.cta')}
        </button>
      </div></div>
    );
  }

  return (
    <>
    <div className="taste-form-card">
      {/* Per the design mock, the taste-form card shows: the blob, the 2-item
          dot legend, the XP/level line + progress bar, and the 4-stat grid.
          What was here beyond the mock — the buddy hint paragraph, the element
          chips, and the "honest" footnote line — is removed (the underlying
          /api/buddy data is unchanged; only these three UI extras are gone).
          Centering of the blob is handled inside TasteFormReveal. */}
      <TasteFormReveal
        inputs={formInputs} size={190} glyph={glyph}
        vector={state.vector} labelFor={(dim) => t(`dim.${dim}`)}
      />

      <div className="taste-form-legend">
        <span><span className="dot dot-knows" />{t('buddy.knows.count', { n: state.knows.length })}</span>
        <span><span className="dot dot-learning" />{t('buddy.learning.count', { n: state.learning.length })}</span>
      </div>

      {/* Level name + "N XP to <next>" text removed per design — the bar alone
          carries progress now, without the nagging countdown line. */}
      <div className="xp-bar" role="progressbar" aria-valuenow={Math.round(state.level.progress * 100)}
        aria-valuemin={0} aria-valuemax={100}
        aria-label={state.level.next
          ? `Progress to ${t(`buddy.level.${state.level.next.name}`)}`
          : 'Max level'}
        style={{ maxWidth: 200, marginTop: 18, marginLeft: 'auto', marginRight: 'auto' }}>
        <div className="xp-fill" style={{ width: `${state.level.progress * 100}%` }} />
      </div>

      <div className="stat-row" style={{ marginTop: 20, marginBottom: 0 }}>
        <div className="stat taste-stat"><div className="stat-num">{state.strength}%</div><div className="stat-label">{t('buddy.strength')}</div></div>
        <div className="stat taste-stat"><div className="stat-num">{state.stats.ratings}</div><div className="stat-label">{t('buddy.flicks')}</div></div>
        <div className="stat taste-stat"><div className="stat-num">{state.stats.cuisines}</div><div className="stat-label">{t('buddy.cuisines')}</div></div>
        <div className="stat taste-stat"><div className="stat-num">{state.stats.dims_explored}/{state.stats.dims_total}</div><div className="stat-label">{t('buddy.senses')}</div></div>
      </div>
    </div>

    <TasteExport vector={vector} affinity={affinity} count={count} dishes={dishes} />
    </>
  );
}
