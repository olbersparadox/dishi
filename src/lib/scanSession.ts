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
// The result/restaurant shapes are owned by the scan page; typing them as
// generics here avoids a circular import (scan page ← → this module) while the
// call site casts back to its real types.

export type ScanSessionSnapshot<TResult, TRestaurant> = {
  result: TResult;
  settled: boolean;
  picked: string[];            // Set<string> serialized — keyed by printed dish name
  pickRestaurant: TRestaurant; // RestaurantChoice
  keptNote: string | null;
  tableSession: { code: string; session_id: string } | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let snapshot: ScanSessionSnapshot<any, any> | null = null;

export function getScanSession<TResult, TRestaurant>(): ScanSessionSnapshot<TResult, TRestaurant> | null {
  return snapshot;
}

export function setScanSession<TResult, TRestaurant>(snap: ScanSessionSnapshot<TResult, TRestaurant>): void {
  snapshot = snap;
}

// Called by the scan page's reset() (the X button) so closing the menu clears
// the restored copy too — otherwise the next visit would resurrect a menu the
// user just dismissed.
export function clearScanSession(): void {
  snapshot = null;
}
