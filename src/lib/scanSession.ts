// In-memory persistence for the current menu scan, so switching bottom-nav tabs
// (Feed / Scan / Taste — all client-side <Link> navigation) and coming back to
// /scan restores the scanned menu instead of dumping you on the fresh capture
// screen. The scan component holds its state in useState, which is destroyed on
// unmount; this survives that.
//
// WHY A MODULE-LEVEL VARIABLE, not sessionStorage/localStorage:
// The requirement is "keep the menu until the user taps X — OR the browser
// refreshes." Both Web Storage APIs survive a refresh, which is the opposite of
// what's wanted. A module singleton lives in the JS heap: it persists across
// client-side route changes (the runtime stays alive) and is wiped on a full
// page reload (the heap is torn down) — matching the requirement exactly, with
// no serialization and no stale-entry cleanup to get wrong.
//
// The result shape is owned by the scan page; typing it as a generic here avoids
// a circular import (scan page ← → this module) while the call site casts back to
// its real type.
//
// `picked` and `pickRestaurant` used to live here too. Both are gone because
// neither is client state anymore: a pick is written the moment it's tapped (see
// scan/page.tsx), so the shared session IS the restore path — a remount re-polls
// and gets server truth rather than replaying a local Set that could disagree
// with it. The restaurant is resolved once per session, server-side.

export type ScanSessionSnapshot<TResult> = {
  result: TResult;
  settled: boolean;
  keptNote: string | null;
  tableSession: { code: string; session_id: string } | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let snapshot: ScanSessionSnapshot<any> | null = null;

export function getScanSession<TResult>(): ScanSessionSnapshot<TResult> | null {
  return snapshot;
}

export function setScanSession<TResult>(snap: ScanSessionSnapshot<TResult>): void {
  snapshot = snap;
}

// Called by the scan page's reset() (the X button) so closing the menu clears
// the restored copy too — otherwise the next visit would resurrect a menu the
// user just dismissed.
export function clearScanSession(): void {
  snapshot = null;
}
