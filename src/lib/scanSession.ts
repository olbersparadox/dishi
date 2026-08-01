// Persistence for the current menu scan, so the menu is still there when you come
// back to /scan.
//
// TWO layers, because they answer two different questions:
//
//   the module variable — survives client-side route changes (tab switches). Hot
//     path: no serialization, no parsing, and the very first render after a remount
//     already has the menu.
//   sessionStorage     — survives a PAGE RELOAD, and is scoped to this tab, so it
//     dies when the tab closes.
//
// The second layer is new (owner, 2026-08-01) and REVERSES this file's original
// rule, which was "clears on refresh" — that is why localStorage and sessionStorage
// were both rejected here before. The rule did not survive contact with a phone. On
// mobile a reload is almost never a deliberate act: iOS discards backgrounded tabs
// under memory pressure (and a camera page holding a scanned menu is a fat tab),
// pull-to-refresh fires by accident, and the group flow REQUIRES leaving the app to
// send the join code to somebody. Every one of those returned the user to an empty
// capture screen with a menu they had to scan again, which is where people leave.
// A tab-scoped store survives all three: a discarded tab that reloads is still the
// same tab, so sessionStorage comes back with it.
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
    if (snapshot) window.sessionStorage.setItem(KEY, JSON.stringify(snapshot));
    else window.sessionStorage.removeItem(KEY);
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
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    // Cached back into the module so this parse happens once per page load, not on
    // every render that asks.
    snapshot = JSON.parse(raw);
    return snapshot;
  } catch {
    // Corrupt or unreadable: drop it rather than wedging the scan page on it.
    try { window.sessionStorage.removeItem(KEY); } catch { /* nothing left to try */ }
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
