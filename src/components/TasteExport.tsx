'use client';
import { useState } from 'react';
import { useLang, cuisineLabel } from '@/lib/i18n';
import {
  extractTasteSections, buildTastePrompt, type ExportDish, type ExportCompanions,
  confidenceInputsFrom, evidenceConfidence, exportUnlocked, ratingsToUnlock,
  INSTALL_HOSTS,
} from '@/lib/tasteExport';
import { VOICES, type Persona } from '@/lib/persona';
import { CopyIcon, CheckIcon, LockIcon } from './icons';

/**
 * "Teach your AI what you actually like."
 *
 * The pitch, and the reason this sits INSIDE the Buddy card rather than in a quiet
 * card of its own at the bottom of the page: this is the payoff for training Dishi.
 * Rating dishes stops being a chore you do for an app and becomes the thing that
 * makes the AI you already use every day genuinely know your taste. That's the loop
 * worth putting front and centre — and it's the strongest reason to keep rating.
 *
 * Disabled below the unlock gate on purpose. Exporting a profile built on a handful
 * of ratings would hand someone's AI a confident-sounding document with nothing
 * behind it — the exact opposite of the point, and a fast way to make the whole
 * idea feel fake. The button says how many more ratings it needs instead.
 *
 * The gate is now the shared 'emerging' engine-confidence boundary (spec §1),
 * NOT a local rating count — so the button, the buddy bar, and the export's own
 * honesty note all unlock at the same moment. (The full locked-state redesign —
 * anticipation copy + album-path link — is the separate §5 UI slice.)
 */
