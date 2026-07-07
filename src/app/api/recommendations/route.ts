import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { similarity, contentScore, blendScores, emptyTaste, TasteVector } from '@/lib/taste';
import { predictMF, mfBlendWeight } from '@/lib/mf';

/**
 * GET /api/recommendations
 * Three engines, blended:
 *  1. Content-based (taste.ts)     — hand-designed 18-dim vectors, works from rating #1
 *  2. Neighbor collaborative       — average of similar users' ratings, needs a few
 *                                     dozen users before it's reliable
 *  3. Matrix factorization (mf.ts) — learned latent factors, needs real volume; dormant
 *                                     (weight 0) until MF_ACTIVATION thresholds are met,
 *                                     then rises automatically as data grows — no manual
 *                                     switch. See mfBlendWeight() for the exact dial.
 * Cold-start stages (seed -> content -> collab) are unchanged from before; MF folds in
 * as an additional weighted voice once it has enough to say.
 */
export async function GET(_req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in for recommendations.' }, { status: 401 });

  const admin = supabaseAdmin();

  const { data: me } = await admin.from('taste_profiles').select('*').eq('user_id', user.id).maybeSingle();
  const myTaste: TasteVector = me?.vector ?? emptyTaste();
  const myCount: number = me?.rating_count ?? 0;

  // Dishes the user already rated or logged — exclude from candidates.
  const [{ data: myRatings }, { data: myDishes }] = await Promise.all([
    admin.from('ratings').select('dish_id').eq('user_id', user.id),
    admin.from('dishes').select('id').eq('user_id', user.id),
  ]);
  const excluded = new Set([...(myRatings ?? []).map(r => r.dish_id), ...(myDishes ?? []).map(d => d.id)]);

  // Candidate pool: recent dishes from everyone incl. synthetic seeds.
  const { data: candidates } = await admin
    .from('dishes')
    .select('id, user_id, name, name_zh, cuisine, photo_url, attributes, is_synthetic, restaurant_id, restaurants(name)')
    .order('created_at', { ascending: false })
    .limit(300);

  const pool = (candidates ?? []).filter(d => !excluded.has(d.id));

  // Stage 1: brand-new user — seed feed, no scoring pretense.
  if (myCount === 0) {
    return NextResponse.json({
      stage: 'seed',
      recommendations: pool.slice(0, 12).map(d => card(d, null, 'Popular on Dishi')),
    });
  }

  // Find similar users (top-k by cosine over taste vectors, min 3 ratings each).
  const { data: others } = await admin
    .from('taste_profiles').select('user_id, vector, rating_count')
    .neq('user_id', user.id).gte('rating_count', 3);
  const neighbors = (others ?? [])
    .map(o => ({ user_id: o.user_id, sim: similarity(myTaste, o.vector) }))
    .filter(n => n.sim > 0.2)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 20);

  // Their ratings over the candidate pool.
  const neighborIds = neighbors.map(n => n.user_id);
  const simByUser = new Map(neighbors.map(n => [n.user_id, n.sim]));
  const { data: neighborRatings } = neighborIds.length
    ? await admin.from('ratings').select('user_id, dish_id, score').in('user_id', neighborIds)
    : { data: [] as any[] };

  const collabByDish = new Map<string, { num: number; den: number; n: number }>();
  for (const r of neighborRatings ?? []) {
    const sim = simByUser.get(r.user_id) ?? 0;
    const agg = collabByDish.get(r.dish_id) ?? { num: 0, den: 0, n: 0 };
    agg.num += sim * r.score;
    agg.den += Math.abs(sim);
    agg.n += 1;
    collabByDish.set(r.dish_id, agg);
  }

  // --- Matrix factorization: load the model state and this user's factors, if any.
  const [{ data: mfState }, { data: myFactorsRow }, { count: liveRatingCount }] = await Promise.all([
    admin.from('mf_model_state').select('*').eq('id', true).maybeSingle(),
    admin.from('mf_user_factors').select('*').eq('user_id', user.id).maybeSingle(),
    admin.from('ratings').select('id', { count: 'exact', head: true }),
  ]);
  const mfWeight = mfState?.trained_at
    ? mfBlendWeight({ ratingCount: mfState.rating_count, distinctUsers: mfState.distinct_users }, liveRatingCount ?? 0)
    : 0;
  // Only worth fetching dish factors if this user actually has a trained factor vector
  // and the model currently carries any weight — otherwise skip the extra query.
  let dishFactorsById = new Map<string, { factors: number[]; bias: number }>();
  if (mfWeight > 0 && myFactorsRow) {
    const ids = pool.map(d => d.id);
    const { data: dishFactorRows } = await admin.from('mf_dish_factors').select('*').in('dish_id', ids);
    dishFactorsById = new Map((dishFactorRows ?? []).map(r => [r.dish_id, { factors: r.factors, bias: r.bias }]));
  }
  const mfModelShape = mfState?.trained_at ? {
    userFactors: myFactorsRow ? { [user.id]: myFactorsRow.factors } : {},
    dishFactors: Object.fromEntries(Array.from(dishFactorsById.entries()).map(([id, v]) => [id, v.factors])),
    userBias: myFactorsRow ? { [user.id]: myFactorsRow.bias } : {},
    dishBias: Object.fromEntries(Array.from(dishFactorsById.entries()).map(([id, v]) => [id, v.bias])),
    globalBias: mfState.global_bias,
    numFactors: mfState.num_factors,
    ratingCount: mfState.rating_count, distinctUsers: mfState.distinct_users, distinctDishes: mfState.distinct_dishes,
  } : null;

  const scored = pool.map(d => {
    const content = contentScore(myTaste, d.attributes, me?.cuisine_affinity ?? {}, d.cuisine);
    const agg = collabByDish.get(d.id);
    const collab = agg && agg.den > 0 ? agg.num / agg.den : null;
    const { score: baseScore, source: baseSource } = blendScores(content, collab, agg?.n ?? 0);

    const mfPred = mfWeight > 0 && mfModelShape ? predictMF(mfModelShape, user.id, d.id) : null;
    const finalScore = mfPred !== null ? (1 - mfWeight) * baseScore + mfWeight * mfPred : baseScore;
    const source = mfPred !== null && mfWeight > 0.35 ? 'learned' : baseSource;

    return { d, score: finalScore, source };
  }).sort((a, b) => b.score - a.score).slice(0, 12);

  return NextResponse.json({
    stage: scored.some(s => s.source === 'learned') ? 'learned' : scored.some(s => s.source === 'collab') ? 'collab' : 'content',
    mf_weight: Math.round(mfWeight * 100) / 100, // exposed for debugging/transparency, harmless to ignore in the client
    recommendations: scored.map(({ d, score, source }) =>
      card(d, score, source === 'learned' ? 'Learned from the whole community\u2019s taste'
        : source === 'collab' ? 'People with your taste loved this' : 'Similar to dishes you loved')),
  });
}

function card(d: any, score: number | null, reason: string) {
  return {
    dish_id: d.id,
    owner_id: d.user_id,
    name: d.name,
    name_zh: d.name_zh ?? null,
    cuisine: d.cuisine,
    photo_url: d.photo_url,
    restaurant: d.restaurants?.name ?? null,
    is_synthetic: d.is_synthetic,
    score,
    reason,
  };
}
