// 同檯 companion edges (Table Mode item 4) — pure pair/aggregate logic.
// Writes happen in API routes via the admin client (companion_edges has no
// client write policies, by design); everything that can be reasoned about
// without a database lives here, unit-tested.
//
// Semantics (see supabase/applied/companion_edges.sql for the schema's own
// rationale): a pick at a shared table is communal — every consenting member
// pair present gets an edge per picked dish, not just pairs involving the
// picker. Joining a session mid-meal consents you to the whole session
// (you can already SEE its existing picks), so a late joiner back-fills
// edges against the picks that predate them — with picked_at kept as the
// PICK's own time, not the join time.

export type CompanionEdgeInsert = {
  user_a: string;
  user_b: string;
  dish_id: string;
  table_session_id: string | null;
  picked_at?: string; // omitted -> DB default now() (pick-time writes)
};

/** Canonical undirected ordering (matches the table's user_a < user_b check).
 * null for a degenerate self-pair — a user is never their own companion. */
export function canonicalPair(a: string, b: string): [string, string] | null {
  if (a === b) return null;
  return a < b ? [a, b] : [b, a];
}

/** All member-pair edges for a batch of freshly PICKED dishes (pick-time write:
 * picked_at defaults to now() in the DB, which is when the pick happened).
 * Member ids are deduped; fewer than 2 distinct members -> no pairs, no rows. */
export function edgeRowsForPick(
  memberIds: string[],
  dishIds: string[],
  sessionId: string,
): CompanionEdgeInsert[] {
  const members = Array.from(new Set(memberIds)); // Array.from, not spread — bare-tsc downlevelIteration (see chop.ts's note)
  const rows: CompanionEdgeInsert[] = [];
  for (const dish_id of dishIds) {
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const pair = canonicalPair(members[i], members[j]);
        if (pair) rows.push({ user_a: pair[0], user_b: pair[1], dish_id, table_session_id: sessionId });
      }
    }
  }
  return rows;
}

/** Edges a LATE JOINER owes against a session's existing picks: only pairs
 * involving the new member (every other pair already exists from pick time —
 * the unique constraint would eat duplicates anyway, but there's no point
 * shipping them). picked_at carries the dish's own created_at so the edge
 * records when the pick happened, not when this person joined. */
export function edgeRowsForJoin(
  newMemberId: string,
  otherMemberIds: string[],
  dishes: { id: string; created_at?: string | null }[],
  sessionId: string,
): CompanionEdgeInsert[] {
  const others = Array.from(new Set(otherMemberIds)).filter(id => id !== newMemberId);
  const rows: CompanionEdgeInsert[] = [];
  for (const dish of dishes) {
    for (const other of others) {
      const pair = canonicalPair(newMemberId, other);
      if (pair) {
        rows.push({
          user_a: pair[0], user_b: pair[1], dish_id: dish.id, table_session_id: sessionId,
          ...(dish.created_at ? { picked_at: dish.created_at } : {}),
        });
      }
    }
  }
  return rows;
}

/** One person's view of an edge, joined server-side with the dish's cuisine —
 * the input shape for export aggregation. `other` is the counterpart user id. */
export type CompanionEdgeView = {
  other: string;
  dish_id: string;
  table_session_id: string | null;
  picked_at: string;
  cuisine?: string | null;
};

export type CompanionStats = {
  userId: string;
  /** Distinct shared dishes. */
  dishCount: number;
  /** Distinct table sessions — "meals together." Edges whose session was
   * cleaned up (null) still prove at least one shared meal, hence the floor. */
  mealCount: number;
  /** Distinct cuisines explored together (unknown/absent excluded). */
  cuisines: string[];
  /** Earliest shared pick — lets the export delta call a companion "new since
   * the last export" with zero extra storage (compare against last_export_at). */
  firstSharedAt: string;
};

/** Aggregate one person's edges into per-companion stats, strongest first
 * (by shared dishes, then meals). Pure, so the honest-aggregation rules are
 * testable without a database. */
export function companionStats(edges: CompanionEdgeView[]): CompanionStats[] {
  const byUser = new Map<string, CompanionEdgeView[]>();
  for (const e of edges) {
    const arr = byUser.get(e.other) ?? [];
    arr.push(e);
    byUser.set(e.other, arr);
  }
  const stats: CompanionStats[] = [];
  byUser.forEach((list, userId) => {
    const sessions = new Set(list.map(e => e.table_session_id).filter((s): s is string => !!s));
    const cuisines = Array.from(new Set(list.map(e => (e.cuisine ?? '').toLowerCase()).filter(c => c && c !== 'unknown')));
    stats.push({
      userId,
      dishCount: new Set(list.map(e => e.dish_id)).size,
      mealCount: Math.max(sessions.size, list.length > 0 ? 1 : 0),
      cuisines,
      firstSharedAt: list.map(e => e.picked_at).sort()[0],
    });
  });
  return stats.sort((a, b) => b.dishCount - a.dishCount || b.mealCount - a.mealCount);
}
