# Spec: OTP login — kill the magic-link browser trap

**Tier: [S].** The verifyOtp code path already exists in AuthGate; this makes
it the primary path and enables iOS keyboard autofill. Mostly a Supabase email
template change plus a few lines.

## Problem

The login email leads with a magic link. Tapping it opens whatever browser the
mail app chooses (Gmail webview, default Safari), so the session lands in a
different browser than where the user started — the classic magic-link trap.
Login must be: type email → read/tap 6-digit code → in, in the SAME browser,
every time.

## Changes

1. **Supabase email template** (dashboard: Auth → Email Templates → Magic
   Link / OTP): the 6-digit `{{ .Token }}` becomes the hero — own line, large,
   near the word "code" / "驗證碼" (Apple Mail's detector keys on proximity to
   code-words). Remove the magic link from the template entirely. Document the
   exact final template in this spec file (or a sibling note) when done, since
   dashboard config isn't in git.
2. **AuthGate code input:** add `autoComplete="one-time-code"` (the attribute
   that makes iOS surface the code from Apple Mail/Messages as a tappable chip
   above the keyboard). Keep the existing single-input shape, numeric
   inputMode, digit filtering — already the most autofill-reliable form.
3. **Drop `emailRedirectTo`** from the signInWithOtp call once the link is
   gone from the template (pure OTP; no redirect target needed).
4. **Login screen emphasis:** after email submit, the code entry is the one
   obvious next step — copy like 已寄咗個 6 位數碼去你嘅 email（唔使撳 link）.
   Adjust i18n keys accordingly (zh + en).

## Coverage expectations (documented, not built around)

- iPhone + Apple Mail: full chip-above-keyboard autofill.
- iPhone + Gmail app: no system chip; Gmail's own copy-code button usually
  appears — acceptable.
- Android: no reliable email autofill standard; typing 6 visible digits is the
  floor. SMS/WebOTP is the bulletproof Android path but costs per login —
  explicitly out of scope; revisit only if login friction shows in metrics.

## Tests

- AuthGate renders the code input with autoComplete="one-time-code" (simple
  render assertion).
- signInWithOtp called without emailRedirectTo.
- i18n parity for changed keys.

## Acceptance

- tsc clean; npm test green.
- Manual on a real iPhone with Apple Mail: request code from Safari → code
  chip appears above the keyboard → tap → logged in without leaving Safari.
  Repeat starting from an installed-PWA context if available.
