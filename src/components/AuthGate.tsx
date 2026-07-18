'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useLang } from '@/lib/i18n';
import { ArrowRightIcon } from '@/components/icons';

const EMAIL_KEY = 'dishi-email';

/**
 * Numeric-code (OTP) email auth.
 *
 * Why code, not a magic link: on phones, tapping the email link opens whatever
 * browser the mail app chooses (Gmail webview, default Safari), so the session
 * lands in a DIFFERENT browser than where the person started — they appear
 * "signed out" when they return. A code typed back into the ORIGINAL browser
 * creates the session in the right place, every time. The email template leads
 * with {{ .Token }} and no longer carries a link at all (see
 * docs/specs/otp-login-email-template.md); the input declares
 * autoComplete="one-time-code" so iOS surfaces the code from Apple Mail as a
 * tappable chip above the keyboard.
 *
 * The email address is remembered on-device so returning users never retype it.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { t } = useLang();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
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

    const supabase = supabaseBrowser();
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      setReady(true);
      if (data.session?.user) ensureProfile(supabase, data.session.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session);
      if (session?.user) ensureProfile(supabase, session.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function sendCode() {
    setError('');
    try { localStorage.setItem(EMAIL_KEY, email); } catch { /* fine */ }
    const supabase = supabaseBrowser();
    // No emailRedirectTo: the template carries no magic link, so there's no
    // redirect target — this is pure OTP. {{ .Token }} is delivered regardless.
    const { error: err } = await supabase.auth.signInWithOtp({ email });
    if (err) { setError(err.message); return; }
    setSent(true);
  }

  async function verifyCode() {
    setVerifying(true); setError('');
    const supabase = supabaseBrowser();
    const { error: err } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    setVerifying(false);
    if (err) setError(t('auth.codefail'));
    // success flows through onAuthStateChange
  }

  if (!ready) return <p className="card-meta">{t('auth.loading')}</p>;
  if (signedIn) return <>{children}</>;

  return (
    <div className="auth-screen" style={{ marginTop: 'calc(62.5vh - 418px)' }}>
      <div className="wordmark auth-wordmark">dish<em>i</em></div>
      <p className="tagline auth-tagline">{t('auth.tagline')}</p>
      <p className="card-meta auth-longcopy">{t('auth.longcopy')}</p>
      <h2 className="auth-title" style={{ marginTop: 44, marginBottom: 12 }}>{t('auth.title')}</h2>

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
            {/* autoComplete="one-time-code" is what makes iOS offer the code from
                Apple Mail as a chip above the keyboard — the whole point of the OTP
                path. Still no hardcoded digit count even though the Supabase OTP
                length is set to 6: capping the input once truncated real codes when
                the length turned out longer than assumed, so we accept whatever's
                typed and let verifyOtp reject a genuinely wrong code rather than the
                box pre-rejecting a right one. */}
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
    </div>
  );
}

/** Create the profile row if missing, with collision-safe handles. */
async function ensureProfile(supabase: ReturnType<typeof supabaseBrowser>, user: { id: string; email?: string }) {
  const { data: existing } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
  if (existing) return;

  const base = (user.email?.split('@')[0] ?? 'diner').slice(0, 24) || 'diner';
  for (let attempt = 0; attempt < 4; attempt++) {
    const handle = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { error } = await supabase.from('profiles').insert({ id: user.id, handle });
    if (!error) return;
    if (error.code === '23505' && error.message.includes('profiles_pkey')) return;
    if (error.code !== '23505') { console.error('profile create failed', error); return; }
  }
  await supabase.from('profiles').insert({ id: user.id, handle: `diner-${user.id.slice(0, 8)}` });
}
