'use client';
// Replaces BuddyCard (Session A spec §3, option (a) — clean replacement).
// The taste form IS the companion now: no separate mascot, no species picker.
// XP/level/knows/learning/stats all come from the SAME /api/buddy response as
// before — only the visual identity changed, so nothing about what the card
// honestly reports about the engine changed with it.
//
// This card also owns the AI-palate install flow: tapping the vermillion 植入
// CTA morphs THIS card in place into the install surface (State B — version
// line / bar / stat boxes hidden, blob kept), and tapping a host logo there
// opens the install layer (the shared ExplainModal) whose black copy-circle
// generates + copies the taste-only export doc. The persona CAROUSEL that
// lived in State B died with the persona-voiced export (owner decision 5,
// built 2026-07-28): the doc carries the palate alone, so there is no voice
// to choose — what State B shows now is the identity being installed
// (dishi.{username}, the container name) and the host to install into. The
// old pick-to-copy textarea UI (TasteExport) was killed on the 2026-07-23
// replacement per CLAUDE.md — no importable legacy.
import { useCallback, useEffect, useRef, useState } from 'react';
import { TasteFormLive, TasteFormReveal } from './TasteForm';
import { topGlyphDims } from '@/lib/blobForm';
import { useLang, cuisineLabel } from '@/lib/i18n';
import { useShrinkToFitWidth } from '@/lib/shrinkToFit';
import ExplainModal from './ExplainModal';
import {
  extractTasteSections, buildTastePrompt, confidenceInputsFrom, evidenceConfidence,
  exportUnlocked, ratingsToUnlock, exportContainerName, INSTALL_HOSTS,
  type InstallHost, type ExportDish, type ExportCompanions,
} from '@/lib/tasteExport';
import { MESSENGER_MARKS } from '@/lib/messengers';
import { shareLink } from '@/lib/share';
import { splitBoldKeywords } from '@/lib/textBold';
import { CloseIcon, CopyIcon, CheckIcon, EditIcon } from './icons';
import UsernameSheet from './UsernameSheet';
import {
  normalizeUsername, validateUsername, asUsernameErrCode, type UsernameErrCode,
} from '@/lib/username';

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

type Identity = { username: string | null; claimed: boolean; changesLeft: number };

const MIGRATION_SEEN_KEY = 'dishi_form_migration_seen';

