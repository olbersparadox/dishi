// 佢哋整得點？ offer construction, shared by /api/ratings (at rating time) and
// /api/dishes/enrich (when canonical resolution lands AFTER the rating — the
// common first-session case, since enrich runs last in the client pipeline).
//
// Both consumers MUST agree with replay.ts about what counts as "the same
// dish", so sibling selection goes through the one shared rule
// (isExecutionSibling in taste.ts) applied over the user's own rated rows —
// personal scale, a few dozen rows — rather than a per-route query that could
// drift from it.
import { SupabaseClient } from '@supabase/supabase-js';
import {
  calibratedScore, executionRangeFor, isExecutionSibling,
  type ExecutionSiblingKey,
} from './taste';

export type ExecRow = {
  dish: { id: string; name: string; name_zh: string | null; photo_url: string | null; restaurant: string | null };
  min: number; max: number; value: number | null;
};

type RatedRow = {
  dish_id: string; score: number; execution_score: number | null; created_at: string;
  dishes: {
    dish_identity_id: string | null; canonical_dish_id: string | null;
    name: string; name_zh: string | null; photo_url: string | null;
    restaurants: { name: string } | null;
  } | null;
};

/** Every rating this user has made, newest first, with the dish fields both
 * the sibling rule and the slider row need. */
export async function fetchRatedRows(supabase: SupabaseClient, userId: string): Promise<RatedRow[]> {
  const { data } = await supabase
    .from('ratings')
    .select('dish_id, score, execution_score, created_at, dishes!inner(dish_identity_id, canonical_dish_id, name, name_zh, photo_url, restaurants(name))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data ?? []) as unknown as RatedRow[];
}

const keyOf = (r: RatedRow): ExecutionSiblingKey => ({
  dish_id: r.dish_id,
  canonical_dish_id: r.dishes?.canonical_dish_id ?? null,
  dish_identity_id: r.dishes?.dish_identity_id ?? null,
});

/** Build one slider row from a rated row. Its own flick bounds its own scale
 * (centred against the person's OTHER ratings), so revising it can never
 * contradict how THAT meal was rated. */
function rowFor(r: RatedRow, all: RatedRow[]): ExecRow {
  const prior = all.filter(o => o.dish_id !== r.dish_id).map(o => o.score);
  const range = executionRangeFor(calibratedScore(r.score, prior));
  return {
    dish: {
      id: r.dish_id, name: r.dishes?.name ?? '', name_zh: r.dishes?.name_zh ?? null,
      photo_url: r.dishes?.photo_url ?? null, restaurant: r.dishes?.restaurants?.name ?? null,
    },
    ...range,
    value: r.execution_score ?? null,
  };
}

/**
 * The newest rated OTHER instance of the same dish, as a slider row — the
 * reference side of the comparison. Null when the dish has no identity links
 * or no rated sibling exists.
 */
export function findExecutionReference(rows: RatedRow[], dish: ExecutionSiblingKey): ExecRow | null {
  const sib = rows.find(r => r.dishes && isExecutionSibling(dish, keyOf(r)));
  return sib ? rowFor(sib, rows) : null;
}

/**
 * The full [reference, mine] offer for an ALREADY-RATED dish, or null when no
 * sibling comparison exists. Used by enrich when resolution lands after the
 * rating: the rating response couldn't offer the comparison (canonical id was
 * still null), so the offer rides the enrich response instead and the client
 * queues it exactly as if /api/ratings had sent it. Also the shape the
 * interactions inbox serves for STRANDED comparisons (rated before their
 * sibling existed — the rating moment is gone, so the inbox re-offers it).
 *
 * Reference FIRST — it is the thing being compared against. No solo-anchor
 * branch here on purpose: without a sibling there is nothing this late offer
 * could add that the rating-time offer didn't already decide.
 */
export function buildExecutionOfferFromRows(rows: RatedRow[], dishId: string): { rows: ExecRow[] } | null {
  const mine = rows.find(r => r.dish_id === dishId);
  if (!mine?.dishes) return null;
  const reference = findExecutionReference(rows, keyOf(mine));
  return reference ? { rows: [reference, rowFor(mine, rows)] } : null;
}

export async function buildExecutionOfferForRatedDish(
  supabase: SupabaseClient,
  userId: string,
  dishId: string,
): Promise<{ rows: ExecRow[] } | null> {
  return buildExecutionOfferFromRows(await fetchRatedRows(supabase, userId), dishId);
}
