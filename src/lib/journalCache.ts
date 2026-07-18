import type { MyDish } from '@/components/MyDishes';

// In-memory persistence for the 食記 journal list, mirroring scanSession.ts. The
// journal (MyDishes) holds its rows in useState, which is destroyed when the
// component unmounts — and switching bottom-nav tabs (食記 / 掃餐牌 / 味AI, all
// client-side <Link> navigation) unmounts it. Without this, every return to the
// journal replayed the skeleton + a full refetch for a list that hadn't changed.
//
// WHY A MODULE-LEVEL VARIABLE, not sessionStorage/localStorage: the wanted lifetime
// is exactly "keep it across tab switches, drop it on a full page reload." A module
// singleton lives in the JS heap: it survives client-side route changes and is wiped
// on a browser reload (including the native pull-to-refresh gesture) — which IS the
// "scroll down to reload the page" refresh path, so no custom pull-to-refresh UI is
// needed. Web Storage would survive the reload too, which is the opposite of wanted.
//
// The list stays fresh two ways: in-journal edits (rename / re-rate / delete / photo)
// flow through setDishes, and a sync effect writes the updated list straight back
// here — so a tab switch restores exactly what was on screen, extra scrolled-in pages
// included. The one change the cache can't observe is a dish rated on the /log flow,
// which lands on the Taste tab rather than remounting the journal; that path calls
// clearJournalCache() so the next visit refetches and shows the new dish.

export type JournalSnapshot = { dishes: MyDish[]; hasMore: boolean };

let snapshot: JournalSnapshot | null = null;

export function getJournalCache(): JournalSnapshot | null {
  return snapshot;
}

export function setJournalCache(snap: JournalSnapshot): void {
  snapshot = snap;
}

// Explicit invalidation for the one mutation the cache can't see: a dish rated on
// the /log flow. Clearing it there forces the next journal visit to refetch.
export function clearJournalCache(): void {
  snapshot = null;
}
