// Realtime pick stamps (Table Mode social batch, item 3) — pure logic only. The
// actual Supabase Realtime channel subscription lives in table/page.tsx (this repo
// has no component/DOM test harness — see b6d3c58's own note on the same gap), so
// everything genuinely testable is factored out here: reconciling the poll-derived
// base truth against realtime deltas, and the reducer that applies one broadcast
// event onto a stamp list. Both are exercised directly in tests/tableStamps.test.ts.
//
// Architecture: the 5s poll (GET /api/table/[code]) is the SOURCE OF TRUTH — its
// table_picks always reflects the real DB. Realtime broadcasts are a pure LATENCY
// layer on top: they make a stamp appear instantly instead of waiting up to 5s, and
// drive the mount-animation "thunk." A client that misses a broadcast (was
// backgrounded, momentarily offline) or a stale entry left over from a broadcast
// whose corresponding unpick was missed both self-heal on the next poll, because the
// caller clears the realtime overlay every time a fresh poll lands (see table/page.tsx)
// — this file has no notion of staleness/expiry itself, by design.

export type Stamp = { user_id: string; name: string };

type TablePickLike = {
  user_id: string; name: string; name_zh: string | null;
  display_name: string | null; handle: string;
  identity_name?: string | null; identity_name_zh?: string | null;
};

/** Which table members have this exact dish picked, per the poll's own table_picks —
 * the SAME name/identity-alias matching pickersFor (scan/page.tsx) already uses, just
 * returning a full {user_id, name} stamp instead of a bare handle string, since a
 * chop needs a stable id to seed its style from, not just a display label. One stamp
 * per user_id even if they somehow have multiple matching picks (defensive, matches
 * the same real-world case pickersFor guards for user_id, not just name, dedup). */
export function stampsFromPicks(
  item: { name: string; name_zh?: string | null },
  tablePicks: TablePickLike[],
): Stamp[] {
  const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
  const target = norm(item.name);
  const targetZh = norm(item.name_zh);
  const seen = new Set<string>();
  const out: Stamp[] = [];
  for (const p of tablePicks) {
    const aliases = [p.name, p.name_zh, p.identity_name, p.identity_name_zh].map(norm).filter(Boolean);
    const matches = aliases.includes(target) || (!!targetZh && aliases.includes(targetZh));
    if (matches && !seen.has(p.user_id)) {
      seen.add(p.user_id);
      out.push({ user_id: p.user_id, name: p.display_name ?? p.handle });
    }
  }
  return out;
}

/** Poll (authoritative) + realtime overlay (latency-only), deduped by user_id — a
 * realtime entry only shows when the poll hasn't caught up to it yet. */
export function mergeStamps(poll: Stamp[], realtime: Stamp[]): Stamp[] {
  const seen = new Set(poll.map(s => s.user_id));
  return [...poll, ...realtime.filter(s => !seen.has(s.user_id))];
}

export type StampEvent = { type: 'pick' | 'unpick'; user_id: string; name: string };

/** One broadcast landing on one item's realtime stamp list. Idempotent both ways: a
 * duplicate 'pick' (e.g. a redelivered message) doesn't double-add, and an 'unpick'
 * for someone not currently in the list is a harmless no-op rather than an error —
 * broadcast delivery order across two independent members is never guaranteed. */
export function applyStampEvent(current: Stamp[], event: StampEvent): Stamp[] {
  if (event.type === 'unpick') return current.filter(s => s.user_id !== event.user_id);
  if (current.some(s => s.user_id === event.user_id)) return current;
  return [...current, { user_id: event.user_id, name: event.name }];
}
