'use client';
import { useState } from 'react';
import { useLang, cuisineLabel } from '@/lib/i18n';
import { extractTasteSections, buildTastePrompt, type ExportDish } from '@/lib/tasteExport';
import { CopyIcon, CheckIcon } from './icons';

/**
 * "Teach your AI what you actually like."
 *
 * The pitch, and the reason this sits INSIDE the Buddy card rather than in a quiet
 * card of its own at the bottom of the page: this is the payoff for training Dishi.
 * Rating dishes stops being a chore you do for an app and becomes the thing that
 * makes the AI you already use every day genuinely know your taste. That's the loop
 * worth putting front and centre — and it's the strongest reason to keep rating.
 *
 * Disabled below the training gate on purpose. Exporting a profile built on two
 * ratings would hand someone's AI a confident-sounding document with nothing behind
 * it — the exact opposite of the point, and a fast way to make the whole idea feel
 * fake. The button says how many more ratings it needs instead.
 */
const EXPORT_GATE = 5;

export default function TasteExport({
  vector, affinity, count, dishes,
}: {
  vector: Record<string, number>;
  affinity: Record<string, number>;
  count: number;
  dishes: ExportDish[];
}) {
  const { t, lang } = useLang();
  const [prompt, setPrompt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [delta, setDelta] = useState<{ dim: string; dir: 1 | -1 }[]>([]);
  const [version, setVersion] = useState<number | null>(null);
  const [isFirstExport, setIsFirstExport] = useState(true);
  const [generating, setGenerating] = useState(false);

  const ready = count >= EXPORT_GATE;

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch('/api/taste/export', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setDelta(json.delta ?? []);
        setVersion(json.profile_version ?? null);
        setIsFirstExport(!!json.is_first_export);
      }
    } catch { /* version/delta are a bonus on top of the prompt, not required for it */ }
    const sections = extractTasteSections(
      { vector, affinity, ratingCount: count, dishes },
      dim => t(`dim.${dim}`),
      c => cuisineLabel(c, lang),
    );
    // English-only, deliberately: this text is read by a MODEL, not by the person.
    setPrompt(buildTastePrompt(sections));
    setCopied(false);
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
        <button className="btn export" style={{ width: '100%' }} onClick={generate} disabled={!ready || generating}>
          {ready ? t('export.button') : t('export.locked', { n: EXPORT_GATE - count })}
        </button>
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
          <p className="taste-export-note">{t('export.paste')}</p>
        </>
      )}
    </div>
  );
}
