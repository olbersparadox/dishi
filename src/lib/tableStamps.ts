// Realtime pick stamps (Table Mode social batch, item 3) — pure logic only. The
// actual Supabase Realtime channel subscription lives in table/page.tsx (this repo
// has no component/DOM test harness — see b6d3c58's own note on the same gap), so
// everything genuinely testable is factored out here: reconciling the poll-derived
// base truth against realtime deltas, and the reducer that applies one broadcast
// event onto an item's overlay. Both are exercised directly in tests/tableStamps.test.ts.
//
// Architecture: the 5s poll (GET /api/table/[code]) is the SOURCE OF TRUTH — its
// table_picks always reflects the real DB. Realtime broadcasts are a pure LATENCY
// layer on top, and — unlike an earlier version of this file — a genuinely
// bidirectional one: an overlay 'pick' shows a stamp instantly before the poll has
// it, and an overlay 'unpick' HIDES a stamp the poll still has, which matters most
// for your OWN unpick (found live, 2026-07-21: "picked" is now derived straight
// from whether my stamp is present — see table/page.tsx — so an overlay that could
// only ever ADD meant un-picking yourself left your own stamp, and the filled card,
// showing for up to 5s). A client that misses a broadcast (was backgrounded,
// momentarily offline) or a stale overlay entry left over from a broadcast whose
// counterpart was missed both self-heal on the next poll, because the caller clears
// the overlay every time a fresh poll lands (see table/page.tsx) — this file has no
// notion of staleness/expiry itself, by design.

export type Stamp = { user_id: string; name: string };

type TablePickLike = {
  user_id: string; name: string; name_zh: string | null;
  display_name: string | null; handle: string;
  identity_name?: string | null; identity_name_zh?: string | null;
  // Which ranked candidate this pick came from (item.key at pick time) — see
  // dishes.table_item_key's migration comment. Null for picks made before this
  // existed, or via a path that doesn't send one.
  table_item_key?: string | null;
};

/** Does this pick belong to this item? table_item_key when the pick has one —
 * EXACT, since it's the specific candidate that was actually tapped — falling
 * back to the old name/identity-alias matching (the SAME kind pickersFor in
 * scan/page.tsx uses) only for picks that predate it. Name-only matching
 * cross-stamped every dish sharing a printed name from a single pick — found
 * live on a real 32-dish menu where a restaurant's own 叉燒 short-name covered
 * three separate candidates (standalone dish, combo, rice set), all $128 too,
 * so nothing else disambiguated them either (2026-07-21). Exported so
 * table/page.tsx can reuse the exact same rule to find MY OWN pick on an item
 * (e.g. to un-pick it) — one matching rule, not two that could drift. */
export function pickMatchesItem(
  pick: {
    name: string; name_zh: string | null;
    identity_name?: string | null; identity_name_zh?: string | null;
    table_item_key?: string | null;
  },
  item: { key?: string; name: string; name_zh?: string | null },
): boolean {
  if (pick.table_item_key) return pick.table_item_key === item.key;
  const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
  const target = norm(item.name);
  const targetZh = norm(item.name_zh);
  const aliases = [pick.name, pick.name_zh, pick.identity_name, pick.identity_name_zh].map(norm).filter(Boolean);
  return aliases.includes(target) || (!!targetZh && aliases.includes(targetZh));
}

/** Which table members have this exact dish picked, per the poll's own table_picks.
 * Returns a full {user_id, name} stamp instead of a bare handle string, since a
 * chop needs a stable id to seed its style from, not just a display label. One stamp
 * per user_id even if they somehow have multiple matching picks (defensive, matches
 * the same real-world case pickersFor guards for user_id, not just name, dedup). */
export function stampsFromPicks(
  item: { key?: string; name: string; name_zh?: string | null },
  tablePicks: TablePickLike[],
): Stamp[] {
  const seen = new Set<string>();
  const out: Stamp[] = [];
  for (const p of tablePicks) {
    if (pickMatchesItem(p, item) && !seen.has(p.user_id)) {
      seen.add(p.user_id);
      out.push({ user_id: p.user_id, name: p.display_name ?? p.handle });
    }
  }
  return out;
}

export type StampEvent = { type: 'pick' | 'unpick'; user_id: string; name: string };

/** One item's pending realtime events, latest per user_id — not yet confirmed by
 * a poll. This is what makes the overlay bidirectional: a 'pick' entry ADDS a
 * stamp the poll doesn't have yet, an 'unpick' entry SUPPRESSES one the poll still
 * has. */
export type StampOverlay = Record<string, StampEvent>;

/** Poll (authoritative once it lands) + overlay (pending local/realtime events the
 * poll hasn't caught up to). An overlay 'unpick' hides a poll stamp for that user
 * even though the poll still lists it — the poll simply hasn't re-fetched since the
 * delete landed — and is a no-op if the poll already lacks it (nothing to hide). */
export function mergeStamps(poll: Stamp[], overlay: StampOverlay): Stamp[] {
  const out: Stamp[] = [];
  const seen = new Set<string>();
  for (const s of poll) {
    if (overlay[s.user_id]?.type === 'unpick') continue;
    seen.add(s.user_id);
    out.push(s);
  }
  for (const [userId, event] of Object.entries(overlay)) {
    if (event.type === 'pick' && !seen.has(userId)) out.push({ user_id: userId, name: event.name });
  }
  return out;
}

/** One broadcast (or local action) landing on one item's overlay. The latest event
 * for a user_id simply replaces whatever was pending for them — a pick after an
 * unpick (or vice versa) supersedes rather than stacking, matching how a real
 * interaction only ever has one pending state per user at a time. Idempotent: the
 * exact same event repeated (e.g. a redelivered broadcast) is a no-op. */
export function applyStampEvent(current: StampOverlay, event: StampEvent): StampOverlay {
  if (current[event.user_id]?.type === event.type) return current;
  return { ...current, [event.user_id]: event };
}
