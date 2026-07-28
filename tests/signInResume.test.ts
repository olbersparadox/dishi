// Bookmark-as-signup (sharing batch item 5), and the retry loop it nearly
// shipped with.
//
// The bug, found by counting POSTs during verification rather than by reading
// the code: SignInSheet subscribed to onAuthStateChange to learn when to
// resume the bookmark. GoTrue emits SIGNED_IN for a session that ALREADY
// exists, so the sheet fired the instant it mounted, resumed the action, got
// the same 401 back, reopened itself — 3 POSTs per single tap. Filtering the
// event name does NOT fix it: a global listener fundamentally cannot tell
// "just signed in" from "was signed in". Reaching that state in production
// only needs a stale cookie that 401s the API while the client still holds a
// session object.
//
// The fix is structural: OtpForm reports ITS OWN successful verify, so the
// only thing that can resume an action is the person actually completing the
// form. These assertions pin the structure, because the symptom (a duplicate
// POST that the unique index quietly absorbs) is invisible in normal use.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

describe('SignInSheet resumes on its OWN form, never on global auth state', () => {
  const sheet = read('../src/components/SignInSheet.tsx');

  it('does not subscribe to onAuthStateChange', () => {
    // A CALL, not the word — the file names it in prose precisely to warn the
    // next person off rebuilding it that way.
    expect(sheet).not.toMatch(/onAuthStateChange\s*\(/);
  });

  it('resumes via OtpForm.onVerified', () => {
    expect(sheet).toMatch(/onVerified=/);
  });

  it('guarantees the profile row before handing control back', () => {
    // The resumed action writes a dishes row keyed to this user, so the
    // profile has to exist first or the retry races its own account.
    expect(sheet).toMatch(/await ensureProfile/);
    const awaitPos = sheet.indexOf('await ensureProfile');
    const callbackPos = sheet.indexOf('onSignedIn()');
    expect(awaitPos).toBeGreaterThan(-1);
    expect(callbackPos).toBeGreaterThan(awaitPos);
  });
});

describe('the OTP form has exactly one implementation', () => {
  it('AuthGate mounts OtpForm rather than carrying its own fields', () => {
    const gate = read('../src/components/AuthGate.tsx');
    expect(gate).toMatch(/OtpForm/);
    expect(gate).not.toMatch(/signInWithOtp/);
    expect(gate).not.toMatch(/verifyOtp/);
  });

  it('AuthGate still listens globally — correct there, it gates on session PRESENCE', () => {
    // Explicitly not the same bug: the gate asks "is there a session", which
    // an existing session answers correctly. Only RESUMING an action needs a
    // transition, and that is what OtpForm.onVerified is for.
    expect(read('../src/components/AuthGate.tsx')).toMatch(/onAuthStateChange\s*\(/);
  });
});

describe('FeedCard treats 401 as a signup moment, not a failure', () => {
  const card = read('../src/components/FeedCard.tsx');

  it('routes 401 to the sign-in sheet instead of the failed state', () => {
    expect(card).toMatch(/res\.status === 401/);
    expect(card).toMatch(/setSignInOpen\(true\)/);
    // The 401 branch must come BEFORE the generic !res.ok failure branch, or
    // the dead-end this item exists to remove is still there.
    expect(card.indexOf('res.status === 401')).toBeLessThan(card.indexOf('if (!res.ok)'));
  });

  it('retries the bookmark once signed in', () => {
    expect(card).toMatch(/onSignedIn=\{\(\) => \{ setSignInOpen\(false\); bookmark\(\); \}\}/);
  });
});
