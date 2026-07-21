'use client';
// Replaces BuddyCard (Session A spec §3, option (a) — clean replacement).
// The taste form IS the companion now: no separate mascot, no species picker.
// XP/level/knows/learning/stats all come from the SAME /api/buddy response as
// before — only the visual identity changed, so nothing about what the card
// honestly reports about the engine changed with it.
import { useCallback, useEffect, useState } from 'react';
import { TasteFormLive, TasteFormReveal } from './TasteForm';
import { topGlyphDims } from '@/lib/blobForm';
import { useLang, cuisineLabel } from '@/lib/i18n';
import TasteExport from './TasteExport';
import ExplainModal from './ExplainModal';
import type { ExportDish } from '@/lib/tasteExport';
import type { Persona } from '@/lib/persona';

type BuddyState = {
  // The dishi version ladder (replaced Levels): v = ratcheted unlock history (what
  // the UI names), progress = live 0..1 toward the next version (may honestly dip).
  version: { v: number; live: number; progress: number; nextAt: number; justUnlockedTo: number | null };
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

export default function TasteFormCard({ vector, affinity, count, dishes, userId, persona, name }: {
  vector: Record<string, number>;
  affinity: Record<string, number>;
  count: number;
  dishes: ExportDish[];
  userId: string;
  persona: Persona;
  name: string | null;
}) {
  const { t, lang } = useLang();
  const [state, setState] = useState<BuddyState | null>(null);
  const [hadSpecies, setHadSpecies] = useState<string | null | 'loading'>('loading');
  const [showMigration, setShowMigration] = useState(false);
  // Which stat box's explainer is open — same tap-a-glyph-to-learn-more pattern as
  // the globe/notification icons (a scrim + an anchored paper sheet), applied to the
  // 4 stat boxes so each number can explain what it actually measures.
  const [openStat, setOpenStat] = useState<null | 'strength' | 'flicks' | 'cuisines' | 'senses'>(null);

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

  // Top cuisine affinities — same derivation the old standalone 菜系 card on the
  // profile page used (moved here: it's now shown inside the 菜系 stat's own
  // explainer instead of living as a separate card further down the page).
  const topCuisines = Object.entries(affinity).sort((a, b) => b[1] - a[1]).slice(0, 5);

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

      {/* The version line: V{n} (the ratcheted dishi version) leads the 識咗/摸緊
          legend, and the bar below runs the FULL stat-line width toward V{n+1} at its
          right end — progress between version thresholds, not raw confidence. The
          ladder is unbounded (see version.ts); Levels and their animal names are gone. */}
      <div className="version-line">
        <span className="version-now">V{state.version.v}</span>
        <div className="taste-form-legend" style={{ marginTop: 0 }}>
          <span><span className="dot dot-knows" />{t('buddy.knows.count', { n: state.knows.length })}</span>
          <span><span className="dot dot-learning" />{t('buddy.learning.count', { n: state.learning.length })}</span>
        </div>
      </div>

      <div className="version-bar-row">
        <div className="xp-bar" role="progressbar" aria-valuenow={Math.round(state.version.progress * 100)}
          aria-valuemin={0} aria-valuemax={100}
          aria-label={`dishi v${state.version.v} → v${state.version.v + 1}`}
          style={{ flex: 1 }}>
          <div className="xp-fill" style={{ width: `${state.version.progress * 100}%` }} />
        </div>
        <span className="version-next">V{state.version.v + 1}</span>
      </div>

      {/* Each stat is tappable — same tap-to-explain pattern as the header's globe/
          notification icons (a scrim + an anchored paper sheet), so the numbers can
          say what they actually measure instead of sitting there unexplained. */}
      <div className="stat-row stat-row-tappable" style={{ marginTop: 20, marginBottom: 0 }}>
        {([
          { key: 'strength' as const, num: `${state.strength}%`, label: t('buddy.strength') },
          { key: 'flicks' as const, num: `${state.stats.ratings}`, label: t('buddy.flicks') },
          { key: 'cuisines' as const, num: `${state.stats.cuisines}`, label: t('buddy.cuisines') },
          { key: 'senses' as const, num: `${state.stats.dims_explored}/${state.stats.dims_total}`, label: t('buddy.senses') },
        ]).map(s => (
          <button key={s.key} type="button" className="stat taste-stat stat-tap"
            onClick={() => setOpenStat(v => (v === s.key ? null : s.key))}
            aria-expanded={openStat === s.key} aria-label={`${s.label}: ${t(`buddy.explain.${s.key}`, { total: state.stats.dims_total })}`}>
            <div className="stat-num">{s.num}</div>
            <div className="stat-label">{s.label}</div>
          </button>
        ))}
        {openStat && (
          <ExplainModal
            title={t(`buddy.${openStat}`)}
            body={t(`buddy.explain.${openStat}`, { total: state.stats.dims_total })}
            onClose={() => setOpenStat(null)}
            // 菜系 additionally shows the real cuisine-affinity breakdown — the same
            // pills the old standalone card at the bottom of the page used to show.
            extra={openStat === 'cuisines' && topCuisines.length > 0 ? (
              <div className="explain-modal-chips">
                {topCuisines.map(([c, v]) => (
                  <span className={`chip ${v > 0 ? 'on' : ''}`} key={c}>
                    {cuisineLabel(c, lang) || c} {v > 0 ? '↑' : '↓'}
                  </span>
                ))}
              </div>
            ) : undefined}
          />
        )}
      </div>
    </div>

    <TasteExport vector={vector} affinity={affinity} count={count} dishes={dishes}
      persona={persona} name={name} version={state.version.v} />
    </>
  );
}
