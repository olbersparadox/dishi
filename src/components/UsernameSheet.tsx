'use client';
// dishi.username — the RENAME sheet (the one change after the initial claim).
//
// The claim itself (v1, unclaimed) no longer opens this: it types straight into
// an inline pill under the taste blob (TasteFormCard), with its own copy of this
// same debounced-check/save logic — the two diverged enough (the claim has no
// `current`/`unchanged`/`spent` to track) that sharing one component meant
// threading claim-only conditionals through a rename-shaped form. The validation
// vocabulary (USERNAME_ERR_CODES et al.) stays shared via lib/username.ts so the
// two can't drift on what counts as a valid name or a recognized error.
//
// Mounts inside the shared ExplainModal rather than a lookalike sheet — same
// scrim, same paper card, same dismissal as every other explainer in the app.
// Styling is existing classes only (.field, .btn, .label): no new CSS, because
// the design system is the owner's to change.
import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';
import ExplainModal from './ExplainModal';
import {
  normalizeUsername, validateUsername, asUsernameErrCode, type UsernameErrCode,
} from '@/lib/username';

type Status =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ok' }
  | { kind: 'err'; code: UsernameErrCode };

export default function UsernameSheet({ current, changesLeft, onClose, onSaved }: {
  /** The name in profiles.handle today. */
  current: string | null;
  changesLeft: number;
  onClose: () => void;
  onSaved: (username: string, changesLeft: number) => void;
}) {
  const { t } = useLang();
  // A rename starts from what the person actually picked — never derived/blank.
  const [value, setValue] = useState(current ?? '');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [saving, setSaving] = useState(false);
  const seq = useRef(0);

  const trimmed = normalizeUsername(value);
  const unchanged = trimmed === normalizeUsername(current ?? '');
  const spent = changesLeft <= 0;

  // Debounced availability check. Every response carries its own sequence number
  // so a slow early check can't overwrite the verdict for what's in the box now.
  useEffect(() => {
    if (spent || !trimmed || unchanged) { setStatus({ kind: 'idle' }); return; }
    const local = validateUsername(trimmed);
    if (local) { setStatus({ kind: 'err', code: local }); return; }
    setStatus({ kind: 'checking' });
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/username?check=${encodeURIComponent(trimmed)}`);
        const json = await res.json();
        if (mine !== seq.current) return;
        if (!res.ok) { setStatus({ kind: 'err', code: 'failed' }); return; }
        setStatus(json.available ? { kind: 'ok' } : { kind: 'err', code: asUsernameErrCode(json.error ?? 'taken') });
      } catch {
        if (mine === seq.current) setStatus({ kind: 'idle' });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [trimmed, spent, unchanged]);

  const save = async () => {
    if (saving || status.kind !== 'ok') return;
    setSaving(true);
    try {
      const res = await fetch('/api/username', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) { setStatus({ kind: 'err', code: asUsernameErrCode(json.error) }); return; }
      onSaved(json.username, json.changesLeft);
      onClose();
    } catch {
      setStatus({ kind: 'err', code: 'failed' });
    } finally {
      setSaving(false);
    }
  };

  const note = status.kind === 'checking' ? t('username.checking')
    : status.kind === 'ok' ? t('username.available')
    : status.kind === 'err' ? t(`username.err.${status.code}`)
    : ' '; // reserve the line so the card doesn't jump as the verdict lands

  return (
    <ExplainModal
      title={t('username.rename.title')}
      body={spent ? t('username.rename.none') : t('username.rename.last')}
      extra={
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <span style={{ fontWeight: 700, flexShrink: 0 }}>dishi.</span>
            <input
              className="field"
              autoFocus={!spent}
              disabled={spent || saving}
              maxLength={20}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder={t('username.placeholder')}
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save(); }}
            />
          </div>
          <p className="label" style={{ margin: '8px 0 0', minHeight: '1.2em' }}>{note}</p>
        </>
      }
      footer={
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button type="button"
            className={`btn primary large${status.kind === 'ok' ? ' dirty' : ''}`}
            disabled={spent || saving || status.kind !== 'ok'}
            onClick={save}>
            {t('username.save')}
          </button>
        </div>
      }
      onClose={onClose}
    />
  );
}
