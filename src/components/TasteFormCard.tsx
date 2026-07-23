'use client';
// Replaces BuddyCard (Session A spec §3, option (a) — clean replacement).
// The taste form IS the companion now: no separate mascot, no species picker.
// XP/level/knows/learning/stats all come from the SAME /api/buddy response as
// before — only the visual identity changed, so nothing about what the card
// honestly reports about the engine changed with it.
//
// This card also owns the AI-palate install flow (owner spec 2026-07-23):
// tapping the vermillion 植入 CTA morphs THIS card in place into the persona
// carousel (State B — version line / bar / stat boxes hidden, blob kept), and
// tapping a host logo there opens the install layer (the shared ExplainModal)
// whose black copy-circle generates + copies the export doc in the selected
// voice. The old pick-to-copy textarea UI (TasteExport) was killed on this
// replacement per CLAUDE.md — no importable legacy.
import { useCallback, useEffect, useRef, useState } from 'react';
import { TasteFormLive, TasteFormReveal } from './TasteForm';
import { topGlyphDims } from '@/lib/blobForm';
import { useLang, cuisineLabel } from '@/lib/i18n';
import ExplainModal from './ExplainModal';
import {
  extractTasteSections, buildTastePrompt, confidenceInputsFrom, evidenceConfidence,
  exportUnlocked, ratingsToUnlock, INSTALL_HOSTS, type InstallHost, type ExportDish,
  type ExportCompanions,
} from '@/lib/tasteExport';
import { PERSONAS, PERSONA_META, VOICES, type Persona } from '@/lib/persona';
import { LockIcon, CloseIcon, CopyIcon, CheckIcon } from './icons';

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

