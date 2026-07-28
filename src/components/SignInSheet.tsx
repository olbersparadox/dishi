'use client';
// Sign in WITHOUT leaving what you were doing (sharing batch item 5).
//
// This exists for one moment: someone lands on a shared dish from a
// messenger, taps 想食, and has no account. Before this, that tap POSTed
// /api/bookmarks, took a 401 and died in FeedCard's silent `failed` state —
// the single highest-intent action on the whole public surface, dead-ending
// for exactly the people a share is aimed at.
//
// The intent survives the round trip: nothing commits on tap, the person
// signs in here, and the action they already chose completes itself. That is
// the contract the never-built /i route was specified to provide (BACKLOG
// closed it as claimed by this).
//
// Mounts OtpForm — the same form the front-door gate runs — inside the same
// ExplainModal every other sheet in the app uses. No new auth path, no new
// modal chrome.
//
// It listens to NO global auth state, deliberately. The obvious build is an
// onAuthStateChange subscription, and it is wrong: GoTrue emits SIGNED_IN for
// a session that already exists, so the sheet fires the instant it mounts,
// resumes the action, gets the same 401 back and reopens itself. That was
// measured at 3 POSTs per single tap before OtpForm learned to report its own
// verify. A stale cookie that 401s the API while the client still holds a
// session object reaches that state in production, not just in a test.
import ExplainModal from './ExplainModal';
import OtpForm from './OtpForm';
import { supabaseBrowser } from '@/lib/supabase/client';
import { ensureProfile } from '@/lib/ensureProfile';
import { useLang } from '@/lib/i18n';

export default function SignInSheet({ reason, onSignedIn, onClose }: {
  /** Why we're asking, in the person's own terms ("save this dish to try") —
   * never a bare "sign in", which reads as a wall rather than a step. */
  reason: string;
  /** Fired once a session exists AND the profile row is guaranteed, so the
   * caller can safely retry the action that needed auth. */
  onSignedIn: () => void;
  onClose: () => void;
}) {
  const { t } = useLang();

  const verified = async () => {
    const supabase = supabaseBrowser();
    const { data } = await supabase.auth.getUser();
    // The retry writes a dishes row keyed to this user, so the profile must
    // exist BEFORE it fires — awaiting here is what makes the resumed
    // bookmark safe rather than racy.
    if (data.user) await ensureProfile(supabase, data.user);
    onSignedIn();
  };

  return (
    <ExplainModal
      title={t('auth.sheet.title')}
      body={reason}
      extra={<div style={{ marginTop: 12 }}><OtpForm onVerified={verified} /></div>}
      // No confirm circle: the form's own arrow IS the action, and a second
      // affirmative button beside it would be ambiguous about which one signs
      // you in. The scrim still dismisses.
      footer={<></>}
      onClose={onClose}
    />
  );
}
