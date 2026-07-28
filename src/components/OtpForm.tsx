'use client';
// The email -> numeric-code form itself, extracted from AuthGate (sharing
// batch item 5) so a second surface can sign someone in WITHOUT a second
// implementation of the OTP dance: the front-door gate wraps this in a full
// screen, and SignInSheet wraps it in a modal over whatever the person was
// already looking at.
//
// Why code, not a magic link: on phones, tapping the email link opens whatever
// browser the mail app chooses (Gmail webview, default Safari), so the session
// lands in a DIFFERENT browser than where the person started — they appear
// "signed out" when they return. A code typed back into the ORIGINAL browser
// creates the session in the right place, every time. The email template leads
// with {{ .Token }} and carries no link at all (docs/specs/otp-login-email-
// template.md); the input declares autoComplete="one-time-code" so iOS surfaces
// the code from Apple Mail as a tappable chip above the keyboard.
//
// The email address is remembered on-device so returning users never retype it.
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useLang } from '@/lib/i18n';
import { ArrowRightIcon } from '@/components/icons';

export const EMAIL_KEY = 'dishi-email';

export default function OtpForm({ onVerified }: {
  /** Fired when THIS form's own verify succeeded. Callers that need to resume
   * an action must use this rather than listening to onAuthStateChange:
   * GoTrue emits SIGNED_IN for a session that ALREADY exists, so a global
   * listener cannot tell "just signed in" from "was signed in" and will
   * re-fire the moment it mounts (measured: a resumed bookmark looping into a
   * second POST per tap). AuthGate still listens globally, correctly — it
   * cares about session presence, not about a transition. */
  onVerified?: () => void;
} = {}) {
  const { t } = useLang();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(EMAIL_KEY);
      if (saved) setEmail(saved);
    } catch { /* fine */ }
  }, []);

  async function sendCode() {
    setError('');
    try { localStorage.setItem(EMAIL_KEY, email); } catch { /* fine */ }
    // No emailRedirectTo: the template carries no magic link, so there's no
    // redirect target — this is pure OTP. {{ .Token }} is delivered regardless.
    const { error: err } = await supabaseBrowser().auth.signInWithOtp({ email });
    if (err) { setError(err.message); return; }
    setSent(true);
  }

  async function verifyCode() {
    setVerifying(true); setError('');
    const { error: err } = await supabaseBrowser().auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    setVerifying(false);
    if (err) { setError(t('auth.codefail')); return; }
    // AuthGate's own gate still opens via onAuthStateChange; anything RESUMING
    // a specific action is told here instead, for the reason on onVerified.
    onVerified?.();
  }

  return (
    <>
      {!sent ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="field" type="email" placeholder={t('auth.placeholder')}
            value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
          <button className="join-go" aria-label={t('auth.send')} title={t('auth.send')}
            onClick={sendCode} disabled={!email.includes('@')}>
            <ArrowRightIcon size={20} />
          </button>
        </div>
      ) : (
        <>
          <p style={{ marginBottom: 2 }}>{t('auth.sent')}</p>
          <p className="card-meta" style={{ marginBottom: 8 }}>{t('auth.codehint')}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 15 }}>
            {/* No hardcoded digit count even though the Supabase OTP length is
                set to 6: capping the input once truncated real codes when the
                length turned out longer than assumed, so we accept whatever's
                typed and let verifyOtp reject a genuinely wrong code rather
                than the box pre-rejecting a right one. */}
            <input className="field code-input" inputMode="numeric" autoComplete="one-time-code"
              placeholder={t('auth.codeplaceholder')}
              value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} />
            <button className="join-go" aria-label={t('auth.verify')} title={t('auth.verify')}
              onClick={verifyCode} disabled={code.trim().length === 0 || verifying}>
              <ArrowRightIcon size={20} />
            </button>
          </div>
          <button className="btn ghost small" style={{ marginTop: 10 }} onClick={() => { setSent(false); setCode(''); }}>
            {t('auth.resend')}
          </button>
        </>
      )}
      {error && <p style={{ color: 'var(--lacquer)', marginTop: 10 }}>{error}</p>}
    </>
  );
}
