import { NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { contentScore, sigmoid, emptyTaste, DUEL_K } from '@/lib/taste';
import { selectDuelPair, type DuelCandidate, type ExistingDuelRow } from '@/lib/duels';

/**
 * GET /api/duels/next -> { duel } | { duel: null }
 *
 * The duel IS a sealed bet: a predicted winner + confidence is written server-side
 * before the user answers, and this endpoint NEVER returns those fields — only the
 * two dishes' display data. That hiddenness is the seal (same contract as
 * sealed_predictions). dish_duels is RLS-locked with no policies, so every read and
 * write goes through the admin client, always scoped to the authed user's id.
 *
 * Order of operations:
 *  1. An already-served, still-open duel < 24h old -> return it (resume, don't churn).
 *  2. Otherwise, if a duel was answered/skipped in the last 20h -> nothing (spacing).
 *  3. Otherwise run active pair selection; serve the most informative qualifying
 *     pair, or nothing. Never a filler duel.
 */
const H = 60 * 60 * 1000;

export async function GET() {
  const supabase = supabaseServer();
  const admin = supabaseAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  // All of this user's duels — drives both the cooldown check and selection's
  // exclusion rules, fetched once.
  const { data: duelRows } = await admin
    .from('dish_duels')
    .select('id, dish_a, dish_b, winner, served_at, skipped_at, answered_at')
    .eq('user_id', user.id);
  const duels = duelRows ?? [];

  // 1. Resume an open, unexpired served duel rather than minting a new one.
  const now = Date.now();
  const pending = duels
    .filter(d => !d.answered_at && !d.skipped_at && now - new Date(d.served_at).getTime() < 24 * H)
    .sort((a, b) => new Date(b.served_at).getTime() - new Date(a.served_at).getTime())[0];
  if (pending) {
    const cards = await fetchDishCards(supabase, [pending.dish_a, pending.dish_b]);
    if (cards[pending.dish_a] && cards[pending.dish_b]) {
      return NextResponse.json({ duel: { id: pending.id, a: cards[pending.dish_a], b: cards[pending.dish_b] } });
    }
    // A dish went missing (deleted mid-flight) — fall through and try a fresh pair.
  }

  // 2. Spacing: one duel per ~day. Don't serve a new one right after the last was done.
  const lastDone = Math.max(
    0,
    ...duels.flatMap(d => [d.answered_at, d.skipped_at].filter(Boolean).map(s => new Date(s as string).getTime())),
  );
  if (now - lastDone < 20 * H) return NextResponse.json({ duel: null });

  // 3. Active selection over the user's rated dishes.
  const [{ data: profile }, { data: ratedRows }] = await Promise.all([
    supabase.from('taste_profiles').select('vector, evidence').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('ratings')
      .select('dishes(id, cuisine, attributes, dish_identity_id, name, name_zh, photo_url, restaurants(name))')
      .eq('user_id', user.id),
  ]);

  const candidates: DuelCandidate[] = [];
  const cardById: Record<string, DishCard> = {};
  for (const r of (ratedRows ?? []) as any[]) {
    const d = r.dishes;
    if (!d || !d.attributes || Object.keys(d.attributes).length === 0) continue;
    candidates.push({ id: d.id, cuisine: d.cuisine, attributes: d.attributes, identityId: d.dish_identity_id ?? null });
    cardById[d.id] = { id: d.id, name: d.name, name_zh: d.name_zh, photo_url: d.photo_url, restaurant: d.restaurants?.name ?? null };
  }

  const evidence = profile?.evidence ?? {};
  const existing: ExistingDuelRow[] = duels.map(d => ({ dish_a: d.dish_a, dish_b: d.dish_b, winner: d.winner, served_at: d.served_at, skipped_at: d.skipped_at }));
  const pair = selectDuelPair(candidates, evidence, existing, now);
  if (!pair) return NextResponse.json({ duel: null });

  // Seal the prediction: which side the engine expects to win, and how sure it is.
  // Empty affinity — the pair is same-cuisine so affinity cancels; {} keeps it pure
  // content, matching the learning update.
  const vector = profile?.vector ?? emptyTaste();
  const sA = contentScore(vector, pair.a.attributes, {});
  const sB = contentScore(vector, pair.b.attributes, {});
  const predictedWinner = sA >= sB ? pair.a.id : pair.b.id;
  const predictedP = sigmoid(DUEL_K * Math.abs(sA - sB));

  const { data: inserted, error } = await admin
    .from('dish_duels')
    .insert({ user_id: user.id, dish_a: pair.a.id, dish_b: pair.b.id, predicted_winner: predictedWinner, predicted_p: predictedP })
    .select('id')
    .single();
  if (error || !inserted) return NextResponse.json({ duel: null });

  return NextResponse.json({ duel: { id: inserted.id, a: cardById[pair.a.id], b: cardById[pair.b.id] } });
}

type DishCard = { id: string; name: string; name_zh: string | null; photo_url: string | null; restaurant: string | null };

/** Display fields for a set of dish ids, keyed by id. Uses the user client — a
 * person can always read their own dishes; only dish_duels itself is admin-only. */
async function fetchDishCards(supabase: ReturnType<typeof supabaseServer>, ids: string[]): Promise<Record<string, DishCard>> {
  const { data } = await supabase
    .from('dishes')
    .select('id, name, name_zh, photo_url, restaurants(name)')
    .in('id', ids);
  const out: Record<string, DishCard> = {};
  for (const d of (data ?? []) as any[]) {
    out[d.id] = { id: d.id, name: d.name, name_zh: d.name_zh, photo_url: d.photo_url, restaurant: d.restaurants?.name ?? null };
  }
  return out;
}