export default function TasteFormCard({ vector, affinity, count, dishes, userId, onAlbumPath }: {
  vector: Record<string, number>;
  affinity: Record<string, number>;
  count: number;
  dishes: ExportDish[];
  userId: string;
  /** Opens the 相簿舊菜 photo picker (the entry pill's own album input) — the
   * locked state's designed fast track to a first unlock (§1/§5). */
  onAlbumPath?: () => void;
}) {
  const { t, lang } = useLang();
  const [state, setState] = useState<BuddyState | null>(null);
  // dishi.username. `claimed` false with a non-null username is the normal
  // pre-feature state: every profile already carries an email-derived handle.
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [namingOpen, setNamingOpen] = useState(false);
  // The unclaimed naming pill under the blob: a REAL live input (not a trigger
  // that hands off to a modal) — the explanation card it opens on first focus is
  // purely informational (plain ExplainModal, no field of its own), so typing and
  // saving both have to live here. Logic mirrors UsernameSheet's rename case
  // (debounced check via the shared lib/username.ts vocabulary) but is simpler:
  // a fresh claim has no `current`/`unchanged`/`spent` to track.
  const [claimValue, setClaimValue] = useState('');
  const [claimStatus, setClaimStatus] = useState<
    { kind: 'idle' } | { kind: 'checking' } | { kind: 'ok' } | { kind: 'err'; code: UsernameErrCode }
  >({ kind: 'idle' });
  const [claimSaving, setClaimSaving] = useState(false);
  const claimSeq = useRef(0);
  // Dismissing the explainer doesn't naturally return focus anywhere (verified:
  // it falls back to <body>) — refocus explicitly so the person can keep typing
  // right away instead of needing a second tap on the pill.
  const claimInputRef = useRef<HTMLInputElement>(null);
  // Shown once, on the pill's first focus — not every time, or re-focusing after
  // tapping away mid-typing would interrupt with the same warning again.
  const [claimExplainOpen, setClaimExplainOpen] = useState(false);
  const [claimExplainSeen, setClaimExplainSeen] = useState(false);
  const [hadSpecies, setHadSpecies] = useState<string | null | 'loading'>('loading');
  const [showMigration, setShowMigration] = useState(false);
  // Which stat box's explainer is open — same tap-a-glyph-to-learn-more pattern as
  // the globe/notification icons (a scrim + an anchored paper sheet), applied to the
  // 4 stat boxes so each number can explain what it actually measures.
  const [openStat, setOpenStat] = useState<null | 'strength' | 'flicks' | 'cuisines' | 'senses'>(null);
  // State B's two panels: which one is in view (drives the dots), and the
  // scroll element the dots scroll back to.
  const [panel, setPanel] = useState(0);
  const swipeRef = useRef<HTMLDivElement>(null);
  // Transient "link copied" under the share row — only reachable on desktop,
  // where there is no OS sheet and nothing else would confirm the copy.
  const [shareCopied, setShareCopied] = useState(false);
  // Shrink-to-fit for the claimed dishi.{username} display — shared with
  // PublicDossier.tsx (the SAME line, kept in sync at --fs-title-b). Only
  // this static display; the unclaimed "dishi." prefix beside the live claim
  // input keeps its own untouched .username-claim-prefix size.
  const identityRef = useRef<HTMLSpanElement>(null);
  useShrinkToFitWidth(identityRef, identity?.claimed ? identity.username : null);

  // Debounced availability check for the inline claim pill — same shape as
  // UsernameSheet's own (sequence-numbered so a slow early check can't overwrite
  // the verdict for what's in the box now), just with no unchanged/spent case.
  useEffect(() => {
    const trimmed = normalizeUsername(claimValue);
    if (!trimmed) { setClaimStatus({ kind: 'idle' }); return; }
    const local = validateUsername(trimmed);
    if (local) { setClaimStatus({ kind: 'err', code: local }); return; }
    setClaimStatus({ kind: 'checking' });
    const mine = ++claimSeq.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/username?check=${encodeURIComponent(trimmed)}`);
        const json = await res.json();
        if (mine !== claimSeq.current) return;
        if (!res.ok) { setClaimStatus({ kind: 'err', code: 'failed' }); return; }
        setClaimStatus(json.available ? { kind: 'ok' } : { kind: 'err', code: asUsernameErrCode(json.error ?? 'taken') });
      } catch {
        if (mine === claimSeq.current) setClaimStatus({ kind: 'idle' });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [claimValue]);

  const claimSave = async () => {
    if (claimSaving || claimStatus.kind !== 'ok') return;
    setClaimSaving(true);
    try {
      const res = await fetch('/api/username', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: normalizeUsername(claimValue) }),
      });
      const json = await res.json();
      if (!res.ok) { setClaimStatus({ kind: 'err', code: asUsernameErrCode(json.error) }); return; }
      setIdentity({ username: json.username, claimed: true, changesLeft: json.changesLeft });
    } catch {
      setClaimStatus({ kind: 'err', code: 'failed' });
    } finally {
      setClaimSaving(false);
    }
  };

  // ── Install flow ──────────────────────────────────────────────────────────────
  // State B: this card morphed into the install surface. The X restores State A;
  // nothing is committed until a COPY succeeds (the /api/taste/export POST is the
  // real export event).
  const [expanded, setExpanded] = useState(false);
  const [installHost, setInstallHost] = useState<InstallHost | null>(null);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);

  const openExpand = () => setExpanded(true);
  const closeExpand = () => { setExpanded(false); setInstallHost(null); };

  // One tap = generate + copy. The POST is the real export event (it advances the
  // delta baseline), so it fires ONLY here — never on open/prefetch. The doc is
  // named by the CLAIMED username alone (never the legacy email-derived handle —
  // unclaimed exports stay anonymous rather than leak an address local-part).
  // Clipboard: ClipboardItem with a promised payload where supported (Safari
  // requires the write to start inside the gesture; the payload may resolve
  // after), falling back to await-then-writeText elsewhere.
  const copyDoc = async () => {
    if (copying) return;
    setCopying(true);
    const build = async () => {
      let version: number | undefined;
      let companions: ExportCompanions | undefined;
      try {
        const res = await fetch('/api/taste/export', { method: 'POST' });
        const json = await res.json().catch(() => ({}));
        if (res.ok) { version = json.profile_version ?? undefined; companions = json.companions ?? undefined; }
      } catch { /* version/companions are a bonus on top of the doc, not required for it */ }
      const sections = extractTasteSections(
        { vector, affinity, ratingCount: count, dishes },
        dim => t(`dim.${dim}`),
        c => cuisineLabel(c, lang),
      );
      return buildTastePrompt(sections, {
        version, name: identity?.claimed ? identity.username : null, companions,
      });
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
    if (json.identity) setIdentity(json.identity);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Derived from props alone (not buddy state), so it's safe above the early
  // returns — and the preview effect below needs it.
  const ci = confidenceInputsFrom(vector, affinity, count);
  const ready = exportUnlocked(evidenceConfidence(ci));

  // The recurring "what's new in v{N}" line (§5 + the versioning-deltas open
  // thread): a READ-ONLY preview of what the next export would report — the GET
  // never touches the delta baseline or the stored persona (those move only on
  // a real copy, via POST inside copyDoc). Quiet on failure: the line is a
  // bonus over the CTA, never a blocker.
  const [preview, setPreview] = useState<{
    profile_version: number; delta: { dim: string; dir: 1 | -1 }[];
    is_first_export: boolean; new_companions: string[];
  } | null>(null);
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    fetch('/api/taste/export')
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (alive && j) setPreview(j); })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

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

  // The container name the install steps + doc summon line both teach — the
  // claimed identity when there is one, plain "dishi" when not.
  const containerName = exportContainerName(identity?.claimed ? identity.username : null);

  /** Send the public taste page. Same helper every other share in the app
   *  runs (lib/share.ts), so a dismissed OS sheet stays silent and desktop
   *  falls back to the clipboard — the one case that needs saying out loud,
   *  since nothing else on screen would confirm it. */
  const shareProfile = async () => {
    if (!identity?.claimed || !identity.username) return;
    const url = `${window.location.origin}/${identity.username}`;
    const result = await shareLink({ title: `dishi.${identity.username}`, url });
    if (result === 'copied') {
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2500);
    }
  };

  /** Defined ONCE and mounted in both panels: the spec's requirement is that
   *  the two panels share the same divider, and two copies of the markup
   *  would be free to drift apart. */
  const personaDivider = (
    <div className="persona-divider-wrap">
      <hr className="persona-divider" />
      <span className="persona-divider-arrow" aria-hidden />
    </div>
  );

  return (
    <>
    <div className="taste-form-card">
      {/* State B's close — the same quiet top-right X the growth screen uses.
          Cancel restores State A with nothing saved. */}
      {expanded && (
        <button className="grow-close" onClick={closeExpand} aria-label={t('home.cancel')}>
          <CloseIcon size={18} />
        </button>
      )}
      {/* Renaming used to be reached by tapping the dishi.{username} text itself —
          now that label sits in the card's own big/black type (not a pill button
          anymore, see the identity row below), so the tap target moves here: a
          quiet pencil pinned to the card's top-right corner, matching .grow-close's
          own weight/position pattern one corner over. */}
      {!expanded && identity?.claimed && state.version.v >= 1 && (
        <button type="button" className="taste-name-edit"
          onClick={() => setNamingOpen(true)}
          aria-label={t('username.rename.title')}>
          <EditIcon size={16} />
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
      {/* dishi.username. Unclaimed at v1+ = the naming moment, offered once the
          person has actually built something to name; claimed = the identity
          itself, in the SAME big/black type as the unclaimed preview (no pill,
          no button chrome — it's a settled label now, not a CTA). The rename
          entry point moved to the pencil icon pinned to the card's corner, since
          the label itself no longer looks tappable. Below v1 there is nothing to
          name yet, so this renders nothing at all. */}
      {identity && state.version.v >= 1 && (
        <div className="version-line" style={{ marginTop: 10 }}>
          {identity.claimed ? (
            <span className="username-identity" ref={identityRef}>dishi.{identity.username}</span>
          ) : (
            /* Unclaimed reads as a PREVIEW of the claimed line, sized like a persona
               name (.persona-name's own type) rather than a small CTA button: the
               literal "dishi." followed by the SAME field the person types the rest
               into — this one is real and live, not a trigger that hands off to a
               modal. First focus opens a plain, informational ExplainModal (the
               one-change warning) with no field of its own; the person keeps typing
               HERE once it's dismissed. Status rides on a circle at the field's own
               right edge instead of a text line below it — spinner while checking,
               red ✕ if it can't be used, green ✓ once it can. The ✓ IS the confirm
               action (tap it, or Enter — same claimSave either way). */
            <span className="username-claim">
              <span className="username-claim-prefix">dishi.</span>
              <span className="username-claim-fieldwrap">
                <input
                  ref={claimInputRef}
                  className="field username-claim-field"
                  maxLength={20}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-label={t('username.field.label')}
                  placeholder={t('username.placeholder')}
                  value={claimValue}
                  disabled={claimSaving}
                  onChange={e => setClaimValue(e.target.value)}
                  onFocus={() => { if (!claimExplainSeen) setClaimExplainOpen(true); }}
                  onKeyDown={e => { if (e.key === 'Enter') claimSave(); }}
                />
                {claimStatus.kind === 'checking' && (
                  <span className="username-claim-status checking" aria-label={t('username.checking')}>
                    <span className="username-claim-spinner" />
                  </span>
                )}
                {claimStatus.kind === 'ok' && (
                  <button type="button" className="username-claim-status ok"
                    disabled={claimSaving} onClick={claimSave} aria-label={t('username.save')}>
                    <CheckIcon size={13} />
                  </button>
                )}
                {claimStatus.kind === 'err' && (
                  <span className="username-claim-status err" aria-label={t(`username.err.${claimStatus.code}`)}>
                    <CloseIcon size={13} />
                  </span>
                )}
              </span>
            </span>
          )}
        </div>
      )}

      <div className="version-line" style={{ marginTop: 6 }}>
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
      /* ── State B: the install surface (taste-only export, decision 5). Version
         line, bar and stat boxes are hidden; the blob stays. The slot the persona
         carousel occupied now shows the identity being installed — the container
         name the person will type into their host — so naming your taste AI and
         installing it read as one chain, not two features. */
      <div className="persona-pick">
        {/* The identity is FIXED above the swipe — it does not move with the
            panels. It is the same palate either way; what changes is only who
            receives it, so re-labelling this line per panel would have implied
            the thing itself changed. */}
        <div className="persona-slide">
          <div className="persona-name">{containerName}</div>
        </div>

        {/* TWO panels, one surface: the same palate going to an AI (left) or
            to a person (right). Native scroll-snap — see .persona-swipe. */}
        <div className="persona-swipe" ref={swipeRef}
          onScroll={e => {
            const el = e.currentTarget;
            setPanel(el.clientWidth > 0 ? Math.round(el.scrollLeft / el.clientWidth) : 0);
          }}>
          <div className="persona-panel">
            <div className="persona-slide">
              <p className="persona-blurb">{t('export.install.blurb')}</p>
            </div>
            {personaDivider}
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

          <div className="persona-panel">
            <div className="persona-slide">
              <p className="persona-blurb">{t('export.share.blurb')}</p>
            </div>
            {personaDivider}
            {/* Gated on a CLAIMED username: legacy email-derived handles 404 by
                design, so there is genuinely no page to send. The claim field
                is on this same card, a few lines up — hence a note pointing at
                it rather than a dead button. */}
            {identity?.claimed ? (
              <div style={{ display: 'grid', justifyItems: 'center', gap: 8 }}>
                {/* ONE button, four illustrative marks — never four buttons
                    (see lib/messengers.ts). The marks ARE the label: four
                    messenger logos say "this goes to a person on a messenger"
                    faster and in every language, which is why the row carries
                    no text. Its accessible name comes from aria-label. */}
                <button type="button" className="msg-share-row"
                  onClick={shareProfile} aria-label={t('export.share.messengers')}>
                  <span className="msg-logos">
                    {MESSENGER_MARKS.map(m => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={m.id} src={m.logo} alt="" width={26} height={26} />
                    ))}
                  </span>
                </button>
                {shareCopied && <p className="card-meta">{t('export.share.copied')}</p>}
              </div>
            ) : (
              <p className="msg-share-note">{t('export.share.needname')}</p>
            )}
          </div>
        </div>

        <div className="persona-dots">
          {[t('export.swipe.ai'), t('export.swipe.person')].map((label, i) => (
            <button key={label} type="button"
              className={`persona-dot${panel === i ? ' on' : ''}`}
              aria-label={label} aria-current={panel === i}
              onClick={() => swipeRef.current?.scrollTo({ left: i * swipeRef.current.clientWidth, behavior: 'smooth' })} />
          ))}
        </div>
      </div>
      )}
    </div>

    {/* State A's resting CTA card — logos + the vermillion 植入 button (one of
        vermillion's two sanctioned uses). Tapping it morphs the card above into
        the install surface; below the unlock gate it stays an honest countdown. */}
    {!expanded && (
      <div className="ai-export-card">
        <div className="ai-logo-row">
          {INSTALL_HOSTS.map(h => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={h.id} src={h.logo} alt={h.label} width={32} height={32} />
          ))}
        </div>
        {ready ? (<>
          <button className="btn export" style={{ width: '100%' }} onClick={openExpand}>
            {t('export.button', { v: Math.max(1, state.version.v) })}
          </button>
          {/* "What's new in v{N}" — recurring and read-only (§5 + the
              versioning-deltas open thread). From the second export on: the dims
              that moved since the last send, or an honest 變化不大; plus any new
              table companions the palate now knows about. */}
          {preview && !preview.is_first_export && (
            <p className="card-meta" style={{ marginTop: 10, textAlign: 'center' }}>
              {preview.delta.length > 0
                ? t('export.delta', {
                    v: preview.profile_version,
                    dims: preview.delta.map(x => `${t(`dim.${x.dim}`)} ${x.dir > 0 ? '↑' : '↓'}`).join(' · '),
                  })
                : t('export.version', { v: preview.profile_version })}
            </p>
          )}
          {preview && !preview.is_first_export && (preview.new_companions ?? []).length > 0 && (
            <p className="card-meta" style={{ marginTop: 4, textAlign: 'center' }}>
              {t('export.delta.companions', { names: preview.new_companions.join('、') })}
            </p>
          )}
        </>) : (<>
          {/* Locked (§1/§5): anticipation register, the honest count left, and
              the 相簿舊菜 fast track — deliberately NO dead disabled button. */}
          <p className="export-antic">{t('export.antic', { n: ratingsToUnlock(ci) })}</p>
          {onAlbumPath && (
            <button type="button" className="btn ghost small" style={{ marginTop: 10 }} onClick={onAlbumPath}>
              {t('export.antic.album')}
            </button>
          )}
        </>)}
      </div>
    )}

    {/* The install layer — the SAME centered layer as every ⓘ explainer (shared
        ExplainModal), with the bottom circle repurposed as the copy action: one
        tap generates the doc in the selected voice, copies it, and persists the
        persona (the POST inside copyDoc is the real export event). Scrim tap
        dismisses back to State B with the carousel where it was. */}
    {installHost && (
      <ExplainModal
        title={
          <span className="install-title-row">
            {containerName}
            <span className="install-title-arrow" aria-hidden>→</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={installHost.logo} alt="" width={22} height={22} />
          </span>
        }
        ariaLabel={`${t('install.title', { name: containerName })} → ${installHost.label}`}
        onClose={() => { setInstallHost(null); setCopied(false); }}
        // Instructions match .explain-modal-body's typography exactly, but live in
        // `extra` as real rows (not one joined pre-line string) so a step that
        // wraps to a second line hangs under its own text, not the circled number.
        extra={
          <div className="install-steps">
            {(lang === 'zh' ? installHost.zh : installHost.en)(containerName).map((s, i) => {
              const bold = (lang === 'zh' ? installHost.boldZh : installHost.boldEn)?.(containerName)[i] ?? [];
              return (
                <div className="install-step" key={i}>
                  <span className="install-step-num" aria-hidden>{'①②③④⑤'[i] ?? `${i + 1}.`}</span>
                  <span className="install-step-text">
                    {splitBoldKeywords(s, bold).map((seg, si) => seg.bold
                      ? <b key={si}>{seg.text}</b>
                      : <span key={si}>{seg.text}</span>)}
                  </span>
                </div>
              );
            })}
          </div>
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

    {namingOpen && identity && (
      <UsernameSheet
        current={identity.username}
        changesLeft={identity.changesLeft}
        onClose={() => setNamingOpen(false)}
        onSaved={(username, changesLeft) => setIdentity({ username, claimed: true, changesLeft })}
      />
    )}

    {/* First-focus explainer for the inline claim pill — plain and informational,
        no field of its own (typing happens in the pill under the blob, not here):
        just the title/blurb/warning and the shared default ok-circle to dismiss. */}
    {claimExplainOpen && (
      <ExplainModal
        title={t('username.title')}
        body={t('username.blurb')}
        extra={<p className="explain-modal-body" style={{ fontWeight: 600 }}>{t('username.warn')}</p>}
        onClose={() => {
          setClaimExplainOpen(false); setClaimExplainSeen(true);
          claimInputRef.current?.focus();
        }}
      />
    )}
    </>
  );
}
