// In-session menu-page accumulation. When a diner scans a SECOND page of the same
// menu ("加掃一版"), its dishes merge onto the first page's set rather than replacing
// it — so the ranking and the group-fairness math run across the whole orderable
// menu, which is the entire point of the screen. This module is the pure decision
// layer: given the current accumulated items and a freshly-scanned page, which new
// dishes are genuinely new, and which fold into a row that's already there.
//
// Same real dish shows up twice constantly here: overlapping page photos, or a dish
// printed under both "chef's picks" and its own category. Naive append would list it
// twice and look broken. So we dedup with the SAME primitives the cross-user identity
// system uses — normalized-name equality, then script-aware containment — but scoped
// to one scan session (no LLM, no human gate: this is a within-menu cosmetic fold,
// the cheap confident tier only).

// Minimal shape this module needs; the scan page's ScannedItem is a superset.
export type MergeableDish = {
  name: string;
  name_zh?: string | null;
  name_original: string;
};

/** Cosmetic-fold normalizer: lowercase, strip spaces/punctuation, in either script.
 * Deliberately the same shape as dishIdentity's compact() so a page-2 name folds the
 * same way a cross-user duplicate would. */
function compact(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '')
    .replace(/[.,!?;:'"“”‘’()\[\]{}·・…\-–—_/\\]+/g, '');
}

/** True when two dishes are the same within one menu: exact normalized match in
 * either language, OR one name contains the other with a script-aware length floor
 * (so a page-2 「水晶鮮蝦餃」 folds into a page-1 「蝦餃」, but a 2-char fragment can't
 * swallow half the menu). */
export function sameDishInSession(a: MergeableDish, b: MergeableDish): boolean {
  const pairs: [string, string][] = [
    [compact(a.name), compact(b.name)],
    [compact(a.name_zh), compact(b.name_zh)],
    // cross-field: page 1 may have only zh, page 2 only en of the same dish, but the
    // original printed string is the most reliable cross-page key when present.
    [compact(a.name_original), compact(b.name_original)],
  ];
  for (const [x, y] of pairs) {
    if (!x || !y) continue;
    if (x === y) return true;
    const [shorter, longer] = x.length <= y.length ? [x, y] : [y, x];
    const hasCjk = /[\u3400-\u9FFF\uF900-\uFAFF]/.test(shorter);
    const floor = hasCjk ? 2 : 4;
    if (shorter.length >= floor && longer.includes(shorter)) return true;
  }
  return false;
}

/** Of two occurrences of the same dish, the one whose name we keep: prefer the one
 * carrying BOTH languages, then the longer/more-specific printed name (水晶鮮蝦餃 over
 * 蝦餃). Purely about which label reads best; scoring/enrichment fields are handled by
 * the caller (the already-scored occurrence's data is kept). */
export function richerNamed<T extends MergeableDish>(a: T, b: T): T {
  const score = (d: MergeableDish) =>
    (d.name_zh && d.name ? 2 : 0) + (d.name_zh?.length ?? 0) + (d.name?.length ?? 0) * 0.5;
  return score(b) > score(a) ? b : a;
}

/** Split a freshly-scanned page against the current accumulated set.
 *  - `duplicates`: [existingIndex, incomingItem] pairs that fold into a row already
 *     present (caller keeps the existing scored row, optionally upgrading its name).
 *  - `fresh`: genuinely new dishes to append and send for scoring.
 * Within-page duplicates in the incoming set are also collapsed, so scanning a page
 * that itself lists a dish twice doesn't append it twice. */
export function partitionScannedPage<T extends MergeableDish>(
  existing: T[],
  incoming: T[],
): { duplicates: { index: number; item: T }[]; fresh: T[] } {
  const duplicates: { index: number; item: T }[] = [];
  const fresh: T[] = [];

  for (const cand of incoming) {
    const existingIdx = existing.findIndex(e => sameDishInSession(e, cand));
    if (existingIdx >= 0) {
      duplicates.push({ index: existingIdx, item: cand });
      continue;
    }
    // Not in the prior set — but is it a duplicate of something earlier on THIS page?
    const freshDup = fresh.findIndex(f => sameDishInSession(f, cand));
    if (freshDup >= 0) {
      fresh[freshDup] = richerNamed(fresh[freshDup], cand);
      continue;
    }
    fresh.push(cand);
  }

  return { duplicates, fresh };
}

/** Page-1's restaurant wins for the whole session. This decides whether an appended
 * page's restaurant guess should be quietly noted as "kept" (a strong mismatch —
 * likely a different place's menu scanned by accident) or silently ignored (same
 * place, or no new guess). Never blocks the append; the dishes are added regardless. */
export function restaurantKeptNote(
  current: string | null,
  incomingGuess: string | null,
): { keep: string; noteMismatch: boolean } | null {
  if (!current) return null;                 // nothing locked yet; caller adopts guess
  if (!incomingGuess) return { keep: current, noteMismatch: false };
  const same = compact(current) === compact(incomingGuess)
    || compact(current).includes(compact(incomingGuess))
    || compact(incomingGuess).includes(compact(current));
  return { keep: current, noteMismatch: !same };
}
