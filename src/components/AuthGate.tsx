'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useLang } from '@/lib/i18n';

const EMAIL_KEY = 'dishi-email';

/**
 * Magic-link auth + numeric-code fallback.
 *
 * Why the code path exists: on phones, tapping the email link often opens the app's
 * in-app browser (Gmail, Outlook) — the session lands THERE, not in the browser the
 * person started in, so they appear "signed out" when they return. Typing the code
 * from the same email into the ORIGINAL browser creates the session in the right
 * place. (Requires adding {{ .Token }} to the Magic Link email template in Supabase.)
 *
 * The email address is remembered on-device so returning users are one tap from a
 * fresh link — never retyping.
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

  async function sendLink() {
    setError('');
    try { localStorage.setItem(EMAIL_KEY, email); } catch { /* fine */ }
    const supabase = supabaseBrowser();
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
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
    <div className="card"><div className="card-body">
      <h2 style={{ marginBottom: 6 }}>{t('auth.title')}</h2>
      <p className="card-meta" style={{ marginBottom: 12 }}>{t('auth.blurb')}</p>

      {!sent ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="field" type="email" placeholder={t('auth.placeholder')}
            value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
          <button className="btn primary" onClick={sendLink} disabled={!email.includes('@')}>{t('auth.send')}</button>
        </div>
      ) : (
        <>
          <p style={{ marginBottom: 10 }}>{t('auth.sent')}</p>
          <p className="card-meta" style={{ marginBottom: 8 }}>{t('auth.codehint')}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {/* No hardcoded digit count: Supabase's actual default OTP length turned
                out to be 8 digits, not the 6 originally assumed here — capping input
                at the wrong length silently truncated every real code before it ever
                reached the server. Accept whatever's typed; let verifyOtp reject a
                genuinely wrong code rather than the input box pre-rejecting a right
                one. */}
            <input className="field code-input" inputMode="numeric" placeholder={t('auth.codeplaceholder')}
              value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} />
            <button className="btn primary" onClick={verifyCode} disabled={code.trim().length === 0 || verifying}>
              {verifying ? t('auth.verifying') : t('auth.verify')}
            </button>
          </div>
          <button className="btn ghost small" style={{ marginTop: 10 }} onClick={() => { setSent(false); setCode(''); }}>
            {t('auth.resend')}
          </button>
        </>
      )}
      {error && <p style={{ color: 'var(--lacquer)', marginTop: 10 }}>{error}</p>}
    </div></div>
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
