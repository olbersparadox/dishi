'use client';
// The public dossier's render half (decision 3). Server page resolves + projects;
// this renders — REUSING the taste card's own pieces (TasteFormReveal blob,
// .persona-name identity type, .version-line, .chip rows, .ok-circle copy
// action), never lookalikes: a visitor should see the same object the owner
// sees on their taste tab, because it IS the same taste.
//
// The copy circle emits buildDossierText — third-person reference for the
// visitor's own AI (decision 3: "one artifact, two readers"). It is NOT the
// palate export: no POST, no export event, no delta baseline — nothing about
// the OWNER moves when a visitor copies their dossier.
import { useState } from 'react';
import { TasteFormReveal } from './TasteForm';
import { useLang, cuisineLabel } from '@/lib/i18n';
import { buildDossierText, type PublicDossier as Dossier } from '@/lib/dossier';
import { CopyIcon, CheckIcon } from './icons';

export default function PublicDossier({ dossier, isOwner }: { dossier: Dossier; isOwner: boolean }) {
  const { t, lang } = useLang();
  const [copied, setCopied] = useState(false);
  const [hide, setHide] = useState(dossier.hideRestaurants);
  const [saving, setSaving] = useState(false);

  const d = dossier;
  const label = (k: string) => t(`dim.${k}`);
  const cuisine = (k: string) => cuisineLabel(k, lang) || k;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(buildDossierText(d, label, cuisine));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard can be blocked; no fake feedback */ }
  };

  // The one owner control (decision 3): hide restaurant names, accepting a
  // weaker page. Optimistic; reverts on failure.
  const toggleHide = async () => {
    if (saving) return;
    const next = !hide;
    setHide(next);
    setSaving(true);
    try {
      const res = await fetch('/api/dossier', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hide_restaurants: next }),
      });
      if (!res.ok) setHide(!next);
    } catch {
      setHide(!next);
    } finally {
      setSaving(false);
    }
  };

  // A live toggle by the owner should be reflected immediately — the server
  // already stripped restaurants when the stored flag was on, so this only
  // ever needs to hide, never to reveal (a projection with hideRestaurants
  // true carries no restaurant strings to reveal).
  const anchors = d.anchors.map(a => ({ ...a, restaurant: hide ? null : a.restaurant }));

  return (
    <div>
      <div className="card"><div className="card-body" style={{ textAlign: 'center' }}>
        <TasteFormReveal
          inputs={{ vector: d.vector, evidence: d.evidence, ratingCount: d.ratingCount, seed: `${d.username}:v${d.version}` }}
          size={190}
          vector={d.vector}
          labelFor={label}
        />
        <div className="version-line" style={{ marginTop: 10, justifyContent: 'center' }}>
          <span className="username-claim-prefix">dishi.{d.username}</span>
        </div>
        <div className="version-line" style={{ marginTop: 6, justifyContent: 'center' }}>
          <span className="version-now">V{d.version}</span>
          <span className="card-meta">{t('buddy.knows.count', { n: d.knowsCount })}</span>
          <span className="card-meta">{t('dossier.fed', { n: d.ratingCount })}</span>
        </div>

        {(d.strongLoves.length > 0 || d.loves.length > 0) && (
          <div style={{ marginTop: 16 }}>
            <p className="label">{t('dossier.loves')}</p>
            <div className="explain-modal-chips" style={{ justifyContent: 'center' }}>
              {d.loves.slice(0, 6).map(k => (
                <span className={`chip ${d.strongLoves.includes(k) ? 'on' : ''}`} key={k}>{label(k)}</span>
              ))}
            </div>
          </div>
        )}
        {d.avoids.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <p className="label">{t('dossier.avoids')}</p>
            <div className="explain-modal-chips" style={{ justifyContent: 'center' }}>
              {d.avoids.slice(0, 4).map(k => <span className="chip" key={k}>{label(k)}</span>)}
            </div>
          </div>
        )}
        {d.cuisines.length > 0 && (
          <p className="card-meta" style={{ marginTop: 12 }}>
            {t('dossier.cuisines', { list: d.cuisines.map(cuisine).join('、') })}
          </p>
        )}
      </div></div>

      {anchors.length > 0 && (
        <div className="card" style={{ marginTop: 14 }}><div className="card-body">
          <p className="label">{t('dossier.anchors')}</p>
          {anchors.map((a, i) => {
            const name = lang === 'zh'
              ? [a.name_zh, a.name].filter(Boolean).join(' / ')
              : [a.name, a.name_zh].filter(Boolean).join(' / ');
            return (
              <p key={i} style={{ margin: '6px 0' }}>
                {name}
                {a.restaurant && <span className="card-meta">　@ {a.restaurant}</span>}
              </p>
            );
          })}
          {isOwner && (
            <label className="card-meta" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={hide} disabled={saving} onChange={toggleHide} />
              {t('dossier.hide.restaurants')}
            </label>
          )}
        </div></div>
      )}

      {/* One artifact, two readers: the visitor hands this to THEIR AI. Explicitly
          reference-only — hard rule 1 lives in the emitted text itself. */}
      <div className="card" style={{ marginTop: 14 }}><div className="card-body" style={{ textAlign: 'center' }}>
        <p className="card-meta">{t('dossier.copy.blurb', { name: `dishi.${d.username}` })}</p>
        <div className="install-copy-wrap" style={{ marginTop: 10 }}>
          <button className="ok-circle" onClick={copy} aria-label={t('dossier.copy')}>
            {copied ? <CheckIcon size={26} /> : <CopyIcon size={24} />}
          </button>
          {copied && <p className="card-meta">{t('copied.short')}</p>}
        </div>
      </div></div>

      {/* The acquisition line the page exists to serve — quiet, not a wall. */}
      {!isOwner && (
        <p className="card-meta" style={{ textAlign: 'center', margin: '18px 0' }}>
          <a href="/" style={{ color: 'var(--ink)' }}>{t('dossier.cta')}</a>
        </p>
      )}
    </div>
  );
}
