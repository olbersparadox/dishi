'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

/** Magic-link auth, deliberately minimal. Wrap any page that needs a session. */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const supabase = supabaseBrowser();
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      setReady(true);
      if (data.session?.user) ensureProfile(supabase, data.session.user);
    });
    // Also ensure the profile on auth events: after a magic-link redirect the
    // SIGNED_IN event can fire after getSession resolved null — without this,
    // a first-time user could end up signed in with no profile row.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session);
      if (session?.user) ensureProfile(supabase, session.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function sendLink() {
    const supabase = supabaseBrowser();
    await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    setSent(true);
  }

  if (!ready) return <p className="card-meta">Loading…</p>;
  if (signedIn) return <>{children}</>;

  return (
    <div className="card"><div className="card-body">
      <h2 style={{ marginBottom: 6 }}>Sign in to start</h2>
      <p className="card-meta" style={{ marginBottom: 12 }}>
        One email, no password. Dishi learns your taste from your first flick.
      </p>
      {sent ? (
        <p>Check your inbox for the sign-in link.</p>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="field" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          <button className="btn primary" onClick={sendLink} disabled={!email.includes('@')}>Send link</button>
        </div>
      )}
    </div></div>
  );
}

/**
 * Create the profile row if missing, with collision-safe handles: profiles.handle is
 * UNIQUE, and two people can share an email prefix (jerry@gmail vs jerry@work). If the
 * preferred handle is taken (Postgres 23505), retry with a random suffix. Existing
 * profiles are never touched — no blind upsert that could clobber a chosen handle.
 */
async function ensureProfile(supabase: ReturnType<typeof supabaseBrowser>, user: { id: string; email?: string }) {
  const { data: existing } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
  if (existing) return;

  const base = (user.email?.split('@')[0] ?? 'diner').slice(0, 24) || 'diner';
  for (let attempt = 0; attempt < 4; attempt++) {
    const handle = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { error } = await supabase.from('profiles').insert({ id: user.id, handle });
    if (!error) return;
    if (error.code === '23505' && error.message.includes('profiles_pkey')) return; // raced with ourselves — row exists
    if (error.code !== '23505') { console.error('profile create failed', error); return; }
    // 23505 on handle -> loop and retry with a suffix
  }
  // Last resort: a handle that cannot collide.
  await supabase.from('profiles').insert({ id: user.id, handle: `diner-${user.id.slice(0, 8)}` });
}
