// dishi.username — the one identity string a person chooses for themselves.
//
// It reuses profiles.handle (see supabase/applied/profiles_username_claim.sql):
// the same string is the chop name fallback, the pick attribution, and the
// future dishi.me/[username] path. Because it lands in a URL, the charset is
// deliberately narrower than a display name — display_name stays free-form for
// anything a person actually wants to be CALLED (spaces, Chinese, anything).
//
// Claimed at v1 unlock with a "choose carefully" warning, then exactly ONE
// change, ever (owner, 2026-07-26). The scarcity is the point, so validation
// must reject at the input, not after the change is spent.

/** Renames allowed after the initial claim. One, deliberately — see DECISIONS.md. */
export const USERNAME_CHANGES_ALLOWED = 1;

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

/** Lowercase latin + digits + underscore, must LEAD with a letter. Leading digits
 *  are out so a username can never be confused with an id in a path, and the
 *  whole thing is lowercase so "Jerry" and "jerry" can't be two people. */
const SHAPE = /^[a-z][a-z0-9_]{2,19}$/;

/** Paths the app owns (or will own) at the root, plus the obvious impersonation
 *  risks. dishi.me/[username] sits at the root, so anything here would either
 *  collide with a real route or let someone pose as the product. */
const RESERVED = new Set([
  // real or planned routes
  'api', 'app', 'auth', 'login', 'logout', 'signup', 'scan', 'table', 'order',
  'profile', 'settings', 'owner', 'restaurant', 'restaurants', 'dish', 'dishes',
  'menu', 'help', 'about', 'support', 'terms', 'privacy', 'legal', 'contact',
  'new', 'edit', 'search', 'explore', 'feed', 'home', 'me', 'you', 'user',
  'users', 'account', 'static', 'public', 'assets', 'images', 'img', 'favicon',
  // the product itself
  'dishi', 'dishime', 'official', 'admin', 'root', 'system', 'support_team',
  'staff', 'team', 'moderator', 'mod', 'www', 'mail', 'ftp', 'cdn',
  // the intent-landing route the export doc points at (BACKLOG 1b)
  'i',
]);

export type UsernameError = 'empty' | 'tooshort' | 'toolong' | 'shape' | 'reserved';

/** Lowercase + trim. Applied before validation AND before every read/write, so
 *  what the person typed and what is stored can never drift in case. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/** null = valid. Order matters: length problems are reported as themselves
 *  rather than as a generic shape error, because "3-20 characters" is the
 *  fix the person can act on. */
export function validateUsername(raw: string): UsernameError | null {
  const u = normalizeUsername(raw);
  if (!u) return 'empty';
  if (u.length < USERNAME_MIN) return 'tooshort';
  if (u.length > USERNAME_MAX) return 'toolong';
  if (!SHAPE.test(u)) return 'shape';
  if (RESERVED.has(u)) return 'reserved';
  return null;
}

/** Whether a rename is still available. `setAt` null means the username was
 *  never claimed — the claim itself is free and does not spend the change. */
export function renamesLeft(changesUsed: number | null | undefined): number {
  return Math.max(0, USERNAME_CHANGES_ALLOWED - (changesUsed ?? 0));
}

/** A legacy auto-handle (email local part) is NOT a claimed username, even
 *  though it occupies the same column — so the naming moment still fires for
 *  everyone who predates the feature. Callers must key off username_set_at,
 *  never off "handle is non-empty". */
export function hasClaimedUsername(setAt: string | null | undefined): boolean {
  return !!setAt;
}
