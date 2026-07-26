'use client';
// dishi.username — the naming moment at v1, and the one rename that follows it.
//
// One component for both because they are the same form with a different frame:
// the claim leads with the milestone ("you built dishi v1"), the rename leads
// with what it costs ("one change left, then it's permanent"). Splitting them
// would duplicate the availability check, which is the only real logic here.
//
// Mounts inside the shared ExplainModal rather than a lookalike sheet — same
// scrim, same paper card, same dismissal as every other explainer in the app.
// Styling is existing classes only (.field, .btn, .label): no new CSS, because
// the design system is the owner's to change.
import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';
import ExplainModal from './ExplainModal';
import { normalizeUsername, validateUsername } from '@/lib/username';

type Status =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ok' }
  | { kind: 'err'; code: ErrCode };

/** Every code here has a `username.err.*` key. Anything else the server can
 *  return (a 401 body, an unexpected shape) must NOT reach t() — it would look
 *  up a key that doesn't exist and render the raw string at the person. */
const ERR_CODES = [
  'empty', 'tooshort', 'toolong', 'shape', 'reserved', 'taken', 'nochangesleft', 'failed',
] as const;
type ErrCode = typeof ERR_CODES[number];
const asErrCode = (v: unknown): ErrCode =>
  (ERR_CODES as readonly string[]).includes(v as string) ? (v as ErrCode) : 'failed';

export default function UsernameSheet({ current, claimed, changesLeft, onClose, onSaved }: {
  /** The name in profiles.handle today — auto-derived from the email until claimed. */
  current: string | null;
  claimed: boolean;
  changesLeft: number;
  onClose: () => void;
  onSaved: (username: string, changesLeft: number) => void;
}) {
  const { t } = useLang();
  // A never-claimed handle is an email local part the person never chose, so the
  // field starts EMPTY for a claim — prefilling it would quietly bless a name
  // that leaks their address. A rename starts from what they actually picked.
  const [value, setValue] = useState(claimed ? (current ?? '') : '');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [saving, setSaving] = useState(false);
  const seq = useRef(0);

  const trimmed = normalizeUsername(value);
  const unchanged = claimed && trimmed === normalizeUsername(current ?? '');
  const spent = claimed && changesLeft <= 0;

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
        setStatus(json.available ? { kind: 'ok' } : { kind: 'err', code: asErrCode(json.error ?? 'taken') });
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
      if (!res.ok) { setStatus({ kind: 'err', code: asErrCode(json.error) }); return; }
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
    : ' '; // reserve the line so the card doesn't jump as the verdict lands

  return (
    <ExplainModal
      title={claimed ? t('username.rename.title') : t('username.title')}
      body={claimed
        ? (spent ? t('username.rename.none') : t('username.rename.last'))
        : t('username.blurb')}
      extra={
        <>
          {/* The warning sits ABOVE the field on the claim: it is the reason the
              one-change rule is fair, so it must be read before the typing starts. */}
          {!claimed && (
            <p className="explain-modal-body" style={{ fontWeight: 600 }}>{t('username.warn')}</p>
          )}
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
          {!claimed && (
            <button type="button" className="btn ghost large" onClick={onClose}>
              {t('username.later')}
            </button>
          )}
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