export default function TasteFormCard({ vector, affinity, count, dishes, userId, persona, name, onPersonaPersisted }: {
  vector: Record<string, number>;
  affinity: Record<string, number>;
  count: number;
  dishes: ExportDish[];
  userId: string;
  persona: Persona;
  name: string | null;
  /** A successful copy persisted this persona server-side — lets the page's own
   * persona state follow, so a later reopen starts the carousel there. */
  onPersonaPersisted?: (p: Persona) => void;
}) {
  const { t, lang } = useLang();
  const [state, setState] = useState<BuddyState | null>(null);
  const [hadSpecies, setHadSpecies] = useState<string | null | 'loading'>('loading');
  const [showMigration, setShowMigration] = useState(false);
  // Which stat box's explainer is open — same tap-a-glyph-to-learn-more pattern as
  // the globe/notification icons (a scrim + an anchored paper sheet), applied to the
  // 4 stat boxes so each number can explain what it actually measures.
  const [openStat, setOpenStat] = useState<null | 'strength' | 'flicks' | 'cuisines' | 'senses'>(null);

  // ── Install flow (owner spec 2026-07-23) ──────────────────────────────────────
  // State B: this card morphed into the persona carousel. The carousel index is
  // session-local until a COPY succeeds (the /api/taste/export POST persists it);
  // swiping alone never persists, and the X restores State A with nothing saved.
  const [expanded, setExpanded] = useState(false);
  const storedIdx = Math.max(0, PERSONAS.indexOf(persona));
  const [idx, setIdx] = useState(storedIdx);
  const [installHost, setInstallHost] = useState<InstallHost | null>(null);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  // Swipe: pointer-based so mouse drags work too. Vertical scrolling stays native
  // (touch-action: pan-y on the viewport); a horizontal pull past the threshold
  // advances the carousel on release.
  const dragStartX = useRef<number | null>(null);
  const [dragDelta, setDragDelta] = useState(0);

  const openExpand = () => { setIdx(storedIdx); setExpanded(true); };
  const closeExpand = () => { setExpanded(false); setInstallHost(null); setIdx(storedIdx); };
  const endDrag = () => {
    if (dragStartX.current == null) return;
    if (dragDelta <= -48 && idx < PERSONAS.length - 1) setIdx(idx + 1);
    else if (dragDelta >= 48 && idx > 0) setIdx(idx - 1);
    dragStartX.current = null;
    setDragDelta(0);
  };

  // One tap = generate + copy. The POST is the real export event (it persists the
  // persona AND advances the delta baseline), so it fires ONLY here — never on
  // open/prefetch. Clipboard: ClipboardItem with a promised payload where
  // supported (Safari requires the write to start inside the gesture; the payload
  // may resolve after), falling back to await-then-writeText elsewhere.
  const copyDoc = async () => {
    if (copying) return;
    const sel = PERSONAS[idx];
    setCopying(true);
    const build = async () => {
      let version: number | undefined;
      let companions: ExportCompanions | undefined;
      try {
        const res = await fetch('/api/taste/export', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ persona: sel }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok) { version = json.profile_version ?? undefined; companions = json.companions ?? undefined; }
      } catch { /* version/companions are a bonus on top of the doc, not required for it */ }
      const sections = extractTasteSections(
        { vector, affinity, ratingCount: count, dishes },
        dim => t(`dim.${dim}`),
        c => cuisineLabel(c, lang),
      );
      return buildTastePrompt(sections, { persona: sel, version, name, companions });
    };
    try {
      if (typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([new ClipboardItem({
          'text/plain': build().then(txt => new Blob([txt], { type: 'text/plain' })),
        })]);
      } else {
        await navigator.clipboard.writeText(await build());
      }
      setCopied(true);
      onPersonaPersisted?.(sel);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard can be blocked; the quiet default beats a fake 已複製 */ }
    setCopying(false);
  };

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

  const ci = confidenceInputsFrom(vector, affinity, count);
  const ready = exportUnlocked(evidenceConfidence(ci));
  const selName = VOICES[PERSONAS[idx]].displayName;

  return (
    <>
    <div className={`taste-form-card ${expanded ? 'persona-expand' : ''}`}>
      {/* State B's close — the same quiet top-right X the growth screen uses.
          Cancel restores State A with nothing saved. */}
      {expanded && (
        <button className="grow-close" onClick={closeExpand} aria-label={t('home.cancel')}>
          <CloseIcon size={18} />
        </button>
      )}
      {/* Per the design mock, the taste-form card shows: the blob, the 2-item
          dot legend, the XP/level line + progress bar, and the 4-stat grid.
          What was here beyond the mock — the buddy hint paragraph, the element
          chips, and the "honest" footnote line — is removed (the underlying
          /api/buddy data is unchanged; only these three UI extras are gone).
          Centering of the blob is handled inside TasteFormReveal. */}
      {/* .taste-blob-anchor: hidden (via body.rating-open) while a rating session's
          glass overlay is up, so its blob never ghosts behind the growth screen's. */}
      <div className="taste-blob-anchor">
        <TasteFormReveal
          inputs={formInputs} size={190} glyph={glyph}
          vector={state.vector} labelFor={(dim) => t(`dim.${dim}`)}
        />
      </div>

      {!expanded ? (<>
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
      </>) : (
      /* ── State B: the persona carousel (owner spec 2026-07-23). Version line,
         bar and stat boxes are hidden; the blob stays. Swipe left/right moves
         Spoon → CK → Kiki; the dots only indicate. No per-persona blob art in
         this pass, per the spec. */
      <div className="persona-pick">
        <div
          className="persona-viewport"
          onPointerDown={e => { dragStartX.current = e.clientX; }}
          onPointerMove={e => { if (dragStartX.current != null) setDragDelta(e.clientX - dragStartX.current); }}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={endDrag}
        >
          <div
            className="persona-track"
            style={{
              transform: `translateX(calc(${-idx * 100}% + ${dragDelta}px))`,
              transition: dragStartX.current != null ? 'none' : undefined,
            }}
          >
            {PERSONAS.map(p => (
              <div className="persona-slide" key={p}>
                <div className="persona-name">{VOICES[p].displayName}</div>
                <p className="persona-blurb">{lang === 'zh' ? PERSONA_META[p].blurbZh : PERSONA_META[p].blurbEn}</p>
              </div>
            ))}
          </div>
        </div>
        {/* Tap the dots AS A GROUP to advance — same forward-only cycle a swipe would
            reach one step at a time, looping 3rd → 1st rather than dead-ending. */}
        <button type="button" className="persona-dots" onClick={() => setIdx(i => (i + 1) % PERSONAS.length)}
          aria-label={t('persona.next')}>
          {PERSONAS.map((p, i) => <span key={p} className={`persona-dot ${i === idx ? 'on' : ''}`} />)}
        </button>
        <div className="persona-divider-wrap">
          <hr className="persona-divider" />
          <span className="persona-divider-arrow" aria-hidden />
        </div>
        {/* Host logos as buttons — same marks/order as the resting row below,
            now each in a thin rounded-square outline marking them tappable. */}
        <div className="persona-hosts">
          {INSTALL_HOSTS.map(h => (
            <button key={h.id} type="button" className="persona-host-btn"
              onClick={() => { setCopied(false); setInstallHost(h); }}
              aria-label={h.label} title={h.label}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={h.logo} alt="" width={28} height={28} />
            </button>
          ))}
        </div>
      </div>
      )}
    </div>

    {/* State A's resting CTA card — logos + the vermillion 植入 button (one of
        vermillion's two sanctioned uses). Tapping it morphs the card above into
        the persona carousel; below the unlock gate it stays an honest countdown. */}
    {!expanded && (
      <div className="ai-export-card">
        <div className="ai-logo-row">
          {INSTALL_HOSTS.map(h => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={h.id} src={h.logo} alt={h.label} width={32} height={32} />
          ))}
        </div>
        <button className={`btn export ${!ready ? 'is-locked' : ''}`} style={{ width: '100%' }}
          onClick={openExpand} disabled={!ready}>
          {ready
            ? t('export.button', { v: Math.max(1, state.version.v) })
            : <><LockIcon size={16} /> {t('export.locked', { n: ratingsToUnlock(ci) })}</>}
        </button>
      </div>
    )}

    {/* The install layer — the SAME centered layer as every ⓘ explainer (shared
        ExplainModal), with the bottom circle repurposed as the copy action: one
        tap generates the doc in the selected voice, copies it, and persists the
        persona (the POST inside copyDoc is the real export event). Scrim tap
        dismisses back to State B with the carousel where it was. */}
    {installHost && (
      <ExplainModal
        title={t('install.title', { name: selName })}
        onClose={() => { setInstallHost(null); setCopied(false); }}
        extra={
          <ol className="install-steps">
            {(lang === 'zh' ? installHost.zh : installHost.en)(selName).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        }
        footer={
          <div className="install-copy-wrap">
            <button className="ok-circle" onClick={copyDoc} disabled={copying} aria-label={t('export.copy')}>
              {copied ? <CheckIcon size={26} /> : <CopyIcon size={24} />}
            </button>
            {copied && <p className="card-meta">{t('copied.short')}</p>}
          </div>
        }
      />
    )}
    </>
  );
}
