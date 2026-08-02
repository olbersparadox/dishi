// Persistence for the current menu scan, so the menu is still there when you come
// back to /scan.
//
// TWO layers, because they answer two different questions:
//
//   the module variable — survives client-side route changes (tab switches). Hot
//     path: no serialization, no parsing, and the very first render after a remount
//     already has the menu.
//   localStorage       — survives a PAGE RELOAD, the tab being torn down, and
//     Safari itself being killed. Restores only within MAX_AGE_MS of the last
//     write, so yesterday's menu never greets today's lunch.
//
// The second layer (owner, 2026-08-01) REVERSES this file's original rule, which
// was "clears on refresh". The rule did not survive contact with a phone. On
// mobile a reload is almost never a deliberate act: iOS discards backgrounded tabs
// under memory pressure (and a camera page holding a scanned menu is a fat tab),
// pull-to-refresh fires by accident, and the group flow REQUIRES leaving the app to
// send the join code to somebody. Every one of those returned the user to an empty
// capture screen with a menu they had to scan again, which is where people leave.
//
// It was sessionStorage for one day. Field evidence (owner, 2026-08-02): the menu
// "exited by itself" within an hour of a real restaurant session — heavy Camera
// use killed Safari's process, and iOS hands a restored tab FRESH sessionStorage,
// so the per-tab store broke the very contract it existed to keep ("only the X
// exits"). localStorage survives process death; the freshness window below does
// the expiring that tab-lifetime was supposed to do, on a clock that matches a
// meal instead of a process. Two honest limits remain: Safari and the
// home-screen app are separate storage worlds on iOS (a menu scanned in one
// cannot appear in the other), and a second concurrent scan in another tab
// last-writer-wins — both acceptable at this stage; the durable fix is
// server-side restore off the table session, noted in the backlog.
//
// Dismissal is now an explicit act only: the X (which asks first). Nothing else
// clears this, which is the whole point.
//
// The result shape is owned by the scan page; typing it as a generic here avoids
// a circular import (scan page ← → this module) while the call site casts back to
// its real type.
//
// `picked` and `pickRestaurant` used to live here too. Both are gone because
// neither is client state anymore: a pick is written the moment it's tapped (see
// scan/page.tsx), so the shared session IS the restore path — a remount re-polls
// and gets server truth rather than replaying a local Set that could disagree
// with it. That is also what makes a GROUP re-hydrate silently: restoring the
// table code is enough, and the poll brings back picks, members and the bill.

export type ScanSessionSnapshot<TResult> = {
  result: TResult;
  settled: boolean;
  keptNote: string | null;
  tableSession: { code: string; session_id: string } | null;
};

const KEY = 'dishi.scan';

/** How long a mirrored scan stays restorable. A meal plus its aftermath — order,
 *  eat, settle, rate on the couch — fits comfortably; a menu older than this is a
 *  different outing and restoring it would be creepy, not helpful. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

type StoredEnvelope = { savedAt: number; snap: ScanSessionSnapshot<unknown> };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let snapshot: ScanSessionSnapshot<any> | null = null;

/** Trailing write. A scan streams item by item, so the mirror would otherwise
 *  re-serialize the whole growing menu once per dish — tens of times, on the phone,
 *  during the one moment the page is busiest. */
let writeTimer: ReturnType<typeof setTimeout> | null = null;

function writeThrough(): void {
  writeTimer = null;
  if (typeof window === 'undefined') return;
  try {
    if (snapshot) {
      const env: StoredEnvelope = { savedAt: Date.now(), snap: snapshot };
      window.localStorage.setItem(KEY, JSON.stringify(env));
    } else window.localStorage.removeItem(KEY);
  } catch {
    // Quota, private mode, storage disabled. The module layer still works, so this
    // degrades to exactly the old behaviour rather than breaking the scan.
  }
}

function scheduleWrite(): void {
  if (typeof window === 'undefined') return;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(writeThrough, 400);
}

// The debounce is a performance choice and must not cost correctness: a tab being
// backgrounded or discarded is precisely when the pending write matters most, and
// it is also the moment the timer will never fire. pagehide covers both bfcache
// and teardown; visibilitychange covers an app switch that never unloads.
if (typeof window !== 'undefined') {
  const flush = () => { if (writeTimer) { clearTimeout(writeTimer); writeThrough(); } };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
}

export function getScanSession<TResult>(): ScanSessionSnapshot<TResult> | null {
  if (snapshot) return snapshot;
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const env: StoredEnvelope = JSON.parse(raw);
    // Stale or not the envelope shape this build writes: drop it. The age check is
    // what replaced tab-lifetime as the expiry — see the header.
    if (!env || typeof env.savedAt !== 'number' || !env.snap
      || Date.now() - env.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    // Cached back into the module so this parse happens once per page load, not on
    // every render that asks.
    snapshot = env.snap;
    return snapshot as ScanSessionSnapshot<TResult>;
  } catch {
    // Corrupt or unreadable: drop it rather than wedging the scan page on it.
    try { window.localStorage.removeItem(KEY); } catch { /* nothing left to try */ }
    return null;
  }
}

export function setScanSession<TResult>(snap: ScanSessionSnapshot<TResult>): void {
  snapshot = snap;
  scheduleWrite();
}

/** Force the debounced mirror out now. Production uses it via pagehide; tests use it
 *  to assert what a reload would actually find. */
export function flushScanSession(): void {
  if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
  writeThrough();
}

/** Drop ONLY the in-memory layer, leaving storage alone — what a page reload does to
 *  this module. The two layers are the whole design here, so a test that cannot take
 *  one away without the other cannot tell them apart. */
export function __resetScanSessionModuleForTest(): void {
  snapshot = null;
  if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
}

// Called by the scan page's reset() (behind the X's confirm) so closing the menu
// clears BOTH layers — otherwise the next visit would resurrect a menu the user
// deliberately dismissed. Writes immediately: a dismissal is not something to leave
// sitting in a timer.
export function clearScanSession(): void {
  snapshot = null;
  if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
  writeThrough();
}
