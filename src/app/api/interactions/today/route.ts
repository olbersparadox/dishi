import { NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { emptyTaste, duelContrast, contentScore } from '@/lib/taste';
import { selectDuelPair, DUEL_CONTRAST_FLOOR, type DuelCandidate, type ExistingDuelRow } from '@/lib/duels';
import { fetchRatedRows, buildExecutionOfferFromRows, type ExecRow } from '@/lib/executionOffer';
import type { DistrictMap } from '@/lib/district';

/**
 * GET /api/interactions/today -> { interactions: Interaction[] }
 *
 * THE host feed for taste-calibration interactions (owner direction,
 * 2026-07-28): the journal surfaces up to two of these daily, the bell hosts
 * them all, and future interaction kinds join this list rather than growing
 * their own endpoints. Supersedes /api/duels/next (killed in the same change).
 *
 * Kinds served today:
 *   duel      — 對決. The sealed-bet contract is unchanged: predicted winner +
 *               confidence are written server-side before the answer and never
 *               returned here. Cadence ~2/day (10h cooldown, was 20h — owner
 *               call: supply is measured at ~8 weeks deep, and an engaged user
 *               answering both slots is exactly who the engine learns from).
 *   execution — 佢哋整得點？ for a STRANDED sibling pair: dishes rated before
 *               their sibling existed never got the rating-moment offer, so it
 *               is re-offered here. Scoring it retires it naturally
 *               (execution_score lands); dismissal is client-session-local, so
 *               an ignored ask returns another day rather than nagging today.
 *
 * Order of operations for the duel slot (same as the old route):
 *  1. An already-served, still-open duel < 24h old -> return it (resume).
 *  2. Otherwise, if a duel was answered/skipped in the last 10h -> no duel.
 *  3. Otherwise active selection; the least-certain qualifying pair, or
 *     nothing. Never a filler duel. If the most recent answered duel (< 7d)
 *     was predicted WRONG, selection re-probes its dims first and the card
 *     says so — a wrong bet visibly recalibrating is the product claim
 *     ("really trying to understand your taste") made concrete.
 */
const H = 60 * 60 * 1000;
const DUEL_COOLDOWN_H = 10;
const REMATCH_WINDOW_D = 7;

type DishCard = {
  id: string; name: string; name_zh: string | null; photo_url: string | null;
  restaurant: string | null; restaurant_district?: DistrictMap | null; district?: DistrictMap | null;
};
type Interaction =
  | { kind: 'duel'; duel: { id: string; a: DishCard; b: DishCard }; rematch: boolean }
  | { kind: 'execution'; rows: ExecRow[] };

export async function GET() {
  const supabase = supabaseServer();
  const admin = supabaseAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const interactions: Interaction[] = [];

  // dish_duels is RLS-locked with no policies (the seal), so reads/writes go
  // through the admin client, always scoped to the authed user's id.
  const { data: duelRows } = await admin
    .from('dish_duels')
    .select('id, dish_a, dish_b, served_at, answered_at, predicted_winner, winner, tied_at')
    .eq('user_id', user.id);
  const duels = duelRows ?? [];
  const now = Date.now();

  // The user's rated rows serve BOTH slots: duel candidates and the execution
  // inbox read the same fetch.
  const [{ data: profile }, ratedRows] = await Promise.all([
    supabase.from('taste_profiles').select('vector, evidence').eq('user_id', user.id).maybeSingle(),
    fetchRatedRows(supabase, user.id),
  ]);

  // ── Duel slot ──────────────────────────────────────────────────────────────
  const pending = duels
    .filter(d => !d.answered_at && now - new Date(d.served_at).getTime() < 24 * H)
    .sort((a, b) => new Date(b.served_at).getTime() - new Date(a.served_at).getTime())[0];

  let duelOut: Interaction | null = null;
  if (pending) {
    const cards = await fetchDishCards(supabase, [pending.dish_a, pending.dish_b]);
    if (cards[pending.dish_a] && cards[pending.dish_b]) {
      duelOut = { kind: 'duel', duel: { id: pending.id, a: cards[pending.dish_a], b: cards[pending.dish_b] }, rematch: false };
    }
    // A dish went missing (deleted mid-flight) — fall through and try a fresh pair.
  }

  const lastDone = Math.max(
    0,
    ...duels.filter(d => d.answered_at).map(d => new Date(d.answered_at as string).getTime()),
  );
  if (!duelOut && now - lastDone >= DUEL_COOLDOWN_H * H) {
    // Candidates come off the shared rated-rows fetch; a second query pulls the
    // fields the sibling rule doesn't need (attributes, cuisine, canonical).
    const { data: dishRows } = await supabase
      .from('dishes')
      .select('id, cuisine, attributes, dish_identity_id, canonical_dish_id, name, name_zh, photo_url, district, restaurants(name, district)')
      .in('id', ratedRows.map(r => r.dish_id));
    const candidates: DuelCandidate[] = [];
    const cardById: Record<string, DishCard> = {};
    for (const d of (dishRows ?? []) as any[]) {
      if (!d.attributes || Object.keys(d.attributes).length === 0) continue;
      candidates.push({
        id: d.id, cuisine: d.cuisine, attributes: d.attributes,
        identityId: d.dish_identity_id ?? null, canonicalId: d.canonical_dish_id ?? null,
      });
      cardById[d.id] = {
        id: d.id, name: d.name, name_zh: d.name_zh, photo_url: d.photo_url,
        restaurant: d.restaurants?.name ?? null, restaurant_district: d.restaurants?.district ?? null,
        district: d.district ?? null,
      };
    }

    // A recent duel the engine called WRONG earns a follow-up on its dims.
    // Ties teach gently but aren't misses; only a real wrong pick re-probes.
    const lastWrong = duels
      .filter(d => d.answered_at && !d.tied_at && d.winner && d.predicted_winner && d.winner !== d.predicted_winner)
      .filter(d => now - new Date(d.answered_at as string).getTime() < REMATCH_WINDOW_D * 24 * H)
      .sort((a, b) => new Date(b.answered_at as string).getTime() - new Date(a.answered_at as string).getTime())[0];
    let rematchDims: string[] = [];
    if (lastWrong) {
      const aAttrs = candidates.find(c => c.id === lastWrong.dish_a)?.attributes;
      const bAttrs = candidates.find(c => c.id === lastWrong.dish_b)?.attributes;
      if (aAttrs && bAttrs) {
        rematchDims = duelContrast(aAttrs, bAttrs)
          .filter(c => Math.abs(c.x) >= DUEL_CONTRAST_FLOOR)
          .map(c => c.dim);
      }
    }

    const existing: ExistingDuelRow[] = duels.map(d => ({ dish_a: d.dish_a, dish_b: d.dish_b, resolved: !!d.answered_at, served_at: d.served_at }));
    const vector = profile?.vector ?? emptyTaste();
    const pair = selectDuelPair(candidates, vector, profile?.evidence ?? {}, existing, { now, rematchDims });
    if (pair) {
      // Seal the prediction. predicted_p is the SAME p selection qualified the
      // pair on (identical formula, identical vector), so the seal and the
      // selection cannot disagree. Empty affinity — same-cuisine pair, affinity
      // cancels; pure content, matching the learning update.
      const sA = contentScore(vector, pair.a.attributes, {});
      const sB = contentScore(vector, pair.b.attributes, {});
      const predictedWinner = sA >= sB ? pair.a.id : pair.b.id;
      const { data: inserted } = await admin
        .from('dish_duels')
        .insert({ user_id: user.id, dish_a: pair.a.id, dish_b: pair.b.id, predicted_winner: predictedWinner, predicted_p: pair.p })
        .select('id')
        .single();
      if (inserted) {
        duelOut = { kind: 'duel', duel: { id: inserted.id, a: cardById[pair.a.id], b: cardById[pair.b.id] }, rematch: pair.rematch };
      }
    }
  }
  if (duelOut) interactions.push(duelOut);

  // ── Execution inbox slot ───────────────────────────────────────────────────
  // The most recently rated dish that (a) has no execution score yet and
  // (b) has a rated sibling. One per day is plenty: the card carries two
  // sliders, and the inbox exists to drain STRANDED pairs, not to become a
  // chore. rows are newest-first from fetchRatedRows.
  for (const r of ratedRows) {
    if (r.execution_score != null) continue;
    const offer = buildExecutionOfferFromRows(ratedRows, r.dish_id);
    if (offer) { interactions.push({ kind: 'execution', rows: offer.rows }); break; }
  }

  return NextResponse.json({ interactions });
}

/** Display fields for a set of dish ids, keyed by id. Uses the user client — a
 * person can always read their own dishes; only dish_duels itself is admin-only. */
async function fetchDishCards(supabase: ReturnType<typeof supabaseServer>, ids: string[]): Promise<Record<string, DishCard>> {
  const { data } = await supabase
    .from('dishes')
    .select('id, name, name_zh, photo_url, district, restaurants(name, district)')
    .in('id', ids);
  const out: Record<string, DishCard> = {};
  for (const d of (data ?? []) as any[]) {
    out[d.id] = {
      id: d.id, name: d.name, name_zh: d.name_zh, photo_url: d.photo_url,
      restaurant: d.restaurants?.name ?? null, restaurant_district: d.restaurants?.district ?? null,
      district: d.district ?? null,
    };
  }
  return out;
}
