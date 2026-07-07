import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { DIMS, DishVector } from '@/lib/taste';

/**
 * GET /api/restaurant/dashboard?restaurant_id=...
 * Owner analytics, all computed from data the platform already has:
 *  - per-dish performance: rating count, average delight (0-100), helpful marks
 *  - hidden gems: dishes rated clearly above the restaurant's average but logged
 *    less often than its median dish — the ones worth putting on the specials board
 *  - "what people love you for": the attribute dims most present in the restaurant's
 *    POSITIVELY-rated dishes, weighted by how positive — a taste-vector portrait of
 *    the kitchen's strengths as diners actually experience them
 * Requires a claim on the restaurant. Aggregates only — no individual diner's rating
 * is ever attributed to a person in what the owner sees.
 */
export async function GET(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const restaurantId = req.nextUrl.searchParams.get('restaurant_id');
  if (!restaurantId) return NextResponse.json({ error: 'restaurant_id is required.' }, { status: 400 });

  const { data: claim } = await supabase
    .from('restaurant_claims').select('status')
    .eq('restaurant_id', restaurantId).eq('user_id', user.id).maybeSingle();
  if (!claim) return NextResponse.json({ error: 'Claim this restaurant first.' }, { status: 403 });

  const admin = supabaseAdmin();
  const [{ data: restaurant }, { data: dishes }] = await Promise.all([
    admin.from('restaurants').select('id, name, address').eq('id', restaurantId).single(),
    admin.from('dishes').select('id, name, cuisine, photo_url, attributes, created_at')
      .eq('restaurant_id', restaurantId),
  ]);
  if (!restaurant) return NextResponse.json({ error: 'Restaurant not found.' }, { status: 404 });

  const dishIds = (dishes ?? []).map(d => d.id);
  const [{ data: ratings }, { data: marks }] = dishIds.length
    ? await Promise.all([
        admin.from('ratings').select('dish_id, score').in('dish_id', dishIds),
        admin.from('helpful_marks').select('dish_id').in('dish_id', dishIds),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }];

  // Per-dish aggregates.
  const byDish = new Map<string, { sum: number; n: number }>();
  for (const r of ratings ?? []) {
    const agg = byDish.get(r.dish_id) ?? { sum: 0, n: 0 };
    agg.sum += r.score; agg.n += 1;
    byDish.set(r.dish_id, agg);
  }
  const marksByDish = new Map<string, number>();
  for (const m of marks ?? []) marksByDish.set(m.dish_id, (marksByDish.get(m.dish_id) ?? 0) + 1);

  const to100 = (x: number) => Math.round(Math.min(100, Math.max(0, (x + 1) * 50)));

  const dishStats = (dishes ?? []).map(d => {
    const agg = byDish.get(d.id);
    return {
      id: d.id, name: d.name, cuisine: d.cuisine, photo_url: d.photo_url,
      rating_count: agg?.n ?? 0,
      avg_delight: agg && agg.n > 0 ? to100(agg.sum / agg.n) : null,
      helpful_marks: marksByDish.get(d.id) ?? 0,
      _avgRaw: agg && agg.n > 0 ? agg.sum / agg.n : null,
    };
  }).sort((a, b) => (b.avg_delight ?? -1) - (a.avg_delight ?? -1));

  // Hidden gems: clearly above the restaurant's own average, but under-logged.
  const ratedDishes = dishStats.filter(d => d._avgRaw !== null && d.rating_count > 0);
  const restAvg = ratedDishes.length
    ? ratedDishes.reduce((s, d) => s + d._avgRaw!, 0) / ratedDishes.length : 0;
  const counts = ratedDishes.map(d => d.rating_count).sort((a, b) => a - b);
  const medianCount = counts.length ? counts[Math.floor(counts.length / 2)] : 0;
  const hiddenGems = ratedDishes
    .filter(d => d._avgRaw! > restAvg + 0.15 && d.rating_count <= medianCount && ratedDishes.length >= 3)
    .slice(0, 3)
    .map(({ _avgRaw, ...d }) => d);

  // "What people love you for": positive-rating-weighted attribute presence.
  const dimWeights: Record<string, number> = Object.fromEntries(DIMS.map(d => [d, 0]));
  let totalWeight = 0;
  const attrsById = new Map((dishes ?? []).map(d => [d.id, d.attributes as DishVector]));
  for (const r of ratings ?? []) {
    if (r.score <= 0.2) continue;
    const attrs = attrsById.get(r.dish_id);
    if (!attrs) continue;
    for (const dim of DIMS) dimWeights[dim] += r.score * (attrs[dim] ?? 0);
    totalWeight += r.score;
  }
  const lovedFor = totalWeight > 0
    ? DIMS.map(d => ({ dim: d, weight: dimWeights[d] / totalWeight }))
        .filter(x => x.weight > 0.25)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 5)
        .map(x => x.dim)
    : [];

  return NextResponse.json({
    restaurant,
    claim_status: claim.status,
    totals: {
      dishes_logged: dishes?.length ?? 0,
      ratings: ratings?.length ?? 0,
      avg_delight: ratedDishes.length ? to100(restAvg) : null,
      helpful_marks: (marks ?? []).length,
    },
    dishes: dishStats.map(({ _avgRaw, ...d }) => d),
    hidden_gems: hiddenGems,
    loved_for: lovedFor,
  });
}
