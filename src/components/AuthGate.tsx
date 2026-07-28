'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useLang } from '@/lib/i18n';
import { ensureProfile } from '@/lib/ensureProfile';
import OtpForm from '@/components/OtpForm';

/**
 * The front door: everything behind it requires a session.
 *
 * The OTP form itself lives in OtpForm — extracted when the shared-dish
 * bookmark grew its own sign-in sheet, so both surfaces run ONE
 * implementation of the code dance rather than two that drift (see
 * lib/share.ts's own note for what that costs when it happens).
 *
 * Note what is NOT behind this gate: dishi.me/[username] and its per-dish
 * permalinks, deliberately — "a signup wall here kills the acquisition path
 * the page exists to serve." Those pages sign people in at the moment they
 * reach for something (the bookmark), not on arrival.
 */
export default function AuthGate({ children, fallback }: {
  children: React.ReactNode;
  /** Shown while the session check itself is in flight — a page's OWN
   * skeleton (the same one it shows while its own data loads right after),
   * not a generic "Loading…" text line. Defaults to nothing: the check is
   * normally near-instant, and a page with no meaningful skeleton shape
   * (nothing behind the gate reads better blank than with an invented one). */
  fallback?: React.ReactNode;
}) {
  const { t } = useLang();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
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

  if (!ready) return <>{fallback ?? null}</>;
  if (signedIn) return <>{children}</>;

  return (
    <div className="auth-screen" style={{ marginTop: 'calc(62.5vh - 468px)' }}>
      <div className="wordmark auth-wordmark">dish<em>i</em></div>
      <p className="tagline auth-tagline">{t('auth.tagline')}</p>
      <p className="card-meta auth-longcopy">{t('auth.longcopy')}</p>
      <h2 className="auth-title" style={{ marginTop: 94, marginBottom: 12 }}>{t('auth.title')}</h2>
      <OtpForm />
    </div>
  );
}