export default function TasteExport({
  vector, affinity, count, dishes, persona, name, version: dishiVersion = 1,
}: {
  vector: Record<string, number>;
  affinity: Record<string, number>;
  count: number;
  dishes: ExportDish[];
  /** Voice the export renders in. The in-card picker is REMOVED for now (backlog:
   * personas need a real interaction design — likely only "alive" inside the
   * user's AI post-export); stored choices still apply, new users get 'honest'. */
  persona: Persona;
  name: string | null;
  /** The ratcheted dishi version (from /api/buddy via TasteFormCard) — the number the
   * CTA names and the export stamps. Same ladder as the bar above; see version.ts. */
  version?: number;
}) {
  const { t, lang } = useLang();
  const [prompt, setPrompt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [delta, setDelta] = useState<{ dim: string; dir: 1 | -1 }[]>([]);
  const [newCompanions, setNewCompanions] = useState<string[]>([]);
  const [version, setVersion] = useState<number | null>(null);
  const [isFirstExport, setIsFirstExport] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Install-first, taster-second (dishi.Persona install flow). Phase 0 R&D showed a
  // pasted persona is gone by the next conversation on every host — the named
  // container (Gem / Project / GPT) is what makes the character persist. So the
  // card LEADS with container-install instructions; plain paste survives only as a
  // clearly-labelled one-conversation taster that upsells the install at the end.
  const [mode, setMode] = useState<'install' | 'taster'>('install');
  const voiceName = VOICES[persona].displayName;

  const ci = confidenceInputsFrom(vector, affinity, count);
  const ready = exportUnlocked(evidenceConfidence(ci));

  async function generate() {
    setGenerating(true);
    let exportVersion: number | undefined;
    // 同檯 companions (Table Mode item 4): server-aggregated from real edges,
    // display names only — the client never even receives handles/ids here.
    let companions: ExportCompanions | undefined;
    try {
      // Commit the chosen voice on export (persisted server-side) and get the version.
      const res = await fetch('/api/taste/export', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setDelta(json.delta ?? []);
        setNewCompanions(json.new_companions ?? []);
        setVersion(json.profile_version ?? null);
        setIsFirstExport(!!json.is_first_export);
        exportVersion = json.profile_version ?? undefined;
        companions = json.companions ?? undefined;
      }
    } catch { /* version/delta are a bonus on top of the prompt, not required for it */ }
    const sections = extractTasteSections(
      { vector, affinity, ratingCount: count, dishes },
      dim => t(`dim.${dim}`),
      c => cuisineLabel(c, lang),
    );
    // English-only, deliberately: this text is read by a MODEL, not by the person.
    // Rendered in the chosen persona voice, with the versioned header.
    setPrompt(buildTastePrompt(sections, { persona, version: exportVersion, name, companions }));
    setCopied(false);
    setMode('install'); // every fresh generation leads with the install path again
    setGenerating(false);
  }

  async function copy() {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* Clipboard can be blocked or unavailable. The textarea is right there and
         selectable, so this degrades to "select it yourself" rather than an error. */
    }
  }

  return (
    <div className="ai-export-card">
      <div className="ai-logo-row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ai-logos/logo-claude.webp" alt="Claude" width={32} height={32} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ai-logos/logo-gemini.png" alt="Gemini" width={32} height={32} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ai-logos/logo-grok.webp" alt="Grok" width={32} height={32} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ai-logos/logo-chatgpt.webp" alt="ChatGPT" width={32} height={32} />
      </div>

      {!prompt ? (
        <>
          <button className={`btn export ${!ready ? 'is-locked' : ''}`} style={{ width: '100%' }} onClick={generate} disabled={!ready || generating}>
            {ready
              ? t('export.button', { v: Math.max(1, dishiVersion) })
              : <><LockIcon size={16} /> {t('export.locked', { n: ratingsToUnlock(ci) })}</>}
          </button>
        </>
      ) : (
        <>
          <p className="taste-export-note" style={{ marginTop: 4 }}>
            {!isFirstExport && version && delta.length > 0
              ? t('export.delta', {
                  v: version,
                  dims: delta.map(x => `${t(`dim.${x.dim}`)} ${x.dir > 0 ? '↑' : '↓'}`).join(' · '),
                })
              : !isFirstExport && version
                ? t('export.version', { v: version })
                : null}
          </p>
          {/* New table companions since the last export — a legitimate delta line
              of its own (Table Mode item 4): the palate genuinely knows MORE now,
              and part of what it knows is who you've been eating with. */}
          {!isFirstExport && newCompanions.length > 0 && (
            <p className="taste-export-note">
              {t('export.delta.companions', { names: newCompanions.join('、') })}
            </p>
          )}
          {mode === 'install' ? (
            <>
              <p className="taste-export-note">{t('export.install.lead', { name: voiceName })}</p>
              {/* Per-host walkthroughs come from the INSTALL_HOSTS table (tasteExport.ts)
                  so a host-UI change is a one-row edit there, never a component edit. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '8px 0 2px' }}>
                {INSTALL_HOSTS.map(h => (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={h.logo} alt={h.alt} width={16} height={16} style={{ flex: 'none', marginTop: 2, objectFit: 'contain' }} />
                    <span className="taste-export-note" style={{ marginTop: 0 }}>
                      {(lang === 'zh' ? h.zh : h.en)(voiceName)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="taste-export-note">{t('export.taster.lead', { name: voiceName })}</p>
          )}
          <textarea
            className="field taste-export-text" readOnly value={prompt}
            onFocus={e => e.currentTarget.select()}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={copy}>
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? t('copied.short') : t('export.copy')}
            </button>
            <button className="btn ghost" onClick={() => setPrompt(null)}>{t('home.cancel')}</button>
          </div>
          {mode === 'install' ? (
            <button
              className="btn ghost" style={{ width: '100%', marginTop: 8 }}
              onClick={() => setMode('taster')}
            >
              {t('export.install.taster', { name: voiceName })}
            </button>
          ) : (
            <>
              <p className="taste-export-note">{t('export.taster.upsell', { name: voiceName })}</p>
              <button
                className="btn ghost" style={{ width: '100%', marginTop: 8 }}
                onClick={() => setMode('install')}
              >
                {t('export.taster.install')}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
